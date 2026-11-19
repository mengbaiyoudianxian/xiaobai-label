"""小白标注的站点层（只在 xiaobai_label.settings 启用时生效）：

1. 界面全部是小白标注自己的：首页、项目、任务列表、标注器、成员、我的账号、关于，
   都由 /xb/app/ 下的前端负责；Label Studio 只当后台用（账号、数据库、/api/ 接口、图片文件）。
   它自带的网页界面一律不再提供。
2. 登录：填账号名就行（也认完整邮箱），一直保持登录。
3. 注册：只要账号名 + 密码，后台自动配一个内部邮箱 <名字>@xiaobai.local。
4. 不再自动退出登录：组织的会话时限改成一年。
5. /xb/api/password：改密码（Label Studio 没有这个接口）。
"""
import hashlib
import json
import logging
import os
import re
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model, update_session_auth_hash
from django.http import FileResponse, Http404, HttpResponseRedirect, JsonResponse
from django.middleware.csrf import CsrfViewMiddleware
from django.shortcuts import render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.static import serve

logger = logging.getLogger(__name__)

# 图标：地址里带版本号，长期缓存
ICONS = ('logo.svg', 'logo-64.png', 'logo-180.png', 'favicon.ico')
# 浏览器自己会去要 /favicon.ico，一律给小白标注的图标
FAVICON_PATH = re.compile(r'^(/favicon\.ico|/static\S*/images/favicon[^/]*\.(ico|png))$')
# 交给 Label Studio 后台处理的地址：接口、图片文件、登录注册、退出、后台管理
BACKEND = re.compile(r'^/(api|data|storage-data|user/(login|signup)|logout|admin|health|version|metrics|api-auth|django-rq|static'
                     r'|tasks/\d+/(resolve|presign))(/|$)')
# Label Studio 自带网页界面的前端代码：不再提供
OLD_UI = re.compile(r'^/(react-app|dm|label-studio-frontend|sw\.js|docs|swagger|feature-flags|heidi-tips|__lsa|samples|trigger500)(/|$|\.)')
APP_FILE = re.compile(r'^app/[a-z0-9_-]+\.(js|css)$')
SAFE_NAME = re.compile(r'[A-Za-z0-9._-]{1,60}')


def _path(request):
    return request.path_info.rstrip('/')


def internal_email(name):
    local = name.lower() if SAFE_NAME.fullmatch(name) else 'u' + hashlib.sha1(name.encode('utf-8')).hexdigest()[:12]
    return f'{local}@{settings.XB_INTERNAL_EMAIL_DOMAIN}'


def find_user(name):
    """账号名 → 用户：先比用户名，再比显示名，再比邮箱 @ 前面那段（都不分大小写），只认唯一匹配。"""
    User = get_user_model()
    for q in ({'username__iexact': name}, {'first_name__iexact': name}, {'email__istartswith': name + '@'}):
        found = list(User.objects.filter(is_active=True, **q)[:2])
        if len(found) == 1:
            return found[0]
    return None


def _set_post(request, **values):
    post = request.POST.copy()
    for k, v in values.items():
        post[k] = v
    request.POST = post


def _authed(request):
    user = getattr(request, 'user', None)
    return bool(user and user.is_authenticated)


class XiaobaiMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self._long_sessions()

    @staticmethod
    def _long_sessions():
        try:
            from organizations.models import Organization
            from session_policy.models import SessionTimeoutPolicy

            minutes = settings.XB_SESSION_MINUTES
            for org in Organization.objects.all():
                policy, _ = SessionTimeoutPolicy.objects.get_or_create(organization=org)
                if policy.max_session_age < minutes or policy.max_time_between_activity < minutes:
                    policy.max_session_age = minutes
                    policy.max_time_between_activity = minutes
                    policy.save()
        except Exception:   # 数据库还没迁移好之类：不影响启动
            logger.exception('xiaobai: could not lengthen session policy')

    def __call__(self, request):
        path = _path(request)
        full = request.path_info
        if path == '/xb/api/password':
            return self._password(request)
        if full.startswith('/xb/'):
            return self._asset(request, full[len('/xb/'):])
        if FAVICON_PATH.match(full):
            return self._asset(request, 'favicon.ico' if full.endswith('.ico') else 'logo-64.png')
        if OLD_UI.match(full):
            raise Http404()

        if not BACKEND.match(full) and request.method in ('GET', 'HEAD'):
            return self._app(request, about=(path == '/about'))

        signup_name = None
        if request.method == 'POST' and path == '/user/login':
            self._login(request)
        elif request.method == 'POST' and path == '/user/signup':
            signup_name = self._signup(request)

        response = self.get_response(request)

        if signup_name and response.status_code in (301, 302):
            self._name_new_user(signup_name)
        return response

    # ---------- 前端 ----------
    def _app(self, request, about=False):
        anon = not _authed(request)
        if anon and not about:
            nxt = request.get_full_path()
            if not url_has_allowed_host_and_scheme(nxt, allowed_hosts={request.get_host()}):
                nxt = '/'
            return HttpResponseRedirect('/user/login/?next=' + quote(nxt) if nxt not in ('', '/') else '/user/login/')
        conf = json.dumps({'name': settings.XB_NAME, 'version': settings.XB_VERSION, 'demo': settings.XB_DEMO,
                           'anon': anon}, ensure_ascii=False)
        resp = render(request, 'xiaobai/app.html', {'xb_name': settings.XB_NAME, 'xb_config': conf, 'v': self._version()})
        resp['Cache-Control'] = 'no-cache'
        return resp

    @staticmethod
    def _version():
        mt = 0
        base = settings.XB_STATIC_DIR
        for root in (base, os.path.join(base, 'app')):
            try:
                for name in os.listdir(root):
                    mt = max(mt, int(os.stat(os.path.join(root, name)).st_mtime))
            except OSError:
                pass
        return mt

    @staticmethod
    def _asset(request, name):
        if name in ICONS:
            full = os.path.join(settings.XB_STATIC_DIR, name)
            if not os.path.isfile(full):
                raise Http404()
            ctype = {'.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'}[os.path.splitext(name)[1]]
            resp = FileResponse(open(full, 'rb'), content_type=ctype)
            resp['Cache-Control'] = 'public, max-age=31536000, immutable'
            return resp
        if APP_FILE.match(name):
            # 前端文件之间互相引用时地址里不带版本号：每次都向服务器确认一下有没有改（没改就是 304，很快）
            resp = serve(request, name, document_root=settings.XB_STATIC_DIR)
            ctype = 'text/javascript' if name.endswith('.js') else 'text/css'
            resp['Content-Type'] = ctype + '; charset=utf-8'
            resp['Cache-Control'] = 'no-cache'
            return resp
        raise Http404()

    # ---------- 改密码 ----------
    @staticmethod
    def _password(request):
        if request.method != 'POST':
            return JsonResponse({'detail': '只支持 POST'}, status=405)
        if not _authed(request):
            return JsonResponse({'detail': '请先登录'}, status=401)
        reject = CsrfViewMiddleware(lambda r: None).process_view(request, None, (), {})
        if reject is not None:
            return JsonResponse({'detail': '页面过期了，刷新一下再试'}, status=403)
        try:
            data = json.loads(request.body or b'{}')
        except ValueError:
            return JsonResponse({'detail': '格式不对'}, status=400)
        old, new = str(data.get('old', '')), str(data.get('new', ''))
        if not new:
            return JsonResponse({'detail': '新密码不能空着'}, status=422)
        if not request.user.check_password(old):
            return JsonResponse({'detail': '现在的密码不对'}, status=400)
        request.user.set_password(new)
        request.user.save(update_fields=['password'])
        update_session_auth_hash(request, request.user)
        return JsonResponse({'ok': True})

    # ---------- 登录 / 注册 ----------
    @staticmethod
    def _login(request):
        name = request.POST.get('email', '').strip()
        values = {'persist_session': 'on'}
        if name and '@' not in name:
            user = find_user(name)
            values['email'] = user.email if user else name
        _set_post(request, **values)

    @staticmethod
    def _signup(request):
        name = request.POST.get('email', '').strip()
        if not name or '@' in name:
            return None
        existing = find_user(name)
        # 名字被占用时交给 Label Studio 报"已存在"（模板里显示成中文）
        _set_post(request, email=existing.email if existing else internal_email(name),
                  allow_newsletters='false', how_find_us='', elaborate='')
        return None if existing else name

    @staticmethod
    def _name_new_user(name):
        User = get_user_model()
        user = User.objects.filter(email=internal_email(name)).first()
        if user and (user.username != name or user.first_name != name):
            user.username = name
            user.first_name = name[:150]
            user.save(update_fields=['username', 'first_name'])

"""小白标注：在开源 Label Studio（Apache-2.0）上加的一层，不改 Label Studio 本身的代码。

启用：启动 label-studio 前设
    PYTHONPATH=<本仓库根目录>
    DJANGO_SETTINGS_MODULE=xiaobai_label.settings
不设这两个变量，Label Studio 就是原样。
"""
import os

import label_studio

# Label Studio 的设置文件执行到一半就会读 django.conf.settings（初始化 Sentry），
# 所以不能 import 它，要在本模块里原样执行一遍，跟它自己当设置模块时一模一样。
_LS_SETTINGS = os.path.join(os.path.dirname(label_studio.__file__), 'core', 'settings', 'label_studio.py')
with open(_LS_SETTINGS, encoding='utf-8') as _f:
    exec(compile(_f.read(), _LS_SETTINGS, 'exec'), globals())

HERE = os.path.dirname(os.path.abspath(__file__))

# 不往外报错误：页面上不加载 Sentry（原来每切一页都要白发几个失败的请求）
FRONTEND_SENTRY_DSN = None

XB_NAME = '小白标注'
XB_VERSION = '0.1.0'
XB_STATIC_DIR = os.path.join(HERE, 'static')
XB_INTERNAL_EMAIL_DOMAIN = 'xiaobai.local'      # 注册不要邮箱：后台配一个内部地址
XB_SESSION_MINUTES = 365 * 24 * 60              # 一直保持登录
XB_DEMO = os.environ.get('XB_DEMO', '') == '1'  # 公网演示站：页面上加演示提示

# 我们的模板放前面：登录、注册、关于、出错页
TEMPLATES[0]['DIRS'] = [os.path.join(HERE, 'templates')] + list(TEMPLATES[0]['DIRS'])  # noqa: F821

# 不限密码长度、不查跟账号像不像
AUTH_PASSWORD_VALIDATORS = []

_anchor = 'core.middleware.InactivitySessionTimeoutMiddleWare'
_mw = 'xiaobai_label.middleware.XiaobaiMiddleware'
if _anchor in MIDDLEWARE:  # noqa: F821
    MIDDLEWARE.insert(MIDDLEWARE.index(_anchor), _mw)  # noqa: F821
else:
    MIDDLEWARE.insert(MIDDLEWARE.index('django.contrib.auth.middleware.AuthenticationMiddleware') + 1, _mw)  # noqa: F821

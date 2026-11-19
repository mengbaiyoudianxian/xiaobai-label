"""Seed a local 小白标注 instance: a test account (password written to <data>/TEST_LOGIN.txt) and a demo project
with the images in <data>/images.  Run with the same environment as run-local.ps1:
    <venv>/python tools/make_demo.py <数据目录>      （数据目录下的 images/ 里放示例图片）
"""
import os
import secrets
import sys
from pathlib import Path

data = Path(sys.argv[1])
# 示例图片所在的根目录（= LABEL_STUDIO_LOCAL_FILES_DOCUMENT_ROOT），图片放在 <根目录>/images/ 下。
# 公网部署时一定要让它和数据目录分开，否则别人能通过本地文件接口读到数据库。
root = Path(os.environ.get('XB_DEMO_ROOT', str(data)))
os.environ.setdefault('LABEL_STUDIO_BASE_DATA_DIR', str(data))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'xiaobai_label.settings')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import label_studio  # noqa: E402

sys.path.insert(0, os.path.dirname(label_studio.__file__))
import django  # noqa: E402

django.setup()
from organizations.models import Organization  # noqa: E402
from projects.models import Project  # noqa: E402
from tasks.models import Task  # noqa: E402
from users.models import User  # noqa: E402

CFG = ('<View><Image name="image" value="$image" zoom="true"/>'
       '<RectangleLabels name="label" toName="image"><Label value="船只" background="#4b7bff"/>'
       '<Label value="人" background="#ff4fd8"/><Label value="车辆" background="#b44dff"/></RectangleLabels>'
       # 多边形用同一套标签：标注器里拖动是拉框、单击是画多边形
       '<View style="display:none"><PolygonLabels name="area" toName="image"><Label value="船只" background="#4b7bff"/>'
       '<Label value="人" background="#ff4fd8"/><Label value="车辆" background="#b44dff"/></PolygonLabels></View></View>')

user = User.objects.filter(username='测试员').first()
if not user:
    pw = secrets.token_urlsafe(9)
    user = User.objects.create_user('ceshiyuan@xiaobai.local', pw)
    user.username = user.first_name = '测试员'
    user.save()
    org = Organization.objects.first() or Organization.create_organization(created_by=user, title='小白标注')
    org.add_user(user)
    user.active_organization = org
    user.save()
    (data / 'TEST_LOGIN.txt').write_text(f'测试员 {pw}\n', encoding='utf-8')
p, made = Project.objects.get_or_create(title='示例：航拍图片', defaults={
    'created_by': user, 'organization': user.active_organization, 'label_config': CFG})
if p.label_config != CFG:
    p.label_config = CFG
    p.save()
# Label Studio only serves /data/local-files/ for paths covered by a project's local storage
from io_storages.localfiles.models import LocalFilesImportStorage  # noqa: E402

LocalFilesImportStorage.objects.get_or_create(project=p, path=str(root / 'images'),
                                              defaults={'title': '示例图片', 'use_blob_urls': True})
if made:
    for img in sorted(f for f in (root / 'images').iterdir() if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp')):
        Task.objects.create(project=p, data={'image': f'/data/local-files/?d=images/{img.name}'})
print('project', p.id, 'tasks', Task.objects.filter(project=p).count(), 'user', user.username)

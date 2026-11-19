# 小白标注

给图片拉框、勾多边形、导出训练数据的网页工具。几个人各自登录，同一批图片分着标，标完直接拿去训练模型。

小白标注是孟白在做**江苏陆航**无人机巡检识别项目时，为了给模型准备航拍训练数据，一边用一边打磨出来的产品。

开源的 [Label Studio](https://github.com/HumanSignal/label-studio) 功能很全，但对国内的小团队来说像一套毛坯房：
全英文、要手写 XML 配置、注册要邮箱、隔几天就被踢下线、满屏用不上的企业版入口。
小白标注在它的地基上把整套房子重新设计、重新装修了一遍：**界面、交互、标注器全部重写**，每一处都按人实际怎么用来定，
做成一套给中国团队用的精装房。

## 做了什么

- **界面整套重做**：首页、项目、任务列表、成员、账号、标注器全部自己设计、从零编写（`xiaobai_label/static/app/`，
  原生 JavaScript，不依赖前端框架、不用打包）；深色毛玻璃视觉和动效，切页不刷新、不闪。
- **全中文**：按国内的叫法写，专业名词中文为主、英文小字对照。
- **重写标注器**：不用切工具，按住拖动就是拉框、单击就是画多边形；右键拖动移动框或平移图片，滚轮缩放，数字键选标签；
  Backspace 删除、Ctrl+Z 撤销、Ctrl+Enter 提交、↑ ↓ 换图；画完不自动选中，换标签不会误改上一个框；
  没提交就离开会提醒；下一张提前加载。
- **上手零门槛**：第一次进标注页有配示例图的动画教程，顶部常驻操作提示。
- **流程顺手**：新建项目时直接点选标签和颜色（原版要手写 XML 配置）；图片拖进来批量导入；首页一眼看各项目进度、
  一键接着标；任务按 没标的 / 标好的 / 跳过的 筛选；YOLO、COCO、Pascal VOC、JSON、CSV 一键导出。
- **去掉不合理的设计**：注册只要账号名和密码，不要邮箱、不限密码格式；登录后一直保持；企业版广告和用不上的入口全部拿掉。
- **数据通用**：标注结果和 Label Studio 格式完全一致，旧数据直接能用。

后台的账号、数据存储和数据接口使用 Label Studio（作为依赖库安装，见下方许可）。

## 运行

需要 Python 3.10 以上。

```bash
pip install label-studio==1.23.2
git clone https://github.com/mengbaiyoudianxian/xiaobai-label.git
cd xiaobai-label
```

Linux / macOS：

```bash
PYTHONPATH=$PWD DJANGO_SETTINGS_MODULE=xiaobai_label.settings label-studio start --port 8080
```

Windows（PowerShell）：

```powershell
.\tools\run-local.ps1 -Python <装了 label-studio 的 python.exe> -Data <数据目录> -Port 8080
```

打开 http://localhost:8080 ，注册一个账号就能用。

## 目录

| 路径 | 说明 |
| --- | --- |
| `xiaobai_label/static/app/` | 前端：`main.js` 顶栏和换页，`pages.js` 各个页面，`editor.js` 标注器，`tour.js` 新手教程，`app.css` 样式 |
| `xiaobai_label/middleware.py` | 所有页面都交给前端；账号名登录 / 注册、不自动退出、改密码接口 |
| `xiaobai_label/settings.py` | 在 Label Studio 设置上加的改动 |
| `xiaobai_label/templates/` | 前端外壳、登录、注册、出错页 |
| `tools/` | 本机运行、示例数据、生成图标 |

## 许可

Apache License 2.0，见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。
Label Studio 是 HumanSignal 的商标；小白标注是孟白的个人项目，不是 Label Studio 的官方版本，也没有得到 HumanSignal 的认可或支持。

// 小白标注前端：各个页面
import {
  CONF, api, load, me, esc, fmt, pct, icon, toast, modal, confirm, userName, account,
  parseConfig, makeConfig, PALETTE, taskImage, timeAgo, clearCache, reduceMotion
} from './core.js';

// 同一个页面第二次来就不再播入场动画（内容直接摆好，不像"重新加载"）
const seen = new Set();
function firstVisit(key) { const f = !seen.has(key); seen.add(key); return f && !reduceMotion; }

const io = ('IntersectionObserver' in window) ? new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
function reveal(root) {
  const els = root.querySelectorAll('.reveal:not(.in)');
  els.forEach(el => { if (io) io.observe(el); else el.classList.add('in'); });
  // 保险：页面在后台时观察器可能不触发，别让卡片一直是透明的
  setTimeout(() => els.forEach(el => el.classList.add('in')), 1600);
}
function bars(root, animate) {
  const set = () => root.querySelectorAll('.bar i[data-w]').forEach(i => { i.style.width = i.dataset.w + '%'; });
  if (animate) setTimeout(set, 60); else set();
}
const spot = '<span class="spot" aria-hidden="true"></span>';

function head(title, en, sub, actions = '') {
  return `<header class="phead"><div><h1>${esc(title)}<small>${en}</small></h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="phead__act">${actions}</div></header>`;
}

// ===================================================================== 首页
export async function home(page, r, { setTitle }) {
  setTitle('首页');
  const anim = firstVisit('home');
  page.innerHTML = `<div class="wrap ${anim ? 'anim' : ''}"><section class="hero glass rise"><h1 class="hello">你好</h1><p class="muted">正在加载…</p></section></div>`;
  const wrap = page.firstElementChild;
  let user = null;
  me().then(u => { user = u; const h = wrap.querySelector('.hello'); if (h) h.innerHTML = hello(u); }).catch(() => {});
  function hello(u) { const n = userName(u); return '你好' + (n ? `，<span class="g">${esc(n)}</span>` : ''); }

  await load('/api/projects?page_size=200&ordering=id', data => {
    const list = (data.results || data || []).slice().sort((a, b) => a.id - b.id);
    let total = 0, done = 0;
    list.forEach(p => { total += p.task_number || 0; done += p.num_tasks_with_annotations || 0; });
    wrap.innerHTML =
      `<section class="hero glass rise">
        <h1 class="hello">${hello(user)}</h1>
        <p class="muted">选一个项目点「继续标注」，会从还没标的图片接着往下。</p>
        <div class="stats rise d1">
          <div class="stat"><b>${list.length}</b><span>项目</span></div>
          <div class="stat"><b>${fmt(total)}</b><span>图片总数</span></div>
          <div class="stat"><b>${fmt(done)}</b><span>已标注</span></div>
          <div class="stat"><b>${pct(done, total)}%</b><span>总进度</span></div>
        </div>
        ${CONF.demo ? '<div class="tip">这是公开演示站，数据会定期清空，请不要上传私人或公司的图片。</div>' : ''}
      </section>
      <div class="sec reveal"><h2>我的项目</h2><span>PROJECTS</span><a href="/projects/">全部项目 →</a></div>
      ${list.length ? `<div class="cards">${list.map((p, i) => projectCard(p, i)).join('')}</div>`
        : `<div class="empty glass reveal"><p>还没有项目。</p><a class="btn primary" href="/projects/?new=1">${icon('plus')}新建项目</a></div>`}
      <footer class="foot">${esc(CONF.name)} · 孟白作品 · <a href="/about/">关于与开源声明</a></footer>`;
    reveal(wrap);
    bars(wrap, anim);
  });
}

function projectCard(p, i) {
  const n = p.task_number || 0, d = p.num_tasks_with_annotations || 0, left = Math.max(0, n - d), pp = pct(d, n);
  const chip = !n ? '<span class="chip">还没有图片</span>' : left === 0 ? '<span class="chip">已完成</span>' : `<span class="chip live">还剩 ${fmt(left)} 张</span>`;
  return `<article class="card tilt glass reveal" style="--dl:${(0.04 + 0.1 * (i % 2)).toFixed(2)}s">${spot}
    <div class="card__top"><div class="pic">${esc((p.title || '?').trim().charAt(0))}</div>
      <div class="card__t"><h3><a href="/projects/${p.id}/">${esc(p.title)}</a></h3><p>${fmt(n)} 张图片</p></div>${chip}</div>
    <div class="bar"><i data-w="${pp}"></i></div>
    <div class="nums"><span>已标注 ${fmt(d)} / ${fmt(n)}</span><span>${pp}%</span></div>
    <div class="go">
      ${left ? `<a class="btn primary" href="/projects/${p.id}/label">${icon('play')}继续标注</a>` : ''}
      <a class="btn" href="/projects/${p.id}/">任务列表</a>
    </div></article>`;
}

// ===================================================================== 项目列表
export async function projects(page, r, { setTitle, go }) {
  setTitle('项目');
  const anim = firstVisit('projects');
  page.innerHTML = `<div class="wrap ${anim ? 'anim' : ''}">${head('项目', 'Projects', '每个项目是一批图片 + 一套标签。', `<button class="btn primary" data-new>${icon('plus')}新建项目</button>`)}<div class="list"><p class="muted">正在加载…</p></div></div>`;
  const wrap = page.firstElementChild;
  wrap.querySelector('[data-new]').onclick = () => newProject(go);
  if (new URLSearchParams(location.search).get('new')) { history.replaceState(null, '', '/projects/'); newProject(go); }
  await load('/api/projects?page_size=200&ordering=id', data => {
    const list = (data.results || data || []).slice().sort((a, b) => a.id - b.id);
    wrap.querySelector('.list').innerHTML = list.length
      ? `<div class="cards">${list.map((p, i) => projectCard(p, i)).join('')}</div>`
      : `<div class="empty glass"><p>还没有项目。点右上角「新建项目」，起个名字、定好标签就能开始。</p></div>`;
    reveal(wrap);
    bars(wrap, anim);
  });
}

// 标签编辑器：一行一个标签（颜色 + 名字）
function labelsEditor(labels) {
  const row = (l, i) => `<div class="lrow"><input type="color" value="${esc(l.color)}" aria-label="颜色"><input type="text" value="${esc(l.value)}" placeholder="标签名，比如 船只" maxlength="40"><button type="button" class="icon-btn" data-del title="删掉这个标签">${icon('trash')}</button></div>`;
  return `<div class="labels-ed">${labels.map(row).join('')}</div><button type="button" class="btn sm ghost" data-add>${icon('plus')}加一个标签</button>`;
}
function bindLabels(box) {
  const ed = box.querySelector('.labels-ed');
  box.querySelector('[data-add]').onclick = () => {
    const n = ed.children.length;
    ed.insertAdjacentHTML('beforeend', `<div class="lrow"><input type="color" value="${PALETTE[n % PALETTE.length]}" aria-label="颜色"><input type="text" placeholder="标签名" maxlength="40"><button type="button" class="icon-btn" data-del title="删掉这个标签">${icon('trash')}</button></div>`);
    ed.lastElementChild.querySelector('input[type=text]').focus();
  };
  ed.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) d.closest('.lrow').remove(); });
  ed.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.type === 'text') { e.preventDefault(); e.stopPropagation(); box.querySelector('[data-add]').click(); }
  });
}
function readLabels(box) {
  const out = [], names = new Set();
  for (const row of box.querySelectorAll('.lrow')) {
    const v = row.querySelector('input[type=text]').value.trim();
    if (!v) continue;
    if (names.has(v)) throw new Error('标签「' + v + '」重复了');
    names.add(v);
    out.push({ value: v, color: row.querySelector('input[type=color]').value });
  }
  if (!out.length) throw new Error('至少要有一个标签');
  return out;
}

async function newProject(go) {
  const body = `<label class="field"><span>项目名</span><input type="text" name="title" maxlength="50" placeholder="比如 航拍巡检 第一批"></label>
    <div class="field"><span>标签</span><p class="hint">标注时先选标签再画。每个标签都能拉框也能画多边形。</p>
    ${labelsEditor([{ value: '', color: PALETTE[0] }])}</div>`;
  let data = null;
  const res = await modal({
    title: '新建项目', body, onOpen: bindLabels,
    actions: [{ label: '取消', value: null }, { label: '建好了', kind: 'primary', value: 'ok' }],
    keep: (v, box) => {
      try {
        const title = box.querySelector('[name=title]').value.trim();
        if (!title) throw new Error('给项目起个名字');
        data = { title, labels: readLabels(box) };
      } catch (e) { toast(e.message, 'bad'); return false; }
      return true;
    },
  });
  if (!res || !data) return;
  try {
    const p = await api('/api/projects/', { method: 'POST', body: { title: data.title, label_config: makeConfig(data.labels) } });
    toast('项目建好了，导入图片就能开始标');
    go(`/projects/${p.id}/`);
  } catch (e) { toast(e.message, 'bad'); }
}

// ===================================================================== 单个项目：任务列表
const FILTERS = [
  ['all', '全部', null],
  ['todo', '没标的', [{ filter: 'filter:tasks:total_annotations', operator: 'equal', type: 'Number', value: 0 },
    { filter: 'filter:tasks:cancelled_annotations', operator: 'equal', type: 'Number', value: 0 }]],
  ['done', '标好的', [{ filter: 'filter:tasks:total_annotations', operator: 'greater', type: 'Number', value: 0 }]],
  ['skip', '跳过的', [{ filter: 'filter:tasks:cancelled_annotations', operator: 'greater', type: 'Number', value: 0 }]]
];
const PAGE = 60;

export async function project(page, r, { setTitle, go }) {
  const id = r.id;
  const anim = firstVisit('project' + id);
  page.innerHTML = `<div class="wrap ${anim ? 'anim' : ''}"><div class="ptop"></div>
    <div class="toolbar"><div class="seg" role="tablist">${FILTERS.map((f, i) => `<button type="button" data-f="${f[0]}" class="${i ? '' : 'on'}">${f[1]}</button>`).join('')}</div><span class="count muted"></span></div>
    <div class="tiles"></div><div class="more"></div></div>`;
  const wrap = page.firstElementChild;
  let proj = null, cfg = null, filter = 'all', pageNo = 0, total = 0, loading = false, alive = true;

  function drawTop(p) {
    proj = p; cfg = parseConfig(p.label_config);
    setTitle(p.title);
    const n = p.task_number || 0, d = p.num_tasks_with_annotations || 0;
    wrap.querySelector('.ptop').innerHTML = `
      <nav class="crumbs"><a href="/projects/">项目</a><span>/</span><b>${esc(p.title)}</b></nav>
      <section class="pcard glass rise">
        <div class="pcard__main">
          <h1>${esc(p.title)}</h1>
          ${p.description ? `<p class="muted">${esc(p.description)}</p>` : ''}
          <div class="labels">${cfg.labels.map(l => `<span class="lab" style="--c:${esc(l.color)}">${esc(l.value)}</span>`).join('') || '<span class="muted">还没有标签</span>'}</div>
        </div>
        <div class="pcard__stats">
          <div class="stat"><b>${fmt(n)}</b><span>图片</span></div>
          <div class="stat"><b>${fmt(d)}</b><span>已标注</span></div>
          <div class="stat"><b>${fmt(p.skipped_annotations_number || 0)}</b><span>跳过</span></div>
          <div class="stat"><b>${pct(d, n)}%</b><span>进度</span></div>
        </div>
        <div class="bar"><i data-w="${pct(d, n)}"></i></div>
        <div class="go">
          <a class="btn primary" href="/projects/${id}/label">${icon('play')}${d ? '继续标注' : '开始标注'}</a>
          <button type="button" class="btn" data-import>${icon('upload')}导入图片</button>
          <button type="button" class="btn" data-export>${icon('download')}导出</button>
          <a class="btn ghost" href="/projects/${id}/settings">${icon('gear')}设置</a>
        </div>
      </section>`;
    wrap.querySelector('[data-import]').onclick = () => importImages(id, () => { refreshAll(); });
    wrap.querySelector('[data-export]').onclick = () => exportProject(id, p);
    bars(wrap, anim);
  }

  function query() {
    const f = FILTERS.find(x => x[0] === filter)[2];
    if (!f) return '';
    return '&query=' + encodeURIComponent(JSON.stringify({ filters: { conjunction: 'and', items: f } }));
  }
  function tile(t) {
    const img = taskImage(t, cfg);
    const st = t.total_annotations > 0 ? ['done', '已标'] : t.cancelled_annotations > 0 ? ['skip', '跳过'] : ['todo', '没标'];
    return `<a class="tile" href="/projects/${id}/label?task=${t.id}" data-id="${t.id}">
      <span class="tile__img">${img ? `<img loading="lazy" decoding="async" src="${esc(img)}" alt="">` : ''}</span>
      <span class="tile__bar"><b>#${t.inner_id || t.id}</b><i class="st ${st[0]}">${st[1]}</i>
      <button type="button" class="icon-btn" data-del title="删掉这张图片">${icon('trash')}</button></span></a>`;
  }
  async function more(reset) {
    if (loading) return;
    loading = true;
    const tiles = wrap.querySelector('.tiles');
    const url = `/api/tasks?project=${id}&page=${pageNo + 1}&page_size=${PAGE}&fields=task_only${query()}`;
    try {
      let firstDraw = true;
      await load(url, data => {
        if (!alive) return;
        const list = data.tasks || [];
        total = data.total || 0;
        const markup = list.map(tile).join('');
        if (reset && firstDraw) tiles.innerHTML = markup;
        else if (reset) tiles.innerHTML = markup;            // 新数据回来了：这一页整个换掉
        else tiles.insertAdjacentHTML('beforeend', markup);
        firstDraw = false;
        wrap.querySelector('.count').textContent = `共 ${fmt(total)} 张`;
        if (!total) tiles.innerHTML = `<div class="empty glass"><p>${filter === 'all' ? '这个项目还没有图片。点上面「导入图片」把要标的图片传上来。' : '这一类里没有图片。'}</p></div>`;
      });
      pageNo++;
    } finally { loading = false; }
    const shown = wrap.querySelectorAll('.tile').length;
    wrap.querySelector('.more').innerHTML = shown < total ? `<button type="button" class="btn ghost">再显示 ${Math.min(PAGE, total - shown)} 张</button>` : '';
    const b = wrap.querySelector('.more button');
    if (b) { b.onclick = () => more(false); if (moreIo) moreIo.observe(b); }
  }
  const moreIo = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { moreIo.unobserve(e.target); more(false); }
  }), { rootMargin: '400px' }) : null;

  function refreshAll() {
    load(`/api/projects/${id}/`, drawTop);
    pageNo = 0; more(true);
  }

  wrap.querySelector('.seg').addEventListener('click', e => {
    const b = e.target.closest('[data-f]');
    if (!b || b.dataset.f === filter) return;
    filter = b.dataset.f;
    wrap.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b));
    pageNo = 0;
    more(true);
  });
  wrap.querySelector('.tiles').addEventListener('click', async e => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    e.preventDefault(); e.stopPropagation();
    const t = del.closest('.tile');
    if (!await confirm('删掉这张图片？', '图片和它上面的标注会一起删掉，删了就找不回来。', '删除', true)) return;
    try {
      await api(`/api/tasks/${t.dataset.id}/`, { method: 'DELETE' });
      t.remove();
      toast('删掉了');
      load(`/api/projects/${id}/`, drawTop);
    } catch (err) { toast(err.message, 'bad'); }
  });

  await load(`/api/projects/${id}/`, drawTop, e => {
    wrap.innerHTML = `<div class="empty glass"><h2>${e.status === 404 ? '没有这个项目' : '项目没加载出来'}</h2><p>${esc(e.message)}</p><a class="btn" href="/projects/">回到项目列表</a></div>`;
    alive = false;
  });
  if (alive) more(true);
  return { cleanup() { alive = false; if (moreIo) moreIo.disconnect(); } };
}

// 导入图片：拖进来或选文件，20 张一批传上去
async function importImages(id, done) {
  let files = [];
  const body = `<label class="drop" tabindex="0"><input type="file" accept="image/*" multiple hidden>
      ${icon('upload', 'big')}<b>把图片拖到这里，或点一下选择</b><span class="muted">可以一次选很多张，支持 jpg / png / webp / bmp</span></label>
    <p class="picked muted"></p><div class="bar up" hidden><i></i></div>`;
  await modal({
    title: '导入图片', body,
    actions: [{ label: '关闭', value: null }, { label: '开始上传', kind: 'primary', value: 'go' }],
    onOpen(box) {
      const drop = box.querySelector('.drop'), input = drop.querySelector('input');
      const pick = list => {
        files = [...list].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|bmp|gif|tiff?)$/i.test(f.name));
        box.querySelector('.picked').textContent = files.length ? `选了 ${files.length} 张（${(files.reduce((s, f) => s + f.size, 0) / 1048576).toFixed(1)} MB）` : '没有选到图片';
      };
      input.onchange = () => pick(input.files);
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); pick(e.dataTransfer.files); });
      drop.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); input.click(); } });
    },
    keep(v, box) {
      if (v !== 'go') return true;
      if (!files.length) { toast('先选图片', 'bad'); return false; }
      if (box.busy) return false;
      box.busy = true;
      upload(box).then(n => { box.busy = false; if (n) { toast(`导入了 ${n} 张`); box.close(null); done(); } });
      return false;
    }
  });
  async function upload(box) {
    const bar = box.querySelector('.bar.up'), fill = bar.querySelector('i'), info = box.querySelector('.picked');
    bar.hidden = false;
    const btn = box.querySelector('.btn.primary');
    btn.disabled = true;
    let sent = 0, made = 0;
    const total = files.reduce((s, f) => s + f.size, 0) || 1;
    for (let i = 0; i < files.length; i += 20) {
      const part = files.slice(i, i + 20);
      const fd = new FormData();
      part.forEach(f => fd.append(f.name, f, f.name));
      try {
        const res = await xhrUpload(`/api/projects/${id}/import?commit_to_project=true`, fd, loaded => {
          fill.style.width = ((sent + loaded) / total * 100).toFixed(1) + '%';
        });
        made += (res && res.task_count) || part.length;
      } catch (e) {
        toast('上传失败：' + e.message, 'bad');
        btn.disabled = false;
        return made;
      }
      sent += part.reduce((s, f) => s + f.size, 0);
      info.textContent = `已上传 ${Math.min(i + 20, files.length)} / ${files.length} 张`;
    }
    clearCache();
    return made;
  }
}
function xhrUpload(url, fd, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (m) x.setRequestHeader('X-CSRFToken', decodeURIComponent(m[1]));
    x.upload.onprogress = e => onProgress(e.loaded);
    x.onload = () => {
      let data = null;
      try { data = JSON.parse(x.responseText); } catch (e) {}
      if (x.status >= 200 && x.status < 300) resolve(data);
      else reject(new Error((data && (data.detail || (data.validation_errors && JSON.stringify(data.validation_errors)))) || ('服务器返回 ' + x.status)));
    };
    x.onerror = () => reject(new Error('连不上服务器'));
    x.send(fd);
  });
}

const EXPORTS = [
  ['YOLO', 'YOLO', '训练 YOLO 用：每张图一个 txt + 图片。只包含拉框。'],
  ['COCO', 'COCO', 'COCO 格式的 json，拉框和多边形都在里面。'],
  ['VOC', 'Pascal VOC', '每张图一个 xml，只包含拉框。'],
  ['JSON', 'JSON', '完整的原始数据（Label Studio 通用格式），以后还能导回来。'],
  ['CSV', 'CSV', '表格，方便用 Excel 看。']
];
async function exportProject(id, p) {
  const body = `<p class="muted">选一种格式，点「下载」。图片多的话要等一会儿。</p>
    <div class="opts">${EXPORTS.map((e, i) => `<label class="opt"><input type="radio" name="fmt" value="${e[0]}" ${i ? '' : 'checked'}><b>${e[1]}</b><span>${e[2]}</span></label>`).join('')}</div>
    <label class="check"><input type="checkbox" name="all"> 没标的图片也一起导出</label>`;
  await modal({
    title: '导出「' + p.title + '」', body,
    actions: [{ label: '关闭', value: null }, { label: '下载', kind: 'primary', value: 'go' }],
    keep(v, box) {
      if (v !== 'go') return true;
      const f = box.querySelector('[name=fmt]:checked').value;
      const all = box.querySelector('[name=all]').checked;
      const a = document.createElement('a');
      a.href = `/api/projects/${id}/export?exportType=${f}&download_all_tasks=${all}`;
      a.setAttribute('download', '');
      document.body.appendChild(a); a.click(); a.remove();
      toast('开始下载了，留意浏览器的下载栏');
      return true;
    }
  });
}

// ===================================================================== 项目设置
export async function settings(page, r, { setTitle, go }) {
  const id = r.id;
  page.innerHTML = `<div class="wrap"><p class="muted">正在加载…</p></div>`;
  const wrap = page.firstElementChild;
  let p;
  try { p = await api(`/api/projects/${id}/`); } catch (e) {
    wrap.innerHTML = `<div class="empty glass"><h2>项目没加载出来</h2><p>${esc(e.message)}</p><a class="btn" href="/projects/">回到项目列表</a></div>`;
    return;
  }
  setTitle('设置 · ' + p.title);
  const cfg = parseConfig(p.label_config);
  wrap.innerHTML = `
    <nav class="crumbs"><a href="/projects/">项目</a><span>/</span><a href="/projects/${id}/">${esc(p.title)}</a><span>/</span><b>设置</b></nav>
    ${head('项目设置', 'Settings', '')}
    <section class="panel glass">
      <h2>基本信息</h2>
      <label class="field"><span>项目名</span><input type="text" name="title" maxlength="50" value="${esc(p.title)}"></label>
      <label class="field"><span>说明（可不填）</span><textarea name="desc" rows="2" maxlength="300" placeholder="比如：只标水面上的东西">${esc(p.description || '')}</textarea></label>
      <div class="go"><button type="button" class="btn primary" data-save-info>保存</button></div>
    </section>
    <section class="panel glass">
      <h2>标签</h2>
      ${cfg.ok ? '' : '<p class="tip">这个项目的标注配置不是小白标注建的，保存标签会把它换成小白标注的格式（拉框 + 多边形）。</p>'}
      <p class="hint">已经用在标注里的标签不能直接删，要删先把那些标注改掉。改名同理。</p>
      <div class="lbox">${labelsEditor(cfg.labels.length ? cfg.labels : [{ value: '', color: PALETTE[0] }])}</div>
      <div class="go"><button type="button" class="btn primary" data-save-labels>保存标签</button></div>
    </section>
    <section class="panel glass danger-zone">
      <h2>删除项目</h2>
      <p class="muted">项目里的图片和全部标注都会删掉，删了找不回来。删之前最好先导出一份。</p>
      <div class="go"><button type="button" class="btn danger" data-del>${icon('trash')}删除这个项目</button></div>
    </section>`;
  bindLabels(wrap.querySelector('.lbox'));
  wrap.querySelector('[data-save-info]').onclick = async () => {
    const title = wrap.querySelector('[name=title]').value.trim();
    if (!title) return toast('项目名不能空着', 'bad');
    try {
      await api(`/api/projects/${id}/`, { method: 'PATCH', body: { title, description: wrap.querySelector('[name=desc]').value.trim() } });
      setTitle('设置 · ' + title);
      toast('保存了');
    } catch (e) { toast(e.message, 'bad'); }
  };
  wrap.querySelector('[data-save-labels]').onclick = async () => {
    let labels;
    try { labels = readLabels(wrap.querySelector('.lbox')); } catch (e) { return toast(e.message, 'bad'); }
    try {
      await api(`/api/projects/${id}/`, { method: 'PATCH', body: { label_config: makeConfig(labels, cfg.ok ? cfg : null) } });
      toast('标签保存了');
    } catch (e) { toast('没保存上：' + e.message, 'bad'); }
  };
  wrap.querySelector('[data-del]').onclick = async () => {
    const ok = await modal({
      title: '删除「' + p.title + '」？',
      body: `<p>图片和全部标注都会删掉，删了找不回来。</p><label class="field"><span>确认的话，输入项目名</span><input type="text" name="confirm" placeholder="${esc(p.title)}"></label>`,
      actions: [{ label: '取消', value: null }, { label: '删除', kind: 'danger', value: 'del' }],
      keep(v, box) {
        if (v !== 'del') return true;
        if (box.querySelector('[name=confirm]').value.trim() !== p.title) { toast('输入的项目名对不上', 'bad'); return false; }
        return true;
      }
    });
    if (ok !== 'del') return;
    try {
      await api(`/api/projects/${id}/`, { method: 'DELETE' });
      toast('项目删掉了');
      go('/projects/');
    } catch (e) { toast(e.message, 'bad'); }
  };
}

// ===================================================================== 成员
export async function members(page, r, { setTitle }) {
  setTitle('成员');
  const anim = firstVisit('members');
  page.innerHTML = `<div class="wrap ${anim ? 'anim' : ''}">${head('成员', 'Members', '同一个团队里的人能看到同样的项目，各标各的。', `<button type="button" class="btn primary" data-invite>${icon('plus')}邀请成员</button>`)}<div class="people"><p class="muted">正在加载…</p></div></div>`;
  const wrap = page.firstElementChild;
  wrap.querySelector('[data-invite]').onclick = invite;
  const u = await me();
  await load(`/api/organizations/${u.active_organization}/memberships?page=1&page_size=500`, data => {
    const list = (data.results || []).map(m => m.user).filter(Boolean);
    wrap.querySelector('.people').innerHTML = `<div class="plist glass rise">${list.map(p => `
      <div class="prow">
        <span class="av">${esc((userName(p) || '?').slice(0, 1))}</span>
        <div class="pname"><b>${esc(userName(p))}${p.id === u.id ? '<em>我</em>' : ''}</b><span>账号：${esc(account(p))}</span></div>
        <span class="pmeta">加入于 ${esc(timeAgo(p.date_joined))}</span>
        <span class="pmeta">最近活动 ${esc(timeAgo(p.last_activity) || '—')}</span>
      </div>`).join('')}</div>
      <p class="muted small">共 ${list.length} 人</p>`;
  });
}
async function invite() {
  let data;
  try { data = await api('/api/invite'); } catch (e) { return toast(e.message, 'bad'); }
  const url = location.origin + data.invite_url;
  await modal({
    title: '邀请成员',
    body: `<p>把下面的链接发给要加入的人，他打开后起个账号名、设个密码就进来了。</p>
      <div class="copyline"><input type="text" readonly value="${esc(url)}"><button type="button" class="btn sm" data-copy>${icon('copy')}复制</button></div>
      <p class="hint">链接发错人了？点「换一个链接」，旧链接就作废。</p>`,
    actions: [{ label: '换一个链接', kind: 'ghost', value: 'reset' }, { label: '好了', kind: 'primary', value: null }],
    onOpen(box) {
      box.querySelector('[data-copy]').onclick = () => copy(box.querySelector('.copyline input'));
    },
    keep(v, box) {
      if (v !== 'reset') return true;
      api('/api/invite/reset-token', { method: 'POST' }).then(d => {
        box.querySelector('.copyline input').value = location.origin + d.invite_url;
        toast('换好了，旧链接已作废');
      }).catch(e => toast(e.message, 'bad'));
      return false;
    }
  });
}
function copy(input) {
  input.select();
  (navigator.clipboard ? navigator.clipboard.writeText(input.value) : Promise.reject()).then(
    () => toast('复制好了'),
    () => { try { document.execCommand('copy'); toast('复制好了'); } catch (e) { toast('没复制上，手动选中复制一下', 'bad'); } });
}

// ===================================================================== 我的账号
export { accountPage as account };
async function accountPage(page, r, ctx) {
  ctx.setTitle('我的账号');
  page.innerHTML = `<div class="wrap narrow"><p class="muted">正在加载…</p></div>`;
  const wrap = page.firstElementChild;
  const u = await me(true);
  wrap.innerHTML = `${head('我的账号', 'Account', '')}
    <section class="panel glass rise">
      <div class="me"><span class="av big">${esc((userName(u) || '?').slice(0, 1))}</span><div><b>${esc(userName(u))}</b><span class="muted">账号：${esc(account(u))} · 加入于 ${esc(timeAgo(u.date_joined))}</span></div></div>
      <label class="field"><span>显示名（别人看到的名字）</span><input type="text" name="name" maxlength="30" value="${esc(u.first_name || '')}" placeholder="${esc(account(u))}"></label>
      <div class="go"><button type="button" class="btn primary" data-save>保存</button></div>
    </section>
    <section class="panel glass rise d1">
      <h2>改密码</h2>
      <label class="field"><span>现在的密码</span><input type="password" name="old" autocomplete="current-password"></label>
      <label class="field"><span>新密码</span><input type="password" name="new" autocomplete="new-password"></label>
      <label class="field"><span>新密码再输一遍</span><input type="password" name="new2" autocomplete="new-password"></label>
      <div class="go"><button type="button" class="btn primary" data-pw>改密码</button></div>
    </section>
    <section class="panel glass rise d2">
      <h2>其他</h2>
      <div class="go">
        <button type="button" class="btn" data-tour>重新看一遍新手教程</button>
        <a class="btn danger" href="/logout" data-full>${icon('logout')}退出登录</a>
      </div>
    </section>`;
  wrap.querySelector('[data-save]').onclick = async () => {
    const name = wrap.querySelector('[name=name]').value.trim();
    try {
      await api(`/api/users/${u.id}/`, { method: 'PATCH', body: { first_name: name } });
      await me(true);
      toast('保存了');
      const nav = document.querySelector('#nav .who');
      if (nav) { nav.querySelector('span').textContent = name || account(u); nav.querySelector('i').textContent = (name || account(u)).slice(0, 1); }
    } catch (e) { toast(e.message, 'bad'); }
  };
  wrap.querySelector('[data-pw]').onclick = async () => {
    const v = n => wrap.querySelector(`[name=${n}]`).value;
    if (!v('old') || !v('new')) return toast('密码要填全', 'bad');
    if (v('new') !== v('new2')) return toast('两次输的新密码不一样', 'bad');
    try {
      await api('/xb/api/password', { method: 'POST', body: { old: v('old'), new: v('new') } });
      ['old', 'new', 'new2'].forEach(n => { wrap.querySelector(`[name=${n}]`).value = ''; });
      toast('密码改好了');
    } catch (e) { toast(e.status === 400 ? '现在的密码不对' : e.message, 'bad'); }
  };
  wrap.querySelector('[data-tour]').onclick = () => {
    try { localStorage.removeItem('xb-tour-done'); } catch (e) {}
    toast('下次进标注页时会再放一遍教程');
  };
}

// ===================================================================== 关于
export async function about(page, r, { setTitle }) {
  setTitle('关于');
  const anim = firstVisit('about');
  page.innerHTML = `<div class="wrap narrow ${anim ? 'anim' : ''}">
    <div class="about-head rise"><img class="mark" src="/xb/logo.svg" alt=""><h1 class="brandname">${esc(CONF.name)}</h1><p class="muted spaced">关于 · ABOUT</p></div>
    <section class="panel glass card rise d1">${spot}
      <h2>小白标注 <span class="ver">v${esc(CONF.version)}</span></h2>
      <p>给图片拉框、勾多边形、导出训练数据的网页工具。几个人各自登录，同一批图片分着标，标完直接拿去训练模型。</p>
      <p>它是<b>孟白</b>在做<b>江苏陆航</b>无人机巡检识别项目时，为了给模型准备航拍训练数据，一边用一边打磨出来的产品。</p>
      <p>开源的 Label Studio 功能很全，但对国内的小团队来说像一套毛坯房：全英文、要写 XML 配置、注册要邮箱、隔几天就被踢下线、满屏用不上的企业版入口。
        小白标注在它的地基上<b>把整套房子重新设计、重新装修</b>了一遍：界面、交互、标注器全部重写，每一处都按人实际怎么用来定。</p>
      <div class="go"><a class="btn primary" href="/">开始标注</a><a class="btn" href="https://mbclaw.top/" target="_blank" rel="noopener">孟白的主页</a></div>
    </section>
    <section class="panel glass card rise d2">${spot}
      <h2>做了什么</h2>
      <ul class="dots">
        <li><b>界面整套重做</b>：首页、项目、任务列表、成员、账号、标注器全部自己设计、从零编写，深色毛玻璃视觉和动效，切页不刷新、不闪。</li>
        <li><b>全中文</b>：按国内的叫法写，专业名词中文为主、英文小字对照，比如「多边形 <small>Polygon</small>」。</li>
        <li><b>重写标注器</b>：不用切工具，按住拖动就是拉框、单击就是画多边形；右键拖动移动框或平移图片，滚轮缩放，数字键选标签；
          画完不自动选中，接着换标签不会误改上一个框；没提交就离开会提醒；下一张提前加载，切图秒开。</li>
        <li><b>上手零门槛</b>：第一次进标注页有配示例图的动画教程，顶部常驻操作提示。</li>
        <li><b>流程顺手</b>：新建项目时直接点选标签和颜色（原版要手写 XML 配置）；图片拖进来批量导入；首页一眼看各项目进度、一键接着标；
          任务按 没标的 / 标好的 / 跳过的 筛选；YOLO、COCO、Pascal VOC 一键导出。</li>
        <li><b>去掉不合理的设计</b>：注册只要账号名和密码，不要邮箱、不限密码格式；登录后一直保持，不会隔几天被踢出去；企业版广告、用不上的入口全部拿掉。</li>
        <li><b>数据通用</b>：标注结果和 Label Studio 格式完全一致，旧数据直接能用，导出也能导回去。</li>
      </ul>
    </section>
    <section class="panel glass card rise d3">${spot}
      <h2>开源声明</h2>
      <p class="notice">
        小白标注的界面、交互设计和标注器由孟白独立设计、编写。后台的账号、数据存储和数据接口使用开源项目
        <a href="https://github.com/HumanSignal/label-studio" target="_blank" rel="noopener">Label Studio</a>，
        Label Studio (TM) Copyright (c) 2019-2021 Heartex, Inc.（现 HumanSignal），依
        <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener">Apache License 2.0</a> 授权，在此致谢。<br>
        小白标注同样以 Apache License 2.0 开源，许可证全文和 Label Studio 的原版声明随源码一起提供。
        Label Studio 是 HumanSignal 的商标；小白标注是孟白的独立作品，不是 Label Studio 的官方版本，与 HumanSignal 没有隶属或背书关系。
      </p>
    </section>
  </div>`;
}

// ===================================================================== 找不到
export async function notfound(page, r, { setTitle }) {
  setTitle('没有这一页');
  page.innerHTML = `<div class="wrap narrow"><div class="empty glass rise"><h2>没有这一页</h2><p class="muted">地址可能写错了，或者这一页已经不在了。</p><a class="btn primary" href="/">回首页</a></div></div>`;
}

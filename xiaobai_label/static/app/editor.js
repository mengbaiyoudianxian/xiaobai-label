// 小白标注的标注器：拉框 + 多边形
//   选好标签后：按住拖动 = 拉框；单击 = 逐点画多边形（回车 / 双击 / 点回第一个点闭合）
//   右键拖：在框上 = 移动它，在空白处 = 平移图片；滚轮缩放
//   结果按 Label Studio 的标注格式存（rectanglelabels / polygonlabels，坐标是百分比），导出、旧数据都通用
import { api, me, esc, fmt, icon, toast, modal, parseConfig, taskImage, clearCache } from './core.js';
import { tour, firstTour } from './tour.js';

const HINTS = [['按住拖', '拉框'], ['单击', '画多边形'], ['右键拖', '移动 / 平移'], ['滚轮', '缩放'], ['Backspace', '删除'], ['↑ ↓', '换图'], ['Ctrl+Enter', '提交']];
const uid = () => Math.random().toString(36).slice(2, 12);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export async function label(page, r, { setTitle, go }) {
  const pid = r.id;
  page.innerHTML = `
  <div class="ed">
    <header class="ed__top glass">
      <a class="icon-btn" href="/projects/${pid}/" title="回到任务列表">${icon('back')}</a>
      <a class="ed__logo" href="/" title="首页"><img src="/xb/logo.svg" alt=""></a>
      <div class="ed__title"><b class="pt">…</b><span class="tt"></span></div>
      <div class="hints">${HINTS.map(h => `<span><kbd>${h[0]}</kbd>${h[1]}</span>`).join('')}<button type="button" class="help" title="新手教程">?</button></div>
      <div class="ed__act">
        <button type="button" class="icon-btn" data-prev title="上一张（↑）">${icon('left')}</button>
        <button type="button" class="icon-btn" data-next title="下一张（↓）">${icon('right')}</button>
        <button type="button" class="btn sm" data-skip title="这张没东西可标">${icon('skip')}跳过</button>
        <button type="button" class="btn sm primary" data-submit title="Ctrl+Enter">${icon('check')}<span>提交</span></button>
      </div>
    </header>
    <aside class="ed__side glass">
      <h4>标签 <small>LABELS</small></h4>
      <div class="ed__labels"></div>
      <p class="ed__mode muted"></p>
      <h4>工具</h4>
      <div class="ed__tools">
        <button type="button" class="icon-btn" data-undo title="撤销（Ctrl+Z）">${icon('undo')}</button>
        <button type="button" class="icon-btn" data-redo title="重做（Ctrl+Shift+Z）">${icon('redo')}</button>
        <button type="button" class="icon-btn" data-fit title="适应窗口（F）">${icon('fit')}</button>
        <button type="button" class="icon-btn" data-hide title="显示 / 隐藏标注（H）">${icon('eye')}</button>
      </div>
    </aside>
    <div class="ed__stage" tabindex="-1">
      <div class="world"><img alt="" draggable="false"><svg class="ov" xmlns="http://www.w3.org/2000/svg"></svg></div>
      <div class="ed__msg"><div class="loader"><img src="/xb/logo.svg" alt=""></div></div>
      <div class="ed__zoom"><span>100%</span></div>
    </div>
    <aside class="ed__regions glass">
      <h4>区域 <small>REGIONS</small> <em class="rc">0</em></h4>
      <div class="ed__rlist"></div>
    </aside>
  </div>`;
  const $ = s => page.querySelector(s);
  const stage = $('.ed__stage'), world = $('.world'), img = $('.world img'), svg = $('.ov'), msg = $('.ed__msg');

  // ---------- 状态 ----------
  let proj = null, cfg = null, user = null, colors = {};
  let ids = null;                 // 项目里所有任务的编号（按顺序），用来上一张 / 下一张
  let task = null, ann = null, extra = [], regions = [], W = 0, H = 0;
  let sel = null, active = null, hidden = false;
  let undo = [], redo = [], dirty = false, opened = 0, busy = false, alive = true;
  let s = 1, tx = 0, ty = 0, fitted = true;       // 视图：缩放、平移
  let draw = null;                // 正在画：{kind:'rect',a,b} 或 {kind:'poly',pts,hover}
  let drag = null;                // 正在拖
  let spaceDown = false;

  // ---------- 读项目 ----------
  try {
    [proj, user] = await Promise.all([api(`/api/projects/${pid}/`), me()]);
  } catch (e) {
    msg.innerHTML = `<div class="empty glass"><h2>项目没加载出来</h2><p>${esc(e.message)}</p><a class="btn" href="/projects/">回到项目列表</a></div>`;
    return;
  }
  cfg = parseConfig(proj.label_config);
  setTitle('标注 · ' + proj.title);
  $('.pt').textContent = proj.title;
  cfg.labels.forEach(l => { colors[l.value] = l.color; });
  if (!cfg.ok) {
    msg.innerHTML = `<div class="empty glass"><h2>这个项目还不能标注</h2><p class="muted">它的标注配置里没有图片上的拉框或多边形标签。去「设置」里定好标签就行。</p><a class="btn primary" href="/projects/${pid}/settings">去设置</a></div>`;
    return;
  }
  drawLabels();
  loadIds();

  // ---------- 标签栏 ----------
  function drawLabels() {
    $('.ed__labels').innerHTML = cfg.labels.map((l, i) =>
      `<button type="button" class="elab ${active === l.value ? 'on' : ''}" data-v="${esc(l.value)}" style="--c:${esc(l.color)}"><i></i><span>${esc(l.value)}</span>${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}</button>`).join('');
    const m = $('.ed__mode');
    if (!active) m.textContent = '先选一个标签，再在图上画。';
    else m.innerHTML = [cfg.rect ? '按住拖动：拉框' : '', cfg.poly ? '单击：画多边形' : ''].filter(Boolean).join('<br>');
  }
  $('.ed__labels').addEventListener('click', e => {
    const b = e.target.closest('.elab');
    if (b) pickLabel(b.dataset.v);
  });
  function pickLabel(v) {
    active = v;
    if (sel) {
      const rg = regions.find(x => x.id === sel);
      if (rg && rg.label !== v) { remember(); rg.label = v; render(); drawList(); }
    }
    drawLabels();
  }

  // ---------- 任务列表（上一张 / 下一张） ----------
  async function loadIds() {
    const out = [];
    try {
      for (let p = 1; p < 200; p++) {
        const d = await api(`/api/tasks?project=${pid}&page=${p}&page_size=1000&fields=task_only`);
        (d.tasks || []).forEach(t => out.push(t.id));
        if (!d.tasks || out.length >= d.total || d.tasks.length < 1000) break;
      }
      ids = out;
      status();
      prefetch();
    } catch (e) { ids = null; }
  }
  const idx = () => (ids && task ? ids.indexOf(task.id) : -1);

  // ---------- 打开一张 ----------
  async function open(id, opts = {}) {
    if (busy) return;
    busy = true;
    try {
      let t;
      if (id == null) {
        try { t = await api(`/api/projects/${pid}/next/`); }
        catch (e) { if (e.status === 404) { finished(); return; } throw e; }
      } else {
        t = await api(`/api/tasks/${id}/`);
      }
      if (!alive) return;
      await show(t);
      if (!opts.keepUrl) history.replaceState(null, '', `/projects/${pid}/label?task=${t.id}`);
    } catch (e) {
      toast('这张没打开：' + e.message, 'bad');
    } finally { busy = false; }
  }

  function finished() {
    task = null; regions = []; extra = []; ann = null; dirty = false;
    img.removeAttribute('src'); render(); drawList(); status();
    history.replaceState(null, '', `/projects/${pid}/label`);
    msg.hidden = false;
    msg.innerHTML = `<div class="empty glass rise"><h2>这个项目的图片都标完了</h2><p class="muted">辛苦了。可以回任务列表检查，或者导出数据。</p>
      <div class="go"><a class="btn primary" href="/projects/${pid}/">回到任务列表</a><a class="btn" href="/">首页</a></div></div>`;
  }

  function show(t) {
    return new Promise(resolve => {
      task = t;
      const mine = a => a.completed_by && (a.completed_by.id || a.completed_by) === user.id;
      const anns = (t.annotations || []).slice().sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
      ann = anns.find(a => !a.was_cancelled && mine(a)) || anns.find(a => !a.was_cancelled) || anns.find(a => mine(a)) || null;
      let result = ann ? (ann.was_cancelled ? [] : ann.result || []) : null;
      if (!result && t.drafts && t.drafts.length) result = t.drafts[t.drafts.length - 1].result || [];
      if (!result && t.predictions && t.predictions.length) result = t.predictions[0].result || [];
      result = result || [];
      sel = null; draw = null; drag = null; undo = []; redo = []; dirty = false;
      opened = Date.now();
      const url = taskImage(t, cfg);
      msg.hidden = false;
      msg.innerHTML = '<div class="loader"><img src="/xb/logo.svg" alt=""></div>';
      const done = () => {
        W = img.naturalWidth; H = img.naturalHeight;
        svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        parse(result);
        fit();
        msg.hidden = true;
        render(); drawList(); status();
        prefetch();
        firstTour();
        resolve();
      };
      img.onload = done;
      img.onerror = () => {
        msg.hidden = false;
        msg.innerHTML = `<div class="empty glass"><h2>图片打不开</h2><p class="muted">${esc(url || '这张任务没有图片地址')}</p></div>`;
        regions = []; render(); drawList(); status();
        resolve();
      };
      if (img.getAttribute('src') === url && img.complete && img.naturalWidth) done();
      else img.src = url;
    });
  }

  // 下一张提前加载：图片先进缓存，切过去就是秒开
  const warmed = new Set();
  function prefetch() {
    const i = idx();
    if (i < 0) return;
    const nid = ids[i + 1];
    if (!nid || warmed.has(nid)) return;
    warmed.add(nid);
    api(`/api/tasks/${nid}/`).then(t => { const u = taskImage(t, cfg); if (u) new Image().src = u; }).catch(() => {});
  }

  // ---------- Label Studio 格式 ↔ 区域 ----------
  function parse(result) {
    regions = []; extra = [];
    for (const r of result) {
      const v = r.value || {};
      const ow = r.original_width || W, oh = r.original_height || H;
      if (r.type === 'rectanglelabels' && v.width != null) {
        regions.push({ id: r.id || uid(), type: 'rect', label: (v.rectanglelabels || [])[0] || '', rot: v.rotation || 0,
          x: v.x / 100 * W, y: v.y / 100 * H, w: v.width / 100 * W, h: v.height / 100 * H, from: r.from_name });
      } else if (r.type === 'polygonlabels' && v.points) {
        regions.push({ id: r.id || uid(), type: 'poly', label: (v.polygonlabels || [])[0] || '',
          pts: v.points.map(p => [p[0] / 100 * W, p[1] / 100 * H]), from: r.from_name });
      } else {
        extra.push(r);      // 不认识的（别的工具产生的结果）原样保留
      }
      void ow; void oh;
    }
  }
  function toResult() {
    const base = { to_name: cfg.image, original_width: W, original_height: H, image_rotation: 0, origin: 'manual' };
    const P = (v, d) => +(v / d * 100).toFixed(6);
    return regions.map(rg => rg.type === 'rect'
      ? { ...base, id: rg.id, type: 'rectanglelabels', from_name: cfg.rect ? cfg.rect.name : rg.from,
          value: { x: P(rg.x, W), y: P(rg.y, H), width: P(rg.w, W), height: P(rg.h, H), rotation: rg.rot || 0, rectanglelabels: [rg.label] } }
      : { ...base, id: rg.id, type: 'polygonlabels', from_name: cfg.poly ? cfg.poly.name : rg.from,
          value: { points: rg.pts.map(p => [P(p[0], W), P(p[1], H)]), closed: true, polygonlabels: [rg.label] } }
    ).concat(extra);
  }

  // ---------- 撤销 ----------
  const snap = () => JSON.stringify(regions);
  function remember() { undo.push(snap()); if (undo.length > 200) undo.shift(); redo = []; dirty = true; status(); }
  function doUndo() { if (draw) { cancelDraw(); return; } if (!undo.length) return; redo.push(snap()); regions = JSON.parse(undo.pop()); afterHistory(); }
  function doRedo() { if (!redo.length) return; undo.push(snap()); regions = JSON.parse(redo.pop()); afterHistory(); }
  function afterHistory() { if (sel && !regions.find(x => x.id === sel)) sel = null; dirty = true; render(); drawList(); status(); }

  // ---------- 视图 ----------
  function fit() {
    const r = stage.getBoundingClientRect();
    if (!W || !r.width) return;
    s = Math.min((r.width - 40) / W, (r.height - 40) / H);
    s = Math.max(s, 0.02);
    tx = (r.width - W * s) / 2; ty = (r.height - H * s) / 2;
    fitted = true;
    place();
  }
  function place() {
    world.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
    $('.ed__zoom span').textContent = Math.round(s * 100) + '%';
    render();
  }
  function zoomAt(f, cx, cy) {
    const ns = clamp(s * f, 0.02, 40);
    tx = cx - (cx - tx) * ns / s; ty = cy - (cy - ty) * ns / s; s = ns; fitted = false;
    place();
  }
  const ro = new ResizeObserver(() => { if (fitted) fit(); });
  ro.observe(stage);
  function toImg(e) {
    const r = stage.getBoundingClientRect();
    return [(e.clientX - r.left - tx) / s, (e.clientY - r.top - ty) / s];
  }
  const inImg = p => [clamp(p[0], 0, W), clamp(p[1], 0, H)];

  // ---------- 画 ----------
  function render() {
    if (!W) { svg.innerHTML = ''; return; }
    const k = 1 / s, hs = 5 * k;
    let out = '';
    if (!hidden) for (const rg of regions) {
      const c = colors[rg.label] || '#9aa0b8', on = rg.id === sel ? ' on' : '';
      if (rg.type === 'rect') {
        out += `<rect class="rg${on}" data-id="${rg.id}" x="${rg.x}" y="${rg.y}" width="${rg.w}" height="${rg.h}" style="--c:${c}"/>`;
        out += tag(rg.label, rg.x, rg.y, c, k);
      } else {
        out += `<polygon class="rg${on}" data-id="${rg.id}" points="${rg.pts.map(p => p.join(',')).join(' ')}" style="--c:${c}"/>`;
        out += tag(rg.label, rg.pts[0][0], rg.pts[0][1], c, k);
      }
    }
    const cur = !hidden && regions.find(x => x.id === sel);
    if (cur && !draw) {
      const c = colors[cur.label] || '#9aa0b8';
      const pts = cur.type === 'rect'
        ? [[cur.x, cur.y, 'nw'], [cur.x + cur.w, cur.y, 'ne'], [cur.x + cur.w, cur.y + cur.h, 'se'], [cur.x, cur.y + cur.h, 'sw'],
           [cur.x + cur.w / 2, cur.y, 'n'], [cur.x + cur.w, cur.y + cur.h / 2, 'e'], [cur.x + cur.w / 2, cur.y + cur.h, 's'], [cur.x, cur.y + cur.h / 2, 'w']]
        : cur.pts.map((p, i) => [p[0], p[1], 'v' + i]);
      for (const [x, y, h] of pts) {
        out += cur.type === 'rect'
          ? `<rect class="hd" data-h="${h}" x="${x - hs}" y="${y - hs}" width="${2 * hs}" height="${2 * hs}" rx="${hs * 0.3}" style="--c:${c}"/>`
          : `<circle class="hd" data-h="${h}" cx="${x}" cy="${y}" r="${hs}" style="--c:${c}"/>`;
      }
    }
    if (draw && draw.kind === 'rect') {
      const c = colors[active] || '#fff', b = box(draw.a, draw.b);
      out += `<rect class="rg drawing" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" style="--c:${c}"/>`;
    }
    if (draw && draw.kind === 'poly') {
      const c = colors[active] || '#fff';
      const pts = draw.pts.concat(draw.hover ? [draw.hover] : []);
      out += `<polyline class="rg drawing" points="${pts.map(p => p.join(',')).join(' ')}" style="--c:${c}"/>`;
      draw.pts.forEach((p, i) => {
        out += `<circle class="hd${i === 0 ? ' first' : ''}${i === 0 && draw.near ? ' near' : ''}" cx="${p[0]}" cy="${p[1]}" r="${(i === 0 ? 6.5 : 4.5) * k}" style="--c:${c}"/>`;
      });
    }
    svg.innerHTML = out;
    svg.style.setProperty('--k', k);
  }
  function tag(text, x, y, c, k) {
    if (!text) return '';
    const fs = 12 * k;
    return `<text class="tg" x="${x + 2 * k}" y="${Math.max(y - 4 * k, fs)}" font-size="${fs}" style="--c:${c}">${esc(text)}</text>`;
  }
  const box = (a, b) => ({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) });

  // ---------- 右边区域列表 ----------
  function drawList() {
    $('.rc').textContent = regions.length;
    $('.ed__rlist').innerHTML = regions.length ? regions.map((rg, i) => `
      <div class="rrow ${rg.id === sel ? 'on' : ''}" data-id="${rg.id}" style="--c:${esc(colors[rg.label] || '#9aa0b8')}">
        <span class="n">${i + 1}</span>${icon(rg.type === 'rect' ? 'rect' : 'poly')}
        <b>${esc(rg.label || '（没标签）')}</b><small>${rg.type === 'rect' ? '矩形框' : '多边形'}</small>
        <button type="button" class="x" title="删掉（Backspace）">×</button>
      </div>`).join('') : '<p class="muted small">还没有画东西。</p>';
  }
  $('.ed__rlist').addEventListener('click', e => {
    const row = e.target.closest('.rrow');
    if (!row) return;
    if (e.target.closest('.x')) { removeRegion(row.dataset.id); return; }
    select(row.dataset.id);
  });
  $('.ed__rlist').addEventListener('pointerover', e => {
    const row = e.target.closest('.rrow');
    svg.querySelectorAll('.rg.hover').forEach(x => x.classList.remove('hover'));
    if (row) { const el = svg.querySelector(`[data-id="${row.dataset.id}"]`); if (el) el.classList.add('hover'); }
  });
  function select(id) {
    sel = id;
    const rg = regions.find(x => x.id === id);
    if (rg) { active = rg.label; drawLabels(); }
    render(); drawList();
    const row = page.querySelector(`.rrow[data-id="${id}"]`);
    if (row) row.scrollIntoView({ block: 'nearest' });
  }
  function removeRegion(id) {
    if (!id) return;
    remember();
    regions = regions.filter(x => x.id !== id);
    if (sel === id) sel = null;
    render(); drawList();
  }

  // ---------- 顶部状态 ----------
  function status() {
    const i = idx();
    const parts = [];
    if (task) parts.push('#' + (task.inner_id || task.id));
    if (i >= 0) parts.push(`第 ${fmt(i + 1)} / ${fmt(ids.length)} 张`);
    if (ann) parts.push(ann.was_cancelled ? '跳过过' : '已标注');
    if (dirty) parts.push('<em>有改动没提交</em>');
    $('.tt').innerHTML = parts.join(' · ');
    $('[data-prev]').disabled = !(i > 0);
    $('[data-next]').disabled = !(i >= 0 && i < ids.length - 1);
    const sub = $('[data-submit]');
    sub.disabled = !task;
    $('[data-skip]').disabled = !task;
    sub.querySelector('span').textContent = ann && !ann.was_cancelled ? '更新' : '提交';
  }

  // ---------- 鼠标 ----------
  stage.addEventListener('contextmenu', e => e.preventDefault());
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    zoomAt(Math.pow(1.0015, -e.deltaY * (e.deltaMode === 1 ? 30 : 1)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  let warned = false;
  function needLabel() {
    if (active) return true;
    if (!warned) { toast('先在左边选一个标签（或按数字键 1、2、3…）'); warned = true; }
    $('.ed__labels').classList.remove('nudge'); void $('.ed__labels').offsetWidth; $('.ed__labels').classList.add('nudge');
    return false;
  }

  stage.addEventListener('pointerdown', e => {
    if (!W || !task || document.querySelector('.modal, .tour')) return;
    stage.focus({ preventScroll: true });
    const p = toImg(e);
    const start = { x: e.clientX, y: e.clientY, tx, ty, p };
    const hit = e.shiftKey ? null : e.target.closest('[data-id]');
    const handle = e.target.closest('[data-h]');
    if (e.button === 1 || (e.button === 0 && spaceDown)) { drag = { mode: 'pan', start }; }
    else if (e.button === 2) {
      if (draw) { drag = { mode: 'pan', start }; }
      else if (hit) { select(hit.dataset.id); drag = { mode: 'move', start, id: hit.dataset.id, before: snap(), orig: JSON.stringify(regions.find(x => x.id === hit.dataset.id)) }; }
      else drag = { mode: 'pan', start };
    } else if (e.button === 0) {
      if (draw && draw.kind === 'poly') drag = { mode: 'polyclick', start };
      else if (handle && sel) drag = { mode: 'handle', start, h: handle.dataset.h, id: sel, before: snap(), orig: JSON.stringify(regions.find(x => x.id === sel)) };
      else drag = { mode: 'maybe', start, hit: hit && hit.dataset.id };
    } else return;
    stage.setPointerCapture(e.pointerId);
    stage.classList.toggle('panning', drag.mode === 'pan');
  });

  stage.addEventListener('pointermove', e => {
    if (!W) return;
    const p = toImg(e);
    if (!drag) {
      if (draw && draw.kind === 'poly') {
        draw.hover = inImg(p);
        const f = draw.pts[0];
        draw.near = draw.pts.length >= 3 && Math.hypot((f[0] - p[0]) * s, (f[1] - p[1]) * s) < 10;
        render();
      }
      return;
    }
    const dx = e.clientX - drag.start.x, dy = e.clientY - drag.start.y, moved = Math.hypot(dx, dy) > 4;
    if (drag.mode === 'pan') { tx = drag.start.tx + dx; ty = drag.start.ty + dy; fitted = false; place(); return; }
    if (drag.mode === 'maybe' && moved) {
      if (cfg.rect && needLabel()) { drag.mode = 'rect'; draw = { kind: 'rect', a: inImg(drag.start.p), b: inImg(p) }; sel = null; drawList(); }
      else if (!cfg.rect) { drag.mode = 'pan'; }
      else drag.mode = 'dead';
    }
    if (drag.mode === 'rect') { draw.b = inImg(p); render(); return; }
    if (drag.mode === 'move' && moved) {
      const rg = regions.find(x => x.id === drag.id), o = JSON.parse(drag.orig);
      let mx = p[0] - drag.start.p[0], my = p[1] - drag.start.p[1];
      if (rg.type === 'rect') {
        rg.x = clamp(o.x + mx, 0, W - o.w); rg.y = clamp(o.y + my, 0, H - o.h);
      } else {
        const xs = o.pts.map(q => q[0]), ys = o.pts.map(q => q[1]);
        mx = clamp(mx, -Math.min(...xs), W - Math.max(...xs)); my = clamp(my, -Math.min(...ys), H - Math.max(...ys));
        rg.pts = o.pts.map(q => [q[0] + mx, q[1] + my]);
      }
      drag.changed = true;
      render();
      return;
    }
    if (drag.mode === 'handle') {
      const rg = regions.find(x => x.id === drag.id), o = JSON.parse(drag.orig), q = inImg(p);
      if (rg.type === 'rect') {
        let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
        if (drag.h.includes('w')) x1 = q[0];
        if (drag.h.includes('e')) x2 = q[0];
        if (drag.h.includes('n')) y1 = q[1];
        if (drag.h.includes('s')) y2 = q[1];
        const b = box([x1, y1], [x2, y2]);
        Object.assign(rg, b);
      } else {
        rg.pts[+drag.h.slice(1)] = q;
      }
      drag.changed = true;
      render();
    }
  });

  stage.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null;
    stage.classList.remove('panning');
    const p = toImg(e), moved = Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) > 4;
    if ((d.mode === 'move' || d.mode === 'handle') && d.changed) {
      undo.push(d.before); redo = []; dirty = true; status();
      const rg = regions.find(x => x.id === d.id);
      if (rg && rg.type === 'rect' && (rg.w < 2 || rg.h < 2)) { regions = regions.filter(x => x !== rg); sel = null; drawList(); }
      render();
      return;
    }
    if (d.mode === 'rect') {
      const b = box(draw.a, draw.b);
      draw = null;
      if (b.w * s >= 4 && b.h * s >= 4) {
        remember();
        // 画完不选中：接着按数字键换标签是给下一个框用的，不会把刚画的改掉
        regions.push({ id: uid(), type: 'rect', label: active, ...b });
        sel = null;
      }
      render(); drawList();
      return;
    }
    if (d.mode === 'polyclick') {
      if (moved) return;
      const q = inImg(p), f = draw.pts[0];
      if (draw.pts.length >= 3 && Math.hypot((f[0] - q[0]) * s, (f[1] - q[1]) * s) < 10) { closePoly(); return; }
      const last = draw.pts[draw.pts.length - 1];
      if (!last || Math.hypot((last[0] - q[0]) * s, (last[1] - q[1]) * s) > 2) draw.pts.push(q);
      render();
      return;
    }
    if (d.mode === 'maybe' && !moved) {
      if (d.hit) { select(d.hit); return; }
      if (cfg.poly && active) {
        draw = { kind: 'poly', pts: [inImg(p)], hover: null };
        sel = null; render(); drawList();
        return;
      }
      if (!active && cfg.poly && !sel) needLabel();
      sel = null; render(); drawList();
    }
  });
  stage.addEventListener('dblclick', e => { if (draw && draw.kind === 'poly') { e.preventDefault(); closePoly(); } });

  function closePoly() {
    if (!draw || draw.kind !== 'poly') return;
    const pts = [];
    for (const q of draw.pts) {
      const l = pts[pts.length - 1];
      if (!l || Math.hypot((l[0] - q[0]) * s, (l[1] - q[1]) * s) > 3) pts.push(q);
    }
    draw = null;
    if (pts.length < 3) { toast('多边形至少要 3 个点'); render(); return; }
    remember();
    regions.push({ id: uid(), type: 'poly', label: active, pts });
    sel = null;
    render(); drawList();
  }
  function cancelDraw() { draw = null; render(); }

  // ---------- 键盘 ----------
  function onKey(e) {
    if (!alive || document.querySelector('.modal, .tour')) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key;
    if (k === ' ') { spaceDown = true; stage.classList.add('grab'); e.preventDefault(); return; }
    if (ctrl && k === 'Enter') { e.preventDefault(); submit(); return; }
    if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
    if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); doRedo(); return; }
    if (ctrl) return;
    if (/^[1-9]$/.test(k)) { const l = cfg.labels[+k - 1]; if (l) { e.preventDefault(); pickLabel(l.value); } return; }
    if (k === 'Enter' && draw && draw.kind === 'poly') { e.preventDefault(); closePoly(); return; }
    if (k === 'Escape') { if (draw) cancelDraw(); else if (sel) { sel = null; render(); drawList(); } return; }
    if (k === 'Backspace' || k === 'Delete') {
      e.preventDefault();
      if (draw && draw.kind === 'poly') { draw.pts.pop(); if (!draw.pts.length) draw = null; render(); }
      else if (sel) removeRegion(sel);
      return;
    }
    if (k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); step(-1); return; }
    if (k === 'ArrowDown' || k === 'PageDown') { e.preventDefault(); step(1); return; }
    if (k === 'f' || k === 'F' || k === '0') { fit(); return; }
    if (k === 'h' || k === 'H') { toggleHide(); return; }
    if (k === '+' || k === '=') { const r = stage.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); return; }
    if (k === '-') { const r = stage.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); }
  }
  function onKeyUp(e) { if (e.key === ' ') { spaceDown = false; stage.classList.remove('grab'); } }
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKeyUp);
  function toggleHide() { hidden = !hidden; $('[data-hide]').classList.toggle('on', hidden); render(); }

  // ---------- 按钮 ----------
  $('[data-undo]').onclick = doUndo;
  $('[data-redo]').onclick = doRedo;
  $('[data-fit]').onclick = fit;
  $('[data-hide]').onclick = toggleHide;
  $('[data-prev]').onclick = () => step(-1);
  $('[data-next]').onclick = () => step(1);
  $('[data-submit]').onclick = () => submit();
  $('[data-skip]').onclick = () => skip();
  $('.ed__zoom').onclick = fit;
  $('.help').onclick = () => tour(0);

  // ---------- 换图、提交、跳过 ----------
  async function guard() {
    if (!dirty) return true;
    const v = await modal({
      title: '这张还没提交', body: '<p>刚画的东西还没提交，离开就没了。</p>',
      actions: [{ label: '不要了', kind: 'ghost', value: 'drop' }, { label: '取消', value: null }, { label: '提交再走', kind: 'primary', value: 'save' }]
    });
    if (v === 'drop') { dirty = false; return true; }
    if (v === 'save') return save();
    return false;
  }
  async function step(d) {
    const i = idx();
    if (i < 0 || busy) return;
    const nid = ids[i + d];
    if (!nid) { toast(d > 0 ? '已经是最后一张了' : '已经是第一张了'); return; }
    if (!await guard()) return;
    open(nid);
  }
  async function save() {
    if (!task || busy) return false;
    if (draw && draw.kind === 'poly' && draw.pts.length >= 3) closePoly();
    busy = true;
    const body = { result: toResult(), was_cancelled: false, lead_time: (Date.now() - opened) / 1000 };
    try {
      if (ann && ann.id) ann = await api(`/api/annotations/${ann.id}/`, { method: 'PATCH', body });
      else ann = await api(`/api/tasks/${task.id}/annotations/?project=${pid}`, { method: 'POST', body: { ...body, project: pid } });
      dirty = false; undo = []; redo = [];
      status();
      return true;
    } catch (e) {
      toast('没提交上：' + e.message, 'bad');
      return false;
    } finally { busy = false; }
  }
  async function submit() {
    if (!task || busy) return;
    const update = ann && !ann.was_cancelled;
    if (!regions.length && !update) {
      const ok = await modal({ title: '一个框都没有', body: '<p>这张图上什么都没画。确定按「没有目标」提交吗？（没东西可标也可以点「跳过」）</p>',
        actions: [{ label: '取消', value: false }, { label: '提交', kind: 'primary', value: true }] });
      if (!ok) return;
    }
    if (!await save()) return;
    if (update) { toast('已更新'); return; }
    toast('已提交');
    open(null);
  }
  async function skip() {
    if (!task || busy) return;
    if (regions.length) {
      const ok = await modal({ title: '跳过这张？', body: `<p>这张上画了 ${regions.length} 个区域，跳过会把它们丢掉。</p>`,
        actions: [{ label: '取消', value: false }, { label: '跳过', kind: 'danger', value: true }] });
      if (!ok) return;
    }
    busy = true;
    const body = { result: [], was_cancelled: true, lead_time: (Date.now() - opened) / 1000 };
    try {
      if (ann && ann.id) await api(`/api/annotations/${ann.id}/`, { method: 'PATCH', body });
      else await api(`/api/tasks/${task.id}/annotations/?project=${pid}`, { method: 'POST', body: { ...body, project: pid } });
      dirty = false;
      toast('已跳过这张');
    } catch (e) { toast('没跳过去：' + e.message, 'bad'); busy = false; return; }
    busy = false;
    open(null);
  }

  function onBeforeUnload(e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } }
  addEventListener('beforeunload', onBeforeUnload);

  // ---------- 开始 ----------
  const want = new URLSearchParams(location.search).get('task');
  await open(want ? +want : null, { keepUrl: false });

  return {
    cleanup() {
      alive = false;
      removeEventListener('keydown', onKey);
      removeEventListener('keyup', onKeyUp);
      removeEventListener('beforeunload', onBeforeUnload);
      ro.disconnect();
      clearCache();
      const t = document.querySelector('.tour'); if (t) t.remove();
    },
    beforeLeave: () => guard()
  };
}

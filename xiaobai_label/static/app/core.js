// 小白标注前端：公用的小工具（接口、缓存、提示、弹窗、图标）
export const CONF = (() => {
  try { return JSON.parse(document.querySelector('meta[name="xb-config"]').content); } catch (e) { return { name: '小白标注', version: '', demo: false }; }
})();

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const fmt = n => (n || 0).toLocaleString('zh-CN');
export const pct = (a, b) => (b ? Math.floor(a * 1000 / b) / 10 : 0);

export function html(strings, ...vals) {
  return strings.reduce((s, str, i) => s + str + (i < vals.length ? vals[i] : ''), '');
}

// ---------- 接口 ----------
function csrf() {
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}
export class ApiError extends Error {
  constructor(status, data) {
    super(apiMessage(status, data));
    this.status = status;
    this.data = data;
  }
}
function apiMessage(status, data) {
  if (status === 0) return '连不上服务器，检查一下网络';
  if (status === 401 || status === 403) return '没有权限，或者登录已过期';
  if (status === 404) return '没找到';
  if (data && typeof data === 'object') {
    const d = data.validation_errors || data.detail || data;
    if (typeof d === 'string') return d;
    const first = Object.values(d).flat()[0];
    if (first) return String(first);
  }
  return '出错了（' + status + '）';
}

const cache = new Map();          // 地址 → 数据：切回来先显示上次的，再悄悄更新
export function clearCache() { cache.clear(); }

export async function api(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const headers = { Accept: 'application/json' };
  let body = opts.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  if (method !== 'GET') headers['X-CSRFToken'] = csrf();
  let r;
  try {
    r = await fetch(url, { method, headers, body, credentials: 'same-origin' });
  } catch (e) {
    throw new ApiError(0, null);
  }
  if (method !== 'GET') clearCache();
  const notLogged = r.status === 401 || (r.status === 403 && /credentials were not provided|未提供/.test(await r.clone().text()));
  if (notLogged || (r.redirected && /\/user\/login/.test(r.url))) {
    location.assign('/user/login/?next=' + encodeURIComponent(location.pathname + location.search));
    throw new ApiError(401, null);
  }
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!r.ok) throw new ApiError(r.status, data);
  if (method === 'GET') cache.set(url, text);
  return data;
}

// 先用缓存马上画一次（有的话），拿到新数据如果不一样再画一次
export function load(url, draw, fail) {
  const hit = cache.get(url);
  if (hit != null) { try { draw(JSON.parse(hit), true); } catch (e) { console.error(e); } }
  return api(url).then(data => {
    if (hit != null && cache.get(url) === hit) return;
    draw(data, false);
  }).catch(e => { if (fail) fail(e); else if (hit == null) toast(e.message, 'bad'); });
}

let mePromise = null;
export function me(refresh) {
  if (!mePromise || refresh) mePromise = api('/api/current-user/whoami');
  return mePromise;
}
export function userName(u) {
  if (!u) return '';
  return u.first_name || u.username || (u.email || '').split('@')[0];
}
export function account(u) {
  if (!u) return '';
  if (u.username && !u.username.includes('@')) return u.username;
  return (u.email || '').split('@')[0];
}

// ---------- 提示条 ----------
let toastBox = null;
export function toast(msg, kind) {
  if (!toastBox) {
    toastBox = document.createElement('div');
    toastBox.className = 'toasts';
    document.body.appendChild(toastBox);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || '');
  t.textContent = msg;
  toastBox.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, kind === 'bad' ? 4200 : 2400);
}

// ---------- 弹窗 ----------
// modal({title, body(html), actions:[{label, kind, value}], onOpen(box)}) → Promise<value>
export function modal({ title, body = '', actions = [{ label: '好', kind: 'primary', value: true }], wide, onOpen, keep }) {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'modal';
    box.innerHTML = html`<div class="modal__card glass ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal__head"><h3>${esc(title)}</h3><button type="button" class="x" aria-label="关闭">×</button></div>
      <div class="modal__body">${body}</div>
      <div class="modal__foot">${actions.map((a, i) => `<button type="button" class="btn ${a.kind || ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
    </div>`;
    document.body.appendChild(box);
    const prevFocus = document.activeElement;
    function close(v) {
      if (keep && v !== undefined && v !== null && keep(v, box) === false) return;
      document.removeEventListener('keydown', onKey, true);
      box.classList.add('out');
      setTimeout(() => box.remove(), 180);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(v);
    }
    box.close = close;
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); return; }
      // 标签编辑器里回车是"再加一行"，不算确认
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.isComposing && !e.target.closest('.labels-ed')) {
        const p = actions.findIndex(a => a.kind && a.kind.includes('primary'));
        if (p >= 0) { e.preventDefault(); e.stopPropagation(); close(actions[p].value); }
      }
      // 其他按键照常传下去；标注器自己会在有弹窗时不响应快捷键
    }
    document.addEventListener('keydown', onKey, true);
    box.addEventListener('click', e => {
      if (e.target === box || e.target.closest('.x')) close(null);
      const b = e.target.closest('[data-i]');
      if (b) close(actions[+b.dataset.i].value);
    });
    if (onOpen) onOpen(box);
    const f = box.querySelector('input,textarea,select') || box.querySelector('.btn.primary');
    if (f) setTimeout(() => f.focus(), 30);
  });
}
export function confirm(title, text, ok = '确定', danger) {
  return modal({ title, body: `<p>${esc(text)}</p>`, actions: [{ label: '取消', value: false }, { label: ok, kind: danger ? 'danger' : 'primary', value: true }] });
}

// ---------- 图标 ----------
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  projects: '<path d="M3 6h7l2 2h9v11H3z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v4h16v-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  poly: '<path d="M5 8l6-4 8 5-2 10-10 1z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  skip: '<path d="M5 5l8 7-8 7zM16 5v14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'
};
export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// ---------- 标注配置（Label Studio 的 XML）：读、写 ----------
export const PALETTE = ['#4b7bff', '#ff4fd8', '#b44dff', '#25c2a0', '#ffb020', '#ff6b5e', '#38bdf8', '#a3e635', '#f472b6', '#facc15'];

export function parseConfig(xml) {
  const out = { image: null, imageKey: 'image', rect: null, poly: null, labels: [], ok: false };
  if (!xml) return out;
  let doc;
  try { doc = new DOMParser().parseFromString(xml, 'text/xml'); } catch (e) { return out; }
  if (doc.querySelector('parsererror')) return out;
  const img = doc.getElementsByTagName('Image')[0];
  if (img) {
    out.image = img.getAttribute('name');
    out.imageKey = (img.getAttribute('value') || '$image').replace(/^\$/, '');
  }
  const seen = new Map();
  for (const tag of ['RectangleLabels', 'PolygonLabels']) {
    const el = doc.getElementsByTagName(tag)[0];
    if (!el) continue;
    const info = { name: el.getAttribute('name'), toName: el.getAttribute('toName') || out.image };
    if (tag === 'RectangleLabels') out.rect = info; else out.poly = info;
    for (const l of el.getElementsByTagName('Label')) {
      const v = l.getAttribute('value');
      if (v == null || seen.has(v)) continue;
      const color = l.getAttribute('background') || PALETTE[seen.size % PALETTE.length];
      seen.set(v, color);
    }
  }
  out.labels = [...seen].map(([value, color]) => ({ value, color }));
  out.ok = !!(out.image && (out.rect || out.poly));
  return out;
}

const xmlEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 拉框和多边形各一套同样的标签：拖动画框、单击画多边形，导出时各归各的。
// 改已有项目时沿用它原来的名字（name），旧标注才对得上。
export function makeConfig(labels, old) {
  const img = (old && old.image) || 'image';
  const key = (old && old.imageKey) || 'image';
  const rect = (old && old.rect && old.rect.name) || 'label';
  const poly = (old && old.poly && old.poly.name) || 'area';
  const ls = labels.map(l => `<Label value="${xmlEsc(l.value)}" background="${xmlEsc(l.color)}"/>`).join('');
  return `<View><Image name="${xmlEsc(img)}" value="$${xmlEsc(key)}" zoom="true"/>` +
    `<RectangleLabels name="${xmlEsc(rect)}" toName="${xmlEsc(img)}">${ls}</RectangleLabels>` +
    `<View style="display:none"><PolygonLabels name="${xmlEsc(poly)}" toName="${xmlEsc(img)}">${ls}</PolygonLabels></View></View>`;
}

// 一张任务的图片地址
export function taskImage(task, cfg) {
  const d = (task && task.data) || {};
  return d[(cfg && cfg.imageKey) || 'image'] || d.image || Object.values(d).find(v => typeof v === 'string' && /\.(jpe?g|png|webp|bmp|gif|tiff?)(\?|$)|^\/data\//i.test(v)) || '';
}

export function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return '刚刚';
  if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
  if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
  const d = new Date(t);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

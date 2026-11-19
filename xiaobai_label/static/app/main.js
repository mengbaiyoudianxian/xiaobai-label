// 小白标注前端入口：顶栏、换页、背景动效
import { CONF, esc, icon, me, userName, reduceMotion, toast } from './core.js';
import * as pages from './pages.js';

const view = document.getElementById('view');
const nav = document.getElementById('nav');

// ---------- 顶栏 ----------
const MENU = [
  ['/', '首页', 'home', p => p === '/'],
  ['/projects/', '项目', 'projects', p => p.startsWith('/projects')],
  ['/organization/', '成员', 'people', p => p.startsWith('/organization') || p.startsWith('/people')],
  ['/user/account/', '我的账号', 'account', p => p.startsWith('/user/account')],
  ['/about/', '关于', 'about', p => p.startsWith('/about')]
];
nav.innerHTML =
  `<a class="brand" href="/"><img src="/xb/logo.svg" alt=""><span>${esc(CONF.name)}</span></a>` +
  `<nav class="links">${MENU.map(m => `<a class="l" href="${m[0]}">${icon(m[2])}<span>${m[1]}</span></a>`).join('')}</nav>` +
  (CONF.anon ? `<a class="btn sm primary" href="/user/login/">登录</a>` : `<a class="who" href="/user/account/" title="我的账号"><i></i><span></span></a>`);
// 没登录只能看「关于」
if (CONF.anon && !/^\/about\/?$/.test(location.pathname)) location.replace('/user/login/');
if (!CONF.anon) me().then(u => {
  const n = userName(u);
  nav.querySelector('.who i').textContent = (n || '?').slice(0, 1);
  nav.querySelector('.who span').textContent = n;
}).catch(() => {});
function markNav() {
  const p = location.pathname;
  nav.querySelectorAll('.links a').forEach((a, i) => a.classList.toggle('on', MENU[i][3](p)));
}

// ---------- 路由 ----------
const ROUTES = [
  [/^\/$/, 'home'],
  [/^\/projects\/?$/, 'projects'],
  [/^\/projects\/(\d+)\/label\/?$/, 'label'],
  [/^\/projects\/(\d+)\/settings(?:\/.*)?$/, 'settings'],
  [/^\/projects\/(\d+)(?:\/data)?\/?$/, 'project'],
  [/^\/(?:organization|people)(?:\/.*)?$/, 'members'],
  [/^\/user\/account(?:\/.*)?$/, 'account'],
  [/^\/about\/?$/, 'about']
];
function match(path, search) {
  // Label Studio 时代的旧链接：/projects/1/data?labeling=1、?task=5 → 我们的标注页
  const q = new URLSearchParams(search);
  const old = path.match(/^\/projects\/(\d+)(?:\/data)?\/?$/);
  if (old && (q.get('labeling') || q.get('task'))) {
    const url = `/projects/${old[1]}/label` + (q.get('task') ? '?task=' + q.get('task') : '');
    history.replaceState(null, '', url);
    return { name: 'label', id: +old[1] };
  }
  for (const [re, name] of ROUTES) {
    const m = path.match(re);
    if (m) return { name, id: m[1] ? +m[1] : null };
  }
  return { name: 'notfound' };
}

let current = null;     // { cleanup, beforeLeave }
let seq = 0;
let shownUrl = location.pathname + location.search;

async function render() {
  const my = ++seq;
  shownUrl = location.pathname + location.search;
  const r = match(location.pathname, location.search);
  if (current && current.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
  current = null;
  markNav();
  const work = r.name === 'label';
  document.body.classList.toggle('work', work);
  const page = document.createElement('section');
  page.className = 'page' + (work ? ' page--work' : '');
  view.replaceChildren(page);
  window.scrollTo(0, 0);
  try {
    const fn = r.name === 'label' ? (await import('./editor.js')).label : pages[r.name];
    if (my !== seq) return;
    const res = await fn(page, r, { go, setTitle });
    if (my !== seq) { if (res && res.cleanup) res.cleanup(); return; }
    current = res || null;
  } catch (e) {
    console.error(e);
    page.innerHTML = `<div class="wrap"><div class="empty glass"><h2>这一页出错了</h2><p>${esc(e.message || e)}</p><a class="btn" href="/">回首页</a></div></div>`;
  }
}
function setTitle(t) { document.title = (t ? t + ' · ' : '') + CONF.name; }

export async function go(url, opts = {}) {
  const u = new URL(url, location.href);
  const same = u.pathname === location.pathname && u.search === location.search;
  if (same && !opts.force) return;
  if (current && current.beforeLeave && !opts.skipGuard) {
    const ok = await current.beforeLeave(u);
    if (!ok) return;
  }
  history[opts.replace ? 'replaceState' : 'pushState'](null, '', u.pathname + u.search + u.hash);
  render();
}

addEventListener('popstate', async () => {
  if (current && current.beforeLeave) {
    const target = new URL(location.href);
    const back = shownUrl;
    const ok = await current.beforeLeave(target);
    if (!ok) { history.pushState(null, '', back); return; }
  }
  render();
});

// 站内链接都在应用里切换；登录、退出、文件下载这类走浏览器
const FULL = /^\/(api|data|xb|user\/(login|signup)|logout|admin|storage-data|static)(\/|$|\?)/;
document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download') || a.dataset.full !== undefined) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || FULL.test(u.pathname)) return;
  if (u.pathname === location.pathname && u.search === location.search && u.hash) return;
  e.preventDefault();
  go(u.href);
});

// ---------- 背景动效：鼠标光、视差、卡片倾斜和光斑 ----------
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
if (fine && !reduceMotion) {
  const glow = document.querySelector('.glow');
  const root = document.documentElement;
  let tx = innerWidth / 2, ty = innerHeight / 3, gx = tx, gy = ty, running = false;
  const loop = () => {
    gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
    glow.style.transform = `translate3d(${gx.toFixed(1)}px,${gy.toFixed(1)}px,0)`;
    if (Math.abs(tx - gx) > 0.3 || Math.abs(ty - gy) > 0.3) requestAnimationFrame(loop); else running = false;
  };
  addEventListener('pointermove', e => {
    if (document.body.classList.contains('work')) return;
    tx = e.clientX; ty = e.clientY;
    glow.classList.add('on');
    if (!running) { running = true; requestAnimationFrame(loop); }
    root.style.setProperty('--px', ((e.clientX / innerWidth - 0.5) * -28).toFixed(1) + 'px');
    root.style.setProperty('--py', ((e.clientY / innerHeight - 0.5) * -28).toFixed(1) + 'px');
    const c = e.target.closest && e.target.closest('.card.tilt');
    if (c) {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--mx', (x * 100) + '%'); c.style.setProperty('--my', (y * 100) + '%');
      c.style.setProperty('--ry', ((x - 0.5) * 7).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
    }
  }, { passive: true });
  document.addEventListener('pointerout', e => {
    const c = e.target.closest && e.target.closest('.card.tilt');
    if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }
  });
  root.addEventListener('pointerleave', () => glow.classList.remove('on'));
}

// 以前的 Label Studio 页面可能在浏览器里注册过后台脚本（Service Worker），清掉
if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
}

addEventListener('unhandledrejection', e => {
  if (e.reason && e.reason.name === 'ApiError' && e.reason.status === 401) return;
});

render();
window.XB = { go, toast };

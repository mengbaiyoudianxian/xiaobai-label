// 新手教程：6 步，配一张自己画的示例图（河、船、岸上的人、一辆车），动画演示怎么操作
const SCENE =
  '<defs><linearGradient id="xbw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a5d86"/><stop offset="1" stop-color="#173a57"/></linearGradient>' +
  '<linearGradient id="xbl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f6f3f"/><stop offset="1" stop-color="#34502c"/></linearGradient></defs>' +
  '<rect width="480" height="270" fill="url(#xbw)"/>' +
  '<path d="M0 0H480V44C380 60 300 40 200 52S60 70 0 58Z" fill="url(#xbl)"/>' +
  '<path d="M0 270V190C60 176 120 196 170 214S260 250 300 270Z" fill="url(#xbl)"/>' +
  '<g opacity=".25" stroke="#cfe8ff" stroke-width="2" fill="none"><path d="M40 110q20-6 40 0t40 0"/><path d="M300 200q20-6 40 0t40 0"/><path d="M330 90q20-6 40 0t40 0"/></g>' +
  '<g transform="translate(180 120)"><path d="M0 22h150l-18 26H18Z" fill="#e8edf2"/><rect x="30" y="0" width="56" height="22" rx="3" fill="#cfd8e2"/>' +
  '<rect x="38" y="6" width="12" height="9" fill="#5b7894"/><rect x="58" y="6" width="12" height="9" fill="#5b7894"/><rect x="100" y="12" width="30" height="10" fill="#c45a3c"/></g>' +
  '<g transform="translate(78 168)"><circle cx="0" cy="0" r="7" fill="#f2c9a0"/><rect x="-7" y="8" width="14" height="22" rx="4" fill="#f08a24"/><rect x="-6" y="30" width="5" height="16" fill="#334"/><rect x="1" y="30" width="5" height="16" fill="#334"/></g>' +
  '<g transform="translate(372 14)"><rect x="0" y="6" width="58" height="18" rx="5" fill="#d84a4a"/><rect x="10" y="0" width="34" height="12" rx="4" fill="#e66"/><circle cx="12" cy="25" r="5" fill="#222"/><circle cx="46" cy="25" r="5" fill="#222"/></g>';
const CURSOR = '<path d="M0 0l0 16 4.5-4 3 7 2.6-1.2-3-6.8H13Z" fill="#fff" stroke="#111" stroke-width="1"/>';

function polySvg() {
  const pts = [[24, 196], [70, 186], [120, 200], [168, 218], [196, 246], [160, 262], [60, 262]];
  const dur = 4, n = pts.length, line = pts.map(p => p.join(',')).join(' ');
  let s = `<polygon points="${line}" fill="#ff4fd833"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;.8;.85;1" dur="${dur}s" repeatCount="indefinite"/></polygon>`;
  s += `<polyline points="${line} ${pts[0].join(',')}" fill="none" stroke="#ff4fd8" stroke-width="3" stroke-dasharray="1000" stroke-dashoffset="1000">` +
    `<animate attributeName="stroke-dashoffset" values="1000;0;0" keyTimes="0;.8;1" dur="${dur}s" repeatCount="indefinite"/></polyline>`;
  pts.forEach((p, i) => {
    const k = (i / n * 0.8).toFixed(3);
    s += `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#fff" stroke="#ff4fd8" stroke-width="2" opacity="0">` +
      `<animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${k};${Math.min(+k + 0.01, 0.99).toFixed(3)};1" dur="${dur}s" repeatCount="indefinite"/></circle>`;
  });
  return s;
}

const STEPS = [
  { t: '1. 先选标签', d: '在左边的标签栏点一个标签（或按它后面的数字键 1、2、3…），选中的标签会亮起来。拉框、画多边形都要先选标签。', bar: true, svg: '' },
  { t: '2. 按住拖动 = 拉框', d: '在图片上按住左键拖一下，松开就画好一个矩形框。',
    svg: '<rect x="172" y="112" width="0" height="0" fill="#4b7bff33" stroke="#4b7bff" stroke-width="3" rx="2">' +
      '<animate attributeName="width" values="0;166;166" keyTimes="0;.6;1" dur="2.4s" repeatCount="indefinite"/>' +
      '<animate attributeName="height" values="0;60;60" keyTimes="0;.6;1" dur="2.4s" repeatCount="indefinite"/></rect>' +
      '<g><animateTransform attributeName="transform" type="translate" values="172 112;338 172;338 172" keyTimes="0;.6;1" dur="2.4s" repeatCount="indefinite"/>' + CURSOR + '</g>' },
  { t: '3. 单击 = 画多边形', d: '一下一下单击，每点一下加一个点；按回车、双击，或点回第一个点，多边形就闭合了。点错了按 Backspace 撤掉上一个点，Esc 整个不要。适合岸线、不规则区域。',
    svg: polySvg() },
  { t: '4. 选中、调整、移动', d: '点一下选中；拖小方块调大小，多边形拖顶点改形状；在框上按住右键拖动是移动它，在空白处右键拖是平移图片；滚轮缩放，F 键回到整张图。想在已有的框里面开始画，按住 Shift。',
    svg: '<g><animateTransform attributeName="transform" type="translate" values="0 0;40 26;40 26;0 0" keyTimes="0;.45;.7;1" dur="3s" repeatCount="indefinite"/>' +
      '<rect x="172" y="112" width="166" height="60" fill="#4b7bff33" stroke="#4b7bff" stroke-width="3" rx="2"/>' +
      '<g fill="#fff" stroke="#4b7bff" stroke-width="2"><rect x="167" y="107" width="10" height="10" rx="3"/><rect x="333" y="107" width="10" height="10" rx="3"/><rect x="167" y="167" width="10" height="10" rx="3"/><rect x="333" y="167" width="10" height="10" rx="3"/></g>' +
      '<g transform="translate(255 140)">' + CURSOR + '</g></g>' +
      '<g transform="translate(300 214)"><rect width="150" height="30" rx="15" fill="#0b0c18cc"/><text x="75" y="20" text-anchor="middle" fill="#fff" font-size="14">右键按住拖 = 移动</text></g>' },
  { t: '5. 删除、撤销', d: '选中要删的框或多边形，按 Backspace（退格键）或 Delete 就删掉了；也可以点右边「区域」列表里的 ×。按 Ctrl+Z 撤销，Ctrl+Shift+Z 重做。',
    svg: '<rect x="172" y="112" width="166" height="60" fill="#4b7bff33" stroke="#4b7bff" stroke-width="3" rx="2">' +
      '<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;.4;.5;.85;1" dur="3s" repeatCount="indefinite"/></rect>' +
      '<g transform="translate(190 210)"><rect width="100" height="34" rx="8" fill="#0b0c18cc" stroke="#ffffff55"/><text x="50" y="23" text-anchor="middle" fill="#fff" font-size="15">Backspace</text>' +
      '<animate attributeName="opacity" values=".35;.35;1;.35;.35" keyTimes="0;.35;.45;.6;1" dur="3s" repeatCount="indefinite"/></g>' },
  { t: '6. 提交、换图', d: '标完点右上角「提交」（或 Ctrl+Enter），自动进入下一张没标的；没东西可标就点「跳过」。↑ ↓ 在图片之间来回看，改了已经标过的图，点「更新」保存。',
    svg: '<g transform="translate(110 92)"><rect width="260" height="86" rx="16" fill="#0b0c18cc" stroke="#ffffff33"/>' +
      '<text x="130" y="36" text-anchor="middle" fill="#fff" font-size="17">Ctrl + Enter  提交</text>' +
      '<text x="130" y="66" text-anchor="middle" fill="#c9cadb" font-size="15">↑ ↓  上一张 / 下一张</text></g>' }
];

export function tour(start) {
  const old = document.querySelector('.tour');
  if (old) old.remove();
  let i = start || 0;
  const box = document.createElement('div');
  box.className = 'tour';
  document.body.appendChild(box);
  function close() {
    try { localStorage.setItem('xb-tour-done', '1'); } catch (e) {}
    document.removeEventListener('keydown', onKey, true);
    box.classList.add('out');
    setTimeout(() => box.remove(), 200);
  }
  function draw() {
    const st = STEPS[i];
    box.innerHTML = `<div class="tour__card glass" role="dialog" aria-modal="true">
      <div class="tour__head"><span class="tour__tag">新手教程</span><button type="button" class="tour__x" title="关闭">×</button></div>
      <h3>${st.t}</h3><p>${st.d}</p>
      <div class="tour__pic"><svg viewBox="0 0 480 270">${SCENE}${st.svg}</svg>
        ${st.bar ? '<div class="tour__bar"><span class="a">船只<i>1</i></span><span class="b">人<i>2</i></span><span class="c">车辆<i>3</i></span></div>' : ''}
        <span class="tour__note">示例图</span></div>
      <div class="tour__foot"><div class="tour__dots">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        ${i > 0 ? '<button type="button" class="btn sm prev">上一步</button>' : ''}
        <button type="button" class="btn sm primary next">${i < STEPS.length - 1 ? '下一步' : '开始标注'}</button></div>
    </div>`;
    box.querySelector('.tour__x').onclick = close;
    box.querySelector('.next').onclick = () => { if (i < STEPS.length - 1) { i++; draw(); } else close(); };
    const prev = box.querySelector('.prev');
    if (prev) prev.onclick = () => { i--; draw(); };
  }
  function onKey(e) {
    e.stopPropagation();
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); box.querySelector('.next').click(); }
    else if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); }
  }
  document.addEventListener('keydown', onKey, true);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  draw();
}

let checked = false;
export function firstTour() {
  if (checked) return;
  checked = true;
  let done = false;
  try { done = localStorage.getItem('xb-tour-done') === '1'; } catch (e) {}
  if (!done) setTimeout(() => tour(0), 500);
}

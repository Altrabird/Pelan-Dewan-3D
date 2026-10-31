import { TYPES, CHAIR_STYLES, makeItem, chairLayout, isPoly, seatCounts, emptyPlan, dewanSriPekan, History, uid } from './plan.js';
import { Editor2D } from './editor2d.js';
import { View3D } from './view3d.js';

const KEY = 'pelan-dewan-3d';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function loadSaved() {
  try { const p = JSON.parse(localStorage.getItem(KEY)); if (p?.items) return p; } catch {}
  return dewanSriPekan();
}

const app = window.app = {
  plan: loadSaved(), sel: null, selPt: null, tool: 'select', snap: 0.1, history: new History(),
  select(id) { if (id !== this.sel) this.selPt = null; this.sel = id; this.refresh(); },
  setTool(t) { this.tool = t; document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); hint(); },
  commit() {
    const json = JSON.stringify(this.plan);
    this.history.push(json);
    try { localStorage.setItem(KEY, json); $('#hint').classList.remove('warn'); }
    catch { $('#hint').textContent = 'Storan pelayar penuh — guna “Simpan” untuk simpan ke fail.'; $('#hint').classList.add('warn'); }
    this.refresh(); schedule3D();
  },
  refresh(light) { ed.draw(); renderProps(light); renderSummary(); },
};

const ed = window.ed = new Editor2D($('#cv'), app); // window.* for tests/console
const v3 = new View3D($('#pane3d'));
let t3;
const schedule3D = () => { clearTimeout(t3); t3 = setTimeout(() => { v3.build(app.plan); fillPovList(); }, 120); };

function setPlan(p, fit = true) {
  app.plan = p; app.sel = null; app.selPt = null;
  $('#planName').value = p.name || '';
  if (fit) { ed.fit(); v3.framed = false; }
  app.commit();
}

// ---------- palette ----------
const PALETTE = ['zone', 'stage', 'steps', 'chairs', 'sofa', 'table', 'round', 'rostrum', 'screen', 'flag', 'plant', 'speaker', 'camera', 'pillar', 'door', 'label'];
$('#palette').innerHTML = PALETTE.map(t => `<button data-add="${t}"><i style="background:${TYPES[t].color}"></i>${TYPES[t].name}</button>`).join('');
$('#palette').onclick = e => {
  const t = e.target.closest('[data-add]')?.dataset.add; if (!t) return;
  const c = ed.center(), it = makeItem(t, c.x, c.y);
  if (t === 'zone') it.label = 'Zon baharu';
  app.plan.items.push(it); app.setTool('select'); app.select(it.id); app.commit();
};

// ---------- properties ----------
const F = {
  label: ['Label', 'text'], color: ['Warna', 'color'], x: ['X (m)', 'num'], y: ['Y (m)', 'num'], rot: ['Putaran (°)', 'num'],
  w: ['Lebar (m)', 'num'], h: ['Dalam (m)', 'num'], height: ['Tinggi (m)', 'num'], thick: ['Tebal (m)', 'num'],
  rows: ['Baris', 'int'], cols: ['Kerusi sebaris', 'int'], sx: ['Jarak kiri-kanan (m)', 'num'], sy: ['Jarak baris (m)', 'num'],
  aisleEvery: ['Lorong setiap … kerusi (0 = tiada)', 'int'], aisle: ['Lebar lorong (m)', 'num'],
  style: ['Jenis kerusi', 'select', CHAIR_STYLES], rowStart: ['Huruf baris pertama', 'text'], closed: ['Tutup bentuk', 'check'],
};
const fieldsFor = it => ({
  wall: ['thick', 'height', 'color', 'closed'],
  path: ['label', 'color'],
  chairs: ['label', 'color', 'style', 'rows', 'cols', 'sx', 'sy', 'aisleEvery', 'aisle', 'rowStart', 'x', 'y', 'rot'],
  stage: ['label', 'color', 'height', 'x', 'y', 'w', 'h', 'rot'],
  steps: ['label', 'color', 'height', 'x', 'y', 'w', 'h', 'rot'],
})[it.type] || ['label', 'color', 'x', 'y', 'w', 'h', 'rot'];

function input(key, val, [lab, kind, opts]) {
  const v = esc(val);
  const ctl = kind === 'select' ? `<select data-k="${key}">${Object.entries(opts).map(([k, n]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${n}</option>`).join('')}</select>`
    : kind === 'check' ? `<input type="checkbox" data-k="${key}" ${val ? 'checked' : ''}>`
    : kind === 'color' ? `<input type="color" data-k="${key}" value="${v}">`
    : `<input data-k="${key}" ${kind === 'text' ? '' : `type="number" step="${kind === 'int' ? 1 : 0.05}"`} value="${kind === 'num' ? +(+val).toFixed(3) : v}">`;
  return `<label class="${kind === 'check' ? 'row' : ''}"><span>${lab}</span>${ctl}</label>`;
}

function renderProps(light) {
  const it = app.plan.items.find(i => i.id === app.sel), box = $('#props');
  if (light && box.dataset.id === app.sel) { // just update values while dragging
    box.querySelectorAll('[data-k]').forEach(el => { const v = it[el.dataset.k]; if (el.type === 'number') el.value = +(+v).toFixed(3); });
    return;
  }
  box.dataset.id = app.sel || '';
  if (!it) { box.innerHTML = '<p class="muted">Klik objek pada pelan untuk ubah sifatnya. Seret untuk alih, petak biru untuk ubah saiz, bulatan untuk putar.</p>'; return; }
  let html = `<div class="ptype">${TYPES[it.type].name}${it.type === 'chairs' ? ` · ${it.rows * it.cols} kerusi` : ''}</div>`;
  html += fieldsFor(it).map(k => input(k, it[k], F[k])).join('');
  if (it.type === 'path') {
    const p = it.pts[app.selPt];
    html += p ? `<div class="sub">Titik ${app.selPt + 1} / ${it.pts.length}</div>${input('t', p.t, ['Nota langkah (cth. “3. Naik tangga”)', 'text'])}<button data-act="delPt">Padam titik ini</button>`
      : `<p class="muted">Klik petak titik untuk tambah nota langkah. Dwiklik pada garisan untuk tambah titik.</p>`;
  }
  if (it.type === 'wall') html += '<p class="muted">Seret petak untuk alih sudut. Dwiklik pada dinding untuk tambah sudut.</p>';
  html += `<div class="btns"><button data-act="dup">Duplikat</button><button data-act="del" class="danger">Padam</button></div>`;
  box.innerHTML = html;
}

$('#props').addEventListener('input', e => {
  const k = e.target.dataset.k; if (!k) return;
  const it = app.plan.items.find(i => i.id === app.sel), f = F[k] || ['', 'text'];
  let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (f[1] === 'num' || f[1] === 'int') { v = f[1] === 'int' ? parseInt(v) : parseFloat(v); if (!Number.isFinite(v)) return; }
  if (f[1] === 'int') v = Math.max(k === 'aisleEvery' ? 0 : 1, Math.min(200, v));
  if (['w', 'h', 'sx', 'sy', 'thick', 'height', 'aisle'].includes(k)) v = Math.max(0.05, v);
  if (k === 't') it.pts[app.selPt].t = v; else it[k] = v;
  if (it.type === 'chairs') Object.assign(it, chairLayout(it).size);
  ed.draw(); renderSummary(); schedule3D();
});
$('#props').addEventListener('change', () => app.commit());

// ---------- summary ----------
function renderSummary() {
  const s = seatCounts(app.plan);
  $('#summary').innerHTML = s.blocks.map(b => `<div class="sum"><i style="background:${b.color}"></i><span>${esc(b.label)}</span><b>${b.n}</b></div>`).join('')
    + (s.sofas ? `<div class="sum"><i style="background:${TYPES.sofa.color}"></i><span>Tempat duduk sofa</span><b>${s.sofas}</b></div>` : '')
    + `<div class="sum total"><span>Jumlah tempat duduk</span><b>${s.total}</b></div>`;
}

// ---------- underlay (sketch / scanned plan to trace over) ----------
function renderUnderlay() {
  const u = app.plan.underlay, box = $('#underlay');
  if (!u) { box.innerHTML = '<button data-act="img" class="wide">Import gambar lakaran…</button>'; return; }
  box.innerHTML = `<label><span>Kelegapan</span><input type="range" min="0.05" max="1" step="0.05" data-u="opacity" value="${u.opacity}"></label>
    <label><span>Lebar sebenar gambar (m)</span><input type="number" step="0.1" data-u="w" value="${u.w}"></label>
    <label><span>X (m)</span><input type="number" step="0.1" data-u="x" value="${u.x}"></label>
    <label><span>Y (m)</span><input type="number" step="0.1" data-u="y" value="${u.y}"></label>
    <label class="row"><span>Sembunyi</span><input type="checkbox" data-u="hidden" ${u.hidden ? 'checked' : ''}></label>
    <div class="btns"><button data-act="img">Tukar</button><button data-act="imgDel" class="danger">Buang</button></div>`;
}
$('#underlay').addEventListener('input', e => {
  const k = e.target.dataset.u; if (!k) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : parseFloat(e.target.value);
  if (k !== 'hidden' && !Number.isFinite(v)) return;
  app.plan.underlay[k] = k === 'w' ? Math.max(0.5, v) : v; ed.draw();
});
$('#underlay').addEventListener('change', () => app.commit());
$('#fileImg').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => {
    // downscale so the plan still fits in browser storage
    const k = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const w = parseFloat(prompt('Berapa meter lebar sebenar kawasan dalam gambar ini?', '18')) || 18;
    app.plan.underlay = { src: c.toDataURL('image/jpeg', 0.85), w, x: 0, y: 0, opacity: 0.5, hidden: false };
    URL.revokeObjectURL(img.src); renderUnderlay(); app.commit();
  };
  img.src = URL.createObjectURL(f); e.target.value = '';
};

// ---------- 3D path picker ----------
function fillPovList() {
  const paths = app.plan.items.filter(i => i.type === 'path'), s = $('#povPath'), cur = s.value;
  s.innerHTML = paths.map((p, i) => `<option value="${i}">${esc(p.label || 'Aliran ' + (i + 1))}</option>`).join('') || '<option value="0">(tiada aliran)</option>';
  if (cur && +cur < paths.length) s.value = cur;
  if (v3.pov) v3.setPov(true, +s.value);
}
$('#povPath').onchange = () => v3.pov && v3.setPov(true, +$('#povPath').value);

// ---------- actions ----------
const download = (url, name) => Object.assign(document.createElement('a'), { href: url, download: name }).click();
const fileBase = () => (app.plan.name || 'pelan').replace(/[^\w\- ]+/g, '').trim() || 'pelan';
const offset = it => { const c = JSON.parse(JSON.stringify(it)); c.id = uid(); if (isPoly(c)) c.pts.forEach(p => { p.x += 0.5; p.y += 0.5; }); else { c.x += 0.5; c.y += 0.5; } return c; };

const ACT = {
  new() {
    if (!confirm('Mula pelan kosong? Pelan semasa akan diganti (simpan dahulu jika perlu).')) return;
    const W = parseFloat(prompt('Lebar dewan (m)?', '18')), D = parseFloat(prompt('Panjang dewan (m)?', '30'));
    setPlan(emptyPlan('Pelan baharu', W > 0 ? W : 18, D > 0 ? D : 30));
  },
  template() { if (confirm('Muat semula templat Dewan Sri Pekan? Pelan semasa akan diganti.')) setPlan(dewanSriPekan()); },
  open() { $('#fileOpen').click(); },
  save() { download(URL.createObjectURL(new Blob([JSON.stringify(app.plan, null, 1)], { type: 'application/json' })), fileBase() + '.json'); },
  png2d() { download(ed.png(), fileBase() + ' - 2D.png'); },
  png3d() { download(v3.png(), fileBase() + ' - 3D.png'); },
  undo() { const j = app.history.undo(); if (j) restore(j); },
  redo() { const j = app.history.redo(); if (j) restore(j); },
  fit() { ed.fit(); },
  del() {
    if (!app.sel) return;
    app.plan.items = app.plan.items.filter(i => i.id !== app.sel); app.select(null); app.commit();
  },
  dup() {
    const it = app.plan.items.find(i => i.id === app.sel); if (!it) return;
    const c = offset(it); app.plan.items.push(c); app.select(c.id); app.commit();
  },
  delPt() {
    const it = app.plan.items.find(i => i.id === app.sel);
    if (!it || it.pts.length <= 2) return alert('Aliran perlu sekurang-kurangnya 2 titik.');
    it.pts.splice(app.selPt, 1); app.selPt = null; app.commit();
  },
  img() { $('#fileImg').click(); },
  imgDel() { app.plan.underlay = null; renderUnderlay(); app.commit(); },
  play(b) { v3.playing = !v3.playing; b.classList.toggle('on', v3.playing); b.textContent = v3.playing ? '⏸ Henti aliran' : '▶ Main aliran'; if (!v3.playing && v3.pov) ACT.pov($('[data-act=pov]')); },
  pov(b) {
    v3.setPov(!v3.pov, +$('#povPath').value); b.classList.toggle('on', v3.pov);
    const p = $('[data-act=play]'); p.classList.toggle('on', v3.playing); p.textContent = v3.playing ? '⏸ Henti aliran' : '▶ Main aliran';
  },
  walls(b) { v3.lowWalls = !v3.lowWalls; b.classList.toggle('on', v3.lowWalls); v3.build(app.plan); },
  frame() { v3.frame(); },
};
function restore(json) { app.plan = JSON.parse(json); app.sel = null; $('#planName').value = app.plan.name || ''; try { localStorage.setItem(KEY, json); } catch {} renderUnderlay(); app.refresh(); schedule3D(); }

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) ACT[b.dataset.act](b);
  const t = e.target.closest('[data-tool]'); if (t) app.setTool(t.dataset.tool);
  const v = e.target.closest('[data-view]');
  if (v) { $('#stage').className = v.dataset.view; document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x === v)); }
});
$('#fileOpen').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try {
    const p = JSON.parse(await f.text());
    if (!Array.isArray(p.items)) throw new Error('bukan fail pelan');
    setPlan(p); renderUnderlay();
  } catch (err) { alert('Fail tidak dapat dibuka: ' + err.message); }
};
$('#planName').oninput = e => { app.plan.name = e.target.value; };
$('#planName').onchange = () => app.commit();
$('#snap').onchange = e => { app.snap = parseFloat(e.target.value); };

document.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea')) return;
  const k = e.key.toLowerCase(), it = app.plan.items.find(i => i.id === app.sel);
  if (e.ctrlKey || e.metaKey) {
    if (k === 'z') { e.preventDefault(); e.shiftKey ? ACT.redo() : ACT.undo(); }
    else if (k === 'y') { e.preventDefault(); ACT.redo(); }
    else if (k === 'd') { e.preventDefault(); ACT.dup(); }
    return;
  }
  if (k === ' ') { app.spaceDown = true; e.preventDefault(); }
  else if (k === 'delete' || k === 'backspace') ACT.del();
  else if (k === 'escape') { if (ed.drawing) { ed.drawing = null; app.setTool('select'); ed.draw(); } else app.select(null); }
  else if (k === 'enter' && ed.drawing) ed.finishDraw();
  else if (k === 'v') app.setTool('select');
  else if (k === 'w') app.setTool('wall');
  else if (k === 'l') app.setTool('path');
  else if (k === 'r' && it && !isPoly(it)) { it.rot = ((it.rot || 0) + (e.shiftKey ? -15 : 15) + 360) % 360; app.commit(); }
  else if (k.startsWith('arrow') && it) {
    e.preventDefault();
    const s = app.snap || 0.05, dx = k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, dy = k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0;
    if (isPoly(it)) it.pts.forEach(p => { p.x = +(p.x + dx).toFixed(3); p.y = +(p.y + dy).toFixed(3); }); else { it.x = +(it.x + dx).toFixed(3); it.y = +(it.y + dy).toFixed(3); }
    app.commit();
  }
});
document.addEventListener('keyup', e => { if (e.key === ' ') app.spaceDown = false; });

function hint() {
  $('#hint').textContent = {
    select: 'Seret objek untuk alih · roda tetikus = zum · seret ruang kosong / klik kanan = gerak pelan · Alt = tanpa lekap',
    wall: 'Klik setiap sudut dinding · klik titik pertama untuk tutup · dwiklik / Enter untuk tamat · Esc batal',
    path: 'Klik setiap titik laluan mengikut urutan · dwiklik / Enter untuk tamat',
  }[app.tool];
}

$('#planName').value = app.plan.name || '';
hint(); renderUnderlay(); app.commit();

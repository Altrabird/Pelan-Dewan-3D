// Plan data model. Pure (no DOM) so the 2D editor, the 3D view and tests share it.
// Units are metres. x → right, y → down (towards the back of the hall).
// Every item's "front" is local -y: chairs face -y, steps rise towards -y.

export const TYPES = {
  zone:    { name: 'Zon / Kawasan', w: 6, h: 4, color: '#3b82f6' },
  stage:   { name: 'Pentas', w: 12, h: 6, color: '#8b5e3c', height: 1.0 },
  steps:   { name: 'Tangga', w: 1.5, h: 1.2, color: '#a16207', height: 1.0 },
  chairs:  { name: 'Blok Kerusi', rows: 4, cols: 8, sx: 0.6, sy: 0.9, aisleEvery: 0, aisle: 1.2, style: 'plastic', rowStart: 'A', color: '#1e3a8a' },
  sofa:    { name: 'Sofa VIP', w: 1.8, h: 0.85, color: '#7f1d1d' },
  table:   { name: 'Meja', w: 1.8, h: 0.6, color: '#1d4ed8' },
  round:   { name: 'Meja Bulat', w: 1.5, h: 1.5, color: '#f8fafc' },
  rostrum: { name: 'Rostrum', w: 0.8, h: 0.6, color: '#5b3a1e' },
  screen:  { name: 'Skrin / Backdrop', w: 6, h: 0.3, color: '#111827' },
  flag:    { name: 'Bendera', w: 0.5, h: 0.5, color: '#dc2626' },
  plant:   { name: 'Pasu Bunga', w: 0.6, h: 0.6, color: '#16a34a' },
  speaker: { name: 'Pembesar Suara', w: 0.5, h: 0.5, color: '#111827' },
  camera:  { name: 'Kamera / Media', w: 0.6, h: 0.6, color: '#334155' },
  pillar:  { name: 'Tiang', w: 0.5, h: 0.5, color: '#d1d5db' },
  door:    { name: 'Pintu', w: 2, h: 0.3, color: '#92400e' },
  label:   { name: 'Teks', w: 4, h: 0.8, color: '#111827' },
  wall:    { name: 'Dinding', thick: 0.25, height: 5, color: '#e5e7eb' },
  path:    { name: 'Laluan / Aliran', color: '#f59e0b' },
};

export const CHAIR_STYLES = { plastic: 'Kerusi plastik', banquet: 'Kerusi bersarung (banquet)', vip: 'Kerusi VIP (berlengan)' };
export const isPoly = it => it.type === 'wall' || it.type === 'path';
export const LAYER = { stage: -1, zone: 0, steps: 1, wall: 2, path: 5, label: 6 }; // zones draw on top of a stage
export const layerOf = it => LAYER[it.type] ?? 3;

export const uid = () => Math.random().toString(36).slice(2, 9);

export function makeItem(type, x, y, extra = {}) {
  const { name, ...defaults } = TYPES[type];
  const it = { id: uid(), type, label: type === 'label' ? 'Teks' : '', x, y, rot: 0, ...defaults, ...extra };
  if (isPoly(it)) delete it.x, delete it.y, delete it.rot;
  if (type === 'chairs') Object.assign(it, chairLayout(it).size);
  return it;
}

// Seat centres in the block's local frame. Row 0 is the front row (towards -y).
export function chairLayout(it) {
  const aisles = it.aisleEvery > 0 ? Math.floor((it.cols - 1) / it.aisleEvery) : 0;
  const w = it.cols * it.sx + aisles * it.aisle, h = it.rows * it.sy;
  const seats = [];
  for (let r = 0; r < it.rows; r++)
    for (let c = 0; c < it.cols; c++) {
      const gap = it.aisleEvery > 0 ? Math.floor(c / it.aisleEvery) * it.aisle : 0;
      seats.push({ row: r, col: c, x: -w / 2 + it.sx / 2 + c * it.sx + gap, y: -h / 2 + it.sy / 2 + r * it.sy });
    }
  return { size: { w: +w.toFixed(3), h: +h.toFixed(3) }, seats };
}

export const rowName = (it, r) => it.rowStart ? String.fromCharCode(it.rowStart.toUpperCase().charCodeAt(0) + r) : '';

const rad = d => d * Math.PI / 180;
export function toWorld(it, lx, ly) {
  const c = Math.cos(rad(it.rot || 0)), s = Math.sin(rad(it.rot || 0));
  return { x: it.x + lx * c - ly * s, y: it.y + lx * s + ly * c };
}
export function toLocal(it, x, y) {
  const c = Math.cos(rad(it.rot || 0)), s = Math.sin(rad(it.rot || 0)), dx = x - it.x, dy = y - it.y;
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}
export const inRect = (it, x, y, pad = 0) => { const l = toLocal(it, x, y); return Math.abs(l.x) <= it.w / 2 + pad && Math.abs(l.y) <= it.h / 2 + pad; };

export function distToSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export function polySegs(it) {
  const s = [];
  for (let i = 1; i < it.pts.length; i++) s.push([it.pts[i - 1], it.pts[i]]);
  if (it.closed && it.pts.length > 2) s.push([it.pts.at(-1), it.pts[0]]);
  return s;
}

// Floor height at a point: on top of a stage, or partway up a flight of steps.
export function elevAt(plan, x, y) {
  let e = 0;
  for (const it of plan.items) {
    if (it.type === 'stage' && inRect(it, x, y)) e = Math.max(e, it.height);
    if (it.type === 'steps' && inRect(it, x, y)) e = Math.max(e, it.height * (0.5 - toLocal(it, x, y).y / it.h));
  }
  return e;
}

export function seatCounts(plan) {
  const blocks = plan.items.filter(i => i.type === 'chairs').map(i => ({ label: i.label || 'Blok kerusi', n: i.rows * i.cols, color: i.color }));
  const sofas = plan.items.filter(i => i.type === 'sofa').reduce((n, s) => n + Math.max(1, Math.round(s.w / 0.8)), 0);
  return { blocks, sofas, total: blocks.reduce((n, b) => n + b.n, 0) + sofas };
}

export function bounds(plan) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const it of plan.items) {
    if (isPoly(it)) it.pts.forEach(p => add(p.x, p.y));
    else [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { const p = toWorld(it, a * it.w / 2, b * it.h / 2); add(p.x, p.y); });
  }
  return x0 === Infinity ? { x0: 0, y0: 0, x1: 20, y1: 15 } : { x0, y0, x1, y1 };
}

export function emptyPlan(name = 'Pelan baharu', W = 20, D = 30) {
  return {
    v: 1, name, items: [makeItem('wall', 0, 0, { closed: true, pts: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }] })], underlay: null,
  };
}

export class History {
  constructor(limit = 80) { this.stack = []; this.i = -1; this.limit = limit; }
  push(json) {
    if (this.stack[this.i] === json) return;
    this.stack.length = this.i + 1;
    this.stack.push(json);
    if (this.stack.length > this.limit) this.stack.shift();
    this.i = this.stack.length - 1;
  }
  undo() { return this.i > 0 ? this.stack[--this.i] : null; }
  redo() { return this.i < this.stack.length - 1 ? this.stack[++this.i] : null; }
}

// Dewan Sri Pekan, SK Bandar Tawau. shortcut: dimensions are an assumed typical school hall (18 m × 32 m,
// stage 12 × 6 m, 1 m high); measure the real hall and adjust the walls/stage in the editor.
export function dewanSriPekan() {
  const p = emptyPlan('Dewan Sri Pekan, SK Bandar Tawau', 18, 32);
  const I = (t, x, y, e) => p.items.push(makeItem(t, x, y, e));
  const P = (x, y, t = '') => ({ x, y, t });

  I('stage', 9, 3, { label: 'PENTAS UTAMA' });
  I('screen', 9, 0.5, { w: 8, label: 'Backdrop / Skrin LED', rot: 180 });
  I('rostrum', 13.8, 2.6, { rot: 180, label: 'Rostrum' });
  I('table', 4.6, 3.6, { w: 2.4, h: 0.7, label: 'Meja Hadiah', color: '#b91c1c', rot: 180 });
  I('zone', 9, 4.3, { w: 2.4, h: 1.6, label: 'Titik Penyampaian', color: '#eab308' });
  I('zone', 9, 2.0, { w: 3, h: 1.2, label: 'Titik Bergambar', color: '#ec4899' });
  I('flag', 3.6, 0.8); I('flag', 14.4, 0.8);
  I('steps', 2.4, 5.0, { rot: 90, w: 1.4, label: 'Tangga Naik' });
  I('steps', 15.6, 5.0, { rot: -90, w: 1.4, label: 'Tangga Turun' });
  I('steps', 9, 6.6, { w: 2.4, label: 'Tangga VIP' });
  for (const x of [4.5, 6.5, 11.5, 13.5]) I('plant', x, 6.35);
  I('speaker', 3.3, 6.5); I('speaker', 14.7, 6.5);

  I('zone', 9, 8.8, { w: 9, h: 2.6, label: 'VIP', color: '#ca8a04' });
  for (const x of [5.6, 7.6, 10.4, 12.4]) I('sofa', x, 8.3);
  I('chairs', 9, 9.55, { rows: 1, cols: 10, sx: 0.75, sy: 0.9, aisleEvery: 5, aisle: 1.2, style: 'vip', color: '#7f1d1d', label: 'Tetamu Kehormat', rowStart: '' });

  I('zone', 15.3, 8.6, { w: 2.6, h: 2.2, label: 'Media', color: '#64748b' });
  I('camera', 15.3, 8.6, { rot: -30 });

  const block = (x, y, rows, label, color, rowStart = 'A') =>
    I('chairs', x, y, { rows, cols: 10, label, color, rowStart, style: 'banquet' });
  block(4.75, 14, 5, 'Penerima Anugerah', '#15803d');
  block(13.25, 14, 5, 'Guru', '#6d28d9');
  block(4.75, 21.6, 6, 'Ibu Bapa (Kiri)', '#0369a1', 'F');
  block(13.25, 21.6, 6, 'Ibu Bapa (Kanan)', '#0369a1', 'F');
  I('chairs', 4.75, 27.4, { rows: 3, cols: 10, label: 'Murid (Kiri)', color: '#c2410c', rowStart: 'L' });
  I('chairs', 13.25, 27.4, { rows: 3, cols: 10, label: 'Murid (Kanan)', color: '#c2410c', rowStart: 'L' });

  I('door', 9, 32, { w: 3, label: 'Pintu Utama' });
  I('door', 0, 17.4, { rot: 90, label: 'Pintu Sisi' });
  I('door', 18, 17.4, { rot: 90, label: 'Pintu Sisi' });
  I('table', 3.4, 30.9, { w: 3.6, h: 0.7, label: 'Meja Pendaftaran', color: '#0f766e' });
  for (const y of [8, 14, 20, 26]) { I('pillar', 0.35, y); I('pillar', 17.65, y); }
  I('label', 9, 17.4, { label: 'Laluan Silang', w: 3, h: 0.6, color: '#475569' });

  p.items.push(makeItem('path', 0, 0, { label: 'Aliran Penerima Anugerah', color: '#16a34a', pts: [
    P(1.1, 15, '1. Bangun & beratur di laluan tepi'), P(1.1, 6.0, '2. Tunggu giliran'), P(1.6, 5.0, '3. Naik tangga kiri'),
    P(3.8, 5.0), P(8.4, 4.4, '4. Terima anugerah'), P(9, 2.3, '5. Bergambar'), P(14.2, 5.0),
    P(16.6, 5.0, '6. Turun tangga kanan'), P(16.9, 7.5), P(16.9, 17.4, '7. Ikut laluan silang'), P(1.1, 17.4), P(1.1, 15.6, '8. Kembali ke tempat duduk'),
  ] }));
  p.items.push(makeItem('path', 0, 0, { label: 'Aliran VIP', color: '#ca8a04', pts: [
    P(9, 31.4, 'Ketibaan VIP'), P(9, 10.6, 'Ke sofa VIP'), P(9, 7.6, 'Naik pentas'), P(9, 4.6, 'Sampaikan anugerah'),
  ] }));
  return p;
}

// 2D plan editor on a <canvas>. Reads/writes app.plan; calls app.commit() after each finished edit.
import { chairLayout, rowName, toWorld, toLocal, inRect, distToSeg, polySegs, isPoly, layerOf, bounds, makeItem, SURFACES } from './plan.js';

const CARRIES = ['canopy', 'ground']; // dragging these also moves what stands on them

const HANDLE = 7; // px

export class Editor2D {
  constructor(canvas, app) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.app = app;
    this.scale = 20; this.ox = 40; this.oy = 40;
    this.drag = null; this.drawing = null; this.hover = null; this.mouse = { x: 0, y: 0 };
    this.img = null; this.imgSrc = null;
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('dblclick', e => this.dbl(e));
    canvas.addEventListener('wheel', e => this.wheel(e), { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  get plan() { return this.app.plan; }
  sel() { return this.plan.items.find(i => i.id === this.app.sel); }

  resize() {
    const r = this.cv.parentElement.getBoundingClientRect(), d = devicePixelRatio || 1;
    if (!r.width) return;
    this.cv.width = r.width * d; this.cv.height = r.height * d;
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
    this.dpr = d; this.w = r.width; this.h = r.height;
    if (!this.fitted) { this.fit(); this.fitted = true; }
    this.draw();
  }

  fit() {
    const b = bounds(this.plan), m = 50;
    this.scale = Math.min((this.w - 2 * m) / (b.x1 - b.x0 || 1), (this.h - 2 * m) / (b.y1 - b.y0 || 1));
    this.ox = (this.w - (b.x1 - b.x0) * this.scale) / 2 - b.x0 * this.scale;
    this.oy = (this.h - (b.y1 - b.y0) * this.scale) / 2 - b.y0 * this.scale;
    this.draw();
  }

  toW(e) { const r = this.cv.getBoundingClientRect(); return { x: (e.clientX - r.left - this.ox) / this.scale, y: (e.clientY - r.top - this.oy) / this.scale }; }
  toS(p) { return { x: p.x * this.scale + this.ox, y: p.y * this.scale + this.oy }; }
  snap(v, e) { const s = this.app.snap; return +(!s || e?.altKey ? v : Math.round(v / s) * s).toFixed(3); }
  snapP(p, e) { return { x: this.snap(p.x, e), y: this.snap(p.y, e) }; }
  center() { return this.snapP({ x: (this.w / 2 - this.ox) / this.scale, y: (this.h / 2 - this.oy) / this.scale }); }

  // ---------- hit testing ----------
  handles(it) {
    if (!it) return [];
    if (isPoly(it)) return it.pts.map((p, i) => ({ kind: 'pt', i, ...p }));
    const k = HANDLE * 3 / this.scale;
    return [{ kind: 'size', ...toWorld(it, it.w / 2, it.h / 2) }, { kind: 'rot', ...toWorld(it, 0, -it.h / 2 - k) }];
  }
  hitHandle(p) {
    const r = (HANDLE + 3) / this.scale;
    return this.handles(this.sel()).find(h => Math.hypot(h.x - p.x, h.y - p.y) <= r);
  }
  hitItem(p) {
    const list = [...this.plan.items].sort((a, b) => layerOf(b) - layerOf(a));
    // exact hits first, so the thin canopy strip around a chair block is not swallowed by the click tolerance
    const find = tol => list.find(it => !it.locked && (isPoly(it)
      ? polySegs(it).some(([a, b]) => distToSeg(p, a, b) <= Math.max(tol, (it.thick || 0.15) / 2 + tol))
      // big outdoor areas are picked by their edge only, so clicking inside still pans / selects what is on them
      : it.type === 'ground' ? inRect(it, p.x, p.y, 5 / this.scale) && !inRect(it, p.x, p.y, -8 / this.scale)
      : inRect(it, p.x, p.y, tol)));
    return find(0) || find(5 / this.scale);
  }

  // ---------- pointer ----------
  down(e) {
    this.cv.setPointerCapture(e.pointerId);
    const p = this.toW(e), tool = this.app.tool;
    if (e.button === 1 || e.button === 2 || this.app.spaceDown) {
      if (e.button === 2 && this.drawing) return this.finishDraw();
      this.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: this.ox, oy: this.oy }; return;
    }
    if (tool === 'wall' || tool === 'path') {
      const q = this.snapP(p, e);
      if (!this.drawing) {
        this.drawing = makeItem(tool, 0, 0, { pts: [q, { ...q }], ...(tool === 'path' ? { label: 'Laluan baharu' } : {}) });
      } else {
        const first = this.drawing.pts[0];
        if (tool === 'wall' && this.drawing.pts.length > 3 && Math.hypot(q.x - first.x, q.y - first.y) * this.scale < 12) {
          this.drawing.pts.pop(); this.drawing.closed = true; return this.finishDraw();
        }
        this.drawing.pts.push({ ...q });
      }
      return this.draw();
    }
    const h = this.hitHandle(p), it = this.sel();
    if (h) {
      this.app.selPt = h.kind === 'pt' ? h.i : null;
      this.drag = { kind: h.kind, i: h.i, start: JSON.stringify(it), anchor: toWorld(it, -it.w / 2, -it.h / 2) };
      this.app.refresh(); return;
    }
    const hit = this.hitItem(p);
    this.app.select(hit?.id ?? null);
    this.drag = hit ? { kind: 'move', p0: p, start: JSON.parse(JSON.stringify(hit)), kids: CARRIES.includes(hit.type) && !e.shiftKey ? this.contents(hit) : [] }
      : { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: this.ox, oy: this.oy };
  }

  move(e) {
    const p = this.toW(e); this.mouse = p;
    if (this.drawing) { Object.assign(this.drawing.pts.at(-1), this.snapP(p, e)); return this.draw(); }
    const d = this.drag; if (!d) return;
    const it = this.sel();
    if (d.kind === 'pan') { this.ox = d.ox + e.clientX - d.sx; this.oy = d.oy + e.clientY - d.sy; }
    else if (d.kind === 'move') {
      const dx = p.x - d.p0.x, dy = p.y - d.p0.y;
      if (isPoly(it)) {
        // snap the first point and carry the rest with it
        const s0 = d.start.pts[0], q = this.snapP({ x: s0.x + dx, y: s0.y + dy }, e);
        it.pts.forEach((pt, i) => { pt.x = +(d.start.pts[i].x + q.x - s0.x).toFixed(3); pt.y = +(d.start.pts[i].y + q.y - s0.y).toFixed(3); });
      } else {
        it.x = this.snap(d.start.x + dx, e); it.y = this.snap(d.start.y + dy, e);
        for (const k of d.kids) { k.it.x = +(k.x + it.x - d.start.x).toFixed(3); k.it.y = +(k.y + it.y - d.start.y).toFixed(3); }
      }
      d.moved = true;
    }
    else if (d.kind === 'pt') { Object.assign(it.pts[d.i], this.snapP(p, e)); d.moved = true; }
    else if (d.kind === 'rot') {
      let a = Math.atan2(p.x - it.x, -(p.y - it.y)) * 180 / Math.PI;
      if (!e.altKey) a = Math.round(a / 15) * 15;
      it.rot = ((a % 360) + 360) % 360; d.moved = true;
    }
    else if (d.kind === 'size') {
      const r = toLocal({ x: d.anchor.x, y: d.anchor.y, rot: it.rot }, p.x, p.y);
      if (it.type === 'chairs') {
        it.cols = Math.max(1, Math.round(r.x / it.sx)); it.rows = Math.max(1, Math.round(r.y / it.sy));
        while (it.cols > 1 && chairLayout(it).size.w > r.x + it.sx / 2) it.cols--;
        Object.assign(it, chairLayout(it).size);
      } else { it.w = Math.max(0.2, this.snap(r.x, e)); it.h = Math.max(0.1, this.snap(r.y, e)); }
      const c = toWorld({ x: d.anchor.x, y: d.anchor.y, rot: it.rot }, it.w / 2, it.h / 2);
      it.x = +c.x.toFixed(3); it.y = +c.y.toFixed(3); d.moved = true;
    }
    if (d.kind !== 'pan') this.app.refresh(true);
    this.draw();
  }

  // Items whose centre is on top of `it` (and are smaller than it), with their start positions.
  contents(it) {
    return this.plan.items.filter(k => k !== it && !isPoly(k) && layerOf(k) >= layerOf(it) && k.w * k.h < it.w * it.h && inRect(it, k.x, k.y))
      .map(k => ({ it: k, x: k.x, y: k.y }));
  }

  up() {
    if (this.drag?.moved) this.app.commit();
    this.drag = null;
  }

  dbl(e) {
    if (this.drawing) { this.drawing.pts.pop(); return this.finishDraw(); }
    // double-click a selected wall/path segment to add a bend point there
    const it = this.sel(), p = this.snapP(this.toW(e), e);
    if (!it || !isPoly(it)) return;
    const segs = polySegs(it), i = segs.findIndex(([a, b]) => distToSeg(p, a, b) * this.scale < 8);
    if (i < 0) return;
    it.pts.splice(i + 1, 0, { x: p.x, y: p.y, t: '' });
    this.app.selPt = i + 1; this.app.commit();
  }

  finishDraw() {
    const d = this.drawing; this.drawing = null;
    // drop duplicate trailing points left by the double-click
    d.pts = d.pts.filter((p, i, a) => !i || Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) > 0.01);
    if (d.pts.length >= 2) { this.plan.items.push(d); this.app.select(d.id); this.app.commit(); }
    this.app.setTool('select');
    this.draw();
  }

  wheel(e) {
    e.preventDefault();
    const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.exp(-e.deltaY * 0.0015), s = Math.min(400, Math.max(2, this.scale * k));
    this.ox = mx - (mx - this.ox) * s / this.scale; this.oy = my - (my - this.oy) * s / this.scale; this.scale = s;
    this.draw();
  }

  // ---------- drawing ----------
  draw(clean = false) {
    const c = this.ctx; if (!this.w) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#f8fafc'; c.fillRect(0, 0, this.w, this.h);
    this.drawGrid(c);
    this.drawUnderlay(c);
    c.save(); c.translate(this.ox, this.oy); c.scale(this.scale, this.scale);
    const items = [...this.plan.items, ...(this.drawing ? [this.drawing] : [])].sort((a, b) => layerOf(a) - layerOf(b));
    for (const it of items) this.drawItem(c, it);
    if (!clean) this.drawSelection(c);
    c.restore();
  }

  drawGrid(c) {
    const s = this.scale, step = s < 6 ? 5 : 1;
    const x0 = Math.floor(-this.ox / s / step) * step, y0 = Math.floor(-this.oy / s / step) * step;
    c.lineWidth = 1; c.font = '10px system-ui'; c.fillStyle = '#94a3b8';
    for (let x = x0; x * s + this.ox < this.w; x += step) {
      c.strokeStyle = x % 5 ? '#e8edf3' : '#cfd8e3';
      const X = Math.round(x * s + this.ox) + 0.5; c.beginPath(); c.moveTo(X, 0); c.lineTo(X, this.h); c.stroke();
      if (!(x % 5)) c.fillText(x + 'm', X + 2, 10);
    }
    for (let y = y0; y * s + this.oy < this.h; y += step) {
      c.strokeStyle = y % 5 ? '#e8edf3' : '#cfd8e3';
      const Y = Math.round(y * s + this.oy) + 0.5; c.beginPath(); c.moveTo(0, Y); c.lineTo(this.w, Y); c.stroke();
      if (!(y % 5)) c.fillText(y + 'm', 2, Y - 2);
    }
  }

  drawUnderlay(c) {
    const u = this.plan.underlay;
    if (!u?.src || u.hidden) return;
    if (this.imgSrc !== u.src) { this.imgSrc = u.src; this.img = new Image(); this.img.onload = () => this.draw(); this.img.src = u.src; }
    if (!this.img.complete || !this.img.naturalWidth) return;
    const h = u.w * this.img.naturalHeight / this.img.naturalWidth;
    c.globalAlpha = u.opacity ?? 0.5;
    c.drawImage(this.img, u.x * this.scale + this.ox, u.y * this.scale + this.oy, u.w * this.scale, h * this.scale);
    c.globalAlpha = 1;
  }

  text(c, str, x, y, size, color = '#0f172a', bold = true) {
    if (!str) return;
    const px = 1 / this.scale;
    c.save(); c.translate(x, y); c.scale(px, px);
    c.font = `${bold ? 600 : 400} ${size}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.85)'; c.strokeText(str, 0, 0);
    c.fillStyle = color; c.fillText(str, 0, 0); c.restore();
  }

  drawItem(c, it) {
    const lw = 1 / this.scale, fs = Math.max(10, Math.min(15, this.scale * 0.45));
    if (isPoly(it)) return it.type === 'wall' ? this.drawWall(c, it) : this.drawPath(c, it, fs);
    c.save(); c.translate(it.x, it.y); c.rotate((it.rot || 0) * Math.PI / 180);
    const { w, h } = it, col = it.color;
    c.lineWidth = lw * 1.5;
    const rect = (fill, stroke = '#334155') => { c.fillStyle = fill; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = stroke; c.strokeRect(-w / 2, -h / 2, w, h); };
    let label = it.label, ly = 0;
    switch (it.type) {
      case 'ground':
        c.fillStyle = (SURFACES[it.surface] || SURFACES.simen)[1]; c.fillRect(-w / 2, -h / 2, w, h);
        c.strokeStyle = '#00000033'; c.lineWidth = 2 * lw; c.strokeRect(-w / 2, -h / 2, w, h);
        label = ''; c.restore();
        { const p = toWorld(it, 0, -h / 2 + 0.6); this.text(c, it.label, p.x, p.y, fs, '#334155'); }
        return;
      case 'canopy': {
        c.fillStyle = '#ffffff55'; c.fillRect(-w / 2, -h / 2, w, h);
        c.strokeStyle = '#94a3b8'; c.lineWidth = lw; c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, h / 2); c.moveTo(w / 2, -h / 2); c.lineTo(-w / 2, h / 2); c.stroke();
        c.strokeStyle = col; c.lineWidth = 3 * lw; c.strokeRect(-w / 2, -h / 2, w, h);
        c.fillStyle = '#334155'; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.fillRect(a * w / 2 - 0.08, b * h / 2 - 0.08, 0.16, 0.16);
        label = `${it.label || 'Kanopi'} (${+it.w.toFixed(1)}×${+it.h.toFixed(1)} m)`; ly = h / 2 + 0.45;
        break;
      }
      case 'tree':
        c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); c.fillStyle = col + '88'; c.fill(); c.strokeStyle = col; c.lineWidth = 2 * lw; c.stroke();
        c.fillStyle = '#78350f'; c.beginPath(); c.arc(0, 0, 0.18, 0, Math.PI * 2); c.fill();
        break;
      case 'zone':
        c.fillStyle = col + '2e'; c.fillRect(-w / 2, -h / 2, w, h);
        c.setLineDash([6 * lw, 4 * lw]); c.strokeStyle = col; c.lineWidth = 2 * lw; c.strokeRect(-w / 2, -h / 2, w, h); c.setLineDash([]);
        break;
      case 'stage':
        rect(col + 'cc', '#3f2a17');
        c.strokeStyle = '#00000022';
        for (let x = -w / 2 + 0.5; x < w / 2; x += 0.5) { c.beginPath(); c.moveTo(x, -h / 2); c.lineTo(x, h / 2); c.stroke(); }
        label = `${it.label || 'Pentas'} (${it.height} m)`; ly = h / 2 - 0.6;
        break;
      case 'steps': {
        rect('#e7d3b0', '#78350f');
        const n = Math.max(2, Math.round(it.height / 0.18));
        c.strokeStyle = '#78350f';
        for (let i = 1; i < n; i++) { const y = -h / 2 + i * h / n; c.beginPath(); c.moveTo(-w / 2, y); c.lineTo(w / 2, y); c.stroke(); }
        c.fillStyle = '#78350f'; c.beginPath(); c.moveTo(0, -h / 2 + 0.1); c.lineTo(0.25, -h / 2 + 0.45); c.lineTo(-0.25, -h / 2 + 0.45); c.fill();
        label = '';
        break;
      }
      case 'chairs': {
        const { seats } = chairLayout(it), cw = Math.min(0.46, it.sx * 0.8), cd = Math.min(0.46, it.sy * 0.6);
        for (const s of seats) {
          c.fillStyle = col; c.fillRect(s.x - cw / 2, s.y - cd / 2, cw, cd);
          c.fillStyle = '#0f172a'; c.fillRect(s.x - cw / 2, s.y + cd / 2 - 0.07, cw, 0.07); // backrest
        }
        if (it.rowStart && this.scale > 9) for (let r = 0; r < it.rows; r++) this.text(c, rowName(it, r), -w / 2 - 0.3, seats[r * it.cols].y, fs * 0.8, '#475569');
        label = `${it.label || 'Kerusi'} · ${it.rows * it.cols}`; ly = -h / 2 - 0.4;
        break;
      }
      case 'sofa':
        rect(col, '#1f2937'); c.fillStyle = '#00000055';
        c.fillRect(-w / 2, h / 2 - 0.22, w, 0.22); c.fillRect(-w / 2, -h / 2, 0.18, h); c.fillRect(w / 2 - 0.18, -h / 2, 0.18, h);
        label = ''; break;
      case 'round':
        c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.strokeStyle = '#334155'; c.stroke(); break;
      case 'table': rect(col + 'dd'); ly = 0; break;
      case 'rostrum': rect(col); c.fillStyle = '#fbbf24'; c.fillRect(-w / 2, -h / 2, w, 0.08); label = ''; break;
      case 'screen': rect(col, '#000'); ly = -h / 2 - 0.35; break;
      case 'door':
        rect(col, '#451a03');
        c.strokeStyle = col; c.beginPath(); c.arc(-w / 2, 0, w, -Math.PI / 2, 0); c.stroke();
        ly = -h / 2 - 0.4; break;
      case 'label':
        this.text(c, it.label, 0, 0, Math.max(9, it.h * this.scale * 0.8), col);
        label = ''; break;
      case 'pillar': rect(col, '#64748b'); label = ''; break;
      default: // flag, plant, speaker, camera
        c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.strokeStyle = '#0f172a'; c.stroke();
        if (it.type === 'camera') { c.fillStyle = '#fff'; c.fillRect(-0.06, -h / 2 - 0.15, 0.12, 0.25); }
        label = it.label;
    }
    c.restore();
    if (label) { const p = toWorld(it, 0, ly); this.text(c, label, p.x, p.y, fs); }
  }

  drawWall(c, it) {
    c.lineJoin = 'miter'; c.lineCap = 'square'; c.strokeStyle = '#475569'; c.lineWidth = it.thick;
    c.beginPath(); it.pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
    if (it.closed) c.closePath();
    c.stroke();
  }

  drawPath(c, it, fs) {
    const lw = 1 / this.scale;
    c.strokeStyle = it.color; c.lineWidth = Math.max(0.12, 3 * lw); c.lineCap = 'round'; c.lineJoin = 'round';
    c.setLineDash([0.45, 0.25]);
    c.beginPath(); it.pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke(); c.setLineDash([]);
    c.fillStyle = it.color;
    for (const [a, b] of polySegs(it)) { // arrow at each segment's middle
      const L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 0.6) continue;
      const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, s = Math.max(0.35, 9 * lw);
      c.beginPath(); c.moveTo(mx + ux * s, my + uy * s); c.lineTo(mx - ux * s - uy * s * 0.7, my - uy * s + ux * s * 0.7); c.lineTo(mx - ux * s + uy * s * 0.7, my - uy * s - ux * s * 0.7); c.fill();
    }
    for (const p of it.pts) if (p.t) {
      c.beginPath(); c.arc(p.x, p.y, Math.max(0.18, 5 * lw), 0, Math.PI * 2); c.fillStyle = it.color; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5 * lw; c.stroke();
      c.save(); c.translate(p.x + 8 * lw, p.y); c.scale(lw, lw); c.font = `600 ${fs * 0.85}px system-ui`; c.textBaseline = 'middle';
      c.lineWidth = 3; c.strokeStyle = '#fff'; c.strokeText(p.t, 0, 0); c.fillStyle = '#0f172a'; c.fillText(p.t, 0, 0); c.restore();
    }
  }

  drawSelection(c) {
    const it = this.sel(); if (!it) return;
    const lw = 1 / this.scale, r = HANDLE / this.scale;
    c.strokeStyle = '#2563eb'; c.lineWidth = 2 * lw;
    if (!isPoly(it)) {
      c.save(); c.translate(it.x, it.y); c.rotate((it.rot || 0) * Math.PI / 180);
      c.setLineDash([5 * lw, 3 * lw]); c.strokeRect(-it.w / 2 - 2 * lw, -it.h / 2 - 2 * lw, it.w + 4 * lw, it.h + 4 * lw); c.setLineDash([]);
      c.beginPath(); c.moveTo(0, -it.h / 2); c.lineTo(0, -it.h / 2 - HANDLE * 3 * lw); c.stroke();
      c.restore();
    }
    for (const h of this.handles(it)) {
      c.beginPath();
      if (h.kind === 'rot') c.arc(h.x, h.y, r, 0, Math.PI * 2); else c.rect(h.x - r, h.y - r, 2 * r, 2 * r);
      c.fillStyle = h.kind === 'pt' && h.i === this.app.selPt ? '#f59e0b' : '#fff'; c.fill(); c.stroke();
    }
  }

  png() { this.draw(true); const url = this.cv.toDataURL('image/png'); this.draw(); return url; }
}

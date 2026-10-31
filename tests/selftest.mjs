// node tests/selftest.mjs — checks the pure plan model.
import assert from 'node:assert/strict';
import { chairLayout, makeItem, toWorld, toLocal, elevAt, seatCounts, dewanSriPekan, History, inRect, sideArea, insideHall } from '../js/plan.js';

const b = makeItem('chairs', 0, 0, { rows: 2, cols: 6, sx: 0.6, sy: 0.9, aisleEvery: 3, aisle: 1.2 });
const L = chairLayout(b);
assert.equal(L.seats.length, 12);
assert.equal(L.size.w, 6 * 0.6 + 1.2); assert.equal(b.w, L.size.w);
assert.ok(Math.abs(L.seats[3].x - L.seats[2].x - (0.6 + 1.2)) < 1e-9, 'aisle gap between col 2 and 3');
assert.ok(L.seats[0].y < L.seats[6].y, 'row 0 is the front (-y)');

const r = { x: 5, y: 2, rot: 90 };
const w = toWorld(r, 0, -1); // front of a 90°-rotated item points to +x
assert.ok(Math.abs(w.x - 6) < 1e-9 && Math.abs(w.y - 2) < 1e-9);
const l = toLocal(r, w.x, w.y); assert.ok(Math.abs(l.x) < 1e-9 && Math.abs(l.y + 1) < 1e-9);

const p = dewanSriPekan();
assert.equal(elevAt(p, 9, 3), 1, 'on stage');
assert.equal(elevAt(p, 9, 20), 0, 'on floor');
const e = elevAt(p, 2.4, 5); assert.ok(e > 0.4 && e < 0.6, 'halfway up the side steps: ' + e);
for (const path of p.items.filter(i => i.type === 'path'))
  for (const pt of path.pts) {
    const blockers = p.items.filter(i => ['chairs', 'sofa', 'table', 'rostrum', 'pillar', 'speaker', 'plant', 'camera', 'flag'].includes(i.type) && inRect(i, pt.x, pt.y));
    assert.equal(blockers.length, 0, `${path.label} point ${pt.x},${pt.y} is inside ${blockers.map(x => x.label || x.type)}`);
  }
const s = seatCounts(p);
assert.equal(s.total, s.blocks.reduce((n, x) => n + x.n, 0) + s.sofas);
assert.ok(s.total > 250, 'template seats ' + s.total);

assert.equal(s.inside, 298); assert.equal(s.outside, 8 * 54, 'four 54-seat canopies on each side');
assert.deepEqual(Object.values(s.areas), [216, 216]);
assert.equal(p.items.filter(i => i.type === 'canopy').length, 12);
const aL = sideArea(p, 'kiri'), aR = sideArea(p, 'kanan'), aB = sideArea(p, 'belakang'), aF = sideArea(p, 'depan');
assert.equal(aL.x + aL.w / 2, -1); assert.equal(aR.x - aR.w / 2, 19); assert.equal(aB.y - aB.h / 2, 33); assert.equal(aF.y + aF.h / 2, -1);
assert.equal(aB.x - aB.w / 2, aL.x - aL.w / 2, 'back strip covers the left corner'); assert.equal(aB.x + aB.w / 2, aR.x + aR.w / 2);
for (const g of p.items.filter(i => i.type === 'ground')) assert.ok(!insideHall(p, g.x, g.y), g.label + ' is outside the hall');
const big = makeItem('canopy', 0, 0, { w: 6, h: 6 }), small = makeItem('canopy', 0, 0, { w: 3, h: 3 });
assert.ok(big.w === 6 && small.w === 3 && big.id !== small.id);

const h = new History(); h.push('a'); h.push('b'); h.push('c');
assert.equal(h.undo(), 'b'); assert.equal(h.undo(), 'a'); assert.equal(h.undo(), null); assert.equal(h.redo(), 'b');
h.push('d'); assert.equal(h.redo(), null);
assert.doesNotThrow(() => JSON.parse(JSON.stringify(p)));
console.log('selftest ok —', s.total, 'seats in template');

// Three.js view built from the plan. Plan (x, y) → world (x, z); item rot (clockwise, degrees) → rotation.y = -rot.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { chairLayout, elevAt, polySegs, bounds, SURFACES } from './plan.js';
import * as M from './models.js';


// One reusable procedural timber floor; no image requests or per-plank meshes.
let floorFinish;
function hallFloor(w, d) {
  if (!floorFinish) {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d');
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 4; col++) {
        const px = col * 192 + (row % 2) * 96, py = row * 64;
        x.fillStyle = ['#bda27d','#c4aa86','#b89d79','#c9af8a'][(row * 3 + col + 4) % 4];
        x.fillRect(px, py, 192, 64);
        x.strokeStyle = 'rgba(89,65,39,.22)'; x.lineWidth = 1; x.strokeRect(px + .5, py + .5, 191, 63);
        for (let j = 0; j < 14; j++) {
          x.strokeStyle = 'rgba(96,67,37,.055)'; x.beginPath(); x.moveTo(px,py+4+j*4);
          x.bezierCurveTo(px+55,py+7+j*4,px+130,py+1+j*4,px+192,py+4+j*4); x.stroke();
        }
      }
    }
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
    floorFinish = new THREE.MeshStandardMaterial({map, roughness: .72, color: '#ffffff'});
  }
  floorFinish.map.repeat.set(w / 5, d / 5); floorFinish.map.needsUpdate = true;
  return floorFinish;
}

export class View3D {
  constructor(host) {
    this.host = host;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.12;
    host.appendChild(r.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#e8e5de');
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.15, 600);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI * 0.495;
    this.scene.add(new THREE.HemisphereLight('#f1f6ff', '#9a8060', 2.0));
    const sun = this.sun = new THREE.DirectionalLight('#fff0d5', 2.3);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.00015; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2;
    this.scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#e6edff', 0.7); fill.position.set(-12, 16, -10); this.scene.add(fill);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.walkers = []; this.playing = false; this.pov = false; this.lowWalls = false;
    this.clock = new THREE.Clock();
    new ResizeObserver(() => this.resize()).observe(host);
    r.setAnimationLoop(() => this.tick());
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  build(plan) {
    this.plan = plan;
    this.root.traverse(o => o.geometry?.dispose()); // textures/materials are cached in models.js
    this.root.clear(); this.walkers = [];
    this.labels = new THREE.Group(); this.root.add(this.labels); // hidden in walking view
    const b = bounds(plan), cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2, W = b.x1 - b.x0, D = b.y1 - b.y0;
    const wallH = this.lowWalls ? 1.2 : Math.max(3, ...plan.items.filter(i => i.type === 'wall').map(i => i.height));

    // outside ground everywhere, timber floor only inside closed walls
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(W + 20, D + 20), M.mat('#a9b59a', { roughness: 0.95 }));
    outside.rotation.x = -Math.PI / 2; outside.position.set(cx, 0, cz); outside.receiveShadow = true; this.root.add(outside);
    for (const w of plan.items.filter(i => i.type === 'wall' && i.closed && i.pts.length > 2)) {
      const floor = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(w.pts.map(p => new THREE.Vector2(p.x, -p.y)))), hallFloor(1, 1));
      floor.rotation.x = -Math.PI / 2; floor.position.y = 0.008; floor.receiveShadow = true; this.root.add(floor);
    }

    const s = this.sun, R = Math.max(W, D);
    s.position.set(cx + R * 0.4, R * 1.2, cz + R * 0.6); s.target.position.set(cx, 0, cz);
    Object.assign(s.shadow.camera, { left: -R, right: R, top: R, bottom: -R, far: R * 4 }); s.shadow.camera.updateProjectionMatrix();

    for (const it of plan.items) {
      if (it.type === 'wall') { this.wall(it, wallH); continue; }
      if (it.type === 'path') { this.path(it); continue; }
      const y = it.type === 'stage' || it.type === 'steps' ? 0 : elevAt(plan, it.x, it.y);
      const place = o => { o.position.set(it.x, y, it.y); o.rotation.y = -(it.rot || 0) * Math.PI / 180; this.root.add(o); return o; };
      if (it.type === 'chairs') this.chairs(it, place);
      else { const o = M.build(it, wallH, this.lowWalls, SURFACES); if (o) place(o); }
      const text = it.type === 'chairs' ? `${it.label || 'Kerusi'} (${it.rows * it.cols})` : it.label;
      if (text) {
        const sp = M.labelSprite(text, it.type === 'label' ? it.color : '#0f172a');
        sp.position.set(it.x, y + ({ zone: 0.6, label: 0.6, ground: 0.6, canopy: 4.2, tree: 4.5 }[it.type] ?? (it.type === 'stage' ? it.height + 0.4 : 2.3)), it.y);
        this.labels.add(sp);
      }
    }
    if (!this.framed) { this.frame(); this.framed = true; }
  }

  frame() {
    const b = bounds(this.plan), cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2, R = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    this.controls.target.set(cx, 0, cz);
    this.camera.position.set(cx + R * 0.35, R * 0.75, b.y1 + R * 0.45);
    this.controls.update();
  }

  wall(it, wallH) {
    const h = this.lowWalls ? wallH : it.height;
    for (const [a, b] of polySegs(it)) {
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const m = new THREE.Mesh(new THREE.BoxGeometry(L + it.thick, h, it.thick), M.mat('#' + new THREE.Color(it.color).lerp(new THREE.Color('#f3ecdc'), 0.6).getHexString(), { roughness: 0.94 }));
      m.position.set((a.x + b.x) / 2, h / 2, (a.y + b.y) / 2); m.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
      m.castShadow = m.receiveShadow = true; this.root.add(m);
    }
  }

  chairs(it, place) {
    // One InstancedMesh per chair part keeps hundreds of chairs cheap.
    const proto = M.chair(it.style, it.color); proto.updateMatrixWorld(true);
    const g = new THREE.Group(), seats = chairLayout(it).seats, t = new THREE.Matrix4();
    proto.traverse(o => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry.clone().applyMatrix4(o.matrixWorld), o.material, seats.length);
      seats.forEach((s, i) => im.setMatrixAt(i, t.makeTranslation(s.x, 0, s.y)));
      im.castShadow = im.receiveShadow = true; g.add(im);
    });
    place(g);
  }

  path(it) {
    // densify so the walker and arrows climb steps smoothly
    const pts = [];
    for (const [a, b] of polySegs(it)) {
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.2));
      for (let i = 0; i < n; i++) { const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n; pts.push(new THREE.Vector3(x, elevAt(this.plan, x, y) + 0.03, y)); }
    }
    const last = it.pts.at(-1); pts.push(new THREE.Vector3(last.x, elevAt(this.plan, last.x, last.y) + 0.03, last.y));
    if (pts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, 0.05, 6), M.mat(it.color, { emissive: it.color, emissiveIntensity: 0.4 }));
    this.root.add(tube);
    const len = curve.getLength(), arrow = new THREE.ConeGeometry(0.16, 0.4, 3); arrow.rotateX(Math.PI / 2);
    const arrows = new THREE.InstancedMesh(arrow, M.mat(it.color, { emissive: it.color, emissiveIntensity: 0.5 }), Math.floor(len / 1.2));
    this.root.add(arrows);
    for (const p of it.pts) if (p.t) {
      const sp = M.labelSprite(p.t, it.color); sp.scale.multiplyScalar(0.8);
      sp.position.set(p.x, elevAt(this.plan, p.x, p.y) + 2.0, p.y); this.labels.add(sp);
    }
    const walker = M.person(it.color); this.root.add(walker);
    this.walkers.push({ curve, len, arrows, walker, u: 0 });
    this.placeArrows(this.walkers.at(-1), 0);
  }

  placeArrows(w, phase) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < w.arrows.count; i++) {
      const u = ((i * 1.2 + phase) % w.len) / w.len, p = w.curve.getPointAt(u), d = w.curve.getTangentAt(u);
      q.setFromUnitVectors(z, d.setY(0).normalize()); p.y += 0.12;
      w.arrows.setMatrixAt(i, m.compose(p, q, one));
    }
    w.arrows.instanceMatrix.needsUpdate = true;
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.playing) this.t = (this.t || 0) + dt;
    for (const w of this.walkers) {
      if (this.playing) { w.u = (w.u + dt * 1.1 / w.len) % 1; this.placeArrows(w, (this.t * 1.1) % 1.2); }
      const p = w.curve.getPointAt(w.u), d = w.curve.getTangentAt(w.u);
      w.walker.position.set(p.x, p.y - 0.03, p.z); w.walker.rotation.y = Math.atan2(-d.x, -d.z);
      w.walker.visible = this.playing && !this.pov;
    }
    if (this.labels) this.labels.visible = !this.pov;
    const w = this.pov && this.walkers[this.povIndex || 0];
    if (w) {
      const p = w.curve.getPointAt(w.u), ahead = w.curve.getPointAt(Math.min(1, w.u + 2 / w.len));
      this.camera.position.set(p.x, p.y + 1.55, p.z); this.camera.lookAt(ahead.x, ahead.y + 1.4, ahead.z);
    } else this.controls.update();
    if (this.host.clientWidth) this.renderer.render(this.scene, this.camera);
  }

  setPov(on, index = 0) {
    this.pov = on; this.povIndex = index; this.controls.enabled = !on;
    if (on) this.playing = true; else this.frame();
  }

  png() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); }
}

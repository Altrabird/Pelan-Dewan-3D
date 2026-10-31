// Animated people built from CC0 Quaternius assets (see art/build_people.py and CREDITS.md).
// Walkers are full skinned characters playing the Universal Animation Library walk cycles; the seated audience is
// a low-poly body baked once into the sitting pose and instanced per clothing region, coloured per role.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const DIR = 'assets/people/';
const SKIN = '#c58c62', SEAT_H = 0.45;
// Clothing colours per role. sleeve: null = short sleeves (skin shows).
const ROLES = {
  muridL:  { body: 'male', kid: true, Top: '#f8fafc', Sleeve: null, Bottom: '#1e3a8a' },
  muridP:  { body: 'female', kid: true, Top: '#f8fafc', Sleeve: '#f8fafc', Bottom: '#1e3a8a', Tudung: '#f8fafc' },
  guruL:   { body: 'male', Top: ['#0e7490', '#7c2d12', '#4d7c0f', '#1d4ed8', '#9f1239'], Sleeve: null, Bottom: '#1f2937' },
  guruP:   { body: 'female', Top: ['#be185d', '#0f766e', '#7e22ce', '#c2410c', '#0369a1'], Sleeve: 'top', Bottom: 'top', Tudung: ['#fbcfe8', '#fde68a', '#e9d5ff', '#1e293b', '#bae6fd'] },
  awamL:   { body: 'male', Top: ['#e2e8f0', '#334155', '#0f766e', '#b45309', '#1e40af', '#991b1b'], Sleeve: null, Bottom: ['#1f2937', '#78716c', '#1e3a8a'] },
  awamP:   { body: 'female', Top: ['#f472b6', '#a3e635', '#38bdf8', '#fbbf24', '#c084fc', '#f87171'], Sleeve: 'top', Bottom: 'top', Tudung: ['#1e293b', '#fef3c7', '#e0e7ff', '#7f1d1d', '#d1fae5'] },
  vipL:    { body: 'male', Top: ['#1e3a8a', '#14532d', '#581c87', '#0f172a'], Sleeve: 'top', Bottom: 'top', songkok: true },
  vipP:    { body: 'female', Top: ['#7f1d1d', '#1e3a8a', '#365314'], Sleeve: 'top', Bottom: 'top', Tudung: ['#fde68a', '#f5f5f4', '#fecaca'] },
};

// Which pair of roles sits in a chair block, from its label / chair style.
export function rolesFor(label = '', style = '') {
  const s = label.toLowerCase();
  if (style === 'vip' || /vip|kehormat|jemputan khas/.test(s)) return ['vipL', 'vipP'];
  if (/guru|cikgu|staf/.test(s)) return ['guruL', 'guruP'];
  if (/murid|pelajar|penerima|pengawas|kanopi/.test(s)) return ['muridL', 'muridP'];
  return ['awamL', 'awamP'];
}

const pick = (v, n) => Array.isArray(v) ? v[n % v.length] : v;
function colours(role, n) { // resolved region colours for person n of a role
  const r = ROLES[role], top = pick(r.Top, n);
  const res = (v) => v === 'top' ? top : v === null ? SKIN : pick(v, n);
  return { Top: top, Sleeve: res(r.Sleeve), Bottom: res(r.Bottom), Tudung: r.Tudung ? pick(r.Tudung, n) : null };
}

let assets = null, loading = null;
export const ready = () => !!assets;
export function load() {
  if (loading) return loading;
  const gl = new GLTFLoader(), get = f => gl.loadAsync(DIR + f);
  loading = Promise.all(['male.glb', 'female.glb', 'male_lod.glb', 'female_lod.glb', 'anims.glb'].map(get)).then(([m, f, ml, fl, a]) => {
    const clips = Object.fromEntries(a.animations.map(c => [c.name, c]));
    assets = { full: { male: m.scene, female: f.scene }, clips, seated: { male: bakeSeated(ml.scene, clips), female: bakeSeated(fl.scene, clips) } };
  });
  return loading;
}

function regionOf(mat) { return ['Top', 'Sleeve', 'Bottom', 'Tudung'].includes(mat.name) ? mat.name : null; }

// Pose a skinned scene on the first frame of the sitting clip and bake it into static geometry per material.
// Result is in "seat space": front = -z, seat contact at y = 0, hips slightly behind the seat centre.
function bakeSeated(scene, clips) {
  const root = SkeletonUtils.clone(scene), mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clips.Sitting_Idle_Loop).play(); mixer.update(0);
  root.rotation.y = Math.PI; // assets face +z, planner front is -z
  root.updateMatrixWorld(true);
  const parts = [], v = new THREE.Vector3(), thigh = new THREE.Vector3(), pelvis = new THREE.Vector3();
  root.getObjectByName('thigh_l').getWorldPosition(thigh);
  root.getObjectByName('pelvis').getWorldPosition(pelvis);
  const shift = new THREE.Vector3(-pelvis.x, -(thigh.y - 0.09), 0.04 - pelvis.z);
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const src = o.geometry, n = src.attributes.position.count, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld).add(shift); v.toArray(pos, i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (src.attributes.uv) g.setAttribute('uv', src.attributes.uv);
    g.setIndex(src.index); g.computeVertexNormals();
    const region = regionOf(o.material), material = o.material.clone();
    material.vertexColors = false; // the baked geometry carries no colour attribute
    if (region) material.color.set('#ffffff'); // tinted per instance
    parts.push({ geometry: g, material, region });
  });
  return parts;
}

// seats: [{x, y (floor height), z, rot (radians), role, n}] → Group of InstancedMeshes.
export function crowd(seats) {
  const g = new THREE.Group(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  for (const body of ['male', 'female']) {
    const list = seats.filter(s => ROLES[s.role].body === body);
    if (!list.length) continue;
    for (const part of assets.seated[body]) {
      const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      list.forEach((s, i) => {
        const k = ROLES[s.role].kid ? 0.78 : 1;
        im.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, s.y + (s.seatH ?? SEAT_H), s.z), q.setFromAxisAngle(up, s.rot), new THREE.Vector3(k, k, k)));
        if (part.region) im.setColorAt(i, c.set(colours(s.role, s.n)[part.region] || SKIN));
      });
      im.receiveShadow = true; // no cast shadows: halves the cost of a full hall
      g.add(im);
    }
  }
  return g;
}

// A walking person: { object, mixer }. object faces -z like every planner model.
export function walker(role, n = 0) {
  const r = ROLES[role], src = assets.full[r.body], inner = SkeletonUtils.clone(src), col = colours(role, n);
  inner.rotation.y = Math.PI;
  inner.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    const region = regionOf(o.material);
    if (region && col[region]) { o.material = o.material.clone(); o.material.color.set(col[region]); }
  });
  if (r.songkok) {
    const head = inner.getObjectByName('Head'), s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.105, 0.12, 24), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6 }));
    inner.updateMatrixWorld(true);
    let skin = null;
    inner.traverse(o => { if (o.isMesh && o.material.name === 'Hair') o.visible = false; if (o.isSkinnedMesh && o.material.name === 'Skin') skin = o; }); // songkok replaces the hair
    const top = new THREE.Box3().setFromObject(skin).max.y;
    s.position.copy(head.worldToLocal(new THREE.Vector3(0, top - 0.03, 0.01)));
    s.quaternion.copy(head.getWorldQuaternion(new THREE.Quaternion()).invert());
    head.add(s);
    // samping: songket wrap from waist to knee, attached to the hips so it follows the walk
    const pelvis = inner.getObjectByName('pelvis'), hip = pelvis.getWorldPosition(new THREE.Vector3());
    const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.185, 0.32, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#a8740a', roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide }));
    sm.position.copy(pelvis.worldToLocal(new THREE.Vector3(hip.x, hip.y - 0.12, hip.z)));
    sm.quaternion.copy(pelvis.getWorldQuaternion(new THREE.Quaternion()).invert());
    pelvis.add(sm);
  }
  const object = new THREE.Group(); object.add(inner);
  if (r.kid) object.scale.setScalar(0.78);
  const mixer = new THREE.AnimationMixer(inner);
  mixer.clipAction(assets.clips[role.startsWith('vip') ? 'Walk_Formal_Loop' : 'Walk_Loop']).play();
  return { object, mixer };
}

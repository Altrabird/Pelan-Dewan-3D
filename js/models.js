// Procedural hall furniture. Origin on floor; +y up; front = -z.
import * as THREE from 'three';

const mats = new Map();
export function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.72, ...opts }));
  return mats.get(k);
}
// Fixed artwork is shared. build() disposes maps, so request upload again on reuse.
const artwork = new Map();
function surface(key, draw, opts = {}) {
  if (!artwork.has(key)) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    draw(c.getContext('2d'), c.width, c.height);
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    artwork.set(key, new THREE.MeshStandardMaterial({ map, roughness: 0.75, ...opts }));
  }
  const material = artwork.get(key); material.map.needsUpdate = true; return material;
}
function box(g, w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color, opts) : color);
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function cyl(g, rt, rb, h, color, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function ellipsoid(g, x, y, z, sx, sy, sz, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(color));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function face(g, w, h, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.rotation.y = Math.PI; m.position.set(x, y, z); g.add(m); return m;
}
function pleats(g, w, h, d, color, bottom = 0) {
  // A single folded perimeter mesh, contained inside the requested footprint.
  const positions = [], indices = [];
  const sides = [[-w/2,-d/2,w/2,-d/2,0,1],[w/2,-d/2,w/2,d/2,-1,0],[w/2,d/2,-w/2,d/2,0,-1],[-w/2,d/2,-w/2,-d/2,1,0]];
  for (const [ax,az,bx,bz,nx,nz] of sides) {
    const n = Math.max(2, Math.ceil(Math.hypot(bx-ax,bz-az)/0.12));
    for(let i=0;i<n;i++) {
      const base=positions.length/3;
      for(const [t,y] of [[i/n,bottom],[(i+1)/n,bottom],[i/n,bottom+h],[(i+1)/n,bottom+h]]) {
        const inset = Math.min(0.025,w/10,d/10) * (Math.round(t*n)%2);
        positions.push(ax+(bx-ax)*t+nx*inset,y,az+(bz-az)*t+nz*inset);
      }
      indices.push(base,base+2,base+1,base+1,base+2,base+3);
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geo.setIndex(indices); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo,mat(color,{side:THREE.DoubleSide})); m.castShadow=m.receiveShadow=true; g.add(m);
}
function timber(color) {
  const base = surface('timber',(c,w,h)=>{
    c.fillStyle='#9c673e';c.fillRect(0,0,w,h);
    for(let j=0;j<8;j++) {
      c.fillStyle=['#a77449','#b78352','#94603a','#ad794b'][j%4];c.fillRect(0,j*64,w,63);
      for(let i=0;i<24;i++) { c.strokeStyle='rgba(55,27,12,.09)'; c.beginPath(); c.moveTo(0,j*64+i*2.6); c.bezierCurveTo(280,j*64+i*2.6+5,700,j*64+i*2.6-4,w,j*64+i*2.6); c.stroke(); }
      c.fillStyle='#704728';c.fillRect((j%3)*320,j*64,2,64);
    }
  });
  if (!color) return base;
  const key = 'timber:' + color;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ map: base.map, color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.55), roughness: 0.75 }));
  return mats.get(key);
}

export function chair(style, color) {
  const g = new THREE.Group();
  if (style === 'banquet') {
    box(g,0.42,0.41,0.42,'#eee9dd',0,0.02);
    box(g,0.44,0.04,0.44,'#fffaf0',0,0.43);
    box(g,0.44,0.45,0.06,'#fffaf0',0,0.47,0.19);
    ellipsoid(g,0,0.91,0.19,0.22,0.04,0.03,'#fffaf0');
    box(g,0.45,0.11,0.075,color,0,0.65,0.19);
    ellipsoid(g,-0.075,0.70,0.24,0.085,0.045,0.025,color).rotation.z=-0.3;
    ellipsoid(g,0.075,0.70,0.24,0.085,0.045,0.025,color).rotation.z=0.3;
    box(g,0.04,0.16,0.025,color,0,0.55,0.24);
    // Subtle folds suggest the white slipcover without per-chair textures.
    for(const x of [-0.15,0.15]) box(g,0.016,0.36,0.012,'#ded8cb',x,0.03,-0.207);
  } else if (style === 'vip') {
    for(const x of [-0.23,0.23]) for(const z of [-0.2,0.2]) box(g,0.05,0.12,0.05,'#513a29',x,0,z);
    box(g,0.6,0.3,0.55,color,0,0.12);
    box(g,0.45,0.08,0.42,color,0,0.42,-0.035,{roughness:0.95});
    box(g,0.6,0.46,0.12,color,0,0.42,0.215);
    box(g,0.44,0.31,0.04,color,0,0.5,0.14);
    for(const x of [-0.26,0.26]) box(g,0.08,0.21,0.5,color,x,0.42);
    box(g,0.5,0.018,0.012,'#c6a56a',0,0.17,-0.276);
  } else {
    for(const x of [-0.18,0.18]) for(const z of [-0.18,0.18]) {
      const leg=box(g,0.035,0.43,0.035,color,x,0,z);leg.rotation.z=-x*0.18;
    }
    box(g,0.44,0.045,0.42,color,0,0.43,0,{roughness:0.48});
    // Open slots in a moulded back, with a softly curved top rail.
    for(const x of [-0.18,0,0.18]) box(g,0.065,0.31,0.035,color,x,0.47,0.19);
    box(g,0.43,0.075,0.04,color,0,0.76,0.19);
    box(g,0.4,0.055,0.035,color,0,0.49,0.19);
  }
  return g;
}

export function person(color) {
  const g=new THREE.Group(), skin='#c88f64';
  for(const x of [-0.085,0.085]) {
    cyl(g,0.065,0.055,0.72,'#34394a',x,0.07);
    ellipsoid(g,x,0.065,-0.045,0.075,0.065,0.13,'#292a30');
    cyl(g,0.065,0.05,0.44,color,x*2.5,0.88);
    ellipsoid(g,x*2.5,0.86,0,0.052,0.07,0.055,skin);
  }
  cyl(g,0.19,0.16,0.59,color,0,0.75);
  box(g,0.018,0.44,0.012,'#e9dac0',0,0.84,-0.164);
  cyl(g,0.065,0.065,0.1,skin,0,1.34);
  ellipsoid(g,0,1.54,0,0.135,0.16,0.125,skin);
  ellipsoid(g,0,1.64,0.018,0.138,0.075,0.12,'#30251f');
  ellipsoid(g,0,1.52,-0.12,0.025,0.03,0.035,skin);
  for(const x of [-0.045,0.045]) ellipsoid(g,x,1.57,-0.116,0.012,0.013,0.009,'#382a24');
  return g;
}
function stage(it) {
  const g=new THREE.Group(), lip=Math.min(0.06,it.height);
  box(g,it.w,it.height,it.h,'#583136');
  pleats(g,it.w,it.height-lip,it.h,'#71393c');
  box(g,it.w,lip,it.h,timber(it.color),0,it.height-lip);
  box(g,it.w,Math.min(0.018,lip),0.012,'#d7b776',0,it.height-lip,-it.h/2+0.006);
  return g;
}
function steps(it) {
  const g=new THREE.Group(),n=Math.max(2,Math.round(it.height/0.18)),rise=it.height/n,run=it.h/n;
  for(let i=0;i<n;i++) {
    const z=it.h/2-run*(i+0.5), h=rise*(i+1);
    box(g,it.w,h,run,timber(it.color),0,0,z);
    box(g,it.w,Math.min(0.018,rise),Math.min(0.045,run),'#d5bd87',0,h-Math.min(0.018,rise),z+run/2-Math.min(0.045,run)/2);
  }
  return g;
}
function sofa(it) {
  const g=new THREE.Group(),w=it.w,d=it.h;
  box(g,w*0.9,0.12,d*0.85,'#503525');
  box(g,w,0.3,d,it.color,0,0.12);
  box(g,w,0.45,0.18,it.color,0,0.42,d/2-0.09);
  for(const x of [-w/2+0.08,w/2-0.08]) box(g,0.16,0.22,d,it.color,x,0.42);
  const n=Math.max(1,Math.round(w/0.8)),cw=(w-0.36)/n;
  for(let i=0;i<n;i++) {
    const x=-w/2+0.18+cw*(i+0.5);
    box(g,cw-0.025,0.1,d-0.25,it.color,x,0.42,-0.045,{roughness:0.95});
    box(g,cw-0.035,0.3,0.06,it.color,x,0.53,d/2-0.21);
  }
  box(g,w-0.08,0.02,0.012,'#c7a463',0,0.17,-d/2-0.006);
  return g;
}
function table(it,round) {
  const g=new THREE.Group();
  if(round) {
    const geo=new THREE.CylinderGeometry(it.w/2,it.w/2,0.7,64,1,true);
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i++) { const a=Math.atan2(p.getZ(i),p.getX(i)),r=1-0.018*(0.5+0.5*Math.cos(a*32));p.setX(i,p.getX(i)*r);p.setZ(i,p.getZ(i)*r); }
    geo.computeVertexNormals(); const skirt=new THREE.Mesh(geo,mat(it.color,{side:THREE.DoubleSide}));skirt.position.y=0.39;skirt.castShadow=skirt.receiveShadow=true;g.add(skirt);
    cyl(g,it.w/2+0.02,it.w/2+0.02,0.03,'#fff8e9',0,0.74,0,48);
  } else {
    box(g,it.w,0.7,it.h,it.color,0,0.04);
    pleats(g,it.w,0.7,it.h,it.color,0.04);
    box(g,it.w+0.04,0.03,it.h+0.04,'#fff8e9',0,0.74);
    box(g,it.w,0.05,0.012,'#dbc89e',0,0.67,-it.h/2-0.006);
  }
  return g;
}
function rostrum(it) {
  const g=new THREE.Group();
  box(g,it.w,0.08,it.h,'#493020');
  box(g,it.w*0.9,1.02,it.h*0.86,timber(it.color),0,0.08);
  box(g,it.w,0.06,it.h,'#593923',0,1.1);
  const crest=surface('crest',(c,w,h)=>{
    c.fillStyle='#d4b267';c.fillRect(0,0,w,h);c.strokeStyle='#70531c';c.lineWidth=12;c.strokeRect(22,22,w-44,h-44);
    c.beginPath();c.moveTo(w/2,70);c.lineTo(w/2+110,105);c.lineTo(w/2+90,280);c.lineTo(w/2,340);c.lineTo(w/2-90,280);c.lineTo(w/2-110,105);c.closePath();c.stroke();
    c.font='bold 100px Georgia';c.textAlign='center';c.fillStyle='#70531c';c.fillText('SK',w/2,240);
    c.font='bold 45px sans-serif';c.fillText('BANDAR TAWAU',w/2,435);
  },{metalness:0.35,roughness:0.45});
  face(g,it.w*0.62,0.35,0,0.73,-it.h*0.43-0.002,crest);
  const mic=cyl(g,0.012,0.012,0.27,'#24282a',0,1.16,-it.h/4,8);mic.rotation.x=-0.3;
  ellipsoid(g,0,1.42,-it.h/4-0.04,0.025,0.025,0.045,'#24282a');
  return g;
}
function screen(it) {
  const g=new THREE.Group();
  box(g,it.w,3.2,it.h,'#202832',0,0.3);
  const led=surface('ceremony',(c,w,h)=>{
    const grad=c.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#102d3c');grad.addColorStop(1,'#234b53');c.fillStyle=grad;c.fillRect(0,0,w,h);
    c.strokeStyle='#bfa46a';c.lineWidth=3;c.strokeRect(24,24,w-48,h-48);c.strokeRect(34,34,w-68,h-68);
    for(let i=0;i<14;i++){c.strokeStyle='rgba(217,187,113,.16)';c.beginPath();c.arc(w,h,100+i*35,Math.PI,Math.PI*1.5);c.stroke();}
    c.textAlign='center';c.fillStyle='#ead9ae';c.font='24px sans-serif';c.fillText('M E R A I K A N   K E C E M E R L A N G A N',w/2,135);
    c.font='bold 70px Georgia';c.fillText('MAJLIS ANUGERAH',w/2,250);
    c.fillRect(w/2-90,284,180,3);c.font='32px sans-serif';c.fillStyle='#fff6e4';c.fillText('SK BANDAR TAWAU',w/2,350);
    c.font='24px sans-serif';c.fillText('Dewan Sri Pekan',w/2,405);
  },{emissive:'#153f48',emissiveIntensity:0.15,roughness:0.55});
  face(g,it.w-0.2,2.9,0,1.9,-it.h/2-0.011,led);
  for(const x of [-it.w/2+0.3,it.w/2-0.3]) box(g,0.1,0.3,0.1,'#414956',x);
  return g;
}
function flag(it) {
  const g=new THREE.Group();cyl(g,0.18,0.23,0.08,'#55483a');cyl(g,0.018,0.022,2.4,'#c6b17d');ellipsoid(g,0,2.43,0,0.04,0.04,0.04,'#d7b65e');
  const fabric=surface('jalur-gemilang',(c,w,h)=>{
    for(let i=0;i<14;i++){c.fillStyle=i%2?'#fffdf5':'#c92436';c.fillRect(0,i*h/14,w,h/14+1);}
    c.fillStyle='#082c83';c.fillRect(0,0,w/2,h*8/14);
    const cy=h*4/14;c.fillStyle='#ffdc37';c.beginPath();c.arc(168,cy,103,0,Math.PI*2);c.fill();
    c.fillStyle='#082c83';c.beginPath();c.arc(197,cy-9,89,0,Math.PI*2);c.fill();
    c.fillStyle='#ffdc37';c.beginPath();for(let i=0;i<28;i++){const a=-Math.PI/2+i*Math.PI/14,r=i%2?40:91;const x=355+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();
  },{side:THREE.DoubleSide,roughness:1});
  const f=face(g,0.9,0.45,0.46,2.125,-0.01,fabric);f.castShadow=false;
  return g;
}
function plant(it) {
  const g=new THREE.Group(),r=it.w/2;
  cyl(g,r*0.72,r*0.5,0.42,'#996149');cyl(g,r*0.77,r*0.77,0.07,'#ba8260',0,0.39);cyl(g,r*0.65,r*0.65,0.012,'#463829',0,0.46);
  for(let i=0;i<9;i++) {const a=i*2.4,y=0.62+(i%3)*0.13;const leaf=ellipsoid(g,Math.cos(a)*r*0.42,y,Math.sin(a)*r*0.42,r*0.24,r*0.82,r*0.16,i%3?'#3e7546':it.color);leaf.rotation.set(Math.sin(a)*0.5,0,-Math.cos(a)*0.5);}
  return g;
}
function speaker(it) {
  const g=new THREE.Group();cyl(g,0.025,0.025,1.3,'#3b4146',0,0,0,8);cyl(g,Math.min(it.w, it.h)*0.45,Math.min(it.w,it.h)*0.45,0.035,'#30353b');
  box(g,it.w,0.75,it.h*0.8,it.color,0,1.2);
  box(g,it.w*0.88,0.66,0.012,'#32373d',0,1.245,-it.h*0.4-0.006);
  for(const [y,r] of [[1.43,Math.min(it.w*0.31,0.17)],[1.77,Math.min(it.w*0.16,0.09)]]) {const cone=cyl(g,r,r,0.014,'#161c22',0,y,-it.h*0.4-0.018,20);cone.rotation.x=Math.PI/2;}
  return g;
}
function camera(it) {
  const g=new THREE.Group();
  for(const a of [0,2.1,4.2]) {const l=cyl(g,0.012,0.018,1.45,'#4a5157',Math.sin(a)*0.25,0,Math.cos(a)*0.25,8);l.rotation.set(Math.cos(a)*0.17,0,-Math.sin(a)*0.17);}
  box(g,0.22,0.16,0.3,it.color,0,1.45);box(g,0.11,0.06,0.12,'#30363d',0,1.61,0.03);
  cyl(g,0.065,0.065,0.15,'#242a31',0,1.48,-0.21).rotation.x=Math.PI/2;
  const lens=cyl(g,0.047,0.047,0.008,'#427084',0,1.55,-0.29);lens.rotation.x=Math.PI/2;
  return g;
}
function door(it) {
  const g=new THREE.Group();
  box(g,it.w,2.4,it.h+0.1,it.color);
  for(const x of [-it.w/2+0.045,it.w/2-0.045]) box(g,0.09,2.4,it.h+0.14,'#654631',x);
  box(g,it.w,0.1,it.h+0.14,'#654631',0,2.3);box(g,0.025,2.3,it.h+0.12,'#4c3629');
  for(const side of [-1,1]) {
    for(const z of [-it.h/2-0.056,it.h/2+0.056]) {
      box(g,it.w*0.36,1.55,0.015,timber(),side*it.w*0.25,0.3,z);
      box(g,0.025,0.25,0.05,'#cdb47a',side*0.09,1,z);
    }
  }
  return g;
}
function zone(it) {
  const g=new THREE.Group();
  const m=new THREE.Mesh(new THREE.PlaneGeometry(it.w,it.h),mat(it.color,{transparent:true,opacity:0.16,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=0.012;g.add(m);
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:it.color,transparent:true,opacity:0.65}));e.rotation.x=-Math.PI/2;e.position.y=0.014;g.add(e);return g;
}
// Event canopy (khemah): white pyramid roof on posts with a coloured valance. `open` = see-through roof.
function canopy(it, open) {
  const g = new THREE.Group(), w = it.w, d = it.h, H = 2.5, rise = Math.min(w, d) * 0.22;
  const nx = Math.max(1, Math.round(w / 6)), nz = Math.max(1, Math.round(d / 6)); // extra posts every ~6 m
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++)
    if (i === 0 || i === nx || j === 0 || j === nz) cyl(g, 0.035, 0.035, H, '#cbd5e1', -w / 2 + w * i / nx, 0, -d / 2 + d * j / nz, 8);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1, true).rotateY(Math.PI / 4).scale(w, rise, d),
    mat('#f8fafc', { side: THREE.DoubleSide, transparent: open, opacity: open ? 0.18 : 1, depthWrite: !open }));
  roof.position.y = H + rise / 2; roof.castShadow = !open; roof.receiveShadow = true; g.add(roof);
  for (const [x, z, lw, ld] of [[0, -d / 2, w, 0.02], [0, d / 2, w, 0.02], [-w / 2, 0, 0.02, d], [w / 2, 0, 0.02, d]])
    box(g, lw, 0.3, ld, it.color, x, H - 0.3, z);
  return g;
}

function tree(it) {
  const g = new THREE.Group(), r = it.w / 2;
  cyl(g, 0.12, 0.18, 2.2, '#6b4423', 0, 0, 0, 8);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1).scale(r, r * 0.8, it.h / 2), mat(it.color, { flatShading: true }));
  crown.position.y = 2.2 + r * 0.6; crown.castShadow = true; g.add(crown);
  return g;
}

function ground(it, surfaces) {
  // overlapping areas sit at the same height: smaller ones win the depth test via polygon offset
  const area = it.w * it.h, k = area < 60 ? 3 : area < 400 ? 2 : 1;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(it.w, it.h), mat((surfaces[it.surface] || surfaces.simen)[1], { roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -4 * k }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
}

export function build(it,wallHeight,open=false,surfaces) {
  switch(it.type) {
    case 'canopy':return canopy(it,open); case 'tree':return tree(it); case 'ground':return ground(it,surfaces);
    case 'stage':return stage(it); case 'steps':return steps(it); case 'sofa':return sofa(it);
    case 'table':return table(it,false); case 'round':return table(it,true); case 'rostrum':return rostrum(it);
    case 'screen':return screen(it); case 'flag':return flag(it); case 'plant':return plant(it);
    case 'speaker':return speaker(it); case 'camera':return camera(it); case 'door':return door(it); case 'zone':return zone(it);
    case 'pillar':{const g=new THREE.Group();box(g,it.w,wallHeight,it.h,it.color);box(g,it.w,Math.min(0.18,wallHeight),it.h,'#c8c0ad');box(g,it.w,Math.min(0.12,wallHeight),it.h,'#f2ecde',0,Math.max(0,wallHeight-0.12));return g;}
    default:return null;
  }
}
// Bounded cache: editing arbitrary label text cannot retain canvases indefinitely.
const labelCache=new Map();
export function labelSprite(text,color='#0f172a') {
  const key=JSON.stringify([text,color]);
  if(!labelCache.has(key)) {
    const c=document.createElement('canvas'),x=c.getContext('2d'),size=56;
    x.font='600 '+size+'px Segoe UI, sans-serif';c.width=Math.ceil(x.measureText(text).width)+48;c.height=88;
    x.fillStyle='rgba(255,252,245,.96)';x.beginPath();x.roundRect(1,1,c.width-2,c.height-2,12);x.fill();x.strokeStyle='#cfc8ba';x.lineWidth=2;x.stroke();
    x.fillStyle=color;x.font='600 '+size+'px Segoe UI, sans-serif';x.textBaseline='middle';x.fillText(text,24,44);
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
    labelCache.set(key,new THREE.SpriteMaterial({map,depthTest:false,depthWrite:false,toneMapped:false}));
    if(labelCache.size>192) {const oldest=labelCache.keys().next().value;const old=labelCache.get(oldest);old.map.dispose();old.dispose();labelCache.delete(oldest);}
  }
  const material=labelCache.get(key);material.map.needsUpdate=true;
  const s=new THREE.Sprite(material),c=material.map.image;s.scale.set(c.width/c.height*0.55,0.55,1);s.renderOrder=10;return s;
}

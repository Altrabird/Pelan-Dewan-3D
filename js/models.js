// Procedural hall furniture. Origin on floor; +y up; front = -z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

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

// Shared CPU geometry survives scene disposal; Three reuploads it on the next use.
// Bound size-dependent entries so repeated dimension edits do not grow this cache forever.
const geometries = new Map();
function geometry(key, make) {
  if (!geometries.has(key)) {
    geometries.set(key, make());
    if (geometries.size > 256) geometries.delete(geometries.keys().next().value);
  }
  return geometries.get(key);
}
function mesh(g, geo, color) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
  m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
// One corner segment: 108 triangles. Scaling rounds the silhouette even on thin cushions.
function soft(g,w,h,d,color,x=0,y=0,z=0) {
  const m=mesh(g,geometry('soft',()=>new RoundedBoxGeometry(1,1,1,1,0.16)),color);
  m.scale.set(w,h,d); m.position.set(x,y+h/2,z); return m;
}
function orb(g,x,y,z,sx,sy,sz,color) {
  const m=mesh(g,geometry('orb',()=>new THREE.SphereGeometry(1,8,4)),color);
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;
}
function rod(g,a,b,r,color) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const m=mesh(g,geometry('rod',()=>new THREE.CylinderGeometry(1,1,1,6)),color);
  m.position.copy(start.add(end).multiplyScalar(0.5));m.scale.set(r,delta.length(),r);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
}
// Three joined rings: rounded rectangular cloth, gentle flare and a rippled hem.
function drape(g,w,d,h,color,bottom=0.02,round=false,n=48) {
  const geo=geometry(JSON.stringify(['drape',w,d,h,bottom,round,n]),()=>{
    const p=[],idx=[];
    for(let j=0;j<3;j++) for(let i=0;i<=n;i++) {
      const a=i/n*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
      const power=round?1:0.28;
      const fold=(j===0?0.025:j===1?0.012:0)*(0.5+0.5*Math.cos(a*(n/2)));
      const taper=j===2?0.94:1;
      p.push(Math.sign(c)*Math.pow(Math.abs(c),power)*(w/2-fold)*taper,
        bottom+h*j/2+(j===0?0.007*(1+Math.cos(a*8)):0),
        Math.sign(s)*Math.pow(Math.abs(s),power)*(d/2-fold)*taper);
    }
    for(let j=0;j<2;j++)for(let i=0;i<n;i++) {const a=j*(n+1)+i,b=a+n+1;idx.push(a,b,a+1,a+1,b,b+1);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(idx);geo.computeVertexNormals();return geo;
  });
  return mesh(g,geo,mat(color,{side:THREE.DoubleSide,roughness:1}));
}
function ribbon(g,x,z,angle,color) {
  const geo=geometry('ribbon',()=>{
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-.025,0,0,.025,0,0,-.03,-.10,.012,.03,-.10,.012,-.026,-.18,.025,0,-.155,.025,.026,-.18,.025],3));geo.setIndex([0,2,1,1,2,3,2,4,5,2,5,3,3,5,6]);geo.computeVertexNormals();return geo;
  });
  const m=mesh(g,geo,mat(color,{side:THREE.DoubleSide}));m.position.set(x,.70,z);m.rotation.z=angle;return m;
}

function box(g, w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(geometry(JSON.stringify(['box',w,h,d]),()=>new THREE.BoxGeometry(w,h,d)), typeof color === 'string' ? mat(color, opts) : color);
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function cyl(g, rt, rb, h, color, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(geometry(JSON.stringify(['cylinder',rt,rb,h,seg]),()=>new THREE.CylinderGeometry(rt,rb,h,seg)), typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function ellipsoid(g, x, y, z, sx, sy, sz, color) {
  const m = new THREE.Mesh(geometry('ellipsoid',()=>new THREE.SphereGeometry(1,12,8)), mat(color));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function face(g, w, h, x, y, z, material) {
  const m = new THREE.Mesh(geometry(JSON.stringify(['face',w,h]),()=>new THREE.PlaneGeometry(w,h)), material);
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
    drape(g,.46,.44,.40,'#eee9dd',.025,false,24);
    soft(g,.45,.065,.43,'#fffaf0',0,.415,-.012);
    soft(g,.44,.49,.065,'#fffaf0',0,.44,.175);
    soft(g,.45,.105,.077,color,0,.65,.175);
    for(const side of [-1,1]) {
      orb(g,side*.061,.704,.226,.071,.041,.018,color).rotation.z=side*.3;
      ribbon(g,side*.018,.226,side*.22,color);
    }
    orb(g,0,.704,.229,.026,.029,.02,color);
  } else if (style === 'vip') {
    for(const x of [-.23,.23])for(const z of [-.20,.20])box(g,.045,.13,.045,'#513a29',x,0,z);
    soft(g,.60,.29,.55,color,0,.12);
    soft(g,.43,.10,.43,color,0,.40,-.035);
    soft(g,.58,.47,.14,color,0,.41,.20);
    for(const x of [-.255,.255])soft(g,.12,.23,.52,color,x,.40,-.005);
  } else {
    const plastic=mat(color,{roughness:.48});
    for(const x of [-1,1])for(const z of [-1,1])rod(g,[x*.215,.018,z*.205],[x*.165,.44,z*.155],.018,plastic);
    soft(g,.44,.055,.43,plastic,0,.42,-.012);
    // A single moulded shell with two actual through-slots, bowed around the sitter.
    const shell=geometry('plastic-shell',()=>{
      function outline(x,y,w,h,r) {
        const s=new THREE.Shape();s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
        s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
        s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
      }
      const shape=outline(-.205,0,.41,.35,.045);
      for(const x of [-.105,.045])shape.holes.push(new THREE.Path(outline(x,.075,.06,.20,.025).getPoints(2)));
      const geo=new THREE.ExtrudeGeometry(shape,{depth:.025,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.006,bevelThickness:.004,curveSegments:2});
      const p=geo.attributes.position;
      for(let i=0;i<p.count;i++) {const x=p.getX(i),y=p.getY(i);p.setZ(i,p.getZ(i)+.155+.035*(1-(x/.22)**2)+y*.065);}
      geo.deleteAttribute('normal');geo.deleteAttribute('uv');
      const smooth=mergeVertices(geo);smooth.computeVertexNormals();geo.dispose();return smooth;
    });
    mesh(g,shell,plastic).position.y=.465;
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
  soft(g,w*0.9,0.12,d*0.85,'#503525');
  soft(g,w,0.3,d,it.color,0,0.12);
  soft(g,w,0.45,0.18,it.color,0,0.42,d/2-0.09);
  for(const x of [-w/2+0.08,w/2-0.08]) soft(g,0.16,0.22,d,it.color,x,0.42);
  const n=Math.max(1,Math.round(w/0.8)),cw=(w-0.36)/n;
  for(let i=0;i<n;i++) {
    const x=-w/2+0.18+cw*(i+0.5);
    soft(g,cw-0.025,0.1,d-0.25,it.color,x,0.42,-0.045,{roughness:0.95});
    soft(g,cw-0.035,0.3,0.06,it.color,x,0.53,d/2-0.21);
  }
  soft(g,w-0.08,0.02,0.012,'#c7a463',0,0.17,-d/2-0.006);
  return g;
}
function table(it,round) {
  const g=new THREE.Group();
  drape(g,it.w,it.h,.71,it.color,.025,round,64);
  if(round) {
    const top=mesh(g,geometry('round-cloth-top',()=>new THREE.LatheGeometry([
      new THREE.Vector2(0,0),new THREE.Vector2(.47,0),new THREE.Vector2(.5,-.012),
      new THREE.Vector2(.5,-.028),new THREE.Vector2(.48,-.04)].reverse(),48)), '#fff8e9');
    top.scale.set(it.w,1,it.h);top.position.y=.77;
  } else soft(g,it.w,.045,it.h,'#fff8e9',0,.725);
  return g;
}

function rostrum(it) {
  const g=new THREE.Group();
  soft(g,it.w,0.08,it.h,'#493020');
  soft(g,it.w*0.9,1.02,it.h*0.86,timber(it.color),0,0.08);
  soft(g,it.w,0.06,it.h,'#593923',0,1.1);
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
  soft(g,it.w,3.2,it.h,'#202832',0,0.3);
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
  for(const x of [-it.w/2+0.3,it.w/2-0.3]) soft(g,0.1,0.3,0.1,'#414956',x);
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
  const pot=mesh(g,geometry('pot',()=>new THREE.LatheGeometry([
    new THREE.Vector2(.48,0),new THREE.Vector2(.53,.025),new THREE.Vector2(.69,.36),
    new THREE.Vector2(.77,.395),new THREE.Vector2(.77,.445),new THREE.Vector2(.71,.46),
    new THREE.Vector2(.65,.44)],16)),'#ad7657');pot.scale.set(r,1,r);cyl(g,r*0.65,r*0.65,0.012,'#463829',0,0.46);
  for(let i=0;i<9;i++) {const a=i*2.4,y=0.62+(i%3)*0.13;const leaf=ellipsoid(g,Math.cos(a)*r*0.42,y,Math.sin(a)*r*0.42,r*0.24,r*0.82,r*0.16,i%3?'#3e7546':it.color);leaf.rotation.set(Math.sin(a)*0.5,0,-Math.cos(a)*0.5);}
  return g;
}
function speaker(it) {
  const g=new THREE.Group();cyl(g,0.025,0.025,1.3,'#3b4146',0,0,0,8);cyl(g,Math.min(it.w, it.h)*0.45,Math.min(it.w,it.h)*0.45,0.035,'#30353b');
  soft(g,it.w,0.75,it.h*0.8,it.color,0,1.2);
  soft(g,it.w*0.88,0.66,0.012,'#32373d',0,1.245,-it.h*0.4-0.006);
  for(const [y,r] of [[1.43,Math.min(it.w*0.31,0.17)],[1.77,Math.min(it.w*0.16,0.09)]]) {const cone=cyl(g,r,r,0.014,'#161c22',0,y,-it.h*0.4-0.018,20);cone.rotation.x=Math.PI/2;}
  return g;
}
function camera(it) {
  const g=new THREE.Group();
  for(const a of [0,Math.PI*2/3,Math.PI*4/3]) {
    const x=Math.sin(a)*Math.min(.30,it.w*.45),z=Math.cos(a)*Math.min(.30,it.h*.45);
    rod(g,[x,.025,z],[0,1.40,0],.014,'#4a5157');
    rod(g,[x*.55,.65,z*.55],[0,.80,0],.008,'#727b83');
  }
  cyl(g,.045,.045,.10,'#30363d',0,1.35,0,8);
  soft(g,.22,.16,.28,it.color,0,1.45);
  soft(g,.10,.055,.11,'#30363d',0,1.61,.025);
  const lens=cyl(g,.065,.072,.15,'#242a31',0,0,0,16);lens.rotation.x=Math.PI/2;lens.position.set(0,1.53,-.19);
  const glass=cyl(g,.049,.049,.008,'#427084',0,0,0,16);glass.rotation.x=Math.PI/2;glass.position.set(0,1.53,-.27);
  rod(g,[.07,1.40,.03],[.14,1.30,.25],.012,'#30363d');return g;
}

function door(it) {
  const g=new THREE.Group();
  soft(g,it.w,2.4,it.h+0.1,it.color);
  for(const x of [-it.w/2+0.045,it.w/2-0.045]) soft(g,0.09,2.4,it.h+0.14,'#654631',x);
  soft(g,it.w,0.1,it.h+0.14,'#654631',0,2.3);soft(g,0.025,2.3,it.h+0.12,'#4c3629');
  for(const side of [-1,1]) {
    for(const z of [-it.h/2-0.056,it.h/2+0.056]) {
      soft(g,it.w*0.36,1.55,0.015,timber(),side*it.w*0.25,0.3,z);
      soft(g,0.025,0.25,0.05,'#cdb47a',side*0.09,1,z);
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
  const roofGeo=geometry(JSON.stringify(['roof',w,d]),()=>{
    const p=[],idx=[],corners=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
    // Four fabric panels, each with a shallow concave profile from peak to eave.
    for(let side=0;side<4;side++) {
      const [ax,az]=corners[side],[bx,bz]=corners[(side+1)%4],base=p.length/3;
      for(let j=0;j<=4;j++)for(let i=0;i<=4;i++) {
        const t=j/4,u=i/4;
        p.push((ax+(bx-ax)*u)*t,H+rise*(1-t)-rise*.10*Math.sin(Math.PI*t), (az+(bz-az)*u)*t);
      }
      for(let j=0;j<4;j++)for(let i=0;i<4;i++){const k=base+j*5+i;idx.push(k,k+5,k+1,k+1,k+5,k+6);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(idx);geo.computeVertexNormals();return geo;
  });
  const roof=mesh(g,roofGeo,mat('#f8fafc',{side:THREE.DoubleSide,transparent:open,opacity:open?.18:1,depthWrite:!open}));roof.castShadow=!open;
  const valance=geometry(JSON.stringify(['valance',w,d]),()=>{
    const p=[],idx=[],corners=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
    for(let side=0;side<4;side++) {
      const [ax,az]=corners[side],[bx,bz]=corners[(side+1)%4];
      const scallops=Math.max(2,Math.round(Math.hypot(bx-ax,bz-az)/.45)),n=scallops*6,base=p.length/3;
      for(let i=0;i<=n;i++) {
        const t=i/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
        p.push(x,H,z,x,H-.17-.10*Math.sin(Math.PI*(i%6)/6),z);
      }
      for(let i=0;i<n;i++){const k=base+i*2;idx.push(k,k+1,k+2,k+2,k+1,k+3);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(idx);geo.computeVertexNormals();return geo;
  });
  mesh(g,valance,mat(it.color,{side:THREE.DoubleSide,roughness:1}));
  return g;
}

function tree(it) {
  const g=new THREE.Group(),r=it.w/2,d=it.h/2;
  cyl(g,.10,.17,2.4,'#6b4423',0,0,0,8);
  for(const s of [-1,1])rod(g,[0,1.45,0],[s*r*.40,2.5,0],.06,'#6b4423');
  orb(g,0,2.3+r*.55,0,r*.86,r*.68,d*.86,it.color);
  for(let i=0;i<3;i++) {
    const a=i*Math.PI*2/3;
    orb(g,Math.cos(a)*r*.35,2.2+r*.32,Math.sin(a)*d*.35,r*.60,r*.48,d*.60,it.color);
  }
  orb(g,-r*.12,2.4+r*.94,0,r*.58,r*.49,d*.58,it.color);return g;
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

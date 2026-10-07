import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './util.js';
import { scramblePhase, CORNERS, WALKS, HACHIKO, YAMA, JR_PLAT, GINZA, at } from './geo.js';

const R = rng(1234);
const TOPS = [0x1b1b1d, 0x22324a, 0x3b3b3e, 0xe9e7e2, 0xc8b89c, 0x7d6b55, 0x5c6b4a, 0x8a1f2b, 0x2f5d8c, 0xf2f2f2, 0x111111, 0x6b7f99, 0xd9a3b5, 0xa49480];
const BOTS = [0x1a1a1c, 0x24324a, 0x3d4f6b, 0x2b2b2e, 0xc7b79a, 0x55555a, 0x111111, 0x6d6d70];
const SKIN = [0xf1d2b6, 0xe8c4a2, 0xdcb08c, 0xf5dcc6];
const HAIR = [0x141210, 0x1d1712, 0x2b2017, 0x4a3524, 0x7a5a3a, 0xb59b7a];

// corners of the scramble: wait areas + arms (polylines outwards along the real sidewalks)
const C = CORNERS;
const KEYS = Object.keys(C);
// ambient ping-pong paths on real streets (y: fixed height instead of the street surface)
const AMB = [
  ...WALKS.map((pts, i) => ({ pts, w: i === 0 ? 2.2 : 1.0, n: i === 0 ? 80 : i === 7 ? 26 : 12 })), // [0] Center Gai, [7] Hachiko square
  { pts: [[90, -270], [95, -200], [110, -170]], w: 5, n: 18, y: 15.75 }, // Miyashita Park rooftop
  { pts: [[134, 112], [160, 101], [176, 128], [148, 142], [134, 112]], w: 2, n: 18, y: 228.4, slow: 0.6 }, // SHIBUYA SKY
];
export class Crowd {
  constructor(scene0, mobile) {
    const scene = (this.group = new THREE.Group()); scene0.add(scene);
    const ambList = [];
    for (const q of AMB) for (let k = 0; k < Math.round(q.n * (mobile ? 0.45 : 0.8)); k++) ambList.push(q);
    const NC = mobile ? 150 : 320, NA = ambList.length, NS = mobile ? 30 : 60;
    this.N = NC + NA + NS; this.NC = NC; this.NA = NA;
    const N = this.N;
    const cloth = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
    const hairM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const skinPlain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
    const shoeM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const torsoG = new THREE.LatheGeometry([[0.0, 0], [0.13, 0], [0.15, 0.08], [0.155, 0.2], [0.18, 0.32], [0.2, 0.4], [0.185, 0.45], [0.09, 0.49], [0.0, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 9).scale(1, 1, 0.62).translate(0, 0.97, 0);
    const neck = new THREE.CylinderGeometry(0.045, 0.05, 0.12, 6, 1, true).translate(0, 1.5, 0);
    neck.attributes.uv.array.fill(0.9);
    const headG = mergeGeometries([new THREE.SphereGeometry(0.1, 14, 9).scale(0.8, 1.05, 0.92).translate(0, 1.6, 0.005), neck]);
    const face = document.createElement('canvas'); face.width = 256; face.height = 128;
    { const g = face.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 128);
      g.fillStyle = 'rgba(40,28,22,0.95)'; for (const dx of [-7, 7]) { g.beginPath(); g.ellipse(64 + dx, 60, 2.6, 1.8, 0, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(60,40,30,0.55)'; for (const dx of [-7, 7]) g.fillRect(64 + dx - 3.5, 53, 7, 1.6);
      g.fillStyle = 'rgba(160,90,80,0.55)'; g.fillRect(60, 79, 8, 1.6);
      g.fillStyle = 'rgba(120,80,60,0.15)'; g.fillRect(63, 62, 2, 10); }
    const faceTex = new THREE.CanvasTexture(face); faceTex.colorSpace = THREE.SRGBColorSpace;
    skin.map = faceTex;
    const hairS = new THREE.SphereGeometry(0.109, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.55).rotateX(-0.5).scale(0.84, 1.06, 0.98).translate(0, 1.613, -0.006);
    const hairL = mergeGeometries([new THREE.SphereGeometry(0.112, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.6).rotateX(-0.55).scale(0.86, 1.06, 1.0).translate(0, 1.61, -0.008), new THREE.CapsuleGeometry(0.085, 0.2, 2, 7).scale(1.15, 1, 0.5).translate(0, 1.47, -0.07)]);
    const capsule = (r, l, top) => new THREE.CylinderGeometry(r, r * 0.82, l + r * 1.6, 7, 1, false).translate(0, -(l / 2 + r) + top, 0);
    const N2 = N * 2;
    const im = (g, m, n) => new THREE.InstancedMesh(g, m, n);
    this.parts = {
      torso: im(torsoG, cloth, N),
      pelvis: im(new THREE.SphereGeometry(1, 9, 6).scale(0.165, 0.12, 0.115).translate(0, 0.935, 0), cloth, N),
      head: im(headG, skin, N),
      hairS: im(hairS, hairM, N), hairL: im(hairL, hairM, N),
      thigh: im(capsule(0.07, 0.3, 0.04), cloth, N2),
      shin: im(capsule(0.052, 0.33, 0.02), cloth, N2),
      shoe: im(new THREE.CylinderGeometry(0.05, 0.055, 0.24, 6, 1, false).rotateX(Math.PI / 2).scale(1.05, 0.7, 1).translate(0, -0.445, 0.045), shoeM, N2),
      uarm: im(capsule(0.044, 0.2, 0.03), cloth, N2),
      farm: im(capsule(0.037, 0.18, 0.02), cloth, N2),
      hand: im(new THREE.SphereGeometry(0.042, 5, 4).scale(0.8, 1.1, 0.6).translate(0, -0.27, 0), skinPlain, N2),
      skirt: im(new THREE.CylinderGeometry(0.165, 0.27, 0.5, 10, 1, true).translate(0, 0.72, 0), cloth, N),
      bag: im(new THREE.BoxGeometry(1, 1, 1), cloth, N),
    };
    const col = new THREE.Color();
    for (const k in this.parts) {
      const m = this.parts[k];
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = ['torso', 'thigh', 'shin', 'skirt', 'head'].includes(k);
      m.receiveShadow = false;
      scene.add(m);
    }
    this.p = [];
    for (let i = 0; i < N; i++) {
      const top = R.pick(TOPS), bot = R.pick(BOTS), skinC = R.pick(SKIN), hair = R.pick(HAIR);
      const fem = R() < 0.5;
      const look = { fem, skirt: fem && R() < 0.4 ? 1 : R() < 0.12 ? 2 : 0, longHair: fem ? R() < 0.75 : R() < 0.08, sleeves: R() < 0.7, bag: R() < 0.22 ? 1 : R() < 0.45 ? 2 : 0, width: fem ? 0.9 : 1.05 };
      const P = this.parts;
      P.torso.setColorAt(i, col.setHex(top)); P.pelvis.setColorAt(i, col.setHex(look.skirt === 1 ? R.pick(BOTS.concat(TOPS)) : bot));
      const skirtC = look.skirt === 2 ? R.pick([0x3b3530, 0x1b1b1d, 0x6b5a48, 0x2c3440, 0xb8a888]) : col.getHex();
      P.skirt.setColorAt(i, col.setHex(skirtC));
      for (const j of [i * 2, i * 2 + 1]) {
        P.uarm.setColorAt(j, col.setHex(look.skirt === 2 ? skirtC : top)); P.farm.setColorAt(j, col.setHex(look.sleeves || look.skirt === 2 ? (look.skirt === 2 ? skirtC : top) : skinC));
        P.thigh.setColorAt(j, col.setHex(look.skirt === 1 ? skinC : bot)); P.shin.setColorAt(j, col.setHex(look.skirt === 1 ? (R() < 0.5 ? 0x222222 : skinC) : bot));
        P.shoe.setColorAt(j, col.setHex(R() < 0.45 ? 0xeeeeea : R.pick([0x1a1a1a, 0x5a3a24, 0x222833]))); P.hand.setColorAt(j, col.setHex(skinC));
      }
      P.head.setColorAt(i, col.setHex(skinC)); P.hairS.setColorAt(i, col.setHex(hair)); P.hairL.setColorAt(i, col.setHex(hair));
      P.bag.setColorAt(i, col.setHex(R.pick([0x1a1a1a, 0x6b4a2e, 0xd8d2c4, 0x2b3a55, 0x8a1f2b])));
      const p = { x: 0, y: 0.02, z: 0, th: 0, sp: R.range(1.15, 1.55), sc: R.range(0.92, 1.06) * (fem ? 0.95 : 1.02), ph: R() * 6, path: null, k: 0, state: 'walk', off: R.range(-1, 1), active: true, idle: R() * 6, look };
      if (i < NC) { p.kind = 'cross'; this.newInbound(p, true); }
      else if (i < NC + NA) {
        p.kind = 'amb';
        const a = ambList[i - NC];
        p.amb = a; p.y = (a.y || 0) + 0.02; p.fixedY = !!a.y; p.sp *= a.slow || 1;
        const o = R.range(-a.w, a.w);
        const [x0, z0] = a.pts[0], [x1, z1] = a.pts[1], L = Math.hypot(x1 - x0, z1 - z0);
        const nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
        p.path = a.pts.map(([x, z]) => [x + nx * o, z + nz * o]);
        if (R() < 0.5) p.path.reverse();
        p.k = R.int(1, p.path.length - 1);
        const t = R();
        const [ax, az] = p.path[p.k - 1], [bx, bz] = p.path[p.k];
        p.x = ax + (bx - ax) * t; p.z = az + (bz - az) * t;
      } else {
        p.kind = 'stand';
        const which = R();
        if (which < 0.55) { // JR Yamanote platform (open-air part), facing the tracks
          const side = R() < 0.5 ? -1 : 1, q = at(YAMA, R.range(JR_PLAT.s0 + 4, JR_PLAT.open - 4)), l = side * R.range(JR_PLAT.half - 1.6, JR_PLAT.half - 1.0);
          p.x = q.x + q.dz * l; p.z = q.z - q.dx * l; p.y = JR_PLAT.y + 0.02; p.fixedY = true; p.th = q.h + side * Math.PI / 2;
        } else if (which < 0.75) { // Ginza Line platform
          const side = R() < 0.5 ? -1 : 1, q = at(GINZA.centre, R.range(GINZA.s0 + 4, GINZA.s1 - 4)), l = side * R.range(GINZA.half - 1.6, GINZA.half - 1.0);
          p.x = q.x + q.dz * l; p.z = q.z - q.dx * l; p.y = GINZA.plat + 0.02; p.fixedY = true; p.th = q.h + side * Math.PI / 2;
        } else { // meeting spot around Hachiko
          const a = R() * 6.28, r = R.range(2.2, 6);
          p.x = HACHIKO.x + 3 + Math.cos(a) * r; p.z = HACHIKO.z + Math.sin(a) * r; p.th = R() * 6.28; p.y = 0.02;
        }
        p.state = 'stand';
      }
      this.p.push(p);
    }
    for (const k in this.parts) this.parts[k].instanceColor.needsUpdate = true;
    this.density = 1;
  }

  pt(area) { return [R.range(area[0], area[2]), R.range(area[1], area[3])]; }
  newInbound(p, scatter) {
    const ck = R.pick(KEYS), c = C[ck];
    const arm = R.pick(c.arms);
    const pts = arm.slice().reverse().map(([x, z]) => [x + p.off * 1.3, z + p.off * 1.3]);
    pts.push(this.pt(c.area));
    p.path = pts; p.k = 1; p.corner = ck; p.state = 'walk'; p.mode = 'in';
    if (scatter) {
      // start somewhere along the route, or already waiting
      if (R() < 0.35) { const w = pts[pts.length - 1]; p.x = w[0]; p.z = w[1]; p.k = pts.length; p.state = 'wait'; }
      else { p.k = R.int(1, pts.length - 1); const t = R(); const a = pts[p.k - 1], b = pts[p.k]; p.x = a[0] + (b[0] - a[0]) * t; p.z = a[1] + (b[1] - a[1]) * t; }
    } else { p.x = pts[0][0]; p.z = pts[0][1]; }
  }
  startCross(p) {
    const others = KEYS.filter((k) => k !== p.corner);
    const tk = R.pick(others), c = C[tk];
    const arm = R.pick(c.arms);
    const target = this.pt(c.area);
    p.path = [[p.x, p.z], target, ...arm.map(([x, z]) => [x + p.off * 1.3, z + p.off * 1.3])];
    p.k = 1; p.state = 'cross'; p.mode = 'out'; p.corner = tk;
  }

  update(dt, now, cam, nightDensity, opt = {}) {
    const RAD2 = opt.radius ? opt.radius * opt.radius : 0, ground = opt.ground;
    const sig = scramblePhase(now / 1000);
    const go = sig.ped === 'go', blink = sig.ped === 'blink';
    const P = this.parts;
    const arr = {}; for (const k in P) arr[k] = P[k].instanceMatrix.array;
    const cx = cam.x, cz = cam.z;
    for (let i = 0; i < this.N; i++) {
      const p = this.p[i];
      const active = p.kind === 'stand' ? (i % 10) < nightDensity * 10 + 1 : (i % 100) < nightDensity * 100;
      if (!active) { this.hide(arr, i); continue; }
      let moving = false;
      if (p.state === 'wait') {
        if (go && sig.left > 12) { this.startCross(p); }
      } else if (p.state !== 'stand') {
        const tgt = p.path[p.k];
        if (!tgt) { this.next(p); continue; }
        const dx = tgt[0] - p.x, dz = tgt[1] - p.z, d = Math.hypot(dx, dz);
        let sp = p.sp * (p.state === 'cross' && (blink || sig.ped === 'stop') ? 1.6 : 1);
        if (p.state === 'walk' && p.mode === 'in' && p.k === p.path.length - 1 && d < 3 && !go) sp *= d / 3;
        const step = sp * dt;
        if (d <= step + 0.05) {
          p.x = tgt[0]; p.z = tgt[1]; p.k++;
          if (p.k >= p.path.length) this.arrive(p, go, sig);
        } else {
          p.x += dx / d * step; p.z += dz / d * step;
          const th = Math.atan2(dx, dz);
          let dth = th - p.th; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
          p.th += dth * Math.min(1, dt * 8);
          moving = true;
          p.ph += sp * dt * 5.4;
        }
      }
      // write matrices
      if (RAD2 && (p.kind === 'stand' || (p.amb && p.amb.y) || p.x * p.x + p.z * p.z > RAD2)) { this.hide(arr, i); continue; }
      const gy = !p.fixedY && ground ? ground(p.x, p.z) : 0;
      const near = (p.x - cx) * (p.x - cx) + (p.z - cz) * (p.z - cz) < 170 * 170;
      const c = Math.cos(p.th), s = Math.sin(p.th), sc = p.sc, L = p.look;
      let hipL, hipR, kneeL, kneeR, shL, shR, elL, elR, bob;
      if (moving && near) {
        const sp = Math.sin(p.ph), cp = Math.cos(p.ph);
        hipL = -0.42 * sp; hipR = 0.42 * sp;
        kneeL = 0.1 + 0.65 * Math.max(0, cp); kneeR = 0.1 + 0.65 * Math.max(0, -cp);
        shL = 0.3 * sp; shR = -0.3 * sp;
        elL = -0.25 - 0.25 * Math.max(0, -sp); elR = -0.25 - 0.25 * Math.max(0, sp);
        bob = 0.025 * Math.cos(2 * p.ph);
      } else {
        const sw = Math.sin(now / 1500 + p.idle) * 0.03;
        hipL = sw; hipR = -sw; kneeL = kneeR = 0.04; shL = 0.06; shR = 0.06; elL = elR = L.bag === 2 ? -0.9 : -0.18; bob = 0;
      }
      const y = p.y + bob + gy;
      const W = L.width;
      put(arr.torso, i, p.x, y, p.z, c, s, sc, 0, 0, 0, 0, W);
      put(arr.pelvis, i, p.x, y, p.z, c, s, sc, 0, 0, 0, 0, W);
      put(arr.head, i, p.x, y, p.z, c, s, sc, 0, 0, 0, 0, 1);
      if (L.longHair) { put(arr.hairL, i, p.x, y, p.z, c, s, sc, 0, 0, 0, 0, 1); zero(arr.hairS, i); } else { put(arr.hairS, i, p.x, y, p.z, c, s, sc, 0, 0, 0, 0, 1); zero(arr.hairL, i); }
      if (L.skirt) put(arr.skirt, i, p.x, y, p.z, c, s, sc * (L.skirt === 2 ? 1 : 0.98), 0, L.skirt === 2 ? -0.18 : 0.05, 0, 0, L.skirt === 2 ? 1.12 : 1, L.skirt === 2 ? 1.4 : 0.8); else zero(arr.skirt, i);
      // legs: hip pivot, knee chain
      for (const [j, sx, hip, knee] of [[i * 2, -0.095, hipL, kneeL], [i * 2 + 1, 0.095, hipR, kneeR]]) {
        put(arr.thigh, j, p.x, y, p.z, c, s, sc, sx * W, 0.9, 0, hip, 1);
        const ky = 0.9 - 0.44 * Math.cos(hip), kz = -0.44 * Math.sin(hip) * -1;
        put(arr.shin, j, p.x, y, p.z, c, s, sc, sx * W, ky, -kz, hip + knee, 1);
        put(arr.shoe, j, p.x, y, p.z, c, s, sc, sx * W, ky, -kz, hip + knee, 1);
      }
      for (const [j, sx, sh, el] of [[i * 2, -0.205, shL, elL], [i * 2 + 1, 0.205, shR, elR]]) {
        put(arr.uarm, j, p.x, y, p.z, c, s, sc, sx * W, 1.415, 0, sh, 1);
        const ey = 1.415 - 0.29 * Math.cos(sh), ez = 0.29 * Math.sin(sh);
        put(arr.farm, j, p.x, y, p.z, c, s, sc, sx * W, ey, -ez, sh + el, 1);
        put(arr.hand, j, p.x, y, p.z, c, s, sc, sx * W, ey, -ez, sh + el, 1);
      }
      if (L.bag === 1) bagBox(arr.bag, i, p.x, y, p.z, c, s, sc, 0, 1.2, -0.2, 0.3, 0.38, 0.15);
      else if (L.bag === 2) bagBox(arr.bag, i, p.x, y, p.z, c, s, sc, 0.25 * W, 0.95, 0, 0.1, 0.28, 0.32);
      else zero(arr.bag, i);
    }
    for (const k in P) P[k].instanceMatrix.needsUpdate = true;
    return sig;
  }
  hide(arr, i) { for (const k in arr) { const a = arr[k]; const dbl = a.length > this.N * 16; for (const idx of dbl ? [i * 2, i * 2 + 1] : [i]) for (let j = 0; j < 16; j++) a[idx * 16 + j] = 0; } }
  arrive(p, go, sig) {
    if (p.kind === 'amb') { p.path.reverse(); p.k = 1; return; }
    if (p.mode === 'in') { p.state = 'wait'; if (go && sig.left > 12) this.startCross(p); return; }
    this.next(p);
  }
  next(p) {
    if (p.kind === 'amb') { p.path.reverse(); p.k = 1; return; }
    this.newInbound(p, false);
  }
}

// Instance matrix: person base (pos, yaw c/s, scale sc) * T(pivot) * Rx(phi) * S(wx, 1, wz)
function put(a, i, x, y, z, c, s, sc, px, py, pz, phi, wx = 1, wy = 1) {
  const o = i * 16, cp = Math.cos(phi), sp = Math.sin(phi);
  const kx = sc * wx, ky = sc * wy;
  a[o] = kx * c; a[o + 1] = 0; a[o + 2] = -kx * s; a[o + 3] = 0;
  a[o + 4] = ky * s * sp; a[o + 5] = ky * cp; a[o + 6] = ky * c * sp; a[o + 7] = 0;
  a[o + 8] = sc * s * cp; a[o + 9] = -sc * sp; a[o + 10] = sc * c * cp; a[o + 11] = 0;
  a[o + 12] = x + sc * (c * px + s * pz); a[o + 13] = y + sc * py; a[o + 14] = z + sc * (-s * px + c * pz); a[o + 15] = 1;
}
function zero(a, i) { a.fill(0, i * 16, i * 16 + 16); }
function bagBox(a, i, x, y, z, c, s, sc, px, py, pz, w, h, d) {
  const o = i * 16;
  a[o] = sc * w * c; a[o + 1] = 0; a[o + 2] = -sc * w * s; a[o + 3] = 0;
  a[o + 4] = 0; a[o + 5] = sc * h; a[o + 6] = 0; a[o + 7] = 0;
  a[o + 8] = sc * d * s; a[o + 9] = 0; a[o + 10] = sc * d * c; a[o + 11] = 0;
  a[o + 12] = x + sc * (c * px + s * pz); a[o + 13] = y + sc * py; a[o + 14] = z + sc * (-s * px + c * pz); a[o + 15] = 1;
}

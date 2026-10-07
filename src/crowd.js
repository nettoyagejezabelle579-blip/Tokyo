import * as THREE from 'three';
import { rng } from './util.js';
import { scramblePhase, JR, GZ, CENTER_GAI } from './layout.js';
import { toWorld } from './util.js';

const R = rng(1234);
const TOPS = [0x1b1b1d, 0x22324a, 0x3b3b3e, 0xe9e7e2, 0xc8b89c, 0x7d6b55, 0x5c6b4a, 0x8a1f2b, 0x2f5d8c, 0xf2f2f2, 0x111111, 0x6b7f99, 0xd9a3b5, 0xa49480];
const BOTS = [0x1a1a1c, 0x24324a, 0x3d4f6b, 0x2b2b2e, 0xc7b79a, 0x55555a, 0x111111, 0x6d6d70];
const SKIN = [0xf1d2b6, 0xe8c4a2, 0xdcb08c, 0xf5dcc6];
const HAIR = [0x141210, 0x1d1712, 0x2b2017, 0x4a3524, 0x7a5a3a, 0xb59b7a];

// corners of the scramble: wait areas + arms (polylines outwards)
const C = {
  NW: { area: [-19, -22, -11, -7], arms: [[[-15, -18], [-16, -25], toWorld(CENTER_GAI, -CENTER_GAI.hw + 30, 0), toWorld(CENTER_GAI, CENTER_GAI.hw - 10, 0)], [[-12, -24], [-12, -110], [-12, -190]], [[-22, -8], [-90, -8], [-150, -8]]] },
  NE: { area: [11, -21, 19, -10], arms: [[[12, -24], [12, -100], [12, -168]], [[22, -12], [95, -12], [180, -12]]] },
  SE: { area: [11, 10, 24, 21], arms: [[[24, 22], [55, 31], [79, 43.5], [90, 43.5], [102, 50], [104, 98]], [[24, 11.5], [78, 11.2], [180, 11.2]], [[14, 24], [12, 60], [12, 140]]] },
  SW: { area: [-19, 11, -11, 23], arms: [[[-12, 24], [-12, 110], [-12, 190]], [[-22, 12], [-90, 12], [-150, 12]]] },
};
const KEYS = Object.keys(C);
// ambient ping-pong paths
const AMB = [
  { pts: [toWorld(CENTER_GAI, -CENTER_GAI.hw + 30, 0), toWorld(CENTER_GAI, CENTER_GAI.hw - 5, 0)], w: 3.5, n: 70 },
  { pts: [[187.5, -440], [187.5, 180]], w: 1.2, n: 20 }, { pts: [[212.5, -440], [212.5, 180]], w: 1.2, n: 20 },
  { pts: [[-160, 12], [-300, 63], [-420, 95]], w: 1.5, n: 14 },
  { pts: [[-8, -192], [-80, -310], [-185, -470]], w: 1.5, n: 18 },
  { pts: [[150, -150], [150, -380]], w: 14, n: 40, y: 17 },
  { pts: [[-12, -100], [-150, -100], [-300, -100]], w: 1.2, n: 14 },
  { pts: [[-460, 196], [460, 196]], w: 1.2, n: 18 }, { pts: [[-460, 228], [460, 228]], w: 1.2, n: 14 },
  { pts: [[237, 110], [237, 190]], w: 1.2, n: 8 },
  { pts: [[150, 24], [178, 24], [178, 80], [150, 80], [150, 24]], w: 2, n: 18, y: 229.7, slow: 0.6 },
  { pts: [[84, 20], [95, 20], [95, 125]], w: 3, n: 20 },
  { pts: [[-12, 120], [-12, 192]], w: 1.2, n: 6 }, { pts: [[12, 140], [12, 192]], w: 1.2, n: 6 },
  { pts: [[38, 30], [70, 70], [30, 82], [40, 40]], w: 3, n: 16 },
];

export class Crowd {
  constructor(scene, mobile) {
    const ambList = [];
    for (const q of AMB) for (let k = 0; k < Math.round(q.n * (mobile ? 0.6 : 1)); k++) ambList.push(q);
    const NC = mobile ? 190 : 380, NA = ambList.length, NS = mobile ? 40 : 70;
    this.N = NC + NA + NS; this.NC = NC; this.NA = NA;
    const N = this.N;
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    this.parts = {
      torso: new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.62, 0.25), lam(0xffffff), N),
      head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.115, 7, 5), lam(0xffffff), N),
      hair: new THREE.InstancedMesh(new THREE.SphereGeometry(0.128, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.55), lam(0xffffff), N),
      legL: new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.86, 0.16).translate(0, -0.43, 0), lam(0xffffff), N),
      legR: new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.86, 0.16).translate(0, -0.43, 0), lam(0xffffff), N),
      armL: new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.6, 0.11).translate(0, -0.3, 0), lam(0xffffff), N),
      armR: new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.6, 0.11).translate(0, -0.3, 0), lam(0xffffff), N),
    };
    const col = new THREE.Color();
    for (const k in this.parts) {
      const m = this.parts[k];
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = k === 'torso' || k === 'legL' || k === 'legR';
      scene.add(m);
    }
    this.p = [];
    for (let i = 0; i < N; i++) {
      const top = R.pick(TOPS), bot = R.pick(BOTS), skin = R.pick(SKIN), hair = R.pick(HAIR);
      this.parts.torso.setColorAt(i, col.setHex(top));
      this.parts.armL.setColorAt(i, col.setHex(R() < 0.6 ? top : skin)); this.parts.armR.setColorAt(i, col);
      this.parts.legL.setColorAt(i, col.setHex(bot)); this.parts.legR.setColorAt(i, col);
      this.parts.head.setColorAt(i, col.setHex(skin)); this.parts.hair.setColorAt(i, col.setHex(hair));
      const p = { x: 0, y: 0.02, z: 0, th: 0, sp: R.range(1.15, 1.55), sc: R.range(0.9, 1.07), ph: R() * 6, path: null, k: 0, state: 'walk', off: R.range(-1, 1), active: true, idle: 0 };
      if (i < NC) { p.kind = 'cross'; this.newInbound(p, true); }
      else if (i < NC + NA) {
        p.kind = 'amb';
        const a = ambList[i - NC];
        p.amb = a; p.y = (a.y || 0) + 0.02; p.sp *= a.slow || 1;
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
        if (which < 0.62) { // JR platform
          const side = R() < 0.5;
          p.x = side ? R.range(105.2, 106.6) : R.range(113.4, 114.8); p.z = R.range(-100, 60); p.y = JR.plat + 0.02;
          p.th = side ? -Math.PI / 2 : Math.PI / 2;
        } else if (which < 0.82) {
          const side = R() < 0.5;
          p.x = side ? R.range(195, 196.5) : R.range(203.5, 205); p.z = R.range(-115, -35); p.y = GZ.plat + 0.02; p.th = side ? -Math.PI / 2 : Math.PI / 2;
        } else { // Hachiko meeting spot
          const a = R() * 6.28, r = R.range(2.5, 7);
          p.x = 62 + Math.cos(a) * r; p.z = 40 + Math.sin(a) * r; p.th = R() * 6.28;
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

  update(dt, now, cam, nightDensity) {
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
      const near = (p.x - cx) * (p.x - cx) + (p.z - cz) * (p.z - cz) < 160 * 160;
      const sw = moving && near ? Math.sin(p.ph) : 0;
      const c = Math.cos(p.th), s = Math.sin(p.th), sc = p.sc;
      const y = p.y + (moving ? Math.abs(Math.cos(p.ph)) * 0.03 : 0);
      set(arr.torso, i, p.x, y, p.z, c, s, sc, 0, 1.16, 0, 0);
      set(arr.head, i, p.x, y, p.z, c, s, sc, 0, 1.6, 0.01, 0);
      set(arr.hair, i, p.x, y, p.z, c, s, sc, 0, 1.615, -0.008, 0);
      set(arr.legL, i, p.x, y, p.z, c, s, sc, -0.11, 0.86, 0, sw * 0.5);
      set(arr.legR, i, p.x, y, p.z, c, s, sc, 0.11, 0.86, 0, -sw * 0.5);
      set(arr.armL, i, p.x, y, p.z, c, s, sc, -0.285, 1.43, 0, -sw * 0.4);
      set(arr.armR, i, p.x, y, p.z, c, s, sc, 0.285, 1.43, 0, sw * 0.4);
    }
    for (const k in P) P[k].instanceMatrix.needsUpdate = true;
    return sig;
  }
  hide(arr, i) { for (const k in arr) { const a = arr[k]; for (let j = 0; j < 16; j++) a[i * 16 + j] = 0; } }
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

function set(a, i, x, y, z, c, s, sc, px, py, pz, phi) {
  const o = i * 16, cp = Math.cos(phi), sp = Math.sin(phi);
  a[o] = sc * c; a[o + 1] = 0; a[o + 2] = -sc * s; a[o + 3] = 0;
  a[o + 4] = sc * s * sp; a[o + 5] = sc * cp; a[o + 6] = sc * c * sp; a[o + 7] = 0;
  a[o + 8] = sc * s * cp; a[o + 9] = -sc * sp; a[o + 10] = sc * c * cp; a[o + 11] = 0;
  a[o + 12] = x + sc * (c * px + s * pz); a[o + 13] = y + sc * py; a[o + 14] = z + sc * (-s * px + c * pz); a[o + 15] = 1;
}

import * as THREE from 'three';
import { rng } from './util.js';
import { scramblePhase, twoPhase, ROADS } from './layout.js';
import { canvas, toTex } from './textures.js';

const R = rng(777);

// ---------- vehicle geometry (vertex coloured boxes; white parts take the instance colour) ----------
function geoFrom(boxes) {
  const pos = [], col = [], nor = [];
  for (const [x0, y0, z0, x1, y1, z1, c] of boxes) {
    const cc = new THREE.Color(c);
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).toNonIndexed();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(cc.r, cc.g, cc.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const W = 0xffffff, GL = 0x1c232b, TY = 0x111111;
function wheels(L, Wd, r = 0.33) {
  const out = [];
  for (const z of [L / 2 - 0.85, -L / 2 + 0.85]) for (const x of [-Wd / 2 + 0.05, Wd / 2 - 0.25]) out.push([x, 0, z - r, x + 0.2, r * 2, z + r, TY]);
  return out;
}
const TYPES = {
  taxi: { L: 4.4, w: 1.7, body: () => [[-0.85, 0.3, -2.2, 0.85, 1.0, 2.2, W], [-0.8, 1.0, -1.4, 0.8, 1.68, 1.5, GL], [-0.82, 1.0, -1.45, 0.82, 1.06, 1.55, W], [-0.78, 1.68, -1.35, 0.78, 1.74, 1.4, W], [-0.2, 1.74, 0.1, 0.2, 1.92, 0.35, 0xffd76a], ...wheels(4.4, 1.7)], colors: [0x1d2847, 0x1d2847, 0x1d2847, 0x111111, 0xf2c200, 0x2e7d32], v: 11, lights: [1.7, 0.75] },
  sedan: { L: 4.7, w: 1.8, body: () => [[-0.9, 0.3, -2.35, 0.9, 0.95, 2.35, W], [-0.82, 0.95, -1.2, 0.82, 1.45, 1.1, GL], [-0.78, 1.45, -1.1, 0.78, 1.5, 1.0, W], ...wheels(4.7, 1.8)], colors: [0xf4f4f4, 0x161616, 0xb9bcc0, 0x7a7e84, 0x23314f, 0x8d1c23], v: 12, lights: [1.8, 0.7] },
  van: { L: 3.4, w: 1.48, body: () => [[-0.74, 0.3, -1.7, 0.74, 1.9, 1.7, W], [-0.75, 1.0, 1.0, 0.75, 1.75, 1.72, GL], [-0.75, 1.05, -1.0, 0.75, 1.6, 0.9, GL], ...wheels(3.4, 1.48, 0.28)], colors: [0xf4f4f4, 0xf4f4f4, 0xdfe3e6], v: 10, lights: [1.4, 0.8] },
  bus: { L: 10.5, w: 2.5, body: () => [[-1.25, 0.35, -5.25, 1.25, 3.1, 5.25, W], [-1.27, 1.45, -4.6, 1.27, 2.55, 5.27, GL], [-1.27, 0.75, -5.27, 1.27, 0.95, 5.27, 0xc8102e], [-1.27, 2.6, -5.27, 1.27, 2.68, 5.27, 0xc8102e], ...wheels(10.5, 2.5, 0.48)], colors: [0xf7f7f7], v: 10, lights: [2.3, 0.9] },
  truck: { L: 7.2, w: 2.2, body: () => [[-1.1, 0.4, 1.6, 1.1, 2.6, 3.6, W], [-1.1, 1.6, 2.4, 1.1, 2.4, 3.62, GL], [-1.1, 0.7, -3.6, 1.1, 3.2, 1.5, 0xe8e8e8], ...wheels(7.2, 2.2, 0.45)], colors: [0x2d5aa0, 0xf4f4f4, 0x2e7d32, 0xd0d0d0], v: 10, lights: [2.0, 0.9] },
};

function lightGeo(T) {
  const L = T.L / 2, hw = T.lights[0] / 2, y = T.lights[1];
  return geoFrom([
    [-hw, y, L - 0.02, -hw + 0.3, y + 0.14, L + 0.04, 0xfff2cc], [hw - 0.3, y, L - 0.02, hw, y + 0.14, L + 0.04, 0xfff2cc],
    [-hw, y, -L - 0.04, -hw + 0.28, y + 0.14, -L + 0.02, 0xff2a1a], [hw - 0.28, y, -L - 0.04, hw, y + 0.14, -L + 0.02, 0xff2a1a],
  ]);
}

// ---------- routes ----------
function poly(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.curve) { // quadratic curve from previous point via control to p
      const a = out[out.length - 1];
      for (let k = 1; k <= 10; k++) { const t = k / 10; out.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * p.c[0] + t * t * p[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * p.c[1] + t * t * p[1]]); }
    } else out.push(p);
  }
  const cum = [0];
  for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { pts: out, cum, L: cum[cum.length - 1] };
}
const cv = (x, z, cx, cz) => Object.assign([x, z], { curve: true, c: [cx, cz] });
const dog = ROADS.find((r) => r.id === 'DOG').o;

const ROUTES = [
  // scramble approaches
  { p: [[3, -440], [3, 192]], stops: [[-23, 'z', 'XNS']], n: 5 },
  { p: [[7, -440], [7, -16], cv(16, -6.5, 7, -6.5), [445, -6.5]], stops: [[-23, 'z', 'XNS'], [186, 'x', 'MB']], n: 4 },
  { p: [[-3, 192], [-3, -440]], stops: [[23, 'z', 'XNS']], n: 5 },
  { p: [[-7, 192], [-7, 16], cv(-16, 7.5, -7, 7.5), [-160, 7.5], [-430, 98.5]], stops: [[23, 'z', 'XNS']], n: 4 },
  { p: [[445, 2.5], [-16, 3.5], [-160, 4], [-430, 95.5]], stops: [[214, 'x', 'MB'], [23, 'x', 'XEW']], n: 6 },
  { p: [[445, 6.5], [16, 6.5], cv(7, 16, 7, 6.5), [7, 192]], stops: [[214, 'x', 'MB'], [23, 'x', 'XEW']], n: 4 },
  { p: [[-430, 88.5], [-162, -0.5], [445, -2.5]], stops: [[-23, 'x', 'XEW'], [186, 'x', 'MB']], n: 6 },
  { p: [[-430, 85.5], [-162, -3.8], [-16, -3.5], cv(-7, -16, -7, -3.5), [-7, -440]], stops: [[-23, 'x', 'XEW']], n: 4 },
  // Meiji-dori
  { p: [[203, -470], [203, 580]], stops: [[-15, 'z', 'MA'], [194, 'z', 'RA']], n: 6 },
  { p: [[207, -470], [207, 580]], stops: [[-15, 'z', 'MA'], [194, 'z', 'RA']], n: 5 },
  { p: [[197, 580], [197, -470]], stops: [[230, 'z', 'RA'], [15, 'z', 'MA']], n: 6 },
  { p: [[193, 580], [193, -470]], stops: [[230, 'z', 'RA'], [15, 'z', 'MA']], n: 5 },
  // Route 246
  { p: [[-470, 204], [470, 204]], stops: [[186, 'x', 'RB']], n: 6 },
  { p: [[-470, 208], [470, 208]], stops: [[186, 'x', 'RB']], n: 5 },
  { p: [[470, 216], [-470, 216]], stops: [[214, 'x', 'RB']], n: 6 },
  { p: [[470, 220], [-470, 220]], stops: [[214, 'x', 'RB']], n: 5 },
  // Shuto Expressway (elevated)
  { p: [[-470, 206.5], [470, 206.5]], y: 15, v: 19, n: 8 },
  { p: [[470, 217.5], [-470, 217.5]], y: 15, v: 19, n: 8 },
];
void dog;

export class Traffic {
  constructor(scene, mobile) {
    this.meshes = {};
    const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const cap = mobile ? 0.7 : 1;
    this.routes = ROUTES.map((r) => ({ ...r, ...poly(r.p), y: r.y || 0, v: r.v || 11, n: Math.max(2, Math.round(r.n * cap)), veh: [] }));
    for (const r of this.routes) {
      r.stopS = (r.stops || []).map(([v, axis, sig]) => {
        // arc-length where the route crosses the stop coordinate
        for (let i = 1; i < r.pts.length; i++) {
          const a = r.pts[i - 1], b = r.pts[i], k = axis === 'x' ? 0 : 1;
          if ((a[k] - v) * (b[k] - v) <= 0 && a[k] !== b[k]) {
            const t = (v - a[k]) / (b[k] - a[k]);
            return { s: r.cum[i - 1] + t * (r.cum[i] - r.cum[i - 1]), sig };
          }
        }
        return null;
      }).filter(Boolean);
    }
    const counts = {}; const vehicles = [];
    for (const r of this.routes) {
      for (let i = 0; i < r.n; i++) {
        const type = r.y ? R.pick(['sedan', 'sedan', 'truck', 'van', 'bus', 'taxi']) : R.pick(['taxi', 'taxi', 'taxi', 'sedan', 'sedan', 'van', 'truck', 'bus']);
        const v = { r, type, s: (i + R()) * (r.L / r.n), v: 4, idx: 0, color: R.pick(TYPES[type].colors) };
        v.idx = counts[type] = (counts[type] || 0) + 1;
        v.idx--;
        r.veh.push(v); vehicles.push(v);
      }
      r.veh.sort((a, b) => b.s - a.s);
    }
    for (const t in TYPES) {
      const n = counts[t] || 1;
      const T = TYPES[t];
      const body = new THREE.InstancedMesh(geoFrom(T.body()), bodyMat, n);
      const lights = new THREE.InstancedMesh(lightGeo(T), this.lightMat, n);
      body.castShadow = true; body.receiveShadow = true;
      body.instanceMatrix.setUsage(THREE.DynamicDrawUsage); lights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      body.frustumCulled = lights.frustumCulled = false;
      scene.add(body); scene.add(lights);
      this.meshes[t] = { body, lights };
    }
    const c = new THREE.Color();
    for (const v of vehicles) this.meshes[v.type].body.setColorAt(v.idx, c.setHex(v.color));
    for (const t in this.meshes) if (this.meshes[t].body.instanceColor) this.meshes[t].body.instanceColor.needsUpdate = true;
    this.vehicles = vehicles;
    this.buildSignals(scene);
  }

  at(r, s) {
    let i = 1;
    const cum = r.cum;
    let lo = 1, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m + 1; else hi = m; }
    i = lo;
    const a = r.pts[i - 1], b = r.pts[i];
    const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1])];
  }

  sigState(now) {
    const sec = now / 1000;
    const x = scramblePhase(sec), m = twoPhase(sec, 90, 7), r = twoPhase(sec, 100, 31);
    return { XNS: x.ns, XEW: x.ew, MA: m.a, MB: m.b, RA: r.a, RB: r.b, ped: x.ped, scr: x, m, r };
  }

  update(dt, now, night) {
    const S = this.sigState(now);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), ax = new THREE.Vector3(0, 1, 0);
    for (const r of this.routes) {
      const vs = r.veh;
      vs.sort((a, b) => b.s - a.s);
      for (let i = 0; i < vs.length; i++) {
        const v = vs[i], T = TYPES[v.type];
        let gap = 1e9;
        if (i > 0) { const l = vs[i - 1]; gap = l.s - TYPES[l.type].L / 2 - (v.s + T.L / 2); }
        else if (vs.length > 1) { const l = vs[vs.length - 1]; gap = l.s + r.L - TYPES[l.type].L / 2 - (v.s + T.L / 2); if (gap < 0) gap = 1e9; }
        for (const st of r.stopS) {
          const d = st.s - (v.s + T.L / 2);
          if (d < -0.5 || d > 70) continue;
          const state = S[st.sig];
          if (state === 'r' || (state === 'y' && d > 9)) gap = Math.min(gap, d + 1.0);
        }
        const v0 = r.v * (T.v / 11);
        const target = Math.min(v0, Math.max(0, (gap - 2.2) / 1.1));
        const acc = target > v.v ? 2.0 : 6.0;
        v.v += Math.sign(target - v.v) * Math.min(Math.abs(target - v.v), acc * dt);
        v.s += v.v * dt;
        if (v.s > r.L) { v.s -= r.L; }
        const [x, z, h] = this.at(r, v.s);
        q.setFromAxisAngle(ax, h);
        m4.compose(p.set(x, r.y + 0.02, z), q, sc);
        this.meshes[v.type].body.setMatrixAt(v.idx, m4);
        this.meshes[v.type].lights.setMatrixAt(v.idx, m4);
      }
    }
    for (const t in this.meshes) { this.meshes[t].body.instanceMatrix.needsUpdate = true; this.meshes[t].lights.instanceMatrix.needsUpdate = true; }
    this.lightMat.color.setScalar(0.55 + night * 0.9);
    this.updateSignals(S, now);
    return S;
  }

  buildSignals(scene) {
    const lampGeo = new THREE.CircleGeometry(0.13, 12);
    const mk = (c) => new THREE.MeshBasicMaterial({ color: c });
    this.sigMats = {};
    for (const g of ['XNS', 'XEW', 'MA', 'MB', 'RA', 'RB']) this.sigMats[g] = { g: mk(0x00e0b0), y: mk(0xffb000), r: mk(0xff2a2a) };
    const housing = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
    const pole = new THREE.MeshLambertMaterial({ color: 0x8a9096 });
    const carSignal = (x, z, ry, grp, armLen = 3) => {
      const g = new THREE.Group();
      const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 6.2, 8).translate(0, 3.1, 0), pole); g.add(pm);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.12, 0.12).translate(armLen / 2, 5.9, 0), pole); g.add(arm);
      const hb = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.42, 0.28).translate(armLen - 0.3, 5.9, 0), housing); g.add(hb);
      [['g', -0.38], ['y', 0], ['r', 0.38]].forEach(([k, dx]) => {
        const l = new THREE.Mesh(lampGeo, this.sigMats[grp][k]); l.position.set(armLen - 0.3 + dx, 5.9, 0.15); g.add(l);
      });
      g.position.set(x, 0, z); g.rotation.y = ry;
      scene.add(g);
    };
    // scramble (signals stand beyond the intersection facing the approach; arm reaches over the lanes)
    carSignal(12, 25, Math.PI, 'XNS', 6); carSignal(-12, -25, 0, 'XNS', 6);
    carSignal(-25, 12, Math.PI / 2, 'XEW', 6); carSignal(25, -12, -Math.PI / 2, 'XEW', 6);
    carSignal(212, 15, Math.PI, 'MA', 5); carSignal(188, -15, 0, 'MA', 5);
    carSignal(186, 12, Math.PI / 2, 'MB', 5); carSignal(214, -12, -Math.PI / 2, 'MB', 5);
    carSignal(212, 230, Math.PI, 'RA', 5); carSignal(188, 194, 0, 'RA', 5);
    carSignal(214, 200, -Math.PI / 2, 'RB', 5); carSignal(186, 224, Math.PI / 2, 'RB', 5);
    // pedestrian signals
    const pc = canvas(64, 128), g = pc.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, 64, 128);
    const man = (cy, color, walking) => {
      g.fillStyle = color; g.beginPath(); g.arc(32, cy - 20, 7, 0, 7); g.fill();
      g.fillRect(25, cy - 12, 14, 20);
      if (walking) { g.save(); g.translate(32, cy + 8); g.rotate(0.35); g.fillRect(-4, 0, 7, 20); g.rotate(-0.7); g.fillRect(-3, 0, 7, 20); g.restore(); }
      else { g.fillRect(25, cy + 8, 6, 18); g.fillRect(33, cy + 8, 6, 18); }
    };
    man(36, '#ff3030', false); man(98, '#20e0b0', true);
    const tex = toTex(pc, false);
    this.pedRed = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff });
    this.pedGreen = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff });
    const topG = new THREE.PlaneGeometry(0.5, 0.5); topG.attributes.uv.array.set([0, 1, 1, 1, 0, 0.5, 1, 0.5]);
    const botG = new THREE.PlaneGeometry(0.5, 0.5); botG.attributes.uv.array.set([0, 0.5, 1, 0.5, 0, 0, 1, 0]);
    const pedSignal = (x, z, ry) => {
      const gg = new THREE.Group();
      gg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 3.4, 8).translate(0, 1.7, 0), pole));
      gg.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.25).translate(0, 3.0, 0), housing));
      const a = new THREE.Mesh(topG, this.pedRed); a.position.set(0, 3.27, 0.13); gg.add(a);
      const b = new THREE.Mesh(botG, this.pedGreen); b.position.set(0, 2.73, 0.13); gg.add(b);
      gg.position.set(x, 0, z); gg.rotation.y = ry; scene.add(gg);
    };
    // each corner faces across both of its crosswalks
    pedSignal(-11, -13, Math.PI / 2); pedSignal(-13, -11, 0);
    pedSignal(11, -13, -Math.PI / 2); pedSignal(13, -11, 0);
    pedSignal(11, 13, -Math.PI / 2); pedSignal(13, 11, Math.PI);
    pedSignal(-11, 13, Math.PI / 2); pedSignal(-13, 11, Math.PI);
  }

  updateSignals(S, now) {
    const dim = 0.12;
    for (const k in this.sigMats) {
      const st = S[k], m = this.sigMats[k];
      m.g.color.setRGB(0, (st === 'g' ? 1 : dim) * 0.88, (st === 'g' ? 1 : dim) * 0.69);
      m.y.color.setRGB((st === 'y' ? 1 : dim), (st === 'y' ? 0.69 : dim * 0.69), 0);
      m.r.color.setRGB((st === 'r' ? 1 : dim), (st === 'r' ? 0.16 : dim * 0.16), (st === 'r' ? 0.16 : dim * 0.16));
    }
    const ped = S.ped;
    const blinkOn = Math.floor(now / 400) % 2 === 0;
    const green = ped === 'go' || (ped === 'blink' && blinkOn);
    this.pedGreen.color.setScalar(green ? 1 : 0.12);
    this.pedRed.color.setScalar(ped === 'stop' ? 1 : 0.12);
  }
}

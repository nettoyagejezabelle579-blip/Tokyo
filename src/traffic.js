import * as THREE from 'three';
import { rng } from './util.js';
import { scramblePhase, twoPhase, ROAD_LINES, SCRAMBLE_STOP, CROSSWALKS, smoothPts } from './geo.js';
import { canvas, toTex } from './textures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const R = rng(777);

// ---------- vehicle geometry: side-profile extrusions with bevelled edges ----------
const ni = (g) => (g.index ? g.toNonIndexed() : g);
const strip = (g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); g.clearGroups(); return g; };
function extrude(pts, width, bevel = 0.06) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.rotateY(-Math.PI / 2); g.translate((width - bevel * 2) / 2, 0, 0);
  return strip(ni(g));
}
function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  const p = [a, b, c, a, c, d].flat();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  g.computeVertexNormals();
  return g;
}
// glass panel following a profile segment (x along car length), spanning the width
function glassSeg(p0, p1, hw, out = 0.012) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy), nx = -dy / L * out, ny = dx / L * out;
  const A = (pp, x) => [x, pp[1] + ny, pp[0] + nx];
  return quad(A(p0, -hw), A(p0, hw), A(p1, hw), A(p1, -hw));
}
function sideWindows(pts, hw) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const out = [];
  for (const sd of [-1, 1]) {
    const g = ni(new THREE.ShapeGeometry(sh));
    g.rotateY(sd > 0 ? -Math.PI / 2 : Math.PI / 2); g.translate(sd * hw, 0, 0);
    out.push(strip(g));
  }
  return out;
}
function wheelSet(L, W, r, xs) {
  const tire = [], rim = [];
  for (const z of xs) for (const sd of [-1, 1]) {
    tire.push(strip(ni(new THREE.CylinderGeometry(r, r, 0.22, 16).rotateZ(Math.PI / 2).translate(sd * (W / 2 - 0.12), r, z))));
    rim.push(strip(ni(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.05, 12).rotateZ(Math.PI / 2).translate(sd * (W / 2 - 0.005), r, z))));
  }
  return { tire, rim };
}
const box = (x0, y0, z0, x1, y1, z1) => strip(ni(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)));
const colorize = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };

function carParts(T) {
  const { L, w, prof, win, front, rear, wheelR, wheelX } = T;
  const hw = w / 2;
  const paint = [extrude(prof, w)];
  const glass = [...sideWindows(win, hw + 0.004)];
  if (front) glass.push(glassSeg(front[0], front[1], hw - 0.1));
  if (rear) glass.push(glassSeg(rear[0], rear[1], hw - 0.1));
  const { tire, rim } = wheelSet(L, w, wheelR, wheelX);
  const dark = [...tire, box(-hw + 0.05, 0.2, L / 2 - 0.05, hw - 0.05, 0.42, L / 2 + 0.04), box(-hw + 0.05, 0.2, -L / 2 - 0.04, hw - 0.05, 0.42, -L / 2 + 0.05)];
  const ly = T.lightY;
  const lights = [
    colorize(box(-hw + 0.08, ly, L / 2 - 0.02, -hw + 0.42, ly + 0.12, L / 2 + 0.05), 0xfff3d6), colorize(box(hw - 0.42, ly, L / 2 - 0.02, hw - 0.08, ly + 0.12, L / 2 + 0.05), 0xfff3d6),
    colorize(box(-hw + 0.08, ly + 0.1, -L / 2 - 0.05, -hw + 0.38, ly + 0.24, -L / 2 + 0.02), 0xff2a14), colorize(box(hw - 0.38, ly + 0.1, -L / 2 - 0.05, hw - 0.08, ly + 0.24, -L / 2 + 0.02), 0xff2a14),
  ];
  if (T.extra) T.extra({ paint, glass, dark, rim, lights });
  return { paint: mergeGeometries(paint), glass: mergeGeometries(glass), dark: mergeGeometries(dark), rim: mergeGeometries(rim), lights: mergeGeometries(lights) };
}

const TYPES = {
  taxi: {
    L: 4.4, w: 1.7, wheelR: 0.31, wheelX: [1.35, -1.4], lightY: 0.72, v: 11,
    prof: [[-2.2, 0.3], [-2.22, 0.92], [-2.08, 1.06], [-1.98, 1.68], [-1.85, 1.75], [0.45, 1.76], [1.25, 1.1], [2.08, 0.96], [2.2, 0.62], [2.18, 0.3]],
    win: [[-1.9, 1.1], [-1.82, 1.64], [0.42, 1.67], [1.15, 1.12]], front: [[0.45, 1.76], [1.25, 1.1]], rear: [[-2.08, 1.06], [-1.98, 1.68]],
    colors: [0x1b2440, 0x1b2440, 0x1b2440, 0x1b2440, 0x111111, 0xd9b400, 0x2a6a3a],
    extra: (p) => { p.lights.push(colorize(box(-0.22, 1.76, 0.0, 0.22, 1.95, 0.3), 0xfff0b0)); p.dark.push(box(-0.86, 0.95, -2.0, 0.86, 1.0, 1.9)); },
  },
  sedan: {
    L: 4.6, w: 1.76, wheelR: 0.31, wheelX: [1.4, -1.35], lightY: 0.72, v: 12,
    prof: [[-2.3, 0.32], [-2.33, 0.75], [-2.1, 0.96], [-1.55, 1.0], [-0.6, 1.44], [0.35, 1.46], [1.2, 1.0], [2.15, 0.82], [2.32, 0.6], [2.3, 0.32]],
    win: [[-1.42, 1.03], [-0.62, 1.39], [0.32, 1.41], [1.08, 1.03]], front: [[0.35, 1.46], [1.2, 1.0]], rear: [[-1.55, 1.0], [-0.6, 1.44]],
    colors: [0xf2f2f2, 0x151515, 0xb8bcc0, 0x7d8288, 0x22314f, 0x8d1c23, 0xe8e8e8],
  },
  van: {
    L: 3.4, w: 1.48, wheelR: 0.27, wheelX: [1.05, -1.15], lightY: 0.78, v: 10,
    prof: [[-1.7, 0.3], [-1.7, 1.86], [-1.6, 1.9], [1.2, 1.9], [1.6, 1.18], [1.7, 0.92], [1.7, 0.3]],
    win: [[-1.55, 1.18], [-1.55, 1.76], [1.15, 1.78], [1.48, 1.18]], front: [[1.2, 1.9], [1.6, 1.18]], rear: null,
    colors: [0xf4f4f4, 0xf4f4f4, 0xdfe3e6, 0x9fb7c9],
  },
  bus: {
    L: 10.5, w: 2.49, wheelR: 0.48, wheelX: [3.0, -2.7], lightY: 0.75, v: 10,
    prof: [[-5.25, 0.35], [-5.25, 3.0], [-5.1, 3.12], [5.1, 3.12], [5.25, 2.95], [5.25, 0.35]],
    win: [[-5.0, 1.42], [-5.0, 2.62], [5.0, 2.66], [5.1, 1.1]], front: [[5.27, 2.85], [5.27, 1.05]], rear: null,
    colors: [0xf7f7f7],
    extra: (p) => { p.lights.push(colorize(box(-1.2, 2.72, 5.2, 1.2, 2.95, 5.3), 0xff9a2a)); p.dark.push(box(-1.256, 0.8, -5.0, -1.25, 0.95, 5.0), box(1.25, 0.8, -5.0, 1.256, 0.95, 5.0)); },
  },
  truck: {
    L: 7.2, w: 2.2, wheelR: 0.45, wheelX: [2.6, -1.6, -2.6], lightY: 0.8, v: 10,
    prof: [[1.45, 0.45], [1.45, 2.65], [3.3, 2.65], [3.6, 1.9], [3.6, 0.45]],
    win: [[1.7, 1.75], [1.7, 2.5], [3.2, 2.5], [3.45, 1.75]], front: [[3.3, 2.65], [3.6, 1.9]], rear: null,
    colors: [0x2d5aa0, 0xf4f4f4, 0x2e7d32, 0xd0d0d0],
    extra: (p) => { p.dark.push(box(-1.1, 0.55, -3.6, 1.1, 0.75, 1.4)); p.rim.push(box(-1.1, 0.75, -3.6, 1.1, 3.25, 1.35)); },
  },
};

// ---------- routes: lanes offset from the real road centre lines (keep left) ----------
function poly(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, L: cum[cum.length - 1] };
}
function lane(line, off) {
  const p = smoothPts(line, 3), out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
    out.push([p[i][0] + dz * off, p[i][1] - dx * off]);
  }
  return out;
}
const L_ = ROAD_LINES;
const BUN = [...L_.BUN, ...L_.EW.filter(([x]) => x > -60)];
const NSX = [...L_.NS, [2, 200], [0, 252], ...L_.R246.filter(([x]) => x > 50)];
// junctions: signal group + stop distance before the centre (the scramble uses its painted stop lines)
const JUNC = [
  { x: 0, z: 2, scr: true }, { x: 165, z: 0, sig: ['MA', 'MB'], d: 16 }, { x: 242, z: 152, sig: ['RA', 'RB'], d: 18 },
];
const two = (line, lanes, n, o = {}) => {
  const out = [];
  for (const dir of [1, -1]) for (const off of lanes) out.push({ p: lane(dir > 0 ? line : line.slice().reverse(), off), n, ...o });
  return out;
};
const ROUTES = [
  ...two(L_.EW, [1.75, 5.1], 5, { ns: false }),
  ...two(BUN, [1.75], 4, { ns: false }),
  ...two(NSX, [1.75], 4, { ns: true }),
  ...two(L_.MEIJI, [1.75, 5.1], 5, { meiji: true }),
  ...two(L_.R246, [1.75, 5.1], 5, { r246: true }),
  ...two(L_.R246, [1.8, 5.2], 7, { y: 14.55, v: 19, shuto: true }),
];
export class Traffic {
  constructor(scene0, mobile, ground = () => 0) {
    const scene = (this.group = new THREE.Group()); scene0.add(scene);
    this.meshes = {};
    const MAT = {
      paint: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.55 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x0b1015, roughness: 0.03, metalness: 0.9, side: THREE.DoubleSide }),
      dark: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.7 }),
      rim: new THREE.MeshStandardMaterial({ color: 0xd2d6da, roughness: 0.25, metalness: 0.9 }),
    };
    this.lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const cap = mobile ? 0.7 : 1;
    this.routes = ROUTES.map((r) => ({ ...r, ...poly(r.p), y: r.y || 0, v: r.v || 11, n: Math.max(2, Math.round(r.n * cap)), veh: [] }));
    this.ground = ground;
    for (const r of this.routes) {
      r.stopS = [];
      if (r.shuto) continue;
      const near = (x, z) => { let best = 1e9, bs = 0; for (let i = 1; i < r.pts.length; i++) { const d = Math.hypot(r.pts[i][0] - x, r.pts[i][1] - z); if (d < best) { best = d; bs = r.cum[i]; } } return [best, bs]; };
      for (const J of JUNC) {
        const [dJ, sJ] = near(J.x, J.z);
        if (dJ > 14) continue;
        if (J.scr) {
          let best = null;
          for (const k in SCRAMBLE_STOP) { const [d, sp] = near(...SCRAMBLE_STOP[k]); if (d < 9 && sp < sJ && (!best || sp > best.s)) best = { s: sp, sig: k === 'N' || k === 'S' ? 'XNS' : 'XEW' }; }
          if (best) r.stopS.push(best);
        } else r.stopS.push({ s: sJ - J.d, sig: r.meiji ? J.sig[0] : J.sig[1] });
      }
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
      const G = carParts(TYPES[t]);
      const set = {};
      for (const k of ['paint', 'glass', 'dark', 'rim', 'lights']) {
        const m = new THREE.InstancedMesh(G[k], k === 'lights' ? this.lightMat : MAT[k], n);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false;
        m.castShadow = k === 'paint'; m.receiveShadow = k === 'paint';
        scene.add(m); set[k] = m;
      }
      set.body = set.paint;
      this.meshes[t] = set;
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

  update(dt, now, night, opt = {}) {
    const RAD2 = opt.radius ? opt.radius * opt.radius : 0, ground = opt.ground || this.ground, Z = new THREE.Vector3(0, 0, 0);
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
        const out = RAD2 && (r.y > 0 || x * x + z * z > RAD2);
        m4.compose(p.set(x, 0.02 + (r.y > 0 ? r.y : out ? 0 : ground(x, z)), z), q, out ? Z : sc);
        const ms = this.meshes[v.type];
        for (const k of ['paint', 'glass', 'dark', 'rim', 'lights']) ms[k].setMatrixAt(v.idx, m4);
      }
    }
    for (const t in this.meshes) for (const k of ['paint', 'glass', 'dark', 'rim', 'lights']) this.meshes[t][k].instanceMatrix.needsUpdate = true;
    this.lightMat.color.setScalar(0.55 + night * 0.9);
    this.updateSignals(S, now);
    return S;
  }

  buildSignals(scene0) {
    const scene = (this.sigGroup = new THREE.Group()); scene0.add(scene);
    const lampGeo = new THREE.CircleGeometry(0.13, 12);
    const mk = (c) => new THREE.MeshBasicMaterial({ color: c });
    this.sigMats = {};
    for (const g of ['XNS', 'XEW', 'MA', 'MB', 'RA', 'RB']) this.sigMats[g] = { g: mk(0x00e0b0), y: mk(0xffb000), r: mk(0xff2a2a) };
    const housing = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.4 });
    const pole = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.8 });
    const carSignal = (x, z, ry, grp, armLen = 3) => {
      const g = new THREE.Group();
      const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 6.2, 8).translate(0, 3.1, 0), pole); g.add(pm);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.12, 0.12).translate(armLen / 2, 5.9, 0), pole); g.add(arm);
      const hb = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.42, 0.28).translate(armLen - 0.3, 5.9, 0), housing); g.add(hb);
      [['g', -0.38], ['y', 0], ['r', 0.38]].forEach(([k, dx]) => {
        const l = new THREE.Mesh(lampGeo, this.sigMats[grp][k]); l.position.set(armLen - 0.3 + dx, 5.9, 0.15); g.add(l);
      });
      g.position.set(x, this.ground(x, z), z); g.rotation.y = ry;
      scene.add(g);
    };
    // far-side signals at the real Scramble corners; arms reach over the approaching lanes
    carSignal(8, 23.5, Math.PI, 'XNS', 7); carSignal(-2, -25, 0, 'XNS', 6);
    carSignal(-31, 10, Math.PI / 2, 'XEW', 7); carSignal(28, -7, -Math.PI / 2, 'XEW', 7);
    // Meiji-dori x Miyamasuzaka, Meiji-dori x Route 246
    carSignal(176, 16, Math.PI, 'MA', 6); carSignal(152, -18, 0, 'MA', 6);
    carSignal(150, 12, Math.PI / 2, 'MB', 6); carSignal(182, -12, -Math.PI / 2, 'MB', 6);
    carSignal(250, 168, Math.PI, 'RA', 6); carSignal(232, 136, 0, 'RA', 6);
    carSignal(226, 160, Math.PI / 2, 'RB', 6); carSignal(258, 144, -Math.PI / 2, 'RB', 6);
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
      gg.position.set(x, this.ground(x, z), z); gg.rotation.y = ry; scene.add(gg);
    };
    // one at each end of every crosswalk, facing the people waiting at the other end
    for (const c of CROSSWALKS) {
      const [ax, az] = c.a, [bx, bz] = c.b, L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, o = c.w / 2 + 0.4;
      pedSignal(ax - dx * 0.8 + dz * o, az - dz * 0.8 - dx * o, Math.atan2(dx, dz));
      pedSignal(bx + dx * 0.8 - dz * o, bz + dz * 0.8 + dx * o, Math.atan2(-dx, -dz));
    }
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

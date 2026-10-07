// Hand-built details on top of the PLATEAU city, all at their real positions: crosswalk paint at the
// Scramble, Hachikō, the giant screens, the Center Gai gate, both station platforms, rails, the Ginza
// Line viaduct and portal, and the SHIBUYA SKY deck fence.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CROSSWALKS, STOPLINES, HACHIKO, YAMA, jrAt, JR_PLAT, GINZA, ginzaAt, at } from './geo.js';
import { Screen, signTex } from './textures.js';
import { groundSet } from './pbr.js';

const PI = Math.PI;

// Sweep an open 2D profile [[lateral, y], ...] along path P from s0 to s1 (lateral + = left of travel).
// yAt(s) adds a base height. Returns a BufferGeometry with uv (u along the path / 4 m).
function sweep(P, s0, s1, prof, yAt = () => 0, ds = 2, lat = (pt) => pt) {
  const pos = [], uv = [], idx = [];
  const n = Math.max(1, Math.ceil((s1 - s0) / ds)), m = prof.length;
  let vl = [0]; for (let k = 1; k < m; k++) vl.push(vl[k - 1] + Math.hypot(prof[k][0] - prof[k - 1][0], prof[k][1] - prof[k - 1][1]));
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * i / n, p = lat(at(P, s), s), y0 = yAt(s);
    for (let k = 0; k < m; k++) {
      const [l, y] = prof[k];
      pos.push(p.x + p.dz * l, y0 + y, p.z - p.dx * l); uv.push(s / 4, vl[k] / 4);
    }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < m - 1; k++) {
    const a = i * m + k, b = a + 1, c = a + m, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildDetails(scene, phys, city) {
  const root = new THREE.Group(); root.name = 'details'; scene.add(root);
  const D = { root, screens: [], interact: [], signMats: [], lampMats: [], boardSpots: {}, platformMats: [] };
  const gy = (x, z) => city.ground(x, z);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const off = (f) => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f * 2 });
  const add = (geo, mat, o = {}) => { const m = new THREE.Mesh(geo, mat); m.castShadow = o.cast !== false; m.receiveShadow = true; root.add(m); return m; };
  const M = {
    paint: std({ color: 0xf2f2ee, roughness: 0.62, ...off(-4) }),
    conc: std({ color: 0xb5b2aa, roughness: 0.85 }),
    dark: std({ color: 0x2a2c30, roughness: 0.5, metalness: 0.3 }),
    metal: std({ color: 0xb4bac0, roughness: 0.3, metalness: 0.85 }),
    white: std({ color: 0xf1f1ee, roughness: 0.45, side: THREE.DoubleSide }),
    rail: std({ color: 0x9a948c, roughness: 0.25, metalness: 0.95 }),
    tie: std({ color: 0x8f8a83, roughness: 0.9 }),
    yellow: std({ color: 0xe8b818, roughness: 0.55, ...off(-2) }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdfeef6, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff4dc }),
  };
  const pf = groundSet('platform'), bal = groundSet('ballast');
  M.platform = std({ map: pf.map, normalMap: pf.normal, roughnessMap: pf.orm, roughness: 1, metalness: 0, emissiveMap: pf.map, emissive: 0xfff0dd, emissiveIntensity: 0 });
  M.ballast = std({ map: bal.map, normalMap: bal.normal, roughness: 0.95 });
  D.platformMats.push(M.platform);
  D.lampMats.push(M.lamp);

  // ---------- Scramble Crossing paint ----------
  {
    const bars = [];
    for (const c of CROSSWALKS) {
      const [ax, az] = c.a, [bx, bz] = c.b, L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
      const h = Math.atan2(dx, dz);
      for (let s = 0.45; s < L - 0.2; s += 0.9) {
        const x = ax + dx * s, z = az + dz * s;
        const g = new THREE.PlaneGeometry(0.45, c.w).rotateX(-PI / 2).rotateY(h + PI / 2);
        g.translate(x, gy(x, z) + 0.035, z); bars.push(g);
      }
    }
    for (const l of STOPLINES) {
      const [ax, az] = l.a, [bx, bz] = l.b, L = Math.hypot(bx - ax, bz - az), x = (ax + bx) / 2, z = (az + bz) / 2;
      const g = new THREE.PlaneGeometry(L, 0.45).rotateX(-PI / 2).rotateY(-Math.atan2(bz - az, bx - ax));
      g.translate(x, gy(x, z) + 0.035, z); bars.push(g);
    }
    const m = add(mergeGeometries(bars), M.paint, { cast: false }); m.userData.noAO = true;
  }

  // ---------- Hachikō ----------
  {
    const { x, z, yaw } = HACHIKO, y = gy(x, z) + 0.12;
    add(new THREE.BoxGeometry(1.7, 1.45, 1.3).translate(x, y + 0.72, z), M.conc);
    phys.box(x, z, 2.2, 1.8, y - 1, y + 3);
    const bronze = std({ color: 0x4a4130, roughness: 0.32, metalness: 0.75 });
    const dog = new THREE.Group();
    const part = (g, px, py, pz, rx = 0) => { const m = new THREE.Mesh(g, bronze); m.position.set(px, py, pz); m.rotation.x = rx; m.castShadow = true; dog.add(m); };
    part(new THREE.CapsuleGeometry(0.24, 0.55, 4, 10), 0, 0.55, -0.1, 0.55);
    part(new THREE.SphereGeometry(0.21, 14, 10), 0, 1.05, 0.28);
    part(new THREE.CapsuleGeometry(0.09, 0.14, 4, 8), 0, 0.98, 0.5, PI / 2);
    for (const sx of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.17, 6), bronze); e.position.set(sx, 1.27, 0.22); e.rotation.z = -sx * 0.6; dog.add(e); }
    for (const sx of [-0.15, 0.15]) part(new THREE.CapsuleGeometry(0.06, 0.48, 3, 6), sx, 0.3, 0.3);
    for (const sx of [-0.19, 0.19]) part(new THREE.CapsuleGeometry(0.1, 0.32, 3, 6), sx, 0.15, -0.35, PI / 2);
    part(new THREE.TorusGeometry(0.12, 0.04, 6, 10), 0, 0.5, -0.62);
    dog.position.set(x, y + 1.45, z); dog.rotation.y = yaw; dog.scale.setScalar(1.12);
    root.add(dog);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.3), new THREE.MeshBasicMaterial({ map: signTex('忠犬ハチ公', { w: 256, h: 80, bg: '#3d3b36', fg: '#e8e2d0' }) }));
    plate.position.set(x + Math.sin(yaw) * 0.66, y + 0.85, z + Math.cos(yaw) * 0.66); plate.rotation.y = yaw; root.add(plate);
  }

  // ---------- giant screens on the real facades ----------
  const screen = (seed, x, z, y0, w, h, ry) => {
    const s = new Screen(seed, 256, Math.round(256 * h / w));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false }));
    m.position.set(x, y0 + h / 2, z); m.rotation.y = ry; root.add(m);
    const bez = add(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.4), M.dark);
    bez.position.set(x - Math.sin(ry) * 0.22, y0 + h / 2, z - Math.cos(ry) * 0.22); bez.rotation.y = ry;
    D.screens.push({ s, m, x, y: y0 + h / 2, z });
  };
  // QFRONT (Q's EYE) on the south face toward the crossing; MAGNET by SHIBUYA109 on its west face
  screen(11, -8.9, -29.25, 7, 13.5, 17, Math.atan2(0.107, 0.994));
  screen(23, 24.1, -21.85, 9, 7.5, 9.5, Math.atan2(-0.98, -0.2));

  // ---------- landmark name signs ----------
  {
    const plaque = (text, x, z, y, w, h, ry, o) => {
      const mat = new THREE.MeshBasicMaterial({ map: signTex(text, { w: Math.round(w * 64), h: Math.round(h * 64), ...o }), toneMapped: false });
      D.signMats.push(mat);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; root.add(m);
    };
    const qr = Math.atan2(0.107, 0.994);
    plaque('QFRONT', -8.9, -29.2, 27.5, 9, 2.2, qr, { bg: '#111', fg: '#fff', weight: 900 });
    plaque(['SHIBUYA TSUTAYA', 'Starbucks 2F'], -8.9, -29.3, 5.2, 12, 1.3, qr, { bg: '#0d2a6b', fg: '#fff' });
    plaque('MAGNET by SHIBUYA109', 24.0, -21.9, 21, 10, 1.6, Math.atan2(-0.98, -0.2), { bg: '#f4f4f2', fg: '#1b1d21' });
    // SHIBUYA109's cylinder: a curved name band near the top, facing the crossing
    const tex = signTex('SHIBUYA109', { w: 1024, h: 160, bg: '#202024', fg: '#f2f2f2' });
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.FrontSide }); D.signMats.push(mat);
    const g = new THREE.CylinderGeometry(6.0, 6.0, 4.2, 40, 1, true, Math.PI / 2 - 1.1, 2.2);
    const band = new THREE.Mesh(g, mat); band.position.set(-136.8, 40, -7.3); root.add(band);
  }

  // ---------- Center Gai gate (street heads north-west from the Q-FRONT corner) ----------
  {
    const ux = -0.67, uz = -0.74, px = uz, pz = -ux; // street dir, across-street
    const cx = -20.6, cz = -17.6, y = gy(cx, cz);
    for (const s of [-4.2, 4.2]) {
      const x = cx + px * s, z = cz + pz * s;
      add(new THREE.CylinderGeometry(0.2, 0.22, 7.2, 10).translate(x, y + 3.6, z), M.metal);
      phys.box(x, z, 0.5, 0.5, y - 1, y + 7);
    }
    const h = Math.atan2(px, pz);
    const beam = add(new THREE.BoxGeometry(9.2, 1.5, 0.5), M.dark); beam.position.set(cx, y + 7.2, cz); beam.rotation.y = h - PI / 2;
    const tex = signTex(['SHIBUYA CENTER GAI', '渋谷センター街'], { w: 1024, h: 168, bg: '#e8380d', fg: '#fff' });
    const mat = new THREE.MeshBasicMaterial({ map: tex }); D.signMats.push(mat);
    for (const sd of [1, -1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 1.35), mat);
      m.position.set(cx - ux * 0.27 * sd, y + 7.2, cz - uz * 0.27 * sd); m.rotation.y = Math.atan2(-ux * sd, -uz * sd); root.add(m);
    }
  }

  // ---------- JR Yamanote Line: rails, island platform, canopy ----------
  const railsAlong = (P, s0, s1, latFn, yFn) => {
    const geos = [];
    for (const side of [-1, 1]) for (const r of [-0.5335, 0.5335]) {
      geos.push(sweep(P, s0, s1, [[r - 0.035, -0.16], [r - 0.035, 0], [r + 0.035, 0], [r + 0.035, -0.16]], yFn, 3, (p, s) => latFn(p, s, side)));
    }
    add(mergeGeometries(geos), M.rail, { cast: false });
    // sleepers
    const tie = new THREE.BoxGeometry(2.0, 0.14, 0.22);
    const mats = [];
    for (const side of [-1, 1]) for (let s = s0; s < s1; s += 0.62) {
      const p = latFn(at(P, s), s, side);
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, yFn(s) - 0.23, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.h), new THREE.Vector3(1, 1, 1)));
    }
    const im = new THREE.InstancedMesh(tie, M.tie, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.receiveShadow = true; root.add(im);
    for (const side of [-1, 1]) add(sweep(P, s0, s1, [[-1.6, -0.3], [1.6, -0.3]], yFn, 3, (p, s) => latFn(p, s, side)), M.ballast, { cast: false });
  };
  {
    const jrLat = (p, s, side) => { const q = jrAt(s, side); return { ...p, x: q.x, z: q.z }; };
    const yR = (s) => YAMA.y(s);
    railsAlong(YAMA, 20, YAMA.L - 20, jrLat, yR);
    const { s0, s1, half, y, open } = JR_PLAT;
    const yP = () => y;
    add(sweep(YAMA, s0, s1, [[-half, -1.15], [-half, 0], [half, 0], [half, -1.15]], yP, 2), M.platform, { cast: false });
    add(sweep(YAMA, s0, s1, [[-half + 0.55, 0.012], [-half + 0.85, 0.012]], yP, 2), M.yellow, { cast: false });
    add(sweep(YAMA, s0, s1, [[half - 0.85, 0.012], [half - 0.55, 0.012]], yP, 2), M.yellow, { cast: false });
    // canopy over the open-air north part, and a ceiling inside the station
    add(sweep(YAMA, s0 - 2, open, [[-half - 0.9, 4.3], [0, 4.6], [half + 0.9, 4.3]], yP, 2), M.white);
    add(sweep(YAMA, open, s1, [[-half - 0.5, 4.4], [half + 0.5, 4.4]], yP, 3), M.white);
    for (const l of [-1.6, 1.6]) add(sweep(YAMA, s0, s1, [[l + 0.12, 4.25], [l - 0.12, 4.25]], yP, 3), M.lamp, { cast: false });
    for (let s = s0 + 4; s < s1; s += 9) {
      const p = at(YAMA, s);
      add(new THREE.CylinderGeometry(0.16, 0.16, 4.4, 8).translate(p.x, y + 2.2, p.z), M.metal);
      phys.box(p.x, p.z, 0.4, 0.4, y - 1, y + 4.5);
    }
    // physics: floor strips + platform screen door line + ends
    for (let s = s0; s < s1; s += 5) {
      const p = at(YAMA, s + 2.5);
      phys.floor(p.x, p.z, half * 2, 5.3, y, p.h);
      for (const sd of [-1, 1]) phys.box(p.x + p.dz * sd * (half - 0.1), p.z - p.dx * sd * (half - 0.1), 0.25, 5.3, y - 1, y + 1.5, p.h);
    }
    for (const s of [s0 - 0.3, s1 + 0.3]) { const p = at(YAMA, s); phys.box(p.x, p.z, half * 2, 0.4, y - 1, y + 3, p.h); }
    // station signs hanging from the canopy
    const nameTex = signTex(['しぶや', 'Shibuya  JY 20'], { w: 512, h: 160, bg: '#f4f4f2', fg: '#1b1d21', stripe: '#80c241' });
    const nm = new THREE.MeshBasicMaterial({ map: nameTex }); D.signMats.push(nm);
    for (let s = s0 + 12; s < s1; s += 40) {
      const p = at(YAMA, s);
      for (const sd of [1, -1]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), nm);
        m.position.set(p.x + p.dz * sd * 1.2, y + 3.4, p.z - p.dx * sd * 1.2); m.rotation.y = p.h + (sd > 0 ? PI / 2 : -PI / 2); root.add(m);
      }
    }
    const b1 = at(YAMA, s0 + 26), b2 = at(YAMA, s0 + 74);
    D.boardSpots.jr = [[b1.x, y + 3.15, b1.z, b1.h + PI], [b2.x, y + 3.15, b2.z, b2.h + PI]];
    D.boardSpots.jrPath = YAMA;
    const e = at(YAMA, s0 + 6);
    D.interact.push({ x: e.x, y, z: e.z, r: 3.5, jp: 'ハチ公口へ出る', en: 'Exit to Hachikō Square', to: [44, 0, 38], yaw: -PI / 2 });
    D.interact.push({ x: 45.5, y: 0, z: 38, r: 3.5, jp: 'ハチ公改札 → 山手線ホーム', en: 'Hachikō Gate → Yamanote Line platform', to: [e.x, y + 0.1, e.z], yaw: PI });
  }

  // ---------- Ginza Line: terminal platform, viaduct, portal ----------
  {
    const C = GINZA.centre, R = GINZA.rail, y = GINZA.plat, half = GINZA.half;
    const gLat = (p, s, side) => { const q = ginzaAt(s, side); return { ...p, x: q.x, z: q.z }; };
    railsAlong(C, 0, GINZA.portal + 6, gLat, () => R);
    add(sweep(C, GINZA.s0, GINZA.s1, [[-half, -1.1], [-half, 0], [half, 0], [half, -1.1]], () => y, 2), M.platform, { cast: false });
    add(sweep(C, GINZA.s0, GINZA.s1, [[-half + 0.55, 0.012], [-half + 0.85, 0.012]], () => y, 2), M.yellow, { cast: false });
    add(sweep(C, GINZA.s0, GINZA.s1, [[half - 0.85, 0.012], [half - 0.55, 0.012]], () => y, 2), M.yellow, { cast: false });
    // track bed inside the station and the viaduct girder outside
    add(sweep(C, 0, 108, [[-10.5, -0.3], [10.5, -0.3]], () => R, 3), M.conc, { cast: false });
    add(sweep(C, 104, GINZA.portal, [[-5.5, -0.3], [5.5, -0.3]], () => R, 3), M.conc, { cast: false });
    add(sweep(C, 104, GINZA.portal, [[5.5, -0.3], [5.5, -2.1], [-5.5, -2.1], [-5.5, -0.3]], () => R, 3), M.conc);
    for (let s = 112; s < GINZA.portal - 6; s += 18) {
      const p = at(C, s), g0 = city.ground(p.x, p.z);
      add(new THREE.BoxGeometry(3.6, R - 2.1 - g0 + 0.3, 1.4).translate(0, (R - 2.1 + g0) / 2, 0).rotateY(p.h).translate(p.x, 0, p.z), M.conc);
      phys.box(p.x, p.z, 3.6, 1.4, g0 - 1, R - 2, p.h);
    }
    { // tunnel portal headwall
      const p = at(C, GINZA.portal), g0 = city.ground(p.x, p.z);
      const wall = new THREE.Shape([[-7, g0 - R - 1], [7, g0 - R - 1], [7, 6], [-7, 6]].map(([a, b]) => new THREE.Vector2(a, b)));
      wall.holes.push(new THREE.Path([[-4, -0.3], [4, -0.3], [4, 4.6], [-4, 4.6]].map(([a, b]) => new THREE.Vector2(a, b))));
      const g = new THREE.ExtrudeGeometry(wall, { depth: 1.2, bevelEnabled: false }).translate(0, R, -0.6).rotateY(p.h).translate(p.x, 0, p.z);
      add(g, M.conc);
      const dark = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 5).translate(0, R + 2.2, 0).rotateY(p.h + PI).translate(p.x + p.dx * 4, 0, p.z + p.dz * 4), new THREE.MeshBasicMaterial({ color: 0x050505 }));
      root.add(dark);
    }
    // M-shaped vaulted ceiling over the platform and tracks
    const prof = [];
    for (let k = 0; k <= 24; k++) { const l = -10.5 + k * 21 / 24, t = ((l + 10.5) % 10.5) / 10.5; prof.push([l, 6.3 + 2.0 * Math.sin(PI * t)]); }
    add(sweep(C, 0, 112, prof, () => y, 3), M.white);
    for (const l of [-5.25, 5.25]) add(sweep(C, 0, 112, [[l + 0.2, 8.15], [l - 0.2, 8.15]], () => y, 3), M.lamp, { cast: false });
    for (let s = GINZA.s0; s < GINZA.s1; s += 5) {
      const p = at(C, s + 2.5);
      phys.floor(p.x, p.z, half * 2, 5.3, y, p.h);
      for (const sd of [-1, 1]) phys.box(p.x + p.dz * sd * (half - 0.1), p.z - p.dx * sd * (half - 0.1), 0.25, 5.3, y - 1, y + 1.5, p.h);
    }
    for (const s of [GINZA.s0 - 0.3, GINZA.s1 + 0.3]) { const p = at(C, s); phys.box(p.x, p.z, half * 2, 0.4, y - 1, y + 3, p.h); }
    const nameTex = signTex(['しぶや', 'Shibuya  G 01'], { w: 512, h: 160, bg: '#f4f4f2', fg: '#1b1d21', stripe: '#f39700' });
    const nm = new THREE.MeshBasicMaterial({ map: nameTex }); D.signMats.push(nm);
    for (let s = GINZA.s0 + 15; s < GINZA.s1; s += 35) {
      const p = at(C, s);
      for (const sd of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), nm); m.position.set(p.x + p.dz * sd * 1.2, y + 3.2, p.z - p.dx * sd * 1.2); m.rotation.y = p.h + (sd > 0 ? PI / 2 : -PI / 2); root.add(m); }
    }
    const b1 = at(C, GINZA.s0 + 22), b2 = at(C, GINZA.s0 + 62);
    D.boardSpots.ginza = [[b1.x, y + 3.0, b1.z, b1.h + PI], [b2.x, y + 3.0, b2.z, b2.h + PI]];
    const e = at(C, GINZA.s0 + 3);
    D.interact.push({ x: e.x, y, z: e.z, r: 3.5, jp: '東口へ出る', en: 'Exit to the East Exit', to: [132, 0, 18], yaw: PI / 2 });
    D.interact.push({ x: 132, y: 0, z: 18, r: 3.5, jp: '銀座線 渋谷駅へ', en: 'Ginza Line · Shibuya station', to: [e.x, y + 0.1, e.z], yaw: e.h });
  }

  // ---------- SHIBUYA SKY: glass fence on the Scramble Square roof, elevators ----------
  {
    const cs = [[124.9, 108.9], [168.6, 87.4], [190.8, 139.8], [142.7, 159.5]];
    const yR = 227.4;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = cs[i], [bx, bz] = cs[(i + 1) % 4], L = Math.hypot(bx - ax, bz - az), h = Math.atan2(bx - ax, bz - az);
      const g = new THREE.PlaneGeometry(L, 2.4).rotateY(h - PI / 2).translate((ax + bx) / 2, yR + 1.2, (az + bz) / 2);
      add(g, M.glass, { cast: false });
      phys.box((ax + bx) / 2, (az + bz) / 2, 0.3, L, yR - 2, yR + 8, h);
    }
    D.interact.push({ x: 132, y: 0, z: 30, r: 3, jp: 'スクランブルスクエア → SHIBUYA SKY', en: 'Elevator to SHIBUYA SKY (229.7 m)', to: [150, 236, 120], yaw: -2.2 });
    D.interact.push({ x: 150, y: 229, z: 120, r: 4, jp: 'エレベーターで地上へ', en: 'Elevator down to street', to: [132, 0, 33], yaw: 0 });
  }
  return D;
}

import * as THREE from 'three';
import { Batch } from './batch.js';
import { facades, groundTex, signTex, Screen, vsignAtlas, canvas, toTex, JP } from './textures.js';
import { rng, obb, obbOverlap, Grid, toWorld } from './util.js';
import { ROADS, CENTER_GAI, HACHIKO, SIDEWALK, JR, GZ, aab, seg, ginzaAt, GINZA_LEN, GINZA_PORTAL_S } from './layout.js';

const R = rng(20261007);

export function buildWorld(scene, phys) {
  const F = facades();
  const B = new Batch();
  const world = { screens: [], signMats: [], glowMats: [], winMats: [], shopMats: [], pools: null, trees: [], lamps: [], vend: [], foot: [], interact: [], beacons: [] };

  // ---------- materials ----------
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const M = {};
  for (const k in F) {
    M[k] = lam({ map: F[k].map, emissiveMap: F[k].emi, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true });
    (k.startsWith('shop') ? world.shopMats : world.winMats).push(M[k]);
  }
  const gt = {};
  for (const k of ['asphalt', 'paving', 'brick', 'granite', 'grass', 'ballast', 'platform', 'deck', 'roof', 'water']) gt[k] = groundTex(k);
  M.roof = lam({ map: gt.roof, vertexColors: true });
  M.asphalt = lam({ map: gt.asphalt, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  M.paving = lam({ map: gt.paving });
  M.brick = lam({ map: gt.brick, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  M.granite = lam({ map: gt.granite, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  M.grass = lam({ map: gt.grass, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  M.ballast = lam({ map: gt.ballast });
  M.platform = lam({ map: gt.platform, vertexColors: true });
  M.deck = lam({ map: gt.deck });
  world.groundMats = [M.asphalt, M.paving, M.brick, M.granite, M.deck];
  for (const m of [...world.groundMats, M.platform]) { m.emissiveMap = m.map; m.emissive = new THREE.Color(0xffe2bf); m.emissiveIntensity = 0; }
  M.water = new THREE.MeshPhongMaterial({ map: gt.water, shininess: 90, specular: 0x88aabb });
  M.mark = lam({ color: 0xf0f0ec, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  M.yellow = lam({ color: 0xe8c02a, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  M.conc = lam({ color: 0xc4c0b8, vertexColors: true });
  M.dark = lam({ color: 0x33363b, vertexColors: true });
  M.metal = lam({ color: 0xa3aab1, vertexColors: true });
  M.paint = lam({ color: 0xf2f2ef, vertexColors: true });
  M.rail = new THREE.MeshPhongMaterial({ color: 0x8a8580, shininess: 80 });
  M.glassT = new THREE.MeshLambertMaterial({ color: 0xdcecf4, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, fog: false });
  M.glow = new THREE.MeshBasicMaterial({ color: 0xfff2d0 });
  M.ceiling = lam({ color: 0xe9e7e2, emissive: 0xfff8ec, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  world.glowMats.push(M.glow);
  // rail ties
  {
    const c = canvas(128, 512), g = c.getContext('2d');
    g.drawImage(gt.ballast.image, 0, 0, 128, 512);
    for (let i = 0; i < 6; i++) { const y = i * 512 / 6 + 20; g.fillStyle = '#9a958e'; g.fillRect(14, y, 100, 30); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(14, y + 26, 100, 4); }
    const t = toTex(c); M.ties = lam({ map: t });
  }
  // vending machine front
  {
    const c = canvas(128, 256), g = c.getContext('2d');
    g.fillStyle = '#eef2f5'; g.fillRect(0, 0, 128, 256);
    g.fillStyle = '#1b2833'; g.fillRect(8, 10, 112, 150);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { g.fillStyle = `hsl(${R() * 360},70%,${45 + R() * 25}%)`; g.fillRect(14 + k * 18, 18 + r * 36, 12, 24); g.fillStyle = '#6cf'; g.fillRect(14 + k * 18, 44 + r * 36, 12, 3); }
    g.fillStyle = '#c4161c'; g.fillRect(0, 170, 128, 20);
    g.fillStyle = '#333'; g.fillRect(30, 205, 68, 30);
    M.vend = lam({ map: toTex(c, false), emissive: 0xffffff, emissiveMap: toTex(c, false), emissiveIntensity: 0.25 });
    world.shopMats.push(M.vend);
  }
  // light pools
  {
    const c = canvas(128, 128), g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,220,170,0.75)'); gr.addColorStop(0.5, 'rgba(255,210,150,0.25)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    M.pool = new THREE.MeshBasicMaterial({ map: toTex(c, false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    world.pools = M.pool;
  }
  // vertical sign atlas
  const VS = vsignAtlas();
  M.vsign = lam({ map: VS.map, emissiveMap: VS.emi, emissive: 0xffffff, emissiveIntensity: 0.2 });
  world.shopMats.push(M.vsign);
  // rooftop billboard atlas
  const BB = (() => {
    const c = canvas(1024, 512), g = c.getContext('2d');
    const ads = [['渋谷', '#e60039', '#fff'], ['NEW ALBUM', '#111', '#ffd400'], ['美味しい', '#ffcf00', '#c4161c'], ['TOKYO', '#0068b7', '#fff'], ['夏の終わり', '#f39', '#fff'], ['GAME', '#2a2', '#fff'], ['MUSIC', '#7d3cff', '#fff'], ['SALE', '#ff5a00', '#fff']];
    ads.forEach(([t, bg, fg], i) => {
      const x = (i % 4) * 256, y = Math.floor(i / 4) * 256;
      g.fillStyle = bg; g.fillRect(x + 4, y + 60, 248, 136);
      g.fillStyle = fg; g.font = `900 ${t.length > 5 ? 40 : 60}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t, x + 128, y + 128, 230);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(x + 210, y + 90, 22, 0, 7); g.fill();
    });
    return { map: toTex(c, false) };
  })();
  M.bill = lam({ map: BB.map, emissiveMap: BB.map, emissive: 0xffffff, emissiveIntensity: 0.15, side: THREE.DoubleSide });
  world.shopMats.push(M.bill);

  // ---------- reservation grid (to keep filler buildings out of roads/landmarks) ----------
  const res = new Grid(40);
  const reserve = (o, pad = 0) => {
    const r = pad ? obb(o.cx, o.cz, o.hw + pad, o.hd + pad, o.rot) : o;
    res.add(r, r.cx - r.r, r.cz - r.r, r.cx + r.r, r.cz + r.r);
    return r;
  };
  const free = (o, m = 0) => {
    const seen = new Set();
    for (const [x, z] of [[o.cx, o.cz], ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toWorld(o, a * o.hw, b * o.hd))]) {
      for (const it of res.query(x, z)) {
        if (seen.has(it)) continue; seen.add(it);
        if (obbOverlap(o, it, m)) return false;
      }
    }
    // also check cells along the long axis
    const n = Math.ceil(o.hw / 20);
    for (let i = -n; i <= n; i++) {
      const [x, z] = toWorld(o, (i / Math.max(n, 1)) * o.hw, 0);
      for (const it of res.query(x, z)) { if (seen.has(it)) continue; seen.add(it); if (obbOverlap(o, it, m)) return false; }
    }
    return true;
  };
  const tint = () => { const v = 0.86 + R() * 0.16; return [v * (0.97 + R() * 0.06), v, v * (0.96 + R() * 0.06)]; };

  // building helper: o (obb), h, kind, opts
  function building(o, h, kind, opt = {}) {
    const f = F[kind] || F.concrete;
    const rt = 0.5 + R() * 0.5, rh = R();
    B.box({ topCol: [rt * (rh < 0.2 ? 0.85 : 1), rt * (rh > 0.8 ? 0.92 : 1), rt * (rh < 0.2 ? 0.8 : rh > 0.8 ? 0.85 : 1)], x: o.cx, z: o.cz, w: o.hw * 2, d: o.hd * 2, rot: o.rot, h, y0: opt.y0 || 0, key: kind, tw: f.tw, th: f.th, uo: R() * 40, col: opt.col || tint(), shop: opt.shop === false ? null : R.pick(['shop', 'shop2', 'shop3', 'shop4']), shopH: 4.5, vbase: opt.vbase ?? 4.5, top: opt.top, sides: opt.sides });
    if (!opt.noCollide) phys.box(o.cx, o.cz, o.hw * 2, o.hd * 2, opt.y0 || 0, (opt.y0 || 0) + h, o.rot);
    reserve(o);
    world.foot.push({ o, h, y0: opt.y0 || 0 });
    return o;
  }
  const abox = (x0, z0, x1, z1, h, kind, opt) => building(aab(x0, z0, x1, z1), h, kind, opt);

  // sign mesh
  function sign(text, x, y, z, w, h, rotY, o = {}) {
    const ppm = o.ppm || 96;
    const tex = signTex(text, { ...o, w: Math.min(2048, Math.max(64, Math.round(w * ppm))), h: Math.min(1024, Math.max(32, Math.round(h * ppm))) });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !!o.transparent });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = rotY;
    if (o.double) { const m2 = m.clone(); m2.rotation.y += Math.PI; scene.add(m2); }
    if (o.lit !== false) world.signMats.push(mat);
    scene.add(m);
    return m;
  }
  function screen(seed, x, y, z, w, h, rotY) {
    const s = new Screen(seed, 256, Math.round(256 * h / w));
    const mat = new THREE.MeshBasicMaterial({ map: s.tex });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = rotY;
    scene.add(m);
    // bezel
    B.box({ x: x - Math.sin(rotY) * 0.25, z: z - Math.cos(rotY) * 0.25, w: w + 0.6, d: 0.4, h: h + 0.6, y0: y - h / 2 - 0.3, rot: rotY, key: 'dark', top: 'dark', tw: 4, th: 4 });
    world.screens.push({ s, m, x, y, z });
    return m;
  }
  world.sign = sign;

  // ---------- ground ----------
  const groundRects = [aab(-480, -480, 480, 60), aab(-480, 60, 222, 590), aab(234, 60, 480, 590)];
  for (const o of groundRects) B.rect('paving', o.cx, o.cz, o.hw, o.hd, 0, 0, 4);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), lam({ color: 0x6d6c68 }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.3; far.receiveShadow = false;
  scene.add(far);
  world.farGround = far;

  // ---------- roads & markings ----------
  for (const r of ROADS) {
    const o = r.o;
    B.rect('asphalt', o.cx, o.cz, o.hw, o.hd, 0.02, o.rot, 8);
    reserve(o, SIDEWALK);
    if (r.id === 'X') continue;
    // curbs along long edges
    const long = o.hw > o.hd;
    const L = long ? o.hw : o.hd, W = long ? o.hd : o.hw;
    for (const sd of [-1, 1]) {
      const [cx, cz] = long ? toWorld(o, 0, sd * (W + 0.12)) : toWorld(o, sd * (W + 0.12), 0);
      B.box({ x: cx, z: cz, w: long ? L * 2 : 0.24, d: long ? 0.24 : L * 2, rot: o.rot, h: 0.15, key: 'conc', top: 'conc', tw: 4, th: 4 });
    }
    // centre line (dashed)
    if (W >= 6) {
      for (let a = -L + 2; a < L - 2; a += 8) {
        const [cx, cz] = long ? toWorld(o, a + 2.5, 0) : toWorld(o, 0, a + 2.5);
        B.rect('mark', cx, cz, long ? 2.5 : 0.08, long ? 0.08 : 2.5, 0.04, o.rot);
      }
    }
    if (W >= 9) for (const sd of [-1, 1]) for (let a = -L + 2; a < L - 2; a += 10) {
      const [cx, cz] = long ? toWorld(o, a + 2, sd * W / 2) : toWorld(o, sd * W / 2, a + 2);
      B.rect('mark', cx, cz, long ? 2 : 0.06, long ? 0.06 : 2, 0.04, o.rot);
    }
  }
  // Center Gai pedestrian street (coloured paving)
  B.rect('brick', CENTER_GAI.cx, CENTER_GAI.cz, CENTER_GAI.hw, CENTER_GAI.hd, 0.02, CENTER_GAI.rot, 4);
  reserve(CENTER_GAI);
  // Hachiko square
  B.rect('granite', HACHIKO.cx, HACHIKO.cz, HACHIKO.hw, HACHIKO.hd, 0.015, 0, 3);
  reserve(HACHIKO);

  // zebra crossing helper
  function zebra(ax, az, bx, bz, width) {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const rot = Math.atan2(-uz, ux);
    for (let t = 0.5; t < L - 0.3; t += 0.9) B.rect('mark', ax + ux * t, az + uz * t, 0.225, width / 2, 0.045, rot);
  }
  // Scramble crossing: four sides + two diagonals
  zebra(-10, -18.5, 10, -18.5, 7);
  zebra(-10, 18.5, 10, 18.5, 7);
  zebra(18.5, -9, 18.5, 9, 7);
  zebra(-18.5, -6, -18.5, 10, 7);
  zebra(-13, -13, 13, 13, 6);
  zebra(13, -13, -13, 13, 6);
  // stop lines
  B.rect('mark', 5, -23, 5, 0.25, 0.045); B.rect('mark', -5, 23, 5, 0.25, 0.045);
  B.rect('mark', 23, 4.5, 0.25, 4.5, 0.045); B.rect('mark', -23, -2, 0.25, 4, 0.045);
  // Meiji-dori x Road E, Meiji x 246, Road S x 246
  zebra(190, -12.5, 210, -12.5, 5); zebra(190, 12.5, 210, 12.5, 5);
  zebra(186.5, -9, 186.5, 9, 5); zebra(213.5, -9, 213.5, 9, 5);
  zebra(190, 194.5, 210, 194.5, 5); zebra(190, 229.5, 210, 229.5, 5);
  zebra(-10, 194.5, 10, 194.5, 5);

  // ---------- landmarks ----------
  const PI = Math.PI;
  // Q-FRONT (Tsutaya) with the giant corner screen
  abox(-48, -64, -26, -32, 36, 'glass');
  abox(-26, -64, -14, -46, 36, 'glass');
  {
    const P = [-26, -32], Q = [-14, -46];
    const dx = Q[0] - P[0], dz = Q[1] - P[1], L = Math.hypot(dx, dz);
    const nx = -dz / L, nz = dx / L; // outward (SE)
    const n2 = [nz < 0 ? -nx : nx, nz < 0 ? -nz : nz];
    const mx = (P[0] + Q[0]) / 2, mz = (P[1] + Q[1]) / 2;
    const o = obb(mx - n2[0] * 4.5, mz - n2[1] * 4.5, L / 2, 4.5, Math.atan2(-dz, dx));
    building(o, 36, 'glass', { col: [0.9, 0.95, 1] });
    const ry = Math.atan2(n2[0], n2[1]);
    screen(1, mx + n2[0] * 0.5, 19, mz + n2[1] * 0.5, 15, 19, ry);
    sign('QFRONT', mx + n2[0] * 0.5, 31.5, mz + n2[1] * 0.5, 10, 2.4, ry, { bg: '#111', fg: '#fff', font: 'Arial Black,Arial,sans-serif' });
    sign('TSUTAYA', -13.9, 6.3, -56, 9, 2, PI / 2, { bg: '#0c1f6e', fg: '#ffd400', font: 'Arial Black,Arial,sans-serif' });
    sign('TSUTAYA', -37, 6.3, -31.9, 9, 2, 0, { bg: '#0c1f6e', fg: '#ffd400', font: 'Arial Black,Arial,sans-serif' });
  }
  // MAGNET by SHIBUYA109
  abox(-50, -20, -20, -10, 40, 'white');
  screen(2, -19.6, 26, -15, 9, 13, PI / 2);
  screen(3, -35, 22, -9.6, 14, 8, 0);
  sign('MAGNET by SHIBUYA109', -19.6, 36.5, -15, 9.4, 2.2, PI / 2, { bg: '#111', fg: '#fff', font: 'Arial Black,Arial,sans-serif' });
  // NE corner building with screens
  abox(20, -60, 56, -18, 34, 'concrete');
  screen(4, 38, 20, -17.6, 16, 10, 0);
  screen(5, 19.6, 22, -38, 12, 8, -PI / 2);
  // SW corner building
  abox(-48, 16, -20, 44, 30, 'tile');
  screen(6, -34, 19, 15.6, 14, 9, PI);
  screen(7, -19.6, 18, 30, 10, 7, PI / 2);
  reserve(aab(-20, -24, -10, -6)); reserve(aab(10, -24, 20, -9)); reserve(aab(-20, 10, -10, 24));
  // Koban (police box) at Hachiko square
  abox(18, 24, 24, 29, 4.2, 'white', { shop: false, col: [0.85, 0.82, 0.78] });
  sign('KOBAN 交番', 21, 3.6, 23.9, 4, 0.7, PI, { bg: '#f4f1ea', fg: '#222' });
  {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    lamp.position.set(21, 4.5, 23.6); scene.add(lamp);
  }
  // Shibuya 109
  {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 46, 32, 1, true), lam({ map: (() => { const t = F.silver.map.clone(); t.repeat.set(7, 3.8); t.needsUpdate = true; return t; })() }));
    cyl.position.set(-172, 23, 2); cyl.castShadow = cyl.receiveShadow = true; scene.add(cyl);
    const capm = new THREE.Mesh(new THREE.CircleGeometry(9, 32), M.roof); capm.rotation.x = -PI / 2; capm.position.set(-172, 46, 2); scene.add(capm);
    phys.box(-172, 2, 15, 15, 0, 46);
    reserve(obb(-172, 2, 9, 9));
    abox(-215, -12, -178, 16, 40, 'silver');
    // pylon with vertical sign
    B.box({ x: -162.2, z: 2, w: 1.4, d: 3.4, h: 38, y0: 12, key: 'paint', top: 'paint' });
    sign('SHIBUYA109', -161.45, 31, 2, 2.6, 26, PI / 2, { vertical: true, bg: '#f7f7f7', fg: '#111', font: 'Arial Black,Arial,sans-serif' });
    sign('109', -161.45, 47.5, 2, 3.2, 3, PI / 2, { bg: '#111', fg: '#fff', font: 'Arial Black,Arial,sans-serif' });
    screen(8, -164, 8, 2, 6, 4, PI / 2);
  }
  // Seibu A & B with bridges
  abox(14, -160, 48, -75, 45, 'white');
  abox(-46, -170, -14, -100, 40, 'white');
  B.box({ x: 0, z: -139, w: 28, d: 5, h: 4, y0: 12, key: 'glass', top: 'roof' });
  B.box({ x: 0, z: -125, w: 28, d: 5, h: 4, y0: 20, key: 'glass', top: 'roof' });
  sign('SEIBU', 13.8, 38, -100, 9, 2.4, -PI / 2, { bg: '#fff', fg: '#111', font: 'Georgia,serif' });
  sign('SEIBU', -13.8, 33, -135, 9, 2.4, PI / 2, { bg: '#fff', fg: '#111', font: 'Georgia,serif' });
  // MODI
  abox(14, -215, 50, -172, 40, 'glass');
  sign('MODI', 13.8, 32, -193, 7, 2.6, -PI / 2, { bg: '#e60012', fg: '#fff', font: 'Arial Black,Arial,sans-serif' });
  // PARCO on Koen-dori
  {
    const k = ROADS.find((r) => r.id === 'KOEN').o;
    const [cx, cz] = toWorld(k, 20, -6.5 - 4 - 22);
    const o = building(obb(cx, cz, 26, 22, k.rot), 92, 'darkglass');
    const [sx, sz] = toWorld(o, 8, 22.3);
    sign('PARCO', sx, 80, sz, 14, 3.6, k.rot, { bg: '#111', fg: '#fff', font: 'Georgia,serif' });
  }
  // Mark City + Excel Hotel Tokyu + walkway over road S
  abox(-150, 50, -14, 95, 24, 'concrete');
  abox(-130, 55, -90, 90, 100, 'white');
  sign('SHIBUYA EXCEL HOTEL TOKYU', -110, 96, 54.8, 30, 2.4, PI, { bg: '#2b2b2b', fg: '#fff' });
  abox(14, 96, 80, 138, 24, 'concrete');
  sign('SHIBUYA MARK CITY', -40, 20, 49.8, 22, 2.2, PI, { bg: '#123', fg: '#fff' });
  sign('京王井の頭線 渋谷駅', 47, 10, 95.8, 18, 2.2, PI, { bg: '#c3007a', fg: '#fff' });
  {
    // walkway (glass tube) at y 8 with walkable floor
    B.box({ x: 0, z: 90, w: 28, d: 7, h: 0.4, y0: 7.85, key: 'conc', top: 'platform' });
    B.box({ x: 0, z: 90, w: 28, d: 7, h: 0.3, y0: 12.8, key: 'conc', top: 'roof' });
    for (const zz of [86.6, 93.4]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(28, 4.6), M.glassT); m.position.set(0, 10.55, zz); scene.add(m);
      phys.box(0, zz, 28, 0.3, 8, 13);
    }
    phys.floor(0, 90, 30, 7, JR.plat);
    reserve(aab(-14, 86, 14, 94));
  }
  // Fukuras (Tokyu Plaza)
  abox(14, 146, 80, 194, 103, 'louver');
  sign('Shibuya Fukuras', 13.8, 96, 170, 16, 2.6, -PI / 2, { bg: '#fff', fg: '#333', font: 'Georgia,serif' });
  sign('TOKYU PLAZA', 47, 8, 145.8, 12, 1.6, PI, { bg: '#004098', fg: '#fff' });
  // Sakura Stage
  abox(20, 234, 90, 290, 179, 'glass');
  abox(22, 300, 70, 350, 140, 'darkglass');
  sign('SHIBUYA SAKURA STAGE', 55, 9, 233.8, 22, 2, PI, { bg: '#fff', fg: '#e5007f' });
  // Shibuya Stream + river
  abox(240, 110, 284, 190, 180, 'mosaic');
  sign('SHIBUYA STREAM', 239.8, 9, 150, 18, 2.2, -PI / 2, { bg: '#fff', fg: '#222' });
  {
    const rv = aab(222, 60, 234, 590);
    reserve(rv, 2);
    B.rect('water', rv.cx, rv.cz, rv.hw, rv.hd, -2.4, 0, 10);
    for (const x of [222, 234]) {
      B.box({ x, z: rv.cz, w: 0.4, d: rv.hd * 2, h: 3.5, y0: -3, key: 'conc', top: 'conc' });
      B.box({ x: x === 222 ? 221.6 : 234.4, z: rv.cz, w: 0.1, d: rv.hd * 2, h: 1.1, y0: 0.5, key: 'metal', top: 'metal' });
      phys.box(x, rv.cz, 1.2, rv.hd * 2, -3, 1.6);
    }
    B.box({ x: 228, z: 60, w: 12, d: 0.4, h: 3, y0: -3, key: 'conc', top: 'conc' });
    B.rect('dark', 228, 60.25, 4, 0.01, -1, 0); // culvert mouth
    B.wall('dark', 224, 60.3, 232, 60.3, -2.4, -0.4);
    // promenade deck on the Stream side
    B.rect('deck', 237, 150, 2.6, 40, 0.03, 0, 4);
  }
  // Hikarie
  abox(222, -95, 282, -15, 34, 'darkglass');
  building(aab(226, -91, 278, -19), 36, 'louver', { y0: 34, shop: false, vbase: 34 });
  building(aab(231, -86, 273, -24), 112.5, 'glass', { y0: 70, shop: false, vbase: 70 });
  sign('Shibuya Hikarie', 221.8, 28, -55, 16, 2.6, -PI / 2, { bg: '#fff', fg: '#555', font: 'Georgia,serif' });
  // Shibuya Scramble Square (229.7 m) with SHIBUYA SKY
  abox(140, 16, 186, 90, 70, 'fins', { col: [1, 1, 1] });
  building(aab(146, 22, 182, 84), 155, 'fins', { y0: 70, shop: false, vbase: 70, col: [1, 1, 1] });
  // crown frame
  for (const [x, z, w, d] of [[164, 21.6, 37, 1.2], [164, 84.4, 37, 1.2], [145.6, 53, 1.2, 64], [182.4, 53, 1.2, 64]])
    B.box({ x, z, w, d, h: 4.7, y0: 225, key: 'paint', top: 'paint' });
  {
    const Y = 229.7;
    B.box({ x: 164, z: 53, w: 36, d: 62, h: 0.3, y0: Y - 0.3, key: 'conc', top: 'granite', topTile: 3 });
    phys.floor(164, 53, 36, 62, Y);
    // glass parapet
    for (const [x, z, w, d] of [[164, 22.3, 36, 0.1], [164, 83.7, 36, 0.1], [146.3, 53, 0.1, 62], [181.7, 53, 0.1, 62]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, d), M.glassT); m.position.set(x, Y + 0.75, z); scene.add(m);
      phys.box(x, z, Math.max(w, 0.4), Math.max(d, 0.4), Y - 1, Y + 1.6);
    }
    // sky stage + helipad
    B.box({ x: 164, z: 55, w: 18, d: 18, h: 0.4, y0: Y, key: 'conc', top: 'conc' });
    phys.floor(164, 55, 18, 18, Y + 0.4);
    const hp = new THREE.Mesh(new THREE.RingGeometry(5.2, 5.8, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hp.rotation.x = -PI / 2; hp.position.set(164, Y + 0.42, 55); scene.add(hp);
    sign('H', 164, Y + 0.43, 55, 5, 5, 0, { bg: 'rgba(0,0,0,0)', fg: '#fff', font: 'Arial Black,Arial,sans-serif', lit: false, transparent: true }).rotation.x = -PI / 2;
    // elevator hut
    abox(156, 70, 172, 80, 4.2, 'white', { y0: Y, shop: false });
    sign('SHIBUYA SKY', 164, Y + 3.2, 69.9, 8, 1, PI, { bg: '#111', fg: '#fff' });
    world.interact.push({ x: 164, y: Y, z: 68, r: 3, jp: 'エレベーターで地上へ', en: 'Elevator down to street', to: [163, 0, 12], yaw: PI });
    world.beacons.push([146.5, Y + 1.7, 22.5], [181.5, Y + 1.7, 22.5], [146.5, Y + 1.7, 83.5], [181.5, Y + 1.7, 83.5]);
  }
  sign('SHIBUYA SCRAMBLE SQUARE', 163, 62, 15.8, 30, 2.6, PI, { bg: '#1a1a1a', fg: '#fff' });
  sign('SHIBUYA SKY  ↑  46F', 163, 4.6, 15.8, 10, 1.4, PI, { bg: '#0b0b0b', fg: '#fff' });
  world.interact.push({ x: 163, y: 0, z: 13.5, r: 3.2, jp: 'エレベーターで SHIBUYA SKY へ', en: 'Elevator to SHIBUYA SKY (229.7 m)', to: [164, 229.7, 64], yaw: PI });
  // Miyashita Park (mall + rooftop park + hotel)
  {
    abox(128, -450, 172, -135, 17, 'louver');
    abox(128, -450, 172, -395, 70, 'white', { shop: false });
    sign('MIYASHITA PARK', 172.2, 13.5, -200, 16, 2, PI / 2, { bg: '#fff', fg: '#2a5a2a' });
    sign('sequence', 172.2, 62, -420, 10, 2, PI / 2, { bg: '#222', fg: '#fff' });
    const Y = 17;
    phys.floor(150, -265, 44, 260, Y);
    B.rect('grass', 150, -250, 18, 70, Y + 0.02, 0, 6);
    B.rect('conc', 150, -355, 18, 30, Y + 0.02, 0, 6);
    // skate bowl edges + sand court
    B.box({ x: 150, z: -355, w: 20, d: 1, h: 0.8, y0: Y, key: 'conc', top: 'conc' });
    phys.box(150, -355, 20, 1, Y, Y + 0.8);
    B.rect('paving', 150, -168, 18, 28, Y + 0.02, 0, 4);
    for (const x of [128.2, 171.8]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 260), M.glassT); m.position.set(x, Y + 0.65, -265); scene.add(m);
      phys.box(x, -265, 0.4, 260, Y - 1, Y + 1.5);
    }
    phys.box(150, -395, 44, 0.6, Y - 1, Y + 1.5);
    // stairs from the south plaza
    stairs(164, -112.5, 8, 45, Y, 0, 0);
    for (let i = 0; i < 26; i++) world.trees.push({ x: 132 + R() * 36, y: Y, z: -320 + R() * 170, s: 0.8 + R() * 0.5, k: 'zelkova' });
  }
  // Station block
  buildStation();
  // Ginza Line structure, stairs, roof
  buildGinza();
  // JR viaduct
  buildViaduct();
  // Shuto Expressway Route 3 over Route 246
  {
    B.box({ x: 0, z: 212, w: 940, d: 18, h: 1.4, y0: 13.6, key: 'conc', top: 'asphalt', topTile: 8, bottom: 'conc' });
    for (const zz of [203.2, 220.8]) B.box({ x: 0, z: zz, w: 940, d: 0.4, h: 1.1, y0: 15, key: 'conc', top: 'conc' });
    for (let x = -460; x <= 460; x += 36) {
      if (x > 92 && x < 128) continue;
      B.box({ x, z: 212, w: 2.4, d: 2.4, h: 12, key: 'conc', top: null });
      B.box({ x, z: 212, w: 3, d: 14, h: 1.6, y0: 12, key: 'conc', top: null });
      phys.box(x, 212, 2.4, 2.4, 0, 12);
    }
    for (let x = -440; x <= 440; x += 6) B.rect('mark', x, 212, 2, 0.08, 15.02);
    sign('首都高速3号渋谷線  Shuto Expressway Route 3', -60, 16.4, 202.9, 16, 1.4, PI, { bg: '#0b6b3a', fg: '#fff', lit: false });
    sign('国道246号  Route 246', 150, 12.4, 202.9, 9, 1.3, PI, { bg: '#1f4fa0', fg: '#fff', lit: false });
  }
  // Center Gai gate
  {
    const o = CENTER_GAI;
    const [ax, az] = toWorld(o, -o.hw + 6, -o.hd + 0.3), [bx, bz] = toWorld(o, -o.hw + 6, o.hd - 0.3);
    for (const [x, z] of [[ax, az], [bx, bz]]) { B.box({ x, z, w: 0.5, d: 0.5, h: 7.4, key: 'metal', top: 'metal' }); phys.box(x, z, 0.5, 0.5, 0, 7.4); }
    const [cx, cz] = toWorld(o, -o.hw + 6, 0);
    B.box({ x: cx, z: cz, w: 0.6, d: o.hd * 2, h: 1.6, y0: 6.2, rot: o.rot, key: 'dark', top: 'dark' });
    const ry = o.rot - PI / 2;
    const s = sign(['SHIBUYA CENTER GAI', '渋谷センター街'], cx + Math.sin(ry + PI) * -0.35, 7, cz + Math.cos(ry + PI) * -0.35, o.hd * 2 - 0.4, 1.4, ry + PI, { bg: '#e8380d', fg: '#fff', double: true });
    void s;
  }
  // ---------- Hachiko square: statue, trees, benches ----------
  {
    const px = 62, pz = 40;
    B.box({ x: px, z: pz, w: 2, d: 1.6, h: 1.5, key: 'conc', top: 'conc', col: [0.75, 0.74, 0.72] });
    phys.box(px, pz, 2.6, 2.2, 0, 3);
    const bronze = new THREE.MeshPhongMaterial({ color: 0x3e3a2c, shininess: 60, specular: 0x8a7a50 });
    const dog = new THREE.Group();
    const part = (g, x, y, z, rx = 0) => { const m = new THREE.Mesh(g, bronze); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; dog.add(m); return m; };
    part(new THREE.BoxGeometry(0.5, 0.55, 1.0), 0, 0.55, -0.1, 0.5); // body (sitting)
    part(new THREE.BoxGeometry(0.42, 0.4, 0.42), 0, 1.05, 0.28); // head
    part(new THREE.BoxGeometry(0.22, 0.2, 0.25), 0, 0.98, 0.56); // snout
    part(new THREE.BoxGeometry(0.1, 0.18, 0.06), -0.13, 1.32, 0.24); part(new THREE.BoxGeometry(0.1, 0.18, 0.06), 0.13, 1.32, 0.24);
    for (const x of [-0.16, 0.16]) part(new THREE.BoxGeometry(0.12, 0.6, 0.12), x, 0.3, 0.3);
    for (const x of [-0.2, 0.2]) part(new THREE.BoxGeometry(0.16, 0.28, 0.5), x, 0.14, -0.35);
    part(new THREE.TorusGeometry(0.12, 0.04, 6, 10), 0, 0.5, -0.62);
    dog.position.set(px, 1.5, pz); dog.rotation.y = -0.9; dog.scale.setScalar(1.15);
    scene.add(dog);
    sign('忠犬ハチ公像  Hachikō', px + 1.01, 0.8, pz, 1.3, 0.35, PI / 2, { bg: '#4a4a48', fg: '#eee', lit: false });
    for (const [x, z] of [[32, 60], [44, 66], [56, 72], [68, 64], [36, 78], [52, 82], [70, 80], [26, 46], [74, 50]]) world.trees.push({ x, y: 0, z, s: 1.1, k: 'zelkova', ring: true });
    for (let i = 0; i < 6; i++) bench(30 + i * 8, 0, 70 + (i % 2) * 6, 0);
  }
  function bench(x, y, z, rot) {
    B.box({ x, z, w: 2, d: 0.5, h: 0.45, y0: y, rot, key: 'metal', top: 'deck', topTile: 2 });
  }
  world.bench = bench;

  // ---------- stairs helper ----------
  function stairs(cx, cz, w, d, yHigh, yLow, rot, highAtNegative = true) {
    const ya = highAtNegative ? yHigh : yLow, yb = highAtNegative ? yLow : yHigh;
    phys.ramp(cx, cz, w, d, ya, yb, rot);
    const o = obb(cx, cz, w / 2, d / 2, rot);
    const n = Math.max(4, Math.round(Math.abs(yHigh - yLow) / 0.17));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const lz = -d / 2 + (t0 + t1) / 2 * d;
      const yTop = ya + (yb - ya) * ((lz + d / 2) / d);
      const [x, z] = toWorld(o, 0, lz);
      B.box({ x, z, w, d: d / n + 0.01, h: Math.max(0.1, yTop - Math.min(ya, yb) + 0.02), y0: Math.min(ya, yb) - 0.02, rot, key: 'conc', top: 'platform', topTile: 2, sides: [2, 2, 2, 2] });
    }
    for (const sd of [-1, 1]) {
      const [x, z] = toWorld(o, sd * (w / 2 + 0.15), 0);
      B.box({ x, z, w: 0.3, d, h: Math.max(yHigh, yLow) + 1.1 - Math.min(ya, yb), y0: Math.min(ya, yb), rot, key: 'conc', top: 'conc', tw: 4, th: 4 });
      phys.box(x, z, 0.3, d, Math.min(ya, yb), Math.max(ya, yb) + 1.4, rot);
    }
    reserve(o, 1);
  }
  world.stairs = stairs;

  // ---------- station building ----------
  function buildStation() {
    const X0 = 80, X1 = 140, Z0 = 12, Z1 = 135, H = 6;
    reserve(aab(X0, Z0, X1, Z1));
    world.foot.push({ o: aab(X0, Z0, X1, Z1), h: 24, y0: 0 });
    B.rect('platform', (X0 + X1) / 2, (Z0 + Z1) / 2, (X1 - X0) / 2, (Z1 - Z0) / 2, 0.03, 0, 4);
    // ceiling (two parts around the viaduct) and viaduct underside
    B.quad('ceiling', [X0, H, Z1], [X0, H, Z0], [JR.x0, H, Z0], [JR.x0, H, Z1]);
    B.quad('ceiling', [JR.x1, H, Z1], [JR.x1, H, Z0], [X1, H, Z0], [X1, H, Z1]);
    // walls with openings: [x0,z0,x1,z1]
    const wall = (x0, z0, x1, z1, y0 = 0, y1 = H, key = 'conc') => {
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
      B.box({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: L, d: 0.6, h: y1 - y0, y0, rot: Math.atan2(-dz, dx), key, top: 'roof', tw: 6, th: 6 });
      phys.box((x0 + x1) / 2, (z0 + z1) / 2, L, 0.6, y0, y1, Math.atan2(-dz, dx));
    };
    wall(X0, Z0, X0, 28); wall(X0, 58, X0, Z1);
    B.box({ x: X0, z: 43, w: 0.6, d: 30, h: H - 5, y0: 5, key: 'conc', top: 'roof' });
    wall(X0, Z0, 98, Z0); wall(122, Z0, X1, Z0);
    wall(X0, Z1, 100, Z1); wall(120, Z1, X1, Z1);
    wall(X1, Z0, X1, Z1);
    // upper levels: west (construction), east building
    B.box({ x: (X0 + JR.x0) / 2, z: (Z0 + Z1) / 2, w: JR.x0 - X0, d: Z1 - Z0, h: 2, y0: H, key: 'conc', top: 'roof' });
    building(aab(JR.x1, Z0, X1, Z1), 18, 'concrete', { y0: H, shop: false, vbase: H, noCollide: true });
    // facade signs
    sign(['JR 渋谷駅', 'Shibuya Station'], X0 - 0.35, 7.5, 43, 10, 2.4, -PI / 2, { bg: '#fff', fg: '#111' });
    sign('ハチ公口  Hachikō Exit', X0 - 0.35, 5.2, 43, 7, 0.9, -PI / 2, { bg: '#1d1d1d', fg: '#fff' });
    sign('JR', X0 - 0.36, 7.5, 36, 1.6, 1.6, -PI / 2, { bg: '#2b9a3c', fg: '#fff', font: 'Arial Black,Arial,sans-serif' });
    // gates (IC ticket gates)
    const GX = 92;
    world.gates = { x: GX, z0: 26, z1: 60 };
    for (let z = 26; z <= 60; z += 1.7) {
      B.box({ x: GX, z, w: 1.4, d: 0.3, h: 1.0, key: 'paint', top: 'dark' });
      B.box({ x: GX - 0.6, z, w: 0.12, d: 0.32, h: 0.06, y0: 1.0, key: 'dark', top: 'glow' });
      phys.box(GX, z, 1.4, 0.3, 0, 1.0);
    }
    for (const [z0, z1] of [[Z0, 25.6], [60.4, Z1]]) {
      B.box({ x: GX, z: (z0 + z1) / 2, w: 0.3, d: z1 - z0, h: 1.2, key: 'metal', top: 'metal' });
      phys.box(GX, (z0 + z1) / 2, 0.3, z1 - z0, 0, 1.2);
    }
    sign('改札口  Ticket Gates', GX, 4.8, 43, 6, 0.7, -PI / 2, { bg: '#18324a', fg: '#fff' });
    sign('山手線  Yamanote Line  →', 104, 4.6, 72, 7, 0.8, -PI / 2, { bg: '#2b2b2b', fg: '#9be15d' });
    sign('↑ 1・2番線  山手線', 110, 4.6, 96.3, 6, 0.8, 0, { bg: '#2b2b2b', fg: '#9be15d' });
    // stairs to Yamanote platform: low end at z=96, top at z=66
    stairs(110, 81, 6, 30, JR.plat, 0, 0, true);
    // viaduct pillars inside
    for (let z = 20; z < Z1; z += 18) for (const x of [99, 121]) {
      if (z > 60 && z < 100 && x === 121) continue;
      B.box({ x, z, w: 1.6, d: 1.6, h: H, key: 'conc', top: null }); phys.box(x, z, 1.6, 1.6, 0, H);
    }
    // vending machines + coin lockers
    for (let i = 0; i < 4; i++) vend(124.5 + i * 1.1, 0, 134.5, PI);
    world.boardSpots = { concourse: [GX - 0.4, 4.2, 43, -PI / 2] };
  }

  function vend(x, y, z, rot) {
    B.box({ x, z, w: 1.0, d: 0.8, h: 1.83, y0: y, rot, key: 'paint', top: 'paint', sides: [0, 1, 1, 1] });
    const o = obb(x, z, 0.5, 0.4, rot);
    const [fx, fz] = toWorld(o, 0, 0.41);
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (lx, yy) => [fx + lx * c, yy, fz - lx * s];
    B.quad('vend', P(-0.5, y), P(0.5, y), P(0.5, y + 1.83), P(-0.5, y + 1.83));
    phys.box(x, z, 1.0, 0.8, y, y + 1.83, rot);
  }
  world.vend = vend;

  // ---------- JR viaduct ----------
  function buildViaduct() {
    const Z0 = -900, Z1 = 900;
    const hole = [107, 66, 113, 96];
    // deck pieces avoiding the stair hole
    const deck = (x0, z0, x1, z1) => B.box({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: 1.2, y0: 5.8, key: 'conc', top: 'ballast', topTile: 4, bottom: 'conc', tw: 6, th: 6 });
    deck(JR.x0, Z0, hole[0], Z1); deck(hole[2], Z0, JR.x1, Z1); deck(hole[0], Z0, hole[2], hole[1]); deck(hole[0], hole[3], hole[2], Z1);
    reserve(aab(JR.x0 - 2, Z0, JR.x1 + 2, Z1));
    // parapets
    for (const x of [JR.x0 + 0.2, JR.x1 - 0.2]) B.box({ x, z: 0, w: 0.4, d: Z1 - Z0, h: 1.3, y0: 7, key: 'conc', top: 'conc', tw: 6, th: 6 });
    for (const x of [JR.x0, JR.x1]) phys.box(x, 0, 0.6, Z1 - Z0, 6, 8.6);
    // track beds with ties + rails
    for (const tx of [JR.outX, JR.inX]) {
      B.rect('ties', tx, 0, 1.6, (Z1 - Z0) / 2, 7.02, 0, 3.6);
      for (const sd of [-0.535, 0.535]) B.box({ x: tx + sd, z: 0, w: 0.08, d: Z1 - Z0, h: 0.14, y0: 7.01, key: 'rail', top: 'rail' });
      phys.floor(tx, 0, 4, Z1 - Z0, 7.0);
    }
    // pillars
    for (let z = Z0 + 10; z < Z1; z += 18) {
      if (z > 8 && z < 138) continue;
      if (Math.abs(z) < 12 || (z > 194 && z < 230)) continue;
      for (const x of [99, 121]) { B.box({ x, z, w: 1.8, d: 1.8, h: 5.8, key: 'conc', top: null }); phys.box(x, z, 1.8, 1.8, 0, 5.8); }
    }
    // platform (island)
    const P = JR;
    const pz0 = P.platZ0, pz1 = P.platZ1;
    const piece = (x0, z0, x1, z1) => {
      B.box({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: P.plat - 7, y0: 7, key: 'conc', top: 'platform', topTile: 4, tw: 4, th: 4 });
      phys.floor((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, P.plat);
    };
    piece(P.platX0, pz0, hole[0], pz1); piece(hole[2], pz0, P.platX1, pz1); piece(hole[0], pz0, hole[2], hole[1]); piece(hole[0], hole[3], hole[2], pz1);
    // tactile strips
    for (const x of [P.platX0 + 0.9, P.platX1 - 0.9]) B.rect('yellow', x, (pz0 + pz1) / 2, 0.15, (pz1 - pz0) / 2, P.plat + 0.01, 0);
    // stair-well railings
    for (const x of [hole[0], hole[2]]) { B.box({ x, z: (hole[1] + hole[3]) / 2, w: 0.1, d: hole[3] - hole[1], h: 1.1, y0: P.plat, key: 'metal', top: 'metal' }); phys.box(x, (hole[1] + hole[3]) / 2, 0.3, hole[3] - hole[1], P.plat - 0.2, P.plat + 1.2); }
    B.box({ x: 110, z: hole[3], w: 6, d: 0.1, h: 1.1, y0: P.plat, key: 'metal', top: 'metal' }); phys.box(110, hole[3], 6, 0.3, P.plat - 0.2, P.plat + 1.2);
    // platform ends
    for (const z of [pz0, pz1]) phys.box(110, z, 12, 0.4, P.plat - 0.5, P.plat + 1.4);
    // canopy + columns
    B.box({ x: 110, z: 5, w: 14, d: 200, h: 0.4, y0: 12.4, key: 'metal', top: 'roof', bottom: 'ceiling' });
    for (let z = -90; z <= 100; z += 19) { if (z > 62 && z < 100) continue; B.box({ x: 110, z, w: 0.32, d: 0.32, h: 4.2, y0: P.plat, key: 'paint', top: null }); phys.box(110, z, 0.5, 0.5, P.plat, 12.4); }
    // platform doors (fixed panels, gaps at door positions handled by rail.js leaves)
    world.jrPlatform = { x0: P.platX0, x1: P.platX1, z0: pz0, z1: pz1 };
    for (const x of [P.platX0 + 0.15, P.platX1 - 0.15]) phys.box(x, (pz0 + pz1) / 2, 0.3, pz1 - pz0, P.plat - 0.2, P.plat + 1.35);
    // benches, vending, signs
    for (let z = -80; z < 110; z += 38) { if (z > 60 && z < 100) continue; bench(110, P.plat, z, PI / 2); }
    vend(112.5, P.plat, -20, -PI / 2); vend(112.5, P.plat, -21.1, -PI / 2);
    world.jrSigns = [];
    for (const z of [-70, -5, 40, 105]) {
      sign(['渋谷  Shibuya', 'JY 20   しぶや'], 110, 11, z, 4.4, 1.3, 0, { bg: '#fff', fg: '#111', border: '#80c241', double: true });
    }
    for (const [x, rot, txt] of [[P.platX0 + 0.05, -PI / 2, '← 原宿 Harajuku   JY19'], [P.platX1 - 0.05, PI / 2, 'JY21  恵比寿 Ebisu →']]) {
      for (const z of [-50, 20, 85]) sign(txt, x, P.plat + 2.6, z, 3.6, 0.5, rot, { bg: '#fff', fg: '#2e7d32', lit: false });
    }
    world.boardSpots.jr = [[110, 11.2, -38, 0], [110, 11.2, 60, PI]];
    // catenary
    const pts = [];
    for (let z = Z0; z <= Z1; z += 45) {
      for (const x of [JR.x0 + 0.6, JR.x1 - 0.6]) B.box({ x, z, w: 0.35, d: 0.35, h: 6.8, y0: 7, key: 'metal', top: null });
      B.box({ x: 110, z, w: JR.x1 - JR.x0 - 1, d: 0.25, h: 0.35, y0: 13.4, key: 'metal', top: 'metal' });
    }
    for (const tx of [JR.outX, JR.inX]) { pts.push(tx, 12.6, Z0, tx, 12.6, Z1, tx, 13.3, Z0, tx, 13.3, Z1); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x222222 })));
  }

  // ---------- Ginza line ----------
  function buildGinza() {
    // straight deck over Meiji-dori and the curve
    for (let s = -12; s < GINZA_PORTAL_S + 2; s += 4) {
      const [x, z, hd] = ginzaAt(s + 2);
      B.box({ x, z, w: 22, d: 4.15, h: 1.0, y0: 10, rot: hd, key: 'conc', top: 'ballast', topTile: 4, bottom: 'conc', tw: 6, th: 6 });
      reserve(obb(x, z, 12, 3, hd));
      for (const off of [-7.5, 7.5]) {
        const [rx, rz] = ginzaAt(s + 2, off);
        for (const g of [-0.7175, 0.7175]) {
          const [gx, gz] = ginzaAt(s + 2, off + g);
          B.box({ x: gx, z: gz, w: 0.08, d: 4.1, h: 0.15, y0: 11.0, rot: hd, key: 'rail', top: 'rail' });
        }
        const [tx, tz] = ginzaAt(s + 2, off - 1.4);
        B.box({ x: tx, z: tz, w: 0.18, d: 4.1, h: 0.3, y0: 11.0, rot: hd, key: 'dark', top: 'metal' });
        if (s >= 0) phys.floor(rx, rz, 5, 4.2, 11.0, hd);
      }
      if (s > -10 && Math.round(s) % 16 === 0) {
        B.box({ x, z, w: 2, d: 2, h: 10, key: 'conc', top: null, rot: hd });
        B.box({ x, z, w: 20, d: 2, h: 1.2, y0: 8.8, rot: hd, key: 'conc', top: null });
        phys.box(x, z, 2, 2, 0, 10, hd);
      }
      // parapets on curve/straight beyond platform
      if (s > GZ.platZ0 * -1 - 22) for (const off of [-11, 11]) { const [px, pz] = ginzaAt(s + 2, off); B.box({ x: px, z: pz, w: 0.3, d: 4.15, h: 1.2, y0: 11, rot: hd, key: 'conc', top: 'conc' }); }
    }
    // buffer stops
    for (const x of [GZ.wX, GZ.eX]) { B.box({ x, z: -21, w: 2.4, d: 0.8, h: 1.4, y0: 11, key: 'yellow', top: 'yellow' }); phys.box(x, -21, 2.4, 0.8, 11, 12.4); }
    // island platform + south concourse
    const P = GZ;
    B.box({ x: 200, z: (P.platZ0 + P.platZ1) / 2, w: P.platX1 - P.platX0, d: P.platZ1 - P.platZ0, h: 1.25, y0: 11, key: 'conc', top: 'platform', topTile: 4 });
    phys.floorAabb(P.platX0, P.platZ0, P.platX1, P.platZ1, P.plat);
    B.box({ x: 200, z: -16, w: 22, d: 12, h: 2.25, y0: 10, key: 'conc', top: 'platform', topTile: 4, bottom: 'conc' });
    phys.floorAabb(189, -22, 211, -10, P.plat);
    for (const x of [P.platX0 + 0.8, P.platX1 - 0.8]) B.rect('yellow', x, (P.platZ0 + P.platZ1) / 2, 0.15, (P.platZ1 - P.platZ0) / 2, P.plat + 0.01, 0);
    for (const x of [P.platX0 + 0.15, P.platX1 - 0.15]) phys.box(x, (P.platZ0 + P.platZ1) / 2, 0.3, P.platZ1 - P.platZ0, P.plat - 0.2, P.plat + 1.35);
    phys.box(200, P.platZ0, 12, 0.4, P.plat - 0.5, P.plat + 1.4);
    // concourse railings
    phys.box(200, -9.8, 22, 0.4, P.plat - 0.5, P.plat + 1.3); B.box({ x: 200, z: -9.8, w: 22, d: 0.2, h: 1.2, y0: P.plat, key: 'metal', top: 'metal' });
    phys.box(211, -16, 0.4, 12, P.plat - 0.5, P.plat + 1.3); B.box({ x: 211, z: -16, w: 0.2, d: 12, h: 1.2, y0: P.plat, key: 'metal', top: 'metal' });
    phys.box(189, -21, 0.4, 2, P.plat - 0.5, P.plat + 1.3); phys.box(189, -11.5, 0.4, 3, P.plat - 0.5, P.plat + 1.3);
    // M-shaped roof: ribs + panels
    const rib = new THREE.Shape();
    rib.moveTo(-11, 0); rib.lineTo(-11, 7.4); rib.quadraticCurveTo(-5.5, 9.6, 0, 6.2); rib.quadraticCurveTo(5.5, 9.6, 11, 7.4); rib.lineTo(11, 0);
    rib.lineTo(10.5, 0); rib.lineTo(10.5, 7); rib.quadraticCurveTo(5.5, 9.0, 0, 5.6); rib.quadraticCurveTo(-5.5, 9.0, -10.5, 7); rib.lineTo(-10.5, 0);
    const ribGeo = new THREE.ExtrudeGeometry(rib, { depth: 0.5, bevelEnabled: false });
    const ribMat = lam({ color: 0xf4f4f2 });
    const ribs = new THREE.InstancedMesh(ribGeo, ribMat, 30);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < 30; i++) { mm.makeTranslation(200, P.plat + 0.1, -128 + i * 4); ribs.setMatrixAt(i, mm); }
    ribs.castShadow = true; scene.add(ribs);
    // roof panels following the M curve
    const roofPts = [];
    for (let i = 0; i <= 24; i++) { const u = -11 + i * 22 / 24; const y = u < 0 ? curve(-11, 7.4, -5.5, 9.6, 0, 6.2, (u + 11) / 11) : curve(0, 6.2, 5.5, 9.6, 11, 7.4, u / 11); roofPts.push([u, y]); }
    function curve(x0, y0, cx, cy, x1, y1, t) { return (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1; }
    for (let i = 0; i < roofPts.length - 1; i++) {
      const [u0, y0] = roofPts[i], [u1, y1] = roofPts[i + 1];
      B.quad('paint', [200 + u0, P.plat + y0 + 0.15, -10], [200 + u1, P.plat + y1 + 0.15, -10], [200 + u1, P.plat + y1 + 0.15, -130], [200 + u0, P.plat + y0 + 0.15, -130]);
      B.quad('ceiling', [200 + u1, P.plat + y1 + 0.1, -10], [200 + u0, P.plat + y0 + 0.1, -10], [200 + u0, P.plat + y0 + 0.1, -130], [200 + u1, P.plat + y1 + 0.1, -130]);
    }
    sign(['渋谷  Shibuya', 'G 01   銀座線'], 200, P.plat + 3.6, -60, 4, 1.2, 0, { bg: '#fff', fg: '#111', border: '#f39700', double: true });
    sign(['渋谷  Shibuya', 'G 01   銀座線'], 200, P.plat + 3.6, -100, 4, 1.2, 0, { bg: '#fff', fg: '#111', border: '#f39700', double: true });
    sign('東京メトロ 銀座線  Ginza Line', 186.6, P.plat + 3.4, -17, 8, 0.9, -PI / 2, { bg: '#f39700', fg: '#fff' });
    sign('G  銀座線  Ginza Line ↑', 140.4, 3.6, -17, 6, 0.8, -PI / 2, { bg: '#f39700', fg: '#fff' });
    for (let z = -110; z < -30; z += 30) bench(200, P.plat, z, PI / 2);
    world.boardSpots.ginza = [[200, P.plat + 2.8, -24, PI]];
    // stairs from street (x=140) up to bridge (x=180), bridge to concourse (x=189)
    stairs(160, -17, 6, 40, P.plat, 0, PI / 2, false);
    B.box({ x: 184.5, z: -17, w: 9, d: 6, h: 0.6, y0: P.plat - 0.6, key: 'conc', top: 'platform', topTile: 4, bottom: 'conc' });
    phys.floorAabb(180, -20, 189.2, -14, P.plat);
    for (const z of [-20.1, -13.9]) { phys.box(184.5, z, 9, 0.3, P.plat - 0.5, P.plat + 1.3); B.box({ x: 184.5, z, w: 9, d: 0.15, h: 1.15, y0: P.plat, key: 'metal', top: 'metal' }); }
    // Ginza gates on the bridge
    world.ginzaGates = { x: 186, z0: -20, z1: -14 };
    for (let z = -19.6; z <= -14.2; z += 1.8) { B.box({ x: 186, z, w: 1.3, d: 0.28, h: 1, y0: P.plat, key: 'paint', top: 'dark' }); phys.box(186, z, 1.3, 0.28, P.plat, P.plat + 1); }
    // Aoyama hill with tunnel portal
    const hillKey = 'conc';
    building(aab(340, -250, 470, -186), 18, hillKey, { shop: false, top: 'grass' });
    building(aab(340, -164, 470, -100), 18, hillKey, { shop: false, top: 'grass' });
    building(aab(340, -186, 470, -164), 1.5, hillKey, { shop: false, y0: 16.5, top: 'grass' });
    B.box({ x: 405, z: -175, w: 130, d: 22, h: 10, y0: 0, key: hillKey, top: null });
    B.quad('dark', [341, 11, -186], [341, 11, -164], [341, 16.5, -164], [341, 16.5, -186]);
    for (let i = 0; i < 14; i++) world.trees.push({ x: 350 + R() * 110, y: 18, z: -245 + R() * 140, s: 1 + R() * 0.4, k: 'zelkova' });
    reserve(aab(186, -250, 470, -100));
  }

  // ---------- filler buildings along streets ----------
  const zoneKind = (x, z) => {
    const d = Math.hypot(x - 40, z - 20);
    const west = x < -14;
    if (west && z < -9 && d < 330) return { h: [10, 34], k: ['tile', 'concrete', 'white', 'tile', 'glass'], vs: 0.75 };
    if (west && z >= -9 && d < 330) return { h: [12, 44], k: ['tile', 'concrete', 'white', 'glass'], vs: 0.55 };
    if (d < 240) return { h: [18, 60], k: ['glass', 'concrete', 'white', 'darkglass', 'tile'], vs: 0.25 };
    if (x > 210) return { h: [16, 70], k: ['glass', 'concrete', 'white', 'apartment', 'darkglass'], vs: 0.1 };
    return { h: [9, 36], k: ['apartment', 'white', 'concrete', 'tile', 'apartment'], vs: 0.15 };
  };
  const BOUND = 460;
  const fillerAlong = (o, pad, minW = 7, maxW = 22) => {
    const L = o.hw, W = o.hd;
    for (const sd of [-1, 1]) {
      let a = -L + 2;
      while (a < L - 4) {
        const w = R.range(minW, maxW), d = R.range(11, 22);
        const lx = a + w / 2;
        const [cx, cz] = toWorld(o, lx, sd * (W + pad + d / 2 + 0.5));
        a += w + R.range(0.4, 1.8);
        if (Math.abs(cx) > BOUND || cz < -470 || cz > 580) continue;
        const b = obb(cx, cz, w / 2, d / 2, o.rot);
        if (!free(b, 0.2)) continue;
        const zk = zoneKind(cx, cz);
        let h = R.range(zk.h[0], zk.h[1]);
        if (R() < 0.07) h = R.range(60, 110);
        const kind = h > 60 ? R.pick(['glass', 'darkglass', 'white']) : R.pick(zk.k);
        const ho = building(b, Math.round(h / 3.5) * 3.5 + 1, kind);
        decorate(ho, h, sd, zk);
      }
    }
  };
  function decorate(o, h, sd, zk) {
    // rooftop clutter
    const top = Math.round(h / 3.5) * 3.5 + 1;
    const n = R.int(0, 3);
    for (let i = 0; i < n; i++) {
      const lx = R.range(-o.hw * 0.6, o.hw * 0.6), lz = R.range(-o.hd * 0.6, o.hd * 0.6);
      const [x, z] = toWorld(o, lx, lz);
      B.box({ x, z, w: R.range(1.5, 4), d: R.range(1.5, 4), h: R.range(1, 3), y0: top, rot: o.rot, key: 'conc', top: 'roof' });
    }
    // rooftop billboard
    if (top < 45 && R() < 0.22) {
      const [x, z] = toWorld(o, 0, -sd * (o.hd - 1));
      const ry = o.rot + (sd > 0 ? Math.PI : 0);
      B.box({ x, z, w: Math.min(o.hw * 2 - 1, 12), d: 0.3, h: 0.4, y0: top + 1, rot: o.rot, key: 'metal', top: 'metal' });
      const bw = Math.min(o.hw * 2 - 1, 12), bh = bw * 0.42;
      const slot = R.int(0, 7), u0 = (slot % 4) / 4, v0 = slot < 4 ? 0.5 : 0;
      const c = Math.cos(ry), s = Math.sin(ry);
      const P = (lx, y) => [x + lx * c, y, z - lx * s];
      B.quad('bill', P(-bw / 2, top + 1.4), P(bw / 2, top + 1.4), P(bw / 2, top + 1.4 + bh), P(-bw / 2, top + 1.4 + bh), [u0, v0 + 0.13, u0 + 0.25, v0 + 0.13, u0 + 0.25, v0 + 0.37, u0, v0 + 0.37]);
    }
    // vertical shop signs facing the street
    if (h > 12 && R() < zk.vs) {
      const slot = R.int(0, VS.n - 1);
      const u0 = (slot % VS.cols) / VS.cols, u1 = u0 + 1 / VS.cols;
      const v1 = 1 - Math.floor(slot / VS.cols) / VS.rows, v0 = v1 - 1 / VS.rows;
      const lx = (R() < 0.5 ? -1 : 1) * (o.hw - 0.8);
      const fz = -sd * (o.hd + 0.5); // street side
      const [x, z] = toWorld(o, lx, fz);
      const y0 = 5, y1 = Math.min(top - 1, 5 + R.range(5, 9));
      const c = Math.cos(o.rot), s = Math.sin(o.rot);
      const ax = [-s * 0.5, -c * 0.5]; // along local z (perp to facade)
      for (const side of [1, -1]) {
        const ox = c * 0.08 * side, oz = -s * 0.08 * side;
        const A = [x + ax[0] + ox, y0, z + ax[1] + oz], Bp = [x - ax[0] + ox, y0, z - ax[1] + oz];
        const Cp = [Bp[0], y1, Bp[2]], D = [A[0], y1, A[2]];
        if (side > 0) B.quad('vsign', Bp, A, D, Cp, [u0, v0, u1, v0, u1, v1, u0, v1]);
        else B.quad('vsign', A, Bp, Cp, D, [u0, v0, u1, v0, u1, v1, u0, v1]);
      }
    }
    // vending machine at the street face
    if (R() < 0.12) {
      const [x, z] = toWorld(o, R.range(-o.hw + 1, o.hw - 1), -sd * (o.hd + 0.45));
      vend(x, 0, z, o.rot + (sd > 0 ? Math.PI : 0));
    }
  }
  for (const r of ROADS) if (r.id !== 'X') fillerAlong(r.o, SIDEWALK);
  fillerAlong(CENTER_GAI, 0.3, 6, 14);
  // fill interiors
  for (let i = 0; i < 2600; i++) {
    const x = R.range(-BOUND, BOUND), z = R.range(-470, 580);
    const w = R.range(10, 26), d = R.range(10, 24);
    const b = obb(x, z, w / 2, d / 2, R() < 0.7 ? 0 : R.range(-0.4, 0.4));
    if (!free(b, 2.5)) continue;
    const zk = zoneKind(x, z);
    const h = R.range(zk.h[0], zk.h[1]);
    building(b, Math.round(h / 3.5) * 3.5 + 1, R.pick(zk.k), { shop: false });
  }

  // ---------- street lamps, guardrails, street trees ----------
  const lampAt = (x, z, ry) => {
    B.box({ x, z, w: 0.18, d: 0.18, h: 7.5, key: 'metal', top: null });
    const ax = x + Math.sin(ry) * 1.2, az = z + Math.cos(ry) * 1.2;
    B.box({ x: (x + ax) / 2, z: (z + az) / 2, w: 0.12, d: 2.4, h: 0.12, y0: 7.4, rot: ry, key: 'metal', top: 'metal' });
    B.box({ x: ax, z: az, w: 0.6, d: 0.9, h: 0.18, y0: 7.25, rot: ry, key: 'metal', top: 'metal', bottom: 'glow' });
    B.rect('pool', ax, az, 7, 7, 0.06, 0);
    world.lamps.push([ax, 7.2, az]);
  };
  for (const r of ROADS) {
    if (r.id === 'X') continue;
    const o = r.o, long = o.hw > o.hd;
    const L = long ? o.hw : o.hd, W = long ? o.hd : o.hw;
    for (const sd of [-1, 1]) for (let a = -L + 12; a < L - 6; a += 28) {
      const [x, z] = long ? toWorld(o, a, sd * (W + 0.8)) : toWorld(o, sd * (W + 0.8), a);
      if (Math.hypot(x, z) < 30 || Math.abs(x) > BOUND || z < -470 || z > 580) continue;
      if (x > JR.x0 - 3 && x < JR.x1 + 3) continue;
      if (x > 186 && x < 214 && z > -135 && z < -5) continue;
      const nx = long ? toWorld(o, a, -sd)[0] - x : toWorld(o, -sd, a)[0] - x;
      const nz = long ? toWorld(o, a, -sd)[1] - z : toWorld(o, -sd, a)[1] - z;
      lampAt(x, z, Math.atan2(nx, nz));
      // street trees between lamps on wide roads
      if (W >= 9 && R() < 0.8 && r.id !== 'N' && r.id !== 'S') {
        const [tx, tz] = long ? toWorld(o, a + 14, sd * (W + 1.4)) : toWorld(o, sd * (W + 1.4), a + 14);
        if (!(tx > JR.x0 - 3 && tx < JR.x1 + 3) && Math.abs(tx) < BOUND && tz > -470 && tz < 580) world.trees.push({ x: tx, y: 0, z: tz, s: 0.9 + R() * 0.3, k: r.id === 'MJ' ? 'ginkgo' : 'zelkova' });
      }
    }
  }
  // Sakura along the river and at Sakura Stage
  for (let z = 70; z < 560; z += 11) { if (z > 192 && z < 232) continue; world.trees.push({ x: 219.5, y: 0, z, s: 1.05, k: 'sakura' }); }
  for (let i = 0; i < 12; i++) world.trees.push({ x: 26 + R() * 60, y: 0, z: 292 + R() * 6, s: 1 + R() * 0.2, k: 'sakura' });
  // guardrails on main roads (away from crossings)
  for (const id of ['N', 'S', 'E', 'MJ', 'R246']) {
    const o = ROADS.find((r) => r.id === id).o, long = o.hw > o.hd;
    const L = long ? o.hw : o.hd, W = long ? o.hd : o.hw;
    for (const sd of [-1, 1]) for (let a = -L + 4; a < L - 4; a += 16) {
      const [x, z] = long ? toWorld(o, a + 6, sd * (W + 0.45)) : toWorld(o, sd * (W + 0.45), a + 6);
      if (Math.hypot(x, z) < 36 || Math.abs(x) > BOUND || (x > JR.x0 - 4 && x < JR.x1 + 4)) continue;
      if (x > 180 && x < 220 && Math.abs(z) < 20) continue;
      if (Math.abs(z - 212) < 22 && Math.abs(x) < 16) continue;
      if (Math.abs(z - 212) < 22 && Math.abs(x - 200) < 16) continue;
      const rot = long ? o.rot : o.rot + Math.PI / 2;
      B.box({ x, z, w: 10, d: 0.06, h: 0.08, y0: 0.85, rot, key: 'paint', top: 'paint' });
      B.box({ x, z, w: 10, d: 0.06, h: 0.06, y0: 0.45, rot, key: 'paint', top: 'paint' });
      for (const e of [-5, 0, 5]) { const c = Math.cos(rot), s = Math.sin(rot); B.box({ x: x + e * c, z: z - e * s, w: 0.08, d: 0.08, h: 0.95, key: 'paint', top: null }); }
    }
  }

  // ---------- construction site + tower crane on the station's west side ----------
  {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 6; j++) B.box({ x: 83 + i * 6.5, z: 18 + j * 22, w: 0.7, d: 0.7, h: 30, y0: 8, key: 'metal', top: 'metal', col: [0.8, 0.45, 0.3] });
    for (let y = 12; y <= 36; y += 4.5) B.box({ x: 89.5, z: 75, w: 15, d: 120, h: 0.35, y0: y, key: 'conc', top: 'conc', bottom: 'conc' });
    B.box({ x: 89.5, z: 75, w: 15.5, d: 121, h: 2.5, y0: 8, key: 'paint', top: null, col: [0.92, 0.92, 0.9] });
    B.box({ x: 88, z: 128, w: 2, d: 2, h: 72, y0: 8, key: 'metal', top: 'metal', col: [0.95, 0.75, 0.2] });
    B.box({ x: 103, z: 128, w: 56, d: 1.6, h: 1.8, y0: 80, key: 'metal', top: 'metal', col: [0.95, 0.75, 0.2] });
    B.box({ x: 78, z: 128, w: 5, d: 3, h: 3, y0: 78, key: 'conc', top: 'conc' });
    B.box({ x: 88, z: 128, w: 3, d: 3, h: 3.5, y0: 76.5, key: 'paint', top: 'paint' });
    world.beacons.push([88, 84, 128], [130, 82, 128]);
    sign('渋谷駅街区 建設工事  Construction', 79.6, 9.4, 90, 12, 1.2, -PI / 2, { bg: '#1c3f7a', fg: '#fff', lit: false });
  }

  // ---------- trees (instanced, seasonal colour) ----------
  {
    const jit = (g, a) => {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = 1 + a * Math.sin(x * 2.1 + z * 1.3) * Math.cos(y * 2.7 - x);
        p.setXYZ(i, x * k, y * k, z * k);
      }
      g.computeVertexNormals();
      return g;
    };
    const trunkG = new THREE.CylinderGeometry(0.14, 0.24, 3.6, 6).translate(0, 1.8, 0);
    const crownG = {
      zelkova: jit(new THREE.IcosahedronGeometry(2.4, 1), 0.14).scale(1.2, 0.85, 1.2).translate(0, 4.8, 0),
      ginkgo: jit(new THREE.ConeGeometry(1.9, 6.2, 8, 2), 0.08).translate(0, 5.8, 0),
      sakura: jit(new THREE.IcosahedronGeometry(2.6, 1), 0.16).scale(1.4, 0.7, 1.4).translate(0, 4.5, 0),
    };
    const trunkM = lam({ color: 0x5a4636 });
    const trunks = new THREE.InstancedMesh(trunkG, trunkM, world.trees.length);
    const crowns = {};
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    for (const k of Object.keys(crownG)) {
      const list = world.trees.filter((t) => t.k === k);
      const mat = lam({ color: 0x5e8f3e, flatShading: true });
      const im = new THREE.InstancedMesh(crownG[k], mat, Math.max(1, list.length));
      im.count = list.length;
      list.forEach((t, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28);
        im.setMatrixAt(i, m4.compose(pos.set(t.x, t.y, t.z), q, sc.setScalar(t.s)));
        im.setColorAt(i, new THREE.Color().setHSL(0, 0, 0.85 + R() * 0.3));
      });
      im.castShadow = true; im.receiveShadow = true;
      scene.add(im);
      crowns[k] = { im, mat, list };
    }
    world.trees.forEach((t, i) => {
      trunks.setMatrixAt(i, m4.compose(pos.set(t.x, t.y, t.z), q.identity(), sc.setScalar(t.s)));
      phys.box(t.x, t.z, 0.5, 0.5, t.y, t.y + 3);
    });
    trunks.castShadow = true; scene.add(trunks);
    // month/day -> crown colour and fullness
    world.setSeason = (mo, d) => {
      const md = mo * 100 + d;
      const pal = {
        zelkova: md >= 1110 && md <= 1210 ? [0xc27a33, 1] : md > 1210 || md < 325 ? [0x7a6a5a, 0.35] : md < 420 ? [0x9cc95a, 0.8] : md >= 1001 ? [0x7f9440, 1] : [0x5e8f3e, 1],
        ginkgo: md >= 1115 && md <= 1215 ? [0xf2c200, 1] : md > 1215 || md < 401 ? [0x7a6a5a, 0.3] : md >= 1025 ? [0xb7b83a, 1] : [0x6d9a3a, 1],
        sakura: md >= 325 && md <= 408 ? [0xf6c6d8, 1.05] : md > 408 && md <= 420 ? [0xc7c99a, 1] : md >= 1001 && md <= 1125 ? [0xb5683c, 0.9] : md > 1125 || md < 325 ? [0x6e5e52, 0.35] : [0x58863a, 1],
      };
      for (const k in crowns) {
        const [col, full] = pal[k];
        crowns[k].mat.color.setHex(col);
        crowns[k].list.forEach((t, i) => {
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.7);
          crowns[k].im.setMatrixAt(i, m4.compose(pos.set(t.x, t.y + (1 - full) * 3, t.z), q, sc.set(t.s * full, t.s * full, t.s * full)));
        });
        crowns[k].im.instanceMatrix.needsUpdate = true;
      }
    };
  }

  // ---------- aircraft warning lights on the tall towers ----------
  world.beacons.push([252, 183, -55], [262, 180.5, 150], [55, 179.5, 262], [46, 140.5, 325], [-110, 100.5, 72], [47, 103.5, 170], [150, 70.5, -422]);
  {
    const bm = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false });
    const bg = new THREE.SphereGeometry(0.6, 8, 6);
    world.beaconMeshes = world.beacons.map(([x, y, z]) => { const m = new THREE.Mesh(bg, bm); m.position.set(x, y, z); if (y > 200) m.scale.setScalar(0.25); scene.add(m); return m; });
  }

  // ---------- build the batch ----------
  const mats = { ...M };
  mats.ties = M.ties;
  const group = B.build(mats, { cast: (k) => !['asphalt', 'paving', 'brick', 'granite', 'grass', 'mark', 'yellow', 'pool', 'ties', 'water', 'deck', 'ceiling', 'glow', 'platform'].includes(k) });
  for (const m of group.children) if (m.name === 'pool' || m.name === 'glassT') { m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; }
  scene.add(group);
  world.group = group;
  world.M = M;
  return world;
}

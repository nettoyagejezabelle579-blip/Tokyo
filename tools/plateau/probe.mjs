// Usage: node probe.mjs <outdir> cache   -> builds tris.bin (set id + 9 floats per tri)
//        node probe.mjs <outdir> v x z [x z ...]  -> vertical hits
//        node probe.mjs <outdir> top x0 z0 x1 z1 step out.png -> max-height image (sets via SETS env)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import fs from 'fs';
import sharp from 'sharp';
const [dir, cmd, ...args] = process.argv.slice(2);
const SETS = ['bldg', 'tran', 'brid', 'frn', 'veg', 'plant'];
const cacheF = dir + '/../tris.bin';
if (cmd === 'cache') {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const idx = JSON.parse(fs.readFileSync(dir + '/index.json'));
  const out = [];
  for (const [si, s] of SETS.entries()) for (const e of idx.sets[s] || []) {
    const doc = await io.read(dir + '/' + e.f);
    for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
      const a = p.getAttribute('POSITION').getArray(); const ix = p.getIndices()?.getArray();
      const n = ix ? ix.length : a.length / 3;
      for (let t = 0; t < n; t += 3) { const rec = [si]; for (let k = 0; k < 3; k++) { const v = ix ? ix[t + k] : t + k; rec.push(a[v * 3], a[v * 3 + 1], a[v * 3 + 2]); } out.push(...rec); }
    }
  }
  fs.writeFileSync(cacheF, Buffer.from(new Float32Array(out).buffer));
  console.log('tris', out.length / 10);
  process.exit(0);
}
const T = new Float32Array(fs.readFileSync(cacheF).buffer.slice(0));
const NT = T.length / 10;
// grid index of triangles by xz bbox, 8 m cells
const C = 8, gx0 = -700, gz0 = -760, GW = 200, GH = 200, grid = new Map();
for (let t = 0; t < NT; t++) {
  const o = t * 10; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let k = 0; k < 3; k++) { const x = T[o + 1 + k * 3], z = T[o + 3 + k * 3]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let i = Math.floor((x0 - gx0) / C); i <= Math.floor((x1 - gx0) / C); i++) for (let j = Math.floor((z0 - gz0) / C); j <= Math.floor((z1 - gz0) / C); j++) { const k = i * 1000 + j; let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(t); }
}
const want = (process.env.SETS || SETS.join(',')).split(',').map((s) => SETS.indexOf(s));
function vhits(x, z) {
  const l = grid.get(Math.floor((x - gx0) / C) * 1000 + Math.floor((z - gz0) / C)) || [], hs = [];
  for (const t of l) {
    const o = t * 10; if (!want.includes(T[o])) continue;
    const ax = T[o + 1], ay = T[o + 2], az = T[o + 3], bx = T[o + 4], by = T[o + 5], bz = T[o + 6], cx = T[o + 7], cy = T[o + 8], cz = T[o + 9];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) continue;
    const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue;
    hs.push([+(l1 * ay + l2 * by + l3 * cy).toFixed(2), SETS[T[o]]]);
  }
  return hs.sort((a, b) => a[0] - b[0]);
}
if (cmd === 'v') { for (let i = 0; i < args.length; i += 2) console.log(args[i], args[i + 1], JSON.stringify(vhits(+args[i], +args[i + 1]))); }
if (cmd === 'top') {
  const [x0, z0, x1, z1, st] = args.slice(0, 5).map(Number), out = args[5];
  const W = Math.round((x1 - x0) / st), H = Math.round((z1 - z0) / st), buf = Buffer.alloc(W * H * 3);
  const lo = +(process.env.LO || -5), hi = +(process.env.HI || 60);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const h = vhits(x0 + (i + 0.5) * st, z0 + (j + 0.5) * st); const o = (j * W + i) * 3;
    if (!h.length) { buf[o] = 255; buf[o + 1] = 0; buf[o + 2] = 255; continue; }
    const v = Math.max(0, Math.min(1, (h[h.length - 1][0] - lo) / (hi - lo)));
    // turbo-ish
    buf[o] = 255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 3))); buf[o + 1] = 255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 2))); buf[o + 2] = 255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 1)));
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).resize(W * Math.max(1, Math.floor(900 / W)), null, { kernel: 'nearest' }).png().toFile(out);
}

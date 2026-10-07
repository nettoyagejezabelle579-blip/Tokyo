// Convert PLATEAU 3D Tiles (b3dm, ECEF, Draco, WebP) around Shibuya Crossing into local-space GLBs for the game.
// Game frame: origin = crossing street level, X = east, Y = up, Z = south (metres).
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, prune, dedup } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const SRC = process.argv[2], OUT = process.argv[3], ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const LAT0 = 35.6595 * Math.PI / 180, LON0 = 139.70052 * Math.PI / 180;
const AOI = [-620, -680, 680, 720];
const MAXTEX = +(process.env.MAXTEX || 1024);
const HIRADIUS = +(process.env.HIRADIUS || 400);

// WGS84
const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F);
function ecef(lat, lon, h) {
  const N = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
  return [(N + h) * Math.cos(lat) * Math.cos(lon), (N + h) * Math.cos(lat) * Math.sin(lon), (N * (1 - E2) + h) * Math.sin(lat)];
}
const O = ecef(LAT0, LON0, 0);
const sL = Math.sin(LAT0), cL = Math.cos(LAT0), sO = Math.sin(LON0), cO = Math.cos(LON0);
const Ev = [-sO, cO, 0], Nv = [-sL * cO, -sL * sO, cL], Uv = [cL * cO, cL * sO, sL];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// glTF (y-up) local vector -> game vector
const rot = (gx, gy, gz) => { const v = [gx, -gz, gy]; return [dot(Ev, v), dot(Uv, v), -dot(Nv, v)]; };
const toGame = (rtc, gx, gy, gz, ground) => {
  const d = [rtc[0] + gx - O[0], rtc[1] - gz - O[1], rtc[2] + gy - O[2]];
  return [dot(Ev, d), dot(Uv, d) - ground, -dot(Nv, d)];
};
const MLAT = 110950, MLON = 111320 * Math.cos(LAT0);
const regionBox = (r) => { const x0 = (r[0] - LON0) * 180 / Math.PI * MLON, x1 = (r[2] - LON0) * 180 / Math.PI * MLON; const z0 = -(r[3] - LAT0) * 180 / Math.PI * MLAT, z1 = -(r[1] - LAT0) * 180 / Math.PI * MLAT; return [x0, z0, x1, z1]; };
const hit = (b) => !(b[2] < AOI[0] || b[0] > AOI[2] || b[3] < AOI[1] || b[1] > AOI[3]);

function leaves(dir) {
  const t = JSON.parse(fs.readFileSync(path.join(dir, 'tileset.json')));
  const out = [];
  (function walk(n) {
    const b = regionBox(n.boundingVolume.region);
    if (!hit(b)) return;
    const ch = n.children || [];
    if (!ch.length && n.content) out.push({ uri: n.content.uri, box: b });
    ch.forEach(walk);
  })(t.root);
  return out;
}
function glbFromB3dm(buf) {
  const ftj = buf.readUInt32LE(12), ftb = buf.readUInt32LE(16), btj = buf.readUInt32LE(20), btb = buf.readUInt32LE(24);
  const glb = buf.subarray(28 + ftj + ftb + btj + btb);
  // read JSON, take CESIUM_RTC centre, strip the extension (unknown to glTF-Transform)
  const jl = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jl).toString());
  const rtc = json.extensions?.CESIUM_RTC?.center || [0, 0, 0];
  delete json.extensions?.CESIUM_RTC;
  json.extensionsUsed = (json.extensionsUsed || []).filter((e) => e !== 'CESIUM_RTC');
  json.extensionsRequired = (json.extensionsRequired || []).filter((e) => e !== 'CESIUM_RTC');
  let js = Buffer.from(JSON.stringify(json));
  const pad = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
  const rest = glb.subarray(20 + jl);
  const total = 12 + 8 + js.length + rest.length;
  const head = Buffer.alloc(20); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8); head.writeUInt32LE(js.length, 12); head.write('JSON', 16);
  return { glb: Buffer.concat([head, js, rest]), rtc };
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

async function load(file) {
  const buf = fs.readFileSync(file);
  const ftj = buf.readUInt32LE(12), ftb = buf.readUInt32LE(16), btj = buf.readUInt32LE(20);
  let bt = {};
  try { bt = btj ? JSON.parse(buf.subarray(28 + ftj + ftb, 28 + ftj + ftb + btj).toString()) : {}; } catch { bt = {}; }
  const { glb, rtc } = glbFromB3dm(buf);
  const doc = await io.readBinary(new Uint8Array(glb));
  const attrs = (bt.attributes || []).map((a) => { try { return typeof a === 'string' ? JSON.parse(a) : a; } catch { return {}; } });
  return { doc, rtc, attrs };
}
const FRN = { 横断歩道: 'paint', 停止線: 'paint', 車線境界線: 'paint', 区画線: 'paint', 車道外側線: 'paint', 車道中央線: 'paint', 道路標示: 'paint', 規制標示: 'paint', 指示標示: 'paint', 点字ブロック: 'tactile', マンホール: 'manhole', 側溝: 'manhole', 交通信号機: 'signal', 柱: 'pole', 照明施設: 'pole', 電線共同溝: 'pole', 視線誘導標: 'pole', '柵・壁': 'fence', 規制標識: 'sign', 補助標識: 'sign', 案内標識: 'sign', 指示標識: 'sign', 警戒標識: 'sign', '看板（自立式）': 'sign', 立像: 'statue', 電話ボックス: 'booth', 停留所: 'shelter', 地下出入口: 'entrance' };
const TRAN = { 歩道部: 'walk', 歩道: 'walk', 島: 'median', 分離帯: 'median', 植栽: 'median', 自転車歩行者道: 'walk' };
const KEEP = new Set(['横断歩道', '交通信号機', '照明施設', '立像', '停留所', '地下出入口', '停止線', '電話ボックス']);

// 1) street level at the crossing from the LOD3 road surfaces
async function groundLevel(tranDir) {
  const ys = [];
  for (const l of leaves(tranDir)) {
    if (Math.abs((l.box[0] + l.box[2]) / 2) > 400 || Math.abs((l.box[1] + l.box[3]) / 2) > 400) continue;
    const { doc, rtc } = await load(path.join(tranDir, l.uri));
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
      const a = p.getAttribute('POSITION').getArray();
      for (let i = 0; i < a.length; i += 3) {
        const [x, y, z] = toGame(rtc, a[i], a[i + 1], a[i + 2], 0);
        if (x * x + z * z < 18 * 18) ys.push(y);
      }
    }
  }
  ys.sort((a, b) => a - b);
  return ys.length ? ys[Math.floor(ys.length / 2)] : 0;
}

async function convertSet(name, dir, ground, opts = {}) {
  const outDir = path.join(OUT, name); fs.mkdirSync(outDir, { recursive: true });
  const index = [];
  for (const l of leaves(dir)) {
    const loaded = await load(path.join(dir, l.uri)); const { doc, rtc } = loaded;
    const root = doc.getRoot();
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], tris = 0;
    const { attrs } = loaded;
    for (const mesh of root.listMeshes()) for (const p of [...mesh.listPrimitives()]) {
      const pos = p.getAttribute('POSITION'), a = pos.getArray(), o = new Float32Array(a.length);
      for (let i = 0; i < a.length; i += 3) {
        const v = toGame(rtc, a[i], a[i + 1], a[i + 2], ground);
        o[i] = v[0]; o[i + 1] = v[1]; o[i + 2] = v[2];
        for (let k = 0; k < 3; k++) { if (v[k] < mn[k]) mn[k] = v[k]; if (v[k] > mx[k]) mx[k] = v[k]; }
      }
      pos.setArray(o);
      const nor = p.getAttribute('NORMAL');
      if (nor) { const n = nor.getArray(), on = new Float32Array(n.length); for (let i = 0; i < n.length; i += 3) { const v = rot(n[i], n[i + 1], n[i + 2]); on[i] = v[0]; on[i + 1] = v[1]; on[i + 2] = v[2]; } nor.setArray(on); }
      const b = p.getAttribute('_BATCHID');
      if (opts.classes && b && p.getIndices()) {
        // split triangles by feature class into separate primitives with named materials
        const bid = b.getArray(), idx = p.getIndices().getArray(), groups = new Map();
        for (let t = 0; t < idx.length; t += 3) {
          const at = attrs[bid[idx[t]]] || {};
          const fn = at['frn:function'] || at['tran:function'] || '';
          const cls = opts.classes === 'frn' ? (FRN[fn] || 'other') : (TRAN[fn] || 'road');
          if (!groups.has(cls)) groups.set(cls, []);
          groups.get(cls).push(idx[t], idx[t + 1], idx[t + 2]);
        }
        const mats = new Map();
        for (const [cls, list] of groups) {
          let m = mats.get(cls); if (!m) { let hh = 7; for (const ch of cls) hh = (hh * 31 + ch.charCodeAt(0)) % 997; m = doc.createMaterial(cls).setBaseColorFactor([(hh % 10) / 10, ((hh >> 2) % 10) / 10, ((hh >> 4) % 10) / 10, 1]); mats.set(cls, m); }
          const acc = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(list)).setBuffer(root.listBuffers()[0]);
          const np = doc.createPrimitive().setIndices(acc).setMaterial(m).setAttribute('POSITION', pos);
          if (p.getAttribute('NORMAL')) np.setAttribute('NORMAL', p.getAttribute('NORMAL'));
          // planar world UVs (4 m tiles) for ground materials
          if (opts.classes === 'tran') { const uv = new Float32Array(o.length / 3 * 2); for (let i = 0, j = 0; i < o.length; i += 3, j += 2) { uv[j] = o[i] / 4; uv[j + 1] = -o[i + 2] / 4; } np.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(root.listBuffers()[0])); }
          mesh.addPrimitive(np);
        }
        // feature records for gameplay (crosswalks, signals, lights, statues...)
        const per = new Map();
        for (let i = 0; i < bid.length; i++) {
          const at = attrs[bid[i]] || {}; const fn = at['frn:function'];
          if (!KEEP.has(fn)) continue;
          let r = per.get(bid[i]); if (!r) { r = { fn, n: 0, x: 0, y: 0, z: 0, pts: [] }; per.set(bid[i], r); }
          r.n++; r.x += o[i * 3]; r.y += o[i * 3 + 1]; r.z += o[i * 3 + 2]; if (r.pts.length < 400) r.pts.push([+o[i * 3].toFixed(2), +o[i * 3 + 2].toFixed(2)]);
          r.ymin = Math.min(r.ymin ?? 1e9, o[i * 3 + 1]); r.ymax = Math.max(r.ymax ?? -1e9, o[i * 3 + 1]);
        }
        for (const r of per.values()) FEATURES.push({ fn: r.fn, x: +(r.x / r.n).toFixed(2), y: +(r.ymin).toFixed(2), h: +(r.ymax - r.ymin).toFixed(2), z: +(r.z / r.n).toFixed(2), pts: r.fn === '横断歩道' || r.fn === '停止線' ? r.pts : undefined });
        mesh.removePrimitive(p); p.dispose();
      } else if (b) p.setAttribute('_BATCHID', null);
      for (const q of mesh.listPrimitives()) if (q.getAttribute('_BATCHID')) q.setAttribute('_BATCHID', null);
      tris += (p.getIndices() ? p.getIndices().getCount() : pos.getCount()) / 3;
    }
    for (const node of root.listNodes()) { node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
    // textures: written next to the tiles as WebP files (lo 1024 px for everything, hi up to 4096 px near the
    // crossing, streamed in by distance); the material keeps a 'tex:<k>' name pointing at its entry
    const file = path.basename(l.uri).replace('.b3dm', '.glb');
    const near = Math.hypot(Math.max(mn[0], Math.min(0, mx[0])), Math.max(mn[2], Math.min(0, mx[2]))) < HIRADIUS;
    const texOut = [];
    for (const mat of root.listMaterials()) {
      const tex = mat.getBaseColorTexture(); const img = tex?.getImage(); if (!img) continue;
      const k = texOut.length, base = `tex/${name}/${file.replace('.glb', '')}_${k}`;
      fs.mkdirSync(path.join(OUT, 'tex', name), { recursive: true });
      const meta = await sharp(Buffer.from(img)).metadata();
      const w = meta.width || 1024;
      await sharp(Buffer.from(img)).resize(Math.min(MAXTEX, w), Math.min(MAXTEX, w), { fit: 'inside' }).webp({ quality: 72 }).toFile(path.join(OUT, base + '_lo.webp'));
      let hi = null;
      if (near && name === 'bldg' && w > MAXTEX) { hi = base + '_hi.webp'; await sharp(Buffer.from(img)).resize(Math.min(4096, w), Math.min(4096, w), { fit: 'inside' }).webp({ quality: 80 }).toFile(path.join(OUT, hi)); }
      texOut.push(hi ? { lo: base + '_lo.webp', hi } : { lo: base + '_lo.webp' });
      mat.setName(`tex:${k}`); mat.setBaseColorTexture(null);
    }
    for (const m of root.listMaterials()) { m.setMetallicFactor(0); m.setRoughnessFactor(0.9); }
    if (opts.classes === 'tran') for (const mesh of root.listMeshes()) for (const q of mesh.listPrimitives()) if (q.getAttribute('TEXCOORD_0') === null) q.setAttribute('TEXCOORD_0', null);
    // keep UVs although no texture references them any more; never merge materials (names carry the texture)
    await doc.transform(prune({ keepAttributes: true }), dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }), draco({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 14, quantizeColor: 8 }));
    await io.write(path.join(outDir, file), doc);
    const bytes = fs.statSync(path.join(outDir, file)).size;
    index.push({ f: `${name}/${file}`, min: mn.map((v) => +v.toFixed(1)), max: mx.map((v) => +v.toFixed(1)), tris: Math.round(tris), kb: Math.round(bytes / 1024), ...(texOut.length ? { tex: texOut } : {}) });
    process.stdout.write(`${name}/${file} ${Math.round(bytes / 1024)}KB  `);
  }
  console.log(`\n${name}: ${index.length} files`);
  return index;
}

const sets = fs.readdirSync(SRC).filter((d) => fs.existsSync(path.join(SRC, d, 'tileset.json')));
const pick = (k) => path.join(SRC, sets.find((d) => d.includes(k)));
const FEATURES = [];
const ground = await groundLevel(pick('tran_3dtiles_lod3'));
console.log('street level at crossing (ellipsoid m):', ground.toFixed(2));
fs.mkdirSync(OUT, { recursive: true });
const ipath = path.join(OUT, 'index.json');
const index = fs.existsSync(ipath) ? JSON.parse(fs.readFileSync(ipath)) : { origin: { lat: 35.6595, lon: 139.70052, ellipsoidHeight: +ground.toFixed(2) }, sets: {} };
for (const [name, key, classes] of [['tran', 'tran_3dtiles_lod3', 'tran'], ['brid', 'brid_3dtiles_lod2'], ['frn', 'frn_3dtiles_lod3', 'frn'], ['veg', 'veg_SolitaryVegetationObject_3dtiles_lod3'], ['plant', 'veg_PlantCover_3dtiles_lod3'], ['bldg', 'bldg_3dtiles_13113_shibuya-ku_lod2']]) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  fs.rmSync(path.join(OUT, name), { recursive: true, force: true });
  index.sets[name] = await convertSet(name, pick(key), ground, { classes });
}
if (FEATURES.length) fs.writeFileSync(path.join(OUT, 'features.json'), JSON.stringify(FEATURES));
fs.writeFileSync(ipath, JSON.stringify(index));
console.log('done');

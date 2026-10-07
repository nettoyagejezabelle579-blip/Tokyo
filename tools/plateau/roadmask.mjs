import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import fs from 'fs';
import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const dir = process.argv[2], outF = process.argv[3];
const X0 = -640, Z0 = -700, R = 0.5, W = 2680, H = 2880;
const m = new Uint8Array(W * H);
const VAL = { road: 255, walk: 128, median: 64 };
const idx = JSON.parse(fs.readFileSync(dir + '/index.json'));
for (const e of idx.sets.tran) {
  const doc = await io.read(dir + '/' + e.f);
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const v = VAL[p.getMaterial()?.getName()] || 0; if (!v) continue;
    const a = p.getAttribute('POSITION').getArray(), ix = p.getIndices().getArray();
    for (let t = 0; t < ix.length; t += 3) {
      const P = [0, 1, 2].map((k) => [(a[ix[t + k] * 3] - X0) / R, (a[ix[t + k] * 3 + 2] - Z0) / R]);
      const [[ax, az], [bx, bz], [cx, cz]] = P;
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) continue;
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), i1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
      const j0 = Math.max(0, Math.floor(Math.min(az, bz, cz))), j1 = Math.min(H - 1, Math.ceil(Math.max(az, bz, cz)));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = i + 0.5, z = j + 0.5;
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
        if (l1 < 0 || l2 < 0 || l1 + l2 > 1) continue;
        if (v > m[j * W + i]) m[j * W + i] = v;
      }
    }
  }
}
await sharp(Buffer.from(m), { raw: { width: W, height: H, channels: 1 } }).png().toFile(outF);

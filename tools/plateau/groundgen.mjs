// Street-level heightfield from the PLATEAU road surfaces: lowest road surface per 4 m cell, holes filled by diffusion.
// Output: Int16 centimetres, row-major (z rows, x cols), header in index.json "ground".
import fs from 'fs';
const [cacheF, outF] = process.argv.slice(2);
const T = new Float32Array(fs.readFileSync(cacheF).buffer.slice(0));
const X0 = -640, Z0 = -700, X1 = 700, Z1 = 740, S = 4;
const W = (X1 - X0) / S + 1, H = (Z1 - Z0) / S + 1;
const h = new Float32Array(W * H).fill(NaN);
for (let t = 0; t < T.length; t += 10) {
  if (T[t] !== 1) continue; // tran
  const ax = T[t + 1], ay = T[t + 2], az = T[t + 3], bx = T[t + 4], by = T[t + 5], bz = T[t + 6], cx = T[t + 7], cy = T[t + 8], cz = T[t + 9];
  const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-6) continue;
  const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - X0) / S)), i1 = Math.min(W - 1, Math.floor((Math.max(ax, bx, cx) - X0) / S));
  const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) - Z0) / S)), j1 = Math.min(H - 1, Math.floor((Math.max(az, bz, cz) - Z0) / S));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = X0 + i * S, z = Z0 + j * S;
    const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
    const y = l1 * ay + l2 * by + l3 * cy, k = j * W + i;
    if (!(h[k] <= y)) h[k] = y;
  }
}
// vertices shared by thin roads can miss cell centres: also splat triangle vertices
const known = new Uint8Array(W * H);
for (let k = 0; k < h.length; k++) known[k] = h[k] === h[k] ? 1 : 0;
let filled = known.reduce((a, b) => a + b, 0);
console.log('cells', W, H, 'road cells', filled);
// diffusion fill (start from mean)
let mean = 0, n = 0; for (let k = 0; k < h.length; k++) if (known[k]) { mean += h[k]; n++; } mean /= n;
for (let k = 0; k < h.length; k++) if (!known[k]) h[k] = mean;
const tmp = new Float32Array(h);
for (let it = 0; it < 1500; it++) {
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (known[k]) { tmp[k] = h[k]; continue; }
    let s = 0, c = 0;
    if (i > 0) { s += h[k - 1]; c++; } if (i < W - 1) { s += h[k + 1]; c++; } if (j > 0) { s += h[k - W]; c++; } if (j < H - 1) { s += h[k + W]; c++; }
    tmp[k] = s / c;
  }
  h.set(tmp);
}
const out = new Int16Array(W * H); for (let k = 0; k < h.length; k++) out[k] = Math.round(h[k] * 100);
fs.writeFileSync(outF, Buffer.from(out.buffer));
console.log(JSON.stringify({ x0: X0, z0: Z0, step: S, w: W, h: H, f: 'ground.bin' }));

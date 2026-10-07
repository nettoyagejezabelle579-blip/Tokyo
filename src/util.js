export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function rng(seed) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

// Oriented rectangle on the ground plane: centre, half extents, rotation (rad, about +Y)
export function obb(cx, cz, hw, hd, rot = 0) {
  return { cx, cz, hw, hd, rot, c: Math.cos(rot), s: Math.sin(rot), r: Math.hypot(hw, hd) };
}

function axes(o) { return [[o.c, -o.s], [o.s, o.c]]; }
function project(o, ax) {
  const p = o.cx * ax[0] + o.cz * ax[1];
  const e = o.hw * Math.abs(o.c * ax[0] - o.s * ax[1]) + o.hd * Math.abs(o.s * ax[0] + o.c * ax[1]);
  return [p - e, p + e];
}
export function obbOverlap(a, b, margin = 0) {
  if (Math.hypot(a.cx - b.cx, a.cz - b.cz) > a.r + b.r + margin) return false;
  for (const ax of [...axes(a), ...axes(b)]) {
    const [a0, a1] = project(a, ax), [b0, b1] = project(b, ax);
    if (a1 + margin <= b0 || b1 + margin <= a0) return false;
  }
  return true;
}
// world -> local of obb (local x along width, local z along depth)
export function toLocal(o, x, z) {
  const dx = x - o.cx, dz = z - o.cz;
  return [dx * o.c - dz * o.s, dx * o.s + dz * o.c];
}
export function toWorld(o, lx, lz) {
  return [o.cx + lx * o.c + lz * o.s, o.cz - lx * o.s + lz * o.c];
}

export class Grid {
  constructor(cell = 24) { this.cell = cell; this.m = new Map(); }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(item, x0, z0, x1, z1) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const k = this.key(i, j);
        let a = this.m.get(k);
        if (!a) this.m.set(k, (a = []));
        a.push(item);
      }
  }
  query(x, z) { return this.m.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell))) || EMPTY; }
}
const EMPTY = [];

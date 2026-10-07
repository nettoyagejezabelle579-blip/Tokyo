import { obb, toLocal, toWorld, Grid } from './util.js';

// Static colliders (oriented boxes with a vertical span) and walkable floors/ramps.
export class Phys {
  constructor() { this.cols = new Grid(24); this.floors = new Grid(24); this.list = []; }
  _add(grid, item) {
    const o = item.o;
    grid.add(item, o.cx - o.r, o.cz - o.r, o.cx + o.r, o.cz + o.r);
  }
  box(cx, cz, w, d, y0, y1, rot = 0) {
    const it = { o: obb(cx, cz, w / 2, d / 2, rot), y0, y1 };
    this._add(this.cols, it); this.list.push(it);
    return it;
  }
  // axis-aligned helper from extents
  aabb(x0, z0, x1, z1, y0, y1) { return this.box((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y0, y1); }
  floor(cx, cz, w, d, y, rot = 0) { const it = { o: obb(cx, cz, w / 2, d / 2, rot), y }; this._add(this.floors, it); return it; }
  floorAabb(x0, z0, x1, z1, y) { return this.floor((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y); }
  // ramp rises from ya at local -d/2 to yb at +d/2
  ramp(cx, cz, w, d, ya, yb, rot = 0) { const it = { o: obb(cx, cz, w / 2, d / 2, rot), ya, yb }; this._add(this.floors, it); return it; }

  floorAt(x, z, y, step = 0.65, base = 0) {
    let best = base;
    for (const f of this.floors.query(x, z)) {
      const [lx, lz] = toLocal(f.o, x, z);
      if (Math.abs(lx) > f.o.hw || Math.abs(lz) > f.o.hd) continue;
      const h = f.y !== undefined ? f.y : f.ya + (f.yb - f.ya) * ((lz + f.o.hd) / (2 * f.o.hd));
      if (h <= y + step && h > best) best = h;
    }
    return best;
  }
  // Push a circle (radius r) at height span [y, y+h] out of all colliders.
  collide(p, r, h) {
    for (let iter = 0; iter < 2; iter++) {
      for (const c of this.cols.query(p.x, p.z)) {
        if (p.y + h <= c.y0 || p.y + 0.3 >= c.y1) continue;
        const o = c.o;
        const [lx, lz] = toLocal(o, p.x, p.z);
        const qx = Math.max(-o.hw, Math.min(o.hw, lx)), qz = Math.max(-o.hd, Math.min(o.hd, lz));
        let dx = lx - qx, dz = lz - qz;
        const d2 = dx * dx + dz * dz;
        if (d2 > r * r) continue;
        let nx, nz;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2); nx = dx / d * (r - d); nz = dz / d * (r - d);
          nx += lx; nz += lz;
        } else {
          // centre inside: push out along the shallowest axis
          const px = o.hw - Math.abs(lx), pz = o.hd - Math.abs(lz);
          if (px < pz) { nx = Math.sign(lx || 1) * (o.hw + r); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (o.hd + r); }
        }
        const [wx, wz] = toWorld(o, nx, nz);
        p.x = wx; p.z = wz;
      }
    }
  }
}

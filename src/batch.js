import * as THREE from 'three';

// Accumulates quads per material key and emits one mesh per key (few draw calls).
export class Batch {
  constructor() { this.g = new Map(); }
  get(key) {
    let b = this.g.get(key);
    if (!b) this.g.set(key, (b = { p: [], n: [], u: [], c: [] }));
    return b;
  }
  quad(key, a, b, c, d, uv = [0, 0, 1, 0, 1, 1, 0, 1], col = [1, 1, 1]) {
    const B = this.get(key);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const v = [a, b, c, d][i];
      B.p.push(v[0], v[1], v[2]); B.n.push(nx, ny, nz); B.u.push(uv[i * 2], uv[i * 2 + 1]); B.c.push(col[0], col[1], col[2]);
    }
  }
  // Horizontal rectangle (optionally rotated) with world-space UVs.
  rect(key, cx, cz, hw, hd, y, rot = 0, tile = 4, col) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (lx, lz) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
    const a = P(-hw, hd), b = P(hw, hd), cc = P(hw, -hd), d = P(-hw, -hd);
    const uv = [a, b, cc, d].flatMap((p) => [p[0] / tile, -p[2] / tile]);
    this.quad(key, a, b, cc, d, uv, col);
  }
  // Box: o = {x,z,w,d,y0,h,rot,key,top,tw,th,uo,col,shop,shopH,bottom,sides}
  box(o) {
    const hw = o.w / 2, hd = o.d / 2, y0 = o.y0 || 0, y1 = y0 + o.h, rot = o.rot || 0;
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (lx, y, lz) => [o.x + lx * c + lz * s, y, o.z - lx * s + lz * c];
    const tw = o.tw || 4, th = o.th || 4, uo = o.uo || 0, col = o.col || [1, 1, 1];
    const faces = [
      [[-hw, hd], [hw, hd]], [[hw, hd], [hw, -hd]], [[hw, -hd], [-hw, -hd]], [[-hw, -hd], [-hw, hd]],
    ];
    const sides = o.sides || [1, 1, 1, 1];
    let along = 0;
    faces.forEach(([p, q], i) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (sides[i]) {
        const segs = [];
        if (o.shop && sides[i] === 1 && y0 < 0.5) {
          const sh = o.shopH || 4.5;
          segs.push([o.shop, y0, Math.min(y1, sh), 12, 5, 0]);
          if (y1 > sh) segs.push([o.key, sh, y1, tw, th, sh]);
        } else segs.push([o.key, y0, y1, tw, th, o.vbase ?? 0]);
        for (const [k, ya, yb, TW, TH, vb] of segs) {
          const u0 = (along + uo) / TW, u1 = (along + uo + len) / TW;
          const v0 = (ya - vb) / TH, v1 = (yb - vb) / TH;
          this.quad(k, P(p[0], ya, p[1]), P(q[0], ya, q[1]), P(q[0], yb, q[1]), P(p[0], yb, p[1]), [u0, v0, u1, v0, u1, v1, u0, v1], col);
        }
      }
      along += len;
    });
    if (o.top !== null) {
      const tk = o.top || 'roof';
      const a = P(-hw, y1, hd), b = P(hw, y1, hd), cc = P(hw, y1, -hd), d = P(-hw, y1, -hd);
      const t = o.topTile || 10;
      this.quad(tk, a, b, cc, d, [a, b, cc, d].flatMap((v) => [v[0] / t, -v[2] / t]), o.topCol || [1, 1, 1]);
    }
    if (o.bottom) {
      const a = P(-hw, y0, -hd), b = P(hw, y0, -hd), cc = P(hw, y0, hd), d = P(-hw, y0, hd);
      this.quad(o.bottom, a, b, cc, d, [0, 0, 1, 0, 1, 1, 0, 1], col);
    }
  }
  // Vertical quad from (x0,z0) to (x1,z1), facing left of the direction of travel
  wall(key, x0, z0, x1, z1, y0, y1, uv, col) {
    this.quad(key, [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], uv, col);
  }
  build(mats, opts = {}) {
    const group = new THREE.Group();
    for (const [key, B] of this.g) {
      const mat = mats[key];
      if (!mat) { console.warn('no material', key); continue; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.name = key;
      m.castShadow = opts.cast?.(key) ?? true;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      group.add(m);
    }
    return group;
  }
}

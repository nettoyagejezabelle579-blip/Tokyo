// Real Shibuya from Project PLATEAU (MLIT 3D city model, Shibuya-ku 2023), converted to local glTF tiles
// in the game frame (metres, x east, z south, origin = Scramble Crossing). Adds a street-level ground
// mesh, physically based road/sidewalk materials, night windows, and mesh physics for the player.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { groundSet } from './pbr.js';
import { canvas, toTex } from './textures.js';
import { rng } from './util.js';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
const BASE = new URL('../assets/plateau/', import.meta.url).href;
const ORDER = ['tran', 'brid', 'bldg', 'frn', 'veg', 'plant'];

export class City {
  constructor(scene, opts = {}) {
    this.lowTex = !!opts.lowTex; // phones: halve the facade photos (about 120 MB of GPU memory instead of 490)
    this.root = new THREE.Group(); this.root.name = 'plateau';
    scene.add(this.root);
    this.solid = []; // meshes used by physics
    this.uni = { uNight: { value: 0 } };
    this.loaded = 0; this.total = 1;
    this.mats = this.makeMats();
  }

  makeMats() {
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const g = (k, o = {}) => { const s = groundSet(k); return std({ map: s.map, normalMap: s.normal, roughnessMap: s.orm, metalnessMap: s.orm, roughness: 1, metalness: 1, ...o }); };
    const off = (f) => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f * 2 });
    const M = {
      road: g('asphalt', { color: 0xc4beb6, ...off(-1) }), walk: g('paving', { color: 0x9b958c, ...off(-1) }), median: g('granite', { color: 0x9a968e, ...off(-1) }),
      ground: g('paving', { color: 0x8f8a82 }),
      bridge: std({ color: 0xa6a39b, roughness: 0.85 }),
      bldg: std({ color: 0xb9b4aa, roughness: 0.85 }),
      // street furniture (LOD3 area east of the station)
      paint: std({ color: 0xeeeeea, roughness: 0.7, ...off(-3) }), tactile: std({ color: 0xe2b81e, roughness: 0.6, ...off(-3) }),
      manhole: std({ color: 0x4a4a48, roughness: 0.5, metalness: 0.6, ...off(-3) }), signal: std({ color: 0x55595e, roughness: 0.5, metalness: 0.4 }),
      pole: std({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.8 }), fence: std({ color: 0x8d9297, roughness: 0.5, metalness: 0.5 }),
      sign: std({ color: 0x2a6fb5, roughness: 0.4 }), statue: std({ color: 0x4a4334, roughness: 0.35, metalness: 0.7 }),
      booth: std({ color: 0x9fb37a, roughness: 0.4 }), shelter: std({ color: 0xc8ccd0, roughness: 0.3, metalness: 0.5 }),
      entrance: std({ color: 0x8e9398, roughness: 0.4, metalness: 0.5 }), other: std({ color: 0x9a9a96, roughness: 0.6 }),
      leaf: std({ color: 0x5f7f45, roughness: 0.85 }), plant: g('grass', off(-2)),
    };
    for (const k of ['road', 'walk', 'median', 'ground']) { const m = M[k]; m.emissiveMap = m.map; m.emissive = new THREE.Color(0xffd9a8); m.emissiveIntensity = 0; }
    this.groundMats = [M.road, M.walk, M.median, M.ground];
    return M;
  }

  // Night windows: a world-space window grid on vertical faces, lit at random per pane, mixed with the aerial photo.
  nightify(m) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = this.uni.uNight;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uNight; varying vec3 vWP; varying vec3 vWN;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uNight > 0.01 && abs(vWN.y) < 0.35) {
  float u = abs(vWN.x) > abs(vWN.z) ? vWP.z : vWP.x;
  vec2 g = vec2(u / 2.2, vWP.y / 3.5);
  vec2 cell = floor(g), f = fract(g);
  float pane = step(0.18, f.x) * step(f.x, 0.82) * step(0.3, f.y) * step(f.y, 0.85);
  float r = h21(cell + floor(vWP.xz / 37.0) * 7.0), r2 = h21(cell.yx + 3.1);
  float shop = 1.0 - step(4.4, vWP.y);
  float lit = shop > 0.5 ? step(0.35, r) : step(0.6, r);
  float bright = shop > 0.5 ? 0.55 : (0.25 + 0.75 * r2);
  // far away the panes are sub-pixel: use their average instead (no shimmering)
  float aa = clamp(1.6 - max(fwidth(g.x), fwidth(g.y)) * 3.0, 0.0, 1.0);
  float win = mix((shop > 0.5 ? 0.65 : 0.4) * 0.38, lit * mix(pane, 1.0, shop * 0.5), aa);
  vec3 warm = mix(vec3(1.0, 0.8, 0.55), vec3(0.8, 0.9, 1.0), step(0.7, r2));
  float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  float glass = smoothstep(0.62, 0.18, lum); // windows show where the facade photo is dark glass
  totalEmissiveRadiance += uNight * warm * win * bright * (shop > 0.5 ? 0.9 : 0.55) * mix(0.25, 1.0, glass);
}`);
    };
    m.customProgramCacheKey = () => 'nightwin';
  }

  // street heightfield first (small): everything else is placed on it
  async loadGround() {
    const idx = (this.index = await (await fetch(BASE + 'index.json')).json());
    const G = (this.G = idx.ground);
    this.hf = new Int16Array(await (await fetch(BASE + G.f)).arrayBuffer());
    this.buildGround();
  }
  // then the city tiles, nearest first
  async load(start, onProgress) {
    const idx = this.index;
    const draco = new DRACOLoader().setDecoderPath(new URL('../vendor/addons/libs/draco/gltf/', import.meta.url).href);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const items = [];
    for (const set of ORDER) for (const e of idx.sets[set] || []) items.push({ set, ...e });
    const d = (e) => { const cx = Math.max(e.min[0], Math.min(start[0], e.max[0])), cz = Math.max(e.min[2], Math.min(start[2], e.max[2])); return Math.hypot(cx - start[0], cz - start[2]); };
    items.sort((a, b) => d(a) - d(b) + (a.set === 'tran' ? -60 : 0) - (b.set === 'tran' ? -60 : 0));
    this.total = items.length; this.loaded = 0;
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const it = items[next++];
        try { const g = await loader.loadAsync(BASE + it.f); this.add(it.set, g.scene); } catch (e) { console.warn('PLATEAU tile failed', it.f, e); }
        this.loaded++; onProgress?.(this.loaded / this.total, it);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    draco.dispose();
  }

  add(set, scene) {
    const M = this.mats, meshes = [];
    scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      const src = o.material, name = src?.name || '', map = src?.map || null;
      let mat;
      if (set === 'tran') mat = M[name] || M.road;
      else if (set === 'frn') mat = map ? this.photo(map, false) : (M[name] || M.other);
      else if (set === 'bldg') mat = map ? this.photo(map, true) : M.bldg;
      else if (set === 'brid') mat = map ? this.photo(map, false) : M.bridge;
      else if (set === 'veg') mat = map ? this.photo(map, false, true) : M.leaf;
      else mat = M.plant;
      if (set === 'plant') { o.position.y += 0.03; }
      o.material = mat;
      o.castShadow = set === 'bldg' || set === 'brid' || set === 'veg' || (set === 'frn' && !/paint|tactile|manhole/.test(name));
      o.receiveShadow = true;
      if (set === 'tran' || set === 'plant') o.userData.noAO = false;
      o.matrixAutoUpdate = false; o.updateMatrix();
      if (set !== 'veg' && set !== 'plant' && !(set === 'frn' && /paint|tactile|manhole/.test(name))) {
        o.geometry.boundsTree = new MeshBVH(o.geometry, { maxLeafTris: 12 });
        this.solid.push(o);
      }
    }
    scene.matrixAutoUpdate = false; scene.updateMatrixWorld(true);
    this.root.add(scene);
  }

  photo(map, windows, cut) {
    const img = map.image;
    if (this.lowTex && img && img.width > 512) {
      const c = document.createElement('canvas'); c.width = img.width / 2; c.height = img.height / 2;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      img.close?.(); map.image = c; map.needsUpdate = true;
    }
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    // aerial facade photos come out cool and hazy: warm them slightly
    const m = new THREE.MeshStandardMaterial({ map, color: 0xfff1e2, roughness: windows ? 0.78 : 0.9, metalness: 0, emissive: 0x000000, alphaTest: cut ? 0.4 : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide });
    if (windows) { this.nightify(m); m.emissive = new THREE.Color(0x000000); }
    return m;
  }

  // Heightfield (lowest road surface per 4 m cell; holes filled) -> continuous street-level ground under everything.
  ground(x, z) {
    const G = this.G; if (!G) return 0;
    const fx = Math.max(0, Math.min(G.w - 1.001, (x - G.x0) / G.step)), fz = Math.max(0, Math.min(G.h - 1.001, (z - G.z0) / G.step));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, W = G.w, h = this.hf;
    const a = h[j * W + i], b = h[j * W + i + 1], c = h[(j + 1) * W + i], d = h[(j + 1) * W + i + 1];
    return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) / 100;
  }
  buildGround() {
    const G = this.G, CH = 32; // chunks of 32x32 cells
    const mat = this.mats.ground;
    for (let cj = 0; cj < G.h - 1; cj += CH) for (let ci = 0; ci < G.w - 1; ci += CH) {
      const nw = Math.min(CH, G.w - 1 - ci), nh = Math.min(CH, G.h - 1 - cj);
      const geo = new THREE.PlaneGeometry(nw * G.step, nh * G.step, nw, nh).rotateX(-Math.PI / 2);
      const p = geo.attributes.position, uv = geo.attributes.uv;
      const x0 = G.x0 + ci * G.step, z0 = G.z0 + cj * G.step;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k) + x0 + nw * G.step / 2, z = p.getZ(k) + z0 + nh * G.step / 2;
        p.setXYZ(k, x, this.ground(x, z) - 0.22, z); uv.setXY(k, x / 4, -z / 4);
      }
      geo.computeVertexNormals(); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.matrixAutoUpdate = false;
      this.root.add(m);
    }
    // beyond the model: a city-coloured plain fading into the fog
    const R = rng(7), S = 1024, c = canvas(S, S), g = c.getContext('2d');
    g.fillStyle = '#77756f'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S;) { const bh = 24 + R() * 60; for (let x = 0; x < S;) { const bw = 24 + R() * 70; g.fillStyle = R() < 0.05 ? `hsl(${95 + R() * 20},30%,${30 + R() * 8}%)` : `hsl(${25 + R() * 20},${4 + R() * 6}%,${48 + R() * 14}%)`; g.fillRect(x, y, bw, bh); x += bw + 5; } y += bh + 5; }
    const t = toTex(c); t.repeat.set(40000 / 600, 40000 / 600); t.anisotropy = 8;
    const far = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
    far.rotation.x = -Math.PI / 2; far.position.y = -1.5;
    this.root.add(far);
  }

  setNight(n) {
    this.uni.uNight.value = n;
    for (const m of this.groundMats) m.emissiveIntensity = n * 0.16;
  }
}

// Player physics on the city meshes, combined with the hand-placed colliders (platforms, statue...) in Phys.
export class CityPhys {
  constructor(city, phys) {
    this.city = city; this.phys = phys;
    this.ray = new THREE.Raycaster(); this.ray.firstHitOnly = true;
    this.o = new THREE.Vector3(); this.down = new THREE.Vector3(0, -1, 0);
    this.dirs = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.cos(i * Math.PI / 4), 0, Math.sin(i * Math.PI / 4)));
    this.near = []; this.nearAt = new THREE.Vector3(1e9, 0, 0);
    this.hits = [];
  }
  // meshes whose bounds are near the player (refreshed every few metres)
  cand(x, z) {
    if (Math.hypot(x - this.nearAt.x, z - this.nearAt.z) > 8) {
      this.nearAt.set(x, 0, z); this.near.length = 0;
      for (const m of this.city.solid) {
        const b = m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox);
        if (x > b.min.x - 20 && x < b.max.x + 20 && z > b.min.z - 20 && z < b.max.z + 20) this.near.push(m);
      }
    }
    return this.near;
  }
  floorAt(x, z, y, step = 0.65) {
    let best = -Infinity;
    const list = this.cand(x, z);
    this.ray.firstHitOnly = false;
    this.ray.set(this.o.set(x, y + step + 0.05, z), this.down); this.ray.far = 400;
    this.hits.length = 0;
    this.ray.intersectObjects(list, false, this.hits);
    for (const h of this.hits) { if (h.point.y <= y + step && h.point.y > best) best = h.point.y; if (best > -Infinity) break; }
    this.ray.firstHitOnly = true;
    const p = this.phys.floorAt(x, z, y, step, -Infinity);
    if (p > best) best = p;
    const g = this.city.ground(x, z) - 0.2;
    if (best === -Infinity || (g > best && g <= y + step)) best = Math.max(best, g);
    return best;
  }
  collide(p, r, h) {
    this.phys.collide(p, r, h);
    const list = this.cand(p.x, p.z);
    for (const hgt of [0.45, 1.2]) for (const d of this.dirs) {
      this.ray.set(this.o.set(p.x, p.y + hgt, p.z), d); this.ray.far = r;
      this.hits.length = 0;
      this.ray.intersectObjects(list, false, this.hits);
      if (this.hits.length) { const push = r - this.hits[0].distance; p.x -= d.x * push; p.z -= d.z * push; }
    }
  }
}

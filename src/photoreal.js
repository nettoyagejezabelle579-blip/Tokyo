// Google Photorealistic 3D Tiles ("Google Earth" look) around Shibuya, plus raycast physics on the tiles.
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { GoogleCloudAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin, TileCompressionPlugin } from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

const DEG = Math.PI / 180;
// Centre of the Scramble Crossing; the game's origin. Street level is about 52 m above the WGS84 ellipsoid.
export const ORIGIN = { lat: 35.6595, lon: 139.70052, h: 52 };
const M_LAT = 110950, M_LON = 111320 * Math.cos(ORIGIN.lat * DEG);
export const geo = (lat, lon) => [(lon - ORIGIN.lon) * M_LON, -(lat - ORIGIN.lat) * M_LAT];

// Fast-travel spots at their real coordinates. mode: 'top' = highest surface, else surface nearest y.
export const PHOTO_TRAVEL = [
  { id: 'scramble', jp: 'スクランブル交差点', en: 'Scramble Crossing', ll: [35.65928, 139.70068], y: 0, yaw: -2.5 },
  { id: 'hachiko', jp: 'ハチ公像', en: 'Hachikō Statue', ll: [35.65912, 139.70052], y: 0, yaw: 2.6 },
  { id: 'centergai', jp: 'センター街', en: 'Center Gai', ll: [35.65985, 139.69990], y: 1, yaw: -1.9 },
  { id: '109', jp: 'SHIBUYA109', en: 'Shibuya 109', ll: [35.65955, 139.69905], y: 2, yaw: -1.6, pitch: 0.2 },
  { id: 'sky', jp: 'SHIBUYA SKY', en: 'Shibuya Sky (229.7 m)', ll: [35.65842, 139.70205], mode: 'top', yaw: -2.2, pitch: -0.3 },
  { id: 'miyashita', jp: 'MIYASHITA PARK', en: 'Miyashita Park rooftop', ll: [35.66195, 139.70188], y: 17, yaw: Math.PI },
  { id: 'hikarie', jp: '渋谷ヒカリエ前', en: 'Shibuya Hikarie', ll: [35.65915, 139.70330], y: 4, yaw: -1.3 },
  { id: 'stream', jp: '渋谷ストリーム', en: 'Shibuya Stream', ll: [35.65740, 139.70290], y: 0, yaw: 0.2 },
  { id: 'sakura', jp: '渋谷サクラステージ', en: 'Sakura Stage', ll: [35.65640, 139.70060], y: 4, yaw: 0.3 },
  { id: 'dogenzaka', jp: '道玄坂', en: 'Dōgenzaka', ll: [35.65870, 139.69770], y: 10, yaw: 1.3 },
  { id: 'aerial', jp: '上空から', en: 'Aerial view (fly)', ll: [35.65750, 139.70300], fly: 320, yaw: -2.4, pitch: -0.5 },
];

export class Photoreal {
  constructor(scene, camera, renderer, mobile) {
    this.scene = scene; this.camera = camera; this.renderer = renderer; this.mobile = mobile;
    this.tiles = null; this.active = false; this.ready = false;
    this.root = new THREE.Group();
    this.root.rotation.y = Math.PI; // plugin frame: X west / Z north  ->  game frame: X east / Z south
    this.root.userData.noAO = false;
    scene.add(this.root);
    this.tint = new THREE.Color(1, 1, 1);
    this.mats = new Set();
    this.ray = new THREE.Raycaster();
    this.ray.firstHitOnly = false;
    this.cache = new Map();
    this.calib = 0;
    this.onError = null;
  }

  start(key) {
    this.stop();
    const tiles = new TilesRenderer();
    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: key, autoRefreshToken: true }));
    const draco = new DRACOLoader().setDecoderPath(new URL('../vendor/addons/libs/draco/gltf/', import.meta.url).href);
    tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new ReorientationPlugin({ lat: ORIGIN.lat * DEG, lon: ORIGIN.lon * DEG, height: ORIGIN.h, recenter: true }));
    tiles.errorTarget = this.mobile ? 16 : 6;
    tiles.accelerateRaycast = false; // Google tile bounds are loose; test loaded meshes directly (BVH below)
    tiles.lruCache.maxSize = this.mobile ? 600 : 1400;
    tiles.setCamera(this.camera);
    tiles.setResolutionFromRenderer(this.camera, this.renderer);
    tiles.addEventListener('load-model', ({ scene }) => {
      scene.traverse((o) => {
        if (!o.isMesh) return;
        // Photogrammetry already contains real lighting: render it unlit and tint it for time of day
        const old = o.material;
        const m = new THREE.MeshBasicMaterial({ map: old.map || null, color: this.tint, side: THREE.FrontSide });
        old.dispose?.();
        o.material = m; this.mats.add(m);
        o.geometry.boundsTree = new MeshBVH(o.geometry, { maxLeafTris: 12 });
        o.raycast = acceleratedRaycast;
        o.userData.noAO = true;
      });
      this.cache.clear();
    });
    tiles.addEventListener('dispose-model', ({ scene }) => scene.traverse((o) => { if (o.isMesh) this.mats.delete(o.material); }));
    tiles.addEventListener('load-error', (e) => { if (!this.ready && this.onError) this.onError(e.error || e); });
    tiles.addEventListener('load-root-tileset', () => { this.ready = true; });
    this.root.add(tiles.group);
    this.root.position.set(0, 0, 0);
    this.tiles = tiles; this.active = true; this.ready = false; this.calib = 0; this.calibAt = 0;
  }

  stop() {
    if (!this.tiles) return;
    this.root.remove(this.tiles.group);
    this.tiles.dispose();
    this.tiles = null; this.active = false; this.ready = false; this.mats.clear(); this.cache.clear();
  }

  update(now, night, golden) {
    if (!this.tiles) return;
    const t = this.tint;
    t.setRGB(1, 1, 1).lerp(new THREE.Color(1.0, 0.86, 0.72), golden * 0.6).lerp(new THREE.Color(0.2, 0.22, 0.3), night * 0.85);
    for (const m of this.mats) m.color.copy(t);
    this.camera.updateMatrixWorld();
    this.tiles.setResolutionFromRenderer(this.camera, this.renderer);
    this.tiles.update();
    // keep street level at the crossing on y = 0 while finer tiles stream in
    const rt = performance.now();
    if (this.ready && this.calib < 12 && rt - this.calibAt > 1500) {
      this.calibAt = rt;
      const h = this.surface(0, 0, 0, 'near', 60);
      if (h !== null && Math.abs(h) < 40) { this.root.position.y -= h; this.calib++; this.cache.clear(); }
    }
  }

  attribution() {
    if (!this.tiles) return '';
    const list = this.tiles.getAttributions().filter((a) => a.type === 'string').map((a) => a.value).join(' ');
    return list;
  }

  // All surface heights under (x, z) between y0 and y1
  hits(x, z, top = 700, far = 1400) {
    if (!this.tiles) return [];
    this.ray.set(new THREE.Vector3(x, top, z), new THREE.Vector3(0, -1, 0));
    this.ray.far = far;
    const out = [];
    this.tiles.raycast(this.ray, out);
    return out.map((h) => h.point.y).sort((a, b) => b - a);
  }
  // mode 'top': highest surface; 'near': surface closest to yWant
  surface(x, z, yWant = 0, mode = 'near', range = 30) {
    const hs = this.hits(x, z);
    if (!hs.length) return null;
    if (mode === 'top') return hs[0];
    let best = null;
    for (const y of hs) if (Math.abs(y - yWant) <= range && (best === null || Math.abs(y - yWant) < Math.abs(best - yWant))) best = y;
    return best;
  }
  // Cached street height for crowds and cars (3 m cells)
  ground(x, z) {
    const k = (Math.round(x / 3) * 4099) ^ Math.round(z / 3);
    let v = this.cache.get(k);
    if (v === undefined) {
      if (this.budget-- <= 0) return this.lastGround ?? 0;
      v = this.surface(Math.round(x / 3) * 3, Math.round(z / 3) * 3, 0, 'near', 12) ?? 0;
      this.cache.set(k, v);
    }
    this.lastGround = v;
    return v;
  }
  resetBudget(n) { this.budget = n; }
}

// Player physics on top of the tiles (same interface as Phys)
export class TilePhys {
  constructor(pr) {
    this.pr = pr;
    this.ray = new THREE.Raycaster();
    this.ray.firstHitOnly = true;
    this.dirs = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.cos(i * Math.PI / 4), 0, Math.sin(i * Math.PI / 4)));
    this.o = new THREE.Vector3();
  }
  floorAt(x, z, y, step = 0.7) {
    const t = this.pr.tiles;
    if (!t) return y;
    this.ray.firstHitOnly = false;
    this.ray.set(this.o.set(x, y + 1.6, z), new THREE.Vector3(0, -1, 0));
    this.ray.far = 80;
    const hits = [];
    t.raycast(this.ray, hits);
    this.ray.firstHitOnly = true;
    let best = null;
    for (const h of hits) if (h.point.y <= y + step && (best === null || h.point.y > best)) best = h.point.y;
    return best === null ? (hits.length ? y : y) : best;
  }
  collide(p, r) {
    const t = this.pr.tiles;
    if (!t) return;
    for (const hgt of [0.55, 1.3]) {
      for (const d of this.dirs) {
        this.ray.set(this.o.set(p.x, p.y + hgt, p.z), d);
        this.ray.far = r;
        const hits = [];
        t.raycast(this.ray, hits);
        if (hits.length) { const push = r - hits[0].distance; p.x -= d.x * push; p.z -= d.z * push; }
      }
    }
  }
}

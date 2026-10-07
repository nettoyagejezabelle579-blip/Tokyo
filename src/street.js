// Street level: the PLATEAU facade photos were shot from the air, so ground floors come out smeared.
// Every building wall that faces a sidewalk (assets/plateau/frontage.json, extracted from the model) gets
// glass shopfronts, a signboard band and, on taller buildings, the vertical signs (袖看板) Shibuya streets
// are lined with. Drawn here, not copied from photos; lit from inside at night.
import * as THREE from 'three';
import { canvas, toTex, JP } from './textures.js';
import { rng } from './util.js';

const R = rng(2468);
const NAMES = ['ドラッグストア', 'カラオケ', '居酒屋', 'ラーメン', '焼肉', '牛丼', 'CAFE', '古着', 'SHOES', 'コスメ', '100円ショップ', 'ゲームセンター', 'BOOKS', '回転寿司', '眼鏡', 'モバイル', '両替 EXCHANGE', 'くすり', '24H MART', 'たこ焼き', 'クレープ', 'うどん', 'カレー', 'パン BAKERY', '雑貨', 'スニーカー', '時計 WATCH', 'BAR', 'ネイル', '美容室', 'ピザ', 'そば', '天ぷら', '中華料理', '餃子', 'ハンバーガー', 'ドーナツ', 'MUSIC', 'カメラ', 'アイウェア', 'TAX FREE', 'ゲーム', '漫画喫茶', '花屋', '寿司', 'お好み焼き', 'スイーツ', '韓国料理', 'タピオカ', 'ファッション', 'セレクトショップ', 'アクセサリー', 'バッグ', '帽子', 'スポーツ', '腕時計', '和菓子', 'ステーキ', '定食', 'つけ麺', 'からあげ', '抹茶', 'コーヒー', 'ビアホール'];
const VNAMES = ['カラオケ', '居酒屋', 'ラーメン', '焼肉', '漫画喫茶', 'ゲームセンター', '古着屋', 'BAR', 'ホテル', '歯科', '美容室', '寿司', '中華', 'ドラッグ', '整体', 'カフェ', 'クラブ', 'ダーツ', '英会話', '質屋', 'ネイル', '麻雀', 'そば', '天ぷら', 'ビリヤード', 'ライブハウス', '占い', 'ジム', 'エステ', '脱毛', '学習塾', '居酒屋'];

// ---------- textures ----------
const SF = { cols: 4, rows: 4, w: 512, h: 320 };
function storefronts() {
  const W = SF.cols * SF.w, H = SF.rows * SF.h;
  const c = canvas(W, H), g = c.getContext('2d'), e = canvas(W, H), ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  for (let k = 0; k < SF.cols * SF.rows; k++) {
    const x0 = (k % SF.cols) * SF.w, y0 = Math.floor(k / SF.cols) * SF.h, w = SF.w, h = SF.h;
    const kind = k % 8, warm = R() < 0.5;
    // interior
    const back = ['#f2efe6', '#e9e4d8', '#3a2c22', '#f5f5f2', '#d8d2c6', '#2a2a30', '#efe6d4', '#e2e6ea'][kind];
    g.fillStyle = back; g.fillRect(x0, y0, w, h);
    if (kind === 0 || kind === 3 || kind === 7) { // shelves of products (drugstore, convenience, goods)
      for (let r = 0; r < 4; r++) {
        const y = y0 + 40 + r * 62; g.fillStyle = '#9a9a96'; g.fillRect(x0, y + 46, w, 6);
        for (let x = x0 + 4; x < x0 + w - 8; x += 6 + R() * 10) { g.fillStyle = `hsl(${R() * 360},${55 + R() * 40}%,${40 + R() * 35}%)`; g.fillRect(x, y + 10 + R() * 14, 5 + R() * 8, 36 - R() * 10); }
      }
      g.fillStyle = kind === 0 ? '#ffd400' : kind === 3 ? '#0a7d3c' : '#e8380d'; g.fillRect(x0 + 10, y0 + 6, w - 20, 24);
    } else if (kind === 1 || kind === 6) { // clothes on racks
      g.fillStyle = '#c9b89c'; g.fillRect(x0, y0 + h - 60, w, 60);
      for (let r = 0; r < 2; r++) { const y = y0 + 50 + r * 110; g.fillStyle = '#555'; g.fillRect(x0 + 20, y, w - 40, 4);
        for (let x = x0 + 24; x < x0 + w - 30; x += 9 + R() * 6) { g.fillStyle = `hsl(${R() * 360},${20 + R() * 50}%,${25 + R() * 50}%)`; g.fillRect(x, y + 4, 8, 70 + R() * 30); } }
      for (let i = 0; i < 3; i++) { const x = x0 + 60 + i * 160; g.fillStyle = '#ddd'; g.beginPath(); g.ellipse(x, y0 + 150, 20, 26, 0, 0, 7); g.fill(); g.fillStyle = `hsl(${R() * 360},40%,40%)`; g.fillRect(x - 26, y0 + 176, 52, 90); }
    } else if (kind === 2 || kind === 5) { // restaurant / bar: warm, wooden, lanterns
      g.fillStyle = kind === 2 ? '#6b4a2e' : '#1c1c22'; g.fillRect(x0, y0 + h - 110, w, 110);
      for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(255,214,150,0.9)'; g.beginPath(); g.arc(x0 + 30 + i * 56, y0 + 60, 12, 0, 7); g.fill(); }
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(30,20,15,0.8)`; g.beginPath(); g.ellipse(x0 + 50 + i * 80, y0 + h - 130, 16, 22, 0, 0, 7); g.fill(); g.fillRect(x0 + 34 + i * 80, y0 + h - 112, 32, 40); }
      if (kind === 2) { g.fillStyle = '#1d2a50'; for (let i = 0; i < 4; i++) g.fillRect(x0 + 40 + i * 110, y0 + 20, 70, 110); g.fillStyle = '#fff'; g.font = `700 40px ${JP}`; ['の', 'れ', 'ん', '暖'].forEach((t, i) => g.fillText(t, x0 + 55 + i * 110, y0 + 90)); }
    } else { // café / bright open shop
      g.fillStyle = '#7a5537'; g.fillRect(x0, y0 + h - 90, w, 90);
      for (let i = 0; i < 5; i++) { g.fillStyle = '#4a3322'; g.fillRect(x0 + 30 + i * 96, y0 + h - 150, 60, 8); g.fillStyle = 'rgba(255,230,180,0.95)'; g.beginPath(); g.arc(x0 + 60 + i * 96, y0 + 40, 14, 0, 7); g.fill(); }
      g.fillStyle = '#2d5a3a'; g.fillRect(x0 + 20, y0 + 70, 140, 80);
    }
    // emissive: interior light (before the glass and frame are drawn over it)
    ge.globalAlpha = 0.9; ge.drawImage(c, x0, y0, w, h, x0, y0, w, h); ge.globalAlpha = 1;
    ge.fillStyle = warm ? 'rgba(255,190,110,0.25)' : 'rgba(200,225,255,0.18)'; ge.fillRect(x0, y0, w, h);
    // glass: reflections + mullions + kickplate
    const gr = g.createLinearGradient(x0, y0, x0 + w, y0 + h); gr.addColorStop(0, 'rgba(190,210,225,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(160,180,200,0.3)');
    g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x0 + w * 0.15, y0); g.lineTo(x0 + w * 0.3, y0); g.lineTo(x0 + w * 0.1, y0 + h); g.lineTo(x0 - w * 0.05, y0 + h); g.fill();
    const frame = ['#2b2d31', '#c9ccd0', '#1a1a1a', '#8a6a4a'][k % 4];
    g.fillStyle = frame; ge.fillStyle = '#000';
    for (const fx of [0, w / 2 - 4, w - 8]) { g.fillRect(x0 + fx, y0, 8, h); ge.fillRect(x0 + fx, y0, 8, h); }
    g.fillRect(x0, y0, w, 10); g.fillRect(x0, y0 + h - 24, w, 24); ge.fillRect(x0, y0, w, 10); ge.fillRect(x0, y0 + h - 24, w, 24);
    if (k % 3 === 0) { g.fillStyle = 'rgba(20,20,20,0.6)'; g.fillRect(x0 + w / 2 - 70, y0 + 10, 140, h - 34); ge.fillStyle = 'rgba(255,220,170,0.5)'; ge.fillRect(x0 + w / 2 - 70, y0 + 10, 140, h - 34); } // open door
  }
  return { map: toTex(c, false), emi: toTex(e, false) };
}
const FA = { cols: 4, rows: 16, w: 512, h: 72 };
function fascias() {
  const W = FA.cols * FA.w, H = FA.rows * FA.h;
  const c = canvas(W, H), g = c.getContext('2d'), e = canvas(W, H), ge = e.getContext('2d');
  NAMES.forEach((t, i) => {
    const x0 = (i % FA.cols) * FA.w, y0 = Math.floor(i / FA.cols) * FA.h, hue = (i * 67) % 360;
    const style = i % 4, bg = style === 0 ? '#f7f7f4' : style === 1 ? `hsl(${hue},75%,42%)` : style === 2 ? '#141414' : `hsl(${hue},60%,88%)`;
    const fg = style === 0 ? `hsl(${hue},80%,38%)` : style === 1 ? '#fff' : style === 2 ? `hsl(${hue},90%,62%)` : `hsl(${hue},70%,28%)`;
    g.fillStyle = bg; g.fillRect(x0, y0, FA.w, FA.h);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0, y0 + FA.h - 6, FA.w, 6);
    g.fillStyle = fg; g.font = `900 ${FA.h * 0.6}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t, x0 + FA.w / 2, y0 + FA.h / 2 + 2, FA.w * 0.9);
    ge.drawImage(c, x0, y0, FA.w, FA.h, x0, y0, FA.w, FA.h);
  });
  return { map: toTex(c, false), emi: toTex(e, false) };
}
const VS = { cols: 16, rows: 2, w: 96, h: 512 };
function vsigns() {
  const W = VS.cols * VS.w, H = VS.rows * VS.h;
  const c = canvas(W, H), g = c.getContext('2d'), e = canvas(W, H), ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  VNAMES.forEach((t, i) => {
    const x0 = (i % VS.cols) * VS.w, y0 = Math.floor(i / VS.cols) * VS.h, hue = (i * 47) % 360;
    // stacked tenant panels like a real 袖看板: 2-4 panels per sign
    const n = 2 + (i % 3), ph = VS.h / n;
    for (let p = 0; p < n; p++) {
      const word = p === 0 ? t : VNAMES[(i * 7 + p * 5) % VNAMES.length], hh = (hue + p * 83) % 360;
      const white = (i + p) % 3 === 0;
      g.fillStyle = white ? '#fbfbf8' : `hsl(${hh},80%,${38 + (p % 2) * 10}%)`; g.fillRect(x0 + 3, y0 + p * ph + 3, VS.w - 6, ph - 6);
      g.fillStyle = white ? `hsl(${hh},85%,38%)` : '#fff';
      const chars = [...word], fs = Math.min(VS.w * 0.7, (ph - 16) / chars.length);
      g.font = `900 ${fs}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      chars.forEach((ch, k) => g.fillText(ch, x0 + VS.w / 2, y0 + p * ph + 8 + fs * (k + 0.5) * ((ph - 16) / (fs * chars.length))));
    }
    ge.drawImage(c, x0, y0, VS.w, VS.h, x0, y0, VS.w, VS.h);
  });
  return { map: toTex(c, false), emi: toTex(e, false) };
}

// ---------- geometry ----------
class Quads {
  constructor() { this.p = []; this.uv = []; this.i = []; }
  // quad from bottom-left (x,y,z) along unit u (ux,uz) width w, height h, uv rect [u0,v0,u1,v1]
  add(x, y, z, ux, uz, w, h, r) {
    const n = this.p.length / 3;
    this.p.push(x, y, z, x + ux * w, y, z + uz * w, x + ux * w, y + h, z + uz * w, x, y + h, z);
    this.uv.push(r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[3]);
    this.i.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.matrixAutoUpdate = false;
    return m;
  }
}
const cell = (k, cols, rows) => { const cx = k % cols, cy = Math.floor(k / cols) % rows; return [cx / cols, 1 - (cy + 1) / rows, (cx + 1) / cols, 1 - cy / rows]; };

export async function buildStreet(scene, city, url) {
  const list = await (await fetch(url)).json();
  const root = new THREE.Group(); root.name = 'street'; scene.add(root);
  const T = { sf: storefronts(), fa: fascias(), vs: vsigns() };
  const mk = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emi, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...o });
  const M = { sf: mk(T.sf, { roughness: 0.12 }), fa: mk(T.fa, { roughness: 0.5 }), vs: mk(T.vs, { roughness: 0.5, side: THREE.DoubleSide, polygonOffset: false }) };
  const Q = { sf: new Quads(), fa: new Quads(), vs: new Quads(), dark: new Quads() };
  for (const [ax, az, bx, bz, hgt] of list) {
    const L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
    // outward normal = right of a->b; quads run b->a so they face outward and read left-to-right
    const nx = (bz - az) / L, nz = -(bx - ax) / L, ux = -(bx - ax) / L, uz = -(bz - az) / L;
    const units = Math.max(1, Math.round(L / (5 + R() * 4)));
    const uw = L / units;
    for (let k = 0; k < units; k++) {
      const s0 = k * uw, x = bx + ux * s0, z = bz + uz * s0, mx = x + ux * uw / 2, mz = z + uz * uw / 2;
      const g = city.ground(mx + nx * 1.5, mz + nz * 1.5);
      const y0 = g - 0.25, sh = 3.55, rnd = R();
      const ox = nx * 0.1, oz = nz * 0.1;
      Q.sf.add(x + ux * 0.15 + ox, y0, z + uz * 0.15 + oz, ux, uz, uw - 0.3, sh, cell(Math.floor(rnd * 16), SF.cols, SF.rows));
      Q.fa.add(x + nx * 0.18, y0 + sh, z + nz * 0.18, ux, uz, uw, 0.85, cell(Math.floor(R() * NAMES.length), FA.cols, FA.rows));
      // vertical signs on taller buildings, sticking out from the wall
      if (hgt > 10 && R() < 0.5) {
        const sx = x + ux * Math.min(uw - 0.3, 0.6), sz = z + uz * Math.min(uw - 0.3, 0.6);
        const vh = Math.min(hgt - 6, 4 + R() * 7), vy = y0 + sh + 1.4;
        const r = cell(Math.floor(R() * VNAMES.length), VS.cols, VS.rows);
        Q.vs.add(sx + nx * 0.25, vy, sz + nz * 0.25, nx, nz, 0.95, vh, r);
      }
    }
  }
  for (const k of ['sf', 'fa', 'vs']) { const m = Q[k].mesh(M[k]); m.castShadow = k === 'vs'; root.add(m); }
  return {
    root,
    setNight(n) { M.sf.emissiveIntensity = 0.3 + n * 0.55; M.fa.emissiveIntensity = 0.12 + n * 0.75; M.vs.emissiveIntensity = 0.08 + n * 0.95; M.sf.color.setScalar(1 - n * 0.55); M.fa.color.setScalar(1 - n * 0.5); },
  };
}

// Procedural PBR texture sets: albedo + normal + ORM (G=roughness, B=metalness) + night emissive.
import * as THREE from 'three';
import { rng } from './util.js';
import { canvas, JP } from './textures.js';

const R = rng(9001);
const tex = (c, srgb, repeat = true) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
};

class Painter {
  constructor(S) {
    this.S = S;
    this.c = { a: canvas(S, S), h: canvas(S, S), o: canvas(S, S), e: canvas(S, S) };
    this.g = {}; for (const k in this.c) this.g[k] = this.c[k].getContext('2d');
    this.g.h.fillStyle = 'rgb(128,128,128)'; this.g.h.fillRect(0, 0, S, S);
    this.g.o.fillStyle = 'rgb(255,230,0)'; this.g.o.fillRect(0, 0, S, S);
    this.g.e.fillStyle = '#000'; this.g.e.fillRect(0, 0, S, S);
  }
  // p: { c: albedo css, h: 0..1 height, r: roughness, m: metalness }
  rect(x, y, w, h, p) {
    const g = this.g;
    if (p.c) { g.a.fillStyle = p.c; g.a.fillRect(x, y, w, h); }
    if (p.h !== undefined) { const v = Math.round(p.h * 255); g.h.fillStyle = `rgb(${v},${v},${v})`; g.h.fillRect(x, y, w, h); }
    if (p.r !== undefined || p.m !== undefined) { g.o.fillStyle = `rgb(255,${Math.round((p.r ?? 0.9) * 255)},${Math.round((p.m ?? 0) * 255)})`; g.o.fillRect(x, y, w, h); }
  }
  grad(x, y, w, h, c0, c1) { const g = this.g.a, gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(x, y, w, h); }
  noise(amt, n, x = 0, y = 0, w = this.S, h = this.S, size = 2) {
    const g = this.g.a, gh = this.g.h;
    for (let i = 0; i < n; i++) {
      const px = x + R() * w, py = y + R() * h, s = 1 + R() * size, d = R() < 0.5;
      g.fillStyle = `rgba(${d ? '0,0,0' : '255,255,255'},${R() * amt})`; g.fillRect(px, py, s, s);
      gh.fillStyle = `rgba(${d ? '0,0,0' : '255,255,255'},${R() * amt * 0.6})`; gh.fillRect(px, py, s, s);
    }
  }
  // lit interior for the night emissive map (and faint daytime interior detail)
  lit(x, y, w, h, p = 0.4) {
    const e = this.g.e;
    if (R() > p) return;
    const warm = R() < 0.55;
    const gr = e.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, warm ? '#fff1d6' : '#eef5ff'); gr.addColorStop(1, warm ? '#c98d48' : '#7f93ad');
    e.globalAlpha = 0.45 + R() * 0.55; e.fillStyle = gr; e.fillRect(x, y, w, h);
    e.globalAlpha = 0.9; e.fillStyle = warm ? '#fff6e6' : '#ffffff';
    e.fillRect(x + w * 0.1, y + 2, w * 0.8, Math.max(2, h * 0.05)); // ceiling light strip
    // silhouettes / furniture
    e.globalAlpha = 0.5; e.fillStyle = '#2a2018';
    for (let i = 0; i < 3; i++) if (R() < 0.5) e.fillRect(x + R() * w * 0.8, y + h * (0.55 + R() * 0.2), w * (0.1 + R() * 0.15), h * 0.45);
    e.globalAlpha = 1;
  }
  build(normalStrength = 2.5) {
    const S = this.S;
    const hd = this.g.h.getImageData(0, 0, S, S).data;
    const n = this.g.h.createImageData(S, S), nd = n.data;
    const H = (x, y) => hd[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * normalStrength, dy = (H(x, y + 1) - H(x, y - 1)) * normalStrength;
      const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
      nd[i] = (-dx / l * 0.5 + 0.5) * 255; nd[i + 1] = (dy / l * 0.5 + 0.5) * 255; nd[i + 2] = (1 / l * 0.5 + 0.5) * 255; nd[i + 3] = 255;
    }
    const nc = canvas(S, S); nc.getContext('2d').putImageData(n, 0, 0);
    return { map: tex(this.c.a, true), normal: tex(nc, false), orm: tex(this.c.o, false), emi: tex(this.c.e, true) };
  }
}

const GLASS = ['#1e2b37', '#243341', '#1b2630', '#2a3a48'];
function windowPane(P, x, y, w, h, o = {}) {
  // frame
  P.rect(x - 3, y - 3, w + 6, h + 6, { c: o.frame || '#9aa1a7', h: 0.62, r: 0.38, m: 0.85 });
  // recessed glass
  const gc = o.glass || R.pick(GLASS);
  P.rect(x, y, w, h, { c: gc, h: 0.32, r: o.gr ?? 0.07, m: o.gm ?? 0.55 });
  // blinds / curtains seen through glass
  if (R() < (o.blinds ?? 0.35)) {
    const g = P.g.a; g.fillStyle = R() < 0.5 ? 'rgba(220,214,200,0.35)' : 'rgba(170,180,190,0.3)';
    const bh = h * (0.2 + R() * 0.6);
    for (let yy = y; yy < y + bh; yy += 4) g.fillRect(x, yy, w, 2);
  }
  if (o.mullion !== false && w > 30) P.rect(x + w / 2 - 2, y, 4, h, { c: o.frame || '#9aa1a7', h: 0.6, r: 0.4, m: 0.85 });
  P.lit(x, y, w, h, o.lit ?? 0.35);
}

function facadeSet(kind) {
  const S = 512, P = new Painter(S);
  let tw = 12, th = 14;
  if (kind === 'glass' || kind === 'darkglass' || kind === 'bluegl') {
    tw = 12; th = 16;
    const floors = 4, bays = 4, fh = S / floors, bw = S / bays;
    const span = kind === 'darkglass' ? '#2b2f33' : '#3c4650';
    for (let f = 0; f < floors; f++) {
      const y = f * fh;
      P.rect(0, y, S, fh * 0.2, { c: span, h: 0.55, r: 0.3, m: 0.7 });
      for (let b = 0; b < bays; b++) {
        const gc = kind === 'darkglass' ? R.pick(['#1a1d20', '#22262a', '#2b2a26']) : kind === 'bluegl' ? R.pick(['#2a4a66', '#2f5373', '#26425c']) : R.pick(['#2d3d4c', '#33475a', '#2a3846']);
        P.rect(b * bw, y + fh * 0.2, bw, fh * 0.8, { c: gc, h: 0.42, r: 0.05, m: 0.92 });
        P.lit(b * bw + 3, y + fh * 0.22, bw - 6, fh * 0.76, 0.45);
      }
    }
    for (let b = 0; b <= bays * 2; b++) P.rect(b * bw / 2 - (b % 2 ? 2 : 4), 0, b % 2 ? 4 : 8, S, { c: '#a9b2ba', h: 0.75, r: 0.35, m: 0.9 });
    for (let f = 0; f <= floors; f++) P.rect(0, f * fh + fh * 0.2 - 3, S, 5, { c: '#a9b2ba', h: 0.7, r: 0.35, m: 0.9 });
  } else if (kind === 'fins') {
    tw = 10; th = 16;
    const floors = 4, fh = S / floors, n = 8;
    for (let f = 0; f < floors; f++) {
      P.rect(0, f * fh, S, fh * 0.14, { c: '#d9dde1', h: 0.6, r: 0.45, m: 0.3 });
      for (let b = 0; b < n; b++) {
        P.rect(b * S / n, f * fh + fh * 0.14, S / n, fh * 0.86, { c: R.pick(['#2f4152', '#2b3b4a', '#344a5d']), h: 0.35, r: 0.05, m: 0.9 });
        P.lit(b * S / n + 6, f * fh + fh * 0.16, S / n - 12, fh * 0.82, 0.5);
      }
    }
    for (let b = 0; b <= n; b++) { P.rect(b * S / n - 7, 0, 14, S, { c: '#f1f3f5', h: 1, r: 0.4, m: 0.15 }); P.rect(b * S / n + 7, 0, 5, S, { c: '#b9c0c6', h: 0.85, r: 0.5, m: 0.1 }); }
  } else if (kind === 'concrete' || kind === 'white' || kind === 'tile' || kind === 'brownstone') {
    tw = kind === 'tile' ? 8 : 12; th = 14;
    const floors = 4, cols = kind === 'tile' ? 2 : 3, fh = S / floors, cw = S / cols;
    const base = kind === 'concrete' ? R.pick(['#c9c1b2', '#bdb6aa', '#d2cbbd']) : kind === 'white' ? '#e6e4de' : kind === 'brownstone' ? '#8a6f5a' : R.pick(['#a88c74', '#c2ab90', '#8f7a68', '#b5a08a']);
    P.rect(0, 0, S, S, { c: base, h: 0.6, r: 0.88, m: 0 });
    if (kind === 'tile' || kind === 'brownstone') {
      const gr = kind === 'tile' ? 8 : 16;
      for (let y = 0; y < S; y += gr) P.rect(0, y, S, 1.5, { c: 'rgba(0,0,0,0.18)', h: 0.5 });
      for (let y = 0; y < S; y += gr) for (let x = (y / gr) % 2 ? 0 : gr; x < S; x += gr * 2.5) P.rect(x, y, 1.5, gr, { c: 'rgba(0,0,0,0.15)', h: 0.5 });
      for (let i = 0; i < 900; i++) { const x = R() * S, y = Math.floor(R() * S / gr) * gr; P.g.a.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},0.06)`; P.g.a.fillRect(x, y + 1, gr * 2, gr - 2); }
    } else {
      for (let f = 0; f <= floors; f++) P.rect(0, f * fh - 2, S, 3, { c: 'rgba(0,0,0,0.12)', h: 0.52 });
      for (let k = 0; k <= cols * 2; k++) P.rect(k * cw / 2 - 1, 0, 2, S, { c: 'rgba(0,0,0,0.07)', h: 0.55 });
    }
    P.noise(0.07, 6000);
    // rain streaks
    for (let i = 0; i < 40; i++) { const x = R() * S, y = R() * S; const g = P.g.a, gr2 = g.createLinearGradient(x, y, x, y + 60); gr2.addColorStop(0, 'rgba(40,35,30,0.12)'); gr2.addColorStop(1, 'rgba(40,35,30,0)'); g.fillStyle = gr2; g.fillRect(x, y, 3 + R() * 6, 60); }
    for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) {
      const strip = kind === 'white' && R() < 0.5;
      const x = k * cw + cw * (strip ? 0.04 : 0.14), y = f * fh + fh * 0.24, w = cw * (strip ? 0.92 : 0.72), h = fh * 0.5;
      P.rect(x - 4, y + h + 2, w + 8, 5, { c: '#d8d6d0', h: 0.8, r: 0.6 }); // sill
      windowPane(P, x, y, w, h, { frame: kind === 'tile' ? '#6f6a64' : '#a3a8ad', lit: 0.4 });
      if (kind === 'tile' && R() < 0.4) {
        const g = P.g.a, cols2 = ['#e8380d', '#ffd23f', '#1d8fe0', '#ff5aa8', '#ffffff', '#2ab26a'];
        const c = R.pick(cols2); g.fillStyle = c; g.fillRect(x + 4, y + 4, w - 8, h * 0.4);
        g.fillStyle = c === '#ffffff' || c === '#ffd23f' ? '#111' : '#fff'; g.font = `900 ${h * 0.24}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const word = R.pick(['カラオケ', '2F', 'BAR', '居酒屋', '英会話', '歯科', 'ネイル', '整体', 'CAFE', '3F', '麻雀', 'ダーツ']);
        g.fillText(word, x + w / 2, y + 4 + h * 0.2, w - 12);
        const e = P.g.e; e.fillStyle = c; e.globalAlpha = 0.85; e.fillRect(x + 4, y + 4, w - 8, h * 0.4); e.globalAlpha = 1; e.fillStyle = g.fillStyle; e.font = g.font; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillText(word, x + w / 2, y + 4 + h * 0.2, w - 12);
      }
      if (R() < 0.25) P.rect(x + w * 0.62, y + h + 9, w * 0.3, fh * 0.13, { c: '#e9e9e6', h: 0.95, r: 0.5 }); // AC unit
    }
  } else if (kind === 'apartment') {
    tw = 9; th = 12;
    const floors = 4, cols = 3, fh = S / floors, cw = S / cols;
    P.rect(0, 0, S, S, { c: R.pick(['#ddd6c8', '#d4d0c8', '#cfc4b4']), h: 0.6, r: 0.9 });
    P.noise(0.05, 4000);
    for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) {
      const x = k * cw + 6, y = f * fh + 8, w = cw - 12, h = fh * 0.62;
      P.rect(x, y, w, h, { c: '#3d3a36', h: 0.15, r: 0.8 });
      windowPane(P, x + 6, y + 6, w - 12, h - 8, { frame: '#9b9fa3', blinds: 0.7, lit: 0.45 });
      // balcony slab + railing
      P.rect(k * cw, y + h, cw, 6, { c: '#efede8', h: 1, r: 0.8 });
      P.rect(k * cw, y + h + 6, cw, fh * 0.3, { c: R.pick(['#e8e6e1', '#c8ccd0', '#d9d4ca']), h: 0.9, r: 0.7 });
      for (let xx = k * cw; xx < (k + 1) * cw; xx += 10) P.rect(xx, y + h - 26, 2, 26, { c: '#bfc3c6', h: 0.95, r: 0.4, m: 0.7 });
      P.rect(k * cw, y + h - 28, cw, 3, { c: '#bfc3c6', h: 0.95, r: 0.4, m: 0.7 });
      if (R() < 0.3) { const g = P.g.a; for (let i = 0; i < 4; i++) { g.fillStyle = R.pick(['#fff', '#9ec5ff', '#ffc4d8', '#c9e7b5', '#f3e2a9']); g.fillRect(x + 14 + i * 16, y + h - 46, 12, 22); } }
      if (R() < 0.5) P.rect(x + w - 34, y + h - 30, 28, 22, { c: '#f0f0ee', h: 0.85, r: 0.6 });
    }
  } else if (kind === 'mosaic') {
    tw = 12; th = 16;
    P.rect(0, 0, S, S, { c: '#eeede8', h: 0.7, r: 0.6 });
    const n = 16;
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
      if (R() < 0.45) continue;
      const x = k * S / n + 2, y = r * S / n + 2, w = S / n - 4;
      P.rect(x, y, w, w, { c: R.pick(['#3e5262', '#33475a', '#4a5f70']), h: 0.35, r: 0.06, m: 0.85 });
      P.lit(x, y, w, w, 0.4);
    }
  } else if (kind === 'louver') {
    tw = 12; th = 16;
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
      P.rect(k * S / 6, r * S / 4, S / 6, S / 4, { c: R.pick(['#2c3c4a', '#33475a']), h: 0.3, r: 0.06, m: 0.85 });
      P.lit(k * S / 6 + 3, r * S / 4 + 8, S / 6 - 6, S / 4 - 16, 0.45);
    }
    for (let y = 0; y < S; y += S / 16) { P.rect(0, y, S, 11, { c: '#f2f1ec', h: 1, r: 0.5 }); P.rect(0, y + 11, S, 3, { c: '#b8b6b0', h: 0.8 }); }
  } else if (kind === 'silver') {
    tw = 8; th = 12;
    for (let k = 0; k < 8; k++) {
      P.rect(k * S / 8, 0, S / 8, S, { c: k % 2 ? '#c3c8ce' : '#dfe3e7', h: 0.7, r: 0.3, m: 0.9 });
      P.rect(k * S / 8, 0, 3, S, { c: '#8e959c', h: 0.4, r: 0.4, m: 0.8 });
    }
    for (let y = 0; y < S; y += S / 4) P.rect(0, y, S, 3, { c: '#8e959c', h: 0.4 });
  } else if (kind === 'stone') {
    tw = 8; th = 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) P.rect(x * 128 + 1, y * 64 + 1, 126, 62, { c: `hsl(35,${6 + R() * 6}%,${70 + R() * 10}%)`, h: 0.7, r: 0.75 });
    P.noise(0.08, 8000);
  } else if (kind === 'shop') {
    tw = 12; th = 5;
    P.rect(0, 0, S, S, { c: '#2e2e33', h: 0.8, r: 0.5, m: 0.4 });
    const n = 3, w = S / n;
    for (let k = 0; k < n; k++) {
      const x = k * w;
      const gy = 120, gh = S - gy - 14;
      // ceiling/soffit
      P.rect(x + 4, 96, w - 8, 24, { c: '#3a3a3a', h: 0.5, r: 0.7 });
      // shop interior seen through glass
      const warm = R() < 0.6;
      P.grad(x + 10, gy, w - 20, gh, warm ? '#f6e8cf' : '#e9eef3', warm ? '#a8906c' : '#8d99a4');
      P.rect(x + 10, gy, w - 20, gh, { h: 0.25, r: 0.06, m: 0.2 });
      const g = P.g.a;
      for (let s = 0; s < 3; s++) { g.fillStyle = 'rgba(60,45,30,0.5)'; g.fillRect(x + 14, gy + 70 + s * 100, w - 28, 6); }
      for (let s = 0; s < 18; s++) { g.fillStyle = `hsl(${R() * 360},${40 + R() * 45}%,${35 + R() * 40}%)`; g.fillRect(x + 16 + R() * (w - 50), gy + 20 + Math.floor(R() * 3) * 100 + R() * 40, 8 + R() * 24, 14 + R() * 30); }
      for (let s = 0; s < 3; s++) { g.fillStyle = 'rgba(30,25,20,0.55)'; const px = x + 30 + R() * (w - 60); g.fillRect(px, gy + gh - 150, 26, 150); g.beginPath(); g.arc(px + 13, gy + gh - 165, 14, 0, 7); g.fill(); }
      const e = P.g.e; const ge = e.createLinearGradient(0, gy, 0, gy + gh);
      ge.addColorStop(0, warm ? '#fff3dc' : '#f2f7ff'); ge.addColorStop(1, warm ? '#b08a55' : '#7f8da0');
      e.fillStyle = ge; e.fillRect(x + 10, gy, w - 20, gh);
      // door
      P.rect(x + w / 2 - 34, gy + 40, 68, gh - 40, { c: 'rgba(30,40,50,0.35)', h: 0.2, r: 0.05, m: 0.3 });
      P.rect(x + w / 2 - 2, gy + 40, 4, gh - 40, { c: '#8a9096', h: 0.6, r: 0.3, m: 0.9 });
      // pillars
      P.rect(x, 0, 10, S, { c: '#55565b', h: 0.95, r: 0.5, m: 0.3 }); P.rect(x + w - 10, 0, 10, S, { c: '#55565b', h: 0.95, r: 0.5, m: 0.3 });
      // fascia sign band at top of shopfront
      const hue = R() * 360;
      const fc = `hsl(${hue},${50 + R() * 40}%,${30 + R() * 30}%)`;
      P.rect(x + 10, 6, w - 20, 84, { c: fc, h: 0.9, r: 0.35, m: 0.1 });
      const word = R.pick(SHOP_NAMES);
      g.fillStyle = '#fff'; g.font = `800 ${word.length > 5 ? 34 : 46}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(word, x + w / 2, 48, w - 40);
      e.fillStyle = fc; e.fillRect(x + 10, 6, w - 20, 84);
      e.fillStyle = '#fff'; e.font = g.font; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillText(word, x + w / 2, 48, w - 40);
    }
  }
  const t = P.build(kind === 'shop' ? 2 : 3);
  return { ...t, tw, th };
}

export const SHOP_NAMES = ['カフェ', 'らーめん', '古着 USED', 'ドラッグ', 'BOOKS', '寿司', 'GAME', 'BAR', '靴 SHOES', 'コスメ', '牛丼', '居酒屋', 'カラオケ', '焼肉', 'CAFE', '雑貨 ZAKKA', 'FLOWER', 'BAKERY', 'たこ焼', 'クレープ', '100円', 'MUSIC', 'メガネ', 'ESPRESSO', 'うどん', 'そば', 'ピザ', 'SWEETS', 'ジュース', 'PHONE', 'BURGER', 'TEA'];

let SET = null;
export function facades() {
  if (SET) return SET;
  SET = {};
  for (const k of ['glass', 'darkglass', 'bluegl', 'fins', 'concrete', 'white', 'tile', 'brownstone', 'apartment', 'mosaic', 'louver', 'silver', 'stone']) SET[k] = facadeSet(k);
  for (const k of ['shop', 'shop2', 'shop3', 'shop4']) SET[k] = facadeSet('shop');
  return SET;
}

// Ground materials
export function groundSet(kind) {
  const S = 512, P = new Painter(S);
  let size = 4;
  if (kind === 'asphalt') {
    size = 8;
    P.rect(0, 0, S, S, { c: '#47494d', h: 0.5, r: 0.88 });
    for (let i = 0; i < 40000; i++) { const l = 20 + R() * 35; const x = R() * S, y = R() * S, s = 1 + R() * 2; P.g.a.fillStyle = `hsl(220,3%,${l}%)`; P.g.a.fillRect(x, y, s, s); const v = 100 + R() * 80; P.g.h.fillStyle = `rgb(${v},${v},${v})`; P.g.h.fillRect(x, y, s, s); }
    for (let i = 0; i < 18; i++) { const g = P.g.a; g.fillStyle = 'rgba(20,20,22,0.12)'; g.beginPath(); g.ellipse(R() * S, R() * S, 20 + R() * 60, 10 + R() * 30, R() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 6; i++) { const g = P.g.a; g.strokeStyle = 'rgba(15,15,15,0.35)'; g.lineWidth = 1.2; g.beginPath(); let x = R() * S, y = R() * S; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  } else if (kind === 'paving') {
    size = 3;
    P.rect(0, 0, S, S, { c: '#8f8a83', h: 0.3, r: 0.9 });
    const n = 8;
    for (let i = 0; i < n; i++) for (let j = 0; j < n * 2; j++) {
      const off = j % 2 ? S / n / 2 : 0;
      P.rect(i * S / n + off + 1.5, j * S / n / 2 + 1.5, S / n - 3, S / n / 2 - 3, { c: `hsl(${28 + R() * 14},${6 + R() * 8}%,${56 + R() * 14}%)`, h: 0.62, r: 0.8 + R() * 0.15 });
    }
    P.noise(0.08, 9000);
  } else if (kind === 'brick') {
    size = 3;
    P.rect(0, 0, S, S, { c: '#6f625a', h: 0.3, r: 0.9 });
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) P.rect(x * 64 + (y % 2) * 32 + 1.5, y * 32 + 1.5, 61, 29, { c: `hsl(${12 + R() * 18},${14 + R() * 14}%,${40 + R() * 16}%)`, h: 0.65, r: 0.85 });
    P.noise(0.1, 8000);
  } else if (kind === 'granite') {
    size = 3;
    P.rect(0, 0, S, S, { c: '#7e7c78', h: 0.3, r: 0.8 });
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) P.rect(x * 128 + (y % 2) * 64 + 1.5, y * 64 + 1.5, 125, 61, { c: `hsl(${30 + R() * 20},${3 + R() * 5}%,${54 + R() * 14}%)`, h: 0.6, r: 0.72 + R() * 0.2 });
    P.noise(0.14, 22000, 0, 0, S, S, 1.5);
  } else if (kind === 'concrete') {
    size = 6;
    P.rect(0, 0, S, S, { c: '#a9a6a0', h: 0.5, r: 0.85 });
    for (let i = 0; i <= S; i += 128) { P.rect(i - 1, 0, 2, S, { c: 'rgba(0,0,0,0.2)', h: 0.35 }); P.rect(0, i - 1, S, 2, { c: 'rgba(0,0,0,0.2)', h: 0.35 }); }
    P.noise(0.1, 12000);
  } else if (kind === 'platform') {
    size = 4;
    P.rect(0, 0, S, S, { c: '#9c9993', h: 0.5, r: 0.65 });
    for (let i = 0; i <= S; i += 64) { P.rect(i - 1, 0, 2, S, { c: 'rgba(0,0,0,0.15)', h: 0.4 }); P.rect(0, i - 1, S, 2, { c: 'rgba(0,0,0,0.15)', h: 0.4 }); }
    P.noise(0.08, 9000);
  } else if (kind === 'ballast') {
    size = 4;
    P.rect(0, 0, S, S, { c: '#5f5a55', h: 0.4, r: 0.95 });
    for (let i = 0; i < 26000; i++) { const l = 22 + R() * 45, x = R() * S, y = R() * S, s = 2 + R() * 4; P.g.a.fillStyle = `hsl(30,6%,${l}%)`; P.g.a.fillRect(x, y, s, s); const v = 60 + R() * 190; P.g.h.fillStyle = `rgb(${v},${v},${v})`; P.g.h.fillRect(x, y, s, s); }
  } else if (kind === 'grass') {
    size = 5;
    P.rect(0, 0, S, S, { c: '#4f7d3a', h: 0.5, r: 0.95 });
    for (let i = 0; i < 30000; i++) { const x = R() * S, y = R() * S; P.g.a.fillStyle = `hsl(${80 + R() * 35},${35 + R() * 25}%,${22 + R() * 25}%)`; P.g.a.fillRect(x, y, 1, 3); const v = 90 + R() * 120; P.g.h.fillStyle = `rgb(${v},${v},${v})`; P.g.h.fillRect(x, y, 1, 3); }
  } else if (kind === 'deck') {
    size = 4;
    for (let y = 0; y < S; y += 32) P.rect(0, y + 1, S, 30, { c: `hsl(28,${28 + R() * 12}%,${30 + R() * 12}%)`, h: 0.6, r: 0.7 });
    P.noise(0.1, 6000);
  } else if (kind === 'roof') {
    size = 10;
    P.rect(0, 0, S, S, { c: '#8a8c8e', h: 0.5, r: 0.9 });
    P.noise(0.18, 16000);
    for (let i = 0; i < S; i += 128) P.rect(i, 0, 2, S, { c: 'rgba(0,0,0,0.12)', h: 0.4 });
    for (let i = 0; i < 12; i++) { const g = P.g.a; g.fillStyle = 'rgba(30,30,30,0.1)'; g.beginPath(); g.ellipse(R() * S, R() * S, 30 + R() * 50, 20 + R() * 40, 0, 0, 7); g.fill(); }
  } else if (kind === 'water') {
    size = 10;
    P.grad(0, 0, S, S, '#355c61', '#2b4c50');
    for (let i = 0; i < 300; i++) { const v = 100 + R() * 60; P.g.h.fillStyle = `rgb(${v},${v},${v})`; P.g.h.beginPath(); P.g.h.ellipse(R() * S, R() * S, 10 + R() * 30, 3 + R() * 6, 0, 0, 7); P.g.h.fill(); }
    P.rect(0, 0, S, S, { r: 0.08, m: 0.1 });
  }
  const t = P.build(kind === 'asphalt' || kind === 'ballast' ? 1.5 : 2.5);
  for (const k of ['map', 'normal', 'orm']) t[k].userData.size = size;
  t.size = size;
  return t;
}

// Shop sign atlas: 4 x 16 horizontal signs (4:1)
export function signAtlas() {
  const W = 1024, H = 1024, cols = 4, rows = 16, cw = W / cols, ch = H / rows;
  const c = canvas(W, H), g = c.getContext('2d');
  const words = ['カラオケ 24H', 'らーめん 一番', '焼肉 炎', 'CAFE & BAR', '居酒屋 渋谷', 'ドラッグストア', '寿司 まわる', 'ゲームセンター', '古着 VINTAGE', 'メガネ 眼鏡', '牛丼', 'BURGER', 'コスメ COSME', '英会話 英語', '歯科クリニック', 'ネイルサロン', '漫画喫茶', 'たこ焼', 'クレープ', '100円ショップ', 'SHOES 靴', 'MUSIC 楽器', 'BOOKS 本', 'うどん そば', '天丼', '串カツ', 'PIZZA', 'DONUT', 'ESPRESSO', 'カレー', '中華料理', '餃子', 'BAR 2F', 'CLUB B1', 'ダーツ', 'ビリヤード', '美容室', '整骨院', '不動産', 'LIVE HOUSE', 'TOKYO STORE', 'SPORTS', 'ゲーム', 'パチンコ', 'ホテル', 'ATM', '薬', 'フィットネス', 'TEA', 'ジュース', 'ベーカリー', '花 FLOWER', '雑貨', 'PHOTO', 'PHONE', 'SALE', '新宿線', 'HAIR', 'SPA', 'NAIL', '定食', 'そば処', 'BEER', 'WINE'];
  for (let i = 0; i < cols * rows; i++) {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    const style = i % 5, hue = (i * 53) % 360;
    const bg = style === 0 ? '#fafafa' : style === 1 ? '#111' : `hsl(${hue},${60 + (i % 3) * 12}%,${34 + (i % 4) * 8}%)`;
    const fg = style === 0 ? `hsl(${hue},75%,38%)` : style === 1 ? `hsl(${hue},90%,62%)` : '#fff';
    g.fillStyle = bg; g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
    if (style === 2) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 2, y + 2, cw - 4, ch * 0.35); }
    g.fillStyle = fg; g.font = `900 ${ch * 0.56}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(words[i % words.length], x + cw / 2, y + ch / 2 + 1, cw - 18);
  }
  const map = tex(c, true, false);
  return { map, cols, rows };
}

// Leaf cluster texture (alpha) for tree foliage cards
export function leafTex() {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 420; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * S * 0.44;
    const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
    const l = 48 + R() * 46;
    g.fillStyle = `hsl(${70 + R() * 30},${8 + R() * 14}%,${l}%)`;
    g.save(); g.translate(x, y); g.rotate(R() * 6.28);
    g.beginPath(); g.ellipse(0, 0, 7 + R() * 5, 3 + R() * 2.5, 0, 0, 7); g.fill();
    g.restore();
  }
  g.strokeStyle = 'rgba(70,50,35,0.8)'; g.lineWidth = 2;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + (R() - 0.5) * S * 0.8, S / 2 + (R() - 0.5) * S * 0.8); g.stroke(); }
  const t = tex(c, true, false);
  return t;
}

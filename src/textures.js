import * as THREE from 'three';
import { rng } from './util.js';

export const JP = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif';
export const DOT = '"DotGothic16","Noto Sans JP",monospace';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
export function toTex(c, repeat = true, aniso = 4) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}
const R = rng(42);
function noise(g, w, h, amt, n = 4000, dark = true) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${dark ? '0,0,0' : '255,255,255'},${R() * amt})`;
    g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
  }
}
const LIT = ['#ffe9c2', '#fff4dc', '#e9f1ff', '#dff0ff', '#fff0c8', '#ffd9a0'];

// Each facade: { map, emi, tw, th } – tw/th = metres covered by one texture tile.
function facade(kind) {
  const S = 512;
  const c = canvas(S, S), e = canvas(S, S);
  const g = c.getContext('2d'), ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  let tw = 12, th = 16;
  const lit = (x, y, w, h, p = 0.55) => {
    if (R() < p * 0.72) {
      ge.fillStyle = R() < 0.2 ? '#3a3a3a' : R.pick(LIT);
      ge.globalAlpha = 0.35 + R() * 0.5;
      ge.fillRect(x, y, w, h);
      ge.globalAlpha = 1;
    }
  };
  if (kind === 'glass' || kind === 'fins' || kind === 'darkglass') {
    const rows = 4, cols = kind === 'fins' ? 8 : 4;
    tw = kind === 'fins' ? 10 : 12; th = 16;
    const fh = S / rows, cw = S / cols;
    const top = kind === 'darkglass' ? '#4d5b6b' : '#8fb2cc', bot = kind === 'darkglass' ? '#1f2a36' : '#3d5a73';
    g.fillStyle = kind === 'fins' ? '#d9dee3' : '#5c6773'; g.fillRect(0, 0, S, S);
    for (let r = 0; r < rows; r++) {
      const y = r * fh;
      const gr = g.createLinearGradient(0, y, 0, y + fh);
      gr.addColorStop(0, top); gr.addColorStop(1, bot);
      g.fillStyle = gr;
      g.fillRect(0, y + fh * 0.16, S, fh * 0.84);
      for (let k = 0; k < cols; k++) lit(k * cw + 2, y + fh * 0.18, cw - 4, fh * 0.78, kind === 'fins' ? 0.62 : 0.5);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(0, y + fh * 0.16, S, 3);
    }
    for (let k = 0; k <= cols; k++) {
      g.fillStyle = kind === 'fins' ? '#eef1f4' : '#a7b1bb';
      const fw = kind === 'fins' ? 10 : 5;
      g.fillRect(k * cw - fw / 2, 0, fw, S);
      if (kind === 'fins') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(k * cw + fw / 2, 0, 4, S); }
    }
    // a few reflections
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 6; i++) { g.beginPath(); const x = R() * S; g.moveTo(x, 0); g.lineTo(x + 60, 0); g.lineTo(x - 80, S); g.lineTo(x - 140, S); g.fill(); }
  } else if (kind === 'concrete' || kind === 'white' || kind === 'tile') {
    const rows = 4, cols = kind === 'tile' ? 2 : 3;
    tw = kind === 'tile' ? 8 : 12; th = 14;
    const base = kind === 'concrete' ? '#cfc6b6' : kind === 'white' ? '#e7e6e1' : R.pick(['#b39a82', '#c9b49a', '#9c8676']);
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    if (kind === 'tile') {
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
      for (let y = 0; y < S; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
      for (let y = 0; y < S; y += 8) for (let x = (y / 8) % 2 ? 0 : 12; x < S; x += 24) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); }
    }
    noise(g, S, S, 0.08, 5000);
    const fh = S / rows, cw = S / cols;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const x = k * cw + cw * 0.12, y = r * fh + fh * 0.22, w = cw * 0.76, h = fh * 0.55;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 3, y - 3, w + 6, h + 8);
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, '#7f98ab'); gr.addColorStop(1, '#2f3f4e');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = '#8d949a'; g.fillRect(x + w / 2 - 2, y, 4, h);
      if (kind === 'tile' && R() < 0.35) {
        g.fillStyle = R.pick(['#e83a3a', '#ffd23f', '#3fa7ff', '#ffffff', '#ff7ac8']);
        g.fillRect(x + 6, y + 6, w * 0.4, h * 0.35);
        ge.fillStyle = g.fillStyle; ge.fillRect(x + 6, y + 6, w * 0.4, h * 0.35);
      }
      lit(x, y, w, h, 0.45);
      if (R() < 0.3) { g.fillStyle = '#d8d8d4'; g.fillRect(x + w * 0.65, y + h + 4, w * 0.3, fh * 0.12); }
    }
  } else if (kind === 'apartment') {
    const rows = 4, cols = 3; tw = 9; th = 12;
    g.fillStyle = '#d9d2c4'; g.fillRect(0, 0, S, S); noise(g, S, S, 0.06);
    const fh = S / rows, cw = S / cols;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const x = k * cw + 8, y = r * fh + 10, w = cw - 16, h = fh * 0.62;
      g.fillStyle = '#3c4b58'; g.fillRect(x, y, w, h);
      lit(x, y, w, h, 0.5);
      g.fillStyle = '#ebe8e2'; g.fillRect(x - 8, y + h, w + 16, fh * 0.3);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x - 8, y + h, w + 16, 3);
      if (R() < 0.25) { g.fillStyle = R.pick(['#fff', '#9ec5ff', '#ffc4d8']); g.fillRect(x + 10 + R() * 40, y + h - 30, 22, 26); }
    }
  } else if (kind === 'mosaic') {
    tw = 12; th = 16;
    g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, S, S);
    const n = 16;
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
      if (R() < 0.5) continue;
      const x = k * S / n, y = r * S / n;
      g.fillStyle = R() < 0.5 ? '#6f8597' : '#4b5f70'; g.fillRect(x + 2, y + 2, S / n - 4, S / n - 4);
      lit(x + 2, y + 2, S / n - 4, S / n - 4, 0.5);
    }
  } else if (kind === 'louver') {
    tw = 12; th = 16;
    g.fillStyle = '#4c6274'; g.fillRect(0, 0, S, S);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) lit(k * S / 6 + 2, r * S / 4 + 10, S / 6 - 4, S / 4 - 30, 0.5);
    for (let y = 0; y < S; y += S / 16) { g.fillStyle = '#f4f3ef'; g.fillRect(0, y, S, 10); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, y + 10, S, 3); }
  } else if (kind === 'silver') {
    tw = 8; th = 12;
    const gr = g.createLinearGradient(0, 0, S, 0);
    for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, i % 2 ? '#c8ccd2' : '#e9ecef');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    for (let x = 0; x < S; x += S / 8) g.fillRect(x, 0, 2, S);
    for (let y = 0; y < S; y += S / 4) g.fillRect(0, y, S, 2);
  } else if (kind === 'shop') {
    tw = 12; th = 5;
    g.fillStyle = '#3b3b40'; g.fillRect(0, 0, S, S);
    const n = 3, w = S / n;
    for (let k = 0; k < n; k++) {
      const x = k * w;
      const hue = R() * 360;
      const fascia = `hsl(${hue},${50 + R() * 40}%,${35 + R() * 25}%)`;
      // fascia sign band
      g.fillStyle = fascia; g.fillRect(x + 4, 18, w - 8, 90);
      ge.fillStyle = fascia; ge.globalAlpha = 0.9; ge.fillRect(x + 4, 18, w - 8, 90); ge.globalAlpha = 1;
      g.fillStyle = '#fff'; g.font = `700 52px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const word = R.pick(SHOP_WORDS);
      g.fillText(word, x + w / 2, 64, w - 30);
      ge.fillStyle = '#fff'; ge.font = g.font; ge.textAlign = 'center'; ge.textBaseline = 'middle'; ge.fillText(word, x + w / 2, 64, w - 30);
      // window with bright interior
      const gy = 130, gh = S - gy - 20;
      const ig = g.createLinearGradient(0, gy, 0, gy + gh);
      const warm = R();
      ig.addColorStop(0, warm < 0.5 ? '#f3e6cc' : '#e4ecf2'); ig.addColorStop(1, warm < 0.5 ? '#b49d7a' : '#9aa6b0');
      g.fillStyle = ig; g.fillRect(x + 10, gy, w - 20, gh);
      ge.fillStyle = '#ffeccc'; ge.fillRect(x + 10, gy, w - 20, gh);
      for (let s = 0; s < 3; s++) { g.fillStyle = 'rgba(60,45,30,0.55)'; g.fillRect(x + 14, gy + 60 + s * 100, w - 28, 8); }
      for (let s = 0; s < 14; s++) {
        g.fillStyle = `hsl(${R() * 360},${40 + R() * 40}%,${35 + R() * 35}%)`;
        g.fillRect(x + 16 + R() * (w - 50), gy + 20 + Math.floor(R() * 3) * 100 + R() * 30, 10 + R() * 26, 16 + R() * 22);
      }
      if (R() < 0.6) { g.fillStyle = `hsl(${hue},55%,40%)`; g.beginPath(); g.moveTo(x + 6, 112); g.lineTo(x + w - 6, 112); g.lineTo(x + w - 18, 150); g.lineTo(x + 18, 150); g.fill(); for (let k2 = 0; k2 < 6; k2++) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 12 + k2 * (w - 24) / 6, 112, (w - 24) / 12, 38); } }
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 10, gy, 6, gh);
      g.fillStyle = '#26262a'; g.fillRect(x + w / 2 - 3, gy, 6, gh);
    }
  }
  const map = toTex(c), emi = toTex(e);
  return { map, emi, tw, th };
}

export const SHOP_WORDS = ['カフェ', 'ラーメン', '古着', 'ドラッグ', 'BOOKS', '寿司', 'GAME', 'BAR', '靴', 'コスメ', '牛丼', '居酒屋', 'カラオケ', '焼肉', 'SHOES', 'CAFE', '雑貨', '花屋', 'パン', 'たこ焼き', 'クレープ', '100円', 'MUSIC', '眼鏡'];
export const VSIGNS = ['カラオケ', '居酒屋', 'ラーメン', '焼肉', '漫画喫茶', 'ゲームセンター', '古着屋', 'BAR', 'ホテル', '歯科', '美容室', '寿司', '中華', 'ドラッグ', '整骨院', 'カフェ', 'クラブ', 'ダーツ', '英会話', '質屋', 'ネイル', '麻雀', 'そば', '天ぷら'];

let FAC = null;
export function facades() {
  if (FAC) return FAC;
  FAC = {};
  for (const k of ['glass', 'darkglass', 'fins', 'concrete', 'white', 'tile', 'apartment', 'mosaic', 'louver', 'silver']) FAC[k] = facade(k);
  for (const k of ['shop', 'shop2', 'shop3', 'shop4']) FAC[k] = facade('shop');
  return FAC;
}

export function groundTex(kind) {
  const S = 512, c = canvas(S, S), g = c.getContext('2d');
  let size = 8;
  if (kind === 'asphalt') {
    g.fillStyle = '#4a4c50'; g.fillRect(0, 0, S, S); noise(g, S, S, 0.25, 30000); noise(g, S, S, 0.08, 8000, false);
    size = 8;
  } else if (kind === 'paving') {
    g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, S, S);
    const n = 8;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const l = 64 + R() * 14;
      g.fillStyle = `hsl(${30 + R() * 10},${8 + R() * 8}%,${l}%)`;
      g.fillRect(i * S / n + 1, j * S / n + 1, S / n - 2, S / n - 2);
    }
    noise(g, S, S, 0.08, 6000); size = 4;
  } else if (kind === 'brick') {
    g.fillStyle = '#8f8076'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = `hsl(${14 + R() * 16},${12 + R() * 12}%,${46 + R() * 14}%)`;
      g.fillRect(x * 64 + (y % 2) * 32 + 1, y * 32 + 1, 62, 30);
    }
    noise(g, S, S, 0.1, 5000); size = 3;
  } else if (kind === 'granite') {
    g.fillStyle = '#9d9b97'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
      const l = 58 + R() * 12;
      g.fillStyle = `hsl(${30 + R() * 20},${4 + R() * 5}%,${l}%)`;
      g.fillRect(x * 128 + (y % 2) * 64 + 1, y * 64 + 1, 126, 62);
    }
    noise(g, S, S, 0.12, 14000); noise(g, S, S, 0.08, 6000, false); size = 3;
  } else if (kind === 'grass') {
    g.fillStyle = '#5f8f46'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 20000; i++) { g.fillStyle = `hsl(${85 + R() * 30},${35 + R() * 25}%,${25 + R() * 25}%)`; g.fillRect(R() * S, R() * S, 1, 3); }
    size = 6;
  } else if (kind === 'ballast') {
    g.fillStyle = '#6d6862'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 25000; i++) { const l = 25 + R() * 45; g.fillStyle = `hsl(30,6%,${l}%)`; g.fillRect(R() * S, R() * S, 2 + R() * 3, 2 + R() * 3); }
    size = 4;
  } else if (kind === 'platform') {
    g.fillStyle = '#a9a6a0'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i <= S; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
    noise(g, S, S, 0.08, 6000); size = 4;
  } else if (kind === 'deck') {
    g.fillStyle = '#8a6a4c'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 32) { g.fillStyle = `hsl(28,${30 + R() * 10}%,${32 + R() * 10}%)`; g.fillRect(0, y + 1, S, 30); }
    size = 4;
  } else if (kind === 'roof') {
    g.fillStyle = '#8d8f91'; g.fillRect(0, 0, S, S); noise(g, S, S, 0.15, 12000);
    g.strokeStyle = 'rgba(0,0,0,0.1)'; for (let i = 0; i < S; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); }
    size = 10;
  } else if (kind === 'water') {
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, '#3e6a6f'); gr.addColorStop(1, '#2d5357');
    g.fillStyle = gr; g.fillRect(0, 0, S, S); noise(g, S, S, 0.12, 4000, false); size = 10;
  }
  const t = toTex(c, true, 8);
  t.userData.size = size;
  return t;
}

// Horizontal / vertical text sign
export function signTex(text, o = {}) {
  const w = o.w || 512, h = o.h || 128;
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = o.bg || '#111'; g.fillRect(0, 0, w, h);
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = Math.max(4, h * 0.05); g.strokeRect(2, 2, w - 4, h - 4); }
  g.fillStyle = o.fg || '#fff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = Array.isArray(text) ? text : [text];
  if (o.vertical) {
    const chars = [...lines[0]];
    const fs = Math.min(w * 0.78, (h * 0.92) / chars.length);
    g.font = `${o.weight || 900} ${fs}px ${o.font || JP}`;
    chars.forEach((ch, i) => g.fillText(ch, w / 2, h * 0.04 + fs * (i + 0.5) * (0.92 * h / (fs * chars.length))));
  } else {
    lines.forEach((ln, i) => {
      const fs = (o.size || 0.62) * h / lines.length * (i === 0 ? 1 : 0.62) * (lines.length > 1 ? 1.25 : 1);
      g.font = `${o.weight || 800} ${fs}px ${o.font || JP}`;
      const y = lines.length === 1 ? h / 2 : h * (i === 0 ? 0.38 : 0.78);
      g.fillText(ln, w / 2, y, w * 0.92);
    });
  }
  const t = toTex(c, false);
  return t;
}

// Animated advertising screen
export class Screen {
  constructor(seed, w = 256, h = 144) {
    this.c = canvas(w, h); this.g = this.c.getContext('2d');
    this.tex = toTex(this.c, false);
    this.r = rng(seed); this.seed = seed;
    this.w = w; this.h = h;
    this.hue = this.r() * 360;
    this.slides = [0, 1, 2, 3, 4].sort(() => this.r() - 0.5);
    this.last = -1;
  }
  draw(t, clockText) {
    const { g, w, h } = this;
    const slideLen = 7;
    const k = Math.floor((t + this.seed * 3.1) / slideLen);
    const f = ((t + this.seed * 3.1) % slideLen) / slideLen;
    const mode = this.slides[k % this.slides.length];
    const hue = (this.hue + k * 67) % 360;
    if (mode === 0) {
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, `hsl(${hue},90%,55%)`); gr.addColorStop(1, `hsl(${(hue + 80) % 360},90%,45%)`);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = `hsla(${(hue + i * 40) % 360},100%,80%,0.5)`;
        g.beginPath(); g.arc((i * 53 + f * 300) % (w + 60) - 30, h / 2 + Math.sin(t * 2 + i) * h * 0.3, 18 + i * 3, 0, 7); g.fill();
      }
      g.fillStyle = '#fff'; g.font = `900 ${h * 0.28}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(['SHIBUYA', '渋谷', 'TOKYO', 'NEW', '新発売'][k % 5], w / 2, h / 2);
    } else if (mode === 1) {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.fillStyle = `hsl(${hue},100%,60%)`; g.font = `900 ${h * 0.5}px ${JP}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      const txt = '渋谷スクランブル ✦ SHIBUYA SCRAMBLE ✦ ';
      const tw = g.measureText(txt).width;
      const x = -((t * 120) % tw);
      g.fillText(txt + txt, x, h / 2);
    } else if (mode === 2) {
      g.fillStyle = `hsl(${hue},40%,12%)`; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.font = `700 ${h * 0.34}px ${DOT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(clockText || '', w / 2, h * 0.45);
      g.font = `500 ${h * 0.12}px ${JP}`; g.fillText('TOKYO  JST', w / 2, h * 0.78);
    } else if (mode === 3) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
      const s = 0.6 + 0.4 * Math.sin(f * Math.PI);
      g.fillStyle = `hsl(${hue},80%,50%)`;
      g.beginPath(); g.arc(w * 0.3, h / 2, h * 0.35 * s, 0, 7); g.fill();
      g.fillStyle = '#111'; g.font = `800 ${h * 0.2}px ${JP}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('NEW SEASON', w * 0.52, h * 0.42); g.font = `500 ${h * 0.12}px ${JP}`; g.fillText('秋の新作 登場', w * 0.52, h * 0.64);
    } else {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = `hsl(${(hue + i * 25 + t * 40) % 360},85%,${45 + (i % 2) * 15}%)`;
        g.fillRect(i * w / 8, 0, w / 8 + 1, h);
      }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h * 0.35, w, h * 0.3);
      g.fillStyle = '#fff'; g.font = `900 ${h * 0.22}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('MUSIC  LIVE', w / 2, h / 2);
    }
    this.tex.needsUpdate = true;
  }
}

// Vertical sign atlas (8 x 3 slots)
export function vsignAtlas() {
  const cw = 64, ch = 256, cols = 8, rows = 3;
  const c = canvas(cw * cols, ch * rows), g = c.getContext('2d');
  const e = canvas(cw * cols, ch * rows), ge = e.getContext('2d');
  VSIGNS.forEach((txt, i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    const hue = (i * 47) % 360;
    const bg = i % 3 === 0 ? '#fff' : `hsl(${hue},80%,45%)`;
    const fg = i % 3 === 0 ? `hsl(${hue},80%,40%)` : '#fff';
    g.fillStyle = bg; g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
    const chars = [...txt];
    const fs = Math.min(46, (ch - 20) / chars.length);
    g.fillStyle = fg; g.font = `900 ${fs}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    chars.forEach((ch2, k) => g.fillText(ch2, x + cw / 2, y + 12 + fs * (k + 0.5) * ((ch - 24) / (fs * chars.length))));
    ge.drawImage(c, x, y, cw, ch, x, y, cw, ch);
  });
  return { map: toTex(c, false), emi: toTex(e, false), cols, rows, n: VSIGNS.length };
}

// Train livery textures
export function trainTex(type) {
  const c = canvas(1024, 128), g = c.getContext('2d');
  const o = canvas(1024, 128), go = o.getContext('2d');
  const yama = type === 'yamanote';
  const len = yama ? 20 : 16;
  const doors = yama ? [0.12, 0.37, 0.63, 0.88] : [0.16, 0.5, 0.84];
  for (const [ctx, open] of [[g, false], [go, true]]) {
    if (yama) {
      const gr = ctx.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, '#e4e8ec'); gr.addColorStop(0.5, '#c5cbd1'); gr.addColorStop(1, '#a9b0b7');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 1024, 128);
      ctx.fillStyle = 'rgba(0,0,0,0.05)'; for (let x = 0; x < 1024; x += 6) ctx.fillRect(x, 0, 1, 128);
      ctx.fillStyle = '#80c241'; ctx.fillRect(0, 6, 1024, 7);
    } else {
      ctx.fillStyle = '#ffd200'; ctx.fillRect(0, 0, 1024, 128);
      ctx.fillStyle = '#f39700'; ctx.fillRect(0, 98, 1024, 6);
      ctx.fillStyle = '#111'; ctx.fillRect(0, 106, 1024, 3);
    }
    // windows
    for (let i = 0; i < doors.length - 1; i++) {
      const a = doors[i] * 1024 + 40, b = doors[i + 1] * 1024 - 40;
      ctx.fillStyle = yama ? '#1d2630' : '#1c232b'; ctx.fillRect(a, 24, b - a, 44);
      ctx.fillStyle = 'rgba(160,200,230,0.25)'; ctx.fillRect(a, 24, b - a, 12);
      ctx.fillStyle = '#9aa3ab'; ctx.fillRect((a + b) / 2 - 2, 24, 4, 44);
    }
    ctx.fillStyle = yama ? '#1d2630' : '#1c232b';
    ctx.fillRect(4, 24, doors[0] * 1024 - 46, 44);
    ctx.fillRect(doors[doors.length - 1] * 1024 + 42, 24, 1024 - doors[doors.length - 1] * 1024 - 46, 44);
    for (const d of doors) {
      const x = d * 1024 - 32;
      if (open) {
        ctx.fillStyle = '#3a3226'; ctx.fillRect(x, 16, 64, 112);
        ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x + 6, 20, 52, 70);
      } else {
        ctx.fillStyle = yama ? '#6db33f' : '#e8c300'; ctx.fillRect(x, 16, 64, 112);
        ctx.fillStyle = '#26323c'; ctx.fillRect(x + 6, 24, 24, 40); ctx.fillRect(x + 34, 24, 24, 40);
        ctx.fillStyle = '#333'; ctx.fillRect(x + 31, 16, 2, 112);
      }
    }
  }
  const front = canvas(256, 256), gf = front.getContext('2d');
  if (yama) {
    gf.fillStyle = '#c9ced3'; gf.fillRect(0, 0, 256, 256);
    gf.fillStyle = '#80c241'; gf.fillRect(0, 0, 256, 26);
    gf.fillStyle = '#0d0f12'; gf.fillRect(14, 30, 228, 150);
    gf.fillStyle = '#18222c'; gf.fillRect(24, 60, 208, 90);
    gf.fillStyle = '#ff9a2a'; gf.font = `700 26px ${JP}`; gf.textAlign = 'center'; gf.fillText('山手線', 128, 52);
    gf.fillStyle = '#fff'; gf.fillRect(30, 196, 40, 14); gf.fillRect(186, 196, 40, 14);
    gf.fillStyle = '#80c241'; gf.fillRect(0, 222, 256, 10);
  } else {
    gf.fillStyle = '#ffd200'; gf.fillRect(0, 0, 256, 256);
    gf.fillStyle = '#111'; gf.beginPath(); gf.roundRect(26, 30, 204, 120, 24); gf.fill();
    gf.fillStyle = '#ff9a2a'; gf.font = `700 24px ${JP}`; gf.textAlign = 'center'; gf.fillText('浅草', 128, 60);
    gf.fillStyle = '#fff'; gf.beginPath(); gf.arc(56, 190, 14, 0, 7); gf.arc(200, 190, 14, 0, 7); gf.fill();
    gf.fillStyle = '#f39700'; gf.fillRect(0, 220, 256, 12);
  }
  return { side: toTex(c, false), open: toTex(o, false), front: toTex(front, false), len };
}

// LED departure board texture
export class Board {
  constructor(w = 512, h = 128) {
    this.c = canvas(w, h); this.g = this.c.getContext('2d');
    this.tex = toTex(this.c, false);
    this.w = w; this.h = h;
  }
  draw(rows, en, title) {
    const { g, w, h } = this;
    g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);
    const rh = (title ? h - 26 : h) / Math.max(rows.length, 1);
    let y0 = 0;
    if (title) {
      g.fillStyle = title.color || '#80c241'; g.fillRect(0, 0, w, 24);
      g.fillStyle = '#fff'; g.font = `700 18px ${JP}`; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillText(en ? title.en : title.jp, 8, 12);
      y0 = 26;
    }
    rows.forEach((r, i) => {
      const y = y0 + rh * i + rh / 2;
      g.textBaseline = 'middle'; g.font = `${Math.floor(rh * 0.62)}px ${DOT}`;
      g.textAlign = 'left';
      g.fillStyle = r.kindColor || '#4dff6a'; g.fillText(en ? 'Local' : '普通', 10, y);
      g.fillStyle = '#ffb02e'; g.fillText(r.time, w * 0.2, y);
      g.fillStyle = '#ffb02e'; g.fillText(en ? r.destEn : r.dest, w * 0.38, y, w * 0.5);
      if (r.note) { g.fillStyle = '#ff5050'; g.textAlign = 'right'; g.fillText(r.note, w - 8, y); }
    });
    if (!rows.length) {
      g.fillStyle = '#ffb02e'; g.font = `${h * 0.3}px ${DOT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(en ? 'Service has ended' : '本日の運転は終了しました', w / 2, (y0 + h) / 2);
    }
    this.tex.needsUpdate = true;
  }
}

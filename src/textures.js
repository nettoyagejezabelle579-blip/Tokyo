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

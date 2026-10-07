// Shibuya layout in metres. Origin = centre of the Scramble Crossing. x = east, z = south (north = -z).
import { obb } from './util.js';

export const aab = (x0, z0, x1, z1) => obb((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0);
export function seg(x0, z0, x1, z1, w) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
  const o = obb((x0 + x1) / 2, (z0 + z1) / 2, L / 2, w / 2, Math.atan2(-dz, dx));
  o.a = [x0, z0]; o.b = [x1, z1];
  return o;
}

export const JR = { x0: 97, x1: 123, outX: 102.4, inX: 117.6, rail: 7.15, plat: 8.25, platX0: 104, platX1: 116, platZ0: -110, platZ1: 115 };
export const GZ = { rail: 11.15, plat: 12.25, platX0: 194, platX1: 206, platZ0: -128, platZ1: -22, wX: 192.5, eX: 207.5 };

// Roads: kind, obb, lanes info used by traffic.
export const ROADS = [
  { id: 'X', o: aab(-14, -14, 14, 14) },
  { id: 'N', o: aab(-10, -440, 10, -14) },
  { id: 'S', o: aab(-10, 14, 10, 198) },
  { id: 'E', o: aab(14, -9, 450, 9) },
  { id: 'W', o: aab(-162, -6, -14, 10) },
  { id: 'MJ', o: aab(190, -470, 210, 580) },
  { id: 'R246', o: aab(-470, 198, 470, 226) },
  { id: 'DOG', o: seg(-162, 4, -430, 92, 13) },
  { id: 'BUN', o: seg(-162, -2, -430, -96, 12) },
  { id: 'KOEN', o: seg(-6, -190, -190, -470, 13) },
  { id: 'INO', o: aab(-320, -96, -10, -86) },
  { id: 'SPAIN', o: seg(-120, -91, -150, -200, 6) },
  { id: 'UDA', o: seg(-70, -91, -110, -300, 7) },
  { id: 'MEIJI2', o: aab(-470, 320, 470, 330) },
  { id: 'SAKURA', o: seg(10, 226, -60, 420, 8) },
  { id: 'EAST2', o: aab(210, 60, 450, 70) },
  { id: 'NORTH2', o: aab(-470, -330, -200, -322) },
  { id: 'AOYAMA', o: aab(282, -60, 450, -50) },
  { id: 'SOUTH3', o: aab(290, 226, 300, 580) },
  { id: 'WEST3', o: aab(-260, 100, -250, 470) },
  { id: 'EBISU', o: aab(130, 226, 140, 580) },
];
export const CENTER_GAI = seg(-14, -25, -232, -40, 9);
export const HACHIKO = aab(10, 9, 80, 88);
export const SIDEWALK = 4;

// Scramble signal cycle (seconds), synchronised to real time.
export const CYCLE = 120;
export function scramblePhase(sec) {
  const t = ((sec % CYCLE) + CYCLE) % CYCLE;
  if (t < 34) return { ped: 'go', ns: 'r', ew: 'r', t, left: 34 - t };
  if (t < 42) return { ped: 'blink', ns: 'r', ew: 'r', t, left: 42 - t };
  if (t < 45) return { ped: 'stop', ns: 'r', ew: 'r', t, left: CYCLE - t };
  if (t < 78) return { ped: 'stop', ns: 'g', ew: 'r', t, left: CYCLE - t };
  if (t < 81) return { ped: 'stop', ns: 'y', ew: 'r', t, left: CYCLE - t };
  if (t < 83) return { ped: 'stop', ns: 'r', ew: 'r', t, left: CYCLE - t };
  if (t < 114) return { ped: 'stop', ns: 'r', ew: 'g', t, left: CYCLE - t };
  if (t < 117) return { ped: 'stop', ns: 'r', ew: 'y', t, left: CYCLE - t };
  return { ped: 'stop', ns: 'r', ew: 'r', t, left: CYCLE - t };
}
// Simple two-phase signals for the other intersections
export function twoPhase(sec, cycle, offset) {
  const t = (((sec + offset) % cycle) + cycle) % cycle, h = cycle / 2;
  const a = t < h - 5 ? 'g' : t < h - 2 ? 'y' : t < h ? 'r' : 'r';
  const b = t >= h && t < cycle - 5 ? 'g' : t >= cycle - 5 && t < cycle - 2 ? 'y' : 'r';
  return { a, b };
}

// Ginza Line centre-line path, parametrised by distance s from the buffer stop.
const G_ARC_C = [250, -125], G_ARC_R = 50;
const G_L1 = 103, G_L2 = Math.PI / 2 * G_ARC_R, G_L3 = 260;
export const GINZA_LEN = G_L1 + G_L2 + G_L3;
export const GINZA_PORTAL_S = G_L1 + G_L2 + 90;
// returns [x, z, heading(dir of increasing s as rotation.y)] at s with lateral offset (left of increasing s = +)
export function ginzaAt(s, off = 0) {
  let x, z, dx, dz;
  if (s <= G_L1) { x = 200; z = -22 - s; dx = 0; dz = -1; }
  else if (s <= G_L1 + G_L2) {
    const th = Math.PI + (s - G_L1) / G_ARC_R;
    x = G_ARC_C[0] + G_ARC_R * Math.cos(th); z = G_ARC_C[1] + G_ARC_R * Math.sin(th);
    dx = -Math.sin(th); dz = Math.cos(th);
  } else { x = 250 + (s - G_L1 - G_L2); z = -175; dx = 1; dz = 0; }
  // left of travel: (dz, -dx)
  return [x + dz * off, z - dx * off, Math.atan2(dx, dz)];
}

export const TRAVEL = [
  { id: 'scramble', jp: 'スクランブル交差点', en: 'Scramble Crossing', p: [20, 0, 21], yaw: -2.4 },
  { id: 'hachiko', jp: 'ハチ公像', en: 'Hachikō Statue', p: [54, 0, 48], yaw: 2.35 },
  { id: 'centergai', jp: 'センター街', en: 'Center Gai', p: [-34, 0, -26.5], yaw: -1.64 },
  { id: '109', jp: 'SHIBUYA109', en: 'Shibuya 109', p: [-128, 0, 13], yaw: -1.75, pitch: 0.18 },
  { id: 'jr', jp: 'JR山手線ホーム', en: 'Yamanote Line platform', p: [110, JR.plat, 30], yaw: Math.PI },
  { id: 'ginza', jp: '銀座線ホーム', en: 'Ginza Line platform', p: [200, GZ.plat, -40], yaw: Math.PI },
  { id: 'sky', jp: 'SHIBUYA SKY', en: 'Shibuya Sky (229.7 m)', p: [148.5, 229.7, 25], yaw: -1.78, pitch: -0.28 },
  { id: 'miyashita', jp: 'MIYASHITA PARK', en: 'Miyashita Park rooftop', p: [150, 17, -160], yaw: Math.PI },
  { id: 'markcity', jp: 'マークシティ連絡通路', en: 'Mark City walkway view', p: [0, 8.25, 88], yaw: Math.PI, pitch: -0.12 },
  { id: 'stream', jp: '渋谷ストリーム 稲荷橋', en: 'Shibuya Stream riverside', p: [238, 0, 104], yaw: 0 },
  { id: 'sakura', jp: '渋谷サクラステージ', en: 'Sakura Stage', p: [56, 0, 228], yaw: 0.2 },
];

// Named areas for the location label (first match wins)
export const ZONES = [
  { jp: 'SHIBUYA SKY', en: 'Shibuya Sky · 229.7 m', o: aab(140, 16, 190, 90), y0: 200 },
  { jp: 'JR山手線 渋谷駅 ホーム', en: 'Yamanote Line · Shibuya JY20', o: aab(97, -130, 123, 130), y0: 6.5 },
  { jp: '東京メトロ銀座線 渋谷駅', en: 'Ginza Line · Shibuya G01', o: aab(140, -130, 212, -8), y0: 6 },
  { jp: 'MIYASHITA PARK', en: 'Miyashita Park rooftop', o: aab(126, -452, 174, -133), y0: 10 },
  { jp: 'マークシティ連絡通路', en: 'Mark City walkway', o: aab(-14, 84, 14, 96), y0: 6 },
  { jp: 'JR渋谷駅 ハチ公改札', en: 'JR Shibuya Station · Hachikō Gate', o: aab(80, 12, 140, 135) },
  { jp: 'スクランブル交差点', en: 'Shibuya Scramble Crossing', o: aab(-24, -24, 24, 24) },
  { jp: 'ハチ公前広場', en: 'Hachikō Square', o: aab(10, 9, 80, 90) },
  { jp: '渋谷センター街', en: 'Center Gai', o: CENTER_GAI },
  { jp: 'SHIBUYA109 前', en: 'Shibuya 109', o: aab(-200, -30, -140, 30) },
  { jp: '道玄坂', en: 'Dōgenzaka', o: ROADS.find((r) => r.id === 'DOG').o },
  { jp: '道玄坂', en: 'Dōgenzaka', o: aab(-162, -12, -14, 16) },
  { jp: '文化村通り', en: 'Bunkamura-dōri', o: ROADS.find((r) => r.id === 'BUN').o },
  { jp: '公園通り', en: 'Kōen-dōri', o: ROADS.find((r) => r.id === 'KOEN').o },
  { jp: '井の頭通り', en: 'Inokashira-dōri', o: aab(-320, -100, -10, -82) },
  { jp: '明治通り', en: 'Meiji-dōri', o: aab(186, -470, 214, 580) },
  { jp: '国道246号 · 首都高3号渋谷線', en: 'Route 246 · Shuto Expressway', o: aab(-470, 194, 470, 230) },
  { jp: '渋谷ストリーム · 渋谷川', en: 'Shibuya Stream · Shibuya River', o: aab(214, 60, 290, 200) },
  { jp: '渋谷サクラステージ', en: 'Shibuya Sakura Stage', o: aab(10, 226, 100, 360) },
  { jp: '渋谷ヒカリエ', en: 'Shibuya Hikarie', o: aab(214, -100, 290, -10) },
  { jp: '渋谷スクランブルスクエア', en: 'Shibuya Scramble Square', o: aab(136, 12, 190, 94) },
  { jp: '西武渋谷店', en: 'Seibu Shibuya', o: aab(-50, -175, 52, -70) },
  { jp: '渋谷フクラス', en: 'Shibuya Fukuras', o: aab(10, 140, 84, 198) },
  { jp: '渋谷マークシティ', en: 'Shibuya Mark City', o: aab(-154, 46, 84, 142) },
  { jp: '宮益坂', en: 'Miyamasuzaka', o: aab(210, -12, 450, 12) },
];

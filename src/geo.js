// Real Shibuya geography in game metres: origin = centre of the Scramble Crossing (35.6595 N, 139.70052 E),
// x = east, z = south, y = up (0 = street level at the crossing). Measured from the PLATEAU city model,
// PLATEAU railway centre lines and the GSI aerial photo.
export const ORIGIN = { lat: 35.6595, lon: 139.70052 };
const M_LAT = 110950, M_LON = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
export const geo = (lat, lon) => [(lon - ORIGIN.lon) * M_LON, -(lat - ORIGIN.lat) * M_LAT];

// ---------- polyline helpers ----------
export function path(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, L: cum[cum.length - 1] };
}
// point, unit direction and left normal at arc length s (Japan drives on the left: left of travel = (dz, -dx))
export function at(P, s) {
  const { pts, cum } = P;
  s = Math.max(0, Math.min(P.L, s));
  let i = 1; while (i < pts.length - 1 && cum[i] < s) i++;
  const a = pts[i - 1], b = pts[i], L = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / L;
  const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx, dz, h: Math.atan2(dx, dz) };
}
// smooth a polyline (Chaikin) so trains and cars turn gently
export function smoothPts(pts, it = 3) {
  let p = pts;
  for (let k = 0; k < it; k++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) { const [ax, az] = p[i], [bx, bz] = p[i + 1]; q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); }
    q.push(p[p.length - 1]); p = q;
  }
  return p;
}
const lerpTab = (tab, v) => {
  if (v <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (v <= tab[i][0]) { const [a, ya] = tab[i - 1], [b, yb] = tab[i]; return ya + (yb - ya) * (v - a) / (b - a); }
  return tab[tab.length - 1][1];
};

// ---------- Scramble Crossing ----------
// Crosswalks: walking centre line a -> b and band width w (zebra bars run across the walk direction).
export const CROSSWALKS = [
  { id: 'N', a: [0, -18.6], b: [19.6, -17.4], w: 7.5 },
  { id: 'E', a: [22.6, -4.6], b: [21.0, 14.2], w: 7 },
  { id: 'S', a: [-21.5, 15.4], b: [9.6, 18.6], w: 6.5 },
  { id: 'W', a: [-27.6, -13.8], b: [-27.0, 6.6], w: 6.5 },
  { id: 'D', a: [-8.2, -12.6], b: [13.8, 14.2], w: 8 },
];
export const STOPLINES = [
  { a: [3.5, -23.4], b: [11, -23.2] }, { a: [-17, 21.8], b: [-3, 23.2] },
  { a: [-32.1, -2], b: [-32.5, 3.5] }, { a: [27.2, 1], b: [26.8, 11] },
];
// Waiting areas on the corners [x0, z0, x1, z1] and walking routes out along the real sidewalks
// (routed on the PLATEAU sidewalk polygons).
export const CORNERS = {
  QF: { area: [-13, -24, -3, -14], arms: [[[-8,-19],[-16,-16],[-14,-18],[-14,-22],[-30,-37],[-35,-41],[-37,-41],[-37,-43],[-59,-65],[-62,-70],[-67,-71],[-79,-70],[-87,-74],[-101,-75],[-108,-77],[-112,-81],[-115,-81],[-118,-84],[-125,-83],[-165,-99],[-169,-103],[-169,-109],[-159,-131],[-155,-135],[-148,-135],[-145,-133],[-137,-132],[-127,-129],[-122,-126],[-118,-126],[-115,-123]],[[-8,-19],[2,-28],[3,-37],[8,-55],[8,-58],[6,-60],[10,-65],[15,-89],[15,-96],[10,-101],[10,-110],[7,-113],[7,-115],[10,-112],[13,-112],[18,-117],[18,-154],[16,-162],[-4,-181],[-4,-186],[4,-194],[8,-195],[10,-197],[10,-200]]] },
  NE: { area: [21, -13, 31, -6], arms: [[[26,-9],[23,-13],[23,-18],[21,-20],[21,-26],[27,-49],[26,-58],[30,-63],[31,-72],[36,-91],[36,-117],[34,-119],[21,-119],[18,-122],[18,-141],[17,-142],[16,-162],[-4,-181],[-4,-186],[4,-194],[9,-195],[16,-200],[19,-200]],[[26,-9],[35,-7],[40,-8],[41,-7],[47,-8],[48,-7],[85,-7],[87,-5],[98,-5],[100,-7],[101,-6],[112,-6],[131,-9],[134,-11],[138,-11],[140,-9]]] },
  SE: { area: [14, 16, 32, 26], arms: [[[23,21],[30,21],[43,32],[46,32],[43,35],[43,38],[44,42],[48,45],[44,42],[42,34],[42,18],[44,16],[82,14],[85,18]],[[23,21],[30,15],[32,17],[68,15],[69,14],[98,14],[100,16],[103,13],[109,12],[127,12],[135,16],[138,16],[140,18]],[[23,21],[16,21],[13,24],[8,26],[11,26],[15,30],[16,41],[13,45],[13,50],[9,54],[4,56],[-4,66],[-2,88],[1,92]]] },
  SW: { area: [-36, 8, -24, 20], arms: [[[-30,14],[-38,14],[-46,6],[-67,6],[-70,9],[-73,6],[-89,7],[-117,15],[-121,19],[-135,21],[-180,37]],[[-30,14],[-30,22],[-28,24],[-32,26],[-34,32],[-34,39],[-32,41],[-34,41],[-44,51],[-43,76],[-37,89],[-36,98],[-32,100]]] },
  NW: { area: [-38, -24, -24, -16], arms: [[[-31,-20],[-35,-17],[-40,-16],[-52,-19],[-67,-19],[-68,-18],[-80,-18],[-83,-16],[-91,-16],[-104,-21],[-109,-21]],[[-31,-20],[-30,-26],[-34,-29],[-34,-31],[-46,-44]]] },
};
// ambient walking paths, routed along the PLATEAU sidewalks
export const WALKS = [[[-16,-16],[-14,-18],[-14,-22],[-30,-37],[-35,-41],[-37,-41],[-37,-43],[-59,-65],[-62,-70],[-67,-71],[-79,-70],[-87,-74],[-97,-74],[-108,-77],[-112,-81],[-115,-81],[-118,-84],[-120,-83],[-128,-84],[-165,-99],[-169,-103],[-168,-112],[-159,-131],[-155,-135],[-148,-135],[-145,-133],[-137,-132],[-127,-129],[-122,-126],[-118,-126],[-115,-123]],[[4,-26],[2,-28],[2,-32],[15,-89],[15,-96],[10,-101],[10,-110],[7,-113],[7,-115],[10,-112],[13,-112],[18,-117],[18,-154],[16,-162],[-4,-181],[-4,-186],[4,-194],[13,-197],[17,-202],[17,-228],[15,-230]],[[23,-24],[22,-31],[36,-91],[36,-117],[34,-119],[21,-119],[18,-122],[18,-141],[17,-142],[16,-162],[-4,-181],[-4,-186],[4,-194],[13,-197],[17,-202],[17,-228],[19,-230]],[[-36,14],[-48,6],[-67,6],[-70,9],[-73,6],[-89,7],[-118,15],[-122,19],[-127,19],[-128,22],[-135,21],[-196,42],[-200,42]],[[-40,-15],[-40,-2],[-47,5],[-58,5],[-62,4],[-65,1],[-68,5],[-89,7],[-105,12],[-111,12],[-112,8],[-119,1],[-119,-2],[-115,-9]],[[-115,-9],[-139,-20],[-143,-24],[-143,-34],[-141,-37],[-144,-40],[-162,-49],[-170,-50],[-170,-53],[-173,-53],[-185,-59],[-190,-66],[-193,-66],[-195,-68],[-204,-67],[-210,-70]],[[-120,1],[-126,0],[-147,7],[-150,10],[-156,10],[-192,23],[-198,22]],[[30,30],[37,30],[44,34],[43,35],[43,46],[46,52],[35,52],[32,55],[20,56],[20,49],[16,43],[16,36],[12,34]],[[30,14],[33,17],[68,15],[69,14],[98,14],[100,16],[103,13],[109,12],[125,12],[133,16],[137,16],[140,19]],[[34,-8],[44,-6],[98,-5],[100,-7],[101,-6],[112,-6],[131,-9],[136,-12],[143,-13],[147,-13],[150,-10]],[[146,-250],[144,-248],[143,-224],[145,-209],[148,-128],[149,-127],[149,-108],[150,-107],[149,-100],[150,-99],[151,-65],[153,-49],[153,-26],[150,-20]],[[170,-250],[169,-246],[169,-205],[170,-204],[170,-184],[172,-177],[173,-104],[175,-104],[176,-97],[175,-71],[176,-70],[177,-39],[179,-36],[180,-29],[180,-26],[177,-23]],[[200,-5],[206,-4],[235,-10],[248,-10],[251,-13],[260,-14],[264,-18],[274,-17],[314,-25],[318,-29],[318,-41],[317,-42]],[[163,10],[190,9],[194,13],[210,55],[215,60],[214,61],[215,67],[225,92],[229,98],[230,104],[232,106],[232,110]],[[-4,60],[-3,61],[-4,73],[-2,81],[-1,97],[-10,102],[-23,103],[-35,115],[-31,132],[-25,142],[-22,151],[-17,155]],[[-34,49],[-41,49],[-44,52],[-44,62],[-43,63],[-43,76],[-37,89],[-36,98],[-32,100]]];
export const HACHIKO = { x: 4.2, z: 46.5, yaw: 0.9 };
export const KOBAN = { x: 49, z: 21.3 };

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
export function twoPhase(sec, cycle, offset) {
  const t = (((sec + offset) % cycle) + cycle) % cycle, h = cycle / 2;
  const a = t < h - 5 ? 'g' : t < h - 2 ? 'y' : 'r';
  const b = t >= h && t < cycle - 5 ? 'g' : t >= cycle - 5 && t < cycle - 2 ? 'y' : 'r';
  return { a, b };
}

// ---------- JR Yamanote Line ----------
// PLATEAU centre line of the JR corridor (north -> south). The Yamanote pair runs on its east side and
// splits around the island platform at Shibuya (open-air north end beside Hachiko, south part inside the station).
const JR_CORR = path(smoothPts([[134.8, -776.6], [101.3, -442.7], [97.7, -409.4], [85.9, -291.8], [82.3, -256.3], [64.2, -81.0], [59.7, -31.1], [58.8, -16.6], [59.7, -6.7], [63.3, 14.4], [65.1, 22.2], [69.6, 47.7], [76.9, 77.7], [110.3, 183.1], [134.8, 226.3], [152.9, 251.9], [255.1, 393.9], [339.2, 510.4], [439.6, 647.9], [492.9, 723.4], [534.5, 786.6]], 2));
// offset of the Yamanote pair centre east of the corridor line, and half spacing of the two tracks, by z
const JR_OFF = [[-1e4, 5.5], [-150, 5.5], [-45, 17.5], [-20, 18.5], [90, 19.5], [170, 15], [240, 7], [300, 5], [1e4, 5]];
const JR_HALF = [[-1e4, 2], [-90, 2], [-30, 6], [205, 6], [260, 2], [1e4, 2]];
// rail-top height by z (viaduct deck from PLATEAU + track)
const JR_Y = [[-1e4, 6.0], [-440, 6.0], [-380, 4.8], [-300, 3.8], [-100, 3.9], [-60, 6.1], [-35, 6.35], [205, 6.35], [250, 10.5], [300, 10.0], [390, 7.0], [520, 5.2], [1e4, 5.2]];
// Yamanote pair centre line (s measured north -> south); tracks sit +-half to either side.
export const YAMA = (() => {
  const pts = [];
  for (let s = 0; s <= JR_CORR.L; s += 4) {
    const p = at(JR_CORR, s), off = lerpTab(JR_OFF, p.z);
    pts.push([p.x + p.dz * off, p.z - p.dx * off]); // east of the corridor (left of southbound travel)
  }
  const P = path(pts);
  P.y = (s) => lerpTab(JR_Y, at(P, s).z);
  return P;
})();
// side -1 = west track (outer loop, northbound), +1 = east track (inner loop, southbound)
export function jrAt(s, side) {
  const p = at(YAMA, s), o = side * lerpTab(JR_HALF, p.z);
  return { x: p.x + p.dz * o, z: p.z - p.dx * o, h: p.h, dx: p.dx, dz: p.dz, y: lerpTab(JR_Y, p.z) };
}
// Island platform: from its north end (open-air, beside Hachiko) 226 m south into the station building
const platN = (() => { let s = 0; while (at(YAMA, s).z < -18) s += 0.5; return s; })();
export const JR_PLAT = { s0: platN, s1: platN + 226, open: platN + 104, half: 4.3, rail: 6.35, y: 7.45 };

// ---------- Tokyo Metro Ginza Line ----------
// Terminal on the 3rd floor of the station building over Meiji-dori, viaduct east, tunnel portal on Miyamasuzaka.
const GZ_C = path(smoothPts([[121, 74.2], [131, 70.0], [203.2, 40.9], [258.7, 19.9], [411.2, -30.2], [508.0, -80.4], [568.9, -126.5], [700.1, -226.3]], 2));
export const GINZA = {
  centre: GZ_C, rail: 11.4, plat: 12.5, s0: 6, s1: 108, half: 4.5, portal: 222,
  off: (s) => (s < 112 ? 6 : s > 160 ? 1.8 : 6 - (s - 112) / 48 * 4.2),
};
export function ginzaAt(s, side) { // side +1 = left of the outbound direction, -1 = right
  const p = at(GZ_C, s), o = GINZA.off(s) * side;
  return { x: p.x + p.dz * o, z: p.z - p.dx * o, h: p.h, dx: p.dx, dz: p.dz };
}

// ---------- roads for traffic (two-way centre lines; vehicles keep left) ----------
export const ROAD_LINES = {
  EW: [[-262, 41], [-200, 24], [-125, 13], [-70, 7], [-26, 3], [0, 2.5], [26, 3.5], [60, 4.5], [100, 5], [140, 4], [165, -2], [200, -14], [260, -28], [300, -38], [380, -60], [460, -80]],
  BUN: [[-262, -86], [-200, -58], [-170, -40], [-140, -20], [-110, -4], [-70, 4]],
  NS: [[15, -262], [14, -120], [11, -40], [10, -14], [0, 0], [-9, 20], [-14, 40], [-13, 100], [-8, 150]],
  MEIJI: [[158, -300], [158, -100], [161, -30], [170, 5], [195, 50], [225, 100], [240, 150], [250, 200], [262, 300]],
  R246: [[-262, 332], [-100, 291], [0, 253], [100, 212], [200, 172], [300, 135], [420, 95]],
};
// stop lines at the scramble, as [x, z] points the vehicle reaches just before the crossing
export const SCRAMBLE_STOP = { N: [9, -24], S: [-10, 22.5], W: [-33, 2], E: [27.5, 6] };

// ---------- fast travel ----------
export const TRAVEL = [
  { id: 'scramble', jp: 'スクランブル交差点', en: 'Scramble Crossing', p: [24, 0, 22], yaw: -2.55 },
  { id: 'hachiko', jp: 'ハチ公像', en: 'Hachikō Statue', p: [9.5, 0, 50], yaw: -2.0 },
  { id: 'centergai', jp: 'センター街', en: 'Center Gai', p: [-22, 0, -20], yaw: -2.4 },
  { id: '109', jp: 'SHIBUYA109', en: 'Shibuya 109', p: [-96, 0, 9], yaw: -2.0, pitch: 0.2 },
  { id: 'jr', jp: 'JR山手線ホーム', en: 'Yamanote Line platform', jr: 26.5, yaw: 0 },
  { id: 'ginza', jp: '銀座線ホーム', en: 'Ginza Line platform', gz: 40, yaw: 0 },
  { id: 'sky', jp: 'SHIBUYA SKY', en: 'Shibuya Sky (229.7 m)', p: [154, 230, 124], yaw: -2.25, pitch: -0.25 },
  { id: 'miyashita', jp: 'MIYASHITA PARK', en: 'Miyashita Park rooftop', p: [110, 16, -215], yaw: 0.2 },
  { id: 'hikarie', jp: '渋谷ヒカリエ前', en: 'Shibuya Hikarie', p: [215, 0, 8], yaw: 1.9 },
  { id: 'stream', jp: '渋谷ストリーム', en: 'Shibuya Stream', p: [226, 0, 232], yaw: 0.2 },
  { id: 'dogenzaka', jp: '道玄坂', en: 'Dōgenzaka', p: [-150, 0, 24], yaw: 1.4 },
];
// Named areas for the location label: nearest anchor within its radius wins (y0: only above that height)
export const ZONES = [
  { jp: 'SHIBUYA SKY', en: 'Shibuya Sky · 229.7 m', x: 156, z: 124, r: 50, y0: 200 },
  { jp: 'JR山手線 渋谷駅 ホーム', en: 'Yamanote Line · Shibuya JY20', jr: true },
  { jp: '東京メトロ銀座線 渋谷駅', en: 'Ginza Line · Shibuya G01', gz: true },
  { jp: 'MIYASHITA PARK', en: 'Miyashita Park rooftop', x: 112, z: -225, r: 70, y0: 10 },
  { jp: 'スクランブル交差点', en: 'Shibuya Scramble Crossing', x: -2, z: 0, r: 26 },
  { jp: 'ハチ公前広場', en: 'Hachikō Square', x: 30, z: 40, r: 30 },
  { jp: 'QFRONT 前', en: 'Q-FRONT corner', x: -10, z: -24, r: 12 },
  { jp: '渋谷センター街', en: 'Center Gai', x: -60, z: -62, r: 50 },
  { jp: 'SHIBUYA109 前', en: 'Shibuya 109', x: -125, z: 0, r: 35 },
  { jp: '道玄坂', en: 'Dōgenzaka', x: -170, z: 30, r: 70 },
  { jp: '文化村通り', en: 'Bunkamura-dōri', x: -190, z: -50, r: 60 },
  { jp: '西武渋谷店 · 公園通り方面', en: 'Seibu · toward Kōen-dōri', x: 15, z: -120, r: 80 },
  { jp: '明治通り', en: 'Meiji-dōri', x: 160, z: -120, r: 70 },
  { jp: '渋谷駅東口', en: 'Shibuya Station East Exit', x: 125, z: 10, r: 45 },
  { jp: '渋谷ヒカリエ', en: 'Shibuya Hikarie', x: 280, z: 40, r: 60 },
  { jp: '宮益坂', en: 'Miyamasuzaka', x: 300, z: -30, r: 70 },
  { jp: '渋谷スクランブルスクエア', en: 'Shibuya Scramble Square', x: 156, z: 124, r: 50 },
  { jp: '渋谷ストリーム', en: 'Shibuya Stream', x: 238, z: 248, r: 50 },
  { jp: '国道246号 · 首都高3号渋谷線', en: 'Route 246 · Shuto Expressway', x: 100, z: 212, r: 45 },
  { jp: '渋谷マークシティ', en: 'Shibuya Mark City', x: -150, z: 130, r: 60 },
  { jp: 'セルリアンタワー', en: 'Cerulean Tower', x: -100, z: 348, r: 50 },
  { jp: '渋谷駅', en: 'Shibuya Station', x: 80, z: 90, r: 70 },
];
// minimap image (GSI orthophoto, 1 m per pixel)
export const MAP = { x0: -640, z0: -700, x1: 700, z1: 740, src: 'assets/map.jpg' };

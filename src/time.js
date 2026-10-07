// Japan Standard Time helpers, Japanese holidays and sun position for Shibuya.
export const LAT = 35.6591, LON = 139.7006;
const JST = 9 * 3600e3;

// 国民の祝日 (2026-2027), incl. substitute holidays. JR/Metro run the 土休日 timetable on these.
const HOLIDAYS = new Set([
  '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29', '2026-05-03', '2026-05-04',
  '2026-05-05', '2026-05-06', '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12',
  '2026-11-03', '2026-11-23', '2026-12-30', '2026-12-31',
  '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-22', '2027-04-29',
  '2027-05-03', '2027-05-04', '2027-05-05', '2027-07-19', '2027-08-11', '2027-09-20', '2027-09-23', '2027-10-11',
  '2027-11-03', '2027-11-23', '2027-12-30', '2027-12-31',
]);

export function jst(ms) {
  const d = new Date(ms + JST);
  return {
    y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay(),
    h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
  };
}
const pad = (n) => String(n).padStart(2, '0');
export const hhmm = (ms) => { const p = jst(ms); return `${p.h}:${pad(p.mi)}`; };
export const hhmmss = (ms) => { const p = jst(ms); return `${pad(p.h)}:${pad(p.mi)}:${pad(p.s | 0)}`; };

// Railway service day starts at 03:00 JST; trains after midnight belong to the previous day.
export function serviceDay(ms, shiftDays = 0) {
  const p = jst(ms - 3 * 3600e3);
  const base = Date.UTC(p.y, p.mo - 1, p.d + shiftDays) - JST; // 00:00 JST of that service day
  const q = jst(base);
  const key = `${q.y}-${pad(q.mo)}-${pad(q.d)}`;
  const holiday = q.dow === 0 || q.dow === 6 || HOLIDAYS.has(key);
  return { base, holiday, key, dow: q.dow };
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function dateLabel(ms) {
  const p = jst(ms);
  return `${p.y}/${p.mo}/${p.d} (${WD[p.dow]})`;
}

// Solar elevation/azimuth (radians). Azimuth measured from north, clockwise.
export function sun(ms) {
  const d = new Date(ms);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const n = (ms - start) / 864e5 + 1;
  const g = (2 * Math.PI / 365) * (n - 1);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  const tst = utcMin + eot + 4 * LON;
  const ha = ((tst / 4) - 180) * Math.PI / 180;
  const lat = LAT * Math.PI / 180;
  const cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  const elev = Math.PI / 2 - zen;
  let az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) + Math.PI;
  return { elev, az };
}

// Moon: rough position (~opposite-ish track of the sun shifted by phase) and phase 0..1
export function moon(ms) {
  const synodic = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  const phase = (((ms - ref) / 864e5) % synodic + synodic) % synodic / synodic;
  const m = sun(ms - phase * 24.84 * 3600e3); // moon transits ~50 min later each day
  return { elev: m.elev, az: m.az, phase };
}

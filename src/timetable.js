// Shibuya station departure timetables (JR East / Tokyo Metro, 2026 timetable).
// Format: "H:mm mm|H-H:mm/step". Suffix marks: o=大崎行 i=池袋行 s=品川行. Hours >= 24 are after midnight.
// Weekday Yamanote rows are the published JR East table. Holiday rows and a few Ginza Line hours
// that could not be retrieved are filled from the published headway for that hour.
import { serviceDay } from './time.js';

const DATA = {
  yamaOuter: {
    weekday: '4:37 56|5:15 27 34 43 49 55|6:01 06 11 16 22 27 33 37 41 44 48 53 57|7:02 06 10 13 18 22 26 29 33 37 40 44 48 51 54 58|8:02 06 10 13 17o 22 26 30 34 38o 42 45 49 52o 55 59|9:02 06 10i 14o 19 24 29 34 39 44 49 54 59|10-15:04/5|16:04 08 11 15 20 25 30 35 39 43 46 51 55|17:00 03 06 10 14 17 20 24 28 31 34 38 41 44 48 51 54 58|18:00 04 07 10 13 16 19 22 25o 29 32 35 38 41 44o 48 51 54 58|19:01 04 08 11o 14 18 21 25 28 32o 36 39 43 47 51o 54 58|20:02 06 09i 12 17 21 25 30 34 39 43 48 53 57|21:02 06 11 15 20 24 29o 32 37 42 46 51 56|22:01 06 10 14 19 24 29 34 39 44 48 53 58|23:03 09o 13 17 21o 27 32o 38o 42o 46o 51o 55s|24:00s 05s 13i 21i 27i 33i',
    holiday: '4:37 56|5:15 28 42 52|6:01 11 20 26 33 41 47 53 57|7:02 07 12 17 22 27 32 38 42 47 52 58|8-22:03/5|23:05 10 15 21 27 32 38 44 49 55s|24:00s 05s 13i 21i 27i 33i',
  },
  yamaInner: {
    weekday: '4:49|5:09 26 44 56|6:06 15 24 33 37 41 46 52 56 59|7:02 05 08 11 16 19 22 25 28 31 34 37 40 44 47 50 53 57|8:00 03 06 09 12 15 18 21 24 27 30 33 36 39 42 45 48 51 54 58|9:01 04 08 12 15 18 21 24 27 30 33 36 39 42 44 48 51 54 58|10:01 04 07 11 14 17 22 26 30 33 38 43 47 50 54 59|11-16:04/5|17:00 04 08 12 16 21 26 31 36 41 46 51 55 59|18:03 07 11 15 20 24 29 33 38 42 46 51 55|19:00 05 08 10 15 20 25 29 32 36 41 46 50 55|20:00 06 08 12 17 23 28 34 39 45 51 56 59|21:03 09 14 20 26 33 39 43 46 52 58|22:04 11 18 25 31 38 45 48 53 59|23:06 13 20 26 32 39 46 53|24:00 07 13 21 28 34 40 48',
    holiday: '4:49|5:09 26 44 56|6:06 15 24 33 37 41 46 52 56 59|7:03/5|8-22:01/5|23:06 13 20 26 32 39 46 53|24:00 07 13 21 28 34 40 48',
  },
  ginza: {
    weekday: '5:01 11 23 31 40 46 53|6:02 08 13 19 24 29 34 39 44 48 52 56|7:00 04 08 11 15 18 21 24 27 30 33 36 38 41 43 45 47 49 51 53 55 57 59|8:01/2|9:01 03 05 08 10 13 16 19 22 25 28 31 34 37 40 43 46 49 52 55 58|10-15:01/3|16:01 04 07 10 13 16 19 22 25 28 31 33 36 38 41 43 45 47 50 52 54 56 58|17:00 02 04 07 09 11 13 16 18 20 22 25 27 29 31 34 36 38 40 43 45 47 49 52 54 56 58|18:01 03 05 07 10 12 14 16 19 21 23 25 28 30 32 34 37 39 41 43 46 48 50 52 55 57 59|19:01 03 06 08 10 13 15 18 20 23 25 28 30 33 35 38 41 44 47 50 53 56 59|20:02 05 08 11 14 17 20 23 26 30 34 38 42 46 50 54 58|21:02 06 10 14 18 22 26 30 34 38 42 47 51 56|22:04 09 13 18 22 27 32 36 41 45 50 55|23:00 05 10 15 20 25 30 34 41 46 51 56|24:02',
    holiday: '5:01 11 23 31 40 46 53|6:02 09 15 21 27 33 38 43 48 53 58|7-8:01/4|9-19:01 04 08 11 15 18 22 25 29 32 36 39 43 46 50 53 57|20-21:01/4|22:04/5|23:04 09 14 19 25 30 36 42 48 54|24:01',
  },
};

export const LINES = {
  yamaOuter: { name: '山手線', dir: '外回り', to: '新宿・池袋方面', en: 'Yamanote Line for Shinjuku & Ikebukuro', color: '#80c241', track: 2 },
  yamaInner: { name: '山手線', dir: '内回り', to: '品川・東京方面', en: 'Yamanote Line for Shinagawa & Tokyo', color: '#80c241', track: 1 },
  ginza: { name: '銀座線', dir: '', to: '浅草行', en: 'Ginza Line for Asakusa', color: '#f39700', track: 1 },
};
const MARK = { o: ['大崎行', 'for Ōsaki'], i: ['池袋行', 'for Ikebukuro'], s: ['品川行', 'for Shinagawa'] };

function parse(src) {
  const out = [];
  for (const seg of src.split('|')) {
    const [hp, mp] = seg.split(':');
    const [h0, h1] = hp.includes('-') ? hp.split('-').map(Number) : [Number(hp), Number(hp)];
    for (let h = h0; h <= h1; h++) {
      if (mp.includes('/')) {
        const [m0, st] = mp.split('/').map(Number);
        for (let m = m0; m < 60; m += st) out.push({ sec: h * 3600 + m * 60, mark: '' });
      } else {
        for (const tok of mp.trim().split(/\s+/)) {
          const m = parseInt(tok, 10);
          out.push({ sec: h * 3600 + m * 60, mark: tok.replace(/\d+/g, '') });
        }
      }
    }
  }
  return out.sort((a, b) => a.sec - b.sec);
}
const cache = {};
const table = (line, holiday) => (cache[line + holiday] ||= parse(DATA[line][holiday ? 'holiday' : 'weekday']));

// Departures (epoch ms) within [from, to] for a line, crossing service-day boundaries correctly.
export function departures(line, from, to) {
  const res = [];
  for (const shift of [-1, 0, 1]) {
    const sd = serviceDay(from, shift);
    table(line, sd.holiday).forEach((e, idx) => {
      const t = sd.base + e.sec * 1000;
      if (t >= from && t <= to) {
        const mk = MARK[e.mark];
        res.push({ t, idx, line, dest: mk ? mk[0] : LINES[line].to, destEn: mk ? mk[1] : LINES[line].en, holiday: sd.holiday });
      }
    });
  }
  return res.sort((a, b) => a.t - b.t);
}

export function nextDepartures(line, now, n = 3) {
  return departures(line, now, now + 6 * 3600e3).slice(0, n);
}

export function dayType(now) {
  return serviceDay(now).holiday ? '土休日ダイヤ' : '平日ダイヤ';
}

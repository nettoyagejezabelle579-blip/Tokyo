import { TRAVEL, ZONES, MAP, scramblePhase } from './geo.js';
import { hhmm, hhmmss, dateLabel, serviceDay } from './time.js';
import { departures, LINES } from './timetable.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(onTravel) {
    this.onTravel = onTravel;
    this.base = this.drawBase();
    this.mini = $('mini'); this.mg = this.mini.getContext('2d');
    this.lastSlow = 0;
    this.zone = '';
    this.buildMap();
  }
  // Minimap base: GSI aerial photo (1 m per pixel) with street labels
  drawBase() {
    const W = MAP.x1 - MAP.x0, H = MAP.z1 - MAP.z0;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#6d6f72'; g.fillRect(0, 0, W, H);
    const img = new Image();
    img.onload = () => {
      g.drawImage(img, 0, 0, W, H);
      g.fillStyle = 'rgba(10,12,16,0.12)'; g.fillRect(0, 0, W, H);
      const X = (x) => x - MAP.x0, Z = (z) => z - MAP.z0;
      g.font = '700 15px "Noto Sans JP",sans-serif'; g.textAlign = 'center';
      const lab = [['スクランブル交差点', -2, -2], ['ハチ公', 8, 62], ['JR渋谷駅', 104, 118], ['センター街', -70, -60], ['SHIBUYA109', -132, -14], ['ヒカリエ', 285, 50], ['スクランブルスクエア', 156, 150], ['宮下公園', 112, -238], ['渋谷ストリーム', 238, 262], ['マークシティ', -150, 140], ['QFRONT', -14, -46], ['西武', 30, -120], ['明治通り', 170, -160], ['国道246号', -60, 300], ['道玄坂', -210, 50], ['文化村通り', -215, -90], ['宮益坂', 330, -60], ['銀座線', 200, 25], ['セルリアンタワー', -100, 360]];
      for (const [t, x, z] of lab) { g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 4; g.strokeText(t, X(x), Z(z)); g.fillStyle = '#fff'; g.fillText(t, X(x), Z(z)); }
      const mi = document.getElementById('mapImg'); if (mi) mi.src = c.toDataURL('image/jpeg', 0.85);
    };
    img.src = new URL('../' + MAP.src, import.meta.url).href;
    return c;
  }
  buildMap() {
    const wrap = $('mapPins');
    for (const t of TRAVEL) {
      const b = document.createElement('button');
      b.className = 'pin'; b.type = 'button';
      b.style.left = ((t.p[0] - MAP.x0) / (MAP.x1 - MAP.x0) * 100) + '%';
      b.style.top = ((t.p[2] - MAP.z0) / (MAP.z1 - MAP.z0) * 100) + '%';
      b.innerHTML = `<span>${t.jp}</span><small>${t.en}</small>`;
      b.addEventListener('click', () => this.onTravel(t));
      wrap.appendChild(b);
    }
    const list = $('travelList');
    for (const t of TRAVEL) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'trow';
      b.innerHTML = `<b>${t.jp}</b><span>${t.en}</span>`;
      b.addEventListener('click', () => this.onTravel(t));
      list.appendChild(b);
    }
  }
  zoneAt(p) {
    const plat = this.onPlatform?.(p);
    if (plat) return ZONES.find((z) => z[plat]);
    let best = null, bd = 1e9;
    for (const z of ZONES) {
      if (z.r === undefined || (z.y0 !== undefined && p.y < z.y0)) continue;
      const d = Math.hypot(p.x - z.x, p.z - z.z);
      if (d < z.r && d / z.r < bd) { bd = d / z.r; best = z; }
    }
    return best || { jp: '渋谷', en: 'Shibuya, Tokyo' };
  }
  update(now, player, rail, offset, sig) {
    const p = player.pos;
    // fast stuff every frame: minimap
    const g = this.mg, S = this.mini.width, scale = S / 220;
    g.save();
    g.clearRect(0, 0, S, S);
    g.translate(S / 2, S / 2); g.scale(scale, scale);
    g.drawImage(this.base, -(p.x - MAP.x0) - 0, -(p.z - MAP.z0));
    // trains
    g.lineCap = 'round';
    for (const m of rail.markers()) {
      g.strokeStyle = m.color; g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(m.a[0] - p.x, m.a[1] - p.z); g.lineTo(m.b[0] - p.x, m.b[1] - p.z); g.stroke();
    }
    g.rotate(-player.h + Math.PI);
    g.fillStyle = '#e8380d'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2.5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // signal pill
    const near = Math.hypot(p.x, p.z) < 70 && p.y < 3;
    const pill = $('sigPill');
    pill.hidden = !near;
    if (near) {
      const t = Math.ceil(sig.left);
      pill.dataset.state = sig.ped;
      pill.textContent = sig.ped === 'go' ? `歩行者 青  ·  あと ${t}秒  Walk` : sig.ped === 'blink' ? `点滅  ·  渡らないで  Don't start` : `歩行者 赤  ·  青まで ${t}秒  Wait`;
    }
    const rt = performance.now();
    if (rt - this.lastSlow < 250) return;
    this.lastSlow = rt;
    $('clock').textContent = hhmmss(now);
    const sd = serviceDay(now);
    $('date').textContent = `${dateLabel(now)} · ${sd.holiday ? '土休日ダイヤ' : '平日ダイヤ'}`;
    const live = Math.abs(offset) < 1000;
    $('live').textContent = live ? 'LIVE · JST' : `${offset > 0 ? '+' : '−'}${fmtOff(Math.abs(offset))} · JST`;
    $('live').dataset.live = live ? '1' : '0';
    const z = (this.zoneOverride && this.zoneOverride(p)) || this.zoneAt(p);
    if (z.jp !== this.zone) { this.zone = z.jp; $('locJp').textContent = z.jp; $('locEn').textContent = z.en; }
    // departures
    const rows = [];
    for (const line of ['yamaOuter', 'yamaInner', 'ginza']) {
      const d = departures(line, now, now + 8 * 3600e3)[0];
      const L = LINES[line];
      const st = rail.status[line];
      let note = '';
      if (d) {
        const mins = Math.floor((d.t - now) / 60000);
        note = st && st.dep === d.t && st.phase === 'stopped' ? '停車中' : st && st.dep === d.t && st.phase === 'approach' && d.t - now < 90000 ? '接近' : mins < 1 ? 'まもなく' : `${mins}分後`;
      }
      rows.push(`<div class="dep"><i style="background:${L.color}"></i><div class="dl"><b>${L.name}${L.dir ? ' ' + L.dir : ''}</b><span>${d ? d.dest : '本日終了'}</span></div><div class="dt"><b>${d ? hhmm(d.t) : '--:--'}</b><span>${note}</span></div></div>`);
    }
    $('deps').innerHTML = rows.join('');
  }
  toast(jp, en) {
    const t = $('toast');
    t.innerHTML = `<b>${jp}</b><span>${en}</span>`;
    t.hidden = false; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(this.tt); this.tt = setTimeout(() => (t.hidden = true), 6000);
  }
}
function fmtOff(ms) {
  const m = Math.round(ms / 60000), h = Math.floor(m / 60), mm = m % 60;
  return h ? `${h}h${mm ? String(mm).padStart(2, '0') : ''}` : `${mm}m`;
}
export { scramblePhase };

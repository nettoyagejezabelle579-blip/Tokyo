import { ROADS, CENTER_GAI, HACHIKO, JR, GZ, ginzaAt, GINZA_PORTAL_S, TRAVEL, ZONES, scramblePhase } from './layout.js';
import { toWorld, toLocal } from './util.js';
import { hhmm, hhmmss, dateLabel, serviceDay } from './time.js';
import { departures, LINES } from './timetable.js';

const $ = (id) => document.getElementById(id);
const MAP = { x0: -480, z0: -490, x1: 480, z1: 600 };

export class Hud {
  constructor(world, onTravel) {
    this.world = world; this.onTravel = onTravel;
    this.base = this.drawBase();
    this.mini = $('mini'); this.mg = this.mini.getContext('2d');
    this.lastSlow = 0;
    this.zone = '';
    this.buildMap();
  }
  drawBase() {
    const W = MAP.x1 - MAP.x0, H = MAP.z1 - MAP.z0;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const X = (x) => x - MAP.x0, Z = (z) => z - MAP.z0;
    g.fillStyle = '#d9d4cb'; g.fillRect(0, 0, W, H);
    const fillObb = (o, col, pad = 0) => {
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toWorld(o, a * (o.hw + pad), b * (o.hd + pad)));
      g.fillStyle = col; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.fill();
    };
    for (const r of ROADS) fillObb(r.o, '#f6f3ee', 4);
    for (const r of ROADS) fillObb(r.o, '#9c9a97');
    fillObb(CENTER_GAI, '#c98f6f');
    fillObb(HACHIKO, '#c9b49a');
    g.fillStyle = '#7fb0c9'; g.fillRect(X(222), Z(60), 12, 530);
    g.fillStyle = '#9cc285'; g.fillRect(X(130), Z(-390), 40, 250);
    for (const f of this.world.foot) fillObb(f.o, f.h > 90 ? '#4a4f57' : f.h > 40 ? '#6d727a' : '#8b8f95');
    // rails
    g.strokeStyle = '#2f8a2f'; g.lineWidth = 3; g.setLineDash([10, 6]);
    g.beginPath(); g.moveTo(X(JR.outX), 0); g.lineTo(X(JR.outX), H); g.moveTo(X(JR.inX), 0); g.lineTo(X(JR.inX), H); g.stroke();
    g.strokeStyle = '#f39700';
    g.beginPath();
    for (let s = 0; s <= GINZA_PORTAL_S; s += 4) { const [x, z] = ginzaAt(s); s ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)); }
    g.stroke(); g.setLineDash([]);
    // labels
    g.font = '700 13px "Noto Sans JP",sans-serif'; g.fillStyle = '#1b1d21'; g.textAlign = 'center';
    const lab = [['スクランブル', 0, -2], ['ハチ公', 50, 55], ['JR渋谷駅', 112, 150], ['センター街', -120, -55], ['109', -172, 6], ['ヒカリエ', 252, -55], ['スクランブルスクエア', 163, 100], ['宮下公園', 150, -280], ['ストリーム', 262, 205], ['サクラステージ', 55, 375], ['フクラス', 47, 172], ['マークシティ', -80, 74], ['PARCO', -120, -330], ['西武', 30, -118], ['明治通り', 200, 300], ['国道246号', -300, 214], ['道玄坂', -300, 80]];
    for (const [t, x, z] of lab) { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.strokeText(t, X(x), Z(z)); g.fillText(t, X(x), Z(z)); }
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
    $('mapImg').src = this.base.toDataURL();
    const list = $('travelList');
    for (const t of TRAVEL) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'trow';
      b.innerHTML = `<b>${t.jp}</b><span>${t.en}</span>`;
      b.addEventListener('click', () => this.onTravel(t));
      list.appendChild(b);
    }
  }
  zoneAt(p) {
    for (const z of ZONES) {
      if (z.y0 !== undefined && p.y < z.y0) continue;
      const [lx, lz] = toLocal(z.o, p.x, p.z);
      if (Math.abs(lx) <= z.o.hw && Math.abs(lz) <= z.o.hd) return z;
    }
    return { jp: '渋谷', en: 'Shibuya, Tokyo' };
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
    if (now - this.lastSlow < 250) return;
    this.lastSlow = now;
    $('clock').textContent = hhmmss(now);
    const sd = serviceDay(now);
    $('date').textContent = `${dateLabel(now)} · ${sd.holiday ? '土休日ダイヤ' : '平日ダイヤ'}`;
    const live = Math.abs(offset) < 1000;
    $('live').textContent = live ? 'LIVE · JST' : `${offset > 0 ? '+' : '−'}${fmtOff(Math.abs(offset))} · JST`;
    $('live').dataset.live = live ? '1' : '0';
    const z = this.zoneAt(p);
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

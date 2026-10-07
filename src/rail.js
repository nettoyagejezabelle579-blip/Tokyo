import * as THREE from 'three';
import { trainTex, Board, canvas, toTex, JP, DOT } from './textures.js';
import { JR, GZ, ginzaAt, GINZA_PORTAL_S } from './layout.js';
import { departures, LINES } from './timetable.js';
import { hhmm } from './time.js';

// distance covered after/before a stop with constant acceleration a and speed cap v
const dist = (tau, a, v) => (tau < v / a ? 0.5 * a * tau * tau : (v * v) / (2 * a) + v * (tau - v / a));

const SPEC = {
  yamanote: { cars: 11, len: 20, w: 2.95, h0: 0.95, h1: 4.0, doors: [0.12, 0.37, 0.63, 0.88], a: 0.9, v: 25 },
  ginza: { cars: 6, len: 16, w: 2.55, h0: 0.9, h1: 3.55, doors: [0.16, 0.5, 0.84], a: 0.8, v: 14 },
};

function atlas(type) {
  const t = trainTex(type);
  const c = canvas(1024, 1024), g = c.getContext('2d');
  const e = canvas(1024, 1024), ge = e.getContext('2d');
  g.drawImage(t.side.image, 0, 0); g.drawImage(t.open.image, 0, 128);
  g.drawImage(t.front.image, 0, 256);
  g.fillStyle = '#3a3d42'; g.fillRect(256, 256, 256, 256); g.fillStyle = '#23262a'; g.fillRect(320, 300, 128, 212);
  g.fillStyle = '#8e9297'; g.fillRect(512, 256, 256, 256);
  g.fillStyle = 'rgba(0,0,0,0.15)'; for (let x = 512; x < 768; x += 16) g.fillRect(x, 256, 2, 256);
  g.fillStyle = '#1b1c1f'; g.fillRect(768, 256, 256, 256);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 1024, 1024);
  const D = SPEC[type].doors;
  for (const row of [0, 128]) {
    ge.fillStyle = '#fff6e0';
    for (let i = 0; i < D.length - 1; i++) ge.fillRect(D[i] * 1024 + 40, row + 24, (D[i + 1] - D[i]) * 1024 - 80, 44);
    ge.fillRect(4, row + 24, D[0] * 1024 - 46, 44); ge.fillRect(D[D.length - 1] * 1024 + 42, row + 24, 1024 - D[D.length - 1] * 1024 - 46, 44);
    if (row) for (const d of D) ge.fillRect(d * 1024 - 26, row + 20, 52, 70);
  }
  ge.fillStyle = '#ffffff';
  if (type === 'yamanote') { ge.fillRect(30, 256 + 196, 40, 14); ge.fillRect(186, 256 + 196, 40, 14); ge.fillStyle = '#ff9a2a'; ge.fillRect(40, 256 + 30, 176, 30); }
  else { ge.beginPath(); ge.arc(56, 256 + 190, 14, 0, 7); ge.arc(200, 256 + 190, 14, 0, 7); ge.fill(); ge.fillStyle = '#ff9a2a'; ge.fillRect(60, 256 + 40, 136, 30); }
  const map = toTex(c, false), emi = toTex(e, false);
  return new THREE.MeshLambertMaterial({ map, emissiveMap: emi, emissive: 0xffffff, emissiveIntensity: 0.25 });
}

// uv rect helper in pixel coordinates of the 1024 atlas
const R = (x0, y0, x1, y1) => [x0 / 1024, 1 - y1 / 1024, x1 / 1024, 1 - y0 / 1024];
function carGeo(type, mode, open) {
  const S = SPEC[type];
  const L = S.len - 0.5, w = S.w / 2, h0 = S.h0, h1 = S.h1, l = L / 2;
  const pos = [], uv = [], nor = [];
  const quad = (a, b, c, d, r, flipU = false) => {
    const [u0, v0, u1, v1] = r;
    const uvs = flipU ? [u1, v0, u0, v0, u0, v1, u1, v1] : [u0, v0, u1, v0, u1, v1, u0, v1];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const n = Math.hypot(nx, ny, nz); nx /= n; ny /= n; nz /= n;
    for (const i of [0, 1, 2, 0, 2, 3]) { const p = [a, b, c, d][i]; pos.push(...p); uv.push(uvs[i * 2], uvs[i * 2 + 1]); nor.push(nx, ny, nz); }
  };
  const side = open ? R(0, 128, 1024, 256) : R(0, 0, 1024, 128);
  quad([w, h0, l], [w, h0, -l], [w, h1, -l], [w, h1, l], side);
  quad([-w, h0, -l], [-w, h0, l], [-w, h1, l], [-w, h1, -l], side);
  const front = R(0, 256, 256, 512), gang = R(256, 256, 512, 512), roof = R(512, 256, 768, 512), dark = R(768, 256, 1024, 512);
  // roof with a slight crown
  const rc = h1 + 0.22;
  quad([-w, h1, l], [-w * 0.55, rc, l], [-w * 0.55, rc, -l], [-w, h1, -l], roof);
  quad([-w * 0.55, rc, l], [w * 0.55, rc, l], [w * 0.55, rc, -l], [-w * 0.55, rc, -l], roof);
  quad([w * 0.55, rc, l], [w, h1, l], [w, h1, -l], [w * 0.55, rc, -l], roof);
  // ends
  quad([-w, h0, l], [w, h0, l], [w, h1, l], [-w, h1, l], mode === 'headPos' ? front : gang);
  quad([w, h0, -l], [-w, h0, -l], [-w, h1, -l], [w, h1, -l], mode === 'headNeg' ? front : gang);
  quad([-w * 0.55, h1, l], [w * 0.55, h1, l], [w * 0.55, rc, l], [-w * 0.55, rc, l], gang);
  quad([w * 0.55, h1, -l], [-w * 0.55, h1, -l], [-w * 0.55, rc, -l], [w * 0.55, rc, -l], gang);
  // underframe + bogies
  const uw = w - 0.25;
  quad([uw, 0.25, l - 1], [uw, 0.25, -l + 1], [uw, h0, -l + 1], [uw, h0, l - 1], dark);
  quad([-uw, 0.25, -l + 1], [-uw, 0.25, l - 1], [-uw, h0, l - 1], [-uw, h0, -l + 1], dark);
  // AC unit
  const aw = 0.9, ah = rc + 0.35;
  quad([aw, rc, 2], [aw, rc, -2], [aw, ah, -2], [aw, ah, 2], dark);
  quad([-aw, rc, -2], [-aw, rc, 2], [-aw, ah, 2], [-aw, ah, -2], dark);
  quad([-aw, ah, 2], [aw, ah, 2], [aw, ah, -2], [-aw, ah, -2], roof);
  quad([-aw, rc, 2], [aw, rc, 2], [aw, ah, 2], [-aw, ah, 2], dark);
  quad([aw, rc, -2], [-aw, rc, -2], [-aw, ah, -2], [aw, ah, -2], dark);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

class Train {
  constructor(scene, type, mat, geos) {
    this.type = type; this.S = SPEC[type]; this.geos = geos;
    this.cars = [];
    for (let i = 0; i < this.S.cars; i++) {
      const mode = i === 0 ? (type === 'ginza' ? 'headNeg' : 'headPos') : i === this.S.cars - 1 ? (type === 'ginza' ? 'headPos' : 'headNeg') : 'mid';
      const m = new THREE.Mesh(geos[mode][0], mat);
      m.userData.mode = mode;
      m.castShadow = true; m.receiveShadow = true; m.visible = false;
      scene.add(m);
      this.cars.push(m);
    }
    this.open = false; this.dep = null;
  }
  setOpen(o) {
    if (o === this.open) return;
    this.open = o;
    for (const c of this.cars) c.geometry = this.geos[c.userData.mode][o ? 1 : 0];
  }
  hide() { for (const c of this.cars) c.visible = false; this.dep = null; }
}

export class Rail {
  constructor(scene, world) {
    this.scene = scene;
    this.mat = { yamanote: atlas('yamanote'), ginza: atlas('ginza') };
    this.geos = {};
    for (const t of ['yamanote', 'ginza']) {
      this.geos[t] = {};
      for (const m of ['headPos', 'headNeg', 'mid']) this.geos[t][m] = [carGeo(t, m, false), carGeo(t, m, true)];
    }
    this.pool = { yamaOuter: [], yamaInner: [], ginza: [] };
    for (let i = 0; i < 2; i++) this.pool.yamaOuter.push(new Train(scene, 'yamanote', this.mat.yamanote, this.geos.yamanote));
    for (let i = 0; i < 2; i++) this.pool.yamaInner.push(new Train(scene, 'yamanote', this.mat.yamanote, this.geos.yamanote));
    for (let i = 0; i < 4; i++) this.pool.ginza.push(new Train(scene, 'ginza', this.mat.ginza, this.geos.ginza));
    this.events = [];
    this.status = {};
    this.lastNow = 0;
    this.buildDoors(scene);
    this.buildBoards(scene, world);
  }

  // Platform screen doors: fixed panels + sliding leaves (instanced)
  buildDoors(scene) {
    const leafGeo = new THREE.BoxGeometry(0.06, 1.25, 0.95).translate(0, 0.625, 0);
    const panelGeo = new THREE.BoxGeometry(0.12, 1.3, 1).translate(0, 0.65, 0);
    const mk = (color) => new THREE.MeshLambertMaterial({ color });
    this.psd = [];
    const sets = [
      { line: 'yamaOuter', x: JR.platX0 + 0.15, y: JR.plat, z0: JR.platZ0, z1: JR.platZ1, stop: (i) => -97 + 20 * i, n: 11, offs: [-7.6, -2.6, 2.6, 7.6], col: 0x80c241 },
      { line: 'yamaInner', x: JR.platX1 - 0.15, y: JR.plat, z0: JR.platZ0, z1: JR.platZ1, stop: (i) => 102 - 20 * i, n: 11, offs: [-7.6, -2.6, 2.6, 7.6], col: 0x80c241 },
      { line: 'ginzaW', x: GZ.platX0 + 0.15, y: GZ.plat, z0: GZ.platZ0, z1: GZ.platZ1, stop: (i) => -32 - 16 * i, n: 6, offs: [-5.44, 0, 5.44], col: 0xf39700 },
      { line: 'ginzaE', x: GZ.platX1 - 0.15, y: GZ.plat, z0: GZ.platZ0, z1: GZ.platZ1, stop: (i) => -32 - 16 * i, n: 6, offs: [-5.44, 0, 5.44], col: 0xf39700 },
    ];
    const m4 = new THREE.Matrix4();
    for (const s of sets) {
      const open = [];
      for (let i = 0; i < s.n; i++) for (const o of s.offs) open.push(s.stop(i) + o);
      open.sort((a, b) => a - b);
      // fixed panels in the gaps
      const panels = [];
      let z = s.z0 + 0.5;
      for (const oz of open) { for (; z < oz - 1.05; z += 1) panels.push(z + 0.5); z = oz + 1.05; }
      for (; z < s.z1 - 0.5; z += 1) panels.push(z + 0.5);
      const pm = new THREE.InstancedMesh(panelGeo, mk(0xf0f0ee), panels.length);
      panels.forEach((pz, i) => pm.setMatrixAt(i, m4.makeTranslation(s.x, s.y, pz)));
      scene.add(pm);
      const stripe = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.12, 1).translate(0, 1.1, 0), mk(s.col), panels.length);
      panels.forEach((pz, i) => stripe.setMatrixAt(i, m4.makeTranslation(s.x, s.y, pz)));
      scene.add(stripe);
      const leaves = new THREE.InstancedMesh(leafGeo, mk(0xdde3e6), open.length * 2);
      scene.add(leaves);
      s.leaves = leaves; s.open = open; s.k = 0; s.target = 0;
      this.setLeaves(s, 0);
      this.psd.push(s);
    }
  }
  setLeaves(s, k) {
    const m4 = new THREE.Matrix4();
    s.open.forEach((oz, i) => {
      const off = 0.48 + k * 0.95;
      s.leaves.setMatrixAt(i * 2, m4.makeTranslation(s.x, s.y, oz - off));
      s.leaves.setMatrixAt(i * 2 + 1, m4.makeTranslation(s.x, s.y, oz + off));
    });
    s.leaves.instanceMatrix.needsUpdate = true;
  }

  buildBoards(scene, world) {
    const mkMesh = (board, w, h, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: board.tex }));
      m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
      const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.2), new THREE.MeshLambertMaterial({ color: 0x2a2c30 }));
      back.position.set(x - Math.sin(ry) * 0.11, y, z - Math.cos(ry) * 0.11); back.rotation.y = ry; scene.add(back);
      return m;
    };
    this.boards = {
      outer: new Board(512, 128), inner: new Board(512, 128), ginza: new Board(512, 128), hall: new Board(1024, 320),
    };
    for (const z of [-60, 0, 70]) {
      if (z > 60 && z < 100) continue;
      mkMesh(this.boards.outer, 4.2, 1.05, JR.platX0 + 1.4, 10.9, z, Math.PI / 2);
      mkMesh(this.boards.inner, 4.2, 1.05, JR.platX1 - 1.4, 10.9, z + 6, -Math.PI / 2);
    }
    for (const z of [-40, -90]) mkMesh(this.boards.ginza, 4.0, 1.0, 200, GZ.plat + 2.9, z, Math.PI);
    mkMesh(this.boards.ginza, 4.0, 1.0, 186.3, GZ.plat + 2.4, -17, -Math.PI / 2);
    const [x, y, z, ry] = world.boardSpots.concourse;
    mkMesh(this.boards.hall, 6.4, 2.0, x - 0.3, y + 0.6, z, ry);
    mkMesh(this.boards.hall, 6.4, 2.0, x + 0.15, y + 0.6, z, ry + Math.PI);
    // outdoor hall board at the Hachiko exit
    mkMesh(this.boards.hall, 4.8, 1.5, 79.4, 3.3, 66, -Math.PI / 2);
    this.lastBoard = 0;
  }

  drawBoards(now, force) {
    if (!force && now - this.lastBoard < 1000) return;
    this.lastBoard = now;
    const en = Math.floor(now / 5000) % 2 === 1;
    const rows = (line, n) => departures(line, now - 5000, now + 8 * 3600e3).filter((d) => d.t > now - 5000).slice(0, n).map((d) => ({
      time: hhmm(d.t), dest: d.dest, destEn: d.destEn.replace('Yamanote Line ', '').replace('Ginza Line ', ''),
      note: this.status[line]?.dep === d.t && this.status[line]?.phase === 'approach' ? (en ? 'Arriving' : '接近') : this.status[line]?.dep === d.t && this.status[line]?.phase === 'stopped' ? (en ? 'Boarding' : '乗車中') : '',
    }));
    this.boards.outer.draw(rows('yamaOuter', 2), en, { jp: '2番線  山手線 外回り', en: 'Track 2  Yamanote Line (outer)', color: '#5a9e2f' });
    this.boards.inner.draw(rows('yamaInner', 2), en, { jp: '1番線  山手線 内回り', en: 'Track 1  Yamanote Line (inner)', color: '#5a9e2f' });
    this.boards.ginza.draw(rows('ginza', 2), en, { jp: '銀座線  浅草方面', en: 'Ginza Line  for Asakusa', color: '#f39700' });
    // concourse hall board
    const b = this.boards.hall, g = b.g, W = b.w, H = b.h;
    g.fillStyle = '#060606'; g.fillRect(0, 0, W, H);
    const sect = [['yamaOuter', '山手線 外回り', 'Yamanote (outer)', '#80c241'], ['yamaInner', '山手線 内回り', 'Yamanote (inner)', '#80c241'], ['ginza', '銀座線', 'Ginza Line', '#f39700']];
    sect.forEach(([line, jp, enl, col], i) => {
      const y0 = 8 + i * 104;
      g.fillStyle = col; g.fillRect(8, y0, 210, 96);
      g.fillStyle = '#fff'; g.font = `700 30px ${JP}`; g.textBaseline = 'middle'; g.textAlign = 'center';
      g.fillText(en ? enl : jp, 113, y0 + 48, 200);
      rows(line, 2).forEach((r, k) => {
        const y = y0 + 24 + k * 48;
        g.textAlign = 'left'; g.font = `38px ${DOT}`;
        g.fillStyle = '#4dff6a'; g.fillText(en ? 'Local' : '普通', 236, y);
        g.fillStyle = '#ffb02e'; g.fillText(r.time, 380, y); g.fillText(en ? r.destEn : r.dest, 520, y, 380);
        if (r.note) { g.fillStyle = '#ff5050'; g.textAlign = 'right'; g.fillText(r.note, W - 10, y); }
      });
    });
    b.tex.needsUpdate = true;
  }

  // Place a train for a departure; returns phase
  placeJR(tr, line, dep, now) {
    const S = tr.S;
    const tArr = dep.t - 35000, tOpen = tArr + 4000, tClose = dep.t - 9000;
    const outer = line === 'yamaOuter';
    const zf = outer ? -107 : 112, sgn = outer ? 1 : -1; // outer comes from +z (south) heading north
    let front, phase;
    if (now < tArr) { front = zf + sgn * dist((tArr - now) / 1000, S.a, S.v); phase = 'approach'; }
    else if (now < dep.t) { front = zf; phase = 'stopped'; }
    else { front = zf - sgn * dist((now - dep.t) / 1000, S.a, S.v); phase = 'depart'; }
    const x = outer ? JR.outX : JR.inX, ry = outer ? Math.PI : 0;
    let vis = false;
    tr.cars.forEach((c, i) => {
      const z = front + sgn * (S.len / 2 + S.len * i);
      c.position.set(x, JR.rail, z); c.rotation.y = ry;
      c.visible = Math.abs(z) < 890; vis ||= c.visible;
    });
    tr.setOpen(now > tOpen && now < tClose);
    return { phase, vis, open: now > tOpen && now < tClose, tArr };
  }
  placeGinza(tr, dep, now) {
    const S = tr.S;
    const tArr = dep.t - 150000, tOpen = tArr + 6000, tClose = dep.t - 10000;
    let sS, phase;
    if (now < tArr) { sS = 2 + dist((tArr - now) / 1000, S.a, S.v); phase = 'approach'; }
    else if (now < dep.t) { sS = 2; phase = 'stopped'; }
    else { sS = 2 + dist((now - dep.t) / 1000, S.a, S.v); phase = 'depart'; }
    const off = dep.idx % 2 === 0 ? 7.5 : -7.5;
    let vis = false;
    tr.cars.forEach((c, i) => {
      const s = sS + S.len / 2 + S.len * i;
      const [x, z, hd] = ginzaAt(s, off);
      c.position.set(x, GZ.rail, z); c.rotation.y = hd;
      c.visible = s < GINZA_PORTAL_S + 6; vis ||= c.visible;
    });
    tr.setOpen(now > tOpen && now < tClose);
    return { phase, vis, open: now > tOpen && now < tClose, tArr, track: off > 0 ? 'W' : 'E' };
  }

  update(now, dt) {
    this.events.length = 0;
    // JR lines: trains visible from ~50 s before arrival to ~45 s after departure
    for (const line of ['yamaOuter', 'yamaInner']) {
      const deps = departures(line, now - 50000, now + 90000);
      const pool = this.pool[line];
      const used = new Set();
      let st = null;
      for (const d of deps) {
        let tr = pool.find((p) => p.dep === d.t) || pool.find((p) => p.dep === null && !used.has(p));
        if (!tr) continue;
        tr.dep = d.t; used.add(tr);
        const r = this.placeJR(tr, line, d, now);
        if (!r.vis && now > d.t) { tr.hide(); continue; }
        if (!st || (st.phase === 'depart' && r.phase !== 'depart')) st = { ...r, dep: d.t, dest: d.dest };
      }
      for (const p of pool) if (!used.has(p) && p.dep !== null) p.hide();
      const prev = this.status[line];
      this.status[line] = st;
      if (st && prev && prev.dep === st.dep && prev.phase !== st.phase) this.events.push({ line, phase: st.phase, dest: st.dest });
      if (st && prev && prev.dep === st.dep && !prev.open && st.open) this.events.push({ line, phase: 'open' });
      if (st && prev && prev.dep === st.dep && prev.open && !st.open) this.events.push({ line, phase: 'close' });
      if (st && (!prev || prev.dep !== st.dep) && st.phase === 'approach') this.events.push({ line, phase: 'announce', dest: st.dest });
      if (st && st.phase === 'stopped' && this.lastNow < st.dep - 17000 && now >= st.dep - 17000) this.events.push({ line, phase: 'melody' });
      const s = this.psd.find((p) => p.line === line);
      s.target = st && st.open ? 1 : 0;
    }
    // Ginza
    {
      const deps = departures('ginza', now - 60000, now + 200000);
      const pool = this.pool.ginza; const used = new Set();
      const open = { W: false, E: false };
      let st = null;
      for (const d of deps) {
        let tr = pool.find((p) => p.dep === d.t) || pool.find((p) => p.dep === null && !used.has(p));
        if (!tr) continue;
        tr.dep = d.t; used.add(tr);
        const r = this.placeGinza(tr, d, now);
        if (!r.vis && now > d.t) { tr.hide(); continue; }
        if (r.open) open[r.track] = true;
        if (!st && r.phase !== 'depart') st = { ...r, dep: d.t, dest: d.dest };
      }
      for (const p of pool) if (!used.has(p) && p.dep !== null) p.hide();
      const prev = this.status.ginza;
      this.status.ginza = st;
      if (st && (!prev || prev.dep !== st.dep) && st.phase === 'approach') this.events.push({ line: 'ginza', phase: 'announce', dest: st.dest });
      if (st && prev && prev.dep === st.dep && !prev.open && st.open) this.events.push({ line: 'ginza', phase: 'open' });
      if (st && prev && prev.dep === st.dep && prev.open && !st.open) this.events.push({ line: 'ginza', phase: 'close' });
      this.psd.find((p) => p.line === 'ginzaW').target = open.W ? 1 : 0;
      this.psd.find((p) => p.line === 'ginzaE').target = open.E ? 1 : 0;
    }
    for (const s of this.psd) {
      if (Math.abs(s.k - s.target) > 1e-3) { s.k += Math.sign(s.target - s.k) * Math.min(Math.abs(s.target - s.k), dt / 2.2); this.setLeaves(s, s.k); }
    }
    this.drawBoards(now);
    this.lastNow = now;
  }

  setNight(n) {
    for (const k in this.mat) this.mat[k].emissiveIntensity = 0.2 + n * 0.9;
  }

  // Train positions for the minimap
  markers() {
    const out = [];
    for (const k in this.pool) for (const tr of this.pool[k]) if (tr.dep !== null && tr.cars.some((c) => c.visible)) {
      const a = tr.cars[0].position, b = tr.cars[tr.cars.length - 1].position;
      out.push({ a: [a.x, a.z], b: [b.x, b.z], color: k === 'ginza' ? '#f39700' : '#80c241' });
    }
    return out;
  }
}

export { LINES };

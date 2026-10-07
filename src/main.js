import * as THREE from 'three';
import { Phys } from './phys.js';
import { City, CityPhys } from './city.js';
import { buildDetails } from './details.js';
import { buildStreet } from './street.js';
import { Sky } from './sky.js';
import { Rail } from './rail.js';
import { Crowd } from './crowd.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Hud } from './hud.js';
import { Sound } from './audio.js';
import { TRAVEL, MAP, YAMA, JR_PLAT, GINZA, at } from './geo.js';
import { jst, hhmmss } from './time.js';
import { LINES } from './timetable.js';
import { smooth } from './util.js';
import { Post } from './render.js';

const $ = (id) => document.getElementById(id);
const mobile = matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
if (mobile) document.body.classList.add('touch');

async function fonts() {
  if (!document.fonts) return;
  const want = ['700 20px "Noto Sans JP"', '900 20px "Noto Sans JP"', '20px "DotGothic16"', '20px "Dela Gothic One"'];
  await Promise.race([Promise.all(want.map((f) => document.fonts.load(f, '渋谷駅A1'))), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
}

async function boot(saved) {
  await fonts();
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  let quality = mobile ? 'low' : 'high';
  const applyQuality = () => {
    renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.75 : 1.25));
    renderer.shadowMap.enabled = quality === 'high' || !mobile;
    post.setQuality(quality);
    sky.dir.shadow.mapSize.setScalar(quality === 'high' ? 2048 : 1024);
    if (sky.dir.shadow.map) { sky.dir.shadow.map.dispose(); sky.dir.shadow.map = null; }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
    $('qHigh').setAttribute('aria-pressed', quality === 'high'); $('qLow').setAttribute('aria-pressed', quality !== 'high');
  };
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  $('app').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.15, 16000);
  let post = null;
  const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); post?.setSize(innerWidth, innerHeight); };
  addEventListener('resize', resize); resize();

  const phys = new Phys();
  const city = new City(scene, { lowTex: mobile });
  const sky = new Sky(scene, renderer);
  post = new Post(renderer, scene, camera);
  applyQuality();
  await city.loadGround();
  const details = buildDetails(scene, phys, city);
  let street = null;
  buildStreet(scene, city, new URL('../assets/plateau/frontage.json', import.meta.url).href).then((s) => (street = s)).catch((e) => console.warn('street layer', e));
  const cityPhys = new CityPhys(city, phys);
  const rail = new Rail(scene, details.boardSpots);
  const crowd = new Crowd(scene, mobile);
  const traffic = new Traffic(scene, mobile, (x, z) => city.ground(x, z));
  const player = new Player(camera, renderer.domElement, cityPhys);
  const ground = (x, z) => city.ground(x, z);
  // platforms: nearest point on the platform centre line
  const nearPath = (P, s0, s1, x, z) => { let bd = 1e9; for (let s = s0; s <= s1; s += 2) { const q = at(P, s); const d = Math.hypot(q.x - x, q.z - z); if (d < bd) bd = d; } return bd; };
  const onPlatform = (p) => {
    if (Math.abs(p.y - JR_PLAT.y) < 3 && nearPath(YAMA, JR_PLAT.s0, JR_PLAT.s1, p.x, p.z) < JR_PLAT.half + 2) return 'jr';
    if (Math.abs(p.y - GINZA.plat) < 3 && nearPath(GINZA.centre, GINZA.s0, GINZA.s1, p.x, p.z) < GINZA.half + 2) return 'gz';
    return null;
  };
  for (const t of TRAVEL) {
    if (t.jr !== undefined) { const q = at(YAMA, JR_PLAT.s0 + t.jr); t.p = [q.x, JR_PLAT.y + 0.05, q.z]; t.yaw = q.h; }
    else if (t.gz !== undefined) { const q = at(GINZA.centre, GINZA.s0 + t.gz); t.p = [q.x, GINZA.plat + 0.05, q.z]; t.yaw = q.h + Math.PI; }
    else if (!t.p[1]) t.p[1] = city.ground(t.p[0], t.p[2]) + 0.4;
  }
  const sound = new Sound();
  let offset = 0; // ms from real time
  const now = () => Date.now() + offset;
  // ---- world mode: real Shibuya (PLATEAU) or Google Photorealistic 3D Tiles ----
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
  let mode = 'real', pr = null, tilePhys = null, PM = null, prAttrAt = 0;
  const groundL = (x, z) => pr.ground(x, z);
  const realAttr = '3D都市モデル <b>Project PLATEAU</b> (国土交通省) · 航空写真 <b>国土地理院</b>';
  let photoCredits = [];
  const photoAttr = () => (photoCredits.length ? '<br>Street photos: ' + photoCredits.map((c) => c.replace(/[<>&]/g, '')).join(' · ') : '');
  const urlKey = new URLSearchParams(location.search).get('key');
  if (urlKey) store.set('shibuya.gkey', urlKey);
  $('gkey').value = store.get('shibuya.gkey') || '';
  async function placePhoto(t) {
    const [x, z] = PM.geo(t.ll[0], t.ll[1]);
    player.fly = true; player.teleport([x, t.fly || 140, z], t.yaw, t.pitch || 0);
    if (t.fly) { $('wFly').setAttribute('aria-pressed', 'true'); $('tFly').setAttribute('aria-pressed', 'true'); return; }
    hud.toast('3D タイル読込中…', 'Loading the 3D city around you…');
    let last = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 300));
      if (mode !== 'photo') return;
      const h = pr.surface(x, z, t.y ?? 0, t.mode || 'near', 45);
      if (h !== null && last !== null && Math.abs(h - last) < 0.5 && i > 4) { last = h; break; }
      last = h;
    }
    if (last !== null) { player.fly = false; player.teleport([x, last + 0.05, z], t.yaw, t.pitch || 0); }
    $('wFly').setAttribute('aria-pressed', String(player.fly)); $('tFly').setAttribute('aria-pressed', String(player.fly));
  }
  async function setMode(m) {
    if (m === 'photo') {
      const key = ($('gkey').value || store.get('shibuya.gkey') || '').trim();
      if (!key) { open('menu'); $('gkey').focus(); hud.toast('APIキーが必要です', 'Paste your Google Maps Platform API key, then press Use key.'); return; }
      store.set('shibuya.gkey', key);
      try { PM = PM || (await import('./photoreal.js')); } catch (e) { hud.toast('読み込み失敗', 'Could not load the 3D Tiles library: ' + e.message); return; }
      pr = pr || new PM.Photoreal(scene, camera, renderer, mobile);
      pr.onError = (e) => { hud.toast('Google 3D Tiles に接続できません', `Google 3D Tiles did not load (${String(e?.message || e).slice(0, 120)}). Check the key, that Map Tiles API is enabled, and that this page runs on your own site.`); setMode('real'); };
      pr.start(key);
      tilePhys = tilePhys || new PM.TilePhys(pr);
      mode = 'photo';
      document.body.classList.add('photo');
      city.root.visible = false; details.root.visible = false; if (street) street.root.visible = false; sky.farGroup.visible = false; traffic.sigGroup.visible = false;
      player.phys = tilePhys; player.canFly = true;
      post.aoOn = false;
      hud.zoneOverride = (p) => {
        let best = null, bd = 70;
        for (const t of PM.PHOTO_TRAVEL) { if (t.fly) continue; const [x, z] = PM.geo(t.ll[0], t.ll[1]); const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = t; } }
        return best ? { jp: best.jp, en: best.en + ' · Google 3D' } : { jp: '渋谷', en: 'Shibuya · Google 3D' };
      };
      close('menu'); close('map');
      placePhoto(PM.PHOTO_TRAVEL[0]);
    } else {
      pr?.stop();
      mode = 'real';
      document.body.classList.remove('photo');
      city.root.visible = true; details.root.visible = true; if (street) street.root.visible = true; sky.farGroup.visible = true; traffic.sigGroup.visible = true;
      player.phys = cityPhys; player.fly = false; player.canFly = false;
      post.aoOn = true;
      $('attr').hidden = false; $('attr').innerHTML = realAttr + photoAttr(); hud.zoneOverride = null; hud.zone = '';
      player.teleport(TRAVEL[0].p, TRAVEL[0].yaw, 0.02);
    }
    $('wReal').setAttribute('aria-pressed', String(mode === 'real')); $('wPhoto').setAttribute('aria-pressed', String(mode === 'photo'));
    buildTravelList();
  }

  const travel = (t) => {
    close('map'); close('menu');
    $('fade').classList.add('on');
    setTimeout(() => { if (t.ll) placePhoto(t); else player.teleport(t.p, t.yaw, t.pitch || 0); $('fade').classList.remove('on'); }, 360);
  };
  function buildTravelList() {
    const list = $('travelList'); list.innerHTML = '';
    for (const t of mode === 'photo' ? PM.PHOTO_TRAVEL : TRAVEL) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'trow';
      b.innerHTML = `<b>${t.jp}</b><span>${t.en}</span>`;
      b.addEventListener('click', () => travel(t));
      list.appendChild(b);
    }
  }
  const hud = new Hud(travel);
  hud.onPlatform = onPlatform;
  $('attr').hidden = false; $('attr').innerHTML = realAttr;
  if (saved && saved.p) player.teleport(saved.p, saved.h, saved.pitch); else player.teleport(TRAVEL[0].p, TRAVEL[0].yaw, 0.02);
  if (saved && typeof saved.offset === 'number') offset = saved.offset;
  window.claude?.hot?.snapshot?.(() => ({ p: [player.pos.x, player.pos.y, player.pos.z], h: player.h, pitch: player.pitch, offset, mode }));
  // stream the PLATEAU tiles, nearest first; the walk can start once the area around you is in
  const startP = saved && saved.p ? saved.p : TRAVEL[0].p;
  let ready = false;
  const goReady = () => { if (ready) return; ready = true; $('goBtn').disabled = false; $('goBtn').textContent = 'Start walking'; };
  city.load(startP, (f) => {
    if (!ready) $('goBtn').textContent = `Loading real Shibuya… ${Math.round(f * 100)}%`;
    if (f > 0.5) goReady();
    if (f >= 1) {
      goReady(); cityPhys.nearAt.set(1e9, 0, 0);
      city.addProjectors(renderer, new URL('../assets/photos/photos.json', import.meta.url).href)
        .then((c) => { photoCredits = c; if (mode === 'real') $('attr').innerHTML = realAttr + photoAttr(); })
        .catch((e) => console.warn('street photos', e));
    }
  }).catch((e) => { console.error(e); goReady(); hud.toast('読み込み失敗', 'Part of the 3D city could not be loaded: ' + e.message); });

  // ---- UI wiring ----
  const open = (id) => { $(id).hidden = false; player.enabled = false; if (document.pointerLockElement) document.exitPointerLock(); };
  function close(id) { $(id).hidden = true; if ($('menu').hidden && $('map').hidden && $('start').hidden) player.enabled = true; }
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close(b.dataset.close)));
  document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) close(m.id); }));
  $('menuBtn').addEventListener('click', () => open('menu'));
  $('mini').addEventListener('click', () => open(mode === 'photo' ? 'menu' : 'map'));
  addEventListener('keydown', (e) => {
    if (!$('start').hidden) return;
    if (e.code === 'KeyM' && mode === 'real') ($('map').hidden ? open('map') : close('map'));
    if (e.code === 'Escape') { if (!$('map').hidden) close('map'); else if ($('menu').hidden && !document.pointerLockElement) open('menu'); else close('menu'); }
    if (e.code === 'KeyE' || e.code === 'Enter') useInteract();
  });
  const setOffset = (steps) => {
    offset = steps * 30 * 60000;
    $('offset').value = steps;
    const h = Math.floor(Math.abs(steps) / 2), m = Math.abs(steps) % 2 ? '30' : '00';
    $('offLabel').textContent = `${steps < 0 ? '−' : steps > 0 ? '+' : '±'}${h}:${m} → ${hhmmss(now()).slice(0, 5)}`;
    $('liveBtn').setAttribute('aria-pressed', steps === 0);
  };
  $('offset').addEventListener('input', (e) => setOffset(+e.target.value));
  $('liveBtn').addEventListener('click', () => setOffset(0));
  $('sndBtn').addEventListener('click', () => { sound.start(); sound.setOn(!sound.on); $('sndBtn').setAttribute('aria-pressed', sound.on); $('sndBtn').textContent = sound.on ? 'Sound on' : 'Sound off'; });
  $('qHigh').addEventListener('click', () => { quality = 'high'; applyQuality(); });
  $('qLow').addEventListener('click', () => { quality = 'low'; applyQuality(); });
  $('tRun').addEventListener('click', () => { player.runToggle = !player.runToggle; $('tRun').setAttribute('aria-pressed', player.runToggle); });
  $('tJump').addEventListener('click', () => (player.jumpReq = true));
  $('wReal').addEventListener('click', () => setMode('real'));
  $('wPhoto').addEventListener('click', () => setMode('photo'));
  $('gkeySave').addEventListener('click', () => { store.set('shibuya.gkey', $('gkey').value.trim()); setMode('photo'); });
  const toggleFly = () => { if (mode !== 'photo') return; player.fly = !player.fly; player.vy = 0; $('wFly').setAttribute('aria-pressed', String(player.fly)); $('tFly').setAttribute('aria-pressed', String(player.fly)); };
  player.onFly = (f) => { $('wFly').setAttribute('aria-pressed', String(f)); $('tFly').setAttribute('aria-pressed', String(f)); };
  $('wFly').addEventListener('click', () => { toggleFly(); close('menu'); });
  $('tFly').addEventListener('click', toggleFly);
  for (const [id, k] of [['tUp', 'flyUp'], ['tDown', 'flyDown']]) {
    const el = $(id);
    el.addEventListener('pointerdown', () => (player[k] = true));
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => (player[k] = false));
  }
  $('prompt').addEventListener('click', () => useInteract());
  let curInteract = null;
  function useInteract() {
    if (!curInteract) return;
    const t = curInteract;
    $('fade').classList.add('on');
    sound.chime(0.06);
    setTimeout(() => { player.teleport(t.to, t.yaw, t.to[1] > 100 ? -0.3 : 0); $('fade').classList.remove('on'); }, 900);
  }
  $('goBtn').addEventListener('click', () => {
    $('start').hidden = true; document.body.classList.remove('pre'); player.enabled = true; sound.start();
    if (!mobile) { try { const r = renderer.domElement.requestPointerLock?.(); r?.catch?.(() => {}); } catch { /* optional */ } }
  });
  if (saved && saved.p) { goReady(); $('start').hidden = true; document.body.classList.remove('pre'); player.enabled = true; }
  setOffset(Math.round(offset / 1800000));

  // ---- loop ----
  const clock = new THREE.Clock();
  let screenT = 0, screenIdx = 0;
  const tmpV = new THREE.Vector3();
  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    const t = now();
    const P = jst(t);
    player.update(dt);
    if (mode === 'real') city.update(player.pos);
    sky.update(t, camera.position, dt, 0.35);
    const night = sky.night;
    if (mode === 'photo' && pr) {
      scene.fog.density *= 0.35;
      pr.update(t, night, sky.golden || 0);
      pr.resetBudget(mobile ? 30 : 90);
      const rt = performance.now();
      if (rt - prAttrAt > 1000) { prAttrAt = rt; const a = pr.attribution(); $('attr').hidden = false; $('attr').innerHTML = `<b>Google Maps</b>${a ? ' · ' + a.replace(/[<>&]/g, '') : ''}`; }
    }
    const photo = mode === 'photo' && pr;
    sky.dir.castShadow = renderer.shadowMap.enabled && night < 0.85;
    city.setNight(night);
    street?.setNight(night);
    for (const m of details.platformMats) m.emissiveIntensity = night * 0.3;
    for (const m of details.lampMats) m.color.setScalar(0.75 + night * 0.5);
    for (const m of details.signMats) m.color.setScalar(0.85 - night * 0.1);
    rail.setNight(night);
    // big screens: refresh a couple per frame (~8 fps each)
    screenT += dt;
    if (screenT > 0.04) {
      screenT = 0;
      const sc = details.screens[screenIdx++ % details.screens.length];
      if (!photo && sc && tmpV.set(sc.x, sc.y, sc.z).distanceTo(camera.position) < 900) sc.s.draw(performance.now() / 1000, hhmmss(t).slice(0, 5));
    }
    rail.update(t, dt);
    const hour = P.h + P.mi / 60;
    const density = hour < 1 ? 0.45 : hour < 5 ? 0.12 : hour < 7 ? 0.35 : hour < 10 ? 0.85 : hour < 17 ? 0.9 : hour < 22 ? 1 : 0.7;
    const sig = crowd.update(dt, t, camera.position, density, photo ? { radius: 110, ground: groundL } : { ground });
    traffic.update(dt, t, night, photo ? { radius: 110, ground: groundL } : {});
    // events: trains
    const pp = player.pos;
    const plat = onPlatform(pp);
    const onJR = plat === 'jr' || Math.hypot(pp.x - 45, pp.z - 38) < 25, onGZ = plat === 'gz';
    for (const e of rail.events) {
      const near = e.line === 'ginza' ? onGZ : onJR;
      if (!near) continue;
      const L = LINES[e.line];
      const track = e.line === 'yamaOuter' ? '2番線' : e.line === 'yamaInner' ? '1番線' : '';
      if (e.phase === 'announce') {
        sound.chime(0.1);
        hud.toast(`まもなく${track}に ${L.name}${L.dir ? ' ' + L.dir : ''} ${e.dest} が参ります`, `A ${L.en.replace(' for ', ' train for ')} is arriving${track ? ' at track ' + track[0] : ''}. Please stand behind the yellow line.`);
      } else if (e.phase === 'open') sound.doors(0.08);
      else if (e.phase === 'melody') sound.melody(0.06);
      else if (e.phase === 'close') sound.doors(0.06);
    }
    // interaction prompt
    curInteract = null;
    if (!photo) for (const it of details.interact) if (Math.abs(pp.y - it.y) < 3 && Math.hypot(pp.x - it.x, pp.z - it.z) < it.r) curInteract = it;
    const prEl = $('prompt');
    if (curInteract) { prEl.hidden = false; prEl.innerHTML = `<kbd>${mobile ? 'TAP' : 'E'}</kbd>${curInteract.jp}  ·  ${curInteract.en}`; } else prEl.hidden = true;
    // audio mix
    let train = 0, trainSpeed = 0;
    if (!photo) for (const k in rail.pool) for (const tr of rail.pool[k]) for (const c of tr.cars) if (c.visible) {
      const d = c.position.distanceTo(camera.position);
      const v = Math.max(0, 1 - d / 140);
      if (v > train) { train = v; trainSpeed = Math.min(30, tr.speedEst || 0); }
    }
    for (const k in rail.pool) for (const tr of rail.pool[k]) {
      const c = tr.cars[0];
      const prev = tr._prev || c.position.clone();
      tr.speedEst = dt > 0 ? prev.distanceTo(c.position) / dt : 0;
      tr._prev = c.position.clone();
    }
    const dCross = Math.hypot(pp.x, pp.z);
    sound.update(dt, {
      busy: (pp.y < 20 ? 1 - smooth(60, 400, Math.hypot(pp.x - 30, pp.z - 20)) : 0.25) * (0.4 + density * 0.6),
      crowd: pp.y < 20 ? density * (1 - smooth(20, 140, dCross)) : 0,
      train: train * Math.min(1, trainSpeed / 3 + 0.15), trainSpeed,
      walk: sig.ped === 'go', crossNear: pp.y < 3 ? 1 - smooth(15, 70, dCross) : 0,
    });
    hud.update(t, player, rail, offset, sig);
    if (!$('map').hidden) {
      const yd = $('youDot');
      yd.style.left = ((pp.x - MAP.x0) / (MAP.x1 - MAP.x0) * 100) + '%'; yd.style.top = ((pp.z - MAP.z0) / (MAP.z1 - MAP.z0) * 100) + '%';
    }
    post.render(night, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__shibuya = { player, rail, scene, renderer, camera, setOffset, travel, sky, city, details, crowd, traffic, post, setMode, get pr() { return pr; } };
  buildTravelList();
  if (urlKey || (saved && saved.mode === 'photo')) setMode('photo');
}

const hot = window.claude?.hot;
const start = (d) => boot(d).catch((e) => { console.error(e); $('goBtn').textContent = 'Could not start WebGL: ' + e.message; });
if (hot?.ready) hot.ready(start); else start(hot?.data ?? {});

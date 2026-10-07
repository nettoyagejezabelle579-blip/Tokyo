import * as THREE from 'three';
import { Phys } from './phys.js';
import { buildWorld } from './world.js';
import { Sky } from './sky.js';
import { Rail } from './rail.js';
import { Crowd } from './crowd.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Hud } from './hud.js';
import { Sound } from './audio.js';
import { TRAVEL, JR, GZ } from './layout.js';
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
  const world = buildWorld(scene, phys);
  const sky = new Sky(scene, renderer);
  post = new Post(renderer, scene, camera);
  applyQuality();
  const rail = new Rail(scene, world);
  const crowd = new Crowd(scene, mobile);
  const traffic = new Traffic(scene, mobile);
  const player = new Player(camera, renderer.domElement, phys);
  const sound = new Sound();
  let offset = 0; // ms from real time
  const now = () => Date.now() + offset;
  // ---- world mode: classic procedural city or Google Photorealistic 3D Tiles ----
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
  let mode = 'classic', pr = null, tilePhys = null, PM = null, prAttrAt = 0;
  const overlay = { yaw: (+(store.get('shibuya.alignRot') ?? 15)) * Math.PI / 180 };
  const applyOverlay = () => {
    const y = mode === 'photo' ? overlay.yaw : 0;
    for (const g of [crowd.group, traffic.group]) { g.rotation.y = y; }
  };
  const groundL = (x, z) => { const c = Math.cos(overlay.yaw), s = Math.sin(overlay.yaw); return pr.ground(x * c + z * s, -x * s + z * c); };
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
      pr.onError = (e) => { hud.toast('Google 3D Tiles に接続できません', `Google 3D Tiles did not load (${String(e?.message || e).slice(0, 120)}). Check the key, that Map Tiles API is enabled, and that this page runs on your own site.`); setMode('classic'); };
      pr.start(key);
      tilePhys = tilePhys || new PM.TilePhys(pr);
      mode = 'photo';
      document.body.classList.add('photo');
      world.root.visible = false; rail.group.visible = false; sky.farGroup.visible = false; traffic.sigGroup.visible = false;
      player.phys = tilePhys; player.canFly = true;
      post.aoOn = false;
      applyOverlay();
      hud.zoneOverride = (p) => {
        let best = null, bd = 70;
        for (const t of PM.PHOTO_TRAVEL) { if (t.fly) continue; const [x, z] = PM.geo(t.ll[0], t.ll[1]); const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = t; } }
        return best ? { jp: best.jp, en: best.en + ' · Google 3D' } : { jp: '渋谷', en: 'Shibuya · Google 3D' };
      };
      close('menu'); close('map');
      placePhoto(PM.PHOTO_TRAVEL[0]);
    } else {
      pr?.stop();
      mode = 'classic';
      document.body.classList.remove('photo');
      world.root.visible = true; rail.group.visible = true; sky.farGroup.visible = true; traffic.sigGroup.visible = true;
      player.phys = phys; player.fly = false; player.canFly = false;
      post.aoOn = true;
      applyOverlay();
      $('attr').hidden = true; hud.zoneOverride = null; hud.zone = '';
      player.teleport(TRAVEL[0].p, TRAVEL[0].yaw, 0.02);
    }
    $('wClassic').setAttribute('aria-pressed', String(mode === 'classic')); $('wPhoto').setAttribute('aria-pressed', String(mode === 'photo'));
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
  const hud = new Hud(world, travel);
  if (saved && saved.p) player.teleport(saved.p, saved.h, saved.pitch); else player.teleport(TRAVEL[0].p, TRAVEL[0].yaw, 0.02);
  if (saved && typeof saved.offset === 'number') offset = saved.offset;
  window.claude?.hot?.snapshot?.(() => ({ p: [player.pos.x, player.pos.y, player.pos.z], h: player.h, pitch: player.pitch, offset, mode }));

  // ---- UI wiring ----
  const open = (id) => { $(id).hidden = false; player.enabled = false; if (document.pointerLockElement) document.exitPointerLock(); };
  function close(id) { $(id).hidden = true; if ($('menu').hidden && $('map').hidden && $('start').hidden) player.enabled = true; }
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close(b.dataset.close)));
  document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) close(m.id); }));
  $('menuBtn').addEventListener('click', () => open('menu'));
  $('mini').addEventListener('click', () => open(mode === 'photo' ? 'menu' : 'map'));
  addEventListener('keydown', (e) => {
    if (!$('start').hidden) return;
    if (e.code === 'KeyM' && mode === 'classic') ($('map').hidden ? open('map') : close('map'));
    if (e.code === 'Escape') { if (!$('map').hidden) close('map'); else if ($('menu').hidden && !document.pointerLockElement) open('menu'); else close('menu'); }
    if (e.code === 'KeyE' || e.code === 'Enter') useInteract();
  });
  const setOffset = (steps) => {
    offset = steps * 30 * 60000;
    $('offset').value = steps;
    const h = Math.floor(Math.abs(steps) / 2), m = Math.abs(steps) % 2 ? '30' : '00';
    $('offLabel').textContent = `${steps < 0 ? '−' : steps > 0 ? '+' : '±'}${h}:${m} → ${hhmmss(now()).slice(0, 5)}`;
    $('liveBtn').setAttribute('aria-pressed', steps === 0);
    world.setSeason(jst(now()).mo, jst(now()).d);
  };
  $('offset').addEventListener('input', (e) => setOffset(+e.target.value));
  $('liveBtn').addEventListener('click', () => setOffset(0));
  $('sndBtn').addEventListener('click', () => { sound.start(); sound.setOn(!sound.on); $('sndBtn').setAttribute('aria-pressed', sound.on); $('sndBtn').textContent = sound.on ? 'Sound on' : 'Sound off'; });
  $('qHigh').addEventListener('click', () => { quality = 'high'; applyQuality(); });
  $('qLow').addEventListener('click', () => { quality = 'low'; applyQuality(); });
  $('tRun').addEventListener('click', () => { player.runToggle = !player.runToggle; $('tRun').setAttribute('aria-pressed', player.runToggle); });
  $('tJump').addEventListener('click', () => (player.jumpReq = true));
  $('wClassic').addEventListener('click', () => setMode('classic'));
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
  $('alignRot').value = Math.round(overlay.yaw * 180 / Math.PI);
  $('alignRot').addEventListener('input', (e) => { overlay.yaw = +e.target.value * Math.PI / 180; store.set('shibuya.alignRot', e.target.value); applyOverlay(); });
  $('alignReset').addEventListener('click', () => { $('alignRot').value = 15; overlay.yaw = 15 * Math.PI / 180; store.set('shibuya.alignRot', '15'); applyOverlay(); });
  $('prompt').addEventListener('click', () => useInteract());
  let curInteract = null;
  function useInteract() {
    if (!curInteract) return;
    const t = curInteract;
    $('fade').classList.add('on');
    sound.chime(0.06);
    setTimeout(() => { player.teleport(t.to, t.yaw, t.to[1] > 100 ? -0.3 : 0); $('fade').classList.remove('on'); }, 900);
  }
  $('goBtn').disabled = false; $('goBtn').textContent = 'Start walking';
  $('goBtn').addEventListener('click', () => {
    $('start').hidden = true; document.body.classList.remove('pre'); player.enabled = true; sound.start();
    if (!mobile) { try { const r = renderer.domElement.requestPointerLock?.(); r?.catch?.(() => {}); } catch { /* optional */ } }
  });
  if (saved && saved.p) { $('start').hidden = true; document.body.classList.remove('pre'); player.enabled = true; }
  setOffset(Math.round(offset / 1800000));

  // ---- loop ----
  const clock = new THREE.Clock();
  let screenT = 0, screenIdx = 0, lastDay = '';
  const tmpV = new THREE.Vector3();
  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    const t = now();
    const P = jst(t);
    const dayKey = `${P.mo}-${P.d}`;
    if (dayKey !== lastDay) { lastDay = dayKey; world.setSeason(P.mo, P.d); }
    player.update(dt);
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
    for (const m of world.winMats) m.emissiveIntensity = night * 0.75;
    for (const m of world.shopMats) m.emissiveIntensity = 0.12 + night * 0.42;
    for (const m of world.signMats) m.color.setScalar(0.8 - night * 0.1);
    world.pools.opacity = night * 0.85;
    for (const m of world.groundMats) m.emissiveIntensity = night * 0.22;
    world.M.platform.emissiveIntensity = night * 0.35;
    for (const b of world.beaconMeshes) b.visible = night > 0.3 && (performance.now() % 1500) < 750;
    world.M.glow.color.setScalar(0.8 + night * 0.6);
    world.M.ceiling.emissiveIntensity = 0.35 + night * 0.3;
    rail.setNight(night);
    // big screens: refresh a couple per frame (~8 fps each)
    screenT += dt;
    if (screenT > 0.04) {
      screenT = 0;
      const sc = world.screens[screenIdx++ % world.screens.length];
      if (!photo && sc && tmpV.set(sc.x, sc.y, sc.z).distanceTo(camera.position) < 900) sc.s.draw(performance.now() / 1000, hhmmss(t).slice(0, 5));
    }
    rail.update(t, dt);
    const hour = P.h + P.mi / 60;
    const density = hour < 1 ? 0.45 : hour < 5 ? 0.12 : hour < 7 ? 0.35 : hour < 10 ? 0.85 : hour < 17 ? 0.9 : hour < 22 ? 1 : 0.7;
    const sig = crowd.update(dt, t, camera.position, density, photo ? { radius: 110, ground: groundL } : {});
    traffic.update(dt, t, night, photo ? { radius: 110, ground: groundL } : {});
    // events: trains
    const pp = player.pos;
    let onJR = pp.y > 6 && pp.x > JR.x0 && pp.x < JR.x1 && pp.z > -130 && pp.z < 130;
    let onGZ = pp.y > 10 && pp.x > 140 && pp.x < 212 && pp.z > -130 && pp.z < -8;
    if (photo) {
      // real platform locations (approximate) – announcements play when you are at the station
      const [jx, jz] = PM.geo(35.6582, 139.7016), [gx, gz] = PM.geo(35.6588, 139.7031);
      onJR = Math.hypot(pp.x - jx, pp.z - jz) < 90; onGZ = Math.hypot(pp.x - gx, pp.z - gz) < 70;
    }
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
    for (const e of player.events) if (e === 'gate') sound.gate();
    // interaction prompt
    curInteract = null;
    if (!photo) for (const it of world.interact) if (Math.abs(pp.y - it.y) < 3 && Math.hypot(pp.x - it.x, pp.z - it.z) < it.r) curInteract = it;
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
      yd.style.left = ((pp.x + 480) / 960 * 100) + '%'; yd.style.top = ((pp.z + 490) / 1090 * 100) + '%';
    }
    post.render(night, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__shibuya = { player, rail, scene, renderer, camera, setOffset, travel, sky, world, post, setMode, get pr() { return pr; } };
  buildTravelList();
  if (urlKey || (saved && saved.mode === 'photo')) setMode('photo');
}

const hot = window.claude?.hot;
const start = (d) => boot(d).catch((e) => { console.error(e); $('goBtn').textContent = 'Could not start WebGL: ' + e.message; });
if (hot?.ready) hot.ready(start); else start(hot?.data ?? {});

import * as THREE from 'three';
import { clamp } from './util.js';

// First-person walker. Heading h: forward = (sin h, cos h).
export class Player {
  constructor(camera, dom, phys) {
    this.cam = camera; this.dom = dom; this.phys = phys;
    this.pos = new THREE.Vector3(20, 0, 21);
    this.h = -2.5; this.pitch = 0.05;
    this.vel = new THREE.Vector3(); this.vy = 0; this.ground = true;
    this.keys = new Set(); this.runToggle = false; this.jumpReq = false;
    this.joy = { x: 0, y: 0 };
    this.bob = 0; this.enabled = false;
    this.events = [];
    camera.rotation.order = 'YXZ';
    this.bind();
  }
  teleport(p, h, pitch = 0) {
    this.pos.set(p[0], p[1], p[2]); this.h = h; this.pitch = pitch; this.vel.set(0, 0, 0); this.vy = 0;
  }
  bind() {
    const d = this.dom;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.jumpReq = true; e.preventDefault(); }
      if (e.code === 'KeyF' && this.canFly) { this.fly = !this.fly; this.vy = 0; this.onFly?.(this.fly); }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    // mouse look: pointer lock when available, otherwise drag
    let drag = false, lx = 0, ly = 0;
    d.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      drag = true; lx = e.clientX; ly = e.clientY;
      if (!document.pointerLockElement && !this.noLock) {
        try { const r = d.requestPointerLock?.(); if (r && r.catch) r.catch(() => { this.noLock = true; }); } catch { this.noLock = true; }
      }
    });
    window.addEventListener('mouseup', () => (drag = false));
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === d) { if (Math.abs(e.movementX) < 160 && Math.abs(e.movementY) < 160) this.look(e.movementX, e.movementY, 0.0022); }
      else if (drag) { this.look(e.clientX - lx, e.clientY - ly, 0.004); lx = e.clientX; ly = e.clientY; }
    });
    // touch: left = joystick, right = look
    const joyEl = document.getElementById('joy'), knob = document.getElementById('knob');
    this.touches = new Map();
    d.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        const left = t.clientX < window.innerWidth * 0.42 && t.clientY > window.innerHeight * 0.35;
        this.touches.set(t.identifier, { left, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY });
        if (left && joyEl) { joyEl.style.left = t.clientX - 60 + 'px'; joyEl.style.top = t.clientY - 60 + 'px'; joyEl.hidden = false; }
      }
      e.preventDefault();
    }, { passive: false });
    d.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        const s = this.touches.get(t.identifier); if (!s) continue;
        if (s.left) {
          let dx = t.clientX - s.x0, dy = t.clientY - s.y0; const m = Math.hypot(dx, dy);
          if (m > 55) { dx *= 55 / m; dy *= 55 / m; }
          this.joy.x = dx / 55; this.joy.y = -dy / 55;
          if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
        } else { this.look(t.clientX - s.x, t.clientY - s.y, 0.0055); }
        s.x = t.clientX; s.y = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        const s = this.touches.get(t.identifier);
        if (s && s.left) { this.joy.x = this.joy.y = 0; if (knob) knob.style.transform = ''; if (joyEl) joyEl.hidden = true; }
        this.touches.delete(t.identifier);
      }
    };
    d.addEventListener('touchend', end); d.addEventListener('touchcancel', end);
  }
  updateFly(dt, ix, iz) {
    const k = this.keys, p = this.pos;
    const fast = k.has('ShiftLeft') || k.has('ShiftRight') || this.runToggle;
    const sp = fast ? 60 : 16;
    const ch = Math.cos(this.h), sh = Math.sin(this.h), cp = Math.cos(this.pitch), spch = Math.sin(this.pitch);
    let vy = (k.has('Space') || this.flyUp ? 1 : 0) - (k.has('KeyC') || k.has('KeyQ') || this.flyDown ? 1 : 0);
    const tx = (sh * cp * iz - ch * ix) * sp, tz = (ch * cp * iz + sh * ix) * sp, ty = spch * iz * sp + vy * sp * 0.6;
    this.vel.x += (tx - this.vel.x) * Math.min(1, dt * 4); this.vel.z += (tz - this.vel.z) * Math.min(1, dt * 4); this.vy += (ty - this.vy) * Math.min(1, dt * 4);
    p.x += this.vel.x * dt; p.z += this.vel.z * dt; p.y = Math.min(1500, p.y + this.vy * dt);
    const f = this.phys.floorAt(p.x, p.z, p.y + 2, 3);
    if (p.y < f) p.y = f;
    this.jumpReq = false; this.events.length = 0; this.ground = false;
    this.cam.position.set(p.x, p.y + 1.6, p.z);
    this.cam.rotation.set(this.pitch, this.h + Math.PI, 0);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
  }
  look(dx, dy, s) {
    this.h -= dx * s; this.pitch = clamp(this.pitch - dy * s, -1.45, 1.45);
  }
  update(dt) {
    const k = this.keys;
    let ix = 0, iz = 0;
    if (this.enabled) {
      if (k.has('KeyW') || k.has('ArrowUp')) iz += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) iz -= 1;
      if (k.has('KeyA')) ix -= 1;
      if (k.has('KeyD')) ix += 1;
      if (k.has('ArrowLeft')) this.h += dt * 1.8;
      if (k.has('ArrowRight')) this.h -= dt * 1.8;
      ix += this.joy.x; iz += this.joy.y;
    }
    const m = Math.hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; }
    if (this.fly) { this.updateFly(dt, ix, iz); return; }
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || this.runToggle || Math.hypot(this.joy.x, this.joy.y) > 0.97 && this.runToggle;
    const speed = run ? 7.0 : 3.0;
    const sh = Math.sin(this.h), ch = Math.cos(this.h);
    const tx = (sh * iz - ch * ix) * speed, tz = (ch * iz + sh * ix) * speed;
    const a = this.ground ? 12 : 3;
    this.vel.x += (tx - this.vel.x) * Math.min(1, a * dt);
    this.vel.z += (tz - this.vel.z) * Math.min(1, a * dt);
    const p = this.pos;
    const steps = Math.max(1, Math.ceil(Math.hypot(this.vel.x, this.vel.z) * dt / 0.25));
    const px = p.x, pz = p.z;
    for (let i = 0; i < steps; i++) {
      p.x += this.vel.x * dt / steps; p.z += this.vel.z * dt / steps;
      this.phys.collide(p, 0.32, 1.7);
      const f = this.phys.floorAt(p.x, p.z, p.y);
      if (this.ground && f < p.y && p.y - f < 0.75 && this.vy <= 0) p.y = f;
      else if (f > p.y) p.y = f;
    }
    // gravity
    const f = this.phys.floorAt(p.x, p.z, p.y);
    if (this.jumpReq && this.ground) { this.vy = 5.2; this.ground = false; }
    this.jumpReq = false;
    if (p.y > f + 0.001 || this.vy > 0) {
      this.vy -= 22 * dt; p.y += this.vy * dt;
      if (p.y <= f) { p.y = f; this.vy = 0; this.ground = true; } else this.ground = false;
    } else { this.ground = true; this.vy = 0; }
    // gate crossing beep
    this.events.length = 0;
    const crossed = (gx) => (px - gx) * (p.x - gx) < 0;
    if (crossed(92) && p.z > 26 && p.z < 60.5 && p.y < 2) this.events.push('gate');
    if (crossed(186) && p.z > -20 && p.z < -14 && p.y > 10) this.events.push('gate');
    // camera
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.ground && hs > 0.5) this.bob += hs * dt * 2.2;
    const bobY = this.ground ? Math.sin(this.bob * 2) * 0.03 * Math.min(1, hs / 3) : 0;
    this.cam.position.set(p.x, p.y + 1.6 + bobY, p.z);
    this.cam.rotation.set(this.pitch, this.h + Math.PI, 0);
    this.speed = hs;
  }
}

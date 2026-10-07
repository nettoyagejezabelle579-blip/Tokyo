// Synthesised soundscape (WebAudio). Starts only after a user gesture.
export class Sound {
  constructor() { this.ctx = null; this.on = true; }
  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0; this.master.connect(c.destination);
    const noise = (sec, brown) => {
      const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
      return b;
    };
    const loop = (buf, filterType, freq, q = 0.7) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.master); s.start();
      return { g, f };
    };
    this.city = loop(noise(4, true), 'lowpass', 520);
    this.crowd = loop(noise(3, false), 'bandpass', 900, 0.6);
    this.rumble = loop(noise(3, true), 'lowpass', 160);
    // motor whine
    this.motor = c.createOscillator(); this.motor.type = 'sawtooth'; this.motor.frequency.value = 300;
    const mf = c.createBiquadFilter(); mf.type = 'bandpass'; mf.frequency.value = 900; mf.Q.value = 3;
    this.motorG = c.createGain(); this.motorG.gain.value = 0;
    this.motor.connect(mf); mf.connect(this.motorG); this.motorG.connect(this.master); this.motor.start();
    this.nextChirp = 0;
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.1); }
  tone(freq, t0, dur, vol = 0.15, type = 'sine', slide = 0) {
    if (!this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  gate() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(2350, t, 0.09, 0.12, 'square'); }
  chime(vol = 0.12) { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(988, t, 0.9, vol, 'triangle'); this.tone(784, t + 0.45, 1.2, vol, 'triangle'); }
  doors(vol = 0.1) { if (!this.ctx) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) { this.tone(1320, t + i * 0.5, 0.22, vol, 'sine'); this.tone(990, t + i * 0.5 + 0.2, 0.25, vol, 'sine'); } }
  // short original platform jingle (not a real station melody)
  melody(vol = 0.08) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, n = [659, 784, 880, 1047, 880, 784, 880, 988, 1047, 1175, 1047, 880];
    n.forEach((f, i) => { this.tone(f, t + i * 0.22, 0.32, vol, 'triangle'); this.tone(f / 2, t + i * 0.22, 0.3, vol * 0.4, 'sine'); });
  }
  update(dt, o) {
    if (!this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    const set = (g, v) => g.gain.setTargetAtTime(v, now, 0.25);
    set(this.city.g, 0.06 + 0.16 * o.busy);
    set(this.crowd.g, 0.05 * o.crowd);
    set(this.rumble.g, 0.5 * o.train);
    set(this.motorG, 0.05 * o.train * Math.min(1, o.trainSpeed / 8));
    this.motor.frequency.setTargetAtTime(180 + o.trainSpeed * 28, now, 0.2);
    // "piyo-piyo" pedestrian signal sound while walking is allowed near the crossing
    if (o.walk && o.crossNear > 0 && now > this.nextChirp) {
      const v = 0.05 * o.crossNear;
      this.tone(2700, now, 0.09, v, 'sine', 0.72); this.tone(2700, now + 0.16, 0.09, v, 'sine', 0.72);
      this.nextChirp = now + 1.1;
    }
  }
}

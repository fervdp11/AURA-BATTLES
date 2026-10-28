// Motor de audio 100% sintetizado (WebAudio): efectos, música phonk procedural y voces (Web Speech).

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null; this.enabled = false;
    this.vol = { music: 0.55, sfx: 0.8 };
    this.voiceOn = true; this.announcerOn = true;
    this.track = null; this.trackId = null;
    this.lastVoice = 0;
    this.lastPlay = {};
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createDynamicsCompressor();
    this.master.threshold.value = -12; this.master.knee.value = 10; this.master.ratio.value = 4;
    this.master.attack.value = 0.003; this.master.release.value = 0.2;
    this.out = ctx.createGain(); this.out.gain.value = 0.9;
    this.master.connect(this.out); this.out.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.vol.music * 0.7;
    this.musicFilter = ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 18000;
    this.musicBus.connect(this.musicFilter); this.musicFilter.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.vol.sfx;
    this.sfxBus.connect(this.master);
    // reverb sintética
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.reverb.buffer = ir;
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.35;
    this.reverb.connect(this.revGain); this.revGain.connect(this.master);
    // ruido blanco
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    // saturación
    this.dist = this.makeDist(28);
    this.enabled = true;
    if (this.pendingTrack) { const t = this.pendingTrack; this.pendingTrack = null; this.music(t); }
  }

  makeDist(k) {
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = (3 + k) * x * 20 * Math.PI / 180 / (Math.PI + k * Math.abs(x)); }
    return curve;
  }

  setVolumes(music, sfx) {
    this.vol.music = music; this.vol.sfx = sfx;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(music * 0.7, this.ctx.currentTime, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
  }

  muffle(on) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(on ? 700 : 18000, this.ctx.currentTime, 0.12);
  }
  duck(t = 0.8, amt = 0.3) {
    if (!this.ctx) return;
    const g = this.musicBus.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(this.vol.music * 0.7 * amt, now, 0.03);
    g.setTargetAtTime(this.vol.music * 0.7, now + t, 0.3);
  }

  // ---------- primitivas ----------
  env(g, t, a, peak, dur, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + dur);
  }
  osc(type, f0, f1, t, dur, peak, dest, opts = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + (opts.glide || dur));
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    this.env(g, t, opts.attack || 0.004, peak, dur);
    let node = o;
    if (opts.filter) { const fl = ctx.createBiquadFilter(); fl.type = opts.filter; fl.frequency.value = opts.freq || 1000; fl.Q.value = opts.q || 1; node.connect(fl); node = fl; }
    if (opts.dist) { const ws = ctx.createWaveShaper(); ws.curve = this.dist; node.connect(ws); node = ws; }
    node.connect(g); g.connect(dest || this.sfxBus);
    if (opts.rev) { const s = ctx.createGain(); s.gain.value = opts.rev; g.connect(s); s.connect(this.reverb); }
    o.start(t); o.stop(t + (opts.attack || 0.004) + dur + 0.05);
    return o;
  }
  noise(t, dur, peak, type, f0, f1, dest, opts = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = opts.rate || 1;
    const fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.Q.value = opts.q || 1;
    fl.frequency.setValueAtTime(f0 || 1000, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this.env(g, t, opts.attack || 0.002, peak, dur);
    src.connect(fl); fl.connect(g); g.connect(dest || this.sfxBus);
    if (opts.rev) { const s = ctx.createGain(); s.gain.value = opts.rev; g.connect(s); s.connect(this.reverb); }
    src.start(t, Math.random() * 1.5); src.stop(t + (opts.attack || 0.002) + dur + 0.05);
  }

  // ---------- efectos ----------
  play(name, opts = {}) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // limitador anti-saturación por tipo
    if (this.lastPlay[name] && now - this.lastPlay[name] < (opts.minGap ?? 0.025)) return;
    this.lastPlay[name] = now;
    const t = now + 0.005;
    const p = opts.pitch || 1;
    const S = SFX[name];
    if (S) S.call(this, t, p, opts);
  }

  // ---------- voces ----------
  speak(text, opts = {}) {
    if (!text || !this.voiceOn || typeof speechSynthesis === 'undefined') return;
    const now = performance.now();
    if (!opts.force && now - this.lastVoice < (opts.gap ?? 700)) return;
    this.lastVoice = now;
    try {
      if (opts.interrupt !== false) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.lang || 'en-US';
      u.rate = opts.rate ?? 1.12; u.pitch = opts.pitch ?? 1; u.volume = Math.min(1, this.vol.sfx * 1.1);
      const vs = speechSynthesis.getVoices();
      const v = vs.find(x => x.lang && x.lang.startsWith(u.lang.slice(0, 2)));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* sin síntesis de voz */ }
  }
  announce(text, opts = {}) {
    if (!this.announcerOn) return;
    this.speak(text, { lang: 'es-ES', rate: 0.95, pitch: 0.55, force: true, ...opts });
  }

  // ---------- música ----------
  music(id) {
    if (!this.ctx || !this.enabled) { this.pendingTrack = id; return; }
    if (this.trackId === id) return;
    this.stopMusic();
    const def = TRACKS[id];
    if (!def) return;
    this.trackId = id;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 0.8);
    g.connect(this.musicBus);
    const tr = { def, gain: g, step: 0, next: this.ctx.currentTime + 0.1, timer: null };
    tr.timer = setInterval(() => this.schedule(tr), 25);
    this.track = tr;
  }
  stopMusic() {
    const tr = this.track;
    if (!tr) return;
    clearInterval(tr.timer);
    const now = this.ctx.currentTime;
    tr.gain.gain.cancelScheduledValues(now);
    tr.gain.gain.setTargetAtTime(0.0001, now, 0.15);
    setTimeout(() => { try { tr.gain.disconnect(); } catch (e) { /* ya desconectado */ } }, 1200);
    this.track = null; this.trackId = null;
  }
  schedule(tr) {
    if (!this.ctx) return;
    const d = tr.def;
    const stepDur = 60 / d.bpm / 4;
    while (tr.next < this.ctx.currentTime + 0.12) {
      this.playStep(tr, tr.step, tr.next, stepDur);
      tr.step = (tr.step + 1) % (d.bars * 16);
      tr.next += stepDur;
    }
  }
  playStep(tr, step, t, sd) {
    const d = tr.def, dest = tr.gain;
    const bar = Math.floor(step / 16), s = step % 16;
    const pat = (arr) => arr[bar % arr.length][s];
    const root = d.root;
    if (d.kick && pat(d.kick) === 'x') this.kick(t, dest, d.kickLevel || 0.9);
    if (d.snare && pat(d.snare) === 'x') this.snare(t, dest);
    if (d.clap && pat(d.clap) === 'x') this.clap(t, dest);
    if (d.hat) {
      const h = pat(d.hat);
      if (h === 'x') this.hat(t, dest, 0.18);
      else if (h === 'o') this.hat(t, dest, 0.16, true);
      else if (h === 'r') { for (let i = 0; i < 3; i++) this.hat(t + i * sd / 3, dest, 0.12); }
      else if (h === 'q') { for (let i = 0; i < 4; i++) this.hat(t + i * sd / 4, dest, 0.1); }
    }
    if (d.bass) for (const n of d.bass[bar % d.bass.length]) if (n[0] === s) this.bass808(t, mtof(root + n[1]), n[2] * sd, dest, n[3] !== undefined ? mtof(root + n[3]) : null, d.bassDist);
    if (d.bell) for (const n of d.bell[bar % d.bell.length]) if (n[0] === s) this.cowbell(t, mtof(root + 24 + n[1]), dest, n[2] ? n[2] * sd : 0.22, d.bellLevel || 0.22);
    if (d.pad && s === 0) { const ch = d.pad[bar % d.pad.length]; if (ch) this.padChord(t, ch.map(n => mtof(root + 12 + n)), 16 * sd, dest, d.padLevel || 0.05); }
    if (d.lead) for (const n of d.lead[bar % d.lead.length]) if (n[0] === s) this.lead(t, mtof(root + 24 + n[1]), n[2] * sd, dest);
    if (d.riser && step === d.bars * 16 - 8) this.noise(t, 8 * sd, 0.08, 'bandpass', 400, 6000, dest, { attack: 8 * sd * 0.9 });
  }
  kick(t, dest, lv) { this.osc('sine', 160, 42, t, 0.32, lv, dest, { glide: 0.07 }); this.noise(t, 0.02, 0.15, 'highpass', 3000, null, dest); }
  snare(t, dest) { this.noise(t, 0.16, 0.45, 'bandpass', 1900, 1200, dest, { rev: 0.25 }); this.osc('triangle', 220, 160, t, 0.08, 0.25, dest); }
  clap(t, dest) { for (let i = 0; i < 3; i++) this.noise(t + i * 0.011, 0.05 + i * 0.03, 0.32, 'bandpass', 1300, null, dest, { q: 2, rev: 0.3 }); }
  hat(t, dest, lv, open) { this.noise(t, open ? 0.16 : 0.035, lv, 'highpass', 8000, null, dest); }
  bass808(t, f, dur, dest, slideTo, dist) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    if (slideTo) { o.frequency.setValueAtTime(f, t + dur * 0.55); o.frequency.exponentialRampToValueAtTime(slideTo, t + dur * 0.95); }
    const ws = ctx.createWaveShaper(); ws.curve = this.makeDist(dist || 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.75, t + 0.006);
    g.gain.setValueAtTime(0.7, t + Math.max(0.02, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    o.connect(ws); ws.connect(lp); lp.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.12);
  }
  cowbell(t, f, dest, dur, lv) {
    const ctx = this.ctx;
    const g = ctx.createGain(); this.env(g, t, 0.002, lv, dur);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2.1; bp.Q.value = 1.4;
    for (const m of [1, 1.4836]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * m; o.connect(bp); o.start(t); o.stop(t + dur + 0.05); }
    bp.connect(g); g.connect(dest);
    const s = ctx.createGain(); s.gain.value = 0.25; g.connect(s); s.connect(this.reverb);
  }
  padChord(t, freqs, dur, dest, lv) {
    for (const f of freqs) for (const det of [-9, 9]) this.osc('sawtooth', f, f, t, dur, lv, dest, { attack: 0.4, detune: det, filter: 'lowpass', freq: 1100, rev: 0.4 });
  }
  lead(t, f, dur, dest) { this.osc('square', f, f, t, dur, 0.08, dest, { filter: 'lowpass', freq: 2200, rev: 0.3 }); }
}

// ---------------- catálogo de efectos ----------------
const SFX = {
  ui_move(t, p) { this.osc('sine', 900 * p, 1200 * p, t, 0.05, 0.18); },
  ui_select(t) { this.osc('square', 660, 660, t, 0.06, 0.12, null, { filter: 'lowpass', freq: 3000 }); this.osc('square', 990, 990, t + 0.06, 0.12, 0.12, null, { filter: 'lowpass', freq: 3000 }); },
  ui_back(t) { this.osc('triangle', 520, 300, t, 0.12, 0.2); },
  ui_deny(t) { this.osc('square', 160, 120, t, 0.14, 0.15, null, { filter: 'lowpass', freq: 900 }); },
  ui_open(t) { this.noise(t, 0.25, 0.15, 'bandpass', 300, 3000); this.osc('sine', 300, 900, t, 0.2, 0.12); },
  whoosh(t, p) { this.noise(t, 0.13, 0.32, 'bandpass', 500 * p, 2600 * p, null, { q: 1.6 }); },
  whooshHeavy(t, p) { this.noise(t, 0.22, 0.42, 'bandpass', 220 * p, 1100 * p, null, { q: 1.4 }); },
  hitLight(t, p) { this.noise(t, 0.045, 0.5, 'highpass', 1600 * p, null); this.osc('sine', 240 * p, 90, t, 0.07, 0.5); },
  hitMed(t, p) { this.noise(t, 0.08, 0.55, 'bandpass', 1000 * p, 500); this.osc('sine', 180 * p, 55, t, 0.12, 0.65); this.osc('square', 90, 50, t, 0.05, 0.15, null, { filter: 'lowpass', freq: 600 }); },
  hitHeavy(t, p) { this.noise(t, 0.16, 0.65, 'lowpass', 2400 * p, 300, null, { rev: 0.2 }); this.osc('sine', 120 * p, 36, t, 0.24, 0.85, null, { dist: true }); },
  hitMega(t, p) { SFX.hitHeavy.call(this, t, p); this.osc('sine', 70, 24, t, 0.55, 0.9, null, { dist: true, rev: 0.4 }); this.noise(t + 0.02, 0.4, 0.4, 'lowpass', 1200, 120, null, { rev: 0.4 }); },
  block(t, p) { this.osc('triangle', 1300 * p, 800, t, 0.06, 0.25); this.noise(t, 0.04, 0.3, 'highpass', 4000); },
  parry(t) { for (const f of [1568, 2349, 3136]) this.osc('sine', f, f, t, 0.7, 0.16, null, { rev: 0.6 }); this.noise(t, 0.2, 0.25, 'bandpass', 2000, 9000); },
  jump(t) { this.osc('sine', 260, 520, t, 0.08, 0.12); },
  land(t) { this.noise(t, 0.06, 0.25, 'lowpass', 500); this.osc('sine', 90, 50, t, 0.08, 0.3); },
  dash(t) { this.noise(t, 0.09, 0.3, 'bandpass', 1200, 4000, null, { q: 2 }); },
  ko(t) { this.osc('sine', 130, 20, t, 1.3, 1, null, { dist: true, rev: 0.6 }); this.noise(t, 0.9, 0.6, 'lowpass', 4000, 80, null, { rev: 0.6 }); },
  vineBoom(t) { this.osc('sine', 62, 38, t, 1.3, 1, null, { dist: true, rev: 0.5, glide: 0.5 }); this.osc('triangle', 124, 70, t, 0.4, 0.4, null, { dist: true }); this.noise(t, 0.12, 0.5, 'lowpass', 800); },
  explosion(t) { this.noise(t, 0.9, 0.7, 'lowpass', 3500, 120, null, { rev: 0.5 }); this.osc('sine', 80, 25, t, 0.8, 0.8, null, { dist: true }); },
  heart(t) { this.osc('sine', 880, 1320, t, 0.09, 0.18); this.osc('sine', 1100, 1650, t + 0.09, 0.12, 0.14); },
  zap(t) { for (let i = 0; i < 5; i++) { this.osc('square', 200 + Math.random() * 1500, 80, t + i * 0.04, 0.05, 0.12, null, { filter: 'bandpass', freq: 2000 }); } this.noise(t, 0.3, 0.4, 'highpass', 2000, null, null, { rev: 0.4 }); },
  thunder(t) { this.noise(t, 1.4, 0.7, 'lowpass', 1600, 60, null, { rev: 0.7 }); this.osc('sine', 60, 30, t, 1, 0.5, null, { dist: true }); },
  charge(t, p, o) { const d = o.dur || 0.6; this.osc('sawtooth', 160, 900, t, d, 0.12, null, { filter: 'lowpass', freq: 2500, attack: d * 0.8 }); },
  beam(t) { for (const f of [220, 277, 330]) this.osc('sawtooth', f, f * 1.5, t, 0.5, 0.06, null, { filter: 'lowpass', freq: 3000, rev: 0.3 }); },
  shutter(t) { this.noise(t, 0.03, 0.5, 'highpass', 3000); this.osc('square', 2500, 2500, t + 0.04, 0.03, 0.12); this.noise(t + 0.06, 0.05, 0.3, 'highpass', 5000); },
  slap(t) { this.noise(t, 0.03, 0.8, 'highpass', 2600); this.noise(t, 0.08, 0.5, 'bandpass', 900, 400); this.osc('sine', 300, 120, t, 0.06, 0.4); },
  bonk(t) { this.osc('square', 680, 320, t, 0.11, 0.25, null, { filter: 'bandpass', freq: 900, q: 3 }); this.noise(t, 0.05, 0.3, 'bandpass', 1500); },
  card(t) { this.noise(t, 0.05, 0.3, 'highpass', 5000); this.osc('triangle', 1200, 1800, t, 0.06, 0.08); },
  snap(t) { this.noise(t, 0.02, 0.8, 'highpass', 4000); this.osc('sine', 3000, 1500, t, 0.03, 0.2, null, { rev: 0.5 }); },
  crowdCheer(t, p, o) {
    const lv = o.level || 0.25;
    for (let i = 0; i < 6; i++) this.noise(t + i * 0.03, 1.4, lv * 0.5, 'bandpass', 700 + Math.random() * 1600, 900 + Math.random() * 900, null, { attack: 0.25, q: 0.7, rev: 0.4 });
  },
  crowdOoh(t) { for (const f of [180, 226, 270]) this.osc('sawtooth', f, f * 0.75, t, 0.9, 0.05, null, { filter: 'bandpass', freq: 520, q: 3, attack: 0.15, rev: 0.4 }); },
  crowdLaugh(t) { for (let i = 0; i < 6; i++) this.noise(t + i * 0.12, 0.08, 0.2, 'bandpass', 900 + (i % 2) * 300, null, null, { q: 4, rev: 0.3 }); },
  timeStop(t) { this.noise(t, 0.6, 0.4, 'bandpass', 6000, 200, null, { attack: 0.5 }); this.osc('sine', 55, 40, t + 0.5, 2.4, 0.4, null, { rev: 0.8 }); for (let i = 0; i < 6; i++) this.osc('square', 1800, 1800, t + 0.6 + i * 0.4, 0.02, 0.08); },
  domain(t) { for (const f of [55, 82.4, 110, 164.8]) this.osc('sawtooth', f, f, t, 2.5, 0.06, null, { filter: 'lowpass', freq: 600, attack: 0.6, rev: 0.8 }); this.noise(t, 1.5, 0.15, 'bandpass', 3000, 9000, null, { attack: 1 }); },
  energyFull(t) { [523, 659, 784, 1046].forEach((f, i) => this.osc('sine', f, f, t + i * 0.06, 0.18, 0.13, null, { rev: 0.3 })); },
  announce(t) { this.osc('sine', 80, 40, t, 0.6, 0.8, null, { dist: true, rev: 0.6 }); this.noise(t, 0.5, 0.3, 'lowpass', 3000, 200, null, { rev: 0.5 }); },
  riser(t) { this.noise(t, 0.9, 0.25, 'bandpass', 300, 8000, null, { attack: 0.8 }); },
  victory(t) { [523, 659, 784, 1046, 1318].forEach((f, i) => this.osc('square', f, f, t + i * 0.09, 0.3, 0.08, null, { filter: 'lowpass', freq: 3000, rev: 0.4 })); },
  defeat(t) { [392, 349, 311, 262].forEach((f, i) => this.osc('triangle', f, f * 0.97, t + i * 0.22, 0.4, 0.15, null, { rev: 0.4 })); },
  teleport(t) { this.osc('sine', 2400, 180, t, 0.18, 0.18); this.noise(t, 0.15, 0.25, 'bandpass', 3000, 300); },
  ice(t) { for (let i = 0; i < 4; i++) this.osc('sine', 2000 + i * 600, 2400 + i * 500, t + i * 0.03, 0.2, 0.06, null, { rev: 0.5 }); },
  pop(t) { this.osc('sine', 400, 1200, t, 0.06, 0.25); },
  fire(t) { this.noise(t, 0.5, 0.35, 'lowpass', 900, 3000, null, { attack: 0.1 }); },
  glitch(t) { for (let i = 0; i < 6; i++) this.osc('square', 100 + Math.random() * 3000, 100 + Math.random() * 3000, t + i * 0.03, 0.025, 0.1); },
  wave(t) { this.osc('sine', 300, 120, t, 0.35, 0.3, null, { rev: 0.3 }); this.noise(t, 0.3, 0.2, 'lowpass', 1200, 200); },
  burst(t) { this.osc('sine', 200, 1200, t, 0.18, 0.3); this.noise(t, 0.3, 0.4, 'bandpass', 800, 5000, null, { rev: 0.3 }); },
  count(t) { this.osc('square', 880, 880, t, 0.05, 0.08, null, { filter: 'lowpass', freq: 2000 }); },
  deny(t) { this.osc('sawtooth', 140, 100, t, 0.12, 0.1, null, { filter: 'lowpass', freq: 800 }); },
  coin(t) { this.osc('square', 988, 988, t, 0.05, 0.08, null, { filter: 'lowpass', freq: 4000 }); this.osc('square', 1319, 1319, t + 0.05, 0.15, 0.08, null, { filter: 'lowpass', freq: 4000 }); }
};

// ---------------- pistas phonk ----------------
// patrones de 16 pasos por compás. Notas: [paso, semitono, duración en pasos, slide?]
const P = s => s.replace(/\s/g, '');
const TRACKS = {
  menu: {
    bpm: 96, bars: 4, root: 33, bassDist: 4, bellLevel: 0.14, padLevel: 0.045,
    kick: [P('x... .... ..x. ....'), P('x... .... ...x ....')],
    snare: [P('.... x... .... x...')],
    hat: [P('x.x. x.x. x.x. x.xr'), P('x.x. x.x. x.x. xqx.')],
    bass: [[[0, 0, 7], [10, 0, 4, -2]], [[0, -4, 7], [10, -4, 4]], [[0, 3, 7], [10, 3, 4]], [[0, -2, 7], [10, -2, 4, 0]]],
    bell: [[[0, 12], [3, 15], [6, 19], [10, 17], [12, 15]], [[0, 8], [3, 12], [6, 15], [10, 12]], [[0, 15], [3, 19], [6, 22], [10, 19], [14, 17]], [[0, 10], [3, 14], [6, 17], [10, 14], [12, 12]]],
    pad: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]]
  },
  fight1: {
    bpm: 146, bars: 4, root: 30, bassDist: 10, bellLevel: 0.2, riser: true,
    kick: [P('x... .... x.x. ....'), P('x... .... x... ..x.')],
    snare: [P('.... x... .... x...')],
    clap: [P('.... .... .... ....'), P('.... .... .... x..x')],
    hat: [P('x.x. x.x. x.xr x.x.'), P('x.x. x.qx x.x. rrqq')],
    bass: [[[0, 0, 6], [8, 0, 3], [11, 3, 5, 0]], [[0, -2, 6], [8, -2, 3], [11, 1, 5, -2]], [[0, -4, 6], [8, -4, 3], [11, -1, 5]], [[0, -5, 6], [8, -5, 2], [10, -7, 6, 0]]],
    bell: [
      [[0, 12], [2, 12], [3, 15], [5, 12], [6, 19], [8, 17], [10, 15], [11, 12], [13, 15], [14, 17]],
      [[0, 10], [2, 10], [3, 13], [5, 10], [6, 17], [8, 15], [10, 13], [11, 10], [13, 13], [14, 15]],
      [[0, 8], [2, 8], [3, 12], [5, 8], [6, 15], [8, 13], [10, 12], [11, 8], [13, 12], [14, 13]],
      [[0, 7], [2, 7], [3, 10], [5, 7], [6, 14], [8, 12], [10, 10], [12, 12], [14, 15], [15, 17]]
    ]
  },
  fight2: {
    bpm: 128, bars: 4, root: 32, bassDist: 14, bellLevel: 0.22,
    kick: [P('x..x ..x. ..x. .x..'), P('x..x ..x. x... .x..')],
    snare: [P('.... x... .... x...')],
    hat: [P('.x.x .x.x .x.x .x.q')],
    clap: [P('.... x..x .... x...')],
    bass: [[[0, 0, 3], [3, 0, 3], [6, 3, 2], [10, 0, 4, 7]], [[0, 5, 3], [3, 5, 3], [6, 3, 2], [10, 2, 4]], [[0, 0, 3], [3, 0, 3], [6, 7, 2], [10, 5, 4, 3]], [[0, -2, 3], [3, -2, 3], [6, 0, 2], [10, 3, 6, 0]]],
    bell: [[[0, 12], [3, 12], [6, 15], [8, 12], [11, 19], [14, 17]], [[0, 17], [3, 17], [6, 15], [8, 14], [11, 12], [14, 10]], [[0, 12], [3, 12], [6, 19], [8, 17], [11, 15], [14, 12]], [[0, 10], [3, 10], [6, 12], [8, 15], [11, 17], [14, 15]]]
  },
  fight3: {
    bpm: 152, bars: 4, root: 29, bassDist: 18, bellLevel: 0.18, riser: true,
    kick: [P('x... ..x. x... ....'), P('x... ..x. x..x ..x.')],
    snare: [P('.... x... .... x...')],
    hat: [P('xxxx xxxx xrxx xxrx'), P('xxxx xqxx xxxx rrrr')],
    bass: [[[0, 0, 4], [6, 0, 2], [8, 1, 6, 0]], [[0, 0, 4], [6, 0, 2], [8, -2, 6]], [[0, -4, 4], [6, -4, 2], [8, -3, 6, -4]], [[0, -5, 4], [6, -5, 2], [8, -7, 8, 0]]],
    bell: [[[0, 12], [1, 13], [4, 12], [6, 15], [8, 13], [12, 12], [14, 8]], [[0, 12], [1, 13], [4, 15], [6, 17], [8, 15], [12, 13], [14, 12]], [[0, 8], [1, 9], [4, 8], [6, 12], [8, 9], [12, 8], [14, 5]], [[0, 7], [2, 8], [4, 12], [6, 13], [8, 12], [10, 8], [12, 7], [14, 3]]],
    pad: [[0, 1, 7], null, [-4, 0, 3], null], padLevel: 0.03
  },
  boss: {
    bpm: 162, bars: 4, root: 28, bassDist: 30, bellLevel: 0.2, riser: true, kickLevel: 1,
    kick: [P('x.x. ..x. x... x.x.'), P('x... x.x. x.x. ...x')],
    snare: [P('.... x... .... x..x')],
    clap: [P('.... x... .... x...')],
    hat: [P('xrxx xrxx xrxx qqqq')],
    bass: [[[0, 0, 3], [4, 0, 2], [6, 1, 2], [8, 0, 4], [12, 6, 4, 0]], [[0, 0, 3], [4, 0, 2], [6, 1, 2], [8, 3, 4], [12, 1, 4]], [[0, -2, 3], [4, -2, 2], [6, -1, 2], [8, -2, 4], [12, 4, 4, -2]], [[0, -4, 3], [4, -4, 2], [6, -3, 2], [8, -4, 4], [12, -5, 4, 0]]],
    bell: [[[0, 12], [2, 13], [4, 12], [6, 18], [8, 17], [10, 13], [12, 12], [14, 13]], [[0, 15], [2, 13], [4, 12], [6, 13], [8, 15], [10, 18], [12, 17], [14, 13]]],
    pad: [[0, 1, 6], [0, 1, 6], [-2, -1, 4], [-4, -3, 2]], padLevel: 0.035
  },
  results: {
    bpm: 104, bars: 2, root: 36, bassDist: 4, bellLevel: 0.14, padLevel: 0.05,
    kick: [P('x... .... x... ....')], snare: [P('.... x... .... x...')], hat: [P('x.x. x.x. x.x. x.x.')],
    bass: [[[0, 0, 8], [8, 5, 8]], [[0, 7, 8], [8, 3, 8, 0]]],
    bell: [[[0, 12], [4, 16], [8, 19], [12, 24]], [[0, 19], [4, 17], [8, 16], [12, 12]]],
    pad: [[0, 4, 7], [-5, 0, 4]]
  },
  survival: {
    bpm: 156, bars: 4, root: 31, bassDist: 20, bellLevel: 0.2, riser: true,
    kick: [P('x... x... x... x...'), P('x... x... x.x. x...')],
    snare: [P('.... x... .... x...')], clap: [P('..x. .... ..x. ....')],
    hat: [P('.x.x .x.x .x.x .xrx')],
    bass: [[[0, 0, 2], [2, 12, 2], [4, 0, 2], [6, 12, 2], [8, 3, 2], [10, 15, 2], [12, 2, 4, 0]], [[0, -2, 2], [2, 10, 2], [4, -2, 2], [6, 10, 2], [8, 1, 2], [10, 13, 2], [12, -5, 4]]],
    bell: [[[0, 12], [3, 15], [6, 12], [8, 19], [11, 17], [14, 15]], [[0, 10], [3, 13], [6, 10], [8, 17], [11, 15], [14, 13]]]
  }
};
export const TRACK_IDS = Object.keys(TRACKS);
export const FIGHT_TRACKS = ['fight1', 'fight2', 'fight3'];
export const Audio = new AudioEngine();

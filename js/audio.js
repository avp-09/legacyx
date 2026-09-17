// Synthesized audio — no external assets, no copyright issues.
// WebAudio oscillators for SFX + gentle procedural background music.
let ctx = null, musicTimer = null, musicOn = true, sfxOn = true, musicNodes = [];

function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.15, type = 'sine', vol = 0.18, when = 0, slide = 0) {
  if (!sfxOn) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

export const AudioSys = {
  init() { ac(); },
  setEnabled(music, sfx) { musicOn = music; sfxOn = sfx; if (!music) this.stopMusic(); },
  click() { tone(660, 0.07, 'triangle', 0.12); },
  collect() { tone(880, 0.12, 'sine', 0.2); tone(1320, 0.18, 'sine', 0.16, 0.09); },
  success() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, i * 0.11)); },
  fail() { tone(300, 0.25, 'sine', 0.14, 0, -80); },
  jump() { tone(440, 0.12, 'square', 0.06, 0, 220); },
  step() { tone(180 + Math.random() * 60, 0.05, 'sine', 0.035); },
  portal() { [330, 415, 494, 622, 740, 880].forEach((f, i) => tone(f, 0.3, 'sine', 0.12, i * 0.09)); },
  seal() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.35, 'sine', 0.16, i * 0.13)); tone(2093, 0.6, 'sine', 0.1, 0.55); },
  talk() { tone(520, 0.08, 'triangle', 0.1); tone(640, 0.08, 'triangle', 0.08, 0.07); },
  // Gentle pentatonic loop, different root per level for flavour.
  music(levelId = 1) {
    this.stopMusic();
    if (!musicOn) return;
    const c = ac(); if (!c) return;
    const roots = { 1: 220, 2: 247, 3: 262, 4: 233, 5: 294, 6: 277 };
    const root = roots[levelId] || 220;
    const scale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
    let step = 0;
    const tick = () => {
      if (!musicOn) return;
      const c2 = ac(); if (!c2) return;
      const f = root * scale[Math.floor(Math.random() * scale.length)];
      const o = c2.createOscillator(), g = c2.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = c2.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(c2.destination);
      o.start(t); o.stop(t + 1.5);
      musicNodes.push(o);
      step++;
    };
    tick();
    musicTimer = setInterval(tick, 1500);
  },
  stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } musicNodes = []; }
};

// Tiny DOM helpers shared by game screens.
import { AudioSys } from './audio.js';

export function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add('hidden'), ms);
}

export function achievementPopup(def) {
  const el = document.getElementById('ach-pop');
  el.innerHTML = `<div class="ach-icon">${def.icon}</div><div><b>Achievement Unlocked!</b><br>${def.name}</div>`;
  el.classList.remove('hidden'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  AudioSys.success();
  setTimeout(() => el.classList.add('hidden'), 3200);
}

export function showScreen(id) {
  ['screen-menu', 'screen-levels', 'screen-museum', 'screen-achv', 'screen-settings', 'screen-game'].forEach(s => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
  document.getElementById('hud').classList.toggle('hidden', id !== 'screen-game');
}

export function burst(x, y) {
  // DOM sparkle at screen point (collect feedback even without WebGL particles)
  const c = document.getElementById('fx-layer');
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    s.textContent = ['✨', '⭐', '💛'][i % 3];
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    s.style.setProperty('--dy', (Math.random() * -120 - 20) + 'px');
    c.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

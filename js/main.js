import { Game } from './game.js';
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.BQ = game;
  try { game.init(); } catch (err) {
    console.error(err);
    document.getElementById('fatal').classList.remove('hidden');
    document.getElementById('fatal-msg').textContent = String(err && err.message || err);
  }
});

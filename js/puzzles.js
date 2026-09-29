// Final puzzles per level — DOM overlays with tactile interactions.
// L1 drainage pipes · L2 temple stack · L3 four trials · final newspaper layout
import { AudioSys } from './audio.js';

function shell(title, inner) {
  const modal = document.getElementById('puzzle-modal');
  document.getElementById('puzzle-title').textContent = title;
  document.getElementById('puzzle-body').innerHTML = inner;
  modal.classList.remove('hidden');
  return modal;
}
function close() { document.getElementById('puzzle-modal').classList.add('hidden'); }

export function openPuzzle(levelId, { onSolve }) {
  if (levelId === 1) return drainage(onSolve);
  if (levelId === 2) return temple(onSolve);
  if (levelId === 3) return fort(onSolve);
  return press(onSolve);
}

// ---- L1: rotate 3 pipes so water flows (click to rotate; all must be "═"/"║" connected) ----
function drainage(onSolve) {
  // 3 valves in series: each click cycles 0→90→180→270. Solved when all = 1 (vertical flow).
  // Visual: emoji pipes. Simple, impossible to soft-lock, judge-friendly.
  const state = [0, 2, 3];
  const glyph = r => ['═', '║', '═', '║'][r % 4] === '║' ? '║' : '═';
  shell('🔧 Drainage Puzzle', `
    <p class="p-sub">The city needs water! Tap each pipe section to rotate it. Make <b>all three vertical (║)</b> so water flows from the well to the Great Bath.</p>
    <div class="pipes">
      <div class="pipe-well">🪣<small>well</small></div>
      ${state.map((s, i) => `<button class="pipe" data-i="${i}">${glyph(s)}</button>`).join('')}
      <div class="pipe-well">🛁<small>bath</small></div>
    </div>
    <div class="flowbar"><div class="flowfill" id="flowfill"></div></div>
    <p class="p-hint" id="pipe-hint">💡 Hint: the Elder said drains run straight beside every lane.</p>`);
  const btns = [...document.querySelectorAll('.pipe')];
  function refresh() {
    btns.forEach((b, i) => { b.textContent = glyph(state[i]); b.classList.toggle('ok', state[i] % 2 === 1); });
    const n = state.filter(s => s % 2 === 1).length;
    document.getElementById('flowfill').style.width = (n / 3 * 100) + '%';
    if (n === 3) {
      AudioSys.seal();
      document.getElementById('pipe-hint').innerHTML = '✨ Water flows! The Time Seal shimmers into view…';
      setTimeout(() => { close(); onSolve(); }, 900);
    }
  }
  btns.forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i; state[i] = (state[i] + 1) % 4; AudioSys.click(); refresh();
  }));
  refresh();
}

// ---- L2: stack temple parts base→finial ----
function temple(onSolve) {
  const parts = [
    { e: '🧱', n: 'Foundation' }, { e: '🏛️', n: 'Pillars' },
    { e: '🧱', n: 'Walls' }, { e: '🛕', n: 'Tower' }, { e: '✨', n: 'Finial' }
  ];
  // show shuffled, tap in correct 0..4 order
  const seq = [3, 0, 4, 1, 2];
  let prog = 0;
  const placed = [];
  shell('🛕 Temple Puzzle', `
    <p class="p-sub">Raise the vimana in architectural order:<br><b>Base → Pillars → Walls → Tower → Finial</b></p>
    <div class="tower" id="tower"><div class="t-base">tap pieces below to stack ↑</div></div>
    <div class="tile-row">${seq.map(i => `<button class="tile big" data-i="${i}">${parts[i].e}<small>${parts[i].n}</small></button>`).join('')}</div>`);
  document.querySelectorAll('.tile').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    if (i === prog) {
      b.classList.add('ok'); b.disabled = true; prog++; AudioSys.collect();
      const tw = document.getElementById('tower');
      const d = document.createElement('div');
      d.className = 't-block'; d.textContent = `${parts[i].e} ${parts[i].n}`;
      tw.prepend(d);
      if (prog === parts.length) { AudioSys.seal(); setTimeout(() => { close(); onSolve(); }, 900); }
    } else { AudioSys.fail(); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); }
  }));
}

// ---- L3: four quick trials ----
function fort(onSolve) {
  let step = 0;
  const steps = [
    { t: 'Trial 1 — Match the object to its use', q: 'A clay seal was used to…', opts: ['Stamp goods & mark ownership', 'Play music', 'Cook rice'], a: 0 },
    { t: 'Trial 2 — Read the fort map', q: 'The secret chamber lies…', opts: ['Behind the courtyard’s north wall', 'On the moon', 'Under the sea'], a: 0 },
    { t: 'Trial 3 — Symbols', q: 'Lotus + peacock carvings mean…', opts: ['Nature & pride of the court', 'Danger, keep out', 'Nothing at all'], a: 0 },
    { t: 'Trial 4 — Memory', q: 'Which monument is associated with Shah Jahan?', opts: ['Qutub Minar', 'Taj Mahal', 'Sanchi Stupa'], a: 1 }
  ];
  function render() {
    const s = steps[step];
    shell('🏰 Secret Chamber Trials', `
      <p class="p-sub"><b>${s.t}</b> (${step + 1}/4)</p>
      <h3 class="quiz-q">${s.q}</h3>
      <div class="quiz-opts">${s.opts.map((o, i) => `<button class="quiz-opt" data-i="${i}"><span class="opt-letter">${'ABC'[i]}</span>${o}</button>`).join('')}</div>`);
    document.querySelectorAll('.quiz-opt').forEach(b => b.addEventListener('click', () => {
      if (+b.dataset.i === s.a) {
        AudioSys.collect(); step++;
        if (step >= steps.length) { AudioSys.seal(); setTimeout(() => { close(); onSolve(); }, 700); }
        else render();
      } else { AudioSys.fail(); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); }
    }));
  }
  render();
}

// ---- L5: newspaper order EVENT→DATE→PERSON→LOCATION→HEADLINE ----
function press(onSolve) {
  const cards = [
    { e: '📜', n: 'EVENT', d: 'Peaceful march for freedom' },
    { e: '📅', n: 'DATE', d: '15 August 1947' },
    { e: '👤', n: 'PERSON', d: 'Gandhiji leads with truth' },
    { e: '📍', n: 'LOCATION', d: 'From Dandi to Delhi' },
    { e: '📰', n: 'HEADLINE', d: 'FREEDOM AT LAST!' }
  ];
  const seq = [3, 0, 4, 1, 2];
  let prog = 0;
  shell('📰 Press Puzzle', `
    <p class="p-sub">Lay out the front page in order:<br><b>EVENT → DATE → PERSON → LOCATION → HEADLINE</b></p>
    <div class="paper" id="paper"><div class="paper-head">THE FREEDOM HERALD</div><div id="paper-body"><i>tap cards below…</i></div></div>
    <div class="tile-row wrap">${seq.map(i => `<button class="tile" data-i="${i}">${cards[i].e}<small>${cards[i].n}</small></button>`).join('')}</div>`);
  document.querySelectorAll('.tile').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    if (i === prog) {
      b.classList.add('ok'); b.disabled = true; prog++; AudioSys.collect();
      const pb = document.getElementById('paper-body');
      if (prog === 1) pb.innerHTML = '';
      pb.innerHTML += `<div class="paper-line"><b>${cards[i].n}:</b> ${cards[i].d}</div>`;
      if (prog === cards.length) { AudioSys.seal(); setTimeout(() => { close(); onSolve(); }, 1000); }
    } else { AudioSys.fail(); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); }
  }));
}

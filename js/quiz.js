// Quiz overlay — data-driven, kind feedback, retry without level restart.
import { AudioSys } from './audio.js';

export function openQuiz({ title, questions, passCount = 4, onPass, onClose }) {
  const modal = document.getElementById('quiz-modal');
  const body = document.getElementById('quiz-body');
  modal.classList.remove('hidden');
  let idx = 0, score = 0, locked = false;
  const picked = [];

  function render() {
    if (idx >= questions.length) return results();
    const q = questions[idx];
    locked = false;
    body.innerHTML = `
      <div class="quiz-top"><span class="quiz-count">Question ${idx + 1} / ${questions.length}</span>
      <span class="quiz-score">✅ ${score}</span></div>
      <h3 class="quiz-q">${q.q}</h3>
      <div class="quiz-opts">${q.options.map((o, i) => `<button class="quiz-opt" data-i="${i}"><span class="opt-letter">${'ABCD'[i]}</span>${o}</button>`).join('')}</div>
      <div class="quiz-fact"></div>`;
    body.querySelectorAll('.quiz-opt').forEach(b => b.addEventListener('click', () => answer(parseInt(b.dataset.i, 10), q)));
  }

  function answer(i, q) {
    if (locked) return; locked = true;
    picked[idx] = i;
    const btns = [...body.querySelectorAll('.quiz-opt')];
    btns.forEach((b, bi) => {
      if (bi === q.answer) b.classList.add('correct');
      else if (bi === i) b.classList.add('wrong');
      b.disabled = true;
    });
    const fact = body.querySelector('.quiz-fact');
    if (i === q.answer) {
      score++; AudioSys.success();
      fact.innerHTML = `<div class="fact good">🌟 Correct! ${q.fact || ''}</div><button class="btn primary" id="quiz-next">Continue →</button>`;
    } else {
      AudioSys.fail();
      fact.innerHTML = `<div class="fact soft">Not quite! Look around for another clue. 💛<br>${q.fact || ''}</div><button class="btn primary" id="quiz-next">Continue →</button>`;
    }
    document.getElementById('quiz-next').addEventListener('click', () => { AudioSys.click(); idx++; render(); });
  }

  function results() {
    const pass = score >= passCount;
    if (pass) AudioSys.seal(); else AudioSys.fail();
    body.innerHTML = `
      <h3 class="quiz-q">${pass ? '🎉 Knowledge Gate Cleared!' : '💛 Almost there!'}</h3>
      <div class="quiz-final-score">You scored <b>${score}/${questions.length}</b> (need ${passCount})</div>
      <p class="quiz-msg">${pass ? 'The gate glows green. A puzzle mechanism clicks open nearby…' : 'Explore the area and look for more clues — then try again. No progress lost!'}</p>
      <div class="row center">
        ${pass ? `<button class="btn primary big" id="quiz-done">Continue Adventure →</button>`
               : `<button class="btn primary big" id="quiz-retry">🔁 Try Again</button>`}
        <button class="btn ghost" id="quiz-exit">Explore More</button>
      </div>`;
    if (pass) document.getElementById('quiz-done').addEventListener('click', () => { AudioSys.click(); close(); onPass && onPass(score, questions.length); });
    else document.getElementById('quiz-retry').addEventListener('click', () => { AudioSys.click(); idx = 0; score = 0; render(); });
    document.getElementById('quiz-exit').addEventListener('click', () => { AudioSys.click(); close(); onClose && onClose(score, pass); });
  }
  function close() { modal.classList.add('hidden'); }
  document.getElementById('quiz-title').textContent = title;
  render();
  return { close };
}

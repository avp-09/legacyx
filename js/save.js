// Persistent progression — localStorage. Never loses progress on refresh.
const KEY = 'bharatQuestSaveV1';

const DEFAULTS = () => ({
  currentLevel: 1,
  unlocked: 1,              // highest unlocked level (1..5; 5 = final chamber)
  completed: [],            // [1,2..]
  seals: [],                // [1,2..]
  historyPoints: 0,
  artifacts: {},            // levelId -> count
  museum: [],               // "1-0" style ids
  quizScores: {},           // levelId -> best score
  stars: {},                // levelId -> 1..3
  achievements: [],
  settings: { music: true, sfx: true, quality: 'high' },
  finalDone: false
});

// One-time migration for saves from the 5-level era: drop all Level 5 data.
function migrate(d) {
  const keep = (arr) => (arr || []).filter(x => !(String(x).startsWith('5-') || x === 5));
  d.completed = keep(d.completed);
  d.seals = keep(d.seals);
  d.museum = keep(d.museum);
  for (const k of ['artifacts', 'quizScores', 'stars']) {
    if (d[k] && d[k][5] !== undefined) delete d[k][5];
  }
  d.unlocked = Math.max(1, Math.min(5, d.unlocked || 1));
  return d;
}

export const Save = {
  data: DEFAULTS(),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = migrate({ ...DEFAULTS(), ...JSON.parse(raw) });
    } catch { this.data = DEFAULTS(); }
    return this.data;
  },
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch {}
  },
  reset() { this.data = DEFAULTS(); this.write(); },
  addPoints(n) { this.data.historyPoints += n; this.write(); },
  addArtifact(levelId, museumId, name) {
    this.data.artifacts[levelId] = (this.data.artifacts[levelId] || 0) + 1;
    if (museumId && !this.data.museum.includes(museumId)) this.data.museum.push(museumId);
    if (!this.data.achievements.includes('first')) this.data.achievements.push('first');
    this.write();
  },
  recordQuiz(levelId, score, total) {
    const prev = this.data.quizScores[levelId] || 0;
    if (score > prev) this.data.quizScores[levelId] = score;
    if (score === total && !this.data.achievements.includes('scholar')) this.data.achievements.push('scholar');
    this.write();
  },
  completeLevel(levelId, seal) {
    if (!this.data.completed.includes(levelId)) this.data.completed.push(levelId);
    if (seal && !this.data.seals.includes(levelId)) this.data.seals.push(levelId);
    const target = ART_TARGET[levelId] || 5;
    const got = this.data.artifacts[levelId] || 0;
    this.data.stars[levelId] = got >= target ? 3 : got >= Math.ceil(target * 0.6) ? 2 : 1;
    if (got >= target && !this.data.achievements.includes('explorer')) this.data.achievements.push('explorer');
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(5, levelId + 1));
    if (this.data.seals.length >= 4 && !this.data.achievements.includes('guardian')) this.data.achievements.push('guardian');
    this.write();
  },
  completeFinal() {
    this.data.finalDone = true;
    if (!this.data.achievements.includes('master')) this.data.achievements.push('master');
    this.write();
  }
};

import { LEVELS } from './data.js';
const ART_TARGET = Object.fromEntries(LEVELS.map(l => [l.id, l.collectible.target]));

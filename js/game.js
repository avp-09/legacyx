// ============================================================
// GAME orchestrator: renderer, loop, quests, dialogue, HUD,
// seals, portals, inventory, museum, achievements, persistence.
// ============================================================
import * as THREE from 'three';
import { LEVELS, QUIZZES, FINAL_QUESTIONS, ARTIFACT_INFO, ACHIEVEMENTS, levelById } from './data.js';
import { Save } from './save.js';
import { AudioSys } from './audio.js';
import { buildWorld } from './world.js';
import { createPlayer } from './player.js';
import { openQuiz } from './quiz.js';
import { openPuzzle } from './puzzles.js';
import { getHistoricalAnswer } from './kalam.js';
import { toast, achievementPopup, showScreen, burst } from './ui.js';

export class Game {
  constructor() {
    this.renderer = null; this.scene = null; this.camera = null;
    this.world = null; this.player = null;
    this.levelId = 1; this.found = 0; this.quizPassed = false;
    this.sealReady = false; this.portalReady = false; this.levelDone = false;
    this.dialogue = null; this.busy = false; // modal open
    this.camYaw = 0; this.camPitch = 0.42; this.camDist = 8.5;
    this.input = { f: false, b: false, l: false, r: false, run: false, jump: false };
    this.joy = { x: 0, y: 0 };
    this.knownAch = new Set();
    this.clock = null;
    this.finalMode = false;
  }

  init() {
    Save.load();
    this.knownAch = new Set(Save.data.achievements);
    const container = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
    this.clock = new THREE.Clock();
    this.bindInputs();
    this.bindMenuButtons();
    this.renderLevelCards(); this.renderMuseum(); this.renderAchv();
    this.applySettings();
    showScreen('screen-menu');
    this.updateMenuSeals();
    this.menuOrbit();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.loop();
  }

  // ---------- pretty menu background: slow orbit over Level 1 diorama ----------
  menuOrbit() {
    if (this.inGame) return;
    this.scene.clear();
    const lvl = levelById(1);
    this.world = buildWorld(THREE, this.scene, lvl);
    this.menuCamT = 0;
  }

  // ---------- LEVEL LOADING ----------
  startLevel(id, opts = {}) {
    AudioSys.init();
    this.busy = false;
    ['quiz-modal', 'puzzle-modal', 'results-modal', 'victory-modal', 'pause-menu', 'dialogue', 'inventory-panel'].forEach(m => document.getElementById(m).classList.add('hidden'));
    this.finalMode = (id === 6);
    this.levelId = id;
    this.inGame = true;
    this.scene.clear();
    if (this.finalMode) {
      this.loadFinalChamber();
    } else {
      const lvl = levelById(id);
      this.world = buildWorld(THREE, this.scene, lvl);
      this.player = createPlayer(THREE, this.scene, this.world.spawn);
      this.player.onStep = () => AudioSys.step();
      this.player.onJump = () => AudioSys.jump();
      this.found = 0; this.quizPassed = false; this.sealReady = false; this.portalReady = false; this.levelDone = false;
      if (opts.demo) { // hackathon demo: pre-find 3 to show loop fast
        let n = 0;
        for (const c of this.world.collectibles) {
          if (n >= 3) break;
          this.takeCollectible(c, true); n++;
        }
        setTimeout(() => toast(`🎬 DEMO MODE — 3 ${lvl.collectible.name}s pre-found! Find ${lvl.collectible.target - 3} more!`, 3400), 600);
      }
      AudioSys.music(id);
      this.updateHUD();
      this.kalamSay(`Namaste! I am Kalam. ${lvl.mission}. Follow the golden glows!`);
    }
    this.freePlayer(false); // guarantee spawn starts on open ground
    this.stuckT = 0; this.stuckMark = null;
    showScreen('screen-game');
    this.updateHUD();
  }

  // Push the player out of any overlapping collider (spawn safety + watchdog).
  freePlayer(loud = true) {
    if (!this.player || !this.world) return;
    const p = this.player.group.position;
    for (let k = 0; k < 10; k++) {
      let pushed = false;
      for (const c of this.world.colliders) {
        const dx = p.x - c.x, dz = p.z - c.z;
        const d = Math.hypot(dx, dz), need = c.r + 0.9;
        if (d < need) {
          if (d < 1e-3) { p.x = c.x + need; }
          else { p.x = c.x + dx / d * need; p.z = c.z + dz / d * need; }
          pushed = true;
        }
      }
      p.x = Math.max(-this.world.bounds, Math.min(this.world.bounds, p.x));
      p.z = Math.max(-this.world.bounds, Math.min(this.world.bounds, p.z));
      if (!pushed) break;
    }
    if (loud) toast('🌀 Squeezed out of a tight spot — follow the golden glows!');
  }

  loadFinalChamber() {
    // golden chamber between stars
    this.scene.background = new THREE.Color(0x1a1040);
    this.scene.fog = new THREE.Fog(0x1a1040, 30, 110);
    this.scene.add(new THREE.HemisphereLight(0xfff2c8, 0x332266, 1));
    const sun = new THREE.DirectionalLight(0xffe9a8, 1.4); sun.position.set(10, 20, 8); this.scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 40),
      new THREE.MeshStandardMaterial({ color: 0x3a2a6a, roughness: 0.4, metalness: 0.4 }));
    floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
    // 5 seal pillars
    this.finalPillars = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = Math.cos(a) * 9, z = Math.sin(a) * 9;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 3, 10),
        new THREE.MeshStandardMaterial({ color: 0xd9b06a, emissive: Save.data.seals.includes(i + 1) ? 0xaa7700 : 0x222222, emissiveIntensity: 0.8 }));
      p.position.set(x, 1.5, z); this.scene.add(p);
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.5),
        new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffb300, emissiveIntensity: 1.5 }));
      s.position.set(x, 3.6, z); this.scene.add(s);
      this.finalPillars.push(s);
    }
    this.world = { colliders: [], bounds: 18, npcs: [], collectibles: [], dynamics: [], spawn: [0, 0, 10], kalam: null,
      gate: null, seal: { mesh: new THREE.Group(), pos: new THREE.Vector3(0, 0, -6) }, portal: null };
    // central console mesh (interactable)
    const con = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 1),
      new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xaa7700, emissiveIntensity: 0.6 }));
    con.position.set(0, 0.7, -6); this.scene.add(con);
    this.finalConsole = con;
    this.world.dynamics.push((dt, t) => { this.finalPillars.forEach((s, i) => { s.rotation.y += dt * (1 + i * 0.2); s.position.y = 3.6 + Math.sin(t * 2 + i) * 0.15; }); });
    this.player = createPlayer(THREE, this.scene, this.world.spawn);
    this.player.onStep = () => AudioSys.step();
    this.player.onJump = () => AudioSys.jump();
    AudioSys.music(6);
    this.updateHUD();
    setTimeout(() => {
      this.kalamSay('The Final History Chamber! Walk to the golden console and prove you are a Guardian of Time.');
      toast('🏆 FINAL CHALLENGE — walk to the golden console (E)', 3200);
    }, 500);
  }

  // ================= MAIN LOOP =================
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    if (!this.inGame && this.world) { // menu diorama orbit
      this.menuCamT = (this.menuCamT || 0) + dt * 0.12;
      this.camera.position.set(Math.cos(this.menuCamT) * 26, 12, Math.sin(this.menuCamT) * 26);
      this.camera.lookAt(0, 1, 0);
      (this.world.dynamics || []).forEach(fn => fn(dt, t, this));
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (!this.inGame || !this.player) return;
    if (!this.busy) {
      // merge keyboard + joystick
      const inp = { ...this.input };
      if (Math.abs(this.joy.y) > 0.15 || Math.abs(this.joy.x) > 0.15) {
        inp.f = this.joy.y < -0.15; inp.b = this.joy.y > 0.15;
        inp.l = this.joy.x < -0.15; inp.r = this.joy.x > 0.15;
        if (Math.abs(this.joy.x) > 0.75 || Math.abs(this.joy.y) > 0.75) inp.run = true;
      }
      this.player.update(dt, inp, this.camYaw, this.world.colliders, this.world.bounds);
      // camera follow
      const p = this.player.group.position;
      const cx = p.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
      const cz = p.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
      const cy = p.y + 1.6 + Math.sin(this.camPitch) * this.camDist;
      this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 8));
      this.camera.lookAt(p.x, p.y + 1.5, p.z);
      // kalam follows
      if (this.world.kalam) {
        const k = this.world.kalam;
        const tx = p.x - Math.sin(this.player.heading) * 2.2, tz = p.z - Math.cos(this.player.heading) * 2.2;
        k.position.x += (tx - k.position.x) * Math.min(1, dt * 3);
        k.position.z += (tz - k.position.z) * Math.min(1, dt * 3);
        k.position.y = p.y + Math.sin(t * 3) * 0.12;
        k.rotation.y = this.player.heading;
      }
      this.checkInteract();
      // anti-stuck watchdog: pushing against an obstacle with no progress
      // for ~1.2s ejects the player to open ground (never a soft-lock).
      const trying = inp.f || inp.b || inp.l || inp.r;
      if (trying) {
        this.stuckT = (this.stuckT || 0) + dt;
        if (!this.stuckMark) this.stuckMark = p.clone();
        if (this.stuckT > 1.2) {
          if (p.distanceTo(this.stuckMark) < 0.12) this.freePlayer(true);
          this.stuckT = 0; this.stuckMark = p.clone();
        }
      } else { this.stuckT = 0; this.stuckMark = null; }
    }
    (this.world.dynamics || []).forEach(fn => fn(dt, t, { gateOpen: this.quizPassed }));
    this.renderer.render(this.scene, this.camera);
  }

  // ================= INTERACTION =================
  nearestInteract() {
    const p = this.player.group.position;
    const lvl = levelById(this.levelId);
    const cands = [];
    if (this.finalMode) {
      const d = p.distanceTo(new THREE.Vector3(0, 0, -6));
      if (d < 4) cands.push({ kind: 'final', d, label: '🏆 ATTEMPT FINAL CHALLENGE' });
      cands.push({ kind: 'kalam', d: 99, label: '🤖 ASK KALAM' });
      return cands.sort((a, b) => a.d - b.d)[0] || null;
    }
    for (const n of this.world.npcs) {
      const d = p.distanceTo(n.mesh.position);
      if (d < 3.2) cands.push({ kind: 'npc', ref: n, d, label: `💬 TALK — ${n.def.name}` });
    }
    for (const c of this.world.collectibles) {
      if (c.taken) continue;
      const d = p.distanceTo(c.pos);
      if (d < 2.8) cands.push({ kind: 'item', ref: c, d, label: `🔍 INVESTIGATE — ${lvl.collectible.name}` });
    }
    if (this.world.gate) {
      const d = p.distanceTo(this.world.gate.pos);
      if (d < 4) cands.push({
        kind: 'gate', d,
        label: this.found >= lvl.collectible.target ? (this.quizPassed ? '🔱 GATE OPEN — puzzle solved?' : '🔱 ENTER HISTORY GATE (Quiz)') : `🔱 HISTORY GATE (${this.found}/${lvl.collectible.target})`
      });
    }
    if (this.sealReady && !this.levelDone) {
      const d = p.distanceTo(this.world.seal.pos);
      if (d < 3.4) cands.push({ kind: 'seal', d, label: '✨ COLLECT TIME SEAL' });
    }
    if (this.portalReady) {
      const d = p.distanceTo(this.world.portal.pos);
      if (d < 3.4) cands.push({ kind: 'portal', d, label: '🌀 ENTER PORTAL' });
    }
    // kalam always available via HUD button; proximity optional
    cands.sort((a, b) => a.d - b.d);
    return cands[0] || null;
  }

  checkInteract() {
    const n = this.nearestInteract();
    this.currentTarget = n;
    const el = document.getElementById('interact-prompt');
    if (n && (n.kind !== 'kalam' || n.d < 3)) { el.innerHTML = `<span>${n.label}</span><kbd>E</kbd>`; el.classList.remove('hidden'); }
    else el.classList.add('hidden');
  }

  doInteract() {
    if (!this.inGame || this.busy) return;
    const n = this.currentTarget;
    if (!n) return;
    AudioSys.click();
    if (n.kind === 'npc') this.openDialogue(n.ref.def);
    else if (n.kind === 'item') this.takeCollectible(n.ref, false);
    else if (n.kind === 'gate') this.openGate();
    else if (n.kind === 'seal') this.takeSeal();
    else if (n.kind === 'portal') this.enterPortal();
    else if (n.kind === 'final') this.openFinal();
    else if (n.kind === 'kalam') this.toggleKalam(true);
  }

  takeCollectible(c, silent) {
    if (c.taken) return;
    c.taken = true;
    c.mesh.visible = false;
    const lvl = levelById(this.levelId);
    this.found++;
    Save.addPoints(lvl.collectible.points);
    Save.addArtifact(this.levelId, `${this.levelId}-${c.i}`, c.name);
    AudioSys.collect();
    if (!silent) {
      const r = this.renderer.domElement.getBoundingClientRect();
      burst(r.width / 2, r.height / 2 - 40);
      toast(`${lvl.collectible.icon} ARTIFACT FOUND! +${lvl.collectible.points}  (${this.found}/${lvl.collectible.target} ${lvl.collectible.name}s)`);
      this.kalamSay(`${c.name}: ${(ARTIFACT_INFO[this.levelId][c.i] || {}).fact || 'A piece of history!'}`);
    }
    this.checkNewAchievements();
    this.updateHUD();
    if (this.found >= lvl.collectible.target && !this.quizPassed) {
      setTimeout(() => { toast('🔱 HISTORY GATE UNLOCKED! Walk to the glowing gate.', 3400); AudioSys.portal(); }, 700);
    }
  }

  openGate() {
    const lvl = levelById(this.levelId);
    if (this.found < lvl.collectible.target) {
      toast(`🔒 Find ${lvl.collectible.target - this.found} more ${lvl.collectible.name}s first! Follow the golden glows.`);
      AudioSys.fail();
      return;
    }
    if (this.quizPassed) { toast('Gate is open — the puzzle already awaits its solver…'); this.openPuzzleNow(); return; }
    this.busy = true;
    openQuiz({
      title: lvl.gateQuizTitle, questions: QUIZZES[this.levelId], passCount: 4,
      onPass: (score, total) => {
        this.busy = false;
        this.quizPassed = true;
        Save.recordQuiz(this.levelId, score, total);
        Save.addPoints(score * 5);
        this.checkNewAchievements();
        this.updateHUD();
        toast('✅ Gate cleared! A puzzle mechanism clicks open…', 2800);
        setTimeout(() => this.openPuzzleNow(), 900);
      },
      onClose: () => { this.busy = false; }
    });
  }

  openPuzzleNow() {
    this.busy = true;
    openPuzzle(this.levelId, { onSolve: () => {
      this.busy = false;
      this.sealReady = true;
      this.world.seal.mesh.visible = true;
      AudioSys.seal();
      toast('✨ TIME SEAL APPEARS! Walk to it and collect!', 3400);
      this.updateHUD();
    }});
    // allow closing puzzle without soft-lock: X button sets busy=false
    const obs = new MutationObserver(() => {
      if (document.getElementById('puzzle-modal').classList.contains('hidden') && !this.sealReady) this.busy = false;
    });
    obs.observe(document.getElementById('puzzle-modal'), { attributes: true });
    setTimeout(() => obs.disconnect(), 120000);
  }

  takeSeal() {
    if (!this.sealReady || this.levelDone) return;
    this.levelDone = true;
    const lvl = levelById(this.levelId);
    Save.addPoints(50);
    Save.completeLevel(this.levelId, true);
    this.world.seal.mesh.visible = false;
    AudioSys.seal();
    const r = this.renderer.domElement.getBoundingClientRect();
    burst(r.width / 2, r.height / 2 - 60);
    this.checkNewAchievements();
    this.updateHUD();
    // portal appears spectacularly
    this.portalReady = true;
    this.world.portal.mesh.visible = true;
    AudioSys.portal();
    this.showResults(lvl);
  }

  enterPortal() {
    AudioSys.portal();
    toast(`🌀 Entering the portal to ${levelById(this.levelId).portalTo}…`, 2200);
    document.getElementById('fade').classList.remove('hidden');
    setTimeout(() => {
      document.getElementById('fade').classList.add('hidden');
      const next = this.levelId + 1;
      if (next <= 5) this.startLevel(next);
      else { this.renderLevelCards(); this.updateMenuSeals(); this.toChronoMap(); toast('🗺️ All seals found! Enter the FINAL HISTORY CHAMBER!', 3600); }
    }, 1100);
  }

  openFinal() {
    this.busy = true;
    openQuiz({
      title: '🏆 FINAL HISTORY CHAMBER', questions: FINAL_QUESTIONS, passCount: 4,
      onPass: (score) => {
        this.busy = false;
        Save.completeFinal();
        Save.addPoints(100);
        this.checkNewAchievements();
        AudioSys.seal();
        this.showVictory(score);
      },
      onClose: () => { this.busy = false; }
    });
  }

  // ================= DIALOGUE / KALAM =================
  openDialogue(def) {
    this.busy = true;
    AudioSys.talk();
    let i = 0;
    const box = document.getElementById('dialogue');
    box.classList.remove('hidden');
    document.getElementById('dlg-name').textContent = `${def.icon} ${def.name}`;
    const next = () => {
      AudioSys.click();
      if (i >= def.lines.length) { box.classList.add('hidden'); this.busy = false; return; }
      document.getElementById('dlg-text').textContent = def.lines[i];
      document.getElementById('dlg-next').textContent = i === def.lines.length - 1 ? 'Farewell →' : 'Continue →';
      i++;
    };
    document.getElementById('dlg-next').onclick = next;
    next();
  }

  kalamSay(text) {
    const log = document.getElementById('kalam-log');
    const d = document.createElement('div');
    d.className = 'kalam-msg kalam'; d.textContent = `🤖 Kalam: ${text}`;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
  }
  toggleKalam(force) {
    const p = document.getElementById('kalam-panel');
    const show = force === true ? true : p.classList.contains('hidden');
    p.classList.toggle('hidden', !show);
    if (show) AudioSys.click();
  }
  async askKalam() {
    const inp = document.getElementById('kalam-input');
    const q = inp.value.trim(); if (!q) return;
    inp.value = '';
    const log = document.getElementById('kalam-log');
    const u = document.createElement('div'); u.className = 'kalam-msg you'; u.textContent = `You: ${q}`;
    log.appendChild(u);
    const lvl = levelById(this.levelId);
    const a = await getHistoricalAnswer(q, { levelId: this.levelId, levelName: lvl?.name, era: lvl?.era });
    const d = document.createElement('div'); d.className = 'kalam-msg kalam'; d.textContent = a;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    AudioSys.talk();
  }

  // ================= HUD / SCREENS =================
  updateHUD() {
    if (this.finalMode) {
      document.getElementById('hud-mission').textContent = '🏆 FINAL HISTORY CHAMBER — Attempt the console quiz';
      document.getElementById('hud-progress').textContent = `🔱 Seals ${Save.data.seals.length}/5`;
    } else {
      const lvl = levelById(this.levelId);
      document.getElementById('hud-mission').textContent = `L${this.levelId} · ${lvl.mission}`;
      const extra = this.quizPassed ? (this.sealReady ? ' · ✨ Seal ready!' : ' · 🧩 Solve the puzzle!') : '';
      document.getElementById('hud-progress').textContent = `${lvl.collectible.icon} ${this.found}/${lvl.collectible.target}${extra}`;
    }
    document.getElementById('hud-points').textContent = `⭐ ${Save.data.historyPoints}`;
    const art = Object.values(Save.data.artifacts).reduce((a, b) => a + b, 0);
    document.getElementById('hud-art').textContent = `🏺 ${art}`;
    document.getElementById('hud-seals').textContent = `🔱 ${Save.data.seals.length}/5`;
  }

  checkNewAchievements() {
    for (const id of Save.data.achievements) {
      if (!this.knownAch.has(id)) {
        this.knownAch.add(id);
        const def = ACHIEVEMENTS.find(a => a.id === id);
        if (def) achievementPopup(def);
      }
    }
    this.renderAchv();
  }

  showResults(lvl) {
    this.busy = true;
    const stars = Save.data.stars[this.levelId] || 1;
    document.getElementById('results-title').textContent = 'LEVEL COMPLETE!';
    document.getElementById('results-seal').textContent = lvl.sealName;
    document.getElementById('results-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('results-detail').textContent =
      `${lvl.collectible.icon} ${this.found}/${lvl.collectible.target} · Quiz best ${Save.data.quizScores[this.levelId] || 0}/5 · +50 seal bonus`;
    document.getElementById('results-next').textContent =
      this.levelId < 5 ? `🌀 Enter Portal to ${lvl.portalTo} →` : '🗺️ Return to Chrono Map →';
    document.getElementById('results-modal').classList.remove('hidden');
    AudioSys.success();
  }

  showVictory(score) {
    this.busy = true;
    const art = Object.values(Save.data.artifacts).reduce((a, b) => a + b, 0);
    document.getElementById('victory-stats').innerHTML =
      `TIME SEALS: <b>5/5</b> · ARTIFACTS: <b>${art}</b><br>HISTORY POINTS: <b>${Save.data.historyPoints}</b> · FINAL SCORE: <b>${score}/5</b>`;
    document.getElementById('victory-modal').classList.remove('hidden');
    AudioSys.success();
    setTimeout(() => AudioSys.portal(), 800);
  }

  renderLevelCards() {
    const wrap = document.getElementById('level-cards');
    wrap.innerHTML = '';
    LEVELS.forEach(l => {
      const locked = l.id > Save.data.unlocked;
      const done = Save.data.completed.includes(l.id);
      const card = document.createElement('button');
      card.className = 'level-card' + (locked ? ' locked' : ' open') + (done ? ' done' : '');
      card.innerHTML = `
        <div class="lc-icon">${locked ? '🔒' : l.icon}</div>
        <div class="lc-name">Level ${l.id} — ${l.name}</div>
        <div class="lc-era">${l.era}</div>
        <div class="lc-status">${locked ? '🔒 LOCKED' : done ? `✅ Done · ${'⭐'.repeat(Save.data.stars[l.id] || 1)} · ${Save.data.seals.includes(l.id) ? '🔱 Seal' : ''}` : '✨ UNLOCKED'}</div>
        <div class="lc-art">🏺 ${Save.data.artifacts[l.id] || 0}/${l.collectible.target}</div>`;
      if (!locked) card.addEventListener('click', () => { AudioSys.click(); this.startLevel(l.id); });
      else card.addEventListener('click', () => { AudioSys.fail(); toast('🔒 Complete the previous era to unlock this portal!'); });
      wrap.appendChild(card);
    });
    const fin = document.createElement('button');
    const funlock = Save.data.unlocked >= 6 && Save.data.seals.length >= 5;
    fin.className = 'level-card final' + (funlock ? ' open' : ' locked');
    fin.innerHTML = `<div class="lc-icon">${funlock ? '🏆' : '🔒'}</div><div class="lc-name">Final History Chamber</div>
      <div class="lc-era">All five eras united</div>
      <div class="lc-status">${funlock ? (Save.data.finalDone ? '✅ Guardian of Time!' : '✨ UNLOCKED') : '🔒 Collect 5 seals'}</div>`;
    fin.addEventListener('click', () => {
      if (funlock) { AudioSys.click(); this.startLevel(6); }
      else { AudioSys.fail(); toast('🔒 Recover all five Time Seals first!'); }
    });
    wrap.appendChild(fin);
  }

  renderMuseum() {
    const wrap = document.getElementById('museum-grid');
    wrap.innerHTML = '';
    LEVELS.forEach(l => {
      const sec = document.createElement('div'); sec.className = 'mus-sec';
      sec.innerHTML = `<h3>${l.icon} ${l.name}</h3>`;
      const grid = document.createElement('div'); grid.className = 'mus-grid';
      (ARTIFACT_INFO[l.id] || []).forEach((a, i) => {
        const owned = Save.data.museum.includes(`${l.id}-${i}`);
        const d = document.createElement('div');
        d.className = 'mus-item' + (owned ? '' : ' ghost');
        d.innerHTML = `<div class="mus-emoji">${owned ? l.collectible.icon : '❔'}</div>
          <b>${owned ? a.name : '???'}</b><p>${owned ? a.fact : 'Find this artifact in ' + l.name + '.'}</p>`;
        grid.appendChild(d);
      });
      sec.appendChild(grid); wrap.appendChild(sec);
    });
    document.getElementById('museum-count').textContent = `🏺 ${Save.data.museum.length} artifacts recovered`;
  }

  renderAchv() {
    const wrap = document.getElementById('achv-list');
    if (!wrap) return;
    wrap.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
      const has = Save.data.achievements.includes(a.id);
      const d = document.createElement('div');
      d.className = 'ach-row' + (has ? ' has' : '');
      d.innerHTML = `<span class="ach-ic">${has ? a.icon : '🔒'}</span><div><b>${a.name}</b><br><small>${a.desc}</small></div>`;
      wrap.appendChild(d);
    });
  }

  updateMenuSeals() {
    document.getElementById('menu-seals').textContent =
      `🔱 Time Seals: ${Save.data.seals.length}/5 · ⭐ ${Save.data.historyPoints} · 🏺 ${Save.data.museum.length}`;
  }

  toChronoMap() { this.inGame = false; this.renderLevelCards(); this.updateMenuSeals(); this.menuOrbit(); showScreen('screen-levels'); }

  applySettings() {
    const s = Save.data.settings;
    AudioSys.setEnabled(s.music, s.sfx);
    this.renderer.setPixelRatio(s.quality === 'low' ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = s.quality !== 'low';
    document.getElementById('set-music').checked = s.music;
    document.getElementById('set-sfx').checked = s.sfx;
    document.getElementById('set-quality').value = s.quality;
  }

  // ================= INPUTS =================
  bindInputs() {
    const key = (code, v) => {
      if (code === 'KeyW' || code === 'ArrowUp') this.input.f = v;
      if (code === 'KeyS' || code === 'ArrowDown') this.input.b = v;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.l = v;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.r = v;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.run = v;
    };
    window.addEventListener('keydown', e => {
      if (e.code === 'Space') { this.input.jump = true; e.preventDefault(); }
      if (e.code === 'KeyE') this.doInteract();
      if (e.code === 'KeyI') this.toggleInventory();
      if (e.code === 'Escape') this.togglePause();
      key(e.code, true);
    });
    window.addEventListener('keyup', e => key(e.code, false));
    // mouse orbit (drag) + wheel zoom
    const cv = this.renderer.domElement;
    let drag = false, lx = 0, ly = 0;
    cv.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; AudioSys.init(); });
    window.addEventListener('pointerup', () => drag = false);
    window.addEventListener('pointermove', e => {
      if (!drag || !this.inGame) return;
      this.camYaw -= (e.clientX - lx) * 0.005;
      this.camPitch = Math.max(0.08, Math.min(1.2, this.camPitch + (e.clientY - ly) * 0.004));
      lx = e.clientX; ly = e.clientY;
    });
    cv.addEventListener('wheel', e => {
      this.camDist = Math.max(5, Math.min(14, this.camDist + e.deltaY * 0.01));
    }, { passive: true });
    // touch joystick
    const joy = document.getElementById('joystick'), knob = document.getElementById('joy-knob');
    let jid = null, jcx = 0, jcy = 0;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px,${dy}px)`; };
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; const r = joy.getBoundingClientRect(); jcx = r.left + r.width / 2; jcy = r.top + r.height / 2; joy.setPointerCapture(e.pointerId); });
    joy.addEventListener('pointermove', e => {
      if (e.pointerId !== jid) return;
      let dx = e.clientX - jcx, dy = e.clientY - jcy;
      const m = Math.hypot(dx, dy), max = 44;
      if (m > max) { dx = dx / m * max; dy = dy / m * max; }
      setKnob(dx, dy);
      this.joy.x = dx / max; this.joy.y = dy / max;
    });
    const endJoy = e => { if (e.pointerId === jid) { jid = null; setKnob(0, 0); this.joy.x = 0; this.joy.y = 0; } };
    joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
    document.getElementById('btn-jump').addEventListener('click', () => { this.input.jump = true; setTimeout(() => this.input.jump = false, 120); });
    document.getElementById('btn-act').addEventListener('click', () => this.doInteract());
    document.getElementById('btn-inv').addEventListener('click', () => this.toggleInventory());
    document.getElementById('btn-kalam-m').addEventListener('click', () => this.toggleKalam());
  }

  toggleInventory() {
    const p = document.getElementById('inventory-panel');
    p.classList.toggle('hidden');
    if (!p.classList.contains('hidden')) {
      AudioSys.click();
      const lvl = levelById(this.levelId);
      document.getElementById('inv-body').innerHTML = `
        <div class="inv-row">⭐ History Points: <b>${Save.data.historyPoints}</b></div>
        <div class="inv-row">🔱 Time Seals: <b>${Save.data.seals.length}/5</b> ${Save.data.seals.map(s => levelById(s)?.sealName || '').join(' ')}</div>
        <div class="inv-row">${lvl && !this.finalMode ? lvl.collectible.icon + ' ' + lvl.collectible.name + 's: <b>' + this.found + '/' + lvl.collectible.target + '</b>' : '🏆 Final Chamber'}</div>
        <div class="inv-row">🏺 Museum artifacts: <b>${Save.data.museum.length}</b></div>
        <div class="inv-row">🗺️ Levels complete: <b>${Save.data.completed.length}/5</b></div>`;
    }
  }

  togglePause(force) {
    if (!this.inGame) return;
    const p = document.getElementById('pause-menu');
    const show = force !== undefined ? force : p.classList.contains('hidden');
    p.classList.toggle('hidden', !show);
    this.busy = show || !document.getElementById('dialogue').classList.contains('hidden');
    if (show) AudioSys.click();
  }

  // ================= MENUS =================
  bindMenuButtons() {
    const go = (id) => { AudioSys.init(); AudioSys.click(); showScreen(id); };
    document.getElementById('btn-play').addEventListener('click', () => { AudioSys.click(); this.renderLevelCards(); go('screen-levels'); });
    document.getElementById('btn-levels').addEventListener('click', () => { AudioSys.click(); this.renderLevelCards(); go('screen-levels'); });
    document.getElementById('btn-museum').addEventListener('click', () => { AudioSys.click(); this.renderMuseum(); go('screen-museum'); });
    document.getElementById('btn-achv').addEventListener('click', () => { AudioSys.click(); this.renderAchv(); go('screen-achv'); });
    document.getElementById('btn-settings').addEventListener('click', () => go('screen-settings'));
    document.getElementById('btn-demo').addEventListener('click', () => { AudioSys.click(); this.startLevel(1, { demo: true }); });
    document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => {
      AudioSys.click();
      if (this.inGame && !this.menuFromPause) { this.toChronoMap(); return; }
      this.updateMenuSeals(); showScreen('screen-menu');
    }));
    document.getElementById('btn-resume').addEventListener('click', () => {
      AudioSys.click();
      const id = Math.min(Save.data.unlocked, 5);
      if (this.inGame) this.togglePause(false);
      else this.startLevel(Save.data.currentLevel && Save.data.currentLevel <= Save.data.unlocked ? Save.data.currentLevel : id);
    });
    // pause
    document.getElementById('btn-pause').addEventListener('click', () => this.togglePause(true));
    document.getElementById('btn-continue').addEventListener('click', () => this.togglePause(false));
    document.getElementById('btn-quit-map').addEventListener('click', () => {
      AudioSys.click(); document.getElementById('pause-menu').classList.add('hidden'); this.busy = false; this.toChronoMap();
    });
    document.getElementById('btn-pause-kalam').addEventListener('click', () => { this.togglePause(false); this.toggleKalam(true); });
    // results
    document.getElementById('results-next').addEventListener('click', () => {
      AudioSys.click(); document.getElementById('results-modal').classList.add('hidden'); this.busy = false; this.renderLevelCards();
      if (this.levelId < 5) this.enterPortal();
      else this.toChronoMap();
    });
    document.getElementById('results-map').addEventListener('click', () => {
      AudioSys.click(); document.getElementById('results-modal').classList.add('hidden'); this.busy = false; this.toChronoMap();
    });
    document.getElementById('victory-map').addEventListener('click', () => {
      AudioSys.click(); document.getElementById('victory-modal').classList.add('hidden'); this.busy = false; this.toChronoMap();
    });
    // hud buttons
    document.getElementById('btn-inv-hud').addEventListener('click', () => this.toggleInventory());
    document.getElementById('btn-kalam-hud').addEventListener('click', () => this.toggleKalam());
    document.getElementById('inv-close').addEventListener('click', () => this.toggleInventory());
    document.getElementById('kalam-close').addEventListener('click', () => this.toggleKalam());
    document.getElementById('kalam-ask').addEventListener('click', () => this.askKalam());
    document.getElementById('kalam-input').addEventListener('keydown', e => { if (e.key === 'Enter') this.askKalam(); e.stopPropagation(); });
    document.querySelectorAll('.kalam-chip').forEach(c => c.addEventListener('click', () => {
      document.getElementById('kalam-input').value = c.textContent; this.askKalam();
    }));
    // modal closes
    document.getElementById('quiz-close').addEventListener('click', () => {
      document.getElementById('quiz-modal').classList.add('hidden'); this.busy = false;
    });
    document.getElementById('puzzle-close').addEventListener('click', () => {
      document.getElementById('puzzle-modal').classList.add('hidden'); this.busy = false;
    });
    // settings
    document.getElementById('set-music').addEventListener('change', e => { Save.data.settings.music = e.target.checked; Save.write(); this.applySettings(); if (this.inGame) AudioSys.music(this.finalMode ? 6 : this.levelId); });
    document.getElementById('set-sfx').addEventListener('change', e => { Save.data.settings.sfx = e.target.checked; Save.write(); this.applySettings(); });
    document.getElementById('set-quality').addEventListener('change', e => { Save.data.settings.quality = e.target.value; Save.write(); this.applySettings(); });
    document.getElementById('btn-reset').addEventListener('click', () => {
      if (confirm('Reset all progress?')) { Save.reset(); this.knownAch = new Set(); this.renderLevelCards(); this.renderMuseum(); this.renderAchv(); this.updateMenuSeals(); toast('Progress reset. A new quest begins!'); }
    });
  }
}

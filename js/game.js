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
    this.qIndex = -1; this.quest = null; this.waypoint = null; this.wpDist = null; this.dlgCb = null;
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
    ['quiz-modal', 'puzzle-modal', 'results-modal', 'victory-modal', 'pause-menu', 'dialogue', 'inventory-panel', 'mission-modal', 'artifact-modal', 'journal-modal'].forEach(m => document.getElementById(m).classList.add('hidden'));
    this.finalMode = (id === 5);
    this.levelId = id;
    this.inGame = true;
    this.scene.clear();
    this.waypoint = null;
    if (this.finalMode) {
      this.loadFinalChamber();
    } else {
      const lvl = levelById(id);
      this.world = buildWorld(THREE, this.scene, lvl);
      this.player = createPlayer(THREE, this.scene, this.world.spawn);
      this.player.onStep = () => AudioSys.step();
      this.player.onJump = () => AudioSys.jump();
      this.found = 0; this.quizPassed = false; this.sealReady = false; this.portalReady = false; this.levelDone = false;
      this.quest = lvl.quest; this.qIndex = -1;
      this.makeWaypoint();
      this.setQuestVisuals();
      this.renderJournal();
      if (opts.demo) { // hackathon demo: briefing done for you, first 3 in order
        this.qIndex = 0;
        [0, 1, 2].forEach(i => { const c = this.world.collectibles[i]; if (c) this.collectNow(c, true); });
        this.qIndex = 3; this.setQuestVisuals(); this.renderJournal();
        setTimeout(() => toast(`🎬 DEMO MODE — briefing done, 3 tablets found in order! Follow the ▼ to Artifact 4!`, 3600), 600);
      } else {
        this.showMission(); // busy until dismissed
      }
      AudioSys.music(id);
      this.updateHUD();
      this.kalamSay(`Namaste! I am Kalam. ${lvl.mission}.`);
    }
    this.freePlayer(false); // guarantee spawn starts on open ground
    this.stuckT = 0; this.stuckMark = null;
    this.discovered = new Set(); // landmark discoveries reset per visit
    document.getElementById('discover-card').classList.add('hidden');
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

  // ================= SEQUENTIAL QUEST SYSTEM =================
  makeWaypoint() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.font = '88px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ffd23e'; g.shadowBlur = 18;
    g.fillStyle = '#ffd23e'; g.fillText('▼', 64, 62);
    this.waypoint = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, color: 0xffe9a8
    }));
    this.waypoint.scale.set(1.5, 1.5, 1);
    this.scene.add(this.waypoint);
  }

  giverNPC() {
    if (!this.world || !this.quest) return null;
    return this.world.npcs.find(n => n.def.name === this.quest.giver) || this.world.npcs[0] || null;
  }

  questTarget() {
    if (this.finalMode || !this.world) return null;
    const lvl = levelById(this.levelId);
    if (this.portalReady) return { pos: this.world.portal.pos, y: 4.6 };
    if (this.sealReady && !this.levelDone) return { pos: this.world.seal.pos, y: 2.6 };
    if (this.quizPassed) return { pos: this.world.gate.pos, y: 5.6 };
    if (this.qIndex < 0) { const g = this.giverNPC(); return g ? { pos: g.mesh.position, y: 2.9 } : null; }
    if (this.qIndex < lvl.collectible.target) {
      const c = this.world.collectibles[this.qIndex];
      return c && !c.taken ? { pos: c.pos, y: 2.3 } : null;
    }
    return { pos: this.world.gate.pos, y: 5.6 };
  }

  currentObjective() {
    if (this.finalMode) return 'Attempt the Final Challenge';
    const lvl = levelById(this.levelId);
    if (this.portalReady) return `Enter the portal to ${lvl.portalTo}`;
    if (this.levelDone) return 'Level complete!';
    if (this.sealReady) return 'Collect the Time Seal';
    if (this.quizPassed) return 'Solve the puzzle mechanism';
    const n = lvl.collectible.target;
    if (this.qIndex < 0) return `Talk to ${this.quest?.giver || 'the guide'}`;
    if (this.qIndex < n) return `Find Artifact ${this.qIndex + 1} of ${n}`;
    return 'Enter the History Gate';
  }

  currentClue() {
    if (this.finalMode || !this.quest) return '';
    if (this.qIndex < 0) return `Find ${this.quest.giver} — follow the golden ▼ marker.`;
    if (this.qIndex < this.quest.artifacts.length) return this.quest.artifacts[this.qIndex].clue;
    return this.quest.done;
  }

  // Only the active artifact glows; the rest wait sealed and dim.
  setQuestVisuals() {
    if (!this.world || this.finalMode) return;
    for (const c of this.world.collectibles) {
      const u = c.mesh.userData || {};
      const active = !c.taken && c.i === this.qIndex;
      if (u.halo) u.halo.visible = active;
      if (u.core && u.core.material && 'emissiveIntensity' in u.core.material)
        u.core.material.emissiveIntensity = c.taken ? 0 : active ? 0.55 : 0.07;
      c.mesh.scale.setScalar(active ? 1.15 : 1);
    }
  }

  showMission() {
    const lvl = levelById(this.levelId);
    this.busy = true;
    document.getElementById('mission-kicker').textContent = `NEW MISSION · LEVEL ${lvl.id}`;
    document.getElementById('mission-title').textContent = lvl.name.toUpperCase();
    document.getElementById('mission-era').textContent = lvl.era;
    document.getElementById('mission-text').textContent = lvl.quest.brief;
    document.getElementById('mission-objective').textContent = `🎯 First objective: talk to ${lvl.quest.giver}.`;
    document.getElementById('mission-modal').classList.remove('hidden');
    AudioSys.portal();
  }

  dismissMission() {
    AudioSys.click();
    document.getElementById('mission-modal').classList.add('hidden');
    this.busy = false;
    this.renderJournal(); this.updateHUD();
    toast(`🎯 OBJECTIVE: Talk to ${this.quest.giver}. Follow the golden ▼!`, 3600);
  }

  showArtifactFound(c) {
    const lvl = levelById(this.levelId);
    const info = (ARTIFACT_INFO[this.levelId] || [])[c.i] || {};
    const n = lvl.collectible.target;
    document.getElementById('art-icon').textContent = lvl.collectible.icon;
    document.getElementById('art-title').textContent = `ARTIFACT ${c.i + 1} OF ${n} FOUND!`;
    document.getElementById('art-name').textContent = info.name || c.name;
    document.getElementById('art-fact').textContent = info.fact || '';
    document.getElementById('art-points').textContent = `+${lvl.collectible.points} HISTORY POINTS`;
    document.getElementById('artifact-modal').classList.remove('hidden');
    this.busy = true;
    AudioSys.success();
  }

  dismissArtifact() {
    AudioSys.click();
    document.getElementById('artifact-modal').classList.add('hidden');
    this.busy = false;
    const lvl = levelById(this.levelId);
    const n = lvl.collectible.target;
    this.qIndex++;
    this.setQuestVisuals();
    this.renderJournal(); this.updateHUD();
    if (this.qIndex >= n) {
      this.kalamSay(lvl.quest.done);
      setTimeout(() => { toast('🔱 HISTORY GATE UNLOCKED! Walk to the glowing gate.', 3400); AudioSys.portal(); }, 400);
    } else {
      const qa = lvl.quest.artifacts[this.qIndex];
      this.kalamSay(lvl.quest.artifacts[this.qIndex - 1].praise);
      toast(`🔍 NEW CLUE — Artifact ${this.qIndex + 1}: ${qa.clue}`, 5200);
    }
  }

  renderJournal() {
    const body = document.getElementById('journal-body');
    if (!body) return;
    if (this.finalMode || !this.quest) {
      body.innerHTML = `<div class="inv-row">🏆 <b>Final History Chamber</b> — answer questions from all four eras.</div>`;
      return;
    }
    const lvl = levelById(this.levelId);
    const n = lvl.collectible.target;
    const chips = this.quest.artifacts.map((a, i) =>
      `<span class="j-chip ${i < this.found ? 'done' : i === this.qIndex ? 'now' : ''}">${i < this.found ? '✅' : `#${i + 1}`} ${a.name}</span>`
    ).join('');
    const facts = (ARTIFACT_INFO[this.levelId] || []).slice(0, this.found)
      .map(f => `<div class="inv-row">📜 <b>${f.name}</b> — ${f.fact}</div>`).join('');
    body.innerHTML = `
      <div class="inv-row">🗺️ <b>${lvl.name}</b> · <small>${lvl.era}</small></div>
      <div class="inv-row">🎯 <b>Objective:</b> ${this.currentObjective()}</div>
      <div class="inv-row">🔍 <b>Clue:</b> ${this.currentClue()}</div>
      <div class="j-chips">${chips}</div>
      ${facts}`;
  }

  toggleJournal() {
    if (!this.inGame) return;
    const p = document.getElementById('journal-modal');
    p.classList.toggle('hidden');
    if (!p.classList.contains('hidden')) { AudioSys.click(); this.renderJournal(); }
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
    // ---- SLICE 2 chamber dressing (visual only — no logic touched) ----
    const outerFloor = new THREE.Mesh(new THREE.RingGeometry(20, 30, 40),
      new THREE.MeshStandardMaterial({ color: 0x241a4e, roughness: 0.7 }));
    outerFloor.rotation.x = -Math.PI / 2; outerFloor.position.y = -0.01; this.scene.add(outerFloor);
    for (let ci = 0; ci < 12; ci++) { // distant colonnade ring (beyond reach)
      const a = (ci / 12) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 7, 8),
        new THREE.MeshStandardMaterial({ color: 0x6a5a9a, roughness: 0.7 }));
      col.position.set(Math.cos(a) * 24, 3.5, Math.sin(a) * 24); this.scene.add(col);
    }
    const eraCols = [0xcf6b2e, 0xe8c547, 0x4aa3df, 0xb678e8];
    for (let bi = 0; bi < 4; bi++) { // era banners
      const a = (bi / 4) * Math.PI * 2 + Math.PI / 4;
      const bx = Math.cos(a) * 16, bz = Math.sin(a) * 16;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 5, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a2f5a, roughness: 0.7 }));
      pole.position.set(bx, 2.5, bz); this.scene.add(pole);
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6),
        new THREE.MeshStandardMaterial({ color: eraCols[bi], emissive: eraCols[bi], emissiveIntensity: 0.35, side: THREE.DoubleSide }));
      ban.position.set(bx, 3.6, bz); ban.rotation.y = -a; this.scene.add(ban);
      this.world.colliders.push({ x: bx, z: bz, r: 0.4 });
    }
    const pedTops = [0xcf6b2e, 0xe8c547, 0x4aa3df, 0xb678e8, 0xffe066, 0x35e0ff, 0xd94f3d, 0x7dff9a];
    this.finalRelics = [];
    for (let pi = 0; pi < 8; pi++) { // museum pedestals with mini relics
      const a = (pi / 8) * Math.PI * 2 + Math.PI / 8;
      const px = Math.cos(a) * 13.5, pz = Math.sin(a) * 13.5;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.1, 10),
        new THREE.MeshStandardMaterial({ color: 0xd9b06a, roughness: 0.6 }));
      ped.position.set(px, 0.55, pz); ped.castShadow = true; this.scene.add(ped);
      const relic = new THREE.Mesh(new THREE.OctahedronGeometry(0.32),
        new THREE.MeshStandardMaterial({ color: pedTops[pi], emissive: pedTops[pi], emissiveIntensity: 0.9, roughness: 0.3 }));
      relic.position.set(px, 1.5, pz); this.scene.add(relic);
      this.finalRelics.push(relic);
      this.world.colliders.push({ x: px, z: pz, r: 0.9 });
    }
    const timeline = new THREE.Mesh(new THREE.TorusGeometry(11.5, 0.12, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    timeline.rotation.x = Math.PI / 2; timeline.position.y = 0.04; this.scene.add(timeline);
    this.world.dynamics.push((dt, t) => { this.finalPillars.forEach((s, i) => { s.rotation.y += dt * (1 + i * 0.2); s.position.y = 3.6 + Math.sin(t * 2 + i) * 0.15; }); (this.finalRelics || []).forEach((r, i) => { r.rotation.y += dt * 1.5; r.position.y = 1.5 + Math.sin(t * 2 + i) * 0.08; }); });
    this.player = createPlayer(THREE, this.scene, this.world.spawn);
    this.player.onStep = () => AudioSys.step();
    this.player.onJump = () => AudioSys.jump();
    AudioSys.music(5);
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
      // camera follow (+ SLICE 3: pull-in so big walls don't swallow the view)
      const p = this.player.group.position;
      let cx = p.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
      let cz = p.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
      let cy = p.y + 1.6 + Math.sin(this.camPitch) * this.camDist;
      if (cy < 1.0) cy = 1.0;
      if (this.world.colliders) {
        const hx = p.x, hy = p.y + 1.7, hz = p.z;
        let dx = cx - hx, dy = cy - hy, dz = cz - hz;
        const len = Math.hypot(dx, dy, dz) || 0.001;
        dx /= len; dy /= len; dz /= len;
        let best = len;
        for (const c of this.world.colliders) {
          if (c.r < 1.4) continue; // buildings/walls/towers only, not props/NPCs
          const ox = c.x - hx, oz = c.z - hz;
          const t = ox * dx + oz * dz;
          if (t < 1 || t > len) continue;
          const perp = Math.hypot(ox - dx * t, oz - dz * t);
          if (perp < c.r + 0.45 && hy + dy * t < 5 && t - 0.7 < best) best = Math.max(1.2, t - 0.7);
        }
        if (best < len) { cx = hx + dx * best; cy = hy + dy * best; cz = hz + dz * best; if (cy < 1.0) cy = 1.0; }
      }
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
      // waypoint marker tracks the live objective + distance readout
      if (this.waypoint && !this.finalMode) {
        const tg = this.questTarget();
        if (tg) {
          this.waypoint.visible = true;
          this.waypoint.position.set(tg.pos.x, tg.y + Math.sin(t * 3) * 0.15, tg.pos.z);
          this.wpDist = Math.hypot(p.x - tg.pos.x, p.z - tg.pos.z);
        } else { this.waypoint.visible = false; this.wpDist = null; }
      } else if (this.waypoint) this.waypoint.visible = false;
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
      // landmark discovery: walking into a famous place pops its story card
      if (!this.finalMode && this.world.landmarks) {
        for (const lm of this.world.landmarks) {
          const key = this.levelId + '|' + lm.title;
          if (this.discovered.has(key)) continue;
          const dx = p.x - lm.x, dz = p.z - lm.z;
          if (dx * dx + dz * dz < lm.r * lm.r) { this.discoverLandmark(lm, key); break; }
        }
      }
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
      const isGiver = this.quest && n.def.name === this.quest.giver;
      if (d < 3.2) cands.push({ kind: 'npc', ref: n, d, label: isGiver && this.qIndex < 0 ? `💬 TALK TO ${n.def.name.toUpperCase()} ❗` : `💬 TALK — ${n.def.name}` });
    }
    for (const c of this.world.collectibles) {
      if (c.taken) continue;
      const d = p.distanceTo(c.pos);
      if (d < 2.8) {
        if (c.i === this.qIndex) cands.push({ kind: 'item', ref: c, d, label: `🔍 INVESTIGATE — ${this.quest.artifacts[c.i]?.name || lvl.collectible.name}` });
        else cands.push({ kind: 'locked', ref: c, d, label: `🔒 SEALED BY TIME — find Artifact ${this.qIndex + 1} first` });
      }
    }
    if (this.world.gate) {
      const d = p.distanceTo(this.world.gate.pos);
      if (d < 4) cands.push({
        kind: 'gate', d,
        label: this.qIndex >= lvl.collectible.target ? (this.quizPassed ? '🔱 GATE OPEN — puzzle solved?' : '🔱 ENTER HISTORY GATE (Quiz)') : `🔱 HISTORY GATE — ${lvl.collectible.target - this.found} artifacts still hidden`
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
    else if (n.kind === 'locked') {
      AudioSys.fail();
      const lvl = levelById(this.levelId);
      toast(this.qIndex < 0
        ? `🔒 The past is silent. First, talk to ${this.quest.giver} — follow the ▼!`
        : `🔒 Not yet! Your clue points to Artifact ${this.qIndex + 1} (${lvl.quest.artifacts[this.qIndex].name}).`);
    }
    else if (n.kind === 'gate') this.openGate();
    else if (n.kind === 'seal') this.takeSeal();
    else if (n.kind === 'portal') this.enterPortal();
    else if (n.kind === 'final') this.openFinal();
    else if (n.kind === 'kalam') this.toggleKalam(true);
  }

  takeCollectible(c, silent) {
    if (c.taken) return false;
    if (c.i !== this.qIndex) { // sequence enforcement — cannot skip ahead
      if (!silent) {
        AudioSys.fail();
        toast(this.qIndex < 0
          ? `🔒 The past is silent. First, talk to ${this.quest.giver}.`
          : `🔒 Not yet! Your clue points to Artifact ${this.qIndex + 1}.`);
      }
      return false;
    }
    this.collectNow(c, silent);
    return true;
  }

  collectNow(c, silent) {
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
      this.showArtifactFound(c);
    }
    this.checkNewAchievements();
    this.setQuestVisuals();
    this.renderJournal();
    this.updateHUD();
  }

  openGate() {
    const lvl = levelById(this.levelId);
    if (this.qIndex < lvl.collectible.target) {
      toast(`🔒 The gate is silent — ${lvl.collectible.target - this.found} artifact(s) still hide in the city. ${this.qIndex < 0 ? `Talk to ${this.quest.giver} first!` : 'Follow your clue! (J for journal)'}`);
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
      if (next <= 4) this.startLevel(next);
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

  discoverLandmark(lm, key) {
    this.discovered.add(key);
    Save.addPoints(5);
    AudioSys.collect();
    this.updateHUD();
    document.getElementById('disc-icon').textContent = lm.icon;
    document.getElementById('disc-title').textContent = lm.title;
    document.getElementById('disc-fact').textContent = lm.fact;
    const card = document.getElementById('discover-card');
    card.classList.remove('hidden');
    clearTimeout(card._h);
    card._h = setTimeout(() => card.classList.add('hidden'), 4200);
  }

  // ================= DIALOGUE (steps + player choices) =================
  // step = { text } | { text, choice: [{ t, then: [steps] }] }
  buildDialogue(def) {
    const lvl = levelById(this.levelId);
    const isGiver = this.quest && def.name === this.quest.giver;
    if (!isGiver) {
      const steps = def.lines.map(text => ({ text }));
      steps.push({ text: `💡 ${def.name.split(' ')[0]}’s hint — ${this.currentObjective()}: “${this.truncClue()}”` });
      return { steps, cb: null };
    }
    const n = this.quest.artifacts.length;
    if (this.qIndex < 0) {
      return {
        steps: [
          { text: def.lines[0] },
          { text: def.lines[1] },
          { text: 'How will you begin your search?', choice: [
            { t: '“What should I look for?”', then: [{ text: '🔍 ' + this.quest.artifacts[0].clue }] },
            { t: '“Tell me about this place.”', then: [
              { text: `You stand in ${lvl.name} — ${lvl.tagline}` },
              { text: '🔍 ' + this.quest.artifacts[0].clue } ] }
          ] }
        ],
        cb: () => { // briefing accepted → quest begins
          this.qIndex = 0;
          this.setQuestVisuals(); this.renderJournal(); this.updateHUD();
          toast(`🔍 NEW CLUE — Artifact 1: ${this.quest.artifacts[0].clue}`, 5200);
          this.kalamSay(`Quest begun! ${this.quest.artifacts[0].clue}`);
        }
      };
    }
    if (this.qIndex < n) {
      return {
        steps: [
          { text: 'Still searching? Good — patience is a historian’s finest tool.' },
          { text: '🔍 ' + this.quest.artifacts[this.qIndex].clue },
          { text: 'The golden ▼ in the sky marks where your feet should wander. Press J any time to re-read your journal.' }
        ],
        cb: null
      };
    }
    if (!this.quizPassed) {
      return { steps: [{ text: this.quest.done }, { text: 'The gate glows blue ahead. Show it what you have learned!' }], cb: null };
    }
    return { steps: [{ text: 'The past is proud of you, Guardian. Finish what you started!' }], cb: null };
  }

  truncClue() {
    const c = this.currentClue();
    return c.length > 110 ? c.slice(0, 110) + '…' : c;
  }

  openDialogue(def) {
    this.busy = true;
    AudioSys.talk();
    const { steps, cb } = this.buildDialogue(def);
    this.dlgCb = cb;
    let i = 0;
    const box = document.getElementById('dialogue');
    const textEl = document.getElementById('dlg-text');
    const nextBtn = document.getElementById('dlg-next');
    const chEl = document.getElementById('dlg-choices');
    box.classList.remove('hidden');
    document.getElementById('dlg-name').textContent = `${def.icon} ${def.name}`;
    const show = () => {
      chEl.innerHTML = '';
      if (i >= steps.length) {
        box.classList.add('hidden'); this.busy = false;
        if (this.dlgCb) { const cb2 = this.dlgCb; this.dlgCb = null; cb2(); }
        return;
      }
      const st = steps[i];
      textEl.textContent = st.text;
      if (st.choice) {
        nextBtn.classList.add('hidden');
        st.choice.forEach(opt => {
          const b = document.createElement('button');
          b.className = 'btn choice'; b.textContent = opt.t;
          b.addEventListener('click', () => {
            AudioSys.click();
            nextBtn.classList.remove('hidden');
            steps.splice(i + 1, 0, ...opt.then);
            i++; show();
          });
          chEl.appendChild(b);
        });
      } else {
        nextBtn.classList.remove('hidden');
        nextBtn.textContent = i === steps.length - 1 ? (this.dlgCb ? 'Begin the search →' : 'Farewell →') : 'Continue →';
      }
    };
    nextBtn.onclick = () => { AudioSys.click(); i++; show(); };
    show();
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
      document.getElementById('hud-progress').textContent = `🔱 Seals ${Save.data.seals.length}/4`;
    } else {
      const lvl = levelById(this.levelId);
      document.getElementById('hud-mission').textContent = `🎯 ${this.currentObjective()}`;
      let extra = '';
      if (this.quizPassed && !this.sealReady) extra = ' · 🧩 Solve the puzzle!';
      else if (this.sealReady && !this.levelDone) extra = ' · ✨ Seal ready!';
      const dist = this.wpDist != null ? ` · ▼ ${Math.round(this.wpDist)}m` : '';
      document.getElementById('hud-progress').textContent = `${lvl.collectible.icon} ${this.found}/${lvl.collectible.target}${dist}${extra}`;
    }
    document.getElementById('hud-points').textContent = `⭐ ${Save.data.historyPoints}`;
    const art = Object.values(Save.data.artifacts).reduce((a, b) => a + b, 0);
    document.getElementById('hud-art').textContent = `🏺 ${art}`;
    document.getElementById('hud-seals').textContent = `🔱 ${Save.data.seals.length}/4`;
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
      this.levelId < 4 ? `🌀 Enter Portal to ${lvl.portalTo} →` : '🗺️ Return to Chrono Map →';
    document.getElementById('results-modal').classList.remove('hidden');
    AudioSys.success();
  }

  showVictory(score) {
    this.busy = true;
    const art = Object.values(Save.data.artifacts).reduce((a, b) => a + b, 0);
    document.querySelector('#victory-modal .oath').textContent =
      '“Congratulations! You have recovered all four Time Seals and become a Guardian of Time!”';
    document.getElementById('victory-stats').innerHTML =
      `TIME SEALS: <b>4/4</b> · ARTIFACTS: <b>${art}</b><br>HISTORY POINTS: <b>${Save.data.historyPoints}</b> · FINAL SCORE: <b>${score}/5</b>`;
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
    const funlock = Save.data.unlocked >= 5 && Save.data.seals.length >= 4;
    fin.className = 'level-card final' + (funlock ? ' open' : ' locked');
    fin.innerHTML = `<div class="lc-icon">${funlock ? '🏆' : '🔒'}</div><div class="lc-name">Final History Chamber</div>
      <div class="lc-era">All four eras united</div>
      <div class="lc-status">${funlock ? (Save.data.finalDone ? '✅ Guardian of Time!' : '✨ UNLOCKED') : '🔒 Collect 4 seals'}</div>`;
    fin.addEventListener('click', () => {
      if (funlock) { AudioSys.click(); this.startLevel(5); }
      else { AudioSys.fail(); toast('🔒 Recover all four Time Seals first!'); }
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
      `🔱 Time Seals: ${Save.data.seals.length}/4 · ⭐ ${Save.data.historyPoints} · 🏺 ${Save.data.museum.length}`;
  }

  toChronoMap() { this.inGame = false; this.renderLevelCards(); this.updateMenuSeals(); this.menuOrbit(); showScreen('screen-levels'); }

  applySettings() {
    const s = Save.data.settings;
    if (!['high', 'medium', 'low'].includes(s.quality)) s.quality = 'high';
    AudioSys.setEnabled(s.music, s.sfx);
    // HIGH: full detail · MEDIUM: balanced · LOW: aggressive (also tighter on touch)
    this.renderer.setPixelRatio(
      s.quality === 'low' ? 1 : s.quality === 'medium' ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
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
      if (e.code === 'KeyJ') this.toggleJournal();
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
        <div class="inv-row">🔱 Time Seals: <b>${Save.data.seals.length}/4</b> ${Save.data.seals.map(s => levelById(s)?.sealName || '').join(' ')}</div>
        <div class="inv-row">${lvl && !this.finalMode ? lvl.collectible.icon + ' ' + lvl.collectible.name + 's: <b>' + this.found + '/' + lvl.collectible.target + '</b>' : '🏆 Final Chamber'}</div>
        <div class="inv-row">🏺 Museum artifacts: <b>${Save.data.museum.length}</b></div>
        <div class="inv-row">🗺️ Levels complete: <b>${Save.data.completed.length}/4</b></div>`;
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
      const id = Math.min(Save.data.unlocked, 4);
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
      if (this.levelId < 4) this.enterPortal();
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
    document.getElementById('btn-journal-hud').addEventListener('click', () => this.toggleJournal());
    document.getElementById('journal-close').addEventListener('click', () => this.toggleJournal());
    document.getElementById('mission-go').addEventListener('click', () => this.dismissMission());
    document.getElementById('art-continue').addEventListener('click', () => this.dismissArtifact());
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
    document.getElementById('set-music').addEventListener('change', e => { Save.data.settings.music = e.target.checked; Save.write(); this.applySettings(); if (this.inGame) AudioSys.music(this.finalMode ? 5 : this.levelId); });
    document.getElementById('set-sfx').addEventListener('change', e => { Save.data.settings.sfx = e.target.checked; Save.write(); this.applySettings(); });
    document.getElementById('set-quality').addEventListener('change', e => { Save.data.settings.quality = e.target.value; Save.write(); this.applySettings(); });
    document.getElementById('btn-reset').addEventListener('click', () => {
      if (confirm('Reset all progress?')) { Save.reset(); this.knownAch = new Set(); this.renderLevelCards(); this.renderMuseum(); this.renderAchv(); this.updateMenuSeals(); toast('Progress reset. A new quest begins!'); }
    });
  }
}

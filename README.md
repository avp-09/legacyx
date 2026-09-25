# 🏛️ LEGACY — The Living City

A playable 3D **Guardians of Time** adventure through Indian history, built for a hackathon demo (ages 9–15).
Zero build step — pure **Three.js (CDN) + vanilla JS modules**.

## ▶ Run it

Serve over HTTP (ES modules + CDN require it):

```bash
npx serve . -l 8080
# or
python -m http.server 8080
# or
npm start
```

Then open **http://localhost:8080**. Use Chrome/Edge with internet (Three.js CDN).

## 🎮 Controls

| Input | Action |
|---|---|
| WASD / Arrows | Move (Shift = run) |
| Mouse-drag | Orbit camera · wheel = zoom |
| Space | Jump |
| E | Interact / Talk / Collect |
| I | Inventory |
| Esc | Pause |
| J | Quest journal |
| Touch | Left joystick + E / ⤒ / 🤖 / 🎒 buttons |

## 🔁 Core loop (every level — sequential treasure hunt)

Mission briefing → talk to the guide NPC → receive Clue 1 → explore → collect
Artifact 1 (others stay sealed) → Clue 2 → … → History Gate quiz (4/5 to pass,
kind retry) → final puzzle → Time Seal → portal → next era unlocked.

A golden ▼ waypoint, live objective + distance readout, and the 📜 journal
(current clue, progress, collected facts) always show the next step.

## 🗺️ Levels (4 eras + final)

1. **The Lost City** (Indus Valley) — 5 tablets, drainage-pipe puzzle
2. **The Scholar's Challenge** (Nalanda) — 5 scrolls, library shelving puzzle
3. **Rise of the Cholas** — 5 blueprint pieces, vimana stacking puzzle
4. **The Fort of Secrets** — 4 inscription shards, four trials
5. **🏆 Final History Chamber** — mixed quiz from all four eras

Plus: main menu, Chrono Map level select, History Museum, achievements,
inventory, pause menu, results/victory screens, localStorage saves,
synthesized music/SFX (no assets), demo mode, and **Kalam 🤖** the history
guide with a RAG-ready `getHistoricalAnswer(question, context)` interface
(`js/kalam.js`) that works offline and accepts a future LLM endpoint.

## 📁 Architecture

```
index.html          all screens + HUD + modals
css/style.css       full UI theme
js/main.js          boot
js/game.js          orchestrator: loop, quests, seals, portals, HUD, saves
js/world.js         procedural 3D environments (one builder per era)
js/player.js        stylized character + movement + camera-relative controls
js/data.js          levels, NPCs, quizzes, artifacts, achievements (data-driven)
js/quiz.js          quiz overlay
js/puzzles.js       5 final puzzles
js/save.js          localStorage progression
js/audio.js         WebAudio synth SFX + generative music
js/kalam.js         AI guide + RAG interface + offline KB
js/ui.js            toast / achievement / screen helpers
```

## ✅ Demo script (2–3 min for judges)

1. Main menu → **🎬 DEMO MODE** (Level 1, 3 tablets pre-found)
2. WASD to a golden glow → **E** → artifact + Kalam fact
3. **E** on City Elder → clue dialogue
4. Collect remaining → **History Gate** → quiz → drainage puzzle → **Time Seal** → results → portal
5. Open **🤖 Kalam**, ask “Why is Nalanda important?”
6. Show Museum + Achievements (progress persisted across refresh)

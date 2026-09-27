// Procedural stylized environments — one builder per era, shared helpers.
// No external models; lighting + fog + props keep every level distinct.
import { ARTIFACT_INFO } from './data.js';

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export function buildWorld(THREE, scene, level) {
  const R = rng(level.id * 7919 + 13);
  const H = {
    scene, THREE, R,
    colliders: [],
    bounds: 24,
    npcs: [], collectibles: [], landmarks: [], ambient: [], clouds: [],
    dynamics: [], // fn(dt,t)
    gate: null, seal: null, portal: null
  };

  // ============ VISUAL SYSTEMS: material cache, canvas textures, glow, sky ============
  // All shared/cached — identical property sets reuse one GPU program/material.
  const matCache = new Map();
  function hex(v, fb = 0xffffff) {
    if (v === undefined || v === null) return fb;
    if (typeof v === 'number') return v;
    if (v && typeof v.getHex === 'function') return v.getHex();
    return fb;
  }
  // getMaterial({color, roughness, metalness, emissive, emissiveIntensity,
  //   transparent, opacity, map, flatShading, side, depthWrite, basic})
  // NOTE: never route through here a material you mutate per-frame
  // (gate bar, portal disc, collectible core, glow rings) — those stay unique.
  function getMaterial(o = {}) {
    const key = [
      hex(o.color).toString(16), (+(o.roughness ?? 0.85)).toFixed(2), (+(o.metalness ?? 0)).toFixed(2),
      hex(o.emissive, 0).toString(16), (+(o.emissiveIntensity ?? 1)).toFixed(2),
      o.transparent ? 1 : 0, (+(o.opacity ?? 1)).toFixed(3), (o.map && o.map.key) || '', o.flatShading ? 1 : 0,
      o.side ?? 0, o.depthWrite === false ? 0 : 1, o.basic ? 1 : 0
    ].join('|');
    let m = matCache.get(key);
    if (!m) {
      const params = {
        color: hex(o.color),
        roughness: o.roughness ?? 0.85,
        metalness: o.metalness ?? 0,
        side: o.side ?? 0
      };
      if (o.emissive !== undefined) { params.emissive = hex(o.emissive, 0); params.emissiveIntensity = o.emissiveIntensity ?? 1; }
      if (o.transparent) { params.transparent = true; params.opacity = o.opacity ?? 1; }
      if (o.map) params.map = o.map.tex;
      if (o.flatShading) params.flatShading = true;
      if (o.depthWrite === false) params.depthWrite = false;
      m = o.basic
        ? new THREE.MeshBasicMaterial(params)
        : new THREE.MeshStandardMaterial(params);
      matCache.set(key, m);
    }
    return m;
  }

  // ---- procedural canvas textures (tiny, cached, zero downloads) ----
  const texCache = new Map();
  function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function makeTex(id, size, painter, rx = 1, ry = 1) {
    const key = `${id}|${rx}x${ry}`;
    let t = texCache.get(key);
    if (!t) {
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      painter(cv.getContext('2d'), size, lcg(id.length * 7919 + size * 131 + rx * 17 + ry * 31));
      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(rx, ry);
      tex.anisotropy = 4;
      t = { tex, key };
      texCache.set(key, t);
    }
    return t;
  }
  function speckle(g, size, rnd, n, colors, aMin, aMax, sMin, sMax) {
    for (let i = 0; i < n; i++) {
      g.globalAlpha = aMin + rnd() * (aMax - aMin);
      g.fillStyle = colors[(rnd() * colors.length) | 0];
      const s = sMin + rnd() * (sMax - sMin);
      g.fillRect(rnd() * size, rnd() * size, s, s);
    }
    g.globalAlpha = 1;
  }
  function T_brick(base, mortar, rx = 2, ry = 2) {
    return makeTex(`brick${base}${mortar}`, 128, (g, S, rnd) => {
      g.fillStyle = mortar; g.fillRect(0, 0, S, S);
      const bh = S / 8, bw = S / 4;
      for (let r = 0; r < 8; r++) {
        const off = (r % 2) * bw / 2;
        for (let cx = -1; cx < 5; cx++) {
          const shade = 0.9 + rnd() * 0.2;
          g.fillStyle = '#' + new THREE.Color(base).multiplyScalar(shade).getHexString();
          g.fillRect(cx * bw + off + 1, r * bh + 1, bw - 2, bh - 2);
        }
      }
      speckle(g, S, rnd, 260, ['#000000', '#ffffff'], 0.03, 0.09, 1, 2.5);
    }, rx, ry);
  }
  function T_stone(base, rx = 2, ry = 2) {
    return makeTex(`stone${base}`, 128, (g, S, rnd) => {
      g.fillStyle = base; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 26; i++) { // soft mineral blotches
        g.globalAlpha = 0.05 + rnd() * 0.07;
        g.fillStyle = rnd() > 0.5 ? '#ffffff' : '#3a2f22';
        g.beginPath(); g.arc(rnd() * S, rnd() * S, 6 + rnd() * 18, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      speckle(g, S, rnd, 320, ['#000000', '#ffffff'], 0.03, 0.08, 1, 2);
    }, rx, ry);
  }
  function T_ground(base, rx = 10, ry = 10) {
    return makeTex(`ground${base}`, 256, (g, S, rnd) => {
      g.fillStyle = base; g.fillRect(0, 0, S, S);
      speckle(g, S, rnd, 1400, ['#000000', '#ffffff', base], 0.03, 0.1, 1, 3);
      for (let i = 0; i < 40; i++) { // pebbles
        g.globalAlpha = 0.25 + rnd() * 0.3;
        g.fillStyle = rnd() > 0.5 ? '#ffffff' : '#4a3d2c';
        g.beginPath(); g.arc(rnd() * S, rnd() * S, 1 + rnd() * 2.2, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    }, rx, ry);
  }
  function T_wood(base, rx = 1, ry = 1) {
    return makeTex(`wood${base}`, 128, (g, S, rnd) => {
      g.fillStyle = base; g.fillRect(0, 0, S, S);
      for (let x = 0; x < S; x += 3) { // grain
        g.globalAlpha = 0.08 + rnd() * 0.12;
        g.fillStyle = rnd() > 0.4 ? '#2e1f10' : '#d9b98a';
        g.fillRect(x, 0, 1 + rnd() * 2, S);
      }
      g.globalAlpha = 1;
    }, rx, ry);
  }
  function T_plaster(base, rx = 2, ry = 2) {
    return makeTex(`plaster${base}`, 128, (g, S, rnd) => {
      g.fillStyle = base; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 18; i++) {
        g.globalAlpha = 0.04 + rnd() * 0.06;
        g.fillStyle = rnd() > 0.5 ? '#ffffff' : '#8a7452';
        g.beginPath(); g.arc(rnd() * S, rnd() * S, 8 + rnd() * 22, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      speckle(g, S, rnd, 200, ['#000000'], 0.02, 0.06, 1, 2);
    }, rx, ry);
  }

  // ---- reusable additive glow sprites (replace per-object PointLights) ----
  const glowTexCache = new Map();
  function glowTexture(color) {
    const key = (color | 0).toString(16);
    let t = glowTexCache.get(key);
    if (!t) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const g = cv.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#' + new THREE.Color(color).getHexString());
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      t = new THREE.CanvasTexture(cv);
      glowTexCache.set(key, t);
    }
    return t;
  }
  function addGlow(x, y, z, color, s = 2.2, opacity = 0.55) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(color), transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sp.scale.set(s, s, 1); sp.position.set(x, y, z);
    scene.add(sp);
    return sp;
  }

  // ---- gradient sky dome (per-era tones, no flat background) ----
  function buildSky() {
    const top = '#' + new THREE.Color(level.sky).multiplyScalar(0.42).getHexString();
    const mid = '#' + new THREE.Color(level.sky).getHexString();
    const hor = '#' + new THREE.Color(level.sky).lerp(new THREE.Color(0xfff6e0), 0.45).getHexString();
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
    const g = cv.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top); grad.addColorStop(0.55, mid); grad.addColorStop(0.8, hor); grad.addColorStop(1, hor);
    g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(cv);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(240, 20, 14),
      getMaterial({ color: 0xffffff, map: { tex, key: `sky${level.id}` }, side: 2, depthWrite: false, basic: true })
    );
    dome.material.fog = false;
    scene.add(dome);
  }

  // ---------- atmosphere ----------
  buildSky();
  scene.fog = new THREE.Fog(level.fog, 34, 125);
  const hemi = new THREE.HemisphereLight(0xffffff, level.ground, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48;
  scene.add(sun);
  H.dynamics.push(() => {});

  // ---------- ground ----------
  const groundMat = getMaterial({ color: 0xffffff, roughness: 1, map: T_ground('#' + level.ground.toString(16).padStart(6, '0')) });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(78, 40), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // plaza disc
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 28),
    getMaterial({ color: 0xf5e6c4, roughness: 0.9 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.01; plaza.receiveShadow = true;
  scene.add(plaza);

  const box = (w, h, d, color, x, z, y = 0, ry = 0, collide = 0, tex = null) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      tex ? getMaterial({ color: 0xffffff, roughness: 0.92, map: tex }) : getMaterial({ color, roughness: 0.85 }));
    m.position.set(x, y + h / 2, z); m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (collide) H.colliders.push({ x, z, r: collide });
    return m;
  };
  const cyl = (rt, rb, h, color, x, z, y = 0, seg = 12, tex = null) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg),
      tex ? getMaterial({ color: 0xffffff, roughness: 0.9, map: tex }) : getMaterial({ color, roughness: 0.8 }));
    m.position.set(x, y + h / 2, z); m.castShadow = true;
    scene.add(m); return m;
  };

  // distant hills + clouds (depth on zero budget)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(10 + R() * 8, 9 + R() * 7, 7),
      getMaterial({ color: new THREE.Color(level.ground).multiplyScalar(0.72), roughness: 1 }));
    hill.position.set(Math.cos(a) * 66, 0, Math.sin(a) * 66);
    scene.add(hill);
  }
  for (let i = 0; i < 6; i++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(2 + R() * 2, 10, 8),
      getMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 }));
    cl.position.set((R() - 0.5) * 80, 30 + R() * 10, (R() - 0.5) * 80);
    cl.scale.x = 1.8; scene.add(cl); H.clouds.push(cl);
    const sp = 0.2 + R() * 0.4;
    H.dynamics.push((dt) => { cl.position.x += sp * dt; if (cl.position.x > 55) cl.position.x = -55; });
  }

  // ---------- shared props ----------
  const LEAF = [0x3e8e4f, 0x4da35a, 0x2f7a3e, 0x6fae4e];
  function tree(x, z, s = 1) {
    cyl(0.22 * s, 0.34 * s, 1.7 * s, 0xffffff, x, z, 0, 12, T_wood('#6b4423'));
    // layered canopy — three blobs so it reads as a real tree, not a lollipop
    const blobs = [
      [0, 2.5, 0, 1.35], [0.75, 2.0, 0.3, 0.9], [-0.7, 2.05, -0.35, 0.95], [0.1, 3.15, -0.1, 0.8]
    ];
    blobs.forEach(([ox, oy, oz, r], i) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(r * s, 12, 10),
        getMaterial({ color: LEAF[(i + (x > 0 ? 1 : 0)) % LEAF.length], roughness: 0.95, flatShading: true }));
      c.position.set(x + ox * s, oy * s, z + oz * s);
      c.castShadow = true; scene.add(c);
    });
    if (s > 1.7) { // banyan: hanging aerial roots + wide shade
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        cyl(0.09, 0.12, 2.2 * s, 0xffffff, x + Math.cos(a) * 1.5 * s, z + Math.sin(a) * 1.5 * s, 0.4, 8, T_wood('#7a5a35'));
      }
    }
    H.colliders.push({ x, z, r: 0.6 * s });
  }
  function banner(x, z, color) {
    cyl(0.06, 0.06, 4, 0x4a3220, x, z);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8),
      getMaterial({ color, side: 2, roughness: 0.7 }));
    f.position.set(x + 0.75, 3.4, z); scene.add(f);
    H.dynamics.push((dt, t) => { f.rotation.y = Math.sin(t * 2 + x) * 0.35; });
  }
  function stall(x, z, awn, ry = 0) {
    const cosr = Math.cos(ry), sinr = Math.sin(ry);
    const L = (lx, lz) => [x + lx * cosr - lz * sinr, z + lx * sinr + lz * cosr];
    // counter + goods on top (fruit, grain, pots)
    box(2.4, 0.9, 1.4, 0xffffff, x, z, 0, ry, 1.6, T_wood('#8a5a2b'));
    const goods = [0xd94f3d, 0xe8a13c, 0x7ab648, 0xb5542d];
    goods.forEach((g, i) => {
      const [gx, gz] = L(-0.8 + i * 0.55, 0.1);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8),
        getMaterial({ color: g, roughness: 0.6 }));
      m.position.set(gx, 1.05, gz); m.castShadow = true; scene.add(m);
    });
    // striped awning: alternating slats
    for (let i = 0; i < 6; i++) {
      const [sx, sz] = L(-1.25 + i * 0.5, 0);
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 2.0),
        getMaterial({ color: i % 2 ? 0xfff6e2 : awn, roughness: 0.7 }));
      slat.position.set(sx, 1.95, sz); slat.rotation.y = ry; slat.castShadow = true; scene.add(slat);
    }
    for (const px of [-1.3, 1.3]) for (const pz of [-0.85, 0.85]) {
      const [qx, qz] = L(px, pz);
      cyl(0.05, 0.05, 1.9, 0x4a3220, qx, qz);
    }
    // crates beside the stall
    const [bx2, bz2] = L(1.7, 0.4);
    box(0.7, 0.7, 0.7, 0x9a6a35, bx2, bz2, 0, ry + 0.3);
    box(0.55, 0.55, 0.55, 0x7a5228, bx2, bz2, 0.7, ry - 0.2);
  }
  function pot(x, z, color = 0xb5542d, s = 1) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.4 * s, 12, 10),
      getMaterial({ color, roughness: 0.6 }));
    p.position.set(x, 0.32 * s, z); p.scale.y = 1.15; p.castShadow = true; scene.add(p);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22 * s, 0.07 * s, 8, 14),
      getMaterial({ color: 0x7a3a1e, roughness: 0.6 }));
    rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.72 * s, z); scene.add(rim);
  }
  function torch(x, z) {
    cyl(0.07, 0.09, 1.6, 0x3a2a1a, x, z);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8),
      getMaterial({ color: 0xffb13c, emissive: 0xff7a00, emissiveIntensity: 2 }));
    fl.position.set(x, 1.8, z); scene.add(fl);
    addGlow(x, 2, z, 0xff9a2e, 2.4, 0.5); // sprite glow, no PointLight
    H.dynamics.push((dt, t) => { fl.scale.setScalar(1 + Math.sin(t * 9 + x * 3) * 0.18); });
  }
  function glowRing(x, z, color = 0x35e0ff, y = 0.05) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, y, z); scene.add(ring);
    H.dynamics.push((dt, t) => {
      ring.scale.setScalar(1 + Math.sin(t * 3 + x) * 0.12);
      ring.material.opacity = 0.6 + Math.sin(t * 3 + z) * 0.25;
    });
    return ring;
  }
  function floaty(mesh, baseY, x, z) {
    H.dynamics.push((dt, t) => {
      mesh.position.y = baseY + Math.sin(t * 2 + x) * 0.18;
      mesh.rotation.y += dt * 1.2;
    });
  }

  // ---------- NPC mesh ----------
  function npcMesh(color, icon) {
    const grp = new THREE.Group();
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.3, 12),
      getMaterial({ color, roughness: 0.8 }));
    robe.position.y = 0.65; robe.castShadow = true; grp.add(robe);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12),
      getMaterial({ color: 0xb5773f, roughness: 0.7 }));
    hd.position.y = 1.5; hd.castShadow = true; grp.add(hd);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      getMaterial({ color: 0xffffff, roughness: 0.7 }));
    cap.position.y = 1.55; grp.add(cap);
    if (icon) {
    // floating icon sprite via canvas
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d');
    cx.font = '84px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(icon, 64, 70);
    const tex = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(0.9, 0.9, 1); spr.position.y = 2.3; grp.add(spr);
    }
    scene.add(grp);
    return { grp };
  }

  // Bullock cart: bed, big spoked wheels, draft pole, hay load.
  function cart(x, z, ry = 0) {
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry;
    const wood = getMaterial({ color: 0x7a5228, roughness: 0.85, map: T_wood('#7a5228') });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 1.3), wood);
    bed.position.y = 1.0; bed.castShadow = true; grp.add(bed);
    [-0.85, 0.85].forEach(px => [-0.75, 0.75].forEach(pz => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), wood);
      rail.position.set(px, 1.35, pz); grp.add(rail);
    }));
    [-0.75, 0.75].forEach(pz => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.14, 12), wood);
      wheel.rotation.x = Math.PI / 2; wheel.position.set(0, 0.6, pz); wheel.castShadow = true; grp.add(wheel);
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8),
        getMaterial({ color: 0x4a3220, roughness: 0.85 }));
      hub.position.set(0, 0.6, pz + (pz > 0 ? 0.1 : -0.1)); grp.add(hub);
    });
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.4), wood);
    pole.position.set(0, 0.85, 1.9); pole.rotation.x = 0.12; grp.add(pole);
    const hay = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 1.0),
      getMaterial({ color: 0xd9b64a, roughness: 1, flatShading: true }));
    hay.position.y = 1.5; hay.castShadow = true; grp.add(hay);
    scene.add(grp);
    H.colliders.push({ x, z, r: 1.6 });
  }

  // Ambient walker: non-interactive life (merchants, students, guards…).
  // Stored in H.ambient so the interaction system never prompts for them.
  function ambient(color, waypoints, speed = 1.7) {
    const { grp } = npcMesh(color, null);
    grp.position.set(waypoints[0][0], 0, waypoints[0][1]);
    scene.add(grp);
    // NOTE: no collider — ambient figures are soft so no phantom walls trail them.
    const w = { mesh: grp, wps: waypoints, i: 1, speed };
    H.ambient.push(w);
    H.dynamics.push((dt, t) => {
      const tx = w.wps[w.i][0], tz = w.wps[w.i][1];
      const dx = tx - grp.position.x, dz = tz - grp.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) { w.i = (w.i + 1) % w.wps.length; return; }
      grp.position.x += dx / d * w.speed * dt;
      grp.position.z += dz / d * w.speed * dt;
      grp.rotation.y = Math.atan2(dx, dz);
      grp.position.y = Math.abs(Math.sin(t * 8)) * 0.06;
    });
  }

  // ---------- district helpers: streets, walls, varied houses ----------
  function street(x1, z1, x2, z2, w = 3, color = 0xe8d3a0) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    const horiz = Math.abs(dx) >= Math.abs(dz);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? len : w, horiz ? w : len),
      getMaterial({ color, roughness: 0.95 }));
    s.rotation.x = -Math.PI / 2; s.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
    s.receiveShadow = true; scene.add(s);
  }
  function wallRun(x1, z1, x2, z2, h = 3, color = 0xa5763e) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    const horiz = Math.abs(dx) >= Math.abs(dz);
    const n = Math.max(1, Math.round(len / 4));
    const wallTex = T_stone('#' + color.toString(16).padStart(6, '0'));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      box(horiz ? len / n + 0.4 : 1.6, h, horiz ? 1.6 : len / n + 0.4, 0xffffff, x1 + dx * t, z1 + dz * t, 0, 0, 0, wallTex);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len / n + 0.5 : 1.9, 0.3, horiz ? 1.9 : len / n + 0.5),
        getMaterial({ color: 0xffffff, roughness: 0.85, map: T_wood('#8a5a35') }));
      cap.position.set(x1 + dx * t, h + 0.15, z1 + dz * t); cap.castShadow = true; scene.add(cap);
    }
    const m = Math.max(2, Math.round(len / 3));
    for (let i = 0; i <= m; i++) { const t = i / m; H.colliders.push({ x: x1 + dx * t, z: z1 + dz * t, r: 2 }); }
  }
  function wallTower(x, z, r = 2.2, h = 6, color = 0xa5763e) {
    cyl(r * 0.9, r, h, 0xffffff, x, z, 0, 12, T_stone('#' + color.toString(16).padStart(6, '0')));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      getMaterial({ color: 0xffffff, roughness: 0.6, map: T_plaster('#e8d8a8', '#cfc09a') }));
    dome.position.set(x, h, z); dome.castShadow = true; scene.add(dome);
    H.colliders.push({ x, z, r: r + 0.3 });
  }
  function houseV(x, z, o = {}) {
    const w = o.w || 4.5, h = o.h || 2.8, d = o.d || 4, ry = o.ry || 0, c = o.c !== undefined ? o.c : 0xb5763f;
    const wtex = (c === 0xd9c49a || c === 0xd9b06a)
      ? T_plaster('#d9c49a', '#b8a67e')
      : T_brick('#' + c.toString(16).padStart(6, '0'), '#8a6a45');
    box(w, h, d, 0xffffff, x, z, 0, ry, o.r !== undefined ? o.r : 3, wtex);
    const fx = Math.sin(ry), fz = Math.cos(ry);
    if (o.roof === 'pyr') {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.55, 4),
        getMaterial({ color: 0xffffff, roughness: 0.9, map: T_wood('#8a5a2e'), flatShading: true }));
      roof.position.set(x, h + h * 0.27, z); roof.rotation.y = ry + Math.PI / 4; roof.castShadow = true; scene.add(roof);
    } else box(w + 0.5, 0.35, d + 0.5, 0xffffff, x, z, h, ry, 0, T_wood('#8a5a2e'));
    box(1.1, 1.7, 0.2, 0x3a2412, x + fx * (d / 2 + 0.03), z + fz * (d / 2 + 0.03), 0, ry); // door
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1),
      getMaterial({ color: 0x2e1c0c, emissive: 0xffb13c, emissiveIntensity: 0.3 }));
    win.position.set(x - fz * 1.3 + fx * 0.2, 1.6, z + fx * 1.3 + fz * 0.2);
    win.rotation.y = ry; scene.add(win);
  }

  // ---------- collectible mesh ----------
  const COLLECT_COLORS = { 1: 0xcf6b2e, 2: 0xe8c547, 3: 0x4aa3df, 4: 0xb678e8 };
  const COLLECT_GEO = { 1: 'tablet', 2: 'scroll', 3: 'piece', 4: 'shard' };
  function collectMesh(kind) {
    const grp = new THREE.Group();
    const col = new THREE.MeshStandardMaterial({
      color: COLLECT_COLORS[level.id] || 0xffd23e,
      emissive: COLLECT_COLORS[level.id] || 0xffd23e, emissiveIntensity: 0.55, roughness: 0.4
    });
    let core;
    if (kind === 'scroll') {
      core = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 10), col);
      core.rotation.z = Math.PI / 2;
    } else if (kind === 'shard') {
      core = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), col);
    } else if (kind === 'page') {
      core = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.06), new THREE.MeshStandardMaterial({ color: 0xf5efdc, emissive: 0xffe9a8, emissiveIntensity: 0.5 }));
    } else {
      core = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.16), col);
    }
    core.position.y = 1.0; core.castShadow = true; grp.add(core);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 24),
      getMaterial({ color: 0xffe066, basic: true }));
    halo.position.y = 1.0; grp.add(halo);
    const gl = addGlow(0, 1.2, 0, COLLECT_COLORS[level.id] || 0xffd23e, 2.6, 0.5);
    grp.add(gl); gl.position.set(0, 1.2, 0); // rides with the collectible group
    H.dynamics.push((dt, t) => { halo.rotation.y += dt * 2; halo.rotation.x = Math.sin(t * 2) * 0.4; });
    floaty(core, 1.0);
    grp.userData.halo = halo; grp.userData.core = core; // quest dimming hooks
    scene.add(grp);
    return grp;
  }

  // ---------- gate / seal / portal ----------
  function buildGate(x, z) {
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.6, metalness: 0.3 });
    [-1.6, 1.6].forEach(px => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.4, 0.7), mat);
      p.position.set(px, 2.2, 0); p.castShadow = true; grp.add(p);
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 0.8), mat);
    top.position.y = 4.6; top.castShadow = true; grp.add(top);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.6),
      new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
    bar.position.y = 2.1; grp.add(bar);
    const label = labelSprite('🔱 HISTORY GATE');
    label.position.y = 5.5; grp.add(label);
    scene.add(grp);
    H.colliders.push({ x: x - 1.6, z, r: 0.7 }, { x: x + 1.6, z, r: 0.7 });
    H.dynamics.push((dt, t, st) => {
      const open = st && st.gateOpen;
      bar.material.opacity = open ? 0.12 + Math.sin(t * 4) * 0.06 : 0.28;
      bar.material.color.set(open ? 0x7dff9a : 0x35e0ff);
    });
    return { mesh: grp, pos: new THREE.Vector3(x, 0, z), bar };
  }
  function labelSprite(text) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const cx = cv.getContext('2d');
    cx.fillStyle = 'rgba(20,12,4,0.72)'; cx.fillRect(0, 0, 512, 96);
    cx.font = 'bold 44px system-ui'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillStyle = '#ffe9a8'; cx.fillText(text, 256, 50);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
    sp.scale.set(5, 0.95, 1);
    return sp;
  }
  // Floating name-sign over a landmark + discovery zone registration.
  // No collider added — signs never block movement or collectibles.
  function addLandmark({ x, z, r = 4, icon = '📍', title, fact = '', signY = 4.6 }) {
    const label = labelSprite(`${icon} ${title}`);
    label.position.set(x, signY, z);
    scene.add(label);
    H.dynamics.push((dt, t) => { label.position.y = signY + Math.sin(t * 1.5 + x) * 0.12; });
    H.landmarks.push({ x, z, r, icon, title, fact });
    return label;
  }
  function buildSeal(x, z) {
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 16),
      new THREE.MeshStandardMaterial({ color: 0x5a5a6a, roughness: 0.5, metalness: 0.4 }));
    ped.position.y = 0.3; ped.castShadow = true; grp.add(ped);
    const seal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55),
      new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffb300, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.5 }));
    seal.position.y = 1.5; seal.castShadow = true; grp.add(seal);
    const li = new THREE.PointLight(0xffd23e, 12, 12); li.position.y = 1.8; grp.add(li);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 6, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 3.4; grp.add(beam);
    H.dynamics.push((dt, t) => { seal.rotation.y += dt * 2.2; seal.position.y = 1.5 + Math.sin(t * 2.4) * 0.15; });
    grp.visible = false; scene.add(grp);
    return { mesh: grp, pos: new THREE.Vector3(x, 0, z) };
  }
  function buildPortal(x, z) {
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.28, 14, 36),
      new THREE.MeshStandardMaterial({ color: 0x7a4de8, emissive: 0x9a6dff, emissiveIntensity: 1.4, roughness: 0.3 }));
    ring.position.y = 2.0; ring.castShadow = true; grp.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32),
      new THREE.MeshBasicMaterial({ color: 0xb99aff, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
    disc.position.y = 2.0; grp.add(disc);
    const li = new THREE.PointLight(0x9a6dff, 14, 14); li.position.y = 2.2; grp.add(li);
    const label = labelSprite('🌀 PORTAL — ENTER');
    label.position.y = 4.3; grp.add(label);
    H.dynamics.push((dt, t) => {
      ring.rotation.y += dt * 1.4;
      disc.material.opacity = 0.5 + Math.sin(t * 3) * 0.18;
      li.intensity = 12 + Math.sin(t * 3) * 4;
    });
    grp.visible = false; scene.add(grp);
    return { mesh: grp, pos: new THREE.Vector3(x, 0, z) };
  }

  // ================= LEVEL LAYOUTS =================
  const P = {
    gate: [0, -18], seal: [0, -13], portal: [8, -18],
    spawn: [0, 10], // [x, z] — must be open ground (verified per level below)
    items: [], npcSpots: []
  };

  if (level.id === 1) {
    P.bounds = 40;
    // Mohenjo-daro: brick houses grid, Great Bath, granary, drains
    const brick = 0xb5763f, brick2 = 0xa56635;
    const houses = [[-14, -4], [-14, 4], [-7, -10], [9, -8], [14, 2], [12, 10], [-4, 12], [-13, 12],
      [8, 18], [-8, 18], [20, -6], [20, 2]];
    houses.forEach(([x, z], i) => {
      const c = i % 2 ? brick : brick2;
      const h = 2.6 + (i % 3) * 0.5, ry = (i % 2) * 0.15;
      box(4.5, h, 4, 0xffffff, x, z, 0, ry, 3, T_brick(c === brick ? '#b5763f' : '#a56635', '#8a6a45'));
      box(5, 0.35, 4.5, 0xffffff, x, z, h, 0, 0, T_wood('#8a5a2e'));
      box(1.1, 1.7, 0.2, 0x3a2412, x, z + 2.05, 0);               // door
      box(1.5, 0.25, 0.25, 0x6b4423, x, z + 2.05, 1.7);           // lintel
      [-1.3, 1.3].forEach(wx => {                                 // windows with warm light
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1),
          getMaterial({ color: 0x2e1c0c, emissive: 0xffb13c, emissiveIntensity: 0.35 }));
        win.position.set(x + wx, 1.6, z + 2.02); scene.add(win);
      });
    });
    // GREAT BATH — stepped sunken pool with columns, instantly readable
    box(8.6, 0.5, 6.6, 0xffffff, -2, -8, 0, 0, 0, T_stone('#9a6a38', '#7d5630')); // rim platform
    const bathWater = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 3.8),
      getMaterial({ color: 0x2ea8d4, roughness: 0.1, metalness: 0.25, emissive: 0x0a4a66, emissiveIntensity: 0.35 }));
    bathWater.position.set(-2, 0.45, -8); scene.add(bathWater);
    H.dynamics.push((dt, t) => { bathWater.position.y = 0.45 + Math.sin(t * 1.6) * 0.04; });
    for (let s = 0; s < 3; s++)                                   // steps down (south side)
      box(3.2 - s * 0.5, 0.28, 0.6, 0xffffff, -2, -4.6 + s * 0.55, 0.35 - s * 0.12, 0, 0, T_stone('#7a5228', '#614722'));
    [[-5.4, -10.6], [1.4, -10.6], [-5.4, -5.4], [1.4, -5.4]].forEach(([cx2, cz2]) => {
      cyl(0.28, 0.34, 3.2, 0xffffff, cx2, cz2, 0, 12, T_stone('#c09a55', '#9c7c48')); // colonnade
      box(1, 0.3, 1, 0xffffff, cx2, cz2, 3.2, 0, 0, T_wood('#8a6a35'));
    });
    H.colliders.push({ x: -2, z: -8, r: 4.2 });
    addLandmark({ x: -2, z: -8, r: 5, icon: '🛁', title: 'THE GREAT BATH',
      fact: 'Mohenjo-daro had a watertight pool — probably used for ritual bathing 4,500 years ago!', signY: 5.2 });
    // GRANARY — raised pillared storehouse with grain sacks
    box(6.4, 0.7, 5.2, 0x8a6a45, -16, -14, 0, 0, 0);              // platform
    box(5.2, 2.4, 4, 0xffffff, -16, -14, 0.7, 0, 0, T_brick('#b5763f', '#8a6a45'));
    box(5.8, 0.35, 4.6, 0x8a5a2e, -16, -14, 3.1);
    [-1.9, -0.6, 0.6, 1.9].forEach(px => cyl(0.22, 0.26, 2.4, 0xc09a55, -16 + px, -11.6, 0.7));
    [[-18, -11.5], [-17.2, -11.2], [-14.2, -11.4]].forEach(([sx, sz]) => {
      const sack = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8),
        getMaterial({ color: 0xd9b06a, roughness: 0.9 }));
      sack.position.set(sx, 0.4, sz); sack.scale.y = 0.75; sack.castShadow = true; scene.add(sack);
    });
    H.colliders.push({ x: -16, z: -14, r: 3.9 });
    addLandmark({ x: -16, z: -14, r: 5.2, icon: '🌾', title: 'THE GRANARY',
      fact: 'Great storehouses held grain for the whole city — feeding thousands!', signY: 5.2 });
    // WELL — stone ring with posts, beam, rope and bucket
    cyl(1.1, 1.25, 1.2, 0xffffff, 10, 2, 0, 12, T_stone('#7a5a3a', '#5a4632'));
    cyl(0.85, 0.85, 1.25, 0x1a2a3a, 10, 2);                       // dark shaft
    [9.1, 10.9].forEach(px => cyl(0.09, 0.09, 2.4, 0x4a3220, px, 2));
    box(2.2, 0.15, 0.15, 0x4a3220, 10, 2, 2.3);
    box(0.35, 0.35, 0.35, 0x8a5a2b, 10, 2, 1.4);                  // hanging bucket
    H.colliders.push({ x: 10, z: 2, r: 1.5 });
    addLandmark({ x: 10, z: 2, r: 3, icon: '🪣', title: 'THE WELL',
      fact: 'Wells gave every neighbourhood fresh water, right beside the streets.', signY: 4.2 });
    // drainage channels (glowing blue lines)
    [[-10, 0, 12], [2, 6, 10], [-4, -14, 14]].forEach(([x, z, len]) => {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.5),
        getMaterial({ color: 0x35b6d9, emissive: 0x1e7fa8, emissiveIntensity: 0.7 }));
      ch.position.set(x, 0.06, z); scene.add(ch);
    });
    stall(-6, 4, 0xd94f3d); stall(-9, 4, 0x3d7bd9, 0.2); stall(-7.5, 7, 0x3d8a4f, -0.15);
    addLandmark({ x: -7.5, z: 5.4, r: 4.2, icon: '🏪', title: 'MARKETPLACE',
      fact: 'Merchants traded beads, pottery and grain — weights were carefully standardised!', signY: 4.4 });
    // north banner courtyard (quiet, residential)
    banner(-3, 17, 0xd94f3d); banner(3, 17, 0x3d7bd9);
    pot(-1.5, 18.5); pot(1.5, 18.5);
    // grand entrance arch on the south road
    [-2.2, 2.2].forEach(ax => { cyl(0.35, 0.42, 3.4, 0x9a6a38, ax, 15); H.colliders.push({ x: ax, z: 15, r: 0.6 }); });
    box(5.6, 0.6, 1, 0x8a5a2e, 0, 15, 3.4);
    addLandmark({ x: 0, z: 15, r: 4, icon: '⛩️', title: 'CITY GATE',
      fact: 'Travellers entered the planned city through gates like this one.', signY: 5 });
    // ---- SOUTH HOMES — second residential quarter, varied sizes ----
    [[-16, 22, 2.6], [-10, 24, 3.4], [-4, 22, 2.9], [2, 26, 2.5]].forEach(([x, z, h], i) => {
      const c = i % 2 ? brick2 : brick;
      box(4.5, h, 4, 0xffffff, x, z, 0, (i % 2) * -0.12, 3, T_brick(c === brick ? '#b5763f' : '#a56635', '#8a6a45'));
      box(5, 0.35, 4.5, 0xffffff, x, z, h, 0, 0, T_wood('#8a5a2e'));
      box(1.1, 1.7, 0.2, 0x3a2412, x + 1, z - 2.05, 0);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1),
        getMaterial({ color: 0x2e1c0c, emissive: 0xffb13c, emissiveIntensity: 0.3 }));
      win.position.set(x - 1.2, 1.6, z - 2.02); scene.add(win);
    });
    pot(-13, 23); pot(-7, 25); banner(-1, 24, 0x3d8a4f);
    addLandmark({ x: -7, z: 23, r: 4.5, icon: '🏘️', title: 'SOUTH HOMES',
      fact: 'Families lived in sturdy brick houses along straight, planned streets.', signY: 4.6 });
    // ---- WEST FARMS — fields, hut, scarecrow, trough, cart ----
    for (let rz = 0; rz < 4; rz++) {
      box(8, 0.12, 1.1, 0x6b4a26, -26.5, -18 + rz * 2, 0);
      for (let rx = 0; rx < 6; rx++) {
        const crop = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 7),
          getMaterial({ color: rx % 2 ? 0x7ab648 : 0xd9b64a, roughness: 0.9, flatShading: true }));
        crop.position.set(-30 + rx * 1.4, 0.5, -18 + rz * 2); crop.castShadow = true; scene.add(crop);
      }
    }
    box(3.5, 2.6, 3, brick2, -26, -4, 0, 0.1, 2.2);                    // farm hut
    const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(3, 1.6, 4),
      getMaterial({ color: 0x7a5a35, roughness: 0.9, flatShading: true }));
    hutRoof.position.set(-26, 3.4, -4); hutRoof.rotation.y = Math.PI / 4; hutRoof.castShadow = true; scene.add(hutRoof);
    cyl(0.09, 0.11, 2.2, 0x4a3220, -24, -14);                          // scarecrow
    box(1.1, 0.12, 0.12, 0x4a3220, -24, -13.2, 0);
    const scHead = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8),
      getMaterial({ color: 0xd9b06a, roughness: 0.9 }));
    scHead.position.set(-24, 2.35, -14); scene.add(scHead);
    box(1.6, 0.5, 0.7, 0x7a5228, -27, -9, 0);                          // trough
    cart(-22, -14, -0.5);
    addLandmark({ x: -26, z: -14, r: 5, icon: '🌾', title: 'FARMLANDS',
      fact: 'Wheat and barley from fields like these fed the entire city.', signY: 4.6 });
    // ---- EAST WORKSHOPS — sheds, kiln, carts ----
    [[26, -4], [26, 4]].forEach(([sx, sz]) => {
      [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]].forEach(([ox, oz]) =>
        cyl(0.12, 0.14, 2.2, 0x4a3220, sx + ox, sz + oz));
      box(4.2, 0.25, 3.2, 0xffffff, sx, sz, 2.2, 0, 0, T_wood('#8a5a2e'));
      box(1.6, 0.8, 1, 0x9a6a35, sx, sz, 0, 0.2, 1.2);                  // worktable
      box(0.6, 0.6, 0.6, 0x7a5228, sx + 1.4, sz + 0.6, 0, -0.2);
    });
    const kiln = new THREE.Mesh(new THREE.SphereGeometry(1.7, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      getMaterial({ color: 0x8a4a2e, roughness: 0.9 }));
    kiln.position.set(28, 0, -10); kiln.castShadow = true; scene.add(kiln);
    cyl(0.3, 0.38, 2.2, 0x6b3a22, 28, -10, 1.2);
    const kilnFire = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8),
      getMaterial({ color: 0xff7a00, emissive: 0xff5500, emissiveIntensity: 2.5 }));
    kilnFire.position.set(28, 0.5, -8.2); scene.add(kilnFire);
    H.colliders.push({ x: 28, z: -10, r: 1.9 });
    addLandmark({ x: 26, z: 0, r: 4.5, icon: '🧱', title: 'BRICK WORKSHOPS',
      fact: 'Kilns fired the standard-sized bricks that built the whole city.', signY: 4.6 });
    // ---- market extras: trade tables, baskets ----
    box(1.5, 0.7, 1, 0x9a6a35, -7, 1.5, 0, 0.1, 0.9);
    box(1.5, 0.7, 1, 0x8a5a35, -4, 1, 0, -0.15, 0.9);
    cyl(0.45, 0.35, 0.7, 0xb5894e, -5.5, 0.2, 0);
    cart(-2, 3, 0.4);
    street(0, -18, 0, 32, 3.5);
    street(-20, 8, 26, 8, 3);
    street(-18, -12, 16, -12, 2.5);
    street(12, -6, 12, 16, 2.5);
    street(-16, -12, -16, 10, 2.5);
    // ---- NORTH-EAST BLOCK — dense houses, courtyard ----
    [[12, 14, 2.8, 0], [17, 14, 3.3, 0.1], [22, 15, 2.6, -0.08],
     [13, 19.5, 3, 0.06], [18, 19.5, 2.7, 0], [23, 20, 3.1, -0.1]].forEach(([x, z, h, ry], i) => {
      houseV(x, z, { h, ry, c: [0xb5763f, 0xa56635, 0xc08a55, 0xd9c49a][i % 4], roof: i % 3 === 2 ? 'pyr' : 'flat' });
    });
    banner(20, 17, 0xe8a13c); pot(19, 18); pot(21, 18);
    // far north-east infill — no dead corner inside the walls
    houseV(28, 24, { h: 2.9, c: 0xa56635 });
    houseV(24, 28, { h: 2.6, c: 0xc08a55, roof: 'pyr' });
    tree(29, 28, 1); pot(26.5, 26.5);
    addLandmark({ x: 17, z: 16, r: 5, icon: '🏘️', title: 'NORTH QUARTER',
      fact: 'Thousands lived in orderly blocks — each with drains, wells and courtyards.', signY: 4.8 });
    // ---- SOUTH-EAST BLOCK — storage hall, workshop shed, jars, cart ----
    box(6, 3, 4, 0xa56635, 16, -14, 0, 0, 3.5);
    box(6.5, 0.35, 4.5, 0x8a5a2e, 16, -14, 3);
    [[26, -4], [26, 4]].forEach(([sx, sz]) => {
      [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]].forEach(([ox, oz]) =>
        cyl(0.12, 0.14, 2.2, 0x4a3220, sx + ox, sz + oz));
      box(4.2, 0.25, 3.2, 0xffffff, sx, sz, 2.2, 0, 0, T_wood('#8a5a2e'));
      box(1.6, 0.8, 1, 0xffffff, sx, sz, 0, 0.2, 1.2, T_wood('#9a6a35'));
      box(0.6, 0.6, 0.6, 0x7a5228, sx + 1.4, sz + 0.6, 0, -0.2);
    });
    pot(13, -16, 0xb5542d, 1.5); pot(19, -12, 0xb5542d, 1.4); pot(14, -11, 0x8a5a35, 1.3);
    cart(10, -16, 0.3);
    // ---- WEST DRAIN STREET — houses, bridge, wash platforms ----
    houseV(-19, 4, { h: 2.7, c: 0xa56635 });
    houseV(-19, -2, { h: 3.2, c: 0xc08a55, roof: 'pyr' });
    box(2.4, 0.15, 1.6, 0x7a5228, -9, 0, 0);                        // bridge over channel
    box(1.8, 0.35, 1.2, 0x9a6a35, -13, 1.4, 0, 0.2);
    box(1.8, 0.35, 1.2, 0x9a6a35, -7, -1.6, 0, -0.15);
    cyl(0.4, 0.32, 0.6, 0xb5894e, -13, 2.2, 0); cyl(0.4, 0.32, 0.6, 0xb5894e, -7, -2.4, 0);
    // ---- SOUTH ROAD out of the gate + outer settlement ----
    street(0, -19, 0, -34, 4);
    wallRun(-4.5, -20, -4.5, -32, 2.5); wallRun(4.5, -20, 4.5, -32, 2.5);
    houseV(-8, -28, { h: 2.8 }); houseV(8, -28, { h: 3.1, c: 0xc08a55 });
    [[-14, -27], [-12, -27], [12, -27], [14, -27]].forEach(([fx, fz]) => {
      box(3.4, 0.12, 1, 0x6b4a26, fx, fz, 0);
      for (let k = 0; k < 4; k++) {
        const crop = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 7),
          getMaterial({ color: k % 2 ? 0x7ab648 : 0xd9b64a, roughness: 0.9, flatShading: true }));
        crop.position.set(fx - 1.2 + k * 0.8, 0.45, fz); crop.castShadow = true; scene.add(crop);
      }
    });
    cart(2, -31, 1.2);
    houseV(-14, -32, { h: 2.6, c: 0xa56635 });
    [[-11, -33], [11, -33]].forEach(([fx, fz]) => {
      box(3.4, 0.12, 1, 0x6b4a26, fx, fz, 0);
      for (let k = 0; k < 4; k++) {
        const crop2 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 7),
          getMaterial({ color: k % 2 ? 0xd9b64a : 0x7ab648, roughness: 0.9, flatShading: true }));
        crop2.position.set(fx - 1.2 + k * 0.8, 0.45, fz); crop2.castShadow = true; scene.add(crop2);
      }
    });
    addLandmark({ x: 0, z: -27, r: 4.5, icon: '🛤️', title: 'SOUTH ROAD',
      fact: 'Carts loaded with grain and pots rumbled along roads like this.', signY: 4.6 });
    // ---- CITY WALLS — visible boundary, corner towers ----
    wallRun(-30, 34, 30, 34, 3);
    wallRun(-34, -20, -34, 30, 3);
    wallRun(34, -10, 34, 20, 3);
    wallTower(-20, 34); wallTower(20, 34); wallTower(-34, 5);
    tree(6, 24, 1); tree(-6, 24, 1); tree(-1, 29, 1.1);
    // ---- ambient life ----
    ambient(0x3d7bd9, [[-11, 5], [-2, 5.5], [-2, 9], [-11, 9]]);
    ambient(0x6fae4e, [[-28, -11], [-23, -11], [-23, -16], [-28, -16]]);
    ambient(0xb5542d, [[-4, 19], [4, 19]]);
    pot(-7, 5); pot(-7.6, 5.3); pot(11, 3);
    tree(16, -12); tree(-18, -10); tree(18, 12); banner(-11, -2, 0xd94f3d); torch(0, -16); torch(3, -16);
    P.items = [[-4.5, 6.5, 'tablet'], [-9, 0, 'tablet'], [3.4, -8, 'tablet'], [0, 18, 'tablet'], [-11, -14, 'tablet']];
    P.gate = [0, -19]; P.seal = [0, -14]; P.portal = [8, -19];
  } else if (level.id === 2) {
    P.bounds = 40;
    // Nalanda: courtyards, stupas, library, observatory, gardens
    const stone = 0xcbb27f;
    [[-12, -6], [12, -6], [-12, 8], [12, 8]].forEach(([x, z]) => {
      box(5, 3, 5, 0xffffff, x, z, 0, 0, 3.2, T_stone('#cbb27f', '#a89468'));
      const st = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 4),
        getMaterial({ color: 0xa5824f, roughness: 0.8 }));
      st.position.set(x, 4.1, z); st.rotation.y = Math.PI / 4; st.castShadow = true; scene.add(st);
    });
    // ---- streets: main axes + lanes ----
    street(0, -18, 0, 33, 3.5);
    street(-26, 6, 22, 6, 3);
    street(-18, -8, -18, 16, 2.5);
    street(20, -8, 20, 14, 2.5);
    // ---- EAST DORMITORIES — rooms around a courtyard tree ----
    [[26, -5], [31, -1], [26, 5]].forEach(([hx, hz]) => {
      box(3.5, 2.6, 3, 0xffffff, hx, hz, 0, 0, 2.2, T_plaster('#a5824f', '#857052'));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.4, 4),
        getMaterial({ color: 0x7a5a35, roughness: 0.9, flatShading: true }));
      roof.position.set(hx, 3.3, hz); roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
    });
    tree(28.5, 0, 1);
    addLandmark({ x: 28, z: 0, r: 4, icon: '🛖', title: 'EAST DORMS',
      fact: 'Hundreds of students slept in plain rooms around quiet courtyards.', signY: 4.4 });
    // ---- WEST PAVILION + flower beds ----
    [[-29.5, 0.5], [-26.5, 0.5], [-29.5, 3.5], [-26.5, 3.5]].forEach(([px, pz]) =>
      cyl(0.14, 0.16, 2.2, 0x4a3220, px, pz));
    box(4.4, 0.25, 4.4, 0x8a5a2e, -28, 2, 2.2);
    box(1.6, 0.7, 1, 0x8a5a35, -28, 2, 0, 0.2, 1);
    box(0.45, 0.3, 0.6, 0xe8c547, -28.3, 2.2, 0.7);
    [[-28, 10, 0xd94f3d], [-26, 10, 0xe8a13c]].forEach(([fx, fz, fc]) =>
      box(1.8, 0.45, 1, fc, fx, fz, 0, 0.15));
    // ---- NORTH MEDITATION platforms ----
    [[-14, 31], [14, 31]].forEach(([mx, mz]) => {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20),
        getMaterial({ color: 0xd9c48f, roughness: 0.9 }));
      disc.rotation.x = -Math.PI / 2; disc.position.set(mx, 0.03, mz); scene.add(disc);
      tree(mx, mz, 1.1);
      box(1.3, 0.45, 0.5, 0x8a5a35, mx - 1.5, mz + 1.8, 0, 0.2, 0.7);
    });
    // ---- SW INSTRUMENT SHED near the observatory ----
    [[-23.5, -13.5], [-20.5, -13.5], [-23.5, -10.5], [-20.5, -10.5]].forEach(([px, pz]) =>
      cyl(0.12, 0.14, 2.2, 0x4a3220, px, pz));
    box(4.2, 0.25, 4.2, 0xffffff, -22, -12, 2.2, 0, 0, T_wood('#8a5a2e'));
    box(1.6, 0.8, 1, 0xffffff, -22, -12, 0, 0, 1, T_wood('#8a5a35'));
    const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1),
      getMaterial({ color: 0x1a2a4a, emissive: 0x35b6d9, emissiveIntensity: 0.5, side: 2 }));
    chart.position.set(-22, 1.6, -13.8); scene.add(chart);
    // ---- CAMPUS WALLS with corner towers ----
    wallRun(-30, 37, 30, 37, 3);
    wallRun(10, 26, 30, 26, 3); wallRun(-30, 26, -10, 26, 3);
    wallRun(-34, -10, -34, 20, 3); wallRun(36, -10, 36, 20, 3);
    wallTower(-30, 37); wallTower(30, 37); wallTower(-30, 26); wallTower(30, 26);
    // ---- WEST LEARNING HALLS — two varied lecture buildings ----
    box(6, 3.5, 5, 0xffffff, -22, 6, 0, 0, 3.8, T_stone('#cbb27f', '#a89468'));
    box(6.6, 0.4, 5.6, 0xa5824f, -22, 6, 3.5);
    [[-24.2, 3.2], [-19.8, 3.2]].forEach(([px, pz]) => cyl(0.24, 0.28, 2.6, 0xffffff, px, pz, 0, 10, T_stone('#c9a05e', '#a3864e')));
    box(5, 3, 4, 0xffffff, -22, 14, 0, 0.08, 3.2, T_plaster('#bf9f6a', '#a08858'));
    box(2, 2.2, 0.3, 0x4a2f14, -22, 11.9, 0);
    // open-air study desks under the trees
    [[-16, 8], [-14.5, 9.5]].forEach(([dx, dz], i) => {
      box(1.4, 0.6, 0.9, 0xffffff, dx, dz, 0, i * 0.3, 0.8, T_wood('#8a5a35'));
      box(0.4, 0.3, 0.5, 0xd94f3d, dx, dz, 0.6, -i * 0.2);
    });
    addLandmark({ x: -22, z: 10, r: 4.5, icon: '🎓', title: 'LEARNING HALLS',
      fact: 'Students debated logic, grammar and philosophy in halls like these.', signY: 5 });
    // ---- GREAT LIBRARY — enterable: walk through the door, browse the shelves ----
    box(8.4, 0.14, 5.8, 0xffffff, 0, 12, 0, 0, 0, T_stone('#8a6f45', '#6f5a38')); // floor
    const LIBP = T_plaster('#b5894e', '#96754a');
    [[-2.7], [0], [2.7]].forEach(([wx]) => {                             // back wall
      box(2.6, 3.2, 0.5, 0xffffff, wx, 14.5, 0, 0, 0, LIBP);
      H.colliders.push({ x: wx, z: 14.5, r: 1.3 });
    });
    [-4, 4].forEach(wx => {                                              // side walls
      box(0.5, 3.2, 5.4, 0xffffff, wx, 12, 0, 0, 0, LIBP);
      H.colliders.push({ x: wx, z: 11, r: 1.3 }, { x: wx, z: 13.5, r: 1.3 });
    });
    [-2.7, 2.7].forEach(wx => {                                          // front wall + open door
      box(2.6, 3.2, 0.5, 0xffffff, wx, 9.5, 0, 0, 0, LIBP);
      H.colliders.push({ x: wx, z: 9.5, r: 1.3 });
    });
    [-1.4, 1.4].forEach(wx => cyl(0.2, 0.24, 3, 0x6a4a2a, wx, 9.5));      // door posts
    H.colliders.push({ x: -1.4, z: 9.5, r: 0.4 }, { x: 1.4, z: 9.5, r: 0.4 });
    box(8.8, 0.4, 6.2, 0xffffff, 0, 12, 3.4, 0, 0, T_wood('#8a6a45')); // roof slab
    [[-3.7, 10], [3.7, 10], [-3.7, 14], [3.7, 14]].forEach(([px, pz]) => {
      cyl(0.22, 0.26, 3.4, 0xffffff, px, pz, 0, 10, T_stone('#c9a05e', '#a3864e')); H.colliders.push({ x: px, z: pz, r: 0.4 });
    });
    [-2.6, 2.6].forEach(sx => [11.8, 13.2].forEach(sz => {               // shelf rows, open aisle
      box(1.6, 1.7, 0.6, 0xffffff, sx, sz, 0, 0, 0, T_wood('#6a4a2a'));
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8),
        getMaterial({ color: 0xe8c547, roughness: 0.7 }));
      roll.rotation.z = Math.PI / 2; roll.position.set(sx, 1.85, sz); scene.add(roll);
      H.colliders.push({ x: sx, z: sz, r: 1.0 });
    }));
    box(1.4, 0.6, 0.9, 0xffffff, 2.6, 10.8, 0, 0.1, 0.8, T_wood('#8a5a35')); // reading table
    [[-2.6, 10.6, 0xd94f3d], [-2.1, 10.8, 0x3d7bd9], [-2.35, 11.1, 0x3d8a4f]].forEach(([bx3, bz3, bc]) =>
      box(0.5, 0.35, 0.7, bc, bx3, bz3, 0, 0.3));                        // book piles inside
    addLandmark({ x: 0, z: 12, r: 5, icon: '📚', title: 'THE GREAT LIBRARY',
      fact: 'Nalanda’s libraries are said to have held lakhs of handwritten manuscripts! You can walk inside.', signY: 5.4 });
    // observatory platform + stargazing tube
    cyl(3, 3.4, 1, 0xffffff, -14, -14, 0, 12, T_stone('#9a9a9a', '#7e7e7e')); H.colliders.push({ x: -14, z: -14, r: 3.4 });
    cyl(0.15, 0.15, 3, 0x6a4a1a, -14, -14, 1);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 10),
      getMaterial({ color: 0x8a6a35, roughness: 0.5, metalness: 0.4 }));
    tube.position.set(-14, 2.6, -14); tube.rotation.z = 0.7; tube.castShadow = true; scene.add(tube);
    addLandmark({ x: -14, z: -14, r: 4.5, icon: '🔭', title: 'OBSERVATORY',
      fact: 'Scholars here tracked the stars and planets across the night sky.', signY: 4.8 });
    // garden stupas
    [[6, 4], [8, 6], [-7, 2]].forEach(([x, z]) => {
      cyl(0.9, 1.1, 1.4, 0xffffff, x, z, 0, 12, T_stone('#d9c48f', '#b3a071')); H.colliders.push({ x, z, r: 1.2 });
    });
    addLandmark({ x: 7, z: 5, r: 4, icon: '🛕', title: 'STUPA GARDEN',
      fact: 'Quiet gardens where monks walked, debated and meditated.', signY: 3.6 });
    // garden grove — curated border positions (never random: random clusters
    // can trap the player between trunks). All >=4 apart, off all paths.
    [[-20, -2], [-16, 2], [-20, 12], [-10, 14], [2, 16], [20, 12], [20, 6], [20, -2]]
      .forEach(([x, z]) => tree(x, z, 0.9 + R() * 0.3));
    // ---- READING GARDEN — hedges, pond, benches, lanterns ----
    [[-4, 21], [0, 21], [4, 21]].forEach(([hx, hz]) => {
      box(3, 1, 1, 0x2f7a3e, hx, hz, 0, 0, 1.3);
    });
    [[-2, 25], [2, 25]].forEach(([hx, hz]) => {
      box(3, 1, 1, 0x3e8e4f, hx, hz, 0, 0, 1.3);
    });
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2, 20),
      getMaterial({ color: 0x35b6d9, roughness: 0.2 }));
    pond.rotation.x = -Math.PI / 2; pond.position.set(0, 0.03, 23); scene.add(pond);
    H.colliders.push({ x: 0, z: 23, r: 2.2 });
    [[-3.5, 23.5], [3.5, 23.5]].forEach(([bx4, bz4]) => {
      box(1.4, 0.45, 0.5, 0x8a5a35, bx4, bz4, 0, 0, 0.7);
    });
    [[-5, 22], [5, 22], [0, 26.5]].forEach(([lx, lz]) => {
      cyl(0.18, 0.24, 0.9, 0x9a9a9a, lx, lz);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.4),
        getMaterial({ color: 0xffe9a8, emissive: 0xffb13c, emissiveIntensity: 1.2 }));
      lamp.position.set(lx, 1.1, lz); scene.add(lamp);
      addGlow(lx, 1.25, lz, 0xffb13c, 1.5, 0.4);
    });
    tree(-5, 26, 0.9); tree(5, 27, 1);
    addLandmark({ x: 0, z: 23, r: 4.5, icon: '🪷', title: 'READING GARDEN',
      fact: 'Students read and memorised verses beside quiet lotus ponds.', signY: 4.4 });
    // ---- SW MANGO GROVE + rest pavilion ----
    [[-24, 18], [-19, 20], [-26, 24], [-21, 26], [-16, 22], [-23, 28]].forEach(([x, z], i) =>
      tree(x, z, 0.9 + (i % 3) * 0.15));
    [[-20.5, 23.5], [-17.5, 23.5], [-20.5, 26.5], [-17.5, 26.5]].forEach(([px, pz]) =>
      cyl(0.12, 0.14, 2.2, 0x4a3220, px, pz));
    box(4.4, 0.25, 4.4, 0x8a5a2e, -19, 25, 2.2);
    box(1.4, 0.45, 0.5, 0x8a5a35, -19, 25.5, 0, 0.3, 0.7);
    // ---- NORTH MEMORIAL WALK — stupa row, lamps, path ----
    street(0, -20, 0, -32, 2.5);
    [[-6, -26], [0, -28], [6, -26]].forEach(([sx, sz]) => {
      cyl(0.8, 1, 1.2, 0xd9c48f, sx, sz); H.colliders.push({ x: sx, z: sz, r: 1.1 });
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 8),
        getMaterial({ color: 0xa5824f, roughness: 0.8 }));
      tip.position.set(sx, 1.6, sz); scene.add(tip);
    });
    [[-3, -24], [3, -24]].forEach(([lx, lz]) => {
      cyl(0.14, 0.18, 1.4, 0x9a9a9a, lx, lz);
      const lamp3 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8),
        getMaterial({ color: 0xffe9a8, emissive: 0xffb13c, emissiveIntensity: 1.4 }));
      lamp3.position.set(lx, 1.6, lz); scene.add(lamp3);
      addGlow(lx, 1.7, lz, 0xffe9a8, 1.4, 0.4);
    });
    // ---- SE STUDY CIRCLE ----
    tree(24, 14, 1.1);
    for (let bi = 0; bi < 5; bi++) {
      const a = (bi / 5) * Math.PI * 2;
      box(1.2, 0.45, 0.5, 0x8a5a35, 24 + Math.cos(a) * 2.2, 14 + Math.sin(a) * 2.2, 0, -a);
    }
    // ---- SOUTH GATE + reception pavilion ----
    [-2.5, 2.5].forEach(gx => { cyl(0.4, 0.5, 4.2, 0xcbb27f, gx, 26); H.colliders.push({ x: gx, z: 26, r: 0.7 }); });
    box(7, 0.7, 1.2, 0xa5824f, 0, 26, 4.2);
    [-7, 7].forEach(gx => {
      box(5, 3, 1, 0xffffff, gx, 26, 0, 0, 2.5, T_stone('#cbb27f', '#a89468'));
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1, 4),
        getMaterial({ color: 0xa5824f, roughness: 0.8, flatShading: true }));
      cap.position.set(gx, 3.5, 26); cap.rotation.y = Math.PI / 4; scene.add(cap);
    });
    banner(-3.5, 26, 0xe8c547); banner(3.5, 26, 0xe8c547);
    const spath = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 11),
      getMaterial({ color: 0xf5e6c4, roughness: 0.9 }));
    spath.rotation.x = -Math.PI / 2; spath.position.set(0, 0.02, 30.5); scene.add(spath);
    box(6, 0.4, 4, 0xffffff, 0, 33, 0, 0, 0, T_stone('#d9c48f', '#b3a071'));
    box(2, 0.8, 1.2, 0xffffff, 0, 33, 0.4, 0, 1.2, T_wood('#8a5a35'));
    box(0.45, 0.3, 0.6, 0xd94f3d, -0.5, 33.3, 0.8);
    box(0.45, 0.3, 0.6, 0x3d7bd9, 0.4, 33.1, 0.8);
    tree(-8, 32, 1); tree(8, 32, 1);
    addLandmark({ x: 0, z: 30, r: 4, icon: '⛩️', title: 'UNIVERSITY GATE',
      fact: 'Travellers from many lands entered Nalanda through gates like this.', signY: 5.6 });
    // ---- ambient scholars ----
    ambient(0x2e7d8a, [[-4, 1], [4, 1], [4, 7], [-4, 7]]);
    ambient(0xcf7a1e, [[-18, 9], [-14, 12]]);
    ambient(0x8a4fa8, [[24, 0], [30, 2]]);
    // scholar quarter huts (thatched bunks for far-travelled students)
    [[-18, 4], [17, -4]].forEach(([hx, hz]) => {
      box(3.5, 2.4, 3, 0xa5824f, hx, hz, 0, 0, 2.2);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 1.6, 4),
        getMaterial({ color: 0x7a5a35, roughness: 0.9, flatShading: true }));
      roof.position.set(hx, 3.2, hz); roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
    });
    addLandmark({ x: 17, z: -4, r: 4, icon: '🛖', title: 'SCHOLAR QUARTERS',
      fact: 'Students from China, Korea and Central Asia lived and studied here.', signY: 4.6 });
    // debate courtyard — open ring of pillars with a carpet
    for (let d = 0; d < 6; d++) {
      const a = (d / 6) * Math.PI * 2;
      const px = 13 + Math.cos(a) * 3, pz = 14 + Math.sin(a) * 3;
      cyl(0.28, 0.32, 2.4, 0xffffff, px, pz, 0, 10, T_stone('#c9a05e', '#a3864e')); H.colliders.push({ x: px, z: pz, r: 0.45 });
    }
    const dcarpet = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20),
      getMaterial({ color: 0x8a2a35, roughness: 0.9 }));
    dcarpet.rotation.x = -Math.PI / 2; dcarpet.position.set(13, 0.03, 14); scene.add(dcarpet);
    addLandmark({ x: 13, z: 14, r: 4, icon: '🗣️', title: 'DEBATE COURTYARD',
      fact: 'Scholars sharpened ideas through fierce — and friendly — debate.', signY: 4.2 });
    P.spawn = [0, 5]; // open courtyard: clear of library, stupas, stall, NPCs
    stall(4, -2, 0xe8c547); pot(1, 11); banner(0, 8, 0xe8c547); torch(-2, -16); torch(2, -16);
    P.items = [[-9, -2, 'scroll'], [-14, -10.5, 'scroll'], [4.5, 6.5, 'scroll'], [0, 10.5, 'scroll'], [14, -2, 'scroll']];
    P.gate = [0, -19]; P.seal = [0, -14]; P.portal = [8, -19];
  } else if (level.id === 3) {
    P.bounds = 40;
    // Chola: giant temple, gopuram colours, port with boats, village
    const sand = 0xd9b06a;
    box(6, 7, 6, 0xffffff, 0, -14, 0, 0, 5, T_stone('#d9b06a', '#b3905a')); // sanctum
    box(8, 2.5, 8, 0xffffff, 0, -8, 0, 0, 4.5, T_stone('#c09a55', '#9c7c48')); // mandapa
    const vim = new THREE.Mesh(new THREE.ConeGeometry(3.4, 5, 4),
      getMaterial({ color: 0xb5822e, roughness: 0.7, flatShading: true }));
    vim.position.set(0, 9.5, -14); vim.rotation.y = Math.PI / 4; vim.castShadow = true; scene.add(vim);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10),
      getMaterial({ color: 0xffd23e, emissive: 0xcc8a00, emissiveIntensity: 1 }));
    fin.position.set(0, 12.4, -14); scene.add(fin);
    H.dynamics.push((dt, t) => { fin.rotation.y += dt; });
    // festive painted bands around the sanctum
    [[2.2, 0xd94f3d], [4.2, 0xfff6e2], [6.2, 0xffd23e]].forEach(([by, bc]) =>
      box(6.35, 0.45, 6.35, bc, 0, -14, by));
    addLandmark({ x: 0, z: -12, r: 6.5, icon: '🛕', title: 'THE GREAT TEMPLE',
      fact: 'Chola kings raised soaring stone temples — like Thanjavur’s Brihadeeswara!', signY: 14 });
    // courtyard pillars
    for (let i = -2; i <= 2; i++) { cyl(0.35, 0.4, 3, 0xffffff, i * 3, -4, 0, 10, T_stone('#c9a05e', '#a3864e')); H.colliders.push({ x: i * 3, z: -4, r: 0.6 }); }
    // gopuram gateway south of the sanctum — tiered towers flank the path
    [-3, 3].forEach(gx => {
      box(2, 2.4, 2, 0xffffff, gx, -1, 0, 0, 1.4, T_stone('#c09a55', '#9c7c48'));
      box(1.5, 1.6, 1.5, 0xffffff, gx, -1, 2.4, 0, 0, T_stone('#b5822e', '#8f6a28'));
      box(1, 1.2, 1, 0xd94f3d, gx, -1, 4);
      const gf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8),
        getMaterial({ color: 0xffd23e, emissive: 0xcc8a00, emissiveIntensity: 1 }));
      gf.position.set(gx, 5, -1); scene.add(gf);
    });
    box(8.4, 0.6, 1.4, 0x8a5a35, 0, -1, 5.2);
    addLandmark({ x: 0, z: -1, r: 3.6, icon: '🛕', title: 'TEMPLE GATEWAY',
      fact: 'Towering gopurams announced the temple long before you reached it.', signY: 6.8 });
    // port: water strip + boats
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(60, 14),
      getMaterial({ color: 0x2e8fc4, roughness: 0.2 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-16, 0.02, 14); scene.add(sea);
    H.dynamics.push((dt, t) => { sea.position.y = 0.02 + Math.sin(t * 1.4) * 0.03; });
    [[-14, 13], [-19, 15]].forEach(([x, z], i) => {
      box(3.2, 0.7, 1.2, 0xffffff, x, z, 0.1, i * 0.3, 0, T_wood('#6b4423'));
      cyl(0.06, 0.06, 2.6, 0x4a3220, x, z, 0.4);
    });
    // second boat + mooring posts
    box(3.2, 0.7, 1.2, 0x6b4423, -22, 17, 0.1, -0.25);
    cyl(0.06, 0.06, 2.6, 0x4a3220, -22, 17, 0.4);
    cyl(0.1, 0.12, 1.4, 0x4a3220, -18, 19);
    cyl(0.1, 0.12, 1.4, 0x4a3220, -10, 19.5);
    // wooden pier + cargo over the shallows (scenery — keep off it)
    box(5, 0.3, 2, 0x7a5228, -14, 17.5, 0.3);
    H.colliders.push({ x: -14, z: 17.5, r: 2.2 });
    [[-16, 17.5], [-12, 17.5]].forEach(([px, pz]) => cyl(0.12, 0.14, 1.2, 0x4a3220, px, pz));
    box(0.9, 0.9, 0.9, 0x9a6a35, -15.5, 18, 0.6, 0.3, 1.0);
    box(0.7, 0.7, 0.7, 0x7a5228, -13.5, 17.2, 0.6, -0.2, 0.9);
    cyl(0.5, 0.55, 0.8, 0x8a5a35, -12.5, 18.5);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.12, 8, 16),
      getMaterial({ color: 0xc9a05e, roughness: 0.9 }));
    rope.rotation.x = Math.PI / 2; rope.position.set(-16.5, 0.55, 17); scene.add(rope);
    addLandmark({ x: -16, z: 13, r: 5, icon: '⛵', title: 'HARBOR',
      fact: 'Chola ships carried spices — and stories — across the seas!', signY: 4.4 });
    stall(8, 6, 0x4aa3df); stall(11, 6, 0xd94f3d, -0.2);
    stall(-2, 12, 0x3d8a4f, 0.1); stall(2, 12, 0xe8a13c, -0.1);
    pot(-3.5, 13); pot(3.5, 13.2);
    addLandmark({ x: 9.5, z: 6, r: 4, icon: '🏪', title: 'MARKET',
      fact: 'Craftspeople sold bronze lamps, spices and cloth from busy stalls.', signY: 4.2 });
    pot(9, 7); tree(-6, 10); tree(16, -2); banner(4, -6, 0x4aa3df); banner(-4, -6, 0xffd23e);
    torch(2, -17); torch(-2, -17);
    // sculptor stones + open pillared workshop
    box(1.2, 1.2, 1.2, 0x9a9a9a, -10, -2, 0, 0.4, 1.2);
    [[-13.6, 0.4], [-10.4, 0.4], [-13.6, 3.6], [-10.4, 3.6]].forEach(([wx, wz]) =>
      cyl(0.24, 0.28, 2.6, 0xc9a05e, wx, wz));
    box(4.6, 0.3, 4.6, 0x8a6a45, -12, 2, 2.6);
    box(1, 0.8, 1, 0x9a9a9a, -12.8, 2.5, 0, 0.2);
    box(0.8, 0.6, 0.8, 0xababab, -11.2, 1.6, 0, -0.3);
    addLandmark({ x: -12, z: 2, r: 3.6, icon: '🗿', title: 'SCULPTOR’S WORKSHOP',
      fact: 'Master carvers shaped gods, dancers and guardians from plain rock.', signY: 4.4 });
    // ---- streets: temple axis, market row, lanes ----
    street(0, -20, 0, 22, 3.5);
    street(14, 10, 22, 10, 3); // east bank only — the west stretch would float over the sea
    street(-16, -10, -16, 12, 2.5);
    street(16, -12, 16, 12, 2.5);
    street(24, -14, 32, 8, 2.5);
    // ---- WEST QUARRY — stone piles, half-blocks, shed, worker hut ----
    for (let qi = 0; qi < 5; qi++) {
      const pile = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + (qi % 3) * 0.25, 0),
        getMaterial({ color: 0x9a9a9a, roughness: 0.95, flatShading: true }));
      pile.position.set(-31 + (qi % 3) * 2.2, 0.5, -4 + Math.floor(qi / 3) * 2.4 + (qi % 2));
      pile.castShadow = true; scene.add(pile);
    }
    box(1.4, 0.9, 1, 0xababab, -27, -2, 0, 0.3);
    box(1.2, 0.7, 0.9, 0x9a9a9a, -25.5, 0.5, 0, -0.2);
    [[-29.5, 3.5], [-26.5, 3.5], [-29.5, 6.5], [-26.5, 6.5]].forEach(([px, pz]) =>
      cyl(0.12, 0.14, 2.2, 0x4a3220, px, pz));
    box(4.2, 0.25, 4.2, 0xffffff, -28, 5, 2.2, 0, 0, T_wood('#8a5a2e'));
    box(1.6, 0.8, 1, 0xffffff, -28, 5, 0, 0, 1.2, T_wood('#8a5a35'));
    houseV(-30, -8, { w: 3.5, h: 2.4, d: 3, c: 0xc9a05e });
    addLandmark({ x: -28, z: 0, r: 4.5, icon: '⛏️', title: 'STONE QUARRY',
      fact: 'Every temple began here — workers split living rock into perfect blocks.', signY: 4.4 });
    // ---- NORTH SHRINES + gardens ----
    [[-8, -28], [8, -28]].forEach(([sx, sz]) => {
      box(4, 0.4, 4, 0xffffff, sx, sz, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
      const vim2 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 4),
        getMaterial({ color: 0xb5822e, roughness: 0.7, flatShading: true }));
      vim2.position.set(sx, 2, sz); vim2.rotation.y = Math.PI / 4; vim2.castShadow = true; scene.add(vim2);
      H.colliders.push({ x: sx, z: sz, r: 1.8 });
      [[-1.5, 1.5], [1.5, 1.5]].forEach(([ox, oz]) => cyl(0.14, 0.16, 2, 0xc9a05e, sx + ox, sz + oz));
    });
    tree(-12, -28, 0.9); tree(12, -28, 0.9);
    // village streets east of the market
    [[15, 2], [19, 9], [12, 12]].forEach(([hx, hz]) => {
      box(4, 2.8, 3.5, 0xffffff, hx, hz, 0, 0.1, 2.5, T_plaster('#d9b06a', '#b3905a'));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.5, 4),
        getMaterial({ color: 0x8a4a2e, roughness: 0.9, flatShading: true }));
      roof.position.set(hx, 3.5, hz); roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
    });
    pot(16, 7.5);
    // village well + grain plots
    cyl(0.9, 1, 1, 0x7a5a3a, 21, 14); H.colliders.push({ x: 21, z: 14, r: 1.2 });
    for (let fr = 0; fr < 3; fr++)
      box(4, 0.12, 0.9, 0x5a7a35, 15, 15.5 + fr * 1.4, 0);
    cart(8, 15, 0.9);
    // ---- SOUTH FARMS — huts, plots, well ----
    houseV(4, 27, { h: 2.6 }); houseV(14, 29, { h: 2.8, c: 0xc08a55 });
    cyl(0.9, 1, 1, 0x7a5a3a, 9, 25); H.colliders.push({ x: 9, z: 25, r: 1.2 });
    [[4, 31], [14, 33]].forEach(([fx, fz]) => {
      box(3.4, 0.12, 1, 0x6b4a26, fx, fz, 0);
      for (let k = 0; k < 4; k++) {
        const crop3 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.65, 7),
          getMaterial({ color: k % 2 ? 0x7ab648 : 0xd9b64a, roughness: 0.9, flatShading: true }));
        crop3.position.set(fx - 1.2 + k * 0.8, 0.4, fz); scene.add(crop3);
      }
    });
    // ---- EAST ROW houses ----
    houseV(30, -2, { h: 2.7 }); houseV(30, 6, { h: 3, c: 0xc08a55 });
    tree(33, 2, 0.9);
    // ---- ROYAL GARDEN (north-east) + COCONUT GROVE (south-east) ----
    [[24, -14], [28, -14]].forEach(([hx, hz]) => {
      box(2.6, 0.9, 0.9, 0x2f7a3e, hx, hz, 0, 0, 1.1);
    });
    const rpond = new THREE.Mesh(new THREE.CircleGeometry(1.8, 18),
      getMaterial({ color: 0x35b6d9, roughness: 0.2 }));
    rpond.rotation.x = -Math.PI / 2; rpond.position.set(27, 0.03, -9); scene.add(rpond);
    H.colliders.push({ x: 27, z: -9, r: 2 });
    box(1.3, 0.45, 0.5, 0x8a5a35, 23.5, -8, 0, 0.4, 0.7);
    tree(22, -12, 0.9); tree(30, -12, 0.9);
    [[26, 24], [30, 28], [24, 30]].forEach(([x, z]) => tree(x, z, 1));
    houseV(30, 33, { w: 3.5, h: 2.5, d: 3, c: 0xd9b06a });
    street(22, 20, 30, 30, 2.5);
    // ---- SETTLEMENT WALLS ----
    wallRun(-30, -34, 30, -34, 3);
    wallRun(-36, -14, -36, 14, 3);
    wallRun(-36, -14, -36, 14, 3);
    wallRun(36, -10, 36, 20, 3);
    wallTower(-30, -34); wallTower(30, -34); wallTower(-36, 0);
    addLandmark({ x: 16, z: 7, r: 4.5, icon: '🏡', title: 'VILLAGE',
      fact: 'Farmers, potters and herders lived in villages around the temple city.', signY: 4.8 });
    // ---- ROYAL COURT — pillared hall, dais and throne (inspired, not a specific palace) ----
    box(9, 0.5, 7, 0xffffff, 16, -18, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    [[13, -20.5], [16, -20.5], [19, -20.5], [13, -15.5], [16, -15.5], [19, -15.5]].forEach(([px, pz]) => {
      cyl(0.3, 0.36, 3.4, 0xffffff, px, pz, 0, 10, T_stone('#c9a05e', '#a3864e')); H.colliders.push({ x: px, z: pz, r: 0.5 });
    });
    box(9.6, 0.4, 7.6, 0xffffff, 16, -18, 3.4, 0, 0, T_wood('#8a5a35'));
    box(2.4, 0.9, 1.6, 0x8a6a45, 16, -19.5, 0.5);                  // dais
    box(1.2, 1.1, 0.8, 0xa8232a, 16, -19.5, 1.2);                 // throne seat
    const rcarpet = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5),
      getMaterial({ color: 0xa8232a, roughness: 0.9 }));
    rcarpet.rotation.x = -Math.PI / 2; rcarpet.position.set(16, 0.53, -17); scene.add(rcarpet);
    banner(12.5, -15, 0xd94f3d); banner(19.5, -15, 0xffd23e);
    addLandmark({ x: 16, z: -18, r: 5, icon: '👑', title: 'ROYAL COURT',
      fact: 'Chola kings administered a vast realm — from courts much like this one.', signY: 5.4 });
    // ---- ambient life ----
    ambient(0xd9b06a, [[14, 5], [19, 8]]);
    ambient(0x1e6f9c, [[-17, 12], [-12, 14]]);
    ambient(0x7a3b2e, [[12, -14], [12, -22]]);
    P.items = [[-10, -0.5, 'piece'], [-12, 2, 'piece'], [8, 7.5, 'piece'], [-15, 11, 'piece'], [16.5, 5.5, 'piece']];
    P.gate = [0, -20.5]; P.seal = [0, -5.5]; P.portal = [8, -20.5];
  } else if (level.id === 4) {
    P.bounds = 38;
    // Fort: high walls, towers, gate arch, courtyard, secret chamber door
    const wall = 0xc08a4e;
    [[0, -22, 30, 2], [-16, -8, 2, 26], [16, -8, 2, 26]].forEach(([x, z, w, d]) => {
      box(w, 5, d, 0xffffff, x, z, 0, 0, 0, T_stone('#c08a4e', '#9c6c40'));
    });
    [[-16, -20], [16, -20], [-16, 4], [16, 4]].forEach(([x, z]) => {
      cyl(2, 2.4, 7, 0xffffff, x, z, 0, 12, T_stone('#a5763e', '#86603a')); H.colliders.push({ x, z, r: 2.6 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        getMaterial({ color: 0xffffff, roughness: 0.6, map: T_plaster('#e8d8a8', '#cfc09a') }));
      dome.position.set(x, 7, z); dome.castShadow = true; scene.add(dome);
    });
    // palace block + garden
    box(6, 3, 5, 0xffffff, -8, 8, 0, 0, 3.6, T_plaster('#d9a860', '#b8905c'));
    box(4, 2.2, 4, 0xffffff, 8, 8, 0, 0, 3, T_plaster('#b5884a', '#967052'));
    // outer ward — artisans' facades and stalls beyond the inner court
    [[-8, 17], [0, 19], [8, 17]].forEach(([fx, fz]) => {
      box(4.5, 3, 3, 0xffffff, fx, fz, 0, 0, 2.7, T_stone('#c08a4e', '#9c6c40'));
      box(5, 0.35, 3.5, 0xffffff, fx, fz, 3, 0, 0, T_wood('#8a5a2e'));
    });
    stall(-4, 14, 0x3d7bd9, 0.15); stall(4, 14, 0xd94f3d, -0.15);
    addLandmark({ x: 0, z: 16, r: 4.5, icon: '🏘️', title: 'ARTISANS’ WARD',
      fact: 'Smiths, weavers and potters lived and worked within the fort’s protection.', signY: 4.8 });
    // ---- OUTER GATE — twin towers, arch, road, barracks, training yard ----
    [-4, 4].forEach(tx => {
      cyl(1.8, 2.2, 8, 0xa5763e, tx, 26); H.colliders.push({ x: tx, z: 26, r: 2.4 });
      const dome2 = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        getMaterial({ color: 0xffffff, roughness: 0.6, map: T_plaster('#e8d8a8', '#cfc09a') }));
      dome2.position.set(tx, 8, 26); dome2.castShadow = true; scene.add(dome2);
    });
    box(12.4, 1, 1.6, 0x8a5a35, 0, 26, 8);
    box(1.6, 3.4, 0.4, 0x3a2412, -2.9, 26, 0, -0.35);
    box(1.6, 3.4, 0.4, 0x3a2412, 2.9, 26, 0, 0.35);
    const oroad = new THREE.Mesh(new THREE.PlaneGeometry(7, 16),
      getMaterial({ color: 0xd9bd85, roughness: 0.95 }));
    oroad.rotation.x = -Math.PI / 2; oroad.position.set(0, 0.02, 26); scene.add(oroad);
    banner(-6.5, 24, 0xd94f3d); banner(6.5, 24, 0xffd23e);
    [[-9, 30], [9, 30]].forEach(([bx5, bz5]) => {
      box(5, 3, 3, 0xc08a4e, bx5, bz5, 0, 0, 2.8);
      box(5.5, 0.35, 3.5, 0x8a5a2e, bx5, bz5, 3);
    });
    [[-4.5, 22], [4.5, 22]].forEach(([dx, dz]) => {           // training dummies
      cyl(0.12, 0.14, 1.8, 0x6b4423, dx, dz);
      box(1.1, 0.18, 0.18, 0x6b4423, dx, dz, 1.2);
      H.colliders.push({ x: dx, z: dz, r: 0.4 });
    });
    addLandmark({ x: 0, z: 26, r: 5, icon: '🏰', title: 'OUTER GATE',
      fact: 'Armies, traders and travellers all passed beneath gates like this.', signY: 9.4 });
    // ---- ROYAL COURT (diwan) — dais, throne, carpet, banners ----
    box(9, 0.5, 7, 0xffffff, 24, -8, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    [[21, -10.5], [24, -10.5], [27, -10.5], [21, -5.5], [24, -5.5], [27, -5.5]].forEach(([px, pz]) => {
      cyl(0.3, 0.36, 3.4, 0xffffff, px, pz, 0, 10, T_stone('#c9a05e', '#a3864e')); H.colliders.push({ x: px, z: pz, r: 0.5 });
    });
    box(9.6, 0.4, 7.6, 0xffffff, 24, -8, 3.4, 0, 0, T_wood('#8a5a35'));
    box(2.4, 0.9, 1.6, 0x8a6a45, 24, -9.5, 0.5);
    box(1.2, 1.1, 0.8, 0xa8232a, 24, -9.5, 1.2);
    const dcarpet2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5),
      getMaterial({ color: 0xa8232a, roughness: 0.9 }));
    dcarpet2.rotation.x = -Math.PI / 2; dcarpet2.position.set(24, 0.53, -7); scene.add(dcarpet2);
    banner(20.5, -5, 0xd94f3d); banner(27.5, -5, 0xffd23e);
    addLandmark({ x: 24, z: -8, r: 5, icon: '👑', title: 'ROYAL COURT',
      fact: 'Rulers held court, heard petitions and planned campaigns in halls like this.', signY: 5.4 });
    // ---- ambient guards ----
    ambient(0x7a3b2e, [[-10, -18], [10, -18]]);
    ambient(0x4a5d8a, [[6, -2], [6, 3]]);
    // annex garden with fountain, east side
    tree(20, 2, 0.7); tree(22, 8, 0.7);
    cyl(1.5, 1.7, 0.6, 0x9a9a9a, 20, 5);
    const fw = new THREE.Mesh(new THREE.CircleGeometry(1.2, 18),
      getMaterial({ color: 0x35b6d9, roughness: 0.2 }));
    fw.rotation.x = -Math.PI / 2; fw.position.set(20, 0.65, 5); scene.add(fw);
    H.colliders.push({ x: 20, z: 5, r: 1.6 });
    // ---- streets: main axis + cross lane ----
    street(0, -18, 0, 30, 3.5);
    street(-20, 2, 24, 2, 3);
    street(-10, -14, 10, -14, 2.5);
    // ---- NORTH-WEST STABLES + ARMORY ----
    box(8, 2.5, 4, 0xffffff, -25, -4, 0, 0, 4, T_plaster('#b5884a', '#967052'));
    box(8.5, 0.35, 4.5, 0xffffff, -25, -4, 2.5, 0, 0, T_wood('#8a5a2e'));
    box(1.4, 0.7, 0.9, 0xd9b64a, -27, -2, 0, 0.3);                  // hay
    box(1.6, 0.5, 0.7, 0x7a5228, -23, -6.5, 0);                    // trough
    for (let fi = 0; fi < 5; fi++)
      cyl(0.07, 0.09, 1.1, 0x6b4423, -30 + fi * 2.2, 0, 0);        // fence posts
    box(4, 2.5, 3, 0xffffff, -25, 7, 0, 0, 2.5, T_stone('#a5763e', '#86603a')); // armory
    for (let si = 0; si < 4; si++)
      cyl(0.04, 0.04, 2.2, 0x8a8a8a, -26.2 + si * 0.7, 6.2, 0.15 * si);
    addLandmark({ x: -25, z: 0, r: 4.5, icon: '🐎', title: 'STABLES',
      fact: 'Horses and elephants — the engines of ancient armies — were stabled here.', signY: 4.6 });
    // ---- WEST GARDEN — trees, flower beds, bench ----
    tree(-22, 4, 0.8); tree(-18, 8, 0.8);
    [[-21, 7, 0xd94f3d], [-19, 5, 0xe8a13c], [-22, 6, 0x8a4fa8]].forEach(([fx2, fz2, fc]) =>
      box(1.6, 0.4, 1, fc, fx2, fz2, 0, 0.2));
    box(1.6, 0.45, 0.55, 0x7a5228, -20, 9.5, 0, -0.2, 0.7);
    // ---- SOUTH-WEST GARRISON HOMES — huts, well ----
    houseV(-28, 12, { w: 3.5, h: 2.4, d: 3, c: 0xc08a4e });
    houseV(-24, 15, { w: 3.5, h: 2.6, d: 3, c: 0xb5884a });
    cyl(0.9, 1, 1, 0x7a5a3a, -26, 9); H.colliders.push({ x: -26, z: 9, r: 1.2 });
    // ---- NORTH SHRINE APPROACH — rockery, shrine, lamps, pines ----
    for (let ri = 0; ri < 6; ri++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + (ri % 3) * 0.3, 0),
        getMaterial({ color: 0x8a8a8a, roughness: 0.95, flatShading: true }));
      rock.position.set(-6 + ri * 2.4, 0.4, -27 + (ri % 2) * 1.6); rock.castShadow = true; scene.add(rock);
    }
    box(3, 0.5, 3, 0xc09a55, 0, -28, 0);
    const dome3 = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      getMaterial({ color: 0xffffff, roughness: 0.6, map: T_plaster('#e8d8a8', '#cfc09a') }));
    dome3.position.set(0, 1.8, -28); dome3.castShadow = true; scene.add(dome3);
    H.colliders.push({ x: 0, z: -28, r: 1.6 });
    [[-3, -26], [3, -26]].forEach(([lx, lz]) => {
      cyl(0.12, 0.16, 1.6, 0x5a5a5a, lx, lz);
      const lamp2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8),
        getMaterial({ color: 0xffd23e, emissive: 0xff9a00, emissiveIntensity: 2 }));
      lamp2.position.set(lx, 1.8, lz); scene.add(lamp2);
      addGlow(lx, 1.9, lz, 0xffd23e, 1.5, 0.4);
    });
    tree(-6, -29, 1); tree(6, -29, 1); tree(-12, -28, 0.9); tree(12, -28, 0.9);
    addLandmark({ x: 0, z: -28, r: 4, icon: '🛕', title: 'OLD SHRINE',
      fact: 'Travellers lit lamps here for a safe journey beyond the walls.', signY: 4.6 });
    // ---- EAST BARRACKS ----
    houseV(32, -2, { w: 4, h: 2.8, d: 3.5, c: 0xb5884a });
    houseV(32, 6, { w: 4, h: 2.8, d: 3.5, c: 0xc08a4e });
    tree(33, 12, 0.9); tree(30, 17, 1);
    box(0.8, 0.8, 0.8, 0x9a6a35, 34, 8, 0, 0.3, 1);
    // ---- SIDE BOUNDARY WALLS ----
    wallRun(-32, -10, -32, 18, 3);
    wallRun(36, -10, 36, 18, 3);
    wallRun(-20, -34, 20, -34, 3);
    wallTower(-32, 4); wallTower(36, 4); wallTower(-20, -34); wallTower(20, -34);
    // ---- LOOKOUT TOWER — tall, flagged, with railed platform ----
    cyl(2, 2.4, 10, 0xffffff, -20, -14, 0, 12, T_stone('#a5763e', '#86603a')); H.colliders.push({ x: -20, z: -14, r: 2.6 });
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.4, 12),
      getMaterial({ color: 0x8a5a35, roughness: 0.8 }));
    plat.position.set(-20, 10.2, -14); plat.castShadow = true; scene.add(plat);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.09, 8, 20),
      getMaterial({ color: 0x6b4423, roughness: 0.8 }));
    rail.rotation.x = Math.PI / 2; rail.position.set(-20, 11.1, -14); scene.add(rail);
    cyl(0.07, 0.09, 2.6, 0x4a3220, -20, -14, 10.4);
    const lflag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8),
      getMaterial({ color: 0xffd23e, side: 2 }));
    lflag.position.set(-19.3, 12.6, -14); scene.add(lflag);
    H.dynamics.push((dt, t) => { lflag.rotation.y = Math.sin(t * 2.4) * 0.4; });
    addLandmark({ x: -20, z: -14, r: 4, icon: '🗼', title: 'LOOKOUT TOWER',
      fact: 'Watchmen scanned the horizon from towers like this one.', signY: 12.6 });
    // ---- PROCESSIONAL COLONNADE along the main axis ----
    [[-5, -4], [5, -4], [-5, 0], [5, 0], [-5, 4], [5, 4]].forEach(([cx3, cz3]) => {
      cyl(0.3, 0.36, 3.2, 0xffffff, cx3, cz3, 0, 10, T_stone('#c9a05e', '#a3864e')); H.colliders.push({ x: cx3, z: cz3, r: 0.45 });
    });
    box(0.5, 0.4, 13, 0x8a5a35, -5, 0, 3.3);
    box(0.5, 0.4, 13, 0x8a5a35, 5, 0, 3.3);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3, 6),
      getMaterial({ color: 0xa8232a, roughness: 0.9 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(-8, 0.03, 3.5); scene.add(carpet);
    addLandmark({ x: -8, z: 8, r: 4.5, icon: '👑', title: 'DURBAR HALL',
      fact: 'Kings held court here — poets, scholars and generals gathered below.', signY: 4.8 });
    addLandmark({ x: 0, z: -11, r: 3.5, icon: '🗝️', title: 'SECRET CHAMBER',
      fact: 'Forts hid rooms for grain, records — and secrets. The Time Seal waits within!', signY: 4.2 });
    addLandmark({ x: 0, z: -17, r: 4, icon: '🏰', title: 'FORT GATE',
      fact: 'Massive gates guarded the city — only friends of history may pass!', signY: 6.2 });
    for (let i = 0; i < 6; i++) tree(-4 + i * 2.6, 12, 0.7); // 2.6 spacing: gaps stay walkable
    stall(0, 6, 0xd97b2e); pot(1, 7); pot(-1, 7);
    banner(-6, 0, 0xd94f3d); banner(6, 0, 0xffd23e);
    torch(-13, -16); torch(13, -16); torch(0, -19);
    P.items = [[0, -15, 'shard'], [10, 0, 'shard'], [-10, 0, 'shard'], [0, -8, 'shard']];
    P.gate = [0, -17]; P.seal = [0, -11]; P.portal = [8, -17];
  }

  H.bounds = P.bounds || 24;

  // Shadow frustum hugs the real playable bounds (not a fixed guess):
  // tighter texel density + bias tuned once here for every level.
  sun.shadow.camera.left = -(H.bounds + 8);
  sun.shadow.camera.right = H.bounds + 8;
  sun.shadow.camera.top = H.bounds + 8;
  sun.shadow.camera.bottom = -(H.bounds + 8);
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.6;

  // ---------- NPCs (placed BEFORE collectibles so the safety solver
  // accounts for their space too) ----------
  level.npcs.forEach(def => {
    const { grp } = npcMesh(def.color, def.icon);
    grp.position.set(def.pos[0], 0, def.pos[2]);
    scene.add(grp);
    glowRing(def.pos[0], def.pos[2], 0xffd23e);
    H.colliders.push({ x: def.pos[0], z: def.pos[2], r: 0.8 });
    H.dynamics.push((dt, t) => { grp.position.y = Math.abs(Math.sin(t * 1.8 + def.pos[0])) * 0.08; grp.rotation.y = Math.sin(t * 0.6 + def.pos[2]) * 0.5; });
    H.npcs.push({ def, mesh: grp });
  });

  // ---------- spawn collectibles ----------
  // Safety: nudge any item out of building/prop/NPC colliders so it is always
  // visible and reachable (regression guard — items must never spawn inside meshes).
  function clearSpot(x, z) {
    for (let k = 0; k < 60; k++) {
      let px = 0, pz = 0, bad = false;
      for (const c of H.colliders) {
        const dx = x - c.x, dz = z - c.z;
        const d = Math.hypot(dx, dz), need = c.r + 1.2;
        if (d < need) {
          bad = true;
          if (d < 1e-3) { px += need; }
          else { const w = (need - d) / d; px += dx * w; pz += dz * w; }
        }
      }
      if (!bad) break;
      if (Math.hypot(px, pz) < 0.05) { px += 0.7; pz += 0.35; } // escape symmetric traps
      x += px; z += pz;
      x = Math.max(-H.bounds + 1.5, Math.min(H.bounds - 1.5, x));
      z = Math.max(-H.bounds + 1.5, Math.min(H.bounds - 1.5, z));
    }
    return [x, z];
  }
  const kind = COLLECT_GEO[level.id] || 'tablet';
  const names = (ARTIFACT_INFO[level.id] || []).map(a => a.name);
  P.items.forEach(([ix, iz], i) => {
    const [x, z] = clearSpot(ix, iz);
    const mesh = collectMesh(kind);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    glowRing(x, z);
    H.collectibles.push({ i, mesh, pos: new THREE.Vector3(x, 0, z), name: names[i] || level.collectible.name, taken: false });
  });

  // ---------- KALAM companion bot (follows at distance, hovers) ----------
  const kalam = new THREE.Group();
  const kbody = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12),
    getMaterial({ color: 0x35e0ff, emissive: 0x1899bb, emissiveIntensity: 0.9, roughness: 0.3 }));
  kbody.position.y = 1.6; kalam.add(kbody);
  const keye = getMaterial({ color: 0x0a1a22, basic: true });
  [-0.11, 0.11].forEach(x => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), keye);
    e.position.set(x, 1.66, 0.27); kalam.add(e);
  });
  scene.add(kalam);
  H.kalam = kalam;

  // ---------- gate / seal / portal ----------
  H.gate = buildGate(P.gate[0], P.gate[1]);
  H.seal = buildSeal(P.seal[0], P.seal[1]);
  H.portal = buildPortal(P.portal[0], P.portal[1]);
  torch(P.gate[0] - 2.6, P.gate[1] + 1); torch(P.gate[0] + 2.6, P.gate[1] + 1);

  // fireflies / dust particles
  const pGeo = new THREE.BufferGeometry();
  const N = 120, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (R() - 0.5) * 50; pos[i * 3 + 1] = 0.5 + R() * 5; pos[i * 3 + 2] = (R() - 0.5) * 50; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffe9a8, size: 0.18, transparent: true, opacity: 0.8 }));
  scene.add(pts);
  H.dynamics.push((dt, t) => { pts.rotation.y += dt * 0.02; pts.position.y = Math.sin(t * 0.7) * 0.3; });

  H.spawn = [P.spawn[0], 0, P.spawn[1]];
  return H;
}

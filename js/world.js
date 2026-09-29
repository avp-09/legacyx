// Procedural stylized environments — one builder per era, shared helpers.
// No external models; lighting + fog + props keep every level distinct.
import { ARTIFACT_INFO } from './data.js';
import { AssetManager, HERO_SPOTS } from './assets.js';
import { Save } from './save.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

  // ============ SLICE 3: quality profile (visual only — same gameplay) ============
  // high: full detail · medium: balanced · low: aggressive (also auto-tightened on touch devices)
  const QNAME = (Save.data && Save.data.settings && Save.data.settings.quality) || 'high';
  const IS_TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const Q = {
    lodScale: (QNAME === 'low' ? 0.7 : QNAME === 'medium' ? 1.0 : 1.35) * (IS_TOUCH ? 0.85 : 1),
    fogFar: QNAME === 'low' ? 92 : QNAME === 'medium' ? 110 : 125,
    grassHalf: QNAME === 'low',
    fxOn: QNAME !== 'low'
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
  // Graphic-novel grade: cached MeshToonMaterial (3-tone ink banding) for
  // architecture/scenery. Params beyond toon support are safely ignored.
  // NOTE: never route through here a material you mutate per-frame
  // (gate bar, portal disc, collectible core, glow rings) — those stay unique.
  let _toonRamp = null;
  function toonRamp() {
    if (!_toonRamp) {
      const data = new Uint8Array([90, 160, 230, 255]);
      _toonRamp = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
      _toonRamp.minFilter = _toonRamp.magFilter = THREE.NearestFilter;
      _toonRamp.needsUpdate = true;
    }
    return _toonRamp;
  }
  function getMaterial(o = {}) {
    const key = [
      hex(o.color).toString(16), (+(o.roughness ?? 0.85)).toFixed(2), (+(o.metalness ?? 0)).toFixed(2),
      hex(o.emissive, 0).toString(16), (+(o.emissiveIntensity ?? 1)).toFixed(2),
      o.transparent ? 1 : 0, (+(o.opacity ?? 1)).toFixed(3), (o.map && o.map.key) || '', o.flatShading ? 1 : 0,
      o.side ?? 0, o.depthWrite === false ? 0 : 1, o.basic ? 1 : 0, 'toon'
    ].join('|');
    let m = matCache.get(key);
    if (!m) {
      const params = {
        color: hex(o.color),
        side: o.side ?? 0,
        gradientMap: toonRamp()
      };
      if (o.emissive !== undefined) { params.emissive = hex(o.emissive, 0); params.emissiveIntensity = o.emissiveIntensity ?? 1; }
      if (o.transparent) { params.transparent = true; params.opacity = o.opacity ?? 1; }
      if (o.map) params.map = o.map.tex;
      if (o.depthWrite === false) params.depthWrite = false;
      m = o.basic
        ? new THREE.MeshBasicMaterial(params)
        : new THREE.MeshToonMaterial(params);
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

  // ---- gradient sky dome (graphic-novel dusk: crimson zenith, ember horizon) ----
  // Per-level hue is kept as an undertone; the grade pushes every era to
  // the reference's deep-crimson-to-black sunset. One cached texture.
  function buildSky() {
    const crimson = new THREE.Color(0x5a0f16);
    const ember = new THREE.Color(0xe8641c);
    const top = '#' + new THREE.Color(level.sky).multiplyScalar(0.28).lerp(crimson, 0.5).getHexString();
    const mid = '#' + new THREE.Color(level.sky).multiplyScalar(0.8).lerp(crimson, 0.25).getHexString();
    const hor = '#' + ember.clone().lerp(new THREE.Color(level.sky), 0.35).getHexString();
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

  // ---------- atmosphere: low warm sun, haze, long natural shadows ----------
  buildSky();
  scene.fog = new THREE.Fog(level.fog, 30, Q.fogFar);
  const hemi = new THREE.HemisphereLight(0xfff3e0, level.ground, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a8, 1.6);
  sun.position.set(28, 13, 10); // golden-hour angle: raking light + long shadows
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48;
  scene.add(sun);
  // low sun disc on the horizon (one soft sprite, no bloom pass needed)
  {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(0xffc06a), transparent: true, opacity: 0.95,
      depthWrite: false, fog: false
    }));
    const dir = sun.position.clone().normalize();
    sp.position.copy(dir.multiplyScalar(215)); sp.position.y = Math.max(14, sp.position.y * 0.45);
    sp.scale.set(70, 70, 1);
    scene.add(sp);
  }
  // massive dusk sun: flat ink-edged disc riding the horizon (one draw)
  {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(26, 40),
      new THREE.MeshBasicMaterial({ color: 0xff9a2e, fog: false }));
    const dir = sun.position.clone().normalize();
    disc.position.copy(dir.multiplyScalar(205)); disc.position.y = 20;
    disc.lookAt(0, 10, 0);
    scene.add(disc);
  }
  H.dynamics.push(() => {});

  // ---------- ground ----------
  const groundMat = getMaterial({ color: 0xffffff, roughness: 1, map: T_ground('#' + level.ground.toString(16).padStart(6, '0')) });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(78, 40), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // broad tonal weathering so the plain reads as natural terrain, not flat
  // paint: one translucent blotch layer (shared cache, single draw).
  {
    const patch = makeTex('terrain-patch', 256, (g, S, rnd) => {
      g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 46; i++) {
        g.globalAlpha = 0.05 + rnd() * 0.09;
        g.fillStyle = rnd() > 0.5 ? '#5a5a5a' : '#b8b8b8';
        g.beginPath(); g.arc(rnd() * S, rnd() * S, 12 + rnd() * 42, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    }, 6, 6);
    const overlay = new THREE.Mesh(new THREE.CircleGeometry(77, 40),
      getMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.38, map: patch }));
    overlay.rotation.x = -Math.PI / 2; overlay.position.y = 0.005; overlay.receiveShadow = true;
    scene.add(overlay);
  }
  // plaza disc
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 28),
    getMaterial({ color: 0xf5e6c4, roughness: 0.9 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.01; plaza.receiveShadow = true;
  scene.add(plaza);

  const box = (w, h, d, color, x, z, y = 0, ry = 0, collide = 0, tex = null) => {
    const mat = tex ? getMaterial({ color: 0xffffff, roughness: 0.92, map: tex }) : getMaterial({ color, roughness: 0.85 });
    bakeStatic(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, ry);
    if (collide) H.colliders.push({ x, z, r: collide });
    return null; // static-batched; return value was never consumed
  };
  const cyl = (rt, rb, h, color, x, z, y = 0, seg = 12, tex = null) => {
    const mat = tex ? getMaterial({ color: 0xffffff, roughness: 0.9, map: tex }) : getMaterial({ color, roughness: 0.8 });
    bakeStatic(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y + h / 2, z);
    return null; // static-batched; return value was never consumed
  };

  // distant hills + clouds (atmospheric silhouette layering on zero budget)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(10 + R() * 8, 9 + R() * 7, 7),
      getMaterial({ color: new THREE.Color(level.ground).multiplyScalar(0.58), roughness: 1 }));
    hill.position.set(Math.cos(a) * 66, 0, Math.sin(a) * 66);
    scene.add(hill);
  }
  for (let i = 0; i < 6; i++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(2 + R() * 2, 10, 8),
      getMaterial({ color: 0xffe4cc, roughness: 1, transparent: true, opacity: 0.9 }));
    cl.position.set((R() - 0.5) * 80, 30 + R() * 10, (R() - 0.5) * 80);
    cl.scale.set(2.6, 0.6, 1); scene.add(cl); H.clouds.push(cl);
    const sp = 0.2 + R() * 0.4;
    H.dynamics.push((dt) => { cl.position.x += sp * dt; if (cl.position.x > 55) cl.position.x = -55; });
  }

  // ---------- shared props ----------
  const LEAF = [0x3e8e4f, 0x4da35a, 0x2f7a3e, 0x6fae4e];
  function tree(x, z, s = 1) {
    // Trunk + canopy bake instanced at end (2 draws for ALL trees).
    TREE_TRUNKS.push({ x, z, s });
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

  // ---------- NPC mesh: ancient-Indian attire ----------
  // Dhoti/saree drapes, bare shoulders, headbands, jewelry, staffs, bare
  // feet — same ~1.75m silhouette, feet origin, quest icon logic untouched.
  // def is optional (ambient walkers pass color only).
  function npcMesh(color, icon, def = null) {
    const grp = new THREE.Group();
    const h = Math.abs(Math.round((color || 0) * 7 + 3)) % 3;
    const skin = getMaterial({ color: [0x8a5a33, 0x9c6a40, 0x6f4527][h], roughness: 0.65 });
    const cream = getMaterial({ color: 0xefe3cc, roughness: 0.85 });
    const garb = getMaterial({ color, roughness: 0.8 });
    const hairM = getMaterial({ color: 0x241812, roughness: 0.9 });
    const goldM = getMaterial({ color: 0xd9a441, roughness: 0.45, metalness: 0.5 });
    const P = (geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.castShadow = true; grp.add(m); return m;
    };
    const isGiver = !!(def && def.role === 'giver');
    const isFem = !!(def && def.name && /amma|mira|scholar/i.test(def.name)) || (!def && h === 2);
    // bare feet
    P(new THREE.SphereGeometry(0.09, 8, 6), skin, -0.13, 0.05, 0.04).scale.set(1, 0.55, 1.4);
    P(new THREE.SphereGeometry(0.09, 8, 6), skin, 0.13, 0.05, 0.04).scale.set(1, 0.55, 1.4);
    if (isFem) {
      // long draped skirt + bodice in garment color, sash, braid, bangles
      P(new THREE.CylinderGeometry(0.3, 0.44, 1.05, 12), garb, 0, 0.6, 0);
      P(new THREE.CylinderGeometry(0.24, 0.28, 0.42, 12), garb, 0, 1.28, 0);
      const drape = P(new THREE.BoxGeometry(0.16, 0.85, 0.06), cream, 0.2, 0.95, 0.24);
      drape.rotation.z = 0.18;
      P(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), skin, -0.33, 1.05, 0).rotation.z = 0.25;
      P(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), skin, 0.33, 1.05, 0).rotation.z = -0.25;
      const b1 = P(new THREE.TorusGeometry(0.075, 0.02, 6, 12), goldM, -0.4, 0.92, 0);
      b1.rotation.x = Math.PI / 2 - 0.25;
      const b2 = P(new THREE.TorusGeometry(0.075, 0.02, 6, 12), goldM, 0.4, 0.92, 0);
      b2.rotation.x = Math.PI / 2 + 0.25;
      P(new THREE.SphereGeometry(0.24, 14, 12), skin, 0, 1.62, 0); // head
      const bun = P(new THREE.SphereGeometry(0.13, 10, 8), hairM, 0, 1.78, -0.2);
      const braid = P(new THREE.CylinderGeometry(0.055, 0.04, 0.55, 8), hairM, 0, 1.42, -0.28);
      braid.rotation.x = 0.12;
      P(new THREE.TorusGeometry(0.09, 0.025, 6, 12), goldM, -0.2, 1.58, 0.12);
      P(new THREE.TorusGeometry(0.09, 0.025, 6, 12), goldM, 0.2, 1.58, 0.12);
    } else {
      // cream dhoti, bare chest, shoulder sash; giver elders get staff+beard
      P(new THREE.CylinderGeometry(0.3, 0.37, 0.62, 12), cream, 0, 0.38, 0);
      P(new THREE.BoxGeometry(0.62, 0.1, 0.4), garb, 0, 0.68, 0);
      P(new THREE.CylinderGeometry(0.26, 0.3, 0.55, 12), skin, 0, 0.98, 0);
      const sash = P(new THREE.BoxGeometry(0.16, 0.7, 0.34), garb, -0.12, 1.0, 0.02);
      sash.rotation.z = 0.5;
      P(new THREE.CylinderGeometry(0.075, 0.075, 0.52, 8), skin, -0.34, 1.02, 0).rotation.z = 0.22;
      P(new THREE.CylinderGeometry(0.075, 0.075, 0.52, 8), skin, 0.34, 1.02, 0).rotation.z = -0.22;
      P(new THREE.SphereGeometry(0.24, 14, 12), skin, 0, 1.62, 0); // head
      const scalp = P(new THREE.SphereGeometry(0.25, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), hairM, 0, 1.66, -0.03);
      if (isGiver) {
        const band = P(new THREE.TorusGeometry(0.23, 0.035, 6, 14), goldM, 0, 1.68, 0);
        band.rotation.x = Math.PI / 2 - 0.15;
        P(new THREE.SphereGeometry(0.09, 8, 6), hairM, 0, 1.9, -0.05); // topknot
        const beard = P(new THREE.ConeGeometry(0.11, 0.22, 8), hairM, 0, 1.44, 0.16);
        beard.rotation.x = 0.35;
        P(new THREE.CylinderGeometry(0.035, 0.045, 1.6, 8), getMaterial({ color: 0x4a3220, roughness: 0.9 }), 0.42, 0.8, 0); // staff
        P(new THREE.SphereGeometry(0.06, 8, 6), goldM, 0.42, 1.62, 0);
      } else {
        const wrap = P(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), h ? cream : garb, 0, 1.64, -0.02);
        wrap.scale.set(1, 0.75, 1);
      }
    }
    // simple dark eyes so faces read at gameplay distance
    const eyeM = getMaterial({ color: 0x1a1210, roughness: 0.6 });
    P(new THREE.SphereGeometry(0.028, 6, 6), eyeM, -0.09, 1.63, 0.215);
    P(new THREE.SphereGeometry(0.028, 6, 6), eyeM, 0.09, 1.63, 0.215);
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
    const stoneM = getMaterial({ color: 0xffffff, roughness: 0.9, map: T_stone('#' + color.toString(16).padStart(6, '0')) });
    const full = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 12), stoneM);
    t.position.y = h / 2; t.castShadow = true; full.add(t);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      getMaterial({ color: 0xffffff, roughness: 0.6, map: T_plaster('#e8d8a8', '#cfc09a') }));
    dome.position.y = h; dome.castShadow = true; full.add(dome);
    const far = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h + 1, 7), stoneM);
    s.position.y = (h + 1) / 2; far.add(s);
    createLODObject([[0, full], [34, far]], x, 0, z);
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

  // ============ SLICE 3: static geometry batcher (visual only) ============
  // Every box()/cyl() flows through here; identical cached materials merge
  // into one mesh each. Colliders/gameplay are untouched (recorded separately).
  const batches = new Map();
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  function bakeStatic(geo, mat, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.clone();
    _e.set(0, ry, 0); _q.setFromEuler(_e);
    g.applyMatrix4(_m4.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz)));
    const key = mat.uuid;
    if (!batches.has(key)) batches.set(key, { mat, geos: [] });
    batches.get(key).geos.push(g);
    return null; // NOTE: box()/cyl() return values were never consumed
  }
  function buildStatic() {
    for (const { mat, geos } of batches.values()) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      geos.forEach(g => g.dispose());
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    }
    batches.clear();
  }
  // ============ SLICE 3: reusable LOD (visual only) ============
  // createLODObject([{dist, build}], pos) — tiers swap by camera distance.
  // Never used for player/NPCs/artifacts/puzzles/portals/seals.
  function createLODObject(tiers, x, y, z) {
    const lod = new THREE.LOD();
    tiers.forEach(([dist, grp]) => lod.addLevel(grp, dist * Q.lodScale));
    lod.position.set(x, y, z);
    scene.add(lod);
    return lod;
  }
  // Tree specs are collected, then baked as 2 InstancedMeshes (trunks+canopies).
  const TREE_TRUNKS = [], TREE_CANOPIES = [];
  function buildTreeInstances() {
    if (!TREE_TRUNKS.length) return;
    const trunkG = new THREE.CylinderGeometry(0.22, 0.34, 1.7, 7);
    const canG = new THREE.SphereGeometry(1, 9, 7);
    const trunkM = new THREE.InstancedMesh(trunkG, getMaterial({ color: 0xffffff, roughness: 0.9, map: T_wood('#6b4423') }), TREE_TRUNKS.length);
    TREE_TRUNKS.forEach((t, i) => {
      _dummy.position.set(t.x, 0.85 * t.s, t.z); _dummy.scale.setScalar(t.s);
      _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
      trunkM.setMatrixAt(i, _dummy.matrix);
      trunkM.setColorAt(i, _c.set(0xffffff));
    });
    const blobs = [[0, 2.5, 0, 1.35], [0.75, 2.0, 0.3, 0.9], [-0.7, 2.05, -0.35, 0.95], [0.1, 3.15, -0.1, 0.8]];
    const canM = new THREE.InstancedMesh(canG, getMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), TREE_TRUNKS.length * 4);
    let ci = 0;
    TREE_TRUNKS.forEach((t) => {
      blobs.forEach(([ox, oy, oz, r], bi) => {
        _dummy.position.set(t.x + ox * t.s, oy * t.s, t.z + oz * t.s);
        _dummy.scale.setScalar(r * t.s); _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
        canM.setMatrixAt(ci, _dummy.matrix);
        canM.setColorAt(ci, _c.set(LEAF[(bi + (t.x > 0 ? 1 : 0)) % LEAF.length]));
        ci++;
      });
    });
    [trunkM, canM].forEach(m => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    });
  }
  // ============ SLICE 2: instanced scatter + district helpers (visual only) ============
  // Scatter lists hold [x, z, ...] with NO colliders — safe for distant scenery
  // and small off-path decor. Near-field buildings use houseV/box (with colliders).
  const SC = { rock: [], bush: [], grass: [], dhouse: [], droof: [], trunk: [], canopy: [] };
  function scatterRock(x, z, s = 1) { SC.rock.push([x, z, s, R() * 6.28]); }
  function scatterBush(x, z, s = 1) { SC.bush.push([x, z, s, R() * 6.28]); }
  function scatterGrass(x, z, s = 1) { SC.grass.push([x, z, s, R() * 6.28]); }
  function distantHouse(x, z, w, h, d, tone = 0) { SC.dhouse.push([x, z, w, h, d, tone]); SC.droof.push([x, z, w, h, d, tone]); }
  function scatterTree(x, z, s = 1) { SC.trunk.push([x, z, s]); SC.canopy.push([x, z, s]); }
  const _dummy = new THREE.Object3D();
  const _c = new THREE.Color();
  function pickIdx(n, x, z) { return Math.abs(Math.round(x * 7 + z * 13)) % n; }
  function buildInstanced(geo, list, matOpts, paint, shadow = true) {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, getMaterial(matOpts), list.length);
    list.forEach((e, i) => { paint(e, i); m.setColorAt(i, _c); });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = shadow; m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  function buildScatter() {
    buildInstanced(new THREE.DodecahedronGeometry(1, 0), SC.rock,
      { color: 0xffffff, roughness: 0.95, flatShading: true }, (e) => {
        _dummy.position.set(e[0], e[2] * 0.35, e[1]); _dummy.scale.setScalar(e[2]);
        _dummy.rotation.set(0, e[3], 0); _dummy.updateMatrix();
        _c.set([0x8a8a8a, 0x9a8a72, 0x7a6a58][pickIdx(3, e[0], e[1])]);
      });
    buildInstanced(new THREE.SphereGeometry(1, 8, 6), SC.bush,
      { color: 0xffffff, roughness: 0.95, flatShading: true }, (e) => {
        _dummy.position.set(e[0], e[2] * 0.45, e[1]); _dummy.scale.set(e[2], e[2] * 0.7, e[2]);
        _dummy.rotation.set(0, e[3], 0); _dummy.updateMatrix();
        _c.set([0x3e8e4f, 0x4da35a, 0x6fae4e][pickIdx(3, e[0], e[1])]);
      });
    buildInstanced(new THREE.ConeGeometry(0.35, 0.9, 5), SC.grass,
      { color: 0xffffff, roughness: 1, flatShading: true }, (e) => {
        _dummy.position.set(e[0], e[2] * 0.4, e[1]); _dummy.scale.setScalar(e[2]);
        _dummy.rotation.set(0, e[3], 0); _dummy.updateMatrix();
        _c.set([0x7ab648, 0xd9b64a, 0x4da35a][pickIdx(3, e[0], e[1])]);
      }, false);
    buildInstanced(new THREE.BoxGeometry(1, 1, 1), SC.dhouse,
      { color: 0xffffff, roughness: 0.92, map: T_brick('#b5763f', '#8a6a45') }, (e) => {
        _dummy.position.set(e[0], e[3] / 2, e[1]); _dummy.scale.set(e[2], e[3], e[4]);
        _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
        _c.set([0xffffff, 0xf2ddc4, 0xe8cfae][e[5] % 3]).multiplyScalar(0.95);
      });
    buildInstanced(new THREE.ConeGeometry(0.72, 0.55, 4), SC.droof,
      { color: 0xffffff, roughness: 0.9, flatShading: true }, (e) => {
        _dummy.position.set(e[0], e[3] + e[3] * 0.26, e[1]); _dummy.scale.set(e[2], e[3], e[4]);
        _dummy.rotation.set(0, Math.PI / 4, 0); _dummy.updateMatrix();
        _c.set([0x8a5a2e, 0x7a4a28, 0x9a6a38][e[5] % 3]);
      });
    buildInstanced(new THREE.CylinderGeometry(0.16, 0.24, 2.4, 7), SC.trunk,
      { color: 0xffffff, roughness: 0.9, map: T_wood('#6b4423') }, (e) => {
        _dummy.position.set(e[0], 1.2 * e[2], e[1]); _dummy.scale.setScalar(e[2]);
        _dummy.rotation.set(0, 0, 0); _dummy.updateMatrix();
        _c.set(0xffffff);
      });
    buildInstanced(new THREE.SphereGeometry(1.5, 9, 7), SC.canopy,
      { color: 0xffffff, roughness: 0.95, flatShading: true }, (e) => {
        _dummy.position.set(e[0], (2.4 + 0.9) * e[2], e[1]); _dummy.scale.set(e[2], e[2] * 0.85, e[2]);
        _dummy.rotation.set(0, e[0], 0); _dummy.updateMatrix();
        _c.set([0x3e8e4f, 0x4da35a, 0x2f7a3e][pickIdx(3, e[0], e[1])]);
      });
  }
  // Small plaza court: disc + benches + pots + lamp glow (colliders included).
  function addCourtyard(cx, cz, r = 4, withTree = true) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 22),
      getMaterial({ color: 0xf5e6c4, roughness: 0.9 }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(cx, 0.03, cz); disc.receiveShadow = true; scene.add(disc);
    [[-1, 0], [1, 0]].forEach(([ox, oz], i) => {
      box(1.4, 0.45, 0.5, 0xffffff, cx + ox * (r - 1), cz + oz * (r - 1), 0, i * 0.4, 0.7, T_wood('#8a5a35'));
    });
    pot(cx - r + 1, cz + 1); pot(cx + r - 1, cz - 1);
    cyl(0.12, 0.16, 2.2, 0x4a3220, cx + r - 0.6, cz + r - 0.6);
    const lampG = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8),
      getMaterial({ color: 0xffe9a8, emissive: 0xffb13c, emissiveIntensity: 1.6 }));
    lampG.position.set(cx + r - 0.6, 2.4, cz + r - 0.6); scene.add(lampG);
    addGlow(cx + r - 0.6, 2.5, cz + r - 0.6, 0xffb13c, 1.6, 0.4);
    if (withTree) tree(cx - r + 1.2, cz - r + 1.2, 0.9);
  }
  // Props along a path: pots, lamps, crates (thin posts skip colliders).
  function addStreetProps(x1, z1, x2, z2, step = 5) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), n = Math.max(2, Math.round(len / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n, px = x1 + dx * t + (R() - 0.5) * 1.2, pz = z1 + dz * t + (R() - 0.5) * 1.2;
      const k = i % 3;
      if (k === 0) pot(px, pz);
      else if (k === 1) {
        cyl(0.09, 0.12, 1.8, 0x4a3220, px, pz);
        const lg = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8),
          getMaterial({ color: 0xffe9a8, emissive: 0xffb13c, emissiveIntensity: 1.6 }));
        lg.position.set(px, 1.95, pz); scene.add(lg);
        addGlow(px, 2, pz, 0xffb13c, 1.3, 0.35);
      } else box(0.6, 0.6, 0.6, 0x9a6a35, px, pz, 0, R() * 0.8);
    }
  }
  // Ruin: broken wall stubs + rubble (colliders on stubs only).
  function addRuinCluster(cx, cz, ry = 0) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const L = (lx, lz) => [cx + lx * c - lz * s, cz + lx * s + lz * c];
    [[-2, 0, 1.8], [0.5, 0.5, 1.1], [2.5, -0.5, 2.2]].forEach(([lx, lz, h]) => {
      const [wx, wz] = L(lx, lz);
      box(1.4, h, 1.2, 0xffffff, wx, wz, 0, ry, 1.2, T_stone('#a5947a', '#877757'));
    });
    for (let i = 0; i < 5; i++) scatterRock(cx + (R() - 0.5) * 7, cz + (R() - 0.5) * 7, 0.3 + R() * 0.4);
  }
  // Palm tree: tall trunk + frond crown + nuts (collider included).
  function palm(x, z, s = 1) {
    cyl(0.14 * s, 0.22 * s, 4.6 * s, 0xffffff, x, z, 0, 8, T_wood('#7a5a35'));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(2.4 * s, 0.7 * s),
        getMaterial({ color: 0x2f7a3e, roughness: 0.9, side: 2 }));
      fr.position.set(x + Math.cos(a) * 1.1 * s, 4.6 * s, z + Math.sin(a) * 1.1 * s);
      fr.rotation.set(-0.5, -a + Math.PI / 2, 0, 'YXZ');
      fr.castShadow = true; scene.add(fr);
    }
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 8, 8),
      getMaterial({ color: 0x6b4a22, roughness: 0.9 }));
    nut.position.set(x + 0.2 * s, 4.3 * s, z); scene.add(nut);
    H.colliders.push({ x, z, r: 0.5 * s });
  }

  // ---------- collectible mesh ----------
  const COLLECT_COLORS = { 1: 0xcf6b2e, 2: 0x4aa3df, 3: 0xb678e8 };
  const COLLECT_GEO = { 1: 'tablet', 2: 'piece', 3: 'shard' };
  function collectMesh(kind) {
    const grp = new THREE.Group();
    const col = new THREE.MeshStandardMaterial({
      color: COLLECT_COLORS[level.id] || 0xffd23e,
      emissive: COLLECT_COLORS[level.id] || 0xffd23e, emissiveIntensity: 0.55, roughness: 0.4
    });
    let core;
    if (kind === 'shard') {
      core = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), col);
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
    const houses = [[-14, -4], [-14, 4], [7, -13], [9, -8], [14, 2], [12, 10], [-4, 12], [-13, 12],
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
    // GREAT BATH — stepped sunken pool with columns, instantly readable.
    // Built inside bathGroup so the GLB hero can hide ONLY this visible
    // geometry on success. Collider/landmark/quest below stay untouched.
    const bathGroup = new THREE.Group();
    scene.add(bathGroup);
    const pm = (geo, mat, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.y = ry;
      m.castShadow = true; m.receiveShadow = true;
      bathGroup.add(m);
      return m;
    };
    const bathStoneRim = getMaterial({ color: 0xffffff, roughness: 0.92, map: T_stone('#9a6a38', '#7d5630') });
    const bathStoneDark = getMaterial({ color: 0xffffff, roughness: 0.92, map: T_stone('#7a5228', '#614722') });
    const bathStoneCol = getMaterial({ color: 0xffffff, roughness: 0.9, map: T_stone('#c09a55', '#9c7c48') });
    const bathWood = getMaterial({ color: 0xffffff, roughness: 0.9, map: T_wood('#8a6a35') });
    pm(new THREE.BoxGeometry(8.6, 0.5, 6.6), bathStoneRim, -2, 0.25, -8); // rim platform
    const bathWater = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 3.8),
      getMaterial({ color: 0x2ea8d4, roughness: 0.1, metalness: 0.25, emissive: 0x0a4a66, emissiveIntensity: 0.35 }));
    bathWater.position.set(-2, 0.45, -8); bathGroup.add(bathWater);
    H.dynamics.push((dt, t) => { if (bathGroup.visible) bathWater.position.y = 0.45 + Math.sin(t * 1.6) * 0.04; });
    for (let s = 0; s < 3; s++)                                   // steps down (south side)
      pm(new THREE.BoxGeometry(3.2 - s * 0.5, 0.28, 0.6), bathStoneDark, -2, 0.35 - s * 0.12 + 0.14, -4.6 + s * 0.55);
    [[-5.4, -10.6], [1.4, -10.6], [-5.4, -5.4], [1.4, -5.4]].forEach(([cx2, cz2]) => {
      pm(new THREE.CylinderGeometry(0.28, 0.34, 3.2, 12), bathStoneCol, cx2, 1.6, cz2); // colonnade
      pm(new THREE.BoxGeometry(1, 0.3, 1), bathWood, cx2, 3.35, cz2);
    });
    // Hero GLB swap: same landmark, same footprint, zero gameplay change.
    // Fire-and-forget: procedural bath is already playable; the GLB swaps
    // in when (and only when) it loads successfully.
    try {
      const bathSpot = (HERO_SPOTS[1] || [])[0];
      if (bathSpot && bathSpot.url) {
        AssetManager.resolveHero(bathSpot.id, bathSpot.url).then(hero => {
          if (!hero) return; // fallback stays visible
          // Fit: uniform scale to a 10.5m square footprint centered at (-3,-7).
          // Derived from measured bbox (1.89 x 0.43 x 1.90) and district
          // constraints: east tablet at x=3.4 keeps ~1.1 clearance, seal
          // pedestal face (-12.9) keeps ~0.6 south, tablet at (-9,0) keeps
          // ~1.9 at the NW corner, market/crates clear north. The bath is
          // the dominant central-district landmark. Collider, landmark and
          // water behavior unchanged; water rect refitted below to the
          // enlarged basin interior (same material, same bob).
          const bb = new THREE.Box3().setFromObject(hero);
          const size = bb.getSize(new THREE.Vector3());
          const s = Math.min(10.5 / (size.x || 1), 10.5 / (size.z || 1));
          hero.scale.setScalar(s);
          const bb2 = new THREE.Box3().setFromObject(hero);
          hero.position.set(
            -3 - (bb2.min.x + bb2.max.x) / 2,
            -bb2.min.y,
            -7 - (bb2.min.z + bb2.max.z) / 2
          );
          hero.traverse(o => { // PBR fix: export is raw white + metal=1 with no
            // envmap/textures, which renders as black chrome or chalk. Keep the
            // authored geometry; restore the fired-brick look of the reference.
            if (o.isMesh) {
              const ms = Array.isArray(o.material) ? o.material : [o.material];
              ms.forEach(m => {
                if (m.metalness > 0.5) m.metalness = 0.05;
                if (m.color && m.color.getHex() === 0xffffff) m.color.set(0xc49a6b);
                if (m.roughness < 0.5) m.roughness = 0.95;
              });
            }
          });
          // Single recessed pool sheet fitted inside the hero basin walls.
          // Basin interior measured from GLB triangles (local space):
          // x in [-0.80, +0.25], z in [-0.25, +0.59]; lowest rim top at
          // local y -0.069 (world 0.81), basin floor at local y -0.184
          // (world 0.18). World rect below is inset ~0.28m from every
          // inner wall face; its top (0.66) sits below the rim and above
          // the floor, so no floating slab and no protrusion. Material
          // and bob identical to before — only refitted to the bigger basin.
          const heroWater = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.1, 4.64),
            getMaterial({ color: 0x2ea8d4, roughness: 0.1, metalness: 0.25, emissive: 0x0a4a66, emissiveIntensity: 0.35 }));
          heroWater.position.set(-4.54, 0.61, -6.05);
          scene.add(heroWater);
          H.dynamics.push((dt, t) => { heroWater.position.y = 0.61 + Math.sin(t * 1.6) * 0.03; });
          scene.add(hero);
          bathGroup.visible = false;
        }).catch(() => { /* fallback stays visible */ });
      }
    } catch { /* fallback stays visible */ }
    H.colliders.push({ x: -2, z: -8, r: 4.2 });
    addLandmark({ x: -2, z: -8, r: 5, icon: '🛁', title: 'THE GREAT BATH',
      fact: 'Mohenjo-daro had a watertight pool — probably used for ritual bathing 4,500 years ago! No temple stands beside it, so scholars think the pool itself was the sacred place.', signY: 5.2 });
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
      fact: 'Great storehouses held grain for the whole city — feeding thousands! Raised floors like this are thought to have kept grain dry through flood and monsoon.', signY: 5.2 });
    // WELL — stone ring with posts, beam, rope and bucket
    cyl(1.1, 1.25, 1.2, 0xffffff, 10, 2, 0, 12, T_stone('#7a5a3a', '#5a4632'));
    cyl(0.85, 0.85, 1.25, 0x1a2a3a, 10, 2);                       // dark shaft
    [9.1, 10.9].forEach(px => cyl(0.09, 0.09, 2.4, 0x4a3220, px, 2));
    box(2.2, 0.15, 0.15, 0x4a3220, 10, 2, 2.3);
    box(0.35, 0.35, 0.35, 0x8a5a2b, 10, 2, 1.4);                  // hanging bucket
    H.colliders.push({ x: 10, z: 2, r: 1.5 });
    addLandmark({ x: 10, z: 2, r: 3, icon: '🪣', title: 'THE WELL',
      fact: 'Wells gave every neighbourhood fresh water, right beside the streets. Stepwells and draw-wells like this served whole neighbourhoods.', signY: 4.2 });
    // drainage channels (glowing blue lines)
    [[-10, 0, 12], [2, 6, 10], [-4, -14, 14]].forEach(([x, z, len]) => {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.5),
        getMaterial({ color: 0x35b6d9, emissive: 0x1e7fa8, emissiveIntensity: 0.7 }));
      ch.position.set(x, 0.06, z); scene.add(ch);
    });
    stall(-6, 4, 0xd94f3d); stall(-9, 4, 0x3d7bd9, 0.2); stall(-7.5, 7, 0x3d8a4f, -0.15);
    addLandmark({ x: -7.5, z: 5.4, r: 4.2, icon: '🏪', title: 'MARKETPLACE',
      fact: 'Merchants traded beads, pottery and grain — weights were carefully standardised! Standardised stone weights found at such markets suggest trade here was carefully regulated.', signY: 4.4 });
    // ---- INDUS MARKET DISTRICT UPGRADE (visual only — gameplay frozen) ----
    // Bazaar frontage rows, extra stalls, drain detailing and grouped goods
    // inspired by design-references/indus/indusmarket.jpg + indusprops.jpg.
    // Strictly additive: no spawn/NPC/artifact/gate/seal/portal/Bath line is
    // touched. Every new collider below sits far clear of those coordinates
    // so the collectible safety solver (clearSpot) resolves identically.
    // Everything reuses the material cache; box()/cyl()/bakeStatic() output
    // merges into the static batches (zero extra draws for baked pieces).
    const shopTexA = T_brick('#b5763f', '#8a6a45');
    const shopTexB = T_brick('#a56635', '#7d5a3c');
    const shopTexC = T_plaster('#d9c49a', '#b8a67e');
    // Shop-house with recessed-look doorway, lintel, step, windows + awning.
    // face: 'S' (door on -z face, fronts the z=8 lane) or 'E' (+x face).
    function shopV(x, z, o = {}) {
      const w = o.w || 4, h = o.h || 2.8, d = o.d || 3.5;
      const tex = o.plaster ? shopTexC : (o.brick === 2 ? shopTexB : shopTexA);
      box(w, h, d, 0xffffff, x, z, 0, 0, o.r !== undefined ? o.r : 2.4, tex);
      box(w + 0.5, 0.3, d + 0.5, 0xffffff, x, z, h, 0, 0, T_wood('#8a5a2e')); // roof slab
      const faceS = (o.face || 'S') === 'S';
      const fx = faceS ? x + (o.dx || 0) : x + w / 2 + 0.04;                 // door center
      const fz = faceS ? z - d / 2 - 0.04 : z + (o.dz || 0);
      const dr = faceS ? 0 : Math.PI / 2;
      box(1.15, 1.8, 0.18, 0x2e1c0c, fx, fz, 0, dr);                        // shaded doorway
      box(1.55, 0.22, 0.34, 0x6b4423, fx, fz, 1.85, dr);   // lintel
      if (faceS) box(1.5, 0.18, 0.8, 0x9a8a72, x + (o.dx || 0), z - d / 2 - 0.5, 0); // step
      else box(0.8, 0.18, 1.5, 0x9a8a72, x + w / 2 + 0.5, z + (o.dz || 0), 0);
      const winC = [[-1.35], [1.35]];
      winC.forEach(([off], i) => {                                          // small openings
        if (o.nowin === i) return;
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.12),
          getMaterial({ color: 0x2e1c0c, emissive: 0xffb13c, emissiveIntensity: 0.3 }));
        if (faceS) win.position.set(x + off, 1.7, z - d / 2 - 0.02);
        else { win.position.set(x + w / 2 + 0.02, 1.7, z + off); win.rotation.y = Math.PI / 2; }
        scene.add(win);
      });
      const awn = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5),        // cloth awning
        getMaterial({ color: o.awn !== undefined ? o.awn : 0xc96a4a, side: 2, roughness: 0.85 }));
      if (faceS) {
        awn.position.set(x + (o.dx || 0), 2.45, z - d / 2 - 0.85);
        awn.rotation.x = -Math.PI / 2 + 0.5;
        cyl(0.06, 0.06, 2.1, 0x4a3220, x + (o.dx || 0) - 1.2, z - d / 2 - 1.5);
        cyl(0.06, 0.06, 2.1, 0x4a3220, x + (o.dx || 0) + 1.2, z - d / 2 - 1.5);
      } else {
        awn.position.set(x + w / 2 + 0.85, 2.45, z + (o.dz || 0));
        awn.rotation.z = Math.PI / 2 - 0.5; awn.rotation.y = Math.PI / 2;
        cyl(0.06, 0.06, 2.1, 0x4a3220, x + w / 2 + 1.5, z + (o.dz || 0) - 1.2);
        cyl(0.06, 0.06, 2.1, 0x4a3220, x + w / 2 + 1.5, z + (o.dz || 0) + 1.2);
      }
      awn.castShadow = true; scene.add(awn);
    }
    // Baked (zero-draw) goods: jars, sacks, crates, baskets, tables, stones.
    const jarM = () => getMaterial({ color: 0xffffff, roughness: 0.75, map: T_plaster('#b5542d', '#8a3f22') });
    const sackM = () => getMaterial({ color: 0xd9b06a, roughness: 1 });
    const crateM = () => getMaterial({ color: 0xffffff, roughness: 0.9, map: T_wood('#9a6a35') });
    const stoneM = () => getMaterial({ color: 0x8a8a8a, roughness: 0.95, flatShading: true });
    const tableM = () => getMaterial({ color: 0xffffff, roughness: 0.85, map: T_wood('#7a5228') });
    const basketM = () => getMaterial({ color: 0xc9a05e, roughness: 1 });
    function jarRow(x, z, n = 3, s = 1) {
      for (let i = 0; i < n; i++)
        bakeStatic(new THREE.CylinderGeometry(0.26 * s, 0.36 * s, 0.95 * s, 10), jarM(),
          x + i * 0.75 * s, 0.475 * s, z + (i % 2) * 0.2);
    }
    function sackPile(x, z, n = 3) {
      for (let i = 0; i < n; i++)
        bakeStatic(new THREE.SphereGeometry(0.5, 10, 8), sackM(),
          x + (i % 2) * 0.8 - 0.3, 0.32, z + Math.floor(i / 2) * 0.7, 0, 1, 0.68, 1);
    }
    function crateStack(x, z, ry = 0.1) {
      bakeStatic(new THREE.BoxGeometry(0.7, 0.7, 0.7), crateM(), x, 0.35, z, ry);
      bakeStatic(new THREE.BoxGeometry(0.55, 0.55, 0.55), crateM(), x + 0.1, 0.97, z - 0.05, ry + 0.4);
    }
    function basketPair(x, z) {
      bakeStatic(new THREE.CylinderGeometry(0.36, 0.26, 0.45, 10), basketM(), x, 0.22, z, 0.3);
      bakeStatic(new THREE.CylinderGeometry(0.32, 0.24, 0.4, 10), basketM(), x + 0.65, 0.2, z + 0.25, 1.1);
    }
    function grindStone(x, z, ry = 0) {
      bakeStatic(new THREE.BoxGeometry(0.95, 0.25, 0.65), stoneM(), x, 0.12, z, ry);
      bakeStatic(new THREE.BoxGeometry(0.5, 0.18, 0.18), stoneM(), x, 0.33, z, ry + 0.2);
    }
    function marketTable(x, z, ry = 0, goods = 0xd94f3d) {
      const c = Math.cos(ry), s = Math.sin(ry);
      bakeStatic(new THREE.BoxGeometry(1.7, 0.12, 1.0), tableM(), x, 0.72, z, ry);
      [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]].forEach(([ox, oz]) =>
        bakeStatic(new THREE.BoxGeometry(0.12, 0.72, 0.12), tableM(), x + ox * c - oz * s, 0.36, z + ox * s + oz * c, ry));
      const gm = getMaterial({ color: goods, roughness: 0.6 });
      [[-0.5, 0], [0, 0.15], [0.5, -0.05]].forEach(([ox, oz]) =>
        bakeStatic(new THREE.SphereGeometry(0.2, 10, 8), gm, x + ox * c - oz * s, 0.95, z + ox * s + oz * c, 0));
    }
    function ladder(x, z, ry = 0, h = 2.6) {
      const c = Math.cos(ry), s = Math.sin(ry);
      [-0.35, 0.35].forEach(off =>
        bakeStatic(new THREE.BoxGeometry(0.09, h, 0.09), tableM(), x + off * c, h / 2, z - off * s, ry));
      for (let i = 1; i <= 4; i++)
        bakeStatic(new THREE.BoxGeometry(0.75, 0.07, 0.07), tableM(), x, i * h / 5.2, z, ry);
    }
    // -- bazaar frontage: continuous street wall north of the z=8 lane --
    shopV(-19, 11.5, { w: 4, h: 2.8, d: 3.5, face: 'S', awn: 0xc96a4a });
    shopV(-8.5, 11.8, { w: 3.5, h: 3.3, d: 3.5, face: 'S', brick: 2, awn: 0x7a8a4d, dx: 0.4 });
    shopV(4.5, 12, { w: 3.5, h: 3, d: 3.5, face: 'S', plaster: true, awn: 0x4d7a8a, dx: -0.4 });
    // -- west bazaar arm facing the market lane --
    shopV(-19, 4.5, { w: 3.5, h: 3, d: 4, face: 'E', brick: 2, awn: 0xc96a4a });
    shopV(-19, -0.5, { w: 3.5, h: 2.7, d: 4, face: 'E', awn: 0xe8a13c, dz: -0.5 });
    ladder(-16.9, 10.2, 0.25); ladder(-6.9, 10.4, -0.15, 3);
    // -- extra stalls: one by the plaza route, one extending the south row --
    stall(-0.5, 5.5, 0xd94f3d, 0.1); stall(-16.5, 16, 0x3d7bd9, -0.1);
    // -- second brick well serving the market quarter --
    cyl(1.1, 1.25, 1.1, 0xffffff, -20.5, 15.5, 0, 12, T_stone('#7a5a3a', '#5a4632'));
    cyl(0.85, 0.85, 1.15, 0x1a2a3a, -20.5, 15.5);
    [-21.4, -19.6].forEach(px => cyl(0.09, 0.09, 2.4, 0x4a3220, px, 15.5));
    box(2.2, 0.15, 0.15, 0x4a3220, -20.5, 15.5, 2.3);
    box(0.35, 0.35, 0.35, 0x8a5a2b, -20.5, 15.5, 1.4);
    H.colliders.push({ x: -20.5, z: 15.5, r: 1.5 });
    pot(-19, 16.6, 0xb5542d, 1.2); jarRow(-22.5, 16.8, 2, 1.1);
    // -- courtyard entrance stub walls (open south + west) --
    box(3.5, 1.1, 0.5, 0xffffff, 8.75, 12.8, 0, 0, 1.2, shopTexA);
    box(0.5, 1.1, 2.8, 0xffffff, 9.3, 11.4, 0, 0, 1.2, shopTexA);
    // -- drain dressing: brick curbs + slab bridges (flat, collider-free) --
    box(7.5, 0.2, 0.3, 0xffffff, -12.25, 0.55, 0, 0, 0, shopTexB);
    box(7.5, 0.2, 0.3, 0xffffff, -12.25, -0.55, 0, 0, 0, shopTexB);
    box(2, 0.16, 1.6, 0x9a6a38, -13, 0, 0.02);
    box(9, 0.2, 0.3, 0xffffff, -6.5, -13.45, 0, 0, 0, shopTexB);
    box(9, 0.2, 0.3, 0xffffff, -6.5, -14.55, 0, 0, 0, shopTexB);
    box(2, 0.16, 1.6, 0x9a6a38, -8, -14, 0.02);
    box(2, 0.16, 1.6, 0x9a6a38, 4, 6, 0.02);
    // -- grouped goods: pottery, sacks, tables, grinding stones --
    pot(-11.5, 9.8, 0xb5542d, 1.2); pot(-12.2, 9.3, 0x8a5a35); pot(-10.9, 9.2, 0xb5542d, 0.9);
    grindStone(-11.6, 10.6, 0.3);
    sackPile(-6.8, 9.6, 3); crateStack(-5.6, 9.7, 0.2); jarRow(-8.2, 9.7, 2, 0.9);
    pot(11.5, 3.5, 0xb5542d, 1.3); pot(12.3, 3, 0x8a5a35, 1.1); basketPair(11, 4.4);
    marketTable(3, 6.5, 0.15, 0xe8a13c); basketPair(4.2, 7.6); crateStack(4.9, 6.9, -0.2); sackPile(2.2, 7.8, 2);
    crateStack(-15, 18.5, 0.3); sackPile(-16.2, 19, 3); jarRow(-13.6, 18.8, 3, 1);
    grindStone(-6, 1.5, -0.2); basketPair(-5, 2.2); jarRow(-3.8, 1.2, 2, 0.9);
    // -- lane banners, reeds/vegetation, weathering (instanced = free) --
    banner(-12, 9.6, 0xd94f3d); banner(2, 9.6, 0xe8a13c);
    scatterBush(-15, 1.6, 0.9); scatterBush(-4.6, -1.6, 0.8); scatterBush(5.2, 7.4, 0.9);
    scatterBush(-2, -12.6, 0.8); scatterBush(-11.5, -13, 0.9); scatterBush(12.6, 4.2, 0.9);
    scatterBush(-17.5, 12.5, 0.8); scatterBush(6.5, 13.5, 0.8);
    scatterRock(-16.8, 8.6, 0.35); scatterRock(-6.2, 10.4, 0.3); scatterRock(6.8, 10.8, 0.35);
    scatterRock(-21.5, 13, 0.4); scatterRock(-3, -0.8, 0.3);
    scatterGrass(-14, 1.8, 0.8); scatterGrass(-7.5, -1.2, 0.9); scatterGrass(3, 4.8, 0.8);
    // -- distant settlement silhouettes fill the horizon (instanced, free) --
    [[40, 30], [-40, -30], [30, -40], [-30, -40], [0, 58], [40, -30], [-45, 35], [20, 56]].forEach(([x, z], i) => {
      distantHouse(x, z, 5 + (i % 3), 3 + (i % 2), 4 + ((i + 1) % 3), i + 2);
    });
    [[-44, -32], [44, 28], [34, -44]].forEach(([x, z]) => scatterTree(x, z, 1.2));
    // north banner courtyard (quiet, residential)
    banner(-3, 17, 0xd94f3d); banner(3, 17, 0x3d7bd9);
    pot(-1.5, 18.5); pot(1.5, 18.5);
    // grand entrance arch on the south road
    [-2.2, 2.2].forEach(ax => { cyl(0.35, 0.42, 3.4, 0x9a6a38, ax, 15); H.colliders.push({ x: ax, z: 15, r: 0.6 }); });
    box(5.6, 0.6, 1, 0x8a5a2e, 0, 15, 3.4);
    addLandmark({ x: 0, z: 15, r: 4, icon: '⛩️', title: 'CITY GATE',
      fact: 'Travellers entered the planned city through gates like this one. Gateways like this controlled who entered the planned city, and what they carried.', signY: 5 });
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
      fact: 'Families lived in sturdy brick houses along straight, planned streets. Thick walls and small windows kept these homes cool through fierce summers.', signY: 4.6 });
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
      fact: 'Wheat and barley from fields like these fed the entire city. Wheat and barley from such fields were the daily bread of the city.', signY: 4.6 });
    // ---- EAST WORKSHOPS — sheds, kiln, carts ----
    [[26, -4], [26, 4]].forEach(([sx, sz]) => {
      [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]].forEach(([ox, oz]) =>
        cyl(0.12, 0.14, 2.2, 0x4a3220, sx + ox, sz + oz));
      box(4.2, 0.25, 3.2, 0xffffff, sx, sz, 2.2, 0, 0, T_wood('#8a5a2e'));
      box(1.6, 0.8, 1, 0x9a6a35, sx, sz, 0, 0.2, 1.2);                  // worktable
      box(0.6, 0.6, 0.6, 0x7a5228, sx + 1.4, sz + 0.6, 0, -0.2);
    });
    {
      const kilnM = getMaterial({ color: 0x8a4a2e, roughness: 0.9 });
      const full = new THREE.Group();
      const kd = new THREE.Mesh(new THREE.SphereGeometry(1.7, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), kilnM);
      kd.castShadow = true; full.add(kd);
      const kf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8),
        getMaterial({ color: 0xff7a00, emissive: 0xff5500, emissiveIntensity: 2.5 }));
      kf.position.set(0, 0.5, 1.8); full.add(kf);
      const far = new THREE.Group();
      const sd = new THREE.Mesh(new THREE.SphereGeometry(1.7, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), kilnM);
      far.add(sd);
      createLODObject([[0, full], [38, far]], 28, 0, -10);
    }
    cyl(0.3, 0.38, 2.2, 0x6b3a22, 28, -10, 1.2);
    H.colliders.push({ x: 28, z: -10, r: 1.9 });
    addLandmark({ x: 26, z: 0, r: 4.5, icon: '🧱', title: 'BRICK WORKSHOPS',
      fact: 'Kilns fired the standard-sized bricks that built the whole city. Harappan bricks were kiln-fired to standard sizes, some of the earliest quality control in history.', signY: 4.6 });
    // ---- SLICE 2: north-east residential block + courtyard + well ----
    houseV(26, 10, { h: 3, c: 0xa56635 });
    houseV(30, 14, { h: 2.7, c: 0xb5763f, roof: 'pyr' });
    houseV(29, 21, { h: 3.1, c: 0xc08a55 });
    addCourtyard(10, 25, 3.5);
    cyl(0.9, 1, 1, 0xffffff, 20, 24, 0, 12, T_stone('#7a5a3a', '#5a4632'));
    H.colliders.push({ x: 20, z: 24, r: 1.2 });
    // ---- SLICE 2: south-east storage row ----
    houseV(16, -24, { w: 5, h: 3, d: 4, c: 0xa56635 });
    houseV(24, -24, { w: 5, h: 2.7, d: 4, c: 0xb5763f, roof: 'pyr' });
    pot(19, -22, 0xb5542d, 1.4); pot(21, -22.5, 0x8a5a35, 1.3); pot(20, -26, 0xb5542d, 1.2);
    cart(12, -20, -0.4);
    // ---- SLICE 2: west drain-side houses ----
    houseV(-22, 2, { h: 2.8, c: 0xb5763f });
    houseV(-22, -6, { h: 3.1, c: 0xa56635, roof: 'pyr' });
    // ---- SLICE 2: south market extension stalls ----
    stall(-13, 17, 0xe8a13c, 0.12); stall(-10, 15, 0x3d7bd9, -0.12);
    // ---- SLICE 2: street life props ----
    addStreetProps(12, -6, 12, 2);
    addStreetProps(-20, 8, -12, 8);
    addStreetProps(-2, 8, 6, 8);
    // ---- SLICE 2: ruins + scatter inside walls ----
    addRuinCluster(-28, 24, 0.2);
    addRuinCluster(30, -20, -0.3);
    [[30, 28], [-28, 20], [14, -20], [-14, 30], [8, -30], [-30, -24]].forEach(([x, z]) => scatterRock(x, z, 0.5 + R() * 0.6));
    [[24, 26], [-24, 16], [16, -18], [-18, -18], [6, 30], [-6, -30]].forEach(([x, z]) => scatterBush(x, z, 0.7 + R() * 0.5));
    for (let gi = 0; gi < 15; gi++) scatterGrass(-28 + gi * 4, 32, 0.7 + R() * 0.8);
    for (let gi = 0; gi < 12; gi++) scatterGrass(-32, -18 + gi * 4, 0.7 + R() * 0.8);
    for (let gi = 0; gi < 8; gi++) scatterGrass(30 + R() * 4, -16 + gi * 4, 0.7 + R() * 0.8);
    // ---- SLICE 2: distant settlement ring (outside walls, no colliders) ----
    [[-52, 8], [-48, 22], [-54, -10], [52, 14], [48, -18], [56, -2], [-8, 52], [12, 54], [-20, -52], [6, -54], [24, 50], [-30, 48]].forEach(([x, z], i) => {
      distantHouse(x, z, 5 + (i % 3), 3 + (i % 2), 4 + ((i + 1) % 3), i);
    });
    [[-58, 0], [58, 8], [0, 60], [-8, -60], [20, -58], [-40, 40], [42, 38]].forEach(([x, z]) => scatterTree(x, z, 1.2 + R() * 0.6));
    addRuinCluster(-58, -20, 0.5);
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
      fact: 'Thousands lived in orderly blocks — each with drains, wells and courtyards. Each house typically had its own bath, its drain running out to the street.', signY: 4.8 });
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
      fact: 'Carts loaded with grain and pots rumbled along roads like this. Bullock carts like the ones modelled here carried harvests along such roads.', signY: 4.6 });
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
    // foreground framing boulders + scrub (instanced, collider-free, off-path)
    scatterRock(18, 20, 1.2); scatterRock(-20, -20, 1.1);
    scatterBush(20, 18, 1); scatterBush(-22, -18, 0.9);
    P.gate = [0, -19]; P.seal = [0, -14]; P.portal = [8, -19];
  } else if (level.id === 2) {
    P.bounds = 40;
    // Chola: giant temple, gopuram colours, port with boats, village
    const sand = 0xd9b06a;
    // CENTRAL TEMPLE — fallback geometry lives in templeGroup so the GLB
    // hero can hide ONLY these meshes on success. Colliders below stay put.
    const templeGroup = new THREE.Group();
    scene.add(templeGroup);
    const tm = (geo, mat, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.y = ry;
      m.castShadow = true; m.receiveShadow = true;
      templeGroup.add(m);
      return m;
    };
    tm(new THREE.BoxGeometry(6, 7, 6),
      getMaterial({ color: 0xffffff, roughness: 0.92, map: T_stone('#d9b06a', '#b3905a') }), 0, 3.5, -14); // sanctum
    tm(new THREE.BoxGeometry(8, 2.5, 8),
      getMaterial({ color: 0xffffff, roughness: 0.92, map: T_stone('#c09a55', '#9c7c48') }), 0, 1.25, -8); // mandapa
    H.colliders.push({ x: 0, z: -14, r: 5 });   // sanctum (unchanged; was the box() collide param)
    H.colliders.push({ x: 0, z: -8, r: 4.5 });  // mandapa (unchanged; was the box() collide param)
    const vim = tm(new THREE.ConeGeometry(3.4, 5, 4),
      getMaterial({ color: 0xb5822e, roughness: 0.7, flatShading: true }), 0, 9.5, -14, Math.PI / 4);
    const fin = tm(new THREE.SphereGeometry(0.5, 12, 10),
      getMaterial({ color: 0xffd23e, emissive: 0xcc8a00, emissiveIntensity: 1 }), 0, 12.4, -14);
    H.dynamics.push((dt, t) => { if (templeGroup.visible) fin.rotation.y += dt; });
    // festive painted bands around the sanctum
    [[2.2, 0xd94f3d], [4.2, 0xfff6e2], [6.2, 0xffd23e]].forEach(([by, bc]) =>
      tm(new THREE.BoxGeometry(6.35, 0.45, 6.35),
        getMaterial({ color: bc, roughness: 0.85 }), 0, by + 0.225, -14));
    // Hero GLB swap: same landmark, same footprint, zero gameplay change.
    // Fire-and-forget: procedural temple is already playable; the GLB swaps
    // in when (and only when) it loads successfully.
    try {
      const templeSpot = (HERO_SPOTS[2] || [])[0];
      if (templeSpot && templeSpot.url) {
        AssetManager.resolveHero(templeSpot.id, templeSpot.url).then(hero => {
          if (!hero) return; // fallback stays visible
          // Fit: MONUMENTAL presentation — uniform scale for ~10.4m height
          // (height-driven fit, proportions preserved; ~16% smaller than
          // the 1.9 fit so the precinct breathes), grounded at Y=0,
          // rotation Y=0 (geometry is x-symmetric; z-axis is the front
          // axis facing the gateway). Centered east (+3.48) of the slot
          // axis: plinth toe clears the tank's east steps with a visible
          // gap, with open room to the gate, pillars, seal and court.
          // Colliders/landmark/quest untouched.
          const bb = new THREE.Box3().setFromObject(hero);
          const size = bb.getSize(new THREE.Vector3());
          const s = 10.4 / (size.y || 1);
          hero.scale.setScalar(s);
          const bb2 = new THREE.Box3().setFromObject(hero);
          hero.position.set(
            templeSpot.pos[0] + 3.48 - (bb2.min.x + bb2.max.x) / 2,
            -bb2.min.y,
            templeSpot.pos[2] + 0.8 - (bb2.min.z + bb2.max.z) / 2
          );
          // Dressing: the export ships with no materials/textures, so dress
          // it in warm Chola sandstone from the shared material cache.
          const sandstone = getMaterial({ color: 0xd9b06a, roughness: 0.9, metalness: 0.02 });
          hero.traverse(o => {
            if (o.isMesh) { o.material = sandstone; o.castShadow = true; o.receiveShadow = true; }
          });
          scene.add(hero);
          templeGroup.visible = false;
          // Rendered-geometry audit log (info only): hero world bounds vs
          // tank east rim (x -4.2) and gateway axis (x 0, z -1).
          const bb3 = new THREE.Box3().setFromObject(hero);
          console.log('[chola] hero min', bb3.min.toArray().map(v => +v.toFixed(2)),
            'max', bb3.max.toArray().map(v => +v.toFixed(2)));
        }).catch(() => { /* fallback stays visible */ });
      }
    } catch { /* fallback stays visible */ }
    addLandmark({ x: 0, z: -12, r: 6.5, icon: '🛕', title: 'THE GREAT TEMPLE',
      fact: 'Chola kings raised soaring stone temples — like Thanjavur’s Brihadeeswara! The tower above the sanctum, the vimana, marks the home of the temple deity.', signY: 14 });
    // courtyard pillars
    for (let i = -2; i <= 2; i++) { cyl(0.35, 0.4, 3, 0xffffff, i * 3, -4, 0, 10, T_stone('#c9a05e', '#a3864e')); H.colliders.push({ x: i * 3, z: -4, r: 0.6 }); }
    // gopuram gateway south of the sanctum — tiered towers flank the path
    [-3, 3].forEach(gx => {
      const stoneA = getMaterial({ color: 0xffffff, roughness: 0.92, map: T_stone('#c09a55', '#9c7c48') });
      const stoneB = getMaterial({ color: 0xffffff, roughness: 0.92, map: T_stone('#b5822e', '#8f6a28') });
      const full = new THREE.Group();
      const t1 = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 2), stoneA);
      t1.position.y = 1.2; t1.castShadow = true; full.add(t1);
      const t2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 1.5), stoneB);
      t2.position.y = 3.2; t2.castShadow = true; full.add(t2);
      const t3 = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 1),
        getMaterial({ color: 0xd94f3d, roughness: 0.85 }));
      t3.position.y = 4.6; full.add(t3);
      const gf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8),
        getMaterial({ color: 0xffd23e, emissive: 0xcc8a00, emissiveIntensity: 1 }));
      gf.position.y = 5.4; full.add(gf);
      const far = new THREE.Group();
      const s = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.6, 2.2), stoneA);
      s.position.y = 2.8; far.add(s);
      createLODObject([[0, full], [36, far]], gx, 0, -1);
      H.colliders.push({ x: gx, z: -1, r: 1.4 });
    });
    box(8.4, 0.6, 1.4, 0x8a5a35, 0, -1, 5.2);
    addLandmark({ x: 0, z: -1, r: 3.6, icon: '🛕', title: 'TEMPLE GATEWAY',
      fact: 'Towering gopurams announced the temple long before you reached it. Its stacked tiers tell stories in sculpture, level upon level.', signY: 6.8 });
    // port: water strip + boats — sea covers the harbor basin only
    // (x -32..-8, z 11.5..23): boats/piers/moorings stay wet, while the
    // market streets, houses, stalls, trees and carts east/south of it
    // stay on dry land. Single plane, always above ground: no flicker.
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(24, 11.5),
      getMaterial({ color: 0x2e8fc4, roughness: 0.2 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-20, 0.03, 17.25); scene.add(sea);
    H.dynamics.push((dt, t) => { sea.position.y = 0.03 + Math.sin(t * 1.4) * 0.015; }); // stays above ground: no shoreline flicker
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
      fact: 'Chola ships carried spices — and stories — across the seas! Chola ships are recorded as sailing as far as Southeast Asia.', signY: 4.4 });
    stall(8, 6, 0x4aa3df); stall(11, 6, 0xd94f3d, -0.2);
    stall(-2, 12, 0x3d8a4f, 0.1); stall(2, 12, 0xe8a13c, -0.1);
    pot(-3.5, 13); pot(3.5, 13.2);
    addLandmark({ x: 9.5, z: 6, r: 4, icon: '🏪', title: 'MARKET',
      fact: 'Craftspeople sold bronze lamps, spices and cloth from busy stalls. Bronze lamps and icons cast nearby were prized across Asia.', signY: 4.2 });
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
      fact: 'Master carvers shaped gods, dancers and guardians from plain rock. Unfinished stones show every stage, from rough block to polished god.', signY: 4.4 });
    // ---- SLICE 2: west artisan street (more workshops) ----
    [[-20, -2], [-20, 6]].forEach(([sx, sz]) => {
      [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]].forEach(([ox, oz]) =>
        cyl(0.12, 0.14, 2.2, 0x4a3220, sx + ox, sz + oz));
      box(4.2, 0.25, 3.2, 0xffffff, sx, sz, 2.2, 0, 0, T_wood('#8a5a2e'));
      box(1.4, 0.7, 0.9, 0xffffff, sx, sz, 0, 0.15, 1.2, T_wood('#9a6a35'));
    });
    // ---- SLICE 2: temple tank (stepped water court) ----
    box(7, 0.5, 0.8, 0xffffff, -8, -10.6, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    box(7, 0.5, 0.8, 0xffffff, -8, -17.4, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    box(0.8, 0.5, 7.6, 0xffffff, -11.4, -14, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    box(0.8, 0.5, 7.6, 0xffffff, -4.6, -14, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    const tankW = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.4, 5.4),
      getMaterial({ color: 0x2e8fc4, roughness: 0.15, metalness: 0.2 }));
    tankW.position.set(-8, 0.3, -14); scene.add(tankW);
    box(2.4, 0.25, 0.7, 0xffffff, -8, -10.2, 0.1, 0, 0, T_stone('#c09a55', '#9c7c48'));
    H.colliders.push({ x: -8, z: -14, r: 4 });
    addLandmark({ x: -8, z: -14, r: 5, icon: '🛁', title: 'TEMPLE TANK',
      fact: 'Devotees bathed in temple tanks before entering to pray. Steps on all four sides let devotees descend to the water whatever its level.', signY: 4.6 });
    // ---- SLICE 2: palm grove + brahmin quarter ----
    palm(24, 20, 1); palm(28, 24, 1.1); palm(20, 26, 0.9);
    houseV(-13, -24, { h: 2.7, c: 0xc9a05e });
    houseV(-3, -27, { h: 2.9, c: 0xd9b06a });
    // ---- SLICE 2: street life + scatter ----
    addStreetProps(4, -18, 4, -8);
    addStreetProps(24, -14, 32, 8);
    [[-24, -8], [24, -20], [-6, 4]].forEach(([x, z]) => scatterRock(x, z, 0.4 + R() * 0.5));
    [[10, 5], [-4, 4], [20, 12]].forEach(([x, z]) => scatterBush(x, z, 0.7 + R() * 0.5));
    for (let gi = 0; gi < 12; gi++) scatterGrass(-28 + gi * 5, -32, 0.7 + R() * 0.7);
    // ---- SLICE 2: distant gopuram silhouettes + settlement ring ----
    [[-52, -18], [52, 12]].forEach(([gx, gz], i) => {
      box(6, 8 + i * 2, 5, 0xc09a55, gx, gz, 0, 0, 0);
      box(4, 4, 3.5, 0xb5822e, gx, gz, 8 + i * 2);
    });
    [[-48, 20], [48, -20], [-20, 54], [16, 52]].forEach(([x, z], i) => {
      distantHouse(x, z, 5 + (i % 2) * 2, 3, 4, i);
    });
    [[-58, 0], [58, 4]].forEach(([x, z]) => scatterTree(x, z, 1.2 + R() * 0.5));
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
      fact: 'Every temple began here — workers split living rock into perfect blocks. Split marks on such blocks show how wedges and water cracked living rock.', signY: 4.4 });
    // ---- NORTH SHRINES + gardens ----
    [[-8, -28], [8, -28]].forEach(([sx, sz]) => {
      const platM = getMaterial({ color: 0xffffff, roughness: 0.92, map: T_stone('#c09a55', '#9c7c48') });
      const full = new THREE.Group();
      const pf = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 4), platM);
      pf.position.y = 0.2; pf.receiveShadow = true; full.add(pf);
      const vim2 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 4),
        getMaterial({ color: 0xb5822e, roughness: 0.7, flatShading: true }));
      vim2.position.y = 2.2; vim2.rotation.y = Math.PI / 4; vim2.castShadow = true; full.add(vim2);
      [[-1.5, 1.5], [1.5, 1.5]].forEach(([ox, oz]) => {
        const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2, 8),
          getMaterial({ color: 0xc9a05e, roughness: 0.9 }));
        pp.position.set(ox, 1, oz); full.add(pp);
      });
      const far = new THREE.Group();
      const pb = new THREE.Mesh(new THREE.BoxGeometry(4, 1.8, 4), platM);
      pb.position.y = 0.9; far.add(pb);
      createLODObject([[0, full], [38, far]], sx, 0, sz);
      H.colliders.push({ x: sx, z: sz, r: 1.8 });
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
      fact: 'Farmers, potters and herders lived in villages around the temple city. Village tanks and wells watered both people and paddy fields.', signY: 4.8 });
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
      fact: 'Chola kings administered a vast realm — from courts much like this one. Inscriptions record Chola kings granting land and gold to temples from courts like this.', signY: 5.4 });
    // ---- ambient life ----
    ambient(0xd9b06a, [[14, 5], [19, 8]]);
    ambient(0x1e6f9c, [[-17, 12], [-12, 14]]);
    ambient(0x7a3b2e, [[12, -14], [12, -22]]);
    // ---- CHOLA PRECINCT + CITY UPGRADE (visual only — gameplay frozen) ----
    // Temple/tank/gateway/NPC/item/gate/seal/portal/spawn coordinates and
    // every gameplay collider are untouched. Each NEW collider below was
    // vetted clear (r+1.2+margin) of all of them, so clearSpot resolves
    // identically. box()/cyl()/bakeStatic() merge into static batches;
    // scatter/distantHouse feed the existing InstancedMeshes (zero draws).
    const precM = () => getMaterial({ color: 0xffffff, roughness: 0.92, map: T_stone('#c09a55', '#9c7c48') });
    const lampTopM = () => getMaterial({ color: 0xffe9a8, emissive: 0xffb13c, emissiveIntensity: 1.2 });
    const postM = () => getMaterial({ color: 0x4a3220, roughness: 0.9 });
    const bronzeM = () => getMaterial({ color: 0xb5822e, roughness: 0.7, flatShading: true });
    function lampPost(x, z, h = 2.2) {
      bakeStatic(new THREE.CylinderGeometry(0.09, 0.12, h, 8), postM(), x, h / 2, z, 0);
      bakeStatic(new THREE.BoxGeometry(0.42, 0.36, 0.42), lampTopM(), x, h + 0.18, z, 0);
    }
    function decoPillar(x, z, h = 2.6) {
      bakeStatic(new THREE.BoxGeometry(0.9, 0.3, 0.9), precM(), x, 0.15, z, 0);
      bakeStatic(new THREE.CylinderGeometry(0.24, 0.3, h, 10), getMaterial({ color: 0xc9a05e, roughness: 0.9 }), x, 0.3 + h / 2, z, 0);
      bakeStatic(new THREE.BoxGeometry(0.8, 0.25, 0.8), precM(), x, 0.3 + h + 0.125, z, 0);
    }
    function miniShrine(x, z, s = 1) {
      bakeStatic(new THREE.BoxGeometry(2.2 * s, 0.4 * s, 2.2 * s), precM(), x, 0.2 * s, z, 0);
      bakeStatic(new THREE.ConeGeometry(1.1 * s, 2 * s, 4), bronzeM(), x, 1.4 * s, z, Math.PI / 4);
    }
    function goodsJar(x, z, s = 1) {
      bakeStatic(new THREE.CylinderGeometry(0.26 * s, 0.36 * s, 0.95 * s, 10),
        getMaterial({ color: 0xffffff, roughness: 0.75, map: T_plaster('#b5542d', '#8a3f22') }), x, 0.475 * s, z, 0.3);
    }
    function goodsSack(x, z) {
      bakeStatic(new THREE.SphereGeometry(0.5, 10, 8), getMaterial({ color: 0xd9b06a, roughness: 1 }), x, 0.32, z, 0, 1, 0.68, 1);
    }
    function goodsCrate(x, z, ry = 0.1, y = 0) {
      bakeStatic(new THREE.BoxGeometry(0.7, 0.7, 0.7), getMaterial({ color: 0xffffff, roughness: 0.9, map: T_wood('#9a6a35') }), x, y + 0.35, z, ry);
    }
    // -- precinct courtyard paving (split planes flank the axis street) --
    [[-4.9, -13, 6.25, 14], [8.9, -13, 14.25, 14]].forEach(([px, pz, w, d]) => {
      const pv = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
        getMaterial({ color: 0xd9c49a, roughness: 0.95 }));
      pv.rotation.x = -Math.PI / 2; pv.position.set(px, 0.02, pz); pv.receiveShadow = true; scene.add(pv);
    });
    // -- ceremonial approach edging + crossbands along the axis street --
    box(0.35, 0.14, 4, 0xffffff, -2.9, -4, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    box(0.35, 0.14, 4, 0xffffff, 2.9, -4, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    box(6.15, 0.14, 0.4, 0xffffff, 0, -5, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    box(6.15, 0.14, 0.4, 0xffffff, 0, -3, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    lampPost(-3.2, -19.6); lampPost(3.2, -19.6); lampPost(-3.4, -6); lampPost(3.4, -6);
    banner(-5, -1, 0xffd23e); banner(5, -1, 0x4aa3df);
    banner(-4.6, -19.8, 0xd94f3d); banner(4.6, -19.8, 0x4aa3df);
    decoPillar(-5.5, -9); decoPillar(-5.5, -19); decoPillar(13.8, -11); decoPillar(13.8, -17);
    // -- precinct low walls (solid; vetted clear of items/NPCs/seal/portal) --
    box(0.5, 1.1, 12, 0xffffff, 14, -14, 0, 0, 1.5, T_stone('#c09a55', '#9c7c48')); // east parapet
    box(6, 1.1, 0.5, 0xffffff, -11, -6.5, 0, 0, 1.2, T_stone('#c09a55', '#9c7c48')); // north-west wall
    box(4, 1.1, 0.5, 0xffffff, 6.5, -6.5, 0, 0, 1.5, T_stone('#c09a55', '#9c7c48')); // north-east wall
    // -- tank surroundings: steps, shrines, lamps, west path (tank untouched) --
    box(7, 0.25, 1, 0xffffff, -8.5, -9.5, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    box(7, 0.25, 1, 0xffffff, -8.5, -18.5, 0, 0, 0, T_stone('#c09a55', '#9c7c48'));
    miniShrine(-12.8, -9.3, 0.9); miniShrine(-12.9, -18.7, 0.9);
    lampPost(-11.5, -10.5); lampPost(-3.6, -9.6); lampPost(-12.3, -18.3);
    {
      const tp = new THREE.Mesh(new THREE.PlaneGeometry(3, 6),
        getMaterial({ color: 0xd9c49a, roughness: 0.95 }));
      tp.rotation.x = -Math.PI / 2; tp.position.set(-14.5, 0.02, -14); tp.receiveShadow = true; scene.add(tp);
    }
    // -- market densify: stalls face the lanes, goods cluster around them --
    stall(13, 6.5, 0x4aa3df, 0.15); stall(-4, 4.5, 0xd94f3d, -0.1); stall(15, 12, 0xe8a13c, 0.2);
    stall(-18, 4, 0x3d8a4f, 0.3);
    houseV(19, 14, { h: 2.8, c: 0xc09a55 });
    goodsJar(10, 8.5); goodsJar(10.6, 8.1, 0.9); goodsSack(12, 9); goodsCrate(11.2, 9.4, 0.2);
    goodsJar(-3, 6); goodsSack(-2.2, 6.5); goodsCrate(-4.2, 5.5, -0.2);
    goodsJar(16, 10.5, 1.1); goodsSack(16.8, 11.2); goodsCrate(14.2, 10.6, 0.4);
    // -- port densify: warehouse, pier cargo, second pier (all on land/deck) --
    box(5, 3, 4, 0xa5824e, -24, 4, 0, 0, 2.5);
    box(5.5, 0.35, 4.5, 0x8a5a2e, -24, 4, 3);
    goodsCrate(-15, 17.5, 0.3, 0.6); goodsCrate(-13, 17.5, -0.2, 0.6); goodsJar(-14, 17.5, 0.9);
    goodsCrate(17.5, 13.5, 0.2); goodsSack(18.3, 14.1); goodsJar(16.7, 12.6, 1);
    box(4, 0.25, 1.6, 0x7a5228, -22, 15, 0.35);
    // -- royal/civic dress: entry posts, banners, braziers (no lights) --
    box(0.5, 3, 0.5, 0xffffff, 11.8, -13, 0, 0, 0.5, T_stone('#c9a05e', '#a3864e'));
    box(0.5, 3, 0.5, 0xffffff, 21, -13, 0, 0, 0.5, T_stone('#c9a05e', '#a3864e'));
    banner(12, -21, 0xd94f3d); banner(20, -21, 0xffd23e);
    [[13, -17], [19, -17]].forEach(([bx, bz]) => {
      bakeStatic(new THREE.CylinderGeometry(0.4, 0.25, 0.3, 10), postM(), bx, 0.65, bz, 0);
      bakeStatic(new THREE.SphereGeometry(0.22, 8, 8),
        getMaterial({ color: 0xff7a00, emissive: 0xff5500, emissiveIntensity: 2 }), bx, 0.9, bz, 0);
    });
    // -- greenery + weathering (palms solid-vetted; rest instanced/free) --
    palm(-13, -8, 0.9);
    scatterBush(-6, -7.5, 0.9); scatterBush(14.5, -10, 0.9); scatterBush(9, -3.5, 0.8);
    scatterBush(22, 10, 0.9); scatterBush(-20, 5, 0.9); scatterBush(-13, -12, 0.8);
    scatterGrass(-3.6, -16, 0.8); scatterGrass(3.6, -12, 0.8); scatterGrass(-3.6, -8, 0.8);
    scatterGrass(3.6, -18, 0.8); scatterGrass(-13.5, -11, 0.8); scatterGrass(10, -8, 0.8);
    scatterRock(-6.5, -8.5, 0.35); scatterRock(12.9, -9.5, 0.3); scatterRock(-13.8, -16, 0.4);
    // -- market-lane life (ambient walkers never collide, per system) --
    ambient(0x4aa3df, [[6, 4], [11, 5]]);
    ambient(0xd94f3d, [[-16, 8], [-12, 10]]);
    // -- distant city ring (instanced houses + baked silhouettes, free) --
    [[-30, 40], [30, 40], [-45, -5], [45, -25], [0, -50], [25, -45]].forEach(([x, z], i) => {
      distantHouse(x, z, 5 + (i % 3), 3 + (i % 2), 4 + ((i + 1) % 3), i + 1);
    });
    box(5, 7, 4, 0xc09a55, -40, -35, 0, 0, 0);
    box(3, 3, 3, 0xb5822e, -40, -35, 7);
    box(5, 6, 4, 0xc09a55, 42, 30, 0, 0, 0);
    box(3, 2.5, 3, 0xb5822e, 42, 30, 6);
    scatterTree(-48, -8, 1.2); scatterTree(44, 32, 1.3);
    // ---- NEW L2 CITY DENSITY (visual only — gameplay frozen) ----
    // North homes, east homes, farm huts, civic hall, artisan shed and
    // market/royal/distant infill. Every new collider below was vetted
    // clear (r+1.2+margin) of items/NPCs/spawn/gate/seal/portal, so
    // clearSpot resolves identically. Baked pieces merge (zero draws);
    // scatter/distantHouse reuse the InstancedMeshes.
    const l2woodM = () => getMaterial({ color: 0xffffff, roughness: 0.85, map: T_wood('#7a5228') });
    const l2stoneM = () => getMaterial({ color: 0x8a8a8a, roughness: 0.95, flatShading: true });
    houseV(0, 20, { h: 2.9, c: 0xc09a55 });
    houseV(-8, 19, { h: 2.7, c: 0xa56635, roof: 'pyr' });
    houseV(8, 21, { h: 3, c: 0xd9b06a });
    addCourtyard(0, 24, 3);
    houseV(24, -2, { h: 2.7, c: 0xb5763f });
    houseV(24, 6, { h: 3, c: 0xc08a55, roof: 'pyr' });
    cart(20, 2, 0.2);
    houseV(-6, 28, { h: 2.6, c: 0xa56635, r: 2.5 });
    houseV(22, 29, { h: 2.7, c: 0xc09a55, r: 2.5 });
    // civic hall east of the royal court (solid, vetted)
    box(6, 3.2, 4.5, 0xffffff, 24, -18, 0, 0, 3, T_stone('#c09a55', '#9c7c48'));
    box(6.6, 0.4, 5.1, 0xa5824f, 24, -18, 3.2);
    banner(27.5, -18, 0xd94f3d);
    // west artisan shed + timber + half-blocks + unfinished figure
    [[-27.1, -8.1], [-22.9, -8.1], [-27.1, -5.9], [-22.9, -5.9]].forEach(([px, pz]) =>
      cyl(0.12, 0.14, 2.2, 0x4a3220, px, pz));
    box(4.6, 0.25, 3.4, 0xffffff, -25, -7, 2.2, 0, 0, T_wood('#8a5a2e'));
    box(1.4, 0.7, 0.9, 0xffffff, -25, -7, 0, 0.15, 0, T_wood('#9a6a35'));
    for (let li = 0; li < 3; li++) {
      const log = new THREE.CylinderGeometry(0.14, 0.14, 2.6, 8); log.rotateZ(Math.PI / 2);
      bakeStatic(log, l2woodM(), -25, 0.16 + li * 0.26, -5.2, li * 0.15);
    }
    bakeStatic(new THREE.BoxGeometry(1.1, 0.9, 0.9), l2stoneM(), -23, 0.45, -8.2, 0.2);
    bakeStatic(new THREE.BoxGeometry(0.8, 0.6, 0.7), l2stoneM(), -22.9, 0.3, -6.4, -0.3);
    bakeStatic(new THREE.BoxGeometry(0.9, 1.3, 0.7), l2stoneM(), -27.5, 0.65, -6.8, 0.1);
    bakeStatic(new THREE.SphereGeometry(0.32, 10, 8), l2stoneM(), -27.5, 1.5, -6.8, 0);
    // extra market stall on the north row + royal banners + palms
    stall(5, 11, 0xe8a13c, -0.12);
    banner(12, -21, 0xd94f3d); banner(20, -21, 0xffd23e);
    palm(-18, -6, 0.9); palm(26, 10, 0.9);
    // scrub/grass weathering (instanced, free)
    scatterBush(-2, 18, 0.9); scatterBush(12, 18, 0.8); scatterBush(-24, -6, 0.9); scatterBush(28, 4, 0.8);
    scatterGrass(0, 16, 0.8); scatterGrass(-6, 22, 0.9); scatterGrass(20, 16, 0.8);
    // distant ring top-up (instanced houses + baked silhouettes + trees)
    [[-35, 15], [35, -15], [-15, 48], [48, 25], [-50, -35], [10, -52]].forEach(([x, z], i) => {
      distantHouse(x, z, 5 + (i % 3), 3 + (i % 2), 4 + ((i + 1) % 3), i);
    });
    box(4, 6, 3.5, 0xc09a55, -38, 28, 0, 0, 0);
    box(2.5, 2.5, 2.5, 0xb5822e, -38, 28, 6);
    scatterTree(-52, 10, 1.2); scatterTree(52, -12, 1.3);
    P.items = [[-10, -0.5, 'piece'], [-12, 2, 'piece'], [8, 7.5, 'piece'], [-15, 11, 'piece'], [16.5, 5.5, 'piece']];
    // foreground framing boulders + scrub (instanced, collider-free, off-path)
    scatterRock(24, 24, 1.2); scatterRock(-30, -20, 1.1);
    scatterBush(26, 22, 1); scatterBush(-28, -18, 0.9);
    P.gate = [0, -20.5]; P.seal = [0, -5.5]; P.portal = [8, -20.5];
  } else if (level.id === 3) {
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
      fact: 'Smiths, weavers and potters lived and worked within the fort’s protection. Fort artisans supplied soldiers, courtiers and builders alike.', signY: 4.8 });
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
      fact: 'Armies, traders and travellers all passed beneath gates like this. Gatehouses often doubled as guardrooms and toll posts.', signY: 9.4 });
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
      fact: 'Rulers held court, heard petitions and planned campaigns in halls like this. Poets and scholars competed for royal favour in halls like this.', signY: 5.4 });
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
      fact: 'Horses and elephants — the engines of ancient armies — were stabled here. Grooms, smiths and vets all worked to keep the war animals ready.', signY: 4.6 });
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
      fact: 'Travellers lit lamps here for a safe journey beyond the walls. Wayside shrines like this are thought to have served travellers far from the great temples.', signY: 4.6 });
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
    {
      const stoneM = getMaterial({ color: 0xffffff, roughness: 0.9, map: T_stone('#a5763e', '#86603a') });
      const full = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 10, 12), stoneM);
      body.position.y = 5; body.castShadow = true; full.add(body);
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.4, 12),
        getMaterial({ color: 0x8a5a35, roughness: 0.8 }));
      plat.position.y = 10.2; plat.castShadow = true; full.add(plat);
      const rail = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.09, 8, 20),
        getMaterial({ color: 0x6b4423, roughness: 0.8 }));
      rail.rotation.x = Math.PI / 2; rail.position.y = 11.1; full.add(rail);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 8),
        getMaterial({ color: 0x4a3220, roughness: 0.8 }));
      pole.position.y = 11.7; full.add(pole);
      const lflag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8),
        getMaterial({ color: 0xffd23e, side: 2 }));
      lflag.position.set(0.7, 12.6, 0); full.add(lflag);
      H.dynamics.push((dt, t) => { lflag.rotation.y = Math.sin(t * 2.4) * 0.4; });
      const far = new THREE.Group();
      const ss = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 11, 8), stoneM);
      ss.position.y = 5.5; far.add(ss);
      createLODObject([[0, full], [40, far]], -20, 0, -14);
      H.colliders.push({ x: -20, z: -14, r: 2.6 });
    }
    addLandmark({ x: -20, z: -14, r: 4, icon: '🗼', title: 'LOOKOUT TOWER',
      fact: 'Watchmen scanned the horizon from towers like this one. Beacon fires from such towers could relay warnings across long distances.', signY: 12.6 });
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
      fact: 'Kings held court here — poets, scholars and generals gathered below. Durbars gathered poets, dancers and generals under one painted roof.', signY: 4.8 });
    addLandmark({ x: 0, z: -11, r: 3.5, icon: '🗝️', title: 'SECRET CHAMBER',
      fact: 'Forts hid rooms for grain, records — and secrets. The Time Seal waits within! Hidden rooms really did exist in forts, for grain, records and last-resort refuge.', signY: 4.2 });
    addLandmark({ x: 0, z: -17, r: 4, icon: '🏰', title: 'FORT GATE',
      fact: 'Massive gates guarded the city — only friends of history may pass! Massive doors were often studded with iron spikes against war elephants.', signY: 6.2 });
    for (let i = 0; i < 6; i++) tree(-4 + i * 2.6, 12, 0.7); // 2.6 spacing: gaps stay walkable
    stall(0, 6, 0xd97b2e); pot(1, 7); pot(-1, 7);
    banner(-6, 0, 0xd94f3d); banner(6, 0, 0xffd23e);
    // ---- SLICE 2: second barracks row + courtyard ----
    houseV(12, 24, { w: 4, h: 2.8, d: 3.5, c: 0xb5884a });
    houseV(18, 24, { w: 4, h: 2.6, d: 3.5, c: 0xc08a4e });
    addCourtyard(15, 19, 3);
    // ---- SLICE 2: ruined bastion (south-west) ----
    addRuinCluster(-28, 0, 0.1);
    // ---- SLICE 2: north pines ----
    tree(16, -30, 1); tree(-16, -30, 1);
    // ---- SLICE 2: inner-court market stalls + banner row ----
    stall(-4, -2, 0x3d7bd9, 0.1); stall(4, -2, 0xd94f3d, -0.1);
    [[-2.5, -12], [2.5, -12], [-2.5, -6], [2.5, -6]].forEach(([bx, bz]) => banner(bx, bz, (bx + bz) % 2 ? 0xd94f3d : 0xffd23e));
    // ---- SLICE 2: barrels, crates, shields ----
    [[-22, 10], [22, -12], [10, -19]].forEach(([bx, bz]) => {
      cyl(0.5, 0.55, 0.9, 0x7a5228, bx, bz);
      box(0.7, 0.7, 0.7, 0x9a6a35, bx + 1.1, bz + 0.3, 0, 0.4);
    });
    [[-9, 5.4], [-7, 5.4]].forEach(([sx, sz]) => {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12),
        getMaterial({ color: 0x8a2a35, roughness: 0.6, metalness: 0.3 }));
      sh.rotation.x = Math.PI / 2; sh.position.set(sx, 1.2, sz); scene.add(sh);
    });
    // ---- SLICE 2: rubble + grass along walls ----
    [[-14, -20], [14, -20], [-28, 14], [28, 12]].forEach(([x, z]) => scatterRock(x, z, 0.5 + R() * 0.6));
    [[-6, 22], [6, 22], [-24, -14], [24, -14]].forEach(([x, z]) => scatterBush(x, z, 0.7 + R() * 0.5));
    for (let gi = 0; gi < 10; gi++) scatterGrass(-28 + gi * 6, 32, 0.7 + R() * 0.7);
    for (let gi = 0; gi < 8; gi++) scatterGrass(gi % 2 ? 30 : -30, -14 + gi * 4, 0.7 + R() * 0.7);
    // ---- SLICE 2: distant fortress silhouette + watch fires (outside bounds) ----
    box(24, 12, 8, 0x8a6a55, 0, -72, 0, 0, 0);
    [[-14, -72], [14, -72]].forEach(([tx, tz]) => {
      cyl(3, 3.6, 16, 0x8a6a55, tx, tz);
    });
    addGlow(-14, 17, -72, 0xff9a2e, 4, 0.5);
    addGlow(14, 17, -72, 0xff9a2e, 4, 0.5);
    [[-60, 10], [60, -6], [30, 55], [-35, 50]].forEach(([x, z]) => scatterTree(x, z, 1.3 + R() * 0.6));
    torch(-13, -16); torch(13, -16); torch(0, -19);
    P.items = [[0, -15, 'shard'], [10, 0, 'shard'], [-10, 0, 'shard'], [0, -8, 'shard']];
    // foreground framing boulders + scrub (instanced, collider-free, off-path)
    scatterRock(30, 28, 1.2); scatterRock(-30, 28, 1.1);
    scatterBush(30, -28, 0.9); scatterBush(-30, -28, 0.9);
    P.gate = [0, -17]; P.seal = [0, -11]; P.portal = [8, -17];
  }

  H.bounds = P.bounds || 24;
  if (Q.grassHalf && SC.grass.length > 4) SC.grass.length = Math.ceil(SC.grass.length / 2);
  buildScatter(); // bake all instanced scatter (visual only, no colliders)
  buildTreeInstances(); // 2 draws for every tree
  buildStatic(); // merge all box()/cyl() statics per material

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
    const { grp } = npcMesh(def.color, def.icon, def);
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

  // fire embers drifting upward (reuses the ambient particle slot: one draw)
  const pGeo = new THREE.BufferGeometry();
  const N = 120, pos = new Float32Array(N * 3), spd = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (R() - 0.5) * 50; pos[i * 3 + 1] = 0.5 + R() * 5; pos[i * 3 + 2] = (R() - 0.5) * 50; spd[i] = 0.35 + R() * 0.75; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffb13c, size: 0.28, transparent: true, opacity: 0.9 }));
  pts.visible = Q.fxOn; // hidden on LOW quality
  scene.add(pts);
  H.dynamics.push((dt) => {
    const a = pGeo.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = a.getY(i) + spd[i] * dt;
      if (y > 7) y = 0.4;
      a.setY(i, y);
    }
    a.needsUpdate = true;
    pts.rotation.y += dt * 0.02;
  });

  H.spawn = [P.spawn[0], 0, P.spawn[1]];
  return H;
}

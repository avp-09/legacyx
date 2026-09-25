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
    npcs: [], collectibles: [], landmarks: [],
    dynamics: [], // fn(dt,t)
    gate: null, seal: null, portal: null
  };

  // ---------- atmosphere ----------
  scene.background = new THREE.Color(level.sky);
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
  const groundMat = new THREE.MeshStandardMaterial({ color: level.ground, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(78, 40), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // plaza disc
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(7, 28),
    new THREE.MeshStandardMaterial({ color: 0xf5e6c4, roughness: 0.9 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.01; plaza.receiveShadow = true;
  scene.add(plaza);

  const box = (w, h, d, color, x, z, y = 0, ry = 0, collide = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    m.position.set(x, y + h / 2, z); m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (collide) H.colliders.push({ x, z, r: collide });
    return m;
  };
  const cyl = (rt, rb, h, color, x, z, y = 0, seg = 12) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    m.position.set(x, y + h / 2, z); m.castShadow = true;
    scene.add(m); return m;
  };

  // distant hills + clouds (depth on zero budget)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(10 + R() * 8, 9 + R() * 7, 7),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(level.ground).multiplyScalar(0.72), roughness: 1 }));
    hill.position.set(Math.cos(a) * 66, 0, Math.sin(a) * 66);
    scene.add(hill);
  }
  for (let i = 0; i < 6; i++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(2 + R() * 2, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 }));
    cl.position.set((R() - 0.5) * 80, 20 + R() * 8, (R() - 0.5) * 80);
    cl.scale.x = 1.8; scene.add(cl);
    const sp = 0.2 + R() * 0.4;
    H.dynamics.push((dt) => { cl.position.x += sp * dt; if (cl.position.x > 55) cl.position.x = -55; });
  }

  // ---------- shared props ----------
  const LEAF = [0x3e8e4f, 0x4da35a, 0x2f7a3e, 0x6fae4e];
  function tree(x, z, s = 1) {
    cyl(0.22 * s, 0.34 * s, 1.7 * s, 0x6b4423, x, z);
    // layered canopy — three blobs so it reads as a real tree, not a lollipop
    const blobs = [
      [0, 2.5, 0, 1.35], [0.75, 2.0, 0.3, 0.9], [-0.7, 2.05, -0.35, 0.95], [0.1, 3.15, -0.1, 0.8]
    ];
    blobs.forEach(([ox, oy, oz, r], i) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(r * s, 12, 10),
        new THREE.MeshStandardMaterial({ color: LEAF[(i + (x > 0 ? 1 : 0)) % LEAF.length], roughness: 0.95, flatShading: true }));
      c.position.set(x + ox * s, oy * s, z + oz * s);
      c.castShadow = true; scene.add(c);
    });
    if (s > 1.7) { // banyan: hanging aerial roots + wide shade
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        cyl(0.09, 0.12, 2.2 * s, 0x7a5a35, x + Math.cos(a) * 1.5 * s, z + Math.sin(a) * 1.5 * s, 0.4);
      }
    }
    H.colliders.push({ x, z, r: 0.6 * s });
  }
  function banner(x, z, color) {
    cyl(0.06, 0.06, 4, 0x4a3220, x, z);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.7 }));
    f.position.set(x + 0.75, 3.4, z); scene.add(f);
    H.dynamics.push((dt, t) => { f.rotation.y = Math.sin(t * 2 + x) * 0.35; });
  }
  function stall(x, z, awn, ry = 0) {
    const cosr = Math.cos(ry), sinr = Math.sin(ry);
    const L = (lx, lz) => [x + lx * cosr - lz * sinr, z + lx * sinr + lz * cosr];
    // counter + goods on top (fruit, grain, pots)
    box(2.4, 0.9, 1.4, 0x8a5a2b, x, z, 0, ry, 1.6);
    const goods = [0xd94f3d, 0xe8a13c, 0x7ab648, 0xb5542d];
    goods.forEach((g, i) => {
      const [gx, gz] = L(-0.8 + i * 0.55, 0.1);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8),
        new THREE.MeshStandardMaterial({ color: g, roughness: 0.6 }));
      m.position.set(gx, 1.05, gz); m.castShadow = true; scene.add(m);
    });
    // striped awning: alternating slats
    for (let i = 0; i < 6; i++) {
      const [sx, sz] = L(-1.25 + i * 0.5, 0);
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 2.0),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0xfff6e2 : awn, roughness: 0.7 }));
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
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    p.position.set(x, 0.32 * s, z); p.scale.y = 1.15; p.castShadow = true; scene.add(p);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22 * s, 0.07 * s, 8, 14),
      new THREE.MeshStandardMaterial({ color: 0x7a3a1e, roughness: 0.6 }));
    rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.72 * s, z); scene.add(rim);
  }
  function torch(x, z) {
    cyl(0.07, 0.09, 1.6, 0x3a2a1a, x, z);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffb13c, emissive: 0xff7a00, emissiveIntensity: 2 }));
    fl.position.set(x, 1.8, z); scene.add(fl);
    const li = new THREE.PointLight(0xff9a2e, 6, 9); li.position.set(x, 2, z); scene.add(li);
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
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    robe.position.y = 0.65; robe.castShadow = true; grp.add(robe);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xb5773f, roughness: 0.7 }));
    hd.position.y = 1.5; hd.castShadow = true; grp.add(hd);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }));
    cap.position.y = 1.55; grp.add(cap);
    // floating icon sprite via canvas
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d');
    cx.font = '84px serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(icon || '💬', 64, 70);
    const tex = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(0.9, 0.9, 1); spr.position.y = 2.3; grp.add(spr);
    scene.add(grp);
    return { grp, spr };
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
      new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    halo.position.y = 1.0; grp.add(halo);
    const li = new THREE.PointLight(COLLECT_COLORS[level.id] || 0xffd23e, 5, 7);
    li.position.y = 1.2; grp.add(li);
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
    P.bounds = 32;
    // Mohenjo-daro: brick houses grid, Great Bath, granary, drains
    const brick = 0xb5763f, brick2 = 0xa56635;
    const houses = [[-14, -4], [-14, 4], [-7, -10], [9, -8], [14, 2], [12, 10], [-4, 12], [-13, 12],
      [8, 18], [-8, 18], [20, -6], [20, 2]];
    houses.forEach(([x, z], i) => {
      const c = i % 2 ? brick : brick2;
      const h = 2.6 + (i % 3) * 0.5, ry = (i % 2) * 0.15;
      box(4.5, h, 4, c, x, z, 0, ry, 3);
      box(5, 0.35, 4.5, 0x8a5a2e, x, z, h);                       // roof slab
      box(1.1, 1.7, 0.2, 0x3a2412, x, z + 2.05, 0);               // door
      box(1.5, 0.25, 0.25, 0x6b4423, x, z + 2.05, 1.7);           // lintel
      [-1.3, 1.3].forEach(wx => {                                 // windows with warm light
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1),
          new THREE.MeshStandardMaterial({ color: 0x2e1c0c, emissive: 0xffb13c, emissiveIntensity: 0.35 }));
        win.position.set(x + wx, 1.6, z + 2.02); scene.add(win);
      });
    });
    // GREAT BATH — stepped sunken pool with columns, instantly readable
    box(8.6, 0.5, 6.6, 0x9a6a38, -2, -8, 0, 0, 0);                // rim platform
    const bathWater = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x2ea8d4, roughness: 0.1, metalness: 0.25, emissive: 0x0a4a66, emissiveIntensity: 0.35 }));
    bathWater.position.set(-2, 0.45, -8); scene.add(bathWater);
    H.dynamics.push((dt, t) => { bathWater.position.y = 0.45 + Math.sin(t * 1.6) * 0.04; });
    for (let s = 0; s < 3; s++)                                   // steps down (south side)
      box(3.2 - s * 0.5, 0.28, 0.6, 0x7a5228, -2, -4.6 + s * 0.55, 0.35 - s * 0.12);
    [[-5.4, -10.6], [1.4, -10.6], [-5.4, -5.4], [1.4, -5.4]].forEach(([cx2, cz2]) => {
      cyl(0.28, 0.34, 3.2, 0xc09a55, cx2, cz2);                   // colonnade
      box(1, 0.3, 1, 0x8a6a35, cx2, cz2, 3.2);
    });
    H.colliders.push({ x: -2, z: -8, r: 4.2 });
    addLandmark({ x: -2, z: -8, r: 5, icon: '🛁', title: 'THE GREAT BATH',
      fact: 'Mohenjo-daro had a watertight pool — probably used for ritual bathing 4,500 years ago!', signY: 5.2 });
    // GRANARY — raised pillared storehouse with grain sacks
    box(6.4, 0.7, 5.2, 0x8a6a45, -16, -14, 0, 0, 0);              // platform
    box(5.2, 2.4, 4, 0xb5763f, -16, -14, 0.7, 0, 0);
    box(5.8, 0.35, 4.6, 0x8a5a2e, -16, -14, 3.1);
    [-1.9, -0.6, 0.6, 1.9].forEach(px => cyl(0.22, 0.26, 2.4, 0xc09a55, -16 + px, -11.6, 0.7));
    [[-18, -11.5], [-17.2, -11.2], [-14.2, -11.4]].forEach(([sx, sz]) => {
      const sack = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xd9b06a, roughness: 0.9 }));
      sack.position.set(sx, 0.4, sz); sack.scale.y = 0.75; sack.castShadow = true; scene.add(sack);
    });
    H.colliders.push({ x: -16, z: -14, r: 3.9 });
    addLandmark({ x: -16, z: -14, r: 5.2, icon: '🌾', title: 'THE GRANARY',
      fact: 'Great storehouses held grain for the whole city — feeding thousands!', signY: 5.2 });
    // WELL — stone ring with posts, beam, rope and bucket
    cyl(1.1, 1.25, 1.2, 0x7a5a3a, 10, 2);
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
        new THREE.MeshStandardMaterial({ color: 0x35b6d9, emissive: 0x1e7fa8, emissiveIntensity: 0.7 }));
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
    pot(-7, 5); pot(-7.6, 5.3); pot(11, 3);
    tree(16, -12); tree(-18, -10); tree(18, 12); banner(-11, -2, 0xd94f3d); torch(0, -16); torch(3, -16);
    P.items = [[-4.5, 6.5, 'tablet'], [-9, 0, 'tablet'], [3.4, -8, 'tablet'], [0, 18, 'tablet'], [-11, -14, 'tablet']];
    P.gate = [0, -19]; P.seal = [0, -14]; P.portal = [8, -19];
  } else if (level.id === 2) {
    P.bounds = 32;
    // Nalanda: courtyards, stupas, library, observatory, gardens
    const stone = 0xcbb27f;
    [[-12, -6], [12, -6], [-12, 8], [12, 8]].forEach(([x, z]) => {
      box(5, 3, 5, stone, x, z, 0, 0, 3.2);
      const st = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 4),
        new THREE.MeshStandardMaterial({ color: 0xa5824f, roughness: 0.8 }));
      st.position.set(x, 4.1, z); st.rotation.y = Math.PI / 4; st.castShadow = true; scene.add(st);
    });
    // library hall + book piles by the door
    box(7, 3.4, 4, 0xb5894e, 0, 12, 0, 0, 4);
    box(2, 2.4, 0.3, 0x4a2f14, 0, 9.9, 0);
    [[2.6, 9.6, 0xd94f3d], [3.1, 9.7, 0x3d7bd9], [2.85, 10.1, 0x3d8a4f]].forEach(([bx3, bz3, bc]) =>
      box(0.5, 0.35, 0.7, bc, bx3, bz3, 0, 0.3));
    addLandmark({ x: 0, z: 12, r: 5, icon: '📚', title: 'THE GREAT LIBRARY',
      fact: 'Nalanda’s libraries are said to have held lakhs of handwritten manuscripts!', signY: 5.4 });
    // observatory platform + stargazing tube
    cyl(3, 3.4, 1, 0x9a9a9a, -14, -14); H.colliders.push({ x: -14, z: -14, r: 3.4 });
    cyl(0.15, 0.15, 3, 0x6a4a1a, -14, -14, 1);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a6a35, roughness: 0.5, metalness: 0.4 }));
    tube.position.set(-14, 2.6, -14); tube.rotation.z = 0.7; tube.castShadow = true; scene.add(tube);
    addLandmark({ x: -14, z: -14, r: 4.5, icon: '🔭', title: 'OBSERVATORY',
      fact: 'Scholars here tracked the stars and planets across the night sky.', signY: 4.8 });
    // garden stupas
    [[6, 4], [8, 6], [-7, 2]].forEach(([x, z]) => {
      cyl(0.9, 1.1, 1.4, 0xd9c48f, x, z); H.colliders.push({ x, z, r: 1.2 });
    });
    addLandmark({ x: 7, z: 5, r: 4, icon: '🛕', title: 'STUPA GARDEN',
      fact: 'Quiet gardens where monks walked, debated and meditated.', signY: 3.6 });
    // garden grove — curated border positions (never random: random clusters
    // can trap the player between trunks). All >=4 apart, off all paths.
    [[-20, -2], [-20, 6], [-20, 12], [-10, 14], [2, 16], [20, 12], [20, 6], [20, -2]]
      .forEach(([x, z]) => tree(x, z, 0.9 + R() * 0.3));
    // scholar quarter huts (thatched bunks for far-travelled students)
    [[-18, 4], [17, -4]].forEach(([hx, hz]) => {
      box(3.5, 2.4, 3, 0xa5824f, hx, hz, 0, 0, 2.2);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 1.6, 4),
        new THREE.MeshStandardMaterial({ color: 0x7a5a35, roughness: 0.9, flatShading: true }));
      roof.position.set(hx, 3.2, hz); roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
    });
    addLandmark({ x: 17, z: -4, r: 4, icon: '🛖', title: 'SCHOLAR QUARTERS',
      fact: 'Students from China, Korea and Central Asia lived and studied here.', signY: 4.6 });
    // debate courtyard — open ring of pillars with a carpet
    for (let d = 0; d < 6; d++) {
      const a = (d / 6) * Math.PI * 2;
      const px = 13 + Math.cos(a) * 3, pz = 14 + Math.sin(a) * 3;
      cyl(0.28, 0.32, 2.4, 0xc9a05e, px, pz); H.colliders.push({ x: px, z: pz, r: 0.45 });
    }
    const dcarpet = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20),
      new THREE.MeshStandardMaterial({ color: 0x8a2a35, roughness: 0.9 }));
    dcarpet.rotation.x = -Math.PI / 2; dcarpet.position.set(13, 0.03, 14); scene.add(dcarpet);
    addLandmark({ x: 13, z: 14, r: 4, icon: '🗣️', title: 'DEBATE COURTYARD',
      fact: 'Scholars sharpened ideas through fierce — and friendly — debate.', signY: 4.2 });
    P.spawn = [0, 5]; // open courtyard: clear of library, stupas, stall, NPCs
    stall(4, -2, 0xe8c547); pot(1, 11); banner(0, 8, 0xe8c547); torch(-2, -16); torch(2, -16);
    P.items = [[-9, -2, 'scroll'], [-14, -10.5, 'scroll'], [4.5, 6.5, 'scroll'], [0, 10.5, 'scroll'], [14, -2, 'scroll']];
    P.gate = [0, -19]; P.seal = [0, -14]; P.portal = [8, -19];
  } else if (level.id === 3) {
    P.bounds = 32;
    // Chola: giant temple, gopuram colours, port with boats, village
    const sand = 0xd9b06a;
    box(6, 7, 6, sand, 0, -14, 0, 0, 5);                       // sanctum
    box(8, 2.5, 8, 0xc09a55, 0, -8, 0, 0, 4.5);                // mandapa
    const vim = new THREE.Mesh(new THREE.ConeGeometry(3.4, 5, 4),
      new THREE.MeshStandardMaterial({ color: 0xb5822e, roughness: 0.7 }));
    vim.position.set(0, 9.5, -14); vim.rotation.y = Math.PI / 4; vim.castShadow = true; scene.add(vim);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xcc8a00, emissiveIntensity: 1 }));
    fin.position.set(0, 12.4, -14); scene.add(fin);
    H.dynamics.push((dt, t) => { fin.rotation.y += dt; });
    // festive painted bands around the sanctum
    [[2.2, 0xd94f3d], [4.2, 0xfff6e2], [6.2, 0xffd23e]].forEach(([by, bc]) =>
      box(6.35, 0.45, 6.35, bc, 0, -14, by));
    addLandmark({ x: 0, z: -12, r: 6.5, icon: '🛕', title: 'THE GREAT TEMPLE',
      fact: 'Chola kings raised soaring stone temples — like Thanjavur’s Brihadeeswara!', signY: 14 });
    // courtyard pillars
    for (let i = -2; i <= 2; i++) { cyl(0.35, 0.4, 3, 0xc9a05e, i * 3, -4); H.colliders.push({ x: i * 3, z: -4, r: 0.6 }); }
    // port: water strip + boats
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(60, 14),
      new THREE.MeshStandardMaterial({ color: 0x2e8fc4, roughness: 0.2 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-16, 0.02, 14); scene.add(sea);
    H.dynamics.push((dt, t) => { sea.position.y = 0.02 + Math.sin(t * 1.4) * 0.03; });
    [[-14, 13], [-19, 15]].forEach(([x, z], i) => {
      box(3.2, 0.7, 1.2, 0x6b4423, x, z, 0.1, i * 0.3);
      cyl(0.06, 0.06, 2.6, 0x4a3220, x, z, 0.4);
    });
    addLandmark({ x: -16, z: 13, r: 5, icon: '⛵', title: 'HARBOR',
      fact: 'Chola ships carried spices — and stories — across the seas!', signY: 4.4 });
    stall(8, 6, 0x4aa3df); stall(11, 6, 0xd94f3d, -0.2);
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
    // village streets east of the market
    [[15, 2], [19, 9]].forEach(([hx, hz]) => {
      box(4, 2.8, 3.5, 0xd9b06a, hx, hz, 0, 0.1, 2.5);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.5, 4),
        new THREE.MeshStandardMaterial({ color: 0x8a4a2e, roughness: 0.9, flatShading: true }));
      roof.position.set(hx, 3.5, hz); roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
    });
    pot(16, 7.5);
    P.items = [[-10, -0.5, 'piece'], [-12, 2, 'piece'], [8, 7.5, 'piece'], [-15, 11, 'piece'], [16.5, 5.5, 'piece']];
    P.gate = [0, -20.5]; P.seal = [0, -5.5]; P.portal = [8, -20.5];
  } else if (level.id === 4) {
    P.bounds = 30;
    // Fort: high walls, towers, gate arch, courtyard, secret chamber door
    const wall = 0xc08a4e;
    [[0, -22, 30, 2], [-16, -8, 2, 26], [16, -8, 2, 26]].forEach(([x, z, w, d]) => {
      box(w, 5, d, wall, x, z, 0, 0, 0);
    });
    [[-16, -20], [16, -20], [-16, 4], [16, 4]].forEach(([x, z]) => {
      cyl(2, 2.4, 7, 0xa5763e, x, z); H.colliders.push({ x, z, r: 2.6 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xe8d8a8, roughness: 0.6 }));
      dome.position.set(x, 7, z); dome.castShadow = true; scene.add(dome);
    });
    // palace block + garden
    box(6, 3, 5, 0xd9a860, -8, 8, 0, 0, 3.6);
    box(4, 2.2, 4, 0xb5884a, 8, 8, 0, 0, 3);
    // outer ward — artisans' facades and stalls beyond the inner court
    [[-8, 17], [0, 19], [8, 17]].forEach(([fx, fz]) => {
      box(4.5, 3, 3, 0xc08a4e, fx, fz, 0, 0, 2.7);
      box(5, 0.35, 3.5, 0x8a5a2e, fx, fz, 3);
    });
    stall(-4, 14, 0x3d7bd9, 0.15); stall(4, 14, 0xd94f3d, -0.15);
    addLandmark({ x: 0, z: 16, r: 4.5, icon: '🏘️', title: 'ARTISANS’ WARD',
      fact: 'Smiths, weavers and potters lived and worked within the fort’s protection.', signY: 4.8 });
    // annex garden with fountain, east side
    tree(20, 2, 0.7); tree(22, 8, 0.7);
    cyl(1.5, 1.7, 0.6, 0x9a9a9a, 20, 5);
    const fw = new THREE.Mesh(new THREE.CircleGeometry(1.2, 18),
      new THREE.MeshStandardMaterial({ color: 0x35b6d9, roughness: 0.2 }));
    fw.rotation.x = -Math.PI / 2; fw.position.set(20, 0.65, 5); scene.add(fw);
    H.colliders.push({ x: 20, z: 5, r: 1.6 });
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3, 6),
      new THREE.MeshStandardMaterial({ color: 0xa8232a, roughness: 0.9 }));
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
    new THREE.MeshStandardMaterial({ color: 0x35e0ff, emissive: 0x1899bb, emissiveIntensity: 0.9, roughness: 0.3 }));
  kbody.position.y = 1.6; kalam.add(kbody);
  const keye = new THREE.MeshBasicMaterial({ color: 0x0a1a22 });
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

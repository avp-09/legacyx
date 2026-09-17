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
    npcs: [], collectibles: [],
    dynamics: [], // fn(dt,t)
    gate: null, seal: null, portal: null
  };

  // ---------- atmosphere ----------
  scene.background = new THREE.Color(level.sky);
  scene.fog = new THREE.Fog(level.fog, 30, 95);
  const hemi = new THREE.HemisphereLight(0xffffff, level.ground, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -35; sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
  scene.add(sun);
  H.dynamics.push(() => {});

  // ---------- ground ----------
  const groundMat = new THREE.MeshStandardMaterial({ color: level.ground, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 40), groundMat);
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
    hill.position.set(Math.cos(a) * 52, 0, Math.sin(a) * 52);
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
  function tree(x, z, s = 1) {
    cyl(0.22 * s, 0.3 * s, 1.6 * s, 0x6b4423, x, z);
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.3 * s, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x3e8e4f, roughness: 0.9 }));
    c.position.set(x, 2.2 * s, z); c.castShadow = true; scene.add(c);
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
    box(2.4, 0.9, 1.4, 0x8a5a2b, x, z, 0, ry, 1.6);
    const top = box(2.8, 0.15, 1.8, awn, x, z, 1.7, ry);
    top.castShadow = true;
    for (const px of [-1, 1]) for (const pz of [-0.7, 0.7])
      cyl(0.05, 0.05, 1.7, 0x4a3220, x + px, z + pz);
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
  const COLLECT_COLORS = { 1: 0xcf6b2e, 2: 0xe8c547, 3: 0x4aa3df, 4: 0xb678e8, 5: 0x4caf6d };
  const COLLECT_GEO = { 1: 'tablet', 2: 'scroll', 3: 'piece', 4: 'shard', 5: 'page' };
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
    items: [], npcSpots: []
  };

  if (level.id === 1) {
    // Mohenjo-daro: brick houses grid, Great Bath, granary, drains
    const brick = 0xb5763f, brick2 = 0xa56635;
    const houses = [[-14, -4], [-14, 4], [-7, -10], [9, -8], [14, 2], [12, 10], [-4, 12], [-13, 12]];
    houses.forEach(([x, z], i) => {
      const c = i % 2 ? brick : brick2;
      box(4.5, 2.6 + (i % 3) * 0.5, 4, c, x, z, 0, (i % 2) * 0.15, 3);
      box(5, 0.35, 4.5, 0x8a5a2e, x, z, 2.6 + (i % 3) * 0.5);
      box(1.1, 1.7, 0.2, 0x3a2412, x, z + 2.05, 0);
    });
    // Great Bath (sunken + water)
    box(8, 1, 6, 0x9a6a38, -2, -8, 0, 0, 0);
    const bath = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x35b6d9, roughness: 0.15, metalness: 0.1 }));
    bath.position.set(-2, 0.55, -8); scene.add(bath);
    H.dynamics.push((dt, t) => { bath.position.y = 0.55 + Math.sin(t * 1.6) * 0.04; });
    H.colliders.push({ x: -2, z: -8, r: 3.4 });
    // well
    cyl(1.1, 1.2, 1.2, 0x7a5a3a, 10, 2); H.colliders.push({ x: 10, z: 2, r: 1.4 });
    // drainage channels (glowing blue lines)
    [[-10, 0, 12], [2, 6, 10], [-4, -14, 14]].forEach(([x, z, len]) => {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x35b6d9, emissive: 0x1e7fa8, emissiveIntensity: 0.7 }));
      ch.position.set(x, 0.06, z); scene.add(ch);
    });
    stall(-6, 4, 0xd94f3d); stall(-9, 4, 0x3d7bd9, 0.2);
    pot(-7, 5); pot(-7.6, 5.3); pot(11, 3);
    tree(16, -12); tree(-18, -10); tree(18, 12); banner(-11, -2, 0xd94f3d); torch(0, -16); torch(3, -16);
    P.items = [[-6, 5.5, 'tablet'], [3, -6.5, 'tablet'], [-2, -5, 'tablet'], [-11, 12.5, 'tablet'], [13, 11, 'tablet']];
    P.gate = [0, -19]; P.seal = [0, -14]; P.portal = [8, -19];
  } else if (level.id === 2) {
    // Nalanda: courtyards, stupas, library, observatory, gardens
    const stone = 0xcbb27f;
    [[-12, -6], [12, -6], [-12, 8], [12, 8]].forEach(([x, z]) => {
      box(5, 3, 5, stone, x, z, 0, 0, 3.2);
      const st = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 4),
        new THREE.MeshStandardMaterial({ color: 0xa5824f, roughness: 0.8 }));
      st.position.set(x, 4.1, z); st.rotation.y = Math.PI / 4; st.castShadow = true; scene.add(st);
    });
    // library hall
    box(7, 3.4, 4, 0xb5894e, 0, 12, 0, 0, 4);
    box(2, 2.4, 0.3, 0x4a2f14, 0, 9.9, 0);
    // observatory platform
    cyl(3, 3.4, 1, 0x9a9a9a, -14, -14); H.colliders.push({ x: -14, z: -14, r: 3.4 });
    cyl(0.15, 0.15, 3, 0x6a4a1a, -14, -14, 1);
    // garden stupas
    [[6, 4], [8, 6], [-7, 2]].forEach(([x, z]) => {
      cyl(0.9, 1.1, 1.4, 0xd9c48f, x, z); H.colliders.push({ x, z, r: 1.2 });
    });
    for (let i = 0; i < 8; i++) tree(-20 + R() * 40, -2 + R() * 16, 0.8 + R() * 0.5);
    stall(4, -2, 0xe8c547); pot(1, 11); banner(0, 8, 0xe8c547); torch(-2, -16); torch(2, -16);
    P.items = [[-14, -10.5, 'scroll'], [0, 10.5, 'scroll'], [7, 5, 'scroll'], [-7, 3.5, 'scroll'], [10, -12, 'scroll']];
    P.gate = [0, -19]; P.seal = [0, -14]; P.portal = [8, -19];
  } else if (level.id === 3) {
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
    stall(8, 6, 0x4aa3df); stall(11, 6, 0xd94f3d, -0.2);
    pot(9, 7); tree(-6, 10); tree(16, -2); banner(4, -6, 0x4aa3df); banner(-4, -6, 0xffd23e);
    torch(2, -17); torch(-2, -17);
    // sculptor stones
    box(1.2, 1.2, 1.2, 0x9a9a9a, -10, -2, 0, 0.4, 1.2);
    P.items = [[8, 7.5, 'piece'], [-15, 11, 'piece'], [-10, -0.5, 'piece'], [14, -8, 'piece'], [2, 10, 'piece']];
    P.gate = [0, -20.5]; P.seal = [0, -5.5]; P.portal = [8, -20.5];
    H.bounds = 24;
  } else if (level.id === 4) {
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
    for (let i = 0; i < 6; i++) tree(-4 + i * 1.8, 12, 0.7);
    stall(0, 6, 0xd97b2e); pot(1, 7); pot(-1, 7);
    banner(-6, 0, 0xd94f3d); banner(6, 0, 0xffd23e);
    torch(-13, -16); torch(13, -16); torch(0, -19);
    P.items = [[-10, 0, 'shard'], [10, 0, 'shard'], [0, 10, 'shard'], [0, -14, 'shard']];
    P.gate = [0, -17]; P.seal = [0, -11]; P.portal = [8, -17];
  } else {
    // Freedom town: station, press, shops, banyan, posters
    box(8, 3.5, 4, 0xc4a06a, -14, -2, 0, 0, 4.5);              // station
    box(6, 3, 5, 0xb0b0b0, 10, -6, 0, 0, 3.8);                 // press office
    box(5, 3, 4, 0xd9c48f, 2, 10, 0, 0, 3.4);                  // meeting hall
    box(4, 2.6, 3.5, 0xc47a4a, -4, -12, 0, 0, 3);              // shops
    // rails
    [0.6, -0.6].forEach(o => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(24, 0.1, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.4 }));
      rail.position.set(-12, 0.05, 4 + o); scene.add(rail);
    });
    // banyan tree (big)
    tree(12, 10, 2.2);
    // posters (glowing boards)
    [[-8, 6], [4, 2], [-2, -6]].forEach(([x, z], i) => {
      box(1.6, 1.1, 0.1, [0xff9933, 0xffffff, 0x138808][i], x, z, 1.1, i * 0.5);
      cyl(0.05, 0.05, 1.2, 0x333333, x, z, 0);
    });
    // press machine
    box(2, 1.4, 1.2, 0x3a3a3a, 10, -3, 0, 0, 1.5);
    stall(-6, 8, 0x4caf6d); pot(-5, 9);
    banner(2, 6, 0xff9933); torch(-12, 2); torch(8, -2);
    P.items = [[-12, 5.5, 'page'], [10, -1.5, 'page'], [12, 8.5, 'page'], [2, 8, 'page'], [-4, -10, 'page']];
    P.gate = [0, -19]; P.seal = [0, -14]; P.portal = [8, -19];
  }

  // ---------- spawn collectibles ----------
  const kind = COLLECT_GEO[level.id] || 'tablet';
  const names = (ARTIFACT_INFO[level.id] || []).map(a => a.name);
  P.items.forEach(([x, z], i) => {
    const mesh = collectMesh(kind);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    glowRing(x, z);
    H.collectibles.push({ i, mesh, pos: new THREE.Vector3(x, 0, z), name: names[i] || level.collectible.name, taken: false });
  });

  // ---------- NPCs ----------
  level.npcs.forEach(def => {
    const { grp } = npcMesh(def.color, def.icon);
    grp.position.set(def.pos[0], 0, def.pos[2]);
    scene.add(grp);
    glowRing(def.pos[0], def.pos[2], 0xffd23e);
    H.colliders.push({ x: def.pos[0], z: def.pos[2], r: 0.8 });
    H.dynamics.push((dt, t) => { grp.position.y = Math.abs(Math.sin(t * 1.8 + def.pos[0])) * 0.08; grp.rotation.y = Math.sin(t * 0.6 + def.pos[2]) * 0.5; });
    H.npcs.push({ def, mesh: grp });
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

  H.spawn = [0, 0, 10];
  return H;
}

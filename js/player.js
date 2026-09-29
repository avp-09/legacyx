// Chibi adventurer (procedural — no external assets).
// Look: red cap, long brown hair, white top, red waist sash,
// olive cargo pants, chunky dark sneakers. Big-head chibi proportions.
// WASD move relative to camera, Space jump, smooth turn, bob animation.
export function createPlayer(THREE, scene, spawn = [0, 0, 8]) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c09a, roughness: 0.6 });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x6b3d22, roughness: 0.75 });
  const capM = new THREE.MeshStandardMaterial({ color: 0xd92632, roughness: 0.55 });
  const topM = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.65 });
  const sashM = new THREE.MeshStandardMaterial({ color: 0xd92632, roughness: 0.6 });
  const pantsM = new THREE.MeshStandardMaterial({ color: 0x7a8a4d, roughness: 0.8 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x2e2e38, roughness: 0.6 });
  const packM = new THREE.MeshStandardMaterial({ color: 0x4a3230, roughness: 0.8 });

  const solid = (mesh, x = 0, y = 0, z = 0, parent = g) => {
    mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
  };

  // ---- legs: olive cargo pants + side pockets + straps ----
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.22, 4, 10);
  const legL = solid(new THREE.Mesh(legGeo, pantsM), -0.14, 0.32, 0);
  const legR = solid(new THREE.Mesh(legGeo, pantsM), 0.14, 0.32, 0);
  [-0.26, 0.26].forEach(x => {
    solid(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.16), pantsM), x, 0.32, 0); // cargo pockets
    solid(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.24), darkM), Math.sign(x) * 0.14, 0.22, 0); // straps
  });
  // ---- chunky sneakers: dark with red laces ----
  [-0.14, 0.14].forEach(x => {
    solid(new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.32), darkM), x, 0.07, 0.04);
    solid(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.14), sashM), x, 0.14, 0.06); // laces
  });
  // ---- torso: white long-sleeve top ----
  const body = solid(new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.28, 6, 14), topM), 0, 0.72, 0);
  // ---- arms: white sleeves + skin hands ----
  const armGeo = new THREE.CapsuleGeometry(0.075, 0.26, 4, 10);
  const armL = solid(new THREE.Mesh(armGeo, topM), -0.33, 0.7, 0);
  const armR = solid(new THREE.Mesh(armGeo, topM), 0.33, 0.7, 0);
  [-0.33, 0.33].forEach(x => solid(new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skin), x, 0.5, 0));
  // ---- red waist sash + hanging strip ----
  const sash = solid(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.055, 8, 18), sashM), 0, 0.55, 0);
  sash.rotation.x = Math.PI / 2;
  solid(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.03), sashM), 0.12, 0.36, 0.24);
  // ---- little backpack ----
  solid(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.16), packM), 0, 0.76, -0.3);

  // ---- big chibi head ----
  const head = new THREE.Group(); head.position.set(0, 1.12, 0); g.add(head);
  const hsolid = (mesh, x = 0, y = 0, z = 0) => solid(mesh, x, y, z, head);
  hsolid(new THREE.Mesh(new THREE.SphereGeometry(0.3, 22, 18), skin));
  // hair: back mass + long back fall + side locks + bangs
  const backHair = hsolid(new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), hairM), 0, 0.05, -0.09);
  backHair.scale.set(1, 1.12, 0.92);
  hsolid(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.13), hairM), 0, -0.28, -0.26);
  hsolid(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.12), hairM), -0.28, -0.12, 0.02);
  hsolid(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.12), hairM), 0.28, -0.12, 0.02);
  [-0.16, 0, 0.16].forEach(x => {
    const bang = hsolid(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hairM), x, 0.2, 0.22);
    bang.scale.set(1, 1.25, 0.6);
  });
  // big anime eyes: white + pupils + highlights (kept for blink anim)
  const eyeL = new THREE.Group(), eyeR = new THREE.Group();
  eyeL.position.set(-0.11, 0.04, 0.25); eyeR.position.set(0.11, 0.04, 0.25);
  head.add(eyeL, eyeR);
  const whiteM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilM = new THREE.MeshBasicMaterial({ color: 0x4a2418 });
  [eyeL, eyeR].forEach(e => {
    solid(new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), whiteM), 0, 0, 0, e).castShadow = false;
    solid(new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), pupilM), 0, -0.008, 0.055, e).castShadow = false;
    solid(new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), whiteM), 0.014, 0.012, 0.085, e).castShadow = false;
  });
  // brows, blush, tiny mouth
  const browM = new THREE.MeshBasicMaterial({ color: 0x5a3018 });
  solid(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.01), browM), -0.11, 0.15, 0.27, head).castShadow = false;
  solid(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.01), browM), 0.11, 0.15, 0.27, head).castShadow = false;
  const blushM = new THREE.MeshBasicMaterial({ color: 0xf09090, transparent: true, opacity: 0.85 });
  solid(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), blushM), -0.19, -0.04, 0.21, head).castShadow = false;
  solid(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), blushM), 0.19, -0.04, 0.21, head).castShadow = false;
  solid(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.01), pupilM), 0, -0.1, 0.285, head).castShadow = false;
  // ---- red cap: dome + front brim + button ----
  const turban = hsolid(new THREE.Mesh(new THREE.SphereGeometry(0.315, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), capM), 0, 0.12, -0.02);
  solid(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.045, 0.24), capM), 0, 0.2, 0.36, head);
  hsolid(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), capM), 0, 0.42, -0.02);

  g.position.set(spawn[0], spawn[1], spawn[2]);
  scene.add(g);

  // shadow blob (cheap, always looks grounded)
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
  blob.rotation.x = -Math.PI / 2; scene.add(blob);

  const state = {
    group: g, vel: new THREE.Vector3(), vy: 0, grounded: true,
    heading: Math.PI, speedWalk: 5.2, speedRun: 8.2, moving: false, running: false,
    stepAcc: 0, onStep: null, airTime: 0
  };

  const tmp = new THREE.Vector3();
  function collides(nx, nz, colliders) {
    for (const c of colliders) {
      const dx = nx - c.x, dz = nz - c.z;
      if (dx * dx + dz * dz < (c.r + 0.45) * (c.r + 0.45)) return true;
    }
    return false;
  }

  state.update = (dt, input, camYaw, colliders, bounds) => {
    let mx = 0, mz = 0;
    if (input.f) mz -= 1; if (input.b) mz += 1;
    if (input.l) mx -= 1; if (input.r) mx += 1;
    const has = (mx !== 0 || mz !== 0);
    state.moving = has;
    state.running = has && (input.run || Math.hypot(mx, mz) > 1.2);
    const speed = input.run ? state.speedRun : state.speedWalk;
    if (has) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      // camera-relative
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const wx = mx * cos - mz * sin, wz = -mx * sin - mz * cos;
      const target = Math.atan2(wx, wz);
      let d = target - state.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      state.heading += d * Math.min(1, dt * 12);
      const nx = g.position.x + wx * speed * dt;
      const nz = g.position.z + wz * speed * dt;
      const half = bounds;
      const cx = Math.max(-half, Math.min(half, nx));
      const cz = Math.max(-half, Math.min(half, nz));
      if (!collides(cx, cz, colliders)) { g.position.x = cx; g.position.z = cz; }
      else if (!collides(cx, g.position.z, colliders)) g.position.x = cx;
      else if (!collides(g.position.x, cz, colliders)) g.position.z = cz;
      // footsteps
      state.stepAcc += dt * (state.running ? 11 : 8);
      if (state.stepAcc > 2.4) { state.stepAcc = 0; state.onStep && state.onStep(state.running); }
    }
    // gravity / jump
    if (input.jump && state.grounded) {
      state.vy = 7.2; state.grounded = false;
      state.onJump && state.onJump();
      input.jump = false;
    }
    if (!state.grounded) {
      state.vy -= 20 * dt;
      g.position.y += state.vy * dt;
      if (g.position.y <= 0) { g.position.y = 0; g.position.y = 0; state.grounded = true; state.vy = 0; }
    }
    g.rotation.y = state.heading;
    // run bob + limb swing + blink
    const t = performance.now() / 1000;
    const amp = has ? (state.running ? 0.9 : 0.6) : 0.08;
    const f = has ? (state.running ? 13 : 9) : 2;
    body.position.y = 0.72 + Math.abs(Math.sin(t * f)) * 0.05 * amp;
    head.position.y = 1.12 + Math.abs(Math.sin(t * f)) * 0.045 * amp;
    turban.position.y = 0.12 + Math.abs(Math.sin(t * f)) * 0.045 * amp;
    armL.rotation.x = Math.sin(t * f) * amp * 0.9;
    armR.rotation.x = -Math.sin(t * f) * amp * 0.9;
    legL.rotation.x = -Math.sin(t * f) * amp * 0.9;
    legR.rotation.x = Math.sin(t * f) * amp * 0.9;
    if (!state.grounded) { armL.rotation.x = -0.7; armR.rotation.x = -0.7; }
    const blink = (t % 4.2) < 0.12 ? 0.12 : 1; // cute blink every ~4s
    eyeL.scale.y = blink; eyeR.scale.y = blink;
    blob.position.set(g.position.x, 0.02, g.position.z);
    tmp.copy(g.position);
    return tmp;
  };
  return state;
}

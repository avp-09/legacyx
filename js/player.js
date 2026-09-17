// Stylized teen adventurer (procedural — no external assets).
// WASD move relative to camera, Space jump, smooth turn, bob animation.
export function createPlayer(THREE, scene, spawn = [0, 0, 8]) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xb5773f, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xff7a3c, roughness: 0.6 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2e4a7a, roughness: 0.7 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xffd23e, roughness: 0.5, emissive: 0x553300, emissiveIntensity: 0.25 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 6, 14), shirt);
  body.position.y = 0.95; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), skin);
  head.position.y = 1.72; head.castShadow = true; g.add(head);
  // turban / cap
  const turban = new THREE.Mesh(new THREE.SphereGeometry(0.30, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), accent);
  turban.position.y = 1.80; g.add(turban);
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x35e0ff, emissive: 0x1899bb, emissiveIntensity: 1.2 }));
  jewel.position.set(0, 1.86, 0.26); g.add(jewel);
  // eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  [-0.1, 0.1].forEach(x => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMat);
    e.position.set(x, 1.74, 0.25); g.add(e);
  });
  // limbs
  const armGeo = new THREE.CapsuleGeometry(0.09, 0.5, 4, 8);
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.5, 4, 8);
  const armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.44, 1.0, 0); armL.castShadow = true; g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.44, 1.0, 0); armR.castShadow = true; g.add(armR);
  const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.16, 0.42, 0); legL.castShadow = true; g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.16, 0.42, 0); legR.castShadow = true; g.add(legR);
  // satchel glow
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x7a4a21, roughness: 0.8 }));
  pack.position.set(0, 1.0, -0.36); g.add(pack);

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
    // run bob + limb swing
    const t = performance.now() / 1000;
    const amp = has ? (state.running ? 0.9 : 0.6) : 0.08;
    const f = has ? (state.running ? 13 : 9) : 2;
    body.position.y = 0.95 + Math.abs(Math.sin(t * f)) * 0.06 * amp;
    head.position.y = 1.72 + Math.abs(Math.sin(t * f)) * 0.05 * amp;
    turban.position.y = 1.80 + Math.abs(Math.sin(t * f)) * 0.05 * amp;
    armL.rotation.x = Math.sin(t * f) * amp * 0.9;
    armR.rotation.x = -Math.sin(t * f) * amp * 0.9;
    legL.rotation.x = -Math.sin(t * f) * amp * 0.9;
    legR.rotation.x = Math.sin(t * f) * amp * 0.9;
    if (!state.grounded) { armL.rotation.x = -0.7; armR.rotation.x = -0.7; }
    blob.position.set(g.position.x, 0.02, g.position.z);
    tmp.copy(g.position);
    return tmp;
  };
  return state;
}

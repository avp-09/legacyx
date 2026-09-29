// ============================================================
// SLICE 3 — AssetManager: GLB/GLTF-ready loading + hero config.
// No external models are bundled yet. Everything here degrades
// gracefully: if a hero GLB is missing/unconfigured, callers keep
// the existing procedural fallback. Zero cost until first use
// (GLTFLoader is dynamically imported, never bundled upfront).
// ============================================================

// Set this to enable remote hero models, e.g. 'assets/heroes/'.
// Files are expected at `${HERO_BASE_URL}<id>.glb`. Leave null to
// stay fully procedural/offline (default).
export const HERO_BASE_URL = null;

// Hero landmark slots, one primary per era (+ final chamber).
// pos: footprint center · size: approx. bounding size the procedural
// version occupies (used to scale/frame a future replacement).
// fallback: which procedural builder currently owns the spot.
// url: optional explicit GLB path for this spot (overrides HERO_BASE_URL
// naming); spots without url keep the procedural fallback.
export const HERO_SPOTS = {
  1: [
    { id: 'indus-great-bath', pos: [-2, 0, -8], size: [9, 2.5, 9], fallback: 'Great Bath (world.js L1)', url: 'assets/models/indus/greatbath.glb' }
  ],
  2: [
    { id: 'chola-temple', pos: [0, 0, -14], size: [8, 13, 8], fallback: 'Sanctum + vimana + finial (world.js L2)', url: 'assets/models/chola/chola_temple.glb' }
  ],
  3: [
    { id: 'fort-outer-gate', pos: [0, 0, 26], size: [12, 9, 4], fallback: 'Twin-tower outer gate (world.js L3)' }
  ],
  5: [
    { id: 'final-console', pos: [0, 0, -6], size: [2, 2, 1], fallback: 'Golden console (game.js loadFinalChamber)' }
  ]
};

let _loaderPromise = null;
async function gltfLoader() {
  if (!_loaderPromise) {
    _loaderPromise = import('three/addons/loaders/GLTFLoader.js').then(m => new m.GLTFLoader());
  }
  return _loaderPromise;
}

export const AssetManager = {
  cache: new Map(),

  /** Load (and cache) a GLB by hero id. Returns null when unavailable. */
  async loadHero(id, urlOverride = null) {
    const url = urlOverride || (HERO_BASE_URL ? `${HERO_BASE_URL}${id}.glb` : null);
    if (!url) return null;
    if (this.cache.has(url)) return this.cache.get(url);
    try {
      const loader = await gltfLoader();
      const gltf = await loader.loadAsync(url);
      gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.cache.set(url, gltf);
      return gltf;
    } catch (err) {
      console.warn(`[assets] hero "${id}" unavailable, using procedural fallback`, err);
      return null;
    }
  },

  /** Clone a cached hero for placement (shares geometries/materials). */
  cloneHero(id, urlOverride = null) {
    const url = urlOverride || (HERO_BASE_URL ? `${HERO_BASE_URL}${id}.glb` : null);
    const g = url ? this.cache.get(url) : this.cache.get(id);
    return g ? g.scene.clone(true) : null;
  },

  /** Drop a hero from the cache and free GPU resources. */
  disposeHero(id) {
    const g = this.cache.get(id);
    if (!g) return;
    g.scene.traverse(o => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m && !m.__shared) m.dispose?.(); });
      }
    });
    this.cache.delete(id);
  },

  /**
   * Resolve a hero spot to a ready-to-place Object3D, or null to keep
   * the procedural fallback. Usage at a build site:
   *   const hero = await AssetManager.resolveHero('indus-great-bath');
   *   if (hero) { hero.position.set(...); scene.add(hero); }
   *   else { /* existing procedural builder *\/ }
   */
  async resolveHero(id, urlOverride = null) {
    const gltf = await this.loadHero(id, urlOverride);
    return gltf ? this.cloneHero(id, urlOverride) : null;
  }
};

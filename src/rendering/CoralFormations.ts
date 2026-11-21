import * as THREE from 'three';

/**
 * Lays out the reef patches. The corals and sponges on them are scanned models placed by
 * ReefProps; the procedural colonies that used to fill the patches are retired.
 */
export class CoralFormations {
  /** Patch centers for other systems (anemones / décor) to nestle against. */
  static lastReefPatches: Array<{ x: number; z: number; radius: number }> = [];

  static createCoralReef(scene: THREE.Scene): THREE.Group {
    const coralGroup = new THREE.Group();
    coralGroup.name = 'coralReef';

    // 5 dense reef patches instead of uniform scatter
    const patchCount = 5;
    const patches: Array<{ x: number; z: number; radius: number }> = [];
    for (let p = 0; p < patchCount; p++) {
      patches.push({
        x: Math.sin(p * 2.3) * 42 + (Math.random() - 0.5) * 18,
        z: Math.cos(p * 1.7) * 42 + (Math.random() - 0.5) * 18,
        radius: 10 + Math.random() * 8,
      });
    }
    this.lastReefPatches = patches;

    scene.add(coralGroup);
    return coralGroup;
  }
}

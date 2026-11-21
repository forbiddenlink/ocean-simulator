import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ExtraOceanLife, FLOOR_CLEARANCE } from '../rendering/ExtraOceanLife';

/**
 * Structural smoke test for the ambient ocean-life layer. This verifies each species
 * actually spawns with the expected count and is attached to the scene — code-verifiable
 * confidence that the procedural creatures construct without error. It does NOT verify how
 * they look; that still needs a visual pass.
 */
describe('ExtraOceanLife', () => {
  const scene = new THREE.Scene();
  const life = new ExtraOceanLife(scene, -30);

  const countKind = (kind: string) =>
    life.group.children.filter((c) => c.userData.kind === kind).length;

  it('attaches its group to the scene', () => {
    expect(scene.children).toContain(life.group);
    expect(life.group.name).toBe('extraOceanLife');
  });

  it('spawns each species with the expected count', () => {
    expect(countKind('octopus')).toBe(6);
    expect(countKind('seahorse')).toBe(16);
    expect(countKind('angler')).toBe(6);
    expect(countKind('squid')).toBe(6);
    expect(countKind('pufferfish')).toBe(9);
    expect(countKind('seasnake')).toBe(6);
    expect(countKind('nautilus')).toBe(5);
    expect(countKind('giantclam')).toBe(14);
    expect(countKind('seacucumber')).toBe(14);
    expect(countKind('cuttlefish')).toBe(5);
    expect(countKind('combjelly')).toBe(10);
    expect(countKind('hermitcrab')).toBe(12);
  });

  it('gives every anglerfish a lure reference and a pulse phase', () => {
    const anglers = life.group.children.filter((c) => c.userData.kind === 'angler');
    expect(anglers.length).toBeGreaterThan(0);
    for (const a of anglers) {
      expect(a.userData.lure).toBeInstanceOf(THREE.Mesh);
      expect(typeof a.userData.phase).toBe('number');
    }
  });

  it('animates without throwing (lure pulse + seahorse bob)', () => {
    expect(() => life.update(0.016, 1.5)).not.toThrow();
  });

  it('lights opaque bodies with the scene lights instead of a fixed fake light', () => {
    // Only the comb-jelly glow rows may use a custom shader: they are emissive light, not skin.
    const unlit: string[] = [];
    life.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if ((m as THREE.ShaderMaterial).isShaderMaterial && !m.transparent) {
          unlit.push(String(o.parent?.userData.kind ?? o.userData.kind));
        }
      }
    });
    expect(unlit).toEqual([]);
  });

  it('drives the body sway from elapsed time', () => {
    life.update(0.016, 7.25);
    let swaying = 0;
    life.group.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      const time = mat?.userData?.swayUniforms?.time;
      if (time) {
        expect(time.value).toBe(7.25);
        swaying++;
      }
    });
    expect(swaying).toBeGreaterThan(0);
  });

  it('keeps vertex colours through the draw-call merge on banded and ringed bodies', () => {
    for (const kind of ['seasnake', 'seahorse']) {
      const creature = life.group.children.find((c) => c.userData.kind === kind)!;
      const coloured = creature.children.filter(
        (m) => ((m as THREE.Mesh).material as THREE.Material).vertexColors
      ) as THREE.Mesh[];
      expect(coloured.length).toBeGreaterThan(0);
      for (const mesh of coloured) expect(mesh.geometry.getAttribute('color')).toBeDefined();
    }
  });

  it('builds every creature from real mesh geometry', () => {
    let meshes = 0;
    life.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++;
    });
    expect(meshes).toBeGreaterThan(100);
  });
});

describe('ExtraOceanLife.applyModels', () => {
  /** A stand-in scan: one box, unit length along X, centred like a loaded template. */
  const template = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.4), new THREE.MeshStandardMaterial()));
    return g;
  };
  const localBox = (creature: THREE.Object3D, filter: (o: THREE.Object3D) => boolean) => {
    creature.updateMatrixWorld(true);
    const inv = creature.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    creature.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !filter(o)) return;
      mesh.geometry.computeBoundingBox();
      box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(inv.clone().multiply(mesh.matrixWorld)));
    });
    return box;
  };

  it('swaps each loaded kind for its scan, fitted to the procedural body', () => {
    const life = new ExtraOceanLife(new THREE.Scene(), -30);
    const crab = life.group.children.find((c) => c.userData.kind === 'hermitcrab')!;
    const before = localBox(crab, () => true);
    const octopusCount = life.group.children.filter((c) => c.userData.kind === 'octopus').length;

    life.applyModels(new Map([['hermitcrab', template()], ['octopus', template()]]));

    const scan = crab.getObjectByName('hermitcrabScan');
    expect(scan).toBeDefined();
    // Only the scan is left: the procedural meshes are gone.
    let meshes = 0;
    crab.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBe(1);
    // Same footprint: longest side matches.
    const after = localBox(crab, () => true);
    const size = (b: THREE.Box3) => b.getSize(new THREE.Vector3());
    const longest = (v: THREE.Vector3) => Math.max(v.x, v.y, v.z);
    expect(longest(size(after))).toBeCloseTo(longest(size(before)), 5);
    // A floor dweller rests on the sand surface, which lies FLOOR_CLEARANCE below the
    // creature's origin, not on the procedural body's underside (sunk into the sand).
    crab.updateMatrixWorld(true);
    const world = new THREE.Box3().setFromObject(scan!);
    expect(world.min.y).toBeCloseTo(crab.position.y - FLOOR_CLEARANCE, 5);
    expect(life.group.children.filter((c) => c.userData.kind === 'octopus').length).toBe(octopusCount);
  });

  it('leaves kinds without a model procedural', () => {
    const life = new ExtraOceanLife(new THREE.Scene(), -30);
    life.applyModels(new Map([['octopus', template()]]));
    const squid = life.group.children.find((c) => c.userData.kind === 'squid')!;
    expect(squid.getObjectByName('squidScan')).toBeUndefined();
    let meshes = 0;
    squid.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBeGreaterThan(0);
  });

  it('adds cowfish only when their scan loads', () => {
    const life = new ExtraOceanLife(new THREE.Scene(), -30);
    const cowfish = () => life.group.children.filter((c) => c.userData.kind === 'cowfish');
    expect(cowfish()).toHaveLength(0);
    life.applyModels(new Map([['cowfish', template()]]));
    expect(cowfish()).toHaveLength(8);
    for (const c of cowfish()) expect(c.position.y).toBeGreaterThan(-30);
    expect(() => life.update(0.016, 3)).not.toThrow();
  });
});

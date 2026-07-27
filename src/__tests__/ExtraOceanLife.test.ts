import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ExtraOceanLife } from '../rendering/ExtraOceanLife';

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
    expect(countKind('seahorse')).toBe(14);
    expect(countKind('angler')).toBe(6);
    expect(countKind('squid')).toBe(6);
    expect(countKind('pufferfish')).toBe(9);
    expect(countKind('seasnake')).toBe(6);
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

  it('builds every creature from real mesh geometry', () => {
    let meshes = 0;
    life.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++;
    });
    expect(meshes).toBeGreaterThan(100);
  });
});

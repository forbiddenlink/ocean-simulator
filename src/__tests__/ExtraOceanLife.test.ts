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

  it('builds every creature from real mesh geometry', () => {
    let meshes = 0;
    life.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++;
    });
    expect(meshes).toBeGreaterThan(100);
  });
});

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { mergeStaticSubtree, normalizeGeometry } from '../rendering/SceneOptimizer';

describe('vertex colours survive merging', () => {
  it('keeps the colour attribute when asked, and fills white where a part has none', () => {
    const coloured = new THREE.BoxGeometry();
    coloured.setAttribute('color', new THREE.BufferAttribute(new Float32Array(coloured.attributes.position.count * 3).fill(0.25), 3));
    expect(normalizeGeometry(coloured, true)?.getAttribute('color')?.getX(0)).toBe(0.25);
    expect(normalizeGeometry(new THREE.BoxGeometry(), true)?.getAttribute('color')?.getX(0)).toBe(1);
    expect(normalizeGeometry(coloured)?.getAttribute('color')).toBeUndefined();
  });

  it('merges a vertex-coloured part with an uncoloured one on the same material', () => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true });
    const a = new THREE.BoxGeometry();
    a.setAttribute('color', new THREE.BufferAttribute(new Float32Array(a.attributes.position.count * 3).fill(0.5), 3));
    const root = new THREE.Group();
    root.add(new THREE.Mesh(a, mat), new THREE.Mesh(new THREE.BoxGeometry(), mat));
    mergeStaticSubtree(root);
    const merged = root.children[0] as THREE.Mesh;
    expect(root.children.length).toBe(1);
    expect(merged.geometry.getAttribute('color')).toBeDefined();
  });
});

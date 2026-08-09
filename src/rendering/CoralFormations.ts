import * as THREE from 'three';
import { sampleSandHeight } from './RealisticOceanFloor';

/**
 * Coral reef formations — clustered patches with branching staghorn, brain gyri, tables, fans.
 */
export class CoralFormations {
  /** Patch centers for other systems (anemones / décor) to nestle against. */
  static lastReefPatches: Array<{ x: number; z: number; radius: number }> = [];

  static createCoralReef(scene: THREE.Scene, floorDepth: number, count: number = 80): THREE.Group {
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

    for (let i = 0; i < count; i++) {
      const patch = patches[i % patchCount];
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.pow(Math.random(), 0.65) * patch.radius;
      const x = patch.x + Math.cos(angle) * dist;
      const z = patch.z + Math.sin(angle) * dist;
      const y = floorDepth + sampleSandHeight(x, z);

      const type = Math.random();
      let coral: THREE.Object3D;
      if (type < 0.28) coral = this.createBrainCoral(x, y, z);
      else if (type < 0.55) coral = this.createStaghornCoral(x, y, z);
      else if (type < 0.78) coral = this.createTableCoral(x, y, z);
      else coral = this.createFanCoral(x, y, z);

      coralGroup.add(coral);
    }

    // A few outlier colonies for visual variety beyond the patches
    for (let i = 0; i < Math.floor(count * 0.12); i++) {
      const x = (Math.random() - 0.5) * 140;
      const z = (Math.random() - 0.5) * 140;
      const y = floorDepth + sampleSandHeight(x, z);
      coralGroup.add(this.createBrainCoral(x, y, z));
    }

    scene.add(coralGroup);
    return coralGroup;
  }

  private static coralMat(color: number, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.78,
      metalness: 0.05,
      clearcoat: 0.28,
      clearcoatRoughness: 0.4,
      emissive: new THREE.Color(color).multiplyScalar(0.1),
      emissiveIntensity: 0.12,
      sheen: 0.2,
      sheenColor: new THREE.Color(color),
      ...opts,
    });
  }

  private static createBrainCoral(x: number, floorY: number, z: number): THREE.Mesh {
    const size = 0.7 + Math.random() * 1.35;
    const geometry = new THREE.SphereGeometry(size, 40, 36);
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      let px = positions.getX(i);
      let py = positions.getY(i);
      let pz = positions.getZ(i);
      const len = Math.hypot(px, py, pz) || 1;
      // Maze gyri — domain-warped ridges
      const u = px * 6.5 + Math.sin(pz * 4.2) * 1.2;
      const v = pz * 6.5 + Math.cos(px * 3.8) * 1.2;
      const ridge = Math.abs(Math.sin(u) * Math.cos(v));
      const groove = Math.pow(1 - ridge, 2.2);
      const n = 1 + ridge * 0.14 - groove * 0.08;
      // Flatten bottom slightly so it sits on sand
      const flatten = py < -size * 0.15 ? 0.55 : 1;
      positions.setXYZ(i, (px / len) * size * n, (py / len) * size * n * flatten, (pz / len) * size * n);
    }
    geometry.computeVertexNormals();

    const colors = [0xff6699, 0xff9955, 0xffcc44, 0x66ddbb, 0xe87a9a];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mesh = new THREE.Mesh(geometry, this.coralMat(color, { roughness: 0.84 }));
    mesh.position.set(x, floorY + size * 0.55, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private static createStaghornCoral(x: number, floorY: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const colors = [0xd4a373, 0xf0e68c, 0xdda15e, 0xbc6c25, 0xc9a66b];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = this.coralMat(color);

    const addBranch = (
      parent: THREE.Object3D,
      length: number,
      radius: number,
      rot: THREE.Euler,
      depth: number
    ) => {
      const geo = new THREE.CylinderGeometry(radius * 0.55, radius, length, 7);
      const branch = new THREE.Mesh(geo, mat);
      branch.geometry.translate(0, length / 2, 0);
      branch.rotation.copy(rot);
      branch.castShadow = true;
      branch.receiveShadow = true;
      parent.add(branch);

      if (depth > 0 && length > 0.35) {
        const forks = 1 + Math.floor(Math.random() * 2);
        for (let f = 0; f < forks; f++) {
          const tip = new THREE.Group();
          tip.position.y = length * (0.7 + Math.random() * 0.25);
          branch.add(tip);
          addBranch(
            tip,
            length * (0.45 + Math.random() * 0.3),
            radius * 0.65,
            new THREE.Euler(
              (Math.random() - 0.5) * 0.9,
              Math.random() * Math.PI * 2,
              (Math.random() - 0.5) * 0.7
            ),
            depth - 1
          );
        }
      }
    };

    const trunkCount = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < trunkCount; i++) {
      const angle = (i / trunkCount) * Math.PI * 2 + Math.random() * 0.3;
      addBranch(
        group,
        0.9 + Math.random() * 1.3,
        0.1 + Math.random() * 0.06,
        new THREE.Euler(0.35 + Math.random() * 0.45, angle, 0),
        2
      );
    }

    group.position.set(x, floorY + 0.05, z);
    return group;
  }

  private static createTableCoral(x: number, floorY: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const colors = [0x8fbc8f, 0x6b8e23, 0x9acd32, 0x7a9e45];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = this.coralMat(color);
    const plateCount = 2 + Math.floor(Math.random() * 3);

    // Stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.22, 0.7 + plateCount * 0.35, 10),
      mat
    );
    stem.position.y = 0.4;
    stem.castShadow = true;
    group.add(stem);

    for (let i = 0; i < plateCount; i++) {
      const width = 1.2 + Math.random() * 1.1 + i * 0.15;
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(width, width * 0.72, 0.12 + Math.random() * 0.06, 20),
        mat
      );
      plate.position.y = 0.75 + i * 0.55;
      // Slight scalloped edge via non-uniform scale
      plate.scale.set(1, 1, 0.92 + Math.random() * 0.12);
      plate.castShadow = true;
      plate.receiveShadow = true;
      group.add(plate);
    }

    group.position.set(x, floorY, z);
    return group;
  }

  private static createFanCoral(x: number, floorY: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const width = 1.4 + Math.random() * 1.2;
    const height = 1.8 + Math.random() * 1.2;

    const geometry = new THREE.PlaneGeometry(width, height, 20, 28);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i);
      const py = positions.getY(i);
      const fanFactor = (py + height / 2) / height;
      positions.setX(i, px * (0.25 + fanFactor * 0.75));
      // Lattice holes feel via Z ripples + mid cutouts approximated by thinner mid
      const ripple = Math.sin(px * 7) * Math.cos(py * 5) * 0.12 * fanFactor;
      const vein = Math.sin(py * 9 + px * 2) * 0.04;
      positions.setZ(i, ripple + vein);
    }
    geometry.computeVertexNormals();

    const colors = [0xaa3377, 0xcc5599, 0xaa7799, 0x8844aa];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = this.coralMat(color, {
      side: THREE.DoubleSide,
      transmission: 0.18,
      thickness: 0.12,
      opacity: 0.92,
      transparent: true,
      roughness: 0.65,
    });

    const fan = new THREE.Mesh(geometry, mat);
    fan.position.y = height / 2;
    fan.castShadow = true;
    group.add(fan);

    // Second offset plane for thickness / density
    const fan2 = fan.clone();
    fan2.position.z = 0.06;
    fan2.rotation.y = 0.08;
    group.add(fan2);

    // Short holdfast stump
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.14, 0.35, 8),
      this.coralMat(color)
    );
    base.position.y = 0.15;
    group.add(base);

    group.position.set(x, floorY, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    return group;
  }
}

import * as THREE from 'three';
import { sampleSandHeight } from './RealisticOceanFloor';
import { CoralFormations } from './CoralFormations';

/**
 * Sea anemones — oral disc + tentacles with clamped sway (no unbounded rotation drift).
 */
export class SeaAnemones {
  private anemones: THREE.Group[] = [];
  private scene: THREE.Scene;
  private time = 0;

  constructor(scene: THREE.Scene, floorDepth: number, count: number = 40) {
    this.scene = scene;
    this.createAnemones(floorDepth, count);
  }

  private createAnemones(floorDepth: number, count: number): void {
    const patches = CoralFormations.lastReefPatches.length
      ? CoralFormations.lastReefPatches
      : [{ x: 0, z: 0, radius: 40 }];

    for (let i = 0; i < count; i++) {
      const patch = patches[i % patches.length];
      const a = Math.random() * Math.PI * 2;
      const d = Math.pow(Math.random(), 0.55) * (patch.radius + 4);
      const x = patch.x + Math.cos(a) * d + (Math.random() - 0.5) * 6;
      const z = patch.z + Math.sin(a) * d + (Math.random() - 0.5) * 6;
      const y = floorDepth + sampleSandHeight(x, z);

      const anemone = this.createAnemone(x, y, z);
      this.anemones.push(anemone);
      this.scene.add(anemone);
    }
  }

  private createAnemone(x: number, floorY: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const tentacleCount = 14 + Math.floor(Math.random() * 12);
    const height = 0.55 + Math.random() * 0.85;

    const colors = [0xff6b9d, 0xff8c42, 0xffbe0b, 0xfb5607, 0x8338ec, 0x3a86ff, 0xff5e78];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, height * 0.38, 14),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color).multiplyScalar(0.55),
        roughness: 0.7,
        metalness: 0.05,
        clearcoat: 0.22,
        clearcoatRoughness: 0.5,
        emissive: new THREE.Color(color).multiplyScalar(0.08),
        emissiveIntensity: 0.15,
      })
    );
    base.position.y = height * 0.19;
    group.add(base);

    // Oral disc
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.18, 0.06, 16),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color).multiplyScalar(0.75),
        roughness: 0.55,
        clearcoat: 0.35,
        emissive: new THREE.Color(color).multiplyScalar(0.15),
        emissiveIntensity: 0.2,
      })
    );
    disc.position.y = height * 0.4;
    group.add(disc);

    // Short crown tentacles on disc
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const short = this.createTentacle(height * 0.45, color, 0.014);
      short.position.set(Math.cos(angle) * 0.12, height * 0.42, Math.sin(angle) * 0.12);
      short.rotation.set(0.55, angle, 0);
      short.userData.baseRotX = short.rotation.x;
      short.userData.baseRotZ = short.rotation.z;
      group.add(short);
    }

    for (let i = 0; i < tentacleCount; i++) {
      const angle = (i / tentacleCount) * Math.PI * 2;
      const tentacle = this.createTentacle(height, color, 0.022);
      tentacle.position.y = height * 0.4;
      tentacle.rotation.set(Math.PI / 3.2 + Math.random() * 0.25, angle, 0);
      tentacle.userData.baseRotX = tentacle.rotation.x;
      tentacle.userData.baseRotZ = tentacle.rotation.z;
      tentacle.userData.tentacleIndex = i;
      group.add(tentacle);
    }

    group.position.set(x, floorY, z);
    group.userData.phase = Math.random() * Math.PI * 2;
    return group;
  }

  private createTentacle(_baseHeight: number, color: number, radius: number): THREE.Mesh {
    const length = 0.35 + Math.random() * 0.45;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3((Math.random() - 0.5) * 0.18, length * 0.5, (Math.random() - 0.5) * 0.18),
      new THREE.Vector3((Math.random() - 0.5) * 0.28, length, (Math.random() - 0.5) * 0.28)
    );

    const tubeGeometry = new THREE.TubeGeometry(curve, 12, radius, 6, false);
    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.42,
      metalness: 0.0,
      transmission: 0.38,
      thickness: 0.18,
      ior: 1.33,
      transparent: true,
      opacity: 0.9,
      emissive: new THREE.Color(color).multiplyScalar(0.25),
      emissiveIntensity: 0.22,
      clearcoat: 0.45,
      clearcoatRoughness: 0.2,
      sheen: 0.45,
      sheenColor: new THREE.Color(color),
    });

    return new THREE.Mesh(tubeGeometry, material);
  }

  update(deltaTime: number): void {
    this.time += deltaTime;

    for (const anemone of this.anemones) {
      const phase = anemone.userData.phase as number;
      anemone.rotation.x = Math.sin(this.time * 0.8 + phase) * 0.1;
      anemone.rotation.z = Math.cos(this.time * 0.6 + phase * 1.3) * 0.1;

      anemone.children.forEach((child) => {
        if (child.userData.baseRotX === undefined) return;
        const idx = (child.userData.tentacleIndex as number) ?? 0;
        const tentaclePhase = phase + idx * 0.3;
        const amp = 0.12;
        child.rotation.x = child.userData.baseRotX + Math.sin(this.time * 1.15 + tentaclePhase) * amp;
        child.rotation.z = (child.userData.baseRotZ ?? 0) + Math.cos(this.time * 0.9 + tentaclePhase) * amp * 0.5;
      });
    }
  }

  dispose(): void {
    for (const a of this.anemones) {
      a.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else if (m) m.dispose();
        }
      });
      this.scene.remove(a);
    }
    this.anemones = [];
  }
}

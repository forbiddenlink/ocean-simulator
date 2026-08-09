import * as THREE from 'three';
import { sampleSandHeight } from './RealisticOceanFloor';
import { CoralFormations } from './CoralFormations';

/**
 * Kelp forest with GPU vertex-shader sway (no per-frame CPU normal rebuilds).
 */
export class KelpForest {
  private kelp: THREE.Group[] = [];
  private scene: THREE.Scene;
  private materials: THREE.MeshPhysicalMaterial[] = [];
  private time = 0;

  constructor(scene: THREE.Scene, floorY: number, count: number = 70) {
    this.scene = scene;
    this.createForest(floorY, count);
  }

  private createForest(floorY: number, count: number): void {
    // Primary dense forest near origin + secondary patches near coral reefs
    const patches: Array<{ x: number; z: number; r: number }> = [
      { x: 0, z: 0, r: 32 },
      { x: -28, z: 22, r: 16 },
      { x: 30, z: -18, r: 14 },
    ];
    for (const reef of CoralFormations.lastReefPatches) {
      patches.push({ x: reef.x + 6, z: reef.z - 4, r: reef.radius * 0.7 });
    }

    for (let i = 0; i < count; i++) {
      const patch = patches[i % patches.length];
      const a = Math.random() * Math.PI * 2;
      const d = Math.pow(Math.random(), 0.7) * patch.r;
      const x = patch.x + Math.cos(a) * d;
      const z = patch.z + Math.sin(a) * d;
      const height = 5.5 + Math.random() * 7;
      const y = floorY + sampleSandHeight(x, z);

      const plant = this.createKelpPlant(x, y, z, height);
      this.kelp.push(plant);
      this.scene.add(plant);
    }
  }

  private createKelpPlant(x: number, y: number, z: number, height: number): THREE.Group {
    const group = new THREE.Group();
    const frondCount = 5 + Math.floor(Math.random() * 5);
    const phase = Math.random() * Math.PI * 2;
    const swaySpeed = 0.35 + Math.random() * 0.35;
    const swayAmount = 0.45 + Math.random() * 0.4;

    // Holdfast / root bulb
    const holdfast = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 + Math.random() * 0.12, 10, 8),
      new THREE.MeshPhysicalMaterial({
        color: 0x4a3a28,
        roughness: 0.9,
        metalness: 0.0,
      })
    );
    holdfast.scale.set(1.2, 0.55, 1.2);
    holdfast.position.y = 0.08;
    group.add(holdfast);

    for (let i = 0; i < frondCount; i++) {
      const frond = this.createKelpFrond(height, i / frondCount, phase + i * 0.4, swaySpeed, swayAmount);
      frond.rotation.y = (i / frondCount) * Math.PI * 2;
      group.add(frond);

      // Occasional pneumatocyst (float bladder) mid-frond
      if (Math.random() < 0.35) {
        const bladder = new THREE.Mesh(
          new THREE.SphereGeometry(0.08 + Math.random() * 0.05, 8, 6),
          new THREE.MeshPhysicalMaterial({
            color: 0x6a8a4a,
            roughness: 0.4,
            transmission: 0.2,
            thickness: 0.15,
            transparent: true,
            opacity: 0.85,
          })
        );
        bladder.position.set(
          Math.sin(i) * 0.15,
          height * (0.35 + Math.random() * 0.4),
          Math.cos(i) * 0.15
        );
        group.add(bladder);
      }
    }

    group.position.set(x, y, z);
    group.userData.phase = phase;
    return group;
  }

  private createKelpFrond(
    height: number,
    offset: number,
    phase: number,
    swaySpeed: number,
    swayAmount: number
  ): THREE.Group {
    const frondGroup = new THREE.Group();
    const widthBase = 0.14 + Math.random() * 0.12;
    const divisions = 28;

    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const waviness = Math.sin(t * Math.PI * 3 + offset * Math.PI * 2) * 0.28;
      points.push(new THREE.Vector3(waviness, t * height, 0));
    }
    const curve = new THREE.CatmullRomCurve3(points);

    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= divisions; i++) {
      const t = i / divisions;
      const point = curve.getPoint(t);
      const width = widthBase * (1 - t * 0.55);
      vertices.push(point.x - width / 2, point.y, point.z, point.x + width / 2, point.y, point.z);
      normals.push(0, 0, 1, 0, 0, 1);
      uvs.push(0, t, 1, t);
      if (i < divisions) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const kelpColors = [0x5a8751, 0x6f8171, 0x7d8e6e, 0x9b8e76, 0x7daa5a, 0x8dba6a];
    const color = kelpColors[Math.floor(Math.random() * kelpColors.length)];
    const material = new THREE.MeshPhysicalMaterial({
      color,
      side: THREE.DoubleSide,
      roughness: 0.52,
      metalness: 0.0,
      transparent: true,
      opacity: 0.84,
      transmission: 0.34,
      thickness: 0.22,
      ior: 1.35,
      attenuationColor: new THREE.Color(color),
      attenuationDistance: 1.8,
      emissive: new THREE.Color(color).multiplyScalar(0.12),
      emissiveIntensity: 1.0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.4,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uKelpTime = { value: 0 };
      shader.uniforms.uKelpPhase = { value: phase };
      shader.uniforms.uKelpSpeed = { value: swaySpeed };
      shader.uniforms.uKelpAmount = { value: swayAmount };
      (material as THREE.MeshPhysicalMaterial & { userData: { kelpShader?: typeof shader } }).userData.kelpShader = shader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
uniform float uKelpTime;
uniform float uKelpPhase;
uniform float uKelpSpeed;
uniform float uKelpAmount;
varying float vKelpTip;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  vKelpTip = uv.y;
  float tip = uv.y * uv.y;
  float wave = sin(uKelpTime * uKelpSpeed + uKelpPhase + uv.y * 6.2831) * uKelpAmount;
  float twist = cos(uKelpTime * uKelpSpeed * 0.8 + uKelpPhase) * 0.28;
  transformed.x += (wave + twist * 0.35) * tip;
  transformed.z += (twist + wave * 0.4) * tip;
}`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
varying float vKelpTip;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        `vec3 totalEmissiveRadiance = emissive;
{
  float tip = pow(clamp(vKelpTip, 0.0, 1.0), 1.6);
  totalEmissiveRadiance += diffuseColor.rgb * tip * 0.4;
}`
      );
    };
    material.customProgramCacheKey = () => `kelp-gpu-sway-${phase.toFixed(2)}`;
    this.materials.push(material);

    const blade = new THREE.Mesh(geometry, material);
    blade.castShadow = true;
    blade.receiveShadow = true;
    frondGroup.add(blade);
    return frondGroup;
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;
    for (const mat of this.materials) {
      const shader = (mat as THREE.MeshPhysicalMaterial & {
        userData: { kelpShader?: { uniforms: Record<string, { value: number }> } };
      }).userData.kelpShader;
      if (shader?.uniforms?.uKelpTime) {
        shader.uniforms.uKelpTime.value = this.time;
      }
    }
  }

  public dispose(): void {
    this.kelp.forEach((plant) => {
      plant.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else if (m) m.dispose();
        }
      });
      this.scene.remove(plant);
    });
    this.kelp = [];
    this.materials = [];
  }
}

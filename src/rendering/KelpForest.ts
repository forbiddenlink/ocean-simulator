import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sampleSandHeight } from './RealisticOceanFloor';
import { CoralFormations } from './CoralFormations';

/**
 * Kelp forest with GPU vertex-shader sway.
 *
 * Every blade in the forest lives in ONE merged geometry drawn with ONE material. The
 * per-plant sway parameters that used to force a unique material — and therefore a unique
 * compiled shader program — per blade are now vertex attributes, so the whole forest is a
 * single draw call and a single program.
 */
export class KelpForest {
  private scene: THREE.Scene;
  private time = 0;

  private bladeMesh?: THREE.Mesh;
  private holdfastMesh?: THREE.InstancedMesh;
  private bladderMesh?: THREE.InstancedMesh;
  private readonly timeUniform = { value: 0 };

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

    const bladeGeometries: THREE.BufferGeometry[] = [];
    const holdfastTransforms: THREE.Matrix4[] = [];
    const bladderTransforms: THREE.Matrix4[] = [];

    const plantMatrix = new THREE.Matrix4();
    const frondMatrix = new THREE.Matrix4();
    const localMatrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const patch = patches[i % patches.length];
      const a = Math.random() * Math.PI * 2;
      const d = Math.pow(Math.random(), 0.7) * patch.r;
      const x = patch.x + Math.cos(a) * d;
      const z = patch.z + Math.sin(a) * d;
      const height = 5.5 + Math.random() * 7;
      const y = floorY + sampleSandHeight(x, z);

      plantMatrix.makeTranslation(x, y, z);

      const frondCount = 5 + Math.floor(Math.random() * 5);
      const phase = Math.random() * Math.PI * 2;
      const swaySpeed = 0.35 + Math.random() * 0.35;
      const swayAmount = 0.45 + Math.random() * 0.4;

      // Holdfast / root bulb
      const holdfastRadius = 0.22 + Math.random() * 0.12;
      holdfastTransforms.push(
        new THREE.Matrix4().compose(
          position.set(x, y + 0.08, z),
          quaternion.identity(),
          scale.set(holdfastRadius * 1.2, holdfastRadius * 0.55, holdfastRadius * 1.2)
        )
      );

      for (let f = 0; f < frondCount; f++) {
        frondMatrix.makeRotationY((f / frondCount) * Math.PI * 2);
        localMatrix.copy(plantMatrix).multiply(frondMatrix);

        const blade = this.createBladeGeometry(
          height,
          f / frondCount,
          phase + f * 0.4,
          swaySpeed,
          swayAmount
        );
        blade.applyMatrix4(localMatrix);
        bladeGeometries.push(blade);

        // Occasional pneumatocyst (float bladder) mid-frond
        if (Math.random() < 0.35) {
          const bladderRadius = 0.08 + Math.random() * 0.05;
          bladderTransforms.push(
            new THREE.Matrix4().compose(
              position.set(
                x + Math.sin(f) * 0.15,
                y + height * (0.35 + Math.random() * 0.4),
                z + Math.cos(f) * 0.15
              ),
              quaternion.identity(),
              scale.setScalar(bladderRadius)
            )
          );
        }
      }
    }

    this.buildBlades(bladeGeometries);
    this.buildHoldfasts(holdfastTransforms);
    this.buildBladders(bladderTransforms);
  }

  /**
   * One blade, in plant-local space, carrying its own sway parameters as attributes so
   * every blade can share a single material.
   */
  private createBladeGeometry(
    height: number,
    offset: number,
    phase: number,
    swaySpeed: number,
    swayAmount: number
  ): THREE.BufferGeometry {
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

    const vertexCount = geometry.attributes.position.count;
    const sway = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      sway[i * 3] = phase;
      sway[i * 3 + 1] = swaySpeed;
      sway[i * 3 + 2] = swayAmount;
    }
    geometry.setAttribute('aKelpSway', new THREE.BufferAttribute(sway, 3));

    return geometry;
  }

  private buildBlades(geometries: THREE.BufferGeometry[]): void {
    if (geometries.length === 0) return;

    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) return;
    merged.computeBoundingSphere();

    const material = new THREE.MeshPhysicalMaterial({
      color: 0x6f8a5c,
      side: THREE.DoubleSide,
      roughness: 0.52,
      metalness: 0.0,
      transparent: true,
      opacity: 0.84,
      emissive: new THREE.Color(0x6f8a5c).multiplyScalar(0.12),
      emissiveIntensity: 1.0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.4,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uKelpTime = this.timeUniform;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
uniform float uKelpTime;
attribute vec3 aKelpSway;
varying float vKelpTip;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  float kelpPhase = aKelpSway.x;
  float kelpSpeed = aKelpSway.y;
  float kelpAmount = aKelpSway.z;
  vKelpTip = uv.y;
  float tip = uv.y * uv.y;
  float wave = sin(uKelpTime * kelpSpeed + kelpPhase + uv.y * 6.2831) * kelpAmount;
  float twist = cos(uKelpTime * kelpSpeed * 0.8 + kelpPhase) * 0.28;
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
    material.customProgramCacheKey = () => 'kelp-gpu-sway';

    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'kelpBlades';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.bladeMesh = mesh;
    this.scene.add(mesh);
  }

  private buildHoldfasts(transforms: THREE.Matrix4[]): void {
    if (transforms.length === 0) return;
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshPhysicalMaterial({ color: 0x4a3a28, roughness: 0.9, metalness: 0.0 }),
      transforms.length
    );
    mesh.name = 'kelpHoldfasts';
    transforms.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.holdfastMesh = mesh;
    this.scene.add(mesh);
  }

  private buildBladders(transforms: THREE.Matrix4[]): void {
    if (transforms.length === 0) return;
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshPhysicalMaterial({
        color: 0x6a8a4a,
        roughness: 0.4,
        transparent: true,
        opacity: 0.85,
      }),
      transforms.length
    );
    mesh.name = 'kelpBladders';
    transforms.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    this.bladderMesh = mesh;
    this.scene.add(mesh);
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;
    this.timeUniform.value = this.time;
  }

  public dispose(): void {
    for (const mesh of [this.bladeMesh, this.holdfastMesh, this.bladderMesh]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    }
    this.bladeMesh = undefined;
    this.holdfastMesh = undefined;
    this.bladderMesh = undefined;
  }
}

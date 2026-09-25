import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sampleSandHeight } from './RealisticOceanFloor';
import { CoralFormations } from './CoralFormations';

/**
 * Sea anemones — oral disc + tentacles with clamped sway.
 *
 * The whole colony is two draw calls. Each anemone used to be a Group of ~30 meshes, each
 * with its own material, animated by writing `rotation` on the CPU every frame; that cost
 * more in draw-call submission than the anemones are worth. The same motion now runs in
 * the vertex shader from per-vertex attributes: the colony sway pivots around the anemone
 * origin, and the tentacle sway pivots around each tentacle's attachment point.
 */
export class SeaAnemones {
  private scene: THREE.Scene;
  private time = 0;
  private meshes: THREE.Mesh[] = [];
  private readonly timeUniform = { value: 0 };

  /** Container so the whole colony can be addressed as one object. */
  public readonly group = new THREE.Group();

  private static readonly COLORS = [
    0xff6b9d, 0xff8c42, 0xffbe0b, 0xfb5607, 0x8338ec, 0x3a86ff, 0xff5e78,
  ];

  constructor(scene: THREE.Scene, floorDepth: number, count: number = 40) {
    this.scene = scene;
    this.group.name = 'seaAnemones';
    this.scene.add(this.group);
    this.createAnemones(floorDepth, count);
  }

  private createAnemones(floorDepth: number, count: number): void {
    const patches = CoralFormations.lastReefPatches.length
      ? CoralFormations.lastReefPatches
      : [{ x: 0, z: 0, radius: 40 }];

    const bodyGeometries: THREE.BufferGeometry[] = [];
    const tentacleGeometries: THREE.BufferGeometry[] = [];

    for (let i = 0; i < count; i++) {
      const patch = patches[i % patches.length];
      const a = Math.random() * Math.PI * 2;
      const d = Math.pow(Math.random(), 0.55) * (patch.radius + 4);
      const x = patch.x + Math.cos(a) * d + (Math.random() - 0.5) * 6;
      const z = patch.z + Math.sin(a) * d + (Math.random() - 0.5) * 6;
      const y = floorDepth + sampleSandHeight(x, z);

      this.buildAnemone(x, y, z, bodyGeometries, tentacleGeometries);
    }

    this.meshes.push(
      this.buildMesh(bodyGeometries, 'anemoneBodies', {
        roughness: 0.65,
        metalness: 0.05,
        clearcoat: 0.28,
        clearcoatRoughness: 0.5,
        emissiveIntensity: 0.18,
      })
    );
    this.meshes.push(
      this.buildMesh(tentacleGeometries, 'anemoneTentacles', {
        roughness: 0.42,
        metalness: 0.0,
        transparent: true,
        opacity: 0.9,
        emissiveIntensity: 0.22,
        clearcoat: 0.45,
        clearcoatRoughness: 0.2,
        sheen: 0.45,
      })
    );
  }

  private buildAnemone(
    x: number,
    y: number,
    z: number,
    bodyGeometries: THREE.BufferGeometry[],
    tentacleGeometries: THREE.BufferGeometry[]
  ): void {
    const tentacleCount = 14 + Math.floor(Math.random() * 12);
    const height = 0.55 + Math.random() * 0.85;
    const color = new THREE.Color(
      SeaAnemones.COLORS[Math.floor(Math.random() * SeaAnemones.COLORS.length)]
    );
    const origin = new THREE.Vector3(x, y, z);
    const anemonePhase = Math.random() * Math.PI * 2;

    const transform = new THREE.Matrix4();
    const euler = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const attach = new THREE.Vector3();

    // Column
    const base = new THREE.CylinderGeometry(0.16, 0.22, height * 0.38, 14);
    transform.makeTranslation(x, y + height * 0.19, z);
    base.applyMatrix4(transform);
    this.tag(base, origin, origin, anemonePhase, 0, 0, color.clone().multiplyScalar(0.55));
    bodyGeometries.push(base);

    // Oral disc
    const disc = new THREE.CylinderGeometry(0.2, 0.18, 0.06, 16);
    transform.makeTranslation(x, y + height * 0.4, z);
    disc.applyMatrix4(transform);
    this.tag(disc, origin, origin, anemonePhase, 0, 0, color.clone().multiplyScalar(0.75));
    bodyGeometries.push(disc);

    // Short crown tentacles on the disc
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      attach.set(x + Math.cos(angle) * 0.12, y + height * 0.42, z + Math.sin(angle) * 0.12);
      euler.set(0.55, angle, 0);
      quaternion.setFromEuler(euler);
      transform.compose(attach, quaternion, scale);

      const tentacle = this.createTentacleGeometry(0.014);
      tentacle.applyMatrix4(transform);
      this.tag(tentacle, origin, attach, anemonePhase, anemonePhase + i * 0.3, 1, color);
      tentacleGeometries.push(tentacle);
    }

    // Main tentacle crown
    for (let i = 0; i < tentacleCount; i++) {
      const angle = (i / tentacleCount) * Math.PI * 2;
      attach.set(x, y + height * 0.4, z);
      euler.set(Math.PI / 3.2 + Math.random() * 0.25, angle, 0);
      quaternion.setFromEuler(euler);
      transform.compose(attach, quaternion, scale);

      const tentacle = this.createTentacleGeometry(0.022);
      tentacle.applyMatrix4(transform);
      this.tag(tentacle, origin, attach, anemonePhase, anemonePhase + i * 0.3, 1, color);
      tentacleGeometries.push(tentacle);
    }
  }

  private createTentacleGeometry(radius: number): THREE.BufferGeometry {
    const length = 0.35 + Math.random() * 0.45;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3((Math.random() - 0.5) * 0.18, length * 0.5, (Math.random() - 0.5) * 0.18),
      new THREE.Vector3((Math.random() - 0.5) * 0.28, length, (Math.random() - 0.5) * 0.28)
    );
    return new THREE.TubeGeometry(curve, 12, radius, 6, false);
  }

  /**
   * Attach the per-vertex data the sway shader needs: the two pivots, the two phases, how
   * much tentacle sway applies, and the anemone's colour.
   */
  private tag(
    geometry: THREE.BufferGeometry,
    origin: THREE.Vector3,
    pivot: THREE.Vector3,
    anemonePhase: number,
    tentaclePhase: number,
    tentacleAmount: number,
    color: THREE.Color
  ): void {
    const count = geometry.attributes.position.count;
    const origins = new Float32Array(count * 3);
    const pivots = new Float32Array(count * 3);
    const sway = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      origins[i * 3] = origin.x;
      origins[i * 3 + 1] = origin.y;
      origins[i * 3 + 2] = origin.z;
      pivots[i * 3] = pivot.x;
      pivots[i * 3 + 1] = pivot.y;
      pivots[i * 3 + 2] = pivot.z;
      sway[i * 3] = anemonePhase;
      sway[i * 3 + 1] = tentaclePhase;
      sway[i * 3 + 2] = tentacleAmount;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('aAnemoneOrigin', new THREE.BufferAttribute(origins, 3));
    geometry.setAttribute('aTentaclePivot', new THREE.BufferAttribute(pivots, 3));
    geometry.setAttribute('aAnemoneSway', new THREE.BufferAttribute(sway, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // TubeGeometry/CylinderGeometry both carry uv; drop anything else so merges line up.
    geometry.deleteAttribute('tangent');
  }

  private buildMesh(
    geometries: THREE.BufferGeometry[],
    name: string,
    params: THREE.MeshPhysicalMaterialParameters
  ): THREE.Mesh {
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    merged.computeBoundingSphere();

    const material = new THREE.MeshPhysicalMaterial({
      ...params,
      vertexColors: true,
      emissive: new THREE.Color(0xffffff),
    });
    this.applySwayShader(material);

    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    return mesh;
  }

  /**
   * Reproduces the old CPU animation: a whole-anemone tilt around its origin, plus a
   * per-tentacle tilt around the tentacle's attachment point. Amplitudes are unchanged.
   */
  private applySwayShader(material: THREE.MeshPhysicalMaterial): void {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uAnemoneTime = this.timeUniform;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
uniform float uAnemoneTime;
attribute vec3 aAnemoneOrigin;
attribute vec3 aTentaclePivot;
attribute vec3 aAnemoneSway;

vec3 tiltXZ(vec3 v, float ax, float az) {
  float sx = sin(ax), cx = cos(ax);
  vec3 r = vec3(v.x, v.y * cx - v.z * sx, v.y * sx + v.z * cx);
  float sz = sin(az), cz = cos(az);
  return vec3(r.x * cz - r.y * sz, r.x * sz + r.y * cz, r.z);
}`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  float anemonePhase = aAnemoneSway.x;
  float tentaclePhase = aAnemoneSway.y;
  float tentacleAmount = aAnemoneSway.z;

  float tx = sin(uAnemoneTime * 1.15 + tentaclePhase) * 0.12 * tentacleAmount;
  float tz = cos(uAnemoneTime * 0.9 + tentaclePhase) * 0.06 * tentacleAmount;
  transformed = aTentaclePivot + tiltXZ(transformed - aTentaclePivot, tx, tz);

  float bx = sin(uAnemoneTime * 0.8 + anemonePhase) * 0.1;
  float bz = cos(uAnemoneTime * 0.6 + anemonePhase * 1.3) * 0.1;
  transformed = aAnemoneOrigin + tiltXZ(transformed - aAnemoneOrigin, bx, bz);

  objectNormal = tiltXZ(tiltXZ(objectNormal, tx, tz), bx, bz);
  vNormal = normalize(normalMatrix * objectNormal);
}`
      );
    };
    material.customProgramCacheKey = () => `anemone-sway-${material.transparent ? 't' : 'o'}`;
  }

  update(deltaTime: number): void {
    this.time += deltaTime;
    this.timeUniform.value = this.time;
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    }
    this.meshes = [];
    this.scene.remove(this.group);
  }
}

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { CAUSTIC_GLSL } from './WaterMedium';

function hash2(ix: number, iz: number): number {
  const h = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x, z);
    norm += amp;
    // Rotate each octave so ridges do not line up on the grid.
    const nx = x * 1.6 + z * 1.2;
    z = -x * 1.2 + z * 1.6;
    x = nx;
    amp *= 0.5;
  }
  return sum / norm;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Rock pinnacles inside the basin: occluders and landmarks that give the scene scale. */
const PINNACLES: ReadonlyArray<{ x: number; z: number; h: number; r: number }> = [
  { x: 24, z: -30, h: 8, r: 5.5 },
  { x: -31, z: -16, h: 10, r: 6.5 },
  { x: 7, z: -52, h: 6, r: 7 },
  { x: -18, z: 34, h: 5, r: 5 },
];

/**
 * Seabed height above the -30 m floor datum, shared by the floor mesh and everything
 * placed on it (rocks, coral, kelp, critters). A sandy basin around the swim area,
 * rock pinnacles inside it, and terraced rock walls rising outside ~60 m so the world
 * has an edge that dissolves into water instead of ending at a seam.
 */
export function sampleSandHeight(x: number, z: number): number {
  let height =
    Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.8 +
    Math.sin(x * 0.2 + z * 0.15) * 0.3 +
    Math.sin(x * 0.5) * Math.cos(z * 0.4) * 0.15;

  for (let m = 0; m < 10; m++) {
    const moundX = Math.sin(m * 7.3) * 80;
    const moundZ = Math.cos(m * 4.9) * 80;
    const dist = Math.hypot(x - moundX, z - moundZ);
    const moundRadius = 10 + (m % 5) * 4;
    if (dist < moundRadius) {
      height += Math.cos((dist / moundRadius) * Math.PI * 0.5) * (1.0 + (m % 3) * 0.5);
    }
  }

  // Broad dunes.
  height += (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 3.0;

  // Ridged noise: sharp crests for rock.
  const ridged = 1 - Math.abs(2 * fbm(x * 0.045 + 11.3, z * 0.045 - 4.1, 4) - 1);

  // Basin walls. The rim distance wanders with direction so the edge is not a circle.
  const r = Math.hypot(x, z);
  const ang = Math.atan2(z, x);
  const dirNoise = fbm(Math.cos(ang) * 2.2 + 7.0, Math.sin(ang) * 2.2 + 3.0, 3);
  const rimStart = 56 + dirNoise * 22;
  const t = smoothstep(rimStart, rimStart + 60, r);
  let wall = t * (12 + dirNoise * 16) + t * ridged * 6;
  // Terraces: rock breaks into ledges instead of a smooth ramp.
  const step = 2.6;
  const terraced = Math.floor(wall / step) * step + smoothstep(0.55, 1, (wall % step) / step) * step;
  wall = wall + (terraced - wall) * 0.6 * t;
  height += Math.min(wall, 23);

  for (const p of PINNACLES) {
    const d = Math.hypot(x - p.x, z - p.z) / p.r;
    if (d < 3) {
      const shape = Math.exp(-d * d * 0.9);
      height += p.h * shape * (0.75 + 0.5 * ridged);
    }
  }

  return height;
}

/**
 * Enhanced ocean floor — sand shader with baked ripples + instanced rocks on terrain.
 */
export class RealisticOceanFloor {
  static createDetailedFloor(scene: THREE.Scene, depth: number): THREE.Group {
    const floorGroup = new THREE.Group();
    floorGroup.name = 'oceanFloor';

    floorGroup.add(this.createSandyFloor(depth));
    floorGroup.add(this.createRockyAreas(depth));

    scene.add(floorGroup);
    return floorGroup;
  }

  private static createSandyFloor(depth: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(440, 440, 300, 300);
    // Rotate BEFORE displacing: displacing the unrotated plane's Y wrote heights into the
    // in-plane axis and collapsed the floor into a 420 x 3 m strip.
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      // Bake micro-ripples into the sand mesh (replaces the old second ripple plane)
      const ripple = Math.sin(x * 2.0) * 0.045 + Math.sin(z * 1.5 + x * 0.5) * 0.028;
      positions.setY(i, sampleSandHeight(x, z) + ripple);
    }
    geometry.computeVertexNormals();

    // Lit radiance only: the water (depth loss, distance haze) is applied once, in the
    // WaterMedium post pass, the same way as for every other surface.
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        lightDirection: { value: new THREE.Vector3(0.3, 1.0, 0.2).normalize() },
        sunIntensity: { value: 1.0 },
        causticIntensity: { value: 0.9 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;

        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 lightDirection;
        uniform float sunIntensity;
        uniform float causticIntensity;

        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;

        ${CAUSTIC_GLSL}

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          const mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p = rot * p * 2.03;
            a *= 0.5;
          }
          return v;
        }

        // Triplanar fbm so steep rock faces are not stretched.
        float triFbm(vec3 p, vec3 n) {
          vec3 w = pow(abs(n), vec3(4.0));
          w /= (w.x + w.y + w.z);
          return fbm(p.zy) * w.x + fbm(p.xz) * w.y + fbm(p.xy) * w.z;
        }

        void main() {
          vec3 p = vWorldPos;
          vec3 geoN = normalize(vWorldNormal);

          // --- Material: sand on the flats, rock where it gets steep or high ---
          float slope = 1.0 - geoN.y;
          float rise = p.y + 30.0;
          float rockMask = smoothstep(0.16, 0.34, slope + (fbm(p.xz * 0.15) - 0.5) * 0.18);
          rockMask = max(rockMask, smoothstep(4.0, 9.0, rise + (fbm(p.xz * 0.08) - 0.5) * 6.0));

          // Sand: fine grain + ripples + darker organic patches.
          float grain = fbm(p.xz * 3.1);
          float patches = fbm(p.xz * 0.09 + 3.7);
          float ripple = sin(p.x * 2.1 + p.z * 0.4 + fbm(p.xz * 0.5) * 3.0) * 0.5 + 0.5;
          vec3 sand = mix(vec3(0.46, 0.42, 0.34), vec3(0.58, 0.53, 0.43), grain);
          sand *= mix(0.72, 1.06, smoothstep(0.3, 0.7, patches));
          sand *= mix(0.9, 1.05, ripple);
          // Scattered shell grit.
          sand = mix(sand, vec3(0.7, 0.68, 0.62), step(0.965, noise(p.xz * 9.0)) * 0.6);

          // Rock: dark, banded strata, pitted, with growth on up-facing ledges.
          float strata = abs(fract(p.y * 0.42 + fbm(p.xz * 0.12) * 1.3) - 0.5) * 2.0;
          float rockDetail = triFbm(p * 0.9, geoN);
          float pits = smoothstep(0.62, 0.8, triFbm(p * 2.7 + 5.0, geoN));
          vec3 rock = mix(vec3(0.11, 0.105, 0.095), vec3(0.24, 0.22, 0.19), rockDetail);
          rock *= mix(0.78, 1.08, strata);
          rock *= 1.0 - pits * 0.45;
          float growth = smoothstep(0.55, 0.9, geoN.y) * smoothstep(0.35, 0.65, fbm(p.xz * 0.6 + 9.0));
          rock = mix(rock, vec3(0.16, 0.2, 0.09), growth * 0.75);
          // Encrusting coralline patches: dusty pink-purple, sparse.
          float crust = smoothstep(0.68, 0.78, triFbm(p * 0.35 + 21.0, geoN));
          rock = mix(rock, vec3(0.36, 0.2, 0.26), crust * 0.6);

          vec3 albedo = mix(sand, rock, rockMask);

          // Cheap detail normal from the albedo-scale noise so light grazes texture.
          float e = 0.08;
          float h0 = triFbm(p * 1.6, geoN);
          float hx = triFbm((p + vec3(e, 0.0, 0.0)) * 1.6, geoN);
          float hz = triFbm((p + vec3(0.0, 0.0, e)) * 1.6, geoN);
          float bump = mix(0.25, 1.1, rockMask);
          vec3 n = normalize(geoN + vec3(h0 - hx, 0.0, h0 - hz) * bump * 4.0);

          // --- Lighting ---
          vec3 L = normalize(lightDirection);
          float ndl = max(dot(n, L), 0.0);

          // Focused sunlight. Projected along the sun through the surface, so caustics
          // slide across slopes correctly; they blur out with depth.
          vec2 entry = wm_surfaceEntry(p, L);
          vec3 c = wm_causticRGB(entry, time);
          // Contrast falls with depth (focus spreads), with patchy surface waves, and
          // when a caustic cell shrinks below a few pixels (otherwise it aliases into a net).
          float focus = exp(-max(-p.y - 4.0, 0.0) * 0.035);
          float patchy = smoothstep(0.25, 0.75, fbm(entry * 0.035 + time * 0.02));
          float footprint = length(fwidth(entry)) * 0.62;
          float aa = 1.0 - smoothstep(0.08, 0.35, footprint);
          float contrast = focus * mix(0.35, 1.0, patchy) * aa * causticIntensity;
          vec3 sunLight = vec3(1.0, 0.97, 0.9) * sunIntensity * 1.6;
          vec3 direct = sunLight * ndl * mix(vec3(1.0), 0.33 + c * 1.9, contrast);

          // Sky light comes from above through the water; almost nothing from below.
          float up = n.y * 0.5 + 0.5;
          vec3 ambient = mix(vec3(0.01, 0.025, 0.03), vec3(0.16, 0.32, 0.4), up * up) * (0.35 + 0.65 * sunIntensity);

          // Crevice darkening: concave rock (strata grooves, pits) gets less light.
          float occl = mix(1.0, 0.55 + 0.45 * strata, rockMask) * (1.0 - pits * 0.3 * rockMask);

          vec3 col = albedo * (direct + ambient) * occl;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'sandFloor';
    mesh.position.y = depth;
    mesh.receiveShadow = true;
    return mesh;
  }

  private static createRockyAreas(depth: number): THREE.Group {
    const group = new THREE.Group();
    group.name = 'rockyAreas';

    // Weathered boulder: merged so normals stay smooth across the old facets, then
    // displaced by two noise octaves and a flattened, slightly undercut base so the
    // rocks sit in the sand instead of reading as dark eggs.
    const rockGeometry = mergeVertices(new THREE.DodecahedronGeometry(1, 4));
    const pos = rockGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i);
      const ny = pos.getY(i);
      const nz = pos.getZ(i);
      const lumps = fbm(nx * 1.6 + ny * 0.7 + 11.0, nz * 1.6 - ny * 0.9 + 3.0, 4) - 0.5;
      const chips = fbm(nx * 5.3 - nz * 1.1, ny * 5.3 + nz * 2.3, 2) - 0.5;
      const n = 1 + lumps * 0.42 + chips * 0.1;
      const flatBase = ny < -0.35 ? -0.35 + (ny + 0.35) * 0.3 : ny;
      pos.setXYZ(i, nx * n, flatBase * n, nz * n);
    }
    rockGeometry.computeVertexNormals();

    const rockMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.04,
      clearcoat: 0.08,
      clearcoatRoughness: 0.7,
    });

    const count = 180;
    const mesh = new THREE.InstancedMesh(rockGeometry, rockMaterial, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'rocksInstanced';

    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const euler = new THREE.Euler();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 340;
      const z = (Math.random() - 0.5) * 340;
      const s = Math.random() < 0.18
        ? 2.8 + Math.random() * 2.4
        : 0.45 + Math.random() * 1.9;
      const terrainY = sampleSandHeight(x, z);

      position.set(x, depth + terrainY + s * 0.28, z);
      euler.set(Math.random() * 0.45, Math.random() * Math.PI * 2, Math.random() * 0.45);
      quat.setFromEuler(euler);
      scale.set(s, s * (0.45 + Math.random() * 0.35), s * (0.85 + Math.random() * 0.3));
      matrix.compose(position, quat, scale);
      mesh.setMatrixAt(i, matrix);

      color.setHSL(0.08 + Math.random() * 0.06, 0.12, 0.26 + Math.random() * 0.14);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    group.add(mesh);
    return group;
  }

  /** Advance sand caustic clock + sun (call once per frame from RenderingEngine). */
  static update(floor: THREE.Mesh, deltaTime: number, sunDirection?: THREE.Vector3, sunIntensity?: number): void {
    if (!(floor.material instanceof THREE.ShaderMaterial)) return;
    if (floor.material.uniforms.time) {
      floor.material.uniforms.time.value += deltaTime;
    }
    if (sunDirection && floor.material.uniforms.lightDirection) {
      floor.material.uniforms.lightDirection.value.copy(sunDirection).normalize();
    }
    if (sunIntensity !== undefined) {
      floor.material.uniforms.sunIntensity.value = sunIntensity;
    }
  }
}

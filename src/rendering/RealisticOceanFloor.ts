import * as THREE from 'three';

/**
 * Shared sand-mound height so rocks / coral / kelp sit on the same terrain.
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
    const geometry = new THREE.PlaneGeometry(420, 420, 220, 220);

    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      // Bake micro-ripples into the sand mesh (replaces the old second ripple plane)
      const ripple = Math.sin(x * 2.0) * 0.045 + Math.sin(z * 1.5 + x * 0.5) * 0.028;
      positions.setY(i, sampleSandHeight(x, z) + ripple);
    }
    geometry.computeVertexNormals();

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        sandColor1: { value: new THREE.Color(0x8B7D6B) },
        sandColor2: { value: new THREE.Color(0x7A6E5D) },
        rockColor: { value: new THREE.Color(0x6B6860) },
        detailScale: { value: 42.0 },
        lightDirection: { value: new THREE.Vector3(0.1, 1.0, 0.1).normalize() },
        absorptionCoeffs: { value: new THREE.Vector3(0.28, 0.09, 0.035) },
        waterDepth: { value: 30.0 },
        causticIntensity: { value: 0.9 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        varying float vHeight;
        varying vec3 vWorldNormal;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vHeight = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sandColor1;
        uniform vec3 sandColor2;
        uniform vec3 rockColor;
        uniform float detailScale;
        uniform vec3 lightDirection;
        uniform float time;
        uniform vec3 absorptionCoeffs;
        uniform float waterDepth;
        uniform float causticIntensity;

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        varying float vHeight;
        varying vec3 vWorldNormal;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          const mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 5; i++) {
            value += amplitude * noise(p);
            p = rot * p * 2.0;
            amplitude *= 0.5;
          }
          return value;
        }

        void main() {
          vec2 warp = vec2(fbm(vUv * 9.0), fbm(vUv * 9.0 + vec2(5.2, 1.3)));
          float detail = fbm(vUv * detailScale + warp * 1.8);
          float grain = fbm(vUv * detailScale * 2.7 + warp * 0.6);
          detail = mix(detail, grain, 0.35);

          // Ripple ridges baked into albedo (directional sand waves)
          float rippleAlbedo = sin(vPosition.x * 2.1 + vPosition.z * 0.4) * 0.5 + 0.5;
          rippleAlbedo *= sin(vPosition.z * 1.7 - vPosition.x * 0.3) * 0.5 + 0.5;

          float patchMix = fbm(vUv * 3.2 + warp * 0.4);
          vec3 sandColor = mix(sandColor1, sandColor2, detail * 0.5 + 0.25);
          sandColor = mix(sandColor * 0.78, sandColor * 1.18, smoothstep(0.25, 0.75, patchMix));
          sandColor = mix(sandColor, sandColor2, smoothstep(-0.5, 0.5, vHeight) * 0.3);
          sandColor *= mix(0.92, 1.08, rippleAlbedo);

          float rockNoise = noise(vUv * 15.0 + vec2(123.4, 567.8));
          if (rockNoise > 0.9) {
            sandColor = mix(sandColor, rockColor, (rockNoise - 0.9) * 8.0);
          }

          // Shell / pebble flecks
          float fleck = noise(vUv * 55.0 + vec2(9.1, 2.7));
          if (fleck > 0.94) {
            sandColor = mix(sandColor, vec3(0.75, 0.72, 0.65), (fleck - 0.94) * 12.0);
          }

          vec3 nW = normalize(vWorldNormal);
          float diffuse = max(dot(nW, normalize(lightDirection)), 0.0);
          float ambient = 0.28;
          vec3 litColor = sandColor * (ambient + 0.55 * diffuse);

          vec2 cw = vec2(fbm(vUv * 6.0 + time * 0.18), fbm(vUv * 6.0 - time * 0.14 + 9.1));
          float caustic = fbm(vUv * 18.0 + cw * 2.4 + time * 0.22);
          float caustic2 = fbm(vUv * 28.0 - cw * 1.6 - time * 0.17 + 3.7);
          caustic = max(
            pow(smoothstep(0.48, 0.95, caustic), 2.1),
            pow(smoothstep(0.55, 0.98, caustic2), 2.4) * 0.65
          );
          float nUp = max(dot(nW, vec3(0.0, 1.0, 0.0)), 0.0);
          litColor += vec3(0.55, 0.85, 0.78) * caustic * causticIntensity
                    * (0.35 + 0.9 * diffuse) * (0.4 + 0.6 * nUp);

          vec3 absorption = exp(-absorptionCoeffs * waterDepth * 0.85);
          litColor *= absorption;

          vec3 viewDir = normalize(cameraPosition - vPosition);
          vec3 halfDir = normalize(normalize(lightDirection) + viewDir);
          float spec = pow(max(dot(nW, halfDir), 0.0), 20.0) * 0.035;
          litColor += vec3(spec) * absorption;

          float ao = smoothstep(-1.0, 1.0, vHeight);
          litColor *= 0.55 + 0.45 * ao;
          litColor = min(litColor, vec3(0.88));

          float camDist = length(cameraPosition - vPosition);
          float fogF = 1.0 - exp(-camDist * 0.018);
          litColor = mix(litColor, vec3(0.03, 0.09, 0.14), clamp(fogF, 0.0, 0.85));

          gl_FragColor = vec4(litColor, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'sandFloor';
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = depth;
    mesh.receiveShadow = true;
    return mesh;
  }

  private static createRockyAreas(depth: number): THREE.Group {
    const group = new THREE.Group();
    group.name = 'rockyAreas';

    const rockGeometry = new THREE.DodecahedronGeometry(1, 2);
    // Subtle vertex irregularity so rocks aren't identical crystals
    const pos = rockGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i);
      const ny = pos.getY(i);
      const nz = pos.getZ(i);
      const n = 1 + (Math.sin(nx * 7.1 + ny * 3.3) * 0.08 + Math.cos(nz * 5.7) * 0.06);
      pos.setXYZ(i, nx * n, ny * n, nz * n);
    }
    rockGeometry.computeVertexNormals();

    const rockMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x7a7870,
      roughness: 0.88,
      metalness: 0.04,
      clearcoat: 0.08,
      clearcoatRoughness: 0.7,
      emissive: new THREE.Color(0x10100e),
      emissiveIntensity: 0.12,
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

      color.setHSL(0.08 + Math.random() * 0.06, 0.08, 0.32 + Math.random() * 0.18);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    group.add(mesh);
    return group;
  }

  /** Advance sand caustic clock + sun (call once per frame from RenderingEngine). */
  static update(floor: THREE.Mesh, deltaTime: number, sunDirection?: THREE.Vector3): void {
    if (!(floor.material instanceof THREE.ShaderMaterial)) return;
    if (floor.material.uniforms.time) {
      floor.material.uniforms.time.value += deltaTime;
    }
    if (sunDirection && floor.material.uniforms.lightDirection) {
      floor.material.uniforms.lightDirection.value.copy(sunDirection).normalize();
    }
  }
}

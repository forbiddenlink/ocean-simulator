import * as THREE from 'three';

/**
 * Volumetric god-ray light shafts.
 *
 * The old particle-based `GodRays` produced vine-like artifacts and was disabled. This
 * replaces it with soft additive billboard columns descending from the surface — the
 * hero effect of the "Cinematic Deep" look. Each shaft is a tall camera-facing quad with
 * a gaussian horizontal falloff, a vertical fade (bright near the surface, gone in the
 * deep), and animated noise so the beams shimmer in sync with the caustics below.
 *
 * Works from any camera angle (unlike screen-space god rays, which need the sun on-screen).
 */
export class VolumetricLightShafts {
  public readonly group: THREE.Group;
  private material: THREE.ShaderMaterial;
  private shafts: { mesh: THREE.Mesh; basePos: THREE.Vector3 }[] = [];
  private time = 0;

  constructor(
    scene: THREE.Scene,
    opts: {
      count?: number;
      surfaceY?: number;
      depth?: number;
      spread?: number;
      center?: THREE.Vector3;
      color?: THREE.Color;
    } = {}
  ) {
    const {
      count = 9,
      surfaceY = 0,
      depth = 70,
      spread = 34,
      center = new THREE.Vector3(6, 0, 4), // biased toward the sun mesh at (10,80,5)
      color = new THREE.Color(0.55, 0.82, 1.0),
    } = opts;

    this.group = new THREE.Group();
    this.group.renderOrder = 5;

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: color },
        uIntensity: { value: 1.15 },
        uSurfaceY: { value: surfaceY },
        uDepth: { value: depth },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorld;
        uniform float uTime;
        uniform vec3  uColor;
        uniform float uIntensity;
        uniform float uSurfaceY;
        uniform float uDepth;

        // cheap value noise
        float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          float a = hash(i), b = hash(i + vec2(1.0,0.0));
          float c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
        }

        void main() {
          // Horizontal gaussian: bright core, soft feathered edges.
          float edge = abs(vUv.x - 0.5) * 2.0;
          float horiz = exp(-edge * edge * 3.6);

          // Vertical fade: peaks in the mid-upper water column and dissolves BEFORE the
          // surface (so no glowing slab appears above the waterline) and into the deep.
          float vert = smoothstep(0.04, 0.42, vUv.y) * (1.0 - smoothstep(0.62, 0.9, vUv.y));

          // Animated shimmer along the shaft (two scrolling noise octaves).
          float n = noise(vec2(vUv.x * 3.0, vUv.y * 6.0 - uTime * 0.35));
          n += 0.5 * noise(vec2(vUv.x * 7.0 + 3.0, vUv.y * 10.0 - uTime * 0.6));
          n = 0.55 + 0.45 * (n / 1.5);

          float alpha = horiz * vert * n * uIntensity;
          if (alpha < 0.002) discard;

          // Warm the shaft toward the surface (sunlit water) and keep it cool-teal in
          // the deep — a within-beam color gradient reads far more like real god rays
          // than a flat tint, and adds warm/cool contrast against the navy murk.
          vec3 col = mix(uColor, vec3(1.0, 0.93, 0.72), smoothstep(0.32, 0.6, vUv.y) * 0.5);
          // Hot core: the bright center of each shaft picks up extra warmth.
          col += vec3(0.25, 0.18, 0.06) * horiz * horiz;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    // Deterministic pseudo-random layout (no Math.random so captures are reproducible).
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const ang = t * Math.PI * 2.0 * 1.618;
      const rad = spread * (0.25 + 0.75 * ((i * 37) % 100) / 100);
      const w = 5 + ((i * 53) % 100) / 100 * 9;
      const geo = new THREE.PlaneGeometry(w, depth, 1, 24);
      const mesh = new THREE.Mesh(geo, this.material);
      const basePos = new THREE.Vector3(
        center.x + Math.cos(ang) * rad,
        surfaceY - depth * 0.5,
        center.z + Math.sin(ang) * rad
      );
      mesh.position.copy(basePos);
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.shafts.push({ mesh, basePos });
    }

    scene.add(this.group);
  }

  /** Billboard each shaft to face the camera around its vertical axis + advance shimmer. */
  update(deltaTime: number, camera: THREE.Camera): void {
    this.time += deltaTime;
    this.material.uniforms.uTime.value = this.time;

    const camPos = camera.position;
    for (const { mesh, basePos } of this.shafts) {
      const dx = camPos.x - basePos.x;
      const dz = camPos.z - basePos.z;
      mesh.rotation.y = Math.atan2(dx, dz);
      // subtle sway
      mesh.position.x = basePos.x + Math.sin(this.time * 0.15 + basePos.z) * 0.6;
    }
  }

  /** Fade shafts with time-of-day (strong at midday, gone at night). */
  setDayFactor(dayFactor: number): void {
    this.material.uniforms.uIntensity.value = 0.25 + 1.25 * Math.max(0, dayFactor);
  }

  setIntensity(intensity: number): void {
    this.material.uniforms.uIntensity.value = intensity;
  }

  dispose(): void {
    for (const { mesh } of this.shafts) mesh.geometry.dispose();
    this.material.dispose();
    this.group.parent?.remove(this.group);
  }
}

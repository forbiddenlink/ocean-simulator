import * as THREE from 'three';

/**
 * Foam generation and rendering system
 * Generates foam at wave crests and breaking waves
 *
 * Foam is placed where:
 * 1. Wave height exceeds threshold (crests) — sampled from FFT height when available
 * 2. Wave steepness is high (breaking waves)
 * 3. Procedural foam microstructure for bubble detail
 */
export class FoamSystem {
  private scene: THREE.Scene;
  private foamMaterial: THREE.ShaderMaterial;
  private foamMesh: THREE.Mesh;
  private time: number = 0;

  constructor(scene: THREE.Scene, oceanSize: number = 1000) {
    this.scene = scene;

    this.foamMaterial = this.createFoamMaterial(oceanSize);

    const geometry = new THREE.PlaneGeometry(oceanSize, oceanSize, 128, 128);
    geometry.rotateX(-Math.PI / 2);

    this.foamMesh = new THREE.Mesh(geometry, this.foamMaterial);
    this.foamMesh.position.y = 0.05;
    this.foamMesh.renderOrder = 1;

    this.scene.add(this.foamMesh);
  }

  private createFoamMaterial(oceanSize: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        foamColor: { value: new THREE.Color(0xffffff) },
        foamIntensity: { value: 0.9 },
        foamScale: { value: 15.0 },
        foamSpeed: { value: 0.5 },
        crestThreshold: { value: 0.35 },
        waterHeightMap: { value: null },
        hasWaterHeight: { value: 0.0 },
        oceanSize: { value: oceanSize },
      },
      vertexShader: `
        uniform sampler2D waterHeightMap;
        uniform float hasWaterHeight;

        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying float vHeight;

        void main() {
          vUv = uv;
          vec3 pos = position;
          float h = 0.0;
          if (hasWaterHeight > 0.5) {
            h = texture2D(waterHeightMap, uv).r;
            pos.y += h;
          }
          vHeight = h;
          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 foamColor;
        uniform float foamIntensity;
        uniform float foamScale;
        uniform float foamSpeed;
        uniform float crestThreshold;
        uniform sampler2D waterHeightMap;
        uniform float hasWaterHeight;
        uniform float oceanSize;

        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying float vHeight;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise2D(vec2 p) {
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
          float frequency = 1.0;

          for (int i = 0; i < 4; i++) {
            value += amplitude * noise2D(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
          }

          return value;
        }

        float foamPattern(vec2 uv, float t) {
          vec2 uv1 = uv + vec2(t * foamSpeed * 0.3, t * foamSpeed * 0.2);
          vec2 uv2 = uv * 1.5 - vec2(t * foamSpeed * 0.4, -t * foamSpeed * 0.3);
          vec2 uv3 = uv * 2.5 + vec2(-t * foamSpeed * 0.2, t * foamSpeed * 0.25);

          float foam1 = fbm(uv1);
          float foam2 = fbm(uv2);
          float foam3 = noise2D(uv3 * 3.0);

          float foam = (foam1 * 0.5 + foam2 * 0.3 + foam3 * 0.2);
          foam = smoothstep(crestThreshold, crestThreshold + 0.25, foam);
          return foam;
        }

        float waveCrestMask(vec2 worldPos, float t) {
          if (hasWaterHeight > 0.5) {
            // Real FFT crest + Jacobian foam (G channel) + slope
            float texel = 1.0 / 256.0;
            float h = vHeight;
            vec2 sC = texture2D(waterHeightMap, vUv).rg;
            float foamJ = sC.g;
            float hx = texture2D(waterHeightMap, vUv + vec2(texel, 0.0)).r
                     - texture2D(waterHeightMap, vUv - vec2(texel, 0.0)).r;
            float hz = texture2D(waterHeightMap, vUv + vec2(0.0, texel)).r
                     - texture2D(waterHeightMap, vUv - vec2(0.0, texel)).r;
            float steep = length(vec2(hx, hz));
            float crest = smoothstep(0.55, 1.55, h);
            float fold = smoothstep(0.12, 0.5, steep);
            return max(max(crest, fold * 0.85), foamJ);
          }

          // Fallback animated crest when no FFT height is bound
          vec2 wavePos1 = worldPos * 0.05 + vec2(t * 0.3, t * 0.2);
          vec2 wavePos2 = worldPos * 0.08 - vec2(t * 0.25, -t * 0.3);
          float wave1 = sin(wavePos1.x * 2.0 + wavePos1.y * 1.5) * 0.5 + 0.5;
          float wave2 = sin(wavePos2.x * 1.8 - wavePos2.y * 2.2) * 0.5 + 0.5;
          return smoothstep(0.6, 0.8, (wave1 + wave2) * 0.5);
        }

        void main() {
          vec2 foamUv = vWorldPosition.xz * foamScale * 0.01;

          float foam = foamPattern(foamUv, time);
          float crestMask = waveCrestMask(vWorldPosition.xz, time);
          foam *= crestMask;

          vec3 color = foamColor * foam * foamIntensity;
          float alpha = foam * 0.88;

          if (alpha < 0.04) discard;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
  }

  public setWaterHeightMap(texture: THREE.Texture | null, oceanSize?: number): void {
    this.foamMaterial.uniforms.waterHeightMap.value = texture;
    this.foamMaterial.uniforms.hasWaterHeight.value = texture ? 1.0 : 0.0;
    if (oceanSize !== undefined) {
      this.foamMaterial.uniforms.oceanSize.value = oceanSize;
    }
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;
    this.foamMaterial.uniforms.time.value = this.time;
  }

  public setIntensity(intensity: number): void {
    this.foamMaterial.uniforms.foamIntensity.value = intensity;
  }

  public setScale(scale: number): void {
    this.foamMaterial.uniforms.foamScale.value = scale;
  }

  public setCrestThreshold(threshold: number): void {
    this.foamMaterial.uniforms.crestThreshold.value = threshold;
  }

  public dispose(): void {
    this.foamMaterial.dispose();
    this.foamMesh.geometry.dispose();
    this.scene.remove(this.foamMesh);
  }
}

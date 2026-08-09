import * as THREE from 'three';

/**
 * Enhanced realistic underwater caustics effect
 * Simulates the light patterns created by sunlight refracting through water surface waves
 * 
 * Improvements:
 * - Better projection from water surface
 * - Chromatic aberration (RGB split)
 * - Integration with FFT wave data
 * - Higher quality patterns
 */
export class CausticsEffect {
  private causticsMaterial: THREE.ShaderMaterial;
  private causticsPlane: THREE.Mesh;
  private time: number = 0;
  private scene: THREE.Scene;
  private waterHeightTexture?: THREE.Texture;

  constructor(scene: THREE.Scene, _renderer: THREE.WebGLRenderer, waterHeightTexture?: THREE.Texture) {
    this.scene = scene;
    this.waterHeightTexture = waterHeightTexture;

    this.causticsMaterial = this.createCausticsMaterial();
    this.causticsPlane = this.createCausticsPlane();

    scene.add(this.causticsPlane);
  }
  
  private createCausticsMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.72 }, // Punchier dapples once wave-linked
        scale: { value: 13.0 }, // Larger organic patterns
        speed: { value: 0.48 },
        waterHeightMap: { value: this.waterHeightTexture || null },
        hasWaterHeight: { value: this.waterHeightTexture ? 1.0 : 0.0 },
        oceanSize: { value: 1200.0 },
        chromaticAberration: { value: 0.045 }, // More chromatic aberration for rainbow effect
        sunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
        surfaceY: { value: 0.0 }, // Water surface Y position
        maxDepth: { value: 40.0 }, // Caustics visible deeper
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        
        void main() {
          vUv = uv;
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float intensity;
        uniform float scale;
        uniform float speed;
        uniform sampler2D waterHeightMap;
        uniform float hasWaterHeight;
        uniform float oceanSize;
        uniform float chromaticAberration;
        uniform vec3 sunDirection;
        uniform float surfaceY;
        uniform float maxDepth;

        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        
        // Hash functions
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        
        float hash(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
        }
        
        // Improved Voronoi with F2-F1 for sharper caustics
        vec3 voronoiImproved(vec2 x, float time) {
          vec2 p = floor(x);
          vec2 f = fract(x);
          
          float minDist1 = 8.0;
          float minDist2 = 8.0;
          vec2 minPoint;
          
          for (int j = -2; j <= 2; j++) {
            for (int i = -2; i <= 2; i++) {
              vec2 neighbor = vec2(float(i), float(j));
              vec2 point = neighbor + 0.5 + 0.45 * sin(time * speed + 6.2831 * hash(p + neighbor) * vec2(1.0, 1.7));
              vec2 diff = neighbor + point - f;
              float dist = length(diff);
              
              if (dist < minDist1) {
                minDist2 = minDist1;
                minDist1 = dist;
                minPoint = point;
              } else if (dist < minDist2) {
                minDist2 = dist;
              }
            }
          }
          
          // F2 - F1 creates sharper features
          float caustic = minDist2 - minDist1;
          return vec3(caustic, minDist1, minDist2);
        }
        
        // Voronoi-based caustics pattern with better detail
        vec2 voronoi(vec2 x, float time) {
          vec2 p = floor(x);
          vec2 f = fract(x);
          
          float minDist = 8.0;
          vec2 minPoint;
          
          for (int j = -2; j <= 2; j++) {
            for (int i = -2; i <= 2; i++) {
              vec2 neighbor = vec2(float(i), float(j));
              vec2 point = neighbor + 0.5 + 0.45 * sin(time * speed + 6.2831 * hash(p + neighbor) * vec2(1.0, 1.7));
              vec2 diff = neighbor + point - f;
              float dist = length(diff);
              
              if (dist < minDist) {
                minDist = dist;
                minPoint = point;
              }
            }
          }
          
          return vec2(minDist, 0.0);
        }
        
        // Enhanced multi-octave caustics with chromatic aberration
        vec3 causticsChromatic(vec2 uv, float time) {
          vec3 caustic = vec3(0.0);

          // Red channel (shift for chromatic aberration)
          vec2 uvR = uv + vec2(chromaticAberration, chromaticAberration * 0.5);
          float weight = 1.0;
          for (int i = 0; i < 5; i++) { // 5 octaves for more complex patterns
            float octaveScale = scale * pow(1.6, float(i)); // Finer spacing for more detail
            vec3 v = voronoiImproved(uvR * octaveScale + time * speed * 0.35, time);
            caustic.r += v.x * weight;
            weight *= 0.55; // Slower falloff for more visible higher frequencies
          }

          // Green channel (center, slight time offset for animation richness)
          vec2 uvG = uv;
          weight = 1.0;
          for (int i = 0; i < 5; i++) {
            float octaveScale = scale * pow(1.6, float(i));
            vec3 v = voronoiImproved(uvG * octaveScale + time * speed * 0.30, time + 0.3);
            caustic.g += v.x * weight;
            weight *= 0.55;
          }

          // Blue channel (opposite shift, different time offset)
          vec2 uvB = uv - vec2(chromaticAberration, chromaticAberration * 0.5);
          weight = 1.0;
          for (int i = 0; i < 5; i++) {
            float octaveScale = scale * pow(1.6, float(i));
            vec3 v = voronoiImproved(uvB * octaveScale + time * speed * 0.25, time + 0.6);
            caustic.b += v.x * weight;
            weight *= 0.55;
          }

          // Normalize and enhance with better contrast
          caustic = pow(caustic * 0.45, vec3(1.3)) * 3.5;

          return caustic;
        }
        
        void main() {
          // Calculate caustics with water height map integration
          vec2 uv1 = vWorldPosition.xz * 0.07; // Slightly larger patterns
          vec2 uv2 = vWorldPosition.xz * 0.07 + vec2(0.5, 0.5);
          vec2 uv3 = vWorldPosition.xz * 0.12 + vec2(0.25, 0.75); // Third layer for complexity

          // Sample real FFT height (world XZ → ocean UV) so dapples track waves
          float waterDisplacement = 0.0;
          float crestBoost = 1.0;
          if (hasWaterHeight > 0.5) {
            vec2 oceanUv = vWorldPosition.xz / max(oceanSize, 1.0) + 0.5;
            float h = texture2D(waterHeightMap, oceanUv).r;
            // Finite difference for surface slope → lens focusing
            float texel = 1.0 / 128.0;
            float hx = texture2D(waterHeightMap, oceanUv + vec2(texel, 0.0)).r
                     - texture2D(waterHeightMap, oceanUv - vec2(texel, 0.0)).r;
            float hz = texture2D(waterHeightMap, oceanUv + vec2(0.0, texel)).r
                     - texture2D(waterHeightMap, oceanUv - vec2(0.0, texel)).r;
            waterDisplacement = h * 0.35 + length(vec2(hx, hz)) * 0.8;
            crestBoost = 0.85 + 0.45 * smoothstep(-0.5, 1.5, h);
          }

          // Domain-warp the sampling space so the voronoi lattice stops aligning to the
          // world axes — that axis-aligned regularity was the "tiled grid" read on the
          // seabed. A low-frequency swirl bends the cells into organic caustic filaments.
          vec2 wp = vWorldPosition.xz;
          vec2 swirl = vec2(
            sin(wp.y * 0.11 + time * 0.13) + 0.6 * sin(wp.x * 0.05 - time * 0.07),
            cos(wp.x * 0.11 - time * 0.10) + 0.6 * cos(wp.y * 0.05 + time * 0.06)
          );

          // Modulate caustics by water surface with more displacement influence
          vec2 displacedUv1 = uv1 + waterDisplacement * 0.28 + swirl * 0.9;
          vec2 displacedUv2 = uv2 + waterDisplacement * 0.22 + swirl * 0.75;
          vec2 displacedUv3 = uv3 + waterDisplacement * 0.16 + swirl * 0.6;

          vec3 caustics1 = causticsChromatic(displacedUv1, time);
          vec3 caustics2 = causticsChromatic(displacedUv2, time + 1.5);
          vec3 caustics3 = causticsChromatic(displacedUv3, time + 3.0);

          // Combine three caustics layers for more complex patterns
          vec3 causticsColor = max(caustics1, max(caustics2 * 0.65, caustics3 * 0.4));
          causticsColor *= crestBoost;

          // Apply color tint (slight blue-green for underwater)
          vec3 tint = vec3(0.75, 0.95, 1.0);
          causticsColor *= tint * intensity;

          // Enhanced depth-based fading - stronger near surface, fading with depth
          // Using exponential falloff that's intense at surface and diminishes smoothly
          float depth = abs(vWorldPosition.y - surfaceY);
          float normalizedDepth = clamp(depth / maxDepth, 0.0, 1.0);

          // Caustics are strongest in top 10m, then fade exponentially
          float shallowBoost = smoothstep(15.0, 0.0, depth) * 0.5 + 0.5; // Extra bright near surface
          float depthFade = exp(-normalizedDepth * 1.2) * shallowBoost;
          causticsColor *= depthFade;

          // Sun direction influence (caustics follow light direction)
          vec3 lightDir = normalize(sunDirection);
          float sunInfluence = max(dot(vNormal, lightDir), 0.0);
          causticsColor *= (0.4 + 0.6 * sunInfluence);

          // Surface angle attenuation - gentler falloff
          float angleFade = max(dot(vNormal, vec3(0, 1, 0)), 0.0);
          causticsColor *= pow(angleFade, 0.4);

          // Calculate alpha with better falloff - preserve more caustic visibility
          float alpha = max(max(causticsColor.r, causticsColor.g), causticsColor.b);
          alpha = pow(alpha, 0.7) * 0.95;

          gl_FragColor = vec4(causticsColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }
  
  private createCausticsPlane(): THREE.Mesh {
    // Large additive plane just above the seabed. Follows the camera on XZ in update()
    // so dapples never end at a hard 400m edge while swimming.
    const geometry = new THREE.PlaneGeometry(280, 280, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -29.45, 0);

    return new THREE.Mesh(geometry, this.causticsMaterial);
  }
  
  /**
   * Bind FFT ocean height so caustic filaments track real wave motion.
   */
  public setWaterHeightMap(texture: THREE.Texture | null, oceanSize: number = 1200): void {
    this.waterHeightTexture = texture ?? undefined;
    this.causticsMaterial.uniforms.waterHeightMap.value = texture;
    this.causticsMaterial.uniforms.hasWaterHeight.value = texture ? 1.0 : 0.0;
    this.causticsMaterial.uniforms.oceanSize.value = oceanSize;
  }

  /**
   * Sync caustic sun direction with the scene sun.
   */
  public setSunDirection(dir: THREE.Vector3): void {
    this.causticsMaterial.uniforms.sunDirection.value.copy(dir).normalize();
  }

  /**
   * Update caustics animation. Pass camera so the dapple plane tracks the player.
   */
  public update(deltaTime: number, camera?: THREE.Camera): void {
    this.time += deltaTime;
    this.causticsMaterial.uniforms.time.value = this.time;
    if (camera) {
      this.causticsPlane.position.x = camera.position.x;
      this.causticsPlane.position.z = camera.position.z;
    }
  }
  
  /**
   * Set caustics intensity
   */
  public setIntensity(intensity: number): void {
    this.causticsMaterial.uniforms.intensity.value = intensity;
  }
  
  /**
   * Set caustics scale
   */
  public setScale(scale: number): void {
    this.causticsMaterial.uniforms.scale.value = scale;
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    this.causticsMaterial.dispose();
    this.causticsPlane.geometry.dispose();
    this.scene.remove(this.causticsPlane);
  }
}

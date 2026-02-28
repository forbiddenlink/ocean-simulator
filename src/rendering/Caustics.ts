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
  private causticsTexture: THREE.WebGLRenderTarget;
  private causticsMaterial: THREE.ShaderMaterial;
  private causticsPlane: THREE.Mesh;
  private time: number = 0;
  private scene: THREE.Scene;
  private waterHeightTexture?: THREE.Texture;

  constructor(scene: THREE.Scene, _renderer: THREE.WebGLRenderer, waterHeightTexture?: THREE.Texture) {
    this.scene = scene;
    this.waterHeightTexture = waterHeightTexture;
    
    this.causticsTexture = new THREE.WebGLRenderTarget(2048, 2048, { // Increased resolution
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    
    this.causticsMaterial = this.createCausticsMaterial();
    this.causticsPlane = this.createCausticsPlane();
    
    // Add caustics to scene
    scene.add(this.causticsPlane);
  }
  
  private createCausticsMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0.85 }, // Stronger caustics for dramatic effect
        scale: { value: 22.0 }, // Slightly larger patterns for visibility
        speed: { value: 0.5 }, // Slower, more natural animation
        causticsTex: { value: null },
        waterHeightMap: { value: this.waterHeightTexture || null },
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

          // Sample water surface displacement
          float waterDisplacement = texture2D(waterHeightMap, uv1 * 0.5).r;

          // Modulate caustics by water surface with more displacement influence
          vec2 displacedUv1 = uv1 + waterDisplacement * 0.15;
          vec2 displacedUv2 = uv2 + waterDisplacement * 0.12;
          vec2 displacedUv3 = uv3 + waterDisplacement * 0.08;

          vec3 caustics1 = causticsChromatic(displacedUv1, time);
          vec3 caustics2 = causticsChromatic(displacedUv2, time + 1.5);
          vec3 caustics3 = causticsChromatic(displacedUv3, time + 3.0);

          // Combine three caustics layers for more complex patterns
          vec3 causticsColor = max(caustics1, max(caustics2 * 0.65, caustics3 * 0.4));

          // Apply color tint (slight blue-green for underwater)
          vec3 tint = vec3(0.75, 0.95, 1.0);
          causticsColor *= tint * intensity;

          // Enhanced depth-based fading - stronger near surface, fading with depth
          // Using exponential falloff that's intense at surface and diminishes smoothly
          float depth = abs(vWorldPosition.y - surfaceY);
          float normalizedDepth = clamp(depth / maxDepth, 0.0, 1.0);

          // Caustics are strongest in top 10m, then fade exponentially
          float shallowBoost = smoothstep(15.0, 0.0, depth) * 0.5 + 0.5; // Extra bright near surface
          float depthFade = exp(-normalizedDepth * 2.5) * shallowBoost;
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
    // Create a large plane to project caustics onto the ocean floor
    const geometry = new THREE.PlaneGeometry(400, 400, 1, 1); // INCREASED size
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -29.5, 0); // Slightly above floor to be visible

    return new THREE.Mesh(geometry, this.causticsMaterial);
  }
  
  /**
   * Update caustics animation
   */
  public update(deltaTime: number): void {
    this.time += deltaTime;
    this.causticsMaterial.uniforms.time.value = this.time;
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
    this.causticsTexture.dispose();
    this.causticsMaterial.dispose();
    this.scene.remove(this.causticsPlane);
  }
}

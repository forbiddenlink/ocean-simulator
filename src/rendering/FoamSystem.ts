import * as THREE from 'three';

/**
 * Foam generation and rendering system
 * Generates foam at wave crests and breaking waves
 * 
 * Foam is placed where:
 * 1. Wave height exceeds threshold (crests)
 * 2. Wave steepness is high (breaking waves)
 * 3. Shore interaction (future enhancement)
 */
export class FoamSystem {
  private scene: THREE.Scene;
  private foamMaterial: THREE.ShaderMaterial;
  private foamMesh: THREE.Mesh;
  private time: number = 0;

  constructor(scene: THREE.Scene, oceanSize: number = 1000) {
    this.scene = scene;
    
    // Create foam material
    this.foamMaterial = this.createFoamMaterial();
    
    // Create foam plane (same size as ocean)
    const geometry = new THREE.PlaneGeometry(oceanSize, oceanSize, 256, 256);
    geometry.rotateX(-Math.PI / 2);
    
    this.foamMesh = new THREE.Mesh(geometry, this.foamMaterial);
    this.foamMesh.position.y = 0.05; // Slightly above water surface
    this.foamMesh.renderOrder = 1; // Render after water
    
    this.scene.add(this.foamMesh);
  }

  /**
   * Create foam shader material
   */
  private createFoamMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        foamColor: { value: new THREE.Color(0xffffff) },
        foamIntensity: { value: 0.8 },
        foamScale: { value: 15.0 },
        foamSpeed: { value: 0.5 },
        crestThreshold: { value: 0.3 }, // Height threshold for foam
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
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
        
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        
        // Hash function
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        
        // 2D noise
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
        
        // Fractal Brownian Motion
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
        
        // Foam pattern
        float foamPattern(vec2 uv, float time) {
          // Multiple layers of animated foam
          vec2 uv1 = uv + vec2(time * foamSpeed * 0.3, time * foamSpeed * 0.2);
          vec2 uv2 = uv * 1.5 - vec2(time * foamSpeed * 0.4, -time * foamSpeed * 0.3);
          vec2 uv3 = uv * 2.5 + vec2(-time * foamSpeed * 0.2, time * foamSpeed * 0.25);
          
          float foam1 = fbm(uv1);
          float foam2 = fbm(uv2);
          float foam3 = noise2D(uv3 * 3.0);
          
          // Combine layers
          float foam = (foam1 * 0.5 + foam2 * 0.3 + foam3 * 0.2);
          
          // Sharpen foam edges
          foam = smoothstep(crestThreshold, crestThreshold + 0.2, foam);
          
          return foam;
        }
        
        // Simulate wave crest detection
        // In production, this would sample the actual wave height from FFT
        float waveCrestMask(vec2 worldPos, float time) {
          // Animated wave pattern (simplified)
          vec2 wavePos1 = worldPos * 0.05 + vec2(time * 0.3, time * 0.2);
          vec2 wavePos2 = worldPos * 0.08 - vec2(time * 0.25, -time * 0.3);
          
          float wave1 = sin(wavePos1.x * 2.0 + wavePos1.y * 1.5) * 0.5 + 0.5;
          float wave2 = sin(wavePos2.x * 1.8 - wavePos2.y * 2.2) * 0.5 + 0.5;
          
          float waveHeight = (wave1 + wave2) * 0.5;
          
          // Foam appears at wave crests
          return smoothstep(0.6, 0.8, waveHeight);
        }
        
        void main() {
          vec2 foamUv = vWorldPosition.xz * foamScale * 0.01;
          
          // Generate foam pattern
          float foam = foamPattern(foamUv, time);
          
          // Apply wave crest mask
          float crestMask = waveCrestMask(vWorldPosition.xz, time);
          foam *= crestMask;
          
          // Foam color with intensity
          vec3 color = foamColor * foam * foamIntensity;
          
          // Alpha for transparency
          float alpha = foam * 0.85;
          
          // Discard pixels with very low alpha for performance
          if (alpha < 0.05) discard;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
  }

  /**
   * Update foam animation
   */
  public update(deltaTime: number): void {
    this.time += deltaTime;
    this.foamMaterial.uniforms.time.value = this.time;
  }

  /**
   * Set foam intensity
   */
  public setIntensity(intensity: number): void {
    this.foamMaterial.uniforms.foamIntensity.value = intensity;
  }

  /**
   * Set foam scale
   */
  public setScale(scale: number): void {
    this.foamMaterial.uniforms.foamScale.value = scale;
  }

  /**
   * Set crest threshold (how high waves need to be to generate foam)
   */
  public setCrestThreshold(threshold: number): void {
    this.foamMaterial.uniforms.crestThreshold.value = threshold;
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.foamMaterial.dispose();
    this.foamMesh.geometry.dispose();
    this.scene.remove(this.foamMesh);
  }
}

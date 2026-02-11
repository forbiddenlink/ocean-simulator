import * as THREE from 'three';

/**
 * Advanced volumetric fog system for underwater atmosphere
 * Creates realistic light scattering and depth-based visibility
 */
export class VolumetricFog {
  private volumetricMaterial: THREE.ShaderMaterial;
  private volumetricMesh: THREE.Mesh;
  
  constructor(scene: THREE.Scene) {
    this.volumetricMaterial = this.createVolumetricMaterial();
    this.volumetricMesh = this.createVolumetricMesh();
    
    scene.add(this.volumetricMesh);
  }
  
  private createVolumetricMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        sunPosition: { value: new THREE.Vector3(10, 20, 10) },
        cameraPos: { value: new THREE.Vector3(0, 0, 0) },
        fogColor: { value: new THREE.Color(0x0a4a6a) }, // Deeper blue fog (less white)
        fogDensity: { value: 0.0015 }, // REDUCED significantly from 0.006
        lightIntensity: { value: 0.25 }, // REDUCED from 0.7 to prevent white wash
        scatteringCoeff: { value: 0.15 }, // REDUCED from 0.35
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vViewDirection;
        varying float vDepth;
        
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vViewDirection = normalize(worldPosition.xyz - cameraPosition);
          vDepth = -worldPosition.y; // Positive depth underwater
          
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 sunPosition;
        uniform vec3 cameraPos;
        uniform vec3 fogColor;
        uniform float fogDensity;
        uniform float lightIntensity;
        uniform float scatteringCoeff;
        
        // Beer-Lambert absorption coefficients (per meter) for RGB
        const vec3 absorptionCoeff = vec3(0.45, 0.15, 0.05); // Red, Green, Blue
        
        varying vec3 vWorldPosition;
        varying vec3 vViewDirection;
        varying float vDepth;
        
        // 3D hash for volumetric noise
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        
        // 3D noise
        float noise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          
          return mix(
            mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }
        
        // Volumetric density (particles, plankton, sediment)
        float volumetricDensity(vec3 pos) {
          // Animated noise for moving particles
          vec3 p1 = pos * 0.5 + vec3(time * 0.1, -time * 0.05, time * 0.08);
          vec3 p2 = pos * 1.5 - vec3(time * 0.15, time * 0.1, -time * 0.12);
          
          float n1 = noise(p1) * 0.5;
          float n2 = noise(p2) * 0.3;
          float n3 = noise(pos * 0.2) * 0.2; // Static distribution
          
          return n1 + n2 + n3;
        }
        
        // Mie scattering phase function (simplified)
        float miePhase(float cosTheta, float g) {
          float g2 = g * g;
          float num = 1.0 - g2;
          float denom = pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5);
          return (1.0 / (4.0 * 3.14159265)) * (num / denom);
        }
        
        void main() {
          vec3 viewDir = normalize(vViewDirection);
          vec3 lightDir = normalize(sunPosition - vWorldPosition);
          
          // Ray marching for volumetric fog
          int steps = 16;
          float stepSize = 3.0;
          float accumDensity = 0.0;
          float accumLight = 0.0;
          
          for (int i = 0; i < steps; i++) {
            float t = float(i) * stepSize;
            vec3 samplePos = vWorldPosition + viewDir * t;
            
            // Sample volume density at this point
            float density = volumetricDensity(samplePos) * fogDensity;
            
            // Distance from light source affects intensity
            float distToLight = length(sunPosition - samplePos);
            float lightAtten = 1.0 / (1.0 + distToLight * 0.01);
            
            // Depth-based attenuation (darker deeper down)
            float depth = max(0.0, -samplePos.y);
            float depthAtten = exp(-depth * 0.05);
            
            // Phase function for light scattering
            float cosTheta = dot(viewDir, lightDir);
            float phase = miePhase(cosTheta, 0.76); // Forward scattering
            
            // Accumulate light and density
            accumLight += density * lightAtten * depthAtten * phase;
            accumDensity += density;
          }
          
          // Normalize
          accumLight /= float(steps);
          accumDensity /= float(steps);
          
          // Beer-Lambert law: Wavelength-dependent absorption
          // I(λ, d) = I₀(λ) * exp(-k(λ) * d)
          vec3 transmission = exp(-absorptionCoeff * vDepth);
          
          // Apply absorption to fog color
          vec3 absorbedFogColor = fogColor * transmission;
          
          // Final fog color with scattering and absorption
          vec3 scatteredLight = absorbedFogColor * lightIntensity + 
                                vec3(0.6, 0.7, 0.8) * accumLight * scatteringCoeff * transmission;
          
          // Depth-based fog density (exponential falloff)
          float depthFog = 1.0 - exp(-vDepth * fogDensity * 0.5);
          float finalAlpha = depthFog * accumDensity;
          
          // Ensure deep water is darker and bluer
          float depthDarkening = exp(-vDepth * 0.03);
          scatteredLight *= depthDarkening;
          
          gl_FragColor = vec4(scatteredLight, clamp(finalAlpha, 0.0, 0.3)); // REDUCED max alpha from 0.8 to 0.3
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.BackSide, // Render from inside
    });
  }
  
  private createVolumetricMesh(): THREE.Mesh {
    // Large box encompassing the scene
    const geometry = new THREE.BoxGeometry(400, 100, 400);
    const mesh = new THREE.Mesh(geometry, this.volumetricMaterial);
    mesh.position.set(0, -30, 0);
    return mesh;
  }
  
  /**
   * Update volumetric fog animation
   */
  update(deltaTime: number, camera: THREE.Camera): void {
    this.volumetricMaterial.uniforms.time.value += deltaTime * 0.001;
    this.volumetricMaterial.uniforms.cameraPos.value.copy(camera.position);
  }
  
  /**
   * Update sun position
   */
  updateSunPosition(position: THREE.Vector3): void {
    this.volumetricMaterial.uniforms.sunPosition.value.copy(position);
  }
  
  /**
   * Set fog parameters
   */
  setFogParameters(density: number, intensity: number): void {
    this.volumetricMaterial.uniforms.fogDensity.value = density;
    this.volumetricMaterial.uniforms.lightIntensity.value = intensity;
  }

  /**
   * Get fog density
   */
  getFogDensity(): number {
    return this.volumetricMaterial.uniforms.fogDensity.value;
  }

  /**
   * Get light intensity
   */
  getLightIntensity(): number {
    return this.volumetricMaterial.uniforms.lightIntensity.value;
  }
}

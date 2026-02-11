import * as THREE from 'three';
import { OceanSpectrum } from './OceanSpectrum';
import { MultiScaleWaves } from './MultiScaleWaves';
import { TilingPrevention } from './TilingPrevention';
import { FFT } from '../utils/FFT';

/**
 * FFT-based ocean surface renderer
 * Implements Tessendorf's FFT ocean simulation method
 * 
 * This provides photorealistic ocean waves using:
 * - Phillips spectrum for wave distribution
 * - Dispersion relation for wave evolution  
 * - Inverse FFT for height field generation
 * - Normal and displacement map computation
 * 
 * References:
 * - Tessendorf (2001) "Simulating Ocean Water"
 * - jbouny/ocean (production Three.js implementation)
 * - GPU Gems Chapter 1
 */
export class FFTOcean {
  public mesh: THREE.Mesh;
  private spectrum: OceanSpectrum;
  private multiScaleWaves: MultiScaleWaves;
  private tilingPrevention: TilingPrevention;
  private geometry: THREE.PlaneGeometry;
  private material: THREE.ShaderMaterial;
  
  // FFT data
  private resolution: number;
  private size: number;
  private heightField: Float32Array;
  private displacementX: Float32Array;
  private displacementZ: Float32Array;
  
  // Textures
  private heightTexture: THREE.DataTexture;
  private normalTexture: THREE.DataTexture;
  private displacementTexture: THREE.DataTexture;
  
  // Time
  private time: number = 0;
  
  // Config
  private choppiness: number = 2.0; // Horizontal displacement strength
  private enableMultiScale: boolean = true; // Enable Gerstner + ripple layers

  constructor(
    resolution: number = 512,
    size: number = 1000,
    windSpeed: number = 20,
    windDirection: THREE.Vector2 = new THREE.Vector2(1, 0.5),
    waveAmplitude: number = 2.0
  ) {
    this.resolution = resolution;
    this.size = size;
    
    // Create spectrum
    this.spectrum = new OceanSpectrum(
      resolution,
      size,
      windSpeed,
      windDirection,
      waveAmplitude
    );
    
    // Create multi-scale wave system
    this.multiScaleWaves = new MultiScaleWaves();
    
    // Create tiling prevention system
    this.tilingPrevention = new TilingPrevention(resolution);
    
    // Allocate FFT data arrays
    const dataSize = resolution * resolution;
    const complexDataSize = dataSize * 2;
    this.heightField = new Float32Array(complexDataSize);
    this.displacementX = new Float32Array(complexDataSize);
    this.displacementZ = new Float32Array(complexDataSize);
    
    // Create textures
    this.heightTexture = new THREE.DataTexture(
      new Float32Array(dataSize),
      resolution,
      resolution,
      THREE.RedFormat,
      THREE.FloatType
    );
    this.heightTexture.needsUpdate = true;
    
    this.normalTexture = new THREE.DataTexture(
      new Float32Array(dataSize * 4),
      resolution,
      resolution,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.normalTexture.needsUpdate = true;
    
    this.displacementTexture = new THREE.DataTexture(
      new Float32Array(dataSize * 4),
      resolution,
      resolution,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.displacementTexture.needsUpdate = true;
    
    // Create geometry - high resolution plane
    this.geometry = new THREE.PlaneGeometry(size, size, resolution - 1, resolution - 1);
    this.geometry.rotateX(-Math.PI / 2);
    
    // Create material
    this.material = this.createOceanMaterial();
    
    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.y = 0; // Sea level
    
    // Initial FFT update
    this.updateFFT(0);
  }

  /**
   * Create advanced PBR ocean shader material
   */
  private createOceanMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        heightMap: { value: this.heightTexture },
        normalMap: { value: this.normalTexture },
        displacementMap: { value: this.displacementTexture },
        
        // Water optical properties
        deepColor: { value: new THREE.Color(0x002233) },
        shallowColor: { value: new THREE.Color(0x1a8fa5) },
        waterColor: { value: new THREE.Color(0x0a6f8d) },
        
        // Fresnel
        fresnelBias: { value: 0.02 },
        fresnelScale: { value: 1.0 },
        fresnelPower: { value: 5.0 },
        
        // Lighting
        sunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
        sunColor: { value: new THREE.Color(0xffffff) },
        sunIntensity: { value: 1.5 },
        
        // Environment
        envMap: { value: null },
        envMapIntensity: { value: 1.0 },
        
        // Scale
        oceanSize: { value: this.size },
        choppiness: { value: this.choppiness },
        enableMultiScale: { value: this.enableMultiScale ? 1.0 : 0.0 },
        
        // Tiling prevention
        noiseTexture: { value: this.tilingPrevention.getNoiseTexture() },
        tilingOffset1: { value: new THREE.Vector2(0, 0) },
        tilingOffset2: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      side: THREE.DoubleSide,
      transparent: true,
    });
  }

  /**
   * Vertex shader with FFT displacement + multi-scale waves
   */
  private getVertexShader(): string {
    const gerstnerCode = this.multiScaleWaves.getGerstnerShaderCode();
    const rippleCode = this.multiScaleWaves.getRippleNoiseShaderCode();
    
    return `
      uniform float time;
      uniform sampler2D heightMap;
      uniform sampler2D displacementMap;
      uniform sampler2D normalMap;
      uniform float oceanSize;
      uniform float choppiness;
      uniform float enableMultiScale;
      
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewDirection;
      varying float vHeight;
      
      ${gerstnerCode}
      ${rippleCode}
      
      void main() {
        vUv = uv;
        
        // Sample FFT height and displacement (large waves)
        float height = texture2D(heightMap, uv).r;
        vec3 displacement = texture2D(displacementMap, uv).rgb;
        
        // Apply FFT displacement (choppy waves)
        vec3 displacedPosition = position;
        displacedPosition.y += height;
        displacedPosition.x += displacement.x * choppiness;
        displacedPosition.z += displacement.z * choppiness;
        
        // Add multi-scale detail if enabled
        if (enableMultiScale > 0.5) {
          // Add medium-scale Gerstner waves
          vec3 gerstnerOffset = applyGerstnerWaves(displacedPosition, time);
          displacedPosition += gerstnerOffset;
          
          // Add small-scale ripples
          float rippleHeight = applyRippleNoise(displacedPosition, time);
          displacedPosition.y += rippleHeight;
        }
        
        // Sample normal from FFT (we'll enhance this later with detail normals)
        vNormal = texture2D(normalMap, uv).rgb * 2.0 - 1.0;
        vNormal = normalize(normalMatrix * vNormal);
        
        // World position
        vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
        vWorldPosition = worldPosition.xyz;
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        vHeight = displacedPosition.y;
        
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `;
  }

  /**
   * Fragment shader with advanced PBR water
   */
  private getFragmentShader(): string {
    return `
      uniform vec3 deepColor;
      uniform vec3 shallowColor;
      uniform vec3 waterColor;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      uniform float sunIntensity;
      uniform float fresnelBias;
      uniform float fresnelScale;
      uniform float fresnelPower;
      uniform float time;
      
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewDirection;
      varying float vHeight;
      
      // Constants for physical accuracy
      const float IOR_WATER = 1.333;  // Index of refraction for water
      const float IOR_AIR = 1.0;
      const vec3 ABSORPTION_COEFF = vec3(0.45, 0.15, 0.05); // R, G, B per meter
      
      // Fresnel-Schlick approximation (physically accurate)
      float fresnelSchlick(float cosTheta, float F0) {
        return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
      }
      
      // Fresnel for water (dielectric)
      float fresnelWater(vec3 viewDir, vec3 normal) {
        float F0 = pow((IOR_AIR - IOR_WATER) / (IOR_AIR + IOR_WATER), 2.0);
        float cosTheta = max(dot(viewDir, normal), 0.0);
        return fresnelSchlick(cosTheta, F0);
      }
      
      // GGX/Trowbridge-Reitz normal distribution function
      float distributionGGX(vec3 N, vec3 H, float roughness) {
        float a = roughness * roughness;
        float a2 = a * a;
        float NdotH = max(dot(N, H), 0.0);
        float NdotH2 = NdotH * NdotH;
        
        float nom = a2;
        float denom = (NdotH2 * (a2 - 1.0) + 1.0);
        denom = 3.14159265 * denom * denom;
        
        return nom / max(denom, 0.0001);
      }
      
      // Smith's method with Schlick-GGX
      float geometrySchlickGGX(float NdotV, float roughness) {
        float r = (roughness + 1.0);
        float k = (r * r) / 8.0;
        
        float nom = NdotV;
        float denom = NdotV * (1.0 - k) + k;
        
        return nom / denom;
      }
      
      float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
        float NdotV = max(dot(N, V), 0.0);
        float NdotL = max(dot(N, L), 0.0);
        float ggx2 = geometrySchlickGGX(NdotV, roughness);
        float ggx1 = geometrySchlickGGX(NdotL, roughness);
        
        return ggx1 * ggx2;
      }
      
      // Subsurface scattering approximation
      vec3 subsurfaceScattering(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 color) {
        float scatter = pow(max(0.0, dot(viewDir, -lightDir)), 4.0);
        float thickness = 0.5; // Approximation
        return color * scatter * thickness;
      }
      
      // Beer-Lambert law for light absorption with depth
      vec3 applyAbsorption(vec3 color, float depth) {
        depth = max(depth, 0.0);
        vec3 transmission = exp(-ABSORPTION_COEFF * depth);
        return color * transmission;
      }
      
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDirection);
        vec3 L = normalize(sunDirection);
        vec3 H = normalize(V + L);
        
        // Roughness varies with wave height (calm = smooth, rough = choppy)
        float waveRoughness = 0.02 + abs(vHeight) * 0.05;
        waveRoughness = clamp(waveRoughness, 0.01, 0.3);
        
        // Physically accurate Fresnel
        float fresnel = fresnelWater(V, N);
        
        // Cook-Torrance BRDF
        float NDF = distributionGGX(N, H, waveRoughness);
        float G = geometrySmith(N, V, L, waveRoughness);
        
        vec3 nominator = vec3(NDF * G * fresnel);
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
        vec3 specular = nominator / max(denominator, 0.001);
        
        // Diffuse component (Lambert)
        float NdotL = max(dot(N, L), 0.0);
        
        // Water color based on depth
        float depth = abs(vHeight) + 2.0; // Approximate depth
        vec3 baseColor = mix(shallowColor, deepColor, smoothstep(0.0, 10.0, depth));
        
        // Apply Beer-Lambert absorption
        vec3 absorbedColor = applyAbsorption(baseColor, depth);
        
        // Diffuse lighting with water color
        vec3 diffuse = absorbedColor * waterColor * (0.2 + 0.8 * NdotL);
        
        // Subsurface scattering (for thin/shallow areas)
        vec3 sss = subsurfaceScattering(L, V, N, shallowColor) * 0.3;
        
        // Specular reflection
        vec3 specColor = sunColor * specular * sunIntensity;
        
        // Sky reflection approximation (would use environment map in production)
        vec3 skyColor = mix(vec3(0.5, 0.7, 0.9), vec3(0.1, 0.3, 0.6), abs(N.y));
        vec3 reflection = skyColor * fresnel;
        
        // Combine all components
        vec3 finalColor = diffuse + specColor + sss + reflection * 0.5;
        
        // Apply atmospheric perspective for distant water
        float distance = length(vWorldPosition - cameraPosition);
        float fogFactor = exp(-distance * 0.001);
        vec3 fogColor = vec3(0.5, 0.7, 0.85);
        finalColor = mix(fogColor, finalColor, fogFactor);
        
        // Alpha based on Fresnel and depth
        float alpha = mix(0.8, 0.98, fresnel);
        alpha = mix(alpha, 0.95, smoothstep(0.0, 5.0, depth));
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `;
  }

  /**
   * Update FFT simulation
   */
  public update(deltaTime: number): void {
    this.time += deltaTime;
    
    // Update multi-scale wave system
    this.multiScaleWaves.update(deltaTime);
    
    // Update tiling prevention offsets
    const offsets = this.tilingPrevention.getAnimatedOffsets(this.time);
    this.material.uniforms.tilingOffset1.value.copy(offsets.offset1);
    this.material.uniforms.tilingOffset2.value.copy(offsets.offset2);
    
    // Update FFT at lower rate for performance (30 FPS is enough)
    if (Math.floor(this.time * 30) !== Math.floor((this.time - deltaTime) * 30)) {
      this.updateFFT(this.time);
    }
    
    // Update shader time
    this.material.uniforms.time.value = this.time;
  }

  /**
   * Compute FFT and update textures
   */
  private updateFFT(time: number): void {
    
    // Evaluate spectrum at current time
    this.spectrum.evaluateSpectrum(time, this.heightField);
    
    // Compute displacement (choppy waves)
    this.computeDisplacement();
    
    // Perform inverse FFT to get spatial domain
    this.performIFFT(this.heightField);
    
    // Update height texture
    this.updateHeightTexture();
    
    // Compute normals from height field
    this.computeNormals();
    
    // Update displacement texture
    this.updateDisplacementTexture();
  }

  /**
   * Compute horizontal displacement for choppy waves
   */
  private computeDisplacement(): void {
    const N = this.resolution;
    const L = this.size;
    
    for (let m = 0; m < N; m++) {
      for (let n = 0; n < N; n++) {
        const index = m * N + n;
        const dataIndex = index * 2;
        
        // Wave vector k
        const kx = (2.0 * Math.PI * (n - N / 2)) / L;
        const ky = (2.0 * Math.PI * (m - N / 2)) / L;
        const k_length = Math.sqrt(kx * kx + ky * ky);
        
        if (k_length < 0.0001) {
          this.displacementX[dataIndex] = 0;
          this.displacementX[dataIndex + 1] = 0;
          this.displacementZ[dataIndex] = 0;
          this.displacementZ[dataIndex + 1] = 0;
          continue;
        }
        
        // h(k,t) - complex height
        const h_real = this.heightField[dataIndex];
        const h_imag = this.heightField[dataIndex + 1];
        
        // Displacement in X: -i * (kx/|k|) * h(k,t)
        this.displacementX[dataIndex] = -(-h_imag) * (kx / k_length);
        this.displacementX[dataIndex + 1] = -(h_real) * (kx / k_length);
        
        // Displacement in Z: -i * (ky/|k|) * h(k,t)
        this.displacementZ[dataIndex] = -(-h_imag) * (ky / k_length);
        this.displacementZ[dataIndex + 1] = -(h_real) * (ky / k_length);
      }
    }
  }

  /**
   * Perform 2D inverse FFT
   */
  private performIFFT(data: Float32Array): void {
    const fft = new FFT(this.resolution);
    
    // Perform inverse FFT
    fft.ifft2D(data);
    
    // Also perform IFFT on displacement fields
    fft.ifft2D(this.displacementX);
    fft.ifft2D(this.displacementZ);
  }

  /**
   * Update height texture from FFT result
   */
  private updateHeightTexture(): void {
    const N = this.resolution;
    const data = this.heightTexture.image.data as Float32Array;
    
    for (let i = 0; i < N * N; i++) {
      // Extract real component (height)
      data[i] = this.heightField[i * 2];
    }
    
    this.heightTexture.needsUpdate = true;
  }

  /**
   * Compute normal map from height field using finite differences
   */
  private computeNormals(): void {
    const N = this.resolution;
    const L = this.size;
    const data = this.normalTexture.image.data as Float32Array;
    const heights = this.heightTexture.image.data as Float32Array;
    
    const scale = L / N; // Spatial scale
    
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const index = y * N + x;
        
        // Get neighboring heights (with wrapping)
        const hL = heights[y * N + ((x - 1 + N) % N)];
        const hR = heights[y * N + ((x + 1) % N)];
        const hD = heights[((y - 1 + N) % N) * N + x];
        const hU = heights[((y + 1) % N) * N + x];
        
        // Finite difference gradients
        const dx = (hR - hL) / (2.0 * scale);
        const dy = (hU - hD) / (2.0 * scale);
        
        // Normal vector: (-dx, 1, -dy)
        const normal = new THREE.Vector3(-dx, 1.0, -dy).normalize();
        
        // Store as RGBA (map [-1,1] to [0,1])
        data[index * 4 + 0] = normal.x * 0.5 + 0.5;
        data[index * 4 + 1] = normal.y * 0.5 + 0.5;
        data[index * 4 + 2] = normal.z * 0.5 + 0.5;
        data[index * 4 + 3] = 1.0;
      }
    }
    
    this.normalTexture.needsUpdate = true;
  }

  /**
   * Update displacement texture
   */
  private updateDisplacementTexture(): void {
    const N = this.resolution;
    const data = this.displacementTexture.image.data as Float32Array;
    
    for (let i = 0; i < N * N; i++) {
      // Extract real components - now using RGBA format
      data[i * 4 + 0] = this.displacementX[i * 2];
      data[i * 4 + 1] = 0; // Y displacement is handled by height
      data[i * 4 + 2] = this.displacementZ[i * 2];
      data[i * 4 + 3] = 1.0;
    }
    
    this.displacementTexture.needsUpdate = true;
  }

  /**
   * Set choppiness (horizontal displacement strength)
   */
  public setChoppiness(choppiness: number): void {
    this.choppiness = choppiness;
    this.material.uniforms.choppiness.value = choppiness;
  }

  /**
   * Update sun direction
   */
  public updateSunDirection(direction: THREE.Vector3): void {
    this.material.uniforms.sunDirection.value.copy(direction).normalize();
  }

  /**
   * Update wind parameters
   */
  public setWind(speed: number, direction: THREE.Vector2): void {
    this.spectrum.setWind(speed, direction);
    this.updateFFT(this.time);
  }

  /**
   * Set wind speed only (keeps current direction)
   */
  public setWindSpeed(speed: number): void {
    const currentDirection = this.spectrum.getWindDirection();
    this.spectrum.setWind(speed, currentDirection);
    this.updateFFT(this.time);
  }

  /**
   * Set ocean size (requires regeneration)
   */
  public setSize(newSize: number): void {
    this.size = newSize;
    this.material.uniforms.size.value = newSize;
    // Regenerate spectrum with new size
    this.updateFFT(this.time);
  }

  /**
   * Set FFT resolution (requires regeneration)
   */
  public setResolution(newResolution: number): void {
    // Store current state
    const oldResolution = this.resolution;
    this.resolution = newResolution;
    
    // Recreate geometry with new resolution
    this.geometry.dispose();
    this.geometry = new THREE.PlaneGeometry(this.size, this.size, newResolution - 1, newResolution - 1);
    this.geometry.rotateX(-Math.PI / 2);
    this.mesh.geometry = this.geometry;
    
    // Recreate FFT data arrays
    this.heightField = new Float32Array(newResolution * newResolution);
    this.displacementX = new Float32Array(newResolution * newResolution);
    this.displacementZ = new Float32Array(newResolution * newResolution);
    
    // Recreate textures
    this.heightTexture.dispose();
    this.normalTexture.dispose();
    this.displacementTexture.dispose();
    
    this.heightTexture = new THREE.DataTexture(
      this.heightField,
      newResolution,
      newResolution,
      THREE.RedFormat,
      THREE.FloatType
    );
    this.heightTexture.needsUpdate = true;
    
    const normalData = new Float32Array(newResolution * newResolution * 4);
    this.normalTexture = new THREE.DataTexture(
      normalData,
      newResolution,
      newResolution,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.normalTexture.needsUpdate = true;
    
    const displacementData = new Float32Array(newResolution * newResolution * 4);
    this.displacementTexture = new THREE.DataTexture(
      displacementData,
      newResolution,
      newResolution,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.displacementTexture.needsUpdate = true;
    
    // Update material uniforms
    this.material.uniforms.resolution.value = newResolution;
    this.material.uniforms.heightMap.value = this.heightTexture;
    this.material.uniforms.normalMap.value = this.normalTexture;
    this.material.uniforms.displacementMap.value = this.displacementTexture;
    
    // Regenerate ocean data
    this.updateFFT(this.time);
    
    console.log(`🌊 FFT Ocean resolution updated: ${oldResolution} → ${newResolution}`);
  }

  /**
   * Set wave amplitude
   */
  public setAmplitude(amplitude: number): void {
    this.material.uniforms.amplitude.value = amplitude;
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.heightTexture.dispose();
    this.normalTexture.dispose();
    this.displacementTexture.dispose();
  }
}

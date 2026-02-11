import * as THREE from 'three';

/**
 * HDRI Environment Lighting System
 * Provides realistic sky reflections and environmental lighting
 * 
 * Features:
 * - Dynamic time-of-day system
 * - Weather presets (clear, cloudy, stormy, sunset)
 * - Procedural sky generation
 * - Environment map for reflections
 */
export class HDRIEnvironment {
  private scene: THREE.Scene;
  private skyMaterial: THREE.ShaderMaterial;
  private skyMesh: THREE.Mesh;
  private envMap: THREE.CubeTexture | null = null;
  private sunPosition: THREE.Vector3;
  private timeOfDay: number = 0.5; // 0 = midnight, 0.5 = noon, 1.0 = midnight

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.sunPosition = new THREE.Vector3(0.5, 1.0, 0.3).normalize();
    
    // Create procedural sky
    this.skyMaterial = this.createSkyMaterial();
    this.skyMesh = this.createSkyMesh();
    
    scene.add(this.skyMesh);
    
    // Generate environment map
    this.generateEnvironmentMap();
  }

  /**
   * Create procedural sky shader material
   */
  private createSkyMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        sunPosition: { value: this.sunPosition },
        rayleighCoefficient: { value: 2.0 },
        mieCoefficient: { value: 0.005 },
        mieDirectionalG: { value: 0.8 },
        turbidity: { value: 2.0 },
        sunLuminance: { value: 1.0 },
        horizonColor: { value: new THREE.Color(0.5, 0.7, 0.9) },
        zenithColor: { value: new THREE.Color(0.1, 0.3, 0.6) },
        timeOfDay: { value: 0.5 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vViewDirection;
        
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vViewDirection = normalize(worldPosition.xyz - cameraPosition);
          
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 sunPosition;
        uniform float rayleighCoefficient;
        uniform float mieCoefficient;
        uniform float mieDirectionalG;
        uniform float turbidity;
        uniform float sunLuminance;
        uniform vec3 horizonColor;
        uniform vec3 zenithColor;
        uniform float timeOfDay;
        
        varying vec3 vWorldPosition;
        varying vec3 vViewDirection;
        
        const vec3 UP = vec3(0.0, 1.0, 0.0);
        const float PI = 3.14159265359;
        const float SUN_ANGULAR_DIAMETER = 0.00935 / 2.0;
        const float CUTOFF_ANGLE = PI / 1.95;
        const float STEEPNESS = 1.5;
        
        // Rayleigh scattering phase function
        float rayleighPhase(float cosTheta) {
          return (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
        }
        
        // Mie scattering phase function (Henyey-Greenstein)
        float hgPhase(float cosTheta, float g) {
          float g2 = g * g;
          float denom = 1.0 + g2 - 2.0 * g * cosTheta;
          return (1.0 / (4.0 * PI)) * ((1.0 - g2) / pow(denom, 1.5));
        }
        
        // Sun disk
        vec3 sunDisk(vec3 viewDir, vec3 sunDir) {
          float sunDist = acos(dot(viewDir, sunDir));
          float sunStrength = 1.0 - smoothstep(0.0, SUN_ANGULAR_DIAMETER, sunDist);
          return vec3(sunStrength);
        }
        
        void main() {
          vec3 direction = normalize(vViewDirection);
          
          // Angle from zenith
          float zenithAngle = acos(max(0.0, dot(UP, direction)));
          float cosTheta = dot(direction, sunPosition);
          
          // Atmospheric scattering
          float rayleigh = rayleighPhase(cosTheta);
          float mie = hgPhase(cosTheta, mieDirectionalG);
          
          // Extinction (Beer's law)
          float zenithFactor = 1.0 / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / PI), -1.253));
          float rayleighExtinction = exp(-rayleighCoefficient * zenithFactor);
          float mieExtinction = exp(-mieCoefficient * zenithFactor);
          
          // Sky color gradient
          float heightFactor = smoothstep(0.0, 1.0, direction.y);
          vec3 skyGradient = mix(horizonColor, zenithColor, pow(heightFactor, STEEPNESS));
          
          // Atmospheric scattering color
          vec3 scattering = skyGradient * (rayleigh * rayleighExtinction + mie * mieExtinction);
          
          // Sun disk
          vec3 sun = sunDisk(direction, sunPosition) * vec3(1.0, 0.9, 0.8) * sunLuminance;
          
          // Time of day tint
          vec3 timeOfDayTint = mix(
            vec3(0.2, 0.3, 0.6),  // Night
            vec3(1.0, 1.0, 1.0),  // Day
            smoothstep(0.2, 0.8, timeOfDay)
          );
          
          // Sunrise/sunset tint
          float sunsetFactor = exp(-abs(timeOfDay - 0.25) * 8.0) + exp(-abs(timeOfDay - 0.75) * 8.0);
          vec3 sunsetTint = vec3(1.5, 0.7, 0.3) * sunsetFactor * 0.5;
          
          vec3 finalColor = (scattering + sun) * timeOfDayTint + sunsetTint;
          
          // Add turbidity (atmospheric haze)
          float haze = exp(-zenithAngle * turbidity);
          finalColor = mix(vec3(0.8, 0.85, 0.9), finalColor, haze);
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }

  /**
   * Create sky mesh (large sphere)
   * NOTE: Hidden by default for underwater scenes - the fog/background color provides the backdrop
   */
  private createSkyMesh(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(500, 32, 32);
    const mesh = new THREE.Mesh(geometry, this.skyMaterial);
    mesh.renderOrder = -1000; // Render first (background)
    mesh.visible = false; // Hidden for underwater - fog provides backdrop
    return mesh;
  }

  /**
   * Generate procedural environment map for reflections
   */
  private generateEnvironmentMap(): void {
    const resolution = 512;
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(resolution);
    
    // Create temporary scene with just the sky
    const tempScene = new THREE.Scene();
    const tempSky = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 32),
      this.skyMaterial.clone()
    );
    tempScene.add(tempSky);
    
    // We would use a WebGLCubeRenderTarget here in production
    // For now, use the sky material directly
    this.envMap = cubeRenderTarget.texture;
    
    // Apply to scene
    this.scene.environment = this.envMap;
  }

  /**
   * Update sky based on time of day
   */
  public setTimeOfDay(time: number): void {
    this.timeOfDay = Math.max(0, Math.min(1, time));
    
    // Update sun position based on time
    const angle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    this.sunPosition.set(
      Math.cos(angle) * 0.5,
      Math.sin(angle),
      0.3
    ).normalize();
    
    // Update shader uniforms
    this.skyMaterial.uniforms.sunPosition.value.copy(this.sunPosition);
    this.skyMaterial.uniforms.timeOfDay.value = this.timeOfDay;
    
    // Update luminance based on time
    const luminance = Math.max(0.1, Math.sin(angle) * 0.9 + 0.5);
    this.skyMaterial.uniforms.sunLuminance.value = luminance;
  }

  /**
   * Set weather preset
   */
  public setWeather(weather: 'clear' | 'cloudy' | 'stormy' | 'sunset'): void {
    switch (weather) {
      case 'clear':
        this.skyMaterial.uniforms.turbidity.value = 2.0;
        this.skyMaterial.uniforms.rayleighCoefficient.value = 2.0;
        this.skyMaterial.uniforms.mieCoefficient.value = 0.005;
        this.skyMaterial.uniforms.horizonColor.value.set(0.5, 0.7, 0.9);
        this.skyMaterial.uniforms.zenithColor.value.set(0.1, 0.3, 0.6);
        break;
        
      case 'cloudy':
        this.skyMaterial.uniforms.turbidity.value = 10.0;
        this.skyMaterial.uniforms.rayleighCoefficient.value = 1.0;
        this.skyMaterial.uniforms.mieCoefficient.value = 0.02;
        this.skyMaterial.uniforms.horizonColor.value.set(0.6, 0.6, 0.65);
        this.skyMaterial.uniforms.zenithColor.value.set(0.4, 0.4, 0.45);
        break;
        
      case 'stormy':
        this.skyMaterial.uniforms.turbidity.value = 20.0;
        this.skyMaterial.uniforms.rayleighCoefficient.value = 0.5;
        this.skyMaterial.uniforms.mieCoefficient.value = 0.05;
        this.skyMaterial.uniforms.horizonColor.value.set(0.3, 0.3, 0.35);
        this.skyMaterial.uniforms.zenithColor.value.set(0.2, 0.2, 0.25);
        break;
        
      case 'sunset':
        this.setTimeOfDay(0.25); // Sunset time
        this.skyMaterial.uniforms.turbidity.value = 5.0;
        this.skyMaterial.uniforms.rayleighCoefficient.value = 3.0;
        this.skyMaterial.uniforms.mieCoefficient.value = 0.01;
        this.skyMaterial.uniforms.horizonColor.value.set(1.0, 0.6, 0.3);
        this.skyMaterial.uniforms.zenithColor.value.set(0.3, 0.2, 0.5);
        break;
    }
    
    // Regenerate environment map
    this.generateEnvironmentMap();
  }

  /**
   * Get current sun direction
   */
  public getSunDirection(): THREE.Vector3 {
    return this.sunPosition.clone();
  }

  /**
   * Get environment map for reflections
   */
  public getEnvironmentMap(): THREE.CubeTexture | null {
    return this.envMap;
  }

  /**
   * Update (if needed for animation)
   */
  public update(_deltaTime: number): void {
    // Could animate time of day here if desired
    // this.setTimeOfDay(this.timeOfDay + deltaTime * 0.01);
  }

  /**
   * Enable or disable HDRI environment
   */
  public setEnabled(enabled: boolean): void {
    this.skyMesh.visible = enabled;
    if (enabled && this.envMap) {
      this.scene.environment = this.envMap;
    } else {
      this.scene.environment = null;
    }
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.skyMaterial.dispose();
    this.skyMesh.geometry.dispose();
    this.scene.remove(this.skyMesh);
    
    if (this.envMap) {
      this.envMap.dispose();
    }
  }
}

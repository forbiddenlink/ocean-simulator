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
  private renderer?: THREE.WebGLRenderer;
  private skyMaterial: THREE.ShaderMaterial;
  private skyMesh: THREE.Mesh;
  private envMap: THREE.Texture | null = null;
  private envRT?: THREE.WebGLRenderTarget;
  private sunPosition: THREE.Vector3;
  private timeOfDay: number = 0.5; // 0 = midnight, 0.5 = noon, 1.0 = midnight
  private animating: boolean = true; // Enable day/night cycle animation
  private cycleSpeed: number = 0.02; // Full day/night cycle in ~50 seconds

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
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

        const float SUN_RADIUS = 0.0094;

        float hash(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }

        void main() {
          vec3 dir = normalize(vViewDirection);
          vec3 sun = normalize(sunPosition);
          // Below the horizon the sea covers the sky; reuse the horizon colour there.
          float up = clamp(dir.y, 0.0, 1.0);
          float cosSun = dot(dir, sun);

          // Daylight from the sun's height, with a short twilight as it crosses the horizon.
          float day = smoothstep(-0.12, 0.25, sun.y);

          // Gradient: a thin bright band at the horizon, the weather's zenith colour above.
          float horizonBand = pow(1.0 - up, 4.0);
          vec3 daySky = mix(zenithColor, horizonColor, horizonBand);
          vec3 nightSky = mix(vec3(0.004, 0.007, 0.018), vec3(0.02, 0.03, 0.055), horizonBand);
          vec3 color = mix(nightSky, daySky, day);

          // Haze: turbid weather greys the sky out, strongest at the horizon.
          float haze = clamp((turbidity - 2.0) / 18.0, 0.0, 1.0) * (0.4 + 0.6 * horizonBand);
          color = mix(color, vec3(0.62, 0.64, 0.67) * (0.15 + 0.85 * day), haze);

          // Sunrise and sunset: warm glow on the horizon, strongest toward the sun.
          float twilight = exp(-abs(sun.y) * 7.0);
          vec3 sunFlat = normalize(vec3(sun.x, 0.0, sun.z) + vec3(1e-4));
          float towardSun = pow(max(dot(normalize(vec3(dir.x, 0.0, dir.z) + vec3(1e-4)), sunFlat), 0.0), 3.0);
          color += vec3(1.0, 0.42, 0.14) * twilight * horizonBand * (0.25 + 0.9 * towardSun);

          // Forward scattering around the sun, then the disc itself.
          float aboveHorizon = smoothstep(-0.02, 0.02, sun.y);
          color += vec3(1.0, 0.85, 0.65) * pow(max(cosSun, 0.0), 48.0) * 0.5 * aboveHorizon * (1.0 - haze);
          float disc = 1.0 - smoothstep(SUN_RADIUS * 0.8, SUN_RADIUS, acos(clamp(cosSun, -1.0, 1.0)));
          color += vec3(1.0, 0.92, 0.8) * disc * sunLuminance * 12.0 * aboveHorizon;

          // Stars on clear nights.
          vec3 cell = floor(dir * 420.0);
          float star = step(0.9975, hash(cell)) * (0.4 + 0.6 * hash(cell + 7.0));
          color += vec3(star) * (1.0 - day) * (1.0 - haze) * smoothstep(0.02, 0.2, up);

          gl_FragColor = vec4(color, 1.0);
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
    if (!this.renderer) return; // no IBL without a renderer to prefilter with

    // Build a purpose-made UNDERWATER environment (not the bright sky, which is hidden
    // below the surface): a vertical gradient — luminous teal toward the surface/light,
    // deep navy toward the abyss. Prefiltered through PMREM so every PBR material gets
    // physically-plausible image-based lighting instead of the previous empty/black map.
    const envScene = new THREE.Scene();
    const gradGeo = new THREE.SphereGeometry(50, 32, 16);
    const gradMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0.30, 0.58, 0.68) },
        midColor: { value: new THREE.Color(0.08, 0.26, 0.34) },
        bottomColor: { value: new THREE.Color(0.02, 0.06, 0.11) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        void main() {
          float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 c = t > 0.5
            ? mix(midColor, topColor, (t - 0.5) * 2.0)
            : mix(bottomColor, midColor, t * 2.0);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    envScene.add(new THREE.Mesh(gradGeo, gradMat));

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const rt = pmrem.fromScene(envScene, 0.04);

    this.envRT?.dispose();
    this.envRT = rt;
    this.envMap = rt.texture;
    this.scene.environment = this.envMap;

    pmrem.dispose();
    gradGeo.dispose();
    gradMat.dispose();
  }

  /**
   * Shows the sky only while the camera is above the surface (under water the water
   * medium is the backdrop) and keeps it centred on the camera.
   */
  public followCamera(cameraPosition: THREE.Vector3): void {
    this.skyMesh.visible = cameraPosition.y > 0;
    this.skyMesh.position.copy(cameraPosition);
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
  public getEnvironmentMap(): THREE.Texture | null {
    return this.envMap;
  }

  /**
   * Update - animates day/night cycle
   */
  public update(deltaTime: number): void {
    if (this.animating) {
      // Animate time of day (wraps from 1 back to 0)
      const newTime = (this.timeOfDay + deltaTime * this.cycleSpeed) % 1.0;
      this.setTimeOfDay(newTime);
    }
  }

  /**
   * Enable/disable automatic day/night cycle animation
   */
  public setAnimating(animating: boolean): void {
    this.animating = animating;
  }

  /**
   * Set the speed of the day/night cycle (1.0 = full cycle per second)
   */
  public setCycleSpeed(speed: number): void {
    this.cycleSpeed = speed;
  }

  /**
   * Get current time of day (0-1, where 0.5 = noon)
   */
  public getTimeOfDay(): number {
    return this.timeOfDay;
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
    this.envRT?.dispose();
  }
}

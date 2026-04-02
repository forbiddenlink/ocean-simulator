/**
 * OceanScene Controller
 *
 * Main Three.js ocean renderer that integrates:
 * - FFT ocean surface simulation
 * - Gerstner waves for detail
 * - Foam and spray effects
 * - Underwater caustics
 * - Environmental effects (sky, sun, fog)
 */

import * as THREE from 'three';
import {
  OceanSurface,
  GerstnerWaveSystem,
  FoamCoverageMap,
  SpraySystem,
  CausticsGenerator,
  UnderwaterLighting,
  DEFAULT_OCEAN_CONFIG,
  DEFAULT_WAVE_CONFIG,
} from '../lib/fluid';

export interface OceanSceneConfig {
  /** Container element for rendering */
  container: HTMLElement;
  /** Wind speed in m/s */
  windSpeed?: number;
  /** Wind direction in degrees */
  windDirection?: number;
  /** Wave amplitude multiplier */
  waveAmplitude?: number;
  /** Foam intensity (0-2) */
  foamIntensity?: number;
  /** Enable underwater effects */
  enableUnderwater?: boolean;
  /** Time of day (0-1, 0.5 = noon) */
  timeOfDay?: number;
}

/**
 * OceanScene - Main ocean rendering controller
 */
export class OceanScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private oceanSurface: OceanSurface;
  private waveSystem: GerstnerWaveSystem;
  private foamMap: FoamCoverageMap;
  private spraySystem: SpraySystem;
  private caustics: CausticsGenerator;
  private underwaterLighting: UnderwaterLighting;
  private oceanMesh: THREE.Mesh;
  private sunLight: THREE.DirectionalLight;

  private animationId: number | null = null;
  private clock: THREE.Clock;
  private container: HTMLElement;
  private config: Required<OceanSceneConfig>;

  private boundOnResize: () => void;
  private boundAnimate: () => void;

  constructor(config: OceanSceneConfig) {
    this.container = config.container;
    this.config = {
      container: config.container,
      windSpeed: config.windSpeed ?? 20,
      windDirection: config.windDirection ?? 0,
      waveAmplitude: config.waveAmplitude ?? 2.0,
      foamIntensity: config.foamIntensity ?? 1.0,
      enableUnderwater: config.enableUnderwater ?? true,
      timeOfDay: config.timeOfDay ?? 0.5,
    };

    // Initialize Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    // Create camera
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
    this.camera.position.set(0, 10, 50);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // Create lighting
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.updateSunPosition(this.config.timeOfDay);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.scene.add(this.sunLight);

    const ambientLight = new THREE.AmbientLight(0x4488aa, 0.5);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x0a4a6b, 0.6);
    this.scene.add(hemiLight);

    // Initialize ocean systems
    const windDir = new THREE.Vector2(
      Math.cos(this.config.windDirection * Math.PI / 180),
      Math.sin(this.config.windDirection * Math.PI / 180)
    );

    this.oceanSurface = new OceanSurface({
      ...DEFAULT_OCEAN_CONFIG,
      windSpeed: this.config.windSpeed,
      windDirection: windDir,
      amplitude: this.config.waveAmplitude,
    });

    this.waveSystem = new GerstnerWaveSystem({
      ...DEFAULT_WAVE_CONFIG,
      windSpeed: this.config.windSpeed,
      windDirection: windDir,
      amplitudeScale: this.config.waveAmplitude,
    });

    this.foamMap = new FoamCoverageMap(256, 500);
    this.spraySystem = new SpraySystem(this.scene, 5000);
    this.caustics = new CausticsGenerator(this.renderer, 1024);
    this.underwaterLighting = new UnderwaterLighting({
      waterType: 'averageOcean',
      surfaceY: 0,
    });

    // Create ocean mesh
    this.oceanMesh = this.createOceanMesh();
    this.scene.add(this.oceanMesh);

    // Initialize clock
    this.clock = new THREE.Clock();

    // Bind event handlers
    this.boundOnResize = this.onResize.bind(this);
    this.boundAnimate = this.animate.bind(this);

    // Setup event listeners
    window.addEventListener('resize', this.boundOnResize);
  }

  /**
   * Create the ocean mesh with shader material
   */
  private createOceanMesh(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(1000, 1000, 256, 256);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        deepColor: { value: new THREE.Color(0x002233) },
        shallowColor: { value: new THREE.Color(0x1a8fa5) },
        waterColor: { value: new THREE.Color(0x0a6f8d) },
        sunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
        sunColor: { value: new THREE.Color(0xffffff) },
        sunIntensity: { value: 1.5 },
        foamIntensity: { value: this.config.foamIntensity },
        cameraPosition: { value: this.camera.position },
      },
      vertexShader: `
        uniform float time;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vHeight;

        void main() {
          vUv = uv;

          // Wave displacement
          vec3 pos = position;
          float wave1 = sin(pos.x * 0.05 + time) * cos(pos.z * 0.03 + time * 0.7) * 2.0;
          float wave2 = sin(pos.x * 0.1 + time * 1.3) * cos(pos.z * 0.08 + time * 0.9) * 1.0;
          float wave3 = sin(pos.x * 0.02 + pos.z * 0.03 + time * 0.5) * 3.0;
          pos.y += wave1 + wave2 + wave3;

          vHeight = pos.y;
          vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;

          // Calculate normal from wave gradients
          float dx = cos(pos.x * 0.05 + time) * 0.05 * cos(pos.z * 0.03 + time * 0.7) * 2.0
                   + cos(pos.x * 0.1 + time * 1.3) * 0.1 * cos(pos.z * 0.08 + time * 0.9) * 1.0;
          float dz = sin(pos.x * 0.05 + time) * (-sin(pos.z * 0.03 + time * 0.7)) * 0.03 * 2.0
                   + sin(pos.x * 0.1 + time * 1.3) * (-sin(pos.z * 0.08 + time * 0.9)) * 0.08 * 1.0;
          vNormal = normalize(normalMatrix * vec3(-dx, 1.0, -dz));

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 deepColor;
        uniform vec3 shallowColor;
        uniform vec3 waterColor;
        uniform vec3 sunDirection;
        uniform vec3 sunColor;
        uniform float sunIntensity;
        uniform float foamIntensity;
        uniform vec3 cameraPosition;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vHeight;

        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(cameraPosition - vWorldPosition);
          vec3 L = normalize(sunDirection);
          vec3 H = normalize(V + L);

          // Fresnel (Schlick approximation)
          float F0 = 0.02;
          float fresnel = F0 + (1.0 - F0) * pow(1.0 - max(dot(V, N), 0.0), 5.0);

          // Base color based on height
          vec3 baseColor = mix(shallowColor, deepColor, smoothstep(-2.0, 4.0, -vHeight));

          // Diffuse lighting
          float NdotL = max(dot(N, L), 0.0);
          vec3 diffuse = baseColor * (0.3 + 0.7 * NdotL);

          // Specular (Blinn-Phong)
          float spec = pow(max(dot(N, H), 0.0), 128.0) * sunIntensity;
          vec3 specular = sunColor * spec;

          // Subsurface scattering approximation
          float sss = pow(max(0.0, dot(V, -L)), 4.0) * 0.3;
          vec3 scatter = shallowColor * sss;

          // Foam at wave crests
          float foam = smoothstep(1.5, 3.0, vHeight) * foamIntensity;
          foam += smoothstep(0.8, 1.2, abs(N.x) + abs(N.z)) * 0.3 * foamIntensity;
          vec3 foamColor = vec3(0.95, 0.98, 1.0);

          // Combine all lighting
          vec3 color = diffuse + specular + scatter;
          color = mix(color, foamColor, clamp(foam, 0.0, 0.8));

          // Sky reflection
          vec3 skyColor = mix(vec3(0.3, 0.5, 0.8), vec3(0.6, 0.8, 1.0), max(N.y, 0.0));
          color = mix(color, skyColor, fresnel * 0.4);

          // Distance fog
          float dist = length(vWorldPosition - cameraPosition);
          float fogFactor = exp(-dist * 0.001);
          vec3 fogColor = vec3(0.4, 0.6, 0.8);
          color = mix(fogColor, color, fogFactor);

          gl_FragColor = vec4(color, 0.95);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Update sun position based on time of day
   */
  private updateSunPosition(timeOfDay: number): void {
    const angle = timeOfDay * Math.PI * 2 - Math.PI / 2;
    const height = Math.sin(angle) * 100;
    const distance = Math.cos(angle) * 100;
    this.sunLight.position.set(distance, Math.max(height, 10), 50);

    // Update sun intensity based on height
    const intensity = Math.max(0.2, Math.sin(angle));
    this.sunLight.intensity = intensity * 2.0;

    // Update shader uniform
    const material = this.oceanMesh.material as THREE.ShaderMaterial;
    material.uniforms.sunDirection.value.copy(this.sunLight.position).normalize();
  }

  /**
   * Handle window resize
   */
  private onResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Animation loop
   */
  private animate(): void {
    this.animationId = requestAnimationFrame(this.boundAnimate);

    const deltaTime = this.clock.getDelta();

    // Update ocean systems
    this.oceanSurface.update(deltaTime);
    this.waveSystem.update(deltaTime);
    this.foamMap.update(deltaTime, (x: number, z: number) => {
      const state = this.waveSystem.evaluate(x, z);
      return { height: state.height, breaking: state.breaking };
    });
    this.spraySystem.update(deltaTime);
    this.caustics.update(deltaTime, this.renderer);

    // Update shader uniforms
    const material = this.oceanMesh.material as THREE.ShaderMaterial;
    material.uniforms.time.value += deltaTime;
    material.uniforms.cameraPosition.value.copy(this.camera.position);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Start the animation loop
   */
  public start(): void {
    if (this.animationId === null) {
      this.clock.start();
      this.animate();
    }
  }

  /**
   * Stop the animation loop
   */
  public stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
      this.clock.stop();
    }
  }

  /**
   * Set wind parameters
   */
  public setWind(speed: number, direction: number): void {
    const dir = new THREE.Vector2(
      Math.cos(direction * Math.PI / 180),
      Math.sin(direction * Math.PI / 180)
    );
    this.oceanSurface.setWind(speed, dir);
    this.waveSystem.setWind(speed, dir);
    this.config.windSpeed = speed;
    this.config.windDirection = direction;
  }

  /**
   * Set wave amplitude
   */
  public setAmplitude(amplitude: number): void {
    this.oceanSurface.setAmplitude(amplitude);
    this.waveSystem.setAmplitudeScale(amplitude);
    this.config.waveAmplitude = amplitude;
  }

  /**
   * Set foam intensity
   */
  public setFoamIntensity(intensity: number): void {
    const material = this.oceanMesh.material as THREE.ShaderMaterial;
    material.uniforms.foamIntensity.value = intensity;
    this.config.foamIntensity = intensity;
  }

  /**
   * Set time of day (0-1, 0.5 = noon)
   */
  public setTimeOfDay(time: number): void {
    this.updateSunPosition(time);
    this.config.timeOfDay = time;
  }

  /**
   * Get wave height at position
   */
  public getWaveHeightAt(x: number, z: number): number {
    return this.waveSystem.evaluate(x, z).height;
  }

  /**
   * Check if position is underwater
   */
  public isUnderwater(position: THREE.Vector3): boolean {
    const height = this.getWaveHeightAt(position.x, position.z);
    return position.y < height;
  }

  /**
   * Get underwater lighting calculator
   */
  public getUnderwaterLighting(): UnderwaterLighting {
    return this.underwaterLighting;
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.stop();

    window.removeEventListener('resize', this.boundOnResize);

    this.foamMap.dispose();
    this.spraySystem.dispose();
    this.caustics.dispose();
    this.oceanMesh.geometry.dispose();
    (this.oceanMesh.material as THREE.Material).dispose();
    this.renderer.dispose();

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

export default OceanScene;

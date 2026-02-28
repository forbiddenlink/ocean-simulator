import * as THREE from 'three';
import { HighFidelityWater } from './HighFidelityWater';
import { FFTOcean } from './FFTOcean';
import { WavelengthLighting } from './WavelengthLighting';
import { PostProcessingPipeline } from './PostProcessingPipeline';
import { RealisticOceanFloor } from './RealisticOceanFloor';
import { UnderwaterParticles, BubbleSystem } from './UnderwaterParticles';
import { CausticsEffect } from './Caustics';
import { BioluminescenceSystem } from './Bioluminescence';
import { VolumetricFog } from './VolumetricFog';
import { GodRaysEffect } from './GodRays';
import { CoralFormations } from './CoralFormations';
import { SeaAnemones } from './SeaAnemones';
import { MarineLife } from './MarineLife';
import { KelpForest } from './KelpForest';
import { FoamSystem } from './FoamSystem';
import { SprayParticles } from './SprayParticles';
import { HDRIEnvironment } from './HDRIEnvironment';

// Debug flag - set to true for development debugging
const DEBUG = false;

export class RenderingEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public lightSystem: WavelengthLighting; // Exposed for other systems
  public postProcessing: PostProcessingPipeline; // Post-processing pipeline
  private canvas: HTMLCanvasElement;
  private highFidelityWater?: HighFidelityWater;
  private fftOcean?: FFTOcean;
  private useFFTOcean: boolean = true; // ENABLED - FFT for photorealistic waves!
  private sunLight!: THREE.DirectionalLight;
  private particles?: UnderwaterParticles;
  private bubbles?: BubbleSystem;
  private caustics?: CausticsEffect;
  private bioluminescence?: BioluminescenceSystem;
  private volumetricFog?: VolumetricFog;
  private godRays?: GodRaysEffect;
  private realisticFloor?: THREE.Group; // Returns a Group from static method
  private anemones?: SeaAnemones;
  private marineLife?: THREE.Group; // Returns a Group from static method
  private kelpForest?: KelpForest;
  private foamSystem?: FoamSystem;
  private sprayParticles?: SprayParticles;
  private hdriEnvironment?: HDRIEnvironment;

  // Store bound event handler to properly remove listener
  private boundOnWindowResize: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x4da6c7); // Ocean blue - much clearer

    // Initialize depth-based fog for realistic underwater visibility (DISABLED - might cause white)
    // new DepthBasedFog(this.scene);

    // Initialize lighting system
    this.lightSystem = new WavelengthLighting();

    // Create camera - positioned underwater to view fish
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Position: centered in the fish swimming area so creatures surround the viewer
    this.camera.position.set(0, -12, 0);
    this.camera.lookAt(0, -12, -10);

    // Create renderer with WebGL2
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Disable renderer tone mapping - PostProcessingPipeline handles it
    // Having both causes double tone mapping which crushes darks to black
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Setup lights first so we have the sun for the water
    this.setupLights();

    // Add realistic ocean floor
    this.realisticFloor = RealisticOceanFloor.createDetailedFloor(this.scene, -30);

    // Add seagrass and kelp
    this.kelpForest = new KelpForest(this.scene, -30, 60);

    // Add coral formations
    CoralFormations.createCoralReef(this.scene, -30, 80);

    // Add sea anemones
    this.anemones = new SeaAnemones(this.scene, -30, 40);

    // Add marine life decorations
    this.marineLife = MarineLife.createMarineCreatures(this.scene, -30, 120);

    // Add Water Surface - choose between FFT ocean (photorealistic) or basic water
    if (this.useFFTOcean) {
      this.fftOcean = new FFTOcean(
        512, // Resolution for detail
        1200, // Larger ocean size for expansive feel
        28, // Wind speed for dynamic waves
        new THREE.Vector2(1, 0.3), // wind direction
        2.5 // Wave amplitude
      );
      this.fftOcean.mesh.position.y = 0; // Sea level
      this.scene.add(this.fftOcean.mesh);

      // Add foam and spray for FFT ocean
      this.foamSystem = new FoamSystem(this.scene, 1500);
      this.sprayParticles = new SprayParticles(this.scene, 2000);
    } else {
      this.highFidelityWater = new HighFidelityWater(this.scene, this.sunLight);
      this.scene.add(this.highFidelityWater.mesh);
    }

    // Add underwater particles and bubbles
    this.particles = new UnderwaterParticles(this.scene);
    this.bubbles = new BubbleSystem(this.scene);

    // Add caustics
    this.caustics = new CausticsEffect(this.scene, this.renderer);

    // Add bioluminescence
    this.bioluminescence = new BioluminescenceSystem(this.scene);

    // Add HDRI environment
    this.hdriEnvironment = new HDRIEnvironment(this.scene);

    // Apply initial lighting state
    this.lightSystem.applyToSceneFog(this.scene, this.camera.position.y);

    // Initialize post-processing pipeline
    this.postProcessing = new PostProcessingPipeline(this.renderer, this.scene, this.camera);

    if (DEBUG) console.log('✨ PHOTOREALISTIC OCEAN LOADED - All features active!');

    // Handle window resize - store bound reference for proper cleanup
    this.boundOnWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.boundOnWindowResize);
  }

  // setupEnvironment method removed - all setup now in constructor

  private setupLights(): void {
    // Directional light (sun from above) - dramatic underwater sunlight
    // Enhanced for god rays and visible light shafts
    this.sunLight = new THREE.DirectionalLight(0xaaddee, 2.2); // Brighter, cleaner underwater light
    this.sunLight.position.set(10, 50, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 500;
    this.scene.add(this.sunLight);

    // Ambient light - balanced for realism with creature visibility
    const ambientLight = new THREE.AmbientLight(0x5588aa, 1.2);
    this.scene.add(ambientLight);

    // Hemisphere light - natural gradient from surface to depth
    const hemiLight = new THREE.HemisphereLight(
      0xaaccee, // Sky color (bright cyan-white from surface)
      0x223344, // Ground color (dark blue from depth)
      1.2
    );
    this.scene.add(hemiLight);

    // Subtle fill light from below - simulates bioluminescence and floor bounce
    const fillLight = new THREE.DirectionalLight(0x224455, 0.4);
    fillLight.position.set(0, -30, 0);
    this.scene.add(fillLight);

    // Camera-attached fill light - subtle for nearby creature visibility
    const cameraFillLight = new THREE.PointLight(0x6688aa, 0.5);
    cameraFillLight.distance = 30; // Limited range for realism
    cameraFillLight.decay = 2;
    this.camera.add(cameraFillLight);
    this.scene.add(this.camera);

    console.log('💡 Underwater lighting configured - blue-tinted for 30m depth');
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.postProcessing.setSize(window.innerWidth, window.innerHeight);
  }

  public render(): void {
    // Use post-processing for bloom and effects
    this.postProcessing.render();
  }

  public update(deltaTime: number): void {
    // Update water surface
    if (this.fftOcean) {
      this.fftOcean.update(deltaTime);
    } else if (this.highFidelityWater) {
      this.highFidelityWater.update(deltaTime);
    }

    // Update particles and bubbles (if enabled)
    if (this.particles) {
      this.particles.update(deltaTime, this.camera.position);
    }
    if (this.bubbles) {
      this.bubbles.update(deltaTime);
    }
    
    // Update advanced visual effects (if enabled)
    if (this.caustics) {
      this.caustics.update(deltaTime);
    }
    // Update god rays (improved version to avoid vine-like patterns)
    if (this.godRays) {
      this.godRays.update(deltaTime);
    }
    if (this.volumetricFog) {
      this.volumetricFog.update(deltaTime, this.camera);
    }
    
    // Update foam and spray
    if (this.foamSystem) {
      this.foamSystem.update(deltaTime);
    }
    if (this.sprayParticles) {
      this.sprayParticles.update(deltaTime);
    }
    
    // Update kelpForest if enabled
    if (this.kelpForest) {
      this.kelpForest.update(deltaTime);
    }
    
    // Update anemones (has instance update method)
    if (this.anemones) {
      this.anemones.update(deltaTime);
    }
    
    // Animate marine life (uses static method)
    if (this.marineLife) {
      MarineLife.animateCreatures(this.marineLife, deltaTime);
    }
    
    // Update bioluminescence
    if (this.bioluminescence) {
      this.bioluminescence.update(deltaTime, this.camera.position);
    }
    
    // Update HDRI environment and day/night cycle
    if (this.hdriEnvironment) {
      this.hdriEnvironment.update(deltaTime);

      // Get time of day for lighting adjustments
      const timeOfDay = this.hdriEnvironment.getTimeOfDay();

      // Update sun direction in other systems
      const sunDir = this.hdriEnvironment.getSunDirection();
      if (this.fftOcean) {
        this.fftOcean.updateSunDirection(sunDir);
      }

      // Day/night lighting: sun intensity and color
      // timeOfDay: 0 = midnight, 0.5 = noon, 1.0 = midnight
      const sunAngle = Math.sin(timeOfDay * Math.PI); // 0 at night, 1 at noon
      const sunIntensity = Math.max(0.1, sunAngle * 2.2); // Dim at night, bright at noon

      // Sun color: warm at dawn/dusk, cool at noon
      const dawnDuskFactor = Math.exp(-Math.pow((timeOfDay - 0.25) * 4, 2)) +
                             Math.exp(-Math.pow((timeOfDay - 0.75) * 4, 2));
      const sunR = 0.7 + 0.3 * dawnDuskFactor; // More red at dawn/dusk
      const sunG = 0.85 - 0.15 * dawnDuskFactor;
      const sunB = 0.9 - 0.3 * dawnDuskFactor;
      this.sunLight.color.setRGB(sunR, sunG, sunB);
      this.sunLight.intensity = sunIntensity;

      // Update sun position
      this.sunLight.position.copy(sunDir.multiplyScalar(50));

      // Bioluminescence: brighter at night
      if (this.bioluminescence) {
        const nightFactor = 1.0 - sunAngle; // 0 at noon, 1 at midnight
        const bioIntensity = 0.5 + nightFactor * 2.0; // 0.5 at noon, 2.5 at midnight
        this.bioluminescence.setIntensity(bioIntensity);
      }
    }
    
    // Update realistic floor (uses static method)
    if (this.realisticFloor) {
      const sandFloor = this.realisticFloor.children.find(
        (child) => child.name === 'sandFloor'
      ) as THREE.Mesh | undefined;
      
      if (sandFloor) {
        RealisticOceanFloor.update(sandFloor, deltaTime);
      }
    }

    // Apply wavelength-dependent lighting based on depth
    this.lightSystem.applyToSceneFog(this.scene, this.camera.position.y);

    // Update underwater color grading based on camera depth
    this.postProcessing.updateCameraDepth(this.camera.position.y);
    // Update camera parameters for spectral absorption depth buffer reading
    this.postProcessing.updateCamera(this.camera);
  }

  /**
   * Set ocean parameters
   */
  public setOceanParam(param: string, value: number | string | boolean): void {
    if (this.fftOcean) {
      switch (param) {
        case 'resolution':
          this.fftOcean.setResolution(value as number);
          break;
        case 'size':
          this.fftOcean.setSize(value as number);
          break;
        case 'windSpeed':
          this.fftOcean.setWindSpeed(value as number);
          break;
        case 'choppiness':
          this.fftOcean.setChoppiness(value as number);
          break;
        case 'amplitude':
          this.fftOcean.setAmplitude(value as number);
          break;
        case 'foamIntensity':
          if (this.foamSystem) this.foamSystem.setIntensity(value as number);
          break;
        case 'sprayDensity':
          if (this.sprayParticles) this.sprayParticles.setDensity(value as number);
          break;
        case 'causticsIntensity':
          if (this.caustics) this.caustics.setIntensity(value as number);
          break;
        case 'causticsScale':
          if (this.caustics) this.caustics.setScale(value as number);
          break;
        case 'fogDensity':
          if (this.volumetricFog) this.volumetricFog.setFogParameters(value as number, this.volumetricFog.getLightIntensity());
          break;
        case 'lightIntensity':
          if (this.volumetricFog) this.volumetricFog.setFogParameters(this.volumetricFog.getFogDensity(), value as number);
          break;
        case 'enableFFT':
          this.toggleFFTOcean(value as boolean);
          break;
        case 'timeOfDay':
          if (this.hdriEnvironment) {
            // Convert string time of day to number (0-1)
            const timeMap: Record<string, number> = {
              'dawn': 0.15,
              'morning': 0.3,
              'noon': 0.5,
              'afternoon': 0.65,
              'sunset': 0.8,
              'night': 0.0
            };
            const time = typeof value === 'string' ? timeMap[value] || 0.5 : (typeof value === 'number' ? value : 0.5);
            this.hdriEnvironment.setTimeOfDay(time);
          }
          break;
        case 'weather':
          if (this.hdriEnvironment) {
            this.hdriEnvironment.setWeather(value as 'clear' | 'cloudy' | 'stormy' | 'sunset');
          }
          break;
      }
    }
  }

  /**
   * Toggle between FFT ocean and basic water
   */
  private toggleFFTOcean(enable: boolean): void {
    if (enable && !this.useFFTOcean) {
      // Switch to FFT ocean
      if (this.highFidelityWater) {
        this.scene.remove(this.highFidelityWater.mesh);
        this.highFidelityWater = undefined;
      }
      
      this.fftOcean = new FFTOcean(256, 1000, 25, new THREE.Vector2(1, 0.3), 2.0);
      this.fftOcean.mesh.position.y = 0;
      this.scene.add(this.fftOcean.mesh);
      
      this.foamSystem = new FoamSystem(this.scene, 1000);
      this.sprayParticles = new SprayParticles(this.scene, 2000);
      
      this.useFFTOcean = true;
    } else if (!enable && this.useFFTOcean) {
      // Switch to basic water
      if (this.fftOcean) {
        this.scene.remove(this.fftOcean.mesh);
        this.fftOcean = undefined;
      }
      
      if (this.foamSystem) {
        this.foamSystem = undefined;
      }
      if (this.sprayParticles) {
        this.sprayParticles = undefined;
      }
      
      this.highFidelityWater = new HighFidelityWater(this.scene, this.sunLight);
      this.scene.add(this.highFidelityWater.mesh);
      
      this.useFFTOcean = false;
    }
  }

  /**
   * Apply quality preset
   */
  public applyQualityPreset(preset: 'low' | 'medium' | 'high' | 'ultra' | 'calm' | 'stormy'): void {
    const presets: Record<string, Record<string, number | string | boolean>> = {
      low: {
        resolution: 128,
        size: 500,
        windSpeed: 15,
        choppiness: 1.0,
        amplitude: 0.8,
        foamIntensity: 0.5,
        sprayDensity: 0.3,
        causticsIntensity: 0.8,
        fogDensity: 0.01,
      },
      medium: {
        resolution: 256,
        size: 1000,
        windSpeed: 20,
        choppiness: 1.5,
        amplitude: 1.0,
        foamIntensity: 0.7,
        sprayDensity: 0.5,
        causticsIntensity: 1.0,
        fogDensity: 0.007,
      },
      high: {
        resolution: 256,
        size: 1000,
        windSpeed: 25,
        choppiness: 2.0,
        amplitude: 1.5,
        foamIntensity: 1.0,
        sprayDensity: 1.0,
        causticsIntensity: 1.5,
        fogDensity: 0.005,
      },
      ultra: {
        resolution: 512,
        size: 1500,
        windSpeed: 25,
        choppiness: 2.5,
        amplitude: 2.0,
        foamIntensity: 1.2,
        sprayDensity: 1.5,
        causticsIntensity: 2.0,
        fogDensity: 0.004,
      },
      calm: {
        windSpeed: 5,
        choppiness: 0.5,
        amplitude: 0.3,
        foamIntensity: 0.2,
        sprayDensity: 0.1,
      },
      stormy: {
        windSpeed: 35,
        choppiness: 3.0,
        amplitude: 3.0,
        foamIntensity: 2.0,
        sprayDensity: 2.5,
        weather: 'stormy',
      },
    };

    const config = presets[preset];
    if (config) {
      console.log(`✨ Applying ${preset} quality preset`);
      Object.entries(config).forEach(([param, value]) => {
        this.setOceanParam(param, value);
      });
    }
  }

  /**
   * Get the HDRI environment (for external access to sun direction, etc.)
   */
  public getHDRIEnvironment(): HDRIEnvironment | undefined {
    return this.hdriEnvironment;
  }

  /**
   * Get the sun light (for external access to position, intensity, etc.)
   */
  public getSunLight(): THREE.DirectionalLight {
    return this.sunLight;
  }

  public dispose(): void {
    // Remove event listener using stored bound reference
    window.removeEventListener('resize', this.boundOnWindowResize);

    // Dispose all visual effects (only call dispose if method exists)
    if (this.fftOcean) this.fftOcean.dispose();
    if (this.particles) this.particles.dispose();
    if (this.bubbles) this.bubbles.dispose();
    if (this.caustics && 'dispose' in this.caustics) (this.caustics as { dispose: () => void }).dispose();
    if (this.bioluminescence && 'dispose' in this.bioluminescence) (this.bioluminescence as { dispose: () => void }).dispose();
    if (this.godRays && 'dispose' in this.godRays) (this.godRays as { dispose: () => void }).dispose();
    if (this.kelpForest && 'dispose' in this.kelpForest) (this.kelpForest as { dispose: () => void }).dispose();
    if (this.foamSystem && 'dispose' in this.foamSystem) (this.foamSystem as { dispose: () => void }).dispose();
    if (this.sprayParticles) this.sprayParticles.dispose();
    if (this.hdriEnvironment && 'dispose' in this.hdriEnvironment) (this.hdriEnvironment as { dispose: () => void }).dispose();

    // Dispose groups with geometries and materials
    const disposeGroup = (group: THREE.Group) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
      this.scene.remove(group);
    };

    if (this.realisticFloor) disposeGroup(this.realisticFloor);
    if (this.marineLife) disposeGroup(this.marineLife);

    // Clear scene and dispose post-processing/renderer
    this.scene.clear();
    this.postProcessing.dispose();
    this.renderer.dispose();
  }
}

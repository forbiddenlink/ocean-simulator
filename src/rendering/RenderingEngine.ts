import * as THREE from 'three';
import { HighFidelityWater } from './HighFidelityWater';
import { FFTOcean } from './FFTOcean';
import { WavelengthLighting } from './WavelengthLighting';
import { PostProcessingPipeline } from './PostProcessingPipeline';
import { RealisticOceanFloor } from './RealisticOceanFloor';
import { UnderwaterParticles, BubbleSystem, CreatureBubbleTrails } from './UnderwaterParticles';
import { CausticsEffect } from './Caustics';
import { BioluminescenceSystem } from './Bioluminescence';
import { VolumetricLightShafts } from './VolumetricLightShafts';
import { CoralFormations } from './CoralFormations';
import { SeaAnemones } from './SeaAnemones';
import { MarineLife } from './MarineLife';
import { KelpForest } from './KelpForest';
import { FoamSystem } from './FoamSystem';
import { SprayParticles } from './SprayParticles';
import { HDRIEnvironment } from './HDRIEnvironment';
import { ExtraOceanLife } from './ExtraOceanLife';
import { HuntVisualEvents } from '../systems/HuntVisualEvents';

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
  private hemiLight!: THREE.HemisphereLight; // Exposed so look presets can art-direct contrast
  private fillLight!: THREE.DirectionalLight; // Floor-bounce fill, preset-controlled
  private particles?: UnderwaterParticles;
  private bubbles?: BubbleSystem;
  private caustics?: CausticsEffect;
  private bioluminescence?: BioluminescenceSystem;
  private lightShafts?: VolumetricLightShafts;
  private realisticFloor?: THREE.Group; // Returns a Group from static method
  private sandFloorMaterial?: THREE.ShaderMaterial;
  private anemones?: SeaAnemones;
  private marineLife?: THREE.Group; // Returns a Group from static method
  private kelpForest?: KelpForest;
  private coralReef?: THREE.Group;
  private foamSystem?: FoamSystem;
  private sprayParticles?: SprayParticles;
  private hdriEnvironment?: HDRIEnvironment;
  private creatureBubbles?: CreatureBubbleTrails;
  private extraOceanLife?: ExtraOceanLife;
  private elapsedTime: number = 0;
  private _viewDir = new THREE.Vector3();
  private _dofFocus = 16;
  private _sprayScratch = new THREE.Vector3();
  private _flashPos = new THREE.Vector3();

  // Store bound event handler to properly remove listener
  private boundOnWindowResize: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a8aaa); // Bright tropical ocean blue

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
    // Mid-water cinematic angle: shows surface light, dolphins/sharks mid-water, reef + floor life
    this.camera.position.set(0, -10, 25);
    this.camera.lookAt(0, -14, -5);

    // Create renderer with WebGL2
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true, // Required for screenshots/toDataURL
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
    const sand = this.realisticFloor.getObjectByName('sandFloor') as THREE.Mesh | undefined;
    if (sand?.material && (sand.material as THREE.ShaderMaterial).isShaderMaterial) {
      this.sandFloorMaterial = sand.material as THREE.ShaderMaterial;
    }

    // Coral first so kelp/anemones can nestle against reef patches
    this.coralReef = CoralFormations.createCoralReef(this.scene, -30, 100);

    // Kelp forests (GPU sway) near origin + reef edges
    this.kelpForest = new KelpForest(this.scene, -30, 75);

    // Anemones clustered on reefs
    this.anemones = new SeaAnemones(this.scene, -30, 55);

    // Floor décor
    this.marineLife = MarineLife.createMarineCreatures(this.scene, -30, 140);

    // Ambient mid-water / floor critters
    this.extraOceanLife = new ExtraOceanLife(this.scene, -30);

    // Add Water Surface - choose between FFT ocean (photorealistic) or basic water
    if (this.useFFTOcean) {
      this.fftOcean = new FFTOcean(
        256, // Large cascade resolution (detail cascade is 128)
        1000, // Slightly tighter patch = higher spatial frequency in the swell band
        30,
        new THREE.Vector2(1, 0.35),
        2.8
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
    this.creatureBubbles = new CreatureBubbleTrails(this.scene);

    // Add caustics
    this.caustics = new CausticsEffect(this.scene, this.renderer);

    // Add volumetric god-ray light shafts (hero effect of the Cinematic Deep look)
    this.lightShafts = new VolumetricLightShafts(this.scene);

    // Add bioluminescence
    this.bioluminescence = new BioluminescenceSystem(this.scene);

    // Add HDRI environment
    this.hdriEnvironment = new HDRIEnvironment(this.scene, this.renderer);

    // Wave-linked caustics + foam once FFT height exists
    this.bindWaveHeightConsumers();

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
    this.sunLight = new THREE.DirectionalLight(0xb0ddee, 2.4); // Slightly warm-shifted underwater sunlight
    this.sunLight.position.set(10, 50, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -80;    // Wider shadow frustum for full scene coverage
    this.sunLight.shadow.camera.right = 80;
    this.sunLight.shadow.camera.top = 80;
    this.sunLight.shadow.camera.bottom = -80;
    this.sunLight.shadow.bias = -0.0005;        // Reduce shadow acne
    this.scene.add(this.sunLight);

    // Ambient light — kept low so depth/contrast can read; presets tune intensity.
    const ambientLight = new THREE.AmbientLight(0x4d84b0, 0.6);
    this.scene.add(ambientLight);

    // Hemisphere light — surface-vs-depth gradient. Low baseline for cinematic contrast;
    // a bright value here is the #1 thing that flattens the scene into a "swimming pool".
    this.hemiLight = new THREE.HemisphereLight(
      0x86bcd6, // Sky color (cyan from surface)
      0x0a2230, // Ground color (deep blue from below)
      0.5
    );
    this.scene.add(this.hemiLight);

    // Fill light from below - simulates bioluminescence and floor bounce
    this.fillLight = new THREE.DirectionalLight(0x2f5a72, 0.35);
    this.fillLight.position.set(0, -30, 0);
    this.scene.add(this.fillLight);

    // Camera-attached fill light — subtle blue tint reveals nearby creatures
    const cameraFillLight = new THREE.PointLight(0x5580aa, 0.6);
    cameraFillLight.distance = 35; // Slightly wider range
    cameraFillLight.decay = 2;
    this.camera.add(cameraFillLight);
    this.scene.add(this.camera);

    if (DEBUG) console.log('💡 Underwater lighting configured - blue-tinted for 30m depth');
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.postProcessing.setSize(window.innerWidth, window.innerHeight);
  }

  public render(deltaTime?: number): void {
    // Use post-processing for bloom and effects (pass deltaTime for distortion animation)
    this.postProcessing.render(deltaTime);
  }

  public update(deltaTime: number): void {
    this.elapsedTime += deltaTime;
    // Animate extra critters
    if (this.extraOceanLife) {
      this.extraOceanLife.update(deltaTime, this.elapsedTime);
    }
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
    if (this.creatureBubbles) {
      this.creatureBubbles.update(deltaTime);
    }
    
    // Update advanced visual effects (if enabled)
    if (this.caustics) {
      this.caustics.update(deltaTime, this.camera);
    }

    // Keep seabed sand lit by the same sun (time advanced once via RealisticOceanFloor.update below)
    if (this.sandFloorMaterial && this.sunLight) {
      this.sandFloorMaterial.uniforms.lightDirection.value.copy(this.sunLight.position).normalize();
    }
    
    // Update foam and spray
    if (this.foamSystem) {
      this.foamSystem.update(deltaTime);
    }
    if (this.sprayParticles) {
      // Spawn mist from real FFT crests near the camera so breakers feel physical
      if (this.fftOcean && Math.random() < Math.min(1, deltaTime * 18)) {
        const cam = this.camera.position;
        for (let n = 0; n < 3; n++) {
          const x = cam.x + (Math.random() - 0.5) * 70;
          const z = cam.z + (Math.random() - 0.5) * 70;
          const h = this.fftOcean.sampleHeight(x, z);
          if (h > 0.85) {
            this._sprayScratch.set(x, Math.max(0.05, h * 0.35), z);
            const burst = 4 + Math.floor(Math.min(10, h * 4));
            this.sprayParticles.spawnAt(this._sprayScratch, burst);
          }
        }
      }
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
    
    // Update bioluminescence + hunt/kill flashes from the simulation
    if (this.bioluminescence) {
      this.bioluminescence.update(deltaTime, this.camera.position);
      const flashes = HuntVisualEvents.drain();
      for (const ev of flashes) {
        this._flashPos.set(ev.x, ev.y, ev.z);
        this.bioluminescence.addFlash(
          this._flashPos,
          HuntVisualEvents.colorFor(ev.kind),
          ev.intensity
        );
      }
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
      if (this.caustics) {
        this.caustics.setSunDirection(sunDir);
      }
      if (this.particles) {
        const day = Math.max(0, Math.sin(timeOfDay * Math.PI));
        this.particles.setLighting(sunDir, day);
      }

      // Sync god rays sun mesh position with actual sun direction
      this.postProcessing.updateSunPosition(sunDir.clone().multiplyScalar(40));

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
        const bioIntensity = 0.25 + nightFactor * 3.6; // ~0.25 noon → ~3.85 midnight
        this.bioluminescence.setIntensity(bioIntensity);
      }
    }
    
    // Update realistic floor (uses static method)
    if (this.realisticFloor) {
      const sandFloor = this.realisticFloor.children.find(
        (child) => child.name === 'sandFloor'
      ) as THREE.Mesh | undefined;
      
      if (sandFloor) {
        const sunDir = this.hdriEnvironment?.getSunDirection();
        RealisticOceanFloor.update(sandFloor, deltaTime, sunDir);
      }
    }

    // Cinematic DOF: ease focus toward what the camera is looking at
    {
      const dir = this._viewDir;
      this.camera.getWorldDirection(dir);
      // Looking at the floor → nearer focus; looking toward surface / distance → deeper
      let focus = 15;
      if (dir.y < -0.25) {
        const floorDist = Math.max(4, this.camera.position.y + 30);
        focus = THREE.MathUtils.clamp(floorDist * 0.55, 8, 22);
      } else if (dir.y > 0.35) {
        focus = 24;
      } else {
        focus = 14 + Math.abs(this.camera.position.y) * 0.15;
      }
      this._dofFocus += (focus - this._dofFocus) * Math.min(1, deltaTime * 2.5);
      this.postProcessing.setDofFocus(this._dofFocus);
      // Soften bokeh in the deep murk, sharpen on close subjects
      const bokeh = THREE.MathUtils.clamp(1.6 + this._dofFocus * 0.035, 1.6, 2.8);
      this.postProcessing.setDofBokeh(bokeh);
    }

    // Apply wavelength-dependent lighting based on depth
    this.lightSystem.applyToSceneFog(this.scene, this.camera.position.y);

    // Update underwater color grading based on camera depth
    this.postProcessing.updateCameraDepth(this.camera.position.y);
    this.postProcessing.updateSunScreen(this.camera);
    // Update camera parameters for spectral absorption depth buffer reading
    this.postProcessing.updateCamera(this.camera);

    // Update god rays based on camera depth (stronger near surface)
    this.postProcessing.updateGodRayDepth(this.camera.position.y);

    // Update god ray color based on time of day
    if (this.hdriEnvironment) {
      this.postProcessing.updateGodRayTimeOfDay(this.hdriEnvironment.getTimeOfDay());
    }

    // Volumetric light shafts: billboard + shimmer, fade with time of day.
    if (this.lightShafts) {
      this.lightShafts.update(deltaTime, this.camera);
      if (this.hdriEnvironment) {
        const day = Math.sin(this.hdriEnvironment.getTimeOfDay() * Math.PI);
        this.lightShafts.setDayFactor(day);
      }
    }
  }

  /**
   * Wire FFT height into caustics + foam so both track real wave motion.
   */
  private bindWaveHeightConsumers(): void {
    if (!this.fftOcean) return;
    const heightTex = this.fftOcean.getHeightTexture();
    const oceanSize = this.fftOcean.getOceanSize();
    this.caustics?.setWaterHeightMap(heightTex, oceanSize);
    this.foamSystem?.setWaterHeightMap(heightTex, oceanSize);
  }

  /**
   * Set ocean parameters
   */
  public setOceanParam(param: string, value: number | string | boolean): void {
    if (this.fftOcean) {
      switch (param) {
        case 'resolution':
          this.fftOcean.setResolution(value as number);
          this.bindWaveHeightConsumers();
          break;
        case 'size':
          this.fftOcean.setSize(value as number);
          this.bindWaveHeightConsumers();
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
          if (this.sandFloorMaterial?.uniforms.causticIntensity) {
            this.sandFloorMaterial.uniforms.causticIntensity.value = value as number;
          }
          break;
        case 'causticsScale':
          if (this.caustics) this.caustics.setScale(value as number);
          break;
        case 'fogDensity':
          this.lightSystem.sceneFogBaseDensity = value as number;
          this.lightSystem.applyToSceneFog(this.scene, this.camera.position.y);
          break;
        case 'lightIntensity':
          this.sunLight.intensity = value as number;
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
      
      this.fftOcean = new FFTOcean(256, 1000, 30, new THREE.Vector2(1, 0.35), 2.8);
      this.fftOcean.mesh.position.y = 0;
      this.scene.add(this.fftOcean.mesh);
      
      this.foamSystem = new FoamSystem(this.scene, 1000);
      this.sprayParticles = new SprayParticles(this.scene, 2000);
      this.bindWaveHeightConsumers();
      
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
      if (DEBUG) console.log(`✨ Applying ${preset} quality preset`);
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
   * Get creature bubble trail system (for external emission by mesh pool)
   */
  public getCreatureBubbles(): CreatureBubbleTrails | undefined {
    return this.creatureBubbles;
  }

  /**
   * Get the sun light (for external access to position, intensity, etc.)
   */
  public getSunLight(): THREE.DirectionalLight {
    return this.sunLight;
  }

  /** Hemisphere light — presets tune this to control surface-vs-depth contrast. */
  public getHemiLight(): THREE.HemisphereLight {
    return this.hemiLight;
  }

  /** Below-fill light — presets tune this for floor bounce / bioluminescent lift. */
  public getFillLight(): THREE.DirectionalLight {
    return this.fillLight;
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
    if (this.lightShafts) this.lightShafts.dispose();
    if (this.kelpForest && 'dispose' in this.kelpForest) (this.kelpForest as { dispose: () => void }).dispose();
    if (this.anemones) this.anemones.dispose();
    if (this.extraOceanLife) this.extraOceanLife.dispose();
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
    if (this.coralReef) disposeGroup(this.coralReef);

    // Clear scene and dispose post-processing/renderer
    this.scene.clear();
    this.postProcessing.dispose();
    this.renderer.dispose();
  }
}

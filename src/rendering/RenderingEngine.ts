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
    console.log(`📷 Camera positioned at (0, -12, 0) - centered in fish swimming area`);

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
    
    console.log('🌅 Starting PHOTOREALISTIC OCEAN with all features enabled');

    // Add realistic ocean floor
    console.log('🪨 Creating realistic ocean floor...');
    this.realisticFloor = RealisticOceanFloor.createDetailedFloor(this.scene, -30);
    
    // Add seagrass and kelp (RE-ENABLED with optimization)
    console.log('🌿 Adding kelp forest...');
    // this.seagrass = new AnimatedSeagrass(this.scene, -30, 150); // Keep disabled to reduce complexity
    this.kelpForest = new KelpForest(this.scene, -30, 60); // Re-enabled - not the cause (fish shader was)
    
    // Add coral formations (significantly increased)
    console.log('🪸 Adding coral reef formations...');
    CoralFormations.createCoralReef(this.scene, -30, 80); // Re-enabled - confirmed not causing vines
    
    // Add sea anemones (significantly increased for realistic reef)
    console.log('🌺 Adding sea anemones...');
    this.anemones = new SeaAnemones(this.scene, -30, 40); // Re-enabled - confirmed not causing vines
    
    // Add marine life decorations (SIGNIFICANTLY INCREASED)
    console.log('🐚 Adding marine life decorations...');
    this.marineLife = MarineLife.createMarineCreatures(this.scene, -30, 120); // Re-enabled - confirmed not causing vines

    // Add Water Surface - choose between FFT ocean (photorealistic) or basic water
    if (this.useFFTOcean) {
      console.log('🌊 Initializing FFT Ocean (MAXIMUM PHOTOREALISM)');
      this.fftOcean = new FFTOcean(
        512, // Increased resolution for better detail (was 256)
        1200, // Larger ocean size for expansive feel
        28, // Higher wind speed for more dynamic waves
        new THREE.Vector2(1, 0.3), // wind direction
        2.5 // Increased wave amplitude for dramatic ocean
      );
      this.fftOcean.mesh.position.y = 0; // Sea level
      this.scene.add(this.fftOcean.mesh);
      
      // Add foam and spray for FFT ocean
      this.foamSystem = new FoamSystem(this.scene, 1500);
      this.sprayParticles = new SprayParticles(this.scene, 2000);
      console.log('✨ Added foam and spray particle systems');
    } else {
      console.log('🌊 Initializing Basic Water');
      this.highFidelityWater = new HighFidelityWater(this.scene, this.sunLight);
      this.scene.add(this.highFidelityWater.mesh);
    }
    
    // Add underwater particles and bubbles
    this.particles = new UnderwaterParticles(this.scene);
    this.bubbles = new BubbleSystem(this.scene);
    console.log('💧 Added underwater particles and bubbles');
    
    // Add caustics
    console.log('✨ Adding caustics...');
    this.caustics = new CausticsEffect(this.scene, this.renderer);
    
    // God rays DISABLED - still causing vine-like patterns
    // this.godRays = new GodRaysEffect(this.scene);
    
    // Add bioluminescence
    console.log('💡 Adding bioluminescence...');
    this.bioluminescence = new BioluminescenceSystem(this.scene);
    
    // Volumetric fog DISABLED - causes white wash
    // this.volumetricFog = new VolumetricFog(this.scene);
    
    // Add HDRI environment
    console.log('🌅 Adding HDRI environment...');
    this.hdriEnvironment = new HDRIEnvironment(this.scene);

    // Apply initial lighting state
    this.lightSystem.applyToSceneFog(this.scene, this.camera.position.y);

    // Initialize post-processing pipeline
    this.postProcessing = new PostProcessingPipeline(this.renderer, this.scene, this.camera);
    
    console.log('✨ PHOTOREALISTIC OCEAN LOADED - All features active!');

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  // setupEnvironment method removed - all setup now in constructor

  private setupLights(): void {
    // Directional light (sun from above) - blue-tinted underwater sunlight
    // At 30m depth, most red light is absorbed, so sunlight appears blue-cyan
    this.sunLight = new THREE.DirectionalLight(0x99ccdd, 1.8); // Slightly warmer blue-cyan underwater sunlight
    this.sunLight.position.set(10, 50, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 500;
    this.scene.add(this.sunLight);

    // Ambient light - brighter to illuminate creatures (Phase 3 visual fix)
    const ambientLight = new THREE.AmbientLight(0x6699bb, 1.4); // Brighter, warmer blue
    this.scene.add(ambientLight);

    // Hemisphere light - provides natural gradient from above
    // Brighter sky color and ground color for better creature visibility (Phase 3)
    const hemiLight = new THREE.HemisphereLight(
      0x99bbdd, // Sky color (brighter blue-white)
      0x1a3a4a, // Ground color (slightly brighter for fill)
      1.0 // Increased intensity
    );
    this.scene.add(hemiLight);

    // Subtle fill light from below for creature visibility
    // Simulates light bouncing off the ocean floor
    const fillLight = new THREE.DirectionalLight(0x1a3a4a, 0.3); // Very subtle, cooler blue
    fillLight.position.set(0, -30, 0);
    this.scene.add(fillLight);

    // Camera-attached fill light - stronger for creature visibility (Phase 3 visual fix)
    const cameraFillLight = new THREE.PointLight(0x7799cc, 0.7);
    this.camera.add(cameraFillLight);
    this.scene.add(this.camera); // Camera must be in scene graph for child lights to work

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
    
    // Update HDRI environment
    if (this.hdriEnvironment) {
      this.hdriEnvironment.update(deltaTime);
      
      // Update sun direction in other systems
      const sunDir = this.hdriEnvironment.getSunDirection();
      if (this.fftOcean) {
        this.fftOcean.updateSunDirection(sunDir);
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
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.postProcessing.dispose();
    if (this.particles) {
      this.particles.dispose();
    }
    if (this.bubbles) {
      this.bubbles.dispose();
    }
    this.renderer.dispose();
  }
}

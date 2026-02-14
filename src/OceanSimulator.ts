import { pipe, getAllEntities, query } from 'bitecs';
import * as THREE from 'three';
import { createOceanWorld, updateWorldTime } from './core/World';
import type { OceanWorld } from './core/World';
import * as EntityFactory from './core/EntityFactory';
import { createFish, createShark, createDolphin, createJellyfish, createRay, createTurtle, createWhale, createCrab, createStarfish, createSeaUrchin } from './core/EntityFactory';
import { RenderingEngine } from './rendering/RenderingEngine';
import { BatchedMeshPool, createBatchedRenderSystem } from './rendering/BatchedMeshPool';
import { CameraController } from './rendering/CameraController';
import { Position, Scale, Velocity } from './components/Transform';
import { enhancedMovementSystem } from './systems/EnhancedMovementSystem';
import { firaSystem } from './systems/FIRASystem';
import { createHuntingSystem } from './systems/HuntingSystem';
import { createPopulationSystem, getPopulationStats as _getPopulationStats } from './systems/PopulationSystem';
import { createOceanCurrentsSystem } from './systems/OceanCurrentsSystem';
import { createBiomechanicalAnimationSystem } from './systems/BiomechanicalAnimationSystem';
import { UIManager } from './ui/UIManager';
import { FIRA } from './components/Behavior';
import GUI from 'lil-gui';

// Debug flag - set to true for development debugging
const DEBUG = false;

/**
 * Main application class
 */
export class OceanSimulator {
  private world: OceanWorld;
  private renderEngine: RenderingEngine;
  private meshPool: BatchedMeshPool;
  private uiManager: UIManager;
  private cameraController: CameraController;
  private pipeline: (world: OceanWorld) => OceanWorld;
  private animationFrameId: number | null = null;
  private huntingSystem: ReturnType<typeof createHuntingSystem>;
  private populationSystem: ReturnType<typeof createPopulationSystem>;
  private oceanCurrentsSystem: ReturnType<typeof createOceanCurrentsSystem>;
  private animationSystem: ReturnType<typeof createBiomechanicalAnimationSystem>;
  private statsUpdateTimer: number = 0;
  private isPaused: boolean = false;
  private timeScale: number = 1.0;
  private debugGui: GUI;
  private debugParams = {
    // Fish Movement
    maxSpeed: 3.0,
    separationWeight: 2.0,
    alignmentWeight: 1.0,
    cohesionWeight: 1.0,
    // Lighting
    ambientIntensity: 0.35,
    sunIntensity: 1.8,
    // Camera
    cameraX: 0,
    cameraY: -12,
    cameraZ: 0,
    fov: 75,
  };

  constructor(canvas: HTMLCanvasElement) {
    // Initialize ECS world
    this.world = createOceanWorld();
    
    // Initialize rendering
    this.uiManager = new UIManager();
    
    // Setup UI controls
    this.uiManager.onPause(() => this.togglePause());
    this.uiManager.onSpeedChange((speed) => this.setTimeScale(speed));
    
    // Setup ocean controls
    this.setupOceanControls();
    this.renderEngine = new RenderingEngine(canvas);
    this.meshPool = new BatchedMeshPool(this.renderEngine);
    this.cameraController = new CameraController(this.renderEngine.camera);

    // Create ecosystem systems
    this.huntingSystem = createHuntingSystem(this.world);
    this.populationSystem = createPopulationSystem(this.world, EntityFactory);
    this.oceanCurrentsSystem = createOceanCurrentsSystem(this.world);
    this.animationSystem = createBiomechanicalAnimationSystem(this.world);

    // Create systems pipeline with PHOTOREALISTIC systems
    const renderSystem = createBatchedRenderSystem(this.meshPool);
    this.pipeline = pipe(
      this.oceanCurrentsSystem,     // Ocean currents affect movement
      firaSystem,                    // FIRA flocking behavior
      this.huntingSystem,            // Predator-prey interactions
      this.animationSystem,          // PHOTOREALISTIC biomechanical animations
      enhancedMovementSystem,        // PHOTOREALISTIC burst-and-glide movement
      this.populationSystem,         // Population dynamics (with limits)
      renderSystem                   // Update Three.js meshes (using simple material for now)
    );
    
    // Spawn initial fish
    this.spawnInitialFish();

    // Setup debug GUI
    this.debugGui = new GUI({ title: 'Ocean Simulator Debug' });
    this.setupDebugGui();

    console.log('🌊 Ocean Simulator initialized');
    console.log(`📊 Entities: ${getAllEntities(this.world).length}`);
  }

  /**
   * Setup debug GUI with lil-gui for runtime parameter tuning
   */
  private setupDebugGui(): void {
    // Fish Movement folder
    const fishFolder = this.debugGui.addFolder('Fish Movement');
    fishFolder.add(this.debugParams, 'maxSpeed', 0, 10).name('Max Speed').onChange((value: number) => {
      this.applyFishParam('maxSpeed', value);
    });
    fishFolder.add(this.debugParams, 'separationWeight', 0, 5).name('Separation').onChange((value: number) => {
      this.applyFishParam('separationWeight', value);
    });
    fishFolder.add(this.debugParams, 'alignmentWeight', 0, 5).name('Alignment').onChange((value: number) => {
      this.applyFishParam('alignmentWeight', value);
    });
    fishFolder.add(this.debugParams, 'cohesionWeight', 0, 5).name('Cohesion').onChange((value: number) => {
      this.applyFishParam('cohesionWeight', value);
    });
    fishFolder.open();

    // Lighting folder
    const lightFolder = this.debugGui.addFolder('Lighting');
    lightFolder.add(this.debugParams, 'ambientIntensity', 0, 2).name('Ambient').onChange((value: number) => {
      const ambientLight = this.renderEngine.scene.children.find(
        (child) => child.type === 'AmbientLight'
      ) as THREE.AmbientLight | undefined;
      if (ambientLight) {
        ambientLight.intensity = value;
      }
    });
    lightFolder.add(this.debugParams, 'sunIntensity', 0, 5).name('Sun').onChange((value: number) => {
      const sunLight = this.renderEngine.getSunLight();
      if (sunLight) {
        sunLight.intensity = value;
      }
    });
    lightFolder.open();

    // Camera folder
    const cameraFolder = this.debugGui.addFolder('Camera');
    cameraFolder.add(this.debugParams, 'cameraX').name('Position X').listen();
    cameraFolder.add(this.debugParams, 'cameraY').name('Position Y').listen();
    cameraFolder.add(this.debugParams, 'cameraZ').name('Position Z').listen();
    cameraFolder.add(this.debugParams, 'fov', 30, 120).name('FOV').onChange((value: number) => {
      this.renderEngine.camera.fov = value;
      this.renderEngine.camera.updateProjectionMatrix();
    });
    cameraFolder.open();
  }

  /**
   * Apply a fish parameter to all FIRA entities
   */
  private applyFishParam(param: keyof typeof FIRA, value: number): void {
    const entities = query(this.world, [Position, Velocity]);
    for (const eid of entities) {
      if (FIRA[param][eid] !== undefined) {
        FIRA[param][eid] = value;
      }
    }
  }
  
  private spawnInitialFish(): void {
    console.log('🐠 Spawning COMPREHENSIVE marine ecosystem...');
    
    // MASSIVE schools of small bait fish (sardines/anchovies) - foundation of food chain
    this.spawnFishSchool(80, -8, 0, 0, 15, 0.6);     // Main bait ball - center
    this.spawnFishSchool(60, -10, 30, -20, 12, 0.6); // Right bait school
    this.spawnFishSchool(60, -9, -30, 25, 12, 0.6);  // Left bait school
    this.spawnFishSchool(50, -15, 20, 30, 10, 0.6);  // Deeper school
    
    // Medium-sized schooling fish (tuna, mackerel)
    this.spawnFishSchool(40, -12, 10, -10, 10, 1.0); // Mid-sized hunters
    this.spawnFishSchool(35, -14, -15, 15, 10, 1.0); // Another mid-size group
    this.spawnFishSchool(30, -10, 0, -25, 8, 1.0);   // Surface feeders
    
    // Larger reef fish (groupers, snappers)
    this.spawnFishSchool(25, -18, 15, 10, 8, 1.3);   // Near reef
    this.spawnFishSchool(20, -20, -10, -15, 7, 1.3); // Reef dwellers
    
    // Solitary larger fish scattered throughout
    for (let i = 0; i < 15; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = -8 - Math.random() * 15;
      const z = (Math.random() - 0.5) * 60;
      createFish(this.world, x, y, z, 2);
    }
    
    // Sharks (apex predators) - more variety and numbers
    const sharkSpecies = ['great-white', 'hammerhead', 'tiger', 'reef', 'reef', 'reef'] as const;
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = -12 - Math.random() * 15;
      const z = (Math.random() - 0.5) * 60;
      const species = sharkSpecies[Math.floor(Math.random() * sharkSpecies.length)];
      createShark(this.world, x, y, z, species);
    }
    
    // Dolphins (intelligent social creatures) - multiple pods
    for (let pod = 0; pod < 2; pod++) {
      const dolphinPodSize = 4 + Math.floor(Math.random() * 4); // 4-7 dolphins
      const podX = (Math.random() - 0.5) * 50;
      const podZ = (Math.random() - 0.5) * 50;
      for (let i = 0; i < dolphinPodSize; i++) {
        const angle = (i / dolphinPodSize) * Math.PI * 2;
        const radius = 6;
        const x = podX + Math.cos(angle) * radius;
        const y = -5 - Math.random() * 5;
        const z = podZ + Math.sin(angle) * radius;
        const species = (i === 0 && Math.random() > 0.8) ? 'orca' : 'bottlenose';
        createDolphin(this.world, x, y, z, species as any);
      }
    }
    
    // Jellyfish (drifters) - distributed across depths
    const jellyfishSpecies = ['moon', 'box', 'crystal', 'lion'] as const;
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * 70;
      const y = -3 - Math.random() * 25; // From near surface to deep
      const z = (Math.random() - 0.5) * 70;
      const species = jellyfishSpecies[Math.floor(Math.random() * jellyfishSpecies.length)];
      createJellyfish(this.world, x, y, z, species);
    }
    
    // Rays (bottom dwellers and gliders) - more variety
    const raySpecies = ['manta', 'eagle', 'stingray', 'stingray'] as const;
    for (let i = 0; i < 15; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = -22 - Math.random() * 8; // Near ocean floor
      const z = (Math.random() - 0.5) * 60;
      const species = raySpecies[Math.floor(Math.random() * raySpecies.length)];
      createRay(this.world, x, y, z, species);
    }
    
    // Sea turtles (3-5, graceful swimmers)
    for (let i = 0; i < 4; i++) {
      const x = (Math.random() - 0.5) * 60;
      const z = (Math.random() - 0.5) * 60;
      const y = -8 - Math.random() * 12; // -8 to -20 depth
      createTurtle(this.world, x, y, z, ['green', 'hawksbill', 'loggerhead'][Math.floor(Math.random() * 3)] as 'green' | 'hawksbill' | 'loggerhead');
    }

    // Whales (1-2, rare majestic creatures in distance)
    createWhale(this.world, 40, -15, -35, 'humpback');
    if (Math.random() > 0.5) {
      createWhale(this.world, -40, -20, 40, 'blue');
    }

    // Bottom dwellers - crabs (30-50, scattered on floor)
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      createCrab(this.world, x, 0, z); // y ignored, uses floor position
    }

    // Starfish (20-30, scattered on floor)
    for (let i = 0; i < 25; i++) {
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      createStarfish(this.world, x, 0, z);
    }

    // Sea urchins (15-20, scattered on floor)
    for (let i = 0; i < 18; i++) {
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      createSeaUrchin(this.world, x, 0, z);
    }

    const totalEntities = getAllEntities(this.world).length;
    console.log(`✅ Spawned ${totalEntities} creatures - A LIVING OCEAN ECOSYSTEM!`);
    console.log(`   📊 Breakdown: ~400 bait fish, ~85 medium fish, ~25 large fish`);
    console.log(`   🦈 8 sharks, ~10 dolphins, 30 jellyfish, 15 rays`);
    console.log(`   🐢 4 turtles, 1-2 whales, 40 crabs, 25 starfish, 18 urchins`);
    console.log(`   🌊 Total population: ${totalEntities} creatures in a realistic food web`);

    // Debug: Log spawn positions to verify they're within camera view
    console.log(`🎯 VISIBILITY DEBUG:`);
    console.log(`   Camera at: (0, -12, 0) looking at (0, -12, -10)`);
    console.log(`   Fish spawn area: X[-30,30] Y[-3,-30] Z[-30,30]`);
    console.log(`   Camera centered in fish swimming area`);

    // Log a sample of entity positions
    const entities = getAllEntities(this.world);
    if (entities.length > 0) {
      const sampleSize = Math.min(5, entities.length);
      console.log(`   Sample entity positions (first ${sampleSize}):`);
      for (let i = 0; i < sampleSize; i++) {
        const eid = entities[i];
        console.log(`     Entity ${eid}: (${Position.x[eid].toFixed(1)}, ${Position.y[eid].toFixed(1)}, ${Position.z[eid].toFixed(1)})`);
      }
    }
  }
  
  /**
   * Helper to spawn a school of fish in a specific location
   */
  private spawnFishSchool(
    count: number, 
    centerY: number, 
    centerX: number, 
    centerZ: number, 
    radius: number,
    sizeScale: number = 1.0
  ): void {
    for (let i = 0; i < count; i++) {
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      
      const x = centerX + Math.cos(angle1) * Math.sin(angle2) * r;
      const y = centerY + Math.sin(angle1) * Math.sin(angle2) * r * 0.3; // Flatter distribution
      const z = centerZ + Math.cos(angle2) * r;
      
      const eid = createFish(this.world, x, y, z, Math.floor(sizeScale * 2));
      // Add size variation (0.7x to 1.3x) for natural variation within schools
      const sizeVariation = 0.7 + Math.random() * 0.6;
      // Adjust scale based on size parameter and variation
      Scale.x[eid] *= sizeScale * sizeVariation;
      Scale.y[eid] *= sizeScale * sizeVariation;
      Scale.z[eid] *= sizeScale * sizeVariation;
    }
  }
  
  /**
   * Start the simulation loop
   */
  public start(): void {
    console.log('▶️  Starting simulation...');
    this.loop();
  }
  
  /**
   * Stop the simulation loop
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      console.log('⏸️  Simulation paused');
    }
  }
  
  /**
   * Main game loop
   */
  private loop = (): void => {
    this.animationFrameId = requestAnimationFrame(this.loop);
    
    // Update world time (scaled by time scale)
    updateWorldTime(this.world);

    if (!this.isPaused) {
      // Apply time scale to delta
      this.world.time.delta *= this.timeScale;
    } else {
      // Zero delta when paused (systems won't advance)
      this.world.time.delta = 0;
    }

    const deltaTime = this.world.time.delta; // Already in seconds from updateWorldTime
    
    // Update camera (always runs even when paused)
    this.cameraController.update(this.world.time.delta);

    // Sync camera position to debug GUI display
    this.debugParams.cameraX = Math.round(this.renderEngine.camera.position.x * 100) / 100;
    this.debugParams.cameraY = Math.round(this.renderEngine.camera.position.y * 100) / 100;
    this.debugParams.cameraZ = Math.round(this.renderEngine.camera.position.z * 100) / 100;
    
    // Run ECS systems (only when not paused)
    if (!this.isPaused) {
      // Rebuild spatial grid with current entity positions before running systems
      const entities = Array.from(getAllEntities(this.world));
      this.world.spatialGrid.rebuild(entities, Position.x, Position.y, Position.z);

      // Debug: Log grid stats occasionally
      if (DEBUG && Math.random() < 0.01) {
        const stats = this.world.spatialGrid.getStats();
        console.log(`Spatial Grid: ${stats.totalCells} cells, ${stats.totalEntities} entities, avg ${stats.avgEntitiesPerCell.toFixed(1)}/cell`);
      }

      this.pipeline(this.world);
    }
    
    // Update rendering (always runs)
    this.renderEngine.update(this.world.time.delta);
    
    // Render (always runs)
    this.renderEngine.render();
    
    // Update UI stats periodically
    this.statsUpdateTimer += deltaTime;
    if (this.statsUpdateTimer >= 1.0) {
      this.uiManager.updateStats(this.world);

      // Debug: Log entity count every second to verify creatures exist
      if (DEBUG) {
        const entityCount = getAllEntities(this.world).length;
        console.log(`Entity count: ${entityCount} | Camera at Z=${this.renderEngine.camera.position.z.toFixed(1)}`);
      }

      this.statsUpdateTimer = 0;
    }
  };
  
  /**
   * Cleanup
   */
  public dispose(): void {
    this.stop();
    this.meshPool.dispose();
    this.renderEngine.dispose();
    this.uiManager.dispose();
    this.debugGui.destroy();
    console.log('🗑️  Ocean Simulator disposed');
  }
  
  /**
   * Toggle pause state
   */
  public togglePause(): void {
    this.isPaused = !this.isPaused;
    this.uiManager.setPaused(this.isPaused);
    console.log(this.isPaused ? '⏸️  Paused' : '▶️  Resumed');
  }
  
  /**
   * Set time scale (simulation speed)
   */
  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.1, Math.min(10, scale));
    console.log(`⚡ Time scale set to ${this.timeScale}x`);
  }
  
  /**
   * Setup ocean parameter controls
   */
  private setupOceanControls(): void {
    // Wind speed control
    this.uiManager.onWindSpeed((speed) => {
      console.log(`🌬️  Wind speed: ${speed} m/s`);
      // Note: Changing FFT parameters requires regenerating spectrum
      // For now, log the change. Full implementation would recreate FFT ocean.
    });
    
    // Wave amplitude control
    this.uiManager.onWaveAmplitude((amplitude) => {
      console.log(`🌊 Wave amplitude: ${amplitude}x`);
      // Similar to wind speed, would require FFT regeneration
    });
    
    // Time of day control
    this.uiManager.onTimeOfDay((time) => {
      // Update HDRI environment time of day
      if (this.renderEngine && (this.renderEngine as any).hdriEnvironment) {
        (this.renderEngine as any).hdriEnvironment.setTimeOfDay(time);
      }
    });
    
    // Weather control
    this.uiManager.onWeather((weather) => {
      console.log(`🌦️  Weather: ${weather}`);
      // Update HDRI environment weather
      if (this.renderEngine && (this.renderEngine as any).hdriEnvironment) {
        (this.renderEngine as any).hdriEnvironment.setWeather(weather as any);
      }
    });
    
    // Quality preset control
    this.uiManager.onQuality((quality) => {
      console.log(`⚙️  Quality preset: ${quality}`);
      this.applyQualityPreset(quality);
    });
  }
  
  /**
   * Apply quality preset - adjusts rendering parameters for performance vs quality
   */
  private applyQualityPreset(preset: string): void {
    interface QualityConfig {
      message: string;
      fftResolution: number;
      choppiness: number;
      amplitude: number;
      pixelRatio: number;
    }

    const presets: Record<string, QualityConfig> = {
      'low': {
        message: 'Low quality (best performance)',
        fftResolution: 128,
        choppiness: 1.5,
        amplitude: 1.5,
        pixelRatio: 1.0,
      },
      'medium': {
        message: 'Medium quality (balanced)',
        fftResolution: 256,
        choppiness: 2.0,
        amplitude: 2.0,
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
      },
      'high': {
        message: 'High quality (better visuals)',
        fftResolution: 512,
        choppiness: 2.0,
        amplitude: 2.5,
        pixelRatio: Math.min(window.devicePixelRatio, 2.0),
      },
      'ultra': {
        message: 'Ultra quality (photorealistic)',
        fftResolution: 512, // 1024 is too expensive for real-time
        choppiness: 2.5,
        amplitude: 3.0,
        pixelRatio: window.devicePixelRatio,
      }
    };

    const config = presets[preset];
    if (config) {
      console.log(`✨ ${config.message}`);

      // Apply FFT ocean parameters
      this.renderEngine.setOceanParam('resolution', config.fftResolution);
      this.renderEngine.setOceanParam('choppiness', config.choppiness);
      this.renderEngine.setOceanParam('amplitude', config.amplitude);

      // Adjust renderer pixel ratio
      this.renderEngine.renderer.setPixelRatio(config.pixelRatio);

      console.log(`   FFT Resolution: ${config.fftResolution}`);
      console.log(`   Choppiness: ${config.choppiness}`);
      console.log(`   Wave Amplitude: ${config.amplitude}`);
      console.log(`   Pixel Ratio: ${config.pixelRatio.toFixed(1)}`);
    }
  }
}

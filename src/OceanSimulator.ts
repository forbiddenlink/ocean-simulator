import { pipe, getAllEntities, query } from 'bitecs';
import * as THREE from 'three';
import { createOceanWorld, updateWorldTime } from './core/World';
import type { OceanWorld } from './core/World';
import { createFish, createShark, createDolphin, createJellyfish, createRay, createTurtle, createWhale, createCrab, createStarfish, createSeaUrchin } from './core/EntityFactory';
import * as EntityFactory from './core/EntityFactory';
import { RenderingEngine } from './rendering/RenderingEngine';
import { BatchedMeshPool, createBatchedRenderSystem } from './rendering/BatchedMeshPool';
import { CameraController } from './rendering/CameraController';
import { Position, Scale, Velocity } from './components/Transform';
import { enhancedMovementSystem } from './systems/EnhancedMovementSystem';
import { firaSystem } from './systems/FIRASystem';
import { createHuntingSystem } from './systems/HuntingSystem';
import { createPopulationSystem } from './systems/PopulationSystem';
import { createOceanCurrentsSystem } from './systems/OceanCurrentsSystem';
import { createBiomechanicalAnimationSystem } from './systems/BiomechanicalAnimationSystem';
import { UIManager } from './ui/UIManager';
import { FIRA, SchoolLeader } from './components/Behavior';
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

    // Look preset — Cinematic Deep is the signature/default look
    lookPreset: 'inky-cinematic' as 'tropical-clear' | 'inky-cinematic',

    // Cinematic / Post
    bloomIntensity: 0.8,
    bloomThreshold: 0.45,
    absorptionScale: 0.05,
    turbidity: 0.25,
    vignetteOffset: 0.35,
    vignetteDarkness: 0.35,
    chromaX: 0.001,
    chromaY: 0.0006,

    // Lighting
    ambientIntensity: 1.2,
    sunIntensity: 3.0,

    // Camera
    cameraX: 0,
    cameraY: -8,
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
    this.uiManager.onLookToggle(() => this.toggleLookPreset());
    this.uiManager.onIntroReplay(() => this.replayIntro());
    
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
    this.debugGui = new GUI({ title: 'Ocean Simulator Debug', closeFolders: true });
    this.debugGui.close(); // Start collapsed so ocean is visible
    
    // Style the debug GUI to prevent HUD conflicts
    const guiContainer = this.debugGui.domElement.parentElement;
    if (guiContainer) {
      guiContainer.style.zIndex = '900'; // Below custom UI panels (z-index: 1000)
      guiContainer.style.top = '280px';  // Below info panel
      guiContainer.style.right = '20px';
    }
    
    this.setupDebugGui();

    // Apply initial look preset
    this.applyLookPreset(this.debugParams.lookPreset);

    // Cinematic intro reveal — dive from just under the surface down through the light
    // shafts and into the reef. Any movement/click hands control back instantly.
    this.startIntro();

    if (DEBUG) {
      console.log('🌊 Ocean Simulator initialized');
      console.log(`📊 Entities: ${getAllEntities(this.world).length}`);
    }
  }

  /** Keyframed dive path for the intro / hero flythrough (world space). */
  private readonly introKeyframes: Array<{
    pos: [number, number, number];
    look: [number, number, number];
  }> = [
    { pos: [0, -1.5, 42], look: [2, -12, 6] },   // just under the surface, far back
    { pos: [10, -5, 28], look: [4, -15, -4] },   // descending toward the shafts
    { pos: [-4, -11, 16], look: [3, -18, -12] }, // gliding down past silhouettes
    { pos: [3, -10, 7], look: [7, -16, -16] },   // banking into the reef + god rays
    { pos: [0, -9, 2], look: [0, -12, -22] },    // settle to an explorable forward view
  ];

  /** Start the intro flythrough (skipped for reduced-motion users, who get the end pose). */
  private startIntro(): void {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      const end = this.introKeyframes[this.introKeyframes.length - 1];
      this.renderEngine.camera.position.set(...end.pos);
      this.renderEngine.camera.lookAt(...end.look);
      return;
    }
    this.cameraController.playCinematic(this.introKeyframes, 15, false);
  }

  /** Replay the intro flythrough on demand (HUD button). */
  public replayIntro(): void {
    this.cameraController.playCinematic(this.introKeyframes, 15, false);
  }

  /** Toggle Cinematic Deep ⇄ Clean tropical look (demo before/after). Returns the new preset. */
  public toggleLookPreset(): 'tropical-clear' | 'inky-cinematic' {
    const next =
      this.debugParams.lookPreset === 'inky-cinematic' ? 'tropical-clear' : 'inky-cinematic';
    this.debugParams.lookPreset = next;
    this.applyLookPreset(next);
    return next;
  }

  private applyLookPreset(preset: 'tropical-clear' | 'inky-cinematic'): void {
    // Full art-direction preset: every knob that controls the look lives here so a
    // preset switch is a single cohesive move (post FX + all lights + scene fog + exposure).
    type LookPreset = {
      // Post FX
      bloomIntensity: number; bloomThreshold: number; absorptionScale: number; turbidity: number;
      vignetteOffset: number; vignetteDarkness: number; chromaX: number; chromaY: number;
      exposure: number; scatterStrength: number; depthDesat: number; scatterHex: number;
      // Lighting
      ambientIntensity: number; sunIntensity: number; hemiIntensity: number; fillIntensity: number;
      // Scene fog + background
      fogBaseDensity: number; fogDepthFactor: number; fogShallowHex: number; fogDeepHex: number;
      backgroundHex: number;
    };

    const presets: Record<typeof preset, LookPreset> = {
      // Bright, clear tropical water — approachable "before" reference.
      'tropical-clear': {
        bloomIntensity: 0.7, bloomThreshold: 0.55, absorptionScale: 0.05, turbidity: 0.25,
        vignetteOffset: 0.4, vignetteDarkness: 0.3, chromaX: 0.001, chromaY: 0.0006,
        exposure: 1.05, scatterStrength: 0.4, depthDesat: 0.2, scatterHex: 0x1f6f86,
        ambientIntensity: 1.0, sunIntensity: 3.0, hemiIntensity: 1.0, fillIntensity: 0.5,
        fogBaseDensity: 0.014, fogDepthFactor: 0.0002, fogShallowHex: 0x3f93a8, fogDeepHex: 0x14536b,
        backgroundHex: 0x2a8aaa,
      },
      // CINEMATIC DEEP — signature look: moody blue-green depth, strong contrast,
      // distance dissolving into navy murk, highlights reserved for light shafts.
      'inky-cinematic': {
        bloomIntensity: 0.85, bloomThreshold: 0.62, absorptionScale: 0.085, turbidity: 0.5,
        vignetteOffset: 0.26, vignetteDarkness: 0.62, chromaX: 0.0013, chromaY: 0.0009,
        exposure: 1.18, scatterStrength: 0.72, depthDesat: 0.45, scatterHex: 0x0a2c3c,
        ambientIntensity: 0.55, sunIntensity: 2.6, hemiIntensity: 0.45, fillIntensity: 0.28,
        fogBaseDensity: 0.038, fogDepthFactor: 0.0003, fogShallowHex: 0x1a5468, fogDeepHex: 0x0c2c3c,
        backgroundHex: 0x0a2230,
      },
    };

    const p = presets[preset];
    const pp = this.renderEngine.postProcessing;

    // Keep GUI-backed params in sync so the debug panel reflects the preset.
    Object.assign(this.debugParams, {
      bloomIntensity: p.bloomIntensity, bloomThreshold: p.bloomThreshold,
      absorptionScale: p.absorptionScale, turbidity: p.turbidity,
      vignetteOffset: p.vignetteOffset, vignetteDarkness: p.vignetteDarkness,
      chromaX: p.chromaX, chromaY: p.chromaY,
      ambientIntensity: p.ambientIntensity, sunIntensity: p.sunIntensity,
    });

    // Post FX
    pp.setBloomIntensity(p.bloomIntensity);
    pp.setBloomThreshold(p.bloomThreshold, 0.7);
    pp.setAbsorptionScale(p.absorptionScale);
    pp.setTurbidity(p.turbidity);
    pp.setVignette(p.vignetteOffset, p.vignetteDarkness);
    pp.setChromaticAberration(p.chromaX, p.chromaY);
    pp.setExposure(p.exposure);
    pp.setScatterStrength(p.scatterStrength);
    pp.setDepthDesat(p.depthDesat);
    pp.setScatterColor(p.scatterHex);

    // Lighting — all four lights, so the preset actually controls contrast.
    const ambientLight = this.renderEngine.scene.children.find(
      (child) => child.type === 'AmbientLight'
    ) as THREE.AmbientLight | undefined;
    if (ambientLight) ambientLight.intensity = p.ambientIntensity;
    this.renderEngine.getSunLight().intensity = p.sunIntensity;
    this.renderEngine.getHemiLight().intensity = p.hemiIntensity;
    this.renderEngine.getFillLight().intensity = p.fillIntensity;

    // Scene fog (applied every frame by WavelengthLighting; set its knobs here).
    const ls = this.renderEngine.lightSystem;
    ls.sceneFogBaseDensity = p.fogBaseDensity;
    ls.sceneFogDepthFactor = p.fogDepthFactor;
    ls.sceneFogShallow.setHex(p.fogShallowHex);
    ls.sceneFogDeep.setHex(p.fogDeepHex);

    // Background
    this.renderEngine.scene.background = new THREE.Color(p.backgroundHex);

    this.debugGui?.controllersRecursive().forEach((c) => c.updateDisplay());
    if (DEBUG) console.log(`🎬 Applied look preset: ${preset}`);
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

    // Cinematic folder (art direction)
    const cineFolder = this.debugGui.addFolder('Cinematic');
    cineFolder
      .add(this.debugParams, 'lookPreset', ['tropical-clear', 'inky-cinematic'])
      .name('Look Preset')
      .onChange((preset: 'tropical-clear' | 'inky-cinematic') => {
        this.applyLookPreset(preset);
      });
    cineFolder.add(this.debugParams, 'bloomIntensity', 0, 2).name('Bloom Intensity').onChange((v: number) => {
      this.renderEngine.postProcessing.setBloomIntensity(v);
    });
    cineFolder.add(this.debugParams, 'bloomThreshold', 0, 1).name('Bloom Threshold').onChange((v: number) => {
      this.renderEngine.postProcessing.setBloomThreshold(v, 0.8);
    });
    cineFolder.add(this.debugParams, 'absorptionScale', 0.02, 0.12).name('Absorption').onChange((v: number) => {
      this.renderEngine.postProcessing.setAbsorptionScale(v);
    });
    cineFolder.add(this.debugParams, 'turbidity', 0.0, 1.0).name('Turbidity').onChange((v: number) => {
      this.renderEngine.postProcessing.setTurbidity(v);
    });
    cineFolder.add(this.debugParams, 'vignetteOffset', 0.0, 1.0).name('Vignette Offset').onChange((v: number) => {
      this.renderEngine.postProcessing.setVignette(v, this.debugParams.vignetteDarkness);
    });
    cineFolder.add(this.debugParams, 'vignetteDarkness', 0.0, 1.0).name('Vignette Dark').onChange((v: number) => {
      this.renderEngine.postProcessing.setVignette(this.debugParams.vignetteOffset, v);
    });
    cineFolder.add(this.debugParams, 'chromaX', 0.0, 0.003).name('Chroma X').onChange((v: number) => {
      this.renderEngine.postProcessing.setChromaticAberration(v, this.debugParams.chromaY);
    });
    cineFolder.add(this.debugParams, 'chromaY', 0.0, 0.003).name('Chroma Y').onChange((v: number) => {
      this.renderEngine.postProcessing.setChromaticAberration(this.debugParams.chromaX, v);
    });
    cineFolder.open();

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
    if (DEBUG) console.log('🐠 Spawning COMPREHENSIVE marine ecosystem...');

    // === BAIT BALLS — fewer, tighter schools with negative space between them,
    // so each reads as a cohesive shoal rather than an even scatter of confetti ===
    this.spawnFishSchool(56, -10, 0, -5, 9, 0.55);
    this.spawnFishSchool(42, -12, 30, -24, 8, 0.55);
    this.spawnFishSchool(40, -9, -30, 24, 8, 0.55);
    this.spawnFishSchool(34, -16, 20, 30, 7, 0.55);
    this.spawnFishSchool(30, -7, -12, -32, 7, 0.55);

    // === MEDIUM SCHOOLS — tuna, mackerel, jacks ===
    this.spawnFishSchool(28, -13, 9, -9, 7, 1.0);
    this.spawnFishSchool(24, -15, -16, 18, 6.5, 1.0);
    this.spawnFishSchool(20, -10, 3, -24, 6, 1.0);

    // === LARGER REEF FISH — groupers, parrotfish, snappers ===
    this.spawnFishSchool(20, -19, 15, 11, 5.5, 1.4);
    this.spawnFishSchool(16, -21, -13, -17, 5, 1.4);

    // === SOLITARY DRIFTERS — a few, for life between the schools ===
    for (let i = 0; i < 10; i++) {
      const x = (Math.random() - 0.5) * 70;
      const y = -6 - Math.random() * 20;
      const z = (Math.random() - 0.5) * 70;
      createFish(this.world, x, y, z, 1 + Math.floor(Math.random() * 4));
    }

    // === SHARKS — diverse apex predators ===
    const sharkSpecies = ['great-white', 'hammerhead', 'tiger', 'reef', 'reef', 'reef', 'reef'] as const;
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() - 0.5) * 70;
      const y = -10 - Math.random() * 18;
      const z = (Math.random() - 0.5) * 70;
      const species = sharkSpecies[Math.floor(Math.random() * sharkSpecies.length)];
      createShark(this.world, x, y, z, species);
    }

    // === DOLPHINS — three social pods at different depths ===
    for (let pod = 0; pod < 3; pod++) {
      const dolphinPodSize = 5 + Math.floor(Math.random() * 4);
      const podX = (Math.random() - 0.5) * 55;
      const podZ = (Math.random() - 0.5) * 55;
      const podY = -4 - pod * 3;
      for (let i = 0; i < dolphinPodSize; i++) {
        const angle = (i / dolphinPodSize) * Math.PI * 2;
        const radius = 5 + Math.random() * 3;
        const x = podX + Math.cos(angle) * radius;
        const y = podY + (Math.random() - 0.5) * 2;
        const z = podZ + Math.sin(angle) * radius;
        const species = (i === 0 && pod === 2) ? 'orca' : 'bottlenose';
        createDolphin(this.world, x, y, z, species as any);
      }
    }

    // === JELLYFISH BLOOM — drifting at all depths, dense near surface ===
    const jellyfishSpecies = ['moon', 'box', 'crystal', 'lion'] as const;
    for (let i = 0; i < 24; i++) {
      const x = (Math.random() - 0.5) * 75;
      const y = -2 - Math.random() * 26;
      const z = (Math.random() - 0.5) * 75;
      const species = jellyfishSpecies[Math.floor(Math.random() * jellyfishSpecies.length)];
      createJellyfish(this.world, x, y, z, species);
    }

    // === RAYS — gliding near floor ===
    const raySpecies = ['manta', 'eagle', 'stingray', 'stingray', 'eagle'] as const;
    for (let i = 0; i < 14; i++) {
      const x = (Math.random() - 0.5) * 65;
      const y = -20 - Math.random() * 10;
      const z = (Math.random() - 0.5) * 65;
      const species = raySpecies[Math.floor(Math.random() * raySpecies.length)];
      createRay(this.world, x, y, z, species);
    }

    // === SEA TURTLES — graceful mid-water swimmers ===
    const turtleSpecies = ['green', 'hawksbill', 'loggerhead'] as const;
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() - 0.5) * 65;
      const z = (Math.random() - 0.5) * 65;
      const y = -6 - Math.random() * 16;
      createTurtle(this.world, x, y, z, turtleSpecies[Math.floor(Math.random() * 3)]);
    }

    // === WHALES — rare giants in far distance ===
    createWhale(this.world, 55, -17, -55, 'humpback');
    createWhale(this.world, -60, -21, 50, 'blue');
    if (Math.random() > 0.4) {
      createWhale(this.world, -45, -14, -55, 'humpback');
    }

    // === FLOOR LIFE — crabs, starfish, urchins dotting the seabed. Counts kept modest:
    // each is a many-part group (an urchin is ~25 meshes) that updates every frame, yet
    // reads as a small floor dot — so a high count is almost pure cost for no visible gain.
    for (let i = 0; i < 38; i++) {
      const x = (Math.random() - 0.5) * 85;
      const z = (Math.random() - 0.5) * 85;
      createCrab(this.world, x, 0, z);
    }

    for (let i = 0; i < 26; i++) {
      const x = (Math.random() - 0.5) * 85;
      const z = (Math.random() - 0.5) * 85;
      createStarfish(this.world, x, 0, z);
    }

    for (let i = 0; i < 16; i++) {
      const x = (Math.random() - 0.5) * 85;
      const z = (Math.random() - 0.5) * 85;
      createSeaUrchin(this.world, x, 0, z);
    }

    if (DEBUG) {
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
  }
  
  /**
   * Helper to spawn a school of fish in a specific location
   */
  // Auto-incrementing school ID counter
  private nextSchoolId: number = 1;

  private spawnFishSchool(
    count: number, 
    centerY: number, 
    centerX: number, 
    centerZ: number, 
    radius: number,
    sizeScale: number = 1.0
  ): void {
    const schoolId = this.nextSchoolId++;
    let leaderId = 0;

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

      // === School leader assignment ===
      SchoolLeader.schoolId[eid] = schoolId;
      if (i === 0) {
        // First fish is the leader: more wander, less cohesion
        SchoolLeader.isLeader[eid] = 1;
        SchoolLeader.leaderId[eid] = 0;
        leaderId = eid;
        FIRA.wanderWeight[eid] = 0.4;     // Leaders explore more
        FIRA.cohesionWeight[eid] = 1.0;   // Less pulled to center
      } else {
        // Followers: normal flocking + extra pull toward leader
        SchoolLeader.isLeader[eid] = 0;
        SchoolLeader.leaderId[eid] = leaderId;
      }
    }
  }
  
  /**
   * Start the simulation loop
   */
  public start(): void {
    if (DEBUG) console.log('▶️  Starting simulation...');
    this.loop();
  }
  
  /**
   * Stop the simulation loop
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      if (DEBUG) console.log('⏸️  Simulation paused');
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

    // Sync time of day from HDRI to world (for next frame's behavior systems)
    const hdri = this.renderEngine.getHDRIEnvironment();
    if (hdri) {
      this.world.timeOfDay = hdri.getTimeOfDay();
    }
    
    // Render (always runs) - pass deltaTime for post-processing distortion animation
    this.renderEngine.render(this.world.time.delta);
    
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
    this.cameraController.dispose();
    this.renderEngine.dispose();
    this.uiManager.dispose();
    this.debugGui.destroy();
    if (DEBUG) console.log('🗑️  Ocean Simulator disposed');
  }
  
  /**
   * Toggle pause state
   */
  public togglePause(): void {
    this.isPaused = !this.isPaused;
    this.uiManager.setPaused(this.isPaused);
    if (DEBUG) console.log(this.isPaused ? '⏸️  Paused' : '▶️  Resumed');
  }
  
  /**
   * Set time scale (simulation speed)
   */
  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.1, Math.min(10, scale));
    if (DEBUG) console.log(`⚡ Time scale set to ${this.timeScale}x`);
  }
  
  /**
   * Setup ocean parameter controls
   */
  private setupOceanControls(): void {
    // Wind speed control - update FFT ocean in real time
    this.uiManager.onWindSpeed((speed) => {
      if (DEBUG) console.log(`🌬️  Wind speed: ${speed} m/s`);
      this.renderEngine.setOceanParam('windSpeed', speed);
    });

    // Wave amplitude control - update FFT ocean in real time
    this.uiManager.onWaveAmplitude((amplitude) => {
      if (DEBUG) console.log(`🌊 Wave amplitude: ${amplitude}x`);
      this.renderEngine.setOceanParam('amplitude', amplitude);
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
      if (DEBUG) console.log(`🌦️  Weather: ${weather}`);
      // Update HDRI environment weather
      if (this.renderEngine && (this.renderEngine as any).hdriEnvironment) {
        (this.renderEngine as any).hdriEnvironment.setWeather(weather as any);
      }
    });

    // Quality preset control
    this.uiManager.onQuality((quality) => {
      if (DEBUG) console.log(`⚙️  Quality preset: ${quality}`);
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
      dof: boolean;
    }

    const presets: Record<string, QualityConfig> = {
      'low': {
        message: 'Low quality (best performance)',
        fftResolution: 128,
        choppiness: 1.5,
        amplitude: 1.5,
        pixelRatio: 1.0,
        dof: false, // depth of field is the priciest post effect — drop it first
      },
      'medium': {
        message: 'Medium quality (balanced)',
        fftResolution: 256,
        choppiness: 2.0,
        amplitude: 2.0,
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        dof: true,
      },
      'high': {
        message: 'High quality (better visuals)',
        fftResolution: 512,
        choppiness: 2.0,
        amplitude: 2.5,
        pixelRatio: Math.min(window.devicePixelRatio, 2.0),
        dof: true,
      },
      'ultra': {
        message: 'Ultra quality (photorealistic)',
        fftResolution: 512, // 1024 is too expensive for real-time
        choppiness: 2.5,
        amplitude: 3.0,
        pixelRatio: window.devicePixelRatio,
        dof: true,
      }
    };

    const config = presets[preset];
    if (config) {
      if (DEBUG) {
        console.log(`✨ ${config.message}`);
        console.log(`   FFT Resolution: ${config.fftResolution}`);
        console.log(`   Choppiness: ${config.choppiness}`);
        console.log(`   Wave Amplitude: ${config.amplitude}`);
        console.log(`   Pixel Ratio: ${config.pixelRatio.toFixed(1)}`);
      }

      // Apply FFT ocean parameters
      this.renderEngine.setOceanParam('resolution', config.fftResolution);
      this.renderEngine.setOceanParam('choppiness', config.choppiness);
      this.renderEngine.setOceanParam('amplitude', config.amplitude);

      // Adjust renderer pixel ratio
      this.renderEngine.renderer.setPixelRatio(config.pixelRatio);

      // Gate the expensive depth-of-field pass by preset.
      this.renderEngine.postProcessing.setDofEnabled(config.dof);
    }
  }
}

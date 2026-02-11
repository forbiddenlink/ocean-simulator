import { addEntity, addComponent } from 'bitecs';
import type { OceanWorld } from './World';
import { Position, Velocity, Acceleration, Rotation, Scale } from '../components/Transform';
import { Health, Energy, Size, Species, CreatureType, SwimmingStyle } from '../components/Biology';
import { FIRA, Vision, Memory, Wander } from '../components/Behavior';
import { Mesh, Color, Animation, DepthZone } from '../components/Rendering';
import { initializeBurstGlideParams } from '../systems/BiomechanicalAnimationSystem';
// Note: TurtleGeometry, BottomDwellerGeometry, and WhaleGeometry are used by the rendering system,
// not directly in the factory functions which only set up ECS components

/**
 * Creates a basic fish entity with default components
 */
export function createFish(
  world: OceanWorld,
  x: number,
  y: number,
  z: number,
  speciesId: number = 1
): number {
  const eid = addEntity(world);

  // Transform
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Position.z[eid] = z;

  addComponent(world, eid, Velocity);
  // Give fish realistic cruising velocity
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.3 + Math.random() * 0.5; // 0.3-0.8 m/s - realistic cruising
  Velocity.x[eid] = Math.cos(angle) * speed;
  Velocity.y[eid] = Math.sin(angle) * speed * 0.2; // Less vertical
  Velocity.z[eid] = (Math.random() - 0.5) * speed * 0.5;

  addComponent(world, eid, Acceleration);
  Acceleration.x[eid] = 0;
  Acceleration.y[eid] = 0;
  Acceleration.z[eid] = 0;

  addComponent(world, eid, Rotation);
  Rotation.x[eid] = 0;
  Rotation.y[eid] = 0;
  Rotation.z[eid] = 0;

  addComponent(world, eid, Scale);
  Scale.x[eid] = 2.5; // Much larger for clear visibility
  Scale.y[eid] = 2.5;
  Scale.z[eid] = 2.5;

  // Biology
  addComponent(world, eid, Health);
  Health.current[eid] = 100;
  Health.max[eid] = 100;

  addComponent(world, eid, Energy);
  Energy.current[eid] = 100;
  Energy.max[eid] = 100;
  Energy.metabolismRate[eid] = 0.5; // Units per second
  Energy.recoveryRate[eid] = 0.1;

  addComponent(world, eid, Size);
  Size.length[eid] = 1.0 + Math.random() * 0.5; // 1.0-1.5m
  Size.width[eid] = 0.3;
  Size.height[eid] = 0.3;
  Size.mass[eid] = Size.length[eid] * 5; // Rough approximation

  addComponent(world, eid, Species);
  Species.id[eid] = speciesId;
  Species.generation[eid] = 0;
  Species.depthPreference[eid] = y; // Prefer current depth

  // Add CreatureType component - CRITICAL for rendering system
  addComponent(world, eid, CreatureType);
  CreatureType.type[eid] = 0; // Fish (0 = fish, 1 = shark, 2 = dolphin, 3 = jellyfish, 4 = ray)
  CreatureType.variant[eid] = speciesId % 4; // Different fish species

  // Behavior - FIRA algorithm
  // Behavior - FIRA algorithm
  addComponent(world, eid, FIRA);
  FIRA.separationWeight[eid] = 2.0;    // Moderate separation
  FIRA.alignmentWeight[eid] = 3.0;     // Strong alignment
  FIRA.cohesionWeight[eid] = 0.8;      // Mild cohesion
  FIRA.wanderWeight[eid] = 0.3;        // Minimal wander
  FIRA.perceptionRadius[eid] = 15.0;   // Wider perception
  FIRA.separationRadius[eid] = 3.0;    // More space
  const bodyLength = Size.length[eid];
  FIRA.maxSpeed[eid] = bodyLength * 3.0 + Math.random() * bodyLength; // 3-4 BL/s max burst
  FIRA.maxForce[eid] = 5.0;            // Strong turning force
  FIRA.minSpeed[eid] = 0.15;           // Small minimum to keep fish moving

  addComponent(world, eid, Wander);
  Wander.angle[eid] = Math.random() * Math.PI * 2;
  Wander.verticalAngle[eid] = Math.PI * 0.5; // Start at equator (horizontal)
  Wander.distance[eid] = 2.0;
  Wander.radius[eid] = 1.0;
  Wander.rate[eid] = 0.1;              // Much slower wander changes

  // Vision - 300° FOV with 60° blind spot
  addComponent(world, eid, Vision);
  Vision.range[eid] = 5.0;
  Vision.fovAngle[eid] = (300 * Math.PI) / 180; // 5.236 radians
  Vision.blindSpotAngle[eid] = (60 * Math.PI) / 180; // 1.047 radians
  Vision.clarity[eid] = 1.0;

  // Memory
  addComponent(world, eid, Memory);
  Memory.foodLocationX[eid] = 0;
  Memory.foodLocationY[eid] = 0;
  Memory.foodLocationZ[eid] = 0;
  Memory.foodMemoryAge[eid] = 999999;
  Memory.predatorMemoryAge[eid] = 999999;
  Memory.timeSinceUpdate[eid] = 0;

  // Rendering
  addComponent(world, eid, Mesh);
  Mesh.meshId[eid] = eid; // Will be set properly when mesh is created
  Mesh.visible[eid] = 1;

  addComponent(world, eid, Color);
  // Vibrant tropical fish color palettes - highly saturated for underwater visibility
  const colorPalettes = [
    { r: 1.0, g: 0.4, b: 0.0 },   // Clownfish orange (more saturated)
    { r: 0.0, g: 0.5, b: 1.0 },   // Blue tang (vivid blue)
    { r: 1.0, g: 0.95, b: 0.0 },  // Yellow tang (bright yellow)
    { r: 1.0, g: 0.1, b: 0.2 },   // Red snapper (vivid red)
    { r: 0.0, g: 1.0, b: 0.4 },   // Green chromis (bright green)
    { r: 0.7, g: 0.2, b: 1.0 },   // Purple anthias (vivid purple)
    { r: 1.0, g: 0.5, b: 0.0 },   // Butterflyfish (orange-gold)
    { r: 0.2, g: 0.6, b: 1.0 },   // Blue schooling fish
    { r: 1.0, g: 0.3, b: 0.5 },   // Pink anthias
    { r: 1.0, g: 0.8, b: 0.0 },   // Goldfish (bright gold)
    { r: 0.0, g: 0.8, b: 0.8 },   // Cyan damselfish
    { r: 0.5, g: 1.0, b: 0.2 },   // Lime green wrasse
    { r: 1.0, g: 0.6, b: 0.8 },   // Pink parrotfish
    { r: 0.3, g: 0.3, b: 1.0 },   // Electric blue damsel
  ];
  const palette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
  // Add slight variation within the palette
  Color.r[eid] = Math.max(0, Math.min(1, palette.r + (Math.random() - 0.5) * 0.1));
  Color.g[eid] = Math.max(0, Math.min(1, palette.g + (Math.random() - 0.5) * 0.1));
  Color.b[eid] = Math.max(0, Math.min(1, palette.b + (Math.random() - 0.5) * 0.1));
  Color.a[eid] = 1.0;

  addComponent(world, eid, Animation);
  Animation.phase[eid] = Math.random() * Math.PI * 2;
  Animation.frequency[eid] = 2.0;
  Animation.amplitude[eid] = 0.2;
  Animation.waveSpeed[eid] = 1.0;

  addComponent(world, eid, DepthZone);
  DepthZone.depthMeters[eid] = Math.abs(y);
  updateDepthZone(eid, Math.abs(y));

  // Initialize burst-glide animation parameters
  initializeBurstGlideParams(eid);

  return eid;
}

/**
 * Updates depth zone classification based on depth
 */
function updateDepthZone(eid: number, depth: number): void {
  if (depth < 200) {
    DepthZone.zone[eid] = 0; // Epipelagic
    DepthZone.lightLevel[eid] = Math.exp(-depth / 50); // Exponential decay
  } else if (depth < 1000) {
    DepthZone.zone[eid] = 1; // Mesopelagic
    DepthZone.lightLevel[eid] = Math.exp(-depth / 200);
  } else if (depth < 4000) {
    DepthZone.zone[eid] = 2; // Bathypelagic
    DepthZone.lightLevel[eid] = 0.01;
  } else if (depth < 6000) {
    DepthZone.zone[eid] = 3; // Abyssopelagic
    DepthZone.lightLevel[eid] = 0.001;
  } else {
    DepthZone.zone[eid] = 4; // Hadopelagic
    DepthZone.lightLevel[eid] = 0.0001;
  }

  // Pressure increases by 1 atm per 10m depth
  DepthZone.pressure[eid] = 1 + depth / 10;
}

/**
 * Create a shark entity
 */
export function createShark(
  world: OceanWorld,
  x: number,
  y: number,
  z: number,
  species: 'great-white' | 'hammerhead' | 'tiger' | 'reef' = 'great-white'
): number {
  const eid = addEntity(world);
  
  // Transform
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Position.z[eid] = z;
  
  addComponent(world, eid, Velocity);
  const angle = Math.random() * Math.PI * 2;
  const speed = 2.0 + Math.random() * 1.0;
  Velocity.x[eid] = Math.cos(angle) * speed;
  Velocity.y[eid] = Math.sin(angle) * speed * 0.3;
  Velocity.z[eid] = (Math.random() - 0.5) * speed;

  addComponent(world, eid, Acceleration);
  Acceleration.x[eid] = 0;
  Acceleration.y[eid] = 0;
  Acceleration.z[eid] = 0;

  addComponent(world, eid, Rotation);
  addComponent(world, eid, Scale);
  const sizeMultiplier = species === 'reef' ? 1.0 : species === 'great-white' ? 1.5 : 1.2;
  Scale.x[eid] = sizeMultiplier;
  Scale.y[eid] = sizeMultiplier;
  Scale.z[eid] = sizeMultiplier;
  
  // Biology
  addComponent(world, eid, Health);
  Health.current[eid] = 150;
  Health.max[eid] = 150;
  
  addComponent(world, eid, Energy);
  Energy.current[eid] = 200;
  Energy.max[eid] = 200;
  Energy.metabolismRate[eid] = 1.0;
  Energy.recoveryRate[eid] = 0.05;
  
  addComponent(world, eid, Size);
  Size.length[eid] = 3.0 * sizeMultiplier;
  Size.width[eid] = 0.6 * sizeMultiplier;
  Size.height[eid] = 0.6 * sizeMultiplier;
  Size.mass[eid] = Size.length[eid] * 100;
  
  addComponent(world, eid, CreatureType);
  CreatureType.type[eid] = 1; // Shark
  CreatureType.variant[eid] = species === 'great-white' ? 0 : species === 'hammerhead' ? 1 : species === 'tiger' ? 2 : 3;
  CreatureType.isPredator[eid] = 1;
  CreatureType.isAggressive[eid] = species === 'reef' ? 0 : 1;
  
  addComponent(world, eid, SwimmingStyle);
  SwimmingStyle.style[eid] = 0; // Body-caudal
  SwimmingStyle.frequency[eid] = 1.5;
  SwimmingStyle.amplitude[eid] = 0.3;
  SwimmingStyle.efficiency[eid] = 0.9;
  
  // Behavior
  addComponent(world, eid, FIRA);
  FIRA.separationWeight[eid] = 5.0;
  FIRA.alignmentWeight[eid] = 1.0;
  FIRA.cohesionWeight[eid] = 0.2;
  FIRA.wanderWeight[eid] = 1.0;
  FIRA.perceptionRadius[eid] = 15.0;
  FIRA.separationRadius[eid] = 5.0;
  FIRA.maxSpeed[eid] = 8.0;
  FIRA.maxForce[eid] = 3.0; // Must be high enough to overcome drag and maintain speed
  FIRA.minSpeed[eid] = 2.0;

  addComponent(world, eid, Wander);
  Wander.angle[eid] = Math.random() * Math.PI * 2;
  Wander.verticalAngle[eid] = Math.PI * 0.5; // Start at equator (horizontal)
  Wander.distance[eid] = 3.0;
  Wander.radius[eid] = 1.5;
  Wander.rate[eid] = 0.08; // Slow, steady wander

  addComponent(world, eid, Vision);
  Vision.range[eid] = 15.0;
  Vision.fovAngle[eid] = (300 * Math.PI) / 180;
  Vision.blindSpotAngle[eid] = (60 * Math.PI) / 180;
  Vision.clarity[eid] = 1.0;

  // Rendering
  addComponent(world, eid, Mesh);
  Mesh.meshId[eid] = eid;
  Mesh.visible[eid] = 1;

  addComponent(world, eid, Color);
  Color.r[eid] = 0.3;
  Color.g[eid] = 0.4;
  Color.b[eid] = 0.5;
  Color.a[eid] = 1.0;

  // Initialize burst-glide animation parameters
  initializeBurstGlideParams(eid);

  return eid;
}

/**
 * Create a dolphin entity
 */
export function createDolphin(
  world: OceanWorld,
  x: number,
  y: number,
  z: number,
  species: 'bottlenose' | 'spinner' | 'orca' = 'bottlenose'
): number {
  const eid = addEntity(world);
  
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Position.z[eid] = z;
  
  addComponent(world, eid, Velocity);
  const angle = Math.random() * Math.PI * 2;
  const speed = 4.0 + Math.random() * 2.0;
  Velocity.x[eid] = Math.cos(angle) * speed;
  Velocity.y[eid] = Math.sin(angle) * speed * 0.2;
  Velocity.z[eid] = (Math.random() - 0.5) * speed;

  addComponent(world, eid, Acceleration);
  Acceleration.x[eid] = 0;
  Acceleration.y[eid] = 0;
  Acceleration.z[eid] = 0;

  addComponent(world, eid, Rotation);
  addComponent(world, eid, Scale);
  const sizeMultiplier = species === 'orca' ? 2.0 : 1.0;
  Scale.x[eid] = sizeMultiplier;
  Scale.y[eid] = sizeMultiplier;
  Scale.z[eid] = sizeMultiplier;
  
  addComponent(world, eid, Health);
  Health.current[eid] = 120;
  Health.max[eid] = 120;
  
  addComponent(world, eid, Energy);
  Energy.current[eid] = 180;
  Energy.max[eid] = 180;
  Energy.metabolismRate[eid] = 0.8;
  Energy.recoveryRate[eid] = 0.15;
  
  addComponent(world, eid, Size);
  Size.length[eid] = 2.5 * sizeMultiplier;
  Size.width[eid] = 0.5 * sizeMultiplier;
  Size.height[eid] = 0.5 * sizeMultiplier;
  Size.mass[eid] = Size.length[eid] * 80;
  
  addComponent(world, eid, CreatureType);
  CreatureType.type[eid] = 2; // Dolphin
  CreatureType.variant[eid] = species === 'bottlenose' ? 0 : species === 'spinner' ? 1 : 2;
  CreatureType.isPredator[eid] = species === 'orca' ? 1 : 0;
  CreatureType.isAggressive[eid] = 0;
  
  addComponent(world, eid, SwimmingStyle);
  SwimmingStyle.style[eid] = 3; // Flukes (cetacean)
  SwimmingStyle.frequency[eid] = 2.0;
  SwimmingStyle.amplitude[eid] = 0.4;
  SwimmingStyle.efficiency[eid] = 0.95;
  
  // Dolphins are highly social
  addComponent(world, eid, FIRA);
  FIRA.separationWeight[eid] = 2.0;
  FIRA.alignmentWeight[eid] = 6.0;
  FIRA.cohesionWeight[eid] = 3.0;
  FIRA.wanderWeight[eid] = 0.8;
  FIRA.perceptionRadius[eid] = 20.0;
  FIRA.separationRadius[eid] = 4.0;
  FIRA.maxSpeed[eid] = 12.0;
  FIRA.maxForce[eid] = 4.0; // Must be high enough to overcome drag and maintain speed
  FIRA.minSpeed[eid] = 3.0;

  addComponent(world, eid, Wander);
  Wander.angle[eid] = Math.random() * Math.PI * 2;
  Wander.verticalAngle[eid] = Math.PI * 0.5; // Start at equator (horizontal)
  Wander.distance[eid] = 3.0;
  Wander.radius[eid] = 1.5;
  Wander.rate[eid] = 0.12; // Playful wander

  addComponent(world, eid, Vision);
  Vision.range[eid] = 20.0;
  Vision.fovAngle[eid] = (300 * Math.PI) / 180;
  Vision.blindSpotAngle[eid] = (60 * Math.PI) / 180;
  Vision.clarity[eid] = 1.0;

  addComponent(world, eid, Mesh);
  Mesh.meshId[eid] = eid;
  Mesh.visible[eid] = 1;

  addComponent(world, eid, Color);
  Color.r[eid] = species === 'orca' ? 0.1 : 0.4;
  Color.g[eid] = species === 'orca' ? 0.1 : 0.5;
  Color.b[eid] = species === 'orca' ? 0.1 : 0.6;
  Color.a[eid] = 1.0;

  // Initialize burst-glide animation parameters
  initializeBurstGlideParams(eid);

  return eid;
}

/**
 * Create a jellyfish entity
 */
export function createJellyfish(
  world: OceanWorld,
  x: number,
  y: number,
  z: number,
  species: 'moon' | 'box' | 'lion' | 'crystal' = 'moon'
): number {
  const eid = addEntity(world);
  
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Position.z[eid] = z;
  
  addComponent(world, eid, Velocity);
  // Jellyfish drift slowly
  Velocity.x[eid] = (Math.random() - 0.5) * 0.3;
  Velocity.y[eid] = -0.1 + Math.random() * 0.3; // Slight upward movement
  Velocity.z[eid] = (Math.random() - 0.5) * 0.3;

  addComponent(world, eid, Acceleration);
  Acceleration.x[eid] = 0;
  Acceleration.y[eid] = 0;
  Acceleration.z[eid] = 0;

  addComponent(world, eid, Rotation);
  addComponent(world, eid, Scale);
  Scale.x[eid] = 1.0;
  Scale.y[eid] = 1.0;
  Scale.z[eid] = 1.0;
  
  addComponent(world, eid, Health);
  Health.current[eid] = 50;
  Health.max[eid] = 50;
  
  addComponent(world, eid, Energy);
  Energy.current[eid] = 80;
  Energy.max[eid] = 80;
  Energy.metabolismRate[eid] = 0.2;
  Energy.recoveryRate[eid] = 0.05;
  
  addComponent(world, eid, Size);
  Size.length[eid] = 0.4;
  Size.width[eid] = 0.4;
  Size.height[eid] = 0.6;
  Size.mass[eid] = 2.0;
  
  addComponent(world, eid, CreatureType);
  CreatureType.type[eid] = 3; // Jellyfish
  CreatureType.variant[eid] = species === 'moon' ? 0 : species === 'box' ? 1 : species === 'lion' ? 2 : 3;
  CreatureType.isPredator[eid] = species === 'box' ? 1 : 0;
  CreatureType.isAggressive[eid] = 0;
  
  addComponent(world, eid, SwimmingStyle);
  SwimmingStyle.style[eid] = 2; // Jet propulsion
  SwimmingStyle.frequency[eid] = 0.8;
  SwimmingStyle.amplitude[eid] = 0.5;
  SwimmingStyle.efficiency[eid] = 0.3;
  
  addComponent(world, eid, Mesh);
  Mesh.meshId[eid] = eid;
  Mesh.visible[eid] = 1;
  
  addComponent(world, eid, Color);
  Color.r[eid] = species === 'lion' ? 1.0 : 0.75;
  Color.g[eid] = species === 'lion' ? 0.6 : 0.85;
  Color.b[eid] = 0.95;
  Color.a[eid] = 0.7;
  
  addComponent(world, eid, Animation);
  Animation.phase[eid] = Math.random() * Math.PI * 2;
  Animation.frequency[eid] = 0.8;
  Animation.amplitude[eid] = 0.3;
  Animation.waveSpeed[eid] = 1.2;
  
  return eid;
}

/**
 * Create a ray entity
 */
export function createRay(
  world: OceanWorld,
  x: number,
  y: number,
  z: number,
  species: 'manta' | 'eagle' | 'stingray' | 'electric' = 'manta'
): number {
  const eid = addEntity(world);
  
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Position.z[eid] = z;
  
  addComponent(world, eid, Velocity);
  const angle = Math.random() * Math.PI * 2;
  const speed = 1.5 + Math.random() * 1.0;
  Velocity.x[eid] = Math.cos(angle) * speed;
  Velocity.y[eid] = 0; // Rays glide horizontally
  Velocity.z[eid] = Math.sin(angle) * speed;

  addComponent(world, eid, Acceleration);
  Acceleration.x[eid] = 0;
  Acceleration.y[eid] = 0;
  Acceleration.z[eid] = 0;

  addComponent(world, eid, Rotation);
  addComponent(world, eid, Scale);
  const sizeMultiplier = species === 'manta' ? 1.5 : 0.8;
  Scale.x[eid] = sizeMultiplier;
  Scale.y[eid] = sizeMultiplier;
  Scale.z[eid] = sizeMultiplier;
  
  addComponent(world, eid, Health);
  Health.current[eid] = 100;
  Health.max[eid] = 100;
  
  addComponent(world, eid, Energy);
  Energy.current[eid] = 150;
  Energy.max[eid] = 150;
  Energy.metabolismRate[eid] = 0.4;
  Energy.recoveryRate[eid] = 0.1;
  
  addComponent(world, eid, Size);
  Size.length[eid] = 2.0 * sizeMultiplier;
  Size.width[eid] = 3.0 * sizeMultiplier; // Wingspan
  Size.height[eid] = 0.3 * sizeMultiplier;
  Size.mass[eid] = Size.width[eid] * 50;
  
  addComponent(world, eid, CreatureType);
  CreatureType.type[eid] = 4; // Ray
  CreatureType.variant[eid] = species === 'manta' ? 0 : species === 'eagle' ? 1 : species === 'stingray' ? 2 : 3;
  CreatureType.isPredator[eid] = 0;
  CreatureType.isAggressive[eid] = 0;
  
  addComponent(world, eid, SwimmingStyle);
  SwimmingStyle.style[eid] = 1; // Pectoral (wing flapping)
  SwimmingStyle.frequency[eid] = 0.5;
  SwimmingStyle.amplitude[eid] = 0.6;
  SwimmingStyle.efficiency[eid] = 0.85;
  
  addComponent(world, eid, FIRA);
  FIRA.separationWeight[eid] = 3.0;
  FIRA.alignmentWeight[eid] = 2.0;
  FIRA.cohesionWeight[eid] = species === 'manta' ? 2.0 : 0.5; // Mantas are more social
  FIRA.wanderWeight[eid] = 1.0;
  FIRA.perceptionRadius[eid] = 10.0;
  FIRA.separationRadius[eid] = 5.0;
  FIRA.maxSpeed[eid] = 5.0;
  FIRA.maxForce[eid] = 2.0; // Must be high enough to overcome drag and maintain speed
  FIRA.minSpeed[eid] = 1.0;

  addComponent(world, eid, Wander);
  Wander.angle[eid] = Math.random() * Math.PI * 2;
  Wander.verticalAngle[eid] = Math.PI * 0.5; // Start at equator (horizontal)
  Wander.distance[eid] = 2.5;
  Wander.radius[eid] = 1.2;
  Wander.rate[eid] = 0.06; // Gentle, gliding wander

  addComponent(world, eid, Vision);
  Vision.range[eid] = 10.0;
  Vision.fovAngle[eid] = (300 * Math.PI) / 180;
  Vision.blindSpotAngle[eid] = (60 * Math.PI) / 180;
  Vision.clarity[eid] = 1.0;

  addComponent(world, eid, Mesh);
  Mesh.meshId[eid] = eid;
  Mesh.visible[eid] = 1;

  addComponent(world, eid, Color);
  Color.r[eid] = 0.2;
  Color.g[eid] = 0.3;
  Color.b[eid] = 0.4;
  Color.a[eid] = 1.0;

  // Initialize burst-glide animation parameters
  initializeBurstGlideParams(eid);

  return eid;
}

/**
 * Create a sea turtle entity
 */
export function createTurtle(
  world: OceanWorld,
  x: number,
  y: number,
  z: number,
  species: 'green' | 'hawksbill' | 'loggerhead' = 'green'
): number {
  const eid = addEntity(world);

  // Transform
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Position.z[eid] = z;

  addComponent(world, eid, Velocity);
  // Turtles are slow swimmers
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.2 + Math.random() * 0.2; // 0.2-0.4 m/s - slow cruising
  Velocity.x[eid] = Math.cos(angle) * speed;
  Velocity.y[eid] = Math.sin(angle) * speed * 0.1; // Minimal vertical movement
  Velocity.z[eid] = (Math.random() - 0.5) * speed * 0.3;

  addComponent(world, eid, Acceleration);
  Acceleration.x[eid] = 0;
  Acceleration.y[eid] = 0;
  Acceleration.z[eid] = 0;

  addComponent(world, eid, Rotation);
  addComponent(world, eid, Scale);
  const sizeMultiplier = species === 'loggerhead' ? 1.2 : species === 'hawksbill' ? 0.8 : 1.0;
  Scale.x[eid] = sizeMultiplier;
  Scale.y[eid] = sizeMultiplier;
  Scale.z[eid] = sizeMultiplier;

  // Biology
  addComponent(world, eid, Health);
  Health.current[eid] = 200;
  Health.max[eid] = 200;

  addComponent(world, eid, Energy);
  Energy.current[eid] = 250;
  Energy.max[eid] = 250;
  Energy.metabolismRate[eid] = 0.3; // Low metabolism
  Energy.recoveryRate[eid] = 0.08;

  addComponent(world, eid, Size);
  Size.length[eid] = 1.0 * sizeMultiplier; // 1m shell length
  Size.width[eid] = 0.8 * sizeMultiplier;
  Size.height[eid] = 0.35 * sizeMultiplier;
  Size.mass[eid] = Size.length[eid] * 150; // Turtles are heavy

  addComponent(world, eid, CreatureType);
  CreatureType.type[eid] = 5; // Turtle
  CreatureType.variant[eid] = species === 'green' ? 0 : species === 'hawksbill' ? 1 : 2;
  CreatureType.isPredator[eid] = 0;
  CreatureType.isAggressive[eid] = 0;

  addComponent(world, eid, SwimmingStyle);
  SwimmingStyle.style[eid] = 1; // Pectoral (flipper-based)
  SwimmingStyle.frequency[eid] = 0.4; // Slow flipper beats
  SwimmingStyle.amplitude[eid] = 0.5;
  SwimmingStyle.efficiency[eid] = 0.8;

  // Behavior - FIRA algorithm
  addComponent(world, eid, FIRA);
  FIRA.separationWeight[eid] = 2.0;
  FIRA.alignmentWeight[eid] = 1.0;
  FIRA.cohesionWeight[eid] = 0.5; // Turtles are mostly solitary
  FIRA.wanderWeight[eid] = 1.5;
  FIRA.perceptionRadius[eid] = 20.0; // Large perception radius
  FIRA.separationRadius[eid] = 5.0;
  FIRA.maxSpeed[eid] = 2.0; // Slow max speed
  FIRA.maxForce[eid] = 1.0; // Must be high enough to overcome drag
  FIRA.minSpeed[eid] = 0.0; // Can hover/rest

  addComponent(world, eid, Wander);
  Wander.angle[eid] = Math.random() * Math.PI * 2;
  Wander.verticalAngle[eid] = Math.PI * 0.5; // Start at equator (horizontal)
  Wander.distance[eid] = 2.0;
  Wander.radius[eid] = 1.0;
  Wander.rate[eid] = 0.15; // Exploratory wander

  addComponent(world, eid, Vision);
  Vision.range[eid] = 20.0;
  Vision.fovAngle[eid] = (300 * Math.PI) / 180;
  Vision.blindSpotAngle[eid] = (60 * Math.PI) / 180;
  Vision.clarity[eid] = 1.0;

  // Rendering
  addComponent(world, eid, Mesh);
  Mesh.meshId[eid] = eid;
  Mesh.visible[eid] = 1;

  addComponent(world, eid, Color);
  // Species-specific colors
  if (species === 'green') {
    Color.r[eid] = 0.29; // Olive-brown
    Color.g[eid] = 0.35;
    Color.b[eid] = 0.23;
  } else if (species === 'hawksbill') {
    Color.r[eid] = 0.42; // Amber-brown
    Color.g[eid] = 0.29;
    Color.b[eid] = 0.16;
  } else {
    Color.r[eid] = 0.48; // Reddish-brown
    Color.g[eid] = 0.35;
    Color.b[eid] = 0.23;
  }
  Color.a[eid] = 1.0;

  // Initialize burst-glide animation parameters
  initializeBurstGlideParams(eid);

  return eid;
}

/**
 * Create a crab entity (bottom-dwelling)
 */
export function createCrab(
  world: OceanWorld,
  x: number,
  _y: number,
  z: number
): number {
  const eid = addEntity(world);

  // Transform - constrained to floor
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = -29.5; // On the ocean floor
  Position.z[eid] = z;

  addComponent(world, eid, Velocity);
  // Crabs move very slowly, mostly sideways
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.05 + Math.random() * 0.1; // Very slow
  Velocity.x[eid] = Math.cos(angle) * speed;
  Velocity.y[eid] = 0; // No vertical movement
  Velocity.z[eid] = Math.sin(angle) * speed;

  addComponent(world, eid, Acceleration);
  Acceleration.x[eid] = 0;
  Acceleration.y[eid] = 0;
  Acceleration.z[eid] = 0;

  addComponent(world, eid, Rotation);
  addComponent(world, eid, Scale);
  Scale.x[eid] = 1.0;
  Scale.y[eid] = 1.0;
  Scale.z[eid] = 1.0;

  // Biology
  addComponent(world, eid, Health);
  Health.current[eid] = 30;
  Health.max[eid] = 30;

  addComponent(world, eid, Energy);
  Energy.current[eid] = 50;
  Energy.max[eid] = 50;
  Energy.metabolismRate[eid] = 0.1;
  Energy.recoveryRate[eid] = 0.05;

  addComponent(world, eid, Size);
  Size.length[eid] = 0.16; // 16cm
  Size.width[eid] = 0.2;
  Size.height[eid] = 0.06;
  Size.mass[eid] = 0.5;

  addComponent(world, eid, CreatureType);
  CreatureType.type[eid] = 6; // Crab
  CreatureType.variant[eid] = 0;
  CreatureType.isPredator[eid] = 0;
  CreatureType.isAggressive[eid] = 0;

  // No FIRA system - crabs stay on floor and don't school
  // No SwimmingStyle - crabs walk, don't swim

  // Rendering
  addComponent(world, eid, Mesh);
  Mesh.meshId[eid] = eid;
  Mesh.visible[eid] = 1;

  addComponent(world, eid, Color);
  Color.r[eid] = 0.7; // Reddish-orange
  Color.g[eid] = 0.3;
  Color.b[eid] = 0.2;
  Color.a[eid] = 1.0;

  return eid;
}

/**
 * Create a starfish entity (stationary bottom-dwelling)
 */
export function createStarfish(
  world: OceanWorld,
  x: number,
  _y: number,
  z: number
): number {
  const eid = addEntity(world);

  // Transform - stationary on floor
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = -29.8; // Flat on the ocean floor
  Position.z[eid] = z;

  // No velocity - starfish are essentially stationary
  addComponent(world, eid, Velocity);
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;
  Velocity.z[eid] = 0;

  addComponent(world, eid, Acceleration);
  Acceleration.x[eid] = 0;
  Acceleration.y[eid] = 0;
  Acceleration.z[eid] = 0;

  addComponent(world, eid, Rotation);
  // Random rotation on floor
  Rotation.y[eid] = Math.random() * Math.PI * 2;

  addComponent(world, eid, Scale);
  Scale.x[eid] = 1.0;
  Scale.y[eid] = 1.0;
  Scale.z[eid] = 1.0;

  // Biology
  addComponent(world, eid, Health);
  Health.current[eid] = 20;
  Health.max[eid] = 20;

  addComponent(world, eid, Energy);
  Energy.current[eid] = 30;
  Energy.max[eid] = 30;
  Energy.metabolismRate[eid] = 0.02; // Very low metabolism
  Energy.recoveryRate[eid] = 0.01;

  addComponent(world, eid, Size);
  Size.length[eid] = 0.3; // 30cm diameter
  Size.width[eid] = 0.3;
  Size.height[eid] = 0.05;
  Size.mass[eid] = 0.2;

  addComponent(world, eid, CreatureType);
  CreatureType.type[eid] = 7; // Starfish
  CreatureType.variant[eid] = 0;
  CreatureType.isPredator[eid] = 0;
  CreatureType.isAggressive[eid] = 0;

  // No FIRA or SwimmingStyle - stationary creature

  // Rendering
  addComponent(world, eid, Mesh);
  Mesh.meshId[eid] = eid;
  Mesh.visible[eid] = 1;

  addComponent(world, eid, Color);
  // Orange/red starfish
  Color.r[eid] = 0.9;
  Color.g[eid] = 0.4;
  Color.b[eid] = 0.2;
  Color.a[eid] = 1.0;

  return eid;
}

/**
 * Create a sea urchin entity (stationary bottom-dwelling)
 */
export function createSeaUrchin(
  world: OceanWorld,
  x: number,
  _y: number,
  z: number
): number {
  const eid = addEntity(world);

  // Transform - stationary on floor
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = -29.8; // On the ocean floor
  Position.z[eid] = z;

  // No velocity - sea urchins are stationary
  addComponent(world, eid, Velocity);
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;
  Velocity.z[eid] = 0;

  addComponent(world, eid, Acceleration);
  Acceleration.x[eid] = 0;
  Acceleration.y[eid] = 0;
  Acceleration.z[eid] = 0;

  addComponent(world, eid, Rotation);
  addComponent(world, eid, Scale);
  Scale.x[eid] = 1.0;
  Scale.y[eid] = 1.0;
  Scale.z[eid] = 1.0;

  // Biology
  addComponent(world, eid, Health);
  Health.current[eid] = 15;
  Health.max[eid] = 15;

  addComponent(world, eid, Energy);
  Energy.current[eid] = 25;
  Energy.max[eid] = 25;
  Energy.metabolismRate[eid] = 0.01; // Extremely low metabolism
  Energy.recoveryRate[eid] = 0.005;

  addComponent(world, eid, Size);
  Size.length[eid] = 0.15; // 15cm diameter body
  Size.width[eid] = 0.15;
  Size.height[eid] = 0.15;
  Size.mass[eid] = 0.3;

  addComponent(world, eid, CreatureType);
  CreatureType.type[eid] = 8; // Sea Urchin
  CreatureType.variant[eid] = 0;
  CreatureType.isPredator[eid] = 0;
  CreatureType.isAggressive[eid] = 0;

  // No FIRA or SwimmingStyle - stationary creature

  // Rendering
  addComponent(world, eid, Mesh);
  Mesh.meshId[eid] = eid;
  Mesh.visible[eid] = 1;

  addComponent(world, eid, Color);
  // Dark purple/black sea urchin
  Color.r[eid] = 0.2;
  Color.g[eid] = 0.1;
  Color.b[eid] = 0.3;
  Color.a[eid] = 1.0;

  return eid;
}

/**
 * Create a whale entity (majestic large creature)
 */
export function createWhale(
  world: OceanWorld,
  x: number,
  y: number,
  z: number,
  species: 'humpback' | 'blue' = 'humpback'
): number {
  const eid = addEntity(world);

  // Transform
  addComponent(world, eid, Position);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Position.z[eid] = z;

  addComponent(world, eid, Velocity);
  // Whales are slow, majestic swimmers
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.5 + Math.random() * 0.5; // 0.5-1.0 m/s - slow cruising
  Velocity.x[eid] = Math.cos(angle) * speed;
  Velocity.y[eid] = Math.sin(angle) * speed * 0.1; // Minimal vertical movement
  Velocity.z[eid] = (Math.random() - 0.5) * speed * 0.3;

  addComponent(world, eid, Acceleration);
  Acceleration.x[eid] = 0;
  Acceleration.y[eid] = 0;
  Acceleration.z[eid] = 0;

  addComponent(world, eid, Rotation);
  addComponent(world, eid, Scale);
  const sizeMultiplier = species === 'blue' ? 1.5 : 1.0; // Blue whales are larger
  Scale.x[eid] = sizeMultiplier;
  Scale.y[eid] = sizeMultiplier;
  Scale.z[eid] = sizeMultiplier;

  // Biology
  addComponent(world, eid, Health);
  Health.current[eid] = 500;
  Health.max[eid] = 500;

  addComponent(world, eid, Energy);
  Energy.current[eid] = 600;
  Energy.max[eid] = 600;
  Energy.metabolismRate[eid] = 0.5; // Large but efficient
  Energy.recoveryRate[eid] = 0.2;

  addComponent(world, eid, Size);
  Size.length[eid] = 12.0 * sizeMultiplier; // 12m for humpback, 18m for blue
  Size.width[eid] = 3.0 * sizeMultiplier;
  Size.height[eid] = 3.0 * sizeMultiplier;
  Size.mass[eid] = Size.length[eid] * 3000; // Whales are massive

  addComponent(world, eid, CreatureType);
  CreatureType.type[eid] = 9; // Whale
  CreatureType.variant[eid] = species === 'humpback' ? 0 : 1;
  CreatureType.isPredator[eid] = 0; // Filter feeders
  CreatureType.isAggressive[eid] = 0;

  addComponent(world, eid, SwimmingStyle);
  SwimmingStyle.style[eid] = 3; // Flukes (like dolphins)
  SwimmingStyle.frequency[eid] = 0.3; // Very slow fluke beats
  SwimmingStyle.amplitude[eid] = 0.4;
  SwimmingStyle.efficiency[eid] = 0.95; // Very efficient swimmers

  // Behavior - FIRA algorithm
  addComponent(world, eid, FIRA);
  FIRA.separationWeight[eid] = 3.0;
  FIRA.alignmentWeight[eid] = 1.0;
  FIRA.cohesionWeight[eid] = 0.3; // Mostly solitary
  FIRA.wanderWeight[eid] = 1.0;
  FIRA.perceptionRadius[eid] = 50.0; // Huge perception radius
  FIRA.separationRadius[eid] = 15.0; // They're big, need space
  FIRA.maxSpeed[eid] = 4.0;
  FIRA.maxForce[eid] = 1.5; // Must be high enough to overcome drag
  FIRA.minSpeed[eid] = 0.0; // Can hover/rest

  addComponent(world, eid, Wander);
  Wander.angle[eid] = Math.random() * Math.PI * 2;
  Wander.verticalAngle[eid] = Math.PI * 0.5; // Start at equator (horizontal)
  Wander.distance[eid] = 5.0; // Large wander projection for majestic movement
  Wander.radius[eid] = 2.0;
  Wander.rate[eid] = 0.04; // Very slow, majestic direction changes

  addComponent(world, eid, Vision);
  Vision.range[eid] = 50.0;
  Vision.fovAngle[eid] = (300 * Math.PI) / 180;
  Vision.blindSpotAngle[eid] = (60 * Math.PI) / 180;
  Vision.clarity[eid] = 1.0;

  // Rendering
  addComponent(world, eid, Mesh);
  Mesh.meshId[eid] = eid;
  Mesh.visible[eid] = 1;

  addComponent(world, eid, Color);
  // Species-specific colors
  if (species === 'humpback') {
    Color.r[eid] = 0.25; // Dark gray
    Color.g[eid] = 0.28;
    Color.b[eid] = 0.32;
  } else {
    Color.r[eid] = 0.35; // Blue-gray
    Color.g[eid] = 0.42;
    Color.b[eid] = 0.52;
  }
  Color.a[eid] = 1.0;

  // Initialize burst-glide animation parameters
  initializeBurstGlideParams(eid);

  return eid;
}

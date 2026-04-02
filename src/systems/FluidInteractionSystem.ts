import { query } from 'bitecs';
import * as THREE from 'three';
import { Position, Velocity, Scale } from '../components/Transform';
import { CreatureType } from '../components/Biology';
import type { OceanWorld } from '../core/World';
import { FluidSimulation, WaveSimulation } from '../simulation/FluidSimulation';

/**
 * System that handles bidirectional interaction between creatures and fluid simulation
 *
 * Creatures affect the fluid:
 * - Fast-moving creatures create wakes and turbulence
 * - Large creatures displace water
 * - Surface breaching creates splashes
 *
 * Fluid affects creatures:
 * - Creatures are pushed by fluid currents
 * - Adds drag based on fluid velocity differential
 */

// Pre-allocated temporary vectors for hot path
const _tempVelocity = new THREE.Vector3();
const _tempPosition = new THREE.Vector3();
const _tempImpulse = new THREE.Vector3();
const _tempFluidVel = new THREE.Vector3();

// Creature type constants (matching Biology.ts)
const CREATURE_TYPES = {
  FISH: 0,
  SHARK: 1,
  DOLPHIN: 2,
  JELLYFISH: 3,
  RAY: 4,
  TURTLE: 5,
  CRAB: 6,
  STARFISH: 7,
  URCHIN: 8,
  WHALE: 9,
};

// Configuration for creature-fluid interaction
const INTERACTION_CONFIG = {
  // Impulse strength multipliers by creature type
  IMPULSE_MULTIPLIERS: {
    [CREATURE_TYPES.FISH]: 0.1,
    [CREATURE_TYPES.SHARK]: 0.8,
    [CREATURE_TYPES.DOLPHIN]: 1.0,
    [CREATURE_TYPES.JELLYFISH]: 0.02,
    [CREATURE_TYPES.RAY]: 0.3,
    [CREATURE_TYPES.TURTLE]: 0.4,
    [CREATURE_TYPES.CRAB]: 0.0, // Bottom dweller, no fluid effect
    [CREATURE_TYPES.STARFISH]: 0.0,
    [CREATURE_TYPES.URCHIN]: 0.0,
    [CREATURE_TYPES.WHALE]: 2.0,
  },

  // How much creatures are affected by fluid
  FLUID_INFLUENCE: {
    [CREATURE_TYPES.FISH]: 0.3,
    [CREATURE_TYPES.SHARK]: 0.15,
    [CREATURE_TYPES.DOLPHIN]: 0.1,
    [CREATURE_TYPES.JELLYFISH]: 0.8, // Passive drifters
    [CREATURE_TYPES.RAY]: 0.2,
    [CREATURE_TYPES.TURTLE]: 0.25,
    [CREATURE_TYPES.CRAB]: 0.0,
    [CREATURE_TYPES.STARFISH]: 0.0,
    [CREATURE_TYPES.URCHIN]: 0.0,
    [CREATURE_TYPES.WHALE]: 0.05,
  },

  // Speed threshold for creating fluid disturbance
  DISTURBANCE_SPEED_THRESHOLD: 1.5,

  // Surface breach detection
  SURFACE_Y: 0,
  SPLASH_THRESHOLD_SPEED: 3.0,
};

/**
 * Creates the fluid interaction system
 */
export function createFluidInteractionSystem(
  fluidSim: FluidSimulation | null,
  waveSim: WaveSimulation | null
) {
  return (world: OceanWorld): OceanWorld => {
    // Skip if no fluid simulation
    if (!fluidSim && !waveSim) {
      return world;
    }

    const deltaTime = world.time.delta;
    const entities = query(world, [Position, Velocity, CreatureType, Scale]);

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      const creatureType = CreatureType.type[eid];

      // Skip bottom dwellers
      if (
        creatureType === CREATURE_TYPES.CRAB ||
        creatureType === CREATURE_TYPES.STARFISH ||
        creatureType === CREATURE_TYPES.URCHIN
      ) {
        continue;
      }

      // Get creature position and velocity
      _tempPosition.set(Position.x[eid], Position.y[eid], Position.z[eid]);
      _tempVelocity.set(Velocity.x[eid], Velocity.y[eid], Velocity.z[eid]);

      const speed = _tempVelocity.length();
      const scale = Math.max(Scale.x[eid], Scale.y[eid], Scale.z[eid]);

      // === Creature affects fluid ===
      if (fluidSim && speed > INTERACTION_CONFIG.DISTURBANCE_SPEED_THRESHOLD) {
        const impulseMultiplier =
          INTERACTION_CONFIG.IMPULSE_MULTIPLIERS[creatureType] ?? 0.1;

        // Create wake behind creature
        _tempImpulse
          .copy(_tempVelocity)
          .normalize()
          .multiplyScalar(-speed * impulseMultiplier * scale * 0.1);

        fluidSim.applyImpulse(_tempPosition, _tempImpulse, scale * 2);
      }

      // === Surface interactions (wave simulation) ===
      if (waveSim) {
        // Check if near surface
        if (_tempPosition.y > -5 && _tempPosition.y < 2) {
          // Create ripples proportional to speed and size
          const rippleStrength = speed * scale * 0.05;
          if (rippleStrength > 0.1) {
            waveSim.createRipple(_tempPosition.x, _tempPosition.z, rippleStrength);
          }
        }

        // Breach detection (crossing surface at high speed)
        if (
          _tempVelocity.y > INTERACTION_CONFIG.SPLASH_THRESHOLD_SPEED &&
          _tempPosition.y > INTERACTION_CONFIG.SURFACE_Y - 1 &&
          _tempPosition.y < INTERACTION_CONFIG.SURFACE_Y + 2
        ) {
          // Create big splash
          const splashStrength = _tempVelocity.y * scale * 0.3;
          waveSim.createRipple(_tempPosition.x, _tempPosition.z, splashStrength);

          // Also add splash particles if fluid sim exists
          if (fluidSim) {
            fluidSim.spawnSplash(_tempPosition, scale * 2, Math.floor(scale * 10));
          }
        }
      }

      // === Fluid affects creature ===
      if (fluidSim) {
        const fluidInfluence =
          INTERACTION_CONFIG.FLUID_INFLUENCE[creatureType] ?? 0.2;

        if (fluidInfluence > 0) {
          // Sample fluid velocity at creature position
          _tempFluidVel.copy(fluidSim.sampleVelocity(_tempPosition));

          // Calculate velocity differential
          _tempFluidVel.sub(_tempVelocity);

          // Apply fluid force (drag-like effect)
          Velocity.x[eid] += _tempFluidVel.x * fluidInfluence * deltaTime * 10;
          Velocity.y[eid] += _tempFluidVel.y * fluidInfluence * deltaTime * 10;
          Velocity.z[eid] += _tempFluidVel.z * fluidInfluence * deltaTime * 10;
        }
      }
    }

    return world;
  };
}

/**
 * Creates a wake effect system using only the wave simulation
 * Lighter weight than full SPH, good for surface effects
 */
export function createWakeEffectSystem(waveSim: WaveSimulation) {
  return (world: OceanWorld): OceanWorld => {
    const entities = query(world, [Position, Velocity, CreatureType, Scale]);

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      const creatureType = CreatureType.type[eid];

      // Only process creatures near surface
      const y = Position.y[eid];
      if (y < -8 || y > 2) continue;

      // Skip bottom dwellers
      if (
        creatureType === CREATURE_TYPES.CRAB ||
        creatureType === CREATURE_TYPES.STARFISH ||
        creatureType === CREATURE_TYPES.URCHIN
      ) {
        continue;
      }

      const speed = Math.sqrt(
        Velocity.x[eid] * Velocity.x[eid] +
        Velocity.y[eid] * Velocity.y[eid] +
        Velocity.z[eid] * Velocity.z[eid]
      );

      if (speed < 0.5) continue;

      const scale = Math.max(Scale.x[eid], Scale.y[eid], Scale.z[eid]);
      const depthFactor = 1 - Math.abs(y) / 8; // Stronger near surface

      // Create wake ripple
      const rippleStrength = speed * scale * depthFactor * 0.1;
      waveSim.createRipple(Position.x[eid], Position.z[eid], rippleStrength);
    }

    return world;
  };
}

import { query } from 'bitecs';
import * as THREE from 'three';
import { Position, Velocity, Acceleration } from '../components/Transform';
import { CreatureType } from '../components/Biology';
import { FIRA } from '../components/Behavior';
import type { OceanWorld } from '../core/World';
import { BiomechanicalAnimationState } from './BiomechanicalAnimationSystem';

// Module-scope temp vector to avoid allocations in hot path
const _thrustDirection = new THREE.Vector3();

/**
 * Enhanced Movement System with burst-and-glide and realistic fish locomotion
 */
export const enhancedMovementSystem = (world: OceanWorld) => {
  const entities = query(world, [Position, Velocity, Acceleration]);
  const dt = world.time.delta; // Already in seconds from updateWorldTime
  
  for (const eid of entities) {
    // Apply acceleration to velocity
    Velocity.x[eid] += Acceleration.x[eid] * dt;
    Velocity.y[eid] += Acceleration.y[eid] * dt;
    Velocity.z[eid] += Acceleration.z[eid] * dt;
    
    // Apply burst-and-glide thrust modulation (only for entities with initialized burst-glide)
    if (BiomechanicalAnimationState.burstDuration[eid] > 0) {
      const burstGlideMultiplier = getBurstGlideThrust(eid);
      Velocity.x[eid] *= (1.0 + burstGlideMultiplier * 0.1);
      Velocity.y[eid] *= (1.0 + burstGlideMultiplier * 0.1);
      Velocity.z[eid] *= (1.0 + burstGlideMultiplier * 0.1);
    }
    
    // Apply water resistance (drag)
    const speed = Math.sqrt(
      Velocity.x[eid] ** 2 + 
      Velocity.y[eid] ** 2 + 
      Velocity.z[eid] ** 2
    );
    
    // Realistic drag: F_drag = 0.5 * Cd * A * rho * v^2
    // Simplified: drag increases with square of velocity
    const dragCoefficient = 0.02; // Streamlined body
    const dragFactor = 1.0 - dragCoefficient * speed * dt;
    
    Velocity.x[eid] *= Math.max(0, dragFactor);
    Velocity.y[eid] *= Math.max(0, dragFactor);
    Velocity.z[eid] *= Math.max(0, dragFactor);

    // Bottom dwellers: handle before velocity clamping to avoid spurious kicks
    const cType = CreatureType.type[eid];
    if (cType >= 6 && cType <= 8) {
      if (cType === 7 || cType === 8) {
        // Starfish and urchins are fully stationary
        Velocity.x[eid] = 0;
        Velocity.y[eid] = 0;
        Velocity.z[eid] = 0;
        Position.y[eid] = -29.8;
        Acceleration.x[eid] = 0;
        Acceleration.y[eid] = 0;
        Acceleration.z[eid] = 0;
        continue;
      } else {
        // Crabs: zero vertical, pin to floor, heavy horizontal drag
        Velocity.y[eid] = 0;
        Position.y[eid] = -29.8;
        Velocity.x[eid] *= 0.9;
        Velocity.z[eid] *= 0.9;
      }
    }

    // Velocity clamping (moved from FIRA - must happen after drag)
    if (FIRA.maxSpeed[eid] > 0) {
      const clampSpeed = Math.sqrt(
        Velocity.x[eid] * Velocity.x[eid] +
        Velocity.y[eid] * Velocity.y[eid] +
        Velocity.z[eid] * Velocity.z[eid]
      );
      const maxSpd = FIRA.maxSpeed[eid];
      const minSpd = FIRA.minSpeed[eid];

      if (clampSpeed > maxSpd) {
        const scale = maxSpd / clampSpeed;
        Velocity.x[eid] *= scale;
        Velocity.y[eid] *= scale;
        Velocity.z[eid] *= scale;
      } else if (clampSpeed < minSpd && minSpd > 0) {
        if (clampSpeed < 0.001) {
          const angle = Math.random() * Math.PI * 2;
          Velocity.x[eid] = Math.cos(angle) * minSpd;
          Velocity.z[eid] = Math.sin(angle) * minSpd;
        } else {
          const scale = minSpd / clampSpeed;
          Velocity.x[eid] *= scale;
          Velocity.y[eid] *= scale;
          Velocity.z[eid] *= scale;
        }
      }
    }

    // Jellyfish (type 3) need periodic thrust pulses since they have no FIRA system
    if (cType === 3) {
      applyJellyfishPulse(eid, dt, world.time.elapsed);
    }

    // Add buoyancy force - skip for bottom dwellers (already handled above)
    if (cType < 6 || cType > 8) {
      applyBuoyancy(eid, dt);
    }
    
    // Update position with Verlet integration for stability
    Position.x[eid] += Velocity.x[eid] * dt;
    Position.y[eid] += Velocity.y[eid] * dt;
    Position.z[eid] += Velocity.z[eid] * dt;
    
    // Reset acceleration (forces recalculated each frame)
    Acceleration.x[eid] = 0;
    Acceleration.y[eid] = 0;
    Acceleration.z[eid] = 0;
  }
  
  return world;
};

/**
 * Get thrust multiplier from burst-glide state
 * Returns 1.0 during burst, 0.0 during glide
 */
function getBurstGlideThrust(eid: number): number {
  const state = BiomechanicalAnimationState.burstGlideState[eid];
  
  if (state === 0) {
    // Burst phase: active propulsion
    return 1.0;
  } else {
    // Glide phase: coasting (no thrust)
    return 0.0;
  }
}

/**
 * Apply buoyancy to simulate fish returning to preferred depth
 */
function applyBuoyancy(eid: number, dt: number): void {
  const currentDepth = -Position.y[eid]; // Y is negative underwater

  const depthByType: Record<number, number> = {
    0: 10.0,  // fish - mid-water
    1: 8.0,   // shark - upper-mid
    2: 5.0,   // dolphin - near surface
    3: 8.0,   // jellyfish - mid-water
    4: 25.0,  // ray - near bottom
    5: 5.0,   // turtle - near surface
    9: 15.0,  // whale - deep
  };
  const cType = CreatureType.type[eid];
  const preferredDepth = depthByType[cType] ?? 10.0;
  const neutralBuoyancyZone = 8.0; // meters tolerance
  
  // Buoyancy force proportional to depth difference
  if (currentDepth < preferredDepth - neutralBuoyancyZone) {
    // Too shallow: slight downward force
    const buoyancyForce = -0.3 * dt;
    Velocity.y[eid] += buoyancyForce;
  } else if (currentDepth > preferredDepth + neutralBuoyancyZone) {
    // Too deep: slight upward force
    const buoyancyForce = 0.3 * dt;
    Velocity.y[eid] += buoyancyForce;
  }
  
  // Prevent fish from breaking surface
  if (Position.y[eid] > -0.5) {
    Position.y[eid] = -0.5;
    if (Velocity.y[eid] > 0) {
      Velocity.y[eid] = -0.1; // Gentle downward push
    }
  }
  
  // Prevent fish from going too deep
  const maxDepth = 50.0;
  if (Position.y[eid] < -maxDepth) {
    Position.y[eid] = -maxDepth;
    if (Velocity.y[eid] < 0) {
      Velocity.y[eid] = 0.1; // Gentle upward push
    }
  }
}

/**
 * Apply a thrust force in the direction of movement
 * Called by behavior systems
 */
export function applyThrustForce(
  eid: number,
  thrustMagnitude: number
): void {
  const speed = Math.sqrt(
    Velocity.x[eid] ** 2 + 
    Velocity.y[eid] ** 2 + 
    Velocity.z[eid] ** 2
  );
  
  if (speed > 0.01) {
    // Apply thrust in direction of current velocity
    _thrustDirection.set(
      Velocity.x[eid],
      Velocity.y[eid],
      Velocity.z[eid]
    ).normalize();

    Acceleration.x[eid] += _thrustDirection.x * thrustMagnitude;
    Acceleration.y[eid] += _thrustDirection.y * thrustMagnitude;
    Acceleration.z[eid] += _thrustDirection.z * thrustMagnitude;
  }
}

/**
 * Apply a turning force (perpendicular to current velocity)
 */
export function applyTurningForce(
  eid: number,
  turnDirection: THREE.Vector3,
  turnMagnitude: number
): void {
  Acceleration.x[eid] += turnDirection.x * turnMagnitude;
  Acceleration.y[eid] += turnDirection.y * turnMagnitude;
  Acceleration.z[eid] += turnDirection.z * turnMagnitude;
}

/**
 * Execute C-start escape maneuver (rapid acceleration)
 */
export function executeCStart(
  eid: number,
  escapeDirection: THREE.Vector3
): void {
  // C-start provides explosive acceleration (up to 40 m/s² or 4G)
  const cStartForce = 15.0; // Significant force
  
  Acceleration.x[eid] += escapeDirection.x * cStartForce;
  Acceleration.y[eid] += escapeDirection.y * cStartForce;
  Acceleration.z[eid] += escapeDirection.z * cStartForce;
  
  // Update animation state to escape
  BiomechanicalAnimationState.swimState[eid] = 4; // ESCAPE state
}

/**
 * Apply braking force (pectorals forward, tail reverse)
 */
export function applyBraking(eid: number, brakingFactor: number): void {
  // Braking reduces velocity quickly
  Velocity.x[eid] *= (1.0 - brakingFactor * 0.5);
  Velocity.y[eid] *= (1.0 - brakingFactor * 0.5);
  Velocity.z[eid] *= (1.0 - brakingFactor * 0.5);
  
  // Update animation state
  BiomechanicalAnimationState.swimState[eid] = 5; // BRAKE state
}

/**
 * Enhanced depth behavior with zone preferences
 */
export function applyDepthPreference(
  eid: number,
  preferredDepth: number,
  dt: number
): void {
  const currentDepth = -Position.y[eid];
  const depthDifference = preferredDepth - currentDepth;
  
  // Smooth depth adjustment
  if (Math.abs(depthDifference) > 2.0) {
    const adjustmentForce = Math.sign(depthDifference) * 0.5;
    Acceleration.y[eid] += adjustmentForce * dt;
  }
}

/**
 * Calculate Reynolds number (flow regime indicator)
 * Re < 2000: Laminar flow
 * Re > 4000: Turbulent flow
 */
export function calculateReynoldsNumber(
  eid: number,
  characteristicLength: number = 0.5
): number {
  const speed = Math.sqrt(
    Velocity.x[eid] ** 2 + 
    Velocity.y[eid] ** 2 + 
    Velocity.z[eid] ** 2
  );
  
  const waterDensity = 1000; // kg/m³
  const waterViscosity = 0.001; // Pa·s
  
  const Re = (waterDensity * speed * characteristicLength) / waterViscosity;
  return Re;
}

/**
 * Apply periodic thrust pulses for jellyfish (simulates bell contraction)
 * Jellyfish have no FIRA system, so they need their own movement logic.
 */
function applyJellyfishPulse(eid: number, dt: number, elapsed: number): void {
  // Each jellyfish gets a unique phase offset based on entity id
  const phaseOffset = (eid * 1.618) % (Math.PI * 2); // Golden ratio for distribution
  const pulseFrequency = 0.8; // Hz - slow rhythmic pulsing
  const phase = elapsed * pulseFrequency * Math.PI * 2 + phaseOffset;

  // Pulse creates upward thrust during contraction (first half of cycle)
  const pulse = Math.sin(phase);
  if (pulse > 0) {
    // Contraction phase: push upward and slightly in current horizontal direction
    Velocity.y[eid] += pulse * 1.2 * dt;

    // Small horizontal drift for natural movement
    const hSpeed = Math.sqrt(Velocity.x[eid] ** 2 + Velocity.z[eid] ** 2);
    if (hSpeed < 0.05) {
      // Give a gentle random horizontal drift if nearly stationary
      const driftAngle = (eid * 2.718 + elapsed * 0.1) % (Math.PI * 2);
      Velocity.x[eid] += Math.cos(driftAngle) * 0.3 * dt;
      Velocity.z[eid] += Math.sin(driftAngle) * 0.3 * dt;
    }
  }

  // Gentle boundary forces to keep jellyfish in the simulation area
  const px = Position.x[eid];
  const pz = Position.z[eid];
  const limit = 35.0;
  if (Math.abs(px) > limit) Velocity.x[eid] -= Math.sign(px) * 0.2 * dt;
  if (Math.abs(pz) > limit) Velocity.z[eid] -= Math.sign(pz) * 0.2 * dt;
}

/**
 * Apply turbulent wake effects (reduces efficiency at high speed)
 */
export function applyWakeEffects(eid: number, _dt: number): void {
  const Re = calculateReynoldsNumber(eid);
  
  if (Re > 4000) {
    // Turbulent flow: increased drag
    const turbulentDragFactor = 0.98; // 2% drag per frame
    Velocity.x[eid] *= turbulentDragFactor;
    Velocity.y[eid] *= turbulentDragFactor;
    Velocity.z[eid] *= turbulentDragFactor;
  }
}

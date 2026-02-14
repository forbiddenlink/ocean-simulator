import { query } from 'bitecs';
import * as THREE from 'three';
import { Position, Velocity, Acceleration } from '../components/Transform';
import { Health, Energy, CreatureType } from '../components/Biology';
import { Vision } from '../components/Behavior';
import type { OceanWorld } from '../core/World';

// Target memory component for tracking prey
export const TargetMemory = {
  targetEid: new Int32Array(10000),
  lastSeenX: new Float32Array(10000),
  lastSeenY: new Float32Array(10000),
  lastSeenZ: new Float32Array(10000),
  timeSinceSeen: new Float32Array(10000),
  huntingMode: new Uint8Array(10000) // 0=idle, 1=pursuing, 2=attacking, 3=fleeing
};

// Hunting configuration - tuned for sustainable visual demo ecosystem
const HUNT_CONFIG = {
  // Predator settings - reduced aggression for visual demo
  PURSUIT_SPEED_MULTIPLIER: 1.2, // Reduced - prey can escape easier
  ATTACK_RANGE: 0.8, // Reduced from 1.2 - predators must get very close
  ENERGY_COST_PER_SECOND: 0.3, // Low cost
  ENERGY_GAIN_FROM_KILL: 150.0, // Worth hunting when successful
  DAMAGE_PER_SECOND: 5.0, // Reduced from 15 - fish survive longer in combat

  // Prey settings - enhanced escape
  FLEE_SPEED_MULTIPLIER: 2.2, // Increased - prey escape more often
  FEAR_RADIUS: 18.0, // Increased - prey flee earlier
  PANIC_DURATION: 5.0,

  // Memory - less persistent hunting
  TARGET_FORGET_TIME: 5.0, // Reduced - predators give up faster
  VISION_CHECK_INTERVAL: 1.0 // Less frequent vision checks
};

/**
 * System that handles predator-prey interactions, hunting, and fleeing behaviors
 */
export function createHuntingSystem(_world: OceanWorld) {
  let accumulatedTime = 0;
  let visionCheckTimer = 0;
  
  const tempVec3 = new THREE.Vector3();
  const tempVec3b = new THREE.Vector3();
  
  return (world: OceanWorld) => {
    const deltaTime = world.time.delta; // Already in seconds from updateWorldTime
    accumulatedTime += deltaTime;
    visionCheckTimer += deltaTime;
    
    const needsVisionCheck = visionCheckTimer >= HUNT_CONFIG.VISION_CHECK_INTERVAL;
    if (needsVisionCheck) visionCheckTimer = 0;
    
    // Process all predators
    const predators = query(world, [Position, Velocity, Energy, CreatureType, Vision]);
    const allPrey = query(world, [Position, Velocity, Health, CreatureType]);
    
    for (let i = 0; i < predators.length; i++) {
      const predatorEid = predators[i];
      
      // Skip non-predators
      if (CreatureType.isPredator[predatorEid] === 0) continue;
      
      // Drain energy while active
      Energy.current[predatorEid] -= HUNT_CONFIG.ENERGY_COST_PER_SECOND * deltaTime;
      
      // Update target memory timer
      TargetMemory.timeSinceSeen[predatorEid] += deltaTime;
      
      const predatorPos = tempVec3.set(
        Position.x[predatorEid],
        Position.y[predatorEid],
        Position.z[predatorEid]
      );
      
      const visionRange = Vision.range[predatorEid] || 10.0;
      const currentTarget = TargetMemory.targetEid[predatorEid];
      
      // Vision check - find prey using spatial grid
      if (needsVisionCheck && (currentTarget === 0 || TargetMemory.timeSinceSeen[predatorEid] > HUNT_CONFIG.TARGET_FORGET_TIME)) {
        let closestPrey = 0;
        let closestDist = Infinity;

        // Use spatial grid to find nearby entities within vision range
        const nearbyEntities = world.spatialGrid.getNeighbors(
          predatorPos.x,
          predatorPos.y,
          predatorPos.z,
          visionRange
        );

        for (let j = 0; j < nearbyEntities.length; j++) {
          const preyEid = nearbyEntities[j];

          // Don't target other predators or same species
          if (CreatureType.isPredator[preyEid] === 1) continue;
          if (CreatureType.type[preyEid] === CreatureType.type[predatorEid]) continue;
          if (Health.current[preyEid] <= 0) continue;

          const preyPos = tempVec3b.set(
            Position.x[preyEid],
            Position.y[preyEid],
            Position.z[preyEid]
          );

          const dist = predatorPos.distanceTo(preyPos);

          if (dist < closestDist) {
            closestDist = dist;
            closestPrey = preyEid;
          }
        }
        
        // Found prey - start pursuing
        if (closestPrey > 0) {
          TargetMemory.targetEid[predatorEid] = closestPrey;
          TargetMemory.lastSeenX[predatorEid] = Position.x[closestPrey];
          TargetMemory.lastSeenY[predatorEid] = Position.y[closestPrey];
          TargetMemory.lastSeenZ[predatorEid] = Position.z[closestPrey];
          TargetMemory.timeSinceSeen[predatorEid] = 0;
          TargetMemory.huntingMode[predatorEid] = 1; // pursuing
        }
      }
      
      // Pursue active target (verify target still exists and is alive)
      if (currentTarget > 0 && TargetMemory.timeSinceSeen[predatorEid] < HUNT_CONFIG.TARGET_FORGET_TIME) {
        // Check if target still exists (health > 0 means entity is alive)
        if (Health.current[currentTarget] === undefined || Health.current[currentTarget] <= 0) {
          // Target was removed or died - clear it
          TargetMemory.targetEid[predatorEid] = 0;
          TargetMemory.huntingMode[predatorEid] = 0;
          continue;
        }

        const preyPos = tempVec3b.set(
          Position.x[currentTarget],
          Position.y[currentTarget],
          Position.z[currentTarget]
        );
        
        // Update last seen position
        TargetMemory.lastSeenX[predatorEid] = preyPos.x;
        TargetMemory.lastSeenY[predatorEid] = preyPos.y;
        TargetMemory.lastSeenZ[predatorEid] = preyPos.z;
        TargetMemory.timeSinceSeen[predatorEid] = 0;
        
        const distToTarget = predatorPos.distanceTo(preyPos);
        
        // Attack if in range
        if (distToTarget < HUNT_CONFIG.ATTACK_RANGE) {
          TargetMemory.huntingMode[predatorEid] = 2; // attacking
          
          // Deal damage to prey (very reduced for visual demo)
          const damage = HUNT_CONFIG.DAMAGE_PER_SECOND * deltaTime;
          Health.current[currentTarget] -= damage;
          
          // If prey dies, gain energy
          if (Health.current[currentTarget] <= 0) {
            Energy.current[predatorEid] = Math.min(
              Energy.max[predatorEid],
              Energy.current[predatorEid] + HUNT_CONFIG.ENERGY_GAIN_FROM_KILL
            );
            
            // Clear target
            TargetMemory.targetEid[predatorEid] = 0;
            TargetMemory.huntingMode[predatorEid] = 0; // idle
          }
        } else {
          // Pursue - move toward prey
          TargetMemory.huntingMode[predatorEid] = 1; // pursuing
          
          const direction = tempVec3b.sub(predatorPos).normalize();
          
          // Apply pursuit force (stronger than normal movement)
          const pursuitForce = HUNT_CONFIG.PURSUIT_SPEED_MULTIPLIER;
          Acceleration.x[predatorEid] += direction.x * pursuitForce;
          Acceleration.y[predatorEid] += direction.y * pursuitForce;
          Acceleration.z[predatorEid] += direction.z * pursuitForce;
        }
      } else {
        // No target - reset to idle
        TargetMemory.huntingMode[predatorEid] = 0;
        TargetMemory.targetEid[predatorEid] = 0;
      }
    }
    
    // Process all prey - check for nearby predators and flee
    for (let i = 0; i < allPrey.length; i++) {
      const preyEid = allPrey[i];
      
      // Skip if already a predator or dead
      if (CreatureType.isPredator[preyEid] === 1) continue;
      if (Health.current[preyEid] <= 0) continue;
      
      const preyPos = tempVec3.set(
        Position.x[preyEid],
        Position.y[preyEid],
        Position.z[preyEid]
      );
      
      let nearestThreat = tempVec3b.set(0, 0, 0);
      let hasThreat = false;
      let minThreatDist = Infinity;

      // Use spatial grid to check for nearby predators within fear radius
      const nearbyEntities = world.spatialGrid.getNeighbors(
        preyPos.x,
        preyPos.y,
        preyPos.z,
        HUNT_CONFIG.FEAR_RADIUS
      );

      for (let j = 0; j < nearbyEntities.length; j++) {
        const predatorEid = nearbyEntities[j];

        if (CreatureType.isPredator[predatorEid] === 0) continue;
        if (Energy.current[predatorEid] <= 0) continue;

        const predatorPos = tempVec3b.set(
          Position.x[predatorEid],
          Position.y[predatorEid],
          Position.z[predatorEid]
        );

        const dist = preyPos.distanceTo(predatorPos);

        if (dist < minThreatDist) {
          nearestThreat.copy(predatorPos);
          hasThreat = true;
          minThreatDist = dist;
        }
      }

      // Flee from nearest threat
      if (hasThreat) {
        TargetMemory.huntingMode[preyEid] = 3; // fleeing
        
        // Calculate flee direction (away from threat)
        const fleeDir = tempVec3b.copy(preyPos).sub(nearestThreat).normalize();
        
        // Apply strong flee force
        const fleeForce = HUNT_CONFIG.FLEE_SPEED_MULTIPLIER;
        Acceleration.x[preyEid] += fleeDir.x * fleeForce;
        Acceleration.y[preyEid] += fleeDir.y * fleeForce;
        Acceleration.z[preyEid] += fleeDir.z * fleeForce;
      } else {
        // Safe - return to normal behavior
        if (TargetMemory.huntingMode[preyEid] === 3) {
          TargetMemory.huntingMode[preyEid] = 0; // idle
        }
      }
    }
    
    return world;
  };
}

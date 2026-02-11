import { query } from 'bitecs';
import { Position, Velocity, Acceleration } from '../components/Transform';
import { FIRA, Vision, Wander } from '../components/Behavior';
import type { OceanWorld } from '../core/World';

// Pre-allocated buffer for force accumulators (reused across frames)
let forcesBuffer: Float32Array | null = null;
let forcesCapacity = 0;

// Debug flag - set to true for development debugging
const DEBUG = false;

/**
 * FIRA System - Fish-Inspired Robotic Algorithm
 * Implements inverse-square repulsion (NOT linear Boids!)
 * Based on research: https://www.nature.com/articles/s41598-019-56716-4
 */
export const firaSystem = (world: OceanWorld) => {
  const entities = Array.from(query(world, [Position, Velocity, Acceleration, FIRA, Vision, Wander]));
  const count = entities.length;

  // Debug: Log entity count
  if (DEBUG && Math.random() < 0.01) {
    console.log(`FIRA system processing ${count} entities`);
  }

  // Reuse force buffer, grow only when needed
  const requiredSize = count * 3;
  if (forcesBuffer === null || requiredSize > forcesCapacity) {
    forcesCapacity = Math.max(requiredSize, forcesCapacity * 2 || 300); // Grow exponentially
    forcesBuffer = new Float32Array(forcesCapacity);
  }
  const forces = forcesBuffer;
  // Zero out the portion we'll use
  forces.fill(0, 0, requiredSize);

  for (let i = 0; i < count; i++) {
    const eid = entities[i];
    const px = Position.x[eid];
    const py = Position.y[eid];
    const pz = Position.z[eid];

    let separationX = 0, separationY = 0, separationZ = 0;
    let alignmentX = 0, alignmentY = 0, alignmentZ = 0;
    let cohesionX = 0, cohesionY = 0, cohesionZ = 0;
    let neighborCount = 0;

    const perceptionRadius = FIRA.perceptionRadius[eid];
    const separationRadius = FIRA.separationRadius[eid];

    // 1. WANDER FORCE (Breaks symmetry/circling)
    // Update wander angle with natural randomness
    Wander.angle[eid] += (Math.random() - 0.5) * Wander.rate[eid]; // Natural randomness

    const wanderDist = Wander.distance[eid];
    const wanderRad = Wander.radius[eid] * 0.7; // Smaller wander radius for tighter control

    // Project circle ahead
    const vx = Velocity.x[eid];
    const vy = Velocity.y[eid];
    const vz = Velocity.z[eid];
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    let forwardX = vx, forwardY = vy, forwardZ = vz;
    if (speed > 0.001) {
      forwardX /= speed;
      forwardY /= speed;
      forwardZ /= speed;
    } else {
      forwardX = 1;
    }

    // Calculate displacement on sphere surface with smoother variation
    const theta = Wander.angle[eid];
    // Accumulate vertical angle for smooth vertical wander (no jitter)
    Wander.verticalAngle[eid] += (Math.random() - 0.5) * Wander.rate[eid] * 0.3;
    // Clamp to PI/2 ± PI*0.15 (prevents extreme vertical movement)
    Wander.verticalAngle[eid] = Math.max(Math.PI * 0.35, Math.min(Math.PI * 0.65, Wander.verticalAngle[eid]));
    const phi = Wander.verticalAngle[eid];

    const sphereX = wanderRad * Math.sin(phi) * Math.cos(theta);
    const sphereY = wanderRad * Math.sin(phi) * Math.sin(theta) * 0.2; // Much reduced vertical wander for realistic swimming
    const sphereZ = wanderRad * Math.cos(phi);

    const wanderX = forwardX * wanderDist + sphereX;
    const wanderY = forwardY * wanderDist + sphereY;
    const wanderZ = forwardZ * wanderDist + sphereZ;

    // 2. BOUNDARY FORCE (Soft turn)
    let boundX = 0, boundY = 0, boundZ = 0;
    const limit = 40.0; // Keep fish within X/Z bounds
    const depthLimit = 28.0; // Floor is at -30, so stop at -28
    const surfaceLimit = -2.0;

    if (Math.abs(px) > limit) boundX = -px * 0.5;
    if (pz > limit || pz < -limit) boundZ = -pz * 0.5;
    if (py < -depthLimit) boundY = (-depthLimit - py) * 2.0; // Strong push up from floor
    if (py > surfaceLimit) boundY = (surfaceLimit - py) * 2.0; // Push down hard

    // 3. FLOCKING (Separation, Alignment, Cohesion) with staggered positioning
    // Use spatial grid for O(n·k) neighbor queries instead of O(n²)
    const neighbors = world.spatialGrid.getNeighborsForEntity(eid, px, py, pz, perceptionRadius);

    // Debug: Log neighbor count and forces for first entity
    if (DEBUG && i === 0 && Math.random() < 0.02) {
      console.log(`[FIRA Debug] Entity ${eid}:`, {
        position: `(${px.toFixed(1)}, ${py.toFixed(1)}, ${pz.toFixed(1)})`,
        neighbors: neighbors.length,
        perceptionRadius,
        separationRadius
      });
    }

    for (let j = 0; j < neighbors.length; j++) {
      const otherEid = neighbors[j];
      const dx = Position.x[otherEid] - px;
      const dy = Position.y[otherEid] - py;
      const dz = Position.z[otherEid] - pz;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Quick distance check (fine-grained within radius)
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);

        // SEPARATION - Inverse-square repulsion with lateral line sensing
        if (dist < separationRadius) {
          const repulsionForce = 1.0 / (distSq + 0.1);
          
          // Stronger lateral separation for staggered formation
          const otherVelX = Velocity.x[otherEid];
          const otherVelZ = Velocity.z[otherEid];
          const rightX = -otherVelZ; // Perpendicular to velocity
          const rightZ = otherVelX;
          const rightMag = Math.sqrt(rightX * rightX + rightZ * rightZ);
          
          if (rightMag > 0.01) {
            const rightNormX = rightX / rightMag;
            const rightNormZ = rightZ / rightMag;
            const lateralDist = dx * rightNormX + dz * rightNormZ;
            
            // Prefer staggered positions (offset to side, not directly behind)
            const staggerOffset = Math.abs(lateralDist) < 0.5 ? 0.8 : 0.2;
            separationX -= (dx / dist) * repulsionForce * (1.0 + staggerOffset);
            separationY -= (dy / dist) * repulsionForce;
            separationZ -= (dz / dist) * repulsionForce * (1.0 + staggerOffset);
          } else {
            separationX -= (dx / dist) * repulsionForce;
            separationY -= (dy / dist) * repulsionForce;
            separationZ -= (dz / dist) * repulsionForce;
          }
        }

        // ALIGNMENT - Match velocity with smooth blending
        const distanceFactor = 1.0 - (dist / perceptionRadius);
        alignmentX += Velocity.x[otherEid] * distanceFactor;
        alignmentY += Velocity.y[otherEid] * distanceFactor;
        alignmentZ += Velocity.z[otherEid] * distanceFactor;

        // COHESION - Move towards neighbors (diamond/ladder formation)
        cohesionX += dx * distanceFactor;
        cohesionY += dy * distanceFactor;
        cohesionZ += dz * distanceFactor;

        neighborCount++;
      }
    }

    // Average flocking forces
    if (neighborCount > 0) {
      alignmentX /= neighborCount;
      alignmentY /= neighborCount;
      alignmentZ /= neighborCount;
      alignmentX -= vx;
      alignmentY -= vy;
      alignmentZ -= vz;

      cohesionX /= neighborCount;
      cohesionY /= neighborCount;
      cohesionZ /= neighborCount;
      // Cohesion steering = desired - velocity
      // But simple vector to target is fine for Reynolds steering: target - position  = (which is the sum of dx above)
      // Actually cohesion accumulator is sum of offsets (dx), so it points to center relative to self.
      // Normalize to get direction
      const cohMag = Math.sqrt(cohesionX * cohesionX + cohesionY * cohesionY + cohesionZ * cohesionZ);
      if (cohMag > 0) {
        cohesionX /= cohMag;
        cohesionY /= cohMag;
        cohesionZ /= cohMag;
      }
    }

    // Weighted Sum
    const sepW = FIRA.separationWeight[eid];
    const aliW = FIRA.alignmentWeight[eid];
    const cohW = FIRA.cohesionWeight[eid];
    const wanderW = FIRA.wanderWeight[eid];

    let totalFx = separationX * sepW + alignmentX * aliW + cohesionX * cohW + wanderX * wanderW + boundX;
    let totalFy = separationY * sepW + alignmentY * aliW + cohesionY * cohW + wanderY * wanderW + boundY;
    let totalFz = separationZ * sepW + alignmentZ * aliW + cohesionZ * cohW + wanderZ * wanderW + boundZ;

    // Limit steering force (maxForce)
    const currentForceMag = Math.sqrt(totalFx * totalFx + totalFy * totalFy + totalFz * totalFz);
    const maxForce = FIRA.maxForce[eid];

    if (currentForceMag > maxForce) {
      const scale = maxForce / currentForceMag;
      totalFx *= scale;
      totalFy *= scale;
      totalFz *= scale;
    }

    forces[i * 3] = totalFx;
    forces[i * 3 + 1] = totalFy;
    forces[i * 3 + 2] = totalFz;

    // Debug: Log forces for first entity
    if (DEBUG && i === 0 && Math.random() < 0.02) {
      const forceMag = Math.sqrt(totalFx * totalFx + totalFy * totalFy + totalFz * totalFz);
      console.log(`[FIRA Force] Total: ${forceMag.toFixed(2)}, neighborCount: ${neighborCount}`);
    }
  }

  // Apply steering forces to acceleration (proper physics integration)
  for (let i = 0; i < count; i++) {
    const eid = entities[i];

    // Steering forces become acceleration
    Acceleration.x[eid] += forces[i * 3];
    Acceleration.y[eid] += forces[i * 3 + 1];
    Acceleration.z[eid] += forces[i * 3 + 2];
  }

  return world;
};

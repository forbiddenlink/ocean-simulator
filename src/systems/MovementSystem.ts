import { query } from 'bitecs';
import { Position, Velocity, Acceleration } from '../components/Transform';
import type { OceanWorld } from '../core/World';

/**
 * Movement System - Updates positions based on velocity
 * Uses semi-implicit Euler integration for better stability
 */
export const movementSystem = (world: OceanWorld) => {
  const entities = query(world, [Position, Velocity]);
  const dt = world.time.delta;
  
  for (const eid of entities) {
    // Update position: p = p + v * dt
    Position.x[eid] += Velocity.x[eid] * dt;
    Position.y[eid] += Velocity.y[eid] * dt;
    Position.z[eid] += Velocity.z[eid] * dt;
  }
  
  return world;
};

/**
 * Acceleration System - Updates velocity based on acceleration
 */
export const accelerationSystem = (world: OceanWorld) => {
  const entities = query(world, [Velocity, Acceleration]);
  const dt = world.time.delta;
  
  for (const eid of entities) {
    // Update velocity: v = v + a * dt
    Velocity.x[eid] += Acceleration.x[eid] * dt;
    Velocity.y[eid] += Acceleration.y[eid] * dt;
    Velocity.z[eid] += Acceleration.z[eid] * dt;
    
    // Apply slight water resistance for natural feel
    const drag = 0.99; // Very mild drag
    Velocity.x[eid] *= drag;
    Velocity.y[eid] *= drag;
    Velocity.z[eid] *= drag;
    
    // Reset acceleration (forces are recalculated each frame)
    Acceleration.x[eid] = 0;
    Acceleration.y[eid] = 0;
    Acceleration.z[eid] = 0;
  }
  
  return world;
};

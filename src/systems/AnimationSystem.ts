import { query } from 'bitecs';
import * as THREE from 'three';
import { Position, Velocity, Rotation } from '../components/Transform';
import { SwimmingStyle, CreatureType } from '../components/Biology';
import type { OceanWorld } from '../core/World';

// Module-scope temp vector to avoid allocations in hot path
const _animDirection = new THREE.Vector3();

/**
 * Animation state for creatures
 */
export const AnimationState = {
  phase: new Float32Array(10000),        // Current animation phase (0-2π)
  tailBend: new Float32Array(10000),     // Tail bending amount
  finFlap: new Float32Array(10000),      // Fin flapping amount
  bodyUndulation: new Float32Array(10000) // Body wave amount
};

/**
 * System that animates creature movements based on their swimming style
 */
export function createAnimationSystem(_world: OceanWorld) {
  return (world: OceanWorld) => {
    const deltaTime = world.time.delta; // Already in seconds from updateWorldTime
    const entities = query(world, [Position, Velocity, SwimmingStyle, CreatureType]);
    
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      
      const style = SwimmingStyle.style[eid];
      const frequency = SwimmingStyle.frequency[eid];
      const amplitude = SwimmingStyle.amplitude[eid];
      
      // Calculate speed (affects animation rate)
      const speed = Math.sqrt(
        Velocity.x[eid] ** 2 +
        Velocity.y[eid] ** 2 +
        Velocity.z[eid] ** 2
      );
      
      // Base animation rate on speed - slower for more realism
      const animationRate = frequency * (0.3 + speed * 0.3);
      
      // Update phase
      AnimationState.phase[eid] += animationRate * deltaTime;
      if (AnimationState.phase[eid] > Math.PI * 2) {
        AnimationState.phase[eid] -= Math.PI * 2;
      }
      
      const phase = AnimationState.phase[eid];
      
      // Different animation styles
      switch (style) {
        case 0: // Body-caudal (fish, sharks)
          // Sinusoidal tail movement
          AnimationState.tailBend[eid] = Math.sin(phase) * amplitude;
          
          // Body undulation (wave travels from head to tail)
          AnimationState.bodyUndulation[eid] = Math.sin(phase - Math.PI * 0.5) * amplitude * 0.6;
          
          // Pectoral fins slight movement
          AnimationState.finFlap[eid] = Math.sin(phase * 2) * amplitude * 0.3;
          break;
          
        case 1: // Pectoral (rays)
          // Wing-like flapping motion
          AnimationState.finFlap[eid] = Math.sin(phase) * amplitude;
          
          // Wave motion along wing edge
          AnimationState.bodyUndulation[eid] = Math.sin(phase + Math.PI * 0.3) * amplitude * 0.8;
          
          // Minimal tail movement
          AnimationState.tailBend[eid] = Math.sin(phase * 0.5) * amplitude * 0.2;
          break;
          
        case 2: // Jet propulsion (jellyfish)
          // Pulsing bell motion
          const pulse = Math.abs(Math.sin(phase));
          AnimationState.bodyUndulation[eid] = pulse * amplitude;
          
          // Tentacles trail
          AnimationState.tailBend[eid] = Math.sin(phase + Math.PI) * amplitude * 0.5;
          
          // No fin flapping
          AnimationState.finFlap[eid] = 0;
          break;
          
        case 3: // Flukes (dolphins, whales)
          // Vertical tail movement (up-down instead of side-to-side)
          AnimationState.tailBend[eid] = Math.sin(phase) * amplitude;
          
          // Body undulation is more pronounced in vertical plane
          AnimationState.bodyUndulation[eid] = Math.sin(phase - Math.PI * 0.4) * amplitude * 0.7;
          
          // Pectoral fins for steering
          AnimationState.finFlap[eid] = Math.sin(phase * 1.5) * amplitude * 0.4;
          break;
      }
      
      // Update rotation to face velocity direction
      if (speed > 0.1) {
        _animDirection.set(
          Velocity.x[eid],
          Velocity.y[eid],
          Velocity.z[eid]
        ).normalize();

        // Calculate yaw (horizontal rotation)
        const yaw = Math.atan2(_animDirection.x, _animDirection.z);
        Rotation.y[eid] = yaw;

        // Calculate pitch (vertical rotation)
        const horizontalSpeed = Math.sqrt(_animDirection.x ** 2 + _animDirection.z ** 2);
        const pitch = -Math.atan2(_animDirection.y, horizontalSpeed);
        Rotation.x[eid] = pitch;

        // Add slight roll based on turn rate
        const turnRate = AnimationState.tailBend[eid];
        Rotation.z[eid] = turnRate * 0.3;
      }
    }
    
    return world;
  };
}

/**
 * Apply animation state to Three.js meshes (called from render system)
 * This modifies vertex positions for procedural animation
 */
export function applyAnimationToMesh(
  mesh: THREE.Mesh | THREE.Group,
  eid: number,
  creatureType: number
): void {
  const tailBend = AnimationState.tailBend[eid];
  const finFlap = AnimationState.finFlap[eid];
  const bodyUndulation = AnimationState.bodyUndulation[eid];
  
  // For simple meshes, apply skeletal-like deformation
  if (mesh instanceof THREE.Mesh && mesh.geometry instanceof THREE.BufferGeometry) {
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    
    if (!positions) return;
    
    // Get original positions if not stored
    if (!geometry.userData.originalPositions) {
      geometry.userData.originalPositions = positions.array.slice();
    }
    
    const original = geometry.userData.originalPositions;
    const current = positions.array;
    
    // Apply deformation based on creature type
    for (let i = 0; i < positions.count; i++) {
      const idx = i * 3;
      const x = original[idx];
      const y = original[idx + 1];
      const z = original[idx + 2];
      
      // Different deformations for different types
      switch (creatureType) {
        case 0: // Fish
        case 1: // Shark
          // Tail bending: vertices behind center bend sideways
          if (x < 0) {
            const bendFactor = Math.abs(x) * 0.5;
            current[idx + 2] = z + tailBend * bendFactor;
          }
          
          // Body undulation: wave along length
          const wave = Math.sin(x * 3 + bodyUndulation * 2) * 0.1;
          current[idx + 1] = y + wave;
          break;
          
        case 2: // Dolphin
          // Similar to fish but vertical movement
          if (x < 0) {
            const bendFactor = Math.abs(x) * 0.5;
            current[idx + 1] = y + tailBend * bendFactor;
          }
          break;
          
        case 3: // Jellyfish
          // Bell pulsing: radial expansion/contraction
          const pulseFactor = 1.0 + bodyUndulation * 0.3;
          current[idx + 1] = y * pulseFactor;
          current[idx + 2] = z * pulseFactor;
          break;
          
        case 4: // Ray
          // Wing flapping: vertical undulation along width
          const wingPhase = z * 0.5 + finFlap;
          current[idx + 1] = y + Math.sin(wingPhase) * 0.2;
          break;
      }
    }
    
    positions.needsUpdate = true;
  }
  
  // For Groups (complex creatures), animate child meshes
  else if (mesh instanceof THREE.Group) {
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name) {
        // Animate specific parts by name
        if (child.name.includes('tail')) {
          child.rotation.y = tailBend * 0.5;
        }
        if (child.name.includes('fin')) {
          child.rotation.x = finFlap * 0.3;
        }
        if (child.name.includes('body')) {
          child.rotation.z = bodyUndulation * 0.2;
        }
      }
    });
  }
}
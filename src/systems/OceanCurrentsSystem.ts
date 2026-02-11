import { query } from 'bitecs';
import * as THREE from 'three';
import { Position, Velocity, Acceleration } from '../components/Transform';
import { CreatureType } from '../components/Biology';
import type { OceanWorld } from '../core/World';

// Pre-allocated temporary vectors for hot path (reused every frame)
const _tempMainCurrent = new THREE.Vector3();
const _tempTurbulencePos = new THREE.Vector3();
const _tempUpwellingForce = new THREE.Vector3();
const _tempToCenter = new THREE.Vector3();

// Current configuration
const CURRENT_CONFIG = {
  // Gulf Stream-like current (west to east)
  MAIN_CURRENT_DIRECTION: new THREE.Vector3(1, 0, 0.2),
  MAIN_CURRENT_STRENGTH: 0.3,
  
  // Depth-based currents
  SURFACE_CURRENT_STRENGTH: 0.8,
  DEEP_CURRENT_STRENGTH: 0.2,
  TRANSITION_DEPTH: -15,
  
  // Turbulence
  TURBULENCE_SCALE: 0.05,
  TURBULENCE_STRENGTH: 0.5,
  TURBULENCE_FREQUENCY: 0.8,
  
  // Upwelling zones (nutrient-rich areas)
  UPWELLING_CENTERS: [
    new THREE.Vector3(-20, 0, -20),
    new THREE.Vector3(30, 0, 15)
  ],
  UPWELLING_RADIUS: 15,
  UPWELLING_STRENGTH: 0.6
};

/**
 * Perlin-like noise for turbulence
 */
class SimplexTurbulence {
  private seed: number;
  
  constructor(seed: number = Math.random() * 1000) {
    this.seed = seed;
  }
  
  noise3D(x: number, y: number, z: number): number {
    // Simple hash-based pseudo-random noise
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.164 + this.seed) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }
  
  turbulence(x: number, y: number, z: number, octaves: number = 3): THREE.Vector3 {
    let result = new THREE.Vector3();
    let amplitude = 1.0;
    let frequency = 1.0;
    
    for (let i = 0; i < octaves; i++) {
      result.x += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
      result.y += this.noise3D(x * frequency + 100, y * frequency + 100, z * frequency) * amplitude;
      result.z += this.noise3D(x * frequency, y * frequency + 200, z * frequency + 200) * amplitude;
      
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    
    return result;
  }
}

/**
 * System that applies ocean currents and environmental forces to creatures
 */
export function createOceanCurrentsSystem(_world: OceanWorld) {
  const turbulence = new SimplexTurbulence();
  
  const tempPos = new THREE.Vector3();
  const tempForce = new THREE.Vector3();
  let time = 0;
  
  return (world: OceanWorld) => {
    const deltaTime = world.time.delta; // Already in seconds from updateWorldTime
    time += deltaTime;
    
    const entities = query(world, [Position, Velocity, CreatureType, Acceleration]);
    
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      
      tempPos.set(
        Position.x[eid],
        Position.y[eid],
        Position.z[eid]
      );
      
      // Reset force accumulator
      tempForce.set(0, 0, 0);
      
      // 1. Main current (like Gulf Stream)
      _tempMainCurrent.copy(CURRENT_CONFIG.MAIN_CURRENT_DIRECTION)
        .multiplyScalar(CURRENT_CONFIG.MAIN_CURRENT_STRENGTH);
      tempForce.add(_tempMainCurrent);
      
      // 2. Depth-based current strength
      const depth = tempPos.y;
      let depthFactor = 1.0;
      
      if (depth > CURRENT_CONFIG.TRANSITION_DEPTH) {
        // Surface - stronger currents
        depthFactor = CURRENT_CONFIG.SURFACE_CURRENT_STRENGTH;
      } else {
        // Deep - weaker currents
        const depthRatio = Math.max(0, (depth - CURRENT_CONFIG.TRANSITION_DEPTH) / 20);
        depthFactor = THREE.MathUtils.lerp(
          CURRENT_CONFIG.DEEP_CURRENT_STRENGTH,
          CURRENT_CONFIG.SURFACE_CURRENT_STRENGTH,
          depthRatio
        );
      }
      
      tempForce.multiplyScalar(depthFactor);
      
      // 3. Turbulence (small-scale eddies and vortices)
      _tempTurbulencePos.copy(tempPos)
        .multiplyScalar(CURRENT_CONFIG.TURBULENCE_SCALE)
        .addScalar(time * CURRENT_CONFIG.TURBULENCE_FREQUENCY);

      const turbulenceForce = turbulence.turbulence(
        _tempTurbulencePos.x,
        _tempTurbulencePos.y,
        _tempTurbulencePos.z,
        2
      ).multiplyScalar(CURRENT_CONFIG.TURBULENCE_STRENGTH);

      tempForce.add(turbulenceForce);
      
      // 4. Upwelling zones (vertical currents)
      for (const center of CURRENT_CONFIG.UPWELLING_CENTERS) {
        const distToCenter = tempPos.distanceTo(center);

        if (distToCenter < CURRENT_CONFIG.UPWELLING_RADIUS) {
          // Upward force in center, diminishing with distance
          const strength = (1 - distToCenter / CURRENT_CONFIG.UPWELLING_RADIUS);
          _tempUpwellingForce.set(0, 1, 0)
            .multiplyScalar(strength * CURRENT_CONFIG.UPWELLING_STRENGTH);

          // Also slight inward spiral
          _tempToCenter.copy(center).sub(tempPos).normalize();
          _tempToCenter.y = 0; // Only horizontal
          _tempUpwellingForce.add(_tempToCenter.multiplyScalar(strength * 0.2));

          tempForce.add(_tempUpwellingForce);
        }
      }
      
      // 5. Creature type modifiers
      const creatureType = CreatureType.type[eid];

      // Skip bottom dwellers (crabs, starfish, urchins)
      if (creatureType >= 6 && creatureType <= 8) continue;

      // Jellyfish are highly affected by currents (passive drifters)
      if (creatureType === 3) {
        tempForce.multiplyScalar(1.5);
      }
      // Rays are less affected (bottom dwellers)
      else if (creatureType === 4) {
        tempForce.multiplyScalar(0.3);
      }
      // Dolphins and sharks can resist currents better
      else if (creatureType === 1 || creatureType === 2) {
        tempForce.multiplyScalar(0.5);
      }
      
      // Apply force to acceleration (EnhancedMovementSystem integrates into velocity)
      Acceleration.x[eid] += tempForce.x;
      Acceleration.y[eid] += tempForce.y;
      Acceleration.z[eid] += tempForce.z;
    }
    
    return world;
  };
}

/**
 * Visualize currents (for debugging)
 */
export function createCurrentVisualization(scene: THREE.Scene): THREE.ArrowHelper[] {
  const arrows: THREE.ArrowHelper[] = [];
  const gridSize = 10;
  const spacing = 8;
  
  for (let x = -gridSize; x <= gridSize; x++) {
    for (let z = -gridSize; z <= gridSize; z++) {
      for (let y = -3; y <= 0; y++) {
        const pos = new THREE.Vector3(x * spacing, y * 10, z * spacing);
        
        // Calculate current direction at this point
        const dir = CURRENT_CONFIG.MAIN_CURRENT_DIRECTION.clone();
        
        // Add turbulence (simplified)
        const turbulenceOffset = new THREE.Vector3(
          Math.sin(pos.x * 0.1) * 0.3,
          Math.sin(pos.y * 0.15) * 0.2,
          Math.cos(pos.z * 0.1) * 0.3
        );
        dir.add(turbulenceOffset);
        
        // Depth factor
        const depthFactor = pos.y > -15 ? 0.8 : 0.2;
        dir.multiplyScalar(depthFactor);
        
        dir.normalize();
        
        const arrow = new THREE.ArrowHelper(
          dir,
          pos,
          3,
          0x4488ff,
          1,
          0.5
        );
        arrow.visible = false; // Hidden by default
        scene.add(arrow);
        arrows.push(arrow);
      }
    }
  }
  
  return arrows;
}

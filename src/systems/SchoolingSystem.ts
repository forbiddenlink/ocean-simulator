import { query } from 'bitecs';
import * as THREE from 'three';
import { Position, Velocity, Acceleration } from '../components/Transform';
import type { OceanWorld } from '../core/World';

/**
 * Fish Schooling System
 * Implements realistic flocking behavior with separation, alignment, and cohesion
 * Based on Craig Reynolds' Boids algorithm and real fish behavior research
 */

// Schooling component
export const Schooling = {
  schoolId: new Uint16Array(10000),
  neighborRadius: new Float32Array(10000),
  separationWeight: new Float32Array(10000),
  alignmentWeight: new Float32Array(10000),
  cohesionWeight: new Float32Array(10000),
};

/**
 * Initialize schooling behavior for an entity
 */
export function addSchooling(eid: number, schoolId: number = 0): void {
  Schooling.schoolId[eid] = schoolId;
  Schooling.neighborRadius[eid] = 5.0;
  Schooling.separationWeight[eid] = 1.5;
  Schooling.alignmentWeight[eid] = 1.0;
  Schooling.cohesionWeight[eid] = 1.0;
}

/**
 * Schooling system - makes fish swim together in coordinated groups
 */
export function createSchoolingSystem(_world: OceanWorld) {
  return (world: OceanWorld) => {
    const entities = query(world, [Position, Velocity, Acceleration]);
    
    // Skip if too few entities
    if (entities.length < 2) return world;
    
    for (const eid of entities) {
      // Skip if no schooling component
      if (Schooling.schoolId[eid] === undefined) continue;
      
      const schoolId = Schooling.schoolId[eid];
      const radius = Schooling.neighborRadius[eid];
      
      // Current position and velocity
      const pos = new THREE.Vector3(
        Position.x[eid],
        Position.y[eid],
        Position.z[eid]
      );
      
      // Flocking forces
      const separation = new THREE.Vector3();
      const alignment = new THREE.Vector3();
      const cohesion = new THREE.Vector3();
      
      let neighborCount = 0;
      
      // Find neighbors in the same school
      for (const other of entities) {
        if (other === eid) continue;
        if (Schooling.schoolId[other] !== schoolId) continue;
        
        const otherPos = new THREE.Vector3(
          Position.x[other],
          Position.y[other],
          Position.z[other]
        );
        
        const distance = pos.distanceTo(otherPos);
        
        // Only consider nearby neighbors
        if (distance < radius && distance > 0.01) {
          neighborCount++;
          
          // Separation: avoid crowding neighbors
          if (distance < radius * 0.5) {
            const diff = new THREE.Vector3().subVectors(pos, otherPos);
            diff.normalize();
            diff.divideScalar(distance); // Weight by distance
            separation.add(diff);
          }
          
          // Alignment: steer towards average heading
          const otherVel = new THREE.Vector3(
            Velocity.x[other],
            Velocity.y[other],
            Velocity.z[other]
          );
          alignment.add(otherVel);
          
          // Cohesion: steer towards average position
          cohesion.add(otherPos);
        }
      }
      
      // Calculate steering forces
      if (neighborCount > 0) {
        // Separation - steer away from neighbors
        if (separation.length() > 0) {
          separation.normalize();
          separation.multiplyScalar(Schooling.separationWeight[eid]);
        }
        
        // Alignment - match neighbor velocities
        alignment.divideScalar(neighborCount);
        if (alignment.length() > 0) {
          alignment.normalize();
          alignment.multiplyScalar(Schooling.alignmentWeight[eid]);
        }
        
        // Cohesion - move towards center of neighbors
        cohesion.divideScalar(neighborCount);
        cohesion.sub(pos);
        if (cohesion.length() > 0) {
          cohesion.normalize();
          cohesion.multiplyScalar(Schooling.cohesionWeight[eid]);
        }
        
        // Combine forces
        const steeringForce = new THREE.Vector3()
          .add(separation)
          .add(alignment)
          .add(cohesion);
        
        // Limit steering force
        const maxForce = 0.5;
        if (steeringForce.length() > maxForce) {
          steeringForce.normalize().multiplyScalar(maxForce);
        }
        
        // Apply to acceleration
        Acceleration.x[eid] += steeringForce.x;
        Acceleration.y[eid] += steeringForce.y;
        Acceleration.z[eid] += steeringForce.z;
      }
    }
    
    return world;
  };
}

/**
 * Assign entities to schools based on proximity
 */
export function assignToSchools(world: OceanWorld, maxSchoolSize: number = 15): void {
  const entities = query(world, [Position, Velocity]);
  let currentSchool = 0;
  const assigned = new Set<number>();
  
  for (const eid of entities) {
    if (assigned.has(eid)) continue;
    
    // Create new school
    const schoolMembers = [eid];
    assigned.add(eid);
    addSchooling(eid, currentSchool);
    
    const pos = new THREE.Vector3(
      Position.x[eid],
      Position.y[eid],
      Position.z[eid]
    );
    
    // Find nearby fish to join this school
    for (const other of entities) {
      if (assigned.has(other)) continue;
      if (schoolMembers.length >= maxSchoolSize) break;
      
      const otherPos = new THREE.Vector3(
        Position.x[other],
        Position.y[other],
        Position.z[other]
      );
      
      const distance = pos.distanceTo(otherPos);
      
      // Join school if close enough
      if (distance < 15) {
        schoolMembers.push(other);
        assigned.add(other);
        addSchooling(other, currentSchool);
      }
    }
    
    currentSchool++;
  }
  
  console.log(`🐟 Created ${currentSchool} fish schools`);
}

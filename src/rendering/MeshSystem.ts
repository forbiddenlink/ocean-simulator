import * as THREE from 'three';
import { query } from 'bitecs';
import { Position, Scale, Velocity } from '../components/Transform';
import { Mesh as MeshComponent, Color } from '../components/Rendering';
import { CreatureType } from '../components/Biology';
import type { OceanWorld } from '../core/World';
import { RenderingEngine } from './RenderingEngine';
import { createEnhancedFishMaterial, getSpeciesMaterialParams } from './EnhancedFishMaterial';
import { EnhancedFishGeometry } from '../creatures/EnhancedFishGeometry';
import { SpecializedCreatureGeometry } from '../creatures/SpecializedCreatureGeometry';
import { JellyfishGeometry } from '../creatures/JellyfishGeometry';
import { applyBiomechanicalAnimationToMesh, initializeBurstGlideParams } from '../systems/BiomechanicalAnimationSystem';

/**
 * Manages the pool of Three.js meshes for all creature entities
 */
export class FishMeshPool {
  private meshes: Map<number, THREE.Mesh | THREE.Group> = new Map();
  private geometries: Map<string, THREE.BufferGeometry> = new Map();
  private materials: Map<string, THREE.ShaderMaterial> = new Map();
  private renderEngine: RenderingEngine;

  constructor(renderEngine: RenderingEngine) {
    this.renderEngine = renderEngine;

    // Pre-create enhanced materials for different species
    const species = ['tropical', 'tuna', 'bass', 'generic'];
    species.forEach(sp => {
      const params = getSpeciesMaterialParams(sp);
      this.materials.set(sp, createEnhancedFishMaterial(params));
    });
  }

  /**
   * Create appropriate geometry based on creature type
   */
  private createGeometryForCreature(eid: number): THREE.BufferGeometry | THREE.Group {
    const type = CreatureType.type[eid];
    const variant = CreatureType.variant[eid];
    
    switch (type) {
      case 1: // Shark - PHOTOREALISTIC
        const sharkSpeciesMap = ['great_white', 'hammerhead', 'reef', 'generic'] as const;
        const sharkSpecies = sharkSpeciesMap[variant] || 'generic';
        return SpecializedCreatureGeometry.createShark({
          length: 2.5 + Math.random() * 1.0,
          species: sharkSpecies,
          quality: 'high'
        });
      
      case 2: // Dolphin - PHOTOREALISTIC
        const dolphinSpeciesMap = ['bottlenose', 'orca', 'generic'] as const;
        const dolphinSpecies = dolphinSpeciesMap[variant] || 'bottlenose';
        return SpecializedCreatureGeometry.createDolphin({
          length: 1.8 + Math.random() * 0.7,
          species: dolphinSpecies,
          quality: 'high'
        });
      
      case 3: // Jellyfish - Keep existing (already looks good)
        const jellyfishSpecies = ['moon', 'box', 'lion', 'crystal'][variant] as any;
        return JellyfishGeometry.create(0.4 + Math.random() * 0.2, jellyfishSpecies);
      
      case 4: // Ray - PHOTOREALISTIC
        const raySpeciesMap = ['manta', 'eagle', 'stingray', 'generic'] as const;
        const raySpecies = raySpeciesMap[variant] || 'generic';
        return SpecializedCreatureGeometry.createRay({
          length: 1.0 + Math.random() * 1.0,
          wingspan: 2.0 + Math.random() * 2.0,
          species: raySpecies,
          quality: 'high'
        });
      
      case 0: // Fish - PHOTOREALISTIC with multiple species
      default:
        // Map variants to different fish species
        const fishSpeciesMap = ['tropical', 'tuna', 'bass', 'generic'] as const;
        const fishSpecies = fishSpeciesMap[variant % 4] || 'generic';
        
        return EnhancedFishGeometry.createFish({
          length: 0.6 + Math.random() * 0.8, // 0.6-1.4m
          species: fishSpecies,
          quality: 'high'
        });
    }
  }

  /**
   * Get or create a mesh for an entity
   */
  public getMesh(eid: number): THREE.Mesh | THREE.Group {
    if (!this.meshes.has(eid)) {
      const geometryOrGroup = this.createGeometryForCreature(eid);
      
      let meshOrGroup: THREE.Mesh | THREE.Group;
      
      // If it's a Group (complex creatures like sharks, dolphins), use as-is
      if (geometryOrGroup instanceof THREE.Group) {
        meshOrGroup = geometryOrGroup;
      } else {
        // Get appropriate material based on variant (species)
        const type = CreatureType.type[eid];
        const variant = CreatureType.variant[eid];
        
        let materialKey = 'generic';
        if (type === 0) { // Fish
          const fishSpeciesMap = ['tropical', 'tuna', 'bass', 'generic'];
          materialKey = fishSpeciesMap[variant % 4] || 'generic';
        }
        
        const baseMaterial = this.materials.get(materialKey) || this.materials.get('generic')!;
        const material = baseMaterial.clone();
        
        // Use color from entity if available, otherwise use species default
        if (Color.r[eid] !== undefined) {
          const color = new THREE.Color(
            Color.r[eid],
            Color.g[eid],
            Color.b[eid]
          );
          material.uniforms.baseColor.value = color;
        }

        // Link lighting uniforms
        if (this.renderEngine.lightSystem) {
          const lightingUniforms = this.renderEngine.lightSystem.uniforms;
          material.uniforms.absorptionCoeff = lightingUniforms.absorptionCoeff;
          material.uniforms.deepColor = lightingUniforms.deepColor;
          material.uniforms.fogDensity = lightingUniforms.fogDensity;
        }
        
        // Set default sun direction (will be updated in render loop)
        material.uniforms.sunDirection.value.set(0.5, 1.0, 0.3).normalize();

        meshOrGroup = new THREE.Mesh(geometryOrGroup, material);
        (meshOrGroup as THREE.Mesh).castShadow = true;
        (meshOrGroup as THREE.Mesh).receiveShadow = true;
        
        // Initialize burst-glide animation parameters
        initializeBurstGlideParams(eid);
      }
      
      this.meshes.set(eid, meshOrGroup);
      this.renderEngine.scene.add(meshOrGroup);
    }
    return this.meshes.get(eid)!;
  }

  /**
   * Remove a mesh for an entity
   */
  public removeMesh(eid: number): void {
    const mesh = this.meshes.get(eid);
    if (mesh) {
      this.renderEngine.scene.remove(mesh);
      this.meshes.delete(eid);
    }
  }

  /**
   * Update all mesh positions from ECS
   */
  public updateMeshes(world: OceanWorld): void {
    const entities = query(world, [Position, MeshComponent]);

    for (const eid of entities) {
      const mesh = this.getMesh(eid);

      // Update position
      mesh.position.set(
        Position.x[eid],
        Position.y[eid],
        Position.z[eid]
      );

      // Make creature face direction of movement with smooth natural turning
      const vx = Velocity.x[eid];
      const vy = Velocity.y[eid];
      const vz = Velocity.z[eid];
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

      if (speed > 0.01) {
        // Initialize velocity history for smoothing
        if (!mesh.userData.velocityHistory) {
          mesh.userData.velocityHistory = [];
        }
        
        // Add current velocity to history
        mesh.userData.velocityHistory.push({ x: vx, y: vy, z: vz });
        
        // Keep only last 10 samples for smoothing
        if (mesh.userData.velocityHistory.length > 10) {
          mesh.userData.velocityHistory.shift();
        }
        
        // Calculate smoothed velocity (average)
        let smoothVx = 0, smoothVy = 0, smoothVz = 0;
        for (const v of mesh.userData.velocityHistory) {
          smoothVx += v.x;
          smoothVy += v.y;
          smoothVz += v.z;
        }
        const count = mesh.userData.velocityHistory.length;
        smoothVx /= count;
        smoothVy /= count;
        smoothVz /= count;
        
        // Calculate target direction using smoothed velocity
        const yaw = Math.atan2(smoothVz, smoothVx);
        const horizontalSpeed = Math.sqrt(smoothVx * smoothVx + smoothVz * smoothVz);
        const pitch = Math.atan2(smoothVy, horizontalSpeed);
        
        // Calculate banking (roll) based on turn rate
        let roll = 0;
        if (mesh.userData.lastYaw !== undefined) {
          let yawDelta = yaw - mesh.userData.lastYaw;
          // Normalize angle difference
          while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
          while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
          roll = -yawDelta * 3.0; // Bank into turns
          roll = Math.max(-0.6, Math.min(0.6, roll)); // Limit banking
        }
        mesh.userData.lastYaw = yaw;
        
        // Apply rotation with smooth quaternion interpolation
        const targetQuat = new THREE.Quaternion();
        const euler = new THREE.Euler(pitch, yaw, roll, 'YXZ');
        targetQuat.setFromEuler(euler);
        
        mesh.quaternion.slerp(targetQuat, 0.15); // Smooth interpolation
      }

      // Apply biomechanical animation to mesh
      const creatureType = CreatureType.type[eid];
      applyBiomechanicalAnimationToMesh(mesh, eid, creatureType);

      // Update scale if component exists
      if (Scale.x[eid] !== undefined) {
        mesh.scale.set(
          Scale.x[eid],
          Scale.y[eid],
          Scale.z[eid]
        );
      }

      // Update color if component exists (only for simple meshes with ShaderMaterial)
      if (Color.r[eid] !== undefined && mesh instanceof THREE.Mesh) {
        const material = mesh.material as THREE.ShaderMaterial;
        if (material && 'uniforms' in material && material.uniforms?.color) {
          (material.uniforms.color as { value: THREE.Color }).value.setRGB(
            Color.r[eid],
            Color.g[eid],
            Color.b[eid]
          );
        }
      }

      // Update visibility
      mesh.visible = MeshComponent.visible[eid] === 1;
    }
  }

  public dispose(): void {
    this.meshes.forEach(mesh => {
      this.renderEngine.scene.remove(mesh);
      
      // Dispose geometry
      if (mesh instanceof THREE.Mesh && mesh.geometry) {
        mesh.geometry.dispose();
      } else if (mesh instanceof THREE.Group) {
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else if (child.material) {
              child.material.dispose();
            }
          }
        });
      }
      
      // Dispose material
      if (mesh instanceof THREE.Mesh) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
    
    this.meshes.clear();
    
    // Dispose cached geometries and materials
    this.geometries.forEach(g => g.dispose());
    this.materials.forEach(m => m.dispose());
    this.geometries.clear();
    this.materials.clear();
  }
  /**
   * Update animation time for all meshes
   * Note: Since materials are cloned, we might want to share the time uniform or update all
   * Alternatively, if we use a Shared material for all fish (instancing), it's cheaper.
   * For now, with individual meshes, we update the base material which new clones might inherit,
   * but existing clones need update.
   */
  public updateTime(time: number): void {
    // Ideally we would share the time uniform, but since we clone materials for colors,
    // we need to update each or use a shared Uniform object.

    // Better approach: Shared Uniform for Time
    this.meshes.forEach(mesh => {
      if (!(mesh instanceof THREE.Mesh) || !mesh.material) return;
      const mat = mesh.material as THREE.ShaderMaterial;
      if (mat.uniforms && mat.uniforms.time) {
        mat.uniforms.time.value = time;
      }
    });
  }
}

/**
 * Rendering system - updates Three.js meshes from ECS data
 */
export function createRenderSystem(meshPool: FishMeshPool) {
  return (world: OceanWorld) => {
    meshPool.updateMeshes(world);
    meshPool.updateTime(world.time.elapsed);
    return world;
  };
}

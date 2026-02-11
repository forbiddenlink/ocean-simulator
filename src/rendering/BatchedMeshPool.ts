import * as THREE from 'three';
import { query } from 'bitecs';
import { Position, Velocity, Scale } from '../components/Transform';
import { Mesh as MeshComponent, Color } from '../components/Rendering';
import { CreatureType } from '../components/Biology';
import type { OceanWorld } from '../core/World';
import { RenderingEngine } from './RenderingEngine';
import { EnhancedFishGeometry } from '../creatures/EnhancedFishGeometry';
import { ProceduralFishGeometry } from '../creatures/ProceduralFishGeometry'; // TESTING: Use simple fish
import { SpecializedCreatureGeometry } from '../creatures/SpecializedCreatureGeometry';
import { JellyfishGeometry } from '../creatures/JellyfishGeometry';
import { TurtleGeometry } from '../creatures/TurtleGeometry';
import { BottomDwellerGeometry } from '../creatures/BottomDwellers';
import { WhaleGeometry } from '../creatures/WhaleGeometry';
import { applyBiomechanicalAnimationToMesh } from '../systems/BiomechanicalAnimationSystem';

/**
 * Batched rendering system using InstancedMesh for massive performance gains
 * Uses instancing for simple fish (most numerous), individual meshes for complex creatures
 */

interface InstanceData {
  eid: number;
  instanceId: number;
  matrix: THREE.Matrix4;
  color: THREE.Color;
  velocityHistory: Array<{ x: number; y: number; z: number }>;
  lastYaw?: number;
  lastQuaternion: THREE.Quaternion;
}

export class BatchedMeshPool {
  private renderEngine: RenderingEngine;

  // Instanced mesh for fish (most numerous creatures)
  private fishInstancedMesh: THREE.InstancedMesh | null = null;
  private fishInstances: Map<number, InstanceData> = new Map(); // eid -> instance data
  private fishInstanceCount: number = 0;
  private readonly MAX_FISH_INSTANCES = 2000;

  // Individual meshes for complex creatures (sharks, dolphins, rays, jellyfish)
  private individualMeshes: Map<number, THREE.Mesh | THREE.Group> = new Map();

  // Shared resources
  private fishGeometry: THREE.BufferGeometry;
  private fishMaterial: THREE.Material; // Can be ShaderMaterial or MeshPhysicalMaterial
  private tempMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private tempPosition: THREE.Vector3 = new THREE.Vector3();
  private tempQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private tempScale: THREE.Vector3 = new THREE.Vector3(1, 1, 1);
  private tempEuler: THREE.Euler = new THREE.Euler();
  private animPhaseAttribute: THREE.InstancedBufferAttribute | null = null;
  private animSpeedAttribute: THREE.InstancedBufferAttribute | null = null;

  constructor(renderEngine: RenderingEngine) {
    this.renderEngine = renderEngine;

    // Use EnhancedFishGeometry for photorealistic, detailed fish
    this.fishGeometry = EnhancedFishGeometry.createFish({
      length: 0.8,
      species: 'tropical',
      quality: 'high'
    });

    // Use MeshPhysicalMaterial for realistic fish rendering with iridescence
    // Color set to WHITE so instance colors display at full brightness
    // Instance colors multiply with base color, so white = full instance color
    this.fishMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, // White base so instance colors show properly
      metalness: 0.1, // Low metalness for diffuse color visibility
      roughness: 0.65, // Rough surface for diffuse light spread
      flatShading: false,
      emissive: new THREE.Color(0x6699bb), // Brighter cyan-blue emissive (Phase 2 visual fix)
      emissiveIntensity: 0.5, // Stronger glow for visibility in dark underwater
      iridescence: 0.25, // Subtle fish scale shimmer
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [100, 400],
    });

    // Inject GPU swimming animation into vertex shader
    (this.fishMaterial as THREE.MeshPhysicalMaterial).onBeforeCompile = (shader) => {
      // Add instance attributes as varyings
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
attribute float animPhase;
attribute float animSpeed;
`
      );

      // Inject swimming displacement after begin_vertex
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  // Swimming S-curve: displacement increases from head to tail
  // Fish geometry extends along X axis; normalize to [0,1] range
  float posAlongBody = clamp((position.x + 0.4) / 0.8, 0.0, 1.0);
  float ampEnvelope = smoothstep(0.0, 1.0, posAlongBody);
  float amplitude = ampEnvelope * animSpeed * 0.08;
  float lateralDisp = sin(posAlongBody * 6.28318 - animPhase) * amplitude;
  transformed.z += lateralDisp;
}
`
      );
    };

    // Create instanced mesh for fish
    this.fishInstancedMesh = new THREE.InstancedMesh(
      this.fishGeometry,
      this.fishMaterial,
      this.MAX_FISH_INSTANCES
    );
    this.fishInstancedMesh.castShadow = true;
    this.fishInstancedMesh.receiveShadow = true;
    this.fishInstancedMesh.count = 0; // Start with 0 instances

    // Swimming animation attributes (per-instance)
    const animPhaseArray = new Float32Array(this.MAX_FISH_INSTANCES);
    const animSpeedArray = new Float32Array(this.MAX_FISH_INSTANCES);
    this.animPhaseAttribute = new THREE.InstancedBufferAttribute(animPhaseArray, 1);
    this.animSpeedAttribute = new THREE.InstancedBufferAttribute(animSpeedArray, 1);
    this.fishInstancedMesh.geometry.setAttribute('animPhase', this.animPhaseAttribute);
    this.fishInstancedMesh.geometry.setAttribute('animSpeed', this.animSpeedAttribute);

    this.renderEngine.scene.add(this.fishInstancedMesh);    console.log(`🐟 Created instanced mesh pool for ${this.MAX_FISH_INSTANCES} fish`);  }

  /**
   * Add a fish entity to the instanced mesh
   */
  private addFishInstance(eid: number): void {
    if (this.fishInstances.has(eid)) return;
    if (this.fishInstanceCount >= this.MAX_FISH_INSTANCES) {
      console.warn('Max fish instances reached');
      return;
    }

    const instanceId = this.fishInstanceCount++;
    const color = new THREE.Color(Color.r[eid], Color.g[eid], Color.b[eid]);

    this.fishInstances.set(eid, {
      eid,
      instanceId,
      matrix: new THREE.Matrix4(),
      color,
      velocityHistory: [],
      lastQuaternion: new THREE.Quaternion()
    });

    // Set instance color
    this.fishInstancedMesh!.setColorAt(instanceId, color);

    // Mark instance color buffer for update
    if (this.fishInstancedMesh!.instanceColor) {
      this.fishInstancedMesh!.instanceColor.needsUpdate = true;
    }

    // Update instance count
    this.fishInstancedMesh!.count = this.fishInstanceCount;
  }

  /**
   * Update a fish instance's transform
   */
  private updateFishInstance(eid: number, _world: OceanWorld): void {
    const instance = this.fishInstances.get(eid);
    if (!instance) return;

    // Position
    this.tempPosition.set(Position.x[eid], Position.y[eid], Position.z[eid]);

    // Rotation based on velocity (smooth)
    const vx = Velocity.x[eid];
    const vy = Velocity.y[eid];
    const vz = Velocity.z[eid];
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    if (speed > 0.01) {
      // Add to velocity history for smoothing
      instance.velocityHistory.push({ x: vx, y: vy, z: vz });
      if (instance.velocityHistory.length > 4) {
        instance.velocityHistory.shift();
      }

      // Calculate smoothed velocity
      let smoothVx = 0, smoothVy = 0, smoothVz = 0;
      for (const v of instance.velocityHistory) {
        smoothVx += v.x;
        smoothVy += v.y;
        smoothVz += v.z;
      }
      const count = instance.velocityHistory.length;
      smoothVx /= count;
      smoothVy /= count;
      smoothVz /= count;

      // Calculate rotation
      // Fish geometry has head at -X, so we need to rotate 180° (Math.PI) to face forward
      const yaw = Math.atan2(smoothVx, smoothVz); // Swapped for correct orientation
      const horizontalSpeed = Math.sqrt(smoothVx * smoothVx + smoothVz * smoothVz);
      // Clamp pitch to realistic fish angles (max ~30 degrees = 0.52 rad)
      // Real fish swim mostly horizontally and only tilt slightly when changing depth
      let pitch = -Math.atan2(smoothVy, horizontalSpeed); // Negative for correct pitch
      pitch = Math.max(-0.52, Math.min(0.52, pitch)); // Limit to ±30 degrees

      // Banking based on turn rate
      let roll = 0;
      if (instance.lastYaw !== undefined) {
        let yawDelta = yaw - instance.lastYaw;
        while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
        while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
        roll = -yawDelta * 3.0;
        roll = Math.max(-0.6, Math.min(0.6, roll));
      }
      instance.lastYaw = yaw;

      this.tempEuler.set(pitch, yaw, roll, 'YXZ');
      const targetQuat = new THREE.Quaternion().setFromEuler(this.tempEuler);
      instance.lastQuaternion.slerp(targetQuat, 0.15);
      this.tempQuaternion.copy(instance.lastQuaternion);
    }

    // Apply entity scale
    this.tempScale.set(Scale.x[eid] || 1, Scale.y[eid] || 1, Scale.z[eid] || 1);

    // Build matrix
    this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);

    // Set instance matrix
    this.fishInstancedMesh!.setMatrixAt(instance.instanceId, this.tempMatrix);

    // Mark for update
    this.fishInstancedMesh!.instanceMatrix.needsUpdate = true;

    // Update swimming animation attributes
    if (this.animPhaseAttribute && this.animSpeedAttribute) {
      const dt = _world.time.delta;
      const maxSpeed = 3.0; // Reference max speed for normalization
      const normalizedSpeed = Math.min(1.0, speed / maxSpeed);

      // Phase accumulates: 2.5Hz idle + up to 5Hz more at full speed
      const currentPhase = this.animPhaseAttribute.array[instance.instanceId] as number || 0;
      (this.animPhaseAttribute.array as Float32Array)[instance.instanceId] = currentPhase + (2.5 + normalizedSpeed * 5.0) * dt * Math.PI * 2;
      (this.animSpeedAttribute.array as Float32Array)[instance.instanceId] = normalizedSpeed;
    }

    // Update color if changed
    const currentColor = new THREE.Color(Color.r[eid], Color.g[eid], Color.b[eid]);
    if (!instance.color.equals(currentColor)) {
      instance.color.copy(currentColor);
      this.fishInstancedMesh!.setColorAt(instance.instanceId, currentColor);
      if (this.fishInstancedMesh!.instanceColor) {
        this.fishInstancedMesh!.instanceColor.needsUpdate = true;
      }
    }
  }

  /**
   * Create PHOTOREALISTIC geometry for complex creatures
   */
  private createGeometryForCreature(eid: number): THREE.BufferGeometry | THREE.Group {
    const type = CreatureType.type[eid];
    const variant = CreatureType.variant[eid];

    switch (type) {
      case 1: // Shark - PHOTOREALISTIC
        const sharkSpeciesMap = ['great_white', 'hammerhead', 'reef', 'generic'] as const;
        const sharkSpecies = sharkSpeciesMap[variant] || 'generic';
        return SpecializedCreatureGeometry.createShark({
          length: 2.0, // Reduced from 3.0 - more manageable size
          species: sharkSpecies,
          quality: 'high'
        });

      case 2: // Dolphin - PHOTOREALISTIC
        const dolphinSpeciesMap = ['bottlenose', 'orca', 'generic'] as const;
        const dolphinSpecies = dolphinSpeciesMap[variant] || 'bottlenose';
        return SpecializedCreatureGeometry.createDolphin({
          length: 1.5, // Reduced from 2.5
          species: dolphinSpecies,
          quality: 'high'
        });

      case 3: // Jellyfish - Keep existing
        const jellyfishSpecies = ['moon', 'box', 'lion', 'crystal'][variant] as any;
        return JellyfishGeometry.create(0.4, jellyfishSpecies);

      case 4: // Ray - PHOTOREALISTIC
        const raySpeciesMap = ['manta', 'eagle', 'stingray', 'generic'] as const;
        const raySpecies = raySpeciesMap[variant] || 'generic';
        return SpecializedCreatureGeometry.createRay({
          length: 0.8, // Reduced from 2.0
          wingspan: 1.8, // Reduced proportionally
          species: raySpecies,
          quality: 'high'
        });

      case 5: // Turtle - PHOTOREALISTIC
        const turtleSpeciesMap = ['green', 'hawksbill', 'loggerhead'] as const;
        const turtleSpecies = turtleSpeciesMap[variant] || 'green';
        return TurtleGeometry.create(1.0, turtleSpecies);

      case 6: // Crab - Bottom dweller
        return BottomDwellerGeometry.createCrab(0.2);

      case 7: // Starfish - Bottom dweller
        return BottomDwellerGeometry.createStarfish(0.3);

      case 8: // Sea Urchin - Bottom dweller
        return BottomDwellerGeometry.createSeaUrchin(0.15);

      case 9: // Whale - PHOTOREALISTIC
        const whaleVariant = variant;
        if (whaleVariant === 1) {
          return WhaleGeometry.createBlueWhale(15.0);
        }
        return WhaleGeometry.createHumpback(12.0);

      default: // Fish - TESTING: Simple geometry
        return ProceduralFishGeometry.createFish({
          length: 0.6,
          bodyThickness: 0.3,
          species: 'medium'
        });
    }
  }

  /**
   * Create species-appropriate MeshPhysicalMaterial for a creature entity.
   * Each creature type gets unique color, roughness, metalness, and emissive
   * properties to look natural underwater.
   */
  private createCreatureMaterial(eid: number): THREE.MeshPhysicalMaterial {
    const type = CreatureType.type[eid];

    switch (type) {
      case 1: // Shark - slate gray, rough skin (Phase 4: brighter)
        return new THREE.MeshPhysicalMaterial({
          color: 0x9aa8b8, // Brighter base
          roughness: 0.65,
          metalness: 0.15,
          emissive: new THREE.Color(0x4a5a6a),
          emissiveIntensity: 0.4, // Increased from 0.25
        });

      case 2: // Dolphin - blue-gray, smoother skin (Phase 4: brighter)
        return new THREE.MeshPhysicalMaterial({
          color: 0xa0b0c0, // Brighter base
          roughness: 0.35,
          metalness: 0.2,
          emissive: new THREE.Color(0x5a6a7a),
          emissiveIntensity: 0.4, // Increased from 0.25
        });

      case 3: // Jellyfish - translucent pale blue (Phase 4: stronger glow)
        return new THREE.MeshPhysicalMaterial({
          color: 0xbbddff, // Brighter base
          roughness: 0.2,
          metalness: 0.0,
          transmission: 0.6,
          thickness: 0.5,
          transparent: true,
          opacity: 0.8,
          emissive: new THREE.Color(0x6699bb),
          emissiveIntensity: 0.6, // Increased from 0.5
        });

      case 4: // Ray - olive-brown (Phase 4: brighter)
        return new THREE.MeshPhysicalMaterial({
          color: 0x889988, // Brighter base
          roughness: 0.5,
          metalness: 0.1,
          emissive: new THREE.Color(0x445544),
          emissiveIntensity: 0.4, // Increased from 0.25
        });

      case 5: // Turtle - green-brown (Phase 4: brighter)
        return new THREE.MeshPhysicalMaterial({
          color: 0x8aaa7a, // Brighter base
          roughness: 0.7,
          metalness: 0.1,
          emissive: new THREE.Color(0x456540),
          emissiveIntensity: 0.4, // Increased from 0.25
        });

      case 6: // Crab - reddish-brown (Phase 4: brighter)
        return new THREE.MeshPhysicalMaterial({
          color: 0xdd8866, // Brighter base
          roughness: 0.6,
          metalness: 0.15,
          emissive: new THREE.Color(0x664433),
          emissiveIntensity: 0.45, // Increased from 0.3
        });

      case 7: // Starfish - orange-red (Phase 4: brighter)
        return new THREE.MeshPhysicalMaterial({
          color: 0xff9977, // Brighter base
          roughness: 0.5,
          metalness: 0.1,
          emissive: new THREE.Color(0x775533),
          emissiveIntensity: 0.5, // Increased from 0.35
        });

      case 8: // Sea Urchin - dark purple (Phase 4: brighter)
        return new THREE.MeshPhysicalMaterial({
          color: 0x5a4a5a, // Brighter base
          roughness: 0.8,
          metalness: 0.1,
          emissive: new THREE.Color(0x332a35),
          emissiveIntensity: 0.35, // Increased from 0.2
        });

      case 9: // Whale - dark blue-gray (Phase 4: brighter)
        return new THREE.MeshPhysicalMaterial({
          color: 0x708090, // Brighter base
          roughness: 0.75,
          metalness: 0.1,
          emissive: new THREE.Color(0x304050),
          emissiveIntensity: 0.35, // Increased from 0.2
        });

      default: // Fallback fish material (for individual non-instanced fish)
        return new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.4,
          metalness: 0.3,
          emissive: new THREE.Color(0x224466),
          emissiveIntensity: 0.3,
          iridescence: 0.5,
          iridescenceIOR: 1.3,
          iridescenceThicknessRange: [100, 400],
        });
    }
  }

  /**
   * Get or create individual mesh for complex creatures
   */
  private getIndividualMesh(eid: number): THREE.Mesh | THREE.Group {
    if (!this.individualMeshes.has(eid)) {
      const geometryOrGroup = this.createGeometryForCreature(eid);

      let meshOrGroup: THREE.Mesh | THREE.Group;

      if (geometryOrGroup instanceof THREE.Group) {
        meshOrGroup = geometryOrGroup;
      } else {
        // Ensure geometry has normals (tangents are computed in shader)
        if (!geometryOrGroup.attributes.normal) {
          geometryOrGroup.computeVertexNormals();
        }
        
        // Ensure geometry has UVs for texture mapping
        if (!geometryOrGroup.attributes.uv) {
          // Add UVs normalized to bounding box for correct texture mapping
          geometryOrGroup.computeBoundingBox();
          const bbox = geometryOrGroup.boundingBox!;
          const sizeX = bbox.max.x - bbox.min.x || 1;
          const sizeY = bbox.max.y - bbox.min.y || 1;
          const positions = geometryOrGroup.attributes.position;
          const uvs = new Float32Array(positions.count * 2);
          for (let i = 0; i < positions.count; i++) {
            uvs[i * 2] = (positions.getX(i) - bbox.min.x) / sizeX;
            uvs[i * 2 + 1] = (positions.getY(i) - bbox.min.y) / sizeY;
          }
          geometryOrGroup.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        }
        
        const material = this.createCreatureMaterial(eid);

        meshOrGroup = new THREE.Mesh(geometryOrGroup, material);
        (meshOrGroup as THREE.Mesh).castShadow = true;
        (meshOrGroup as THREE.Mesh).receiveShadow = true;
      }

      this.individualMeshes.set(eid, meshOrGroup);
      this.renderEngine.scene.add(meshOrGroup);
    }
    return this.individualMeshes.get(eid)!;
  }

  /**
   * Update individual mesh transforms
   */
  private updateIndividualMesh(eid: number): void {
    const mesh = this.getIndividualMesh(eid);

    // Update position
    mesh.position.set(Position.x[eid], Position.y[eid], Position.z[eid]);

    // Update rotation based on velocity (same smooth logic as original)
    const vx = Velocity.x[eid];
    const vy = Velocity.y[eid];
    const vz = Velocity.z[eid];
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    if (speed > 0.01) {
      if (!mesh.userData.velocityHistory) {
        mesh.userData.velocityHistory = [];
      }

      mesh.userData.velocityHistory.push({ x: vx, y: vy, z: vz });
      if (mesh.userData.velocityHistory.length > 4) {
        mesh.userData.velocityHistory.shift();
      }

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

      // Fish/creature geometry has head at -X, swap args for correct orientation
      const yaw = Math.atan2(smoothVx, smoothVz);
      const horizontalSpeed = Math.sqrt(smoothVx * smoothVx + smoothVz * smoothVz);
      // Clamp pitch to realistic angles (max ~30 degrees = 0.52 rad)
      let pitch = -Math.atan2(smoothVy, horizontalSpeed); // Negative for correct pitch
      pitch = Math.max(-0.52, Math.min(0.52, pitch)); // Limit to ±30 degrees

      let roll = 0;
      if (mesh.userData.lastYaw !== undefined) {
        let yawDelta = yaw - mesh.userData.lastYaw;
        while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
        while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
        roll = -yawDelta * 3.0;
        roll = Math.max(-0.6, Math.min(0.6, roll));
      }
      mesh.userData.lastYaw = yaw;

      const targetQuat = new THREE.Quaternion();
      this.tempEuler.set(pitch, yaw, roll, 'YXZ');
      targetQuat.setFromEuler(this.tempEuler);
      mesh.quaternion.slerp(targetQuat, 0.15);
    }

    // Apply PHOTOREALISTIC biomechanical animation
    const creatureType = CreatureType.type[eid];
    applyBiomechanicalAnimationToMesh(mesh, eid, creatureType);

    // Update scale if exists
    if (Scale.x[eid] !== undefined) {
      mesh.scale.set(Scale.x[eid], Scale.y[eid], Scale.z[eid]);
    }

    // Update visibility
    mesh.visible = MeshComponent.visible[eid] === 1;
  }

  /**
   * Update all mesh transforms and properties
   */
  public updateMeshes(world: OceanWorld): void {
    const entities = query(world, [Position, MeshComponent]);

    // Track which entities still exist for cleanup
    const existingEntities = new Set<number>(entities);

    // DEBUG: Count by type
    const typeCounts = { fish: 0, shark: 0, dolphin: 0, jellyfish: 0, ray: 0, turtle: 0, crab: 0, starfish: 0, seaUrchin: 0, whale: 0 };

    for (const eid of entities) {
      const creatureType = CreatureType.type[eid] ?? -1;

      // Count types
      const typeNames = ['fish', 'shark', 'dolphin', 'jellyfish', 'ray', 'turtle', 'crab', 'starfish', 'seaUrchin', 'whale'];
      if (creatureType >= 0 && creatureType < 10) {
        typeCounts[typeNames[creatureType] as keyof typeof typeCounts]++;
      }

      if (creatureType === 0) {
        // Fish - use instancing
        if (!this.fishInstances.has(eid)) {
          this.addFishInstance(eid);
        }
        this.updateFishInstance(eid, world);
      } else {
        // Complex creatures - individual meshes
        this.updateIndividualMesh(eid);
      }
    }

    // Cleanup: Remove meshes for entities that no longer exist
    // Clean up individual meshes
    for (const [eid, mesh] of this.individualMeshes) {
      if (!existingEntities.has(eid)) {
        this.renderEngine.scene.remove(mesh);
        if (mesh instanceof THREE.Mesh) {
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        } else if (mesh instanceof THREE.Group) {
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry?.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material?.dispose();
              }
            }
          });
        }
        this.individualMeshes.delete(eid);
      }
    }

    // Clean up fish instances (mark removed instances for reuse)
    for (const [eid, _instance] of this.fishInstances) {
      if (!existingEntities.has(eid)) {
        this.fishInstances.delete(eid);
        // Note: Instance slot will be reused when new fish are added
        // For simplicity, we don't compact the instance array here
      }
    }

    // DEBUG: Log occasionally
    if (Math.random() < 0.01) {
      const individualCount = typeCounts.shark + typeCounts.dolphin + typeCounts.jellyfish + typeCounts.ray + typeCounts.turtle + typeCounts.crab + typeCounts.starfish + typeCounts.seaUrchin + typeCounts.whale;
      console.log(`🐟 Mesh Pool: ${typeCounts.fish} fish (instanced: ${this.fishInstanceCount}), ${individualCount} individual (${this.individualMeshes.size} in scene)`);
    }

    // Mark animation attributes for GPU upload (once per frame, not per instance)
    if (this.animPhaseAttribute) this.animPhaseAttribute.needsUpdate = true;
    if (this.animSpeedAttribute) this.animSpeedAttribute.needsUpdate = true;
  }

  /**
   * Update shader time uniform (disabled for simple material)
   */
  public updateTime(time: number): void {
    // Update time uniforms for EnhancedFishMaterial animation
    const shaderMat = this.fishMaterial as THREE.ShaderMaterial;
    if (shaderMat.uniforms?.time) {
      shaderMat.uniforms.time.value = time;
    }
    if (shaderMat.uniforms?.swimPhase) {
      shaderMat.uniforms.swimPhase.value = time;
    }
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    // Dispose instanced mesh
    if (this.fishInstancedMesh) {
      this.renderEngine.scene.remove(this.fishInstancedMesh);
      this.fishInstancedMesh.dispose();
    }

    // Dispose individual meshes
    this.individualMeshes.forEach(mesh => {
      this.renderEngine.scene.remove(mesh);
      if (mesh instanceof THREE.Mesh) {
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    // Dispose shared resources
    this.fishGeometry.dispose();
    this.fishMaterial.dispose();

    // Clear maps
    this.fishInstances.clear();
    this.individualMeshes.clear();
  }
}

/**
 * Create batched render system
 */
export function createBatchedRenderSystem(meshPool: BatchedMeshPool) {
  return (world: OceanWorld) => {
    meshPool.updateMeshes(world);
    meshPool.updateTime(world.time.elapsed);
    return world;
  };
}

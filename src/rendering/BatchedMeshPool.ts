import * as THREE from 'three';
import { query } from 'bitecs';
import { Position, Velocity, Scale } from '../components/Transform';
import { Mesh as MeshComponent, Color } from '../components/Rendering';
import { CreatureType } from '../components/Biology';
import type { OceanWorld } from '../core/World';
import { RenderingEngine } from './RenderingEngine';
import { ProceduralFishGeometry } from '../creatures/ProceduralFishGeometry';
import { SimpleFishGeometry, FishBodyType } from '../creatures/SimpleFishGeometry';
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
  bodyType: number; // Which body type mesh this instance belongs to
  matrix: THREE.Matrix4;
  color: THREE.Color;
  velocityHistory: Array<{ x: number; y: number; z: number }>;
  lastYaw?: number;
  lastQuaternion: THREE.Quaternion;
}

// Body type names for logging
const BODY_TYPE_NAMES = ['standard', 'slender', 'disc', 'chunky'];

export class BatchedMeshPool {
  private renderEngine: RenderingEngine;

  // Instanced meshes for fish - one per body type for visual variety
  private fishInstancedMeshes: THREE.InstancedMesh[] = [];
  private fishInstances: Map<number, InstanceData> = new Map(); // eid -> instance data
  private fishInstanceCounts: number[] = [0, 0, 0, 0]; // Count per body type
  private freeInstanceSlots: number[][] = [[], [], [], []]; // Reusable slots per body type
  private readonly MAX_FISH_PER_TYPE = 500; // 500 per type = 2000 total

  // Individual meshes for complex creatures (sharks, dolphins, rays, jellyfish)
  private individualMeshes: Map<number, THREE.Mesh | THREE.Group> = new Map();

  // Shared resources - geometries and materials per body type
  private fishGeometries: THREE.BufferGeometry[] = [];
  private fishMaterials: THREE.Material[] = [];
  private tempMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private tempPosition: THREE.Vector3 = new THREE.Vector3();
  private tempQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private tempScale: THREE.Vector3 = new THREE.Vector3(1, 1, 1);
  private tempEuler: THREE.Euler = new THREE.Euler();
  private animPhaseAttributes: THREE.InstancedBufferAttribute[] = [];
  private animSpeedAttributes: THREE.InstancedBufferAttribute[] = [];

  constructor(renderEngine: RenderingEngine) {
    this.renderEngine = renderEngine;

    // Create 4 different fish body types for visual variety
    const bodyTypes = [
      FishBodyType.STANDARD,
      FishBodyType.SLENDER,
      FishBodyType.DISC,
      FishBodyType.CHUNKY
    ];

    for (let i = 0; i < 4; i++) {
      // Create geometry for this body type
      const geometry = SimpleFishGeometry.createByType(bodyTypes[i], {
        length: 1.0,
        bodyHeight: 0.4
      });
      this.fishGeometries.push(geometry);

      // Create material with GPU swimming animation
      const material = this.createFishMaterial();
      this.fishMaterials.push(material);

      // Create instanced mesh for this body type
      const instancedMesh = new THREE.InstancedMesh(
        geometry,
        material,
        this.MAX_FISH_PER_TYPE
      );
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      instancedMesh.count = 0;
      instancedMesh.name = `fish_${BODY_TYPE_NAMES[i]}`;

      // Swimming animation attributes (per-instance)
      const animPhaseArray = new Float32Array(this.MAX_FISH_PER_TYPE);
      const animSpeedArray = new Float32Array(this.MAX_FISH_PER_TYPE);
      const animPhaseAttr = new THREE.InstancedBufferAttribute(animPhaseArray, 1);
      const animSpeedAttr = new THREE.InstancedBufferAttribute(animSpeedArray, 1);
      instancedMesh.geometry.setAttribute('animPhase', animPhaseAttr);
      instancedMesh.geometry.setAttribute('animSpeed', animSpeedAttr);
      this.animPhaseAttributes.push(animPhaseAttr);
      this.animSpeedAttributes.push(animSpeedAttr);

      this.fishInstancedMeshes.push(instancedMesh);
      this.renderEngine.scene.add(instancedMesh);
    }

    const totalCapacity = this.MAX_FISH_PER_TYPE * 4;
    console.log(`🐟 Created 4 instanced mesh pools (${BODY_TYPE_NAMES.join(', ')}) for ${totalCapacity} total fish`);
  }

  /**
   * Create fish material with GPU swimming animation
   */
  private createFishMaterial(): THREE.MeshPhysicalMaterial {
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.15,
      roughness: 0.5,
      flatShading: false,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x888888),
      emissiveIntensity: 0.3,
      iridescence: 0.4,
      iridescenceIOR: 1.4,
      iridescenceThicknessRange: [100, 400],
      clearcoat: 0.2,
      clearcoatRoughness: 0.3,
    });

    // Inject GPU swimming animation into vertex shader
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
attribute float animPhase;
attribute float animSpeed;
attribute float finType;
`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  float posAlongBody = clamp((position.x + 0.4) / 0.8, 0.0, 1.0);
  float ampEnvelope = smoothstep(0.0, 1.0, posAlongBody);
  float amplitude = ampEnvelope * animSpeed * 0.08;
  float lateralDisp = sin(posAlongBody * 6.28318 - animPhase) * amplitude;
  transformed.z += lateralDisp;

  if (finType > 0.5 && finType < 1.5) {
    float tailProgress = clamp((position.x - 0.3) / 0.25, 0.0, 1.0);
    float tailAmp = tailProgress * animSpeed * 0.15;
    float tailWave = sin(animPhase * 1.2) * tailAmp;
    transformed.z += tailWave;
  }
  else if (finType > 1.5 && finType < 2.5) {
    float finSway = sin(animPhase * 0.8 + position.y * 2.0) * animSpeed * 0.02;
    transformed.z += finSway;
  }
  else if (finType > 2.5) {
    float side = sign(position.z);
    float flapPhase = animPhase * 2.0 + side * 1.57;
    float flapAmp = animSpeed * 0.06;
    float flapAngle = sin(flapPhase) * flapAmp;
    float cosF = cos(flapAngle);
    float sinF = sin(flapAngle);
    float newY = transformed.y * cosF - transformed.z * sinF * side;
    float newZ = transformed.y * sinF * side + transformed.z * cosF;
    transformed.y = newY;
    transformed.z = newZ;
  }
}
`
      );
    };

    return material;
  }

  /**
   * Add a fish entity to the appropriate instanced mesh based on body type
   */
  private addFishInstance(eid: number): void {
    if (this.fishInstances.has(eid)) return;

    // Determine body type from creature variant (0-3)
    const bodyType = (CreatureType.variant[eid] ?? 0) % 4;

    // Try to reuse a free slot first, otherwise allocate new
    let instanceId: number;
    if (this.freeInstanceSlots[bodyType].length > 0) {
      instanceId = this.freeInstanceSlots[bodyType].pop()!;
    } else {
      if (this.fishInstanceCounts[bodyType] >= this.MAX_FISH_PER_TYPE) {
        console.warn(`Max fish instances reached for body type ${BODY_TYPE_NAMES[bodyType]}`);
        return;
      }
      instanceId = this.fishInstanceCounts[bodyType]++;
    }

    const color = new THREE.Color(Color.r[eid], Color.g[eid], Color.b[eid]);

    this.fishInstances.set(eid, {
      eid,
      instanceId,
      bodyType,
      matrix: new THREE.Matrix4(),
      color,
      velocityHistory: [],
      lastQuaternion: new THREE.Quaternion()
    });

    // Set instance color on the correct mesh
    const mesh = this.fishInstancedMeshes[bodyType];
    mesh.setColorAt(instanceId, color);

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    // Update instance count for this body type (mesh.count tracks highest used index + 1)
    mesh.count = this.fishInstanceCounts[bodyType];
  }

  /**
   * Update a fish instance's transform
   */
  private updateFishInstance(eid: number, _world: OceanWorld): void {
    const instance = this.fishInstances.get(eid);
    if (!instance) return;

    const { bodyType, instanceId } = instance;
    const mesh = this.fishInstancedMeshes[bodyType];
    const animPhaseAttr = this.animPhaseAttributes[bodyType];
    const animSpeedAttr = this.animSpeedAttributes[bodyType];

    // Position
    this.tempPosition.set(Position.x[eid], Position.y[eid], Position.z[eid]);

    // Rotation based on velocity (smooth)
    const vx = Velocity.x[eid];
    const vy = Velocity.y[eid];
    const vz = Velocity.z[eid];
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    if (speed > 0.01) {
      instance.velocityHistory.push({ x: vx, y: vy, z: vz });
      if (instance.velocityHistory.length > 4) {
        instance.velocityHistory.shift();
      }

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

      const yaw = Math.atan2(smoothVx, smoothVz) + Math.PI;
      const horizontalSpeed = Math.sqrt(smoothVx * smoothVx + smoothVz * smoothVz);
      let pitch = -Math.atan2(smoothVy, horizontalSpeed);
      pitch = Math.max(-0.52, Math.min(0.52, pitch));

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

    this.tempScale.set(Scale.x[eid] || 1, Scale.y[eid] || 1, Scale.z[eid] || 1);
    this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);

    mesh.setMatrixAt(instanceId, this.tempMatrix);
    mesh.instanceMatrix.needsUpdate = true;

    // Update swimming animation attributes
    if (animPhaseAttr && animSpeedAttr) {
      const dt = _world.time.delta;
      const maxSpeed = 3.0;
      const normalizedSpeed = Math.min(1.0, speed / maxSpeed);

      const currentPhase = animPhaseAttr.array[instanceId] as number || 0;
      (animPhaseAttr.array as Float32Array)[instanceId] = currentPhase + (2.5 + normalizedSpeed * 5.0) * dt * Math.PI * 2;
      (animSpeedAttr.array as Float32Array)[instanceId] = normalizedSpeed;
    }

    // Update color if changed
    const currentColor = new THREE.Color(Color.r[eid], Color.g[eid], Color.b[eid]);
    if (!instance.color.equals(currentColor)) {
      instance.color.copy(currentColor);
      mesh.setColorAt(instanceId, currentColor);
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
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

      // Fish/creature geometry has head at -X, tail at +X
      // Add PI to flip creature so head points in direction of travel
      const yaw = Math.atan2(smoothVx, smoothVz) + Math.PI;
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

    // Clean up fish instances (add freed slots to reuse pool)
    for (const [eid, instance] of this.fishInstances) {
      if (!existingEntities.has(eid)) {
        // Add the instance slot to the free pool for reuse
        this.freeInstanceSlots[instance.bodyType].push(instance.instanceId);
        this.fishInstances.delete(eid);
      }
    }

    // DEBUG: Log occasionally
    if (Math.random() < 0.01) {
      const totalFishInstanced = this.fishInstanceCounts.reduce((a, b) => a + b, 0);
      const individualCount = typeCounts.shark + typeCounts.dolphin + typeCounts.jellyfish + typeCounts.ray + typeCounts.turtle + typeCounts.crab + typeCounts.starfish + typeCounts.seaUrchin + typeCounts.whale;
      const bodyTypeCounts = BODY_TYPE_NAMES.map((name, i) => `${name}:${this.fishInstanceCounts[i]}`).join(', ');
      console.log(`🐟 Mesh Pool: ${typeCounts.fish} fish (${bodyTypeCounts}, total:${totalFishInstanced}), ${individualCount} individual`);
    }

    // Mark animation attributes for GPU upload (once per frame, for all body types)
    for (let i = 0; i < 4; i++) {
      if (this.animPhaseAttributes[i]) this.animPhaseAttributes[i].needsUpdate = true;
      if (this.animSpeedAttributes[i]) this.animSpeedAttributes[i].needsUpdate = true;
    }
  }

  /**
   * Update shader time uniform (disabled for simple material)
   */
  public updateTime(time: number): void {
    // Update time uniforms for all fish materials
    for (const material of this.fishMaterials) {
      const shaderMat = material as THREE.ShaderMaterial;
      if (shaderMat.uniforms?.time) {
        shaderMat.uniforms.time.value = time;
      }
      if (shaderMat.uniforms?.swimPhase) {
        shaderMat.uniforms.swimPhase.value = time;
      }
    }
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    // Dispose all instanced meshes
    for (const mesh of this.fishInstancedMeshes) {
      this.renderEngine.scene.remove(mesh);
      mesh.dispose();
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
    for (const geometry of this.fishGeometries) {
      geometry.dispose();
    }
    for (const material of this.fishMaterials) {
      material.dispose();
    }

    // Clear collections
    this.fishInstances.clear();
    this.individualMeshes.clear();
    this.fishInstancedMeshes.length = 0;
    this.fishGeometries.length = 0;
    this.fishMaterials.length = 0;
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

import { query } from 'bitecs';
import * as THREE from 'three';
import { Position, Velocity, Rotation } from '../components/Transform';
import { SwimmingStyle, CreatureType } from '../components/Biology';
import type { OceanWorld } from '../core/World';

// Pre-allocated Vector3 for orientation calculations (reused every frame)
const _tempDirection = new THREE.Vector3();

/**
 * Swimming locomotion states
 */
export const SwimState = {
  IDLE: 0,      // Hovering, minimal movement
  CRUISE: 1,    // Efficient burst-and-glide
  SPRINT: 2,    // Maximum speed, continuous beats
  TURN: 3,      // Executing turn maneuver
  ESCAPE: 4,    // C-start escape response
  BRAKE: 5      // Decelerating
} as const;

/**
 * Enhanced animation state with biomechanical accuracy
 */
export const BiomechanicalAnimationState = {
  // Basic animation
  phase: new Float32Array(10000),
  swimState: new Uint8Array(10000),
  
  // Body wave (travels from head to tail)
  bodyWavePhase: new Float32Array(10000),
  bodyWaveAmplitude: new Float32Array(10000),
  bodyWaveFrequency: new Float32Array(10000),
  
  // Tail movement
  tailBendAngle: new Float32Array(10000),
  tailBeatFrequency: new Float32Array(10000),
  
  // Fin states
  pectoralLeft: new Float32Array(10000),
  pectoralRight: new Float32Array(10000),
  dorsalExtension: new Float32Array(10000),
  analExtension: new Float32Array(10000),
  pelvicAngle: new Float32Array(10000),
  
  // Secondary motion
  gillFlap: new Float32Array(10000),
  bodyRoll: new Float32Array(10000),
  bodyPitch: new Float32Array(10000),
  
  // Burst-and-glide state
  burstGlideState: new Uint8Array(10000), // 0 = burst, 1 = glide
  burstGlideTimer: new Float32Array(10000),
  burstDuration: new Float32Array(10000),
  glideDuration: new Float32Array(10000),
  
  // Turn state
  turnProgress: new Float32Array(10000),
  turnSharpness: new Float32Array(10000),
  targetDirection: new Float32Array(10000 * 3), // Vec3 stored flat
};

/**
 * Biomechanically accurate animation system
 */
export function createBiomechanicalAnimationSystem(_world: OceanWorld) {
  return (world: OceanWorld) => {
    const deltaTime = world.time.delta; // Already in seconds from updateWorldTime
    const entities = query(world, [Position, Velocity, SwimmingStyle, CreatureType]);
    
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      
      // Calculate current speed
      const speed = Math.sqrt(
        Velocity.x[eid] ** 2 +
        Velocity.y[eid] ** 2 +
        Velocity.z[eid] ** 2
      );
      
      // Determine swimming state
      updateSwimState(eid, speed, deltaTime);
      
      // Update animations based on swimming style
      const style = SwimmingStyle.style[eid];
      
      switch (style) {
        case 0: // Body-caudal (most fish)
          animateBodyCaudal(eid, speed, deltaTime);
          break;
        case 1: // Pectoral (rays)
          animatePectoral(eid, speed, deltaTime);
          break;
        case 2: // Jet propulsion (jellyfish)
          animateJetPropulsion(eid, speed, deltaTime);
          break;
        case 3: // Flukes (dolphins)
          animateFlukes(eid, speed, deltaTime);
          break;
      }
      
      // Update secondary motion (gills, subtle body movements)
      updateSecondaryMotion(eid, speed, deltaTime);
      
      // Update rotation to face velocity direction with smooth banking
      updateOrientationWithBanking(eid, speed, deltaTime);
    }
    
    return world;
  };
}

/**
 * Determine and update swimming state based on speed and behavior
 */
function updateSwimState(eid: number, speed: number, deltaTime: number): void {
  // Speed-based state thresholds
  const idleThreshold = 0.1;
  const cruiseThreshold = 0.5;
  const sprintThreshold = 2.0;
  
  if (speed < idleThreshold) {
    BiomechanicalAnimationState.swimState[eid] = SwimState.IDLE;
  } else if (speed < cruiseThreshold) {
    BiomechanicalAnimationState.swimState[eid] = SwimState.CRUISE;
  } else if (speed < sprintThreshold) {
    BiomechanicalAnimationState.swimState[eid] = SwimState.CRUISE;
  } else {
    BiomechanicalAnimationState.swimState[eid] = SwimState.SPRINT;
  }
  
  // Burst-and-glide logic for cruise state
  if (BiomechanicalAnimationState.swimState[eid] === SwimState.CRUISE) {
    updateBurstGlidePattern(eid, speed, deltaTime);
  }
}

/**
 * Implement burst-and-glide swimming pattern (most efficient for cruising)
 */
function updateBurstGlidePattern(eid: number, speed: number, deltaTime: number): void {
  BiomechanicalAnimationState.burstGlideTimer[eid] += deltaTime;
  
  const state = BiomechanicalAnimationState.burstGlideState[eid];
  
  if (state === 0) { // Burst phase
    // Active tail beating
    BiomechanicalAnimationState.bodyWaveFrequency[eid] = 3.0 + speed * 2.0;
    BiomechanicalAnimationState.bodyWaveAmplitude[eid] = 0.15 + speed * 0.1;
    
    // Check if burst duration complete
    if (BiomechanicalAnimationState.burstGlideTimer[eid] > BiomechanicalAnimationState.burstDuration[eid]) {
      BiomechanicalAnimationState.burstGlideState[eid] = 1; // Switch to glide
      BiomechanicalAnimationState.burstGlideTimer[eid] = 0;
    }
  } else { // Glide phase
    // Reduced tail beating, extended fins
    BiomechanicalAnimationState.bodyWaveFrequency[eid] *= 0.95; // Decay
    BiomechanicalAnimationState.bodyWaveAmplitude[eid] *= 0.98;
    
    // Extend pectoral fins for stability
    BiomechanicalAnimationState.pectoralLeft[eid] = Math.PI * 0.15;
    BiomechanicalAnimationState.pectoralRight[eid] = Math.PI * 0.15;
    
    // Check if glide duration complete or speed dropped
    if (BiomechanicalAnimationState.burstGlideTimer[eid] > BiomechanicalAnimationState.glideDuration[eid] ||
        speed < 0.3) {
      BiomechanicalAnimationState.burstGlideState[eid] = 0; // Switch to burst
      BiomechanicalAnimationState.burstGlideTimer[eid] = 0;
      
      // Randomize next durations for natural variation
      BiomechanicalAnimationState.burstDuration[eid] = 0.4 + Math.random() * 0.6; // 0.4-1.0 sec
      BiomechanicalAnimationState.glideDuration[eid] = 1.0 + Math.random() * 2.0; // 1.0-3.0 sec
    }
  }
}

/**
 * Animate body-caudal swimmers (most fish, sharks)
 * Uses traveling body wave and tail oscillation
 */
function animateBodyCaudal(eid: number, speed: number, deltaTime: number): void {
  // Update body wave phase
  const frequency = BiomechanicalAnimationState.bodyWaveFrequency[eid] || (2.5 + speed * 2.5);
  BiomechanicalAnimationState.bodyWavePhase[eid] += frequency * deltaTime * Math.PI * 2;
  
  if (BiomechanicalAnimationState.bodyWavePhase[eid] > Math.PI * 2) {
    BiomechanicalAnimationState.bodyWavePhase[eid] -= Math.PI * 2;
  }
  
  // Body wave amplitude increases with speed
  const baseAmplitude = 0.08;
  const speedAmplitude = speed * 0.15;
  BiomechanicalAnimationState.bodyWaveAmplitude[eid] = baseAmplitude + speedAmplitude;
  
  // Tail beat (maximum amplitude at tail)
  const phase = BiomechanicalAnimationState.bodyWavePhase[eid];
  const amplitude = BiomechanicalAnimationState.bodyWaveAmplitude[eid];
  BiomechanicalAnimationState.tailBendAngle[eid] = Math.sin(phase) * amplitude * 1.5;
  
  // Pectoral fins
  if (speed < 0.5) {
    // Slow speed: active pectoral rowing
    BiomechanicalAnimationState.pectoralLeft[eid] = Math.sin(phase * 2) * 0.3;
    BiomechanicalAnimationState.pectoralRight[eid] = Math.sin(phase * 2) * 0.3;
  } else {
    // High speed: pectorals extended for steering
    BiomechanicalAnimationState.pectoralLeft[eid] = Math.PI * 0.1 + Math.sin(phase * 4) * 0.05;
    BiomechanicalAnimationState.pectoralRight[eid] = Math.PI * 0.1 + Math.sin(phase * 4) * 0.05;
  }
  
  // Dorsal and anal fins: stability
  BiomechanicalAnimationState.dorsalExtension[eid] = 0.8 + Math.sin(phase * 3) * 0.2;
  BiomechanicalAnimationState.analExtension[eid] = 0.7 + Math.sin(phase * 3) * 0.2;
  
  // Pelvic fins: subtle adjustments
  BiomechanicalAnimationState.pelvicAngle[eid] = Math.sin(phase * 1.5) * 0.15;
}

/**
 * Animate pectoral swimmers (rays, skates)
 * Uses wing-like flapping motion
 */
function animatePectoral(eid: number, speed: number, deltaTime: number): void {
  const frequency = 1.5 + speed * 1.5; // Slower, more graceful
  BiomechanicalAnimationState.bodyWavePhase[eid] += frequency * deltaTime * Math.PI * 2;
  
  if (BiomechanicalAnimationState.bodyWavePhase[eid] > Math.PI * 2) {
    BiomechanicalAnimationState.bodyWavePhase[eid] -= Math.PI * 2;
  }
  
  const phase = BiomechanicalAnimationState.bodyWavePhase[eid];
  const amplitude = 0.4 + speed * 0.3;
  
  // Wing flapping (pectoral fins are primary propulsion)
  const flapAngle = Math.sin(phase) * amplitude;
  BiomechanicalAnimationState.pectoralLeft[eid] = flapAngle;
  BiomechanicalAnimationState.pectoralRight[eid] = flapAngle;
  
  // Wave travels along wing edge
  BiomechanicalAnimationState.bodyWaveAmplitude[eid] = amplitude * 0.6;
  
  // Minimal tail movement
  BiomechanicalAnimationState.tailBendAngle[eid] = Math.sin(phase * 0.5) * 0.1;
}

/**
 * Animate jet propulsion swimmers (jellyfish, squid)
 * Uses pulsing bell contraction
 */
function animateJetPropulsion(eid: number, speed: number, deltaTime: number): void {
  const frequency = 1.0 + speed * 0.8;
  BiomechanicalAnimationState.bodyWavePhase[eid] += frequency * deltaTime * Math.PI * 2;
  
  if (BiomechanicalAnimationState.bodyWavePhase[eid] > Math.PI * 2) {
    BiomechanicalAnimationState.bodyWavePhase[eid] -= Math.PI * 2;
  }
  
  const phase = BiomechanicalAnimationState.bodyWavePhase[eid];
  
  // Bell pulsing (sharp contraction, slow expansion)
  const pulse = phase < Math.PI ? Math.sin(phase) : Math.sin(phase) * 0.3;
  BiomechanicalAnimationState.bodyWaveAmplitude[eid] = Math.abs(pulse) * (0.3 + speed * 0.2);
  
  // Tentacles trail
  BiomechanicalAnimationState.tailBendAngle[eid] = Math.sin(phase + Math.PI) * 0.3;
}

/**
 * Animate fluke swimmers (dolphins, whales)
 * Vertical tail beats (up-down instead of side-to-side)
 */
function animateFlukes(eid: number, speed: number, deltaTime: number): void {
  const frequency = 2.0 + speed * 2.0;
  BiomechanicalAnimationState.bodyWavePhase[eid] += frequency * deltaTime * Math.PI * 2;
  
  if (BiomechanicalAnimationState.bodyWavePhase[eid] > Math.PI * 2) {
    BiomechanicalAnimationState.bodyWavePhase[eid] -= Math.PI * 2;
  }
  
  const phase = BiomechanicalAnimationState.bodyWavePhase[eid];
  const amplitude = 0.12 + speed * 0.2;
  
  // Vertical tail movement (stored in tailBendAngle but applied vertically)
  BiomechanicalAnimationState.tailBendAngle[eid] = Math.sin(phase) * amplitude;
  
  // Body undulation in vertical plane
  BiomechanicalAnimationState.bodyWaveAmplitude[eid] = amplitude * 0.7;
  
  // Pectoral fins for steering
  BiomechanicalAnimationState.pectoralLeft[eid] = Math.sin(phase * 1.5) * 0.2;
  BiomechanicalAnimationState.pectoralRight[eid] = Math.sin(phase * 1.5) * 0.2;
}

/**
 * Update secondary motion (gills, subtle body movements)
 */
function updateSecondaryMotion(eid: number, speed: number, _deltaTime: number): void {
  // Gill flapping (respiratory rate increases with exertion)
  const gillFrequency = 1.5 + speed * 0.8; // Hz
  const gillPhase = (Date.now() / 1000) * gillFrequency * Math.PI * 2;
  BiomechanicalAnimationState.gillFlap[eid] = Math.sin(gillPhase) * 0.08;
  
  // Subtle body sway (idle behavior)
  if (speed < 0.2) {
    const swayPhase = (Date.now() / 1000) * 0.5 * Math.PI * 2;
    BiomechanicalAnimationState.bodyRoll[eid] = Math.sin(swayPhase) * 0.05;
    BiomechanicalAnimationState.bodyPitch[eid] = Math.sin(swayPhase * 0.7) * 0.03;
  } else {
    // Decay body sway when moving
    BiomechanicalAnimationState.bodyRoll[eid] *= 0.95;
    BiomechanicalAnimationState.bodyPitch[eid] *= 0.95;
  }
}

/**
 * Update creature orientation with realistic banking during turns
 */
function updateOrientationWithBanking(eid: number, speed: number, deltaTime: number): void {
  if (speed < 0.05) return; // Don't update orientation when stationary

  const direction = _tempDirection.set(
    Velocity.x[eid],
    Velocity.y[eid],
    Velocity.z[eid]
  ).normalize();
  
  // Calculate yaw (horizontal rotation)
  const targetYaw = Math.atan2(direction.x, direction.z);
  
  // Calculate pitch (vertical rotation)
  const horizontalSpeed = Math.sqrt(direction.x ** 2 + direction.z ** 2);
  const targetPitch = -Math.atan2(direction.y, horizontalSpeed);
  
  // Smooth rotation interpolation
  const rotationSpeed = 3.0; // radians per second
  const maxDelta = rotationSpeed * deltaTime;
  
  // Yaw interpolation
  let yawDelta = targetYaw - Rotation.y[eid];
  // Handle angle wrapping
  if (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
  if (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
  yawDelta = Math.max(-maxDelta, Math.min(maxDelta, yawDelta));
  // NaN guard for yawDelta
  if (isNaN(yawDelta)) yawDelta = 0;
  Rotation.y[eid] += yawDelta;

  // Pitch interpolation
  let pitchDelta = targetPitch - Rotation.x[eid];
  pitchDelta = Math.max(-maxDelta, Math.min(maxDelta, pitchDelta));
  // NaN guard for pitchDelta
  if (isNaN(pitchDelta)) pitchDelta = 0;
  Rotation.x[eid] += pitchDelta;
  
  // Banking: roll into turns
  const turnRate = yawDelta / deltaTime; // radians per second
  const maxBankAngle = Math.PI * 0.25; // 45 degrees max
  const bankAngle = Math.max(-maxBankAngle, Math.min(maxBankAngle, turnRate * 0.5));
  
  // Smooth bank interpolation
  BiomechanicalAnimationState.bodyRoll[eid] += (bankAngle - BiomechanicalAnimationState.bodyRoll[eid]) * 0.1;
  Rotation.z[eid] = BiomechanicalAnimationState.bodyRoll[eid];
  
  // Add tail bend bias during turns (asymmetric tail beat)
  if (Math.abs(turnRate) > 0.5) {
    const tailBias = Math.sign(turnRate) * Math.min(Math.abs(turnRate), 1.0) * 0.3;
    BiomechanicalAnimationState.tailBendAngle[eid] += tailBias;
  }
}

/**
 * Apply biomechanical animation state to Three.js meshes
 * This modifies vertex positions for realistic deformation
 */
export function applyBiomechanicalAnimationToMesh(
  mesh: THREE.Mesh | THREE.Group,
  eid: number,
  creatureType: number
): void {
  // For simple meshes, apply vertex deformation
  if (mesh instanceof THREE.Mesh && mesh.geometry instanceof THREE.BufferGeometry) {
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    
    if (!positions) return;
    
    // Store original positions
    if (!geometry.userData.originalPositions) {
      geometry.userData.originalPositions = positions.array.slice();
    }
    
    const original = geometry.userData.originalPositions;
    const current = positions.array;
    
    const bodyWavePhase = BiomechanicalAnimationState.bodyWavePhase[eid];
    const bodyWaveAmp = BiomechanicalAnimationState.bodyWaveAmplitude[eid];
    // tailBend not used in vertex deformation, only in named part rotation
    
    // Apply deformation based on creature type
    // FIXED: Added proper bounds checking to prevent vine artifacts
    const maxDisplacement = 0.3; // Safety clamp

    for (let i = 0; i < positions.count; i++) {
      const idx = i * 3;
      const x = original[idx];
      const y = original[idx + 1];
      const z = original[idx + 2];

      // Position along body (0 at head, 1 at tail)
      const bodyLength = 2.0; // Approximate
      // FIXED: Clamp positionAlongBody to valid range [0, 1]
      const positionAlongBody = Math.max(0, Math.min(1, (x + bodyLength * 0.5) / bodyLength));

      // Amplitude envelope: increases from head to tail
      // FIXED: Clamp to prevent extreme values
      const amplitudeEnvelope = Math.min(1.0, Math.pow(positionAlongBody, 1.5));

      // FIXED: Clamp bodyWaveAmp to reasonable range
      const clampedAmp = Math.min(0.5, Math.max(0, bodyWaveAmp));

      switch (creatureType) {
        case 0: // Fish
        case 1: // Shark
          // Traveling wave: phase propagates from head to tail
          const wavelength = 0.7;
          // FIXED: Wrap phase to prevent numerical issues
          const wrappedPhase = bodyWavePhase % (Math.PI * 2);
          const localPhase = wrappedPhase - (positionAlongBody / wavelength) * Math.PI * 2;
          let lateralDisplacement = Math.sin(localPhase) * clampedAmp * amplitudeEnvelope;

          // Apply lateral (Z) displacement, less at edges (top/bottom of body)
          // FIXED: Clamp edgeFactor to [0, 1] to prevent negative values
          const edgeFactor = Math.max(0, Math.min(1, 1.0 - Math.abs(y) * 2.0));
          lateralDisplacement = Math.max(-maxDisplacement, Math.min(maxDisplacement, lateralDisplacement * edgeFactor));

          current[idx + 2] = z + lateralDisplacement;
          current[idx] = x;
          current[idx + 1] = y;
          break;

        case 2: // Dolphin
          // Vertical undulation (fluke motion)
          const verticalPhase = (bodyWavePhase % (Math.PI * 2)) - (positionAlongBody / 0.6) * Math.PI * 2;
          let verticalDisplacement = Math.sin(verticalPhase) * clampedAmp * amplitudeEnvelope;
          // FIXED: Clamp displacement
          verticalDisplacement = Math.max(-maxDisplacement, Math.min(maxDisplacement, verticalDisplacement));

          current[idx] = x;
          current[idx + 1] = y + verticalDisplacement;
          current[idx + 2] = z;
          break;

        case 3: // Jellyfish
          // Radial pulsing
          // FIXED: Clamp pulseFactor to reasonable range
          const pulseFactor = Math.max(0.5, Math.min(1.5, 1.0 - clampedAmp * amplitudeEnvelope * 0.5));
          current[idx] = x;
          current[idx + 1] = y * pulseFactor;
          current[idx + 2] = z * pulseFactor;
          break;

        case 4: // Ray
          // Wing undulation
          const wingPhase = (bodyWavePhase % (Math.PI * 2)) + z * 2.0;
          let wingDisplacement = Math.sin(wingPhase) * clampedAmp * 0.5;
          // FIXED: Clamp displacement
          wingDisplacement = Math.max(-maxDisplacement, Math.min(maxDisplacement, wingDisplacement));

          current[idx] = x;
          current[idx + 1] = y + wingDisplacement;
          current[idx + 2] = z;
          break;

        default:
          current[idx] = x;
          current[idx + 1] = y;
          current[idx + 2] = z;
      }
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  
  // For Groups (complex creatures), animate child meshes by name
  else if (mesh instanceof THREE.Group) {
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name) {
        const pectoralL = BiomechanicalAnimationState.pectoralLeft[eid];
        const pectoralR = BiomechanicalAnimationState.pectoralRight[eid];
        const dorsal = BiomechanicalAnimationState.dorsalExtension[eid];
        
        // Animate specific named parts
        if (child.name.includes('caudal') || child.name.includes('tail')) {
          const tailBend = BiomechanicalAnimationState.tailBendAngle[eid];
          child.rotation.y = tailBend * 0.5;
        }
        if (child.name.includes('pectoral_left')) {
          child.rotation.x = pectoralL;
        }
        if (child.name.includes('pectoral_right')) {
          child.rotation.x = pectoralR;
        }
        if (child.name.includes('dorsal')) {
          child.scale.y = dorsal;
        }
      }
    });
  }
}

/**
 * Initialize burst-glide parameters for an entity
 */
export function initializeBurstGlideParams(eid: number): void {
  BiomechanicalAnimationState.burstGlideState[eid] = 0; // Start with burst
  BiomechanicalAnimationState.burstGlideTimer[eid] = 0;
  BiomechanicalAnimationState.burstDuration[eid] = 0.5 + Math.random() * 0.5;
  BiomechanicalAnimationState.glideDuration[eid] = 1.5 + Math.random() * 1.5;
  BiomechanicalAnimationState.bodyWaveFrequency[eid] = 3.0;
  BiomechanicalAnimationState.bodyWaveAmplitude[eid] = 0.15;
}

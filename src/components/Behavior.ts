/**
 * Behavior components - FIRA, Vision, Memory, Predator, Prey, etc.
 */

/**
 * FIRA (Fish-Inspired Robotic Algorithm) Component
 * Based on inverse-square repulsion, not linear Boids!
 */
export const FIRA = {
  separationWeight: [] as number[],
  alignmentWeight: [] as number[],
  cohesionWeight: [] as number[],
  wanderWeight: [] as number[],
  perceptionRadius: [] as number[],
  separationRadius: [] as number[],
  maxSpeed: [] as number[],
  maxForce: [] as number[],
  minSpeed: [] as number[],
};

export const Wander = {
  angle: [] as number[],
  verticalAngle: [] as number[],
  distance: [] as number[],
  radius: [] as number[],
  rate: [] as number[],
};

/**
 * School leader component - Designates leader fish and tracks school membership
 * Leaders have higher wander and lower cohesion; followers get extra cohesion toward leader.
 */
export const SchoolLeader = {
  schoolId: [] as number[],     // Which school this entity belongs to (0 = no school)
  isLeader: [] as number[],     // 1 = leader, 0 = follower
  leaderId: [] as number[],     // Entity ID of the school's leader (for followers)
};

/**
 * Vision component - Field of view and blind spots
 */
export const Vision = {
  range: [] as number[],
  fovAngle: [] as number[],       // In radians
  blindSpotAngle: [] as number[], // In radians
  clarity: [] as number[],        // 0.0 to 1.0 (water turbidity factor)
};

/**
 * Memory component - For storing past locations/events
 */
export const Memory = {
  foodLocationX: [] as number[],
  foodLocationY: [] as number[],
  foodLocationZ: [] as number[],
  foodMemoryAge: [] as number[],      // How old is the memory
  predatorMemoryAge: [] as number[],
  timeSinceUpdate: [] as number[],
};

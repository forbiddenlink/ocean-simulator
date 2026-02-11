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

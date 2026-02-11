/**
 * Rendering components - Mesh, Color, Animation, DepthZone
 */

/**
 * Mesh component - Links ECS entity to Three.js mesh
 */
export const Mesh = {
  meshId: [] as number[],           // Index in batched mesh or unique ID
  visible: [] as number[],          // 0=hidden, 1=visible
  castShadow: [] as number[],       // 0=no shadow, 1=cast shadow
  receiveShadow: [] as number[],    // 0=no receive, 1=receive shadow
};

/**
 * Color component - Entity visual color
 */
export const Color = {
  r: [] as number[],                // Red channel 0-1
  g: [] as number[],                // Green channel 0-1
  b: [] as number[],                // Blue channel 0-1
  a: [] as number[],                // Alpha channel 0-1
};

/**
 * Animation component - Swimming animation state
 */
export const Animation = {
  phase: [] as number[],            // Current phase in animation cycle (0-2π)
  frequency: [] as number[],        // Oscillation frequency (related to swimming speed)
  amplitude: [] as number[],        // Tail swing amplitude
  waveSpeed: [] as number[],        // Speed of wave propagation along body
};

/**
 * DepthZone component - Which ocean zone the entity is in
 * Used for rendering and behavior adjustments
 */
export const DepthZone = {
  zone: [] as number[],             // 0=epipelagic, 1=mesopelagic, 2=bathypelagic, 3=abyssopelagic, 4=hadopelagic
  depthMeters: [] as number[],      // Actual depth in meters
  pressure: [] as number[],         // Water pressure at this depth (atmospheres)
  lightLevel: [] as number[],       // Available light (0-1, exponentially decreases)
};

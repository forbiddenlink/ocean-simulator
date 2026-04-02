/**
 * Fluid Simulation Library
 *
 * A comprehensive WebGL-based fluid simulation library for realistic ocean rendering.
 *
 * Modules:
 * - ocean: FFT-based ocean surface simulation with multiple spectrum types
 * - waves: Gerstner wave system with physics-based interactions
 * - foam: Foam and spray particle systems
 * - underwater: Caustics, light absorption, and underwater effects
 */

// Ocean surface simulation
export {
  OceanSurface,
  DEFAULT_OCEAN_CONFIG,
  type OceanConfig,
  type OceanSpectrumType,
  type GerstnerWaveParams,
  type OceanSurfaceState,
} from './ocean';

// Wave physics
export {
  GerstnerWaveSystem,
  WaveInteraction,
  WaveStatistics,
  DEFAULT_WAVE_CONFIG,
  type WaveComponent,
  type WaveFieldState,
  type WaveFieldConfig,
} from './waves';

// Foam and spray effects
export {
  FoamCoverageMap,
  SpraySystem,
  generateFoamShaderCode,
  DEFAULT_FOAM_CONFIG,
  type FoamParticle,
  type FoamConfig,
} from './foam';

// Underwater effects
export {
  CausticsGenerator,
  UnderwaterLighting,
  generateUnderwaterShaderCode,
  ABSORPTION_COEFFICIENTS,
  SCATTERING_COEFFICIENTS,
  DEFAULT_UNDERWATER_CONFIG,
  type WaterType,
  type UnderwaterConfig,
} from './underwater';

/**
 * Biology components - Health, Energy, Size, Species, etc.
 */

/**
 * Health component - Entity vitality
 */
export const Health = {
  current: [] as number[],
  max: [] as number[],
};

/**
 * Energy component - Metabolic energy budget
 * Based on Kleiber's law: metabolism ∝ mass^0.75
 */
export const Energy = {
  current: [] as number[],
  max: [] as number[],
  metabolismRate: [] as number[], // Energy consumption per second
  recoveryRate: [] as number[],   // Energy gained from rest
};

/**
 * Hunger component - Food seeking drive
 */
export const Hunger = {
  level: [] as number[],          // 0-1 (0 = full, 1 = starving)
  dietType: [] as number[],       // 0=herbivore, 1=carnivore, 2=omnivore
  lastMealTime: [] as number[],   // Timestamp of last feeding
};

/**
 * Age component - Lifecycle tracking
 */
export const Age = {
  current: [] as number[],        // Current age in seconds
  lifespan: [] as number[],       // Maximum lifespan
  maturityAge: [] as number[],    // Age at which reproduction is possible
};

/**
 * Size component - Physical dimensions
 */
export const Size = {
  length: [] as number[],         // Body length
  width: [] as number[],          // Body width
  height: [] as number[],         // Body height
  mass: [] as number[],           // Mass in kg
};

/**
 * CreatureType component - Determines creature classification
 * Types: 0=fish, 1=shark, 2=dolphin, 3=jellyfish, 4=ray, 5=whale, 6=turtle, 7=octopus
 */
export const CreatureType = {
  type: [] as number[],           // Creature type ID
  variant: [] as number[],        // Species variant within type
  isPredator: [] as number[],     // 1 if predator, 0 if not
  isAggressive: [] as number[],   // 1 if aggressive, 0 if not
};

/**
 * SwimmingStyle component - How the creature moves through water
 * Styles: 0=body-caudal (fish), 1=pectoral (rays), 2=jet (jellyfish), 3=flukes (cetaceans)
 */
export const SwimmingStyle = {
  style: [] as number[],          // Swimming style ID
  frequency: [] as number[],      // Undulation/flap frequency
  amplitude: [] as number[],      // Movement amplitude
  efficiency: [] as number[],     // Energy efficiency (0-1)
};

/**
 * Species component - Type classification
 */
export const Species = {
  id: [] as number[],            // Unique species identifier
  generation: [] as number[],    // Generation number for evolution tracking
  depthPreference: [] as number[], // Preferred depth zone
};

/**
 * Bioluminescence component - Light emission capability
 */
export const Bioluminescence = {
  enabled: [] as number[],        // 0=off, 1=on
  intensity: [] as number[],      // Light intensity (0-1)
  color: [] as number[],         // RGB color packed
  type: [] as number[],           // 0=counter-illumination, 1=lure, 2=alarm, 3=communication
};

import { query, removeEntity } from 'bitecs';
import { Position, Velocity } from '../components/Transform';
import { Health, Energy, CreatureType } from '../components/Biology';
import type { OceanWorld } from '../core/World';

// Population limits per species type
const POPULATION_LIMITS = {
  fish: 100,
  shark: 8,
  dolphin: 12,
  jellyfish: 30,
  ray: 15,
  turtle: 6,
  crab: 20,
  starfish: 15,
  urchin: 15,
  whale: 3
};

// Spawning configuration
const SPAWN_CONFIG = {
  ENERGY_THRESHOLD_FOR_SPAWN: 150, // Need this much energy to spawn offspring
  ENERGY_COST_OF_SPAWN: 80,
  SPAWN_COOLDOWN: 30.0, // seconds between spawns
  DEATH_ENERGY_THRESHOLD: 0,
  STARVATION_DAMAGE_PER_SECOND: 0.5, // Reduced from 2.0 - slower starvation
  HEALTH_REGEN_PER_SECOND: 1.0, // Increased from 0.5 - faster healing
  WELL_FED_ENERGY_THRESHOLD: 50 // Reduced from 100 - easier to be "well fed"
};

// Track spawn cooldowns
const spawnCooldowns = new Map<number, number>();

/**
 * System that manages population dynamics - birth, death, energy-based survival
 */
export function createPopulationSystem(_world: OceanWorld, entityFactory: any) {
  return (world: OceanWorld) => {
    const deltaTime = world.time.delta; // Already in seconds from updateWorldTime
    const entities = query(world, [Position, Velocity, Health, Energy, CreatureType]);
    
    // Count populations by type
    const populations = {
      fish: 0,
      shark: 0,
      dolphin: 0,
      jellyfish: 0,
      ray: 0,
      turtle: 0,
      crab: 0,
      starfish: 0,
      urchin: 0,
      whale: 0
    };
    
    const deadEntities: number[] = [];
    const spawnRequests: Array<{ type: number; variant: number; position: [number, number, number] }> = [];
    
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      const creatureType = CreatureType.type[eid];
      
      // Count populations
      const typeNames = ['fish', 'shark', 'dolphin', 'jellyfish', 'ray', 'turtle', 'crab', 'starfish', 'urchin', 'whale'];
      const typeName = typeNames[creatureType] as keyof typeof populations;
      if (typeName) populations[typeName]++;
      
      // Energy-based health effects
      const currentEnergy = Energy.current[eid];
      const currentHealth = Health.current[eid];
      
      // Starvation damage when energy is too low
      if (currentEnergy < 20) {
        Health.current[eid] -= SPAWN_CONFIG.STARVATION_DAMAGE_PER_SECOND * deltaTime;
      }
      // Health regeneration when well-fed
      else if (currentEnergy > SPAWN_CONFIG.WELL_FED_ENERGY_THRESHOLD) {
        Health.current[eid] = Math.min(
          Health.max[eid],
          currentHealth + SPAWN_CONFIG.HEALTH_REGEN_PER_SECOND * deltaTime
        );
      }
      
      // Natural energy drain using per-creature metabolism rate
      // Bottom dwellers (crab=6, starfish=7, urchin=8) use their own very low rates
      const metabolismRate = Energy.metabolismRate[eid] || 0.05;
      Energy.current[eid] -= metabolismRate * deltaTime;

      // Passive energy recovery for non-predators (simulates filter feeding, grazing, scavenging)
      // This prevents the entire prey population from collapsing
      if (CreatureType.isPredator[eid] === 0) {
        const recoveryRate = Energy.recoveryRate[eid] || 0.03;
        Energy.current[eid] += recoveryRate * deltaTime;
      }

      Energy.current[eid] = Math.max(0, Math.min(Energy.max[eid], Energy.current[eid]));
      
      // Death check
      if (currentHealth <= 0 || currentEnergy <= SPAWN_CONFIG.DEATH_ENERGY_THRESHOLD) {
        deadEntities.push(eid);
        continue;
      }
      
      // Reproduction check
      const cooldown = spawnCooldowns.get(eid) || 0;
      if (cooldown > 0) {
        spawnCooldowns.set(eid, cooldown - deltaTime);
      }
      
      // Can spawn if:
      // - Enough energy
      // - Cooldown expired
      // - Population below limit
      if (
        currentEnergy > SPAWN_CONFIG.ENERGY_THRESHOLD_FOR_SPAWN &&
        cooldown <= 0 &&
        populations[typeName] < POPULATION_LIMITS[typeName]
      ) {
        // Spawn offspring nearby
        const spawnOffset = 3.0;
        const angle = Math.random() * Math.PI * 2;
        
        spawnRequests.push({
          type: creatureType,
          variant: CreatureType.variant[eid],
          position: [
            Position.x[eid] + Math.cos(angle) * spawnOffset,
            Position.y[eid] + (Math.random() - 0.5) * 2,
            Position.z[eid] + Math.sin(angle) * spawnOffset
          ]
        });
        
        // Cost energy and set cooldown
        Energy.current[eid] -= SPAWN_CONFIG.ENERGY_COST_OF_SPAWN;
        spawnCooldowns.set(eid, SPAWN_CONFIG.SPAWN_COOLDOWN);
      }
    }
    
    // Remove dead entities
    for (const eid of deadEntities) {
      spawnCooldowns.delete(eid);
      removeEntity(world, eid);
    }
    
    // Spawn new entities
    for (const spawn of spawnRequests) {
      try {
        let newEntity;
        const [x, y, z] = spawn.position;
        
        switch (spawn.type) {
          case 0: // fish
            newEntity = entityFactory.createFish(world, x, y, z);
            break;
          case 1: // shark
            const sharkSpecies = ['great-white', 'hammerhead', 'tiger', 'reef'][spawn.variant];
            newEntity = entityFactory.createShark(world, x, y, z, sharkSpecies);
            break;
          case 2: // dolphin
            const dolphinSpecies = ['bottlenose', 'spinner', 'orca'][spawn.variant];
            newEntity = entityFactory.createDolphin(world, x, y, z, dolphinSpecies);
            break;
          case 3: // jellyfish
            const jellyfishSpecies = ['moon', 'box', 'lion', 'crystal'][spawn.variant];
            newEntity = entityFactory.createJellyfish(world, x, y, z, jellyfishSpecies);
            break;
          case 4: // ray
            const raySpecies = ['manta', 'eagle', 'stingray', 'electric'][spawn.variant];
            newEntity = entityFactory.createRay(world, x, y, z, raySpecies);
            break;
          case 5: // turtle
            const turtleSpecies = ['green', 'hawksbill', 'loggerhead'][spawn.variant];
            newEntity = entityFactory.createTurtle(world, x, y, z, turtleSpecies);
            break;
          case 6: // crab
            newEntity = entityFactory.createCrab(world, x, y, z);
            break;
          case 7: // starfish
            newEntity = entityFactory.createStarfish(world, x, y, z);
            break;
          case 8: // sea urchin
            newEntity = entityFactory.createSeaUrchin(world, x, y, z);
            break;
          case 9: // whale
            const whaleSpecies = ['humpback', 'blue'][spawn.variant];
            newEntity = entityFactory.createWhale(world, x, y, z, whaleSpecies);
            break;
        }
        
        if (newEntity) {
          // Offspring start with reduced stats
          Health.current[newEntity] = Health.max[newEntity] * 0.5;
          Energy.current[newEntity] = Energy.max[newEntity] * 0.5;
        }
      } catch (error) {
        console.warn('Failed to spawn offspring:', error);
      }
    }
    
    return world;
  };
}

/**
 * Get current population statistics
 */
export function getPopulationStats(world: OceanWorld) {
  const entities = query(world, [CreatureType]);
  
  const stats = {
    total: entities.length,
    fish: 0,
    shark: 0,
    dolphin: 0,
    jellyfish: 0,
    ray: 0,
    turtle: 0,
    crab: 0,
    starfish: 0,
    urchin: 0,
    whale: 0,
    predators: 0,
    prey: 0
  };
  
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const type = CreatureType.type[eid];
    
    const typeNames = ['fish', 'shark', 'dolphin', 'jellyfish', 'ray', 'turtle', 'crab', 'starfish', 'urchin', 'whale'];
    const typeName = typeNames[type] as keyof typeof stats;
    if (typeName && typeof stats[typeName] === 'number') {
      (stats[typeName] as number)++;
    }
    
    if (CreatureType.isPredator[eid] === 1) {
      stats.predators++;
    } else {
      stats.prey++;
    }
  }
  
  return stats;
}

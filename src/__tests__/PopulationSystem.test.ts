import { describe, it, expect } from 'vitest';
import { query } from 'bitecs';
import { createOceanWorld } from '../core/World';
import * as EntityFactory from '../core/EntityFactory';
import { CreatureType, Health, Energy } from '../components/Biology';
import { createPopulationSystem } from '../systems/PopulationSystem';

function countSpecies(world: ReturnType<typeof createOceanWorld>, type: number): number {
  return Array.from(query(world, [CreatureType])).filter(eid => CreatureType.type[eid] === type).length;
}

describe('PopulationSystem', () => {
  it('keeps cooldowns across ticks without sharing them with another system', () => {
    const world = createOceanWorld();
    const parent = EntityFactory.createWhale(world, 0, -10, 0);
    const firstSystem = createPopulationSystem(world, EntityFactory);
    firstSystem(world);
    expect(countSpecies(world, 9)).toBe(2);

    // Prevent offspring reproducing so this checks the original parent's cooldown.
    for (const eid of query(world, [CreatureType])) {
      if (eid !== parent) Energy.current[eid] = 100;
    }
    firstSystem(world);
    expect(countSpecies(world, 9)).toBe(2);

    const secondSystem = createPopulationSystem(world, EntityFactory);
    secondSystem(world);
    expect(countSpecies(world, 9)).toBe(3);
  });

  it('reserves remaining slots when multiple parents can reproduce', () => {
    const world = createOceanWorld();
    for (let i = 0; i < 3; i++) EntityFactory.createWhale(world, i, -10, 0);

    createPopulationSystem(world, EntityFactory)(world);

    expect(countSpecies(world, 9)).toBe(5);
  });

  it('does not reproduce when the full population is already at its cap', () => {
    const world = createOceanWorld();
    for (let i = 0; i < 5; i++) EntityFactory.createWhale(world, i, -10, 0);

    createPopulationSystem(world, EntityFactory)(world);

    expect(countSpecies(world, 9)).toBe(5);
  });

  it('reserves births independently for each species', () => {
    const world = createOceanWorld();
    for (let i = 0; i < 4; i++) EntityFactory.createWhale(world, i, -10, 0);
    for (let i = 0; i < 17; i++) EntityFactory.createShark(world, i, -10, 0);

    createPopulationSystem(world, EntityFactory)(world);

    expect(countSpecies(world, 9)).toBe(5);
    expect(countSpecies(world, 1)).toBe(18);
  });

  it('allows a replacement for a creature removed in the same tick', () => {
    const world = createOceanWorld();
    for (let i = 0; i < 4; i++) EntityFactory.createWhale(world, i, -10, 0);
    const dead = EntityFactory.createWhale(world, 0, -10, 0);
    Health.current[dead] = 0;

    createPopulationSystem(world, EntityFactory)(world);

    expect(countSpecies(world, 9)).toBe(5);
    expect(Array.from(query(world, [CreatureType])).every(eid => Health.current[eid] > 0)).toBe(true);
  });
});

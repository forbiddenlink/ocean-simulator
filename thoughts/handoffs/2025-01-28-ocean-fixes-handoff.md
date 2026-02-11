# Ocean Simulator Handoff

**Date:** 2025-01-28
**Status:** In Progress - Multiple issues remaining

## What Was Done

### Completed Phases
1. **Phase 1: Visibility** - Camera moved back, debug logging added
2. **Phase 2: Fish Movement** - Speeds reduced (2-4 m/s → 0.3-0.8 m/s), minSpeed lowered
3. **Phase 3: Ocean Floor** - Darkened ambient (0.6→0.15), Beer-Lambert absorption added
4. **Phase 4: Fish Appearance** - Fixed shader issues, reverted to MeshStandardMaterial
5. **Phase 5: New Creatures** - Added turtles, whales, crabs, starfish, sea urchins
6. **Phase 6: Polish** - Caustics reduced, god rays disabled, particles enhanced

### New Files Created
- `src/creatures/TurtleGeometry.ts`
- `src/creatures/WhaleGeometry.ts`
- `src/creatures/BottomDwellers.ts`

### Key Changes Made
- `vite.config.ts` - Added vite-plugin-glsl for shader HMR
- `src/rendering/BatchedMeshPool.ts` - Using MeshStandardMaterial (white) for fish
- `src/rendering/Caustics.ts` - Reduced intensity from 3.5 to 0.8
- `src/rendering/RenderingEngine.ts` - God rays disabled
- `src/core/EntityFactory.ts` - Fish minSpeed = 0.15

## Current Issues (User Reports)

### 1. Fish Not Moving
- Some fish appear stationary
- Movement system may have issues
- Check `src/systems/FIRASystem.ts` and `src/systems/EnhancedMovementSystem.ts`

### 2. Some Creatures Look Like Vines
- Possible geometry issues with new creatures
- Could be kelp forest being mistaken for creatures
- Check creature geometries in `src/creatures/`

### 3. Inconsistent Movement
- Some fish start fast, some don't move
- Speed initialization may be inconsistent
- Check `src/core/EntityFactory.ts` initial velocities

### 4. Visual Issues
- Floor may still be too bright
- Fish colors may still be dark/wrong

## Files to Investigate

1. **Movement:**
   - `src/systems/FIRASystem.ts` - Main flocking behavior
   - `src/systems/EnhancedMovementSystem.ts` - Physics
   - `src/systems/BiomechanicalAnimationSystem.ts` - Animation

2. **Rendering:**
   - `src/rendering/BatchedMeshPool.ts` - Fish rendering
   - `src/rendering/RealisticOceanFloor.ts` - Floor shader

3. **Creatures:**
   - `src/creatures/TurtleGeometry.ts` - May have issues
   - `src/creatures/WhaleGeometry.ts` - May have issues
   - `src/creatures/BottomDwellers.ts` - May have issues

## To Debug

```bash
# Run dev server
npm run dev

# Check browser console for errors
# Look for shader compilation errors
# Check entity positions are updating
```

## Key Parameters to Tune

In `src/core/EntityFactory.ts`:
- Initial speed: `0.3 + Math.random() * 0.5` (line ~30)
- minSpeed: `0.15` (line 91)
- maxSpeed: `bodyLength * 3.0 + Math.random() * bodyLength` (line 89)

In `src/systems/FIRASystem.ts`:
- Separation/alignment/cohesion weights
- Boundary forces

## Next Steps

1. Debug why fish aren't moving - check if FIRA system is running
2. Identify which creatures look like "vines" - may need geometry fixes
3. Verify movement system is applying forces correctly
4. Consider reverting some changes if movement broke

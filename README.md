# Ocean Ecosystem Simulator

A photorealistic underwater ecosystem simulator built with Three.js and bitECS. Experience a living underwater world with 500+ marine creatures, realistic lighting, and emergent behaviors.

## Features

### Marine Life
- **500+ Creatures**: Fish schools, sharks, dolphins, jellyfish, rays, turtles, whales
- **Bottom Dwellers**: Crabs, starfish, sea urchins
- **Environment**: Kelp forests, coral formations, sea anemones

### Rendering
- **FFT Ocean Surface**: Realistic wave simulation with foam and spray
- **Underwater Lighting**: Beer-Lambert light absorption, caustics, god rays
- **Post-Processing**: Bloom, chromatic aberration, color grading, vignette
- **Instanced Rendering**: GPU-optimized for hundreds of fish

### Simulation
- **FIRA Steering**: Fish Intelligent Responsive Algorithm for realistic movement
- **Hunting System**: Predator-prey dynamics with sustainable population balance
- **Schooling Behavior**: Based on Reynolds' boids algorithm
- **Ocean Currents**: Dynamic water flow affecting creature movement

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

## Controls

| Action | Control |
|--------|---------|
| Move | WASD |
| Up/Down | Q/E |
| Look | Mouse |
| Toggle UI | H |
| Pause | Button in UI |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Rendering | Three.js |
| ECS | bitECS |
| Post-Processing | postprocessing |
| Build | Vite + TypeScript |

## Project Structure

```
src/
  components/     # ECS components (Transform, Biology, Behavior)
  core/           # World setup, entity factory
  creatures/      # Procedural geometry (fish, sharks, whales, etc.)
  rendering/      # Visual systems (ocean, lighting, particles)
  systems/        # ECS systems (movement, hunting, population)
  shaders/        # GLSL shaders
```

## License

MIT

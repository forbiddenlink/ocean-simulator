# 🌊 Ocean Ecosystem Simulator

A cutting-edge, scientifically-accurate ocean ecosystem simulator built with modern web technologies. Experience a living, breathing underwater world with complex food chains, realistic physics, stunning visuals, and emergent behaviors.

## 🎯 Vision

Create a world-class ocean simulation that rivals AAA game engines while running entirely in the browser. This isn't just a tech demo—it's a scientifically-grounded, visually stunning experience that showcases the full potential of modern web graphics APIs.

## ✨ Core Features

### 🐟 Dynamic Ecosystem Simulation
- **Complex Food Chains**: Plankton → Small Fish → Medium Fish → Apex Predators
- **Emergent Behaviors**: Hunting, fleeing, schooling, territorial behavior
- **Population Dynamics**: Birth, death, starvation, and predation-driven balance
- **Energy Systems**: Metabolic costs, hunger, and feeding mechanics

### 🌊 Depth Zone System
- **Sunlight Zone (0-200m)**: Abundant life, bright visuals, active predators
- **Twilight Zone (200-1000m)**: Dimmer light, bioluminescent creatures
- **Midnight Zone (1000m+)**: Near darkness, exotic deep-sea life
- **Wavelength-Dependent Light Absorption**: Scientifically accurate color loss with depth

### 🎨 Procedural Creatures
- **Dynamic Morphology**: Body segments, fins, tails generated procedurally
- **Species Variation**: Size, color, pattern, shape diversity
- **Behavioral Animation**: Swimming, turning, feeding, fleeing animations
- **Visual Distinction**: Easily identify predators, prey, and herbivores

### 🌅 Stunning Visuals
- **Physically-Based Ocean Rendering**: FFT waves, refraction, caustics
- **Advanced Bloom**: CoD: Advanced Warfare SIGGRAPH 2014 technique
- **Volumetric God Rays**: Light shafts through water
- **Bioluminescence**: Glowing deep-sea creatures with particle trails
- **Dynamic Weather**: Surface conditions affect underwater visuals

### 🤖 Advanced AI
- **FIRA (Fish Intelligent Responsive Algorithm)**: Enhanced boids system
- **Spatial Awareness**: 3D grid-based neighbor detection
- **Predator Avoidance**: Smart escape routes, speed bursts
- **Energy Management**: Strategic foraging and rest cycles

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **ECS** | bitECS | Entity Component System architecture |
| **Physics** | Rapier3D | Collision detection, rigid body dynamics |
| **Rendering** | Three.js r160+ | WebGL/WebGPU graphics |
| **Compute** | WebGPU | GPU-accelerated simulations (optional) |
| **State** | Zustand | Application state management |
| **Spatial** | Octree/Grid | Efficient neighbor queries |
| **Build** | Vite | Fast development and bundling |

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd ocean-simulator

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Open your browser to `http://localhost:5173` and dive in!

## 📚 Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[INDEX.md](docs/INDEX.md)** - Documentation navigator
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture and design patterns
- **[IMPLEMENTATION.md](docs/IMPLEMENTATION.md)** - Step-by-step implementation guide
- **[ENHANCEMENTS.md](docs/ENHANCEMENTS.md)** - World-class features and techniques
- **[PERFORMANCE.md](docs/PERFORMANCE.md)** - Optimization strategies
- **[API.md](docs/API.md)** - Component and system API reference
- **[SETUP.md](docs/SETUP.md)** - Development environment setup
- **[QUICKSTART-ENHANCEMENTS.md](docs/QUICKSTART-ENHANCEMENTS.md)** - Priority integration guide
- **[ROADMAP.md](docs/ROADMAP.md)** - Development phases and milestones

## 🎮 Controls

| Action | Control |
|--------|---------|
| **Camera Rotation** | Left Mouse Drag |
| **Camera Pan** | Right Mouse Drag / Middle Mouse Drag |
| **Zoom** | Mouse Wheel |
| **Pause/Resume** | Space Bar |
| **Toggle Debug** | D Key |
| **Toggle Stats** | S Key |
| **Spawn Creature** | Click in water |
| **Reset Camera** | R Key |

## 📊 Performance Targets

| Metric | Target | Excellent |
|--------|--------|-----------|
| **Frame Rate** | 60 FPS | 120 FPS |
| **Creature Count** | 1,000 | 10,000+ |
| **Draw Calls** | <100 | <50 |
| **Memory** | <512MB | <256MB |
| **Load Time** | <3s | <1s |

## 🔬 Scientific Accuracy

This simulator is grounded in real oceanographic and ecological principles:

- **Light Absorption**: Based on Jerlov water types and wavelength-dependent attenuation
- **Pressure Zones**: Accurate depth stratification and creature distribution
- **Energy Flow**: 10% trophic efficiency between food chain levels
- **Schooling Behavior**: Based on Reynolds' boids (1987) and FIRA enhancements
- **Ocean Dynamics**: Gerstner waves, currents, and turbulence

## 🌟 What Makes This Special

1. **Production-Quality Graphics**: Techniques from AAA games (CoD, Assassin's Creed)
2. **True ECS Architecture**: High-performance data-oriented design with bitECS
3. **WebGPU Ready**: Future-proof compute shaders for massive scale
4. **Scientifically Grounded**: Real oceanographic data and ecological models
5. **Open Source**: Learn from and contribute to cutting-edge web graphics

## 🤝 Contributing

Contributions are welcome! Whether it's bug fixes, new features, optimizations, or documentation improvements, please feel free to submit pull requests.

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- **Craig Reynolds** - Original Boids algorithm (1987)
- **SIGGRAPH Research** - Advanced rendering techniques
- **GPU Gems Series** - Water rendering and shader techniques
- **Three.js Community** - Excellent WebGL/WebGPU framework
- **bitECS** - High-performance ECS library

## 🔗 Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [bitECS Repository](https://github.com/NateTheGreatt/bitECS)
- [Rapier Physics](https://rapier.rs/)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [GPU Gems: Water](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)

---

**Built with ❤️ for the web platform**

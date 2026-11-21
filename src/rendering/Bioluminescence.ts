import * as THREE from 'three';

/** Most hunt flashes alive at once; extra events in a busy frame are dropped. */
const MAX_FLASHES = 24;

/**
 * Bioluminescence particle system
 * Creates glowing particles for deep-sea creatures and ambient bioluminescence
 */
export class BioluminescenceSystem {
  private particleSystem: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private time: number = 0;
  private particleCount: number = 3200;
  private scene: THREE.Scene;

  // Hunt flashes share one instanced mesh. Each used to be its own mesh, geometry,
  // material and requestAnimationFrame loop, so a feeding frenzy put over a thousand
  // growing additive spheres on screen and kept animating them while paused.
  private flashMesh: THREE.InstancedMesh;
  private flashPos: THREE.Vector3[] = [];
  private flashColor: THREE.Color[] = [];
  private flashAge = new Float32Array(MAX_FLASHES);
  private flashLife = new Float32Array(MAX_FLASHES);
  private flashGain = new Float32Array(MAX_FLASHES);
  private flashCount = 0;
  private nightFactor = 0;
  private _matrix = new THREE.Matrix4();
  private _quat = new THREE.Quaternion();
  private _scale = new THREE.Vector3();
  private _color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = this.createBiolumGeometry();
    this.material = this.createBiolumMaterial();
    this.particleSystem = new THREE.Points(this.geometry, this.material);
    
    scene.add(this.particleSystem);

    this.flashMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_FLASHES
    );
    // Create the colour attribute before the first render so the shader includes it.
    this.flashMesh.setColorAt(0, new THREE.Color(0, 0, 0));
    this.flashMesh.count = 0;
    this.flashMesh.frustumCulled = false;
    for (let i = 0; i < MAX_FLASHES; i++) {
      this.flashPos.push(new THREE.Vector3());
      this.flashColor.push(new THREE.Color());
    }
    scene.add(this.flashMesh);
  }
  
  private createBiolumGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const phases: number[] = [];
    const speeds: number[] = [];
    
    for (let i = 0; i < this.particleCount; i++) {
      // Mid-water volume so glow sits in the camera band (not only the abyss)
      const x = (Math.random() - 0.5) * 110;
      const y = -3 - Math.random() * 32;
      const z = (Math.random() - 0.5) * 110;
      
      positions.push(x, y, z);
      
      // Various bioluminescent colors
      const colorType = Math.random();
      if (colorType < 0.6) {
        // Blue-green (most common)
        colors.push(0.2, 0.8, 1.0);
      } else if (colorType < 0.85) {
        // Green
        colors.push(0.3, 1.0, 0.4);
      } else {
        // Purple/red (rare)
        colors.push(0.8, 0.2, 1.0);
      }
      
      // Varying sizes
      sizes.push(0.15 + Math.random() * 0.6);
      
      // Random phase for pulsing
      phases.push(Math.random() * Math.PI * 2);
      
      // Drift speed
      speeds.push(0.1 + Math.random() * 0.3);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
    geometry.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1));
    
    return geometry;
  }
  
  private createBiolumMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 1.0 }, // Controllable intensity for day/night cycle
      },
      vertexShader: `
        attribute vec3 color;
        attribute float size;
        attribute float phase;
        attribute float speed;
        
        uniform float time;
        
        varying vec3 vColor;
        varying float vPulse;
        varying float vDistanceFade;
        
        void main() {
          vColor = color;
          
          vec3 pos = position;
          
          // Drift particles slowly
          pos.x += sin(time * speed * 0.5 + phase) * 0.3;
          pos.z += cos(time * speed * 0.35 + phase) * 0.3;
          pos.y += sin(time * speed * 0.15) * 0.15;
          
          // Pulsing effect
          vPulse = 0.5 + 0.5 * sin(time * 0.8 + phase);
          vPulse = pow(vPulse, 2.0); // More pronounced pulse
          
          // Distance fade
          float dist = length(pos - cameraPosition);
          vDistanceFade = 1.0 - smoothstep(35.0, 75.0, dist);
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          // Capped so a particle drifting past the lens stays a speck, not a screen-sized disc.
          gl_PointSize = min(size * (480.0 / -mvPosition.z) * (0.55 + vPulse * 0.55), 24.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float intensity;

        varying vec3 vColor;
        varying float vPulse;
        varying float vDistanceFade;

        void main() {
          // Circular particle with soft edges
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);

          if (dist > 0.5) discard;

          // Soft glow
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha = pow(alpha, 1.5);

          // Apply pulse
          alpha *= (0.4 + vPulse * 0.6);

          // Apply distance fade
          alpha *= vDistanceFade;

          // Apply day/night intensity (brighter at night)
          alpha *= intensity;

          // Brighten the color
          vec3 glowColor = vColor * (1.75 + vPulse * 0.55) * intensity;

          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: false,
    });
  }
  
  /**
   * Update bioluminescence animation
   */
  public update(deltaTime: number, _cameraPosition: THREE.Vector3): void {
    this.time += deltaTime;
    this.material.uniforms.time.value = this.time;
    // cameraPosition is a built-in Three.js uniform, no need to set manually
    this.updateFlashes(deltaTime);
  }

  /** 0 at noon, 1 at midnight. Disturbed plankton only show against a dark sea. */
  public setNightFactor(nightFactor: number): void {
    this.nightFactor = THREE.MathUtils.clamp(nightFactor, 0, 1);
  }

  private updateFlashes(deltaTime: number): void {
    let live = 0;
    for (let i = 0; i < this.flashCount; i++) {
      const age = this.flashAge[i] + deltaTime;
      const life = this.flashLife[i];
      if (age >= life) continue;

      // Compact live flashes to the front so the instance count stays exact.
      if (live !== i) {
        this.flashPos[live].copy(this.flashPos[i]);
        this.flashColor[live].copy(this.flashColor[i]);
        this.flashLife[live] = life;
        this.flashGain[live] = this.flashGain[i];
      }
      this.flashAge[live] = age;

      const progress = age / life;
      const fade = (1 - progress) * (1 - progress) * this.flashGain[live];
      const radius = 0.12 + 0.3 * Math.sqrt(progress);
      this._scale.setScalar(radius);
      this._matrix.compose(this.flashPos[live], this._quat, this._scale);
      this.flashMesh.setMatrixAt(live, this._matrix);
      // Additive blending: scaling the colour is the same as fading the opacity.
      this.flashMesh.setColorAt(live, this._color.copy(this.flashColor[live]).multiplyScalar(fade));
      live++;
    }

    this.flashCount = live;
    this.flashMesh.count = live;
    this.flashMesh.instanceMatrix.needsUpdate = true;
    if (this.flashMesh.instanceColor) this.flashMesh.instanceColor.needsUpdate = true;
  }

  /**
   * Set bioluminescence intensity (0-3+, where 1.0 is default, higher = brighter at night)
   */
  public setIntensity(intensity: number): void {
    this.material.uniforms.intensity.value = intensity;
  }
  
  /**
   * Add a bioluminescent flash at a specific location
   * Useful for creature interactions
   */
  public addFlash(position: THREE.Vector3, color: THREE.Color, intensity: number = 1.0): void {
    const gain = intensity * this.nightFactor * this.nightFactor;
    if (gain < 0.05 || this.flashCount >= MAX_FLASHES) return;

    const i = this.flashCount++;
    this.flashPos[i].copy(position);
    this.flashColor[i].copy(color);
    this.flashGain[i] = gain;
    this.flashAge[i] = 0;
    this.flashLife[i] = 0.35 + intensity * 0.12;
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.particleSystem);
    this.scene.remove(this.flashMesh);
    this.flashMesh.geometry.dispose();
    (this.flashMesh.material as THREE.Material).dispose();
  }
}

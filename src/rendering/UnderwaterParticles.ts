import * as THREE from 'three';

/**
 * Underwater particle system for plankton, dust, and floating debris
 * Creates atmospheric underwater ambiance
 */
export class UnderwaterParticles {
  private particleSystem: THREE.Points;
  private particleCount = 1200; // Double particles for rich underwater atmosphere
  private particleGeometry: THREE.BufferGeometry;
  private particleMaterial: THREE.ShaderMaterial;
  private velocities: Float32Array;
  private particleTypes: Float32Array; // 0 = marine snow (down), 1 = plankton (up), 2 = dust (drift)

  constructor(scene: THREE.Scene) {
    this.particleGeometry = new THREE.BufferGeometry();

    // Create particle positions
    const positions = new Float32Array(this.particleCount * 3);
    const scales = new Float32Array(this.particleCount);
    const colors = new Float32Array(this.particleCount * 3);
    this.velocities = new Float32Array(this.particleCount * 3);
    this.particleTypes = new Float32Array(this.particleCount);

    // Initialize particles in a large volume
    const range = 100; // Larger range for more immersion
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Random position in volume
      positions[i3] = (Math.random() - 0.5) * range;
      positions[i3 + 1] = Math.random() * -45; // Deeper underwater
      positions[i3 + 2] = (Math.random() - 0.5) * range;

      // Determine particle type - more marine snow (70%), some plankton (15%), some dust (15%)
      const typeRoll = Math.random();
      if (typeRoll < 0.7) {
        this.particleTypes[i] = 0; // Marine snow - drifts downward
      } else if (typeRoll < 0.85) {
        this.particleTypes[i] = 1; // Plankton - drifts upward
      } else {
        this.particleTypes[i] = 2; // Dust - horizontal drift
      }

      // Varied scale based on particle type
      // Marine snow: varied sizes (0.15 to 0.8), plankton: smaller (0.1-0.4), dust: tiny (0.08-0.25)
      if (this.particleTypes[i] === 0) {
        // Marine snow - more size variation, some larger flocs
        scales[i] = 0.15 + Math.random() * 0.65 + (Math.random() > 0.9 ? 0.4 : 0);
      } else if (this.particleTypes[i] === 1) {
        // Plankton - smaller, more uniform
        scales[i] = 0.1 + Math.random() * 0.3;
      } else {
        // Dust - very small
        scales[i] = 0.08 + Math.random() * 0.17;
      }

      // Velocity based on particle type
      if (this.particleTypes[i] === 0) {
        // Marine snow - slow downward drift with slight horizontal wander
        this.velocities[i3] = (Math.random() - 0.5) * 0.008;
        this.velocities[i3 + 1] = -(Math.random() * 0.012 + 0.004); // Downward
        this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.008;
      } else if (this.particleTypes[i] === 1) {
        // Plankton - slow upward drift
        this.velocities[i3] = (Math.random() - 0.5) * 0.015;
        this.velocities[i3 + 1] = Math.random() * 0.008 + 0.003; // Upward
        this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.015;
      } else {
        // Dust - horizontal drift with very slow settling
        this.velocities[i3] = (Math.random() - 0.5) * 0.025;
        this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.002; // Nearly neutral
        this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.025;
      }

      // Color variation based on type
      if (this.particleTypes[i] === 0) {
        // Marine snow - warm neutral white (reduced blue tint)
        const shade = 0.75 + Math.random() * 0.2;
        colors[i3] = shade;
        colors[i3 + 1] = shade * 0.98;
        colors[i3 + 2] = shade * 0.96;
      } else if (this.particleTypes[i] === 1) {
        // Plankton - slight blue-green tint
        colors[i3] = 0.5 + Math.random() * 0.2;
        colors[i3 + 1] = 0.65 + Math.random() * 0.2;
        colors[i3 + 2] = 0.75 + Math.random() * 0.2;
      } else {
        // Dust - pale blue-white
        colors[i3] = 0.8 + Math.random() * 0.15;
        colors[i3 + 1] = 0.85 + Math.random() * 0.15;
        colors[i3 + 2] = 0.9 + Math.random() * 0.1;
      }
    }

    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom shader for particles
    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        cameraPosition: { value: new THREE.Vector3() },
      },
      vertexShader: `
        attribute float scale;
        attribute vec3 color;

        varying vec3 vColor;
        varying float vAlpha;
        varying float vScale;

        uniform float time;

        void main() {
          vColor = color;
          vScale = scale;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          // Distance fade - particles visible further away
          float distance = length(mvPosition.xyz);
          vAlpha = smoothstep(80.0, 15.0, distance);

          // Depth fade (particles fade near surface but visible throughout water column)
          float depthFade = smoothstep(-1.0, -6.0, position.y);
          vAlpha *= depthFade;

          // Scale based on size attribute - larger particles for marine snow
          // Use perspective-correct sizing
          float perspectiveScale = 350.0 / max(-mvPosition.z, 1.0);
          gl_PointSize = scale * 5.0 * perspectiveScale;

          // Clamp to reasonable range
          gl_PointSize = clamp(gl_PointSize, 1.0, 12.0);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vScale;

        void main() {
          // Circular particle shape with soft edge
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);

          if (dist > 0.5) discard;

          // Softer edge falloff for larger particles (marine snow), sharper for small
          float edgeSoftness = mix(0.15, 0.35, clamp(vScale, 0.0, 1.0));
          float alpha = smoothstep(0.5, edgeSoftness, dist) * vAlpha;

          // Enhanced visibility - clearly visible floating particles
          alpha *= 0.7;

          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
    scene.add(this.particleSystem);
  }

  /**
   * Update particle positions and animations
   */
  update(deltaTime: number, cameraPosition: THREE.Vector3): void {
    this.particleMaterial.uniforms.time.value += deltaTime;
    this.particleMaterial.uniforms.cameraPosition.value.copy(cameraPosition);

    const positions = this.particleGeometry.attributes.position.array as Float32Array;
    const range = 100;
    const time = this.particleMaterial.uniforms.time.value;

    // Update particle positions
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      const particleType = this.particleTypes[i];

      // Apply velocity
      positions[i3] += this.velocities[i3] * deltaTime * 60;
      positions[i3 + 1] += this.velocities[i3 + 1] * deltaTime * 60;
      positions[i3 + 2] += this.velocities[i3 + 2] * deltaTime * 60;

      // Wrap around boundaries
      if (positions[i3] > range / 2) positions[i3] = -range / 2;
      if (positions[i3] < -range / 2) positions[i3] = range / 2;
      if (positions[i3 + 2] > range / 2) positions[i3 + 2] = -range / 2;
      if (positions[i3 + 2] < -range / 2) positions[i3 + 2] = range / 2;

      // Handle vertical wrapping based on particle type
      if (particleType === 0) {
        // Marine snow - reset to top when reaches bottom
        if (positions[i3 + 1] < -45) positions[i3 + 1] = -2;
      } else if (particleType === 1) {
        // Plankton - reset to bottom when reaches surface
        if (positions[i3 + 1] > -2) positions[i3 + 1] = -45;
      } else {
        // Dust - keep in middle water column
        if (positions[i3 + 1] > -5) positions[i3 + 1] = -35;
        if (positions[i3 + 1] < -40) positions[i3 + 1] = -10;
      }

      // Add gentle swirling motion - different for each type
      const swirlSpeed = particleType === 0 ? 0.3 : (particleType === 1 ? 0.5 : 0.7);
      const swirlAmplitude = particleType === 0 ? 0.006 : (particleType === 1 ? 0.01 : 0.015);
      const swirl = Math.sin(time * swirlSpeed + i * 0.1) * swirlAmplitude;
      positions[i3] += swirl;
      positions[i3 + 2] += Math.cos(time * swirlSpeed + i * 0.15) * swirlAmplitude;
    }

    this.particleGeometry.attributes.position.needsUpdate = true;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
  }
}

/**
 * Bubble system for rising air bubbles
 */
export class BubbleSystem {
  private bubbles: THREE.Points;
  private bubbleCount = 12; // Reduced from 20
  private bubbleGeometry: THREE.BufferGeometry;
  private bubbleMaterial: THREE.PointsMaterial;
  private velocities: Float32Array;
  private lifetimes: Float32Array;

  constructor(scene: THREE.Scene) {
    this.bubbleGeometry = new THREE.BufferGeometry();
    
    const positions = new Float32Array(this.bubbleCount * 3);
    const scales = new Float32Array(this.bubbleCount);
    this.velocities = new Float32Array(this.bubbleCount);
    this.lifetimes = new Float32Array(this.bubbleCount);

    // Initialize bubbles
    for (let i = 0; i < this.bubbleCount; i++) {
      this.resetBubble(i, positions, scales);
    }

    this.bubbleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.bubbleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

    this.bubbleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      transparent: true,
      opacity: 0.6,
      map: this.createBubbleTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.bubbles = new THREE.Points(this.bubbleGeometry, this.bubbleMaterial);
    scene.add(this.bubbles);
  }

  private createBubbleTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    // Create circular gradient
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private resetBubble(i: number, positions: Float32Array, scales: Float32Array): void {
    const i3 = i * 3;
    
    // Random position near ocean floor
    positions[i3] = (Math.random() - 0.5) * 40;
    positions[i3 + 1] = -25 + Math.random() * -5;
    positions[i3 + 2] = (Math.random() - 0.5) * 40;

    // Random size
    scales[i] = Math.random() * 0.5 + 0.3;

    // Rise velocity (faster for larger bubbles)
    this.velocities[i] = 0.3 + scales[i] * 0.5;

    // Lifetime
    this.lifetimes[i] = Math.random() * 5 + 3;
  }

  update(deltaTime: number): void {
    const positions = this.bubbleGeometry.attributes.position.array as Float32Array;
    const scales = this.bubbleGeometry.attributes.scale.array as Float32Array;

    for (let i = 0; i < this.bubbleCount; i++) {
      const i3 = i * 3;

      // Rise
      positions[i3 + 1] += this.velocities[i] * deltaTime;

      // Wobble side to side
      positions[i3] += Math.sin(positions[i3 + 1] * 2) * 0.01;
      positions[i3 + 2] += Math.cos(positions[i3 + 1] * 2) * 0.01;

      // Decrease lifetime
      this.lifetimes[i] -= deltaTime;

      // Reset bubble when it reaches surface or expires
      if (positions[i3 + 1] > -2 || this.lifetimes[i] <= 0) {
        this.resetBubble(i, positions, scales);
      }
    }

    this.bubbleGeometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.bubbleGeometry.dispose();
    this.bubbleMaterial.dispose();
    if (this.bubbleMaterial.map) {
      this.bubbleMaterial.map.dispose();
    }
  }
}

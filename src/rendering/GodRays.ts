import * as THREE from 'three';

/**
 * God rays (volumetric lighting) effect
 * Creates realistic shafts of light penetrating the water from above
 *
 * Redesigned to avoid "vine-like patterns" by:
 * - Using fewer, larger light shafts instead of many small particles
 * - Implementing proper volumetric ray-marching approach
 * - Better depth fading and animation
 */
export class GodRaysEffect {
  private godRaysMaterial: THREE.ShaderMaterial;
  private godRaysGeometry: THREE.BufferGeometry;
  private godRays: THREE.Points;
  private time: number = 0;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.godRaysGeometry = this.createGodRaysGeometry();
    this.godRaysMaterial = this.createGodRaysMaterial();
    this.godRays = new THREE.Points(this.godRaysGeometry, this.godRaysMaterial);

    scene.add(this.godRays);
  }

  private createGodRaysGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    // Reduced particle count - fewer, more distinct rays
    const particleCount = 3000;

    const positions: number[] = [];
    const scales: number[] = [];
    const randomness: number[] = [];

    // Create distinct light shafts - fewer rays, more spread out
    const rayCount = 8; // Fewer distinct rays
    const particlesPerRay = Math.floor(particleCount / rayCount);

    for (let i = 0; i < rayCount; i++) {
      // More random positioning, not evenly spaced
      const angle = (i / rayCount) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 20 + Math.random() * 35; // Wider spread
      const centerX = Math.cos(angle) * radius;
      const centerZ = Math.sin(angle) * radius;

      // Each ray has a random width
      const rayWidth = 3 + Math.random() * 4;

      for (let j = 0; j < particlesPerRay; j++) {
        // Gaussian-like distribution within each ray (denser in center)
        const gaussianX = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
        const gaussianZ = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;

        const x = centerX + gaussianX * rayWidth * 2;
        const y = Math.random() * 35 - 3; // From near surface to depth
        const z = centerZ + gaussianZ * rayWidth * 2;

        positions.push(x, y, z);

        // Size varies with depth - smaller particles deeper
        const depthFactor = (y + 3) / 35; // 0 at bottom, 1 at top
        // Smaller base size to prevent overlapping vine appearance
        scales.push(0.15 + depthFactor * 0.35);

        // Store randomness for animation variation
        randomness.push(
          Math.random(),
          Math.random(),
          Math.random()
        );
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('scale', new THREE.Float32BufferAttribute(scales, 1));
    geometry.setAttribute('randomness', new THREE.Float32BufferAttribute(randomness, 3));

    return geometry;
  }

  private createGodRaysMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        lightDirection: { value: new THREE.Vector3(0.2, -1, 0.1).normalize() },
        intensity: { value: 0.5 }, // Reduced intensity
        color: { value: new THREE.Color(0.7, 0.85, 0.95) }, // Softer blue-white
      },
      vertexShader: `
        attribute float scale;
        attribute vec3 randomness;

        uniform float time;
        uniform vec3 lightDirection;

        varying float vDepth;
        varying float vIntensity;
        varying float vRandomAlpha;

        void main() {
          vec3 pos = position;

          // Very subtle, slow drift - independent per particle to break up patterns
          float driftPhase = randomness.x * 6.28;
          float driftSpeed = 0.15 + randomness.y * 0.1;
          pos.x += sin(time * driftSpeed + driftPhase) * 0.8;
          pos.z += cos(time * driftSpeed * 0.7 + driftPhase) * 0.8;

          // Flicker effect - each particle fades in/out independently
          float flickerPhase = randomness.z * 6.28;
          float flicker = 0.6 + 0.4 * sin(time * (0.3 + randomness.y * 0.2) + flickerPhase);
          vRandomAlpha = flicker;

          // Calculate depth for fading (stronger near surface)
          vDepth = clamp((pos.y + 3.0) / 35.0, 0.0, 1.0);
          vDepth = pow(vDepth, 0.7); // Non-linear falloff - more visible near surface

          // Intensity based on position relative to light direction
          vec3 toLight = normalize(vec3(0.0, 1.0, 0.0));
          float alignment = max(dot(toLight, -lightDirection), 0.0);
          vIntensity = 0.3 + alignment * 0.7;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

          // Smaller point sizes to prevent connected appearance
          float perspectiveScale = 200.0 / max(-mvPosition.z, 1.0);
          gl_PointSize = scale * perspectiveScale * vDepth;

          // Clamp to reasonable range
          gl_PointSize = clamp(gl_PointSize, 0.5, 6.0);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float intensity;
        uniform vec3 color;

        varying float vDepth;
        varying float vIntensity;
        varying float vRandomAlpha;

        void main() {
          // Circular particle shape with very soft edges
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);

          if (dist > 0.5) discard;

          // Very soft edge falloff
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha = pow(alpha, 1.5);

          // Apply depth fade
          alpha *= vDepth;

          // Apply intensity and flicker
          alpha *= intensity * vIntensity * vRandomAlpha;

          // Keep alpha low to prevent over-bright accumulation
          alpha = min(alpha, 0.25);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: false,
    });
  }

  /**
   * Update god rays animation
   */
  public update(deltaTime: number): void {
    this.time += deltaTime;
    this.godRaysMaterial.uniforms.time.value = this.time;
  }

  /**
   * Set light direction
   */
  public setLightDirection(direction: THREE.Vector3): void {
    this.godRaysMaterial.uniforms.lightDirection.value.copy(direction).normalize();
  }

  /**
   * Set intensity
   */
  public setIntensity(intensity: number): void {
    this.godRaysMaterial.uniforms.intensity.value = intensity;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.godRaysGeometry.dispose();
    this.godRaysMaterial.dispose();
    this.scene.remove(this.godRays);
  }
}

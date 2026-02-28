import * as THREE from 'three';

/**
 * Bioluminescence particle system
 * Creates glowing particles for deep-sea creatures and ambient bioluminescence
 */
export class BioluminescenceSystem {
  private particleSystem: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private time: number = 0;
  private particleCount: number = 2000;
  private scene: THREE.Scene;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = this.createBiolumGeometry();
    this.material = this.createBiolumMaterial();
    this.particleSystem = new THREE.Points(this.geometry, this.material);
    
    scene.add(this.particleSystem);
  }
  
  private createBiolumGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const phases: number[] = [];
    const speeds: number[] = [];
    
    for (let i = 0; i < this.particleCount; i++) {
      // Distribute in a large volume, concentrated at depth
      const x = (Math.random() - 0.5) * 100;
      const y = -20 - Math.random() * 40; // Deeper waters
      const z = (Math.random() - 0.5) * 100;
      
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
          vDistanceFade = 1.0 - smoothstep(30.0, 60.0, dist);
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (400.0 / -mvPosition.z) * (0.5 + vPulse * 0.5);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
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
          
          // Brighten the color
          vec3 glowColor = vColor * (1.2 + vPulse * 0.4);
          
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
  }
  
  /**
   * Add a bioluminescent flash at a specific location
   * Useful for creature interactions
   */
  public addFlash(position: THREE.Vector3, color: THREE.Color, intensity: number = 1.0): void {
    // Create a temporary bright particle
    const flashGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: intensity,
      blending: THREE.AdditiveBlending,
    });
    
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    this.scene.add(flash);
    
    // Animate and remove
    const startTime = Date.now();
    const duration = 500; // ms
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress >= 1.0) {
        this.scene.remove(flash);
        flashGeometry.dispose();
        flashMaterial.dispose();
        return;
      }
      
      // Fade out and expand
      flashMaterial.opacity = intensity * (1 - progress);
      const scale = 1 + progress * 2;
      flash.scale.set(scale, scale, scale);
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.particleSystem);
  }
}

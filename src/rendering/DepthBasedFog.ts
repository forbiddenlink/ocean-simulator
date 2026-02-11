import * as THREE from 'three';

/**
 * Depth-based fog and color grading for realistic underwater appearance
 * Objects get bluer and less visible with distance
 */
export class DepthBasedFog {
  private scene: THREE.Scene;
  private fogColor: THREE.Color;
  private fogDensity: number;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    
    // Realistic underwater fog - deep blue-green
    this.fogColor = new THREE.Color(0x0d5f7d); // Deep ocean blue
    this.fogDensity = 0.012; // Slightly denser for more depth perception
    
    // Apply exponential squared fog for realistic depth falloff
    this.scene.fog = new THREE.FogExp2(this.fogColor, this.fogDensity);
    
    // Match background to fog color
    this.scene.background = new THREE.Color(0x0d6f8c);
  }
  
  /**
   * Update fog parameters
   */
  public setFogDensity(density: number): void {
    this.fogDensity = Math.max(0, Math.min(1, density));
    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = this.fogDensity;
    }
  }
  
  /**
   * Set fog color for different conditions
   */
  public setFogColor(color: THREE.Color | number): void {
    if (typeof color === 'number') {
      this.fogColor.setHex(color);
    } else {
      this.fogColor.copy(color);
    }
    
    if (this.scene.fog) {
      (this.scene.fog as THREE.FogExp2).color.copy(this.fogColor);
    }
    
    // Update background to match
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.fogColor);
    }
  }
  
  /**
   * Apply depth-based color grading to materials
   * This should be called on materials that need underwater appearance
   */
  public static applyUnderwaterColorShift(material: THREE.Material): void {
    if (material instanceof THREE.MeshStandardMaterial || 
        material instanceof THREE.MeshPhysicalMaterial) {
      
      // Underwater materials absorb red light first, then yellow
      // This creates the characteristic blue-green underwater look
      
      material.onBeforeCompile = (shader) => {
        // Add depth-based color absorption
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <fog_fragment>',
          `
          #include <fog_fragment>
          
          // Simulate underwater light absorption (Beer-Lambert law)
          // Red light is absorbed first, then yellow, leaving blue-green
          float depth = length(vViewPosition);
          float depthFactor = exp(-depth * 0.03); // Exponential falloff
          
          // Absorption coefficients for different wavelengths
          vec3 absorption = vec3(
            exp(-depth * 0.06), // Red absorbed most (deeper = less red)
            exp(-depth * 0.04), // Green absorbed moderately
            exp(-depth * 0.02)  // Blue absorbed least (penetrates deepest)
          );
          
          // Apply wavelength-dependent absorption
          gl_FragColor.rgb *= absorption;
          
          // Add blue-green tint for deep water
          vec3 waterTint = vec3(0.5, 0.75, 0.85);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, waterTint, 1.0 - depthFactor);
          `
        );
      };
    }
  }
  
  /**
   * Create depth-aware environment lighting
   */
  public static createUnderwaterAmbient(scene: THREE.Scene): THREE.HemisphereLight {
    // Sky color = brighter blue (shallower water near surface)
    // Ground color = darker blue-green (deeper water near floor)
    const skyColor = 0x6ac5e8; // Light cyan-blue
    const groundColor = 0x0a4f6d; // Dark ocean blue
    const intensity = 1.2;
    
    const hemiLight = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);
    
    return hemiLight;
  }
}

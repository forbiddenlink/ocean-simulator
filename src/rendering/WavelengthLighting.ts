import * as THREE from 'three';

/**
 * Wavelength-Dependent Underwater Lighting System
 * Implements Beer-Lambert Law for realistic color absorption with depth
 * Based on Jerlov Type I water absorption coefficients
 */
export class WavelengthLighting {
    // Absorption coefficients (per meter) for RGB
    // Red light absorbed quickly, blue penetrates deepest
    private readonly ABSORPTION_COEFFICIENTS = {
        red: 0.45,    // Red absorbed at 0.45/m
        green: 0.15,  // Green absorbed at 0.15/m
        blue: 0.05    // Blue absorbed at 0.05/m (penetrates deepest)
    };

    // Create uniform for shaders
    public readonly uniforms = {
        depthMeters: { value: 0.0 },
        surfaceColor: { value: new THREE.Color(0x4488ff) },
        deepColor: { value: new THREE.Color(0x001133) },
        absorptionCoeff: {
            value: new THREE.Vector3(
                this.ABSORPTION_COEFFICIENTS.red,
                this.ABSORPTION_COEFFICIENTS.green,
                this.ABSORPTION_COEFFICIENTS.blue
            )
        },
        fogDensity: { value: 0.015 }
    };

    /**
     * Calculate light transmission at a given depth using Beer-Lambert Law
     * I(λ, d) = I₀(λ) · e^(-k(λ)·d)
     */
    public getTransmission(depth: number): THREE.Vector3 {
        return new THREE.Vector3(
            Math.exp(-this.ABSORPTION_COEFFICIENTS.red * depth),
            Math.exp(-this.ABSORPTION_COEFFICIENTS.green * depth),
            Math.exp(-this.ABSORPTION_COEFFICIENTS.blue * depth)
        );
    }

    /**
     * Get underwater color at a specific depth
     */
    public getUnderwaterColor(depth: number): THREE.Color {
        const transmission = this.getTransmission(depth);

        // Start with surface color and attenuate
        const color = new THREE.Color(0x4488ff);
        color.r *= transmission.x;
        color.g *= transmission.y;
        color.b *= transmission.z;

        // Mix with deep water color based on depth
        const deepColor = new THREE.Color(0x001133);
        const mixFactor = Math.min(depth / 200, 1.0);
        color.lerp(deepColor, mixFactor);

        return color;
    }

    /**
     * Update depth value (for animated camera depth changes)
     */
    public updateDepth(cameraY: number): void {
        // Y is negative underwater, convert to positive depth
        const depth = Math.max(0, -cameraY);
        this.uniforms.depthMeters.value = depth;

        // Adjust fog density based on depth
        this.uniforms.fogDensity.value = 0.015 + depth * 0.0002;
    }

    /**
     * Get GLSL shader code for integration
     */
    public getShaderCode(): { vertex: string; fragment: string } {
        return {
            vertex: `
        varying vec3 vWorldPosition;
        varying float vDepth;
        
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vDepth = -worldPosition.y; // Y is negative underwater
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragment: `
        uniform vec3 absorptionCoeff;
        uniform vec3 surfaceColor;
        uniform vec3 deepColor;
        uniform float depthMeters;
        uniform float fogDensity;
        
        varying vec3 vWorldPosition;
        varying float vDepth;
        
        vec3 applyWavelengthAbsorption(vec3 color, float depth) {
          // Beer-Lambert Law: I = I₀ * e^(-k*d)
          vec3 transmission = exp(-absorptionCoeff * depth);
          return color * transmission;
        }
        
        vec3 getDepthColor(float depth) {
          // Interpolate between surface and deep water color
          float t = clamp(depth / 200.0, 0.0, 1.0);
          return mix(surfaceColor, deepColor, t);
        }
        
        void main() {
          // Calculate actual depth from surface
          float objectDepth = max(0.0, vDepth);
          
          // Get base underwater color
          vec3 baseColor = getDepthColor(objectDepth);
          
          // Apply wavelength-dependent absorption
          vec3 finalColor = applyWavelengthAbsorption(baseColor, objectDepth);
          
          // Add exponential depth fog
          float fogAmount = 1.0 - exp(-fogDensity * objectDepth);
          vec3 fogColor = deepColor;
          finalColor = mix(finalColor, fogColor, fogAmount);
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
        };
    }

    /**
     * Apply wavelength lighting to scene fog
     */
    public applyToSceneFog(scene: THREE.Scene, cameraY: number): void {
        const depth = Math.max(0, -cameraY);

        // Dynamic fog density - balanced for creature visibility and depth feel
        // At surface: 0.010, at 30m: ~0.015 (reduced for better creature visibility)
        const baseDensity = 0.010;
        const depthFactor = depth * 0.00015;
        const density = baseDensity + depthFactor;

        // Fog color shifts from blue-green (shallow) to deep blue (deep)
        // BRIGHTER fog colors for visible underwater atmosphere (Phase 1 visual fix)
        const shallowFog = new THREE.Color(0x3a7a8a); // Brighter teal-blue
        const deepFog = new THREE.Color(0x1a4a6a); // Dark but visible blue
        const fogMix = Math.min(depth / 100, 1.0);
        const fogColor = shallowFog.clone().lerp(deepFog, fogMix);

        // Apply FogExp2 - exponential fog that looks natural underwater
        if (!scene.fog || !(scene.fog instanceof THREE.FogExp2)) {
            scene.fog = new THREE.FogExp2(fogColor.getHex(), density);
        } else {
            (scene.fog as THREE.FogExp2).color.copy(fogColor);
            (scene.fog as THREE.FogExp2).density = density;
        }

        // Background matches fog color for seamless horizon
        scene.background = fogColor;
    }
}

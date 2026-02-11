import * as THREE from 'three';

/**
 * Custom shader material for fish with vertex-based swimming animation,
 * iridescent scales, and realistic underwater lighting
 */
export function createFishMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(0xff8844) },
      iridescenceColor: { value: new THREE.Color(0xffd700) }, // Golden shimmer
      scale: { value: 1.0 },
      scaleSize: { value: 20.0 }, // Scale pattern size
      roughness: { value: 0.3 },
      // Wavelength Lighting Uniforms
      absorptionCoeff: { value: new THREE.Vector3(0.45, 0.15, 0.05) },
      surfaceColor: { value: new THREE.Color(0x4488ff) },
      deepColor: { value: new THREE.Color(0x001133) },
      depthMeters: { value: 0.0 }, // Camera depth
      fogDensity: { value: 0.015 },
      sunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() }
    },
    vertexShader: `
      uniform float time;
      uniform float scale;
      
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying float vDepth; // Depth for lighting
      varying vec3 vColor; // Pass vertex color to fragment
      
      void main() {
        vUv = uv;
        vNormal = normal;
        vPosition = position;
        vColor = color; // THREE.js provides 'attribute vec3 color' automatically
        
        vec3 pos = position;
        
        // Swimming animation (sine wave along X axis - fish length)
        // Head is at -X, Tail is at +X (or vice versa depending on geometry)
        // Assuming fish points along +X or -X
        
        float bodyLength = 1.0 * scale;
        float tailFactor = smoothstep(0.2, -1.0, pos.x); // Shifted start to keep head stiffer
        
        // Side-to-side swimming motion (Z-axis displacement)
        // Slower, more graceful swimming motion
        float swimOffset = sin(time * 3.0 + pos.x * 2.0) * 0.08 * tailFactor;
        
        // Apply deformation
        pos.z += swimOffset;
        
        // Recalculate normal (approximate)
        vec3 newNormal = normal;
        newNormal.x -= cos(time * 3.0 + pos.x * 2.0) * 0.08 * tailFactor;
        newNormal = normalize(newNormal);
        vNormal = newNormal;
        
        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        vDepth = -worldPosition.y; // Y is negative underwater, so -Y is depth
        
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 color; // Base uniform color
      uniform vec3 iridescenceColor; // Iridescent shimmer color
      uniform float scaleSize;
      uniform float roughness;
      uniform vec3 sunDirection;
      uniform vec3 absorptionCoeff;
      uniform vec3 surfaceColor;
      uniform vec3 deepColor;
      uniform float depthMeters; // Camera depth (not used per pixel, vDepth is better)
      uniform float fogDensity;
      uniform float time;
      
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying float vDepth;
      varying vec3 vColor; // Received vertex color
      varying vec2 vUv;
      
      // Hash function for procedural noise
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      
      // Smooth noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      // Procedural scale pattern with normal detail
      vec3 scalePatternWithNormal(vec2 uv, float size) {
        vec2 scaledUv = uv * size;
        vec2 cellId = floor(scaledUv);
        vec2 cellUv = fract(scaledUv);
        
        // Create scale-like hexagonal pattern
        float d = length(cellUv - 0.5);
        float scale = smoothstep(0.35, 0.48, d);
        
        // Add variation per scale
        float variation = hash(cellId);
        scale += variation * 0.15;
        
        // Calculate scale edge for normal mapping
        float edgeWidth = 0.05;
        float edge = smoothstep(0.45 - edgeWidth, 0.45, d);
        
        // Normal perturbation based on scale edges
        vec2 gradient = cellUv - 0.5;
        float normalStrength = edge * 0.3;
        
        return vec3(clamp(scale, 0.0, 1.0), gradient * normalStrength);
      }
      
      // Fresnel for iridescence (Schlick approximation)
      float fresnel(vec3 viewDir, vec3 normal, float power) {
        float cosTheta = max(dot(viewDir, normal), 0.0);
        return pow(1.0 - cosTheta, power);
      }
      
      // Fresnel-Schlick with F0
      float fresnelSchlick(vec3 viewDir, vec3 normal, float f0) {
        float cosTheta = max(dot(viewDir, normal), 0.0);
        return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
      }
      
      // Specular reflection (Blinn-Phong)
      float specular(vec3 normal, vec3 lightDir, vec3 viewDir, float shininess) {
        vec3 halfDir = normalize(lightDir + viewDir);
        return pow(max(dot(normal, halfDir), 0.0), shininess);
      }
      
      // Subsurface scattering approximation
      float subsurfaceScattering(vec3 lightDir, vec3 viewDir, vec3 normal, float thickness) {
        vec3 scatterDir = lightDir + normal * 0.3;
        float scatter = pow(clamp(dot(viewDir, -scatterDir), 0.0, 1.0), 3.0) * thickness;
        return scatter;
      }
      
      void main() {
        // Normalize normal
        vec3 normal = normalize(vNormal);
        
        // View direction for Fresnel
        vec3 viewDir = normalize(cameraPosition - vPosition);
        
        // Scale pattern with normal mapping
        vec3 worldPos = (vec4(vPosition, 1.0)).xyz;
        vec3 scaleData = scalePatternWithNormal(vUv * 8.0 + worldPos.xz * 0.05, scaleSize);
        float scales = scaleData.x;
        vec2 scaleNormalOffset = scaleData.yz;
        
        // Perturb normal based on scale edges
        vec3 perturbedNormal = normalize(normal + vec3(scaleNormalOffset.x, 0.0, scaleNormalOffset.y));
        
        // Directional Lighting from sun with better falloff
        float diff = max(dot(perturbedNormal, sunDirection), 0.0);
        float diffWrap = max((dot(perturbedNormal, sunDirection) + 0.5) / 1.5, 0.0); // Wrapped diffuse
        
        // Iridescent effect based on viewing angle (Fresnel) - toned down
        float iridescence = fresnel(viewDir, perturbedNormal, 3.0) * 0.6;
        float fresnel_f0 = fresnelSchlick(viewDir, perturbedNormal, 0.04);
        
        // Animated shimmer on scales - much subtler
        float shimmer = sin(time * 1.5 + worldPos.x * 8.0 + worldPos.z * 8.0) * 0.5 + 0.5;
        float scaleShimmer = scales * shimmer * 0.15;
        
        // Add micro-detail noise to scales
        float microDetail = noise(vUv * 50.0 + worldPos.xz * 0.5) * 0.15;
        scales = clamp(scales + microDetail, 0.0, 1.0);
        
        // Mix base color with iridescence
        vec3 iridColor = mix(color, iridescenceColor, iridescence * 0.7);
        
        // Mix Uniform Color with Vertex Color (for eyes/belly)
        vec3 combinedColor = iridColor * vColor;
        
        // Add scale detail (darker in creases, brighter on edges)
        combinedColor = mix(combinedColor * 0.6, combinedColor * 1.4, scales);
        
        // Subsurface scattering (light passing through thin parts like fins)
        float thickness = 0.8; // Adjust based on body part (could use vertex color)
        float sss = subsurfaceScattering(sunDirection, viewDir, perturbedNormal, thickness);
        vec3 sssColor = vec3(1.0, 0.6, 0.4) * sss * 0.5; // Warm scattered light
        
        // Apply lighting with wrap lighting for softer shadows
        float ambient = 0.45;
        vec3 litColor = combinedColor * (ambient + 0.55 * diffWrap);
        
        // Add subsurface scattering
        litColor += sssColor * (1.0 - scales * 0.5); // Less SSS where scales are thick
        
        // Dual specular highlights (sharp and soft) - more natural
        float specSharp = specular(perturbedNormal, sunDirection, viewDir, 80.0 / roughness);
        float specSoft = specular(perturbedNormal, sunDirection, viewDir, 25.0 / roughness);
        litColor += vec3(1.0, 1.0, 0.98) * specSharp * 0.4;
        litColor += vec3(0.9, 0.95, 1.0) * specSoft * 0.25;
        
        // Add iridescent shimmer highlights - very subtle
        litColor += iridescenceColor * scaleShimmer * iridescence * 0.4;
        
        // Rim lighting for depth - subtle
        float rim = pow(1.0 - max(dot(viewDir, perturbedNormal), 0.0), 3.5);
        litColor += vec3(0.4, 0.6, 0.8) * rim * 0.2;
        
        // --- WAVELENGTH DEPENDENT LIGHTING ---
        
        // 1. Calculate depth of this pixel
        float objectDepth = max(0.0, vDepth);
        
        // 2. Apply Beer-Lambert Absorption to the light hitting the fish
        vec3 transmission = exp(-absorptionCoeff * objectDepth);
        
        // Apply transmission to the model's color
        vec3 absorbedColor = litColor * transmission;
        
        // 3. Distance Fog (Water Color)
        float fogAmount = 1.0 - exp(-fogDensity * objectDepth);
        vec3 fogColor = deepColor;
        
        vec3 finalColor = mix(absorbedColor, fogColor, fogAmount);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    side: THREE.DoubleSide,
    vertexColors: true
  });
}

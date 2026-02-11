import * as THREE from 'three';

/**
 * Enhanced PBR Fish Material with:
 * - Realistic scale normal mapping
 * - Angle-dependent iridescence (guanine crystals)
 * - Clearcoat for mucus layer
 * - Subsurface scattering for fins
 * - Wavelength-dependent underwater lighting
 */
export function createEnhancedFishMaterial(params: {
  baseColor?: THREE.Color;
  iridescenceColor?: THREE.Color;
  species?: 'tropical' | 'tuna' | 'bass' | 'generic';
  metallic?: number;
  roughness?: number;
} = {}): THREE.ShaderMaterial {
  
  const {
    baseColor = new THREE.Color(0xff7744),
    iridescenceColor = new THREE.Color(0x44aaff),
    species = 'generic',
    metallic = 0.5,
    roughness = 0.2
  } = params;

  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      baseColor: { value: baseColor },
      iridescenceColor: { value: iridescenceColor },
      metallic: { value: metallic },
      roughness: { value: roughness },
      clearcoat: { value: 0.8 },
      clearcoatRoughness: { value: 0.05 },
      
      // Scale parameters
      scaleSize: { value: species === 'tropical' ? 25.0 : 18.0 },
      scaleDepth: { value: 0.15 },
      scaleVariation: { value: 0.3 },
      
      // Underwater lighting - balanced absorption for realism + visibility
      sunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
      absorptionCoeff: { value: new THREE.Vector3(0.25, 0.10, 0.03) }, // Balanced for visibility + realism
      deepColor: { value: new THREE.Color(0x0a3d5c) }, // Deep color for fog
      fogDensity: { value: 0.004 }, // Slightly increased fog
      
      // Animation
      swimPhase: { value: 0 },
    },
    vertexShader: `
      uniform float time;
      uniform float swimPhase;

      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying float vDepth;
      varying vec3 vColor;
      varying vec3 vTangent;
      varying vec3 vBitangent;

      // Three.js provides instanceMatrix and instanceColor automatically
      // when USE_INSTANCING and USE_INSTANCING_COLOR are defined

      void main() {
        vUv = uv;
        vPosition = position;

        // Handle colors: combine vertex colors with instance colors
        vec3 baseCol = vec3(1.0, 0.8, 0.5); // Default warm fish color

        #ifdef USE_COLOR
          baseCol = color;
        #endif

        #ifdef USE_INSTANCING_COLOR
          // Use instance color blended with base color to avoid overly dark fish
          vColor = mix(baseCol, instanceColor, 0.7);
        #else
          vColor = baseCol;
        #endif

        // Biomechanically accurate swimming animation
        vec3 pos = position;

        // Body wave propagation (head to tail)
        float bodyLength = 1.0;
        // FIXED: Clamp positionAlongBody to valid range [0, 1]
        float positionAlongBody = clamp((pos.x + bodyLength * 0.5) / bodyLength, 0.0, 1.0);

        // Amplitude envelope: increases from head to tail
        float amplitudeEnvelope = smoothstep(0.0, 1.0, positionAlongBody);
        // FIXED: Reduced max amplitude to prevent extreme displacement
        float amplitude = 0.02 + amplitudeEnvelope * 0.12;

        // Wave frequency based on speed
        float frequency = 3.0;
        float wavelength = 0.8;

        // Phase propagates backward (wave travels toward tail)
        // FIXED: Use mod() to keep phase bounded and prevent numerical issues
        float boundedSwimPhase = mod(swimPhase, 6.28318);
        float phase = (positionAlongBody / wavelength) * 6.28318 - boundedSwimPhase * frequency;

        // Lateral (side-to-side) displacement
        // FIXED: Clamp the edge falloff to [0, 1] to prevent negative values
        float edgeFalloff = clamp(1.0 - abs(pos.y) * 2.0, 0.0, 1.0);
        float lateralDisplacement = sin(phase) * amplitude * edgeFalloff;
        // FIXED: Clamp final displacement to safe range
        pos.z += clamp(lateralDisplacement, -0.15, 0.15);

        // Recalculate normal for animated surface
        float dPhase = cos(phase) * amplitude * edgeFalloff;
        // FIXED: Limit normal perturbation to prevent extreme values
        dPhase = clamp(dPhase, -0.1, 0.1);
        vec3 animatedNormal = normalize(normal + vec3(-dPhase * 0.2, 0.0, dPhase * 0.5));

        // Calculate world position with instancing support
        #ifdef USE_INSTANCING
          mat4 instanceModelMatrix = modelMatrix * instanceMatrix;
          mat3 instanceNormalMatrix = mat3(instanceModelMatrix);
          vNormal = normalize(instanceNormalMatrix * animatedNormal);
          vec4 worldPosition = instanceModelMatrix * vec4(pos, 1.0);
        #else
          vNormal = normalize(normalMatrix * animatedNormal);
          vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        #endif

        vWorldPosition = worldPosition.xyz;
        vDepth = max(0.0, -worldPosition.y);

        // Also update tangent space for instancing
        vec3 c1 = cross(animatedNormal, vec3(0.0, 0.0, 1.0));
        vec3 c2 = cross(animatedNormal, vec3(0.0, 1.0, 0.0));
        vec3 tangent = length(c1) > length(c2) ? c1 : c2;
        #ifdef USE_INSTANCING
          vTangent = normalize(instanceNormalMatrix * tangent);
        #else
          vTangent = normalize(normalMatrix * tangent);
        #endif
        vBitangent = normalize(cross(vNormal, vTangent));

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 baseColor;
      uniform vec3 iridescenceColor;
      uniform float metallic;
      uniform float roughness;
      uniform float clearcoat;
      uniform float clearcoatRoughness;
      
      uniform float scaleSize;
      uniform float scaleDepth;
      uniform float scaleVariation;
      
      uniform vec3 sunDirection;
      uniform vec3 absorptionCoeff;
      uniform vec3 deepColor;
      uniform float fogDensity;
      uniform float time;
      
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying float vDepth;
      varying vec3 vColor;
      varying vec3 vTangent;
      varying vec3 vBitangent;
      
      #define PI 3.14159265359
      
      // Hash functions for procedural patterns
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      
      vec2 hash2(vec2 p) {
        return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
      }
      
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
      
      // Voronoi-based scale pattern (more realistic than circles)
      vec4 scalePattern(vec2 uv) {
        vec2 scaledUv = uv * scaleSize;
        vec2 cellId = floor(scaledUv);
        vec2 cellUv = fract(scaledUv);
        
        float minDist = 1.0;
        vec2 closestPoint = vec2(0.0);
        
        // Check 3x3 neighborhood for closest Voronoi point
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 neighborCell = cellId + neighbor;
            vec2 point = hash2(neighborCell);
            vec2 diff = neighbor + point - cellUv;
            float dist = length(diff);
            
            if (dist < minDist) {
              minDist = dist;
              closestPoint = point;
            }
          }
        }
        
        // Scale edge (sharp transition)
        float scaleEdge = smoothstep(0.25, 0.28, minDist);
        
        // Per-scale variation
        float scaleVariationValue = hash(cellId + closestPoint) * scaleVariation;
        
        // Scale depth (for normal mapping)
        float scaleNormalStrength = (1.0 - scaleEdge) * scaleDepth;
        
        // Scale center direction (for normal perturbation)
        vec2 toCenter = closestPoint - cellUv;
        
        return vec4(scaleEdge, scaleVariationValue, toCenter.x * scaleNormalStrength, toCenter.y * scaleNormalStrength);
      }
      
      // PBR Functions
      
      // Fresnel-Schlick
      vec3 fresnelSchlick(float cosTheta, vec3 F0) {
        return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
      }
      
      // Distribution GGX
      float distributionGGX(vec3 N, vec3 H, float roughness) {
        float a = roughness * roughness;
        float a2 = a * a;
        float NdotH = max(dot(N, H), 0.0);
        float NdotH2 = NdotH * NdotH;
        
        float num = a2;
        float denom = (NdotH2 * (a2 - 1.0) + 1.0);
        denom = PI * denom * denom;
        
        return num / denom;
      }
      
      // Geometry Smith
      float geometrySchlickGGX(float NdotV, float roughness) {
        float r = (roughness + 1.0);
        float k = (r * r) / 8.0;
        
        float num = NdotV;
        float denom = NdotV * (1.0 - k) + k;
        
        return num / denom;
      }
      
      float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
        float NdotV = max(dot(N, V), 0.0);
        float NdotL = max(dot(N, L), 0.0);
        float ggx2 = geometrySchlickGGX(NdotV, roughness);
        float ggx1 = geometrySchlickGGX(NdotL, roughness);
        
        return ggx1 * ggx2;
      }
      
      // Subsurface scattering approximation for thin parts (fins)
      vec3 subsurfaceScattering(vec3 L, vec3 V, vec3 N, vec3 thickness, vec3 sssColor) {
        vec3 H = normalize(L + N * 0.5); // Offset normal for scattering
        float sss = pow(clamp(dot(V, -H), 0.0, 1.0), 4.0);
        return sssColor * sss * thickness;
      }
      
      // Iridescence (angle-dependent color shift from guanine crystals)
      vec3 iridescence(vec3 viewDir, vec3 normal, vec3 baseIridColor) {
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
        
        // Color shift based on angle
        float angle = dot(viewDir, normal);
        vec3 colorShift = vec3(
          sin(angle * PI * 2.0 + 0.0) * 0.5 + 0.5,
          sin(angle * PI * 2.0 + 2.09) * 0.5 + 0.5,
          sin(angle * PI * 2.0 + 4.18) * 0.5 + 0.5
        );
        
        return baseIridColor * colorShift * fresnel * 0.6;
      }
      
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        
        // Generate scale pattern
        vec2 scaleUV = vUv * 5.0 + vWorldPosition.xz * 0.1;
        vec4 scaleData = scalePattern(scaleUV);
        float scaleValue = scaleData.x;
        float scaleVar = scaleData.y;
        vec2 scaleNormalOffset = scaleData.zw;
        
        // Perturb normal with scale embossing
        vec3 perturbedNormal = normal + vTangent * scaleNormalOffset.x + vBitangent * scaleNormalOffset.y;
        perturbedNormal = normalize(perturbedNormal);
        
        // Base color: use vColor (which includes instance color) with scale variation
        // vColor already includes instance color modulated by vertex color countershading
        vec3 albedo = vColor * (1.0 - scaleVar * 0.2); // Reduced variation for brighter colors
        
        // Add scale color variation (darker in crevices)
        albedo = mix(albedo * 0.7, albedo * 1.2, scaleValue);
        
        // Iridescent highlights
        vec3 iridColor = iridescence(viewDir, perturbedNormal, iridescenceColor);
        albedo += iridColor * scaleValue * 0.5;
        
        // PBR Lighting
        vec3 L = normalize(sunDirection);
        vec3 H = normalize(viewDir + L);
        
        float NdotL = max(dot(perturbedNormal, L), 0.0);
        float NdotV = max(dot(perturbedNormal, viewDir), 0.0);
        
        // Calculate reflectance at normal incidence
        vec3 F0 = vec3(0.04); // Non-metal base reflectance
        F0 = mix(F0, albedo, metallic);
        
        // Cook-Torrance BRDF
        vec3 F = fresnelSchlick(max(dot(H, viewDir), 0.0), F0);
        float NDF = distributionGGX(perturbedNormal, H, roughness);
        float G = geometrySmith(perturbedNormal, viewDir, L, roughness);
        
        vec3 numerator = NDF * G * F;
        float denominator = 4.0 * NdotV * NdotL + 0.001;
        vec3 specular = numerator / denominator;
        
        // Energy conservation
        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;
        kD *= 1.0 - metallic;
        
        // Diffuse with wrapped lighting for soft underwater look
        float wrapFactor = 0.5;
        float diffuseWrap = max((dot(perturbedNormal, L) + wrapFactor) / (1.0 + wrapFactor), 0.0);
        vec3 diffuse = kD * albedo / PI * diffuseWrap;
        
        // Ambient lighting - brighter for better visibility
        vec3 ambient = albedo * vec3(0.5, 0.6, 0.7) * 0.8;
        
        // Subsurface scattering (for fins and thin areas)
        float thickness = smoothstep(0.8, 1.0, vColor.r); // Use vertex color as thickness
        vec3 sss = subsurfaceScattering(L, viewDir, perturbedNormal, vec3(thickness), vec3(1.0, 0.7, 0.5)) * 0.4;
        
        // Combine lighting
        vec3 Lo = (diffuse + specular) * NdotL * vec3(1.0, 0.95, 0.9) + ambient + sss;
        
        // Clearcoat (mucus layer)
        vec3 clearcoatF = fresnelSchlick(NdotV, vec3(0.04));
        float clearcoatNDF = distributionGGX(normal, H, clearcoatRoughness);
        float clearcoatG = geometrySmith(normal, viewDir, L, clearcoatRoughness);
        vec3 clearcoatSpec = (clearcoatNDF * clearcoatG * clearcoatF) / (4.0 * NdotV * NdotL + 0.001);
        Lo += clearcoatSpec * clearcoat * NdotL;
        
        // Rim lighting for depth
        float rim = pow(1.0 - NdotV, 4.0);
        Lo += vec3(0.3, 0.5, 0.7) * rim * 0.3;
        
        // Wavelength-dependent absorption (Beer-Lambert Law) - proper absorption
        vec3 transmission = exp(-absorptionCoeff * vDepth);
        vec3 absorbedColor = Lo * transmission;

        // Distance fog - gradual increase with depth
        float fogAmount = 1.0 - exp(-fogDensity * vDepth * 0.3);
        fogAmount = min(fogAmount, 0.6) * smoothstep(5.0, 30.0, vDepth); // Gradual fog increase with depth
        vec3 finalColor = mix(absorbedColor, deepColor, fogAmount);
        
        // Subtle animated shimmer on scales
        float shimmer = sin(time * 2.0 + vWorldPosition.x * 10.0 + vWorldPosition.z * 10.0) * 0.5 + 0.5;
        finalColor += iridColor * shimmer * scaleValue * 0.1;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    side: THREE.DoubleSide,
    vertexColors: true,
    transparent: false
  });
}

/**
 * Get species-specific material parameters
 */
export function getSpeciesMaterialParams(species: string): {
  baseColor: THREE.Color;
  iridescenceColor: THREE.Color;
  metallic: number;
  roughness: number;
} {
  const params: Record<string, any> = {
    tropical: {
      baseColor: new THREE.Color(0xff7722), // Bright orange/yellow
      iridescenceColor: new THREE.Color(0x44aaff), // Blue iridescence
      metallic: 0.6,
      roughness: 0.15
    },
    tuna: {
      baseColor: new THREE.Color(0x557788), // Dark blue-gray
      iridescenceColor: new THREE.Color(0xaaddff), // Silver-blue
      metallic: 0.8, // Very metallic appearance
      roughness: 0.1
    },
    bass: {
      baseColor: new THREE.Color(0x667744), // Greenish-brown
      iridescenceColor: new THREE.Color(0x88aa66), // Green shimmer
      metallic: 0.4,
      roughness: 0.25
    },
    generic: {
      baseColor: new THREE.Color(0xff8844),
      iridescenceColor: new THREE.Color(0xffd700),
      metallic: 0.5,
      roughness: 0.2
    }
  };

  return params[species] || params.generic;
}

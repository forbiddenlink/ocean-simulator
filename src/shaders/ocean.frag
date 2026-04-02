/**
 * Ocean Surface Fragment Shader
 *
 * Implements physically-based ocean rendering with:
 * - Cook-Torrance BRDF for specular reflection
 * - Fresnel effect (Schlick approximation)
 * - Subsurface scattering
 * - Foam rendering
 * - Snell's window for underwater view
 */

// Uniforms - Water properties
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform vec3 waterColor;
uniform float opacity;

// Uniforms - Fresnel
uniform float fresnelBias;
uniform float fresnelScale;
uniform float fresnelPower;

// Uniforms - Lighting
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform float sunIntensity;
uniform vec3 ambientColor;
uniform float ambientIntensity;

// Uniforms - Environment
uniform samplerCube envMap;
uniform float envMapIntensity;
uniform float reflectivity;

// Uniforms - Foam
uniform sampler2D foamTexture;
uniform vec3 foamColor;
uniform float foamScale;
uniform float foamIntensity;

// Uniforms - Time and effects
uniform float time;

// Varyings
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;
varying vec2 vUv;
varying vec3 vViewDirection;
varying float vHeight;
varying float vFoamFactor;

// Constants
const float PI = 3.14159265359;
const float IOR_WATER = 1.333;
const float IOR_AIR = 1.0;

// Absorption coefficients (per meter)
const vec3 ABSORPTION = vec3(0.45, 0.15, 0.05);

/**
 * Fresnel-Schlick approximation
 */
float fresnelSchlick(float cosTheta, float F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

/**
 * Water Fresnel (dielectric)
 */
float fresnelWater(vec3 viewDir, vec3 normal) {
  float F0 = pow((IOR_AIR - IOR_WATER) / (IOR_AIR + IOR_WATER), 2.0);
  float cosTheta = max(dot(viewDir, normal), 0.0);
  return fresnelSchlick(cosTheta, F0);
}

/**
 * GGX/Trowbridge-Reitz Normal Distribution Function
 */
float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;

  float nom = a2;
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;

  return nom / max(denom, 0.0001);
}

/**
 * Smith's Schlick-GGX Geometry Function
 */
float geometrySchlickGGX(float NdotV, float roughness) {
  float r = (roughness + 1.0);
  float k = (r * r) / 8.0;

  float nom = NdotV;
  float denom = NdotV * (1.0 - k) + k;

  return nom / denom;
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float ggx2 = geometrySchlickGGX(NdotV, roughness);
  float ggx1 = geometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}

/**
 * Subsurface scattering approximation
 */
vec3 subsurfaceScattering(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 color) {
  // Forward scatter
  float forwardScatter = pow(max(0.0, dot(viewDir, -lightDir)), 6.0);
  // Back scatter
  float backScatter = pow(max(0.0, dot(normal, lightDir)), 3.0) * 0.3;
  // Wavelength-dependent scatter
  vec3 scatterColor = color * vec3(0.6, 0.85, 1.0);
  return scatterColor * (forwardScatter * 0.6 + backScatter);
}

/**
 * Beer-Lambert absorption
 */
vec3 applyAbsorption(vec3 color, float depth) {
  depth = max(depth, 0.0);
  vec3 transmission = exp(-ABSORPTION * depth);
  return color * transmission;
}

/**
 * Foam pattern with noise
 */
float foamPattern(vec2 uv, float time) {
  vec2 uv1 = uv + vec2(time * 0.05, time * 0.03);
  vec2 uv2 = uv * 1.5 - vec2(time * 0.04, -time * 0.05);

  float foam1 = texture2D(foamTexture, uv1).r;
  float foam2 = texture2D(foamTexture, uv2).r;

  return (foam1 + foam2) * 0.5;
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDirection);
  vec3 L = normalize(sunDirection);
  vec3 H = normalize(V + L);

  // Check if viewing from underwater (back face)
  if (!gl_FrontFacing) {
    // Snell's window rendering
    vec3 Nb = -N;
    float cosViewAngle = max(dot(V, Nb), 0.0);

    // Critical angle for total internal reflection
    float criticalCos = 0.6614; // cos(48.6 degrees)

    // Smooth window edge
    float windowEdge = smoothstep(criticalCos - 0.08, criticalCos + 0.08, cosViewAngle);

    // Rippling distortion
    float ripple = sin(vWorldPosition.x * 3.0 + time * 1.5) * 0.02
                 + sin(vWorldPosition.z * 4.0 + time * 1.2) * 0.015;
    windowEdge = smoothstep(criticalCos - 0.08 + ripple, criticalCos + 0.08 + ripple, cosViewAngle);

    // Sky through window
    vec3 skyThroughWater = vec3(0.35, 0.6, 0.85) * (0.6 + 0.4 * cosViewAngle);
    float sunDot = max(dot(V, L), 0.0);
    vec3 sunGlare = vec3(1.0, 0.95, 0.85) * pow(sunDot, 64.0) * 2.0;
    skyThroughWater += sunGlare;

    // Total internal reflection color
    vec3 tirColor = vec3(0.04, 0.12, 0.18);
    float tirReflection = pow(max(dot(reflect(-V, Nb), L), 0.0), 12.0);
    tirColor += vec3(0.05, 0.1, 0.15) * tirReflection;

    // Blend window and TIR
    vec3 belowColor = mix(tirColor, skyThroughWater, windowEdge);

    // Fresnel rim brightening
    float rimFresnel = pow(1.0 - cosViewAngle, 3.0) * 0.3;
    belowColor += vec3(0.1, 0.2, 0.3) * rimFresnel;

    // Distance fog
    float dist = length(vWorldPosition - cameraPosition);
    float fogF = exp(-dist * 0.002);
    vec3 underwaterFog = vec3(0.04, 0.10, 0.18);
    belowColor = mix(underwaterFog, belowColor, fogF);

    gl_FragColor = vec4(belowColor, 0.95);
    return;
  }

  // Above-water rendering

  // Dynamic roughness based on wave height
  float waveRoughness = 0.02 + abs(vHeight) * 0.05;
  waveRoughness = clamp(waveRoughness, 0.01, 0.3);

  // Fresnel
  float fresnel = fresnelWater(V, N);

  // Cook-Torrance BRDF
  float NDF = distributionGGX(N, H, waveRoughness);
  float G = geometrySmith(N, V, L, waveRoughness);

  vec3 nominator = vec3(NDF * G * fresnel);
  float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
  vec3 specular = nominator / max(denominator, 0.001);

  float NdotL = max(dot(N, L), 0.0);

  // Water color based on depth
  float depth = abs(vHeight) + 2.0;
  vec3 baseColor = mix(shallowColor, deepColor, smoothstep(0.0, 8.0, depth));
  vec3 absorbedColor = applyAbsorption(baseColor, depth);

  // Ambient occlusion from wave troughs
  float ao = smoothstep(-1.5, 0.5, vHeight);
  vec3 diffuse = absorbedColor * waterColor * (0.15 + 0.85 * NdotL) * (0.7 + 0.3 * ao);

  // Subsurface scattering
  float crestFactor = smoothstep(0.0, 1.5, vHeight);
  vec3 sss = subsurfaceScattering(L, V, N, shallowColor) * (0.35 + crestFactor * 0.4);

  // Specular
  vec3 specColor = sunColor * specular * sunIntensity * 1.2;

  // Foam
  vec2 foamUv = vWorldPosition.xz * foamScale * 0.01;
  float foamNoise = foamPattern(foamUv, time);
  float foam = vFoamFactor * foamNoise;
  foam = smoothstep(0.2, 0.8, foam);
  vec3 foamContrib = foamColor * foam * foamIntensity;

  // Sky reflection
  vec3 skyColorUp = vec3(0.55, 0.75, 0.95);
  vec3 skyColorHoriz = vec3(0.25, 0.45, 0.7);
  vec3 skyColor = mix(skyColorHoriz, skyColorUp, max(N.y, 0.0));
  vec3 reflection = skyColor * fresnel;

  // Environment map reflection (if available)
  #ifdef USE_ENVMAP
    vec3 reflectDir = reflect(-V, N);
    vec3 envColor = textureCube(envMap, reflectDir).rgb;
    reflection = mix(reflection, envColor * envMapIntensity, fresnel);
  #endif

  // Combine
  vec3 finalColor = diffuse + specColor + sss + reflection * 0.6 + foamContrib;

  // Atmospheric perspective
  float distance = length(vWorldPosition - cameraPosition);
  float fogFactor = exp(-distance * 0.0012);
  vec3 fogColor = mix(vec3(0.08, 0.22, 0.38), vec3(0.4, 0.6, 0.8), 0.3);
  finalColor = mix(fogColor, finalColor, fogFactor);

  // Alpha
  float alpha = mix(0.85, 0.99, fresnel);
  alpha = mix(alpha, 0.96, smoothstep(0.0, 5.0, depth));
  alpha = mix(alpha, 1.0, foam * 0.5);

  gl_FragColor = vec4(finalColor, alpha * opacity);
}

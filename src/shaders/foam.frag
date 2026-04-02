/**
 * Foam Rendering Fragment Shader
 *
 * Renders ocean foam with:
 * - Multi-layered noise patterns
 * - Wave crest detection
 * - Animated bubble patterns
 * - Depth-based fading
 */

uniform float time;
uniform vec3 foamColor;
uniform float foamIntensity;
uniform float foamScale;
uniform float foamSpeed;
uniform float crestThreshold;
uniform sampler2D foamNoiseTexture;
uniform sampler2D waveHeightMap;
uniform float oceanSize;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vHeight;

// Constants
const float PI = 3.14159265359;

/**
 * Hash function for procedural noise
 */
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

/**
 * 2D noise function
 */
float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

/**
 * Fractal Brownian Motion (multi-octave noise)
 */
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * noise2D(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  return value;
}

/**
 * Voronoi-based bubble pattern
 */
float voronoiBubbles(vec2 p) {
  vec2 ip = floor(p);
  vec2 fp = fract(p);

  float minDist = 1.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash(ip + neighbor) * vec2(0.8) + vec2(0.1);
      vec2 diff = neighbor + point - fp;
      float dist = length(diff);
      minDist = min(minDist, dist);
    }
  }

  // Create bubble edges
  float bubbles = smoothstep(0.0, 0.4, minDist);
  return 1.0 - bubbles;
}

/**
 * Animated foam pattern combining multiple techniques
 */
float foamPattern(vec2 uv, float time) {
  // Layer 1: Large slow-moving foam patches
  vec2 uv1 = uv + vec2(time * foamSpeed * 0.3, time * foamSpeed * 0.2);
  float foam1 = fbm(uv1 * foamScale, 4);

  // Layer 2: Medium patterns moving opposite direction
  vec2 uv2 = uv * 1.5 - vec2(time * foamSpeed * 0.4, -time * foamSpeed * 0.3);
  float foam2 = fbm(uv2 * foamScale * 0.8, 3);

  // Layer 3: Small bubble detail
  vec2 uv3 = uv * 2.5 + vec2(-time * foamSpeed * 0.2, time * foamSpeed * 0.25);
  float foam3 = voronoiBubbles(uv3 * foamScale * 1.5 + time * 0.5);

  // Combine layers
  float foam = foam1 * 0.5 + foam2 * 0.3 + foam3 * 0.2;

  // Sharpen foam edges
  foam = smoothstep(crestThreshold, crestThreshold + 0.2, foam);

  return foam;
}

/**
 * Wave crest detection from height field
 */
float waveCrestMask(vec2 worldPos, float time) {
  // Sample wave height from texture if available
  #ifdef USE_HEIGHT_MAP
    vec2 heightUv = worldPos / oceanSize + 0.5;
    float height = texture2D(waveHeightMap, heightUv).r;
    return smoothstep(crestThreshold, crestThreshold + 0.5, height);
  #else
    // Procedural wave pattern fallback
    vec2 wavePos1 = worldPos * 0.05 + vec2(time * 0.3, time * 0.2);
    vec2 wavePos2 = worldPos * 0.08 - vec2(time * 0.25, -time * 0.3);

    float wave1 = sin(wavePos1.x * 2.0 + wavePos1.y * 1.5) * 0.5 + 0.5;
    float wave2 = sin(wavePos2.x * 1.8 - wavePos2.y * 2.2) * 0.5 + 0.5;

    float waveHeight = (wave1 + wave2) * 0.5;
    return smoothstep(0.6, 0.8, waveHeight);
  #endif
}

/**
 * Breaking wave foam (steeper gradient = more foam)
 */
float breakingWaveFoam(vec2 worldPos, float time) {
  // Simulate wave steepness with directional derivative
  float dx = 0.1;
  float h1 = sin(worldPos.x * 0.2 + time);
  float h2 = sin((worldPos.x + dx) * 0.2 + time);
  float slope = abs(h2 - h1) / dx;

  return smoothstep(0.3, 1.0, slope);
}

void main() {
  vec2 foamUv = vWorldPosition.xz * foamScale * 0.01;

  // Generate foam pattern
  float foam = foamPattern(foamUv, time);

  // Apply wave crest mask
  float crestMask = waveCrestMask(vWorldPosition.xz, time);

  // Add breaking wave foam
  float breaking = breakingWaveFoam(vWorldPosition.xz, time);

  // Combine foam sources
  float totalFoam = max(foam * crestMask, breaking * 0.5);

  // Height-based foam (vertex-provided)
  totalFoam = max(totalFoam, smoothstep(0.8, 1.5, vHeight));

  // Foam color with intensity
  vec3 color = foamColor * totalFoam * foamIntensity;

  // Add slight iridescence at edges
  float edge = smoothstep(0.3, 0.5, totalFoam) - smoothstep(0.5, 0.7, totalFoam);
  color += vec3(0.1, 0.15, 0.2) * edge;

  // Alpha for transparency
  float alpha = totalFoam * 0.9;

  // Discard nearly invisible pixels
  if (alpha < 0.02) discard;

  // Soft edges
  alpha = smoothstep(0.0, 0.1, alpha);

  gl_FragColor = vec4(color, alpha);
}

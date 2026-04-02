/**
 * Ocean Surface Vertex Shader
 *
 * Implements FFT displacement + Gerstner waves for realistic ocean surface.
 * Outputs data for PBR fragment shader including:
 * - Displaced position
 * - Surface normal
 * - Tangent space basis
 * - Foam parameters
 */

// Uniforms
uniform float time;
uniform sampler2D heightMap;
uniform sampler2D displacementMap;
uniform sampler2D normalMap;
uniform float oceanSize;
uniform float choppiness;

// Gerstner wave uniforms
uniform vec4 waveParams[8]; // x=wavelength, y=amplitude, z=speed, w=steepness
uniform vec2 waveDirections[8];
uniform int waveCount;

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
const float GRAVITY = 9.81;

/**
 * Evaluate a single Gerstner wave
 * Returns: vec4(dx, dy, dz, foamContribution)
 */
vec4 gerstnerWave(
  vec3 position,
  float wavelength,
  float amplitude,
  float speed,
  float steepness,
  vec2 direction,
  float time
) {
  float k = 2.0 * PI / wavelength;
  float c = speed;
  vec2 d = normalize(direction);

  float f = k * (dot(d, position.xz) - c * time);
  float a = amplitude;
  float s = steepness;

  // Gerstner displacement
  float cosF = cos(f);
  float sinF = sin(f);

  vec3 displacement;
  displacement.x = d.x * a * s * cosF;
  displacement.y = a * sinF;
  displacement.z = d.y * a * s * cosF;

  // Foam contribution based on wave steepness
  float foam = max(0.0, sinF * steepness);

  return vec4(displacement, foam);
}

/**
 * Calculate Gerstner wave normal contribution
 */
vec3 gerstnerNormal(
  vec3 position,
  float wavelength,
  float amplitude,
  float speed,
  float steepness,
  vec2 direction,
  float time
) {
  float k = 2.0 * PI / wavelength;
  float c = speed;
  vec2 d = normalize(direction);

  float f = k * (dot(d, position.xz) - c * time);
  float a = amplitude;

  float cosF = cos(f);

  // Partial derivatives for normal
  float dhdx = d.x * k * a * cosF;
  float dhdz = d.y * k * a * cosF;

  return vec3(-dhdx, 0.0, -dhdz);
}

void main() {
  vUv = uv;

  // Start with original position
  vec3 displacedPosition = position;

  // Sample FFT data
  float fftHeight = texture2D(heightMap, uv).r;
  vec3 fftDisplacement = texture2D(displacementMap, uv).rgb;
  vec3 fftNormal = texture2D(normalMap, uv).rgb * 2.0 - 1.0;

  // Apply FFT displacement
  displacedPosition.y += fftHeight;
  displacedPosition.x += fftDisplacement.x * choppiness;
  displacedPosition.z += fftDisplacement.z * choppiness;

  // Accumulate Gerstner waves
  vec3 gerstnerOffset = vec3(0.0);
  vec3 normalContribution = vec3(0.0);
  float foamAccumulator = 0.0;

  for (int i = 0; i < 8; i++) {
    if (i >= waveCount) break;

    vec4 params = waveParams[i];
    vec2 dir = waveDirections[i];

    vec4 wave = gerstnerWave(
      displacedPosition,
      params.x,  // wavelength
      params.y,  // amplitude
      params.z,  // speed
      params.w,  // steepness
      dir,
      time
    );

    gerstnerOffset += wave.xyz;
    foamAccumulator += wave.w;

    normalContribution += gerstnerNormal(
      displacedPosition,
      params.x,
      params.y,
      params.z,
      params.w,
      dir,
      time
    );
  }

  // Apply Gerstner displacement
  displacedPosition += gerstnerOffset;

  // Calculate final normal
  vec3 baseNormal = normalize(fftNormal + normalContribution);
  vNormal = normalize(normalMatrix * baseNormal);

  // Calculate tangent space
  vec3 tangent = normalize(vec3(1.0, normalContribution.x, 0.0));
  vTangent = normalize(normalMatrix * tangent);
  vBitangent = normalize(cross(vNormal, vTangent));

  // World position
  vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
  vWorldPosition = worldPosition.xyz;

  // View direction
  vViewDirection = normalize(cameraPosition - worldPosition.xyz);

  // Height for fragment shader
  vHeight = displacedPosition.y;

  // Foam factor
  vFoamFactor = clamp(foamAccumulator + max(0.0, (fftHeight - 1.0) * 0.5), 0.0, 1.0);

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}

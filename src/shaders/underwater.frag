/**
 * Underwater Wavelength-Dependent Light Absorption Shader
 * Based on real underwater optics:
 * - Red light absorbed by 5m depth
 * - Yellow/green by 10-20m
 * - Only blue remains at 200m+
 */

uniform vec3 waterColor;
uniform float depth; // Camera depth in meters
uniform float turbidity; // Water clarity (0=clear, 1=murky)

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

// Wavelength absorption coefficients (per meter)
// Based on Jerlov water types
const vec3 absorptionCoeff = vec3(
  0.45,  // Red: absorbed quickly
  0.15,  // Green: moderate absorption
  0.04   // Blue: least absorbed
);

// Scattering coefficient
const float scatterCoeff = 0.01;

void main() {
  // Calculate distance from camera to fragment
  float dist = length(vPosition - cameraPosition);
  
  // Apply Beer-Lambert law for absorption
  // I(d) = I0 * exp(-k * d)
  vec3 absorption = exp(-absorptionCoeff * dist * (1.0 + turbidity * 0.5));
  
  // Calculate underwater fog/haze
  float fogFactor = 1.0 - exp(-scatterCoeff * dist);
  
  // Base color (from lighting)
  vec3 baseColor = vec3(0.4, 0.6, 0.8); // Light blue-green
  
  // Apply wavelength-dependent absorption
  vec3 underwaterColor = baseColor * absorption;
  
  // Mix with water color based on distance
  vec3 finalColor = mix(underwaterColor, waterColor, fogFactor);
  
  // Depth-based darkening
  float depthFactor = clamp(depth / 100.0, 0.0, 0.9);
  finalColor *= (1.0 - depthFactor);
  
  gl_FragColor = vec4(finalColor, 1.0);
}

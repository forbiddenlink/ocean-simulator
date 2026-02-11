// Caustics fragment shader - realistic underwater light patterns
uniform float time;
uniform vec3 sunDirection;
uniform vec3 waterColor;
uniform float causticsScale;
uniform float causticsIntensity;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vDepth;

// Procedural caustics using multiple overlapping sine waves
// Based on GPU Gems technique for water caustics
float caustics(vec2 uv, float time) {
  // Layer 1: Large slow-moving patterns
  vec2 uv1 = uv * 1.0 + vec2(time * 0.05, time * 0.03);
  float c1 = sin(uv1.x * 10.0) * sin(uv1.y * 10.0);
  
  // Layer 2: Medium patterns moving different direction
  vec2 uv2 = uv * 1.5 + vec2(time * -0.04, time * 0.06);
  float c2 = sin(uv2.x * 15.0) * sin(uv2.y * 15.0);
  
  // Layer 3: Fine detail
  vec2 uv3 = uv * 2.5 + vec2(time * 0.03, time * -0.05);
  float c3 = sin(uv3.x * 25.0) * sin(uv3.y * 25.0);
  
  // Combine layers with different weights
  float caustic = c1 * 0.5 + c2 * 0.3 + c3 * 0.2;
  
  // Enhance contrast (caustics are bright spots)
  caustic = pow(max(caustic, 0.0), 0.7);
  
  return caustic;
}

// Better caustics using Voronoi cells for more realistic patterns
vec2 voronoiHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float voronoiCaustics(vec2 uv, float time) {
  vec2 p = uv * 8.0;
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  
  float minDist = 1.0;
  
  // Check neighboring cells
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cellPoint = voronoiHash(ip + neighbor);
      
      // Animate cell centers
      cellPoint = 0.5 + 0.5 * sin(time * 0.5 + 6.28 * cellPoint);
      
      vec2 diff = neighbor + cellPoint - fp;
      float dist = length(diff);
      
      minDist = min(minDist, dist);
    }
  }
  
  // Create bright caustic pattern from distance field
  float caustic = 1.0 - smoothstep(0.0, 0.4, minDist);
  caustic = pow(caustic, 3.0); // Sharp falloff
  
  return caustic;
}

void main() {
  // Calculate caustics based on world position
  vec2 causticsUv = vWorldPosition.xz * causticsScale;
  
  // Combine both caustic methods for richer pattern
  float c1 = caustics(causticsUv, time);
  float c2 = voronoiCaustics(causticsUv, time * 1.5);
  float causticsPattern = max(c1, c2 * 0.7);
  
  // Reduce caustics with depth (light doesn't penetrate as deep)
  float depthFalloff = exp(-vDepth * 0.05);
  causticsPattern *= depthFalloff;
  
  // Apply directional lighting
  float NdotL = max(dot(vNormal, sunDirection), 0.0);
  
  // Base underwater color
  vec3 baseColor = waterColor * (0.3 + 0.7 * NdotL);
  
  // Add caustics as light spots
  vec3 causticsColor = vec3(0.7, 0.95, 1.0) * causticsPattern * causticsIntensity;
  vec3 finalColor = baseColor + causticsColor;
  
  gl_FragColor = vec4(finalColor, 1.0);
}

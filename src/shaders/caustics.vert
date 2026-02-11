// Caustics vertex shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vDepth;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vDepth = abs(worldPosition.y);
  
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}

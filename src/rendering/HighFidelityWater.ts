import * as THREE from 'three';
import { Water } from 'three-stdlib';
import { TextureGenerator } from '../utils/TextureGenerator';

/**
 * High-fidelity water surface with advanced shaders
 */
export class HighFidelityWater {
    public mesh: THREE.Mesh;
    private water: Water;
    private causticsMaterial?: THREE.ShaderMaterial;
    private causticsPlane?: THREE.Mesh;

    constructor(scene: THREE.Scene, light: THREE.DirectionalLight) {
        const waterGeometry = new THREE.PlaneGeometry(10000, 10000, 512, 512);

        const waterNormals = TextureGenerator.generateWaterNormals(512);

        this.water = new Water(
            waterGeometry,
            {
                textureWidth: 1024, // Good detail
                textureHeight: 1024,
                waterNormals: waterNormals,
                sunDirection: light.position.clone().normalize(),
                sunColor: 0xffffff, // White sun
                waterColor: 0x1a5c8f, // Rich blue ocean color
                distortionScale: 3.0, // Gentle waves
                fog: scene.fog !== undefined,
                side: THREE.FrontSide, // Only render top side
                alpha: 0.85, // More opaque
            }
        );

        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = 0; // AT SEA LEVEL - surface is at y=0
        
        // Enhance water material for better realism
        const waterMaterial = this.water.material as THREE.ShaderMaterial;
        if (waterMaterial.uniforms) {
            // Adjust parameters for more realistic appearance
            waterMaterial.uniforms.size = { value: 1.5 };
            waterMaterial.uniforms.alpha = { value: 0.75 };
        }
        
        // Inject additional shader code for foam and enhanced realism
        this.enhanceWaterShader(waterMaterial);

        this.mesh = this.water;
        
        // Add caustics to ocean floor
        this.createCausticsPlane(scene);
    }

    /**
     * Create a plane below water that displays caustics patterns
     */
    private createCausticsPlane(scene: THREE.Scene): void {
        // Load shaders
        const causticsVertexShader = `
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
        `;

        const causticsFragmentShader = `
          uniform float time;
          uniform vec3 sunDirection;
          uniform vec3 waterColor;
          uniform float causticsScale;
          uniform float causticsIntensity;

          varying vec2 vUv;
          varying vec3 vWorldPosition;
          varying vec3 vNormal;
          varying float vDepth;

          // Voronoi-based caustics for realistic patterns
          vec2 voronoiHash(vec2 p) {
            p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
            return fract(sin(p) * 43758.5453);
          }

          float voronoiCaustics(vec2 uv, float time) {
            vec2 p = uv * 8.0;
            vec2 ip = floor(p);
            vec2 fp = fract(p);
            
            float minDist = 1.0;
            
            for (int y = -1; y <= 1; y++) {
              for (int x = -1; x <= 1; x++) {
                vec2 neighbor = vec2(float(x), float(y));
                vec2 cellPoint = voronoiHash(ip + neighbor);
                cellPoint = 0.5 + 0.5 * sin(time * 0.5 + 6.28 * cellPoint);
                vec2 diff = neighbor + cellPoint - fp;
                float dist = length(diff);
                minDist = min(minDist, dist);
              }
            }
            
            float caustic = 1.0 - smoothstep(0.0, 0.4, minDist);
            return pow(caustic, 3.0);
          }

          void main() {
            vec2 causticsUv = vWorldPosition.xz * causticsScale;
            float causticsPattern = voronoiCaustics(causticsUv, time * 1.5);
            
            // Reduce caustics with depth
            float depthFalloff = exp(-vDepth * 0.08);
            causticsPattern *= depthFalloff;
            
            // Apply directional lighting
            float NdotL = max(dot(vNormal, sunDirection), 0.0);
            vec3 baseColor = waterColor * (0.3 + 0.7 * NdotL);
            
            // Add caustics as light spots
            vec3 causticsColor = vec3(0.8, 0.9, 1.0) * causticsPattern * causticsIntensity;
            vec3 finalColor = baseColor + causticsColor;
            
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `;

        this.causticsMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                sunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
                waterColor: { value: new THREE.Color(0x0a3050) },
                causticsScale: { value: 0.15 },
                causticsIntensity: { value: 1.2 },
            },
            vertexShader: causticsVertexShader,
            fragmentShader: causticsFragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
        });

        const causticsGeometry = new THREE.PlaneGeometry(200, 200);
        this.causticsPlane = new THREE.Mesh(causticsGeometry, this.causticsMaterial);
        this.causticsPlane.rotation.x = -Math.PI / 2;
        this.causticsPlane.position.y = -29.9; // Just above ocean floor
        this.causticsPlane.receiveShadow = true;
        scene.add(this.causticsPlane);
    }

    public update(deltaTime: number): void {
        // Update water animation
        if (this.water.material.uniforms['time']) {
            this.water.material.uniforms['time'].value += deltaTime * 0.3; // Slower, more realistic
        }
        
        // Update caustics animation
        if (this.causticsMaterial) {
            this.causticsMaterial.uniforms.time.value += deltaTime;
        }
    }

    /**
     * Update sun direction for both water and caustics
     */
    public updateSunDirection(direction: THREE.Vector3): void {
        if (this.water.material.uniforms['sunDirection']) {
            this.water.material.uniforms['sunDirection'].value.copy(direction).normalize();
        }
        if (this.causticsMaterial) {
            this.causticsMaterial.uniforms.sunDirection.value.copy(direction).normalize();
        }
    }
    
    /**
     * Enhance water shader with foam and better realism
     */
    private enhanceWaterShader(_waterMaterial: THREE.ShaderMaterial): void {
        // Foam enhancements could be added here if needed
        // Currently disabled due to shader variable conflicts
    }
}

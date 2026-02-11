import * as THREE from 'three';

/**
 * Animated seagrass and kelp that sways with ocean currents
 */
export class AnimatedSeagrass {
  private grasses: THREE.Mesh[] = [];
  private time: number = 0;
  
  constructor(scene: THREE.Scene, floorDepth: number, count: number = 200) {
    this.createSeagrassField(scene, floorDepth, count);
  }
  
  /**
   * Create a field of swaying seagrass
   */
  private createSeagrassField(scene: THREE.Scene, floorDepth: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      
      // Create different types of plants
      const type = Math.random();
      let grass: THREE.Mesh;
      
      if (type < 0.4) {
        grass = this.createTallSeagrass(x, floorDepth, z);
      } else if (type < 0.7) {
        grass = this.createShortSeagrass(x, floorDepth, z);
      } else {
        grass = this.createKelp(x, floorDepth, z);
      }
      
      this.grasses.push(grass);
      scene.add(grass);
    }
    
    console.log(`🌿 Created ${count} seagrass plants`);
  }
  
  /**
   * Create tall swaying seagrass
   */
  private createTallSeagrass(x: number, floorY: number, z: number): THREE.Mesh {
    const height = 2.0 + Math.random() * 2.0;
    const segments = 12;
    
    const geometry = this.createGrassGeometry(height, 0.05, segments);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        windStrength: { value: 0.3 + Math.random() * 0.2 },
        windSpeed: { value: 1.0 + Math.random() * 0.5 },
        phaseOffset: { value: Math.random() * Math.PI * 2 },
        grassColor: { value: new THREE.Color(0x1a5c3a) },
        tipColor: { value: new THREE.Color(0x2d8f5f) },
      },
      vertexShader: `
        uniform float time;
        uniform float windStrength;
        uniform float windSpeed;
        uniform float phaseOffset;
        
        varying vec3 vPosition;
        varying float vHeight;
        
        void main() {
          vPosition = position;
          vHeight = position.y;
          
          vec3 pos = position;
          
          // Sway based on height (more at the top)
          float heightFactor = smoothstep(0.0, 1.0, position.y);
          float sway = sin(time * windSpeed + phaseOffset + position.x * 0.5) * windStrength * heightFactor;
          float swayZ = cos(time * windSpeed * 0.8 + phaseOffset + position.z * 0.5) * windStrength * 0.7 * heightFactor;
          
          pos.x += sway;
          pos.z += swayZ;
          
          // Slight wave along the blade
          pos.x += sin(position.y * 3.0 + time * windSpeed * 2.0) * 0.05 * heightFactor;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 grassColor;
        uniform vec3 tipColor;
        
        varying vec3 vPosition;
        varying float vHeight;
        
        void main() {
          // Gradient from base to tip
          vec3 color = mix(grassColor, tipColor, smoothstep(0.0, 1.0, vHeight));
          
          // Add some variation
          float noise = fract(sin(dot(vPosition.xz, vec2(12.9898, 78.233))) * 43758.5453);
          color *= 0.9 + noise * 0.2;
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, floorY, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  /**
   * Create short bushy seagrass
   */
  private createShortSeagrass(x: number, floorY: number, z: number): THREE.Mesh {
    const height = 0.5 + Math.random() * 0.8;
    const segments = 8;
    
    const geometry = this.createGrassGeometry(height, 0.08, segments);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        windStrength: { value: 0.15 + Math.random() * 0.1 },
        windSpeed: { value: 1.5 + Math.random() * 0.5 },
        phaseOffset: { value: Math.random() * Math.PI * 2 },
        grassColor: { value: new THREE.Color(0x2a5c2a) },
        tipColor: { value: new THREE.Color(0x3d7d3d) },
      },
      vertexShader: `
        uniform float time;
        uniform float windStrength;
        uniform float windSpeed;
        uniform float phaseOffset;
        
        varying vec3 vPosition;
        varying float vHeight;
        
        void main() {
          vPosition = position;
          vHeight = position.y;
          
          vec3 pos = position;
          
          float heightFactor = pow(position.y, 2.0); // Quadratic for bushier look
          float sway = sin(time * windSpeed + phaseOffset) * windStrength * heightFactor;
          pos.x += sway;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 grassColor;
        uniform vec3 tipColor;
        
        varying vec3 vPosition;
        varying float vHeight;
        
        void main() {
          vec3 color = mix(grassColor, tipColor * 1.2, vHeight);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, floorY, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  /**
   * Create tall kelp
   */
  private createKelp(x: number, floorY: number, z: number): THREE.Mesh {
    const height = 2.0 + Math.random() * 2.0; // Reduced from 4-10 to 2-4 units
    const segments = 20;
    
    const geometry = this.createGrassGeometry(height, 0.15, segments);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        windStrength: { value: 0.5 + Math.random() * 0.3 },
        windSpeed: { value: 0.8 + Math.random() * 0.3 },
        phaseOffset: { value: Math.random() * Math.PI * 2 },
        grassColor: { value: new THREE.Color(0x4a3820) },
        tipColor: { value: new THREE.Color(0x6d5228) },
      },
      vertexShader: `
        uniform float time;
        uniform float windStrength;
        uniform float windSpeed;
        uniform float phaseOffset;
        
        varying vec3 vPosition;
        varying float vHeight;
        
        void main() {
          vPosition = position;
          vHeight = position.y;
          
          vec3 pos = position;
          
          // Complex swaying motion
          float heightFactor = smoothstep(0.0, 1.0, position.y);
          float wave1 = sin(time * windSpeed + phaseOffset + position.y * 0.5) * windStrength;
          float wave2 = cos(time * windSpeed * 1.3 + phaseOffset * 0.7 + position.y * 0.3) * windStrength * 0.7;
          
          pos.x += (wave1 + wave2) * heightFactor;
          pos.z += wave2 * 0.8 * heightFactor;
          
          // Spiral effect for kelp
          float spiral = sin(position.y * 2.0 + time * windSpeed) * 0.1 * heightFactor;
          pos.x += spiral;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 grassColor;
        uniform vec3 tipColor;
        
        varying vec3 vPosition;
        varying float vHeight;
        
        void main() {
          vec3 color = mix(grassColor, tipColor, vHeight * 0.7);
          
          // Add bulbs/air bladders to kelp
          float bulge = sin(vHeight * 12.0) * 0.5 + 0.5;
          if (bulge > 0.85) {
            color = mix(color, vec3(0.6, 0.5, 0.3), 0.5);
          }
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, floorY, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  /**
   * Create grass blade geometry
   */
  private createGrassGeometry(height: number, width: number, segments: number): THREE.BufferGeometry {
    const geometry = new THREE.PlaneGeometry(width, height, 1, segments);
    
    // Taper the blade toward the top
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const heightRatio = (y + height / 2) / height;
      const taper = 1.0 - heightRatio * 0.7;
      
      const x = positions.getX(i);
      positions.setX(i, x * taper);
    }
    
    // Shift base to origin
    geometry.translate(0, height / 2, 0);
    geometry.computeVertexNormals();
    
    return geometry;
  }
  
  /**
   * Update all seagrass animations
   */
  update(deltaTime: number): void {
    this.time += deltaTime * 0.001;
    
    for (const grass of this.grasses) {
      if (grass.material instanceof THREE.ShaderMaterial) {
        grass.material.uniforms.time.value = this.time;
      }
    }
  }
  
  /**
   * Dispose of all resources
   */
  dispose(): void {
    for (const grass of this.grasses) {
      grass.geometry.dispose();
      if (grass.material instanceof THREE.Material) {
        grass.material.dispose();
      }
    }
  }
}

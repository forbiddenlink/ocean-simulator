import * as THREE from 'three';

/**
 * Enhanced ocean floor with realistic textures and materials
 * Includes sandy bottom, rocky areas, and detailed terrain
 */
export class RealisticOceanFloor {
  
  /**
   * Create a detailed ocean floor with multiple terrain types
   */
  static createDetailedFloor(scene: THREE.Scene, depth: number): THREE.Group {
    const floorGroup = new THREE.Group();
    
    // Main sandy floor with height variation
    const sandFloor = this.createSandyFloor(depth);
    floorGroup.add(sandFloor);
    
    // Add rocky patches
    const rockyAreas = this.createRockyAreas(depth);
    floorGroup.add(rockyAreas);
    
    // Add sand ripples (smaller detail layer)
    const ripples = this.createSandRipples(depth);
    floorGroup.add(ripples);
    
    scene.add(floorGroup);
    
    return floorGroup;
  }
  
  /**
   * Create sandy floor with procedural detail
   */
  private static createSandyFloor(depth: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(200, 200, 128, 128);
    
    // Add procedural height variation
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      
      // Multi-scale noise for realistic terrain
      let height =
        Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.8 + // Large dunes
        Math.sin(x * 0.2 + z * 0.15) * 0.3 + // Medium variation
        Math.sin(x * 0.5) * Math.cos(z * 0.4) * 0.15; // Small bumps

      // Sand mound areas - 10 larger-scale bumps for height variation
      for (let m = 0; m < 10; m++) {
        const moundX = Math.sin(m * 7.3) * 80;
        const moundZ = Math.cos(m * 4.9) * 80;
        const dist = Math.sqrt((x - moundX) ** 2 + (z - moundZ) ** 2);
        const moundRadius = 10 + (m % 5) * 4;
        if (dist < moundRadius) {
          height += Math.cos((dist / moundRadius) * Math.PI * 0.5) * (1.0 + (m % 3) * 0.5);
        }
      }
      
      positions.setY(i, height);
    }
    geometry.computeVertexNormals();
    
    // Create realistic sand material with shader - DARK for deep underwater
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        sandColor1: { value: new THREE.Color(0x3a3830) }, // Dark sand (deep underwater)
        sandColor2: { value: new THREE.Color(0x2a2825) }, // Very dark wet sand
        rockColor: { value: new THREE.Color(0x353530) }, // Dark gray rocks
        detailScale: { value: 35.0 },
        lightDirection: { value: new THREE.Vector3(0.1, 1.0, 0.1).normalize() }, // From surface
        absorptionCoeffs: { value: new THREE.Vector3(0.5, 0.2, 0.08) }, // Stronger absorption
        waterDepth: { value: 30.0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        varying float vHeight;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vHeight = position.y;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sandColor1;
        uniform vec3 sandColor2;
        uniform vec3 rockColor;
        uniform float detailScale;
        uniform vec3 lightDirection;
        uniform float time;
        uniform vec3 absorptionCoeffs;
        uniform float waterDepth;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        varying float vHeight;
        
        // Hash for procedural noise
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
        
        // Fractal Brownian Motion
        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          
          for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
          }
          
          return value;
        }
        
        void main() {
          // Get sand grain detail
          float detail = fbm(vUv * detailScale);
          float coarseDetail = fbm(vUv * detailScale * 0.3);
          
          // Mix sand colors based on detail
          vec3 sandColor = mix(sandColor1, sandColor2, detail * 0.5 + 0.25);
          
          // Add slight height-based color variation
          sandColor = mix(sandColor, sandColor2, smoothstep(-0.5, 0.5, vHeight) * 0.3);
          
          // Add occasional rocks/shells
          float rockNoise = noise(vUv * 15.0 + vec2(123.4, 567.8));
          if (rockNoise > 0.92) {
            sandColor = mix(sandColor, rockColor, (rockNoise - 0.92) * 10.0);
          }
          
          // Add lighting - DARK for deep underwater (30m depth)
          float diffuse = max(dot(vNormal, lightDirection), 0.0);
          float ambient = 0.08; // Very low ambient for deep water
          vec3 litColor = sandColor * (ambient + 0.25 * diffuse); // Low diffuse

          // Apply strong Beer-Lambert wavelength-dependent absorption
          vec3 absorption = exp(-absorptionCoeffs * waterDepth * 1.5);
          litColor *= absorption;

          // Minimal specular
          vec3 viewDir = normalize(cameraPosition - vPosition);
          vec3 halfDir = normalize(lightDirection + viewDir);
          float spec = pow(max(dot(vNormal, halfDir), 0.0), 16.0) * 0.02;
          litColor += vec3(spec) * absorption;

          // Strong ambient occlusion in crevices
          float ao = smoothstep(-1.0, 1.0, vHeight);
          litColor *= 0.5 + 0.5 * ao;

          // Final darkening for deep underwater - clamp max brightness
          litColor = min(litColor, vec3(0.25)); // Never brighter than dark gray
          litColor *= 0.6; // Additional darkening

          gl_FragColor = vec4(litColor, 1.0);
        }
      `,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = depth;
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  /**
   * Create rocky patches scattered across the floor
   */
  private static createRockyAreas(depth: number): THREE.Group {
    const group = new THREE.Group();
    
    const rockGeometry = new THREE.DodecahedronGeometry(1, 1);
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a5a52, // Slightly brighter gray-brown
      roughness: 0.85,
      metalness: 0.1,
      emissive: new THREE.Color(0x1a1a18),
      emissiveIntensity: 0.3,
    });
    
    // Scatter rocks across the floor
    for (let i = 0; i < 120; i++) {
      const rock = new THREE.Mesh(rockGeometry, rockMaterial);

      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      // Mix of small and large rocks: ~20% chance of a large rock (3.0-5.0)
      const scale = Math.random() < 0.2
        ? 3.0 + Math.random() * 2.0
        : 0.5 + Math.random() * 2.0;
      
      rock.position.set(x, depth + scale * 0.5, z);
      rock.scale.set(scale, scale * 0.6, scale); // Flatter rocks
      rock.rotation.set(
        Math.random() * 0.5,
        Math.random() * Math.PI * 2,
        Math.random() * 0.5
      );
      
      rock.castShadow = true;
      rock.receiveShadow = true;
      
      group.add(rock);
    }
    
    return group;
  }
  
  /**
   * Create sand ripple patterns
   */
  private static createSandRipples(depth: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(200, 200, 256, 256);
    
    // Create ripple pattern
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      
      // Ripple pattern
      const ripple = Math.sin(x * 2.0) * 0.05 + Math.sin(z * 1.5 + x * 0.5) * 0.03;
      positions.setY(i, ripple);
    }
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x3a3830, // Very dark to match deep underwater sand
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = depth + 0.05; // Slightly above main floor
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  /**
   * Update animated floor elements
   */
  static update(floor: THREE.Mesh, deltaTime: number): void {
    if (floor.material instanceof THREE.ShaderMaterial) {
      if (floor.material.uniforms.time) {
        floor.material.uniforms.time.value += deltaTime * 0.001;
      }
    }
  }
}

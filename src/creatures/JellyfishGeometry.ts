import * as THREE from 'three';

/**
 * Procedural jellyfish geometry generator
 * Creates realistic jellyfish with bell, tentacles, and animation-ready structure
 */
export class JellyfishGeometry {
  /**
   * Create a procedurally generated jellyfish geometry
   * @param size - Diameter of the bell (default: 0.4m)
   * @param species - Type: 'moon', 'box', 'lion', 'crystal'
   */
  static create(size: number = 0.4, species: 'moon' | 'box' | 'lion' | 'crystal' = 'moon'): THREE.Group {
    const group = new THREE.Group();
    
    const proportions = this.getSpeciesProportions(species);
    const colors = this.getSpeciesColors(species);
    
    // Bell (main body)
    const bell = this.createBell(size, proportions, colors, species);
    group.add(bell);
    
    // Oral arms (feeding tentacles near mouth)
    const oralArms = this.createOralArms(size, proportions, colors);
    group.add(oralArms);
    
    // Trailing tentacles
    const tentacles = this.createTentacles(size, proportions, colors, species);
    group.add(tentacles);
    
    // Bioluminescence (for some species)
    if (species === 'crystal' || species === 'box') {
      const biolumPoints = this.createBioluminescence(size, colors);
      group.add(biolumPoints);
    }
    
    return group;
  }
  
  private static getSpeciesProportions(species: string): {
    bellHeight: number;
    bellRoundness: number;
    tentacleCount: number;
    tentacleLength: number;
    oralArmCount: number;
    transparency: number;
  } {
    switch (species) {
      case 'moon':
        return {
          bellHeight: 0.3,
          bellRoundness: 0.8,
          tentacleCount: 16,
          tentacleLength: 2.0,
          oralArmCount: 4,
          transparency: 0.7,
        };
      case 'box':
        return {
          bellHeight: 0.4,
          bellRoundness: 0.6,
          tentacleCount: 24,
          tentacleLength: 3.0,
          oralArmCount: 4,
          transparency: 0.8,
        };
      case 'lion':
        return {
          bellHeight: 0.5,
          bellRoundness: 0.7,
          tentacleCount: 32,
          tentacleLength: 4.0,
          oralArmCount: 8,
          transparency: 0.6,
        };
      case 'crystal':
        return {
          bellHeight: 0.25,
          bellRoundness: 0.9,
          tentacleCount: 12,
          tentacleLength: 1.5,
          oralArmCount: 4,
          transparency: 0.9,
        };
      default:
        return this.getSpeciesProportions('moon');
    }
  }

  private static getSpeciesColors(species: string): {
    bell: number;
    tentacle: number;
    biolum: number;
  } {
    switch (species) {
      case 'moon':
        return {
          bell: 0xc0d8e8,
          tentacle: 0xa0b8c8,
          biolum: 0x8080ff,
        };
      case 'box':
        return {
          bell: 0xa0c0ff,
          tentacle: 0x8090d0,
          biolum: 0x00ffff,
        };
      case 'lion':
        return {
          bell: 0xffa500,
          tentacle: 0xff8800,
          biolum: 0xff6600,
        };
      case 'crystal':
        return {
          bell: 0xe0f0ff,
          tentacle: 0xc0e0ff,
          biolum: 0x00ffff,
        };
      default:
        return this.getSpeciesColors('moon');
    }
  }
  
  private static createBell(size: number, proportions: any, colors: any, species: string): THREE.Mesh {
    // Create dome-shaped bell
    let geometry: THREE.BufferGeometry;
    
    if (species === 'box') {
      // Box jellyfish has more cubic bell
      geometry = new THREE.BoxGeometry(size, size * proportions.bellHeight, size);
      // Round the edges
      const positionAttribute = geometry.getAttribute('position');
      for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        const z = positionAttribute.getZ(i);
        const factor = 0.7;
        positionAttribute.setXYZ(
          i,
          x * factor,
          y,
          z * factor
        );
      }
      geometry.computeVertexNormals();
    } else {
      // Most jellyfish have dome-shaped bells
      geometry = new THREE.SphereGeometry(
        size / 2,
        32,
        32,
        0,
        Math.PI * 2,
        0,
        Math.PI * proportions.bellRoundness
      );
    }
    
    const material = new THREE.MeshPhysicalMaterial({
      color: colors.bell,
      transparent: true,
      opacity: proportions.transparency,
      roughness: 0.1,
      metalness: 0.0,
      transmission: 0.6,
      thickness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      ior: 1.4,
      side: THREE.DoubleSide,
    });
    
    const bell = new THREE.Mesh(geometry, material);
    return bell;
  }
  
  private static createOralArms(size: number, proportions: any, colors: any): THREE.Group {
    const group = new THREE.Group();
    const armCount = proportions.oralArmCount;
    const armLength = size * 0.8;
    const armWidth = size * 0.08;
    
    for (let i = 0; i < armCount; i++) {
      const angle = (i / armCount) * Math.PI * 2;
      
      // Create frilly oral arm
      const points: THREE.Vector3[] = [];
      const segments = 12;
      
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const x = Math.cos(angle) * size * 0.15;
        const y = -t * armLength;
        const z = Math.sin(angle) * size * 0.15;
        
        // Add wave to make it look frilly
        const wave = Math.sin(t * Math.PI * 4) * armWidth * 0.3;
        points.push(new THREE.Vector3(
          x + Math.cos(angle + Math.PI / 2) * wave,
          y,
          z + Math.sin(angle + Math.PI / 2) * wave
        ));
      }
      
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeometry = new THREE.TubeGeometry(curve, segments * 2, armWidth, 8, false);
      
      const material = new THREE.MeshPhysicalMaterial({
        color: colors.tentacle,
        transparent: true,
        opacity: 0.8,
        roughness: 0.3,
        metalness: 0.0,
      });
      
      const arm = new THREE.Mesh(tubeGeometry, material);
      group.add(arm);
    }
    
    return group;
  }
  
  private static createTentacles(size: number, proportions: any, colors: any, _species: string): THREE.Group {
    const group = new THREE.Group();
    const tentacleCount = proportions.tentacleCount;
    const tentacleLength = size * proportions.tentacleLength;
    
    for (let i = 0; i < tentacleCount; i++) {
      const angle = (i / tentacleCount) * Math.PI * 2;
      const radius = size * 0.4;
      
      // Create tentacle path with natural curve
      const points: THREE.Vector3[] = [];
      const segments = 20;
      
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        
        // Start at bell edge
        const startX = Math.cos(angle) * radius;
        const startZ = Math.sin(angle) * radius;
        
        // Hang down with slight wave
        const hangAngle = Math.PI / 6; // Angle from vertical
        const waveAmount = Math.sin(t * Math.PI * 3 + i * 0.5) * size * 0.1;
        
        const x = startX + Math.cos(angle) * t * tentacleLength * Math.sin(hangAngle) + waveAmount;
        const y = -t * tentacleLength * Math.cos(hangAngle);
        const z = startZ + Math.sin(angle) * t * tentacleLength * Math.sin(hangAngle);
        
        points.push(new THREE.Vector3(x, y, z));
      }
      
      const curve = new THREE.CatmullRomCurve3(points);
      
      // Tentacles taper toward the end
      const radiusFunction = (t: number) => {
        const baseRadius = size * 0.01;
        const tipRadius = size * 0.002;
        return THREE.MathUtils.lerp(baseRadius, tipRadius, t);
      };
      
      // Create tube with variable radius
      const tubeSegments = segments * 2;
      const radialSegments = 6;
      const tubeGeometry = new THREE.BufferGeometry();
      
      const vertices: number[] = [];
      const indices: number[] = [];
      const normals: number[] = [];
      
      const curvePoints = curve.getPoints(tubeSegments);
      
      for (let j = 0; j <= tubeSegments; j++) {
        const t = j / tubeSegments;
        const point = curvePoints[j];
        const tangent = curve.getTangent(t);
        const radius = radiusFunction(t);
        
        // Create perpendicular vectors
        const binormal = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3().crossVectors(tangent, binormal).normalize();
        binormal.crossVectors(normal, tangent).normalize();
        
        for (let k = 0; k <= radialSegments; k++) {
          const angle2 = (k / radialSegments) * Math.PI * 2;
          const cos = Math.cos(angle2);
          const sin = Math.sin(angle2);
          
          const vertex = new THREE.Vector3(
            point.x + (cos * normal.x + sin * binormal.x) * radius,
            point.y + (cos * normal.y + sin * binormal.y) * radius,
            point.z + (cos * normal.z + sin * binormal.z) * radius
          );
          
          vertices.push(vertex.x, vertex.y, vertex.z);
          
          const normalVec = new THREE.Vector3(
            cos * normal.x + sin * binormal.x,
            cos * normal.y + sin * binormal.y,
            cos * normal.z + sin * binormal.z
          );
          normals.push(normalVec.x, normalVec.y, normalVec.z);
        }
      }
      
      for (let j = 0; j < tubeSegments; j++) {
        for (let k = 0; k < radialSegments; k++) {
          const a = j * (radialSegments + 1) + k;
          const b = a + 1;
          const c = (j + 1) * (radialSegments + 1) + k + 1;
          const d = (j + 1) * (radialSegments + 1) + k;
          
          indices.push(a, b, c);
          indices.push(a, c, d);
        }
      }
      
      tubeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      tubeGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      tubeGeometry.setIndex(indices);
      
      const material = new THREE.MeshPhysicalMaterial({
        color: colors.tentacle,
        transparent: true,
        opacity: 0.7,
        roughness: 0.4,
        metalness: 0.0,
      });
      
      const tentacle = new THREE.Mesh(tubeGeometry, material);
      group.add(tentacle);
    }
    
    return group;
  }
  
  private static createBioluminescence(size: number, colors: any): THREE.Points {
    // Create glowing points for bioluminescent species
    const pointCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    
    for (let i = 0; i < pointCount; i++) {
      // Distribute points on bell surface
      const phi = Math.random() * Math.PI * 0.7;
      const theta = Math.random() * Math.PI * 2;
      
      const radius = size / 2;
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      
      positions.push(x, y, z);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: colors.biolum,
      size: size * 0.03,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    return new THREE.Points(geometry, material);
  }
}

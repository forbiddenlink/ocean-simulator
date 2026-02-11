import * as THREE from 'three';

/**
 * Procedural ray/manta geometry generator
 * Creates realistic rays and manta rays with proper wing structure
 */
export class RayGeometry {
  /**
   * Create a procedurally generated ray geometry
   * @param wingspan - Total wingspan (default: 2.0m)
   * @param species - Type: 'manta', 'eagle', 'stingray', 'electric'
   */
  static create(wingspan: number = 2.0, species: 'manta' | 'eagle' | 'stingray' | 'electric' = 'manta'): THREE.Group {
    const group = new THREE.Group();
    
    const proportions = this.getSpeciesProportions(species);
    const colors = this.getSpeciesColors(species);
    
    // Main body disc/wings
    const body = this.createBody(wingspan, proportions, colors, species);
    group.add(body);
    
    // Head with cephalic fins (for manta)
    if (species === 'manta') {
      const cephalicFins = this.createCephalicFins(wingspan, proportions, colors);
      group.add(cephalicFins);
    }
    
    // Tail
    const tail = this.createTail(wingspan, proportions, colors, species);
    group.add(tail);
    
    // Spots/patterns
    const patterns = this.createPatterns(wingspan, species, colors);
    if (patterns) group.add(patterns);
    
    return group;
  }
  
  private static getSpeciesProportions(species: string): {
    bodyLength: number;
    bodyThickness: number;
    wingCurve: number;
    tailLength: number;
    tailThickness: number;
    hasSpine: boolean;
    mouthWidth: number;
  } {
    switch (species) {
      case 'manta':
        return {
          bodyLength: 0.7,
          bodyThickness: 0.15,
          wingCurve: 0.3,
          tailLength: 2.0,
          tailThickness: 0.03,
          hasSpine: false,
          mouthWidth: 0.35,
        };
      case 'eagle':
        return {
          bodyLength: 0.5,
          bodyThickness: 0.12,
          wingCurve: 0.25,
          tailLength: 1.5,
          tailThickness: 0.02,
          hasSpine: true,
          mouthWidth: 0.20,
        };
      case 'stingray':
        return {
          bodyLength: 0.6,
          bodyThickness: 0.10,
          wingCurve: 0.20,
          tailLength: 1.8,
          tailThickness: 0.015,
          hasSpine: true,
          mouthWidth: 0.15,
        };
      case 'electric':
        return {
          bodyLength: 0.4,
          bodyThickness: 0.18,
          wingCurve: 0.15,
          tailLength: 0.8,
          tailThickness: 0.04,
          hasSpine: false,
          mouthWidth: 0.18,
        };
      default:
        return this.getSpeciesProportions('manta');
    }
  }

  private static getSpeciesColors(species: string): {
    dorsal: number;
    ventral: number;
    accent: number;
    pattern: number;
  } {
    switch (species) {
      case 'manta':
        return {
          dorsal: 0x2a3a4a,
          ventral: 0xf0f5fa,
          accent: 0x1a2a3a,
          pattern: 0x3a4a5a,
        };
      case 'eagle':
        return {
          dorsal: 0x4a3a2a,
          ventral: 0xe8e0d0,
          accent: 0x3a2a1a,
          pattern: 0xf0e8d8,
        };
      case 'stingray':
        return {
          dorsal: 0x8a7a6a,
          ventral: 0xd8d0c0,
          accent: 0x6a5a4a,
          pattern: 0x5a4a3a,
        };
      case 'electric':
        return {
          dorsal: 0x5a4a3a,
          ventral: 0xe0d8c8,
          accent: 0x4a3a2a,
          pattern: 0x3a2a1a,
        };
      default:
        return this.getSpeciesColors('manta');
    }
  }

  private static createBody(wingspan: number, proportions: any, colors: any, _species: string): THREE.Mesh {
    // Create wing-like body shape
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors_attr: number[] = [];
    
    const segmentsX = 32;
    const segmentsZ = 24;
    const bodyLength = wingspan * proportions.bodyLength;
    const bodyThickness = wingspan * proportions.bodyThickness;
    
    const dorsalColor = new THREE.Color(colors.dorsal);
    const ventralColor = new THREE.Color(colors.ventral);
    
    // Generate wing shape - diamond-like from top view
    for (let i = 0; i <= segmentsX; i++) {
      const u = i / segmentsX;
      const x = (u - 0.5) * bodyLength;
      
      for (let j = 0; j <= segmentsZ; j++) {
        const v = j / segmentsZ;
        
        // Wing width varies along body length
        let widthScale: number;
        if (u < 0.5) {
          widthScale = u * 2; // Widen toward center
        } else {
          widthScale = (1 - u) * 2; // Narrow toward tail
        }
        
        // Apply wing curve
        const wingCurve = Math.pow(widthScale, 1 + proportions.wingCurve);
        const z = (v - 0.5) * wingspan * wingCurve;
        
        // Thickness profile - thickest at center, thin at edges
        const edgeDistance = Math.abs(v - 0.5) * 2; // 0 at center, 1 at edge
        const centerDistance = Math.abs(u - 0.5) * 2; // 0 at center, 1 at end
        const thicknessScale = (1 - edgeDistance * 0.95) * (1 - centerDistance * 0.7);
        const y = thicknessScale * bodyThickness * (j < segmentsZ / 2 ? 1 : -1);
        
        vertices.push(x, y, z);
        
        // Normals will be computed
        normals.push(0, 1, 0);
        
        uvs.push(u, v);
        
        // Color - dorsal on top, ventral on bottom
        const finalColor = j < segmentsZ / 2 ? dorsalColor : ventralColor;
        colors_attr.push(finalColor.r, finalColor.g, finalColor.b);
      }
    }
    
    // Generate indices
    for (let i = 0; i < segmentsX; i++) {
      for (let j = 0; j < segmentsZ; j++) {
        const a = i * (segmentsZ + 1) + j;
        const b = i * (segmentsZ + 1) + j + 1;
        const c = (i + 1) * (segmentsZ + 1) + j + 1;
        const d = (i + 1) * (segmentsZ + 1) + j;
        
        indices.push(a, b, c);
        indices.push(a, c, d);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors_attr, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  private static createCephalicFins(wingspan: number, proportions: any, colors: any): THREE.Group {
    // Manta rays have distinctive cephalic fins (horn-like projections)
    const group = new THREE.Group();
    
    const finLength = wingspan * 0.15;
    const finWidth = wingspan * 0.05;
    
    // Left fin
    const finGeometry = new THREE.BoxGeometry(finLength, finWidth * 0.5, finWidth);
    const finMaterial = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.6,
      metalness: 0.0,
    });
    
    const leftFin = new THREE.Mesh(finGeometry, finMaterial);
    leftFin.position.set(
      wingspan * proportions.bodyLength * 0.35,
      0,
      wingspan * proportions.mouthWidth * 0.5
    );
    leftFin.rotation.y = Math.PI / 6;
    
    const rightFin = leftFin.clone();
    rightFin.position.z *= -1;
    rightFin.rotation.y *= -1;
    
    group.add(leftFin, rightFin);
    
    return group;
  }
  
  private static createTail(wingspan: number, proportions: any, colors: any, _species: string): THREE.Group {
    const group = new THREE.Group();
    
    const tailLength = wingspan * proportions.tailLength;
    const tailThickness = wingspan * proportions.tailThickness;
    
    // Create whip-like tail
    const points: THREE.Vector3[] = [];
    const segments = 30;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = -wingspan * proportions.bodyLength * 0.35 - t * tailLength;
      
      // Tail curves slightly
      const curve = Math.sin(t * Math.PI * 2) * tailLength * 0.05;
      const y = curve;
      const z = 0;
      
      points.push(new THREE.Vector3(x, y, z));
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    
    // Tail tapers
    const radiusFunction = (t: number) => {
      return THREE.MathUtils.lerp(tailThickness, tailThickness * 0.1, t);
    };
    
    // Create tube with variable radius
    const tubeSegments = segments * 2;
    const radialSegments = 8;
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    
    const curvePoints = curve.getPoints(tubeSegments);
    
    for (let j = 0; j <= tubeSegments; j++) {
      const t = j / tubeSegments;
      const point = curvePoints[j];
      const tangent = curve.getTangent(t);
      const radius = radiusFunction(t);
      
      const binormal = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, binormal).normalize();
      binormal.crossVectors(normal, tangent).normalize();
      
      for (let k = 0; k <= radialSegments; k++) {
        const angle = (k / radialSegments) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const vertex = new THREE.Vector3(
          point.x + (cos * normal.x + sin * binormal.x) * radius,
          point.y + (cos * normal.y + sin * binormal.y) * radius,
          point.z + (cos * normal.z + sin * binormal.z) * radius
        );
        
        positions.push(vertex.x, vertex.y, vertex.z);
        
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
    
    const tailGeometry = new THREE.BufferGeometry();
    tailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    tailGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    tailGeometry.setIndex(indices);
    
    const material = new THREE.MeshStandardMaterial({
      color: colors.accent,
      roughness: 0.7,
      metalness: 0.0,
    });
    
    const tail = new THREE.Mesh(tailGeometry, material);
    group.add(tail);
    
    // Add venomous spine for stingrays and eagle rays
    if (proportions.hasSpine) {
      const spineGeometry = new THREE.ConeGeometry(
        tailThickness * 0.8,
        tailLength * 0.15,
        6
      );
      spineGeometry.rotateZ(-Math.PI / 2);
      spineGeometry.translate(-wingspan * proportions.bodyLength * 0.35 - tailLength * 0.3, tailThickness, 0);
      
      const spineMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a2a1a,
        roughness: 0.8,
        metalness: 0.1,
      });
      
      const spine = new THREE.Mesh(spineGeometry, spineMaterial);
      group.add(spine);
    }
    
    return group;
  }
  
  private static createPatterns(wingspan: number, species: string, colors: any): THREE.Group | null {
    if (species !== 'manta' && species !== 'eagle') return null;
    
    const group = new THREE.Group();
    
    // Add spots/patterns on dorsal surface
    const spotCount = species === 'manta' ? 20 : 15;
    
    for (let i = 0; i < spotCount; i++) {
      const spotSize = wingspan * (0.02 + Math.random() * 0.03);
      const spotGeometry = new THREE.CircleGeometry(spotSize, 16);
      const spotMaterial = new THREE.MeshStandardMaterial({
        color: colors.pattern,
        roughness: 0.6,
        metalness: 0.0,
      });
      
      const spot = new THREE.Mesh(spotGeometry, spotMaterial);
      
      // Random position on body
      spot.position.x = (Math.random() - 0.5) * wingspan * 0.4;
      spot.position.y = wingspan * 0.08;
      spot.position.z = (Math.random() - 0.5) * wingspan * 0.6;
      spot.rotation.x = -Math.PI / 2;
      
      group.add(spot);
    }
    
    return group;
  }
}

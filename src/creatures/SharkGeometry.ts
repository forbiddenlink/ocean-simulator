import * as THREE from 'three';

/**
 * Procedural shark geometry generator
 * Creates realistic shark meshes with fins, tail, and proper proportions
 */
export class SharkGeometry {
  /**
   * Create a procedurally generated shark geometry
   * @param length - Total length of the shark (default: 3.0m)
   * @param species - Type of shark: 'great-white', 'hammerhead', 'tiger', 'reef'
   */
  static create(length: number = 3.0, species: 'great-white' | 'hammerhead' | 'tiger' | 'reef' = 'great-white'): THREE.Group {
    const group = new THREE.Group();
    
    // Proportions vary by species
    const proportions = this.getSpeciesProportions(species);
    
    // Main body
    const body = this.createBody(length, proportions);
    group.add(body);
    
    // Head (varies significantly by species)
    const head = this.createHead(length, species, proportions);
    group.add(head);
    
    // Dorsal fin
    const dorsalFin = this.createDorsalFin(length, proportions);
    group.add(dorsalFin);
    
    // Pectoral fins (side fins)
    const pectoralFinLeft = this.createPectoralFin(length, proportions, 'left');
    const pectoralFinRight = this.createPectoralFin(length, proportions, 'right');
    group.add(pectoralFinLeft, pectoralFinRight);
    
    // Tail fin (caudal fin)
    const tailFin = this.createTailFin(length, proportions);
    group.add(tailFin);
    
    // Gills
    const gills = this.createGills(length, proportions);
    group.add(gills);
    
    return group;
  }
  
  private static getSpeciesProportions(species: string): {
    bodyGirth: number;
    headLength: number;
    tailHeight: number;
    dorsalHeight: number;
    pectoralLength: number;
    hammerWidth: number;
  } {
    switch (species) {
      case 'great-white':
        return {
          bodyGirth: 0.20,
          headLength: 0.25,
          tailHeight: 0.25,
          dorsalHeight: 0.15,
          pectoralLength: 0.18,
          hammerWidth: 0,
        };
      case 'hammerhead':
        return {
          bodyGirth: 0.18,
          headLength: 0.22,
          tailHeight: 0.28,
          dorsalHeight: 0.18,
          pectoralLength: 0.20,
          hammerWidth: 0.40,
        };
      case 'tiger':
        return {
          bodyGirth: 0.22,
          headLength: 0.23,
          tailHeight: 0.24,
          dorsalHeight: 0.14,
          pectoralLength: 0.16,
          hammerWidth: 0,
        };
      case 'reef':
        return {
          bodyGirth: 0.16,
          headLength: 0.22,
          tailHeight: 0.20,
          dorsalHeight: 0.12,
          pectoralLength: 0.15,
          hammerWidth: 0,
        };
      default:
        return this.getSpeciesProportions('great-white');
    }
  }
  
  private static createBody(length: number, proportions: any): THREE.Mesh {
    // Fusiform body shape - torpedo-like
    const segments = 32;
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    
    const bodyLength = length * 0.55; // 55% of total length
    const maxRadius = length * proportions.bodyGirth;
    
    // Generate body segments with proper fish-like profile
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * bodyLength;
      
      // Fusiform profile: widest at 1/3, tapers toward both ends
      let radiusScale: number;
      if (t < 0.33) {
        radiusScale = Math.sin(t * Math.PI * 1.5);
      } else {
        radiusScale = Math.sin((1 - t) * Math.PI * 1.5);
      }
      
      const radius = maxRadius * radiusScale;
      
      // Create ring of vertices
      const ringSides = 16;
      for (let j = 0; j <= ringSides; j++) {
        const angle = (j / ringSides) * Math.PI * 2;
        
        // Flatten bottom slightly
        let yRadius = radius;
        let zRadius = radius;
        if (angle > Math.PI) {
          yRadius *= 0.85;
        }
        
        vertices.push(
          x,
          Math.cos(angle) * yRadius,
          Math.sin(angle) * zRadius
        );
        
        normals.push(
          0,
          Math.cos(angle),
          Math.sin(angle)
        );
        
        uvs.push(t, j / ringSides);
      }
    }
    
    // Generate indices for triangles
    for (let i = 0; i < segments; i++) {
      const ringSides = 17;
      for (let j = 0; j < ringSides - 1; j++) {
        const a = i * ringSides + j;
        const b = i * ringSides + j + 1;
        const c = (i + 1) * ringSides + j + 1;
        const d = (i + 1) * ringSides + j;
        
        indices.push(a, b, c);
        indices.push(a, c, d);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x5a6b7d,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  private static createHead(length: number, species: string, proportions: any): THREE.Mesh {
    const headLength = length * proportions.headLength;
    
    if (species === 'hammerhead') {
      return this.createHammerhead(length, proportions);
    }
    
    // Standard shark head - conical with slight flattening
    const geometry = new THREE.ConeGeometry(
      length * proportions.bodyGirth * 0.8,
      headLength,
      16,
      1
    );
    
    // Rotate to point forward
    geometry.rotateZ(Math.PI / 2);
    geometry.translate(headLength / 2 + length * 0.275, 0, 0);
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a5b6d,
      roughness: 0.3,
      metalness: 0.1,
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  private static createHammerhead(length: number, proportions: any): THREE.Mesh {
    // Create T-shaped hammerhead

    // Horizontal hammer part
    const hammerWidth = length * proportions.hammerWidth;
    const hammerThickness = length * 0.04;
    const hammerGeometry = new THREE.BoxGeometry(
      hammerThickness,
      hammerWidth,
      hammerThickness * 0.6
    );
    
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5b6d,
      roughness: 0.3,
      metalness: 0.1,
    });
    
    const hammer = new THREE.Mesh(hammerGeometry, headMaterial);
    hammer.position.x = length * 0.35;
    
    // Vertical neck connecting to body
    const neckGeometry = new THREE.CylinderGeometry(
      length * 0.08,
      length * proportions.bodyGirth * 0.8,
      length * 0.15,
      12
    );
    neckGeometry.rotateZ(Math.PI / 2);
    
    const neck = new THREE.Mesh(neckGeometry, headMaterial);
    neck.position.x = length * 0.28;
    
    const mesh = new THREE.Mesh();
    mesh.add(hammer, neck);
    return mesh;
  }
  
  private static createDorsalFin(length: number, proportions: any): THREE.Mesh {
    const finHeight = length * proportions.dorsalHeight;
    const finBase = length * 0.12;
    
    // Triangular fin shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(finBase * 0.7, finHeight);
    shape.lineTo(finBase, 0);
    shape.lineTo(0, 0);
    
    const extrudeSettings = {
      depth: length * 0.02,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-finBase / 2, length * proportions.bodyGirth, 0);
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x3a4b5d,
      roughness: 0.5,
      metalness: 0.1,
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  private static createPectoralFin(length: number, proportions: any, side: 'left' | 'right'): THREE.Mesh {
    const finLength = length * proportions.pectoralLength;
    const finWidth = finLength * 0.5;
    
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(finLength, finWidth * 0.3);
    shape.lineTo(finLength * 0.8, finWidth);
    shape.lineTo(0, finWidth * 0.4);
    shape.lineTo(0, 0);
    
    const extrudeSettings = {
      depth: length * 0.015,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 1,
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(Math.PI / 2);
    geometry.rotateZ(side === 'left' ? Math.PI / 6 : -Math.PI / 6);
    
    const offsetZ = side === 'left' ? length * proportions.bodyGirth * 0.7 : -length * proportions.bodyGirth * 0.7;
    geometry.translate(length * 0.05, -length * proportions.bodyGirth * 0.3, offsetZ);
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x3a4b5d,
      roughness: 0.5,
      metalness: 0.1,
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  private static createTailFin(length: number, proportions: any): THREE.Mesh {
    const tailHeight = length * proportions.tailHeight;
    const tailBase = length * 0.15;
    
    // Shark tail is asymmetric - upper lobe larger
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    // Upper lobe
    shape.lineTo(-tailBase * 0.8, tailHeight * 0.7);
    shape.lineTo(-tailBase, tailHeight * 0.6);
    shape.lineTo(-tailBase * 0.5, 0);
    // Lower lobe (smaller)
    shape.lineTo(-tailBase * 0.6, -tailHeight * 0.3);
    shape.lineTo(-tailBase * 0.4, -tailHeight * 0.35);
    shape.lineTo(0, 0);
    
    const extrudeSettings = {
      depth: length * 0.02,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-length * 0.28, 0, 0);
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a5b6d,
      roughness: 0.4,
      metalness: 0.1,
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  private static createGills(length: number, proportions: any): THREE.Group {
    const group = new THREE.Group();
    const gillCount = 5;
    const gillSpacing = length * 0.04;
    const startX = length * 0.12;
    
    for (let i = 0; i < gillCount; i++) {
      const gillGeometry = new THREE.PlaneGeometry(length * 0.01, length * 0.05);
      const gillMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a3a4a,
        roughness: 0.6,
        side: THREE.DoubleSide,
      });
      
      const gill = new THREE.Mesh(gillGeometry, gillMaterial);
      gill.position.x = startX - i * gillSpacing;
      gill.position.y = -length * proportions.bodyGirth * 0.6;
      gill.position.z = length * proportions.bodyGirth * 0.5;
      gill.rotation.y = Math.PI / 6;
      
      group.add(gill);
      
      // Mirror to other side
      const gillMirror = gill.clone();
      gillMirror.position.z *= -1;
      gillMirror.rotation.y *= -1;
      group.add(gillMirror);
    }
    
    return group;
  }
}

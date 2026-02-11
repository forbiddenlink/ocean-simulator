import * as THREE from 'three';

/**
 * Procedural dolphin geometry generator
 * Creates realistic dolphin meshes with proper marine mammal proportions
 */
export class DolphinGeometry {
  /**
   * Create a procedurally generated dolphin geometry
   * @param length - Total length of the dolphin (default: 2.5m)
   * @param species - Type: 'bottlenose', 'spinner', 'orca'
   */
  static create(length: number = 2.5, species: 'bottlenose' | 'spinner' | 'orca' = 'bottlenose'): THREE.Group {
    const group = new THREE.Group();
    
    const proportions = this.getSpeciesProportions(species);
    const colors = this.getSpeciesColors(species);
    
    // Main body
    const body = this.createBody(length, proportions, colors);
    group.add(body);
    
    // Head with melon (bulbous forehead) and beak
    const head = this.createHead(length, species, proportions, colors);
    group.add(head);
    
    // Dorsal fin (characteristic curved fin)
    const dorsalFin = this.createDorsalFin(length, proportions, colors);
    group.add(dorsalFin);
    
    // Pectoral fins (flippers)
    const pectoralFinLeft = this.createPectoralFin(length, proportions, 'left', colors);
    const pectoralFinRight = this.createPectoralFin(length, proportions, 'right', colors);
    group.add(pectoralFinLeft, pectoralFinRight);
    
    // Tail flukes (horizontal)
    const tailFlukes = this.createTailFlukes(length, proportions, colors);
    group.add(tailFlukes);
    
    return group;
  }
  
  private static getSpeciesProportions(species: string): {
    bodyGirth: number;
    headLength: number;
    beakLength: number;
    melonHeight: number;
    tailSpan: number;
    dorsalHeight: number;
    pectoralLength: number;
  } {
    switch (species) {
      case 'bottlenose':
        return {
          bodyGirth: 0.18,
          headLength: 0.22,
          beakLength: 0.10,
          melonHeight: 0.08,
          tailSpan: 0.28,
          dorsalHeight: 0.12,
          pectoralLength: 0.16,
        };
      case 'spinner':
        return {
          bodyGirth: 0.15,
          headLength: 0.20,
          beakLength: 0.12,
          melonHeight: 0.06,
          tailSpan: 0.25,
          dorsalHeight: 0.15,
          pectoralLength: 0.14,
        };
      case 'orca':
        return {
          bodyGirth: 0.25,
          headLength: 0.20,
          beakLength: 0.05,
          melonHeight: 0.10,
          tailSpan: 0.35,
          dorsalHeight: 0.20,
          pectoralLength: 0.18,
        };
      default:
        return this.getSpeciesProportions('bottlenose');
    }
  }
  
  private static getSpeciesColors(species: string): {
    dorsal: number;
    ventral: number;
    accent: number;
  } {
    switch (species) {
      case 'bottlenose':
        return {
          dorsal: 0x6a7c8f,  // Gray-blue
          ventral: 0xd4dde6, // Light gray-white
          accent: 0x5a6c7f,  // Darker gray
        };
      case 'spinner':
        return {
          dorsal: 0x5a6b7d,
          ventral: 0xe0e8f0,
          accent: 0x4a5b6d,
        };
      case 'orca':
        return {
          dorsal: 0x1a1a1a,  // Black
          ventral: 0xffffff, // White
          accent: 0x2a2a2a,  // Dark gray
        };
      default:
        return this.getSpeciesColors('bottlenose');
    }
  }
  
  private static createBody(length: number, proportions: any, colors: any): THREE.Mesh {
    const segments = 32;
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors_attr: number[] = [];
    
    const bodyLength = length * 0.60;
    const maxRadius = length * proportions.bodyGirth;
    
    const dorsalColor = new THREE.Color(colors.dorsal);
    const ventralColor = new THREE.Color(colors.ventral);
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * bodyLength;
      
      // Marine mammal body profile - smooth and streamlined
      let radiusScale: number;
      if (t < 0.35) {
        radiusScale = t / 0.35;
      } else if (t < 0.65) {
        radiusScale = 1.0;
      } else {
        radiusScale = (1 - t) / 0.35;
      }
      
      const radius = maxRadius * radiusScale;
      
      const ringSides = 16;
      for (let j = 0; j <= ringSides; j++) {
        const angle = (j / ringSides) * Math.PI * 2;
        
        // Dolphins have more rounded cross-section than sharks
        const yRadius = radius * 0.95;
        const zRadius = radius;
        
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
        
        // Counter-shading: dark on top, light on bottom
        const colorBlend = (Math.cos(angle) + 1) / 2; // 0 at bottom, 1 at top
        const finalColor = new THREE.Color().lerpColors(ventralColor, dorsalColor, colorBlend);
        colors_attr.push(finalColor.r, finalColor.g, finalColor.b);
      }
    }
    
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
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors_attr, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.3,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  private static createHead(length: number, _species: string, proportions: any, colors: any): THREE.Group {
    const group = new THREE.Group();
    
    // Melon (bulbous forehead)
    const melonGeometry = new THREE.SphereGeometry(
      length * proportions.melonHeight,
      16,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    melonGeometry.translate(length * 0.32, length * proportions.melonHeight * 0.5, 0);
    
    const melonMaterial = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.3,
      metalness: 0.05,
    });
    
    const melon = new THREE.Mesh(melonGeometry, melonMaterial);
    group.add(melon);
    
    // Beak (rostrum)
    if (proportions.beakLength > 0.05) {
      const beakGeometry = new THREE.CylinderGeometry(
        length * 0.04,
        length * 0.03,
        length * proportions.beakLength,
        12
      );
      beakGeometry.rotateZ(Math.PI / 2);
      beakGeometry.translate(length * 0.38 + length * proportions.beakLength / 2, 0, 0);
      
      const beak = new THREE.Mesh(beakGeometry, melonMaterial);
      group.add(beak);
    }
    
    return group;
  }
  
  private static createDorsalFin(length: number, proportions: any, colors: any): THREE.Mesh {
    const finHeight = length * proportions.dorsalHeight;
    const finBase = length * 0.10;
    
    // Curved dolphin fin shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(
      finBase * 0.3, finHeight * 1.1,
      finBase * 0.7, finHeight
    );
    shape.lineTo(finBase, 0);
    shape.lineTo(0, 0);
    
    const extrudeSettings = {
      depth: length * 0.015,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-finBase / 3, length * proportions.bodyGirth * 0.9, 0);
    
    const material = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.4,
      metalness: 0.05,
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  private static createPectoralFin(length: number, proportions: any, side: 'left' | 'right', colors: any): THREE.Mesh {
    const finLength = length * proportions.pectoralLength;
    const finWidth = finLength * 0.4;
    
    // Dolphin flippers are more rounded than shark fins
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(
      finLength * 0.5, finWidth * 0.6,
      finLength, finWidth * 0.4
    );
    shape.quadraticCurveTo(
      finLength * 0.9, finWidth * 0.7,
      finLength * 0.5, finWidth
    );
    shape.quadraticCurveTo(
      finLength * 0.2, finWidth * 0.6,
      0, finWidth * 0.3
    );
    shape.lineTo(0, 0);
    
    const extrudeSettings = {
      depth: length * 0.02,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 1,
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(Math.PI / 2);
    geometry.rotateZ(side === 'left' ? Math.PI / 4 : -Math.PI / 4);
    
    const offsetZ = side === 'left' ? length * proportions.bodyGirth * 0.8 : -length * proportions.bodyGirth * 0.8;
    geometry.translate(length * 0.08, -length * proportions.bodyGirth * 0.4, offsetZ);
    
    const material = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.4,
      metalness: 0.05,
    });
    
    return new THREE.Mesh(geometry, material);
  }
  
  private static createTailFlukes(length: number, proportions: any, colors: any): THREE.Mesh {
    const flukeSpan = length * proportions.tailSpan;
    const flukeWidth = flukeSpan * 0.15;
    
    // Horizontal tail flukes (not vertical like fish)
    const shape = new THREE.Shape();
    
    // Left fluke
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(
      -flukeWidth * 0.5, flukeSpan / 2 * 0.8,
      -flukeWidth, flukeSpan / 2
    );
    shape.quadraticCurveTo(
      -flukeWidth * 0.6, flukeSpan / 2 * 1.1,
      -flukeWidth * 0.2, flukeSpan / 2 * 0.9
    );
    
    // Center notch
    shape.quadraticCurveTo(
      -flukeWidth * 0.1, flukeWidth * 0.3,
      0, 0
    );
    
    // Right fluke (mirror)
    shape.quadraticCurveTo(
      flukeWidth * 0.1, flukeWidth * 0.3,
      flukeWidth * 0.2, flukeSpan / 2 * 0.9
    );
    shape.quadraticCurveTo(
      flukeWidth * 0.6, flukeSpan / 2 * 1.1,
      flukeWidth, flukeSpan / 2
    );
    shape.quadraticCurveTo(
      flukeWidth * 0.5, flukeSpan / 2 * 0.8,
      0, 0
    );
    
    const extrudeSettings = {
      depth: length * 0.02,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate to be horizontal (dolphins have horizontal tail)
    geometry.rotateX(Math.PI / 2);
    geometry.translate(-length * 0.30, 0, 0);
    
    const material = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.4,
      metalness: 0.05,
    });
    
    return new THREE.Mesh(geometry, material);
  }
}

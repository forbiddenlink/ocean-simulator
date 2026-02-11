import * as THREE from 'three';

/**
 * Specialized Creature Geometries for Sharks, Dolphins, and Rays
 * Each with accurate anatomical features
 */

export class SpecializedCreatureGeometry {
  
  /**
   * Create anatomically correct shark
   * Features: Cartilaginous body, heterocercal tail, 5-7 gill slits, no swim bladder
   */
  public static createShark(params: {
    length?: number;
    species?: 'great_white' | 'hammerhead' | 'reef' | 'generic';
    quality?: 'low' | 'medium' | 'high' | 'ultra';
  } = {}): THREE.BufferGeometry {
    const {
      length = 2.5,
      species = 'generic',
      quality = 'high'
    } = params;
    
    // Species will be used for future specialization

    const settings = {
      low: { bodySegments: 32, radialSegments: 16 },
      medium: { bodySegments: 48, radialSegments: 24 },
      high: { bodySegments: 64, radialSegments: 32 },
      ultra: { bodySegments: 96, radialSegments: 48 }
    };

    const config = settings[quality];
    const group = new THREE.Group();

    // Shark body (more elongated and streamlined)
    const bodyGeometry = this.createSharkBody(length, species, config.bodySegments, config.radialSegments);
    const bodyMesh = new THREE.Mesh(bodyGeometry);
    bodyMesh.name = 'body';
    group.add(bodyMesh);

    // Shark head with distinctive features
    const headGroup = this.createSharkHead(length, species);
    headGroup.position.x = -length * 0.35;
    group.add(headGroup);

    // Heterocercal caudal fin (asymmetric tail)
    const caudalFin = this.createHeterocercalTail(length);
    caudalFin.position.x = length * 0.45;
    caudalFin.name = 'caudal_fin';
    group.add(caudalFin);

    // First dorsal fin (large, triangular)
    const dorsalFin1 = this.createSharkDorsalFin(length, 0.6);
    dorsalFin1.position.set(-length * 0.1, length * 0.15, 0);
    dorsalFin1.name = 'dorsal_fin_1';
    group.add(dorsalFin1);

    // Second dorsal fin (smaller)
    const dorsalFin2 = this.createSharkDorsalFin(length, 0.3);
    dorsalFin2.position.set(length * 0.25, length * 0.08, 0);
    dorsalFin2.name = 'dorsal_fin_2';
    group.add(dorsalFin2);

    // Pectoral fins (large, wing-like)
    const pectoralLeft = this.createSharkPectoralFin(length);
    pectoralLeft.position.set(-length * 0.2, -length * 0.05, length * 0.15);
    pectoralLeft.rotation.set(0.2, 0, 0.3);
    pectoralLeft.name = 'pectoral_left';
    group.add(pectoralLeft);

    const pectoralRight = pectoralLeft.clone();
    pectoralRight.position.z = -length * 0.15;
    pectoralRight.rotation.z = -0.3;
    pectoralRight.name = 'pectoral_right';
    group.add(pectoralRight);

    // Pelvic fins
    const pelvicLeft = this.createSharkPelvicFin(length);
    pelvicLeft.position.set(length * 0.1, -length * 0.08, length * 0.08);
    pelvicLeft.name = 'pelvic_left';
    group.add(pelvicLeft);

    const pelvicRight = pelvicLeft.clone();
    pelvicRight.position.z = -length * 0.08;
    pelvicRight.name = 'pelvic_right';
    group.add(pelvicRight);

    // Anal fin
    const analFin = this.createSharkAnalFin(length);
    analFin.position.set(length * 0.3, -length * 0.06, 0);
    analFin.name = 'anal_fin';
    group.add(analFin);

    return this.mergeGroup(group);
  }

  /**
   * Create anatomically correct dolphin/whale
   * Features: Horizontal flukes, melon, blowhole, rubbery skin (no scales)
   */
  public static createDolphin(params: {
    length?: number;
    species?: 'bottlenose' | 'orca' | 'generic';
    quality?: 'low' | 'medium' | 'high' | 'ultra';
  } = {}): THREE.BufferGeometry {
    const {
      length = 2.0,
      species = 'bottlenose',
      quality = 'high'
    } = params;
    
    // Species will be used for future specialization

    const settings = {
      low: { bodySegments: 32, radialSegments: 16 },
      medium: { bodySegments: 48, radialSegments: 24 },
      high: { bodySegments: 64, radialSegments: 32 },
      ultra: { bodySegments: 96, radialSegments: 48 }
    };

    const config = settings[quality];
    const group = new THREE.Group();

    // Dolphin body (smooth, streamlined)
    const bodyGeometry = this.createDolphinBody(length, species, config.bodySegments, config.radialSegments);
    const bodyMesh = new THREE.Mesh(bodyGeometry);
    bodyMesh.name = 'body';
    group.add(bodyMesh);

    // Head with rostrum (beak) and melon (forehead bulge)
    const headGroup = this.createDolphinHead(length, species);
    headGroup.position.x = -length * 0.35;
    group.add(headGroup);

    // Horizontal flukes (tail)
    const flukes = this.createHorizontalFlukes(length);
    flukes.position.x = length * 0.45;
    flukes.name = 'flukes';
    group.add(flukes);

    // Dorsal fin (single, curved)
    const dorsalFin = this.createDolphinDorsalFin(length);
    dorsalFin.position.set(-length * 0.05, length * 0.15, 0);
    dorsalFin.name = 'dorsal_fin';
    group.add(dorsalFin);

    // Pectoral fins (flippers)
    const pectoralLeft = this.createDolphinPectoralFin(length);
    pectoralLeft.position.set(-length * 0.25, -length * 0.05, length * 0.12);
    pectoralLeft.rotation.set(0.3, 0, 0.2);
    pectoralLeft.name = 'pectoral_left';
    group.add(pectoralLeft);

    const pectoralRight = pectoralLeft.clone();
    pectoralRight.position.z = -length * 0.12;
    pectoralRight.rotation.z = -0.2;
    pectoralRight.name = 'pectoral_right';
    group.add(pectoralRight);

    return this.mergeGroup(group);
  }

  /**
   * Create anatomically correct ray/skate
   * Features: Flattened body, wing-like pectorals, tail spine, ventral mouth
   */
  public static createRay(params: {
    length?: number;
    wingspan?: number;
    species?: 'manta' | 'eagle' | 'stingray' | 'generic';
    quality?: 'low' | 'medium' | 'high' | 'ultra';
  } = {}): THREE.BufferGeometry {
    const {
      length = 1.5,
      wingspan = 3.0,
      species = 'generic',
      quality = 'high'
    } = params;

    const settings = {
      low: { segments: 16 },
      medium: { segments: 24 },
      high: { segments: 32 },
      ultra: { segments: 48 }
    };

    const config = settings[quality];
    const group = new THREE.Group();

    // Ray body (flattened disc)
    const bodyGeometry = this.createRayBody(length, wingspan, config.segments);
    const bodyMesh = new THREE.Mesh(bodyGeometry);
    bodyMesh.name = 'body';
    group.add(bodyMesh);

    // Head with mouth and eyes on top
    const headGroup = this.createRayHead(length);
    headGroup.position.set(length * 0.3, 0, 0);
    group.add(headGroup);

    // Tail (long, whip-like with barb for stingrays)
    const tail = this.createRayTail(length, species);
    tail.position.set(-length * 0.5, 0, 0);
    tail.name = 'tail';
    group.add(tail);

    // Spiracles (breathing holes on top)
    const spiraclesleft = this.createSpiraclesspiracle(length * 0.05);
    spiraclesleft.position.set(length * 0.2, length * 0.05, length * 0.15);
    group.add(spiraclesleft);

    const spiraclesRight = spiraclesleft.clone();
    spiraclesRight.position.z = -length * 0.15;
    group.add(spiraclesRight);

    return this.mergeGroup(group);
  }

  // ============ SHARK GEOMETRY HELPERS ============

  private static createSharkBody(
    length: number,
    _species: string,
    segments: number,
    radialSegments: number
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const bodyHeight = length * 0.18; // Sharks are slimmer than fish
    const bodyWidth = length * 0.15;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * length;

      // Shark profile: Very streamlined
      let profile: number;
      if (t < 0.25) {
        // Pointed snout
        const headT = t / 0.25;
        profile = 0.2 + headT * 0.8;
      } else if (t < 0.4) {
        // Maximum girth at shoulders
        profile = 1.0;
      } else if (t < 0.8) {
        // Gradual taper
        const bodyT = (t - 0.4) / 0.4;
        profile = 1.0 - bodyT * 0.5;
      } else {
        // Caudal peduncle (very narrow)
        const tailT = (t - 0.8) / 0.2;
        profile = 0.5 * (1.0 - tailT * tailT * 0.9);
      }

      const radiusH = bodyHeight * profile;
      const radiusW = bodyWidth * profile;

      for (let j = 0; j <= radialSegments; j++) {
        const angle = (j / radialSegments) * Math.PI * 2;
        const y = Math.cos(angle) * radiusH;
        const z = Math.sin(angle) * radiusW;

        positions.push(x, y, z);

        // Shark coloration: dark back, white belly (counter-shading)
        const dorsalFactor = (Math.cos(angle) + 1.0) / 2.0;
        const backColor = 0.4; // Dark gray-blue
        const bellyColor = 1.2; // White
        const colorValue = dorsalFactor * backColor + (1.0 - dorsalFactor) * bellyColor;
        colors.push(colorValue, colorValue * 0.95, colorValue * 0.9); // Slight blue tint
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * (radialSegments + 1) + j;
        const b = a + radialSegments + 1;
        const c = a + 1;
        const d = b + 1;

        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  private static createSharkHead(length: number, _species: string): THREE.Group {
    const headGroup = new THREE.Group();
    const headSize = length * 0.22;

    // Eyes (smaller, more menacing)
    const eyeSize = headSize * 0.12;
    const eyeLeft = this.createSimpleEye(eyeSize, 0.05); // Darker eye
    eyeLeft.position.set(headSize * 0.4, headSize * 0.3, headSize * 0.7);
    headGroup.add(eyeLeft);

    const eyeRight = eyeLeft.clone();
    eyeRight.position.z = -headSize * 0.7;
    headGroup.add(eyeRight);

    // Gill slits (5-7 vertical slits)
    const gillCount = 5;
    for (let i = 0; i < gillCount; i++) {
      const gillSlit = this.createGillSlit(headSize);
      gillSlit.position.set(
        -headSize * 0.1 + i * headSize * 0.08,
        0,
        headSize * 0.6
      );
      headGroup.add(gillSlit);

      const gillSlitRight = gillSlit.clone();
      gillSlitRight.position.z = -headSize * 0.6;
      headGroup.add(gillSlitRight);
    }

    // Nose/snout (pointed)
    const snout = new THREE.ConeGeometry(headSize * 0.15, headSize * 0.4, 16);
    const snoutMesh = new THREE.Mesh(snout);
    snoutMesh.rotation.z = Math.PI / 2;
    snoutMesh.position.x = headSize * 0.7;
    headGroup.add(snoutMesh);

    return headGroup;
  }

  private static createHeterocercalTail(length: number): THREE.Mesh {
    // Asymmetric tail (upper lobe larger)
    const finLength = length * 0.35;
    
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Attachment point
    positions.push(0, 0, 0);
    colors.push(0.8, 0.8, 0.8);

    // Upper lobe (larger)
    const upperLobeSegments = 12;
    for (let i = 0; i <= upperLobeSegments; i++) {
      const t = i / upperLobeSegments;
      const angle = -Math.PI * 0.3 - t * Math.PI * 0.15;
      const radius = finLength * (0.7 + t * 0.3);
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 1.5; // Elongated upper lobe

      positions.push(x, y, 0);
      colors.push(0.7, 0.7, 0.7);
    }

    // Lower lobe (smaller)
    for (let i = 0; i <= upperLobeSegments; i++) {
      const t = i / upperLobeSegments;
      const angle = Math.PI * 0.5 - t * Math.PI * 0.2;
      const radius = finLength * (0.4 + t * 0.2);
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.8; // Shorter lower lobe

      positions.push(x, y, 0);
      colors.push(0.7, 0.7, 0.7);
    }

    // Create triangles
    const vertexCount = positions.length / 3;
    for (let i = 1; i < vertexCount - 1; i++) {
      indices.push(0, i, i + 1);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry);
  }

  private static createSharkDorsalFin(length: number, scale: number): THREE.Mesh {
    const finLength = length * 0.25 * scale;
    const finHeight = length * 0.3 * scale;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(finLength * 0.7, finHeight);
    shape.quadraticCurveTo(finLength * 0.5, finHeight * 0.6, finLength, 0);
    shape.lineTo(0, 0);

    const geometry = new THREE.ShapeGeometry(shape);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    colors.fill(0.6);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return new THREE.Mesh(geometry);
  }

  private static createSharkPectoralFin(length: number): THREE.Mesh {
    const finLength = length * 0.35;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(finLength * 0.4, finLength * 0.3, finLength, finLength * 0.2);
    shape.lineTo(finLength * 0.9, finLength * 0.05);
    shape.quadraticCurveTo(finLength * 0.3, finLength * 0.1, 0, 0);

    const geometry = new THREE.ShapeGeometry(shape);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    colors.fill(0.65);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return new THREE.Mesh(geometry);
  }

  private static createSharkPelvicFin(length: number): THREE.Mesh {
    const finLength = length * 0.15;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(finLength * 0.5, -finLength * 0.4, finLength, -finLength * 0.3);
    shape.lineTo(finLength * 0.8, 0);
    shape.lineTo(0, 0);

    const geometry = new THREE.ShapeGeometry(shape);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    colors.fill(0.65);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return new THREE.Mesh(geometry);
  }

  private static createSharkAnalFin(length: number): THREE.Mesh {
    const finLength = length * 0.12;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(finLength * 0.6, -finLength * 0.5);
    shape.lineTo(finLength, 0);
    shape.lineTo(0, 0);

    const geometry = new THREE.ShapeGeometry(shape);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    colors.fill(0.65);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return new THREE.Mesh(geometry);
  }

  private static createGillSlit(headSize: number): THREE.Mesh {
    const shape = new THREE.Shape();
    shape.moveTo(0, -headSize * 0.1);
    shape.lineTo(headSize * 0.02, headSize * 0.1);
    shape.lineTo(0, headSize * 0.1);
    shape.lineTo(0, -headSize * 0.1);

    const geometry = new THREE.ShapeGeometry(shape);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    colors.fill(0.1); // Dark gill interior
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return new THREE.Mesh(geometry);
  }

  // ============ DOLPHIN GEOMETRY HELPERS ============

  private static createDolphinBody(
    length: number,
    _species: string,
    segments: number,
    radialSegments: number
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const bodyHeight = length * 0.22;
    const bodyWidth = length * 0.18;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * length;

      // Dolphin profile: Smooth, rotund
      let profile: number;
      if (t < 0.2) {
        // Melon (forehead bulge)
        const headT = t / 0.2;
        profile = 0.5 + headT * 0.5;
      } else if (t < 0.35) {
        // Maximum girth
        profile = 1.0;
      } else if (t < 0.75) {
        // Gradual taper
        const bodyT = (t - 0.35) / 0.4;
        profile = 1.0 - bodyT * 0.35;
      } else {
        // Caudal peduncle
        const tailT = (t - 0.75) / 0.25;
        profile = 0.65 * (1.0 - tailT * tailT * 0.85);
      }

      const radiusH = bodyHeight * profile;
      const radiusW = bodyWidth * profile;

      for (let j = 0; j <= radialSegments; j++) {
        const angle = (j / radialSegments) * Math.PI * 2;
        const y = Math.cos(angle) * radiusH;
        const z = Math.sin(angle) * radiusW;

        positions.push(x, y, z);

        // Dolphin coloration: Gray back, light belly
        const dorsalFactor = (Math.cos(angle) + 1.0) / 2.0;
        const backColor = 0.5; // Gray
        const bellyColor = 0.9; // Light gray/white
        const colorValue = dorsalFactor * backColor + (1.0 - dorsalFactor) * bellyColor;
        colors.push(colorValue, colorValue, colorValue);
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * (radialSegments + 1) + j;
        const b = a + radialSegments + 1;
        const c = a + 1;
        const d = b + 1;

        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  private static createDolphinHead(length: number, _species: string): THREE.Group {
    const headGroup = new THREE.Group();
    const headSize = length * 0.25;

    // Rostrum (beak)
    const rostrum = new THREE.CylinderGeometry(headSize * 0.08, headSize * 0.12, headSize * 0.4, 16);
    const rostrumMesh = new THREE.Mesh(rostrum);
    rostrumMesh.rotation.z = Math.PI / 2;
    rostrumMesh.position.x = headSize * 0.6;
    headGroup.add(rostrumMesh);

    // Eyes
    const eyeSize = headSize * 0.1;
    const eyeLeft = this.createSimpleEye(eyeSize, 0.05);
    eyeLeft.position.set(headSize * 0.3, headSize * 0.2, headSize * 0.5);
    headGroup.add(eyeLeft);

    const eyeRight = eyeLeft.clone();
    eyeRight.position.z = -headSize * 0.5;
    headGroup.add(eyeRight);

    // Blowhole (on top of head)
    const blowhole = new THREE.CircleGeometry(headSize * 0.05, 16);
    const blowholeMesh = new THREE.Mesh(blowhole);
    blowholeMesh.rotation.x = -Math.PI / 2;
    blowholeMesh.position.set(-headSize * 0.1, headSize * 0.3, 0);
    headGroup.add(blowholeMesh);

    return headGroup;
  }

  private static createHorizontalFlukes(length: number): THREE.Mesh {
    const flukeLength = length * 0.4;
    const flukeSpan = length * 0.6; // Wide horizontal spread

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Center
    positions.push(0, 0, 0);
    colors.push(0.7, 0.7, 0.7);

    // Left fluke
    const segments = 10;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = flukeLength * (0.5 + t * 0.5);
      const z = flukeSpan * 0.5 * (0.3 + t * 0.7);
      const y = -Math.sin(t * Math.PI) * 0.05; // Slight curve

      positions.push(x, y, z);
      colors.push(0.65, 0.65, 0.65);
    }

    // Right fluke
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = flukeLength * (0.5 + t * 0.5);
      const z = -flukeSpan * 0.5 * (0.3 + t * 0.7);
      const y = -Math.sin(t * Math.PI) * 0.05;

      positions.push(x, y, z);
      colors.push(0.65, 0.65, 0.65);
    }

    const vertexCount = positions.length / 3;
    for (let i = 1; i < vertexCount - 1; i++) {
      indices.push(0, i, i + 1);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry);
  }

  private static createDolphinDorsalFin(length: number): THREE.Mesh {
    const finLength = length * 0.25;
    const finHeight = length * 0.2;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(-finLength * 0.2, finHeight * 1.1, finLength * 0.5, finHeight * 0.9);
    shape.lineTo(finLength, 0);
    shape.lineTo(0, 0);

    const geometry = new THREE.ShapeGeometry(shape);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    colors.fill(0.55);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return new THREE.Mesh(geometry);
  }

  private static createDolphinPectoralFin(length: number): THREE.Mesh {
    const finLength = length * 0.3;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(finLength * 0.3, finLength * 0.2, finLength * 0.8, finLength * 0.15);
    shape.lineTo(finLength, 0);
    shape.lineTo(0, 0);

    const geometry = new THREE.ShapeGeometry(shape);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    colors.fill(0.6);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return new THREE.Mesh(geometry);
  }

  // ============ RAY GEOMETRY HELPERS ============

  private static createRayBody(
    length: number,
    wingspan: number,
    segments: number
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Create diamond-shaped disc
    const halfSpan = wingspan / 2;

    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= segments; j++) {
        const u = i / segments;
        const v = j / segments;

        // Radial coordinates
        const angle = v * Math.PI * 2;
        const radius = u * halfSpan * (1.0 - Math.abs(Math.sin(angle * 2)) * 0.3);

        const x = Math.cos(angle) * radius * 0.6 - length * 0.2; // Offset for head
        const z = Math.sin(angle) * radius;
        const y = -u * u * length * 0.08; // Slight concave shape

        positions.push(x, y, z);

        // Ray coloration: dark top
        const colorValue = 0.3 + u * 0.2;
        colors.push(colorValue, colorValue * 0.9, colorValue * 0.8); // Brown tint
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) + j;
        const b = a + segments + 1;
        const c = a + 1;
        const d = b + 1;

        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  private static createRayHead(length: number): THREE.Group {
    const headGroup = new THREE.Group();

    // Eyes on top
    const eyeSize = length * 0.08;
    const eyeLeft = this.createSimpleEye(eyeSize, 0.05);
    eyeLeft.position.set(0, length * 0.05, length * 0.15);
    headGroup.add(eyeLeft);

    const eyeRight = eyeLeft.clone();
    eyeRight.position.z = -length * 0.15;
    headGroup.add(eyeRight);

    // Mouth (ventral, slit-like)
    const mouth = new THREE.PlaneGeometry(length * 0.15, length * 0.05);
    const mouthMesh = new THREE.Mesh(mouth);
    mouthMesh.rotation.x = Math.PI / 2;
    mouthMesh.position.y = -length * 0.05;
    headGroup.add(mouthMesh);

    return headGroup;
  }

  private static createRayTail(length: number, _species: string): THREE.Mesh {
    const tailLength = length * 1.5; // Long, whip-like

    const segments = 32;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = -t * tailLength; // Extends backward
      const radius = length * 0.02 * (1.0 - t * 0.8); // Tapers
      
      // Create ring
      const ringSegments = 8;
      for (let j = 0; j <= ringSegments; j++) {
        const angle = (j / ringSegments) * Math.PI * 2;
        const y = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        positions.push(x, y, z);
        colors.push(0.3, 0.3, 0.25);
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < 8; j++) {
        const a = i * 9 + j;
        const b = a + 9;
        const c = a + 1;
        const d = b + 1;

        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry);
  }

  private static createSpiraclesspiracle(size: number): THREE.Mesh {
    const spiracle = new THREE.CircleGeometry(size, 16);
    const mesh = new THREE.Mesh(spiracle);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  // ============ SHARED HELPERS ============

  private static createSimpleEye(size: number, pupilRatio: number): THREE.Group {
    const eyeGroup = new THREE.Group();

    const sclera = new THREE.SphereGeometry(size, 16, 16);
    const scleraMesh = new THREE.Mesh(sclera);
    eyeGroup.add(scleraMesh);

    const pupil = new THREE.SphereGeometry(size * pupilRatio, 12, 12);
    const pupilMesh = new THREE.Mesh(pupil);
    pupilMesh.position.z = size * 0.5;
    eyeGroup.add(pupilMesh);

    return eyeGroup;
  }

  private static mergeGroup(group: THREE.Group): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        let geometry = child.geometry.clone();

        if (geometry.index) {
          geometry = geometry.toNonIndexed();
        }

        child.updateMatrix();
        geometry.applyMatrix4(child.matrix);

        geometries.push(geometry);
      }
    });

    if (geometries.length === 0) {
      return new THREE.BufferGeometry();
    }

    let totalVertices = 0;
    for (const geo of geometries) {
      totalVertices += geo.getAttribute('position').count;
    }

    const mergedPositions = new Float32Array(totalVertices * 3);
    const mergedColors = new Float32Array(totalVertices * 3);

    let offset = 0;

    for (const geo of geometries) {
      const positions = geo.getAttribute('position');
      const colors = geo.getAttribute('color');

      for (let i = 0; i < positions.count; i++) {
        mergedPositions[offset * 3] = positions.getX(i);
        mergedPositions[offset * 3 + 1] = positions.getY(i);
        mergedPositions[offset * 3 + 2] = positions.getZ(i);

        if (colors) {
          mergedColors[offset * 3] = colors.getX(i);
          mergedColors[offset * 3 + 1] = colors.getY(i);
          mergedColors[offset * 3 + 2] = colors.getZ(i);
        } else {
          mergedColors[offset * 3] = 0.8;
          mergedColors[offset * 3 + 1] = 0.8;
          mergedColors[offset * 3 + 2] = 0.8;
        }

        offset++;
      }
    }

    const mergedGeometry = new THREE.BufferGeometry();
    mergedGeometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    mergedGeometry.setAttribute('color', new THREE.BufferAttribute(mergedColors, 3));
    mergedGeometry.computeVertexNormals();

    return mergedGeometry;
  }
}

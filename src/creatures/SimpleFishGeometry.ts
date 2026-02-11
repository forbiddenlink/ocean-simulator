import * as THREE from 'three';

/**
 * Fish body types for visual variety
 */
export const FishBodyType = {
  STANDARD: 0,   // Fusiform - typical fish shape (tuna, bass)
  SLENDER: 1,    // Elongated - needlefish, barracuda
  DISC: 2,       // Laterally compressed - angelfish, butterflyfish
  CHUNKY: 3,     // Deep-bodied/robust - grouper, carp
} as const;

export type FishBodyType = typeof FishBodyType[keyof typeof FishBodyType];

/**
 * Simple Fish Geometry - creates obviously fish-shaped meshes
 * using basic primitives for guaranteed recognizable fish appearance.
 * Supports 4 distinct body types for visual variety.
 */
export class SimpleFishGeometry {

  /**
   * Create fish geometry by body type
   */
  public static createByType(bodyType: FishBodyType, params: {
    length?: number;
    bodyHeight?: number;
  } = {}): THREE.BufferGeometry {
    switch (bodyType) {
      case FishBodyType.SLENDER:
        return this.createSlender(params);
      case FishBodyType.DISC:
        return this.createDisc(params);
      case FishBodyType.CHUNKY:
        return this.createChunky(params);
      case FishBodyType.STANDARD:
      default:
        return this.createFish(params);
    }
  }

  /**
   * Create a simple but recognizable fish shape (STANDARD - fusiform)
   */
  public static createFish(params: {
    length?: number;
    bodyHeight?: number;
  } = {}): THREE.BufferGeometry {
    const {
      length = 1.0,
      bodyHeight = 0.4
    } = params;

    const group = new THREE.Group();

    // === BODY: Elongated ellipsoid ===
    // Use a sphere scaled to be fish-shaped (longer than tall/wide)
    const bodyGeom = new THREE.SphereGeometry(1, 24, 16);
    // Scale: long (X), medium height (Y), narrow (Z) - fusiform fish shape
    const bodyMesh = new THREE.Mesh(bodyGeom);
    bodyMesh.scale.set(length * 0.45, bodyHeight * 0.5, bodyHeight * 0.35);
    bodyMesh.position.x = 0;
    group.add(bodyMesh);

    // === TAIL FIN: Large triangular tail ===
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(length * 0.35, bodyHeight * 0.5);
    tailShape.lineTo(length * 0.35, -bodyHeight * 0.5);
    tailShape.closePath();

    const tailGeom = new THREE.ExtrudeGeometry(tailShape, {
      depth: bodyHeight * 0.08,
      bevelEnabled: false
    });
    const tailMesh = new THREE.Mesh(tailGeom);
    tailMesh.position.set(length * 0.35, 0, -bodyHeight * 0.04);
    tailMesh.name = 'tail';
    group.add(tailMesh);

    // === DORSAL FIN: Triangular top fin ===
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.lineTo(-length * 0.15, bodyHeight * 0.45);
    dorsalShape.lineTo(length * 0.15, bodyHeight * 0.15);
    dorsalShape.closePath();

    const dorsalGeom = new THREE.ExtrudeGeometry(dorsalShape, {
      depth: bodyHeight * 0.06,
      bevelEnabled: false
    });
    const dorsalMesh = new THREE.Mesh(dorsalGeom);
    dorsalMesh.position.set(-length * 0.05, bodyHeight * 0.18, -bodyHeight * 0.03);
    dorsalMesh.name = 'dorsal';
    group.add(dorsalMesh);

    // === ANAL FIN: Small bottom fin ===
    const analShape = new THREE.Shape();
    analShape.moveTo(0, 0);
    analShape.lineTo(-length * 0.08, -bodyHeight * 0.25);
    analShape.lineTo(length * 0.08, -bodyHeight * 0.1);
    analShape.closePath();

    const analGeom = new THREE.ExtrudeGeometry(analShape, {
      depth: bodyHeight * 0.04,
      bevelEnabled: false
    });
    const analMesh = new THREE.Mesh(analGeom);
    analMesh.position.set(length * 0.1, -bodyHeight * 0.15, -bodyHeight * 0.02);
    analMesh.name = 'anal';
    group.add(analMesh);

    // === PECTORAL FINS: Side fins ===
    const pectoralShape = new THREE.Shape();
    pectoralShape.moveTo(0, 0);
    pectoralShape.quadraticCurveTo(length * 0.15, -bodyHeight * 0.1, length * 0.2, -bodyHeight * 0.25);
    pectoralShape.lineTo(length * 0.05, -bodyHeight * 0.1);
    pectoralShape.closePath();

    const pectoralGeom = new THREE.ExtrudeGeometry(pectoralShape, {
      depth: bodyHeight * 0.02,
      bevelEnabled: false
    });

    // Left pectoral
    const pectoralLeft = new THREE.Mesh(pectoralGeom);
    pectoralLeft.position.set(-length * 0.15, -bodyHeight * 0.05, bodyHeight * 0.15);
    pectoralLeft.rotation.y = Math.PI * 0.3;
    pectoralLeft.name = 'pectoral_left';
    group.add(pectoralLeft);

    // Right pectoral
    const pectoralRight = new THREE.Mesh(pectoralGeom);
    pectoralRight.position.set(-length * 0.15, -bodyHeight * 0.05, -bodyHeight * 0.15);
    pectoralRight.rotation.y = -Math.PI * 0.3;
    pectoralRight.scale.z = -1;
    pectoralRight.name = 'pectoral_right';
    group.add(pectoralRight);

    // === EYES: Simple spheres ===
    const eyeRadius = bodyHeight * 0.08;
    const eyeGeom = new THREE.SphereGeometry(eyeRadius, 12, 8);

    // Left eye
    const eyeLeft = new THREE.Mesh(eyeGeom);
    eyeLeft.position.set(-length * 0.3, bodyHeight * 0.08, bodyHeight * 0.12);
    eyeLeft.name = 'eye';
    group.add(eyeLeft);

    // Right eye
    const eyeRight = new THREE.Mesh(eyeGeom);
    eyeRight.position.set(-length * 0.3, bodyHeight * 0.08, -bodyHeight * 0.12);
    eyeRight.name = 'eye';
    group.add(eyeRight);

    // === SNOUT: Pointed nose cone ===
    const snoutGeom = new THREE.ConeGeometry(bodyHeight * 0.15, length * 0.2, 12);
    const snoutMesh = new THREE.Mesh(snoutGeom);
    snoutMesh.rotation.z = Math.PI / 2; // Point forward
    snoutMesh.position.set(-length * 0.5, 0, 0);
    snoutMesh.name = 'snout';
    group.add(snoutMesh);

    // Merge all geometries
    const mergedGeometry = this.mergeGroup(group);
    mergedGeometry.computeVertexNormals();

    return mergedGeometry;
  }

  /**
   * Create SLENDER fish shape (needlefish, barracuda style)
   * Elongated body, small fins relative to length
   */
  public static createSlender(params: {
    length?: number;
    bodyHeight?: number;
  } = {}): THREE.BufferGeometry {
    const {
      length = 1.0,
      bodyHeight = 0.25 // Narrower default
    } = params;

    const group = new THREE.Group();

    // === BODY: Very elongated ellipsoid ===
    const bodyGeom = new THREE.SphereGeometry(1, 24, 16);
    const bodyMesh = new THREE.Mesh(bodyGeom);
    // Extra long, narrow body
    bodyMesh.scale.set(length * 0.55, bodyHeight * 0.35, bodyHeight * 0.3);
    bodyMesh.position.x = 0;
    group.add(bodyMesh);

    // === TAIL FIN: Smaller, forked tail ===
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(length * 0.25, bodyHeight * 0.4);
    tailShape.lineTo(length * 0.2, 0);
    tailShape.lineTo(length * 0.25, -bodyHeight * 0.4);
    tailShape.closePath();

    const tailGeom = new THREE.ExtrudeGeometry(tailShape, {
      depth: bodyHeight * 0.06,
      bevelEnabled: false
    });
    const tailMesh = new THREE.Mesh(tailGeom);
    tailMesh.position.set(length * 0.45, 0, -bodyHeight * 0.03);
    tailMesh.name = 'tail';
    group.add(tailMesh);

    // === DORSAL FIN: Small, set back ===
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.lineTo(-length * 0.08, bodyHeight * 0.3);
    dorsalShape.lineTo(length * 0.08, bodyHeight * 0.1);
    dorsalShape.closePath();

    const dorsalGeom = new THREE.ExtrudeGeometry(dorsalShape, {
      depth: bodyHeight * 0.04,
      bevelEnabled: false
    });
    const dorsalMesh = new THREE.Mesh(dorsalGeom);
    dorsalMesh.position.set(length * 0.1, bodyHeight * 0.12, -bodyHeight * 0.02);
    dorsalMesh.name = 'dorsal';
    group.add(dorsalMesh);

    // === ANAL FIN: Small ===
    const analShape = new THREE.Shape();
    analShape.moveTo(0, 0);
    analShape.lineTo(-length * 0.05, -bodyHeight * 0.2);
    analShape.lineTo(length * 0.05, -bodyHeight * 0.08);
    analShape.closePath();

    const analGeom = new THREE.ExtrudeGeometry(analShape, {
      depth: bodyHeight * 0.03,
      bevelEnabled: false
    });
    const analMesh = new THREE.Mesh(analGeom);
    analMesh.position.set(length * 0.15, -bodyHeight * 0.1, -bodyHeight * 0.015);
    analMesh.name = 'anal';
    group.add(analMesh);

    // === PECTORAL FINS: Small, swept back ===
    const pectoralShape = new THREE.Shape();
    pectoralShape.moveTo(0, 0);
    pectoralShape.quadraticCurveTo(length * 0.1, -bodyHeight * 0.08, length * 0.12, -bodyHeight * 0.18);
    pectoralShape.lineTo(length * 0.03, -bodyHeight * 0.06);
    pectoralShape.closePath();

    const pectoralGeom = new THREE.ExtrudeGeometry(pectoralShape, {
      depth: bodyHeight * 0.015,
      bevelEnabled: false
    });

    const pectoralLeft = new THREE.Mesh(pectoralGeom);
    pectoralLeft.position.set(-length * 0.25, -bodyHeight * 0.03, bodyHeight * 0.12);
    pectoralLeft.rotation.y = Math.PI * 0.35;
    pectoralLeft.name = 'pectoral_left';
    group.add(pectoralLeft);

    const pectoralRight = new THREE.Mesh(pectoralGeom);
    pectoralRight.position.set(-length * 0.25, -bodyHeight * 0.03, -bodyHeight * 0.12);
    pectoralRight.rotation.y = -Math.PI * 0.35;
    pectoralRight.scale.z = -1;
    pectoralRight.name = 'pectoral_right';
    group.add(pectoralRight);

    // === EYES: Small spheres ===
    const eyeRadius = bodyHeight * 0.07;
    const eyeGeom = new THREE.SphereGeometry(eyeRadius, 12, 8);

    const eyeLeft = new THREE.Mesh(eyeGeom);
    eyeLeft.position.set(-length * 0.4, bodyHeight * 0.06, bodyHeight * 0.1);
    eyeLeft.name = 'eye';
    group.add(eyeLeft);

    const eyeRight = new THREE.Mesh(eyeGeom);
    eyeRight.position.set(-length * 0.4, bodyHeight * 0.06, -bodyHeight * 0.1);
    eyeRight.name = 'eye';
    group.add(eyeRight);

    // === SNOUT: Long, pointed snout ===
    const snoutGeom = new THREE.ConeGeometry(bodyHeight * 0.1, length * 0.3, 12);
    const snoutMesh = new THREE.Mesh(snoutGeom);
    snoutMesh.rotation.z = Math.PI / 2;
    snoutMesh.position.set(-length * 0.6, 0, 0);
    snoutMesh.name = 'snout';
    group.add(snoutMesh);

    const mergedGeometry = this.mergeGroup(group);
    mergedGeometry.computeVertexNormals();
    return mergedGeometry;
  }

  /**
   * Create DISC fish shape (angelfish, butterflyfish style)
   * Laterally compressed, tall body, flowing fins
   */
  public static createDisc(params: {
    length?: number;
    bodyHeight?: number;
  } = {}): THREE.BufferGeometry {
    const {
      length = 0.8, // Shorter
      bodyHeight = 0.6 // Taller
    } = params;

    const group = new THREE.Group();

    // === BODY: Disc-shaped, tall and thin ===
    const bodyGeom = new THREE.SphereGeometry(1, 24, 16);
    const bodyMesh = new THREE.Mesh(bodyGeom);
    // Tall, short, thin - laterally compressed
    bodyMesh.scale.set(length * 0.35, bodyHeight * 0.5, bodyHeight * 0.2);
    bodyMesh.position.x = 0;
    group.add(bodyMesh);

    // === TAIL FIN: Fan-shaped ===
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(length * 0.2, bodyHeight * 0.25);
    tailShape.quadraticCurveTo(length * 0.25, 0, length * 0.2, -bodyHeight * 0.25);
    tailShape.closePath();

    const tailGeom = new THREE.ExtrudeGeometry(tailShape, {
      depth: bodyHeight * 0.04,
      bevelEnabled: false
    });
    const tailMesh = new THREE.Mesh(tailGeom);
    tailMesh.position.set(length * 0.25, 0, -bodyHeight * 0.02);
    tailMesh.name = 'tail';
    group.add(tailMesh);

    // === DORSAL FIN: Tall, flowing ===
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.quadraticCurveTo(-length * 0.1, bodyHeight * 0.5, -length * 0.2, bodyHeight * 0.6);
    dorsalShape.lineTo(length * 0.15, bodyHeight * 0.15);
    dorsalShape.closePath();

    const dorsalGeom = new THREE.ExtrudeGeometry(dorsalShape, {
      depth: bodyHeight * 0.03,
      bevelEnabled: false
    });
    const dorsalMesh = new THREE.Mesh(dorsalGeom);
    dorsalMesh.position.set(0, bodyHeight * 0.2, -bodyHeight * 0.015);
    dorsalMesh.name = 'dorsal';
    group.add(dorsalMesh);

    // === ANAL FIN: Tall, flowing (mirrors dorsal) ===
    const analShape = new THREE.Shape();
    analShape.moveTo(0, 0);
    analShape.quadraticCurveTo(-length * 0.08, -bodyHeight * 0.4, -length * 0.15, -bodyHeight * 0.5);
    analShape.lineTo(length * 0.1, -bodyHeight * 0.1);
    analShape.closePath();

    const analGeom = new THREE.ExtrudeGeometry(analShape, {
      depth: bodyHeight * 0.025,
      bevelEnabled: false
    });
    const analMesh = new THREE.Mesh(analGeom);
    analMesh.position.set(0, -bodyHeight * 0.18, -bodyHeight * 0.0125);
    analMesh.name = 'anal';
    group.add(analMesh);

    // === PECTORAL FINS: Rounded, delicate ===
    const pectoralShape = new THREE.Shape();
    pectoralShape.moveTo(0, 0);
    pectoralShape.quadraticCurveTo(length * 0.12, -bodyHeight * 0.05, length * 0.15, -bodyHeight * 0.15);
    pectoralShape.lineTo(length * 0.04, -bodyHeight * 0.05);
    pectoralShape.closePath();

    const pectoralGeom = new THREE.ExtrudeGeometry(pectoralShape, {
      depth: bodyHeight * 0.01,
      bevelEnabled: false
    });

    const pectoralLeft = new THREE.Mesh(pectoralGeom);
    pectoralLeft.position.set(-length * 0.1, 0, bodyHeight * 0.08);
    pectoralLeft.rotation.y = Math.PI * 0.25;
    pectoralLeft.name = 'pectoral_left';
    group.add(pectoralLeft);

    const pectoralRight = new THREE.Mesh(pectoralGeom);
    pectoralRight.position.set(-length * 0.1, 0, -bodyHeight * 0.08);
    pectoralRight.rotation.y = -Math.PI * 0.25;
    pectoralRight.scale.z = -1;
    pectoralRight.name = 'pectoral_right';
    group.add(pectoralRight);

    // === EYES: Larger, more prominent ===
    const eyeRadius = bodyHeight * 0.08;
    const eyeGeom = new THREE.SphereGeometry(eyeRadius, 12, 8);

    const eyeLeft = new THREE.Mesh(eyeGeom);
    eyeLeft.position.set(-length * 0.2, bodyHeight * 0.1, bodyHeight * 0.08);
    eyeLeft.name = 'eye';
    group.add(eyeLeft);

    const eyeRight = new THREE.Mesh(eyeGeom);
    eyeRight.position.set(-length * 0.2, bodyHeight * 0.1, -bodyHeight * 0.08);
    eyeRight.name = 'eye';
    group.add(eyeRight);

    // === SNOUT: Small, blunt ===
    const snoutGeom = new THREE.ConeGeometry(bodyHeight * 0.1, length * 0.12, 12);
    const snoutMesh = new THREE.Mesh(snoutGeom);
    snoutMesh.rotation.z = Math.PI / 2;
    snoutMesh.position.set(-length * 0.35, 0, 0);
    snoutMesh.name = 'snout';
    group.add(snoutMesh);

    const mergedGeometry = this.mergeGroup(group);
    mergedGeometry.computeVertexNormals();
    return mergedGeometry;
  }

  /**
   * Create CHUNKY fish shape (grouper, carp style)
   * Deep-bodied, robust, heavy-set appearance
   */
  public static createChunky(params: {
    length?: number;
    bodyHeight?: number;
  } = {}): THREE.BufferGeometry {
    const {
      length = 1.0,
      bodyHeight = 0.5 // Taller/wider
    } = params;

    const group = new THREE.Group();

    // === BODY: Thick, rounded ===
    const bodyGeom = new THREE.SphereGeometry(1, 24, 16);
    const bodyMesh = new THREE.Mesh(bodyGeom);
    // Robust, rounded body
    bodyMesh.scale.set(length * 0.4, bodyHeight * 0.5, bodyHeight * 0.45);
    bodyMesh.position.x = 0;
    group.add(bodyMesh);

    // === TAIL FIN: Rounded, sturdy ===
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.quadraticCurveTo(length * 0.15, bodyHeight * 0.2, length * 0.25, bodyHeight * 0.35);
    tailShape.lineTo(length * 0.28, 0);
    tailShape.lineTo(length * 0.25, -bodyHeight * 0.35);
    tailShape.quadraticCurveTo(length * 0.15, -bodyHeight * 0.2, 0, 0);
    tailShape.closePath();

    const tailGeom = new THREE.ExtrudeGeometry(tailShape, {
      depth: bodyHeight * 0.08,
      bevelEnabled: false
    });
    const tailMesh = new THREE.Mesh(tailGeom);
    tailMesh.position.set(length * 0.3, 0, -bodyHeight * 0.04);
    tailMesh.name = 'tail';
    group.add(tailMesh);

    // === DORSAL FIN: Rounded, continuous ===
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(-length * 0.15, 0);
    dorsalShape.quadraticCurveTo(-length * 0.05, bodyHeight * 0.35, length * 0.1, bodyHeight * 0.3);
    dorsalShape.lineTo(length * 0.15, bodyHeight * 0.1);
    dorsalShape.lineTo(-length * 0.15, 0);
    dorsalShape.closePath();

    const dorsalGeom = new THREE.ExtrudeGeometry(dorsalShape, {
      depth: bodyHeight * 0.05,
      bevelEnabled: false
    });
    const dorsalMesh = new THREE.Mesh(dorsalGeom);
    dorsalMesh.position.set(-length * 0.05, bodyHeight * 0.2, -bodyHeight * 0.025);
    dorsalMesh.name = 'dorsal';
    group.add(dorsalMesh);

    // === ANAL FIN: Rounded ===
    const analShape = new THREE.Shape();
    analShape.moveTo(0, 0);
    analShape.quadraticCurveTo(-length * 0.05, -bodyHeight * 0.2, 0, -bodyHeight * 0.25);
    analShape.lineTo(length * 0.1, -bodyHeight * 0.1);
    analShape.closePath();

    const analGeom = new THREE.ExtrudeGeometry(analShape, {
      depth: bodyHeight * 0.04,
      bevelEnabled: false
    });
    const analMesh = new THREE.Mesh(analGeom);
    analMesh.position.set(length * 0.05, -bodyHeight * 0.18, -bodyHeight * 0.02);
    analMesh.name = 'anal';
    group.add(analMesh);

    // === PECTORAL FINS: Rounded, paddle-like ===
    const pectoralShape = new THREE.Shape();
    pectoralShape.moveTo(0, 0);
    pectoralShape.quadraticCurveTo(length * 0.1, -bodyHeight * 0.05, length * 0.15, -bodyHeight * 0.2);
    pectoralShape.quadraticCurveTo(length * 0.08, -bodyHeight * 0.15, length * 0.03, -bodyHeight * 0.08);
    pectoralShape.closePath();

    const pectoralGeom = new THREE.ExtrudeGeometry(pectoralShape, {
      depth: bodyHeight * 0.02,
      bevelEnabled: false
    });

    const pectoralLeft = new THREE.Mesh(pectoralGeom);
    pectoralLeft.position.set(-length * 0.15, -bodyHeight * 0.05, bodyHeight * 0.2);
    pectoralLeft.rotation.y = Math.PI * 0.3;
    pectoralLeft.name = 'pectoral_left';
    group.add(pectoralLeft);

    const pectoralRight = new THREE.Mesh(pectoralGeom);
    pectoralRight.position.set(-length * 0.15, -bodyHeight * 0.05, -bodyHeight * 0.2);
    pectoralRight.rotation.y = -Math.PI * 0.3;
    pectoralRight.scale.z = -1;
    pectoralRight.name = 'pectoral_right';
    group.add(pectoralRight);

    // === EYES: Medium size ===
    const eyeRadius = bodyHeight * 0.07;
    const eyeGeom = new THREE.SphereGeometry(eyeRadius, 12, 8);

    const eyeLeft = new THREE.Mesh(eyeGeom);
    eyeLeft.position.set(-length * 0.25, bodyHeight * 0.1, bodyHeight * 0.18);
    eyeLeft.name = 'eye';
    group.add(eyeLeft);

    const eyeRight = new THREE.Mesh(eyeGeom);
    eyeRight.position.set(-length * 0.25, bodyHeight * 0.1, -bodyHeight * 0.18);
    eyeRight.name = 'eye';
    group.add(eyeRight);

    // === SNOUT: Blunt, wide mouth ===
    const snoutGeom = new THREE.ConeGeometry(bodyHeight * 0.18, length * 0.15, 12);
    const snoutMesh = new THREE.Mesh(snoutGeom);
    snoutMesh.rotation.z = Math.PI / 2;
    snoutMesh.position.set(-length * 0.42, 0, 0);
    snoutMesh.name = 'snout';
    group.add(snoutMesh);

    const mergedGeometry = this.mergeGroup(group);
    mergedGeometry.computeVertexNormals();
    return mergedGeometry;
  }

  /**
   * Merge group into single geometry with vertex colors
   */
  private static mergeGroup(group: THREE.Group): THREE.BufferGeometry {
    const geometries: { geo: THREE.BufferGeometry; name: string; matrix: THREE.Matrix4 }[] = [];

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        let geometry = child.geometry.clone();

        // Convert indexed to non-indexed
        if (geometry.index) {
          geometry = geometry.toNonIndexed();
        }

        // Apply world matrix
        child.updateMatrixWorld(true);
        geometry.applyMatrix4(child.matrixWorld);

        geometries.push({
          geo: geometry,
          name: child.name,
          matrix: child.matrixWorld.clone()
        });
      }
    });

    if (geometries.length === 0) {
      return new THREE.BufferGeometry();
    }

    // Count total vertices
    let totalVertices = 0;
    for (const item of geometries) {
      totalVertices += item.geo.getAttribute('position').count;
    }

    const mergedPositions = new Float32Array(totalVertices * 3);
    const mergedColors = new Float32Array(totalVertices * 3);
    const mergedNormals = new Float32Array(totalVertices * 3);
    // Fin type attribute for GPU animation:
    // 0 = body (no fin animation), 1 = tail, 2 = dorsal/anal, 3 = pectoral
    const mergedFinTypes = new Float32Array(totalVertices);

    let offset = 0;

    for (const item of geometries) {
      const positions = item.geo.getAttribute('position');
      const normals = item.geo.getAttribute('normal');
      const isEye = item.name === 'eye';
      const isTail = item.name === 'tail';
      const isDorsalAnal = item.name === 'dorsal' || item.name === 'anal';
      const isPectoral = item.name.includes('pectoral');
      const isFin = isTail || isDorsalAnal || isPectoral;

      // Determine fin type for animation
      let finType = 0; // body
      if (isTail) finType = 1;
      else if (isDorsalAnal) finType = 2;
      else if (isPectoral) finType = 3;

      for (let i = 0; i < positions.count; i++) {
        // Position
        mergedPositions[offset * 3] = positions.getX(i);
        mergedPositions[offset * 3 + 1] = positions.getY(i);
        mergedPositions[offset * 3 + 2] = positions.getZ(i);

        // Normals
        if (normals) {
          mergedNormals[offset * 3] = normals.getX(i);
          mergedNormals[offset * 3 + 1] = normals.getY(i);
          mergedNormals[offset * 3 + 2] = normals.getZ(i);
        }

        // Fin type for GPU animation
        mergedFinTypes[offset] = finType;

        // Vertex colors for countershading
        const y = positions.getY(i);

        if (isEye) {
          // Black eyes
          mergedColors[offset * 3] = 0.1;
          mergedColors[offset * 3 + 1] = 0.1;
          mergedColors[offset * 3 + 2] = 0.1;
        } else if (isFin) {
          // Slightly lighter fins
          mergedColors[offset * 3] = 1.1;
          mergedColors[offset * 3 + 1] = 1.1;
          mergedColors[offset * 3 + 2] = 1.1;
        } else {
          // Body countershading: dark back, light belly
          const shade = y > 0 ? 0.85 : 1.15;
          mergedColors[offset * 3] = shade;
          mergedColors[offset * 3 + 1] = shade;
          mergedColors[offset * 3 + 2] = shade;
        }

        offset++;
      }
    }

    const mergedGeometry = new THREE.BufferGeometry();
    mergedGeometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    mergedGeometry.setAttribute('color', new THREE.BufferAttribute(mergedColors, 3));
    mergedGeometry.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
    mergedGeometry.setAttribute('finType', new THREE.BufferAttribute(mergedFinTypes, 1));

    return mergedGeometry;
  }
}

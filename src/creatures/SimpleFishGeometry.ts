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
 * Helper: Create a 3D curved fin with thickness and smooth profile
 */
function createCurvedFin(
  points: THREE.Vector2[],
  thickness: number,
  segments: number = 12
): THREE.BufferGeometry {
  // Create a smooth shape from control points
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);

  if (points.length === 3) {
    shape.quadraticCurveTo(points[1].x, points[1].y, points[2].x, points[2].y);
    shape.lineTo(points[0].x, points[0].y);
  } else if (points.length === 4) {
    shape.bezierCurveTo(
      points[1].x, points[1].y,
      points[2].x, points[2].y,
      points[3].x, points[3].y
    );
    shape.lineTo(points[0].x, points[0].y);
  } else {
    // Use spline for more points
    const splinePoints = points.slice(1);
    shape.splineThru(splinePoints);
    shape.lineTo(points[0].x, points[0].y);
  }

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.3,
    bevelSize: thickness * 0.2,
    bevelSegments: 3,
    curveSegments: segments
  });

  return geom;
}

/**
 * Helper: Create a forked/lunate tail fin with 3D curvature
 */
function createForkedTail(
  width: number,
  height: number,
  thickness: number,
  forkDepth: number = 0.4
): THREE.BufferGeometry {
  // Create lunate (crescent moon) tail shape
  const shape = new THREE.Shape();
  const hw = width;
  const hh = height * 0.5;
  const forkY = hh * forkDepth;

  // Start at base center
  shape.moveTo(0, 0);
  // Upper lobe
  shape.bezierCurveTo(
    hw * 0.3, hh * 0.2,
    hw * 0.7, hh * 0.8,
    hw, hh
  );
  // Tip curve of upper lobe
  shape.bezierCurveTo(
    hw * 0.85, hh * 0.7,
    hw * 0.5, forkY * 0.5,
    hw * 0.4, 0
  );
  // Fork indent (the V between lobes)
  shape.bezierCurveTo(
    hw * 0.5, -forkY * 0.5,
    hw * 0.85, -hh * 0.7,
    hw, -hh
  );
  // Lower lobe
  shape.bezierCurveTo(
    hw * 0.7, -hh * 0.8,
    hw * 0.3, -hh * 0.2,
    0, 0
  );

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.4,
    bevelSize: thickness * 0.3,
    bevelSegments: 3,
    curveSegments: 16
  });

  return geom;
}

/**
 * Helper: Create a smooth curved dorsal/anal fin
 */
function createSmoothDorsalFin(
  baseLength: number,
  peakHeight: number,
  thickness: number,
  curveOffset: number = 0.3
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const halfLen = baseLength * 0.5;

  // Start at front base
  shape.moveTo(-halfLen, 0);
  // Rise to peak with smooth curve
  shape.bezierCurveTo(
    -halfLen * curveOffset, peakHeight * 0.9,
    halfLen * 0.2, peakHeight,
    halfLen * 0.5, peakHeight * 0.6
  );
  // Taper down to back base
  shape.bezierCurveTo(
    halfLen * 0.7, peakHeight * 0.3,
    halfLen * 0.9, peakHeight * 0.1,
    halfLen, 0
  );
  // Close along base
  shape.lineTo(-halfLen, 0);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.3,
    bevelSize: thickness * 0.2,
    bevelSegments: 2,
    curveSegments: 14
  });

  return geom;
}

/**
 * Helper: Create a leaf-shaped pectoral fin with 3D curvature
 */
function createLeafFin(
  finLength: number,
  finWidth: number,
  thickness: number
): THREE.BufferGeometry {
  const shape = new THREE.Shape();

  // Leaf/teardrop shape
  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    finLength * 0.3, finWidth * 0.5,
    finLength * 0.7, finWidth * 0.4,
    finLength, 0
  );
  shape.bezierCurveTo(
    finLength * 0.7, -finWidth * 0.4,
    finLength * 0.3, -finWidth * 0.5,
    0, 0
  );

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.4,
    bevelSize: thickness * 0.3,
    bevelSegments: 2,
    curveSegments: 14
  });

  return geom;
}

/**
 * Simple Fish Geometry - creates obviously fish-shaped meshes
 * using basic primitives for guaranteed recognizable fish appearance.
 * Supports 4 distinct body types for visual variety.
 */
export class SimpleFishGeometry {

  /**
   * Anatomical fusiform body (lathe of elliptical cross-sections) — snout → belly →
   * caudal peduncle. Replaces stretched spheres that always read as "toy lozenges".
   */
  private static createFusiformBody(
    length: number,
    height: number,
    width: number,
    kind: 'standard' | 'slender' | 'disc' | 'chunky'
  ): THREE.BufferGeometry {
    const segments = 72;
    const radial = 36;
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    // Head at -X, tail at +X (matches fin placement elsewhere)
    const x0 = -length * 0.52;
    const x1 = length * 0.48;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = x0 + (x1 - x0) * t;

      let profile: number;
      let yMul = 1;
      let zMul = 1;
      if (kind === 'slender') {
        if (t < 0.18) profile = 0.22 + (t / 0.18) * 0.78;
        else if (t < 0.55) profile = 1.0 - ((t - 0.18) / 0.37) * 0.12;
        else profile = 0.88 * Math.pow(1 - (t - 0.55) / 0.45, 1.55);
        yMul = 0.85;
        zMul = 0.7;
      } else if (kind === 'disc') {
        if (t < 0.2) profile = 0.35 + (t / 0.2) * 0.65;
        else if (t < 0.72) profile = 1.0;
        else profile = Math.pow(1 - (t - 0.72) / 0.28, 0.85);
        yMul = 1.35;
        zMul = 0.45;
      } else if (kind === 'chunky') {
        if (t < 0.22) profile = 0.4 + (t / 0.22) * 0.6;
        else if (t < 0.62) profile = 1.0;
        else profile = 0.95 * Math.pow(1 - (t - 0.62) / 0.38, 1.1);
        yMul = 1.15;
        zMul = 1.05;
      } else {
        // standard tuna/bass fusiform
        if (t < 0.16) profile = 0.28 + Math.sin((t / 0.16) * Math.PI * 0.5) * 0.72;
        else if (t < 0.5) profile = 1.0 - ((t - 0.16) / 0.34) * 0.08;
        else if (t < 0.78) profile = 0.92 - ((t - 0.5) / 0.28) * 0.42;
        else profile = 0.5 * Math.pow(1 - (t - 0.78) / 0.22, 1.7);
        yMul = 1.0;
        zMul = 0.72;
      }

      const rh = height * profile * yMul;
      const rw = width * profile * zMul;
      const bellyBoost = kind === 'disc' ? 0.06 : 0.14;

      for (let j = 0; j <= radial; j++) {
        const angle = (j / radial) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const belly = 1 + bellyBoost * Math.max(0, -cosA) * Math.max(0, 1 - Math.abs(t - 0.35) * 1.5);
        const y = cosA * rh * (cosA < 0 ? belly : 1);
        const z = sinA * rw;
        positions.push(x, y, z);
        const nx = (t < 0.5 ? -0.15 : 0.35) * (1 - profile);
        const ny = cosA / Math.max(rh, 1e-4);
        const nz = sinA / Math.max(rw, 1e-4);
        const nl = Math.hypot(nx, ny, nz) || 1;
        normals.push(nx / nl, ny / nl, nz / nl);
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        const c = a + 1;
        const d = b + 1;
        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  /** Soft mouth opening on the snout — dark interior so the head reads as a face. */
  private static addMouth(group: THREE.Group, x: number, width: number, height: number): void {
    const mouth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)
    );
    mouth.scale.set(width * 0.55, height * 0.35, width * 0.4);
    mouth.position.set(x, -height * 0.15, 0);
    mouth.rotation.z = Math.PI * 0.08;
    mouth.name = 'gill'; // dark vertex color + skip body pattern
    group.add(mouth);
  }

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

    // === BODY: true fusiform lathe (snout → girth → caudal peduncle) ===
    const bodyMesh = new THREE.Mesh(
      this.createFusiformBody(length, bodyHeight * 0.42, bodyHeight * 0.3, 'standard')
    );
    bodyMesh.name = 'body';
    group.add(bodyMesh);

    // === TAIL FIN: Forked/lunate 3D tail ===
    const tailGeom = createForkedTail(
      length * 0.3,
      bodyHeight * 0.9,
      bodyHeight * 0.12,
      0.35
    );
    const tailMesh = new THREE.Mesh(tailGeom);
    tailMesh.position.set(length * 0.46, 0, -bodyHeight * 0.06);
    tailMesh.name = 'tail';
    group.add(tailMesh);

    // === DORSAL FIN: Smooth curved profile with thickness ===
    const dorsalGeom = createSmoothDorsalFin(
      length * 0.3,
      bodyHeight * 0.45,
      bodyHeight * 0.08
    );
    const dorsalMesh = new THREE.Mesh(dorsalGeom);
    dorsalMesh.position.set(-length * 0.05, bodyHeight * 0.2, -bodyHeight * 0.04);
    dorsalMesh.name = 'dorsal';
    group.add(dorsalMesh);

    // === ANAL FIN: Smaller curved fin ===
    const analGeom = createSmoothDorsalFin(
      length * 0.18,
      bodyHeight * 0.25,
      bodyHeight * 0.06
    );
    const analMesh = new THREE.Mesh(analGeom);
    analMesh.position.set(length * 0.1, -bodyHeight * 0.2, -bodyHeight * 0.03);
    analMesh.rotation.x = Math.PI; // Flip for bottom
    analMesh.name = 'anal';
    group.add(analMesh);

    // === PECTORAL FINS: Leaf-shaped with 3D form ===
    const pectoralGeom = createLeafFin(
      length * 0.2,
      bodyHeight * 0.15,
      bodyHeight * 0.04
    );

    // Left pectoral
    const pectoralLeft = new THREE.Mesh(pectoralGeom);
    pectoralLeft.position.set(-length * 0.15, -bodyHeight * 0.05, bodyHeight * 0.15);
    pectoralLeft.rotation.y = Math.PI * 0.3;
    pectoralLeft.rotation.x = -0.2;
    pectoralLeft.name = 'pectoral_left';
    group.add(pectoralLeft);

    // Right pectoral
    const pectoralRight = new THREE.Mesh(pectoralGeom);
    pectoralRight.position.set(-length * 0.15, -bodyHeight * 0.05, -bodyHeight * 0.15);
    pectoralRight.rotation.y = -Math.PI * 0.3;
    pectoralRight.rotation.x = 0.2;
    pectoralRight.scale.z = -1;
    pectoralRight.name = 'pectoral_right';
    group.add(pectoralRight);

    // === EYES: sclera + pupil (vertex colors make these read once material enables them)
    this.addEyePair(group, -length * 0.3, bodyHeight * 0.08, bodyHeight * 0.13, bodyHeight * 0.085);

    // === PELVIC FINS: small paired bottom fins — completes the silhouette
    const pelvicGeom = createLeafFin(length * 0.12, bodyHeight * 0.1, bodyHeight * 0.03);
    const pelvicLeft = new THREE.Mesh(pelvicGeom);
    pelvicLeft.position.set(length * 0.02, -bodyHeight * 0.18, bodyHeight * 0.08);
    pelvicLeft.rotation.set(0.55, 0.15, 0.35);
    pelvicLeft.name = 'anal'; // animate with dorsal/anal sway
    group.add(pelvicLeft);
    const pelvicRight = new THREE.Mesh(pelvicGeom);
    pelvicRight.position.set(length * 0.02, -bodyHeight * 0.18, -bodyHeight * 0.08);
    pelvicRight.rotation.set(0.55, -0.15, -0.35);
    pelvicRight.scale.z = -1;
    pelvicRight.name = 'anal';
    group.add(pelvicRight);

    // === GILL SLITS: dark strips behind the head
    this.addGillSlits(group, -length * 0.18, bodyHeight * 0.22, bodyHeight * 0.12);

    // === MOUTH: dark ventral opening under the snout
    this.addMouth(group, -length * 0.48, bodyHeight * 0.22, bodyHeight * 0.18);

    // === SNOUT: Pointed nose cone ===
    const snoutGeom = new THREE.ConeGeometry(bodyHeight * 0.15, length * 0.2, 16);
    const snoutMesh = new THREE.Mesh(snoutGeom);
    snoutMesh.rotation.z = Math.PI / 2;
    snoutMesh.position.set(-length * 0.52, 0, 0);
    snoutMesh.name = 'snout';
    group.add(snoutMesh);

    // Merge all geometries. Do NOT recompute normals on the merged non-indexed soup —
    // that flat-facets the whole fish (the STANDARD body used to, unlike the other 3
    // types, which is why ~a quarter of every school looked crude). mergeGroup already
    // transforms each part's smooth normals via applyMatrix4.
    const mergedGeometry = this.mergeGroup(group);

    return mergedGeometry;
  }

  /** Cream sclera + amber iris + dark pupil on both flanks. */
  private static addEyePair(
    group: THREE.Group,
    x: number,
    y: number,
    z: number,
    radius: number
  ): void {
    // Oversized slightly so eyes read at schooling distance
    const r = radius * 1.4;
    const scleraGeom = new THREE.SphereGeometry(r, 18, 14);
    const irisGeom = new THREE.SphereGeometry(r * 0.72, 14, 12);
    const pupilGeom = new THREE.SphereGeometry(r * 0.38, 12, 10);

    for (const side of [1, -1] as const) {
      const sclera = new THREE.Mesh(scleraGeom);
      sclera.position.set(x, y, z * side);
      sclera.name = 'eye';
      group.add(sclera);

      const iris = new THREE.Mesh(irisGeom);
      iris.position.set(x - r * 0.06, y, side * (Math.abs(z) + r * 0.38));
      iris.name = 'iris';
      group.add(iris);

      const pupil = new THREE.Mesh(pupilGeom);
      pupil.position.set(x - r * 0.14, y, side * (Math.abs(z) + r * 0.62));
      pupil.name = 'pupil';
      group.add(pupil);
    }
  }

  /** Dark gill-cover marks behind the operculum. */
  private static addGillSlits(
    group: THREE.Group,
    x: number,
    height: number,
    depth: number
  ): void {
    for (const side of [1, -1] as const) {
      for (let g = 0; g < 3; g++) {
        const slit = new THREE.Mesh(
          new THREE.BoxGeometry(height * 0.04, height * 0.55, depth * 0.08)
        );
        slit.position.set(x + g * height * 0.06, 0, side * depth);
        slit.rotation.z = side * 0.15;
        slit.name = 'gill';
        group.add(slit);
      }
    }
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
      bodyHeight = 0.25
    } = params;

    const group = new THREE.Group();

    // === BODY: elongated fusiform (needlefish / barracuda) ===
    const bodyMesh = new THREE.Mesh(
      this.createFusiformBody(length, bodyHeight * 0.35, bodyHeight * 0.28, 'slender')
    );
    bodyMesh.name = 'body';
    group.add(bodyMesh);

    // === TAIL FIN: Forked tail, smaller for slender body ===
    const tailGeom = createForkedTail(
      length * 0.22,
      bodyHeight * 0.7,
      bodyHeight * 0.08,
      0.4
    );
    const tailMesh = new THREE.Mesh(tailGeom);
    tailMesh.position.set(length * 0.45, 0, -bodyHeight * 0.04);
    tailMesh.name = 'tail';
    group.add(tailMesh);

    // === DORSAL FIN: Small, set back ===
    const dorsalGeom = createSmoothDorsalFin(
      length * 0.16,
      bodyHeight * 0.3,
      bodyHeight * 0.05
    );
    const dorsalMesh = new THREE.Mesh(dorsalGeom);
    dorsalMesh.position.set(length * 0.1, bodyHeight * 0.12, -bodyHeight * 0.025);
    dorsalMesh.name = 'dorsal';
    group.add(dorsalMesh);

    // === ANAL FIN: Small ===
    const analGeom = createSmoothDorsalFin(
      length * 0.12,
      bodyHeight * 0.2,
      bodyHeight * 0.04
    );
    const analMesh = new THREE.Mesh(analGeom);
    analMesh.position.set(length * 0.15, -bodyHeight * 0.1, -bodyHeight * 0.02);
    analMesh.rotation.x = Math.PI;
    analMesh.name = 'anal';
    group.add(analMesh);

    // === PECTORAL FINS: Small, swept back ===
    const pectoralGeom = createLeafFin(
      length * 0.12,
      bodyHeight * 0.1,
      bodyHeight * 0.03
    );

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

    // === EYES ===
    this.addEyePair(group, -length * 0.4, bodyHeight * 0.06, bodyHeight * 0.1, bodyHeight * 0.075);
    this.addGillSlits(group, -length * 0.28, bodyHeight * 0.16, bodyHeight * 0.1);
    this.addMouth(group, -length * 0.55, bodyHeight * 0.12, bodyHeight * 0.1);

    // === SNOUT: Long, pointed ===
    const snoutGeom = new THREE.ConeGeometry(bodyHeight * 0.1, length * 0.3, 16);
    const snoutMesh = new THREE.Mesh(snoutGeom);
    snoutMesh.rotation.z = Math.PI / 2;
    snoutMesh.position.set(-length * 0.6, 0, 0);
    snoutMesh.name = 'snout';
    group.add(snoutMesh);

    const mergedGeometry = this.mergeGroup(group);
    // Keep the smooth per-part normals (mergeGroup transforms them via applyMatrix4).
    // Recomputing on non-indexed merged geometry would force FLAT faceted shading —
    // the main reason the fish read as crude/low-poly.
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
      length = 0.8,
      bodyHeight = 0.6
    } = params;

    const group = new THREE.Group();

    // === BODY: laterally compressed disc (angel / butterfly) ===
    const bodyMesh = new THREE.Mesh(
      this.createFusiformBody(length * 0.55, bodyHeight * 0.52, bodyHeight * 0.2, 'disc')
    );
    bodyMesh.name = 'body';
    group.add(bodyMesh);

    // === TAIL FIN: Fan-shaped with 3D form ===
    const tailGeom = createForkedTail(
      length * 0.18,
      bodyHeight * 0.45,
      bodyHeight * 0.06,
      0.2 // Less forked, more fan-like
    );
    const tailMesh = new THREE.Mesh(tailGeom);
    tailMesh.position.set(length * 0.25, 0, -bodyHeight * 0.03);
    tailMesh.name = 'tail';
    group.add(tailMesh);

    // === DORSAL FIN: Tall, flowing ===
    const dorsalGeom = createSmoothDorsalFin(
      length * 0.4,
      bodyHeight * 0.55,
      bodyHeight * 0.05,
      0.5
    );
    const dorsalMesh = new THREE.Mesh(dorsalGeom);
    dorsalMesh.position.set(0, bodyHeight * 0.22, -bodyHeight * 0.025);
    dorsalMesh.name = 'dorsal';
    group.add(dorsalMesh);

    // === ANAL FIN: Tall, flowing (mirrors dorsal) ===
    const analGeom = createSmoothDorsalFin(
      length * 0.3,
      bodyHeight * 0.45,
      bodyHeight * 0.04,
      0.4
    );
    const analMesh = new THREE.Mesh(analGeom);
    analMesh.position.set(0, -bodyHeight * 0.2, -bodyHeight * 0.02);
    analMesh.rotation.x = Math.PI;
    analMesh.name = 'anal';
    group.add(analMesh);

    // === PECTORAL FINS: Rounded, delicate ===
    const pectoralGeom = createLeafFin(
      length * 0.15,
      bodyHeight * 0.1,
      bodyHeight * 0.025
    );

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

    // === EYES ===
    this.addEyePair(group, -length * 0.2, bodyHeight * 0.1, bodyHeight * 0.08, bodyHeight * 0.085);
    this.addGillSlits(group, -length * 0.12, bodyHeight * 0.2, bodyHeight * 0.08);
    this.addMouth(group, -length * 0.32, bodyHeight * 0.12, bodyHeight * 0.12);

    // === SNOUT: Small, blunt ===
    const snoutGeom = new THREE.ConeGeometry(bodyHeight * 0.1, length * 0.12, 16);
    const snoutMesh = new THREE.Mesh(snoutGeom);
    snoutMesh.rotation.z = Math.PI / 2;
    snoutMesh.position.set(-length * 0.35, 0, 0);
    snoutMesh.name = 'snout';
    group.add(snoutMesh);

    const mergedGeometry = this.mergeGroup(group);
    // Keep the smooth per-part normals (mergeGroup transforms them via applyMatrix4).
    // Recomputing on non-indexed merged geometry would force FLAT faceted shading —
    // the main reason the fish read as crude/low-poly.
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
      bodyHeight = 0.5
    } = params;

    const group = new THREE.Group();

    // === BODY: deep robust fusiform (grouper / carp) ===
    const bodyMesh = new THREE.Mesh(
      this.createFusiformBody(length * 0.82, bodyHeight * 0.52, bodyHeight * 0.46, 'chunky')
    );
    bodyMesh.name = 'body';
    group.add(bodyMesh);

    // === TAIL FIN: Rounded, sturdy forked tail ===
    const tailGeom = createForkedTail(
      length * 0.25,
      bodyHeight * 0.65,
      bodyHeight * 0.1,
      0.25 // Less deeply forked
    );
    const tailMesh = new THREE.Mesh(tailGeom);
    tailMesh.position.set(length * 0.3, 0, -bodyHeight * 0.05);
    tailMesh.name = 'tail';
    group.add(tailMesh);

    // === DORSAL FIN: Rounded, continuous ===
    const dorsalGeom = createSmoothDorsalFin(
      length * 0.35,
      bodyHeight * 0.35,
      bodyHeight * 0.07,
      0.4
    );
    const dorsalMesh = new THREE.Mesh(dorsalGeom);
    dorsalMesh.position.set(-length * 0.05, bodyHeight * 0.22, -bodyHeight * 0.035);
    dorsalMesh.name = 'dorsal';
    group.add(dorsalMesh);

    // === ANAL FIN: Rounded ===
    const analGeom = createSmoothDorsalFin(
      length * 0.2,
      bodyHeight * 0.25,
      bodyHeight * 0.05
    );
    const analMesh = new THREE.Mesh(analGeom);
    analMesh.position.set(length * 0.05, -bodyHeight * 0.2, -bodyHeight * 0.025);
    analMesh.rotation.x = Math.PI;
    analMesh.name = 'anal';
    group.add(analMesh);

    // === PECTORAL FINS: Rounded, paddle-like ===
    const pectoralGeom = createLeafFin(
      length * 0.18,
      bodyHeight * 0.14,
      bodyHeight * 0.04
    );

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

    // === EYES ===
    this.addEyePair(group, -length * 0.25, bodyHeight * 0.1, bodyHeight * 0.18, bodyHeight * 0.08);
    this.addGillSlits(group, -length * 0.14, bodyHeight * 0.28, bodyHeight * 0.18);
    this.addMouth(group, -length * 0.38, bodyHeight * 0.28, bodyHeight * 0.2);

    // === SNOUT: Blunt, wide mouth ===
    const snoutGeom = new THREE.ConeGeometry(bodyHeight * 0.18, length * 0.15, 16);
    const snoutMesh = new THREE.Mesh(snoutGeom);
    snoutMesh.rotation.z = Math.PI / 2;
    snoutMesh.position.set(-length * 0.42, 0, 0);
    snoutMesh.name = 'snout';
    group.add(snoutMesh);

    const mergedGeometry = this.mergeGroup(group);
    // Keep the smooth per-part normals (mergeGroup transforms them via applyMatrix4).
    // Recomputing on non-indexed merged geometry would force FLAT faceted shading —
    // the main reason the fish read as crude/low-poly.
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
      const isPupil = item.name === 'pupil';
      const isIris = item.name === 'iris';
      const isGill = item.name === 'gill';
      const isTail = item.name === 'tail';
      const isDorsalAnal = item.name === 'dorsal' || item.name === 'anal';
      const isPectoral = item.name.includes('pectoral');
      const isFin = isTail || isDorsalAnal || isPectoral;

      // Fin type for GPU animation
        // 0 body, 1 tail, 2 dorsal/anal/pelvic, 3 pectoral, 4 eye/pupil/iris/gill (no pattern)
        let finType = 0;
        if (isPupil || isEye || isGill || isIris) finType = 4;
        else if (isTail) finType = 1;
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

        // Vertex colors for countershading / eyes / gills
        const y = positions.getY(i);

        if (isPupil) {
          mergedColors[offset * 3] = 0.04;
          mergedColors[offset * 3 + 1] = 0.05;
          mergedColors[offset * 3 + 2] = 0.06;
        } else if (isIris) {
          mergedColors[offset * 3] = 0.72;
          mergedColors[offset * 3 + 1] = 0.48;
          mergedColors[offset * 3 + 2] = 0.18;
        } else if (isEye) {
          // Cream sclera so eyes read against body color
          mergedColors[offset * 3] = 0.95;
          mergedColors[offset * 3 + 1] = 0.96;
          mergedColors[offset * 3 + 2] = 0.9;
        } else if (isGill) {
          mergedColors[offset * 3] = 0.22;
          mergedColors[offset * 3 + 1] = 0.2;
          mergedColors[offset * 3 + 2] = 0.24;
        } else if (isFin) {
          // Slightly lighter fins
          mergedColors[offset * 3] = 1.12;
          mergedColors[offset * 3 + 1] = 1.1;
          mergedColors[offset * 3 + 2] = 1.08;
        } else {
          // Body countershading: dark back, light belly
          const shade = y > 0 ? 0.82 : 1.18;
          mergedColors[offset * 3] = shade;
          mergedColors[offset * 3 + 1] = shade * 1.02;
          mergedColors[offset * 3 + 2] = shade * 1.05;
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

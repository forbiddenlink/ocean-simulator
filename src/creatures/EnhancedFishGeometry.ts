import * as THREE from 'three';

/**
 * Enhanced Procedural Fish Geometry with Anatomically Correct Details
 * Based on real fish anatomy research for photorealistic appearance
 */
export class EnhancedFishGeometry {
  
  /**
   * Create a high-detail anatomically correct fish
   */
  public static createFish(params: {
    length?: number;
    species?: 'tropical' | 'tuna' | 'bass' | 'generic';
    quality?: 'low' | 'medium' | 'high' | 'ultra';
  } = {}): THREE.BufferGeometry {
    const {
      length = 1.0,
      species = 'generic',
      quality = 'high'
    } = params;

    // Quality settings
    const qualitySettings = {
      low: { bodySegments: 32, radialSegments: 16, finDetail: 6 },
      medium: { bodySegments: 48, radialSegments: 24, finDetail: 8 },
      high: { bodySegments: 64, radialSegments: 32, finDetail: 12 },
      ultra: { bodySegments: 96, radialSegments: 48, finDetail: 16 }
    };

    const settings = qualitySettings[quality];

    // Species-specific proportions
    const proportions = this.getSpeciesProportions(species);

    const group = new THREE.Group();

    // Main body with anatomically correct profile
    const bodyGeometry = this.createAnatomicalBody(
      length,
      proportions,
      settings.bodySegments,
      settings.radialSegments
    );
    const bodyMesh = new THREE.Mesh(bodyGeometry);
    bodyMesh.name = 'body';
    group.add(bodyMesh);

    // Head details
    const headGroup = this.createHeadDetails(length, proportions);
    headGroup.position.x = -length * 0.35;
    group.add(headGroup);

    // Caudal fin (tail) with fin rays
    const caudal = this.createCaudalFin(length, proportions, settings.finDetail);
    caudal.position.x = length * 0.45;
    caudal.name = 'caudal_fin';
    group.add(caudal);

    // Dorsal fin(s) with fin rays
    const dorsal = this.createDorsalFinWithRays(length, proportions, settings.finDetail);
    dorsal.position.set(-length * 0.05, length * proportions.bodyHeight * 0.5, 0);
    dorsal.name = 'dorsal_fin';
    group.add(dorsal);

    // Anal fin
    const anal = this.createAnalFinWithRays(length, proportions, settings.finDetail);
    anal.position.set(length * 0.15, -length * proportions.bodyHeight * 0.35, 0);
    anal.name = 'anal_fin';
    group.add(anal);

    // Pectoral fins (paired)
    const pectoralLeft = this.createPectoralFinWithRays(length, proportions, settings.finDetail);
    pectoralLeft.position.set(-length * 0.2, -length * 0.05, length * proportions.bodyWidth * 0.45);
    pectoralLeft.rotation.set(0.3, 0, 0.2);
    pectoralLeft.name = 'pectoral_left';
    group.add(pectoralLeft);

    const pectoralRight = pectoralLeft.clone();
    pectoralRight.position.z = -length * proportions.bodyWidth * 0.45;
    pectoralRight.rotation.z = -0.2;
    pectoralRight.name = 'pectoral_right';
    group.add(pectoralRight);

    // Pelvic fins (paired)
    const pelvicLeft = this.createPelvicFin(length, proportions);
    pelvicLeft.position.set(-length * 0.05, -length * proportions.bodyHeight * 0.35, length * 0.12);
    pelvicLeft.rotation.set(0.5, 0, 0.3);
    pelvicLeft.name = 'pelvic_left';
    group.add(pelvicLeft);

    const pelvicRight = pelvicLeft.clone();
    pelvicRight.position.z = -length * 0.12;
    pelvicRight.rotation.z = -0.3;
    pelvicRight.name = 'pelvic_right';
    group.add(pelvicRight);

    // Merge all geometries
    const mergedGeometry = this.mergeGroup(group);
    mergedGeometry.computeVertexNormals();
    // Note: Tangents are computed procedurally in the shader

    return mergedGeometry;
  }

  /**
   * Get species-specific anatomical proportions
   */
  private static getSpeciesProportions(species: string) {
    const proportions: Record<string, any> = {
      generic: {
        bodyHeight: 0.3,
        bodyWidth: 0.22,
        headLength: 0.22,
        tailTaper: 0.7,
        dorsalHeight: 0.45,
        caudalSpread: 0.8,
        caudalFork: 0.3
      },
      tropical: {
        bodyHeight: 0.45, // Taller, more compressed
        bodyWidth: 0.15,
        headLength: 0.2,
        tailTaper: 0.65,
        dorsalHeight: 0.6, // Larger dorsal
        caudalSpread: 0.7,
        caudalFork: 0.2
      },
      tuna: {
        bodyHeight: 0.25, // Streamlined
        bodyWidth: 0.2,
        headLength: 0.25,
        tailTaper: 0.85, // Aggressive taper
        dorsalHeight: 0.35,
        caudalSpread: 0.9, // Wide lunate tail
        caudalFork: 0.5 // Deep fork
      },
      bass: {
        bodyHeight: 0.35,
        bodyWidth: 0.28, // Stockier
        headLength: 0.28, // Larger head
        tailTaper: 0.6,
        dorsalHeight: 0.5,
        caudalSpread: 0.75,
        caudalFork: 0.25
      }
    };

    return proportions[species] || proportions.generic;
  }

  /**
   * Create anatomically correct fish body with research-based profile
   */
  private static createAnatomicalBody(
    length: number,
    proportions: any,
    segments: number,
    radialSegments: number
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const bodyHeight = length * proportions.bodyHeight;
    const bodyWidth = length * proportions.bodyWidth;

    // Create body with realistic fish profile curve
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * length;

      // Anatomically correct profile (based on real fish measurements)
      let heightProfile: number;
      let widthProfile: number;

      if (t < 0.22) {
        // Head region: gradual expansion from snout
        const headT = t / 0.22;
        heightProfile = 0.35 + headT * 0.65; // Starts narrow, expands
        widthProfile = 0.4 + headT * 0.6;
      } else if (t < 0.35) {
        // Gill/shoulder region: maximum girth
        const shoulderT = (t - 0.22) / 0.13;
        heightProfile = 1.0 - shoulderT * 0.05; // Peak girth
        widthProfile = 1.0 - shoulderT * 0.05;
      } else if (t < 0.75) {
        // Main body: gradual taper
        const bodyT = (t - 0.35) / 0.4;
        heightProfile = 0.95 - bodyT * 0.3;
        widthProfile = 0.95 - bodyT * 0.35;
      } else {
        // Caudal peduncle: rapid taper to tail
        const tailT = (t - 0.75) / 0.25;
        heightProfile = 0.65 * (1.0 - tailT * tailT * proportions.tailTaper);
        widthProfile = 0.6 * (1.0 - tailT * tailT * proportions.tailTaper);
      }

      const radiusH = bodyHeight * heightProfile;
      const radiusW = bodyWidth * widthProfile;

      // Create cross-section (laterally compressed, fusiform shape)
      for (let j = 0; j <= radialSegments; j++) {
        const angle = (j / radialSegments) * Math.PI * 2;
        
        // Elliptical cross-section (taller than wide)
        const y = Math.cos(angle) * radiusH;
        const z = Math.sin(angle) * radiusW;

        positions.push(x, y, z);

        // UV coordinates for texturing
        uvs.push(t, j / radialSegments);

        // Vertex colors: countershading (light belly, dark back)
        const dorsalFactor = (Math.cos(angle) + 1.0) / 2.0; // 1.0 at top, 0.0 at bottom
        const backColor = 0.85; // Darker back
        const bellyColor = 1.3; // Lighter belly
        const colorValue = dorsalFactor * backColor + (1.0 - dorsalFactor) * bellyColor;
        colors.push(colorValue, colorValue, colorValue);

        // Normal (will be recomputed, but set initial)
        const normal = new THREE.Vector3(0, y, z).normalize();
        normals.push(normal.x, normal.y, normal.z);
      }
    }

    // Create indices for triangles
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
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);

    geometry.computeVertexNormals();
    return geometry;
  }

  /**
   * Create head details (eyes, mouth, gills)
   */
  private static createHeadDetails(length: number, proportions: any): THREE.Group {
    const headGroup = new THREE.Group();
    const headSize = length * proportions.headLength;

    // Eyes (anatomically correct with sclera, iris, pupil)
    const eyeSize = headSize * 0.18;
    const eyeDistance = length * proportions.bodyWidth * 0.9;

    // Left eye
    const eyeLeft = this.createEye(eyeSize);
    eyeLeft.position.set(headSize * 0.3, headSize * 0.4, eyeDistance / 2);
    eyeLeft.rotation.y = Math.PI * 0.15;
    headGroup.add(eyeLeft);

    // Right eye
    const eyeRight = this.createEye(eyeSize);
    eyeRight.position.set(headSize * 0.3, headSize * 0.4, -eyeDistance / 2);
    eyeRight.rotation.y = -Math.PI * 0.15;
    headGroup.add(eyeRight);

    // Mouth (subtle geometry)
    const mouthGeometry = this.createMouth(headSize);
    const mouth = new THREE.Mesh(mouthGeometry);
    mouth.position.set(headSize * 0.8, -headSize * 0.1, 0);
    mouth.name = 'mouth';
    headGroup.add(mouth);

    // Gill slits (decorative detail)
    const gillLeft = this.createGillSlits(headSize);
    gillLeft.position.set(0, 0, eyeDistance / 2.2);
    headGroup.add(gillLeft);

    const gillRight = gillLeft.clone();
    gillRight.position.z = -eyeDistance / 2.2;
    gillRight.scale.z = -1;
    headGroup.add(gillRight);

    return headGroup;
  }

  /**
   * Create realistic eye with sclera, iris, and pupil
   */
  private static createEye(size: number): THREE.Group {
    const eyeGroup = new THREE.Group();

    // Sclera (white/silver outer eye)
    const scleraGeom = new THREE.SphereGeometry(size, 16, 16);
    const scleraMesh = new THREE.Mesh(scleraGeom);
    scleraMesh.name = 'eye_sclera';
    
    // Add vertex colors for sclera
    const scleraColors = new Float32Array(scleraGeom.attributes.position.count * 3);
    scleraColors.fill(1.5); // Bright white
    scleraGeom.setAttribute('color', new THREE.BufferAttribute(scleraColors, 3));
    
    eyeGroup.add(scleraMesh);

    // Iris (colored ring)
    const irisGeom = new THREE.SphereGeometry(size * 0.7, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const irisMesh = new THREE.Mesh(irisGeom);
    irisMesh.position.z = size * 0.3;
    irisMesh.name = 'eye_iris';
    
    const irisColors = new Float32Array(irisGeom.attributes.position.count * 3);
    irisColors.fill(0.8); // Gray iris
    irisGeom.setAttribute('color', new THREE.BufferAttribute(irisColors, 3));
    
    eyeGroup.add(irisMesh);

    // Pupil (black center)
    const pupilGeom = new THREE.SphereGeometry(size * 0.35, 12, 12);
    const pupilMesh = new THREE.Mesh(pupilGeom);
    pupilMesh.position.z = size * 0.5;
    pupilMesh.name = 'eye_pupil';
    
    const pupilColors = new Float32Array(pupilGeom.attributes.position.count * 3);
    pupilColors.fill(0.05); // Black
    pupilGeom.setAttribute('color', new THREE.BufferAttribute(pupilColors, 3));
    
    eyeGroup.add(pupilMesh);

    return eyeGroup;
  }

  /**
   * Create mouth geometry
   */
  private static createMouth(headSize: number): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(headSize * 0.15, -headSize * 0.05, headSize * 0.25, -headSize * 0.02);
    shape.lineTo(headSize * 0.25, 0);
    shape.quadraticCurveTo(headSize * 0.15, -headSize * 0.02, 0, 0);

    const geometry = new THREE.ShapeGeometry(shape);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    colors.fill(0.3); // Dark mouth
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return geometry;
  }

  /**
   * Create gill slits
   */
  private static createGillSlits(headSize: number): THREE.Group {
    const gillGroup = new THREE.Group();
    const slitCount = 3;

    for (let i = 0; i < slitCount; i++) {
      const shape = new THREE.Shape();
      const width = headSize * 0.03;
      const height = headSize * 0.2;
      const curve = headSize * 0.1;

      shape.moveTo(0, -height / 2);
      shape.quadraticCurveTo(curve, 0, 0, height / 2);
      shape.lineTo(-width, height / 2);
      shape.quadraticCurveTo(curve - width, 0, -width, -height / 2);

      const geometry = new THREE.ShapeGeometry(shape);
      const mesh = new THREE.Mesh(geometry);
      mesh.position.set(-headSize * 0.15 + i * headSize * 0.05, 0, 0);
      mesh.rotation.y = Math.PI / 2;
      gillGroup.add(mesh);
    }

    return gillGroup;
  }

  /**
   * Create caudal fin (tail) with visible fin rays and forked shape
   */
  private static createCaudalFin(length: number, proportions: any, finDetail: number): THREE.Mesh {
    const finLength = length * 0.35;
    const finHeight = length * proportions.bodyHeight * proportions.caudalSpread;
    const forkDepth = finHeight * proportions.caudalFork;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Center attachment point
    positions.push(0, 0, 0);
    colors.push(1.0, 1.0, 1.0);

    // Upper lobe
    for (let i = 0; i <= finDetail; i++) {
      const t = i / finDetail;
      const angle = -Math.PI * 0.35 + t * Math.PI * 0.25;
      const radius = finLength * (0.6 + t * 0.4);
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius + forkDepth * (1.0 - t);
      const z = (t - 0.5) * length * 0.08; // Slight thickness

      positions.push(x, y, z);
      colors.push(0.95, 0.95, 0.95);

      // Fin rays (darker lines)
      if (i > 0) {
        positions.push(x * 0.3, y * 0.3, z);
        colors.push(0.6, 0.6, 0.6);
      }
    }

    // Lower lobe (mirror)
    for (let i = 0; i <= finDetail; i++) {
      const t = i / finDetail;
      const angle = Math.PI * 0.35 - t * Math.PI * 0.25;
      const radius = finLength * (0.6 + t * 0.4);
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius - forkDepth * (1.0 - t);
      const z = (t - 0.5) * length * 0.08;

      positions.push(x, y, z);
      colors.push(0.95, 0.95, 0.95);

      if (i > 0) {
        positions.push(x * 0.3, y * 0.3, z);
        colors.push(0.6, 0.6, 0.6);
      }
    }

    // Create triangles for fin membrane
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

  /**
   * Create dorsal fin with fin rays
   */
  private static createDorsalFinWithRays(length: number, proportions: any, rayCount: number): THREE.Mesh {
    const finLength = length * 0.35;
    const finHeight = length * proportions.dorsalHeight;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Base line
    for (let i = 0; i <= rayCount; i++) {
      const x = (i / rayCount - 0.5) * finLength;
      positions.push(x, 0, 0);
      colors.push(1.0, 1.0, 1.0);
    }

    // Tip line (curved profile)
    for (let i = 0; i <= rayCount; i++) {
      const t = i / rayCount;
      const x = (t - 0.5) * finLength;
      const heightProfile = Math.sin(t * Math.PI);
      const y = heightProfile * finHeight;
      const z = heightProfile * finLength * 0.1; // Slight forward curve

      positions.push(x, y, z);
      colors.push(0.9, 0.9, 0.9);
    }

    // Create membrane triangles
    for (let i = 0; i < rayCount; i++) {
      const base1 = i;
      const base2 = i + 1;
      const tip1 = rayCount + 1 + i;
      const tip2 = rayCount + 1 + i + 1;

      indices.push(base1, tip1, base2);
      indices.push(base2, tip1, tip2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry);
  }

  /**
   * Create anal fin with rays
   */
  private static createAnalFinWithRays(length: number, proportions: any, rayCount: number): THREE.Mesh {
    const finLength = length * 0.25;
    const finHeight = length * proportions.bodyHeight * 0.5;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= rayCount; i++) {
      const x = (i / rayCount) * finLength;
      positions.push(x, 0, 0);
      colors.push(1.0, 1.0, 1.0);
    }

    for (let i = 0; i <= rayCount; i++) {
      const t = i / rayCount;
      const x = t * finLength;
      const heightProfile = Math.sin(t * Math.PI);
      const y = -heightProfile * finHeight;

      positions.push(x, y, 0);
      colors.push(0.9, 0.9, 0.9);
    }

    for (let i = 0; i < rayCount; i++) {
      indices.push(i, rayCount + 1 + i, i + 1);
      indices.push(i + 1, rayCount + 1 + i, rayCount + 1 + i + 1);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry);
  }

  /**
   * Create pectoral fin with fan shape and rays
   */
  private static createPectoralFinWithRays(length: number, _proportions: any, rayCount: number): THREE.Mesh {
    const finLength = length * 0.28;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Base attachment
    positions.push(0, 0, 0);
    colors.push(1.0, 1.0, 1.0);

    // Fan spread
    for (let i = 0; i <= rayCount; i++) {
      const t = i / rayCount;
      const angle = (t - 0.5) * Math.PI * 0.6;
      const radius = finLength;

      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.7;
      const z = radius * 0.3;

      positions.push(x, y, z);
      colors.push(0.92, 0.92, 0.92);
    }

    // Create fan triangles
    for (let i = 0; i < rayCount; i++) {
      indices.push(0, i + 1, i + 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry);
  }

  /**
   * Create pelvic fin
   */
  private static createPelvicFin(length: number, _proportions: any): THREE.Mesh {
    const finLength = length * 0.12;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(finLength * 0.5, -finLength * 0.4, finLength, -finLength * 0.3);
    shape.lineTo(finLength * 0.9, -finLength * 0.1);
    shape.quadraticCurveTo(finLength * 0.4, -finLength * 0.15, 0, 0);

    const geometry = new THREE.ShapeGeometry(shape);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    colors.fill(0.95);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return new THREE.Mesh(geometry);
  }

  /**
   * Merge group geometries into single buffer geometry
   */
  private static mergeGroup(group: THREE.Group): THREE.BufferGeometry {
    const geometries: { geo: THREE.BufferGeometry; name: string }[] = [];

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        let geometry = child.geometry.clone();

        if (geometry.index) {
          geometry = geometry.toNonIndexed();
        }

        child.updateMatrix();
        geometry.applyMatrix4(child.matrix);

        geometries.push({ geo: geometry, name: child.name });
      }
    });

    const mergedGeometry = new THREE.BufferGeometry();

    if (geometries.length === 0) {
      return mergedGeometry;
    }

    let totalVertices = 0;
    for (const item of geometries) {
      totalVertices += item.geo.getAttribute('position').count;
    }

    const mergedPositions = new Float32Array(totalVertices * 3);
    const mergedColors = new Float32Array(totalVertices * 3);

    let offset = 0;

    for (const item of geometries) {
      const positions = item.geo.getAttribute('position');
      const colors = item.geo.getAttribute('color');

      for (let i = 0; i < positions.count; i++) {
        mergedPositions[offset * 3] = positions.getX(i);
        mergedPositions[offset * 3 + 1] = positions.getY(i);
        mergedPositions[offset * 3 + 2] = positions.getZ(i);

        if (colors) {
          mergedColors[offset * 3] = colors.getX(i);
          mergedColors[offset * 3 + 1] = colors.getY(i);
          mergedColors[offset * 3 + 2] = colors.getZ(i);
        } else {
          mergedColors[offset * 3] = 1.0;
          mergedColors[offset * 3 + 1] = 1.0;
          mergedColors[offset * 3 + 2] = 1.0;
        }

        offset++;
      }
    }

    mergedGeometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    mergedGeometry.setAttribute('color', new THREE.BufferAttribute(mergedColors, 3));

    return mergedGeometry;
  }
}

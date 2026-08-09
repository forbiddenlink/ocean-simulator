import * as THREE from 'three';

/**
 * Procedural sea turtle geometry generator
 * Creates realistic sea turtle meshes with proper marine reptile proportions
 */
export class TurtleGeometry {
  /**
   * Create a procedurally generated sea turtle geometry
   * @param length - Shell length (default: 1.0m)
   * @param species - Type: 'green', 'hawksbill', 'loggerhead'
   */
  static create(length: number = 1.0, species: 'green' | 'hawksbill' | 'loggerhead' = 'green'): THREE.Group {
    const group = new THREE.Group();

    const proportions = this.getSpeciesProportions(species);
    const colors = this.getSpeciesColors(species);

    // Domed shell (carapace)
    const carapace = this.createCarapace(length, proportions, colors);
    group.add(carapace);

    // Flat belly (plastron)
    const plastron = this.createPlastron(length, proportions, colors);
    group.add(plastron);

    // Front flippers (larger, for swimming)
    const frontFlipperLeft = this.createFlipper(length, proportions, 'front', 'left', colors);
    const frontFlipperRight = this.createFlipper(length, proportions, 'front', 'right', colors);
    group.add(frontFlipperLeft, frontFlipperRight);

    // Rear flippers (smaller, for steering)
    const rearFlipperLeft = this.createFlipper(length, proportions, 'rear', 'left', colors);
    const rearFlipperRight = this.createFlipper(length, proportions, 'rear', 'right', colors);
    group.add(rearFlipperLeft, rearFlipperRight);

    // Head with beak
    const head = this.createHead(length, proportions, colors);
    group.add(head);

    // Short tail
    const tail = this.createTail(length, proportions, colors);
    group.add(tail);

    return group;
  }

  private static getSpeciesProportions(species: string): {
    shellWidth: number;
    shellHeight: number;
    frontFlipperLength: number;
    rearFlipperLength: number;
    headProtrusion: number;
    tailLength: number;
    neckLength: number;
  } {
    switch (species) {
      case 'green':
        return {
          shellWidth: 0.8,
          shellHeight: 0.35,
          frontFlipperLength: 0.6,
          rearFlipperLength: 0.25,
          headProtrusion: 0.2,
          tailLength: 0.15,
          neckLength: 0.12,
        };
      case 'hawksbill':
        return {
          shellWidth: 0.75,
          shellHeight: 0.38,
          frontFlipperLength: 0.55,
          rearFlipperLength: 0.22,
          headProtrusion: 0.22,
          tailLength: 0.12,
          neckLength: 0.14,
        };
      case 'loggerhead':
        return {
          shellWidth: 0.85,
          shellHeight: 0.32,
          frontFlipperLength: 0.58,
          rearFlipperLength: 0.26,
          headProtrusion: 0.25,
          tailLength: 0.14,
          neckLength: 0.10,
        };
      default:
        return this.getSpeciesProportions('green');
    }
  }

  private static getSpeciesColors(species: string): {
    shell: number;
    shellPattern: number;
    skin: number;
    plastron: number;
  } {
    switch (species) {
      case 'green':
        return {
          shell: 0x4a5a3a,      // Olive-brown shell
          shellPattern: 0x3a4a2a,
          skin: 0x5a6a4a,       // Greenish-brown skin
          plastron: 0xd8d0b0,   // Pale yellow-white belly
        };
      case 'hawksbill':
        return {
          shell: 0x6a4a2a,      // Amber-brown shell
          shellPattern: 0x8a5a3a,
          skin: 0x5a4a3a,       // Brown skin
          plastron: 0xe0d8c0,   // Cream belly
        };
      case 'loggerhead':
        return {
          shell: 0x7a5a3a,      // Reddish-brown shell
          shellPattern: 0x5a4a2a,
          skin: 0x6a5a4a,       // Brown skin
          plastron: 0xd0c8b0,   // Yellowish belly
        };
      default:
        return this.getSpeciesColors('green');
    }
  }

  private static createCarapace(length: number, proportions: any, colors: any): THREE.Mesh {
    // Create domed shell using a flattened half-sphere
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors_attr: number[] = [];

    const segmentsTheta = 40; // Around the shell
    const segmentsPhi = 22;   // From top to edge

    const shellWidth = length * proportions.shellWidth;
    const shellHeight = length * proportions.shellHeight;

    const shellColor = new THREE.Color(colors.shell);
    const patternColor = new THREE.Color(colors.shellPattern);

    // Generate dome vertices with geometric scute ridges (not color-only)
    for (let i = 0; i <= segmentsPhi; i++) {
      const phi = (i / segmentsPhi) * (Math.PI / 2); // 0 to PI/2 (top half)

      for (let j = 0; j <= segmentsTheta; j++) {
        const theta = (j / segmentsTheta) * Math.PI * 2;

        // Ellipsoid shape: stretched along X (length), compressed on Y (height)
        let x = Math.sin(phi) * Math.cos(theta) * (length / 2);
        let z = Math.sin(phi) * Math.sin(theta) * (shellWidth / 2);
        let y = Math.cos(phi) * shellHeight;

        // Raised scute plates + central keel — reads as shell armor in silhouette
        const scuteU = Math.cos(theta * 5.0) * Math.cos(phi * 4.0);
        const scuteV = Math.cos(theta * 3.0) * Math.sin(phi * 5.0);
        const plate = Math.max(0, scuteU) * 0.55 + Math.max(0, scuteV) * 0.35;
        const seam = Math.pow(Math.abs(Math.sin(theta * 5.0)), 8.0) * Math.pow(Math.sin(phi * 3.5), 2.0);
        const keel = Math.exp(-Math.pow(Math.sin(theta), 2.0) * 8.0) * Math.sin(phi) * 0.045;
        const displace = plate * 0.035 * length - seam * 0.018 * length + keel * length;
        const nLen = Math.hypot(
          Math.sin(phi) * Math.cos(theta) / (length / 2),
          Math.cos(phi) / shellHeight,
          Math.sin(phi) * Math.sin(theta) / (shellWidth / 2)
        ) || 1;
        const nx0 = (Math.sin(phi) * Math.cos(theta) / (length / 2)) / nLen;
        const ny0 = (Math.cos(phi) / shellHeight) / nLen;
        const nz0 = (Math.sin(phi) * Math.sin(theta) / (shellWidth / 2)) / nLen;
        x += nx0 * displace;
        y += ny0 * displace;
        z += nz0 * displace;

        vertices.push(x, y, z);

        normals.push(nx0, ny0, nz0);
        uvs.push(j / segmentsTheta, i / segmentsPhi);

        const scutePattern = Math.sin(theta * 6) * Math.sin(phi * 5);
        const ridge = Math.abs(Math.sin(theta * 3)) * Math.abs(Math.sin(phi * 2.5));
        const colorBlend = (scutePattern + 1) / 2;
        const finalColor = new THREE.Color().lerpColors(shellColor, patternColor, colorBlend * 0.55 + ridge * 0.25);
        // Darken seams so plates read even without strong lighting
        finalColor.multiplyScalar(1.0 - seam * 0.35);
        colors_attr.push(finalColor.r, finalColor.g, finalColor.b);
      }
    }

    // Generate indices
    for (let i = 0; i < segmentsPhi; i++) {
      for (let j = 0; j < segmentsTheta; j++) {
        const a = i * (segmentsTheta + 1) + j;
        const b = i * (segmentsTheta + 1) + j + 1;
        const c = (i + 1) * (segmentsTheta + 1) + j + 1;
        const d = (i + 1) * (segmentsTheta + 1) + j;

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

    const material = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.08,
      clearcoat: 0.78,
      clearcoatRoughness: 0.18,
      sheen: 0.28,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0x556644),
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  private static createPlastron(length: number, proportions: any, colors: any): THREE.Mesh {
    // Flat underside of turtle - create ellipse using Shape
    const shellWidth = length * proportions.shellWidth;
    const radiusX = length / 2 * 0.9;
    const radiusZ = shellWidth / 2 * 0.85;

    // Create ellipse shape
    const shape = new THREE.Shape();
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radiusX;
      const y = Math.sin(angle) * radiusZ;
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }

    const geometry = new THREE.ShapeGeometry(shape, segments);
    geometry.rotateX(-Math.PI / 2); // Lay flat
    geometry.translate(0, 0.01, 0); // Slightly above origin to avoid z-fighting

    const material = new THREE.MeshPhysicalMaterial({
      color: colors.plastron,
      roughness: 0.45,
      metalness: 0.05,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  private static createFlipper(
    length: number,
    proportions: any,
    position: 'front' | 'rear',
    side: 'left' | 'right',
    colors: any
  ): THREE.Mesh {
    const isFront = position === 'front';
    const flipperLength = length * (isFront ? proportions.frontFlipperLength : proportions.rearFlipperLength);
    const flipperWidth = flipperLength * (isFront ? 0.35 : 0.5);

    // Create flipper shape - paddle-like
    const shape = new THREE.Shape();

    if (isFront) {
      // Front flippers are elongated paddles
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(
        flipperLength * 0.3, flipperWidth * 0.3,
        flipperLength * 0.7, flipperWidth * 0.5
      );
      shape.quadraticCurveTo(
        flipperLength * 0.9, flipperWidth * 0.4,
        flipperLength, flipperWidth * 0.2
      );
      shape.quadraticCurveTo(
        flipperLength * 0.95, 0,
        flipperLength, -flipperWidth * 0.2
      );
      shape.quadraticCurveTo(
        flipperLength * 0.9, -flipperWidth * 0.4,
        flipperLength * 0.7, -flipperWidth * 0.5
      );
      shape.quadraticCurveTo(
        flipperLength * 0.3, -flipperWidth * 0.3,
        0, 0
      );
    } else {
      // Rear flippers are more rounded, paddle-like
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(
        flipperLength * 0.4, flipperWidth * 0.4,
        flipperLength * 0.8, flipperWidth * 0.35
      );
      shape.quadraticCurveTo(
        flipperLength, flipperWidth * 0.2,
        flipperLength, 0
      );
      shape.quadraticCurveTo(
        flipperLength, -flipperWidth * 0.2,
        flipperLength * 0.8, -flipperWidth * 0.35
      );
      shape.quadraticCurveTo(
        flipperLength * 0.4, -flipperWidth * 0.4,
        0, 0
      );
    }

    const extrudeSettings = {
      depth: length * 0.02,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 1,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Position and rotate flipper
    const shellWidth = length * proportions.shellWidth;
    const xOffset = isFront ? length * 0.25 : -length * 0.3;
    const zOffset = shellWidth * 0.4;

    // Rotate to horizontal orientation
    geometry.rotateX(Math.PI / 2);

    // Angle the flippers
    const flipperAngle = isFront ? Math.PI / 5 : Math.PI / 6;
    geometry.rotateY(side === 'left' ? flipperAngle : -flipperAngle);

    // Mirror for right side
    if (side === 'right') {
      geometry.scale(1, 1, -1);
    }

    geometry.translate(xOffset, length * 0.05, side === 'left' ? zOffset : -zOffset);

    const material = new THREE.MeshPhysicalMaterial({
      color: colors.skin,
      roughness: 0.42,
      metalness: 0.06,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  private static createHead(length: number, proportions: any, colors: any): THREE.Group {
    const group = new THREE.Group();

    const headSize = length * 0.12;
    const neckLength = length * proportions.neckLength;

    // Neck
    const neckGeometry = new THREE.CylinderGeometry(
      headSize * 0.6,
      headSize * 0.8,
      neckLength,
      12
    );
    neckGeometry.rotateZ(Math.PI / 2);
    neckGeometry.translate(length * 0.4 + neckLength / 2, headSize * 0.3, 0);

    const skinMaterial = new THREE.MeshPhysicalMaterial({
      color: colors.skin,
      roughness: 0.4,
      metalness: 0.06,
      clearcoat: 0.4,
      clearcoatRoughness: 0.28,
    });

    const neck = new THREE.Mesh(neckGeometry, skinMaterial);
    group.add(neck);

    // Head - slightly elongated sphere
    const headGeometry = new THREE.SphereGeometry(headSize, 16, 12);
    headGeometry.scale(1.3, 0.9, 0.9);
    headGeometry.translate(length * 0.4 + neckLength + headSize * 0.8, headSize * 0.35, 0);

    const head = new THREE.Mesh(headGeometry, skinMaterial);
    group.add(head);

    // Beak - small pointed protrusion
    const beakLength = length * 0.05;
    const beakGeometry = new THREE.ConeGeometry(
      headSize * 0.3,
      beakLength,
      8
    );
    beakGeometry.rotateZ(-Math.PI / 2);
    beakGeometry.translate(length * 0.4 + neckLength + headSize * 1.6 + beakLength / 2, headSize * 0.3, 0);

    const beakMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x4a4a3a, // Darker beak color
      roughness: 0.7,
      metalness: 0.05,
      clearcoat: 0.2,
    });

    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    group.add(beak);

    // Eyes — cream sclera + dark pupil so they read underwater
    const eyeX = length * 0.4 + neckLength + headSize * 0.9;
    const eyeY = headSize * 0.5;
    const eyeZ = headSize * 0.35;
    const scleraMat = new THREE.MeshPhysicalMaterial({
      color: 0xf0ead8,
      roughness: 0.25,
      metalness: 0.05,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
    });
    const pupilMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0c,
      roughness: 0.2,
      metalness: 0.15,
    });

    for (const side of [1, -1] as const) {
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.18, 10, 8), scleraMat);
      sclera.position.set(eyeX, eyeY, eyeZ * side);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.09, 8, 6), pupilMat);
      pupil.position.set(eyeX + headSize * 0.06, eyeY, side * (eyeZ + headSize * 0.12));
      group.add(sclera, pupil);
    }

    return group;
  }

  private static createTail(length: number, proportions: any, colors: any): THREE.Mesh {
    const tailLength = length * proportions.tailLength;
    const tailBaseRadius = length * 0.04;

    // Tapered tail
    const geometry = new THREE.ConeGeometry(
      tailBaseRadius,
      tailLength,
      8
    );
    geometry.rotateZ(Math.PI / 2); // Point backwards
    geometry.translate(-length * 0.5 - tailLength / 2, length * 0.03, 0);

    const material = new THREE.MeshPhysicalMaterial({
      color: colors.skin,
      roughness: 0.42,
      metalness: 0.06,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
    });

    return new THREE.Mesh(geometry, material);
  }
}

import * as THREE from 'three';

/**
 * Procedural whale geometry generator
 * Creates realistic whale meshes with proper marine mammal proportions
 */
export class WhaleGeometry {
  /**
   * Create a humpback whale geometry
   * @param length - Total length of the whale (default: 12.0m)
   */
  static createHumpback(length: number = 12.0): THREE.Group {
    const group = new THREE.Group();

    const proportions = {
      bodyGirth: 0.25,           // Relative to length - whales are chunky
      headLength: 0.25,          // 25% of body length
      pectoralLength: 0.33,      // Very long pectoral fins (characteristic)
      flukeSpan: 0.25,           // Horizontal tail span
      dorsalHeight: 0.03,        // Small dorsal "hump"
    };

    const colors = {
      dorsal: 0x2a3a4a,          // Dark gray-black
      ventral: 0xc4ccd4,         // Light gray-white
      accent: 0x3a4a5a,          // Medium gray
    };

    // Main body
    const body = this.createHumpbackBody(length, proportions, colors);
    group.add(body);

    // Head with tubercles
    const head = this.createHumpbackHead(length, proportions, colors);
    group.add(head);

    // Ventral grooves (throat pleats)
    const ventralGrooves = this.createVentralGrooves(length, proportions, colors);
    group.add(ventralGrooves);

    // Small dorsal fin (the "hump")
    const dorsalFin = this.createHumpbackDorsal(length, proportions, colors);
    group.add(dorsalFin);

    // Very long pectoral fins (characteristic of humpbacks)
    const pectoralFinLeft = this.createHumpbackPectoral(length, proportions, 'left', colors);
    const pectoralFinRight = this.createHumpbackPectoral(length, proportions, 'right', colors);
    group.add(pectoralFinLeft, pectoralFinRight);

    // Tail flukes
    const tailFlukes = this.createWhaleFlukes(length, proportions, colors);
    group.add(tailFlukes);

    return group;
  }

  /**
   * Create a blue whale geometry (simpler, more streamlined)
   * @param length - Total length of the whale (default: 15.0m)
   */
  static createBlueWhale(length: number = 15.0): THREE.Group {
    const group = new THREE.Group();

    const proportions = {
      bodyGirth: 0.20,           // Slender for their size
      headLength: 0.25,
      pectoralLength: 0.12,      // Shorter pectorals than humpback
      flukeSpan: 0.22,
      dorsalHeight: 0.02,        // Tiny dorsal fin
    };

    const colors = {
      dorsal: 0x4a5a6a,          // Mottled blue-gray
      ventral: 0xd4dce4,         // Light gray
      accent: 0x5a6a7a,
    };

    // Main body
    const body = this.createBlueWhaleBody(length, proportions, colors);
    group.add(body);

    // Head (U-shaped, distinctive)
    const head = this.createBlueWhaleHead(length, proportions, colors);
    group.add(head);

    // Tiny dorsal fin
    const dorsalFin = this.createSmallDorsal(length, proportions, colors);
    group.add(dorsalFin);

    // Pectoral fins
    const pectoralFinLeft = this.createBluePectoral(length, proportions, 'left', colors);
    const pectoralFinRight = this.createBluePectoral(length, proportions, 'right', colors);
    group.add(pectoralFinLeft, pectoralFinRight);

    // Tail flukes
    const tailFlukes = this.createWhaleFlukes(length, proportions, colors);
    group.add(tailFlukes);

    return group;
  }

  private static createHumpbackBody(length: number, proportions: any, colors: any): THREE.Mesh {
    const segments = 32;
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors_attr: number[] = [];

    const bodyLength = length * 0.65;
    const maxRadius = length * proportions.bodyGirth;

    const dorsalColor = new THREE.Color(colors.dorsal);
    const ventralColor = new THREE.Color(colors.ventral);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * bodyLength;

      // Whale body profile - robust in middle, tapers at ends
      let radiusScale: number;
      if (t < 0.3) {
        // Front taper
        radiusScale = Math.pow(t / 0.3, 0.7);
      } else if (t < 0.7) {
        // Main body - full girth
        radiusScale = 1.0;
      } else {
        // Tail peduncle - significant taper
        radiusScale = Math.pow((1 - t) / 0.3, 0.6);
      }

      const radius = maxRadius * Math.max(radiusScale, 0.15);

      const ringSides = 16;
      for (let j = 0; j <= ringSides; j++) {
        const angle = (j / ringSides) * Math.PI * 2;

        // Whales have rounder cross-section
        const yRadius = radius;
        const zRadius = radius * 0.9;

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

        // Counter-shading
        const colorBlend = (Math.cos(angle) + 1) / 2;
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
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  private static createHumpbackHead(length: number, proportions: any, colors: any): THREE.Group {
    const group = new THREE.Group();
    const headWidth = length * proportions.bodyGirth * 0.9;

    // Main head shape - rounded rostrum
    const headGeometry = new THREE.SphereGeometry(
      headWidth,
      16,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    headGeometry.scale(1.5, 0.8, 1.0);
    headGeometry.rotateZ(-Math.PI / 2);
    headGeometry.translate(length * 0.35, 0, 0);

    const headMaterial = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.4,
      metalness: 0.05,
    });

    const head = new THREE.Mesh(headGeometry, headMaterial);
    group.add(head);

    // Tubercles (characteristic bumps on humpback head)
    const tubercleMaterial = new THREE.MeshStandardMaterial({
      color: colors.accent,
      roughness: 0.5,
      metalness: 0.05,
    });

    const tuberclePositions = [
      { x: 0.42, y: 0.08, z: 0.05 },
      { x: 0.44, y: 0.06, z: -0.05 },
      { x: 0.40, y: 0.09, z: 0.02 },
      { x: 0.46, y: 0.04, z: 0.06 },
      { x: 0.45, y: 0.05, z: -0.04 },
      { x: 0.38, y: 0.10, z: -0.02 },
      { x: 0.43, y: 0.07, z: 0.08 },
      { x: 0.41, y: 0.08, z: -0.07 },
    ];

    for (const pos of tuberclePositions) {
      const tubercleSize = length * 0.015 * (0.7 + Math.random() * 0.6);
      const tubercleGeometry = new THREE.SphereGeometry(tubercleSize, 8, 8);
      tubercleGeometry.translate(
        length * pos.x,
        length * pos.y,
        length * pos.z
      );
      const tubercle = new THREE.Mesh(tubercleGeometry, tubercleMaterial);
      group.add(tubercle);
    }

    return group;
  }

  private static createVentralGrooves(length: number, proportions: any, colors: any): THREE.Group {
    const group = new THREE.Group();

    // Ventral grooves (throat pleats) - characteristic of baleen whales
    const grooveMaterial = new THREE.MeshStandardMaterial({
      color: colors.ventral,
      roughness: 0.5,
      metalness: 0.05,
    });

    const grooveCount = 12;
    const grooveLength = length * 0.35;
    const startX = length * 0.1;
    const bodyRadius = length * proportions.bodyGirth;

    for (let i = 0; i < grooveCount; i++) {
      const angle = (i / grooveCount - 0.5) * Math.PI * 0.8 + Math.PI; // Bottom half
      const z = Math.sin(angle) * bodyRadius * 0.85;
      const y = Math.cos(angle) * bodyRadius * 0.85;

      // Create groove as thin cylinder
      const grooveGeometry = new THREE.CylinderGeometry(
        length * 0.008,
        length * 0.008,
        grooveLength,
        8
      );
      grooveGeometry.rotateZ(Math.PI / 2);
      grooveGeometry.translate(startX, y, z);

      const groove = new THREE.Mesh(grooveGeometry, grooveMaterial);
      group.add(groove);
    }

    return group;
  }

  private static createHumpbackDorsal(length: number, proportions: any, colors: any): THREE.Mesh {
    // Humpback has small dorsal "hump" rather than tall fin
    const finHeight = length * proportions.dorsalHeight;
    const finBase = length * 0.08;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(
      finBase * 0.3, finHeight * 0.8,
      finBase * 0.6, finHeight
    );
    shape.lineTo(finBase, 0);
    shape.lineTo(0, 0);

    const extrudeSettings = {
      depth: length * 0.02,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-length * 0.15, length * proportions.bodyGirth * 0.9, 0);

    const material = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.4,
      metalness: 0.05,
    });

    return new THREE.Mesh(geometry, material);
  }

  private static createHumpbackPectoral(length: number, proportions: any, side: 'left' | 'right', colors: any): THREE.Mesh {
    // Humpback pectoral fins are VERY long - up to 1/3 body length
    const finLength = length * proportions.pectoralLength;
    const finWidth = finLength * 0.18;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);

    // Long, tapered flipper shape with scalloped leading edge
    shape.quadraticCurveTo(
      finLength * 0.2, finWidth * 0.8,
      finLength * 0.5, finWidth
    );
    shape.quadraticCurveTo(
      finLength * 0.8, finWidth * 0.9,
      finLength, finWidth * 0.3
    );
    shape.quadraticCurveTo(
      finLength * 0.95, finWidth * 0.1,
      finLength * 0.9, 0
    );
    shape.lineTo(0, 0);

    const extrudeSettings = {
      depth: length * 0.015,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(Math.PI / 2);

    // Angle downward and slightly back
    if (side === 'left') {
      geometry.rotateZ(Math.PI / 3);
      geometry.rotateY(-Math.PI / 8);
    } else {
      geometry.rotateZ(-Math.PI / 3);
      geometry.rotateY(Math.PI / 8);
    }

    const offsetZ = side === 'left'
      ? length * proportions.bodyGirth * 0.85
      : -length * proportions.bodyGirth * 0.85;
    geometry.translate(length * 0.15, -length * proportions.bodyGirth * 0.4, offsetZ);

    const material = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.4,
      metalness: 0.05,
    });

    return new THREE.Mesh(geometry, material);
  }

  private static createWhaleFlukes(length: number, proportions: any, colors: any): THREE.Mesh {
    const flukeSpan = length * proportions.flukeSpan;
    const flukeWidth = flukeSpan * 0.25;

    // Large horizontal tail flukes
    const shape = new THREE.Shape();

    // Left fluke
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(
      -flukeWidth * 0.4, flukeSpan / 2 * 0.6,
      -flukeWidth * 0.8, flukeSpan / 2
    );
    shape.quadraticCurveTo(
      -flukeWidth * 1.0, flukeSpan / 2 * 1.05,
      -flukeWidth * 0.6, flukeSpan / 2 * 0.95
    );
    shape.quadraticCurveTo(
      -flukeWidth * 0.3, flukeSpan / 2 * 0.8,
      -flukeWidth * 0.1, flukeSpan / 2 * 0.4
    );

    // Center notch
    shape.quadraticCurveTo(
      -flukeWidth * 0.05, flukeWidth * 0.15,
      0, 0
    );

    // Right fluke (mirror)
    shape.quadraticCurveTo(
      flukeWidth * 0.05, flukeWidth * 0.15,
      flukeWidth * 0.1, flukeSpan / 2 * 0.4
    );
    shape.quadraticCurveTo(
      flukeWidth * 0.3, flukeSpan / 2 * 0.8,
      flukeWidth * 0.6, flukeSpan / 2 * 0.95
    );
    shape.quadraticCurveTo(
      flukeWidth * 1.0, flukeSpan / 2 * 1.05,
      flukeWidth * 0.8, flukeSpan / 2
    );
    shape.quadraticCurveTo(
      flukeWidth * 0.4, flukeSpan / 2 * 0.6,
      0, 0
    );

    const extrudeSettings = {
      depth: length * 0.015,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(-length * 0.32, 0, 0);

    const material = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.4,
      metalness: 0.05,
    });

    return new THREE.Mesh(geometry, material);
  }

  // Blue whale specific methods

  private static createBlueWhaleBody(length: number, proportions: any, colors: any): THREE.Mesh {
    const segments = 32;
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors_attr: number[] = [];

    const bodyLength = length * 0.70;
    const maxRadius = length * proportions.bodyGirth;

    const dorsalColor = new THREE.Color(colors.dorsal);
    const ventralColor = new THREE.Color(colors.ventral);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * bodyLength;

      // Blue whale - very streamlined, long and slender
      let radiusScale: number;
      if (t < 0.25) {
        radiusScale = Math.pow(t / 0.25, 0.6);
      } else if (t < 0.75) {
        radiusScale = 1.0;
      } else {
        radiusScale = Math.pow((1 - t) / 0.25, 0.5);
      }

      const radius = maxRadius * Math.max(radiusScale, 0.12);

      const ringSides = 16;
      for (let j = 0; j <= ringSides; j++) {
        const angle = (j / ringSides) * Math.PI * 2;

        const yRadius = radius;
        const zRadius = radius * 0.85;

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

        const colorBlend = (Math.cos(angle) + 1) / 2;
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
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geometry, material);
  }

  private static createBlueWhaleHead(length: number, proportions: any, colors: any): THREE.Group {
    const group = new THREE.Group();
    const headWidth = length * proportions.bodyGirth * 0.85;

    // Blue whale has distinctive U-shaped head when viewed from above
    const headGeometry = new THREE.SphereGeometry(
      headWidth,
      16,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    headGeometry.scale(2.0, 0.7, 1.0);
    headGeometry.rotateZ(-Math.PI / 2);
    headGeometry.translate(length * 0.38, 0, 0);

    const headMaterial = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.35,
      metalness: 0.05,
    });

    const head = new THREE.Mesh(headGeometry, headMaterial);
    group.add(head);

    // Splashguard (ridge in front of blowholes)
    const ridgeGeometry = new THREE.CylinderGeometry(
      length * 0.01,
      length * 0.015,
      length * 0.05,
      8
    );
    ridgeGeometry.rotateX(Math.PI / 2);
    ridgeGeometry.translate(length * 0.42, length * proportions.bodyGirth * 0.6, 0);

    const ridge = new THREE.Mesh(ridgeGeometry, headMaterial);
    group.add(ridge);

    return group;
  }

  private static createSmallDorsal(length: number, proportions: any, colors: any): THREE.Mesh {
    // Blue whale has tiny dorsal fin
    const finHeight = length * proportions.dorsalHeight;
    const finBase = length * 0.05;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(finBase * 0.4, finHeight);
    shape.lineTo(finBase, 0);
    shape.lineTo(0, 0);

    const extrudeSettings = {
      depth: length * 0.012,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 1,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-length * 0.20, length * proportions.bodyGirth * 0.95, 0);

    const material = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.4,
      metalness: 0.05,
    });

    return new THREE.Mesh(geometry, material);
  }

  private static createBluePectoral(length: number, proportions: any, side: 'left' | 'right', colors: any): THREE.Mesh {
    // Blue whale pectorals are shorter relative to body than humpback
    const finLength = length * proportions.pectoralLength;
    const finWidth = finLength * 0.25;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(
      finLength * 0.3, finWidth * 0.9,
      finLength * 0.7, finWidth
    );
    shape.quadraticCurveTo(
      finLength * 0.9, finWidth * 0.7,
      finLength, finWidth * 0.2
    );
    shape.lineTo(finLength * 0.95, 0);
    shape.lineTo(0, 0);

    const extrudeSettings = {
      depth: length * 0.012,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 1,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(Math.PI / 2);

    if (side === 'left') {
      geometry.rotateZ(Math.PI / 4);
    } else {
      geometry.rotateZ(-Math.PI / 4);
    }

    const offsetZ = side === 'left'
      ? length * proportions.bodyGirth * 0.8
      : -length * proportions.bodyGirth * 0.8;
    geometry.translate(length * 0.18, -length * proportions.bodyGirth * 0.3, offsetZ);

    const material = new THREE.MeshStandardMaterial({
      color: colors.dorsal,
      roughness: 0.4,
      metalness: 0.05,
    });

    return new THREE.Mesh(geometry, material);
  }
}

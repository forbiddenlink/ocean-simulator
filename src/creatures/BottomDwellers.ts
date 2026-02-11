import * as THREE from 'three';

/**
 * Procedural geometry generator for ocean floor creatures
 * Creates simple geometries for crabs, starfish, sea urchins, and sea cucumbers
 */
export class BottomDwellerGeometry {
  /**
   * Create a crab geometry with oval body, legs, claws, and eye stalks
   * @param size - Overall size of the crab (default: 0.2m)
   */
  static createCrab(size: number = 0.2): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    // Body - flattened ellipsoid
    const bodyWidth = size;
    const bodyLength = size * 0.8;
    const bodyHeight = size * 0.3;
    const bodySegmentsX = 12;
    const bodySegmentsY = 8;

    // Generate body vertices
    for (let y = 0; y <= bodySegmentsY; y++) {
      const phi = (y / bodySegmentsY) * Math.PI;
      for (let x = 0; x <= bodySegmentsX; x++) {
        const theta = (x / bodySegmentsX) * Math.PI * 2;

        const vx = bodyWidth * 0.5 * Math.sin(phi) * Math.cos(theta);
        const vy = bodyHeight * 0.5 * Math.cos(phi) + bodyHeight * 0.25;
        const vz = bodyLength * 0.5 * Math.sin(phi) * Math.sin(theta);

        vertices.push(vx, vy, vz);

        // Simple normal calculation
        const nx = Math.sin(phi) * Math.cos(theta);
        const ny = Math.cos(phi);
        const nz = Math.sin(phi) * Math.sin(theta);
        normals.push(nx, ny, nz);
      }
    }

    // Body indices
    for (let y = 0; y < bodySegmentsY; y++) {
      for (let x = 0; x < bodySegmentsX; x++) {
        const a = y * (bodySegmentsX + 1) + x;
        const b = a + 1;
        const c = (y + 1) * (bodySegmentsX + 1) + x + 1;
        const d = (y + 1) * (bodySegmentsX + 1) + x;

        indices.push(a, b, c);
        indices.push(a, c, d);
      }
    }

    // Legs - 4 on each side (8 total)
    const legRadius = size * 0.03;
    const legLength = size * 0.5;
    const legSegments = 4;

    for (let side = -1; side <= 1; side += 2) {
      for (let legIndex = 0; legIndex < 4; legIndex++) {
        const legAngle = ((legIndex - 1.5) / 4) * Math.PI * 0.6;
        const startX = side * bodyWidth * 0.4;
        const startZ = Math.sin(legAngle) * bodyLength * 0.3;
        const startY = bodyHeight * 0.2;

        // Leg direction - pointing outward and slightly down
        const dirX = side * Math.cos(legAngle * 0.3);
        const dirY = -0.3;
        const dirZ = Math.sin(legAngle) * 0.5;

        const baseIndex = vertices.length / 3;

        // Simple cylinder for leg
        for (let s = 0; s <= legSegments; s++) {
          const t = s / legSegments;
          const centerX = startX + dirX * legLength * t;
          const centerY = startY + dirY * legLength * t;
          const centerZ = startZ + dirZ * legLength * t;

          for (let r = 0; r <= 4; r++) {
            const angle = (r / 4) * Math.PI * 2;
            const taperedRadius = legRadius * (1 - t * 0.5);

            vertices.push(
              centerX + Math.cos(angle) * taperedRadius,
              centerY + Math.sin(angle) * taperedRadius,
              centerZ
            );
            normals.push(Math.cos(angle), Math.sin(angle), 0);
          }
        }

        // Leg indices
        for (let s = 0; s < legSegments; s++) {
          for (let r = 0; r < 4; r++) {
            const a = baseIndex + s * 5 + r;
            const b = a + 1;
            const c = baseIndex + (s + 1) * 5 + r + 1;
            const d = baseIndex + (s + 1) * 5 + r;

            indices.push(a, b, c);
            indices.push(a, c, d);
          }
        }
      }
    }

    // Claws - 2 at front
    const clawSize = size * 0.15;
    for (let side = -1; side <= 1; side += 2) {
      const clawX = side * bodyWidth * 0.3;
      const clawZ = -bodyLength * 0.5;
      const clawY = bodyHeight * 0.3;

      // Simplified claw as a scaled box
      const hw = clawSize * 0.5;
      const hh = clawSize * 0.3;
      const hd = clawSize * 0.8;

      // 8 vertices for box
      const clawVerts = [
        [clawX - hw, clawY - hh, clawZ - hd],
        [clawX + hw, clawY - hh, clawZ - hd],
        [clawX + hw, clawY + hh, clawZ - hd],
        [clawX - hw, clawY + hh, clawZ - hd],
        [clawX - hw, clawY - hh, clawZ],
        [clawX + hw, clawY - hh, clawZ],
        [clawX + hw, clawY + hh, clawZ],
        [clawX - hw, clawY + hh, clawZ],
      ];

      // Add claw vertices with normals
      const clawFaces = [
        [0, 1, 2, 3, 0, 0, -1], // front
        [5, 4, 7, 6, 0, 0, 1],  // back
        [4, 0, 3, 7, -1, 0, 0], // left
        [1, 5, 6, 2, 1, 0, 0],  // right
        [3, 2, 6, 7, 0, 1, 0],  // top
        [4, 5, 1, 0, 0, -1, 0], // bottom
      ];

      for (const face of clawFaces) {
        const [i0, i1, i2, i3, nx, ny, nz] = face;

        // Bounds checking: verify all indices are valid before accessing clawVerts
        if (i0 < 0 || i0 >= clawVerts.length ||
            i1 < 0 || i1 >= clawVerts.length ||
            i2 < 0 || i2 >= clawVerts.length ||
            i3 < 0 || i3 >= clawVerts.length) {
          continue; // Skip invalid face
        }

        const baseIdx = vertices.length / 3;

        vertices.push(...clawVerts[i0], ...clawVerts[i1], ...clawVerts[i2], ...clawVerts[i3]);
        normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);

        indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
      }
    }

    // Eye stalks - 2 small cylinders with spheres
    for (let side = -1; side <= 1; side += 2) {
      const eyeX = side * bodyWidth * 0.15;
      const eyeZ = -bodyLength * 0.35;
      const eyeY = bodyHeight * 0.5;
      const stalkHeight = size * 0.1;
      const eyeRadius = size * 0.03;

      const eyeBaseIndex = vertices.length / 3;

      // Simple eye sphere
      const eyeSegs = 6;
      for (let lat = 0; lat <= eyeSegs; lat++) {
        const phi = (lat / eyeSegs) * Math.PI;
        for (let lon = 0; lon <= eyeSegs; lon++) {
          const theta = (lon / eyeSegs) * Math.PI * 2;

          const vx = eyeX + eyeRadius * Math.sin(phi) * Math.cos(theta);
          const vy = eyeY + stalkHeight + eyeRadius * Math.cos(phi);
          const vz = eyeZ + eyeRadius * Math.sin(phi) * Math.sin(theta);

          vertices.push(vx, vy, vz);
          normals.push(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta)
          );
        }
      }

      // Eye indices
      for (let lat = 0; lat < eyeSegs; lat++) {
        for (let lon = 0; lon < eyeSegs; lon++) {
          const a = eyeBaseIndex + lat * (eyeSegs + 1) + lon;
          const b = a + 1;
          const c = eyeBaseIndex + (lat + 1) * (eyeSegs + 1) + lon + 1;
          const d = eyeBaseIndex + (lat + 1) * (eyeSegs + 1) + lon;

          indices.push(a, b, c);
          indices.push(a, c, d);
        }
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Create a starfish geometry with 5 radiating arms
   * @param size - Overall diameter of the starfish (default: 0.3m)
   */
  static createStarfish(size: number = 0.3): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    const armCount = 5;
    const armLength = size * 0.5;
    const armWidth = size * 0.15;
    const bodyRadius = size * 0.15;
    const height = size * 0.05;

    // Central body disc
    const centerIndex = 0;
    vertices.push(0, height, 0);
    normals.push(0, 1, 0);

    const radialSegments = armCount * 4;
    for (let i = 0; i <= radialSegments; i++) {
      const angle = (i / radialSegments) * Math.PI * 2;
      vertices.push(
        Math.cos(angle) * bodyRadius,
        height,
        Math.sin(angle) * bodyRadius
      );
      normals.push(0, 1, 0);
    }

    // Center disc top face
    for (let i = 0; i < radialSegments; i++) {
      indices.push(centerIndex, i + 1, i + 2);
    }

    // Arms
    for (let arm = 0; arm < armCount; arm++) {
      const armAngle = (arm / armCount) * Math.PI * 2;
      const armBaseIndex = vertices.length / 3;

      const armSegments = 8;
      for (let s = 0; s <= armSegments; s++) {
        const t = s / armSegments;
        const segmentWidth = armWidth * (1 - t * 0.7); // Taper toward tip
        const segmentHeight = height * (1 - t * 0.5);

        const centerX = Math.cos(armAngle) * (bodyRadius + t * armLength);
        const centerZ = Math.sin(armAngle) * (bodyRadius + t * armLength);

        // Cross-section perpendicular to arm direction
        const perpAngle = armAngle + Math.PI / 2;

        // Top vertices (3 per segment for triangular cross-section)
        // Left
        vertices.push(
          centerX + Math.cos(perpAngle) * segmentWidth,
          segmentHeight,
          centerZ + Math.sin(perpAngle) * segmentWidth
        );
        normals.push(Math.cos(perpAngle), 0.5, Math.sin(perpAngle));

        // Center top
        vertices.push(centerX, segmentHeight * 1.5, centerZ);
        normals.push(0, 1, 0);

        // Right
        vertices.push(
          centerX - Math.cos(perpAngle) * segmentWidth,
          segmentHeight,
          centerZ - Math.sin(perpAngle) * segmentWidth
        );
        normals.push(-Math.cos(perpAngle), 0.5, -Math.sin(perpAngle));

        // Bottom center
        vertices.push(centerX, 0, centerZ);
        normals.push(0, -1, 0);
      }

      // Arm indices - connect segments
      for (let s = 0; s < armSegments; s++) {
        const base = armBaseIndex + s * 4;
        const next = base + 4;

        // Top left face
        indices.push(base, next, next + 1);
        indices.push(base, next + 1, base + 1);

        // Top right face
        indices.push(base + 1, next + 1, next + 2);
        indices.push(base + 1, next + 2, base + 2);

        // Bottom left face
        indices.push(base + 3, base, next);
        indices.push(base + 3, next, next + 3);

        // Bottom right face
        indices.push(base + 2, base + 3, next + 3);
        indices.push(base + 2, next + 3, next + 2);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Create a sea urchin geometry - spherical body with spines
   * @param size - Diameter of the body (default: 0.15m)
   */
  static createSeaUrchin(size: number = 0.15): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    const bodyRadius = size * 0.5;
    const bodySegments = 12;
    const spineCount = 40;
    const spineLength = size * 0.6;
    const spineRadius = size * 0.015;

    // Spherical body
    for (let lat = 0; lat <= bodySegments; lat++) {
      const phi = (lat / bodySegments) * Math.PI;
      for (let lon = 0; lon <= bodySegments; lon++) {
        const theta = (lon / bodySegments) * Math.PI * 2;

        const x = bodyRadius * Math.sin(phi) * Math.cos(theta);
        const y = bodyRadius * Math.cos(phi) + bodyRadius;
        const z = bodyRadius * Math.sin(phi) * Math.sin(theta);

        vertices.push(x, y, z);
        normals.push(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta)
        );
      }
    }

    // Body indices
    for (let lat = 0; lat < bodySegments; lat++) {
      for (let lon = 0; lon < bodySegments; lon++) {
        const a = lat * (bodySegments + 1) + lon;
        const b = a + 1;
        const c = (lat + 1) * (bodySegments + 1) + lon + 1;
        const d = (lat + 1) * (bodySegments + 1) + lon;

        indices.push(a, b, c);
        indices.push(a, c, d);
      }
    }

    // Spines - distributed over sphere surface
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < spineCount; i++) {
      const y = 1 - (i / (spineCount - 1)) * 2; // -1 to 1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;

      // Skip bottom spines (would clip through floor)
      if (y < -0.7) continue;

      const baseX = radiusAtY * Math.cos(theta) * bodyRadius;
      const baseY = y * bodyRadius + bodyRadius;
      const baseZ = radiusAtY * Math.sin(theta) * bodyRadius;

      // Spine direction (pointing outward from center)
      const dirX = radiusAtY * Math.cos(theta);
      const dirY = y;
      const dirZ = radiusAtY * Math.sin(theta);

      const spineBaseIndex = vertices.length / 3;

      // Simple cone for spine
      const spineSegs = 4;
      const radialSegs = 4;

      for (let s = 0; s <= spineSegs; s++) {
        const t = s / spineSegs;
        const currentRadius = spineRadius * (1 - t);

        const centerX = baseX + dirX * spineLength * t;
        const centerY = baseY + dirY * spineLength * t;
        const centerZ = baseZ + dirZ * spineLength * t;

        // Create perpendicular basis
        const up = new THREE.Vector3(0, 1, 0);
        const dir = new THREE.Vector3(dirX, dirY, dirZ);
        const perp1 = new THREE.Vector3().crossVectors(dir, up).normalize();
        if (perp1.length() < 0.1) {
          perp1.set(1, 0, 0);
        }
        const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();

        for (let r = 0; r <= radialSegs; r++) {
          const angle = (r / radialSegs) * Math.PI * 2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          vertices.push(
            centerX + (perp1.x * cos + perp2.x * sin) * currentRadius,
            centerY + (perp1.y * cos + perp2.y * sin) * currentRadius,
            centerZ + (perp1.z * cos + perp2.z * sin) * currentRadius
          );

          // Normal points outward from spine axis
          normals.push(
            perp1.x * cos + perp2.x * sin,
            perp1.y * cos + perp2.y * sin,
            perp1.z * cos + perp2.z * sin
          );
        }
      }

      // Spine indices
      for (let s = 0; s < spineSegs; s++) {
        for (let r = 0; r < radialSegs; r++) {
          const a = spineBaseIndex + s * (radialSegs + 1) + r;
          const b = a + 1;
          const c = spineBaseIndex + (s + 1) * (radialSegs + 1) + r + 1;
          const d = spineBaseIndex + (s + 1) * (radialSegs + 1) + r;

          indices.push(a, b, c);
          indices.push(a, c, d);
        }
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Create a sea cucumber geometry - elongated cylinder with tapered ends
   * @param length - Length of the sea cucumber (default: 0.4m)
   */
  static createSeaCucumber(length: number = 0.4): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    const radius = length * 0.15;
    const segments = 16;
    const radialSegments = 12;
    const tentacleCount = 8;
    const tentacleLength = length * 0.1;

    // Main body - elongated cylinder with tapered ends
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const z = (t - 0.5) * length;

      // Taper at both ends
      let segmentRadius = radius;
      if (t < 0.2) {
        segmentRadius = radius * (t / 0.2) * 0.8 + radius * 0.2;
      } else if (t > 0.8) {
        segmentRadius = radius * ((1 - t) / 0.2) * 0.8 + radius * 0.2;
      }

      // Add slight bumps for texture
      const bumpPhase = t * Math.PI * 8;

      for (let r = 0; r <= radialSegments; r++) {
        const angle = (r / radialSegments) * Math.PI * 2;
        const bumpAmount = 1 + Math.sin(bumpPhase + angle * 3) * 0.1;

        const x = Math.cos(angle) * segmentRadius * bumpAmount;
        const y = Math.sin(angle) * segmentRadius * bumpAmount + radius;

        vertices.push(x, y, z);
        normals.push(Math.cos(angle), Math.sin(angle), 0);
      }
    }

    // Body indices
    for (let s = 0; s < segments; s++) {
      for (let r = 0; r < radialSegments; r++) {
        const a = s * (radialSegments + 1) + r;
        const b = a + 1;
        const c = (s + 1) * (radialSegments + 1) + r + 1;
        const d = (s + 1) * (radialSegments + 1) + r;

        indices.push(a, b, c);
        indices.push(a, c, d);
      }
    }

    // End caps
    const frontCapIndex = vertices.length / 3;
    vertices.push(0, radius, -length * 0.5);
    normals.push(0, 0, -1);

    const backCapIndex = vertices.length / 3;
    vertices.push(0, radius, length * 0.5);
    normals.push(0, 0, 1);

    // Front cap - connect to first ring of body vertices
    for (let r = 0; r < radialSegments; r++) {
      indices.push(frontCapIndex, r + 1, r);
    }

    // Back cap - connect to last ring of body vertices
    const lastRingStart = segments * (radialSegments + 1);
    for (let r = 0; r < radialSegments; r++) {
      indices.push(backCapIndex, lastRingStart + r, lastRingStart + r + 1);
    }

    // Tentacles at front end
    for (let t = 0; t < tentacleCount; t++) {
      const tentacleAngle = (t / tentacleCount) * Math.PI * 2;
      const tentacleBaseIndex = vertices.length / 3;

      const baseX = Math.cos(tentacleAngle) * radius * 0.3;
      const baseY = Math.sin(tentacleAngle) * radius * 0.3 + radius;
      const baseZ = -length * 0.5;

      // Tentacle curves outward
      const tentacleSegs = 4;
      const tentacleRadius = length * 0.02;

      for (let s = 0; s <= tentacleSegs; s++) {
        const st = s / tentacleSegs;

        // Curve outward and forward
        const curveX = baseX + Math.cos(tentacleAngle) * tentacleLength * st * 0.5;
        const curveY = baseY + Math.sin(tentacleAngle) * tentacleLength * st * 0.3;
        const curveZ = baseZ - tentacleLength * st;

        const currentRadius = tentacleRadius * (1 - st * 0.7);

        for (let r = 0; r <= 4; r++) {
          const angle = (r / 4) * Math.PI * 2;

          vertices.push(
            curveX + Math.cos(angle) * currentRadius,
            curveY + Math.sin(angle) * currentRadius,
            curveZ
          );
          normals.push(Math.cos(angle), Math.sin(angle), 0);
        }
      }

      // Tentacle indices
      for (let s = 0; s < tentacleSegs; s++) {
        for (let r = 0; r < 4; r++) {
          const a = tentacleBaseIndex + s * 5 + r;
          const b = a + 1;
          const c = tentacleBaseIndex + (s + 1) * 5 + r + 1;
          const d = tentacleBaseIndex + (s + 1) * 5 + r;

          indices.push(a, b, c);
          indices.push(a, c, d);
        }
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }
}

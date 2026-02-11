import * as THREE from 'three';

/**
 * Ocean floor decorations - rocks, shells, debris for realism
 */
export class OceanFloorDecorations {
  /**
   * Create decorative elements scattered across the ocean floor
   */
  public static createDecorations(scene: THREE.Scene, floorY: number, count: number = 80): THREE.Group {
    const decorationsGroup = new THREE.Group();
    
    // Create various decoration types
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      const rotation = Math.random() * Math.PI * 2;
      
      // Random decoration type
      const rand = Math.random();
      let decoration: THREE.Group | THREE.Mesh;
      
      if (rand < 0.3) {
        // Rocks
        decoration = this.createRock(x, floorY, z, rotation);
      } else if (rand < 0.5) {
        // Shells
        decoration = this.createShell(x, floorY, z, rotation);
      } else if (rand < 0.7) {
        // Small coral pieces
        decoration = this.createCoralPiece(x, floorY, z, rotation);
      } else {
        // Pebbles/debris
        decoration = this.createPebbles(x, floorY, z, rotation);
      }
      
      decorationsGroup.add(decoration);
    }
    
    scene.add(decorationsGroup);
    console.log(`🪨 Added ${count} ocean floor decorations (rocks, shells, coral pieces)`);
    
    return decorationsGroup;
  }
  
  /**
   * Create a realistic rock
   */
  private static createRock(x: number, y: number, z: number, rotation: number): THREE.Mesh {
    const size = 0.3 + Math.random() * 0.8;
    
    // Use dodecahedron for more natural rock shape
    const geometry = new THREE.DodecahedronGeometry(size, 0);
    
    // Randomize vertices for irregular shape
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      
      // Add random displacement
      vertex.multiplyScalar(0.9 + Math.random() * 0.3);
      
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
    
    // Rock colors - various grays, browns
    const rockColors = [
      0x5a5a5a, // Dark gray
      0x7a6e5d, // Brown-gray
      0x4a5568, // Blue-gray
      0x8b7355, // Sandy brown
      0x6b7280, // Slate gray
    ];
    
    const material = new THREE.MeshStandardMaterial({
      color: rockColors[Math.floor(Math.random() * rockColors.length)],
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    
    const rock = new THREE.Mesh(geometry, material);
    rock.position.set(x, y + size * 0.3, z);
    rock.rotation.set(
      Math.random() * 0.5,
      rotation,
      Math.random() * 0.5
    );
    rock.castShadow = true;
    rock.receiveShadow = true;
    
    return rock;
  }
  
  /**
   * Create a seashell
   */
  private static createShell(x: number, y: number, z: number, rotation: number): THREE.Mesh {
    const size = 0.15 + Math.random() * 0.3;
    
    // Simple shell shape using sphere squashed
    const geometry = new THREE.SphereGeometry(size, 16, 12);
    const positions = geometry.attributes.position;
    
    // Flatten bottom and create shell shape
    for (let i = 0; i < positions.count; i++) {
      let x = positions.getX(i);
      let y = positions.getY(i);
      let z = positions.getZ(i);
      
      // Flatten and elongate
      y *= 0.3;
      z *= 1.3;
      
      // Add spiral texture
      const angle = Math.atan2(z, x);
      const dist = Math.sqrt(x * x + z * z);
      y += Math.sin(angle * 4 + dist * 5) * 0.05;
      
      positions.setXYZ(i, x, y, z);
    }
    geometry.computeVertexNormals();
    
    // Shell colors - whites, pinks, browns
    const shellColors = [
      0xf5f5dc, // Beige
      0xffd7ba, // Peachy
      0xffffff, // White
      0xffe4e1, // Misty rose
      0xe6d7c3, // Cream
      0xf4a460, // Sandy brown
    ];
    
    const material = new THREE.MeshStandardMaterial({
      color: shellColors[Math.floor(Math.random() * shellColors.length)],
      roughness: 0.4,
      metalness: 0.1,
    });
    
    const shell = new THREE.Mesh(geometry, material);
    shell.position.set(x, y + size * 0.2, z);
    shell.rotation.set(
      Math.random() * Math.PI * 0.3,
      rotation,
      Math.random() * Math.PI * 0.3
    );
    shell.castShadow = true;
    shell.receiveShadow = true;
    
    return shell;
  }
  
  /**
   * Create a small coral piece (dead/broken)
   */
  private static createCoralPiece(x: number, y: number, z: number, rotation: number): THREE.Mesh {
    const size = 0.2 + Math.random() * 0.4;
    
    // Irregular branching shape
    const geometry = new THREE.ConeGeometry(size * 0.5, size * 1.5, 6, 1);
    
    // Bleached coral colors - muted whites and grays
    const coralColors = [
      0xdcdcdc, // Gainsboro
      0xf0e68c, // Khaki (slightly alive)
      0xd3d3d3, // Light gray
      0xc0c0c0, // Silver
      0xf5deb3, // Wheat
    ];
    
    const material = new THREE.MeshStandardMaterial({
      color: coralColors[Math.floor(Math.random() * coralColors.length)],
      roughness: 0.85,
      metalness: 0.0,
    });
    
    const coral = new THREE.Mesh(geometry, material);
    coral.position.set(x, y + size * 0.5, z);
    coral.rotation.set(
      Math.random() * 0.4 - 0.2,
      rotation,
      Math.random() * 0.4 - 0.2
    );
    coral.castShadow = true;
    coral.receiveShadow = true;
    
    return coral;
  }
  
  /**
   * Create a cluster of small pebbles
   */
  private static createPebbles(x: number, y: number, z: number, rotation: number): THREE.Group {
    const group = new THREE.Group();
    const pebbleCount = 3 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < pebbleCount; i++) {
      const pebbleSize = 0.05 + Math.random() * 0.15;
      const geometry = new THREE.SphereGeometry(pebbleSize, 8, 6);
      
      // Slightly flatten
      const positions = geometry.attributes.position;
      for (let j = 0; j < positions.count; j++) {
        const py = positions.getY(j);
        positions.setY(j, py * 0.6);
      }
      geometry.computeVertexNormals();
      
      const pebbleColors = [
        0x8b8680, // Taupe gray
        0xa0826d, // Light brown
        0x918175, // Gray-brown
        0xb5a084, // Sandy
        0x7d7463, // Dark taupe
      ];
      
      const material = new THREE.MeshStandardMaterial({
        color: pebbleColors[Math.floor(Math.random() * pebbleColors.length)],
        roughness: 0.8,
        metalness: 0.0,
      });
      
      const pebble = new THREE.Mesh(geometry, material);
      pebble.position.set(
        (Math.random() - 0.5) * 0.3,
        pebbleSize * 0.4,
        (Math.random() - 0.5) * 0.3
      );
      pebble.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      pebble.castShadow = true;
      pebble.receiveShadow = true;
      
      group.add(pebble);
    }
    
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    
    return group;
  }
}

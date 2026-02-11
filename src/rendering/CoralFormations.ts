import * as THREE from 'three';

/**
 * Realistic coral formations and reef structures
 * Based on real ocean coral diversity
 */
export class CoralFormations {
  
  /**
   * Create a diverse coral reef scene
   */
  static createCoralReef(scene: THREE.Scene, floorDepth: number, count: number = 30): THREE.Group {
    const coralGroup = new THREE.Group();
    
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      
      // Create different coral types
      const type = Math.random();
      let coral: THREE.Mesh | THREE.Group;
      
      if (type < 0.25) {
        coral = this.createBrainCoral(x, floorDepth, z);
      } else if (type < 0.5) {
        coral = this.createStaghornCoral(x, floorDepth, z);
      } else if (type < 0.75) {
        coral = this.createTableCoral(x, floorDepth, z);
      } else {
        coral = this.createFanCoral(x, floorDepth, z);
      }
      
      coralGroup.add(coral);
    }
    
    scene.add(coralGroup);
    console.log(`🪸 Created ${count} coral formations`);
    
    return coralGroup;
  }
  
  /**
   * Brain coral - large rounded dome with maze-like patterns
   */
  private static createBrainCoral(x: number, floorY: number, z: number): THREE.Mesh {
    const size = 0.8 + Math.random() * 1.2;
    const geometry = new THREE.SphereGeometry(size, 32, 32);
    
    // Add brain-like texture through vertex displacement
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i);
      const py = positions.getY(i);
      const pz = positions.getZ(i);
      
      // Create ridges
      const noise = Math.sin(px * 8) * Math.cos(pz * 8) * 0.1;
      const length = Math.sqrt(px * px + py * py + pz * pz);
      
      positions.setXYZ(i, px + px * noise / length, py + py * noise / length, pz + pz * noise / length);
    }
    geometry.computeVertexNormals();
    
    // Muted coral colors (desaturated ~20%)
    const colors = [0xcc5588, 0xdd8866, 0xddaa55, 0x88bbaa];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.8,
      metalness: 0.1,
      emissive: color,
      emissiveIntensity: 0.25,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, floorY + size, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  /**
   * Staghorn coral - branching antler-like structure
   */
  private static createStaghornCoral(x: number, floorY: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const branchCount = 5 + Math.floor(Math.random() * 7);
    
    const colors = [0xd4a373, 0xf0e68c, 0xdda15e, 0xbc6c25];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    for (let i = 0; i < branchCount; i++) {
      const angle = (i / branchCount) * Math.PI * 2;
      const length = 1.2 + Math.random() * 1.5;
      
      const geometry = new THREE.CylinderGeometry(0.08, 0.15, length, 8);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.8,
        metalness: 0.1,
        emissive: new THREE.Color(color).multiplyScalar(0.25),
        emissiveIntensity: 1.0,
      });
      
      const branch = new THREE.Mesh(geometry, material);
      branch.position.y = length / 2;
      branch.rotation.set(
        Math.PI / 4 + Math.random() * 0.3,
        angle,
        0
      );
      
      branch.castShadow = true;
      branch.receiveShadow = true;
      
      group.add(branch);
    }
    
    group.position.set(x, floorY + 0.3, z);
    return group;
  }
  
  /**
   * Table coral - flat horizontal plates
   */
  private static createTableCoral(x: number, floorY: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const plateCount = 2 + Math.floor(Math.random() * 3);
    
    const colors = [0x8fbc8f, 0x6b8e23, 0x9acd32, 0x808000];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    for (let i = 0; i < plateCount; i++) {
      const width = 1.5 + Math.random() * 1.0;
      const height = 0.15;
      
      const geometry = new THREE.CylinderGeometry(width, width * 0.7, height, 16);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.75,
        metalness: 0.15,
        emissive: new THREE.Color(color).multiplyScalar(0.2),
        emissiveIntensity: 1.0,
      });
      
      const plate = new THREE.Mesh(geometry, material);
      plate.position.y = i * 0.8 + 0.5;
      
      plate.castShadow = true;
      plate.receiveShadow = true;
      
      group.add(plate);
    }
    
    group.position.set(x, floorY, z);
    return group;
  }
  
  /**
   * Sea fan coral - flat branching fan structure
   */
  private static createFanCoral(x: number, floorY: number, z: number): THREE.Mesh {
    const width = 1.5 + Math.random() * 1.0;
    const height = 2.0 + Math.random() * 1.0;
    
    const geometry = new THREE.PlaneGeometry(width, height, 16, 24);
    
    // Create fan shape
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      
      // Fan out from bottom
      const fanFactor = (y + height / 2) / height;
      positions.setX(i, x * (0.3 + fanFactor * 0.7));
      
      // Add ripple effect
      const ripple = Math.sin(x * 5) * Math.cos(y * 3) * 0.1 * fanFactor;
      positions.setZ(i, ripple);
    }
    geometry.computeVertexNormals();
    
    // Muted sea fan colors (desaturated ~20%)
    const colors = [0xaa3377, 0xcc5599, 0xaa7799, 0x8844aa];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.7,
      metalness: 0.2,
      side: THREE.DoubleSide,
      emissive: color,
      emissiveIntensity: 0.3,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, floorY + height / 2, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
}

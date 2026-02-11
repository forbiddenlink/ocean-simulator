import * as THREE from 'three';

/**
 * Ocean floor creatures and details
 * Starfish, sea urchins, shells, crabs
 */
export class OceanFloorLife {
  
  /**
   * Create diverse ocean floor life
   */
  static createFloorLife(scene: THREE.Scene, floorDepth: number): THREE.Group {
    const group = new THREE.Group();
    
    // Add starfish
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      const starfish = this.createStarfish(x, floorDepth, z);
      group.add(starfish);
    }
    
    // Add sea urchins
    for (let i = 0; i < 15; i++) {
      const x = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      const urchin = this.createSeaUrchin(x, floorDepth, z);
      group.add(urchin);
    }
    
    // Add shells
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      const shell = this.createShell(x, floorDepth, z);
      group.add(shell);
    }
    
    scene.add(group);
    console.log('🦀 Created ocean floor life (starfish, urchins, shells)');
    
    return group;
  }
  
  /**
   * Create a starfish
   */
  private static createStarfish(x: number, floorY: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const armCount = 5;
    const armLength = 0.3 + Math.random() * 0.2;
    
    const colors = [0xff6b35, 0xf7931e, 0xfdc500, 0xc1121f, 0xb5179e];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Central body
    const centerGeometry = new THREE.CircleGeometry(0.1, 16);
    const centerMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.8,
      metalness: 0.1,
    });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    center.rotation.x = -Math.PI / 2;
    group.add(center);
    
    // Arms
    for (let i = 0; i < armCount; i++) {
      const angle = (i / armCount) * Math.PI * 2;
      
      const armGeometry = new THREE.ConeGeometry(0.08, armLength, 8);
      const armMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.85,
        metalness: 0.05,
      });
      
      const arm = new THREE.Mesh(armGeometry, armMaterial);
      arm.rotation.x = -Math.PI / 2;
      arm.rotation.z = angle;
      arm.position.y = 0.01;
      
      group.add(arm);
    }
    
    group.position.set(x, floorY + 0.02, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    
    return group;
  }
  
  /**
   * Create a sea urchin
   */
  private static createSeaUrchin(x: number, floorY: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const size = 0.15 + Math.random() * 0.1;
    
    const colors = [0x2d1b69, 0x4a0e4e, 0x8b2635, 0x3d1e6d];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Body
    const bodyGeometry = new THREE.SphereGeometry(size, 16, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.9,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    group.add(body);
    
    // Spines
    const spineCount = 30 + Math.floor(Math.random() * 20);
    for (let i = 0; i < spineCount; i++) {
      const spineLength = size * 1.5 + Math.random() * size;
      const spineGeometry = new THREE.CylinderGeometry(0.01, 0.02, spineLength, 4);
      const spineMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).multiplyScalar(0.8),
        roughness: 0.7,
      });
      
      const spine = new THREE.Mesh(spineGeometry, spineMaterial);
      
      // Random direction
      const theta = Math.random() * Math.PI;
      const phi = Math.random() * Math.PI * 2;
      
      spine.position.set(
        Math.sin(theta) * Math.cos(phi) * size,
        Math.cos(theta) * size,
        Math.sin(theta) * Math.sin(phi) * size
      );
      
      spine.lookAt(
        spine.position.x * 2,
        spine.position.y * 2,
        spine.position.z * 2
      );
      
      group.add(spine);
    }
    
    group.position.set(x, floorY + size, z);
    
    return group;
  }
  
  /**
   * Create a shell
   */
  private static createShell(x: number, floorY: number, z: number): THREE.Mesh {
    const type = Math.random();
    let geometry: THREE.BufferGeometry;
    
    if (type < 0.5) {
      // Spiral shell
      const size = 0.1 + Math.random() * 0.15;
      geometry = new THREE.SphereGeometry(size, 12, 12);
      
      // Deform to create spiral
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        const angle = Math.atan2(z, x);
        const radius = Math.sqrt(x * x + z * z);
        const spiral = y * 2;
        
        positions.setXYZ(
          i,
          Math.cos(angle + spiral) * radius,
          y,
          Math.sin(angle + spiral) * radius
        );
      }
      geometry.computeVertexNormals();
    } else {
      // Clam shell
      const width = 0.15 + Math.random() * 0.1;
      const height = width * 0.6;
      geometry = new THREE.SphereGeometry(width, 12, 12, 0, Math.PI);
      geometry.scale(1, height / width, 1);
    }
    
    const colors = [0xf4e4c1, 0xe8d5b7, 0xfaf3dd, 0xeae0c8];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.6,
      metalness: 0.3,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, floorY + 0.05, z);
    mesh.rotation.set(
      Math.random() * 0.5,
      Math.random() * Math.PI * 2,
      Math.random() * 0.5
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }
}

import * as THREE from 'three';

/**
 * Additional marine life - starfish, sea urchins, crabs
 */
export class MarineLife {
  /**
   * Create various marine creatures on the ocean floor
   */
  public static createMarineCreatures(scene: THREE.Scene, floorY: number, count: number = 50): THREE.Group {
    const group = new THREE.Group();
    
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      const rotation = Math.random() * Math.PI * 2;
      
      const rand = Math.random();
      let creature: THREE.Group | THREE.Mesh;
      
      if (rand < 0.4) {
        // Starfish
        creature = this.createStarfish(x, floorY, z, rotation);
      } else if (rand < 0.7) {
        // Sea urchin
        creature = this.createSeaUrchin(x, floorY, z);
      } else {
        // Crab
        creature = this.createCrab(x, floorY, z, rotation);
      }
      
      group.add(creature);
    }
    
    scene.add(group);
    console.log(`🦀 Added ${count} marine creatures (starfish, urchins, crabs)`);
    
    return group;
  }
  
  /**
   * Create a starfish
   */
  private static createStarfish(x: number, y: number, z: number, rotation: number): THREE.Group {
    const group = new THREE.Group();
    const armCount = 5;
    const size = 0.15 + Math.random() * 0.15;
    
    // Central body
    const bodyGeometry = new THREE.CylinderGeometry(size * 0.4, size * 0.4, 0.05, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: this.getStarfishColor(),
      roughness: 0.9,
      metalness: 0.0,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    group.add(body);
    
    // Arms
    for (let i = 0; i < armCount; i++) {
      const angle = (i / armCount) * Math.PI * 2;
      const armLength = size * 1.2;
      const armWidth = size * 0.25;
      
      // Create tapered arm
      const armGeometry = new THREE.ConeGeometry(armWidth, armLength, 6);
      const arm = new THREE.Mesh(armGeometry, bodyMaterial);
      arm.position.set(
        Math.cos(angle) * size * 0.3,
        0,
        Math.sin(angle) * size * 0.3
      );
      arm.rotation.z = Math.PI / 2;
      arm.rotation.x = angle;
      
      // Curve the arm slightly
      arm.position.x += Math.cos(angle) * armLength * 0.4;
      arm.position.z += Math.sin(angle) * armLength * 0.4;
      
      group.add(arm);
    }
    
    group.position.set(x, y + 0.03, z);
    group.rotation.y = rotation;
    group.castShadow = true;
    group.receiveShadow = true;
    
    return group;
  }
  
  /**
   * Create a sea urchin
   */
  private static createSeaUrchin(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const size = 0.12 + Math.random() * 0.08;
    
    // Body (sphere)
    const bodyGeometry = new THREE.SphereGeometry(size, 8, 6);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: this.getUrchinColor(),
      roughness: 0.8,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    group.add(body);
    
    // Spines
    const spineCount = 20 + Math.floor(Math.random() * 15);
    const spineGeometry = new THREE.ConeGeometry(0.01, size * 0.8, 4);
    const spineMaterial = new THREE.MeshStandardMaterial({
      color: bodyMaterial.color.clone().multiplyScalar(0.7),
      roughness: 0.9,
      metalness: 0.0,
    });
    
    for (let i = 0; i < spineCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / spineCount);
      const theta = Math.sqrt(spineCount * Math.PI) * phi;
      
      const spine = new THREE.Mesh(spineGeometry, spineMaterial);
      spine.position.setFromSphericalCoords(size, phi, theta);
      spine.lookAt(body.position);
      spine.rotateX(Math.PI / 2);
      
      group.add(spine);
    }
    
    group.position.set(x, y + size, z);
    group.castShadow = true;
    group.receiveShadow = true;
    
    return group;
  }
  
  /**
   * Create a crab
   */
  private static createCrab(x: number, y: number, z: number, rotation: number): THREE.Group {
    const group = new THREE.Group();
    const size = 0.08 + Math.random() * 0.06;
    
    // Body (flattened sphere)
    const bodyGeometry = new THREE.SphereGeometry(size, 8, 6);
    const positions = bodyGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      positions.setY(i, y * 0.5); // Flatten
    }
    bodyGeometry.computeVertexNormals();
    
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: this.getCrabColor(),
      roughness: 0.7,
      metalness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = size * 0.5;
    group.add(body);
    
    // Claws (2)
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      
      // Upper claw part
      const upperGeometry = new THREE.BoxGeometry(size * 0.8, size * 0.3, size * 0.3);
      const upper = new THREE.Mesh(upperGeometry, bodyMaterial);
      upper.position.set(side * size * 0.9, size * 0.5, size * 0.6);
      upper.rotation.y = side * 0.3;
      group.add(upper);
      
      // Pincer
      const pincerGeometry = new THREE.ConeGeometry(size * 0.15, size * 0.4, 4);
      const pincer = new THREE.Mesh(pincerGeometry, bodyMaterial);
      pincer.position.set(side * size * 1.3, size * 0.5, size * 0.9);
      pincer.rotation.set(0, side * Math.PI / 4, Math.PI / 2);
      group.add(pincer);
    }
    
    // Legs (6)
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? 1 : -1;
      const legIndex = i % 3;
      
      const legGeometry = new THREE.CylinderGeometry(size * 0.08, size * 0.05, size * 0.8, 4);
      const leg = new THREE.Mesh(legGeometry, bodyMaterial);
      leg.position.set(
        side * size * 0.6,
        size * 0.3,
        -size * 0.3 + legIndex * size * 0.4
      );
      leg.rotation.set(0, 0, side * Math.PI / 6);
      group.add(leg);
    }
    
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    group.castShadow = true;
    group.receiveShadow = true;
    
    // Store for potential animation
    group.userData.baseY = y;
    group.userData.phase = Math.random() * Math.PI * 2;
    
    return group;
  }
  
  /**
   * Random starfish colors
   */
  private static getStarfishColor(): number {
    const colors = [
      0xff6b35, // Orange
      0xff1654, // Red-pink
      0xf4a261, // Sandy orange
      0xb76935, // Brown-orange
      0xe63946, // Red
      0x9d4edd, // Purple
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  /**
   * Random urchin colors
   */
  private static getUrchinColor(): number {
    const colors = [
      0x2d1b2e, // Dark purple
      0x1a1a2e, // Dark blue
      0x3a0ca3, // Deep purple-blue
      0x4a148c, // Purple
      0x311b92, // Deep purple
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  /**
   * Random crab colors
   */
  private static getCrabColor(): number {
    const colors = [
      0xd32f2f, // Red
      0xc2185b, // Deep pink
      0x7b1fa2, // Purple
      0x8b4513, // Saddle brown
      0xa0522d, // Sienna
      0xcd853f, // Peru
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  /**
   * Optional: Animate crabs slightly (call in update loop)
   */
  public static animateCreatures(group: THREE.Group, _deltaTime: number): void {
    const time = performance.now() * 0.001;
    
    group.children.forEach((creature) => {
      if (creature.userData.phase !== undefined) {
        // Slight bobbing movement for crabs
        const bobAmount = 0.01;
        creature.position.y = creature.userData.baseY + Math.sin(time * 2 + creature.userData.phase) * bobAmount;
      }
    });
  }
}

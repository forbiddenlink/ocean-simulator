import * as THREE from 'three';

/**
 * Procedural generation of ocean floor features:
 * coral, kelp, rocks, sand, etc.
 */
export class OceanFloorGenerator {
  /**
   * Create a coral structure using procedural geometry
   */
  static createCoral(params: {
    type?: 'brain' | 'branch' | 'table' | 'mushroom';
    scale?: number;
    color?: THREE.Color;
  } = {}): THREE.Group {
    const {
      type = 'branch',
      scale = 1.0,
      color = new THREE.Color(0xff6b9d),
    } = params;

    const group = new THREE.Group();

    switch (type) {
      case 'brain':
        return this.createBrainCoral(scale, color);
      case 'branch':
        return this.createBranchingCoral(scale, color);
      case 'table':
        return this.createTableCoral(scale, color);
      case 'mushroom':
        return this.createMushroomCoral(scale, color);
    }

    return group;
  }

  /**
   * Create brain coral with bumpy, convoluted surface
   */
  private static createBrainCoral(scale: number, color: THREE.Color): THREE.Group {
    const group = new THREE.Group();
    
    // Base hemisphere
    const geometry = new THREE.SphereGeometry(1.0 * scale, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    
    // Displace vertices to create brain-like ridges
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Create wavy pattern
      const noise = Math.sin(x * 8 + z * 6) * Math.cos(z * 7 + x * 5) * 0.15;
      
      positions.setXYZ(i, x * (1 + noise), y * (1 + noise * 0.5), z * (1 + noise));
    }
    
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.9,
      metalness: 0.1,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    
    return group;
  }

  /**
   * Create branching coral with multiple stems
   */
  private static createBranchingCoral(scale: number, color: THREE.Color): THREE.Group {
    const group = new THREE.Group();
    
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.8,
      metalness: 0.1,
    });
    
    // Recursive branching function
    const createBranch = (
      parent: THREE.Group,
      position: THREE.Vector3,
      direction: THREE.Vector3,
      length: number,
      thickness: number,
      depth: number
    ) => {
      if (depth <= 0 || length < 0.1) return;
      
      // Create branch segment
      const geometry = new THREE.CylinderGeometry(
        thickness * 0.8, // Top radius (tapers)
        thickness, // Bottom radius
        length,
        8
      );
      
      const branch = new THREE.Mesh(geometry, material);
      branch.position.copy(position);
      branch.position.add(direction.clone().multiplyScalar(length / 2));
      
      // Orient toward direction
      branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      
      branch.castShadow = true;
      branch.receiveShadow = true;
      parent.add(branch);
      
      // Create child branches
      const branchCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < branchCount; i++) {
        const angle = (Math.random() * Math.PI * 2);
        const spread = 0.3 + Math.random() * 0.4;
        
        const newDir = direction.clone();
        newDir.x += Math.cos(angle) * spread;
        newDir.z += Math.sin(angle) * spread;
        newDir.normalize();
        
        const newPos = position.clone().add(direction.clone().multiplyScalar(length));
        const newLength = length * (0.6 + Math.random() * 0.3);
        const newThickness = thickness * 0.7;
        
        createBranch(parent, newPos, newDir, newLength, newThickness, depth - 1);
      }
    };
    
    // Start main trunk
    const startPos = new THREE.Vector3(0, 0, 0);
    const startDir = new THREE.Vector3(0, 1, 0);
    createBranch(group, startPos, startDir, 0.8 * scale, 0.15 * scale, 3);
    
    return group;
  }

  /**
   * Create table/plate coral
   */
  private static createTableCoral(scale: number, color: THREE.Color): THREE.Group {
    const group = new THREE.Group();
    
    // Stem
    const stemGeometry = new THREE.CylinderGeometry(0.15 * scale, 0.2 * scale, 0.6 * scale, 12);
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: color.clone().multiplyScalar(0.8),
      roughness: 0.9,
    });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.y = 0.3 * scale;
    stem.castShadow = true;
    stem.receiveShadow = true;
    group.add(stem);
    
    // Table top (irregular disc)
    const tableGeometry = new THREE.CylinderGeometry(1.5 * scale, 1.3 * scale, 0.2 * scale, 32, 1);
    
    // Make edges irregular
    const positions = tableGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      if (Math.abs(y) > 0.05 * scale) { // Edge vertices
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const angle = Math.atan2(z, x);
        const noise = Math.sin(angle * 8) * 0.1 + Math.cos(angle * 12) * 0.05;
        const radius = Math.sqrt(x * x + z * z);
        const newRadius = radius * (1 + noise);
        positions.setX(i, Math.cos(angle) * newRadius);
        positions.setZ(i, Math.sin(angle) * newRadius);
      }
    }
    
    tableGeometry.computeVertexNormals();
    
    const tableMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    
    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.position.y = 0.7 * scale;
    table.castShadow = true;
    table.receiveShadow = true;
    group.add(table);
    
    return group;
  }

  /**
   * Create mushroom coral
   */
  private static createMushroomCoral(scale: number, color: THREE.Color): THREE.Group {
    const group = new THREE.Group();
    
    // Cap
    const capGeometry = new THREE.SphereGeometry(0.8 * scale, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.8,
    });
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.y = 0.5 * scale;
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);
    
    // Short stem
    const stemGeometry = new THREE.CylinderGeometry(0.3 * scale, 0.35 * scale, 0.5 * scale, 12);
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: color.clone().multiplyScalar(0.7),
      roughness: 0.9,
    });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.y = 0.25 * scale;
    stem.castShadow = true;
    stem.receiveShadow = true;
    group.add(stem);
    
    return group;
  }

  /**
   * Create kelp/seaweed with realistic swaying geometry
   */
  static createKelp(params: {
    height?: number;
    segments?: number;
    thickness?: number;
  } = {}): THREE.Group {
    const {
      height = 3.0,
      segments = 20,
      thickness = 0.1,
    } = params;

    const group = new THREE.Group();
    
    // Create kelp blade using multiple segments
    const material = new THREE.MeshStandardMaterial({
      color: 0x2d5016,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const segmentHeight = height / segments;
      
      // Taper from thick at base to thin at top
      const widthTop = thickness * (1.0 - t * 0.7);
      const widthBottom = thickness * (1.0 - (t - 1 / segments) * 0.7);
      
      // Create slightly curved segment
      const shape = new THREE.Shape();
      const curve = Math.sin(t * Math.PI) * 0.1; // Slight S-curve
      
      shape.moveTo(-widthBottom / 2, 0);
      shape.lineTo(-widthTop / 2 + curve, segmentHeight);
      shape.lineTo(widthTop / 2 + curve, segmentHeight);
      shape.lineTo(widthBottom / 2, 0);
      shape.lineTo(-widthBottom / 2, 0);
      
      const geometry = new THREE.ShapeGeometry(shape);
      const segment = new THREE.Mesh(geometry, material);
      
      segment.position.y = i * segmentHeight;
      segment.rotation.x = Math.PI / 2;
      segment.rotation.z = Math.sin(t * Math.PI * 2) * 0.2; // Twist
      segment.castShadow = true;
      segment.receiveShadow = true;
      
      group.add(segment);
    }
    
    return group;
  }

  /**
   * Create a diverse ocean floor scene
   */
  static createOceanFloorScene(scene: THREE.Scene, floorY: number = -30): void {
    // Remove old simple rocks if needed
    // (In production, you'd track and remove old objects)
    
    // Add varied coral formations
    const coralTypes: Array<'brain' | 'branch' | 'table' | 'mushroom'> = ['brain', 'branch', 'table', 'mushroom'];
    const coralColors = [
      new THREE.Color(0xff6b9d), // Pink
      new THREE.Color(0xff8c42), // Orange
      new THREE.Color(0x9d65c9), // Purple
      new THREE.Color(0xffd93d), // Yellow
      new THREE.Color(0x6bcf7f), // Green
    ];
    
    // Create coral clusters
    for (let i = 0; i < 15; i++) {
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      
      const type = coralTypes[Math.floor(Math.random() * coralTypes.length)];
      const color = coralColors[Math.floor(Math.random() * coralColors.length)];
      const scale = 0.8 + Math.random() * 1.5;
      
      const coral = this.createCoral({ type, scale, color });
      coral.position.set(x, floorY, z);
      coral.rotation.y = Math.random() * Math.PI * 2;
      scene.add(coral);
    }
    
    // Add kelp forest
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * 90;
      const z = (Math.random() - 0.5) * 90;
      const height = 2.0 + Math.random() * 3.0;
      
      const kelp = this.createKelp({ height, segments: 15, thickness: 0.15 });
      kelp.position.set(x, floorY, z);
      kelp.rotation.y = Math.random() * Math.PI * 2;
      scene.add(kelp);
    }
    
    // Add some decorative rocks
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.95,
    });
    
    for (let i = 0; i < 25; i++) {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      const scale = 0.5 + Math.random() * 2.0;
      
      rock.position.set(x, floorY, z);
      rock.scale.setScalar(scale);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
    }
  }
}

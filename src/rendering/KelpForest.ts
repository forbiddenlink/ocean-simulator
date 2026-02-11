import * as THREE from 'three';

/**
 * Kelp forest with animated swaying kelp plants
 */
export class KelpForest {
  private kelp: THREE.Group[] = [];
  private scene: THREE.Scene;
  
  constructor(scene: THREE.Scene, floorY: number, count: number = 70) {
    this.scene = scene;
    this.createForest(floorY, count);
  }
  
  /**
   * Create kelp forest
   */
  private createForest(floorY: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 70;
      const z = (Math.random() - 0.5) * 70;
      const height = 6 + Math.random() * 6; // 6-12 units
      
      const kelpPlant = this.createKelpPlant(x, floorY, z, height);
      this.kelp.push(kelpPlant);
      this.scene.add(kelpPlant);
    }
    
    console.log(`🌿 Created kelp forest with ${count} plants`);
  }
  
  /**
   * Create individual kelp plant with multiple fronds
   */
  private createKelpPlant(x: number, y: number, z: number, height: number): THREE.Group {
    const group = new THREE.Group();
    const frondCount = 5 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < frondCount; i++) {
      const frond = this.createKelpFrond(height, i / frondCount);
      frond.rotation.y = (i / frondCount) * Math.PI * 2;
      group.add(frond);
    }
    
    group.position.set(x, y, z);
    
    // Store animation data
    group.userData.baseX = x;
    group.userData.baseZ = z;
    group.userData.phase = Math.random() * Math.PI * 2;
    group.userData.swaySpeed = 0.3 + Math.random() * 0.3;
    group.userData.swayAmount = 0.4 + Math.random() * 0.4;
    
    return group;
  }
  
  /**
   * Create single kelp frond using curve
   */
  private createKelpFrond(height: number, offset: number): THREE.Group {
    const frondGroup = new THREE.Group();
    const segments = 15;
    const widthBase = 0.15 + Math.random() * 0.1;
    
    // Create curve for kelp blade
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const waviness = Math.sin(t * Math.PI * 3 + offset * Math.PI * 2) * 0.3;
      
      points.push(new THREE.Vector3(
        waviness,
        t * height,
        0
      ));
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    
    // Create ribbon geometry for kelp blade
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    
    const divisions = 30;
    for (let i = 0; i <= divisions; i++) {
      const t = i / divisions;
      const point = curve.getPoint(t);
      const width = widthBase * (1 - t * 0.5); // Taper toward tip
      
      // Left edge
      vertices.push(point.x - width/2, point.y, point.z);
      normals.push(0, 0, 1);
      uvs.push(0, t);
      
      // Right edge
      vertices.push(point.x + width/2, point.y, point.z);
      normals.push(0, 0, 1);
      uvs.push(1, t);
      
      if (i < divisions) {
        const base = i * 2;
        // Triangle 1
        indices.push(base, base + 1, base + 2);
        // Triangle 2
        indices.push(base + 1, base + 3, base + 2);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    // Kelp material - brown/green with translucency and emissive for underwater visibility
    const kelpColors = [
      0x5a8751, // Olive green
      0x6f8171, // Sage
      0x7d8e6e, // Moss
      0x9b8e76, // Brown-green
      0x7daa5a, // Bright green
      0x8dba6a, // Light green
    ];

    const color = kelpColors[Math.floor(Math.random() * kelpColors.length)];
    const material = new THREE.MeshStandardMaterial({
      color: color,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0.05,
      transparent: true,
      opacity: 0.85,
      emissive: new THREE.Color(color).multiplyScalar(0.15), // Subtle self-illumination
      emissiveIntensity: 1.0,
    });
    
    const kelpBlade = new THREE.Mesh(geometry, material);
    kelpBlade.castShadow = true;
    kelpBlade.receiveShadow = true;
    
    frondGroup.add(kelpBlade);
    
    // Store original geometry for animation
    frondGroup.userData.originalVertices = Float32Array.from(vertices);
    frondGroup.userData.segments = divisions;
    
    return frondGroup;
  }
  
  /**
   * Animate kelp swaying with ocean currents
   */
  public update(_deltaTime: number): void {
    const time = performance.now() * 0.001;
    
    this.kelp.forEach((plant) => {
      const phase = plant.userData.phase;
      const swaySpeed = plant.userData.swaySpeed;
      const swayAmount = plant.userData.swayAmount;
      
      // Calculate sway offsets
      const swayX = Math.sin(time * swaySpeed + phase) * swayAmount;
      const swayZ = Math.cos(time * swaySpeed * 0.7 + phase) * swayAmount * 0.5;
      
      // Apply sway to each frond
      plant.children.forEach((frond, frondIndex) => {
        const frondPhase = frondIndex * 0.5;
        
        // Animate vertices of the kelp blade
        const kelpBlade = frond.children[0] as THREE.Mesh;
        if (kelpBlade && frond.userData.originalVertices) {
          const geometry = kelpBlade.geometry;
          const positions = geometry.attributes.position.array as Float32Array;
          const original = frond.userData.originalVertices;
          const segments = frond.userData.segments;
          
          for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const influence = t * t; // More movement at the top
            
            const wave = Math.sin(time * swaySpeed + phase + frondPhase + t * Math.PI * 2) * swayAmount;
            const twist = Math.cos(time * swaySpeed * 0.8 + phase) * 0.3;
            
            // Left vertex
            const leftIdx = i * 2 * 3;
            positions[leftIdx] = original[leftIdx] + wave * influence + swayX * influence;
            positions[leftIdx + 2] = original[leftIdx + 2] + twist * influence + swayZ * influence;
            
            // Right vertex
            const rightIdx = (i * 2 + 1) * 3;
            positions[rightIdx] = original[rightIdx] + wave * influence + swayX * influence;
            positions[rightIdx + 2] = original[rightIdx + 2] + twist * influence + swayZ * influence;
          }
          
          geometry.attributes.position.needsUpdate = true;
          geometry.computeVertexNormals();
        }
      });
    });
  }
  
  /**
   * Cleanup
   */
  public dispose(): void {
    this.kelp.forEach((plant) => {
      plant.children.forEach((frond) => {
        frond.children.forEach((blade) => {
          if (blade instanceof THREE.Mesh) {
            blade.geometry.dispose();
            if (blade.material instanceof THREE.Material) {
              blade.material.dispose();
            }
          }
        });
      });
      this.scene.remove(plant);
    });
    this.kelp = [];
  }
}

import * as THREE from 'three';

/**
 * Sea anemones - colorful bottom-dwelling creatures
 * Adds movement and life to the ocean floor
 */
export class SeaAnemones {
  private anemones: THREE.Group[] = [];
  private time: number = 0;
  
  constructor(scene: THREE.Scene, floorDepth: number, count: number = 25) {
    this.createAnemones(scene, floorDepth, count);
  }
  
  /**
   * Create field of sea anemones
   */
  private createAnemones(scene: THREE.Scene, floorDepth: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 120;
      const z = (Math.random() - 0.5) * 120;
      
      const anemone = this.createAnemone(x, floorDepth, z);
      this.anemones.push(anemone);
      scene.add(anemone);
    }
    
    console.log(`🌺 Created ${count} sea anemones`);
  }
  
  /**
   * Create a single anemone with tentacles
   */
  private createAnemone(x: number, floorY: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const tentacleCount = 12 + Math.floor(Math.random() * 12);
    const height = 0.6 + Math.random() * 0.8;
    
    // Anemone colors
    const colors = [
      0xff6b9d, // Pink
      0xff8c42, // Orange
      0xffbe0b, // Yellow
      0xfb5607, // Red-orange
      0x8338ec, // Purple
      0x3a86ff, // Blue
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Create base (body)
    const baseGeometry = new THREE.CylinderGeometry(0.15, 0.2, height * 0.4, 12);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).multiplyScalar(0.6),
      roughness: 0.9,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = height * 0.2;
    group.add(base);
    
    // Create tentacles
    for (let i = 0; i < tentacleCount; i++) {
      const angle = (i / tentacleCount) * Math.PI * 2;
      const tentacle = this.createTentacle(height, color);
      
      tentacle.position.y = height * 0.4;
      tentacle.rotation.set(
        Math.PI / 3 + Math.random() * 0.3,
        angle,
        0
      );
      
      group.add(tentacle);
    }
    
    group.position.set(x, floorY, z);
    group.userData.baseRotation = Math.random() * Math.PI * 2;
    group.userData.phase = Math.random() * Math.PI * 2;
    
    return group;
  }
  
  /**
   * Create a single anemone tentacle
   */
  private createTentacle(_baseHeight: number, color: number): THREE.Mesh {
    const length = 0.4 + Math.random() * 0.4;
    const segments = 8;
    
    // Create curved tentacle
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        length * 0.5,
        (Math.random() - 0.5) * 0.2
      ),
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        length,
        (Math.random() - 0.5) * 0.3
      )
    );
    
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.02, 6, false);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.8,
      metalness: 0.2,
      emissive: color,
      emissiveIntensity: 0.2,
    });
    
    const tentacle = new THREE.Mesh(tubeGeometry, material);
    return tentacle;
  }
  
  /**
   * Animate anemones - gentle swaying motion
   */
  update(deltaTime: number): void {
    this.time += deltaTime;
    
    for (const anemone of this.anemones) {
      const phase = anemone.userData.phase;
      
      // Gentle swaying
      const swayX = Math.sin(this.time * 0.8 + phase) * 0.1;
      const swayZ = Math.cos(this.time * 0.6 + phase * 1.3) * 0.1;
      
      anemone.rotation.x = swayX;
      anemone.rotation.z = swayZ;
      
      // Animate tentacles
      anemone.children.forEach((child, index) => {
        if (index > 0) { // Skip base
          const tentaclePhase = phase + index * 0.3;
          child.rotation.x += Math.sin(this.time * 1.2 + tentaclePhase) * 0.02;
        }
      });
    }
  }
}

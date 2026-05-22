import * as THREE from 'three';

/**
 * Extra ocean critters: octopuses, seahorses, moray eels, lobsters, nudibranchs.
 * Lightweight procedural geometry + gentle vertex-shader animation.
 */
export class ExtraOceanLife {
  public group: THREE.Group;
  private animatedMaterials: THREE.ShaderMaterial[] = [];

  constructor(scene: THREE.Scene, floorDepth: number) {
    this.group = new THREE.Group();
    this.group.name = 'extraOceanLife';

    this.spawnOctopuses(floorDepth, 6);
    this.spawnSeahorses(floorDepth, 14);
    this.spawnMorayEels(floorDepth, 8);
    this.spawnLobsters(floorDepth, 10);
    this.spawnNudibranchs(floorDepth, 18);

    scene.add(this.group);
  }

  update(deltaTime: number, elapsed: number): void {
    for (const mat of this.animatedMaterials) {
      mat.uniforms.time.value = elapsed;
    }
    // Subtle bobbing of seahorses
    for (const child of this.group.children) {
      if (child.userData.kind === 'seahorse') {
        const t = elapsed + (child.userData.phase as number);
        child.position.y = (child.userData.baseY as number) + Math.sin(t * 0.8) * 0.15;
        child.rotation.z = Math.sin(t * 0.5) * 0.08;
      }
    }
    void deltaTime;
  }

  private makeWaveMaterial(color: THREE.Color, amplitude: number, freq: number): THREE.ShaderMaterial {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        baseColor: { value: color },
        amplitude: { value: amplitude },
        freq: { value: freq },
      },
      vertexShader: /* glsl */ `
        uniform float time;
        uniform float amplitude;
        uniform float freq;
        varying vec3 vNormal;
        varying float vY;
        void main() {
          vec3 p = position;
          float wave = sin(p.y * freq + time * 1.6) * amplitude * smoothstep(0.0, 1.5, abs(p.y));
          p.x += wave * 0.5;
          p.z += wave * 0.4;
          vNormal = normalize(normalMatrix * normal);
          vY = p.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 baseColor;
        varying vec3 vNormal;
        varying float vY;
        void main() {
          vec3 light = normalize(vec3(0.3, 1.0, 0.4));
          float d = max(dot(vNormal, light), 0.0);
          vec3 col = baseColor * (0.45 + 0.7 * d);
          // subtle highlight at top
          col += vec3(0.06) * smoothstep(0.0, 1.5, vY);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.animatedMaterials.push(mat);
    return mat;
  }

  // === OCTOPUS — body + 8 tentacles with rippling wave animation ===
  private spawnOctopuses(floorY: number, count: number): void {
    const octopusColors = [0x8a3a72, 0x6a2a52, 0xb0584a, 0x4a3a72];
    for (let i = 0; i < count; i++) {
      const oct = new THREE.Group();
      const colorHex = octopusColors[i % octopusColors.length];
      const color = new THREE.Color(colorHex);
      const mat = this.makeWaveMaterial(color, 0.18, 3.5);

      // Head — squashed sphere
      const headGeo = new THREE.SphereGeometry(0.9, 18, 14);
      const head = new THREE.Mesh(headGeo, mat);
      head.scale.set(1.0, 0.85, 1.05);
      head.position.y = 1.2;
      oct.add(head);

      // Two eye spots
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff5b0 });
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x121212 });
      for (const ex of [-0.35, 0.35]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), eyeMat);
        eye.position.set(ex, 1.55, 0.6);
        oct.add(eye);
        const pup = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), pupilMat);
        pup.position.set(ex, 1.55, 0.74);
        oct.add(pup);
      }

      // 8 tentacles - tapered cylinders
      for (let t = 0; t < 8; t++) {
        const angle = (t / 8) * Math.PI * 2;
        const tentGeo = new THREE.CylinderGeometry(0.18, 0.06, 1.8, 8, 14);
        // shift so base is at origin and tip at +Y
        tentGeo.translate(0, 0.9, 0);
        const tent = new THREE.Mesh(tentGeo, mat);
        tent.position.set(Math.cos(angle) * 0.5, 0.3, Math.sin(angle) * 0.5);
        tent.rotation.z = Math.cos(angle) * 0.7;
        tent.rotation.x = Math.sin(angle) * 0.7;
        tent.rotation.y = angle;
        oct.add(tent);
      }

      // Place on floor
      oct.position.set(
        (Math.random() - 0.5) * 75,
        floorY + 0.4,
        (Math.random() - 0.5) * 75
      );
      oct.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.7 + Math.random() * 0.5;
      oct.scale.setScalar(s);
      oct.userData.kind = 'octopus';
      this.group.add(oct);
    }
  }

  // === SEAHORSES — vertical posture, slow bob ===
  private spawnSeahorses(floorY: number, count: number): void {
    const seahorseColors = [0xf5a430, 0xc94a78, 0xfff080, 0x82c850];
    for (let i = 0; i < count; i++) {
      const sh = new THREE.Group();
      const color = new THREE.Color(seahorseColors[i % seahorseColors.length]);
      const mat = new THREE.MeshStandardMaterial({
        color, roughness: 0.55, metalness: 0.15,
      });

      // Body — curved cylinder approximated with several stacked spheres
      const segCount = 6;
      for (let s = 0; s < segCount; s++) {
        const t = s / (segCount - 1);
        const r = 0.20 - t * 0.10;
        const segGeo = new THREE.SphereGeometry(r, 12, 10);
        const seg = new THREE.Mesh(segGeo, mat);
        const curve = Math.sin(t * 1.5) * 0.35;
        seg.position.set(curve, 0.8 + t * 1.2, 0);
        sh.add(seg);
      }

      // Head + snout
      const headGeo = new THREE.SphereGeometry(0.22, 12, 10);
      const head = new THREE.Mesh(headGeo, mat);
      head.position.set(0.35 + Math.sin(1.5) * 0.35, 2.0, 0);
      sh.add(head);

      const snoutGeo = new THREE.CylinderGeometry(0.05, 0.10, 0.35, 8);
      const snout = new THREE.Mesh(snoutGeo, mat);
      snout.position.set(0.65, 2.05, 0);
      snout.rotation.z = -Math.PI / 2;
      sh.add(snout);

      // Curled tail tip
      const tailGeo = new THREE.TorusGeometry(0.15, 0.08, 8, 14, Math.PI * 1.4);
      const tail = new THREE.Mesh(tailGeo, mat);
      tail.position.set(-0.1, 0.6, 0);
      tail.rotation.set(Math.PI / 2, 0, Math.PI / 4);
      sh.add(tail);

      // Eye
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x1c1c1c })
      );
      eye.position.set(0.42, 2.05, 0.18);
      sh.add(eye);

      // Position — near kelp/floor, mid-water height
      const baseY = floorY + 1.5 + Math.random() * 4;
      sh.position.set(
        (Math.random() - 0.5) * 70,
        baseY,
        (Math.random() - 0.5) * 70
      );
      sh.rotation.y = Math.random() * Math.PI * 2;
      const scale = 0.7 + Math.random() * 0.5;
      sh.scale.setScalar(scale);
      sh.userData.kind = 'seahorse';
      sh.userData.baseY = baseY;
      sh.userData.phase = Math.random() * Math.PI * 2;
      this.group.add(sh);
    }
  }

  // === MORAY EELS — sinuous body poking out from rocks ===
  private spawnMorayEels(floorY: number, count: number): void {
    const eelColors = [0x5a6a3a, 0x4a5a4a, 0x6a5a3a, 0x3a4a5a];
    for (let i = 0; i < count; i++) {
      const eelColor = new THREE.Color(eelColors[i % eelColors.length]);
      const mat = this.makeWaveMaterial(eelColor, 0.22, 1.8);

      // Long tapered body — 12 segments along Y
      const eel = new THREE.Group();
      const segCount = 14;
      for (let s = 0; s < segCount; s++) {
        const t = s / (segCount - 1);
        const r = 0.22 - t * 0.12;
        const segGeo = new THREE.SphereGeometry(r, 10, 8);
        const seg = new THREE.Mesh(segGeo, mat);
        seg.position.set(0, s * 0.32, 0);
        // gentle curve
        seg.position.x = Math.sin(t * 3.0) * 0.15;
        eel.add(seg);
      }

      // Head with mouth
      const headGeo = new THREE.SphereGeometry(0.28, 12, 10);
      const head = new THREE.Mesh(headGeo, mat);
      head.position.set(Math.sin(3.0) * 0.15, segCount * 0.32, 0);
      head.scale.set(1.0, 0.85, 1.0);
      eel.add(head);

      // Eyes (small white)
      for (const ex of [-0.18, 0.18]) {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xfff080 })
        );
        eye.position.set(ex, segCount * 0.32 + 0.05, 0.22);
        eel.add(eye);
      }

      // Position near rocks
      eel.position.set(
        (Math.random() - 0.5) * 75,
        floorY + 0.5,
        (Math.random() - 0.5) * 75
      );
      eel.rotation.y = Math.random() * Math.PI * 2;
      eel.rotation.z = (Math.random() - 0.5) * 0.4;
      const scale = 0.6 + Math.random() * 0.5;
      eel.scale.setScalar(scale);
      eel.userData.kind = 'eel';
      this.group.add(eel);
    }
  }

  // === LOBSTERS — segmented body + claws ===
  private spawnLobsters(floorY: number, count: number): void {
    const lobsterColors = [0xa84028, 0x802818, 0xc05030, 0x6a3a2a];
    for (let i = 0; i < count; i++) {
      const color = new THREE.Color(lobsterColors[i % lobsterColors.length]);
      const mat = new THREE.MeshStandardMaterial({
        color, roughness: 0.45, metalness: 0.25,
      });
      const lob = new THREE.Group();

      // Body — segmented
      for (let s = 0; s < 5; s++) {
        const segGeo = new THREE.SphereGeometry(0.22 - s * 0.025, 12, 10);
        const seg = new THREE.Mesh(segGeo, mat);
        seg.position.set(-s * 0.28, 0.0, 0);
        seg.scale.set(1.0, 0.7, 1.1);
        lob.add(seg);
      }

      // Tail fan
      const fanGeo = new THREE.ConeGeometry(0.25, 0.35, 5, 1, true);
      const fan = new THREE.Mesh(fanGeo, mat);
      fan.position.set(-1.5, -0.05, 0);
      fan.rotation.z = Math.PI / 2;
      lob.add(fan);

      // Two claws — boxes with cone tips
      for (const side of [-1, 1] as const) {
        const armGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.6, 8);
        const arm = new THREE.Mesh(armGeo, mat);
        arm.position.set(0.4, 0.0, side * 0.35);
        arm.rotation.x = side * 0.5;
        arm.rotation.z = -0.5;
        lob.add(arm);

        const clawGeo = new THREE.SphereGeometry(0.18, 10, 8);
        const claw = new THREE.Mesh(clawGeo, mat);
        claw.scale.set(1.6, 0.7, 0.9);
        claw.position.set(0.85, 0.05, side * 0.55);
        lob.add(claw);
      }

      // Antennae
      const antMat = new THREE.MeshBasicMaterial({ color: 0x6a2a18 });
      for (const side of [-1, 1] as const) {
        const ant = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6),
          antMat
        );
        ant.position.set(0.5, 0.3, side * 0.12);
        ant.rotation.z = -0.6;
        ant.rotation.x = side * 0.3;
        lob.add(ant);
      }

      // Eyes
      for (const side of [-1, 1] as const) {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0x111111 })
        );
        eye.position.set(0.32, 0.18, side * 0.10);
        lob.add(eye);
      }

      lob.position.set(
        (Math.random() - 0.5) * 78,
        floorY + 0.35,
        (Math.random() - 0.5) * 78
      );
      lob.rotation.y = Math.random() * Math.PI * 2;
      const scale = 0.55 + Math.random() * 0.45;
      lob.scale.setScalar(scale);
      lob.userData.kind = 'lobster';
      this.group.add(lob);
    }
  }

  // === NUDIBRANCHS — small colorful sea slugs ===
  private spawnNudibranchs(floorY: number, count: number): void {
    const nudiColors = [
      0xff5fa6, 0xffb030, 0x60d5ff, 0xa050ff,
      0x8aff80, 0xff7050, 0xffe040, 0x60ffcc,
    ];
    for (let i = 0; i < count; i++) {
      const color = new THREE.Color(nudiColors[i % nudiColors.length]);
      const accentColor = new THREE.Color(nudiColors[(i + 3) % nudiColors.length]);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.05,
        emissive: color.clone().multiplyScalar(0.15),
      });
      const accentMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: 0.25,
        metalness: 0.1,
        emissive: accentColor.clone().multiplyScalar(0.2),
      });

      const nud = new THREE.Group();
      // Elongated body
      const bodyGeo = new THREE.SphereGeometry(0.22, 14, 10);
      const body = new THREE.Mesh(bodyGeo, mat);
      body.scale.set(1.6, 0.55, 0.9);
      nud.add(body);

      // Cerata — frilly top spikes
      for (let s = 0; s < 7; s++) {
        const tx = (s / 6 - 0.5) * 0.6;
        const cer = new THREE.Mesh(
          new THREE.ConeGeometry(0.05, 0.18, 6),
          accentMat
        );
        cer.position.set(tx, 0.18, 0);
        nud.add(cer);
      }

      // Rhinophores — antennae
      for (const off of [-0.08, 0.08]) {
        const rh = new THREE.Mesh(
          new THREE.ConeGeometry(0.03, 0.12, 6),
          accentMat
        );
        rh.position.set(0.32, 0.14, off);
        nud.add(rh);
      }

      nud.position.set(
        (Math.random() - 0.5) * 80,
        floorY + 0.12,
        (Math.random() - 0.5) * 80
      );
      nud.rotation.y = Math.random() * Math.PI * 2;
      const scale = 0.55 + Math.random() * 0.5;
      nud.scale.setScalar(scale);
      nud.userData.kind = 'nudibranch';
      this.group.add(nud);
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach(x => x.dispose());
        else m.dispose();
      }
    });
  }
}

import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';
import { sampleSandHeight } from './RealisticOceanFloor';
import { CoralFormations } from './CoralFormations';

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
    this.spawnSeahorses(floorDepth, 16);
    this.spawnMorayEels(floorDepth, 8);
    this.spawnLobsters(floorDepth, 12);
    this.spawnNudibranchs(floorDepth, 22);
    this.spawnAnglerfish(floorDepth, 6);
    this.spawnSquids(floorDepth, 6);
    this.spawnPufferfish(floorDepth, 9);
    this.spawnSeaSnakes(floorDepth, 6);
    this.spawnNautiluses(floorDepth, 5);
    this.spawnGiantClams(floorDepth, 14);
    this.spawnSeaCucumbers(floorDepth, 14);
    this.spawnCuttlefish(floorDepth, 5);
    this.spawnCombJellies(floorDepth, 10);
    this.spawnHermitCrabs(floorDepth, 12);

    // Collapse each creature's many small parts into one mesh per material. This is a pure
    // draw-call optimization — identical geometry, far fewer objects — which matters because
    // the ambient layer is thousands of tiny meshes (e.g. a pufferfish is ~60 spikes).
    this.optimizeDrawCalls();

    scene.add(this.group);
  }

  /** Place floor-dwellers on sand, preferring reef patches when available. */
  private floorSpot(floorY: number, spread = 85): THREE.Vector3 {
    const patches = CoralFormations.lastReefPatches;
    let x: number;
    let z: number;
    if (patches.length && Math.random() < 0.7) {
      const p = patches[Math.floor(Math.random() * patches.length)];
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * (p.radius + 6);
      x = p.x + Math.cos(a) * d;
      z = p.z + Math.sin(a) * d;
    } else {
      x = (Math.random() - 0.5) * spread;
      z = (Math.random() - 0.5) * spread;
    }
    return new THREE.Vector3(x, floorY + sampleSandHeight(x, z) + 0.15, z);
  }

  /**
   * Merge each creature Group's meshes by shared material into a single merged mesh per
   * material. Appearance is unchanged (same triangles); only the object/draw-call count
   * drops. Guarded per-creature: any merge failure leaves that creature untouched. Meshes
   * flagged `userData.noMerge` (e.g. the animated anglerfish lure) are kept separate.
   */
  private optimizeDrawCalls(): void {
    for (const creature of this.group.children) {
      if (!(creature instanceof THREE.Group)) continue;
      try {
        const lure = creature.userData.lure as THREE.Object3D | undefined;
        const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
        const kept: THREE.Object3D[] = [];

        for (const child of [...creature.children]) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.Material;
          if (!mesh.isMesh || Array.isArray(mesh.material) || mesh === lure || mesh.userData.noMerge) {
            kept.push(child);
            continue;
          }
          const geo = mesh.geometry.clone();
          mesh.updateMatrix();
          geo.applyMatrix4(mesh.matrix); // parts are flat children of the creature group
          // Uniform attribute set so same-material parts merge cleanly.
          for (const name of Object.keys(geo.attributes)) {
            if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
          }
          if (!geo.getAttribute('normal')) geo.computeVertexNormals();
          if (!geo.getAttribute('uv')) {
            const c = geo.getAttribute('position').count;
            geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c * 2), 2));
          }
          const list = byMaterial.get(mat) ?? [];
          list.push(geo.index ? geo.toNonIndexed() : geo);
          byMaterial.set(mat, list);
        }

        const mergedMeshes: THREE.Mesh[] = [];
        for (const [mat, geos] of byMaterial) {
          const merged = geos.length === 1 ? geos[0] : mergeBufferGeometries(geos, false);
          if (!merged) {
            // Merge failed for this material bucket — bail out of optimizing this creature.
            throw new Error('merge failed');
          }
          mergedMeshes.push(new THREE.Mesh(merged, mat));
        }

        creature.clear();
        for (const m of mergedMeshes) creature.add(m);
        for (const k of kept) creature.add(k);
      } catch {
        /* leave this creature as-is (unoptimized but correct) */
      }
    }
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
      } else if (child.userData.kind === 'angler') {
        // Hover + drift, and pulse the lure so it throbs like real biolume.
        const t = elapsed + (child.userData.phase as number);
        child.position.y = (child.userData.baseY as number) + Math.sin(t * 0.5) * 0.5;
        child.rotation.y = (child.userData.baseYaw as number) + Math.sin(t * 0.25) * 0.5;
        const lure = child.userData.lure as THREE.Mesh | undefined;
        if (lure) {
          const pulse = 0.7 + 0.3 * Math.sin(t * 2.2);
          lure.scale.setScalar(pulse);
          (lure.material as THREE.MeshBasicMaterial).color.setRGB(0.4 * pulse, 1.0 * pulse, 0.85 * pulse);
        }
      } else {
        // Gentle idle drift for the free-swimming ambient species so they are alive rather
        // than frozen. Floor-dwellers (clams, cucumbers, crabs) are intentionally excluded.
        const amp = ExtraOceanLife.DRIFT_AMP[child.userData.kind as string];
        if (amp) {
          if (child.userData.baseY === undefined) {
            child.userData.baseY = child.position.y;
            child.userData.baseYaw = child.rotation.y;
            child.userData.phase = child.position.x * 0.3 + child.position.z * 0.2;
          }
          const t = elapsed + (child.userData.phase as number);
          child.position.y = (child.userData.baseY as number) + Math.sin(t * 0.4) * 0.35 * amp;
          child.rotation.y = (child.userData.baseYaw as number) + Math.sin(t * 0.18) * 0.35;
          child.rotation.z = Math.sin(t * 0.5) * 0.05 * amp;
        }
      }
    }
    void deltaTime;
  }

  /** Idle-drift amplitude per free-swimming species (floor-dwellers omitted = static). */
  private static readonly DRIFT_AMP: Record<string, number> = {
    squid: 1.0,
    cuttlefish: 0.9,
    nautilus: 0.7,
    combjelly: 1.2,
    octopus: 0.4,
  };

  // === ANGLERFISH — deep-sea predator with a bioluminescent lure. The lure is an
  // unlit bright mesh so it blooms and, in the bioluminescent night look, becomes one
  // of the few light sources in the scene. ===
  private spawnAnglerfish(floorY: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angler = new THREE.Group();
      const bodyMat = this.makeWaveMaterial(new THREE.Color(0x14181f), 0.05, 2.2);

      // Bulbous body tapering to a thin tail.
      const bodyGeo = new THREE.SphereGeometry(1.0, 20, 16);
      const bpos = bodyGeo.attributes.position;
      for (let v = 0; v < bpos.count; v++) {
        const x = bpos.getX(v);
        const taper = x < 0 ? 1 - 0.7 * Math.min(1, -x) : 1; // pinch the tail (-x)
        bpos.setY(v, bpos.getY(v) * taper);
        bpos.setZ(v, bpos.getZ(v) * taper);
      }
      bodyGeo.computeVertexNormals();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.scale.set(1.1, 0.95, 0.9);
      angler.add(body);

      // Gaping lower jaw — a ring of needle teeth at the front (+x).
      const toothMat = new THREE.MeshBasicMaterial({ color: 0xdfe6ea });
      for (let t = 0; t < 10; t++) {
        const a = (t / 10) * Math.PI * 2;
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.34, 5), toothMat);
        tooth.position.set(0.92, Math.sin(a) * 0.34, Math.cos(a) * 0.34);
        tooth.rotation.z = Math.PI / 2; // point forward (+x)
        angler.add(tooth);
      }

      // Big eye.
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf6e7a0 });
      for (const ez of [-0.42, 0.42]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), eyeMat);
        eye.position.set(0.5, 0.34, ez);
        angler.add(eye);
        const pup = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
        pup.position.set(0.6, 0.34, ez);
        angler.add(pup);
      }

      // Illicium (stalk) curving forward over the mouth, ending in the glowing lure.
      const stalkMat = new THREE.MeshBasicMaterial({ color: 0x0d1216 });
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.5, 6), stalkMat);
      stalk.position.set(0.5, 1.0, 0);
      stalk.rotation.z = -0.9; // lean forward over the head
      angler.add(stalk);

      const lureMat = new THREE.MeshBasicMaterial({ color: 0x66ffd8 });
      const lure = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lureMat);
      lure.position.set(1.25, 1.5, 0);
      angler.add(lure);

      // Hover somewhere in the lower-mid water column (anglerfish are deep).
      const baseY = floorY + 2 + Math.random() * 12;
      const baseYaw = Math.random() * Math.PI * 2;
      angler.position.set((Math.random() - 0.5) * 80, baseY, (Math.random() - 0.5) * 80);
      angler.rotation.y = baseYaw;
      angler.scale.setScalar(0.8 + Math.random() * 0.6);
      angler.userData.kind = 'angler';
      angler.userData.baseY = baseY;
      angler.userData.baseYaw = baseYaw;
      angler.userData.phase = Math.random() * Math.PI * 2;
      angler.userData.lure = lure;
      this.group.add(angler);
    }
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
        varying vec3 vWorldPos;
        varying float vY;
        void main() {
          vec3 p = position;
          float wave = sin(p.y * freq + time * 1.6) * amplitude * smoothstep(0.0, 1.5, abs(p.y));
          p.x += wave * 0.5;
          p.z += wave * 0.4;
          vNormal = normalize(normalMatrix * normal);
          vWorldPos = (modelMatrix * vec4(p, 1.0)).xyz;
          vY = p.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 baseColor;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying float vY;
        void main() {
          vec3 light = normalize(vec3(0.25, 1.0, 0.35));
          float d = max(dot(vNormal, light), 0.0);
          float rim = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.4);
          // Mantle mottling
          float mott = sin(vWorldPos.x * 4.2) * sin(vWorldPos.z * 3.6 + vY * 2.0);
          mott = smoothstep(-0.2, 0.55, mott);
          vec3 col = baseColor * (0.38 + 0.78 * d);
          col = mix(col * 0.78, col * 1.18, mott);
          col += vec3(0.12, 0.28, 0.36) * rim * 0.55;
          col += vec3(0.08) * smoothstep(0.0, 1.5, vY);
          // Wet specular kick
          float spec = pow(max(dot(reflect(-light, vNormal), vec3(0.0, 0.2, 1.0)), 0.0), 48.0);
          col += vec3(0.55, 0.72, 0.85) * spec * 0.45;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.animatedMaterials.push(mat);
    return mat;
  }

  /** Wet Physical material helper for ambient reef critters. */
  private wetMat(color: number | THREE.Color, opts: {
    roughness?: number;
    metalness?: number;
    clearcoat?: number;
    emissive?: number;
    emissiveIntensity?: number;
    iridescence?: number;
  } = {}): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: opts.roughness ?? 0.45,
      metalness: opts.metalness ?? 0.08,
      clearcoat: opts.clearcoat ?? 0.45,
      clearcoatRoughness: 0.22,
      emissive: new THREE.Color(opts.emissive ?? 0x000000),
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      iridescence: opts.iridescence ?? 0,
      iridescenceIOR: 1.33,
      iridescenceThicknessRange: [80, 280],
      sheen: 0.2,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color(0x6699aa),
    });
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

  // === CUTTLEFISH — broad flat mantle with a fin fringe, W-eyes, arm cluster ===
  private spawnCuttlefish(floorY: number, count: number): void {
    const cuttleColors = [0x9a8a6a, 0x7a6a8a, 0x8a7a5a, 0x6a7a7a];
    for (let i = 0; i < count; i++) {
      const cuttle = new THREE.Group();
      const color = new THREE.Color(cuttleColors[i % cuttleColors.length]);
      const mat = this.makeWaveMaterial(color, 0.06, 2.4);

      // Broad flattened mantle.
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), mat);
      body.scale.set(1.4, 0.5, 0.85);
      cuttle.add(body);

      // Continuous undulating fin fringe skirting the mantle.
      const fin = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.09, 8, 32), mat);
      const fp = fin.geometry.attributes.position;
      for (let v = 0; v < fp.count; v++) {
        const ang = Math.atan2(fp.getZ(v), fp.getX(v));
        fp.setY(v, fp.getY(v) + Math.sin(ang * 10) * 0.05);
      }
      fin.geometry.computeVertexNormals();
      fin.rotation.x = Math.PI / 2;
      fin.scale.set(1.4, 0.85, 1);
      cuttle.add(fin);

      // W-shaped eyes.
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0c0c0c });
      for (const sgn of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), eyeMat);
        eye.position.set(0.55, 0.12, sgn * 0.25);
        cuttle.add(eye);
      }

      // Short arm cluster at the front.
      for (let a = 0; a < 8; a++) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.015, 0.5, 5), mat);
        arm.geometry.translate(0, -0.25, 0);
        arm.position.set(0.85, 0, 0);
        arm.rotation.z = Math.PI / 2 + 0.3;
        arm.rotation.x = (a / 8) * Math.PI * 2;
        cuttle.add(arm);
      }

      cuttle.position.set((Math.random() - 0.5) * 80, floorY + 3 + Math.random() * 10, (Math.random() - 0.5) * 80);
      cuttle.rotation.y = Math.random() * Math.PI * 2;
      cuttle.scale.setScalar(0.7 + Math.random() * 0.5);
      cuttle.userData.kind = 'cuttlefish';
      this.group.add(cuttle);
    }
  }

  // === COMB JELLY (ctenophore) — translucent oval with 8 rainbow-cilia rows ===
  private spawnCombJellies(floorY: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const jelly = new THREE.Group();

      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 14),
        new THREE.MeshPhysicalMaterial({
          color: 0xbfe6ff,
          transparent: true,
          opacity: 0.28,
          roughness: 0.1,
          transmission: 0.7,
          thickness: 0.4,
          side: THREE.DoubleSide,
        })
      );
      body.scale.set(0.8, 1.3, 0.8);
      jelly.add(body);

      // Iridescent comb rows — hue-cycling ShaderMaterial so cilia shimmer like real CTENES
      const rowMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          time: { value: 0 },
          phase: { value: Math.random() * Math.PI * 2 },
        },
        vertexShader: /* glsl */ `
          varying float vY;
          void main() {
            vY = position.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float time;
          uniform float phase;
          varying float vY;
          void main() {
            float hue = fract(vY * 0.55 + time * 0.35 + phase);
            // Cheap HSV→RGB rainbow for comb-row bioluminescence
            vec3 rgb = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
            float pulse = 0.65 + 0.35 * sin(time * 2.4 + vY * 8.0 + phase);
            gl_FragColor = vec4(rgb * 1.15, 0.85 * pulse);
          }
        `,
      });
      this.animatedMaterials.push(rowMat);

      for (let r = 0; r < 8; r++) {
        const ang = (r / 8) * Math.PI * 2;
        const row = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.0, 0.06), rowMat);
        row.position.set(Math.cos(ang) * 0.33, 0, Math.sin(ang) * 0.33);
        row.userData.noMerge = true;
        jelly.add(row);
      }

      jelly.position.set((Math.random() - 0.5) * 80, floorY + 5 + Math.random() * 16, (Math.random() - 0.5) * 80);
      jelly.rotation.y = Math.random() * Math.PI * 2;
      jelly.scale.setScalar(0.7 + Math.random() * 0.7);
      jelly.userData.kind = 'combjelly';
      this.group.add(jelly);
    }
  }

  // === HERMIT CRABS — a spiral shell with crab legs + claws poking out, on the floor ===
  private spawnHermitCrabs(floorY: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const crab = new THREE.Group();
      const shellA = this.wetMat(0xcaa877, { roughness: 0.55 });
      const shellB = this.wetMat(0x8a5a35, { roughness: 0.55 });
      const bodyMat = this.wetMat(0xb0503a, { roughness: 0.45, metalness: 0.12, clearcoat: 0.35 });

      // Coiled shell (small spiral of chambers).
      const turns = 8;
      for (let s = 0; s < turns; s++) {
        const ang = (s / turns) * Math.PI * 2.2;
        const rad = 0.42 * Math.pow(0.82, s);
        const chamber = new THREE.Mesh(new THREE.SphereGeometry(rad, 10, 8), s % 2 === 0 ? shellA : shellB);
        chamber.position.set(Math.cos(ang) * 0.28, 0.35 + Math.sin(ang) * 0.28, 0);
        crab.add(chamber);
      }

      // Head + eyes on stalks poking out.
      for (const sgn of [-1, 1]) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 5), bodyMat);
        stalk.position.set(0.42, 0.25, sgn * 0.08);
        crab.add(stalk);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x101010 }));
        eye.position.set(0.42, 0.34, sgn * 0.08);
        crab.add(eye);
      }

      // Legs + two claws.
      for (let l = 0; l < 4; l++) {
        for (const sgn of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.4, 5), bodyMat);
          leg.position.set(0.3 - l * 0.12, 0.05, sgn * 0.2);
          leg.rotation.x = sgn * 0.9;
          leg.rotation.z = 0.5;
          crab.add(leg);
        }
      }
      for (const sgn of [-1, 1]) {
        const claw = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), bodyMat);
        claw.position.set(0.5, 0.1, sgn * 0.18);
        claw.scale.set(1.2, 0.7, 0.7);
        crab.add(claw);
      }

      crab.position.copy(this.floorSpot(floorY));
      crab.rotation.y = Math.random() * Math.PI * 2;
      crab.scale.setScalar(0.6 + Math.random() * 0.5);
      crab.userData.kind = 'hermitcrab';
      this.group.add(crab);
    }
  }

  // === NAUTILUS — coiled spiral shell with striped chambers + tentacle cluster ===
  private spawnNautiluses(floorY: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const naut = new THREE.Group();
      const shellA = this.wetMat(0xf3ead2, { roughness: 0.42, clearcoat: 0.4 });
      const shellB = this.wetMat(0xb5502f, { roughness: 0.42, clearcoat: 0.4 });

      // Logarithmic spiral of shrinking spheres forming the coiled shell.
      const turns = 18;
      for (let s = 0; s < turns; s++) {
        const t = s / (turns - 1);
        const ang = t * Math.PI * 2.4;
        const rad = 0.9 * Math.pow(0.86, s); // tighten inward
        const chamber = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.42, 12, 10), s % 2 === 0 ? shellA : shellB);
        chamber.position.set(Math.cos(ang) * (0.9 - rad * 0.3), Math.sin(ang) * (0.9 - rad * 0.3), 0);
        chamber.scale.z = 0.6; // flatten the shell disc
        naut.add(chamber);
      }

      // Tentacle cluster + hood at the shell opening.
      const flesh = this.wetMat(0xd9a07a, { roughness: 0.4, clearcoat: 0.5, iridescence: 0.2 });
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), flesh);
      hood.position.set(0.95, -0.2, 0);
      hood.scale.set(0.9, 0.8, 0.6);
      naut.add(hood);
      for (let a = 0; a < 12; a++) {
        const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.01, 0.5, 5), flesh);
        tent.geometry.translate(0, -0.25, 0);
        tent.position.set(1.15, -0.2, 0);
        tent.rotation.z = 0.9 + (a / 12) * 0.8;
        tent.rotation.x = (a / 12) * Math.PI * 2;
        naut.add(tent);
      }

      naut.position.set((Math.random() - 0.5) * 80, floorY + 2 + Math.random() * 10, (Math.random() - 0.5) * 80);
      naut.rotation.y = Math.random() * Math.PI * 2;
      naut.scale.setScalar(0.6 + Math.random() * 0.4);
      naut.userData.kind = 'nautilus';
      this.group.add(naut);
    }
  }

  // === GIANT CLAM — two ridged shells with a colorful wavy mantle lip, on the seabed ===
  private spawnGiantClams(floorY: number, count: number): void {
    const mantleColors = [0x2a9d8f, 0x4361a8, 0x8a4fa0, 0x2a8fb0, 0x3aa06a];
    for (let i = 0; i < count; i++) {
      const clam = new THREE.Group();
      const shellMat = this.wetMat(0xdad2c0, { roughness: 0.65, clearcoat: 0.25 });
      const mantleMat = this.wetMat(mantleColors[i % mantleColors.length], {
        roughness: 0.32,
        clearcoat: 0.55,
        emissive: mantleColors[i % mantleColors.length],
        emissiveIntensity: 0.28,
        iridescence: 0.45,
      });

      // Two fluted half-shells (open like a clam), built from a ridged half-sphere.
      for (const sgn of [1, -1]) {
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
        // Radial flutes by nudging vertices.
        const p = shell.geometry.attributes.position;
        for (let v = 0; v < p.count; v++) {
          const ang = Math.atan2(p.getZ(v), p.getX(v));
          const flute = 1 + 0.08 * Math.sin(ang * 9);
          p.setX(v, p.getX(v) * flute);
          p.setZ(v, p.getZ(v) * flute);
        }
        shell.geometry.computeVertexNormals();
        shell.position.y = 0.3;
        shell.rotation.z = sgn * 0.5; // gape open
        shell.scale.y = sgn; // mirror lower shell
        clam.add(shell);
      }

      // Wavy mantle lip visible in the gape.
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 8, 24), mantleMat);
      const lp = lip.geometry.attributes.position;
      for (let v = 0; v < lp.count; v++) {
        lp.setY(v, lp.getY(v) + Math.sin(Math.atan2(lp.getZ(v), lp.getX(v)) * 8) * 0.06);
      }
      lip.geometry.computeVertexNormals();
      lip.rotation.x = Math.PI / 2;
      lip.position.y = 0.32;
      clam.add(lip);

      clam.position.copy(this.floorSpot(floorY));
      clam.rotation.y = Math.random() * Math.PI * 2;
      clam.scale.setScalar(0.6 + Math.random() * 0.8);
      clam.userData.kind = 'giantclam';
      this.group.add(clam);
    }
  }

  // === SEA CUCUMBERS — knobbly tube bodies resting on the seabed ===
  private spawnSeaCucumbers(floorY: number, count: number): void {
    const cukeColors = [0x7a3b2e, 0x5a4a2a, 0x8a5a3a, 0x4a3a4a, 0x9a6a4a];
    for (let i = 0; i < count; i++) {
      const cuke = new THREE.Group();
      const mat = this.wetMat(cukeColors[i % cukeColors.length], { roughness: 0.72, clearcoat: 0.2 });

      // Bumpy tube: a stretched, noisy sphere.
      const geo = new THREE.SphereGeometry(0.35, 16, 12);
      const p = geo.attributes.position;
      for (let v = 0; v < p.count; v++) {
        const x = p.getX(v);
        const bump = 1 + 0.12 * Math.sin(x * 20) * Math.sin(p.getY(v) * 14);
        p.setY(v, p.getY(v) * bump);
        p.setZ(v, p.getZ(v) * bump);
      }
      geo.computeVertexNormals();
      const body = new THREE.Mesh(geo, mat);
      body.scale.set(2.4, 0.8, 0.8); // elongate along x
      cuke.add(body);

      // A few tube-feet / papillae bumps on top.
      const footMat = this.wetMat(
        new THREE.Color(cukeColors[i % cukeColors.length]).multiplyScalar(1.3),
        { roughness: 0.7, clearcoat: 0.15 }
      );
      for (let f = 0; f < 8; f++) {
        const foot = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), footMat);
        foot.position.set((f / 7 - 0.5) * 1.5, 0.28, (Math.random() - 0.5) * 0.3);
        cuke.add(foot);
      }

      cuke.position.copy(this.floorSpot(floorY));
      cuke.rotation.y = Math.random() * Math.PI * 2;
      cuke.scale.setScalar(0.6 + Math.random() * 0.6);
      cuke.userData.kind = 'seacucumber';
      this.group.add(cuke);
    }
  }

  // === SQUID — elongated mantle, rear fins, arm cluster, drifting mid-water ===
  private spawnSquids(floorY: number, count: number): void {
    const squidColors = [0xc8687a, 0xb0584a, 0x9a5aa0, 0xd07a6a];
    for (let i = 0; i < count; i++) {
      const squid = new THREE.Group();
      const color = new THREE.Color(squidColors[i % squidColors.length]);
      const mat = this.makeWaveMaterial(color, 0.1, 3.0);

      // Mantle — a tapered tube pointed at the rear (-x), open toward the arms (+x).
      const mantleGeo = new THREE.CylinderGeometry(0.42, 0.06, 2.0, 14, 1);
      mantleGeo.rotateZ(Math.PI / 2); // lie along x
      const mantle = new THREE.Mesh(mantleGeo, mat);
      mantle.position.x = -0.4;
      squid.add(mantle);

      // Two triangular rear fins.
      for (const sgn of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 4), mat);
        fin.position.set(-1.25, 0, sgn * 0.25);
        fin.rotation.z = Math.PI / 2;
        fin.scale.set(0.5, 1, 1);
        squid.add(fin);
      }

      // Big eyes near the mantle opening.
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf0e090 });
      for (const sgn of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), eyeMat);
        eye.position.set(0.5, 0.05, sgn * 0.3);
        squid.add(eye);
      }

      // 8 arms + 2 longer tentacles trailing from the front (+x).
      for (let a = 0; a < 10; a++) {
        const long = a >= 8;
        const len = long ? 1.8 : 1.0;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, len, 6), mat);
        arm.geometry.translate(0, -len / 2, 0);
        const ang = (a / 8) * Math.PI * 2;
        arm.position.set(0.75, 0, 0);
        arm.rotation.z = Math.PI / 2 + 0.2;
        arm.rotation.x = ang;
        arm.position.y += Math.cos(ang) * 0.18;
        arm.position.z += Math.sin(ang) * 0.18;
        squid.add(arm);
      }

      squid.position.set((Math.random() - 0.5) * 80, floorY + 4 + Math.random() * 14, (Math.random() - 0.5) * 80);
      squid.rotation.y = Math.random() * Math.PI * 2;
      squid.scale.setScalar(0.7 + Math.random() * 0.5);
      squid.userData.kind = 'squid';
      this.group.add(squid);
    }
  }

  // === PUFFERFISH — spiky sphere, stubby fins, wide-set eyes ===
  private spawnPufferfish(floorY: number, count: number): void {
    const pufferColors = [0xd9b25a, 0xc98a4a, 0xe0c070, 0xb9a05a];
    for (let i = 0; i < count; i++) {
      const puffer = new THREE.Group();
      const color = new THREE.Color(pufferColors[i % pufferColors.length]);
      const mat = this.wetMat(color, { roughness: 0.4, clearcoat: 0.55, iridescence: 0.25 });

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 14), mat);
      puffer.add(body);

      // Spikes distributed over the sphere (fibonacci-ish).
      const spikeMat = this.wetMat(color.clone().multiplyScalar(0.8), { roughness: 0.55, clearcoat: 0.3 });
      const spikeCount = 60;
      for (let s = 0; s < spikeCount; s++) {
        const phi = Math.acos(1 - (2 * (s + 0.5)) / spikeCount);
        const theta = Math.PI * (1 + Math.sqrt(5)) * s;
        const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 5), spikeMat);
        spike.position.copy(dir.clone().multiplyScalar(0.52));
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        puffer.add(spike);
      }

      // Eyes + tiny tail.
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x101010 });
      for (const sgn of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), eyeMat);
        eye.position.set(0.42, 0.18, sgn * 0.22);
        puffer.add(eye);
      }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 6), mat);
      tail.position.set(-0.6, 0, 0);
      tail.rotation.z = Math.PI / 2;
      puffer.add(tail);

      puffer.position.set((Math.random() - 0.5) * 80, floorY + 2 + Math.random() * 12, (Math.random() - 0.5) * 80);
      puffer.rotation.y = Math.random() * Math.PI * 2;
      puffer.scale.setScalar(0.7 + Math.random() * 0.6);
      puffer.userData.kind = 'pufferfish';
      this.group.add(puffer);
    }
  }

  // === SEA SNAKES — sinuous banded body, undulating along the seabed ===
  private spawnSeaSnakes(floorY: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const snake = new THREE.Group();
      const baseHue = 0.12 + Math.random() * 0.5;
      const bandA = new THREE.Color().setHSL(baseHue, 0.5, 0.5);
      const bandB = new THREE.Color(0x1a1a22);
      const matA = this.wetMat(bandA, { roughness: 0.38, clearcoat: 0.5, metalness: 0.12 });
      const matB = this.wetMat(bandB, { roughness: 0.38, clearcoat: 0.5, metalness: 0.12 });

      const segCount = 16;
      for (let s = 0; s < segCount; s++) {
        const t = s / (segCount - 1);
        const r = 0.16 * (1 - 0.5 * Math.abs(t - 0.5) * 2) + 0.03; // fatter middle
        const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), s % 2 === 0 ? matA : matB);
        seg.position.set(t * 4.5 - 2.25, Math.sin(t * Math.PI * 3) * 0.4, Math.cos(t * Math.PI * 3) * 0.2);
        snake.add(seg);
      }
      // Head slightly larger with eyes.
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), matA);
      head.position.set(2.4, Math.sin(Math.PI * 3) * 0.4, 0);
      head.scale.set(1.3, 0.9, 0.9);
      snake.add(head);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf6d060 });
      for (const sgn of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeMat);
        eye.position.set(2.5, 0.05, sgn * 0.12);
        snake.add(eye);
      }

      snake.position.set((Math.random() - 0.5) * 80, floorY + 0.8 + Math.random() * 6, (Math.random() - 0.5) * 80);
      snake.rotation.y = Math.random() * Math.PI * 2;
      snake.scale.setScalar(0.7 + Math.random() * 0.5);
      snake.userData.kind = 'seasnake';
      this.group.add(snake);
    }
  }

  // === SEAHORSES — vertical posture, slow bob ===
  private spawnSeahorses(floorY: number, count: number): void {
    const seahorseColors = [0xf5a430, 0xc94a78, 0xfff080, 0x82c850];
    for (let i = 0; i < count; i++) {
      const sh = new THREE.Group();
      const color = new THREE.Color(seahorseColors[i % seahorseColors.length]);
      const mat = this.wetMat(color, { roughness: 0.4, metalness: 0.18, clearcoat: 0.55, iridescence: 0.2 });

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
      const mat = this.wetMat(color, { roughness: 0.35, metalness: 0.28, clearcoat: 0.55 });
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

      lob.position.copy(this.floorSpot(floorY));
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
      const mat = this.wetMat(color, {
        roughness: 0.28,
        clearcoat: 0.6,
        emissive: color.getHex(),
        emissiveIntensity: 0.22,
        iridescence: 0.35,
      });
      const accentMat = this.wetMat(accentColor, {
        roughness: 0.22,
        clearcoat: 0.65,
        emissive: accentColor.getHex(),
        emissiveIntensity: 0.28,
        iridescence: 0.4,
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

      nud.position.copy(this.floorSpot(floorY));
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

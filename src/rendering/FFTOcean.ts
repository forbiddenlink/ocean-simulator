import * as THREE from 'three';
import { MultiScaleWaves } from './MultiScaleWaves';
import { TilingPrevention } from './TilingPrevention';
import { OceanCascade } from './OceanCascade';

/**
 * Dual-cascade Tessendorf FFT ocean.
 *
 * Large cascade  — low-frequency swell over the full patch
 * Detail cascade — high-frequency chop over a smaller tiling domain
 * Gerstner+noise — mid/micro scales in the vertex shader
 *
 * Mesh density is decoupled from FFT resolution so we can keep verts moderate
 * while textures carry more spectral detail.
 */
export class FFTOcean {
  public mesh: THREE.Mesh;

  private large: OceanCascade;
  private detail: OceanCascade;
  private multiScaleWaves: MultiScaleWaves;
  private tilingPrevention: TilingPrevention;
  private geometry: THREE.PlaneGeometry;
  private material: THREE.ShaderMaterial;

  private resolution: number;
  private size: number;
  private meshSegments: number;
  private choppiness: number = 1.85;
  private enableMultiScale: boolean = true;
  private time: number = 0;
  private windDirection: THREE.Vector2;

  constructor(
    resolution: number = 256,
    size: number = 1000,
    windSpeed: number = 20,
    windDirection: THREE.Vector2 = new THREE.Vector2(1, 0.5),
    waveAmplitude: number = 2.0
  ) {
    this.resolution = resolution;
    this.size = size;
    this.windDirection = windDirection.clone().normalize();
    // Dense enough mesh for close-up silhouette without matching 512² verts
    this.meshSegments = Math.min(384, Math.max(192, resolution));

    this.large = new OceanCascade(
      resolution,
      size,
      windSpeed,
      this.windDirection,
      waveAmplitude,
      this.choppiness,
      0.0008
    );

    // High-frequency cascade: ~1/10 patch size, milder amp, less small-wave suppression
    const detailRes = Math.max(64, resolution >> 1);
    this.detail = new OceanCascade(
      detailRes,
      size / 9,
      windSpeed * 0.85,
      new THREE.Vector2(this.windDirection.x + 0.35, this.windDirection.y - 0.2).normalize(),
      waveAmplitude * 0.22,
      this.choppiness * 1.15,
      0.00005
    );

    this.multiScaleWaves = new MultiScaleWaves();
    this.tilingPrevention = new TilingPrevention(resolution);

    this.geometry = new THREE.PlaneGeometry(size, size, this.meshSegments, this.meshSegments);
    this.geometry.rotateX(-Math.PI / 2);

    this.material = this.createOceanMaterial();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.y = 0;

    this.large.update(0);
    this.detail.update(0);
  }

  private createOceanMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        heightMap: { value: this.large.getHeightTexture() },
        normalMap: { value: this.large.getNormalTexture() },
        displacementMap: { value: this.large.getDisplacementTexture() },
        heightMapDetail: { value: this.detail.getHeightTexture() },
        normalMapDetail: { value: this.detail.getNormalTexture() },
        displacementMapDetail: { value: this.detail.getDisplacementTexture() },
        detailOceanSize: { value: this.detail.size },
        detailBlend: { value: 1.0 },

        deepColor: { value: new THREE.Color(0x002233) },
        shallowColor: { value: new THREE.Color(0x1a8fa5) },
        waterColor: { value: new THREE.Color(0x0a6f8d) },

        fresnelBias: { value: 0.02 },
        fresnelScale: { value: 1.0 },
        fresnelPower: { value: 5.0 },

        sunDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
        sunColor: { value: new THREE.Color(0xffffff) },
        sunIntensity: { value: 1.5 },

        envMap: { value: null },
        envMapIntensity: { value: 1.15 },

        oceanSize: { value: this.size },
        choppiness: { value: this.choppiness },
        enableMultiScale: { value: this.enableMultiScale ? 1.0 : 0.0 },
        fftResolution: { value: this.resolution },

        noiseTexture: { value: this.tilingPrevention.getNoiseTexture() },
        tilingOffset1: { value: new THREE.Vector2(0, 0) },
        tilingOffset2: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      side: THREE.DoubleSide,
      transparent: true,
    });
  }

  private getVertexShader(): string {
    const gerstnerCode = this.multiScaleWaves.getGerstnerShaderCode();
    const rippleCode = this.multiScaleWaves.getRippleNoiseShaderCode();

    return `
      uniform float time;
      uniform sampler2D heightMap;
      uniform sampler2D displacementMap;
      uniform sampler2D normalMap;
      uniform sampler2D heightMapDetail;
      uniform sampler2D displacementMapDetail;
      uniform sampler2D normalMapDetail;
      uniform float oceanSize;
      uniform float detailOceanSize;
      uniform float detailBlend;
      uniform float choppiness;
      uniform float enableMultiScale;

      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewDirection;
      varying float vHeight;
      varying float vFoam;

      ${gerstnerCode}
      ${rippleCode}

      void main() {
        vUv = uv;

        // Large swell cascade (world UV)
        vec2 largeSample = texture2D(heightMap, uv).rg;
        float height = largeSample.r;
        float foam = largeSample.g;
        vec3 displacement = texture2D(displacementMap, uv).rgb;
        vec3 nLarge = texture2D(normalMap, uv).rgb * 2.0 - 1.0;

        // Detail cascade — tiles at higher spatial frequency
        vec2 detailUv = fract(uv * (oceanSize / max(detailOceanSize, 1.0)));
        vec2 detailSample = texture2D(heightMapDetail, detailUv).rg;
        float heightD = detailSample.r;
        float foamD = detailSample.g;
        vec3 displacementD = texture2D(displacementMapDetail, detailUv).rgb;
        vec3 nDetail = texture2D(normalMapDetail, detailUv).rgb * 2.0 - 1.0;

        float h = height + heightD * detailBlend;
        float f = max(foam, foamD * detailBlend * 0.85);
        vec3 disp = displacement + displacementD * detailBlend;

        vec3 displacedPosition = position;
        displacedPosition.y += h;
        displacedPosition.x += disp.x * choppiness;
        displacedPosition.z += disp.z * choppiness;

        if (enableMultiScale > 0.5) {
          vec3 gerstnerOffset = applyGerstnerWaves(displacedPosition, time);
          displacedPosition += gerstnerOffset;
          displacedPosition.y += applyRippleNoise(displacedPosition, time);
        }

        // Blend normals in tangent-ish space then to view
        vec3 n = normalize(mix(nLarge, normalize(nLarge + nDetail * detailBlend * 0.65), 0.55));
        vNormal = normalize(normalMatrix * n);

        vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
        vWorldPosition = worldPosition.xyz;
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        vHeight = displacedPosition.y;
        vFoam = f;

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `;
  }

  private getFragmentShader(): string {
    return `
      uniform vec3 deepColor;
      uniform vec3 shallowColor;
      uniform vec3 waterColor;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      uniform float sunIntensity;
      uniform float fresnelBias;
      uniform float fresnelScale;
      uniform float fresnelPower;
      uniform float time;
      uniform float envMapIntensity;
      uniform sampler2D heightMap;
      uniform sampler2D displacementMap;
      uniform float choppiness;
      uniform float fftResolution;

      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vViewDirection;
      varying float vHeight;
      varying float vFoam;

      const float IOR_WATER = 1.333;
      const float IOR_AIR = 1.0;
      const vec3 ABSORPTION_COEFF = vec3(0.45, 0.15, 0.05);

      vec3 sampleSky(vec3 dir) {
        vec3 d = normalize(dir);
        float elev = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 zenith = vec3(0.28, 0.52, 0.92);
        vec3 horizon = vec3(0.55, 0.72, 0.88);
        vec3 nadir = vec3(0.08, 0.18, 0.28);
        vec3 sky = elev > 0.5
          ? mix(horizon, zenith, (elev - 0.5) * 2.0)
          : mix(nadir, horizon, elev * 2.0);
        float sunDot = max(dot(d, normalize(sunDirection)), 0.0);
        sky += sunColor * pow(sunDot, 256.0) * sunIntensity * 2.4;
        sky += sunColor * pow(sunDot, 16.0) * 0.35 * sunIntensity;
        sky = mix(sky, vec3(0.7, 0.78, 0.9), pow(1.0 - abs(d.y), 4.0) * 0.25);
        return sky * envMapIntensity;
      }

      float waveJacobian(vec2 uv) {
        float texel = 1.0 / max(fftResolution, 1.0);
        vec3 dxR = texture2D(displacementMap, uv + vec2(texel, 0.0)).rgb;
        vec3 dxL = texture2D(displacementMap, uv - vec2(texel, 0.0)).rgb;
        vec3 dzU = texture2D(displacementMap, uv + vec2(0.0, texel)).rgb;
        vec3 dzD = texture2D(displacementMap, uv - vec2(0.0, texel)).rgb;
        float dDx_dx = (dxR.x - dxL.x) * 0.5 * choppiness;
        float dDz_dz = (dzU.z - dzD.z) * 0.5 * choppiness;
        float dDx_dz = (dzU.x - dzD.x) * 0.5 * choppiness;
        float dDz_dx = (dxR.z - dxL.z) * 0.5 * choppiness;
        return (1.0 + dDx_dx) * (1.0 + dDz_dz) - dDx_dz * dDz_dx;
      }

      float fresnelSchlick(float cosTheta, float F0) {
        return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
      }

      float fresnelWater(vec3 viewDir, vec3 normal) {
        float F0 = pow((IOR_AIR - IOR_WATER) / (IOR_AIR + IOR_WATER), 2.0);
        float cosTheta = max(dot(viewDir, normal), 0.0);
        return fresnelSchlick(cosTheta, F0);
      }

      float distributionGGX(vec3 N, vec3 H, float roughness) {
        float a = roughness * roughness;
        float a2 = a * a;
        float NdotH = max(dot(N, H), 0.0);
        float NdotH2 = NdotH * NdotH;
        float nom = a2;
        float denom = (NdotH2 * (a2 - 1.0) + 1.0);
        denom = 3.14159265 * denom * denom;
        return nom / max(denom, 0.0001);
      }

      float geometrySchlickGGX(float NdotV, float roughness) {
        float r = (roughness + 1.0);
        float k = (r * r) / 8.0;
        return NdotV / (NdotV * (1.0 - k) + k);
      }

      float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
        float NdotV = max(dot(N, V), 0.0);
        float NdotL = max(dot(N, L), 0.0);
        return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
      }

      vec3 subsurfaceScattering(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 color) {
        float forwardScatter = pow(max(0.0, dot(viewDir, -lightDir)), 6.0);
        float backScatter = pow(max(0.0, dot(normal, lightDir)), 3.0) * 0.3;
        vec3 scatterColor = color * vec3(0.6, 0.85, 1.0);
        return scatterColor * (forwardScatter * 0.6 + backScatter);
      }

      vec3 applyAbsorption(vec3 color, float depth) {
        depth = max(depth, 0.0);
        return color * exp(-ABSORPTION_COEFF * depth);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDirection);
        vec3 L = normalize(sunDirection);
        vec3 H = normalize(V + L);

        if (!gl_FrontFacing) {
          vec3 Nb = -N;
          float cosViewAngle = max(dot(V, Nb), 0.0);
          float criticalCos = 0.6614;
          float ripple = sin(vWorldPosition.x * 3.0 + time * 1.5) * 0.028
                       + sin(vWorldPosition.z * 4.0 + time * 1.2) * 0.02
                       + vHeight * 0.012;
          float windowEdge = smoothstep(criticalCos - 0.055 + ripple, criticalCos + 0.07 + ripple, cosViewAngle);

          vec3 refractedDir = refract(-V, Nb, IOR_WATER / IOR_AIR);
          if (dot(refractedDir, refractedDir) < 0.001) refractedDir = mix(Nb, V, 0.3);
          vec3 skyThroughWater = sampleSky(refractedDir) * (0.75 + 0.45 * cosViewAngle);
          float sunDot = max(dot(normalize(V), normalize(L)), 0.0);
          skyThroughWater += sunColor * pow(sunDot, 48.0) * sunIntensity * 4.0;
          skyThroughWater += sunColor * pow(sunDot, 8.0) * 0.75;

          vec3 tirColor = vec3(0.03, 0.10, 0.16);
          vec3 tirReflect = reflect(-V, Nb);
          float tirReflection = pow(max(dot(tirReflect, L), 0.0), 10.0);
          tirColor += sampleSky(tirReflect) * 0.12;
          tirColor += vec3(0.06, 0.14, 0.18) * tirReflection;
          float tirCaus = sin(vWorldPosition.x * 2.4 + time * 0.9) * sin(vWorldPosition.z * 2.1 - time * 0.7);
          tirColor += vec3(0.04, 0.09, 0.08) * smoothstep(0.2, 0.85, tirCaus * 0.5 + 0.5);

          vec3 belowColor = mix(tirColor, skyThroughWater, windowEdge);
          float edgeRing = 1.0 - smoothstep(0.0, 0.045, abs(cosViewAngle - criticalCos - ripple));
          belowColor += vec3(0.35, 0.55, 0.7) * edgeRing * 0.55;
          float rimFresnel = pow(1.0 - cosViewAngle, 2.5) * 0.35;
          belowColor += vec3(0.12, 0.22, 0.32) * rimFresnel;

          float dist = length(vWorldPosition - cameraPosition);
          float fogF = exp(-dist * 0.0018);
          vec3 underwaterFog = vec3(0.035, 0.09, 0.16);
          belowColor = mix(underwaterFog, belowColor, fogF);

          gl_FragColor = vec4(belowColor, 0.96);
          return;
        }

        float waveRoughness = 0.02 + abs(vHeight) * 0.05;
        waveRoughness = clamp(waveRoughness, 0.01, 0.3);

        float fresnel = fresnelWater(V, N);
        float NDF = distributionGGX(N, H, waveRoughness);
        float G = geometrySmith(N, V, L, waveRoughness);

        vec3 nominator = vec3(NDF * G * fresnel);
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
        vec3 specular = nominator / max(denominator, 0.001);

        float NdotL = max(dot(N, L), 0.0);
        float depth = abs(vHeight) + 2.0;
        vec3 baseColor = mix(shallowColor, deepColor, smoothstep(0.0, 8.0, depth));
        vec3 absorbedColor = applyAbsorption(baseColor, depth);

        float ao = smoothstep(-1.5, 0.5, vHeight);
        vec3 diffuse = absorbedColor * waterColor * (0.15 + 0.85 * NdotL) * (0.7 + 0.3 * ao);

        float crestFactor = smoothstep(0.0, 1.5, vHeight);
        vec3 sss = subsurfaceScattering(L, V, N, shallowColor) * (0.35 + crestFactor * 0.4);
        vec3 specColor = sunColor * specular * sunIntensity * 1.2;

        float J = waveJacobian(vUv);
        float foamFromFold = 1.0 - smoothstep(0.0, 0.45, J);
        float foamFromHeight = smoothstep(0.85, 1.9, vHeight);
        float steepness = 1.0 - clamp(N.y, 0.0, 1.0);
        float foamNoise = fract(sin(dot(vWorldPosition.xz * 4.2, vec2(12.9898, 78.233))) * 43758.5453);
        float foamDetail = fract(sin(dot(vWorldPosition.xz * 18.0 + time * 0.4, vec2(39.7, 71.3))) * 23421.6);
        float foamAmount = max(max(foamFromFold * 0.85, foamFromHeight * 0.7), vFoam);
        foamAmount = foamAmount * (0.55 + 0.45 * foamNoise) * (0.7 + 0.3 * steepness);
        foamAmount *= mix(0.85, 1.15, foamDetail);
        foamAmount = clamp(foamAmount, 0.0, 1.0);
        vec3 foamColor = vec3(0.88, 0.94, 0.97) * foamAmount * 0.75;

        vec3 R = reflect(-V, N);
        vec3 skyReflection = sampleSky(R);
        vec3 reflection = skyReflection * fresnel;

        vec3 finalColor = diffuse + specColor + sss + reflection * 0.72 + foamColor;

        float distance = length(vWorldPosition - cameraPosition);
        float fogFactor = exp(-distance * 0.0012);
        vec3 fogColor = mix(vec3(0.08, 0.22, 0.38), vec3(0.4, 0.6, 0.8), 0.3);
        finalColor = mix(fogColor, finalColor, fogFactor);

        float alpha = mix(0.85, 0.99, fresnel);
        alpha = mix(alpha, 0.96, smoothstep(0.0, 5.0, depth));
        alpha = mix(alpha, 1.0, foamAmount * 0.5);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;
    this.multiScaleWaves.update(deltaTime);

    const offsets = this.tilingPrevention.getAnimatedOffsets(this.time);
    this.material.uniforms.tilingOffset1.value.copy(offsets.offset1);
    this.material.uniforms.tilingOffset2.value.copy(offsets.offset2);

    // ~28 Hz cascade update — enough for fluid motion, cheap enough for dual IFFT
    if (Math.floor(this.time * 28) !== Math.floor((this.time - deltaTime) * 28)) {
      this.large.update(this.time);
      this.detail.update(this.time);
    }

    this.material.uniforms.time.value = this.time;
  }

  public setChoppiness(choppiness: number): void {
    this.choppiness = choppiness;
    this.material.uniforms.choppiness.value = choppiness;
    this.large.setChoppiness(choppiness);
    this.detail.setChoppiness(choppiness * 1.15);
  }

  public updateSunDirection(direction: THREE.Vector3): void {
    this.material.uniforms.sunDirection.value.copy(direction).normalize();
  }

  /** Height field for caustics / foam — RG texture (R=height, G=foam). */
  public getHeightTexture(): THREE.DataTexture {
    return this.large.getHeightTexture();
  }

  public getDisplacementTexture(): THREE.DataTexture {
    return this.large.getDisplacementTexture();
  }

  public getOceanSize(): number {
    return this.size;
  }

  public setEnvMapIntensity(intensity: number): void {
    this.material.uniforms.envMapIntensity.value = intensity;
  }

  public sampleHeight(worldX: number, worldZ: number): number {
    return this.large.sampleHeight(worldX, worldZ) + this.detail.sampleHeight(worldX, worldZ);
  }

  public setWind(speed: number, direction: THREE.Vector2): void {
    this.windDirection.copy(direction).normalize();
    this.large.setWind(speed, this.windDirection);
    this.detail.setWind(
      speed * 0.85,
      new THREE.Vector2(this.windDirection.x + 0.35, this.windDirection.y - 0.2).normalize()
    );
    this.large.update(this.time);
    this.detail.update(this.time);
  }

  public setWindSpeed(speed: number): void {
    this.setWind(speed, this.windDirection);
  }

  public setSize(newSize: number): void {
    this.size = newSize;
    this.material.uniforms.oceanSize.value = newSize;
    this.material.uniforms.detailOceanSize.value = newSize / 9;
  }

  public setResolution(newResolution: number): void {
    // Rebuild cascades at new resolution (rare — GUI/debug path)
    this.resolution = newResolution;
    this.meshSegments = Math.min(384, Math.max(192, newResolution));
    this.material.uniforms.fftResolution.value = newResolution;

    const windSpeed = 28;
    const amp = 2.5;
    this.large.dispose();
    this.detail.dispose();

    this.large = new OceanCascade(
      newResolution,
      this.size,
      windSpeed,
      this.windDirection,
      amp,
      this.choppiness,
      0.0008
    );
    const detailRes = Math.max(64, newResolution >> 1);
    this.detail = new OceanCascade(
      detailRes,
      this.size / 9,
      windSpeed * 0.85,
      new THREE.Vector2(this.windDirection.x + 0.35, this.windDirection.y - 0.2).normalize(),
      amp * 0.22,
      this.choppiness * 1.15,
      0.00005
    );

    this.geometry.dispose();
    this.geometry = new THREE.PlaneGeometry(this.size, this.size, this.meshSegments, this.meshSegments);
    this.geometry.rotateX(-Math.PI / 2);
    this.mesh.geometry = this.geometry;

    this.material.uniforms.heightMap.value = this.large.getHeightTexture();
    this.material.uniforms.normalMap.value = this.large.getNormalTexture();
    this.material.uniforms.displacementMap.value = this.large.getDisplacementTexture();
    this.material.uniforms.heightMapDetail.value = this.detail.getHeightTexture();
    this.material.uniforms.normalMapDetail.value = this.detail.getNormalTexture();
    this.material.uniforms.displacementMapDetail.value = this.detail.getDisplacementTexture();
    this.material.uniforms.detailOceanSize.value = this.detail.size;

    this.tilingPrevention.setResolution(newResolution);
    this.large.update(this.time);
    this.detail.update(this.time);
  }

  public setAmplitude(amplitude: number): void {
    this.large.setWaveAmplitude(amplitude);
    this.detail.setWaveAmplitude(amplitude * 0.22);
    this.large.update(this.time);
    this.detail.update(this.time);
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.large.dispose();
    this.detail.dispose();
  }
}

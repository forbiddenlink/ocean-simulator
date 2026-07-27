import * as THREE from 'three';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private moveSpeed: number = 5.0;
  private rotateSpeed: number = 0.002;

  private keys: Set<string> = new Set();
  private mouseDown: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  private pitch: number = 0; // Rotation around X axis
  private yaw: number = 0;   // Rotation around Y axis

  // Camera sway for underwater immersion
  private swayTime: number = 0;
  private swayAmplitude: number = 0.002; // Very subtle sway
  private swaySpeed: number = 0.0008; // Slow sway speed

  // Pre-allocated temp vectors to avoid GC pressure in update()
  private _forward: THREE.Vector3 = new THREE.Vector3();
  private _right: THREE.Vector3 = new THREE.Vector3();
  private _up: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  private _velocity: THREE.Vector3 = new THREE.Vector3();
  private _target: THREE.Vector3 = new THREE.Vector3();
  private _worldUp: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  // Cinematic path playback (intro reveal + hero-video flythrough)
  private cinematicActive = false;
  private cinematicElapsed = 0;
  private cinematicDuration = 0;
  private cinematicLoop = false;
  private cinematicPosCurve?: THREE.CatmullRomCurve3;
  private cinematicLookCurve?: THREE.CatmullRomCurve3;
  private _look: THREE.Vector3 = new THREE.Vector3();

  // Bound event handlers for proper cleanup
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnMouseDown: (e: MouseEvent) => void;
  private boundOnMouseUp: () => void;
  private boundOnMouseMove: (e: MouseEvent) => void;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;

    // Initialize angles from camera
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    this.yaw = Math.atan2(direction.x, direction.z);
    this.pitch = Math.asin(-direction.y);

    // Create bound handlers
    this.boundOnKeyDown = (e: KeyboardEvent) => {
      // Any movement input hands control back to the user mid-flythrough.
      if (this.cinematicActive && 'wasdqe'.includes(e.key.toLowerCase())) this.stopCinematic();
      this.keys.add(e.key.toLowerCase());
    };
    this.boundOnKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    this.boundOnMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        if (this.cinematicActive) this.stopCinematic();
        this.mouseDown = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    };
    this.boundOnMouseUp = () => { this.mouseDown = false; };
    this.boundOnMouseMove = (e: MouseEvent) => {
      if (this.mouseDown) {
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;
        this.yaw += deltaX * this.rotateSpeed;
        this.pitch -= deltaY * this.rotateSpeed;
        this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', this.boundOnKeyDown);
    window.addEventListener('keyup', this.boundOnKeyUp);
    window.addEventListener('mousedown', this.boundOnMouseDown);
    window.addEventListener('mouseup', this.boundOnMouseUp);
    window.addEventListener('mousemove', this.boundOnMouseMove);
  }

  /**
   * Play a scripted camera flythrough. Keyframes are {pos, look} world-space triples.
   * Uses Catmull-Rom curves for buttery motion; input is ignored while playing.
   */
  public playCinematic(
    keyframes: Array<{ pos: [number, number, number]; look: [number, number, number] }>,
    duration: number,
    loop = false
  ): void {
    if (keyframes.length < 2) return;
    this.cinematicPosCurve = new THREE.CatmullRomCurve3(
      keyframes.map((k) => new THREE.Vector3(...k.pos)),
      loop,
      'catmullrom',
      0.5
    );
    this.cinematicLookCurve = new THREE.CatmullRomCurve3(
      keyframes.map((k) => new THREE.Vector3(...k.look)),
      loop,
      'catmullrom',
      0.5
    );
    this.cinematicDuration = duration;
    this.cinematicElapsed = 0;
    this.cinematicLoop = loop;
    this.cinematicActive = true;
  }

  public stopCinematic(): void {
    this.cinematicActive = false;
    // Re-derive yaw/pitch from current orientation so manual control resumes cleanly.
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.yaw = Math.atan2(dir.x, dir.z);
    this.pitch = Math.asin(-Math.max(-1, Math.min(1, -dir.y)));
  }

  public isCinematic(): boolean {
    return this.cinematicActive;
  }

  public update(deltaTime: number): void {
    if (this.cinematicActive && this.cinematicPosCurve && this.cinematicLookCurve) {
      this.cinematicElapsed += deltaTime;
      let t = this.cinematicElapsed / this.cinematicDuration;
      if (t >= 1) {
        if (this.cinematicLoop) {
          this.cinematicElapsed %= this.cinematicDuration;
          t = this.cinematicElapsed / this.cinematicDuration;
        } else {
          t = 1;
          this.cinematicActive = false;
        }
      }
      // Gentle ease-in-out across the whole path so start/stop are soft.
      const eased = t * t * (3 - 2 * t);
      this.cinematicPosCurve.getPoint(this.cinematicLoop ? t : eased, this.camera.position);
      this.cinematicLookCurve.getPoint(this.cinematicLoop ? t : eased, this._look);
      this.camera.lookAt(this._look);
      return;
    }

    // Update sway time
    this.swayTime += deltaTime * this.swaySpeed;

    // Calculate sway offsets for subtle underwater movement
    const swayX = Math.sin(this.swayTime * 1.3) * this.swayAmplitude;
    const swayY = Math.cos(this.swayTime * 0.9) * this.swayAmplitude;

    // Calculate forward, right, and up vectors (reusing pre-allocated vectors)
    this._forward.set(
      Math.sin(this.yaw + swayY) * Math.cos(this.pitch + swayX),
      -Math.sin(this.pitch + swayX),
      Math.cos(this.yaw + swayY) * Math.cos(this.pitch + swayX)
    );

    this._right.crossVectors(this._forward, this._worldUp).normalize();

    this._up.set(0, 1, 0);

    // Movement (reusing pre-allocated velocity vector)
    this._velocity.set(0, 0, 0);

    if (this.keys.has('w')) this._velocity.add(this._forward);
    if (this.keys.has('s')) this._velocity.sub(this._forward);
    if (this.keys.has('d')) this._velocity.add(this._right);
    if (this.keys.has('a')) this._velocity.sub(this._right);
    if (this.keys.has('e')) this._velocity.add(this._up);
    if (this.keys.has('q')) this._velocity.sub(this._up);


    if (this._velocity.length() > 0) {
      this._velocity.normalize().multiplyScalar(this.moveSpeed * deltaTime);
      this.camera.position.add(this._velocity);

      // Clamp camera to world bounds (Playable area is roughly +/- 50)
      const bound = 60.0;
      this.camera.position.x = Math.max(-bound, Math.min(bound, this.camera.position.x));
      this.camera.position.z = Math.max(-bound, Math.min(bound, this.camera.position.z));

      // Vertical bounds (Surface to Floor)
      // Surface at 0, Floor at -30
      this.camera.position.y = Math.max(-28.0, Math.min(2.0, this.camera.position.y));
    }

    // Update camera rotation (reusing pre-allocated target vector)
    this._target.copy(this.camera.position).add(this._forward);
    this.camera.lookAt(this._target);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.boundOnKeyDown);
    window.removeEventListener('keyup', this.boundOnKeyUp);
    window.removeEventListener('mousedown', this.boundOnMouseDown);
    window.removeEventListener('mouseup', this.boundOnMouseUp);
    window.removeEventListener('mousemove', this.boundOnMouseMove);
  }
}

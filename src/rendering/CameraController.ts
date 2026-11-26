import * as THREE from 'three';
import { seabedY } from './RealisticOceanFloor';

/** Half-width of the area the camera can swim in. */
const SWIM_BOUND = 60.0;
/** Camera clearance above the seabed. */
const SEABED_CLEARANCE = 2.0;
/** Highest the camera can rise, just above the surface at y = 0. */
const SURFACE_LIMIT = 2.0;

/**
 * Keeps a camera position inside the swim area and above the seabed. The floor has rock
 * pinnacles and basin walls that rise far above the -30 m datum, so a fixed depth limit
 * would let the camera pass into the rock.
 */
export function clampToSwimVolume(position: THREE.Vector3): void {
  position.x = Math.max(-SWIM_BOUND, Math.min(SWIM_BOUND, position.x));
  position.z = Math.max(-SWIM_BOUND, Math.min(SWIM_BOUND, position.z));
  const floor = seabedY(position.x, position.z) + SEABED_CLEARANCE;
  position.y = Math.max(floor, Math.min(SURFACE_LIMIT, position.y));
}

/** Finger travel, in CSS pixels, that gives full swim speed on a two-finger drag. */
const TOUCH_SWIM_RADIUS = 80;
/** Finger travel ignored around the start point so a resting hand does not drift. */
const TOUCH_DEADZONE = 0.15;

/**
 * Converts how far a two-finger drag has moved from where it started into a swim axis.
 * Dragging up swims forward, down swims back, sideways strafes. Each axis is in [-1, 1].
 */
export function touchSwimAxis(dx: number, dy: number): { forward: number; strafe: number } {
  const axis = (v: number): number => {
    const n = Math.max(-1, Math.min(1, v / TOUCH_SWIM_RADIUS));
    return Math.abs(n) < TOUCH_DEADZONE ? 0 : n;
  };
  return { forward: axis(-dy), strafe: axis(dx) };
}

/** Touches that start on a HUD panel or the debug GUI belong to the UI, not the camera. */
function isUiTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('#ocean-ui .op, .lil-gui') !== null;
}

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

  // Touch: one finger looks, two fingers swim.
  private touchLookId: number | null = null;
  private touchSwimStart: { x: number; y: number } | null = null;
  private touchSwim = { forward: 0, strafe: 0 };

  // Bound event handlers for proper cleanup
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnMouseDown: (e: MouseEvent) => void;
  private boundOnMouseUp: () => void;
  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnTouchStart: (e: TouchEvent) => void;
  private boundOnTouchMove: (e: TouchEvent) => void;
  private boundOnTouchEnd: (e: TouchEvent) => void;

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

    this.boundOnTouchStart = (e: TouchEvent) => this.onTouchStart(e);
    this.boundOnTouchMove = (e: TouchEvent) => this.onTouchMove(e);
    this.boundOnTouchEnd = (e: TouchEvent) => this.onTouchEnd(e);

    this.setupEventListeners();
  }

  private centroid(touches: TouchList): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (let i = 0; i < touches.length; i++) {
      x += touches[i].clientX;
      y += touches[i].clientY;
    }
    return { x: x / touches.length, y: y / touches.length };
  }

  private onTouchStart(e: TouchEvent): void {
    if (isUiTarget(e.target)) return;
    if (this.cinematicActive) this.stopCinematic();
    if (e.touches.length >= 2) {
      this.touchLookId = null;
      this.touchSwimStart = this.centroid(e.touches);
      this.touchSwim = { forward: 0, strafe: 0 };
    } else {
      const t = e.touches[0];
      this.touchLookId = t.identifier;
      this.lastMouseX = t.clientX;
      this.lastMouseY = t.clientY;
    }
    e.preventDefault();
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.touchSwimStart && e.touches.length >= 2) {
      const c = this.centroid(e.touches);
      this.touchSwim = touchSwimAxis(c.x - this.touchSwimStart.x, c.y - this.touchSwimStart.y);
      e.preventDefault();
      return;
    }
    if (this.touchLookId === null) return;
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      if (t.identifier !== this.touchLookId) continue;
      this.yaw -= (t.clientX - this.lastMouseX) * this.rotateSpeed * 1.5;
      this.pitch += (t.clientY - this.lastMouseY) * this.rotateSpeed * 1.5;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
      this.lastMouseX = t.clientX;
      this.lastMouseY = t.clientY;
      e.preventDefault();
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (e.touches.length < 2) {
      this.touchSwimStart = null;
      this.touchSwim = { forward: 0, strafe: 0 };
    }
    if (e.touches.length === 0) this.touchLookId = null;
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', this.boundOnKeyDown);
    window.addEventListener('keyup', this.boundOnKeyUp);
    window.addEventListener('mousedown', this.boundOnMouseDown);
    window.addEventListener('mouseup', this.boundOnMouseUp);
    window.addEventListener('mousemove', this.boundOnMouseMove);
    // passive: false so preventDefault stops the page from scrolling or zooming.
    window.addEventListener('touchstart', this.boundOnTouchStart, { passive: false });
    window.addEventListener('touchmove', this.boundOnTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundOnTouchEnd);
    window.addEventListener('touchcancel', this.boundOnTouchEnd);
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
    if (this.touchSwim.forward) this._velocity.addScaledVector(this._forward, this.touchSwim.forward);
    if (this.touchSwim.strafe) this._velocity.addScaledVector(this._right, this.touchSwim.strafe);

    if (this._velocity.length() > 0) {
      // Keys give full speed; a partial two-finger drag gives partial speed.
      const throttle = Math.min(1, this._velocity.length());
      this._velocity.normalize().multiplyScalar(this.moveSpeed * deltaTime * throttle);
      this.camera.position.add(this._velocity);

      clampToSwimVolume(this.camera.position);
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
    window.removeEventListener('touchstart', this.boundOnTouchStart);
    window.removeEventListener('touchmove', this.boundOnTouchMove);
    window.removeEventListener('touchend', this.boundOnTouchEnd);
    window.removeEventListener('touchcancel', this.boundOnTouchEnd);
  }
}

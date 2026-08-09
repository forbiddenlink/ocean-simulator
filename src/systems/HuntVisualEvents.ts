import * as THREE from 'three';

export type HuntVisualKind = 'kill' | 'attack' | 'panic';

export interface HuntVisualEvent {
  kind: HuntVisualKind;
  x: number;
  y: number;
  z: number;
  intensity: number;
}

/** Frame-local queue: hunting system pushes, render drains each update. */
const queue: HuntVisualEvent[] = [];

export const HuntVisualEvents = {
  push(event: HuntVisualEvent): void {
    if (queue.length < 48) queue.push(event);
  },

  drain(): HuntVisualEvent[] {
    if (queue.length === 0) return queue;
    return queue.splice(0, queue.length);
  },

  colorFor(kind: HuntVisualKind): THREE.Color {
    switch (kind) {
      case 'kill':
        return new THREE.Color(0.55, 1.0, 0.95);
      case 'attack':
        return new THREE.Color(1.0, 0.55, 0.35);
      case 'panic':
        return new THREE.Color(0.45, 0.85, 1.0);
    }
  },
};

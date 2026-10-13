import './style.css';
import posthog from 'posthog-js';
import { OceanSimulator } from './OceanSimulator';
import { CreatureModelLoader, CREATURE_MODEL_PATHS } from './creatures/CreatureModelLoader';

// Initialize PostHog
if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY as string, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string) || 'https://us.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
  });
}

// Create canvas element
const canvas = document.createElement('canvas');
canvas.id = 'ocean-canvas';
const mainContent = document.getElementById('main-content');
if (mainContent) {
  mainContent.appendChild(canvas);
} else {
  document.body.appendChild(canvas);
}

// Initialize simulator
try {
  const simulator = new OceanSimulator(canvas);
  (window as unknown as { __sim: OceanSimulator }).__sim = simulator;
  simulator.start();

  // Optional GLTF creature models (inert unless CREATURE_MODEL_PATHS is populated + the
  // .glb files exist under public/models/). Best-effort: any success upgrades the matching
  // large creatures; failures leave everything procedural. Never blocks startup.
  CreatureModelLoader.preload(CREATURE_MODEL_PATHS)
    .then((models) => {
      if (models.size > 0) simulator.setCreatureModels(models);
    })
    .catch(() => {
      /* fully procedural fallback */
    });

  // Fade the loading/title card once the scene has painted a couple of frames.
  const dismissLoader = () => {
    const loader = document.getElementById('loading-screen');
    if (!loader) return;
    loader.classList.add('loaded');
    loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    // Safety net in case the transition event never fires.
    setTimeout(() => loader.remove(), 2000);
  };
  requestAnimationFrame(() =>
    requestAnimationFrame(() => setTimeout(dismissLoader, 600))
  );

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    simulator.dispose();
  });
} catch (error) {
  console.error('Error initializing simulator:', error);
  // Never trap the user behind the loading card on failure, and never leave a blank canvas.
  document.getElementById('loading-screen')?.remove();
  canvas.remove();
  const message = document.createElement('div');
  message.className = 'init-error';
  message.setAttribute('role', 'alert');
  message.textContent =
    'This simulation needs WebGL 2. Try a recent Chrome, Edge, Firefox or Safari.';
  (mainContent ?? document.body).appendChild(message);
}

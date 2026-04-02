import './style.css';
import posthog from 'posthog-js';
import { OceanSimulator } from './OceanSimulator';

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
  simulator.start();

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    simulator.dispose();
  });
} catch (error) {
  console.error('Error initializing simulator:', error);
}

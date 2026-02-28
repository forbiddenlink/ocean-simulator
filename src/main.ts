import './style.css';
import { OceanSimulator } from './OceanSimulator';

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

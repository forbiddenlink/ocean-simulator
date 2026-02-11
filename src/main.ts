import './style.css';
import { OceanSimulator } from './OceanSimulator';

console.log('🌊 Main.ts loaded');

// Create canvas element
const canvas = document.createElement('canvas');
canvas.id = 'ocean-canvas';
document.body.appendChild(canvas);

console.log('✅ Canvas created and appended');

// Old info overlay removed - now using UIManager for UI
// The UIManager handles all UI panels and controls

console.log('✅ Ready for simulator initialization');

// Initialize simulator
try {
  console.log('🔧 Creating OceanSimulator...');
  const simulator = new OceanSimulator(canvas);
  console.log('✅ Simulator created');
  
  simulator.start();
  console.log('✅ Simulator started');
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    simulator.dispose();
  });
} catch (error) {
  console.error('❌ Error initializing simulator:', error);
}


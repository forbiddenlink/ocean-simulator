import type { OceanWorld } from '../core/World';
import { getPopulationStats } from '../systems/PopulationSystem';

/**
 * UI Manager for ocean simulator
 * Provides interactive controls and information display
 */
export class UIManager {
  private container: HTMLElement;
  private statsPanel: HTMLElement;
  private controlsPanel: HTMLElement;
  private infoPanel: HTMLElement;
  private oceanPanel: HTMLElement;
  private isVisible: boolean = true;
  
  // Callbacks for ocean controls
  private onWindSpeedChange?: (speed: number) => void;
  private onWaveAmplitudeChange?: (amplitude: number) => void;
  private onTimeOfDayChange?: (time: number) => void;
  private onWeatherChange?: (weather: string) => void;
  private onQualityChange?: (quality: string) => void;
  
  constructor(parentElement: HTMLElement = document.body) {
    this.container = this.createContainer();
    parentElement.appendChild(this.container);
    
    this.statsPanel = this.createStatsPanel();
    this.controlsPanel = this.createControlsPanel();
    this.infoPanel = this.createInfoPanel();
    this.oceanPanel = this.createOceanPanel();
    
    this.container.appendChild(this.statsPanel);
    this.container.appendChild(this.controlsPanel);
    this.container.appendChild(this.infoPanel);
    this.container.appendChild(this.oceanPanel);
    
    this.setupEventListeners();
  }
  
  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'ocean-ui';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: white;
      z-index: 1000;
    `;
    return container;
  }
  
  private createStatsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'stats-panel';
    panel.className = 'ocean-panel';
    panel.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0, 20, 40, 0.92);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(100, 200, 255, 0.4);
      border-radius: 10px;
      padding: 12px;
      width: 200px;
      max-width: 200px;
      pointer-events: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    `;
    
    panel.innerHTML = `
      <h2 style="margin: 0 0 10px 0; font-size: 15px; color: #4dd0e1; border-bottom: 2px solid rgba(77, 208, 225, 0.3); padding-bottom: 6px;">
        🌊 Ecosystem
      </h2>
      <div id="stats-content" style="font-size: 12px; line-height: 1.6;">
        <div style="margin-bottom: 8px;">
          <strong style="color: #80deea;">Total:</strong> <span id="stat-total">0</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; font-size: 11px;">
          <div>🐟 <span id="stat-fish">0</span></div>
          <div>🦈 <span id="stat-shark">0</span></div>
          <div>🐬 <span id="stat-dolphin">0</span></div>
          <div>🪼 <span id="stat-jellyfish">0</span></div>
          <div>🐡 <span id="stat-ray">0</span></div>
        </div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(100, 200, 255, 0.2); font-size: 11px;">
          <div style="color: #ff8a65;">⚔️ <span id="stat-predators">0</span></div>
          <div style="color: #81c784;">🌿 <span id="stat-prey">0</span></div>
        </div>
      </div>
    `;
    
    return panel;
  }
  
  private createControlsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'controls-panel';
    panel.className = 'ocean-panel';
    panel.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: rgba(0, 20, 40, 0.92);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(100, 200, 255, 0.4);
      border-radius: 10px;
      padding: 12px;
      width: 200px;
      max-width: 200px;
      pointer-events: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    `;
    
    panel.innerHTML = `
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #4dd0e1;">⚙️ Controls</h3>
      <div style="font-size: 11px; line-height: 1.8;">
        <div><kbd style="background: rgba(255,255,255,0.15); padding: 1px 4px; border-radius: 3px; font-size: 10px;">WASD</kbd> Move</div>
        <div><kbd style="background: rgba(255,255,255,0.15); padding: 1px 4px; border-radius: 3px; font-size: 10px;">Q/E</kbd> Up/Down</div>
        <div><kbd style="background: rgba(255,255,255,0.15); padding: 1px 4px; border-radius: 3px; font-size: 10px;">Mouse</kbd> Look</div>
        <div><kbd style="background: rgba(255,255,255,0.15); padding: 1px 4px; border-radius: 3px; font-size: 10px;">H</kbd> Toggle UI</div>
      </div>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(100, 200, 255, 0.2); display: flex; flex-direction: column; gap: 6px;">
        <button id="btn-pause" class="ocean-button" style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          width: 100%;
        ">⏸️ Pause</button>
        <button id="btn-speed" class="ocean-button" style="
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          width: 100%;
        ">⚡ Speed: 1x</button>
      </div>
    `;
    
    return panel;
  }
  
  private createInfoPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'info-panel';
    panel.className = 'ocean-panel';
    panel.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0, 20, 40, 0.92);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(100, 200, 255, 0.4);
      border-radius: 10px;
      padding: 12px;
      width: 240px;
      max-width: 240px;
      pointer-events: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      animation-delay: 0.1s;
    `;
    
    panel.innerHTML = `
      <h2 style="margin: 0 0 10px 0; font-size: 15px; color: #4dd0e1;">🔬 About</h2>
      <div style="font-size: 11px; line-height: 1.5; color: #b0bec5;">
        <p style="margin: 0 0 8px 0;">
          <strong style="color: #80deea;">Photorealistic Ocean</strong>
        </p>
        <p style="margin: 0 0 6px 0;">
          🌊 FFT Wave Simulation<br/>
          ✨ PBR Shader<br/>
          🎨 Multi-Scale Detail<br/>
          💨 Dynamic Foam & Spray<br/>
          🌅 HDRI Environment
        </p>
        <p style="margin: 8px 0 0 0; padding-top: 8px; border-top: 1px solid rgba(100, 200, 255, 0.2); color: #4dd0e1; font-size: 10px;">
          Cinema-quality rendering with living ecosystem
        </p>
      </div>
    `;
    
    return panel;
  }
  
  private createOceanPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'ocean-panel';
    panel.className = 'ocean-panel';
    panel.style.cssText = `
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 20, 40, 0.92);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(100, 200, 255, 0.4);
      border-radius: 10px;
      padding: 12px;
      width: 280px;
      max-width: 280px;
      pointer-events: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      max-height: 500px;
      overflow-y: auto;
      animation-delay: 0.15s;
    `;
    
    panel.innerHTML = `
      <h2 style="margin: 0 0 10px 0; font-size: 15px; color: #4dd0e1; border-bottom: 2px solid rgba(77, 208, 225, 0.3); padding-bottom: 6px;">
        🌊 Ocean Settings
      </h2>
      
      <!-- Quality Presets -->
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 11px; color: #80deea; margin-bottom: 4px; font-weight: bold;">
          Quality Preset
        </label>
        <select id="ocean-quality" style="
          width: 100%;
          padding: 6px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(100, 200, 255, 0.3);
          border-radius: 5px;
          color: white;
          font-size: 11px;
          cursor: pointer;
        ">
          <option value="low">Low (Performance)</option>
          <option value="medium" selected>Medium (Balanced)</option>
          <option value="high">High (Quality)</option>
          <option value="ultra">Ultra (Photorealistic)</option>
        </select>
      </div>
      
      <!-- Weather -->
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 11px; color: #80deea; margin-bottom: 4px; font-weight: bold;">
          Weather
        </label>
        <select id="ocean-weather" style="
          width: 100%;
          padding: 6px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(100, 200, 255, 0.3);
          border-radius: 5px;
          color: white;
          font-size: 11px;
          cursor: pointer;
        ">
          <option value="clear" selected>☀️ Clear</option>
          <option value="cloudy">☁️ Cloudy</option>
          <option value="stormy">⛈️ Stormy</option>
          <option value="sunset">🌅 Sunset</option>
        </select>
      </div>
      
      <!-- Time of Day -->
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 11px; color: #80deea; margin-bottom: 4px; font-weight: bold;">
          Time of Day: <span id="ocean-time-value">12:00</span>
        </label>
        <input type="range" id="ocean-time" min="0" max="1" step="0.01" value="0.5" style="
          width: 100%;
          cursor: pointer;
        "/>
      </div>
      
      <!-- Wind Speed -->
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 11px; color: #80deea; margin-bottom: 4px; font-weight: bold;">
          Wind Speed: <span id="ocean-wind-value">25</span> m/s
        </label>
        <input type="range" id="ocean-wind" min="10" max="40" step="1" value="25" style="
          width: 100%;
          cursor: pointer;
        "/>
      </div>
      
      <!-- Wave Amplitude -->
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 11px; color: #80deea; margin-bottom: 4px; font-weight: bold;">
          Wave Height: <span id="ocean-amplitude-value">2.0</span>x
        </label>
        <input type="range" id="ocean-amplitude" min="0.5" max="4" step="0.1" value="2.0" style="
          width: 100%;
          cursor: pointer;
        "/>
      </div>
      
      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(100, 200, 255, 0.2); font-size: 10px; color: #b0bec5;">
        💡 Adjust settings in real-time
      </div>
    `;
    
    return panel;
  }
  
  private setupEventListeners(): void {
    // Toggle UI visibility
    document.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        this.toggleVisibility();
      }
    });
    
    // Button hovers now handled by CSS .ocean-button:hover
    // No need for JS event listeners
    
    // Ocean controls
    this.setupOceanControls();
  }
  
  private setupOceanControls(): void {
    // Quality preset
    const qualitySelect = document.getElementById('ocean-quality') as HTMLSelectElement;
    if (qualitySelect) {
      qualitySelect.addEventListener('change', () => {
        if (this.onQualityChange) {
          this.onQualityChange(qualitySelect.value);
        }
      });
    }
    
    // Weather
    const weatherSelect = document.getElementById('ocean-weather') as HTMLSelectElement;
    if (weatherSelect) {
      weatherSelect.addEventListener('change', () => {
        if (this.onWeatherChange) {
          this.onWeatherChange(weatherSelect.value);
        }
      });
    }
    
    // Time of day
    const timeSlider = document.getElementById('ocean-time') as HTMLInputElement;
    const timeValue = document.getElementById('ocean-time-value');
    if (timeSlider && timeValue) {
      timeSlider.addEventListener('input', () => {
        const time = parseFloat(timeSlider.value);
        const hours = Math.floor(time * 24);
        const minutes = Math.floor((time * 24 - hours) * 60);
        timeValue.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        if (this.onTimeOfDayChange) {
          this.onTimeOfDayChange(time);
        }
      });
    }
    
    // Wind speed
    const windSlider = document.getElementById('ocean-wind') as HTMLInputElement;
    const windValue = document.getElementById('ocean-wind-value');
    if (windSlider && windValue) {
      windSlider.addEventListener('input', () => {
        const speed = parseFloat(windSlider.value);
        windValue.textContent = speed.toString();
        
        if (this.onWindSpeedChange) {
          this.onWindSpeedChange(speed);
        }
      });
    }
    
    // Wave amplitude
    const amplitudeSlider = document.getElementById('ocean-amplitude') as HTMLInputElement;
    const amplitudeValue = document.getElementById('ocean-amplitude-value');
    if (amplitudeSlider && amplitudeValue) {
      amplitudeSlider.addEventListener('input', () => {
        const amplitude = parseFloat(amplitudeSlider.value);
        amplitudeValue.textContent = amplitude.toFixed(1);
        
        if (this.onWaveAmplitudeChange) {
          this.onWaveAmplitudeChange(amplitude);
        }
      });
    }
  }
  
  public toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    
    if (this.isVisible) {
      // Show panels with enter animation
      this.container.style.opacity = '1';
      this.container.style.pointerEvents = 'none';
      
      // Remove exiting class and re-enable pointer events
      [this.statsPanel, this.controlsPanel, this.infoPanel, this.oceanPanel].forEach(panel => {
        panel.classList.remove('exiting');
        panel.style.pointerEvents = 'auto';
      });
    } else {
      // Hide panels with exit animation (Jakub's subtle exit)
      [this.statsPanel, this.controlsPanel, this.infoPanel, this.oceanPanel].forEach(panel => {
        panel.classList.add('exiting');
      });
      
      // Wait for exit animation to complete before hiding
      setTimeout(() => {
        this.container.style.opacity = '0';
        this.container.style.pointerEvents = 'none';
      }, 300); // Match CSS exit animation duration
    }
  }
  
  /**
   * Register callback for wind speed changes
   */
  public onWindSpeed(callback: (speed: number) => void): void {
    this.onWindSpeedChange = callback;
  }
  
  /**
   * Register callback for wave amplitude changes
   */
  public onWaveAmplitude(callback: (amplitude: number) => void): void {
    this.onWaveAmplitudeChange = callback;
  }
  
  /**
   * Register callback for time of day changes
   */
  public onTimeOfDay(callback: (time: number) => void): void {
    this.onTimeOfDayChange = callback;
  }
  
  /**
   * Register callback for weather changes
   */
  public onWeather(callback: (weather: string) => void): void {
    this.onWeatherChange = callback;
  }
  
  /**
   * Register callback for quality preset changes
   */
  public onQuality(callback: (quality: string) => void): void {
    this.onQualityChange = callback;
  }
  
  /**
   * Update stats display
   */
  public updateStats(world: OceanWorld): void {
    const stats = getPopulationStats(world);
    
    const updateElement = (id: string, value: number) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value.toString();
    };
    
    updateElement('stat-total', stats.total);
    updateElement('stat-fish', stats.fish);
    updateElement('stat-shark', stats.shark);
    updateElement('stat-dolphin', stats.dolphin);
    updateElement('stat-jellyfish', stats.jellyfish);
    updateElement('stat-ray', stats.ray);
    updateElement('stat-predators', stats.predators);
    updateElement('stat-prey', stats.prey);
  }
  
  /**
   * Hook up pause button
   */
  public onPause(callback: () => void): void {
    const btn = document.getElementById('btn-pause');
    if (btn) {
      btn.addEventListener('click', callback);
    }
  }
  
  /**
   * Hook up speed button
   */
  public onSpeedChange(callback: (speed: number) => void): void {
    const btn = document.getElementById('btn-speed');
    if (btn) {
      let currentSpeed = 1;
      const speeds = [1, 2, 4, 0.5];
      let speedIndex = 0;
      
      btn.addEventListener('click', () => {
        speedIndex = (speedIndex + 1) % speeds.length;
        currentSpeed = speeds[speedIndex];
        btn.textContent = `⚡ Speed: ${currentSpeed}x`;
        callback(currentSpeed);
      });
    }
  }
  
  /**
   * Update pause button state
   */
  public setPaused(paused: boolean): void {
    const btn = document.getElementById('btn-pause');
    if (btn) {
      btn.textContent = paused ? '▶️ Resume' : '⏸️ Pause';
    }
  }
  
  /**
   * Cleanup
   */
  public dispose(): void {
    this.container.remove();
  }
}

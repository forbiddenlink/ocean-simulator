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
  private onToggleLook?: () => 'tropical-clear' | 'inky-cinematic' | 'bioluminescent';
  private onReplayIntro?: () => void;

  constructor(parentElement: HTMLElement = document.body) {
    this.injectStyles();
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
  
  /**
   * Inject the HUD design system. Deliberately not glassmorphism: a precise, dark
   * instrument — hairline borders, tracked micro-labels, tabular numerals, one restrained
   * accent, no emoji. The goal is "control surface of a research submersible", not a toy.
   */
  private injectStyles(): void {
    if (document.getElementById('ocean-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'ocean-ui-styles';
    style.textContent = `
      #ocean-ui {
        --acc: #5fd3e0;
        --ink: #d3e3e9;
        --muted: #6d8b95;
        --line: rgba(130, 190, 205, 0.14);
        --panel: rgba(7, 13, 19, 0.72);
        font-feature-settings: "tnum" 1, "cv01" 1;
      }
      #ocean-ui .op {
        position: absolute;
        background: var(--panel);
        -webkit-backdrop-filter: blur(4px) saturate(1.1);
        backdrop-filter: blur(4px) saturate(1.1);
        border: 1px solid var(--line);
        border-radius: 7px;
        padding: 14px 16px;
        color: var(--ink);
        box-shadow: 0 12px 44px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        pointer-events: auto;
        font-size: 12px;
      }
      #ocean-ui .op-eyebrow {
        margin: 0 0 12px;
        font-size: 9.5px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        font-weight: 600;
        color: var(--muted);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #ocean-ui .op-eyebrow::after {
        content: "";
        flex: 1;
        height: 1px;
        background: var(--line);
      }
      #ocean-ui .wordmark {
        font-size: 12px;
        letter-spacing: 0.34em;
        text-transform: uppercase;
        font-weight: 300;
        color: #eaf6f9;
      }
      #ocean-ui .wordmark b { font-weight: 600; color: var(--acc); }
      #ocean-ui .op-total {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      #ocean-ui .op-total .n {
        font-size: 26px;
        font-weight: 300;
        line-height: 1;
        color: #fff;
        font-variant-numeric: tabular-nums;
      }
      #ocean-ui .op-total .l {
        font-size: 9px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--muted);
      }
      #ocean-ui .stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px 16px;
      }
      #ocean-ui .stat-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        border-bottom: 1px solid rgba(130, 190, 205, 0.06);
        padding-bottom: 3px;
      }
      #ocean-ui .stat-row .k {
        font-size: 10px;
        letter-spacing: 0.05em;
        color: var(--muted);
        text-transform: capitalize;
      }
      #ocean-ui .stat-row .v {
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: var(--ink);
        font-weight: 600;
      }
      #ocean-ui .op-split {
        display: flex;
        gap: 14px;
        margin-top: 12px;
        padding-top: 11px;
        border-top: 1px solid var(--line);
      }
      #ocean-ui .op-split div { flex: 1; }
      #ocean-ui .op-split .k {
        font-size: 9px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--muted);
        display: block;
        margin-bottom: 2px;
      }
      #ocean-ui .op-split .v { font-size: 15px; font-weight: 300; font-variant-numeric: tabular-nums; }
      #ocean-ui .op-split .pred .v { color: #e8896b; }
      #ocean-ui .op-split .prey .v { color: #7fc898; }
      #ocean-ui .keys { display: grid; gap: 7px; }
      #ocean-ui .keys div { display: flex; align-items: center; gap: 9px; font-size: 11px; color: #9fb9c1; }
      #ocean-ui kbd {
        font: 500 10px/1 ui-monospace, "SF Mono", Menlo, monospace;
        letter-spacing: 0.03em;
        color: #cfe6ec;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(150, 200, 210, 0.2);
        border-bottom-color: rgba(150, 200, 210, 0.3);
        border-radius: 4px;
        padding: 3px 6px;
        min-width: 18px;
        text-align: center;
      }
      #ocean-ui .op-btn {
        display: block;
        width: 100%;
        text-align: center;
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid rgba(130, 190, 205, 0.18);
        border-radius: 5px;
        padding: 8px 10px;
        color: #cfe6ec;
        font-size: 10.5px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
      }
      #ocean-ui .op-btn:hover {
        border-color: rgba(95, 211, 224, 0.55);
        background: rgba(95, 211, 224, 0.1);
        color: #eaf6f9;
      }
      #ocean-ui .op-btn.primary {
        border-color: rgba(95, 211, 224, 0.35);
        color: #dff6fa;
      }
      #ocean-ui .op-field { margin-bottom: 13px; }
      #ocean-ui .op-field > label {
        display: flex;
        justify-content: space-between;
        font-size: 9.5px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }
      #ocean-ui .op-field > label span { color: var(--acc); letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
      #ocean-ui select {
        width: 100%;
        padding: 7px 8px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(130, 190, 205, 0.18);
        border-radius: 5px;
        color: var(--ink);
        font-size: 11px;
        cursor: pointer;
        appearance: none;
      }
      #ocean-ui select:focus { outline: none; border-color: rgba(95, 211, 224, 0.5); }
      #ocean-ui input[type="range"] {
        width: 100%;
        height: 2px;
        -webkit-appearance: none;
        appearance: none;
        background: rgba(130, 190, 205, 0.2);
        border-radius: 2px;
        cursor: pointer;
      }
      #ocean-ui input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--acc);
        box-shadow: 0 0 8px rgba(95, 211, 224, 0.6);
      }
      #ocean-ui input[type="range"]::-moz-range-thumb {
        width: 12px; height: 12px; border: none; border-radius: 50%; background: var(--acc);
      }
      #ocean-ui .op-note {
        margin-top: 12px;
        padding-top: 11px;
        border-top: 1px solid var(--line);
        font-size: 10px;
        line-height: 1.5;
        color: var(--muted);
      }
      #ocean-ui .feat { display: grid; gap: 6px; margin: 2px 0 0; }
      #ocean-ui .feat div {
        font-size: 10.5px;
        color: #9fb9c1;
        display: flex;
        gap: 9px;
        align-items: baseline;
      }
      #ocean-ui .feat div::before {
        content: "";
        width: 4px; height: 4px; margin-top: 5px;
        border-radius: 50%;
        background: var(--acc);
        flex: none;
        opacity: 0.7;
      }
    `;
    document.head.appendChild(style);
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
    panel.className = 'ocean-panel op';
    panel.style.cssText = 'top: 22px; left: 22px; width: 226px;';

    const species: Array<[string, string]> = [
      ['fish', 'Fish'], ['shark', 'Sharks'], ['dolphin', 'Dolphins'], ['jellyfish', 'Jellies'],
      ['ray', 'Rays'], ['turtle', 'Turtles'], ['whale', 'Whales'], ['crab', 'Crabs'],
      ['starfish', 'Starfish'], ['urchin', 'Urchins'],
    ];
    const rows = species
      .map(([id, label]) => `<div class="stat-row"><span class="k">${label}</span><span class="v" id="stat-${id}">0</span></div>`)
      .join('');

    panel.innerHTML = `
      <div class="op-eyebrow"><span class="wordmark">Ocean<b>Sim</b></span></div>
      <div class="op-total">
        <span class="n" id="stat-total">0</span>
        <span class="l">Living entities</span>
      </div>
      <div class="stat-grid">${rows}</div>
      <div class="op-split">
        <div class="pred"><span class="k">Predators</span><span class="v" id="stat-predators">0</span></div>
        <div class="prey"><span class="k">Prey</span><span class="v" id="stat-prey">0</span></div>
      </div>
    `;

    return panel;
  }
  
  private createControlsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'controls-panel';
    panel.className = 'ocean-panel op';
    panel.style.cssText = 'bottom: 22px; left: 22px; width: 206px;';

    panel.innerHTML = `
      <div class="op-eyebrow">Navigation</div>
      <div class="keys">
        <div><kbd>W A S D</kbd> Swim</div>
        <div><kbd>Q</kbd> <kbd>E</kbd> Ascend / dive</div>
        <div><kbd>Mouse</kbd> Look</div>
        <div><kbd>H</kbd> Hide interface</div>
      </div>
      <div style="display: grid; gap: 7px; margin-top: 13px; padding-top: 12px; border-top: 1px solid var(--line);">
        <button id="btn-pause" class="op-btn">Pause</button>
        <button id="btn-speed" class="op-btn">Speed &middot; 1&times;</button>
      </div>
    `;

    return panel;
  }
  
  private createInfoPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'info-panel';
    panel.className = 'ocean-panel op';
    panel.style.cssText = 'top: 22px; right: 22px; width: 232px;';

    panel.innerHTML = `
      <div class="op-eyebrow">Cinematic Deep</div>
      <div class="feat">
        <div>FFT ocean surface</div>
        <div>Volumetric light shafts</div>
        <div>Beer&ndash;Lambert depth grading</div>
        <div>Real-time schooling AI</div>
        <div>AgX filmic tonemap &middot; depth of field</div>
      </div>
      <p class="op-note">Physically-graded underwater rendering over a living, self-balancing ecosystem.</p>
    `;

    return panel;
  }
  
  private createOceanPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'ocean-panel';
    panel.className = 'ocean-panel op';
    panel.style.cssText = 'bottom: 22px; right: 22px; width: 250px; max-height: 78vh; overflow-y: auto;';

    panel.innerHTML = `
      <div class="op-eyebrow">Environment</div>

      <div class="op-field">
        <label>Fidelity</label>
        <select id="ocean-quality">
          <option value="low">Low &middot; performance</option>
          <option value="medium" selected>Medium &middot; balanced</option>
          <option value="high">High &middot; quality</option>
          <option value="ultra">Ultra &middot; maximum</option>
        </select>
      </div>

      <div class="op-field">
        <label>Weather</label>
        <select id="ocean-weather">
          <option value="clear" selected>Clear</option>
          <option value="cloudy">Overcast</option>
          <option value="stormy">Storm</option>
          <option value="sunset">Sunset</option>
        </select>
      </div>

      <div class="op-field">
        <label>Time of day <span id="ocean-time-value">12:00</span></label>
        <input type="range" id="ocean-time" min="0" max="1" step="0.01" value="0.5" />
      </div>

      <div class="op-field">
        <label>Wind <span id="ocean-wind-value">25</span></label>
        <input type="range" id="ocean-wind" min="10" max="40" step="1" value="25" />
      </div>

      <div class="op-field" style="margin-bottom: 4px;">
        <label>Swell <span id="ocean-amplitude-value">2.0</span></label>
        <input type="range" id="ocean-amplitude" min="0.5" max="4" step="0.1" value="2.0" />
      </div>

      <div class="op-eyebrow" style="margin-top: 15px;">Presentation</div>
      <div style="display: grid; gap: 7px;">
        <button id="ocean-look-toggle" class="op-btn primary">Look &middot; Cinematic Deep</button>
        <button id="ocean-replay-intro" class="op-btn">Replay flythrough</button>
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

    // Look toggle (Cinematic Deep ⇄ Clean tropical)
    const lookToggle = document.getElementById('ocean-look-toggle');
    if (lookToggle) {
      lookToggle.addEventListener('click', () => {
        const next = this.onToggleLook?.();
        const labels: Record<string, string> = {
          'inky-cinematic': 'Look · Cinematic Deep',
          'bioluminescent': 'Look · Bioluminescent',
          'tropical-clear': 'Look · Clean Tropical',
        };
        if (next) lookToggle.textContent = labels[next];
      });
    }

    // Replay intro flythrough
    const replayIntro = document.getElementById('ocean-replay-intro');
    if (replayIntro) {
      replayIntro.addEventListener('click', () => this.onReplayIntro?.());
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

  /** Register the Cinematic⇄Clean look toggle; callback returns the newly-active preset. */
  public onLookToggle(callback: () => 'tropical-clear' | 'inky-cinematic' | 'bioluminescent'): void {
    this.onToggleLook = callback;
  }

  /** Register the replay-intro-flythrough button. */
  public onIntroReplay(callback: () => void): void {
    this.onReplayIntro = callback;
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
    updateElement('stat-turtle', stats.turtle);
    updateElement('stat-crab', stats.crab);
    updateElement('stat-starfish', stats.starfish);
    updateElement('stat-urchin', stats.urchin);
    updateElement('stat-whale', stats.whale);
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
        btn.textContent = `Speed · ${currentSpeed}×`;
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
      btn.textContent = paused ? 'Resume' : 'Pause';
    }
  }
  
  /**
   * Cleanup
   */
  public dispose(): void {
    this.container.remove();
  }
}

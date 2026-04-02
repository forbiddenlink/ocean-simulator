/**
 * OceanControls - UI controls for ocean parameters
 *
 * Provides interactive controls for:
 * - Wind speed and direction
 * - Wave height
 * - Foam intensity
 * - Time of day
 * - Weather presets
 */

import GUI from 'lil-gui';
import { OceanScene } from './OceanScene';

export interface OceanControlsConfig {
  /** Target OceanScene instance */
  scene: OceanScene;
  /** Container for GUI (optional, defaults to body) */
  container?: HTMLElement;
  /** Initial collapsed state */
  collapsed?: boolean;
  /** Title for the control panel */
  title?: string;
}

export interface OceanParameters {
  windSpeed: number;
  windDirection: number;
  waveAmplitude: number;
  foamIntensity: number;
  choppiness: number;
  timeOfDay: number;
  weatherPreset: string;
}

/**
 * Weather presets
 */
const WEATHER_PRESETS: Record<string, Partial<OceanParameters>> = {
  calm: {
    windSpeed: 5,
    waveAmplitude: 0.5,
    foamIntensity: 0.2,
    choppiness: 0.5,
  },
  moderate: {
    windSpeed: 15,
    waveAmplitude: 1.5,
    foamIntensity: 0.7,
    choppiness: 1.5,
  },
  stormy: {
    windSpeed: 30,
    waveAmplitude: 4.0,
    foamIntensity: 2.0,
    choppiness: 3.0,
  },
  tropical: {
    windSpeed: 10,
    waveAmplitude: 1.0,
    foamIntensity: 0.5,
    choppiness: 1.0,
    timeOfDay: 0.5,
  },
  sunset: {
    windSpeed: 8,
    waveAmplitude: 0.8,
    foamIntensity: 0.4,
    choppiness: 0.8,
    timeOfDay: 0.75,
  },
  night: {
    windSpeed: 6,
    waveAmplitude: 0.6,
    foamIntensity: 0.3,
    choppiness: 0.6,
    timeOfDay: 0.0,
  },
};

/**
 * OceanControls class
 */
export class OceanControls {
  private gui: GUI;
  private scene: OceanScene;
  private params: OceanParameters;
  private controllers: Map<string, ReturnType<GUI['add']>> = new Map();

  // Event callbacks
  private onChangeCallbacks: Array<(params: OceanParameters) => void> = [];

  constructor(config: OceanControlsConfig) {
    this.scene = config.scene;

    // Initialize parameters
    this.params = {
      windSpeed: 20,
      windDirection: 0,
      waveAmplitude: 2.0,
      foamIntensity: 1.0,
      choppiness: 2.0,
      timeOfDay: 0.5,
      weatherPreset: 'moderate',
    };

    // Create GUI
    this.gui = new GUI({
      title: config.title || 'Ocean Controls',
      container: config.container,
    });

    if (config.collapsed) {
      this.gui.close();
    }

    this.setupControls();
  }

  /**
   * Setup all control folders and controllers
   */
  private setupControls(): void {
    // Weather Presets folder
    const presetsFolder = this.gui.addFolder('Presets');
    const presetController = presetsFolder.add(
      this.params,
      'weatherPreset',
      Object.keys(WEATHER_PRESETS)
    ).name('Weather');
    presetController.onChange((value: string) => this.applyPreset(value));
    this.controllers.set('weatherPreset', presetController);
    presetsFolder.open();

    // Wind folder
    const windFolder = this.gui.addFolder('Wind');

    const windSpeedController = windFolder.add(this.params, 'windSpeed', 0, 40, 0.5)
      .name('Speed (m/s)');
    windSpeedController.onChange((value: number) => {
      this.scene.setWind(value, this.params.windDirection);
      this.notifyChange();
    });
    this.controllers.set('windSpeed', windSpeedController);

    const windDirController = windFolder.add(this.params, 'windDirection', 0, 360, 1)
      .name('Direction (deg)');
    windDirController.onChange((value: number) => {
      this.scene.setWind(this.params.windSpeed, value);
      this.notifyChange();
    });
    this.controllers.set('windDirection', windDirController);

    windFolder.open();

    // Waves folder
    const wavesFolder = this.gui.addFolder('Waves');

    const amplitudeController = wavesFolder.add(this.params, 'waveAmplitude', 0, 5, 0.1)
      .name('Amplitude');
    amplitudeController.onChange((value: number) => {
      this.scene.setAmplitude(value);
      this.notifyChange();
    });
    this.controllers.set('waveAmplitude', amplitudeController);

    const choppinessController = wavesFolder.add(this.params, 'choppiness', 0, 4, 0.1)
      .name('Choppiness');
    choppinessController.onChange((_value: number) => {
      // This would update FFT choppiness if exposed
      this.notifyChange();
    });
    this.controllers.set('choppiness', choppinessController);

    wavesFolder.open();

    // Foam folder
    const foamFolder = this.gui.addFolder('Foam');

    const foamController = foamFolder.add(this.params, 'foamIntensity', 0, 2, 0.1)
      .name('Intensity');
    foamController.onChange((value: number) => {
      this.scene.setFoamIntensity(value);
      this.notifyChange();
    });
    this.controllers.set('foamIntensity', foamController);

    foamFolder.open();

    // Environment folder
    const envFolder = this.gui.addFolder('Environment');

    const timeController = envFolder.add(this.params, 'timeOfDay', 0, 1, 0.01)
      .name('Time of Day');
    timeController.onChange((value: number) => {
      this.scene.setTimeOfDay(value);
      this.notifyChange();
    });
    this.controllers.set('timeOfDay', timeController);

    envFolder.open();
  }

  /**
   * Apply a weather preset
   */
  private applyPreset(presetName: string): void {
    const preset = WEATHER_PRESETS[presetName];
    if (!preset) return;

    // Update parameters
    if (preset.windSpeed !== undefined) {
      this.params.windSpeed = preset.windSpeed;
    }
    if (preset.waveAmplitude !== undefined) {
      this.params.waveAmplitude = preset.waveAmplitude;
    }
    if (preset.foamIntensity !== undefined) {
      this.params.foamIntensity = preset.foamIntensity;
    }
    if (preset.choppiness !== undefined) {
      this.params.choppiness = preset.choppiness;
    }
    if (preset.timeOfDay !== undefined) {
      this.params.timeOfDay = preset.timeOfDay;
    }

    // Apply to scene
    this.scene.setWind(this.params.windSpeed, this.params.windDirection);
    this.scene.setAmplitude(this.params.waveAmplitude);
    this.scene.setFoamIntensity(this.params.foamIntensity);
    this.scene.setTimeOfDay(this.params.timeOfDay);

    // Update GUI displays
    this.updateDisplays();

    this.notifyChange();
  }

  /**
   * Update all controller displays
   */
  private updateDisplays(): void {
    this.gui.controllersRecursive().forEach((controller) => {
      controller.updateDisplay();
    });
  }

  /**
   * Notify all change callbacks
   */
  private notifyChange(): void {
    for (const callback of this.onChangeCallbacks) {
      callback(this.getParameters());
    }
  }

  /**
   * Register a change callback
   */
  public onChange(callback: (params: OceanParameters) => void): void {
    this.onChangeCallbacks.push(callback);
  }

  /**
   * Get current parameters
   */
  public getParameters(): OceanParameters {
    return { ...this.params };
  }

  /**
   * Set parameters programmatically
   */
  public setParameters(params: Partial<OceanParameters>): void {
    Object.assign(this.params, params);

    if (params.windSpeed !== undefined || params.windDirection !== undefined) {
      this.scene.setWind(this.params.windSpeed, this.params.windDirection);
    }
    if (params.waveAmplitude !== undefined) {
      this.scene.setAmplitude(this.params.waveAmplitude);
    }
    if (params.foamIntensity !== undefined) {
      this.scene.setFoamIntensity(this.params.foamIntensity);
    }
    if (params.timeOfDay !== undefined) {
      this.scene.setTimeOfDay(this.params.timeOfDay);
    }

    this.updateDisplays();
    this.notifyChange();
  }

  /**
   * Show the control panel
   */
  public show(): void {
    this.gui.show();
  }

  /**
   * Hide the control panel
   */
  public hide(): void {
    this.gui.hide();
  }

  /**
   * Dispose the controls
   */
  public dispose(): void {
    this.gui.destroy();
    this.onChangeCallbacks = [];
    this.controllers.clear();
  }
}

export default OceanControls;

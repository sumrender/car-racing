export interface AudioConfig {
  masterVolume: number; // 0.0 to 1.0
  sfxVolume: number;    // 0.0 to 1.0
  engineVolume: number; // 0.0 to 1.0
  muted: boolean;
}

export interface ISoundManager {
  // Lifecycle
  warmUp(): void;
  dispose(): void;
  getAudioContext(): AudioContext | null;

  // Sound triggers
  startNitro(): void;
  stopNitro(): void;
  playCollision(intensity?: number): void;
  playJump(intensity?: number): void;
  playLanding(intensity?: number): void;
  playSpeedBumpRumble(intensity?: number): void;

  // State & volume controls
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  toggleMute(): boolean;

  getMasterVolume(): number;
  setMasterVolume(volume: number): void;

  getSfxVolume(): number;
  setSfxVolume(volume: number): void;

  getEngineVolume(): number;
  setEngineVolume(volume: number): void;

  getConfig(): AudioConfig;
  updateConfig(partial: Partial<AudioConfig>): void;

  // Subscription for UI state sync
  subscribe(listener: (config: AudioConfig) => void): () => void;
}

const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  masterVolume: 0.85,
  sfxVolume: 0.9,
  engineVolume: 0.8,
  muted: false,
};

const STORAGE_KEY = "racer_audio_config";

/**
 * Standard Web Audio API backend implementation of ISoundManager.
 * Features a dedicated GainNode mixing tree:
 *   - masterGain -> destination
 *   - sfxGain -> masterGain (for collisions, jumps, landings, rumbles)
 *   - engineGain -> masterGain (for nitro turbine, exhaust rumble, engine loops)
 */
export class WebAudioSoundManager implements ISoundManager {
  private audioCtx: AudioContext | null = null;
  private cachedNoiseBuffer: AudioBuffer | null = null;

  // Mixing Bus Nodes
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineGain: GainNode | null = null;

  // Nitro Audio Nodes
  private nitroNoiseSource: AudioBufferSourceNode | null = null;
  private nitroFilterNode: BiquadFilterNode | null = null;
  private nitroGainNode: GainNode | null = null;
  private nitroSubOsc: OscillatorNode | null = null;
  private nitroSubFilter: BiquadFilterNode | null = null;
  private nitroSubGain: GainNode | null = null;
  private masterNitroGain: GainNode | null = null;

  private isNitroActive = false;
  private isAudioEngineInitialized = false;

  // Throttle Timestamps
  private lastCollisionSoundTime = 0;
  private lastJumpSoundTime = 0;
  private lastLandingSoundTime = 0;
  private lastRumbleTime = 0;

  // Config & Listeners
  private config: AudioConfig;
  private listeners: Set<(config: AudioConfig) => void> = new Set();

  constructor(initialConfig?: Partial<AudioConfig>) {
    this.config = this.loadConfig(initialConfig);
  }

  private loadConfig(override?: Partial<AudioConfig>): AudioConfig {
    let savedConfig: Partial<AudioConfig> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          savedConfig = JSON.parse(raw);
        }
      } catch {
        // Fallback to defaults if local storage read fails
      }
    }

    return {
      masterVolume: typeof savedConfig.masterVolume === "number" ? savedConfig.masterVolume : DEFAULT_AUDIO_CONFIG.masterVolume,
      sfxVolume: typeof savedConfig.sfxVolume === "number" ? savedConfig.sfxVolume : DEFAULT_AUDIO_CONFIG.sfxVolume,
      engineVolume: typeof savedConfig.engineVolume === "number" ? savedConfig.engineVolume : DEFAULT_AUDIO_CONFIG.engineVolume,
      muted: typeof savedConfig.muted === "boolean" ? savedConfig.muted : DEFAULT_AUDIO_CONFIG.muted,
      ...override,
    };
  }

  private saveConfig() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      } catch {
        // Ignored
      }
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.config });
      } catch {
        // Ignored
      }
    });
  }

  public subscribe(listener: (config: AudioConfig) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.config });
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private ensureAudioGraph(ctx: AudioContext) {
    if (this.isAudioEngineInitialized && this.masterGain && this.sfxGain && this.engineGain) {
      return;
    }

    try {
      const now = ctx.currentTime;

      // 1. Master Output Gain
      this.masterGain = ctx.createGain();
      const targetMaster = this.config.muted ? 0 : this.config.masterVolume;
      this.masterGain.gain.setValueAtTime(targetMaster, now);
      this.masterGain.connect(ctx.destination);

      // 2. SFX Mixing Bus
      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.config.sfxVolume, now);
      this.sfxGain.connect(this.masterGain);

      // 3. Engine / Nitro Mixing Bus
      this.engineGain = ctx.createGain();
      this.engineGain.gain.setValueAtTime(this.config.engineVolume, now);
      this.engineGain.connect(this.masterGain);

      // 4. Persistent Nitro Generator Graph
      const noiseBuffer = this.getCachedNoiseBuffer(ctx);

      this.masterNitroGain = ctx.createGain();
      this.masterNitroGain.gain.setValueAtTime(0, now);
      this.masterNitroGain.connect(this.engineGain);

      // Turbine Whoosh Generator
      this.nitroNoiseSource = ctx.createBufferSource();
      this.nitroNoiseSource.buffer = noiseBuffer;
      this.nitroNoiseSource.loop = true;

      this.nitroFilterNode = ctx.createBiquadFilter();
      this.nitroFilterNode.type = "bandpass";
      this.nitroFilterNode.frequency.setValueAtTime(800, now);
      this.nitroFilterNode.Q.setValueAtTime(2.0, now);

      this.nitroGainNode = ctx.createGain();
      this.nitroGainNode.gain.setValueAtTime(0.35, now);

      this.nitroNoiseSource.connect(this.nitroFilterNode);
      this.nitroFilterNode.connect(this.nitroGainNode);
      this.nitroGainNode.connect(this.masterNitroGain);
      this.nitroNoiseSource.start(0);

      // Sub-Bass Jet Core Rumble
      this.nitroSubOsc = ctx.createOscillator();
      this.nitroSubOsc.type = "sawtooth";
      this.nitroSubOsc.frequency.setValueAtTime(65, now);

      this.nitroSubFilter = ctx.createBiquadFilter();
      this.nitroSubFilter.type = "lowpass";
      this.nitroSubFilter.frequency.setValueAtTime(140, now);

      this.nitroSubGain = ctx.createGain();
      this.nitroSubGain.gain.setValueAtTime(0.22, now);

      this.nitroSubOsc.connect(this.nitroSubFilter);
      this.nitroSubFilter.connect(this.nitroSubGain);
      this.nitroSubGain.connect(this.masterNitroGain);
      this.nitroSubOsc.start(0);

      this.isAudioEngineInitialized = true;
    } catch {
      // Graceful recovery for autoplay policies
    }
  }

  private getCachedNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.cachedNoiseBuffer && this.cachedNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.cachedNoiseBuffer;
    }
    const bufferSize = Math.floor(ctx.sampleRate * 1.5);
    this.cachedNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = this.cachedNoiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    return this.cachedNoiseBuffer;
  }

  public warmUp() {
    const ctx = this.getAudioContext();
    if (ctx) {
      this.ensureAudioGraph(ctx);
    }
  }

  public dispose() {
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
    }
    this.audioCtx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.engineGain = null;
    this.masterNitroGain = null;
    this.isAudioEngineInitialized = false;
    this.listeners.clear();
  }

  // ==================== STATE CONTROLS ====================

  public isMuted(): boolean {
    return this.config.muted;
  }

  public setMuted(muted: boolean) {
    this.config.muted = muted;
    this.saveConfig();
    this.applyMasterGain();
    this.notifyListeners();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.config.muted);
    return this.config.muted;
  }

  public getMasterVolume(): number {
    return this.config.masterVolume;
  }

  public setMasterVolume(volume: number) {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    this.saveConfig();
    this.applyMasterGain();
    this.notifyListeners();
  }

  public getSfxVolume(): number {
    return this.config.sfxVolume;
  }

  public setSfxVolume(volume: number) {
    this.config.sfxVolume = Math.max(0, Math.min(1, volume));
    this.saveConfig();
    this.applySfxGain();
    this.notifyListeners();
  }

  public getEngineVolume(): number {
    return this.config.engineVolume;
  }

  public setEngineVolume(volume: number) {
    this.config.engineVolume = Math.max(0, Math.min(1, volume));
    this.saveConfig();
    this.applyEngineGain();
    this.notifyListeners();
  }

  public getConfig(): AudioConfig {
    return { ...this.config };
  }

  public updateConfig(partial: Partial<AudioConfig>) {
    if (typeof partial.muted === "boolean") this.config.muted = partial.muted;
    if (typeof partial.masterVolume === "number") this.config.masterVolume = Math.max(0, Math.min(1, partial.masterVolume));
    if (typeof partial.sfxVolume === "number") this.config.sfxVolume = Math.max(0, Math.min(1, partial.sfxVolume));
    if (typeof partial.engineVolume === "number") this.config.engineVolume = Math.max(0, Math.min(1, partial.engineVolume));

    this.saveConfig();
    this.applyMasterGain();
    this.applySfxGain();
    this.applyEngineGain();
    this.notifyListeners();
  }

  private applyMasterGain() {
    if (!this.audioCtx || !this.masterGain) return;
    const now = this.audioCtx.currentTime;
    const targetGain = this.config.muted ? 0 : this.config.masterVolume;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.05);
  }

  private applySfxGain() {
    if (!this.audioCtx || !this.sfxGain) return;
    const now = this.audioCtx.currentTime;
    this.sfxGain.gain.cancelScheduledValues(now);
    this.sfxGain.gain.setValueAtTime(this.sfxGain.gain.value, now);
    this.sfxGain.gain.linearRampToValueAtTime(this.config.sfxVolume, now + 0.05);
  }

  private applyEngineGain() {
    if (!this.audioCtx || !this.engineGain) return;
    const now = this.audioCtx.currentTime;
    this.engineGain.gain.cancelScheduledValues(now);
    this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, now);
    this.engineGain.gain.linearRampToValueAtTime(this.config.engineVolume, now + 0.05);
  }

  // ==================== SOUND TRIGGERS ====================

  public startNitro() {
    if (this.isNitroActive) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      this.ensureAudioGraph(ctx);
      if (!this.masterNitroGain) return;

      this.isNitroActive = true;
      const now = ctx.currentTime;

      this.masterNitroGain.gain.cancelScheduledValues(now);
      this.masterNitroGain.gain.setValueAtTime(this.masterNitroGain.gain.value, now);
      this.masterNitroGain.gain.linearRampToValueAtTime(1.0, now + 0.06);

      if (this.nitroFilterNode) {
        this.nitroFilterNode.frequency.cancelScheduledValues(now);
        this.nitroFilterNode.frequency.setValueAtTime(500, now);
        this.nitroFilterNode.frequency.exponentialRampToValueAtTime(1400, now + 0.25);
      }

      if (this.nitroSubOsc) {
        this.nitroSubOsc.frequency.cancelScheduledValues(now);
        this.nitroSubOsc.frequency.setValueAtTime(55, now);
        this.nitroSubOsc.frequency.exponentialRampToValueAtTime(95, now + 0.3);
      }

      this.playFastPurgePop(ctx, now);
    } catch {
      // Graceful error recovery
    }
  }

  public stopNitro() {
    if (!this.isNitroActive) return;
    this.isNitroActive = false;

    const ctx = this.getAudioContext();
    if (!ctx || !this.masterNitroGain) return;

    try {
      const now = ctx.currentTime;
      this.masterNitroGain.gain.cancelScheduledValues(now);
      this.masterNitroGain.gain.setValueAtTime(this.masterNitroGain.gain.value, now);
      this.masterNitroGain.gain.linearRampToValueAtTime(0.0001, now + 0.12);
    } catch {
      // Graceful error recovery
    }
  }

  private playFastPurgePop(ctx: AudioContext, now: number) {
    try {
      if (!this.engineGain) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.07);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.engineGain);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  public playCollision(intensity: number = 0.5) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastCollisionSoundTime < 0.08) return;
    this.lastCollisionSoundTime = now;

    try {
      this.ensureAudioGraph(ctx);
      if (!this.sfxGain) return;

      const clampedIntensity = Math.min(Math.max(intensity, 0.15), 1.0);

      // Bass impact thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(130 * clampedIntensity, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.12);

      gain.gain.setValueAtTime(0.32 * clampedIntensity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.15);

      // Metallic crunch noise burst
      const noiseBuffer = this.getCachedNoiseBuffer(ctx);
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1100, now);
      filter.Q.setValueAtTime(2.5, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.22 * clampedIntensity, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.10);
    } catch {}
  }

  public playJump(intensity: number = 0.7) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastJumpSoundTime < 0.25) return;
    this.lastJumpSoundTime = now;

    try {
      this.ensureAudioGraph(ctx);
      if (!this.sfxGain) return;

      const clamped = Math.min(Math.max(intensity, 0.2), 1.0);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(320 * clamped, now + 0.18);

      gain.gain.setValueAtTime(0.28 * clamped, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  }

  public playLanding(intensity: number = 0.7) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastLandingSoundTime < 0.15) return;
    this.lastLandingSoundTime = now;

    try {
      this.ensureAudioGraph(ctx);
      if (!this.sfxGain) return;

      const clamped = Math.min(Math.max(intensity, 0.2), 1.0);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(160 * clamped, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.16);

      gain.gain.setValueAtTime(0.42 * clamped, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.20);

      const noiseBuffer = this.getCachedNoiseBuffer(ctx);
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25 * clamped, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.13);
    } catch {}
  }

  public playSpeedBumpRumble(intensity: number = 0.5) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastRumbleTime < 0.18) return;
    this.lastRumbleTime = now;

    try {
      this.ensureAudioGraph(ctx);
      if (!this.sfxGain) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(85, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.09);

      gain.gain.setValueAtTime(0.25 * intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch {}
  }
}

/**
 * Null / Mock SoundManager backend for headless environments, unit tests,
 * or muted sound mode without Web Audio API overhead.
 */
export class NullSoundManager implements ISoundManager {
  private config: AudioConfig = {
    masterVolume: 0,
    sfxVolume: 0,
    engineVolume: 0,
    muted: true,
  };

  public warmUp(): void {}
  public dispose(): void {}
  public getAudioContext(): AudioContext | null { return null; }
  public startNitro(): void {}
  public stopNitro(): void {}
  public playCollision(): void {}
  public playJump(): void {}
  public playLanding(): void {}
  public playSpeedBumpRumble(): void {}

  public isMuted(): boolean { return this.config.muted; }
  public setMuted(muted: boolean): void { this.config.muted = muted; }
  public toggleMute(): boolean { this.config.muted = !this.config.muted; return this.config.muted; }

  public getMasterVolume(): number { return this.config.masterVolume; }
  public setMasterVolume(v: number): void { this.config.masterVolume = v; }

  public getSfxVolume(): number { return this.config.sfxVolume; }
  public setSfxVolume(v: number): void { this.config.sfxVolume = v; }

  public getEngineVolume(): number { return this.config.engineVolume; }
  public setEngineVolume(v: number): void { this.config.engineVolume = v; }

  public getConfig(): AudioConfig { return { ...this.config }; }
  public updateConfig(p: Partial<AudioConfig>): void { Object.assign(this.config, p); }

  public subscribe(listener: (config: AudioConfig) => void): () => void {
    listener({ ...this.config });
    return () => {};
  }
}

// Global active sound manager singleton (can be swapped at runtime using setSoundManager)
let activeSoundManager: ISoundManager = new WebAudioSoundManager();

export function getSoundManager(): ISoundManager {
  return activeSoundManager;
}

export function setSoundManager(manager: ISoundManager) {
  activeSoundManager = manager;
}

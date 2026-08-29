export interface AudioConfig {
  masterVolume: number; // 0.0 to 1.0
  sfxVolume: number;    // 0.0 to 1.0
  engineVolume: number; // 0.0 to 1.0
  muted: boolean;
}

export interface ISoundManager {
  // Lifecycle & Diagnostics
  warmUp(): AudioContext | null;
  dispose(): void;
  getAudioContext(): AudioContext | null;
  getAudioState(): string;

  // Realtime continuous loops
  updateEngine(
    speed: number,
    isAccelerating: boolean,
    isBraking: boolean,
    isNitro: boolean,
    activeStatus: string,
    isPaused: boolean,
    dt: number
  ): void;

  updateDrift(isDrifting: boolean, speed: number, dt: number): void;
  updateWindRush(speed: number, isNitro: boolean, isPaused: boolean): void;

  // Discrete sound triggers
  startNitro(): void;
  stopNitro(): void;
  playCollision(intensity?: number): void;
  playWallScrape(speed?: number, intensity?: number): void;
  playJump(intensity?: number): void;
  playLanding(intensity?: number): void;
  playSpeedBumpRumble(intensity?: number): void;
  playTestTone(): void;

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
  masterVolume: 1.0,
  sfxVolume: 1.0,
  engineVolume: 0.95,
  muted: false,
};

const STORAGE_KEY = "racer_audio_config_v4";

type SoundAssetKey =
  | "engine_idle"
  | "engine_high"
  | "nitro"
  | "crash"
  | "drift"
  | "wall_scrape"
  | "gear_shift"
  | "landing"
  | "wind_whoosh"
  | "chime";

const SOUND_ASSET_PATHS: Record<SoundAssetKey, string> = {
  engine_idle: "/sounds/engine_idle.wav?v=mw",
  engine_high: "/sounds/engine_high.wav?v=mw",
  nitro: "/sounds/nitro.wav?v=mw",
  crash: "/sounds/crash.wav?v=mw",
  drift: "/sounds/drift.wav?v=mw",
  wall_scrape: "/sounds/wall_scrape.wav?v=mw",
  gear_shift: "/sounds/gear_shift.wav?v=mw",
  landing: "/sounds/landing.wav?v=mw",
  wind_whoosh: "/sounds/wind_whoosh.wav?v=mw",
  chime: "/sounds/chime.wav?v=mw",
};

/**
 * Need For Speed: Most Wanted Hybrid Sampled & Synthesized Audio Engine.
 * Features the signature BMW M3 GTR straight-cut transmission whine, screaming high-RPM induction roar,
 * blow-off valve turbo flutter, 2-step anti-lag exhaust pops, and supersonic nitrous purge dynamics.
 */
export class WebAudioSoundManager implements ISoundManager {
  private audioCtx: AudioContext | null = null;
  private audioBuffers: Map<SoundAssetKey, AudioBuffer> = new Map();
  private isPreloading: boolean = false;

  // Mixing Bus Hierarchy
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineGain: GainNode | null = null;

  // 1. ENGINE LOOPERS (Sampled dual-layer idle & high-speed crossfading engine)
  private engineIdleSource: AudioBufferSourceNode | null = null;
  private engineIdleGain: GainNode | null = null;
  private engineHighSource: AudioBufferSourceNode | null = null;
  private engineHighGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineMasterGainNode: GainNode | null = null;
  private currentRPM: number = 1000;
  private lastGear: number = 1;
  private isEngineRunning: boolean = false;

  // 1.1 NFS MW SIGNATURE STRAIGHT-CUT GEARBOX WHINE SYNTHESIZER
  private gearWhineOsc: OscillatorNode | null = null;
  private gearWhineFilter: BiquadFilterNode | null = null;
  private gearWhineGain: GainNode | null = null;

  // 1.2 TURBOCHARGER COMPRESSOR SPOOL SYNTHESIZER
  private turboWhistleOsc: OscillatorNode | null = null;
  private turboWhistleGain: GainNode | null = null;

  // 2. NITRO LOOPERS & PURGE
  private nitroLoopSource: AudioBufferSourceNode | null = null;
  private nitroMasterGain: GainNode | null = null;
  private isNitroActive: boolean = false;

  // 3. DRIFT LOOPERS
  private driftLoopSource: AudioBufferSourceNode | null = null;
  private driftGain: GainNode | null = null;
  private isDriftLoopRunning: boolean = false;

  // 4. WIND SPEED RUSH LOOPERS
  private windLoopSource: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private isWindLoopRunning: boolean = false;

  // Timestamps & Throttle Trackers
  private lastCollisionSoundTime = 0;
  private lastWallScrapeTime = 0;
  private lastJumpSoundTime = 0;
  private lastLandingSoundTime = 0;
  private lastRumbleTime = 0;
  private lastGearShiftSoundTime = 0;
  private wasAccelerating: boolean = false;
  private lastBovTime: number = 0;
  private lastPopTime: number = 0;

  // Configuration
  private config: AudioConfig;
  private listeners: Set<(config: AudioConfig) => void> = new Set();
  private isGraphInitialized: boolean = false;

  constructor(initialConfig?: Partial<AudioConfig>) {
    this.config = this.loadConfig(initialConfig);
    this.initUserInteractionListeners();
  }

  private initUserInteractionListeners() {
    if (typeof window === "undefined") return;
    const unlock = () => {
      this.warmUp();
    };
    window.addEventListener("click", unlock, { passive: true, once: false });
    window.addEventListener("keydown", unlock, { passive: true, once: false });
    window.addEventListener("pointerdown", unlock, { passive: true, once: false });
    window.addEventListener("touchstart", unlock, { passive: true, once: false });
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
        // Fallback
      }
    }

    return {
      masterVolume:
        typeof savedConfig.masterVolume === "number"
          ? savedConfig.masterVolume
          : DEFAULT_AUDIO_CONFIG.masterVolume,
      sfxVolume:
        typeof savedConfig.sfxVolume === "number"
          ? savedConfig.sfxVolume
          : DEFAULT_AUDIO_CONFIG.sfxVolume,
      engineVolume:
        typeof savedConfig.engineVolume === "number"
          ? savedConfig.engineVolume
          : DEFAULT_AUDIO_CONFIG.engineVolume,
      muted:
        typeof savedConfig.muted === "boolean"
          ? savedConfig.muted
          : DEFAULT_AUDIO_CONFIG.muted,
      ...override,
    };
  }

  private saveConfig() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      } catch {
        // Fallback
      }
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.config });
      } catch {
        // Ignore errors from listeners
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
        this.audioCtx = new AudioContextClass({ latencyHint: "interactive" });
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public getAudioState(): string {
    if (!this.audioCtx) return "uninitialized";
    return this.audioCtx.state;
  }

  /**
   * Pre-loads all audio files asynchronously into Web Audio AudioBuffers.
   */
  private preloadAllAudioBuffers(ctx: AudioContext) {
    if (this.isPreloading) return;
    this.isPreloading = true;

    const entries = Object.entries(SOUND_ASSET_PATHS) as [SoundAssetKey, string][];
    entries.forEach(([key, url]) => {
      if (this.audioBuffers.has(key)) return;
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then((arrayBuf) => ctx.decodeAudioData(arrayBuf))
        .then((audioBuf) => {
          this.audioBuffers.set(key, audioBuf);
          // If continuous loop sources need this buffer, update them
          this.checkRestartContinuousLoops(ctx);
        })
        .catch((err) => {
          console.warn(`Could not load audio asset ${key}:`, err);
        });
    });
  }

  private ensureAudioGraph(ctx: AudioContext) {
    if (this.isGraphInitialized && this.masterGain && this.sfxGain && this.engineGain) {
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

      // 3. Engine / Nitro / Wind Mixing Bus
      this.engineGain = ctx.createGain();
      this.engineGain.gain.setValueAtTime(this.config.engineVolume, now);
      this.engineGain.connect(this.masterGain);

      this.isGraphInitialized = true;
      this.preloadAllAudioBuffers(ctx);
      this.initContinuousGenerators(ctx);
    } catch (e) {
      console.warn("Audio graph initialization warning:", e);
    }
  }

  private checkRestartContinuousLoops(ctx: AudioContext) {
    if (!this.isGraphInitialized) return;
    const now = ctx.currentTime;

    // Start engine idle loop if buffer just became ready
    if (!this.engineIdleSource && this.audioBuffers.has("engine_idle") && this.engineIdleGain) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.audioBuffers.get("engine_idle")!;
        src.loop = true;
        src.playbackRate.setValueAtTime(1.0, now);
        src.connect(this.engineIdleGain);
        src.start(0);
        this.engineIdleSource = src;
      } catch {}
    }

    // Start engine high speed loop if buffer ready
    if (!this.engineHighSource && this.audioBuffers.has("engine_high") && this.engineHighGain) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.audioBuffers.get("engine_high")!;
        src.loop = true;
        src.playbackRate.setValueAtTime(1.0, now);
        src.connect(this.engineHighGain);
        src.start(0);
        this.engineHighSource = src;
      } catch {}
    }

    // Start drift loop if buffer ready
    if (!this.driftLoopSource && this.audioBuffers.has("drift") && this.driftGain) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.audioBuffers.get("drift")!;
        src.loop = true;
        src.connect(this.driftGain);
        src.start(0);
        this.driftLoopSource = src;
        this.isDriftLoopRunning = true;
      } catch {}
    }

    // Start wind loop if buffer ready
    if (!this.windLoopSource && this.audioBuffers.has("wind_whoosh") && this.windGain) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.audioBuffers.get("wind_whoosh")!;
        src.loop = true;
        src.connect(this.windGain);
        src.start(0);
        this.windLoopSource = src;
        this.isWindLoopRunning = true;
      } catch {}
    }
  }

  private initContinuousGenerators(ctx: AudioContext) {
    if (!this.engineGain) return;
    const now = ctx.currentTime;

    // --- 1. CONTINUOUS ENGINE SYSTEM ---
    try {
      this.engineMasterGainNode = ctx.createGain();
      this.engineMasterGainNode.gain.setValueAtTime(0.4, now);

      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.frequency.setValueAtTime(1400, now);
      this.engineFilter.Q.setValueAtTime(1.8, now);

      this.engineIdleGain = ctx.createGain();
      this.engineIdleGain.gain.setValueAtTime(0.7, now);

      this.engineHighGain = ctx.createGain();
      this.engineHighGain.gain.setValueAtTime(0.01, now);

      this.engineIdleGain.connect(this.engineFilter);
      this.engineHighGain.connect(this.engineFilter);
      this.engineFilter.connect(this.engineMasterGainNode);
      this.engineMasterGainNode.connect(this.engineGain);

      this.isEngineRunning = true;
    } catch (e) {
      console.warn("Continuous engine generator setup:", e);
    }

    // --- 1.1 NFS MW BMW M3 GTR SIGNATURE STRAIGHT-CUT GEARBOX WHINE ---
    try {
      const gearOsc = ctx.createOscillator();
      gearOsc.type = "sawtooth";
      gearOsc.frequency.setValueAtTime(500, now);

      const gearFilter = ctx.createBiquadFilter();
      gearFilter.type = "bandpass";
      gearFilter.frequency.setValueAtTime(1450, now);
      gearFilter.Q.setValueAtTime(4.5, now);

      const gearGain = ctx.createGain();
      gearGain.gain.setValueAtTime(0.0001, now);

      gearOsc.connect(gearFilter);
      gearFilter.connect(gearGain);
      gearGain.connect(this.engineGain);
      gearOsc.start(now);

      this.gearWhineOsc = gearOsc;
      this.gearWhineFilter = gearFilter;
      this.gearWhineGain = gearGain;
    } catch (e) {
      console.warn("Straight-cut gear whine init error:", e);
    }

    // --- 1.2 TURBOCHARGER COMPRESSOR SPOOL WHISTLE ---
    try {
      const turboOsc = ctx.createOscillator();
      turboOsc.type = "sine";
      turboOsc.frequency.setValueAtTime(2400, now);

      const turboGain = ctx.createGain();
      turboGain.gain.setValueAtTime(0.0001, now);

      turboOsc.connect(turboGain);
      turboGain.connect(this.engineGain);
      turboOsc.start(now);

      this.turboWhistleOsc = turboOsc;
      this.turboWhistleGain = turboGain;
    } catch (e) {
      console.warn("Turbo whistle init error:", e);
    }

    // --- 2. DRIFT TIRE SCREECH GENERATOR ---
    try {
      this.driftGain = ctx.createGain();
      this.driftGain.gain.setValueAtTime(0.0001, now);
      if (this.sfxGain) {
        this.driftGain.connect(this.sfxGain);
      }
    } catch {}

    // --- 3. WIND SPEED RUSH GENERATOR ---
    try {
      this.windGain = ctx.createGain();
      this.windGain.gain.setValueAtTime(0.0001, now);
      this.windGain.connect(this.engineGain);
    } catch {}

    this.checkRestartContinuousLoops(ctx);
  }

  public warmUp(): AudioContext | null {
    const ctx = this.getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      this.ensureAudioGraph(ctx);
    }
    return ctx;
  }

  public dispose() {
    this.stopNitro();
    try {
      if (this.gearWhineOsc) {
        this.gearWhineOsc.stop();
        this.gearWhineOsc.disconnect();
      }
      if (this.turboWhistleOsc) {
        this.turboWhistleOsc.stop();
        this.turboWhistleOsc.disconnect();
      }
    } catch {}

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
    }
    this.audioCtx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.engineGain = null;
    this.engineMasterGainNode = null;
    this.engineIdleSource = null;
    this.engineHighSource = null;
    this.gearWhineOsc = null;
    this.gearWhineFilter = null;
    this.gearWhineGain = null;
    this.turboWhistleOsc = null;
    this.turboWhistleGain = null;
    this.driftLoopSource = null;
    this.windLoopSource = null;
    this.isGraphInitialized = false;
    this.isEngineRunning = false;
    this.isDriftLoopRunning = false;
    this.isWindLoopRunning = false;
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
    const next = !this.config.muted;
    this.setMuted(next);
    return next;
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
    if (typeof partial.masterVolume === "number")
      this.config.masterVolume = Math.max(0, Math.min(1, partial.masterVolume));
    if (typeof partial.sfxVolume === "number")
      this.config.sfxVolume = Math.max(0, Math.min(1, partial.sfxVolume));
    if (typeof partial.engineVolume === "number")
      this.config.engineVolume = Math.max(0, Math.min(1, partial.engineVolume));

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

  // ==================== REALTIME CONTINUOUS SIMULATION ====================

  /**
   * Realtime engine simulation driving sampled idle & high-RPM audio with seamless crossfading.
   */
  public updateEngine(
    speed: number,
    isAccelerating: boolean,
    isBraking: boolean,
    isNitro: boolean,
    activeStatus: string,
    isPaused: boolean,
    dt: number
  ) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    this.ensureAudioGraph(ctx);
    this.checkRestartContinuousLoops(ctx);

    if (!this.engineMasterGainNode || !this.engineIdleGain || !this.engineHighGain || !this.engineFilter) {
      return;
    }

    const now = ctx.currentTime;
    const isActiveSession =
      (activeStatus === "racing" || activeStatus === "countdown" || activeStatus === "test_engine") && !isPaused;

    if (!isActiveSession) {
      this.engineMasterGainNode.gain.cancelScheduledValues(now);
      this.engineMasterGainNode.gain.setValueAtTime(this.engineMasterGainNode.gain.value, now);
      this.engineMasterGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.1);
      return;
    }

    const absSpeed = Math.abs(speed);
    const isReversing = speed < -0.5;

    // Distinguish throttle from braking based on motion direction
    const isThrottle = isAccelerating || (isReversing && isBraking);
    const isRealBrake = (speed > 0.5 && isBraking) || (isReversing && isAccelerating);

    // Calculate gear ratios
    let gear = 1;
    let gearMin = 0;
    let gearMax = 28;

    if (isReversing) {
      gear = 1;
      gearMin = 0;
      gearMax = 32;
    } else if (absSpeed < 28) {
      gear = 1;
      gearMin = 0;
      gearMax = 28;
    } else if (absSpeed < 55) {
      gear = 2;
      gearMin = 24;
      gearMax = 55;
    } else if (absSpeed < 80) {
      gear = 3;
      gearMin = 50;
      gearMax = 80;
    } else if (absSpeed < 105) {
      gear = 4;
      gearMin = 75;
      gearMax = 105;
    } else {
      gear = 5;
      gearMin = 98;
      gearMax = 135;
    }

    // Play subtle gear shift sound when gear changes under load
    if (gear !== this.lastGear && isThrottle && now - this.lastGearShiftSoundTime > 0.4) {
      this.lastGearShiftSoundTime = now;
      this.playSampledSound("gear_shift", 0.65);
    }
    this.lastGear = gear;

    const gearRatio = Math.max(0, Math.min(1, (absSpeed - gearMin) / (gearMax - gearMin)));
    let targetRPM = 1000 + gearRatio * 4600 + (gear - 1) * 220;

    if (isThrottle) targetRPM += 950;
    if (isNitro) targetRPM += 1700;
    if (isRealBrake) targetRPM = Math.max(900, targetRPM - 650);

    const smoothing = isThrottle || isNitro ? 12 : 7;
    this.currentRPM += (targetRPM - this.currentRPM) * Math.min(1, smoothing * Math.max(dt, 0.016));

    // Calculate pitch playbackRates
    const rpmNorm = (this.currentRPM - 900) / 6500; // 0.0 to 1.0
    const idlePitch = 0.85 + rpmNorm * 0.75;        // 0.85x to 1.6x
    const highPitch = 0.75 + rpmNorm * 0.70;        // 0.75x to 1.45x

    // Crossfade balances between Idle rumble and High scream
    const highMix = Math.min(1.0, Math.max(0, (this.currentRPM - 1800) / 3200));
    const idleMix = Math.max(0.1, 1.0 - highMix * 0.9);

    let filterFreq = 1200 + rpmNorm * 3400;
    if (isThrottle) filterFreq += 900;
    if (isNitro) filterFreq += 1600;

    let targetMasterGain = 0.45;
    if (isThrottle) targetMasterGain = 0.78;
    if (isNitro) targetMasterGain = 0.95;
    if (isRealBrake) targetMasterGain = 0.35;
    if (absSpeed < 2 && !isThrottle) targetMasterGain = 0.4;

    try {
      if (this.engineIdleSource) {
        this.engineIdleSource.playbackRate.setValueAtTime(idlePitch, now);
      }
      if (this.engineHighSource) {
        this.engineHighSource.playbackRate.setValueAtTime(highPitch, now);
      }

      this.engineIdleGain.gain.setValueAtTime(idleMix * 0.8, now);
      this.engineHighGain.gain.setValueAtTime(highMix * 0.85, now);

      this.engineFilter.frequency.setValueAtTime(filterFreq, now);

      this.engineMasterGainNode.gain.cancelScheduledValues(now);
      this.engineMasterGainNode.gain.setValueAtTime(this.engineMasterGainNode.gain.value, now);
      this.engineMasterGainNode.gain.linearRampToValueAtTime(targetMasterGain, now + 0.04);

      // --- REALTIME STRAIGHT-CUT TRANSMISSION GEARBOX WHINE MODULATION ---
      if (this.gearWhineOsc && this.gearWhineFilter && this.gearWhineGain) {
        // High-pitched teeth-meshing whine proportional to speed and current gear
        const whineFreq = 550 + absSpeed * 28 + (this.currentRPM / 6500) * 900;
        const whineTargetGain = isAccelerating
          ? Math.min(0.24, (absSpeed / 85) * 0.22 + 0.03)
          : Math.min(0.09, (absSpeed / 85) * 0.09);

        this.gearWhineOsc.frequency.setValueAtTime(whineFreq, now);
        this.gearWhineFilter.frequency.setValueAtTime(whineFreq, now);
        this.gearWhineGain.gain.cancelScheduledValues(now);
        this.gearWhineGain.gain.setValueAtTime(this.gearWhineGain.gain.value, now);
        this.gearWhineGain.gain.linearRampToValueAtTime(whineTargetGain, now + 0.04);
      }

      // --- REALTIME TURBOCHARGER COMPRESSOR SPOOL MODULATION ---
      if (this.turboWhistleOsc && this.turboWhistleGain) {
        const turboFreq = 2200 + (this.currentRPM / 6500) * 2400 + (isNitro ? 900 : 0);
        const turboTargetGain = isAccelerating ? (isNitro ? 0.16 : 0.10) : 0.0001;

        this.turboWhistleOsc.frequency.setValueAtTime(turboFreq, now);
        this.turboWhistleGain.gain.cancelScheduledValues(now);
        this.turboWhistleGain.gain.setValueAtTime(this.turboWhistleGain.gain.value, now);
        this.turboWhistleGain.gain.linearRampToValueAtTime(turboTargetGain, now + 0.05);
      }

      // --- THROTTLE LIFT-OFF BLOW-OFF VALVE (BOV) / COMPRESSOR SURGE ---
      if (this.wasAccelerating && !isAccelerating && this.currentRPM > 3300 && now - this.lastBovTime > 0.45) {
        this.lastBovTime = now;
        this.playBlowOffValve(this.currentRPM);
      }
      this.wasAccelerating = isAccelerating;

      // --- HIGH-RPM DECELERATION EXHAUST CRACKLES / BURBLE ---
      if (!isAccelerating && this.currentRPM > 4200 && now - this.lastPopTime > 0.22 && Math.random() > 0.5) {
        this.lastPopTime = now;
        this.playExhaustPop(0.35);
      }
    } catch {}
  }

  /**
   * Procedural & sampled Turbo Blow-Off Valve (BOV) / Compressor Surge Flutter.
   */
  public playBlowOffValve(rpm: number = 5000) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Trigger sampled gear shift / flutter
    this.playSampledSound("gear_shift", 0.55, 0.08, this.sfxGain);

    // Complementary procedural resonant flutter
    try {
      const flutterOsc = ctx.createOscillator();
      const flutterGain = ctx.createGain();
      const flutterFilter = ctx.createBiquadFilter();

      flutterOsc.type = "sine";
      flutterOsc.frequency.setValueAtTime(3200 + (rpm / 6500) * 800, now);

      flutterFilter.type = "bandpass";
      flutterFilter.frequency.setValueAtTime(3400, now);
      flutterFilter.Q.setValueAtTime(5.0, now);

      flutterGain.gain.setValueAtTime(0.2, now);
      flutterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      flutterOsc.connect(flutterFilter);
      flutterFilter.connect(flutterGain);
      flutterGain.connect(this.sfxGain || ctx.destination);

      flutterOsc.start(now);
      flutterOsc.stop(now + 0.38);
    } catch {}
  }

  /**
   * Procedural 2-Step Anti-Lag Gunshot Exhaust Pop / Backfire.
   */
  public playExhaustPop(intensity: number = 0.5) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    try {
      // Sub boom
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(95, now);
      subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

      subGain.gain.setValueAtTime(0.6 * intensity, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      subOsc.connect(subGain);
      subGain.connect(this.engineGain || ctx.destination);

      subOsc.start(now);
      subOsc.stop(now + 0.15);

      // Gunshot crackle burst (white noise burst)
      const bufferSize = Math.floor(ctx.sampleRate * 0.09);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-(i / bufferSize) * 8);
      }

      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7 * intensity, now);

      noiseSrc.connect(noiseGain);
      noiseGain.connect(this.engineGain || ctx.destination);
      noiseSrc.start(now);
    } catch {}
  }

  /**
   * Realtime tire drift screech audio generator.
   */
  public updateDrift(isDrifting: boolean, speed: number, dt: number) {
    const ctx = this.getAudioContext();
    if (!ctx || !this.driftGain) return;
    this.checkRestartContinuousLoops(ctx);

    const now = ctx.currentTime;
    const absSpeed = Math.abs(speed);

    if (isDrifting && absSpeed > 15) {
      const intensity = Math.min(1.0, (absSpeed - 15) / 45);
      const targetGain = 0.55 * intensity;
      const targetRate = 0.9 + intensity * 0.25;

      if (this.driftLoopSource) {
        this.driftLoopSource.playbackRate.setValueAtTime(targetRate, now);
      }

      this.driftGain.gain.cancelScheduledValues(now);
      this.driftGain.gain.setValueAtTime(this.driftGain.gain.value, now);
      this.driftGain.gain.linearRampToValueAtTime(targetGain, now + 0.05);
    } else {
      this.driftGain.gain.cancelScheduledValues(now);
      this.driftGain.gain.setValueAtTime(this.driftGain.gain.value, now);
      this.driftGain.gain.linearRampToValueAtTime(0.0001, now + 0.08);
    }
  }

  /**
   * Realtime aerodynamic wind rush scaling with velocity.
   */
  public updateWindRush(speed: number, isNitro: boolean, isPaused: boolean) {
    const ctx = this.getAudioContext();
    if (!ctx || !this.windGain) return;
    this.checkRestartContinuousLoops(ctx);

    const now = ctx.currentTime;
    const absSpeed = Math.abs(speed);

    if (isPaused || absSpeed < 30) {
      this.windGain.gain.cancelScheduledValues(now);
      this.windGain.gain.setValueAtTime(this.windGain.gain.value, now);
      this.windGain.gain.linearRampToValueAtTime(0.0001, now + 0.08);
      return;
    }

    const windIntensity = Math.min(1.0, (absSpeed - 30) / 75);
    let targetGain = 0.35 * windIntensity;
    if (isNitro) targetGain += 0.2;

    this.windGain.gain.cancelScheduledValues(now);
    this.windGain.gain.setValueAtTime(this.windGain.gain.value, now);
    this.windGain.gain.linearRampToValueAtTime(targetGain, now + 0.06);
  }

  // ==================== DISCRETE SOUND TRIGGERS ====================

  /**
   * Helper to play an AudioBuffer with pitch randomization and gain scaling.
   */
  private playSampledSound(
    key: SoundAssetKey,
    volume: number = 1.0,
    pitchVariance: number = 0.05,
    destGainNode: GainNode | null = this.sfxGain
  ) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    this.ensureAudioGraph(ctx);

    const buffer = this.audioBuffers.get(key);
    if (!buffer) return;

    try {
      const now = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const rate = 1.0 + (Math.random() * 2 - 1) * pitchVariance;
      source.playbackRate.setValueAtTime(rate, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, now);

      source.connect(gain);
      gain.connect(destGainNode || ctx.destination);

      source.start(now);
    } catch (e) {
      console.warn(`Error playing sound ${key}:`, e);
    }
  }

  public startNitro() {
    if (this.isNitroActive) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    try {
      this.ensureAudioGraph(ctx);
      if (!this.engineGain) return;

      this.isNitroActive = true;
      const now = ctx.currentTime;

      // Master Nitro Gain
      const masterNitro = ctx.createGain();
      masterNitro.gain.setValueAtTime(0.01, now);
      masterNitro.gain.linearRampToValueAtTime(1.0, now + 0.04);
      masterNitro.connect(this.engineGain);
      this.nitroMasterGain = masterNitro;

      // Play nitro loop buffer
      const buffer = this.audioBuffers.get("nitro");
      if (buffer) {
        const loopSrc = ctx.createBufferSource();
        loopSrc.buffer = buffer;
        loopSrc.loop = true;
        loopSrc.connect(masterNitro);
        loopSrc.start(now);
        this.nitroLoopSource = loopSrc;
      }

      // Procedural Sub-Bass Punch on Nitrous Engagement
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(80, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.22);
      subGain.gain.setValueAtTime(0.85, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      subOsc.connect(subGain);
      subGain.connect(this.engineGain);
      subOsc.start(now);
      subOsc.stop(now + 0.25);

      // Initial purge spool pop
      this.playSampledSound("gear_shift", 0.75, 0.05, this.engineGain);
    } catch (e) {
      console.warn("Nitro start sound:", e);
    }
  }

  public stopNitro() {
    if (!this.isNitroActive) return;
    this.isNitroActive = false;

    const ctx = this.getAudioContext();
    const currentMaster = this.nitroMasterGain;
    const currentLoop = this.nitroLoopSource;

    this.nitroMasterGain = null;
    this.nitroLoopSource = null;

    if (!ctx || !currentMaster) return;

    try {
      const now = ctx.currentTime;
      currentMaster.gain.cancelScheduledValues(now);
      currentMaster.gain.setValueAtTime(currentMaster.gain.value, now);
      currentMaster.gain.linearRampToValueAtTime(0.0001, now + 0.12);

      // Solenoid cutoff blow-off puff
      this.playBlowOffValve(4500);

      setTimeout(() => {
        try {
          if (currentLoop) {
            currentLoop.stop();
            currentLoop.disconnect();
          }
          currentMaster.disconnect();
        } catch {}
      }, 140);
    } catch {}
  }

  /**
   * Metallic wall scrape and barrier collision.
   */
  public playWallScrape(speed: number = 40, intensity: number = 0.5) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastWallScrapeTime < 0.09) return;
    this.lastWallScrapeTime = now;

    const clamped = Math.min(Math.max(intensity, 0.3), 1.0);
    this.playSampledSound("wall_scrape", 0.75 * clamped, 0.08, this.sfxGain);
  }

  /**
   * Car-to-car or traffic collision impact sound.
   */
  public playCollision(intensity: number = 0.6) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastCollisionSoundTime < 0.08) return;
    this.lastCollisionSoundTime = now;

    const clampedIntensity = Math.min(Math.max(intensity, 0.35), 1.0);
    this.playSampledSound("crash", 0.95 * clampedIntensity, 0.1, this.sfxGain);
  }

  public playJump(intensity: number = 0.7) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastJumpSoundTime < 0.2) return;
    this.lastJumpSoundTime = now;

    const clamped = Math.min(Math.max(intensity, 0.3), 1.0);
    this.playSampledSound("gear_shift", 0.5 * clamped, 0.1, this.sfxGain);
  }

  public playLanding(intensity: number = 0.7) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastLandingSoundTime < 0.2) return;
    this.lastLandingSoundTime = now;

    const clamped = Math.min(Math.max(intensity, 0.3), 1.0);
    this.playSampledSound("landing", 0.85 * clamped, 0.06, this.sfxGain);
  }

  public playSpeedBumpRumble(intensity: number = 0.5) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastRumbleTime < 0.15) return;
    this.lastRumbleTime = now;

    this.playSampledSound("landing", 0.55 * intensity, 0.15, this.sfxGain);
  }

  /**
   * Studio-grade test chime tone for audio verification.
   */
  public playTestTone() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    this.ensureAudioGraph(ctx);

    const buffer = this.audioBuffers.get("chime");
    if (buffer) {
      try {
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.85, now);
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
      } catch {}
    } else {
      // Fallback
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(587.33, now);
        osc1.frequency.setValueAtTime(880, now + 0.15);

        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(880, now);
        osc2.frequency.setValueAtTime(1174.66, now + 0.15);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.48);
        osc2.stop(now + 0.48);
      } catch {}
    }
  }
}

/**
 * Null Sound Manager implementation for disabled audio environments.
 */
export class NullSoundManager implements ISoundManager {
  private config: AudioConfig = {
    masterVolume: 0,
    sfxVolume: 0,
    engineVolume: 0,
    muted: true,
  };

  public warmUp(): AudioContext | null {
    return null;
  }
  public dispose(): void {}
  public getAudioContext(): AudioContext | null {
    return null;
  }
  public getAudioState(): string {
    return "disabled";
  }
  public updateEngine(): void {}
  public updateDrift(): void {}
  public updateWindRush(): void {}
  public startNitro(): void {}
  public stopNitro(): void {}
  public playCollision(): void {}
  public playWallScrape(): void {}
  public playJump(): void {}
  public playLanding(): void {}
  public playSpeedBumpRumble(): void {}
  public playTestTone(): void {}

  public isMuted(): boolean {
    return this.config.muted;
  }
  public setMuted(muted: boolean): void {
    this.config.muted = muted;
  }
  public toggleMute(): boolean {
    this.config.muted = !this.config.muted;
    return this.config.muted;
  }

  public getMasterVolume(): number {
    return this.config.masterVolume;
  }
  public setMasterVolume(v: number): void {
    this.config.masterVolume = v;
  }

  public getSfxVolume(): number {
    return this.config.sfxVolume;
  }
  public setSfxVolume(v: number): void {
    this.config.sfxVolume = v;
  }

  public getEngineVolume(): number {
    return this.config.engineVolume;
  }
  public setEngineVolume(v: number): void {
    this.config.engineVolume = v;
  }

  public getConfig(): AudioConfig {
    return { ...this.config };
  }
  public updateConfig(p: Partial<AudioConfig>): void {
    Object.assign(this.config, p);
  }

  public subscribe(listener: (config: AudioConfig) => void): () => void {
    listener({ ...this.config });
    return () => {};
  }
}

// Global active sound manager singleton
let activeSoundManager: ISoundManager = new WebAudioSoundManager();

export function getSoundManager(): ISoundManager {
  return activeSoundManager;
}

export function setSoundManager(manager: ISoundManager) {
  activeSoundManager = manager;
}

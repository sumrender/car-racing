// Web Audio API procedural sound engine for Nitrous & Engine SFX (Zero-lag, pre-buffered)
let audioCtx: AudioContext | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;

// Persistent Nitro Audio Nodes Graph
let nitroNoiseSource: AudioBufferSourceNode | null = null;
let nitroFilterNode: BiquadFilterNode | null = null;
let nitroGainNode: GainNode | null = null;
let nitroSubOsc: OscillatorNode | null = null;
let nitroSubFilter: BiquadFilterNode | null = null;
let nitroSubGain: GainNode | null = null;
let masterNitroGain: GainNode | null = null;

let isNitroActive = false;
let isAudioEngineInitialized = false;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Pre-create a single loopable 1.5-second pink/white noise buffer once at initialization
function getCachedNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseBuffer && cachedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return cachedNoiseBuffer;
  }
  const bufferSize = Math.floor(ctx.sampleRate * 1.5);
  cachedNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = cachedNoiseBuffer.getChannelData(0);
  
  // High-performance filtered white noise generation
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    // Slight low-pass filtering for smooth jet/turbine whoosh sound
    data[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5; // Boost amplitude
  }
  return cachedNoiseBuffer;
}

function initNitroGraph(ctx: AudioContext) {
  if (isAudioEngineInitialized && masterNitroGain) return;

  try {
    const noiseBuffer = getCachedNoiseBuffer(ctx);

    // Master nitro volume bus
    masterNitroGain = ctx.createGain();
    masterNitroGain.gain.setValueAtTime(0, ctx.currentTime);
    masterNitroGain.connect(ctx.destination);

    // 1. Turbine Whoosh Generator
    nitroNoiseSource = ctx.createBufferSource();
    nitroNoiseSource.buffer = noiseBuffer;
    nitroNoiseSource.loop = true;

    nitroFilterNode = ctx.createBiquadFilter();
    nitroFilterNode.type = "bandpass";
    nitroFilterNode.frequency.setValueAtTime(800, ctx.currentTime);
    nitroFilterNode.Q.setValueAtTime(2.0, ctx.currentTime);

    nitroGainNode = ctx.createGain();
    nitroGainNode.gain.setValueAtTime(0.35, ctx.currentTime);

    nitroNoiseSource.connect(nitroFilterNode);
    nitroFilterNode.connect(nitroGainNode);
    nitroGainNode.connect(masterNitroGain);
    nitroNoiseSource.start(0);

    // 2. Sub-Bass Jet Core Rumble
    nitroSubOsc = ctx.createOscillator();
    nitroSubOsc.type = "sawtooth";
    nitroSubOsc.frequency.setValueAtTime(65, ctx.currentTime);

    nitroSubFilter = ctx.createBiquadFilter();
    nitroSubFilter.type = "lowpass";
    nitroSubFilter.frequency.setValueAtTime(140, ctx.currentTime);

    nitroSubGain = ctx.createGain();
    nitroSubGain.gain.setValueAtTime(0.22, ctx.currentTime);

    nitroSubOsc.connect(nitroSubFilter);
    nitroSubFilter.connect(nitroSubGain);
    nitroSubGain.connect(masterNitroGain);
    nitroSubOsc.start(0);

    isAudioEngineInitialized = true;
  } catch {
    // Graceful fallback for environments with strict audio autoplay policies
  }
}

export function startNitroAudio() {
  if (isNitroActive) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (!isAudioEngineInitialized || !masterNitroGain) {
      initNitroGraph(ctx);
    }

    if (!masterNitroGain) return;

    isNitroActive = true;
    const now = ctx.currentTime;

    // Fast, ultra-smooth envelope ramp-up (prevents clicks, pops, and audio scheduler lag)
    masterNitroGain.gain.cancelScheduledValues(now);
    masterNitroGain.gain.setValueAtTime(masterNitroGain.gain.value, now);
    masterNitroGain.gain.linearRampToValueAtTime(1.0, now + 0.06);

    // Dynamic frequency sweep for rush feel
    if (nitroFilterNode) {
      nitroFilterNode.frequency.cancelScheduledValues(now);
      nitroFilterNode.frequency.setValueAtTime(500, now);
      nitroFilterNode.frequency.exponentialRampToValueAtTime(1400, now + 0.25);
    }

    if (nitroSubOsc) {
      nitroSubOsc.frequency.cancelScheduledValues(now);
      nitroSubOsc.frequency.setValueAtTime(55, now);
      nitroSubOsc.frequency.exponentialRampToValueAtTime(95, now + 0.3);
    }

    // Quick burst purge pop
    playFastPurgePop(ctx, now);
  } catch {
    // Graceful error recovery
  }
}

export function stopNitroAudio() {
  if (!isNitroActive) return;
  isNitroActive = false;
  
  const ctx = getAudioContext();
  if (!ctx || !masterNitroGain) return;

  try {
    const now = ctx.currentTime;
    // Smooth 120ms fade out to zero - no sudden cutoffs or stutter
    masterNitroGain.gain.cancelScheduledValues(now);
    masterNitroGain.gain.setValueAtTime(masterNitroGain.gain.value, now);
    masterNitroGain.gain.linearRampToValueAtTime(0.0001, now + 0.12);
  } catch {
    // Graceful error recovery
  }
}

function playFastPurgePop(ctx: AudioContext, now: number) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.07);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch {}
}

// User-gesture warmup helper
export function warmUpAudioEngine() {
  const ctx = getAudioContext();
  if (ctx) {
    initNitroGraph(ctx);
  }
}

let lastCollisionSoundTime = 0;

export function playCollisionSound(intensity: number = 0.5) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Throttle audio triggers to avoid overlapping distortion
  if (now - lastCollisionSoundTime < 0.08) return;
  lastCollisionSoundTime = now;

  try {
    const clampedIntensity = Math.min(Math.max(intensity, 0.15), 1.0);

    // 1. Thud / impact bass oscillator
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(130 * clampedIntensity, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.12);

    gain.gain.setValueAtTime(0.32 * clampedIntensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // 2. Metallic scrape/crunch noise burst
    const noiseBuffer = getCachedNoiseBuffer(ctx);
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
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.10);
  } catch {}
}

let lastJumpSoundTime = 0;

export function playJumpSound(intensity: number = 0.7) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - lastJumpSoundTime < 0.25) return;
  lastJumpSoundTime = now;

  try {
    const clamped = Math.min(Math.max(intensity, 0.2), 1.0);

    // Upward frequency ramp + suspension lift whoosh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(320 * clamped, now + 0.18);

    gain.gain.setValueAtTime(0.28 * clamped, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch {}
}

let lastLandingSoundTime = 0;

export function playLandingSound(intensity: number = 0.7) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - lastLandingSoundTime < 0.15) return;
  lastLandingSoundTime = now;

  try {
    const clamped = Math.min(Math.max(intensity, 0.2), 1.0);

    // Heavy low-end chassis suspension slam
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(160 * clamped, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.16);

    gain.gain.setValueAtTime(0.42 * clamped, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.20);

    // Tire compression gravel/asphalt bite chirp
    const noiseBuffer = getCachedNoiseBuffer(ctx);
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
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.13);
  } catch {}
}

let lastRumbleTime = 0;

export function playSpeedBumpRumble(intensity: number = 0.5) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - lastRumbleTime < 0.18) return;
  lastRumbleTime = now;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.09);

    gain.gain.setValueAtTime(0.25 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  } catch {}
}



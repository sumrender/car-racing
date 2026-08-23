// Web Audio API procedural sound engine for Nitrous & Engine SFX
let audioCtx: AudioContext | null = null;
let nitroGainNode: GainNode | null = null;
let nitroFilterNode: BiquadFilterNode | null = null;
let nitroNoiseSource: AudioBufferSourceNode | null = null;
let nitroSubOsc: OscillatorNode | null = null;
let nitroSubGain: GainNode | null = null;
let isNitroPlaying = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Generate a 2-second white noise buffer for turbine simulation
function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function startNitroAudio() {
  if (isNitroPlaying) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    isNitroPlaying = true;
    const now = ctx.currentTime;

    // 1. High-flow turbine noise whoosh
    const noiseBuffer = createNoiseBuffer(ctx);
    nitroNoiseSource = ctx.createBufferSource();
    nitroNoiseSource.buffer = noiseBuffer;
    nitroNoiseSource.loop = true;

    nitroFilterNode = ctx.createBiquadFilter();
    nitroFilterNode.type = "bandpass";
    nitroFilterNode.frequency.setValueAtTime(450, now);
    nitroFilterNode.frequency.exponentialRampToValueAtTime(1600, now + 0.35);
    nitroFilterNode.Q.setValueAtTime(2.5, now);

    nitroGainNode = ctx.createGain();
    nitroGainNode.gain.setValueAtTime(0.001, now);
    nitroGainNode.gain.exponentialRampToValueAtTime(0.35, now + 0.1);

    nitroNoiseSource.connect(nitroFilterNode);
    nitroFilterNode.connect(nitroGainNode);
    nitroGainNode.connect(ctx.destination);
    nitroNoiseSource.start();

    // 2. Deep sub-bass rocket rumble
    nitroSubOsc = ctx.createOscillator();
    nitroSubOsc.type = "sawtooth";
    nitroSubOsc.frequency.setValueAtTime(55, now);
    nitroSubOsc.frequency.exponentialRampToValueAtTime(110, now + 0.4);

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = "lowpass";
    subFilter.frequency.setValueAtTime(120, now);

    nitroSubGain = ctx.createGain();
    nitroSubGain.gain.setValueAtTime(0.001, now);
    nitroSubGain.gain.exponentialRampToValueAtTime(0.2, now + 0.15);

    nitroSubOsc.connect(subFilter);
    subFilter.connect(nitroSubGain);
    nitroSubGain.connect(ctx.destination);
    nitroSubOsc.start();

    // 3. Initial nitrous burst "Pshhh!" purge pop
    playPurgePop(ctx);
  } catch {
    // Graceful fallback
  }
}

export function stopNitroAudio() {
  if (!isNitroPlaying) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    isNitroPlaying = false;
    const now = ctx.currentTime;

    if (nitroGainNode) {
      nitroGainNode.gain.cancelScheduledValues(now);
      nitroGainNode.gain.setValueAtTime(nitroGainNode.gain.value, now);
      nitroGainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    }
    if (nitroSubGain) {
      nitroSubGain.gain.cancelScheduledValues(now);
      nitroSubGain.gain.setValueAtTime(nitroSubGain.gain.value, now);
      nitroSubGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    }

    setTimeout(() => {
      try {
        nitroNoiseSource?.stop();
        nitroNoiseSource?.disconnect();
        nitroSubOsc?.stop();
        nitroSubOsc?.disconnect();
      } catch {}
      nitroNoiseSource = null;
      nitroSubOsc = null;
      nitroGainNode = null;
      nitroSubGain = null;
      nitroFilterNode = null;
    }, 300);
  } catch {
    // Graceful fallback
  }
}

function playPurgePop(ctx: AudioContext) {
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {}
}

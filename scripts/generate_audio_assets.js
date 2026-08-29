import fs from "fs";
import path from "path";

// Utility to create a valid 16-bit PCM Stereo WAV file
function createWavBuffer(sampleRate, leftChannel, rightChannel = null) {
  const numSamples = leftChannel.length;
  const numChannels = rightChannel ? 2 : 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // "fmt " sub-chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // "data" sub-chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    // Clamp sample between -1.0 and 1.0
    let sL = Math.max(-1.0, Math.min(1.0, leftChannel[i]));
    let intSampleL = sL < 0 ? Math.floor(sL * 32768) : Math.floor(sL * 32767);
    buffer.writeInt16LE(intSampleL, offset);
    offset += 2;

    if (numChannels === 2) {
      let sR = rightChannel ? Math.max(-1.0, Math.min(1.0, rightChannel[i])) : sL;
      let intSampleR = sR < 0 ? Math.floor(sR * 32768) : Math.floor(sR * 32767);
      buffer.writeInt16LE(intSampleR, offset);
      offset += 2;
    }
  }

  return buffer;
}

const SAMPLE_RATE = 44100;
const OUTPUT_DIR = path.resolve("./public/sounds");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log("Generating studio-quality racing audio assets...");

// 1. ENGINE IDLE (Seamless 2.0s Loop of a throaty V8 rumble)
{
  const duration = 2.0;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // V8 idle @ ~750 RPM -> cylinder firing freq ~ 50 Hz
  const firingFreq = 50.0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Cylinder firing pulse train (asymmetric pulse)
    const phase = (t * firingFreq) % 1.0;
    const cylinderPulse = Math.exp(-phase * 8) * Math.sin(phase * Math.PI * 4);
    
    // Low rumble harmonics
    const sub = Math.sin(2 * Math.PI * (firingFreq * 0.5) * t) * 0.4;
    const fund = Math.sin(2 * Math.PI * firingFreq * t) * 0.35;
    const h2 = Math.sin(2 * Math.PI * (firingFreq * 2) * t) * 0.25;
    const h3 = Math.sin(2 * Math.PI * (firingFreq * 3) * t) * 0.15;
    const h4 = Math.sin(2 * Math.PI * (firingFreq * 4) * t) * 0.1;
    
    // Mechanical valve chatter & exhaust burble (pink-filtered noise)
    const noiseL = (Math.random() * 2 - 1) * 0.08 * (1 + 0.5 * Math.sin(2 * Math.PI * firingFreq * t));
    const noiseR = (Math.random() * 2 - 1) * 0.08 * (1 + 0.5 * Math.cos(2 * Math.PI * firingFreq * t));

    // Tube exhaust resonance simulation
    const rawL = (cylinderPulse * 0.4 + sub + fund + h2 + h3 + h4 + noiseL);
    const rawR = (cylinderPulse * 0.4 + sub + fund + h2 + h3 + h4 + noiseR);

    // Warm tube saturation (soft clipping tanh)
    left[i] = Math.tanh(rawL * 1.5) * 0.85;
    right[i] = Math.tanh(rawR * 1.5) * 0.85;
  }

  // Crossfade boundary for seamless loop
  const crossfadeSamples = Math.floor(0.1 * SAMPLE_RATE);
  for (let i = 0; i < crossfadeSamples; i++) {
    const frac = i / crossfadeSamples;
    const endIdx = numSamples - crossfadeSamples + i;
    left[i] = left[i] * frac + left[endIdx] * (1 - frac);
    right[i] = right[i] * frac + right[endIdx] * (1 - frac);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "engine_idle.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> engine_idle.wav created");
}

// 2. ENGINE HIGH SPEED / ACCEL (Seamless 2.0s Loop of screaming V8/V10 at high RPM)
{
  const duration = 2.0;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // High RPM engine @ ~6500 RPM -> ~433 Hz firing frequency
  const baseFreq = 160.0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Harmonic series with formant shaping for racing intake growl
    let engine = 0;
    const numHarmonics = 12;
    for (let h = 1; h <= numHarmonics; h++) {
      const freq = baseFreq * h;
      // Intake formant boost around 800Hz - 1500Hz
      const formantGain = Math.exp(-Math.pow((freq - 1100) / 600, 2)) * 1.2 + 0.4 / h;
      engine += Math.sin(2 * Math.PI * freq * t + h * 0.3) * formantGain;
    }

    // Twin-turbocharger high-pitch whistle (compressor spool @ 3200Hz + flutter)
    const turboFlutter = Math.sin(2 * Math.PI * 18 * t) * 80;
    const turboWhistle = Math.sin(2 * Math.PI * (3200 + turboFlutter) * t) * 0.12;

    // High velocity intake air rush
    const airHiss = (Math.random() * 2 - 1) * 0.15;

    const rawL = (engine * 0.18 + turboWhistle + airHiss);
    const rawR = (engine * 0.18 + turboWhistle * 0.9 + (Math.random() * 2 - 1) * 0.15);

    left[i] = Math.tanh(rawL * 2.0) * 0.85;
    right[i] = Math.tanh(rawR * 2.0) * 0.85;
  }

  // Crossfade ends for loop
  const crossfadeSamples = Math.floor(0.1 * SAMPLE_RATE);
  for (let i = 0; i < crossfadeSamples; i++) {
    const frac = i / crossfadeSamples;
    const endIdx = numSamples - crossfadeSamples + i;
    left[i] = left[i] * frac + left[endIdx] * (1 - frac);
    right[i] = right[i] * frac + right[endIdx] * (1 - frac);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "engine_high.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> engine_high.wav created");
}

// 3. NITRO BOOST (1.8s loopable jet afterburner & nitrous blowtorch surge)
{
  const duration = 1.8;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  let b0L = 0, b1L = 0, b2L = 0;
  let b0R = 0, b1R = 0, b2R = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Jet turbine rising whistle
    const jetFreq = 2400 + Math.sin(t * Math.PI * 4) * 200 + 400 * Math.sin(t * 8);
    const turbine = Math.sin(2 * Math.PI * jetFreq * t) * 0.22;
    const subThrust = Math.sin(2 * Math.PI * 65 * t) * 0.35;

    // Nitrous blowtorch high velocity roar (filtered noise)
    const whiteL = Math.random() * 2 - 1;
    const whiteR = Math.random() * 2 - 1;

    // Resonant bandpass filter approximation
    b0L = 0.85 * b0L + 0.15 * whiteL;
    b1L = 0.85 * b1L + 0.15 * (whiteL - b0L);
    b0R = 0.85 * b0R + 0.15 * whiteR;
    b1R = 0.85 * b1R + 0.15 * (whiteR - b0R);

    // Dynamic flame combustion crackle
    const crackle = Math.random() > 0.985 ? (Math.random() * 2 - 1) * 0.4 : 0;

    const rawL = (turbine + subThrust + (whiteL - b0L) * 0.5 + b0L * 0.3 + crackle);
    const rawR = (turbine * 0.95 + subThrust + (whiteR - b0R) * 0.5 + b0R * 0.3 + crackle);

    left[i] = Math.tanh(rawL * 1.6) * 0.9;
    right[i] = Math.tanh(rawR * 1.6) * 0.9;
  }

  // Crossfade
  const crossfadeSamples = Math.floor(0.15 * SAMPLE_RATE);
  for (let i = 0; i < crossfadeSamples; i++) {
    const frac = i / crossfadeSamples;
    const endIdx = numSamples - crossfadeSamples + i;
    left[i] = left[i] * frac + left[endIdx] * (1 - frac);
    right[i] = right[i] * frac + right[endIdx] * (1 - frac);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "nitro.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> nitro.wav created");
}

// 4. CAR CRASH / IMPACT (1.2s explosive physical vehicle collision)
{
  const duration = 1.2;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const envImpact = Math.exp(-t * 16.0); // Fast transient
    const envBody = Math.exp(-t * 4.5);   // Metal deformation decay
    const envGlass = Math.exp(-t * 2.5);  // Glass scatter

    // 1. Heavy sub-bass body crumple (45Hz down to 25Hz)
    const pitchDrop = 60 * Math.exp(-t * 12.0) + 30;
    const thud = Math.sin(2 * Math.PI * pitchDrop * t) * envImpact * 0.8;

    // 2. Violent metal crumple & chassis fracture (distorted noise bursts)
    const metalNoiseL = (Math.random() * 2 - 1) * envBody * 0.65;
    const metalNoiseR = (Math.random() * 2 - 1) * envBody * 0.65;

    // 3. Metallic ring resonance (780Hz & 1420Hz metallic beam ring)
    const metalRing = (Math.sin(2 * Math.PI * 780 * t) + 0.6 * Math.sin(2 * Math.PI * 1420 * t)) * Math.exp(-t * 6.0) * 0.35;

    // 4. Glass shatter scatter debris (high-freq crackles)
    const glassCrackle = (Math.random() > 0.94 ? (Math.random() * 2 - 1) * 0.5 : 0) * envGlass;

    const rawL = (thud + metalNoiseL + metalRing + glassCrackle);
    const rawR = (thud + metalNoiseR + metalRing * 0.9 + glassCrackle);

    // Hard saturation for brutal cinematic impact
    left[i] = Math.tanh(rawL * 2.2) * 0.95;
    right[i] = Math.tanh(rawR * 2.2) * 0.95;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "crash.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> crash.wav created");
}

// 5. DRIFT / TIRE SCREECH (1.5s seamless tire friction squeal & asphalt shear)
{
  const duration = 1.5;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Dual acoustic resonance peaks for rubber squeal (850Hz & 1450Hz with frequency jitter)
    const jitter = Math.sin(2 * Math.PI * 23 * t) * 45 + Math.sin(2 * Math.PI * 41 * t) * 30;
    const f1 = 820 + jitter;
    const f2 = 1380 + jitter * 1.3;
    const f3 = 2200 + jitter * 1.8;

    const squeal1 = Math.sin(2 * Math.PI * f1 * t) * 0.35;
    const squeal2 = Math.sin(2 * Math.PI * f2 * t) * 0.28;
    const squeal3 = Math.sin(2 * Math.PI * f3 * t) * 0.15;

    // Asphalt granulate friction noise
    const asphaltL = (Math.random() * 2 - 1) * 0.25;
    const asphaltR = (Math.random() * 2 - 1) * 0.25;

    const rawL = (squeal1 + squeal2 + squeal3 + asphaltL);
    const rawR = (squeal1 * 0.9 + squeal2 * 1.1 + squeal3 + asphaltR);

    left[i] = Math.tanh(rawL * 1.5) * 0.85;
    right[i] = Math.tanh(rawR * 1.5) * 0.85;
  }

  // Crossfade for loop
  const crossfadeSamples = Math.floor(0.1 * SAMPLE_RATE);
  for (let i = 0; i < crossfadeSamples; i++) {
    const frac = i / crossfadeSamples;
    const endIdx = numSamples - crossfadeSamples + i;
    left[i] = left[i] * frac + left[endIdx] * (1 - frac);
    right[i] = right[i] * frac + right[endIdx] * (1 - frac);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "drift.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> drift.wav created");
}

// 6. WALL SCRAPE / GUARDRAIL (1.2s metal-on-steel friction & sparks)
{
  const duration = 1.2;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Guardrail corrugated rail vibration (around 320Hz modulated)
    const corrugation = Math.sin(2 * Math.PI * 340 * t) * 0.35;
    
    // High-pitched grinding metal rasp
    const raspFreq = 1800 + Math.sin(t * 60) * 300;
    const metalRasp = Math.sin(2 * Math.PI * raspFreq * t) * 0.25;

    // Spark spatter noise
    const sparksL = (Math.random() * 2 - 1) * 0.35;
    const sparksR = (Math.random() * 2 - 1) * 0.35;

    const rawL = (corrugation + metalRasp + sparksL);
    const rawR = (corrugation * 0.9 + metalRasp * 1.1 + sparksR);

    left[i] = Math.tanh(rawL * 1.7) * 0.88;
    right[i] = Math.tanh(rawR * 1.7) * 0.88;
  }

  // Crossfade for loop
  const crossfadeSamples = Math.floor(0.1 * SAMPLE_RATE);
  for (let i = 0; i < crossfadeSamples; i++) {
    const frac = i / crossfadeSamples;
    const endIdx = numSamples - crossfadeSamples + i;
    left[i] = left[i] * frac + left[endIdx] * (1 - frac);
    right[i] = right[i] * frac + right[endIdx] * (1 - frac);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "wall_scrape.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> wall_scrape.wav created");
}

// 7. GEAR SHIFT (0.35s crisp sequential paddle shift + blow-off valve + exhaust pop)
{
  const duration = 0.35;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // 1. Mechanical shift actuator click (0 to 0.05s)
    const clickEnv = Math.exp(-t * 80.0);
    const click = Math.sin(2 * Math.PI * 1800 * t) * clickEnv * 0.6;

    // 2. Turbo blow-off valve *pssshh* (0.02 to 0.25s)
    const bovEnv = t > 0.02 ? Math.exp(-(t - 0.02) * 14.0) : 0;
    const bovHiss = (Math.random() * 2 - 1) * bovEnv * 0.45;

    // 3. Exhaust backfire pop at 0.06s
    const popEnv = t > 0.06 ? Math.exp(-(t - 0.06) * 45.0) : 0;
    const pop = (Math.sin(2 * Math.PI * 95 * t) + (Math.random() * 2 - 1) * 0.5) * popEnv * 0.7;

    const raw = click + bovHiss + pop;
    left[i] = Math.tanh(raw * 1.8) * 0.9;
    right[i] = Math.tanh(raw * 1.8) * 0.9;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "gear_shift.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> gear_shift.wav created");
}

// 8. LANDING / SUSPENSION THUD (0.4s heavy chassis compression)
{
  const duration = 0.4;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 12.0);
    const pitch = 70 * Math.exp(-t * 20.0) + 35;
    const sub = Math.sin(2 * Math.PI * pitch * t) * env * 0.75;
    const suspensionNoise = (Math.random() * 2 - 1) * Math.exp(-t * 25.0) * 0.35;

    const raw = sub + suspensionNoise;
    left[i] = Math.tanh(raw * 1.8) * 0.9;
    right[i] = Math.tanh(raw * 1.8) * 0.9;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "landing.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> landing.wav created");
}

// 9. HIGH SPEED WIND WHOOSH (1.5s aerodynamic cockpit wind loop)
{
  const duration = 1.5;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  let bL = 0, bR = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const whiteL = Math.random() * 2 - 1;
    const whiteR = Math.random() * 2 - 1;

    bL = 0.92 * bL + 0.08 * whiteL;
    bR = 0.92 * bR + 0.08 * whiteR;

    // Cockpit pressure fluctuation
    const buffeting = 1 + 0.25 * Math.sin(2 * Math.PI * 9 * t);
    left[i] = bL * buffeting * 0.7;
    right[i] = bR * buffeting * 0.7;
  }

  // Crossfade
  const crossfadeSamples = Math.floor(0.1 * SAMPLE_RATE);
  for (let i = 0; i < crossfadeSamples; i++) {
    const frac = i / crossfadeSamples;
    const endIdx = numSamples - crossfadeSamples + i;
    left[i] = left[i] * frac + left[endIdx] * (1 - frac);
    right[i] = right[i] * frac + right[endIdx] * (1 - frac);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "wind_whoosh.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> wind_whoosh.wav created");
}

// 10. POLISHED UI TEST CHIME (0.6s clean musical confirmation tone)
{
  const duration = 0.6;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Chord: E5 (659.25 Hz) + B5 (987.77 Hz) + E6 (1318.5 Hz)
    const env1 = Math.exp(-t * 6.0);
    const env2 = t > 0.08 ? Math.exp(-(t - 0.08) * 5.0) : 0;
    const env3 = t > 0.16 ? Math.exp(-(t - 0.16) * 4.0) : 0;

    const tone1 = Math.sin(2 * Math.PI * 659.25 * t) * env1 * 0.35;
    const tone2 = Math.sin(2 * Math.PI * 987.77 * t) * env2 * 0.35;
    const tone3 = Math.sin(2 * Math.PI * 1318.5 * t) * env3 * 0.3;

    const rawL = tone1 + tone2 * 0.8 + tone3;
    const rawR = tone1 * 0.8 + tone2 + tone3;

    left[i] = rawL * 0.85;
    right[i] = rawR * 0.85;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "chime.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> chime.wav created");
}

console.log("All audio assets successfully built!");

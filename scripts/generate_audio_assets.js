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

console.log("Generating NFS Most Wanted inspired racing audio assets...");

// 1. ENGINE IDLE (NFS MW Aggressive Cam Loaf & Throaty V8/Straight-6 Mechanical Burble)
{
  const duration = 2.0;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // Aggressive cam lope @ ~780 RPM -> ~52 Hz base combustion with irregular pulse modulation
  const firingFreq = 52.0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Asymmetric race-cam lope modulation (unsteady high-lift camshaft)
    const lope = 1 + 0.35 * Math.sin(2 * Math.PI * 4.2 * t) + 0.2 * Math.cos(2 * Math.PI * 8.4 * t);
    const phase = (t * firingFreq * lope) % 1.0;
    
    // Sharp cylinder combustion pulse
    const cylinderPulse = Math.exp(-phase * 10) * Math.sin(phase * Math.PI * 5);
    
    // Low mechanical rumble harmonics (deep bass burble)
    const sub = Math.sin(2 * Math.PI * 26 * t) * 0.45;
    const fund = Math.sin(2 * Math.PI * 52 * t) * 0.4;
    const h2 = Math.sin(2 * Math.PI * 104 * t) * 0.3;
    const h3 = Math.sin(2 * Math.PI * 156 * t) * 0.22;
    const h4 = Math.sin(2 * Math.PI * 208 * t) * 0.18;
    const h5 = Math.sin(2 * Math.PI * 312 * t) * 0.12;

    // Straight-cut gear mesh idle tick & valve train rattle
    const valvetrain = (Math.sin(2 * Math.PI * 1250 * t) + 0.5 * Math.sin(2 * Math.PI * 2400 * t)) * 
      Math.exp(-((phase * 12) % 1.0) * 8) * 0.15;

    // Deep exhaust burble with stereo differential
    const burbleL = (Math.random() * 2 - 1) * 0.12 * (1 + 0.6 * Math.sin(2 * Math.PI * firingFreq * t));
    const burbleR = (Math.random() * 2 - 1) * 0.12 * (1 + 0.6 * Math.cos(2 * Math.PI * firingFreq * t));

    const rawL = (cylinderPulse * 0.5 + sub + fund + h2 + h3 + h4 + h5 + valvetrain + burbleL);
    const rawR = (cylinderPulse * 0.5 + sub + fund + h2 + h3 + h4 + h5 + valvetrain + burbleR);

    // Warm, gritty analogue tape & tube saturation
    left[i] = Math.tanh(rawL * 1.8) * 0.9;
    right[i] = Math.tanh(rawR * 1.8) * 0.9;
  }

  // Crossfade boundary for seamless loop
  const crossfadeSamples = Math.floor(0.12 * SAMPLE_RATE);
  for (let i = 0; i < crossfadeSamples; i++) {
    const frac = i / crossfadeSamples;
    const endIdx = numSamples - crossfadeSamples + i;
    left[i] = left[i] * frac + left[endIdx] * (1 - frac);
    right[i] = right[i] * frac + right[endIdx] * (1 - frac);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "engine_idle.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> engine_idle.wav created (NFS MW Aggressive Cam Idle)");
}

// 2. ENGINE HIGH SPEED (NFS Most Wanted BMW M3 GTR Screamer with Straight-Cut Gear Whine & Induction Roar)
{
  const duration = 2.0;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // High RPM race V8/Straight-6 fundamental @ ~185Hz
  const baseFreq = 185.0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    // 1. Screaming combustion harmonic series with aggressive intake formant shaping
    let exhaustRoar = 0;
    const numHarmonics = 16;
    for (let h = 1; h <= numHarmonics; h++) {
      const freq = baseFreq * h;
      // High-mid frequency resonance peaks (characteristic M3 GTR metallic rasp @ 1100Hz and 2200Hz)
      const formant1 = Math.exp(-Math.pow((freq - 1150) / 400, 2)) * 1.6;
      const formant2 = Math.exp(-Math.pow((freq - 2300) / 600, 2)) * 1.2;
      const baseAmp = 0.55 / Math.pow(h, 0.75);
      exhaustRoar += Math.sin(2 * Math.PI * freq * t + h * 0.4) * (baseAmp + formant1 + formant2);
    }

    // 2. THE ICONIC BMW M3 GTR STRAIGHT-CUT TRANSMISSION GEAR WHINE!
    // High-pitched, teeth-meshing whine with FM sidebands
    const gearFreq = 1650.0;
    const gearWhineFM = Math.sin(2 * Math.PI * (baseFreq * 2) * t) * 35;
    const gearWhine1 = Math.sin(2 * Math.PI * (gearFreq + gearWhineFM) * t) * 0.42;
    const gearWhine2 = Math.sin(2 * Math.PI * ((gearFreq * 2) + gearWhineFM * 1.5) * t) * 0.22;
    const gearWhine3 = Math.sin(2 * Math.PI * ((gearFreq * 3) + gearWhineFM * 2) * t) * 0.12;
    const totalGearWhine = gearWhine1 + gearWhine2 + gearWhine3;

    // 3. High-RPM Turbocharger Compressor Whistle & Ceramic Bearings
    const turboFlutter = Math.sin(2 * Math.PI * 22 * t) * 120;
    const turboWhistle = Math.sin(2 * Math.PI * (3800 + turboFlutter) * t) * 0.16;

    // 4. Razor-sharp induction air roar (filtered turbulent noise)
    const airHissL = (Math.random() * 2 - 1) * 0.2;
    const airHissR = (Math.random() * 2 - 1) * 0.2;

    const rawL = (exhaustRoar * 0.18 + totalGearWhine + turboWhistle + airHissL);
    const rawR = (exhaustRoar * 0.18 + totalGearWhine * 0.95 + turboWhistle * 1.05 + airHissR);

    // Dynamic high-gain drive / distortion saturation (raw street racing grit)
    left[i] = Math.tanh(rawL * 2.3) * 0.92;
    right[i] = Math.tanh(rawR * 2.3) * 0.92;
  }

  // Crossfade ends for loop
  const crossfadeSamples = Math.floor(0.12 * SAMPLE_RATE);
  for (let i = 0; i < crossfadeSamples; i++) {
    const frac = i / crossfadeSamples;
    const endIdx = numSamples - crossfadeSamples + i;
    left[i] = left[i] * frac + left[endIdx] * (1 - frac);
    right[i] = right[i] * frac + right[endIdx] * (1 - frac);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "engine_high.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> engine_high.wav created (NFS MW M3 GTR Straight-Cut Gear Whine & Roar)");
}

// 3. NITRO BOOST (NFS Most Wanted High-Pressure Purge, Sub Punch & Supersonic Jet Blast)
{
  const duration = 2.0;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  let b0L = 0, b1L = 0;
  let b0R = 0, b1R = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    // Initial high-pressure purge pop / surge transient
    const purgeEnv = t < 0.25 ? Math.exp(-t * 12.0) : 0;
    const purgeBlast = (Math.random() * 2 - 1) * purgeEnv * 0.8;

    // Deep sub-bass punch & supersonic thrust (48Hz rumble)
    const subThrust = Math.sin(2 * Math.PI * 48 * t) * 0.45;
    const subHarmonic = Math.sin(2 * Math.PI * 96 * t) * 0.25;

    // Hypersonic jet turbine whistle (3200Hz - 4400Hz with speed modulation)
    const jetFreq = 3200 + Math.sin(t * Math.PI * 6) * 350 + 250 * Math.sin(t * 14);
    const turbineWhine = Math.sin(2 * Math.PI * jetFreq * t) * 0.32;

    // High velocity nitrous blowtorch roar
    const whiteL = Math.random() * 2 - 1;
    const whiteR = Math.random() * 2 - 1;

    b0L = 0.82 * b0L + 0.18 * whiteL;
    b1L = 0.82 * b1L + 0.18 * (whiteL - b0L);
    b0R = 0.82 * b0R + 0.18 * whiteR;
    b1R = 0.82 * b1R + 0.18 * (whiteR - b0R);

    // Nitrous combustion flame crackle & pop
    const flameCrackle = Math.random() > 0.97 ? (Math.random() * 2 - 1) * 0.5 : 0;

    const rawL = (purgeBlast + subThrust + subHarmonic + turbineWhine + (whiteL - b0L) * 0.6 + flameCrackle);
    const rawR = (purgeBlast * 0.9 + subThrust + subHarmonic + turbineWhine * 0.95 + (whiteR - b0R) * 0.6 + flameCrackle);

    left[i] = Math.tanh(rawL * 2.0) * 0.95;
    right[i] = Math.tanh(rawR * 2.0) * 0.95;
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
  console.log("-> nitro.wav created (NFS MW Nitrous Blast)");
}

// 4. GEAR SHIFT (NFS MW Sequential Transmission Slam + Blow-Off Flutter + Gunshot Exhaust Pop)
{
  const duration = 0.45;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    // 1. Heavy pneumatic dog-box transmission actuator slam (0 to 0.06s)
    const slamEnv = Math.exp(-t * 60.0);
    const gearClunk = (Math.sin(2 * Math.PI * 180 * t) + 0.6 * Math.sin(2 * Math.PI * 450 * t)) * slamEnv * 0.8;
    const metalClick = Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 120.0) * 0.5;

    // 2. ICONIC TURBO BLOW-OFF VALVE / COMPRESSOR SURGE FLUTTER ("tsu-tsu-tsu-pssshh")
    let bovFlutter = 0;
    if (t > 0.02) {
      const dt = t - 0.02;
      const flutterFreq = 28.0; // Rapid surge pulses
      const pulse = Math.pow(Math.max(0, Math.sin(2 * Math.PI * flutterFreq * dt)), 2);
      const flutterEnv = Math.exp(-dt * 10.0);
      const whiteNoise = Math.random() * 2 - 1;
      const whistle = Math.sin(2 * Math.PI * 3400 * dt) * 0.3;
      bovFlutter = (whiteNoise * 0.7 + whistle) * pulse * flutterEnv * 0.75;
    }

    // 3. GUNSHOT TWO-STEP / ANTI-LAG EXHAUST BACKFIRE POP (at t = 0.05s)
    let exhaustPop = 0;
    if (t > 0.045) {
      const pt = t - 0.045;
      const popEnv = Math.exp(-pt * 35.0);
      const subBoom = Math.sin(2 * Math.PI * 65 * pt) * popEnv * 0.9;
      const crackle = (Math.random() * 2 - 1) * popEnv * 0.85;
      exhaustPop = subBoom + crackle;
    }

    const raw = (gearClunk + metalClick + bovFlutter + exhaustPop);
    left[i] = Math.tanh(raw * 2.2) * 0.95;
    right[i] = Math.tanh(raw * 2.2) * 0.95;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "gear_shift.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> gear_shift.wav created (NFS MW Dog-Box + BOV Flutter + Exhaust Pop)");
}

// 5. DRIFT / TIRE SCREECH (NFS MW High-G Asphalt Friction & Burning Rubber Squeal)
{
  const duration = 1.5;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    // Multi-harmonic tire slip squeal with aggressive slip angle frequency flutter
    const slipMod = Math.sin(2 * Math.PI * 18 * t) * 65 + Math.sin(2 * Math.PI * 37 * t) * 45;
    const f1 = 840 + slipMod;
    const f2 = 1420 + slipMod * 1.4;
    const f3 = 2150 + slipMod * 1.9;
    const f4 = 3100 + slipMod * 2.3;

    const squeal1 = Math.sin(2 * Math.PI * f1 * t) * 0.4;
    const squeal2 = Math.sin(2 * Math.PI * f2 * t) * 0.32;
    const squeal3 = Math.sin(2 * Math.PI * f3 * t) * 0.22;
    const squeal4 = Math.sin(2 * Math.PI * f4 * t) * 0.12;

    // Granular asphalt friction grit & road texture noise
    const gritL = (Math.random() * 2 - 1) * 0.35;
    const gritR = (Math.random() * 2 - 1) * 0.35;

    // Low tire carcass roar (120Hz)
    const carcassRoar = Math.sin(2 * Math.PI * 135 * t) * 0.25;

    const rawL = (squeal1 + squeal2 + squeal3 + squeal4 + carcassRoar + gritL);
    const rawR = (squeal1 * 0.9 + squeal2 * 1.1 + squeal3 * 0.95 + squeal4 * 1.05 + carcassRoar + gritR);

    left[i] = Math.tanh(rawL * 1.8) * 0.9;
    right[i] = Math.tanh(rawR * 1.8) * 0.9;
  }

  // Crossfade for loop
  const crossfadeSamples = Math.floor(0.12 * SAMPLE_RATE);
  for (let i = 0; i < crossfadeSamples; i++) {
    const frac = i / crossfadeSamples;
    const endIdx = numSamples - crossfadeSamples + i;
    left[i] = left[i] * frac + left[endIdx] * (1 - frac);
    right[i] = right[i] * frac + right[endIdx] * (1 - frac);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "drift.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> drift.wav created (NFS MW High-G Drift Squeal)");
}

// 6. CAR CRASH / COLLISION (NFS MW Cinematic Vehicle Crunch, Sub Thud & Glass Shatter)
{
  const duration = 1.4;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const envImpact = Math.exp(-t * 18.0); // Ultra-fast transient punch
    const envBody = Math.exp(-t * 4.0);    // Metal deformation decay
    const envGlass = Math.exp(-t * 2.2);   // Glass & debris scatter

    // 1. Heavy cinematic bass drop / sub-bass frame shock (down to 24Hz)
    const pitchDrop = 75 * Math.exp(-t * 14.0) + 24;
    const subImpact = Math.sin(2 * Math.PI * pitchDrop * t) * envImpact * 0.95;

    // 2. Heavy steel chassis crumple and buckling (fracture noise)
    const crumpleNoiseL = (Math.random() * 2 - 1) * envBody * 0.75;
    const crumpleNoiseR = (Math.random() * 2 - 1) * envBody * 0.75;

    // 3. Metallic ring resonance (680Hz & 1320Hz steel barrier ring)
    const metalRing = (Math.sin(2 * Math.PI * 680 * t) + 0.7 * Math.sin(2 * Math.PI * 1320 * t)) * Math.exp(-t * 5.0) * 0.45;

    // 4. Shattered glass scatter & shrapnel spray
    const glassScatter = (Math.random() > 0.92 ? (Math.random() * 2 - 1) * 0.6 : 0) * envGlass;

    const rawL = (subImpact + crumpleNoiseL + metalRing + glassScatter);
    const rawR = (subImpact + crumpleNoiseR + metalRing * 0.9 + glassScatter);

    left[i] = Math.tanh(rawL * 2.5) * 0.98;
    right[i] = Math.tanh(rawR * 2.5) * 0.98;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "crash.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> crash.wav created (NFS MW Cinematic Crash)");
}

// 7. WALL SCRAPE / GUARDRAIL (NFS MW Corrugated Steel Guardrail Friction & Sparks)
{
  const duration = 1.2;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Guardrail corrugated rail vibration frequency modulation (380Hz)
    const corrugation = Math.sin(2 * Math.PI * 380 * t) * 0.4;
    
    // High-pitched grinding metal rasp
    const raspFreq = 2400 + Math.sin(t * 80) * 400;
    const metalRasp = Math.sin(2 * Math.PI * raspFreq * t) * 0.35;

    // Spark shower crackle
    const sparksL = (Math.random() * 2 - 1) * 0.4;
    const sparksR = (Math.random() * 2 - 1) * 0.4;

    const rawL = (corrugation + metalRasp + sparksL);
    const rawR = (corrugation * 0.95 + metalRasp * 1.05 + sparksR);

    left[i] = Math.tanh(rawL * 1.9) * 0.92;
    right[i] = Math.tanh(rawR * 1.9) * 0.92;
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
  console.log("-> wall_scrape.wav created (NFS MW Guardrail Grind)");
}

// 8. LANDING / SUSPENSION THUD (NFS MW Hard Rally Landing & Chassis Scraping)
{
  const duration = 0.45;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 14.0);
    const pitch = 85 * Math.exp(-t * 22.0) + 38;
    const sub = Math.sin(2 * Math.PI * pitch * t) * env * 0.85;
    const damperCompression = (Math.random() * 2 - 1) * Math.exp(-t * 28.0) * 0.4;

    // Quick tire chirp on touchdown
    const chirp = Math.sin(2 * Math.PI * (1600 * Math.exp(-t * 40)) * t) * Math.exp(-t * 30) * 0.35;

    const raw = sub + damperCompression + chirp;
    left[i] = Math.tanh(raw * 2.0) * 0.95;
    right[i] = Math.tanh(raw * 2.0) * 0.95;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "landing.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> landing.wav created (NFS MW Heavy Suspension Landing)");
}

// 9. HIGH SPEED WIND WHOOSH (NFS MW Aerodynamic Cockpit Wind Vortex)
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

    bL = 0.88 * bL + 0.12 * whiteL;
    bR = 0.88 * bR + 0.12 * whiteR;

    // Low-frequency cockpit air buffet
    const buffeting = 1 + 0.35 * Math.sin(2 * Math.PI * 12 * t);
    left[i] = bL * buffeting * 0.75;
    right[i] = bR * buffeting * 0.75;
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
  console.log("-> wind_whoosh.wav created (NFS MW Wind Vortex)");
}

// 10. POLISHED HUD / CHECKPOINT CHIME (NFS MW Speedtrap / Milestone Ping)
{
  const duration = 0.65;
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Electronic synth ping chord: D5 (587.33Hz) + A5 (880Hz) + D6 (1174.66Hz) + F#6 (1479.98Hz)
    const env1 = Math.exp(-t * 7.0);
    const env2 = t > 0.05 ? Math.exp(-(t - 0.05) * 6.0) : 0;
    const env3 = t > 0.1 ? Math.exp(-(t - 0.1) * 5.0) : 0;

    const tone1 = Math.sin(2 * Math.PI * 587.33 * t) * env1 * 0.35;
    const tone2 = Math.sin(2 * Math.PI * 880 * t) * env2 * 0.35;
    const tone3 = Math.sin(2 * Math.PI * 1479.98 * t) * env3 * 0.3;

    const rawL = tone1 + tone2 * 0.8 + tone3;
    const rawR = tone1 * 0.8 + tone2 + tone3;

    left[i] = rawL * 0.9;
    right[i] = rawR * 0.9;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "chime.wav"), createWavBuffer(SAMPLE_RATE, left, right));
  console.log("-> chime.wav created (NFS MW Milestone Chime)");
}

console.log("All NFS Most Wanted racing audio assets successfully built!");

import * as THREE from "three";
import { Player } from "../types";

export type AIDifficulty = "easy" | "medium" | "hard" | "apex" | "god";

export interface AIDifficultyConfig {
  id: AIDifficulty;
  label: string;
  badge: string;
  description: string;
  baseSpeed: number; // km/h
  cornerSpeed: number; // km/h
  boostSpeed: number; // km/h
  accelRate: number;
  brakeRate: number;
  nitroFrequency: number; // 0 to 1
  nitroDuration: number;
  driftAggression: number;
  apexTightness: number; // 0 to 3.8 lateral road offset
  color: string;
}

export const AI_DIFFICULTIES: Record<AIDifficulty, AIDifficultyConfig> = {
  easy: {
    id: "easy",
    label: "Rookie",
    badge: "CASUAL",
    description: "Cruising pace with gentle cornering. Ideal for learning the track layout.",
    baseSpeed: 46,
    cornerSpeed: 34,
    boostSpeed: 60,
    accelRate: 18,
    brakeRate: 24,
    nitroFrequency: 0.20,
    nitroDuration: 1.4,
    driftAggression: 0.3,
    apexTightness: 1.5,
    color: "#10b981", // Emerald
  },
  medium: {
    id: "medium",
    label: "Pro Racer",
    badge: "COMPETITIVE",
    description: "Solid racing lines with timely nitro bursts on straightaways and good corner grip.",
    baseSpeed: 54,
    cornerSpeed: 42,
    boostSpeed: 74,
    accelRate: 24,
    brakeRate: 32,
    nitroFrequency: 0.45,
    nitroDuration: 1.7,
    driftAggression: 0.55,
    apexTightness: 2.4,
    color: "#f59e0b", // Amber
  },
  hard: {
    id: "hard",
    label: "Cyber Veteran",
    badge: "EXPERT",
    description: "High-velocity power drifts through corners, rapid nitro recovery, and tight apex cutting.",
    baseSpeed: 60,
    cornerSpeed: 49,
    boostSpeed: 86,
    accelRate: 32,
    brakeRate: 40,
    nitroFrequency: 0.70,
    nitroDuration: 2.0,
    driftAggression: 0.80,
    apexTightness: 3.0,
    color: "#ef4444", // Crimson Red
  },
  apex: {
    id: "apex",
    label: "Apex Champion",
    badge: "MASTER",
    description: "Relentless pro competitor with optimized racing lines, fast apex exits & drafting.",
    baseSpeed: 64,
    cornerSpeed: 53,
    boostSpeed: 96,
    accelRate: 38,
    brakeRate: 46,
    nitroFrequency: 0.85,
    nitroDuration: 2.3,
    driftAggression: 0.95,
    apexTightness: 3.5,
    color: "#a855f7", // Electric Purple
  },
  god: {
    id: "god",
    label: "Hyper Overdrive",
    badge: "NIGHTMARE",
    description: "Top-tier hyper rival with razor-sharp cornering, rapid nitro chaining & relentless slipstreaming.",
    baseSpeed: 68,
    cornerSpeed: 57,
    boostSpeed: 104,
    accelRate: 45,
    brakeRate: 52,
    nitroFrequency: 0.92,
    nitroDuration: 2.6,
    driftAggression: 1.0,
    apexTightness: 3.8,
    color: "#ec4899", // Neon Fuchsia
  },
};

// Preset distinct rival identities for multi-car grids (1 to 5 opponents)
export interface AIRivalPreset {
  name: string;
  color: string;
  title: string;
  gridSlot: number;
  initialLateralOffset: number;
  initialZOffset: number;
  initialUOffset: number;
  speedVariance: number; // Small multiplier (0.97 to 1.03) for natural racing spread
  lateralLineBias: number; // Slight line preference to avoid overlapping
}

export const AI_RIVAL_PRESETS: AIRivalPreset[] = [
  {
    name: "Apex AI",
    color: "#ef4444",
    title: "Pack Leader",
    gridSlot: 2,
    initialLateralOffset: 3.5,
    initialZOffset: -3.5,
    initialUOffset: 0.0,
    speedVariance: 1.02,
    lateralLineBias: 0.0,
  },
  {
    name: "Viper GT",
    color: "#10b981",
    title: "Cornering Specialist",
    gridSlot: 3,
    initialLateralOffset: -3.5,
    initialZOffset: -7.0,
    initialUOffset: -0.005,
    speedVariance: 0.99,
    lateralLineBias: -0.8,
  },
  {
    name: "Phantom Turbo",
    color: "#8b5cf6",
    title: "Speed Demon",
    gridSlot: 4,
    initialLateralOffset: 3.0,
    initialZOffset: -10.5,
    initialUOffset: -0.010,
    speedVariance: 1.01,
    lateralLineBias: 0.8,
  },
  {
    name: "Cyber Pulse",
    color: "#06b6d4",
    title: "Grip Technician",
    gridSlot: 5,
    initialLateralOffset: -3.0,
    initialZOffset: -14.0,
    initialUOffset: -0.015,
    speedVariance: 0.98,
    lateralLineBias: -0.5,
  },
  {
    name: "Solar Flare",
    color: "#f59e0b",
    title: "Aggressive Chaser",
    gridSlot: 6,
    initialLateralOffset: 2.2,
    initialZOffset: -17.5,
    initialUOffset: -0.020,
    speedVariance: 1.00,
    lateralLineBias: 0.5,
  },
];

export interface AIState {
  player: Player;
  u: number; // 0.0 to 1.0 (or > 1.0 for multi-lap continuous progress)
  lateralOffset: number; // lateral shift across road width (-4 to +4)
  targetLateralOffset: number;
  currentSpeed: number;
  boostTimer: number;
  nitroCooldown: number;
  driftTimer: number;
  difficulty: AIDifficulty;
  speedVariance: number;
  lateralLineBias: number;
  rivalIndex: number;
}

export function createInitialAIState(
  difficulty: AIDifficulty = "medium",
  name = "Apex AI",
  color = "#ef4444",
  rivalIndex = 0
): AIState {
  const preset = AI_RIVAL_PRESETS[rivalIndex % AI_RIVAL_PRESETS.length];
  const finalName = name || preset.name;
  const finalColor = color || preset.color;

  return {
    player: {
      id: `ai_opponent_${rivalIndex + 1}`,
      name: finalName,
      color: finalColor,
      isHost: false,
      ready: true,
      x: preset.initialLateralOffset,
      y: 0,
      z: preset.initialZOffset,
      rotationY: 0,
      speed: 0,
      driftScore: 0,
      isDrifting: false,
      driftMeter: 0,
      totalDriftScore: 0,
      lap: 1,
      checkpoint: 0,
      finished: false,
      finishTime: 0,
      place: rivalIndex + 2,
    },
    u: preset.initialUOffset,
    lateralOffset: preset.initialLateralOffset,
    targetLateralOffset: preset.initialLateralOffset * 0.6,
    currentSpeed: 0,
    boostTimer: 0,
    nitroCooldown: 1.5 + rivalIndex * 0.4,
    driftTimer: 0,
    difficulty,
    speedVariance: preset.speedVariance,
    lateralLineBias: preset.lateralLineBias,
    rivalIndex,
  };
}

export function createAIPackState(
  count: number = 1,
  difficulty: AIDifficulty = "medium"
): AIState[] {
  const safeCount = Math.max(1, Math.min(5, count));
  const pack: AIState[] = [];
  for (let i = 0; i < safeCount; i++) {
    const preset = AI_RIVAL_PRESETS[i % AI_RIVAL_PRESETS.length];
    pack.push(createInitialAIState(difficulty, preset.name, preset.color, i));
  }
  return pack;
}

export function updateAISimulation(
  aiState: AIState,
  dt: number,
  trackCurve: THREE.CatmullRomCurve3,
  trackLength: number,
  raceStatus: "lobby" | "countdown" | "racing" | "results",
  raceStartTime: number,
  playerProgress: number = 0,
  playerSpeed: number = 0
): AIState {
  const cfg = AI_DIFFICULTIES[aiState.difficulty] || AI_DIFFICULTIES.medium;
  const p = { ...aiState.player };
  const preset = AI_RIVAL_PRESETS[aiState.rivalIndex % AI_RIVAL_PRESETS.length];

  if (raceStatus !== "racing" || p.finished) {
    if (raceStatus === "countdown") {
      // Starting grid placement according to grid slot
      const startPt = trackCurve.getPointAt(0);
      const tangent = trackCurve.getTangentAt(0).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

      const gridPos = startPt
        .clone()
        .add(normal.clone().multiplyScalar(preset.initialLateralOffset))
        .add(tangent.clone().multiplyScalar(preset.initialZOffset));

      p.x = gridPos.x;
      p.y = 0;
      p.z = gridPos.z;
      p.rotationY = Math.atan2(tangent.x, tangent.z);
      p.speed = 0;
      aiState.u = preset.initialUOffset;
      aiState.currentSpeed = 0;
      aiState.lateralOffset = preset.initialLateralOffset;
      aiState.boostTimer = 0;
      aiState.nitroCooldown = 1.5 + aiState.rivalIndex * 0.4;
    }
    return { ...aiState, player: p };
  }

  // 1. EVALUATE UPCOMING ROAD CURVATURE
  const currentU = ((aiState.u % 1.0) + 1.0) % 1.0;
  const lookaheadU = (currentU + 0.03) % 1.0;
  const farLookaheadU = (currentU + 0.065) % 1.0;

  const currentTangent = trackCurve.getTangentAt(currentU).normalize();
  const nextTangent = trackCurve.getTangentAt(lookaheadU).normalize();
  const farTangent = trackCurve.getTangentAt(farLookaheadU).normalize();

  // Curvature is angle difference between current and upcoming tangents
  const angleDelta = Math.abs(
    Math.atan2(
      currentTangent.x * nextTangent.z - currentTangent.z * nextTangent.x,
      currentTangent.x * nextTangent.x + currentTangent.z * nextTangent.z
    )
  );
  const farAngleDelta = Math.abs(
    Math.atan2(
      currentTangent.x * farTangent.z - currentTangent.z * farTangent.x,
      currentTangent.x * farTangent.x + currentTangent.z * farTangent.z
    )
  );

  const isSharpCurve = angleDelta > 0.38 || farAngleDelta > 0.58;
  const isStraightaway = angleDelta < 0.14 && farAngleDelta < 0.20;
  const isCornerExit = !isSharpCurve && angleDelta < 0.20 && farAngleDelta < 0.30;

  // 2. DYNAMIC CHASE & SLIPSTREAMING (Scaled by variance)
  const isChasing = playerProgress > aiState.u;
  const gapProgress = Math.max(0, playerProgress - aiState.u);
  const gapMeters = gapProgress * trackLength;
  let chaseSpeedBonus = 0;

  if (
    isChasing &&
    (aiState.difficulty === "hard" ||
      aiState.difficulty === "apex" ||
      aiState.difficulty === "god")
  ) {
    if (aiState.difficulty === "god") {
      chaseSpeedBonus = Math.min(4.5, gapMeters * 0.04);
    } else if (aiState.difficulty === "apex") {
      chaseSpeedBonus = Math.min(3.5, gapMeters * 0.03);
    } else {
      chaseSpeedBonus = Math.min(2.5, gapMeters * 0.02);
    }
  }

  // 3. NITRO BOOST LOGIC & CORNER EXIT ACCELERATION
  aiState.nitroCooldown -= dt;
  if (aiState.boostTimer > 0) {
    aiState.boostTimer -= dt;
    if (aiState.boostTimer <= 0) aiState.boostTimer = 0;
  } else {
    const shouldFireStraightaway =
      isStraightaway &&
      aiState.nitroCooldown <= 0 &&
      Math.random() < cfg.nitroFrequency * dt * 3.0;
    const shouldFireCornerExit =
      isCornerExit &&
      aiState.nitroCooldown <= 0 &&
      Math.random() < cfg.nitroFrequency * dt * 4.0;
    const shouldFireChaseNitro =
      isChasing &&
      gapMeters > 30 &&
      aiState.nitroCooldown <= 0.5 &&
      (aiState.difficulty === "apex" || aiState.difficulty === "god");

    if (shouldFireStraightaway || shouldFireCornerExit || shouldFireChaseNitro) {
      aiState.boostTimer = cfg.nitroDuration;
      const baseCooldown = (1.0 - cfg.nitroFrequency) * 3.5;
      aiState.nitroCooldown = Math.max(
        0.6,
        baseCooldown - (isChasing ? 0.8 : 0) + (aiState.rivalIndex * 0.2)
      );
    }
  }

  // 4. TARGET SPEED CALCULATION
  const baseAppliedSpeed = cfg.baseSpeed * (aiState.speedVariance || 1.0);
  const boostAppliedSpeed = cfg.boostSpeed * (aiState.speedVariance || 1.0);
  const cornerAppliedSpeed = cfg.cornerSpeed * (aiState.speedVariance || 1.0);

  let targetSpeed = baseAppliedSpeed + chaseSpeedBonus;
  if (aiState.boostTimer > 0) {
    targetSpeed = boostAppliedSpeed + chaseSpeedBonus;
  } else if (isSharpCurve) {
    targetSpeed = cornerAppliedSpeed + chaseSpeedBonus * 0.6;
  }

  // Acceleration / braking physics
  const effectiveAccel = cfg.accelRate * (aiState.boostTimer > 0 ? 1.6 : 1.0);
  if (aiState.currentSpeed < targetSpeed) {
    aiState.currentSpeed += effectiveAccel * dt;
    if (aiState.currentSpeed > targetSpeed) aiState.currentSpeed = targetSpeed;
  } else if (aiState.currentSpeed > targetSpeed) {
    aiState.currentSpeed -= cfg.brakeRate * dt;
    if (aiState.currentSpeed < targetSpeed) aiState.currentSpeed = targetSpeed;
  }

  // 5. DRIFT SIMULATION WITH POWER SLIDE
  const canDrift = isSharpCurve && aiState.currentSpeed > 36;
  if (canDrift) {
    p.isDrifting = true;
    const turnSign =
      currentTangent.x * nextTangent.z - currentTangent.z * nextTangent.x > 0
        ? 1
        : -1;
    p.driftScore += Math.round(aiState.currentSpeed * cfg.driftAggression * 6 * dt);
    p.totalDriftScore += Math.round(aiState.currentSpeed * 3 * dt);
    p.driftMeter = Math.min(100, p.driftMeter + 60 * dt);
    p.rotationY += turnSign * 0.22 * dt;
  } else {
    if (p.isDrifting) {
      p.isDrifting = false;
      p.driftScore = 0;
      p.driftMeter = 0;
    }
  }

  // 6. RACING LINE & GEOMETRIC APEX CUTTING
  const turnDirection = Math.sign(
    currentTangent.x * nextTangent.z - currentTangent.z * nextTangent.x
  );
  if (Math.abs(turnDirection) > 0.05) {
    aiState.targetLateralOffset =
      turnDirection * -cfg.apexTightness + (aiState.lateralLineBias || 0);
  } else {
    if (isChasing && gapMeters < 50) {
      aiState.targetLateralOffset = 0.5 + (aiState.lateralLineBias * 0.4);
    } else {
      aiState.targetLateralOffset =
        Math.sin(currentU * Math.PI * 6 + aiState.rivalIndex) *
          (aiState.difficulty === "easy" ? 2.2 : 0.8) +
        aiState.lateralLineBias;
    }
  }

  // Clamp lateral offset to road bounds
  aiState.targetLateralOffset = Math.max(-4.2, Math.min(4.2, aiState.targetLateralOffset));

  const lerpSpeed =
    aiState.difficulty === "god" || aiState.difficulty === "apex" ? 5.5 : 3.2;
  aiState.lateralOffset = THREE.MathUtils.lerp(
    aiState.lateralOffset,
    aiState.targetLateralOffset,
    lerpSpeed * dt
  );

  // 7. ADVANCE POSITION ALONG SPLINE
  const advanceDist = aiState.currentSpeed * dt;
  const deltaU = advanceDist / trackLength;
  const previousU = aiState.u;
  aiState.u += deltaU;

  // Track position
  const loopU = ((aiState.u % 1.0) + 1.0) % 1.0;
  const centerPoint = trackCurve.getPointAt(loopU);
  const trackTangent = trackCurve.getTangentAt(loopU).normalize();
  const trackNormal = new THREE.Vector3(-trackTangent.z, 0, trackTangent.x);

  const actualPos = centerPoint
    .clone()
    .add(trackNormal.clone().multiplyScalar(aiState.lateralOffset));
  p.x = actualPos.x;
  p.y = 0;
  p.z = actualPos.z;

  const heading = Math.atan2(trackTangent.x, trackTangent.z);
  p.rotationY = heading;
  p.speed = aiState.currentSpeed;

  // 8. CHECKPOINTS & LAP LOGIC
  const CHECKPOINT_COUNT = 5;
  for (let cp = 0; cp < CHECKPOINT_COUNT; cp++) {
    const cpU = cp / CHECKPOINT_COUNT;
    const diffU = Math.min(Math.abs(loopU - cpU), 1.0 - Math.abs(loopU - cpU));
    if (diffU < 0.08) {
      const nextExpected = (p.checkpoint + 1) % CHECKPOINT_COUNT;
      if (cp === nextExpected) {
        p.checkpoint = cp;
        if (cp === 0 && (previousU % 1.0 > 0.75 || previousU > 0.8)) {
          p.lap = Math.min(4, Math.floor(aiState.u) + 1);
          if (p.lap > 3 || aiState.u >= 3.0) {
            p.finished = true;
            p.speed = 0;
            p.finishTime = Date.now() - raceStartTime;
          }
        }
      }
    }
  }

  if (!p.finished) {
    p.lap = Math.min(3, Math.floor(Math.max(0, aiState.u)) + 1);
  }

  return {
    ...aiState,
    player: p,
  };
}

export interface RacerStanding {
  id: string;
  name: string;
  color: string;
  place: number;
  progress: number;
  lap: number;
  checkpoint: number;
  finished: boolean;
  finishTime?: number;
  speed: number;
  isPlayer: boolean;
  totalDriftScore: number;
}

export interface StandingsResult {
  playerPlace: number;
  aiPlace: number; // backwards compatibility for single opponent
  totalRacers: number;
  gapMeters: number;
  leadPlayerName: string;
  isLapping: boolean;
  lapsDifference: number;
  playerProgress: number;
  aiProgress: number; // backwards compatibility for single opponent
  rivalAhead?: { name: string; gapMeters: number; color: string } | null;
  rivalBehind?: { name: string; gapMeters: number; color: string } | null;
  allStandings: RacerStanding[];
}

/**
 * Multi-Car Race Standings Calculation (1 to 5 AI Opponents + 1 Human Driver)
 */
export function calculateMultiRaceStandings(
  player: {
    id?: string;
    name: string;
    color?: string;
    lap: number;
    checkpoint: number;
    finished: boolean;
    finishTime?: number;
    speed?: number;
    totalDriftScore?: number;
  },
  aiPack: AIState[],
  playerU: number,
  trackLength: number = 1200
): StandingsResult {
  // 1. Player Continuous Progress
  let playerProgress: number;
  if (player.finished) {
    playerProgress = 3.0;
  } else {
    const rawU = ((playerU % 1.0) + 1.0) % 1.0;
    const baseLap = Math.max(1, Math.min(3, player.lap));
    if (player.checkpoint >= 3 && rawU < 0.2) {
      playerProgress = baseLap + rawU;
    } else if (player.checkpoint === 0 && rawU > 0.8) {
      playerProgress = baseLap - 1 + rawU;
    } else {
      playerProgress = baseLap - 1 + rawU;
    }
    playerProgress = Math.max(0, Math.min(3.0, playerProgress));
  }

  // 2. Build list of all racers
  const racers: RacerStanding[] = [
    {
      id: player.id || "solo_player",
      name: player.name || "Solo Driver",
      color: player.color || "#ef4444",
      place: 1,
      progress: playerProgress,
      lap: Math.min(3, player.lap),
      checkpoint: player.checkpoint,
      finished: player.finished,
      finishTime: player.finishTime,
      speed: player.speed || 0,
      isPlayer: true,
      totalDriftScore: player.totalDriftScore || 0,
    },
  ];

  aiPack.forEach((ai) => {
    const aiProg = ai.player.finished ? 3.0 : Math.max(0, Math.min(3.0, ai.u));
    racers.push({
      id: ai.player.id,
      name: ai.player.name,
      color: ai.player.color,
      place: 2,
      progress: aiProg,
      lap: Math.min(3, ai.player.lap),
      checkpoint: ai.player.checkpoint,
      finished: ai.player.finished,
      finishTime: ai.player.finishTime,
      speed: ai.player.speed,
      isPlayer: false,
      totalDriftScore: ai.player.totalDriftScore,
    });
  });

  // 3. Sort racers by race position:
  // - If finished: sort by finishTime ascending
  // - If not finished: sort by progress descending
  racers.sort((a, b) => {
    if (a.finished && b.finished) {
      return (a.finishTime || 0) - (b.finishTime || 0);
    }
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    return b.progress - a.progress;
  });

  // Assign numeric place rank
  racers.forEach((r, idx) => {
    r.place = idx + 1;
  });

  const playerIdx = racers.findIndex((r) => r.isPlayer);
  const playerStanding = racers[playerIdx] || racers[0];
  const playerPlace = playerStanding.place;
  const leadRacer = racers[0];

  // Nearest rival ahead
  let rivalAhead: { name: string; gapMeters: number; color: string } | null = null;
  if (playerIdx > 0) {
    const aheadRacer = racers[playerIdx - 1];
    const diffProg = aheadRacer.progress - playerStanding.progress;
    rivalAhead = {
      name: aheadRacer.name,
      gapMeters: Math.max(1, Math.round(diffProg * trackLength)),
      color: aheadRacer.color,
    };
  }

  // Nearest rival behind
  let rivalBehind: { name: string; gapMeters: number; color: string } | null = null;
  if (playerIdx < racers.length - 1) {
    const behindRacer = racers[playerIdx + 1];
    const diffProg = playerStanding.progress - behindRacer.progress;
    rivalBehind = {
      name: behindRacer.name,
      gapMeters: Math.max(1, Math.round(diffProg * trackLength)),
      color: behindRacer.color,
    };
  }

  // Gap to leader (or gap to P2 if leading)
  let gapMeters = 0;
  if (playerPlace === 1) {
    if (racers.length > 1) {
      gapMeters = Math.max(
        1,
        Math.round((playerStanding.progress - racers[1].progress) * trackLength)
      );
    }
  } else {
    gapMeters = Math.max(
      1,
      Math.round((leadRacer.progress - playerStanding.progress) * trackLength)
    );
  }

  const primaryAI = aiPack[0];
  const aiProgress = primaryAI ? (primaryAI.player.finished ? 3.0 : primaryAI.u) : 0;
  const primaryAIStanding = racers.find((r) => r.id === (primaryAI?.player.id || "")) || racers[1];

  return {
    playerPlace,
    aiPlace: primaryAIStanding ? primaryAIStanding.place : 2,
    totalRacers: racers.length,
    gapMeters,
    leadPlayerName: leadRacer.name,
    isLapping: playerPlace === 1 && gapMeters >= trackLength * 0.85,
    lapsDifference: Math.floor(gapMeters / trackLength),
    playerProgress,
    aiProgress,
    rivalAhead,
    rivalBehind,
    allStandings: racers,
  };
}

/**
 * Backward-compatible single AI standings wrapper
 */
export function calculateRaceStandings(
  player: {
    name: string;
    lap: number;
    checkpoint: number;
    finished: boolean;
    finishTime?: number;
  },
  aiPlayer: Player,
  playerU: number,
  aiTotalU: number,
  trackLength: number = 1200
): StandingsResult {
  const dummyState: AIState = {
    player: aiPlayer,
    u: aiTotalU,
    lateralOffset: 0,
    targetLateralOffset: 0,
    currentSpeed: aiPlayer.speed,
    boostTimer: 0,
    nitroCooldown: 0,
    driftTimer: 0,
    difficulty: "medium",
    speedVariance: 1,
    lateralLineBias: 0,
    rivalIndex: 0,
  };

  return calculateMultiRaceStandings(player, [dummyState], playerU, trackLength);
}

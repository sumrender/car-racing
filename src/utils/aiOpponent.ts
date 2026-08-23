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

export interface AIState {
  player: Player;
  u: number; // 0.0 to 1.0 track progress
  lateralOffset: number; // lateral shift across road width (-4 to +4)
  targetLateralOffset: number;
  currentSpeed: number;
  boostTimer: number;
  nitroCooldown: number;
  driftTimer: number;
  difficulty: AIDifficulty;
}

export function createInitialAIState(
  difficulty: AIDifficulty = "medium",
  name = "Apex AI",
  color = "#ef4444"
): AIState {
  return {
    player: {
      id: "ai_opponent",
      name,
      color,
      isHost: false,
      ready: true,
      x: 3.5,
      y: 0,
      z: -2.0,
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
      place: 2,
    },
    u: 0.0,
    lateralOffset: 3.5, // Start on the right side of the starting grid
    targetLateralOffset: 2.0,
    currentSpeed: 0,
    boostTimer: 0,
    nitroCooldown: 2.0,
    driftTimer: 0,
    difficulty,
  };
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

  if (raceStatus !== "racing" || p.finished) {
    if (raceStatus === "countdown") {
      // Starting grid position (beside player at start line)
      const startPt = trackCurve.getPointAt(0);
      const tangent = trackCurve.getTangentAt(0).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
      
      const gridPos = startPt.clone().add(normal.clone().multiplyScalar(3.5)).add(tangent.clone().multiplyScalar(-2));
      p.x = gridPos.x;
      p.y = 0;
      p.z = gridPos.z;
      p.rotationY = Math.atan2(tangent.x, tangent.z);
      p.speed = 0;
      aiState.u = 0.0;
      aiState.currentSpeed = 0;
      aiState.lateralOffset = 3.5;
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
  const angleDelta = Math.abs(Math.atan2(currentTangent.x * nextTangent.z - currentTangent.z * nextTangent.x, currentTangent.x * nextTangent.x + currentTangent.z * nextTangent.z));
  const farAngleDelta = Math.abs(Math.atan2(currentTangent.x * farTangent.z - currentTangent.z * farTangent.x, currentTangent.x * farTangent.x + currentTangent.z * farTangent.z));
  
  const isSharpCurve = angleDelta > 0.38 || farAngleDelta > 0.58;
  const isStraightaway = angleDelta < 0.14 && farAngleDelta < 0.20;
  const isCornerExit = !isSharpCurve && (angleDelta < 0.20) && (farAngleDelta < 0.30);

  // 2. DYNAMIC CHASE & SLIPSTREAMING (High Difficulties)
  const isChasing = playerProgress > aiState.u;
  const gapProgress = Math.max(0, playerProgress - aiState.u);
  const gapMeters = gapProgress * trackLength;
  let chaseSpeedBonus = 0;
  
  if (isChasing && (aiState.difficulty === "hard" || aiState.difficulty === "apex" || aiState.difficulty === "god")) {
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
    const shouldFireStraightaway = isStraightaway && aiState.nitroCooldown <= 0 && Math.random() < cfg.nitroFrequency * dt * 3.0;
    const shouldFireCornerExit = isCornerExit && aiState.nitroCooldown <= 0 && Math.random() < cfg.nitroFrequency * dt * 4.0;
    const shouldFireChaseNitro = isChasing && gapMeters > 30 && aiState.nitroCooldown <= 0.5 && (aiState.difficulty === "apex" || aiState.difficulty === "god");

    if (shouldFireStraightaway || shouldFireCornerExit || shouldFireChaseNitro) {
      // Fire nitro burst!
      aiState.boostTimer = cfg.nitroDuration;
      const baseCooldown = (1.0 - cfg.nitroFrequency) * 3.5;
      aiState.nitroCooldown = Math.max(0.6, baseCooldown - (isChasing ? 0.8 : 0));
    }
  }

  // 4. TARGET SPEED CALCULATION (Momentum preserved in corners)
  let targetSpeed = cfg.baseSpeed + chaseSpeedBonus;
  if (aiState.boostTimer > 0) {
    targetSpeed = cfg.boostSpeed + chaseSpeedBonus;
  } else if (isSharpCurve) {
    // High difficulty AI maintains strong drift speed through corners
    targetSpeed = cfg.cornerSpeed + (chaseSpeedBonus * 0.6);
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
    const turnSign = (currentTangent.x * nextTangent.z - currentTangent.z * nextTangent.x) > 0 ? 1 : -1;
    p.driftScore += Math.round(aiState.currentSpeed * cfg.driftAggression * 6 * dt);
    p.totalDriftScore += Math.round(aiState.currentSpeed * 3 * dt);
    p.driftMeter = Math.min(100, p.driftMeter + 60 * dt);
    // Dynamic drift angle
    p.rotationY += turnSign * 0.22 * dt;
  } else {
    if (p.isDrifting) {
      p.isDrifting = false;
      p.driftScore = 0;
      p.driftMeter = 0;
    }
  }

  // 6. RACING LINE & GEOMETRIC APEX CUTTING (Shortens path length)
  const turnDirection = Math.sign(currentTangent.x * nextTangent.z - currentTangent.z * nextTangent.x);
  if (Math.abs(turnDirection) > 0.05) {
    // Hug the inside apex based on tightness
    aiState.targetLateralOffset = turnDirection * -cfg.apexTightness;
  } else {
    // On straights, center or weave slightly to draft
    if (isChasing && gapMeters < 50) {
      aiState.targetLateralOffset = 0.5; // Stay directly in slipstream line
    } else {
      aiState.targetLateralOffset = Math.sin(currentU * Math.PI * 6) * (aiState.difficulty === "easy" ? 2.2 : 0.8);
    }
  }
  const lerpSpeed = aiState.difficulty === "god" || aiState.difficulty === "apex" ? 5.5 : 3.2;
  aiState.lateralOffset = THREE.MathUtils.lerp(aiState.lateralOffset, aiState.targetLateralOffset, lerpSpeed * dt);

  // 7. ADVANCE POSITION ALONG SPLINE
  // Distance traveled = speed * dt
  const advanceDist = aiState.currentSpeed * dt;
  const deltaU = advanceDist / trackLength;
  const previousU = aiState.u;
  aiState.u += deltaU;

  // Track position
  const loopU = ((aiState.u % 1.0) + 1.0) % 1.0;
  const centerPoint = trackCurve.getPointAt(loopU);
  const trackTangent = trackCurve.getTangentAt(loopU).normalize();
  const trackNormal = new THREE.Vector3(-trackTangent.z, 0, trackTangent.x);

  // Offset point
  const actualPos = centerPoint.clone().add(trackNormal.clone().multiplyScalar(aiState.lateralOffset));
  p.x = actualPos.x;
  p.y = 0;
  p.z = actualPos.z;

  // Rotation aligns with track tangent plus steering/drift
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

  // Ensure lap reflects continuous progress
  if (!p.finished) {
    p.lap = Math.min(3, Math.floor(aiState.u) + 1);
  }

  return {
    ...aiState,
    player: p,
  };
}

export interface StandingsResult {
  playerPlace: 1 | 2;
  aiPlace: 1 | 2;
  gapMeters: number;
  leadPlayerName: string;
  isLapping: boolean;
  lapsDifference: number;
  playerProgress: number;
  aiProgress: number;
}

/**
 * Calculates accurate race positions (1st vs 2nd place)
 * by comparing total continuous progress (3 full laps = 3.0)
 * Handles all edge cases: lapping, finish-line transitions, and lead distance.
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
  // 1. Calculate continuous Player progress (0.00 to 3.00)
  let playerProgress: number;
  if (player.finished) {
    playerProgress = 3.0;
  } else {
    const rawU = ((playerU % 1.0) + 1.0) % 1.0;
    const baseLap = Math.max(1, Math.min(3, player.lap));
    
    // Smooth out checkpoint/lap transition near the finish line (u=0.0 / CP 0)
    if (player.checkpoint >= 3 && rawU < 0.2) {
      // Player crossed the finish line into next lap
      playerProgress = baseLap + rawU;
    } else if (player.checkpoint === 0 && rawU > 0.8) {
      // Player is just before finish line
      playerProgress = (baseLap - 1) + rawU;
    } else {
      playerProgress = (baseLap - 1) + rawU;
    }
    playerProgress = Math.max(0, Math.min(3.0, playerProgress));
  }

  // 2. Calculate continuous AI progress (0.00 to 3.00)
  let aiProgress: number;
  if (aiPlayer.finished) {
    aiProgress = 3.0;
  } else {
    aiProgress = Math.max(0, Math.min(3.0, aiTotalU));
  }

  // 3. If both drivers finished, final finishTime dictates victory
  if (player.finished && aiPlayer.finished) {
    const playerWon = (player.finishTime || 0) <= (aiPlayer.finishTime || 0);
    const timeDeltaMs = Math.abs((player.finishTime || 0) - (aiPlayer.finishTime || 0));
    const approxDist = Math.round((timeDeltaMs / 1000) * 28);
    return {
      playerPlace: playerWon ? 1 : 2,
      aiPlace: playerWon ? 2 : 1,
      gapMeters: Math.max(2, approxDist),
      leadPlayerName: playerWon ? player.name : aiPlayer.name,
      isLapping: false,
      lapsDifference: 0,
      playerProgress: 3.0,
      aiProgress: 3.0,
    };
  }

  // 4. If human player finished first
  if (player.finished && !aiPlayer.finished) {
    const remainingToComplete = Math.max(0.01, 3.0 - aiProgress);
    const gapMeters = Math.round(remainingToComplete * trackLength);
    return {
      playerPlace: 1,
      aiPlace: 2,
      gapMeters,
      leadPlayerName: player.name,
      isLapping: remainingToComplete >= 0.85,
      lapsDifference: Math.floor(remainingToComplete),
      playerProgress: 3.0,
      aiProgress,
    };
  }

  // 5. If AI rival finished first
  if (!player.finished && aiPlayer.finished) {
    const remainingToComplete = Math.max(0.01, 3.0 - playerProgress);
    const gapMeters = Math.round(remainingToComplete * trackLength);
    return {
      playerPlace: 2,
      aiPlace: 1,
      gapMeters,
      leadPlayerName: aiPlayer.name,
      isLapping: remainingToComplete >= 0.85,
      lapsDifference: Math.floor(remainingToComplete),
      playerProgress,
      aiProgress: 3.0,
    };
  }

  // 6. Active racing progress comparison
  const progressDelta = playerProgress - aiProgress;
  const playerAhead = progressDelta >= 0;
  const absDelta = Math.abs(progressDelta);
  const gapMeters = Math.round(absDelta * trackLength);
  const lapsDifference = Math.floor(absDelta);
  const isLapping = absDelta >= 0.85;

  return {
    playerPlace: playerAhead ? 1 : 2,
    aiPlace: playerAhead ? 2 : 1,
    gapMeters,
    leadPlayerName: playerAhead ? player.name : aiPlayer.name,
    isLapping,
    lapsDifference,
    playerProgress,
    aiProgress,
  };
}

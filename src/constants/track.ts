import * as THREE from "three";

export interface OnRoadResult {
  isOnRoad: boolean;
  distance: number;
  closestPt: THREE.Vector3;
  u: number;
}

export interface TrackEnvironmentConfig {
  skyColorDark: string;
  skyColorLight: string;
  roadColorDark: string;
  roadColorLight: string;
  curbColor: string;
  laserLeft: string;
  laserRight: string;
  gridColorDark: string;
  gridColorLight: string;
  ambientColorDark: string;
  ambientColorLight: string;
  sunColorDark: string;
  sunColorLight: string;
  dustColor: string;
  fogDensity?: number;
}

export interface TrackConfig {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
  lengthKm: string;
  turnCount: number;
  themeColor: string;
  badgeBg: string;
  points: THREE.Vector3[];
  curve: THREE.CatmullRomCurve3;
  roadWidth: number;
  checkpointCount: number;
  viewBox: string;
  environment: TrackEnvironmentConfig;
  checkOnRoad: (point: THREE.Vector3) => OnRoadResult;
}

/**
 * Creates an optimized OnRoad collision checker for a track curve
 */
function createOnRoadChecker(
  curve: THREE.CatmullRomCurve3,
  roadWidth: number,
  samplesCount: number = 220
) {
  // Precompute sample points along the curve for fast lookup
  const samples: { u: number; pt: THREE.Vector3 }[] = [];
  for (let i = 0; i <= samplesCount; i++) {
    const u = i / samplesCount;
    samples.push({ u, pt: curve.getPointAt(u) });
  }

  return function checkOnRoad(point: THREE.Vector3): OnRoadResult {
    let minDistance = Infinity;
    let closestPt = samples[0].pt;
    let closestU = 0;
    let bestSampleIdx = 0;

    for (let i = 0; i < samples.length; i++) {
      const dist = point.distanceTo(samples[i].pt);
      if (dist < minDistance) {
        minDistance = dist;
        closestPt = samples[i].pt;
        closestU = samples[i].u;
        bestSampleIdx = i;
      }
    }

    // Fine-tune with local subdivision search
    const step = 1 / samplesCount;
    const fineStart = Math.max(0, closestU - step);
    const fineEnd = Math.min(1, closestU + step);
    const fineSteps = 8;
    for (let j = 0; j <= fineSteps; j++) {
      const u = fineStart + (j / fineSteps) * (fineEnd - fineStart);
      const pt = curve.getPointAt(u);
      const dist = point.distanceTo(pt);
      if (dist < minDistance) {
        minDistance = dist;
        closestPt = pt;
        closestU = u;
      }
    }

    return {
      isOnRoad: minDistance <= roadWidth / 2,
      distance: minDistance,
      closestPt,
      u: closestU,
    };
  };
}

/**
 * Helper factory to build a TrackConfig
 */
function defineTrack(options: {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
  lengthKm: string;
  turnCount: number;
  themeColor: string;
  badgeBg: string;
  points: THREE.Vector3[];
  roadWidth?: number;
  checkpointCount?: number;
  viewBox: string;
  environment: TrackEnvironmentConfig;
}): TrackConfig {
  const curve = new THREE.CatmullRomCurve3(options.points, true);
  const roadWidth = options.roadWidth ?? 24;
  const checkpointCount = options.checkpointCount ?? 5;
  const checkOnRoad = createOnRoadChecker(curve, roadWidth);

  return {
    ...options,
    curve,
    roadWidth,
    checkpointCount,
    checkOnRoad,
  };
}

// ============================================================================
// 1. TRACK 1: NEON METROPOLIS (Balanced City Circuit)
// ============================================================================
const NEON_METROPOLIS_POINTS = [
  new THREE.Vector3(0, 0, 0),       // 0: Start/Finish Straight
  new THREE.Vector3(0, 0, 120),     // 1: Straightaway Exit
  new THREE.Vector3(40, 0, 220),    // 2: Sweeping Left Turn
  new THREE.Vector3(120, 0, 280),   // 3: Corner Apex
  new THREE.Vector3(260, 0, 260),   // 4: S-Curve Entrance
  new THREE.Vector3(280, 0, 140),   // 5: Hairpin Apex
  new THREE.Vector3(200, 0, 80),    // 6: Chicane Left
  new THREE.Vector3(120, 0, -40),   // 7: Chicane Right
  new THREE.Vector3(0, 0, -80),     // 8: Back Straight
  new THREE.Vector3(-100, 0, -100), // 9: Outer Hairpin
  new THREE.Vector3(-140, 0, -20),  // 10: Exit Turn
  new THREE.Vector3(-60, 0, 20),    // 11: Final Chicane
];

export const TRACK_NEON_METROPOLIS = defineTrack({
  id: "neon_metropolis",
  name: "Neon Metropolis",
  subtitle: "Downtown Grid & Cyber Chicanes",
  description: "Balanced urban circuit with sweeping neon corners, technical switchback chicanes, and a wide main straightaway.",
  difficulty: "Medium",
  lengthKm: "1.85 km",
  turnCount: 8,
  themeColor: "#6366f1",
  badgeBg: "rgba(99, 102, 241, 0.15)",
  points: NEON_METROPOLIS_POINTS,
  roadWidth: 24,
  checkpointCount: 5,
  viewBox: "-165 -125 470 435",
  environment: {
    skyColorDark: "#0c0f1a",
    skyColorLight: "#f1f5f9",
    roadColorDark: "#111827",
    roadColorLight: "#334155",
    curbColor: "#ef4444",
    laserLeft: "#ec4899",
    laserRight: "#06b6d4",
    gridColorDark: "#1e1b4b",
    gridColorLight: "#cbd5e1",
    ambientColorDark: "#4f46e5",
    ambientColorLight: "#ffffff",
    sunColorDark: "#3b82f6",
    sunColorLight: "#38bdf8",
    dustColor: "#9333ea",
  },
});

// ============================================================================
// 2. TRACK 2: VOLCANIC RIDGE (Technical Mountain S-Curves & Hairpins)
// ============================================================================
const VOLCANIC_RIDGE_POINTS = [
  new THREE.Vector3(0, 0, 0),         // 0: Start / Valley Straight
  new THREE.Vector3(0, 0, 130),       // 1: Straight into climb
  new THREE.Vector3(-60, 0, 210),     // 2: Sharp uphill left
  new THREE.Vector3(-140, 0, 190),    // 3: Ridge crest turn
  new THREE.Vector3(-180, 0, 90),     // 4: Mountain Hairpin 1
  new THREE.Vector3(-110, 0, 10),     // 5: Switchback descent
  new THREE.Vector3(-160, 0, -80),    // 6: Canyon hairpin 2
  new THREE.Vector3(-90, 0, -170),    // 7: Gorge entrance
  new THREE.Vector3(30, 0, -200),     // 8: Lower basin sweep
  new THREE.Vector3(140, 0, -160),    // 9: Lava lake bend
  new THREE.Vector3(190, 0, -60),     // 10: East mountain apex
  new THREE.Vector3(160, 0, 60),      // 11: High-speed S-turn right
  new THREE.Vector3(70, 0, 110),      // 12: High-speed S-turn left
  new THREE.Vector3(20, 0, 20),       // 13: Final home stretch chicane
];

export const TRACK_VOLCANIC_RIDGE = defineTrack({
  id: "volcanic_ridge",
  name: "Volcanic Ridge",
  subtitle: "Alpine S-Curves & Hairpin Climbs",
  description: "Treacherous mountain pass with twin switchback hairpins, sharp elevation curves, and high-G drift sectors.",
  difficulty: "Hard",
  lengthKm: "2.35 km",
  turnCount: 11,
  themeColor: "#f97316",
  badgeBg: "rgba(249, 115, 22, 0.15)",
  points: VOLCANIC_RIDGE_POINTS,
  roadWidth: 24,
  checkpointCount: 5,
  viewBox: "-210 -225 435 465",
  environment: {
    skyColorDark: "#150a08",
    skyColorLight: "#fff7ed",
    roadColorDark: "#1c1917",
    roadColorLight: "#44403c",
    curbColor: "#f59e0b",
    laserLeft: "#ef4444",
    laserRight: "#f97316",
    gridColorDark: "#451a03",
    gridColorLight: "#fdba74",
    ambientColorDark: "#7c2d12",
    ambientColorLight: "#fffbeb",
    sunColorDark: "#dc2626",
    sunColorLight: "#ea580c",
    dustColor: "#f97316",
  },
});

// ============================================================================
// 3. TRACK 3: QUANTUM SPEEDWAY (High-Velocity Tri-Oval & Banked Sweepers)
// ============================================================================
const QUANTUM_SPEEDWAY_POINTS = [
  new THREE.Vector3(0, 0, 0),         // 0: Start / Main Super Straight
  new THREE.Vector3(0, 0, 160),       // 1: Speed Trap Sector
  new THREE.Vector3(50, 0, 260),      // 2: Turn 1 Entry Arc
  new THREE.Vector3(150, 0, 280),     // 3: Turn 1 Apex
  new THREE.Vector3(230, 0, 210),     // 4: Turn 1-2 Banked Exit
  new THREE.Vector3(250, 0, 80),      // 5: Back Straightaway
  new THREE.Vector3(250, 0, -60),     // 6: Back Straight Exit
  new THREE.Vector3(190, 0, -170),    // 7: Turn 3 Sweeper Entry
  new THREE.Vector3(80, 0, -210),     // 8: Turn 3 Apex
  new THREE.Vector3(-40, 0, -160),    // 9: Turn 4 Banked Exit
  new THREE.Vector3(-55, 0, -60),     // 10: Quad-Oval Dogleg
];

export const TRACK_QUANTUM_SPEEDWAY = defineTrack({
  id: "quantum_speedway",
  name: "Quantum Speedway",
  subtitle: "High-Velocity Tri-Oval & Banked Sweepers",
  description: "Aerodynamic quantum test facility engineered for maximum top speed, extended nitro straights, and continuous power drifts.",
  difficulty: "Easy",
  lengthKm: "1.55 km",
  turnCount: 4,
  themeColor: "#10b981",
  badgeBg: "rgba(16, 185, 129, 0.15)",
  points: QUANTUM_SPEEDWAY_POINTS,
  roadWidth: 26,
  checkpointCount: 5,
  viewBox: "-85 -235 365 545",
  environment: {
    skyColorDark: "#061814",
    skyColorLight: "#f0fdf4",
    roadColorDark: "#06251f",
    roadColorLight: "#134e4a",
    curbColor: "#10b981",
    laserLeft: "#10b981",
    laserRight: "#06b6d4",
    gridColorDark: "#064e3b",
    gridColorLight: "#6ee7b7",
    ambientColorDark: "#047857",
    ambientColorLight: "#f0fdfa",
    sunColorDark: "#059669",
    sunColorLight: "#34d399",
    dustColor: "#10b981",
  },
});

// Registry of available tracks
export const TRACKS: Record<string, TrackConfig> = {
  neon_metropolis: TRACK_NEON_METROPOLIS,
  volcanic_ridge: TRACK_VOLCANIC_RIDGE,
  quantum_speedway: TRACK_QUANTUM_SPEEDWAY,
};

export const TRACK_LIST: TrackConfig[] = [
  TRACK_NEON_METROPOLIS,
  TRACK_VOLCANIC_RIDGE,
  TRACK_QUANTUM_SPEEDWAY,
];

export const DEFAULT_TRACK_ID = "neon_metropolis";

export function getTrack(id?: string): TrackConfig {
  if (id && TRACKS[id]) {
    return TRACKS[id];
  }
  return TRACK_NEON_METROPOLIS;
}

// Backward-compatibility exports for default track
export const TRACK_POINTS = TRACK_NEON_METROPOLIS.points;
export const TRACK_CURVE = TRACK_NEON_METROPOLIS.curve;
export const ROAD_WIDTH = TRACK_NEON_METROPOLIS.roadWidth;
export const CHECKPOINT_COUNT = TRACK_NEON_METROPOLIS.checkpointCount;
export const checkOnRoad = TRACK_NEON_METROPOLIS.checkOnRoad;

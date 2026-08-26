import * as THREE from "three";

// Definitions of track spline points on the XZ plane (Y = 0)
export const TRACK_POINTS = [
  new THREE.Vector3(0, 0, 0),       // 0: Start/Finish
  new THREE.Vector3(0, 0, 120),     // 1: Straightaway
  new THREE.Vector3(40, 0, 220),    // 2: Sweeping Left Turn
  new THREE.Vector3(120, 0, 280),   // 3: Corner
  new THREE.Vector3(260, 0, 260),   // 4: S-Curve Entrance
  new THREE.Vector3(280, 0, 140),   // 5: Hairpin Apex
  new THREE.Vector3(200, 0, 80),    // 6: Chicane Left
  new THREE.Vector3(120, 0, -40),   // 7: Chicane Right
  new THREE.Vector3(0, 0, -80),     // 8: Back Straight
  new THREE.Vector3(-100, 0, -100), // 9: Outer Hairpin
  new THREE.Vector3(-140, 0, -20),  // 10: Exit turn
  new THREE.Vector3(-60, 0, 20),    // 11: Final chicane
];

export const TRACK_CURVE = new THREE.CatmullRomCurve3(TRACK_POINTS, true);
export const ROAD_WIDTH = 24; // Road width in meters
export const CHECKPOINT_COUNT = 5; // Divide track curve into 5 checkpoints

export interface OnRoadResult {
  isOnRoad: boolean;
  distance: number;
  closestPt: THREE.Vector3;
  u: number;
}

/**
 * Check if a point is on the road within road width bounds
 */
export function checkOnRoad(point: THREE.Vector3): OnRoadResult {
  let minDistance = Infinity;
  const closestPt = new THREE.Vector3();
  let closestU = 0;

  const PATH_SAMPLES = 200;
  for (let i = 0; i <= PATH_SAMPLES; i++) {
    const u = i / PATH_SAMPLES;
    const pt = TRACK_CURVE.getPointAt(u);
    const dist = point.distanceTo(pt);
    if (dist < minDistance) {
      minDistance = dist;
      closestPt.copy(pt);
      closestU = u;
    }
  }

  return {
    isOnRoad: minDistance <= ROAD_WIDTH / 2,
    distance: minDistance,
    closestPt,
    u: closestU,
  };
}

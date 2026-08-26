import * as THREE from "three";
import { TrafficVehicle, TrafficVehicleType } from "../types";

export const TRAFFIC_LANES = [-6.2, -2.5, 2.5, 6.2]; // 4 distinct highway lanes

const TRAFFIC_COLORS: Record<TrafficVehicleType, string[]> = {
  sedan: ["#64748b", "#3b82f6", "#ef4444", "#f8fafc", "#0f172a", "#10b981", "#8b5cf6"],
  van: ["#f8fafc", "#334155", "#0284c7", "#f59e0b", "#475569"],
  truck: ["#dc2626", "#2563eb", "#d97706", "#16a34a", "#475569"],
  taxi: ["#eab308"],
  suv: ["#0f172a", "#475569", "#047857", "#b91c1c", "#1e3a8a", "#e2e8f0"],
};

const TRAFFIC_NAMES: Record<TrafficVehicleType, string[]> = {
  sedan: ["City Sedan", "Metro Coupe", "Pulse Cruiser", "Aero Compact", "Drift Sedan"],
  van: ["Express Delivery", "Cargo Master", "Transit Van", "Postal Service", "Urban Courier"],
  truck: ["Freight Hauler", "Heavy Rig", "Titan Carrier", "Continental Haul", "Road Train"],
  taxi: ["Metro Cab", "City Taxi", "Yellow Cab", "Urban Dispatch"],
  suv: ["Trail Blazer", "Summit 4x4", "Ridge Runner", "Apex Patrol", "Vanguard SUV"],
};

const VEHICLE_TYPES_DISTRIBUTION: TrafficVehicleType[] = [
  "sedan",
  "suv",
  "taxi",
  "sedan",
  "van",
  "truck",
  "sedan",
  "suv",
];

export interface TrafficPreset {
  count: number;
  label: string;
  description: string;
  badge: string;
}

export const TRAFFIC_PRESETS: Record<string, TrafficPreset> = {
  off: { count: 0, label: "No Traffic", description: "Empty circuit track. Clear road ahead.", badge: "OFF" },
  light: { count: 4, label: "Light Traffic", description: "A few cruising commuters scattered around the track.", badge: "LIGHT" },
  medium: { count: 8, label: "Moderate Highway", description: "Steady 4-lane commuter flow with delivery vans and taxis.", badge: "BALANCED" },
  heavy: { count: 14, label: "Dense Commute", description: "Busy highway conditions requiring high-speed weaving and dodging.", badge: "DENSE" },
  rush_hour: { count: 20, label: "Rush Hour Chaos", description: "Maximum vehicle density. Pure reflex arcade racing!", badge: "EXTREME" },
};

/**
 * Procedurally generates N traffic vehicles distributed across lanes along the track spline.
 */
export function generateTrafficVehicles(
  count: number,
  trackCurve: THREE.CatmullRomCurve3,
  roadWidth: number = 24
): TrafficVehicle[] {
  if (count <= 0) return [];

  const vehicles: TrafficVehicle[] = [];
  const startU = 0.09; // Keep starting grid clear of parked civilian cars
  const usableTrackRange = 0.88;
  const step = usableTrackRange / count;

  for (let i = 0; i < count; i++) {
    const u = (startU + i * step + (Math.sin(i * 3.7) * 0.5 + 0.5) * step * 0.7) % 1.0;
    const type = VEHICLE_TYPES_DISTRIBUTION[i % VEHICLE_TYPES_DISTRIBUTION.length];
    const colors = TRAFFIC_COLORS[type];
    const color = colors[i % colors.length];
    const names = TRAFFIC_NAMES[type];
    const name = names[i % names.length];

    // Pick lane (-6.2, -2.5, 2.5, 6.2) with slight organic shift
    const laneIdx = (i * 2 + (i % 3)) % TRAFFIC_LANES.length;
    const laneOffset = TRAFFIC_LANES[laneIdx];
    const lateralShift = laneOffset + (Math.sin(i * 4.1) * 0.4);

    // Speed by vehicle class
    let baseSpeed = 36;
    if (type === "truck") baseSpeed = 26 + (i % 3) * 3;
    else if (type === "van") baseSpeed = 30 + (i % 4) * 3;
    else if (type === "taxi") baseSpeed = 40 + (i % 3) * 4;
    else if (type === "suv") baseSpeed = 35 + (i % 4) * 3;
    else baseSpeed = 36 + (i % 5) * 3;

    // Evaluate initial 3D pose
    const centerPoint = trackCurve.getPointAt(u);
    const tangent = trackCurve.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const pos = centerPoint.clone().add(normal.multiplyScalar(lateralShift));
    const rotationY = Math.atan2(tangent.x, tangent.z);

    vehicles.push({
      id: `traffic_${i + 1}`,
      type,
      name: `${name} #${i + 1}`,
      color,
      x: pos.x,
      y: 0,
      z: pos.z,
      rotationY,
      speed: baseSpeed,
      u,
      lateralOffset: lateralShift,
      targetLateralOffset: lateralShift,
      targetSpeed: baseSpeed,
      lane: laneIdx,
      laneChangeTimer: 5.0 + (i * 2.3) % 10.0,
      length: type === "truck" ? 7.8 : type === "van" ? 6.2 : 5.4,
      width: type === "truck" ? 3.0 : 2.7,
    });
  }

  return vehicles;
}

/**
 * Updates simulation for all traffic vehicles:
 * - Constant spline advancement along the track.
 * - Lane-keeping and periodic organic lane changes into open gaps.
 * - Anti-collision distance governor (traffic slows down if another vehicle is right ahead in the same lane).
 * - Smooth steering yaw alignment with track curves.
 */
export function updateTrafficSimulation(
  vehicles: TrafficVehicle[],
  dt: number,
  trackCurve: THREE.CatmullRomCurve3,
  trackLength: number,
  raceStatus: "lobby" | "countdown" | "racing" | "results"
): TrafficVehicle[] {
  if (vehicles.length === 0) return vehicles;

  const isMoving = raceStatus === "racing";

  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];

    if (!isMoving) {
      // Stationary or creeping on grid
      const loopU = ((v.u % 1.0) + 1.0) % 1.0;
      const centerPoint = trackCurve.getPointAt(loopU);
      const tangent = trackCurve.getTangentAt(loopU).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const pos = centerPoint.clone().add(normal.multiplyScalar(v.lateralOffset));

      v.x = pos.x;
      v.z = pos.z;
      v.rotationY = Math.atan2(tangent.x, tangent.z);
      continue;
    }

    // 1. Check for traffic ahead in the same lane (Anti-collision cruising governor)
    let obstacleAhead = false;
    let distanceToObstacle = 999;

    for (let j = 0; j < vehicles.length; j++) {
      if (i === j) continue;
      const other = vehicles[j];

      // Lateral overlap check
      if (Math.abs(v.lateralOffset - other.lateralOffset) < 2.4) {
        // Spline distance along track ahead
        let diffU = other.u - v.u;
        while (diffU < 0) diffU += 1.0;
        const distMeters = diffU * trackLength;

        if (distMeters > 0 && distMeters < 25) {
          obstacleAhead = true;
          if (distMeters < distanceToObstacle) {
            distanceToObstacle = distMeters;
          }
        }
      }
    }

    // Speed Governor
    let effectiveTargetSpeed = v.targetSpeed;
    if (obstacleAhead && distanceToObstacle < 18) {
      // Brake smoothly to match lead vehicle or cushion distance
      effectiveTargetSpeed = Math.max(16, v.targetSpeed * (distanceToObstacle / 20));
    }

    // Accelerate / Decelerate smoothly
    if (v.speed < effectiveTargetSpeed) {
      v.speed = Math.min(v.speed + 12.0 * dt, effectiveTargetSpeed);
    } else if (v.speed > effectiveTargetSpeed) {
      v.speed = Math.max(v.speed - 22.0 * dt, effectiveTargetSpeed);
    }

    // 2. Autonomous Lane Changing Logic
    v.laneChangeTimer -= dt;
    if (v.laneChangeTimer <= 0) {
      v.laneChangeTimer = 8.0 + Math.random() * 12.0;

      // Pick an adjacent lane
      const currentLane = v.lane;
      const candidates: number[] = [];
      if (currentLane > 0) candidates.push(currentLane - 1);
      if (currentLane < TRAFFIC_LANES.length - 1) candidates.push(currentLane + 1);

      if (candidates.length > 0) {
        const nextLane = candidates[Math.floor(Math.random() * candidates.length)];
        const nextOffset = TRAFFIC_LANES[nextLane];

        // Ensure lane is clear before moving
        let isLaneClear = true;
        for (let j = 0; j < vehicles.length; j++) {
          if (i === j) continue;
          const other = vehicles[j];
          if (Math.abs(other.lateralOffset - nextOffset) < 2.0) {
            let diffU = Math.abs(other.u - v.u);
            if (diffU > 0.5) diffU = 1.0 - diffU;
            if (diffU * trackLength < 20) {
              isLaneClear = false;
              break;
            }
          }
        }

        if (isLaneClear) {
          v.lane = nextLane;
          v.targetLateralOffset = nextOffset + (Math.sin(v.u * 12.0) * 0.25);
        }
      }
    }

    // Smooth lateral lane transition
    v.lateralOffset = THREE.MathUtils.lerp(
      v.lateralOffset,
      v.targetLateralOffset,
      Math.min(1.8 * dt, 1)
    );

    // 3. Advance along spline
    const advanceDist = v.speed * dt;
    v.u = (v.u + advanceDist / trackLength) % 1.0;

    // 4. Update 3D World Position
    const centerPoint = trackCurve.getPointAt(v.u);
    const tangent = trackCurve.getTangentAt(v.u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const actualPos = centerPoint.clone().add(normal.multiplyScalar(v.lateralOffset));

    v.x = actualPos.x;
    v.z = actualPos.z;

    const targetHeading = Math.atan2(tangent.x, tangent.z);
    let angleDiff = targetHeading - v.rotationY;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    v.rotationY += angleDiff * Math.min(10 * dt, 1);
  }

  return vehicles;
}

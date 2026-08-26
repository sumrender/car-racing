import * as THREE from "three";

export interface SpeedBreaker {
  id: string;
  u: number;
  center: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  rotationY: number;
  width: number;
  length: number;
  height: number;
}

export interface CarJumpState {
  y: number;
  vy: number;
  pitch: number;
  isAirborne: boolean;
  airTime: number;
  lastBreakerId: string | null;
  lastBreakerCooldown: number;
}

/**
 * Returns strategic track progress positions for N speed breakers (1 to 10).
 * Spread strategically along straights and fast approach sectors while keeping clear of the start/finish line.
 */
export function getSpeedBreakerPositions(count: number): number[] {
  if (count <= 0) return [];

  const curatedPresets: Record<number, number[]> = {
    1: [0.52], // Back straightaway
    2: [0.28, 0.72],
    3: [0.18, 0.52, 0.82],
    4: [0.14, 0.38, 0.62, 0.85],
    5: [0.12, 0.28, 0.48, 0.68, 0.88],
    6: [0.10, 0.24, 0.40, 0.56, 0.70, 0.86],
    7: [0.09, 0.22, 0.35, 0.48, 0.61, 0.74, 0.87],
    8: [0.08, 0.19, 0.31, 0.43, 0.55, 0.67, 0.79, 0.91],
    9: [0.07, 0.17, 0.27, 0.37, 0.48, 0.59, 0.69, 0.80, 0.91],
    10: [0.06, 0.15, 0.24, 0.34, 0.44, 0.54, 0.64, 0.74, 0.84, 0.93],
  };

  if (curatedPresets[count]) {
    return curatedPresets[count];
  }

  // Fallback for custom counts
  const list: number[] = [];
  const startU = 0.08;
  const endU = 0.94;
  const step = (endU - startU) / count;
  for (let i = 0; i < count; i++) {
    list.push(Number((startU + i * step + step * 0.5).toFixed(3)));
  }
  return list;
}

/**
 * Builds the geometric data for speed breakers placed on the track curve.
 */
export function generateSpeedBreakers(
  count: number,
  trackCurve: THREE.CatmullRomCurve3,
  roadWidth: number = 24
): SpeedBreaker[] {
  const uList = getSpeedBreakerPositions(count);

  return uList.map((u, idx) => {
    const center = trackCurve.getPointAt(u);
    const tangent = trackCurve.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const rotationY = Math.atan2(tangent.x, tangent.z);

    return {
      id: `breaker_${idx + 1}`,
      u,
      center,
      tangent,
      normal,
      rotationY,
      width: roadWidth - 1.2, // spans road between curbs
      length: 4.8, // 4.8 meters long
      height: 0.52, // 52cm apex height
    };
  });
}

/**
 * Creates high-visibility procedural striped canvas texture for the speed breaker ramp.
 */
function createHazardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  // Bright safety yellow base
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(0, 0, 512, 128);

  // Bold diagonal pitch-black hazard chevron stripes
  ctx.fillStyle = "#0f172a";
  const stripeWidth = 36;
  const total = 512 + 128;
  for (let x = -128; x < total; x += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeWidth, 0);
    ctx.lineTo(x + stripeWidth + 48, 128);
    ctx.lineTo(x + 48, 128);
    ctx.closePath();
    ctx.fill();
  }

  // High contrast reflective border strips
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 512, 6);
  ctx.fillRect(0, 122, 512, 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(3, 1);
  return texture;
}

let cachedHazardTexture: THREE.CanvasTexture | null = null;

/**
 * Constructs a 3D visual mesh group for a speed breaker with hazard markings,
 * curb warning bollards, and glowing reflective cat-eyes.
 */
export function buildSpeedBreakerMesh(breaker: SpeedBreaker, isDark: boolean): THREE.Group {
  if (!cachedHazardTexture) {
    cachedHazardTexture = createHazardTexture();
  }

  const group = new THREE.Group();
  group.position.copy(breaker.center);
  group.rotation.y = breaker.rotationY;

  // 1. Arched 3D Speed Hump Geometry (convex curved ramp)
  const segmentsX = 24;
  const segmentsZ = 12;
  const halfW = breaker.width / 2;
  const halfL = breaker.length / 2;

  const bumpGeo = new THREE.PlaneGeometry(breaker.width, breaker.length, segmentsX, segmentsZ);
  bumpGeo.rotateX(-Math.PI / 2);

  const posAttr = bumpGeo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const z = posAttr.getY(i) !== undefined ? posAttr.getZ(i) : 0;
    // Parabolic smooth dome curve along z (length)
    const normZ = z / halfL; // -1 to 1
    const factor = Math.max(0, 1 - normZ * normZ);
    // Slight lateral bevel taper near road curbs
    const x = posAttr.getX(i);
    const normX = Math.abs(x / halfW);
    const edgeTaper = normX > 0.85 ? Math.max(0, 1 - (normX - 0.85) / 0.15) : 1;

    posAttr.setY(i, factor * breaker.height * edgeTaper + 0.02);
  }
  bumpGeo.computeVertexNormals();

  const bumpMat = new THREE.MeshStandardMaterial({
    map: cachedHazardTexture,
    roughness: 0.45,
    metalness: 0.25,
    bumpScale: 0.05,
  });

  const bumpMesh = new THREE.Mesh(bumpGeo, bumpMat);
  group.add(bumpMesh);

  // 2. Asphalt Road Warning Chevrons (Approach warning painted on track)
  const chevronGeo = new THREE.PlaneGeometry(breaker.width * 0.85, 3.2);
  chevronGeo.rotateX(-Math.PI / 2);
  const chevronMat = new THREE.MeshBasicMaterial({
    color: "#eab308",
    transparent: true,
    opacity: isDark ? 0.35 : 0.45,
  });
  const chevronMesh1 = new THREE.Mesh(chevronGeo, chevronMat);
  chevronMesh1.position.set(0, 0.03, -breaker.length * 1.1);
  group.add(chevronMesh1);

  // 3. Side Hazard Warning Bollards / Reflective Sign Poles on Curbs
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.18, 2.6, 8);
  const poleMat = new THREE.MeshStandardMaterial({
    color: "#334155",
    roughness: 0.6,
  });

  const beaconGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.5, 8);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: "#f59e0b",
    emissive: "#d97706",
    emissiveIntensity: isDark ? 0.9 : 0.4,
    roughness: 0.2,
  });

  // Left Post
  const postLeft = new THREE.Mesh(poleGeo, poleMat);
  postLeft.position.set(-halfW - 0.7, 1.3, 0);
  const beaconLeft = new THREE.Mesh(beaconGeo, beaconMat);
  beaconLeft.position.set(0, 1.1, 0);
  postLeft.add(beaconLeft);
  group.add(postLeft);

  // Right Post
  const postRight = new THREE.Mesh(poleGeo, poleMat);
  postRight.position.set(halfW + 0.7, 1.3, 0);
  const beaconRight = new THREE.Mesh(beaconGeo, beaconMat);
  beaconRight.position.set(0, 1.1, 0);
  postRight.add(beaconRight);
  group.add(postRight);

  // 4. Amber Cat-Eye Embedded Reflectors along breaker ridge
  const catEyeGeo = new THREE.BoxGeometry(0.35, 0.12, 0.35);
  const catEyeMat = new THREE.MeshStandardMaterial({
    color: "#fbbf24",
    emissive: "#f59e0b",
    emissiveIntensity: 0.8,
  });

  const reflectorCount = 7;
  for (let r = 0; r < reflectorCount; r++) {
    const rx = -halfW * 0.8 + (r / (reflectorCount - 1)) * (halfW * 1.6);
    const catEye = new THREE.Mesh(catEyeGeo, catEyeMat);
    catEye.position.set(rx, breaker.height + 0.04, 0);
    group.add(catEye);
  }

  return group;
}

export interface SpeedBreakerPhysicsResult {
  y: number;
  vy: number;
  pitch: number;
  isAirborne: boolean;
  airTime: number;
  justLaunched: boolean;
  justLanded: boolean;
  jumpPeakAltitude: number;
  landingSpeedDampening: number;
  hitRumble: boolean;
}

/**
 * High-precision calculation of car suspension, ramp deflection, airborne hang-time,
 * and Need-for-Speed style high-speed forward trajectory over speed breakers.
 */
export function updateCarSpeedBreakerPhysics(
  carPos: { x: number; y: number; z: number },
  speed: number, // km/h
  dt: number,
  state: CarJumpState,
  breakers: SpeedBreaker[]
): SpeedBreakerPhysicsResult {
  let justLaunched = false;
  let justLanded = false;
  let hitRumble = false;
  const landingSpeedDampening = 1.0; // Need for Speed style: zero forward speed loss

  // Cool down cooldown timer
  if (state.lastBreakerCooldown > 0) {
    state.lastBreakerCooldown -= dt;
    if (state.lastBreakerCooldown <= 0) {
      state.lastBreakerCooldown = 0;
      state.lastBreakerId = null;
    }
  }

  // 1. Check interaction with each speed breaker
  if (breakers.length > 0) {
    const absSpeed = Math.abs(speed);
    // Dynamic trigger depth based on velocity to prevent high-speed tunneling
    const speedFrameMargin = (absSpeed / 3.6) * dt + 1.2;

    for (const b of breakers) {
      // Vector from breaker center to car
      const dx = carPos.x - b.center.x;
      const dz = carPos.z - b.center.z;

      // Project onto breaker coordinate frame
      // Longitudinal distance along track direction
      const distAlong = dx * b.tangent.x + dz * b.tangent.z;
      // Lateral distance across road
      const distAcross = dx * b.normal.x + dz * b.normal.z;

      const halfL = Math.max(3.2, b.length / 2 + speedFrameMargin);
      const halfW = b.width / 2 + 1.8;

      if (Math.abs(distAcross) <= halfW && Math.abs(distAlong) <= halfL) {
        // Car is inside speed breaker bounds!
        if (state.lastBreakerId !== b.id && state.lastBreakerCooldown <= 0) {
          hitRumble = true;

          // EVALUATE JUMP TRIGGER:
          // In Need for Speed, approaching at speeds > 30 km/h launches the vehicle into a thrilling jump
          if (absSpeed > 28 && !state.isAirborne) {
            // Speed-scaled launch vertical velocity
            // e.g. 45 km/h -> ~10 m/s, 70 km/h -> ~16 m/s, 100+ km/h -> ~22 m/s
            const launchIntensity = Math.min(1.4, (absSpeed - 28) / 60);
            const launchVy = 9.0 + launchIntensity * 13.5;

            state.vy = launchVy;
            state.isAirborne = true;
            state.airTime = 0.01;
            state.lastBreakerId = b.id;
            state.lastBreakerCooldown = 0.9;
            state.pitch = 0.14; // Initial nose-up pitch tilt
            justLaunched = true;
          } else if (absSpeed <= 28 && !state.isAirborne) {
            // Slow/moderate speed: smoothly track the physical dome of the hump
            const normAlong = distAlong / (b.length / 2);
            const humpHeight = Math.max(0, 1 - normAlong * normAlong) * b.height;
            state.y = Math.max(state.y, humpHeight);
            state.pitch = -normAlong * 0.08; // mild suspension tilt
          }
        }
        break;
      }
    }
  }

  // 2. AIRBORNE GRAVITY & TRAJECTORY SIMULATION
  if (state.isAirborne) {
    state.airTime += dt;
    const gravity = 30.0; // Responsive arcade flight gravity

    // Apply vertical displacement and velocity decay
    state.y += state.vy * dt - 0.5 * gravity * dt * dt;
    state.vy -= gravity * dt;

    // Aerodynamic Pitch: Nose tilts up on ascent (+X), levels and dips slightly forward on descent (-X)
    const targetPitch = THREE.MathUtils.clamp(state.vy * 0.012, -0.16, 0.16);
    state.pitch = THREE.MathUtils.lerp(state.pitch, targetPitch, Math.min(10 * dt, 1));

    // 3. TOUCHDOWN / GROUND COLLISION
    if (state.y <= 0) {
      state.y = 0;
      state.vy = 0;
      state.isAirborne = false;
      justLanded = true;

      // Suspension compression rebound (slight nose dip then rapid spring recovery)
      state.pitch = 0.04;
    }
  } else {
    // On the ground: settle pitch back to level 0 smoothly
    if (Math.abs(state.pitch) > 0.001) {
      state.pitch = THREE.MathUtils.lerp(state.pitch, 0, Math.min(16 * dt, 1));
    }
    if (state.y > 0) {
      state.y = THREE.MathUtils.lerp(state.y, 0, Math.min(18 * dt, 1));
      if (state.y < 0.01) state.y = 0;
    }
  }

  return {
    y: Math.max(0, state.y),
    vy: state.vy,
    pitch: state.pitch,
    isAirborne: state.isAirborne,
    airTime: state.airTime,
    justLaunched,
    justLanded,
    jumpPeakAltitude: state.y,
    landingSpeedDampening,
    hitRumble,
  };
}

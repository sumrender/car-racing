import * as THREE from "three";

export interface CarCollisionEntity {
  id: string;
  x: number;
  z: number;
  rotationY: number;
  speed: number;
  isLocalPlayer?: boolean;
  isAI?: boolean;
  isRemote?: boolean;
  isTraffic?: boolean;
  trafficIndex?: number;
  aiIndex?: number;
}

export interface CollisionResult {
  involvesLocalPlayer: boolean;
  intensity: number;
  contactPoint: THREE.Vector3;
  normal: THREE.Vector2;
}

// Multi-sphere longitudinal layout along car chassis length
const CAR_COLLIDER_OFFSETS = [-1.5, 0.0, 1.5]; // Rear, center, front
const CAR_COLLIDER_RADIUS = 1.45; // 2.9m effective physical width/diameter
const MIN_COLLISION_DISTANCE = CAR_COLLIDER_RADIUS * 2; // 2.9m

/**
 * Resolves physical collisions between cars (Local Player, AI Opponents, and Remote Players).
 * Applies realistic mass-conserving impulse momentum exchange, elastic body separation,
 * and tangential surface slide friction. Cars never snap or auto-align.
 */
export function resolveCarCollisions(
  cars: CarCollisionEntity[],
  onCollision?: (res: CollisionResult) => void
): void {
  if (cars.length < 2) return;

  const iterations = 2; // Iterative relaxation for clean multi-car cluster resolution

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const carA = cars[i];
        const carB = cars[j];

        // Skip two remote cars colliding with each other (their positions are network-authoritative)
        if (carA.isRemote && carB.isRemote) continue;

        let maxOverlap = 0;
        let collisionNx = 0;
        let collisionNz = 0;
        let contactX = 0;
        let contactZ = 0;
        let hasCollision = false;

        const sinA = Math.sin(carA.rotationY);
        const cosA = Math.cos(carA.rotationY);
        const sinB = Math.sin(carB.rotationY);
        const cosB = Math.cos(carB.rotationY);

        // Check all 3 bounding circles on Car A against all 3 bounding circles on Car B
        for (let a = 0; a < 3; a++) {
          const offA = CAR_COLLIDER_OFFSETS[a];
          const ax = carA.x + sinA * offA;
          const az = carA.z + cosA * offA;

          for (let b = 0; b < 3; b++) {
            const offB = CAR_COLLIDER_OFFSETS[b];
            const bx = carB.x + sinB * offB;
            const bz = carB.z + cosB * offB;

            const dx = ax - bx;
            const dz = az - bz;
            const distSq = dx * dx + dz * dz;

            if (distSq < MIN_COLLISION_DISTANCE * MIN_COLLISION_DISTANCE) {
              const dist = Math.max(Math.sqrt(distSq), 0.001);
              const overlap = MIN_COLLISION_DISTANCE - dist;

              if (overlap > maxOverlap) {
                maxOverlap = overlap;
                collisionNx = dx / dist; // Points from B toward A
                collisionNz = dz / dist;
                contactX = bx + collisionNx * (CAR_COLLIDER_RADIUS + overlap * 0.5);
                contactZ = bz + collisionNz * (CAR_COLLIDER_RADIUS + overlap * 0.5);
                hasCollision = true;
              }
            }
          }
        }

        if (hasCollision && maxOverlap > 0.002) {
          const isAStatic = !!carA.isRemote;
          const isBStatic = !!carB.isRemote;

          // 1. PHYSICAL POSITIONAL SEPARATION (Smooth mass-weighted de-penetration)
          const separationFactor = 0.55;
          if (isAStatic && !isBStatic) {
            carB.x -= collisionNx * maxOverlap * 1.01;
            carB.z -= collisionNz * maxOverlap * 1.01;
          } else if (!isAStatic && isBStatic) {
            carA.x += collisionNx * maxOverlap * 1.01;
            carA.z += collisionNz * maxOverlap * 1.01;
          } else {
            // Both dynamic: equal mass distribution
            const push = maxOverlap * separationFactor;
            carA.x += collisionNx * push;
            carA.z += collisionNz * push;
            carB.x -= collisionNx * push;
            carB.z -= collisionNz * push;
          }

          // 2. MOMENTUM & IMPULSE DYNAMICS (Calculated on first relaxation pass)
          if (iter === 0) {
            // Forward velocity vectors
            const vAx = sinA * carA.speed;
            const vAz = cosA * carA.speed;
            const vBx = sinB * carB.speed;
            const vBz = cosB * carB.speed;

            // Relative velocity along collision normal
            const relVelNormal = (vAx - vBx) * collisionNx + (vAz - vBz) * collisionNz;

            // If cars are moving toward each other along normal
            if (relVelNormal < 0) {
              const restitution = 0.35; // Modern vehicle chassis semi-elastic impact
              const normalImpulse = -(1 + restitution) * relVelNormal * 0.5;

              // Tangential sliding friction (allows smooth side-by-side grinds)
              const tangentX = -collisionNz;
              const tangentZ = collisionNx;
              const relVelTangent = (vAx - vBx) * tangentX + (vAz - vBz) * tangentZ;
              const frictionCoeff = 0.25;
              const frictionImpulse = -relVelTangent * frictionCoeff * 0.3;

              if (!isAStatic) {
                // Apply normal & tangential impulses to Car A
                const nextVAx = vAx + collisionNx * normalImpulse + tangentX * frictionImpulse;
                const nextVAz = vAz + collisionNz * normalImpulse + tangentZ * frictionImpulse;
                
                // Project resulting velocity along car heading (preserving forward drive)
                const forwardSpeedA = nextVAx * sinA + nextVAz * cosA;
                carA.speed = Math.max(forwardSpeedA, carA.speed * 0.75);

                // Subtle momentary yaw deflection from contact moment arm (smooth & life-like)
                const rxA = contactX - carA.x;
                const rzA = contactZ - carA.z;
                const torqueA = rxA * (collisionNz * normalImpulse) - rzA * (collisionNx * normalImpulse);
                carA.rotationY += THREE.MathUtils.clamp(torqueA * 0.0018, -0.06, 0.06);
              }

              if (!isBStatic) {
                // Apply normal & tangential impulses to Car B
                const nextVBx = vBx - collisionNx * normalImpulse - tangentX * frictionImpulse;
                const nextVBz = vBz - collisionNz * normalImpulse - tangentZ * frictionImpulse;
                
                // Project resulting velocity along car heading
                const forwardSpeedB = nextVBx * sinB + nextVBz * cosB;
                carB.speed = Math.max(forwardSpeedB, carB.speed * 0.75);

                // Subtle momentary yaw deflection from contact moment arm
                const rxB = contactX - carB.x;
                const rzB = contactZ - carB.z;
                const torqueB = -(rxB * (collisionNz * normalImpulse) - rzB * (collisionNx * normalImpulse));
                carB.rotationY += THREE.MathUtils.clamp(torqueB * 0.0018, -0.06, 0.06);
              }

              // Visual sparks & sound emission
              if (onCollision) {
                const intensity = Math.abs(relVelNormal);
                const involvesLocalPlayer = !!(carA.isLocalPlayer || carB.isLocalPlayer);
                onCollision({
                  involvesLocalPlayer,
                  intensity,
                  contactPoint: new THREE.Vector3(contactX, 0.35, contactZ),
                  normal: new THREE.Vector2(collisionNx, collisionNz),
                });
              }
            }
          }
        }
      }
    }
  }
}

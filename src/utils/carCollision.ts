import * as THREE from "three";

/**
 * Resolved impact information passed to polymorphic collidable entities.
 */
export interface CollisionImpact {
  x: number;
  z: number;
  rotationY: number;
  speed: number;
  displacementX: number;
  displacementZ: number;
  normalImpulse: number;
  tangentImpulse: number;
}

/**
 * Unified polymorphic interface for any collidable body in the race
 * (Local player, AI, Traffic, Obstacle, Remote network cars, etc.).
 * Satisfies Open-Closed Principle (OCP) and Liskov Substitution Principle (LSP).
 */
export interface ICollidableEntity {
  id: string;
  x: number;
  z: number;
  rotationY: number;
  speed: number;

  /**
   * Whether this entity is static/authoritative (e.g. remote network players whose position is server-driven).
   * Static entities impart impulse and separation to dynamic bodies without having their own state modified.
   */
  isStatic?: boolean;

  /**
   * Whether this entity represents local player perspective for triggering feedback (audio/particles).
   */
  isLocal?: boolean;

  /**
   * Optional custom radius (defaults to 1.45m).
   */
  colliderRadius?: number;

  /**
   * Polymorphic callback invoked when physical separation and impulse are resolved.
   * Eliminates the need for type discriminant flags and large if/else-if or switch dispatch blocks.
   */
  onCollisionResolved?(impact: CollisionImpact): void;
}

/** Backward compatibility alias */
export type CarCollisionEntity = ICollidableEntity;

export interface CollisionResult {
  involvesLocalPlayer: boolean;
  intensity: number;
  contactPoint: THREE.Vector3;
  normal: THREE.Vector2;
}

// Multi-sphere longitudinal layout along car chassis length
const DEFAULT_CAR_COLLIDER_OFFSETS = [-1.5, 0.0, 1.5]; // Rear, center, front
const DEFAULT_CAR_COLLIDER_RADIUS = 1.45; // 2.9m effective physical width/diameter

/**
 * Resolves physical collisions between any collidable entities (Local Player, AI Opponents, Traffic, Remote Players, Dynamic Obstacles).
 * Applies realistic mass-conserving impulse momentum exchange, elastic body separation,
 * and tangential surface slide friction. Operates purely through polymorphic spatial callbacks.
 */
export function resolveCarCollisions(
  entities: ICollidableEntity[],
  onCollision?: (res: CollisionResult) => void
): void {
  if (entities.length < 2) return;

  const iterations = 2; // Iterative relaxation for clean multi-car cluster resolution

  // Track initial positions to compute total displacement for polymorphic callbacks
  const initialPositions = new Map<string, { x: number; z: number; speed: number; rotationY: number }>();
  for (const ent of entities) {
    initialPositions.set(ent.id, {
      x: ent.x,
      z: ent.z,
      speed: ent.speed,
      rotationY: ent.rotationY,
    });
  }

  const impulseMap = new Map<string, { normalImpulse: number; tangentImpulse: number }>();

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const carA = entities[i];
        const carB = entities[j];

        // Skip two static/remote cars colliding with each other (their positions are network-authoritative)
        if (carA.isStatic && carB.isStatic) continue;

        const radiusA = carA.colliderRadius ?? DEFAULT_CAR_COLLIDER_RADIUS;
        const radiusB = carB.colliderRadius ?? DEFAULT_CAR_COLLIDER_RADIUS;
        const minDistance = radiusA + radiusB;

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

        // Check 3 bounding spheres on Car A against 3 bounding spheres on Car B
        for (let a = 0; a < 3; a++) {
          const offA = DEFAULT_CAR_COLLIDER_OFFSETS[a];
          const ax = carA.x + sinA * offA;
          const az = carA.z + cosA * offA;

          for (let b = 0; b < 3; b++) {
            const offB = DEFAULT_CAR_COLLIDER_OFFSETS[b];
            const bx = carB.x + sinB * offB;
            const bz = carB.z + cosB * offB;

            const dx = ax - bx;
            const dz = az - bz;
            const distSq = dx * dx + dz * dz;

            if (distSq < minDistance * minDistance) {
              const dist = Math.max(Math.sqrt(distSq), 0.001);
              const overlap = minDistance - dist;

              if (overlap > maxOverlap) {
                maxOverlap = overlap;
                collisionNx = dx / dist; // Points from B toward A
                collisionNz = dz / dist;
                contactX = bx + collisionNx * (radiusB + overlap * 0.5);
                contactZ = bz + collisionNz * (radiusB + overlap * 0.5);
                hasCollision = true;
              }
            }
          }
        }

        if (hasCollision && maxOverlap > 0.002) {
          const isAStatic = !!carA.isStatic;
          const isBStatic = !!carB.isStatic;

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

              impulseMap.set(carA.id, { normalImpulse, tangentImpulse: frictionImpulse });
              impulseMap.set(carB.id, { normalImpulse: -normalImpulse, tangentImpulse: -frictionImpulse });

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
                const involvesLocalPlayer = !!(carA.isLocal || carB.isLocal);
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

  // 3. POLYMORPHIC DISPATCH: Notify each entity of its updated position and impulse
  for (const ent of entities) {
    if (ent.onCollisionResolved) {
      const init = initialPositions.get(ent.id);
      const impulse = impulseMap.get(ent.id) ?? { normalImpulse: 0, tangentImpulse: 0 };
      ent.onCollisionResolved({
        x: ent.x,
        z: ent.z,
        rotationY: ent.rotationY,
        speed: ent.speed,
        displacementX: init ? ent.x - init.x : 0,
        displacementZ: init ? ent.z - init.z : 0,
        normalImpulse: impulse.normalImpulse,
        tangentImpulse: impulse.tangentImpulse,
      });
    }
  }
}

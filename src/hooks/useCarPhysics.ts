import { useRef, useEffect, useCallback, RefObject } from "react";
import * as THREE from "three";
import {
  ISoundManager,
  getSoundManager,
} from "../utils/soundManager";
import {
  updateCarSpeedBreakerPhysics,
  SpeedBreaker,
  CarJumpState,
} from "../utils/speedBreakers";
import {
  TRACK_CURVE,
  ROAD_WIDTH,
  CHECKPOINT_COUNT,
  checkOnRoad,
} from "../constants/track";

export interface CarPhysicsState {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
  driftScore: number;
  isDrifting: boolean;
  driftAngle: number;
  driftMeter: number;
  totalDriftScore: number;
  checkpoint: number;
  lap: number;
  finished: boolean;
  boostTimer: number;
  offRoadCoeff: number;
  lastCheckpointIndex: number;
}

export interface InputKeys {
  w: boolean;
  s: boolean;
  a: boolean;
  d: boolean;
  space: boolean;
  r: boolean;
}

interface UseCarPhysicsOptions {
  nitroOverlayRef?: RefObject<HTMLDivElement | null>;
  jumpOverlayRef?: RefObject<HTMLDivElement | null>;
  jumpAltitudeTextRef?: RefObject<HTMLSpanElement | null>;
  onFinish?: (finishTime: number) => void;
  soundManager?: ISoundManager;
}

const INITIAL_CAR_STATE: CarPhysicsState = {
  x: 0,
  y: 0,
  z: 0,
  rotationY: 0,
  speed: 0,
  driftScore: 0,
  isDrifting: false,
  driftAngle: 0,
  driftMeter: 0,
  totalDriftScore: 0,
  checkpoint: 0,
  lap: 1,
  finished: false,
  boostTimer: 0,
  offRoadCoeff: 1,
  lastCheckpointIndex: 0,
};

const INITIAL_JUMP_STATE: CarJumpState = {
  y: 0,
  vy: 0,
  pitch: 0,
  isAirborne: false,
  airTime: 0,
  lastBreakerId: null,
  lastBreakerCooldown: 0,
};

export function useCarPhysics(options: UseCarPhysicsOptions = {}) {
  const { nitroOverlayRef, jumpOverlayRef, jumpAltitudeTextRef, onFinish, soundManager } = options;
  const onFinishRef = useRef(onFinish);
  const soundRef = useRef<ISoundManager>(soundManager || getSoundManager());

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    soundRef.current = soundManager || getSoundManager();
  }, [soundManager]);

  const carStateRef = useRef<CarPhysicsState>({ ...INITIAL_CAR_STATE });
  const jumpStateRef = useRef<CarJumpState>({ ...INITIAL_JUMP_STATE });
  const currentSteerAngleRef = useRef<number>(0);
  const nitroExhaustTimerRef = useRef<number>(0);

  const keysRef = useRef<InputKeys>({
    w: false,
    s: false,
    a: false,
    d: false,
    space: false,
    r: false,
  });

  // Track keyboard inputs with zero React re-render overhead
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      soundRef.current.warmUp();
      const key = e.key.toLowerCase();
      if (key === "w" || e.key === "ArrowUp") keysRef.current.w = true;
      if (key === "s" || e.key === "ArrowDown") keysRef.current.s = true;
      if (key === "a" || e.key === "ArrowLeft") keysRef.current.a = true;
      if (key === "d" || e.key === "ArrowRight") keysRef.current.d = true;
      if (e.key === " " || e.code === "Space") {
        if (!keysRef.current.space) {
          soundRef.current.startNitro();
          if (nitroOverlayRef?.current) {
            nitroOverlayRef.current.style.opacity = "1";
          }
        }
        keysRef.current.space = true;
      }
      if (key === "r") keysRef.current.r = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w" || e.key === "ArrowUp") keysRef.current.w = false;
      if (key === "s" || e.key === "ArrowDown") keysRef.current.s = false;
      if (key === "a" || e.key === "ArrowLeft") keysRef.current.a = false;
      if (key === "d" || e.key === "ArrowRight") keysRef.current.d = false;
      if (e.key === " " || e.code === "Space") {
        keysRef.current.space = false;
        soundRef.current.stopNitro();
        if (nitroOverlayRef?.current) {
          nitroOverlayRef.current.style.opacity = "0";
        }
      }
      if (key === "r") keysRef.current.r = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      soundRef.current.stopNitro();
    };
  }, [nitroOverlayRef]);

  const resetPhysics = useCallback((customState?: Partial<CarPhysicsState>) => {
    carStateRef.current = {
      ...INITIAL_CAR_STATE,
      ...customState,
    };
    jumpStateRef.current = {
      ...INITIAL_JUMP_STATE,
    };
    currentSteerAngleRef.current = 0;
    nitroExhaustTimerRef.current = 0;
  }, []);

  const stepPhysics = useCallback(
    (
      dt: number,
      activeRoomStatus: string,
      speedBreakers: SpeedBreaker[],
      visuals?: {
        playerCar?: THREE.Group | null;
        spawnDust?: (pos: THREE.Vector3, vel: THREE.Vector3, color: string) => void;
      }
    ) => {
      const pState = carStateRef.current;
      const keys = keysRef.current;
      const spawnDust = visuals?.spawnDust;
      const playerCar = visuals?.playerCar;

      if (activeRoomStatus !== "racing" || pState.finished) {
        return;
      }

      const localPos = new THREE.Vector3(pState.x, pState.y, pState.z);
      const roadCheck = checkOnRoad(localPos);
      const maxAllowedDist = ROAD_WIDTH / 2 - 1.8;

      // 1. Off-road boundary constraint & sparks
      if (roadCheck.distance > maxAllowedDist) {
        const toCar = localPos.clone().sub(roadCheck.closestPt);
        toCar.y = 0;
        toCar.normalize();

        const correctedPos = roadCheck.closestPt
          .clone()
          .add(toCar.multiplyScalar(maxAllowedDist));
        pState.x = correctedPos.x;
        pState.z = correctedPos.z;

        pState.speed = Math.max(pState.speed * 0.96, 18);

        // Play wall / guard rail scrape and impact sound
        soundRef.current.playWallScrape(pState.speed, Math.min(Math.abs(pState.speed) / 45, 1.0));

        if (pState.isDrifting) {
          pState.isDrifting = false;
          pState.driftScore = 0;
          pState.driftMeter = 0;
        }

        if (spawnDust && Math.random() < 0.6) {
          const sparkDir = new THREE.Vector3(
            Math.sin(pState.rotationY) + (Math.random() - 0.5),
            0.5 + Math.random(),
            Math.cos(pState.rotationY) + (Math.random() - 0.5)
          ).normalize();
          spawnDust(correctedPos, sparkDir, "#ef4444");
        }
      }

      // 2. Nitro timer & acceleration/braking
      if (keys.space && activeRoomStatus === "racing") {
        pState.boostTimer = Math.max(pState.boostTimer, 0.4);
      } else if (pState.boostTimer > 0) {
        pState.boostTimer -= dt;
        if (pState.boostTimer <= 0) pState.boostTimer = 0;
      }

      const targetMaxSpeed = pState.boostTimer > 0 ? 105 : 62;
      const accelRate = 22.0;
      const nitroAccelRate = 45.0;
      const brakeRate = 33.0;
      const frictionRate = 6.0;

      if (keys.space || pState.boostTimer > 0) {
        if (pState.speed < targetMaxSpeed) {
          pState.speed += nitroAccelRate * dt;
        } else {
          pState.speed -= Math.min(
            nitroAccelRate * 0.5 * dt,
            pState.speed - targetMaxSpeed
          );
        }

        if (spawnDust) {
          nitroExhaustTimerRef.current += dt;
          if (nitroExhaustTimerRef.current >= 0.04) {
            nitroExhaustTimerRef.current = 0;
            const rotCos = Math.sin(pState.rotationY);
            const rotSin = Math.cos(pState.rotationY);
            const leftExhaust = localPos
              .clone()
              .add(new THREE.Vector3(-rotCos * 2.8 - 0.6, 0.35, -rotSin * 2.8));
            const rightExhaust = localPos
              .clone()
              .add(new THREE.Vector3(-rotCos * 2.8 + 0.6, 0.35, -rotSin * 2.8));
            spawnDust(
              leftExhaust,
              new THREE.Vector3(-rotCos * 3.5, 0.6, -rotSin * 3.5),
              "#06b6d4"
            );
            spawnDust(
              rightExhaust,
              new THREE.Vector3(-rotCos * 3.5, 0.6, -rotSin * 3.5),
              "#06b6d4"
            );
          }
        }
      } else if (keys.w) {
        if (pState.speed < targetMaxSpeed) {
          pState.speed += accelRate * dt;
        } else {
          pState.speed -= Math.min(
            accelRate * 0.5 * dt,
            pState.speed - targetMaxSpeed
          );
        }
      } else if (keys.s) {
        if (pState.speed > -20) {
          pState.speed -= brakeRate * dt;
        }
      } else {
        if (!jumpStateRef.current.isAirborne) {
          if (pState.speed > 0) {
            pState.speed -= frictionRate * dt;
            if (pState.speed < 0) pState.speed = 0;
          } else if (pState.speed < 0) {
            pState.speed += frictionRate * dt;
            if (pState.speed > 0) pState.speed = 0;
          }
        }
      }

      // 3. Steering and Wheel Orientation
      const steerSpeed = 1.35;
      const speedRatio = Math.min(Math.abs(pState.speed) / 45, 1.3);

      let targetSteer = 0;
      if (keys.a) {
        pState.rotationY += steerSpeed * speedRatio * dt;
        targetSteer = 0.35;
      } else if (keys.d) {
        pState.rotationY -= steerSpeed * speedRatio * dt;
        targetSteer = -0.35;
      }
      currentSteerAngleRef.current = THREE.MathUtils.lerp(
        currentSteerAngleRef.current,
        targetSteer,
        Math.min(14 * dt, 1)
      );

      if (playerCar) {
        const fl = playerCar.getObjectByName("frontLeft") as THREE.Group;
        const fr = playerCar.getObjectByName("frontRight") as THREE.Group;
        if (fl) fl.rotation.y = currentSteerAngleRef.current;
        if (fr) fr.rotation.y = currentSteerAngleRef.current;
      }

      // 4. Drift Mechanics
      const canDrift = Math.abs(pState.speed) > 28;
      const isSteering = keys.a || keys.d;

      if (canDrift && isSteering) {
        if (!pState.isDrifting) {
          pState.isDrifting = true;
        }
        soundRef.current.updateDrift(true, pState.speed, dt);

        const driftRate = 0.8;
        const targetDriftAngle = keys.a ? 0.38 : -0.38;
        pState.driftAngle = THREE.MathUtils.lerp(
          pState.driftAngle,
          targetDriftAngle,
          driftRate * dt * 5
        );

        const scoreDelta = Math.round(
          Math.abs(pState.speed) * Math.abs(pState.driftAngle) * 5 * dt
        );
        pState.driftScore += scoreDelta;
        pState.driftMeter = Math.min(pState.driftMeter + scoreDelta * 0.4, 100);

        if (spawnDust && Math.random() < 0.4) {
          const rotCos = Math.sin(pState.rotationY);
          const rotSin = Math.cos(pState.rotationY);
          const exhaustPos = localPos
            .clone()
            .add(new THREE.Vector3(-rotCos * 2.5, 0.4, -rotSin * 2.5));
          spawnDust(
            exhaustPos,
            new THREE.Vector3(-rotCos * 3, 1.2, -rotSin * 3),
            "#ec4899"
          );
        }
      } else {
        soundRef.current.updateDrift(false, 0, dt);
        if (pState.isDrifting) {
          pState.isDrifting = false;

          if (pState.driftScore > 100) {
            pState.boostTimer = 1.6;
            pState.totalDriftScore += pState.driftScore;
          }
          pState.driftScore = 0;
          pState.driftMeter = 0;
        }
        pState.driftAngle = THREE.MathUtils.lerp(pState.driftAngle, 0, 8 * dt);
      }

      // 5. Position propagation
      const driveAngle = pState.rotationY - pState.driftAngle * 0.7;
      const dx = Math.sin(driveAngle) * pState.speed * dt;
      const dz = Math.cos(driveAngle) * pState.speed * dt;

      pState.x += dx;
      pState.z += dz;

      // 6. Speed Breaker Jump Physics
      const jumpResult = updateCarSpeedBreakerPhysics(
        { x: pState.x, y: pState.y, z: pState.z },
        pState.speed,
        dt,
        jumpStateRef.current,
        speedBreakers
      );

      pState.y = jumpResult.y;
      if (jumpResult.landingSpeedDampening < 1.0) {
        pState.speed *= jumpResult.landingSpeedDampening;
      }

      if (jumpResult.justLaunched) {
        soundRef.current.playJump(Math.min(Math.abs(pState.speed) / 75, 1.0));
      }

      if (jumpResult.justLanded) {
        soundRef.current.playLanding(Math.min(Math.abs(pState.speed) / 60, 1.0));
        if (spawnDust) {
          const carPos = new THREE.Vector3(pState.x, 0, pState.z);
          const rotCos = Math.sin(pState.rotationY);
          const rotSin = Math.cos(pState.rotationY);
          const t1 = carPos
            .clone()
            .add(
              new THREE.Vector3(
                -rotSin * 1.1 + rotCos * 1.5,
                0.1,
                rotCos * 1.1 + rotSin * 1.5
              )
            );
          const t2 = carPos
            .clone()
            .add(
              new THREE.Vector3(
                rotSin * 1.1 + rotCos * 1.5,
                0.1,
                -rotCos * 1.1 + rotSin * 1.5
              )
            );
          const t3 = carPos
            .clone()
            .add(
              new THREE.Vector3(
                -rotSin * 1.1 - rotCos * 1.5,
                0.1,
                rotCos * 1.1 - rotSin * 1.5
              )
            );
          const t4 = carPos
            .clone()
            .add(
              new THREE.Vector3(
                rotSin * 1.1 - rotCos * 1.5,
                0.1,
                -rotCos * 1.1 - rotSin * 1.5
              )
            );
          [t1, t2, t3, t4].forEach((tp) => {
            spawnDust(
              tp,
              new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                0.8 + Math.random(),
                (Math.random() - 0.5) * 3
              ),
              "#f59e0b"
            );
            spawnDust(
              tp,
              new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                0.5,
                (Math.random() - 0.5) * 2
              ),
              "#94a3b8"
            );
          });
        }
      }

      if (jumpResult.hitRumble) {
        soundRef.current.playSpeedBumpRumble(0.5);
      }

      if (jumpOverlayRef?.current) {
        if (jumpResult.isAirborne && jumpResult.y > 0.28) {
          jumpOverlayRef.current.style.opacity = "1";
          jumpOverlayRef.current.style.transform = "translate(-50%, 0) scale(1)";
          if (jumpAltitudeTextRef?.current) {
            jumpAltitudeTextRef.current.textContent = `+${jumpResult.y.toFixed(1)}m`;
          }
        } else {
          jumpOverlayRef.current.style.opacity = "0";
          jumpOverlayRef.current.style.transform =
            "translate(-50%, -10px) scale(0.95)";
        }
      }

      // 7. Reset to track checkpoint ('R' key)
      if (keys.r) {
        const checkU = pState.checkpoint / CHECKPOINT_COUNT;
        const checkpointPt = TRACK_CURVE.getPointAt(checkU);
        pState.x = checkpointPt.x;
        pState.y = checkpointPt.y;
        pState.z = checkpointPt.z;
        const tangent = TRACK_CURVE.getTangentAt(checkU);
        pState.rotationY = Math.atan2(tangent.x, tangent.z);
        pState.speed = 0;
        pState.driftScore = 0;
        pState.driftMeter = 0;
        pState.isDrifting = false;
      }

      // 8. Checkpoint tracking & Lap Counter
      const currentU = roadCheck.u;
      const checkpointTolerance = 0.08;

      for (let cp = 0; cp < CHECKPOINT_COUNT; cp++) {
        const targetU = cp / CHECKPOINT_COUNT;
        const diffU = Math.min(
          Math.abs(currentU - targetU),
          1.0 - Math.abs(currentU - targetU)
        );

        if (diffU < checkpointTolerance) {
          const nextExpected = (pState.checkpoint + 1) % CHECKPOINT_COUNT;

          if (cp === nextExpected) {
            pState.checkpoint = cp;

            if (cp === 0) {
              pState.lap += 1;
              if (pState.lap > 3) {
                pState.finished = true;
                pState.speed = 0;
                if (onFinishRef.current) {
                  const raceStart = (window as any).raceStartTime || Date.now();
                  onFinishRef.current(Date.now() - raceStart);
                }
              }
            }
          }
        }
      }

      // 9. Synchronize visual mesh transformations
      if (playerCar) {
        playerCar.position.set(pState.x, pState.y, pState.z);
        playerCar.rotation.y = pState.rotationY - pState.driftAngle;
        playerCar.rotation.x = jumpStateRef.current.pitch;

        const rearLeftRoll = playerCar.getObjectByName(
          "rearLeft_roll"
        ) as THREE.Group;
        const rearRightRoll = playerCar.getObjectByName(
          "rearRight_roll"
        ) as THREE.Group;
        const frontLeftRoll = playerCar.getObjectByName(
          "frontLeft_roll"
        ) as THREE.Group;
        const frontRightRoll = playerCar.getObjectByName(
          "frontRight_roll"
        ) as THREE.Group;

        const rotationScalar = pState.speed * dt * 0.8;
        if (rearLeftRoll) rearLeftRoll.rotation.x += rotationScalar;
        if (rearRightRoll) rearRightRoll.rotation.x += rotationScalar;
        if (frontLeftRoll) frontLeftRoll.rotation.x += rotationScalar;
        if (frontRightRoll) frontRightRoll.rotation.x += rotationScalar;

        const brakeL = playerCar.getObjectByName("brakeLightL") as THREE.Mesh;
        const brakeR = playerCar.getObjectByName("brakeLightR") as THREE.Mesh;
        if (brakeL && brakeR) {
          if (keys.s) {
            (brakeL.material as THREE.MeshBasicMaterial).color.set("#ef4444");
            (brakeR.material as THREE.MeshBasicMaterial).color.set("#ef4444");
          } else {
            (brakeL.material as THREE.MeshBasicMaterial).color.set("#7f1d1d");
            (brakeR.material as THREE.MeshBasicMaterial).color.set("#7f1d1d");
          }
        }
      }
    },
    [jumpAltitudeTextRef, jumpOverlayRef]
  );

  return {
    carStateRef,
    jumpStateRef,
    keysRef,
    currentSteerAngleRef,
    resetPhysics,
    stepPhysics,
  };
}

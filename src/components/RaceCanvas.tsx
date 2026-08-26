import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Player, TrafficVehicle } from "../types";
import {
  startNitroAudio,
  stopNitroAudio,
  warmUpAudioEngine,
  playCollisionSound,
  playJumpSound,
  playLandingSound,
  playSpeedBumpRumble,
} from "../utils/audio";
import { resolveCarCollisions, CarCollisionEntity } from "../utils/carCollision";
import {
  generateSpeedBreakers,
  buildSpeedBreakerMesh,
  updateCarSpeedBreakerPhysics,
  SpeedBreaker,
  CarJumpState,
} from "../utils/speedBreakers";
import {
  AIDifficulty,
  AIState,
  createAIPackState,
  updateAISimulation,
  calculateMultiRaceStandings,
  StandingsResult,
} from "../utils/aiOpponent";
import {
  generateTrafficVehicles,
  updateTrafficSimulation,
} from "../utils/trafficSystem";
import { createTrafficVehicleMesh } from "../utils/trafficMeshBuilder";
import {
  TRACK_POINTS,
  TRACK_CURVE,
  ROAD_WIDTH,
  CHECKPOINT_COUNT,
  checkOnRoad,
} from "../constants/track";
import { createCarMesh } from "../utils/carMeshBuilder";
import { buildTrackSceneComponents } from "../utils/trackMeshBuilder";

interface RaceCanvasProps {
  localPlayer: Player;
  remotePlayers: Player[];
  activeRoomStatus: "lobby" | "countdown" | "racing" | "results";
  onUpdateState: (state: Partial<Player>) => void;
  theme: "light" | "dark";
  isSinglePlayer?: boolean;
  aiDifficulty?: AIDifficulty;
  aiCount?: number;
  aiName?: string;
  aiColor?: string;
  speedBreakersCount?: number;
  trafficCount?: number;
  onAIOpponentUpdate?: (ai: Player, standings: StandingsResult) => void;
  onAIPackUpdate?: (aiPack: Player[], standings: StandingsResult) => void;
  onTrafficUpdate?: (vehicles: TrafficVehicle[]) => void;
}

export default function RaceCanvas({
  localPlayer,
  remotePlayers,
  activeRoomStatus,
  onUpdateState,
  theme,
  isSinglePlayer = false,
  aiDifficulty = "medium",
  aiCount = 1,
  speedBreakersCount = 4,
  trafficCount = 8,
  onAIOpponentUpdate,
  onAIPackUpdate,
  onTrafficUpdate,
}: RaceCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const nitroOverlayRef = useRef<HTMLDivElement>(null);
  const jumpOverlayRef = useRef<HTMLDivElement>(null);
  const jumpAltitudeTextRef = useRef<HTMLSpanElement>(null);

  // Keep often-changed props in Refs to avoid reconstructing Three.js on every frame
  const localPlayerRef = useRef<Player>(localPlayer);
  const remotePlayersRef = useRef<Player[]>(remotePlayers);
  const activeRoomStatusRef = useRef<string>(activeRoomStatus);
  const onUpdateStateRef = useRef(onUpdateState);
  const onAIOpponentUpdateRef = useRef(onAIOpponentUpdate);
  const onAIPackUpdateRef = useRef(onAIPackUpdate);
  const onTrafficUpdateRef = useRef(onTrafficUpdate);
  const speedBreakersCountRef = useRef<number>(speedBreakersCount);
  const speedBreakersRef = useRef<SpeedBreaker[]>([]);
  const trafficCountRef = useRef<number>(trafficCount);
  const trafficVehiclesRef = useRef<TrafficVehicle[]>([]);

  const playerJumpStateRef = useRef<CarJumpState>({
    y: 0,
    vy: 0,
    pitch: 0,
    isAirborne: false,
    airTime: 0,
    lastBreakerId: null,
    lastBreakerCooldown: 0,
  });

  const aiJumpStatesRef = useRef<CarJumpState[]>([]);

  // AI Opponents simulation state ref (supports 1 to 5 rivals)
  const aiPackStateRef = useRef<AIState[]>(
    createAIPackState(aiCount, aiDifficulty)
  );

  useEffect(() => {
    speedBreakersCountRef.current = speedBreakersCount;
  }, [speedBreakersCount]);

  useEffect(() => {
    trafficCountRef.current = trafficCount;
  }, [trafficCount]);

  useEffect(() => {
    localPlayerRef.current = localPlayer;
  }, [localPlayer]);

  useEffect(() => {
    remotePlayersRef.current = remotePlayers;
  }, [remotePlayers]);

  useEffect(() => {
    activeRoomStatusRef.current = activeRoomStatus;
    if (activeRoomStatus === "countdown" || activeRoomStatus === "lobby") {
      aiPackStateRef.current = createAIPackState(aiCount, aiDifficulty);
      if (isSinglePlayer && trafficCountRef.current > 0) {
        trafficVehiclesRef.current = generateTrafficVehicles(
          trafficCountRef.current,
          TRACK_CURVE,
          ROAD_WIDTH
        );
      }
    }
  }, [activeRoomStatus, aiDifficulty, aiCount, isSinglePlayer]);

  useEffect(() => {
    onUpdateStateRef.current = onUpdateState;
  }, [onUpdateState]);

  useEffect(() => {
    onAIOpponentUpdateRef.current = onAIOpponentUpdate;
  }, [onAIOpponentUpdate]);

  useEffect(() => {
    onAIPackUpdateRef.current = onAIPackUpdate;
  }, [onAIPackUpdate]);

  useEffect(() => {
    onTrafficUpdateRef.current = onTrafficUpdate;
  }, [onTrafficUpdate]);

  // Input states ref
  const keysRef = useRef<{
    w: boolean;
    s: boolean;
    a: boolean;
    d: boolean;
    space: boolean;
    r: boolean;
  }>({
    w: false,
    s: false,
    a: false,
    d: false,
    space: false,
    r: false,
  });

  // Physics state refs to keep it running smoothly at 60fps
  const carStateRef = useRef({
    x: 0,
    y: 0,
    z: 0,
    rotationY: 0, // Starting facing forward along the straightaway (aligned with +Z)
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
  });

  // Track key actions (Zero React re-render overhead for nitro boost)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      warmUpAudioEngine();
      const key = e.key.toLowerCase();
      if (key === "w" || e.key === "ArrowUp") keysRef.current.w = true;
      if (key === "s" || e.key === "ArrowDown") keysRef.current.s = true;
      if (key === "a" || e.key === "ArrowLeft") keysRef.current.a = true;
      if (key === "d" || e.key === "ArrowRight") keysRef.current.d = true;
      if (e.key === " " || e.code === "Space") {
        if (!keysRef.current.space) {
          startNitroAudio();
          if (nitroOverlayRef.current) {
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
        stopNitroAudio();
        if (nitroOverlayRef.current) {
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
      stopNitroAudio();
    };
  }, []);

  // Sync state triggers from props (for lobby/game starts, resets)
  useEffect(() => {
    if (activeRoomStatus === "countdown") {
      carStateRef.current = {
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
    }
  }, [activeRoomStatus]);

  // Main Three.js setup & game loop
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const isDark = theme === "dark";

    const bgColStr = isDark ? "#0c0f1a" : "#f1f5f9";
    scene.background = new THREE.Color(bgColStr);
    scene.fog = new THREE.FogExp2(bgColStr, 0.003);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // LIGHTING SYSTEM
    const ambientLight = new THREE.AmbientLight(
      isDark ? "#4f46e5" : "#ffffff",
      isDark ? 0.3 : 0.75
    );
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(
      isDark ? "#9333ea" : "#fef08a",
      isDark ? 0.8 : 0.65
    );
    dirLight.position.set(100, 150, 50);
    scene.add(dirLight);

    const sunLight = new THREE.DirectionalLight(
      isDark ? "#3b82f6" : "#38bdf8",
      isDark ? 0.6 : 1.1
    );
    sunLight.position.set(-100, 120, -100);
    scene.add(sunLight);

    // PROCEDURAL TRACK & SCENE COMPONENTS (Built via trackMeshBuilder)
    const trackComponents = buildTrackSceneComponents(isDark);
    scene.add(trackComponents.gridMesh);
    scene.add(trackComponents.starPoints);
    scene.add(trackComponents.roadMesh);
    scene.add(trackComponents.curbLeftMesh);
    scene.add(trackComponents.curbRightMesh);
    scene.add(trackComponents.leftLaserFence);
    scene.add(trackComponents.rightLaserFence);
    trackComponents.checkpointBeacons.forEach((beacon) => scene.add(beacon));

    // SPEED BREAKERS TRACK OBJECTS
    const speedBreakersData = generateSpeedBreakers(
      speedBreakersCountRef.current,
      TRACK_CURVE,
      ROAD_WIDTH
    );
    speedBreakersRef.current = speedBreakersData;
    const speedBreakerMeshes: THREE.Group[] = [];

    speedBreakersData.forEach((breaker) => {
      const mesh = buildSpeedBreakerMesh(breaker, isDark);
      scene.add(mesh);
      speedBreakerMeshes.push(mesh);
    });

    // Local player car 3D representation
    const playerCar = createCarMesh(localPlayerRef.current.color, localPlayerRef.current.id);
    scene.add(playerCar);

    // Remote cars directory
    const remoteCarsMap = new Map<
      string,
      { group: THREE.Group; targetPos: THREE.Vector3; targetRotY: number }
    >();

    // Particle dust system
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 60;
    const dustPositions = new Float32Array(particleCount * 3);
    const dustAges = new Float32Array(particleCount);
    const dustVels = new Float32Array(particleCount * 3);

    for (let p = 0; p < particleCount; p++) {
      dustAges[p] = -1;
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: "#9333ea",
      size: 1.0,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const dustPointsMesh = new THREE.Points(particleGeometry, dustMat);
    scene.add(dustPointsMesh);

    // 3D WARP SPEED STREAKS
    const warpStreakCount = 80;
    const warpGeo = new THREE.BufferGeometry();
    const warpPositions = new Float32Array(warpStreakCount * 6);
    for (let i = 0; i < warpStreakCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.5 + Math.random() * 12;
      const zOffset = (Math.random() - 0.5) * 45;
      const x = Math.cos(angle) * radius;
      const y = 1.2 + Math.sin(angle) * (radius * 0.55);

      const idx = i * 6;
      warpPositions[idx] = x;
      warpPositions[idx + 1] = y;
      warpPositions[idx + 2] = zOffset;
      warpPositions[idx + 3] = x;
      warpPositions[idx + 4] = y;
      warpPositions[idx + 5] = zOffset + 8 + Math.random() * 8;
    }
    warpGeo.setAttribute("position", new THREE.BufferAttribute(warpPositions, 3));
    const warpMat = new THREE.LineBasicMaterial({
      color: "#38bdf8",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const warpLines = new THREE.LineSegments(warpGeo, warpMat);
    scene.add(warpLines);

    function spawnDust(pos: THREE.Vector3, dir: THREE.Vector3, pColor: string = "#9333ea") {
      let spawned = 0;
      for (let p = 0; p < particleCount; p++) {
        if (dustAges[p] < 0) {
          dustAges[p] = 0;
          const idx = p * 3;
          dustPositions[idx] = pos.x + (Math.random() - 0.5) * 1.5;
          dustPositions[idx + 1] = pos.y + 0.1;
          dustPositions[idx + 2] = pos.z + (Math.random() - 0.5) * 1.5;

          dustVels[idx] = dir.x * 3 + (Math.random() - 0.5) * 1.2;
          dustVels[idx + 1] = Math.random() * 1.5 + 0.5;
          dustVels[idx + 2] = dir.z * 3 + (Math.random() - 0.5) * 1.2;

          spawned++;
          if (spawned > 4) break;
        }
      }
    }

    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    const trackLength = TRACK_CURVE.getLength();

    // Spawn dedicated AI Car Meshes if in Single Player mode
    const aiCarMeshes: THREE.Group[] = [];
    if (isSinglePlayer) {
      aiPackStateRef.current.forEach((ai) => {
        const mesh = createCarMesh(ai.player.color, ai.player.id);
        scene.add(mesh);
        aiCarMeshes.push(mesh);
      });
    }

    // Spawn Traffic Vehicle Meshes if in Single Player mode
    const trafficMeshes: THREE.Group[] = [];
    if (isSinglePlayer && trafficCountRef.current > 0) {
      if (trafficVehiclesRef.current.length === 0) {
        trafficVehiclesRef.current = generateTrafficVehicles(
          trafficCountRef.current,
          TRACK_CURVE,
          ROAD_WIDTH
        );
      }
      trafficVehiclesRef.current.forEach((tv) => {
        const mesh = createTrafficVehicleMesh({
          type: tv.type,
          color: tv.color,
          id: tv.id,
        });
        scene.add(mesh);
        trafficMeshes.push(mesh);
      });
    }

    let lastTime = performance.now();
    let networkSendTimer = 0;
    let currentSteerAngle = 0;
    let nitroExhaustTimer = 0;

    const gameLoop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const pState = carStateRef.current;
      const keys = keysRef.current;

      // 1. UPDATE REMOTE CARS
      remotePlayersRef.current.forEach((rp) => {
        let entry = remoteCarsMap.get(rp.id);
        if (!entry) {
          const mesh = createCarMesh(rp.color, rp.id);
          scene.add(mesh);
          entry = {
            group: mesh,
            targetPos: new THREE.Vector3(rp.x, rp.y, rp.z),
            targetRotY: rp.rotationY,
          };
          remoteCarsMap.set(rp.id, entry);
        } else {
          entry.targetPos.set(rp.x, rp.y, rp.z);
          entry.targetRotY = rp.rotationY;
        }

        entry.group.position.lerp(entry.targetPos, 0.15);

        let diff = entry.targetRotY - entry.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        entry.group.rotation.y += diff * 0.15;

        if (rp.finished) {
          entry.group.position.y = -100;
        } else {
          entry.group.position.y = entry.targetPos.y || 0;
        }
      });

      for (const [rid, rCar] of remoteCarsMap.entries()) {
        if (!remotePlayersRef.current.some((rp) => rp.id === rid)) {
          scene.remove(rCar.group);
          remoteCarsMap.delete(rid);
        }
      }

      // 1B. UPDATE AI OPPONENTS (Single Player)
      if (isSinglePlayer && aiCarMeshes.length > 0) {
        const roadCheckPlayer = checkOnRoad(new THREE.Vector3(pState.x, pState.y, pState.z));
        const playerContinuousProg = pState.finished
          ? 3.0
          : Math.max(0, pState.lap - 1) + roadCheckPlayer.u;

        aiPackStateRef.current = aiPackStateRef.current.map((aiState, index) => {
          const updatedAI = updateAISimulation(
            aiState,
            dt,
            TRACK_CURVE,
            trackLength,
            activeRoomStatusRef.current as any,
            (window as any).raceStartTime || Date.now(),
            playerContinuousProg,
            pState.speed
          );

          const aiCarMesh = aiCarMeshes[index];
          if (aiCarMesh) {
            const aiP = updatedAI.player;

            if (!aiJumpStatesRef.current[index]) {
              aiJumpStatesRef.current[index] = {
                y: 0,
                vy: 0,
                pitch: 0,
                isAirborne: false,
                airTime: 0,
                lastBreakerId: null,
                lastBreakerCooldown: 0,
              };
            }
            const aiJumpResult = updateCarSpeedBreakerPhysics(
              { x: aiP.x, y: aiP.y, z: aiP.z },
              aiP.speed,
              dt,
              aiJumpStatesRef.current[index],
              speedBreakersRef.current
            );
            aiP.y = aiJumpResult.y;

            if (aiJumpResult.justLanded) {
              spawnDust(
                new THREE.Vector3(aiP.x, 0, aiP.z),
                new THREE.Vector3((Math.random() - 0.5) * 3, 0.9, (Math.random() - 0.5) * 3),
                aiP.color
              );
            }

            aiCarMesh.position.set(aiP.x, aiP.y, aiP.z);
            aiCarMesh.rotation.y = aiP.rotationY;
            aiCarMesh.rotation.x = aiJumpResult.pitch;

            const aiRollScalar = aiP.speed * dt * 0.8;
            const aiRL = aiCarMesh.getObjectByName("rearLeft_roll") as THREE.Group;
            const aiRR = aiCarMesh.getObjectByName("rearRight_roll") as THREE.Group;
            const aiFL = aiCarMesh.getObjectByName("frontLeft_roll") as THREE.Group;
            const aiFR = aiCarMesh.getObjectByName("frontRight_roll") as THREE.Group;
            if (aiRL) aiRL.rotation.x += aiRollScalar;
            if (aiRR) aiRR.rotation.x += aiRollScalar;
            if (aiFL) aiFL.rotation.x += aiRollScalar;
            if (aiFR) aiFR.rotation.x += aiRollScalar;

            const aiBrakeL = aiCarMesh.getObjectByName("brakeLightL") as THREE.Mesh;
            const aiBrakeR = aiCarMesh.getObjectByName("brakeLightR") as THREE.Mesh;
            if (aiBrakeL && aiBrakeR) {
              if (updatedAI.currentSpeed < 35 && activeRoomStatusRef.current === "racing") {
                (aiBrakeL.material as THREE.MeshBasicMaterial).color.set("#ef4444");
                (aiBrakeR.material as THREE.MeshBasicMaterial).color.set("#ef4444");
              } else {
                (aiBrakeL.material as THREE.MeshBasicMaterial).color.set("#7f1d1d");
                (aiBrakeR.material as THREE.MeshBasicMaterial).color.set("#7f1d1d");
              }
            }

            const aiNitro = aiCarMesh.getObjectByName("nitroPlumes") as THREE.Group;
            if (aiNitro) {
              aiNitro.visible = updatedAI.boostTimer > 0;
            }

            if (aiP.isDrifting && Math.random() < 0.25) {
              const rotCos = Math.sin(aiP.rotationY);
              const rotSin = Math.cos(aiP.rotationY);
              const exhaustPos = new THREE.Vector3(aiP.x - rotCos * 2.5, 0.4, aiP.z - rotSin * 2.5);
              spawnDust(exhaustPos, new THREE.Vector3(-rotCos * 3, 1.0, -rotSin * 3), aiP.color);
            }
          }

          return updatedAI;
        });
      }

      // 1C. UPDATE CIVILIAN HIGHWAY TRAFFIC (Single Player)
      if (isSinglePlayer && trafficMeshes.length > 0) {
        trafficVehiclesRef.current = updateTrafficSimulation(
          trafficVehiclesRef.current,
          dt,
          TRACK_CURVE,
          trackLength,
          activeRoomStatusRef.current as any
        );

        trafficVehiclesRef.current.forEach((tv, idx) => {
          const tMesh = trafficMeshes[idx];
          if (tMesh) {
            tMesh.position.set(tv.x, tv.y || 0, tv.z);
            tMesh.rotation.y = tv.rotationY;

            // Rotate traffic wheels proportional to speed
            const rollScalar = tv.speed * dt * 0.8;
            const tRL = tMesh.getObjectByName("rearLeft_roll") as THREE.Group;
            const tRR = tMesh.getObjectByName("rearRight_roll") as THREE.Group;
            const tFL = tMesh.getObjectByName("frontLeft_roll") as THREE.Group;
            const tFR = tMesh.getObjectByName("frontRight_roll") as THREE.Group;
            if (tRL) tRL.rotation.x += rollScalar;
            if (tRR) tRR.rotation.x += rollScalar;
            if (tFL) tFL.rotation.x += rollScalar;
            if (tFR) tFR.rotation.x += rollScalar;

            // Traffic brake lights trigger when slowing down
            const tBrakeL = tMesh.getObjectByName("brakeLightL") as THREE.Mesh;
            const tBrakeR = tMesh.getObjectByName("brakeLightR") as THREE.Mesh;
            if (tBrakeL && tBrakeR) {
              if (tv.speed < tv.targetSpeed - 2) {
                (tBrakeL.material as THREE.MeshBasicMaterial).color.set("#ef4444");
                (tBrakeR.material as THREE.MeshBasicMaterial).color.set("#ef4444");
              } else {
                (tBrakeL.material as THREE.MeshBasicMaterial).color.set("#7f1d1d");
                (tBrakeR.material as THREE.MeshBasicMaterial).color.set("#7f1d1d");
              }
            }
          }
        });
      }

      // 2. RUN LOCAL CAR DRIVING PHYSICS
      if (activeRoomStatusRef.current === "racing" && !pState.finished) {
        const localPos = new THREE.Vector3(pState.x, pState.y, pState.z);
        const roadCheck = checkOnRoad(localPos);
        const maxAllowedDist = ROAD_WIDTH / 2 - 1.8;

        if (roadCheck.distance > maxAllowedDist) {
          const toCar = localPos.clone().sub(roadCheck.closestPt);
          toCar.y = 0;
          toCar.normalize();

          const correctedPos = roadCheck.closestPt.clone().add(toCar.multiplyScalar(maxAllowedDist));
          pState.x = correctedPos.x;
          pState.z = correctedPos.z;

          pState.speed = Math.max(pState.speed * 0.96, 18);

          if (pState.isDrifting) {
            pState.isDrifting = false;
            pState.driftScore = 0;
            pState.driftMeter = 0;
          }

          if (Math.random() < 0.6) {
            const sparkDir = new THREE.Vector3(
              Math.sin(pState.rotationY) + (Math.random() - 0.5),
              0.5 + Math.random(),
              Math.cos(pState.rotationY) + (Math.random() - 0.5)
            ).normalize();
            spawnDust(correctedPos, sparkDir, "#ef4444");
          }
        }

        if (keys.space && activeRoomStatusRef.current === "racing") {
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
            pState.speed -= Math.min(nitroAccelRate * 0.5 * dt, pState.speed - targetMaxSpeed);
          }

          nitroExhaustTimer += dt;
          if (nitroExhaustTimer >= 0.04) {
            nitroExhaustTimer = 0;
            const rotCos = Math.sin(pState.rotationY);
            const rotSin = Math.cos(pState.rotationY);
            const leftExhaust = localPos
              .clone()
              .add(new THREE.Vector3(-rotCos * 2.8 - 0.6, 0.35, -rotSin * 2.8));
            const rightExhaust = localPos
              .clone()
              .add(new THREE.Vector3(-rotCos * 2.8 + 0.6, 0.35, -rotSin * 2.8));
            spawnDust(leftExhaust, new THREE.Vector3(-rotCos * 3.5, 0.6, -rotSin * 3.5), "#06b6d4");
            spawnDust(rightExhaust, new THREE.Vector3(-rotCos * 3.5, 0.6, -rotSin * 3.5), "#06b6d4");
          }
        } else if (keys.w) {
          if (pState.speed < targetMaxSpeed) {
            pState.speed += accelRate * dt;
          } else {
            pState.speed -= Math.min(accelRate * 0.5 * dt, pState.speed - targetMaxSpeed);
          }
        } else if (keys.s) {
          if (pState.speed > -20) {
            pState.speed -= brakeRate * dt;
          }
        } else {
          if (!playerJumpStateRef.current.isAirborne) {
            if (pState.speed > 0) {
              pState.speed -= frictionRate * dt;
              if (pState.speed < 0) pState.speed = 0;
            } else if (pState.speed < 0) {
              pState.speed += frictionRate * dt;
              if (pState.speed > 0) pState.speed = 0;
            }
          }
        }

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
        currentSteerAngle = THREE.MathUtils.lerp(
          currentSteerAngle,
          targetSteer,
          Math.min(14 * dt, 1)
        );

        const fl = playerCar.getObjectByName("frontLeft") as THREE.Group;
        const fr = playerCar.getObjectByName("frontRight") as THREE.Group;
        if (fl) fl.rotation.y = currentSteerAngle;
        if (fr) fr.rotation.y = currentSteerAngle;

        const canDrift = Math.abs(pState.speed) > 28;
        const isSteering = keys.a || keys.d;

        if (canDrift && isSteering) {
          if (!pState.isDrifting) {
            pState.isDrifting = true;
          }

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

          if (Math.random() < 0.4) {
            const rotCos = Math.sin(pState.rotationY);
            const rotSin = Math.cos(pState.rotationY);
            const exhaustPos = localPos
              .clone()
              .add(new THREE.Vector3(-rotCos * 2.5, 0.4, -rotSin * 2.5));
            spawnDust(exhaustPos, new THREE.Vector3(-rotCos * 3, 1.2, -rotSin * 3), "#ec4899");
          }
        } else {
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

        const driveAngle = pState.rotationY - pState.driftAngle * 0.7;
        const dx = Math.sin(driveAngle) * pState.speed * dt;
        const dz = Math.cos(driveAngle) * pState.speed * dt;

        pState.x += dx;
        pState.z += dz;

        // SPEED BREAKER JUMP PHYSICS
        const jumpResult = updateCarSpeedBreakerPhysics(
          { x: pState.x, y: pState.y, z: pState.z },
          pState.speed,
          dt,
          playerJumpStateRef.current,
          speedBreakersRef.current
        );

        pState.y = jumpResult.y;
        if (jumpResult.landingSpeedDampening < 1.0) {
          pState.speed *= jumpResult.landingSpeedDampening;
        }

        if (jumpResult.justLaunched) {
          playJumpSound(Math.min(Math.abs(pState.speed) / 75, 1.0));
        }

        if (jumpResult.justLanded) {
          playLandingSound(Math.min(Math.abs(pState.speed) / 60, 1.0));
          const carPos = new THREE.Vector3(pState.x, 0, pState.z);
          const rotCos = Math.sin(pState.rotationY);
          const rotSin = Math.cos(pState.rotationY);
          const t1 = carPos
            .clone()
            .add(new THREE.Vector3(-rotSin * 1.1 + rotCos * 1.5, 0.1, rotCos * 1.1 + rotSin * 1.5));
          const t2 = carPos
            .clone()
            .add(new THREE.Vector3(rotSin * 1.1 + rotCos * 1.5, 0.1, -rotCos * 1.1 + rotSin * 1.5));
          const t3 = carPos
            .clone()
            .add(new THREE.Vector3(-rotSin * 1.1 - rotCos * 1.5, 0.1, rotCos * 1.1 - rotSin * 1.5));
          const t4 = carPos
            .clone()
            .add(new THREE.Vector3(rotSin * 1.1 - rotCos * 1.5, 0.1, -rotCos * 1.1 - rotSin * 1.5));
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
              new THREE.Vector3((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2),
              "#94a3b8"
            );
          });
        }

        if (jumpResult.hitRumble) {
          playSpeedBumpRumble(0.5);
        }

        if (jumpOverlayRef.current) {
          if (jumpResult.isAirborne && jumpResult.y > 0.28) {
            jumpOverlayRef.current.style.opacity = "1";
            jumpOverlayRef.current.style.transform = "translate(-50%, 0) scale(1)";
            if (jumpAltitudeTextRef.current) {
              jumpAltitudeTextRef.current.textContent = `+${jumpResult.y.toFixed(1)}m`;
            }
          } else {
            jumpOverlayRef.current.style.opacity = "0";
            jumpOverlayRef.current.style.transform = "translate(-50%, -10px) scale(0.95)";
          }
        }

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

        const currentU = roadCheck.u;
        const checkpointTolerance = 0.08;

        for (let cp = 0; cp < CHECKPOINT_COUNT; cp++) {
          const targetU = cp / CHECKPOINT_COUNT;
          const diffU = Math.min(Math.abs(currentU - targetU), 1.0 - Math.abs(currentU - targetU));

          if (diffU < checkpointTolerance) {
            const nextExpected = (pState.checkpoint + 1) % CHECKPOINT_COUNT;

            if (cp === nextExpected) {
              pState.checkpoint = cp;

              if (cp === 0) {
                pState.lap += 1;
                if (pState.lap > 3) {
                  pState.finished = true;
                  pState.speed = 0;
                  onUpdateStateRef.current({
                    finished: true,
                    finishTime: Date.now() - (window as any).raceStartTime,
                  });
                }
              }
            }
          }
        }
      }

      // 3. MULTI-CAR PHYSICAL COLLISION RESOLUTION
      if (
        activeRoomStatusRef.current === "racing" ||
        activeRoomStatusRef.current === "countdown"
      ) {
        const carEntities: CarCollisionEntity[] = [];

        if (!pState.finished) {
          carEntities.push({
            id: "local_player",
            x: pState.x,
            z: pState.z,
            rotationY: pState.rotationY - pState.driftAngle,
            speed: pState.speed,
            isLocalPlayer: true,
          });
        }

        if (isSinglePlayer && aiPackStateRef.current.length > 0) {
          aiPackStateRef.current.forEach((aiState, idx) => {
            if (!aiState.player.finished) {
              carEntities.push({
                id: aiState.player.id,
                x: aiState.player.x,
                z: aiState.player.z,
                rotationY: aiState.player.rotationY,
                speed: aiState.player.speed,
                isAI: true,
                aiIndex: idx,
              });
            }
          });
        }

        if (!isSinglePlayer && remotePlayersRef.current.length > 0) {
          remotePlayersRef.current.forEach((rp) => {
            if (!rp.finished) {
              carEntities.push({
                id: rp.id,
                x: rp.x,
                z: rp.z,
                rotationY: rp.rotationY,
                speed: rp.speed,
                isRemote: true,
              });
            }
          });
        }

        if (isSinglePlayer && trafficVehiclesRef.current.length > 0) {
          trafficVehiclesRef.current.forEach((tv, idx) => {
            carEntities.push({
              id: tv.id,
              x: tv.x,
              z: tv.z,
              rotationY: tv.rotationY,
              speed: tv.speed,
              isTraffic: true,
              trafficIndex: idx,
            });
          });
        }

        resolveCarCollisions(carEntities, (event) => {
          if (event.involvesLocalPlayer) {
            playCollisionSound(Math.min(event.intensity / 18, 1.0));
            spawnDust(
              event.contactPoint,
              new THREE.Vector3(
                event.normal.x * 4.5 + (Math.random() - 0.5) * 2,
                1.3 + Math.random(),
                event.normal.y * 4.5 + (Math.random() - 0.5) * 2
              ),
              "#f59e0b"
            );
            spawnDust(
              event.contactPoint,
              new THREE.Vector3(
                -event.normal.x * 4.5 + (Math.random() - 0.5) * 2,
                1.3 + Math.random(),
                -event.normal.y * 4.5 + (Math.random() - 0.5) * 2
              ),
              "#fbbf24"
            );
          }
        });

        for (const ent of carEntities) {
          if (ent.isLocalPlayer) {
            pState.x = ent.x;
            pState.z = ent.z;
            pState.rotationY = ent.rotationY + pState.driftAngle;
            pState.speed = ent.speed;
          } else if (ent.isAI && ent.aiIndex !== undefined) {
            const aiState = aiPackStateRef.current[ent.aiIndex];
            if (aiState) {
              aiState.player.x = ent.x;
              aiState.player.z = ent.z;
              aiState.player.rotationY = ent.rotationY;
              aiState.player.speed = ent.speed;
              aiState.currentSpeed = ent.speed;

              const roadCheckAI = checkOnRoad(new THREE.Vector3(ent.x, 0, ent.z));
              const tangentAI = TRACK_CURVE.getTangentAt(roadCheckAI.u).normalize();
              const normalAI = new THREE.Vector3(-tangentAI.z, 0, tangentAI.x);
              const diffAI = new THREE.Vector3(
                ent.x - roadCheckAI.closestPt.x,
                0,
                ent.z - roadCheckAI.closestPt.z
              );
              const signedOffset = diffAI.dot(normalAI);
              aiState.lateralOffset = THREE.MathUtils.clamp(signedOffset, -4.2, 4.2);
              aiState.targetLateralOffset = aiState.lateralOffset;

              const aiMesh = aiCarMeshes[ent.aiIndex];
              if (aiMesh) {
                const currentY =
                  aiJumpStatesRef.current[ent.aiIndex]?.y || aiState.player.y || 0;
                const currentPitch = aiJumpStatesRef.current[ent.aiIndex]?.pitch || 0;
                aiMesh.position.set(ent.x, currentY, ent.z);
                aiMesh.rotation.y = ent.rotationY;
                aiMesh.rotation.x = currentPitch;
              }
            }
          } else if (ent.isTraffic && ent.trafficIndex !== undefined) {
            const tv = trafficVehiclesRef.current[ent.trafficIndex];
            if (tv) {
              tv.x = ent.x;
              tv.z = ent.z;
              tv.rotationY = ent.rotationY;
              tv.speed = ent.speed;

              const roadCheckTV = checkOnRoad(new THREE.Vector3(ent.x, 0, ent.z));
              const tangentTV = TRACK_CURVE.getTangentAt(roadCheckTV.u).normalize();
              const normalTV = new THREE.Vector3(-tangentTV.z, 0, tangentTV.x);
              const diffTV = new THREE.Vector3(
                ent.x - roadCheckTV.closestPt.x,
                0,
                ent.z - roadCheckTV.closestPt.z
              );
              const signedOffset = diffTV.dot(normalTV);
              tv.lateralOffset = THREE.MathUtils.clamp(signedOffset, -9.0, 9.0);
              tv.targetLateralOffset = tv.lateralOffset;

              const tMesh = trafficMeshes[ent.trafficIndex];
              if (tMesh) {
                tMesh.position.set(ent.x, 0, ent.z);
                tMesh.rotation.y = ent.rotationY;
              }
            }
          }
        }
      }

      // Synchronize player orientation
      playerCar.position.set(pState.x, pState.y, pState.z);
      playerCar.rotation.y = pState.rotationY - pState.driftAngle;
      playerCar.rotation.x = playerJumpStateRef.current.pitch;

      const rearLeftRoll = playerCar.getObjectByName("rearLeft_roll") as THREE.Group;
      const rearRightRoll = playerCar.getObjectByName("rearRight_roll") as THREE.Group;
      const frontLeftRoll = playerCar.getObjectByName("frontLeft_roll") as THREE.Group;
      const frontRightRoll = playerCar.getObjectByName("frontRight_roll") as THREE.Group;

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

      // Particles aging
      const posAttr = particleGeometry.getAttribute("position") as THREE.BufferAttribute;
      for (let p = 0; p < particleCount; p++) {
        if (dustAges[p] >= 0) {
          dustAges[p] += dt;
          if (dustAges[p] > 0.8) {
            dustAges[p] = -1;
            const idx = p * 3;
            dustPositions[idx] = 0;
            dustPositions[idx + 1] = -100;
            dustPositions[idx + 2] = 0;
          } else {
            const idx = p * 3;
            dustPositions[idx] += dustVels[idx] * dt;
            dustPositions[idx + 1] += dustVels[idx + 1] * dt;
            dustPositions[idx + 2] += dustVels[idx + 2] * dt;

            dustVels[idx] *= 0.96;
            dustVels[idx + 1] -= 9.8 * dt * 0.1;
            dustVels[idx + 2] *= 0.96;
          }
        }
      }
      posAttr.needsUpdate = true;

      // Animate checkpoint beacon floating elements
      trackComponents.checkpointBeacons.forEach((beacon) => {
        const diamond = beacon.getObjectByName("hoverDiamond");
        if (diamond) {
          diamond.rotation.y += dt * 2.0;
          diamond.position.y =
            7.4 + Math.sin(currentTime * 0.0035 + beacon.position.x * 0.05) * 0.25;
        }
      });

      // NITROUS EFFECTS SYSTEM
      const isBoostingActive = keys.space || pState.boostTimer > 0;
      const nitroPlumes = playerCar.getObjectByName("nitroPlumes") as THREE.Group;
      if (nitroPlumes) {
        if (isBoostingActive) {
          nitroPlumes.visible = true;
          const flutterScale = 1.0 + Math.sin(currentTime * 0.05) * 0.2;
          const flameL = nitroPlumes.getObjectByName("flameL") as THREE.Group;
          const flameR = nitroPlumes.getObjectByName("flameR") as THREE.Group;
          const nLight = nitroPlumes.getObjectByName("nitroLight") as THREE.PointLight;
          if (flameL) flameL.scale.set(1.0, flutterScale, 1.0);
          if (flameR) flameR.scale.set(1.0, flutterScale, 1.0);
          if (nLight) {
            nLight.intensity = THREE.MathUtils.lerp(nLight.intensity, 2.5, 8 * dt);
          }
        } else {
          nitroPlumes.visible = false;
          const nLight = nitroPlumes.getObjectByName("nitroLight") as THREE.PointLight;
          if (nLight) {
            nLight.intensity = 0;
          }
        }
      }

      // Warp streaks
      if (isBoostingActive && pState.speed > 30) {
        warpMat.opacity = THREE.MathUtils.lerp(warpMat.opacity, 0.75, 10 * dt);
        warpLines.position.set(pState.x, pState.y, pState.z);
        warpLines.rotation.y = pState.rotationY;

        const warpPosAttr = warpGeo.getAttribute("position") as THREE.BufferAttribute;
        const arr = warpPosAttr.array as Float32Array;
        const streakSpeed = Math.max(pState.speed * 1.5, 80);
        for (let i = 0; i < warpStreakCount; i++) {
          const idx = i * 6;
          arr[idx + 2] -= streakSpeed * dt;
          arr[idx + 5] -= streakSpeed * dt;
          if (arr[idx + 5] < -25) {
            arr[idx + 2] += 50;
            arr[idx + 5] += 50;
          }
        }
        warpPosAttr.needsUpdate = true;
      } else {
        warpMat.opacity = THREE.MathUtils.lerp(warpMat.opacity, 0, 8 * dt);
      }

      // Sync Nitro Screen Overlay
      if (nitroOverlayRef.current) {
        const targetOpacity = isBoostingActive ? "1" : "0";
        if (nitroOverlayRef.current.style.opacity !== targetOpacity) {
          nitroOverlayRef.current.style.opacity = targetOpacity;
        }
      }

      // CAMERA ACTIONS
      const rotCos = Math.sin(pState.rotationY);
      const rotSin = Math.cos(pState.rotationY);

      const targetFOV = isBoostingActive ? (keys.space ? 68 : 64) : 60;
      if (Math.abs(camera.fov - targetFOV) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 5.0 * dt);
        camera.updateProjectionMatrix();
      }

      const targetCamDistance = isBoostingActive ? 16.8 : 16;
      const targetCamHeight = isBoostingActive ? 5.0 : 5.2;

      const idealCamX = pState.x - rotCos * targetCamDistance;
      const idealCamY = pState.y + targetCamHeight;
      const idealCamZ = pState.z - rotSin * targetCamDistance;

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, idealCamX, 6.5 * dt);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, idealCamY, 6.5 * dt);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, idealCamZ, 6.5 * dt);

      if (isBoostingActive && pState.speed > 40) {
        const speedRatio = Math.min(pState.speed, 105) / 105;
        const shakeOffset = 0.025 * speedRatio;
        camera.position.x += Math.sin(currentTime * 0.04) * shakeOffset;
        camera.position.y += Math.cos(currentTime * 0.05) * (shakeOffset * 0.5);
      }

      const lookAhead = new THREE.Vector3(
        pState.x + rotCos * 5,
        pState.y + 0.5,
        pState.z + rotSin * 5
      );
      camera.lookAt(lookAhead);

      renderer.render(scene, camera);

      // THROTTLED TELEMETRY TRANSMISSION (15Hz)
      networkSendTimer += dt;
      if (networkSendTimer >= 0.065 && activeRoomStatusRef.current === "racing") {
        networkSendTimer = 0;
        onUpdateStateRef.current({
          x: pState.x,
          y: pState.y,
          z: pState.z,
          rotationY: pState.rotationY,
          speed: pState.speed,
          driftScore: pState.driftScore,
          isDrifting: pState.isDrifting,
          driftMeter: pState.driftMeter,
          totalDriftScore: pState.totalDriftScore,
          lap: Math.min(pState.lap, 3),
          checkpoint: pState.checkpoint,
        });

        if (
          isSinglePlayer &&
          (onAIPackUpdateRef.current || onAIOpponentUpdateRef.current)
        ) {
          const roadCheck = checkOnRoad(new THREE.Vector3(pState.x, pState.y, pState.z));
          const standings = calculateMultiRaceStandings(
            {
              id: localPlayerRef.current.id,
              name: localPlayerRef.current.name || "Solo Driver",
              color: localPlayerRef.current.color,
              lap: pState.lap,
              checkpoint: pState.checkpoint,
              finished: pState.finished,
              finishTime: pState.finished
                ? Date.now() - ((window as any).raceStartTime || Date.now())
                : undefined,
              speed: pState.speed,
              totalDriftScore: pState.totalDriftScore,
            },
            aiPackStateRef.current,
            roadCheck.u,
            trackLength
          );

          if (onAIPackUpdateRef.current) {
            onAIPackUpdateRef.current(
              aiPackStateRef.current.map((s) => s.player),
              standings
            );
          }
          if (onAIOpponentUpdateRef.current && aiPackStateRef.current[0]) {
            onAIOpponentUpdateRef.current(aiPackStateRef.current[0].player, standings);
          }
          if (onTrafficUpdateRef.current) {
            onTrafficUpdateRef.current(trafficVehiclesRef.current);
          }
        }
      }

      requestAnimationFrame(gameLoop);
    };

    const animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      aiCarMeshes.forEach((mesh) => scene.remove(mesh));
      trafficMeshes.forEach((mesh) => scene.remove(mesh));
      renderer.dispose();
      particleGeometry.dispose();
      dustMat.dispose();
      warpGeo.dispose();
      warpMat.dispose();

      speedBreakerMeshes.forEach((mesh) => scene.remove(mesh));
    };
  }, [localPlayer.color, localPlayer.id, theme, trafficCount]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none outline-none overflow-hidden"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Dynamic Airtime / Ramp Jump Banner */}
      <div
        id="jump-airtime-banner"
        ref={jumpOverlayRef}
        style={{ opacity: 0, transform: "translate(-50%, -10px) scale(0.95)" }}
        className="pointer-events-none absolute top-28 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 bg-amber-950/90 border border-amber-400/80 rounded-full text-amber-300 font-mono text-xs font-black tracking-widest uppercase shadow-[0_0_20px_rgba(245,158,11,0.6)] transition-all duration-150 will-change-[opacity,transform] z-30"
      >
        <span className="text-base">🚀</span>
        <span>AIRBORNE JUMP!</span>
        <span
          ref={jumpAltitudeTextRef}
          className="text-white font-black bg-amber-500/30 px-1.5 py-0.5 rounded text-[10px]"
        >
          +2.4m
        </span>
      </div>

      {/* Screen-Space Nitro Burst Radial Vignette */}
      <div
        id="nitro-boost-vignette"
        ref={nitroOverlayRef}
        style={{ opacity: 0 }}
        className="pointer-events-none absolute inset-0 transition-opacity duration-200 will-change-[opacity]"
      >
        <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(6,182,212,0.35)]" />
        <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-cyan-500/20 to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-cyan-500/20 to-transparent pointer-events-none" />

        <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1 bg-cyan-950/90 border border-cyan-400/80 rounded-full text-cyan-300 font-mono text-xs font-black tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.5)]">
          <span className="text-amber-300">⚡</span>
          <span>NITRO BOOST</span>
          <span className="text-cyan-400 text-[10px]">MAX SPEED</span>
        </div>
      </div>
    </div>
  );
}

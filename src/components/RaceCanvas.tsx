import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Player } from "../types";
import { startNitroAudio, stopNitroAudio } from "../utils/audio";
import {
  AIDifficulty,
  AIState,
  createInitialAIState,
  updateAISimulation,
  calculateRaceStandings,
  StandingsResult,
} from "../utils/aiOpponent";

// Definitions of track spline points on the XZ plane (Y = 0)
// Scaled for a fun speedrun length
const TRACK_POINTS = [
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

const TRACK_CURVE = new THREE.CatmullRomCurve3(TRACK_POINTS, true);
const ROAD_WIDTH = 24; // Road width
const CHECKPOINT_COUNT = 5; // Divide the track curve into 5 checkpoints

// Check if a point is on the road within a threshold
function checkOnRoad(point: THREE.Vector3): { isOnRoad: boolean; distance: number; closestPt: THREE.Vector3; u: number } {
  // Sample the spline at fine-grained divisions to find the closest point
  let minDistance = Infinity;
  let closestPt = new THREE.Vector3();
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

interface RaceCanvasProps {
  localPlayer: Player;
  remotePlayers: Player[];
  activeRoomStatus: "lobby" | "countdown" | "racing" | "results";
  onUpdateState: (state: Partial<Player>) => void;
  theme: "light" | "dark";
  isSinglePlayer?: boolean;
  aiDifficulty?: AIDifficulty;
  aiName?: string;
  aiColor?: string;
  onAIOpponentUpdate?: (
    ai: Player,
    standings: StandingsResult
  ) => void;
}

export default function RaceCanvas({
  localPlayer,
  remotePlayers,
  activeRoomStatus,
  onUpdateState,
  theme,
  isSinglePlayer = false,
  aiDifficulty = "medium",
  aiName = "Apex AI",
  aiColor = "#ef4444",
  onAIOpponentUpdate,
}: RaceCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isBoostingUI, setIsBoostingUI] = useState(false);

  // Keep often-changed props in Refs to prevent reconstructing Three.js on every frame
  const localPlayerRef = useRef<Player>(localPlayer);
  const remotePlayersRef = useRef<Player[]>(remotePlayers);
  const activeRoomStatusRef = useRef<string>(activeRoomStatus);
  const onUpdateStateRef = useRef(onUpdateState);
  const onAIOpponentUpdateRef = useRef(onAIOpponentUpdate);

  // AI Opponent simulation state ref
  const aiStateRef = useRef<AIState>(
    createInitialAIState(aiDifficulty, aiName, aiColor)
  );

  useEffect(() => {
    localPlayerRef.current = localPlayer;
  }, [localPlayer]);

  useEffect(() => {
    remotePlayersRef.current = remotePlayers;
  }, [remotePlayers]);

  useEffect(() => {
    activeRoomStatusRef.current = activeRoomStatus;
    if (activeRoomStatus === "countdown" || activeRoomStatus === "lobby") {
      aiStateRef.current = createInitialAIState(aiDifficulty, aiName, aiColor);
    }
  }, [activeRoomStatus, aiDifficulty, aiName, aiColor]);

  useEffect(() => {
    onUpdateStateRef.current = onUpdateState;
  }, [onUpdateState]);

  useEffect(() => {
    onAIOpponentUpdateRef.current = onAIOpponentUpdate;
  }, [onAIOpponentUpdate]);

  // Input states ref
  const keysRef = useRef<{ w: boolean; s: boolean; a: boolean; d: boolean; space: boolean; r: boolean }>({
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

  // Track key actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w" || e.key === "ArrowUp") keysRef.current.w = true;
      if (key === "s" || e.key === "ArrowDown") keysRef.current.s = true;
      if (key === "a" || e.key === "ArrowLeft") keysRef.current.a = true;
      if (key === "d" || e.key === "ArrowRight") keysRef.current.d = true;
      if (e.key === " " || e.code === "Space") {
        if (!keysRef.current.space) {
          startNitroAudio();
          setIsBoostingUI(true);
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
        setIsBoostingUI(false);
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
      // Warm up and reset local physics variables
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

  // Main Three.js setup & game loop (runs once on mount / local player changes)
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // SCENE & RENDERER SETUP
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const isDark = theme === "dark";

    // Set colors according to selected theme
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

    // GRID & ENVIROMENT GROUND
    const gridGeometry = new THREE.PlaneGeometry(800, 800, 80, 80);
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: isDark ? "#1e1b4b" : "#cbd5e1",
      wireframe: true,
      transparent: true,
      opacity: isDark ? 0.25 : 0.45,
    });
    const gridMesh = new THREE.Mesh(gridGeometry, gridMaterial);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.y = -0.1;
    scene.add(gridMesh);

    // Outer space stars decoration
    const starsCount = 300;
    const starsGeo = new THREE.BufferGeometry();
    const starsPos = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      starsPos[i] = (Math.random() - 0.5) * 600;
      starsPos[i + 1] = Math.random() * 200 + 10;
      starsPos[i + 2] = (Math.random() - 0.5) * 600;
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starsPos, 3));
    const starsMat = new THREE.PointsMaterial({
      color: "#ffffff",
      size: 1.2,
      transparent: true,
      opacity: 0.8,
    });
    const starPoints = new THREE.Points(starsGeo, starsMat);
    starPoints.visible = isDark;
    scene.add(starPoints);

    // PROCEDURAL ROAD MESH GENERATION
    // Sample TRACK_CURVE to generate standard geometry of the lane strip
    const sampleCount = 180;
    const roadVertices: number[] = [];
    const roadIndices: number[] = [];
    const roadUVs: number[] = [];

    for (let i = 0; i <= sampleCount; i++) {
      const u = i / sampleCount;
      const point = TRACK_CURVE.getPointAt(u);
      const tangent = TRACK_CURVE.getTangentAt(u).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Left boundary
      const leftPt = point.clone().add(right.clone().multiplyScalar(ROAD_WIDTH / 2));
      // Right boundary
      const rightPt = point.clone().sub(right.clone().multiplyScalar(ROAD_WIDTH / 2));

      roadVertices.push(leftPt.x, leftPt.y, leftPt.z);
      roadVertices.push(rightPt.x, rightPt.y, rightPt.z);

      roadUVs.push(0, u * 12);
      roadUVs.push(1, u * 12);

      if (i < sampleCount) {
        const vIdx = i * 2;
        // Two triangles for each strip segment
        roadIndices.push(vIdx, vIdx + 1, vIdx + 2);
        roadIndices.push(vIdx + 1, vIdx + 3, vIdx + 2);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(roadVertices, 3));
    roadGeo.setAttribute("uv", new THREE.Float32BufferAttribute(roadUVs, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
      color: isDark ? "#111827" : "#334155", // Coal gray or cool slate gray
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    scene.add(roadMesh);

    // ROAD CURBS (Rumble Strips)
    const curbLeftVertices: number[] = [];
    const curbRightVertices: number[] = [];
    const curbLeftIndices: number[] = [];
    const curbRightIndices: number[] = [];

    const curbWidth = 1.2;

    for (let i = 0; i <= sampleCount; i++) {
      const u = i / sampleCount;
      const point = TRACK_CURVE.getPointAt(u);
      const tangent = TRACK_CURVE.getTangentAt(u).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const lOffset = ROAD_WIDTH / 2;
      const lInner = point.clone().add(right.clone().multiplyScalar(lOffset));
      const lOuter = point.clone().add(right.clone().multiplyScalar(lOffset + curbWidth));

      const rOffset = ROAD_WIDTH / 2;
      const rInner = point.clone().sub(right.clone().multiplyScalar(rOffset));
      const rOuter = point.clone().sub(right.clone().multiplyScalar(rOffset + curbWidth));

      // Slightly elevated
      lInner.y += 0.15; lOuter.y += 0.15;
      rInner.y += 0.15; rOuter.y += 0.15;

      curbLeftVertices.push(lInner.x, lInner.y, lInner.z);
      curbLeftVertices.push(lOuter.x, lOuter.y, lOuter.z);

      curbRightVertices.push(rInner.x, rInner.y, rInner.z);
      curbRightVertices.push(rOuter.x, rOuter.y, rOuter.z);

      if (i < sampleCount) {
        const vIdx = i * 2;
        curbLeftIndices.push(vIdx, vIdx + 1, vIdx + 2);
        curbLeftIndices.push(vIdx + 1, vIdx + 3, vIdx + 2);

        curbRightIndices.push(vIdx, vIdx + 1, vIdx + 2);
        curbRightIndices.push(vIdx + 1, vIdx + 3, vIdx + 2);
      }
    }

    const curbLeftGeo = new THREE.BufferGeometry();
    curbLeftGeo.setAttribute("position", new THREE.Float32BufferAttribute(curbLeftVertices, 3));
    curbLeftGeo.setIndex(curbLeftIndices);
    curbLeftGeo.computeVertexNormals();

    const curbRightGeo = new THREE.BufferGeometry();
    curbRightGeo.setAttribute("position", new THREE.Float32BufferAttribute(curbRightVertices, 3));
    curbRightGeo.setIndex(curbRightIndices);
    curbRightGeo.computeVertexNormals();

    const curbMat = new THREE.MeshStandardMaterial({
      color: "#ef4444", // Neon red
      roughness: 0.5,
      metalness: 0.2,
    });
    const curbLeftMesh = new THREE.Mesh(curbLeftGeo, curbMat);
    const curbRightMesh = new THREE.Mesh(curbRightGeo, curbMat);
    scene.add(curbLeftMesh);
    scene.add(curbRightMesh);

    // GLOWING NEON LASER BLOCKADES & PHYSICAL BARRIERS
    const leftFencePoints: THREE.Vector3[] = [];
    const rightFencePoints: THREE.Vector3[] = [];

    for (let i = 0; i <= sampleCount; i++) {
      const u = i / sampleCount;
      const point = TRACK_CURVE.getPointAt(u);
      const tangent = TRACK_CURVE.getTangentAt(u).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const leftEdge = point.clone().add(right.clone().multiplyScalar(ROAD_WIDTH / 2));
      const rightEdge = point.clone().sub(right.clone().multiplyScalar(ROAD_WIDTH / 2));

      // Elevate slightly
      leftEdge.y += 0.8;
      rightEdge.y += 0.8;

      leftFencePoints.push(leftEdge);
      rightFencePoints.push(rightEdge);
    }

    const leftFenceGeo = new THREE.BufferGeometry().setFromPoints(leftFencePoints);
    const rightFenceGeo = new THREE.BufferGeometry().setFromPoints(rightFencePoints);

    const laserMatLeft = new THREE.LineBasicMaterial({
      color: "#ec4899", // Neon rose laser
      linewidth: 3,
    });
    const laserMatRight = new THREE.LineBasicMaterial({
      color: "#06b6d4", // Neon Cyan laser
      linewidth: 3,
    });

    const leftLaserFence = new THREE.LineLoop(leftFenceGeo, laserMatLeft);
    const rightLaserFence = new THREE.LineLoop(rightFenceGeo, laserMatRight);
    scene.add(leftLaserFence);
    scene.add(rightLaserFence);

    // Boundaries are secured by glowing laser lines on the curb borders. No bulky physical pillar posts exist.

    // DECORATIVE SLIDERS - SINGLE-SIDED HIGH TECH TURN CHECKPOINTS
    const arches: THREE.Group[] = [];
    const checkpointsCoordinates: THREE.Vector3[] = [];

    // Reusable geometries to maintain fast garbage collection and rendering
    const beaconBaseGeo = new THREE.CylinderGeometry(1.4, 1.6, 0.45, 12);
    const beaconPoleGeo = new THREE.CylinderGeometry(0.18, 0.22, 6.5, 8);
    const beaconRingGeo = new THREE.TorusGeometry(0.55, 0.07, 6, 16);
    const beaconBallGeo = new THREE.OctahedronGeometry(0.7, 0);
    const beaconConeGeo = new THREE.ConeGeometry(0.4, 1.0, 8);

    const baseMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 });
    const poleMat = new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.8, roughness: 0.2 });

    const neonColors = ["#ec4899", "#22d3ee", "#10b981", "#f59e0b", "#8b5cf6"];

    for (let c = 0; c < CHECKPOINT_COUNT; c++) {
      const u = c / CHECKPOINT_COUNT;
      const point = TRACK_CURVE.getPointAt(u);
      checkpointsCoordinates.push(point);

      const tangent = TRACK_CURVE.getTangentAt(u).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Checkpoint beacon representing a sleek single-sided indicator!
      const beacon = new THREE.Group();
      
      // Alternate left / right sides of the road turns
      const isLeftSide = c % 2 === 0;
      const sideOffset = isLeftSide ? (ROAD_WIDTH / 2 + 1.2) : -(ROAD_WIDTH / 2 + 1.2);
      
      const beaconPos = point.clone().add(right.clone().multiplyScalar(sideOffset));
      beacon.position.copy(beaconPos);

      // Base cylinder
      const baseMesh = new THREE.Mesh(beaconBaseGeo, baseMat);
      baseMesh.position.y = 0.225;
      baseMesh.castShadow = true;
      beacon.add(baseMesh);

      // Main vertical metal pole
      const poleMesh = new THREE.Mesh(beaconPoleGeo, poleMat);
      poleMesh.position.y = 3.25;
      poleMesh.castShadow = true;
      beacon.add(poleMesh);

      // Neon glowing setup
      const colorStr = neonColors[c % neonColors.length];
      const neonColor = new THREE.Color(colorStr);
      const glowMat = new THREE.MeshBasicMaterial({ color: neonColor });

      // Neon Rings stacked along the vertical pole
      for (let j = 0; j < 3; j++) {
        const ringMesh = new THREE.Mesh(beaconRingGeo, glowMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = 1.3 + j * 1.6;
        beacon.add(ringMesh);
      }

      // Floating, rotating Diamond at the very top of the pole
      const diamondMesh = new THREE.Mesh(beaconBallGeo, glowMat);
      diamondMesh.position.y = 7.4;
      diamondMesh.name = "hoverDiamond";
      beacon.add(diamondMesh);

      // Chevron pointer at the top pointing into the road to guide users
      const coneMesh = new THREE.Mesh(beaconConeGeo, glowMat);
      if (isLeftSide) {
        coneMesh.rotation.z = -Math.PI / 2; // points right towards road
        coneMesh.position.set(-0.8, 5.6, 0);
      } else {
        coneMesh.rotation.z = Math.PI / 2; // points left towards road
        coneMesh.position.set(0.8, 5.6, 0);
      }
      beacon.add(coneMesh);

      // Point Light to illuminate the turn area with checkpoint color
      const lit = new THREE.PointLight(colorStr, 2.5, 18);
      lit.position.set(isLeftSide ? -0.8 : 0.8, 7.4, 0);
      beacon.add(lit);

      // Direct facing of the beacon group
      const lookAtTarget = beacon.position.clone().add(tangent);
      beacon.lookAt(lookAtTarget);

      scene.add(beacon);
      arches.push(beacon);
    }

    // CAR RENDER CREATOR
    function createCarMesh(colorHex: string, id: string): THREE.Group {
      const carGroup = new THREE.Group();

      // Main sporty body materials
      const bodyMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.15,
        metalness: 0.85,
      });

      const CarbonMat = new THREE.MeshStandardMaterial({
        color: "#1e293b", // carbon slate color
        roughness: 0.45,
        metalness: 0.9,
      });

      const glassMat = new THREE.MeshStandardMaterial({
        color: "#0891b2", // Cyber glowing cyan glass
        roughness: 0.05,
        metalness: 0.95,
        transparent: true,
        opacity: 0.6,
      });

      const neonMat = new THREE.MeshBasicMaterial({ color: colorHex });

      // -- 1. LOWER SPLITTER & SIDE SKIRTS (GT RACER STYLING) --
      const splitterGeo = new THREE.BoxGeometry(3.6, 0.15, 1.0);
      const splitter = new THREE.Mesh(splitterGeo, CarbonMat);
      splitter.position.set(0, 0.2, 2.8);
      splitter.castShadow = true;
      carGroup.add(splitter);

      const sideSkirtsL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 4.4), CarbonMat);
      sideSkirtsL.position.set(1.7, 0.2, 0);
      carGroup.add(sideSkirtsL);

      const sideSkirtsR = sideSkirtsL.clone();
      sideSkirtsR.position.set(-1.7, 0.2, 0);
      carGroup.add(sideSkirtsR);

      // -- 2. MAIN LOWER CHASSIS --
      const chassisGeo = new THREE.BoxGeometry(3.4, 0.6, 5.8);
      const chassis = new THREE.Mesh(chassisGeo, bodyMat);
      chassis.position.y = 0.5;
      chassis.castShadow = true;
      carGroup.add(chassis);

      // -- 3. FRONT HOOD SCOOP & ENGINE VENT --
      const hoodGeo = new THREE.BoxGeometry(2.8, 0.35, 1.8);
      const hood = new THREE.Mesh(hoodGeo, bodyMat);
      hood.position.set(0, 0.75, 1.8);
      hood.rotation.x = -0.05; // slanted forward hood
      hood.castShadow = true;
      carGroup.add(hood);

      const scoopGeo = new THREE.BoxGeometry(1.2, 0.12, 0.8);
      const scoop = new THREE.Mesh(scoopGeo, CarbonMat);
      scoop.position.set(0, 0.9, 1.4);
      carGroup.add(scoop);

      // -- 4. SLEEK WINDSHIELD & CABIN (GREENHOUSE CANOPY) --
      const cabinGroup = new THREE.Group();
      cabinGroup.position.set(0, 0.8, -0.4);

      // Main cab structure
      const mainCab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.65, 2.6), bodyMat);
      mainCab.position.set(0, 0.325, 0);
      cabinGroup.add(mainCab);

      // Angled windshield glass
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.65, 1.6), glassMat);
      windshield.position.set(0, 0.4, 0.7);
      windshield.rotation.x = -0.42; // Slanted windshield
      cabinGroup.add(windshield);

      // Side windows
      const sideWindowL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 1.8), glassMat);
      sideWindowL.position.set(1.21, 0.325, -0.1);
      cabinGroup.add(sideWindowL);

      const sideWindowR = sideWindowL.clone();
      sideWindowR.position.set(-1.21, 0.325, -0.1);
      cabinGroup.add(sideWindowR);

      // Cab Roof Panel
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.9), CarbonMat);
      roof.position.set(0, 0.65, -0.2);
      cabinGroup.add(roof);

      carGroup.add(cabinGroup);

      // -- 5. WHEEL SYSTEM WITH GLOWING COLOURED RIMS --
      const outerWheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.7, 16);
      const innerRimGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.75, 12);
      const tireMat = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.9 });

      function makeGlossyWheel(name: string, posX: number, posZ: number): THREE.Group {
        const wheelObj = new THREE.Group();
        wheelObj.name = name;
        wheelObj.position.set(posX, 0.5, posZ);

        // Subgroup for rolling/spinning along the wheel axle (X axis)
        const rollObj = new THREE.Group();
        rollObj.name = `${name}_roll`;

        // Core tire
        const tire = new THREE.Mesh(outerWheelGeo, tireMat);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        rollObj.add(tire);

        // Neon rim hubcap
        const rim = new THREE.Mesh(innerRimGeo, neonMat);
        rim.rotation.z = Math.PI / 2;
        rollObj.add(rim);

        wheelObj.add(rollObj);
        return wheelObj;
      }

      carGroup.add(makeGlossyWheel("frontLeft", 1.8, 1.9));
      carGroup.add(makeGlossyWheel("frontRight", -1.8, 1.9));
      carGroup.add(makeGlossyWheel("rearLeft", 1.8, -1.9));
      carGroup.add(makeGlossyWheel("rearRight", -1.8, -1.9));

      // -- 6. AERODYNAMIC GT WING (SPOILER) --
      const spoilerGroup = new THREE.Group();
      spoilerGroup.position.set(0, 0.8, -2.6);

      // Twin mounting struts
      const strutGeo = new THREE.BoxGeometry(0.12, 0.75, 0.4);
      const strutL = new THREE.Mesh(strutGeo, CarbonMat);
      strutL.position.set(1.1, 0.375, -0.15);
      strutL.rotation.x = -0.12;
      spoilerGroup.add(strutL);

      const strutR = strutL.clone();
      strutR.position.set(-1.1, 0.375, -0.15);
      spoilerGroup.add(strutR);

      // Wide main wing blade
      const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.12, 1.2), bodyMat);
      wingBlade.position.set(0, 0.75, -0.2);
      wingBlade.rotation.x = 0.08; // slightly pitched for aero aesthetic
      spoilerGroup.add(wingBlade);

      // Vertical side winglets (endplates)
      const wingletL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 1.4), CarbonMat);
      wingletL.position.set(2.15, 0.75, -0.2);
      spoilerGroup.add(wingletL);

      const wingletR = wingletL.clone();
      wingletR.position.set(-2.15, 0.75, -0.2);
      spoilerGroup.add(wingletR);

      carGroup.add(spoilerGroup);

      // -- 7. TUNER LIGHTS & HIGH FLOW EXHAUST PIPES --
      const lightGeo = new THREE.BoxGeometry(0.5, 0.18, 0.1);
      const headMat = new THREE.MeshBasicMaterial({ color: "#e0f2fe" }); // Xenon white
      const brakeColorMat = new THREE.MeshBasicMaterial({ color: "#ef4444" }); // Bright red brake

      // Xenon Headlights
      const headlightL = new THREE.Mesh(lightGeo, headMat);
      headlightL.position.set(1.15, 0.55, 2.91);
      carGroup.add(headlightL);

      const headlightR = headlightL.clone();
      headlightR.position.set(-1.15, 0.55, 2.91);
      carGroup.add(headlightR);

      // Brake Taillights
      const brakeLightL = new THREE.Mesh(lightGeo, brakeColorMat);
      brakeLightL.position.set(1.15, 0.55, -2.91);
      brakeLightL.name = "brakeLightL";
      carGroup.add(brakeLightL);

      const brakeLightR = brakeLightL.clone();
      brakeLightR.position.set(-1.15, 0.55, -2.91);
      brakeLightR.name = "brakeLightR";
      carGroup.add(brakeLightR);

      // High flow exhausts with orange interior flame glow details
      const exhaustGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.6, 8);
      const exhaustMat = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.1, metalness: 0.9 });
      const flameMat = new THREE.MeshBasicMaterial({ color: "#f97316" }); // Core exhaust flare

      const exhaustPipeL = new THREE.Mesh(exhaustGeo, exhaustMat);
      exhaustPipeL.rotation.x = Math.PI / 2;
      exhaustPipeL.position.set(0.6, 0.35, -2.9);
      carGroup.add(exhaustPipeL);

      const exhaustCoreL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8), flameMat);
      exhaustCoreL.rotation.x = Math.PI / 2;
      exhaustCoreL.position.set(0.6, 0.35, -3.16);
      carGroup.add(exhaustCoreL);

      const exhaustPipeR = exhaustPipeL.clone();
      exhaustPipeR.position.set(-0.6, 0.35, -2.9);
      carGroup.add(exhaustPipeR);

      const exhaustCoreR = exhaustCoreL.clone();
      exhaustCoreR.position.set(-0.6, 0.35, -3.16);
      carGroup.add(exhaustCoreR);

      // -- 7B. DYNAMIC 3D NITRO FLAME PLUMES (Visible when boosting) --
      const nitroPlumes = new THREE.Group();
      nitroPlumes.name = "nitroPlumes";
      nitroPlumes.visible = false;

      const flameOuterGeo = new THREE.ConeGeometry(0.3, 2.4, 8);
      flameOuterGeo.translate(0, -1.2, 0); // origin at base attaching to exhaust pipe
      const flameOuterMat = new THREE.MeshBasicMaterial({
        color: "#06b6d4", // Electric cyan plasma
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });

      const flameInnerGeo = new THREE.ConeGeometry(0.16, 1.8, 8);
      flameInnerGeo.translate(0, -0.9, 0);
      const flameInnerMat = new THREE.MeshBasicMaterial({
        color: "#ffffff", // Superheated white core
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      });

      // Left exhaust plume
      const flameL = new THREE.Group();
      flameL.name = "flameL";
      flameL.position.set(0.6, 0.35, -3.18);
      flameL.rotation.x = -Math.PI / 2; // Point backward (-Z)
      flameL.add(new THREE.Mesh(flameOuterGeo, flameOuterMat));
      flameL.add(new THREE.Mesh(flameInnerGeo, flameInnerMat));
      nitroPlumes.add(flameL);

      // Right exhaust plume
      const flameR = new THREE.Group();
      flameR.name = "flameR";
      flameR.position.set(-0.6, 0.35, -3.18);
      flameR.rotation.x = -Math.PI / 2; // Point backward (-Z)
      flameR.add(new THREE.Mesh(flameOuterGeo, flameOuterMat));
      flameR.add(new THREE.Mesh(flameInnerGeo, flameInnerMat));
      nitroPlumes.add(flameR);

      // Dynamic glowing point light from the nitrous backfire
      const nitroLight = new THREE.PointLight("#06b6d4", 3.0, 16);
      nitroLight.name = "nitroLight";
      nitroLight.position.set(0, 0.4, -3.4);
      nitroPlumes.add(nitroLight);

      carGroup.add(nitroPlumes);

      // -- 8. REAL-TIME VEHICULAR LIGHTING (COLOURED UNDERGLOW SYSTEM) --
      const underglowGeo = new THREE.PlaneGeometry(2.4, 4.4);
      const underglowMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide
      });
      const underglow = new THREE.Mesh(underglowGeo, underglowMat);
      underglow.rotation.x = Math.PI / 2;
      underglow.position.set(0, 0.05, 0); // floats slightly above actual road level
      carGroup.add(underglow);

      const underGlowLight = new THREE.PointLight(colorHex, 1.8, 8);
      underGlowLight.position.set(0, 0.1, 0);
      carGroup.add(underGlowLight);

      return carGroup;
    }

    // Local player car 3D representation
    const playerCar = createCarMesh(localPlayerRef.current.color, localPlayerRef.current.id);
    scene.add(playerCar);

    // Remote cars directory
    const remoteCarsMap = new Map<string, { group: THREE.Group; targetPos: THREE.Vector3; targetRotY: number }>();

    // Expose particle dust/trail
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 60;
    const dustPositions = new Float32Array(particleCount * 3);
    const dustAges = new Float32Array(particleCount);
    const dustVels = new Float32Array(particleCount * 3);

    for (let p = 0; p < particleCount; p++) {
      dustAges[p] = -1; // inactive
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

    // 3D WARP SPEED STREAKS (Hyperspeed lines active when boosting)
    const warpStreakCount = 80;
    const warpGeo = new THREE.BufferGeometry();
    const warpPositions = new Float32Array(warpStreakCount * 6); // 2 vertices per line (start & end)
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
      warpPositions[idx + 5] = zOffset + 8 + Math.random() * 8; // streak length along forward/backward axis
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
          dustAges[p] = 0; // birth
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

    // HANDLE DYNAMIC WIN RESIZES
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

    // Spawn dedicated AI Car if in Single Player mode
    let aiCarMesh: THREE.Group | null = null;
    if (isSinglePlayer) {
      aiCarMesh = createCarMesh(aiColor || "#ef4444", "ai_opponent");
      scene.add(aiCarMesh);
    }

    // LOGIC TICK VARIABLES
    let lastTime = performance.now();
    let networkSendTimer = 0;
    let currentSteerAngle = 0;

    const gameLoop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap delta time at 100ms
      lastTime = currentTime;

      const pState = carStateRef.current;
      const keys = keysRef.current;

      // 1. UPDATE REMOTE CARS SPATIAL SYNC (LERP)
      // Check the latest remotePlayers state synced down from server
      remotePlayersRef.current.forEach((rp) => {
        let entry = remoteCarsMap.get(rp.id);
        if (!entry) {
          // Spawn remote car
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

        // Apply smooth lerping to prevent stuttering
        entry.group.position.lerp(entry.targetPos, 0.15);

        // Circular rotation wrapping lerp
        let diff = entry.targetRotY - entry.group.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        entry.group.rotation.y += diff * 0.15;

        // Hide if finished locally
        if (rp.finished) {
          entry.group.position.y = -100; // Bury underneath the world
        } else {
          entry.group.position.y = 0;
        }
      });

      // Purge decommissioned remote cars
      for (const [rid, rCar] of remoteCarsMap.entries()) {
        if (!remotePlayersRef.current.some((rp) => rp.id === rid)) {
          scene.remove(rCar.group);
          remoteCarsMap.delete(rid);
        }
      }

      // 1B. UPDATE AI OPPONENT DRIVING SIMULATION (Single Player)
      if (isSinglePlayer && aiCarMesh) {
        const roadCheckPlayer = checkOnRoad(new THREE.Vector3(pState.x, pState.y, pState.z));
        const playerContinuousProg = pState.finished ? 3.0 : (Math.max(0, pState.lap - 1) + roadCheckPlayer.u);

        aiStateRef.current = updateAISimulation(
          aiStateRef.current,
          dt,
          TRACK_CURVE,
          trackLength,
          activeRoomStatusRef.current as any,
          (window as any).raceStartTime || Date.now(),
          playerContinuousProg,
          pState.speed
        );

        const aiP = aiStateRef.current.player;
        aiCarMesh.position.set(aiP.x, aiP.y, aiP.z);
        aiCarMesh.rotation.y = aiP.rotationY;

        // Roll AI wheels
        const aiRollScalar = aiP.speed * dt * 0.8;
        const aiRL = aiCarMesh.getObjectByName("rearLeft_roll") as THREE.Group;
        const aiRR = aiCarMesh.getObjectByName("rearRight_roll") as THREE.Group;
        const aiFL = aiCarMesh.getObjectByName("frontLeft_roll") as THREE.Group;
        const aiFR = aiCarMesh.getObjectByName("frontRight_roll") as THREE.Group;
        if (aiRL) aiRL.rotation.x += aiRollScalar;
        if (aiRR) aiRR.rotation.x += aiRollScalar;
        if (aiFL) aiFL.rotation.x += aiRollScalar;
        if (aiFR) aiFR.rotation.x += aiRollScalar;

        // AI Brake light reactivity
        const aiBrakeL = aiCarMesh.getObjectByName("brakeLightL") as THREE.Mesh;
        const aiBrakeR = aiCarMesh.getObjectByName("brakeLightR") as THREE.Mesh;
        if (aiBrakeL && aiBrakeR) {
          if (aiStateRef.current.currentSpeed < 35 && activeRoomStatusRef.current === "racing") {
            (aiBrakeL.material as THREE.MeshBasicMaterial).color.set("#ef4444");
            (aiBrakeR.material as THREE.MeshBasicMaterial).color.set("#ef4444");
          } else {
            (aiBrakeL.material as THREE.MeshBasicMaterial).color.set("#7f1d1d");
            (aiBrakeR.material as THREE.MeshBasicMaterial).color.set("#7f1d1d");
          }
        }

        // AI Nitro plume visibility
        const aiNitro = aiCarMesh.getObjectByName("nitroPlumes") as THREE.Group;
        if (aiNitro) {
          aiNitro.visible = aiStateRef.current.boostTimer > 0;
        }

        // AI Drift smoke particles
        if (aiP.isDrifting && Math.random() < 0.3) {
          const rotCos = Math.sin(aiP.rotationY);
          const rotSin = Math.cos(aiP.rotationY);
          const exhaustPos = new THREE.Vector3(aiP.x - rotCos * 2.5, 0.4, aiP.z - rotSin * 2.5);
          spawnDust(exhaustPos, new THREE.Vector3(-rotCos * 3, 1.0, -rotSin * 3), aiP.color);
        }
      }

      // 2. RUN LOCAL CAR DRIVING PHYSICS
      if (activeRoomStatusRef.current === "racing" && !pState.finished) {
        // Evaluate track bounds and blockade collision
        const localPos = new THREE.Vector3(pState.x, pState.y, pState.z);
        const roadCheck = checkOnRoad(localPos);
        const maxAllowedDist = ROAD_WIDTH / 2 - 1.8;

        if (roadCheck.distance > maxAllowedDist) {
          // Solid blockade contact! Force car back onto road limits
          const toCar = localPos.clone().sub(roadCheck.closestPt);
          toCar.y = 0;
          toCar.normalize();

          const correctedPos = roadCheck.closestPt.clone().add(toCar.multiplyScalar(maxAllowedDist));
          pState.x = correctedPos.x;
          pState.z = correctedPos.z;

          // Align car rotation toward the road forward tangent so they don't get stuck sideways/backward
          const roadTangent = TRACK_CURVE.getTangentAt(roadCheck.u).normalize();
          const targetHeading = Math.atan2(roadTangent.x, roadTangent.z);
          let angleDiff = targetHeading - pState.rotationY;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          pState.rotationY += angleDiff * 0.25; // Smoothened auto-reorientation loop!

          // On each crash into the wall, reduce speed just a bit (dampen speed by 10%, with a lower cap of 18)
          pState.speed = Math.max(pState.speed * 0.90, 18);

          // Cancel active drifts upon boundary crash
          if (pState.isDrifting) {
            pState.isDrifting = false;
            pState.driftScore = 0;
            pState.driftMeter = 0;
          }

          // Spawn brilliant bright spark feedback particles at safety barrier contact!
          if (Math.random() < 0.6) {
            const sparkDir = new THREE.Vector3(
              Math.sin(pState.rotationY) + (Math.random() - 0.5),
              0.5 + Math.random(),
              Math.cos(pState.rotationY) + (Math.random() - 0.5)
            ).normalize();
            spawnDust(correctedPos, sparkDir, "#ef4444");
          }
        }

        // Speed Boost state (Nitro)
        if (keys.space && activeRoomStatusRef.current === "racing") {
          pState.boostTimer = Math.max(pState.boostTimer, 0.5); // Hold space to keep nitro active
        } else if (pState.boostTimer > 0) {
          pState.boostTimer -= dt;
          if (pState.boostTimer <= 0) pState.boostTimer = 0;
        }

        const targetMaxSpeed = pState.boostTimer > 0 ? 105 : 62;

        // Acceleration physics
        const accelRate = 22.0;
        const nitroAccelRate = 45.0; // High performance nitro boost!
        const brakeRate = 33.0;
        const frictionRate = 6.0;

        if (keys.space) {
          // Nitro adds direct forward acceleration!
          if (pState.speed < targetMaxSpeed) {
            pState.speed += nitroAccelRate * dt;
          } else {
            pState.speed -= Math.min(nitroAccelRate * 0.5 * dt, pState.speed - targetMaxSpeed);
          }
          
          // Spawn twin cyan exhaust flame particles for nitro look!
          if (Math.random() < 0.6) {
            const rotCos = Math.sin(pState.rotationY);
            const rotSin = Math.cos(pState.rotationY);
            // Spawn bright cyan sparks representing hot exhaust backfire in rear
            const leftExhaust = localPos.clone().add(new THREE.Vector3(-rotCos * 2.8 - 0.6, 0.35, -rotSin * 2.8));
            const rightExhaust = localPos.clone().add(new THREE.Vector3(-rotCos * 2.8 + 0.6, 0.35, -rotSin * 2.8));
            spawnDust(leftExhaust, new THREE.Vector3(-rotCos * 4, 0.5 + Math.random() * 1.5, -rotSin * 4), "#06b6d4");
            spawnDust(rightExhaust, new THREE.Vector3(-rotCos * 4, 0.5 + Math.random() * 1.5, -rotSin * 4), "#06b6d4");
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
          // Natural friction friction deacceleration
          if (pState.speed > 0) {
            pState.speed -= frictionRate * dt;
            if (pState.speed < 0) pState.speed = 0;
          } else if (pState.speed < 0) {
            pState.speed += frictionRate * dt;
            if (pState.speed > 0) pState.speed = 0;
          }
        }

        // Steering dynamics - tuned to place optimal weight so steering is smooth and highly controllable
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
        currentSteerAngle = THREE.MathUtils.lerp(currentSteerAngle, targetSteer, Math.min(14 * dt, 1));

        const fl = playerCar.getObjectByName("frontLeft") as THREE.Group;
        const fr = playerCar.getObjectByName("frontRight") as THREE.Group;
        if (fl) fl.rotation.y = currentSteerAngle;
        if (fr) fr.rotation.y = currentSteerAngle;

        // DRIFT MECHANICAL TRIGGERS - Automatically drift when steering at high speed!
        const canDrift = Math.abs(pState.speed) > 28;
        const isSteering = keys.a || keys.d;
        
        if (canDrift && isSteering) {
          if (!pState.isDrifting) {
            pState.isDrifting = true;
          }

          const driftRate = 0.8;
          const targetDriftAngle = keys.a ? 0.38 : -0.38;
          pState.driftAngle = THREE.MathUtils.lerp(pState.driftAngle, targetDriftAngle, driftRate * dt * 5);

          const scoreDelta = Math.round(Math.abs(pState.speed) * Math.abs(pState.driftAngle) * 5 * dt);
          pState.driftScore += scoreDelta;
          pState.driftMeter = Math.min(pState.driftMeter + scoreDelta * 0.4, 100);

          // Drift smoke particles from rear tires
          if (Math.random() < 0.4) {
            const rotCos = Math.sin(pState.rotationY);
            const rotSin = Math.cos(pState.rotationY);
            const exhaustPos = localPos.clone().add(new THREE.Vector3(-rotCos * 2.5, 0.4, -rotSin * 2.5));
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

        // Displacement calculation (positive z-forward tracking)
        const driveAngle = pState.rotationY - pState.driftAngle * 0.7;
        const dx = Math.sin(driveAngle) * pState.speed * dt;
        const dz = Math.cos(driveAngle) * pState.speed * dt;

        pState.x += dx;
        pState.z += dz;

        // Respawn action
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

        // Checkpoints processing
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

      // Synchronize player orientation
      playerCar.position.set(pState.x, pState.y, pState.z);
      playerCar.rotation.y = pState.rotationY - pState.driftAngle;

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
      arches.forEach((beacon) => {
        const diamond = beacon.getObjectByName("hoverDiamond");
        if (diamond) {
          diamond.rotation.y += dt * 2.0;
          // Hover up/down slightly base on time and index position
          diamond.position.y = 7.4 + Math.sin(currentTime * 0.0035 + beacon.position.x * 0.05) * 0.25;
        }
      });

      // -- NITROUS EFFECTS SYSTEM --
      const isBoostingActive = keys.space || pState.boostTimer > 0;
      const nitroPlumes = playerCar.getObjectByName("nitroPlumes") as THREE.Group;
      if (nitroPlumes) {
        if (isBoostingActive) {
          nitroPlumes.visible = true;
          const flutterScale = 1.0 + Math.sin(currentTime * 0.06) * 0.3 + (Math.random() - 0.5) * 0.25;
          const flameL = nitroPlumes.getObjectByName("flameL") as THREE.Group;
          const flameR = nitroPlumes.getObjectByName("flameR") as THREE.Group;
          const nLight = nitroPlumes.getObjectByName("nitroLight") as THREE.PointLight;
          if (flameL) flameL.scale.set(1.0 + (Math.random() - 0.5) * 0.2, flutterScale, 1.0 + (Math.random() - 0.5) * 0.2);
          if (flameR) flameR.scale.set(1.0 + (Math.random() - 0.5) * 0.2, flutterScale, 1.0 + (Math.random() - 0.5) * 0.2);
          if (nLight) {
            nLight.intensity = 2.5 + Math.random() * 2.0;
          }
        } else {
          nitroPlumes.visible = false;
        }
      }

      // Stream warp speed streaks
      if (isBoostingActive && pState.speed > 30) {
        warpMat.opacity = THREE.MathUtils.lerp(warpMat.opacity, 0.85, 12 * dt);
        warpLines.position.set(pState.x, pState.y, pState.z);
        warpLines.rotation.y = pState.rotationY;

        const warpPosAttr = warpGeo.getAttribute("position") as THREE.BufferAttribute;
        const arr = warpPosAttr.array as Float32Array;
        const streakSpeed = Math.max(pState.speed * 1.6, 90);
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
        warpMat.opacity = THREE.MathUtils.lerp(warpMat.opacity, 0, 10 * dt);
      }

      // CAMERA ACTIONS (Adjusted behind-the-car perspective for correct +Z forward direction)
      const rotCos = Math.sin(pState.rotationY);
      const rotSin = Math.cos(pState.rotationY);

      // Camera FOV expansion: Warp tunnel zoom when nitrous spacebar is held!
      const targetFOV = isBoostingActive ? (keys.space ? 78 : 70) : 60;
      if (Math.abs(camera.fov - targetFOV) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 8 * dt);
        camera.updateProjectionMatrix();
      }

      const targetCamDistance = isBoostingActive ? 17.5 : 16;
      const targetCamHeight = isBoostingActive ? 4.9 : 5.2;

      const idealCamX = pState.x - rotCos * targetCamDistance;
      const idealCamY = pState.y + targetCamHeight;
      const idealCamZ = pState.z - rotSin * targetCamDistance;

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, idealCamX, 6.5 * dt);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, idealCamY, 6.5 * dt);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, idealCamZ, 6.5 * dt);

      // Add high-speed camera rumble/vibration when boosting
      if (isBoostingActive && pState.speed > 40) {
        const shake = 0.08 * (Math.min(pState.speed, 105) / 105);
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        camera.position.z += (Math.random() - 0.5) * shake;
      }

      const lookAhead = new THREE.Vector3(
        pState.x + rotCos * 5,
        pState.y + 0.5,
        pState.z + rotSin * 5
      );
      camera.lookAt(lookAhead);

      renderer.render(scene, camera);

      // THROTTLED NET & TELEMETRY TRANSMISSION (15Hz) - perfectly smooth for HUD gauges without React render churn
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

        if (isSinglePlayer && onAIOpponentUpdateRef.current) {
          const roadCheck = checkOnRoad(new THREE.Vector3(pState.x, pState.y, pState.z));
          const standings = calculateRaceStandings(
            {
              name: localPlayerRef.current.name || "Solo Driver",
              lap: pState.lap,
              checkpoint: pState.checkpoint,
              finished: pState.finished,
              finishTime: pState.finished ? (Date.now() - ((window as any).raceStartTime || Date.now())) : undefined,
            },
            aiStateRef.current.player,
            roadCheck.u,
            aiStateRef.current.u,
            trackLength
          );
          onAIOpponentUpdateRef.current(aiStateRef.current.player, standings);
        }
      }

      requestAnimationFrame(gameLoop);
    };

    const animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      if (aiCarMesh) scene.remove(aiCarMesh);
      renderer.dispose();
      roadGeo.dispose();
      roadMat.dispose();
      curbLeftGeo.dispose();
      curbRightGeo.dispose();
      curbMat.dispose();
      leftFenceGeo.dispose();
      rightFenceGeo.dispose();
      laserMatLeft.dispose();
      laserMatRight.dispose();
      gridGeometry.dispose();
      gridMaterial.dispose();
      starsGeo.dispose();
      starsMat.dispose();
      particleGeometry.dispose();
      dustMat.dispose();
      warpGeo.dispose();
      warpMat.dispose();

      // Dispose beacon elements
      beaconBaseGeo.dispose();
      beaconPoleGeo.dispose();
      beaconRingGeo.dispose();
      beaconBallGeo.dispose();
      beaconConeGeo.dispose();
      baseMat.dispose();
      poleMat.dispose();
    };
  }, [localPlayer.color, localPlayer.id, theme]);

  return (
    <div ref={containerRef} className="relative w-full h-full select-none outline-none overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Screen-Space Nitro Burst Radial Vignette & Warp FX */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-150 ${
          isBoostingUI ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Electric cyan peripheral edge glow */}
        <div className="absolute inset-0 shadow-[inset_0_0_90px_rgba(6,182,212,0.45)]" />

        {/* Dynamic speed-line edge streaks */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-cyan-500/25 to-transparent pointer-events-none animate-pulse" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-cyan-500/25 to-transparent pointer-events-none animate-pulse" />

        {/* Top Nitro Banner Badge */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 bg-cyan-950/85 border border-cyan-400/80 rounded-full text-cyan-300 font-mono text-xs font-black tracking-widest uppercase shadow-[0_0_20px_rgba(6,182,212,0.6)] animate-bounce backdrop-blur-sm">
          <span className="text-amber-300">⚡</span>
          <span>NITRO BOOST ACTIVATED</span>
          <span className="text-cyan-400 text-[10px]">MAX SPEED</span>
        </div>
      </div>
    </div>
  );
}

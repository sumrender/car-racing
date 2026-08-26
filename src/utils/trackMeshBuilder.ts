import * as THREE from "three";
import { TRACK_CURVE, ROAD_WIDTH, CHECKPOINT_COUNT } from "../constants/track";
import { NEON_CHECKPOINT_COLORS } from "../constants/colors";

export interface TrackSceneComponents {
  roadMesh: THREE.Mesh;
  curbLeftMesh: THREE.Mesh;
  curbRightMesh: THREE.Mesh;
  leftLaserFence: THREE.LineLoop;
  rightLaserFence: THREE.LineLoop;
  checkpointBeacons: THREE.Group[];
  checkpointPositions: THREE.Vector3[];
  gridMesh: THREE.Mesh;
  starPoints: THREE.Points;
}

export function buildTrackSceneComponents(isDark: boolean): TrackSceneComponents {
  const sampleCount = 180;

  // 1. PROCEDURAL ROAD MESH
  const roadVertices: number[] = [];
  const roadIndices: number[] = [];
  const roadUVs: number[] = [];

  for (let i = 0; i <= sampleCount; i++) {
    const u = i / sampleCount;
    const point = TRACK_CURVE.getPointAt(u);
    const tangent = TRACK_CURVE.getTangentAt(u).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const leftPt = point.clone().add(right.clone().multiplyScalar(ROAD_WIDTH / 2));
    const rightPt = point.clone().sub(right.clone().multiplyScalar(ROAD_WIDTH / 2));

    roadVertices.push(leftPt.x, leftPt.y, leftPt.z);
    roadVertices.push(rightPt.x, rightPt.y, rightPt.z);

    roadUVs.push(0, u * 12);
    roadUVs.push(1, u * 12);

    if (i < sampleCount) {
      const vIdx = i * 2;
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
    color: isDark ? "#111827" : "#334155",
    roughness: 0.7,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);

  // 2. ROAD CURBS (Rumble Strips)
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
    color: "#ef4444",
    roughness: 0.5,
    metalness: 0.2,
  });
  const curbLeftMesh = new THREE.Mesh(curbLeftGeo, curbMat);
  const curbRightMesh = new THREE.Mesh(curbRightGeo, curbMat);

  // 3. GLOWING NEON LASER BLOCKADES
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

    leftEdge.y += 0.8;
    rightEdge.y += 0.8;

    leftFencePoints.push(leftEdge);
    rightFencePoints.push(rightEdge);
  }

  const leftFenceGeo = new THREE.BufferGeometry().setFromPoints(leftFencePoints);
  const rightFenceGeo = new THREE.BufferGeometry().setFromPoints(rightFencePoints);

  const laserMatLeft = new THREE.LineBasicMaterial({
    color: "#ec4899",
    linewidth: 3,
  });
  const laserMatRight = new THREE.LineBasicMaterial({
    color: "#06b6d4",
    linewidth: 3,
  });

  const leftLaserFence = new THREE.LineLoop(leftFenceGeo, laserMatLeft);
  const rightLaserFence = new THREE.LineLoop(rightFenceGeo, laserMatRight);

  // 4. CHECKPOINT BEACONS
  const checkpointBeacons: THREE.Group[] = [];
  const checkpointPositions: THREE.Vector3[] = [];

  const beaconBaseGeo = new THREE.CylinderGeometry(1.4, 1.6, 0.45, 12);
  const beaconPoleGeo = new THREE.CylinderGeometry(0.18, 0.22, 6.5, 8);
  const beaconRingGeo = new THREE.TorusGeometry(0.55, 0.07, 6, 16);
  const beaconBallGeo = new THREE.OctahedronGeometry(0.7, 0);
  const beaconConeGeo = new THREE.ConeGeometry(0.4, 1.0, 8);

  const baseMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 });
  const poleMat = new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.8, roughness: 0.2 });

  for (let c = 0; c < CHECKPOINT_COUNT; c++) {
    const u = c / CHECKPOINT_COUNT;
    const point = TRACK_CURVE.getPointAt(u);
    checkpointPositions.push(point);

    const tangent = TRACK_CURVE.getTangentAt(u).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const beacon = new THREE.Group();
    const isLeftSide = c % 2 === 0;
    const sideOffset = isLeftSide ? (ROAD_WIDTH / 2 + 1.2) : -(ROAD_WIDTH / 2 + 1.2);
    const beaconPos = point.clone().add(right.clone().multiplyScalar(sideOffset));
    beacon.position.copy(beaconPos);

    // Base cylinder
    const baseMesh = new THREE.Mesh(beaconBaseGeo, baseMat);
    baseMesh.position.y = 0.225;
    baseMesh.castShadow = true;
    beacon.add(baseMesh);

    // Pole
    const poleMesh = new THREE.Mesh(beaconPoleGeo, poleMat);
    poleMesh.position.y = 3.25;
    poleMesh.castShadow = true;
    beacon.add(poleMesh);

    // Glow material
    const colorStr = NEON_CHECKPOINT_COLORS[c % NEON_CHECKPOINT_COLORS.length];
    const neonColor = new THREE.Color(colorStr);
    const glowMat = new THREE.MeshBasicMaterial({ color: neonColor });

    for (let j = 0; j < 3; j++) {
      const ringMesh = new THREE.Mesh(beaconRingGeo, glowMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 1.3 + j * 1.6;
      beacon.add(ringMesh);
    }

    const diamondMesh = new THREE.Mesh(beaconBallGeo, glowMat);
    diamondMesh.position.y = 7.4;
    diamondMesh.name = "hoverDiamond";
    beacon.add(diamondMesh);

    const coneMesh = new THREE.Mesh(beaconConeGeo, glowMat);
    if (isLeftSide) {
      coneMesh.rotation.z = -Math.PI / 2;
      coneMesh.position.set(-0.8, 5.6, 0);
    } else {
      coneMesh.rotation.z = Math.PI / 2;
      coneMesh.position.set(0.8, 5.6, 0);
    }
    beacon.add(coneMesh);

    const lit = new THREE.PointLight(colorStr, 2.5, 18);
    lit.position.set(isLeftSide ? -0.8 : 0.8, 7.4, 0);
    beacon.add(lit);

    const lookAtTarget = beacon.position.clone().add(tangent);
    beacon.lookAt(lookAtTarget);

    checkpointBeacons.push(beacon);
  }

  // 5. GRID & ENVIRONMENT GROUND
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

  // 6. OUTER SPACE STARS
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

  return {
    roadMesh,
    curbLeftMesh,
    curbRightMesh,
    leftLaserFence,
    rightLaserFence,
    checkpointBeacons,
    checkpointPositions,
    gridMesh,
    starPoints,
  };
}

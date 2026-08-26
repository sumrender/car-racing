import * as THREE from "three";

/**
 * Creates a high-performance, stylized 3D sport car mesh with wheels, spoiler,
 * carbon fiber trim, dynamic nitro flame plumes, and brake lights.
 */
export function createCarMesh(colorHex: string, id: string): THREE.Group {
  const carGroup = new THREE.Group();
  carGroup.name = `car_${id}`;

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
  flameL.position.set(0.6, 0.35, -3.18);
  flameL.rotation.x = Math.PI / 2; // point backwards along -Z
  const outerL = new THREE.Mesh(flameOuterGeo, flameOuterMat);
  const innerL = new THREE.Mesh(flameInnerGeo, flameInnerMat);
  flameL.add(outerL);
  flameL.add(innerL);
  nitroPlumes.add(flameL);

  // Right exhaust plume
  const flameR = new THREE.Group();
  flameR.position.set(-0.6, 0.35, -3.18);
  flameR.rotation.x = Math.PI / 2;
  const outerR = new THREE.Mesh(flameOuterGeo, flameOuterMat);
  const innerR = new THREE.Mesh(flameInnerGeo, flameInnerMat);
  flameR.add(outerR);
  flameR.add(innerR);
  nitroPlumes.add(flameR);

  carGroup.add(nitroPlumes);

  return carGroup;
}

import * as THREE from "three";
import { TrafficVehicleType } from "../types";

export interface TrafficModelSpec {
  type: TrafficVehicleType;
  color: string;
  id: string;
}

/**
 * Creates distinct 3D civilian traffic vehicle models (Sedan, Box Van, Urban Taxi, SUV, Heavy Truck)
 * with animated rolling wheels, realistic headlights, and dynamic brake lights.
 */
export function createTrafficVehicleMesh(spec: TrafficModelSpec): THREE.Group {
  const root = new THREE.Group();
  root.name = `traffic_${spec.id}`;

  const { type, color, id } = spec;

  // Shared Materials
  const bodyMat = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.25,
    metalness: 0.7,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: "#1e293b",
    roughness: 0.6,
    metalness: 0.4,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: "#38bdf8",
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.65,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: "#e2e8f0",
    roughness: 0.1,
    metalness: 0.95,
  });

  const headMat = new THREE.MeshBasicMaterial({ color: "#fef08a" }); // Warm halogen / Xenon
  const brakeMat = new THREE.MeshBasicMaterial({ color: "#ef4444" });

  const tireMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.85 });
  const hubcapMat = new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.3, metalness: 0.8 });

  const wheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.55, 14);
  const hubcapGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.58, 10);

  function makeTrafficWheel(name: string, posX: number, posZ: number, radius = 0.65, width = 0.55): THREE.Group {
    const wheelGroup = new THREE.Group();
    wheelGroup.name = name;
    wheelGroup.position.set(posX, radius, posZ);

    const rollObj = new THREE.Group();
    rollObj.name = `${name}_roll`;

    const tireMesh = new THREE.Mesh(
      radius === 0.65 ? wheelGeo : new THREE.CylinderGeometry(radius, radius, width, 14),
      tireMat
    );
    tireMesh.rotation.z = Math.PI / 2;
    tireMesh.castShadow = true;
    rollObj.add(tireMesh);

    const hubcapMesh = new THREE.Mesh(
      radius === 0.65 ? hubcapGeo : new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width * 1.05, 10),
      hubcapMat
    );
    hubcapMesh.rotation.z = Math.PI / 2;
    rollObj.add(hubcapMesh);

    wheelGroup.add(rollObj);
    return wheelGroup;
  }

  // Light fixtures builder
  function attachLights(
    group: THREE.Group,
    frontZ: number,
    rearZ: number,
    halfWidth: number,
    height: number
  ) {
    const lightGeo = new THREE.BoxGeometry(0.42, 0.22, 0.1);

    // Front Headlights
    const hlL = new THREE.Mesh(lightGeo, headMat);
    hlL.position.set(halfWidth, height, frontZ);
    group.add(hlL);

    const hlR = hlL.clone();
    hlR.position.set(-halfWidth, height, frontZ);
    group.add(hlR);

    // Rear Taillights
    const tlL = new THREE.Mesh(lightGeo, brakeMat);
    tlL.position.set(halfWidth, height, rearZ);
    tlL.name = "brakeLightL";
    group.add(tlL);

    const tlR = tlL.clone();
    tlR.position.set(-halfWidth, height, rearZ);
    tlR.name = "brakeLightR";
    group.add(tlR);
  }

  // Model-specific geometries
  if (type === "truck") {
    // 1. COMMERCIAL BOX TRUCK / DELIVERY VEHICLE
    // Lower Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 7.8), trimMat);
    chassis.position.y = 0.5;
    root.add(chassis);

    // Driver Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.5, 2.2), bodyMat);
    cab.position.set(0, 1.4, 2.6);
    root.add(cab);

    // Cab Windshield
    const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.4), glassMat);
    cabGlass.position.set(0, 1.6, 3.6);
    root.add(cabGlass);

    // Large Cargo Box
    const boxCargoMat = new THREE.MeshStandardMaterial({
      color: "#f8fafc",
      roughness: 0.5,
      metalness: 0.2,
    });
    const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.6, 5.2), boxCargoMat);
    cargoBox.position.set(0, 2.0, -1.1);
    root.add(cargoBox);

    // Roof Air Deflector over cab
    const deflector = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 1.2), trimMat);
    deflector.position.set(0, 2.3, 2.2);
    deflector.rotation.x = 0.2;
    root.add(deflector);

    // Chrome Bumper Grille
    const grille = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.2), chromeMat);
    grille.position.set(0, 0.7, 3.75);
    root.add(grille);

    // Wheels (Heavy truck with dual rear-wheel configuration)
    root.add(makeTrafficWheel("frontLeft", 1.5, 2.5, 0.72, 0.55));
    root.add(makeTrafficWheel("frontRight", -1.5, 2.5, 0.72, 0.55));
    root.add(makeTrafficWheel("rearLeft", 1.55, -1.4, 0.72, 0.65));
    root.add(makeTrafficWheel("rearRight", -1.55, -1.4, 0.72, 0.65));
    root.add(makeTrafficWheel("rearLeft2", 1.55, -2.6, 0.72, 0.65));
    root.add(makeTrafficWheel("rearRight2", -1.55, -2.6, 0.72, 0.65));

    attachLights(root, 3.75, -3.72, 1.1, 0.85);
  } else if (type === "van") {
    // 2. URBAN DELIVERY / SERVICE VAN
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.45, 6.2), trimMat);
    chassis.position.y = 0.45;
    root.add(chassis);

    // Main Cargo Van Shell
    const vanBody = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.8, 6.0), bodyMat);
    vanBody.position.set(0, 1.5, 0);
    root.add(vanBody);

    // Windshield & Side Windows
    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.75, 1.2), glassMat);
    frontGlass.position.set(0, 1.65, 2.1);
    frontGlass.rotation.x = -0.32;
    root.add(frontGlass);

    // Roof Rack
    const rack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 4.0), chromeMat);
    rack.position.set(0, 2.45, -0.4);
    root.add(rack);

    root.add(makeTrafficWheel("frontLeft", 1.4, 1.8));
    root.add(makeTrafficWheel("frontRight", -1.4, 1.8));
    root.add(makeTrafficWheel("rearLeft", 1.4, -1.8));
    root.add(makeTrafficWheel("rearRight", -1.4, -1.8));

    attachLights(root, 3.02, -3.02, 1.0, 0.75);
  } else if (type === "taxi") {
    // 3. URBAN YELLOW TAXI
    const taxiMat = new THREE.MeshStandardMaterial({
      color: "#eab308", // Vivid Taxi Yellow
      roughness: 0.2,
      metalness: 0.6,
    });

    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.55, 5.4), taxiMat);
    lowerBody.position.y = 0.5;
    root.add(lowerBody);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 2.6), taxiMat);
    cab.position.set(0, 1.1, -0.2);
    root.add(cab);

    // Greenhouse Windows
    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 1.2), glassMat);
    frontGlass.position.set(0, 1.1, 0.9);
    frontGlass.rotation.x = -0.35;
    root.add(frontGlass);

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 1.0), glassMat);
    rearGlass.position.set(0, 1.1, -1.3);
    rearGlass.rotation.x = 0.35;
    root.add(rearGlass);

    // Illuminated "TAXI" Roof Topper
    const signMat = new THREE.MeshStandardMaterial({
      color: "#fef08a",
      emissive: "#eab308",
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });
    const taxiSign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.5), signMat);
    taxiSign.position.set(0, 1.6, -0.2);
    root.add(taxiSign);

    // Checkered Stripe
    const checkerMat = new THREE.MeshBasicMaterial({ color: "#0f172a" });
    const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 4.4), checkerMat);
    stripeL.position.set(1.36, 0.6, 0);
    root.add(stripeL);

    const stripeR = stripeL.clone();
    stripeR.position.set(-1.36, 0.6, 0);
    root.add(stripeR);

    root.add(makeTrafficWheel("frontLeft", 1.4, 1.7));
    root.add(makeTrafficWheel("frontRight", -1.4, 1.7));
    root.add(makeTrafficWheel("rearLeft", 1.4, -1.7));
    root.add(makeTrafficWheel("rearRight", -1.4, -1.7));

    attachLights(root, 2.72, -2.72, 1.0, 0.55);
  } else if (type === "suv") {
    // 4. CROSSOVER / SUV
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.7, 5.6), bodyMat);
    lowerBody.position.y = 0.65;
    root.add(lowerBody);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 3.4), bodyMat);
    cab.position.set(0, 1.4, -0.4);
    root.add(cab);

    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, 1.2), glassMat);
    frontGlass.position.set(0, 1.4, 1.0);
    frontGlass.rotation.x = -0.36;
    root.add(frontGlass);

    // Heavy Duty Roof Bars
    const roofBarL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 3.0), trimMat);
    roofBarL.position.set(1.0, 1.9, -0.4);
    root.add(roofBarL);

    const roofBarR = roofBarL.clone();
    roofBarR.position.set(-1.0, 1.9, -0.4);
    root.add(roofBarR);

    // Big Rugged Wheels
    root.add(makeTrafficWheel("frontLeft", 1.5, 1.8, 0.72, 0.6));
    root.add(makeTrafficWheel("frontRight", -1.5, 1.8, 0.72, 0.6));
    root.add(makeTrafficWheel("rearLeft", 1.5, -1.8, 0.72, 0.6));
    root.add(makeTrafficWheel("rearRight", -1.5, -1.8, 0.72, 0.6));

    attachLights(root, 2.82, -2.82, 1.05, 0.7);
  } else {
    // 5. STANDARD SEDAN / CITY COMMUTER
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 5.2), bodyMat);
    lowerBody.position.y = 0.5;
    root.add(lowerBody);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 1.6), bodyMat);
    hood.position.set(0, 0.7, 1.6);
    hood.rotation.x = -0.04;
    root.add(hood);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 2.5), bodyMat);
    cab.position.set(0, 1.05, -0.3);
    root.add(cab);

    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.58, 1.3), glassMat);
    frontGlass.position.set(0, 1.05, 0.8);
    frontGlass.rotation.x = -0.38;
    root.add(frontGlass);

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.58, 1.1), glassMat);
    rearGlass.position.set(0, 1.05, -1.35);
    rearGlass.rotation.x = 0.38;
    root.add(rearGlass);

    root.add(makeTrafficWheel("frontLeft", 1.35, 1.6));
    root.add(makeTrafficWheel("frontRight", -1.35, 1.6));
    root.add(makeTrafficWheel("rearLeft", 1.35, -1.6));
    root.add(makeTrafficWheel("rearRight", -1.35, -1.6));

    attachLights(root, 2.62, -2.62, 0.95, 0.55);
  }

  return root;
}

import { useCallback } from "react";
import * as THREE from "three";

export interface CameraTargetPose {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
}

export function useRaceCamera() {
  const updateCamera = useCallback(
    (
      camera: THREE.PerspectiveCamera,
      target: CameraTargetPose,
      dt: number,
      currentTime: number,
      isBoostingActive: boolean,
      isSpacePressed: boolean = false
    ) => {
      const rotCos = Math.sin(target.rotationY);
      const rotSin = Math.cos(target.rotationY);

      // 1. Dynamic Field of View (FOV)
      const targetFOV = isBoostingActive ? (isSpacePressed ? 68 : 64) : 60;
      if (Math.abs(camera.fov - targetFOV) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 5.0 * dt);
        camera.updateProjectionMatrix();
      }

      // 2. Chase distances and heights
      const targetCamDistance = isBoostingActive ? 16.8 : 16;
      const targetCamHeight = isBoostingActive ? 5.0 : 5.2;

      const idealCamX = target.x - rotCos * targetCamDistance;
      const idealCamY = target.y + targetCamHeight;
      const idealCamZ = target.z - rotSin * targetCamDistance;

      // 3. Smooth coordinate interpolation
      camera.position.x = THREE.MathUtils.lerp(
        camera.position.x,
        idealCamX,
        6.5 * dt
      );
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        idealCamY,
        6.5 * dt
      );
      camera.position.z = THREE.MathUtils.lerp(
        camera.position.z,
        idealCamZ,
        6.5 * dt
      );

      // 4. High-speed boost camera shake
      if (isBoostingActive && target.speed > 40) {
        const speedRatio = Math.min(target.speed, 105) / 105;
        const shakeOffset = 0.025 * speedRatio;
        camera.position.x += Math.sin(currentTime * 0.04) * shakeOffset;
        camera.position.y += Math.cos(currentTime * 0.05) * (shakeOffset * 0.5);
      }

      // 5. Dynamic Look-ahead vector
      const lookAhead = new THREE.Vector3(
        target.x + rotCos * 5,
        target.y + 0.5,
        target.z + rotSin * 5
      );
      camera.lookAt(lookAhead);
    },
    []
  );

  return {
    updateCamera,
  };
}

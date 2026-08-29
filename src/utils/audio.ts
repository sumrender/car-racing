import {
  ISoundManager,
  getSoundManager,
  setSoundManager,
  WebAudioSoundManager,
  NullSoundManager,
  AudioConfig,
} from "./soundManager";

export {
  type ISoundManager,
  type AudioConfig,
  getSoundManager,
  setSoundManager,
  WebAudioSoundManager,
  NullSoundManager,
};

export function getAudioContext(): AudioContext | null {
  return getSoundManager().getAudioContext();
}

export function warmUpAudioEngine(): AudioContext | null {
  return getSoundManager().warmUp();
}

export function startNitroAudio(): void {
  getSoundManager().startNitro();
}

export function stopNitroAudio(): void {
  getSoundManager().stopNitro();
}

export function playCollisionSound(intensity: number = 0.6): void {
  getSoundManager().playCollision(intensity);
}

export function playWallScrapeSound(speed?: number, intensity?: number): void {
  getSoundManager().playWallScrape(speed, intensity);
}

export function playJumpSound(intensity: number = 0.7): void {
  getSoundManager().playJump(intensity);
}

export function playLandingSound(intensity: number = 0.7): void {
  getSoundManager().playLanding(intensity);
}

export function playSpeedBumpRumble(intensity: number = 0.5): void {
  getSoundManager().playSpeedBumpRumble(intensity);
}

export function playTestToneSound(): void {
  getSoundManager().playTestTone();
}

export function updateEngineSound(
  speed: number,
  isAccelerating: boolean,
  isBraking: boolean,
  isNitro: boolean,
  activeStatus: string,
  isPaused: boolean,
  dt: number
): void {
  getSoundManager().updateEngine(
    speed,
    isAccelerating,
    isBraking,
    isNitro,
    activeStatus,
    isPaused,
    dt
  );
}

export function updateDriftSound(isDrifting: boolean, speed: number, dt: number): void {
  getSoundManager().updateDrift(isDrifting, speed, dt);
}

export function updateWindRushSound(
  speed: number,
  isNitro: boolean,
  isPaused: boolean
): void {
  getSoundManager().updateWindRush(speed, isNitro, isPaused);
}

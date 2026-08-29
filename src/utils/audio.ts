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

export function warmUpAudioEngine(): void {
  getSoundManager().warmUp();
}

export function startNitroAudio(): void {
  getSoundManager().startNitro();
}

export function stopNitroAudio(): void {
  getSoundManager().stopNitro();
}

export function playCollisionSound(intensity: number = 0.5): void {
  getSoundManager().playCollision(intensity);
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

import { useState, useEffect, useCallback } from "react";
import {
  ISoundManager,
  AudioConfig,
  getSoundManager,
  setSoundManager,
  WebAudioSoundManager,
  NullSoundManager,
} from "../utils/soundManager";

export function useSoundManager() {
  const [manager] = useState<ISoundManager>(() => getSoundManager());
  const [config, setConfig] = useState<AudioConfig>(() => manager.getConfig());

  useEffect(() => {
    const unsubscribe = manager.subscribe((newConfig) => {
      setConfig(newConfig);
    });
    return unsubscribe;
  }, [manager]);

  const toggleMute = useCallback(() => {
    return manager.toggleMute();
  }, [manager]);

  const setMuted = useCallback(
    (muted: boolean) => {
      manager.setMuted(muted);
    },
    [manager]
  );

  const setMasterVolume = useCallback(
    (volume: number) => {
      manager.setMasterVolume(volume);
    },
    [manager]
  );

  const setSfxVolume = useCallback(
    (volume: number) => {
      manager.setSfxVolume(volume);
    },
    [manager]
  );

  const setEngineVolume = useCallback(
    (volume: number) => {
      manager.setEngineVolume(volume);
    },
    [manager]
  );

  const switchBackend = useCallback((backendType: "web-audio" | "null") => {
    const current = getSoundManager();
    const cfg = current.getConfig();
    current.dispose();

    const nextManager: ISoundManager =
      backendType === "null"
        ? new NullSoundManager()
        : new WebAudioSoundManager(cfg);

    setSoundManager(nextManager);
    setConfig(nextManager.getConfig());
  }, []);

  return {
    soundManager: manager,
    config,
    isMuted: config.muted,
    masterVolume: config.masterVolume,
    sfxVolume: config.sfxVolume,
    engineVolume: config.engineVolume,
    toggleMute,
    setMuted,
    setMasterVolume,
    setSfxVolume,
    setEngineVolume,
    switchBackend,
  };
}

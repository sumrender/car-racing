import { useState, useEffect, useRef, useCallback } from "react";
import { Player, TrafficVehicle } from "../types";
import {
  AIDifficulty,
  createAIPackState,
  StandingsResult,
} from "../utils/aiOpponent";
import { useRaceTimer } from "./useRaceTimer";
import { warmUpAudioEngine } from "../utils/audio";

export interface UseSinglePlayerRaceOptions {
  userName: string;
  userColor: string;
}

export type SinglePlayerStatus = "setup" | "countdown" | "racing" | "results";

export function useSinglePlayerRace({
  userName,
  userColor,
}: UseSinglePlayerRaceOptions) {
  const [status, setStatus] = useState<SinglePlayerStatus>("setup");
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [countdown, setCountdown] = useState(3);
  const [bestTime, setBestTime] = useState<number | null>(() => {
    const saved = localStorage.getItem("racer_solo_best");
    return saved ? parseInt(saved, 10) : null;
  });

  const {
    raceTimeMs,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
  } = useRaceTimer();

  const raceStartRef = useRef<number>(0);
  const countdownTimerRef = useRef<number | null>(null);

  const [player, setPlayer] = useState<Player>({
    id: "solo_player",
    name: userName || "Solo Driver",
    color: userColor,
    x: 0,
    y: 0,
    z: 0,
    rotationY: 0,
    speed: 0,
    driftScore: 0,
    isDrifting: false,
    driftMeter: 0,
    totalDriftScore: 0,
    checkpoint: 0,
    lap: 1,
    finished: false,
    finishTime: 0,
    isHost: true,
    ready: true,
    place: 1,
  });

  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("medium");

  const [aiOpponentsCount, setAiOpponentsCount] = useState<number>(() => {
    const saved = localStorage.getItem("racer_ai_count");
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 1 && num <= 5) return num;
    }
    return 3;
  });

  const [speedBreakersCount, setSpeedBreakersCount] = useState<number>(() => {
    const saved = localStorage.getItem("racer_speed_breakers_count");
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 0 && num <= 10) return num;
    }
    return 4;
  });

  const [trafficCount, setTrafficCount] = useState<number>(() => {
    const saved = localStorage.getItem("racer_traffic_count");
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 0 && num <= 20) return num;
    }
    return 8;
  });

  const [trafficVehicles, setTrafficVehicles] = useState<TrafficVehicle[]>([]);

  const [aiOpponents, setAiOpponents] = useState<Player[]>(() =>
    createAIPackState(3, "medium").map((s) => s.player)
  );

  const [aiStandings, setAiStandings] = useState<StandingsResult>({
    playerPlace: 1,
    aiPlace: 2,
    totalRacers: 4,
    gapMeters: 0,
    leadPlayerName: "Solo Driver",
    isLapping: false,
    lapsDifference: 0,
    playerProgress: 0,
    aiProgress: 0,
    allStandings: [],
  });

  // Sync profile name and color when in setup
  useEffect(() => {
    setPlayer((prev) => ({
      ...prev,
      name: userName.trim() || "Solo Driver",
      color: userColor,
    }));
  }, [userName, userColor]);

  // Clean up any running countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current !== null) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const updateSpeedBreakersCount = useCallback((count: number) => {
    const clamped = Math.max(0, Math.min(10, count));
    setSpeedBreakersCount(clamped);
    localStorage.setItem("racer_speed_breakers_count", clamped.toString());
  }, []);

  const updateTrafficCount = useCallback((count: number) => {
    const clamped = Math.max(0, Math.min(20, count));
    setTrafficCount(clamped);
    localStorage.setItem("racer_traffic_count", clamped.toString());
  }, []);

  const updateAiOpponentsCount = useCallback((count: number) => {
    const clamped = Math.max(1, Math.min(5, count));
    setAiOpponentsCount(clamped);
    localStorage.setItem("racer_ai_count", clamped.toString());
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        pauseTimer();
      } else {
        resumeTimer();
      }
      return next;
    });
  }, [pauseTimer, resumeTimer]);

  const setPausedExplicit = useCallback((paused: boolean) => {
    setIsPaused(paused);
    if (paused) {
      pauseTimer();
    } else {
      resumeTimer();
    }
  }, [pauseTimer, resumeTimer]);

  const startRace = useCallback(() => {
    warmUpAudioEngine();
    setIsPaused(false);
    localStorage.setItem("racer_name", userName.trim() || "Solo Driver");
    localStorage.setItem("racer_color", userColor);
    localStorage.setItem("racer_ai_count", aiOpponentsCount.toString());

    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    setPlayer({
      id: "solo_player",
      name: userName.trim() || "Solo Driver",
      color: userColor,
      x: 0,
      y: 0,
      z: 0,
      rotationY: 0,
      speed: 0,
      driftScore: 0,
      isDrifting: false,
      driftMeter: 0,
      totalDriftScore: 0,
      checkpoint: 0,
      lap: 1,
      finished: false,
      finishTime: 0,
      isHost: true,
      ready: true,
      place: 1,
    });

    const initialAIPack = createAIPackState(aiOpponentsCount, aiDifficulty);
    setAiOpponents(initialAIPack.map((s) => s.player));

    setCountdown(3);
    setStatus("countdown");
    resetTimer();

    let count = 3;
    const interval = window.setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        countdownTimerRef.current = null;
        const startTime = Date.now();
        raceStartRef.current = startTime;
        (window as any).raceStartTime = startTime;
        setStatus("racing");
        startTimer(startTime);
      }
    }, 1000);

    countdownTimerRef.current = interval;
  }, [
    userName,
    userColor,
    aiOpponentsCount,
    aiDifficulty,
    resetTimer,
    startTimer,
  ]);

  const handlePlayerUpdate = useCallback((stateUpdates: Partial<Player>) => {
    setPlayer((prev) => {
      const updated = { ...prev, ...stateUpdates };

      if (stateUpdates.finished && !prev.finished) {
        const finalTime = Date.now() - raceStartRef.current;
        updated.finishTime = finalTime;
        updated.finished = true;
        stopTimer();
        setStatus("results");

        setBestTime((oldBest) => {
          if (!oldBest || finalTime < oldBest) {
            localStorage.setItem("racer_solo_best", finalTime.toString());
            return finalTime;
          }
          return oldBest;
        });
      }

      return updated;
    });
  }, [stopTimer]);

  const handleAIPackUpdate = useCallback((pack: Player[], standings: StandingsResult) => {
    setAiOpponents(pack);
    setAiStandings(standings);
    setPlayer((prev) => {
      if (prev.place !== standings.playerPlace) {
        return { ...prev, place: standings.playerPlace };
      }
      return prev;
    });
  }, []);

  const resetToSetup = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setIsPaused(false);
    stopTimer();
    setStatus("setup");
  }, [stopTimer]);

  return {
    status,
    setStatus,
    isPaused,
    setIsPaused: setPausedExplicit,
    togglePause,
    countdown,
    bestTime,
    raceTimeMs,
    player,
    aiDifficulty,
    setAiDifficulty,
    aiOpponentsCount,
    setAiOpponentsCount: updateAiOpponentsCount,
    speedBreakersCount,
    setSpeedBreakersCount: updateSpeedBreakersCount,
    trafficCount,
    setTrafficCount: updateTrafficCount,
    trafficVehicles,
    setTrafficVehicles,
    aiOpponents,
    aiStandings,
    startRace,
    handlePlayerUpdate,
    handleAIPackUpdate,
    resetToSetup,
  };
}

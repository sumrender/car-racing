import { useState, useEffect, useRef, useCallback } from "react";

export function useRaceTimer(initialActive: boolean = false, initialStartTimeMs: number = 0) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isActive, setIsActive] = useState(initialActive);
  const startTimestampRef = useRef<number>(initialStartTimeMs);
  const accumulatedTimeRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);

  useEffect(() => {
    if (initialStartTimeMs > 0) {
      startTimestampRef.current = initialStartTimeMs;
      accumulatedTimeRef.current = 0;
    }
  }, [initialStartTimeMs]);

  useEffect(() => {
    if (!isActive) return;

    if (!startTimestampRef.current) {
      startTimestampRef.current = Date.now();
    }

    const interval = setInterval(() => {
      if (!isPausedRef.current) {
        setElapsedTime(accumulatedTimeRef.current + (Date.now() - startTimestampRef.current));
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isActive]);

  const startTimer = useCallback((startTime: number = Date.now()) => {
    startTimestampRef.current = startTime;
    accumulatedTimeRef.current = 0;
    isPausedRef.current = false;
    setIsActive(true);
  }, []);

  const pauseTimer = useCallback(() => {
    if (isActive && !isPausedRef.current) {
      accumulatedTimeRef.current += Date.now() - startTimestampRef.current;
      isPausedRef.current = true;
    }
  }, [isActive]);

  const resumeTimer = useCallback(() => {
    if (isActive && isPausedRef.current) {
      startTimestampRef.current = Date.now();
      isPausedRef.current = false;
    }
  }, [isActive]);

  const stopTimer = useCallback(() => {
    setIsActive(false);
    isPausedRef.current = false;
  }, []);

  const resetTimer = useCallback((newStartTime: number = Date.now()) => {
    startTimestampRef.current = newStartTime;
    accumulatedTimeRef.current = 0;
    setElapsedTime(0);
    setIsActive(false);
    isPausedRef.current = false;
  }, []);

  return {
    raceTimeMs: elapsedTime,
    elapsedTime,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    resetTimer,
    setElapsedTime,
    isActive,
  };
}

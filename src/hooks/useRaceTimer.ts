import { useState, useEffect, useRef, useCallback } from "react";

export function useRaceTimer(initialActive: boolean = false, initialStartTimeMs: number = 0) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isActive, setIsActive] = useState(initialActive);
  const startTimestampRef = useRef<number>(initialStartTimeMs);

  useEffect(() => {
    if (initialStartTimeMs > 0) {
      startTimestampRef.current = initialStartTimeMs;
    }
  }, [initialStartTimeMs]);

  useEffect(() => {
    if (!isActive) return;

    if (!startTimestampRef.current) {
      startTimestampRef.current = Date.now();
    }

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTimestampRef.current);
    }, 50);

    return () => clearInterval(interval);
  }, [isActive]);

  const startTimer = useCallback((startTime: number = Date.now()) => {
    startTimestampRef.current = startTime;
    setIsActive(true);
  }, []);

  const stopTimer = useCallback(() => {
    setIsActive(false);
  }, []);

  const resetTimer = useCallback((newStartTime: number = Date.now()) => {
    startTimestampRef.current = newStartTime;
    setElapsedTime(0);
    setIsActive(false);
  }, []);

  return {
    raceTimeMs: elapsedTime,
    elapsedTime,
    startTimer,
    stopTimer,
    resetTimer,
    setElapsedTime,
    isActive,
  };
}

/**
 * Formats a duration in milliseconds into mm:ss.cc format (e.g. 01:23.45)
 */
export function formatTime(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return "00:00.00";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
}

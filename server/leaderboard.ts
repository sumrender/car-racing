import { BestTime } from "../src/types";

const initialLeaderboard: BestTime[] = [
  { player: "AeroDrifter", color: "#f87171", timeMs: 42350, date: "2026-05-30" },
  { player: "ApexPro", color: "#60a5fa", timeMs: 45120, date: "2026-06-01" },
  { player: "GhostRacer", color: "#34d399", timeMs: 48900, date: "2026-05-15" },
  { player: "SlideMaster", color: "#fbbf24", timeMs: 51200, date: "2026-05-28" },
];

class LeaderboardManager {
  private bestTimes: BestTime[] = [...initialLeaderboard];

  public getTop(limit: number = 10): BestTime[] {
    return this.bestTimes.slice(0, limit).sort((a, b) => a.timeMs - b.timeMs);
  }

  public addEntry(player: string, color: string, timeMs: number): BestTime[] {
    const entry: BestTime = {
      player: player.trim() || "Anonymous",
      color: color || "#ca8a04",
      timeMs,
      date: new Date().toISOString().split("T")[0],
    };
    this.bestTimes.push(entry);
    this.bestTimes.sort((a, b) => a.timeMs - b.timeMs);
    return this.getTop();
  }
}

export const leaderboardManager = new LeaderboardManager();

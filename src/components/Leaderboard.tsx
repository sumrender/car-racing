import { useEffect, useState } from "react";
import { BestTime } from "../types";
import { Trophy, Clock, Calendar, RefreshCw } from "lucide-react";
import { formatTime } from "../utils/time";

interface LeaderboardProps {
  theme?: "light" | "dark";
}

export default function Leaderboard({ theme = "dark" }: LeaderboardProps) {
  const [board, setBoard] = useState<BestTime[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setBoard(data);
      }
    } catch (err) {
      console.error("Error loading high scores:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  return (
    <div id="leaderboard-section" className={`w-full rounded-xl p-5 border transition-all duration-300 backdrop-blur-md ${
      theme === "dark"
        ? "bg-slate-900/60 border-slate-800/80"
        : "bg-white/90 border-slate-200 shadow"
    }`}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h2 className={`text-base font-bold font-sans tracking-tight ${
            theme === "dark" ? "text-slate-100" : "text-slate-900"
          }`}>
            GLOBAL DRIFT ARENA LEADERBOARD
          </h2>
        </div>
        <button
          onClick={fetchLeaderboard}
          disabled={loading}
          className={`p-1.5 rounded-lg transition-all border disabled:opacity-50 ${
            theme === "dark"
              ? "bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-slate-100 border-slate-700"
              : "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-905 border-slate-300"
          }`}
          title="Refresh scoreboard"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && board.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {board.length === 0 ? (
            <div className={`text-center py-10 text-xs font-mono ${
              theme === "dark" ? "text-slate-500" : "text-slate-400"
            }`}>
              No lap times recorded yet. Be the first!
            </div>
          ) : (
            board.map((item, index) => {
              const medalColor =
                index === 0
                  ? "bg-gradient-to-r from-yellow-500 to-amber-600 text-white"
                  : index === 1
                  ? "bg-gradient-to-r from-slate-300 to-slate-450 text-slate-900"
                  : index === 2
                  ? "bg-gradient-to-r from-amber-700 to-amber-900 text-amber-100"
                  : theme === "dark"
                  ? "bg-slate-800/50 text-slate-400"
                  : "bg-slate-150 text-slate-500";

              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 border transition-all font-mono text-xs rounded-lg ${
                    theme === "dark"
                      ? "bg-slate-950/40 hover:bg-slate-950/70 border-slate-900/50 hover:border-slate-800/60"
                      : "bg-slate-50 hover:bg-slate-150/50 border-slate-200/80 hover:border-slate-300/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank Badge */}
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-center ${medalColor}`}>
                      {index + 1}
                    </div>
                    {/* Rider avatar indicator */}
                    <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: item.color }} />
                    <span className={`font-sans font-bold text-sm tracking-tight ${
                      theme === "dark" ? "text-slate-200" : "text-slate-800"
                    }`}>
                      {item.player}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-slate-400 font-sans">
                    <div className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span className={`font-semibold text-sm ${
                        theme === "dark" ? "text-slate-100" : "text-indigo-600 font-bold"
                      }`}>
                        {formatTime(item.timeMs)}
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono">
                      <Calendar className="w-3 h-3 text-slate-600" />
                      <span className="text-slate-500">{item.date}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

import { Trophy, RotateCcw, ArrowRight, Flag, Award, Clock, Compass } from "lucide-react";
import { Player } from "../../types";
import { formatTime } from "../../utils/time";
import { ThemeMode } from "../../hooks/useTheme";
import { StandingsResult } from "../../utils/aiOpponent";
import { TrackConfig } from "../../constants/track";

interface SinglePlayerResultsViewProps {
  player: Player;
  aiOpponents: Player[];
  standings: StandingsResult;
  bestTime: number | null;
  track?: TrackConfig;
  onRestart: () => void;
  onBackToSetup: () => void;
  onExitToMenu: () => void;
  theme: ThemeMode;
}

export default function SinglePlayerResultsView({
  player,
  aiOpponents,
  standings,
  bestTime,
  track,
  onRestart,
  onBackToSetup,
  onExitToMenu,
  theme,
}: SinglePlayerResultsViewProps) {
  const isDark = theme === "dark";
  const place = player.place || standings.playerPlace || 1;
  const isWinner = place === 1;

  // Combine player + AI into one sorted leaderboard for the podium
  const allRacers: Array<{
    id: string;
    name: string;
    color: string;
    place: number;
    timeMs: number;
    score: number;
    isPlayer: boolean;
  }> = [
    {
      id: player.id,
      name: player.name,
      color: player.color,
      place,
      timeMs: player.finishTime || 0,
      score: player.totalDriftScore,
      isPlayer: true,
    },
    ...aiOpponents.map((ai, idx) => ({
      id: ai.id,
      name: ai.name,
      color: ai.color,
      place: ai.place || idx + 2,
      timeMs: ai.finishTime || (player.finishTime ? player.finishTime + (idx + 1) * 3200 : 0),
      score: ai.totalDriftScore || Math.floor(2500 - idx * 400),
      isPlayer: false,
    })),
  ].sort((a, b) => a.place - b.place);

  return (
    <main className="flex-1 w-full max-w-xl mx-auto flex flex-col items-center justify-center px-4 py-8 overflow-y-auto z-20">
      <div
        id="single-player-results-card"
        className={`w-full p-6 sm:p-8 rounded-2xl border transition-all duration-300 relative shadow-2xl overflow-hidden ${
          isDark
            ? "bg-slate-900/95 border-slate-700/80 text-white"
            : "bg-white/95 border-slate-200 text-slate-900 shadow-slate-300"
        }`}
      >
        {/* Accent ribbon */}
        <div
          className={`absolute top-0 inset-x-0 h-1.5 ${
            isWinner
              ? "bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-300"
              : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
          }`}
        />

        {/* Podium Result Header */}
        <header className="flex flex-col items-center text-center mb-6">
          <div className="text-5xl mb-2 animate-bounce">
            {isWinner ? "🏆" : place === 2 ? "🥈" : place === 3 ? "🥉" : "🏁"}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-sans uppercase tracking-tight">
            {isWinner ? "VICTORY! 1ST PLACE" : `RACE FINISHED - P${place}`}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs font-mono opacity-70 uppercase tracking-wider">
              {isWinner ? "You conquered the Grid" : "Great drift control & lap execution"}
            </p>
            {track && (
              <span
                className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1"
                style={{
                  color: track.themeColor,
                  borderColor: `${track.themeColor}50`,
                  backgroundColor: `${track.themeColor}15`,
                }}
              >
                <Compass className="w-3 h-3" />
                {track.name}
              </span>
            )}
          </div>
        </header>

        {/* Highlight Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-mono">
          <div
            className={`p-3.5 rounded-xl border flex flex-col items-center justify-center ${
              isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}
          >
            <Clock className="w-4 h-4 text-indigo-400 mb-1" />
            <span className="text-[10px] uppercase opacity-60">Race Time</span>
            <span className="text-lg font-black text-indigo-400">
              {formatTime(player.finishTime || 0)}
            </span>
            {bestTime && (
              <span className="text-[9px] text-amber-400/90 mt-0.5">
                Record: {formatTime(bestTime)}
              </span>
            )}
          </div>

          <div
            className={`p-3.5 rounded-xl border flex flex-col items-center justify-center ${
              isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}
          >
            <Award className="w-4 h-4 text-pink-400 mb-1" />
            <span className="text-[10px] uppercase opacity-60">Drift Points</span>
            <span className="text-lg font-black text-pink-400">
              {player.totalDriftScore.toLocaleString()} PTS
            </span>
          </div>
        </div>

        {/* Final Standings List */}
        <div className="mb-6 space-y-2">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-60 mb-1 text-left">
            Final Standings
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {allRacers.map((racer, idx) => {
              const medal =
                idx === 0 ? "🥇 P1" : idx === 1 ? "🥈 P2" : idx === 2 ? "🥉 P3" : `P${idx + 1}`;
              return (
                <div
                  key={racer.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border font-mono text-xs ${
                    racer.isPlayer
                      ? "bg-indigo-600/15 border-indigo-500/50 text-indigo-200 font-bold"
                      : isDark
                      ? "bg-slate-950/50 border-slate-850 text-slate-300"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 text-left font-extrabold">{medal}</span>
                    <span
                      className="w-3 h-3 rounded-full shadow-sm shrink-0"
                      style={{ backgroundColor: racer.color }}
                    />
                    <span className="truncate max-w-[120px]">{racer.name}</span>
                    {racer.isPlayer && (
                      <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.2 rounded font-sans">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-[11px]">
                      {racer.score > 0 ? `${racer.score} pts` : ""}
                    </span>
                    <span className="font-bold">{formatTime(racer.timeMs)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            id="results-restart-race-btn"
            onClick={onRestart}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-mono text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>PLAY AGAIN</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="results-setup-btn"
              onClick={onBackToSetup}
              className={`py-2.5 px-3 rounded-xl font-mono text-xs font-bold transition-all border ${
                isDark
                  ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              }`}
            >
              Tune Setup
            </button>
            <button
              id="results-menu-btn"
              onClick={onExitToMenu}
              className={`py-2.5 px-3 rounded-xl font-mono text-xs font-bold transition-all border ${
                isDark
                  ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              }`}
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

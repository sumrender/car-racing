import { Trophy, RotateCcw, LogOut, Award, Clock } from "lucide-react";
import { Player } from "../../types";
import { formatTime } from "../../utils/time";
import { ThemeMode } from "../../hooks/useTheme";

interface MultiplayerResultsViewProps {
  rankings: Player[];
  myPlayerId: string;
  onReturnToLobby: () => void;
  onExitToMenu: () => void;
  theme: ThemeMode;
}

export default function MultiplayerResultsView({
  rankings,
  myPlayerId,
  onReturnToLobby,
  onExitToMenu,
  theme,
}: MultiplayerResultsViewProps) {
  const isDark = theme === "dark";
  const myPlayer = rankings.find((p) => p.id === myPlayerId);
  const myPlace = myPlayer ? rankings.indexOf(myPlayer) + 1 : 1;
  const isWinner = myPlace === 1;

  return (
    <main className="flex-1 w-full max-w-xl mx-auto flex flex-col items-center justify-center px-4 py-8 overflow-y-auto z-20">
      <div
        id="multiplayer-results-card"
        className={`w-full p-6 sm:p-8 rounded-2xl border transition-all duration-300 relative shadow-2xl overflow-hidden ${
          isDark
            ? "bg-slate-900/95 border-slate-700/80 text-white"
            : "bg-white/95 border-slate-200 text-slate-900 shadow-slate-300"
        }`}
      >
        {/* Accent Top Ribbon */}
        <div
          className={`absolute top-0 inset-x-0 h-1.5 ${
            isWinner
              ? "bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-300"
              : "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500"
          }`}
        />

        {/* Podium Banner */}
        <header className="flex flex-col items-center text-center mb-6">
          <div className="text-5xl mb-2 animate-bounce">
            {isWinner ? "🏆" : myPlace === 2 ? "🥈" : myPlace === 3 ? "🥉" : "🏁"}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-sans uppercase tracking-tight">
            {isWinner ? "VICTORY! 1ST PLACE" : `RACE FINISHED - P${myPlace}`}
          </h1>
          <p className="text-xs font-mono opacity-70 mt-1 uppercase tracking-wider">
            Multiplayer Arena Match Official Results
          </p>
        </header>

        {/* Highlight Stats */}
        {myPlayer && (
          <div className="grid grid-cols-2 gap-3 mb-6 font-mono">
            <div
              className={`p-3.5 rounded-xl border flex flex-col items-center justify-center ${
                isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            >
              <Clock className="w-4 h-4 text-indigo-400 mb-1" />
              <span className="text-[10px] uppercase opacity-60">Your Time</span>
              <span className="text-lg font-black text-indigo-400">
                {formatTime(myPlayer.finishTime || 0)}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-xl border flex flex-col items-center justify-center ${
                isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            >
              <Award className="w-4 h-4 text-pink-400 mb-1" />
              <span className="text-[10px] uppercase opacity-60">Drift Score</span>
              <span className="text-lg font-black text-pink-400">
                {myPlayer.totalDriftScore.toLocaleString()} PTS
              </span>
            </div>
          </div>
        )}

        {/* Rankings Table */}
        <div className="mb-6 space-y-2">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-60 mb-1 text-left">
            Grid Final Rankings
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {rankings.map((racer, idx) => {
              const isMe = racer.id === myPlayerId;
              const medal =
                idx === 0 ? "🥇 P1" : idx === 1 ? "🥈 P2" : idx === 2 ? "🥉 P3" : `P${idx + 1}`;
              return (
                <div
                  key={racer.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border font-mono text-xs ${
                    isMe
                      ? "bg-pink-600/15 border-pink-500/50 text-pink-200 font-bold"
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
                    {isMe && (
                      <span className="text-[9px] bg-pink-600 text-white px-1.5 py-0.2 rounded font-sans">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-[11px]">
                      {racer.totalDriftScore > 0 ? `${racer.totalDriftScore} pts` : ""}
                    </span>
                    <span className="font-bold">
                      {racer.finished ? formatTime(racer.finishTime || 0) : "DNF"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            id="multi-results-lobby-btn"
            onClick={onReturnToLobby}
            className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-mono text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RETURN TO PADDOCK LOBBY</span>
          </button>

          <button
            id="multi-results-menu-btn"
            onClick={onExitToMenu}
            className={`w-full py-2.5 px-3 rounded-xl font-mono text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
              isDark
                ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
            }`}
          >
            <LogOut className="w-4 h-4" /> Main Menu
          </button>
        </div>
      </div>
    </main>
  );
}

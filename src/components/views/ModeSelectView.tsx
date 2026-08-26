import { User, Users, Zap, Compass, Trophy, Flag, MessageCircle, ArrowRight } from "lucide-react";
import { ThemeMode } from "../../hooks/useTheme";

interface ModeSelectViewProps {
  theme: ThemeMode;
  onSelectMode: (mode: "single" | "multi") => void;
}

export default function ModeSelectView({ theme, onSelectMode }: ModeSelectViewProps) {
  const isDark = theme === "dark";

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto flex flex-col items-center justify-center px-4 py-8 overflow-y-auto z-10">
      {/* Header / Hero */}
      <header className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-4xl mb-3 shadow-inner">
          🏎️
        </div>
        <h1
          className={`text-3xl sm:text-4xl font-black tracking-tight uppercase ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          3D Drift Arena
        </h1>
        <p
          className={`text-sm mt-1.5 max-w-md mx-auto ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          Precision racing simulation with high-speed drifts, nitro acceleration, and live telemetry GPS tracking.
        </p>
      </header>

      {/* Mode Cards Grid */}
      <section aria-label="Game Mode Options" className="w-full grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        {/* SINGLE PLAYER CARD */}
        <article
          id="select-single-player-card"
          onClick={() => onSelectMode("single")}
          className={`group cursor-pointer p-6 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.99] relative overflow-hidden shadow-lg ${
            isDark
              ? "bg-slate-900/90 border-slate-800 hover:border-indigo-500 hover:shadow-indigo-500/10"
              : "bg-white border-slate-200 hover:border-indigo-600 hover:shadow-indigo-500/10"
          }`}
        >
          <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-600 text-white font-mono text-[9px] font-extrabold uppercase rounded-bl-xl tracking-wider">
            Solo Mode
          </div>

          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <User className="w-6 h-6" />
            </div>
            <h2
              className={`text-xl font-black tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Single Player
            </h2>
            <p
              className={`text-xs mt-1.5 leading-relaxed ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Drive immediately on the race track. Practice high-speed drifts, fire nitro boosts, master tight corners, and set your best lap records.
            </p>

            <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/80 space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
                <Zap className="w-3.5 h-3.5 shrink-0" /> Instant track access & practice
              </div>
              <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
                <Compass className="w-3.5 h-3.5 shrink-0" /> Live GPS Minimap & speedometer
              </div>
              <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
                <Trophy className="w-3.5 h-3.5 shrink-0" /> Personal best lap time tracking
              </div>
            </div>
          </div>

          <button
            id="start-single-player-btn"
            className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow group-hover:shadow-md"
          >
            DRIVE SOLO <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </article>

        {/* MULTIPLAYER CARD */}
        <article
          id="select-multiplayer-card"
          onClick={() => onSelectMode("multi")}
          className={`group cursor-pointer p-6 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.99] relative overflow-hidden shadow-lg ${
            isDark
              ? "bg-slate-900/90 border-slate-800 hover:border-pink-500 hover:shadow-pink-500/10"
              : "bg-white border-slate-200 hover:border-pink-600 hover:shadow-pink-500/10"
          }`}
        >
          <div className="absolute top-0 right-0 px-3 py-1 bg-pink-600 text-white font-mono text-[9px] font-extrabold uppercase rounded-bl-xl tracking-wider">
            Online Grid
          </div>

          <div>
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 mb-4 group-hover:bg-pink-600 group-hover:text-white transition-colors">
              <Users className="w-6 h-6" />
            </div>
            <h2
              className={`text-xl font-black tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Multiplayer Arena
            </h2>
            <p
              className={`text-xs mt-1.5 leading-relaxed ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Join or host live race lobbies. Race side-by-side against other players online with real-time positional sync and in-game chat.
            </p>

            <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/80 space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center gap-2 text-pink-500 dark:text-pink-400">
                <Users className="w-3.5 h-3.5 shrink-0" /> Live synchronized racer cars
              </div>
              <div className="flex items-center gap-2 text-pink-500 dark:text-pink-400">
                <Flag className="w-3.5 h-3.5 shrink-0" /> Real-time placement standings
              </div>
              <div className="flex items-center gap-2 text-pink-500 dark:text-pink-400">
                <MessageCircle className="w-3.5 h-3.5 shrink-0" /> Live crew communications chat
              </div>
            </div>
          </div>

          <button
            id="start-multiplayer-btn"
            className="mt-6 w-full py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow group-hover:shadow-md"
          >
            ENTER MULTIPLAYER <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </article>
      </section>

      {/* CONTROLS REMINDER FOOTER */}
      <footer
        id="mode-select-controls-footer"
        className={`p-4 rounded-xl border max-w-md w-full text-center ${
          isDark
            ? "bg-slate-900/60 border-slate-800 text-slate-400"
            : "bg-white/80 border-slate-200 text-slate-600"
        }`}
      >
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mr-2">
          CONTROLS:
        </span>
        <span className="text-xs font-sans">
          <strong>▲ / ▼</strong> Accelerate / Brake &bull; <strong>◀ / ▶</strong> Steer &bull;{" "}
          <strong className="text-indigo-600 dark:text-indigo-400">SPACE</strong> Nitro Boost &bull;{" "}
          <strong>R</strong> Respawn
        </span>
      </footer>
    </main>
  );
}

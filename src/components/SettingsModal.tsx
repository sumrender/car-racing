import { RotateCcw, LogOut, Sun, Moon, Play, X, Settings2 } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestart: () => void;
  onExit: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  isMultiplayer?: boolean;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onRestart,
  onExit,
  theme,
  onToggleTheme,
  isMultiplayer = false,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      id="settings-pause-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        id="settings-pause-modal-card"
        className={`w-full max-w-md rounded-2xl border p-6 sm:p-7 shadow-2xl transition-all relative overflow-hidden select-none ${
          theme === "dark"
            ? "bg-slate-900/95 border-slate-700/80 text-white shadow-cyan-950/30"
            : "bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50"
        }`}
      >
        {/* Top decorative accent bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-pink-500 via-indigo-500 to-cyan-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black font-sans tracking-tight uppercase">
                Game Settings
              </h2>
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                {isMultiplayer ? "Multiplayer Grid &bull; Live Match" : "Single Player &bull; Paused"}
              </p>
            </div>
          </div>

          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            title="Resume Game (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings & Actions List */}
        <div className="space-y-3">
          {/* Resume button */}
          <button
            id="settings-resume-btn"
            onClick={onClose}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center justify-between shadow-md active:scale-[0.99]"
          >
            <span className="flex items-center gap-2.5">
              <Play className="w-4 h-4 fill-white" />
              <span>RESUME RACE</span>
            </span>
            <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded border border-white/20">
              ESC
            </span>
          </button>

          {/* Restart button */}
          <button
            id="settings-restart-btn"
            onClick={() => {
              onRestart();
              onClose();
            }}
            className={`w-full py-3.5 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-between border active:scale-[0.99] ${
              theme === "dark"
                ? "bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700 hover:border-slate-600"
                : "bg-slate-100 hover:bg-slate-200/90 text-slate-800 border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 text-indigo-400" />
              <span>RESTART RACE</span>
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-400">
              {isMultiplayer ? "New Round" : "Reset Lap & Timer"}
            </span>
          </button>

          {/* Dark Mode Toggle Switch Card */}
          <div
            id="settings-theme-toggle-card"
            className={`w-full py-3 px-4 rounded-xl border flex items-center justify-between transition-colors ${
              theme === "dark"
                ? "bg-slate-800/50 border-slate-700/70"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${theme === "dark" ? "bg-amber-400/10 text-amber-400" : "bg-indigo-500/10 text-indigo-500"}`}>
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <div className="font-mono text-xs font-bold">Dark Mode</div>
                <div className="text-[10px] font-sans text-slate-400 dark:text-slate-400">
                  {theme === "dark" ? "High-contrast night racing enabled" : "Clean daylight circuit theme enabled"}
                </div>
              </div>
            </div>

            <button
              id="settings-toggle-theme-switch"
              onClick={onToggleTheme}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                theme === "dark" ? "bg-indigo-600" : "bg-slate-300"
              }`}
              role="switch"
              aria-checked={theme === "dark"}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  theme === "dark" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Exit Game button */}
          <button
            id="settings-exit-btn"
            onClick={() => {
              onExit();
              onClose();
            }}
            className={`w-full py-3.5 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-between border active:scale-[0.99] ${
              theme === "dark"
                ? "bg-red-950/30 hover:bg-red-900/50 text-red-300 border-red-900/50 hover:border-red-700/60"
                : "bg-red-50 hover:bg-red-100 text-red-600 border-red-200 hover:border-red-300"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <LogOut className="w-4 h-4 text-red-400" />
              <span>EXIT TO MAIN MENU</span>
            </span>
            <span className="text-[10px] text-red-400/80">
              Leave Session
            </span>
          </button>
        </div>

        {/* Footer controls reminder */}
        <div className="mt-5 pt-3.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-400">
          <span>Press <strong>ESC</strong> to close</span>
          <span>DRIFT ARENA 3D</span>
        </div>
      </div>
    </div>
  );
}

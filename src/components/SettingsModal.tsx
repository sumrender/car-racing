import {
  RotateCcw,
  LogOut,
  Sun,
  Moon,
  Play,
  X,
  Settings2,
  AlertTriangle,
  Car,
  Volume2,
  VolumeX,
  Volume1,
  Sliders,
  Zap,
} from "lucide-react";
import { useSoundManager } from "../hooks/useSoundManager";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestart: () => void;
  onExit: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  isMultiplayer?: boolean;
  speedBreakersCount?: number;
  onSpeedBreakersChange?: (count: number) => void;
  trafficCount?: number;
  onTrafficCountChange?: (count: number) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onRestart,
  onExit,
  theme,
  onToggleTheme,
  isMultiplayer = false,
  speedBreakersCount,
  onSpeedBreakersChange,
  trafficCount,
  onTrafficCountChange,
}: SettingsModalProps) {
  const {
    isMuted,
    masterVolume,
    sfxVolume,
    engineVolume,
    toggleMute,
    setMasterVolume,
    setSfxVolume,
    setEngineVolume,
  } = useSoundManager();

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
        className={`w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl border p-6 sm:p-7 shadow-2xl transition-all relative overflow-hidden select-none ${
          theme === "dark"
            ? "bg-slate-900/95 border-slate-700/80 text-white shadow-cyan-950/30"
            : "bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50"
        }`}
      >
        {/* Top decorative accent bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-pink-500 via-indigo-500 to-cyan-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
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

        {/* Settings & Actions Scrollable List */}
        <div className="space-y-3 overflow-y-auto pr-1">
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
            className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-between border active:scale-[0.99] ${
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

          {/* Sound Manager Audio Mixing Controls */}
          <div
            id="settings-audio-mixing-card"
            className={`w-full py-3 px-4 rounded-xl border flex flex-col gap-3 transition-colors ${
              theme === "dark"
                ? "bg-slate-800/50 border-slate-700/70"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${isMuted ? "bg-red-500/10 text-red-400" : "bg-cyan-500/10 text-cyan-400"}`}>
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </div>
                <div className="text-left">
                  <div className="font-mono text-xs font-bold">Sound & Audio Mixing</div>
                  <div className="text-[10px] font-sans text-slate-400">
                    {isMuted ? "Audio muted" : "Web Audio SFX Engine active"}
                  </div>
                </div>
              </div>

              <button
                id="settings-toggle-mute-btn"
                onClick={toggleMute}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border transition ${
                  isMuted
                    ? "bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30"
                    : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30"
                }`}
              >
                {isMuted ? "UNMUTE" : "MUTE"}
              </button>
            </div>

            {!isMuted && (
              <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-slate-700/50">
                {/* Master Volume */}
                <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
                  <span className="text-slate-400 w-24">Master Vol:</span>
                  <input
                    id="settings-master-volume-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-indigo-400 font-bold w-10 text-right">
                    {Math.round(masterVolume * 100)}%
                  </span>
                </div>

                {/* SFX Volume */}
                <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
                  <span className="text-slate-400 w-24">SFX & Jumps:</span>
                  <input
                    id="settings-sfx-volume-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={sfxVolume}
                    onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-cyan-400 font-bold w-10 text-right">
                    {Math.round(sfxVolume * 100)}%
                  </span>
                </div>

                {/* Engine / Nitro Volume */}
                <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
                  <span className="text-slate-400 w-24">Nitro / Core:</span>
                  <input
                    id="settings-engine-volume-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={engineVolume}
                    onChange={(e) => setEngineVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-pink-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-pink-400 font-bold w-10 text-right">
                    {Math.round(engineVolume * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>

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

          {/* Speed Breakers Configurator in Settings Modal (Single Player) */}
          {speedBreakersCount !== undefined && onSpeedBreakersChange && (
            <div
              id="settings-speed-breakers-card"
              className={`w-full py-3 px-4 rounded-xl border flex flex-col gap-2 transition-colors ${
                theme === "dark"
                  ? "bg-slate-800/50 border-slate-700/70"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-400/10 text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-mono text-xs font-bold">Speed Breakers</div>
                    <div className="text-[10px] font-sans text-slate-400">
                      {speedBreakersCount > 0
                        ? `${speedBreakersCount} ramp jumps enabled`
                        : "Disabled (smooth road)"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 font-mono">
                  <button
                    type="button"
                    onClick={() => onSpeedBreakersChange(Math.max(0, speedBreakersCount - 1))}
                    disabled={speedBreakersCount <= 0}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-bold text-amber-400 text-xs">
                    {speedBreakersCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSpeedBreakersChange(Math.min(10, speedBreakersCount + 1))}
                    disabled={speedBreakersCount >= 10}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Traffic Density Configurator in Settings Modal (Single Player) */}
          {trafficCount !== undefined && onTrafficCountChange && (
            <div
              id="settings-traffic-card"
              className={`w-full py-3 px-4 rounded-xl border flex flex-col gap-2 transition-colors ${
                theme === "dark"
                  ? "bg-slate-800/50 border-slate-700/70"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-cyan-400/10 text-cyan-400">
                    <Car className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-mono text-xs font-bold">Highway Traffic</div>
                    <div className="text-[10px] font-sans text-slate-400">
                      {trafficCount > 0
                        ? `${trafficCount} civilian vehicles cruising`
                        : "No traffic (clear track)"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 font-mono">
                  <button
                    type="button"
                    onClick={() => onTrafficCountChange(Math.max(0, trafficCount - 1))}
                    disabled={trafficCount <= 0}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-bold text-cyan-400 text-xs">
                    {trafficCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => onTrafficCountChange(Math.min(20, trafficCount + 1))}
                    disabled={trafficCount >= 20}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Exit Game button */}
          <button
            id="settings-exit-btn"
            onClick={() => {
              onExit();
              onClose();
            }}
            className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-between border active:scale-[0.99] ${
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
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-400 shrink-0">
          <span>Press <strong>ESC</strong> to close</span>
          <span>DRIFT ARENA 3D</span>
        </div>
      </div>
    </div>
  );
}


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
  Pause,
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
  isPaused?: boolean;
  onTogglePause?: () => void;
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
  isPaused = false,
  onTogglePause,
  speedBreakersCount = 4,
  onSpeedBreakersChange,
  trafficCount = 8,
  onTrafficCountChange,
}: SettingsModalProps) {
  const {
    soundManager,
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
      id="settings-pause-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
        {/* Accent Bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-pink-500 via-indigo-500 to-cyan-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-mono font-bold tracking-wider uppercase">
                  {isPaused ? "Game Paused" : "Game Settings & Controls"}
                </h2>
                {isPaused && (
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    PAUSED
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                {isMultiplayer ? "Live Multiplayer Match" : "Single Player Free Run"}
              </p>
            </div>
          </div>

          <button
            id="settings-close-x-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
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
            className="w-full py-3.5 px-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/25 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <Play className="w-4 h-4 fill-white" /> Resume Game
            </span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-normal">ESC</span>
          </button>

          {/* Single Player Pause / Resume Toggle */}
          {!isMultiplayer && onTogglePause && (
            <button
              id="settings-toggle-pause-btn"
              onClick={onTogglePause}
              className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-between border active:scale-[0.99] ${
                isPaused
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                  : theme === "dark"
                  ? "bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700 hover:border-slate-600"
                  : "bg-slate-100 hover:bg-slate-200/90 text-slate-800 border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isPaused ? "Unpause Physics Engine" : "Pause Physics Engine"}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                isPaused ? "bg-amber-500/30 text-amber-200" : "bg-slate-700/50 text-slate-300"
              }`}>
                {isPaused ? "ACTIVE" : "RUNNING"}
              </span>
            </button>
          )}

          {/* Restart Race button */}
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
            <span className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-pink-400" /> Restart Track
            </span>
            <span className="text-[10px] text-slate-400 uppercase">
              {isMultiplayer ? "Host Only" : "Instant"}
            </span>
          </button>

          {/* Sound Manager Audio Mixing Controls & Test Suite */}
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
                    {isMuted ? "Audio is currently muted" : "Web Audio Synthesizer active"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
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
            </div>

            {/* Always show test button and volume sliders so user can verify and fix audio immediately */}
            <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-slate-700/50">
              {/* Audio Test Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div className="text-left">
                    <div className="text-[11px] font-mono font-bold text-indigo-300">Audio System Diagnostics</div>
                    <div className="text-[9px] text-slate-400">Test Web Audio output and unmute browser</div>
                  </div>
                </div>
                <button
                  type="button"
                  id="settings-test-audio-chime-btn"
                  onClick={() => {
                    const sm = soundManager;
                    sm.warmUp();
                    sm.setMuted(false);
                    sm.playTestTone();
                  }}
                  className="px-3 py-1.5 rounded-md font-mono text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Test Audio (Chime)
                </button>
              </div>

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
                  onChange={(e) => {
                    if (isMuted) toggleMute();
                    setMasterVolume(parseFloat(e.target.value));
                  }}
                  className="flex-1 accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <span className="text-indigo-400 font-bold w-10 text-right">
                  {Math.round(masterVolume * 100)}%
                </span>
              </div>

              {/* SFX Volume */}
              <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
                <span className="text-slate-400 w-24">SFX & Impacts:</span>
                <input
                  id="settings-sfx-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sfxVolume}
                  onChange={(e) => {
                    if (isMuted) toggleMute();
                    setSfxVolume(parseFloat(e.target.value));
                  }}
                  className="flex-1 accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <span className="text-cyan-400 font-bold w-10 text-right">
                  {Math.round(sfxVolume * 100)}%
                </span>
              </div>

              {/* Engine / Nitro Volume */}
              <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
                <span className="text-slate-400 w-24">Engine & Nitro:</span>
                <input
                  id="settings-engine-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={engineVolume}
                  onChange={(e) => {
                    if (isMuted) toggleMute();
                    setEngineVolume(parseFloat(e.target.value));
                  }}
                  className="flex-1 accent-pink-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <span className="text-pink-400 font-bold w-10 text-right">
                  {Math.round(engineVolume * 100)}%
                </span>
              </div>

              {/* Sound Effects Test Chips */}
              <div className="pt-1.5 border-t border-slate-700/30">
                <div className="text-[10px] text-slate-400 font-mono mb-1.5 flex items-center justify-between">
                  <span>Sound Effects Tests:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMasterVolume(1.0);
                      setSfxVolume(1.0);
                      setEngineVolume(1.0);
                      if (isMuted) toggleMute();
                      soundManager.playTestTone();
                    }}
                    className="text-[9px] text-cyan-400 hover:underline"
                  >
                    Reset all to 100%
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.warmUp();
                      if (isMuted) toggleMute();
                      // Rev engine simulation
                      soundManager.updateEngine(0, true, false, false, "test_engine", false, 0.05);
                      let count = 0;
                      const revInterval = setInterval(() => {
                        count++;
                        const simSpeed = count < 12 ? count * 8 : Math.max(0, 96 - (count - 12) * 8);
                        soundManager.updateEngine(simSpeed, count < 12, count >= 12, false, "test_engine", false, 0.05);
                        if (count > 24) {
                          clearInterval(revInterval);
                          soundManager.updateEngine(0, false, false, false, "idle", false, 0.05);
                        }
                      }, 35);
                    }}
                    className="px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-center transition active:scale-95"
                  >
                    🏎️ Rev Engine
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.warmUp();
                      if (isMuted) toggleMute();
                      soundManager.startNitro();
                      setTimeout(() => soundManager.stopNitro(), 1200);
                    }}
                    className="px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 text-center transition active:scale-95"
                  >
                    ⚡ Nitro Jet
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.warmUp();
                      if (isMuted) toggleMute();
                      soundManager.updateDrift(true, 45, 0.05);
                      setTimeout(() => soundManager.updateDrift(false, 0, 0.05), 800);
                    }}
                    className="px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-center transition active:scale-95"
                  >
                    🛞 Drift Screech
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.warmUp();
                      if (isMuted) toggleMute();
                      soundManager.playCollision(1.0);
                    }}
                    className="px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/40 text-center transition active:scale-95"
                  >
                    💥 Crash Thud
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.warmUp();
                      if (isMuted) toggleMute();
                      soundManager.playWallScrape(60, 1.0);
                    }}
                    className="px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 border border-pink-500/40 text-center transition active:scale-95"
                  >
                    🚧 Wall Scrape
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.warmUp();
                      if (isMuted) toggleMute();
                      soundManager.playLanding(1.0);
                    }}
                    className="px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40 text-center transition active:scale-95"
                  >
                    🛬 Suspension Thud
                  </button>
                </div>
              </div>
            </div>
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
              <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400">
                {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
              </div>
              <div className="text-left">
                <div className="font-mono text-xs font-bold">Theme Style</div>
                <div className="text-[10px] font-sans text-slate-400">
                  {theme === "dark" ? "Dark Synthwave Arena" : "Light High-Contrast Track"}
                </div>
              </div>
            </div>

            <button
              id="settings-toggle-theme-action-btn"
              onClick={onToggleTheme}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border transition ${
                theme === "dark"
                  ? "bg-slate-700/60 hover:bg-slate-600 text-slate-200 border-slate-600"
                  : "bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm"
              }`}
            >
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          </div>

          {/* In-Game Speed Breakers Adjuster (Single Player) */}
          {!isMultiplayer && onSpeedBreakersChange && (
            <div
              id="settings-speed-breakers-card"
              className={`w-full py-3 px-4 rounded-xl border flex flex-col gap-2.5 transition-colors ${
                theme === "dark"
                  ? "bg-slate-800/50 border-slate-700/70"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-mono text-xs font-bold">Speed Breakers (Jumps)</div>
                    <div className="text-[10px] font-sans text-slate-400">
                      Ramps with airtime boost
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {speedBreakersCount}
                </span>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                {[0, 2, 4, 6, 8].map((count) => (
                  <button
                    key={count}
                    onClick={() => onSpeedBreakersChange(count)}
                    className={`flex-1 py-1 rounded font-mono text-[11px] font-bold border transition ${
                      speedBreakersCount === count
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                        : "bg-slate-800/40 hover:bg-slate-700/50 text-slate-400 border-slate-700/50"
                    }`}
                  >
                    {count === 0 ? "Off" : `${count}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* In-Game Traffic Density Adjuster (Single Player) */}
          {!isMultiplayer && onTrafficCountChange && (
            <div
              id="settings-traffic-density-card"
              className={`w-full py-3 px-4 rounded-xl border flex flex-col gap-2.5 transition-colors ${
                theme === "dark"
                  ? "bg-slate-800/50 border-slate-700/70"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Car className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-mono text-xs font-bold">Highway Traffic Density</div>
                    <div className="text-[10px] font-sans text-slate-400">
                      Sedans, SUVs & Cargo Trucks
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  {trafficCount}
                </span>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                {[0, 4, 8, 12, 16].map((count) => (
                  <button
                    key={count}
                    onClick={() => onTrafficCountChange(count)}
                    className={`flex-1 py-1 rounded font-mono text-[11px] font-bold border transition ${
                      trafficCount === count
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm"
                        : "bg-slate-800/40 hover:bg-slate-700/50 text-slate-400 border-slate-700/50"
                    }`}
                  >
                    {count === 0 ? "Off" : `${count}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Keybindings Cheat Sheet */}
          <div
            id="settings-controls-cheatsheet"
            className={`w-full py-3 px-4 rounded-xl border transition-colors ${
              theme === "dark"
                ? "bg-slate-800/30 border-slate-800 text-slate-300"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Keyboard Driving Controls
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">Drive Forward</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-700/60 font-bold text-[10px]">W / ↑</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">Brake / Reverse</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-700/60 font-bold text-[10px]">S / ↓</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">Steer Left / Right</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-700/60 font-bold text-[10px]">A / D / ← →</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">Nitro Boost</span>
                <span className="px-1.5 py-0.5 rounded bg-pink-900/60 text-pink-300 font-bold text-[10px]">SPACE</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">Respawn Track</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-700/60 font-bold text-[10px]">R</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-[11px]">Pause / Settings</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-700/60 font-bold text-[10px]">ESC</span>
              </div>
            </div>
          </div>

          {/* Exit to Main Menu */}
          <button
            id="settings-exit-menu-btn"
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
            <span className="flex items-center gap-2">
              <LogOut className="w-4 h-4 text-red-400" /> Exit to Main Menu
            </span>
            <span className="text-[10px] text-red-400/80">Abandon Session</span>
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

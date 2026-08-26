import { Settings, RotateCcw, LogOut, Sun, Moon, Flag, Award, Car } from "lucide-react";
import { Player, TrafficVehicle } from "../types";
import { formatTime } from "../utils/time";
import { ThemeMode } from "../hooks/useTheme";
import Speedometer from "./Speedometer";
import Minimap from "./Minimap";

interface RaceHUDProps {
  lap: number;
  maxLaps?: number;
  checkpoint: number;
  totalCheckpoints?: number;
  raceTimeMs: number;
  driftScore: number;
  driftMeter: number;
  totalDriftScore: number;
  speed: number;
  isDrifting: boolean;
  isBoosting: boolean;
  place: number;
  totalRacers: number;
  gapMeters?: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onRestart: () => void;
  onExit: () => void;
  players: Player[];
  myPlayerId: string | null;
  speedBreakersCount?: number;
  isMultiplayer?: boolean;
  bestTime?: number | null;
  traffic?: TrafficVehicle[];
  trafficCount?: number;
  trafficVehicles?: TrafficVehicle[];
}

export default function RaceHUD({
  lap,
  maxLaps = 2,
  checkpoint,
  totalCheckpoints = 5,
  raceTimeMs,
  driftScore,
  driftMeter,
  totalDriftScore,
  speed,
  isDrifting,
  isBoosting,
  place,
  totalRacers,
  gapMeters,
  theme,
  onToggleTheme,
  onOpenSettings,
  onRestart,
  onExit,
  players,
  myPlayerId,
  speedBreakersCount = 0,
  isMultiplayer = false,
  bestTime,
  traffic = [],
  trafficCount,
  trafficVehicles,
}: RaceHUDProps) {
  const isDark = theme === "dark";
  const activeTraffic = trafficVehicles || traffic;
  const displayTrafficCount = trafficCount !== undefined ? trafficCount : activeTraffic.length;

  return (
    <>
      {/* ========================================================================= */}
      {/* HUD TOP DASHBOARD BAR                                                     */}
      {/* ========================================================================= */}
      <header
        id="race-hud-top-bar"
        className="absolute top-3 inset-x-3 sm:top-4 sm:inset-x-6 z-30 flex items-center justify-between pointer-events-none"
      >
        {/* LEFT: Standings Position & Lap Counter */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          {/* Position Rank Pill */}
          <div
            id="hud-standings-pill"
            className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl border backdrop-blur-md shadow-xl flex items-center gap-2.5 transition-all ${
              place === 1
                ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-amber-500/40 text-amber-400"
                : isDark
                ? "bg-slate-950/85 border-slate-800 text-slate-100"
                : "bg-white/95 border-slate-200 text-slate-800 shadow"
            }`}
          >
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-xl sm:text-2xl font-black">{place}</span>
              <span className="text-xs opacity-60">/{totalRacers}</span>
            </div>
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase opacity-75">
              POS
            </span>
          </div>

          {/* Lap & Checkpoint Info */}
          <div
            id="hud-lap-pill"
            className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl border backdrop-blur-md shadow-xl flex items-center gap-3 transition-all ${
              isDark
                ? "bg-slate-950/85 border-slate-800 text-slate-100"
                : "bg-white/95 border-slate-200 text-slate-800 shadow"
            }`}
          >
            <div>
              <div className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-60">
                LAP
              </div>
              <div className="text-base sm:text-lg font-black font-mono">
                {Math.min(lap, maxLaps)}/{maxLaps}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-700/50" />
            <div>
              <div className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-60">
                CHK
              </div>
              <div className="text-base sm:text-lg font-black font-mono">
                {checkpoint}/{totalCheckpoints}
              </div>
            </div>
            {displayTrafficCount > 0 && (
              <>
                <div className="h-6 w-px bg-slate-700/50" />
                <div>
                  <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-400">
                    TRAFFIC
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-amber-300">
                    {displayTrafficCount}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* CENTER: Precision Race Timer & Gap Delta */}
        <div className="flex flex-col items-center pointer-events-auto">
          <div
            id="hud-timer-badge"
            className={`px-4 py-1.5 sm:px-6 sm:py-2 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center gap-2 ${
              isDark
                ? "bg-slate-950/90 border-slate-800 text-slate-100"
                : "bg-white/95 border-slate-200 text-slate-800 shadow"
            }`}
          >
            <span className="text-lg sm:text-2xl font-black font-mono tracking-tight text-indigo-400">
              {formatTime(raceTimeMs)}
            </span>
          </div>

          {/* Gap indicator */}
          {gapMeters !== undefined && (
            <div className="mt-1 text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-sm text-slate-300 border border-white/10">
              {place === 1
                ? `LEAD +${gapMeters.toFixed(0)}M`
                : `GAP -${gapMeters.toFixed(0)}M`}
            </div>
          )}

          {/* Best Time Record */}
          {bestTime && (
            <div className="mt-0.5 text-[9px] font-mono text-amber-400/80">
              BEST: {formatTime(bestTime)}
            </div>
          )}
        </div>

        {/* RIGHT: Drift Score & Action Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Total Drift Score */}
          <div
            id="hud-score-pill"
            className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl border backdrop-blur-md shadow-xl ${
              isDark
                ? "bg-slate-950/85 border-slate-800 text-pink-400"
                : "bg-white/95 border-slate-200 text-pink-600 shadow"
            }`}
          >
            <Award className="w-4 h-4" />
            <div>
              <div className="text-[8px] font-mono font-bold uppercase tracking-wider opacity-60">
                SCORE
              </div>
              <div className="text-sm font-black font-mono">
                {totalDriftScore.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <button
            id="hud-theme-toggle-btn"
            onClick={onToggleTheme}
            className={`p-2 sm:p-2.5 rounded-xl border backdrop-blur-md shadow-lg transition-all ${
              isDark
                ? "bg-slate-950/85 border-slate-800 text-amber-400 hover:bg-slate-800"
                : "bg-white/95 border-slate-200 text-indigo-600 hover:bg-slate-100 shadow"
            }`}
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {!isMultiplayer && (
            <button
              id="hud-restart-btn"
              onClick={onRestart}
              className={`p-2 sm:p-2.5 rounded-xl border backdrop-blur-md shadow-lg transition-all ${
                isDark
                  ? "bg-slate-950/85 border-slate-800 text-slate-300 hover:bg-slate-800"
                  : "bg-white/95 border-slate-200 text-slate-700 hover:bg-slate-100 shadow"
              }`}
              title="Restart race"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            id="hud-settings-btn"
            onClick={onOpenSettings}
            className={`p-2 sm:p-2.5 rounded-xl border backdrop-blur-md shadow-lg transition-all ${
              isDark
                ? "bg-slate-950/85 border-slate-800 text-slate-300 hover:bg-slate-800"
                : "bg-white/95 border-slate-200 text-slate-700 hover:bg-slate-100 shadow"
            }`}
            title="Open Settings (ESC)"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            id="hud-exit-btn"
            onClick={onExit}
            className={`p-2 sm:p-2.5 rounded-xl border backdrop-blur-md shadow-lg transition-all ${
              isDark
                ? "bg-red-950/40 border-red-900/50 text-red-400 hover:bg-red-900/60"
                : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
            }`}
            title="Exit race"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* HUD BOTTOM INSTRUMENTS: Minimap & Speedometer                             */}
      {/* ========================================================================= */}
      <footer
        id="race-hud-bottom-bar"
        className="absolute bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-6 z-30 flex items-end justify-between pointer-events-none"
      >
        {/* Left: GPS Minimap */}
        <div className="pointer-events-auto">
          <Minimap
            players={players}
            myPlayerId={myPlayerId}
            theme={theme}
            speedBreakersCount={speedBreakersCount}
            traffic={activeTraffic}
          />
        </div>

        {/* Right: Speedometer & Drift Dial */}
        <div className="pointer-events-auto">
          <Speedometer
            speed={speed}
            driftMeter={driftMeter}
            driftScore={driftScore}
            isDrifting={isDrifting}
            isBoosting={isBoosting}
            theme={theme}
          />
        </div>
      </footer>
    </>
  );
}

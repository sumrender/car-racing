import { useState } from "react";
import { ChevronLeft, Play, Bot, Cpu, AlertTriangle, Car } from "lucide-react";
import { ThemeMode } from "../../hooks/useTheme";
import { AIDifficulty, AI_DIFFICULTIES } from "../../utils/aiOpponent";
import { TRAFFIC_PRESETS } from "../../utils/trafficSystem";
import ColorPicker from "../ColorPicker";

interface SinglePlayerSetupViewProps {
  userName: string;
  onUserNameChange: (name: string) => void;
  userColor: string;
  onUserColorChange: (color: string) => void;
  aiDifficulty: AIDifficulty;
  onAiDifficultyChange: (diff: AIDifficulty) => void;
  aiOpponentsCount: number;
  onAiOpponentsCountChange: (count: number) => void;
  speedBreakersCount: number;
  onSpeedBreakersCountChange: (count: number) => void;
  trafficCount: number;
  onTrafficCountChange: (count: number) => void;
  onStartRace: () => void;
  onBackToMenu: () => void;
  theme: ThemeMode;
}

export default function SinglePlayerSetupView({
  userName,
  onUserNameChange,
  userColor,
  onUserColorChange,
  aiDifficulty,
  onAiDifficultyChange,
  aiOpponentsCount,
  onAiOpponentsCountChange,
  speedBreakersCount,
  onSpeedBreakersCountChange,
  trafficCount,
  onTrafficCountChange,
  onStartRace,
  onBackToMenu,
  theme,
}: SinglePlayerSetupViewProps) {
  const isDark = theme === "dark";
  const activeDifficultyConfig = AI_DIFFICULTIES[aiDifficulty];

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto flex flex-col items-center justify-center px-4 py-8 overflow-y-auto z-10">
      <div
        id="single-player-setup-card"
        className={`w-full p-6 sm:p-8 rounded-2xl border transition-colors duration-300 relative ${
          isDark
            ? "bg-slate-900 border-slate-800 shadow-2xl"
            : "bg-white border-slate-200/80 shadow-xl"
        }`}
      >
        {/* Top Back Navigation */}
        <button
          id="back-to-mode-select-btn"
          onClick={onBackToMenu}
          className={`mb-4 inline-flex items-center gap-1.5 text-xs font-mono font-semibold transition-colors ${
            isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <ChevronLeft className="w-4 h-4" /> Back to Mode Select
        </button>

        {/* Title & Description */}
        <header className="flex flex-col items-center text-center mb-6">
          <span className="text-4xl mb-2">🏁</span>
          <h1
            className={`text-2xl font-extrabold tracking-tight uppercase ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Single Player Setup
          </h1>
          <p
            className={`text-xs mt-1 max-w-md ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Customize your racer, tune rival AI telemetry, configure highway traffic, and place track obstacles.
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onStartRace();
          }}
          className="space-y-5"
        >
          {/* Driver Nickname Input */}
          <div className="flex flex-col gap-1 text-left">
            <label
              htmlFor="driver-name-input"
              className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Driver Call-Sign / Name
            </label>
            <input
              id="driver-name-input"
              type="text"
              required
              maxLength={14}
              value={userName}
              onChange={(e) => onUserNameChange(e.target.value)}
              placeholder="e.g. Apex Viper"
              className={`w-full px-4 py-2.5 rounded-xl border text-sm font-sans font-medium outline-none transition-all ${
                isDark
                  ? "bg-slate-950/70 border-slate-700 focus:border-indigo-500 text-white placeholder-slate-600"
                  : "bg-slate-50 border-slate-200 focus:border-indigo-600 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          {/* Vehicle Livery Color Swatches */}
          <ColorPicker
            selectedColor={userColor}
            onSelectColor={onUserColorChange}
            theme={theme}
          />

          {/* AI Rivals Count Selector (1 to 5 Rivals) */}
          <div className="flex flex-col gap-2 text-left pt-1">
            <div className="flex items-center justify-between">
              <label
                className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                AI Opponents on Grid ({aiOpponentsCount} Rivals)
              </label>
              <span className="text-[10px] font-mono font-bold text-indigo-400">
                {aiOpponentsCount + 1} Cars Total
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((count) => {
                const isSelected = aiOpponentsCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => onAiOpponentsCountChange(count)}
                    className={`py-2 px-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                      isSelected
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20"
                        : isDark
                        ? "bg-slate-950/60 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        : "bg-slate-100 border-slate-200 text-slate-650 hover:bg-slate-200"
                    }`}
                  >
                    {count} {count === 1 ? "Rival" : "Rivals"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Difficulty Selector */}
          <div className="flex flex-col gap-2 text-left pt-1">
            <div className="flex items-center justify-between">
              <label
                className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-pink-400" />
                AI Rival Skill Level
              </label>
              <span
                className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded border"
                style={{
                  color: activeDifficultyConfig.color,
                  borderColor: `${activeDifficultyConfig.color}40`,
                  backgroundColor: `${activeDifficultyConfig.color}15`,
                }}
              >
                {activeDifficultyConfig.badge}
              </span>
            </div>

            {/* Difficulty Tabs */}
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.keys(AI_DIFFICULTIES) as AIDifficulty[]).map((diffKey) => {
                const conf = AI_DIFFICULTIES[diffKey];
                const isSelected = aiDifficulty === diffKey;
                return (
                  <button
                    key={diffKey}
                    type="button"
                    onClick={() => onAiDifficultyChange(diffKey)}
                    className={`py-2 px-1 rounded-xl text-[11px] font-mono font-bold transition-all border flex flex-col items-center gap-0.5 ${
                      isSelected
                        ? "bg-gradient-to-b from-slate-800 to-slate-900 border-white text-white shadow-lg"
                        : isDark
                        ? "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span className="truncate">{conf.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* AI Telemetry Dossier Panel */}
            <div
              id="ai-telemetry-dossier"
              className={`p-3 rounded-xl border text-xs font-mono transition-all ${
                isDark
                  ? "bg-slate-950/70 border-slate-800/80 text-slate-300"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <p className="text-[11px] font-sans text-slate-400 mb-2">
                {activeDifficultyConfig.description}
              </p>
              <div className="grid grid-cols-3 gap-2 text-[10px] pt-1 border-t border-slate-700/40">
                <div>
                  <span className="opacity-60 block">TOP SPEED:</span>
                  <span className="font-bold text-white">{activeDifficultyConfig.boostSpeed} km/h</span>
                </div>
                <div>
                  <span className="opacity-60 block">NITRO BURSTS:</span>
                  <span className="font-bold text-indigo-400">
                    {(activeDifficultyConfig.nitroFrequency * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="opacity-60 block">DRIFT AGGRESSION:</span>
                  <span className="font-bold text-pink-400">
                    {(activeDifficultyConfig.driftAggression * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Highway Traffic Configurator */}
          <div className="flex flex-col gap-2 text-left pt-1">
            <div className="flex items-center justify-between">
              <label
                className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <Car className="w-3.5 h-3.5 text-cyan-400" />
                Civilian Highway Traffic ({trafficCount} Vehicles)
              </label>
              <span className="text-[10px] font-mono font-bold text-cyan-400">
                {trafficCount === 0
                  ? "No Traffic (Clear Track)"
                  : trafficCount <= 4
                  ? "Light Traffic"
                  : trafficCount <= 8
                  ? "Moderate Highway"
                  : trafficCount <= 14
                  ? "Dense Commute"
                  : "Rush Hour Chaos"}
              </span>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-5 gap-1.5">
              {Object.entries(TRAFFIC_PRESETS).map(([key, preset]) => {
                const isSelected = trafficCount === preset.count;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onTrafficCountChange(preset.count)}
                    className={`py-1.5 px-1 rounded-xl text-[10px] font-mono font-bold transition-all border flex flex-col items-center gap-0.5 ${
                      isSelected
                        ? "bg-cyan-600 border-cyan-400 text-white shadow-md shadow-cyan-500/25"
                        : isDark
                        ? "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>{preset.badge}</span>
                    <span className="text-[9px] opacity-75 font-normal">({preset.count})</span>
                  </button>
                );
              })}
            </div>

            {/* Fine Slider */}
            <div className="flex items-center gap-3">
              <input
                id="traffic-count-range-input"
                type="range"
                min={0}
                max={20}
                value={trafficCount}
                onChange={(e) => onTrafficCountChange(parseInt(e.target.value, 10))}
                className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="w-8 text-center font-mono font-bold text-cyan-400 text-sm">
                {trafficCount}
              </span>
            </div>
            <p className="text-[10px] font-sans text-slate-400">
              Civilian Sedans, Taxis, Delivery Vans, SUVs and Freight Trucks cruising across lanes with autonomous collision physics.
            </p>
          </div>

          {/* Speed Breakers Configurator */}
          <div className="flex flex-col gap-2 text-left pt-1">
            <div className="flex items-center justify-between">
              <label
                className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Track Speed Breakers ({speedBreakersCount} Ramps)
              </label>
              <span className="text-[10px] font-mono font-bold text-amber-400">
                {speedBreakersCount === 0 ? "Disabled (Smooth Road)" : "Need-for-Speed Airtime Jumps"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="speed-breakers-range-input"
                type="range"
                min={0}
                max={10}
                value={speedBreakersCount}
                onChange={(e) => onSpeedBreakersCountChange(parseInt(e.target.value, 10))}
                className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <span className="w-8 text-center font-mono font-bold text-amber-400 text-sm">
                {speedBreakersCount}
              </span>
            </div>
          </div>

          {/* Launch Race Button */}
          <button
            id="launch-single-race-btn"
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-mono text-sm font-bold rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2 mt-4"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>START SOLO RACE</span>
          </button>
        </form>
      </div>
    </main>
  );
}

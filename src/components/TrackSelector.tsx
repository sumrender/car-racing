import React from "react";
import { Compass, Gauge, Zap, Trophy, ShieldAlert, Mountain, Sparkles } from "lucide-react";
import { ThemeMode } from "../hooks/useTheme";
import { TRACK_LIST, TrackConfig } from "../constants/track";

interface TrackSelectorProps {
  selectedTrackId: string;
  onSelectTrack: (trackId: string) => void;
  theme: ThemeMode;
}

/**
 * Generates an SVG path data string from 3D track points (projecting X and Z coordinates)
 */
function getTrackSvgPath(points: { x: number; z: number }[]): string {
  if (!points || points.length === 0) return "";
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.z.toFixed(1)}`)
    .join(" ");
  return `${d} Z`;
}

export default function TrackSelector({
  selectedTrackId,
  onSelectTrack,
  theme,
}: TrackSelectorProps) {
  const isDark = theme === "dark";

  return (
    <div className="flex flex-col gap-2.5 text-left pt-1" id="track-selector-section">
      <div className="flex items-center justify-between">
        <label
          className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          Select Circuit / Track
        </label>
        <span className="text-[10px] font-mono font-bold text-indigo-400">
          3 Unique Tracks
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TRACK_LIST.map((track) => {
          const isSelected = selectedTrackId === track.id;
          const svgPath = getTrackSvgPath(track.points);

          const diffColor =
            track.difficulty === "Easy"
              ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
              : track.difficulty === "Medium"
              ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
              : "text-rose-400 border-rose-500/40 bg-rose-500/10";

          return (
            <button
              key={track.id}
              type="button"
              id={`track-option-${track.id}`}
              onClick={() => onSelectTrack(track.id)}
              className={`group text-left p-3.5 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? isDark
                    ? "bg-slate-800/90 border-indigo-500 ring-2 ring-indigo-500/40 shadow-xl shadow-indigo-500/15"
                    : "bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-600/30 shadow-lg shadow-indigo-500/10"
                  : isDark
                  ? "bg-slate-950/60 border-slate-800/90 hover:bg-slate-800/50 hover:border-slate-700"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
              }`}
            >
              {/* Top ambient color bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1 transition-opacity"
                style={{
                  backgroundColor: track.themeColor,
                  opacity: isSelected ? 1 : 0.4,
                }}
              />

              {/* Track schematic SVG Preview */}
              <div
                className={`w-full h-24 rounded-xl border flex items-center justify-center p-2 mb-2.5 transition-colors relative ${
                  isDark
                    ? "bg-slate-950/80 border-slate-800"
                    : "bg-slate-900 border-slate-800"
                }`}
              >
                <svg
                  viewBox={track.viewBox}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Subtle track glow underneath */}
                  <path
                    d={svgPath}
                    fill="none"
                    stroke={track.themeColor}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isSelected ? "0.35" : "0.15"}
                  />
                  {/* Main track asphalt */}
                  <path
                    d={svgPath}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Track neon centerline */}
                  <path
                    d={svgPath}
                    fill="none"
                    stroke={isSelected ? track.themeColor : "#94a3b8"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={isSelected ? "6 4" : "none"}
                  />
                  {/* Start/Finish marker */}
                  {track.points[0] && (
                    <circle
                      cx={track.points[0].x}
                      cy={track.points[0].z}
                      r="4.5"
                      fill="#ffffff"
                      stroke={track.themeColor}
                      strokeWidth="2"
                    />
                  )}
                </svg>

                {/* Track Difficulty Tag */}
                <span
                  className={`absolute top-1.5 right-1.5 text-[8px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded border ${diffColor}`}
                >
                  {track.difficulty}
                </span>
              </div>

              {/* Track Info */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3
                    className={`text-xs font-mono font-bold tracking-tight uppercase flex items-center justify-between ${
                      isSelected
                        ? "text-indigo-400 font-extrabold"
                        : isDark
                        ? "text-white"
                        : "text-slate-900"
                    }`}
                  >
                    <span>{track.name}</span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                  </h3>
                  <p
                    className={`text-[10px] font-sans mt-0.5 leading-tight ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    {track.subtitle}
                  </p>
                </div>

                {/* Metadata stats pill footer */}
                <div className="flex items-center justify-between text-[9px] font-mono mt-2.5 pt-2 border-t border-slate-700/30 text-slate-400">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-cyan-400" />
                    {track.lengthKm}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    {track.turnCount} Turns
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Track Description Callout */}
      {(() => {
        const currentTrack = TRACK_LIST.find((t) => t.id === selectedTrackId) || TRACK_LIST[0];
        return (
          <div
            className={`p-2.5 rounded-xl border text-[11px] font-sans leading-relaxed flex items-center gap-2.5 transition-all ${
              isDark
                ? "bg-slate-950/60 border-slate-800 text-slate-300"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: currentTrack.themeColor }}
            />
            <p className="flex-1">
              <span className="font-semibold text-white mr-1">{currentTrack.name}:</span>
              {currentTrack.description}
            </p>
          </div>
        );
      })()}
    </div>
  );
}

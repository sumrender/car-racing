import { useEffect, useState } from "react";

interface SpeedometerProps {
  speed: number;
  driftMeter: number;
  driftScore: number;
  isDrifting: boolean;
  isBoosting: boolean;
  theme?: "light" | "dark";
}

export default function Speedometer({
  speed = 0,
  driftMeter = 0,
  driftScore = 0,
  isDrifting = false,
  isBoosting = false,
  theme = "dark",
}: SpeedometerProps) {
  // Convert speed to positive integer display (clamp reverse negative speed)
  const displaySpeed = Math.max(0, Math.round(speed));
  const maxSpeedValue = 100;
  
  // Angle calculated from -120 to +120 degrees
  const speedPercentage = Math.min(displaySpeed / maxSpeedValue, 1.0);
  const needleRotation = -120 + speedPercentage * 240;
  const isDark = theme === "dark";

  return (
    <div id="speedometer-widget" className={`relative flex items-end justify-center w-48 h-48 border rounded-full shadow-2xl p-4 backdrop-blur-md transition-all duration-300 ${
      isDark ? "bg-slate-950/85 border-slate-800/80" : "bg-white/95 border-slate-200/80 shadow-xl"
    }`}>
      {/* Glow Rings */}
      <div className={`absolute inset-1 rounded-full border opacity-20 transition-colors duration-300 ${
        isBoosting ? "border-indigo-400 bg-indigo-500/5 animate-pulse" : isDrifting ? "border-pink-400 bg-pink-500/5" : isDark ? "border-slate-800" : "border-slate-300"
      }`} />

      {/* SVG Dash Indicator dial */}
      <svg className="absolute inset-0 w-full h-full -rotate-90 scale-x-[-1]" viewBox="0 0 100 100">
        {/* Gray Background Radial Trail */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="transparent"
          stroke={isDark ? "#1e293b" : "#e2e8f0"}
          strokeWidth="3.5"
          strokeDasharray="180 264"
          strokeLinecap="round"
          className="origin-center rotate-[48deg]"
        />
        {/* Interactive colored Speed arc */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="transparent"
          stroke={isBoosting ? "#6366f1" : isDrifting ? "#ec4899" : "#3b82f6"}
          strokeWidth="4"
          strokeDasharray="180 264"
          strokeDashoffset={180 - (speedPercentage * 180)}
          strokeLinecap="round"
          className="origin-center rotate-[48deg] transition-all duration-75"
        />
      </svg>

      {/* Speedometer needle */}
      <div
        className="absolute w-1 h-14 bg-gradient-to-t from-pink-500 to-indigo-500 origin-bottom bottom-[50%] left-[50%] -translate-x-[50%] transition-transform duration-75 rounded-t-full shadow-lg"
        style={{ transform: `rotate(${needleRotation}deg)` }}
      />
      
      {/* Center cap core */}
      <div className={`absolute inset-[46%] rounded-full shadow-inner border transition-colors ${
        isDark ? "bg-slate-900 border-slate-700" : "bg-slate-100 border-slate-300"
      }`} />

      {/* HUD numerical details overlayed */}
      <div className="relative z-10 flex flex-col items-center justify-center translate-y-[-10px]">
        {/* Drift bonus alert overlay */}
        {isDrifting && (
          <div className="text-[10px] text-pink-500 font-mono font-bold tracking-widest uppercase animate-bounce mb-0.5">
            DRIFTING
          </div>
        )}
        {isBoosting && (
          <div className="text-[10px] text-indigo-505 font-mono font-bold tracking-widest uppercase animate-pulse mb-0.5">
            🚀 BOOST
          </div>
        )}
        
        <span className={`text-3xl font-extrabold tracking-tight font-sans tabular-nums transition-colors ${
          isDark ? "text-slate-100" : "text-slate-905"
        }`}>
          {displaySpeed}
        </span>
        <span className="text-[10px] font-mono font-semibold text-slate-500 tracking-wider">
          KM/H
        </span>
      </div>

      {/* Slide / Drift Combo Scorer box underneath */}
      {driftScore > 0 && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-pink-500/90 to-indigo-600/90 border border-pink-400 text-white rounded shadow-lg font-mono text-center min-w-[124px] animate-scaleIn">
          <div className="text-[9px] uppercase tracking-wider text-pink-200">Drift Score</div>
          <div className="text-sm font-bold tracking-tight text-white animate-pulse">
            +{driftScore} PTS
          </div>
          {/* Action indicator meter bar */}
          <div className="w-full bg-black/40 h-1 rounded overflow-hidden mt-1">
            <div
              className="bg-gradient-to-r from-pink-400 to-yellow-300 h-full transition-all duration-75"
              style={{ width: `${driftMeter}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

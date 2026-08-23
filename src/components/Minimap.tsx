import React, { useMemo } from "react";
import * as THREE from "three";
import { Player } from "../types";

interface MinimapProps {
  players: Player[];
  myPlayerId: string | null;
  theme: "light" | "dark";
}

// Recreate the track points to evaluate identical curve paths for SVG projection
const TRACK_POINTS = [
  new THREE.Vector3(0, 0, 0),       // Start/Finish
  new THREE.Vector3(0, 0, 120),     // Straightaway
  new THREE.Vector3(40, 0, 220),    // Sweeping Left Turn
  new THREE.Vector3(120, 0, 280),   // Corner
  new THREE.Vector3(260, 0, 260),   // S-Curve Entrance
  new THREE.Vector3(280, 0, 140),   // Hairpin Apex
  new THREE.Vector3(200, 0, 80),    // Chicane Left
  new THREE.Vector3(120, 0, -40),   // Chicane Right
  new THREE.Vector3(0, 0, -80),     // Back Straight
  new THREE.Vector3(-100, 0, -100), // Outer Hairpin
  new THREE.Vector3(-140, 0, -20),  // Exit turn
  new THREE.Vector3(-60, 0, 20),    // Final chicane
];

export default function Minimap({ players, myPlayerId, theme }: MinimapProps) {
  // Generate highly-precise curved polyline points using CatmullRomCurve3
  const { pathData, checkpoints } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(TRACK_POINTS, true);
    
    // Evaluate 150 points for an ultra-smooth outline
    const curvePoints = curve.getPoints(150);
    const dStr = curvePoints
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.z.toFixed(1)}`)
      .join(" ") + " Z";

    // Mark exact check points along the track (using 5 checkpoints standard)
    const cps = [];
    for (let c = 0; c < 5; c++) {
      const u = c / 5;
      const pt = curve.getPointAt(u);
      cps.push({
        x: pt.x,
        z: pt.z,
        index: c + 1
      });
    }

    return { pathData: dStr, checkpoints: cps };
  }, []);

  // Track bounding box mapping coordinates
  // Range: x: [-140, 280] + padding -> viewBox [-165, -125, 470, 435]
  const viewBox = "-165 -125 470 435";

  return (
    <div className={`p-2.5 rounded-2xl border flex flex-col items-center select-none backdrop-blur-md transition-all duration-300 pointer-events-auto shadow-2xl relative w-36 h-36 md:w-44 md:h-44 ${
      theme === "dark" 
        ? "bg-slate-950/85 border-slate-800 text-slate-100" 
        : "bg-white/95 border-slate-200 text-slate-800 shadow"
    }`}>
      {/* HUD Label */}
      <span className="absolute top-1.5 left-2.5 text-[8px] font-mono font-bold uppercase tracking-wider opacity-60">
        GPS TRACK UNIT
      </span>

      {/* Grid backdrop details */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none opacity-[0.03] flex items-center justify-center">
        <div className="w-full h-full scale-150 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:10px_10px]" />
      </div>

      {/* SVG Canvas for the visual map outline & realplayer blips */}
      <svg
        viewBox={viewBox}
        className="w-full h-full p-1 mt-2 flex-grow"
        style={{ transform: "rotate(0deg)" }}
      >
        <defs>
          <filter id="minimap-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer boundary of the road track */}
        <path
          d={pathData}
          fill="none"
          stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"}
          strokeWidth="28"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Inner high-contrast racing line */}
        <path
          d={pathData}
          fill="none"
          stroke={theme === "dark" ? "#6366f1" : "#4f46e5"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={theme === "dark" ? "0.85" : "0.95"}
          filter={theme === "dark" ? "url(#minimap-glow)" : undefined}
        />

        {/* Checkpoint Indicators */}
        {checkpoints.map((cp) => (
          <g key={cp.index}>
            <circle
              cx={cp.x}
              cy={cp.z}
              r="7"
              fill={theme === "dark" ? "#0f172a" : "#ffffff"}
              stroke={theme === "dark" ? "#f43f5e" : "#e11d48"}
              strokeWidth="2"
            />
            <text
              x={cp.x}
              y={cp.z + 2.5}
              textAnchor="middle"
              fontSize="7"
              fontWeight="bold"
              fontFamily="monospace"
              fill={theme === "dark" ? "#f43f5e" : "#e11d48"}
            >
              C
            </text>
          </g>
        ))}

        {/* Player Blips */}
        {players.map((p) => {
          const isLocal = p.id === myPlayerId;
          const px = p.x || 0;
          const pz = p.z || 0;
          const rotY = p.rotationY || 0;

          return (
            <g key={p.id} className="transition-all duration-100 ease-out">
              {/* Pulsing ring for the local racer */}
              {isLocal && (
                <circle
                  cx={px}
                  cy={pz}
                  r="24"
                  fill="none"
                  stroke={p.color}
                  strokeWidth="3"
                  className="animate-pulse"
                />
              )}

              {/* Player Arrow / Pointer rotated pointing to car's actual facing direction */}
              <g transform={`translate(${px}, ${pz}) rotate(${(-rotY * 180) / Math.PI})`}>
                {/* Visual directional arrow blip */}
                <polygon
                  points="0,16 11,-10 0,-4 -11,-10"
                  fill={p.color}
                  stroke={theme === "dark" ? "#020617" : "#ffffff"}
                  strokeWidth="3"
                />
              </g>

              {/* Player text name tags/dots */}
              <rect
                x={px - 22}
                y={pz - 32}
                width="44"
                height="10"
                rx="3"
                fill={theme === "dark" ? "rgba(2, 6, 23, 0.85)" : "rgba(255, 255, 255, 0.9)"}
                stroke={p.color}
                strokeWidth="1"
              />
              <text
                x={px}
                y={pz - 24}
                textAnchor="middle"
                fontSize="6"
                fontWeight="900"
                fontFamily="sans-serif"
                fill={theme === "dark" ? "#f8fafc" : "#0f172a"}
              >
                {p.name.substring(0, 7).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

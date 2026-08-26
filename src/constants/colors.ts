export interface CarColorPreset {
  name: string;
  hex: string;
  badge?: string;
}

export const CAR_COLOR_PRESETS: CarColorPreset[] = [
  { name: "Neon Rose", hex: "#ec4899", badge: "POPULAR" },
  { name: "Cyber Cyan", hex: "#06b6d4", badge: "DEFAULT" },
  { name: "Volt Lime", hex: "#84cc16" },
  { name: "Solar Amber", hex: "#f59e0b" },
  { name: "Hyper Violet", hex: "#8b5cf6" },
  { name: "Crimson Blaze", hex: "#ef4444" },
  { name: "Pure Emerald", hex: "#10b981" },
  { name: "Ghost White", hex: "#f8fafc" },
];

export const NEON_CHECKPOINT_COLORS = [
  "#ec4899",
  "#22d3ee",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
];

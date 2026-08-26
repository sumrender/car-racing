import { Sun, Moon } from "lucide-react";
import { ThemeMode } from "../hooks/useTheme";

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
  showLabel?: boolean;
}

export default function ThemeToggle({ theme, onToggle, showLabel = true }: ThemeToggleProps) {
  return (
    <button
      id="theme-toggle-btn"
      onClick={onToggle}
      className={`p-2.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 flex items-center justify-center gap-1.5 ${
        theme === "dark"
          ? "bg-slate-900/80 border-slate-800 text-amber-400 hover:text-amber-300 hover:bg-slate-800/80"
          : "bg-white/95 border-slate-200 text-slate-700 hover:text-indigo-600 hover:bg-slate-100 shadow"
      }`}
      title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
    >
      {theme === "dark" ? (
        <>
          <Sun className="w-4 h-4 text-amber-400" />
          {showLabel && (
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider hidden sm:inline">
              Light Mode
            </span>
          )}
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-indigo-500" />
          {showLabel && (
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider hidden sm:inline">
              Dark Mode
            </span>
          )}
        </>
      )}
    </button>
  );
}

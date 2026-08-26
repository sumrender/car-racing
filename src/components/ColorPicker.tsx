import { CheckCircle } from "lucide-react";
import { CAR_COLOR_PRESETS } from "../constants/colors";
import { ThemeMode } from "../hooks/useTheme";

interface ColorPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
  takenColors?: string[];
  theme: ThemeMode;
}

export default function ColorPicker({
  selectedColor,
  onSelectColor,
  takenColors = [],
  theme,
}: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label
        className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
          theme === "dark" ? "text-slate-400" : "text-slate-500"
        }`}
      >
        Vehicle Livery Color
      </label>
      <div className="grid grid-cols-6 gap-2">
        {CAR_COLOR_PRESETS.slice(0, 6).map((preset) => {
          const isTaken = takenColors.includes(preset.hex) && selectedColor !== preset.hex;
          const isSelected = selectedColor === preset.hex;

          return (
            <button
              key={preset.hex}
              type="button"
              disabled={isTaken}
              onClick={() => onSelectColor(preset.hex)}
              className={`h-11 rounded-xl transition-all duration-200 relative flex items-center justify-center border-2 ${
                isSelected
                  ? "border-white scale-105 shadow-md shadow-indigo-500/20"
                  : isTaken
                  ? "opacity-25 cursor-not-allowed border-transparent"
                  : "border-transparent hover:scale-105 opacity-85 hover:opacity-100"
              }`}
              style={{ backgroundColor: preset.hex }}
              title={isTaken ? `${preset.name} (Claimed)` : preset.name}
            >
              {isSelected && <CheckCircle className="w-4 h-4 text-white drop-shadow-md" />}
              {isTaken && <span className="text-[9px] font-bold text-white font-mono">TAKEN</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

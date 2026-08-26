import { useState, useEffect } from "react";

export type ThemeMode = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("drift_arena_theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  useEffect(() => {
    try {
      localStorage.setItem("drift_arena_theme", theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return { theme, setTheme, toggleTheme, isDark: theme === "dark" };
}

import { createContext, useContext, useState } from "react";
import { THEMES } from "../utils/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("dark");
  const toggle = () => setMode((m) => (m === "light" ? "dark" : "light"));
  const t = THEMES[mode];

  return (
    <ThemeContext.Provider value={{ mode, toggle, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

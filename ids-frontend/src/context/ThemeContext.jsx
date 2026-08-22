import { createContext, useContext, useState, useEffect } from "react";
import { THEMES } from "../utils/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("dark");
  const toggle = () => setMode((m) => (m === "light" ? "dark" : "light"));
  const t = THEMES[mode];

  // Sincroniza el "color-scheme" nativo del navegador con el tema. Esto hace que
  // los controles nativos (menús desplegables de <select>, scrollbars, etc.)
  // usen el esquema correcto y no queden con texto oscuro sobre fondo oscuro.
  useEffect(() => {
    document.documentElement.style.colorScheme = mode === "light" ? "light" : "dark";
    document.body.style.background = t.bg;
    document.body.style.color = t.text;
  }, [mode, t]);

  return (
    <ThemeContext.Provider value={{ mode, toggle, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

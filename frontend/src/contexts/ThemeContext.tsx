import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "normal";

export interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: string;
  description: string;
}

export const OPCIONES_TEMA: ReadonlyArray<ThemeOption> = [
  {
    value: "light",
    label: "Claro",
    icon: "☀️",
    description: "Tema claro",
  },
  {
    value: "dark",
    label: "Oscuro",
    icon: "🌙",
    description: "Tema oscuro",
  },
  {
    value: "normal",
    label: "Normal",
    icon: "💻",
    description: "Tema normal (institucional)",
  },
];

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("normal");

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme debe usarse dentro de ThemeProvider");
  }

  return context;
}

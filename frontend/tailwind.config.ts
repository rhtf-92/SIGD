import type { Config } from "tailwindcss";

// AVISO: Tailwind v4 (CSS-first) no carga este archivo salvo que se referencie
// con `@config` desde el CSS. Los tokens del sistema de diseño institucional
// ("Bóveda documental") viven en `src/styles/theme.css` dentro de `@theme`.
// La paleta `suiza.*` de aquí se conserva como referencia de la identidad
// original del IESTP Público "Suiza" (azul #006EC7, fucsia #E6007E,
// ámbar #F9E000, tinta #0A192F, sepia #8B5A2B).
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        suiza: {
          blue: "#006EC7",
          deepBlue: "#0055A5",
          navy: "#0A192F",
          fuchsia: "#E6007E",
          black: "#0F172A",
          white: "#FFFFFF",
          gray: "#F8FAFC",
          slate: "#F1F5F9",
          brown: "#8B5A2B",
          yellow: "#F9E000",
          amber: "#F59E0B",
          red: "#D62828",
          emerald: "#059669",
        },
      },
      fontFamily: {
        sans: [
          "'Plus Jakarta Sans'",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "'Plus Jakarta Sans'",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "'JetBrains Mono'",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        suiza: "0 10px 30px rgba(0, 110, 199, 0.12)",
        glow: "0 0 25px -5px rgba(0, 110, 199, 0.3)",
        glass: "0 8px 32px 0 rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;

import type { Config } from "tailwindcss";

// AVISO: Tailwind v4 (CSS-first) no carga este archivo salvo que se referencie
// con `@config` desde el CSS. Los tokens reales viven en `src/styles/theme.css`
// y en `src/index.css`. La paleta `suiza.*` se conserva como referencia del
// rediseño futurista monocromo (blanco, negro y escala de grises).
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        suiza: {
          blue: "#fafafa",
          deepBlue: "#e4e4e7",
          navy: "#050506",
          fuchsia: "#d4d4d8",
          black: "#09090b",
          white: "#ffffff",
          gray: "#18181b",
          slate: "#27272a",
          brown: "#3f3f46",
          yellow: "#f4f4f5",
          amber: "#a1a1aa",
          red: "#f4f4f5",
          emerald: "#d4d4d8",
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
        suiza: "0 18px 44px -26px rgba(0, 0, 0, 0.95)",
        glow: "0 0 34px -6px rgba(255, 255, 255, 0.28)",
        glass: "0 30px 70px -44px rgba(0, 0, 0, 1)",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(28px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        floatY: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        scanY: {
          "0%": { top: "-8%", opacity: "0" },
          "12%": { opacity: "1" },
          "88%": { opacity: "1" },
          "100%": { top: "108%", opacity: "0" },
        },
        shimmer: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(220%)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-up": "fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        float: "floatY 7s ease-in-out infinite",
        scan: "scanY 2.6s linear infinite",
        shimmer: "shimmer 2.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

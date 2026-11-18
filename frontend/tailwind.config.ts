import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        suiza: {
          blue: "#006EC7",
          fuchsia: "#E6007E",
          black: "#111111",
          white: "#FFFFFF",
          gray: "#F3F4F6",
          brown: "#8B5A2B",
          yellow: "#F9E000",
          red: "#D62828",
        },
      },
      fontFamily: {
        sans: ["Segoe UI", "Tahoma", "Geneva", "Verdana", "sans-serif"],
        display: ["Segoe UI", "Tahoma", "Geneva", "Verdana", "sans-serif"],
      },
      boxShadow: {
        suiza: "0 10px 30px rgba(0, 110, 199, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;

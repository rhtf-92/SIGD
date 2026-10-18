/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), "VITE_");
  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: Number(localEnv.VITE_PORT || 5173),
    proxy: {
      "/api": {
        target: (localEnv.VITE_API_BASE_URL || "http://localhost:3000")
          .replace(/\/api(\/v\d+)?\/?$/i, "")
          .replace(/\/+$/, ""),
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      include: [
        "src/schemas/registroCiudadano.schema.ts",
        "src/schemas/consentimiento.schema.ts",
        "src/data/ucayali.ts",
        "src/hooks/useUbigeoCascade.ts",
        "src/hooks/useCasilla.ts",
        "src/components/registro/**",
        "src/components/casilla/**",
        "src/components/common/UbigeoSelector.tsx",
        "src/pages/registro/**",
        "src/pages/casilla/**",
      ],
    },
  },
  };
});

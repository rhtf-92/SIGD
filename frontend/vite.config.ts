/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/tests/setup.ts",
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
});

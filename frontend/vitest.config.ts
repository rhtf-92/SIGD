import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Cubre las pruebas bajo `src/` y las del directorio de pruebas
    // del plan maestro (`tests/unit/...`).
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/components/expedientes/**/*.{ts,tsx}", "src/hooks/useExpedienteActions.ts", "src/hooks/useFormularioExpediente.ts", "src/utils/foliado.ts", "src/utils/expedienteActions.ts", "src/api/expedienteActions.ts"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      thresholds: { statements: 80, lines: 80, functions: 80, branches: 80 },
    },
  },
});

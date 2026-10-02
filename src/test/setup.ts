import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Definición preventiva de variables de entorno para suites de pruebas
if (typeof import.meta !== "undefined" && import.meta.env) {
  if (!import.meta.env.VITE_API_BASE_URL) {
    (import.meta.env as Record<string, string>).VITE_API_BASE_URL = "http://localhost:3000/api";
  }
}
if (typeof process !== "undefined" && process.env) {
  if (!process.env.VITE_API_BASE_URL) {
    process.env.VITE_API_BASE_URL = "http://localhost:3000/api";
  }
}

afterEach(cleanup);

// jsdom no implementa la capa modal nativa. Teclado e inert se verifican en navegador.
HTMLDialogElement.prototype.showModal = function () { this.open = true; };
HTMLDialogElement.prototype.close = function () { this.open = false; };

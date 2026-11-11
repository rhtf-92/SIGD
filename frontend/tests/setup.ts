import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Aumenta el timeout de utilidades asíncronas de Testing Library (default: 1000ms) a 4000ms
// para tolerar la carga de instanciación concurrente de jsdom en Windows / CI
configure({ asyncUtilTimeout: 4000 });

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

HTMLDialogElement.prototype.showModal = function () { this.open = true; };
HTMLDialogElement.prototype.close = function () { this.open = false; };

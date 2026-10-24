import { describe, expect, it } from "vitest";

import { responderAsistente } from "./asistenteSigd";

describe("responderAsistente (Asistente SIGD local)", () => {
  it("orienta a mesa de partes ante trámite nuevo", () => {
    const r = responderAsistente("¿Cómo presento un trámite?");
    expect(r.id).toBe("mesa-partes");
    expect(r.enlaces.some((e) => e.to.includes("mesa-partes"))).toBe(true);
  });

  it("orienta al validador ante CVD", () => {
    const r = responderAsistente("¿Cómo verifico un documento con CVD?");
    expect(r.id).toBe("cvd");
  });

  it("explica el error ENOENT de npm", () => {
    const r = responderAsistente("npm run dev me da ENOENT package.json");
    expect(r.id).toBe("error-npm");
  });

  it("tolera tildes y mayúsculas", () => {
    const r = responderAsistente("¿QUÉ ES LA CASILLA ELECTRÓNICA?");
    expect(r.id).toBe("casilla");
  });

  it("devuelve ayuda general ante texto vacío o desconocido", () => {
    expect(responderAsistente("").id).toBe("ayuda-general");
    expect(responderAsistente("zxqw jjj").id).toBe("ayuda-general");
  });
});

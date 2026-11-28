import { describe, expect, it } from "vitest";
import { normalizarTexto, textoCoincideBusqueda } from "./normalizarTexto";

describe("normalizarTexto", () => {
  it('hace que "titulo" encuentre "Duplicado de título"', () => {
    expect(textoCoincideBusqueda("Duplicado de título", "titulo")).toBe(true);
  });

  it("ignora mayúsculas", () => {
    expect(normalizarTexto("TÍTULO")).toBe("titulo");
    expect(textoCoincideBusqueda("Duplicado de título", "TITULO")).toBe(true);
  });

  it("trata el vacío como cadena vacía", () => {
    expect(normalizarTexto("")).toBe("");
    expect(normalizarTexto("   ")).toBe("");
    expect(textoCoincideBusqueda("Duplicado de título", "")).toBe(true);
    expect(textoCoincideBusqueda("Duplicado de título", "   ")).toBe(true);
  });
});

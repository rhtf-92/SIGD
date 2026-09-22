import { describe, expect, it } from "vitest";
import { validarFoliado, validarUrlDocumento } from "./foliado";

describe("validarFoliado", () => {
  it("acepta F. 1 a F. N sin modificar la entrada", () => {
    const folios = Object.freeze([1, 2, 3]);
    expect(validarFoliado(folios)).toEqual({ valido: true, total: 3 });
    expect(folios).toEqual([1, 2, 3]);
  });
  it.each([
    { valores: [], codigo: "VACIO" },
    { valores: [2, 3], codigo: "INICIO" },
    { valores: [1, 1], codigo: "DUPLICADO" },
    { valores: [1, 3], codigo: "SALTO" },
    { valores: [0], codigo: "ENTERO_POSITIVO" },
    { valores: [-1], codigo: "ENTERO_POSITIVO" },
    { valores: [1.5], codigo: "ENTERO_POSITIVO" },
    { valores: [NaN], codigo: "ENTERO_POSITIVO" },
    { valores: [Infinity], codigo: "ENTERO_POSITIVO" },
    { valores: [Number.MAX_SAFE_INTEGER + 1], codigo: "ENTERO_POSITIVO" },
    { valores: ["1"], codigo: "FORMATO" },
    { valores: ["1A"], codigo: "FORMATO" },
    { valores: [1, "2-B"], codigo: "FORMATO" },
    { valores: [1, 2, "3-bis"], codigo: "FORMATO" },
    { valores: [null], codigo: "FORMATO" },
  ])("rechaza $valores con $codigo", ({ valores, codigo }) => {
    expect(validarFoliado(valores)).toMatchObject({ valido: false, codigo });
  });
});

describe("URL documental", () => {
  it("acepta origen propio y almacenamiento HTTPS autorizado", () => {
    expect(validarUrlDocumento("/documento.pdf", "https://sigd.example")).toBe("https://sigd.example/documento.pdf");
    expect(validarUrlDocumento("/pagina.png", "http://localhost:5173")).toBe("http://localhost:5173/pagina.png");
    expect(validarUrlDocumento("https://archivos.example/pagina.png", "https://sigd.example", ["https://archivos.example"])).toBe("https://archivos.example/pagina.png");
  });
  it.each(["", " ", "javascript:alert(1)", "data:text/html,prueba", "blob:https://sigd.example/id", "//archivos.example/a", "https://usuario:clave@sigd.example/a", "https://externo.example/a", "http://externo.example/a", "https://[invalid", "/ruta con espacio", "\\servidor\\archivo", "/ruta\narchivo"])("rechaza %s", (url) => {
    expect(validarUrlDocumento(url, "https://sigd.example")).toBeNull();
  });
});

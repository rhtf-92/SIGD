import { describe, expect, it } from "vitest";
import { calcularRangoFolios, validarNuevoDocumento } from "./foliadoValidator";
describe("continuidad al incorporar documentos", () => {
  it.each([[0,1,1,true],[10,5,11,true],[3,2,4,true],[100,3,101,true],[10,5,1,false],[10,5,10,false],[10,5,12,false],[0,2,2,false],[3,2,4.5,false],[3,2,NaN,false]])("ultimo %s paginas %s inicio %s", (ultimo,paginas,inicio,valido) => {
    expect(validarNuevoDocumento(ultimo,paginas,inicio)).toEqual({valido,inicio:ultimo+1,fin:ultimo+paginas});
  });
  it.each([[-1,1],[1,0],[1,1.5],[NaN,1],[Number.MAX_SAFE_INTEGER,1]])("rechaza parametros %s %s", (ultimo,paginas) => {
    expect(() => calcularRangoFolios(ultimo,paginas)).toThrow();
  });
});

import { expect, it, vi, afterEach } from "vitest";
import { rutaApi, leerCatalogo, leerRangos, obtenerFoliacion, obtenerCatalogo } from "./ccdFoliado";
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
it.each(["https://sigd.test", "https://sigd.test/api", "https://sigd.test/api/v1/"])("normaliza %s sin repetir api", base => expect(rutaApi(base, "expedientes/1/foliacion")).toBe("https://sigd.test/api/v1/expedientes/1/foliacion"));
it("conserva subseries recibidas sin inventar fondo/secciones", () => {
 const n={id:"1",codigo:"A",nombre:"Serie",tipo:"SERIE",hijos:[{id:"2",codigo:"A.1",nombre:"Subserie",tipo:"SUBSERIE",hijos:[]}]};
 expect(leerCatalogo({elementos:[n]})).toEqual([n]);
 expect(() => leerCatalogo({elementos:[n,n]})).toThrow();
});
it("valida rangos recibidos y rechaza saltos", () => {
 const n={idDocumento:"1",nombre:null,folioInicio:1,folioFin:5,cantidadFolios:5};
 expect(leerRangos([n])).toEqual([n]);
 expect(() => leerRangos([{...n,folioInicio:2}])).toThrow();
 expect(() => leerRangos([n,n])).toThrow();
});
it("consulta el endpoint real con el token y señal", async () => {
 localStorage.setItem("sigd_token","prueba");
 const consulta=vi.fn().mockResolvedValue({ok:true,json:async()=>[]}); vi.stubGlobal("fetch",consulta);
 const signal=new AbortController().signal;
 expect(await obtenerFoliacion("https://sigd.test/api", "10", signal)).toEqual([]);
 expect(consulta).toHaveBeenCalledWith("https://sigd.test/api/v1/expedientes/10/foliacion",expect.objectContaining({signal,headers:{Authorization:"Bearer prueba"}}));
});
it("no simula éxito ante una ruta no publicada", async () => {
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status:404}));
 await expect(obtenerCatalogo("https://sigd.test",new AbortController().signal)).rejects.toThrow("montaje");
});
it("rechaza identificadores inválidos sin consultar la red", async () => {
 const consulta=vi.fn();vi.stubGlobal("fetch",consulta);
 await expect(obtenerFoliacion("https://sigd.test","abc",new AbortController().signal)).rejects.toThrow();expect(consulta).not.toHaveBeenCalled();
});

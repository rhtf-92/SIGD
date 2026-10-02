import zlib from "node:zlib";
import { a4GeneratorService } from "./src/domains/docucore/a4Generator.service.js";
const r = await a4GeneratorService.generar({
  titulo: "TITULO DE PRUEBA",
  bloques: [
    { tipo: "parrafo", texto: "Parrafo de prueba." },
    { tipo: "separador" },
    { tipo: "firma", cargo: "DIRECTOR [EJEMPLO]", nombre: "APELLIDO NOMBRE [EJEMPLO]", documento: "DNI 00000000 [EJEMPLO]" },
  ],
});
const texto = Buffer.from(r.bytes).toString("latin1");
const partes = texto.split("stream");
for (let i = 1; i < partes.length; i += 1) {
  const crudo = partes[i].split("endstream")[0].replace(/^\r?\n/, "");
  let s: string;
  try { s = zlib.inflateSync(Buffer.from(crudo, "latin1")).toString("latin1"); } catch { s = crudo; }
  if (i === 1) {
    for (const [idx, line] of s.split("\n").entries()) {
      if (idx > 120) break;
      console.log(idx.toString().padStart(3), line);
    }
    console.log("--- truncated ---");
  }
}

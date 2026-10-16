import { describe, expect, it } from "vitest";
import { buscarRespuesta, sugerenciasParaRuta } from "../src/hooks/useAsistenteIA";
import { responderConIA } from "../src/services/asistenteIAService";

const casos: [string, string][] = [
  ["¿dónde veo mis notificaciones?", "casilla-electronica"],
  ["donde veo mis notificaciones", "casilla-electronica"],
  ["¿dónde me llegan los avisos?", "casilla-electronica"],
  ["quiero hacer una solicitud", "mesa-partes-virtual"],
  ["¿cómo presento mi tesis?", "titulacion"],
  ["quiero titularme que hago", "titulacion"],
  ["no puedo entrar a mi cuenta", "registro-login"],
  ["olvide mi contraseña", "registro-login"],
  ["me sale acceso denegado", "registro-login"],
  ["como se si mi documento es verdadero", "validador-cvd"],
  ["tengo un codigo CVD", "validador-cvd"],
  ["perdi mi CUT que hago", "consulta-cut"],
  ["hola", "saludo"],
  ["gracias", "gracias"],
  ["donde presento un tramite con faltas: trmaite", "mesa-partes-virtual"],
  ["cuanto cuesta mi tramite", "tupa-costos"],
  ["cuanto pago por practicas", "tupa-costos"],
  ["que significa observado", "estados-tramite"],
  ["cuanto demora mi tramite", "estados-tramite"],
  ["en que formato subo mis documentos", "requisitos-pdf"],
  ["puedo hablar con una persona", "ayuda-humana"],
];

describe("asistente lenguaje natural", () => {
  for (const [pregunta, esperado] of casos) {
    it(`entiende: "${pregunta}" -> ${esperado}`, () => {
      const r = buscarRespuesta(pregunta);
      expect(r.temaId).toBe(esperado);
    });
  }

  it("seguimiento usa contexto", () => {
    const primera = buscarRespuesta("¿dónde veo mis notificaciones?");
    const seg = buscarRespuesta("¿y eso dónde queda?", primera.temaId);
    expect(seg.temaId).toBe("casilla-electronica");
  });

  it("detecta CUT directo", () => {
    const r = buscarRespuesta("mi cut es CUT-2026-000123");
    expect(r.temaId).toBe("consulta-cut");
  });

  it("sugerencias contextuales por ruta", () => {
    expect(sugerenciasParaRuta("/tramite").length).toBeGreaterThan(0);
    expect(sugerenciasParaRuta("/casilla")[0].ejemplo.toLowerCase()).toContain("notific");
  });

  it("sin clave de IA, la nube devuelve null (fallback local)", async () => {
    const r = await responderConIA("hola", [], { ruta: "/", rol: null });
    expect(r).toBeNull();
  });
});

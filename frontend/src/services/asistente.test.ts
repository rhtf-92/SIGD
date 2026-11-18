import { afterEach, describe, expect, it, vi } from "vitest";
import { detectarIntencion, detalleAsistente, extraerPalabrasClave, resolverConsultaAsistente } from "./asistente";
import type { TupaTramite } from "./tupaApi";

const tramite: TupaTramite = {
  tramite_version_id: "tv-1",
  codigo: "TUPA-02",
  denominacion: "Expedición de Título Profesional Técnico",
  rubro: "Secretaría Académica",
  descripcion: null,
  derecho_monto: null,
  derecho_porcentaje_uit: null,
  derecho_texto: "No especificado",
  cuenta_pago: null,
  plazo_texto: "30 días hábiles",
  plazo_dias_habiles: 30,
  calificacion: "Evaluación previa",
  silencio_administrativo: "No aplica",
  unidad_recibe: null,
  autoridad_resuelve: "Dirección General",
  recursos: null,
  base_legal: null,
  observaciones: "Dato [VALIDAR] con la dirección.",
  requisitos: [{ requisito_id: "req-1", orden: 1, texto: "Solicitud dirigida a la Dirección" }],
};

afterEach(() => vi.restoreAllMocks());

describe("asistente del SIGD", () => {
  it.each([
    ["Mi Casilla Electrónica", "casilla"],
    ["Consultar mi expediente", "expediente"],
    ["Quiero registrarme", "registro"],
    ["¿Cuánto cuesta duplicado de título?", "buscar"],
    ["hola", "desconocida"],
  ] as const)("detecta la intención de %s", (texto, intencion) => {
    expect(detectarIntencion(texto)).toBe(intencion);
  });

  it("simplifica una pregunta de precio a palabras del trámite y consulta el TUPA", async () => {
    const listar = vi.fn().mockResolvedValue({ tramites: [tramite] });
    expect(extraerPalabrasClave("¿Cuánto cuesta el duplicado de título?")).toBe("titulo");
    await expect(resolverConsultaAsistente("¿Cuánto cuesta el duplicado de título?", listar))
      .resolves.toEqual({ tipo: "resultados", tramites: [tramite] });
    expect(listar).toHaveBeenCalledWith({ q: "titulo", rubro: "", pagina: 1 });
  });

  it('con "titulo" encuentra "Duplicado de título" si la API no filtra acentos', async () => {
    const duplicado: TupaTramite = { ...tramite, denominacion: "Duplicado de título" };
    const listar = vi.fn()
      .mockResolvedValueOnce({ tramites: [] })
      .mockResolvedValueOnce({ tramites: [duplicado] });
    await expect(resolverConsultaAsistente("titulo", listar))
      .resolves.toEqual({ tipo: "resultados", tramites: [duplicado] });
  });

  it("devuelve cero resultados sin inventar trámites", async () => {
    const listar = vi.fn().mockResolvedValue({ tramites: [] });
    await expect(resolverConsultaAsistente("certificado desconocido", listar))
      .resolves.toEqual({ tipo: "resultados", tramites: [] });
  });

  it("propaga los errores de red para que la interfaz informe el problema", async () => {
    const listar = vi.fn().mockRejectedValue(new Error("network"));
    await expect(resolverConsultaAsistente("certificado de estudios", listar)).rejects.toThrow("network");
  });

  it("incluye costo, requisitos, plazo, silencio, autoridad y la marca de validación", () => {
    const detalle = detalleAsistente(tramite);
    expect(detalle).toContain("Derecho de tramitación: No especificado");
    expect(detalle).toContain("1. Solicitud dirigida a la Dirección");
    expect(detalle).toContain("Plazo: 30 días hábiles");
    expect(detalle).toContain("Silencio administrativo: No aplica");
    expect(detalle).toContain("Autoridad que resuelve: Dirección General");
    expect(detalle).toContain("Pendiente de validación por la dirección");
  });
});

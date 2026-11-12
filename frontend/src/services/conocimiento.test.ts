import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarConocimiento, validarBase, type ConocimientoEntrada } from "./conocimiento";
import { resolverConsultaAsistente } from "./asistente";
import type { TupaTramite } from "./tupaApi";
import baseJson from "../data/conocimiento/base.json";

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

// ENTRADA DE PRUEBA: base ficticia solo para pruebas de conocimiento
const basePrueba: ConocimientoEntrada[] = [
  {
    id: "ent-prueba-001",
    tema: "Biblioteca del instituto",
    preguntas_ejemplo: ["¿El instituto cuenta con biblioteca?", "¿Dónde queda la biblioteca?"],
    palabras_clave: ["instituto", "cuenta", "biblioteca"],
    respuesta: "Sí, el instituto cuenta con biblioteca en el primer piso del edificio principal.",
    fuente: { documento: "Reglamento Interno", seccion: "Servicios Estudiantiles", fecha: "2026-03-01" },
    validado: true,
  },
  {
    id: "ent-prueba-002",
    tema: "Registro ciudadano",
    preguntas_ejemplo: ["¿Cómo me registro?", "¿Dónde me registro?"],
    palabras_clave: ["registro", "registrarme", "cuenta"],
    respuesta: "El registro ciudadano se hace en la página de registro del SIGD.",
    fuente: { documento: "Manual del Usuario", seccion: "Acceso", fecha: "2026-01-15" },
    validado: true,
  },
  {
    id: "ent-prueba-003",
    tema: "Costo del certificado de estudios",
    preguntas_ejemplo: ["¿Cuánto cuesta el certificado de estudios?"],
    palabras_clave: ["certificado", "estudios", "costo"],
    respuesta: "El certificado de estudios cuesta S/ 25.00.",
    fuente: { documento: "TUPA", seccion: "Certificados", fecha: "2026-01-01" },
    validado: true,
  },
];

// TRES ENTRADAS QUE COINCIDEN CON "registro" (solo para probar el tope de 2 respuestas)
const baseTres: ConocimientoEntrada[] = [
  {
    id: "ent-top-001",
    tema: "Registro ciudadano",
    preguntas_ejemplo: ["¿Cómo me registro?", "¿Dónde me registro?"],
    palabras_clave: ["registro", "registrarme"],
    respuesta: "El registro ciudadano se hace en la página de registro del SIGD.",
    fuente: { documento: "Manual del Usuario", seccion: "Acceso", fecha: "2026-01-15" },
    validado: true,
  },
  {
    id: "ent-top-002",
    tema: "Registro de títulos",
    preguntas_ejemplo: ["¿Dónde registro títulos?", "¿Cómo inscribo mi título?"],
    palabras_clave: ["registro", "títulos", "inscripción"],
    respuesta: "Los títulos se registran en la Secretaría Académica.",
    fuente: { documento: "Reglamento Académico", seccion: "Títulos", fecha: "2026-02-01" },
    validado: true,
  },
  {
    id: "ent-top-003",
    tema: "Registro de documentos",
    preguntas_ejemplo: ["¿Dónde registro documentos?", "¿Dónde dejo mis documentos?"],
    palabras_clave: ["registro", "documentos", "mesa de partes"],
    respuesta: "Los documentos se reciben en Mesa de Partes.",
    fuente: { documento: "Manual del Usuario", seccion: "Acceso", fecha: "2026-01-15" },
    validado: true,
  },
];

afterEach(() => vi.restoreAllMocks());

describe("conocimiento del asistente", () => {
  it("devuelve coincidencia fuerte para consulta sobre biblioteca", () => {
    const resultados = buscarConocimiento("el instituto cuenta con biblioteca", basePrueba);
    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados[0].entrada.id).toBe("ent-prueba-001");
    expect(resultados[0].puntaje).toBeGreaterThanOrEqual(0.5);
  });

  it("no devuelve resultados para consulta sin coincidencia", () => {
    const resultados = buscarConocimiento("xyzwq consulta inexistente nada", basePrueba);
    expect(resultados).toEqual([]);
  });

  it("respeta el umbral fuerte: palabras vacías solas no coinciden", () => {
    const resultados = buscarConocimiento("el la un", basePrueba);
    expect(resultados).toEqual([]);
  });

  it("validarBase detecta fuente faltante", () => {
    const baseMal = [{ ...basePrueba[0], fuente: { documento: "" } }] as ConocimientoEntrada[];
    const errores = validarBase(baseMal);
    expect(errores.some((e) => e.includes("fuente.documento"))).toBe(true);
  });

  it("validarBase detecta ids duplicados", () => {
    const baseMal = [basePrueba[0], { ...basePrueba[0], id: basePrueba[0].id }];
    const errores = validarBase(baseMal);
    expect(errores.some((e) => e.includes("duplicado"))).toBe(true);
  });

  it("con base vacía, 'quiero registrarme' da la ruta de registro como antes", async () => {
    const resultado = await resolverConsultaAsistente("quiero registrarme", undefined, []);
    expect(resultado.tipo).toBe("ruta");
    if (resultado.tipo === "ruta") {
      expect(resultado.ruta).toBe("/registro");
    }
  });

  it("con base vacía, 'cuanto cuesta un duplicado' da lo mismo que antes (desconocida)", async () => {
    const listar = vi.fn().mockResolvedValue({ tramites: [tramite] });
    const resultado = await resolverConsultaAsistente("cuanto cuesta un duplicado", listar, []);
    expect(resultado.tipo).toBe("desconocida");
    expect(listar).not.toHaveBeenCalled();
  });

  it("el instituto cuenta con biblioteca responde con conocimiento, no con ruta /registro", async () => {
    const resultado = await resolverConsultaAsistente("el instituto cuenta con biblioteca", undefined, basePrueba);
    expect(resultado.tipo).toBe("conocimiento");
    if (resultado.tipo === "conocimiento") {
      expect(resultado.respuestas[0].texto).toContain("biblioteca");
    }
  });

  it("base.json es un array y validarBase(base.json) devuelve []", () => {
    expect(Array.isArray(baseJson)).toBe(true);
    expect(validarBase(baseJson as ConocimientoEntrada[])).toEqual([]);
  });

  it("consulta con 3 palabras significativas y solo 1 coincidencia no devuelve resultados", () => {
    const resultados = buscarConocimiento("biblioteca piso edificio", basePrueba);
    expect(resultados).toEqual([]);
  });

  it("palabra corta suelta no activa una entrada por coincidencia de subcadena", () => {
    const resultados = buscarConocimiento("bib", basePrueba);
    expect(resultados).toEqual([]);
  });

  it("palabra que solo aparece en la respuesta no activa la entrada", () => {
    const resultados = buscarConocimiento("primer edificio", basePrueba);
    expect(resultados).toEqual([]);
  });

  it("con 3 entradas que coinciden devuelve como máximo 2 respuestas", async () => {
    const resultado = await resolverConsultaAsistente("registro", undefined, baseTres);
    expect(resultado.tipo).toBe("conocimiento");
    if (resultado.tipo === "conocimiento") {
      expect(resultado.respuestas.length).toBeLessThanOrEqual(2);
    }
  });

  it("con la base real vacía, 'el instituto cuenta con biblioteca' no devuelve tipo conocimiento", async () => {
    const resultado = await resolverConsultaAsistente("el instituto cuenta con biblioteca");
    expect(resultado.tipo).not.toBe("conocimiento");
  });

  it("responde a 'cuanto cuesta el certificado' con ficha de certificado", () => {
    const resultados = buscarConocimiento(
      "cuanto cuesta el certificado",
      basePrueba,
    );
    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados[0].entrada.id).toBe("ent-prueba-003");
    expect(resultados[0].puntaje).toBeGreaterThanOrEqual(0.5);
  });

  it("responde igual con comas y puntos pegados a las palabras", () => {
    const resultados = buscarConocimiento(
      "cuanto, cuesta el certificado.",
      basePrueba,
    );
    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados[0].entrada.id).toBe("ent-prueba-003");
  });

  it("consulta fuera de tema no coincide con la ficha de certificado", () => {
    const resultados = buscarConocimiento(
      "xyzwq consulta inexistente nada",
      basePrueba,
    );
    expect(resultados).toEqual([]);
  });
});
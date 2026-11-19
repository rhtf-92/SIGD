/**
 * Contratos de datos para el Proyector de Resoluciones Directorales (ENT-M04-02).
 * Formato oficial institucional del IESTP "Suiza" (Pucallpa, Ucayali).
 */

export type TipoResolucion =
  | "TITULACION"
  | "GRADO_ACADEMICO"
  | "RECTIFICACION_NOTA"
  | "CONVALIDACION"
  | "DISPOSICION_GENERAL";

export type EstadoResolucion =
  | "BORRADOR"
  | "EN_REVISION"
  | "APROBADO_PARA_FIRMA"
  | "FIRMADO_DIGITALMENTE"
  | "EN_FIRMA"
  | "FIRMADA"
  | "BORRADOR_PENDIENTE_FIRMA";

export interface ArticuloResolucion {
  id: string;
  numero: number;
  texto: string;
}

export interface ResolucionDirectoral {
  id: string;
  numeroResolucion: string; // Ej: "RD N.° 0412-2026-DG-IESTP-SUIZA"
  anio: number;
  tipo: TipoResolucion;
  asunto: string;
  unidadOrganica: string; // Ej: "Dirección General"
  fechaEmision: string; // ISO 8601
  expedienteRelacionado?: string; // CUT del expediente (ej. EXP-2026-000412)
  administradoNombre: string;
  administradoDocumento: string;
  programaEstudios: string; // Ej: "Desarrollo de Sistemas de Información"
  visto: string;
  considerandos: string[];
  articulos: ArticuloResolucion[];
  firmanteCargo: string;
  firmanteNombre: string;
  estado: EstadoResolucion;
  hashBorradorSha256?: string;
}

export interface PlantillaResolucion {
  id: string;
  nombre: string;
  tipo: TipoResolucion;
  vistoBase: string;
  considerandosBase: string[];
  articulosBase: string[];
}

const TIPOS_RESOLUCION_VALIDOS: readonly TipoResolucion[] = [
  "TITULACION",
  "GRADO_ACADEMICO",
  "RECTIFICACION_NOTA",
  "CONVALIDACION",
  "DISPOSICION_GENERAL",
] as const;

const ESTADOS_RESOLUCION_VALIDOS: readonly EstadoResolucion[] = [
  "BORRADOR",
  "EN_REVISION",
  "APROBADO_PARA_FIRMA",
  "FIRMADO_DIGITALMENTE",
] as const;

/**
 * Validador estricto para borradores de ResolucionDirectoral (BJ-02).
 * Verifica la estructura en tiempo de ejecución sin depender únicamente de aserciones TypeScript.
 */
export function validarResolucionDirectoralBorrador(data: unknown): ResolucionDirectoral | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const d = data as Record<string, unknown>;

  if (typeof d.id !== "string" || !d.id.trim() || d.id.length > 100) return null;
  if (typeof d.numeroResolucion !== "string" || !d.numeroResolucion.trim() || d.numeroResolucion.length > 150) return null;
  if (typeof d.anio !== "number" || !Number.isInteger(d.anio) || d.anio < 2000 || d.anio > 2100) return null;
  if (typeof d.tipo !== "string" || !TIPOS_RESOLUCION_VALIDOS.includes(d.tipo as TipoResolucion)) return null;
  if (typeof d.asunto !== "string" || d.asunto.length > 2000) return null;
  if (typeof d.unidadOrganica !== "string" || d.unidadOrganica.length > 300) return null;
  if (typeof d.fechaEmision !== "string" || d.fechaEmision.length > 50) return null;
  if (typeof d.administradoNombre !== "string" || d.administradoNombre.length > 300) return null;
  if (typeof d.administradoDocumento !== "string" || d.administradoDocumento.length > 50) return null;
  if (typeof d.programaEstudios !== "string" || d.programaEstudios.length > 300) return null;
  if (typeof d.visto !== "string" || d.visto.length > 20000) return null;

  if (
    !Array.isArray(d.considerandos) ||
    d.considerandos.length > 100 ||
    !d.considerandos.every((c) => typeof c === "string" && c.length <= 20000)
  ) {
    return null;
  }

  if (
    !Array.isArray(d.articulos) ||
    d.articulos.length > 100 ||
    !d.articulos.every((a) => {
      if (!a || typeof a !== "object" || Array.isArray(a)) return false;
      const art = a as Record<string, unknown>;
      return (
        typeof art.id === "string" &&
        art.id.length <= 100 &&
        typeof art.numero === "number" &&
        Number.isInteger(art.numero) &&
        art.numero > 0 &&
        typeof art.texto === "string" &&
        art.texto.length <= 20000
      );
    })
  ) {
    return null;
  }

  if (typeof d.firmanteCargo !== "string" || d.firmanteCargo.length > 200) return null;
  if (typeof d.firmanteNombre !== "string" || d.firmanteNombre.length > 200) return null;
  if (typeof d.estado !== "string" || !ESTADOS_RESOLUCION_VALIDOS.includes(d.estado as EstadoResolucion)) return null;

  if (d.expedienteRelacionado !== undefined && (typeof d.expedienteRelacionado !== "string" || d.expedienteRelacionado.length > 100)) {
    return null;
  }
  if (d.hashBorradorSha256 !== undefined && (typeof d.hashBorradorSha256 !== "string" || d.hashBorradorSha256.length > 128)) {
    return null;
  }

  return d as unknown as ResolucionDirectoral;
}

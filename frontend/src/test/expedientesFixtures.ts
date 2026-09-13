import type { FondoDocumental, DocumentoExpediente } from "../types/ccdArchivistica";
import type { AccionExpediente, ExpedienteAccionReferencia, UnidadDestino } from "../types/expedienteActions";

/** Datos sintéticos exclusivos de las pruebas; no representan registros del servidor. */
export const fondos: readonly FondoDocumental[] = [{
  tipo: "fondo", id: "fondo-prueba", nombre: "IESTP_SUIZA", secciones: [{
    tipo: "seccion", id: "seccion-prueba", nombre: "Secretaría Académica", series: [
      { tipo: "serie", id: "serie-tit", nombre: "Expedientes de Titulación", codigo: "CCD-SA-TIT" },
      { tipo: "serie", id: "serie-act", nombre: "Actas de Evaluación", codigo: "CCD-SA-ACTA" },
      { tipo: "serie", id: "serie-inactiva", nombre: "Serie inactiva", codigo: "PRUEBA", deshabilitada: true },
    ],
  }],
}];

export const documentos: readonly DocumentoExpediente[] = [
  { id: "documento-1", nombre: "Solicitud de prueba", folios: [{ numero: 1, pagina: 1, urlImagen: "/pagina-prueba.png" }, { numero: 2, pagina: 2 }] },
  { id: "documento-2", nombre: "Informe de prueba", folios: [{ numero: 3, pagina: 1 }], urlOriginal: "/informe-prueba.pdf" },
];

export const expediente: ExpedienteAccionReferencia = { id: "principal-prueba", codigo: "CUT-PRUEBA-001", unidadOrigenId: "origen-prueba" };
export const conexo: ExpedienteAccionReferencia = { id: "conexo-prueba", codigo: "CUT-PRUEBA-002" };
export const otroConexo: ExpedienteAccionReferencia = { id: "otro-conexo-prueba", codigo: "CUT-PRUEBA-003" };
export const unidades: readonly UnidadDestino[] = [
  { id: "origen-prueba", nombre: "Mesa de Partes", habilitada: true },
  { id: "destino-prueba", nombre: "Secretaría Académica", habilitada: true },
  { id: "inactiva-prueba", nombre: "Unidad inactiva", habilitada: false },
];

export function crearAccionPrueba<Entrada, Salida>(opciones: Partial<AccionExpediente<Entrada, Salida>> = {}): AccionExpediente<Entrada, Salida> {
  return { disponible: true, pending: false, estado: "idle", error: null, resultado: undefined, ejecutar: async () => true, restablecer: () => undefined, ...opciones };
}

export function diferida<T>() {
  let resolver: (valor: T) => void = () => { throw new Error("Promesa no inicializada"); };
  let rechazar: (error: unknown) => void = () => { throw new Error("Promesa no inicializada"); };
  const promesa = new Promise<T>((resolve, reject) => { resolver = resolve; rechazar = reject; });
  return { promesa, resolver, rechazar };
}

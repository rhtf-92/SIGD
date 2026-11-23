import { z } from 'zod';
import { apiClient } from '../api/client';
import type { ArchivoTramite } from '../types/tramiteWizardState';
import type { DocumentacionTramite, RequisitoDocumental, ClasificacionAdjunto } from '../types/documentacionTramite';

const tipoDocItem = z.object({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  condicion: z.string().nullable(),
});

const requisito = z.object({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().optional(),
  obligatorio: z.boolean(),
  clasificacion: z.enum(['EXPEDIENTE', 'ANEXO']),
  formatosAdmitidos: z.array(z.string()).optional(),
  observaciones: z.string().optional(),
  fuente: z.string().optional(),
  estadoValidacion: z.string().optional(),
  versionTupa: z.string().optional(),
  tipos: z.array(tipoDocItem),
});

const contrato = z.object({
  id: z.string().uuid(),
  codigo: z.string(),
  codigoVisible: z.string().optional(),
  numeroVisible: z.string().optional(),
  denominacion: z.string(),
  condicionFinanciera: z.enum(['GRATUITO', 'SUJETO_PAGO', 'PENDIENTE_VALIDACION']),
  tarifa: z
    .object({
      id: z.string().optional(),
      importe: z.string().regex(/^\d+(\.\d{1,2})?$/),
      moneda: z.string(),
      concepto: z.string(),
      fuente: z.string().optional(),
    })
    .nullable(),
  estadoValidacion: z.string().optional(),
  sinAnexosEspecificos: z.boolean().optional(),
  observacionInstitucional: z.string().optional(),
  unidadRecepcion: z.string().optional(),
  unidadResponsable: z.string().optional(),
  autoridadResolutiva: z.string().optional(),
  plazoDias: z.number().nullable().optional(),
  silencioAdministrativo: z.string().nullable().optional(),
  versionTupa: z.string().optional(),
  requisitos: z.array(requisito),
  anexos: z.array(requisito),
  nota: z.string(),
});

export async function consultarDocumentacion(id: string, signal?: AbortSignal): Promise<DocumentacionTramite> {
  const respuesta = await apiClient.get<unknown>(`/api/v1/tramites/tipos/${id}/documentacion`, {
    ...(signal ? { signal } : {}),
  });
  const data = contrato.parse(respuesta.data);
  if (data.id !== id) throw new Error('El detalle recibido corresponde a otro procedimiento.');
  return data;
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export interface IntegridadArchivoResultado {
  valido: boolean;
  motivo?: string;
}

export function verificarIntegridadArchivo(archivo: ArchivoTramite): IntegridadArchivoResultado {
  if (!archivo.nombre || !archivo.nombre.toLowerCase().endsWith('.pdf')) {
    return { valido: false, motivo: 'Solo se admiten documentos en formato PDF institucional.' };
  }
  if (archivo.storageUrl && !/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i.test(archivo.storageUrl)) {
    return { valido: false, motivo: 'El documento no cuenta con una referencia válida de almacenamiento.' };
  }
  if (!archivo.hashSha256 || !/^[0-9a-f]{64}$/i.test(archivo.hashSha256)) {
    return { valido: false, motivo: 'Falta la huella criptográfica SHA-256 o es inválida.' };
  }
  if (!Number.isInteger(archivo.peso) || archivo.peso <= 0 || archivo.peso > MAX_FILE_SIZE_BYTES) {
    return { valido: false, motivo: 'El tamaño del archivo no es válido (máximo 20 MB).' };
  }
  return { valido: true };
}

export type EstadoCumplimientoRequisito = 'PRESENTADO' | 'PENDIENTE' | 'OBSERVADO';

export interface EvaluacionRequisito {
  id: string;
  codigo: string;
  nombre: string;
  obligatorio: boolean;
  clasificacion: ClasificacionAdjunto;
  estado: EstadoCumplimientoRequisito;
  archivoAsociado?: ArchivoTramite;
  motivoObservacion?: string;
}

/**
 * Reconcilia y asocia automáticamente y de forma canónica los archivos adjuntos
 * con los requisitos documentales del procedimiento seleccionado.
 *
 * Criterios institucionales:
 * 1. Asociación 1 a 1: un archivo satisface a lo más un requisito y no se duplica.
 * 2. Si ya tiene un requisitoId canónico (UUID) válido, se preserva y valida.
 * 3. Si tiene un ID legacy/estático (e.g. REQ-SUZ26-035-FUT), se mapea al requisito oficial por código canónico.
 * 4. Si carece de requisitoId:
 *    - Archivo clasificado como EXPEDIENTE (o con nombre canónico FUT/Solicitud): se asocia con el
 *      requisito principal FUT del procedimiento si aún no ha sido cubierto.
 *    - Archivo clasificado como ANEXO: se asocia con un requisito tipo anexo pendiente de asignar.
 * 5. Se completan los metadatos institucionales: requisitoId, clasificacion, tipoDocumentalId y tipoDocumentalCodigo.
 */
export function autoAsociarArchivosRequisitos(
  detalle: DocumentacionTramite,
  archivos: ArchivoTramite[]
): ArchivoTramite[] {
  if (!archivos.length) return archivos;

  const todosRequisitos = [...detalle.requisitos, ...detalle.anexos];
  const asignados = new Set<string>();

  // 1. Primera pasada: respetar asociaciones existentes válidas o reconciliar IDs legacy
  const archivosActualizados: ArchivoTramite[] = archivos.map((archivo) => {
    let reqId = archivo.requisitoId;
    let req = reqId ? todosRequisitos.find((r) => r.id === reqId) : undefined;

    // Si tiene un ID estático o legacy (p.ej. REQ-SUZ26-035-FUT), reconciliar por código canónico
    if (reqId && !req) {
      if (reqId.includes('FUT')) {
        req = todosRequisitos.find((r) => r.codigo === 'FUT' || r.clasificacion === 'EXPEDIENTE');
      } else {
        const codigoBuscado = reqId.replace(/^(REQ|ANX)-[^-]+-/, '');
        req = todosRequisitos.find((r) => r.codigo === codigoBuscado);
      }
      if (req) {
        reqId = req.id;
      }
    }

    if (req && !asignados.has(req.id)) {
      asignados.add(req.id);
      const tipo = req.tipos.length === 1 ? req.tipos[0] : undefined;
      return {
        ...archivo,
        requisitoId: req.id,
        clasificacion: req.clasificacion,
        tipoDocumentalId: tipo?.id ?? archivo.tipoDocumentalId,
        tipoDocumentalCodigo: tipo?.codigo ?? archivo.tipoDocumentalCodigo,
      };
    }

    return archivo;
  });

  // 2. Segunda pasada: autoasociar archivos pendientes usando reglas canónicas institucionales
  return archivosActualizados.map((archivo) => {
    // Si ya está asociado y registrado en asignados, conservar
    if (archivo.requisitoId && asignados.has(archivo.requisitoId)) {
      return archivo;
    }

    let reqEncontrado: RequisitoDocumental | undefined;

    // A. Si el archivo es clasificado como EXPEDIENTE o su nombre indica FUT/Solicitud
    const esNombreFut = /fut|solicitud|tramite|formato\s*unico/i.test(archivo.nombre);
    if (archivo.clasificacion === 'EXPEDIENTE' || esNombreFut) {
      reqEncontrado = todosRequisitos.find(
        (r) => (r.clasificacion === 'EXPEDIENTE' || r.codigo === 'FUT') && !asignados.has(r.id)
      );
    }

    // B. Si es ANEXO
    if (!reqEncontrado && archivo.clasificacion === 'ANEXO') {
      reqEncontrado = detalle.anexos.find((r) => !asignados.has(r.id));
    }

    if (reqEncontrado) {
      asignados.add(reqEncontrado.id);
      const tipo = reqEncontrado.tipos.length === 1 ? reqEncontrado.tipos[0] : undefined;
      return {
        ...archivo,
        requisitoId: reqEncontrado.id,
        clasificacion: reqEncontrado.clasificacion,
        tipoDocumentalId: tipo?.id ?? archivo.tipoDocumentalId,
        tipoDocumentalCodigo: tipo?.codigo ?? archivo.tipoDocumentalCodigo,
      };
    }

    return archivo;
  });
}

export function evaluarRequisitosTramite(
  detalle: DocumentacionTramite,
  archivos: ArchivoTramite[]
): EvaluacionRequisito[] {
  const todos = [...detalle.requisitos, ...detalle.anexos];

  return todos.map((r) => {
    const archivo = archivos.find((a) => a.requisitoId === r.id);

    if (!archivo) {
      return {
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        obligatorio: r.obligatorio,
        clasificacion: r.clasificacion,
        estado: 'PENDIENTE',
      };
    }

    const integridad = verificarIntegridadArchivo(archivo);
    if (!integridad.valido) {
      return {
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        obligatorio: r.obligatorio,
        clasificacion: r.clasificacion,
        estado: 'OBSERVADO',
        archivoAsociado: archivo,
        motivoObservacion: integridad.motivo,
      };
    }

    if (archivo.clasificacion !== r.clasificacion) {
      return {
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        obligatorio: r.obligatorio,
        clasificacion: r.clasificacion,
        estado: 'OBSERVADO',
        archivoAsociado: archivo,
        motivoObservacion: `La clasificación '${archivo.clasificacion}' no coincide con la exigida '${r.clasificacion}'.`,
      };
    }

    if (r.tipos.some((t) => t.condicion !== null)) {
      return {
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        obligatorio: r.obligatorio,
        clasificacion: r.clasificacion,
        estado: 'OBSERVADO',
        archivoAsociado: archivo,
        motivoObservacion: `La condición documental de ${r.nombre} requiere validación institucional.`,
      };
    }

    return {
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      obligatorio: r.obligatorio,
      clasificacion: r.clasificacion,
      estado: 'PRESENTADO',
      archivoAsociado: archivo,
    };
  });
}

export function validarAdjuntosRequisitos(detalle: DocumentacionTramite, archivos: ArchivoTramite[]): string | null {
  const archivosEfectivos = autoAsociarArchivosRequisitos(detalle, archivos);

  if (!archivosEfectivos.some((a) => a.clasificacion === 'EXPEDIENTE')) {
    return 'Adjunte al menos un PDF clasificado como EXPEDIENTE.';
  }

  const requisitos = [...detalle.requisitos, ...detalle.anexos];
  for (const archivo of archivosEfectivos) {
    if (archivo.clasificacion !== 'EXPEDIENTE' && archivo.clasificacion !== 'ANEXO') {
      return `Clasifique el archivo ${archivo.nombre}.`;
    }
    const r = requisitos.find((req) => req.id === archivo.requisitoId);
    if (archivo.requisitoId && (!r || r.clasificacion !== archivo.clasificacion)) {
      return `Revise el requisito asociado a ${archivo.nombre}.`;
    }
  }

  const evaluaciones = evaluarRequisitosTramite(detalle, archivosEfectivos);

  const observados = evaluaciones.filter((e) => e.estado === 'OBSERVADO');
  if (observados.length > 0) {
    const primero = observados[0];
    return `Documento observado (${primero.archivoAsociado?.nombre ?? primero.nombre}): ${primero.motivoObservacion}`;
  }

  const faltantes = evaluaciones.filter((e) => e.obligatorio && e.estado === 'PENDIENTE');
  if (faltantes.length > 0) {
    return `Faltan documentos obligatorios: ${faltantes.map((r) => r.nombre).join('; ')}.`;
  }

  return null;
}

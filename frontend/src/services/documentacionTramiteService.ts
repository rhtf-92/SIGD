import { z } from 'zod';
import { apiClient } from '../api/client';
import type { ArchivoTramite } from '../types/tramiteWizardState';
import type { DocumentacionTramite } from '../types/documentacionTramite';

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

export function validarAdjuntosRequisitos(detalle: DocumentacionTramite, archivos: ArchivoTramite[]): string | null {
  if (!archivos.some((a) => a.clasificacion === 'EXPEDIENTE')) return 'Adjunte al menos un PDF clasificado como EXPEDIENTE.';
  const requisitos = [...detalle.requisitos, ...detalle.anexos];
  for (const archivo of archivos) {
    if (archivo.clasificacion !== 'EXPEDIENTE' && archivo.clasificacion !== 'ANEXO') return `Clasifique el archivo ${archivo.nombre}.`;
    const r = requisitos.find((r) => r.id === archivo.requisitoId);
    if (archivo.requisitoId && (!r || r.clasificacion !== archivo.clasificacion)) return `Revise el requisito asociado a ${archivo.nombre}.`;
    if (r && (r.tipos.length !== 1 || r.tipos.some((t) => t.condicion !== null))) return `La configuración documental de ${r.nombre} requiere revisión institucional.`;
  }
  const faltantes = requisitos.filter((r) => r.obligatorio && !archivos.some((a) => a.requisitoId === r.id));
  return faltantes.length ? `Faltan documentos obligatorios: ${faltantes.map((r) => r.nombre).join('; ')}.` : null;
}

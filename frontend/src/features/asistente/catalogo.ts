import { z } from 'zod';
import { env } from '../../config/env';

const texto = z.string().trim().min(1).max(12000);
const documentoSchema = z.object({
  codigo: texto,
  nombre: texto,
  obligatorio: z.boolean().optional(),
});
const procedimientoSchema = z.object({
  id: z.string().uuid(),
  codigo: texto,
  denominacion: texto,
  vigente: z.boolean(),
  descripcion: z.string().max(20000).nullable().optional(),
  tipos_documentales: z.array(documentoSchema).max(100).nullable().optional(),
});
export type ProcedimientoOrientacion = z.infer<typeof procedimientoSchema>;

export const CATALOGO_ENDPOINT = '/api/v1/tramites/tipos';

export function interpretarCatalogo(datos: unknown): ProcedimientoOrientacion[] {
  const lista = z.array(procedimientoSchema).max(500).parse(datos);
  const ids = new Set<string>();
  const codigos = new Set<string>();
  for (const item of lista) {
    if (ids.has(item.id.toLowerCase()) || codigos.has(item.codigo)) {
      throw new Error('El catálogo recibido contiene referencias duplicadas.');
    }
    ids.add(item.id.toLowerCase());
    codigos.add(item.codigo);
  }
  return lista.filter((item) => item.vigente && /^SUZ26-\d{3}$/.test(item.codigo));
}

/** GET público sin JWT/cookies ni interceptor de renovación de sesión.
 * Nunca se envían preguntas ni se consulta información personal.
 */
export async function consultarCatalogo(signal: AbortSignal): Promise<ProcedimientoOrientacion[]> {
  const controller = new AbortController();
  const cancelar = () => controller.abort();
  signal.addEventListener('abort', cancelar, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(cancelar, 10000);
  try {
    const respuesta = await fetch(`${env.apiBaseUrl}${CATALOGO_ENDPOINT}`, {
      method: 'GET', credentials: 'omit', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!respuesta.ok) throw new Error('No se pudo consultar el catálogo institucional.');
    const datos: unknown = await respuesta.json();
    return interpretarCatalogo(datos);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancelar);
  }
}

export function informacionPublicada(procedimiento: ProcedimientoOrientacion) {
  const lineas = (procedimiento.descripcion ?? '').split(/\r?\n/).map((linea) => linea.trim());
  const valor = (etiqueta: string) => lineas.find((linea) => linea.startsWith(etiqueta))?.slice(etiqueta.length).trim();
  // plazo_dias / silencio_administrativo pueden ser defaults técnicos.
  // Solo se informa el texto explícito de la fuente, nunca esos defaults.
  const plazo = valor('Plazo de atención:');
  return {
    detalle: lineas[0] || 'La fuente no publica una descripción del procedimiento.',
    costo: valor('Derecho de pago:') || 'No publicado en la fuente disponible.',
    plazo: plazo && !/no especificado|no documentado|no informado/i.test(plazo)
      ? plazo : 'No especificado en la fuente; no puedo indicar un plazo oficial.',
    fuente: valor('Fuente verificada:') || 'Catálogo formal vigente del SIGD (sin referencia de fuente adicional).',
    pendienteInstitucional: /pendiente de validaci[oó]n institucional/i.test(procedimiento.descripcion ?? ''),
  };
}

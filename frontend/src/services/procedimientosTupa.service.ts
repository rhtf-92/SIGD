import { apiClient } from '../api/client';
import { adaptarProcedimientoTupa, esUuidCanonico, type ProcedimientoTupa } from '../types/procedimientoTupa';

export const PROCEDIMIENTOS_TUPA_ENDPOINT = '/api/v1/tramites/tupa?aprobados=true';

export interface RegistroTupaCompleto {
  readonly registroVersionId: string;
  readonly denominacion: string;
  readonly monto: string | null;
  readonly requisitos: readonly string[];
  readonly estadoValidacion: 'APROBADO' | 'PENDIENTE_VALIDACION';
  readonly revision: number;
  readonly vigenciaDesde: string | null;
  readonly vigenciaHasta: string | null;
  readonly fuente: { readonly nombre: string; readonly referenciaFila: string; readonly pagina: number };
}

/** Catálogo completo solo para usuarios autorizados por el backend. */
export async function obtenerCatalogoTupaCompleto(signal?: AbortSignal): Promise<RegistroTupaCompleto[]> {
  const respuesta = await apiClient.get<unknown>('/api/v1/tramites/tupa', { signal });
  if (!Array.isArray(respuesta.data)) throw new Error('Respuesta TUPA completa inválida.');
  const registros: RegistroTupaCompleto[] = [];
  const codigos = new Set<string>();
  for (const raw of respuesta.data) {
    if (typeof raw !== 'object' || raw === null) throw new Error('Fila TUPA inválida.');
    const fila = raw as Record<string, unknown>;
    const fuente = (typeof fila.fuente === 'object' && fila.fuente !== null)
      ? (fila.fuente as Record<string, unknown>)
      : {};

    const registroVersionId = String(fila.registroVersionId || fila.id_procedimiento || fila.idProcedimiento || '').trim();
    const referenciaFila = String(fuente.referenciaFila || fila.codigoRef || fila.codigo_ref || fila.codigo || fila.id || '').trim();
    const denominacion = String(fila.denominacion || '').trim();
    const nombreFuente = String(fuente.nombre || 'TUPA Institucional');
    const paginaFuente = typeof fuente.pagina === 'number' ? fuente.pagina : 1;
    const revision = typeof fila.revision === 'number' ? fila.revision : 1;
    const vigenciaDesde = typeof fila.vigenciaDesde === 'string' ? fila.vigenciaDesde : null;
    const vigenciaHasta = typeof fila.vigenciaHasta === 'string' ? fila.vigenciaHasta : null;
    const estadoValidacion = (fila.estadoValidacion === 'APROBADO' || fila.estadoValidacion === 'PENDIENTE_VALIDACION')
      ? fila.estadoValidacion
      : (fila.generaExpediente || fila.genera_expediente ? 'APROBADO' : 'PENDIENTE_VALIDACION');
    const monto = typeof fila.monto === 'string'
      ? fila.monto
      : (typeof fila.montoNumero === 'number' && fila.montoNumero > 0 ? `S/ ${fila.montoNumero.toFixed(2)}` : null);
    const requisitos = Array.isArray(fila.requisitos)
      ? fila.requisitos.filter((r): r is string => typeof r === 'string')
      : [];

    if (!esUuidCanonico(registroVersionId)
      || !denominacion
      || !referenciaFila
      || (estadoValidacion !== 'APROBADO' && estadoValidacion !== 'PENDIENTE_VALIDACION')) {
      throw new Error('Fila TUPA incompleta o incompatible.');
    }
    if (codigos.has(referenciaFila)) throw new Error('Fila TUPA duplicada.');
    codigos.add(referenciaFila);
    registros.push({
      registroVersionId,
      denominacion,
      monto,
      requisitos,
      estadoValidacion,
      revision,
      vigenciaDesde,
      vigenciaHasta,
      fuente: { nombre: nombreFuente, referenciaFila, pagina: paginaFuente },
    });
  }
  return registros;
}

/**
 * Obtiene el arreglo directo publicado por el backend TUPA versionado.
 * No acepta envolturas legadas y nunca usa catálogos locales como fallback.
 */
export async function obtenerCatalogoProcedimientosTupa(
  signal?: AbortSignal,
): Promise<ProcedimientoTupa[]> {
  const respuesta = await apiClient.get<unknown>(PROCEDIMIENTOS_TUPA_ENDPOINT, { signal });
  if (!Array.isArray(respuesta.data)) {
    throw new Error('El catálogo TUPA no cumple el contrato de respuesta esperado.');
  }

  return respuesta.data
    .map(adaptarProcedimientoTupa)
    .filter((procedimiento): procedimiento is ProcedimientoTupa => procedimiento !== null);
}

export interface ProcedimientoTupaBusqueda {
  registroVersionId: string;
  codigoRef: string;
  codigo: string;
  denominacion: string;
  categoria: string;
  tipoLegible: string;
  monto: string;
  plazo: string;
  requisitos: readonly string[];
}

export function mapearCategoriaTupaHumana(categoria: string): string {
  switch (categoria) {
    case 'PROCEDIMIENTO_APROBADO':
      return 'Procedimiento administrativo';
    case 'PROCEDIMIENTO_PENDIENTE':
      return 'Procedimiento en revisión';
    case 'SERVICIO_ACADEMICO':
      return 'Servicio académico';
    case 'SERVICIO_COMERCIAL':
      return 'Servicio comercial';
    case 'BIEN_PRODUCTIVO':
      return 'Venta de bien / producto';
    case 'ACTUACION_INTERNA':
      return 'Actuación interna';
    default:
      return 'Trámite / Servicio';
  }
}

// Cache en memoria del catálogo vigente para el Asistente Público (0 requests redundantes)
let catalogoAsistenteCache: ProcedimientoTupaBusqueda[] | null = null;

export function limpiarCacheCatalogoAsistente(): void {
  catalogoAsistenteCache = null;
}

/**
 * Obtiene el catálogo completo vigente para búsqueda controlada en el Asistente Público.
 * Consulta la API REST del backend. Si el backend no está disponible, lanza un error
 * determinista sin recurrir a fallbacks silenciosos locales.
 */
export async function obtenerCatalogoVigenteAsistente(
  signal?: AbortSignal,
  forzarRecarga = false,
): Promise<ProcedimientoTupaBusqueda[]> {
  if (catalogoAsistenteCache && !forzarRecarga) {
    return catalogoAsistenteCache;
  }

  try {
    // 1. Intentar consultar versiones registradas en el backend
    const resVersiones = await apiClient.get<Array<{ id_version: string; estado: string }>>(
      '/api/v1/tramites/tupa/versiones',
      { signal },
    );
    if (Array.isArray(resVersiones.data)) {
      const versionVigente = resVersiones.data.find((v) => v.estado === 'VIGENTE') || resVersiones.data[0];
      if (versionVigente?.id_version) {
        const resProcs = await apiClient.get<Array<Record<string, unknown>>>(
          `/api/v1/tramites/tupa/versiones/${versionVigente.id_version}/procedimientos`,
          { signal },
        );
        if (Array.isArray(resProcs.data) && resProcs.data.length > 0) {
          const mapeados = resProcs.data.map((p) => {
            const cat = String(p.categoria || 'PROCEDIMIENTO_APROBADO');
            const montoVal = p.monto !== undefined && p.monto !== null ? String(p.monto) : 'Gratuito';
            const plazoVal = p.plazo
              ? String(p.plazo)
              : p.plazo_dias
                ? `${p.plazo_dias} días hábiles`
                : 'Según trámite';
            return {
              registroVersionId: String(p.registroVersionId || p.id_procedimiento || p.id || ''),
              codigoRef: String(p.codigoRef || p.codigo_ref || p.codigo || ''),
              codigo: String(p.codigo || p.codigo_ref || p.codigoRef || ''),
              denominacion: String(p.denominacion || ''),
              categoria: cat,
              tipoLegible: mapearCategoriaTupaHumana(cat),
              monto: montoVal.startsWith('S/') ? montoVal : (Number(montoVal) > 0 ? `S/ ${Number(montoVal).toFixed(2)}` : 'Gratuito'),
              plazo: plazoVal,
              requisitos: Array.isArray(p.requisitos) ? p.requisitos.filter((r): r is string => typeof r === 'string') : [],
            };
          });
          catalogoAsistenteCache = mapeados;
          return mapeados;
        }
      }
    }

    // 2. Si no hay versiones registradas, intentar endpoint de procedimientos directos
    const resGeneral = await apiClient.get<unknown>('/api/v1/tramites/tupa', { signal });
    if (Array.isArray(resGeneral.data) && resGeneral.data.length > 0) {
      const mapeados = (resGeneral.data as Array<Record<string, unknown>>).map((p) => {
        const cat = String(p.categoria || 'PROCEDIMIENTO_APROBADO');
        const montoVal = p.monto !== undefined && p.monto !== null ? String(p.monto) : 'Gratuito';
        const plazoVal = p.plazo
          ? String(p.plazo)
          : p.plazo_dias
            ? `${p.plazo_dias} días hábiles`
            : 'Según trámite';
        return {
          registroVersionId: String(p.registroVersionId || p.id_procedimiento || p.id || ''),
          codigoRef: String(p.codigoRef || p.codigo_ref || p.codigo || ''),
          codigo: String(p.codigo || p.codigo_ref || p.codigoRef || ''),
          denominacion: String(p.denominacion || ''),
          categoria: cat,
          tipoLegible: mapearCategoriaTupaHumana(cat),
          monto: montoVal.startsWith('S/') ? montoVal : (Number(montoVal) > 0 ? `S/ ${Number(montoVal).toFixed(2)}` : 'Gratuito'),
          plazo: plazoVal,
          requisitos: Array.isArray(p.requisitos) ? p.requisitos.filter((r): r is string => typeof r === 'string') : [],
        };
      });
      catalogoAsistenteCache = mapeados;
      return mapeados;
    }
  } catch {
    throw new Error('No fue posible consultar el Catálogo TUPA en este momento.');
  }

  throw new Error('No fue posible consultar el Catálogo TUPA en este momento.');
}

/**
 * Filtra procedimientos por término sin distinguir mayúsculas ni acentos.
 */
export function buscarProcedimientosEnCatalogo(
  catalogo: readonly ProcedimientoTupaBusqueda[],
  termino: string,
): ProcedimientoTupaBusqueda[] {
  const normTermino = normalizarTextoParaBusqueda(termino);
  if (!normTermino) return [];

  const palabras = normTermino.split(' ').filter(Boolean);

  return catalogo.filter((proc) => {
    const textoBuscable = normalizarTextoParaBusqueda(
      `${proc.denominacion} ${proc.codigoRef} ${proc.codigo} ${proc.categoria} ${proc.tipoLegible}`,
    );
    return palabras.every((palabra) => textoBuscable.includes(palabra));
  });
}

function normalizarTextoParaBusqueda(txt: string): string {
  if (!txt) return '';
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:;'"()[\]{}/*+\-_\\~`^|<>@#$%&=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

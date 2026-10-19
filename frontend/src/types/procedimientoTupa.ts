/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ARCHIVO: src/types/procedimientoTupa.ts
 * ==============================================================================
 * ESTADO: PROVISIONAL / BLOCKED
 *
 * El contrato definitivo del catálogo TUPA debe ser entregado por el responsable
 * de backend (Christian). Mientras no exista, esta interfaz es una PROPUESTA
 * basada en:
 *   - Endpoint documentado en `backend/README.md` (rama B_CHRISTIAN):
 *       GET /api/v1/tramites/procedimientos-tupa
 *   - Campos visibles exigidos por el brief: código, denominación, requisitos,
 *     monto, fuente, versión, vigencia.
 *   - Identificador técnico exigido: `registroVersionId`.
 *
 * NO inventar datos: los campos opcionales se ocultan cuando el backend no los
 * provee. El adaptador tolera nombres en snake_case y camelCase para reducir el
 * acoplamiento al contrato final.
 * ==============================================================================
 */

/**
 * Procedimiento TUPA normalizado para consumo del frontend.
 * `registroVersionId` es el ÚNICO identificador válido para radicar un trámite.
 */
export interface ProcedimientoTupa {
  /** Identificador técnico real de la versión registrada del procedimiento. */
  readonly registroVersionId: string;
  /** Código oficial del procedimiento (ej. "01", "TUPA-03"). */
  readonly codigo: string;
  /** Denominación oficial del procedimiento. */
  readonly denominacion: string;
  /** Requisitos documentarios (puede venir vacío). */
  readonly requisitos: readonly string[];
  /** Monto / derecho de pago textual (ej. "S/. 11.00 por semestre"). */
  readonly monto?: string;
  /** Fuente normativa oficial (ej. "TUPA 2026"). */
  readonly fuente?: string;
  /** Versión del registro TUPA. */
  readonly version?: string;
  /** Vigencia del procedimiento. */
  readonly vigencia?: string;
  /** Unidad orgánica responsable. */
  readonly dependencia?: string;
  /** Autoridad que resuelve. */
  readonly autoridad?: string;
  /** Tiempo máximo de atención según texto oficial. */
  readonly tiempoMaximo?: string;
  /** Tarifas compuestas detalladas, si el backend las provee. */
  readonly detalleTarifas?: readonly string[];
  /** Nota u observación oficial del procedimiento. */
  readonly nota?: string;
}

/**
 * UUID fijo legado que el flujo usaba como fallback defensivo. Queda PROHIBIDO
 * como identificador técnico tras la integración (brief, sección 5).
 */
export const REGISTRO_VERSION_ID_INVALIDO = '00000000-0000-0000-0000-000000000001';

/**
 * Claves conocidas para el identificador técnico (tolerancia snake/camel).
 */
export const CLAVES_REGISTRO_VERSION_ID = [
  'registroVersionId',
  'registro_version_id',
  'idRegistroVersion',
  'id_registro_version',
  'versionRegistroId',
] as const;

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Extrae el primer valor string (o numérico coercible) no vacío.
 */
function leerCadena(registro: Record<string, unknown>, claves: readonly string[]): string | undefined {
  for (const clave of claves) {
    const valor = registro[clave];
    if (typeof valor === 'string' && valor.trim().length > 0) {
      return valor.trim();
    }
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      return String(valor);
    }
  }
  return undefined;
}

/**
 * Normaliza una lista que puede llegar como string[] o como objetos
 * (ej. `{ descripcion | denominacion | nombre | texto }`).
 */
function leerLista(registro: Record<string, unknown>, claves: readonly string[]): string[] | undefined {
  for (const clave of claves) {
    const valor = registro[clave];
    if (!Array.isArray(valor)) continue;

    const normalizados = valor
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (esObjeto(item)) {
          return leerCadena(item, ['descripcion', 'denominacion', 'nombre', 'texto', 'requisito']) ?? '';
        }
        return '';
      })
      .filter((item) => item.length > 0);

    return normalizados;
  }
  return undefined;
}

/**
 * Valida que un valor sirva como identificador técnico real.
 * No se exige formato UUID porque el contrato está BLOCKED; solo se exige que
 * exista y que no sea el UUID fijo prohibido.
 */
export function esRegistroVersionIdValido(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    valor.trim().length > 0 &&
    valor.trim() !== REGISTRO_VERSION_ID_INVALIDO
  );
}

/**
 * Adapta un registro crudo del backend a `ProcedimientoTupa`.
 * Devuelve `null` si el registro no es válido (sin `registroVersionId` real,
 * sin código o sin denominación), para excluirlo en lugar de inventar datos.
 */
export function adaptarProcedimientoTupa(raw: unknown): ProcedimientoTupa | null {
  if (!esObjeto(raw)) return null;

  const registroVersionId = leerCadena(raw, CLAVES_REGISTRO_VERSION_ID);
  if (!esRegistroVersionIdValido(registroVersionId)) return null;

  const codigo = leerCadena(raw, ['codigo', 'codigoTupa', 'codigo_tupa', 'cod', 'codigoProcedimiento']);
  const denominacion = leerCadena(raw, ['denominacion', 'denominación', 'nombre', 'descripcion', 'descripción']);
  if (!codigo || !denominacion) return null;

  const requisitos = leerLista(raw, ['requisitos', 'requisitosDocumentarios', 'requisitos_documentarios', 'requisito']);
  const detalleTarifas = leerLista(raw, ['detalleTarifas', 'detalle_tarifas', 'tarifas']);

  const monto = leerCadena(raw, ['monto', 'derechoPago', 'derecho_pago', 'costo', 'costoSoles', 'tasa']);
  const fuente = leerCadena(raw, ['fuente', 'fuenteTupa', 'fuente_tupa', 'fuenteNormativa']);
  const version = leerCadena(raw, ['version', 'versión', 'versionTupa', 'version_tupa']);
  const vigencia = leerCadena(raw, ['vigencia', 'vigenciaDesde', 'vigencia_desde', 'vigenciaHasta']);
  const dependencia = leerCadena(raw, ['dependencia', 'unidadOrganica', 'unidad_organica', 'area']);
  const autoridad = leerCadena(raw, ['autoridad', 'autoridadResuelve', 'autoridad_resuelve']);
  const tiempoMaximo = leerCadena(raw, ['tiempoMaximo', 'tiempo_maximo', 'plazo', 'plazoLegal', 'diasPlazoLegal']);
  const nota = leerCadena(raw, ['nota', 'observacion', 'observación', 'comentario']);

  return {
    registroVersionId,
    codigo,
    denominacion,
    requisitos: requisitos ?? [],
    ...(monto ? { monto } : {}),
    ...(fuente ? { fuente } : {}),
    ...(version ? { version } : {}),
    ...(vigencia ? { vigencia } : {}),
    ...(dependencia ? { dependencia } : {}),
    ...(autoridad ? { autoridad } : {}),
    ...(tiempoMaximo ? { tiempoMaximo } : {}),
    ...(detalleTarifas && detalleTarifas.length > 0 ? { detalleTarifas } : {}),
    ...(nota ? { nota } : {}),
  };
}

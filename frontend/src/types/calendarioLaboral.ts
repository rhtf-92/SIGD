/**
 * Contrato del calendario laboral oficial (T-BE-OC-13).
 *
 * Refleja la respuesta de `GET /api/v1/admin/calendario-laboral`, construida en el
 * backend por `construirVistaCalendario` a partir de la tabla
 * `sigd_org.calendario_laboral`. Es la única fuente de feriados del frontend:
 * ninguna lista está escrita a mano en el cliente.
 */

export type TipoFeriado =
  | "NACIONAL"
  | "REGIONAL_UCAYALI"
  | "INSTITUCIONAL"
  | "DUELO_NACIONAL";

export type UnidadTerritorial = "NACIONAL" | "UCAYALI" | "IESTP_SUIZA";

/** Una fila de `sigd_org.calendario_laboral`. */
export interface DiaCalendario {
  id_calendario: string;
  /** `YYYY-MM-DD` */
  fecha: string;
  anio: number;
  /** `null` cuando es un día laborable excepcional (habilitado por resolución). */
  tipo_feriado: TipoFeriado | null;
  descripcion: string;
  unidad_territorial: UnidadTerritorial;
  es_laborable: boolean;
  base_legal: string | null;
  activo: boolean;
}

/** Respuesta de `GET /api/v1/admin/calendario-laboral`. */
export interface VistaCalendario {
  anio: number;
  total_dias: number;
  dias_no_laborables: number;
  feriados_nacionales: DiaCalendario[];
  feriados_regionales_ucayali: DiaCalendario[];
  feriados_institucionales: DiaCalendario[];
  duelos_nacionales: DiaCalendario[];
  dias_laborables_excepcionales: DiaCalendario[];
  calendario: DiaCalendario[];
  /** Años presentes en la consulta; lo añade el controller. */
  anios_disponibles?: number[];
  total?: number;
  correlation_id?: string;
}

/** Filtros admitidos por `GET /api/v1/admin/calendario-laboral`. */
export interface ConsultaCalendario {
  anio?: number;
  desde?: string;
  hasta?: string;
  incluir_inactivos?: boolean;
}

/** Body de `POST /api/v1/admin/calendario-laboral/feriado-excepcional`. */
export interface FeriadoExcepcionalInput {
  fecha: string;
  descripcion: string;
  tipo_feriado?: TipoFeriado;
  unidad_territorial?: UnidadTerritorial;
  es_laborable?: boolean;
  base_legal?: string;
}

/**
 * Respuesta de `POST /api/v1/admin/calendario-laboral/feriado-excepcional`.
 * `cache_invalidation` acredita que el backend ya invalidó su caché y encoló el
 * evento en el outbox dentro de la misma transacción.
 */
export interface FeriadoRegistrado extends DiaCalendario {
  creado_en: string;
  correlation_id: string;
  cache_invalidation: "EMITIDA";
  id_evento_outbox: string;
  id_auditoria: string;
}

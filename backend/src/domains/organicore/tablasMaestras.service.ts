/**
 * Servicio unificado de tablas maestras institucionales (T-BE-OC-15).
 *
 * Sustituye los múltiples endpoints pequeños y fragmentados de catálogos por
 * una única carga consolidada, lo que reduce la presión sobre PostgreSQL y
 * elimina la necesidad de que el frontend dispare N peticiones al montar una
 * pantalla. La respuesta se memoriza en memoria durante 24 horas (TTL =
 * 86400 segundos), declarado en una constante y no escondido en un número mágico.
 *
 * CAPA DE SERVICIO — autocontenido por decisión de alcance: el inventario
 * declarativo de catálogos, las consultas y la caché viven aquí. No depende de
 * `req`/`res` de Express: expone `listarMaestras()` y deja la escritura de
 * cabeceras HTTP y el código de estado al controller.
 *
 * REUTILIZA (sin modificar) `CacheMemoria` de `calendario.service.ts` y el
 * `Pool` de `pg` inyectado por el router, igual que el resto de los dominios.
 *
 * INVENTARIO — sólo se consultan tablas YA EXISTENTES en los DDL del proyecto:
 *   - `sigd_auth.tipos_documento`   → tipos de documento de identidad (DNI, RUC…).
 *   - `sigd_doc.tipo_documento`     → tipos documentales configurables de trámite.
 *   - `sigd_doc.tipo_tramite_tupa`  → tipos de trámite TUPA.
 *   - `sigd_rut.estado_tramite`     → estados de la FSM de trámites.
 *   - `sigd_rut.accion_tramite`     → acciones de la FSM.
 *   - `sigd_rut.tipo_relacion_movimiento` → relaciones entre movimientos.
 *   - `sigd_org.area`               → unidades orgánicas.
 *   - `sigd_org.unidad_organica`    → unidades orgánicas (esquema ltree v6.3).
 *   - `sigd_org.cargo`              → cargos de la estructura orgánica.
 *   - `sigd_org.rol_sistema`        → roles del sistema.
 *   - `sigd_org.permiso_sistema`    → permisos del sistema.
 *   - `sigd_org.calendario_laboral` → feriados del calendario institucional.
 *
 * Cada catálogo se consulta de forma aislada: si el esquema de un dominio aún no
 * está desplegado (el monorepo despliega los DDL por olas independientes), la
 * consulta devuelve el catálogo vacío con `disponible: false` en lugar de tumbar
 * la respuesta consolidada.
 *
 * PENDIENTE DE AUTORIZACIÓN: no existen DDL de vías de comunicación ni de
 * materias en el repositorio, por lo que no se inventan catálogos para ellas. Si
 * el docente las autoriza, basta añadir una entrada a `CATALOGOS` con su SELECT;
 * el resto del servicio no cambia.
 */

import type { Pool } from 'pg';
import { CacheMemoria } from './calendario.service.js';

/** TTL exigido por la especificación: 24 horas = 86400 segundos. */
export const TTL_TABLAS_MAESTRAS_MS = 24 * 60 * 60 * 1000;

/** TTL expresado en segundos, para la respuesta y las cabeceras HTTP. */
export const TTL_TABLAS_MAESTRAS_SEGUNDOS = TTL_TABLAS_MAESTRAS_MS / 1000;

/** Valor de la cabecera `Cache-Control` para respuestas HTTP del recurso. */
export const CACHE_CONTROL_TABLAS_MAESTRAS = `public, max-age=${TTL_TABLAS_MAESTRAS_SEGUNDOS}`;

/** Claves de caché: una por variante de filtrado de inactivos. */
export const CLAVE_CACHE_MAESTRAS_ACTIVOS = 'organicore:tablas-maestras:v1:activos';
export const CLAVE_CACHE_MAESTRAS_TODOS = 'organicore:tablas-maestras:v1:todos';

// ===========================================================================
// 1. TIPOS PÚBLICOS
// ===========================================================================

export interface ItemCatalogo {
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  extra: Record<string, unknown>;
}

export interface CatalogoMaestro {
  clave: string;
  esquema: string;
  tabla: string;
  descripcion: string;
  /** `false` si el esquema/tabla aún no está desplegada en la base de datos. */
  disponible: boolean;
  total: number;
  items: ItemCatalogo[];
}

export interface TablasMaestras {
  generado_en: string;
  solo_activos: boolean;
  ttl_segundos: number;
  total_catalogos: number;
  catalogos_disponibles: number;
  catalogos: CatalogoMaestro[];
}

// ===========================================================================
// 2. INVENTARIO DECLARATIVO DE CATÁLOGOS
// ===========================================================================

interface DefinicionCatalogo {
  clave: string;
  esquema: string;
  tabla: string;
  descripcion: string;
  soloActivos: boolean;
  /** SELECT parametrizado. `$1` recibe el flag `soloActivos` ya resuelto. */
  sql: string;
}

/**
 * Catálogo de feriados reutiliza la proyección de `sigd_org.calendario_laboral`
 * con la misma convención de nombres que el calendario laboral, para que el
 * frontend pueda fusionar ambas cargas sin transformaciones divergentes.
 */
const SQL_FERIADOS = `
    SELECT NULL::text           AS codigo,
           c.descripcion        AS nombre,
           c.base_legal         AS descripcion,
           jsonb_build_object(
               'fecha', to_char(c.fecha, 'YYYY-MM-DD'),
               'anio', c.anio,
               'tipo_feriado', c.tipo_feriado,
               'unidad_territorial', c.unidad_territorial,
               'es_laborable', c.es_laborable,
               'activo', c.activo
           ) AS extra
      FROM sigd_org.calendario_laboral AS c`;

export const CATALOGOS: readonly DefinicionCatalogo[] = [
  {
    clave: 'tipos_documento_identidad',
    esquema: 'sigd_auth',
    tabla: 'tipos_documento',
    descripcion: 'Tipos de documento de identidad de las personas (DNI, RUC, CE, pasaporte).',
    soloActivos: true,
    sql: `
      SELECT t.codigo,
             t.nombre,
             NULL::text AS descripcion,
             '{}'::jsonb AS extra
        FROM sigd_auth.tipos_documento AS t
       WHERE ($1 = FALSE OR t.estado = TRUE)
       ORDER BY t.nombre`,
  },
  {
    clave: 'tipos_documento_tramite',
    esquema: 'sigd_doc',
    tabla: 'tipo_documento',
    descripcion: 'Tipos documentales configurables exigidos por los trámites del TUPA.',
    soloActivos: true,
    sql: `
      SELECT t.codigo_tipo AS codigo,
             t.nombre      AS nombre,
             t.descripcion AS descripcion,
             jsonb_build_object('id_tipo_tramite_tupa', t.id_tipo_tramite_tupa) AS extra
        FROM sigd_doc.tipo_documento AS t
       WHERE ($1 = FALSE OR t.activo = TRUE)
       ORDER BY t.nombre`,
  },
  {
    clave: 'tipos_tramite',
    esquema: 'sigd_doc',
    tabla: 'tipo_tramite_tupa',
    descripcion: 'Tipos de trámite del TUPA con su calificación y plazo legal en días hábiles.',
    soloActivos: true,
    sql: `
      SELECT t.codigo_tupa     AS codigo,
             t.denominacion    AS nombre,
             t.base_legal      AS descripcion,
             jsonb_build_object(
                 'es_tupa', t.es_tupa,
                 'calificacion_administrativa', t.calificacion_administrativa,
                 'plazo_max_dias_habiles', t.plazo_max_dias_habiles,
                 'costo', t.costo,
                 'unidad_organica_responsable', t.unidad_organica_responsable
             ) AS extra
        FROM sigd_doc.tipo_tramite_tupa AS t
       WHERE ($1 = FALSE OR t.activo = TRUE)
       ORDER BY t.denominacion`,
  },
  {
    clave: 'estados_tramite',
    esquema: 'sigd_rut',
    tabla: 'estado_tramite',
    descripcion: 'Estados de la máquina de estados finita de trámites (RutaDoc).',
    soloActivos: true,
    sql: `
      SELECT e.codigo            AS codigo,
             e.nombre            AS nombre,
             e.descripcion       AS descripcion,
             jsonb_build_object('es_terminal', e.es_terminal) AS extra
        FROM sigd_rut.estado_tramite AS e
       WHERE ($1 = FALSE OR e.activo = TRUE)
       ORDER BY e.nombre`,
  },
  {
    clave: 'acciones_tramite',
    esquema: 'sigd_rut',
    tabla: 'accion_tramite',
    descripcion: 'Acciones habilitadas sobre un trámite (RutaDoc).',
    soloActivos: true,
    sql: `
      SELECT a.codigo      AS codigo,
             a.nombre      AS nombre,
             a.descripcion AS descripcion,
             '{}'::jsonb   AS extra
        FROM sigd_rut.accion_tramite AS a
       WHERE ($1 = FALSE OR a.activo = TRUE)
       ORDER BY a.nombre`,
  },
  {
    clave: 'tipos_relacion_movimiento',
    esquema: 'sigd_rut',
    tabla: 'tipo_relacion_movimiento',
    descripcion: 'Relaciones semánticas entre movimientos de trámite.',
    soloActivos: true,
    sql: `
      SELECT r.codigo      AS codigo,
             r.nombre      AS nombre,
             r.descripcion AS descripcion,
             '{}'::jsonb   AS extra
        FROM sigd_rut.tipo_relacion_movimiento AS r
       WHERE ($1 = FALSE OR r.activo = TRUE)
       ORDER BY r.nombre`,
  },
  {
    clave: 'unidades_organicas',
    esquema: 'sigd_org',
    tabla: 'area',
    descripcion: 'Unidades orgánicas del IESTP "Suiza" con su nivel jerárquico.',
    soloActivos: true,
    sql: `
      SELECT a.sigla        AS codigo,
             a.nombre       AS nombre,
             NULL::text     AS descripcion,
             jsonb_build_object(
                 'id_area', a.id_area,
                 'nivel_organizacional', a.nivel_organizacional
             ) AS extra
        FROM sigd_org.area AS a
       WHERE ($1 = FALSE OR a.activo = TRUE)
       ORDER BY a.nivel_organizacional, a.nombre`,
  },
  {
    clave: 'unidades_organicas_ltree',
    esquema: 'sigd_org',
    tabla: 'unidad_organica',
    descripcion: 'Unidades orgánicas del esquema v6.3 con ruta jerárquica ltree.',
    soloActivos: true,
    sql: `
      SELECT u.sigla  AS codigo,
             u.nombre AS nombre,
             NULL::text AS descripcion,
             jsonb_build_object(
                 'id', u.id,
                 'path', u.path::text
             ) AS extra
        FROM sigd_org.unidad_organica AS u
       WHERE ($1 = FALSE OR u.estado = TRUE)
       ORDER BY u.path`,
  },
  {
    clave: 'cargos',
    esquema: 'sigd_org',
    tabla: 'cargo',
    descripcion: 'Cargos de la estructura orgánica institucional.',
    soloActivos: true,
    sql: `
      SELECT NULL::text AS codigo,
             c.nombre    AS nombre,
             c.descripcion AS descripcion,
             '{}'::jsonb AS extra
        FROM sigd_org.cargo AS c
       WHERE ($1 = FALSE OR c.activo = TRUE)
       ORDER BY c.nombre`,
  },
  {
    clave: 'roles_sistema',
    esquema: 'sigd_org',
    tabla: 'rol_sistema',
    descripcion: 'Roles del sistema RBAC de OrganiCore.',
    soloActivos: true,
    sql: `
      SELECT r.codigo      AS codigo,
             r.nombre      AS nombre,
             r.descripcion AS descripcion,
             '{}'::jsonb   AS extra
        FROM sigd_org.rol_sistema AS r
       WHERE ($1 = FALSE OR r.activo = TRUE)
       ORDER BY r.codigo`,
  },
  {
    clave: 'permisos_sistema',
    esquema: 'sigd_org',
    tabla: 'permiso_sistema',
    descripcion: 'Permisos del sistema con su alcance predeterminado (ABAC).',
    soloActivos: true,
    sql: `
      SELECT p.codigo      AS codigo,
             p.codigo      AS nombre,
             p.descripcion AS descripcion,
             jsonb_build_object('alcance_predeterminado', p.alcance_predeterminado) AS extra
        FROM sigd_org.permiso_sistema AS p
       WHERE ($1 = FALSE OR p.activo = TRUE)
       ORDER BY p.codigo`,
  },
  {
    clave: 'feriados',
    esquema: 'sigd_org',
    tabla: 'calendario_laboral',
    descripcion:
      'Feriados nacionales, regionales de Ucayali, institucionales y días de duelo nacional.',
    soloActivos: true,
    sql: `${SQL_FERIADOS} WHERE ($1 = FALSE OR c.activo = TRUE) ORDER BY c.fecha`,
  },
];

// ===========================================================================
// 3. CONSULTA TOLERANTE A ESQUEMAS NO DESPLEGADOS
// ===========================================================================

/** `42P01` relación inexistente, `42501` permiso denegado, `42703` columna inexistente. */
const CODIGO_PG_RELACION_INEXISTENTE = '42P01';
const CODIGO_PG_PERMISO_DENEGADO = '42501';
const CODIGO_PG_COLUMNA_INEXISTENTE = '42703';

function esErrorCatalogoAusente(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const codigo = (error as { code: string }).code;
  return (
    codigo === CODIGO_PG_RELACION_INEXISTENTE ||
    codigo === CODIGO_PG_PERMISO_DENEGADO ||
    codigo === CODIGO_PG_COLUMNA_INEXISTENTE
  );
}

/**
 * Consulta un catálogo. Ante un esquema, tabla o columna no desplegada devuelve
 * el catálogo vacío con `disponible: false`, para no degradar la respuesta
 * consolidada de `#47 /api/v1/admin/tablas-maestras`. Cualquier otro error
 * (conexión perdida, error de sintaxis) se propaga al middleware.
 */
async function consultarCatalogo(
  pool: Pool,
  definicion: DefinicionCatalogo,
  soloActivos: boolean,
): Promise<CatalogoMaestro> {
  const base: CatalogoMaestro = {
    clave: definicion.clave,
    esquema: definicion.esquema,
    tabla: definicion.tabla,
    descripcion: definicion.descripcion,
    disponible: false,
    total: 0,
    items: [],
  };

  try {
    const resultado = await pool.query<ItemCatalogo>(definicion.sql, [
      soloActivos && definicion.soloActivos,
    ]);
    return {
      ...base,
      disponible: true,
      total: resultado.rowCount ?? resultado.rows.length,
      items: resultado.rows,
    };
  } catch (error) {
    if (esErrorCatalogoAusente(error)) {
      console.warn(
        `[TABLAS_MAESTRAS] Catálogo '${definicion.clave}' no disponible: ` +
          `${definicion.esquema}.${definicion.tabla} aún no está desplegado.`,
      );
      return base;
    }
    throw error;
  }
}

/** Consulta en paralelo todos los catálogos del inventario. */
export async function consultarCatalogos(
  pool: Pool,
  soloActivos: boolean,
): Promise<CatalogoMaestro[]> {
  return Promise.all(CATALOGOS.map((definicion) => consultarCatalogo(pool, definicion, soloActivos)));
}

// ===========================================================================
// 4. SERVICIO
// ===========================================================================

export interface TablasMaestrasServiceOpciones {
  cache?: CacheMemoria<TablasMaestras>;
  ttlMs?: number;
  /** Reloj inyectable que devuelve la marca de tiempo ISO (para pruebas). */
  ahora?: () => string;
}

export class TablasMaestrasService {
  private readonly pool: Pool;
  private readonly cache: CacheMemoria<TablasMaestras>;
  private readonly ahora: () => string;

  constructor(pool: Pool, opciones: TablasMaestrasServiceOpciones = {}) {
    this.pool = pool;
    this.cache =
      opciones.cache ?? new CacheMemoria<TablasMaestras>(opciones.ttlMs ?? TTL_TABLAS_MAESTRAS_MS);
    this.ahora = opciones.ahora ?? (() => new Date().toISOString());
  }

  /**
   * Devuelve la carga consolidada de catálogos maestros, memorizada 24 h.
   * Con `forzarRecarga` se salta la lectura de caché (útil tras un alta).
   */
  public async listarMaestras(
    soloActivos = true,
    forzarRecarga = false,
  ): Promise<TablasMaestras> {
    const clave = soloActivos ? CLAVE_CACHE_MAESTRAS_ACTIVOS : CLAVE_CACHE_MAESTRAS_TODOS;

    if (forzarRecarga) {
      this.cache.invalidar(clave);
    }

    return this.cache.obtenerOCargar(clave, async () => {
      const catalogos = await consultarCatalogos(this.pool, soloActivos);
      return {
        generado_en: this.ahora(),
        solo_activos: soloActivos,
        ttl_segundos: TTL_TABLAS_MAESTRAS_SEGUNDOS,
        total_catalogos: CATALOGOS.length,
        catalogos_disponibles: catalogos.filter((catalogo) => catalogo.disponible).length,
        catalogos,
      };
    });
  }

  /** Invalida la carga consolidada completa. */
  public invalidarCache(): void {
    this.cache.invalidar();
  }
}

export function crearTablasMaestrasService(
  pool: Pool,
  opciones: TablasMaestrasServiceOpciones = {},
): TablasMaestrasService {
  return new TablasMaestrasService(pool, opciones);
}
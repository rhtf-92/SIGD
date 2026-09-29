/**
 * Repositorio de las tablas maestras institucionales (T-BE-OC-15).
 *
 * Consolida los diccionarios que YA existen en el proyecto; no se crea ninguna
 * tabla nueva. El inventario se deriva de los DDL canónicos:
 *   - `sigd_auth.tipos_documento`   → tipos de documento de identidad (DNI, RUC…).
 *   - `sigd_doc.tipo_documento`     → tipos documentales del trámite.
 *   - `sigd_doc.tipo_tramite_tupa`  → tipos de trámite TUPA.
 *   - `sigd_rut.estado_tramite`     → estados de la FSM de trámites.
 *   - `sigd_rut.accion_tramite`     → acciones de la FSM.
 *   - `sigd_rut.tipo_relacion_movimiento` → relaciones entre movimientos.
 *   - `sigd_org.area`               → unidades orgánicas.
 *   - `sigd_org.cargo`              → cargos.
 *   - `sigd_org.permiso_sistema`    → permisos del sistema.
 *
 * Cada catálogo se consulta de forma aislada: si el esquema de un dominio aún no
 * está desplegado, la consulta devuelve el catálogo vacío y marca
 * `disponible: false` en lugar de tumbar la respuesta consolidada. Es
 * necesario porque el monorepo despliega los seis DDL por olas independientes.
 */

import type { Pool } from 'pg';

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
  disponible: boolean;
  total: number;
  items: ItemCatalogo[];
}

interface DefinicionCatalogo {
  clave: string;
  esquema: string;
  tabla: string;
  descripcion: string;
  soloActivos: boolean;
  sql: string;
}

const SQL_FERIADOS = `
    SELECT NULL::text AS codigo,
           c.descripcion AS nombre,
           c.base_legal AS descripcion,
           jsonb_build_object(
               'fecha', to_char(c.fecha, 'YYYY-MM-DD'),
               'tipo_feriado', c.tipo_feriado,
               'unidad_territorial', c.unidad_territorial,
               'es_laborable', c.es_laborable
           ) AS extra
      FROM sigd_org.calendario_laboral AS c`;

/**
 * Inventario declarativo. Cada entrada es un SELECT parametrizado ($1 = filtrar
 * inactivos) sobre una tabla ya existente; ninguna crea ni altera esquema.
 */
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
    descripcion: 'Tipos documentales configurables de los trámites del TUPA.',
    soloActivos: true,
    sql: `
      SELECT t.codigo_tipo      AS codigo,
             t.nombre           AS nombre,
             t.descripcion      AS descripcion,
             jsonb_build_object(
                 'id_tipo_tramite_tupa', t.id_tipo_tramite_tupa
             ) AS extra
        FROM sigd_doc.tipo_documento AS t
       WHERE ($1 = FALSE OR t.activo = TRUE)
       ORDER BY t.nombre`,
  },
  {
    clave: 'tipos_tramite',
    esquema: 'sigd_doc',
    tabla: 'tipo_tramite_tupa',
    descripcion: 'Tipos de trámite del TUPA con su calificación y plazo legal.',
    soloActivos: true,
    sql: `
      SELECT t.codigo_tupa               AS codigo,
             t.denominacion              AS nombre,
             t.base_legal                AS descripcion,
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
      SELECT a.sigla                    AS codigo,
             a.nombre                   AS nombre,
             NULL::text                 AS descripcion,
             jsonb_build_object(
                 'id_area', a.id_area,
                 'nivel_organizacional', a.nivel_organizacional
             ) AS extra
        FROM sigd_org.area AS a
       WHERE ($1 = FALSE OR a.activo = TRUE)
       ORDER BY a.nivel_organizacional, a.nombre`,
  },
  {
    clave: 'cargos',
    esquema: 'sigd_org',
    tabla: 'cargo',
    descripcion: 'Cargos de la estructura orgánica institucional.',
    soloActivos: true,
    sql: `
      SELECT NULL::text   AS codigo,
             c.nombre      AS nombre,
             c.descripcion AS descripcion,
             '{}'::jsonb   AS extra
        FROM sigd_org.cargo AS c
       WHERE ($1 = FALSE OR c.activo = TRUE)
       ORDER BY c.nombre`,
  },
  {
    clave: 'permisos_sistema',
    esquema: 'sigd_org',
    tabla: 'permiso_sistema',
    descripcion: 'Permisos del sistema con su alcance predeterminado.',
    soloActivos: true,
    sql: `
      SELECT p.codigo                     AS codigo,
             p.codigo                     AS nombre,
             p.descripcion                AS descripcion,
             jsonb_build_object(
                 'alcance_predeterminado', p.alcance_predeterminado
             ) AS extra
        FROM sigd_org.permiso_sistema AS p
       WHERE ($1 = FALSE OR p.activo = TRUE)
       ORDER BY p.codigo`,
  },
  {
    clave: 'feriados_ucayali',
    esquema: 'sigd_org',
    tabla: 'calendario_laboral',
    descripcion: 'Feriados nacionales, regionales de Ucayali, institucionales y duelos.',
    soloActivos: true,
    sql: `${SQL_FERIADOS} WHERE ($1 = FALSE OR c.activo = TRUE) ORDER BY c.fecha`,
  },
];

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
 * consolidada de `/admin/tablas-maestras`. Cualquier otro error se propaga.
 */
export async function consultarCatalogo(
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
    const resultado = await pool.query<{
      codigo: string | null;
      nombre: string;
      descripcion: string | null;
      extra: Record<string, unknown>;
    }>(definicion.sql, [soloActivos && definicion.soloActivos]);

    return { ...base, disponible: true, total: resultado.rowCount ?? 0, items: resultado.rows };
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
  return Promise.all(
    CATALOGOS.map((definicion) => consultarCatalogo(pool, definicion, soloActivos)),
  );
}

import type { Pool } from 'pg';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import type { CachePermisos } from '../../redis.js';

export const CODIGOS_ROLES_CANONICOS = [
  'SUPER_ADMIN',
  'DIRECTOR',
  'DOCENTE',
  'MESA_PARTES',
  'ESTUDIANTE',
] as const;

export type CodigoRolCanonico = (typeof CODIGOS_ROLES_CANONICOS)[number];

/**
 * Evento transaccional de la matriz RBAC.
 *
 * Se escribe dentro de la MISMA transacción que modifica `rol_permiso`, de modo
 * que el `OutboxWorker` de `src/audit/outbox-worker.ts` garantiza la entrega con
 * reintentos y dead-letter aunque Redis este caido en ese instante. Reutiliza el
 * outbox canonico `sigd_audit.evento_outbox`; no es un mecanismo paralelo.
 */
export const AGREGADO_RBAC = 'rbac_matriz';
export const TIPO_EVENTO_RBAC_MODIFICADA = 'rbac_matriz_modificada';

export interface Rol {
  rol_id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  /** Columna canonica de `03_sigd_org.sql` (NO `activo`). */
  vigente: boolean;
}

export interface Permiso {
  permiso_id: string;
  codigo: string;
  /** Columna canonica de `03_sigd_org.sql` (NO `descripcion`). */
  nombre: string;
  /** Columna canonica: solo admite 'AREA' o 'GLOBAL' (NO `alcance_predetermido`). */
  ambito: 'AREA' | 'GLOBAL';
  /**
   * Areas que acotan el permiso cuando el alcance se narrow a subareas
   * (`sigd_org.permiso_restriccion_area`). Vacio = alcance AREA completo.
   */
  subareas: string[];
}

export interface MatrizRolPermiso {
  rol_id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  vigente: boolean;
  total_permisos: number;
  permisos: Permiso[];
}

export interface RolPermiso {
  rol_id: string;
  codigo: string;
}

export interface ActualizarPermisosDeRolParams {
  rol_id: string;
  codigos_permisos: string[];
}

export interface ResultadoActualizacionPermisos {
  rol_id: string;
  codigo: string;
  permisos_agregados: string[];
  permisos_revocados: string[];
  cache_invalidation: CacheInvalidationResult;
}

export interface CacheInvalidationResult {
  /** La instancia local invalido su propia clave en este instante. */
  emitido_local: boolean;
  /** El evento llego a las demas instancias por Pub/Sub. */
  propagado: boolean;
  /**
   * La invalidacion quedo en el outbox transaccional: se reintentara con backoff
   * hasta entregar. El cambio de la matriz ya esta confirmado en PostgreSQL.
   */
  pendiente_outbox: boolean;
}

export interface OpcionesEvaluacionPermiso {
  /** Area desde la que se ejecuta la accion; necesaria para permisos con subareas. */
  area_id?: string;
}

export type ClienteSql = Pick<Pool, 'query' | 'connect'>;

export interface RbacServiceOptions {
  /** Propaga la invalidación a las demás instancias por Pub/Sub. */
  propagarInvalidacion?: (rol_id: string) => Promise<void>;
}

/**
 * Proyeccion del catalogo de permisos sobre los nombres canonicos. El
 * `COALESCE` de `subareas` convierte la agregacion vacia en cadena vacia, que
 * `normalizarPermiso` traduce a `[]`.
 */
const COLS_PERMISO = `
  p.permiso_id,
  p.codigo,
  p.nombre,
  p.ambito,
  COALESCE((
    SELECT string_agg(a.codigo, ',' ORDER BY a.codigo)
      FROM sigd_org.permiso_restriccion_area pra
      JOIN sigd_org.area a ON a.area_id = pra.area_id
     WHERE pra.permiso_id = p.permiso_id
  ), '') AS subareas`;

export class RbacService {
  private readonly publicarInvalidacion: ((rol_id: string) => Promise<void>) | undefined;

  constructor(
    private readonly db: ClienteSql,
    private readonly cache: CachePermisos,
    options: RbacServiceOptions = {},
  ) {
    this.publicarInvalidacion = options.propagarInvalidacion;
  }

  async obtenerRoles(soloVigentes = true): Promise<Rol[]> {
    const filtro = soloVigentes ? 'WHERE vigente = true' : '';
    const resultado = await this.db.query<Rol>(
      `SELECT rol_id, codigo, nombre, descripcion, vigente
         FROM sigd_org.rol_sistema
         ${filtro}
        ORDER BY codigo`,
    );
    return resultado.rows;
  }

  /**
   * `permiso_sistema` no tiene columna de vigencia en el esquema canonico: el
   * filtro de baja logica solo aplica a `rol_sistema`. Por eso no se expone aqui
   * un parametro `soloActivos` que no podria honrarse.
   */
  async obtenerPermisos(): Promise<Permiso[]> {
    const resultado = await this.db.query<Permiso>(
      `SELECT ${COLS_PERMISO}
         FROM sigd_org.permiso_sistema p
        ORDER BY p.codigo`,
    );
    return resultado.rows.map(normalizarPermiso);
  }

  async obtenerMatrizRolesPermisos(): Promise<MatrizRolPermiso[]> {
    const roles = await this.obtenerRoles(false);
    const permisosPorRol = await this.db.query<Permiso & { rol_id: string }>(
      `SELECT r.rol_id, ${COLS_PERMISO}
         FROM sigd_org.rol_permiso rp
         JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
         JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
        ORDER BY r.codigo, p.codigo`,
    );

    const agrupados = new Map<string, Permiso[]>();
    for (const fila of permisosPorRol.rows) {
      const { rol_id, ...resto } = fila;
      const lista = agrupados.get(rol_id);
      if (lista) {
        lista.push(normalizarPermiso(resto as Permiso));
      } else {
        agrupados.set(rol_id, [normalizarPermiso(resto as Permiso)]);
      }
    }

    return roles.map((rol) => {
      const permisos = agrupados.get(rol.rol_id) ?? [];
      return { ...rol, total_permisos: permisos.length, permisos };
    });
  }

  async obtenerPermisosDeRol(rol_id: string, opciones?: { usarCache?: boolean }): Promise<string[]> {
    const usarCache = opciones?.usarCache ?? true;

    if (usarCache) {
      const enCache = await this.cache.obtener(rol_id);
      if (enCache !== null) {
        return enCache;
      }
    }

    const resultado = await this.db.query<{ codigo: string }>(
      `SELECT p.codigo
         FROM sigd_org.rol_permiso rp
         JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
        WHERE rp.rol_id = $1
        ORDER BY p.codigo`,
      [rol_id],
    );
    const permisos = resultado.rows.map((fila) => fila.codigo);

    if (usarCache) {
      await this.cache.guardar(rol_id, permisos);
    }

    return permisos;
  }

  /**
   * Roles vigentes de una cuenta.
   *
   * Columnas canonicas de `03_sigd_org.sql`: `usuario_rol.id_usuario` (NO
   * `cuenta_id`) y la vigencia por rango `vigente_desde`/`vigente_hasta` (NO un
   * `tstzrange` llamado `vigencia`).
   */
  async rolesDeUsuario(id_usuario: string): Promise<RolPermiso[]> {
    const resultado = await this.db.query<RolPermiso>(
      `SELECT r.rol_id, r.codigo
         FROM sigd_org.usuario_rol ur
         JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        WHERE ur.id_usuario = $1
          AND r.vigente = true
          AND ur.vigente_desde <= now()
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        ORDER BY r.codigo`,
      [id_usuario],
    );
    return resultado.rows;
  }

  async usuarioTienePermiso(
    id_usuario: string,
    permiso: string,
    opciones?: OpcionesEvaluacionPermiso,
  ): Promise<boolean> {
    const roles = await this.rolesDeUsuario(id_usuario);
    if (roles.length === 0) {
      return false;
    }

    for (const rol of roles) {
      if (await this.rolTienePermiso(rol.rol_id, permiso, opciones)) {
        return true;
      }
    }

    return false;
  }

  async rolTienePermiso(
    rol_id: string,
    permiso: string,
    opciones?: OpcionesEvaluacionPermiso,
  ): Promise<boolean> {
    const permisos = await this.obtenerPermisosDeRol(rol_id);
    if (!permisos.includes(permiso)) {
      return false;
    }

    // El recorte por subareas solo se consulta cuando la peticion trae area: sin
    // area no hay nada que contrastar y el permiso conserva su alcance AREA.
    const area_id = opciones?.area_id;
    if (area_id === undefined || area_id === '') {
      return true;
    }

    const subareas = await this.areasRestringidasDePermiso(permiso);
    if (subareas.length === 0) {
      return true;
    }

    return subareas.includes(area_id);
  }

  /**
   * Areas que acotan un permiso con alcance por subareas. Lista vacia = el
   * permiso no esta restringido y mantiene su `ambito` canonico.
   */
  async areasRestringidasDePermiso(permiso: string): Promise<string[]> {
    const resultado = await this.db.query<{ codigo: string }>(
      `SELECT a.codigo
         FROM sigd_org.permiso_restriccion_area pra
         JOIN sigd_org.area a ON a.area_id = pra.area_id
         JOIN sigd_org.permiso_sistema p ON p.permiso_id = pra.permiso_id
        WHERE p.codigo = $1
        ORDER BY a.codigo`,
      [permiso],
    );
    return resultado.rows.map((fila) => fila.codigo);
  }

  async actualizarPermisosDeRol(
    params: ActualizarPermisosDeRolParams,
  ): Promise<ResultadoActualizacionPermisos> {
    const { rol_id, codigos_permisos } = params;
    const unicos = normalizarCodigos(codigos_permisos);

    const cliente = await this.db.connect();
    try {
      await cliente.query('BEGIN');

      const rolResult = await cliente.query<Rol>(
        `SELECT rol_id, codigo, nombre, descripcion, vigente
           FROM sigd_org.rol_sistema
          WHERE rol_id = $1
          FOR UPDATE`,
        [rol_id],
      );
      const rol = rolResult.rows[0];
      if (!rol) {
        throw new NotFoundError({ detail: 'El rol indicado no existe.' });
      }
      if (!rol.vigente) {
        throw new ConflictError({
          code: 'ROL_INVIGENTE',
          detail: 'No se pueden modificar los permisos de un rol no vigente.',
        });
      }

      const previos = await cliente.query<{ codigo: string }>(
        `SELECT p.codigo
           FROM sigd_org.rol_permiso rp
           JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
          WHERE rp.rol_id = $1
          ORDER BY p.codigo`,
        [rol_id],
      );
      const codigosPrevios = previos.rows.map((fila) => fila.codigo);

      const validos = await this.validarPermisosExistentes(cliente, unicos);

      await cliente.query(`DELETE FROM sigd_org.rol_permiso WHERE rol_id = $1`, [rol_id]);

      if (validos.length > 0) {
        await cliente.query(
          `INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
           SELECT $1, p.permiso_id
             FROM sigd_org.permiso_sistema p
            WHERE p.codigo = ANY($2::text[])`,
          [rol_id, validos],
        );
      }

      const agregados = validos.filter((codigo) => !codigosPrevios.includes(codigo));
      const revocados = codigosPrevios.filter((codigo) => !validos.includes(codigo));

      if (agregados.length > 0 || revocados.length > 0) {
        await registrarMutacion(cliente, {
          esquema: 'sigd_org',
          tabla: 'rol_permiso',
          operacion: 'UPDATE',
          datos_antes: { rol_id, codigo: rol.codigo, permisos: codigosPrevios },
          datos_despues: { rol_id, codigo: rol.codigo, permisos: validos },
        });

        // OC-11: la invalidacion viaja en el outbox transaccional. Se confirma
        // con la matriz, asi que un Redis caido no puede dejar permisos
        // revocados sirviéndose desde caché: el worker reintentará la entrega.
        await insertarEvento(cliente, {
          agregado: AGREGADO_RBAC,
          tipo_evento: TIPO_EVENTO_RBAC_MODIFICADA,
          payload: { rol_id, codigo: rol.codigo, permisos: validos },
        });
      }

      await cliente.query('COMMIT');

      const cache_invalidation = await this.invalidarCacheDeRol(rol_id);

      return {
        rol_id,
        codigo: rol.codigo,
        permisos_agregados: agregados,
        permisos_revocados: revocados,
        cache_invalidation,
      };
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  private async validarPermisosExistentes(
    cliente: Pick<Pool, 'query'>,
    codigos: string[],
  ): Promise<string[]> {
    if (codigos.length === 0) {
      return [];
    }

    const resultado = await cliente.query<{ codigo: string }>(
      `SELECT codigo FROM sigd_org.permiso_sistema WHERE codigo = ANY($1::text[])`,
      [codigos],
    );
    const existentes = [...new Set(resultado.rows.map((fila) => fila.codigo))];
    const faltantes = codigos.filter((codigo) => !existentes.includes(codigo));

    if (faltantes.length > 0) {
      throw new ValidationError({
        message: 'Uno o más permisos no existen en el catálogo de sigd_org.permiso_sistema.',
        invalidParams: faltantes.map((name) => ({
          name: `codigos_permisos.${name}`,
          reason: 'El permiso no está registrado en el catálogo.',
        })),
      });
    }

    return existentes.sort();
  }

  /**
   * Camino rapido de invalidacion, posterior al COMMIT.
   *
   * Es una optimizacion, no la garantia: si Redis falla aqui la peticion NO debe
   * revertirse ni responder error, porque la matriz ya quedo confirmada. El
   * evento del outbox sigue PENDIENTE y el worker lo reintentara con backoff
   * exponencial. Nunca se reescribe la clave con `guardar()` justo despues de
   * borrar, porque eso reintroduce en caché la lista recien revocada.
   */
  private async invalidarCacheDeRol(rol_id: string): Promise<CacheInvalidationResult> {
    try {
      await this.cache.invalidar(rol_id);
    } catch (error) {
      console.error('[RBAC] No se pudo invalidar la caché local tras el commit:', error);
      return { emitido_local: false, propagado: false, pendiente_outbox: true };
    }

    if (!this.publicarInvalidacion) {
      return { emitido_local: true, propagado: false, pendiente_outbox: true };
    }

    try {
      await this.publicarInvalidacion(rol_id);
      return { emitido_local: true, propagado: true, pendiente_outbox: true };
    } catch (error) {
      console.error('[RBAC] No se pudo propagar la invalidación por Pub/Sub:', error);
      return { emitido_local: true, propagado: false, pendiente_outbox: true };
    }
  }
}

function normalizarPermiso(fila: Permiso): Permiso {
  const subareas = Array.isArray(fila.subareas)
    ? fila.subareas.filter((codigo) => typeof codigo === 'string' && codigo !== '')
    : fila.subareas
      ? String(fila.subareas)
          .split(',')
          .filter((codigo) => codigo !== '')
      : [];
  return { ...fila, subareas };
}

function normalizarCodigos(codigos: string[]): string[] {
  return [...new Set(codigos.map((codigo) => codigo.trim()).filter((codigo) => codigo !== ''))].sort();
}

export function usuarioIdDelContexto(): string | null {
  return getRequestContext()?.usuario_id ?? null;
}
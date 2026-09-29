import type { Pool } from 'pg';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
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

export interface Rol {
  rol_id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface Permiso {
  permiso_id: string;
  codigo: string;
  descripcion: string | null;
  alcance_predeterminado: 'AREA' | 'SUBAREAS' | 'GLOBAL';
  activo: boolean;
}

export interface MatrizRolPermiso {
  rol_id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
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
  emitido_local: boolean;
  propagado: boolean;
}

export type ClienteSql = Pick<Pool, 'query' | 'connect'>;

export interface RbacServiceOptions {
  /** Propaga la invalidación a las demás instancias por Pub/Sub. */
  propagarInvalidacion?: (rol_id: string) => Promise<void>;
}

const COLS_PERMISO = 'p.permiso_id, p.codigo, p.descripcion, p.alcance_predeterminado, p.activo';

export class RbacService {
  private readonly publicarInvalidacion: ((rol_id: string) => Promise<void>) | undefined;

  constructor(
    private readonly db: ClienteSql,
    private readonly cache: CachePermisos,
    options: RbacServiceOptions = {},
  ) {
    this.publicarInvalidacion = options.propagarInvalidacion;
  }

  async obtenerRoles(soloActivos = true): Promise<Rol[]> {
    const filtro = soloActivos ? 'WHERE activo = true' : '';
    const resultado = await this.db.query<Rol>(
      `SELECT rol_id, codigo, nombre, descripcion, activo
         FROM sigd_org.rol_sistema
         ${filtro}
        ORDER BY codigo`,
    );
    return resultado.rows;
  }

  async obtenerPermisos(soloActivos = true): Promise<Permiso[]> {
    const filtro = soloActivos ? 'WHERE activo = true' : '';
    const resultado = await this.db.query<Permiso>(
      `SELECT ${COLS_PERMISO}
         FROM sigd_org.permiso_sistema p
         ${filtro}
        ORDER BY p.codigo`,
    );
    return resultado.rows;
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
      const { rol_id, ...permiso } = fila;
      const lista = agrupados.get(rol_id);
      if (lista) {
        lista.push(permiso);
      } else {
        agrupados.set(rol_id, [permiso]);
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
          AND p.activo = true
        ORDER BY p.codigo`,
      [rol_id],
    );
    const permisos = resultado.rows.map((fila) => fila.codigo);

    if (usarCache) {
      await this.cache.guardar(rol_id, permisos);
    }

    return permisos;
  }

  async rolesDeUsuario(cuenta_id: string): Promise<RolPermiso[]> {
    const resultado = await this.db.query<RolPermiso>(
      `SELECT r.rol_id, r.codigo
         FROM sigd_org.usuario_rol ur
         JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        WHERE ur.cuenta_id = $1
          AND r.activo = true
          AND ur.vigencia @> now()
        ORDER BY r.codigo`,
      [cuenta_id],
    );
    return resultado.rows;
  }

  async usuarioTienePermiso(cuenta_id: string, permiso: string): Promise<boolean> {
    const roles = await this.rolesDeUsuario(cuenta_id);
    if (roles.length === 0) {
      return false;
    }

    for (const rol of roles) {
      if (await this.rolTienePermiso(rol.rol_id, permiso)) {
        return true;
      }
    }

    return false;
  }

  async rolTienePermiso(rol_id: string, permiso: string): Promise<boolean> {
    const permisos = await this.obtenerPermisosDeRol(rol_id);
    return permisos.includes(permiso);
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
        `SELECT rol_id, codigo, nombre, descripcion, activo
           FROM sigd_org.rol_sistema
          WHERE rol_id = $1
          FOR UPDATE`,
        [rol_id],
      );
      const rol = rolResult.rows[0];
      if (!rol) {
        throw new NotFoundError({ detail: 'El rol indicado no existe.' });
      }
      if (!rol.activo) {
        throw new ConflictError({
          code: 'ROL_INACTIVO',
          detail: 'No se pueden modificar los permisos de un rol inactivo.',
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
      }

      await cliente.query('COMMIT');

      const cache_invalidation = await this.invalidarCacheDeRol(rol_id);
      await this.cache.guardar(rol_id, validos);

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

  private async invalidarCacheDeRol(rol_id: string): Promise<CacheInvalidationResult> {
    await this.cache.invalidar(rol_id);
    if (!this.publicarInvalidacion) {
      return { emitido_local: true, propagado: false };
    }
    await this.publicarInvalidacion(rol_id);
    return { emitido_local: true, propagado: true };
  }
}

function normalizarCodigos(codigos: string[]): string[] {
  return [...new Set(codigos.map((codigo) => codigo.trim()).filter((codigo) => codigo !== ''))].sort();
}

export function usuarioIdDelContexto(): string | null {
  return getRequestContext()?.usuario_id ?? null;
}

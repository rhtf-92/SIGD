import type { Pool } from 'pg';

export const rolCanonico = (codigo: string): string =>
  ({
    ADMINISTRADOR: 'SUPER_ADMIN',
    SECRETARIO: 'DOCENTE',
    ESPECIALISTA: 'DOCENTE',
    CIUDADANO: 'ESTUDIANTE',
  })[codigo] ?? codigo;

export interface PerfilRolActivo {
  rol: string;
  permisos: string[];
}

/**
 * Obtiene los perfiles vigentes directamente desde PostgreSQL. Los roles
 * internos que representan el mismo perfil canónico se agrupan y sus permisos
 * se unen sin confiar en datos enviados por el cliente.
 */
export async function obtenerPerfilesActivos(
  pool: Pool,
  idUsuario: string,
): Promise<PerfilRolActivo[]> {
  const { rows } = await pool.query<{ rol_codigo: string; permiso_codigo: string | null }>(
    `SELECT r.codigo AS rol_codigo, ps.codigo AS permiso_codigo
       FROM sigd_org.usuario_rol ur
       JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
       LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
       LEFT JOIN sigd_org.permiso_sistema ps ON ps.permiso_id = rp.permiso_id
      WHERE ur.id_usuario = $1
        AND ur.vigente_desde <= now()
        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
      ORDER BY r.codigo, ps.codigo`,
    [idUsuario],
  );

  const perfiles = new Map<string, Set<string>>();
  for (const fila of rows) {
    const rol = rolCanonico(fila.rol_codigo);
    const permisos = perfiles.get(rol) ?? new Set<string>();
    if (fila.permiso_codigo) permisos.add(fila.permiso_codigo);
    perfiles.set(rol, permisos);
  }

  return [...perfiles.entries()]
    .map(([rol, permisos]) => ({ rol, permisos: [...permisos].sort() }))
    .sort((a, b) => a.rol.localeCompare(b.rol));
}

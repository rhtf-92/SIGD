/**
 * Resolución de permisos contra el modelo RBAC ya definido en el proyecto.
 *
 * No se crea ninguna tabla ni ninguna arquitectura de autenticación paralela: se
 * consulta el modelo que YA existe en el DDL canónico
 * (`docs/02_organicore/03_esquema_sigd_org_v2.sql`):
 *
 *   sigd_org.permiso_sistema  (codigo UNIQUE, activo)
 *   sigd_org.rol_sistema      (codigo UNIQUE, activo)
 *   sigd_org.rol_permiso      (rol_id, permiso_id)
 *   sigd_org.usuario_rol      (cuenta_id, rol_id, vigencia TSTZRANGE)
 *
 * La consulta recorre la cadena completa `usuario_rol -> rol_permiso ->
 * permiso_sistema` y exige que tanto el permiso como el rol estén activos y que
 * la asignación del rol esté vigente (`vigencia @> now()`), de modo que una
 * revocación surte efecto en la siguiente petición sin necesidad de reiniciar
 * cachés.
 *
 * Criterio de fallo: DENEGAR. Si el esquema RBAC aún no está desplegado se
 * devuelve `false` en lugar de conceder el acceso; una caída de la base de datos
 * o un `SELECT` que no encuentre la fila producen el mismo resultado observable
 * para el cliente (403), sin abrir la puerta por error.
 */

import type { Pool } from 'pg';

/**
 * Sentencia única de resolución. Se expone para poder inspeccionarla en las
 * pruebas y para que la lógica de autorización sea auditable en un solo sitio.
 */
export const SQL_PERMISO_CONCEDIDO = `
    SELECT 1
      FROM sigd_org.usuario_rol     AS ur
      JOIN sigd_org.rol_sistema     AS r  ON r.rol_id  = ur.rol_id
      JOIN sigd_org.rol_permiso     AS rp ON rp.rol_id = r.rol_id
      JOIN sigd_org.permiso_sistema AS p  ON p.permiso_id = rp.permiso_id
     WHERE ur.cuenta_id = $1::uuid
       AND p.codigo = $2
       AND p.activo = TRUE
       AND r.activo = TRUE
       AND ur.vigencia @> now()
     LIMIT 1`;

const CODIGO_PG_RELACION_INEXISTENTE = '42P01';
const CODIGO_PG_COLUMNA_INEXISTENTE = '42703';
const CODIGO_PG_PERMISO_DENEGADO = '42501';

function esEsquemaRbacAusente(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const codigo = (error as { code: string }).code;
  return (
    codigo === CODIGO_PG_RELACION_INEXISTENTE ||
    codigo === CODIGO_PG_COLUMNA_INEXISTENTE ||
    codigo === CODIGO_PG_PERMISO_DENEGADO
  );
}

/**
 * ¿La cuenta indicada tiene concedido el permiso en este instante?
 *
 * @param cuentaId Identificador de `sigd_org.usuario_rol.cuenta_id` (UUID).
 * @param codigo   Código de `sigd_org.permiso_sistema.codigo`.
 */
export async function tienePermiso(
  pool: Pool,
  cuentaId: string,
  codigo: string,
): Promise<boolean> {
  try {
    const resultado = await pool.query(SQL_PERMISO_CONCEDIDO, [cuentaId, codigo]);
    return (resultado.rowCount ?? 0) > 0;
  } catch (error) {
    if (esEsquemaRbacAusente(error)) {
      // Fallo cerrado: sin RBAC desplegado no se concede nada.
      console.error(
        `[AUTORIZACION] Permiso '${codigo}' denegado: el esquema RBAC de sigd_org ` +
          'aún no está desplegado. Se deniega el acceso.',
      );
      return false;
    }
    throw error;
  }
}

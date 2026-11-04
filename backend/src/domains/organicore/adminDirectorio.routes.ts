import { randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { resolverIdentidad } from '../../core/auth/auth.guard.js';
import { Argon2Service } from '../identicore/argon2.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USUARIO_RE = /^[A-Za-z0-9._-]{3,50}$/;
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DNI_RE = /^\d{8}$/;
const CELULAR_RE = /^\d{9}$/;

type Fila = Record<string, unknown>;

interface CuerpoUsuario {
  usuario?: unknown;
  correo?: unknown;
  password?: unknown;
  nombres?: unknown;
  apellidos?: unknown;
  dni?: unknown;
  celular?: unknown;
  rolId?: unknown;
  activo?: unknown;
}

interface CuerpoRol {
  nombre?: unknown;
  descripcion?: unknown;
  vigente?: unknown;
  permisoIds?: unknown;
}

type Manejador = (req: Request, res: Response) => Promise<void>;

function enviarError(res: Response, status: number, codigo: string, mensaje: string): void {
  res.status(status).json({ code: codigo, title: mensaje, detail: mensaje, error: { codigo, mensaje } });
}

function texto(valor: unknown): string | undefined {
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number') return String(valor);
  return undefined;
}

function parametro(req: Request, nombre: string): string {
  return String(req.params[nombre] ?? '');
}

function manejar(fn: Manejador) {
  return (req: Request, res: Response): void => {
    fn(req, res).catch((error: unknown) => {
      const codigoPg = (error as { code?: string } | null)?.code;
      if (codigoPg === '23505') {
        enviarError(res, 409, 'DUPLICADO', 'Ya existe un registro con ese DNI, usuario o correo.');
        return;
      }
      console.error('[administracion]', error instanceof Error ? error.message : error);
      if (!res.headersSent) {
        enviarError(res, 500, 'ERROR_INTERNO', 'No se pudo completar la operación.');
      }
    });
  };
}

async function revertir(cliente: PoolClient): Promise<void> {
  await cliente.query('ROLLBACK').catch(() => undefined);
}

function exigirAdministrador(req: Request, res: Response, next: NextFunction): void {
  try {
    const identidad = resolverIdentidad(req);
    if (identidad.via !== 'bearer') {
      enviarError(res, 401, 'NO_AUTENTICADO', 'Debe iniciar sesión.');
      return;
    }
    if (!identidad.roles.includes('ADMINISTRADOR')) {
      enviarError(res, 403, 'SIN_PERMISO', 'Se requiere el rol ADMINISTRADOR.');
      return;
    }
    res.locals['idAdmin'] = identidad.idUsuario;
  } catch {
    enviarError(res, 401, 'NO_AUTENTICADO', 'Debe iniciar sesión.');
    return;
  }
  next();
}

const SQL_USUARIO_BASE = `
  SELECT cu.id_usuario AS "idUsuario", cu.usuario, cu.correo, cu.activo,
         cu.ultimo_acceso AS "ultimoAcceso", cu.creado_en AS "creadoEn",
         p.id_documento AS documento, pn.nombres, pn.apellidos,
         pn.nombre_completo AS "nombreCompleto", pn.telefono AS celular,
         rs.rol_id AS "rolId", rs.codigo AS "rolCodigo", rs.nombre AS "rolNombre"
    FROM sigd_auth.cuenta_usuario cu
    LEFT JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = cu.id_persona
    LEFT JOIN LATERAL (
      SELECT ur.rol_id
        FROM sigd_org.usuario_rol ur
       WHERE ur.id_usuario = cu.id_usuario
         AND ur.vigente_desde <= now()
         AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
       ORDER BY ur.vigente_desde DESC
       LIMIT 1
    ) act ON TRUE
    LEFT JOIN sigd_org.rol_sistema rs ON rs.rol_id = act.rol_id`;

async function obtenerUsuario(pool: Pool, idUsuario: string): Promise<Fila | undefined> {
  const r = await pool.query<Fila>(`${SQL_USUARIO_BASE} WHERE cu.id_usuario = $1`, [idUsuario]);
  return r.rows[0];
}

export function crearAdminDirectorioRouter(pool: Pool): Router {
  const router = Router();
  router.use(exigirAdministrador);

  // ---------------------------------------------------------------- USUARIOS
  router.get('/usuarios', manejar(async (req, res) => {
    const pagina = Math.max(1, Number.parseInt(String(req.query['pagina'] ?? '1'), 10) || 1);
    const limite = Math.min(100, Math.max(1, Number.parseInt(String(req.query['limite'] ?? '20'), 10) || 20));
    const condiciones: string[] = [];
    const valores: unknown[] = [];

    const busqueda = texto(req.query['busqueda']);
    if (busqueda) {
      valores.push(`%${busqueda}%`);
      const i = valores.length;
      condiciones.push(
        `(cu.usuario ILIKE $${i} OR cu.correo ILIKE $${i} OR pn.nombre_completo ILIKE $${i} OR p.id_documento ILIKE $${i})`,
      );
    }
    const estado = texto(req.query['estado']);
    if (estado === 'activo' || estado === 'inactivo') {
      valores.push(estado === 'activo');
      condiciones.push(`cu.activo = $${valores.length}`);
    }
    const rolId = texto(req.query['rolId']);
    if (rolId) {
      if (!UUID_RE.test(rolId)) {
        enviarError(res, 400, 'DATOS_INVALIDOS', 'rolId inválido.');
        return;
      }
      valores.push(rolId);
      condiciones.push(`act.rol_id = $${valores.length}`);
    }
    const donde = condiciones.length > 0 ? ` WHERE ${condiciones.join(' AND ')}` : '';

    const conteo = await pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM (${SQL_USUARIO_BASE}${donde}) t`,
      valores,
    );
    const total = conteo.rows[0]?.total ?? 0;

    const valoresLista = [...valores, limite, (pagina - 1) * limite];
    const lista = await pool.query<Fila>(
      `${SQL_USUARIO_BASE}${donde} ORDER BY cu.creado_en DESC, cu.usuario LIMIT $${valoresLista.length - 1} OFFSET $${valoresLista.length}`,
      valoresLista,
    );
    res.json({ items: lista.rows, total, pagina, limite });
  }));

  router.post('/usuarios', manejar(async (req, res) => {
    const b = (req.body ?? {}) as CuerpoUsuario;
    const usuario = texto(b.usuario) ?? '';
    const correo = (texto(b.correo) ?? '').toLowerCase();
    const password = typeof b.password === 'string' ? b.password : '';
    const nombres = texto(b.nombres) ?? '';
    const apellidos = texto(b.apellidos) ?? '';
    const dni = texto(b.dni) ?? '';
    const celular = texto(b.celular) || null;
    const rolId = texto(b.rolId) || null;

    const problemas: string[] = [];
    if (!USUARIO_RE.test(usuario)) problemas.push('usuario: 3 a 50 caracteres (letras, números, . _ -)');
    if (!CORREO_RE.test(correo) || correo.length > 120) problemas.push('correo inválido');
    if (password.length < 8 || password.length > 128) problemas.push('password: entre 8 y 128 caracteres');
    if (nombres.length < 1 || nombres.length > 120) problemas.push('nombres: obligatorio');
    if (apellidos.length < 1 || apellidos.length > 120) problemas.push('apellidos: obligatorio');
    if (!DNI_RE.test(dni)) problemas.push('dni: 8 dígitos');
    if (celular !== null && !CELULAR_RE.test(celular)) problemas.push('celular: 9 dígitos');
    if (rolId !== null && !UUID_RE.test(rolId)) problemas.push('rolId inválido');
    if (problemas.length > 0) {
      enviarError(res, 400, 'DATOS_INVALIDOS', problemas.join('; '));
      return;
    }

    const cliente = await pool.connect();
    let idUsuario = '';
    try {
      await cliente.query('BEGIN');
      if (rolId !== null) {
        const rol = await cliente.query(
          'SELECT 1 FROM sigd_org.rol_sistema WHERE rol_id = $1 AND vigente = TRUE',
          [rolId],
        );
        if (rol.rowCount === 0) {
          await revertir(cliente);
          enviarError(res, 400, 'ROL_NO_VALIDO', 'El rol no existe o no está vigente.');
          return;
        }
      }
      const idPersona = randomUUID();
      await cliente.query(
        `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento, creado_en)
         VALUES ($1, 'NATURAL', $2, now())`,
        [idPersona, dni],
      );
      await cliente.query(
        `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [idPersona, nombres, apellidos, `${nombres} ${apellidos}`, correo, celular],
      );
      const hash = await Argon2Service.hash(password);
      const cuenta = await cliente.query<{ id_usuario: string }>(
        `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash, activo)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id_usuario`,
        [idPersona, usuario, correo, hash],
      );
      const fila = cuenta.rows[0];
      if (!fila) throw new Error('No se obtuvo el id de la cuenta creada.');
      idUsuario = fila.id_usuario;
      if (rolId !== null) {
        await cliente.query(
          'INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id) VALUES ($1, $2)',
          [idUsuario, rolId],
        );
      }
      await cliente.query('COMMIT');
    } catch (error) {
      await revertir(cliente);
      throw error;
    } finally {
      cliente.release();
    }
    res.status(201).json(await obtenerUsuario(pool, idUsuario));
  }));

  router.put('/usuarios/:id', manejar(async (req, res) => {
    const id = parametro(req, 'id');
    if (!UUID_RE.test(id)) {
      enviarError(res, 400, 'DATOS_INVALIDOS', 'id inválido.');
      return;
    }
    const b = (req.body ?? {}) as CuerpoUsuario;
    const correo = b.correo === undefined ? undefined : (texto(b.correo) ?? '').toLowerCase();
    const nombres = b.nombres === undefined ? undefined : (texto(b.nombres) ?? '');
    const apellidos = b.apellidos === undefined ? undefined : (texto(b.apellidos) ?? '');
    const celular = b.celular === undefined ? undefined : (texto(b.celular) || null);
    const rolId = b.rolId === undefined ? undefined : (texto(b.rolId) ?? '');
    const activo = typeof b.activo === 'boolean' ? b.activo : undefined;

    const problemas: string[] = [];
    if (correo !== undefined && (!CORREO_RE.test(correo) || correo.length > 120)) problemas.push('correo inválido');
    if (nombres !== undefined && (nombres.length < 1 || nombres.length > 120)) problemas.push('nombres inválido');
    if (apellidos !== undefined && (apellidos.length < 1 || apellidos.length > 120)) problemas.push('apellidos inválido');
    if (celular !== undefined && celular !== null && !CELULAR_RE.test(celular)) problemas.push('celular: 9 dígitos');
    if (rolId !== undefined && !UUID_RE.test(rolId)) problemas.push('rolId inválido');
    if (b.activo !== undefined && activo === undefined) problemas.push('activo debe ser true o false');
    if (problemas.length > 0) {
      enviarError(res, 400, 'DATOS_INVALIDOS', problemas.join('; '));
      return;
    }
    if (
      correo === undefined && nombres === undefined && apellidos === undefined &&
      celular === undefined && rolId === undefined && activo === undefined
    ) {
      enviarError(res, 400, 'SIN_CAMBIOS', 'No se envió ningún campo para modificar.');
      return;
    }

    const actual = await obtenerUsuario(pool, id);
    if (!actual) {
      enviarError(res, 404, 'NO_ENCONTRADO', 'El usuario no existe.');
      return;
    }
    const idAdmin = String(res.locals['idAdmin'] ?? '');
    if (id === idAdmin) {
      if (activo === false) {
        enviarError(res, 400, 'OPERACION_NO_PERMITIDA', 'No puede desactivar su propia cuenta.');
        return;
      }
      if (rolId !== undefined && rolId !== String(actual['rolId'] ?? '')) {
        enviarError(res, 400, 'OPERACION_NO_PERMITIDA', 'No puede cambiar su propio rol.');
        return;
      }
    }

    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');

      // cuenta_usuario: correo y estado
      const setsCuenta: string[] = [];
      const valsCuenta: unknown[] = [];
      if (correo !== undefined) {
        valsCuenta.push(correo);
        setsCuenta.push(`correo = $${valsCuenta.length}`);
      }
      if (activo !== undefined) {
        valsCuenta.push(activo);
        setsCuenta.push(`activo = $${valsCuenta.length}`);
      }
      if (setsCuenta.length > 0) {
        valsCuenta.push(id);
        await cliente.query(
          `UPDATE sigd_auth.cuenta_usuario SET ${setsCuenta.join(', ')} WHERE id_usuario = $${valsCuenta.length}`,
          valsCuenta,
        );
      }

      // persona_natural: nombres, apellidos, correo, celular
      const setsPersona: string[] = [];
      const valsPersona: unknown[] = [];
      if (nombres !== undefined || apellidos !== undefined) {
        const n = nombres ?? String(actual['nombres'] ?? '');
        const a = apellidos ?? String(actual['apellidos'] ?? '');
        valsPersona.push(n, a, `${n} ${a}`.trim());
        setsPersona.push(
          `nombres = $${valsPersona.length - 2}`,
          `apellidos = $${valsPersona.length - 1}`,
          `nombre_completo = $${valsPersona.length}`,
        );
      }
      if (correo !== undefined) {
        valsPersona.push(correo);
        setsPersona.push(`correo = $${valsPersona.length}`);
      }
      if (celular !== undefined) {
        valsPersona.push(celular);
        setsPersona.push(`telefono = $${valsPersona.length}`);
      }
      if (setsPersona.length > 0) {
        valsPersona.push(id);
        await cliente.query(
          `UPDATE sigd_auth.persona_natural SET ${setsPersona.join(', ')}
            WHERE id_persona = (SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $${valsPersona.length})`,
          valsPersona,
        );
      }

      // rol: cierra el vigente y abre el nuevo
      if (rolId !== undefined && rolId !== String(actual['rolId'] ?? '')) {
        const rol = await cliente.query(
          'SELECT 1 FROM sigd_org.rol_sistema WHERE rol_id = $1 AND vigente = TRUE',
          [rolId],
        );
        if (rol.rowCount === 0) {
          await revertir(cliente);
          enviarError(res, 400, 'ROL_NO_VALIDO', 'El rol no existe o no está vigente.');
          return;
        }
        await cliente.query(
          `UPDATE sigd_org.usuario_rol
              SET vigente_hasta = now()
            WHERE id_usuario = $1 AND (vigente_hasta IS NULL OR vigente_hasta > now())`,
          [id],
        );
        await cliente.query(
          'INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id) VALUES ($1, $2)',
          [id, rolId],
        );
      }
      await cliente.query('COMMIT');
    } catch (error) {
      await revertir(cliente);
      throw error;
    } finally {
      cliente.release();
    }
    res.json(await obtenerUsuario(pool, id));
  }));

    router.get('/auditoria', manejar(async (req, res) => {
    const pagina = Math.max(1, Number.parseInt(String(req.query['pagina'] ?? '1'), 10) || 1);
    const limite = Math.min(100, Math.max(1, Number.parseInt(String(req.query['limite'] ?? '20'), 10) || 20));
    const total = await pool.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM sigd_audit.bitacora_auditoria',
    );
    const r = await pool.query(
      `SELECT b.id_auditoria AS "idAuditoria", b.fecha_hora AS "fechaHora",
              b.usuario_id AS "usuarioId", cu.usuario AS "usuario",
              b.esquema, b.tabla, b.operacion,
              b.datos_antes AS "datosAntes", b.datos_despues AS "datosDespues"
         FROM sigd_audit.bitacora_auditoria b
         LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = b.usuario_id
        ORDER BY b.fecha_hora DESC
        LIMIT $1 OFFSET $2`,
      [limite, (pagina - 1) * limite],
    );
    res.json({ items: r.rows, total: Number(total.rows[0]?.n ?? 0), pagina, limite });
  }));

  // ------------------------------------------------------------------- ROLES
  router.get('/roles', manejar(async (_req, res) => {
    const r = await pool.query<Fila>(
      `SELECT rs.rol_id AS "rolId", rs.codigo, rs.nombre, rs.descripcion, rs.vigente,
              (SELECT count(*)::int FROM sigd_org.rol_permiso rp WHERE rp.rol_id = rs.rol_id) AS "totalPermisos"
         FROM sigd_org.rol_sistema rs
        ORDER BY rs.codigo`,
    );
    res.json({ items: r.rows });
  }));

  router.post('/roles', manejar(async (_req, res) => {
    enviarError(
      res, 501, 'NO_IMPLEMENTADO',
      'Crear roles nuevos requiere ampliar la restricción chk_rol_codigo con una migración aprobada.',
    );
  }));

  router.put('/roles/:rolId', manejar(async (req, res) => {
    const rolId = parametro(req, 'rolId');
    if (!UUID_RE.test(rolId)) {
      enviarError(res, 400, 'DATOS_INVALIDOS', 'rolId inválido.');
      return;
    }
    const b = (req.body ?? {}) as CuerpoRol;
    const nombre = b.nombre === undefined ? undefined : (texto(b.nombre) ?? '');
    const descripcion = b.descripcion === undefined ? undefined : (texto(b.descripcion) || null);
    const vigente = typeof b.vigente === 'boolean' ? b.vigente : undefined;

    const problemas: string[] = [];
    if (nombre !== undefined && (nombre.length < 1 || nombre.length > 120)) problemas.push('nombre: 1 a 120 caracteres');
    if (descripcion !== undefined && descripcion !== null && descripcion.length > 500) problemas.push('descripcion: máximo 500');
    if (b.vigente !== undefined && vigente === undefined) problemas.push('vigente debe ser true o false');
    if (problemas.length > 0) {
      enviarError(res, 400, 'DATOS_INVALIDOS', problemas.join('; '));
      return;
    }
    if (nombre === undefined && descripcion === undefined && vigente === undefined) {
      enviarError(res, 400, 'SIN_CAMBIOS', 'No se envió ningún campo para modificar.');
      return;
    }

    const existente = await pool.query<{ codigo: string }>(
      'SELECT codigo FROM sigd_org.rol_sistema WHERE rol_id = $1',
      [rolId],
    );
    const rol = existente.rows[0];
    if (!rol) {
      enviarError(res, 404, 'NO_ENCONTRADO', 'El rol no existe.');
      return;
    }
    if (rol.codigo === 'ADMINISTRADOR' && vigente === false) {
      enviarError(res, 400, 'OPERACION_NO_PERMITIDA', 'No se puede desactivar el rol ADMINISTRADOR.');
      return;
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    if (nombre !== undefined) {
      vals.push(nombre);
      sets.push(`nombre = $${vals.length}`);
    }
    if (descripcion !== undefined) {
      vals.push(descripcion);
      sets.push(`descripcion = $${vals.length}`);
    }
    if (vigente !== undefined) {
      vals.push(vigente);
      sets.push(`vigente = $${vals.length}`);
    }
    vals.push(rolId);
    const r = await pool.query<Fila>(
      `UPDATE sigd_org.rol_sistema SET ${sets.join(', ')} WHERE rol_id = $${vals.length}
       RETURNING rol_id AS "rolId", codigo, nombre, descripcion, vigente`,
      vals,
    );
    res.json(r.rows[0]);
  }));

  // ---------------------------------------------------------------- PERMISOS
  router.get('/permisos', manejar(async (_req, res) => {
    const r = await pool.query<Fila>(
      `SELECT permiso_id AS "permisoId", codigo, nombre, ambito
         FROM sigd_org.permiso_sistema
        ORDER BY codigo`,
    );
    res.json({ items: r.rows });
  }));

  router.get('/roles/:rolId/permisos', manejar(async (req, res) => {
    const rolId = parametro(req, 'rolId');
    if (!UUID_RE.test(rolId)) {
      enviarError(res, 400, 'DATOS_INVALIDOS', 'rolId inválido.');
      return;
    }
    const rol = await pool.query('SELECT 1 FROM sigd_org.rol_sistema WHERE rol_id = $1', [rolId]);
    if (rol.rowCount === 0) {
      enviarError(res, 404, 'NO_ENCONTRADO', 'El rol no existe.');
      return;
    }
    const r = await pool.query<{ permisoId: string }>(
      'SELECT permiso_id AS "permisoId" FROM sigd_org.rol_permiso WHERE rol_id = $1',
      [rolId],
    );
    res.json({ rolId, permisoIds: r.rows.map((f) => f.permisoId) });
  }));

  router.put('/roles/:rolId/permisos', manejar(async (req, res) => {
    const rolId = parametro(req, 'rolId');
    if (!UUID_RE.test(rolId)) {
      enviarError(res, 400, 'DATOS_INVALIDOS', 'rolId inválido.');
      return;
    }
    const b = (req.body ?? {}) as CuerpoRol;
    if (!Array.isArray(b.permisoIds) || !b.permisoIds.every((x) => typeof x === 'string' && UUID_RE.test(x))) {
      enviarError(res, 400, 'DATOS_INVALIDOS', 'permisoIds debe ser una lista de UUID.');
      return;
    }
    const permisoIds = [...new Set(b.permisoIds as string[])];

    const rol = await pool.query('SELECT 1 FROM sigd_org.rol_sistema WHERE rol_id = $1', [rolId]);
    if (rol.rowCount === 0) {
      enviarError(res, 404, 'NO_ENCONTRADO', 'El rol no existe.');
      return;
    }
    if (permisoIds.length > 0) {
      const validos = await pool.query(
        'SELECT 1 FROM sigd_org.permiso_sistema WHERE permiso_id = ANY($1::uuid[])',
        [permisoIds],
      );
      if (validos.rowCount !== permisoIds.length) {
        enviarError(res, 400, 'PERMISO_NO_VALIDO', 'Alguno de los permisos no existe.');
        return;
      }
    }

    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query('DELETE FROM sigd_org.rol_permiso WHERE rol_id = $1', [rolId]);
      if (permisoIds.length > 0) {
        await cliente.query(
          'INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id) SELECT $1, unnest($2::uuid[])',
          [rolId, permisoIds],
        );
      }
      await cliente.query('COMMIT');
    } catch (error) {
      await revertir(cliente);
      throw error;
    } finally {
      cliente.release();
    }
    res.json({ rolId, permisoIds });
  }));

  return router;
}
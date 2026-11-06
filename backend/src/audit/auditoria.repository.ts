import type { PoolClient } from 'pg';
import { getRequestContext } from '../shared/request-context/request-context.js';

/* -------------------------------------------------------------------------- */
/* Tipos de entrada                                                           */
/* -------------------------------------------------------------------------- */

export interface RegistrarAccesoParams {
  /** Acción de acceso: LOGIN, LOGOUT, LECTURA, INTENTO_LOGIN_FALLIDO, ACCESO_DENEGADO, etc. */
  accion: string;
  /** Módulo del sistema (Expedientes, Documentos, Autenticación, Administración, Seguridad, etc.) */
  modulo: string;
  /** Identificador del recurso afectado (p. ej. número de expediente, ID de usuario) */
  registro: string;
  /** Resultado del acceso: Exitoso | Denegado | Error */
  resultado: 'Exitoso' | 'Denegado' | 'Error';
  /** Detalles técnicos opcionales (código HTTP, mensaje de error, etc.) */
  detalles_tecnicos?: Record<string, unknown> | null;
  /** IP de origen (si no se pasa, se toma del contexto) */
  ip_origen?: string | null;
  /** User agent (si no se pasa, se toma del contexto) */
  user_agent?: string | null;
}

export interface RegistrarAccionParams {
  /** Acción de negocio: Creó, Derivó, Archivó, Observó, Firmó, etc. */
  accion: string;
  /** Módulo del sistema */
  modulo: string;
  /** Identificador del registro de negocio afectado */
  registro: string;
  /** Resultado: Exitoso | Denegado | Error */
  resultado: 'Exitoso' | 'Denegado' | 'Error';
  /** Estado anterior del registro (para diff) */
  datos_antes?: Record<string, unknown> | null;
  /** Estado posterior del registro (para diff) */
  datos_despues?: Record<string, unknown> | null;
  /** IP de origen */
  ip_origen?: string | null;
  /** User agent */
  user_agent?: string | null;
}

export interface FiltrosAuditoria {
  busqueda?: string;
  modulo?: string;
  accion?: string;
  resultado?: 'Exitoso' | 'Denegado' | 'Error';
  usuario_id?: string;
  correlation_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  pagina?: number;
  por_pagina?: number;
  ordenar_por?: 'fecha_hora' | 'usuario_id' | 'operacion';
  orden_direccion?: 'ASC' | 'DESC';
}

export interface RegistroAuditoriaRow {
  id_auditoria: string;
  correlation_id: string;
  usuario_id: string | null;
  ip_origen: string | null;
  user_agent: string | null;
  esquema: string;
  tabla: string;
  operacion: string;
  datos_antes: Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
  fecha_hora: Date;
  hash_registro: string | null;
  hash_anterior: string | null;
}

export interface ResumenAuditoria {
  total: number;
  exitosos: number;
  denegados: number;
  errores: number;
  por_modulo: Array<{ modulo: string; total: number }>;
  por_accion: Array<{ accion: string; total: number }>;
  por_usuario: Array<{ usuario_id: string; total: number }>;
}

export interface ValidacionWorm {
  total_registros: number;
  registros_invalidos: number;
  registros_validos: number;
  cadena_integral: boolean;
}

/* -------------------------------------------------------------------------- */
/* Repositorio                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Registra un evento de acceso en la bitácora forense (operación INSERT en
 * sigd_audit.bitacora_auditoria). Se ejecuta dentro de la transacción del
 * caller cuando se pasa `cliente`, o abre su propia transacción si no.
 */
export async function registrarAcceso(
  cliente: PoolClient,
  params: RegistrarAccesoParams,
): Promise<string> {
  const contexto = getRequestContext();

  const ip = params.ip_origen ?? contexto?.ip_origen ?? null;
  const ua = params.user_agent ?? contexto?.user_agent ?? null;

  const datosDespues: Record<string, unknown> = {
    accion: params.accion,
    modulo: params.modulo,
    registro: params.registro,
    resultado: params.resultado,
    tipo: 'ACCESO',
  };
  if (params.detalles_tecnicos) {
    datosDespues['detalles_tecnicos'] = params.detalles_tecnicos;
  }

  const resultado = await cliente.query<{ id_auditoria: string }>(
    `INSERT INTO sigd_audit.bitacora_auditoria
       (correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_antes, datos_despues)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id_auditoria`,
    [
      contexto?.correlation_id ?? null,
      null, // usuario_id se resuelve desde el contexto si el caller lo desea
      ip,
      ua,
      'sigd_audit',
      'acceso',
      'INSERT',
      null,
      JSON.stringify(datosDespues),
    ],
  );

  return resultado.rows[0].id_auditoria;
}

/**
 * Registra una acción de negocio en la bitácora forense (INSERT con
 * datos_antes / datos_despues para diff forense).
 */
export async function registrarAccion(
  cliente: PoolClient,
  params: RegistrarAccionParams,
): Promise<string> {
  const contexto = getRequestContext();

  const ip = params.ip_origen ?? contexto?.ip_origen ?? null;
  const ua = params.user_agent ?? contexto?.user_agent ?? null;

  const datosDespues: Record<string, unknown> = {
    accion: params.accion,
    modulo: params.modulo,
    registro: params.registro,
    resultado: params.resultado,
    tipo: 'ACCION',
  };
  if (params.datos_despues) {
    datosDespues['estado_nuevo'] = params.datos_despues;
  }
  if (params.datos_antes) {
    datosDespues['estado_anterior'] = params.datos_antes;
  }

  const resultado = await cliente.query<{ id_auditoria: string }>(
    `INSERT INTO sigd_audit.bitacora_auditoria
       (correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_antes, datos_despues)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id_auditoria`,
    [
      contexto?.correlation_id ?? null,
      null,
      ip,
      ua,
      'sigd_audit',
      'accion',
      'INSERT',
      params.datos_antes ? JSON.stringify(params.datos_antes) : null,
      JSON.stringify(datosDespues),
    ],
  );

  return resultado.rows[0].id_auditoria;
}

/**
 * Consulta los registros de auditoría con filtros y paginación.
 * Devuelve las filas y el total de registros (sin paginar) para el cliente.
 */
export async function listarAuditoria(
  cliente: PoolClient,
  filtros: FiltrosAuditoria,
): Promise<{ filas: RegistroAuditoriaRow[]; total: number }> {
  const {
    busqueda,
    modulo,
    accion,
    resultado,
    usuario_id,
    correlation_id,
    fecha_desde,
    fecha_hasta,
    pagina = 1,
    por_pagina = 50,
    ordenar_por = 'fecha_hora',
    orden_direccion = 'DESC',
  } = filtros;

  const paginaSegura = Number.isFinite(pagina) && pagina >= 1 ? Math.floor(pagina) : 1;
  const porPaginaSegura = Number.isFinite(por_pagina) && por_pagina >= 1
    ? Math.min(Math.floor(por_pagina), 200)
    : 50;

  const condiciones: string[] = [];
  const valores: unknown[] = [];
  let parametro = 1;

  // Búsqueda de texto libre sobre usuario (via correlation es difícil sin join,
  // buscamos en correlation_id, esquema, tabla, operacion y datos_despues).
  if (busqueda && busqueda.trim()) {
    valores.push(`%${busqueda.trim()}%`);
    condiciones.push(
      `(correlation_id::text ILIKE $${parametro} OR esquema ILIKE $${parametro} OR tabla ILIKE $${parametro} OR operacion ILIKE $${parametro} OR datos_despues::text ILIKE $${parametro})`,
    );
    parametro += 1;
  }

  if (modulo) {
    valores.push(modulo);
    condiciones.push(`tabla = $${parametro}`);
    parametro += 1;
  }

  if (accion) {
    valores.push(accion);
    condiciones.push(`datos_despues->>'accion' = $${parametro}`);
    parametro += 1;
  }

  if (resultado) {
    valores.push(resultado);
    condiciones.push(`datos_despues->>'resultado' = $${parametro}`);
    parametro += 1;
  }

  if (usuario_id) {
    valores.push(usuario_id);
    condiciones.push(`usuario_id = $${parametro}::uuid`);
    parametro += 1;
  }

  if (correlation_id) {
    valores.push(correlation_id);
    condiciones.push(`correlation_id = $${parametro}::uuid`);
    parametro += 1;
  }

  if (fecha_desde) {
    valores.push(fecha_desde);
    condiciones.push(`fecha_hora >= $${parametro}::timestamptz`);
    parametro += 1;
  }

  if (fecha_hasta) {
    valores.push(fecha_hasta);
    condiciones.push(`fecha_hora <= $${parametro}::timestamptz`);
    parametro += 1;
  }

  const where =
    condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const offset = (paginaSegura - 1) * porPaginaSegura;

  const ordenValido = ordenar_por === 'usuario_id' ? 'usuario_id' : ordenar_por === 'fecha_hora' ? 'fecha_hora' : 'operacion';
  const direccionValida = orden_direccion === 'ASC' ? 'ASC' : 'DESC';

  const queryFilas = `
    SELECT id_auditoria, correlation_id, usuario_id, ip_origen, user_agent,
           esquema, tabla, operacion, datos_antes, datos_despues,
           fecha_hora, hash_registro, hash_anterior
    FROM sigd_audit.bitacora_auditoria
    ${where}
    ORDER BY ${ordenValido} ${direccionValida}, id_auditoria
    LIMIT $${parametro} OFFSET $${parametro + 1}
  `;
  valores.push(porPaginaSegura, offset);

  const queryTotal = `
    SELECT COUNT(*) AS total
    FROM sigd_audit.bitacora_auditoria
    ${where}
  `;

  const [filasRes, totalRes] = await Promise.all([
    cliente.query<RegistroAuditoriaRow>(queryFilas, valores),
    cliente.query<{ total: string }>(queryTotal, valores.slice(0, valores.length - 2)),
  ]);

  return {
    filas: filasRes.rows,
    total: Number(totalRes.rows[0].total),
  };
}

/**
 * Obtiene un registro de auditoría por su ID.
 */
export async function obtenerAuditoriaPorId(
  cliente: PoolClient,
  idAuditoria: string,
): Promise<RegistroAuditoriaRow | null> {
  const resultado = await cliente.query<RegistroAuditoriaRow>(
    `SELECT id_auditoria, correlation_id, usuario_id, ip_origen, user_agent,
            esquema, tabla, operacion, datos_antes, datos_despues,
            fecha_hora, hash_registro, hash_anterior
     FROM sigd_audit.bitacora_auditoria
     WHERE id_auditoria = $1::uuid`,
    [idAuditoria],
  );
  return resultado.rows[0] ?? null;
}

/**
 * Obtiene el resumen estadístico de auditoría.
 */
export async function obtenerResumenAuditoria(
  cliente: PoolClient,
  filtros: Pick<FiltrosAuditoria, 'fecha_desde' | 'fecha_hasta' | 'usuario_id'> = {},
): Promise<ResumenAuditoria> {
  const { fecha_desde, fecha_hasta, usuario_id } = filtros;

  const condiciones: string[] = [];
  const valores: unknown[] = [];
  let parametro = 1;

  if (fecha_desde) {
    valores.push(fecha_desde);
    condiciones.push(`fecha_hora >= $${parametro}::timestamptz`);
    parametro += 1;
  }
  if (fecha_hasta) {
    valores.push(fecha_hasta);
    condiciones.push(`fecha_hora <= $${parametro}::timestamptz`);
    parametro += 1;
  }
  if (usuario_id) {
    valores.push(usuario_id);
    condiciones.push(`usuario_id = $${parametro}::uuid`);
    parametro += 1;
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  // Total, exitosos, denegados, errores a partir del campo resultado en datos_despues
  const queryResumen = `
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE datos_despues->>'resultado' = 'Exitoso') AS exitosos,
      COUNT(*) FILTER (WHERE datos_despues->>'resultado' = 'Denegado') AS denegados,
      COUNT(*) FILTER (WHERE datos_despues->>'resultado' = 'Error') AS errores
    FROM sigd_audit.bitacora_auditoria
    ${where}
  `;

  const queryPorModulo = `
    SELECT datos_despues->>'modulo' AS modulo, COUNT(*) AS total
    FROM sigd_audit.bitacora_auditoria
    ${where}
    GROUP BY modulo
    ORDER BY total DESC
  `;

  const queryPorAccion = `
    SELECT datos_despues->>'accion' AS accion, COUNT(*) AS total
    FROM sigd_audit.bitacora_auditoria
    ${where}
    GROUP BY accion
    ORDER BY total DESC
  `;

  const queryPorUsuario = `
    SELECT usuario_id, COUNT(*) AS total
    FROM sigd_audit.bitacora_auditoria
    ${where}
    GROUP BY usuario_id
    ORDER BY total DESC
  `;

  const [resumenRes, porModuloRes, porAccionRes, porUsuarioRes] = await Promise.all([
    cliente.query<{ total: string; exitosos: string; denegados: string; errores: string }>(
      queryResumen, valores,
    ),
    cliente.query<{ modulo: string | null; total: string }>(queryPorModulo, valores),
    cliente.query<{ accion: string | null; total: string }>(queryPorAccion, valores),
    cliente.query<{ usuario_id: string; total: string }>(queryPorUsuario, valores),
  ]);

  const r = resumenRes.rows[0];
  return {
    total: Number(r.total),
    exitosos: Number(r.exitosos),
    denegados: Number(r.denegados),
    errores: Number(r.errores),
    por_modulo: porModuloRes.rows.map((row) => ({
      modulo: row.modulo ?? 'Sistema',
      total: Number(row.total),
    })),
    por_accion: porAccionRes.rows.map((row) => ({
      accion: row.accion ?? '—',
      total: Number(row.total),
    })),
    por_usuario: porUsuarioRes.rows.map((row) => ({
      usuario_id: row.usuario_id,
      total: Number(row.total),
    })),
  };
}

/**
 * Valida la integridad de la cadena WORM de toda la bitácora.
 */
export async function validarCadenaWorm(
  cliente: PoolClient,
): Promise<ValidacionWorm> {
  const resultado = await cliente.query<{
    total_registros: string;
    registros_invalidos: string;
    registros_validos: string;
    cadena_integral: boolean;
  }>(
    `SELECT * FROM sigd_audit.vw_validacion_worm`,
  );
  const r = resultado.rows[0];
  return {
    total_registros: Number(r.total_registros),
    registros_invalidos: Number(r.registros_invalidos),
    registros_validos: Number(r.registros_validos),
    cadena_integral: r.cadena_integral,
  };
}

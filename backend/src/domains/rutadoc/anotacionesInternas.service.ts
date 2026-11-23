import type { Pool, PoolClient } from 'pg';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  UnauthorizedError,
} from '../../shared/domain/errors/index.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type {
  CrearAnotacionInternaDTO,
  AnotacionInternaItem,
  RespuestaListarAnotaciones,
} from './dto/anotacionesInternas.dto.js';

interface MetadataExpedienteArea {
  expedienteId: string;
  codigoExpediente: string;
  solicitanteId: string;
  areaId: string;
  areaCodigo?: string;
}

/**
 * Recupera el área actual y metadatos del expediente.
 */
async function obtenerAreaActualExpediente(
  cliente: PoolClient,
  expedienteId: string,
): Promise<MetadataExpedienteArea> {
  const res = await cliente.query<{
    expediente_id: string;
    codigo_expediente: string;
    solicitante_id: string;
    area_actual_id: string;
    area_codigo?: string;
  }>(
    `SELECT e.expediente_id::text,
            e.codigo_expediente,
            e.solicitante_id::text,
            COALESCE(NULLIF(ultimo.area_actual_id, ''), e.area_destino_id::text) AS area_actual_id,
            a.codigo AS area_codigo
       FROM sigd_tra.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
       LEFT JOIN sigd_org.area a ON a.area_id::text = COALESCE(NULLIF(ultimo.area_actual_id, ''), e.area_destino_id::text)
      WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (res.rowCount === 0) {
    throw new NotFoundError({ message: 'Expediente no encontrado.' });
  }

  const fila = res.rows[0];
  return {
    expedienteId: fila.expediente_id,
    codigoExpediente: fila.codigo_expediente,
    solicitanteId: fila.solicitante_id,
    areaId: fila.area_actual_id,
    areaCodigo: fila.area_codigo,
  };
}

/**
 * Resuelve la autorización de escritura para registrar una anotación interna.
 * Reglas normativas institucionales:
 * - DOCENTE: autoriza si cuenta con asignación activa en el expediente.
 * - COORDINADOR_AREA: autoriza si el expediente pertenece a su área de supervisión.
 * - JEFE_UNIDAD_ACADEMICA: autoriza si el expediente pertenece a su unidad orgánica.
 * - SECRETARIO: rol de consulta y supervisión documental general; no adquiere facultades de evaluación docente.
 * - CIUDADANO / ESTUDIANTE: sin acceso.
 */
async function validarAutorizacionEscritura(
  cliente: PoolClient,
  expedienteId: string,
  actor: ActorRutaDoc,
  areaIdExpediente: string,
): Promise<{ rolEfectivo: string; idAsignacion: string | null }> {
  const roles = actor.roles ?? [];

  // 1. Prohibición expresa a administrados / ciudadanos
  if (roles.includes('CIUDADANO') || roles.includes('ESTUDIANTE')) {
    throw new ForbiddenError({
      message: 'Las anotaciones internas de seguimiento son de acceso exclusivo para el personal institucional.',
    });
  }

  // 2. Comprobar si el actor es docente evaluador con asignación activa
  const asignacionActiva = await cliente.query<{ id_asignacion: string; id_usuario_docente: string }>(
    `SELECT id_asignacion::text, id_usuario_docente::text
       FROM sigd_rut.expediente_evaluador
      WHERE expediente_id = $1::uuid
        AND id_usuario_docente = $2::uuid
        AND activo = TRUE`,
    [expedienteId, actor.id],
  );

  const esEvaluadorAsignado = asignacionActiva.rowCount !== null && asignacionActiva.rowCount > 0;
  const idAsignacionActiva = esEvaluadorAsignado ? asignacionActiva.rows[0].id_asignacion : null;

  // Si tiene rol DOCENTE
  if (roles.includes('DOCENTE')) {
    if (!esEvaluadorAsignado) {
      throw new ForbiddenError({
        message: 'El personal docente solo puede registrar anotaciones internas en expedientes que tenga formalmente asignados como evaluador activo.',
      });
    }
    return { rolEfectivo: 'DOCENTE', idAsignacion: idAsignacionActiva };
  }

  // 3. Comprobar si tiene rol de Coordinación o Jefatura de Unidad
  const esCoordinador = roles.includes('COORDINADOR_AREA');
  const esJefeUnidad = roles.includes('JEFE_UNIDAD_ACADEMICA');

  if (esCoordinador || esJefeUnidad) {
    const rolEfectivo = esCoordinador ? 'COORDINADOR_AREA' : 'JEFE_UNIDAD_ACADEMICA';
    // Verificar correspondencia de ámbito de área
    const permisos = actor.permisos ?? [];
    const tieneGlobal = permisos.some((p) => p.ambito === 'GLOBAL' && p.areaId === null);
    const coincideArea = actor.unidadOrganicaId === areaIdExpediente ||
      permisos.some((p) => p.ambito === 'AREA' && p.areaId === areaIdExpediente);

    if (!tieneGlobal && !coincideArea) {
      throw new ForbiddenError({
        message: `No cuenta con facultades de supervisión en el área del expediente (${areaIdExpediente}).`,
      });
    }

    return { rolEfectivo, idAsignacion: idAsignacionActiva };
  }

  // 4. Tratamiento específico para SECRETARIO (solo consulta; no escritura docente)
  if (roles.includes('SECRETARIO')) {
    // Si no cuenta con rol docente ni de coordinación, se restringe la escritura
    throw new ForbiddenError({
      message: 'El rol de Secretaría Académica cuenta con facultades de consulta y supervisión documental. El registro de anotaciones de seguimiento está reservado al docente evaluador asignado y a la coordinación de área.',
    });
  }

  // 5. Otros roles no facultados
  throw new ForbiddenError({
    message: 'No cuenta con facultades institucionales autorizadas para registrar anotaciones internas en este expediente.',
  });
}

/**
 * Registra una nueva anotación interna inmutable con emisión de evento Transactional Outbox.
 */
export async function registrarAnotacionInterna(
  cliente: PoolClient,
  expedienteId: string,
  actor: ActorRutaDoc,
  datos: CrearAnotacionInternaDTO,
): Promise<AnotacionInternaItem> {
  if (!actor || !actor.id) {
    throw new UnauthorizedError();
  }

  // 1. Metadatos del expediente y ámbito institucional
  const { codigoExpediente, areaId } = await obtenerAreaActualExpediente(cliente, expedienteId);

  // 2. Validación de autorización RBAC
  const { rolEfectivo, idAsignacion } = await validarAutorizacionEscritura(
    cliente,
    expedienteId,
    actor,
    areaId,
  );

  // 3. Validación de anotación padre si se especifica
  if (datos.anotacionPadreId) {
    const padreRes = await cliente.query<{ id_anotacion: string }>(
      `SELECT id_anotacion::text
         FROM sigd_rut.expediente_anotacion_interna
        WHERE id_anotacion = $1::uuid AND expediente_id = $2::uuid`,
      [datos.anotacionPadreId, expedienteId],
    );
    if (padreRes.rowCount === 0) {
      throw new ValidationError({
        invalidParams: [
          {
            name: 'anotacionPadreId',
            reason: 'La anotación padre referenciada no existe o no corresponde a este expediente.',
          },
        ],
      });
    }
  }

  // 4. Inserción append-only en la tabla de persistencia
  const insertRes = await cliente.query<{
    id_anotacion: string;
    expediente_id: string;
    id_asignacion: string | null;
    usuario_id: string;
    rol_codigo: string;
    area_id: string;
    tipo_anotacion: string;
    contenido: string;
    anotacion_padre_id: string | null;
    creado_en: Date;
  }>(
    `INSERT INTO sigd_rut.expediente_anotacion_interna (
       expediente_id, id_asignacion, usuario_id, rol_codigo, area_id,
       tipo_anotacion, contenido, anotacion_padre_id, creado_en
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4, $5::uuid,
       $6, $7, $8::uuid, clock_timestamp()
     )
     RETURNING id_anotacion, expediente_id, id_asignacion, usuario_id, rol_codigo,
               area_id, tipo_anotacion, contenido, anotacion_padre_id, creado_en`,
    [
      expedienteId,
      idAsignacion,
      actor.id,
      rolEfectivo,
      areaId,
      datos.tipoAnotacion,
      datos.contenido.trim(),
      datos.anotacionPadreId ?? null,
    ],
  );

  const fila = insertRes.rows[0];

  // 5. Publicación del evento en Transactional Outbox (misma transacción)
  await insertarEvento(cliente, {
    agregado: 'Expediente',
    tipo_evento: 'ExpedienteAnotacionInternaRegistrada',
    payload: {
      identidad: {
        expediente_id: expedienteId,
        id_anotacion: fila.id_anotacion,
        cut: codigoExpediente,
      },
      contexto: {
        usuario_autor_id: actor.id,
        rol_codigo: rolEfectivo,
        area_id: areaId,
        id_asignacion: idAsignacion,
      },
      datos_especificos: {
        tipo_anotacion: fila.tipo_anotacion,
        contenido_extracto: fila.contenido.slice(0, 120),
        anotacion_padre_id: fila.anotacion_padre_id,
        creado_en: fila.creado_en.toISOString(),
      },
    },
  });

  // 6. Consultar datos complementarios del autor para el contrato de retorno
  const autorRes = await cliente.query<{
    nombre_completo: string;
    usuario: string;
    correo: string;
    rol_nombre?: string;
    area_codigo?: string;
    area_nombre?: string;
  }>(
    `SELECT COALESCE(pn.nombre_completo, cu.usuario) AS nombre_completo,
            cu.usuario,
            cu.correo,
            rs.nombre AS rol_nombre,
            ar.codigo AS area_codigo,
            ar.nombre AS area_nombre
       FROM sigd_auth.cuenta_usuario cu
       LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = cu.id_persona
       LEFT JOIN sigd_org.rol_sistema rs ON rs.codigo = $2
       LEFT JOIN sigd_org.area ar ON ar.area_id = $3::uuid
      WHERE cu.id_usuario = $1::uuid`,
    [actor.id, rolEfectivo, areaId],
  );

  const autor = autorRes.rows[0];

  return {
    idAnotacion: fila.id_anotacion,
    expedienteId: fila.expediente_id,
    idAsignacion: fila.id_asignacion,
    usuarioId: fila.usuario_id,
    autorNombreCompleto: autor?.nombre_completo ?? 'Personal Institucional',
    autorUsuario: autor?.usuario ?? 'usuario',
    autorCorreo: autor?.correo ?? '',
    rolCodigo: fila.rol_codigo,
    rolNombre: autor?.rol_nombre ?? fila.rol_codigo,
    areaId: fila.area_id,
    areaCodigo: autor?.area_codigo,
    areaNombre: autor?.area_nombre,
    tipoAnotacion: fila.tipo_anotacion as AnotacionInternaItem['tipoAnotacion'],
    contenido: fila.contenido,
    anotacionPadreId: fila.anotacion_padre_id,
    creadoEn: fila.creado_en.toISOString(),
  };
}

/**
 * Lista cronológicamente las anotaciones internas registradas sobre un expediente.
 * Exclusivo para personal institucional facultado (consulta por evaluador, coordinación o secretaría).
 */
export async function listarAnotacionesInternas(
  pool: Pool,
  expedienteId: string,
  actor: ActorRutaDoc,
): Promise<RespuestaListarAnotaciones> {
  if (!actor || !actor.id) {
    throw new UnauthorizedError();
  }

  const roles = actor.roles ?? [];
  if (roles.includes('CIUDADANO') || roles.includes('ESTUDIANTE')) {
    throw new ForbiddenError({
      message: 'Las anotaciones internas de seguimiento son de acceso exclusivo para el personal institucional.',
    });
  }

  if (actor.puedeVerExpediente) {
    const puedeVer = await actor.puedeVerExpediente(expedienteId);
    if (!puedeVer) {
      throw new ForbiddenError({
        message: 'No cuenta con autorización para consultar el seguimiento de este expediente.',
      });
    }
  }

  let rows: Array<{
    id_anotacion: string;
    expediente_id: string;
    id_asignacion: string | null;
    usuario_id: string;
    autor_nombre_completo: string;
    autor_usuario: string;
    autor_correo: string;
    rol_codigo: string;
    rol_nombre: string | null;
    area_id: string;
    area_codigo: string | null;
    area_nombre: string | null;
    tipo_anotacion: string;
    contenido: string;
    anotacion_padre_id: string | null;
    creado_en: Date;
  }> = [];

  try {
    const res = await pool.query<{
      id_anotacion: string;
      expediente_id: string;
      id_asignacion: string | null;
      usuario_id: string;
      autor_nombre_completo: string;
      autor_usuario: string;
      autor_correo: string;
      rol_codigo: string;
      rol_nombre: string | null;
      area_id: string;
      area_codigo: string | null;
      area_nombre: string | null;
      tipo_anotacion: string;
      contenido: string;
      anotacion_padre_id: string | null;
      creado_en: Date;
    }>(
      `SELECT a.id_anotacion::text,
              a.expediente_id::text,
              a.id_asignacion::text,
              a.usuario_id::text,
              COALESCE(pn.nombre_completo, cu.usuario) AS autor_nombre_completo,
              cu.usuario AS autor_usuario,
              cu.correo AS autor_correo,
              a.rol_codigo,
              rs.nombre AS rol_nombre,
              a.area_id::text,
              ar.codigo AS area_codigo,
              ar.nombre AS area_nombre,
              a.tipo_anotacion,
              a.contenido,
              a.anotacion_padre_id::text,
              a.creado_en
         FROM sigd_rut.expediente_anotacion_interna a
         JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = a.usuario_id
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = cu.id_persona
         LEFT JOIN sigd_org.rol_sistema rs ON rs.codigo = a.rol_codigo
         LEFT JOIN sigd_org.area ar ON ar.area_id = a.area_id
        WHERE a.expediente_id = $1::uuid
        ORDER BY a.creado_en ASC`,
      [expedienteId],
    );
    rows = res.rows;
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '42P01') {
      return {
        ok: true,
        total: 0,
        anotaciones: [],
      };
    }
    throw err;
  }

  const anotaciones: AnotacionInternaItem[] = rows.map((f) => ({
    idAnotacion: f.id_anotacion,
    expedienteId: f.expediente_id,
    idAsignacion: f.id_asignacion,
    usuarioId: f.usuario_id,
    autorNombreCompleto: f.autor_nombre_completo,
    autorUsuario: f.autor_usuario,
    autorCorreo: f.autor_correo,
    rolCodigo: f.rol_codigo,
    rolNombre: f.rol_nombre ?? f.rol_codigo,
    areaId: f.area_id,
    areaCodigo: f.area_codigo ?? undefined,
    areaNombre: f.area_nombre ?? undefined,
    tipoAnotacion: f.tipo_anotacion as AnotacionInternaItem['tipoAnotacion'],
    contenido: f.contenido,
    anotacionPadreId: f.anotacion_padre_id,
    creadoEn: f.creado_en.toISOString(),
  }));

  return {
    ok: true,
    total: anotaciones.length,
    anotaciones,
  };
}

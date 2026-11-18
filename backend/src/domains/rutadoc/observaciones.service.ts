import type { Pool, PoolClient } from 'pg';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import type {
  CrearObservacionRutaDocDTO,
  RegistrarSubsanacionRutaDocDTO,
} from './dto/observacionRutaDoc.dto.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { obtenerSiguienteEstado } from './rutadoc.fsm.js';

interface AreaExpedienteInfo {
  areaId: string;
  codigoExpediente: string;
  solicitanteId: string;
  estado: string;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

async function resolverOperadorId(
  cliente: PoolClient,
  usuarioActorId: string,
): Promise<string | bigint> {
  const colInfo = await cliente.query<{ data_type: string }>(`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'sigd_rut'
      AND table_name = 'movimiento_tramite'
      AND column_name = 'usuario_operador_id'
  `);
  const tipoColumna = colInfo.rows[0]?.data_type?.toLowerCase() ?? 'bigint';

  if (tipoColumna === 'uuid') {
    return usuarioActorId;
  }
  if (/^\d+$/.test(usuarioActorId)) {
    return BigInt(usuarioActorId);
  }

  try {
    const resMapeo = await cliente.query<{ operador_id: string }>(`
      SELECT operador_id::text
      FROM sigd_auth.operador_identidad
      WHERE id_usuario = $1::uuid
    `, [usuarioActorId]);
    if (resMapeo?.rows?.[0]?.operador_id) {
      return BigInt(resMapeo.rows[0].operador_id);
    }
  } catch {
    // fallback
  }

  try {
    const numHash = BigInt(990000000) + BigInt(Math.abs(hashString(usuarioActorId)) % 100000);
    await cliente.query(`
      INSERT INTO sigd_auth.operador_identidad (id_usuario, operador_id)
      VALUES ($1::uuid, $2)
      ON CONFLICT (id_usuario) DO NOTHING
    `, [usuarioActorId, numHash.toString()]);
    return numHash;
  } catch {
    return BigInt(990000001);
  }
}

async function obtenerDatosExpediente(
  cliente: PoolClient,
  expedienteId: string,
): Promise<AreaExpedienteInfo> {
  const res = await cliente.query<{
    expediente_id: string;
    codigo_expediente: string;
    solicitante_id: string;
    estado: string;
    area_destino_id: string | null;
    area_actual_id: string | null;
  }>(
    `SELECT e.expediente_id,
            e.codigo_expediente,
            e.solicitante_id::text,
            COALESCE(ultimo.estado_nuevo, e.estado) AS estado,
            e.area_destino_id::text,
            ultimo.area_actual_id
       FROM sigd_tra.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
      WHERE e.expediente_id = $1::uuid
      FOR UPDATE OF e`,
    [expedienteId],
  );

  if (res.rowCount === 0) {
    throw new NotFoundError({ detail: `El expediente con ID ${expedienteId} no existe.` });
  }

  const fila = res.rows[0];
  const areaId = fila.area_actual_id || fila.area_destino_id || '00000000-0000-0000-0000-000000000000';

  return {
    areaId,
    codigoExpediente: fila.codigo_expediente,
    solicitanteId: fila.solicitante_id,
    estado: fila.estado,
  };
}

export interface ResultadoObservacionRutaDoc {
  ok: boolean;
  mensaje: string;
  idObservacion: string;
  expedienteId: string;
  ronda: number;
  tipoObservacion: string;
  estado: string;
  plazoDias: number;
  fechaLimite: string;
  slaPaused: boolean;
}

export interface ResultadoSubsanacionRutaDoc {
  ok: boolean;
  mensaje: string;
  idSubsanacion: string;
  expedienteId: string;
  ronda: number;
  estado: string;
  canalRecepcion: string;
  slaResumed: boolean;
}

export class ServicioObservacionesRutaDoc {
  /**
   * Registra una observación formal o técnica, determinando la ronda e imponiendo la regla de preclusión (LPAG Arts. 136 y 142).
   */
  async crearObservacion(
    cliente: PoolClient,
    expedienteId: string,
    actor: ActorRutaDoc,
    datos: CrearObservacionRutaDocDTO,
  ): Promise<ResultadoObservacionRutaDoc> {
    // 1. RBAC Check: GESTOR_APOYO_AREA is strictly forbidden
    const roles = actor.roles ?? [];
    if (roles.includes('GESTOR_APOYO_AREA') && !roles.some((r) => ['ADMINISTRADOR', 'DIRECTOR', 'MESA_PARTES', 'DOCENTE', 'COORDINADOR_AREA', 'JEFE_UNIDAD_ACADEMICA'].includes(r))) {
      throw new ForbiddenError({
        message: 'Acceso denegado: El rol GESTOR_APOYO_AREA no posee facultades para formular observaciones.',
      });
    }

    if (actor.permisos && actor.permisos.length > 0) {
      const tienePermisoObservar = actor.permisos.some((p) => p.codigo === 'EXPEDIENTE_OBSERVAR');
      if (!tienePermisoObservar && !roles.includes('ADMINISTRADOR') && !roles.includes('DIRECTOR')) {
        throw new ForbiddenError({
          message: 'No cuenta con el permiso EXPEDIENTE_OBSERVAR para formular observaciones sobre el expediente.',
        });
      }
    }

    // 2. Obtener datos del expediente y validar estado en FSM
    const { areaId, codigoExpediente, solicitanteId, estado: estadoActual } = await obtenerDatosExpediente(cliente, expedienteId);

    if (estadoActual === 'OBSERVADO') {
      throw new ConflictError({
        message: 'El expediente ya se encuentra en estado OBSERVADO. Debe subsanarse antes de formular un nuevo pliego.',
      });
    }

    // FSM valida que se pueda transicionar a OBSERVADO mediante OBSERVACION
    const siguienteEstado = obtenerSiguienteEstado(estadoActual, 'OBSERVACION');
    if (siguienteEstado !== 'OBSERVADO') {
      throw new ConflictError({
        message: `No se puede formular observaciones a un expediente en estado '${estadoActual}'. Debe encontrarse EN_CALIFICACION o EN_REVISION.`,
      });
    }

    // 3. Determinación de la Ronda
    const obsPreviasRes = await cliente.query<{ max_ronda: number | null; pendientes: number }>(
      `SELECT MAX(ronda) AS max_ronda,
              COUNT(*) FILTER (WHERE estado = 'PENDIENTE')::int AS pendientes
         FROM sigd_rut.expediente_observacion
        WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );

    const previas = obsPreviasRes.rows[0];
    if (previas && previas.pendientes > 0) {
      throw new ConflictError({
        message: 'Existe un pliego de observaciones previo en estado PENDIENTE de subsanación.',
      });
    }

    const nuevaRonda = (previas?.max_ronda ?? 0) + 1;

    // 4. Regla de Preclusión (LPAG Arts. 136 y 142)
    // Si nuevaRonda > 1, no se pueden agregar requisitos que no fueron observados en rondas previas
    // a menos que exista justificacionExcepcionPreclusion documentada de al menos 20 caracteres.
    if (nuevaRonda > 1 && datos.requisitos && datos.requisitos.length > 0) {
      const reqHistoricosRes = await cliente.query<{ requisito_id: string }>(
        `SELECT DISTINCT obr.requisito_id::text
           FROM sigd_rut.observacion_requisito obr
           JOIN sigd_rut.expediente_observacion eo ON eo.id_observacion = obr.id_observacion
          WHERE eo.expediente_id = $1::uuid
            AND eo.ronda < $2`,
        [expedienteId, nuevaRonda],
      );

      const requisitosPermitidos = new Set(reqHistoricosRes.rows.map((r) => r.requisito_id));

      for (const req of datos.requisitos) {
        if (!requisitosPermitidos.has(req.requisitoId)) {
          const tieneJustificacionValida =
            typeof datos.justificacionExcepcionPreclusion === 'string' &&
            datos.justificacionExcepcionPreclusion.trim().length >= 20;

          if (!tieneJustificacionValida) {
            throw new AppError({
              status: 422,
              code: 'ERROR_PRECLUSION_REQUISITOS',
              message: `Violación del Principio de Preclusión Procesal (LPAG Arts. 136 y 142): El requisito ${req.requisitoId} no fue observado en la Ronda 1. La administración está impedida de formular nuevas observaciones sobre aspectos no advertidos inicialmente salvo justificación legal sobrevenida.`,
            });
          }
        }
      }
    }

    // 5. Cómputo de Plazos y Fecha Límite
    const plazoDias = datos.plazoDias || 5;
    const fechaLimiteMs = Date.now() + plazoDias * 24 * 60 * 60 * 1000;
    const fechaLimite = new Date(fechaLimiteMs);

    // 6. Resolver operador para bitácora WORM
    const operadorId = await resolverOperadorId(cliente, actor.id);

    // 7. Insertar Pliego de Observación
    const obsInsertRes = await cliente.query<{ id_observacion: string }>(
      `INSERT INTO sigd_rut.expediente_observacion (
         expediente_id, ronda, tipo_observacion, motivo, sustento_tecnico,
         plazo_dias, fecha_limite, estado, usuario_observador_id,
         usuario_cuenta_id, area_origen_id, fecha_observacion
       ) VALUES (
         $1::uuid, $2, $3, $4, $5,
         $6, $7, 'PENDIENTE', $8,
         $9::uuid, $10::uuid, CURRENT_TIMESTAMP
       ) RETURNING id_observacion::text`,
      [
        expedienteId,
        nuevaRonda,
        datos.tipoObservacion,
        datos.motivo,
        datos.sustentoTecnico || null,
        plazoDias,
        fechaLimite,
        operadorId,
        actor.id,
        areaId !== '00000000-0000-0000-0000-000000000000' ? areaId : null,
      ],
    );

    const idObservacion = obsInsertRes.rows[0].id_observacion;

    // 8. Insertar Detalle de Requisitos Observados si se especificaron
    if (datos.requisitos && datos.requisitos.length > 0) {
      for (const req of datos.requisitos) {
        await cliente.query(
          `INSERT INTO sigd_rut.observacion_requisito (
             id_observacion, requisito_id, descripcion_incumplimiento
           ) VALUES ($1::uuid, $2::uuid, $3)
           ON CONFLICT (id_observacion, requisito_id) DO NOTHING`,
          [idObservacion, req.requisitoId, req.descripcionIncumplimiento],
        );
      }
    }

    // 9. Registrar Movimiento Inmutable WORM
    const datosMovimiento = {
      idObservacion,
      ronda: nuevaRonda,
      tipoObservacion: datos.tipoObservacion,
      motivo: datos.motivo,
      sustentoTecnico: datos.sustentoTecnico || null,
      plazoDias,
      fechaLimite: fechaLimite.toISOString(),
      requisitos: datos.requisitos ?? [],
      areaId,
      observadorId: actor.id,
    };

    const movRes = await cliente.query<{ id_movimiento: string }>(
      `INSERT INTO sigd_rut.movimiento_tramite (
         expediente_id, estado_anterior, evento, estado_nuevo,
         usuario_operador_id, datos
       ) VALUES (
         $1::uuid, $2, 'OBSERVACION', 'OBSERVADO',
         $3, $4::jsonb
       ) RETURNING id_movimiento::text`,
      [expedienteId, estadoActual, operadorId, JSON.stringify(datosMovimiento)],
    );

    const idMovimiento = movRes.rows[0].id_movimiento;

    // Vincular movimiento con la observación
    await cliente.query(
      `UPDATE sigd_rut.expediente_observacion SET id_movimiento = $1::uuid WHERE id_observacion = $2::uuid`,
      [idMovimiento, idObservacion],
    );

    // 10. Actualizar Estado del Expediente
    await cliente.query(
      `UPDATE sigd_tra.expediente SET estado = 'OBSERVADO' WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );

    // 11. Depositar Evento en Outbox para Casilla Electrónica
    try {
      const destinatarios = await cliente.query<{ usuario_id: string; asunto: string }>(
        `SELECT c.id_usuario::text AS usuario_id, COALESCE(t.asunto, 'Trámite Institucional') AS asunto
           FROM sigd_tra.expediente e
           LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
           JOIN sigd_auth.cuenta_usuario c ON c.id_persona = e.solicitante_id AND c.activo = TRUE
          WHERE e.expediente_id = $1::uuid
          ORDER BY c.id_usuario
          LIMIT 1`,
        [expedienteId],
      );

      if (destinatarios.rowCount && destinatarios.rows[0]) {
        const dest = destinatarios.rows[0];
        await insertarEvento(cliente, {
          agregado: 'Expediente',
          tipo_evento: 'expediente_observado',
          payload: {
            usuario_id: dest.usuario_id,
            expediente_id: expedienteId,
            cut: codigoExpediente,
            asunto: dest.asunto,
            tipo_acto: `Observación de Expediente (Ronda ${nuevaRonda})`,
            cuerpo: {
              idObservacion,
              ronda: nuevaRonda,
              contenido: datos.motivo,
              plazoDias,
              fechaLimite: fechaLimite.toISOString(),
            },
          },
        });
      }
    } catch {
      // Continuar si no existe cuenta casilla previa
    }

    return {
      ok: true,
      mensaje: `Observación registrada exitosamente (Ronda ${nuevaRonda}). El trámite pasa a estado OBSERVADO y se suspende el cómputo de SLA.`,
      idObservacion,
      expedienteId,
      ronda: nuevaRonda,
      tipoObservacion: datos.tipoObservacion,
      estado: 'OBSERVADO',
      plazoDias,
      fechaLimite: fechaLimite.toISOString(),
      slaPaused: true,
    };
  }

  /**
   * Registra una subsanación formal de observaciones formuladas, asociando documentos y transicionando formalmente a SUBSANADO.
   */
  async registrarSubsanacion(
    cliente: PoolClient,
    expedienteId: string,
    actor: ActorRutaDoc,
    datos: RegistrarSubsanacionRutaDocDTO,
  ): Promise<ResultadoSubsanacionRutaDoc> {
    const roles = actor.roles ?? [];

    // 1. RBAC: GESTOR_APOYO_AREA está prohibido terminantemente de subsanar
    if (roles.includes('GESTOR_APOYO_AREA') && !roles.some((r) => ['ADMINISTRADOR', 'MESA_PARTES', 'ESTUDIANTE', 'CIUDADANO'].includes(r))) {
      throw new ForbiddenError({
        message: 'Acceso denegado: El rol GESTOR_APOYO_AREA no posee facultades para subsanar expedientes.',
      });
    }

    // 2. Administrador no puede sustituir al administrado
    if (roles.includes('ADMINISTRADOR') && !roles.some((r) => ['ESTUDIANTE', 'CIUDADANO', 'MESA_PARTES'].includes(r))) {
      throw new ForbiddenError({
        message: 'El rol ADMINISTRADOR no puede actuar en sustitución del administrado ni presentar subsanaciones.',
      });
    }

    // 3. Obtener expediente
    const { areaId, codigoExpediente, solicitanteId, estado: estadoActual } = await obtenerDatosExpediente(cliente, expedienteId);

    if (estadoActual !== 'OBSERVADO') {
      throw new ConflictError({
        message: `No se puede subsanar un expediente en estado '${estadoActual}'. Debe encontrarse OBSERVADO.`,
      });
    }

    // 4. Validar Titularidad o Mesa de Partes en ventanilla
    const personaUsuario = await cliente.query<{ id_persona: string }>(
      `SELECT id_persona::text FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid`,
      [actor.id],
    );
    const personaActorId = personaUsuario.rows[0]?.id_persona ?? actor.id;
    const esTitular = personaActorId === solicitanteId || actor.id === solicitanteId;

    let canal = datos.canalRecepcion || (esTitular ? 'PORTAL_ESTUDIANTE' : 'VENTANILLA_MESA_PARTES');

    if (!esTitular) {
      if (!roles.includes('MESA_PARTES')) {
        throw new ForbiddenError({
          message: 'Solo el administrado titular del expediente o un operador de Mesa de Partes por ventanilla pueden registrar subsanaciones.',
        });
      }

      const checkMp = await cliente.query<{ valido: boolean }>(
        `SELECT EXISTS (
          SELECT 1
          FROM sigd_org.usuario_rol ur
          JOIN sigd_org.rol_sistema rs ON ur.rol_id = rs.rol_id
          JOIN sigd_org.area a ON ur.area_id = a.area_id
          WHERE ur.id_usuario = $1::uuid
            AND rs.codigo = 'MESA_PARTES'
            AND a.codigo = 'MP'
            AND a.vigente = TRUE
            AND ur.vigente_desde <= NOW()
            AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > NOW())
        ) AS valido`,
        [actor.id],
      );

      if (!checkMp.rows[0]?.valido) {
        throw new ForbiddenError({
          message: 'Acceso denegado: El operador de Mesa de Partes no cuenta con adscripción activa al área de Mesa de Partes (MP).',
        });
      }

      canal = 'VENTANILLA_MESA_PARTES';
    }

    // 5. Encontrar Observación Activa
    let obsQuery = `SELECT id_observacion::text, ronda, estado
                      FROM sigd_rut.expediente_observacion
                     WHERE expediente_id = $1::uuid`;
    const params: unknown[] = [expedienteId];

    if (datos.observacionId) {
      obsQuery += ` AND id_observacion = $2::uuid`;
      params.push(datos.observacionId);
    } else {
      obsQuery += ` AND estado = 'PENDIENTE' ORDER BY ronda DESC LIMIT 1`;
    }

    const obsRes = await cliente.query<{ id_observacion: string; ronda: number; estado: string }>(obsQuery, params);

    if (obsRes.rowCount === 0) {
      throw new NotFoundError({
        detail: 'No se encontró un pliego de observaciones pendiente de subsanación para este expediente.',
      });
    }

    const observacionActiva = obsRes.rows[0];

    if (observacionActiva.estado === 'SUBSANADA') {
      throw new ConflictError({
        message: 'La observación indicada ya fue formalmente subsanada y cerrada.',
      });
    }

    const operadorId = await resolverOperadorId(cliente, actor.id);

    // 6. Insertar Registro de Subsanación
    const subInsertRes = await cliente.query<{ id_subsanacion: string }>(
      `INSERT INTO sigd_rut.expediente_subsanacion (
         id_observacion, expediente_id, ronda, descripcion_respuesta,
         canal_recepcion, documento_adjunto_id, usuario_subsanador_id,
         usuario_cuenta_id, es_titular, fecha_subsanacion
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4,
         $5, $6::uuid, $7,
         $8::uuid, $9, CURRENT_TIMESTAMP
       ) RETURNING id_subsanacion::text`,
      [
        observacionActiva.id_observacion,
        expedienteId,
        observacionActiva.ronda,
        datos.motivo,
        canal,
        datos.documentoAdjuntoId || null,
        operadorId,
        actor.id,
        esTitular,
      ],
    );

    const idSubsanacion = subInsertRes.rows[0].id_subsanacion;

    // 7. Actualizar Estado de la Observación y sus Requisitos
    await cliente.query(
      `UPDATE sigd_rut.expediente_observacion
          SET estado = 'SUBSANADA',
              fecha_subsanacion = CURRENT_TIMESTAMP
        WHERE id_observacion = $1::uuid`,
      [observacionActiva.id_observacion],
    );

    await cliente.query(
      `UPDATE sigd_rut.observacion_requisito
          SET subsanado = TRUE,
              fecha_subsanacion = CURRENT_TIMESTAMP
        WHERE id_observacion = $1::uuid`,
      [observacionActiva.id_observacion],
    );

    // 8. Registrar Movimiento Inmutable WORM: CORRECCION -> SUBSANADO
    const datosMovimiento = {
      idSubsanacion,
      idObservacion: observacionActiva.id_observacion,
      ronda: observacionActiva.ronda,
      descripcion: datos.motivo,
      sustentoSubsanacion: datos.sustentoSubsanacion || null,
      canalRecepcion: canal,
      documentoAdjuntoId: datos.documentoAdjuntoId || null,
      documentosAdjuntos: datos.documentosAdjuntos ?? [],
      esTitular,
      subsanadoPor: actor.id,
      areaId,
    };

    const movRes = await cliente.query<{ id_movimiento: string }>(
      `INSERT INTO sigd_rut.movimiento_tramite (
         expediente_id, estado_anterior, evento, estado_nuevo,
         usuario_operador_id, datos
       ) VALUES (
         $1::uuid, 'OBSERVADO', 'CORRECCION', 'SUBSANADO',
         $2, $3::jsonb
       ) RETURNING id_movimiento::text`,
      [expedienteId, operadorId, JSON.stringify(datosMovimiento)],
    );

    const idMovimiento = movRes.rows[0].id_movimiento;

    await cliente.query(
      `UPDATE sigd_rut.expediente_subsanacion SET id_movimiento = $1::uuid WHERE id_subsanacion = $2::uuid`,
      [idMovimiento, idSubsanacion],
    );

    // 9. Actualizar Estado del Expediente en FSM canónica: SUBSANADO
    await cliente.query(
      `UPDATE sigd_tra.expediente SET estado = 'SUBSANADO' WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );

    // 10. Notificación Outbox
    await insertarEvento(cliente, {
      agregado: 'Expediente',
      tipo_evento: 'TramiteSubsanado',
      payload: {
        identidad: { expediente_id: expedienteId, cut: codigoExpediente },
        contexto: {
          usuario_actor_id: actor.id,
          solicitante_id: solicitanteId,
          area_id: areaId,
          canal_recepcion: canal,
        },
        datos_especificos: {
          idObservacion: observacionActiva.id_observacion,
          idSubsanacion,
          ronda: observacionActiva.ronda,
          motivo: datos.motivo,
        },
      },
    });

    return {
      ok: true,
      mensaje: `Subsanación registrada exitosamente (Ronda ${observacionActiva.ronda}). El trámite pasa a estado SUBSANADO y se reanuda el cómputo de SLA.`,
      idSubsanacion,
      expedienteId,
      ronda: observacionActiva.ronda,
      estado: 'SUBSANADO',
      canalRecepcion: canal,
      slaResumed: true,
    };
  }

  /**
   * Consulta el historial estructurado de pliegos de observaciones, requisitos y subsanaciones de un expediente.
   */
  async obtenerHistorialObservaciones(pool: Pool, expedienteId: string) {
    const obsRes = await pool.query<{
      id_observacion: string;
      ronda: number;
      tipo_observacion: string;
      motivo: string;
      sustento_tecnico: string | null;
      plazo_dias: number;
      fecha_limite: Date | null;
      estado: string;
      fecha_observacion: Date;
      fecha_subsanacion: Date | null;
      usuario_observador_id: string;
    }>(
      `SELECT id_observacion::text,
              ronda,
              tipo_observacion,
              motivo,
              sustento_tecnico,
              plazo_dias,
              fecha_limite,
              estado,
              fecha_observacion,
              fecha_subsanacion,
              usuario_observador_id::text
         FROM sigd_rut.expediente_observacion
        WHERE expediente_id = $1::uuid
        ORDER BY ronda ASC, creado_en ASC`,
      [expedienteId],
    );

    const reqRes = await pool.query<{
      id_observacion: string;
      requisito_id: string;
      denominacion: string;
      descripcion_incumplimiento: string;
      subsanado: boolean;
    }>(
      `SELECT obr.id_observacion::text,
              obr.requisito_id::text,
              COALESCE(r.denominacion, 'Requisito TUPA') AS denominacion,
              obr.descripcion_incumplimiento,
              obr.subsanado
         FROM sigd_rut.observacion_requisito obr
         JOIN sigd_rut.expediente_observacion eo ON eo.id_observacion = obr.id_observacion
         LEFT JOIN sigd_doc.requisito r ON r.requisito_id = obr.requisito_id
        WHERE eo.expediente_id = $1::uuid
        ORDER BY obr.creado_en ASC`,
      [expedienteId],
    );

    const subRes = await pool.query<{
      id_subsanacion: string;
      id_observacion: string;
      ronda: number;
      descripcion_respuesta: string;
      canal_recepcion: string;
      documento_adjunto_id: string | null;
      nombre_archivo: string | null;
      es_titular: boolean;
      fecha_subsanacion: Date;
    }>(
      `SELECT es.id_subsanacion::text,
              es.id_observacion::text,
              es.ronda,
              es.descripcion_respuesta,
              es.canal_recepcion,
              es.documento_adjunto_id::text,
              da.nombre_archivo,
              es.es_titular,
              es.fecha_subsanacion
         FROM sigd_rut.expediente_subsanacion es
         LEFT JOIN sigd_doc.documento_adjunto da ON da.documento_adjunto_id = es.documento_adjunto_id
        WHERE es.expediente_id = $1::uuid
        ORDER BY es.ronda ASC, es.creado_en ASC`,
      [expedienteId],
    );

    return obsRes.rows.map((obs) => ({
      idObservacion: obs.id_observacion,
      ronda: obs.ronda,
      tipoObservacion: obs.tipo_observacion,
      motivo: obs.motivo,
      sustentoTecnico: obs.sustento_tecnico,
      plazoDias: obs.plazo_dias,
      fechaLimite: obs.fecha_limite ? obs.fecha_limite.toISOString() : null,
      estado: obs.estado,
      fechaObservacion: obs.fecha_observacion.toISOString(),
      fechaSubsanacion: obs.fecha_subsanacion ? obs.fecha_subsanacion.toISOString() : null,
      requisitos: reqRes.rows
        .filter((r) => r.id_observacion === obs.id_observacion)
        .map((r) => ({
          requisitoId: r.requisito_id,
          denominacion: r.denominacion,
          descripcionIncumplimiento: r.descripcion_incumplimiento,
          subsanado: r.subsanado,
        })),
      subsanaciones: subRes.rows
        .filter((s) => s.id_observacion === obs.id_observacion)
        .map((s) => ({
          idSubsanacion: s.id_subsanacion,
          descripcion: s.descripcion_respuesta,
          canal: s.canal_recepcion,
          documentoAdjuntoId: s.documento_adjunto_id,
          nombreArchivo: s.nombre_archivo,
          esTitular: s.es_titular,
          fechaSubsanacion: s.fecha_subsanacion.toISOString(),
        })),
    }));
  }
}

export const servicioObservacionesRutaDoc = new ServicioObservacionesRutaDoc();

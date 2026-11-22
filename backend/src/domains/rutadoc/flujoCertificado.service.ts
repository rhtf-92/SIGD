import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/domain/errors/index.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { verificarFacultadFirma } from '../../core/auth/auth.guard.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import { bloquearExpedienteRutaDoc } from './rutadoc.lock.js';
import { evaluarElegibilidadDerivacion, resolverOperadorBigInt } from './derivaciones.service.js';
import { ExpedienteAsignacionService } from './expedienteAsignacion.service.js';
import { EnrutabilidadService } from './enrutabilidad.service.js';
import { WorkflowService } from './workflow.service.js';
import { notificadorInstitucional } from '../../core/email/notificador-institucional.service.js';
import {
  FlujoCertificadoRepository,
  type CanalEntregaCertificado,
  type DbClient,
  type FlujoCertificadoRegistro,
  type FlujoHistorialRegistro,
  type ResultadoEvaluacion,
} from './flujoCertificado.repository.js';
import {
  MAPEO_ESTADO_FLUJO_A_RUTADOC,
  obtenerSiguienteEstadoFlujoCertificado,
  validarRolAutorizadoFlujoCertificado,
  type EstadoFlujoCertificado,
  type EventoFlujoCertificado,
} from './flujoCertificado.fsm.js';
import type {
  ArchivarNoRecojoDTO,
  CalificarEvaluacionDTO,
  CerrarInasistenciaSdaDTO,
  ConfirmarEntregaPresencialDTO,
  DerivarMesaPartesSdaDTO,
  DerivarSdaEspecialistaDTO,
  EmitirMemorandumCentroIdiomasDTO,
  AsignarEspecialistaIdiomaDTO,
  EmitirCertificadoSdaDTO,
  EmitirInformeEspecialistaDTO,
  IniciarFlujoCertificadoDTO,
  ProgramarEvaluacionDTO,
  ValidarRequisitosMpDTO,
  VisarFirmarDireccionDTO,
} from './flujoCertificado.schemas.js';

export const AREA_SDA_ID = 'a0000000-0000-0000-0000-000000000001';
export const AREA_DIR_ID = 'a0000000-0000-0000-0000-000000000002';
export const AREA_CI_ID = 'a0000000-0000-0000-0000-000000000003';

interface ContextoExpediente {
  expedienteId: string;
  codigoExpediente: string;
  solicitanteId: string;
  idUsuarioCreador: string | null;
  estadoRutaDoc: string;
  areaActualId: string;
}

export interface ResultadoTransicionFlujo {
  ok: true;
  expedienteId: string;
  evento: EventoFlujoCertificado;
  estadoFlujoAnterior: EstadoFlujoCertificado | null;
  estadoFlujoNuevo: EstadoFlujoCertificado;
  estadoRutaDoc: string;
  flujo: FlujoCertificadoRegistro;
  historialRegistro: FlujoHistorialRegistro;
}

export class FlujoCertificadoService {
  private readonly repo: FlujoCertificadoRepository;
  private readonly asignacionSvc: ExpedienteAsignacionService;
  private readonly enrutabilidadSvc: EnrutabilidadService;
  private readonly workflowSvc: WorkflowService;

  constructor(private readonly pool: Pool) {
    this.repo = new FlujoCertificadoRepository(pool);
    this.asignacionSvc = new ExpedienteAsignacionService(pool);
    this.enrutabilidadSvc = new EnrutabilidadService(pool);
    this.workflowSvc = new WorkflowService(pool);
  }

  private async ejecutarEnTransaccion<T>(
    expedienteId: string,
    fn: (cliente: PoolClient) => Promise<T>,
  ): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      await bloquearExpedienteRutaDoc(cliente, expedienteId);
      const resultado = await fn(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
  }

  private async cargarContextoExpediente(db: DbClient, expedienteId: string): Promise<ContextoExpediente> {
    const { rows } = await db.query<{
      expediente_id: string;
      codigo_expediente: string;
      solicitante_id: string;
      id_usuario_creador: string | null;
      estado_actual: string;
      area_actual_id: string;
    }>(
      `SELECT
         e.expediente_id::text AS expediente_id,
         e.codigo_expediente,
         e.solicitante_id::text AS solicitante_id,
         e.id_usuario_creador::text AS id_usuario_creador,
         CASE WHEN e.estado = 'PENDIENTE_PAGO' THEN 'PENDIENTE_PAGO'
              ELSE COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO')
         END AS estado_actual,
         COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_actual_id
       FROM sigd_tra.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
       WHERE e.expediente_id = $1::uuid
       LIMIT 1`,
      [expedienteId],
    );

    if (rows.length === 0) {
      throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
    }

    const r = rows[0];
    return {
      expedienteId: r.expediente_id,
      codigoExpediente: r.codigo_expediente,
      solicitanteId: r.solicitante_id,
      idUsuarioCreador: r.id_usuario_creador,
      estadoRutaDoc: r.estado_actual,
      areaActualId: r.area_actual_id,
    };
  }

  private async resolverIdPersonaActor(db: DbClient, actor: ActorRutaDoc): Promise<string | null> {
    if (actor.idPersona) {
      return actor.idPersona;
    }
    try {
      const { rows } = await db.query<{ id_persona: string | null }>(
        'SELECT id_persona::text AS id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid LIMIT 1',
        [actor.id],
      );
      return rows[0]?.id_persona ?? null;
    } catch {
      return null;
    }
  }

  private asegurarContextoInstitucional(contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL'): void {
    if (contextoOperacion === 'PERSONAL') {
      throw new ForbiddenError({
        code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
        detail: 'En contexto personal el usuario no dispone de facultades institucionales para operar expedientes.',
      });
    }
  }

  private async asegurarNoAutoatencion(
    db: DbClient,
    actor: ActorRutaDoc,
    solicitanteId: string,
  ): Promise<string | null> {
    const idPersonaActor = await this.resolverIdPersonaActor(db, actor);
    if ((idPersonaActor && idPersonaActor === solicitanteId) || actor.id === solicitanteId) {
      throw new ForbiddenError({
        code: 'CONFLICTO_INTERES_EXPEDIENTE_PROPIO',
        detail: 'AUTOATENCION_PROHIBIDA: El solicitante no puede tramitar, derivar ni resolver su propio expediente.',
      });
    }
    return idPersonaActor;
  }

  private asegurarCustodiaEnArea(actor: ActorRutaDoc, areaEsperada: string, permitirMesaEnDir = false): void {
    if (actor.unidadOrganicaId && actor.unidadOrganicaId === areaEsperada) {
      return;
    }
    if (permitirMesaEnDir && areaEsperada === AREA_DIR_ID && actor.roles.includes('MESA_PARTES')) {
      return;
    }
    throw new ForbiddenError({
      code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
      detail: 'No pertenece al área de custodia actual requerida para ejecutar esta transición.',
    });
  }

  private async verificarEncargaturaSda(db: DbClient, idUsuario: string, areaId: string): Promise<boolean> {
    try {
      const res = await db.query(
        `SELECT 1
           FROM sigd_org.responsabilidad_temporal rt
          WHERE rt.id_usuario = $1::uuid
            AND rt.area_id = $2::uuid
            AND rt.estado = 'ACTIVO'
            AND rt.tipo IN ('ENCARGATURA', 'DELEGACION', 'SUPLENCIA', 'DESIGNACION_ESPECIFICA')
            AND rt.vigente_desde <= now()
            AND (rt.vigente_hasta IS NULL OR rt.vigente_hasta > now())
          LIMIT 1`,
        [idUsuario, areaId],
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  private async insertarMovimientoRutaDoc(
    cliente: PoolClient,
    params: {
      expedienteId: string;
      estadoAnterior: string;
      evento: string;
      estadoNuevo: string;
      operadorId: string;
      claveIdempotencia?: string;
      datos: Record<string, unknown>;
    },
  ): Promise<string> {
    const { rows } = await cliente.query<{ id_movimiento: string }>(
      `INSERT INTO sigd_rut.movimiento_tramite (
         expediente_id,
         estado_anterior,
         evento,
         estado_nuevo,
         usuario_operador_id,
         clave_idempotencia,
         datos
       ) VALUES ($1::uuid, $2, $3, $4, $5::bigint, $6, $7::jsonb)
       RETURNING id_movimiento::text AS id_movimiento`,
      [
        params.expedienteId,
        params.estadoAnterior,
        params.evento,
        params.estadoNuevo,
        params.operadorId,
        params.claveIdempotencia ?? randomUUID(),
        JSON.stringify(params.datos),
      ],
    );
    return rows[0]?.id_movimiento ?? randomUUID();
  }

  private async avanzarMacroRutaDocHacia(
    cliente: PoolClient,
    params: {
      expedienteId: string;
      estadoActual: string;
      estadoObjetivo: 'EN_CALIFICACION' | 'DERIVADO' | 'EN_REVISION' | 'EN_FIRMA' | 'RESUELTO' | 'ARCHIVADO';
      actorId: string;
      areaId: string;
      areaOrigenId?: string | null;
      detalle: string;
      metadatos?: Record<string, unknown>;
      claveIdempotencia?: string;
    },
  ): Promise<string | null> {
    let estado = params.estadoActual;
    if (estado === 'PENDIENTE_PAGO') {
      throw new ConflictError({
        code: 'PAGO_PENDIENTE',
        message: 'El expediente mantiene orden de pago pendiente de confirmación en Tesorería.',
      });
    }

    const operadorId = resolverOperadorBigInt(params.actorId);
    let ultimoMovimientoId: string | null = null;

    if (params.estadoObjetivo === 'EN_CALIFICACION') {
      if (estado === 'REGISTRADO') {
        ultimoMovimientoId = await this.insertarMovimientoRutaDoc(cliente, {
          expedienteId: params.expedienteId,
          estadoAnterior: 'REGISTRADO',
          evento: 'RECEPCION',
          estadoNuevo: 'RECEPCIONADO',
          operadorId,
          datos: { areaId: params.areaId, detalle: 'Recepción en Mesa de Partes' },
        });
        estado = 'RECEPCIONADO';
      }
      if (estado === 'RECEPCIONADO') {
        ultimoMovimientoId = await this.insertarMovimientoRutaDoc(cliente, {
          expedienteId: params.expedienteId,
          estadoAnterior: 'RECEPCIONADO',
          evento: 'INICIAR_CALIFICACION',
          estadoNuevo: 'EN_CALIFICACION',
          operadorId,
          datos: { areaId: params.areaId, detalle: params.detalle },
        });
        estado = 'EN_CALIFICACION';
      }
      await cliente.query(
        `UPDATE sigd_tra.expediente SET estado = 'EN_CALIFICACION' WHERE expediente_id = $1::uuid`,
        [params.expedienteId],
      );
      return ultimoMovimientoId;
    }

    if (params.estadoObjetivo === 'DERIVADO') {
      if (estado === 'REGISTRADO') {
        await this.insertarMovimientoRutaDoc(cliente, {
          expedienteId: params.expedienteId,
          estadoAnterior: 'REGISTRADO',
          evento: 'RECEPCION',
          estadoNuevo: 'RECEPCIONADO',
          operadorId,
          datos: { areaId: params.areaOrigenId ?? AREA_DIR_ID, detalle: 'Recepción en Mesa de Partes' },
        });
        estado = 'RECEPCIONADO';
      }
      if (estado === 'RECEPCIONADO') {
        await this.insertarMovimientoRutaDoc(cliente, {
          expedienteId: params.expedienteId,
          estadoAnterior: 'RECEPCIONADO',
          evento: 'INICIAR_CALIFICACION',
          estadoNuevo: 'EN_CALIFICACION',
          operadorId,
          datos: { areaId: params.areaOrigenId ?? AREA_DIR_ID, detalle: 'Validación de requisitos en Mesa de Partes' },
        });
        estado = 'EN_CALIFICACION';
      }
      if (estado === 'DERIVADO') {
        await this.insertarMovimientoRutaDoc(cliente, {
          expedienteId: params.expedienteId,
          estadoAnterior: 'DERIVADO',
          evento: 'RECEPCION',
          estadoNuevo: 'EN_REVISION',
          operadorId,
          datos: { areaId: params.areaOrigenId ?? params.areaId, detalle: 'Recepción previa a derivación' },
        });
        estado = 'EN_REVISION';
      }

      ultimoMovimientoId = await this.insertarMovimientoRutaDoc(cliente, {
        expedienteId: params.expedienteId,
        estadoAnterior: estado,
        evento: 'DERIVACION',
        estadoNuevo: 'DERIVADO',
        operadorId,
        claveIdempotencia: params.claveIdempotencia,
        datos: {
          areaId: params.areaId,
          areaOrigenId: params.areaOrigenId ?? null,
          proveido: params.detalle,
          motivo: params.detalle,
          ...(params.metadatos ?? {}),
        },
      });
      await cliente.query(
        `UPDATE sigd_tra.expediente SET estado = 'DERIVADO', area_destino_id = $2::uuid WHERE expediente_id = $1::uuid`,
        [params.expedienteId, params.areaId],
      );
      return ultimoMovimientoId;
    }

    if (params.estadoObjetivo === 'EN_REVISION') {
      if (estado === 'DERIVADO') {
        ultimoMovimientoId = await this.insertarMovimientoRutaDoc(cliente, {
          expedienteId: params.expedienteId,
          estadoAnterior: 'DERIVADO',
          evento: 'RECEPCION',
          estadoNuevo: 'EN_REVISION',
          operadorId,
          datos: { areaId: params.areaId, detalle: params.detalle, ...(params.metadatos ?? {}) },
        });
        await cliente.query(
          `UPDATE sigd_tra.expediente SET estado = 'EN_REVISION', area_destino_id = $2::uuid WHERE expediente_id = $1::uuid`,
          [params.expedienteId, params.areaId],
        );
      }
      return ultimoMovimientoId;
    }

    if (params.estadoObjetivo === 'EN_FIRMA') {
      if (estado === 'DERIVADO') {
        await this.insertarMovimientoRutaDoc(cliente, {
          expedienteId: params.expedienteId,
          estadoAnterior: 'DERIVADO',
          evento: 'RECEPCION',
          estadoNuevo: 'EN_REVISION',
          operadorId,
          datos: { areaId: params.areaOrigenId ?? AREA_SDA_ID, detalle: 'Recepción previa a elevación a firma' },
        });
        estado = 'EN_REVISION';
      }
      if (estado === 'EN_REVISION') {
        ultimoMovimientoId = await this.insertarMovimientoRutaDoc(cliente, {
          expedienteId: params.expedienteId,
          estadoAnterior: 'EN_REVISION',
          evento: 'ENVIAR_A_FIRMA',
          estadoNuevo: 'EN_FIRMA',
          operadorId,
          datos: {
            areaId: params.areaId,
            areaOrigenId: params.areaOrigenId ?? AREA_SDA_ID,
            detalle: params.detalle,
            ...(params.metadatos ?? {}),
          },
        });
        await cliente.query(
          `UPDATE sigd_tra.expediente SET estado = 'EN_FIRMA', area_destino_id = $2::uuid WHERE expediente_id = $1::uuid`,
          [params.expedienteId, params.areaId],
        );
      }
      return ultimoMovimientoId;
    }

    if (params.estadoObjetivo === 'RESUELTO') {
      if (estado === 'DERIVADO') {
        await this.insertarMovimientoRutaDoc(cliente, {
          expedienteId: params.expedienteId,
          estadoAnterior: 'DERIVADO',
          evento: 'RECEPCION',
          estadoNuevo: 'EN_REVISION',
          operadorId,
          datos: { areaId: params.areaId, detalle: 'Recepción previa a resolución' },
        });
        estado = 'EN_REVISION';
      }
      if (estado === 'EN_REVISION') {
        await this.insertarMovimientoRutaDoc(cliente, {
          expedienteId: params.expedienteId,
          estadoAnterior: 'EN_REVISION',
          evento: 'ENVIAR_A_FIRMA',
          estadoNuevo: 'EN_FIRMA',
          operadorId,
          datos: { areaId: params.areaId, detalle: 'Pase a resolución formal' },
        });
        estado = 'EN_FIRMA';
      }
      if (estado === 'EN_FIRMA') {
        ultimoMovimientoId = await this.insertarMovimientoRutaDoc(cliente, {
          expedienteId: params.expedienteId,
          estadoAnterior: 'EN_FIRMA',
          evento: 'FIRMA',
          estadoNuevo: 'RESUELTO',
          operadorId,
          datos: { areaId: params.areaId, detalle: params.detalle, ...(params.metadatos ?? {}) },
        });
        await cliente.query(
          `UPDATE sigd_tra.expediente SET estado = 'RESUELTO' WHERE expediente_id = $1::uuid`,
          [params.expedienteId],
        );
      }
      return ultimoMovimientoId;
    }

    // estadoObjetivo === 'ARCHIVADO'
    if (estado === 'DERIVADO') {
      await this.insertarMovimientoRutaDoc(cliente, {
        expedienteId: params.expedienteId,
        estadoAnterior: 'DERIVADO',
        evento: 'RECEPCION',
        estadoNuevo: 'EN_REVISION',
        operadorId,
        datos: { areaId: params.areaId, detalle: 'Recepción previa a cierre' },
      });
      estado = 'EN_REVISION';
    }
    if (estado === 'EN_REVISION') {
      await this.insertarMovimientoRutaDoc(cliente, {
        expedienteId: params.expedienteId,
        estadoAnterior: 'EN_REVISION',
        evento: 'ENVIAR_A_FIRMA',
        estadoNuevo: 'EN_FIRMA',
        operadorId,
        datos: { areaId: params.areaId, detalle: 'Pase a emisión de cierre institucional' },
      });
      estado = 'EN_FIRMA';
    }
    if (estado === 'EN_FIRMA') {
      await this.insertarMovimientoRutaDoc(cliente, {
        expedienteId: params.expedienteId,
        estadoAnterior: 'EN_FIRMA',
        evento: 'FIRMA',
        estadoNuevo: 'RESUELTO',
        operadorId,
        datos: { areaId: params.areaId, detalle: 'Resolución previa a archivo definitivo' },
      });
      estado = 'RESUELTO';
    }
    if (estado === 'RESUELTO') {
      ultimoMovimientoId = await this.insertarMovimientoRutaDoc(cliente, {
        expedienteId: params.expedienteId,
        estadoAnterior: 'RESUELTO',
        evento: 'CIERRE',
        estadoNuevo: 'ARCHIVADO',
        operadorId,
        datos: { areaId: params.areaId, detalle: params.detalle, ...(params.metadatos ?? {}) },
      });
      await cliente.query(
        `UPDATE sigd_tra.expediente SET estado = 'ARCHIVADO' WHERE expediente_id = $1::uuid`,
        [params.expedienteId],
      );
    }
    return ultimoMovimientoId;
  }

  private async registrarDocumentoInstitucional(
    cliente: PoolClient,
    params: {
      expedienteId: string;
      documentoId: string;
      nombreArchivo: string;
      s3Key: string;
      sha256: string;
      tamanoBytes?: number;
      actorId: string;
      preferenciaTipo?: 'INF' | 'CERT' | 'RES';
    },
  ): Promise<void> {
    const configS3 = obtenerConfiguracionS3();
    const resTipo = await cliente.query<{ tipo_documental_id: string }>(
      `SELECT tipo_documental_id
         FROM sigd_doc.tipo_documento
        WHERE vigente = true
        ORDER BY CASE WHEN codigo IN ('INF', 'INFORME', 'CERT', 'CERTIFICADO', 'RD', 'RESOLUCION') THEN 0 ELSE 1 END, nombre ASC
        LIMIT 1`,
    );
    const tipoDocId = resTipo.rows[0]?.tipo_documental_id;
    if (!tipoDocId) return;

    await cliente.query(
      `INSERT INTO sigd_doc.documento_adjunto (
         documento_adjunto_id,
         expediente_tra_id,
         tipo_documental_id,
         nombre_archivo,
         s3_bucket,
         s3_key,
         sha256,
         tamano_bytes,
         mime_type,
         subido_por,
         id_requisito
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, 'application/pdf', $9::uuid, NULL
       ) ON CONFLICT (documento_adjunto_id) DO NOTHING`,
      [
        params.documentoId,
        params.expedienteId,
        tipoDocId,
        params.nombreArchivo,
        configS3.bucket,
        params.s3Key,
        params.sha256,
        params.tamanoBytes ?? 1024,
        params.actorId,
      ],
    );
  }

  private async marcarAtencionTecnicaWorkflow(
    cliente: PoolClient,
    params: {
      expedienteId: string;
      usuarioId: string;
      areaId: string;
      detalle: string;
      tipoInforme: string;
    },
  ): Promise<void> {
    await cliente.query(
      `UPDATE sigd_rut.workflow_instancia
          SET paso_actual = GREATEST(paso_actual, 4),
              historial_pasos = COALESCE(historial_pasos, '[]'::jsonb) || jsonb_build_array(
                jsonb_build_object(
                  'paso', 4,
                  'evento', 'ATENCION_TECNICA',
                  'tipoInforme', $4::text,
                  'usuarioId', $2::text,
                  'areaId', $3::text,
                  'detalle', $5::text,
                  'completadoEn', now()
                )
              )
        WHERE expediente_id = $1::uuid`,
      [params.expedienteId, params.usuarioId, params.areaId, params.tipoInforme, params.detalle],
    );
  }

  private async obtenerFlujoYValidarTransicion(
    db: DbClient,
    expedienteId: string,
    evento: EventoFlujoCertificado,
    actor: ActorRutaDoc,
  ): Promise<{
    flujo: FlujoCertificadoRegistro;
    estadoNuevo: EstadoFlujoCertificado;
    rolActor: string;
  }> {
    const rolActor = validarRolAutorizadoFlujoCertificado(evento, actor.roles);
    const flujo = await this.repo.obtenerPorExpedienteId(expedienteId, db);
    if (!flujo) {
      throw new NotFoundError({
        detail: 'El expediente no tiene un flujo de trámite certificado iniciado. Inícielo mediante POST /flujo-certificado/iniciar.',
      });
    }
    const estadoNuevo = obtenerSiguienteEstadoFlujoCertificado(flujo.estadoFlujo, evento);
    return { flujo, estadoNuevo, rolActor };
  }

  private construirRespuestaTransicion(
    expedienteId: string,
    evento: EventoFlujoCertificado,
    estadoFlujoAnterior: EstadoFlujoCertificado | null,
    flujo: FlujoCertificadoRegistro,
    historialRegistro: FlujoHistorialRegistro,
  ): ResultadoTransicionFlujo {
    return {
      ok: true,
      expedienteId,
      evento,
      estadoFlujoAnterior,
      estadoFlujoNuevo: flujo.estadoFlujo,
      estadoRutaDoc: historialRegistro.estadoRutaDocNuevo,
      flujo,
      historialRegistro,
    };
  }

  async obtenerEstadoYHistorial(
    expedienteId: string,
    actor: ActorRutaDoc,
  ): Promise<{
    ok: true;
    expedienteId: string;
    estadoRutaDoc: string;
    areaActualId: string;
    flujo: FlujoCertificadoRegistro | null;
    historial: FlujoHistorialRegistro[];
  }> {
    const exp = await this.cargarContextoExpediente(this.pool, expedienteId);
    const idPersonaActor = await this.resolverIdPersonaActor(this.pool, actor);
    const esTitular = Boolean(
      (idPersonaActor && idPersonaActor === exp.solicitanteId) ||
      actor.id === exp.idUsuarioCreador,
    );
    const esInstitucional = actor.roles.some((r) =>
      ['ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'MESA_PARTES', 'ESPECIALISTA'].includes(r.toUpperCase()),
    );

    if (actor.puedeVerExpediente) {
      const puede = await actor.puedeVerExpediente(expedienteId);
      if (!puede) {
        throw new ForbiddenError({ detail: 'No tiene autorización para consultar este expediente.' });
      }
    } else if (!esTitular && !esInstitucional) {
      throw new ForbiddenError({ detail: 'No tiene autorización para consultar este expediente.' });
    }

    const [flujo, historial] = await Promise.all([
      this.repo.obtenerPorExpedienteId(expedienteId, this.pool),
      this.repo.listarHistorial(expedienteId, this.pool),
    ]);

    return {
      ok: true,
      expedienteId,
      estadoRutaDoc: exp.estadoRutaDoc,
      areaActualId: exp.areaActualId,
      flujo,
      historial,
    };
  }

  // ===========================================================================
  // Paso 1: Usuario / Solicitante inicia solicitud de Certificado de Inglés
  // ===========================================================================
  async iniciarFlujo(
    expedienteId: string,
    datos: IniciarFlujoCertificadoDTO,
    actor: ActorRutaDoc,
  ): Promise<ResultadoTransicionFlujo> {
    const rolActor = validarRolAutorizadoFlujoCertificado('INICIAR_SOLICITUD', actor.roles);

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      const idPersonaActor = await this.resolverIdPersonaActor(cliente, actor);
      const esSoloCiudadano = actor.roles.every((r) => r.toUpperCase() === 'CIUDADANO');

      if (esSoloCiudadano) {
        const esTitular = Boolean(
          (idPersonaActor && idPersonaActor === exp.solicitanteId) ||
          actor.id === exp.idUsuarioCreador ||
          actor.id === exp.solicitanteId,
        );
        if (!esTitular) {
          throw new ForbiddenError({
            detail: 'Un ciudadano solo puede iniciar el flujo de sus propios expedientes.',
          });
        }
      }

      const existente = await this.repo.obtenerPorExpedienteId(expedienteId, cliente);
      if (existente) {
        throw new ConflictError({
          code: 'FLUJO_YA_INICIADO',
          message: 'El flujo de negocio para este expediente ya fue iniciado previamente.',
        });
      }

      const flujo = await this.repo.crearFlujo(
        {
          expedienteId,
          codigoProcedimiento: datos.codigo_procedimiento,
          nombreTramite: datos.nombre_tramite,
          canalEntrega: datos.canal_entrega,
          plazoRecojoDias: datos.plazo_recojo_dias,
        },
        cliente,
      );

      const estadoRutaDocNuevo = MAPEO_ESTADO_FLUJO_A_RUTADOC.SOLICITUD_INICIADA;
      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: null,
          evento: 'INICIAR_SOLICITUD',
          estadoNuevo: 'SOLICITUD_INICIADA',
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo,
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: exp.areaActualId || AREA_DIR_ID,
          areaDestinoId: AREA_DIR_ID,
          detalle: `Solicitud iniciada para ${datos.nombre_tramite} (${datos.codigo_procedimiento}) · Canal ${datos.canal_entrega}`,
          metadatos: {
            codigoProcedimiento: datos.codigo_procedimiento,
            canalEntrega: datos.canal_entrega,
          },
        },
        cliente,
      );

      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: 'FlujoCertificadoIniciado',
        payload: {
          identidad: { expediente_id: expedienteId, codigo_expediente: exp.codigoExpediente },
          contexto: { usuario_actor_id: actor.id, rol: rolActor },
          datos_especificos: {
            codigo_procedimiento: datos.codigo_procedimiento,
            nombre_tramite: datos.nombre_tramite,
            canal_entrega: datos.canal_entrega,
          },
        },
      });

      return this.construirRespuestaTransicion(expedienteId, 'INICIAR_SOLICITUD', null, flujo, historial);
    });
  }

  // ===========================================================================
  // Paso 2a: Mesa de Partes recepciona y valida requisitos
  // ===========================================================================
  async validarRequisitosMp(
    expedienteId: string,
    datos: ValidarRequisitosMpDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);
      this.asegurarCustodiaEnArea(actor, exp.areaActualId || AREA_DIR_ID, true);

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        'VALIDAR_REQUISITOS_MP',
        actor,
      );

      const elegibilidad = await evaluarElegibilidadDerivacion(cliente, expedienteId);
      if (!elegibilidad.requisitosConformes) {
        throw new ConflictError({
          code: 'REQUISITOS_DOCUMENTALES_PENDIENTES',
          message: 'El expediente cuenta con requisitos documentales obligatorios pendientes de validación.',
          detail: `Conformes: ${elegibilidad.totalRequisitosDocumentalesConformes}/${elegibilidad.totalRequisitosDocumentalesObligatorios}.`,
        });
      }

      const movimientoId = await this.avanzarMacroRutaDocHacia(cliente, {
        expedienteId,
        estadoActual: exp.estadoRutaDoc,
        estadoObjetivo: 'EN_CALIFICACION',
        actorId: actor.id,
        areaId: AREA_DIR_ID,
        detalle: datos.observaciones ?? 'Requisitos validados en Mesa de Partes',
      });

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          requisitosValidados: true,
          validadoMpPor: actor.id,
          validadoMpEn: new Date(),
        },
        cliente,
      );

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento: 'VALIDAR_REQUISITOS_MP',
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: exp.areaActualId || AREA_DIR_ID,
          areaDestinoId: AREA_DIR_ID,
          idMovimientoRutaDoc: movimientoId,
          detalle: datos.observaciones ?? 'Requisitos documentales validados por Mesa de Partes',
        },
        cliente,
      );

      return this.construirRespuestaTransicion(
        expedienteId,
        'VALIDAR_REQUISITOS_MP',
        flujo.estadoFlujo,
        flujoActualizado,
        historial,
      );
    });
  }

  // ===========================================================================
  // Paso 2b: Mesa de Partes deriva el expediente a Subdirección Académica (SDA)
  // ===========================================================================
  async derivarMesaPartesASda(
    expedienteId: string,
    datos: DerivarMesaPartesSdaDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);
      this.asegurarCustodiaEnArea(actor, exp.areaActualId || AREA_DIR_ID, true);

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        'DERIVAR_A_SUBDIRECCION',
        actor,
      );

      if (!datos.requisitos_validados) {
        throw new DomainError({
          code: 'REQUISITOS_NO_VALIDADOS',
          message: 'Mesa de Partes debe confirmar la validación de requisitos antes de derivar a Subdirección Académica.',
        });
      }

      const elegibilidad = await evaluarElegibilidadDerivacion(cliente, expedienteId);
      if (!elegibilidad.requisitosConformes) {
        throw new ConflictError({
          code: 'REQUISITOS_DOCUMENTALES_PENDIENTES',
          message: 'El expediente cuenta con requisitos documentales obligatorios pendientes de validación.',
        });
      }
      if (!elegibilidad.pagoConforme) {
        throw new ConflictError({
          code: 'PAGO_PENDIENTE',
          message: 'El expediente requiere pago confirmado en Tesorería antes de ser derivado a Subdirección Académica.',
        });
      }

      const areaDestinoId = datos.area_destino_id ?? AREA_SDA_ID;
      const enrutabilidad = await this.enrutabilidadSvc.evaluarEnrutabilidadAreas([areaDestinoId], cliente);
      const evalDestino = enrutabilidad.get(areaDestinoId);
      if (evalDestino) {
        if (!evalDestino.existe) {
          throw new NotFoundError({ detail: `El área destino ${areaDestinoId} no existe.` });
        }
        if (!evalDestino.vigente) {
          throw new DomainError({ code: 'DESTINO_INACTIVO', message: 'El área destino se encuentra inactiva.' });
        }
        if (!evalDestino.enrutable) {
          throw new DomainError({ code: 'AREA_NO_ENRUTABLE', message: 'El área destino no tiene receptores operativos habilitados.' });
        }
      }

      const movimientoId = await this.avanzarMacroRutaDocHacia(cliente, {
        expedienteId,
        estadoActual: exp.estadoRutaDoc,
        estadoObjetivo: 'DERIVADO',
        actorId: actor.id,
        areaId: areaDestinoId,
        areaOrigenId: exp.areaActualId || AREA_DIR_ID,
        detalle: datos.proveido,
        claveIdempotencia: datos.clave_idempotencia,
        metadatos: { flujoEstado: estadoNuevo },
      });

      await this.workflowSvc.avanzarPasoExpediente(
        expedienteId,
        actor.id,
        areaDestinoId,
        'DERIVACION',
        datos.proveido,
        cliente,
      ).catch(() => undefined);

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          requisitosValidados: true,
          validadoMpPor: flujo.validadoMpPor ?? actor.id,
          validadoMpEn: flujo.validadoMpEn ?? new Date(),
        },
        cliente,
      );

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento: 'DERIVAR_A_SUBDIRECCION',
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: exp.areaActualId || AREA_DIR_ID,
          areaDestinoId,
          idMovimientoRutaDoc: movimientoId,
          detalle: datos.proveido,
        },
        cliente,
      );

      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteDerivado',
        payload: {
          identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
          contexto: { usuario_actor_id: actor.id, area_origen_id: exp.areaActualId || AREA_DIR_ID, area_destino_id: areaDestinoId },
          datos_especificos: { motivo: datos.proveido, estado_flujo: estadoNuevo },
        },
      });

      return this.construirRespuestaTransicion(
        expedienteId,
        'DERIVAR_A_SUBDIRECCION',
        flujo.estadoFlujo,
        flujoActualizado,
        historial,
      );
    });
  }

  // ===========================================================================
  // Paso 3A: Subdirección Académica emite Memorándum al Centro de Idiomas
  // ===========================================================================
  async derivarSdaACentroIdiomas(
    expedienteId: string,
    datos: EmitirMemorandumCentroIdiomasDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        'EMITIR_MEMORANDUM_CENTRO_IDIOMAS',
        actor,
      );

      const areaSda = exp.areaActualId || AREA_SDA_ID;
      this.asegurarCustodiaEnArea(actor, areaSda);

      // Avanzar custodia formal de RutaDoc hacia el Centro de Idiomas (CI)
      const movimientoId = await this.avanzarMacroRutaDocHacia(cliente, {
        expedienteId,
        estadoActual: exp.estadoRutaDoc,
        estadoObjetivo: 'EN_REVISION',
        actorId: actor.id,
        areaId: AREA_CI_ID,
        detalle: `Memorándum ${datos.numero_memorandum} emitido hacia Centro de Idiomas: ${datos.proveido}`,
      });

      // Registrar documento oficial MEMORANDUM en el expediente (protegido con SAVEPOINT)
      try {
        await cliente.query('SAVEPOINT sp_memo_adjunto');
        await cliente.query(
          `INSERT INTO sigd_doc.documento_adjunto (
             documento_adjunto_id, expediente_tra_id, tipo_documental_id, nombre_archivo,
             s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por, creado_en
           ) VALUES (
             gen_random_uuid(), $1::uuid,
             COALESCE((SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE codigo = 'MEMORANDUM' LIMIT 1),
                      (SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE vigente = true LIMIT 1)),
             $2, 'sigd-local', $3, md5($3) || md5($2), 1024, 'application/pdf', '25504446',
             $4::uuid, NOW()
           ) ON CONFLICT DO NOTHING`,
          [expedienteId, `${datos.numero_memorandum}.pdf`, `expedientes/${expedienteId}/${datos.numero_memorandum}.pdf`, actor.id],
        );
        await cliente.query('RELEASE SAVEPOINT sp_memo_adjunto');
      } catch {
        await cliente.query('ROLLBACK TO SAVEPOINT sp_memo_adjunto').catch(() => undefined);
      }

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          derivadoEspecialistaPor: actor.id,
          derivadoEspecialistaEn: new Date(),
        },
        cliente,
      );

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento: 'EMITIR_MEMORANDUM_CENTRO_IDIOMAS',
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: areaSda,
          areaDestinoId: AREA_CI_ID,
          idMovimientoRutaDoc: movimientoId,
          detalle: `Memorándum ${datos.numero_memorandum}: ${datos.proveido}`,
          metadatos: {
            numeroMemorandum: datos.numero_memorandum,
            idioma: datos.idioma,
          },
        },
        cliente,
      );

      return this.construirRespuestaTransicion(
        expedienteId,
        'EMITIR_MEMORANDUM_CENTRO_IDIOMAS',
        flujo.estadoFlujo,
        flujoActualizado,
        historial,
      );
    });
  }

  // ===========================================================================
  // Paso 3B: Coordinador del Centro de Idiomas encarga al Especialista del Idioma
  // ===========================================================================
  async asignarEspecialistaIdioma(
    expedienteId: string,
    datos: AsignarEspecialistaIdiomaDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        'ASIGNAR_ESPECIALISTA_IDIOMA',
        actor,
      );

      let personaEspecialistaId = datos.especialista_persona_id;
      if (!personaEspecialistaId) {
        const resEsp = await cliente.query<{ id_persona: string | null }>(
          'SELECT id_persona::text AS id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid LIMIT 1',
          [datos.especialista_usuario_id],
        );
        personaEspecialistaId = resEsp.rows[0]?.id_persona ?? undefined;
        if (!personaEspecialistaId) {
          throw new NotFoundError({ message: 'No se encontró la persona vinculada al especialista del idioma indicado.' });
        }
      }

      await this.asignacionSvc.asignarExpediente(
        {
          expedienteId,
          idPersona: personaEspecialistaId,
          idUsuario: datos.especialista_usuario_id,
          motivo: `Asignación por Coordinación de Idiomas (${datos.idioma}): ${datos.motivo}`,
          asignadoPorUsuarioId: actor.id,
        },
        cliente,
      );

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          especialistaAsignadoUsuarioId: datos.especialista_usuario_id,
          especialistaAsignadoPersonaId: personaEspecialistaId,
          derivadoEspecialistaPor: actor.id,
          derivadoEspecialistaEn: new Date(),
        },
        cliente,
      );

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento: 'ASIGNAR_ESPECIALISTA_IDIOMA',
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: AREA_CI_ID,
          areaDestinoId: AREA_CI_ID,
          detalle: `Encargado a especialista de ${datos.idioma}: ${datos.motivo}`,
          metadatos: {
            especialistaUsuarioId: datos.especialista_usuario_id,
            idioma: datos.idioma,
          },
        },
        cliente,
      );

      return this.construirRespuestaTransicion(
        expedienteId,
        'ASIGNAR_ESPECIALISTA_IDIOMA',
        flujo.estadoFlujo,
        flujoActualizado,
        historial,
      );
    });
  }

  // ===========================================================================
  // Paso 3: Subdirección Académica (SDA) deriva al Especialista de Idiomas
  // ===========================================================================
  async derivarSdaAEspecialista(
    expedienteId: string,
    datos: DerivarSdaEspecialistaDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        'DERIVAR_A_ESPECIALISTA',
        actor,
      );

      const esSecretario = actor.roles.includes('SECRETARIO');
      const esDirector = actor.roles.includes('DIRECTOR');
      const areaSda = exp.areaActualId || AREA_SDA_ID;
      let tieneEncargatura = false;
      if (esDirector && !esSecretario) {
        tieneEncargatura = await this.verificarEncargaturaSda(cliente, actor.id, areaSda);
      }
      if (!esSecretario && !tieneEncargatura) {
        throw new ForbiddenError({
          code: 'SIN_FACULTAD_ASIGNACION',
          message: 'Solo la Secretaría de Subdirección Académica o Director con encargatura vigente en SDA puede derivar al especialista.',
        });
      }
      if (!tieneEncargatura) {
        this.asegurarCustodiaEnArea(actor, areaSda);
      }

      // Recepcionar formalmente en SDA si aún está en DERIVADO antes de asignar al especialista
      const movimientoId = await this.avanzarMacroRutaDocHacia(cliente, {
        expedienteId,
        estadoActual: exp.estadoRutaDoc,
        estadoObjetivo: 'EN_REVISION',
        actorId: actor.id,
        areaId: areaSda,
        detalle: `Recepción en Subdirección Académica y derivación a Especialista: ${datos.motivo}`,
      });

      let personaEspecialistaId = datos.especialista_persona_id;
      if (!personaEspecialistaId) {
        const resEsp = await cliente.query<{ id_persona: string | null }>(
          'SELECT id_persona::text AS id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid LIMIT 1',
          [datos.especialista_usuario_id],
        );
        personaEspecialistaId = resEsp.rows[0]?.id_persona ?? undefined;
        if (!personaEspecialistaId) {
          throw new NotFoundError({ message: 'No se encontró la persona vinculada al especialista indicado.' });
        }
      }

      await this.asignacionSvc.asignarExpediente(
        {
          expedienteId,
          idPersona: personaEspecialistaId,
          idUsuario: datos.especialista_usuario_id,
          motivo: datos.motivo,
          asignadoPorUsuarioId: actor.id,
        },
        cliente,
      );

      await this.workflowSvc.avanzarPasoExpediente(
        expedienteId,
        actor.id,
        areaSda,
        'ASIGNACION',
        datos.motivo,
        cliente,
      ).catch(() => undefined);

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          especialistaAsignadoUsuarioId: datos.especialista_usuario_id,
          especialistaAsignadoPersonaId: personaEspecialistaId,
          derivadoEspecialistaPor: actor.id,
          derivadoEspecialistaEn: new Date(),
        },
        cliente,
      );

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento: 'DERIVAR_A_ESPECIALISTA',
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: areaSda,
          areaDestinoId: areaSda,
          idMovimientoRutaDoc: movimientoId,
          detalle: datos.motivo,
          metadatos: {
            especialistaUsuarioId: datos.especialista_usuario_id,
            especialistaPersonaId: personaEspecialistaId,
          },
        },
        cliente,
      );

      return this.construirRespuestaTransicion(
        expedienteId,
        'DERIVAR_A_ESPECIALISTA',
        flujo.estadoFlujo,
        flujoActualizado,
        historial,
      );
    });
  }

  private async asegurarEspecialistaAsignado(
    cliente: PoolClient,
    expedienteId: string,
    flujo: FlujoCertificadoRegistro,
    actor: ActorRutaDoc,
  ): Promise<void> {
    this.asegurarCustodiaEnArea(actor, AREA_SDA_ID);
    const idPersonaActor = await this.resolverIdPersonaActor(cliente, actor);
    const coincideEnFlujo =
      flujo.especialistaAsignadoUsuarioId === actor.id ||
      (idPersonaActor !== null && flujo.especialistaAsignadoPersonaId === idPersonaActor);

    if (coincideEnFlujo) {
      return;
    }

    const asig = await this.asignacionSvc.obtenerAsignacionActiva(expedienteId, cliente);
    if (
      asig &&
      (asig.idUsuario === actor.id || (idPersonaActor !== null && asig.idPersona === idPersonaActor))
    ) {
      return;
    }

    throw new ForbiddenError({
      code: 'EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA',
      message: 'Solo el Especialista del Centro de Idiomas formalmente asignado al expediente puede ejecutar esta acción.',
    });
  }

  // ===========================================================================
  // Paso 4.1: Especialista programa la evaluación
  // ===========================================================================
  async programarEvaluacion(
    expedienteId: string,
    datos: ProgramarEvaluacionDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        'PROGRAMAR_EVALUACION',
        actor,
      );
      await this.asegurarEspecialistaAsignado(cliente, expedienteId, flujo, actor);

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          fechaEvaluacion: datos.fecha_evaluacion,
          modalidadEvaluacion: datos.modalidad,
          lugarEnlaceEvaluacion: datos.lugar_enlace,
          evaluacionObservaciones: datos.observaciones ?? null,
          evaluacionProgramadaPor: actor.id,
          evaluacionProgramadaEn: new Date(),
        },
        cliente,
      );

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento: 'PROGRAMAR_EVALUACION',
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: AREA_SDA_ID,
          areaDestinoId: AREA_SDA_ID,
          detalle: `Evaluación programada (${datos.modalidad}) para ${datos.fecha_evaluacion} en ${datos.lugar_enlace}`,
          metadatos: {
            fechaEvaluacion: datos.fecha_evaluacion,
            modalidad: datos.modalidad,
            lugarEnlace: datos.lugar_enlace,
          },
        },
        cliente,
      );

      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: 'EvaluacionCertificadoProgramada',
        payload: {
          identidad: { expediente_id: expedienteId, codigo_expediente: exp.codigoExpediente },
          contexto: { usuario_actor_id: actor.id, area_id: AREA_SDA_ID },
          datos_especificos: {
            fecha_evaluacion: datos.fecha_evaluacion,
            modalidad: datos.modalidad,
            lugar_enlace: datos.lugar_enlace,
          },
        },
      });

      return this.construirRespuestaTransicion(
        expedienteId,
        'PROGRAMAR_EVALUACION',
        flujo.estadoFlujo,
        flujoActualizado,
        historial,
      );
    });
  }

  // ===========================================================================
  // Paso 4.2: Especialista califica al solicitante o registra inasistencia (NSP)
  // ===========================================================================
  async calificarEvaluacion(
    expedienteId: string,
    datos: CalificarEvaluacionDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    const evento: EventoFlujoCertificado = datos.asistio
      ? 'CALIFICAR_SOLICITANTE'
      : 'REGISTRAR_INASISTENCIA';

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        evento,
        actor,
      );
      await this.asegurarEspecialistaAsignado(cliente, expedienteId, flujo, actor);

      let resultadoEvaluacion: ResultadoEvaluacion;
      if (!datos.asistio) {
        resultadoEvaluacion = 'NSP';
      } else if (datos.resultado) {
        resultadoEvaluacion = datos.resultado;
      } else {
        const nota = Number(datos.nota ?? 0);
        resultadoEvaluacion = nota <= 20 ? (nota >= 13 ? 'APROBADO' : 'DESAPROBADO') : (nota >= 70 ? 'APROBADO' : 'DESAPROBADO');
      }

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          asistenciaEvaluacion: datos.asistio ? 'ASISTIO' : 'NO_SE_PRESENTO',
          notaEvaluacion: datos.asistio ? (datos.nota ?? null) : null,
          nivelMcer: datos.asistio ? (datos.nivel_mcer ?? null) : null,
          resultadoEvaluacion,
          calificacionObservaciones: datos.observaciones ?? null,
          calificadoPor: actor.id,
          calificadoEn: new Date(),
        },
        cliente,
      );

      const detalle = datos.asistio
        ? `Calificación registrada: nota ${datos.nota}${datos.nivel_mcer ? `, nivel ${datos.nivel_mcer}` : ''} (${resultadoEvaluacion})`
        : 'Inasistencia registrada: el solicitante no se presentó (NSP) a la evaluación programada';

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento,
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: AREA_SDA_ID,
          areaDestinoId: AREA_SDA_ID,
          detalle,
          metadatos: {
            asistio: datos.asistio,
            nota: datos.nota ?? null,
            nivelMcer: datos.nivel_mcer ?? null,
            resultadoEvaluacion,
          },
        },
        cliente,
      );

      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: datos.asistio ? 'EvaluacionCertificadoCalificada' : 'EvaluacionCertificadoInasistenciaNsp',
        payload: {
          identidad: { expediente_id: expedienteId, codigo_expediente: exp.codigoExpediente },
          contexto: { usuario_actor_id: actor.id, area_id: AREA_SDA_ID },
          datos_especificos: {
            asistio: datos.asistio,
            nota: datos.nota ?? null,
            nivel_mcer: datos.nivel_mcer ?? null,
            resultado: resultadoEvaluacion,
          },
        },
      });

      return this.construirRespuestaTransicion(expedienteId, evento, flujo.estadoFlujo, flujoActualizado, historial);
    });
  }

  // ===========================================================================
  // Paso 4.3: Especialista emite informe (Resultados o NSP) y devuelve a SDA
  // ===========================================================================
  async emitirInformeEspecialista(
    expedienteId: string,
    datos: EmitirInformeEspecialistaDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);

      const flujoExistente = await this.repo.obtenerPorExpedienteId(expedienteId, cliente);
      if (!flujoExistente) {
        throw new NotFoundError({ detail: 'El expediente no tiene un flujo certificado iniciado.' });
      }

      const esCasoNsp =
        flujoExistente.estadoFlujo === 'INASISTENCIA_REGISTRADA' ||
        (flujoExistente.estadoFlujo === 'EVALUACION_PROGRAMADA' && datos.tipo_informe === 'INASISTENCIA_NSP');

      if (flujoExistente.estadoFlujo === 'EVALUACION_CALIFICADA' && datos.tipo_informe === 'INASISTENCIA_NSP') {
        throw new DomainError({
          code: 'TIPO_INFORME_INCOMPATIBLE',
          message: 'El solicitante asistió y fue calificado; no corresponde emitir un informe de inasistencia (NSP).',
        });
      }
      if (flujoExistente.estadoFlujo === 'INASISTENCIA_REGISTRADA' && datos.tipo_informe === 'RESULTADOS') {
        throw new DomainError({
          code: 'TIPO_INFORME_INCOMPATIBLE',
          message: 'Se registró inasistencia (NSP); debe emitir un informe de tipo INASISTENCIA_NSP.',
        });
      }

      const evento: EventoFlujoCertificado = esCasoNsp ? 'EMITIR_INFORME_NSP' : 'EMITIR_INFORME_RESULTADOS';
      const tipoInformeEfectivo = esCasoNsp ? 'INASISTENCIA_NSP' : 'RESULTADOS';

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        evento,
        actor,
      );
      await this.asegurarEspecialistaAsignado(cliente, expedienteId, flujo, actor);

      const documentoId = datos.documento_id ?? (datos.s3_key ? randomUUID() : null);
      if (documentoId && datos.s3_key && datos.sha256 && datos.nombre_archivo) {
        await this.registrarDocumentoInstitucional(cliente, {
          expedienteId,
          documentoId,
          nombreArchivo: datos.nombre_archivo,
          s3Key: datos.s3_key,
          sha256: datos.sha256,
          tamanoBytes: datos.tamano_bytes,
          actorId: actor.id,
          preferenciaTipo: 'INF',
        });
      }

      await this.marcarAtencionTecnicaWorkflow(cliente, {
        expedienteId,
        usuarioId: actor.id,
        areaId: AREA_SDA_ID,
        detalle: `${datos.numero_informe}: ${datos.resumen}`,
        tipoInforme: tipoInformeEfectivo,
      });

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          numeroInforme: datos.numero_informe,
          tipoInforme: tipoInformeEfectivo,
          informeResumen: datos.resumen,
          informeDocumentoId: documentoId,
          informeEmitidoPor: actor.id,
          informeEmitidoEn: new Date(),
          ...(esCasoNsp
            ? {
                asistenciaEvaluacion: 'NO_SE_PRESENTO',
                resultadoEvaluacion: 'NSP',
              }
            : {}),
        },
        cliente,
      );

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento,
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: AREA_SDA_ID,
          areaDestinoId: AREA_SDA_ID,
          detalle: `Informe ${datos.numero_informe} (${tipoInformeEfectivo}) devuelto a Subdirección Académica`,
          metadatos: {
            numeroInforme: datos.numero_informe,
            tipoInforme: tipoInformeEfectivo,
            documentoId,
          },
        },
        cliente,
      );

      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: 'InformeEspecialistaDevueltoSda',
        payload: {
          identidad: { expediente_id: expedienteId, codigo_expediente: exp.codigoExpediente },
          contexto: { usuario_actor_id: actor.id, area_id: AREA_SDA_ID },
          datos_especificos: {
            numero_informe: datos.numero_informe,
            tipo_informe: tipoInformeEfectivo,
            estado_flujo: estadoNuevo,
          },
        },
      });

      return this.construirRespuestaTransicion(expedienteId, evento, flujo.estadoFlujo, flujoActualizado, historial);
    });
  }

  // ===========================================================================
  // Paso 5a (Camino Feliz): Sub D. Acad. emite el certificado y estampa su firma
  // ===========================================================================
  async emitirCertificadoSda(
    expedienteId: string,
    datos: EmitirCertificadoSdaDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);
      this.asegurarCustodiaEnArea(actor, AREA_SDA_ID);

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        'EMITIR_Y_FIRMAR_CERTIFICADO_SDA',
        actor,
      );

      if (flujo.resultadoEvaluacion && flujo.resultadoEvaluacion !== 'APROBADO') {
        throw new DomainError({
          code: 'RESULTADO_NO_APROBATORIO',
          message: `No se puede emitir certificado cuando el resultado de evaluación es '${flujo.resultadoEvaluacion}'.`,
        });
      }

      const certDocId = datos.documento_certificado_id ?? (datos.s3_key ? randomUUID() : null);
      if (certDocId && datos.s3_key && datos.sha256 && datos.nombre_archivo) {
        await this.registrarDocumentoInstitucional(cliente, {
          expedienteId,
          documentoId: certDocId,
          nombreArchivo: datos.nombre_archivo,
          s3Key: datos.s3_key,
          sha256: datos.sha256,
          tamanoBytes: datos.tamano_bytes,
          actorId: actor.id,
          preferenciaTipo: 'CERT',
        });
      }

      const movimientoId = await this.avanzarMacroRutaDocHacia(cliente, {
        expedienteId,
        estadoActual: exp.estadoRutaDoc,
        estadoObjetivo: 'EN_FIRMA',
        actorId: actor.id,
        areaId: AREA_DIR_ID,
        areaOrigenId: AREA_SDA_ID,
        detalle: `Certificado ${datos.codigo_certificado} emitido y firmado por SDA; elevado a Dirección General`,
        metadatos: {
          codigoCertificado: datos.codigo_certificado,
          selloFirmaSda: datos.sello_firma_sda,
          resultadoResumen: datos.resultado_resumen,
        },
      });

      await this.workflowSvc.avanzarPasoExpediente(
        expedienteId,
        actor.id,
        AREA_DIR_ID,
        'ENVIAR_A_FIRMA',
        datos.resultado_resumen,
        cliente,
      ).catch(() => undefined);

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          codigoCertificado: datos.codigo_certificado,
          selloFirmaSda: datos.sello_firma_sda,
          certificadoDocumentoId: certDocId,
          certificadoEmitidoPor: actor.id,
          certificadoEmitidoEn: new Date(),
        },
        cliente,
      );

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento: 'EMITIR_Y_FIRMAR_CERTIFICADO_SDA',
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: AREA_SDA_ID,
          areaDestinoId: AREA_DIR_ID,
          idMovimientoRutaDoc: movimientoId,
          detalle: `Certificado ${datos.codigo_certificado} emitido con firma SDA y elevado a Dirección General`,
          metadatos: {
            codigoCertificado: datos.codigo_certificado,
            certificadoDocumentoId: certDocId,
          },
        },
        cliente,
      );

      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteEnviadoAFirma',
        payload: {
          identidad: { expediente_id: expedienteId, movimiento_id: movimientoId },
          contexto: { usuario_actor_id: actor.id, area_contexto_id: AREA_SDA_ID, area_destino_id: AREA_DIR_ID },
          datos_especificos: {
            codigo_certificado: datos.codigo_certificado,
            resultado_resumen: datos.resultado_resumen,
          },
        },
      });

      return this.construirRespuestaTransicion(
        expedienteId,
        'EMITIR_Y_FIRMAR_CERTIFICADO_SDA',
        flujo.estadoFlujo,
        flujoActualizado,
        historial,
      );
    });
  }

  // ===========================================================================
  // Paso 5b (Excepción NSP): Sub D. Acad. cierra como IMPROCEDENTE / ARCHIVADO_POR_INASISTENCIA
  // ===========================================================================
  async cerrarPorInasistenciaSda(
    expedienteId: string,
    datos: CerrarInasistenciaSdaDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    const evento: EventoFlujoCertificado = datos.solo_improcedente
      ? 'DECLARAR_IMPROCEDENTE_NSP'
      : 'CERRAR_POR_INASISTENCIA';

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);
      this.asegurarCustodiaEnArea(actor, exp.areaActualId || AREA_SDA_ID);

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        evento,
        actor,
      );

      if (flujo.resultadoEvaluacion !== 'NSP' && flujo.tipoInforme !== 'INASISTENCIA_NSP') {
        throw new DomainError({
          code: 'CIERRE_NSP_NO_APLICA',
          message: 'Solo se puede cerrar por inasistencia cuando el expediente registra informe NSP.',
        });
      }

      const objetivoRutaDoc = datos.solo_improcedente ? 'RESUELTO' : 'ARCHIVADO';
      const movimientoId = await this.avanzarMacroRutaDocHacia(cliente, {
        expedienteId,
        estadoActual: exp.estadoRutaDoc,
        estadoObjetivo: objetivoRutaDoc,
        actorId: actor.id,
        areaId: AREA_SDA_ID,
        detalle: datos.motivo_improcedencia,
        metadatos: { causal: 'INASISTENCIA_NSP', estadoFlujo: estadoNuevo },
      });

      if (!datos.solo_improcedente) {
        await this.workflowSvc.avanzarPasoExpediente(
          expedienteId,
          actor.id,
          AREA_SDA_ID,
          'CIERRE',
          datos.motivo_improcedencia,
          cliente,
        ).catch(() => undefined);
      }

      const custodia = datos.solo_improcedente
        ? null
        : {
            estante: datos.estante,
            balda: datos.balda,
            caja: datos.caja,
            causal: 'INASISTENCIA_NSP',
          };

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          documentoValido: false,
          descargaHabilitada: false,
          enCustodia: !datos.solo_improcedente,
          custodiaUbicacion: custodia,
          motivoCierre: datos.motivo_improcedencia,
          notificadoEn: new Date(),
          finalizadoEn: datos.solo_improcedente ? null : new Date(),
        },
        cliente,
      );

      let historial: FlujoHistorialRegistro;
      if (!datos.solo_improcedente && flujo.estadoFlujo === 'INFORME_NSP_DEVUELTO_SUBDIRECCION') {
        await this.repo.registrarHistorial(
          {
            expedienteId,
            estadoAnterior: flujo.estadoFlujo,
            evento: 'DECLARAR_IMPROCEDENTE_NSP',
            estadoNuevo: 'IMPROCEDENTE',
            estadoRutaDocAnterior: exp.estadoRutaDoc,
            estadoRutaDocNuevo: 'RESUELTO',
            rolActor,
            usuarioActorId: actor.id,
            areaOrigenId: AREA_SDA_ID,
            areaDestinoId: AREA_SDA_ID,
            idMovimientoRutaDoc: movimientoId,
            detalle: datos.motivo_improcedencia,
          },
          cliente,
        );
        historial = await this.repo.registrarHistorial(
          {
            expedienteId,
            estadoAnterior: 'IMPROCEDENTE',
            evento: 'CERRAR_POR_INASISTENCIA',
            estadoNuevo: 'ARCHIVADO_POR_INASISTENCIA',
            estadoRutaDocAnterior: 'RESUELTO',
            estadoRutaDocNuevo: 'ARCHIVADO',
            rolActor,
            usuarioActorId: actor.id,
            areaOrigenId: AREA_SDA_ID,
            areaDestinoId: AREA_SDA_ID,
            idMovimientoRutaDoc: movimientoId,
            detalle: `Expediente cerrado definitivamente como IMPROCEDENTE / ARCHIVADO_POR_INASISTENCIA`,
            metadatos: { custodia },
          },
          cliente,
        );
      } else {
        historial = await this.repo.registrarHistorial(
          {
            expedienteId,
            estadoAnterior: flujo.estadoFlujo,
            evento,
            estadoNuevo,
            estadoRutaDocAnterior: exp.estadoRutaDoc,
            estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
            rolActor,
            usuarioActorId: actor.id,
            areaOrigenId: AREA_SDA_ID,
            areaDestinoId: AREA_SDA_ID,
            idMovimientoRutaDoc: movimientoId,
            detalle: datos.motivo_improcedencia,
            metadatos: custodia ? { custodia } : {},
          },
          cliente,
        );
      }

      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteAtendido',
        payload: {
          cut: exp.codigoExpediente,
          persona_id: exp.solicitanteId,
          expediente_id: expedienteId,
          movimiento_id: movimientoId,
          asunto: `Improcedencia por Inasistencia (NSP): ${exp.codigoExpediente}`,
          tipo_acto: 'RESOLUCION_IMPROCEDENCIA',
          subtipo: estadoNuevo,
          resultado_resumen: datos.motivo_improcedencia,
          identidad: {
            expediente_id: expedienteId,
            codigo_expediente: exp.codigoExpediente,
            persona_id: exp.solicitanteId,
          },
        },
      });

      return this.construirRespuestaTransicion(expedienteId, evento, flujo.estadoFlujo, flujoActualizado, historial);
    });
  }

  private async resolverEvidenciaFirmaDigital(
    cliente: PoolClient,
    params: {
      expedienteId: string;
      datos: VisarFirmarDireccionDTO;
      flujo: FlujoCertificadoRegistro;
      actorId: string;
    },
  ): Promise<{ documentoId: string | null; cvd: string; sha256: string; s3Key: string | null }> {
    // 1. Verificar si el documento especificado es un recaudo del ciudadano (prohibido)
    if (params.datos.documento_firmado_id) {
      const resRecaudo = await cliente.query<{ id_requisito: string | null; s3_key: string }>(
        `SELECT id_requisito, s3_key
           FROM sigd_doc.documento_adjunto
          WHERE documento_adjunto_id = $1::uuid
          LIMIT 1`,
        [params.datos.documento_firmado_id],
      );
      if (resRecaudo.rows.length > 0) {
        const doc = resRecaudo.rows[0];
        if (doc.id_requisito !== null || doc.s3_key.startsWith('expedientes/')) {
          throw new DomainError({
            code: 'DOCUMENTO_NO_ES_ACTO_RESOLUTIVO',
            message: 'El documento indicado corresponde a un recaudo de entrada del solicitante y no a un certificado institucional.',
          });
        }
      }
    }

    // 2. Buscar evidencia criptográfica previa en sigd_doc.firma_digital_documento
    const resFirma = await cliente.query<{
      documento_id: string;
      cvd: string;
      sha256_firmado: string;
      s3_key: string | null;
    }>(
      `SELECT f.documento_id::text AS documento_id, f.cvd, f.sha256_firmado, COALESCE(f.s3_key, a.s3_key) AS s3_key
         FROM sigd_doc.firma_digital_documento f
         JOIN sigd_doc.documento_adjunto a ON a.documento_adjunto_id = f.documento_id
        WHERE (a.expediente_tra_id = $1::uuid OR a.expediente_id = $1::uuid)
          AND f.estado = 'FIRMADO_DIGITALMENTE'
          AND a.id_requisito IS NULL
          AND NOT (a.s3_key LIKE 'expedientes/%')
        ORDER BY f.fecha_registro DESC
        LIMIT 1`,
      [params.expedienteId],
    );

    if (resFirma.rows.length > 0) {
      const f = resFirma.rows[0];
      return {
        documentoId: f.documento_id,
        cvd: f.cvd,
        sha256: f.sha256_firmado.trim(),
        s3Key: f.s3_key,
      };
    }

    // 3. O aceptar firma digital declarada con CVD + SHA-256 válidos y registrarla atómicamente
    if (params.datos.cvd && params.datos.sha256_firmado) {
      if (params.datos.s3_key && params.datos.s3_key.startsWith('expedientes/')) {
        throw new DomainError({
          code: 'DOCUMENTO_NO_ES_ACTO_RESOLUTIVO',
          message: 'La ruta S3 indicada corresponde a un recaudo ciudadano y no a un certificado institucional.',
        });
      }

      const documentoId =
        params.datos.documento_firmado_id ??
        params.flujo.certificadoDocumentoId ??
        (params.datos.s3_key ? randomUUID() : null);
      const s3Key =
        params.datos.s3_key ??
        (documentoId ? `certificados/2026/${documentoId}.pdf` : null);

      if (documentoId && s3Key) {
        await this.registrarDocumentoInstitucional(cliente, {
          expedienteId: params.expedienteId,
          documentoId,
          nombreArchivo: params.datos.nombre_archivo ?? `Certificado_${params.flujo.codigoCertificado ?? params.expedienteId}.pdf`,
          s3Key,
          sha256: params.datos.sha256_firmado,
          actorId: params.actorId,
          preferenciaTipo: 'CERT',
        });

        const configS3 = obtenerConfiguracionS3();
        await cliente.query(
          `INSERT INTO sigd_doc.firma_digital_documento (
             documento_id, cvd, sha256_firmado, firmante, fecha_sello_tsa,
             s3_bucket, s3_key, estado, cuenta_usuario_id, proveedor_firma
           ) VALUES (
             $1::uuid, $2, $3, 'Dirección General', now(),
             $4, $5, 'FIRMADO_DIGITALMENTE', $6::uuid, 'DNIE_CANONICO'
           ) ON CONFLICT (documento_id) DO NOTHING`,
          [documentoId, params.datos.cvd, params.datos.sha256_firmado, configS3.bucket, s3Key, params.actorId],
        );
      }

      return {
        documentoId,
        cvd: params.datos.cvd,
        sha256: params.datos.sha256_firmado,
        s3Key,
      };
    }

    throw new ConflictError({
      code: 'EVIDENCIA_FIRMA_REQUERIDA',
      message: 'Se requiere evidencia de Firma Digital válida (CVD y SHA-256 o firma previa en DocuCore) para finalizar la emisión.',
    });
  }

  // ===========================================================================
  // Paso 6: Dirección General da Visto Bueno (V/B) + Firma Digital
  //         Canal Digital -> ATENDIDO_NOTIFICADO (habilita descarga PDF)
  //         Canal Presencial -> LISTO_PARA_ENTREGA (con plazo límite ej. 30 días)
  // ===========================================================================
  async visarYFirmarDireccion(
    expedienteId: string,
    datos: VisarFirmarDireccionDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    if (!datos.visto_bueno) {
      throw new DomainError({
        code: 'VISTO_BUENO_REQUERIDO',
        message: 'La Dirección General debe otorgar el Visto Bueno (V/B) antes de estampar la Firma Digital.',
      });
    }

    // Validar facultad resolutiva de DIRECTOR (sin permitir bypass de ADMINISTRADOR)
    const rolesNoAdmin = actor.roles.filter((r) => !['ADMINISTRADOR', 'SUPERADMINISTRADOR'].includes(r));
    const facultad = await verificarFacultadFirma(this.pool, actor.id, rolesNoAdmin);
    if (!facultad.puedeFirmar || !actor.roles.includes('DIRECTOR')) {
      throw new ForbiddenError({
        code: 'SIN_FACULTAD_RESOLUTIVA',
        message: 'Solo la Dirección General (rol DIRECTOR con facultad de firma) puede otorgar V/B y Firma Digital.',
      });
    }

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);
      this.asegurarCustodiaEnArea(actor, AREA_DIR_ID);

      const flujoPrevio = await this.repo.obtenerPorExpedienteId(expedienteId, cliente);
      if (!flujoPrevio) {
        throw new NotFoundError({ detail: 'El expediente no tiene flujo certificado iniciado.' });
      }

      const canalEfectivo: CanalEntregaCertificado = datos.canal_entrega ?? flujoPrevio.canalEntrega;
      const evento: EventoFlujoCertificado =
        canalEfectivo === 'DIGITAL'
          ? 'VISAR_Y_FIRMAR_DIRECCION_DIGITAL'
          : 'VISAR_Y_FIRMAR_DIRECCION_PRESENCIAL';

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        evento,
        actor,
      );

      const evidenciaFirma = await this.resolverEvidenciaFirmaDigital(cliente, {
        expedienteId,
        datos,
        flujo,
        actorId: actor.id,
      });

      const movimientoId = await this.avanzarMacroRutaDocHacia(cliente, {
        expedienteId,
        estadoActual: exp.estadoRutaDoc,
        estadoObjetivo: 'RESUELTO',
        actorId: actor.id,
        areaId: AREA_DIR_ID,
        detalle: datos.resultado_resumen,
        metadatos: {
          vistoBueno: true,
          cvd: evidenciaFirma.cvd,
          canalEntrega: canalEfectivo,
          estadoFlujo: estadoNuevo,
        },
      });

      await this.workflowSvc.avanzarPasoExpediente(
        expedienteId,
        actor.id,
        AREA_DIR_ID,
        'FIRMA',
        datos.resultado_resumen,
        cliente,
      ).catch(() => undefined);

      const ahora = new Date();
      const plazoDias = datos.plazo_recojo_dias ?? flujo.plazoRecojoDias ?? 30;
      const fechaLimiteRecojo =
        canalEfectivo === 'PRESENCIAL' ? new Date(ahora.getTime() + plazoDias * 86_400_000) : null;
      const esDigital = canalEfectivo === 'DIGITAL';

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          canalEntrega: canalEfectivo,
          vistoBuenoDireccion: true,
          vistoBuenoPor: actor.id,
          vistoBuenoEn: ahora,
          firmaDigitalCvd: evidenciaFirma.cvd,
          firmaDigitalSha256: evidenciaFirma.sha256,
          firmaDigitalDocumentoId: evidenciaFirma.documentoId,
          firmaDigitalS3Key: evidenciaFirma.s3Key,
          firmadoDigitalPor: actor.id,
          firmadoDigitalEn: ahora,
          documentoValido: true,
          descargaHabilitada: esDigital,
          notificadoEn: ahora,
          plazoRecojoDias: plazoDias,
          fechaLimiteRecojo,
          finalizadoEn: esDigital ? ahora : null,
        },
        cliente,
      );

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento,
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: AREA_DIR_ID,
          areaDestinoId: AREA_DIR_ID,
          idMovimientoRutaDoc: movimientoId,
          detalle: esDigital
            ? `V/B y Firma Digital completados (CVD: ${evidenciaFirma.cvd}). Canal Digital: descarga habilitada.`
            : `V/B y Firma Digital completados (CVD: ${evidenciaFirma.cvd}). Canal Presencial: listo para entrega hasta ${fechaLimiteRecojo?.toISOString()}.`,
          metadatos: {
            vistoBueno: true,
            cvd: evidenciaFirma.cvd,
            sha256: evidenciaFirma.sha256,
            canalEntrega: canalEfectivo,
            descargaHabilitada: esDigital,
            fechaLimiteRecojo: fechaLimiteRecojo?.toISOString() ?? null,
          },
        },
        cliente,
      );

      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteAtendido',
        payload: {
          cut: exp.codigoExpediente,
          persona_id: exp.solicitanteId,
          expediente_id: expedienteId,
          movimiento_id: movimientoId,
          documento_id: evidenciaFirma.documentoId,
          cvd: evidenciaFirma.cvd,
          sha256: evidenciaFirma.sha256,
          asunto: esDigital
            ? `Certificado Disponible para Descarga: ${exp.codigoExpediente}`
            : `Certificado Listo para Recojo Presencial: ${exp.codigoExpediente}`,
          tipo_acto: 'CERTIFICADO_OFICIAL',
          subtipo: estadoNuevo,
          canal_entrega: canalEfectivo,
          descarga_habilitada: esDigital,
          fecha_limite_recojo: fechaLimiteRecojo?.toISOString() ?? null,
          resultado_resumen: datos.resultado_resumen,
          documento_url: evidenciaFirma.s3Key,
          identidad: {
            expediente_id: expedienteId,
            movimiento_id: movimientoId,
            codigo_expediente: exp.codigoExpediente,
            persona_id: exp.solicitanteId,
          },
          contexto: { usuario_actor_id: actor.id, area_contexto_id: AREA_DIR_ID },
        },
      });

      return this.construirRespuestaTransicion(expedienteId, evento, flujo.estadoFlujo, flujoActualizado, historial);
    });
  }

  // ===========================================================================
  // Canal Presencial: Confirmación de entrega física al solicitante
  // ===========================================================================
  async confirmarEntregaPresencial(
    expedienteId: string,
    datos: ConfirmarEntregaPresencialDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        'CONFIRMAR_ENTREGA_PRESENCIAL',
        actor,
      );

      const ahora = new Date();
      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          fechaEntregaPresencial: ahora,
          entregadoADni: datos.dni_receptor,
          entregadoANombre: datos.nombre_receptor,
          descargaHabilitada: true,
          documentoValido: true,
          finalizadoEn: ahora,
        },
        cliente,
      );

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento: 'CONFIRMAR_ENTREGA_PRESENCIAL',
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: exp.areaActualId || AREA_DIR_ID,
          areaDestinoId: exp.areaActualId || AREA_DIR_ID,
          detalle: `Certificado entregado presencialmente a ${datos.nombre_receptor} (DNI ${datos.dni_receptor})`,
          metadatos: {
            dniReceptor: datos.dni_receptor,
            nombreReceptor: datos.nombre_receptor,
            observaciones: datos.observaciones ?? null,
          },
        },
        cliente,
      );

      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: 'CertificadoEntregadoPresencialmente',
        payload: {
          identidad: { expediente_id: expedienteId, codigo_expediente: exp.codigoExpediente },
          contexto: { usuario_actor_id: actor.id },
          datos_especificos: { dni_receptor: datos.dni_receptor, nombre_receptor: datos.nombre_receptor },
        },
      });

      // Despachar notificación fehaciente por correo al solicitante
      try {
        const solRes = await cliente.query<{ correo: string | null }>(
          `SELECT COALESCE(pn.correo, cu.correo) AS correo
             FROM sigd_tra.expediente e
             JOIN sigd_auth.persona p ON p.id_persona = e.solicitante_id
             LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
             LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_persona = p.id_persona
            WHERE e.expediente_id = $1::uuid LIMIT 1`,
          [expedienteId],
        );
        const correo = solRes.rows[0]?.correo;
        if (correo && correo.includes('@')) {
          const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
          void notificadorInstitucional.notificarEntregaCertificado({
            correo,
            nombreSolicitante: datos.nombre_receptor || 'Estudiante',
            cut: exp.codigoExpediente,
            denominacionTupa: 'Certificado de Inglés',
            cvd: flujo.firmaDigitalCvd ?? undefined,
            trackingUrl: `${frontendBase}/consulta/${encodeURIComponent(exp.codigoExpediente)}`,
          }).catch((e) => console.warn('Aviso: no se pudo enviar correo de entrega:', e));
        }
      } catch {
        // Ignorar fallo auxiliar
      }

      return this.construirRespuestaTransicion(
        expedienteId,
        'CONFIRMAR_ENTREGA_PRESENCIAL',
        flujo.estadoFlujo,
        flujoActualizado,
        historial,
      );
    });
  }

  // ===========================================================================
  // Excepción Canal Presencial: Paso a ARCHIVADO_NO_RECOGIDO (en custodia)
  // tras vencer plazo límite sin invalidar el documento
  // ===========================================================================
  async archivarPorNoRecojo(
    expedienteId: string,
    datos: ArchivarNoRecojoDTO,
    actor: ActorRutaDoc,
    contextoOperacion: 'INSTITUCIONAL' | 'PERSONAL',
  ): Promise<ResultadoTransicionFlujo> {
    this.asegurarContextoInstitucional(contextoOperacion);

    return this.ejecutarEnTransaccion(expedienteId, async (cliente) => {
      const exp = await this.cargarContextoExpediente(cliente, expedienteId);
      await this.asegurarNoAutoatencion(cliente, actor, exp.solicitanteId);

      const { flujo, estadoNuevo, rolActor } = await this.obtenerFlujoYValidarTransicion(
        cliente,
        expedienteId,
        'ARCHIVAR_POR_NO_RECOJO',
        actor,
      );

      const fechaEvaluacion = datos.fecha_evaluacion ? new Date(datos.fecha_evaluacion) : new Date();
      if (flujo.fechaLimiteRecojo) {
        const fechaLimite = new Date(flujo.fechaLimiteRecojo);
        if (fechaEvaluacion.getTime() < fechaLimite.getTime()) {
          throw new DomainError({
            code: 'PLAZO_RECOJO_VIGENTE',
            message: `El plazo de recojo presencial (${flujo.plazoRecojoDias} días, límite ${flujo.fechaLimiteRecojo}) aún no ha vencido.`,
          });
        }
      }

      const custodiaUbicacion = {
        estante: datos.estante,
        balda: datos.balda,
        caja: datos.caja,
        observaciones: datos.observaciones ?? null,
        causal: 'NO_RECOJO_PLAZO_VENCIDO',
        documentoValidoPreservado: true,
      };

      const movimientoId = await this.avanzarMacroRutaDocHacia(cliente, {
        expedienteId,
        estadoActual: exp.estadoRutaDoc,
        estadoObjetivo: 'ARCHIVADO',
        actorId: actor.id,
        areaId: exp.areaActualId || AREA_DIR_ID,
        detalle: `Archivado en custodia por no recojo en plazo límite (${flujo.plazoRecojoDias} días). Documento sigue siendo válido.`,
        metadatos: { custodiaUbicacion, documentoValido: true },
      });

      await this.workflowSvc.avanzarPasoExpediente(
        expedienteId,
        actor.id,
        exp.areaActualId || AREA_DIR_ID,
        'CIERRE',
        'Archivado en custodia por vencimiento de plazo de recojo (documento vigente)',
        cliente,
      ).catch(() => undefined);

      const flujoActualizado = await this.repo.actualizarEstadoYCampos(
        expedienteId,
        estadoNuevo,
        {
          documentoValido: true,
          enCustodia: true,
          custodiaUbicacion,
          motivoCierre: datos.observaciones ?? `No recogido dentro del plazo límite de ${flujo.plazoRecojoDias} días; pasa a custodia sin invalidar documento.`,
          finalizadoEn: new Date(),
        },
        cliente,
      );

      const historial = await this.repo.registrarHistorial(
        {
          expedienteId,
          estadoAnterior: flujo.estadoFlujo,
          evento: 'ARCHIVAR_POR_NO_RECOJO',
          estadoNuevo,
          estadoRutaDocAnterior: exp.estadoRutaDoc,
          estadoRutaDocNuevo: MAPEO_ESTADO_FLUJO_A_RUTADOC[estadoNuevo],
          rolActor,
          usuarioActorId: actor.id,
          areaOrigenId: exp.areaActualId || AREA_DIR_ID,
          areaDestinoId: exp.areaActualId || AREA_DIR_ID,
          idMovimientoRutaDoc: movimientoId,
          detalle: `Pasado a ARCHIVADO_NO_RECOGIDO (custodia física en ${datos.estante}/${datos.balda}/${datos.caja}) sin invalidar documento`,
          metadatos: {
            custodiaUbicacion,
            documentoValido: true,
            cvd: flujo.firmaDigitalCvd,
          },
        },
        cliente,
      );

      await insertarEvento(cliente, {
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteArchivadoNoRecogido',
        payload: {
          identidad: { expediente_id: expedienteId, codigo_expediente: exp.codigoExpediente, movimiento_id: movimientoId },
          contexto: { usuario_actor_id: actor.id },
          datos_especificos: {
            estado_flujo: estadoNuevo,
            documento_valido: true,
            en_custodia: true,
            custodia_ubicacion: custodiaUbicacion,
          },
        },
      });

      return this.construirRespuestaTransicion(
        expedienteId,
        'ARCHIVAR_POR_NO_RECOJO',
        flujo.estadoFlujo,
        flujoActualizado,
        historial,
      );
    });
  }

  // ===========================================================================
  // Descarga del PDF del Certificado (Canal Digital / Post-Entrega)
  // ===========================================================================
  async obtenerDescargaCertificado(
    expedienteId: string,
    actor: ActorRutaDoc,
  ): Promise<{
    ok: true;
    expedienteId: string;
    estadoFlujo: EstadoFlujoCertificado;
    documentoValido: boolean;
    descargaHabilitada: boolean;
    codigoCertificado: string | null;
    cvd: string | null;
    sha256: string | null;
    documentoId: string | null;
    urlDescarga: string;
    expiraEnSegundos: number;
  }> {
    const exp = await this.cargarContextoExpediente(this.pool, expedienteId);
    const idPersonaActor = await this.resolverIdPersonaActor(this.pool, actor);
    const esTitular = Boolean(
      (idPersonaActor && idPersonaActor === exp.solicitanteId) ||
      actor.id === exp.idUsuarioCreador ||
      actor.id === exp.solicitanteId,
    );
    const esInstitucional = actor.roles.some((r) =>
      ['ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'MESA_PARTES'].includes(r.toUpperCase()),
    );

    if (actor.puedeVerExpediente) {
      const puede = await actor.puedeVerExpediente(expedienteId);
      if (!puede) {
        throw new ForbiddenError({ detail: 'No tiene autorización para descargar documentos de este expediente.' });
      }
    } else if (!esTitular && !esInstitucional) {
      throw new ForbiddenError({ detail: 'No tiene autorización para descargar documentos de este expediente.' });
    }

    const flujo = await this.repo.obtenerPorExpedienteId(expedienteId, this.pool);
    if (!flujo) {
      throw new NotFoundError({ detail: 'No existe flujo certificado registrado para este expediente.' });
    }

    if (!flujo.documentoValido) {
      throw new DomainError({
        code: 'DOCUMENTO_NO_DISPONIBLE_PARA_DESCARGA',
        message: 'El expediente no cuenta con un certificado emitido y firmado digitalmente.',
      });
    }

    if (!flujo.descargaHabilitada || flujo.estadoFlujo === 'LISTO_PARA_ENTREGA') {
      throw new ConflictError({
        code: 'ENTREGA_PRESENCIAL_REQUERIDA',
        message: 'El certificado corresponde a canal presencial y requiere recojo físico antes de habilitar la descarga digital.',
      });
    }

    const docId = flujo.firmaDigitalDocumentoId ?? flujo.certificadoDocumentoId;
    let urlDescarga = docId
      ? `/api/v1/expedientes/${expedienteId}/documentos/${docId}/url-archivo`
      : `/api/v1/validador/cvd/${flujo.firmaDigitalCvd ?? ''}`;

    if (flujo.firmaDigitalS3Key) {
      try {
        const configS3 = obtenerConfiguracionS3();
        urlDescarga = generarUrlPresigned(flujo.firmaDigitalS3Key, configS3, {
          metodo: 'GET',
          expiraSegundos: 900,
        });
      } catch {
        // Fallback seguro a endpoint autenticado
      }
    }

    return {
      ok: true,
      expedienteId,
      estadoFlujo: flujo.estadoFlujo,
      documentoValido: flujo.documentoValido,
      descargaHabilitada: flujo.descargaHabilitada,
      codigoCertificado: flujo.codigoCertificado,
      cvd: flujo.firmaDigitalCvd,
      sha256: flujo.firmaDigitalSha256,
      documentoId: docId,
      urlDescarga,
      expiraEnSegundos: 900,
    };
  }
}

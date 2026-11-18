import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool, PoolClient } from 'pg';
import { DerivarExpedienteSchema } from './dto/derivarExpediente.dto.js';
import { AtenderExpedienteSchema } from './dto/atenderExpediente.dto.js';
import { ArchivarExpedienteSchema } from './dto/archivarExpediente.dto.js';
import {
  derivarExpediente,
  recepcionarExpediente,
  atenderExpediente,
  enviarAFirmaExpediente,
  resolverExpedienteConFirma,
  archivarExpediente,
  observarExpediente,
  subsanarExpediente,
  iniciarRevisionExpediente,
  evaluarElegibilidadDerivacion,
  verificarEvidenciaEtapaTecnica,
  verificarFacultadDerivacion,
} from './derivaciones.service.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/domain/errors/index.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { crearJwtActorProvider, type ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import { bloquearExpedienteRutaDoc } from './rutadoc.lock.js';
import { AuthorizationService } from '../../core/auth/authorization.service.js';
import { ExpedienteAsignacionService } from './expedienteAsignacion.service.js';
import { ExpedienteObservacionService } from './expedienteObservacion.service.js';
import { WorkflowService } from './workflow.service.js';
import { EnrutabilidadService } from './enrutabilidad.service.js';
import { TupaDestinoService } from './tupaDestino.service.js';
import { verificarFacultadFirma } from '../../core/auth/auth.guard.js';

interface ContextoExpedienteRutaDoc {
  expedienteId: string;
  solicitanteId: string;
  estadoActual: string;
  areaActualId: string;
}

export function crearRouterDerivaciones(
  pool: Pool,
  proveedorActor?: ActorProviderRutaDoc,
  authService?: AuthorizationService,
): Router {
  const router = Router();
  const actorProviderEfectivo = proveedorActor ?? crearJwtActorProvider(pool);
  const authSvc = authService ?? new AuthorizationService(pool);
  const asignacionSvc = new ExpedienteAsignacionService(pool);
  const observacionSvc = new ExpedienteObservacionService(pool);
  const workflowSvc = new WorkflowService(pool);
  const enrutabilidadSvc = new EnrutabilidadService(pool);
  const tupaDestinoSvc = new TupaDestinoService(pool, enrutabilidadSvc);

  async function resolverActor(req: Request): Promise<ActorRutaDoc | null> {
    if ((req as any).actor) {
      return (req as any).actor as ActorRutaDoc;
    }
    if (actorProviderEfectivo) {
      return await actorProviderEfectivo.obtenerActor(req);
    }
    return null;
  }

  async function consultarContextoExpediente(expedienteId: string): Promise<ContextoExpedienteRutaDoc> {
    const queryStr = `SELECT
         e.expediente_id::text AS expediente_id,
         e.solicitante_id::text AS solicitante_id,
         COALESCE(u.estado_nuevo, e.estado, 'REGISTRADO') AS estado_actual_id,
         COALESCE(u.area_actual_id, e.area_destino_id::text, '') AS area_contexto_id
       FROM sigd_tra.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
       WHERE e.expediente_id = $1::uuid`;

    let res: any;
    try {
      res = await pool.query(queryStr, [expedienteId]);
    } catch {
      const cliente = await pool.connect();
      try {
        res = await cliente.query(queryStr, [expedienteId]);
      } finally {
        cliente.release();
      }
    }

    if (!res.rows || res.rows.length === 0) {
      throw new NotFoundError({ detail: 'El expediente no existe o no tiene estado actual.' });
    }

    return {
      expedienteId: res.rows[0].expediente_id,
      solicitanteId: res.rows[0].solicitante_id,
      estadoActual: res.rows[0].estado_actual_id,
      areaActualId: res.rows[0].area_contexto_id,
    };
  }

  async function resolverIdPersonaActor(actor: ActorRutaDoc): Promise<string | null> {
    if (actor.idPersona) {
      return actor.idPersona;
    }
    const queryStr = 'SELECT id_persona::text AS id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1';
    try {
      const res = await pool.query<{ id_persona: string | null }>(queryStr, [actor.id]);
      if (res.rows && res.rows.length > 0) {
        return res.rows[0].id_persona;
      }
    } catch {
      try {
        const cliente = await pool.connect();
        try {
          const res = await cliente.query<{ id_persona: string | null }>(queryStr, [actor.id]);
          if (res.rows && res.rows.length > 0) {
            return res.rows[0].id_persona;
          }
        } finally {
          cliente.release();
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  async function verificarEncargaturaDespacho(
    poolOrClient: Pool | PoolClient,
    idUsuario: string,
    areaId: string,
    idPersona?: string | null,
  ): Promise<boolean> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!areaId || !uuidRegex.test(areaId) || !uuidRegex.test(idUsuario)) {
      return false;
    }
    try {
      const res = await poolOrClient.query(
        `SELECT 1
           FROM sigd_org.responsabilidad_temporal rt
          WHERE (rt.id_usuario = $1::uuid OR ($3::uuid IS NOT NULL AND rt.id_persona = $3::uuid))
            AND rt.area_id = $2::uuid
            AND rt.estado = 'ACTIVO'
            AND rt.tipo_responsabilidad IN ('ENCARGATURA', 'DELEGACION', 'SUPLENCIA', 'DESIGNACION_ESPECIFICA')
            AND rt.vigente_desde <= now()
            AND (rt.vigente_hasta IS NULL OR rt.vigente_hasta > now())
          LIMIT 1`,
        [idUsuario, areaId, idPersona && uuidRegex.test(idPersona) ? idPersona : null],
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  function resolverContextoOperacion(req: Request, actor: ActorRutaDoc): 'INSTITUCIONAL' | 'PERSONAL' {
    const rawHeader = req.headers['x-contexto-operacion'];
    if (typeof rawHeader === 'string' && rawHeader.trim().toUpperCase() === 'PERSONAL') {
      return 'PERSONAL';
    }
    if ((actor as any).contextoOperacion === 'PERSONAL') {
      return 'PERSONAL';
    }
    return 'INSTITUCIONAL';
  }

  const AREA_DIR_CANONICA = 'a0000000-0000-0000-0000-000000000002';
  const ROLES_NEGOCIO_DOCUMENTAL = ['DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'MESA_PARTES'];

  function validarActorNoAdministradoNiPersonal(
    req: Request,
    actor: ActorRutaDoc,
    mensajePersonal: string,
    mensajeAdministrado: string,
    codigoAdministrado?: string,
  ): void {
    const contextoOperacion = resolverContextoOperacion(req, actor);
    if (contextoOperacion === 'PERSONAL') {
      throw new ForbiddenError({
        code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
        detail: mensajePersonal,
      });
    }

    const esAdministrado = actor.roles.some((r) => ['CIUDADANO', 'ESTUDIANTE'].includes(r));
    if (esAdministrado) {
      throw new ForbiddenError({
        ...(codigoAdministrado ? { code: codigoAdministrado } : {}),
        detail: mensajeAdministrado,
      });
    }
  }

  function asegurarSinSoloPoderTecnicoNiFinanciero(
    actor: ActorRutaDoc,
    codigoTesoreria: string = 'ROL_FINANCIERO_SIN_FACULTAD_DOCUMENTAL',
    detailTesoreria: string = 'El rol TESORERIA únicamente gestiona cobros y recibos, sin facultades de tramitación documental.',
  ): void {
    const tieneRolNegocio = actor.roles.some((r) => ROLES_NEGOCIO_DOCUMENTAL.includes(r));
    const esSoloAdminTecnico =
      actor.roles.some((r) => ['ADMINISTRADOR', 'SUPERADMINISTRADOR', 'SUPER_ADMIN'].includes(r)) &&
      !tieneRolNegocio;
    if (esSoloAdminTecnico) {
      throw new ForbiddenError({
        code: 'PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO',
        detail: 'El perfil técnico administra la plataforma y no confiere autoridad sustantiva sobre expedientes.',
      });
    }

    const esSoloTesoreria = actor.roles.includes('TESORERIA') && !tieneRolNegocio;
    if (esSoloTesoreria) {
      throw new ForbiddenError({
        code: codigoTesoreria,
        detail: detailTesoreria,
      });
    }
  }

  function asegurarNoAutoatencion(
    actor: ActorRutaDoc,
    idPersonaActor: string | null,
    solicitanteId: string | null | undefined,
    detail: string,
  ): void {
    if (
      solicitanteId &&
      ((idPersonaActor && idPersonaActor === solicitanteId) || actor.id === solicitanteId)
    ) {
      throw new ForbiddenError({
        code: 'CONFLICTO_INTERES_EXPEDIENTE_PROPIO',
        detail,
      });
    }
  }

  async function tieneCustodiaEfectiva(
    poolOrClient: Pool | PoolClient,
    actor: ActorRutaDoc,
    areaActualId: string | null | undefined,
    opcionesCustodia?: { permitirMesaEnAreaInicial?: boolean; idPersonaActor?: string | null },
  ): Promise<boolean> {
    if (actor.unidadOrganicaId && areaActualId && actor.unidadOrganicaId === areaActualId) {
      return true;
    }
    if (
      opcionesCustodia?.permitirMesaEnAreaInicial &&
      actor.roles.includes('MESA_PARTES') &&
      (!areaActualId ||
        areaActualId === AREA_DIR_CANONICA ||
        areaActualId === 'DIR' ||
        areaActualId === 'Mesa de Partes')
    ) {
      return true;
    }
    if (areaActualId) {
      return await verificarEncargaturaDespacho(
        poolOrClient,
        actor.id,
        areaActualId,
        opcionesCustodia?.idPersonaActor,
      );
    }
    return false;
  }

  // ===========================================================================
  // Endpoint: Derivación Documentaria (T-BE-RD-06 / 5G)
  // ===========================================================================
  const handlerDerivar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // REGLA DE SEGURIDAD (POST-CIERRE): Rechazo canónico e inmediato de asignación embebida
      const rawBody = req.body;
      const tieneAsignacionEmbebida =
        rawBody?.usuario_asignado_id !== undefined ||
        rawBody?.persona_asignada_id !== undefined ||
        (Array.isArray(rawBody?.destinos) &&
          rawBody.destinos.some(
            (d: any) =>
              d && (d.usuario_asignado_id !== undefined || d.persona_asignada_id !== undefined),
          ));

      if (tieneAsignacionEmbebida) {
        throw new ValidationError({
          code: 'ASIGNACION_EMBEBIDA_NO_PERMITIDA',
          message:
            'ASIGNACION_EMBEBIDA_NO_PERMITIDA: La asignación individual de un expediente debe realizarse a través del servicio formal POST /api/v1/expedientes/:id/asignar.',
        });
      }

      const expedienteId = String(req.params.id);
      const datos = DerivarExpedienteSchema.parse(req.body);

      const headerIdem = req.headers['idempotency-key'] as string | undefined;
      if (headerIdem && !datos.clave_idempotencia) {
        datos.clave_idempotencia = headerIdem;
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);

        // 1. Validación de Actor, Contexto de Operación y Autorización base sin consultas previas
        const actor = await resolverActor(req);
        if (!actor) {
          throw new UnauthorizedError({ detail: 'Autenticación requerida para derivar el expediente.' });
        }

        validarActorNoAdministradoNiPersonal(
          req,
          actor,
          'En contexto personal el usuario no dispone de facultades para derivar expedientes institucionales.',
          'Los administrados no tienen autorización para derivar expedientes.',
        );

        const esTesoreria = actor.roles.includes('TESORERIA') &&
          !actor.roles.some((r) => ['DIRECTOR', 'SECRETARIO', 'MESA_PARTES', 'ESPECIALISTA'].includes(r));
        if (esTesoreria) {
          throw new ForbiddenError({
            code: 'ROL_FINANCIERO_SIN_FACULTAD_DERIVAR',
            detail: 'El rol TESORERIA no posee facultades para derivar expedientes documentarios.',
          });
        }

        // 2. Validación de Gates de Dominio: Requisitos Documentales y Financieros (C3.6.2)
        const elegibilidad = await evaluarElegibilidadDerivacion(cliente, expedienteId);
        if (!elegibilidad.requisitosConformes) {
          throw new ConflictError({
            code: 'REQUISITOS_DOCUMENTALES_PENDIENTES',
            message: 'El expediente cuenta con requisitos documentales obligatorios pendientes de validación o no conformes.',
            detail: `Requisitos documentales obligatorios conformes: ${elegibilidad.totalRequisitosDocumentalesConformes}/${elegibilidad.totalRequisitosDocumentalesObligatorios}.`,
          });
        }
        if (!elegibilidad.pagoConforme) {
          throw new ConflictError({
            code: 'PAGO_PENDIENTE',
            message: 'El expediente requiere pago confirmado antes de continuar.',
            detail: `El trámite exige tasa arancelada de S/ ${elegibilidad.montoRequerido.toFixed(2)} con pago PENDIENTE de confirmación en Tesorería.`,
          });
        }

        const contextoExp = await consultarContextoExpediente(expedienteId);
        asegurarSinSoloPoderTecnicoNiFinanciero(
          actor,
          'ROL_FINANCIERO_SIN_FACULTAD_DERIVAR',
          'El rol TESORERIA no posee facultades para derivar expedientes documentarios.',
        );

        if (!actor.roles.some((r) => ROLES_NEGOCIO_DOCUMENTAL.includes(r))) {
          throw new ForbiddenError({ detail: 'No cuenta con rol operativo habilitado para derivar expedientes.' });
        }

        const idPersonaActor = await resolverIdPersonaActor(actor);

        // Facultad explícita de derivación (ESPECIALISTA requiere perfil EXPEDIENTE_DERIVAR o DELEGACION:DERIVACION)
        const tieneFacultadDerivacion = await verificarFacultadDerivacion(
          cliente,
          actor,
          contextoExp.areaActualId,
          idPersonaActor,
        );
        if (!tieneFacultadDerivacion) {
          throw new ForbiddenError({
            code: 'SIN_FACULTAD_DERIVACION',
            detail: 'No posee facultad explícita ni delegación vigente para derivar este expediente.',
          });
        }

        // Regla de Autoatención
        asegurarNoAutoatencion(
          actor,
          idPersonaActor,
          contextoExp.solicitanteId,
          'AUTOATENCION_PROHIBIDA: El solicitante no puede derivar su propio expediente o solicitud personal.',
        );

        // Verificación fail-closed de custodia en el área (o Mesa de Partes en REGISTRADO, o encargatura vigente)
        const tieneCustodia = await tieneCustodiaEfectiva(cliente, actor, contextoExp.areaActualId, {
          permitirMesaEnAreaInicial: contextoExp.estadoActual === 'REGISTRADO',
          idPersonaActor,
        });

        if (!tieneCustodia) {
          throw new ForbiddenError({
            code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
            detail: 'No pertenece al área de custodia actual para derivar el expediente.',
          });
        }

        // 3. Validación de áreas de destino y enrutabilidad operativa
        const idsDestino = datos.destinos.map((d) => d.area_destino_id);
        const mapaEnrutabilidad = await enrutabilidadSvc.evaluarEnrutabilidadAreas(idsDestino, cliente);

        for (const destino of datos.destinos) {
          const evalArea = mapaEnrutabilidad.get(destino.area_destino_id);
          if (!evalArea || !evalArea.existe) {
            throw new NotFoundError({
              detail: `DESTINO_INVALIDO: El área de destino ${destino.area_destino_id} no existe en la estructura orgánica.`,
            });
          }
          if (!evalArea.vigente) {
            throw new DomainError({
              code: 'DESTINO_INACTIVO',
              message: `DESTINO_INACTIVO: El área de destino ${destino.area_destino_id} (${evalArea.nombre ?? ''}) se encuentra inactiva o dada de baja.`,
            });
          }
          if (!evalArea.enrutable) {
            throw new DomainError({
              code: 'AREA_NO_ENRUTABLE',
              message: 'El área seleccionada no cuenta actualmente con personal habilitado para recibir y gestionar expedientes.',
            });
          }
        }

        // 3.1 Verificación de destino TUPA y auditoría de desviaciones manuales
        const destinoTupa = await tupaDestinoSvc.resolverDestinoTupa(expedienteId, cliente);
        const primerDestinoId = datos.destinos[0]?.area_destino_id;
        if (
          destinoTupa.vinculadoTupa &&
          destinoTupa.unidadResponsableId &&
          primerDestinoId &&
          primerDestinoId !== destinoTupa.unidadResponsableId &&
          primerDestinoId !== destinoTupa.unidadResolutivaId
        ) {
          const justificacion = datos.justificacion_desviacion?.trim();
          if (!justificacion || justificacion.length < 10) {
            throw new ValidationError({
              code: 'JUSTIFICACION_DESVIACION_REQUERIDA',
              message: `JUSTIFICACION_DESVIACION_REQUERIDA: El área seleccionada (${primerDestinoId}) difiere de la unidad responsable configurada según TUPA (${destinoTupa.unidadResponsableNombre ?? destinoTupa.unidadResponsableId}). Se requiere una justificación motivada de al menos 10 caracteres.`,
            });
          }

          await insertarEvento(cliente, {
            agregado: 'Expediente',
            tipo_evento: 'DesviacionDestinoTupaRegistrada',
            payload: {
              identidad: { expediente_id: expedienteId },
              contexto: {
                usuario_actor_id: actor.id,
                area_origen_id: contextoExp.areaActualId,
                area_destino_id: primerDestinoId,
              },
              datos_especificos: {
                destino_configurado_id: destinoTupa.unidadResponsableId,
                destino_configurado_nombre: destinoTupa.unidadResponsableNombre,
                destino_seleccionado_id: primerDestinoId,
                codigo_procedimiento: destinoTupa.codigoProcedimiento,
                version_tupa: destinoTupa.versionTupa,
                justificacion,
              },
            },
          });
        }

        // 3.2 Bloqueo estricto contra derivación prematura SDA -> DIR que omita la evaluación técnica
        const requiereEvaluacionIntermedia = Boolean(
          destinoTupa.vinculadoTupa &&
          destinoTupa.unidadResponsableId &&
          destinoTupa.unidadResolutivaId &&
          destinoTupa.unidadResponsableId !== destinoTupa.unidadResolutivaId,
        );
        const esRetornoTecnicoADireccion = Boolean(
          requiereEvaluacionIntermedia &&
          contextoExp.areaActualId === destinoTupa.unidadResponsableId &&
          primerDestinoId === destinoTupa.unidadResolutivaId,
        );
        if (esRetornoTecnicoADireccion) {
          const evidenciaTecnica = await verificarEvidenciaEtapaTecnica(cliente, expedienteId);
          if (!datos.es_correccion) {
            if (!evidenciaTecnica.completada) {
              throw new DomainError({
                code: 'DERIVACION_PREMATURA_EVALUACION_PENDIENTE',
                message: !evidenciaTecnica.tieneAsignacion
                  ? 'No se permite derivar el expediente hacia Dirección sin asignación formal y dictamen técnico obligatorio de la unidad responsable (SDA).'
                  : 'No se permite derivar el expediente hacia Dirección sin dictamen técnico válido registrado en la unidad responsable (SDA).',
              });
            }
            throw new DomainError({
              code: 'USAR_ENVIO_A_FIRMA',
              message: 'El expediente ya cuenta con evaluación técnica completada. Debe elevarse a Dirección mediante la acción formal "Enviar a Firma".',
            });
          }

          // Derivación correctiva o excepcional legítima: requiere jefatura/secretaría + justificación + auditoría
          const tieneAutoridadCorrectiva = actor.roles.some((r) =>
            ['SECRETARIO', 'DIRECTOR', 'ADMINISTRADOR', 'SUPERADMINISTRADOR'].includes(r),
          );
          if (!tieneAutoridadCorrectiva) {
            throw new ForbiddenError({
              code: 'SIN_FACULTAD_CORRECCION_DERIVACION',
              detail: 'Solo la Secretaría del área o jefatura autorizada puede ejecutar una derivación correctiva o excepcional hacia Dirección.',
            });
          }
          const justificacionCorrectiva = (datos.justificacion_desviacion ?? '').trim();
          if (justificacionCorrectiva.length < 10) {
            throw new ValidationError({
              code: 'JUSTIFICACION_DESVIACION_REQUERIDA',
              message: 'JUSTIFICACION_DESVIACION_REQUERIDA: Toda derivación correctiva o excepcional desde SDA hacia Dirección requiere una justificación motivada de al menos 10 caracteres.',
            });
          }

          await insertarEvento(cliente, {
            agregado: 'Expediente',
            tipo_evento: 'DerivacionCorrectivaExcepcionalRegistrada',
            payload: {
              identidad: { expediente_id: expedienteId },
              contexto: {
                usuario_actor_id: actor.id,
                area_origen_id: contextoExp.areaActualId,
                area_destino_id: primerDestinoId,
              },
              datos_especificos: {
                codigo_procedimiento: destinoTupa.codigoProcedimiento,
                justificacion: justificacionCorrectiva,
                evaluacion_tecnica_completada: evidenciaTecnica.completada,
                tiene_asignacion: evidenciaTecnica.tieneAsignacion,
                tiene_dictamen: evidenciaTecnica.tieneDictamenTecnico,
              },
            },
          });
        }

        await derivarExpediente(cliente, expedienteId, datos);

        const areaDestinoId = datos.destinos[0]?.area_destino_id;
        let updateRes;
        if (areaDestinoId) {
          updateRes = await cliente.query(
            `UPDATE sigd_tra.expediente
                SET estado = 'DERIVADO', area_destino_id = $2::uuid
              WHERE expediente_id = $1::uuid
                AND estado IN ('REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO', 'EN_REVISION')`,
            [expedienteId, areaDestinoId],
          );
        } else {
          updateRes = await cliente.query(
            `UPDATE sigd_tra.expediente
                SET estado = 'DERIVADO'
              WHERE expediente_id = $1::uuid
                AND estado IN ('REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO', 'EN_REVISION')`,
            [expedienteId],
          );
        }

        if ((updateRes?.rowCount ?? 0) !== 1) {
          throw new ConflictError({
            code: 'CONCURRENCY_CONFLICT_EXPEDIENTE_MUTATION',
            message: `No se pudo actualizar el estado de expediente ${expedienteId}. Verifique concurrencia o existencia.`,
          });
        }

        // Si existe workflow activo, avanzar
        try {
          await workflowSvc.avanzarPasoExpediente(
            expedienteId,
            actor.id,
            areaDestinoId || contextoExp.areaActualId,
            datos.es_correccion ? 'CORRECCION_DERIVACION' : 'DERIVACION',
            datos.proveido,
            cliente,
          );
        } catch {
          // Sin workflow activo
        }

        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Derivación procesada y registrada exitosamente.',
          expediente_id: expedienteId,
          derivacionId: expedienteId,
          nuevoEstado: 'DERIVADO',
        });
      } catch (error) {
        try {
          await cliente.query('ROLLBACK');
        } catch {
          // Ignorar fallo de rollback
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/derivar', handlerDerivar);
  router.post('/:id/movimientos/derivar', handlerDerivar);

  // ===========================================================================
  // Endpoint: Pre-enrutamiento y Resolución de Destino TUPA (Fase C3)
  // GET /api/v1/expedientes/:id/destino-tupa
  // ===========================================================================
  router.get('/:id/destino-tupa', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para consultar destino TUPA.' });
      }

      const destino = await tupaDestinoSvc.resolverDestinoTupa(expedienteId);
      res.status(200).json({
        success: true,
        ok: true,
        datos: {
          expedienteId: destino.expedienteId,
          vinculadoTupa: destino.vinculadoTupa,
          destinoConfigurado: Boolean(destino.unidadResponsableId),
          destinoEnrutable: destino.destinoEnrutable,
          unidadResponsableId: destino.unidadResponsableId,
          unidadResponsableCodigo: destino.unidadResponsableCodigo,
          unidadResponsableNombre: destino.unidadResponsableNombre,
          perfilResponsableId: destino.perfilResponsableId,
          perfilResponsableCodigo: destino.perfilResponsableCodigo,
          perfilResponsableNombre: destino.perfilResponsableNombre,
          unidadReceptoraId: destino.unidadReceptoraId,
          unidadReceptoraCodigo: destino.unidadReceptoraCodigo,
          unidadReceptoraNombre: destino.unidadReceptoraNombre,
          unidadResolutivaId: destino.unidadResolutivaId,
          unidadResolutivaCodigo: destino.unidadResolutivaCodigo,
          unidadResolutivaNombre: destino.unidadResolutivaNombre,
          unidadFinancieraId: destino.unidadFinancieraId,
          unidadFinancieraCodigo: destino.unidadFinancieraCodigo,
          unidadFinancieraNombre: destino.unidadFinancieraNombre,
          procedimientoCodigoRef: destino.codigoProcedimiento,
          versionTupaCodigo: destino.versionTupa,
          motivo: destino.motivoNoEnrutable,
        },
        ...destino,
      });
    } catch (err) {
      next(err);
    }
  });

  // ===========================================================================
  // Endpoint: Recepción en Área de Destino (T-BE-RD-06 / 5G)
  // ===========================================================================
  const handlerRecepcionar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para recepcionar el expediente.' });
      }

      validarActorNoAdministradoNiPersonal(
        req,
        actor,
        'En contexto personal el usuario no dispone de facultades para recepcionar expedientes.',
        'Los administrados no tienen autorización para recepcionar expedientes.',
      );

      const contextoExp = await consultarContextoExpediente(expedienteId);
      asegurarSinSoloPoderTecnicoNiFinanciero(actor);
      if (!actor.roles.some((r) => ROLES_NEGOCIO_DOCUMENTAL.includes(r))) {
        throw new ForbiddenError({ detail: 'No cuenta con rol operativo habilitado para recepcionar expedientes.' });
      }

      const idPersonaActor = await resolverIdPersonaActor(actor);

      // Autoatención
      asegurarNoAutoatencion(
        actor,
        idPersonaActor,
        contextoExp.solicitanteId,
        'AUTOATENCION_PROHIBIDA: El solicitante no puede recepcionar su propio expediente personal.',
      );

      // BOLA: Verificar pertenencia al área de destino o encargatura vigente
      const tieneCustodia = await tieneCustodiaEfectiva(pool, actor, contextoExp.areaActualId, {
        idPersonaActor,
      });
      if (!tieneCustodia) {
        throw new ForbiddenError({
          code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
          detail: 'No pertenece al área de destino para recepcionar el expediente.',
        });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);
        await recepcionarExpediente(cliente, expedienteId);
        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Expediente recepcionado exitosamente.',
          expediente_id: expedienteId,
          expedienteId,
          nuevoEstado: 'EN_REVISION',
        });
      } catch (error) {
        try {
          await cliente.query('ROLLBACK');
        } catch {
          // Ignorar fallo de rollback
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/recepcionar', handlerRecepcionar);
  router.post('/:id/movimientos/recepcionar', handlerRecepcionar);

  // ===========================================================================
  // Endpoint: Atención Resolutiva (T-BE-RD-07 / 5G)
  // ===========================================================================
  const handlerAtender = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const datos = AtenderExpedienteSchema.parse(req.body);

      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para atender el expediente.' });
      }

      const contextoOperacion = resolverContextoOperacion(req, actor);
      if (contextoOperacion === 'PERSONAL') {
        throw new ForbiddenError({
          code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
          detail: 'En contexto personal el usuario no dispone de facultades para resolver expedientes.',
        });
      }

      const esAdministrado = actor.roles.some((r) => ['CIUDADANO', 'ESTUDIANTE'].includes(r));
      if (esAdministrado) {
        throw new ForbiddenError({ detail: 'Los administrados no tienen autorización para atender expedientes.' });
      }

      const contextoExp = await consultarContextoExpediente(expedienteId);
      const idPersonaActor = await resolverIdPersonaActor(actor);

      // Autoatención prohibida
      if (
        (idPersonaActor && idPersonaActor === contextoExp.solicitanteId) ||
        actor.id === contextoExp.solicitanteId
      ) {
        throw new ForbiddenError({
          code: 'CONFLICTO_INTERES_EXPEDIENTE_PROPIO',
          detail: 'AUTOATENCION_PROHIBIDA: El solicitante no puede resolver o calificar su propio expediente personal.',
        });
      }

      // Poder técnico ≠ Autoridad de negocio
      const esSoloAdminTecnico =
        actor.roles.some((r) => ['ADMINISTRADOR', 'SUPERADMINISTRADOR', 'SUPER_ADMIN'].includes(r)) &&
        !actor.roles.some((r) => ['DIRECTOR', 'SECRETARIO', 'ESPECIALISTA'].includes(r));

      if (esSoloAdminTecnico) {
        throw new ForbiddenError({
          code: 'PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO',
          detail: 'El perfil técnico posee control del sistema y no confiere facultades de resolución sustantiva ni emisión de dictámenes.',
        });
      }

      const esRolNoAtencion = actor.roles.some((r) => ['TESORERIA', 'MESA_PARTES'].includes(r)) &&
        !actor.roles.some((r) => ['DIRECTOR', 'SECRETARIO', 'ESPECIALISTA'].includes(r));
      if (esRolNoAtencion || !actor.roles.some((r) => ['DIRECTOR', 'SECRETARIO', 'ESPECIALISTA'].includes(r))) {
        throw new ForbiddenError({
          code: 'ROL_SIN_FACULTAD_ATENCION',
          detail: 'El rol no dispone de facultades para registrar atención técnica o dictamen.',
        });
      }

      // BOLA: Verificar pertenencia al área de custodia o encargatura vigente
      const tieneCustodiaAtencion = await tieneCustodiaEfectiva(pool, actor, contextoExp.areaActualId, {
        idPersonaActor,
      });
      if (!tieneCustodiaAtencion) {
        throw new ForbiddenError({
          code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
          detail: 'No cuenta con facultades en el área para atender el expediente.',
        });
      }

      // El rol DIRECTOR no emite dictámenes técnicos ordinarios sin asignación formal o perfil técnico
      if (actor.roles.includes('DIRECTOR') && !actor.roles.includes('SECRETARIO')) {
        const asignacionActiva = await asignacionSvc.obtenerAsignacionActiva(expedienteId);
        const esAsignado =
          asignacionActiva &&
          (asignacionActiva.idUsuario === actor.id ||
            (idPersonaActor && asignacionActiva.idPersona === idPersonaActor));
        if (!esAsignado) {
          throw new ForbiddenError({
            code: 'DIRECTOR_SIN_FACULTAD_DICTAMEN',
            detail: 'El rol DIRECTOR no emite dictámenes técnicos ordinarios sin asignación formal o perfil técnico en el expediente.',
          });
        }
      }

      // Regla de Asignación individual:
      // Si el actor opera como ESPECIALISTA, debe ser el especialista asignado formalmente al expediente
      if (actor.roles.includes('ESPECIALISTA') && !actor.roles.includes('SECRETARIO')) {
        const asignacionActiva = await asignacionSvc.obtenerAsignacionActiva(expedienteId);
        if (!asignacionActiva) {
          throw new ForbiddenError({
            code: 'EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA',
            message: 'El expediente no ha sido asignado formalmente a un especialista para su atención técnica.',
          });
        }
        const esAsignado =
          asignacionActiva.idUsuario === actor.id ||
          (idPersonaActor && asignacionActiva.idPersona === idPersonaActor);
        if (!esAsignado) {
          throw new ForbiddenError({
            code: 'EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA',
            message: 'El expediente no se encuentra asignado a este especialista para su atención técnica.',
          });
        }
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);
        await atenderExpediente(cliente, expedienteId, datos);

        // Avanzar workflow si existe
        try {
          await workflowSvc.avanzarPasoExpediente(
            expedienteId,
            actor.id,
            contextoExp.areaActualId,
            'CIERRE',
            datos.resultado_resumen,
            cliente,
          );
        } catch {
          // Sin workflow
        }

        const resEstado = await cliente.query<{ estado: string }>(
          `SELECT COALESCE(u.estado_nuevo, e.estado) AS estado
             FROM sigd_tra.expediente e
             LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
            WHERE e.expediente_id = $1::uuid`,
          [expedienteId],
        );
        const estadoFinal = resEstado.rows[0]?.estado || 'EN_REVISION';
        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: estadoFinal === 'RESUELTO'
            ? 'Atención resolutiva registrada exitosamente.'
            : 'Atención técnica registrada exitosamente.',
          expediente_id: expedienteId,
          expedienteId,
          nuevoEstado: estadoFinal,
        });
      } catch (error) {
        try {
          await cliente.query('ROLLBACK');
        } catch {
          // Ignorar fallo de rollback
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/atender', handlerAtender);
  router.post('/:id/movimientos/atender', handlerAtender);

  // ===========================================================================
  // Endpoint: Envío a Firma (Transición Canónica EN_REVISION -> EN_FIRMA) (5G)
  // ===========================================================================
  const handlerEnviarAFirma = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para enviar a firma.' });
      }

      validarActorNoAdministradoNiPersonal(
        req,
        actor,
        'En contexto personal el usuario no dispone de facultades institucionales.',
        'Los administrados no tienen autorización para remitir a firma.',
      );

      asegurarSinSoloPoderTecnicoNiFinanciero(actor);

      const tieneFacultadDespacho = actor.roles.some((r) =>
        ['SECRETARIO', 'DIRECTOR'].includes(r),
      );
      const esEspecialista = actor.roles.includes('ESPECIALISTA');
      if (esEspecialista && !tieneFacultadDespacho) {
        throw new ForbiddenError({
          code: 'ESPECIALISTA_NO_PUEDE_ELEVAR_A_FIRMA',
          detail: 'El especialista técnico emite dictamen o informe, pero no posee facultad de despacho para elevar directamente a firma. La elevación corresponde a la Secretaría o Jefatura de Despacho.',
        });
      }
      if (!tieneFacultadDespacho) {
        throw new ForbiddenError({
          code: 'SIN_FACULTAD_DESPACHO_FIRMA',
          detail: 'El usuario no posee facultades de secretaría o despacho para remitir expedientes a firma resolutiva.',
        });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);

        const resultado = await enviarAFirmaExpediente(cliente, expedienteId, {
          resultado_resumen: req.body.resultado_resumen || 'Pase formal para emisión y firma de resolución',
          observacion_interna: req.body.observacion_interna,
          actor_unidad_organica_id: actor.unidadOrganicaId,
          actor_roles: actor.roles,
          exigir_custodia: true,
          actor_id: actor.id,
          actor_id_persona: actor.idPersona ?? null,
        });

        // Avanzar workflow a paso firma si existe
        try {
          const contextoExp = await consultarContextoExpediente(expedienteId);
          await workflowSvc.avanzarPasoExpediente(
            expedienteId,
            actor.id,
            contextoExp.areaActualId,
            'ENVIAR_A_FIRMA',
            req.body.resultado_resumen || 'Pase a despacho de firma',
            cliente,
          );
        } catch {
          // Sin workflow
        }

        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Expediente remitido a despacho en estado EN_FIRMA exitosamente.',
          expedienteId,
          nuevoEstado: 'EN_FIRMA',
          ...resultado,
        });
      } catch (error) {
        try {
          await cliente.query('ROLLBACK');
        } catch {
          // Ignorar fallo de rollback
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/enviar-a-firma', handlerEnviarAFirma);

  // ===========================================================================
  // Endpoint: Resolución Formal con Firma (Transición Canónica EN_FIRMA -> RESUELTO) (5G)
  // ===========================================================================
  const handlerResolver = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const datos = AtenderExpedienteSchema.parse(req.body);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para resolver el expediente.' });
      }

      validarActorNoAdministradoNiPersonal(
        req,
        actor,
        'En contexto personal el usuario no dispone de facultades resolutivas.',
        'Los administrados no tienen facultades resolutivas.',
      );

      const contextoExp = await consultarContextoExpediente(expedienteId);

      // REGLA CANÓNICA: Autoridad resolutiva reservada a DIRECTOR / firmante con facultad de firma
      const rolesNoFirmantes = actor.roles.filter(
        (r) => !['ADMINISTRADOR', 'SUPERADMINISTRADOR', 'SUPER_ADMIN'].includes(r),
      );
      const facultad = await verificarFacultadFirma(pool, actor.id, rolesNoFirmantes);
      if (!facultad.puedeFirmar) {
        throw new ForbiddenError({
          code: 'SIN_FACULTAD_RESOLUTIVA',
          message: 'Acceso denegado: Se requiere cargo o facultad directiva (DIRECTOR) para emitir la resolución del expediente.',
          detail: facultad.motivo ?? 'El rol administrativo o técnico no confiere facultades de resolución institucional.',
        });
      }

      asegurarSinSoloPoderTecnicoNiFinanciero(actor);

      const idPersonaActor = await resolverIdPersonaActor(actor);
      asegurarNoAutoatencion(
        actor,
        idPersonaActor,
        contextoExp.solicitanteId,
        'AUTOATENCION_PROHIBIDA: El solicitante no puede emitir resolución sobre su propio expediente personal.',
      );

      // Custodia fail-closed del área resolutiva
      const tieneCustodiaResol = await tieneCustodiaEfectiva(pool, actor, contextoExp.areaActualId, {
        idPersonaActor,
      });
      if (!tieneCustodiaResol) {
        throw new ForbiddenError({
          code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
          detail: 'No pertenece al área de custodia resolutiva del expediente para emitir la resolución.',
        });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);

        const resultado = await resolverExpedienteConFirma(cliente, expedienteId, datos);

        // Avanzar workflow a resolución si existe
        try {
          const contextoExp = await consultarContextoExpediente(expedienteId);
          await workflowSvc.avanzarPasoExpediente(
            expedienteId,
            actor.id,
            contextoExp.areaActualId,
            'FIRMA',
            datos.resultado_resumen,
            cliente,
          );
        } catch {
          // Sin workflow
        }

        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Expediente resuelto formalmente con firma digitalizada/criptográfica válida.',
          expedienteId,
          nuevoEstado: 'RESUELTO',
          ...resultado,
        });
      } catch (error) {
        try {
          await cliente.query('ROLLBACK');
        } catch {
          // Ignorar fallo de rollback
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/resolver', handlerResolver);

  // ===========================================================================
  // Endpoint: Archivado Formal (T-BE-RD-08 / 5G)
  // ===========================================================================
  const handlerArchivar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const datos = ArchivarExpedienteSchema.parse(req.body);

      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para archivar el expediente.' });
      }

      validarActorNoAdministradoNiPersonal(
        req,
        actor,
        'En contexto personal el usuario no dispone de facultades para archivar expedientes.',
        'Los administrados no tienen autorización para archivar expedientes.',
      );

      const contextoExp = await consultarContextoExpediente(expedienteId);
      asegurarSinSoloPoderTecnicoNiFinanciero(actor);

      const tienePermisoArchivo = actor.roles.some((r) =>
        ['DIRECTOR', 'SECRETARIO', 'MESA_PARTES'].includes(r),
      );
      if (!tienePermisoArchivo) {
        throw new ForbiddenError({
          code: 'SIN_FACULTAD_ARCHIVO',
          detail: 'No cuenta con rol habilitado para el archivado físico del expediente.',
        });
      }

      const idPersonaActor = await resolverIdPersonaActor(actor);
      asegurarNoAutoatencion(
        actor,
        idPersonaActor,
        contextoExp.solicitanteId,
        'AUTOATENCION_PROHIBIDA: El solicitante no puede archivar su propio expediente personal.',
      );

      const tieneCustodiaArchivo = await tieneCustodiaEfectiva(pool, actor, contextoExp.areaActualId, {
        permitirMesaEnAreaInicial: true,
        idPersonaActor,
      });
      if (!tieneCustodiaArchivo) {
        throw new ForbiddenError({
          code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
          detail: 'No tiene custodia en el área actual del expediente para archivarlo.',
        });
      }

      if (contextoExp.estadoActual !== 'RESUELTO') {
        throw new DomainError({
          code: 'ESTADO_INVALIDO',
          message: `El expediente en estado ${contextoExp.estadoActual} no puede ser archivado. Solo se pueden archivar expedientes en estado RESUELTO.`,
        });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);
        await archivarExpediente(cliente, expedienteId, datos);

        // Avanzar workflow a paso final cierre si existe
        try {
          await workflowSvc.avanzarPasoExpediente(
            expedienteId,
            actor.id,
            contextoExp.areaActualId,
            'CIERRE',
            'Archivado formal del expediente',
            cliente,
          );
        } catch {
          // Sin workflow
        }

        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Archivado físico registrado exitosamente.',
          expediente_id: expedienteId,
          expedienteId,
          nuevoEstado: 'ARCHIVADO',
        });
      } catch (error) {
        try {
          await cliente.query('ROLLBACK');
        } catch {
          // Ignorar fallo de rollback
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/archivar', handlerArchivar);
  router.post('/:id/movimientos/archivar', handlerArchivar);

  // ===========================================================================
  // Endpoint: Acumulación de Expedientes (Art. 160 LPAG)
  // ===========================================================================
  const handlerAcumular = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedientePrincipalId = String(req.params.id);
      const accesorioId = req.body.expedienteAccesorioId || (Array.isArray(req.body.conexos) && req.body.conexos[0]?.id) || req.body.accesorioId;
      const actoResolutivo = req.body.actoResolutivo || req.body.motivo || 'Acumulación de expedientes conexos conforme al Art. 160 LPAG';

      if (!accesorioId) {
        throw new ValidationError({
          message: 'Parámetros inválidos para acumulación.',
          invalidParams: [
            { name: 'expedienteAccesorioId', reason: 'Se requiere el identificador del expediente accesorio a acumular.' },
          ],
        });
      }

      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para acumular expedientes.' });
      }

      if (actor.puedeVerExpediente) {
        const [puedePrincipal, puedeAccesorio] = await Promise.all([
          actor.puedeVerExpediente(expedientePrincipalId),
          actor.puedeVerExpediente(accesorioId),
        ]);
        if (!puedePrincipal || !puedeAccesorio) {
          throw new ForbiddenError({
            detail: !puedePrincipal
              ? `No tiene autorización sobre el expediente principal ${expedientePrincipalId}.`
              : `No tiene autorización sobre el expediente accesorio ${accesorioId}.`,
          });
        }
      }

      validarActorNoAdministradoNiPersonal(
        req,
        actor,
        'En contexto personal el usuario no dispone de facultades para acumular expedientes.',
        'Los administrados no tienen autorización para acumular expedientes.',
      );

      const [contextoPrincipal, contextoAccesorio] = await Promise.all([
        consultarContextoExpediente(expedientePrincipalId),
        consultarContextoExpediente(accesorioId),
      ]);

      asegurarSinSoloPoderTecnicoNiFinanciero(actor);
      if (!actor.roles.some((r) => ROLES_NEGOCIO_DOCUMENTAL.includes(r))) {
        throw new ForbiddenError({
          code: 'SIN_FACULTAD_ACUMULACION',
          detail: 'No cuenta con rol operativo autorizado para acumular expedientes.',
        });
      }

      const idPersonaActor = await resolverIdPersonaActor(actor);
      asegurarNoAutoatencion(
        actor,
        idPersonaActor,
        contextoPrincipal.solicitanteId,
        'AUTOATENCION_PROHIBIDA: El solicitante no puede acumular su propio expediente personal.',
      );
      asegurarNoAutoatencion(
        actor,
        idPersonaActor,
        contextoAccesorio.solicitanteId,
        'AUTOATENCION_PROHIBIDA: El solicitante no puede acumular su propio expediente personal.',
      );

      const tieneCustodiaPrincipal = await tieneCustodiaEfectiva(
        pool,
        actor,
        contextoPrincipal.areaActualId,
        { permitirMesaEnAreaInicial: true, idPersonaActor },
      );
      if (!tieneCustodiaPrincipal) {
        throw new ForbiddenError({
          code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
          detail: 'No pertenece al área de custodia del expediente principal para acumular expedientes.',
        });
      }

      if (contextoPrincipal.estadoActual === 'ARCHIVADO' || contextoAccesorio.estadoActual === 'ARCHIVADO') {
        throw new DomainError({
          code: 'ESTADO_INVALIDO',
          message: 'No se pueden acumular expedientes que ya se encuentran en estado ARCHIVADO.',
        });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedientePrincipalId);
        const resultado = await cliente.query<{ id_acumulacion: string }>(
          'SELECT sigd_tra.acumular_expediente($1::uuid, $2::uuid, $3::text) AS id_acumulacion',
          [expedientePrincipalId, accesorioId, actoResolutivo],
        );
        const idAcumulacion = resultado.rows[0]?.id_acumulacion;

        await insertarEvento(cliente, {
          agregado: 'Expediente',
          tipo_evento: 'ExpedienteAcumulado',
          payload: {
            expediente_principal_id: expedientePrincipalId,
            expediente_accesorio_id: accesorioId,
            acto_resolutivo: actoResolutivo,
            id_acumulacion: idAcumulacion,
          },
        });

        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Expediente acumulado formalmente según Art. 160 LPAG.',
          idAcumulacion,
          expedientePrincipalId,
          expedienteAccesorioId: accesorioId,
        });
      } catch (error: any) {
        await cliente.query('ROLLBACK').catch(() => {});
        if (error?.code === '02000') {
          throw new NotFoundError({ detail: error.message || 'Expediente principal o accesorio no encontrado.' });
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/acumular', handlerAcumular);
  router.post('/:id/movimientos/acumular', handlerAcumular);

  // ===========================================================================
  // Endpoint: Observación Formal de Requisitos / Trámite (5G)
  // ===========================================================================
  const handlerObservar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const motivo = req.body.motivo || req.body.observacion || 'Expediente observado por requisitos pendientes';

      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para observar el expediente.' });
      }

      validarActorNoAdministradoNiPersonal(
        req,
        actor,
        'En contexto personal el usuario no dispone de facultades para registrar observaciones institucionales.',
        'Los administrados no tienen autorización para observar expedientes.',
      );

      const contextoExp = await consultarContextoExpediente(expedienteId);
      asegurarSinSoloPoderTecnicoNiFinanciero(actor);
      if (!actor.roles.some((r) => ROLES_NEGOCIO_DOCUMENTAL.includes(r))) {
        throw new ForbiddenError({ detail: 'No cuenta con rol operativo habilitado para observar expedientes.' });
      }

      const idPersonaActor = await resolverIdPersonaActor(actor);

      // Autoatención
      asegurarNoAutoatencion(
        actor,
        idPersonaActor,
        contextoExp.solicitanteId,
        'AUTOATENCION_PROHIBIDA: El solicitante no puede auto-observar su propio expediente.',
      );

      // Custodia fail-closed por área (incluye Mesa de Partes en EN_CALIFICACION o encargatura vigente)
      const tieneCustodiaObs = await tieneCustodiaEfectiva(pool, actor, contextoExp.areaActualId, {
        permitirMesaEnAreaInicial: contextoExp.estadoActual === 'EN_CALIFICACION',
        idPersonaActor,
      });

      if (!tieneCustodiaObs) {
        throw new ForbiddenError({
          code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
          detail: 'No tiene custodia sobre el expediente para registrar observaciones.',
        });
      }

      // Validación FSM canónica: únicamente EN_CALIFICACION y EN_REVISION
      const estadosPermitidosObservacion = ['EN_CALIFICACION', 'EN_REVISION'];
      if (!estadosPermitidosObservacion.includes(contextoExp.estadoActual)) {
        throw new DomainError({
          code: 'ESTADO_INVALIDO',
          message: `El expediente en estado ${contextoExp.estadoActual} no puede ser observado.`,
        });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);
        await observarExpediente(cliente, expedienteId, motivo, {
          personaId: idPersonaActor ?? undefined,
          requisitosAfectados: req.body.requisitosAfectados,
          areaId: (contextoExp.areaActualId || actor.unidadOrganicaId) ?? undefined,
        });
        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Observación registrada exitosamente.',
          expedienteId,
          motivo,
          estado: 'OBSERVADO',
          slaPaused: true,
        });
      } catch (error) {
        try {
          await cliente.query('ROLLBACK');
        } catch {
          // Ignorar fallo de rollback
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/observar', handlerObservar);
  router.post('/:id/movimientos/observar', handlerObservar);

  // ===========================================================================
  // Endpoint: Subsanación de Observación (5G)
  // ===========================================================================
  const handlerSubsanar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para subsanar el expediente.' });
      }

      const motivoCrudo: unknown = req.body?.motivo ?? req.body?.detalle;
      const motivo = typeof motivoCrudo === 'string' ? motivoCrudo.trim() : '';
      if (motivo.length < 3) {
        throw new ValidationError({
          invalidParams: [{ name: 'motivo', reason: 'La subsanación requiere un motivo de al menos tres caracteres.' }],
        });
      }

      const contextoExp = await consultarContextoExpediente(expedienteId);
      const idPersonaActor = await resolverIdPersonaActor(actor);

      // Solo titular del expediente o personal de Mesa de Partes en contexto institucional con custodia en ventanilla/área
      const esTitular = Boolean(
        contextoExp.solicitanteId &&
          ((idPersonaActor && idPersonaActor === contextoExp.solicitanteId) ||
            actor.id === contextoExp.solicitanteId),
      );

      if (!esTitular) {
        const contextoOperacion = resolverContextoOperacion(req, actor);
        if (contextoOperacion === 'PERSONAL') {
          throw new ForbiddenError({
            code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
            detail: 'Solo el titular administrado o personal de Mesa de Partes en contexto institucional puede subsanar el expediente.',
          });
        }
        asegurarSinSoloPoderTecnicoNiFinanciero(actor);

        const esMesaConCustodia =
          actor.roles.includes('MESA_PARTES') &&
          (await tieneCustodiaEfectiva(pool, actor, contextoExp.areaActualId, {
            permitirMesaEnAreaInicial: true,
            idPersonaActor,
          }));
        if (!esMesaConCustodia) {
          throw new ForbiddenError({
            code: 'SIN_FACULTAD_SUBSANACION',
            detail: 'Solo el titular administrado o personal de Mesa de Partes puede subsanar el expediente.',
          });
        }
      }

      if (contextoExp.estadoActual !== 'OBSERVADO') {
        throw new DomainError({
          code: 'ESTADO_INVALIDO',
          message: `Solo se pueden subsanar expedientes en estado OBSERVADO (actual: ${contextoExp.estadoActual}).`,
        });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);
        await subsanarExpediente(cliente, expedienteId, motivo, {
          personaId: idPersonaActor ?? undefined,
        });
        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Subsanación registrada exitosamente. Pendiente de inicio de revisión institucional.',
          expedienteId,
          motivo,
          estado: 'SUBSANADO',
          estadoRutaDoc: 'SUBSANADO',
          pestana: 'EN_TRAMITE',
        });
      } catch (error) {
        try {
          await cliente.query('ROLLBACK');
        } catch {
          // Ignorar fallo de rollback
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/subsanar', handlerSubsanar);
  router.post('/:id/movimientos/subsanar', handlerSubsanar);

  // ===========================================================================
  // Endpoint: Iniciar Revisión Formal tras Subsanación (C3.6.2 / RutaDoc FSM)
  // ===========================================================================
  const handlerIniciarRevision = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const motivo = req.body?.motivo ? String(req.body.motivo).trim() : undefined;

      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para iniciar revisión.' });
      }

      validarActorNoAdministradoNiPersonal(
        req,
        actor,
        'En contexto personal el usuario no dispone de facultades para iniciar revisión de expedientes.',
        'Los administrados no tienen autorización para iniciar revisión de expedientes.',
        'ADMINISTRADO_NO_AUTORIZADO',
      );

      const contextoExp = await consultarContextoExpediente(expedienteId);
      asegurarSinSoloPoderTecnicoNiFinanciero(actor);
      if (!actor.roles.some((r) => ROLES_NEGOCIO_DOCUMENTAL.includes(r))) {
        throw new ForbiddenError({ detail: 'No cuenta con rol operativo habilitado para iniciar revisión.' });
      }

      const idPersonaActor = await resolverIdPersonaActor(actor);

      // Autoatención prohibida
      asegurarNoAutoatencion(
        actor,
        idPersonaActor,
        contextoExp.solicitanteId,
        'AUTOATENCION_PROHIBIDA: El solicitante no puede iniciar revisión de su propio expediente personal.',
      );

      // Validar estado actual FSM
      if (contextoExp.estadoActual !== 'SUBSANADO') {
        throw new DomainError({
          code: 'ESTADO_INVALIDO',
          message: `Solo se puede iniciar revisión de expedientes en estado SUBSANADO (actual: ${contextoExp.estadoActual}).`,
        });
      }

      // BOLA / Custodia fail-closed sin bypass de DIRECTOR ni ADMINISTRADOR
      const tieneCustodiaInicioRev = await tieneCustodiaEfectiva(pool, actor, contextoExp.areaActualId, {
        permitirMesaEnAreaInicial: true,
        idPersonaActor,
      });
      if (!tieneCustodiaInicioRev) {
        throw new ForbiddenError({
          code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
          detail: 'No pertenece al área responsable ni cuenta con custodia del expediente para iniciar la revisión.',
        });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);
        const { movimientoId } = await iniciarRevisionExpediente(cliente, expedienteId, motivo);
        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Revisión formal del expediente iniciada exitosamente.',
          expediente_id: expedienteId,
          expedienteId,
          movimientoId,
          estado: 'EN_REVISION',
          estadoRutaDoc: 'EN_REVISION',
          nuevoEstado: 'EN_REVISION',
        });
      } catch (error) {
        try {
          await cliente.query('ROLLBACK');
        } catch {
          // Ignorar fallo de rollback
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  router.post('/:id/iniciar-revision', handlerIniciarRevision);
  router.post('/:id/movimientos/iniciar-revision', handlerIniciarRevision);

  // Endpoint de Calificación / Validación de Evidencia de Requisito
  router.post('/:id/requisitos/:idRequisito/calificar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const idRequisito = String(req.params.idRequisito);
      const { estadoValidacion, observacion } = req.body ?? {};

      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para calificar requisitos.' });
      }

      validarActorNoAdministradoNiPersonal(
        req,
        actor,
        'En contexto personal el usuario no dispone de facultades para calificar requisitos.',
        'Los administrados no tienen autorización para calificar requisitos.',
      );

      if (!['VALIDADO', 'OBSERVADO'].includes(estadoValidacion)) {
        throw new ValidationError({
          invalidParams: [{ name: 'estadoValidacion', reason: 'Debe ser VALIDADO u OBSERVADO.' }],
        });
      }

      const contextoExp = await consultarContextoExpediente(expedienteId);
      asegurarSinSoloPoderTecnicoNiFinanciero(actor);
      if (!actor.roles.some((r) => ROLES_NEGOCIO_DOCUMENTAL.includes(r))) {
        throw new ForbiddenError({ detail: 'No cuenta con rol operativo habilitado para calificar requisitos.' });
      }

      const idPersonaActor = await resolverIdPersonaActor(actor);
      asegurarNoAutoatencion(
        actor,
        idPersonaActor,
        contextoExp.solicitanteId,
        'AUTOATENCION_PROHIBIDA: El solicitante no puede calificar requisitos de su propio expediente personal.',
      );

      const tieneCustodiaCalif = await tieneCustodiaEfectiva(pool, actor, contextoExp.areaActualId, {
        permitirMesaEnAreaInicial: true,
        idPersonaActor,
      });
      if (!tieneCustodiaCalif) {
        throw new ForbiddenError({
          code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
          detail: 'No pertenece al área de custodia del expediente para calificar requisitos.',
        });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const { rows: evRows } = await cliente.query<{ id_evidencia: string }>(`
          SELECT id_evidencia
            FROM sigd_doc.expediente_evidencia_requisito
           WHERE expediente_id = $1::uuid AND id_requisito = $2::uuid
           ORDER BY creado_en DESC
           LIMIT 1
        `, [expedienteId, idRequisito]);

        if (evRows.length > 0) {
          await cliente.query(`
            UPDATE sigd_doc.expediente_evidencia_requisito
               SET estado_validacion = $1,
                   observacion = COALESCE($2, observacion),
                   validado_por = $3::uuid,
                   validado_en = now()
             WHERE id_evidencia = $4::uuid
          `, [estadoValidacion, observacion ?? null, actor.id, evRows[0].id_evidencia]);
        } else {
          const { rows: expRows } = await cliente.query<{ solicitante_id: string }>(`
            SELECT solicitante_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid
          `, [expedienteId]);

          if (expRows.length > 0) {
            await cliente.query(`
              INSERT INTO sigd_doc.expediente_evidencia_requisito (
                expediente_id, id_requisito, tipo_evidencia, id_persona, id_usuario,
                canal, estado_validacion, observacion, validado_por, validado_en
              ) VALUES (
                $1::uuid, $2::uuid, 'DOCUMENTO', $3::uuid, $4::uuid,
                'PRESENCIAL', $5, $6, $4::uuid, now()
              )
            `, [
              expedienteId,
              idRequisito,
              expRows[0].solicitante_id,
              actor.id,
              estadoValidacion,
              observacion ?? null,
            ]);
          }
        }
        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: `Requisito ${estadoValidacion === 'VALIDADO' ? 'conformado' : 'observado'} exitosamente.`,
          expedienteId,
          idRequisito,
          estadoValidacion,
        });
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  // Endpoint de Consulta Centralizada de Elegibilidad de Derivación
  router.get('/:id/elegibilidad-derivacion', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para consultar elegibilidad.' });
      }
      const elegibilidad = await evaluarElegibilidadDerivacion(pool, expedienteId);
      res.status(200).json(elegibilidad);
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // Endpoints: Asignación Operativa Individual (5G)
  // ===========================================================================
  router.post('/:id/asignar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para asignar expediente.' });
      }

      validarActorNoAdministradoNiPersonal(
        req,
        actor,
        'En contexto personal no se pueden asignar expedientes a funcionarios.',
        'Los administrados no tienen autorización para asignar expedientes.',
      );

      const contextoExp = await consultarContextoExpediente(expedienteId);
      const idPersonaActor = await resolverIdPersonaActor(actor);

      const esSecretario = actor.roles.includes('SECRETARIO');
      const esDirector = actor.roles.includes('DIRECTOR');
      let tieneEncargatura = false;
      if (esDirector) {
        tieneEncargatura = await verificarEncargaturaDespacho(pool, actor.id, contextoExp.areaActualId, idPersonaActor);
      }

      if (!esSecretario && !tieneEncargatura) {
        throw new ForbiddenError({
          code: 'SIN_FACULTAD_ASIGNACION',
          message: esDirector
            ? 'El rol DIRECTOR no posee facultad de asignación ordinaria de especialistas sin una encargatura o delegación vigente en el área de custodia.'
            : 'Solo el Secretario del área con custodia o funcionario con encargatura/delegación vigente posee facultades para asignar expedientes.',
        });
      }

      asegurarSinSoloPoderTecnicoNiFinanciero(actor);
      asegurarNoAutoatencion(
        actor,
        idPersonaActor,
        contextoExp.solicitanteId,
        'AUTOATENCION_PROHIBIDA: El solicitante no puede gestionar asignaciones de su propio expediente personal.',
      );

      if (!tieneEncargatura && (!actor.unidadOrganicaId || actor.unidadOrganicaId !== contextoExp.areaActualId)) {
        throw new ForbiddenError({
          code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
          detail: 'No pertenece al área de custodia del expediente para gestionar asignaciones.',
        });
      }

      const { idPersona, idUsuario, motivo } = req.body;
      if (!idPersona || !idUsuario || !motivo) {
        throw new ValidationError({
          message: 'Se requieren idPersona, idUsuario y motivo para realizar la asignación operativa.',
        });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);

        const asignacion = await asignacionSvc.asignarExpediente(
          {
            expedienteId,
            idPersona,
            idUsuario,
            motivo,
            asignadoPorUsuarioId: actor.id,
          },
          cliente,
        );

        // Avanzar workflow a paso de asignación si existe
        try {
          const contextoExp = await consultarContextoExpediente(expedienteId);
          await workflowSvc.avanzarPasoExpediente(
            expedienteId,
            actor.id,
            contextoExp.areaActualId,
            'ASIGNACION',
            motivo,
            cliente,
          );
        } catch {
          // Sin workflow
        }

        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Expediente asignado exitosamente al funcionario.',
          asignacion,
        });
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/desasignar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para desasignar expediente.' });
      }

      validarActorNoAdministradoNiPersonal(
        req,
        actor,
        'En contexto personal no se pueden desasignar expedientes.',
        'Los administrados no tienen autorización para desasignar expedientes.',
      );

      const contextoExp = await consultarContextoExpediente(expedienteId);
      asegurarSinSoloPoderTecnicoNiFinanciero(actor);
      const idPersonaActor = await resolverIdPersonaActor(actor);
      asegurarNoAutoatencion(
        actor,
        idPersonaActor,
        contextoExp.solicitanteId,
        'AUTOATENCION_PROHIBIDA: El solicitante no puede gestionar asignaciones de su propio expediente personal.',
      );

      const esSecretario = actor.roles.includes('SECRETARIO');
      const esDirector = actor.roles.includes('DIRECTOR');
      let tieneEncargatura = false;
      if (esDirector) {
        tieneEncargatura = await verificarEncargaturaDespacho(pool, actor.id, contextoExp.areaActualId, idPersonaActor);
      }

      if (!esSecretario && !tieneEncargatura) {
        throw new ForbiddenError({
          code: 'SIN_FACULTAD_ASIGNACION',
          message: esDirector
            ? 'El rol DIRECTOR no posee facultad de asignación ordinaria de especialistas sin una encargatura o delegación vigente en el área de custodia.'
            : 'Solo el Secretario del área con custodia o funcionario con encargatura/delegación vigente posee facultades para desasignar expedientes.',
        });
      }

      if (!tieneEncargatura && (!actor.unidadOrganicaId || actor.unidadOrganicaId !== contextoExp.areaActualId)) {
        throw new ForbiddenError({
          code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
          detail: 'No pertenece al área de custodia del expediente para gestionar asignaciones.',
        });
      }

      const motivo = req.body?.motivo || 'Desasignación operativa por reubicación o cese';

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);
        await asignacionSvc.desasignarExpediente(expedienteId, actor.id, motivo, cliente);
        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Expediente desasignado exitosamente. La custodia continúa en el área institucional.',
        });
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/asignacion', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para consultar asignaciones.' });
      }
      if (actor.puedeVerExpediente) {
        const autorizado = await actor.puedeVerExpediente(expedienteId);
        if (!autorizado) {
          throw new ForbiddenError({
            detail: `No tiene autorización para ver la asignación del expediente ${expedienteId}.`,
          });
        }
      }
      const activaRaw = await asignacionSvc.obtenerAsignacionActiva(expedienteId);
      const historialRaw = await asignacionSvc.listarHistorialAsignaciones(expedienteId);
      const contextoOperacion = resolverContextoOperacion(req, actor);
      const idPersonaActor = await resolverIdPersonaActor(actor);
      const contextoExp = await consultarContextoExpediente(expedienteId);
      const esTitularPropio = Boolean(
        (idPersonaActor && idPersonaActor === contextoExp.solicitanteId) ||
          actor.id === contextoExp.solicitanteId,
      );
      const puedeVerNombreAsignado =
        contextoOperacion === 'INSTITUCIONAL' &&
        !esTitularPropio &&
        actor.roles.some((r) =>
          ['DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'MESA_PARTES', 'TESORERIA', 'ADMINISTRADOR', 'SUPERADMINISTRADOR'].includes(r),
        );

      const sanitizarAsignacion = <T extends Record<string, any> | null>(item: T): T => {
        if (!item || puedeVerNombreAsignado) return item;
        const { nombreCompleto: _nc, personaNombre: _pn, usuario: _u, ...rest } = item;
        return rest as T;
      };

      const activa = sanitizarAsignacion(activaRaw);
      const historial = historialRaw.map((h) => sanitizarAsignacion(h));
      const candidatos = puedeVerNombreAsignado
        ? await asignacionSvc.listarCandidatosAsignacion(expedienteId)
        : [];
      res.status(200).json({
        ok: true,
        activa,
        historial,
        candidatos,
      });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // Endpoints: Observaciones y Trazabilidad Estructurada (5G)
  // ===========================================================================
  router.get('/:id/observaciones', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para consultar observaciones.' });
      }
      if (actor.puedeVerExpediente) {
        const autorizado = await actor.puedeVerExpediente(expedienteId);
        if (!autorizado) {
          throw new ForbiddenError({
            detail: `No tiene autorización para ver las observaciones del expediente ${expedienteId}.`,
          });
        }
      }
      const observaciones = await observacionSvc.listarObservacionesPorExpediente(expedienteId);
      res.status(200).json({
        ok: true,
        observaciones,
        total: observaciones.length,
      });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // Endpoints: Motor de Workflow Versionado (5G)
  // ===========================================================================
  router.get('/:id/workflow', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para consultar workflow.' });
      }
      if (actor.puedeVerExpediente) {
        const autorizado = await actor.puedeVerExpediente(expedienteId);
        if (!autorizado) {
          throw new ForbiddenError({
            detail: `No tiene autorización para ver el workflow del expediente ${expedienteId}.`,
          });
        }
      }
      const instancia = await workflowSvc.obtenerInstanciaPorExpediente(expedienteId);
      res.status(200).json({
        ok: true,
        instancia,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/workflows/definiciones', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para registrar workflow.' });
      }
      const esAdmin = actor.roles.some((r) => ['ADMINISTRADOR', 'DIRECTOR'].includes(r));
      if (!esAdmin) {
        throw new ForbiddenError({ detail: 'Se requiere rol directivo o administrativo para definir workflows.' });
      }

      const definicion = await workflowSvc.registrarDefinicion(req.body);
      res.status(201).json({
        ok: true,
        mensaje: 'Definición de workflow registrada exitosamente.',
        definicion,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/workflows/versiones', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para versionar workflow.' });
      }
      const esAdmin = actor.roles.some((r) => ['ADMINISTRADOR', 'DIRECTOR'].includes(r));
      if (!esAdmin) {
        throw new ForbiddenError({ detail: 'Se requiere rol directivo o administrativo para versionar workflows.' });
      }

      const version = await workflowSvc.registrarVersion(req.body);
      res.status(201).json({
        ok: true,
        mensaje: 'Versión de workflow registrada exitosamente.',
        version,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/workflows/asociar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para asociar workflow.' });
      }
      const esAdmin = actor.roles.some((r) => ['ADMINISTRADOR', 'DIRECTOR'].includes(r));
      if (!esAdmin) {
        throw new ForbiddenError({ detail: 'Se requiere rol directivo o administrativo para asociar workflows.' });
      }

      const { idProcedimiento, idVersionWorkflow } = req.body;
      if (!idProcedimiento || !idVersionWorkflow) {
        throw new ValidationError({ message: 'Se requieren idProcedimiento e idVersionWorkflow.' });
      }

      await workflowSvc.asociarWorkflowAProcedimiento(idProcedimiento, idVersionWorkflow);
      res.status(200).json({
        ok: true,
        mensaje: 'Workflow versionado asociado exitosamente al procedimiento.',
      });
    } catch (error) {
      next(error);
    }
  });

  // ===========================================================================
  // Endpoint: Consulta de Acumulaciones (Art. 160 LPAG)
  // ===========================================================================
  const handlerListarAcumulaciones = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (actor?.puedeVerExpediente) {
        const autorizado = await actor.puedeVerExpediente(expedienteId);
        if (!autorizado) {
          throw new ForbiddenError({
            detail: `No tiene autorización para ver las acumulaciones del expediente ${expedienteId}.`,
          });
        }
      }

      const resultado = await pool.query(`
        SELECT
          a.id_acumulacion,
          a.expediente_principal,
          ep.codigo_expediente AS codigo_principal,
          a.expediente_accesorio,
          ea.codigo_expediente AS codigo_accesorio,
          a.acto_resolutivo,
          a.estado,
          a.fecha_acumulacion,
          a.fecha_desacumulacion
        FROM sigd_tra.expediente_acumulacion a
        JOIN sigd_tra.expediente ep ON ep.expediente_id = a.expediente_principal
        JOIN sigd_tra.expediente ea ON ea.expediente_id = a.expediente_accesorio
        WHERE (a.expediente_principal = $1::uuid OR a.expediente_accesorio = $1::uuid)
          AND a.estado = 'ACUMULADO'
        ORDER BY a.fecha_acumulacion DESC
      `, [expedienteId]);

      res.status(200).json({
        ok: true,
        acumulaciones: resultado.rows,
        total: resultado.rowCount,
      });
    } catch (error) {
      next(error);
    }
  };

  router.get('/:id/acumulaciones', handlerListarAcumulaciones);
  router.get('/:id/movimientos/acumulaciones', handlerListarAcumulaciones);

  return router;
}

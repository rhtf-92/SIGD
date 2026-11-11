import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
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

  // ===========================================================================
  // Endpoint: Derivación Documentaria (T-BE-RD-06 / 5G)
  // ===========================================================================
  const handlerDerivar = async (req: Request, res: Response, next: NextFunction) => {
    try {
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

        // 1. Verificación de Obligación Financiera Homologada (Principio 5F/5G: solo requisitos HOMOLOGADOS bloquean)
        const reqFinancieroRes = await cliente.query<{
          id_requisito: string;
          nombre: string;
          estado_homologacion: string;
        }>(`
          SELECT r.id_requisito, r.nombre, r.estado_homologacion
            FROM sigd_doc.expediente_tupa_vinculo v
            JOIN sigd_doc.tupa_requisito_documental r
              ON r.registro_version_id = v.registro_version_id
           WHERE v.expediente_id = $1::uuid
             AND v.reemplaza_vinculo_id IS NULL
             AND r.activo = true
             AND r.obligatorio = true
             AND r.tipo_requisito = 'FINANCIERO'
           ORDER BY (r.estado_homologacion = 'HOMOLOGADO') DESC
           LIMIT 1
        `, [expedienteId]);

        const reqFinanciero = reqFinancieroRes.rows[0];

        // REGLA CANÓNICA: Solo si el requisito financiero está formalmente HOMOLOGADO puede bloquear institucionalmente
        if (reqFinanciero && reqFinanciero.estado_homologacion === 'HOMOLOGADO') {
          const pagoRes = await cliente.query<{ estado: string; monto: number }>(`
            SELECT estado, monto
              FROM sigd_tra.orden_pago
             WHERE expediente_id = $1::uuid
             ORDER BY fecha_creacion DESC
             LIMIT 1
          `, [expedienteId]);

          const orden = pagoRes.rows[0];
          if (!orden || orden.estado !== 'CONFIRMADO') {
            throw new ConflictError({
              code: 'PAGO_PENDIENTE',
              message: 'El expediente requiere pago confirmado antes de continuar.',
              detail: `Existe un requisito financiero homologado obligatorio ('${reqFinanciero.nombre}') sin pago confirmado (estado actual: ${orden?.estado ?? 'SIN_ORDEN'}).`,
            });
          }
        }

        // 2. Validación de Actor y Contexto de Operación
        const actor = await resolverActor(req);
        if (!actor) {
          throw new UnauthorizedError({ detail: 'Autenticación requerida para derivar el expediente.' });
        }

        const contextoOperacion = resolverContextoOperacion(req, actor);
        if (contextoOperacion === 'PERSONAL') {
          throw new ForbiddenError({
            code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
            detail: 'En contexto personal el usuario no dispone de facultades para derivar expedientes institucionales.',
          });
        }

        const esAdministrado = actor.roles.some((r) => ['CIUDADANO', 'ESTUDIANTE'].includes(r));
        if (esAdministrado) {
          throw new ForbiddenError({ detail: 'Los administrados no tienen autorización para derivar expedientes.' });
        }

        const contextoExp = await consultarContextoExpediente(expedienteId);
        const idPersonaActor = await resolverIdPersonaActor(actor);

        // Regla de Autoatención
        if (
          (idPersonaActor && idPersonaActor === contextoExp.solicitanteId) ||
          actor.id === contextoExp.solicitanteId
        ) {
          throw new ForbiddenError({
            code: 'CONFLICTO_INTERES_EXPEDIENTE_PROPIO',
            detail: 'AUTOATENCION_PROHIBIDA: El solicitante no puede derivar su propio expediente o solicitud personal.',
          });
        }

        // Verificación de tenencia de custodia en el área
        const esAdminGlobal = actor.roles.some((r) => ['ADMINISTRADOR', 'DIRECTOR'].includes(r));
        if (!esAdminGlobal) {
          let tieneCustodia = false;
          if (actor.unidadOrganicaId && actor.unidadOrganicaId === contextoExp.areaActualId) {
            tieneCustodia = true;
          } else if (actor.roles.some((r) => ['ESPECIALISTA', 'SECRETARIO', 'MESA_PARTES'].includes(r))) {
            if (['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION'].includes(contextoExp.estadoActual)) {
              tieneCustodia = true;
            } else if (actor.unidadOrganicaId === contextoExp.areaActualId) {
              tieneCustodia = true;
            }
          }
          if (!tieneCustodia) {
            throw new ForbiddenError({
              code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
              detail: 'No pertenece al área de custodia actual para derivar el expediente.',
            });
          }
        }

        // 3. Validación de áreas de destino
        for (const destino of datos.destinos) {
          const resArea = await cliente.query<{ id_area: string; nombre: string; vigente: boolean }>(
            `SELECT area_id AS id_area, nombre, vigente FROM sigd_org.area WHERE area_id = $1::uuid`,
            [destino.area_destino_id],
          );
          if (resArea.rowCount === 0) {
            throw new NotFoundError({
              detail: `DESTINO_INVALIDO: El área de destino ${destino.area_destino_id} no existe en la estructura orgánica.`,
            });
          }
          if (!resArea.rows[0].vigente) {
            throw new DomainError({
              code: 'DESTINO_INACTIVO',
              message: `DESTINO_INACTIVO: El área de destino ${destino.area_destino_id} (${resArea.rows[0].nombre}) se encuentra inactiva o dada de baja.`,
            });
          }
        }

        await derivarExpediente(cliente, expedienteId, datos);

        const areaDestinoId = datos.destinos[0]?.area_destino_id;
        let updateRes;
        if (areaDestinoId) {
          updateRes = await cliente.query(
            `UPDATE sigd_tra.expediente
                SET estado = 'DERIVADO', area_destino_id = $2::uuid
              WHERE expediente_id = $1::uuid
                AND estado IN ('REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO', 'EN_REVISION', 'SUBSANADO')`,
            [expedienteId, areaDestinoId],
          );
        } else {
          updateRes = await cliente.query(
            `UPDATE sigd_tra.expediente
                SET estado = 'DERIVADO'
              WHERE expediente_id = $1::uuid
                AND estado IN ('REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO', 'EN_REVISION', 'SUBSANADO')`,
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
        await cliente.query('ROLLBACK').catch(() => {});
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
  // Endpoint: Recepción en Área de Destino (T-BE-RD-06 / 5G)
  // ===========================================================================
  const handlerRecepcionar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para recepcionar el expediente.' });
      }

      const contextoOperacion = resolverContextoOperacion(req, actor);
      if (contextoOperacion === 'PERSONAL') {
        throw new ForbiddenError({
          code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
          detail: 'En contexto personal el usuario no dispone de facultades para recepcionar expedientes.',
        });
      }

      const esAdministrado = actor.roles.some((r) => ['CIUDADANO', 'ESTUDIANTE'].includes(r));
      if (esAdministrado) {
        throw new ForbiddenError({ detail: 'Los administrados no tienen autorización para recepcionar expedientes.' });
      }

      const contextoExp = await consultarContextoExpediente(expedienteId);
      const idPersonaActor = await resolverIdPersonaActor(actor);

      // Autoatención
      if (
        (idPersonaActor && idPersonaActor === contextoExp.solicitanteId) ||
        actor.id === contextoExp.solicitanteId
      ) {
        throw new ForbiddenError({
          code: 'CONFLICTO_INTERES_EXPEDIENTE_PROPIO',
          detail: 'AUTOATENCION_PROHIBIDA: El solicitante no puede recepcionar su propio expediente personal.',
        });
      }

      // BOLA: Verificar pertenencia al área de destino
      const esAdminGlobal = actor.roles.some((r) => ['ADMINISTRADOR', 'DIRECTOR'].includes(r));
      if (!esAdminGlobal) {
        let tieneCustodia = false;
        if (actor.unidadOrganicaId && actor.unidadOrganicaId === contextoExp.areaActualId) {
          tieneCustodia = true;
        } else if (actor.roles.some((r) => ['ESPECIALISTA', 'SECRETARIO', 'MESA_PARTES'].includes(r))) {
          if (actor.unidadOrganicaId && actor.unidadOrganicaId === contextoExp.areaActualId) {
            tieneCustodia = true;
          }
        }
        if (!tieneCustodia) {
          throw new ForbiddenError({
            code: 'BOLA_VIOLATION_CUSTODIA_AJENA',
            detail: 'No pertenece al área de destino para recepcionar el expediente.',
          });
        }
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
        await cliente.query('ROLLBACK').catch(() => {});
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
        actor.roles.includes('ADMINISTRADOR') &&
        !actor.roles.some((r) => ['DIRECTOR', 'SECRETARIO', 'ESPECIALISTA'].includes(r));

      if (esSoloAdminTecnico) {
        throw new ForbiddenError({
          code: 'PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO',
          detail: 'El perfil ADMINISTRADOR posee control técnico y no confiere facultades de resolución sustantiva ni emisión de resoluciones.',
        });
      }

      // Verificar custodia o director
      const esDirector = actor.roles.includes('DIRECTOR');
      if (!esDirector) {
        let tieneCustodia = false;
        if (actor.unidadOrganicaId && actor.unidadOrganicaId === contextoExp.areaActualId) {
          tieneCustodia = true;
        } else if (actor.roles.some((r) => ['ESPECIALISTA', 'SECRETARIO'].includes(r))) {
          if (actor.unidadOrganicaId && actor.unidadOrganicaId === contextoExp.areaActualId) {
            tieneCustodia = true;
          }
        }
        if (!tieneCustodia) {
          throw new ForbiddenError({ detail: 'No cuenta con facultades en el área para atender el expediente.' });
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

        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Atención resolutiva registrada exitosamente.',
          expediente_id: expedienteId,
          expedienteId,
          nuevoEstado: 'RESUELTO',
        });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
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

      const contextoOperacion = resolverContextoOperacion(req, actor);
      if (contextoOperacion === 'PERSONAL') {
        throw new ForbiddenError({
          code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
          detail: 'En contexto personal el usuario no dispone de facultades institucionales.',
        });
      }

      const esAdministrado = actor.roles.some((r) => ['CIUDADANO', 'ESTUDIANTE'].includes(r));
      if (esAdministrado) {
        throw new ForbiddenError({ detail: 'Los administrados no tienen autorización para remitir a firma.' });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);

        const resultado = await enviarAFirmaExpediente(cliente, expedienteId, {
          resultado_resumen: req.body.resultado_resumen || 'Pase formal para emisión y firma de resolución',
          observacion_interna: req.body.observacion_interna,
        });

        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Expediente remitido a despacho en estado EN_FIRMA exitosamente.',
          expedienteId,
          nuevoEstado: 'EN_FIRMA',
          ...resultado,
        });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
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

      const contextoOperacion = resolverContextoOperacion(req, actor);
      if (contextoOperacion === 'PERSONAL') {
        throw new ForbiddenError({
          code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
          detail: 'En contexto personal el usuario no dispone de facultades resolutivas.',
        });
      }

      const esAdministrado = actor.roles.some((r) => ['CIUDADANO', 'ESTUDIANTE'].includes(r));
      if (esAdministrado) {
        throw new ForbiddenError({ detail: 'Los administrados no tienen facultades resolutivas.' });
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await bloquearExpedienteRutaDoc(cliente, expedienteId);

        const resultado = await resolverExpedienteConFirma(cliente, expedienteId, datos);

        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Expediente resuelto formalmente con firma digitalizada/criptográfica válida.',
          expedienteId,
          nuevoEstado: 'RESUELTO',
          ...resultado,
        });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
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

      const contextoOperacion = resolverContextoOperacion(req, actor);
      if (contextoOperacion === 'PERSONAL') {
        throw new ForbiddenError({
          code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
          detail: 'En contexto personal el usuario no dispone de facultades para archivar expedientes.',
        });
      }

      const tienePermisoArchivo = actor.roles.some((r) =>
        ['ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'MESA_PARTES', 'SUPER_ADMIN'].includes(r),
      );
      if (!tienePermisoArchivo) {
        throw new ForbiddenError({ detail: 'No cuenta con rol habilitado para el archivado físico del expediente.' });
      }

      const contextoExp = await consultarContextoExpediente(expedienteId);
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
        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Archivado físico registrado exitosamente.',
          expediente_id: expedienteId,
          expedienteId,
          nuevoEstado: 'ARCHIVADO',
        });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
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
      if (actor?.puedeVerExpediente) {
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

      const contextoOperacion = resolverContextoOperacion(req, actor);
      if (contextoOperacion === 'PERSONAL') {
        throw new ForbiddenError({
          code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
          detail: 'En contexto personal el usuario no dispone de facultades para registrar observaciones institucionales.',
        });
      }

      const esAdministrado = actor.roles.some((r) => ['CIUDADANO', 'ESTUDIANTE'].includes(r));
      if (esAdministrado) {
        throw new ForbiddenError({ detail: 'Los administrados no tienen autorización para observar expedientes.' });
      }

      const contextoExp = await consultarContextoExpediente(expedienteId);
      const idPersonaActor = await resolverIdPersonaActor(actor);

      // Autoatención
      if (
        (idPersonaActor && idPersonaActor === contextoExp.solicitanteId) ||
        actor.id === contextoExp.solicitanteId
      ) {
        throw new ForbiddenError({
          code: 'CONFLICTO_INTERES_EXPEDIENTE_PROPIO',
          detail: 'AUTOATENCION_PROHIBIDA: El solicitante no puede auto-observar su propio expediente.',
        });
      }

      // Custodia
      const esAdminOInstitucional = actor.roles.some((r) =>
        ['ADMINISTRADOR', 'DIRECTOR'].includes(r),
      );

      if (!esAdminOInstitucional) {
        let tieneCustodia = false;
        if (actor.roles.includes('MESA_PARTES')) {
          if (contextoExp.estadoActual === 'EN_CALIFICACION') {
            tieneCustodia = true;
          } else if (actor.unidadOrganicaId && actor.unidadOrganicaId === contextoExp.areaActualId) {
            tieneCustodia = true;
          }
        } else if (actor.unidadOrganicaId && actor.unidadOrganicaId === contextoExp.areaActualId) {
          tieneCustodia = true;
        }

        if (!tieneCustodia) {
          throw new ForbiddenError({ detail: 'No tiene custodia sobre el expediente para registrar observaciones.' });
        }
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
        await cliente.query('ROLLBACK').catch(() => {});
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

      // Titular o Mesa de Partes
      const esAdminOInstitucional = actor.roles.some((r) =>
        ['ADMINISTRADOR', 'DIRECTOR', 'MESA_PARTES'].includes(r),
      );

      if (!esAdminOInstitucional) {
        const esTitular = Boolean(
          (idPersonaActor && idPersonaActor === contextoExp.solicitanteId) ||
          actor.id === contextoExp.solicitanteId
        );
        if (!esTitular) {
          throw new ForbiddenError({ detail: 'Solo el titular administrado o personal de Mesa de Partes puede subsanar el expediente.' });
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
          mensaje: 'Subsanación registrada exitosamente.',
          expedienteId,
          motivo,
          estado: 'EN_REVISION',
          estadoRutaDoc: 'EN_REVISION',
          pestana: 'EN_TRAMITE',
        });
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
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
  // Endpoints: Asignación Operativa Individual (5G)
  // ===========================================================================
  router.post('/:id/asignar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para asignar expediente.' });
      }

      const contextoOperacion = resolverContextoOperacion(req, actor);
      if (contextoOperacion === 'PERSONAL') {
        throw new ForbiddenError({
          code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
          detail: 'En contexto personal no se pueden asignar expedientes a funcionarios.',
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

      const contextoOperacion = resolverContextoOperacion(req, actor);
      if (contextoOperacion === 'PERSONAL') {
        throw new ForbiddenError({
          code: 'CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES',
          detail: 'En contexto personal no se pueden desasignar expedientes.',
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
      const activa = await asignacionSvc.obtenerAsignacionActiva(expedienteId);
      const historial = await asignacionSvc.listarHistorialAsignaciones(expedienteId);
      res.status(200).json({
        ok: true,
        activa,
        historial,
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

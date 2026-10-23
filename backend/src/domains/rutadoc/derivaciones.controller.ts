import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import { DerivarExpedienteSchema } from './dto/derivarExpediente.dto.js';
import { AtenderExpedienteSchema } from './dto/atenderExpediente.dto.js';
import { ArchivarExpedienteSchema } from './dto/archivarExpediente.dto.js';
import {
  derivarExpediente,
  atenderExpediente,
  archivarExpediente,
  observarExpediente,
  subsanarExpediente,
} from './derivaciones.service.js';
import { ConflictError, DomainError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../shared/domain/errors/index.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import type { ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import type { ActorRutaDoc } from './rutadoc.types.js';

interface ContextoExpedienteRutaDoc {
  expedienteId: string;
  solicitanteId: string;
  estadoActual: string;
  areaActualId: string;
}

export function crearRouterDerivaciones(pool: Pool, proveedorActor?: ActorProviderRutaDoc): Router {
  const router = Router();

  async function resolverActor(req: Request): Promise<ActorRutaDoc | null> {
    if ((req as any).actor) {
      return (req as any).actor as ActorRutaDoc;
    }
    if (proveedorActor) {
      return await proveedorActor.obtenerActor(req);
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

  // Endpoint #24 (T-BE-RD-06) - Derivación Documentaria
  // Prefijo esperado en app.ts: /api/v1/expedientes
  const handlerDerivar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      // 1. Validación del contrato de entrada mediante Zod
      const datos = DerivarExpedienteSchema.parse(req.body);

      // 2. Obtener conexión del pool para garantizar atomicidad
      const cliente = await pool.connect();

      try {
        await cliente.query('BEGIN');

        // Ejecución de la lógica de negocio
        await derivarExpediente(cliente, expedienteId, datos);

        // Sincronización en sigd_tra.expediente para reflejar área de destino y estado
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

        // Confirmar transacción
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

  // Endpoint #25 (T-BE-RD-07) - Atención Resolutiva
  router.post('/:id/atender', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const datos = AtenderExpedienteSchema.parse(req.body);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await atenderExpediente(cliente, expedienteId, datos);
        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Atención resolutiva registrada exitosamente.',
          expediente_id: expedienteId,
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
  });

  // Endpoint (T-BE-RD-08) - Archivado Formal
  router.post('/:id/archivar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const datos = ArchivarExpedienteSchema.parse(req.body);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await archivarExpediente(cliente, expedienteId, datos);
        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Archivado fisico registrado exitosamente.',
          expediente_id: expedienteId,
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
  });

  // Endpoints #29-acum (T-BE-RD-11) — Acumulación de Expedientes (Art. 160 LPAG)
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
        const resultado = await cliente.query<{ id_acumulacion: string }>(
          'SELECT sigd_tra.acumular_expediente($1::uuid, $2::uuid, $3::text) AS id_acumulacion',
          [expedientePrincipalId, accesorioId, actoResolutivo],
        );
        const idAcumulacion = resultado.rows[0]?.id_acumulacion;

        // DAT-04: Outbox transaccional para acumulación formal de expedientes
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
          idAcumulacion: resultado.rows[0]?.id_acumulacion,
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

  // Endpoints #25-obs — Observación de Expediente
  const handlerObservar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const motivo = req.body.motivo || req.body.observacion || 'Expediente observado por requisitos pendientes';

      // 1. Autenticación y resolución del actor
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para observar el expediente.' });
      }

      // 2. Obtener contexto del expediente (valida existencia)
      const contexto = await consultarContextoExpediente(expedienteId);

      // 3. Autorización de objeto general
      if (actor.puedeVerExpediente) {
        const autorizado = await actor.puedeVerExpediente(expedienteId);
        if (!autorizado) {
          throw new ForbiddenError({ detail: 'No tiene autorización para observar este expediente.' });
        }
      }

      // 4. Autorización específica de rol y custodia para OBSERVAR
      const esAdminOInstitucional = actor.roles.some((r) =>
        ['ADMINISTRADOR', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN'].includes(r),
      );

      if (!esAdminOInstitucional) {
        const esAdministrado = actor.roles.some((r) =>
          ['CIUDADANO', 'ESTUDIANTE'].includes(r),
        );
        if (esAdministrado) {
          throw new ForbiddenError({ detail: 'Los administrados no tienen autorización para observar expedientes.' });
        }

        let tieneCustodia = false;
        if (actor.roles.includes('MESA_PARTES')) {
          if (contexto.estadoActual === 'EN_CALIFICACION') {
            tieneCustodia = true;
          } else if (actor.unidadOrganicaId && actor.unidadOrganicaId === contexto.areaActualId) {
            tieneCustodia = true;
          }
        } else if (actor.unidadOrganicaId && actor.unidadOrganicaId === contexto.areaActualId) {
          tieneCustodia = true;
        }

        if (!tieneCustodia) {
          throw new ForbiddenError({ detail: 'No tiene custodia sobre el expediente para registrar observaciones.' });
        }
      }

      // 5. Validación FSM canónica: únicamente EN_CALIFICACION y EN_REVISION
      const estadosPermitidosObservacion = ['EN_CALIFICACION', 'EN_REVISION'];
      if (!estadosPermitidosObservacion.includes(contexto.estadoActual)) {
        throw new DomainError({
          code: 'ESTADO_INVALIDO',
          message: `El expediente en estado ${contexto.estadoActual} no puede ser observado.`,
        });
      }

      // 6. Transacción atómica de mutación
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await observarExpediente(cliente, expedienteId, motivo);
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

  // Endpoints #26-sub — Subsanación de Expediente
  const handlerSubsanar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const motivo = req.body.motivo || req.body.detalle || 'Subsanación de observaciones presentada por el administrado';

      // 1. Autenticación y resolución del actor
      const actor = await resolverActor(req);
      if (!actor) {
        throw new UnauthorizedError({ detail: 'Autenticación requerida para subsanar el expediente.' });
      }

      // 2. Obtener contexto del expediente (valida existencia)
      const contexto = await consultarContextoExpediente(expedienteId);

      // 3. Autorización de objeto general
      if (actor.puedeVerExpediente) {
        const autorizado = await actor.puedeVerExpediente(expedienteId);
        if (!autorizado) {
          throw new ForbiddenError({ detail: 'No tiene autorización para subsanar este expediente.' });
        }
      }

      // 4. Autorización específica de titularidad / rol institucional para SUBSANAR
      const esAdminOInstitucional = actor.roles.some((r) =>
        ['ADMINISTRADOR', 'DIRECTOR', 'MESA_PARTES', 'SUPER_ADMIN', 'ADMIN'].includes(r),
      );

      if (!esAdminOInstitucional) {
        const idPersonaActor = await resolverIdPersonaActor(actor);
        const esTitular = Boolean(idPersonaActor && idPersonaActor === contexto.solicitanteId);

        if (!esTitular) {
          throw new ForbiddenError({ detail: 'Solo el titular o personal autorizado puede subsanar el expediente.' });
        }
      }

      // 5. Validación FSM previa: solo se pueden subsanar expedientes en estado OBSERVADO
      if (contexto.estadoActual !== 'OBSERVADO') {
        throw new DomainError({
          code: 'ESTADO_INVALIDO',
          message: `Solo se pueden subsanar expedientes en estado OBSERVADO (actual: ${contexto.estadoActual}).`,
        });
      }

      // 6. Transacción atómica de mutación
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await subsanarExpediente(cliente, expedienteId, motivo);
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

  // Consulta de Acumulaciones (Art. 160 LPAG)
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


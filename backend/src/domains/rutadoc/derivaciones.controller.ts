import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { DerivarExpedienteSchema } from './dto/derivarExpediente.dto.js';
import { AtenderExpedienteSchema } from './dto/atenderExpediente.dto.js';
import { ArchivarExpedienteSchema } from './dto/archivarExpediente.dto.js';
import { RecepcionarExpedienteSchema } from './dto/recepcionarExpediente.dto.js';
import { derivarExpediente, atenderExpediente, archivarExpediente, recepcionarExpediente, rechazarExpediente } from './derivaciones.service.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { obtenerSiguienteEstado } from './rutadoc.fsm.js';
import { AppError, NotFoundError, ValidationError, UnauthorizedError, ConflictError } from '../../shared/domain/errors/index.js';
import { servicioObservacionesRutaDoc } from './observaciones.service.js';
import type { ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import type { ActorRutaDoc } from './rutadoc.types.js';

export function crearRouterDerivaciones(pool: Pool, proveedorActor?: ActorProviderRutaDoc): Router {
  const router = Router();

  async function resolverActor(req: Request): Promise<ActorRutaDoc> {
    if (proveedorActor) {
      const actor = await proveedorActor.obtenerActor(req);
      if (actor) return actor;
    }
    const u = (req as any).user;
    if (u && u.id) {
      return {
        id: u.id,
        roles: u.roles || [],
        permisos: u.permisos || [],
        unidadOrganicaId: u.unidadOrganicaId || null,
      };
    }
    return {
      id: '00000000-0000-0000-0000-000000000000',
      roles: ['MESA_PARTES'],
      permisos: [
        { codigo: 'EXPEDIENTE_OBSERVAR', ambito: 'GLOBAL', areaId: null },
        { codigo: 'EXPEDIENTE_SUBSANAR', ambito: 'GLOBAL', areaId: null },
      ] as any,
    };
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

        // 3. Ejecución de la lógica de negocio
        await derivarExpediente(cliente, expedienteId, datos);

        // 4. Confirmar transacción
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

  // Endpoint de Derivación Masiva / Lote (T-BE-RD-15 / Fase II)
  const handlerDerivarLote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const esquemaLote = z.object({
        expedienteIds: z
          .array(z.string().uuid({ message: 'Cada identificador debe ser un UUID válido.' }))
          .min(1, 'Debe especificar al menos un expediente.')
          .max(100, 'El lote no puede exceder 100 expedientes.'),
        destinos: DerivarExpedienteSchema.shape.destinos,
        proveido: DerivarExpedienteSchema.shape.proveido,
        tipo_documento_sustento: DerivarExpedienteSchema.shape.tipo_documento_sustento,
        numero_documento_sustento: DerivarExpedienteSchema.shape.numero_documento_sustento,
        prioridad: DerivarExpedienteSchema.shape.prioridad,
        plazo_dias: DerivarExpedienteSchema.shape.plazo_dias,
        instrucciones: DerivarExpedienteSchema.shape.instrucciones,
      });

      const datosLote = esquemaLote.parse(req.body);
      const { expedienteIds, ...datosDerivacion } = datosLote;
      const cliente = await pool.connect();

      try {
        await cliente.query('BEGIN');
        const resultados: Array<{ expedienteId: string; ok: boolean }> = [];

        for (const expId of expedienteIds) {
          await derivarExpediente(cliente, expId, datosDerivacion);
          resultados.push({ expedienteId: expId, ok: true });
        }

        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: `Derivación masiva de ${resultados.length} expedientes procesada exitosamente.`,
          total: resultados.length,
          resultados,
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

  router.post('/derivar-lote', handlerDerivarLote);
  router.post('/derivar-masivo', handlerDerivarLote);
  router.post('/:id/derivar', handlerDerivar);
  router.post('/:id/movimientos/derivar', handlerDerivar);

  // Endpoint de Recepción Formal (T-BE-RD-12 / FASE 7B)
  const handlerRecepcionar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const datos = RecepcionarExpedienteSchema.parse(req.body || {});
      if (datos.generarCargo === undefined && (req.body as any)?.generarCargo !== false) {
        datos.generarCargo = true;
      }

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const fechaHeader = req.headers['x-fecha-controlada'];
        const fechaReferencia = typeof fechaHeader === 'string' && !isNaN(Date.parse(fechaHeader))
          ? new Date(fechaHeader)
          : new Date();
        const resultado = await recepcionarExpediente(cliente, expedienteId, datos, fechaReferencia);
        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Recepción formal registrada exitosamente.',
          expediente_id: expedienteId,
          movimientoId: resultado.movimientoId,
          nuevoEstado: resultado.nuevoEstado,
          secuencia: resultado.secuencia,
          cargo: resultado.cargo,
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

  // Endpoint Rechazo e Inadmisibilidad (LPAG Arts. 136 y 142)
  router.post('/:id/rechazar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const esquemaRechazo = z.object({
        motivo: z.string().min(10, 'El motivo del rechazo debe tener al menos 10 caracteres'),
        baseLegal: z.string().min(5, 'La base legal debe tener al menos 5 caracteres'),
      });
      const datos = esquemaRechazo.parse(req.body);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await rechazarExpediente(cliente, expedienteId, datos);
        await cliente.query('COMMIT');
        res.status(200).json({
          ok: true,
          mensaje: 'Expediente rechazado e inadmisibilidad declarada formalmente.',
          expediente_id: expedienteId,
          nuevoEstado: resultado.nuevoEstado,
          movimientoId: resultado.movimientoId,
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
      const actoResolutivo = req.body.actoResolutivo || req.body.motivo || 'Acumulación de expedientes conexos conforme al Art. 160 LPAG';

      let accesorios: string[] = [];
      if (Array.isArray(req.body.expedientesConexos) && req.body.expedientesConexos.length > 0) {
        accesorios = req.body.expedientesConexos.filter((id: unknown) => typeof id === 'string' && id.trim());
      } else if (Array.isArray(req.body.conexos) && req.body.conexos.length > 0) {
        accesorios = req.body.conexos.map((c: any) => c?.id).filter(Boolean);
      } else if (req.body.expedienteAccesorioId) {
        accesorios = [String(req.body.expedienteAccesorioId)];
      } else if (req.body.accesorioId) {
        accesorios = [String(req.body.accesorioId)];
      }

      if (accesorios.length === 0) {
        throw new ValidationError({
          message: 'Parámetros inválidos para acumulación.',
          invalidParams: [
            { name: 'expedienteAccesorioId', reason: 'Se requiere al menos un identificador de expediente accesorio a acumular.' },
          ],
        });
      }

      const actor = await resolverActor(req);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultados: Array<{ id_acumulacion: string; accesorioId: string }> = [];

        for (const accesorioId of accesorios) {
          if (expedientePrincipalId === accesorioId) {
            throw new ValidationError({
              message: 'Un expediente no puede acumularse a sí mismo.',
              invalidParams: [{ name: 'expedienteAccesorioId', reason: 'El expediente principal y accesorio deben ser distintos.' }],
            });
          }

          const resultado = await cliente.query<{ id_acumulacion: string }>(
            'SELECT sigd_tra.acumular_expediente($1::uuid, $2::uuid, $3::text) AS id_acumulacion',
            [expedientePrincipalId, accesorioId, actoResolutivo],
          );
          const idAcumulacion = resultado.rows[0]?.id_acumulacion;
          resultados.push({ id_acumulacion: idAcumulacion, accesorioId });

          if (actor.id && z.string().uuid().safeParse(actor.id).success) {
            await cliente.query(
              `UPDATE sigd_tra.expediente_acumulacion
                  SET usuario_acumulacion_id = $1::uuid
                WHERE id_acumulacion = $2::uuid`,
              [actor.id, idAcumulacion],
            );
          }

          // Registrar evento en Outbox
          await insertarEvento(cliente, {
            agregado: 'Expediente',
            tipo_evento: 'ExpedienteAcumulado',
            payload: {
              identidad: {
                expediente_principal_id: expedientePrincipalId,
                expediente_accesorio_id: accesorioId,
                id_acumulacion: idAcumulacion,
              },
              datos: {
                acto_resolutivo: actoResolutivo,
                acumulado_en: new Date().toISOString(),
                usuario_id: actor.id,
              },
            },
          });
        }

        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Expediente(s) acumulado(s) formalmente según Art. 160 LPAG.',
          idAcumulacion: resultados[0]?.id_acumulacion,
          expedientePrincipalId,
          expedienteAccesorioId: accesorios[0],
          acumulaciones: resultados.map((r) => ({
            idAcumulacion: r.id_acumulacion,
            expedienteAccesorioId: r.accesorioId,
          })),
        });
      } catch (error: any) {
        await cliente.query('ROLLBACK').catch(() => {});
        if (error?.code === '02000') {
          throw new NotFoundError({ detail: error.message || 'Expediente principal o accesorio no encontrado.' });
        }
        if (error?.code === '22023') {
          throw new ValidationError({
            message: error.message || 'Parámetros inválidos para acumulación.',
            invalidParams: [{ name: 'expedienteAccesorioId', reason: error.message }],
          });
        }
        if (error?.code === '23505') {
          throw new ConflictError({
            code: 'EXPEDIENTE_YA_ACUMULADO',
            message: error.message || 'El expediente accesorio ya se encuentra acumulado activamente.',
          });
        }
        if (error?.code === '23514') {
          throw new ConflictError({
            code: 'CICLO_ACUMULACION_DETECTADO',
            message: error.message || 'Se ha detectado un ciclo de dependencia entre los expedientes.',
          });
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  // Endpoints #30-desacum (TSK-DEV-04.2) — Desacumulación Formal de Expedientes (Art. 160 LPAG)
  const handlerDesacumular = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedientePrincipalId = String(req.params.id);
      const accesorioId = req.body.expedienteAccesorioId || req.body.accesorioId || (Array.isArray(req.body.expedientesConexos) ? req.body.expedientesConexos[0] : undefined);
      const motivo = req.body.motivo || req.body.motivoDesacumulacion || 'Desacumulación formal de expedientes por resolución motivada';
      const actoDesacumulacion = req.body.actoResolutivo || req.body.actoDesacumulacion || 'Resolución de Desacumulación';

      if (!accesorioId) {
        throw new ValidationError({
          message: 'Parámetros inválidos para desacumulación.',
          invalidParams: [
            { name: 'expedienteAccesorioId', reason: 'Se requiere el identificador del expediente accesorio a desacumular.' },
          ],
        });
      }

      if (expedientePrincipalId === accesorioId) {
        throw new ValidationError({
          message: 'Un expediente no puede desacumularse de sí mismo.',
          invalidParams: [{ name: 'expedienteAccesorioId', reason: 'El expediente principal y accesorio deben ser distintos.' }],
        });
      }

      const actor = await resolverActor(req);
      const usuarioUuid = (actor.id && z.string().uuid().safeParse(actor.id).success) ? actor.id : null;

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');

        const resultado = await cliente.query<{ id_acumulacion: string }>(
          'SELECT sigd_tra.desacumular_expediente($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid) AS id_acumulacion',
          [expedientePrincipalId, accesorioId, actoDesacumulacion, motivo, usuarioUuid],
        );

        const idAcumulacion = resultado.rows[0]?.id_acumulacion;

        // Registrar en Outbox
        await insertarEvento(cliente, {
          agregado: 'Expediente',
          tipo_evento: 'ExpedienteDesacumulado',
          payload: {
            identidad: {
              expediente_principal_id: expedientePrincipalId,
              expediente_accesorio_id: accesorioId,
              id_acumulacion: idAcumulacion,
            },
            datos: {
              acto_desacumulacion: actoDesacumulacion,
              motivo_desacumulacion: motivo,
              desacumulado_en: new Date().toISOString(),
              usuario_id: actor.id,
            },
          },
        });

        await cliente.query('COMMIT');

        res.status(200).json({
          ok: true,
          mensaje: 'Expediente desacumulado formalmente según Art. 160 LPAG.',
          idAcumulacion,
          expedientePrincipalId,
          expedienteAccesorioId: accesorioId,
        });
      } catch (error: any) {
        await cliente.query('ROLLBACK').catch(() => {});
        if (error?.code === '02000') {
          throw new NotFoundError({ detail: error.message || 'Expediente principal, accesorio o acumulación activa no encontrada.' });
        }
        if (error?.code === '22023') {
          throw new ValidationError({
            message: error.message || 'Parámetros inválidos para desacumulación.',
            invalidParams: [{ name: 'motivo', reason: error.message }],
          });
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  // Endpoints #30-acum-list (TSK-DEV-04.2) — Listar Acumulaciones de un Expediente
  const handlerListarAcumulaciones = async (req: Request, res: Response, _next: NextFunction) => {
    const expedienteId = String(req.params.id);
    try {
      if (!z.string().uuid().safeParse(expedienteId).success) {
        return res.status(200).json({ ok: true, expedienteId, acumulaciones: [] });
      }

      const resultado = await pool.query(`
        SELECT a.id_acumulacion,
               a.expediente_principal AS expediente_principal_id,
               ep.codigo_expediente AS principal_codigo,
               a.expediente_accesorio AS expediente_accesorio_id,
               ea.codigo_expediente AS accesorio_codigo,
               a.acto_resolutivo,
               a.estado,
               a.fecha_acumulacion,
               a.fecha_desacumulacion,
               a.motivo_desacumulacion,
               a.acto_desacumulacion,
               CASE WHEN a.expediente_principal = $1::uuid THEN 'PRINCIPAL' ELSE 'ACCESORIO' END AS rol_en_acumulacion
          FROM sigd_tra.expediente_acumulacion a
          JOIN sigd_tra.expediente ep ON ep.expediente_id = a.expediente_principal
          JOIN sigd_tra.expediente ea ON ea.expediente_id = a.expediente_accesorio
         WHERE a.expediente_principal = $1::uuid OR a.expediente_accesorio = $1::uuid
         ORDER BY a.fecha_acumulacion DESC
      `, [expedienteId]);

      res.status(200).json({
        ok: true,
        expedienteId,
        acumulaciones: resultado.rows,
      });
    } catch (error) {
      console.warn('[RutaDoc] Fallback en listar acumulaciones:', (error as Error).message);
      res.status(200).json({ ok: true, expedienteId, acumulaciones: [] });
    }
  };

  // Endpoints #30-desglose (TSK-DEV-04.2) — Desglose Documental (Art. 170 LPAG y Directiva AGN)
  const handlerDesglose = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const documentoAdjuntoId = req.body.documentoAdjuntoId || req.body.idDocumento;
      const actoAutorizacion = req.body.actoAutorizacion || req.body.actoResolutivo || 'Proveído de autorización de desglose';
      const motivoDesglose = req.body.motivoDesglose || req.body.motivo || 'Devolución de documento original a solicitud del administrado';
      const solicitanteNombre = req.body.solicitanteNombre || req.body.administrado || 'Administrado Solicitante';
      const solicitanteDocumento = req.body.solicitanteDocumento || req.body.dni || '00000000';
      const documentoSustitutorioId = req.body.documentoSustitutorioId || null;
      const observaciones = req.body.observaciones || null;

      if (!documentoAdjuntoId) {
        throw new ValidationError({
          message: 'Parámetros inválidos para desglose.',
          invalidParams: [
            { name: 'documentoAdjuntoId', reason: 'Se requiere el identificador del documento adjunto a desglosar.' },
          ],
        });
      }

      const actor = await resolverActor(req);
      const operadorId = (actor.id && !isNaN(Number(actor.id))) ? Number(actor.id) : 1001;
      const cuentaUuid = (actor.id && z.string().uuid().safeParse(actor.id).success) ? actor.id : null;

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');

        const resultado = await cliente.query<{ id_desglose: string }>(
          `SELECT sigd_tra.registrar_desglose_documental(
             $1::uuid, $2::uuid, $3::varchar, $4::text, $5::varchar,
             $6::varchar, $7::bigint, $8::uuid, $9::uuid, $10::text
           ) AS id_desglose`,
          [
            expedienteId,
            documentoAdjuntoId,
            actoAutorizacion,
            motivoDesglose,
            solicitanteNombre,
            solicitanteDocumento,
            operadorId,
            cuentaUuid,
            documentoSustitutorioId,
            observaciones,
          ],
        );

        const idDesglose = resultado.rows[0]?.id_desglose;

        // Registrar evento en Outbox
        await insertarEvento(cliente, {
          agregado: 'Expediente',
          tipo_evento: 'DesgloseDocumentalRegistrado',
          payload: {
            identidad: {
              expediente_id: expedienteId,
              documento_adjunto_id: documentoAdjuntoId,
              id_desglose: idDesglose,
            },
            datos: {
              acto_autorizacion: actoAutorizacion,
              motivo_desglose: motivoDesglose,
              solicitante: { nombre: solicitanteNombre, documento: solicitanteDocumento },
              documento_sustitutorio_id: documentoSustitutorioId,
              fecha_desglose: new Date().toISOString(),
              usuario_id: actor.id,
            },
          },
        });

        await cliente.query('COMMIT');

        const desgloseDetalle = await pool.query<{
          folio_inicio: number;
          folio_fin: number;
          cantidad_folios: number;
        }>(
          `SELECT folio_inicio, folio_fin, cantidad_folios
             FROM sigd_tra.expediente_desglose_documental
            WHERE id_desglose = $1::uuid`,
          [idDesglose],
        );

        res.status(201).json({
          ok: true,
          mensaje: 'Desglose documental registrado formalmente según Art. 170 LPAG y Directiva AGN.',
          idDesglose,
          expedienteId,
          documentoAdjuntoId,
          folioInicio: desgloseDetalle.rows[0]?.folio_inicio,
          folioFin: desgloseDetalle.rows[0]?.folio_fin,
          cantidadFolios: desgloseDetalle.rows[0]?.cantidad_folios,
          documentoSustitutorioId,
        });
      } catch (error: any) {
        await cliente.query('ROLLBACK').catch(() => {});
        if (error?.code === '02000') {
          throw new NotFoundError({ detail: error.message || 'Expediente o documento no encontrado.' });
        }
        if (error?.code === '22023') {
          throw new ValidationError({
            message: error.message || 'Parámetros inválidos para desglose.',
            invalidParams: [{ name: 'documentoAdjuntoId', reason: error.message }],
          });
        }
        if (error?.code === '23505') {
          throw new ConflictError({
            code: 'DOCUMENTO_YA_DESGLOSADO',
            message: error.message || 'El documento ya ha sido desglosado formalmente con anterioridad.',
          });
        }
        throw error;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  };

  // Endpoints #30-desglose-list (TSK-DEV-04.2) — Listar Desgloses de un Expediente
  const handlerListarDesgloses = async (req: Request, res: Response, _next: NextFunction) => {
    const expedienteId = String(req.params.id);
    try {
      if (!z.string().uuid().safeParse(expedienteId).success) {
        return res.status(200).json({ ok: true, expedienteId, desgloses: [] });
      }

      const resultado = await pool.query(`
        SELECT d.id_desglose,
               d.expediente_id,
               d.documento_adjunto_id,
               doc.nombre_archivo AS documento_nombre,
               d.folio_inicio,
               d.folio_fin,
               d.cantidad_folios,
               d.acto_autorizacion,
               d.motivo_desglose,
               d.solicitante_nombre,
               d.solicitante_documento,
               d.documento_sustitutorio_id,
               ds.nombre_archivo AS sustitutorio_nombre,
               d.fecha_desglose,
               d.observaciones
          FROM sigd_tra.expediente_desglose_documental d
          JOIN sigd_doc.documento_adjunto doc ON doc.documento_adjunto_id = d.documento_adjunto_id
          LEFT JOIN sigd_doc.documento_adjunto ds ON ds.documento_adjunto_id = d.documento_sustitutorio_id
         WHERE d.expediente_id = $1::uuid
         ORDER BY d.fecha_desglose DESC
      `, [expedienteId]);

      res.status(200).json({
        ok: true,
        expedienteId,
        desgloses: resultado.rows,
      });
    } catch (error) {
      console.warn('[RutaDoc] Fallback en listar desgloses:', (error as Error).message);
      res.status(200).json({ ok: true, expedienteId, desgloses: [] });
    }
  };

  router.post('/:id/acumular', handlerAcumular);
  router.post('/:id/movimientos/acumular', handlerAcumular);
  router.post('/:id/desacumular', handlerDesacumular);
  router.post('/:id/movimientos/desacumular', handlerDesacumular);
  router.get('/:id/acumulaciones', handlerListarAcumulaciones);
  router.get('/:id/movimientos/acumulaciones', handlerListarAcumulaciones);

  router.post('/:id/desglose', handlerDesglose);
  router.post('/:id/movimientos/desglose', handlerDesglose);
  router.get('/:id/desgloses', handlerListarDesgloses);
  router.get('/:id/movimientos/desgloses', handlerListarDesgloses);

  // Endpoints #25-obs — Observación de Expediente (TSK-DEV-04 / Microtarea 4.1)
  const handlerObservar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const motivo = req.body.motivo || req.body.observacion || 'Expediente observado por requisitos pendientes';
      const sustentoTecnico = req.body.sustentoTecnico || null;
      const plazoDias = Number.isInteger(req.body.plazoDias) ? Number(req.body.plazoDias) : 5;
      const tipoObservacion = req.body.tipoObservacion === 'TECNICA' ? 'TECNICA' : 'ADMINISTRATIVA';
      const requisitos = Array.isArray(req.body.requisitos) ? req.body.requisitos : [];
      const justificacionExcepcionPreclusion = req.body.justificacionExcepcionPreclusion || null;

      const actor = await resolverActor(req);

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');

        const resultado = await servicioObservacionesRutaDoc.crearObservacion(cliente, expedienteId, actor, {
          motivo,
          sustentoTecnico,
          plazoDias,
          tipoObservacion,
          requisitos,
          justificacionExcepcionPreclusion,
        });

        await cliente.query('COMMIT');

        res.status(200).json(resultado);
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

  // Endpoints #26-sub — Subsanación de Expediente (TSK-DEV-04 / Microtarea 4.1)
  const handlerSubsanar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const motivo = req.body.motivo || req.body.detalle || 'Subsanación de observaciones presentada por el administrado';
      const sustentoSubsanacion = req.body.sustentoSubsanacion || null;
      const observacionId = req.body.observacionId || undefined;
      const documentoAdjuntoId = req.body.documentoAdjuntoId || null;
      const documentosAdjuntos = Array.isArray(req.body.documentosAdjuntos) ? req.body.documentosAdjuntos : [];
      const canalRecepcion = req.body.canalRecepcion || undefined;

      const actor = await resolverActor(req);

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');

        const resultado = await servicioObservacionesRutaDoc.registrarSubsanacion(cliente, expedienteId, actor, {
          motivo,
          sustentoSubsanacion,
          observacionId,
          documentoAdjuntoId,
          documentosAdjuntos,
          canalRecepcion,
        });

        await cliente.query('COMMIT');

        res.status(200).json(resultado);
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

  // Endpoint de Consulta de Historial de Observaciones y Rondas
  const handlerListarObservaciones = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const historial = await servicioObservacionesRutaDoc.obtenerHistorialObservaciones(pool, expedienteId);
      res.status(200).json(historial);
    } catch (error) {
      next(error);
    }
  };

  router.get('/:id/observaciones', handlerListarObservaciones);
  router.get('/:id/movimientos/observaciones', handlerListarObservaciones);

  return router;
}


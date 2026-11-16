import crypto from 'node:crypto';
import { obtenerDocumentacionTramite } from './documentacionTramite.service.js';
import { Router, raw, type Request, type Response } from 'express';
import { analizarPdfBuffer } from './pdfFoliacion.js';
import type { Pool } from 'pg';
import { z } from 'zod';
import { ConsultaPublicaService } from './consultaPublica.service.js';
import { RadicacionVirtualService, type ProveedorFeriados } from './radicacionVirtual.service.js';
import { VentanillaPresencialService, identidadNaturalVentanillaSchema } from './ventanillaPresencial.service.js';
import { TicketTermicoUtil } from './ticketTermico.util.js';
import { consultaPublicaParamsSchema, radicacionVirtualSchema } from './tramites.schemas.js';
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../shared/domain/errors/index.js';
import { extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';
import { obtenerAutorizacionCuenta } from '../../core/auth/auth.guard.js';
import { setUsuarioId } from '../../shared/request-context/request-context.js';
import { CATALOGO_TUPA_2026 } from './catalogoTupa2026.js';
import { generarOrdenPosterior, intentarOrdenPosterior } from '../tesoreria/ordenPosterior.service.js';
import { DevolucionesMesaPartesService, validarEstadoRevisionDevolucionMesa } from './devolucionesMesaPartes.service.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';

export const ventanillaPresencialSchema = z.object({
  ...identidadNaturalVentanillaSchema.shape,
  asunto: z.string().min(5).max(500),
  foliosTotales: z.coerce.number().int().positive(),
  areaDestinoId: z.string().uuid().optional(),
  tipoDocumentalId: z.string().uuid().optional(),
  idTipoTramiteTupa: radicacionVirtualSchema.innerType().shape.idTipoTramiteTupa.optional(),
  documentos: z.array(radicacionVirtualSchema.innerType().shape.documentos.element).optional(),
}).strict();

export function exigirClaimsAutenticado(authorization: string | undefined): { idUsuario: string; contextoId?: string } {
  const token = extraerTokenBearer(authorization);
  if (!token) throw new UnauthorizedError({ detail: 'Debe iniciar sesión para operar.' });
  const identidad = verificarTokenAcceso(token);
  const idUsuario = z.string().uuid().safeParse(identidad.sub);
  if (!idUsuario.success) throw new UnauthorizedError({ detail: 'Identidad inválida.' });
  return { idUsuario: idUsuario.data, contextoId: identidad.ctx };
}

export function exigirIdUsuarioAutenticado(authorization: string | undefined): string {
  const token = extraerTokenBearer(authorization);
  if (!token) {
    throw new UnauthorizedError({ detail: 'Debe iniciar sesión para radicar una solicitud virtual.' });
  }
  const identidad = verificarTokenAcceso(token);
  const idUsuario = z.string().uuid().safeParse(identidad.sub);
  if (!idUsuario.success) {
    throw new UnauthorizedError({ detail: 'La sesión no contiene una identidad de usuario válida.' });
  }
  return idUsuario.data;
}

/**
 * Endpoints del dominio TramiCore (Grupo 2 - OE2)
 *
 *   * #14 `POST /api/v1/tramites/radicacion-virtual` — radicación ciudadana en Mesa de Partes Virtual
 *   * #15 `POST /api/v1/tramites/ventanilla-presencial` — radicación física en ventanilla y ticket térmico
 *   * #15-Cat `GET /api/v1/tramites/tipos` / `/tramites/tupa` — catálogo de procedimientos TUPA
 *   * #16 `GET  /api/v1/tramites/consulta-publica/:cut` — consulta pública del estado procesal
 *   * #20 `GET  /api/v1/tramites/ventanilla/cargo/:cut` — datos del cargo de recepción física para impresión
 */
export function crearRouterTramites(
  pool: Pool,
  obtenerFeriados?: ProveedorFeriados,
): Router {
  const router = Router();
  const radicacionService = new RadicacionVirtualService(pool, obtenerFeriados);
  const ventanillaService = new VentanillaPresencialService(pool);
  const consultaService = new ConsultaPublicaService(pool);
  const devolucionesMesaPartes = new DevolucionesMesaPartesService(pool);

  // El token identifica la cuenta; el rol puede haber caducado o sido revocado
  // desde su emisión. Reutilizar el RBAC vigente antes de acceder al servicio.
  async function exigirOperadorVentanilla(req: Request): Promise<void> {
    const { idUsuario, contextoId } = exigirClaimsAutenticado(req.get('authorization'));
    const autorizacion = await obtenerAutorizacionCuenta(pool, idUsuario, contextoId);
    if (!autorizacion) {
      throw new ForbiddenError({ detail: 'Cuenta institucional inactiva o no autorizada.' });
    }
    if (contextoId && autorizacion.contextoRevocado) {
      throw new AppError({
        status: 403,
        code: 'CONTEXT_REVOKED',
        message: 'El contexto activo ha sido revocado o no se encuentra vigente. Debe seleccionar un contexto vigente.',
      });
    }
    if (!autorizacion.roles.some((rol) => rol === 'MESA_PARTES' || rol === 'ADMINISTRADOR')) {
      throw new ForbiddenError({ detail: 'La operación presencial requiere el rol MESA_PARTES o ADMINISTRADOR vigente.' });
    }
  }

  async function exigirEvaluadorDevoluciones(req: Request): Promise<string> {
    const { idUsuario, contextoId } = exigirClaimsAutenticado(req.get('authorization'));
    const autorizacion = await obtenerAutorizacionCuenta(pool, idUsuario, contextoId);
    if (!autorizacion) {
      throw new ForbiddenError({ detail: 'Cuenta institucional inactiva o no autorizada.' });
    }
    if (contextoId && autorizacion.contextoRevocado) {
      throw new AppError({
        status: 403,
        code: 'CONTEXT_REVOKED',
        message: 'El contexto activo ha sido revocado o no se encuentra vigente. Debe seleccionar un contexto vigente.',
      });
    }
    const puede = autorizacion.roles.includes('MESA_PARTES') && autorizacion.permisos.some(p =>
      p.codigo === 'TRAMICORE_DEVOLUCION_EVALUAR' && p.ambito === 'GLOBAL' && p.areaId === null);
    if (!puede) throw new ForbiddenError({ detail: 'La evaluación de devoluciones requiere autorización vigente de Mesa de Partes.' });
    setUsuarioId(idUsuario);
    return idUsuario;
  }

  router.get('/tramites/devoluciones',async(req:Request,res:Response)=>{
    await exigirEvaluadorDevoluciones(req);
    res.setHeader('Cache-Control','no-store');
    res.status(200).json(await devolucionesMesaPartes.listar());
  });
  router.post('/tramites/devoluciones/:id/revision',async(req:Request,res:Response)=>{
    const actor=await exigirEvaluadorDevoluciones(req);
    const id=z.string().uuid().parse(req.params.id);
    const body=z.object({estado:z.string(),motivo:z.string().trim().min(10).max(2000)}).strict().parse(req.body);
    if(!validarEstadoRevisionDevolucionMesa(body.estado))throw new ValidationError({invalidParams:[{name:'estado',reason:'Estado no permitido en la revisión de Mesa de Partes.'}]});
    res.status(200).json(await devolucionesMesaPartes.revisar(actor,id,body.estado,body.motivo));
  });
  router.get('/tramites/devoluciones/:id/documentos/:documentoId',async(req:Request,res:Response)=>{
    await exigirEvaluadorDevoluciones(req);
    const id=z.string().uuid().parse(req.params.id),documentoId=z.string().uuid().parse(req.params.documentoId);
    const doc=(await pool.query(`SELECT td.bucket,td.clave,td.nombre FROM sigd_tes.documento td
      WHERE td.id=$1 AND EXISTS(SELECT 1 FROM sigd_tes.devolucion d JOIN sigd_tes.pago p ON p.id=d.pago_id
        WHERE d.id=$2 AND (d.documento_id=td.id OR p.documento_id=td.id OR EXISTS(SELECT 1 FROM sigd_tes.devolucion_documento_folio df WHERE df.devolucion_id=d.id AND df.documento_id=td.id)))`,[documentoId,id])).rows[0];
    if(!doc)throw new NotFoundError({detail:'No se encontró el documento asociado a esta solicitud.'});
    res.setHeader('Cache-Control','no-store');
    res.status(200).json({url:generarUrlPresigned(doc.clave,{...obtenerConfiguracionS3(),bucket:doc.bucket},{metodo:'GET',expiraSegundos:60}),nombre:doc.nombre});
  });

  // #14 — Radicación virtual (Mesa de Partes Virtual 24x7)
  router.post('/tramites/radicacion-virtual', async (req: Request, res: Response) => {
    const idUsuario = exigirIdUsuarioAutenticado(req.get('authorization'));
    setUsuarioId(idUsuario);
    const datos = radicacionVirtualSchema.parse(req.body);
    const radicacion = await radicacionService.radicar(datos, idUsuario);
    res.status(201).json({
      expedienteId: radicacion.expedienteId,
      cut: radicacion.cut,
      anioFiscal: radicacion.anio,
      fechaEnvioReal: radicacion.fechaEnvioReal,
      fechaRadicacionLegal: radicacion.fechaRadicacionLegal,
      diferidoPorCorte: radicacion.fueraDeHorario,
      totalFolios: radicacion.totalFolios,
      qrSeguimientoUrl: radicacion.cargoDigital.qrContenido,
      cargoDigital: radicacion.cargoDigital,
      mensajeLegal: radicacion.mensajeLegal,
      tesoreria: await intentarOrdenPosterior(pool,radicacion.expedienteId,{usuario:idUsuario}),
    });
  });

  router.post('/tramites/:expedienteId/orden-pago', async(req,res)=>{
    const usuario=exigirIdUsuarioAutenticado(req.get('authorization'));
    setUsuarioId(usuario);
    const id=z.string().uuid().parse(req.params.expedienteId);
    const datos=z.object({cantidad:z.number().int().min(1).max(10000).optional()}).strict().parse(req.body);
    res.json(await generarOrdenPosterior(pool,id,{usuario},datos.cantidad));
  });

  // #15 — Radicación física en Ventanilla Presencial
  router.post('/tramites/ventanilla-presencial', async (req: Request, res: Response) => {
    await exigirOperadorVentanilla(req);

    const datos = ventanillaPresencialSchema.parse(req.body);
    const resultado = await ventanillaService.registrarExpedienteVentanilla(datos);
    res.status(201).json(resultado);
  });

  // #15 en catálogo — Catálogo de tipos de trámite TUPA y trámites internos
  const handlerTiposTupa = async (_req: Request, res: Response) => {
    const query = `
      SELECT t.tipo_tramite_id AS id,
             t.tipo_tramite_id AS id_tipo_tramite,
             t.codigo,
             t.denominacion,
             t.descripcion,
             t.unidad_organica,
             t.plazo_dias,
             t.plazo_dias AS plazo_dias_habiles,
             t.silencio_administrativo,
             t.silencio_administrativo AS calificacion,
             t.base_legal,
             t.vigente,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'tipo_documental_id', td.tipo_documental_id,
                 'codigo', td.codigo,
                 'nombre', td.nombre,
                 'obligatorio', r.obligatorio
               ) ORDER BY td.codigo)
                FROM sigd_doc.requisito r
                JOIN sigd_doc.tipo_documento_requisito tdr ON tdr.requisito_id = r.requisito_id
                JOIN sigd_doc.tipo_documento td ON td.tipo_documental_id = tdr.tipo_documental_id
               WHERE r.tipo_tramite_id = t.tipo_tramite_id AND td.vigente = TRUE
               ), '[]'::json
             ) AS tipos_documentales
        FROM sigd_doc.tipo_tramite_tupa t
       WHERE t.vigente = TRUE
       ORDER BY t.codigo ASC;
    `;
    const resultado = await pool.query(query);
    res.status(200).json(resultado.rows);
  };

  router.get('/tramites/tipos', handlerTiposTupa);
  // Catálogo de consulta completo: incluye servicios/bienes que no son
  // automáticamente expedientes radicables. Las tarifas se muestran como
  // transcripción fuente y no habilitan órdenes M10 por sí solas.
  router.get('/tramites/catalogo-tupa-2026', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json(CATALOGO_TUPA_2026);
  });
  router.get(['/tramites/tipos/:id/documentacion', '/tramites/procedimientos/:id/documentacion'], async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await obtenerDocumentacionTramite(pool, z.string().uuid().parse(req.params.id)));
  });
  router.get('/tramites/tupa', handlerTiposTupa);

  // Análisis real de archivo PDF en backend (Páginas, estructura, cifrado y daño)
  router.post('/tramites/analizar-pdf', raw({ type: 'application/pdf', limit: 20 * 1024 * 1024 }), async (req: Request, res: Response) => {
    const bytes = req.body as Buffer;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      throw new ValidationError({ invalidParams: [{ name: 'archivo', reason: 'Se requiere un archivo PDF válido no vacío.' }] });
    }
    const analisis = await analizarPdfBuffer(bytes);
    res.status(200).json(analisis);
  });

  // Solicitud explícita de vinculación de expediente histórico a cuenta ciudadana
  router.post('/tramites/mis-expedientes/solicitar-vinculacion', async (req: Request, res: Response) => {
    const idUsuario = exigirIdUsuarioAutenticado(req.get('authorization'));
    const autorizacion = await obtenerAutorizacionCuenta(pool, idUsuario);
    if (!autorizacion?.roles.includes('CIUDADANO')) {
      throw new ForbiddenError({ detail: 'Esta operación está disponible exclusivamente para cuentas ciudadanas.' });
    }

    const schema = z.object({
      cut: z.string().trim().regex(/^EXP-\d{4}-\d{6}$/, 'Formato de CUT inválido (debe ser EXP-YYYY-XXXXXX).'),
      motivo: z.string().trim().min(5, 'Indique el motivo de la vinculación (mínimo 5 caracteres).').max(500),
      evidencia: z.string().trim().max(1000).optional(),
      evidenciaDocumental: z.string().trim().max(1000).optional(),
    }).strict();

    const bodyParsed = schema.parse(req.body);
    const cut = bodyParsed.cut;
    const motivo = bodyParsed.motivo;
    const evidencia = bodyParsed.evidencia ?? bodyParsed.evidenciaDocumental;

    const busqueda = await pool.query<{ expediente_id: string; solicitante_id: string; id_persona_cuenta: string }>(
      `SELECT e.expediente_id, e.solicitante_id, cu.id_persona AS id_persona_cuenta
         FROM sigd_tra.expediente e
         CROSS JOIN sigd_auth.cuenta_usuario cu
        WHERE e.codigo_expediente = $1 AND cu.id_usuario = $2::uuid AND cu.activo = TRUE`,
      [cut, idUsuario]
    );

    if (!busqueda.rows[0]) {
      throw new NotFoundError({ detail: 'No se encontró un expediente con el CUT indicado.' });
    }

    const { expediente_id, solicitante_id, id_persona_cuenta } = busqueda.rows[0];

    if (solicitante_id !== id_persona_cuenta) {
      throw new ForbiddenError({ detail: 'El expediente solicitado no corresponde al titular del documento de identidad registrado en esta cuenta.' });
    }

    const previa = await pool.query<{ id_vinculacion: string; estado: string }>(
      `SELECT id_vinculacion, estado
         FROM sigd_tra.vinculacion_expediente_cuenta
        WHERE expediente_id = $1::uuid AND id_usuario = $2::uuid`,
      [expediente_id, idUsuario]
    );

    if (previa.rows[0]) {
      if (previa.rows[0].estado === 'APROBADA') {
        return res.status(200).json({
          id: previa.rows[0].id_vinculacion,
          cut,
          estado: 'APROBADA',
          mensaje: 'El expediente ya se encuentra vinculado a su cuenta.',
        });
      }
      if (previa.rows[0].estado === 'PENDIENTE') {
        throw new ValidationError({
          invalidParams: [{ name: 'cut', reason: 'Ya existe una solicitud de vinculación pendiente para este expediente.' }],
        });
      }
      await pool.query(
        `UPDATE sigd_tra.vinculacion_expediente_cuenta
            SET estado = 'PENDIENTE',
                motivo_solicitud = $1,
                evidencia_documental = $2,
                fecha_solicitud = now(),
                revisado_por = NULL,
                fecha_resolucion = NULL,
                motivo_resolucion = NULL,
                actualizado_en = now()
          WHERE id_vinculacion = $3::uuid`,
        [motivo, evidencia ?? null, previa.rows[0].id_vinculacion]
      );

      return res.status(200).json({
        id: previa.rows[0].id_vinculacion,
        cut,
        estado: 'PENDIENTE',
        mensaje: 'Solicitud de vinculación reenviada a Mesa de Partes para revisión.',
      });
    }

    const nueva = await pool.query<{ id_vinculacion: string }>(
      `INSERT INTO sigd_tra.vinculacion_expediente_cuenta
         (expediente_id, id_usuario, id_persona, estado, motivo_solicitud, evidencia_documental)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'PENDIENTE', $4, $5)
       RETURNING id_vinculacion`,
      [expediente_id, idUsuario, id_persona_cuenta, motivo, evidencia ?? null]
    );

    await pool.query(
      `INSERT INTO sigd_auth.auditoria_usuarios (correlation_id, id_usuario, operacion, detalle)
       VALUES ($1::uuid, $2::uuid, 'SOLICITUD_VINCULACION_EXPEDIENTE', $3::jsonb)`,
      [crypto.randomUUID(), idUsuario, JSON.stringify({ cut, expediente_id, motivo })]
    );

    res.status(201).json({
      id: nueva.rows[0].id_vinculacion,
      cut,
      estado: 'PENDIENTE',
      mensaje: 'Solicitud de vinculación registrada exitosamente. Será evaluada por Mesa de Partes.',
    });
  });

  // Lista de solicitudes de vinculación del ciudadano autenticado
  router.get('/tramites/mis-expedientes/solicitudes-vinculacion', async (req: Request, res: Response) => {
    const idUsuario = exigirIdUsuarioAutenticado(req.get('authorization'));
    const autorizacion = await obtenerAutorizacionCuenta(pool, idUsuario);
    if (!autorizacion?.roles.includes('CIUDADANO')) {
      throw new ForbiddenError({ detail: 'Esta consulta está disponible para cuentas ciudadanas.' });
    }

    const resultado = await pool.query(
      `SELECT vec.id_vinculacion AS id,
              e.codigo_expediente AS cut,
              vec.estado,
              vec.fecha_solicitud,
              vec.motivo_solicitud,
              vec.fecha_resolucion,
              vec.motivo_resolucion
         FROM sigd_tra.vinculacion_expediente_cuenta vec
         JOIN sigd_tra.expediente e ON e.expediente_id = vec.expediente_id
        WHERE vec.id_usuario = $1::uuid
        ORDER BY vec.fecha_solicitud DESC`,
      [idUsuario]
    );

    res.status(200).json(resultado.rows);
  });

  // Bandeja de Mesa de Partes: solicitudes de vinculación pendientes
  router.get('/tramites/vinculaciones/pendientes', async (req: Request, res: Response) => {
    await exigirOperadorVentanilla(req);

    const resultado = await pool.query(
      `SELECT vec.id_vinculacion AS id,
              vec.expediente_id,
              e.codigo_expediente AS cut,
              COALESCE(documental.asunto, tramite.asunto, '') AS asunto,
              vec.id_usuario,
              cu.usuario AS nombre_usuario,
              cu.correo AS correo_usuario,
              p.id_documento AS numero_documento,
              COALESCE(pn.nombre_completo, pn.nombres || ' ' || pn.apellidos, pj.razon_social) AS nombre_solicitante,
              vec.estado,
              vec.fecha_solicitud,
              vec.motivo_solicitud,
              vec.evidencia_documental
         FROM sigd_tra.vinculacion_expediente_cuenta vec
         JOIN sigd_tra.expediente e ON e.expediente_id = vec.expediente_id
         LEFT JOIN sigd_tra.tramite tramite ON tramite.expediente_id = e.expediente_id
         LEFT JOIN sigd_doc.expediente documental ON documental.expediente_id = e.expediente_id
         JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = vec.id_usuario
         JOIN sigd_auth.persona p ON p.id_persona = vec.id_persona
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
        WHERE vec.estado = 'PENDIENTE'
        ORDER BY vec.fecha_solicitud ASC`
    );

    res.status(200).json(resultado.rows);
  });

  // Mesa de Partes resuelve vinculación (APROBAR / RECHAZAR)
  router.post('/tramites/vinculaciones/:id/resolver', async (req: Request, res: Response) => {
    await exigirOperadorVentanilla(req);
    const idOperador = exigirIdUsuarioAutenticado(req.get('authorization'));
    const idVinculacion = z.string().uuid().parse(req.params.id);

    const schema = z.object({
      accion: z.enum(['APROBAR', 'RECHAZAR']),
      motivo: z.string().trim().min(3, 'Indique el motivo de la resolución (mínimo 3 caracteres).').max(500),
    }).strict();

    const { accion, motivo } = schema.parse(req.body);
    const nuevoEstado = accion === 'APROBAR' ? 'APROBADA' : 'RECHAZADA';

    const resultado = await pool.query<{ id_vinculacion: string; expediente_id: string; id_usuario: string; estado: string }>(
      `UPDATE sigd_tra.vinculacion_expediente_cuenta
          SET estado = $1,
              revisado_por = $2::uuid,
              fecha_resolucion = now(),
              motivo_resolucion = $3,
              actualizado_en = now()
        WHERE id_vinculacion = $4::uuid AND estado = 'PENDIENTE'
        RETURNING id_vinculacion, expediente_id, id_usuario, estado`,
      [nuevoEstado, idOperador, motivo, idVinculacion]
    );

    if (!resultado.rows[0]) {
      throw new NotFoundError({ detail: 'No se encontró una solicitud pendiente con el identificador proporcionado.' });
    }

    const resolucion = resultado.rows[0];

    await pool.query(
      `INSERT INTO sigd_auth.auditoria_usuarios (correlation_id, id_usuario, operacion, detalle)
       VALUES ($1::uuid, $2::uuid, 'RESOLUCION_VINCULACION_EXPEDIENTE', $3::jsonb)`,
      [crypto.randomUUID(), idOperador, JSON.stringify({ id_vinculacion: idVinculacion, accion, nuevoEstado, motivo, resolucion })]
    );

    res.status(200).json({
      id: idVinculacion,
      estado: nuevoEstado,
      motivoResolucion: motivo,
      mensaje: accion === 'APROBAR'
        ? 'Solicitud de vinculación APROBADA. El expediente ahora es visible en la cuenta del ciudadano.'
        : 'Solicitud de vinculación RECHAZADA. El expediente no fue incorporado a la cuenta.',
    });
  });

  // Expedientes del titular autenticado: nunca acepta un id_persona del cliente.
  router.get('/tramites/mis-expedientes', async (req: Request, res: Response) => {
    const { pagina } = z.object({ pagina: z.coerce.number().int().min(1).max(100000).default(1) }).strict().parse(req.query);
    const idUsuario = exigirIdUsuarioAutenticado(req.get('authorization'));
    const autorizacion = await obtenerAutorizacionCuenta(pool, idUsuario);
    if (!autorizacion?.roles.includes('CIUDADANO')) {
      throw new ForbiddenError({ detail: 'Esta consulta está disponible para cuentas ciudadanas.' });
    }

    const resultado = await pool.query(`
      SELECT e.codigo_expediente AS cut,
             e.fecha_radicacion,
             COALESCE(estado_actual.estado_nuevo, e.estado, tramite.estado) AS estado,
             t.codigo AS codigo_procedimiento,
             t.denominacion AS procedimiento,
             COALESCE(documental.asunto, tramite.asunto, '') AS asunto
        FROM sigd_auth.cuenta_usuario cuenta
        JOIN sigd_tra.vinculacion_expediente_cuenta vec ON vec.id_usuario = cuenta.id_usuario AND vec.estado = 'APROBADA'
        JOIN sigd_tra.expediente e ON e.expediente_id = vec.expediente_id AND e.solicitante_id = cuenta.id_persona
        LEFT JOIN sigd_tra.tramite tramite ON tramite.expediente_id = e.expediente_id
        LEFT JOIN sigd_doc.expediente documental ON documental.expediente_id = e.expediente_id
        LEFT JOIN sigd_doc.expediente_tipo_tramite t ON t.expediente_id = documental.expediente_id
        LEFT JOIN sigd_rut.estado_actual_expediente estado_actual ON estado_actual.expediente_id = e.expediente_id
       WHERE cuenta.id_usuario = $1::uuid AND cuenta.activo = TRUE AND cuenta.id_persona IS NOT NULL
       ORDER BY e.fecha_radicacion DESC, e.codigo_expediente DESC
       LIMIT 101 OFFSET $2::integer`, [idUsuario, (pagina - 1) * 100]);

    const items = resultado.rows.slice(0, 100);

    await pool.query(`INSERT INTO sigd_auth.auditoria_usuarios (correlation_id,id_usuario,operacion,detalle)
      VALUES ($1::uuid,$2::uuid,'CONSULTA_EXPEDIENTES_PROPIOS',$3::jsonb)`,
      [crypto.randomUUID(), idUsuario, JSON.stringify({ registros: items.length, pagina })]);
    res.status(200).json({ items, pagina, hayMas: resultado.rows.length > 100 });
  });

  // #16 — Consulta pública por CUT
  router.get('/tramites/consulta-publica/:cut', async (req: Request, res: Response) => {
    const params = consultaPublicaParamsSchema.parse({ cut: req.params.cut });
    const publica = await pool.query<{ sesion_hash: string }>(`SELECT r.sesion_hash
      FROM sigd_tra.radicacion_publica r JOIN sigd_doc.expediente e USING (expediente_id)
      WHERE e.codigo_expediente=$1 AND r.respuesta IS NOT NULL`, [params.cut]);
    let autorizadoPorCuenta = false;
    const token = req.get('X-SIGD-Public-Session') ?? '';
    if (publica.rows[0]) {
      let autorizadoPorSesion = false;
      if (/^[0-9a-f]{64}$/.test(token) && /^[0-9a-f]{64}$/.test(publica.rows[0].sesion_hash)) {
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        autorizadoPorSesion = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(publica.rows[0].sesion_hash));
      }
      if (!autorizadoPorSesion && req.get('authorization')) {
        const idUsuario = exigirIdUsuarioAutenticado(req.get('authorization'));
        const titular = await pool.query<{ propio: boolean }>(`
          SELECT EXISTS (
            SELECT 1 FROM sigd_tra.expediente e
            JOIN sigd_auth.cuenta_usuario c ON c.id_persona = e.solicitante_id
           WHERE e.codigo_expediente = $1 AND c.id_usuario = $2::uuid AND c.activo = TRUE
          ) AS propio`, [params.cut, idUsuario]);
        autorizadoPorCuenta = Boolean(titular.rows[0]?.propio);
      }
      if (!autorizadoPorSesion && !autorizadoPorCuenta) {
        throw new NotFoundError({ detail: 'No se encontró información disponible para esta consulta.' });
      }
    } else {
      const idUsuario = exigirIdUsuarioAutenticado(req.get('authorization'));
      const titular = await pool.query<{ propio: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM sigd_tra.expediente e
          JOIN sigd_auth.cuenta_usuario c ON c.id_persona = e.solicitante_id
         WHERE e.codigo_expediente = $1 AND c.id_usuario = $2::uuid AND c.activo = TRUE
        ) AS propio`, [params.cut, idUsuario]);
      autorizadoPorCuenta = Boolean(titular.rows[0]?.propio);
      if (!autorizadoPorCuenta) {
        throw new NotFoundError({ detail: 'No se encontró información disponible para esta consulta.' });
      }
    }
    const consulta = await consultaService.consultarPorCut(params);
    res.status(200).json(consulta);
  });

  // #20 — Cargo de recepción física para impresión térmica
  router.get('/tramites/ventanilla/cargo/:cut', async (req: Request, res: Response) => {
    await exigirOperadorVentanilla(req);

    const cut = String(req.params.cut).trim().toUpperCase();

    const query = `
      SELECT e.codigo_expediente AS cut,
             a.numero_registro AS numero_asiento,
             EXTRACT(YEAR FROM a.fecha_ingreso)::integer AS anio_fiscal,
             COALESCE(pn.nombre_completo, pn.nombres || ' ' || pn.apellidos, pj.razon_social, p.id_documento) AS remitente,
             p.id_documento AS remitente_documento,
             a.asunto,
             COALESCE(f.total_folios, 0) AS folios,
             a.fecha_ingreso AS fecha_asiento
        FROM sigd_tra.asiento_registro a
        JOIN sigd_tra.expediente e ON e.expediente_id = a.expediente_id
        LEFT JOIN sigd_auth.persona p ON p.id_persona = a.remitente_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
        LEFT JOIN LATERAL (
             SELECT MAX(df.folio_fin) AS total_folios
               FROM sigd_tra.expediente_documento_folio df
              WHERE df.expediente_id = e.expediente_id
        ) f ON TRUE
       WHERE e.codigo_expediente = $1
         AND a.anulado = FALSE
       ORDER BY a.fecha_ingreso DESC, a.numero_registro DESC
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [cut]);
    const asiento = resultado.rows[0];

    if (!asiento) {
      throw new NotFoundError({
        detail: `No se encontró cargo físico registrado para el CUT ${cut}.`,
      });
    }

    const fechaAsiento = new Date(asiento.fecha_asiento);
    const hashPayload = `${asiento.cut}:${fechaAsiento.toISOString()}:${asiento.remitente_documento ?? ''}`;
    const hashSeguridad = crypto.createHash('sha256').update(hashPayload).digest('hex');

    const ticketImpresion = TicketTermicoUtil.generarTicketVentanilla({
      cut: asiento.cut,
      timestamp: fechaAsiento,
      folios: Number(asiento.folios),
      hashSha256: hashSeguridad,
      qrUrlSeguimiento: `https://sigd.iestp-suiza.edu.pe/consulta/${encodeURIComponent(asiento.cut)}`,
    });

    res.status(200).json({
      cut: asiento.cut,
      remitente: asiento.remitente,
      dni: asiento.remitente_documento,
      asunto: asiento.asunto,
      folios: Number(asiento.folios),
      fechaRecepcion: asiento.fecha_asiento,
      ticketTermicoTexto: ticketImpresion,
    });
  });

  return router;
}

export default crearRouterTramites;

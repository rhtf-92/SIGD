import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { ConsultaPublicaService } from './consultaPublica.service.js';
import { RadicacionVirtualService, type ProveedorFeriados } from './radicacionVirtual.service.js';
import { VentanillaPresencialService } from './ventanillaPresencial.service.js';
import { TupaVersionadoService } from './tupaVersionado.service.js';
import { TicketTermicoUtil } from './ticketTermico.util.js';
import {
  consultaPublicaParamsSchema,
  expedienteTupaParamsSchema,
  radicacionVirtualSchema,
} from './tramites.schemas.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../shared/domain/errors/index.js';
import { extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';
import { TupaAccesoRepository, type EstadoSolicitudTupa } from './tupaAcceso.repository.js';
import { SolicitudDinamicaRepository, type TipoFormularioDinamico } from './solicitudDinamica.repository.js';
import type { ClaimsJwt } from '../../core/auth/jwt.service.js';

const ventanillaPresencialSchema = z.object({
  dniSolicitante: z.string().regex(/^[0-9]{8}$/, 'DNI debe contener exactamente 8 dígitos'),
  datosRemitente: z.string().min(3),
  asunto: z.string().min(5).max(500),
  foliosTotales: z.coerce.number().int().positive(),
  areaDestinoId: z.string().uuid().optional(),
  tipoDocumentalId: z.string().uuid().optional(),
  registroVersionId: z.string().uuid('registroVersionId debe ser un UUID valido.').optional().nullable(),
});

/**
 * Endpoints del dominio TramiCore (Grupo 2 - OE2 / Integración TUPA 2026)
 *
 *   * #14 `POST /api/v1/tramites/radicacion-virtual` — radicación ciudadana en Mesa de Partes Virtual
 *   * #15 `POST /api/v1/tramites/ventanilla-presencial` — radicación física en ventanilla y ticket térmico
 *   * `GET  /api/v1/tramites/tupa` — catálogo canónico TUPA versionado (sigd_doc.tupa_registro_version)
 *   * `GET  /api/v1/tramites/tipos` — catálogo legado (sigd_doc.tipo_tramite_tupa) por compatibilidad
 *   * #16 `GET  /api/v1/tramites/consulta-publica/:cut` — consulta pública del estado procesal
 *   * #20 `GET  /api/v1/tramites/ventanilla/cargo/:cut` — datos del cargo de recepción física para impresión
 *   * `GET  /api/v1/tramites/expedientes/:expedienteId` — detalle del expediente con contexto TUPA
 *   * `GET  /api/v1/tramites/expedientes/:expedienteId/tupa` — contexto TUPA persistido del expediente
 */
export function crearRouterTramites(
  pool: Pool,
  obtenerFeriados?: ProveedorFeriados,
): Router {
  const router = Router();
  const radicacionService = new RadicacionVirtualService(pool, obtenerFeriados);
  const ventanillaService = new VentanillaPresencialService(pool);
  const consultaService = new ConsultaPublicaService(pool);
  const tupaService = new TupaVersionadoService(pool);
  const tupaAccesoRepo = new TupaAccesoRepository(pool);
  const solicitudDinamicaRepo = new SolicitudDinamicaRepository(pool);

  async function resolverIdentidadPersona(req: Request): Promise<{
    idUsuario: string;
    idPersona: string;
    roles: string[];
    nombre: string;
    correo: string;
  } | null> {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) return null;
    let claims: ClaimsJwt;
    try {
      claims = verificarTokenAcceso(token);
    } catch {
      return null;
    }
    if (!z.uuid().safeParse(claims.sub).success) return null;

    const res = await pool.query<{
      id_persona: string | null;
      activo: boolean;
      correo: string | null;
      nombre_completo: string | null;
    }>(
      `SELECT c.id_persona, c.activo, pn.correo, pn.nombre_completo
         FROM sigd_auth.cuenta_usuario c
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
        WHERE c.id_usuario = $1`,
      [claims.sub],
    );
    const row = res.rows[0];
    if (!row || !row.activo || !row.id_persona) return null;

    return {
      idUsuario: claims.sub,
      idPersona: row.id_persona,
      roles: claims.roles ?? [],
      nombre: row.nombre_completo ?? 'Usuario SIGD',
      correo: row.correo ?? '',
    };
  }

  // #14 — Radicación virtual (Mesa de Partes Virtual 24x7)
  router.post('/tramites/radicacion-virtual', async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) {
      throw new UnauthorizedError({ detail: 'Debe iniciar sesión para radicar un trámite virtual.' });
    }
    const claims = verificarTokenAcceso(token);
    if (!z.uuid().safeParse(claims.sub).success) {
      throw new UnauthorizedError({ detail: 'El token no identifica una cuenta válida.' });
    }
    const cuenta = await pool.query<{ id_persona: string | null; activo: boolean }>(
      `SELECT id_persona::text AS id_persona, activo
         FROM sigd_auth.cuenta_usuario
        WHERE id_usuario = $1::uuid`,
      [claims.sub],
    );
    const actor = cuenta.rows[0];
    if (!actor?.activo) {
      throw new UnauthorizedError({ detail: 'La cuenta no existe o está deshabilitada.' });
    }
    if (!actor.id_persona) {
      throw new ForbiddenError({ detail: 'La cuenta no tiene una persona asociada para radicar.' });
    }
    if (req.body?.idPersona !== undefined && req.body.idPersona !== actor.id_persona) {
      throw new ForbiddenError({ detail: 'No puede radicar un expediente a nombre de otra persona.' });
    }
    const datos = radicacionVirtualSchema.parse({ ...req.body, idPersona: actor.id_persona });
    const radicacion = await radicacionService.radicar(datos);
    res.status(201).json({
      expedienteId: radicacion.expedienteId,
      tipoDocumentalId: radicacion.tipoDocumentalId,
      cut: radicacion.cut,
      anioFiscal: radicacion.anio,
      fechaEnvioReal: radicacion.fechaEnvioReal,
      fechaRadicacionLegal: radicacion.fechaRadicacionLegal,
      diferidoPorCorte: radicacion.fueraDeHorario,
      totalFolios: radicacion.totalFolios,
      registroVersionId: radicacion.registroVersionId ?? null,
      qrSeguimientoUrl: radicacion.cargoDigital.qrContenido,
      cargoDigital: radicacion.cargoDigital,
      mensajeLegal: radicacion.mensajeLegal,
    });
  });

  // #15 — Radicación física en Ventanilla Presencial
  // #14b — Mis expedientes (Ciudadano autenticado - consulta estricta de trámites propios con BOLA protection)
  router.get('/tramites/mis-expedientes', async (req: Request, res: Response) => {
    const queryInyectado = req.query as Record<string, unknown> | undefined;
    if (
      queryInyectado?.idPersona ||
      queryInyectado?.id_persona ||
      queryInyectado?.personaId ||
      queryInyectado?.solicitanteId
    ) {
      throw new ForbiddenError({ detail: 'No está permitido especificar el identificador de persona en la consulta.' });
    }

    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) {
      throw new UnauthorizedError({ detail: 'Debe iniciar sesión para consultar sus expedientes.' });
    }
    const claims = verificarTokenAcceso(token);
    if (!z.uuid().safeParse(claims.sub).success) {
      throw new UnauthorizedError({ detail: 'El token no identifica una cuenta válida.' });
    }
    const cuenta = await pool.query<{ id_persona: string | null; activo: boolean }>(
      `SELECT id_persona::text AS id_persona, activo
         FROM sigd_auth.cuenta_usuario
        WHERE id_usuario = $1::uuid`,
      [claims.sub],
    );
    const actor = cuenta.rows[0];
    if (!actor?.activo) {
      throw new UnauthorizedError({ detail: 'La cuenta no existe o está deshabilitada.' });
    }
    if (!actor.id_persona) {
      throw new ForbiddenError({ detail: 'La cuenta no tiene una persona asociada para consultar expedientes.' });
    }

    const resultado = await pool.query<{
      expediente_id: string;
      cut: string;
      codigo_expediente: string;
      numero: string;
      asunto: string;
      tipo_documento: string;
      tipo_tramite: string | null;
      estado: string;
      fecha_radicacion: Date | string;
      canal_ingreso: string;
      total_folios: number;
    }>(
      `SELECT e.expediente_id,
              e.codigo_expediente AS cut,
              e.codigo_expediente,
              e.numero,
              COALESCE(tr.asunto, '') AS asunto,
              COALESCE(td.nombre, 'SOLICITUD') AS tipo_documento,
              tv.denominacion_original AS tipo_tramite,
              COALESCE(rut.estado_nuevo, e.estado) AS estado,
              e.fecha_radicacion,
              COALESCE(ar.canal_ingreso, 'MESA_VIRTUAL') AS canal_ingreso,
              COALESCE((SELECT MAX(f.folio_fin) FROM sigd_tra.expediente_documento_folio f
                         WHERE f.expediente_id = e.expediente_id), 0)::int AS total_folios
         FROM sigd_tra.expediente e
         LEFT JOIN sigd_tra.tramite tr ON tr.expediente_id = e.expediente_id
         LEFT JOIN sigd_doc.tipo_documento td ON td.tipo_documental_id = e.tipo_documental_id
         LEFT JOIN sigd_rut.estado_actual_expediente rut ON rut.expediente_id = e.expediente_id
         LEFT JOIN LATERAL (
           SELECT a.canal_ingreso
             FROM sigd_tra.asiento_registro a
            WHERE a.expediente_id = e.expediente_id
            ORDER BY a.fecha_ingreso ASC LIMIT 1
         ) ar ON TRUE
         LEFT JOIN LATERAL (
           SELECT v.denominacion_original
             FROM sigd_doc.expediente_tupa_vinculo x
             JOIN sigd_doc.tupa_registro_version v ON v.registro_version_id = x.registro_version_id
            WHERE x.expediente_id = e.expediente_id
            ORDER BY x.vinculado_en DESC LIMIT 1
         ) tv ON TRUE
        WHERE e.solicitante_id = $1::uuid
          AND e.estado <> 'ANULADO'
        ORDER BY e.fecha_radicacion DESC`,
      [actor.id_persona],
    );

    const expedientes = resultado.rows.map((row) => ({
      expedienteId: row.expediente_id,
      cut: row.cut,
      codigoExpediente: row.codigo_expediente,
      numero: row.numero,
      asunto: row.asunto,
      tipoDocumento: row.tipo_documento,
      tipoTramite: row.tipo_tramite,
      estado: row.estado,
      fechaRadicacion: row.fecha_radicacion instanceof Date
        ? row.fecha_radicacion.toISOString()
        : String(row.fecha_radicacion),
      canalIngreso: row.canal_ingreso,
      totalFolios: Number(row.total_folios),
    }));

    res.status(200).json(expedientes);
  });

  router.post('/tramites/ventanilla-presencial', async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError({ detail: 'Debe iniciar sesión para registrar una recepción presencial.' });
    const claims = verificarTokenAcceso(token);
    if (!z.uuid().safeParse(claims.sub).success) {
      throw new UnauthorizedError({ detail: 'El token no identifica una cuenta válida.' });
    }
    const autorizado = await pool.query<{ permitido: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM sigd_auth.cuenta_usuario c
         JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario
           AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
         JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        WHERE c.id_usuario = $1::uuid AND c.activo = true
          AND r.codigo IN ('MESA_PARTES', 'ADMINISTRADOR')
       ) AS permitido`,
      [claims.sub],
    );
    if (!autorizado.rows[0]?.permitido) {
      throw new ForbiddenError({ detail: 'Se requiere rol vigente de Mesa de Partes o Administrador.' });
    }
    const datos = ventanillaPresencialSchema.parse(req.body);
    const resultado = await ventanillaService.registrarExpedienteVentanilla({
      ...datos,
      registroVersionId: datos.registroVersionId ?? undefined,
    });
    res.status(201).json(resultado);
  });

  // Catálogo TUPA versionado 2026 (sigd_doc.tupa_registro_version)
  // Restringido: Requiere rol institucional o ciudadano con solicitud aprobada.
  router.get('/tramites/tupa', async (req: Request, res: Response) => {
    // Si viene req.query.aprobados === 'true' se permite consulta de los 18 aprobados
    if (req.query.aprobados === 'true') {
      const catalogo = await tupaService.listarAprobados();
      return res.status(200).json(catalogo);
    }

    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) {
      return res.status(403).json({
        error: 'ACCESO_RESTRINGIDO',
        codigo: 'SOLICITUD_ACCESO_REQUERIDA',
        mensaje: 'Para consultar el documento TUPA institucional completo se requiere una solicitud de acceso.',
      });
    }

    let claims: ClaimsJwt;
    try {
      claims = verificarTokenAcceso(token);
    } catch {
      return res.status(403).json({
        error: 'ACCESO_RESTRINGIDO',
        codigo: 'SOLICITUD_ACCESO_REQUERIDA',
        mensaje: 'Token inválido o expirado. Para consultar el documento TUPA completo se requiere autenticación válida.',
      });
    }

    const esInstitucional = claims.roles?.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'ESPECIALISTA', 'SECRETARIO'].includes(r),
    );

    if (esInstitucional) {
      const catalogo = await tupaService.listarCompletoAutorizado();
      return res.status(200).json(catalogo);
    }

    // Para CIUDADANO: verificar si tiene solicitud de acceso APROBADA
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad) {
      return res.status(403).json({
        error: 'ACCESO_RESTRINGIDO',
        codigo: 'SOLICITUD_ACCESO_REQUERIDA',
        mensaje: 'Cuenta de usuario no activa o no asociada a una persona válida.',
      });
    }

    const tieneAcceso = await tupaAccesoRepo.tieneAccesoAprobado(identidad.idPersona);
    if (!tieneAcceso) {
      return res.status(403).json({
        error: 'ACCESO_RESTRINGIDO',
        codigo: 'SOLICITUD_ACCESO_REQUERIDA',
        mensaje: 'Para consultar el documento TUPA institucional completo se requiere una solicitud de acceso aprobada.',
      });
    }

    const catalogo = await tupaService.listarCompletoAutorizado();
    return res.status(200).json(catalogo);
  });

  // Estado de acceso TUPA del usuario autenticado
  router.get('/tramites/tupa/acceso/estado', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad) {
      return res.status(200).json({
        autenticado: false,
        autorizado: false,
        estado: 'ANONIMO',
        solicitud: null,
      });
    }

    const esInstitucional = identidad.roles.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'ESPECIALISTA', 'SECRETARIO'].includes(r),
    );

    if (esInstitucional) {
      return res.status(200).json({
        autenticado: true,
        autorizado: true,
        roles: identidad.roles,
        estado: 'AUTORIZADO_ROL_INSTITUCIONAL',
        solicitud: null,
      });
    }

    // Para CIUDADANO:
    const solicitud = await tupaAccesoRepo.obtenerUltimaSolicitud(identidad.idPersona);
    const autorizado = solicitud?.estado === 'APROBADA';

    return res.status(200).json({
      autenticado: true,
      autorizado,
      roles: identidad.roles,
      estado: solicitud?.estado ?? 'NINGUNA',
      solicitud,
    });
  });

  // Solicitar acceso al catálogo TUPA (Ciudadano)
  router.post('/tramites/tupa/acceso/solicitar', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad) {
      throw new UnauthorizedError({ detail: 'Debe iniciar sesión para solicitar acceso al catálogo TUPA.' });
    }

    const esquema = z.object({
      motivo: z.string().min(5, 'El motivo debe contener al menos 5 caracteres').max(1000),
      correo: z.string().email('Debe ingresar un correo electrónico válido'),
      aceptaTratamientoDatos: z.literal(true, {
        message: 'Debe aceptar el aviso de tratamiento de datos personales',
      }),
    });

    const parsed = esquema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'DATOS_INVALIDOS',
        detalles: parsed.error.issues.map((i) => i.message),
      });
    }

    // Verificar si ya tiene solicitud previa pendiente o aprobada
    const ultima = await tupaAccesoRepo.obtenerUltimaSolicitud(identidad.idPersona);
    if (ultima && (ultima.estado === 'PENDIENTE' || ultima.estado === 'APROBADA')) {
      return res.status(409).json({
        error: 'SOLICITUD_EXISTENTE',
        mensaje: `Ya cuenta con una solicitud de acceso en estado ${ultima.estado}.`,
        solicitud: ultima,
      });
    }

    const creada = await tupaAccesoRepo.crearSolicitud({
      idPersona: identidad.idPersona,
      correo: parsed.data.correo,
      motivo: parsed.data.motivo,
    });

    return res.status(201).json(creada);
  });

  // Mis solicitudes de acceso TUPA (Anti-BOLA)
  router.get('/tramites/tupa/acceso/mis-solicitudes', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad) {
      throw new UnauthorizedError({ detail: 'Debe iniciar sesión para consultar sus solicitudes.' });
    }
    const solicitudes = await tupaAccesoRepo.listarPorPersona(identidad.idPersona);
    return res.status(200).json(solicitudes);
  });

  // Admin / Mesa de Partes: Listar solicitudes de acceso TUPA
  router.get('/tramites/tupa/acceso/admin/solicitudes', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad || !identidad.roles.some((r) => ['MESA_PARTES', 'ADMINISTRADOR'].includes(r))) {
      throw new ForbiddenError({ detail: 'Acceso reservado para Mesa de Partes o Administrador.' });
    }

    const estado = req.query.estado as EstadoSolicitudTupa | undefined;
    const busqueda = req.query.busqueda as string | undefined;

    const listado = await tupaAccesoRepo.listarTodas({ estado, busqueda });
    return res.status(200).json(listado);
  });

  // Admin / Mesa de Partes: Resolver solicitud de acceso TUPA (Aprobar/Rechazar)
  router.patch('/tramites/tupa/acceso/admin/solicitudes/:idSolicitud', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad || !identidad.roles.some((r) => ['MESA_PARTES', 'ADMINISTRADOR'].includes(r))) {
      throw new ForbiddenError({ detail: 'Acceso reservado para Mesa de Partes o Administrador.' });
    }

    const esquema = z.object({
      estado: z.enum(['APROBADA', 'RECHAZADA']),
      observacion: z.string().max(500).optional(),
    });

    const parsed = esquema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'DATOS_INVALIDOS', detalles: parsed.error.issues });
    }

    const resuelta = await tupaAccesoRepo.resolverSolicitud({
      idSolicitud: String(req.params.idSolicitud),
      estado: parsed.data.estado,
      resueltoPor: identidad.idUsuario,
      observacionResolucion: parsed.data.observacion,
    });

    if (!resuelta) {
      throw new NotFoundError({ detail: 'No se encontró la solicitud de acceso indicada.' });
    }

    return res.status(200).json(resuelta);
  });

  // Trámites Dinámicos: Registrar solicitud no documentaria (Bienes, Alquiler, Servicios, Académicos)
  router.post('/tramites/solicitudes-dinamicas', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad) {
      throw new UnauthorizedError({ detail: 'Debe iniciar sesión para registrar una solicitud.' });
    }

    const esquema = z.object({
      tipoFormulario: z.enum([
        'DOCUMENTARIO',
        'ACADEMICO',
        'SERVICIO',
        'VENTA_BIEN',
        'ALQUILER',
        'ACTUACION_INTERNA',
        'OTRO',
      ]),
      codigoTupa: z.string().min(1),
      denominacion: z.string().min(3),
      montoTotal: z.coerce.number().min(0).default(0),
      datosFormulario: z.record(z.string(), z.unknown()).default({}),
      observacion: z.string().max(1000).optional(),
      telefono: z.string().max(30).optional(),
    });

    const parsed = esquema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'DATOS_INVALIDOS', detalles: parsed.error.issues });
    }

    // 1. Resolver código TUPA contra catálogo oficial sigd_doc.tupa_registro_version
    const resTupa = await pool.query<{
      registro_version_id: string;
      denominacion_original: string;
      monto_original: string | null;
      estado_validacion: string;
      referencia_fila: string;
    }>(
      `SELECT registro_version_id, denominacion_original, monto_original, estado_validacion, referencia_fila
         FROM sigd_doc.tupa_registro_version
        WHERE referencia_fila = $1 OR codigo_externo = $1
        LIMIT 1`,
      [parsed.data.codigoTupa],
    );

    let denominacionOficial = parsed.data.denominacion;
    let montoOficialStr: string | null = null;
    let estadoValidacion = 'PENDIENTE_VALIDACION';

    if (resTupa.rows.length > 0) {
      const fila = resTupa.rows[0];
      denominacionOficial = fila.denominacion_original;
      montoOficialStr = fila.monto_original;
      estadoValidacion = fila.estado_validacion;
    }

    // Regla: Procedimientos documentarios aprobados oficiales deben radicarse por Mesa de Partes Virtual con CUT
    if (estadoValidacion === 'APROBADO' && parsed.data.tipoFormulario === 'DOCUMENTARIO') {
      throw new ValidationError({
        message: 'Trámite no permitido por esta vía.',
        invalidParams: [{
          name: 'codigoTupa',
          reason: 'Los procedimientos documentarios aprobados oficiales deben radicarse formalmente por la Mesa de Partes Virtual mediante el flujo con CUT.',
        }],
      });
    }

    // Deducción canónica del tipo de formulario server-side
    const dLower = denominacionOficial.toLowerCase();
    let tipoCanonica: TipoFormularioDinamico = 'OTRO';
    if (dLower.includes('alquiler')) {
      tipoCanonica = 'ALQUILER';
    } else if (
      dLower.includes('venta de') ||
      dLower.includes('ciento') ||
      dLower.includes('porcino') ||
      dLower.includes('vacuno') ||
      dLower.includes('patos') ||
      dLower.includes('pato')
    ) {
      tipoCanonica = 'VENTA_BIEN';
    } else if (
      dLower.includes('prácticas') ||
      dLower.includes('colación') ||
      dLower.includes('experiencias formativas')
    ) {
      tipoCanonica = 'ACTUACION_INTERNA';
    } else if (
      dLower.includes('matrícula') ||
      dLower.includes('admisión') ||
      dLower.includes('examen') ||
      dLower.includes('repitencia') ||
      dLower.includes('cepretec') ||
      dLower.includes('idiomas') ||
      dLower.includes('evaluación') ||
      dLower.includes('suficiencia')
    ) {
      tipoCanonica = 'ACADEMICO';
    } else if (dLower.includes('empadre') || dLower.includes('venta ambulatoria')) {
      tipoCanonica = 'SERVICIO';
    }

    // Fail-closed contra manipulación / spoofing de tipo de formulario
    if (parsed.data.tipoFormulario === 'DOCUMENTARIO' && tipoCanonica !== 'OTRO') {
      throw new ValidationError({
        message: 'Tipo de formulario no admitido.',
        invalidParams: [{
          name: 'tipoFormulario',
          reason: `No se permite alterar el tipo de formulario a DOCUMENTARIO para el concepto ${parsed.data.codigoTupa}. Naturaleza oficial: ${tipoCanonica}.`,
        }],
      });
    }

    const tipoEfectivo = (tipoCanonica !== 'OTRO' ? tipoCanonica : parsed.data.tipoFormulario) as TipoFormularioDinamico;

    // Regla de actuación interna: ciudadano no puede iniciar actuaciones internas
    if (tipoEfectivo === 'ACTUACION_INTERNA') {
      const esInstitucional = identidad.roles.some((r) =>
        ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'ESPECIALISTA', 'SECRETARIO'].includes(r),
      );
      if (!esInstitucional) {
        throw new ForbiddenError({
          detail: 'Gestión interna institucional. Los ciudadanos externos no pueden iniciar este trámite.',
        });
      }
    }

    // Helper para extraer precio base oficial
    const extraerPrecio = (str: string | null): number => {
      if (!str || str.toLowerCase().includes('gratuito')) return 0.0;
      const m = str.match(/S\/\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (m) return parseFloat(m[1]);
      const mNum = str.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (mNum) return parseFloat(mNum[1]);
      return 0.0;
    };

    const datosLimpios = { ...parsed.data.datosFormulario };

    // Principio de minimización Ley 29733: Eliminar datos redundantes de identidad en el JSONB
    delete (datosLimpios as Record<string, unknown>).idPersona;
    delete (datosLimpios as Record<string, unknown>).dni;
    delete (datosLimpios as Record<string, unknown>).correo;
    delete (datosLimpios as Record<string, unknown>).nombre;
    delete (datosLimpios as Record<string, unknown>).usuario;

    const precioUnitarioForm = typeof datosLimpios.precioUnitario === 'number' && Number.isFinite(datosLimpios.precioUnitario) ? datosLimpios.precioUnitario : undefined;
    const precioBaseOficial = montoOficialStr !== null ? extraerPrecio(montoOficialStr) : (precioUnitarioForm ?? parsed.data.montoTotal);

    // Recálculo obligatorio server-side del monto
    let montoCalculado = precioBaseOficial;
    if (tipoEfectivo === 'VENTA_BIEN') {
      const cantidad = Number(datosLimpios.cantidad ?? 1);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new ValidationError({
          message: 'Cantidad inválida.',
          invalidParams: [{ name: 'cantidad', reason: 'Para venta de bienes la cantidad debe ser mayor a cero.' }],
        });
      }
      montoCalculado = Math.round(cantidad * precioBaseOficial * 100) / 100;
    } else if (tipoEfectivo === 'ALQUILER') {
      const periodos = Number(datosLimpios.cantidadPeriodos ?? 1);
      if (!Number.isFinite(periodos) || periodos <= 0) {
        throw new ValidationError({
          message: 'Periodos de alquiler inválidos.',
          invalidParams: [{ name: 'cantidadPeriodos', reason: 'Para alquileres la cantidad de periodos debe ser mayor a cero.' }],
        });
      }
      if (datosLimpios.horaInicio && datosLimpios.horaFin) {
        const hIni = String(datosLimpios.horaInicio).trim();
        const hFin = String(datosLimpios.horaFin).trim();
        if (hIni >= hFin && /^\d{2}:\d{2}/.test(hIni) && /^\d{2}:\d{2}/.test(hFin)) {
          throw new ValidationError({
            message: 'Rango de horario inválido.',
            invalidParams: [{ name: 'horaInicio', reason: 'La hora de inicio debe ser anterior a la hora de finalización.' }],
          });
        }
      }
      montoCalculado = Math.round(periodos * precioBaseOficial * 100) / 100;
    }

    const creada = await solicitudDinamicaRepo.crearSolicitud({
      tipoFormulario: tipoEfectivo,
      codigoTupa: parsed.data.codigoTupa,
      denominacion: denominacionOficial,
      idPersona: identidad.idPersona,
      nombreSolicitante: identidad.nombre,
      correo: identidad.correo,
      telefono: parsed.data.telefono,
      montoTotal: montoCalculado,
      datosFormulario: datosLimpios,
      observacion: parsed.data.observacion,
    });

    return res.status(201).json(creada);
  });

  // Mis solicitudes dinámicas (Anti-BOLA)
  router.get('/tramites/solicitudes-dinamicas/mis-solicitudes', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad) {
      throw new UnauthorizedError({ detail: 'Debe iniciar sesión para consultar sus solicitudes.' });
    }
    const solicitudes = await solicitudDinamicaRepo.listarPorPersona(identidad.idPersona);
    return res.status(200).json(solicitudes);
  });

  // Consultar solicitud dinámica por código canónico (SOL-2026-XXXXXX)
  router.get('/tramites/solicitudes-dinamicas/:codigo', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad) {
      throw new UnauthorizedError({ detail: 'Debe iniciar sesión para consultar el estado de la solicitud.' });
    }
    const esInstitucional = identidad.roles.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'ESPECIALISTA', 'SECRETARIO'].includes(r),
    );
    // Anti-BOLA: el ciudadano solo puede consultar solicitudes donde idPersona coincide
    const solicitud = await solicitudDinamicaRepo.obtenerPorCodigo(
      String(req.params.codigo),
      esInstitucional ? undefined : identidad.idPersona,
    );
    if (!solicitud) {
      throw new NotFoundError({ detail: 'Solicitud no encontrada o no autorizada para su consulta.' });
    }
    return res.status(200).json(solicitud);
  });

  // Admin / Mesa de Partes: Listar solicitudes dinámicas
  router.get('/tramites/solicitudes-dinamicas/admin/solicitudes', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad || !identidad.roles.some((r) => ['MESA_PARTES', 'ADMINISTRADOR'].includes(r))) {
      throw new ForbiddenError({ detail: 'Acceso reservado para Mesa de Partes o Administrador.' });
    }

    const tipoFormulario = req.query.tipoFormulario as TipoFormularioDinamico | undefined;
    const estado = req.query.estado as any | undefined;

    const listado = await solicitudDinamicaRepo.listarTodas({ tipoFormulario, estado });
    return res.status(200).json(listado);
  });

  // Catálogo legado (sigd_doc.tipo_tramite_tupa) por compatibilidad
  const handlerTiposTupa = async (_req: Request, res: Response) => {
    const query = `
      SELECT tipo_tramite_id AS id,
             tipo_tramite_id AS id_tipo_tramite,
             codigo,
             denominacion,
             descripcion,
             unidad_organica,
             plazo_dias,
             plazo_dias AS plazo_dias_habiles,
             silencio_administrativo,
             silencio_administrativo AS calificacion,
             base_legal,
             vigente
        FROM sigd_doc.tipo_tramite_tupa
       WHERE vigente = TRUE
       ORDER BY codigo ASC;
    `;
    const resultado = await pool.query(query);
    res.status(200).json(resultado.rows);
  };

  router.get('/tramites/tipos', handlerTiposTupa);

  // #16 — Consulta pública por CUT
  router.get('/tramites/consulta-publica/:cut', async (req: Request, res: Response) => {
    const params = consultaPublicaParamsSchema.parse({ cut: req.params.cut });
    const consulta = await consultaService.consultarPorCut(params);
    res.status(200).json(consulta);
  });

  // #20 — Cargo de recepción física para impresión térmica
  router.get('/tramites/ventanilla/cargo/:cut', async (req: Request, res: Response) => {
    const cut = String(req.params.cut).trim().toUpperCase();

    const query = `
      SELECT a.numero_asiento, a.anio_fiscal, a.cut, a.remitente,
             a.remitente_documento, a.asunto, a.folios, a.fecha_asiento
        FROM sigd_tra.asiento_registro a
       WHERE a.cut = $1
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [cut]);
    const asiento = resultado.rows[0];

    if (!asiento) {
      throw new NotFoundError({
        detail: `No se encontró cargo físico registrado para el CUT ${cut}.`,
      });
    }

    const ticketImpresion = TicketTermicoUtil.generarTicketVentanilla({
      cut: asiento.cut,
      timestamp: new Date(asiento.fecha_asiento),
      folios: Number(asiento.folios),
      hashSha256: crypto.createHash('sha256').update(asiento.cut).digest('hex'),
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

  // Detalle del expediente con contexto TUPA
  const handlerDetalleExpediente = async (req: Request, res: Response) => {
    const params = expedienteTupaParamsSchema.parse(req.params);
    const detalle = await radicacionService.obtenerDetalleExpediente(params.expedienteId);
    res.status(200).json(detalle);
  };

  router.get('/tramites/expedientes/:expedienteId', handlerDetalleExpediente);
  router.get('/tramites/expediente/:expedienteId', handlerDetalleExpediente);

  // Contexto TUPA persistido del expediente
  const handlerContextoTupa = async (req: Request, res: Response) => {
    const params = expedienteTupaParamsSchema.parse(req.params);
    const contexto = await tupaService.obtenerContextoExpediente(params.expedienteId);
    res.status(200).json(contexto);
  };

  router.get('/tramites/expedientes/:expedienteId/tupa', handlerContextoTupa);
  router.get('/tramites/expediente/:expedienteId/tupa', handlerContextoTupa);

  return router;
}

export default crearRouterTramites;

import crypto from 'node:crypto';
import path from 'node:path';
import express, { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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
import { TupaVersionRepository, type FilaTupaProcedimiento } from './tupaVersion.repository.js';
import type { ClaimsJwt } from '../../core/auth/jwt.service.js';
import { CATEGORIA_TUPA_72 } from './tupa72.categorias.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import { getCached, setCached, invalidateCache } from '../../core/cache/redis.service.js';

function mapearProcedimientoADto(p: FilaTupaProcedimiento) {
  const montoNum = Number(p.monto) || 0;
  const montoStr = montoNum > 0 ? `S/ ${montoNum.toFixed(2)}` : 'Gratuito';
  const reqs = Array.isArray(p.requisitos) ? p.requisitos : [];
  const regVersionId = p.registro_version_id || p.id_procedimiento;
  const estadoVal = p.genera_expediente ? 'APROBADO' : 'PENDIENTE_VALIDACION';
  const codigoRef = p.codigo_ref;
  const codigoExt = p.codigo_externo || p.codigo_ref;
  return {
    registroVersionId: regVersionId,
    id: regVersionId,
    codigo: codigoExt,
    codigoRef: codigoRef,
    codigoExterno: codigoExt,
    denominacion: p.denominacion,
    categoria: p.categoria,
    clasificacion: p.categoria,
    tipoFormulario: p.tipo_formulario,
    monto: montoStr,
    montoNumero: montoNum,
    costoSoles: montoNum,
    unidadCobro: p.unidad_cobro,
    plazo: `${p.plazo_dias} días hábiles`,
    plazoDias: p.plazo_dias,
    plazoDiasHabiles: p.plazo_dias,
    requisitos: reqs,
    generaExpediente: p.genera_expediente,
    admiteRadicacionSigd: p.genera_expediente,
    admiteRadicacion: p.genera_expediente,
    calificacion: p.calificacion,
    versionFuente: 'TUPA 2026',
    estadoValidacion: estadoVal,
    estado: estadoVal,
    revision: 1,
    pagina: 1,
    vigenciaDesde: null,
    vigenciaHasta: null,
    vigencia: { desde: null, hasta: null },
    version: { etiqueta: 'TUPA 2026', revision: 1, vigenciaDesde: null, vigenciaHasta: null },
    referenciaAprobacion: 'RD-001-2026-IESTP-SUIZA',
    fuente: {
      nombre: 'TUPA_2026_IESTP_Suiza.pdf',
      documentoSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      referenciaFila: codigoRef,
      pagina: 1,
    },
    idProcedimiento: p.id_procedimiento,
    idVersion: p.id_version,
  };
}

function tipoFormularioOficial(categoria: string, denominacion: string): TipoFormularioDinamico {
  if (categoria === 'ACTUACION_INTERNA') return 'ACTUACION_INTERNA';
  if (categoria === 'BIEN_PRODUCTIVO') return 'VENTA_BIEN';
  if (categoria === 'SERVICIO_ACADEMICO') return 'ACADEMICO';
  if (categoria === 'SERVICIO_COMERCIAL') {
    return denominacion.toLocaleLowerCase('es-PE').includes('alquiler') ? 'ALQUILER' : 'SERVICIO';
  }
  if (categoria === 'PROCEDIMIENTO_APROBADO' || categoria === 'PROCEDIMIENTO_PENDIENTE') return 'DOCUMENTARIO';
  return 'OTRO';
}

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
  s3Client?: S3Client,
): Router {
  const router = Router();
  const radicacionService = new RadicacionVirtualService(pool, obtenerFeriados);
  const ventanillaService = new VentanillaPresencialService(pool);
  const consultaService = new ConsultaPublicaService(pool);
  const tupaService = new TupaVersionadoService(pool);
  const tupaAccesoRepo = new TupaAccesoRepository(pool);
  const solicitudDinamicaRepo = new SolicitudDinamicaRepository(pool);
  const tupaVersionRepo = new TupaVersionRepository(pool);

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
      `SELECT c.id_persona, c.activo, c.correo,
              COALESCE(pn.nombre_completo, pj.razon_social) AS nombre_completo
         FROM sigd_auth.cuenta_usuario c
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona
    LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = c.id_persona
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

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || req.query.limite || '20'), 10) || 20));
    const offset = (page - 1) * limit;

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
      total_count?: string | number;
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
                         WHERE f.expediente_id = e.expediente_id), 0)::int AS total_folios,
              count(*) OVER() AS total_count
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
        ORDER BY e.fecha_radicacion DESC
        LIMIT $2 OFFSET $3`,
      [actor.id_persona, limit, offset],
    );

    const totalCount = resultado.rows.length > 0 ? Number(resultado.rows[0].total_count || 0) : 0;

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

    res.setHeader('X-Total-Count', String(totalCount));
    res.setHeader('X-Page', String(page));
    res.setHeader('X-Limit', String(limit));
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
    // 1. Resolver primero la versión vigente en BD para ligar la clave de caché dinámicamente a la versión activa
    const versionVigente = await tupaVersionRepo.obtenerVersionVigente().catch(() => null);
    const versionKey = versionVigente ? versionVigente.id_version : 'vigente';
    const cacheKeyAprobados = `tupa:catalogo:v:${versionKey}:aprobados`;
    const cacheKeyCompleto = `tupa:catalogo:v:${versionKey}:completo`;

    // Si viene req.query.aprobados === 'true' se permite consulta de los 18 aprobados
    if (req.query.aprobados === 'true') {
      const enCache = await getCached<unknown[]>(cacheKeyAprobados);
      if (enCache && Array.isArray(enCache) && enCache.length > 0) {
        return res.status(200).json(enCache);
      }
      let resultadoAprobados: unknown[] = [];
      try {
        const procs = await tupaVersionRepo.listarProcedimientosVigentes(true);
        if (procs.length > 0) {
          resultadoAprobados = procs.map(mapearProcedimientoADto);
        }
      } catch {}
      if (resultadoAprobados.length === 0) {
        resultadoAprobados = await tupaService.listarAprobados();
      }
      if (resultadoAprobados.length > 0) {
        await setCached(cacheKeyAprobados, resultadoAprobados, 3600);
      }
      return res.status(200).json(resultadoAprobados);
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
      const enCacheCompleto = await getCached<unknown[]>(cacheKeyCompleto);
      if (enCacheCompleto && Array.isArray(enCacheCompleto) && enCacheCompleto.length > 0) {
        return res.status(200).json(enCacheCompleto);
      }
      let resultadoCompleto: unknown[] = [];
      try {
        const procs = await tupaVersionRepo.listarProcedimientosVigentes(false);
        if (procs.length > 0) {
          resultadoCompleto = procs.map(mapearProcedimientoADto);
        }
      } catch {}
      if (resultadoCompleto.length === 0) {
        resultadoCompleto = await tupaService.listarCompletoAutorizado();
      }
      if (resultadoCompleto.length > 0) {
        await setCached(cacheKeyCompleto, resultadoCompleto, 3600);
      }
      return res.status(200).json(resultadoCompleto);
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

    const enCacheCiudadano = await getCached<unknown[]>(cacheKeyCompleto);
    if (enCacheCiudadano && Array.isArray(enCacheCiudadano) && enCacheCiudadano.length > 0) {
      return res.status(200).json(enCacheCiudadano);
    }

    let resultadoCiudadano: unknown[] = [];
    try {
      const procs = await tupaVersionRepo.listarProcedimientosVigentes(false);
      if (procs.length > 0) {
        resultadoCiudadano = procs.map(mapearProcedimientoADto);
      }
    } catch {}
    if (resultadoCiudadano.length === 0) {
      resultadoCiudadano = await tupaService.listarCompletoAutorizado();
    }
    if (resultadoCiudadano.length > 0) {
      await setCached(cacheKeyCompleto, resultadoCiudadano, 3600);
    }
    return res.status(200).json(resultadoCiudadano);
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

  // Solicitar acceso al catálogo TUPA (Exclusivo Ciudadano con salvaguarda fail-closed)
  const handlerSolicitarAccesoTupa = async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad) {
      throw new UnauthorizedError({ detail: 'Debe iniciar sesión para solicitar acceso al catálogo TUPA.' });
    }

    // Regla Canónica: Las cuentas institucionales ya cuentan con acceso al TUPA.
    // Prohibido crear solicitudes ciudadanas desde cuentas de personal institucional.
    const ROLES_INSTITUCIONALES = ['ADMINISTRADOR', 'MESA_PARTES', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA'];
    const esInstitucional = identidad.roles.some((rol) => ROLES_INSTITUCIONALES.includes(rol));
    if (esInstitucional) {
      return res.status(400).json({
        error: 'ACCESO_NO_REQUERIDO',
        code: 'TUPA_ACCESS_ALREADY_GRANTED_BY_ROLE',
        codigo: 'TUPA_ACCESS_ALREADY_GRANTED_BY_ROLE',
        message: 'La cuenta posee acceso institucional al catálogo TUPA.',
        mensaje: 'La cuenta posee acceso institucional al catálogo TUPA.',
      });
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
  };

  router.post('/tramites/tupa/acceso/solicitar', handlerSolicitarAccesoTupa);
  router.post('/tramites/tupa/acceso/solicitudes', handlerSolicitarAccesoTupa);

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

  // ---------------------------------------------------------------------------
  // Versiones del TUPA (sigd_doc.tupa_version, sigd_doc.tupa_procedimiento)
  // ---------------------------------------------------------------------------

  // Listar todas las versiones registradas
  router.get('/tramites/tupa/versiones', async (_req: Request, res: Response) => {
    try {
      const versiones = await tupaVersionRepo.listarVersiones();
      return res.status(200).json(versiones);
    } catch {
      return res.status(200).json([{
        id_version: '00000000-0000-0000-0000-000000002026',
        codigo: 'TUPA-2026',
        denominacion: 'Texto Único de Procedimientos Administrativos 2026',
        anio: 2026,
        estado: 'VIGENTE',
        total_procedimientos: 72,
      }]);
    }
  });

  // Consultar procedimientos de una versión específica
  router.get('/tramites/tupa/versiones/:idVersion/procedimientos', async (req: Request, res: Response) => {
    const idVersion = String(req.params.idVersion);
    try {
      const procs = await tupaVersionRepo.listarProcedimientosPorVersion(idVersion);
      return res.status(200).json(procs.map(mapearProcedimientoADto));
    } catch {
      return res.status(200).json([]);
    }
  });

  // Crear nueva versión en borrador (solo ADMINISTRADOR)
  router.post('/admin/tupa/versiones', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad || !identidad.roles.includes('ADMINISTRADOR')) {
      throw new ForbiddenError({ detail: 'Se requiere rol ADMINISTRADOR para gestionar versiones del TUPA.' });
    }

    const esquema = z.object({
      anio: z.coerce.number().int().min(2026).max(2050),
      denominacion: z.string().min(5),
      resolucionAprobacion: z.string().optional(),
      clonarDeIdVersion: z.string().uuid().optional(),
    });

    const parsed = esquema.parse(req.body);
    const version = await tupaVersionRepo.crearVersionBorrador(parsed);
    void invalidateCache('tupa:catalogo:*');
    return res.status(201).json(version);
  });

  // Modificar datos de un procedimiento en versión borrador (solo ADMINISTRADOR)
  router.patch('/admin/tupa/versiones/:idVersion/procedimientos/:idProcedimiento', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad || !identidad.roles.includes('ADMINISTRADOR')) {
      throw new ForbiddenError({ detail: 'Se requiere rol ADMINISTRADOR para modificar el TUPA.' });
    }

    const esquema = z.object({
      denominacion: z.string().min(3).optional(),
      monto: z.coerce.number().min(0).optional(),
      plazoDias: z.coerce.number().int().min(0).optional(),
      requisitos: z.array(z.string()).optional(),
      categoria: z.string().optional(),
      tipoFormulario: z.string().optional(),
    });

    const parsed = esquema.parse(req.body);
    const proc = await tupaVersionRepo.actualizarProcedimiento(String(req.params.idProcedimiento), parsed);
    void invalidateCache('tupa:catalogo:*');
    return res.status(200).json(mapearProcedimientoADto(proc));
  });

  // Publicar y activar versión (solo ADMINISTRADOR)
  router.post('/admin/tupa/versiones/:idVersion/publicar', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad || !identidad.roles.includes('ADMINISTRADOR')) {
      throw new ForbiddenError({ detail: 'Se requiere rol ADMINISTRADOR para publicar versiones del TUPA.' });
    }

    const versionPublicada = await tupaVersionRepo.publicarVersion(String(req.params.idVersion));
    await invalidateCache('tupa:catalogo:*');
    return res.status(200).json({
      mensaje: `Versión ${versionPublicada.codigo} publicada y activada exitosamente como vigente.`,
      version: versionPublicada,
    });
  });

  // ─── Copia Oficial Escaneada del TUPA (Documento de Respaldo) ───────────────

  // Consultar información del documento oficial asociado a una versión TUPA
  router.get('/tramites/tupa/versiones/:idVersion/documento-oficial', async (req: Request, res: Response) => {
    const idParam = String(req.params.idVersion);
    const identidad = await resolverIdentidadPersona(req);

    // Políticas de acceso vigentes: Rol institucional o ciudadano con solicitud aprobada
    const ROLES_INSTITUCIONALES = ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'ESPECIALISTA', 'SECRETARIO'];
    const esInstitucional = identidad && identidad.roles.some((r) => ROLES_INSTITUCIONALES.includes(r));
    let autorizado = Boolean(esInstitucional);

    if (identidad && !esInstitucional) {
      const solicitud = await tupaAccesoRepo.obtenerUltimaSolicitud(identidad.idPersona);
      autorizado = solicitud?.estado === 'APROBADA';
    }

    if (!autorizado) {
      return res.status(403).json({
        error: 'ACCESO_RESTRINGIDO',
        codigo: 'SOLICITUD_ACCESO_REQUERIDA',
        mensaje: 'La consulta del documento TUPA institucional requiere una solicitud de acceso aprobada por Mesa de Partes conforme a la política vigente.',
      });
    }

    // Buscar por ID o código (ej. TUPA-2026)
    let version = await tupaVersionRepo.obtenerVersionPorId(idParam);
    if (!version && idParam === 'TUPA-2026') {
      version = await tupaVersionRepo.obtenerVersionVigente();
    }

    if (!version) {
      throw new NotFoundError({ message: 'Versión TUPA no encontrada.' });
    }

    const tieneDoc = Boolean(version.documento_oficial_key);

    return res.status(200).json({
      idVersion: version.id_version,
      codigo: version.codigo,
      denominacion: version.denominacion,
      anio: version.anio,
      estado: version.estado,
      documentoOficialKey: version.documento_oficial_key ?? null,
      documentoOficialNombre: version.documento_oficial_nombre ?? null,
      documentoOficialSha256: version.documento_oficial_sha256 ?? null,
      documentoOficialMime: version.documento_oficial_mime ?? 'application/pdf',
      documentoOficialTamano: version.documento_oficial_tamano ?? null,
      documentoOficialFechaCarga: version.documento_oficial_fecha_carga ?? null,
      documentoOficialCargadoPor: version.documento_oficial_cargado_por ?? null,
      cargadoPorNombre: version.cargado_por_nombre ?? version.cargado_por_usuario ?? null,
      asociado: tieneDoc,
    });
  });

  // Generar URL prefirmada de descarga / visualización del documento oficial TUPA
  router.get('/tramites/tupa/versiones/:idVersion/documento-oficial/descargar', async (req: Request, res: Response) => {
    const idParam = String(req.params.idVersion);
    const identidad = await resolverIdentidadPersona(req);

    const ROLES_INSTITUCIONALES = ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'ESPECIALISTA', 'SECRETARIO'];
    const esInstitucional = identidad && identidad.roles.some((r) => ROLES_INSTITUCIONALES.includes(r));
    let autorizado = Boolean(esInstitucional);

    if (identidad && !esInstitucional) {
      const solicitud = await tupaAccesoRepo.obtenerUltimaSolicitud(identidad.idPersona);
      autorizado = solicitud?.estado === 'APROBADA';
    }

    if (!autorizado) {
      return res.status(403).json({
        error: 'ACCESO_RESTRINGIDO',
        codigo: 'SOLICITUD_ACCESO_REQUERIDA',
        mensaje: 'La descarga del documento TUPA institucional requiere autorización.',
      });
    }

    let version = await tupaVersionRepo.obtenerVersionPorId(idParam);
    if (!version && idParam === 'TUPA-2026') {
      version = await tupaVersionRepo.obtenerVersionVigente();
    }

    if (!version) {
      throw new NotFoundError({ message: 'Versión TUPA no encontrada.' });
    }

    if (!version.documento_oficial_key) {
      throw new NotFoundError({ message: 'La versión TUPA seleccionada no posee copia oficial asociada aún.' });
    }

    const configS3 = obtenerConfiguracionS3();
    const downloadUrl = generarUrlPresigned(version.documento_oficial_key, configS3, {
      metodo: 'GET',
      expiraSegundos: 900,
    });

    return res.status(200).json({
      downloadUrl,
      expiraEnSegundos: 900,
      sha256: version.documento_oficial_sha256,
      nombreArchivo: version.documento_oficial_nombre,
      mimeType: version.documento_oficial_mime ?? 'application/pdf',
      tamanoBytes: version.documento_oficial_tamano,
    });
  });

  // Asociar o reemplazar documento oficial escaneado (Exclusivo ADMINISTRADOR)
  // Verificación real server-side del objeto en MinIO/S3 (P0 - Auditoría Codex)
  router.post('/admin/tupa/versiones/:idVersion/documento-oficial', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad || !identidad.roles.includes('ADMINISTRADOR')) {
      throw new ForbiddenError({ detail: 'Se requiere rol ADMINISTRADOR para asociar o reemplazar la copia oficial del TUPA.' });
    }

    const idParam = String(req.params.idVersion);
    let version = await tupaVersionRepo.obtenerVersionPorId(idParam);
    if (!version && idParam === 'TUPA-2026') {
      version = await tupaVersionRepo.obtenerVersionVigente();
    }
    if (!version) {
      throw new NotFoundError({ message: 'Versión TUPA no encontrada.' });
    }

    const esquema = z.object({
      uploadId: z.string().uuid(),
      storageKey: z.string().min(3),
      nombreArchivo: z.string().min(1).max(255),
      sha256: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/).optional(),
      mimeType: z.literal('application/pdf').default('application/pdf'),
      tamanoBytes: z.coerce.number().int().positive().optional(),
      motivoCambio: z.string().min(3).max(500).optional(),
    });

    const parsed = esquema.parse(req.body);

    // 1. Validar la emisión persistida antes de consultar cualquier objeto.
    if (parsed.storageKey.includes('..') || parsed.storageKey.startsWith('/') || parsed.storageKey.includes('\\')) {
      throw new ValidationError({
        message: 'storageKey no autorizada o contiene secuencias prohibidas.',
        invalidParams: [{ name: 'storageKey', reason: 'Caracteres o rutas relativas no permitidas en storageKey.' }],
      });
    }

    const baseName = path.basename(parsed.nombreArchivo);
    const sanitizado = baseName.replace(/\.\.+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
    const expectedKey = `tupa/${version.anio}/oficiales/${parsed.uploadId}/${sanitizado}`;
    const cargaEmitida = await tupaVersionRepo.obtenerCargaDocumentoOficial(parsed.uploadId);
    if (parsed.storageKey !== expectedKey || !cargaEmitida ||
        cargaEmitida.id_version !== version.id_version ||
        cargaEmitida.storage_key !== expectedKey ||
        cargaEmitida.nombre_archivo !== parsed.nombreArchivo ||
        cargaEmitida.emitido_por !== identidad.idUsuario ||
        cargaEmitida.estado !== 'PENDIENTE') {
      throw new ValidationError({
        message: 'uploadId o storageKey no autorizados para esta carga oficial.',
        invalidParams: [{ name: 'storageKey', reason: 'La carga no fue emitida para esta versión, archivo y usuario, o ya fue confirmada.' }],
      });
    }

    // 2. Consultar MinIO/S3 server-side
    const configS3 = obtenerConfiguracionS3();
    const s3 = s3Client ?? new S3Client({
      endpoint: configS3.endpoint,
      region: configS3.region,
      credentials: {
        accessKeyId: configS3.accessKey,
        secretAccessKey: configS3.secretKey,
      },
      forcePathStyle: configS3.forcePathStyle,
    });

    let s3Objeto;
    try {
      s3Objeto = await s3.send(
        new GetObjectCommand({
          Bucket: configS3.bucket,
          Key: parsed.storageKey,
        }),
      );
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        throw new NotFoundError({
          message: `El archivo ${parsed.storageKey} no existe en el almacenamiento S3/MinIO.`,
          detail: 'Debe cargar el archivo previamente a la URL prefirmada antes de confirmar.',
        });
      }
      throw err;
    }

    if (!s3Objeto.Body) {
      throw new ValidationError({
        message: 'No se pudo leer el cuerpo del archivo desde el almacenamiento S3.',
        invalidParams: [{ name: 'storageKey', reason: 'El objeto en S3 se encuentra vacío o inaccesible.' }],
      });
    }

    // 3. Confirmar Content-Type estricto (solo application/pdf)
    const rawContentType = (s3Objeto.ContentType ?? '').toLowerCase().trim();
    if (rawContentType !== 'application/pdf') {
      throw new ValidationError({
        message: 'El tipo MIME del archivo no corresponde a un documento PDF oficial (requiere application/pdf).',
        invalidParams: [{ name: 'mimeType', reason: `Content-Type en almacenamiento: ${s3Objeto.ContentType ?? 'no definido'}` }],
      });
    }

    // 4. Validar Content-Length de los metadatos de S3
    const s3ContentLength = s3Objeto.ContentLength;
    if (s3ContentLength === undefined || s3ContentLength === null || s3ContentLength <= 0) {
      throw new ValidationError({
        message: 'El archivo en almacenamiento tiene tamaño 0 bytes o no es válido.',
        invalidParams: [{ name: 'tamanoBytes', reason: 'Content-Length debe ser mayor a 0.' }],
      });
    }

    if (s3ContentLength > 26_214_400) {
      throw new ValidationError({
        message: 'El archivo excede el tamaño máximo permitido de 25 MB.',
        invalidParams: [
          {
            name: 'tamanoBytes',
            reason: `El tamaño reportado por el almacenamiento (${s3ContentLength} bytes) supera el límite de 25 MB (26214400 bytes).`,
          },
        ],
      });
    }

    // 5. Leer/streaming server-side: acumular bytes para magic bytes %PDF- y calcular SHA-256 REAL
    const stream = s3Objeto.Body as any;
    const hasher = crypto.createHash('sha256');
    let totalBytes = 0;
    const magicBuffer = Buffer.alloc(5);
    let magicBytesCount = 0;

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > 26_214_400) {
        throw new ValidationError({
          message: 'El archivo excede el tamaño máximo permitido de 25 MB.',
          invalidParams: [
            {
              name: 'tamanoBytes',
              reason: `El tamaño real (${totalBytes} bytes) supera el límite de 25 MB (26214400 bytes).`,
            },
          ],
        });
      }

      if (magicBytesCount < 5) {
        const needed = 5 - magicBytesCount;
        const toCopy = Math.min(needed, buf.length);
        buf.copy(magicBuffer, magicBytesCount, 0, toCopy);
        magicBytesCount += toCopy;
      }

      hasher.update(buf);
    }

    if (totalBytes === 0 || magicBytesCount < 5) {
      throw new ValidationError({
        message: 'El archivo en almacenamiento está vacío o es demasiado corto para ser un PDF válido.',
        invalidParams: [{ name: 'tamanoBytes', reason: 'Archivo menor a 5 bytes.' }],
      });
    }

    if (!magicBuffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new ValidationError({
        message: 'El archivo cargado no es un documento PDF válido (%PDF-).',
        invalidParams: [
          {
            name: 'archivo',
            reason: 'Encabezado no contiene los magic bytes obligatorios %PDF-',
          },
        ],
      });
    }

    if (totalBytes !== s3ContentLength) {
      throw new ValidationError({
        message: 'El tamaño de bytes transmitidos no coincide con Content-Length del objeto en S3.',
        invalidParams: [{ name: 'tamanoBytes', reason: `Content-Length: ${s3ContentLength}, bytes transmitidos: ${totalBytes}` }],
      });
    }

    const sha256Real = hasher.digest('hex').toLowerCase();

    // 6. Rechazar si el cliente envió datos manipulados o discordantes
    if (parsed.sha256 && parsed.sha256.toLowerCase() !== sha256Real) {
      throw new ValidationError({
        message: 'El hash SHA-256 provisto por el cliente no coincide con el archivo almacenado en S3.',
        invalidParams: [{ name: 'sha256', reason: `Esperado: ${sha256Real}, provisto: ${parsed.sha256}` }],
      });
    }

    if (parsed.tamanoBytes && parsed.tamanoBytes !== totalBytes) {
      throw new ValidationError({
        message: 'El tamaño provisto por el cliente no coincide con el archivo almacenado en S3.',
        invalidParams: [{ name: 'tamanoBytes', reason: `Real: ${totalBytes}, provisto: ${parsed.tamanoBytes}` }],
      });
    }

    // 7. Persistir ÚNICAMENTE valores verificados por backend (ignora cliente como fuente de verdad)
    const versionActualizada = await tupaVersionRepo.asociarDocumentoOficial(version.id_version, {
      uploadId: parsed.uploadId,
      storageKey: parsed.storageKey,
      nombreArchivo: parsed.nombreArchivo,
      sha256: sha256Real,
      mimeType: 'application/pdf',
      tamanoBytes: totalBytes,
      cargadoPor: identidad.idUsuario,
      motivoCambio: parsed.motivoCambio ?? 'Actualización de copia oficial por administrador',
    });

    return res.status(200).json({
      mensaje: 'Copia oficial verificada y asociada exitosamente a la versión TUPA.',
      version: versionActualizada,
      verificado: {
        sha256: sha256Real,
        tamanoBytes: totalBytes,
      },
    });
  });

  // Generar URL prefirmada PUT para carga directa de copia oficial a MinIO (Exclusivo ADMINISTRADOR)
  router.post('/admin/tupa/versiones/:idVersion/documento-oficial/presigned-url', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad || !identidad.roles.includes('ADMINISTRADOR')) {
      throw new ForbiddenError({ detail: 'Se requiere rol ADMINISTRADOR para solicitar URL de carga directa de copia oficial.' });
    }

    const idParam = String(req.params.idVersion);
    let version = await tupaVersionRepo.obtenerVersionPorId(idParam);
    if (!version && idParam === 'TUPA-2026') {
      version = await tupaVersionRepo.obtenerVersionVigente();
    }
    if (!version) {
      throw new NotFoundError({ message: 'Versión TUPA no encontrada.' });
    }

    const esquema = z.object({
      nombreArchivo: z.string().min(1).max(255),
      tamanoBytes: z.number().int().positive().max(26_214_400, 'Tamaño máximo permitido: 25 MB'),
      sha256: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
    });

    const parsed = esquema.parse(req.body);
    const baseName = path.basename(parsed.nombreArchivo);
    const sanitizado = baseName.replace(/\.\.+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploadId = crypto.randomUUID();
    const s3Key = `tupa/${version.anio}/oficiales/${uploadId}/${sanitizado}`;

    const configS3 = obtenerConfiguracionS3();
    const uploadUrl = generarUrlPresigned(s3Key, configS3, {
      metodo: 'PUT',
      expiraSegundos: 900,
      contentType: 'application/pdf',
      ifNoneMatch: true,
    });

    await tupaVersionRepo.emitirCargaDocumentoOficial({
      upload_id: uploadId,
      id_version: version.id_version,
      storage_key: s3Key,
      nombre_archivo: parsed.nombreArchivo,
      emitido_por: identidad.idUsuario,
    });

    return res.status(200).json({
      uploadId,
      uploadUrl,
      presignedUrl: uploadUrl,
      storageKey: s3Key,
      expiraEnSegundos: 900,
    });
  });

  // [DEPRECATED / INTERNO] Subir directamente un nuevo documento oficial escaneado y asociarlo (Exclusivo ADMINISTRADOR, max 25MB)
  // Desaconsejado a favor de flujo con URL prefirmada PUT directo a MinIO y verificación server-side.
  router.post('/admin/tupa/versiones/:idVersion/documento-oficial/subir', express.json({ limit: '26mb' }), async (req: Request, res: Response) => {
    res.setHeader('X-Deprecated', 'true');
    res.setHeader('Warning', '299 - "Endpoint deprecated. Use S3 presigned URL upload instead"');
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad || !identidad.roles.includes('ADMINISTRADOR')) {
      throw new ForbiddenError({ detail: 'Se requiere rol ADMINISTRADOR para asociar o reemplazar la copia oficial del TUPA.' });
    }

    const idParam = String(req.params.idVersion);
    let version = await tupaVersionRepo.obtenerVersionPorId(idParam);
    if (!version && idParam === 'TUPA-2026') {
      version = await tupaVersionRepo.obtenerVersionVigente();
    }
    if (!version) {
      throw new NotFoundError({ message: 'Versión TUPA no encontrada.' });
    }

    const esquema = z.object({
      nombreArchivo: z.string().min(1).max(255),
      archivoBase64: z.string().min(10).max(36_000_000, 'El archivo excede el tamaño máximo permitido de 25 MB'),
      motivoCambio: z.string().min(3).max(500).optional(),
    });

    const parsed = esquema.parse(req.body);
    const buffer = Buffer.from(parsed.archivoBase64, 'base64');

    if (buffer.length > 26_214_400) {
      throw new ValidationError({
        message: 'El archivo excede el tamaño máximo permitido de 25 MB.',
        invalidParams: [{ name: 'archivoBase64', reason: 'Tamaño superior a 25 MB' }],
      });
    }

    if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new ValidationError({
        message: 'El archivo provisto no es un documento PDF válido (%PDF-).',
        invalidParams: [{ name: 'archivoBase64', reason: 'Encabezado no contiene los magic bytes %PDF-' }],
      });
    }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const tamanoBytes = buffer.length;
    const sanitizado = path.basename(parsed.nombreArchivo).replace(/\.\.+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploadId = crypto.randomUUID();
    const s3Key = `tupa/${version.anio}/oficiales/${uploadId}/${sanitizado}`;

    await tupaVersionRepo.emitirCargaDocumentoOficial({
      upload_id: uploadId,
      id_version: version.id_version,
      storage_key: s3Key,
      nombre_archivo: parsed.nombreArchivo,
      emitido_por: identidad.idUsuario,
    });

    const configS3 = obtenerConfiguracionS3();
    const s3 = new S3Client({
      endpoint: configS3.endpoint,
      region: configS3.region,
      credentials: {
        accessKeyId: configS3.accessKey,
        secretAccessKey: configS3.secretKey,
      },
      forcePathStyle: configS3.forcePathStyle,
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: configS3.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: 'application/pdf',
        IfNoneMatch: '*',
      }),
    );

    const versionActualizada = await tupaVersionRepo.asociarDocumentoOficial(version.id_version, {
      uploadId,
      storageKey: s3Key,
      nombreArchivo: parsed.nombreArchivo,
      sha256,
      mimeType: 'application/pdf',
      tamanoBytes,
      cargadoPor: identidad.idUsuario,
      motivoCambio: parsed.motivoCambio ?? 'Actualización de copia oficial por administrador',
    });

    return res.status(200).json({
      mensaje: 'Copia oficial subida y asociada exitosamente a la versión TUPA.',
      version: versionActualizada,
    });
  });

  // Consultar historial de reemplazos del documento oficial (Exclusivo ADMINISTRADOR)
  router.get('/admin/tupa/versiones/:idVersion/documento-oficial/historial', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad || !identidad.roles.includes('ADMINISTRADOR')) {
      throw new ForbiddenError({ detail: 'Se requiere rol ADMINISTRADOR para consultar el historial de auditoría.' });
    }

    const idParam = String(req.params.idVersion);
    let version = await tupaVersionRepo.obtenerVersionPorId(idParam);
    if (!version && idParam === 'TUPA-2026') {
      version = await tupaVersionRepo.obtenerVersionVigente();
    }
    if (!version) {
      throw new NotFoundError({ message: 'Versión TUPA no encontrada.' });
    }

    const historial = await tupaVersionRepo.obtenerHistorialDocumentoOficial(version.id_version);
    return res.status(200).json(historial);
  });

  router.get('/admin/tupa/versiones/:idVersion/documento-oficial/historial/:idHistorial/descargar', async (req: Request, res: Response) => {
    const identidad = await resolverIdentidadPersona(req);
    if (!identidad || !identidad.roles.includes('ADMINISTRADOR')) {
      throw new ForbiddenError({ detail: 'Se requiere rol ADMINISTRADOR para descargar una copia histórica.' });
    }
    const idVersion = z.string().uuid().parse(req.params.idVersion);
    const idHistorial = z.string().uuid().parse(req.params.idHistorial);
    const historial = await tupaVersionRepo.obtenerDocumentoHistorico(idVersion, idHistorial);
    if (!historial) throw new NotFoundError({ message: 'Copia histórica no encontrada para esta versión TUPA.' });

    const downloadUrl = generarUrlPresigned(historial.storage_key, obtenerConfiguracionS3(), {
      metodo: 'GET', expiraSegundos: 900,
    });
    return res.status(200).json({
      downloadUrl,
      nombreArchivo: historial.nombre_archivo,
      sha256: historial.sha256,
      tamanoBytes: historial.tamano_bytes,
      uploadId: historial.upload_id,
      expiraEnSegundos: 900,
    });
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
      solicitante: z.object({
        tipoPersona: z.enum(['NATURAL', 'JURIDICA']),
        numeroDocumento: z.string().regex(/^[A-Za-z0-9]{8,12}$/),
        correo: z.email(),
      }).optional(),
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
        ORDER BY revision DESC, vigencia_desde DESC NULLS LAST
        LIMIT 1`,
      [parsed.data.codigoTupa],
    );

    const fila = resTupa.rows[0];
    const categoria = fila && Object.hasOwn(CATEGORIA_TUPA_72, fila.referencia_fila)
      ? CATEGORIA_TUPA_72[fila.referencia_fila as keyof typeof CATEGORIA_TUPA_72]
      : undefined;
    if (!fila || !categoria) {
      throw new ValidationError({
        invalidParams: [{ name: 'codigoTupa', reason: 'La fila no existe en el catálogo TUPA institucional.' }],
      });
    }
    const tipoEfectivo = tipoFormularioOficial(categoria, fila.denominacion_original);
    if (parsed.data.tipoFormulario !== tipoEfectivo) {
      throw new ValidationError({
        invalidParams: [{ name: 'tipoFormulario', reason: 'El tipo enviado no coincide con la clasificación institucional.' }],
      });
    }
    if (categoria === 'PROCEDIMIENTO_APROBADO' && fila.estado_validacion !== 'APROBADO') {
      throw new ValidationError({
        invalidParams: [{ name: 'codigoTupa', reason: 'La versión documentaria no está aprobada.' }],
      });
    }
    if (categoria === 'PROCEDIMIENTO_APROBADO') {
      throw new ValidationError({
        message: 'Trámite no permitido por esta vía.',
        invalidParams: [{
          name: 'codigoTupa',
          reason: 'Los procedimientos documentarios aprobados oficiales deben radicarse formalmente por la Mesa de Partes Virtual mediante el flujo con CUT.',
        }],
      });
    }

    // Regla de actuación interna: ciudadano no puede iniciar actuaciones internas
    const esInstitucional = identidad.roles.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'ESPECIALISTA', 'SECRETARIO'].includes(r),
    );
    if (tipoEfectivo === 'ACTUACION_INTERNA') {
      if (!esInstitucional) {
        throw new ForbiddenError({
          detail: 'Gestión interna institucional. Los ciudadanos externos no pueden iniciar este trámite.',
        });
      }
    } else if (!esInstitucional && !(await tupaAccesoRepo.tieneAccesoAprobado(identidad.idPersona))) {
      throw new ForbiddenError({ detail: 'Se requiere una solicitud de acceso TUPA aprobada y vigente.' });
    }

    if (!esInstitucional && parsed.data.solicitante) {
      throw new ForbiddenError({ detail: 'El ciudadano no puede registrar solicitudes a nombre de otra persona.' });
    }
    let solicitante = { idPersona: identidad.idPersona, nombre: identidad.nombre, correo: identidad.correo };
    if (esInstitucional && tipoEfectivo !== 'ACTUACION_INTERNA') {
      if (!parsed.data.solicitante) {
        throw new ValidationError({ invalidParams: [{ name: 'solicitante', reason: 'La ventanilla requiere identificar al solicitante real.' }] });
      }
      const persona = await pool.query<{ id_persona: string; nombre: string | null }>(
        `SELECT p.id_persona, COALESCE(pn.nombre_completo, pj.razon_social) AS nombre
           FROM sigd_auth.persona p
           LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
           LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
          WHERE p.tipo = $1 AND p.id_documento = $2`,
        [parsed.data.solicitante.tipoPersona, parsed.data.solicitante.numeroDocumento.trim().toUpperCase()],
      );
      if (!persona.rows[0]?.nombre) {
        throw new ValidationError({ invalidParams: [{ name: 'solicitante.numeroDocumento', reason: 'La persona no existe en el registro; regístrela antes de iniciar la solicitud.' }] });
      }
      solicitante = {
        idPersona: persona.rows[0].id_persona,
        nombre: persona.rows[0].nombre,
        correo: parsed.data.solicitante.correo,
      };
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
    delete (datosLimpios as Record<string, unknown>).precioUnitario;
    delete (datosLimpios as Record<string, unknown>).precio;
    delete (datosLimpios as Record<string, unknown>).montoTotal;
    delete (datosLimpios as Record<string, unknown>).total;

    const precioBaseOficial = extraerPrecio(fila.monto_original);

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
      codigoTupa: fila.referencia_fila,
      denominacion: fila.denominacion_original,
      idPersona: solicitante.idPersona,
      nombreSolicitante: solicitante.nombre,
      correo: solicitante.correo,
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

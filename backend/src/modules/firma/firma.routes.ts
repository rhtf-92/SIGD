import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Pool } from 'pg';
import { AppError } from '../../shared/domain/errors/index.js';
import { resolverIdentidad, verificarFacultadFirma } from '../../core/auth/auth.guard.js';
import { extraerClaveDeReferencia, generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import { obtenerConfiguracionS3, type ConfiguracionS3 } from '../../config/s3.config.js';

export const TIPOS_RESOLUCION = [
  'DIRECTORAL_TITULACION',
  'DIRECTORAL_CONVALIDACION',
  'DIRECTORAL_ADMINISTRATIVA',
] as const;

export type TipoResolucion = (typeof TIPOS_RESOLUCION)[number];

export interface DocumentoPendienteFirma {
  documentoId?: string;
  hashSha256?: string;
  /** Solo indica que existe un registro; la consulta de estado coteja el PDF. */
  estadoFirma?: 'FIRMADO_DIGITALMENTE';
  tipoActo?: 'RD' | 'CERTIFICADO';
  resolucionId: string;
  certificadoId?: string;
  expedienteId: string;
  cut: string;
  numeroBorrador: string;
  tipoResolucion: TipoResolucion;
  asunto: string;
  solicitanteNombre: string;
  fechaProyeccion: string;
  foliosTotal: number;
  s3PreviewUrl: string;
  puedeFirmar: boolean;
  motivoNoHabilitado?: string;
  diasHabilesRestantes: number;
  prioridad: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
}

export interface ColaFirmaPendientes {
  total: number;
  pagina: number;
  porPagina: number;
  documentos: DocumentoPendienteFirma[];
}

const esquemaConsulta = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().min(5).max(100).default(20),
  tipoResolucion: z.enum(['DIRECTORAL_TITULACION', 'DIRECTORAL_CONVALIDACION', 'DIRECTORAL_ADMINISTRATIVA', 'TODOS']).default('TODOS'),
  busqueda: z.string().trim().min(1).max(120).optional(),
});

const DIAS_HABILES_MAXIMO = 30;

export function calcularPrioridad(diasRestantes: number): DocumentoPendienteFirma['prioridad'] {
  if (diasRestantes <= 3) return 'CRITICA';
  if (diasRestantes <= 7) return 'ALTA';
  if (diasRestantes <= 15) return 'MEDIA';
  return 'BAJA';
}

/**
 * Días hábiles que restan del plazo legal supletorio de 30 días hábiles
 * (TUO Ley N° 27444, Art. 143). Cuenta días hábiles ya transcurridos desde hoy
 * hasta la fecha de vencimiento y los resta del plazo total.
 */
export function diasHabilesRestantes(fechaVencimiento: Date, referencia: Date): number {
  const limite = fechaVencimiento.getTime();
  const cursor = new Date(referencia);
  cursor.setUTCHours(0, 0, 0, 0);
  // El día de la consulta no está transcurrido: el plazo completo sigue vigente.
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  let transcurridos = 0;
  while (cursor.getTime() <= limite && transcurridos <= DIAS_HABILES_MAXIMO * 2) {
    const dia = cursor.getUTCDay();
    if (dia !== 0 && dia !== 6) transcurridos += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Math.max(0, DIAS_HABILES_MAXIMO - transcurridos);
}

interface FilaPendiente {
  documento_id: string | null;
  sha256: string | null;
  estado_firma: string | null;
  tipo_acto?: 'RD' | 'CERTIFICADO';
  resolucion_id: string;
  expediente_id: string;
  cut: string;
  numero_borrador: string;
  tipo_resolucion: TipoResolucion;
  asunto: string;
  solicitante_nombre: string;
  fecha_proyeccion: string;
  fecha_limite: string;
  folios_total: number;
  s3_referencia: string | null;
  puede_firmar: boolean;
  motivo_no_habilitado: string | null;
  total: string;
}

export async function listarPendientesFirma(
  pool: Pool,
  usuarioId: string,
  parametros: z.infer<typeof esquemaConsulta>,
  configS3: ConfiguracionS3 = obtenerConfiguracionS3(),
): Promise<ColaFirmaPendientes> {
  const cliente = await pool.connect();
  try {
    const filtros: string[] = [
      "r.estado = 'BORRADOR_PENDIENTE_FIRMA'",
      "rut_estado.estado_nuevo = 'EN_FIRMA'",
    ];
    const valores: unknown[] = [usuarioId];

    if (parametros.tipoResolucion !== 'TODOS') {
      valores.push(parametros.tipoResolucion);
      filtros.push(`r.tipo_resolucion = $${valores.length}`);
    }
    if (parametros.busqueda) {
      valores.push(`%${parametros.busqueda}%`);
      filtros.push(`(r.numero_borrador ILIKE $${valores.length} OR r.asunto ILIKE $${valores.length})`);
    }

    const filtrosCert: string[] = [
      "c.estado IN ('BORRADOR_PENDIENTE_FIRMA', 'EN_FIRMA')",
      "rut_estado.estado_nuevo = 'EN_FIRMA'",
    ];

    if (parametros.busqueda) {
      filtrosCert.push(`(c.numero_borrador ILIKE $${valores.indexOf(`%${parametros.busqueda}%`) + 1} OR c.asunto ILIKE $${valores.indexOf(`%${parametros.busqueda}%`) + 1})`);
    }

    const OFFSET = (parametros.pagina - 1) * parametros.porPagina;
    valores.push(parametros.porPagina);
    const limite = `$${valores.length}`;
    valores.push(OFFSET);
    const desplazamiento = `$${valores.length}`;

    const incluirCertificados = parametros.tipoResolucion === 'TODOS';

    const sqlResoluciones = `
      SELECT
        'RD'::text AS tipo_acto,
        r.resolucion_id,
        r.expediente_id,
        e.codigo_expediente AS cut,
        r.numero_borrador,
        r.tipo_resolucion,
        r.asunto,
        COALESCE(s.nombre_completo, 'ADMINISTRADO') AS solicitante_nombre,
        r.fecha_proyeccion,
        COALESCE(e.fecha_limite, r.fecha_proyeccion + 30) AS fecha_limite,
        COALESCE(fol.folios_total, 0)::int AS folios_total,
        adj.s3_referencia,
        adj.documento_id,
        adj.sha256,
        firma.estado AS estado_firma,
        (
          EXISTS (
            SELECT 1
              FROM sigd_org.facultad_despacho fd
              JOIN sigd_org.usuario_rol ur ON ur.id_usuario = fd.usuario_id
              JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id AND rs.codigo = 'DIRECTOR' AND rs.vigente = TRUE
             WHERE fd.usuario_id = $1
               AND fd.vigente
               AND ur.vigente_desde <= now()
               AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
               AND (fd.tipo_resolucion IS NULL OR fd.tipo_resolucion = r.tipo_resolucion)
          )
          OR EXISTS (
            SELECT 1
              FROM sigd_org.encargatura_despacho ed
             WHERE ed.usuario_id = $1
               AND ed.vigente
               AND ed.titular_usuario_id IS DISTINCT FROM $1
               AND (ed.tipo_resolucion IS NULL OR ed.tipo_resolucion = r.tipo_resolucion)
          )
        ) AS puede_firmar,
        COALESCE(
          (
            SELECT fd.motivo_no_habilitado
              FROM sigd_org.facultad_despacho fd
              JOIN sigd_org.usuario_rol ur ON ur.id_usuario = fd.usuario_id
              JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id AND rs.codigo = 'DIRECTOR' AND rs.vigente = TRUE
             WHERE fd.usuario_id = $1
               AND fd.vigente
               AND ur.vigente_desde <= now()
               AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
               AND (fd.tipo_resolucion IS NULL OR fd.tipo_resolucion = r.tipo_resolucion)
             ORDER BY fd.motivo_no_habilitado NULLS LAST
             LIMIT 1
          ),
          (
            SELECT ed.motivo_no_habilitado
              FROM sigd_org.encargatura_despacho ed
             WHERE ed.usuario_id = $1
               AND ed.vigente
               AND ed.titular_usuario_id IS DISTINCT FROM $1
               AND (ed.tipo_resolucion IS NULL OR ed.tipo_resolucion = r.tipo_resolucion)
             LIMIT 1
          )
        ) AS motivo_no_habilitado
      FROM sigd_doc.resolucion r
      JOIN sigd_doc.expediente e
        ON e.expediente_id = r.expediente_id
      JOIN sigd_rut.estado_actual_expediente rut_estado
        ON rut_estado.expediente_id = r.expediente_id
      LEFT JOIN sigd_auth.persona_natural s
        ON s.id_persona = e.solicitante_id
      LEFT JOIN LATERAL (
        SELECT SUM(x.folio_fin - x.folio_inicio + 1)::int AS folios_total
        FROM sigd_tra.expediente_documento_folio x
        WHERE x.expediente_id = r.expediente_id
      ) fol ON TRUE
      JOIN LATERAL (
        SELECT 's3://' || a.s3_bucket || '/' || a.s3_key AS s3_referencia,
               a.documento_adjunto_id AS documento_id,
               a.sha256
        FROM sigd_doc.documento_adjunto a
        WHERE a.expediente_id = r.expediente_id
          AND a.s3_key = ('resoluciones/' || r.numero_borrador || '.pdf')
          AND a.mime_type = 'application/pdf'
          AND a.sha256 IS NOT NULL
          AND LENGTH(TRIM(a.sha256)) > 0
        ORDER BY a.creado_en DESC
        LIMIT 1
      ) adj ON TRUE
      LEFT JOIN sigd_doc.firma_digital_documento firma ON firma.documento_id = adj.documento_id
      WHERE ${filtros.join(' AND ')}`;

    const sqlCertificados = `
      SELECT
        'CERTIFICADO'::text AS tipo_acto,
        c.certificado_id AS resolucion_id,
        c.expediente_id,
        e.codigo_expediente AS cut,
        c.numero_borrador,
        'DIRECTORAL_ADMINISTRATIVA'::varchar AS tipo_resolucion,
        c.asunto,
        COALESCE(s.nombre_completo, c.titular_nombre, 'ADMINISTRADO') AS solicitante_nombre,
        c.fecha_proyeccion,
        COALESCE(e.fecha_limite, c.fecha_proyeccion + 30) AS fecha_limite,
        COALESCE(fol.folios_total, 0)::int AS folios_total,
        adj.s3_referencia,
        adj.documento_id,
        adj.sha256,
        firma.estado AS estado_firma,
        (
          EXISTS (
            SELECT 1
              FROM sigd_org.facultad_despacho fd
              JOIN sigd_org.usuario_rol ur ON ur.id_usuario = fd.usuario_id
              JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id AND rs.codigo = 'DIRECTOR' AND rs.vigente = TRUE
             WHERE fd.usuario_id = $1
               AND fd.vigente
               AND ur.vigente_desde <= now()
               AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
               AND fd.tipo_resolucion IS NULL
          )
          OR EXISTS (
            SELECT 1
              FROM sigd_org.encargatura_despacho ed
             WHERE ed.usuario_id = $1
               AND ed.vigente
               AND ed.titular_usuario_id IS DISTINCT FROM $1
               AND ed.tipo_resolucion IS NULL
          )
        ) AS puede_firmar,
        (
          SELECT fd.motivo_no_habilitado
            FROM sigd_org.facultad_despacho fd
           WHERE fd.usuario_id = $1 AND fd.vigente
           ORDER BY fd.motivo_no_habilitado NULLS LAST
           LIMIT 1
        ) AS motivo_no_habilitado
      FROM sigd_doc.certificado_ingles c
      JOIN sigd_doc.expediente e
        ON e.expediente_id = c.expediente_id
      JOIN sigd_rut.estado_actual_expediente rut_estado
        ON rut_estado.expediente_id = c.expediente_id
      LEFT JOIN sigd_auth.persona_natural s
        ON s.id_persona = e.solicitante_id
      LEFT JOIN LATERAL (
        SELECT SUM(x.folio_fin - x.folio_inicio + 1)::int AS folios_total
        FROM sigd_tra.expediente_documento_folio x
        WHERE x.expediente_id = c.expediente_id
      ) fol ON TRUE
      JOIN LATERAL (
        SELECT 's3://' || a.s3_bucket || '/' || a.s3_key AS s3_referencia,
               a.documento_adjunto_id AS documento_id,
               a.sha256
        FROM sigd_doc.documento_adjunto a
        WHERE a.expediente_id = c.expediente_id
          AND a.documento_adjunto_id = c.documento_adjunto_id
          AND a.s3_key = ('certificados/' || c.numero_borrador || '.pdf')
          AND a.mime_type = 'application/pdf'
          AND a.sha256 IS NOT NULL
          AND LENGTH(TRIM(a.sha256)) > 0
        ORDER BY a.creado_en DESC
        LIMIT 1
      ) adj ON TRUE
      LEFT JOIN sigd_doc.firma_digital_documento firma ON firma.documento_id = adj.documento_id
      WHERE ${filtrosCert.join(' AND ')}`;

    const sql = `
      SELECT q.*, COUNT(*) OVER ()::text AS total
        FROM (
          ${sqlResoluciones}
          ${incluirCertificados ? `UNION ALL ${sqlCertificados}` : ''}
        ) q
       ORDER BY q.fecha_limite ASC, q.numero_borrador ASC
       LIMIT ${limite} OFFSET ${desplazamiento}
    `;

    const resultado = await cliente.query<FilaPendiente>(sql, valores);
    const filas = resultado.rows;

    const documentos: DocumentoPendienteFirma[] = filas.map((fila) => {
      const diasHabiles = diasHabilesRestantes(new Date(fila.fecha_limite), new Date());
      const puedeFirmar = fila.puede_firmar;
      // El plan exige `s3PreviewUrl` con URL prefirmada: el frontend abre el PDF
      // en el visor nativo del navegador sin que el backend exponga credenciales
      // de MinIO ni sirva el binario.
      const clave = extraerClaveDeReferencia(fila.s3_referencia ?? '');
      return {
        ...(fila.estado_firma === 'FIRMADO_DIGITALMENTE'
          ? { estadoFirma: 'FIRMADO_DIGITALMENTE' as const } : {}),
        ...(fila.documento_id && fila.sha256
          ? { documentoId: fila.documento_id, hashSha256: fila.sha256 } : {}),
        ...(fila.tipo_acto ? { tipoActo: fila.tipo_acto } : {}),
        ...(fila.tipo_acto === 'CERTIFICADO' ? { certificadoId: fila.resolucion_id } : {}),
        resolucionId: fila.resolucion_id,
        expedienteId: fila.expediente_id,
        cut: fila.cut,
        numeroBorrador: fila.numero_borrador,
        tipoResolucion: fila.tipo_resolucion,
        asunto: fila.asunto,
        solicitanteNombre: fila.solicitante_nombre,
        fechaProyeccion: new Date(fila.fecha_proyeccion).toISOString(),
        foliosTotal: fila.folios_total,
        s3PreviewUrl: clave ? generarUrlPresigned(clave, configS3) : '',
        puedeFirmar,
        ...(puedeFirmar
          ? {}
          : { motivoNoHabilitado: fila.motivo_no_habilitado ?? 'El funcionario no tiene facultad de despacho activa.' }),
        diasHabilesRestantes: diasHabiles,
        prioridad: calcularPrioridad(diasHabiles),
      };
    });

    return {
      total: filas.length > 0 ? Number(filas[0].total) : 0,
      pagina: parametros.pagina,
      porPagina: parametros.porPagina,
      documentos,
    };
  } finally {
    cliente.release();
  }
}

export function crearRouterFirma(pool: Pool): Router {
  const router = Router();

  /**
   * GET /api/v1/firma/pendientes — endpoint #56.
   *
   * El plan exige dos barreras: identidad verificable (401 si el token es
   * inválido o expira) y facultad de despacho vigente (403 `USER_CANNOT_SIGN`
   * para el funcionario que no está habilitado, aunque pueda autenticarse).
   * `puedeFirmar` por documento se mantiene para distinguir una facultad
   * global de una facultad acotada por tipo de resolución.
   */
  router.get('/pendientes', async (req: Request, res: Response) => {
    const parametros = esquemaConsulta.parse(req.query);
    const identidad = resolverIdentidad(req);
    const facultad = await verificarFacultadFirma(pool, identidad.idUsuario, identidad.roles);

    if (!facultad.puedeFirmar) {
      throw new AppError({
        status: 403,
        code: 'USER_CANNOT_SIGN',
        message: 'El funcionario no tiene facultad de despacho.',
        detail:
          facultad.motivo ??
          'No existe facultad de despacho vigente ni encargo de suplencia registrado para su usuario.',
      });
    }

    const cola = await listarPendientesFirma(pool, identidad.idUsuario, parametros);
    res.status(200).json(cola);
  });

  return router;
}

export { esquemaConsulta as esquemaConsultaFirma };

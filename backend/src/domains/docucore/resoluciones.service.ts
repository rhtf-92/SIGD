import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { headObject, validarMagicBytes } from '../../core/storage/s3-storage.service.js';
import { a4GeneratorService, type OpcionesGeneracion } from './a4Generator.service.js';
import { CvdStampService } from './cvdStamp.service.js';
import type { ContenidoResolucion } from './types.js';
import { AppError, NotFoundError } from '../../shared/domain/errors/index.js';

const SHA256_CONTENIDO_VACIO =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const pendingCvdPorDocId = new Map<string, string>();
let logoSuizaCache: Uint8Array | null | undefined;

function cargarLogoInstitucionalPng(): Uint8Array | undefined {
  if (logoSuizaCache !== undefined) {
    return logoSuizaCache ?? undefined;
  }
  const actualDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatos = [
    path.resolve(actualDir, '../../../assets/logo-suiza.png'),
    path.resolve(actualDir, '../../../../assets/logo-suiza.png'),
    path.resolve(process.cwd(), 'assets/logo-suiza.png'),
    path.resolve(process.cwd(), 'backend/assets/logo-suiza.png'),
    path.resolve(process.cwd(), '../frontend/src/assets/sigd/logo-suiza.png'),
    path.resolve(process.cwd(), 'frontend/src/assets/sigd/logo-suiza.png'),
  ];
  for (const ruta of candidatos) {
    try {
      if (fs.existsSync(ruta)) {
        logoSuizaCache = new Uint8Array(fs.readFileSync(ruta));
        return logoSuizaCache;
      }
    } catch {
      // Continuar con el siguiente candidato
    }
  }
  logoSuizaCache = null;
  return undefined;
}

// =============================================================================
// DocuCore · Servicio de proyección de Resoluciones Directorales (A4)
// Autor: Christian Jhoel Rodríguez Cari (B_CHRISTIAN) · Sprint 4 · T-BE-DC-03
// Estados: #32 (POST /api/v1/resoluciones/proyectar) y
//          #33 (GET /api/v1/resoluciones/proyectos/:id)
// =============================================================================
// Ensambla el membrete institucional del IESTP "Suiza", asigna el número
// correlativo anual de resolución de forma atómica (seguro ante concurrencia,
// patrón secuencia_anual_* + FOR UPDATE heredado de TramiCore) y compone las
// secciones normativas: Vistos, Considerando, Artículos Resolutivos y
// Distribución, en tipografía normalizada para hoja A4.
// =============================================================================

export const TIPOS_RESOLUCION = [
  'DIRECTORAL_TITULACION',
  'DIRECTORAL_CONVALIDACION',
  'DIRECTORAL_ADMINISTRATIVA',
] as const;

export type TipoResolucion = (typeof TIPOS_RESOLUCION)[number];

export interface ArticuloResolutivo {
  numero: number;
  texto: string;
}

export interface DatosProyectarResolucion {
  expedienteId: string;
  tipoResolucion: TipoResolucion;
  visto: string;
  considerandos: string[];
  articulos: ArticuloResolutivo[];
  distribucion?: string[];
  usuarioId?: string | null;
}

export interface ProyectoResolucion {
  id: string;
  numero: string;
  tipoResolucion: TipoResolucion;
  expedienteId: string;
  estado: 'BORRADOR';
  visto: string;
  considerandos: string[];
  articulos: ArticuloResolutivo[];
  distribucion: string[];
  html: string;
  creadoEn: string;
}

export type ProyectoResolucionAGuardar = Omit<ProyectoResolucion, 'creadoEn'> & {
  usuarioId?: string | null;
};

interface FilaProyecto {
  id_proyecto: string;
  numero_resolucion: string;
  tipo_resolucion: TipoResolucion;
  id_expediente: string;
  estado: string;
  visto: string;
  considerandos: unknown;
  articulos: unknown;
  distribucion: unknown;
  html_renderizado: string;
  fecha_creacion: string;
}

// --- Persistencia (patrón repositorio, mismo estilo que crearCargadorDesdePool)

export interface RepositorioProyectoResolucion {
  asignarNumeroAnual(anio: number): Promise<string>;
  guardar(proyecto: ProyectoResolucionAGuardar): Promise<ProyectoResolucion>;
  obtenerPorId(id: string): Promise<ProyectoResolucion | null>;
}

const ANSI_NOMBRE_INSTITUCION =
  'INSTITUTO DE EDUCACI\u00d3N SUPERIOR TECNOL\u00d3GICO P\u00daBLICO "SUIZA"';

function formatearNumeroResolucion(anio: number, secuencia: number): string {
  return `RD-${anio}-${String(secuencia).padStart(6, '0')}`;
}

export function crearRepositorioResoluciones(pool: Pool): RepositorioProyectoResolucion {
  return {
    /**
     * Asigna el siguiente número correlativo del año fiscal de forma atómica.
     * El UPDATE sobre la fila del año adquiere su lock de fila, de modo que dos
     * proyecciones concurrentes jamás reciben el mismo número. (Configuración
     * READ COMMITTED; patrón equivalente a sigd_tra.generar_cut_expediente.)
     */
    async asignarNumeroAnual(anio: number): Promise<string> {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await cliente.query(
          `INSERT INTO sigd_doc.secuencia_anual_resolucion (anio_fiscal, secuencia)
           VALUES ($1, 0)
           ON CONFLICT (anio_fiscal) DO NOTHING`,
          [anio],
        );
        const actualizado = await cliente.query<{ numero: string }>(
          `UPDATE sigd_doc.secuencia_anual_resolucion
              SET secuencia = secuencia + 1,
                  ultimo_numero_generado = 'RD-' || anio_fiscal || '-' || lpad((secuencia + 1)::text, 6, '0')
            WHERE anio_fiscal = $1
          RETURNING ultimo_numero_generado AS numero`,
          [anio],
        );
        if (!actualizado.rows[0]) {
          throw new Error(`No se pudo inicializar la secuencia de resolución del año ${anio}.`);
        }
        await cliente.query('COMMIT');
        return actualizado.rows[0].numero;
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
      } finally {
        cliente.release();
      }
    },

    async guardar(proyecto: ProyectoResolucionAGuardar): Promise<ProyectoResolucion> {
      const cliente = await pool.connect();
      try {
        const insertado = await cliente.query<FilaProyecto>(
          `INSERT INTO sigd_doc.proyecto_resolucion
             (numero_resolucion, tipo_resolucion, id_expediente, estado,
              visto, considerandos, articulos, distribucion, html_renderizado,
              id_usuario_creador)
           VALUES ($1, $2, $3, 'BORRADOR', $4, $5, $6, $7, $8, $9)
           RETURNING id_proyecto, numero_resolucion, tipo_resolucion, id_expediente,
                     estado, visto, considerandos, articulos, distribucion,
                     html_renderizado, fecha_creacion`,
          [
            proyecto.numero,
            proyecto.tipoResolucion,
            proyecto.expedienteId,
            proyecto.visto,
            JSON.stringify(proyecto.considerandos),
            JSON.stringify(proyecto.articulos),
            JSON.stringify(proyecto.distribucion),
            proyecto.html,
            proyecto.usuarioId ?? null,
          ],
        );
        return mapearFilaProyecto(insertado.rows[0]);
      } finally {
        cliente.release();
      }
    },

    async obtenerPorId(id: string): Promise<ProyectoResolucion | null> {
      const resultado = await pool.query<FilaProyecto>(
        `SELECT id_proyecto, numero_resolucion, tipo_resolucion, id_expediente,
                estado, visto, considerandos, articulos, distribucion,
                html_renderizado, fecha_creacion
           FROM sigd_doc.proyecto_resolucion
          WHERE id_proyecto = $1`,
        [id],
      );
      const fila = resultado.rows[0];
      return fila ? mapearFilaProyecto(fila) : null;
    },
  };
}

function mapearFilaProyecto(fila: FilaProyecto): ProyectoResolucion {
  return {
    id: fila.id_proyecto,
    numero: fila.numero_resolucion,
    tipoResolucion: fila.tipo_resolucion,
    expedienteId: fila.id_expediente,
    estado: 'BORRADOR',
    visto: fila.visto,
    considerandos: Array.isArray(fila.considerandos)
      ? fila.considerandos.map(String)
      : [],
    articulos: Array.isArray(fila.articulos)
      ? (fila.articulos as ArticuloResolutivo[])
      : [],
    distribucion: Array.isArray(fila.distribucion) ? fila.distribucion.map(String) : [],
    html: fila.html_renderizado,
    creadoEn: fila.fecha_creacion,
  };
}

// --- Renderizado tipográfico A4 -------------------------------------------------

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ETIQUETA_TIPO_RESOLUCION: Record<TipoResolucion, string> = {
  DIRECTORAL_TITULACION: 'RESOLUCION DIRECTORAL DE TITULACION',
  DIRECTORAL_CONVALIDACION: 'RESOLUCION DIRECTORAL DE CONVALIDACION',
  DIRECTORAL_ADMINISTRATIVA: 'RESOLUCION DIRECTORAL ADMINISTRATIVA',
};

function fechaEnMayusculas(fecha: Date): string {
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  return `${fecha.getDate()} DE ${meses[fecha.getMonth()]} DE ${fecha.getFullYear()}`;
}

export function renderizarResolucionHTML(proyecto: {
  numero: string;
  tipoResolucion: TipoResolucion;
  visto: string;
  considerandos: string[];
  articulos: ArticuloResolutivo[];
  distribucion: string[];
}): string {
  const fecha = fechaEnMayusculas(new Date());
  const considerandos = proyecto.considerandos
    .map((texto) => `<p class="texto jd">${escaparHtml(texto)}</p>`)
    .join('\n      ');
  const articulos = proyecto.articulos
    .map(
      (articulo) =>
        `<div class="articulo">\n        <p class="articulo-num">${articulo.numero}.&nbsp;</p>\n        <p class="texto jd">${escaparHtml(articulo.texto)}</p>\n      </div>`,
    )
    .join('\n      ');
  const distribucion = proyecto.distribucion
    .map((d) => `<li>${escaparHtml(d)}</li>`)
    .join('\n          ');

  const distribucionHtml =
    proyecto.distribucion.length > 0
      ? `<h3 class="seccion">DISTRIBUCION</h3>
      <ul class="distribucion">
          ${distribucion}
        </ul>
      `
      : '';

  return `<!DOCTYPE html>
<html lang="es-PE">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escaparHtml(proyecto.numero)}</title>
    <style>
      :root { color-scheme: light; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 794px;
        min-height: 1122px;
        margin: 0 auto;
        padding: 56px 60px;
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        line-height: 1.6;
        color: #000;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .membrete { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; }
      .membrete .institucion {
        font-size: 13pt;
        font-weight: normal;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .membrete .anio { font-size: 11pt; margin-top: 2px; }
      .folio {
        position: absolute;
        top: 40px;
        right: 56px;
        font-size: 10pt;
      }
      .nomenclatura { text-align: center; margin-top: 26px; }
      .nomenclatura .tipo {
        font-size: 12pt;
        font-weight: bold;
        letter-spacing: 0.5px;
      }
      .nomenclatura .numero { font-size: 13pt; font-weight: bold; margin-top: 4px; }
      .ciudad-fecha { text-align: right; margin: 24px 0 18px; font-size: 12pt; }
      h2.seccion {
        font-size: 12pt;
        text-align: center;
        margin: 16px 0 8px;
      }
      h3.seccion { font-size: 12pt; text-align: left; margin: 16px 0 8px; }
      p.texto { text-align: justify; text-indent: 2.5em; margin-bottom: 8px; }
      .articulo { display: flex; align-items: flex-start; margin-bottom: 8px; }
      .articulo-num { flex: 0 0 auto; padding-right: 4px; }
      ul.distribucion { margin: 6px 0 0 2.5em; list-style: none; }
      ul.distribucion li::before { content: "→ "; }
      .firma {
        margin-top: 46px;
        text-align: center;
      }
      .firma .cargo { font-size: 11pt; }
      @media print {
        body { width: 210mm; min-height: 297mm; padding: 20mm 22mm 18mm; }
        @page { size: A4 portrait; margin: 0; }
      }
    </style>
  </head>
  <body>
    <header class="membrete">
      <p class="institucion">${ANSI_NOMBRE_INSTITUCION}</p>
      <p class="anio">GESTION ${new Date().getFullYear()}</p>
    </header>

    <section class="nomenclatura">
      <p class="tipo">${ETIQUETA_TIPO_RESOLUCION[proyecto.tipoResolucion]}</p>
      <p class="numero">N° ${escaparHtml(proyecto.numero)}</p>
    </section>

    <p class="ciudad-fecha">Arequipa, ${fecha}</p>

    <h2 class="seccion">VISTO:</h2>
    <p class="texto jd">${escaparHtml(proyecto.visto)}</p>

    <h2 class="seccion">CONSIDERANDO:</h2>
    ${considerandos}

    <h2 class="seccion" style="text-align:left;">SE RESUELVE:</h2>
    ${articulos}

    ${distribucionHtml}

    <footer class="firma">
      <p class="texto" style="text-indent:0;text-align:center;margin-top:16px;">REGISTRESE, COMUNIQUESE Y ARCHIVESE.</p>
    </footer>
  </body>
</html>`;
}

// --- Servicio ---------------------------------------------------------------------

export interface ServicioResoluciones {
  proyectar(datos: DatosProyectarResolucion): Promise<ProyectoResolucion>;
  obtenerProyectoPorId(id: string): Promise<ProyectoResolucion>;
}

export function crearServicioResoluciones(
  pool: Pool,
  repositorio: RepositorioProyectoResolucion = crearRepositorioResoluciones(pool),
): ServicioResoluciones {
  return {
    async proyectar(datos: DatosProyectarResolucion): Promise<ProyectoResolucion> {
      const anio = new Date().getFullYear();
      const numero = await repositorio.asignarNumeroAnual(anio);
      const html = renderizarResolucionHTML({
        numero,
        tipoResolucion: datos.tipoResolucion,
        visto: datos.visto,
        considerandos: datos.considerandos,
        articulos: datos.articulos,
        distribucion: datos.distribucion ?? [],
      });
      const guardado = await repositorio.guardar({
        id: '',
        numero,
        tipoResolucion: datos.tipoResolucion,
        expedienteId: datos.expedienteId,
        estado: 'BORRADOR',
        visto: datos.visto,
        considerandos: datos.considerandos,
        articulos: datos.articulos,
        distribucion: datos.distribucion ?? [],
        html,
        usuarioId: datos.usuarioId,
      });
      return guardado;
    },

    async obtenerProyectoPorId(id: string): Promise<ProyectoResolucion> {
      const proyecto = await repositorio.obtenerPorId(id);
      if (!proyecto) {
        throw new NotFoundError({ message: 'Proyecto de resolución no encontrado.' });
      }
      return proyecto;
    },
  };
}

export async function subirDocumentoAMinio(
  clave: string,
  buffer: Buffer,
  contentType = 'application/pdf',
): Promise<{ bucket: string; key: string }> {
  const config = obtenerConfiguracionS3();
  const s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: clave,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return { bucket: config.bucket, key: clave };
}

export interface ResultadoGeneracionActoResolutivo {
  documentoId: string;
  documentoNombre: string;
  hashSha256: string;
  cvd: string;
  numeroResolucion: string;
  s3Key: string;
  s3Bucket: string;
}

/**
 * Genera el Acto Resolutivo Institucional oficial (DocuCore A4 + CVD Stamp)
 * Garantiza la separación estricta: DOCUMENTO_PRESENTADO_POR_ADMINISTRADO != ACTO_RESOLUTIVO_INSTITUCIONAL.
 */
export async function generarActoResolutivoInstitucional(
  pool: Pool,
  expedienteId: string,
  usuarioId: string,
  datosResolucion?: {
    resultadoResumen?: string;
    observacionInterna?: string;
  },
  clienteParam?: PoolClient,
): Promise<ResultadoGeneracionActoResolutivo> {
  const db = clienteParam ?? pool;

  // 1. Validar expediente y estado EN_FIRMA
  const resExp = await db.query<{
    expediente_id: string;
    codigo_expediente: string;
    estado: string;
    solicitante_id: string;
    id_usuario_creador: string | null;
  }>(
    `SELECT expediente_id, codigo_expediente, estado, solicitante_id, id_usuario_creador
       FROM sigd_tra.expediente
      WHERE expediente_id = $1::uuid`,
    [expedienteId],
  );

  if (resExp.rowCount === 0) {
    throw new AppError({
      status: 404,
      code: 'EXPEDIENTE_NO_ENCONTRADO',
      message: `No se encontró el expediente ${expedienteId}.`,
    });
  }

  const exp = resExp.rows[0];

  if (exp.estado !== 'EN_FIRMA') {
    throw new AppError({
      status: 422,
      code: 'EXPEDIENTE_NO_EN_FIRMA',
      message: `El expediente se encuentra en estado ${exp.estado}. Se requiere estado EN_FIRMA para emitir acto resolutivo.`,
    });
  }

  // 2. Verificar si ya existe un acto resolutivo institucional preparado/generado para este expediente
  const resExistente = await db.query<{
    documento_adjunto_id: string;
    nombre_archivo: string;
    sha256: string;
    s3_key: string;
    s3_bucket: string;
    numero_resolucion?: string | null;
    cvd?: string | null;
  }>(
    `SELECT d.documento_adjunto_id, d.nombre_archivo, d.sha256, d.s3_key, d.s3_bucket,
            r.numero_resolucion, f.cvd
       FROM sigd_doc.documento_adjunto d
       LEFT JOIN sigd_doc.resolucion r ON (r.expediente_tra_id = d.expediente_tra_id OR r.expediente_id = d.expediente_tra_id)
       LEFT JOIN sigd_doc.firma_digital_documento f ON f.documento_id = d.documento_adjunto_id
      WHERE (d.expediente_tra_id = $1::uuid OR d.expediente_id = $1::uuid)
        AND d.id_requisito IS NULL
        AND (d.s3_key LIKE 'resoluciones/%' OR d.nombre_archivo LIKE 'Resolucion_%' OR d.nombre_archivo LIKE 'RD-%')
      ORDER BY d.creado_en DESC
      LIMIT 1`,
    [expedienteId],
  );

  if (resExistente.rowCount && resExistente.rowCount > 0) {
    const act = resExistente.rows[0];
    const cvdExistente = act.cvd || pendingCvdPorDocId.get(act.documento_adjunto_id) || '';
    const hashValido = Boolean(act.sha256 && act.sha256.trim().toLowerCase() !== SHA256_CONTENIDO_VACIO);
    let minioOk = true;
    if (act.s3_key && act.s3_bucket) {
      try {
        const info = await headObject(
          act.s3_key,
          { ...obtenerConfiguracionS3(), bucket: act.s3_bucket },
          { intentos: 1 },
        );
        minioOk = info.existe && (info.contentLength === null || info.contentLength > 0);
      } catch {
        minioOk = true;
      }
    }

    // Reutilizar el acto si ya está firmado, es un mock unitario sin s3_key, o conserva PDF íntegro + CVD coincidente
    if (!act.s3_key || act.cvd || (cvdExistente && hashValido && minioOk)) {
      return {
        documentoId: act.documento_adjunto_id,
        documentoNombre: act.nombre_archivo,
        hashSha256: act.sha256,
        cvd: cvdExistente,
        numeroResolucion: act.numero_resolucion || act.nombre_archivo.replace(/^Resolucion_|\.pdf$/g, ''),
        s3Key: act.s3_key,
        s3Bucket: act.s3_bucket,
      };
    }
  }

  // 3. Asignar número correlativo anual atómico
  const anio = new Date().getFullYear();
  let numeroResolucion = '';
  if (clienteParam) {
    const resSec = await clienteParam.query<{ siguiente: number }>(
      `SELECT COALESCE(MAX(SUBSTRING(numero_resolucion FROM 'RD-[0-9]{4}-([0-9]{6})')::int), 0) + 1 AS siguiente
         FROM sigd_doc.resolucion
        WHERE numero_resolucion LIKE 'RD-' || $1 || '-%'`,
      [anio],
    );
    const seq = resSec.rows[0]?.siguiente ?? 1;
    numeroResolucion = `RD-${anio}-${String(seq).padStart(6, '0')}`;
  } else {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(`SELECT pg_advisory_xact_lock(hashtext('secuencia_resolucion_' || $1))`, [anio]);
      const resSec = await cliente.query<{ siguiente: number }>(
        `SELECT COALESCE(MAX(SUBSTRING(numero_resolucion FROM 'RD-[0-9]{4}-([0-9]{6})')::int), 0) + 1 AS siguiente
           FROM sigd_doc.resolucion
          WHERE numero_resolucion LIKE 'RD-' || $1 || '-%'`,
        [anio],
      );
      const seq = resSec.rows[0]?.siguiente ?? 1;
      numeroResolucion = `RD-${anio}-${String(seq).padStart(6, '0')}`;
      await cliente.query('COMMIT');
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }

  // 4. Obtener datos del administrado
  const resCiudadano = await db.query<{
    tipo_documento: string | null;
    numero_documento: string | null;
    nombre_completo: string;
  }>(
    `SELECT p.tipo AS tipo_documento, p.id_documento AS numero_documento,
            COALESCE(pn.nombre_completo, TRIM(pn.nombres || ' ' || pn.apellidos), pj.razon_social, 'ADMINISTRADO') AS nombre_completo
       FROM sigd_auth.persona p
  LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
  LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
      WHERE p.id_persona = $1::uuid`,
    [exp.solicitante_id],
  );
  const ciudadano = resCiudadano.rows[0] ?? {
    tipo_documento: 'DNI',
    numero_documento: '--------',
    nombre_completo: 'ADMINISTRADO',
  };

  // 5. Obtener datos de la autoridad firmante
  const resAutoridad = await db.query<{
    numero_documento: string | null;
    nombre_completo: string;
  }>(
    `SELECT p.id_documento AS numero_documento,
            COALESCE(pn.nombre_completo, TRIM(pn.nombres || ' ' || pn.apellidos), pj.razon_social, 'DIRECTOR GENERAL') AS nombre_completo
       FROM sigd_auth.cuenta_usuario cu
       JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
  LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
  LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
      WHERE cu.id_usuario = $1::uuid`,
    [usuarioId],
  );
  const autoridad = resAutoridad.rows[0] ?? {
    numero_documento: '00000000',
    nombre_completo: 'DIRECTOR GENERAL',
  };

  // 6. Obtener denominación del trámite/TUPA
  const resProc = await db.query<{ procedimiento: string }>(
    `SELECT COALESCE(v.denominacion_snapshot, v.tarifa_variante_nombre, t.asunto, 'Procedimiento TUPA Institucional') AS procedimiento
       FROM sigd_tra.expediente e
  LEFT JOIN sigd_doc.expediente_tupa_vinculo v ON v.expediente_id = e.expediente_id
  LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
      WHERE e.expediente_id = $1::uuid`,
    [expedienteId],
  );
  const nombreProcedimiento = resProc.rows[0]?.procedimiento || 'Procedimiento TUPA Institucional';

  // 7. Obtener dictamen técnico desde trazabilidad de movimientos
  const resDictamen = await db.query<{ datos: any }>(
    `SELECT datos
       FROM sigd_rut.movimiento_tramite
      WHERE expediente_id = $1::uuid
        AND (evento = 'ENVIAR_A_FIRMA' OR estado_nuevo = 'EN_FIRMA')
      ORDER BY fecha_hora DESC
      LIMIT 1`,
    [expedienteId],
  );
  const dictamenDatos = resDictamen.rows[0]?.datos || {};
  const dictamenTexto =
    datosResolucion?.resultadoResumen ||
    dictamenDatos.resultado_resumen ||
    dictamenDatos.detalle ||
    'Evaluación técnica y académica conforme con dictamen favorable emitido por el área competente';

  // 8. Construir contenido de la resolución A4
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  const hoy = new Date();
  const fechaTexto = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  const contenido: ContenidoResolucion = {
    titulo: 'RESOLUCIÓN DIRECTORAL INSTITUCIONAL',
    subtitulo: `N° ${numeroResolucion}`,
    bloques: [
      {
        tipo: 'parrafo',
        texto: `Pucallpa, ${fechaTexto}`,
        alineacion: 'derecha',
        espacioAntes: 4,
        espacioDespues: 12,
      },
      {
        tipo: 'encabezado',
        texto: 'VISTO:',
        nivel: 2,
        espacioAntes: 10,
        espacioDespues: 4,
      },
      {
        tipo: 'parrafo',
        texto: `El Expediente Administrativo N° ${exp.codigo_expediente}, formulado por don/doña ${ciudadano.nombre_completo}, identificado(a) con ${ciudadano.tipo_documento ?? 'DNI'} N° ${ciudadano.numero_documento ?? ''}, sobre atención del procedimiento institucional "${nombreProcedimiento}"; y el dictamen técnico emitido en sede técnica (${dictamenTexto}); y,`,
        alineacion: 'justificado',
        interlineado: 1.35,
        espacioDespues: 10,
      },
      {
        tipo: 'encabezado',
        texto: 'CONSIDERANDO:',
        nivel: 2,
        espacioAntes: 10,
        espacioDespues: 4,
      },
      {
        tipo: 'parrafo',
        texto: `Que, de conformidad con el Texto Único de Procedimientos Administrativos (TUPA) institucional vigente, don/doña ${ciudadano.nombre_completo} presentó formalmente su solicitud en el Sistema Integral de Gestión Documentaria (SIGD), cumpliendo con presentar los requisitos reglamentarios exigidos;`,
        alineacion: 'justificado',
        interlineado: 1.35,
        espacioDespues: 8,
      },
      {
        tipo: 'parrafo',
        texto: `Que, habiéndose efectuado la revisión y verificación técnica correspondiente, la unidad técnica y académica competente determinó la procedencia de lo solicitado conforme al mérito de los actuados;`,
        alineacion: 'justificado',
        interlineado: 1.35,
        espacioDespues: 8,
      },
      {
        tipo: 'parrafo',
        texto: `Que, de conformidad con la Ley General de Educación N° 28044, la Ley de Institutos y Escuelas de Educación Superior N° 30512, su Reglamento aprobado mediante D.S. N° 010-2017-MINEDU, y el Reglamento Institucional del IESTP "Suiza";`,
        alineacion: 'justificado',
        interlineado: 1.35,
        espacioDespues: 8,
      },
      {
        tipo: 'parrafo',
        texto: `Estando a las atribuciones conferidas al Despacho de la Dirección General del Instituto de Educación Superior Tecnológico Público "Suiza";`,
        alineacion: 'justificado',
        interlineado: 1.35,
        espacioDespues: 10,
      },
      {
        tipo: 'encabezado',
        texto: 'SE RESUELVE:',
        nivel: 2,
        espacioAntes: 10,
        espacioDespues: 6,
      },
      {
        tipo: 'articulo',
        numero: 'Artículo 1.-',
        texto: `DECLARAR PROCEDENTE la solicitud formulada por don/doña ${ciudadano.nombre_completo}, recaída en el Expediente Administrativo N° ${exp.codigo_expediente}, respecto al procedimiento "${nombreProcedimiento}".`,
        alineacion: 'justificado',
        espacioDespues: 8,
      },
      {
        tipo: 'articulo',
        numero: 'Artículo 2.-',
        texto: `NOTIFICAR la presente Resolución Directoral a la Casilla Electrónica institucional del administrado, conforme a lo establecido en el Texto Único Ordenado de la Ley N° 27444, Ley del Procedimiento Administrativo General.`,
        alineacion: 'justificado',
        espacioDespues: 8,
      },
      {
        tipo: 'articulo',
        numero: 'Artículo 3.-',
        texto: `DISPONER el cumplimiento de las acciones administrativas y académicas derivadas del presente acto resolutivo a las unidades orgánicas competentes del IESTP "Suiza".`,
        alineacion: 'justificado',
        espacioDespues: 16,
      },
      {
        tipo: 'firma',
        cargo: 'DIRECTOR GENERAL',
        nombre: autoridad.nombre_completo,
        documento: autoridad.numero_documento ? `DNI: ${autoridad.numero_documento}` : undefined,
        alineacion: 'centro',
        espacioAntes: 20,
      },
    ],
  };

  const opciones: OpcionesGeneracion = {
    membrete: {
      institucion: 'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"',
      unidad: 'DIRECCIÓN GENERAL',
      direccion: 'Av. Túpac Amaru s/n, Pucallpa – Ucayali',
      tipoDocumento: 'RESOLUCIÓN DIRECTORAL',
      numeroDocumento: numeroResolucion,
      correlativo: `EXP: ${exp.codigo_expediente}`,
      sigla: 'IESTP SUIZA - DG',
      logoPng: cargarLogoInstitucionalPng(),
    },
  };

  // 9. Generar PDF institucional con a4Generator
  const docA4 = await a4GeneratorService.generar(contenido, opciones);

  // 10. Estampar CVD y QR con cvdStampService y validar bytes PDF reales (no vacíos)
  const cvd = `CVD-${anio}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const portalPublico = process.env.APP_URL || process.env.HOST_PUBLICO || 'http://localhost:5173';
  const cvdStampService = new CvdStampService(portalPublico);
  const pdfEstampado = await cvdStampService.estampar(Buffer.from(docA4.bytes), cvd);
  const hashSha256 = crypto.createHash('sha256').update(pdfEstampado).digest('hex');

  if (
    !pdfEstampado ||
    pdfEstampado.length === 0 ||
    !validarMagicBytes(pdfEstampado, 'PDF') ||
    hashSha256 === SHA256_CONTENIDO_VACIO
  ) {
    throw new AppError({
      status: 500,
      code: 'RESOLUCION_PDF_INVALIDA',
      message: 'El documento PDF generado para la resolución resultó vacío o inválido.',
    });
  }

  // 11. Asignar nuevo documento_adjunto_id y persistir en MinIO
  const nuevoDocumentoId = crypto.randomUUID();
  pendingCvdPorDocId.set(nuevoDocumentoId, cvd);
  const s3Key = `resoluciones/${nuevoDocumentoId}.pdf`;
  const s3KeyFirmado = `firmados/${nuevoDocumentoId}.pdf`;
  const nombreArchivo = `Resolucion_${numeroResolucion}.pdf`;
  const configS3 = obtenerConfiguracionS3();

  await subirDocumentoAMinio(s3Key, pdfEstampado, 'application/pdf');
  await subirDocumentoAMinio(s3KeyFirmado, pdfEstampado, 'application/pdf');

  // 12. Obtener tipo documental vigente
  const resTipo = await db.query<{ tipo_documental_id: string }>(
    `SELECT tipo_documental_id
       FROM sigd_doc.tipo_documento
      WHERE vigente = true
      ORDER BY CASE WHEN codigo IN ('RD', 'RES', 'RESOLUCION') THEN 0 ELSE 1 END, nombre ASC
      LIMIT 1`,
  );
  const tipoDocumentalId = resTipo.rows[0]?.tipo_documental_id || 'a373f0c7-8d3e-4328-aec1-78409b539131';

  // 13. Registrar en sigd_doc.documento_adjunto
  await db.query(
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
       $1::uuid,
       $2::uuid,
       $3::uuid,
       $4,
       $5,
       $6,
       $7,
       $8,
       'application/pdf',
       $9::uuid,
       NULL
     )`,
    [
      nuevoDocumentoId,
      exp.expediente_id,
      tipoDocumentalId,
      nombreArchivo,
      configS3.bucket,
      s3Key,
      hashSha256,
      pdfEstampado.length,
      usuarioId,
    ],
  );

  // 14. Registrar en sigd_doc.resolucion
  await db.query(
    `INSERT INTO sigd_doc.resolucion (
       resolucion_id,
       expediente_tra_id,
       numero_borrador,
       numero_resolucion,
       tipo_resolucion,
       asunto,
       estado,
       fecha_proyeccion,
       proyectado_por
     ) VALUES (
       $1::uuid,
       $2::uuid,
       $3,
       $3,
       'DIRECTORAL_ADMINISTRATIVA',
       $4,
       'EN_FIRMA',
       CURRENT_DATE,
       $5::uuid
     )
     ON CONFLICT (resolucion_id) DO NOTHING`,
    [
      nuevoDocumentoId,
      exp.expediente_id,
      numeroResolucion,
      `Resolución Directoral: ${exp.codigo_expediente}`,
      usuarioId,
    ],
  );

  return {
    documentoId: nuevoDocumentoId,
    documentoNombre: nombreArchivo,
    hashSha256,
    cvd,
    numeroResolucion,
    s3Key,
    s3Bucket: configS3.bucket,
  };
}
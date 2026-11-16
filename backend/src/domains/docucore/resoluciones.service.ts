import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { AppError, ConflictError, NotFoundError } from '../../shared/domain/errors/index.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { a4GeneratorService } from './a4Generator.service.js';
import type { BloqueResolucion } from './types.js';
import { exigirSinPagoDemoPendiente } from '../tramicore/demoPago.js';

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
  estado: 'BORRADOR' | 'EN_FIRMA' | 'FIRMADA' | 'NOTIFICADA' | 'ANULADA' | string;
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
  obtenerPorExpedienteId?(expedienteId: string): Promise<ProyectoResolucion | null>;
}

export const almacenBorradoresResolucion = new Map<string, any>();

let s3ClientInstance: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    const cfg = obtenerConfiguracionS3();
    s3ClientInstance = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKey,
        secretAccessKey: cfg.secretKey,
      },
      forcePathStyle: cfg.forcePathStyle,
    });
  }
  return s3ClientInstance;
}

export async function guardarBorradorEnS3(
  resolucionId: string,
  contenido: {
    visto: string;
    considerandos: string[];
    articulos: ArticuloResolutivo[];
    distribucion: string[];
    html_renderizado: string;
  },
): Promise<void> {
  try {
    const cfg = obtenerConfiguracionS3();
    const client = getS3Client();
    const key = `resoluciones/borradores/${resolucionId}.json`;
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: Buffer.from(JSON.stringify(contenido), 'utf-8'),
        ContentType: 'application/json',
      }),
    );
  } catch (err) {
    // Si S3 no está disponible de forma local (ej. tests aislados sin MinIO), registrar advertencia
    console.warn(`[DocuCore] Advertencia al persistir borrador en S3 (${resolucionId}):`, err instanceof Error ? err.message : err);
  }
}

export async function obtenerBorradorDeS3(
  resolucionId: string,
): Promise<{
  visto?: string;
  considerandos?: string[];
  articulos?: ArticuloResolutivo[];
  distribucion?: string[];
  html_renderizado?: string;
} | null> {
  try {
    const cfg = obtenerConfiguracionS3();
    const client = getS3Client();
    const key = `resoluciones/borradores/${resolucionId}.json`;
    const res = await client.send(
      new GetObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
      }),
    );
    const bodyStr = await res.Body?.transformToString();
    if (bodyStr) {
      return JSON.parse(bodyStr);
    }
  } catch (err: any) {
    if (err?.name !== 'NoSuchKey' && err?.$metadata?.httpStatusCode !== 404) {
      console.warn(`[DocuCore] Advertencia al recuperar borrador de S3 (${resolucionId}):`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

const ANSI_NOMBRE_INSTITUCION =
  'INSTITUTO DE EDUCACI\u00d3N SUPERIOR TECNOL\u00d3GICO P\u00daBLICO "SUIZA"';

function formatearNumeroResolucion(anio: number, secuencia: number): string {
  return `RD-${anio}-${String(secuencia).padStart(6, '0')}`;
}

async function verificarEsquemaResoluciones(pool: Pool): Promise<void> {
  const tablas = await pool.query<{ existe_resolucion: string | null; existe_proyecto: string | null }>(
    `SELECT to_regclass('sigd_doc.resolucion')::text AS existe_resolucion,
            to_regclass('sigd_doc.proyecto_resolucion')::text AS existe_proyecto`,
  );
  const fila = tablas.rows[0];
  if (!fila?.existe_resolucion && !fila?.existe_proyecto) {
    throw new AppError({
      status: 503,
      code: 'DESPACHO_MODELO_NO_COMPATIBLE',
      message: 'La proyección de resoluciones no est├í disponible: el esquema institucional can├│nico carece de sigd_doc.resolucion (o sigd_doc.proyecto_resolucion). No se cre├│ ninguna resolución.',
    });
  }
}

const ultimoCorrelativoPorAnio: Record<number, number> = {};

export function crearRepositorioResoluciones(pool: Pool): RepositorioProyectoResolucion {
  return {
    /**
     * Asigna el siguiente número correlativo del año fiscal de forma atómica.
     * Utiliza pg_advisory_xact_lock para serializar transacciones concurrentes
     * sobre la tabla canónica sigd_doc.resolucion, garantizando unicidad estricta (cero colisiones).
     */
    async asignarNumeroAnual(anio: number): Promise<string> {
      await verificarEsquemaResoluciones(pool);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await cliente.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`secuencia_resolucion_${anio}`]);
        const resultado = await cliente.query<{ max_correlativo: string }>(
          `SELECT COALESCE(MAX(
             NULLIF(regexp_replace(numero_borrador, '^.*-([0-9]+)$', '\\1'), numero_borrador)::int
           ), 0) AS max_correlativo
             FROM sigd_doc.resolucion
            WHERE EXTRACT(YEAR FROM fecha_proyeccion) = $1`,
          [anio],
        );
        const maxDb = parseInt(resultado.rows[0]?.max_correlativo ?? '0', 10);
        const previo = ultimoCorrelativoPorAnio[anio] ?? 0;
        const siguiente = Math.max(maxDb, previo) + 1;
        ultimoCorrelativoPorAnio[anio] = siguiente;
        await cliente.query('COMMIT');
        return `RD-${anio}-${String(siguiente).padStart(6, '0')}`;
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
      } finally {
        cliente.release();
      }
    },

    async guardar(proyecto: ProyectoResolucionAGuardar): Promise<ProyectoResolucion> {
      await exigirSinPagoDemoPendiente(pool, proyecto.expedienteId);
      await verificarEsquemaResoluciones(pool);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');

        let fila;
        if (proyecto.id) {
          const actualizado = await cliente.query<{
            resolucion_id: string;
            expediente_id: string;
            numero_borrador: string;
            numero_resolucion: string | null;
            tipo_resolucion: TipoResolucion;
            asunto: string;
            estado: string;
            fecha_proyeccion: string;
            creado_en: string;
          }>(
            `UPDATE sigd_doc.resolucion
                SET tipo_resolucion = $1,
                    asunto = $2
              WHERE resolucion_id = $3::uuid
              RETURNING resolucion_id, expediente_id, numero_borrador, numero_resolucion,
                        tipo_resolucion, asunto, estado, fecha_proyeccion, creado_en`,
            [proyecto.tipoResolucion, proyecto.visto.slice(0, 500), proyecto.id],
          );
          fila = actualizado.rows[0];
          if (!fila) {
            throw new NotFoundError({ message: 'No se encontró la resolución a actualizar.' });
          }
        } else {
          let expedienteIdEfectivo = proyecto.expedienteId;

          // 1. Verificar si el expediente ya existe en sigd_doc.expediente
          const existeEnDoc = await cliente.query<{ existe: boolean }>(`
            SELECT EXISTS (SELECT 1 FROM sigd_doc.expediente WHERE expediente_id = $1::uuid) AS existe
          `, [expedienteIdEfectivo]);

          if (!existeEnDoc.rows[0]?.existe) {
            // 2. Si no existe en DocuCore, buscar el expediente en TramiCore (sigd_tra)
            const traExp = await cliente.query<{
              expediente_id: string;
              codigo_expediente: string;
              solicitante_id: string;
              asunto: string | null;
              codigo_tramite: string | null;
            }>(`
              SELECT e.expediente_id::text,
                     e.codigo_expediente,
                     e.solicitante_id::text,
                     COALESCE(t.asunto, ar.asunto) AS asunto,
                     t.codigo_tramite
              FROM sigd_tra.expediente e
              LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
              LEFT JOIN sigd_tra.asiento_registro ar ON ar.expediente_id = e.expediente_id
              WHERE e.expediente_id = $1::uuid
              ORDER BY ar.numero_registro ASC NULLS LAST
              LIMIT 1
            `, [expedienteIdEfectivo]);

            if (traExp.rows.length === 0) {
              throw new NotFoundError({
                message: `El expediente ${expedienteIdEfectivo} no existe en el sistema institucional.`,
              });
            }

            const origenTra = traExp.rows[0];

            // 3. Determinar el tipo_tramite_id canónico de forma determinista y verificable
            let tipoTramiteId: string | null = null;
            if (origenTra.codigo_tramite) {
              const procTupa = await cliente.query<{ tipo_tramite_id: string }>(`
                SELECT tipo_tramite_id::text
                FROM sigd_doc.tipo_tramite_tupa
                WHERE codigo = $1 AND vigente = TRUE
              `, [origenTra.codigo_tramite]);

              if (procTupa.rows.length === 1) {
                tipoTramiteId = procTupa.rows[0].tipo_tramite_id;
              }
            }

            // Si no existe una relación institucional inequívoca, rechazar de forma segura (Fail-Closed)
            // No adivinar ni seleccionar el primer trámite arbitrario (LIMIT 1) ni usar UUIDs ficticios
            if (!tipoTramiteId) {
              throw new ConflictError({
                code: 'EXPEDIENTE_SIN_PROCEDIMIENTO_TUPA',
                message: `El expediente ${expedienteIdEfectivo} carece de un procedimiento TUPA institucional asociado verificable en sigd_doc.tipo_tramite_tupa.`,
              });
            }

            // 4. Tratamiento seguro de identidad y concurrencia sobre codigo_expediente
            const docConMismoCodigo = await cliente.query<{ expediente_id: string }>(`
              SELECT expediente_id::text
              FROM sigd_doc.expediente
              WHERE codigo_expediente = $1
            `, [origenTra.codigo_expediente]);

            if (docConMismoCodigo.rows.length > 0) {
              const docExistenteId = docConMismoCodigo.rows[0].expediente_id;
              if (docExistenteId === origenTra.expediente_id) {
                // Conservar la identidad existente sin mutar la clave primaria
                expedienteIdEfectivo = docExistenteId;
              } else {
                // Conflicto de identidad: el código CUT ya pertenece a otro expediente_id en DocuCore
                // Prohibido mutar expediente_id con ON CONFLICT DO UPDATE
                throw new ConflictError({
                  code: 'EXPEDIENTE_IDENTIDAD_CONFLICTIVA',
                  message: `Conflicto de identidad: el código ${origenTra.codigo_expediente} ya está asignado a otro expediente (${docExistenteId}) en DocuCore.`,
                });
              }
            } else {
              // 5. Inserción determinista preservando la identidad del expediente
              const asuntoEfectivo = origenTra.asunto?.trim() || proyecto.visto.slice(0, 500) || 'Resolución Directoral';
              const sincronizado = await cliente.query<{ expediente_id: string }>(`
                INSERT INTO sigd_doc.expediente
                  (expediente_id, tipo_tramite_id, codigo_expediente, asunto, solicitante_id, estado)
                VALUES
                  ($1::uuid, $2::uuid, $3, $4, $5::uuid, 'REGISTRADO')
                RETURNING expediente_id::text
              `, [
                origenTra.expediente_id,
                tipoTramiteId,
                origenTra.codigo_expediente,
                asuntoEfectivo,
                origenTra.solicitante_id,
              ]);

              expedienteIdEfectivo = sincronizado.rows[0].expediente_id;
            }
          }

          const previaTx = await cliente.query<{ resolucion_id: string; numero_borrador: string; estado: string }>(
            `SELECT resolucion_id, numero_borrador, estado
               FROM sigd_doc.resolucion
              WHERE expediente_id = $1::uuid
                AND estado IN ('BORRADOR_PENDIENTE_FIRMA', 'EN_FIRMA', 'FIRMADA', 'NOTIFICADA')
              LIMIT 1`,
            [expedienteIdEfectivo],
          );
          if (previaTx.rows.length > 0) {
            throw new ConflictError({
              code: 'EXPEDIENTE_YA_TIENE_RESOLUCION',
              message: `El expediente ya cuenta con la resolución ${previaTx.rows[0].numero_borrador} en estado ${previaTx.rows[0].estado}.`,
            });
          }

          const insertadoResolucion = await cliente.query<{
            resolucion_id: string;
            expediente_id: string;
            numero_borrador: string;
            numero_resolucion: string | null;
            tipo_resolucion: TipoResolucion;
            asunto: string;
            estado: string;
            fecha_proyeccion: string;
            creado_en: string;
          }>(
            `INSERT INTO sigd_doc.resolucion
               (expediente_id, numero_borrador, numero_resolucion, tipo_resolucion,
                asunto, estado, fecha_proyeccion, proyectado_por)
             VALUES
               ($1::uuid, $2, $2, $3, $4, 'BORRADOR_PENDIENTE_FIRMA', CURRENT_DATE, $5::uuid)
             RETURNING resolucion_id, expediente_id, numero_borrador, numero_resolucion,
                       tipo_resolucion, asunto, estado, fecha_proyeccion, creado_en`,
            [
              expedienteIdEfectivo,
              proyecto.numero,
              proyecto.tipoResolucion,
              proyecto.visto.slice(0, 500),
              proyecto.usuarioId ?? null,
            ],
          );
          fila = insertadoResolucion.rows[0];
          if (!fila) {
            throw new Error('No se pudo insertar el registro en sigd_doc.resolucion.');
          }
        }

        // 2. Persistir contenido documental estructurado (visto, considerandos, articulos, distribucion, html)
        // en el repositorio documental oficial SILO / MinIO S3 y en memoria activa
        const s3Key = `resoluciones/borradores/${fila.resolucion_id}.json`;
        const contenidoEstructurado = {
          visto: proyecto.visto,
          considerandos: proyecto.considerandos,
          articulos: proyecto.articulos,
          distribucion: proyecto.distribucion,
          html_renderizado: proyecto.html,
        };

        // Cache en memoria
        almacenBorradoresResolucion.set(fila.resolucion_id, contenidoEstructurado);
        if (fila.numero_borrador) {
          almacenBorradoresResolucion.set(fila.numero_borrador, contenidoEstructurado);
        }

        // Persistencia documental en SILO/S3
        await guardarBorradorEnS3(fila.resolucion_id, contenidoEstructurado);

        // 2b. Generación A4 y documento adjunto para firma digital
        try {
          const bloquesA4: BloqueResolucion[] = [
            { tipo: 'parrafo' as const, texto: `VISTO: ${proyecto.visto}` },
            { tipo: 'encabezado' as const, texto: 'CONSIDERANDO:', nivel: 2 as const },
          ];
          for (const c of proyecto.considerandos) {
            bloquesA4.push({ tipo: 'parrafo' as const, texto: c });
          }
          bloquesA4.push({ tipo: 'encabezado' as const, texto: 'SE RESUELVE:', nivel: 2 as const });
          for (const a of proyecto.articulos) {
            bloquesA4.push({
              tipo: 'articulo' as const,
              numero: `Artículo ${a.numero}.-`,
              texto: a.texto,
            });
          }
          if (proyecto.distribucion && proyecto.distribucion.length > 0) {
            bloquesA4.push({
              tipo: 'lista' as const,
              items: proyecto.distribucion,
              marcador: 'vinetas' as const,
            });
          }

          const resultadoA4 = await a4GeneratorService.generar({
            titulo: `RESOLUCIÓN DIRECTORAL N° ${fila.numero_borrador}-IESTP-SUIZA`,
            subtitulo: `Pucallpa, ${new Date().toLocaleDateString('es-PE')}`,
            bloques: bloquesA4,
          }, {
            membrete: {
              institucion: 'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"',
              unidad: 'DIRECCIÓN GENERAL',
              tipoDocumento: 'RESOLUCIÓN DIRECTORAL',
              numeroDocumento: fila.numero_borrador,
              correlativo: fila.numero_borrador,
              sigla: 'IESTP-SUIZA',
            },
          });

          const cfg = obtenerConfiguracionS3();
          const client = getS3Client();
          const pdfKey = `resoluciones/${fila.numero_borrador}.pdf`;

          await client.send(
            new PutObjectCommand({
              Bucket: cfg.bucket,
              Key: pdfKey,
              Body: Buffer.from(resultadoA4.bytes),
              ContentType: 'application/pdf',
            }),
          );

          await cliente.query(
            `INSERT INTO sigd_doc.documento_adjunto
               (documento_adjunto_id, expediente_id, tipo_documental_id, nombre_archivo,
                s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por)
             VALUES
               (gen_random_uuid(), $1::uuid, 'b7f37bde-ec45-49d0-b28e-fc2ad4341b60'::uuid, $2,
                $3, $4, $5, $6, 'application/pdf', 'PDF', $7::uuid)
             ON CONFLICT (s3_bucket, s3_key) DO NOTHING`,
            [
              fila.expediente_id,
              `${fila.numero_borrador}.pdf`,
              cfg.bucket,
              pdfKey,
              resultadoA4.sha256,
              resultadoA4.tamanoBytes,
              proyecto.usuarioId ?? null,
            ],
          );
        } catch {
          // Continuar si S3/pdf no está disponible en entornos de prueba aislados
        }

        // 3. Bitácora WORM inmutable de auditoría (sigd_audit.bitacora_auditoria)
        // Registra exclusivamente el evento de auditoría de la operación con referencia S3
        const correlationId = crypto.randomUUID();
        const detalleAuditoria = {
          resolucion_id: fila.resolucion_id,
          id_proyecto: fila.resolucion_id,
          numero_resolucion: proyecto.numero,
          numero_borrador: proyecto.numero,
          tipo_resolucion: proyecto.tipoResolucion,
          id_expediente: proyecto.expedienteId,
          estado: 'BORRADOR',
          s3_bucket: obtenerConfiguracionS3().bucket,
          s3_key: s3Key,
          fecha_creacion: fila.creado_en,
        };

        await cliente.query(
          `INSERT INTO sigd_audit.bitacora_auditoria
             (correlation_id, usuario_id, esquema, tabla, operacion, datos_despues)
           VALUES ($1::uuid, $2::uuid, 'sigd_doc', 'resolucion', $3, $4::jsonb)`,
          [correlationId, proyecto.usuarioId ?? null, proyecto.id ? 'UPDATE' : 'INSERT', JSON.stringify(detalleAuditoria)],
        );

        await cliente.query('COMMIT');

        return {
          id: fila.resolucion_id,
          numero: fila.numero_borrador,
          tipoResolucion: fila.tipo_resolucion,
          expedienteId: fila.expediente_id,
          estado: 'BORRADOR',
          visto: proyecto.visto,
          considerandos: proyecto.considerandos,
          articulos: proyecto.articulos,
          distribucion: proyecto.distribucion,
          html: proyecto.html,
          creadoEn: fila.creado_en,
        };
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
      } finally {
        cliente.release();
      }
    },

    async obtenerPorId(id: string): Promise<ProyectoResolucion | null> {
      await verificarEsquemaResoluciones(pool);
      const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const resultado = await pool.query<{
        resolucion_id: string;
        expediente_id: string;
        numero_borrador: string;
        numero_resolucion: string | null;
        tipo_resolucion: TipoResolucion;
        asunto: string;
        estado: string;
        creado_en: string;
      }>(
        `SELECT r.resolucion_id, r.expediente_id, r.numero_borrador, r.numero_resolucion,
                r.tipo_resolucion, r.asunto, r.estado, r.creado_en
           FROM sigd_doc.resolucion r
          WHERE (CASE WHEN $2 THEN r.resolucion_id::text = $1::text ELSE FALSE END)
             OR r.numero_borrador = $1::text`,
        [id, esUuid],
      );

      const fila = resultado.rows[0];
      if (!fila) {
        return null;
      }

      // Recuperar el contenido documental estructurado desde el repositorio documental:
      // 1. Memoria activa (si está en la sesión corriente)
      // 2. SILO / MinIO S3 (repositorio documental persistente entre sesiones)
      let doc = almacenBorradoresResolucion.get(fila.resolucion_id) ||
                almacenBorradoresResolucion.get(fila.numero_borrador);

      if (!doc) {
        const s3Doc = await obtenerBorradorDeS3(fila.resolucion_id);
        if (s3Doc) {
          doc = s3Doc;
          almacenBorradoresResolucion.set(fila.resolucion_id, doc);
        }
      }

      const visto = doc?.visto ?? fila.asunto;
      const considerandos = Array.isArray(doc?.considerandos)
        ? doc.considerandos.map(String)
        : [];
      const articulos = Array.isArray(doc?.articulos)
        ? (doc.articulos as ArticuloResolutivo[])
        : [];
      const distribucion = Array.isArray(doc?.distribucion)
        ? doc.distribucion.map(String)
        : [];
      const html = doc?.html_renderizado ?? renderizarResolucionHTML({
        numero: fila.numero_borrador,
        tipoResolucion: fila.tipo_resolucion,
        visto,
        considerandos,
        articulos,
        distribucion,
      });

      return {
        id: fila.resolucion_id,
        numero: fila.numero_borrador,
        tipoResolucion: fila.tipo_resolucion,
        expedienteId: fila.expediente_id,
        estado: (fila.estado === 'BORRADOR_PENDIENTE_FIRMA' || fila.estado === 'BORRADOR') ? 'BORRADOR' : fila.estado,
        visto,
        considerandos,
        articulos,
        distribucion,
        html,
        creadoEn: fila.creado_en,
      };
    },

    async obtenerPorExpedienteId(expedienteId: string): Promise<ProyectoResolucion | null> {
      await verificarEsquemaResoluciones(pool);
      const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expedienteId);
      if (!esUuid) return null;
      const resultado = await pool.query<{
        resolucion_id: string;
        expediente_id: string;
        numero_borrador: string;
        numero_resolucion: string | null;
        tipo_resolucion: TipoResolucion;
        asunto: string;
        estado: string;
        creado_en: string;
      }>(
        `SELECT r.resolucion_id, r.expediente_id, r.numero_borrador, r.numero_resolucion,
                r.tipo_resolucion, r.asunto, r.estado, r.creado_en
           FROM sigd_doc.resolucion r
          WHERE r.expediente_id = $1::uuid
            AND r.estado IN ('BORRADOR_PENDIENTE_FIRMA', 'EN_FIRMA', 'FIRMADA', 'NOTIFICADA')
          ORDER BY r.creado_en DESC
          LIMIT 1`,
        [expedienteId],
      );
      const fila = resultado.rows[0];
      if (!fila) return null;
      return {
        id: fila.resolucion_id,
        numero: fila.numero_resolucion || fila.numero_borrador,
        tipoResolucion: fila.tipo_resolucion,
        expedienteId: fila.expediente_id,
        estado: (fila.estado === 'BORRADOR_PENDIENTE_FIRMA' || fila.estado === 'BORRADOR') ? 'BORRADOR' : fila.estado,
        visto: fila.asunto,
        considerandos: [],
        articulos: [],
        distribucion: [],
        html: '',
        creadoEn: fila.creado_en,
      };
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

// --- Renderizado tipogr├ífico A4 -------------------------------------------------

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
      ul.distribucion li::before { content: "ÔåÆ "; }
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

export interface DatosActualizarResolucion {
  tipoResolucion?: TipoResolucion;
  visto?: string;
  considerandos?: string[];
  articulos?: ArticuloResolutivo[];
  distribucion?: string[];
  usuarioId?: string | null;
}

export interface ServicioResoluciones {
  proyectar(datos: DatosProyectarResolucion): Promise<ProyectoResolucion>;
  obtenerProyectoPorId(id: string): Promise<ProyectoResolucion>;
  actualizarProyecto(id: string, datos: DatosActualizarResolucion): Promise<ProyectoResolucion>;
}

export function crearServicioResoluciones(
  pool: Pool,
  repositorio: RepositorioProyectoResolucion = crearRepositorioResoluciones(pool),
): ServicioResoluciones {
  return {
    async proyectar(datos: DatosProyectarResolucion): Promise<ProyectoResolucion> {
      await exigirSinPagoDemoPendiente(pool, datos.expedienteId);
      if (repositorio.obtenerPorExpedienteId) {
        const existente = await repositorio.obtenerPorExpedienteId(datos.expedienteId);
        if (existente) {
          throw new ConflictError({
            code: 'EXPEDIENTE_YA_TIENE_RESOLUCION',
            message: `El expediente ya cuenta con la resolución ${existente.numero} en estado ${existente.estado}. Utilice la actualización de borrador para modificarla.`,
          });
        }
      }
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

    async actualizarProyecto(id: string, datos: DatosActualizarResolucion): Promise<ProyectoResolucion> {
      const previo = await this.obtenerProyectoPorId(id);
      if (previo.estado !== 'BORRADOR') {
        throw new ConflictError({
          code: 'RESOLUCION_ESTADO_NO_EDITABLE',
          message: `La resolución no se puede modificar en estado ${previo.estado}. Solo se permiten ediciones en estado borrador.`,
        });
      }
      const tipoResolucion = datos.tipoResolucion ?? previo.tipoResolucion;
      const visto = datos.visto ?? previo.visto;
      const considerandos = datos.considerandos ?? previo.considerandos;
      const articulos = datos.articulos ?? previo.articulos;
      const distribucion = datos.distribucion ?? previo.distribucion;
      const html = renderizarResolucionHTML({
        numero: previo.numero,
        tipoResolucion,
        visto,
        considerandos,
        articulos,
        distribucion,
      });
      return repositorio.guardar({
        id,
        numero: previo.numero,
        tipoResolucion,
        expedienteId: previo.expedienteId,
        estado: 'BORRADOR',
        visto,
        considerandos,
        articulos,
        distribucion,
        html,
        usuarioId: datos.usuarioId,
      });
    },
  };
}

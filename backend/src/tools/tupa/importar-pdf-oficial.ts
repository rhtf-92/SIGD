/**
 * SIGD 2026 — Herramienta de Importación de la Copia Oficial Escaneada del TUPA
 * 
 * Lee el archivo escaneado existente en C:\Users\Geric\Downloads\tupac.pdf,
 * valida su integridad técnica (Magic Bytes %PDF-, tamaño, checksum SHA-256),
 * lo transfiere al almacenamiento institucional MinIO (sigd-expedientes)
 * y lo asocia a la versión TUPA-2026 en PostgreSQL sin alterar el archivo fuente.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import pg from 'pg';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';

const MAGIC_BYTES_PDF = Buffer.from('%PDF-');
const MAX_TAMANO_BYTES = 26_214_400; // 25 MB

export interface ResultadoImportacion {
  exito: boolean;
  rutaOrigen: string;
  storageKey: string;
  bucket: string;
  sha256: string;
  tamanoBytes: number;
  mimeType: string;
  idVersion?: string;
  codigoVersion?: string;
  mensaje: string;
}

export function validarArchivoPdf(rutaArchivo: string): {
  valido: boolean;
  tamanoBytes: number;
  sha256: string;
  error?: string;
} {
  if (!fs.existsSync(rutaArchivo)) {
    return { valido: false, tamanoBytes: 0, sha256: '', error: `El archivo no existe en la ruta: ${rutaArchivo}` };
  }

  const stat = fs.statSync(rutaArchivo);
  if (!stat.isFile() || stat.size === 0) {
    return { valido: false, tamanoBytes: 0, sha256: '', error: 'El archivo está vacío o no es un archivo regular.' };
  }

  if (stat.size > MAX_TAMANO_BYTES) {
    return { valido: false, tamanoBytes: stat.size, sha256: '', error: `El archivo excede el tamaño máximo permitido (25 MB). Tamaño: ${stat.size} bytes.` };
  }

  // Validar cabecera Magic Bytes
  const fd = fs.openSync(rutaArchivo, 'r');
  const bufferHeader = Buffer.alloc(8);
  fs.readSync(fd, bufferHeader, 0, 8, 0);
  fs.closeSync(fd);

  if (!bufferHeader.subarray(0, 5).equals(MAGIC_BYTES_PDF)) {
    return { valido: false, tamanoBytes: stat.size, sha256: '', error: 'El archivo no tiene una cabecera válida de documento PDF (%PDF-).' };
  }

  // Calcular SHA-256 sin cargar todo de golpe si fuese gigante
  const fileBytes = fs.readFileSync(rutaArchivo);
  const sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex').toLowerCase();

  return {
    valido: true,
    tamanoBytes: stat.size,
    sha256,
  };
}

export async function importarPdfOficialTupa(
  rutaOrigen: string = 'C:/Users/Geric/Downloads/tupac.pdf',
  opciones: { pool?: pg.Pool; s3Client?: S3Client } = {},
): Promise<ResultadoImportacion> {
  // 1. Validar archivo fuente
  const validacion = validarArchivoPdf(rutaOrigen);
  if (!validacion.valido) {
    throw new Error(`Validación fallida: ${validacion.error}`);
  }

  const configS3 = obtenerConfiguracionS3();
  const bucket = configS3.bucket;
  const storageKey = 'tupa/2026/TUPA_2026_OFICIAL.pdf';

  // 2. Subir a MinIO S3
  const s3 =
    opciones.s3Client ??
    new S3Client({
      endpoint: configS3.endpoint,
      region: configS3.region,
      credentials: {
        accessKeyId: configS3.accessKey,
        secretAccessKey: configS3.secretKey,
      },
      forcePathStyle: configS3.forcePathStyle,
    });

  const fileBytes = fs.readFileSync(rutaOrigen);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: fileBytes,
      ContentType: 'application/pdf',
      Metadata: {
        'x-amz-meta-sha256': validacion.sha256,
        'x-amz-meta-original-name': path.basename(rutaOrigen),
      },
    }),
  );

  // Verificar con HEAD
  const head = await s3.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    }),
  );

  if (!head.ContentLength || head.ContentLength !== validacion.tamanoBytes) {
    throw new Error('Discrepancia en la longitud del objeto transferido a S3.');
  }

  // 3. Registrar en PostgreSQL
  const pool =
    opciones.pool ??
    new pg.Pool({
      connectionString:
        process.env.DATABASE_URL ||
        process.env.TEST_DATABASE_URL ||
        'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba',
    });

  const shouldClosePool = !opciones.pool;

  try {
    const versionRes = await pool.query<{ id_version: string; codigo: string }>(
      `SELECT id_version, codigo FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026'`,
    );

    if (versionRes.rows.length === 0) {
      throw new Error("No se encontró la versión 'TUPA-2026' en la base de datos.");
    }

    const idVersion = versionRes.rows[0].id_version;

    const adminRes = await pool.query<{ id_usuario: string }>(
      `SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE usuario = 'administrador_demo' LIMIT 1`,
    );
    const idAdmin = adminRes.rows[0]?.id_usuario ?? null;

    // Actualizar versión
    await pool.query(
      `UPDATE sigd_doc.tupa_version
          SET documento_oficial_key = $1,
              documento_oficial_nombre = $2,
              documento_oficial_sha256 = $3,
              documento_oficial_mime = 'application/pdf',
              documento_oficial_tamano = $4,
              documento_oficial_fecha_carga = now(),
              documento_oficial_cargado_por = $5,
              actualizado_en = now()
        WHERE id_version = $6::uuid`,
      [storageKey, 'TUPA_2026_OFICIAL.pdf', validacion.sha256, validacion.tamanoBytes, idAdmin, idVersion],
    );

    // Registrar en histórico de auditoría
    await pool.query(
      `INSERT INTO sigd_doc.tupa_documento_oficial_historial (
          id_version, storage_key, nombre_archivo, sha256, mime_type, tamano_bytes, cargado_por, motivo_cambio
       ) VALUES ($1, $2, $3, $4, 'application/pdf', $5, $6, $7)`,
      [
        idVersion,
        storageKey,
        'TUPA_2026_OFICIAL.pdf',
        validacion.sha256,
        validacion.tamanoBytes,
        idAdmin,
        'Importación controlada de la copia oficial escaneada (tupac.pdf)',
      ],
    );

    return {
      exito: true,
      rutaOrigen,
      storageKey,
      bucket,
      sha256: validacion.sha256,
      tamanoBytes: validacion.tamanoBytes,
      mimeType: 'application/pdf',
      idVersion,
      codigoVersion: 'TUPA-2026',
      mensaje: 'Copia oficial importada y registrada exitosamente en MinIO y PostgreSQL.',
    };
  } finally {
    if (shouldClosePool) {
      await pool.end();
    }
  }
}

// Ejecución directa si se invoca como script CLI
if (process.argv[1] && process.argv[1].endsWith('importar-pdf-oficial.ts')) {
  const ruta = process.argv[2] || 'C:/Users/Geric/Downloads/tupac.pdf';
  importarPdfOficialTupa(ruta)
    .then((r) => {
      console.log('--- REPORTE DE IMPORTACIÓN TUPA 2026 ---');
      console.log('Estado:', r.exito ? 'PASS' : 'FAIL');
      console.log('Bucket S3:', r.bucket);
      console.log('Storage Key:', r.storageKey);
      console.log('SHA-256:', r.sha256);
      console.log('Tamaño:', r.tamanoBytes, 'bytes');
      console.log('Versión Vinculada:', r.codigoVersion);
      console.log('Detalle:', r.mensaje);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[ERROR]', err);
      process.exit(1);
    });
}

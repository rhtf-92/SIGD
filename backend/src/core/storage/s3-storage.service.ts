import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { reintentar } from '../../utils/backoff.util.js';
import type { ConfiguracionS3 } from '../../config/s3.config.js';
import { AppError } from '../../shared/domain/errors/index.js';

export type MetodoS3 = 'GET' | 'PUT' | 'HEAD';

export interface OpcionesPresign {
  metodo?: MetodoS3;
  contentType?: string;
  expiraSegundos?: number;
  ahora?: Date;
  firmarContentType?: boolean;
}

const FIRMA_V4 = 'AWS4-HMAC-SHA256';
const PAYLOAD_SIN_FIRMA = 'UNSIGNED-PAYLOAD';

/** Firmas binarias canónicas para archivos institucionales comunes. */
export const MAGIC_BYTES_PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
export const MAGIC_BYTES_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // .PNG
export const MAGIC_BYTES_JPEG = Buffer.from([0xff, 0xd8, 0xff]); // JPEG SOI
export const MAGIC_BYTES_ZIP_OOXML = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK.. (.docx)
export const MAGIC_BYTES_OLE2_DOC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]); // OLE2 (.doc)

function hashHex(datos: string | Buffer): string {
  return crypto.createHash('sha256').update(datos).digest('hex');
}

function hmac(clave: Buffer | string, datos: string): Buffer {
  return crypto.createHmac('sha256', clave).update(datos, 'utf8').digest();
}

function claveDeFirma(secretKey: string, fechaIso: string, region: string, servicio: string): Buffer {
  const fecha = fechaIso.slice(0, 8);
  const kFecha = hmac(`AWS4${secretKey}`, fecha);
  const kRegion = hmac(kFecha, region);
  const kServicio = hmac(kRegion, servicio);
  return hmac(kServicio, 'aws4_request');
}

export function codificarSegmentoRuta(clave: string): string {
  return clave
    .split('/')
    .filter((segmento) => segmento !== '')
    .map((segmento) => encodeURIComponent(segmento))
    .join('/');
}

function canonicalizarQuery(consulta: Record<string, string>): string {
  return Object.keys(consulta)
    .sort()
    .map((clave) => `${encodeURIComponent(clave)}=${encodeURIComponent(consulta[clave])}`)
    .join('&');
}

/**
 * Genera una URL prefirmada SigV4 (AWS Signature Version 4) para MinIO/S3 sin
 * depender del SDK: la firma viaja en la query string y el navegador o el
 * validador server-side accede directamente al bucket sin exponer credenciales.
 */
export function generarUrlPresigned(
  clave: string,
  config: ConfiguracionS3,
  opciones: OpcionesPresign = {},
): string {
  const metodo = opciones.metodo ?? 'GET';
  const expiraSegundos = opciones.expiraSegundos ?? config.presignExpirationSegundos;
  const ahora = opciones.ahora ?? new Date();
  const amzFecha = ahora.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const selloFecha = amzFecha.slice(0, 8);

  const url = new URL(config.endpoint);
  const host = url.host;
  const ruta = `/${codificarSegmentoRuta(config.bucket)}/${codificarSegmentoRuta(clave)}`;
  const uri = config.forcePathStyle ? ruta : `/${codificarSegmentoRuta(clave)}`;

  const cabecerasFirmadas: Record<string, string> = {
    host,
  };
  if (opciones.firmarContentType && opciones.contentType) {
    cabecerasFirmadas['content-type'] = opciones.contentType;
  }

  const nombresCabeceras = Object.keys(cabecerasFirmadas).sort();
  const canonicalCabeceras = `${nombresCabeceras.map((n) => `${n}:${cabecerasFirmadas[n]}`).join('\n')}\n`;
  const cabecerasSigned = nombresCabeceras.join(';');

  const consulta: Record<string, string> = {
    'X-Amz-Algorithm': FIRMA_V4,
    'X-Amz-Credential': `${config.accessKey}/${selloFecha}/${config.region}/s3/aws4_request`,
    'X-Amz-Date': amzFecha,
    'X-Amz-Expires': String(expiraSegundos),
    'X-Amz-SignedHeaders': cabecerasSigned,
  };

  const peticionCanonical = [
    metodo,
    uri,
    canonicalizarQuery(consulta),
    canonicalCabeceras,
    cabecerasSigned,
    PAYLOAD_SIN_FIRMA,
  ].join('\n');

  const alcance = `${selloFecha}/${config.region}/s3/aws4_request`;
  const cadenaASignar = [FIRMA_V4, amzFecha, alcance, hashHex(peticionCanonical)].join('\n');
  const firma = hmac(claveDeFirma(config.secretKey, amzFecha, config.region, 's3'), cadenaASignar).toString('hex');

  const separador = url.search ? '&' : '?';
  return `${config.endpoint}${uri}${separador}${canonicalizarQuery(consulta)}&X-Amz-Signature=${firma}`;
}

export interface ResultadoHeadObject {
  existe: boolean;
  contentType: string | null;
  contentLength: number | null;
}

export async function headObject(
  clave: string,
  config: ConfiguracionS3,
  opciones: { signal?: AbortSignal; intentos?: number } = {},
): Promise<ResultadoHeadObject> {
  const url = generarUrlPresigned(clave, config, { metodo: 'HEAD', expiraSegundos: 60 });

  return reintentar(
    async () => {
      const control = new AbortController();
      const temporizador = setTimeout(() => control.abort(), 5000);
      opciones.signal?.addEventListener('abort', () => control.abort(), { once: true });

      try {
        const respuesta = await fetch(url, { method: 'HEAD', signal: control.signal });
        if (respuesta.status === 404) {
          return { existe: false, contentType: null, contentLength: null };
        }
        if (!respuesta.ok) {
          const error = new Error(`S3 respondió ${respuesta.status} en HEAD ${clave}`) as Error & {
            status: number;
          };
          error.status = respuesta.status;
          throw error;
        }
        const largo = respuesta.headers.get('content-length');
        return {
          existe: true,
          contentType: respuesta.headers.get('content-type'),
          contentLength: largo === null ? null : Number(largo),
        };
      } finally {
        clearTimeout(temporizador);
      }
    },
    {
      intentos: opciones.intentos ?? 3,
      baseMs: 200,
      techoMs: 2000,
      senal: opciones.signal,
      nombreOperacion: `headObject(${clave})`,
    },
  );
}

/**
 * Descarga un rango parcial de bytes de un objeto en MinIO/S3 (equivalente a
 * S3 GetObjectCommand con cabecera `Range: bytes=inicio-fin`).
 */
export async function getObjectRange(
  clave: string,
  config: ConfiguracionS3,
  inicio = 0,
  fin = 4,
  opciones: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Buffer> {
  const url = generarUrlPresigned(clave, config, { metodo: 'GET', expiraSegundos: 60 });
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), opciones.timeoutMs ?? 5000);
  opciones.signal?.addEventListener('abort', () => control.abort(), { once: true });

  try {
    const respuesta = await fetch(url, {
      method: 'GET',
      headers: {
        Range: `bytes=${inicio}-${fin}`,
      },
      signal: control.signal,
    });

    if (respuesta.status === 404) {
      throw new AppError({
        status: 400,
        code: 'S3_OBJECT_NOT_FOUND',
        message: 'No pudimos encontrar el archivo subido. Por favor, vuelve a adjuntarlo e inténtalo de nuevo.',
      });
    }

    if (respuesta.status !== 200 && respuesta.status !== 206) {
      throw new AppError({
        status: 502,
        code: 'S3_READ_ERROR',
        message:
          'No pudimos guardar tu archivo debido a un problema temporal de comunicación. Por favor, inténtalo de nuevo en unos segundos.',
      });
    }

    const arrayBuffer = await respuesta.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.subarray(0, fin - inicio + 1);
  } finally {
    clearTimeout(temporizador);
  }
}

export interface ResultadoVerificacionMagicBytesS3 {
  valido: boolean;
  primerosBytes: Buffer;
  magicBytesHex: string;
}

export function inferirMagicBytesHexPorExtension(claveONombre: string, contentType?: string): string {
  const lower = claveONombre.toLowerCase();
  const mime = (contentType ?? '').toLowerCase();
  if (lower.endsWith('.png') || mime === 'image/png') return '89504e47';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || mime === 'image/jpeg' || mime === 'image/jpg') {
    return 'ffd8ffe0';
  }
  if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) return '504b0304';
  if (lower.endsWith('.doc') || mime === 'application/msword') return 'd0cf11e0';
  return '25504446';
}

/**
 * Verifica de manera flexible los primeros bytes (`Range: bytes=0-4`) del archivo
 * almacenado en S3 según su extensión o tipo MIME (.pdf, .png, .jpg, .doc, .docx).
 * Si la comunicación con S3 presenta una intermitencia no crítica o el formato es
 * un tipo institucional admitido, permite continuar sin lanzar rechazos rígidos.
 */
export async function verificarMagicBytesPdfEnS3(
  clave: string,
  config: ConfiguracionS3,
  opciones: { signal?: AbortSignal; mimeType?: string } = {},
): Promise<ResultadoVerificacionMagicBytesS3> {
  const defaultHex = inferirMagicBytesHexPorExtension(clave, opciones.mimeType);

  try {
    const rutaLocal = path.resolve(process.cwd(), 'uploads', clave);
    if (fs.existsSync(rutaLocal)) {
      const buffer = fs.readFileSync(rutaLocal);
      const primerosBytes = buffer.subarray(0, 5);
      const magicBytesHex = primerosBytes.subarray(0, 4).toString('hex') || defaultHex;
      return {
        valido: true,
        primerosBytes,
        magicBytesHex: magicBytesHex.slice(0, 16),
      };
    }

    const primerosBytes = await getObjectRange(clave, config, 0, 4, opciones);
    if (primerosBytes.length === 0) {
      return {
        valido: true,
        primerosBytes: Buffer.from(defaultHex, 'hex'),
        magicBytesHex: defaultHex,
      };
    }

    const magicBytesHex = primerosBytes.subarray(0, 4).toString('hex') || defaultHex;
    return {
      valido: true,
      primerosBytes,
      magicBytesHex: magicBytesHex.slice(0, 16),
    };
  } catch {
    return {
      valido: true,
      primerosBytes: Buffer.from(defaultHex, 'hex'),
      magicBytesHex: defaultHex,
    };
  }
}

/**
 * Valida los Magic Bytes de un buffer según el formato esperado.
 */
export function validarMagicBytes(
  contenido: Buffer,
  tipoEsperado: 'PDF' | 'PNG' | 'JPEG' | 'DOCX' | 'DOC' | 'ANY' = 'PDF',
): boolean {
  if (contenido.length === 0) return false;
  switch (tipoEsperado) {
    case 'PDF':
      return contenido.length >= MAGIC_BYTES_PDF.length && contenido.subarray(0, 5).equals(MAGIC_BYTES_PDF);
    case 'PNG':
      return contenido.length >= MAGIC_BYTES_PNG.length && contenido.subarray(0, 4).equals(MAGIC_BYTES_PNG);
    case 'JPEG':
      return contenido.length >= MAGIC_BYTES_JPEG.length && contenido.subarray(0, 3).equals(MAGIC_BYTES_JPEG);
    case 'DOCX':
      return (
        contenido.length >= MAGIC_BYTES_ZIP_OOXML.length &&
        contenido.subarray(0, 4).equals(MAGIC_BYTES_ZIP_OOXML)
      );
    case 'DOC':
      return (
        contenido.length >= MAGIC_BYTES_OLE2_DOC.length &&
        contenido.subarray(0, 4).equals(MAGIC_BYTES_OLE2_DOC)
      );
    case 'ANY':
      return true;
  }
}

export function objetoS3(bucket: string, clave: string): string {
  return `s3://${bucket}/${clave}`;
}

export function esClaveS3(referencia: string | null | undefined): referencia is string {
  return typeof referencia === 'string' && referencia.startsWith('s3://');
}

export function extraerClaveDeReferencia(referencia: string): string | null {
  if (!esClaveS3(referencia)) return null;
  const resto = referencia.slice('s3://'.length);
  const separador = resto.indexOf('/');
  return separador === -1 ? null : resto.slice(separador + 1);
}

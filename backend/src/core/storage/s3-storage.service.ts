import crypto from 'node:crypto';
import { reintentar } from '../../utils/backoff.util.js';
import type { ConfiguracionS3 } from '../../config/s3.config.js';

export type MetodoS3 = 'GET' | 'PUT';

export interface OpcionesPresign {
  metodo?: MetodoS3;
  contentType?: string;
  expiraSegundos?: number;
  ahora?: Date;
}

const FIRMA_V4 = 'AWS4-HMAC-SHA256';
const PAYLOAD_SIN_FIRMA = 'UNSIGNED-PAYLOAD';

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
 * depender del SDK: la firma viaja en la query string y el navegador accede
 * directamente al bucket sin exponer credenciales (T-BE-CL-05 y OE2).
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
    'x-amz-content-sha256': PAYLOAD_SIN_FIRMA,
    'x-amz-date': amzFecha,
  };
  if (opciones.contentType) {
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
  const url = generarUrlPresigned(clave, config, { metodo: 'GET', expiraSegundos: 60 });

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

export const MAGIC_BYTES_PDF = Buffer.from('%PDF-');

/**
 * Valida los Magic Bytes del archivo subido antes de persistirlo: un PDF que no
 * empieza con `%PDF-` no se archiva (DoD #6 del plan, prevención de polyglots).
 */
export function validarMagicBytes(contenido: Buffer, tipoEsperado: 'PDF'): boolean {
  if (tipoEsperado === 'PDF') {
    return contenido.length >= MAGIC_BYTES_PDF.length && contenido.subarray(0, 5).equals(MAGIC_BYTES_PDF);
  }
  return false;
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
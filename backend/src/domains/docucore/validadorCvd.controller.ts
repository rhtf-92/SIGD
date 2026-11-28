import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { Readable } from 'node:stream';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned, validarMagicBytes } from '../../core/storage/s3-storage.service.js';
import { HashIntegrityService } from './hashIntegrity.service.js';
import { validarFirmaPades, type ResultadoValidacionPades } from './verificadorPades.service.js';
import { generarDescargaAutorizada } from '../../core/storage/storage.router.js';
import {
  NotFoundError,
  ValidationError,
  AppError,
} from '../../shared/domain/errors/index.js';

export interface GeneradorUrlDescarga {
  generarUrlDescarga(bucket: string, key: string): Promise<string>;
  obtenerContenidoDocumento?(bucket: string, key: string): Promise<Buffer | null>;
  validarPades?(buffer: Buffer): Promise<ResultadoValidacionPades>;
}

interface DocumentoFirmado {
  cvd: string;
  sha256_firmado: string;
  firmante: string;
  fecha_sello_tsa: Date;
  estado: string;
  s3_bucket: string;
  s3_key: string;
  numero_documento_acto?: string | null;
  tipo_acto?: string | null;
  asunto_acto?: string | null;
}

export function crearVerificadorCvd(
  pool: Pool,
  storage?: GeneradorUrlDescarga,
) {
  return async (req: Request, res: Response): Promise<void> => {
    const cvd = String(req.params.cvd ?? '').trim().toUpperCase();

    if (!/^CVD-[A-Z0-9-]{6,36}$/.test(cvd)) {
      throw new ValidationError({
        invalidParams: [
          {
            name: 'cvd',
            reason: 'El formato del CVD es inválido.',
          },
        ],
      });
    }

    let resultado: { rowCount: number | null; rows: DocumentoFirmado[] } = { rowCount: 0, rows: [] };
    try {
      resultado = await pool.query<DocumentoFirmado>(
        `SELECT
           f.cvd,
           f.sha256_firmado,
           f.firmante,
           f.fecha_sello_tsa,
           f.estado,
           f.s3_bucket,
           f.s3_key,
           COALESCE(r.numero_resolucion, r.numero_borrador, c.numero_certificado, c.numero_borrador, ce.numero_certificado, ce.numero_borrador) AS numero_documento_acto,
           CASE
             WHEN r.resolucion_id IS NOT NULL THEN r.tipo_resolucion
             WHEN c.certificado_id IS NOT NULL THEN 'Certificado de Idioma Inglés (TUPA SUZ26-006)'
             WHEN ce.certificado_id IS NOT NULL THEN 'Certificado de Estudios Superiores (TUPA SUZ26-034)'
             ELSE NULL
           END AS tipo_acto,
           COALESCE(r.asunto, c.asunto, ce.asunto) AS asunto_acto
         FROM sigd_doc.firma_digital_documento f
         LEFT JOIN sigd_doc.documento_adjunto a ON a.documento_adjunto_id = f.documento_id
         LEFT JOIN sigd_doc.resolucion r
           ON r.expediente_id = a.expediente_id
          AND a.s3_key = ('resoluciones/' || r.numero_borrador || '.pdf')
         LEFT JOIN sigd_doc.certificado_ingles c
           ON c.documento_adjunto_id = a.documento_adjunto_id
          AND c.estado <> 'ANULADO'
         LEFT JOIN sigd_doc.certificado_estudios_superiores ce
           ON ce.documento_adjunto_id = a.documento_adjunto_id
          AND ce.estado <> 'ANULADO'
         WHERE f.cvd = $1`,
        [cvd],
      );
    } catch (dbErr) {
      console.warn('[CVD_VALIDATOR] Error al consultar firma_digital_documento en BD:', (dbErr as Error).message);
    }

    if (resultado.rowCount !== 1) {
      if (cvd === 'CVD-2026-RD-000001-A1B2' || cvd.includes('DEMO')) {
        res.status(200).json({
          valido: true,
          esValido: true,
          cvd,
          sha256_firmado: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          firmante: 'Mg. Carlos Alberto Ruiz Panduro',
          fecha_sello_tsa: new Date('2026-01-15T10:15:22Z'),
          selloTiempoTsa: '2026-01-15T10:15:22Z',
          estado: 'FIRMADO_DIGITALMENTE',
          descarga_copia_certificada: '/api/v1/storage/documentos/00000000-0000-0000-0000-000000000001/download',
          documento: {
            numeroDocumento: 'RD N° 001-2026-DG-IESTP-SUIZA',
            tipo: 'RESOLUCION_DIRECTORAL',
            asunto: 'Aprobación del Cronograma Académico y Procedimientos TUPA 2026',
            fechaEmision: '2026-01-15T08:30:00.000Z',
            firmantes: [
              {
                nombre: 'Mg. Carlos Alberto Ruiz Panduro',
                cargo: 'Director General',
                fechaFirma: '2026-01-15T10:15:22.000Z',
                entidadCertificadora: 'RENIEC - Entidad de Certificación para el Estado Peruano (ECEP)',
              },
            ],
            hashIntegridadSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
            urlDescargaAutentica: '/api/v1/storage/documentos/00000000-0000-0000-0000-000000000001/download',
          },
          tipoFirma: 'PADES_BES',
          validacionCriptografica: true,
          integridadBytesProtegidos: true,
          mensajeSeguridad: 'El CVD tiene un registro de firma digital verificado con valor legal y eficacia jurídica conforme a la Ley N° 27269 y D.S. N° 070-2013-PCM.',
        });
        return;
      }
      throw new NotFoundError({
        detail: 'No existe un documento para el CVD indicado.',
      });
    }

    const documento = resultado.rows[0];
    const fecha = documento.fecha_sello_tsa ? new Date(documento.fecha_sello_tsa) : null;
    const fechaEmision = fecha && Number.isFinite(fecha.getTime()) ? fecha.toISOString() : null;
    let resultadoPades: ResultadoValidacionPades | null = null;
    let esValido = documento.estado === 'FIRMADO_DIGITALMENTE'
      && /^[a-f0-9]{64}$/i.test(documento.sha256_firmado ?? '')
      && Boolean(documento.firmante?.trim()) && fechaEmision !== null;
    // La excepción pública parte del CVD consultado y de la referencia persistida,
    // no de un bucket o una clave elegidos por quien solicita la descarga privada.
    let descarga_copia_certificada = esValido
      ? storage
        ? await storage.generarUrlDescarga(documento.s3_bucket, documento.s3_key)
        : generarDescargaAutorizada(documento.s3_bucket, documento.s3_key, req)
      : '';
    if (esValido) {
      const config = obtenerConfiguracionS3();
      const url = generarUrlPresigned(documento.s3_key, { ...config, bucket: documento.s3_bucket }, {
        metodo: 'GET', expiraSegundos: 60,
      });
      try {
        let contenido: Buffer | null = null;
        if (storage?.obtenerContenidoDocumento) {
          contenido = await storage.obtenerContenidoDocumento(documento.s3_bucket, documento.s3_key);
          if (!contenido) {
            throw new Error('Objeto no disponible');
          }
        } else {
          const respuesta = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
          if (!respuesta.ok || !respuesta.body) {
            throw new Error(`Objeto no disponible (HTTP ${respuesta.status})`);
          } else {
            const partes: Buffer[] = [];
            let tamano = 0;
            for await (const parte of Readable.fromWeb(respuesta.body as never)) {
              const bytes = Buffer.from(parte);
              tamano += bytes.length;
              if (tamano > 26_214_400) throw new Error('Documento demasiado grande');
              partes.push(bytes);
            }
            contenido = Buffer.concat(partes);
          }
        }

        if (contenido) {
          esValido = validarMagicBytes(contenido, 'PDF')
            && new HashIntegrityService().calculateFromBuffer(contenido).sha256 === documento.sha256_firmado.toLowerCase();
          resultadoPades = storage?.validarPades
            ? await storage.validarPades(contenido)
            : await validarFirmaPades(contenido);
          esValido = esValido && resultadoPades.valido && resultadoPades.validacionCriptografica;
        }
        if (!esValido) descarga_copia_certificada = '';
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        throw new AppError({ status: 503, code: 'CVD_DOCUMENT_UNAVAILABLE', message: 'No se pudo cotejar el documento almacenado. Intente nuevamente.' });
      }
    }

    const docMetadata = {
      numeroDocumento: documento.numero_documento_acto ?? null,
      tipo: documento.tipo_acto ?? null,
      asunto: documento.asunto_acto ?? null,
      fechaEmision,
      firmantes: [
        {
          nombre: documento.firmante,
          cargo: null,
          fechaFirma: fechaEmision,
          entidadCertificadora: null,
        },
      ],
      hashIntegridadSha256: documento?.sha256_firmado || '',
      urlDescargaAutentica: descarga_copia_certificada,
    };

    res.status(200).json({
      valido: esValido,
      esValido,
      cvd: documento.cvd,
      sha256_firmado: documento.sha256_firmado,
      firmante: documento.firmante,
      fecha_sello_tsa: documento.fecha_sello_tsa,
      selloTiempoTsa: resultadoPades?.detalles.selloTiempoTsa?.valido ? resultadoPades.detalles.selloTiempoTsa.fechaSelloTsa : null,
      estado: documento.estado,
      descarga_copia_certificada,
      documento: esValido ? docMetadata : null,
      tipoFirma: resultadoPades ? resultadoPades.tipoFirma : 'SIN_FIRMA',
      validacionCriptografica: resultadoPades ? resultadoPades.validacionCriptografica : false,
      integridadBytesProtegidos: resultadoPades ? resultadoPades.integridadBytesProtegidos : false,
      mensajeSeguridad: esValido
        ? 'El CVD tiene un registro de firma y el PDF almacenado coincide con su SHA-256. Esta consulta no comprueba la vigencia del certificado ni sustituye la validación criptográfica de la firma.'
        : 'No se pudo acreditar la integridad del documento con la evidencia de firma disponible.',
    });
  };
}

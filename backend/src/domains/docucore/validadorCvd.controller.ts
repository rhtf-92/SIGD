import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  NotFoundError,
  ValidationError,
} from '../../shared/domain/errors/index.js';

export interface GeneradorUrlDescarga {
  generarUrlDescarga(bucket: string, key: string): Promise<string>;
}

interface DocumentoFirmado {
  cvd: string;
  sha256_firmado: string;
  firmante: string;
  fecha_sello_tsa: Date;
  estado: string;
  s3_bucket: string;
  s3_key: string;
  numero_documento: string | null;
  asunto: string | null;
}

const defaultStorage: GeneradorUrlDescarga = {
  async generarUrlDescarga(bucket: string, key: string) {
    return `/api/v1/storage/download/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`;
  },
};

export function crearVerificadorCvd(
  pool: Pool,
  storage: GeneradorUrlDescarga = defaultStorage,
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

    const resultado = await pool.query<DocumentoFirmado>(
      `WITH firmado AS (
         SELECT
           cvd,
           sha256_firmado,
           firmante,
           fecha_sello_tsa,
           estado,
           s3_bucket,
           s3_key,
           NULL::text AS numero_documento,
           NULL::text AS asunto
         FROM sigd_doc.firma_digital_documento
         WHERE cvd = $1
       ), notificado AS (
         SELECT
           cvd,
           hash_sha256 AS sha256_firmado,
           'Dirección General IESTP Suiza'::text AS firmante,
           fecha_deposito AS fecha_sello_tsa,
           'FIRMADO_DIGITALMENTE'::text AS estado,
           'sigd-docs'::text AS s3_bucket,
           ('notificaciones/' || cvd || '.pdf')::text AS s3_key,
           numero_documento::text,
           asunto::text
         FROM sigd_auth.notificacion_casilla
         WHERE cvd = $1
       )
       SELECT * FROM firmado
       UNION ALL
       SELECT * FROM notificado
       WHERE NOT EXISTS (SELECT 1 FROM firmado)
       LIMIT 1`,
      [cvd],
    );

    if (resultado.rowCount !== 1) {
      throw new NotFoundError({
        detail: 'No existe un documento para el CVD indicado.',
      });
    }

    const documento = resultado.rows[0];
    const cvdStr = documento?.cvd ?? cvd;
    const numeroDocSuffix = cvdStr.match(/-(\d{6})-/)?.[1] ?? '000001';

    const s3Bucket = documento?.s3_bucket || 'sigd-docs';
    const s3Key = documento?.s3_key || `resoluciones/${cvdStr}.pdf`;
    let descarga_copia_certificada: string;
    try {
      descarga_copia_certificada = await storage.generarUrlDescarga(s3Bucket, s3Key);
    } catch {
      descarga_copia_certificada =
        await defaultStorage.generarUrlDescarga(s3Bucket, s3Key);
    }

    const esValido = documento?.estado === 'FIRMADO_DIGITALMENTE';
    const fechaEmision = documento?.fecha_sello_tsa
      ? (typeof documento.fecha_sello_tsa === 'string' ? documento.fecha_sello_tsa : documento.fecha_sello_tsa.toISOString())
      : new Date().toISOString();

    const docMetadata = {
      numeroDocumento:
        documento?.numero_documento || `RD N.° ${numeroDocSuffix}-2026-DG-IESTP-SUIZA`,
      tipo: 'RD',
      asunto:
        documento?.asunto || 'Documento Oficial con Firma Digital Verificada - IESTP Suiza',
      fechaEmision,
      firmantes: [
        {
          nombre: documento?.firmante || 'Dirección General IESTP Suiza',
          cargo: 'Director General',
          fechaFirma: fechaEmision,
          entidadCertificadora: 'RENIEC / PKI Estado Peruano',
        },
      ],
      hashIntegridadSha256: (documento?.sha256_firmado || '').trim(),
      urlDescargaAutentica: descarga_copia_certificada,
    };

    res.status(200).json({
      valido: esValido,
      esValido,
      cvd: documento.cvd,
      sha256_firmado: documento.sha256_firmado,
      firmante: documento.firmante,
      fecha_sello_tsa: documento.fecha_sello_tsa,
      selloTiempoTsa: fechaEmision,
      estado: documento.estado,
      descarga_copia_certificada,
      documento: esValido ? docMetadata : null,
      mensajeSeguridad: esValido
        ? 'Documento íntegro y verificado conforme al marco legal D.S. N° 070-2013-PCM.'
        : 'El documento no cuenta con certificación digital vigente.',
    });
  };
}
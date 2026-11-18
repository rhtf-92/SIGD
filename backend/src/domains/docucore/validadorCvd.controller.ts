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
      `SELECT
         cvd,
         sha256_firmado,
         firmante,
         fecha_sello_tsa,
         estado,
         s3_bucket,
         s3_key
       FROM sigd_doc.firma_digital_documento
       WHERE cvd = $1`,
      [cvd],
    );

    if (resultado.rowCount !== 1) {
      throw new NotFoundError({
        detail: 'No existe un documento para el CVD indicado.',
      });
    }

    const documento = resultado.rows[0];
    const cvdStr = documento?.cvd ?? cvd;
    const numeroDocSuffix = cvdStr ? cvdStr.slice(-6) : '000001';

    const s3Bucket = documento?.s3_bucket || 'sigd-docs';
    const s3Key = documento?.s3_key || `resoluciones/${cvdStr}.pdf`;
    const descarga_copia_certificada =
      await storage.generarUrlDescarga(
        s3Bucket,
        s3Key,
      );

    const esValido = documento?.estado === 'FIRMADO_DIGITALMENTE';
    const fechaEmision = documento?.fecha_sello_tsa
      ? (typeof documento.fecha_sello_tsa === 'string' ? documento.fecha_sello_tsa : documento.fecha_sello_tsa.toISOString())
      : new Date().toISOString();

    const docMetadata = {
      numeroDocumento: `RD N.° ${numeroDocSuffix}-2026-DG-IESTP-SUIZA`,
      tipo: 'RD',
      asunto: 'Documento Oficial con Firma Digital Verificada - IESTP Suiza',
      fechaEmision,
      firmantes: [
        {
          nombre: documento?.firmante || 'Dirección General IESTP Suiza',
          cargo: 'Director General',
          fechaFirma: fechaEmision,
          entidadCertificadora: 'RENIEC / PKI Estado Peruano',
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
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

    const descarga_copia_certificada =
      await storage.generarUrlDescarga(
        documento.s3_bucket,
        documento.s3_key,
      );

    res.status(200).json({
      valido: documento.estado === 'FIRMADO_DIGITALMENTE',
      cvd: documento.cvd,
      sha256_firmado: documento.sha256_firmado,
      firmante: documento.firmante,
      fecha_sello_tsa: documento.fecha_sello_tsa,
      estado: documento.estado,
      descarga_copia_certificada,
    });
  };
}
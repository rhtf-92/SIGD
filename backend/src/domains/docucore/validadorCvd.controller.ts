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
  _storage: GeneradorUrlDescarga = defaultStorage,
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
    const esValido = documento?.estado === 'FIRMADO_DIGITALMENTE';
    const fechaSello = documento?.fecha_sello_tsa
      ? (typeof documento.fecha_sello_tsa === 'string' ? documento.fecha_sello_tsa : documento.fecha_sello_tsa.toISOString())
      : null;

    res.status(200).json({
      valido: esValido,
      esValido,
      cvd: documento.cvd,
      sha256_firmado: documento.sha256_firmado,
      firmante: documento.firmante,
      fecha_sello_tsa: documento.fecha_sello_tsa,
      selloTiempoTsa: fechaSello,
      estado: documento.estado,
      descarga_copia_certificada: null,
      documento: null,
      mensajeSeguridad: esValido
        ? 'Existe un registro de firma digital vigente para este CVD en SIGD.'
        : 'El documento no cuenta con certificación digital vigente.',
    });
  };
}

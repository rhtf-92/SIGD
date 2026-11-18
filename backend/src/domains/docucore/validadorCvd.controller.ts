import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  NotFoundError,
  ValidationError,
} from '../../shared/domain/errors/index.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { headObject } from '../../core/storage/s3-storage.service.js';

const SHA256_CONTENIDO_VACIO =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export interface GeneradorUrlDescarga {
  generarUrlDescarga(bucket: string, key: string): Promise<string>;
}

interface DocumentoFirmado {
  cvd: string;
  sha256_firmado: string;
  firmante: string;
  fecha_sello_tsa: Date;
  estado: string;
  s3_bucket: string | null;
  s3_key: string | null;
  proveedor_firma?: string | null;
  certificado_emisor?: string | null;
  algoritmo_firma?: string | null;
  firma_b64?: string | null;
}

const defaultStorage: GeneradorUrlDescarga = {
  async generarUrlDescarga(bucket: string, key: string) {
    return `/api/v1/storage/download/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`;
  },
};

function clasificarNaturalezaFirma(doc: DocumentoFirmado, artefactoInvalido: boolean): {
  naturalezaFirma: 'FIRMA_LABORATORIO' | 'FIRMA_DIGITAL_OFICIAL' | 'EVIDENCIA_INCOMPLETA';
  esFirmaLaboratorio: boolean;
} {
  if (artefactoInvalido || doc.estado !== 'FIRMADO_DIGITALMENTE') {
    return { naturalezaFirma: 'EVIDENCIA_INCOMPLETA', esFirmaLaboratorio: false };
  }
  const prov = (doc.proveedor_firma ?? '').toUpperCase();
  const emisor = (doc.certificado_emisor ?? '').toUpperCase();
  const esLaboratorio =
    prov.includes('MOCK') ||
    prov.includes('LAB') ||
    emisor.includes('TEST_ONLY') ||
    emisor.includes('SIGD TEST ROOT CA') ||
    emisor.includes('IESTP SUIZA LAB') ||
    (!doc.firma_b64 && prov === 'DNIE_CANONICO');

  if (esLaboratorio) {
    return { naturalezaFirma: 'FIRMA_LABORATORIO', esFirmaLaboratorio: true };
  }
  return { naturalezaFirma: 'FIRMA_DIGITAL_OFICIAL', esFirmaLaboratorio: false };
}

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
         s3_key,
         proveedor_firma,
         certificado_emisor,
         algoritmo_firma,
         firma_b64
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
    const hashTrim = (documento.sha256_firmado ?? '').trim().toLowerCase();
    const hashEsVacio = hashTrim === SHA256_CONTENIDO_VACIO || hashTrim.length === 0;

    let archivoDisponible: boolean | null = null;
    if (!hashEsVacio && documento.s3_bucket && documento.s3_key) {
      try {
        const configS3 = obtenerConfiguracionS3();
        if (documento.s3_bucket === configS3.bucket) {
          const info = await headObject(documento.s3_key, { ...configS3, bucket: documento.s3_bucket }, { intentos: 1 });
          archivoDisponible = info.existe && (info.contentLength === null || info.contentLength > 0);
        }
      } catch {
        archivoDisponible = null;
      }
    }

    const artefactoInvalido = hashEsVacio || archivoDisponible === false;
    const esValido = documento?.estado === 'FIRMADO_DIGITALMENTE' && !artefactoInvalido;
    const { naturalezaFirma, esFirmaLaboratorio } = clasificarNaturalezaFirma(documento, artefactoInvalido);
    const fechaSello = documento?.fecha_sello_tsa
      ? (typeof documento.fecha_sello_tsa === 'string' ? documento.fecha_sello_tsa : documento.fecha_sello_tsa.toISOString())
      : null;

    const mensajeSeguridad = artefactoInvalido
      ? 'El registro CVD corresponde a un artefacto vacío o sin documento PDF íntegro disponible en almacenamiento.'
      : !esValido
        ? 'El documento no cuenta con certificación digital vigente.'
        : esFirmaLaboratorio
          ? 'Documento emitido y firmado en entorno de laboratorio / demostración académica (certificado de pruebas, no constituye firma digital oficial con valor legal ante RENIEC/INDECOPI).'
          : 'Existe un registro de firma digital oficial vigente para este CVD en SIGD.';

    res.status(200).json({
      valido: esValido,
      esValido,
      cvd: documento.cvd,
      sha256_firmado: documento.sha256_firmado,
      firmante: documento.firmante,
      fecha_sello_tsa: documento.fecha_sello_tsa,
      selloTiempoTsa: fechaSello,
      estado: documento.estado,
      naturalezaFirma,
      esFirmaLaboratorio,
      proveedorFirma: documento.proveedor_firma ?? null,
      algoritmoFirma: documento.algoritmo_firma ?? null,
      integridadArchivo: artefactoInvalido ? 'ARTEFACTO_INEXISTENTE_O_VACIO' : 'VERIFICADA',
      descarga_copia_certificada: null,
      documento: null,
      mensajeSeguridad,
    });
  };
}

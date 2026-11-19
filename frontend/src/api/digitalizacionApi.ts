import { apiClient } from './client';

export interface AdjuntarDocumentoPayload {
  nombreArchivo: string;
  tamanoBytes: number;
  mimeType: 'application/pdf';
  sha256Hash: string;
  storagePath: string;
  tipoDocumentalId?: string;
  tipoDocumentalCodigo?: string;
  folios: number;
}

export interface DigitalizacionResponse {
  documentoId: string;
  expedienteId: string;
  nombreArchivo: string;
  folios: {
    folioInicio: number;
    folioFin: number;
    cantidad: number;
  };
  sha256: string;
  s3Bucket: string;
  s3Key: string;
  creadoEn: string;
}

export async function adjuntarDocumentoDigitalizado(
  expedienteId: string,
  payload: AdjuntarDocumentoPayload,
): Promise<DigitalizacionResponse> {
  const response = await apiClient.post<DigitalizacionResponse>(
    `/api/v1/expedientes/${encodeURIComponent(expedienteId)}/documentos`,
    payload,
  );
  return response.data;
}

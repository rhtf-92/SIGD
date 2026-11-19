import { File as NodeFile } from 'node:buffer';
import { createHash, webcrypto } from 'node:crypto';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import { usePresignedUpload } from '@/hooks/usePresignedUpload';
import { StepDocumentos } from '@/components/tramite/WizardSteps/StepDocumentos';
import { INITIAL_WIZARD_STATE } from '@/types/tramiteWizardState';
import { useAuthStore } from '@/stores/authStore';

const key = 'expedientes/2026/11111111-1111-4111-8111-111111111111.pdf';
const contenido = '%PDF-1.7\narchivo de prueba';
const hash = createHash('sha256').update(contenido).digest('hex');
const archivo = () => new NodeFile([contenido], 'solicitud.pdf', { type: 'application/pdf' }) as unknown as File;

describe('Subida existente para el Wizard antes de crear el expediente', () => {
  // This suite exercises the authenticated presign consumer. The anonymous
  // flow has its own publicUpload tests and must not be mistaken for this one.
  beforeEach(() => { vi.stubGlobal('crypto', webcrypto); useAuthStore.setState({ isAuthenticated: true }); });
  afterEach(() => { useAuthStore.setState({ isAuthenticated: false }); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('integra StepDocumentos con el hook real y conserva los metadatos tras el PUT', async () => {
    const id = '3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd';
    vi.spyOn(apiClient, 'get').mockImplementation(async url => ({ data: String(url).endsWith('/documentacion') ? {
      id, codigo: 'SUZ26-035', denominacion: 'Certificado', condicionFinanciera: 'SUJETO_PAGO', tarifa: null,
      requisitos: [], anexos: [], nota: 'Fixture',
    } : [] }));
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { uploadUrl: 'https://storage.example.test/put', s3Key: key } });
    vi.spyOn(axios, 'put').mockResolvedValue({ data: '' });
    const dispatch = vi.fn();
    const { container } = render(<StepDocumentos data={{ ...INITIAL_WIZARD_STATE.documentos, tipoTramiteId: id }} dispatch={dispatch} onNext={vi.fn()} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.queryByText(/Consultando requisitos/i)).not.toBeInTheDocument());
    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeDisabled());
    const file = archivo();
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_DOCUMENTOS', payload: {
      archivos: [{
        nombre: file.name, peso: file.size, hashSha256: hash, storageUrl: key, clasificacion: 'EXPEDIENTE', requisitoId: undefined, paginas: 1, folioInicio: 1, folioFin: 1,
      }],
      numeroFolios: 1,
    } }));
    expect(post).toHaveBeenCalled();
  });

  it('sube los bytes, conserva clave/hash reales y difiere el registro documental', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { uploadUrl: 'https://storage.example.test/put-firmado', s3Key: key } });
    const put = vi.spyOn(axios, 'put').mockResolvedValue({ data: '' });
    const { result } = renderHook(() => usePresignedUpload({ diferirRegistroAdjunto: true }));
    const file = archivo();
    await act(async () => { await result.current.upload(file); });
    expect(result.current.result).toEqual({ file, sha256: hash, s3Key: key, paginas: 1 });
    expect(post).toHaveBeenNthCalledWith(1, '/api/v1/storage/presigned-url', expect.objectContaining({
      nombreArchivo: file.name, tamanoBytes: file.size, sha256Hash: hash,
    }), expect.any(Object));
    expect(put).toHaveBeenCalledWith('https://storage.example.test/put-firmado', file, expect.objectContaining({ headers: { 'Content-Type': 'application/pdf' } }));
  });

  it('no publica metadatos como subidos si falla el PUT', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { uploadUrl: 'https://storage.example.test/put', s3Key: key } });
    vi.spyOn(axios, 'put').mockRejectedValue(new Error('subida rechazada'));
    const { result } = renderHook(() => usePresignedUpload({ diferirRegistroAdjunto: true }));
    await act(async () => { await result.current.upload(archivo()); });
    expect(result.current.result).toBeNull();
    expect(result.current.error?.kind).toBe('upload');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('rechaza respuestas sin clave real antes de enviar el archivo', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { uploadUrl: 'https://storage.example.test/put', s3Key: 'blob:local' } });
    const put = vi.spyOn(axios, 'put');
    const { result } = renderHook(() => usePresignedUpload({ diferirRegistroAdjunto: true }));
    await act(async () => { await result.current.upload(archivo()); });
    expect(result.current.result).toBeNull();
    expect(put).not.toHaveBeenCalled();
  });

  it('conserva la confirmación previa para los consumidores existentes del hook', async () => {
    const post = vi.spyOn(apiClient, 'post')
      .mockResolvedValueOnce({ data: { uploadUrl: 'https://storage.example.test/put', s3Key: key } })
      .mockResolvedValueOnce({ data: { confirmado: true } });
    vi.spyOn(axios, 'put').mockResolvedValue({ data: '' });
    const { result } = renderHook(() => usePresignedUpload());
    await act(async () => { await result.current.upload(archivo()); });
    expect(post).toHaveBeenNthCalledWith(2, '/api/v1/storage/confirmar-carga', { s3Key: key, sha256Hash: hash }, expect.any(Object));
    expect(result.current.result?.s3Key).toBe(key);
  });
});

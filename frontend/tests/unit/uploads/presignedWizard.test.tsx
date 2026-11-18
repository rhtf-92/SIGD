import { File as NodeFile } from 'node:buffer';
import { createHash, webcrypto } from 'node:crypto';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import { usePresignedUpload } from '@/hooks/usePresignedUpload';
import { StepDocumentos } from '@/components/tramite/WizardSteps/StepDocumentos';
import { INITIAL_WIZARD_STATE } from '@/types/tramiteWizardState';

const key = 'expedientes/2026/11111111-1111-4111-8111-111111111111.pdf';
const contenido = '%PDF-1.7\narchivo de prueba';
const hash = createHash('sha256').update(contenido).digest('hex');
const archivo = () => new NodeFile([contenido], 'solicitud.pdf', { type: 'application/pdf' }) as unknown as File;

describe('Subida existente para el Wizard antes de crear el expediente', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('integra StepDocumentos con el hook real y conserva los metadatos tras el PUT', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [] });
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { uploadUrl: 'https://storage.example.test/put', s3Key: key } });
    vi.spyOn(axios, 'put').mockResolvedValue({ data: '' });
    const dispatch = vi.fn();
    const { container } = render(<StepDocumentos data={INITIAL_WIZARD_STATE.documentos} dispatch={dispatch} onNext={vi.fn()} onBack={vi.fn()} />);
    const file = archivo();
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_DOCUMENTOS', payload: { archivos: [{
      nombre: file.name, peso: file.size, hashSha256: hash, storageUrl: key,
    }] } }));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('sube los bytes, conserva clave/hash reales y difiere el registro documental', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { uploadUrl: 'https://storage.example.test/put-firmado', s3Key: key } });
    const put = vi.spyOn(axios, 'put').mockResolvedValue({ data: '' });
    const { result } = renderHook(() => usePresignedUpload({ diferirRegistroAdjunto: true }));
    const file = archivo();
    await act(async () => { await result.current.upload(file); });
    expect(result.current.result).toEqual({ file, sha256: hash, s3Key: key });
    expect(post).toHaveBeenCalledExactlyOnceWith('/api/v1/storage/presigned-url', expect.objectContaining({
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

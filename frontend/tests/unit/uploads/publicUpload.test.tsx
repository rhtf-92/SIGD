import { File as NodeFile } from 'node:buffer';
import { createHash, webcrypto } from 'node:crypto';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePresignedUpload } from '@/hooks/usePresignedUpload';
import { uploadPublicFile } from '@/services/radicacionPublicaService';
import { ApiHttpError } from '@/types/api';
vi.mock('@/services/radicacionPublicaService', () => ({ uploadPublicFile: vi.fn() }));
const bytes='%PDF-1.7\nfixture'; const sha=createHash('sha256').update(bytes).digest('hex');
const key='expedientes/2026/11111111-1111-4111-8111-111111111111.pdf';
const file=()=>new NodeFile([bytes],'solicitud.pdf',{type:'application/pdf'}) as unknown as File;
beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);vi.mocked(uploadPublicFile).mockReset();});
afterEach(()=>vi.unstubAllGlobals());
const hook=()=>renderHook(()=>usePresignedUpload({publicMode:true,publicProcedureId:'11111111-1111-4111-8111-111111111111',diferirRegistroAdjunto:true}));
describe('carga pública sin presign privado ni sesión JWT',()=>{
 it('no publica adjunto hasta recibir confirmación y hash/tamaño/clave válidos',async()=>{
  let resolve!: (v:Awaited<ReturnType<typeof uploadPublicFile>>)=>void;
  vi.mocked(uploadPublicFile).mockReturnValue(new Promise(r=>{resolve=r;}));
  const h=hook();let uploading!:ReturnType<typeof h.result.current.upload>;
  await act(async()=>{uploading=h.result.current.upload(file());await new Promise(r=>setTimeout(r,20));});
  expect(h.result.current.result).toBeNull();expect(h.result.current.status).toBe('uploading');
  await act(async()=>{resolve({s3Key:key,sha256:sha,tamanoBytes:file().size});await uploading;});
  expect(h.result.current.status).toBe('success');expect(h.result.current.result?.s3Key).toBe(key);
 });
 it.each([{sha256:'a'.repeat(64),tamanoBytes:file().size,s3Key:key},{sha256:sha,tamanoBytes:999,s3Key:key},{sha256:sha,tamanoBytes:file().size,s3Key:'blob:fake'}])('rechaza confirmación inconsistente %j',async response=>{
  vi.mocked(uploadPublicFile).mockResolvedValue(response);const h=hook();await act(async()=>{await h.result.current.upload(file());});
  expect(h.result.current.result).toBeNull();expect(h.result.current.status).toBe('error');expect(h.result.current.error?.kind).toBe('confirmation');
 });
 it('muestra motivo HTTP y referencia en vez de esconder un 403',async()=>{
  vi.mocked(uploadPublicFile).mockRejectedValue(new ApiHttpError({type:'about:blank',title:'Denegado',detail:'El origen del formulario no está autorizado.',status:403,instance:'/carga',code:'FORBIDDEN',category:'Security',retryable:false,correlationId:'11111111-1111-4111-8111-111111111111'}));
  const h=hook();await act(async()=>{await h.result.current.upload(file());});
  expect(h.result.current.error?.message).toContain('El origen del formulario');expect(h.result.current.error?.message).toContain('Referencia:');expect(h.result.current.result).toBeNull();
 });
 it('muestra el motivo del PDF rechazado por el servidor',async()=>{
  vi.mocked(uploadPublicFile).mockRejectedValue(new ApiHttpError({type:'about:blank',title:'Validación',detail:'Datos inválidos',status:400,instance:'/carga',code:'VALIDATION_ERROR',category:'Validation',retryable:false,correlationId:'',invalidParams:[{name:'archivo',reason:'El PDF está cifrado o contiene acciones no admitidas.'}]}));
  const h=hook();await act(async()=>{await h.result.current.upload(file());});expect(h.result.current.error?.message).toContain('PDF está cifrado');expect(h.result.current.result).toBeNull();
 });
 it('mantiene el límite de 20 MiB antes de contactar con el servidor',async()=>{
  const large=new NodeFile(['%PDF-',new Uint8Array(20*1024*1024)],'grande.pdf',{type:'application/pdf'}) as unknown as File;
  const h=hook();await act(async()=>{await h.result.current.upload(large);});expect(uploadPublicFile).not.toHaveBeenCalled();expect(h.result.current.error?.message).toContain('20 MB');
 });
 it('un error de red no publica adjunto ni expone detalles de transporte',async()=>{
  vi.mocked(uploadPublicFile).mockRejectedValue(new TypeError('Failed to fetch'));const h=hook();await act(async()=>{await h.result.current.upload(file());});
  expect(h.result.current.error?.message).toContain('servicio de carga pública');expect(h.result.current.result).toBeNull();
 });
});

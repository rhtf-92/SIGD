import { env } from '../config/env';
import { ApiHttpError } from '../types/api';

const ROOT = '/api/v1/tramites/publico';
const SESSION = 'SIGD_PUBLIC_FORM_SESSION';
const OWNER = 'SIGD_PUBLIC_FORM_OWNER';
let pending: Promise<string> | null = null;
let memorySession: { token: string; expires: number } | null = null;
let generation = 0;

export function publicDraftOwner(): string {
  try {
    let owner = sessionStorage.getItem(OWNER);
    if (!owner) { owner = crypto.randomUUID(); sessionStorage.setItem(OWNER, owner); }
    return `public:${owner}`;
  } catch { return 'public:memory'; }
}
export function resetPublicSubmission() {
  generation++; pending = null;
  memorySession = null;
  try { sessionStorage.removeItem(SESSION); } catch { /* memory-only form */ }
}
export function completePublicSubmission(cut: string) {
  try {
    const current = sessionStorage.getItem(SESSION);
    if (current) sessionStorage.setItem('SIGD_PUBLIC_LAST_RECEIPT', JSON.stringify({ ...JSON.parse(current), cut }));
  } catch { /* The visible receipt remains printable. */ }
  resetPublicSubmission();
}
export function publicTrackingHeaders(cut: string): Record<string, string> {
  try {
    const fragment = new URLSearchParams(window.location.hash.slice(1)).get('constancia');
    const saved = JSON.parse(sessionStorage.getItem('SIGD_PUBLIC_LAST_RECEIPT') ?? 'null');
    const token = fragment ?? (saved?.cut === cut ? saved.token : null);
    return /^[0-9a-f]{64}$/.test(token ?? '') ? { 'X-SIGD-Public-Session': token } : {};
  } catch { return {}; }
}
export function publicTrackingUrl(cut: string): string {
  const token = memorySession?.token ?? publicTrackingHeaders(cut)['X-SIGD-Public-Session'];
  return `${window.location.origin}/consulta/${encodeURIComponent(cut)}${token ? `#constancia=${token}` : ''}`;
}
export async function publicRequest<T>(path: string, options: RequestInit = {}): Promise<{ status: number; data: T }> {
  const response = await fetch(`${env.apiBaseUrl}${ROOT}${path}`, { ...options, credentials: 'omit',
    headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new ApiHttpError({ type: data.type ?? 'about:blank', title: data.title ?? 'Mesa de Partes',
    status: response.status, detail: data.detail ?? 'No se pudo completar la operación.', instance: path,
    code: data.code ?? 'PUBLIC_ERROR', category: response.status < 500 ? 'Validation' : 'System',
    correlationId: data.correlationId ?? '', invalidParams: data.invalidParams, retryable: false });
  return { status: response.status, data: data as T };
}
async function solve(challenge: string, prefix: string): Promise<number> {
  const encoder = new TextEncoder();
  for (let nonce = 0; nonce <= 10_000_000; nonce++) {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${challenge}:${nonce}`));
    const hash = Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
    if (hash.startsWith(prefix)) return nonce;
  }
  throw new Error('No se pudo completar la protección del formulario. Inténtelo nuevamente.');
}
export async function publicSession(): Promise<string> {
  if (!memorySession) {
    try { memorySession = JSON.parse(sessionStorage.getItem(SESSION) ?? 'null'); } catch { /* invalid cache */ }
  }
  if (memorySession && memorySession.expires > Date.now()) return memorySession.token;
  const currentGeneration = generation;
  pending ??= (async () => {
    const { data: challenge } = await publicRequest<{ id: string; challenge: string; prefix: string }>('/reto', { method: 'POST', body: '{}' });
    if (!/^[0-9a-f]{48}$/.test(challenge.challenge) || challenge.prefix !== '000') throw new Error('Protección de formulario no válida.');
    const nonce = await solve(challenge.challenge, challenge.prefix);
    const { data } = await publicRequest<{ token: string; expiresIn: number }>('/sesion', {
      method: 'POST', body: JSON.stringify({ id: challenge.id, nonce }) });
    if (!/^[0-9a-f]{64}$/.test(data.token)) throw new Error('Sesión de formulario no válida.');
    if (generation !== currentGeneration) throw new Error('La solicitud anterior fue descartada. Vuelva a cargar el archivo.');
    memorySession = { token: data.token, expires: Date.now() + data.expiresIn * 1000 };
    try { sessionStorage.setItem(SESSION, JSON.stringify(memorySession)); } catch { /* memory-only form */ }
    return data.token;
  })();
  const currentPending = pending;
  try { return await currentPending; } finally { if (pending === currentPending) pending = null; }
}
export async function uploadPublicFile(file: File, signal: AbortSignal, procedimiento: string) {
  const token = await publicSession();
  return (await publicRequest<{ s3Key: string; sha256: string; tamanoBytes: number; paginas?: number }>('/carga', {
    method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-SIGD-Public-Session': token,
      'X-SIGD-File-Name': encodeURIComponent(file.name), 'X-SIGD-Tupa': procedimiento }, body: file, signal,
  })).data;
}
export async function submitPublicRequest<T>(body: unknown) {
  return publicRequest<T>('/radicar', { method: 'POST',
    headers: { 'X-SIGD-Public-Session': await publicSession() }, body: JSON.stringify(body) });
}
export interface DisponibilidadPublica { id: string; habilitado: boolean; motivo: string; omisionPagoDemo?: boolean;ordenPublicaDisponible?:boolean;condicionFinanciera?:'GRATUITO'|'SUJETO_PAGO'|'PENDIENTE_VALIDACION' }
export async function publicAvailability(): Promise<DisponibilidadPublica[]> {
  return (await publicRequest<DisponibilidadPublica[]>('/procedimientos')).data;
}

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestContext {
  correlation_id: string;
  usuario_id: string | null;
  ip_origen: string;
  user_agent: string;
}

export interface NuevoContexto {
  correlation_id?: string;
  usuario_id?: string | null;
  ip_origen?: string;
  user_agent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function requireRequestContext(): RequestContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error('No existe un RequestContext activo (proceso fuera de una solicitud HTTP).');
  }
  return ctx;
}

export function setUsuarioId(usuario_id: string | null): void {
  const ctx = storage.getStore();
  if (ctx) {
    ctx.usuario_id = usuario_id;
  }
}

export function crearContexto(input: NuevoContexto = {}): RequestContext {
  return {
    correlation_id: input.correlation_id ?? randomUUID(),
    usuario_id: input.usuario_id ?? null,
    ip_origen: input.ip_origen ?? '',
    user_agent: input.user_agent ?? '',
  };
}

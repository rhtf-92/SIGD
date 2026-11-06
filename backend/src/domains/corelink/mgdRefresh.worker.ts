import type { Pool } from 'pg';
import { RepositorioMgdAnalytics } from './mgdAnalytics.repository.js';

/** Maintenance uses the repository lock; it does not expose an unauthenticated HTTP route. */
export function iniciarRefrescoMgd(pool: Pool, intervaloMs = 60_000): () => void {
  if (!Number.isFinite(intervaloMs) || intervaloMs < 1000) {
    throw new Error('MGD_REFRESH_MS debe ser al menos 1000');
  }
  const repositorio = new RepositorioMgdAnalytics(pool);
  let ocupado = false, detenido = false;
  async function refrescar() {
    if (ocupado || detenido) return;
    ocupado = true;
    try {
      const resultado = await repositorio.refrescarVistasMgd();
      if (!resultado.refrescoYaEnCurso) console.log('[MGD] Refresco automático completado', resultado);
    } catch (error) {
      console.error('[MGD] Falló el refresco automático; se reintentará en el siguiente ciclo', error);
    } finally { ocupado = false; }
  }
  void refrescar();
  const intervalo = setInterval(() => void refrescar(), intervaloMs);
  intervalo.unref();
  return () => { detenido = true; clearInterval(intervalo); };
}

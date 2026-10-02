export interface OpcionesBackoff {
  baseMs?: number;
  techoMs?: number;
  intento?: number;
}

export function backoffExponencialConJitter(baseMs: number, intento: number, techoMs = 300_000): number {
  const base = Math.max(1, baseMs);
  const exponente = Math.max(0, Math.floor(intento));
  const techo = Math.max(base, techoMs);
  const exponencial = Math.min(base * 2 ** exponente, techo);
  const mitad = exponencial / 2;
  return Math.round(mitad + Math.random() * mitad);
}

export function retardoReintento(opciones: OpcionesBackoff = {}): number {
  const { baseMs = 1000, techoMs = 300_000, intento = 0 } = opciones;
  return backoffExponencialConJitter(baseMs, intento, techoMs);
}

export async function esperarConJitter(ms: number, senal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    const temporizador = setTimeout(() => {
      senal?.removeEventListener('abort', alAbortar);
      resolve();
    }, ms);
    const alAbortar = (): void => {
      clearTimeout(temporizador);
      resolve();
    };
    if (senal) {
      if (senal.aborted) {
        alAbortar();
        return;
      }
      senal.addEventListener('abort', alAbortar, { once: true });
    }
  });
}

export interface OpcionesReintento {
  intentos?: number;
  baseMs?: number;
  techoMs?: number;
  senal?: AbortSignal;
  shouldRetry?: (error: unknown, intento: number) => boolean;
  onRetry?: (error: unknown, intento: number, retardoMs: number) => void;
  nombreOperacion?: string;
}

export const CODIGOS_REINTENTABLES_PG = new Set([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '53300', // too_many_connections
  '55P03', // lock_not_available
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08000', '08003', '08006', '08001', '08004', // connection exceptions
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
]);

export function esReintentable(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const codigo = (error as { code?: unknown }).code;
  if (typeof codigo === 'string' && CODIGOS_REINTENTABLES_PG.has(codigo)) return true;
  const status = (error as { status?: unknown; statusCode?: unknown }).status
    ?? (error as { statusCode?: unknown }).statusCode;
  if (typeof status === 'number' && (status === 429 || status >= 500)) return true;
  return false;
}

/**
 * Reintenta una operación de red o base de datos con backoff exponencial y jitter
 * (T-BE-CL-05). Solo reintenta errores transitorios: un 4xx o un error de
 * validación no debe multiplicar la carga sobre el servicio caído.
 */
export async function reintentar<T>(
  operacion: (intento: number) => Promise<T>,
  opciones: OpcionesReintento = {},
): Promise<T> {
  const {
    intentos = 3,
    baseMs = 250,
    techoMs = 5000,
    senal,
    shouldRetry = esReintentable,
    onRetry,
    nombreOperacion = 'operacion',
  } = opciones;

  let ultimoError: unknown;

  for (let intento = 0; intento < intentos; intento += 1) {
    if (senal?.aborted) {
      throw ultimoError ?? new Error(`${nombreOperacion}: operación cancelada antes de iniciar.`);
    }
    try {
      return await operacion(intento);
    } catch (error) {
      ultimoError = error;
      const esUltimo = intento === intentos - 1;
      if (esUltimo || !shouldRetry(error, intento)) throw error;
      const retardo = retardoReintento({ baseMs, techoMs, intento });
      onRetry?.(error, intento + 1, retardo);
      await esperarConJitter(retardo, senal);
    }
  }

  throw ultimoError;
}
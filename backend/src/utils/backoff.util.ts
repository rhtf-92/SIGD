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
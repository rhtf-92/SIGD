export const API_PREFIX = '/api/v1';

export const API_PREFIX_LEGADO = '/api';

export const WARNING_RUTAS_LEGADAS = '299 - "Rutas preliminares obsoletas; migre a /api/v1/..."';

export function marcarRutaLegada() {
  return (_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void): void => {
    res.setHeader('Warning', WARNING_RUTAS_LEGADAS);
    next();
  };
}

import type { Request, Response, NextFunction } from 'express';

export function responseTimeMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();
  const originalWriteHead = res.writeHead.bind(res);

  // Sobrescribir writeHead de forma segura para inyectar métrica antes de enviar encabezados
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).writeHead = function (...args: any[]): any {
    if (!res.headersSent) {
      const elapsed = (performance.now() - start).toFixed(2);
      res.setHeader('X-Response-Time', `${elapsed}ms`);
    }
    return originalWriteHead(...(args as [any, any?, any?]));
  };

  next();
}

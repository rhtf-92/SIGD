import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { TesoreriaService } from '../tesoreria.service.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors/index.js';

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!);

function pagina(contenido: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pago simulado SIGD</title><style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eef4f7;color:#102b40;font:16px system-ui,sans-serif;padding:20px}
    main{width:min(100%,440px);background:white;border:1px solid #cbdde6;border-radius:20px;padding:28px;box-shadow:0 16px 40px #1235}
    h1{font-size:1.35rem;margin:0 0 20px}.badge{display:inline-block;background:#fff1c7;color:#744400;font-weight:800;font-size:.8rem;padding:6px 10px;border-radius:8px;margin-bottom:16px}
    .code{font-weight:750;font-family:ui-monospace,monospace}.amount{font-size:2rem;font-weight:850;margin:20px 0}.notice{background:#fff7e5;padding:12px;border-radius:10px;margin:20px 0;font-weight:650}
    button{width:100%;border:0;border-radius:12px;background:#087d75;color:white;padding:15px;font:700 1rem system-ui;cursor:pointer}button:hover{background:#06645e}
    p{line-height:1.5}small{color:#526474}
  </style></head><body><main><h1>SIGD IESTP &quot;Suiza&quot;</h1><span class="badge">PAGO SIMULADO · SANDBOX</span>${contenido}<p class="notice">Este entorno es de demostración. No procesa dinero real.</p><small>Esta página no solicita datos bancarios.</small></main></body></html>`;
}

function html(res: Response, status: number, content: string): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.status(status).type('html').send(pagina(content));
}

export function crearRouterCheckoutDemo(pool: Pool): Router {
  const router = Router();
  const service = new TesoreriaService(pool);

  router.get('/demo-pay/:token', async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token);
      const payment = await service.obtenerCheckoutDemo(token);
      if (!payment) return html(res, 404, '<p>Enlace de pago simulado no encontrado.</p>');
      if (payment.status === 'CONFIRMADO') {
        return html(res, 200, `<p>✓ Pago simulado exitosamente.</p><p>Orden <span class="code">${escapeHtml(payment.reference)}</span>${payment.receipt ? ` · ${escapeHtml(payment.receipt)}` : ''}</p><p>Puede volver al sistema SIGD.</p>`);
      }
      if (payment.status !== 'PENDIENTE' || Date.now() >= payment.expiresAt.getTime()) {
        return html(res, 410, '<p>Este QR expiró. Solicite uno nuevo en Tesorería.</p>');
      }
      return html(res, 200, `<p>Orden <span class="code">${escapeHtml(payment.reference)}</span></p><p>${escapeHtml(payment.concept)}</p><p class="amount">S/ ${payment.amount.toFixed(2)}</p><form method="post" action="/demo-pay/${encodeURIComponent(token)}/confirm"><button type="submit">Simular pago exitoso</button></form>`);
    } catch (error) {
      console.error('[DEMO_QR] checkout no disponible:', error instanceof Error ? error.message : 'error desconocido');
      return html(res, 503, '<p>El simulador no está disponible. Intente nuevamente.</p>');
    }
  });

  router.post('/demo-pay/:token/confirm', async (req: Request, res: Response) => {
    try {
      const result = await service.simularPagoDemo(String(req.params.token));
      return html(res, 200, `<p>✓ Pago simulado exitosamente.</p>${result.receipt ? `<p>Constancia: <span class="code">${escapeHtml(result.receipt)}</span></p>` : ''}<p>Puede volver al sistema SIGD.</p>`);
    } catch (error) {
      if (error instanceof NotFoundError) return html(res, 404, '<p>Enlace de pago simulado no encontrado.</p>');
      if (error instanceof ConflictError) return html(res, 410, '<p>Este QR expiró o ya no está disponible. Solicite uno nuevo en Tesorería.</p>');
      console.error('[DEMO_QR] confirmación no disponible:', error instanceof Error ? error.message : 'error desconocido');
      return html(res, 502, '<p>No se pudo confirmar la simulación. Puede reintentar sin crear un pago duplicado.</p>');
    }
  });

  return router;
}

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import {
  extraerTokenBearer,
  verificarTokenAcceso,
  type ClaimsJwt,
} from '../../core/auth/jwt.service.js';
import {
  ForbiddenError,
  UnauthorizedError,
} from '../../shared/domain/errors/index.js';
import {
  confirmarPagoSchema,
  rechazarPagoSchema,
  buscarOrdenesQuerySchema,
  buscarPersonaQuerySchema,
} from './tesoreria.schemas.js';
import { TesoreriaService } from './tesoreria.service.js';

export function crearRouterTesoreria(pool: Pool): Router {
  const router = Router();
  const service = new TesoreriaService(pool);

  const autenticar = async (req: Request): Promise<{ claims: ClaimsJwt; idPersona?: string }> => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) {
      throw new UnauthorizedError({ detail: 'Token de autorización requerido.' });
    }
    const claims = verificarTokenAcceso(token);

    // Resolver id_persona asociado a la cuenta de usuario para controles BOLA
    const res = await pool.query<{ id_persona: string }>(
      'SELECT id_persona::text FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid LIMIT 1',
      [claims.sub],
    );
    const idPersona = res.rows[0]?.id_persona;

    return { claims, idPersona };
  };

  const exigirRoles = (claims: ClaimsJwt, rolesPermitidos: readonly string[]): void => {
    const roles = claims.roles?.map((r) => r.toUpperCase()) ?? [];
    const tienePermiso = roles.some((r) => rolesPermitidos.includes(r));
    if (!tienePermiso) {
      throw new ForbiddenError({
        detail: `Acceso denegado. Se requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}.`,
      });
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Integración con Expediente: Generar y Consultar Orden de Pago
  // ---------------------------------------------------------------------------

  // POST /api/v1/expedientes/:id/orden-pago
  router.post('/expedientes/:id/orden-pago', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims, idPersona } = await autenticar(req);
      exigirRoles(claims, ['MESA_PARTES', 'ADMINISTRADOR', 'CIUDADANO']);

      const expedienteId = String(req.params.id);
      const orden = await service.generarOrdenPago(
        expedienteId,
        claims.sub,
        claims.roles ?? [],
        idPersona,
      );

      res.status(201).json(orden);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/expedientes/:id/pago
  router.get('/expedientes/:id/pago', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims, idPersona } = await autenticar(req);
      exigirRoles(claims, [
        'MESA_PARTES',
        'ADMINISTRADOR',
        'DIRECTOR',
        'SECRETARIO',
        'ESPECIALISTA',
        'TESORERIA',
        'CIUDADANO',
      ]);

      const expedienteId = String(req.params.id);
      const pago = await service.obtenerPagoPorExpediente(
        expedienteId,
        claims.roles ?? [],
        idPersona,
      );

      if (!pago) {
        res.status(200).json({ tieneOrden: false, pago: null });
        return;
      }

      res.status(200).json({ tieneOrden: true, pago });
    } catch (error) {
      next(error);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Módulo Tesorería Institucional
  // ---------------------------------------------------------------------------

  // GET /api/v1/tesoreria/dashboard (Tarjetas reales con contadores de BD)
  router.get('/tesoreria/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['TESORERIA', 'ADMINISTRADOR']);

      const metricas = await service.obtenerMetricasDashboard();
      res.status(200).json(metricas);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/tesoreria/ordenes (Bandeja paginada con filtros)
  router.get('/tesoreria/ordenes', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['TESORERIA', 'ADMINISTRADOR']);

      const params = buscarOrdenesQuerySchema.parse(req.query);
      const resultado = await service.listarOrdenes(params);
      res.status(200).json({
        items: resultado.ordenes,
        total: resultado.total,
        page: params.page,
        totalPages: Math.ceil(resultado.total / params.limit),
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/tesoreria/ordenes/:id (Detalle de la orden)
  router.get('/tesoreria/ordenes/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims, idPersona } = await autenticar(req);
      exigirRoles(claims, ['TESORERIA', 'ADMINISTRADOR', 'CIUDADANO']);

      const ordenPagoId = String(req.params.id);
      const orden = await service.obtenerOrdenPorId(
        ordenPagoId,
        claims.roles ?? [],
        idPersona,
      );

      res.status(200).json(orden);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/tesoreria/ordenes/:id/confirmar (Confirmación de pago Efectivo o Yape)
  router.post('/tesoreria/ordenes/:id/confirmar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['TESORERIA', 'ADMINISTRADOR']);

      const ordenPagoId = String(req.params.id);
      const datos = confirmarPagoSchema.parse(req.body);

      const ordenConfirmada = await service.confirmarPago(
        ordenPagoId,
        datos,
        claims.sub,
      );

      res.status(200).json({
        ok: true,
        mensaje: 'Pago confirmado exitosamente y registrado en Tesorería.',
        orden: ordenConfirmada,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/tesoreria/ordenes/:id/rechazar (Rechazo con motivo formal)
  router.post('/tesoreria/ordenes/:id/rechazar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['TESORERIA', 'ADMINISTRADOR']);

      const ordenPagoId = String(req.params.id);
      const { motivo } = rechazarPagoSchema.parse(req.body);

      const ordenRechazada = await service.rechazarPago(
        ordenPagoId,
        motivo,
        claims.sub,
      );

      res.status(200).json({
        ok: true,
        mensaje: 'Orden de pago rechazada formalmente.',
        orden: ordenRechazada,
      });
    } catch (error) {
      next(error);
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Atención Presencial por DNI: Búsqueda Administrativa
  // ---------------------------------------------------------------------------

  // GET /api/v1/mesa-partes/personas/buscar
  router.get('/mesa-partes/personas/buscar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      // Solo operadores autorizados pueden buscar personas por documento
      exigirRoles(claims, ['MESA_PARTES', 'ADMINISTRADOR']);

      const { tipoDocumento, numeroDocumento } = buscarPersonaQuerySchema.parse(req.query);

      const resultado = await service.buscarPersonaParaAtencionPresencial(
        tipoDocumento,
        numeroDocumento,
        claims.sub,
      );

      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Módulo TAYPI: Configuración, Creación de Pago y Webhook
  // ---------------------------------------------------------------------------

  router.get('/tesoreria/configuracion-demo-qr', (_req: Request, res: Response) => {
    res.status(200).json(service.obtenerConfiguracionDemoQr());
  });

  router.post('/tesoreria/ordenes/:id/pago-demo-qr', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims, idPersona } = await autenticar(req);
      exigirRoles(claims, ['CIUDADANO', 'MESA_PARTES', 'TESORERIA', 'ADMINISTRADOR']);
      const orden = await service.crearPagoAutomaticoDemo(String(req.params.id), claims.roles ?? [], idPersona);
      res.status(200).json({ ok: true, mensaje: 'QR de simulación generado. No procesa dinero real.', orden });
    } catch (error) { next(error); }
  });

  router.post('/webhooks/demo-qr', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      const result = await service.procesarWebhookDemo(rawBody ?? Buffer.alloc(0), req.get('demo-qr-signature'));
      res.status(200).json(result);
    } catch (error) { next(error); }
  });

  // GET /api/v1/tesoreria/configuracion-taypi
  router.get('/tesoreria/configuracion-taypi', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const config = service.obtenerConfiguracionTaypi();
      res.status(200).json(config);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/tesoreria/ordenes/:id/pago-automatico
  router.post('/tesoreria/ordenes/:id/pago-automatico', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims, idPersona } = await autenticar(req);
      exigirRoles(claims, ['CIUDADANO', 'MESA_PARTES', 'TESORERIA', 'ADMINISTRADOR']);

      const ordenPagoId = String(req.params.id);
      const orden = await service.crearPagoAutomaticoTaypi(
        ordenPagoId,
        claims.sub,
        claims.roles ?? [],
        idPersona,
      );

      res.status(200).json({
        ok: true,
        mensaje: 'Pago QR automático generado con TAYPI Sandbox.',
        orden,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/webhooks/taypi (Público, validado estrictamente por firma HMAC)
  router.post('/webhooks/taypi', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature =
        (req.get('taypi-signature') ||
          req.get('x-taypi-signature') ||
          (req.headers['taypi-signature'] as string) ||
          (req.headers['x-taypi-signature'] as string)) ??
        undefined;

      const rawBody =
        (req as unknown as { rawBody?: Buffer }).rawBody ??
        (Buffer.isBuffer(req.body)
          ? req.body
          : typeof req.body === 'string'
            ? Buffer.from(req.body, 'utf-8')
            : Buffer.from(JSON.stringify(req.body || {}), 'utf-8'));

      const resultado = await service.procesarWebhookTaypi(rawBody, signature);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

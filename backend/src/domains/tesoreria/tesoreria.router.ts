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
  registrarPersonaPresencialSchema,
  solicitarDevolucionSchema,
  observarDevolucionSchema,
  subsanarDevolucionSchema,
  aprobarDevolucionSchema,
  rechazarDevolucionSchema,
  ejecutarDevolucionSchema,
  buscarDevolucionesQuerySchema,
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
      const body = req.body ?? {};
      const confirmarPagoAdicional = Boolean(body.confirmarPagoAdicional);
      const motivoAdicional = typeof body.motivoAdicional === 'string' ? body.motivoAdicional : undefined;

      const orden = await service.generarOrdenPago(
        expedienteId,
        claims.sub,
        claims.roles ?? [],
        idPersona,
        { confirmarPagoAdicional, motivoAdicional },
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

  // GET /api/v1/expedientes/:id/saldos (Cálculo financiero y auditoría de sobrepagos)
  router.get('/expedientes/:id/saldos', async (req: Request, res: Response, next: NextFunction) => {
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
      const saldos = await service.calcularSaldosExpediente(
        expedienteId,
        claims.roles ?? [],
        idPersona,
        claims.sub,
      );

      res.status(200).json(saldos);
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

  // POST /api/v1/tesoreria/ordenes/:id/confirmar (Confirmación atómica de pago)
  router.post('/tesoreria/ordenes/:id/confirmar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['TESORERIA', 'ADMINISTRADOR']);

      const ordenPagoId = String(req.params.id);
      const datos = confirmarPagoSchema.parse(req.body);

      const orden = await service.confirmarPago(ordenPagoId, datos, claims.sub);

      res.status(200).json({
        ok: true,
        mensaje: 'Pago confirmado exitosamente. Se emitió el recibo de cobro.',
        recibo: orden.codigoRecibo,
        orden,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/tesoreria/ordenes/:id/rechazar (Rechazo de orden por error/vencida)
  router.post('/tesoreria/ordenes/:id/rechazar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['TESORERIA', 'ADMINISTRADOR']);

      const ordenPagoId = String(req.params.id);
      const datos = rechazarPagoSchema.parse(req.body);

      const orden = await service.rechazarPago(ordenPagoId, datos.motivo, claims.sub);

      res.status(200).json({
        ok: true,
        mensaje: 'Orden de pago rechazada.',
        orden,
      });
    } catch (error) {
      next(error);
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Atención Presencial: Búsqueda y Registro en Ventanilla
  // ---------------------------------------------------------------------------

  // GET /api/v1/personas/buscar y /api/v1/mesa-partes/personas/buscar
  router.get(['/personas/buscar', '/mesa-partes/personas/buscar'], async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['MESA_PARTES', 'ADMINISTRADOR', 'TESORERIA']);

      const query = buscarPersonaQuerySchema.parse(req.query);
      const resultado = await service.buscarPersonaParaAtencionPresencial(
        query.tipoDocumento,
        query.numeroDocumento,
        claims.sub,
      );

      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/personas/presencial y /api/v1/mesa-partes/personas/presencial
  router.post(['/personas/presencial', '/mesa-partes/personas/presencial'], async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['MESA_PARTES', 'ADMINISTRADOR', 'TESORERIA']);

      const datos = registrarPersonaPresencialSchema.parse(req.body);
      const persona = await service.registrarPersonaPresencial(datos, claims.sub);

      res.status(201).json(persona);
    } catch (error) {
      next(error);
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Módulo Devoluciones de Pago (Fase 3)
  // ---------------------------------------------------------------------------

  // POST /api/v1/devoluciones (Solicitar devolución)
  router.post('/devoluciones', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims, idPersona } = await autenticar(req);
      exigirRoles(claims, ['CIUDADANO', 'MESA_PARTES', 'ADMINISTRADOR']);

      const body = solicitarDevolucionSchema.parse(req.body);
      const devolucion = await service.solicitarDevolucion(
        {
          ...body,
          canalRegistro: (claims.roles ?? []).some((rol) =>
            ['MESA_PARTES', 'ADMINISTRADOR'].includes(rol.toUpperCase()))
            ? 'MESA_PARTES'
            : 'VIRTUAL',
        },
        claims.sub,
        claims.roles ?? [],
        idPersona,
      );

      res.status(201).json({
        ok: true,
        mensaje: 'Solicitud de devolución registrada exitosamente.',
        codigoDev: devolucion.codigoDev,
        devolucion,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/devoluciones (Listar solicitudes de devolución con filtros)
  router.get('/devoluciones', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims, idPersona } = await autenticar(req);
      exigirRoles(claims, [
        'CIUDADANO',
        'MESA_PARTES',
        'TESORERIA',
        'ADMINISTRADOR',
        'DIRECTOR',
        'SECRETARIO',
        'ESPECIALISTA',
      ]);

      const params = buscarDevolucionesQuerySchema.parse(req.query);
      const resultado = await service.listarDevoluciones(
        params,
        claims.roles ?? [],
        idPersona,
      );

      res.status(200).json({
        items: resultado.items,
        total: resultado.total,
        page: params.page,
        totalPages: Math.ceil(resultado.total / params.limit),
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/devoluciones/:id (Detalle de la devolución)
  router.get('/devoluciones/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims, idPersona } = await autenticar(req);
      exigirRoles(claims, [
        'CIUDADANO',
        'MESA_PARTES',
        'TESORERIA',
        'ADMINISTRADOR',
        'DIRECTOR',
        'SECRETARIO',
        'ESPECIALISTA',
      ]);

      const id = String(req.params.id);
      const devolucion = await service.obtenerDevolucionPorId(
        id,
        claims.roles ?? [],
        idPersona,
      );

      res.status(200).json(devolucion);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/devoluciones/:id/revisar (Mesa de Partes pasa a revisión documental)
  router.post('/devoluciones/:id/revisar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['MESA_PARTES', 'ADMINISTRADOR']);

      const id = String(req.params.id);
      const devolucion = await service.revisarDevolucion(
        id,
        claims.sub,
        claims.roles ?? [],
      );

      res.status(200).json({
        ok: true,
        mensaje: 'La solicitud de devolución se encuentra ahora en revisión documental.',
        devolucion,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/devoluciones/:id/observar (Mesa de Partes observa la solicitud)
  router.post('/devoluciones/:id/observar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['MESA_PARTES', 'ADMINISTRADOR']);

      const id = String(req.params.id);
      const body = observarDevolucionSchema.parse(req.body);
      const devolucion = await service.observarDevolucion(
        id,
        body.motivoObservacion,
        claims.sub,
        claims.roles ?? [],
      );

      res.status(200).json({
        ok: true,
        mensaje: 'La solicitud de devolución ha sido observada.',
        devolucion,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/devoluciones/:id/subsanar (Ciudadano o Mesa de Partes subsana observación)
  router.post('/devoluciones/:id/subsanar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims, idPersona } = await autenticar(req);
      exigirRoles(claims, ['CIUDADANO', 'MESA_PARTES', 'ADMINISTRADOR']);

      const id = String(req.params.id);
      const body = subsanarDevolucionSchema.parse(req.body);
      const devolucion = await service.subsanarDevolucion(
        id,
        body.sustentoSubsanacion,
        claims.sub,
        claims.roles ?? [],
        idPersona,
      );

      res.status(200).json({
        ok: true,
        mensaje: 'La observación ha sido subsanada exitosamente.',
        devolucion,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/devoluciones/:id/aprobar (Mesa de Partes autoriza documentalmente)
  router.post('/devoluciones/:id/aprobar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['MESA_PARTES', 'ADMINISTRADOR']);

      const id = String(req.params.id);
      const body = aprobarDevolucionSchema.parse(req.body);
      const devolucion = await service.aprobarDevolucion(
        id,
        body.montoAutorizado,
        body.observacionResolucion,
        claims.sub,
        claims.roles ?? [],
      );

      res.status(200).json({
        ok: true,
        mensaje: 'Devolución autorizada documentalmente. Se remitió a Tesorería para su ejecución.',
        devolucion,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/devoluciones/:id/rechazar (Mesa de Partes rechaza la solicitud)
  router.post('/devoluciones/:id/rechazar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['MESA_PARTES', 'ADMINISTRADOR']);

      const id = String(req.params.id);
      const body = rechazarDevolucionSchema.parse(req.body);
      const devolucion = await service.rechazarDevolucion(
        id,
        body.motivoRechazo,
        claims.sub,
        claims.roles ?? [],
      );

      res.status(200).json({
        ok: true,
        mensaje: 'La solicitud de devolución ha sido rechazada.',
        devolucion,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/devoluciones/:id/ejecutar (Tesorería procesa materialmente el desembolso)
  router.post('/devoluciones/:id/ejecutar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims } = await autenticar(req);
      exigirRoles(claims, ['TESORERIA', 'ADMINISTRADOR']);

      const id = String(req.params.id);
      const body = ejecutarDevolucionSchema.parse(req.body);
      const devolucion = await service.ejecutarDevolucion(
        id,
        body.metodoDevolucion,
        body.observacion,
        claims.sub,
        claims.roles ?? [],
      );

      res.status(200).json({
        ok: true,
        mensaje: 'Devolución procesada y desembolsada exitosamente.',
        constanciaDevolucionCodigo: devolucion.constanciaDevolucionCodigo,
        devolucion,
      });
    } catch (error) {
      next(error);
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Módulo DEMO_QR (Sandbox de Simulación)
  // ---------------------------------------------------------------------------

  router.get('/tesoreria/demo-qr/config', (_req: Request, res: Response) => {
    res.status(200).json(service.obtenerConfiguracionDemoQr());
  });

  router.get('/public/checkout-demo/:token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const checkout = await service.obtenerCheckoutDemo(String(req.params.token));
      if (!checkout) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Enlace de pago simulado no encontrado.' });
        return;
      }
      res.status(200).json(checkout);
    } catch (error) {
      next(error);
    }
  });

  router.post('/public/checkout-demo/:token/pagar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resultado = await service.simularPagoDemo(String(req.params.token));
      res.status(200).json({ ok: true, status: resultado.status, codigoRecibo: resultado.receipt ?? null });
    } catch (error) {
      next(error);
    }
  });

  router.post('/tesoreria/ordenes/:id/pago-automatico-demo', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims, idPersona } = await autenticar(req);
      exigirRoles(claims, ['CIUDADANO', 'MESA_PARTES', 'TESORERIA', 'ADMINISTRADOR']);

      const ordenPagoId = String(req.params.id);
      const orden = await service.crearPagoAutomaticoDemo(ordenPagoId, claims.roles ?? [], idPersona);
      res.status(200).json({ ok: true, mensaje: 'QR de simulación generado. No procesa dinero real.', orden });
    } catch (error) {
      next(error);
    }
  });

  router.post('/tesoreria/ordenes/:id/pago-demo-qr', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { claims, idPersona } = await autenticar(req);
      exigirRoles(claims, ['CIUDADANO', 'MESA_PARTES', 'TESORERIA', 'ADMINISTRADOR']);

      const ordenPagoId = String(req.params.id);
      const orden = await service.crearPagoAutomaticoDemo(ordenPagoId, claims.roles ?? [], idPersona);
      res.status(200).json({ ok: true, mensaje: 'QR de simulación generado. No procesa dinero real.', orden });
    } catch (error) {
      next(error);
    }
  });

  router.post('/webhooks/demo-qr', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature =
        (req.get('demo-qr-signature') ||
          (req.headers['demo-qr-signature'] as string) ||
          req.get('x-demo-qr-signature') ||
          (req.headers['x-demo-qr-signature'] as string)) ??
        undefined;

      const rawBody =
        (req as unknown as { rawBody?: Buffer }).rawBody ??
        (Buffer.isBuffer(req.body)
          ? req.body
          : typeof req.body === 'string'
            ? Buffer.from(req.body, 'utf-8')
            : Buffer.from(JSON.stringify(req.body || {}), 'utf-8'));

      const resultado = await service.procesarWebhookDemo(rawBody, signature);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Módulo TAYPI (Pasarela QR Automático Sandbox Real)
  // ---------------------------------------------------------------------------

  router.get('/tesoreria/taypi/config', (_req: Request, res: Response) => {
    res.status(200).json(service.obtenerConfiguracionTaypi());
  });

  router.get('/tesoreria/configuracion-taypi', (_req: Request, res: Response) => {
    res.status(200).json(service.obtenerConfiguracionTaypi());
  });

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

  router.post('/tesoreria/ordenes/:id/pago-automatico-taypi', async (req: Request, res: Response, next: NextFunction) => {
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

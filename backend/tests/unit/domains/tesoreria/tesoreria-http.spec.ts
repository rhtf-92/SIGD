import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Pool } from 'pg';
import { crearRouterTesoreria } from '../../../../src/domains/tesoreria/tesoreria.router.js';
import { TesoreriaService } from '../../../../src/domains/tesoreria/tesoreria.service.js';
import { crearRouterDerivaciones } from '../../../../src/domains/rutadoc/derivaciones.controller.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

describe('SIGD 2026 — Tesorería HTTP, RBAC y Salvaguardas BOLA / IDOR', () => {
  let app: express.Express;
  let mockPool: Pool;

  const mockExpedienteId = 'e0000000-0000-4000-8000-000000000001';
  const mockOrdenPagoId = 'p0000000-0000-4000-8000-000000000001';
  const mockPersonaIdCiudadanoA = 'pers-0000-0000-0000-000000000001';
  const mockPersonaIdCiudadanoB = 'pers-0000-0000-0000-000000000002';
  const mockUsuarioTesorero = 'u0000000-0000-4000-8000-000000000001';
  const mockUsuarioMesa = 'u0000000-0000-4000-8000-000000000002';
  const mockUsuarioCiudadanoA = 'u0000000-0000-4000-8000-000000000003';
  const mockUsuarioCiudadanoB = 'u0000000-0000-4000-8000-000000000004';

  const tokenTesorero = firmarTokenAcceso({
    sub: mockUsuarioTesorero,
    roles: ['TESORERIA'],
  });

  const tokenMesa = firmarTokenAcceso({
    sub: mockUsuarioMesa,
    roles: ['MESA_PARTES'],
  });

  const tokenCiudadanoA = firmarTokenAcceso({
    sub: mockUsuarioCiudadanoA,
    roles: ['CIUDADANO'],
  });

  const tokenCiudadanoB = firmarTokenAcceso({
    sub: mockUsuarioCiudadanoB,
    roles: ['CIUDADANO'],
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockPool = {
      query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
        // Mock resolución de id_persona desde cuenta_usuario
        if (sql.includes('SELECT id_persona::text FROM sigd_auth.cuenta_usuario')) {
          const idUsuario = params?.[0];
          if (idUsuario === mockUsuarioCiudadA()) {
            return Promise.resolve({ rows: [{ id_persona: mockPersonaIdCiudadanoA }] });
          }
          if (idUsuario === mockUsuarioCiudadB()) {
            return Promise.resolve({ rows: [{ id_persona: mockPersonaIdCiudadanoB }] });
          }
          return Promise.resolve({ rows: [{ id_persona: 'persona-institucional-uuid' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      connect: vi.fn(),
    } as unknown as Pool;

    app = express();
    app.use(express.json());
    app.use('/api/v1', crearRouterTesoreria(mockPool));
    app.use('/api/v1/expedientes', crearRouterDerivaciones(mockPool));
    app.use(errorMiddleware);
  });

  function mockUsuarioCiudadA() {
    return mockUsuarioCiudadanoA;
  }
  function mockUsuarioCiudadB() {
    return mockUsuarioCiudadanoB;
  }

  describe('RBAC y Permisos por Rol', () => {
    it('entrega items y paginación que consume la bandeja, con filtros PENDIENTE y TODOS', async () => {
      const listar = vi.spyOn(TesoreriaService.prototype, 'listarOrdenes').mockResolvedValue({
        total: 1, ordenes: [{ ordenPagoId: mockOrdenPagoId, codigoPago: 'PAG-2026-000004',
          codigoExpediente: 'EXP-2026-000002', estado: 'PENDIENTE', monto: 100 }] as never,
      });
      const pendiente = await request(app).get('/api/v1/tesoreria/ordenes?estado=PENDIENTE&buscar=EXP-2026-000002&page=1&limit=10')
        .set('Authorization', `Bearer ${tokenTesorero}`);
      expect(pendiente.status).toBe(200);
      expect(pendiente.body).toMatchObject({ total: 1, page: 1, totalPages: 1,
        items: [{ codigoPago: 'PAG-2026-000004', codigoExpediente: 'EXP-2026-000002' }] });
      expect(listar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'PENDIENTE', buscar: 'EXP-2026-000002' }));

      const todos = await request(app).get('/api/v1/tesoreria/ordenes?estado=TODOS&buscar=PAG-2026-000004')
        .set('Authorization', `Bearer ${tokenTesorero}`);
      expect(todos.status).toBe(200);
      expect(todos.body.items).toHaveLength(1);
      expect(listar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'TODOS', buscar: 'PAG-2026-000004' }));
    });

    it('MESA_PARTES NO puede confirmar pagos (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/tesoreria/ordenes/${mockOrdenPagoId}/confirmar`)
        .set('Authorization', `Bearer ${tokenMesa}`)
        .send({ metodoPago: 'EFECTIVO', montoRecibido: 100 });

      expect(res.status).toBe(403);
      expect(res.body.detail ?? res.body.message ?? res.text).toContain('Acceso denegado');
    });

    it('CIUDADANO NO puede confirmar pagos (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/tesoreria/ordenes/${mockOrdenPagoId}/confirmar`)
        .set('Authorization', `Bearer ${tokenCiudadanoA}`)
        .send({ metodoPago: 'EFECTIVO', montoRecibido: 100 });

      expect(res.status).toBe(403);
    });

    it('CIUDADANO NO puede rechazar pagos (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/tesoreria/ordenes/${mockOrdenPagoId}/rechazar`)
        .set('Authorization', `Bearer ${tokenCiudadanoA}`)
        .send({ motivo: 'Rechazo arbitrario' });

      expect(res.status).toBe(403);
    });

    it('CIUDADANO NO puede listar la bandeja de Tesorería (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/tesoreria/ordenes')
        .set('Authorization', `Bearer ${tokenCiudadanoA}`);

      expect(res.status).toBe(403);
    });

    it('CIUDADANO NO puede consultar métricas de dashboard de Tesorería (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/tesoreria/dashboard')
        .set('Authorization', `Bearer ${tokenCiudadanoA}`);

      expect(res.status).toBe(403);
    });

    it('CIUDADANO NO puede realizar búsquedas administrativas de personas por DNI (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/mesa-partes/personas/buscar?tipoDocumento=DNI&numeroDocumento=99000001')
        .set('Authorization', `Bearer ${tokenCiudadanoA}`);

      expect(res.status).toBe(403);
    });

    it('Sin token Bearer rechaza con 401 Unauthorized', async () => {
      const res = await request(app)
        .get('/api/v1/tesoreria/ordenes');

      expect(res.status).toBe(401);
    });
  });

  describe('Validación de Entrada y Métodos de Cobro', () => {
    it('YAPE sin referencia de operación rechaza con 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/v1/tesoreria/ordenes/${mockOrdenPagoId}/confirmar`)
        .set('Authorization', `Bearer ${tokenTesorero}`)
        .send({ metodoPago: 'YAPE', referenciaOperacion: '' });

      expect(res.status).toBe(400);
    });

    it('Rechazo con motivo menor a 5 caracteres rechaza con 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/v1/tesoreria/ordenes/${mockOrdenPagoId}/rechazar`)
        .set('Authorization', `Bearer ${tokenTesorero}`)
        .send({ motivo: 'no' });

      expect(res.status).toBe(400);
    });
  });

  describe('Bloqueo de Derivación ante Pago Pendiente', () => {
    it('POST /api/v1/expedientes/:id/derivar rechaza con 409 PAGO_PENDIENTE si el trámite tiene orden PENDIENTE', async () => {
      mockPool.connect = vi.fn().mockResolvedValue({
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql === 'BEGIN') return Promise.resolve();
          if (sql === 'ROLLBACK') return Promise.resolve();
          if (sql.includes('FROM sigd_tra.orden_pago')) {
            return Promise.resolve({
              rows: [{ estado: 'PENDIENTE', monto: '100.00' }],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      });

      const res = await request(app)
        .post(`/api/v1/expedientes/${mockExpedienteId}/derivar`)
        .set('Authorization', `Bearer ${tokenMesa}`)
        .send({
          destinos: [{ area_destino_id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1' }],
          proveido: 'Derivar para atención académica',
        });

      expect(res.status).toBe(409);
      expect(res.body.code ?? res.body.codigo).toBe('PAGO_PENDIENTE');
      expect(res.body.detail ?? res.body.message ?? res.body.title).toContain('PENDIENTE');
    });

    it('POST /api/v1/expedientes/:id/derivar rechaza con 409 PAGO_PENDIENTE si trámite TUPA tiene costo y no tiene orden pagada', async () => {
      mockPool.connect = vi.fn().mockResolvedValue({
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql === 'BEGIN') return Promise.resolve();
          if (sql === 'ROLLBACK') return Promise.resolve();
          if (sql.includes('FROM sigd_tra.orden_pago')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('FROM sigd_doc.expediente_tupa_vinculo')) {
            return Promise.resolve({ rows: [{ monto: '100.00' }] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      });

      const res = await request(app)
        .post(`/api/v1/expedientes/${mockExpedienteId}/derivar`)
        .set('Authorization', `Bearer ${tokenMesa}`)
        .send({
          destinos: [{ area_destino_id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1' }],
          proveido: 'Derivar para atención académica',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PAGO_PENDIENTE');
    });
  });

  describe('TAYPI Sandbox HTTP & Webhooks', () => {
    it('GET /api/v1/tesoreria/configuracion-taypi entrega status del sandbox sin secretos', async () => {
      vi.spyOn(TesoreriaService.prototype, 'obtenerConfiguracionTaypi').mockReturnValue({
        configured: true,
        sandbox: true,
        publicKey: 'taypi_pk_test_123',
        baseUrl: 'https://sandbox.taypi.pe',
        simulatorUrl: 'https://sandbox.taypi.pe/simulator',
      });

      const res = await request(app)
        .get('/api/v1/tesoreria/configuracion-taypi')
        .set('Authorization', `Bearer ${tokenCiudadanoA}`);

      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(true);
      expect(res.body.sandbox).toBe(true);
      expect(res.body.simulatorUrl).toBe('https://sandbox.taypi.pe/simulator');
      expect(res.body.secretKey).toBeUndefined();
    });

    it('POST /api/v1/tesoreria/ordenes/:id/pago-automatico genera orden QR', async () => {
      vi.spyOn(TesoreriaService.prototype, 'crearPagoAutomaticoTaypi').mockResolvedValue({
        ordenPagoId: mockOrdenPagoId,
        codigoPago: 'PAG-2026-000001',
        estado: 'PENDIENTE',
        paymentProvider: 'TAYPI',
        providerPaymentId: 'taypi-pay-1',
        providerQrImage: 'data:image/svg+xml;base64,...',
        monto: 100,
      } as any);

      const res = await request(app)
        .post(`/api/v1/tesoreria/ordenes/${mockOrdenPagoId}/pago-automatico`)
        .set('Authorization', `Bearer ${tokenCiudadanoA}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.orden.providerPaymentId).toBe('taypi-pay-1');
    });

    it('POST /api/v1/webhooks/taypi procesa webhook con firma válida sin requerir token JWT', async () => {
      vi.spyOn(TesoreriaService.prototype, 'procesarWebhookTaypi').mockResolvedValue({
        received: true,
        status: 'processed',
        codigoPago: 'PAG-2026-000001',
        codigoRecibo: 'REC-2026-000001',
      });

      const res = await request(app)
        .post('/api/v1/webhooks/taypi')
        .set('Taypi-Signature', 'hex_signature_123')
        .send({
          event: 'payment.completed',
          payment_id: 'taypi-pay-1',
          amount: 100.0,
          currency: 'PEN',
          status: 'completed',
          reference: 'PAG-2026-000001',
        });

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.codigoRecibo).toBe('REC-2026-000001');
    });
  });
});

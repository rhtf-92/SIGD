import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { TesoreriaService } from '../../../../src/domains/tesoreria/tesoreria.service.js';
import { TesoreriaRepository } from '../../../../src/domains/tesoreria/tesoreria.repository.js';
import { solicitarDevolucionSchema } from '../../../../src/domains/tesoreria/tesoreria.schemas.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../src/shared/domain/errors/index.js';

vi.mock('../../../../src/audit/bitacora-auditoria.repository.js', () => ({
  registrarMutacion: vi.fn().mockResolvedValue('auditoria-123'),
}));
vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({
  insertarEvento: vi.fn().mockResolvedValue('evento-123'),
}));

describe('SIGD 2026 — FASE 3: Devoluciones, Sobrepagos y Pagos Adicionales', () => {
  let pool: Pool;
  let mockClient: PoolClient;
  let repository: TesoreriaRepository;
  let service: TesoreriaService;

  const mockExpedienteId = 'e0000000-0000-4000-8000-000000000001';
  const mockOrdenPagoId1 = 'p0000000-0000-4000-8000-000000000001';
  const mockOrdenPagoId2 = 'p0000000-0000-4000-8000-000000000002';
  const mockSolicitudDevId = 'd0000000-0000-4000-8000-000000000001';
  const mockSolicitanteId = 's0000000-0000-4000-8000-000000000001';
  const mockUsuarioCiudadano = 'u0000000-0000-4000-8000-000000000001';
  const mockUsuarioMesa = 'u0000000-0000-4000-8000-000000000002';
  const mockUsuarioTesorero = 'u0000000-0000-4000-8000-000000000003';

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    } as unknown as PoolClient;

    pool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn().mockImplementation((sql: any, params?: any[]) => {
        const sqlStr = typeof sql === 'string' ? sql : sql?.text || '';
        if (sqlStr.includes('FROM sigd_auth.cuenta_usuario')) {
          const uid = params?.[0] || 'mock-user';
          return { rows: [{ id_usuario: uid, usuario: 'mock.user', correo: 'user@iestp.edu.pe', activo: true }] };
        }
        if (sqlStr.includes('asignacion_perfil_operativo')) {
          const uid = params?.[0];
          const isTeso = uid === mockUsuarioTesorero;
          return {
            rows: [
              {
                id_asignacion_perfil: 'asig-perf-01',
                perfil_id: isTeso ? 6 : 7,
                perfil_codigo: isTeso ? 'GESTOR_TESORERIA' : 'AUTORIZADOR_DEVOLUCION',
                perfil_nombre: isTeso ? 'Gestor de Tesorería' : 'Autorizador de Devolución',
                area_id: null,
                scope: 'INSTITUCIONAL',
                id_responsabilidad: null,
                estado: 'ACTIVO',
                vigente_desde: '2026-01-01',
                vigente_hasta: null,
                permisos: isTeso ? ['DEVOLUCION_EJECUTAR', 'PAGO_VER'] : ['DEVOLUCION_AUTORIZAR', 'DEVOLUCION_REVISAR'],
                alcance: null,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    repository = new TesoreriaRepository();
    service = new TesoreriaService(pool, repository);
    vi.spyOn(repository, 'cuentaCiudadanaVinculadaAlExpediente').mockResolvedValue(true);

    vi.spyOn(repository, 'obtenerContextoExpedienteParaPago').mockResolvedValue({
      expedienteId: mockExpedienteId,
      codigoExpediente: 'EXP-2026-000001',
      solicitanteId: mockSolicitanteId,
      tipoDocumento: 'DNI',
      numeroDocumento: '99000001',
      nombreSolicitante: 'Geric Demo',
      costoOficial: 100.0,
      concepto: 'Certificado de Estudios',
      codigoTupa: 'TUPA-01',
      registroVersionId: 'r0000000-0000-4000-8000-000000000001',
    });
  });

  it('rechaza canalRegistro manipulado por el cliente', () => {
    expect(() => solicitarDevolucionSchema.parse({
      expedienteId: mockExpedienteId,
      ordenPagoId: mockOrdenPagoId1,
      causal: 'SOBREPAGO',
      motivo: 'Pago duplicado confirmado.',
      montoSolicitado: 50,
      canalRegistro: 'MESA_PARTES',
    })).toThrow();
  });

  it('no convierte una falla SQL de órdenes en lista vacía', async () => {
    vi.spyOn(repository, 'obtenerOrdenActivaPorExpediente').mockResolvedValue(null);
    vi.spyOn(repository, 'obtenerOrdenesPorExpediente').mockRejectedValue(new Error('SQL_CONNECTION_LOST'));
    await expect(service.generarOrdenPago(mockExpedienteId, mockUsuarioMesa, ['MESA_PARTES']))
      .rejects.toThrow('SQL_CONNECTION_LOST');
  });

  it('consulta solo la orden principal activa', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await repository.obtenerOrdenActivaPorExpediente({ query } as unknown as Pool, mockExpedienteId);
    expect(query.mock.calls[0][0]).toContain("op.tipo_orden = 'PRINCIPAL'");
    expect(query.mock.calls[0][0]).toContain("op.estado IN ('PENDIENTE', 'CONFIRMADO')");
  });

  it('no autoriza más de lo solicitado aunque exista saldo suficiente', async () => {
    vi.spyOn(repository, 'obtenerSolicitudDevolucionPorIdConLock').mockResolvedValue({
      solicitud_devolucion_id: mockSolicitudDevId,
      orden_pago_id: mockOrdenPagoId1,
      monto_solicitado: '50.00',
      estado: 'EN_REVISION',
    } as any);
    vi.spyOn(repository, 'obtenerOrdenPorIdConLock').mockResolvedValue({ estado: 'CONFIRMADO' } as any);
    vi.spyOn(repository, 'calcularSaldoDevolviblePago').mockResolvedValue(100);
    await expect(service.aprobarDevolucion(mockSolicitudDevId, 100, '', mockUsuarioMesa, ['MESA_PARTES']))
      .rejects.toMatchObject({ code: 'MONTO_EXCEDE_SOLICITADO' });
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('no autoriza más del saldo devolvible', async () => {
    vi.spyOn(repository, 'obtenerSolicitudDevolucionPorIdConLock').mockResolvedValue({
      solicitud_devolucion_id: mockSolicitudDevId,
      orden_pago_id: mockOrdenPagoId1,
      monto_solicitado: '100.00',
      estado: 'EN_REVISION',
    } as any);
    vi.spyOn(repository, 'obtenerOrdenPorIdConLock').mockResolvedValue({ estado: 'CONFIRMADO' } as any);
    vi.spyOn(repository, 'calcularSaldoDevolviblePago').mockResolvedValue(50);
    await expect(service.aprobarDevolucion(mockSolicitudDevId, 100, '', mockUsuarioMesa, ['MESA_PARTES']))
      .rejects.toMatchObject({ code: 'SALDO_INSUFICIENTE' });
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('ciudadano sin vinculación aprobada no solicita devolución aunque coincida la persona', async () => {
    vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValue({
      orden_pago_id: mockOrdenPagoId1, expediente_id: mockExpedienteId,
      solicitante_id: mockSolicitanteId, estado: 'CONFIRMADO', monto: '100.00',
    } as any);
    vi.mocked(repository.cuentaCiudadanaVinculadaAlExpediente).mockResolvedValue(false);
    await expect(service.solicitarDevolucion({
      expedienteId: mockExpedienteId, ordenPagoId: mockOrdenPagoId1,
      causal: 'SOBREPAGO', motivo: 'Pago duplicado confirmado.',
      montoSolicitado: 50, canalRegistro: 'VIRTUAL',
    }, mockUsuarioCiudadano, ['CIUDADANO'], mockSolicitanteId)).rejects.toThrow(ForbiddenError);
    expect(mockClient.query).not.toHaveBeenCalledWith('BEGIN');
  });

  describe('1. Prevención de pagos duplicados y generación de pago adicional', () => {
    it('1.1 Si el expediente ya cuenta con pago CONFIRMADO y no hay confirmación adicional, rechaza con 409 PAGO_YA_CONFIRMADO', async () => {
      const mockOrdenConfirmada = {
        orden_pago_id: mockOrdenPagoId1,
        codigo_pago: 'PAG-2026-000001',
        codigo_recibo: 'REC-2026-000001',
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        monto: '100.00',
        moneda: 'PEN',
        estado: 'CONFIRMADO' as const,
        tipo_orden: 'PRINCIPAL' as const,
        fecha_pago: new Date('2026-10-31T10:00:00Z'),
        fecha_creacion: new Date('2026-10-31T09:00:00Z'),
        fecha_vencimiento: new Date('2026-11-02T09:00:00Z'),
        concepto: 'Certificado de Estudios',
      };

      vi.spyOn(repository, 'obtenerOrdenActivaPorExpediente').mockResolvedValue(mockOrdenConfirmada as any);
      vi.spyOn(repository, 'obtenerOrdenesPorExpediente').mockResolvedValue([mockOrdenConfirmada as any]);

      await expect(
        service.generarOrdenPago(mockExpedienteId, mockUsuarioMesa, ['MESA_PARTES']),
      ).rejects.toThrow(ConflictError);

      try {
        await service.generarOrdenPago(mockExpedienteId, mockUsuarioMesa, ['MESA_PARTES']);
      } catch (err: any) {
        expect(err.code).toBe('PAGO_YA_CONFIRMADO');
        const detail = JSON.parse(err.detail);
        expect(detail.codigoRecibo).toBe('REC-2026-000001');
        expect(detail.requiereConfirmacionAdicional).toBe(true);
        expect(detail.totalPagado).toBe(100);
      }
    });

    it('1.2 Pago adicional con confirmación explícita pero sin motivo válido lanza ValidationError', async () => {
      const mockOrdenConfirmada = {
        orden_pago_id: mockOrdenPagoId1,
        codigo_pago: 'PAG-2026-000001',
        codigo_recibo: 'REC-2026-000001',
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        monto: '100.00',
        estado: 'CONFIRMADO' as const,
        tipo_orden: 'PRINCIPAL' as const,
        fecha_creacion: new Date(),
        fecha_vencimiento: new Date(Date.now() + 86400000),
        fecha_pago: new Date(),
        concepto: 'Certificado de Estudios',
      };

      vi.spyOn(repository, 'obtenerOrdenActivaPorExpediente').mockResolvedValue(mockOrdenConfirmada as any);
      vi.spyOn(repository, 'obtenerOrdenesPorExpediente').mockResolvedValue([mockOrdenConfirmada as any]);

      await expect(
        service.generarOrdenPago(mockExpedienteId, mockUsuarioMesa, ['MESA_PARTES'], undefined, {
          confirmarPagoAdicional: true,
          motivoAdicional: 'abc', // menor a 5 caracteres
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('1.3 Pago adicional con confirmación explícita y motivo genera orden ADICIONAL', async () => {
      const mockOrdenConfirmada = {
        orden_pago_id: mockOrdenPagoId1,
        codigo_pago: 'PAG-2026-000001',
        codigo_recibo: 'REC-2026-000001',
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        monto: '100.00',
        estado: 'CONFIRMADO' as const,
        tipo_orden: 'PRINCIPAL' as const,
        fecha_creacion: new Date(),
        fecha_vencimiento: new Date(Date.now() + 86400000),
        fecha_pago: new Date(),
        concepto: 'Certificado de Estudios',
      };

      vi.spyOn(repository, 'obtenerOrdenActivaPorExpediente').mockResolvedValue(mockOrdenConfirmada as any);
      vi.spyOn(repository, 'obtenerOrdenesPorExpediente').mockResolvedValue([mockOrdenConfirmada as any]);
      vi.spyOn(repository, 'obtenerSiguienteCodigoPago').mockResolvedValue('PAG-2026-000002');

      const mockFechaVence = new Date(Date.now() + 48 * 3600 * 1000);
      vi.spyOn(repository, 'insertarOrdenPago').mockResolvedValue({
        orden_pago_id: mockOrdenPagoId2,
        codigo_pago: 'PAG-2026-000002',
        expediente_id: mockExpedienteId,
        registro_version_id: 'r0000000-0000-4000-8000-000000000001',
        solicitante_id: mockSolicitanteId,
        concepto: 'Pago Adicional: Certificado de Estudios',
        codigo_tupa: 'TUPA-01',
        monto: '100.00',
        moneda: 'PEN',
        estado: 'PENDIENTE' as const,
        tipo_orden: 'ADICIONAL' as const,
        motivo_adicional: 'Pago complementario por copia adicional autorizada',
        metodo_pago: null,
        referencia_operacion: null,
        monto_recibido: null,
        vuelto: null,
        codigo_recibo: null,
        fecha_creacion: new Date(),
        fecha_vencimiento: mockFechaVence,
        fecha_pago: null,
        tesorero_id: null,
        motivo_rechazo: null,
        observacion: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValue({
        orden_pago_id: mockOrdenPagoId2,
        codigo_pago: 'PAG-2026-000002',
        expediente_id: mockExpedienteId,
        registro_version_id: 'r0000000-0000-4000-8000-000000000001',
        solicitante_id: mockSolicitanteId,
        concepto: 'Pago Adicional: Certificado de Estudios',
        codigo_tupa: 'TUPA-01',
        monto: '100.00',
        moneda: 'PEN',
        estado: 'PENDIENTE' as const,
        tipo_orden: 'ADICIONAL' as const,
        motivo_adicional: 'Pago complementario por copia adicional autorizada',
        metodo_pago: null,
        referencia_operacion: null,
        monto_recibido: null,
        vuelto: null,
        codigo_recibo: null,
        fecha_creacion: new Date(),
        fecha_vencimiento: mockFechaVence,
        fecha_pago: null,
        tesorero_id: null,
        motivo_rechazo: null,
        observacion: null,
        created_at: new Date(),
        updated_at: new Date(),
        codigo_expediente: 'EXP-2026-000001',
        numero_documento_solicitante: '99000001',
        nombre_solicitante: 'Geric Demo',
      });

      const ordenAdicional = await service.generarOrdenPago(
        mockExpedienteId,
        mockUsuarioMesa,
        ['MESA_PARTES'],
        undefined,
        {
          confirmarPagoAdicional: true,
          motivoAdicional: 'Pago complementario por copia adicional autorizada',
        },
      );

      expect(ordenAdicional.codigoPago).toBe('PAG-2026-000002');
      expect(ordenAdicional.tipoOrden).toBe('ADICIONAL');
      expect(ordenAdicional.motivoAdicional).toBe('Pago complementario por copia adicional autorizada');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('1.4 Idempotencia en pagos adicionales: si ya existe una orden ADICIONAL pendiente, no la duplica', async () => {
      const mockOrdenConfirmada = {
        orden_pago_id: mockOrdenPagoId1,
        codigo_pago: 'PAG-2026-000001',
        codigo_recibo: 'REC-2026-000001',
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        monto: '100.00',
        estado: 'CONFIRMADO' as const,
        tipo_orden: 'PRINCIPAL' as const,
        fecha_creacion: new Date(),
        fecha_vencimiento: new Date(Date.now() + 86400000),
        fecha_pago: new Date(),
        concepto: 'Certificado de Estudios',
      };

      const mockAdicionalPendiente = {
        orden_pago_id: mockOrdenPagoId2,
        codigo_pago: 'PAG-2026-000002',
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        monto: '100.00',
        estado: 'PENDIENTE' as const,
        tipo_orden: 'ADICIONAL' as const,
        fecha_creacion: new Date(),
        fecha_vencimiento: new Date(Date.now() + 86400000),
        fecha_pago: null,
        concepto: 'Pago Adicional: Certificado de Estudios',
        motivo_adicional: 'Pago complementario previo',
      };

      vi.spyOn(repository, 'obtenerOrdenActivaPorExpediente').mockResolvedValue(mockAdicionalPendiente as any);
      vi.spyOn(repository, 'obtenerOrdenesPorExpediente').mockResolvedValue([
        mockOrdenConfirmada as any,
        mockAdicionalPendiente as any,
      ]);

      const orden = await service.generarOrdenPago(
        mockExpedienteId,
        mockUsuarioMesa,
        ['MESA_PARTES'],
        undefined,
        {
          confirmarPagoAdicional: true,
          motivoAdicional: 'Reintento de pago complementario',
        },
      );

      expect(orden.codigoPago).toBe('PAG-2026-000002');
      expect(orden.tipoOrden).toBe('ADICIONAL');
      // No debe iniciar nueva transacción ya que retorna idempotente
      expect(mockClient.query).not.toHaveBeenCalledWith('BEGIN');
    });
  });

  describe('2. Saldos y Detección de Sobrepagos', () => {
    it('2.1 Calcula correctamente saldos cuando totalPagado > costoOficial (detecta posibleSobrepago = true)', async () => {
      const orden1 = {
        orden_pago_id: mockOrdenPagoId1,
        codigo_pago: 'PAG-2026-000001',
        codigo_recibo: 'REC-2026-000001',
        monto: '100.00',
        estado: 'CONFIRMADO' as const,
        tipo_orden: 'PRINCIPAL' as const,
        fecha_pago: new Date('2026-10-31T10:00:00Z'),
      };
      const orden2 = {
        orden_pago_id: mockOrdenPagoId2,
        codigo_pago: 'PAG-2026-000002',
        codigo_recibo: 'REC-2026-000002',
        monto: '100.00',
        estado: 'CONFIRMADO' as const,
        tipo_orden: 'ADICIONAL' as const,
        fecha_pago: new Date('2026-10-31T11:00:00Z'),
      };

      vi.spyOn(repository, 'obtenerOrdenesPorExpediente').mockResolvedValue([orden1 as any, orden2 as any]);
      vi.spyOn(repository, 'listarDevolucionesPorExpediente').mockResolvedValue([]);
      vi.spyOn(repository, 'calcularSaldoDevolviblePago').mockResolvedValue(100);

      const saldos = await service.calcularSaldosExpediente(mockExpedienteId, ['MESA_PARTES']);

      expect(saldos.costoOficial).toBe(100);
      expect(saldos.totalPagado).toBe(200);
      expect(saldos.diferencia).toBe(100);
      expect(saldos.posibleSobrepago).toBe(true);
      expect(saldos.ordenes).toHaveLength(2);
      expect(saldos.ordenes[0].saldoDevolvible).toBe(100);
    });

    it('2.2 BOLA: Ciudadano ajeno al expediente no puede consultar saldos (403 Forbidden)', async () => {
      await expect(
        service.calcularSaldosExpediente(mockExpedienteId, ['CIUDADANO'], 'persona-ajena-uuid'),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('3. Flujo de Devoluciones (FSM) y Reserva de Saldo', () => {
    it('3.1 Solicitar devolución sobre pago CONFIRMADO genera código DEV-YYYY-NNNNNN', async () => {
      vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValue({
        orden_pago_id: mockOrdenPagoId1,
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        monto: '100.00',
        estado: 'CONFIRMADO' as const,
      } as any);

      vi.spyOn(repository, 'calcularSaldoDevolviblePago').mockResolvedValue(100);
      vi.spyOn(repository, 'obtenerSolicitudDevolucionActivaPorOrden').mockResolvedValue(null);
      vi.spyOn(repository, 'obtenerSiguienteCodigoDev').mockResolvedValue('DEV-2026-000001');

      vi.spyOn(repository, 'insertarSolicitudDevolucion').mockResolvedValue({
        solicitud_devolucion_id: mockSolicitudDevId,
        codigo_dev: 'DEV-2026-000001',
        expediente_id: mockExpedienteId,
        orden_pago_id: mockOrdenPagoId1,
        solicitante_id: mockSolicitanteId,
        cuenta_usuario_id: mockUsuarioCiudadano,
        canal_registro: 'VIRTUAL',
        causal: 'SOBREPAGO',
        motivo: 'Se realizó un pago duplicado por error de conectividad bancaria.',
        monto_original: '100.00',
        monto_solicitado: '100.00',
        monto_autorizado: null,
        monto_devuelto: null,
        estado: 'SOLICITADA',
        fecha_solicitud: new Date(),
        fecha_aprobacion: null,
        aprobado_por_id: null,
        fecha_devolucion: null,
        procesado_por_id: null,
        metodo_devolucion: null,
        constancia_devolucion_codigo: null,
        motivo_observacion: null,
        motivo_rechazo: null,
        observacion_resolucion: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorId').mockResolvedValue({
        solicitud_devolucion_id: mockSolicitudDevId,
        codigo_dev: 'DEV-2026-000001',
        expediente_id: mockExpedienteId,
        orden_pago_id: mockOrdenPagoId1,
        solicitante_id: mockSolicitanteId,
        cuenta_usuario_id: mockUsuarioCiudadano,
        canal_registro: 'VIRTUAL',
        causal: 'SOBREPAGO',
        motivo: 'Se realizó un pago duplicado por error de conectividad bancaria.',
        monto_original: '100.00',
        monto_solicitado: '100.00',
        monto_autorizado: null,
        monto_devuelto: null,
        estado: 'SOLICITADA',
        fecha_solicitud: new Date(),
        fecha_aprobacion: null,
        aprobado_por_id: null,
        fecha_devolucion: null,
        procesado_por_id: null,
        metodo_devolucion: null,
        constancia_devolucion_codigo: null,
        motivo_observacion: null,
        motivo_rechazo: null,
        observacion_resolucion: null,
        created_at: new Date(),
        updated_at: new Date(),
        codigo_expediente: 'EXP-2026-000001',
        codigo_pago: 'PAG-2026-000001',
        codigo_recibo: 'REC-2026-000001',
        solicitante_nombre: 'Geric Demo',
        solicitante_documento: '99000001',
      });

      const res = await service.solicitarDevolucion(
        {
          expedienteId: mockExpedienteId,
          ordenPagoId: mockOrdenPagoId1,
          causal: 'SOBREPAGO',
          motivo: 'Se realizó un pago duplicado por error de conectividad bancaria.',
          montoSolicitado: 100,
          canalRegistro: 'VIRTUAL',
        },
        mockUsuarioCiudadano,
        ['CIUDADANO'],
        mockSolicitanteId,
      );

      expect(res.codigoDev).toBe('DEV-2026-000001');
      expect(res.estado).toBe('SOLICITADA');
      expect(res.montoSolicitado).toBe(100);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('3.2 Solicitar devolución que excede el saldo devolvible disponible lanza ValidationError', async () => {
      vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValue({
        orden_pago_id: mockOrdenPagoId1,
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        monto: '100.00',
        estado: 'CONFIRMADO' as const,
      } as any);

      // Saldo disponible solo es S/ 40 porque ya se autorizaron S/ 60
      vi.spyOn(repository, 'calcularSaldoDevolviblePago').mockResolvedValue(40);

      await expect(
        service.solicitarDevolucion(
          {
            expedienteId: mockExpedienteId,
            ordenPagoId: mockOrdenPagoId1,
            causal: 'SOBREPAGO',
            motivo: 'Intento de devolución de más saldo del disponible.',
            montoSolicitado: 50,
            canalRegistro: 'VIRTUAL',
          },
          mockUsuarioCiudadano,
          ['CIUDADANO'],
          mockSolicitanteId,
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('3.3 Si ya existe una solicitud en trámite para esa orden, rechaza con 409 DEVOLUCION_EN_TRAMITE', async () => {
      vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValue({
        orden_pago_id: mockOrdenPagoId1,
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        monto: '100.00',
        estado: 'CONFIRMADO' as const,
      } as any);

      vi.spyOn(repository, 'calcularSaldoDevolviblePago').mockResolvedValue(100);
      vi.spyOn(repository, 'obtenerSolicitudDevolucionActivaPorOrden').mockResolvedValue({
        codigo_dev: 'DEV-2026-000001',
        estado: 'SOLICITADA',
      } as any);

      await expect(
        service.solicitarDevolucion(
          {
            expedienteId: mockExpedienteId,
            ordenPagoId: mockOrdenPagoId1,
            causal: 'SOBREPAGO',
            motivo: 'Segunda solicitud simultánea indebida.',
            montoSolicitado: 50,
            canalRegistro: 'VIRTUAL',
          },
          mockUsuarioCiudadano,
          ['CIUDADANO'],
          mockSolicitanteId,
        ),
      ).rejects.toThrow(ConflictError);
    });

    it('3.4 Separación de Poderes: Tesorería NO puede autorizar devoluciones (403 Forbidden)', async () => {
      await expect(
        service.aprobarDevolucion(
          mockSolicitudDevId,
          100,
          'Aprobación indebida por Tesorería',
          mockUsuarioTesorero,
          ['TESORERIA'],
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('3.5 Aprobación por Mesa de Partes: reserva saldo y transiciona a PENDIENTE_TESORERIA', async () => {
      const mockSolicitud = {
        solicitud_devolucion_id: mockSolicitudDevId,
        codigo_dev: 'DEV-2026-000001',
        expediente_id: mockExpedienteId,
        orden_pago_id: mockOrdenPagoId1,
        solicitante_id: mockSolicitanteId,
        monto_original: '100.00',
        monto_solicitado: '100.00',
        estado: 'EN_REVISION' as const,
      };

      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorIdConLock').mockResolvedValue(mockSolicitud as any);
      vi.spyOn(repository, 'obtenerOrdenPorIdConLock').mockResolvedValue({
        orden_pago_id: mockOrdenPagoId1,
        monto: '100.00',
        estado: 'CONFIRMADO',
      } as any);
      vi.spyOn(repository, 'calcularSaldoDevolviblePago').mockResolvedValue(100);
      vi.spyOn(repository, 'actualizarSolicitudDevolucion').mockResolvedValue();

      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorId').mockResolvedValue({
        ...mockSolicitud,
        estado: 'PENDIENTE_TESORERIA',
        monto_autorizado: '100.00',
        monto_devuelto: null,
        fecha_solicitud: new Date(),
        fecha_aprobacion: new Date(),
        aprobado_por_id: mockUsuarioMesa,
        fecha_devolucion: null,
        procesado_por_id: null,
        metodo_devolucion: null,
        constancia_devolucion_codigo: null,
        motivo_observacion: null,
        motivo_rechazo: null,
        observacion_resolucion: 'Autorizado con Resolución Directorial N° 123-2026',
        created_at: new Date(),
        updated_at: new Date(),
        codigo_expediente: 'EXP-2026-000001',
        codigo_pago: 'PAG-2026-000001',
        codigo_recibo: 'REC-2026-000001',
        solicitante_nombre: 'Geric Demo',
        solicitante_documento: '99000001',
        aprobado_por_nombre: 'Operador Mesa Partes',
      } as any);

      const res = await service.aprobarDevolucion(
        mockSolicitudDevId,
        100,
        'Autorizado con Resolución Directorial N° 123-2026',
        mockUsuarioMesa,
        ['MESA_PARTES'],
      );

      expect(res.estado).toBe('PENDIENTE_TESORERIA');
      expect(res.montoAutorizado).toBe(100);
      expect(res.aprobadoPorNombre).toBe('Operador Mesa Partes');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('3.6 Separación de Poderes: Mesa de Partes NO puede ejecutar desembolsos (403 Forbidden)', async () => {
      await expect(
        service.ejecutarDevolucion(
          mockSolicitudDevId,
          'TRANSFERENCIA',
          'Intento de desembolso por Mesa',
          mockUsuarioMesa,
          ['MESA_PARTES'],
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('3.7 Ejecución por Tesorería: emite CDEV-YYYY-NNNNNN, transiciona a DEVUELTA y mantiene PAG y REC intactos', async () => {
      const mockSolicitudAprobada = {
        solicitud_devolucion_id: mockSolicitudDevId,
        codigo_dev: 'DEV-2026-000001',
        expediente_id: mockExpedienteId,
        orden_pago_id: mockOrdenPagoId1,
        solicitante_id: mockSolicitanteId,
        monto_original: '100.00',
        monto_solicitado: '100.00',
        monto_autorizado: '100.00',
        estado: 'PENDIENTE_TESORERIA' as const,
        observacion_resolucion: 'Aprobado por Mesa',
      };

      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorIdConLock').mockResolvedValue(mockSolicitudAprobada as any);
      vi.spyOn(repository, 'obtenerSiguienteCodigoCdev').mockResolvedValue('CDEV-2026-000001');
      vi.spyOn(repository, 'actualizarSolicitudDevolucion').mockResolvedValue();

      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorId').mockResolvedValue({
        ...mockSolicitudAprobada,
        estado: 'DEVUELTA',
        monto_devuelto: '100.00',
        fecha_solicitud: new Date(),
        fecha_aprobacion: new Date(),
        aprobado_por_id: mockUsuarioMesa,
        fecha_devolucion: new Date(),
        procesado_por_id: mockUsuarioTesorero,
        metodo_devolucion: 'TRANSFERENCIA',
        constancia_devolucion_codigo: 'CDEV-2026-000001',
        motivo_observacion: null,
        motivo_rechazo: null,
        observacion_resolucion: 'Aprobado por Mesa\n[Tesorería]: Transferencia Banco de la Nación op 884732',
        created_at: new Date(),
        updated_at: new Date(),
        codigo_expediente: 'EXP-2026-000001',
        codigo_pago: 'PAG-2026-000001',
        codigo_recibo: 'REC-2026-000001',
        solicitante_nombre: 'Geric Demo',
        solicitante_documento: '99000001',
        procesado_por_nombre: 'Tesorero General',
      } as any);

      const res = await service.ejecutarDevolucion(
        mockSolicitudDevId,
        'TRANSFERENCIA',
        'Transferencia Banco de la Nación op 884732',
        mockUsuarioTesorero,
        ['TESORERIA'],
      );

      expect(res.estado).toBe('DEVUELTA');
      expect(res.constanciaDevolucionCodigo).toBe('CDEV-2026-000001');
      expect(res.montoDevuelto).toBe(100);
      expect(res.metodoDevolucion).toBe('TRANSFERENCIA');
      expect(res.procesadoPorNombre).toBe('Tesorero General');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('3.8 Observación y Subsanación: FSM EN_REVISION -> OBSERVADA -> SUBSANADA', async () => {
      // 1. Pasar a revisión
      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorIdConLock').mockResolvedValueOnce({
        solicitud_devolucion_id: mockSolicitudDevId,
        estado: 'SOLICITADA',
      } as any);
      vi.spyOn(repository, 'actualizarSolicitudDevolucion').mockResolvedValue();
      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorId').mockResolvedValueOnce({
        solicitud_devolucion_id: mockSolicitudDevId,
        codigo_dev: 'DEV-2026-000001',
        estado: 'EN_REVISION',
        fecha_solicitud: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const rev = await service.revisarDevolucion(mockSolicitudDevId, mockUsuarioMesa, ['MESA_PARTES']);
      expect(rev.estado).toBe('EN_REVISION');

      // 2. Observar por Mesa
      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorIdConLock').mockResolvedValueOnce({
        solicitud_devolucion_id: mockSolicitudDevId,
        estado: 'EN_REVISION',
      } as any);
      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorId').mockResolvedValueOnce({
        solicitud_devolucion_id: mockSolicitudDevId,
        codigo_dev: 'DEV-2026-000001',
        estado: 'OBSERVADA',
        motivo_observacion: 'Falta adjuntar voucher bancario original legible',
        fecha_solicitud: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const obs = await service.observarDevolucion(
        mockSolicitudDevId,
        'Falta adjuntar voucher bancario original legible',
        mockUsuarioMesa,
        ['MESA_PARTES'],
      );
      expect(obs.estado).toBe('OBSERVADA');
      expect(obs.motivoObservacion).toBe('Falta adjuntar voucher bancario original legible');

      // 3. Subsanar por Ciudadano
      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorIdConLock').mockResolvedValueOnce({
        solicitud_devolucion_id: mockSolicitudDevId,
        solicitante_id: mockSolicitanteId,
        estado: 'OBSERVADA',
        motivo_observacion: 'Falta adjuntar voucher bancario original legible',
      } as any);
      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorId').mockResolvedValueOnce({
        solicitud_devolucion_id: mockSolicitudDevId,
        codigo_dev: 'DEV-2026-000001',
        estado: 'SUBSANADA',
        fecha_solicitud: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const sub = await service.subsanarDevolucion(
        mockSolicitudDevId,
        'Se adjunta copia nítida del voucher de operación BN N° 998822',
        mockUsuarioCiudadano,
        ['CIUDADANO'],
        mockSolicitanteId,
      );
      expect(sub.estado).toBe('SUBSANADA');
    });
  });

  describe('4. Validación de Causal PAGO_DUPLICADO', () => {
    it('4.1 Schema acepta PAGO_DUPLICADO como causal válida', () => {
      const resultado = solicitarDevolucionSchema.safeParse({
        expedienteId: 'a0000000-0000-4000-8000-000000000001',
        ordenPagoId: 'b0000000-0000-4000-8000-000000000001',
        causal: 'PAGO_DUPLICADO',
        motivo: 'El trámite recibió dos pagos confirmados por error del operador.',
        montoSolicitado: 100,
      });
      expect(resultado.success).toBe(true);
    });

    it('4.2 Schema rechaza causal desconocida', () => {
      const resultado = solicitarDevolucionSchema.safeParse({
        expedienteId: 'a0000000-0000-4000-8000-000000000001',
        ordenPagoId: 'b0000000-0000-4000-8000-000000000001',
        causal: 'CAUSAL_INEXISTENTE' as any,
        motivo: 'Motivo de prueba.',
        montoSolicitado: 50,
      });
      expect(resultado.success).toBe(false);
    });

    it('4.3 PAGO_DUPLICADO sin evidencia de múltiples pagos confirmados es rechazado', async () => {
      // Solo una orden confirmada en el expediente → no cumple evidencia
      vi.spyOn(repository, 'obtenerOrdenesPorExpediente').mockResolvedValue([
        {
          orden_pago_id: mockOrdenPagoId1,
          estado: 'CONFIRMADO',
          monto: '100.00',
          expediente_id: mockExpedienteId,
        } as any,
      ]);
      vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValue({
        orden_pago_id: mockOrdenPagoId1,
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        monto: '100.00',
        estado: 'CONFIRMADO',
      } as any);
      vi.spyOn(repository, 'calcularSaldoDevolviblePago').mockResolvedValue(100);

      await expect(
        service.solicitarDevolucion(
          {
            expedienteId: mockExpedienteId,
            ordenPagoId: mockOrdenPagoId1,
            causal: 'PAGO_DUPLICADO',
            motivo: 'El trámite recibió dos pagos confirmados por error del operador.',
            montoSolicitado: 100,
            canalRegistro: 'VIRTUAL',
          },
          mockUsuarioCiudadano,
          ['CIUDADANO'],
          mockSolicitanteId,
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('4.4 PAGO_INDEBIDO sigue siendo aceptado como causal independiente', async () => {
      vi.spyOn(repository, 'obtenerOrdenesPorExpediente').mockResolvedValue([
        {
          orden_pago_id: mockOrdenPagoId1,
          estado: 'CONFIRMADO',
          monto: '100.00',
          expediente_id: mockExpedienteId,
        } as any,
      ]);
      vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValue({
        orden_pago_id: mockOrdenPagoId1,
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        monto: '100.00',
        estado: 'CONFIRMADO',
      } as any);
      vi.spyOn(repository, 'calcularSaldoDevolviblePago').mockResolvedValue(100);
      vi.spyOn(repository, 'obtenerSolicitudDevolucionActivaPorOrden').mockResolvedValue(null);
      vi.spyOn(repository, 'obtenerSiguienteCodigoDev').mockResolvedValue('DEV-2026-000003');
      vi.spyOn(repository, 'insertarSolicitudDevolucion').mockResolvedValue({
        solicitud_devolucion_id: mockSolicitudDevId,
        codigo_dev: 'DEV-2026-000003',
        expediente_id: mockExpedienteId,
        orden_pago_id: mockOrdenPagoId1,
        solicitante_id: mockSolicitanteId,
        cuenta_usuario_id: mockUsuarioCiudadano,
        canal_registro: 'VIRTUAL',
        causal: 'PAGO_INDEBIDO',
        motivo: 'Pago sin causa legal.',
        monto_original: '100.00',
        monto_solicitado: '100.00',
        monto_autorizado: null,
        monto_devuelto: null,
        estado: 'SOLICITADA',
        fecha_solicitud: new Date(),
        fecha_aprobacion: null,
        aprobado_por_id: null,
        fecha_devolucion: null,
        procesado_por_id: null,
        metodo_devolucion: null,
        constancia_devolucion_codigo: null,
        motivo_observacion: null,
        motivo_rechazo: null,
        observacion_resolucion: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      const res = await service.solicitarDevolucion(
        {
          expedienteId: mockExpedienteId,
          ordenPagoId: mockOrdenPagoId1,
          causal: 'PAGO_INDEBIDO',
          motivo: 'Pago sin causa legal.',
          montoSolicitado: 100,
          canalRegistro: 'VIRTUAL',
        },
        mockUsuarioCiudadano,
        ['CIUDADANO'],
        mockSolicitanteId,
      );

      expect(res.causal).toBe('PAGO_INDEBIDO');
      expect(res.estado).toBe('SOLICITADA');
    });
  });
});

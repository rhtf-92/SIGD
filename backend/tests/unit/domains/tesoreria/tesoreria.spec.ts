import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { TesoreriaService } from '../../../../src/domains/tesoreria/tesoreria.service.js';
import { TesoreriaRepository } from '../../../../src/domains/tesoreria/tesoreria.repository.js';
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

describe('SIGD 2026 — MVP Tesorería: Pruebas Unitarias de Dominio y Seguridad', () => {
  let mockPool: Pool;
  let mockClient: PoolClient;
  let repository: TesoreriaRepository;
  let service: TesoreriaService;

  const mockExpedienteId = 'e0000000-0000-4000-8000-000000000001';
  const mockSolicitanteId = 's0000000-0000-4000-8000-000000000001';
  const mockTesoreroId = 'u0000000-0000-4000-8000-000000000002';
  const mockOrdenPagoId = 'p0000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    } as unknown as PoolClient;

    mockPool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    repository = new TesoreriaRepository();
    service = new TesoreriaService(mockPool, repository);
  });

  describe('1. Generación de Órdenes de Pago (TUPA Server-Side & Idempotencia)', () => {
    it('1.1 TUPA con costo genera orden con código PAG-YYYY-NNNNNN y monto oficial server-side', async () => {
      vi.spyOn(repository, 'obtenerContextoExpedienteParaPago').mockResolvedValueOnce({
        expedienteId: mockExpedienteId,
        codigoExpediente: 'EXP-2026-000001',
        solicitanteId: mockSolicitanteId,
        tipoDocumento: 'DNI',
        numeroDocumento: '99000001',
        nombreSolicitante: 'Geric Demo',
        costoOficial: 100.0,
        concepto: 'Certificado de Inglés',
        codigoTupa: 'p1-fila-06',
        registroVersionId: 'r0000000-0000-4000-8000-000000000001',
      });

      vi.spyOn(repository, 'obtenerOrdenActivaPorExpediente').mockResolvedValueOnce(null);
      vi.spyOn(repository, 'obtenerSiguienteCodigoPago').mockResolvedValueOnce('PAG-2026-000001');

      const mockFechaVence = new Date(Date.now() + 48 * 3600 * 1000);
      vi.spyOn(repository, 'insertarOrdenPago').mockResolvedValueOnce({
        orden_pago_id: mockOrdenPagoId,
        codigo_pago: 'PAG-2026-000001',
        expediente_id: mockExpedienteId,
        registro_version_id: 'r0000000-0000-4000-8000-000000000001',
        solicitante_id: mockSolicitanteId,
        concepto: 'Certificado de Inglés',
        codigo_tupa: 'p1-fila-06',
        monto: '100.00',
        moneda: 'PEN',
        estado: 'PENDIENTE',
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

      vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValueOnce({
        orden_pago_id: mockOrdenPagoId,
        codigo_pago: 'PAG-2026-000001',
        expediente_id: mockExpedienteId,
        registro_version_id: 'r0000000-0000-4000-8000-000000000001',
        solicitante_id: mockSolicitanteId,
        concepto: 'Certificado de Inglés',
        codigo_tupa: 'p1-fila-06',
        monto: '100.00',
        moneda: 'PEN',
        estado: 'PENDIENTE',
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

      const orden = await service.generarOrdenPago(
        mockExpedienteId,
        'user-1',
        ['MESA_PARTES'],
      );

      expect(orden.codigoPago).toBe('PAG-2026-000001');
      expect(orden.monto).toBe(100);
      expect(orden.estado).toBe('PENDIENTE');
      expect(orden.concepto).toBe('Certificado de Inglés');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('1.2 Trámite gratuito (costo <= 0) NO genera orden y lanza ConflictError (EXPEDIENTE_SIN_COSTO)', async () => {
      vi.spyOn(repository, 'obtenerContextoExpedienteParaPago').mockResolvedValueOnce({
        expedienteId: mockExpedienteId,
        codigoExpediente: 'EXP-2026-000002',
        solicitanteId: mockSolicitanteId,
        tipoDocumento: 'DNI',
        numeroDocumento: '99000001',
        nombreSolicitante: 'Geric Demo',
        costoOficial: 0.0,
        concepto: 'Solicitud Gratuita',
        codigoTupa: null,
        registroVersionId: null,
      });

      await expect(
        service.generarOrdenPago(mockExpedienteId, 'user-1', ['MESA_PARTES']),
      ).rejects.toThrow(ConflictError);
    });

    it('1.3 Doble clic / reintento con orden PENDIENTE vigente es IDEMPOTENTE y no duplica', async () => {
      vi.spyOn(repository, 'obtenerContextoExpedienteParaPago').mockResolvedValueOnce({
        expedienteId: mockExpedienteId,
        codigoExpediente: 'EXP-2026-000001',
        solicitanteId: mockSolicitanteId,
        tipoDocumento: 'DNI',
        numeroDocumento: '99000001',
        nombreSolicitante: 'Geric Demo',
        costoOficial: 100.0,
        concepto: 'Certificado de Inglés',
        codigoTupa: 'p1-fila-06',
        registroVersionId: 'r0000000-0000-4000-8000-000000000001',
      });

      const ordenVigente: any = {
        orden_pago_id: mockOrdenPagoId,
        codigo_pago: 'PAG-2026-000001',
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        concepto: 'Certificado de Inglés',
        monto: 100.0,
        moneda: 'PEN',
        estado: 'PENDIENTE',
        fecha_creacion: new Date(),
        fecha_vencimiento: new Date(Date.now() + 24 * 3600 * 1000), // Vence mañana
      };

      vi.spyOn(repository, 'obtenerOrdenActivaPorExpediente').mockResolvedValueOnce(ordenVigente);

      const resultado = await service.generarOrdenPago(
        mockExpedienteId,
        'user-1',
        ['MESA_PARTES'],
      );

      expect(resultado.ordenPagoId).toBe(mockOrdenPagoId);
      expect(resultado.codigoPago).toBe('PAG-2026-000001');
      // No debe haber abierto transacción de inserción
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('reintento concurrente recupera la orden ganadora tras la restricción única', async () => {
      vi.spyOn(repository, 'obtenerContextoExpedienteParaPago').mockResolvedValue({
        expedienteId: mockExpedienteId, codigoExpediente: 'EXP-2026-000001',
        solicitanteId: mockSolicitanteId, tipoDocumento: 'DNI', numeroDocumento: '99000001',
        nombreSolicitante: 'Geric Demo', costoOficial: 100, concepto: 'Certificado de Inglés',
        codigoTupa: 'p1-fila-06', registroVersionId: null,
      });
      vi.spyOn(repository, 'obtenerOrdenActivaPorExpediente')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ orden_pago_id: mockOrdenPagoId, codigo_pago: 'PAG-2026-000001',
          expediente_id: mockExpedienteId, solicitante_id: mockSolicitanteId, monto: 100,
          estado: 'PENDIENTE', fecha_vencimiento: new Date(Date.now() + 3600000),
        } as never);
      vi.spyOn(repository, 'obtenerSiguienteCodigoPago').mockResolvedValue('PAG-2026-000002');
      vi.spyOn(repository, 'insertarOrdenPago').mockRejectedValue(Object.assign(new Error('duplicada'), {
        code: '23505', constraint: 'uq_tra_orden_pago_activa_expediente',
      }));
      const orden = await service.generarOrdenPago(mockExpedienteId, 'user-1', ['MESA_PARTES']);
      expect(orden.codigoPago).toBe('PAG-2026-000001');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('1.4 Expediente con pago CONFIRMADO rechaza generación de nueva orden (409 Conflict)', async () => {
      vi.spyOn(repository, 'obtenerContextoExpedienteParaPago').mockResolvedValueOnce({
        expedienteId: mockExpedienteId,
        codigoExpediente: 'EXP-2026-000001',
        solicitanteId: mockSolicitanteId,
        tipoDocumento: 'DNI',
        numeroDocumento: '99000001',
        nombreSolicitante: 'Geric Demo',
        costoOficial: 100.0,
        concepto: 'Certificado de Inglés',
        codigoTupa: 'p1-fila-06',
        registroVersionId: 'r0000000-0000-4000-8000-000000000001',
      });

      vi.spyOn(repository, 'obtenerOrdenActivaPorExpediente').mockResolvedValueOnce({
        orden_pago_id: mockOrdenPagoId,
        codigo_pago: 'PAG-2026-000001',
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        concepto: 'Certificado de Inglés',
        monto: 100.0,
        moneda: 'PEN',
        estado: 'CONFIRMADO',
        fecha_creacion: new Date(),
        fecha_vencimiento: new Date(),
      } as any);

      await expect(
        service.generarOrdenPago(mockExpedienteId, 'user-1', ['MESA_PARTES']),
      ).rejects.toThrow(ConflictError);
    });

    it('1.5 BOLA: Ciudadano A no puede generar orden sobre expediente de ciudadano B', async () => {
      vi.spyOn(repository, 'obtenerContextoExpedienteParaPago').mockResolvedValueOnce({
        expedienteId: mockExpedienteId,
        codigoExpediente: 'EXP-2026-000001',
        solicitanteId: mockSolicitanteId, // Persona real del expediente
        tipoDocumento: 'DNI',
        numeroDocumento: '99000001',
        nombreSolicitante: 'Geric Demo',
        costoOficial: 100.0,
        concepto: 'Certificado de Inglés',
        codigoTupa: 'p1-fila-06',
        registroVersionId: null,
      });

      // El usuario en sesión tiene personaId ajena
      const personaAjena = 'persona-ajena-uuid';

      await expect(
        service.generarOrdenPago(
          mockExpedienteId,
          'user-ajeno',
          ['CIUDADANO'],
          personaAjena,
        ),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('2. Confirmación de Pagos (Efectivo & Yape Asistido)', () => {
    const ordenBase: any = {
      orden_pago_id: mockOrdenPagoId,
      codigo_pago: 'PAG-2026-000001',
      expediente_id: mockExpedienteId,
      solicitante_id: mockSolicitanteId,
      concepto: 'Certificado de Inglés',
      monto: '100.00',
      moneda: 'PEN',
      estado: 'PENDIENTE',
      fecha_creacion: new Date(),
      fecha_vencimiento: new Date(Date.now() + 24 * 3600 * 1000), // Vigente
    };

    it('2.1 Pago en EFECTIVO exitoso calcula vuelto y genera código REC-YYYY-NNNNNN', async () => {
      vi.spyOn(repository, 'obtenerOrdenPorIdConLock').mockResolvedValueOnce({ ...ordenBase });
      vi.spyOn(repository, 'obtenerSiguienteCodigoRecibo').mockResolvedValueOnce('REC-2026-000001');
      vi.spyOn(repository, 'actualizarOrdenAConfirmada').mockResolvedValueOnce();

      vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValueOnce({
        ...ordenBase,
        estado: 'CONFIRMADO',
        metodo_pago: 'EFECTIVO',
        monto_recibido: '150.00',
        vuelto: '50.00',
        codigo_recibo: 'REC-2026-000001',
        fecha_pago: new Date(),
        tesorero_id: mockTesoreroId,
      });

      const resultado = await service.confirmarPago(
        mockOrdenPagoId,
        { metodoPago: 'EFECTIVO', montoRecibido: 150 },
        mockTesoreroId,
      );

      expect(resultado.estado).toBe('CONFIRMADO');
      expect(resultado.metodoPago).toBe('EFECTIVO');
      expect(resultado.montoRecibido).toBe(150);
      expect(resultado.vuelto).toBe(50);
      expect(resultado.codigoRecibo).toBe('REC-2026-000001');

      // Desbloqueo del expediente a REGISTRADO ejecutado en transacción
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("SET estado = 'REGISTRADO'"),
        [mockExpedienteId],
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('2.2 Pago en EFECTIVO con monto recibido menor al oficial es rechazado con ValidationError', async () => {
      vi.spyOn(repository, 'obtenerOrdenPorIdConLock').mockResolvedValueOnce({ ...ordenBase });

      await expect(
        service.confirmarPago(
          mockOrdenPagoId,
          { metodoPago: 'EFECTIVO', montoRecibido: 80 },
          mockTesoreroId,
        ),
      ).rejects.toThrow(ValidationError);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('2.3 Pago con YAPE exige número de operación válido y registra método YAPE', async () => {
      vi.spyOn(repository, 'obtenerOrdenPorIdConLock').mockResolvedValueOnce({ ...ordenBase });
      vi.spyOn(repository, 'obtenerSiguienteCodigoRecibo').mockResolvedValueOnce('REC-2026-000002');
      vi.spyOn(repository, 'actualizarOrdenAConfirmada').mockResolvedValueOnce();

      vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValueOnce({
        ...ordenBase,
        estado: 'CONFIRMADO',
        metodo_pago: 'YAPE',
        referencia_operacion: 'YAPE-889911',
        monto_recibido: '100.00',
        vuelto: '0.00',
        codigo_recibo: 'REC-2026-000002',
        fecha_pago: new Date(),
        tesorero_id: mockTesoreroId,
      });

      const resultado = await service.confirmarPago(
        mockOrdenPagoId,
        { metodoPago: 'YAPE', referenciaOperacion: 'YAPE-889911' },
        mockTesoreroId,
      );

      expect(resultado.estado).toBe('CONFIRMADO');
      expect(resultado.metodoPago).toBe('YAPE');
      expect(resultado.referenciaOperacion).toBe('YAPE-889911');
      expect(resultado.codigoRecibo).toBe('REC-2026-000002');
    });

    it('2.4 Pago con YAPE sin referencia lanza ValidationError', async () => {
      vi.spyOn(repository, 'obtenerOrdenPorIdConLock').mockResolvedValueOnce({ ...ordenBase });

      await expect(
        service.confirmarPago(
          mockOrdenPagoId,
          { metodoPago: 'YAPE', referenciaOperacion: '' },
          mockTesoreroId,
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('2.5 Doble confirmación concurrente es rechazada (409 Conflict: ORDEN_NO_PENDIENTE)', async () => {
      // Simula que otra transacción ya confirmó la orden
      vi.spyOn(repository, 'obtenerOrdenPorIdConLock').mockResolvedValueOnce({
        ...ordenBase,
        estado: 'CONFIRMADO',
      });

      await expect(
        service.confirmarPago(
          mockOrdenPagoId,
          { metodoPago: 'EFECTIVO', montoRecibido: 100 },
          mockTesoreroId,
        ),
      ).rejects.toThrow(ConflictError);
    });

    it('2.6 Orden VENCIDA es rechazada al intentar confirmar (409 Conflict: ORDEN_VENCIDA)', async () => {
      vi.spyOn(repository, 'obtenerOrdenPorIdConLock').mockResolvedValueOnce({
        ...ordenBase,
        fecha_vencimiento: new Date(Date.now() - 3600 * 1000), // Venció hace 1 hora
      });
      vi.spyOn(repository, 'marcarOrdenVencida').mockResolvedValueOnce();

      await expect(
        service.confirmarPago(
          mockOrdenPagoId,
          { metodoPago: 'EFECTIVO', montoRecibido: 100 },
          mockTesoreroId,
        ),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('3. Rechazo de Pagos con Motivo', () => {
    it('3.1 Rechazo formal actualiza estado a RECHAZADO y almacena motivo descriptivo', async () => {
      vi.spyOn(repository, 'obtenerOrdenPorIdConLock').mockResolvedValueOnce({
        orden_pago_id: mockOrdenPagoId,
        estado: 'PENDIENTE',
      } as any);

      vi.spyOn(repository, 'actualizarOrdenARechazada').mockResolvedValueOnce();
      vi.spyOn(repository, 'obtenerOrdenPorId').mockResolvedValueOnce({
        orden_pago_id: mockOrdenPagoId,
        codigo_pago: 'PAG-2026-000001',
        expediente_id: mockExpedienteId,
        solicitante_id: mockSolicitanteId,
        concepto: 'Certificado de Inglés',
        monto: '100.00',
        moneda: 'PEN',
        estado: 'RECHAZADO',
        motivo_rechazo: 'Operación Yape no encontrada en estado de cuenta.',
        fecha_creacion: new Date(),
        fecha_vencimiento: new Date(),
      } as any);

      const resultado = await service.rechazarPago(
        mockOrdenPagoId,
        'Operación Yape no encontrada en estado de cuenta.',
        mockTesoreroId,
      );

      expect(resultado.estado).toBe('RECHAZADO');
      expect(resultado.motivoRechazo).toBe('Operación Yape no encontrada en estado de cuenta.');
    });
  });

  describe('4. Búsqueda y Atención Presencial por Documento', () => {
    it('4.1 Consulta por DNI devuelve información minimizada y enmascarada', async () => {
      vi.spyOn(repository, 'buscarPersonaPorDocumento').mockResolvedValueOnce({
        idPersona: mockSolicitanteId,
        nombres: 'Geric',
        apellidos: 'Salas Ormeño',
        nombreCompleto: 'Geric Salas Ormeño',
        documentoEnmascarado: '•••••001',
        tipoDocumento: 'DNI',
        numeroDocumento: '99000001',
        tieneCuentaUsuario: true,
      });

      const resultado = await service.buscarPersonaParaAtencionPresencial(
        'DNI',
        '99000001',
        'operador-1',
      );

      expect(resultado.encontrada).toBe(true);
      expect(resultado.persona?.documentoEnmascarado).toBe('•••••001');
      expect(resultado.persona?.nombreCompleto).toBe('Geric Salas Ormeño');
    });

    it('4.2 Si documento no existe retorna encontrada: false sin exponer error técnico', async () => {
      vi.spyOn(repository, 'buscarPersonaPorDocumento').mockResolvedValueOnce(null);

      const resultado = await service.buscarPersonaParaAtencionPresencial(
        'DNI',
        '00000000',
        'operador-1',
      );

      expect(resultado.encontrada).toBe(false);
      expect(resultado.persona).toBeUndefined();
    });
  });
});

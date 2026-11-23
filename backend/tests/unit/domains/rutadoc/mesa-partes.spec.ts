import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import { recepcionarExpediente, rechazarExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { CalificacionAdministrativaService } from '../../../../src/domains/rutadoc/calificacion.service.js';
import { getRequestContext } from '../../../../src/shared/request-context/request-context.js';
import { ConflictError, ValidationError } from '../../../../src/shared/domain/errors/index.js';

vi.mock('../../../../src/shared/request-context/request-context.js', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({
  insertarEvento: vi.fn().mockResolvedValue('outbox-1'),
}));

vi.mock('../../../../src/audit/bitacora-auditoria.repository.js', () => ({
  registrarMutacion: vi.fn().mockResolvedValue(undefined),
}));

describe('Mesa de Partes - Suite Funcional y Regulatoria (LPAG)', () => {
  let mockCliente: PoolClient;
  let mockQuery: ReturnType<typeof vi.fn>;

  const mockExpedienteId = '11111111-1111-4111-8111-111111111111';
  const mockUsuarioId = '22222222-2222-4222-8222-222222222222';
  const mockAreaMp = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = vi.fn().mockImplementation((queryText: string) => {
      const q = typeof queryText === 'string' ? queryText.trim().toUpperCase() : '';
      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }
      return Promise.resolve({ rowCount: 0, rows: [] });
    });
    mockCliente = {
      query: mockQuery,
      release: vi.fn(),
    } as unknown as PoolClient;

    vi.mocked(getRequestContext).mockReturnValue({
      usuario_id: mockUsuarioId,
      unidad_organica_id: mockAreaMp,
      correlation_id: '44444444-4444-4444-8444-444444444444',
      ip_origen: '127.0.0.1',
      user_agent: 'vitest-test',
    });
  });

  describe('1. Recepción Formal y Cargo Oficial (4.1)', () => {
    it('emite el Cargo Oficial de Recepción con QR, Hash SHA-256 y correlativo al recepcionar un trámite', async () => {
      // 1. SELECT sin pago demo
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      // 2. SELECT expediente
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          expediente_id: mockExpedienteId,
          codigo_expediente: 'EXP-2026-000211',
          estado_actual: 'REGISTRADO',
          area_actual_id: mockAreaMp,
          secuencia: '1',
        }],
      });
      // 3. exigirSinPagoDemoPendiente
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      // 4. exigirExpedienteHabilitadoParaRecepcion (consulta asiento_registro)
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          canal_ingreso: 'MESA_VIRTUAL',
          fecha_asiento: new Date('2026-10-01T10:00:00Z'),
        }],
      });
      // 5. resolverOperadorParam
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ data_type: 'uuid' }] });
      // 6. INSERT movimiento_tramite
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id_movimiento: '55555555-5555-4555-8555-555555555555',
          secuencia: '2',
        }],
      });

      const resultado = await recepcionarExpediente(mockCliente, mockExpedienteId, {
        canalRecepcion: 'MESA_VIRTUAL',
        cantidadFolios: 5,
        cantidadDocumentos: 3,
        observaciones: 'Recepción formal Mesa de Partes',
        generarCargo: true,
      });

      expect(resultado.nuevoEstado).toBe('RECEPCIONADO');
      expect(resultado.cargo).toBeDefined();
      expect(resultado.cargo?.numeroCargo).toBe('CRG-2026-000211');
      expect(resultado.cargo?.hashSha256).toBeDefined();
      expect(resultado.cargo?.hashSha256.length).toBe(64); // SHA-256 hex
      expect(resultado.cargo?.qrUrl).toContain('EXP-2026-000211');
      expect(resultado.cargo?.canal).toBe('MESA_VIRTUAL');
      expect(resultado.cargo?.folios).toBe(5);
      expect(resultado.cargo?.documentos).toBe(3);
    });
  });

  describe('2. Calificación Documental y Conformidad TUPA (4.2)', () => {
    it('bloquea la declaración de conformidad si existen requisitos obligatorios no cumplidos', async () => {
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockCliente),
      } as any;
      const servicio = new CalificacionAdministrativaService(mockPool, {} as any, {} as any);

      mockQuery.mockImplementation((sql: string) => {
        const s = String(sql).toUpperCase();
        if (s.includes('BEGIN') || s.includes('COMMIT') || s.includes('ROLLBACK')) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        if (s.includes('SIGD_DOC.REQUISITO')) {
          return Promise.resolve({
            rowCount: 2,
            rows: [
              { codigo: 'FUT', denominacion: 'Formulario Único de Trámite', obligatorio: true, cumplido: true },
              { codigo: 'CERT_NOTAS', denominacion: 'Certificado de Estudios', obligatorio: true, cumplido: false },
            ],
          });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      });

      await expect(
        servicio.declararConformidad(mockExpedienteId, { id: mockUsuarioId } as any)
      ).rejects.toThrow(ConflictError);
    });

    it('declara conformidad y transiciona de RECEPCIONADO a EN_CALIFICACION cuando todos los requisitos obligatorios cumplen', async () => {
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockCliente),
      } as any;
      const servicio = new CalificacionAdministrativaService(mockPool, {} as any, {} as any);

      mockQuery.mockImplementation((sql: string) => {
        const s = String(sql).toUpperCase();
        if (s.includes('BEGIN') || s.includes('COMMIT') || s.includes('ROLLBACK')) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        if (s.includes('SIGD_DOC.REQUISITO')) {
          return Promise.resolve({
            rowCount: 2,
            rows: [
              { codigo: 'FUT', denominacion: 'Formulario Único de Trámite', obligatorio: true, cumplido: true },
              { codigo: 'COMPROBANTE_PAGO', denominacion: 'Comprobante de Pago', obligatorio: true, cumplido: true },
            ],
          });
        }
        if (s.includes('SIGD_TRA.EXPEDIENTE')) {
          return Promise.resolve({
            rowCount: 1,
            rows: [{
              codigo_expediente: 'EXP-2026-000211',
              estado_actual: 'RECEPCIONADO',
              area_actual_id: mockAreaMp,
            }],
          });
        }
        if (s.includes('SIGD_RUT.MOVIMIENTO_TRAMITE')) {
          return Promise.resolve({ rowCount: 1, rows: [{ id_movimiento: 'mov-conf-1' }] });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      });

      const res = await servicio.declararConformidad(mockExpedienteId, { id: mockUsuarioId } as any);

      expect(res.ok).toBe(true);
      expect(res.nuevoEstado).toBe('EN_CALIFICACION');
      expect(res.mensaje).toContain('Conformidad documental declarada exitosamente');
    });
  });

  describe('3. Rechazo Administrativo e Inadmisibilidad (4.4)', () => {
    it('valida que el motivo y la base legal sean obligatorios', async () => {
      await expect(
        rechazarExpediente(mockCliente, mockExpedienteId, { motivo: '', baseLegal: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('concluye el trámite transicionando a CERRADO, anulando expediente y depositando en Casilla', async () => {
      // 1. SELECT expediente
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          expediente_id: mockExpedienteId,
          codigo_expediente: 'EXP-2026-000211',
          estado_actual: 'EN_CALIFICACION',
          area_actual_id: mockAreaMp,
          solicitante_id: '66666666-6666-4666-8666-666666666666',
        }],
      });
      // 2. resolverOperadorParam
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ data_type: 'uuid' }] });
      // 3. INSERT movimiento_tramite CIERRE_ADMINISTRATIVO
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id_movimiento: '77777777-7777-4777-8777-777777777777',
          secuencia: '4',
        }],
      });
      // 4. UPDATE sigd_doc.expediente SET estado = 'ANULADO'
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      // 5. INSERT notificacion_casilla
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const res = await rechazarExpediente(mockCliente, mockExpedienteId, {
        motivo: 'Falta de subsanación de certificado original en plazo legal vencido',
        baseLegal: 'Art. 136 y 142 del TUO Ley N° 27444',
      });

      expect(res.nuevoEstado).toBe('CERRADO');
      expect(res.movimientoId).toBe('77777777-7777-4777-8777-777777777777');
    });
  });
});

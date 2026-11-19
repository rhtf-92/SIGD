import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { PlataformaService } from '../../src/domains/plataforma/plataforma.service.js';

describe('PlataformaService — Platform RBAC y Gobernanza SaaS', () => {
  let mockPool: any;
  let service: PlataformaService;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
    };
    service = new PlataformaService(mockPool as unknown as Pool);
  });

  describe('listarInstituciones', () => {
    it('debe listar todas las instituciones registradas ordenadas cronológicamente', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            institucion_id: '018f9805-51aa-7000-8111-2b00c3f00001',
            codigo: 'IESTP_SUIZA',
            nombre: 'Instituto de Educación Superior Tecnológico Público «Suiza»',
            abreviatura: 'IESTP SUIZA',
            ruc: '20493237123',
            ubigeo_inei: '250101',
            activo: true,
            creado_en: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      });

      const res = await service.listarInstituciones();

      expect(res).toHaveLength(1);
      expect(res[0].codigo).toBe('IESTP_SUIZA');
      expect(res[0].activo).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT institucion_id, codigo, nombre'));
    });
  });

  describe('crearInstitucion', () => {
    it('debe rechazar la creación si el actor no es SUPER_ADMIN', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ es_super_admin: false }],
      });

      await expect(
        service.crearInstitucion({
          codigo: 'NUEVA_INST',
          nombre: 'Nueva Institución de Prueba',
          abreviatura: 'NUEVA',
          actorId: '00000000-0000-0000-0000-000000000010',
          motivoJustificacion: 'Aprovisionamiento de nuevo tenant educativo para región Ucayali.',
        }),
      ).rejects.toThrow('Se requieren facultades vigentes de SUPER_ADMIN de plataforma.');
    });

    it('debe rechazar si el motivo de justificación tiene menos de 15 caracteres', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ es_super_admin: true }],
      });

      await expect(
        service.crearInstitucion({
          codigo: 'NUEVA_INST',
          nombre: 'Nueva Institución de Prueba',
          abreviatura: 'NUEVA',
          actorId: '00000000-0000-0000-0000-000000000010',
          motivoJustificacion: 'corto',
        }),
      ).rejects.toThrow();
    });

    it('debe aprovisionar la institución e insertar auditoría WORM si el actor es SUPER_ADMIN', async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      mockPool.connect.mockResolvedValueOnce(mockClient);

      // 1. esSuperAdmin check
      mockPool.query.mockResolvedValueOnce({ rows: [{ es_super_admin: true }] });

      // BEGIN
      mockClient.query.mockResolvedValueOnce({});
      // INSERT institucion
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            institucion_id: '018f9805-51aa-7000-8111-2b00c3f00099',
            codigo: 'NUEVA_INST',
            nombre: 'Nueva Institución de Prueba',
            abreviatura: 'NUEVA',
            ruc: '20493237999',
            ubigeo_inei: '250101',
            activo: true,
            creado_en: new Date('2026-11-14T00:00:00Z'),
          },
        ],
      });
      // INSERT auditoria_plataforma_log
      mockClient.query.mockResolvedValueOnce({});
      // COMMIT
      mockClient.query.mockResolvedValueOnce({});

      const res = await service.crearInstitucion({
        codigo: 'NUEVA_INST',
        nombre: 'Nueva Institución de Prueba',
        abreviatura: 'NUEVA',
        ruc: '20493237999',
        ubigeoInei: '250101',
        actorId: '00000000-0000-0000-0000-000000000001',
        motivoJustificacion: 'Aprovisionamiento de nuevo tenant educativo para región Ucayali formalmente aprobado.',
      });

      expect(res.codigo).toBe('NUEVA_INST');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sigd_audit.auditoria_plataforma_log'),
        expect.anything(),
      );
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('asignarRolPlataforma', () => {
    it('debe invocar fn_asignar_rol_plataforma y devolver correlationId', async () => {
      const correlationId = 'c0a80101-0026-4000-8000-000000000099';
      mockPool.query.mockResolvedValueOnce({
        rows: [{ fn_asignar_rol_plataforma: correlationId }],
      });

      const res = await service.asignarRolPlataforma({
        actorId: '00000000-0000-0000-0000-000000000001',
        targetUserId: '00000000-0000-0000-0000-000000000020',
        rolPlataforma: 'SUPER_ADMIN',
        motivoJustificacion: 'Asignación formal de rol de plataforma para administración técnica global.',
      });

      expect(res.correlationId).toBe(correlationId);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT sigd_auth.fn_asignar_rol_plataforma'),
        expect.arrayContaining(['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', 'SUPER_ADMIN']),
      );
    });
  });

  describe('revocarRolPlataforma', () => {
    it('debe invocar fn_revocar_rol_plataforma y devolver correlationId', async () => {
      const correlationId = 'c0a80101-0026-4000-8000-000000000088';
      mockPool.query.mockResolvedValueOnce({
        rows: [{ fn_revocar_rol_plataforma: correlationId }],
      });

      const res = await service.revocarRolPlataforma({
        actorId: '00000000-0000-0000-0000-000000000001',
        targetUserId: '00000000-0000-0000-0000-000000000020',
        rolPlataforma: 'SUPER_ADMIN',
        motivoJustificacion: 'Revocación programada de privilegios de plataforma al concluir la comisión de servicio.',
      });

      expect(res.correlationId).toBe(correlationId);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT sigd_auth.fn_revocar_rol_plataforma'),
        expect.arrayContaining(['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', 'SUPER_ADMIN']),
      );
    });
  });
});

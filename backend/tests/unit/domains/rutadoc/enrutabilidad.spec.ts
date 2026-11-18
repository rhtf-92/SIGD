import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { EnrutabilidadService } from '../../../../src/domains/rutadoc/enrutabilidad.service.js';
import { DerivarExpedienteSchema, MSG_ASIGNACION_EMBEBIDA_NO_PERMITIDA } from '../../../../src/domains/rutadoc/dto/derivarExpediente.dto.js';
import {
  PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC,
  ROLES_OPERATIVOS_RECEPTOR_RUTADOC,
  PERMISOS_CONSULTA_RUTADOC,
} from '../../../../src/core/auth/authorization.types.js';

describe('EnrutabilidadService & Derivaciones Enrutables (Regla Canónica)', () => {
  let mockPool: Partial<Pool>;
  let mockQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = vi.fn();
    mockPool = {
      query: mockQuery,
      connect: vi.fn().mockResolvedValue({
        query: mockQuery,
        release: vi.fn(),
      } as unknown as PoolClient),
    };
  });

  describe('evaluarEnrutabilidadAreas', () => {
    it('TC-DEST-01: Debe clasificar como DESTINO_INEXISTENTE cuando el área no existe en sigd_org.area', async () => {
      const service = new EnrutabilidadService(mockPool as Pool);
      const uuidInexistente = '11111111-1111-1111-1111-111111111111';

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            solicitadaId: uuidInexistente,
            areaId: null,
            nombre: null,
            codigo: null,
            vigente: null,
            receptoresOperativos: 0,
          },
        ],
      });

      const mapa = await service.evaluarEnrutabilidadAreas([uuidInexistente]);
      const res = mapa.get(uuidInexistente);

      expect(res).toBeDefined();
      expect(res?.existe).toBe(false);
      expect(res?.vigente).toBe(false);
      expect(res?.enrutable).toBe(false);
      expect(res?.motivo).toBe('DESTINO_INEXISTENTE');
      expect(res?.receptoresOperativos).toBe(0);
    });

    it('TC-DEST-02: Debe clasificar como DESTINO_INACTIVO cuando el área existe pero vigente = false', async () => {
      const service = new EnrutabilidadService(mockPool as Pool);
      const uuidInactiva = '22222222-2222-2222-2222-222222222222';

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            solicitadaId: uuidInactiva,
            areaId: uuidInactiva,
            nombre: 'Área En Liquidación',
            codigo: 'LIQ-01',
            vigente: false,
            receptoresOperativos: 2,
          },
        ],
      });

      const mapa = await service.evaluarEnrutabilidadAreas([uuidInactiva]);
      const res = mapa.get(uuidInactiva);

      expect(res).toBeDefined();
      expect(res?.existe).toBe(true);
      expect(res?.vigente).toBe(false);
      expect(res?.enrutable).toBe(false);
      expect(res?.motivo).toBe('DESTINO_INACTIVO');
    });

    it('TC-DEST-03: Debe clasificar como AREA_NO_ENRUTABLE cuando el área está vigente pero tiene 0 receptores operativos', async () => {
      const service = new EnrutabilidadService(mockPool as Pool);
      const uuidSinPersonal = '33333333-3333-3333-3333-333333333333';

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            solicitadaId: uuidSinPersonal,
            areaId: uuidSinPersonal,
            nombre: 'Subdirección de Obras Paralizadas',
            codigo: 'OBRAS-01',
            vigente: true,
            receptoresOperativos: 0,
          },
        ],
      });

      const mapa = await service.evaluarEnrutabilidadAreas([uuidSinPersonal]);
      const res = mapa.get(uuidSinPersonal);

      expect(res).toBeDefined();
      expect(res?.existe).toBe(true);
      expect(res?.vigente).toBe(true);
      expect(res?.enrutable).toBe(false);
      expect(res?.motivo).toBe('AREA_NO_ENRUTABLE');
      expect(res?.receptoresOperativos).toBe(0);
    });

    it('TC-DEST-04: Debe certificar como ENRUTABLE cuando el área está vigente y tiene >= 1 receptor operativo', async () => {
      const service = new EnrutabilidadService(mockPool as Pool);
      const uuidOperativa = '44444444-4444-4444-4444-444444444444';

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            solicitadaId: uuidOperativa,
            areaId: uuidOperativa,
            nombre: 'Mesa de Partes Central',
            codigo: 'MP-01',
            vigente: true,
            receptoresOperativos: 3,
          },
        ],
      });

      const mapa = await service.evaluarEnrutabilidadAreas([uuidOperativa]);
      const res = mapa.get(uuidOperativa);

      expect(res).toBeDefined();
      expect(res?.existe).toBe(true);
      expect(res?.vigente).toBe(true);
      expect(res?.enrutable).toBe(true);
      expect(res?.motivo).toBeUndefined();
      expect(res?.receptoresOperativos).toBe(3);
    });

    it('TC-DEST-05: Debe evaluar múltiples áreas en un solo query set-based previniendo N+1', async () => {
      const service = new EnrutabilidadService(mockPool as Pool);
      const a1 = '11111111-1111-1111-1111-111111111111';
      const a2 = '22222222-2222-2222-2222-222222222222';
      const a3 = '33333333-3333-3333-3333-333333333333';

      mockQuery.mockResolvedValueOnce({
        rows: [
          { solicitadaId: a1, areaId: a1, nombre: 'A1', codigo: 'C1', vigente: true, receptoresOperativos: 1 },
          { solicitadaId: a2, areaId: a2, nombre: 'A2', codigo: 'C2', vigente: true, receptoresOperativos: 0 },
          { solicitadaId: a3, areaId: null, nombre: null, codigo: null, vigente: null, receptoresOperativos: 0 },
        ],
      });

      const mapa = await service.evaluarEnrutabilidadAreas([a1, a2, a3]);
      expect(mockQuery).toHaveBeenCalledTimes(1);

      expect(mapa.get(a1)?.enrutable).toBe(true);
      expect(mapa.get(a2)?.enrutable).toBe(false);
      expect(mapa.get(a2)?.motivo).toBe('AREA_NO_ENRUTABLE');
      expect(mapa.get(a3)?.enrutable).toBe(false);
      expect(mapa.get(a3)?.motivo).toBe('DESTINO_INEXISTENTE');
    });
  });

  describe('listarAreasEnrutables', () => {
    it('TC-DEST-06: Debe listar áreas enriquecidas con bandera enrutable y motivo descriptivo', async () => {
      const service = new EnrutabilidadService(mockPool as Pool);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'area-1',
            nombre: 'Dirección General',
            codigo: 'DG',
            habilitada: true,
            enrutable: true,
            motivo_no_enrutable: null,
          },
          {
            id: 'area-2',
            nombre: 'Unidad Desierta',
            codigo: 'UD',
            habilitada: true,
            enrutable: false,
            motivo_no_enrutable: 'AREA_NO_ENRUTABLE: No cuenta con personal habilitado para gestionar expedientes.',
          },
          {
            id: 'area-3',
            nombre: 'Área Histórica',
            codigo: 'AH',
            habilitada: false,
            enrutable: false,
            motivo_no_enrutable: 'DESTINO_INACTIVO: El área se encuentra dada de baja en el organigrama.',
          },
        ],
      });

      const listado = await service.listarAreasEnrutables();
      expect(listado).toHaveLength(3);
      expect(listado[0].enrutable).toBe(true);
      expect(listado[0].motivo_no_enrutable).toBeNull();
      expect(listado[1].enrutable).toBe(false);
      expect(listado[1].motivo_no_enrutable).toContain('AREA_NO_ENRUTABLE');
      expect(listado[2].enrutable).toBe(false);
      expect(listado[2].motivo_no_enrutable).toContain('DESTINO_INACTIVO');
    });
  });

  describe('Rechazo Canónico de Asignación Embebida (DerivarExpedienteSchema)', () => {
    const areaValidaId = '55555555-5555-5555-5555-555555555555';
    const personaId = '66666666-6666-6666-6666-666666666666';
    const usuarioId = '77777777-7777-7777-7777-777777777777';

    it('TC-ASIG-EMB-01: Debe permitir derivación estándar sin asignación embebida', () => {
      const payload = {
        destinos: [{ area_destino_id: areaValidaId, es_copia: false }],
        proveido: 'Pase reglamentario para trámite.',
      };

      const parsed = DerivarExpedienteSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it('TC-ASIG-EMB-02: Debe RECHAZAR con ASIGNACION_EMBEBIDA_NO_PERMITIDA si se envía usuario_asignado_id en destino', () => {
      const payload = {
        destinos: [
          {
            area_destino_id: areaValidaId,
            es_copia: false,
            usuario_asignado_id: usuarioId,
          },
        ],
        proveido: 'Pase reglamentario.',
      };

      const parsed = DerivarExpedienteSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues;
        expect(issues.some((i) => i.message.includes('ASIGNACION_EMBEBIDA_NO_PERMITIDA'))).toBe(true);
        expect(issues.some((i) => i.message.includes(MSG_ASIGNACION_EMBEBIDA_NO_PERMITIDA))).toBe(true);
      }
    });

    it('TC-ASIG-EMB-03: Debe RECHAZAR con ASIGNACION_EMBEBIDA_NO_PERMITIDA si se envía persona_asignada_id en destino', () => {
      const payload = {
        destinos: [
          {
            area_destino_id: areaValidaId,
            es_copia: false,
            persona_asignada_id: personaId,
          },
        ],
        proveido: 'Pase reglamentario.',
      };

      const parsed = DerivarExpedienteSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues;
        expect(issues.some((i) => i.message.includes('ASIGNACION_EMBEBIDA_NO_PERMITIDA'))).toBe(true);
      }
    });

    it('TC-ASIG-EMB-04: Debe RECHAZAR con ASIGNACION_EMBEBIDA_NO_PERMITIDA si se envía asignación a nivel raíz', () => {
      const payload = {
        destinos: [{ area_destino_id: areaValidaId, es_copia: false }],
        proveido: 'Pase reglamentario.',
        usuario_asignado_id: usuarioId,
      };

      const parsed = DerivarExpedienteSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues;
        expect(issues.some((i) => i.message.includes('ASIGNACION_EMBEBIDA_NO_PERMITIDA'))).toBe(true);
      }
    });
  });

  describe('Semántica Canónica de Receptor Operativo (Fase C0.1B)', () => {
    it('TC-C01B-01: ROLES_OPERATIVOS_RECEPTOR_RUTADOC debe excluir estrictamente SUPERADMINISTRADOR y ADMINISTRADOR', () => {
      expect(ROLES_OPERATIVOS_RECEPTOR_RUTADOC).not.toContain('SUPERADMINISTRADOR');
      expect(ROLES_OPERATIVOS_RECEPTOR_RUTADOC).not.toContain('ADMINISTRADOR');
      expect(ROLES_OPERATIVOS_RECEPTOR_RUTADOC).toContain('DIRECTOR');
      expect(ROLES_OPERATIVOS_RECEPTOR_RUTADOC).toContain('SECRETARIO');
      expect(ROLES_OPERATIVOS_RECEPTOR_RUTADOC).toContain('ESPECIALISTA');
      expect(ROLES_OPERATIVOS_RECEPTOR_RUTADOC).toContain('MESA_PARTES');
    });

    it('TC-C01B-02: PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC debe incluir únicamente EXPEDIENTE_RECIBIR y EXPEDIENTE_ATENDER', () => {
      expect(PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC).toContain('EXPEDIENTE_RECIBIR');
      expect(PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC).toContain('EXPEDIENTE_ATENDER');
      expect(PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC).not.toContain('EXPEDIENTE_VER');
      expect(PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC).not.toContain('EXPEDIENTE_DERIVAR');
      expect(PERMISOS_CONSULTA_RUTADOC).toContain('EXPEDIENTE_VER');
    });

    it('TC-C01B-03: evaluarEnrutabilidadAreas debe inyectar la lista canónica de roles y permisos operativos como parámetros SQL', async () => {
      const service = new EnrutabilidadService(mockPool as Pool);
      const uuidArea = '88888888-8888-8888-8888-888888888888';

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            solicitadaId: uuidArea,
            areaId: uuidArea,
            nombre: 'Área Test',
            codigo: 'TST',
            vigente: true,
            receptoresOperativos: 1,
          },
        ],
      });

      await service.evaluarEnrutabilidadAreas([uuidArea]);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const callArgs = mockQuery.mock.calls[0];
      const params = callArgs[1];

      // Parámetro 1: Array de IDs únicos
      expect(params[0]).toEqual([uuidArea]);
      // Parámetro 2: Roles operativos (sin SUPERADMINISTRADOR ni ADMINISTRADOR)
      expect(params[1]).toEqual([...ROLES_OPERATIVOS_RECEPTOR_RUTADOC]);
      expect(params[1]).not.toContain('SUPERADMINISTRADOR');
      expect(params[1]).not.toContain('ADMINISTRADOR');
      // Parámetro 3: Permisos operativos (sólo RECIBIR y ATENDER)
      expect(params[2]).toEqual([...PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC]);
      expect(params[2]).not.toContain('EXPEDIENTE_VER');
      expect(params[2]).not.toContain('EXPEDIENTE_DERIVAR');
    });

    it('TC-C01B-04: listarAreasEnrutables debe inyectar igualmente la lista canónica de roles y permisos', async () => {
      const service = new EnrutabilidadService(mockPool as Pool);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.listarAreasEnrutables();

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const callArgs = mockQuery.mock.calls[0];
      const params = callArgs[1];

      expect(params[0]).toEqual([...ROLES_OPERATIVOS_RECEPTOR_RUTADOC]);
      expect(params[0]).not.toContain('SUPERADMINISTRADOR');
      expect(params[1]).toEqual([...PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC]);
      expect(params[1]).not.toContain('EXPEDIENTE_VER');
    });
  });
});

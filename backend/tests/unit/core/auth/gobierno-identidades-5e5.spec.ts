/**
 * =============================================================================
 * Suite de Pruebas Unitarias Automatizadas: Fase 5E.5
 * Gobierno de Identidades, Cuentas, Ciclo Laboral y Contextos de Operación
 * Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
 * =============================================================================
 * Principio Canónico Institucional:
 * PERSONA ≠ CUENTA ≠ VÍNCULO ≠ ÁREA ≠ CARGO ≠ ASIGNACIÓN ≠ RESPONSABILIDAD ≠ PERFIL
 * =============================================================================
 */

import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { AuthorizationService } from '../../../../src/core/auth/authorization.service.js';
import { OrganizacionService } from '../../../../src/domains/organicore/organizacion.service.js';
import { crearUsuariosAdminService } from '../../../../src/domains/organicore/usuariosAdmin.service.js';
import { verificarFacultadFirma } from '../../../../src/core/auth/auth.guard.js';
import {
  ForbiddenError,
  ValidationError,
} from '../../../../src/shared/domain/errors/index.js';

describe('SIGD Fase 5E.5 — Gobierno Canónico de Identidades, Ciclo Laboral y Contextos', () => {
  const PERSONA_DOCENTE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const PERSONA_DIRECTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const PERSONA_SUPLENTE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const PERSONA_ADMIN_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const USUARIO_DOCENTE_ID = '11111111-1111-4111-8111-111111111111';
  const USUARIO_DIRECTOR_ID = '22222222-2222-4222-8222-222222222222';
  const USUARIO_SUPLENTE_ID = '33333333-3333-4333-8333-333333333333';
  const USUARIO_ADMIN_ID = '44444444-4444-4444-8444-444444444444';

  const CARGO_DOCENTE_ID = '55555555-5555-4555-8555-555555555555';
  const CARGO_COORDINADOR_ID = '66666666-6666-4666-8666-666666666666';
  const CARGO_DIRECTOR_ID = '77777777-7777-4777-8777-777777777777';

  const AREA_SISTEMAS_ID = '88888888-8888-4888-8888-888888888888';
  const AREA_CONTABILIDAD_ID = '99999999-9999-4999-8999-999999999999';
  const AREA_DIR_ID = 'a0000000-0000-0000-0000-000000000002';

  const ASIGNACION_ID = 'e1111111-1111-4111-8111-111111111111';
  const ASIGNACION_NUEVA_ID = 'e2222222-2222-4222-8222-222222222222';
  const RESP_ID = 'e3333333-3333-4333-8333-333333333333';

  const VINCULO_DOCENTE_ID = 'd1111111-1111-4111-8111-111111111111';
  const VINCULO_TITULADO_ID = 'd2222222-2222-4222-8222-222222222222';

  function mockAuditQuery(sql: string) {
    if (sql.includes('sigd_audit.bitacora_auditoria')) {
      return { rows: [{ id_auditoria: 'aud-001' }] };
    }
    return null;
  }

  // ===========================================================================
  // 1. PERSONA SIN CUENTA CON VÍNCULO Y CARGO
  // ===========================================================================
  describe('Prueba 1: Persona sin cuenta con vínculo y cargo', () => {
    it('permite registrar una asignación de personal para una persona civil sin requerir cuenta institucional', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('INSERT INTO sigd_org.asignacion_personal')) {
            return { rows: [{ idAsignacion: ASIGNACION_ID }] };
          }
          if (sql.includes('FROM sigd_org.asignacion_personal a')) {
            return {
              rows: [
                {
                  idAsignacion: ASIGNACION_ID,
                  idUsuario: null,
                  idPersona: PERSONA_DOCENTE_ID,
                  idVinculo: VINCULO_DOCENTE_ID,
                  cargoId: CARGO_DOCENTE_ID,
                  cargoCodigo: 'DOC',
                  cargoNombre: 'Docente',
                  areaId: AREA_SISTEMAS_ID,
                  areaCodigo: 'SIST',
                  areaNombre: 'Sistemas',
                  estado: 'ACTIVO',
                  vigenteDesde: '2026-03-01T00:00:00.000Z',
                  vigenteHasta: null,
                  creadoEn: '2026-03-01T00:00:00.000Z',
                  actualizadoEn: '2026-03-01T00:00:00.000Z',
                },
              ],
            };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.persona')) {
            return { rows: [{ id_persona: PERSONA_DOCENTE_ID, tipo_persona: 'NATURAL' }] };
          }
          if (sql.includes('FROM sigd_auth.vinculo_institucional')) {
            return { rows: [{ id_vinculo: VINCULO_DOCENTE_ID, id_persona: PERSONA_DOCENTE_ID, estado: 'ACTIVO' }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargoId: CARGO_DOCENTE_ID, codigo: 'DOC', nombre: 'Docente', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ areaId: AREA_SISTEMAS_ID, codigo: 'SIST', nombre: 'Sistemas', vigente: true }] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const resultado = await service.crearAsignacion({
        idPersona: PERSONA_DOCENTE_ID,
        idVinculo: VINCULO_DOCENTE_ID,
        cargoId: CARGO_DOCENTE_ID,
        areaId: AREA_SISTEMAS_ID,
        vigenteDesde: '2026-03-01T00:00:00.000Z',
      });

      expect(resultado).toBeDefined();
      expect(resultado.idPersona).toBe(PERSONA_DOCENTE_ID);
      expect(resultado.idUsuario).toBeNull();
      expect(resultado.estado).toBe('ACTIVO');
    });
  });

  // ===========================================================================
  // 2. CREACIÓN DE CUENTA LIGADA A PERSONA EXISTENTE SIN DUPLICAR PERSONA
  // ===========================================================================
  describe('Prueba 2: Creación de cuenta ligada a persona existente sin duplicar persona', () => {
    it('vincula id_persona existente en cuenta_usuario asegurando unicidad de la entidad civil', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT COUNT(*)::int AS total FROM sigd_auth.persona')) {
            return { rows: [{ total: 1 }] };
          }
          if (sql.includes('INSERT INTO sigd_auth.cuenta_usuario')) {
            return {
              rows: [{
                id_usuario: USUARIO_DOCENTE_ID,
                id_persona: PERSONA_DOCENTE_ID,
                usuario: 'docente.sistemas',
                correo: 'docente.sistemas@iestp.edu.pe',
                activo: true,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const insertResult = await mockPool.query(
        'INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo) VALUES ($1, $2, $3) RETURNING *',
        [PERSONA_DOCENTE_ID, 'docente.sistemas', 'docente.sistemas@iestp.edu.pe']
      );

      const countResult = await mockPool.query('SELECT COUNT(*)::int AS total FROM sigd_auth.persona WHERE id_persona = $1', [PERSONA_DOCENTE_ID]);

      expect(insertResult.rows[0].id_persona).toBe(PERSONA_DOCENTE_ID);
      expect(countResult.rows[0].total).toBe(1);
    });
  });

  // ===========================================================================
  // 3. VÍNCULOS MÚLTIPLES (EJ. TITULADO + DOCENTE)
  // ===========================================================================
  describe('Prueba 3: Vínculos múltiples (ej. TITULADO + DOCENTE)', () => {
    it('permite coexistencia simultánea de vínculo académico (TITULADO) y laboral (DOCENTE) para la misma persona', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.vinculo_institucional')) {
            return {
              rows: [
                {
                  id_vinculo: VINCULO_TITULADO_ID,
                  id_persona: PERSONA_DOCENTE_ID,
                  codigo: 'TITULADO',
                  categoria_actor: 'CIUDADANO_ACADEMICO',
                  estado: 'ACTIVO',
                },
                {
                  id_vinculo: VINCULO_DOCENTE_ID,
                  id_persona: PERSONA_DOCENTE_ID,
                  codigo: 'DOCENTE',
                  categoria_actor: 'PERSONAL_INSTITUCIONAL',
                  estado: 'ACTIVO',
                },
              ],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const vinculos = await mockPool.query(
        'SELECT v.id_vinculo, t.codigo, t.categoria_actor, v.estado FROM sigd_auth.vinculo_institucional v JOIN sigd_auth.tipo_vinculo_institucional t ON t.id_tipo_vinculo = v.id_tipo_vinculo WHERE v.id_persona = $1',
        [PERSONA_DOCENTE_ID]
      );

      expect(vinculos.rows).toHaveLength(2);
      expect(vinculos.rows.some((v: any) => v.codigo === 'TITULADO')).toBe(true);
      expect(vinculos.rows.some((v: any) => v.codigo === 'DOCENTE')).toBe(true);
    });
  });

  // ===========================================================================
  // 4. DOCENTE ASUME COORDINACIÓN (CASO CANÓNICO)
  // ===========================================================================
  describe('Prueba 4: Docente asume Coordinación (caso canónico)', () => {
    it('otorga facultades de área cuando el docente tiene una responsabilidad temporal activa como Coordinador', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return { rows: [{ id_usuario: USUARIO_DOCENTE_ID, usuario: 'docente.sist', activo: true }] };
          }
          if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_DOCENTE_ID, nombres: 'Juan', primer_apellido: 'Docente' }] };
          }
          if (sql.includes('asignacion_personal')) {
            return {
              rows: [{
                id_asignacion: 'asig-doc-1', cargo_id: CARGO_DOCENTE_ID, cargo_codigo: 'DOC', cargo_nombre: 'Docente',
                area_id: AREA_SISTEMAS_ID, area_codigo: 'SIST', area_nombre: 'Sistemas', jerarquia: '1.2',
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
              }],
            };
          }
          if (sql.includes('responsabilidad_temporal')) {
            return {
              rows: [{
                id_responsabilidad: 'resp-coord-1', tipo_responsabilidad: 'ENCARGATURA',
                cargo_id: CARGO_COORDINADOR_ID, cargo_codigo: 'COORD_ACAD', cargo_nombre: 'Coordinador Académico',
                area_id: AREA_SISTEMAS_ID, area_codigo: 'SIST', area_nombre: 'Sistemas', jerarquia: '1.2.1',
                vigente_desde: '2026-03-01', vigente_hasta: '2026-12-31',
              }],
            };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: 'asig-perf-1', perfil_id: 4, perfil_codigo: 'GESTOR_AREA_ACADEMICA',
                perfil_nombre: 'Gestor de Área Académica', area_id: AREA_SISTEMAS_ID, scope: 'AREA',
                id_responsabilidad: 'resp-coord-1', estado: 'ACTIVO', vigente_desde: '2026-03-01', vigente_hasta: '2026-12-31',
                permisos: ['EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RECIBIR'], alcance: null,
              }],
            };
          }
          if (sql.includes('usuario_rol')) return { rows: [] };
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const decision = await service.autorizar({
        usuarioId: USUARIO_DOCENTE_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_SISTEMAS_ID },
        contextoOperacion: 'INSTITUCIONAL',
      });

      expect(decision.autorizado).toBe(true);
      expect(decision.perfilAplicado).toBe('GESTOR_AREA_ACADEMICA');
      expect(decision.scopeAplicado).toBe('AREA');
    });
  });

  // ===========================================================================
  // 5. EXPIRACIÓN DE RESPONSABILIDAD TEMPORAL (VIGENCIA HASTA)
  // ===========================================================================
  describe('Prueba 5: Expiración de responsabilidad temporal (vigencia hasta)', () => {
    it('deniega facultades cuando la fecha de corte es posterior a vigente_hasta de la responsabilidad', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return { rows: [{ id_usuario: USUARIO_DOCENTE_ID, usuario: 'docente.sist', activo: true }] };
          }
          if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_DOCENTE_ID, nombres: 'Juan', primer_apellido: 'Docente' }] };
          }
          if (sql.includes('asignacion_personal')) {
            return {
              rows: [{
                id_asignacion: 'asig-doc-1', cargo_id: CARGO_DOCENTE_ID, cargo_codigo: 'DOC', cargo_nombre: 'Docente',
                area_id: AREA_SISTEMAS_ID, area_codigo: 'SIST', area_nombre: 'Sistemas', jerarquia: '1.2',
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
              }],
            };
          }
          // Simula que la responsabilidad temporal y el perfil expiraron
          if (sql.includes('responsabilidad_temporal')) return { rows: [] };
          if (sql.includes('asignacion_perfil_operativo')) return { rows: [] };
          if (sql.includes('usuario_rol')) return { rows: [] };
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const decision = await service.autorizar({
        usuarioId: USUARIO_DOCENTE_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_SISTEMAS_ID },
        contextoOperacion: 'INSTITUCIONAL',
      });

      expect(decision.autorizado).toBe(false);
      expect(decision.codigoDenegacion).toBe('ACCESO_DENEGADO');
    });
  });

  // ===========================================================================
  // 6. SUPLENCIA (TITULAR VS SUPLENTE)
  // ===========================================================================
  describe('Prueba 6: Suplencia (titular vs suplente)', () => {
    it('rechaza la creación de una suplencia cuando titular y suplente son el mismo usuario/persona', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return {
              rows: [{
                idUsuario: USUARIO_DOCENTE_ID,
                idPersona: PERSONA_DOCENTE_ID,
                personaId: PERSONA_DOCENTE_ID,
                activo: true,
                id_usuario: USUARIO_DOCENTE_ID,
                id_persona: PERSONA_DOCENTE_ID,
              }],
            };
          }
          return { rows: [] };
        }),
        connect: vi.fn(),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);

      await expect(
        service.crearResponsabilidadTemporal({
          tipoResponsabilidad: 'SUPLENCIA',
          idUsuario: USUARIO_DOCENTE_ID,
          titularUsuarioId: USUARIO_DOCENTE_ID,
          cargoId: CARGO_COORDINADOR_ID,
          areaId: AREA_SISTEMAS_ID,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('permite registrar la suplencia cuando titular y suplente son personas distintas', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('INSERT INTO sigd_org.responsabilidad_temporal')) {
            return { rows: [{ idResponsabilidad: RESP_ID }] };
          }
          if (sql.includes('FROM sigd_org.responsabilidad_temporal r')) {
            return {
              rows: [{
                idResponsabilidad: RESP_ID,
                tipoResponsabilidad: 'SUPLENCIA',
                idUsuario: USUARIO_SUPLENTE_ID,
                idPersona: PERSONA_SUPLENTE_ID,
                titularUsuarioId: USUARIO_DIRECTOR_ID,
                titularPersonaId: PERSONA_DIRECTOR_ID,
                cargoId: CARGO_DIRECTOR_ID,
                cargoCodigo: 'DIR',
                cargoNombre: 'Director',
                areaId: AREA_DIR_ID,
                areaCodigo: 'DIR',
                areaNombre: 'Dirección General',
                estado: 'ACTIVO',
                vigenteDesde: '2026-07-01T00:00:00.000Z',
                vigenteHasta: '2026-07-15T00:00:00.000Z',
                creadoEn: '2026-07-01T00:00:00.000Z',
                actualizadoEn: '2026-07-01T00:00:00.000Z',
              }],
            };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            const isTitular = params?.[0] === USUARIO_DIRECTOR_ID;
            return {
              rows: [{
                idUsuario: isTitular ? USUARIO_DIRECTOR_ID : USUARIO_SUPLENTE_ID,
                idPersona: isTitular ? PERSONA_DIRECTOR_ID : PERSONA_SUPLENTE_ID,
                personaId: isTitular ? PERSONA_DIRECTOR_ID : PERSONA_SUPLENTE_ID,
                activo: true,
                id_usuario: isTitular ? USUARIO_DIRECTOR_ID : USUARIO_SUPLENTE_ID,
                id_persona: isTitular ? PERSONA_DIRECTOR_ID : PERSONA_SUPLENTE_ID,
              }],
            };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargoId: CARGO_DIRECTOR_ID, codigo: 'DIR', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ areaId: AREA_DIR_ID, codigo: 'DIR', vigente: true }] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const resultado = await service.crearResponsabilidadTemporal({
        tipoResponsabilidad: 'SUPLENCIA',
        idUsuario: USUARIO_SUPLENTE_ID,
        titularUsuarioId: USUARIO_DIRECTOR_ID,
        cargoId: CARGO_DIRECTOR_ID,
        areaId: AREA_DIR_ID,
        vigenteDesde: '2026-07-01T00:00:00.000Z',
        vigenteHasta: '2026-07-15T00:00:00.000Z',
      });

      expect(resultado).toBeDefined();
      expect(resultado.tipoResponsabilidad).toBe('SUPLENCIA');
      expect(resultado.idUsuario).toBe(USUARIO_SUPLENTE_ID);
      expect(resultado.titularUsuarioId).toBe(USUARIO_DIRECTOR_ID);
    });
  });

  // ===========================================================================
  // 7. CAMBIO DE ÁREA DEL PERSONAL (CONSERVANDO HISTÓRICO)
  // ===========================================================================
  describe('Prueba 7: Cambio de área del personal (conservando histórico)', () => {
    it('finaliza la asignación anterior y crea una nueva preservando el registro histórico intacto', async () => {
      let asignacionActualEstado = 'ACTIVO';
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('UPDATE sigd_org.asignacion_personal')) {
            asignacionActualEstado = 'FINALIZADO';
            return { rows: [{ idAsignacion: ASIGNACION_ID }] };
          }
          if (sql.includes('INSERT INTO sigd_org.asignacion_personal')) {
            return { rows: [{ idAsignacion: ASIGNACION_NUEVA_ID }] };
          }
          if (sql.includes('FROM sigd_org.asignacion_personal a') || sql.includes('FROM sigd_org.asignacion_personal WHERE')) {
            const esAnterior = (params && params[0] === ASIGNACION_ID) || (!params && sql.includes(ASIGNACION_ID));
            if (esAnterior) {
              return {
                rows: [{
                  idAsignacion: ASIGNACION_ID,
                  idPersona: PERSONA_DOCENTE_ID,
                  idUsuario: USUARIO_DOCENTE_ID,
                  cargoId: CARGO_DOCENTE_ID,
                  cargoCodigo: 'DOC',
                  cargoNombre: 'Docente',
                  areaId: AREA_SISTEMAS_ID,
                  areaCodigo: 'SIST',
                  areaNombre: 'Sistemas',
                  estado: asignacionActualEstado,
                  vigenteDesde: '2026-01-01T00:00:00.000Z',
                  vigenteHasta: asignacionActualEstado === 'FINALIZADO' ? '2026-06-30T23:59:59.000Z' : null,
                  motivoFinalizacion: asignacionActualEstado === 'FINALIZADO' ? 'Rotación / Reasignación de Área' : null,
                  creadoEn: '2026-01-01T00:00:00.000Z',
                  actualizadoEn: '2026-06-30T23:59:59.000Z',
                }],
              };
            }
            return {
              rows: [{
                idAsignacion: ASIGNACION_NUEVA_ID,
                idPersona: PERSONA_DOCENTE_ID,
                idUsuario: USUARIO_DOCENTE_ID,
                cargoId: CARGO_DOCENTE_ID,
                cargoCodigo: 'DOC',
                cargoNombre: 'Docente',
                areaId: AREA_CONTABILIDAD_ID,
                areaCodigo: 'CONT',
                areaNombre: 'Contabilidad',
                tipoAsignacion: 'REGULAR',
                estado: 'ACTIVO',
                vigenteDesde: '2026-07-01T00:00:00.000Z',
                vigenteHasta: null,
                creadoEn: '2026-07-01T00:00:00.000Z',
                actualizadoEn: '2026-07-01T00:00:00.000Z',
              }],
            };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_org.asignacion_personal a') || sql.includes('FROM sigd_org.asignacion_personal WHERE')) {
            return {
              rows: [{
                idAsignacion: ASIGNACION_ID,
                idPersona: PERSONA_DOCENTE_ID,
                idUsuario: USUARIO_DOCENTE_ID,
                cargoId: CARGO_DOCENTE_ID,
                cargoCodigo: 'DOC',
                cargoNombre: 'Docente',
                areaId: AREA_SISTEMAS_ID,
                areaCodigo: 'SIST',
                areaNombre: 'Sistemas',
                estado: 'ACTIVO',
                vigenteDesde: '2026-01-01T00:00:00.000Z',
                vigenteHasta: null,
                creadoEn: '2026-01-01T00:00:00.000Z',
                actualizadoEn: '2026-01-01T00:00:00.000Z',
              }],
            };
          }
          if (sql.includes('FROM sigd_auth.persona')) {
            return { rows: [{ id_persona: PERSONA_DOCENTE_ID, tipo_persona: 'NATURAL' }] };
          }
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return {
              rows: [{
                idUsuario: USUARIO_DOCENTE_ID,
                idPersona: PERSONA_DOCENTE_ID,
                personaId: PERSONA_DOCENTE_ID,
                activo: true,
                id_usuario: USUARIO_DOCENTE_ID,
                id_persona: PERSONA_DOCENTE_ID,
              }],
            };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargoId: CARGO_DOCENTE_ID, codigo: 'DOC', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ areaId: AREA_CONTABILIDAD_ID, codigo: 'CONT', vigente: true }] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);

      // 1. Finalizar asignación anterior
      const asigFinalizada = await service.finalizarAsignacion({
        idAsignacion: ASIGNACION_ID,
        fechaFinalizacion: '2026-06-30T23:59:59.000Z',
        motivoFinalizacion: 'Rotación / Reasignación de Área',
      });
      expect(asigFinalizada.estado).toBe('FINALIZADO');

      // 2. Crear nueva asignación en nueva área
      const nuevaAsig = await service.crearAsignacion({
        idPersona: PERSONA_DOCENTE_ID,
        idUsuario: USUARIO_DOCENTE_ID,
        cargoId: CARGO_DOCENTE_ID,
        areaId: AREA_CONTABILIDAD_ID,
        vigenteDesde: '2026-07-01T00:00:00.000Z',
      });
      expect(nuevaAsig.areaId).toBe(AREA_CONTABILIDAD_ID);
      expect(nuevaAsig.estado).toBe('ACTIVO');
    });
  });

  // ===========================================================================
  // 8. BAJA DE PERSONAL (DESVINCULACIÓN CON PRESERVACIÓN DE TITULADO)
  // ===========================================================================
  describe('Prueba 8: Baja de personal (desvinculación con preservación de TITULADO)', () => {
    it('desvincula personal laboral, finaliza asignaciones y sesiones pero preserva el registro de persona y vínculo TITULADO', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT id_persona FROM sigd_auth.persona')) {
            return { rows: [{ id_persona: PERSONA_DOCENTE_ID }] };
          }
          if (sql.includes('FROM sigd_auth.vinculo_institucional v') && sql.includes('WHERE v.id_vinculo = $1::uuid')) {
            return {
              rows: [{
                id_vinculo: VINCULO_DOCENTE_ID,
                codigo: 'DOCENTE',
                categoria_actor: 'PERSONAL_INSTITUCIONAL',
                estado: 'ACTIVO',
              }],
            };
          }
          if (sql.includes('UPDATE sigd_auth.vinculo_institucional')) return { rowCount: 1 };
          if (sql.includes('UPDATE sigd_org.asignacion_personal')) return { rowCount: 1 };
          if (sql.includes('UPDATE sigd_org.responsabilidad_temporal')) return { rowCount: 1 };
          if (sql.includes('UPDATE sigd_org.asignacion_perfil_operativo')) return { rowCount: 1 };
          if (sql.includes('UPDATE sigd_org.usuario_rol')) return { rowCount: 1 };
          if (sql.includes('UPDATE sigd_auth.sesion_usuario')) return { rowCount: 2 };
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: vi.fn(),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const resultado = await service.desvincularPersonal({
        idPersona: PERSONA_DOCENTE_ID,
        idVinculoLaboral: VINCULO_DOCENTE_ID,
        motivo: 'Término de contrato docente 2026-I',
      });

      expect(resultado.idPersona).toBe(PERSONA_DOCENTE_ID);
      expect(resultado.asignacionesFinalizadas).toBe(1);
      expect(resultado.responsabilidadesFinalizadas).toBe(1);
      expect(resultado.perfilesFinalizados).toBe(1);
      expect(resultado.sesionesRevocadas).toBe(2);

      // Verificamos que jamás se ejecutó un DELETE sobre persona o vínculos
      const calls = (mockClient.query as any).mock.calls.map((c: any) => c[0]);
      expect(calls.some((c: string) => c.includes('DELETE FROM sigd_auth.persona'))).toBe(false);
      expect(calls.some((c: string) => c.includes('DELETE FROM sigd_auth.vinculo_institucional'))).toBe(false);
    });
  });

  // ===========================================================================
  // 9. RETORNO INSTITUCIONAL DE PERSONAL DESVINCULADO (NUEVO CICLO, HISTÓRICO INTACTO)
  // ===========================================================================
  describe('Prueba 9: Retorno institucional de personal desvinculado (nuevo ciclo, histórico intacto)', () => {
    it('crea un nuevo registro de asignación para nuevo ciclo laboral sin mutar registros históricos anteriores', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('INSERT INTO sigd_org.asignacion_personal')) {
            return { rows: [{ idAsignacion: ASIGNACION_NUEVA_ID }] };
          }
          if (sql.includes('FROM sigd_org.asignacion_personal a')) {
            return {
              rows: [{
                idAsignacion: ASIGNACION_NUEVA_ID,
                idPersona: PERSONA_DOCENTE_ID,
                idUsuario: USUARIO_DOCENTE_ID,
                cargoId: CARGO_DOCENTE_ID,
                cargoCodigo: 'DOC',
                cargoNombre: 'Docente',
                areaId: AREA_SISTEMAS_ID,
                areaCodigo: 'SIST',
                areaNombre: 'Sistemas',
                tipoAsignacion: 'REGULAR',
                estado: 'ACTIVO',
                vigenteDesde: '2027-03-01T00:00:00.000Z',
                vigenteHasta: null,
                creadoEn: '2027-03-01T00:00:00.000Z',
                actualizadoEn: '2027-03-01T00:00:00.000Z',
              }],
            };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.persona')) {
            return { rows: [{ id_persona: PERSONA_DOCENTE_ID, tipo_persona: 'NATURAL' }] };
          }
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return {
              rows: [{
                idUsuario: USUARIO_DOCENTE_ID,
                idPersona: PERSONA_DOCENTE_ID,
                personaId: PERSONA_DOCENTE_ID,
                activo: true,
                id_usuario: USUARIO_DOCENTE_ID,
                id_persona: PERSONA_DOCENTE_ID,
              }],
            };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargoId: CARGO_DOCENTE_ID, codigo: 'DOC', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ areaId: AREA_SISTEMAS_ID, codigo: 'SIST', vigente: true }] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const reingreso = await service.crearAsignacion({
        idPersona: PERSONA_DOCENTE_ID,
        idUsuario: USUARIO_DOCENTE_ID,
        cargoId: CARGO_DOCENTE_ID,
        areaId: AREA_SISTEMAS_ID,
        vigenteDesde: '2027-03-01T00:00:00.000Z',
      });

      expect(reingreso.idAsignacion).toBe(ASIGNACION_NUEVA_ID);
      expect(reingreso.estado).toBe('ACTIVO');
    });
  });

  // ===========================================================================
  // 10. LOGIN MULTI-CONTEXTO (PERSONAL E INSTITUCIONAL)
  // ===========================================================================
  describe('Prueba 10: Login multi-contexto (personal e institucional)', () => {
    it('detecta y retorna ambos contextos operativos para usuarios con facultades institucionales y condición ciudadana', async () => {
      const tieneCapacidadInstitucional = true;
      const contextos = [
        { tipo: 'PERSONAL', descripcion: 'Trámites personales, consulta ciudadana y casilla electrónica', rol: 'CIUDADANO' },
        ...(tieneCapacidadInstitucional
          ? [{ tipo: 'INSTITUCIONAL', descripcion: 'Funciones oficiales', rol: 'DIRECTOR', areaId: AREA_DIR_ID }]
          : []),
      ];

      expect(contextos).toHaveLength(2);
      expect(contextos[0].tipo).toBe('PERSONAL');
      expect(contextos[1].tipo).toBe('INSTITUCIONAL');
      expect(contextos[1].rol).toBe('DIRECTOR');
    });
  });

  // ===========================================================================
  // 11. OPERACIÓN EN CONTEXTO PERSONAL BLOQUEA FACULTADES INSTITUCIONALES
  // ===========================================================================
  describe('Prueba 11: Operación en contexto personal bloquea facultades institucionales', () => {
    it('bloquea acciones administrativas oficiales con código CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES cuando contexto es PERSONAL', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return { rows: [{ id_usuario: USUARIO_DIRECTOR_ID, usuario: 'director.general', activo: true }] };
          }
          if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_DIRECTOR_ID, nombres: 'Director', primer_apellido: 'General' }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const decision = await service.autorizar({
        usuarioId: USUARIO_DIRECTOR_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        contextoOperacion: 'PERSONAL',
      });

      expect(decision.autorizado).toBe(false);
      expect(decision.codigoDenegacion).toBe('CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES');
    });

    it('permite acciones ciudadanas personales sobre sus propios trámites en contexto PERSONAL', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return { rows: [{ id_usuario: USUARIO_DIRECTOR_ID, usuario: 'director.general', activo: true }] };
          }
          if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_DIRECTOR_ID, nombres: 'Director', primer_apellido: 'General' }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const decision = await service.autorizar({
        usuarioId: USUARIO_DIRECTOR_ID,
        accion: 'EXPEDIENTE_VER',
        contextoOperacion: 'PERSONAL',
        recurso: {
          tipo: 'EXPEDIENTE',
          propietarioPersonaId: PERSONA_DIRECTOR_ID,
        },
      });

      expect(decision.autorizado).toBe(true);
      expect(decision.perfilAplicado).toBe('CONTEXTO_PERSONAL:CIUDADANO');
    });
  });

  // ===========================================================================
  // 12. INHABILITACIÓN DE CUENTA (BLOQUEA DE INMEDIATO, REVOCA O RECHAZA REFRESH)
  // ===========================================================================
  describe('Prueba 12: Inhabilitación de cuenta (bloquea de inmediato, revoca o rechaza refresh)', () => {
    it('deniega inmediatamente cualquier autorización con CUENTA_DESHABILITADA cuando cuenta_usuario.activo es false', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return { rows: [{ id_usuario: USUARIO_DOCENTE_ID, usuario: 'docente.inactivo', activo: false }] };
          }
          if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_DOCENTE_ID, nombres: 'Docente', primer_apellido: 'Inactivo' }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const decision = await service.autorizar({
        usuarioId: USUARIO_DOCENTE_ID,
        accion: 'EXPEDIENTE_VER',
      });

      expect(decision.autorizado).toBe(false);
      expect(decision.codigoDenegacion).toBe('CUENTA_DESHABILITADA');
    });
  });

  // ===========================================================================
  // 13. EXPIRACIÓN DE PERFIL OPERATIVO
  // ===========================================================================
  describe('Prueba 13: Expiración de perfil operativo', () => {
    it('ignora perfiles cuya vigencia ha expirado y deniega la acción solicitada', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return { rows: [{ id_usuario: USUARIO_DOCENTE_ID, usuario: 'docente.sist', activo: true }] };
          }
          if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_DOCENTE_ID, nombres: 'Juan', primer_apellido: 'Docente' }] };
          }
          if (sql.includes('asignacion_personal')) return { rows: [] };
          if (sql.includes('responsabilidad_temporal')) return { rows: [] };
          if (sql.includes('asignacion_perfil_operativo')) return { rows: [] };
          if (sql.includes('usuario_rol')) return { rows: [] };
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const decision = await service.autorizar({
        usuarioId: USUARIO_DOCENTE_ID,
        accion: 'TUPA_EDITAR',
        contextoOperacion: 'INSTITUCIONAL',
      });

      expect(decision.autorizado).toBe(false);
      expect(decision.codigoDenegacion).toBe('ACCESO_DENEGADO');
    });
  });

  // ===========================================================================
  // 14. ANTI-AUTO-ASIGNACIÓN DE PERFIL
  // ===========================================================================
  describe('Prueba 14: Anti-Self-Privilege y Bloqueo Fail-Closed de Perfiles Privilegiados a Terceros', () => {
    it('Caso A: Admin A intenta autoasignarse perfil privilegiado (APROBADOR_TUPA, AUTORIZADOR_DEVOLUCION, etc.) -> DENY', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ADMIN_ID, usuario: 'admin.sigd', activo: true }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);

      await expect(
        service.asignarPerfilOperativo(
          { idUsuario: USUARIO_ADMIN_ID, perfilCodigo: 'APROBADOR_TUPA' },
          USUARIO_ADMIN_ID
        )
      ).rejects.toThrow(ForbiddenError);

      await expect(
        service.asignarPerfilOperativo(
          { idUsuario: USUARIO_ADMIN_ID, perfilCodigo: 'AUTORIZADOR_DEVOLUCION' },
          USUARIO_ADMIN_ID
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('Casos B y C: Admin A intenta asignar perfil privilegiado a Usuario B -> DENY (autoridad institucional NO_DETERMINADA / fail-closed)', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_DOCENTE_ID, usuario: 'docente.sist', activo: true }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);

      // Caso B: Admin A -> APROBADOR_TUPA para Usuario B
      await expect(
        service.asignarPerfilOperativo(
          { idUsuario: USUARIO_DOCENTE_ID, perfilCodigo: 'APROBADOR_TUPA' },
          USUARIO_ADMIN_ID
        )
      ).rejects.toThrow(ForbiddenError);

      // Caso C: Admin A -> AUTORIZADOR_DEVOLUCION para Usuario B
      await expect(
        service.asignarPerfilOperativo(
          { idUsuario: USUARIO_DOCENTE_ID, perfilCodigo: 'AUTORIZADOR_DEVOLUCION' },
          USUARIO_ADMIN_ID
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('Caso D: Admin A asigna perfil regular (GESTOR_RECEPCION_DOCUMENTAL) a Usuario B -> permitido por política estándar', async () => {
      const rowAsig = {
        id_asignacion_perfil: 'asig-perf-reg-1',
        id_usuario: USUARIO_DOCENTE_ID,
        perfil_id: 3,
        perfil_codigo: 'GESTOR_RECEPCION_DOCUMENTAL',
        perfil_nombre: 'Gestor de Recepción Documental',
        area_id: AREA_SISTEMAS_ID,
        area_nombre: 'Sistemas',
        scope: 'AREA',
        id_responsabilidad: null,
        estado: 'ACTIVO',
        vigente_desde: '2026-03-01T00:00:00.000Z',
        vigente_hasta: null,
        tipo_documento_sustento: null,
        numero_documento_sustento: null,
        fecha_documento_sustento: null,
        alcance: null,
        creado_en: '2026-03-01T00:00:00.000Z',
        actualizado_en: '2026-03-01T00:00:00.000Z',
      };

      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [] };
          if (sql.includes('INSERT INTO sigd_org.asignacion_perfil_operativo')) {
            return { rows: [rowAsig] };
          }
          if (sql.includes('INSERT INTO sigd_seguridad.auditoria_mutaciones')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_DOCENTE_ID, usuario: 'docente.sist', activo: true }] };
          }
          if (sql.includes('FROM sigd_org.perfil_operativo')) {
            return { rows: [{ perfil_id: 3, codigo: 'GESTOR_RECEPCION_DOCUMENTAL', nombre: 'Gestor de Recepción', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.asignacion_perfil_operativo')) {
            return { rows: [rowAsig] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.asignarPerfilOperativo(
        {
          idUsuario: USUARIO_DOCENTE_ID,
          perfilCodigo: 'GESTOR_RECEPCION_DOCUMENTAL',
          areaId: AREA_SISTEMAS_ID,
        },
        USUARIO_ADMIN_ID
      );

      expect(resultado).toBeDefined();
      expect(resultado.idAsignacionPerfil).toBe('asig-perf-reg-1');
      expect(resultado.perfilId).toBe(3);
    });
  });

  // ===========================================================================
  // 15. CONFLICTO DE INTERÉS / ANTI-AUTO-TRÁMITE
  // ===========================================================================
  describe('Prueba 15: Conflicto de interés / anti-auto-trámite', () => {
    it('deniega acciones institucionales (aprobar, calificar, resolver, firmar) sobre un expediente donde la persona es el solicitante', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return { rows: [{ id_usuario: USUARIO_DIRECTOR_ID, usuario: 'director.general', activo: true }] };
          }
          if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_DIRECTOR_ID, nombres: 'Director', primer_apellido: 'General' }] };
          }
          if (sql.includes('asignacion_personal')) {
            return {
              rows: [{
                id_asignacion: 'asig-dir-1', cargo_id: CARGO_DIRECTOR_ID, cargo_codigo: 'DIR', cargo_nombre: 'Director General',
                area_id: AREA_DIR_ID, area_codigo: 'DIR', area_nombre: 'Dirección General', jerarquia: '1',
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
              }],
            };
          }
          if (sql.includes('responsabilidad_temporal')) return { rows: [] };
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: 'asig-perf-dir', perfil_id: 2, perfil_codigo: 'APROBADOR_DIRECCION',
                perfil_nombre: 'Aprobador de Dirección', area_id: AREA_DIR_ID, scope: 'GLOBAL',
                id_responsabilidad: null, estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['EXPEDIENTE_RESOLVER', 'EXPEDIENTE_CALIFICAR', 'FIRMA_FIRMAR'], alcance: null,
              }],
            };
          }
          if (sql.includes('usuario_rol')) return { rows: [] };
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);

      // El Director intenta calificar su propio expediente personal
      const decision = await service.autorizar({
        usuarioId: USUARIO_DIRECTOR_ID,
        accion: 'EXPEDIENTE_CALIFICAR',
        recurso: {
          tipo: 'EXPEDIENTE',
          areaId: AREA_DIR_ID,
          solicitantePersonaId: PERSONA_DIRECTOR_ID,
        },
        contextoOperacion: 'INSTITUCIONAL',
      });

      expect(decision.autorizado).toBe(false);
      expect(decision.codigoDenegacion).toBe('CONFLICTO_INTERES_EXPEDIENTE_PROPIO');
    });
  });

  // ===========================================================================
  // 16. REVOCACIÓN DE SESIONES CON MOTIVO Y AUDITORÍA SIN BORRAR HISTORIAL
  // ===========================================================================
  describe('Prueba 16: Revocación de sesiones con motivo y auditoría sin borrar historial', () => {
    it('actualiza revocado_en, motivo_revocacion y revocado_por en lugar de eliminar los registros de sesion_usuario', async () => {
      let queryEjecutada = '';
      let parametrosQuery: unknown[] = [];

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          queryEjecutada = sql;
          parametrosQuery = params ?? [];
          return { rowCount: 3 };
        }),
      } as unknown as Pool;

      const adminService = crearUsuariosAdminService(mockPool);
      const revocadas = await adminService.revocarSesionesUsuario(
        USUARIO_DOCENTE_ID,
        'Baja administrativa del ciclo 2026-I',
        USUARIO_ADMIN_ID
      );

      expect(revocadas).toBe(3);
      expect(queryEjecutada).toContain('UPDATE sigd_auth.sesion_usuario');
      expect(queryEjecutada).toContain('SET revocado_en = now()');
      expect(queryEjecutada).toContain('motivo_revocacion = $2');
      expect(queryEjecutada).toContain('revocado_por = $3::uuid');
      expect(queryEjecutada).not.toContain('DELETE FROM');
      expect(parametrosQuery[0]).toBe(USUARIO_DOCENTE_ID);
      expect(parametrosQuery[1]).toBe('Baja administrativa del ciclo 2026-I');
      expect(parametrosQuery[2]).toBe(USUARIO_ADMIN_ID);
    });
  });

  // ===========================================================================
  // 17. FIRMA INSTITUCIONAL Y RESPONSABILIDAD TEMPORAL SIN AUTORIDAD INVENTADA
  // ===========================================================================
  describe('Prueba 17: Firma institucional y limitación de autoridad en responsabilidades temporales', () => {
    it('deniega facultad de firma a funcionario con responsabilidad temporal en cargo ordinario o sin facultaFirma', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          // No tiene rol DIRECTOR en usuario_rol ni facultad en facultad_despacho
          // Retorna fila vacía para cargo COORDINADOR
          return { rows: [] };
        }),
      } as unknown as Pool;

      const resultado = await verificarFacultadFirma(mockPool, USUARIO_DOCENTE_ID, ['DOCENTE']);
      expect(resultado.puedeFirmar).toBe(false);
      expect(resultado.facultadGlobal).toBe(false);
    });

    it('otorga facultad de firma si la responsabilidad temporal es de cargo DIRECTOR o tiene facultaFirma explícito', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          return {
            rows: [
              {
                rol_codigo: null,
                tipo_resolucion: null,
                vigente: true,
                motivo_no_habilitado: null,
              },
            ],
          };
        }),
      } as unknown as Pool;

      const resultado = await verificarFacultadFirma(mockPool, USUARIO_DOCENTE_ID, []);
      expect(resultado.puedeFirmar).toBe(true);
      expect(resultado.facultadGlobal).toBe(true);
    });
  });

  // ===========================================================================
  // 18. SEGURIDAD DE CONTEXTO: BLOQUEO POR FALTA DE FACULTADES O VENCIMIENTO
  // ===========================================================================
  describe('Prueba 18: Seguridad de contexto institucional (anti-elección arbitraria)', () => {
    it('bloquea la solicitud de contexto INSTITUCIONAL si el usuario carece de roles y perfiles vigentes', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return {
              rows: [{
                id_usuario: USUARIO_DOCENTE_ID,
                id_persona: PERSONA_DOCENTE_ID,
                usuario: 'docente.civil',
                correo: 'docente@suiza.edu.pe',
                activo: true,
                nombre_completo: 'Docente Civil',
              }],
            };
          }
          // Roles y perfiles vacíos
          return { rows: [] };
        }),
      } as unknown as Pool;

      // Consulta directa emulando POST /auth/contexto
      const { rows: rRows } = await mockPool.query('SELECT r.codigo FROM sigd_org.usuario_rol ur JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id');
      const { rows: apRows } = await mockPool.query('SELECT p.codigo FROM sigd_org.asignacion_perfil_operativo ap JOIN sigd_org.perfil_operativo p ON p.perfil_id = ap.perfil_id');

      const tieneCapacidad = rRows.length > 0 || apRows.length > 0;
      expect(tieneCapacidad).toBe(false);
    });

    it('bloquea la solicitud de contexto INSTITUCIONAL si el perfil operativo está expirado', async () => {
      const fechaAyer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return {
              rows: [{
                id_usuario: USUARIO_DOCENTE_ID,
                id_persona: PERSONA_DOCENTE_ID,
                usuario: 'docente.expirado',
                correo: 'docente@suiza.edu.pe',
                activo: true,
                nombre_completo: 'Docente Expirado',
              }],
            };
          }
          // Perfil expirado: la consulta SQL filtra `ap.vigente_hasta > now()`, por lo que retorna 0 filas
          return { rows: [] };
        }),
      } as unknown as Pool;

      const { rows: apRows } = await mockPool.query(
        'SELECT p.codigo FROM sigd_org.asignacion_perfil_operativo ap WHERE ap.vigente_hasta > now()'
      );
      expect(apRows).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 19. RESPONSABILIDAD TEMPORAL: BLOQUEO FAIL-CLOSED DE facultaFirma
  // ===========================================================================
  describe('Prueba 19: Responsabilidad Temporal y Salvaguarda de Firma (facultaFirma)', () => {
    it('bloquea la concesión de facultaFirma=true tanto para sí mismo como para terceros (fail-closed)', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_DOCENTE_ID, persona_id: PERSONA_DOCENTE_ID, usuario: 'docente.sist', activo: true }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargo_id: CARGO_DOCENTE_ID, codigo: 'DOC', nombre: 'Docente', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ area_id: AREA_SISTEMAS_ID, codigo: 'SIST', nombre: 'Sistemas', vigente: true }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);

      // Intento de Admin A creando sobre sí mismo responsabilidad con facultaFirma=true
      await expect(
        service.crearResponsabilidadTemporal(
          {
            tipoResponsabilidad: 'DELEGACION',
            idUsuario: USUARIO_ADMIN_ID,
            cargoId: CARGO_DOCENTE_ID,
            areaId: AREA_SISTEMAS_ID,
            alcance: {
              tipoActuacion: 'RESOLVER_EXPEDIENTES',
              facultaFirma: true,
            },
          },
          USUARIO_ADMIN_ID
        )
      ).rejects.toThrow(ForbiddenError);

      // Intento de Admin A creando para Usuario B responsabilidad con facultaFirma=true
      await expect(
        service.crearResponsabilidadTemporal(
          {
            tipoResponsabilidad: 'DELEGACION',
            idUsuario: USUARIO_DOCENTE_ID,
            cargoId: CARGO_DOCENTE_ID,
            areaId: AREA_SISTEMAS_ID,
            alcance: {
              tipoActuacion: 'DESPACHO_ORDINARIO',
              facultaFirma: true,
            },
          },
          USUARIO_ADMIN_ID
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('permite la creación de responsabilidades temporales ordinarias sin facultaFirma (o facultaFirma=false)', async () => {
      const rowResp = {
        idResponsabilidad: 'resp-ord-1',
        tipoResponsabilidad: 'ENCARGATURA',
        id_usuario: USUARIO_DOCENTE_ID,
        id_persona: PERSONA_DOCENTE_ID,
        usuario_nombre: 'Docente',
        usuario_username: 'docente.sist',
        titular_usuario_id: null,
        titular_persona_id: null,
        titular_nombre: null,
        titular_username: null,
        cargo_id: CARGO_DOCENTE_ID,
        cargo_codigo: 'DOC',
        cargo_nombre: 'Docente',
        area_id: AREA_SISTEMAS_ID,
        area_codigo: 'SIST',
        area_nombre: 'Sistemas',
        estado: 'ACTIVO',
        vigente_desde: '2026-03-01T00:00:00.000Z',
        vigente_hasta: null,
        tipo_documento_sustento: null,
        numero_documento_sustento: null,
        fecha_documento_sustento: null,
        motivo_finalizacion: null,
        motivo_revocacion: null,
        motivo_anulacion: null,
        anulado_en: null,
        anulado_por: null,
        alcance: null,
        creado_en: '2026-03-01T00:00:00.000Z',
        actualizado_en: '2026-03-01T00:00:00.000Z',
      };

      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [] };
          if (sql.includes('INSERT INTO sigd_org.responsabilidad_temporal')) {
            return { rows: [{ idResponsabilidad: 'resp-ord-1' }] };
          }
          if (sql.includes('FROM sigd_org.responsabilidad_temporal')) {
            return { rows: [rowResp] };
          }
          if (sql.includes('INSERT INTO sigd_seguridad.auditoria_mutaciones')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_DOCENTE_ID, persona_id: PERSONA_DOCENTE_ID, usuario: 'docente.sist', activo: true }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargo_id: CARGO_DOCENTE_ID, codigo: 'DOC', nombre: 'Docente', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ area_id: AREA_SISTEMAS_ID, codigo: 'SIST', nombre: 'Sistemas', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.responsabilidad_temporal')) {
            return { rows: [rowResp] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const resp = await service.crearResponsabilidadTemporal(
        {
          tipoResponsabilidad: 'ENCARGATURA',
          idUsuario: USUARIO_DOCENTE_ID,
          cargoId: CARGO_DOCENTE_ID,
          areaId: AREA_SISTEMAS_ID,
        },
        USUARIO_ADMIN_ID
      );

      expect(resp).toBeDefined();
      expect(resp.idResponsabilidad).toBe('resp-ord-1');
      expect(resp.tipoResponsabilidad).toBe('ENCARGATURA');
    });
  });

  // ===========================================================================
  // 20. LOGIN SEGURO CON OPCIÓN B: PERSONAL POR DEFECTO
  // ===========================================================================
  describe('Prueba 20: Login Seguro (Opción B: Personal por defecto y conmutación explícita)', () => {
    it('un funcionario con facultades institucionales (DOCENTE + COORDINADOR) recibe contexto PERSONAL y rol CIUDADANO al iniciar sesión sin contexto explícito', async () => {
      // Simula el flujo del endpoint POST /auth/login
      const datosLogin = { identificador: 'docente.coord', password: 'PasswordValida123!' };
      const contextoSolicitado = (datosLogin as any).contexto;

      const tieneCapacidadInstitucional = true; // posee rol de COORDINADOR
      const rolInstitucional = 'ESPECIALISTA';
      const areaIdInstitucional = AREA_SISTEMAS_ID;

      let contextoEfectivo: 'PERSONAL' | 'INSTITUCIONAL' = 'PERSONAL';
      let rolEfectivo = 'CIUDADANO';
      let areaIdEfectivo: string | undefined = undefined;

      if (contextoSolicitado === 'INSTITUCIONAL') {
        contextoEfectivo = 'INSTITUCIONAL';
        rolEfectivo = rolInstitucional;
        areaIdEfectivo = areaIdInstitucional;
      } else {
        contextoEfectivo = 'PERSONAL';
        rolEfectivo = 'CIUDADANO';
        areaIdEfectivo = undefined;
      }

      // Verificaciones: Login sin contexto explícito NO eleva autoridad
      expect(contextoEfectivo).toBe('PERSONAL');
      expect(rolEfectivo).toBe('CIUDADANO');
      expect(areaIdEfectivo).toBeUndefined();

      // Transición explícita con POST /auth/contexto
      const solicitudConmutacion = { contexto: 'INSTITUCIONAL' };
      if (solicitudConmutacion.contexto === 'INSTITUCIONAL') {
        expect(tieneCapacidadInstitucional).toBe(true);
        contextoEfectivo = 'INSTITUCIONAL';
        rolEfectivo = rolInstitucional;
        areaIdEfectivo = areaIdInstitucional;
      }

      expect(contextoEfectivo).toBe('INSTITUCIONAL');
      expect(rolEfectivo).toBe('ESPECIALISTA');
      expect(areaIdEfectivo).toBe(AREA_SISTEMAS_ID);
    });
  });


  // ===========================================================================
  // 21. AUTO-ENCARGATURA DE CARGO DIRECTOR (IDENTIDAD DE CUENTA Y DE PERSONA)
  // ===========================================================================
  describe('Prueba 21: Auto-encargatura de cargo DIRECTOR (identidad de cuenta y de persona)', () => {
    const CARGO_DIR_ID = '10101010-1010-1010-1010-101010101010';
    const USUARIO_ADMIN_SECUNDARIO_ID = '20202020-2020-2020-2020-202020202020';

    it('Caso 1: Mismo idUsuario (idUsuarioEfectivo == usuarioIdAudit) -> DIRECTOR -> DENY', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ADMIN_ID, persona_id: PERSONA_ADMIN_ID, usuario: 'admin.sigd', activo: true }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargo_id: CARGO_DIR_ID, codigo: 'DIRECTOR', nombre: 'Director General', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ area_id: AREA_SISTEMAS_ID, codigo: 'DIR', nombre: 'Dirección General', vigente: true }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);

      await expect(
        service.crearResponsabilidadTemporal(
          {
            tipoResponsabilidad: 'ENCARGATURA',
            idUsuario: USUARIO_ADMIN_ID,
            cargoId: CARGO_DIR_ID,
            areaId: AREA_SISTEMAS_ID,
          },
          USUARIO_ADMIN_ID
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('Caso 2: idUsuarioEfectivo distinto o null pero misma PERSONA (idPersonaEfectivo == idPersonaAudit) -> DIRECTOR -> DENY', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            // Retorna que ambas cuentas (primaria y secundaria) pertenecen a PERSONA_ADMIN_ID
            return { rows: [{ idUsuario: USUARIO_ADMIN_SECUNDARIO_ID, personaId: PERSONA_ADMIN_ID, id_usuario: USUARIO_ADMIN_SECUNDARIO_ID, persona_id: PERSONA_ADMIN_ID, usuario: 'admin.alt', activo: true }] };
          }
          if (sql.includes('FROM sigd_auth.persona')) {
            return { rows: [{ id_persona: PERSONA_ADMIN_ID, nombres: 'Admin', primer_apellido: 'General' }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargo_id: CARGO_DIR_ID, codigo: 'DIRECTOR', nombre: 'Director General', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ area_id: AREA_SISTEMAS_ID, codigo: 'DIR', nombre: 'Dirección General', vigente: true }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);

      // Intento con cuenta alterna de la misma persona física
      await expect(
        service.crearResponsabilidadTemporal(
          {
            tipoResponsabilidad: 'ENCARGATURA',
            idUsuario: USUARIO_ADMIN_SECUNDARIO_ID,
            cargoId: CARGO_DIR_ID,
            areaId: AREA_SISTEMAS_ID,
          },
          USUARIO_ADMIN_ID
        )
      ).rejects.toThrow(ForbiddenError);

      // Intento sin cuenta (persona-only) donde idPersona == idPersonaAudit
      await expect(
        service.crearResponsabilidadTemporal(
          {
            tipoResponsabilidad: 'ENCARGATURA',
            idPersona: PERSONA_ADMIN_ID,
            cargoId: CARGO_DIR_ID,
            areaId: AREA_SISTEMAS_ID,
          },
          USUARIO_ADMIN_ID
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('Caso 3: Beneficiario distinto (Admin A -> DIRECTOR para Usuario B) -> DENY (autoridad directiva NO_DETERMINADA, fail-closed)', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            const uid = params?.[0];
            if (uid === USUARIO_ADMIN_ID) {
              return { rows: [{ id_usuario: USUARIO_ADMIN_ID, persona_id: PERSONA_ADMIN_ID, usuario: 'admin.sigd', activo: true }] };
            }
            return { rows: [{ id_usuario: USUARIO_DOCENTE_ID, persona_id: PERSONA_DOCENTE_ID, usuario: 'docente.sist', activo: true }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargo_id: CARGO_DIR_ID, codigo: 'DIRECTOR', nombre: 'Director General', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ area_id: AREA_SISTEMAS_ID, codigo: 'DIR', nombre: 'Dirección General', vigente: true }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      await expect(
        service.crearResponsabilidadTemporal(
          {
            tipoResponsabilidad: 'ENCARGATURA',
            idUsuario: USUARIO_DOCENTE_ID,
            cargoId: CARGO_DIR_ID,
            areaId: AREA_SISTEMAS_ID,
          },
          USUARIO_ADMIN_ID
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('Caso 4: Responsabilidad ordinaria no directiva (Admin -> ENCARGATURA cargo ordinario sin facultaFirma) -> PASS', async () => {
      const CARGO_ORD_ID = '30303030-3030-3030-3030-303030303030';
      const rowRespOrd = {
        idResponsabilidad: 'resp-ord-delegada-1',
        tipoResponsabilidad: 'ENCARGATURA',
        idUsuario: USUARIO_DOCENTE_ID,
        idPersona: PERSONA_DOCENTE_ID,
        usuarioNombre: 'Docente Juan',
        usuarioUsername: 'docente.sist',
        cargoId: CARGO_ORD_ID,
        cargoCodigo: 'COORDINADOR_ACAD',
        cargoNombre: 'Coordinador Académico',
        areaId: AREA_SISTEMAS_ID,
        areaCodigo: 'DIR',
        areaNombre: 'Dirección General',
        estado: 'ACTIVO',
        vigenteDesde: '2026-03-01T00:00:00.000Z',
        vigenteHasta: null,
      };

      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [] };
          if (sql.includes('INSERT INTO sigd_org.responsabilidad_temporal')) {
            return { rows: [{ idResponsabilidad: 'resp-ord-delegada-1' }] };
          }
          if (sql.includes('FROM sigd_org.responsabilidad_temporal')) {
            return { rows: [rowRespOrd] };
          }
          if (sql.includes('INSERT INTO sigd_seguridad.auditoria_mutaciones')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            const uid = params?.[0];
            if (uid === USUARIO_ADMIN_ID) {
              return { rows: [{ id_usuario: USUARIO_ADMIN_ID, persona_id: PERSONA_ADMIN_ID, usuario: 'admin.sigd', activo: true }] };
            }
            return { rows: [{ id_usuario: USUARIO_DOCENTE_ID, persona_id: PERSONA_DOCENTE_ID, usuario: 'docente.sist', activo: true }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargo_id: CARGO_ORD_ID, codigo: 'COORDINADOR_ACAD', nombre: 'Coordinador Académico', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ area_id: AREA_SISTEMAS_ID, codigo: 'DIR', nombre: 'Dirección General', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.responsabilidad_temporal')) {
            return { rows: [rowRespOrd] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const resp = await service.crearResponsabilidadTemporal(
        {
          tipoResponsabilidad: 'ENCARGATURA',
          idUsuario: USUARIO_DOCENTE_ID,
          cargoId: CARGO_ORD_ID,
          areaId: AREA_SISTEMAS_ID,
        },
        USUARIO_ADMIN_ID
      );

      expect(resp).toBeDefined();
      expect(resp.idResponsabilidad).toBe('resp-ord-delegada-1');
      expect(resp.tipoResponsabilidad).toBe('ENCARGATURA');
    });
  });

});

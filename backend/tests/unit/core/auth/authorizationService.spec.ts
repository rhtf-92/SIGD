/**
-- =============================================================================
-- Suite de Pruebas Unitarias para Autorización Contextual (Fase 5D)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Modelo Canónico de Autorización Contextual, Scopes y Segregación SIGD 2026
-- =============================================================================
*/

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { AuthorizationService } from '../../../../src/core/auth/authorization.service.js';
import { TesoreriaService } from '../../../../src/domains/tesoreria/tesoreria.service.js';
import { TesoreriaRepository } from '../../../../src/domains/tesoreria/tesoreria.repository.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../src/shared/domain/errors/index.js';

describe('SIGD Fase 5D — Autorización Contextual, Perfiles Operativos, BOLA y Segregación', () => {
  const USUARIO_ID = '11111111-1111-4111-8111-111111111111';
  const OTRO_USUARIO_ID = '22222222-2222-4222-8222-222222222222';
  const USUARIO_ADMIN_ID = '44444444-4444-4444-8444-444444444444';
  const PERSONA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const OTRA_PERSONA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const AREA_DIR_ID = 'a0000000-0000-0000-0000-000000000002';
  const AREA_SISTEMAS_ID = '77777777-7777-4777-8777-777777777777';
  const ASIGNACION_PERFIL_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  const tokenAdmin = firmarTokenAcceso({
    sub: USUARIO_ADMIN_ID,
    roles: ['ADMINISTRADOR'],
  });

  const tokenUsuario = firmarTokenAcceso({
    sub: USUARIO_ID,
    roles: ['ESPECIALISTA'],
  });

  function mockAuditQuery(sql: string) {
    if (sql.includes('sigd_audit.bitacora_auditoria')) {
      return { rows: [{ id_auditoria: 'aud-001' }] };
    }
    return null;
  }

  // ===========================================================================
  // 1. MOTOR DE AUTORIZACIÓN Y REGLAS FUNDAMENTALES
  // ===========================================================================

  describe('1. Reglas Fundamentales del Motor de Autorización', () => {
    it('1. Cuenta activa + permiso correcto -> ALLOW', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return {
              rows: [{ id_usuario: USUARIO_ID, usuario: 'maria.sistemas', correo: 'maria@iestp.edu.pe', activo: true }],
            };
          }
          if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('persona')) {
            return {
              rows: [{ id_persona: PERSONA_ID, nombres: 'María', primer_apellido: 'Pérez', segundo_apellido: null, id_tipo_documento: 1, numero_documento: '12345678' }],
            };
          }
          if (sql.includes('vinculo_institucional')) return { rows: [] };
          if (sql.includes('asignacion_personal')) {
            return {
              rows: [{
                id_asignacion: 'asig-1', cargo_id: 'cargo-1', cargo_codigo: 'DOC', cargo_nombre: 'Docente',
                area_id: AREA_SISTEMAS_ID, area_codigo: 'SIST', area_nombre: 'Sistemas', jerarquia: '1.2',
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
              }],
            };
          }
          if (sql.includes('responsabilidad_temporal')) return { rows: [] };
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 4, perfil_codigo: 'GESTOR_AREA_ACADEMICA',
                perfil_nombre: 'Gestor de Área Académica', area_id: AREA_SISTEMAS_ID, scope: 'AREA',
                id_responsabilidad: null, estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['EXPEDIENTE_VER', 'EXPEDIENTE_DERIVAR', 'EXPEDIENTE_RECIBIR'], alcance: null,
              }],
            };
          }
          if (sql.includes('usuario_rol')) return { rows: [] };
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_SISTEMAS_ID },
      });

      expect(resultado.autorizado).toBe(true);
      expect(resultado.perfilAplicado).toBe('GESTOR_AREA_ACADEMICA');
      expect(resultado.scopeAplicado).toBe('AREA');
    });

    it('2. Cuenta deshabilitada -> DENY (Fail-Closed inmediato)', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return {
              rows: [{ id_usuario: USUARIO_ID, usuario: 'maria.sistemas', correo: 'maria@iestp.edu.pe', activo: false }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_DERIVAR',
      });

      expect(resultado.autorizado).toBe(false);
      expect(resultado.codigoDenegacion).toBe('CUENTA_DESHABILITADA');
      expect(resultado.motivoInterno).toContain('deshabilitada');
    });

    it('3. Perfil operativo vencido -> DENY', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'maria', correo: 'm@i.pe', activo: true }] };
          }
          // El filtro temporal de la BD devuelve lista vacía porque vigente_hasta < now()
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_SISTEMAS_ID },
      });

      expect(resultado.autorizado).toBe(false);
      expect(resultado.codigoDenegacion).toBe('ACCESO_DENEGADO');
    });

    it('4. Asignación vencida -> DENY para acciones que requieran competencia de área', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'maria', correo: 'm@i.pe', activo: true }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 4, perfil_codigo: 'GESTOR_AREA_ACADEMICA',
                perfil_nombre: 'Gestor', area_id: null, scope: 'AREA', id_responsabilidad: null,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['EXPEDIENTE_DERIVAR'], alcance: null,
              }],
            };
          }
          // Asignación de personal no devuelta (vencida)
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_SISTEMAS_ID },
      });

      expect(resultado.autorizado).toBe(false);
    });

    it('5. Encargatura activa -> ALLOW dentro del cargo y área encargada', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'maria', correo: 'm@i.pe', activo: true }] };
          }
          if (sql.includes('responsabilidad_temporal')) {
            return {
              rows: [{
                id_responsabilidad: 'resp-encargatura', tipo_responsabilidad: 'ENCARGATURA',
                titular_usuario_id: null, cargo_id: 'cargo-coord', area_id: AREA_SISTEMAS_ID,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null, alcance: null,
              }],
            };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 4, perfil_codigo: 'GESTOR_AREA_ACADEMICA',
                perfil_nombre: 'Gestor', area_id: null, scope: 'AREA', id_responsabilidad: 'resp-encargatura',
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['EXPEDIENTE_DERIVAR'], alcance: null,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_SISTEMAS_ID },
      });

      expect(resultado.autorizado).toBe(true);
    });

    it('6. Encargatura vencida -> DENY en fecha posterior a su expiración', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'maria', correo: 'm@i.pe', activo: true }] };
          }
          // BD no devuelve la encargatura vencida
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_SISTEMAS_ID },
        fechaReferencia: new Date('2027-01-01'),
      });

      expect(resultado.autorizado).toBe(false);
    });

    it('7. Suplencia activa -> ALLOW durante su período de vigencia', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'maria', correo: 'm@i.pe', activo: true }] };
          }
          if (sql.includes('responsabilidad_temporal')) {
            return {
              rows: [{
                id_responsabilidad: 'resp-suplencia', tipo_responsabilidad: 'SUPLENCIA',
                titular_usuario_id: OTRO_USUARIO_ID, cargo_id: 'cargo-director', area_id: AREA_DIR_ID,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: '2026-12-31', alcance: null,
              }],
            };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 2, perfil_codigo: 'APROBADOR_DIRECCION',
                perfil_nombre: 'Aprobador Dirección', area_id: AREA_DIR_ID, scope: 'INSTITUCIONAL',
                id_responsabilidad: 'resp-suplencia', estado: 'ACTIVO', vigente_desde: '2026-01-01',
                vigente_hasta: '2026-12-31', permisos: ['EXPEDIENTE_RESOLVER', 'FIRMA_FIRMAR'], alcance: null,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_RESOLVER',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_DIR_ID },
      });

      expect(resultado.autorizado).toBe(true);
      expect(resultado.perfilAplicado).toBe('APROBADOR_DIRECCION');
    });

    it('8. Delegación activa con alcance estructurado -> ALLOW solo para actuación incluida', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'maria', correo: 'm@i.pe', activo: true }] };
          }
          if (sql.includes('responsabilidad_temporal')) {
            return {
              rows: [{
                id_responsabilidad: 'resp-delegacion', tipo_responsabilidad: 'DELEGACION',
                titular_usuario_id: null, cargo_id: 'cargo-1', area_id: AREA_DIR_ID,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                alcance: { tipoActuacion: 'FIRMA', materia: 'CERTIFICADOS_MODULARES' },
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'FIRMA_FIRMAR',
        recurso: { tipo: 'DOCUMENTO', areaId: AREA_DIR_ID },
      });

      expect(resultado.autorizado).toBe(true);
      expect(resultado.perfilAplicado).toContain('DELEGACION');
    });

    it('9. Delegación fuera de alcance -> DENY', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'maria', correo: 'm@i.pe', activo: true }] };
          }
          if (sql.includes('responsabilidad_temporal')) {
            return {
              rows: [{
                id_responsabilidad: 'resp-delegacion', tipo_responsabilidad: 'DELEGACION',
                titular_usuario_id: null, cargo_id: 'cargo-1', area_id: AREA_DIR_ID,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                alcance: { tipoActuacion: 'FIRMA', materia: 'CERTIFICADOS_MODULARES' },
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_ARCHIVAR', // Fuera de la delegación de FIRMA
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_DIR_ID },
      });

      expect(resultado.autorizado).toBe(false);
    });

    it('10. Área incorrecta -> DENY', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'maria', correo: 'm@i.pe', activo: true }] };
          }
          if (sql.includes('asignacion_personal')) {
            return {
              rows: [{
                id_asignacion: 'asig-1', cargo_id: 'cargo-1', cargo_codigo: 'DOC', cargo_nombre: 'Docente',
                area_id: AREA_SISTEMAS_ID, area_codigo: 'SIST', area_nombre: 'Sistemas', jerarquia: '1.2',
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
              }],
            };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 4, perfil_codigo: 'GESTOR_AREA_ACADEMICA',
                perfil_nombre: 'Gestor', area_id: AREA_SISTEMAS_ID, scope: 'AREA', id_responsabilidad: null,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['EXPEDIENTE_DERIVAR'], alcance: null,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_DIR_ID }, // Intenta derivar expediente de Dirección
      });

      expect(resultado.autorizado).toBe(false);
    });
  });

  // ===========================================================================
  // 2. SCOPES, BOLA Y SEGREGACIÓN DE FUNCIONES
  // ===========================================================================

  describe('2. Scopes, BOLA y Segregación de Funciones', () => {
    it('11. Scope PROPIO: usuario ve recurso propio -> ALLOW', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'ciudadano.demo', correo: 'c@i.pe', activo: true }] };
          }
          if (sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_ID, nombres: 'Juan', primer_apellido: 'Pérez', segundo_apellido: null, id_tipo_documento: 1, numero_documento: '44445555' }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 5, perfil_codigo: 'GESTOR_CIUDADANO',
                perfil_nombre: 'Ciudadano', area_id: null, scope: 'PROPIO', id_responsabilidad: null,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['EXPEDIENTE_VER'], alcance: null,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_VER',
        recurso: { tipo: 'EXPEDIENTE', propietarioPersonaId: PERSONA_ID },
      });

      expect(resultado.autorizado).toBe(true);
      expect(resultado.scopeAplicado).toBe('PROPIO');
    });

    it('12. Scope PROPIO + recurso ajeno -> DENY con BOLA_VIOLATION_RECURSO_AJENO', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'ciudadano.demo', correo: 'c@i.pe', activo: true }] };
          }
          if (sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_ID, nombres: 'Juan', primer_apellido: 'Pérez', segundo_apellido: null, id_tipo_documento: 1, numero_documento: '44445555' }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 5, perfil_codigo: 'GESTOR_CIUDADANO',
                perfil_nombre: 'Ciudadano', area_id: null, scope: 'PROPIO', id_responsabilidad: null,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['EXPEDIENTE_VER'], alcance: null,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_VER',
        recurso: { tipo: 'EXPEDIENTE', propietarioPersonaId: OTRA_PERSONA_ID },
      });

      expect(resultado.autorizado).toBe(false);
      expect(resultado.codigoDenegacion).toBe('ACCESO_DENEGADO');
    });

    it('13. EXPEDIENTE_ASIGNADO: solo expediente explícitamente asignado', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'docente.eval', correo: 'd@i.pe', activo: true }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 6, perfil_codigo: 'DOCENTE_EVALUADOR',
                perfil_nombre: 'Evaluador', area_id: null, scope: 'EXPEDIENTE_ASIGNADO', id_responsabilidad: null,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['EXPEDIENTE_ATENDER'], alcance: null,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);

      // Expediente asignado a este docente -> ALLOW
      const ok = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_ATENDER',
        recurso: { tipo: 'EXPEDIENTE', expedienteAsignadoAUsuarioId: USUARIO_ID },
      });
      expect(ok.autorizado).toBe(true);

      // Expediente asignado a otro docente -> DENY
      const deny = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_ATENDER',
        recurso: { tipo: 'EXPEDIENTE', expedienteAsignadoAUsuarioId: OTRO_USUARIO_ID },
      });
      expect(deny.autorizado).toBe(false);
    });

    it('14. BOLA: exigirAutorizacion arroja ForbiddenError fail-closed si cambia el ID', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'c', correo: 'c@i.pe', activo: true }] };
          }
          if (sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_ID, nombres: 'J', primer_apellido: 'P', segundo_apellido: null, id_tipo_documento: 1, numero_documento: '44' }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      await expect(
        service.exigirAutorizacion({
          usuarioId: USUARIO_ID,
          accion: 'EXPEDIENTE_VER',
          recurso: { tipo: 'EXPEDIENTE', propietarioPersonaId: OTRA_PERSONA_ID },
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('15. Administrador técnico: ADMINISTRADOR_SIGD NO obtiene automáticamente permiso de resolución de negocio', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ADMIN_ID, usuario: 'admin', correo: 'a@i.pe', activo: true }] };
          }
          if (sql.includes('usuario_rol')) {
            return { rows: [{ codigo: 'ADMINISTRADOR' }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 1, perfil_codigo: 'ADMINISTRADOR_SIGD',
                perfil_nombre: 'Admin SIGD', area_id: null, scope: 'GLOBAL_TECNICO', id_responsabilidad: null,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['ORGANIZACION_GESTIONAR', 'CUENTA_GESTIONAR', 'ADMIN_USUARIOS'], alcance: null,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);

      // Mutación técnica permitida
      const resTecnico = await service.autorizar({
        usuarioId: USUARIO_ADMIN_ID,
        accion: 'ORGANIZACION_GESTIONAR',
      });
      expect(resTecnico.autorizado).toBe(true);

      // Resolución de negocio prohibida para administrador puramente técnico
      const resNegocio = await service.autorizar({
        usuarioId: USUARIO_ADMIN_ID,
        accion: 'EXPEDIENTE_RESOLVER',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_DIR_ID },
      });
      expect(resNegocio.autorizado).toBe(false);
      expect(resNegocio.codigoDenegacion).toBe('PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO');
    });

    it('16. Tesorería: puede ejecutar operaciones financieras pero no aprobar trámites de negocio', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'tesorero', correo: 't@i.pe', activo: true }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 6, perfil_codigo: 'GESTOR_TESORERIA',
                perfil_nombre: 'Tesorería', area_id: null, scope: 'INSTITUCIONAL', id_responsabilidad: null,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['PAGO_VER', 'PAGO_REGISTRAR', 'DEVOLUCION_EJECUTAR'], alcance: null,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);

      const opFinanciera = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'PAGO_REGISTRAR',
        recurso: { tipo: 'PAGO' },
      });
      expect(opFinanciera.autorizado).toBe(true);

      const opNegocio = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_RESOLVER',
        recurso: { tipo: 'EXPEDIENTE' },
      });
      expect(opNegocio.autorizado).toBe(false);
    });

    it('17. Autoaprobación: deniega si el solicitante intenta aprobar su propia solicitud', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'operador', correo: 'op@i.pe', activo: true }] };
          }
          if (sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_ID, nombres: 'Op', primer_apellido: 'P', segundo_apellido: null, id_tipo_documento: 1, numero_documento: '11' }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 3, perfil_codigo: 'GESTOR_RECEPCION_DOCUMENTAL',
                perfil_nombre: 'Mesa', area_id: null, scope: 'INSTITUCIONAL', id_responsabilidad: null,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['DEVOLUCION_AUTORIZAR'], alcance: null,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'DEVOLUCION_AUTORIZAR',
        recurso: {
          tipo: 'DEVOLUCION',
          solicitanteUsuarioId: USUARIO_ID, // Mismo usuario que solicita
          solicitantePersonaId: PERSONA_ID,
        },
      });

      expect(resultado.autorizado).toBe(false);
      expect(resultado.codigoDenegacion).toBe('AUTOAPROBACION_PROHIBIDA');
    });

    it('18. Devolución segregada: quien autoriza no puede ejecutar la misma devolución', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'tesorero', correo: 't@i.pe', activo: true }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, perfil_id: 6, perfil_codigo: 'GESTOR_TESORERIA',
                perfil_nombre: 'Tesorería', area_id: null, scope: 'INSTITUCIONAL', id_responsabilidad: null,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                permisos: ['DEVOLUCION_EJECUTAR'], alcance: null,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'DEVOLUCION_EJECUTAR',
        recurso: {
          tipo: 'DEVOLUCION',
          autorizadorUsuarioId: USUARIO_ID, // Mismo usuario que autorizó previamente
        },
      });

      expect(resultado.autorizado).toBe(false);
      expect(resultado.codigoDenegacion).toBe('SEGREGACION_FUNCIONES_VIOLADA');
    });

    it('19. Historial: asignación de perfil finalizada permanece consultable', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (mockAuditQuery(sql)) return mockAuditQuery(sql);
          if (sql.includes('UPDATE sigd_org.asignacion_perfil_operativo')) {
            return { rows: [{ id_asignacion_perfil: ASIGNACION_PERFIL_ID }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_org.asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, id_usuario: USUARIO_ID, perfil_id: 4,
                perfil_codigo: 'GESTOR_AREA_ACADEMICA', perfil_nombre: 'Gestor', area_id: AREA_SISTEMAS_ID,
                area_codigo: 'SIST', area_nombre: 'Sistemas', scope: 'AREA', id_responsabilidad: null,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                tipo_documento_sustento: 'RD', numero_documento_sustento: '001',
                fecha_documento_sustento: '2026-01-01', alcance: null, motivo_finalizacion: null,
                motivo_revocacion: null, motivo_anulacion: null, anulado_en: null, anulado_por: null,
                creado_en: '2026-01-01', actualizado_en: '2026-01-01',
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const res = await service.finalizarAsignacionPerfil(
        ASIGNACION_PERFIL_ID,
        '2026-11-08T00:00:00Z',
        'Fin de semestre',
        USUARIO_ADMIN_ID,
      );

      expect(res).toBeDefined();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('20. Concurrencia y Revocación: asignación revocada no permite mutaciones repetidas', async () => {
      const mockPool = {
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockImplementation((sql: string) => {
            if (mockAuditQuery(sql)) return mockAuditQuery(sql);
            return { rows: [] };
          }),
          release: vi.fn(),
        }),
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_org.asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, id_usuario: USUARIO_ID, perfil_id: 4,
                perfil_codigo: 'GESTOR_AREA_ACADEMICA', perfil_nombre: 'Gestor', area_id: AREA_SISTEMAS_ID,
                estado: 'REVOCADO', vigente_desde: '2026-01-01', vigente_hasta: '2026-11-08',
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      await expect(
        service.revocarAsignacionPerfil(
          ASIGNACION_PERFIL_ID,
          '2026-11-08',
          'Motivo repetido',
          USUARIO_ADMIN_ID,
        ),
      ).rejects.toThrow(ConflictError);
    });
  });

  // ===========================================================================
  // 3. PRUEBAS DE INTEGRACIÓN DE ENDPOINTS API REST
  // ===========================================================================

  describe('3. Integración de Endpoints REST de Autorización', () => {
    it('GET /api/v1/autorizacion/perfiles lista catálogo de perfiles vigentes', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_org.perfil_operativo')) {
            return {
              rows: [
                { perfil_id: 1, codigo: 'ADMINISTRADOR_SIGD', nombre: 'Admin', descripcion: 'd', vigente: true, creado_en: '2026-01-01' },
                { perfil_id: 2, codigo: 'APROBADOR_DIRECCION', nombre: 'Director', descripcion: 'd', vigente: true, creado_en: '2026-01-01' },
              ],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = construirApp(mockPool);
      const res = await request(app)
        .get('/api/v1/autorizacion/perfiles')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.perfiles).toHaveLength(2);
      expect(res.body.perfiles[0].codigo).toBe('ADMINISTRADOR_SIGD');
    });

    it('GET /api/v1/autorizacion/mi-contexto devuelve contexto resuelto del usuario', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario') && !sql.includes('persona')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'maria', correo: 'm@i.pe', activo: true }] };
          }
          if (sql.includes('persona')) {
            return { rows: [{ id_persona: PERSONA_ID, nombres: 'María', primer_apellido: 'Pérez', segundo_apellido: null, id_tipo_documento: 1, numero_documento: '12' }] };
          }
          if (sql.includes('usuario_rol')) {
            return { rows: [{ codigo: 'ESPECIALISTA' }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = construirApp(mockPool);
      const res = await request(app)
        .get('/api/v1/autorizacion/mi-contexto')
        .set('Authorization', `Bearer ${tokenUsuario}`);

      expect(res.status).toBe(200);
      expect(res.body.contexto).toBeDefined();
      expect(res.body.contexto.cuenta.usuario).toBe('maria');
      expect(res.body.contexto.persona.nombres).toBe('María');
      expect(res.body.contexto.rolesCanonicos).toContain('ESPECIALISTA');
    });

    it('POST /api/v1/autorizacion/asignaciones crea asignación de perfil con rol ADMINISTRADOR', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (mockAuditQuery(sql)) return mockAuditQuery(sql);
          if (sql.includes('INSERT INTO sigd_org.asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, id_usuario: USUARIO_ID, perfil_id: 4,
                area_id: AREA_SISTEMAS_ID, scope: 'AREA', id_responsabilidad: null, estado: 'ACTIVO',
                vigente_desde: '2026-01-01', vigente_hasta: null, tipo_documento_sustento: null,
                numero_documento_sustento: null, fecha_documento_sustento: null, alcance: null,
                creado_en: '2026-01-01', actualizado_en: '2026-01-01',
              }],
            };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'maria', correo: 'm@i.pe', activo: true }] };
          }
          if (sql.includes('perfil_operativo') && sql.includes('codigo = $1')) {
            return { rows: [{ perfil_id: 4, codigo: 'GESTOR_AREA_ACADEMICA', nombre: 'Gestor', vigente: true, creado_en: '2026-01-01' }] };
          }
          if (sql.includes('asignacion_perfil_operativo') && sql.includes('id_asignacion_perfil = $1')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID, id_usuario: USUARIO_ID, perfil_id: 4,
                perfil_codigo: 'GESTOR_AREA_ACADEMICA', perfil_nombre: 'Gestor', area_id: AREA_SISTEMAS_ID,
                area_codigo: 'SIST', area_nombre: 'Sistemas', scope: 'AREA', id_responsabilidad: null,
                estado: 'ACTIVO', vigente_desde: '2026-01-01', vigente_hasta: null,
                tipo_documento_sustento: null, numero_documento_sustento: null,
                fecha_documento_sustento: null, alcance: null, motivo_finalizacion: null,
                motivo_revocacion: null, motivo_anulacion: null, anulado_en: null, anulado_por: null,
                creado_en: '2026-01-01', actualizado_en: '2026-01-01',
              }],
            };
          }
          if (sql.includes('usuario_rol')) {
            return { rows: [{ codigo: 'ADMINISTRADOR' }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = construirApp(mockPool);
      const res = await request(app)
        .post('/api/v1/autorizacion/asignaciones')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          idUsuario: USUARIO_ID,
          perfilCodigo: 'GESTOR_AREA_ACADEMICA',
          areaId: AREA_SISTEMAS_ID,
          scope: 'AREA',
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.asignacion.idAsignacionPerfil).toBe(ASIGNACION_PERFIL_ID);
    });

    it('POST /api/v1/autorizacion/asignaciones deniega con 403 a usuarios no administradores', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'maria', correo: 'm@i.pe', activo: true }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = construirApp(mockPool);
      const res = await request(app)
        .post('/api/v1/autorizacion/asignaciones')
        .set('Authorization', `Bearer ${tokenUsuario}`)
        .send({
          idUsuario: USUARIO_ID,
          perfilCodigo: 'GESTOR_AREA_ACADEMICA',
        });

      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // 4. FLUJO COMPLETO DE SEGREGACIÓN EN DEVOLUCIONES (CASOS A, B, C, D, E)
  // ===========================================================================

  describe('4. Flujo Real de Segregación en Devoluciones (Casos A, B, C, D, E)', () => {
    const SOLICITUD_DEV_ID = 'dev-00000000-0000-4000-8000-000000000001';
    const ORDEN_PAGO_ID = 'pag-00000000-0000-4000-8000-000000000001';
    const USUARIO_SOLICITANTE_ID = 'user-solicitante-001';
    const USUARIO_AUTORIZADOR_A = 'user-autorizador-a';
    const USUARIO_EJECUTOR_B = 'user-ejecutor-b';
    const USUARIO_ADMIN_TECNICO = 'user-admin-tecnico';

    function crearTesoreriaMockSetup(opts: {
      solicitanteId?: string;
      aprobadoPorId?: string | null;
      estadoSolicitud?: 'SOLICITADA' | 'EN_REVISION' | 'PENDIENTE_TESORERIA';
      cuentasActivas?: Record<string, boolean>;
      perfilesUsuario?: Record<string, string[]>;
      perfilesExpirados?: Record<string, boolean>;
    } = {}) {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
            return { rows: [] };
          }
          if (mockAuditQuery(sql)) return mockAuditQuery(sql);
          if (sql.includes('evento_outbox')) {
            return { rows: [{ id_evento: 'evt-001' }] };
          }
          if (sql.includes('UPDATE sigd_tra.solicitud_devolucion')) {
            return { rows: [{ solicitud_devolucion_id: SOLICITUD_DEV_ID }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            const uid = params?.[0];
            const activo = opts.cuentasActivas?.[uid] ?? true;
            return { rows: [{ id_usuario: uid, usuario: uid, correo: `${uid}@iestp.edu.pe`, activo }] };
          }
          if (sql.includes('sigd_audit.bitacora_auditoria')) {
            return { rows: [{ id_auditoria: 'aud-001' }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            const uid = params?.[0];
            if (opts.perfilesExpirados?.[uid]) {
              return { rows: [] };
            }
            const codigos = opts.perfilesUsuario?.[uid] ?? (
              uid === USUARIO_AUTORIZADOR_A
                ? ['AUTORIZADOR_DEVOLUCION']
                : uid === USUARIO_EJECUTOR_B
                ? ['GESTOR_TESORERIA']
                : []
            );
            return {
              rows: codigos.map((cod, idx) => ({
                id_asignacion_perfil: `asig-perf-${idx}`,
                perfil_id: idx + 1,
                perfil_codigo: cod,
                perfil_nombre: cod,
                area_id: null,
                scope: 'INSTITUCIONAL',
                id_responsabilidad: null,
                estado: 'ACTIVO',
                vigente_desde: '2026-01-01',
                vigente_hasta: null,
                permisos: cod === 'AUTORIZADOR_DEVOLUCION'
                  ? ['DEVOLUCION_AUTORIZAR']
                  : cod === 'GESTOR_RECEPCION_DOCUMENTAL'
                  ? ['DEVOLUCION_REVISAR', 'EXPEDIENTE_RECIBIR']
                  : cod === 'GESTOR_TESORERIA'
                  ? ['DEVOLUCION_EJECUTAR', 'PAGO_VER', 'PAGO_REGISTRAR']
                  : cod === 'ADMINISTRADOR_SIGD'
                  ? ['ORGANIZACION_GESTIONAR', 'CUENTA_GESTIONAR', 'ADMIN_USUARIOS']
                  : [],
                alcance: null,
              })),
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const repository = new TesoreriaRepository();
      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorIdConLock').mockResolvedValue({
        solicitud_devolucion_id: SOLICITUD_DEV_ID,
        orden_pago_id: ORDEN_PAGO_ID,
        cuenta_usuario_id: opts.solicitanteId ?? USUARIO_SOLICITANTE_ID,
        solicitante_id: PERSONA_ID,
        monto_solicitado: '100.00',
        estado: opts.estadoSolicitud ?? 'EN_REVISION',
        aprobado_por_id: opts.aprobadoPorId ?? null,
      } as any);

      vi.spyOn(repository, 'obtenerOrdenPorIdConLock').mockResolvedValue({
        orden_pago_id: ORDEN_PAGO_ID,
        monto: '100.00',
        estado: 'CONFIRMADO',
      } as any);

      vi.spyOn(repository, 'calcularSaldoDevolviblePago').mockResolvedValue(100);
      vi.spyOn(repository, 'obtenerSiguienteCodigoCdev').mockResolvedValue('CDEV-2026-000001');
      vi.spyOn(repository, 'actualizarSolicitudDevolucion').mockResolvedValue();
      vi.spyOn(repository, 'obtenerSolicitudDevolucionPorId').mockResolvedValue({
        solicitud_devolucion_id: SOLICITUD_DEV_ID,
        orden_pago_id: ORDEN_PAGO_ID,
        cuenta_usuario_id: opts.solicitanteId ?? USUARIO_SOLICITANTE_ID,
        solicitante_id: PERSONA_ID,
        monto_solicitado: '100.00',
        monto_autorizado: '100.00',
        monto_devuelto: '100.00',
        estado: opts.estadoSolicitud === 'PENDIENTE_TESORERIA' ? 'DEVUELTA' : 'PENDIENTE_TESORERIA',
        aprobado_por_id: opts.aprobadoPorId ?? USUARIO_AUTORIZADOR_A,
      } as any);

      const authService = new AuthorizationService(mockPool);
      const tesoreriaService = new TesoreriaService(
        mockPool,
        repository,
        undefined,
        undefined,
        authService,
      );

      return { tesoreriaService, mockClient, mockPool, authService };
    }

    it('Caso A: Solicitante intenta autorizar su propia devolución -> DENY (Autoaprobación prohibida)', async () => {
      const { tesoreriaService } = crearTesoreriaMockSetup({
        solicitanteId: USUARIO_SOLICITANTE_ID,
      });

      await expect(
        tesoreriaService.aprobarDevolucion(
          SOLICITUD_DEV_ID,
          100,
          'Intento de autoaprobación',
          USUARIO_SOLICITANTE_ID,
          ['MESA_PARTES'],
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('Caso B: Autorizador A ejecuta la misma devolución -> DENY (Segregación de funciones)', async () => {
      const { tesoreriaService } = crearTesoreriaMockSetup({
        solicitanteId: USUARIO_SOLICITANTE_ID,
        aprobadoPorId: USUARIO_AUTORIZADOR_A,
        estadoSolicitud: 'PENDIENTE_TESORERIA',
      });

      await expect(
        tesoreriaService.ejecutarDevolucion(
          SOLICITUD_DEV_ID,
          'TRANSFERENCIA',
          'Intento de ejecución por autorizador',
          USUARIO_AUTORIZADOR_A,
          ['TESORERIA'],
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('Caso C: Actor con AUTORIZADOR_DEVOLUCION vigente autoriza -> ALLOW', async () => {
      const { tesoreriaService, mockClient } = crearTesoreriaMockSetup({
        solicitanteId: USUARIO_SOLICITANTE_ID,
      });

      const res = await tesoreriaService.aprobarDevolucion(
        SOLICITUD_DEV_ID,
        100,
        'Aprobación legítima por autorizador competente',
        USUARIO_AUTORIZADOR_A,
        ['MESA_PARTES'],
      );

      expect(res.estado).toBe('PENDIENTE_TESORERIA');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('Caso D: MESA_PARTES legacy sin perfil autorizador intenta autorizar -> DENY', async () => {
      const { tesoreriaService } = crearTesoreriaMockSetup({
        solicitanteId: USUARIO_SOLICITANTE_ID,
        perfilesUsuario: {
          ['user-mesa-sin-perfil']: ['GESTOR_RECEPCION_DOCUMENTAL'],
        },
      });

      await expect(
        tesoreriaService.aprobarDevolucion(
          SOLICITUD_DEV_ID,
          100,
          'Intento de aprobación sin perfil autorizador',
          'user-mesa-sin-perfil',
          ['MESA_PARTES'],
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('Caso E: ADMINISTRADOR técnico sin perfil autorizador intenta autorizar -> DENY', async () => {
      const { tesoreriaService } = crearTesoreriaMockSetup({
        solicitanteId: USUARIO_SOLICITANTE_ID,
        perfilesUsuario: {
          [USUARIO_ADMIN_TECNICO]: ['ADMINISTRADOR_SIGD'],
        },
      });

      await expect(
        tesoreriaService.aprobarDevolucion(
          SOLICITUD_DEV_ID,
          100,
          'Aprobación indebida por administrador técnico',
          USUARIO_ADMIN_TECNICO,
          ['ADMINISTRADOR'],
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('Caso F: TESORERIA legacy sin perfil GESTOR_TESORERIA intenta ejecutar -> DEVOLUCION_EJECUTAR -> DENY', async () => {
      const { tesoreriaService } = crearTesoreriaMockSetup({
        solicitanteId: USUARIO_SOLICITANTE_ID,
        aprobadoPorId: USUARIO_AUTORIZADOR_A,
        estadoSolicitud: 'PENDIENTE_TESORERIA',
        perfilesUsuario: {
          ['user-tesoreria-legacy-puro']: [],
        },
      });

      await expect(
        tesoreriaService.ejecutarDevolucion(
          SOLICITUD_DEV_ID,
          'TRANSFERENCIA',
          'Ejecución sin perfil 5D por rol legacy',
          'user-tesoreria-legacy-puro',
          ['TESORERIA'],
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('Caso G: GESTOR_TESORERIA vigente ejecuta devolución autorizada por otra persona -> ALLOW', async () => {
      const { tesoreriaService, mockClient } = crearTesoreriaMockSetup({
        solicitanteId: USUARIO_SOLICITANTE_ID,
        aprobadoPorId: USUARIO_AUTORIZADOR_A,
        estadoSolicitud: 'PENDIENTE_TESORERIA',
      });

      const res = await tesoreriaService.ejecutarDevolucion(
        SOLICITUD_DEV_ID,
        'TRANSFERENCIA',
        'Desembolso legítimo por Tesorero B',
        USUARIO_EJECUTOR_B,
        ['TESORERIA'],
      );

      expect(res.estado).toBe('DEVUELTA');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('Caso H: Perfil de autorización vencido -> DENY', async () => {
      const { tesoreriaService } = crearTesoreriaMockSetup({
        solicitanteId: USUARIO_SOLICITANTE_ID,
        perfilesExpirados: {
          [USUARIO_AUTORIZADOR_A]: true,
        },
      });

      await expect(
        tesoreriaService.aprobarDevolucion(
          SOLICITUD_DEV_ID,
          100,
          'Intento con perfil expirado',
          USUARIO_AUTORIZADOR_A,
          ['MESA_PARTES'],
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('Caso I: Cuenta deshabilitada aunque conserve perfil -> DENY', async () => {
      const { tesoreriaService } = crearTesoreriaMockSetup({
        solicitanteId: USUARIO_SOLICITANTE_ID,
        cuentasActivas: {
          [USUARIO_AUTORIZADOR_A]: false,
        },
      });

      await expect(
        tesoreriaService.aprobarDevolucion(
          SOLICITUD_DEV_ID,
          100,
          'Intento con cuenta inactiva',
          USUARIO_AUTORIZADOR_A,
          ['MESA_PARTES'],
        ),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ===========================================================================
  // 5. SEMÁNTICA DE SCOPE AREA VS SUBARBOL CON JERARQUÍAS LTREE
  // ===========================================================================

  describe('5. Semántica de Scopes AREA vs SUBARBOL con Jerarquías Ltree', () => {
    const AREA_PADRE_ID = 'area-padre-0000-0000-000000000001';
    const AREA_HIJA_ID = 'area-hija-0000-0000-000000000002';
    const AREA_AJENA_ID = 'area-ajena-0000-0000-000000000003';

    it('Scope AREA: Área A sobre Área A -> ALLOW; Área A sobre hija A.1 -> DENY', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'gestor.area', correo: 'g@i.pe', activo: true }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID,
                perfil_id: 4,
                perfil_codigo: 'GESTOR_AREA_ACADEMICA',
                perfil_nombre: 'Gestor',
                area_id: AREA_PADRE_ID,
                scope: 'AREA',
                id_responsabilidad: null,
                estado: 'ACTIVO',
                vigente_desde: '2026-01-01',
                vigente_hasta: null,
                permisos: ['EXPEDIENTE_DERIVAR'],
                alcance: null,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);

      // Mismo área padre -> ALLOW
      const allow = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_PADRE_ID },
      });
      expect(allow.autorizado).toBe(true);

      // Área hija con scope AREA estricto -> DENY (no desciende)
      const deny = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_HIJA_ID },
      });
      expect(deny.autorizado).toBe(false);
    });

    it('Scope SUBARBOL: Área A sobre hija A.1 -> ALLOW; Área A sobre ajena B -> DENY', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ID, usuario: 'gestor.subarbol', correo: 'g@i.pe', activo: true }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [{
                id_asignacion_perfil: ASIGNACION_PERFIL_ID,
                perfil_id: 4,
                perfil_codigo: 'GESTOR_AREA_ACADEMICA',
                perfil_nombre: 'Gestor Subarbol',
                area_id: AREA_PADRE_ID,
                scope: 'SUBARBOL',
                id_responsabilidad: null,
                estado: 'ACTIVO',
                vigente_desde: '2026-01-01',
                vigente_hasta: null,
                permisos: ['EXPEDIENTE_DERIVAR'],
                alcance: null,
              }],
            };
          }
          if (sql.includes('hijo.jerarquia <@ padre.jerarquia')) {
            const hijoId = params?.[1];
            return { rows: [{ coincide: hijoId === AREA_HIJA_ID }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);

      // Área hija dentro del subárbol ltree -> ALLOW
      const allow = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_HIJA_ID },
      });
      expect(allow.autorizado).toBe(true);
      expect(allow.scopeAplicado).toBe('SUBARBOL');

      // Área ajena fuera del subárbol ltree -> DENY
      const deny = await service.autorizar({
        usuarioId: USUARIO_ID,
        accion: 'EXPEDIENTE_DERIVAR',
        recurso: { tipo: 'EXPEDIENTE', areaId: AREA_AJENA_ID },
      });
      expect(deny.autorizado).toBe(false);
    });
  });

  // ===========================================================================
  // 6. ADOPCIÓN 5D EN ORGANIZACIÓN (ORGANIZACION_GESTIONAR)
  // ===========================================================================

  describe('6. Adopción 5D en Organización (ORGANIZACION_GESTIONAR)', () => {
    it('ADMINISTRADOR legacy sin perfil ADMINISTRADOR_SIGD -> DENY', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ADMIN_ID, usuario: 'admin.legacy', correo: 'a@i.pe', activo: true }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return { rows: [] }; // Sin perfiles 5D asignados
          }
          if (sql.includes('usuario_rol')) {
            return { rows: [{ codigo: 'ADMINISTRADOR' }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ADMIN_ID,
        rolesDeclarados: ['ADMINISTRADOR'],
        accion: 'ORGANIZACION_GESTIONAR',
      });

      expect(resultado.autorizado).toBe(false);
      expect(resultado.codigoDenegacion).toBe('ACCESO_DENEGADO');
    });

    it('ADMINISTRADOR_SIGD vigente con ORGANIZACION_GESTIONAR -> ALLOW', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_usuario: USUARIO_ADMIN_ID, usuario: 'admin.5d', correo: 'a@i.pe', activo: true }] };
          }
          if (sql.includes('asignacion_perfil_operativo')) {
            return {
              rows: [
                {
                  id_asignacion_perfil: ASIGNACION_PERFIL_ID,
                  perfil_id: 1,
                  perfil_codigo: 'ADMINISTRADOR_SIGD',
                  perfil_nombre: 'Administrador SIGD',
                  area_id: null,
                  scope: 'GLOBAL_TECNICO',
                  id_responsabilidad: null,
                  estado: 'ACTIVO',
                  vigente_desde: '2026-01-01',
                  vigente_hasta: null,
                  permisos: ['ORGANIZACION_GESTIONAR', 'CUENTA_GESTIONAR', 'ADMIN_USUARIOS'],
                  alcance: null,
                },
              ],
            };
          }
          if (sql.includes('usuario_rol')) {
            return { rows: [{ codigo: 'ADMINISTRADOR' }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new AuthorizationService(mockPool);
      const resultado = await service.autorizar({
        usuarioId: USUARIO_ADMIN_ID,
        rolesDeclarados: ['ADMINISTRADOR'],
        accion: 'ORGANIZACION_GESTIONAR',
      });

      expect(resultado.autorizado).toBe(true);
      expect(resultado.perfilAplicado).toBe('ADMINISTRADOR_SIGD');
      expect(resultado.scopeAplicado).toBe('GLOBAL_TECNICO');
    });
  });
});

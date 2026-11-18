/**
 * Suite de Pruebas Unitarias para Organización y Responsabilidades Temporales (Fase 5C)
 * Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
 */

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { OrganizacionService } from '../../../../src/domains/organicore/organizacion.service.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../../../../src/shared/domain/errors/index.js';

describe('SIGD Fase 5C — Estructura Orgánica y Responsabilidades Temporales', () => {
  const USUARIO_TITULAR_ID = '11111111-1111-4111-8111-111111111111';
  const USUARIO_SUPLENTE_ID = '22222222-2222-4222-8222-222222222222';
  const USUARIO_ADMIN_ID = '44444444-4444-4444-8444-444444444444';
  const CARGO_COORDINADOR_ID = '55555555-5555-4555-8555-555555555555';
  const CARGO_DOCENTE_ID = '66666666-6666-4666-8666-666666666666';
  const AREA_DIR_ID = 'a0000000-0000-0000-0000-000000000002';
  const AREA_SISTEMAS_ID = '77777777-7777-4777-8777-777777777777';
  const ASIGNACION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const RESP_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const tokenAdmin = firmarTokenAcceso({
    sub: USUARIO_ADMIN_ID,
    roles: ['ADMINISTRADOR'],
  });

  const tokenEspecialista = firmarTokenAcceso({
    sub: USUARIO_TITULAR_ID,
    roles: ['ESPECIALISTA'],
  });

  function mockAuditQuery(sql: string) {
    if (sql.includes('sigd_audit.bitacora_auditoria')) {
      return { rows: [{ id_auditoria: 'aud-001' }] };
    }
    return null;
  }

  describe('1. Estructura Jerárquica de Unidades Orgánicas (sigd_org.area)', () => {
    it('crea una unidad raíz de nivel 1 con path base ltree', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('INSERT INTO sigd_org.area')) {
            return {
              rows: [
                {
                  areaId: AREA_DIR_ID,
                  codigo: 'DIR',
                  nombre: 'Dirección General',
                  tipoUnidad: 'DIRECCION',
                  areaPadreId: null,
                  path: 'a.DIR',
                  nivel: 1,
                  vigente: true,
                  creadoEn: '2026-01-01T00:00:00.000Z',
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
          if (sql.includes('WHERE UPPER(codigo) = UPPER($1)')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const unidad = await service.crearUnidad({
        codigo: 'DIR',
        nombre: 'Dirección General',
        tipoUnidad: 'DIRECCION',
      });

      expect(unidad.codigo).toBe('DIR');
      expect(unidad.nivel).toBe(1);
      expect(unidad.path).toBe('a.DIR');
      expect(unidad.areaPadreId).toBeNull();
    });

    it('crea una unidad hija vinculada a un área superior incrementando nivel y extendiendo path', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('INSERT INTO sigd_org.area')) {
            return {
              rows: [
                {
                  areaId: AREA_SISTEMAS_ID,
                  codigo: 'SIS',
                  nombre: 'Área Académica de Sistemas',
                  tipoUnidad: 'AREA',
                  areaPadreId: AREA_DIR_ID,
                  path: 'a.DIR.SIS',
                  nivel: 2,
                  vigente: true,
                  creadoEn: '2026-01-01T00:00:00.000Z',
                },
              ],
            };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('WHERE UPPER(codigo) = UPPER($1)')) {
            return { rows: [] };
          }
          if (sql.includes('WHERE area_id = $1::uuid') && params[0] === AREA_DIR_ID) {
            return {
              rows: [
                {
                  areaId: AREA_DIR_ID,
                  codigo: 'DIR',
                  nombre: 'Dirección General',
                  tipoUnidad: 'DIRECCION',
                  areaPadreId: null,
                  path: 'a.DIR',
                  nivel: 1,
                  vigente: true,
                  creadoEn: '2026-01-01T00:00:00.000Z',
                },
              ],
            };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const unidadHija = await service.crearUnidad({
        codigo: 'SIS',
        nombre: 'Área Académica de Sistemas',
        tipoUnidad: 'AREA',
        areaPadreId: AREA_DIR_ID,
      });

      expect(unidadHija.nivel).toBe(2);
      expect(unidadHija.path).toBe('a.DIR.SIS');
      expect(unidadHija.areaPadreId).toBe(AREA_DIR_ID);
    });

    it('rechaza asociar como padre a una unidad que está inactiva', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('WHERE UPPER(codigo) = UPPER($1)')) {
            return { rows: [] };
          }
          if (sql.includes('WHERE area_id = $1::uuid')) {
            return {
              rows: [
                {
                  areaId: AREA_DIR_ID,
                  codigo: 'DIR',
                  nombre: 'Dirección Inactiva',
                  tipoUnidad: 'DIRECCION',
                  areaPadreId: null,
                  path: 'a.DIR',
                  nivel: 1,
                  vigente: false, // INACTIVA
                  creadoEn: '2026-01-01T00:00:00.000Z',
                },
              ],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      await expect(
        service.crearUnidad({
          codigo: 'SUB',
          nombre: 'Sub-área',
          areaPadreId: AREA_DIR_ID,
        })
      ).rejects.toThrow(ConflictError);
    });

    it('ensambla correctamente el árbol jerárquico de unidades', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              areaId: 'root-1',
              codigo: 'DIR',
              nombre: 'Dirección',
              tipoUnidad: 'DIRECCION',
              areaPadreId: null,
              path: 'a.DIR',
              nivel: 1,
              vigente: true,
              creadoEn: '2026-01-01T00:00:00.000Z',
            },
            {
              areaId: 'child-1',
              codigo: 'SDA',
              nombre: 'Subdirección Académica',
              tipoUnidad: 'UNIDAD',
              areaPadreId: 'root-1',
              path: 'a.DIR.SDA',
              nivel: 2,
              vigente: true,
              creadoEn: '2026-01-01T00:00:00.000Z',
            },
            {
              areaId: 'child-2',
              codigo: 'SIS',
              nombre: 'Sistemas',
              tipoUnidad: 'AREA',
              areaPadreId: 'child-1',
              path: 'a.DIR.SDA.SIS',
              nivel: 3,
              vigente: true,
              creadoEn: '2026-01-01T00:00:00.000Z',
            },
          ],
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const arbol = await service.obtenerArbolOrganico();

      expect(arbol.length).toBe(1);
      expect(arbol[0].codigo).toBe('DIR');
      expect(arbol[0].hijos.length).toBe(1);
      expect(arbol[0].hijos[0].codigo).toBe('SDA');
      expect(arbol[0].hijos[0].hijos.length).toBe(1);
      expect(arbol[0].hijos[0].hijos[0].codigo).toBe('SIS');
    });
  });

  describe('2. Asignación de Personal (Titularidad Base) (sigd_org.asignacion_personal)', () => {
    it('crea una asignación ordinaria con vigencia y sustento documental', async () => {
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
                  idUsuario: USUARIO_TITULAR_ID,
                  cargoId: CARGO_DOCENTE_ID,
                  areaId: AREA_SISTEMAS_ID,
                  estado: 'ACTIVO',
                  vigenteDesde: new Date('2026-03-01T00:00:00Z'),
                  vigenteHasta: null,
                  tipoDocumentoSustento: 'RESOLUCION_DIRECTORAL',
                  numeroDocumentoSustento: 'RD-001-2026',
                  fechaDocumentoSustento: '2026-02-28',
                  motivoFinalizacion: null,
                  motivoAnulacion: null,
                  anuladoEn: null,
                  anuladoPor: null,
                  creadoEn: new Date('2026-03-01T00:00:00Z'),
                  actualizadoEn: new Date('2026-03-01T00:00:00Z'),
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
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ idUsuario: USUARIO_TITULAR_ID, usuario: 'docente_maria', activo: true, personaId: 'p-1' }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargoId: CARGO_DOCENTE_ID, codigo: 'DOCENTE', nombre: 'Docente', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ areaId: AREA_SISTEMAS_ID, codigo: 'SIS', nombre: 'Sistemas', vigente: true }] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const asig = await service.crearAsignacion({
        idUsuario: USUARIO_TITULAR_ID,
        cargoId: CARGO_DOCENTE_ID,
        areaId: AREA_SISTEMAS_ID,
        vigenteDesde: '2026-03-01T00:00:00Z',
        tipoDocumentoSustento: 'RESOLUCION_DIRECTORAL',
        numeroDocumentoSustento: 'RD-001-2026',
      });

      expect(asig.idAsignacion).toBe(ASIGNACION_ID);
      expect(asig.estado).toBe('ACTIVO');
      expect(asig.numeroDocumentoSustento).toBe('RD-001-2026');
    });

    it('rechaza asignación con fecha de fin anterior o igual al inicio (prohibición de duración cero)', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ idUsuario: USUARIO_TITULAR_ID, usuario: 'titular', activo: true, personaId: 'p-1' }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargoId: CARGO_DOCENTE_ID, codigo: 'DOCENTE', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ areaId: AREA_SISTEMAS_ID, codigo: 'SIS', vigente: true }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      await expect(
        service.crearAsignacion({
          idUsuario: USUARIO_TITULAR_ID,
          cargoId: CARGO_DOCENTE_ID,
          areaId: AREA_SISTEMAS_ID,
          vigenteDesde: '2026-05-01T00:00:00Z',
          vigenteHasta: '2026-05-01T00:00:00Z', // Duración cero
        })
      ).rejects.toThrow(ValidationError);
    });

    it('finaliza una asignación activa preservando su historial inmutable', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('UPDATE sigd_org.asignacion_personal')) {
            return { rows: [{ idAsignacion: ASIGNACION_ID }] };
          }
          if (sql.includes('FROM sigd_org.asignacion_personal a')) {
            return {
              rows: [
                {
                  idAsignacion: ASIGNACION_ID,
                  idUsuario: USUARIO_TITULAR_ID,
                  cargoId: CARGO_DOCENTE_ID,
                  areaId: AREA_SISTEMAS_ID,
                  estado: 'FINALIZADO',
                  vigenteDesde: new Date('2026-01-01T00:00:00Z'),
                  vigenteHasta: new Date('2026-06-30T00:00:00Z'),
                  motivoFinalizacion: 'Rotación académica',
                  creadoEn: new Date('2026-01-01T00:00:00Z'),
                  actualizadoEn: new Date('2026-06-30T00:00:00Z'),
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
          if (sql.includes('FROM sigd_org.asignacion_personal a')) {
            return {
              rows: [
                {
                  idAsignacion: ASIGNACION_ID,
                  idUsuario: USUARIO_TITULAR_ID,
                  cargoId: CARGO_DOCENTE_ID,
                  areaId: AREA_SISTEMAS_ID,
                  estado: 'ACTIVO',
                  vigenteDesde: new Date('2026-01-01T00:00:00Z'),
                  vigenteHasta: null,
                },
              ],
            };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const finalizada = await service.finalizarAsignacion({
        idAsignacion: ASIGNACION_ID,
        fechaFinalizacion: '2026-06-30T00:00:00Z',
        motivoFinalizacion: 'Rotación académica',
      });

      expect(finalizada.estado).toBe('FINALIZADO');
      expect(finalizada.vigenteHasta).toBe(new Date('2026-06-30T00:00:00Z').toISOString());
    });
  });

  describe('3. Responsabilidades Temporales: Encargatura, Suplencia, Delegación', () => {
    it('ENCARGATURA: docente asume funciones de coordinador temporal manteniendo su vínculo y cargo base', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('INSERT INTO sigd_org.responsabilidad_temporal')) {
            return { rows: [{ idResponsabilidad: RESP_ID }] };
          }
          if (sql.includes('FROM sigd_org.responsabilidad_temporal r')) {
            return {
              rows: [
                {
                  idResponsabilidad: RESP_ID,
                  tipoResponsabilidad: 'ENCARGATURA',
                  idUsuario: USUARIO_TITULAR_ID,
                  titularUsuarioId: null,
                  cargoId: CARGO_COORDINADOR_ID,
                  areaId: AREA_SISTEMAS_ID,
                  estado: 'ACTIVO',
                  vigenteDesde: new Date('2027-03-01T00:00:00Z'),
                  vigenteHasta: new Date('2027-07-31T00:00:00Z'),
                  tipoDocumentoSustento: 'MEMORANDO',
                  numeroDocumentoSustento: 'MEMO-042-2027',
                  creadoEn: new Date('2027-03-01T00:00:00Z'),
                  actualizadoEn: new Date('2027-03-01T00:00:00Z'),
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
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ idUsuario: USUARIO_TITULAR_ID, usuario: 'docente_maria', activo: true, personaId: 'p-1' }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargoId: CARGO_COORDINADOR_ID, codigo: 'COORDINADOR', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ areaId: AREA_SISTEMAS_ID, codigo: 'SIS', vigente: true }] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const encargatura = await service.crearResponsabilidadTemporal({
        tipoResponsabilidad: 'ENCARGATURA',
        idUsuario: USUARIO_TITULAR_ID,
        cargoId: CARGO_COORDINADOR_ID,
        areaId: AREA_SISTEMAS_ID,
        vigenteDesde: '2027-03-01T00:00:00Z',
        vigenteHasta: '2027-07-31T00:00:00Z',
        tipoDocumentoSustento: 'MEMORANDO',
        numeroDocumentoSustento: 'MEMO-042-2027',
      });

      expect(encargatura.tipoResponsabilidad).toBe('ENCARGATURA');
      expect(encargatura.idUsuario).toBe(USUARIO_TITULAR_ID);
      expect(encargatura.estado).toBe('ACTIVO');
    });

    it('SUPLENCIA: titular ausente y suplente distinto con periodo delimitado', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('INSERT INTO sigd_org.responsabilidad_temporal')) {
            return { rows: [{ idResponsabilidad: RESP_ID }] };
          }
          if (sql.includes('FROM sigd_org.responsabilidad_temporal r')) {
            return {
              rows: [
                {
                  idResponsabilidad: RESP_ID,
                  tipoResponsabilidad: 'SUPLENCIA',
                  idUsuario: USUARIO_SUPLENTE_ID,
                  titularUsuarioId: USUARIO_TITULAR_ID,
                  cargoId: CARGO_COORDINADOR_ID,
                  areaId: AREA_SISTEMAS_ID,
                  estado: 'ACTIVO',
                  vigenteDesde: new Date('2027-04-01T00:00:00Z'),
                  vigenteHasta: new Date('2027-04-15T00:00:00Z'),
                  tipoDocumentoSustento: 'RESOLUCION_DIRECTORAL',
                  numeroDocumentoSustento: 'RD-099-2027',
                  creadoEn: new Date('2027-04-01T00:00:00Z'),
                  actualizadoEn: new Date('2027-04-01T00:00:00Z'),
                },
              ],
            };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ idUsuario: params[0], usuario: 'user', activo: true, personaId: 'p-1' }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargoId: CARGO_COORDINADOR_ID, codigo: 'COORDINADOR', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ areaId: AREA_SISTEMAS_ID, codigo: 'SIS', vigente: true }] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const suplencia = await service.crearResponsabilidadTemporal({
        tipoResponsabilidad: 'SUPLENCIA',
        idUsuario: USUARIO_SUPLENTE_ID,
        titularUsuarioId: USUARIO_TITULAR_ID,
        cargoId: CARGO_COORDINADOR_ID,
        areaId: AREA_SISTEMAS_ID,
        vigenteDesde: '2027-04-01T00:00:00Z',
        vigenteHasta: '2027-04-15T00:00:00Z',
      });

      expect(suplencia.tipoResponsabilidad).toBe('SUPLENCIA');
      expect(suplencia.titularUsuarioId).toBe(USUARIO_TITULAR_ID);
      expect(suplencia.idUsuario).toBe(USUARIO_SUPLENTE_ID);
    });

    it('AUTO-SUPLENCIA: rechazo estricto si titular_usuario_id es igual a id_usuario', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ idUsuario: USUARIO_TITULAR_ID, usuario: 'titular', activo: true }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      await expect(
        service.crearResponsabilidadTemporal({
          tipoResponsabilidad: 'SUPLENCIA',
          idUsuario: USUARIO_TITULAR_ID,
          titularUsuarioId: USUARIO_TITULAR_ID, // Mismo usuario
          cargoId: CARGO_COORDINADOR_ID,
          areaId: AREA_SISTEMAS_ID,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('SUPLENCIA SIN TITULAR: rechazo si no se especifica el titular ausente', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ idUsuario: USUARIO_SUPLENTE_ID, usuario: 'suplente', activo: true }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      await expect(
        service.crearResponsabilidadTemporal({
          tipoResponsabilidad: 'SUPLENCIA',
          idUsuario: USUARIO_SUPLENTE_ID,
          titularUsuarioId: null, // Falta titular
          cargoId: CARGO_COORDINADOR_ID,
          areaId: AREA_SISTEMAS_ID,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('DELEGACIÓN: titular encomienda actuación con alcance estructurado', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('INSERT INTO sigd_org.responsabilidad_temporal')) {
            return { rows: [{ idResponsabilidad: RESP_ID }] };
          }
          if (sql.includes('FROM sigd_org.responsabilidad_temporal r')) {
            return {
              rows: [
                {
                  idResponsabilidad: RESP_ID,
                  tipoResponsabilidad: 'DELEGACION',
                  idUsuario: USUARIO_SUPLENTE_ID,
                  titularUsuarioId: USUARIO_TITULAR_ID,
                  cargoId: CARGO_COORDINADOR_ID,
                  areaId: AREA_SISTEMAS_ID,
                  estado: 'ACTIVO',
                  alcance: { tipoActuacion: 'FIRMA_DOCUMENTAL', materias: ['CONSTANCIAS'] },
                  vigenteDesde: new Date('2027-05-01T00:00:00Z'),
                  vigenteHasta: new Date('2027-05-30T00:00:00Z'),
                  creadoEn: new Date('2027-05-01T00:00:00Z'),
                  actualizadoEn: new Date('2027-05-01T00:00:00Z'),
                },
              ],
            };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ idUsuario: params[0], usuario: 'user', activo: true }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargoId: CARGO_COORDINADOR_ID, codigo: 'COORDINADOR', vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ areaId: AREA_SISTEMAS_ID, codigo: 'SIS', vigente: true }] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const delegacion = await service.crearResponsabilidadTemporal({
        tipoResponsabilidad: 'DELEGACION',
        idUsuario: USUARIO_SUPLENTE_ID,
        titularUsuarioId: USUARIO_TITULAR_ID,
        cargoId: CARGO_COORDINADOR_ID,
        areaId: AREA_SISTEMAS_ID,
        alcance: { tipoActuacion: 'FIRMA_DOCUMENTAL', materias: ['CONSTANCIAS'] },
        vigenteDesde: '2027-05-01T00:00:00Z',
        vigenteHasta: '2027-05-30T00:00:00Z',
      });

      expect(delegacion.tipoResponsabilidad).toBe('DELEGACION');
      expect(delegacion.alcance?.tipoActuacion).toBe('FIRMA_DOCUMENTAL');
    });

    it('DELEGACIÓN SIN ALCANCE: rechazo si no se define el alcance estructurado', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ idUsuario: params[0], activo: true }] };
          }
          if (sql.includes('FROM sigd_org.cargo')) {
            return { rows: [{ cargoId: CARGO_COORDINADOR_ID, vigente: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ areaId: AREA_SISTEMAS_ID, vigente: true }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      await expect(
        service.crearResponsabilidadTemporal({
          tipoResponsabilidad: 'DELEGACION',
          idUsuario: USUARIO_SUPLENTE_ID,
          titularUsuarioId: USUARIO_TITULAR_ID,
          cargoId: CARGO_COORDINADOR_ID,
          areaId: AREA_SISTEMAS_ID,
          alcance: null, // Falta alcance
        })
      ).rejects.toThrow(ValidationError);
    });

    it('REVOCACIÓN: cambia estado a REVOCADO registrando motivo formal sin eliminar el registro', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('UPDATE sigd_org.responsabilidad_temporal')) {
            return { rows: [{ idResponsabilidad: RESP_ID }] };
          }
          if (sql.includes('FROM sigd_org.responsabilidad_temporal r')) {
            return {
              rows: [
                {
                  idResponsabilidad: RESP_ID,
                  tipoResponsabilidad: 'DELEGACION',
                  idUsuario: USUARIO_SUPLENTE_ID,
                  estado: 'REVOCADO',
                  motivoRevocacion: 'Pérdida de confianza institucional',
                  vigenteDesde: new Date('2027-05-01T00:00:00Z'),
                  vigenteHasta: new Date('2027-05-10T00:00:00Z'),
                  creadoEn: new Date('2027-05-01T00:00:00Z'),
                  actualizadoEn: new Date('2027-05-10T00:00:00Z'),
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
          if (sql.includes('FROM sigd_org.responsabilidad_temporal r')) {
            return {
              rows: [
                {
                  idResponsabilidad: RESP_ID,
                  tipoResponsabilidad: 'DELEGACION',
                  idUsuario: USUARIO_SUPLENTE_ID,
                  estado: 'ACTIVO',
                  vigenteDesde: new Date('2027-05-01T00:00:00Z'),
                  vigenteHasta: null,
                },
              ],
            };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const revocada = await service.revocarResponsabilidad({
        idResponsabilidad: RESP_ID,
        motivoRevocacion: 'Pérdida de confianza institucional',
        fechaRevocacion: '2027-05-10T00:00:00Z',
      });

      expect(revocada.estado).toBe('REVOCADO');
      expect(revocada.motivoRevocacion).toBe('Pérdida de confianza institucional');
    });

    it('ANULACIÓN: anula una responsabilidad con autor y motivo obligatorio', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('UPDATE sigd_org.responsabilidad_temporal')) {
            return { rows: [{ idResponsabilidad: RESP_ID }] };
          }
          if (sql.includes('FROM sigd_org.responsabilidad_temporal r')) {
            return {
              rows: [
                {
                  idResponsabilidad: RESP_ID,
                  tipoResponsabilidad: 'DELEGACION',
                  estado: 'ANULADO',
                  motivoAnulacion: 'Error material en número de memorando',
                  anuladoPor: USUARIO_ADMIN_ID,
                  anuladoEn: new Date('2027-05-02T00:00:00Z'),
                  vigenteDesde: new Date('2027-05-01T00:00:00Z'),
                  vigenteHasta: null,
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
          if (sql.includes('FROM sigd_org.responsabilidad_temporal r')) {
            return {
              rows: [
                {
                  idResponsabilidad: RESP_ID,
                  estado: 'ACTIVO',
                  vigenteDesde: new Date('2027-05-01T00:00:00Z'),
                },
              ],
            };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const anulada = await service.anularResponsabilidad({
        idResponsabilidad: RESP_ID,
        motivoAnulacion: 'Error material en número de memorando',
        usuarioEjecutorId: USUARIO_ADMIN_ID,
      });

      expect(anulada.estado).toBe('ANULADO');
      expect(anulada.motivoAnulacion).toBe('Error material en número de memorando');
    });

    it('CONCURRENCIA: falla atómicamente si otra transacción ya finalizó/revocó la responsabilidad', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          const audit = mockAuditQuery(sql);
          if (audit) return audit;
          if (sql.includes('UPDATE sigd_org.responsabilidad_temporal')) {
            return { rows: [] }; // 0 filas actualizadas por condición WHERE estado = 'ACTIVO'
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_org.responsabilidad_temporal r')) {
            return {
              rows: [
                {
                  idResponsabilidad: RESP_ID,
                  estado: 'ACTIVO',
                  vigenteDesde: new Date('2027-05-01T00:00:00Z'),
                },
              ],
            };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      await expect(
        service.finalizarResponsabilidad({
          idResponsabilidad: RESP_ID,
          fechaFinalizacion: '2027-05-30T00:00:00Z',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('CUENTA DESHABILITADA: asignaciones históricas siguen consultables y trazables', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM sigd_org.asignacion_personal a')) {
            return {
              rows: [
                {
                  idAsignacion: ASIGNACION_ID,
                  idUsuario: USUARIO_TITULAR_ID,
                  usuarioUsername: 'usuario_cesado',
                  cargoId: CARGO_DOCENTE_ID,
                  areaId: AREA_SISTEMAS_ID,
                  estado: 'FINALIZADO',
                  vigenteDesde: new Date('2020-01-01T00:00:00Z'),
                  vigenteHasta: new Date('2024-12-31T00:00:00Z'),
                  creadoEn: new Date('2020-01-01T00:00:00Z'),
                  actualizadoEn: new Date('2024-12-31T00:00:00Z'),
                },
              ],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const historicas = await service.listarAsignaciones({
        idUsuario: USUARIO_TITULAR_ID,
        fechaCorte: '2022-06-15T00:00:00Z',
      });

      expect(historicas.length).toBe(1);
      expect(historicas[0].idAsignacion).toBe(ASIGNACION_ID);
      expect(historicas[0].estado).toBe('FINALIZADO');
    });

    it('RECONSTRUCCIÓN HISTÓRICA: consulta en fechaCorte devuelve quién era responsable ese día', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('FROM sigd_org.responsabilidad_temporal r')) {
            expect(params).toContain('2027-05-15T00:00:00Z');
            return {
              rows: [
                {
                  idResponsabilidad: RESP_ID,
                  tipoResponsabilidad: 'DELEGACION',
                  idUsuario: USUARIO_SUPLENTE_ID,
                  cargoId: CARGO_COORDINADOR_ID,
                  areaId: AREA_SISTEMAS_ID,
                  estado: 'ACTIVO',
                  vigenteDesde: new Date('2027-05-01T00:00:00Z'),
                  vigenteHasta: new Date('2027-05-30T00:00:00Z'),
                  creadoEn: new Date('2027-05-01T00:00:00Z'),
                  actualizadoEn: new Date('2027-05-01T00:00:00Z'),
                },
              ],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new OrganizacionService(mockPool);
      const enEsaFecha = await service.listarResponsabilidadesTemporales({
        fechaCorte: '2027-05-15T00:00:00Z',
      });

      expect(enEsaFecha.length).toBe(1);
      expect(enEsaFecha[0].idResponsabilidad).toBe(RESP_ID);
    });
  });

  describe('4. Rutas HTTP y Guardias RBAC (/api/v1/organizacion)', () => {
    function crearAppMock() {
      const defaultQuery = async (sql: any) => {
        const sqlStr = typeof sql === 'string' ? sql : sql?.text || '';
        if (sqlStr.includes('sigd_audit.bitacora_auditoria')) {
          return { rows: [{ id_auditoria: 'aud-test-001' }] };
        }
        if (sqlStr.includes('SELECT area_id::text AS "areaId"')) {
          return {
            rows: [
              {
                areaId: AREA_DIR_ID,
                codigo: 'DIR',
                nombre: 'Dirección General',
                tipoUnidad: 'DIRECCION',
                areaPadreId: null,
                path: 'a.DIR',
                nivel: 1,
                vigente: true,
                creadoEn: new Date('2026-01-01T00:00:00Z'),
              },
            ],
          };
        }
        if (sqlStr.includes('SELECT cargo_id::text AS "cargoId"')) {
          return {
            rows: [
              {
                cargoId: CARGO_DOCENTE_ID,
                codigo: 'DOCENTE',
                nombre: 'Docente',
                vigente: true,
              },
            ],
          };
        }
        return { rows: [] };
      };

      const mockClient = {
        query: vi.fn(defaultQuery),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        query: vi.fn(defaultQuery),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      return construirApp(mockPool);
    }

    it('GET /api/v1/organizacion/unidades responde HTTP 200 a usuario autenticado', async () => {
      const app = crearAppMock();
      const res = await request(app)
        .get('/api/v1/organizacion/unidades')
        .set('Authorization', `Bearer ${tokenEspecialista}`);

      expect(res.status).toBe(200);
      expect(res.body.unidades).toBeDefined();
      expect(res.body.unidades.length).toBe(1);
    });

    it('POST /api/v1/organizacion/unidades responde HTTP 403 Forbidden a no administrador', async () => {
      const app = crearAppMock();
      const res = await request(app)
        .post('/api/v1/organizacion/unidades')
        .set('Authorization', `Bearer ${tokenEspecialista}`)
        .send({
          codigo: 'NUEVA',
          nombre: 'Nueva Unidad',
        });

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/organizacion/cargos responde HTTP 403 Forbidden a no administrador', async () => {
      const app = crearAppMock();
      const res = await request(app)
        .post('/api/v1/organizacion/cargos')
        .set('Authorization', `Bearer ${tokenEspecialista}`)
        .send({
          codigo: 'JEFE',
          nombre: 'Jefe de Oficina',
        });

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/organizacion/asignaciones responde HTTP 403 Forbidden a no administrador', async () => {
      const app = crearAppMock();
      const res = await request(app)
        .post('/api/v1/organizacion/asignaciones')
        .set('Authorization', `Bearer ${tokenEspecialista}`)
        .send({
          idUsuario: USUARIO_TITULAR_ID,
          cargoId: CARGO_DOCENTE_ID,
          areaId: AREA_SISTEMAS_ID,
        });

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/organizacion/responsabilidades-temporales responde HTTP 403 Forbidden a no administrador', async () => {
      const app = crearAppMock();
      const res = await request(app)
        .post('/api/v1/organizacion/responsabilidades-temporales')
        .set('Authorization', `Bearer ${tokenEspecialista}`)
        .send({
          tipoResponsabilidad: 'ENCARGATURA',
          idUsuario: USUARIO_TITULAR_ID,
          cargoId: CARGO_COORDINADOR_ID,
          areaId: AREA_SISTEMAS_ID,
        });

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/organizacion/unidades con ADMINISTRADOR legacy sin ADMINISTRADOR_SIGD responde HTTP 403 Forbidden', async () => {
      const app = crearAppMock(); // defaultQuery retorna [] en asignacion_perfil_operativo
      const res = await request(app)
        .post('/api/v1/organizacion/unidades')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          codigo: 'OF_ADMIN',
          nombre: 'Oficina Administrativa',
        });

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/organizacion/unidades con ADMINISTRADOR_SIGD activo responde HTTP 201 Created', async () => {
      const defaultQuery = async (sql: any, params?: any[]) => {
        const sqlStr = typeof sql === 'string' ? sql : sql?.text || '';
        if (sqlStr.includes('FROM sigd_auth.cuenta_usuario')) {
          return { rows: [{ id_usuario: USUARIO_ADMIN_ID, usuario: 'admin', correo: 'admin@i.pe', activo: true }] };
        }
        if (sqlStr.includes('asignacion_perfil_operativo')) {
          return {
            rows: [
              {
                id_asignacion_perfil: 'asig-admin-01',
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
        if (sqlStr.includes('sigd_audit.bitacora_auditoria')) {
          return { rows: [{ id_auditoria: 'aud-test-001' }] };
        }
        if (sqlStr.includes('INSERT INTO sigd_org.area')) {
          return {
            rows: [
              {
                areaId: 'area-creada-001',
                codigo: 'OF_NUEVA',
                nombre: 'Oficina Nueva',
                tipoUnidad: 'UNIDAD',
                areaPadreId: null,
                path: 'a.OF_NUEVA',
                nivel: 1,
                vigente: true,
                creadoEn: new Date('2026-01-01T00:00:00Z'),
              },
            ],
          };
        }
        return { rows: [] };
      };

      const mockClient = {
        query: vi.fn(defaultQuery),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        query: vi.fn(defaultQuery),
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const app = construirApp(mockPool);

      const res = await request(app)
        .post('/api/v1/organizacion/unidades')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          codigo: 'OF_NUEVA',
          nombre: 'Oficina Nueva',
        });

      expect(res.status).toBe(201);
      expect(res.body.unidad).toBeDefined();
      expect(res.body.unidad.codigo).toBe('OF_NUEVA');
    });
  });
});

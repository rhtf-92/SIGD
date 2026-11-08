import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { VinculoInstitucionalService } from '../../../../src/domains/identicore/vinculoInstitucional.service.js';
import { VinculoInstitucionalRepository } from '../../../../src/domains/identicore/vinculoInstitucional.repository.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../src/shared/domain/errors/index.js';

describe('SIGD Fase 5B — Identidad y Vínculos Institucionales', () => {
  const PERSONA_ID = '11111111-1111-4111-8111-111111111111';
  const OTRA_PERSONA_ID = '22222222-2222-4222-8222-222222222222';
  const USUARIO_CIUDADANO_ID = '33333333-3333-4333-8333-333333333333';
  const USUARIO_ADMIN_ID = '44444444-4444-4444-8444-444444444444';

  const tokenCiudadano = firmarTokenAcceso({
    sub: USUARIO_CIUDADANO_ID,
    roles: ['CIUDADANO'],
  });

  const tokenMesaPartes = firmarTokenAcceso({
    sub: '55555555-5555-4555-8555-555555555555',
    roles: ['MESA_PARTES'],
  });

  const tokenTesoreria = firmarTokenAcceso({
    sub: '66666666-6666-4666-8666-666666666666',
    roles: ['TESORERIA'],
  });

  const tokenAdmin = firmarTokenAcceso({
    sub: USUARIO_ADMIN_ID,
    roles: ['ADMINISTRADOR'],
  });

  describe('1. Servicio de Vínculos Institucionales (Lógica de Dominio e Invariantes)', () => {
    it('consulta catálogo de tipos de vínculos disponibles', async () => {
      const mockRows = [
        {
          id_tipo_vinculo: 1,
          codigo: 'POSTULANTE',
          nombre: 'Postulante',
          categoria_actor: 'COMUNIDAD_ACADEMICA',
          descripcion: 'En proceso de admisión',
          vigente: true,
          creado_en: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id_tipo_vinculo: 2,
          codigo: 'ESTUDIANTE_ACTIVO',
          nombre: 'Estudiante Activo',
          categoria_actor: 'COMUNIDAD_ACADEMICA',
          descripcion: 'Matriculado regular',
          vigente: true,
          creado_en: new Date('2026-01-01T00:00:00Z'),
        },
      ];

      const pool = {
        query: vi.fn().mockResolvedValue({ rows: mockRows }),
      } as unknown as Pool;

      const service = new VinculoInstitucionalService(pool);
      const catalogo = await service.listarCatalogoTipos();

      expect(catalogo).toHaveLength(2);
      expect(catalogo[0].codigo).toBe('POSTULANTE');
      expect(catalogo[0].categoriaActor).toBe('COMUNIDAD_ACADEMICA');
      expect(catalogo[1].codigo).toBe('ESTUDIANTE_ACTIVO');
    });

    it('devuelve array vacío si una persona no registra vínculos', async () => {
      const pool = {
        query: vi.fn((sql: string) => {
          if (sql.includes('EXISTS')) return { rows: [{ existe: true }] };
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new VinculoInstitucionalService(pool);
      const vinculos = await service.listarVinculosPorPersona(PERSONA_ID);
      expect(vinculos).toEqual([]);
    });

    it('crea un vínculo POSTULANTE para una persona (sin exigir cuenta de usuario)', async () => {
      const vinculoCreadoFila = {
        id_vinculo: 'a1b2c3d4-0001-4000-8000-000000000001',
        id_persona: PERSONA_ID,
        id_tipo_vinculo: 1,
        codigo_tipo: 'POSTULANTE',
        nombre_tipo: 'Postulante',
        categoria_actor: 'COMUNIDAD_ACADEMICA',
        estado: 'ACTIVO',
        vigente_desde: new Date('2026-02-01T08:00:00Z'),
        vigente_hasta: null,
        motivo_finalizacion: null,
        motivo_anulacion: null,
        anulado_en: null,
        anulado_por: null,
        creado_en: new Date('2026-02-01T08:00:00Z'),
        actualizado_en: new Date('2026-02-01T08:00:00Z'),
      };

      const cliente = {
        query: vi.fn((sql: string) => {
          if (sql.includes('INSERT INTO sigd_auth.vinculo_institucional')) {
            return { rows: [vinculoCreadoFila] };
          }
          if (sql.includes('sigd_audit.bitacora_auditoria')) {
            return { rows: [{ id_auditoria: 'aud-001' }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const pool = {
        query: vi.fn((sql: string) => {
          if (sql.includes('EXISTS(SELECT 1 FROM sigd_auth.persona')) {
            return { rows: [{ existe: true }] };
          }
          if (sql.includes('sigd_auth.tipo_vinculo_institucional')) {
            return {
              rows: [
                {
                  id_tipo_vinculo: 1,
                  codigo: 'POSTULANTE',
                  nombre: 'Postulante',
                  categoria_actor: 'COMUNIDAD_ACADEMICA',
                  descripcion: 'Postulante',
                  vigente: true,
                  creado_en: new Date(),
                },
              ],
            };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(cliente),
      } as unknown as Pool;

      const service = new VinculoInstitucionalService(pool);
      const resultado = await service.crearVinculo({
        personaId: PERSONA_ID,
        tipoVinculo: 'POSTULANTE',
        vigenteDesde: '2026-02-01T08:00:00Z',
      });

      expect(resultado.idVinculo).toBe('a1b2c3d4-0001-4000-8000-000000000001');
      expect(resultado.codigoTipo).toBe('POSTULANTE');
      expect(resultado.categoriaActor).toBe('COMUNIDAD_ACADEMICA');
      expect(resultado.estado).toBe('ACTIVO');
      expect(cliente.query).toHaveBeenCalledWith('BEGIN');
      expect(cliente.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rechaza la creación de un vínculo con fecha fin anterior o igual al inicio', async () => {
      const pool = {
        query: vi.fn((sql: string) => {
          if (sql.includes('EXISTS(SELECT 1 FROM sigd_auth.persona')) return { rows: [{ existe: true }] };
          if (sql.includes('sigd_auth.tipo_vinculo_institucional')) {
            return {
              rows: [{ id_tipo_vinculo: 2, codigo: 'ESTUDIANTE_ACTIVO', nombre: 'Estudiante', categoria_actor: 'COMUNIDAD_ACADEMICA', vigente: true, creado_en: new Date() }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new VinculoInstitucionalService(pool);

      await expect(
        service.crearVinculo({
          personaId: PERSONA_ID,
          tipoVinculo: 'ESTUDIANTE_ACTIVO',
          vigenteDesde: '2026-06-01T00:00:00Z',
          vigenteHasta: '2026-05-01T00:00:00Z',
        }),
      ).rejects.toThrow(ValidationError);

      await expect(
        service.crearVinculo({
          personaId: PERSONA_ID,
          tipoVinculo: 'ESTUDIANTE_ACTIVO',
          vigenteDesde: '2026-06-01T00:00:00Z',
          vigenteHasta: '2026-06-01T00:00:00Z',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('rechaza si la persona indicada no existe', async () => {
      const pool = {
        query: vi.fn().mockResolvedValue({ rows: [{ existe: false }] }),
      } as unknown as Pool;

      const service = new VinculoInstitucionalService(pool);

      await expect(
        service.crearVinculo({
          personaId: PERSONA_ID,
          tipoVinculo: 'POSTULANTE',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('rechaza si el tipo de vínculo no existe o no está vigente', async () => {
      const pool = {
        query: vi.fn((sql: string) => {
          if (sql.includes('EXISTS(SELECT 1 FROM sigd_auth.persona')) return { rows: [{ existe: true }] };
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new VinculoInstitucionalService(pool);

      await expect(
        service.crearVinculo({
          personaId: PERSONA_ID,
          tipoVinculo: 'TIPO_INVENTADO',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('soporta evolución histórica (POSTULANTE -> ESTUDIANTE_ACTIVO -> EGRESADO -> TITULADO)', async () => {
      const historialFilas = [
        {
          id_vinculo: 'v-04',
          id_persona: PERSONA_ID,
          id_tipo_vinculo: 4,
          codigo_tipo: 'TITULADO',
          nombre_tipo: 'Titulado',
          categoria_actor: 'COMUNIDAD_ACADEMICA',
          estado: 'ACTIVO',
          vigente_desde: new Date('2026-01-15T00:00:00Z'),
          vigente_hasta: null,
          motivo_finalizacion: null,
          motivo_anulacion: null,
          anulado_en: null,
          anulado_por: null,
          creado_en: new Date('2026-01-15T00:00:00Z'),
          actualizado_en: new Date('2026-01-15T00:00:00Z'),
        },
        {
          id_vinculo: 'v-03',
          id_persona: PERSONA_ID,
          id_tipo_vinculo: 3,
          codigo_tipo: 'EGRESADO',
          nombre_tipo: 'Egresado',
          categoria_actor: 'COMUNIDAD_ACADEMICA',
          estado: 'FINALIZADO',
          vigente_desde: new Date('2025-01-01T00:00:00Z'),
          vigente_hasta: new Date('2026-01-14T23:59:59Z'),
          motivo_finalizacion: 'Titulación obtenida',
          motivo_anulacion: null,
          anulado_en: null,
          anulado_por: null,
          creado_en: new Date('2025-01-01T00:00:00Z'),
          actualizado_en: new Date('2026-01-15T00:00:00Z'),
        },
        {
          id_vinculo: 'v-02',
          id_persona: PERSONA_ID,
          id_tipo_vinculo: 2,
          codigo_tipo: 'ESTUDIANTE_ACTIVO',
          nombre_tipo: 'Estudiante Activo',
          categoria_actor: 'COMUNIDAD_ACADEMICA',
          estado: 'FINALIZADO',
          vigente_desde: new Date('2022-03-01T00:00:00Z'),
          vigente_hasta: new Date('2024-12-31T23:59:59Z'),
          motivo_finalizacion: 'Culminación de plan de estudios',
          motivo_anulacion: null,
          anulado_en: null,
          anulado_por: null,
          creado_en: new Date('2022-03-01T00:00:00Z'),
          actualizado_en: new Date('2025-01-01T00:00:00Z'),
        },
        {
          id_vinculo: 'v-01',
          id_persona: PERSONA_ID,
          id_tipo_vinculo: 1,
          codigo_tipo: 'POSTULANTE',
          nombre_tipo: 'Postulante',
          categoria_actor: 'COMUNIDAD_ACADEMICA',
          estado: 'FINALIZADO',
          vigente_desde: new Date('2022-01-10T00:00:00Z'),
          vigente_hasta: new Date('2022-02-28T23:59:59Z'),
          motivo_finalizacion: 'Admisión aprobada',
          motivo_anulacion: null,
          anulado_en: null,
          anulado_por: null,
          creado_en: new Date('2022-01-10T00:00:00Z'),
          actualizado_en: new Date('2022-03-01T00:00:00Z'),
        },
      ];

      const pool = {
        query: vi.fn((sql: string) => {
          if (sql.includes('EXISTS(SELECT 1 FROM sigd_auth.persona')) return { rows: [{ existe: true }] };
          return { rows: historialFilas };
        }),
      } as unknown as Pool;

      const service = new VinculoInstitucionalService(pool);
      const historial = await service.listarVinculosPorPersona(PERSONA_ID);

      expect(historial).toHaveLength(4);
      expect(historial[0].codigoTipo).toBe('TITULADO');
      expect(historial[0].estado).toBe('ACTIVO');
      expect(historial[1].codigoTipo).toBe('EGRESADO');
      expect(historial[1].estado).toBe('FINALIZADO');
      expect(historial[2].codigoTipo).toBe('ESTUDIANTE_ACTIVO');
      expect(historial[2].estado).toBe('FINALIZADO');
      expect(historial[3].codigoTipo).toBe('POSTULANTE');
      expect(historial[3].estado).toBe('FINALIZADO');
    });

    it('permite vínculos simultáneos legítimos (ej. TITULADO y DOCENTE activos a la vez)', async () => {
      const simultaneosFilas = [
        {
          id_vinculo: 'v-titulado',
          id_persona: PERSONA_ID,
          id_tipo_vinculo: 4,
          codigo_tipo: 'TITULADO',
          nombre_tipo: 'Titulado',
          categoria_actor: 'COMUNIDAD_ACADEMICA',
          estado: 'ACTIVO',
          vigente_desde: new Date('2025-06-01T00:00:00Z'),
          vigente_hasta: null,
          motivo_finalizacion: null,
          motivo_anulacion: null,
          anulado_en: null,
          anulado_por: null,
          creado_en: new Date('2025-06-01T00:00:00Z'),
          actualizado_en: new Date('2025-06-01T00:00:00Z'),
        },
        {
          id_vinculo: 'v-docente',
          id_persona: PERSONA_ID,
          id_tipo_vinculo: 5,
          codigo_tipo: 'DOCENTE',
          nombre_tipo: 'Docente',
          categoria_actor: 'PERSONAL_INSTITUCIONAL',
          estado: 'ACTIVO',
          vigente_desde: new Date('2026-03-01T00:00:00Z'),
          vigente_hasta: null,
          motivo_finalizacion: null,
          motivo_anulacion: null,
          anulado_en: null,
          anulado_por: null,
          creado_en: new Date('2026-03-01T00:00:00Z'),
          actualizado_en: new Date('2026-03-01T00:00:00Z'),
        },
      ];

      const pool = {
        query: vi.fn((sql: string) => {
          if (sql.includes('EXISTS(SELECT 1 FROM sigd_auth.persona')) return { rows: [{ existe: true }] };
          return { rows: simultaneosFilas };
        }),
      } as unknown as Pool;

      const service = new VinculoInstitucionalService(pool);
      const vigentes = await service.listarVinculosPorPersona(PERSONA_ID, { soloVigentes: true });

      expect(vigentes).toHaveLength(2);
      const codigos = vigentes.map((v) => v.codigoTipo);
      expect(codigos).toContain('TITULADO');
      expect(codigos).toContain('DOCENTE');
    });

    it('finaliza un vínculo con trazabilidad y registra auditoría sin eliminar la fila', async () => {
      const vinculoActivoId = 'a1b2c3d4-0002-4000-8000-000000000002';
      const vinculoActivo = {
        id_vinculo: vinculoActivoId,
        id_persona: PERSONA_ID,
        id_tipo_vinculo: 1,
        codigo_tipo: 'POSTULANTE',
        nombre_tipo: 'Postulante',
        categoria_actor: 'COMUNIDAD_ACADEMICA',
        estado: 'ACTIVO',
        vigente_desde: new Date('2026-01-01T00:00:00Z'),
        vigente_hasta: null,
        motivo_finalizacion: null,
        motivo_anulacion: null,
        anulado_en: null,
        anulado_por: null,
        creado_en: new Date('2026-01-01T00:00:00Z'),
        actualizado_en: new Date('2026-01-01T00:00:00Z'),
      };

      const vinculoFinalizado = {
        ...vinculoActivo,
        estado: 'FINALIZADO',
        vigente_hasta: new Date('2026-02-15T00:00:00Z'),
        motivo_finalizacion: 'Proceso de admisión concluido',
        actualizado_en: new Date('2026-02-15T00:00:00Z'),
      };

      const cliente = {
        query: vi.fn((sql: string) => {
          if (sql.includes('UPDATE sigd_auth.vinculo_institucional')) {
            return { rows: [vinculoFinalizado] };
          }
          if (sql.includes('sigd_audit.bitacora_auditoria')) {
            return { rows: [{ id_auditoria: 'aud-update-01' }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const pool = {
        query: vi.fn((sql: string) => {
          if (sql.includes('FROM sigd_auth.vinculo_institucional')) {
            return { rows: [vinculoActivo] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(cliente),
      } as unknown as Pool;

      const service = new VinculoInstitucionalService(pool);
      const resultado = await service.finalizarVinculo({
        vinculoId: vinculoActivoId,
        fechaFinalizacion: '2026-02-15T00:00:00Z',
        motivoFinalizacion: 'Proceso de admisión concluido',
      });

      expect(resultado.estado).toBe('FINALIZADO');
      expect(resultado.motivoFinalizacion).toBe('Proceso de admisión concluido');
      expect(cliente.query).toHaveBeenCalledWith('BEGIN');
      expect(cliente.query).toHaveBeenCalledWith('COMMIT');
    });

    it('anula un vínculo con motivo obligatorio e id de usuario auditor', async () => {
      const vinculoAnularId = 'a1b2c3d4-0003-4000-8000-000000000003';
      const vinculoActivo = {
        id_vinculo: vinculoAnularId,
        id_persona: PERSONA_ID,
        id_tipo_vinculo: 2,
        codigo_tipo: 'ESTUDIANTE_ACTIVO',
        nombre_tipo: 'Estudiante Activo',
        categoria_actor: 'COMUNIDAD_ACADEMICA',
        estado: 'ACTIVO',
        vigente_desde: new Date('2026-01-01T00:00:00Z'),
        vigente_hasta: null,
        motivo_finalizacion: null,
        motivo_anulacion: null,
        anulado_en: null,
        anulado_por: null,
        creado_en: new Date('2026-01-01T00:00:00Z'),
        actualizado_en: new Date('2026-01-01T00:00:00Z'),
      };

      const vinculoAnulado = {
        ...vinculoActivo,
        estado: 'ANULADO',
        motivo_anulacion: 'Error material de registro en ventanilla',
        anulado_en: new Date('2026-01-05T00:00:00Z'),
        anulado_por: USUARIO_ADMIN_ID,
      };

      const cliente = {
        query: vi.fn((sql: string) => {
          if (sql.includes('UPDATE sigd_auth.vinculo_institucional')) {
            return { rows: [vinculoAnulado] };
          }
          if (sql.includes('sigd_audit.bitacora_auditoria')) {
            return { rows: [{ id_auditoria: 'aud-anulacion-01' }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const pool = {
        query: vi.fn((sql: string) => {
          if (sql.includes('FROM sigd_auth.vinculo_institucional')) {
            return { rows: [vinculoActivo] };
          }
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(cliente),
      } as unknown as Pool;

      const service = new VinculoInstitucionalService(pool);
      const resultado = await service.anularVinculo({
        vinculoId: vinculoAnularId,
        motivoAnulacion: 'Error material de registro en ventanilla',
        anuladoPor: USUARIO_ADMIN_ID,
      });

      expect(resultado.estado).toBe('ANULADO');
      expect(resultado.motivoAnulacion).toBe('Error material de registro en ventanilla');
      expect(resultado.anuladoPor).toBe(USUARIO_ADMIN_ID);
    });

    it('rechaza la anulación si no se especifica un motivo', async () => {
      const pool = { query: vi.fn() } as unknown as Pool;
      const service = new VinculoInstitucionalService(pool);

      await expect(
        service.anularVinculo({
          vinculoId: '11111111-1111-4111-8111-111111111111',
          motivoAnulacion: '   ',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('rechaza consulta con fecha_corte inválida con ValidationError', async () => {
      const pool = {
        query: vi.fn((sql: string) => {
          if (sql.includes('EXISTS(SELECT 1 FROM sigd_auth.persona')) return { rows: [{ existe: true }] };
          return { rows: [] };
        }),
      } as unknown as Pool;
      const service = new VinculoInstitucionalService(pool);

      await expect(
        service.listarVinculosPorPersona(PERSONA_ID, { fechaCorte: 'fecha-invalida' }),
      ).rejects.toThrow(ValidationError);
    });

    it('aplica minimización de datos (Ley 29733) en listarMisVinculos omitiendo anuladoPor', async () => {
      const vinculoConAuditor = {
        id_vinculo: '11111111-1111-4111-8111-111111111111',
        id_persona: PERSONA_ID,
        id_tipo_vinculo: 1,
        codigo_tipo: 'POSTULANTE',
        nombre_tipo: 'Postulante',
        categoria_actor: 'COMUNIDAD_ACADEMICA',
        estado: 'ANULADO',
        vigente_desde: new Date('2026-01-01T00:00:00Z'),
        vigente_hasta: null,
        motivo_finalizacion: null,
        motivo_anulacion: 'Error de prueba',
        anulado_en: new Date('2026-01-02T00:00:00Z'),
        anulado_por: USUARIO_ADMIN_ID,
        creado_en: new Date('2026-01-01T00:00:00Z'),
        actualizado_en: new Date('2026-01-02T00:00:00Z'),
      };

      const pool = {
        query: vi.fn((sql: string) => {
          if (sql.includes('SELECT id_persona FROM sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_persona: PERSONA_ID }] };
          }
          if (sql.includes('EXISTS(SELECT 1 FROM sigd_auth.persona')) {
            return { rows: [{ existe: true }] };
          }
          if (sql.includes('FROM sigd_auth.vinculo_institucional')) {
            return { rows: [vinculoConAuditor] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const service = new VinculoInstitucionalService(pool);
      const misVinculos = await service.listarMisVinculos(USUARIO_CIUDADANO_ID);

      expect(misVinculos).toHaveLength(1);
      expect(misVinculos[0].anuladoPor).toBeNull();
    });
  });

  describe('2. Endpoints HTTP y Protección de Autorización (BOLA y Guards)', () => {
    function crearAppMock(queryCustom?: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>) {
      const defaultQuery = async (sql: string, params?: unknown[]) => {
        const sqlStr = String(sql);

        if (queryCustom) {
          const res = await queryCustom(sqlStr, params);
          if (res && Array.isArray(res.rows) && res.rows.length > 0) {
            return res;
          }
        }

        if (sqlStr.includes('sigd_audit.bitacora_auditoria')) {
          return { rows: [{ id_auditoria: 'aud-test-001' }] };
        }

        if (sqlStr.includes('SELECT id_persona FROM sigd_auth.cuenta_usuario')) {
          return { rows: [{ id_persona: PERSONA_ID }] };
        }

        if (sqlStr.includes('EXISTS(SELECT 1 FROM sigd_auth.persona')) {
          return { rows: [{ existe: true }] };
        }

        if (sqlStr.includes('FROM sigd_auth.vinculo_institucional')) {
          return {
            rows: [
              {
                id_vinculo: '11111111-1111-4111-8111-111111111111',
                id_persona: PERSONA_ID,
                id_tipo_vinculo: 1,
                codigo_tipo: 'POSTULANTE',
                nombre_tipo: 'Postulante',
                categoria_actor: 'COMUNIDAD_ACADEMICA',
                estado: 'ACTIVO',
                vigente_desde: new Date('2026-01-01T00:00:00Z'),
                vigente_hasta: null,
                motivo_finalizacion: null,
                motivo_anulacion: null,
                anulado_en: null,
                anulado_por: null,
                creado_en: new Date('2026-01-01T00:00:00Z'),
                actualizado_en: new Date('2026-01-01T00:00:00Z'),
              },
            ],
          };
        }

        if (sqlStr.includes('sigd_auth.tipo_vinculo_institucional')) {
          return {
            rows: [
              {
                id_tipo_vinculo: 1,
                codigo: 'POSTULANTE',
                nombre: 'Postulante',
                categoria_actor: 'COMUNIDAD_ACADEMICA',
                descripcion: 'En proceso de admisión',
                vigente: true,
                creado_en: new Date('2026-01-01T00:00:00Z'),
              },
              {
                id_tipo_vinculo: 2,
                codigo: 'ESTUDIANTE_ACTIVO',
                nombre: 'Estudiante Activo',
                categoria_actor: 'COMUNIDAD_ACADEMICA',
                descripcion: 'Matriculado regular',
                vigente: true,
                creado_en: new Date('2026-01-01T00:00:00Z'),
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

    it('GET /api/v1/identidad/catalogo-vinculos responde HTTP 200 con tipos de vínculo', async () => {
      const app = crearAppMock();
      const res = await request(app).get('/api/v1/identidad/catalogo-vinculos');

      expect(res.status).toBe(200);
      expect(res.body.tipos).toHaveLength(2);
      expect(res.body.tipos[0].codigo).toBe('POSTULANTE');
    });

    it('GET /api/v1/identidad/mis-vinculos resuelve la persona de la cuenta autenticada (BOLA Fail-Closed)', async () => {
      const app = crearAppMock();
      const res = await request(app)
        .get('/api/v1/identidad/mis-vinculos')
        .set('Authorization', `Bearer ${tokenCiudadano}`);

      expect(res.status).toBe(200);
      expect(res.body.vinculos).toHaveLength(1);
      expect(res.body.vinculos[0].idPersona).toBe(PERSONA_ID);
      expect(res.body.vinculos[0].codigoTipo).toBe('POSTULANTE');
    });

    it('GET /api/v1/identidad/mis-vinculos sin autenticación es rechazado con HTTP 401', async () => {
      const app = crearAppMock();
      const res = await request(app).get('/api/v1/identidad/mis-vinculos');

      expect(res.status).toBe(401);
    });

    it('GET /api/v1/identidad/personas/:personaId/vinculos rechaza a cuentas sin rol ADMINISTRADOR (HTTP 403)', async () => {
      const app = crearAppMock();

      // Intento por CIUDADANO
      const resCiudadano = await request(app)
        .get(`/api/v1/identidad/personas/${OTRA_PERSONA_ID}/vinculos`)
        .set('Authorization', `Bearer ${tokenCiudadano}`);
      expect(resCiudadano.status).toBe(403);

      // Intento por MESA_PARTES
      const resMesa = await request(app)
        .get(`/api/v1/identidad/personas/${OTRA_PERSONA_ID}/vinculos`)
        .set('Authorization', `Bearer ${tokenMesaPartes}`);
      expect(resMesa.status).toBe(403);

      // Intento por TESORERIA
      const resTeso = await request(app)
        .get(`/api/v1/identidad/personas/${OTRA_PERSONA_ID}/vinculos`)
        .set('Authorization', `Bearer ${tokenTesoreria}`);
      expect(resTeso.status).toBe(403);
    });

    it('GET /api/v1/identidad/personas/:personaId/vinculos permite consulta a rol ADMINISTRADOR (HTTP 200)', async () => {
      const app = crearAppMock();
      const res = await request(app)
        .get(`/api/v1/identidad/personas/${PERSONA_ID}/vinculos`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.personaId).toBe(PERSONA_ID);
      expect(res.body.vinculos).toHaveLength(1);
    });

    it('POST /api/v1/identidad/personas/:personaId/vinculos rechaza creación a CIUDADANO/MESA_PARTES (HTTP 403)', async () => {
      const app = crearAppMock();

      const res = await request(app)
        .post(`/api/v1/identidad/personas/${PERSONA_ID}/vinculos`)
        .set('Authorization', `Bearer ${tokenCiudadano}`)
        .send({ tipoVinculo: 'POSTULANTE' });

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/identidad/personas/:personaId/vinculos crea vínculo para ADMINISTRADOR (HTTP 201)', async () => {
      const app = crearAppMock(async (sql: string) => {
        if (sql.includes('INSERT INTO sigd_auth.vinculo_institucional')) {
          return {
            rows: [
              {
                id_vinculo: 'v-creado-http',
                id_persona: PERSONA_ID,
                id_tipo_vinculo: 1,
                codigo_tipo: 'POSTULANTE',
                nombre_tipo: 'Postulante',
                categoria_actor: 'COMUNIDAD_ACADEMICA',
                estado: 'ACTIVO',
                vigente_desde: new Date('2026-03-01T00:00:00Z'),
                vigente_hasta: null,
                motivo_finalizacion: null,
                motivo_anulacion: null,
                anulado_en: null,
                anulado_por: null,
                creado_en: new Date('2026-03-01T00:00:00Z'),
                actualizado_en: new Date('2026-03-01T00:00:00Z'),
              },
            ],
          };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post(`/api/v1/identidad/personas/${PERSONA_ID}/vinculos`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          tipoVinculo: 'POSTULANTE',
          vigenteDesde: '2026-03-01T00:00:00Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.idVinculo).toBe('v-creado-http');
      expect(res.body.codigoTipo).toBe('POSTULANTE');
      expect(res.body.estado).toBe('ACTIVO');
    });

    it('PATCH /api/v1/identidad/vinculos/:vinculoId/finalizar finaliza vínculo para ADMINISTRADOR (HTTP 200)', async () => {
      const app = crearAppMock(async (sql: string) => {
        if (sql.includes('UPDATE sigd_auth.vinculo_institucional')) {
          return {
            rows: [
              {
                id_vinculo: 'v-http-01',
                id_persona: PERSONA_ID,
                id_tipo_vinculo: 1,
                codigo_tipo: 'POSTULANTE',
                nombre_tipo: 'Postulante',
                categoria_actor: 'COMUNIDAD_ACADEMICA',
                estado: 'FINALIZADO',
                vigente_desde: new Date('2026-01-01T00:00:00Z'),
                vigente_hasta: new Date('2026-02-01T00:00:00Z'),
                motivo_finalizacion: 'Trámite concluido',
                motivo_anulacion: null,
                anulado_en: null,
                anulado_por: null,
                creado_en: new Date('2026-01-01T00:00:00Z'),
                actualizado_en: new Date('2026-02-01T00:00:00Z'),
              },
            ],
          };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .patch('/api/v1/identidad/vinculos/11111111-1111-4111-8111-111111111111/finalizar')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          motivoFinalizacion: 'Trámite concluido',
          fechaFinalizacion: '2026-02-01T00:00:00Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('FINALIZADO');
      expect(res.body.motivoFinalizacion).toBe('Trámite concluido');
    });

    it('PATCH /api/v1/identidad/vinculos/:vinculoId/anular anula vínculo para ADMINISTRADOR con motivo (HTTP 200)', async () => {
      const app = crearAppMock(async (sql: string) => {
        if (sql.includes('UPDATE sigd_auth.vinculo_institucional')) {
          return {
            rows: [
              {
                id_vinculo: 'v-http-01',
                id_persona: PERSONA_ID,
                id_tipo_vinculo: 1,
                codigo_tipo: 'POSTULANTE',
                nombre_tipo: 'Postulante',
                categoria_actor: 'COMUNIDAD_ACADEMICA',
                estado: 'ANULADO',
                vigente_desde: new Date('2026-01-01T00:00:00Z'),
                vigente_hasta: null,
                motivo_finalizacion: null,
                motivo_anulacion: 'Registro duplicado',
                anulado_en: new Date('2026-01-02T00:00:00Z'),
                anulado_por: USUARIO_ADMIN_ID,
                creado_en: new Date('2026-01-01T00:00:00Z'),
                actualizado_en: new Date('2026-01-02T00:00:00Z'),
              },
            ],
          };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .patch('/api/v1/identidad/vinculos/11111111-1111-4111-8111-111111111111/anular')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          motivoAnulacion: 'Registro duplicado',
        });

      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('ANULADO');
      expect(res.body.motivoAnulacion).toBe('Registro duplicado');
      expect(res.body.anuladoPor).toBe(USUARIO_ADMIN_ID);
    });
  });
});

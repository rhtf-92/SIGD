/**
 * =============================================================================
 * Suite de Pruebas Unitarias — Fase 5E: TUPA Operativo + Clasificación +
 * Versionado + Trazabilidad Histórica + Autorización 5D
 * Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
 * -----------------------------------------------------------------------------
 * Autor: Geric (B_GERIC)
 * Marco: Versionamiento e Inmutabilidad Histórica TUPA 2026-2027
 * =============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import {
  TupaVersionRepository,
  type FilaTupaVersion,
  type FilaTupaProcedimiento,
} from '../../../../src/domains/tramicore/tupaVersion.repository.js';
import { TupaVersionadoService } from '../../../../src/domains/tramicore/tupaVersionado.service.js';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { AuthorizationService } from '../../../../src/core/auth/authorization.service.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../../src/shared/domain/errors/index.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

describe('SIGD Fase 5E — TUPA Operativo, Versionado y Trazabilidad Histórica', () => {
  const ID_V2026 = '11111111-2026-4111-8111-111111111111';
  const ID_V2027 = '22222222-2027-4222-8222-222222222222';
  const ID_V2027_R2 = '33333333-2027-4333-8333-333333333333';
  const ID_PROC_1 = '44444444-4444-4444-8444-444444444444';
  const ID_PROC_2 = '55555555-5555-4555-8555-555555555555';
  const ID_PROC_3 = '66666666-6666-4666-8666-666666666666';
  const ID_EXPEDIENTE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  const USUARIO_GESTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const USUARIO_APROBADOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const USUARIO_ADMIN_TECNICO_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const USUARIO_INACTIVO_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const tokenGestor = firmarTokenAcceso({
    sub: USUARIO_GESTOR_ID,
    roles: ['ADMINISTRADOR'],
  });

  const tokenAprobador = firmarTokenAcceso({
    sub: USUARIO_APROBADOR_ID,
    roles: ['DIRECTOR'],
  });

  const tokenAdminTecnico = firmarTokenAcceso({
    sub: USUARIO_ADMIN_TECNICO_ID,
    roles: ['ADMINISTRADOR'],
  });

  const tokenInactivo = firmarTokenAcceso({
    sub: USUARIO_INACTIVO_ID,
    roles: ['ADMINISTRADOR'],
  });

  // ===========================================================================
  // 1. REPOSITORIO — VERSIONAMIENTO OPERATIVO, CLONACIÓN Y DIFF
  // ===========================================================================
  describe('1. Repositorio TupaVersionRepository — Versionamiento y Revisiones', () => {
    it('Crear borrador: crea nueva versión en BORRADOR sin alterar versión vigente', async () => {
      const mockClientQuery = vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('INSERT INTO sigd_doc.tupa_version')) {
          return {
            rows: [
              {
                id_version: ID_V2027,
                codigo: 'TUPA-2027',
                denominacion: 'TUPA 2027 Borrador',
                anio: 2027,
                revision: 1,
                estado: 'BORRADOR',
                total_procedimientos: 0,
                vigente_desde: null,
                vigente_hasta: null,
                motivo_cambio: 'Preparación para el nuevo año lectivo',
                version_origen_id: ID_V2026,
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          return { rows: [{ id_auditoria: 'audit-001' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT id_version FROM sigd_doc.tupa_version')) {
            return { rows: [], rowCount: 0 }; // No existe conflicto
          }
          return { rows: [], rowCount: 0 };
        }),
        connect: vi.fn().mockResolvedValue({
          query: mockClientQuery,
          release: vi.fn(),
        }),
      } as unknown as Pool;

      const repo = new TupaVersionRepository(mockPool);
      const nueva = await repo.crearVersionBorrador({
        anio: 2027,
        denominacion: 'TUPA 2027 Borrador',
        motivoCambio: 'Preparación para el nuevo año lectivo',
        clonarDeIdVersion: ID_V2026,
      });

      expect(nueva.estado).toBe('BORRADOR');
      expect(nueva.codigo).toBe('TUPA-2027');
      expect(nueva.anio).toBe(2027);
      expect(nueva.revision).toBe(1);
    });

    it('Revisiones intra-anuales: permite crear Revisión 2 en el mismo año', async () => {
      const mockClientQuery = vi.fn().mockImplementation(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 };
        if (sql.includes('INSERT INTO sigd_doc.tupa_version')) {
          return {
            rows: [
              {
                id_version: ID_V2027_R2,
                codigo: 'TUPA-2027-R2',
                denominacion: 'TUPA 2027 Revisión 2',
                anio: 2027,
                revision: 2,
                estado: 'BORRADOR',
                total_procedimientos: 0,
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          return { rows: [{ id_auditoria: 'audit-002' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const mockPool = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        connect: vi.fn().mockResolvedValue({
          query: mockClientQuery,
          release: vi.fn(),
        }),
      } as unknown as Pool;

      const repo = new TupaVersionRepository(mockPool);
      const r2 = await repo.crearVersionBorrador({
        anio: 2027,
        revision: 2,
        denominacion: 'TUPA 2027 Revisión 2',
      });

      expect(r2.revision).toBe(2);
      expect(r2.codigo).toBe('TUPA-2027-R2');
      expect(r2.estado).toBe('BORRADOR');
    });

    it('Clonar versión base: copia íntegramente los 72 procedimientos a la nueva versión borrador', async () => {
      const procsBase: Partial<FilaTupaProcedimiento>[] = Array.from({ length: 72 }, (_, i) => ({
        codigo_ref: `P${String(i + 1).padStart(2, '0')}`,
        codigo_externo: `EXT-${i + 1}`,
        denominacion: `Procedimiento Oficial ${i + 1}`,
        categoria: i < 18 ? 'PROCEDIMIENTO_APROBADO' : 'SERVICIO_ACADEMICO',
        tipo_formulario: 'DOCUMENTARIO',
        monto: (i + 1) * 5,
        unidad_cobro: 'PEN',
        plazo_dias: 30,
        requisitos: ['DNI'],
        genera_expediente: i < 18,
        calificacion: 'EVALUACION_PREVIA_POSITIVA',
        activo: true,
        orden: i + 1,
      }));

      const insertedProcs: unknown[] = [];

      const mockClientQuery = vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 };
        if (sql.includes('INSERT INTO sigd_doc.tupa_version')) {
          return {
            rows: [
              {
                id_version: ID_V2027,
                codigo: 'TUPA-2027',
                denominacion: 'TUPA 2027',
                anio: 2027,
                revision: 1,
                estado: 'BORRADOR',
                total_procedimientos: 0,
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes('SELECT codigo_ref, codigo_externo, denominacion')) {
          return { rows: procsBase, rowCount: procsBase.length };
        }
        if (sql.includes('INSERT INTO sigd_doc.tupa_procedimiento')) {
          insertedProcs.push(params);
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes('UPDATE sigd_doc.tupa_version SET total_procedimientos')) {
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          return { rows: [{ id_auditoria: 'audit-003' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const mockPool = {
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        connect: vi.fn().mockResolvedValue({
          query: mockClientQuery,
          release: vi.fn(),
        }),
      } as unknown as Pool;

      const repo = new TupaVersionRepository(mockPool);
      const clonada = await repo.clonarVersion(
        ID_V2026,
        'TUPA-2027',
        2027,
        'TUPA 2027 Clonado',
        'Clonación para revisión anual',
      );

      expect(insertedProcs).toHaveLength(72);
      expect(clonada.total_procedimientos).toBe(72);
    });

    it('Modificar procedimiento en borrador: actualiza monto, nombre y genera_expediente', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes('SELECT p.*, v.estado as estado_version')) {
            return {
              rows: [
                {
                  id_procedimiento: ID_PROC_1,
                  id_version: ID_V2027,
                  estado_version: 'BORRADOR',
                  codigo_ref: 'P01',
                  denominacion: 'Certificado de Estudios Original',
                  monto: '18.00',
                  plazo_dias: 30,
                  genera_expediente: true,
                },
              ],
              rowCount: 1,
            };
          }
          if (sql.includes('UPDATE sigd_doc.tupa_procedimiento')) {
            return {
              rows: [
                {
                  id_procedimiento: ID_PROC_1,
                  id_version: ID_V2027,
                  codigo_ref: 'P01',
                  denominacion: 'Certificado de Estudios Actualizado 2027',
                  monto: '25.00',
                  plazo_dias: 15,
                  genera_expediente: true,
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as Pool;

      const repo = new TupaVersionRepository(mockPool);
      const procActualizado = await repo.actualizarProcedimiento(
        ID_PROC_1,
        {
          denominacion: 'Certificado de Estudios Actualizado 2027',
          monto: 25.0,
          plazoDias: 15,
        },
        ID_V2027,
      );

      expect(procActualizado.denominacion).toBe('Certificado de Estudios Actualizado 2027');
      expect(procActualizado.monto).toBe('25.00');
      expect(procActualizado.plazo_dias).toBe(15);
    });

    it('Histórico inmutable: DENY al intentar modificar procedimiento de versión HISTORICO', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id_procedimiento: ID_PROC_1,
              id_version: ID_V2026,
              estado_version: 'HISTORICO',
            },
          ],
          rowCount: 1,
        }),
      } as unknown as Pool;

      const repo = new TupaVersionRepository(mockPool);
      await expect(
        repo.actualizarProcedimiento(ID_PROC_1, { monto: 99.0 }, ID_V2026),
      ).rejects.toThrow(ConflictError);
    });

    it('Vigente protegida: DENY al intentar modificar procedimiento de versión VIGENTE', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id_procedimiento: ID_PROC_1,
              id_version: ID_V2026,
              estado_version: 'VIGENTE',
            },
          ],
          rowCount: 1,
        }),
      } as unknown as Pool;

      const repo = new TupaVersionRepository(mockPool);
      await expect(
        repo.actualizarProcedimiento(ID_PROC_1, { monto: 99.0 }, ID_V2026),
      ).rejects.toThrow(ConflictError);
    });

    it('BOLA Integrity: DENY si id_procedimiento no pertenece a idVersion indicada', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id_procedimiento: ID_PROC_1,
              id_version: ID_V2026, // pertenece a 2026
              estado_version: 'BORRADOR',
            },
          ],
          rowCount: 1,
        }),
      } as unknown as Pool;

      const repo = new TupaVersionRepository(mockPool);
      // Intenta actualizar enviando idVersion = ID_V2027
      await expect(
        repo.actualizarProcedimiento(ID_PROC_1, { monto: 30.0 }, ID_V2027),
      ).rejects.toThrow(ConflictError);
    });

    it('Activar nueva versión: transacción archiva vigente previa y activa nueva versión con fechas', async () => {
      let vigentePreviaArchivada = false;
      let nuevaActivada = false;

      const mockClientQuery = vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 };
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 0 };
        if (sql.includes('UPDATE sigd_doc.tupa_version') && sql.includes("estado = 'HISTORICO'")) {
          vigentePreviaArchivada = true;
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes('UPDATE sigd_doc.tupa_version') && sql.includes("estado = 'VIGENTE'")) {
          nuevaActivada = true;
          return {
            rows: [
              {
                id_version: ID_V2027,
                codigo: 'TUPA-2027',
                estado: 'VIGENTE',
                vigente_desde: params?.[0] ?? new Date(),
                total_procedimientos: 72,
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          return { rows: [{ id_auditoria: 'audit-004' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT v.id_version')) {
            return {
              rows: [
                {
                  id_version: ID_V2027,
                  codigo: 'TUPA-2027',
                  estado: 'BORRADOR',
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
        connect: vi.fn().mockResolvedValue({
          query: mockClientQuery,
          release: vi.fn(),
        }),
      } as unknown as Pool;

      const repo = new TupaVersionRepository(mockPool);
      const activada = await repo.publicarVersion(ID_V2027, '2027-01-01T00:00:00Z', USUARIO_APROBADOR_ID);

      expect(vigentePreviaArchivada).toBe(true);
      expect(nuevaActivada).toBe(true);
      expect(activada.estado).toBe('VIGENTE');
    });

    it('Diff entre versiones: identifica exactamente 3 modificados y 69 sin cambios', async () => {
      // 72 procedimientos en A
      const procsA: FilaTupaProcedimiento[] = Array.from({ length: 72 }, (_, i) => ({
        id_procedimiento: `proc-a-${i + 1}`,
        id_version: ID_V2026,
        codigo_ref: `P${String(i + 1).padStart(2, '0')}`,
        codigo_externo: `EXT-${i + 1}`,
        denominacion: `Procedimiento Oficial ${i + 1}`,
        categoria: i < 18 ? 'PROCEDIMIENTO_APROBADO' : 'SERVICIO_ACADEMICO',
        tipo_formulario: 'DOCUMENTARIO',
        monto: 20.0,
        unidad_cobro: 'PEN',
        plazo_dias: 30,
        plazo_fuente: 'OFICIAL',
        requisitos: [],
        genera_expediente: i < 18,
        calificacion: 'EVALUACION_PREVIA_POSITIVA',
        calificacion_fuente: 'OFICIAL',
        canal_presentacion: 'MESA_PARTES',
        unidad_receptora_id: null,
        unidad_responsable_id: null,
        unidad_resolutiva_id: null,
        unidad_financiera_id: null,
        intervencion_financiera: 'NO_REQUIERE_PAGO',
        registro_version_id: null,
        activo: true,
        orden: i + 1,
        creado_en: '2026-01-01',
        actualizado_en: '2026-01-01',
      }));

      // 72 procedimientos en B con solo 3 cambiados (P05, P12, P40)
      const procsB: FilaTupaProcedimiento[] = procsA.map((p) => {
        if (p.codigo_ref === 'P05') {
          return { ...p, id_version: ID_V2027, monto: 35.0, denominacion: 'Constancia de Notas Expres' };
        }
        if (p.codigo_ref === 'P12') {
          return { ...p, id_version: ID_V2027, plazo_dias: 10, categoria: 'TRAMITE_URGENTE' };
        }
        if (p.codigo_ref === 'P40') {
          return { ...p, id_version: ID_V2027, genera_expediente: true };
        }
        return { ...p, id_version: ID_V2027 };
      });

      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes('SELECT v.id_version')) {
            const id = params?.[0];
            return {
              rows: [
                {
                  id_version: id,
                  codigo: id === ID_V2026 ? 'TUPA-2026' : 'TUPA-2027',
                  denominacion: id === ID_V2026 ? 'TUPA 2026' : 'TUPA 2027',
                  estado: id === ID_V2026 ? 'HISTORICO' : 'VIGENTE',
                  revision: 1,
                },
              ],
              rowCount: 1,
            };
          }
          if (sql.includes('SELECT id_procedimiento, id_version')) {
            const id = params?.[0];
            return {
              rows: id === ID_V2026 ? procsA : procsB,
              rowCount: 72,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as Pool;

      const repo = new TupaVersionRepository(mockPool);
      const diff = await repo.obtenerDiffVersiones(ID_V2026, ID_V2027);

      expect(diff.resumen.totalOrigen).toBe(72);
      expect(diff.resumen.totalDestino).toBe(72);
      expect(diff.resumen.agregados).toBe(0);
      expect(diff.resumen.eliminados).toBe(0);
      expect(diff.resumen.modificados).toBe(3);
      expect(diff.resumen.sinCambios).toBe(69);

      const modP05 = diff.modificados.find((m) => m.codigoRef === 'P05');
      expect(modP05).toBeDefined();
      expect(modP05?.cambios.some((c) => c.campo === 'monto' && c.antes === 20 && c.despues === 35)).toBe(true);
      expect(modP05?.cambios.some((c) => c.campo === 'denominacion')).toBe(true);

      const modP40 = diff.modificados.find((m) => m.codigoRef === 'P40');
      expect(modP40?.cambios.some((c) => c.campo === 'genera_expediente' && c.antes === false && c.despues === true)).toBe(true);
    });
  });

  // ===========================================================================
  // 2. SERVICIO — TRAZABILIDAD HISTÓRICA E INMUTABILIDAD DE EXPEDIENTES
  // ===========================================================================
  describe('2. Trazabilidad Histórica de Expedientes y Snapshots', () => {
    it('Expediente histórico creado bajo TUPA 2026 conserva snapshot inalterado', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes('SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente')) {
            return { rows: [{ existe: true }], rowCount: 1 };
          }
          if (sql.includes('FROM sigd_doc.expediente_tupa_vinculo')) {
            return {
              rows: [
                {
                  registro_version_id: 'reg-version-2026-uuid',
                  codigo_externo: 'TUPA-2026-P01',
                  denominacion_original: 'Certificado de Estudios 2026',
                  monto_original: '15.00',
                  fuente_nombre: 'TUPA_2026_OFICIAL.pdf',
                  pagina: 12,
                  revision: 1,
                  version_fuente: '2026',
                  estado_validacion: 'APROBADO',
                  vinculado_en: new Date('2026-03-15T10:00:00Z'),
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as Pool;

      const service = new TupaVersionadoService(mockPool);
      const contexto = await service.obtenerContextoExpediente(ID_EXPEDIENTE);

      expect(contexto.tupa).not.toBeNull();
      expect(contexto.tupa?.denominacion).toBe('Certificado de Estudios 2026');
      expect(contexto.tupa?.monto).toBe('15.00');
      expect(contexto.tupa?.revision).toBe(1);
      expect(contexto.tupa?.version).toBe('2026');
    });

    it('Nuevo expediente toma la versión vigente en el momento de su radicación', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              registro_version_id: '22222222-2222-4222-8222-222222222222',
              codigo_externo: 'TUPA-2027-P01',
              denominacion_original: 'Certificado de Estudios 2027',
              monto_original: '25.00',
              fuente_nombre: 'TUPA_2027_OFICIAL.pdf',
              pagina: 12,
              revision: 1,
              version_fuente: '2027',
              estado_validacion: 'APROBADO',
              vigencia_desde: '2027-01-01',
              vigencia_hasta: null,
            },
          ],
          rowCount: 1,
        }),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const service = new TupaVersionadoService(mockPool);
      const res = await service.validarYObtenerVersion(
        mockClient,
        '22222222-2222-4222-8222-222222222222',
        new Date('2027-03-01T00:00:00Z'),
      );

      expect(res.denominacion).toBe('Certificado de Estudios 2027');
      expect(res.monto).toBe('25.00');
    });

    it('Cambio de arancel en 2027 no modifica el precio del trámite histórico 2026', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente')) {
            return { rows: [{ existe: true }], rowCount: 1 };
          }
          if (sql.includes('FROM sigd_doc.expediente_tupa_vinculo')) {
            return {
              rows: [
                {
                  registro_version_id: 'reg-2026-uuid',
                  monto_original: '50.00', // S/ 50 en 2026
                  denominacion_original: 'Duplicado de Diploma 2026',
                  revision: 1,
                  version_fuente: '2026',
                  estado_validacion: 'APROBADO',
                  vinculado_en: new Date('2026-05-10T00:00:00Z'),
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as Pool;

      const service = new TupaVersionadoService(mockPool);
      const expHistorico = await service.obtenerContextoExpediente(ID_EXPEDIENTE);

      // El monto histórico se mantiene inmutable en S/ 50.00
      expect(expHistorico.tupa?.monto).toBe('50.00');
    });
  });

  // ===========================================================================
  // 3. CONTROLADOR Y AUTORIZACIÓN CONTEXTUAL 5D
  // ===========================================================================
  describe('3. Rutas Administrativas TUPA y Guardias de Autorización 5D', () => {
    let app: Express;
    let mockAuthService: AuthorizationService;

    beforeEach(() => {
      mockAuthService = {
        exigirAutorizacion: vi.fn().mockImplementation(async (solicitud) => {
          // Inactivo -> Fail Closed
          if (solicitud.usuarioId === USUARIO_INACTIVO_ID) {
            throw new ForbiddenError({ detail: 'Cuenta inactiva (fail-closed).' });
          }
          // Gestor TUPA: solo TUPA_GESTIONAR
          if (solicitud.usuarioId === USUARIO_GESTOR_ID) {
            if (solicitud.accion === 'TUPA_GESTIONAR') return { autorizado: true };
            throw new ForbiddenError({ detail: 'No autorizado para activar versiones TUPA (se requiere TUPA_ACTIVAR).' });
          }
          // Aprobador TUPA: TUPA_ACTIVAR
          if (solicitud.usuarioId === USUARIO_APROBADOR_ID) {
            if (solicitud.accion === 'TUPA_ACTIVAR') return { autorizado: true };
            if (solicitud.accion === 'TUPA_GESTIONAR') return { autorizado: true };
          }
          // Administrador técnico SIGD sin perfil sustantivo APROBADOR_TUPA
          if (solicitud.usuarioId === USUARIO_ADMIN_TECNICO_ID) {
            if (solicitud.accion === 'TUPA_GESTIONAR') return { autorizado: true };
            if (solicitud.accion === 'TUPA_ACTIVAR') {
              throw new ForbiddenError({
                detail: 'ADMINISTRADOR_SIGD no posee autoridad institucional para activar versiones normativas TUPA.',
              });
            }
          }
          throw new ForbiddenError({ detail: 'Sin permisos TUPA.' });
        }),
      } as unknown as AuthorizationService;

      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
            const id = params?.[0];
            const activo = id !== USUARIO_INACTIVO_ID;
            return {
              rows: [{ id_persona: 'pers-1', activo, correo: 'user@iestpsuiza.edu.pe', nombre_completo: 'Usuario Test' }],
              rowCount: 1,
            };
          }
          if (sql.includes('SELECT id_version FROM sigd_doc.tupa_version')) {
            return { rows: [], rowCount: 0 };
          }
          if (sql.includes('SELECT p.*, v.estado as estado_version')) {
            return {
              rows: [
                {
                  id_procedimiento: ID_PROC_1,
                  id_version: ID_V2027,
                  estado_version: 'BORRADOR',
                  monto: '20.00',
                  plazo_dias: 30,
                  denominacion: 'Procedimiento Borrador',
                },
              ],
              rowCount: 1,
            };
          }
          if (sql.includes('UPDATE sigd_doc.tupa_procedimiento')) {
            return {
              rows: [
                {
                  id_procedimiento: ID_PROC_1,
                  id_version: ID_V2027,
                  monto: '25.00',
                  plazo_dias: 15,
                  denominacion: 'Procedimiento Editado',
                },
              ],
              rowCount: 1,
            };
          }
          if (sql.includes('SELECT v.id_version')) {
            return {
              rows: [
                {
                  id_version: ID_V2027,
                  codigo: 'TUPA-2027',
                  estado: 'BORRADOR',
                  revision: 1,
                },
              ],
              rowCount: 1,
            };
          }
          if (sql.includes('SELECT id_procedimiento, id_version')) {
            return { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        }),
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('INSERT INTO sigd_doc.tupa_version')) {
              return {
                rows: [
                  {
                    id_version: ID_V2027,
                    codigo: 'TUPA-2027',
                    anio: 2027,
                    revision: 1,
                    estado: 'BORRADOR',
                  },
                ],
                rowCount: 1,
              };
            }
            if (sql.includes("SET estado = 'VIGENTE'")) {
              return {
                rows: [
                  {
                    id_version: ID_V2027,
                    codigo: 'TUPA-2027',
                    estado: 'VIGENTE',
                  },
                ],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }),
          release: vi.fn(),
        }),
      } as unknown as Pool;

      app = express();
      app.use(express.json());
      app.use('/api/v1', crearRouterTramites(mockPool, undefined, undefined, mockAuthService));
      app.use(errorMiddleware);
    });

    it('POST /admin/tupa/versiones: Gestor con TUPA_GESTIONAR crea borrador exitosamente (201)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tupa/versiones')
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({
          anio: 2027,
          denominacion: 'TUPA 2027 Borrador Oficial',
        });

      expect(res.status).toBe(201);
      expect(res.body.codigo).toBe('TUPA-2027');
      expect(mockAuthService.exigirAutorizacion).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: USUARIO_GESTOR_ID,
          accion: 'TUPA_GESTIONAR',
        }),
      );
    });

    it('POST /admin/tupa/versiones/:id/clonar: clona versión base como borrador', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/tupa/versiones/${ID_V2026}/clonar`)
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({
          nuevoCodigo: 'TUPA-2027',
          anio: 2027,
          denominacion: 'TUPA 2027 Clonado de 2026',
        });

      expect(res.status).toBe(201);
      expect(res.body.codigo).toBe('TUPA-2027');
    });

    it('PATCH /admin/tupa/versiones/:idVersion/procedimientos/:idProcedimiento: edita procedimiento en borrador', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/tupa/versiones/${ID_V2027}/procedimientos/${ID_PROC_1}`)
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({
          denominacion: 'Procedimiento Editado',
          monto: 25.0,
          plazoDias: 15,
        });

      expect(res.status).toBe(200);
      expect(res.body.denominacion).toBe('Procedimiento Editado');
    });

    it('GET /admin/tupa/versiones/:idA/diff/:idB: compara versiones con TUPA_GESTIONAR', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/tupa/versiones/${ID_V2026}/diff/${ID_V2027}`)
        .set('Authorization', `Bearer ${tokenGestor}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('versionOrigen');
      expect(res.body).toHaveProperty('versionDestino');
      expect(res.body).toHaveProperty('resumen');
    });

    it('POST /admin/tupa/versiones/:id/publicar: GESTOR_TUPA sin TUPA_ACTIVAR es DENEGADO (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/tupa/versiones/${ID_V2027}/publicar`)
        .set('Authorization', `Bearer ${tokenGestor}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('POST /admin/tupa/versiones/:id/publicar: ADMINISTRADOR_SIGD técnico sin perfil APROBADOR_TUPA es DENEGADO (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/tupa/versiones/${ID_V2027}/publicar`)
        .set('Authorization', `Bearer ${tokenAdminTecnico}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('POST /admin/tupa/versiones/:id/publicar: APROBADOR_TUPA con TUPA_ACTIVAR publica y activa exitosamente (200)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/tupa/versiones/${ID_V2027}/publicar`)
        .set('Authorization', `Bearer ${tokenAprobador}`)
        .send({ fechaVigenciaDesde: '2027-01-01T00:00:00Z' });

      expect(res.status).toBe(200);
      expect(res.body.mensaje).toContain('publicada y activada exitosamente');
      expect(res.body.version.estado).toBe('VIGENTE');
    });

    it('Fail-closed: Cuenta inactiva es DENEGADA deterministamente (403)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tupa/versiones')
        .set('Authorization', `Bearer ${tokenInactivo}`)
        .send({
          anio: 2028,
          denominacion: 'TUPA 2028 Test',
        });

      expect(res.status).toBe(403);
    });
  });
});

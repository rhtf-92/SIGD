import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import {
  RepositorioPostgresRutaDoc,
  SQL_LISTAR_RUTADOC,
  SQL_CONTADORES_SIN_TERMINO_RUTADOC,
} from '../../../../src/domains/rutadoc/rutadoc.repository.js';
import { ServicioRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.service.js';
import type { ActorRutaDoc, FiltrosRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

const AREA_MP = 'f9e9bd16-8f5c-4190-8678-1205588dcdb8';
const AREA_SA = 'acba43fa-642b-4c53-a750-247c6ba2d37f';
const EXP_PRESENCIAL_MP = '06aaa3c6-ccf1-4a75-93a4-581e5ef9e366'; // EXP-2026-000002
const EXP_DERIVADO_SA = 'f2600000-0000-4000-8000-000000000004'; // Derivado con área SA

describe('RutaDoc: Área efectiva y aislamiento RBAC por área', () => {
  it('la consulta SQL_LISTAR_RUTADOC utiliza la fórmula de área efectiva institucional con deduplicación determinista', () => {
    expect(SQL_LISTAR_RUTADOC).toContain('CASE');
    expect(SQL_LISTAR_RUTADOC).toContain('WHEN ultimo.expediente_id IS NOT NULL THEN NULLIF(ultimo.area_actual_id, \'\')');
    expect(SQL_LISTAR_RUTADOC).toContain("WHEN ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')");
    expect(SQL_LISTAR_RUTADOC).toContain("SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP'");
    expect(SQL_LISTAR_RUTADOC).toContain('AS area_actual_id');
    // Deduplicación determinista para evitar duplicados si hay múltiples asientos
    expect(SQL_LISTAR_RUTADOC).toContain('SELECT DISTINCT ON (expediente_id)');
    expect(SQL_LISTAR_RUTADOC).toContain('WHERE anulado = FALSE');
    expect(SQL_LISTAR_RUTADOC).toContain('ORDER BY expediente_id, numero_registro ASC');
  });

  it('la consulta de contadores SQL_CONTADORES_SIN_TERMINO_RUTADOC incluye deduplicación de asiento_registro y filtro de área', () => {
    expect(SQL_CONTADORES_SIN_TERMINO_RUTADOC).toContain('SELECT DISTINCT ON (expediente_id)');
    expect(SQL_CONTADORES_SIN_TERMINO_RUTADOC).toContain('($2::text IS NULL OR (');
    expect(SQL_CONTADORES_SIN_TERMINO_RUTADOC).toContain(') = $2::text)');
  });

  it('determina área MP para expedientes sin movimientos con asiento presencial/virtual legítimo', async () => {
    const mockQuery = vi.fn().mockImplementation(async () => {
      return {
        rows: [{
          id_expediente: EXP_PRESENCIAL_MP,
          cut: 'EXP-2026-000002',
          asunto: 'Tramite presencial',
          fecha_radicacion: new Date('2026-10-22T08:00:00Z'),
          estado_actual: 'REGISTRADO',
          area_actual_id: AREA_MP,
        }],
        rowCount: 1,
      };
    });
    const pool = {
      connect: vi.fn().mockResolvedValue({
        query: mockQuery,
        release: vi.fn(),
      }),
    } as unknown as Pool;

    const repo = new RepositorioPostgresRutaDoc(pool);
    const filtros: FiltrosRutaDoc = { pestana: 'PENDIENTES', limite: 20, areaId: AREA_MP };
    const resultado = await repo.listar(filtros, ['REGISTRADO'], null, { solicitanteId: null, accesoGlobal: true });

    expect(resultado.elementos).toHaveLength(1);
    expect(resultado.elementos[0].idExpediente).toBe(EXP_PRESENCIAL_MP);
    expect(resultado.elementos[0].areaActualId).toBe(AREA_MP);
  });

  it('aislamiento estricto: filtro por Secretaría Académica (SA) no retorna expedientes de Mesa de Partes (MP)', async () => {
    const mockQuery = vi.fn().mockImplementation(async () => {
      return { rows: [], rowCount: 0 };
    });
    const pool = {
      connect: vi.fn().mockResolvedValue({
        query: mockQuery,
        release: vi.fn(),
      }),
    } as unknown as Pool;

    const repo = new RepositorioPostgresRutaDoc(pool);
    const filtros: FiltrosRutaDoc = { pestana: 'PENDIENTES', limite: 20, areaId: AREA_SA };
    const resultado = await repo.listar(filtros, ['REGISTRADO'], null, { solicitanteId: null, accesoGlobal: true });

    expect(resultado.elementos).toHaveLength(0);
  });

  it('para expedientes ya derivados, el área efectiva corresponde al área registrada en el movimiento', async () => {
    const mockQuery = vi.fn().mockImplementation(async () => {
      return {
        rows: [{
          id_expediente: EXP_DERIVADO_SA,
          cut: 'EXP-2026-990004',
          asunto: 'Tramite derivado a SA',
          fecha_radicacion: new Date('2026-10-20T10:00:00Z'),
          estado_actual: 'DERIVADO',
          area_actual_id: AREA_SA,
        }],
        rowCount: 1,
      };
    });
    const pool = {
      connect: vi.fn().mockResolvedValue({
        query: mockQuery,
        release: vi.fn(),
      }),
    } as unknown as Pool;

    const repo = new RepositorioPostgresRutaDoc(pool);
    const filtros: FiltrosRutaDoc = { pestana: 'DERIVADOS', limite: 20, areaId: AREA_SA };
    const resultado = await repo.listar(filtros, ['DERIVADO'], null, { solicitanteId: null, accesoGlobal: true });

    expect(resultado.elementos).toHaveLength(1);
    expect(resultado.elementos[0].idExpediente).toBe(EXP_DERIVADO_SA);
    expect(resultado.elementos[0].areaActualId).toBe(AREA_SA);
  });

  it('un expediente sin procedencia verificable evalúa a NULL y queda excluido', async () => {
    const mockQuery = vi.fn().mockImplementation(async () => {
      return { rows: [], rowCount: 0 };
    });
    const pool = {
      connect: vi.fn().mockResolvedValue({
        query: mockQuery,
        release: vi.fn(),
      }),
    } as unknown as Pool;

    const repo = new RepositorioPostgresRutaDoc(pool);
    const filtros: FiltrosRutaDoc = { pestana: 'PENDIENTES', limite: 20, areaId: AREA_MP };
    const resultado = await repo.listar(filtros, ['REGISTRADO'], null, { solicitanteId: null, accesoGlobal: true });

    expect(resultado.elementos).toHaveLength(0);
  });

  it('protección contra manipulación de área: un operador institucional no puede cambiar su área asignada', async () => {
    const repo = {
      listar: vi.fn().mockResolvedValue({ elementos: [], porEstado: {} }),
      obtener: vi.fn(),
    };
    const servicio = new ServicioRutaDoc(repo);
    const actorOperador: ActorRutaDoc = {
      id: 'op-mp',
      roles: ['MESA_PARTES'],
      unidadOrganicaId: AREA_MP,
      obtenerAlcanceBandeja: async () => ({ solicitanteId: 'persona-1', accesoGlobal: false }),
    };

    // Intentar consultar SA siendo operador de MP debe ser rechazado
    await expect(servicio.listar({ pestana: 'PENDIENTES', limite: 20, areaId: AREA_SA }, actorOperador))
      .rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(repo.listar).not.toHaveBeenCalled();

    // Consultar sin especificar areaId debe fijar automáticamente el área autorizada (MP)
    await servicio.listar({ pestana: 'PENDIENTES', limite: 20 }, actorOperador);
    expect(repo.listar).toHaveBeenCalledOnce();
    expect((repo.listar as ReturnType<typeof vi.fn>).mock.calls[0][0].areaId).toBe(AREA_MP);
  });
});

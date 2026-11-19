import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { RepositorioMgdAnalytics } from '../../../../src/domains/corelink/mgdAnalytics.repository.js';
import { ServicioMgdAnalytics } from '../../../../src/domains/corelink/mgdAnalytics.service.js';
import { filtrosResumenSchema } from '../../../../src/domains/corelink/reportes.schemas.js';

describe('Reportes: fuente operativa de lectura (contratos con dobles)', () => {
  it('reutiliza la vista disponible y completa el día del período mensual', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new RepositorioMgdAnalytics({ query } as unknown as Pool).obtenerContadores('2026-10');
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][1]).toEqual(['2026-10-01']);
    expect(query.mock.calls[0][0]).not.toContain('sigd_tra.expediente e');
  });
  it('si falta la vista consulta las tablas reales sin crear ni refrescar objetos', async () => {
    const query = vi.fn().mockRejectedValueOnce({ code: '42P01', message: 'relation sigd_tra.mv_kpis_mgd_mensual does not exist' })
      .mockResolvedValueOnce({ rows: [{ periodo: '2026-10', n_radicados: '5', n_atendidos: '1', n_resueltos: '1', horas_habiles_suma: '8.5' }] });
    const resultado = await new RepositorioMgdAnalytics({ query } as unknown as Pool).obtenerContadores('2026-10');
    expect(resultado[0].contadores).toMatchObject({ nRadicados: 5, nAtendidos: 1, horasHabilesSuma: 8.5 });
    const [sql, valores] = query.mock.calls[1];
    expect(sql).toContain('FROM sigd_tra.expediente e');
    expect(sql).toContain('WHERE periodo = $4::date');
    expect(valores).toEqual([null, null, null, '2026-10-01']);
    expect(sql).not.toMatch(/\b(CREATE|REFRESH|INSERT|UPDATE|DELETE)\b/);
  });
  it('las fechas diarias y el área se parametrizan antes de agregar los indicadores', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const area = '00000000-0000-4000-8000-000000000001';
    await new RepositorioMgdAnalytics({ query } as unknown as Pool).obtenerTendencias(2026, { fechaInicio: '2026-10-01', fechaFin: '2026-10-19', unidadOrganicaId: area });
    const [sql, valores] = query.mock.calls[0];
    expect(valores).toEqual(['2026-10-01', '2026-10-19', area, 2026]);
    expect(sql).toContain('make_date($4, 1, 1)');
    expect(sql).toContain('a.area_actual_id = $3::text');
    expect(sql).not.toContain(area);
  });
  it.each(['42P01', '42703', '22012'])('no inventa tiempos cuando falla la fuente con %s', async code => {
    const query = vi.fn().mockRejectedValue({ code });
    await expect(new RepositorioMgdAnalytics({ query } as unknown as Pool).obtenerContadores(null, { fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }))
      .rejects.toMatchObject({ status: 503, code: 'REPORTES_FUENTE_NO_DISPONIBLE' });
  });
  it('no oculta permisos SQL insuficientes con una segunda consulta', async () => {
    const query = vi.fn().mockRejectedValue({ code: '42501' });
    await expect(new RepositorioMgdAnalytics({ query } as unknown as Pool).obtenerContadores(null)).rejects.toMatchObject({ code: '42501' });
    expect(query).toHaveBeenCalledOnce();
  });
  it('un valor numérico corrupto no se presenta como cero', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ n_radicados: 'NaN' }] });
    await expect(new RepositorioMgdAnalytics({ query } as unknown as Pool).obtenerContadores(null))
      .rejects.toMatchObject({ status: 503, code: 'REPORTES_VALOR_NO_VALIDO' });
  });
  it('no mezcla las cachés de dos filtros distintos', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const get = vi.fn().mockResolvedValue(null), set = vi.fn();
    const service = new ServicioMgdAnalytics(new RepositorioMgdAnalytics({ query } as unknown as Pool), { cache: { get, set } });
    await service.resumen(null, { fechaInicio: '2026-01-01', fechaFin: '2026-01-31' });
    await service.resumen(null, { fechaInicio: '2026-02-01', fechaFin: '2026-02-28' });
    expect(get.mock.calls[0][0]).not.toBe(get.mock.calls[1][0]);
  });
  it('suma las áreas de un mismo mes sin perder expedientes en la tendencia', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [
      { periodo: '2026-10', n_radicados: '3', n_atendidos: '1' },
      { periodo: '2026-10', n_radicados: '2', n_archivados: '1' },
    ] });
    const serie = await new ServicioMgdAnalytics(new RepositorioMgdAnalytics({ query } as unknown as Pool)).tendencias(2026);
    expect(serie[9]).toEqual({ mes: 10, radicados: 5, atendidos: 2, observados: 0 });
  });
  it.each([
    { fechaInicio: '2026-02-30', fechaFin: '2026-03-01' },
    { fechaInicio: '2026-10-19' },
    { fechaInicio: '2026-10-19', fechaFin: '2026-10-01' },
    { periodo: '2026-10', fechaInicio: '2026-10-01', fechaFin: '2026-10-19' },
    { unidadOrganicaId: 'unidad-1' },
  ])('rechaza filtros imposibles o ambiguos: %j', filtros => {
    expect(filtrosResumenSchema.safeParse(filtros).success).toBe(false);
  });
});

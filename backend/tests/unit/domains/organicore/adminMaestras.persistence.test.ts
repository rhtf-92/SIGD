import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

import { CalendarioService } from '../../../../src/domains/organicore/calendario.service.js';
import { TablasMaestrasService } from '../../../../src/domains/organicore/tablasMaestras.service.js';
import { ConflictError } from '../../../../src/shared/domain/errors/index.js';

describe('CalendarioService · SQL y filtros persistentes', () => {
  const query = vi.fn();
  const pool = { query } as unknown as Pool;
  beforeEach(() => { vi.clearAllMocks(); query.mockResolvedValue({ rows: [], rowCount: 0 }); });

  it('genera un SELECT válido y combina año, rango y estado', async () => {
    await new CalendarioService(pool).listar({
      anio: 2026, desde: '2026-01-01', hasta: '2026-12-31', estado: 'INACTIVO',
    });
    const [sql, valores] = query.mock.calls[0] as [string, unknown[]];
    expect(sql.trimStart()).toMatch(/^SELECT\s+c\.id_calendario/);
    expect(sql).toContain('c.activo = FALSE');
    expect(sql).toContain('c.anio = $1');
    expect(sql).toContain('c.fecha >= $2::date');
    expect(sql).toContain('c.fecha <= $3::date');
    expect(valores).toEqual([2026, '2026-01-01', '2026-12-31']);
  });

  it('inactiva sin borrar físicamente', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 1 });
    await new CalendarioService(pool).cambiarVigencia('11111111-1111-4111-8111-111111111111', false);
    expect(String(query.mock.calls[0][0])).toContain('UPDATE sigd_org.calendario_laboral SET activo');
    expect(String(query.mock.calls[0][0])).not.toContain('DELETE');
  });
});

describe('TablasMaestrasService · persistencia canónica', () => {
  const query = vi.fn();
  const pool = { query } as unknown as Pool;
  beforeEach(() => { vi.clearAllMocks(); query.mockResolvedValue({ rows: [], rowCount: 0 }); });

  it('solo consulta tablas y columnas presentes en las migraciones', async () => {
    await new TablasMaestrasService(pool).listarMaestras(false, true);
    const sql = query.mock.calls.map((llamada) => String(llamada[0])).join('\n');
    expect(sql).toContain('FROM sigd_org.area');
    expect(sql).toContain('FROM sigd_org.cargo');
    expect(sql).toContain('FROM sigd_org.rol_sistema');
    expect(sql).toContain('FROM sigd_doc.tipo_documento');
    expect(sql).not.toContain('unidad_organica');
    expect(sql).not.toContain('sigd_org.sede');
  });

  it('valida códigos duplicados y conserva borrado lógico', async () => {
    query.mockRejectedValueOnce(Object.assign(new Error('duplicado'), { code: '23505' }));
    await expect(new TablasMaestrasService(pool).crear('cargos', {
      codigo: 'DIR', nombre: 'Director', descripcion: null,
    })).rejects.toBeInstanceOf(ConflictError);

    query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await new TablasMaestrasService(pool).cambiarVigencia(
      'cargos', '11111111-1111-4111-8111-111111111111', false,
    );
    expect(String(query.mock.calls.at(-1)?.[0])).toContain('SET vigente = $2');
    expect(String(query.mock.calls.at(-1)?.[0])).not.toContain('DELETE');
  });
});

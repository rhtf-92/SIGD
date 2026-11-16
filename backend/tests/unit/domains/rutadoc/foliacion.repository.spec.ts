import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { RepositorioPostgresFoliacionRutaDoc } from '../../../../src/domains/rutadoc/foliacion.repository.js';

describe('RepositorioPostgresFoliacionRutaDoc', () => {
  const expedienteId = '8d2e69d1-f3fb-4f28-a59c-a61c20c8827c';

  it('consulta la existencia del expediente usando su UUID V2', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ existe: true }] });
    const repositorio = new RepositorioPostgresFoliacionRutaDoc({ query } as unknown as Pool);

    await expect(repositorio.existeExpediente(expedienteId)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('expediente_id = $1::uuid'),
      [expedienteId],
    );
  });

  it('lee columnas V2, conserva el orden y calcula los rangos inclusivos con el contrato existente', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [
      { id_documento: 'doc-1', folio_inicio: 1, folio_fin: 1 },
      { id_documento: 'doc-2', folio_inicio: 2, folio_fin: 5 },
    ] });
    const repositorio = new RepositorioPostgresFoliacionRutaDoc({ query } as unknown as Pool);

    await expect(repositorio.listar(expedienteId)).resolves.toEqual([
      { idDocumento: 'doc-1', folioInicio: 1, folioFin: 1, cantidadFolios: 1 },
      { idDocumento: 'doc-2', folioInicio: 2, folioFin: 5, cantidadFolios: 4 },
    ]);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('FROM sigd_tra.expediente_documento_folio');
    expect(sql).toContain('WHERE expediente_id = $1::uuid');
    expect(sql).toContain('ORDER BY folio_inicio ASC');
    expect(sql).toContain('id_documento::text, folio_inicio, folio_fin');
    expect(sql).not.toMatch(/\bid_expediente\b|\btotal_folios\b/);
    expect(params).toEqual([expedienteId]);
  });

  it('mantiene falso para expediente inexistente y lista vacía cuando no hay filas', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ existe: false }] })
      .mockResolvedValueOnce({ rows: [] });
    const repositorio = new RepositorioPostgresFoliacionRutaDoc({ query } as unknown as Pool);

    await expect(repositorio.existeExpediente(expedienteId)).resolves.toBe(false);
    await expect(repositorio.listar(expedienteId)).resolves.toEqual([]);
  });
});

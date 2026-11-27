import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { ConsultaPublicaService } from '../../../../src/domains/tramicore/consultaPublica.service.js';

function crearPool(filas: unknown[][]) {
  const query = vi.fn();
  filas.forEach((rows) => query.mockResolvedValueOnce({ rows }));
  const cliente = { query, release: vi.fn() };
  return {
    pool: { connect: vi.fn().mockResolvedValue(cliente) } as unknown as Pool,
    query,
    cliente,
  };
}

describe('ConsultaPublicaService', () => {
  it('lee el CUT desde el esquema real y enmascara al administrado', async () => {
    const { pool, query, cliente } = crearPool([
      [{
        cut: 'EXP-2026-000006',
        estado_tramite: 'REGISTRADO',
        tipo_tramite: 'Emisión de Certificado de Estudios Oficial',
        asunto: 'Certificado de estudios',
        fecha_envio_real: new Date('2026-11-25T13:00:00.000Z'),
        fecha_radicacion_legal: new Date('2026-11-25T13:00:00.000Z'),
        canal_recepcion: 'MESA_VIRTUAL',
        total_folios: 2,
        numero_documento: '45872315',
        nombres: 'Ana',
        apellidos: 'Quispe Ramos',
      }],
      [{
        nombre_archivo: 'solicitud.pdf',
        content_type: 'application/pdf',
        hash_sha256: 'abc123   ',
      }],
    ]);

    const dto = await new ConsultaPublicaService(pool)
      .consultarPorCut({ cut: 'EXP-2026-000006' });

    expect(dto).toMatchObject({
      cut: 'EXP-2026-000006',
      anioFiscal: 2026,
      estadoTramite: 'REGISTRADO',
      tipoTramite: 'Emisión de Certificado de Estudios Oficial',
      asunto: 'Certificado de estudios',
      canalRecepcion: 'MESA_VIRTUAL',
      totalFolios: 2,
      proveidos: [],
    });
    expect(dto.administrado).toEqual({
      documentoEnmascarado: '45***315',
      nombreEnmascarado: 'A** Q***** R****',
    });
    expect(dto.documentos[0].hashSha256).toBe('abc123');
    expect(query.mock.calls[0][0]).toContain('FULL JOIN sigd_doc.expediente');
    expect(query.mock.calls[0][0]).toContain('pn.apellidos');
    expect(query.mock.calls[1][0]).toContain('sigd_doc.documento_adjunto');
    expect(cliente.release).toHaveBeenCalledOnce();
  });

  it('responde 404 y libera la conexión si el CUT no existe', async () => {
    const { pool, query, cliente } = crearPool([[]]);

    await expect(
      new ConsultaPublicaService(pool).consultarPorCut({ cut: 'EXP-2026-999999' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(query).toHaveBeenCalledOnce();
    expect(cliente.release).toHaveBeenCalledOnce();
  });
});

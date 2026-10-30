import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { RadicacionVirtualService } from '../../../../src/domains/tramicore/radicacionVirtual.service.js';
import { TesoreriaRepository } from '../../../../src/domains/tesoreria/tesoreria.repository.js';
import { radicacionVirtualSchema } from '../../../../src/domains/tramicore/tramites.schemas.js';

vi.mock('../../../../src/audit/bitacora-auditoria.repository.js', () => ({ registrarMutacion: vi.fn() }));

const expedienteId = '11111111-1111-4111-8111-111111111111';
const personaId = '22222222-2222-4222-8222-222222222222';
const versionId = '33333333-3333-4333-8333-333333333333';
const tipoId = '44444444-4444-4444-8444-444444444444';
const ahora = new Date('2026-10-29T14:00:00.000Z');
const datos = radicacionVirtualSchema.parse({
  asunto: 'Certificado de suficiencia de idioma inglés', idPersona: personaId,
  tipoDocumentalId: tipoId, registroVersionId: versionId,
  nombreSolicitante: 'Ciudadana Prueba', correo: 'prueba@example.test', totalFolios: 1,
  documentos: [{ nombreArchivo: 'solicitud.pdf', contentType: 'application/pdf', tamanoBytes: 100,
    hashSha256: 'a'.repeat(64) }],
});

function preparar(costoOficial: number) {
  const sqlEjecutado: string[] = [];
  const cliente = {
    query: vi.fn(async (sql: string) => {
      sqlEjecutado.push(sql);
      if (sql.includes('FROM sigd_doc.tipo_documento')) return { rows: [{ vigente: true }] };
      if (sql.includes('FROM sigd_auth.persona')) return { rows: [{ id_persona: personaId, id_documento: '99000123' }] };
      if (sql.includes('FROM sigd_doc.tupa_registro_version')) return { rows: [{
        registro_version_id: versionId, estado_validacion: 'APROBADO', vigencia_desde: null, vigencia_hasta: null,
      }] };
      if (sql.includes('fn_generar_cut')) return { rows: [{ cut: 'EXP-2026-000123' }] };
      if (sql.includes('INSERT INTO sigd_tra.expediente')) return { rows: [{ expediente_id: expedienteId }] };
      return { rows: [] };
    }),
    release: vi.fn(),
  } as unknown as PoolClient;
  const pool = { connect: vi.fn().mockResolvedValue(cliente) } as unknown as Pool;
  const contexto = vi.spyOn(TesoreriaRepository.prototype, 'obtenerContextoExpedienteParaPago').mockResolvedValue({
    expedienteId, codigoExpediente: 'EXP-2026-000123', solicitanteId: personaId,
    tipoDocumento: 'DNI', numeroDocumento: '99000123', nombreSolicitante: 'Ciudadana Prueba',
    costoOficial, concepto: 'Certificado de Inglés', codigoTupa: 'p1-fila-06', registroVersionId: versionId,
  });
  vi.spyOn(TesoreriaRepository.prototype, 'obtenerSiguienteCodigoPago').mockResolvedValue('PAG-2026-000123');
  const insertar = vi.spyOn(TesoreriaRepository.prototype, 'insertarOrdenPago').mockResolvedValue({
    orden_pago_id: '55555555-5555-4555-8555-555555555555', codigo_pago: 'PAG-2026-000123',
    fecha_vencimiento: new Date('2026-10-31T14:00:00.000Z'),
  } as never);
  const service = new RadicacionVirtualService(pool, async () => []);
  return { service, cliente, sqlEjecutado, contexto, insertar };
}

afterEach(() => vi.restoreAllMocks());

describe('radicación virtual y orden de pago atómica', () => {
  it('crea una orden PENDIENTE de S/ 100 desde el TUPA antes del COMMIT', async () => {
    const { service, cliente, sqlEjecutado, insertar } = preparar(100);
    const resultado = await service.radicar(datos, ahora);
    expect(resultado.expedienteId).toBe(expedienteId);
    expect(insertar).toHaveBeenCalledOnce();
    expect(insertar).toHaveBeenCalledWith(cliente, expect.objectContaining({
      expedienteId, registroVersionId: versionId, solicitanteId: personaId,
      codigoPago: 'PAG-2026-000123', codigoTupa: 'p1-fila-06', monto: 100, moneda: 'PEN',
    }));
    expect(sqlEjecutado.findIndex((sql) => sql.includes('INSERT INTO sigd_doc.expediente_tupa_vinculo')))
      .toBeLessThan(sqlEjecutado.findIndex((sql) => sql.includes("SET estado = 'PENDIENTE_PAGO'")));
    expect(sqlEjecutado.at(-1)).toBe('COMMIT');
  });

  it('no crea orden para un TUPA gratuito', async () => {
    const { service, insertar, sqlEjecutado } = preparar(0);
    await service.radicar(datos, ahora);
    expect(insertar).not.toHaveBeenCalled();
    expect(sqlEjecutado.some((sql) => sql.includes('PENDIENTE_PAGO'))).toBe(false);
  });

  it('revierte expediente y vínculo cuando falla la inserción de la orden', async () => {
    const { service, insertar, sqlEjecutado } = preparar(100);
    insertar.mockRejectedValueOnce(new Error('Fallo al insertar orden'));
    await expect(service.radicar(datos, ahora)).rejects.toThrow('Fallo al insertar orden');
    expect(sqlEjecutado.at(-1)).toBe('ROLLBACK');
    expect(sqlEjecutado).not.toContain('COMMIT');
  });
});

import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { validarDocumentacionTramite, leerRequisitosDocumentales } from '../../../../src/domains/tramicore/documentacionTramite.service.js';
import { radicacionVirtualSchema, type RadicacionVirtualInput } from '../../../../src/domains/tramicore/tramites.schemas.js';

const proc = '11111111-1111-4111-8111-111111111111';
const req = '22222222-2222-4222-8222-222222222222';
const fut = '33333333-3333-4333-8333-333333333333';
const anexo = '44444444-4444-4444-8444-444444444444';
const rows = (obligatorio = true) => [{ id: req, codigo: 'FUT', nombre: 'Solicitud configurada de prueba', obligatorio,
  tipos: [{ id: fut, codigo: 'FUT', nombre: 'FUT', condicion: null }] }];
function conexion(requisitos = rows()) {
  return { query: vi.fn(async (sql: string) => ({ rows: sql.includes('FROM sigd_doc.requisito') ? requisitos : [{ id: fut, codigo: 'FUT' }, { id: anexo, codigo: 'ANEXO' }] })) } as unknown as Pick<Pool, 'query'>;
}
function datos(documentos: RadicacionVirtualInput['documentos']): RadicacionVirtualInput {
  return { idTipoTramiteTupa: proc, asunto: 'Solicitud DEMOSTRACION', tipoDocumento: 'DNI', numeroDocumento: '00000001', nombreSolicitante: 'Prueba Demo', correo: 'qa@sandbox.invalid', totalFolios: 3, documentos };
}
function doc(extra: Partial<RadicacionVirtualInput['documentos'][number]> = {}): RadicacionVirtualInput['documentos'][number] {
  return { nombreArchivo: 'solicitud.pdf', contentType: 'application/pdf', tamanoBytes: 100, hashSha256: 'a'.repeat(64), clasificacion: 'EXPEDIENTE', requisitoId: req, ...extra };
}
describe('Catálogo y asociaciones documentales de M3', () => {
  it('resuelve desde BD el requisito declarado y su tipo', async () => {
    const r = await validarDocumentacionTramite(conexion(), datos([doc()]));
    expect(r.documentosClasificados).toEqual([{ tipoDocumentalId: fut, requisitoId: req, clasificacion: 'EXPEDIENTE' }]);
  });
  it('indica exactamente el obligatorio faltante', async () => {
    await expect(validarDocumentacionTramite(conexion(), datos([doc({ requisitoId: undefined })]))).rejects.toMatchObject({ invalidParams: [expect.objectContaining({ reason: expect.stringMatching(/Solicitud configurada de prueba/) })] });
  });
  it('un archivo genérico no acredita automáticamente un requisito', async () => {
    await expect(validarDocumentacionTramite(conexion(), datos([doc({ requisitoId: undefined })]))).rejects.toThrow();
  });
  it('no exige el requisito opcional', async () => {
    await expect(validarDocumentacionTramite(conexion(rows(false)), datos([doc({ requisitoId: undefined })]))).resolves.toBeDefined();
  });
  it('rechaza requisitos de otro procedimiento', async () => {
    await expect(validarDocumentacionTramite(conexion(), datos([doc({ requisitoId: proc })]))).rejects.toMatchObject({ invalidParams: [expect.objectContaining({ reason: expect.stringMatching(/no pertenece/) })] });
  });
  it('rechaza clasificación contradictoria', async () => {
    await expect(validarDocumentacionTramite(conexion(), datos([doc(), doc({ clasificacion: 'ANEXO' })]))).rejects.toMatchObject({ invalidParams: [expect.objectContaining({ reason: expect.stringMatching(/clasificación/) })] });
  });
  it('rechaza tipos documentales manipulados', async () => {
    await expect(validarDocumentacionTramite(conexion(), datos([doc({ tipoDocumentalId: anexo })]))).rejects.toMatchObject({ invalidParams: [expect.objectContaining({ reason: expect.stringMatching(/tipo documental/) })] });
  });
  it('permite varios PDF para el mismo requisito sin confundirlos', async () => {
    const r = await validarDocumentacionTramite(conexion(), datos([doc(), doc({ nombreArchivo: 'otra-pagina.pdf' })]));
    expect(r.documentosClasificados).toHaveLength(2);
  });
  it('requiere un expediente principal además de anexos', async () => {
    await expect(validarDocumentacionTramite(conexion([]), datos([doc({ clasificacion: 'ANEXO', requisitoId: undefined })]))).rejects.toMatchObject({ invalidParams: [expect.objectContaining({ reason: expect.stringMatching(/EXPEDIENTE/) })] });
  });
  it('permite varios anexos complementarios sin inventar requisitos', async () => {
    const r = await validarDocumentacionTramite(conexion([]), datos([doc({ requisitoId: undefined }), doc({ clasificacion: 'ANEXO', requisitoId: undefined })]));
    expect(r.documentosClasificados[1]).toEqual({ tipoDocumentalId: anexo, clasificacion: 'ANEXO' });
  });
  it('no permite mezclar documentos nuevos sin clasificar', async () => {
    await expect(validarDocumentacionTramite(conexion(), datos([doc(),doc({ clasificacion: undefined })]))).rejects.toMatchObject({ invalidParams: [expect.objectContaining({ reason: expect.stringMatching(/Clasifique/) })] });
  });
  it('mantiene los comprobantes exclusivamente en Tesorería', async () => {
    const economico = [{ ...rows()[0], codigo: 'COMPROBANTE_PAGO' }];
    expect(await leerRequisitosDocumentales(conexion(economico), proc)).toEqual([]);
    await expect(validarDocumentacionTramite(conexion(economico), datos([doc()]))).rejects.toMatchObject({ invalidParams: [expect.objectContaining({ reason: expect.stringMatching(/Tesorería/) })] });
  });
  it('el DTO solo acepta las dos clasificaciones y rechaza precios enviados por React', () => {
    expect(radicacionVirtualSchema.safeParse(datos([doc({ clasificacion: 'ANEXO' })])).success).toBe(true);
    expect(radicacionVirtualSchema.safeParse({ ...datos([doc()]), importe: '0.00' }).success).toBe(false);
    expect(radicacionVirtualSchema.safeParse(datos([{ ...doc(), clasificacion: 'COMPROBANTE_PAGO' } as never])).success).toBe(false);
  });
  it('preserva el requisito no económico aunque comparta una relación con comprobante', async () => {
    const mixto = [{ ...rows()[0], tipos: [...rows()[0].tipos, { id: anexo, codigo: 'COMPROBANTE_PAGO', nombre: 'Comprobante', condicion: null }] }];
    const r = await leerRequisitosDocumentales(conexion(mixto),proc);
    expect(r).toHaveLength(1); expect(r[0].tipos.map(t=>t.codigo)).toEqual(['FUT']); expect(r[0].obligatorio).toBe(true);
  });
});

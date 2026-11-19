import { afterEach, describe, expect, it, vi } from 'vitest';
import { consultarCatalogo, informacionPublicada, interpretarCatalogo } from '../../../src/features/asistente/catalogo';

const item = {
  id: '3443d0c0-ebaf-48d2-a4d0-2c32ec1fc6dd', codigo: 'SUZ26-035',
  denominacion: 'Certificado de Estudios Superiores (6 semestres)', vigente: true,
  descripcion: 'Descripción publicada.\nDerecho de pago: S/ 124.00\nPlazo de atención: no especificado en la fuente.\nFuente verificada: TUPA_2026_IESTP_Suiza.pdf, página 4.\nEstado administrativo: pendiente de validación institucional.',
  tipos_documentales: [{ codigo: 'COMPROBANTE_PAGO', nombre: 'Comprobante de Pago', obligatorio: false }],
};

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('Catálogo público del asistente', () => {
  it('conserva los requisitos y su obligatoriedad real', () => {
    const [dato] = interpretarCatalogo([item]);
    expect(dato.tipos_documentales?.[0].obligatorio).toBe(false);
    expect(informacionPublicada(dato).costo).toBe('S/ 124.00');
  });
  it('excluye inactivos y conceptos de otros catálogos', () => {
    expect(interpretarCatalogo([{ ...item, vigente: false }])).toEqual([]);
    expect(interpretarCatalogo([{ ...item, codigo: 'TUPA-01' }])).toEqual([]);
    expect(interpretarCatalogo([{ ...item, codigo: 'PASCO-001' }])).toEqual([]);
  });
  it.each([
    [{ ...item, id: 'incorrecto' }], [{ ...item, vigente: 'true' }],
    [{ ...item, tipos_documentales: [{ codigo: 'FUT', nombre: 'FUT', obligatorio: 'false' }] }],
    [item, item], [{ ...item, denominacion: '' }],
  ].map((datos) => ({ datos })))('rechaza respuesta inconsistente', ({ datos }) => {
    expect(() => interpretarCatalogo(datos)).toThrow();
  });
  it('no transforma valores técnicos de plazo o silencio en hechos oficiales', () => {
    const [dato] = interpretarCatalogo([{ ...item, plazo_dias: 30, silencio_administrativo: 'POSITIVO' }]);
    expect(informacionPublicada(dato).plazo).toContain('No especificado');
    expect(informacionPublicada(dato).pendienteInstitucional).toBe(true);
    expect(dato).not.toHaveProperty('plazo_dias');
  });
  it('informa ausencia de costo y plazo sin sustituirlos por cero', () => {
    const [dato] = interpretarCatalogo([{ ...item, descripcion: null }]);
    expect(informacionPublicada(dato).costo).toContain('No publicado');
    expect(informacionPublicada(dato).plazo).toContain('No especificado');
  });
  it('solo utiliza un GET al catálogo, sin JWT, cookies, preguntas ni refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [item] });
    vi.stubGlobal('fetch', fetchMock);
    await expect(consultarCatalogo(new AbortController().signal)).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/tramites\/tipos$/), expect.objectContaining({
      method: 'GET', credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json' },
    }));
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body');
  });
  it('propaga errores HTTP sin catálogos ficticios', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(consultarCatalogo(new AbortController().signal)).rejects.toThrow('No se pudo');
  });
  it('aborta y cierra el timeout de la petición', async () => {
    vi.useFakeTimers();
    let aborted = false;
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('abort')); });
    })));
    const pendiente = expect(consultarCatalogo(new AbortController().signal)).rejects.toThrow('abort');
    await vi.advanceTimersByTimeAsync(10000);
    await pendiente;
    expect(aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

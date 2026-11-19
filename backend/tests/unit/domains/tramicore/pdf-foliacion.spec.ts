import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  contarPaginasPdf,
  analizarPdfBuffer,
  calcularFoliacionCorrelativa,
} from '../../../../src/domains/tramicore/pdfFoliacion.js';

describe('TramiCore: análisis real de PDF y foliación automática correlativa', () => {
  it('obtiene el número real de páginas de un PDF de 1 página', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = Buffer.from(await pdf.save());
    const resultado = await analizarPdfBuffer(bytes);
    expect(resultado.valido).toBe(true);
    expect(resultado.paginas).toBe(1);
    expect(resultado.tamanoBytes).toBe(bytes.length);
    expect(resultado.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await contarPaginasPdf(bytes)).toBe(1);
  });

  it('obtiene el número real de páginas de un PDF de varias páginas (3 páginas)', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.addPage();
    pdf.addPage();
    const bytes = Buffer.from(await pdf.save());
    const resultado = await analizarPdfBuffer(bytes);
    expect(resultado.paginas).toBe(3);
  });

  it('rechaza archivos que no son PDF o con extensión falsa', async () => {
    const fakeBytes = Buffer.from('ESTO_ES_UN_TEXTO_PLANO_NO_ES_PDF');
    await expect(analizarPdfBuffer(fakeBytes)).rejects.toMatchObject({
      invalidParams: [expect.objectContaining({ name: 'archivo', reason: expect.stringContaining('no es un documento PDF') })],
    });
  });

  it('rechaza archivos corruptos o dañados que inician con %PDF- pero tienen estructura rota', async () => {
    const corruptBytes = Buffer.from('%PDF-1.4\n%%EOF_CORRUPTO_DATA_INCOMPLETA');
    await expect(analizarPdfBuffer(corruptBytes)).rejects.toMatchObject({
      invalidParams: [expect.objectContaining({ name: 'archivo', reason: expect.stringContaining('dañado') })],
    });
  });

  it('calcula la foliación correlativa exacta para múltiples documentos sin saltos ni duplicaciones', () => {
    const documentos = [
      { nombreArchivo: 'Solicitud_FUT.pdf', paginas: 2 },
      { nombreArchivo: 'DNI_Copia.pdf', paginas: 1 },
      { nombreArchivo: 'Certificado_Estudios.pdf', paginas: 3 },
      { nombreArchivo: 'Anexo_Sustento.pdf', paginas: 4 },
    ];

    const { documentosFoliados, totalFolios } = calcularFoliacionCorrelativa(documentos);

    expect(totalFolios).toBe(10);
    expect(documentosFoliados).toHaveLength(4);

    expect(documentosFoliados[0]).toMatchObject({
      nombreArchivo: 'Solicitud_FUT.pdf',
      paginas: 2,
      folioInicio: 1,
      folioFin: 2,
    });

    expect(documentosFoliados[1]).toMatchObject({
      nombreArchivo: 'DNI_Copia.pdf',
      paginas: 1,
      folioInicio: 3,
      folioFin: 3,
    });

    expect(documentosFoliados[2]).toMatchObject({
      nombreArchivo: 'Certificado_Estudios.pdf',
      paginas: 3,
      folioInicio: 4,
      folioFin: 6,
    });

    expect(documentosFoliados[3]).toMatchObject({
      nombreArchivo: 'Anexo_Sustento.pdf',
      paginas: 4,
      folioInicio: 7,
      folioFin: 10,
    });
  });

  it('recalcula la foliación dinámicamente si se retira un documento intermedio', () => {
    // Si se retira el DNI (1 pág), los siguientes documentos se ajustan sin huecos
    const documentosRestantes = [
      { nombreArchivo: 'Solicitud_FUT.pdf', paginas: 2 },
      { nombreArchivo: 'Certificado_Estudios.pdf', paginas: 3 },
      { nombreArchivo: 'Anexo_Sustento.pdf', paginas: 4 },
    ];

    const { documentosFoliados, totalFolios } = calcularFoliacionCorrelativa(documentosRestantes);

    expect(totalFolios).toBe(9);
    expect(documentosFoliados[0]).toMatchObject({ folioInicio: 1, folioFin: 2 });
    expect(documentosFoliados[1]).toMatchObject({ folioInicio: 3, folioFin: 5 });
    expect(documentosFoliados[2]).toMatchObject({ folioInicio: 6, folioFin: 9 });
  });
});

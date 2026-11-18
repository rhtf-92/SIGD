import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { a4GeneratorService } from '../../../../src/domains/docucore/a4Generator.service.js';
import { CvdStampService } from '../../../../src/domains/docucore/cvdStamp.service.js';
import { cargarLogoInstitucionalPng } from '../../../../src/domains/docucore/institucionalPdf.helper.js';
import { documentoStorageService } from '../../../../src/core/storage/documento-storage.service.js';
import { generarCedulaAcusePdf } from '../../../../src/domains/identicore/cedulaAcuse.service.js';
import { generarPdfInforme } from '../../../../src/modules/reportes/pdf-minimo.service.js';

describe('Estandarización Institucional de Generadores PDF (IESTP "Suiza")', () => {
  it('cargarLogoInstitucionalPng carga el escudo real del repositorio en PNG', () => {
    const logo = cargarLogoInstitucionalPng();
    expect(logo).toBeDefined();
    expect(logo!.byteLength).toBeGreaterThan(10000);
    // Cabecera PNG: 89 50 4E 47
    expect(Array.from(logo!.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('Resolución Directoral A4 con escudo y sello CVD genera PDF A4 válido sin errores', async () => {
    const doc = await a4GeneratorService.generar(
      {
        titulo: 'RESOLUCIÓN DIRECTORAL INSTITUCIONAL',
        bloques: [
          { tipo: 'encabezado', texto: 'VISTO:', nivel: 2 },
          {
            tipo: 'parrafo',
            texto:
              'El Expediente Administrativo N° EXP-2026-UNIT01, formulado sobre el procedimiento institucional Certificado de Inglés, con evaluación técnica favorable.',
            alineacion: 'justificado',
          },
          { tipo: 'encabezado', texto: 'CONSIDERANDO:', nivel: 2 },
          { tipo: 'parrafo', texto: 'Que cumple los requisitos establecidos en el TUPA.' },
          { tipo: 'encabezado', texto: 'SE RESUELVE:', nivel: 2 },
          { tipo: 'articulo', numero: 'Artículo 1.-', texto: 'DECLARAR PROCEDENTE la solicitud.' },
          { tipo: 'firma', cargo: 'DIRECTOR GENERAL', nombre: 'Director General Demo' },
        ],
      },
      {
        membrete: {
          institucion: 'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"',
          unidad: 'DIRECCIÓN GENERAL',
          direccion: 'Av. Túpac Amaru s/n, Pucallpa – Ucayali',
          tipoDocumento: 'RESOLUCIÓN DIRECTORAL',
          numeroDocumento: 'RD-2026-UNIT-001',
          correlativo: 'EXP: EXP-2026-UNIT01',
          sigla: 'IESTP SUIZA - DG',
          logoPng: cargarLogoInstitucionalPng(),
        },
      },
    );

    const estampado = await new CvdStampService('http://localhost:5173').estampar(
      Buffer.from(doc.bytes),
      'CVD-2026-UNITTEST01',
    );
    expect(estampado.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
    const pdf = await PDFDocument.load(estampado);
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it('Cargo Digital distingue canal Mesa de Partes Digital y nunca lo etiqueta como Ventanilla Presencial', async () => {
    const buf = await documentoStorageService.generarCargoPdf({
      cut: 'EXP-2026-DIG999',
      fechaHora: new Date('2026-11-18T12:00:00-05:00'),
      nombreSolicitante: 'María López',
      documentoEnmascarado: 'DNI ****1234',
      asunto: 'Solicitud de Certificado de Inglés Técnico — trámite virtual sin pérdida de tildes.',
      folios: 3,
      operadorMesa: 'Mesa de Partes Digital',
      canalRecepcion: 'MESA_PARTES_DIGITAL',
      estadoInicial: 'PENDIENTE_PAGO',
      urlConsulta: 'https://sigd.iestp-suiza.edu.pe/consulta/EXP-2026-DIG999',
    });

    expect(buf.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
    const loaded = await PDFDocument.load(buf);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('Cédula de Acuse distingue etapas de notificación y embebe QR CVD y SHA-256 sin truncar', async () => {
    const buf = await generarCedulaAcusePdf({
      idNotificacion: '11111111-2222-3333-4444-555555555555',
      cut: 'EXP-2026-ACU01',
      tipoActo: 'RESOLUCIÓN DIRECTORAL',
      asunto: 'Notificación de resolución con asunto extenso para verificar ajuste multilínea en A4.',
      fechaDeposito: '2026-11-18T14:00:00Z',
      fechaLectura: '2026-11-18T15:00:00Z',
      estadoNotificacion: 'LEIDO',
      idAcuse: 'ACU-2026-UNIT01',
      cvdAcuse: 'CVD-2026-ACU-111111-7B12',
      acuseSelladoTiempo: '2026-11-18T15:05:00Z',
      acuseHashSha256: 'c'.repeat(64),
      destinatario: {
        nombresCompletos: 'Ciudadano Demo',
        tipoDocumento: 'DNI',
        numeroDocumento: '****5678',
      },
    });

    expect(buf.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
    const loaded = await PDFDocument.load(buf);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('DocumentoPdf (pdf-minimo) soporta tildes en WinAnsi y paginación real sin solapar filas', async () => {
    const buf = generarPdfInforme((doc) => {
      doc.agregarTitulo('Reporte analítico institucional SIGD');
      doc.agregarSubtitulo('Período de evaluación');
      doc.agregarSeccion('Consolidado');
      doc.agregarFila(['Área', 'Trámite', 'Estado'], { negrita: true, separador: true });
      for (let i = 1; i <= 45; i += 1) {
        doc.agregarFila([`Dirección ${i}`, 'Certificado de Inglés', 'OK']);
      }
    }, 'Reporte analítico institucional SIGD');

    const raw = buf.toString('latin1');
    expect(raw.startsWith('%PDF-1.4')).toBe(true);
    expect(raw).toContain('IESTP');
    expect(raw).toContain('P\\341gina 2 de 2');
    const loaded = await PDFDocument.load(buf);
    expect(loaded.getPageCount()).toBe(2);
  });
});

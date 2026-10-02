import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { CvdStampService } from '../../../../src/domains/docucore/cvdStamp.service.js';

describe('CvdStampService — Adversarial & NodeNext ESM Verification', () => {
  const service = new CvdStampService('https://sigd.iestp-suiza.edu.pe');

  async function createSamplePdf(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  describe('NodeNext ESM QR Code Generation', () => {
    it('generates QR code and stamps valid PDF without ESM import failure', async () => {
      const pdf = await createSamplePdf();
      const cvd = 'CVD-ABC123XYZ';
      const stamped = await service.estampar(pdf, cvd);

      expect(stamped).toBeInstanceOf(Buffer);
      expect(stamped.length).toBeGreaterThan(pdf.length);

      // Verify stamped PDF can be reloaded and parsed
      const loadedDoc = await PDFDocument.load(stamped);
      expect(loadedDoc.getPageCount()).toBe(1);
    });

    it('handles portalPublico with and without trailing slash', async () => {
      const pdf = await createSamplePdf();
      const serviceSlash = new CvdStampService('https://sigd.iestp-suiza.edu.pe/');
      const serviceNoSlash = new CvdStampService('https://sigd.iestp-suiza.edu.pe');

      const stamped1 = await serviceSlash.estampar(pdf, 'CVD-TEST01');
      const stamped2 = await serviceNoSlash.estampar(pdf, 'CVD-TEST01');

      expect(stamped1.length).toBeGreaterThan(0);
      expect(stamped2.length).toBeGreaterThan(0);
    });

    it('stamps multi-page PDFs placing QR code on each page', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([595, 842]);
      doc.addPage([595, 842]);
      doc.addPage([595, 842]);
      const pdf = Buffer.from(await doc.save());

      const stamped = await service.estampar(pdf, 'CVD-MULTIPAGE-001');
      const loaded = await PDFDocument.load(stamped);
      expect(loaded.getPageCount()).toBe(3);
    });
  });

  describe('Adversarial inputs: CVD validation', () => {
    it('rejects CVD with invalid prefix', async () => {
      const pdf = await createSamplePdf();
      await expect(service.estampar(pdf, 'INVALID-123456')).rejects.toThrow('CVD inválido.');
    });

    it('rejects empty CVD', async () => {
      const pdf = await createSamplePdf();
      await expect(service.estampar(pdf, '')).rejects.toThrow('CVD inválido.');
    });

    it('rejects CVD with malicious script injection', async () => {
      const pdf = await createSamplePdf();
      await expect(
        service.estampar(pdf, '<script>alert(1)</script>'),
      ).rejects.toThrow('CVD inválido.');
    });

    it('rejects CVD exceeding maximum length', async () => {
      const pdf = await createSamplePdf();
      const longCvd = 'CVD-' + 'A'.repeat(40);
      await expect(service.estampar(pdf, longCvd)).rejects.toThrow('CVD inválido.');
    });

    it('rejects CVD shorter than minimum length', async () => {
      const pdf = await createSamplePdf();
      await expect(service.estampar(pdf, 'CVD-1')).rejects.toThrow('CVD inválido.');
    });

    it('rejects non-PDF corrupted buffer', async () => {
      const corrupted = Buffer.from('NOT_A_PDF_DOCUMENT');
      await expect(service.estampar(corrupted, 'CVD-VALID123')).rejects.toThrow();
    });
  });
});

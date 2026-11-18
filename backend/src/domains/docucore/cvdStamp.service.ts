import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';

/**
 * Debe ejecutarse ANTES de enviar el PDF a Refirma.
 * Modificar un PDF después de firmarlo puede invalidar PAdES-BES.
 */
export class CvdStampService {
  constructor(private readonly portalPublico: string) {}

  async estampar(pdfOriginal: Buffer, cvd: string): Promise<Buffer> {
    if (!/^CVD-[A-Z0-9-]{6,36}$/i.test(cvd)) {
      throw new Error('CVD inválido.');
    }

    const pdf = await PDFDocument.load(pdfOriginal, {
      ignoreEncryption: false,
    });

    const fuente = await pdf.embedFont(StandardFonts.Helvetica);

    const urlPortal = this.portalPublico.replace(/\/$/, '');
    const urlValidacion =
      `${urlPortal}/api/v1/validador-cvd/verificar/` +
      encodeURIComponent(cvd);

    const qrDataUrl = await QRCode.toDataURL(urlValidacion, {
      errorCorrectionLevel: 'H',
      width: 600,
      margin: 1,
    });

    const qrBase64 = qrDataUrl.split(',')[1];

    if (!qrBase64) {
      throw new Error('No se pudo generar el código QR.');
    }

    const qr = await pdf.embedPng(Buffer.from(qrBase64, 'base64'));

    for (const pagina of pdf.getPages()) {
      const { width, height } = pagina.getSize();
      // Franja estrictamente a la derecha del margen util (595.28 - 70.87 = 524.41 pt)
      // para nunca superponerse con la fecha alineada a la derecha ni con el pie de pagina.
      const xInicioFranja = width - 64;

      pagina.drawRectangle({
        x: xInicioFranja,
        y: height - 68,
        width: 58,
        height: 58,
        color: rgb(1, 1, 1),
        opacity: 0.96,
      });

      pagina.drawRectangle({
        x: width - 24,
        y: 12,
        width: 18,
        height: Math.max(40, height - 84),
        color: rgb(1, 1, 1),
        opacity: 0.96,
      });

      pagina.drawText(`DOCUMENTO FIRMADO DIGITALMENTE | CVD: ${cvd}`, {
        x: width - 14,
        y: 20,
        size: 6.5,
        font: fuente,
        color: rgb(0, 0, 0),
        rotate: degrees(90),
      });

      pagina.drawImage(qr, {
        x: xInicioFranja + 3,
        y: height - 65,
        width: 52,
        height: 52,
      });
    }

    return Buffer.from(await pdf.save());
  }
}
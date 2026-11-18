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
      const margenDerecho = 76;

      pagina.drawRectangle({
        x: width - margenDerecho,
        y: 12,
        width: margenDerecho - 6,
        height: height - 24,
        color: rgb(1, 1, 1),
        opacity: 0.92,
      });

      pagina.drawText(`DOCUMENTO FIRMADO DIGITALMENTE | CVD: ${cvd}`, {
        x: width - 22,
        y: 20,
        size: 6.5,
        font: fuente,
        color: rgb(0, 0, 0),
        rotate: degrees(90),
      });

      pagina.drawImage(qr, {
        x: width - margenDerecho + 6,
        y: height - 70,
        width: 58,
        height: 58,
      });
    }

    return Buffer.from(await pdf.save());
  }
}
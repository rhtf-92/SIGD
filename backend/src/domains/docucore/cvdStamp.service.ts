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
    const fuenteNegrita = await pdf.embedFont(StandardFonts.HelveticaBold);

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
      const { width } = pagina.getSize();
      const margenX = 70.86;
      const boxY = 100;
      const boxHeight = 54;
      const boxWidth = width - margenX * 2;

      // Recuadro inferior formal de certificación digital IESTP "Suiza" de Pucallpa
      pagina.drawRectangle({
        x: margenX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
        color: rgb(0.97, 0.98, 1),
        borderColor: rgb(0.05, 0.18, 0.38),
        borderWidth: 0.8,
      });

      pagina.drawImage(qr, {
        x: margenX + 5,
        y: boxY + 4,
        width: 46,
        height: 46,
      });

      const textX = margenX + 58;
      pagina.drawText('IESTP "SUIZA" DE PUCALLPA · SELLO DE FIRMA Y VERIFICACIÓN DIGITAL (SIGD)', {
        x: textX,
        y: boxY + 41,
        size: 7.5,
        font: fuenteNegrita,
        color: rgb(0.05, 0.18, 0.38),
      });

      pagina.drawText(`Código de Verificación Digital (CVD): ${cvd}`, {
        x: textX,
        y: boxY + 29,
        size: 8,
        font: fuenteNegrita,
        color: rgb(0.06, 0.38, 0.24),
      });

      pagina.drawText(
        'Documento oficial emitido conforme a la Ley N° 27269 (Ley de Firmas y Certificados Digitales) y D.S. N° 052-2008-PCM.',
        {
          x: textX,
          y: boxY + 18,
          size: 6.7,
          font: fuente,
          color: rgb(0.22, 0.22, 0.22),
        },
      );

      pagina.drawText(
        `Verifique la validez e integridad escaneando el código QR o en: ${urlPortal}/validador`,
        {
          x: textX,
          y: boxY + 8,
          size: 6.7,
          font: fuente,
          color: rgb(0.25, 0.25, 0.25),
        },
      );

      // Glosa lateral fina de seguridad en el margen derecho exterior (sin invadir el área de texto)
      pagina.drawText(`IESTP "SUIZA" PUCALLPA - UCAYALI | DOCUMENTO FIRMADO DIGITALMENTE | CVD: ${cvd}`, {
        x: width - 18,
        y: 100,
        size: 6,
        font: fuente,
        color: rgb(0.35, 0.35, 0.35),
        rotate: degrees(90),
      });
    }

    return Buffer.from(await pdf.save());
  }
}
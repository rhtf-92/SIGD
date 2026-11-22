import { PDFDocument, StandardFonts } from 'pdf-lib';

async function testPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([500, 500]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('INSTITUTO DE EDUCACION SUPERIOR TECNOLOGICO PUBLICO "SUIZA"', { x: 50, y: 400, font });
  const bytes = await pdfDoc.save();
  console.log('Success! Bytes:', bytes.length);
}
testPdf().catch(console.error);

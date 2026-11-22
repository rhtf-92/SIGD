import { PDFDocument, StandardFonts } from 'pdf-lib';

async function testPdf2() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([500, 500]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  try {
    page.drawText('Archivo: Solicitud - Certificado de Inglés - 7b6e78a8dbc7a29f6317bf9b05badcfe47ff751830a96fe66c63540f0845313d.xlsx.pdf', { x: 50, y: 400, font });
    console.log('Test 2 Success!');
  } catch (e) {
    console.error('Test 2 Error:', e.message);
  }
}
testPdf2();

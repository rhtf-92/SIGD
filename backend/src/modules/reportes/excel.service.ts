/**
 * Generador de SpreadsheetML 2003 (endpoint #54).
 *
 * El plan exige un binario `application/vnd.openxmlformats-officedocument.
 * spreadsheetml.sheet` compatible con hojas de cálculo. Se emite el dialecto
 * SpreadsheetML 2003, que Excel, LibreOffice y Google Sheets abren sin
 * conversiones, evitando depender de una biblioteca de terceros.
 */

const CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type HojaExcel = {
  nombre: string;
  columnas: string[];
  filas: Array<Array<string | number | null | undefined>>;
};

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\u0000-\u001F]/g, '');
}

function indiceAColumna(indice: number): string {
  let restante = indice + 1;
  let letras = '';
  while (restante > 0) {
    const digito = (restante - 1) % 26;
    letras = String.fromCharCode(65 + digito) + letras;
    restante = Math.floor((restante - 1) / 26);
  }
  return letras;
}

function esNumerico(valor: string | number | null | undefined): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function celda(
  indiceColumna: number,
  indiceFila: number,
  valor: string | number | null | undefined,
  estilo: 'Default' | 'Encabezado' | 'Numero' = 'Default',
): string {
  const referencia = `${indiceAColumna(indiceColumna)}${indiceFila + 1}`;
  if (valor === null || valor === undefined || valor === '') {
    return `<Cell ss:StyleID="${estilo}" ss:Index="${indiceColumna + 1}"/>`;
  }
  if (esNumerico(valor) && estilo === 'Default') {
    return `<Cell ss:StyleID="Numero" ss:Index="${indiceColumna + 1}"><Data ss:Type="Number">${valor}</Data></Cell>`;
  }
  return (
    `<Cell ss:StyleID="${estilo}" ss:Index="${indiceColumna + 1}">` +
    `<Data ss:Type="String">${escaparXml(String(valor))}</Data></Cell>`
  );
}

function hojaXml(hoja: HojaExcel): string {
  const encabezado = hoja.columnas
    .map((columna, indice) => celda(indice, 0, columna, 'Encabezado'))
    .join('');

  const filas = hoja.filas
    .map(
      (fila, indiceFila) =>
        `<Row ss:Index="${indiceFila + 1}">` +
        fila.map((valor, indice) => celda(indice, indiceFila, valor)).join('') +
        '</Row>',
    )
    .join('');

  return (
    `<Worksheet ss:Name="${escaparXml(hoja.nombre)}">` +
    '<Table>' +
    `<Row ss:Index="1">${encabezado}</Row>` +
    filas +
    '</Table>' +
    '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">' +
    '<FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal>' +
    '<ActivePane>2</ActivePane>' +
    '</WorksheetOptions>' +
    '</Worksheet>'
  );
}

export function generarSpreadsheetMl(hojas: HojaExcel[]): { contenido: Buffer; contentType: string } {
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:o="urn:schemas-microsoft-com:office:office"' +
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:html="http://www.w3.org/TR/REC-html40">' +
    '<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">' +
    '<Author>SIGD - Sistema de Gestion Documental</Author>' +
    '<Title>Reporte analitico institucional MGD</Title>' +
    '</DocumentProperties>' +
    '<Styles>' +
    '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>' +
    '<Style ss:ID="Encabezado"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>' +
    '<Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/></Style>' +
    '<Style ss:ID="Numero"><NumberFormat ss:Format="0.00"/></Style>' +
    '</Styles>' +
    hojas.map(hojaXml).join('') +
    '</Workbook>';

  return { contenido: Buffer.from(xml, 'utf8'), contentType: CONTENT_TYPE };
}

export const CONTENT_TYPE_SPREADSHEET = CONTENT_TYPE;

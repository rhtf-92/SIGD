/**
 * Utilidades canónicas para el formato monetario oficial en Soles (S/.)
 * y conversión de montos a letras para recibos y comprobantes de pago.
 */

export function formatearSoles(monto: number | string | null | undefined): string {
  const num = typeof monto === 'number' ? monto : parseFloat(String(monto || 0));
  if (isNaN(num)) return 'S/. 0.00';
  return `S/. ${num.toFixed(2)}`;
}

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_A_DIECINUEVE = [
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
  'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
];
const DECENAS = [
  '', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
  'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
];
const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
];

function convertirCentenas(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  let res = '';
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;

  if (c > 0) res += CENTENAS[c] + ' ';

  if (d === 1) {
    res += DIEZ_A_DIECINUEVE[u] + ' ';
  } else if (d === 2) {
    if (u === 0) res += 'VEINTE ';
    else res += 'VEINTI' + UNIDADES[u] + ' ';
  } else if (d > 2) {
    res += DECENAS[d];
    if (u > 0) res += ' Y ' + UNIDADES[u];
    res += ' ';
  } else if (u > 0) {
    res += UNIDADES[u] + ' ';
  }

  return res.trim();
}

/**
 * Convierte un monto numérico a su representación formal en letras:
 * Ej: 100 -> "SON: CIEN CON 00/100 SOLES"
 * Ej: 46.50 -> "SON: CUARENTA Y SEIS CON 50/100 SOLES"
 */
export function montoEnLetras(monto: number | string | null | undefined): string {
  const num = typeof monto === 'number' ? monto : parseFloat(String(monto || 0));
  if (isNaN(num) || num <= 0) return 'SON: CERO CON 00/100 SOLES';

  const entero = Math.floor(num);
  const centavos = Math.round((num - entero) * 100);
  const centavosStr = centavos.toString().padStart(2, '0');

  if (entero === 0) {
    return `SON: CERO CON ${centavosStr}/100 SOLES`;
  }

  let letras = '';

  // Miles
  const miles = Math.floor(entero / 1000);
  const resto = entero % 1000;

  if (miles > 0) {
    if (miles === 1) letras += 'MIL ';
    else letras += convertirCentenas(miles) + ' MIL ';
  }

  if (resto > 0) {
    letras += convertirCentenas(resto);
  }

  return `SON: ${letras.trim()} CON ${centavosStr}/100 SOLES`;
}

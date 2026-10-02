/**
 * Validador de Código de Verificación Digital (CVD) — F_ADRIANO / ENT-M04-05.
 * Formato canónico: CVD-YYYY-RD-XXXXXX-XXXX
 * Ejemplo válido: CVD-2026-RD-000412-892F
 * Marco: D.S. N° 070-2013-PCM (representación impresa de documento electrónico).
 */

export const CVD_PATTERN =
  /^CVD-(19|20)\d{2}-[A-Z]{2,6}-\d{6}-[A-F0-9]{4}$/;

export const CVD_INPUT_MASK_HINT = "CVD-YYYY-RD-XXXXXX-XXXX";

export interface CvdValidation {
  valido: boolean;
  normalizado: string;
  motivo?: string;
}

/** Normaliza el ingreso del usuario (mayúsculas + trim + colapsa espacios/guiones dobles). */
export function normalizarCvd(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Aplica máscara de entrada guiada mientras el usuario escribe.
 * Mantiene prefijo CVD-, año 4 dígitos, tipo acto, correlativo y sufijo hex.
 */
export function aplicarMascaraCvd(raw: string): string {
  const limpio = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Quita el prefijo CVD si el usuario lo tecleó para reconstruirlo
  const sinPrefijo = limpio.startsWith("CVD") ? limpio.slice(3) : limpio;
  const anio = sinPrefijo.slice(0, 4).replace(/[^0-9]/g, "");
  let resto = sinPrefijo.slice(4).replace(/[^A-Z0-9]/g, "");
  const tipo = resto.replace(/[^A-Z]/g, "").slice(0, 6);
  resto = resto.slice(tipo.length);
  const correlativo = resto.replace(/[^0-9]/g, "").slice(0, 6);
  resto = resto.slice(correlativo.length);
  const sufijo = resto.replace(/[^A-F0-9]/g, "").slice(0, 4);

  let out = "CVD";
  if (anio) out += `-${anio}`;
  else if (sinPrefijo.length > 0) out += "-";
  if (tipo) out += `-${tipo}`;
  else if (sinPrefijo.length > 4) out += "-";
  if (correlativo) out += `-${correlativo}`;
  if (sufijo) out += `-${sufijo}`;
  return out.slice(0, 24);
}

/** Extrae el primer CVD embebido en un texto (útil para QR escaneado o PDF). */
export function extraerCvdDeTexto(texto: string): string | null {
  const match = texto
    .toUpperCase()
    .match(/CVD-(?:19|20)\d{2}-[A-Z]{2,6}-\d{6}-[A-F0-9]{4}/);
  return match ? match[0] : null;
}

export function validarCvd(raw: string): CvdValidation {
  const normalizado = normalizarCvd(raw);
  if (!normalizado) {
    return { valido: false, normalizado, motivo: "Ingrese un código CVD para verificar." };
  }
  if (!CVD_PATTERN.test(normalizado)) {
    return {
      valido: false,
      normalizado,
      motivo: `Formato inválido. Use la máscara ${CVD_INPUT_MASK_HINT} (ej. CVD-2026-RD-000412-892F).`,
    };
  }
  const anio = Number(normalizado.split("-")[1]);
  if (anio < 2013 || anio > new Date().getFullYear() + 1) {
    return {
      valido: false,
      normalizado,
      motivo: `Año ${anio} fuera de rango institucional (2013–actualidad). Posible código apócrifo.`,
    };
  }
  return { valido: true, normalizado };
}

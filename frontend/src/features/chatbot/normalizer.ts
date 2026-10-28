/**
 * Normalización determinista de texto para el Chatbot Institucional SIGD.
 * Transforma la entrada del usuario en una cadena canónica para matching sin acentos ni signos:
 * - lowercase
 * - trim
 * - eliminación de diacríticos (á -> a, é -> e, etc.)
 * - normalización de espacios múltiples a uno solo
 * - remoción de signos de puntuación y caracteres irrelevantes
 */

export function normalizarTexto(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .toLowerCase()
    // Descomponer caracteres Unicode diacríticos y remover tildes/marcas
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Reemplazar signos de interrogación, exclamación y puntuación por espacios
    .replace(/[¿?¡!.,;:;'"()[\]{}/*+\-_\\~`^|<>@#$%&=]/g, ' ')
    // Reemplazar espacios múltiples y saltos de línea por un espacio simple
    .replace(/\s+/g, ' ')
    .trim();
}

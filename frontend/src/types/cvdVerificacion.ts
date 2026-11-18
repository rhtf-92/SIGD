/**
 * Contratos de datos para la representación impresa con estampa lateral CVD y QR (ENT-M04-04).
 * Conforme al D.S. N.° 070-2013-PCM y Ley N.° 27269 de Firmas y Certificados Digitales.
 */

export interface EstampaCvdData {
  codigoCvd: string; // Ej: "CVD-2026-RD-000412-892F"
  urlValidacion: string; // Ej: "https://sigd.iestpsuiza.edu.pe/validador-cvd"
  numeroDocumento: string; // Ej: "RD N.° 0412-2026-DG-IESTP-SUIZA"
  fechaFirmaIso: string;
  firmanteNombre: string;
  firmanteCargo: string;
  entidadCertificadora: string; // Ej: "RENIEC / Registro Nacional de Identificación y Estado Civil"
  hashSha256: string;
  posicionEstampa?: "LATERAL_DERECHA" | "LATERAL_IZQUIERDA" | "PIE_DE_PAGINA";
}

export interface DocumentoImpresoConCvd {
  id: string;
  titulo: string;
  numeroDocumento: string;
  estampa: EstampaCvdData;
  contenidoHtmlOTexto: string;
  totalPaginas: number;
}

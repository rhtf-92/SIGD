export interface DatosTicket {
  cut: string;
  timestamp: Date;
  folios: number;
  hashSha256: string;
  qrUrlSeguimiento: string;
}

export class TicketTermicoUtil {
  public static generarTicketVentanilla(datos: DatosTicket): string {
    const separador = "-".repeat(40);
    
    const ticketStr = [
      "      SISTEMA DE GESTION DOCUMENTARIA     ",
      "           MESA DE PARTES FISICA          ",
      separador,
      `CUT: ${datos.cut}`,
      `FECHA/HORA: ${datos.timestamp.toLocaleString('es-PE')}`,
      `NRO. FOLIOS: ${datos.folios}`,
      separador,
      "HASH DE SEGURIDAD (SHA-256):",
      datos.hashSha256,
      separador,
      "",
      "        _______________________       ",
      "            FIRMA RECEPCION           ",
      "",
      separador,
      "   Escanee el codigo QR para seguimiento: ",
      `   [QR_DATA: ${datos.qrUrlSeguimiento} ]  `,
      separador
    ].join('\n');

    return ticketStr;
  }
}
/**
 * Almacenamiento temporal de los documentos listos para firmar.
 *
 * DocuCore yaSwissLine — arquitectura Storage v2 — habilita cargas directas a
 * MinIO/S3 mediante URLs prefirmadas (ver
 * `docs/levantamiento_de_observaciones/01_analisis_json_schema_storage_s3.md`).
 * El generador A4 no debe escribir nunca en el disco del servidor web: por eso
 * este puerto expone un unico metodo `emitirUrlTemporal` y la implementacion de
 * referencia es en memoria.
 *
 * Estado: PROPUESTO.
 *   - CONFIRMADO: la arquitectura de almacenamiento de objetos desacoplado.
 *   - PENDIENTE: el adaptador `S3AlmacenDocumentosFirmables` que emita la URL
 *     prefirmada de descarga de MinIO/S3 y la limpieza por TTL. No se incluye en
 *     este Sprint porque requiere la instancia de MinIO del entorno de pruebas.
 */

import type { FirmaSessionStore } from "./firmaSession.store.js";

/** Documento almacenado de forma temporal. */
export interface DocumentoFirmable {
  id: string;
  nombreArchivo: string;
  mimeType: string;
  bytes: Uint8Array;
  sha256: string;
}

/**
 * Puerto de almacenamiento con URLs temporales de descarga.
 *
 * `host` debe ser el hostname publico por el que el agente de escritorio de los
 * directores alcanza al backend, porque la URL de descarga viaja dentro del
 * payload protocolar y se valida contra la lista blanca de hosts.
 */
export interface AlmacenDocumentosFirmables {
  guardar(documento: DocumentoFirmable): Promise<void>;
  /** Emite una URL temporal de descarga y devuelve su vigencia en segundos. */
  emitirUrlTemporal(documentoId: string, token: string, ttlSegundos: number): Promise<string>;
  /**
   * Recupera un documento. `permitirConsultaDirecta` omite la comprobacion del
   * token y se reserva para el propio backend.
   */
  recuperar(
    documentoId: string,
    token: string,
    permitirConsultaDirecta?: boolean,
  ): Promise<DocumentoFirmable | null>;
  cerrar(): Promise<void>;
}

/**
 * Implementacion en memoria, adecuada para pruebas unitarias y desarrollo local.
 *
 * La vigencia se delega al almacen de sesiones: `consumir` es atomico, asi que el
 * documento deja de ser descargable en el mismo instante en que Refirma entrega
 * el callback, sin necesidad de un segundo temporizador.
 */
export class InMemoryAlmacenDocumentosFirmables implements AlmacenDocumentosFirmables {
  private readonly documentos = new Map<string, DocumentoFirmable>();

  constructor(private readonly sesiones: FirmaSessionStore) {}

  async guardar(documento: DocumentoFirmable): Promise<void> {
    this.documentos.set(documento.id, documento);
  }

  async emitirUrlTemporal(
    documentoId: string,
    token: string,
    ttlSegundos: number,
  ): Promise<string> {
    void ttlSegundos;

    const documento = this.documentos.get(documentoId);
    if (documento === undefined) {
      throw new Error(`No existe el documento ${documentoId} en el almacen temporal.`);
    }

    // La vigencia la controla Redis. Si la sesion ya expiro, el enlace no sirve.
    if (!(await this.sesiones.existe(token))) {
      throw new Error("La sesion de firma asociada al enlace no esta vigente.");
    }

    return (
      `/api/v1/firma/documento/${encodeURIComponent(documentoId)}` +
      `?token=${encodeURIComponent(token)}`
    );
  }

  /**
   * Recupera un documento para descarga.
   *
   * `token` es el token de la sesion de firma, que acota el uso del enlace a la
   * ventana de 300 segundos. `permitirConsultaDirecta` exime de esa comprobacion
   * y se reserva para el backend, que necesita releer el PDF recien generado
   * dentro de la misma invocacion antes de publicar la sesion.
   */
  async recuperar(
    documentoId: string,
    token: string,
    permitirConsultaDirecta = false,
  ): Promise<DocumentoFirmable | null> {
    if (!permitirConsultaDirecta && !(await this.sesiones.existe(token))) {
      return null;
    }
    return this.documentos.get(documentoId) ?? null;
  }

  async cerrar(): Promise<void> {
    this.documentos.clear();
  }
}

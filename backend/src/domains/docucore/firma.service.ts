/**
 * T-BE-DC-11 (capa de aplicacion) — Servicio de invocacion a firma digital.
 *
 * Orquesta el caso de uso completo del endpoint #35:
 *
 *   1. Localiza el documento o genera el PDF A4 institucional a partir del
 *      contenido recibido (T-BE-DC-09).
 *   2. Calcula el SHA-256 de los bytes definitivos.
 *   3. Emite el token de sesion con TTL de 300 segundos en Redis 7 y registra
 *      la sesion (T-BE-DC-11).
 *   4. Emite la URL temporal de descarga del documento.
 *   5. Construye la URI protocolar `refirma://sign?arguments=[BASE64URL]`
 *      (T-BE-DC-10) y la devuelve al frontend junto al token.
 *
 * En el callback, el token se consume de forma atomica: la sesion se autodestruye
 * y un segundo intento con el mismo token falla aunque llegue dentro de la
 * ventana de vigencia.
 *
 * Estado: PROPUESTO.
 */

import { createHash } from "node:crypto";

import { a4GeneratorService, type A4GeneratorService } from "./a4Generator.service.js";
import type { AlmacenDocumentosFirmables } from "./documentoFirmable.store.js";
import {
  errorIntegridadDocumento,
  errorPeticionInvalida,
  errorSesionFirmaInvalida,
  type DetalleError,
} from "./firma.errors.js";
import {
  generarTokenFirma,
  TTL_SESION_FIRMA_SEGUNDOS,
  type FirmaSessionStore,
  type SesionFirma,
} from "./firmaSession.store.js";
import {
  esHashSha256,
  RefirmaGatewayService,
  type PayloadRefirma,
} from "./refirmaGateway.service.js";
import type { ContenidoResolucion, MembreteInstitucional } from "./types.js";

/** Firmante que solicita la firma. */
export interface FirmanteSolicitado {
  id: string;
  nombre: string;
  documento: string;
}

/** Solicitud de invocacion a firma (cuerpo de POST /api/v1/firma/invocar-refirma). */
export interface SolicitudInvocarRefirma {
  documentoId?: string;
  firmante: FirmanteSolicitado;
  /**
   * Contenido A4 a renderizar. Si se omite, se reutiliza el `documentoId` ya
   * almacenado. Exactamente uno de los dos debe estar presente.
   */
  contenido?: ContenidoResolucion;
  membrete?: MembreteInstitucional;
  titulo?: string;
  subtitulo?: string;
  /** Host publico por el que los directores alcanzan al backend. */
  hostPublico: string;
}

/** Respuesta del endpoint de invocacion. */
export interface RespuestaInvocarRefirma {
  sesionId: string;
  token: string;
  uriProtocolar: string;
  urlDocumento: string;
  hashDocumento: string;
  expiraEn: string;
  ttlSegundos: number;
}

/** Resultado recibido en el callback del agente de escritorio. */
export interface ResultadoCallback {
  sesionId: string;
  documentoId: string;
  /** SHA-256 del PDF ya firmado, tal como lo entrego Refirma. */
  hashDocumento: string;
  /** SHA-256 del PDF original publicado en el payload protocolar. */
  hashOrigen: string;
  firmadoEn: string;
  /**
   * `true` cuando el hash firmado difiere del original, lo que confirma que el
   * agente aplico la firma sobre el documento.
   */
  documentoModificado: boolean;
}

export interface DependenciasServicioFirma {
  sesiones: FirmaSessionStore;
  almacen: AlmacenDocumentosFirmables;
  pasarela: RefirmaGatewayService;
  generador?: A4GeneratorService;
}

const LONGITUD_MAXIMA_ID = 128;
const LONGITUD_MAXIMA_NOMBRE = 200;
const LONGITUD_MAXIMA_DOCUMENTO = 32;

export class ServicioFirmaService {
  private readonly generador: A4GeneratorService;

  constructor(private readonly dependencias: DependenciasServicioFirma) {
    this.generador = dependencias.generador ?? a4GeneratorService;
  }

  /** Ejecuta la invocacion completa y devuelve los datos que requiere el frontend. */
  async invocarRefirma(
    solicitud: SolicitudInvocarRefirma,
  ): Promise<RespuestaInvocarRefirma> {
    const detalles = this.validarSolicitud(solicitud);
    if (detalles.length > 0) {
      throw errorPeticionInvalida(detalles);
    }

    const { documento, bytes, sha256 } = await this.resolverDocumento(solicitud);

    const documentoId = solicitud.documentoId ?? documento.id;
    const token = generarTokenFirma();
    const sesionId = this.construirSesionId(token);

    const creadaEn = new Date();
    const expiraEn = new Date(creadaEn.getTime() + TTL_SESION_FIRMA_SEGUNDOS * 1000);

    const urlDocumento = this.dependencias.pasarela.construirUrlDescarga(
      solicitud.hostPublico,
      documentoId,
      token,
    );

    const sesion: SesionFirma = {
      id: sesionId,
      token,
      hashDocumento: sha256,
      documentoId,
      firmante: solicitud.firmante,
      creadaEn: creadaEn.toISOString(),
      expiraEn: expiraEn.toISOString(),
    };

    // NX: si el token ya existiera, la sesion no se sobrescribe. Una colision
    // implicaria un token comprometido y aborta la invocacion.
    const creada = await this.dependencias.sesiones.crear(sesion, TTL_SESION_FIRMA_SEGUNDOS);
    if (!creada) {
      throw errorSesionFirmaInvalida();
    }

    await this.dependencias.almacen.guardar({
      id: documentoId,
      nombreArchivo: documento.nombreArchivo,
      mimeType: documento.mimeType,
      bytes,
      sha256,
    });

    await this.dependencias.almacen.emitirUrlTemporal(
      documentoId,
      token,
      TTL_SESION_FIRMA_SEGUNDOS,
    );

    const parametros: PayloadRefirma = {
      urlDocumento,
      hashDocumento: sha256,
      idSesion: sesionId,
      urlCallback: this.dependencias.pasarela.construirUrlCallback(
        solicitud.hostPublico,
        sesionId,
      ),
    };

    const invocacion = this.dependencias.pasarela.generarInvocacion(parametros);

    return {
      sesionId,
      token,
      uriProtocolar: invocacion.uriProtocolar,
      urlDocumento,
      hashDocumento: sha256,
      expiraEn: expiraEn.toISOString(),
      ttlSegundos: TTL_SESION_FIRMA_SEGUNDOS,
    };
  }

  /**
   * Procesa el callback firmado por Refirma.
   *
   * `consumir` es atomico en Redis: la sesion se elimina en el mismo comando que
   * la lee, de modo que un reintento del agente recibe `null` y se rechaza.
   */
  async recibirCallback(
    token: string,
    sesionId: string,
    hashDocumentoFirmado: string,
  ): Promise<ResultadoCallback> {
    const sesion = await this.dependencias.sesiones.consumir(token);
    if (sesion === null || sesion.id !== sesionId) {
      // La sesion se consumio igual que fallara el cotejo: un token no puede
      // reutilizarse para intentar de nuevo la misma firma.
      throw errorSesionFirmaInvalida();
    }

    const hashRecibido = hashDocumentoFirmado.toLowerCase();

    if (!esHashSha256(hashRecibido)) {
      throw errorIntegridadDocumento(sesion.hashDocumento, hashRecibido);
    }

    // El hash del PDF firmado nunca coincide con el del original: la firma
    // modifica los bytes. Lo que se verifica aqui es la integridad del
    // transporte y el formato del valor recibido. La comprobacion criptografica
    // del documento firmado (PAdES) corresponde a ReFirma Validator.
    const documentoDistinto = hashRecibido !== sesion.hashDocumento;

    return {
      sesionId: sesion.id,
      documentoId: sesion.documentoId,
      hashDocumento: hashRecibido,
      hashOrigen: sesion.hashDocumento,
      firmadoEn: new Date().toISOString(),
      documentoModificado: documentoDistinto,
    };
  }

  /** Recupera el PDF para la URL temporal de descarga. */
  async descargarDocumento(
    documentoId: string,
    token: string,
  ): Promise<{ bytes: Uint8Array; nombreArchivo: string; mimeType: string } | null> {
    const documento = await this.dependencias.almacen.recuperar(documentoId, token);
    if (documento === null) {
      return null;
    }
    return {
      bytes: documento.bytes,
      nombreArchivo: documento.nombreArchivo,
      mimeType: documento.mimeType,
    };
  }

  /** Publica el PDF generado para que el agente de escritorio lo descargue. */
  async registrarDocumentoFirmable(documento: {
    id: string;
    nombreArchivo: string;
    mimeType: string;
    bytes: Uint8Array;
    sha256: string;
  }): Promise<void> {
    await this.dependencias.almacen.guardar(documento);
  }

  // -------------------------------------------------------------------------
  // Apoyo interno
  // -------------------------------------------------------------------------

  /**
   * Obtiene el documento a firmar.
   *
   * Si se envio contenido A4, se renderiza con el generador institucional; si se
   * envio un `documentoId`, se recupera el documento ya almacenado.
   */
  private async resolverDocumento(
    solicitud: SolicitudInvocarRefirma,
  ): Promise<{
    documento: { id: string; nombreArchivo: string; mimeType: string };
    bytes: Uint8Array;
    sha256: string;
  }> {
    if (solicitud.contenido !== undefined) {
      const generado = await this.generador.generar(solicitud.contenido, {
        membrete: solicitud.membrete,
        titulo: solicitud.titulo,
        subtitulo: solicitud.subtitulo,
      });

      return {
        documento: {
          id: solicitud.documentoId ?? this.construirDocumentoId(generado.sha256),
          nombreArchivo: `${solicitud.documentoId ?? generado.sha256.slice(0, 16)}.pdf`,
          mimeType: "application/pdf",
        },
        bytes: generado.bytes,
        sha256: generado.sha256,
      };
    }

    const documentoId = solicitud.documentoId as string;
    const almacenado = await this.dependencias.almacen.recuperar(
      documentoId,
      "",
      true,
    );
    if (almacenado !== null) {
      return {
        documento: {
          id: almacenado.id,
          nombreArchivo: almacenado.nombreArchivo,
          mimeType: almacenado.mimeType,
        },
        bytes: almacenado.bytes,
        sha256: almacenado.sha256,
      };
    }

    throw errorPeticionInvalida([
      {
        campo: "documentoId",
        problema:
          "El documento no se encuentra en el almacen temporal. Para crear uno nuevo, enviar el campo contenido.",
      },
    ]);
  }

  /**
   * Identificador de sesion derivado del token.
   *
   * Se usa SHA-256 del token en vez del token en claro para que el identificador
   * que viaja en el payload protocolar y en la URL de callback no sea
   * utilizable por si mismo para completar una firma.
   */
  private construirSesionId(token: string): string {
    return `ses_${createHash("sha256").update(token, "utf8").digest("hex").slice(0, 32)}`;
  }

  private construirDocumentoId(sha256: string): string {
    return `doc_${sha256.slice(0, 32)}`;
  }

  private validarSolicitud(solicitud: SolicitudInvocarRefirma): DetalleError[] {
    const detalles: DetalleError[] = [];

    const { firmante } = solicitud;
    if (firmante === undefined || firmante === null) {
      detalles.push({
        campo: "firmante",
        problema: "El firmante es obligatorio.",
      });
    } else {
      if (!this.esTextoValido(firmante.id, LONGITUD_MAXIMA_ID)) {
        detalles.push({
          campo: "firmante.id",
          problema: `Debe ser un texto de 1 a ${LONGITUD_MAXIMA_ID} caracteres.`,
        });
      }
      if (!this.esTextoValido(firmante.nombre, LONGITUD_MAXIMA_NOMBRE)) {
        detalles.push({
          campo: "firmante.nombre",
          problema: `Debe ser un texto de 1 a ${LONGITUD_MAXIMA_NOMBRE} caracteres.`,
        });
      }
      if (!this.esTextoValido(firmante.documento, LONGITUD_MAXIMA_DOCUMENTO)) {
        detalles.push({
          campo: "firmante.documento",
          problema:
            "Debe ser el numero de documento de identidad, de hasta 32 caracteres. [EJEMPLO] En pruebas se usa un valor ficticio.",
        });
      }
    }

    const tieneContenido = solicitud.contenido !== undefined;
    const tieneDocumentoId =
      solicitud.documentoId !== undefined && solicitud.documentoId.length > 0;

    if (tieneContenido && tieneDocumentoId) {
      detalles.push({
        campo: "contenido",
        problema:
          "No se puede enviar contenido y documentoId a la vez: el contenido genera un documento nuevo y el documentoId reutiliza uno existente.",
      });
    }

    if (!tieneContenido && !tieneDocumentoId) {
      detalles.push({
        campo: "documentoId",
        problema:
          "Indique un documentoId para reutilizar un documento existente, o contenido para generar el PDF A4 institucional.",
      });
    }

    if (tieneDocumentoId && !this.esTextoValido(solicitud.documentoId, LONGITUD_MAXIMA_ID)) {
      detalles.push({
        campo: "documentoId",
        problema: `Debe ser un texto de 1 a ${LONGITUD_MAXIMA_ID} caracteres.`,
      });
    }

    if (tieneContenido && (!Array.isArray(solicitud.contenido?.bloques) ||
      solicitud.contenido?.bloques.length === 0)) {
      detalles.push({
        campo: "contenido.bloques",
        problema: "Debe contener al menos un bloque de contenido.",
      });
    }

    if (!this.esHostValido(solicitud.hostPublico)) {
      detalles.push({
        campo: "hostPublico",
        problema:
          "Debe ser una URL publica alcanzable por los directores, por ejemplo https://sigd.iestp-suiza.edu.pe.",
      });
    }

    return detalles;
  }

  private esTextoValido(valor: unknown, longitudMaxima: number): boolean {
    return (
      typeof valor === "string" &&
      valor.trim().length > 0 &&
      valor.length <= longitudMaxima
    );
  }

  private esHostValido(valor: unknown): boolean {
    if (typeof valor !== "string" || valor.length === 0) {
      return false;
    }
    try {
      const url = new URL(valor);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }
}

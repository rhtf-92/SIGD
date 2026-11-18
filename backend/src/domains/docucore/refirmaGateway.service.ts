/**
 * T-BE-DC-10 — Pasarela protocolar de invocacion al agente Refirma de RENIEC.
 *
 * Problema que resuelve: la incompatibilidad entre el navegador web y el
 * componente nativo de firma digital instalado en las computadoras de los
 * directores, que provocaba fallos al invocar el DNI electronico o los tokens
 * criptograficos.
 *
 * Solucion aplicada: construccion de la URI protocolar
 * `refirma://sign?arguments=[BASE64URL]`, empaquetando en Base64URL la URL de
 * descarga temporal del documento, su hash SHA-256, el identificador de sesion
 * y la URL de callback seguro.
 *
 * Base64URL y no Base64 estandar: el alfabeto `-` y `_` es seguro dentro de una
 * query, por lo que el payload viaja sin percent-encoding y no depende de que el
 * agente de escritorio interprete escapes adicionales (RFC 4648, seccion 5).
 *
 * Estado de la especificacion:
 *   - CONFIRMADO: la forma de la URI `refirma://sign?arguments=[...]` y los
 *     cuatro datos que debe transportar el payload, segun el issue #35.
 *   - PROPUESTO: los nombres exactos de las claves del payload
 *     (`urlDocumento`, `hashDocumento`, `idSesion`, `urlCallback`) y el uso de
 *     Base64URL.
 *   - PENDIENTE: contrastar los nombres de las claves contra el manual tecnico
 *     oficial del software de firma de RENIEC (MU-349-GTI/SGIS/146). RENIEC
 *     documenta ademas una via distinta para integracion desde aplicaciones web
 *     (ReFirma Invoker, servicio REST local con JWT), que no usa esta URI y que
 *     deberia evaluarse antes del despliegue real. Ver
 *     `docs/docucore/08_decisiones_firma_refirma.md`.
 *
 * Los nombres de clave estan centralizados en {@link CLAVES_PAYLOAD} para que
 * alinearlos con la documentacion oficial sea un cambio de una sola linea y no
 * afecte a la logica de codificacion ni a las pruebas.
 */

import { ErrorFirma, errorPayloadInvalido } from "./firma.errors.js";

/** Esquema del protocolo de escritorio de RENIEC. */
export const ESQUEMA_URI = "refirma://";

/** Accion que ordena al agente iniciar el proceso de firma. */
export const ACCION_FIRMAR = "sign";

/** Nombre del parametro de query que transporta el payload. */
export const NOMBRE_PARAMETRO = "arguments";

/**
 * Corchetes que envuelven el valor codificado en la URI.
 *
 * El issue #35 escribe `arguments=[BASE64]`. Los corchetes se emiten en claro
 * porque forman parte de la convencion de la pasarela y no de la query misma.
 * Si la documentacion oficial los omite, basta con vaciar estas dos constantes.
 */
export const ENVOLTORIO_IZQUIERDO = "[";

/** Cierre del envoltorio del payload en la URI. */
export const ENVOLTORIO_DERECHO = "]";

/**
 * Conjunto exacto de claves del payload, en el orden exigido por la pasarela.
 *
 * Las pruebas verifican que el payload decodificado contiene estas claves y
 * ninguna mas, de modo que una clave adicional o faltante se detecte.
 */
export const CLAVES_PAYLOAD = [
  "urlDocumento",
  "hashDocumento",
  "idSesion",
  "urlCallback",
] as const;

/** Clave obligatoria del payload protocolar. */
export type ClavePayload = (typeof CLAVES_PAYLOAD)[number];

/** Payload que viaja codificado en Base64URL dentro de la URI `refirma://`. */
export interface PayloadRefirma {
  /** URL temporal por la que el agente de escritorio descarga el PDF. */
  urlDocumento: string;
  /** Hash SHA-256 en hexadecimal, en minusculas, del PDF a firmar. */
  hashDocumento: string;
  /** Identificador de la sesion de firma en Redis. */
  idSesion: string;
  /** URL HTTPS a la que el agente entrega el resultado de la firma. */
  urlCallback: string;
}

/** Configuracion de seguridad y de formato de la pasarela. */
export interface OpcionesRefirmaGateway {
  /**
   * Hosts permitidos en `urlDocumento` y `urlCallback`.
   *
   * Lista blanca obligatoria: sin ella, un payload manipulado podria ordenar al
   * agente de escritorio a descargar de un host arbitrario o devolver el
   * resultado firmado a un atacante.
   */
  hostsPermitidos: readonly string[];
  /** Exigir HTTPS en ambas URL. Por omision, `true`. */
  exigirHttps?: boolean;
}

/** Invocacion completa entregada al frontend. */
export interface InvocacionRefirma {
  /** URI protocolar para navegar o enlazar desde el navegador. */
  uriProtocolar: string;
  /** Payload ya decodificado, util para depuracion y auditoria. */
  parametros: PayloadRefirma;
  /** Payload codificado en Base64URL tal como viaja en la URI. */
  parametrosCodificados: string;
  /** Version del formato de payload, para evoluciones futuras. */
  version: 1;
}

/** Expresion regular de un hash SHA-256 en hexadecimal. */
const PATRON_SHA256 = /^[0-9a-f]{64}$/u;

/**
 * Expresion regular de un identificador de sesion.
 *
 * Se restringe al alfabeto de Base64URL mas el separador de version, para que el
 * identificador sea seguro de interpolar en rutas y query strings.
 */
const PATRON_ID_SESION = /^[A-Za-z0-9_-]{16,128}$/u;

/** Indica si el valor es un hash SHA-256 valido. */
export function esHashSha256(valor: string): boolean {
  return PATRON_SHA256.test(valor);
}

/** Indica si el valor tiene la forma de un identificador de sesion. */
export function esIdSesionValido(valor: string): boolean {
  return PATRON_ID_SESION.test(valor);
}

export class RefirmaGatewayService {
  private readonly exigirHttps: boolean;

  constructor(private readonly opciones: OpcionesRefirmaGateway) {
    this.exigirHttps = opciones.exigirHttps ?? true;
  }

  /**
   * Valida el payload y devuelve la URI protocolar completa.
   *
   * Lanza {@link ErrorFirma} con codigo `ERR-FIR-422` ante cualquier
   * incumplimiento, de modo que ningun payload invalido llegue al agente.
   */
  generarInvocacion(parametros: PayloadRefirma): InvocacionRefirma {
    this.validar(parametros);

    const parametrosCodificados = this.codificar(parametros);

    return {
      uriProtocolar: this.construirUri(parametrosCodificados),
      parametros: { ...parametros },
      parametrosCodificados,
      version: 1,
    };
  }

  /** Serializa el payload a JSON y lo codifica en Base64URL sin relleno. */
  codificar(parametros: PayloadRefirma): string {
    const json = JSON.stringify(this.ordenar(parametros));
    return Buffer.from(json, "utf8").toString("base64url");
  }

  /** Decodifica y valida un payload Base64URL. */
  decodificar(parametrosCodificados: string): PayloadRefirma {
    let json: string;
    try {
      json = Buffer.from(parametrosCodificados, "base64url").toString("utf8");
    } catch {
      throw errorPayloadInvalido([
        {
          campo: "arguments",
          problema: "El valor no es una secuencia Base64URL valida.",
        },
      ]);
    }

    if (json.length === 0) {
      throw errorPayloadInvalido([
        { campo: "arguments", problema: "El valor decodificado esta vacio." },
      ]);
    }

    let datos: unknown;
    try {
      datos = JSON.parse(json);
    } catch {
      throw errorPayloadInvalido([
        {
          campo: "arguments",
          problema: "El valor decodificado no es un JSON valido.",
        },
      ]);
    }

    if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
      throw errorPayloadInvalido([
        {
          campo: "arguments",
          problema: "El payload debe ser un objeto JSON con los parametros de la pasarela.",
        },
      ]);
    }

    const registro = datos as Record<string, unknown>;
    this.validarConjuntoDeClaves(registro);

    const payload: PayloadRefirma = {
      urlDocumento: String(registro["urlDocumento"]),
      hashDocumento: String(registro["hashDocumento"]),
      idSesion: String(registro["idSesion"]),
      urlCallback: String(registro["urlCallback"]),
    };

    this.validar(payload);
    return payload;
  }

  /**
   * Extrae el payload de una URI `refirma://` completa.
   *
   * Permite verificar de extremo a extremo que lo que recibiria el agente de
   * escritorio vuelve a convertirse en los mismos parametros.
   */
  extraerDeUri(uriProtocolar: string): PayloadRefirma {
    const prefijo = `${ESQUEMA_URI}${ACCION_FIRMAR}?${NOMBRE_PARAMETRO}=`;
    if (!uriProtocolar.startsWith(prefijo)) {
      throw new ErrorFirma(
        "ERR-FIR-422",
        `La URI de invocacion debe comenzar con ${prefijo}.`,
        "Validation",
        422,
        [
          {
            campo: "uriProtocolar",
            problema: `La URI debe comenzar con ${prefijo}.`,
          },
        ],
      );
    }

    let valor = uriProtocolar.slice(prefijo.length);

    if (valor.startsWith(ENVOLTORIO_IZQUIERDO) && valor.endsWith(ENVOLTORIO_DERECHO)) {
      valor = valor.slice(ENVOLTORIO_IZQUIERDO.length, -ENVOLTORIO_DERECHO.length);
    }

    return this.decodificar(valor);
  }

  /** Ensambla la URI protocolar a partir del payload ya codificado. */
  construirUri(parametrosCodificados: string): string {
    return (
      `${ESQUEMA_URI}${ACCION_FIRMAR}?${NOMBRE_PARAMETRO}=` +
      `${ENVOLTORIO_IZQUIERDO}${parametrosCodificados}${ENVOLTORIO_DERECHO}`
    );
  }

  /** Compone la URL de callback seguro de la sesion. */
  construirUrlCallback(basePublica: string, idSesion: string): string {
    const base = basePublica.replace(/\/+$/u, "");
    return `${base}/api/v1/firma/callback-refirma/${encodeURIComponent(idSesion)}`;
  }

  /**
   * Compone la URL temporal de descarga del documento.
   *
   * La ruta incluye el token de sesion: sin el, el endpoint de descarga rechaza
   * la peticion, de modo que el enlace no sirve despues de consumir la sesion.
   */
  construirUrlDescarga(
    basePublica: string,
    documentoId: string,
    token: string,
  ): string {
    const base = basePublica.replace(/\/+$/u, "");
    return (
      `${base}/api/v1/firma/documento/${encodeURIComponent(documentoId)}` +
      `?token=${encodeURIComponent(token)}`
    );
  }

  /** Valida el payload lanzando `ErrorFirma` ante el primer incumplimiento. */
  validar(parametros: PayloadRefirma): void {
    const detalles: { campo: string; problema: string }[] = [];

    if (!esHashSha256(parametros.hashDocumento)) {
      detalles.push({
        campo: "hashDocumento",
        problema:
          "Debe ser un hash SHA-256 de 64 caracteres hexadecimales en minusculas.",
      });
    }

    if (!esIdSesionValido(parametros.idSesion)) {
      detalles.push({
        campo: "idSesion",
        problema:
          "Debe tener entre 16 y 128 caracteres del alfabeto Base64URL (A-Z, a-z, 0-9, - y _).",
      });
    }

    detalles.push(...this.revisarUrl("urlDocumento", parametros.urlDocumento));
    detalles.push(...this.revisarUrl("urlCallback", parametros.urlCallback));

    if (detalles.length > 0) {
      // Una URL puede incumplir varias reglas (por ejemplo, HTTP y host
      // ajeno a la lista blanca). Se conserva un solo detalle por campo para
      // que el mensaje al usuario no repita el mismo parametro.
      const porCampo = new Map<string, { campo: string; problema: string }>();
      for (const detalle of detalles) {
        if (!porCampo.has(detalle.campo)) {
          porCampo.set(detalle.campo, detalle);
        }
      }
      throw errorPayloadInvalido([...porCampo.values()]);
    }
  }

  /** Revisa una URL del payload: esquema, host y lista blanca. */
  private revisarUrl(campo: string, valor: string): { campo: string; problema: string }[] {
    const detalles: { campo: string; problema: string }[] = [];

    let url: URL;
    try {
      url = new URL(valor);
    } catch {
      return [{ campo, problema: "Debe ser una URL absoluta valida." }];
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      detalles.push({
        campo,
        problema: `Esquema no admitido: ${url.protocol}. Se espera http o https.`,
      });
      return detalles;
    }

    if (this.exigirHttps && url.protocol !== "https:") {
      detalles.push({
        campo,
        problema: "Se exige HTTPS: una URL en claro permite alterar el documento en tránsito.",
      });
    }

    if (!this.opciones.hostsPermitidos.includes(url.hostname)) {
      detalles.push({
        campo,
        problema:
          `El host ${url.hostname} no esta en la lista blanca de destinos permitidos ` +
          `(${this.opciones.hostsPermitidos.join(", ")}).`,
      });
    }

    return detalles;
  }

  /** Verifica que el payload contenga exactamente las claves exigidas. */
  private validarConjuntoDeClaves(registro: Record<string, unknown>): void {
    const claves = Object.keys(registro).sort();
    const esperadas = [...CLAVES_PAYLOAD].sort();

    const faltantes = esperadas.filter((clave) => !claves.includes(clave));
    const sobrantes = claves.filter((clave) => !esperadas.includes(clave as ClavePayload));

    const detalles: { campo: string; problema: string }[] = [];

    for (const clave of faltantes) {
      detalles.push({
        campo: clave,
        problema: `El payload protocolar exige el parametro ${clave} y no fue recibido.`,
      });
    }

    for (const clave of sobrantes) {
      detalles.push({
        campo: NOMBRE_PARAMETRO,
        problema:
          `El parametro ${clave} no forma parte del protocolo y no debe enviarse a la pasarela.`,
      });
    }

    if (detalles.length > 0) {
      throw errorPayloadInvalido(detalles);
    }
  }

  /** Emite las claves en el orden fijo del protocolo. */
  private ordenar(parametros: PayloadRefirma): Record<string, string> {
    const salida: Record<string, string> = {};
    for (const clave of CLAVES_PAYLOAD) {
      salida[clave] = parametros[clave];
    }
    return salida;
  }
}

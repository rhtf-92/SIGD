/**
 * Errores del dominio de firma de DocuCore.
 *
 * Se alinean con el catalogo unificado de errores del backend
 * (`docs/integracion/02_catalogo_errores_backend.md`): `code`, `message`,
 * `category`, `details`, `retryable` y `correlationId`.
 *
 * Estado: PROPUESTO. El catalogo de errores sigue en estado de borrador
 * pendiente de validacion del proyecto.
 */

/** Clasificacion funcional del error. */
export type CategoriaError =
  | "Validation"
  | "Authorization"
  | "Conflict"
  | "NotFound"
  | "Gateway"
  | "Internal";

/** Detalle de campo que incumplio una regla. */
export interface DetalleError {
  campo: string;
  problema: string;
}

/** Forma del error serializado en la respuesta HTTP. */
export interface CargaUtilError {
  code: string;
  message: string;
  category: CategoriaError;
  details?: { field: string; issue: string }[];
  retryable: boolean;
  correlationId: string;
}

export class ErrorFirma extends Error {
  readonly codigo: string;

  readonly categoria: CategoriaError;

  readonly estadoHttp: number;

  readonly detalles: readonly DetalleError[];

  readonly reintentable: boolean;

  constructor(
    codigo: string,
    mensaje: string,
    categoria: CategoriaError,
    estadoHttp: number,
    detalles: readonly DetalleError[] = [],
    reintentable = false,
  ) {
    super(mensaje);
    this.name = "ErrorFirma";
    this.codigo = codigo;
    this.categoria = categoria;
    this.estadoHttp = estadoHttp;
    this.detalles = detalles;
    this.reintentable = reintentable;
  }

  /** Serializa el error al formato unificado del catalogo. */
  descripcion(correlationId: string): CargaUtilError {
    const carga: CargaUtilError = {
      code: this.codigo,
      message: this.message,
      category: this.categoria,
      retryable: this.reintentable,
      correlationId,
    };

    if (this.detalles.length > 0) {
      carga.details = this.detalles.map((detalle) => ({
        field: detalle.campo,
        issue: detalle.problema,
      }));
    }

    return carga;
  }
}

/** El documento solicitado no existe o no es todavia firmable. */
export function errorDocumentoNoEncontrado(documentoId: string): ErrorFirma {
  return new ErrorFirma(
    "ERR-FIR-404",
    "El documento indicado no existe o no se encuentra en estado firmable.",
    "NotFound",
    404,
    [{ campo: "documentoId", problema: `No se encontro el documento ${documentoId}.` }],
  );
}

/** La sesion de firma no existe, ya fue consumida o expiro. */
export function errorSesionFirmaInvalida(): ErrorFirma {
  return new ErrorFirma(
    "ERR-FIR-409",
    "La sesion de firma no es valida, ya fue consumida o su vigencia expiro.",
    "Conflict",
    409,
    [
      {
        campo: "token",
        problema:
          "El token de sesion no existe en Redis, ya fue consumido por un callback previo o supero los 300 segundos de vigencia.",
      },
    ],
  );
}

/**
 * El payload protocolar no cumple el formato exigido por la pasarela.
 *
 * El mensaje enumera los campos incumplidos para que el diagnostico llegue al log
 * sin consultar el arreglo `details`.
 */
export function errorPayloadInvalido(
  detalles: readonly DetalleError[],
): ErrorFirma {
  const campos = [...new Set(detalles.map((detalle) => detalle.campo))];

  const mensaje =
    campos.length > 0
      ? `El payload de la pasarela Refirma no cumple el formato requerido en: ${campos.join(", ")}.`
      : "El payload de la pasarela Refirma no cumple el formato requerido.";

  return new ErrorFirma("ERR-FIR-422", mensaje, "Validation", 422, detalles);
}

/** La peticion no supero la validacion de entrada. */
export function errorPeticionInvalida(detalles: readonly DetalleError[]): ErrorFirma {
  return new ErrorFirma(
    "ERR-FIR-400",
    "La solicitud de invocacion a firma es invalida.",
    "Validation",
    400,
    detalles,
  );
}

/** El documento firmado llega con un hash distinto al publicado. */
export function errorIntegridadDocumento(
  esperado: string,
  recibido: string,
): ErrorFirma {
  return new ErrorFirma(
    "ERR-FIR-422",
    "El hash SHA-256 del documento firmado no coincide con el publicado.",
    "Validation",
    422,
    [{ campo: "hashDocumento", problema: `Esperado ${esperado}; recibido ${recibido}.` }],
  );
}

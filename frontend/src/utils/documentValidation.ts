/**
 * Utilidades canónicas de validación y formateo de documentos de identidad
 * Conforme a estándares de RENIEC (DNI 8 dígitos), SUNAT (RUC 11 dígitos) y Migraciones (CE).
 */

export type TipoDocumentoIdentidad = 'DNI' | 'RUC' | 'CE' | 'PASAPORTE';

export interface DocumentValidationResult {
  esValido: boolean;
  mensajeError?: string;
  longitudActual: number;
  longitudRequerida?: number | [number, number];
  tipo: TipoDocumentoIdentidad;
}

/**
 * Sanitiza la entrada del usuario en tiempo real según el tipo de documento.
 * Previene caracteres inválidos conservando estrictamente ceros iniciales.
 */
export function sanitizarNumeroDocumento(
  valor: string,
  tipo: TipoDocumentoIdentidad
): string {
  if (!valor) return '';
  const limpio = valor.trim();

  switch (tipo) {
    case 'DNI':
      // Solo dígitos numéricos, máximo 8
      return limpio.replace(/[^0-9]/g, '').slice(0, 8);

    case 'RUC':
      // Solo dígitos numéricos, máximo 11
      return limpio.replace(/[^0-9]/g, '').slice(0, 11);

    case 'CE':
      // Alfanumérico en mayúsculas, de 8 a 12 caracteres (SBS 9 dígitos, Migraciones con serie 'N', SUNAT 8-12)
      return limpio.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12);

    case 'PASAPORTE':
      // Alfanumérico en mayúsculas, máximo 15
      return limpio.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 15);

    default:
      return limpio.slice(0, 20);
  }
}

/**
 * Valida un número de documento según las reglas institucionales peruanas.
 */
export function validarNumeroDocumento(
  numero: string,
  tipo: TipoDocumentoIdentidad
): DocumentValidationResult {
  const longitud = numero.length;

  switch (tipo) {
    case 'DNI': {
      if (longitud === 0) {
        return {
          esValido: false,
          mensajeError: 'El número de DNI es obligatorio.',
          longitudActual: 0,
          longitudRequerida: 8,
          tipo,
        };
      }
      if (!/^[0-9]+$/.test(numero)) {
        return {
          esValido: false,
          mensajeError: 'El DNI solo debe contener dígitos numéricos.',
          longitudActual: longitud,
          longitudRequerida: 8,
          tipo,
        };
      }
      if (longitud < 8) {
        return {
          esValido: false,
          mensajeError: `Faltan ${8 - longitud} dígitos para completar tu DNI (8 dígitos).`,
          longitudActual: longitud,
          longitudRequerida: 8,
          tipo,
        };
      }
      if (longitud > 8) {
        return {
          esValido: false,
          mensajeError: 'El DNI debe tener exactamente 8 dígitos.',
          longitudActual: longitud,
          longitudRequerida: 8,
          tipo,
        };
      }
      return {
        esValido: true,
        longitudActual: 8,
        longitudRequerida: 8,
        tipo,
      };
    }

    case 'RUC': {
      if (longitud === 0) {
        return {
          esValido: false,
          mensajeError: 'El número de RUC es obligatorio.',
          longitudActual: 0,
          longitudRequerida: 11,
          tipo,
        };
      }
      if (!/^[0-9]+$/.test(numero)) {
        return {
          esValido: false,
          mensajeError: 'El RUC solo debe contener dígitos numéricos.',
          longitudActual: longitud,
          longitudRequerida: 11,
          tipo,
        };
      }
      if (longitud < 11) {
        return {
          esValido: false,
          mensajeError: `Faltan ${11 - longitud} dígitos para completar tu RUC (11 dígitos).`,
          longitudActual: longitud,
          longitudRequerida: 11,
          tipo,
        };
      }
      if (longitud > 11) {
        return {
          esValido: false,
          mensajeError: 'El RUC debe tener exactamente 11 dígitos.',
          longitudActual: longitud,
          longitudRequerida: 11,
          tipo,
        };
      }
      return {
        esValido: true,
        longitudActual: 11,
        longitudRequerida: 11,
        tipo,
      };
    }

    case 'CE': {
      if (longitud === 0) {
        return {
          esValido: false,
          mensajeError: 'El Carné de Extranjería es obligatorio.',
          longitudActual: 0,
          longitudRequerida: [8, 12],
          tipo,
        };
      }
      if (!/^[A-Z0-9]+$/.test(numero)) {
        return {
          esValido: false,
          mensajeError: 'El Carné de Extranjería solo debe contener caracteres alfanuméricos.',
          longitudActual: longitud,
          longitudRequerida: [8, 12],
          tipo,
        };
      }
      if (longitud < 8) {
        return {
          esValido: false,
          mensajeError: `Faltan ${8 - longitud} caracteres para alcanzar el mínimo de tu Carné de Extranjería (8 a 12 caracteres).`,
          longitudActual: longitud,
          longitudRequerida: [8, 12],
          tipo,
        };
      }
      if (longitud > 12) {
        return {
          esValido: false,
          mensajeError: 'El Carné de Extranjería debe contener como máximo 12 caracteres.',
          longitudActual: longitud,
          longitudRequerida: [8, 12],
          tipo,
        };
      }
      return {
        esValido: true,
        longitudActual: longitud,
        longitudRequerida: [8, 12],
        tipo,
      };
    }

    case 'PASAPORTE': {
      if (longitud === 0) {
        return {
          esValido: false,
          mensajeError: 'El número de pasaporte es obligatorio.',
          longitudActual: 0,
          longitudRequerida: [6, 15],
          tipo,
        };
      }
      if (!/^[A-Z0-9]+$/.test(numero)) {
        return {
          esValido: false,
          mensajeError: 'El pasaporte solo debe contener caracteres alfanuméricos.',
          longitudActual: longitud,
          longitudRequerida: [6, 15],
          tipo,
        };
      }
      if (longitud < 6 || longitud > 15) {
        return {
          esValido: false,
          mensajeError: 'El pasaporte debe tener entre 6 y 15 caracteres.',
          longitudActual: longitud,
          longitudRequerida: [6, 15],
          tipo,
        };
      }
      return {
        esValido: true,
        longitudActual: longitud,
        longitudRequerida: [6, 15],
        tipo,
      };
    }

    default:
      return {
        esValido: longitud > 0,
        mensajeError: longitud === 0 ? 'Documento obligatorio' : undefined,
        longitudActual: longitud,
        tipo,
      };
  }
}

/**
 * Devuelve el texto descriptivo de ayuda institucional para cada tipo de documento.
 */
export function obtenerTextoAyudaDocumento(tipo: TipoDocumentoIdentidad): string {
  switch (tipo) {
    case 'DNI':
      return 'Ingrese los 8 dígitos del DNI';
    case 'RUC':
      return 'Ingrese los 11 dígitos del RUC';
    case 'CE':
      return 'Ingrese su Carné de Extranjería (8 a 12 caracteres, ej. 9 dígitos o serie con letra)';
    case 'PASAPORTE':
      return 'Ingrese entre 6 y 15 caracteres del Pasaporte';
    default:
      return 'Ingrese su número de documento';
  }
}

/**
 * Devuelve el placeholder apropiado para cada tipo de documento.
 */
export function obtenerPlaceholderDocumento(tipo: TipoDocumentoIdentidad): string {
  switch (tipo) {
    case 'DNI':
      return '45872315';
    case 'RUC':
      return '20123456789';
    case 'CE':
      return '001234567';
    case 'PASAPORTE':
      return 'A1234567';
    default:
      return 'Número de documento';
  }
}

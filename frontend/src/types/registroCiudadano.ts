/* Tipos para el registro de ciudadano (ENT-M01-01) */

// Domicilio compartido entre persona natural y jurídica
type Address = {
  departamentoCodigo: string;
  provinciaCodigo: string;
  distritoCodigo: string;
  direccionExacta: string;
  referencia?: string;
};

/* Persona Natural - RegistroCiudadanoNatural */
export type Natural = {
  tipoPersona: "NATURAL";
  nombres: string;
  apellidos: string;
  fechaNacimiento: string; // validar edad >= 16 años (calculada dinámicamente)
  correo: string; // formato RFC 5322 válido
  celular: string; // exactamente 9 dígitos empezando en 9
  domicilio: Address;
  tipoDocumento: "DNI" | "CE";
  numeroDocumento: string;
  declaracionJuradaAceptada: boolean; // debe ser true
  consentimientoDatosPersonales: boolean; // debe ser true
};

/* Persona Jurídica - RegistroCiudadanoJuridica */
export type Juridical = {
  tipoPersona: "JURIDICA";
  ruc: string; // exactamente 11 dígitos, inicia en "10" o "20", validar dígito verifier Módulo 11 SUNAT
  razonSocial: string; // 3-150 caracteres
  representanteLegal: {
    tipoDocumento: "DNI" | "CE";
    numeroDocumento: string; // DNI exactamente 8 dígitos
    nombres: string;
    apellidos: string;
    cargo: string;
  };
  partidaSunarp: string;
  correoCorporativo: string; // formato RFC 5322 válido
  celularContacto: string; // exactamente 9 dígitos empezando en 9
  domicilio: Address;
  declaracionJuradaAceptada: boolean; // debe ser true
  consentimientoDatosPersonales: boolean; // debe ser true
};

/* Unión discriminada para RegistroCiudadanoRequest */
export type RegistroCiudadanoRequest = Natural | Juridical;
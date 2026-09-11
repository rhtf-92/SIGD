import { z } from "zod";

/* --- Persona Natural --- */

/* Schema persona natural */
export const naturalSchema = z
  .object({
    tipoPersona: z.literal("NATURAL"),
    nombres: z
      .string()
      .regex(/^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]{2,80}$/, {
        message: "Nombres deben tener 2-80 caracteres alfabéticos con tildes y espacios",
      }),
    apellidos: z
      .string()
      .regex(/^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]{2,80}$/, {
        message: "Apellidos deben tener 2-80 caracteres alfabéticos con tildes y espacios",
      }),
    fechaNacimiento: z
      .string()
      .refine(
        (val) => {
          const birthDate = new Date(val);
          const today = new Date();
          const age =
            today.getFullYear() -
            birthDate.getFullYear() -
            (today.getMonth() < birthDate.getMonth() ||
              (today.getMonth() === birthDate.getMonth() &&
                today.getDate() < birthDate.getDate())
                ? 1
                : 0);
          return age >= 16;
        },
        { message: "La persona debe tener al menos 16 años" }
      ),
    correo: z.string().email({ message: "Formato de correo RFC 5322 inválido" }),
    celular: z
      .string()
      .regex(/^9[0-9]{8}$/, {
        message: "Celular debe tener exactamente 9 dígitos empezando en 9",
      }),
    domicilio: z.object({
      departamentoCodigo: z.string(),
      provinciaCodigo: z.string(),
      distritoCodigo: z.string(),
      direccionExacta: z.string(),
      referencia: z.string().optional(),
    }),
    tipoDocumento: z.enum(["DNI", "CE"]),
    numeroDocumento: z
      .string()
      .refine(
        (val) => /^[0-9]{8}$/.test(val) || /^[A-Z0-9]{9,12}$/.test(val),
        {
          message:
            "DNI debe tener exactamente 8 dígitos o CE de 9-12 caracteres alfanuméricos",
        }
      ),
    declaracionJuradaAceptada: z.boolean().refine((val) => val === true, {
      message: "Debe aceptar la declaración jurada",
    }),
    consentimientoDatosPersonales: z
      .boolean()
      .refine((val) => val === true, {
        message: "Debe aceptar el consentimiento de datos personales",
      }),
  });

/* --- Persona Jurídica --- */

/* Algoritmo Módulo 11 SUNAT para RUC */
const validateRucModulo11 = (ruc: string): boolean => {
  if (!/^(10|20)[0-9]{9}$/.test(ruc)) return false;

  const digitoVerificador = ruc.slice(-1);
  const digitos = ruc.slice(0, -1);
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

  let suma = 0;
  for (let i = 0; i < 10; i++) {
    suma += parseInt(digitos[i]) * pesos[i];
  }

  const resto = suma % 11;
  const modulo11 = resto === 0 ? 0 : 11 - resto;

  return digitoVerificador === modulo11.toString();
};

const juridicalDocumentSchema = z
  .object({
    tipoDocumento: z.enum(["DNI", "CE"]),
    numeroDocumento: z
      .string()
      .refine(
        (val) => /^[0-9]{8}$/.test(val) || /^[A-Z0-9]{9,12}$/.test(val),
        {
          message:
            "DNI debe tener exactamente 8 dígitos o CE de 9-12 caracteres alfanuméricos",
        }
      ),
    nombres: z
      .string()
      .regex(/^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]{2,80}$/, {
        message: "Nombres deben tener 2-80 caracteres alfabéticos con tildes y espacios",
      }),
    apellidos: z
      .string()
      .regex(/^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]{2,80}$/, {
        message: "Apellidos deben tener 2-80 caracteres alfabéticos con tildes y espacios",
      }),
    cargo: z
      .string()
      .min(2, "Cargo debe tener mínimo 2 caracteres")
      .max(100, "Cargo debe tener máximo 100 caracteres"),
  });

/* Schema persona jurídica */
export const juridicalSchema = z
  .object({
    tipoPersona: z.literal("JURIDICA"),
    ruc: z
      .string()
      .refine(
        (val) => /^(10|20)[0-9]{9}$/.test(val) && validateRucModulo11(val),
        {
          message:
            "RUC debe tener 11 dígitos iniciar en 10 o 20 y dígito verifier MODULO 11 SUNAT",
        }
      ),
    razonSocial: z
      .string()
      .min(3, "Razón social debe tener mínimo 3 caracteres")
      .max(150, "Razón social debe tener máximo 150 caracteres"),
    representanteLegal: juridicalDocumentSchema,
    partidaSunarp: z.string(),
    correoCorporativo: z.string().email({ message: "Formato de correo RFC 5322 inválido" }),
    celularContacto: z
      .string()
      .regex(/^9[0-9]{8}$/, {
        message: "Celular contacto debe tener exactamente 9 dígitos empezando en 9",
      }),
    domicilio: z.object({
      departamentoCodigo: z.string(),
      provinciaCodigo: z.string(),
      distritoCodigo: z.string(),
      direccionExacta: z.string(),
      referencia: z.string().optional(),
    }),
    declaracionJuradaAceptada: z
      .boolean()
      .refine((val) => val === true, {
        message: "Debe aceptar la declaración jurada",
      }),
    consentimientoDatosPersonales: z
      .boolean()
      .refine((val) => val === true, {
        message: "Debe aceptar el consentimiento de datos personales",
      }),
  });

/* --- Unión discriminada RegistroCiudadanoRequest --- */

export const registroCiudadanoSchema = z.discriminatedUnion("tipoPersona", [
  naturalSchema,
  juridicalSchema,
]);
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, { message: "La contraseña debe tener mínimo 8 caracteres" })
  .max(128, { message: "La contraseña debe tener máximo 128 caracteres" })
  .regex(/[A-Z]/, { message: "La contraseña debe tener al menos una mayúscula" })
  .regex(/[a-z]/, { message: "La contraseña debe tener al menos una minúscula" })
  .regex(/[0-9]/, { message: "La contraseña debe tener al menos un número" })
  .regex(/[^A-Za-z0-9]/, { message: "La contraseña debe tener al menos un símbolo" });

/* --- Persona Natural --- */

const naturalBase = z.object({
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
    distritoCodigo: z
      .string()
      .regex(/^25[0-9]{4}$/, { message: "Seleccione su distrito" }),
    direccionExacta: z
      .string()
      .min(5, {
        message: "La dirección exacta debe tener al menos 5 caracteres",
      })
      .max(200, {
        message: "La dirección exacta debe tener máximo 200 caracteres",
      }),
    referencia: z.string().max(200).optional(),
  }),
  tipoDocumento: z.literal("DNI"),
  numeroDocumento: z.string().regex(/^[0-9]{8}$/, {
    message: "DNI debe tener exactamente 8 dígitos",
  }),
  declaracionJuradaAceptada: z.boolean().refine((val) => val === true, {
    message: "Debe aceptar la declaración jurada",
  }),
  consentimientoLey29733: z.boolean().refine((val) => val === true, {
    message:
      "Debe aceptar el consentimiento de tratamiento de datos personales conforme a la Ley N° 29733",
  }),
  version: z.literal("1.0"),
  fechaAceptacion: z.string().datetime({
    message: "fechaAceptacion debe ser un string en formato ISO 8601 válido",
  }),
  password: passwordSchema,
  confirmarPassword: z.string(),
});

export const naturalSchema = naturalBase.superRefine((data, ctx) => {
  const partesApellidos = data.apellidos.trim().split(/\s+/).filter((p) => p.length >= 1);
  if (partesApellidos.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe ingresar apellido paterno y apellido materno (al menos dos apellidos)",
      path: ["apellidos"],
    });
  } else {
    const todosValidos = partesApellidos.every((p) => p.length >= 2);
    if (!todosValidos) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Los apellidos deben tener al menos dos palabras de 2 letras o más",
        path: ["apellidos"],
      });
    }
  }
  if (data.password !== data.confirmarPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Las contraseñas no coinciden",
      path: ["confirmarPassword"],
    });
  }
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
  const resta = 11 - resto;
  const modulo11 = resta === 10 ? 0 : resta === 11 ? 1 : resta;

  return digitoVerificador === modulo11.toString();
};

const juridicalDocumentSchema = z.object({
  tipoDocumento: z.literal("DNI"),
  numeroDocumento: z.string().regex(/^[0-9]{8}$/, {
    message: "DNI debe tener exactamente 8 dígitos",
  }),
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
const juridicalBase = z.object({
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
  partidaSunarp: z
    .string()
    .refine((val) => val === "" || /^[0-9]{1,18}$/.test(val), {
      message: "La partida SUNARP debe estar vacía o contener solo dígitos (1-18)",
    }),
  correoCorporativo: z.string().email({ message: "Formato de correo RFC 5322 inválido" }),
  celularContacto: z
    .string()
    .regex(/^9[0-9]{8}$/, {
      message: "Celular contacto debe tener exactamente 9 dígitos empezando en 9",
    }),
  domicilio: z.object({
    departamentoCodigo: z.string(),
    provinciaCodigo: z.string(),
    distritoCodigo: z
      .string()
      .regex(/^25[0-9]{4}$/, { message: "Seleccione su distrito" }),
    direccionExacta: z
      .string()
      .min(5, {
        message: "La dirección exacta debe tener al menos 5 caracteres",
      })
      .max(200, {
        message: "La dirección exacta debe tener máximo 200 caracteres",
      }),
    referencia: z.string().max(200).optional(),
  }),
  declaracionJuradaAceptada: z.boolean().refine((val) => val === true, {
    message: "Debe aceptar la declaración jurada",
  }),
  consentimientoLey29733: z.boolean().refine((val) => val === true, {
    message:
      "Debe aceptar el consentimiento de tratamiento de datos personales conforme a la Ley N° 29733",
  }),
  version: z.literal("1.0"),
  fechaAceptacion: z.string().datetime({
    message: "fechaAceptacion debe ser un string en formato ISO 8601 válido",
  }),
  password: passwordSchema,
  confirmarPassword: z.string(),
});

export const juridicalSchema = juridicalBase.superRefine((data, ctx) => {
  if (data.password !== data.confirmarPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Las contraseñas no coinciden",
      path: ["confirmarPassword"],
    });
  }
});

/* --- Unión discriminada RegistroCiudadanoRequest --- */

export const registroCiudadanoSchema = z.discriminatedUnion("tipoPersona", [
  naturalBase,
  juridicalBase,
]);

export { naturalBase, juridicalBase };
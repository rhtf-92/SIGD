import { z } from "zod";

/**
 * OrganiCore - Administración de usuarios institucionales
 * Responsable: Leonardo / Ricardo
 *
 * Tareas relacionadas:
 * - T-BE-OC-06: Directorio institucional
 * - T-BE-OC-07: Validación de correo institucional
 */

const DOMINIO_INSTITUCIONAL = "@iestpsuiza.edu.pe";

/**
 * Estados funcionales del usuario.
 */
export const estadoUsuarioSchema = z.enum([
  "ACTIVO",
  "INACTIVO",
  "BLOQUEADO",
]);

/**
 * Correo institucional obligatorio.
 *
 * Válido:
 * usuario@iestpsuiza.edu.pe
 *
 * No válidos:
 * usuario@gmail.com
 * usuario@hotmail.com
 */
export const correoInstitucionalSchema = z
  .string()
  .trim()
  .email("El correo electrónico no tiene un formato válido")
  .refine(
    (correo: string) =>
      correo.toLowerCase().endsWith(DOMINIO_INSTITUCIONAL),
    {
      message:
        "El correo debe pertenecer al dominio institucional @iestpsuiza.edu.pe",
    },
  );

/**
 * GET /api/v1/admin/usuarios
 *
 * Filtros y paginación del directorio institucional.
 */
export const listarUsuariosQuerySchema = z.object({
  busqueda: z
    .string()
    .trim()
    .max(150, "La búsqueda no puede superar los 150 caracteres")
    .optional(),

  areaId: z
    .string()
    .uuid("El ID del área no es válido")
    .optional(),

  area: z.string().optional(),

  sedeId: z
    .string()
    .uuid("El ID de la sede no es válido")
    .optional(),

  sede: z.string().optional(),

  rolId: z
    .string()
    .uuid("El ID del rol no es válido")
    .optional(),

  rol: z.string().optional(),

  estado: z.preprocess((val) => {
    if (typeof val === "string") return val.toUpperCase();
    return val;
  }, estadoUsuarioSchema).optional(),

  pagina: z.coerce
    .number()
    .int()
    .positive("La página debe ser mayor que cero")
    .default(1),

  limite: z.coerce
    .number()
    .int()
    .min(1, "El límite mínimo es 1")
    .max(100, "El límite máximo es 100")
    .default(20),
});

/**
 * POST /api/v1/admin/usuarios
 *
 * Datos requeridos para registrar un usuario institucional.
 */
export const crearUsuarioAdminSchema = z.object({
  tipoDocumentoId: z.coerce
    .number()
    .int()
    .positive("El tipo de documento es obligatorio")
    .optional()
    .default(1),

  numeroDocumento: z
    .string()
    .trim()
    .min(8, "El documento debe tener al menos 8 caracteres")
    .max(20, "El documento no puede superar los 20 caracteres")
    .optional(),

  dni: z
    .string()
    .trim()
    .min(8, "El DNI debe tener al menos 8 caracteres")
    .max(20, "El DNI no puede superar los 20 caracteres")
    .optional(),

  nombres: z
    .string()
    .trim()
    .min(2, "Los nombres son obligatorios")
    .max(120, "Los nombres no pueden superar los 120 caracteres")
    .optional(),

  nombre: z
    .string()
    .trim()
    .min(2, "El nombre completo es obligatorio")
    .max(150, "El nombre no puede superar los 150 caracteres")
    .optional(),

  apellidoPaterno: z
    .string()
    .trim()
    .min(2, "El apellido paterno es obligatorio")
    .max(120, "El apellido paterno no puede superar los 120 caracteres")
    .optional(),

  apellidoMaterno: z
    .string()
    .trim()
    .max(120, "El apellido materno no puede superar los 120 caracteres")
    .optional()
    .nullable(),

  telefono: z
    .string()
    .trim()
    .max(20, "El teléfono no puede superar los 20 caracteres")
    .optional()
    .nullable(),

  correo: correoInstitucionalSchema,

  username: z
    .string()
    .trim()
    .min(4, "El usuario debe tener al menos 4 caracteres")
    .max(50, "El usuario no puede superar los 50 caracteres")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "El usuario solo puede contener letras, números, punto, guion y guion bajo",
    )
    .optional(),

  usuario: z
    .string()
    .trim()
    .min(4, "El usuario debe tener al menos 4 caracteres")
    .max(50, "El usuario no puede superar los 50 caracteres")
    .optional(),

  passwordInicial: z
    .string()
    .min(8, "La contraseña inicial debe tener al menos 8 caracteres")
    .max(128, "La contraseña no puede superar los 128 caracteres")
    .optional(),

  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña no puede superar los 128 caracteres")
    .optional(),

  puestoLaboralId: z
    .string()
    .uuid("El ID del puesto laboral no es válido")
    .optional(),

  cargoId: z.string().optional().nullable(),
  cargo: z.string().optional().nullable(),

  areaId: z.string().optional().nullable(),
  area: z.string().optional().nullable(),

  rolId: z
    .string()
    .uuid("El ID del rol no es válido")
    .optional(),

  rol: z.string().optional().nullable(),

  sede: z.string().optional().nullable(),

  estado: z.preprocess((val) => {
    if (typeof val === "string") return val.toUpperCase();
    return val;
  }, estadoUsuarioSchema).optional().default("ACTIVO"),
}).refine(
  (data) => !!(data.numeroDocumento || data.dni),
  {
    message: "El número de documento es obligatorio",
    path: ["numeroDocumento"],
  },
).refine(
  (data) => !!(data.nombres || data.nombre),
  {
    message: "El nombre o nombres son obligatorios",
    path: ["nombres"],
  },
);

/**
 * Schema base para actualización.
 */
const actualizarUsuarioAdminBaseSchema = z.object({
  nombre: z.string().trim().min(2).max(150).optional(),
  nombres: z
    .string()
    .trim()
    .min(2, "Los nombres deben tener al menos 2 caracteres")
    .max(120, "Los nombres no pueden superar los 120 caracteres")
    .optional(),

  apellidoPaterno: z
    .string()
    .trim()
    .min(2, "El apellido paterno debe tener al menos 2 caracteres")
    .max(120, "El apellido paterno no puede superar los 120 caracteres")
    .optional(),

  apellidoMaterno: z
    .string()
    .trim()
    .max(120, "El apellido materno no puede superar los 120 caracteres")
    .optional()
    .nullable(),

  dni: z.string().trim().min(8).max(20).optional(),

  telefono: z
    .string()
    .trim()
    .max(20, "El teléfono no puede superar los 20 caracteres")
    .optional()
    .nullable(),

  correo: correoInstitucionalSchema.optional(),

  puestoLaboralId: z
    .string()
    .uuid("El ID del puesto laboral no es válido")
    .optional(),

  cargoId: z.string().optional().nullable(),
  cargo: z.string().trim().optional().nullable(),

  areaId: z
    .string()
    .uuid("El ID del área no es válido")
    .optional(),

  area: z.string().trim().optional().nullable(),

  rolId: z
    .string()
    .uuid("El ID del rol no es válido")
    .optional(),

  rol: z.string().trim().optional().nullable(),

  sede: z.string().trim().optional().nullable(),

  estado: z.preprocess((val) => {
    if (typeof val === "string") return val.toUpperCase();
    return val;
  }, estadoUsuarioSchema).optional(),
});

/**
 * PUT /api/v1/admin/usuarios/:id
 *
 * Debe enviarse al menos un campo para actualizar.
 */
export const actualizarUsuarioAdminSchema =
  actualizarUsuarioAdminBaseSchema.refine(
    (
      datos: z.infer<typeof actualizarUsuarioAdminBaseSchema>,
    ) => Object.keys(datos).length > 0,
    {
      message: "Debe enviar al menos un campo para actualizar",
    },
  );

/**
 * Parámetro :id del usuario.
 * Acepta tanto identificadores enteros positivos como identificadores UUID estándar.
 */
export const usuarioIdParamSchema = z.object({
  id: z.preprocess((val) => {
    if (typeof val === "string") {
      const limpia = val.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(limpia)) {
        return limpia;
      }
      const num = Number(limpia);
      if (Number.isInteger(num)) return num;
    }
    return val;
  }, z.union([
    z.string().uuid("El ID del usuario no es un UUID válido"),
    z.number().int("El ID del usuario debe ser un número entero").positive("El ID del usuario debe ser mayor que cero"),
  ])),
});

/* =========================================================
 * TIPOS TYPESCRIPT
 * ========================================================= */

export type EstadoUsuario = z.infer<
  typeof estadoUsuarioSchema
>;

export type ListarUsuariosQuery = z.infer<
  typeof listarUsuariosQuerySchema
>;

export type CrearUsuarioAdminDTO = z.input<
  typeof crearUsuarioAdminSchema
>;

export type ActualizarUsuarioAdminDTO = z.infer<
  typeof actualizarUsuarioAdminSchema
>;

export type UsuarioIdParam = z.infer<
  typeof usuarioIdParamSchema
>;

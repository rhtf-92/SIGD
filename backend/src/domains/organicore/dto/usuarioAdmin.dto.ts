import { z } from "zod";

/**
 * OrganiCore - Administración de usuarios institucionales
 * Responsable: Leonardo
 * Rama: B_LEONARDO
 *
 * Tareas relacionadas:
 * - T-BE-OC-06: Directorio institucional
 * - T-BE-OC-07: Validación de correo institucional
 */

/**
 * Estados funcionales del usuario.
 */
export const estadoUsuarioSchema = z.enum([
  "ACTIVO",
  "INACTIVO",
  "BLOQUEADO",
]);

/**
 * Validación de correo electrónico para cuentas de usuario.
 * Admite dominios institucionales y personales (Gmail, Outlook, Hotmail, Yahoo, etc.).
 * Normaliza espacios y mayúsculas/minúsculas.
 */
export const correoUsuarioSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("El correo electrónico no tiene un formato válido")
  .max(254, "El correo electrónico no puede superar los 254 caracteres");

export const correoInstitucionalSchema = correoUsuarioSchema;

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

  sedeId: z
    .string()
    .uuid("El ID de la sede no es válido")
    .optional(),

  rolId: z
    .string()
    .uuid("El ID del rol no es válido")
    .optional(),

  estado: estadoUsuarioSchema.optional(),
  motivo: z.string().trim().max(500, 'El motivo no puede superar los 500 caracteres').optional(),

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
}).strict();

/**
 * POST /api/v1/admin/usuarios
 *
 * Datos requeridos para registrar un usuario institucional.
 */
export const crearUsuarioAdminSchema = z.object({
  tipoDocumentoId: z.coerce
    .number()
    .int()
    .positive("El tipo de documento es obligatorio").max(32767),

  numeroDocumento: z
    .string()
    .trim()
    .min(8, "El documento debe tener al menos 8 caracteres")
    .max(20, "El documento no puede superar los 20 caracteres"),

  nombres: z
    .string()
    .trim()
    .min(2, "Los nombres son obligatorios")
    .max(120, "Los nombres no pueden superar los 120 caracteres"),

  apellidoPaterno: z
    .string()
    .trim()
    .min(2, "El apellido paterno es obligatorio")
    .max(120, "El apellido paterno no puede superar los 120 caracteres"),

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

  correo: correoUsuarioSchema,

  username: z
    .string()
    .trim()
    .min(4, "El usuario debe tener al menos 4 caracteres")
    .max(50, "El usuario no puede superar los 50 caracteres")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "El usuario solo puede contener letras, números, punto, guion y guion bajo",
    ),

  passwordInicial: z
    .string()
    .min(8, "La contraseña inicial debe tener al menos 8 caracteres")
    .max(128, "La contraseña no puede superar los 128 caracteres"),

  puestoLaboralId: z
    .string()
    .uuid("El ID del puesto laboral no es válido").optional(),
  cargoId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),

  rolId: z
    .string()
    .uuid("El ID del rol no es válido")
    .optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).default("INACTIVO"),
}).strict().superRefine((datos, ctx) => {
  if (!datos.puestoLaboralId && (!datos.cargoId || !datos.areaId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cargoId'], message: 'Seleccione cargo y área existentes.' });
  }
  if ([datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ').length > 120) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['apellidoPaterno'], message: 'Los apellidos completos no pueden superar 120 caracteres.' });
  }
});

export const restablecerCredencialesAdminSchema = z.object({
  passwordInicial: z.string().min(12, "La contraseña temporal debe tener al menos 12 caracteres.").max(128),
}).strict();

/**
 * Schema base para actualización.
 */
const actualizarUsuarioAdminBaseSchema = z.object({
  apellidos: z.string().trim().min(2).max(120).optional(),
  cargoId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  asignacionId: z.string().uuid().optional(),
  usuarioRolId: z.string().uuid().optional(),
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

  telefono: z
    .string()
    .trim()
    .max(20, "El teléfono no puede superar los 20 caracteres")
    .optional()
    .nullable(),

  correo: correoUsuarioSchema.optional(),

  puestoLaboralId: z
    .string()
    .uuid("El ID del puesto laboral no es válido")
    .optional(),

  rolId: z
    .string()
    .uuid("El ID del rol no es válido")
    .optional(),

  estado: estadoUsuarioSchema.optional(),
}).strict();

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
 *
 * Clave original: sigd_auth.cuenta_usuario.id_usuario UUID.
 */
export const usuarioIdParamSchema = z.object({
  id: z.string().uuid("El ID del usuario debe ser un UUID válido"),
});

export const asignarRolUsuarioSchema = z.object({
  rolId: z.string().uuid("El ID del rol debe ser un UUID válido"),
}).strict();

export const revocarRolParamSchema = z.object({
  id: z.string().uuid("El ID del usuario debe ser un UUID válido"),
  usuarioRolId: z.string().uuid("El ID de asignación debe ser un UUID válido"),
}).strict();

export const asignarCapacidadUsuarioSchema = z.object({
  capacidadCodigo: z.string().min(3).max(64),
  areaId: z.string().uuid("El ID del área debe ser un UUID válido"),
  justificacion: z.string().min(10).max(500).optional(),
}).strict();

export const revocarCapacidadParamSchema = z.object({
  id: z.string().uuid("El ID del usuario debe ser un UUID válido"),
  usuarioCapacidadId: z.string().uuid("El ID de capacidad debe ser un UUID válido"),
}).strict();

export type AsignarRolUsuarioDTO = z.infer<typeof asignarRolUsuarioSchema>;
export type AsignarCapacidadUsuarioDTO = z.infer<typeof asignarCapacidadUsuarioSchema>;

/* =========================================================
 * TIPOS TYPESCRIPT
 * ========================================================= */

export type EstadoUsuario = z.infer<
  typeof estadoUsuarioSchema
>;

export type ListarUsuariosQuery = z.infer<
  typeof listarUsuariosQuerySchema
>;

export type CrearUsuarioAdminDTO = z.infer<
  typeof crearUsuarioAdminSchema
>;

export type ActualizarUsuarioAdminDTO = z.infer<
  typeof actualizarUsuarioAdminSchema
>;

export type UsuarioIdParam = z.infer<
  typeof usuarioIdParamSchema
>;

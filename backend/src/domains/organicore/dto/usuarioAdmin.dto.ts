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

const DOMINIO_INSTITUCIONAL = "@iestpsuiza.edu.pe";

/**
 * Patrón UUID universal compatible con PostgreSQL y fixtures deterministas.
 */
export const uuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const uuidSchema = z
  .string()
  .trim()
  .regex(uuidPattern, "El identificador no es un UUID válido");

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

  areaId: uuidSchema.optional(),

  sedeId: uuidSchema.optional(),

  rolId: uuidSchema.optional(),

  estado: z.preprocess(
    (val) => (typeof val === "string" ? val.toUpperCase() : val),
    estadoUsuarioSchema.optional(),
  ),

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
 * Schema para alta de usuario institucional administrativo (+ Nuevo usuario).
 */
export const nuevoUsuarioInstitucionalSchema = z.object({
  tipoDocumento: z.string().default('DNI'),
  numeroDocumento: z.string().min(8, 'El documento debe tener al menos 8 dígitos').max(20),
  nombres: z.string().min(2, 'Los nombres deben tener al menos 2 caracteres'),
  apellidos: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres'),
  correo: z.string().email('Correo electrónico no válido'),
  usuario: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rolId: z.string().min(1, 'El rol es obligatorio'),
  areaId: uuidSchema.optional().nullable(),
  activo: z.boolean().default(true),
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
    .positive("El tipo de documento es obligatorio"),

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

  correo: correoInstitucionalSchema,

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

  puestoLaboralId: uuidSchema,

  rolId: uuidSchema,
});

/**
 * Schema base para actualización.
 */
const actualizarUsuarioAdminBaseSchema = z.object({
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

  apellidos: z
    .string()
    .trim()
    .min(2, "Los apellidos deben tener al menos 2 caracteres")
    .max(240, "Los apellidos no pueden superar los 240 caracteres")
    .optional(),

  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(240, "El nombre no puede superar los 240 caracteres")
    .optional(),

  telefono: z
    .string()
    .trim()
    .max(20, "El teléfono no puede superar los 20 caracteres")
    .optional()
    .nullable(),

  correo: correoInstitucionalSchema.optional(),

  puestoLaboralId: uuidSchema.optional(),

  rolId: z
    .string()
    .min(1, "El ID del rol no es válido")
    .optional(),

  rol: z
    .string()
    .trim()
    .max(100)
    .optional(),

  areaId: uuidSchema.optional(),

  area: z
    .string()
    .trim()
    .max(150)
    .optional(),

  cargoId: uuidSchema.optional(),

  cargo: z
    .string()
    .trim()
    .max(150)
    .optional(),

  sede: z
    .string()
    .trim()
    .max(150)
    .optional()
    .nullable(),

  activo: z
    .boolean()
    .optional(),

  estado: z.preprocess(
    (val) => (typeof val === "string" ? val.toUpperCase() : val),
    estadoUsuarioSchema.optional(),
  ),
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
 *
 * Soporta identificadores UUID y enteros numéricos.
 */
export const usuarioIdParamSchema = z.object({
  id: z.union([
    uuidSchema,
    z.coerce
      .number()
      .int("El ID del usuario debe ser un número entero")
      .positive("El ID del usuario debe ser mayor que cero"),
  ]),
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

export type NuevoUsuarioInstitucionalDTO = z.infer<
  typeof nuevoUsuarioInstitucionalSchema
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

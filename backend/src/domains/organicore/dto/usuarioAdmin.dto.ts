import { z } from 'zod';

const DOMINIO_INSTITUCIONAL = '@iestpsuiza.edu.pe';
const uuid = (mensaje: string) => z.string().uuid(mensaje);

export const estadoUsuarioSchema = z.enum(['ACTIVO', 'INACTIVO', 'BLOQUEADO']);
const listaRolesSchema = z.array(uuid('El ID del rol no es válido')).max(20).transform((roles) => [...new Set(roles)]);

export const correoInstitucionalSchema = z
  .string()
  .trim()
  .email('El correo electrónico no tiene un formato válido')
  .refine((correo) => correo.toLowerCase().endsWith(DOMINIO_INSTITUCIONAL), {
    message: 'El correo debe pertenecer al dominio institucional @iestpsuiza.edu.pe',
  });

export const listarUsuariosQuerySchema = z
  .object({
    busqueda: z.string().trim().max(150).optional(),
    areaId: uuid('El ID del área no es válido').optional(),
    rolId: uuid('El ID del rol no es válido').optional(),
    estado: estadoUsuarioSchema.optional(),
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

// Se conserva el contrato del POST existente, ya alineado con las claves UUID
// canónicas. El alta completa no forma parte de esta entrega.
export const crearUsuarioAdminSchema = z
  .object({
    tipo: z.enum(['NATURAL', 'JURIDICA']).default('NATURAL'),
    numeroDocumento: z.string().trim().min(8).max(20),
    nombres: z.string().trim().min(2).max(120),
    apellidos: z.string().trim().min(2).max(120),
    telefono: z.string().trim().max(20).optional().nullable(),
    correo: correoInstitucionalSchema,
    username: z.string().trim().min(4).max(60).regex(/^[a-zA-Z0-9._-]+$/),
    passwordInicial: z.string().min(8).max(128),
    areaId: uuid('El ID del área no es válido'),
    cargoId: uuid('El ID del cargo no es válido'),
    rolId: uuid('El ID del rol no es válido').optional(),
    rolIds: listaRolesSchema.optional(),
  })
  .strict()
  .refine((datos) => Boolean(datos.rolId) || Boolean(datos.rolIds?.length), {
    message: 'Debe asignar al menos un rol',
    path: ['rolIds'],
  });

const actualizarUsuarioAdminBaseSchema = z
  .object({
    nombres: z.string().trim().min(2).max(120).optional(),
    apellidos: z.string().trim().min(2).max(120).optional(),
    telefono: z.string().trim().max(20).optional().nullable(),
    correo: correoInstitucionalSchema.optional(),
    areaId: uuid('El ID del área no es válido').optional(),
    cargoId: uuid('El ID del cargo no es válido').optional(),
    rolId: uuid('El ID del rol no es válido').optional(),
    rolesAgregar: listaRolesSchema.optional(),
    rolesQuitar: listaRolesSchema.optional(),
    estado: estadoUsuarioSchema.optional(),
  })
  .strict();

export const actualizarUsuarioAdminSchema = actualizarUsuarioAdminBaseSchema.refine(
  (datos) => Object.keys(datos).length > 0,
  { message: 'Debe enviar al menos un campo para actualizar' },
).superRefine((datos, contexto) => {
  const agregar = new Set(datos.rolesAgregar ?? []);
  for (const rolId of datos.rolesQuitar ?? []) {
    if (agregar.has(rolId)) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rolesQuitar'],
        message: 'Un rol no puede agregarse y retirarse en la misma operación',
      });
    }
  }
});

export const usuarioIdParamSchema = z
  .object({ id: uuid('El ID del usuario no es un UUID válido') })
  .strict();

export type EstadoUsuario = z.infer<typeof estadoUsuarioSchema>;
export type ListarUsuariosQuery = z.infer<typeof listarUsuariosQuerySchema>;
export type CrearUsuarioAdminDTO = z.infer<typeof crearUsuarioAdminSchema>;
export type ActualizarUsuarioAdminDTO = z.infer<typeof actualizarUsuarioAdminSchema>;
export type UsuarioIdParam = z.infer<typeof usuarioIdParamSchema>;

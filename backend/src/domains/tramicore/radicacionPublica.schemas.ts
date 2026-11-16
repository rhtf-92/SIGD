import { z } from 'zod';
import { radicacionVirtualSchema } from './tramites.schemas.js';

// Additive public contract: legal acceptance and separate name fields are
// required on the server, not inferred from a checkbox rendered in React.
export const radicacionPublicaSchema = radicacionVirtualSchema.innerType().extend({
  nombres: z.string().trim().min(2).max(120),
  apellidos: z.string().trim().min(2).max(120),
  telefono: z.string().regex(/^\d{7,12}$/),
  declaracionVeracidad: z.literal(true),
  aceptaTerminos: z.literal(true),
}).strict().superRefine((dato, ctx) => {
  const { nombres, apellidos, telefono, declaracionVeracidad, aceptaTerminos, ...base } = dato;
  const validacionBase = radicacionVirtualSchema.safeParse(base);
  if (!validacionBase.success) for (const issue of validacionBase.error.issues) ctx.addIssue(issue);
  if (dato.tipoDocumento === 'RUC') ctx.addIssue({ code: 'custom', path: ['tipoDocumento'], message: 'La representación de personas jurídicas requiere validación institucional; utilice ventanilla.' });
  const numeroValido = dato.tipoDocumento === 'DNI' ? /^\d{8}$/ : /^[A-Za-z0-9]{6,12}$/;
  if (!numeroValido.test(dato.numeroDocumento)) ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: 'Documento de identidad inválido.' });
  if (dato.nombreSolicitante !== `${dato.nombres} ${dato.apellidos}`.trim()) ctx.addIssue({ code: 'custom', path: ['nombreSolicitante'], message: 'Los nombres declarados no son consistentes.' });
  if (dato.documentos.length > 5 || dato.documentos.reduce((s, d) => s + d.tamanoBytes, 0) > 50 * 1024 * 1024 || dato.documentos.some(d => d.contentType !== 'application/pdf')) {
    ctx.addIssue({ code: 'custom', path: ['documentos'], message: 'Se admiten hasta 5 PDF y 50 MiB en total.' });
  }
});
export type RadicacionPublicaInput = z.infer<typeof radicacionPublicaSchema>;

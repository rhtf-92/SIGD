import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { validarDni, validarRuc } from './modulo11.validator.js';
import {
  aceptarCasingDual,
  registroCiudadanoSchema,
  registroPersonaJuridicaSchema,
  validarDocumentoQuerySchema,
} from './registro.schemas.js';
import { RegistroCiudadanoService } from './registroCiudadano.service.js';
import { UbigeoService, type CacheDistribuida } from './ubigeo.service.js';

const provinciaQuerySchema = z.preprocess(
  (value: unknown) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
    const query: Record<string, unknown> = { ...value };
    if ('provincia_codigo' in query && !('provinciaCodigo' in query)) {
      query.provinciaCodigo = query.provincia_codigo;
      delete query.provincia_codigo;
    }
    return query;
  },
  z.object({ provinciaCodigo: z.string().regex(/^250[1-4]$/).optional() }).strict(),
);

export function crearRouterIdenticore(pool: Pool, cache?: CacheDistribuida): Router {
  const router = Router();
  const ubigeoService = new UbigeoService(pool, cache);
  const registroService = new RegistroCiudadanoService(pool, ubigeoService);

  router.get('/auth/validar-documento', (req, res) => {
    const query = validarDocumentoQuerySchema.parse(req.query);
    const resultado = query.tipoDocumento === 'DNI'
      ? validarDni(query.numeroDocumento)
      : validarRuc(query.numeroDocumento);
    res.status(200).json(resultado);
  });

  router.post('/auth/registro-ciudadano', async (req, res) => {
    try {
      const datos = registroCiudadanoSchema.parse(req.body);
      const registro = await registroService.registrarCiudadano(datos, req.ip ?? null);
      res.status(201).json(registro);
    } catch (error: any) {
      const esValidacion = error?.name === 'ZodError' || error?.code === 'VALIDATION_ERROR' || error?.status === 400 || error?.status === 422;
      const esConflicto = error?.code === '23505' || error?.code === 'CITIZEN_ALREADY_EXISTS' || error?.status === 409;
      if (esValidacion || esConflicto) {
        const detail =
          error?.issues?.map((i: any) => `${(i.path ?? []).join('.')}: ${i.message}`).join('; ') ||
          error?.detail || error?.message || 'Datos de registro inválidos.';
        res.status(esConflicto ? 409 : 400).json({
          type: 'https://sigd.iestpsuiza.edu.pe/errors/validation',
          title: esConflicto ? 'Conflicto de registro' : 'Error de validación',
          status: esConflicto ? 409 : 400,
          detail,
          invalidParams: error?.issues?.map((i: any) => ({ name: (i.path ?? []).join('.'), reason: i.message })),
        });
        return;
      }
      console.error('[auth/registro-ciudadano]', error);
      res.status(200).json({
        ok: false,
        status: 503,
        detail: 'No fue posible completar el registro en este momento. Verifique que la base de datos esté disponible e intente nuevamente.',
      });
    }
  });

  router.post('/auth/registro-persona-juridica', async (req, res) => {
    try {
      const datos = registroPersonaJuridicaSchema.parse(aceptarCasingDual(req.body));
      const registro = await registroService.registrarPersonaJuridica(datos, req.ip ?? null);
      res.status(201).json(registro);
    } catch (error: any) {
      const esValidacion = error?.name === 'ZodError' || error?.code === 'VALIDATION_ERROR' || error?.status === 400 || error?.status === 422;
      const esConflicto = error?.code === '23505' || error?.code === 'CITIZEN_ALREADY_EXISTS' || error?.status === 409;
      if (esValidacion || esConflicto) {
        const detail =
          error?.issues?.map((i: any) => `${(i.path ?? []).join('.')}: ${i.message}`).join('; ') ||
          error?.detail || error?.message || 'Datos de registro inválidos.';
        res.status(esConflicto ? 409 : 400).json({
          type: 'https://sigd.iestpsuiza.edu.pe/errors/validation',
          title: esConflicto ? 'Conflicto de registro' : 'Error de validación',
          status: esConflicto ? 409 : 400,
          detail,
          invalidParams: error?.issues?.map((i: any) => ({ name: (i.path ?? []).join('.'), reason: i.message })),
        });
        return;
      }
      console.error('[auth/registro-persona-juridica]', error);
      res.status(200).json({
        ok: false,
        status: 503,
        detail: 'No fue posible completar el registro en este momento. Verifique que la base de datos esté disponible e intente nuevamente.',
      });
    }
  });

  router.get('/ubigeo/distritos-ucayali', async (req, res) => {
    const query = provinciaQuerySchema.parse(req.query);
    const provincias = await ubigeoService.obtenerDistritosUcayali(query.provinciaCodigo);
    res.status(200).json({ provincias });
  });

  return router;
}
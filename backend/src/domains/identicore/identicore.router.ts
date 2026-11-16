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
import { IdentidadOtpService, type AlmacenOtp, type EntregaOtp } from './identidadOtp.service.js';
import { crearEntregaOtpSmtp } from './otpSmtp.js';
import { NotFoundError } from '../../shared/domain/errors/index.js';

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

export function crearRouterIdenticore(pool: Pool, cache?: CacheDistribuida,
  otp: { almacen?: AlmacenOtp; entrega?: EntregaOtp } = {}): Router {
  const router = Router();
  const ubigeoService = new UbigeoService(pool, cache);
  const identidadOtp = new IdentidadOtpService(pool, otp.almacen, otp.entrega ?? crearEntregaOtpSmtp());
  const registroService = new RegistroCiudadanoService(pool, ubigeoService, identidadOtp);

  router.get('/auth/registro-capacidades', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await registroService.capacidadesRegistro());
  });
  router.post('/auth/verificacion-contacto/iniciar', async (req, res) => {
    const datos = z.object({ tipoDocumento: z.enum(['DNI', 'CE']),
      numeroDocumento: z.string().regex(/^(?:[0-9]{8}|[A-Z0-9]{9,12})$/),
      nombres: z.string().trim().min(2).max(120), apellidos: z.string().trim().min(2).max(240),
    }).strict().superRefine((v, c) => {
      if (v.tipoDocumento === 'DNI' && !/^[0-9]{8}$/.test(v.numeroDocumento))
        c.addIssue({ code: 'custom', path: ['numeroDocumento'], message: 'Documento incompatible.' });
      if (v.tipoDocumento === 'CE' && !/^[A-Z0-9]{9,12}$/.test(v.numeroDocumento))
        c.addIssue({ code: 'custom', path: ['numeroDocumento'], message: 'Documento incompatible.' });
    }).parse(req.body);
    res.setHeader('Cache-Control', 'no-store');
    res.status(202).json(await identidadOtp.iniciar(datos, req.ip ?? 'unknown'));
  });
  router.post('/auth/verificacion-contacto/confirmar', async (req, res) => {
    const datos = z.object({ desafio: z.string().uuid(), codigo: z.string().regex(/^[0-9]{6}$/) }).strict().parse(req.body);
    res.setHeader('Cache-Control', 'no-store');
    res.json(await identidadOtp.verificar(datos.desafio, datos.codigo, req.ip ?? 'unknown'));
  });

  router.get('/auth/validar-documento', (req, res) => {
    const query = validarDocumentoQuerySchema.parse(req.query);
    const resultado = query.tipoDocumento === 'DNI'
      ? validarDni(query.numeroDocumento)
      : validarRuc(query.numeroDocumento);
    res.status(200).json(resultado);
  });

  router.post('/auth/registro-ciudadano', async (req, res) => {
    const datos = registroCiudadanoSchema.parse(req.body);
    const registro = await registroService.registrarCiudadano(datos, req.ip ?? null);
    res.status(201).json(registro);
  });

  router.post('/auth/activar-cuenta', async (req, res) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.body);
    const resultado = await registroService.activarCuenta(token, req.ip ?? null);
    res.status(200).json(resultado);
  });

  router.get('/auth/activar-cuenta', async (req, res) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.query);
    const resultado = await registroService.activarCuenta(token, req.ip ?? null);
    res.status(200).json(resultado);
  });

  router.post('/auth/reenviar-verificacion', async (req, res) => {
    const { identificador } = z.object({ identificador: z.string().min(3) }).parse(req.body);
    const resultado = await registroService.reenviarVerificacion(identificador, req.ip ?? null);
    res.status(200).json(resultado);
  });

  router.post('/auth/registro-persona-juridica', async (req, res) => {
    const datos = registroPersonaJuridicaSchema.parse(aceptarCasingDual(req.body));
    const registro = await registroService.registrarPersonaJuridica(datos, req.ip ?? null);
    res.status(201).json(registro);
  });

  // Catálogo Geográfico Nacional (UBIGEO INEI)
  router.get('/ubigeo/departamentos', async (_req, res) => {
    const departamentos = await ubigeoService.obtenerDepartamentos();
    res.status(200).json(departamentos);
  });

  router.get('/ubigeo/provincias', async (req, res) => {
    const departamentoCodigo = typeof req.query.departamentoCodigo === 'string'
      ? req.query.departamentoCodigo
      : typeof req.query.departamento_codigo === 'string'
        ? req.query.departamento_codigo
        : undefined;
    const provincias = await ubigeoService.obtenerProvincias(departamentoCodigo);
    res.status(200).json(provincias);
  });

  router.get('/ubigeo/distritos', async (req, res) => {
    const provinciaCodigo = typeof req.query.provinciaCodigo === 'string'
      ? req.query.provinciaCodigo
      : typeof req.query.provincia_codigo === 'string'
        ? req.query.provincia_codigo
        : undefined;
    const departamentoCodigo = typeof req.query.departamentoCodigo === 'string'
      ? req.query.departamentoCodigo
      : typeof req.query.departamento_codigo === 'string'
        ? req.query.departamento_codigo
        : undefined;
    const distritos = await ubigeoService.obtenerDistritos(provinciaCodigo, departamentoCodigo);
    res.status(200).json(distritos);
  });

  router.get('/ubigeo/detalle/:codigo', async (req, res) => {
    const detalle = await ubigeoService.obtenerDetalleUbigeo(req.params.codigo);
    if (!detalle) {
      throw new NotFoundError({ detail: 'Código UBIGEO no encontrado en el catálogo oficial.' });
    }
    res.status(200).json(detalle);
  });

  // Compatibilidad histórica Ucayali
  router.get('/ubigeo/distritos-ucayali', async (req, res) => {
    const query = provinciaQuerySchema.parse(req.query);
    const provincias = await ubigeoService.obtenerDistritosUcayali(query.provinciaCodigo);
    res.status(200).json({ provincias });
  });

  return router;
}

import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';
import { ForbiddenError, UnauthorizedError } from '../../shared/domain/errors/index.js';
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

const registrosCiudadanosQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

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
    const datos = registroCiudadanoSchema.parse(req.body);
    const registro = await registroService.registrarCiudadano(datos, req.ip ?? null);
    res.status(201).json(registro);
  });

  router.post('/auth/registro-persona-juridica', async (req, res) => {
    const datos = registroPersonaJuridicaSchema.parse(aceptarCasingDual(req.body));
    const registro = await registroService.registrarPersonaJuridica(datos, req.ip ?? null);
    res.status(201).json(registro);
  });

  router.get('/auth/registro-ciudadanos', async (req, res) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) {
      throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
    }

    const claims = verificarTokenAcceso(token);
    if (!claims.roles.some((rol) => ['ADMINISTRADOR', 'SUPER_ADMIN', 'DIRECTOR'].includes(rol))) {
      throw new ForbiddenError({
        detail: 'Solo el personal autorizado puede consultar los registros ciudadanos.',
      });
    }

    const { pagina, porPagina } = registrosCiudadanosQuerySchema.parse(req.query);
    const offset = (pagina - 1) * porPagina;
    const resultado = await pool.query<{
      id_persona: string;
      tipo: 'NATURAL' | 'JURIDICA';
      tipo_documento: string | null;
      id_documento: string;
      nombre_completo: string;
      correo: string | null;
      telefono: string | null;
      direccion: string | null;
      ubigeo_distrito: string | null;
      referencia_domicilio: string | null;
      fecha_nacimiento: string | null;
      razon_social: string | null;
      representante_legal: string | null;
      representante_tipo_documento: string | null;
      representante_documento: string | null;
      representante_cargo: string | null;
      partida_registral_sunarp: string | null;
      declaracion_jurada_aceptada: boolean;
      consentimiento_ley_29733: boolean;
      acepta_notificaciones: boolean;
      creado_en: string;
      total: string;
    }>(
      `SELECT p.id_persona::text AS id_persona,
              p.tipo,
              td.codigo AS tipo_documento,
              p.id_documento,
              COALESCE(pn.nombre_completo, pj.razon_social) AS nombre_completo,
              COALESCE(pn.correo, pj.correo_contacto, u.correo) AS correo,
              COALESCE(pn.telefono, pj.telefono_contacto) AS telefono,
              p.direccion,
              p.ubigeo_distrito,
              p.referencia_domicilio,
              pn.fecha_nacimiento::text AS fecha_nacimiento,
              pj.razon_social,
              pj.representante_legal,
              pj.representante_tipo_documento,
              pj.representante_documento,
              pj.representante_cargo,
              pj.partida_registral_sunarp,
              COALESCE(consentimientos.declaracion_jurada_aceptada, FALSE) AS declaracion_jurada_aceptada,
              COALESCE(consentimientos.consentimiento_ley_29733, FALSE) AS consentimiento_ley_29733,
              COALESCE(consentimientos.acepta_notificaciones, FALSE) AS acepta_notificaciones,
              p.creado_en::text AS creado_en,
              COUNT(*) OVER()::text AS total
         FROM sigd_auth.persona p
         JOIN sigd_auth.cuenta_usuario u ON u.id_persona = p.id_persona
         LEFT JOIN sigd_auth.tipos_documento td ON td.id_tipo_documento = p.id_tipo_documento
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
         LEFT JOIN LATERAL (
           SELECT BOOL_OR(aceptado) FILTER (
                    WHERE finalidade = 'Declaración jurada de veracidad'
                  ) AS declaracion_jurada_aceptada,
                  BOOL_OR(aceptado) FILTER (
                    WHERE finalidade = 'Tratamiento de datos personales (Ley N.° 29733)'
                  ) AS consentimiento_ley_29733,
                  BOOL_OR(aceptado) FILTER (
                    WHERE finalidade = 'Notificaciones electrónicas'
                  ) AS acepta_notificaciones
             FROM sigd_auth.consentimiento_datos
            WHERE id_persona = p.id_persona
         ) consentimientos ON TRUE
        WHERE EXISTS (
          SELECT 1
            FROM sigd_org.usuario_rol ur
            JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
           WHERE ur.id_usuario = u.id_usuario
             AND r.codigo = 'CIUDADANO'
             AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        )
        ORDER BY p.creado_en DESC, p.id_persona
        LIMIT $1 OFFSET $2`,
      [porPagina, offset],
    );

    const total = Number(resultado.rows[0]?.total ?? 0);
    const registros = resultado.rows.map(({ total: _total, ...registro }) => registro);
    res.status(200).json({
      total,
      pagina,
      porPagina,
      totalPaginas: Math.ceil(total / porPagina),
      registros,
    });
  });

  router.get('/ubigeo/distritos-ucayali', async (req, res) => {
    const query = provinciaQuerySchema.parse(req.query);
    const provincias = await ubigeoService.obtenerDistritosUcayali(query.provinciaCodigo);
    res.status(200).json({ provincias });
  });

  return router;
}
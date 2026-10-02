import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { contextMiddleware } from '../../../../src/middleware/context-middleware.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import {
  conectarActor,
  crearAutenticacionRbac,
  requirePermission,
} from '../../../../src/middleware/rbac.middleware.js';
import {
  crearRbacService,
  crearRouterRbac,
} from '../../../../src/domains/organicore/rbac.controller.js';
import {
  RbacService,
  AGREGADO_RBAC,
  TIPO_EVENTO_RBAC_MODIFICADA,
} from '../../../../src/domains/organicore/rbac.service.js';
import { DestinoRbacInvalidacion } from '../../../../src/domains/organicore/rbac.outbox.destino.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import {
  crearBdFalsa,
  crearCacheFalsa,
  crearEstadoRbac,
  comoClienteSql,
  CUENTA_ADMIN,
  CUENTA_ESTUDIANTE,
  CUENTA_SIN_ROL,
  type BdFalsa,
  type CacheFalsa,
  type EstadoRbac,
} from '../../../helpers/rbac.helper.js';

const PERMISOS_ESTUDIANTE = [
  'radicacion.registrar',
  'expediente.ver',
  'adjunto.adjuntar',
  'adjunto.descargar',
  'firma.solicitar',
  'firma.ver',
  'reporte.ver',
];

const PERMISOS_DOCENTE = [
  'expediente.ver',
  'atencion.atender',
  'firma.firmar',
  'adjunto.adjuntar',
  'reporte.ver',
];

const PERMISOS_MESA_PARTES = ['radicacion.registrar', 'expediente.crear'];

const CATALOGO = [
  ...new Set([
    ...PERMISOS_ESTUDIANTE,
    ...PERMISOS_DOCENTE,
    ...PERMISOS_MESA_PARTES,
    'rol.ver',
    'permiso.gestionar',
    'configuracion.editar',
    'area.crear',
    'auditoria.ver',
  ]),
];

const IDS_ROL = {
  SUPER_ADMIN: 'aaaaaaaa-0000-4000-8000-000000000001',
  DIRECTOR: 'aaaaaaaa-0000-4000-8000-000000000002',
  DOCENTE: 'aaaaaaaa-0000-4000-8000-000000000003',
  MESA_PARTES: 'aaaaaaaa-0000-4000-8000-000000000004',
  ESTUDIANTE: 'aaaaaaaa-0000-4000-8000-000000000005',
} as const;

const SECRETO = 'secreto-de-prueba-rbac-organicore-32chars-minimo';

function token(cuenta: string, roles: string[] = []): string {
  return firmarTokenAcceso({ sub: cuenta, roles, secreto: SECRETO });
}

function estadoBase(): EstadoRbac {
  const estado = crearEstadoRbac();

  estado.roles = [
    {
      rol_id: IDS_ROL.SUPER_ADMIN,
      codigo: 'SUPER_ADMIN',
      nombre: 'Superadministrador',
      descripcion: null,
      vigente: true,
    },
    { rol_id: IDS_ROL.DIRECTOR, codigo: 'DIRECTOR', nombre: 'Director', descripcion: null, vigente: true },
    { rol_id: IDS_ROL.DOCENTE, codigo: 'DOCENTE', nombre: 'Docente', descripcion: null, vigente: true },
    {
      rol_id: IDS_ROL.MESA_PARTES,
      codigo: 'MESA_PARTES',
      nombre: 'Mesa de Partes',
      descripcion: null,
      vigente: true,
    },
    {
      rol_id: IDS_ROL.ESTUDIANTE,
      codigo: 'ESTUDIANTE',
      nombre: 'Estudiante',
      descripcion: null,
      vigente: true,
    },
  ];

  estado.permisos = CATALOGO.map((codigo, indice) => ({
    permiso_id: `bbbbbbbb-0000-4000-8000-${indice.toString().padStart(12, '0')}`,
    codigo,
    nombre: `Permiso ${codigo}`,
    ambito:
      codigo.startsWith('rol.') || codigo.startsWith('configuracion.')
        ? ('GLOBAL' as const)
        : ('AREA' as const),
    subareas: [],
  }));

  estado.matriz.set(IDS_ROL.SUPER_ADMIN, new Set(CATALOGO));
  estado.matriz.set(IDS_ROL.ESTUDIANTE, new Set(PERMISOS_ESTUDIANTE));
  estado.matriz.set(IDS_ROL.DOCENTE, new Set(PERMISOS_DOCENTE));
  estado.matriz.set(IDS_ROL.MESA_PARTES, new Set(PERMISOS_MESA_PARTES));

  estado.usuarioRoles.set(CUENTA_ADMIN, [{ rol_id: IDS_ROL.SUPER_ADMIN, codigo: 'SUPER_ADMIN' }]);
  estado.usuarioRoles.set(CUENTA_ESTUDIANTE, [{ rol_id: IDS_ROL.ESTUDIANTE, codigo: 'ESTUDIANTE' }]);

  return estado;
}

function construirAppPrueba(bd: BdFalsa, cache: CacheFalsa): Express {
  const db = comoClienteSql(bd);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(contextMiddleware);
  app.locals.rbac = crearRbacService(db, cache);

  app.use('/api/v1/admin', crearRouterRbac(db, cache));

  // Rutas de firma y de configuración, protegidas por el mismo middleware.
  const firma = express.Router();
  firma.use(crearAutenticacionRbac(crearRbacService(db, cache)));
  firma.use(requirePermission('firma.firmar', crearRbacService(db, cache)));
  firma.post('/firmar', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/firma', firma);

  const configuracion = express.Router();
  configuracion.use(crearAutenticacionRbac(crearRbacService(db, cache)));
  configuracion.use(requirePermission('configuracion.editar', crearRbacService(db, cache)));
  configuracion.put('/parametros', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/configuracion', configuracion);

  app.use(errorMiddleware);
  return app;
}

describe('RBAC · OrganiCore (matriz de permisos en PostgreSQL)', () => {
  let estado: EstadoRbac;
  let cache: CacheFalsa;
  let bd: BdFalsa;
  let app: Express;
  let servicio: RbacService;
  let cabeceraOriginal: string | undefined;
  let secretoOriginal: string | undefined;

  beforeAll(() => {
    cabeceraOriginal = process.env.ALLOW_HEADER_IDENTITY;
    secretoOriginal = process.env.AUTH_JWT_SECRET;
  });

  afterAll(() => {
    if (cabeceraOriginal === undefined) delete process.env.ALLOW_HEADER_IDENTITY;
    else process.env.ALLOW_HEADER_IDENTITY = cabeceraOriginal;
    if (secretoOriginal === undefined) delete process.env.AUTH_JWT_SECRET;
    else process.env.AUTH_JWT_SECRET = secretoOriginal;
  });

  beforeEach(() => {
    // Configuración segura por defecto: la cabecera NO es identidad confiable.
    delete process.env.ALLOW_HEADER_IDENTITY;
    process.env.AUTH_JWT_SECRET = SECRETO;
    estado = estadoBase();
    cache = crearCacheFalsa();
    bd = crearBdFalsa(estado);
    servicio = crearRbacService(comoClienteSql(bd), cache);
    app = construirAppPrueba(bd, cache);
  });

  describe('1. Acceso permitido y denegado', () => {
    it('permite el acceso a un usuario cuyo rol incluye el permiso', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.total_roles).toBe(5);
      expect(respuesta.body.matriz).toHaveLength(5);
    });

    it('devuelve la matriz completa de los 5 roles canónicos con sus permisos', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`);

      const codigos = respuesta.body.matriz.map((rol: { codigo: string }) => rol.codigo);
      expect(codigos).toEqual(['DIRECTOR', 'DOCENTE', 'ESTUDIANTE', 'MESA_PARTES', 'SUPER_ADMIN']);

      const estudiante = respuesta.body.matriz.find(
        (rol: { codigo: string }) => rol.codigo === 'ESTUDIANTE',
      );
      expect(estudiante.total_permisos).toBe(PERMISOS_ESTUDIANTE.length);
      expect(estudiante.permisos.map((p: { codigo: string }) => p.codigo)).toEqual(
        [...PERMISOS_ESTUDIANTE].sort(),
      );
    });

    it('expone los nombres canónicos del esquema: nombre, ambito y subareas', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`);

      const permiso = respuesta.body.matriz
        .flatMap((rol: { permisos: unknown[] }) => rol.permisos)
        .find((p: { codigo: string }) => p.codigo === 'expediente.ver');

      expect(permiso).toMatchObject({ codigo: 'expediente.ver', ambito: 'AREA', subareas: [] });
      expect(permiso).toHaveProperty('nombre', 'Permiso expediente.ver');
      // Columnas que solo existen en el DDL propio de B_PANAIFO, no en el canónico.
      expect(permiso).not.toHaveProperty('descripcion');
      expect(permiso).not.toHaveProperty('alcance_predetermido');
      expect(permiso).not.toHaveProperty('activo');
    });

    it('responde 403 Forbidden cuando el usuario no posee el permiso', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ESTUDIANTE)}`);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.code).toBe('FORBIDDEN');
    });

    it('responde 403 cuando ESTUDIANTE intenta una función administrativa', async () => {
      const lectura = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ESTUDIANTE)}`);
      expect(lectura.status).toBe(403);

      const escritura = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ESTUDIANTE)}`)
        .send({ rol_id: IDS_ROL.ESTUDIANTE, codigos_permisos: ['configuracion.editar'] });
      expect(escritura.status).toBe(403);
      expect(escritura.body.code).toBe('FORBIDDEN');

      expect(estado.matriz.get(IDS_ROL.ESTUDIANTE)).toEqual(new Set(PERMISOS_ESTUDIANTE));
    });

    it('responde 403 al acceder a firma sin el permiso correspondiente', async () => {
      const respuesta = await request(app)
        .post('/firma/firmar')
        .set('authorization', `Bearer ${token(CUENTA_ESTUDIANTE)}`);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.code).toBe('FORBIDDEN');
      // ESTUDIANTE puede solicitar firma, pero no firmarla.
      expect(estado.matriz.get(IDS_ROL.ESTUDIANTE)?.has('firma.firmar')).toBe(false);
    });

    it('responde 403 al acceder a configuración sin el permiso correspondiente', async () => {
      const respuesta = await request(app)
        .put('/configuracion/parametros')
        .set('authorization', `Bearer ${token(CUENTA_ESTUDIANTE)}`)
        .send({ parametro: 'x' });

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.code).toBe('FORBIDDEN');
    });

    it('devuelve un cuerpo de error compatible con RFC 7807', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ESTUDIANTE)}`);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body).toMatchObject({
        type: 'https://sigd.iestpsuiza.edu.pe/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        code: 'FORBIDDEN',
        instance: '/api/v1/admin/roles-permisos',
      });
      expect(typeof respuesta.body.detail).toBe('string');
      expect(typeof respuesta.body.correlation_id).toBe('string');
    });
  });

  describe('2. Caché de permisos (Redis, TTL 1 hora)', () => {
    it('cache-miss: consulta PostgreSQL y almacena el resultado en la caché', async () => {
      const permisos = await servicio.obtenerPermisosDeRol(IDS_ROL.ESTUDIANTE);

      expect(permisos).toEqual([...PERMISOS_ESTUDIANTE].sort());
      expect(bd.count('rp.rol_id = $1')).toBe(1);
      expect(cache.lecturas).toEqual([IDS_ROL.ESTUDIANTE]);
      expect(cache.escrituras).toEqual([
        { rol_id: IDS_ROL.ESTUDIANTE, permisos: [...PERMISOS_ESTUDIANTE].sort() },
      ]);
    });

    it('cache-hit: NO consulta PostgreSQL en la segunda lectura', async () => {
      await servicio.obtenerPermisosDeRol(IDS_ROL.ESTUDIANTE);
      const consultasTrasPrimera = bd.consultas.length;

      const permisos = await servicio.obtenerPermisosDeRol(IDS_ROL.ESTUDIANTE);

      expect(permisos).toEqual([...PERMISOS_ESTUDIANTE].sort());
      expect(bd.consultas.length).toBe(consultasTrasPrimera);
      expect(bd.count('rp.rol_id = $1')).toBe(1);
      expect(cache.escrituras).toHaveLength(1);
    });

    it('cache-hit: las peticiones HTTP repetidas no vuelven a consultar la matriz', async () => {
      const jwt = `Bearer ${token(CUENTA_ADMIN)}`;
      await request(app).get('/api/v1/admin/roles-permisos').set('authorization', jwt);
      const trasPrimera = bd.count('rp.rol_id = $1');

      await request(app).get('/api/v1/admin/roles-permisos').set('authorization', jwt);

      expect(bd.count('rp.rol_id = $1')).toBe(trasPrimera);
    });

    it('puede saltarse la caché de forma explícita', async () => {
      await servicio.obtenerPermisosDeRol(IDS_ROL.ESTUDIANTE);
      await servicio.obtenerPermisosDeRol(IDS_ROL.ESTUDIANTE, { usarCache: false });

      expect(bd.count('rp.rol_id = $1')).toBe(2);
    });
  });

  describe('3. Invalidación de caché tras modificar la matriz', () => {
    it('invalida la clave del rol y deja de servir los permisos revocados', async () => {
      await servicio.obtenerPermisosDeRol(IDS_ROL.ESTUDIANTE);
      expect(cache.invalidaciones).toEqual([]);

      const resultado = await servicio.actualizarPermisosDeRol({
        rol_id: IDS_ROL.ESTUDIANTE,
        codigos_permisos: ['expediente.ver', 'reporte.ver'],
      });

      expect(resultado.codigo).toBe('ESTUDIANTE');
      expect(resultado.permisos_agregados).toEqual([]);
      expect(resultado.permisos_revocados).toEqual(
        PERMISOS_ESTUDIANTE.filter((c) => !['expediente.ver', 'reporte.ver'].includes(c)).sort(),
      );
      expect(cache.invalidaciones).toEqual([IDS_ROL.ESTUDIANTE]);
    });

    it('nunca reescribe la clave justo después de borrarla', async () => {
      await servicio.obtenerPermisosDeRol(IDS_ROL.ESTUDIANTE);
      const escriturasAntes = cache.escrituras.length;

      await servicio.actualizarPermisosDeRol({
        rol_id: IDS_ROL.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      // Reescribir la lista revocada seria devolver el permiso retirado.
      expect(cache.escrituras).toHaveLength(escriturasAntes);
    });

    it('un permiso revocado deja de concederse en la siguiente petición (fail closed)', async () => {
      await servicio.obtenerPermisosDeRol(IDS_ROL.ESTUDIANTE);
      expect(await servicio.rolTienePermiso(IDS_ROL.ESTUDIANTE, 'firma.solicitar')).toBe(true);

      await servicio.actualizarPermisosDeRol({
        rol_id: IDS_ROL.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      expect(await servicio.rolTienePermiso(IDS_ROL.ESTUDIANTE, 'firma.solicitar')).toBe(false);
      expect(await servicio.rolTienePermiso(IDS_ROL.ESTUDIANTE, 'expediente.ver')).toBe(true);
    });

    it('un permiso agregado se concede después de actualizar la matriz', async () => {
      await servicio.actualizarPermisosDeRol({
        rol_id: IDS_ROL.MESA_PARTES,
        codigos_permisos: ['radicacion.registrar', 'expediente.crear', 'auditoria.ver'],
      });

      expect(await servicio.rolTienePermiso(IDS_ROL.MESA_PARTES, 'auditoria.ver')).toBe(true);
    });

    it('propaga la invalidación por Pub/Sub cuando hay varias instancias', async () => {
      const publicaciones: string[] = [];
      const servicioConPubSub = new RbacService(comoClienteSql(bd), cache, {
        propagarInvalidacion: async (rol_id) => {
          publicaciones.push(rol_id);
        },
      });

      const resultado = await servicioConPubSub.actualizarPermisosDeRol({
        rol_id: IDS_ROL.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      expect(publicaciones).toEqual([IDS_ROL.ESTUDIANTE]);
      expect(resultado.cache_invalidation).toEqual({
        emitido_local: true,
        propagado: true,
        pendiente_outbox: true,
      });
    });

    it('sin Pub/Sub configurado la invalidación local sí ocurre', async () => {
      const resultado = await servicio.actualizarPermisosDeRol({
        rol_id: IDS_ROL.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      expect(resultado.cache_invalidation).toEqual({
        emitido_local: true,
        propagado: false,
        pendiente_outbox: true,
      });
      expect(cache.invalidaciones).toContain(IDS_ROL.ESTUDIANTE);
    });

    it('registra la mutación en la bitácora de auditoría', async () => {
      await servicio.actualizarPermisosDeRol({
        rol_id: IDS_ROL.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      expect(bd.count('sigd_audit.bitacora_auditoria')).toBe(1);
    });

    it('la revocación surte efecto también sobre una petición HTTP posterior', async () => {
      const jwt = `Bearer ${token(CUENTA_ESTUDIANTE)}`;
      const antes = await request(app).post('/firma/firmar').set('authorization', jwt);
      expect(antes.status).toBe(403);

      estado.usuarioRoles.set(CUENTA_ESTUDIANTE, [{ rol_id: IDS_ROL.DOCENTE, codigo: 'DOCENTE' }]);
      await servicio.actualizarPermisosDeRol({ rol_id: IDS_ROL.DOCENTE, codigos_permisos: [] });

      const despues = await request(app).post('/firma/firmar').set('authorization', jwt);
      expect(despues.status).toBe(403);
    });
  });

  describe('3.1 OC-11 · la invalidación sobrevive a la caída de Redis', () => {
    it('escribe el evento en el outbox dentro de la misma transacción que la matriz', async () => {
      await servicio.actualizarPermisosDeRol({
        rol_id: IDS_ROL.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      const insertOutbox = bd.consultas.findIndex((sql) => sql.includes('sigd_audit.evento_outbox'));
      const commit = bd.consultas.indexOf('COMMIT');

      expect(insertOutbox).toBeGreaterThan(-1);
      expect(insertOutbox).toBeLessThan(commit);
    });

    it('no escribe el evento si la matriz no cambia', async () => {
      await servicio.actualizarPermisosDeRol({
        rol_id: IDS_ROL.ESTUDIANTE,
        codigos_permisos: [...PERMISOS_ESTUDIANTE],
      });

      expect(bd.count('sigd_audit.evento_outbox')).toBe(0);
    });

    it('confirma la matriz y encola la invalidación cuando Redis falla tras el commit', async () => {
      cache.fallarInvalidacion = () => {
        throw new Error('ECONNREFUSED 127.0.0.1:6379');
      };

      const resultado = await servicio.actualizarPermisosDeRol({
        rol_id: IDS_ROL.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      // La escritura en PostgreSQL NO se revierte: el permiso revocado ya no está.
      expect(resultado.cache_invalidation).toEqual({
        emitido_local: false,
        propagado: false,
        pendiente_outbox: true,
      });
      expect(bd.consultas).toContain('COMMIT');
      expect([...(estado.matriz.get(IDS_ROL.ESTUDIANTE) ?? [])]).toEqual(['expediente.ver']);
      expect(bd.count('sigd_audit.evento_outbox')).toBe(1);
    });

    it('marca la propagación fallida sin romper la respuesta', async () => {
      const servicioConPubSub = new RbacService(comoClienteSql(bd), cache, {
        propagarInvalidacion: async () => {
          throw new Error('Redis caído al publicar');
        },
      });

      const resultado = await servicioConPubSub.actualizarPermisosDeRol({
        rol_id: IDS_ROL.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      expect(resultado.cache_invalidation).toEqual({
        emitido_local: true,
        propagado: false,
        pendiente_outbox: true,
      });
    });

    it('el destino del outbox borra la clave y propaga a las demás instancias', async () => {
      const publicaciones: string[] = [];
      const destino = new DestinoRbacInvalidacion(cache, {
        publish: async (_canal: string, mensaje: string) => {
          publicaciones.push(mensaje);
          return 1;
        },
      } as never);

      await destino.despachar({
        id_evento: 'evt-1',
        correlation_id: null,
        agregado: AGREGADO_RBAC,
        tipo_evento: TIPO_EVENTO_RBAC_MODIFICADA,
        payload: { rol_id: IDS_ROL.ESTUDIANTE, codigo: 'ESTUDIANTE', permisos: ['expediente.ver'] },
        intentos: 0,
      });

      expect(cache.invalidaciones).toEqual([IDS_ROL.ESTUDIANTE]);
      expect(publicaciones).toHaveLength(1);
      expect(JSON.parse(publicaciones[0])).toEqual({ rol_id: IDS_ROL.ESTUDIANTE });
    });

    it('el destino ignora los eventos que no son de la matriz RBAC', async () => {
      const destino = new DestinoRbacInvalidacion(cache);

      await destino.despachar({
        id_evento: 'evt-2',
        correlation_id: null,
        agregado: 'expediente',
        tipo_evento: 'expediente_resuelto',
        payload: {},
        intentos: 0,
      });

      expect(cache.invalidaciones).toEqual([]);
    });

    it('el destino falla para que el worker reintente si falta rol_id', async () => {
      const destino = new DestinoRbacInvalidacion(cache);

      await expect(
        destino.despachar({
          id_evento: 'evt-3',
          correlation_id: null,
          agregado: AGREGADO_RBAC,
          tipo_evento: TIPO_EVENTO_RBAC_MODIFICADA,
          payload: {},
          intentos: 0,
        }),
      ).rejects.toThrow(/sin payload\.rol_id/);
    });
  });

  describe('4. Validación de las actualizaciones', () => {
    it('rechaza permisos que no existen en el catálogo con 400 e invalid_params', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({
          rol_id: IDS_ROL.ESTUDIANTE,
          codigos_permisos: ['expediente.ver', 'permiso.inexistente', 'otro.fantasma'],
        });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.code).toBe('VALIDATION_ERROR');
      const nombres = respuesta.body.invalid_params.map((p: { name: string }) => p.name);
      expect(nombres).toContain('codigos_permisos.permiso.inexistente');
      expect(nombres).toContain('codigos_permisos.otro.fantasma');
    });

    it('no modifica la matriz cuando algún permiso es inválido', async () => {
      await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({ rol_id: IDS_ROL.ESTUDIANTE, codigos_permisos: ['permiso.inexistente'] });

      expect(estado.matriz.get(IDS_ROL.ESTUDIANTE)).toEqual(new Set(PERMISOS_ESTUDIANTE));
    });

    it('rechaza un rol_id que no es UUID', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({ rol_id: 'no-es-uuid', codigos_permisos: [] });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.code).toBe('VALIDATION_ERROR');
    });

    it('rechaza códigos de permiso con formato inválido', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({ rol_id: IDS_ROL.ESTUDIANTE, codigos_permisos: ['PERMISO_SIN_PUNTO'] });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.code).toBe('VALIDATION_ERROR');
    });

    it('responde 404 cuando el rol no existe', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({ rol_id: '99999999-9999-4999-8999-999999999999', codigos_permisos: [] });

      expect(respuesta.status).toBe(404);
      expect(respuesta.body.code).toBe('NOT_FOUND');
    });

    it('responde 409 al modificar los permisos de un rol no vigente', async () => {
      estado.roles[4] = { ...estado.roles[4], vigente: false };

      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({ rol_id: IDS_ROL.ESTUDIANTE, codigos_permisos: ['expediente.ver'] });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.code).toBe('ROL_INVIGENTE');
    });

    it('un rol no vigente no otorga ningún permiso', async () => {
      estado.roles[4] = { ...estado.roles[4], vigente: false };

      expect(await servicio.usuarioTienePermiso(CUENTA_ESTUDIANTE, 'expediente.ver')).toBe(false);
    });

    it('admite un array vacío para revocar todos los permisos de un rol', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({ rol_id: IDS_ROL.MESA_PARTES, codigos_permisos: [] });

      expect(respuesta.status).toBe(200);
      expect(estado.matriz.get(IDS_ROL.MESA_PARTES)?.size).toBe(0);
    });

    it('normaliza duplicados y espacios en blanco', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({
          rol_id: IDS_ROL.MESA_PARTES,
          codigos_permisos: ['  expediente.ver  ', 'expediente.ver', 'radicacion.registrar'],
        });

      expect(respuesta.status).toBe(200);
      expect([...(estado.matriz.get(IDS_ROL.MESA_PARTES) ?? [])].sort()).toEqual([
        'expediente.ver',
        'radicacion.registrar',
      ]);
    });
  });

  describe('5. Intentos de bypass', () => {
    it('responde 401 cuando no se envía identidad', async () => {
      const respuesta = await request(app).get('/api/v1/admin/roles-permisos');

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.code).toBe('UNAUTHORIZED');
    });

    it('OC-12: rechaza suplantar una cuenta solo con x-usuario-id', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN);

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.code).toBe('UNAUTHORIZED');
    });

    it('OC-12: un JWT con firma manipulada no concede acceso', async () => {
      const manipulado = `${token(CUENTA_ADMIN).slice(0, -4)}AAAA`;

      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${manipulado}`);

      expect(respuesta.status).toBe(401);
    });

    it('OC-12: un JWT expirado no concede acceso', async () => {
      const expirado = firmarTokenAcceso({
        sub: CUENTA_ADMIN,
        secreto: SECRETO,
        expiraSegundos: -10,
      });

      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${expirado}`);

      expect(respuesta.status).toBe(401);
    });

    it('OC-12: los roles del JWT no sustituyen a los de PostgreSQL', async () => {
      // El token afirma SUPER_ADMIN para una cuenta que en la base es ESTUDIANTE.
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ESTUDIANTE, ['SUPER_ADMIN'])}`);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.code).toBe('FORBIDDEN');
    });

    it('respeta ALLOW_HEADER_IDENTITY=true como compatibilidad explícita', async () => {
      process.env.ALLOW_HEADER_IDENTITY = 'true';

      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN);

      expect(respuesta.status).toBe(200);
    });

    it('responde 403 cuando la cuenta no tiene ningún rol vigente', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_SIN_ROL)}`);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.code).toBe('FORBIDDEN');
    });

    it('ignora un encabezado x-rol falsificado: el rol sale de PostgreSQL', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ESTUDIANTE)}`)
        .set('x-rol', 'SUPER_ADMIN');

      expect(respuesta.status).toBe(403);
    });

    it('no autoriza cuando requirePermission se monta sin autenticación previa', async () => {
      const appSinAuth = express();
      appSinAuth.use(express.json());
      appSinAuth.use(contextMiddleware);
      appSinAuth.post('/directo', requirePermission('rol.ver', servicio), (_req, res) => {
        res.json({ ok: true });
      });
      appSinAuth.use(errorMiddleware);

      const respuesta = await request(appSinAuth)
        .post('/directo')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`);

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.code).toBe('UNAUTHORIZED');
    });

    it('deniega el acceso cuando el permiso exigido no existe en el catálogo', async () => {
      const appFantasma = express();
      appFantasma.use(express.json());
      appFantasma.use(contextMiddleware);
      appFantasma.use((req, _res, next) => {
        conectarActor(req, {
          id_usuario: CUENTA_ADMIN,
          roles: [{ rol_id: IDS_ROL.SUPER_ADMIN, codigo: 'SUPER_ADMIN' }],
          via: 'bearer',
        });
        next();
      });
      appFantasma.get('/fantasma', requirePermission('dominio.inexistente', servicio), (_req, res) => {
        res.json({ ok: true });
      });
      appFantasma.use(errorMiddleware);

      const respuesta = await request(appFantasma).get('/fantasma');

      expect(respuesta.status).toBe(403);
    });

    it('falla cerrado si el RbacService no está disponible', async () => {
      const appSinServicio = express();
      appSinServicio.use(express.json());
      appSinServicio.use(contextMiddleware);
      appSinServicio.use((req, _res, next) => {
        conectarActor(req, {
          id_usuario: CUENTA_ADMIN,
          roles: [{ rol_id: IDS_ROL.SUPER_ADMIN, codigo: 'SUPER_ADMIN' }],
          via: 'bearer',
        });
        next();
      });
      appSinServicio.get('/sin-servicio', requirePermission('rol.ver'), (_req, res) => {
        res.json({ ok: true });
      });
      appSinServicio.use(errorMiddleware);

      const respuesta = await request(appSinServicio).get('/sin-servicio');

      expect(respuesta.status).toBe(500);
    });

    it('un rol sin ningún permiso concede denegación en todos los destinos', async () => {
      estado.matriz.set(IDS_ROL.ESTUDIANTE, new Set());
      await cache.guardar(IDS_ROL.ESTUDIANTE, []);

      const admin = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`);
      expect(admin.status).toBe(200);

      const estudiante = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ESTUDIANTE)}`);
      expect(estudiante.status).toBe(403);
    });

    it('SUPER_ADMIN no puede conceder permisos inexistentes ni tocar otros roles sin permiso', async () => {
      const invalido = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({ rol_id: IDS_ROL.DOCENTE, codigos_permisos: ['permiso.fabricalo'] });
      expect(invalido.status).toBe(400);

      const valido = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({
          rol_id: IDS_ROL.DOCENTE,
          codigos_permisos: ['expediente.ver', 'firma.firmar', 'auditoria.ver'],
        });
      expect(valido.status).toBe(200);
      expect(estado.matriz.get(IDS_ROL.DOCENTE)).toEqual(
        new Set(['expediente.ver', 'firma.firmar', 'auditoria.ver']),
      );
    });
  });

  describe('5.1 OC-09 · alcance por subáreas sin romper el CHECK canónico', () => {
    it('no restringe un permiso mientras no tenga áreas configuradas', async () => {
      expect(await servicio.rolTienePermiso(IDS_ROL.ESTUDIANTE, 'expediente.ver')).toBe(true);
      expect(
        await servicio.rolTienePermiso(IDS_ROL.ESTUDIANTE, 'expediente.ver', { area_id: 'AREA_JURIDICA' }),
      ).toBe(true);
    });

    it('concede dentro de las áreas configuradas y deniega fuera de ellas', async () => {
      estado.restriccionesArea.set('expediente.ver', ['AREA_ACADEMICA']);

      expect(
        await servicio.rolTienePermiso(IDS_ROL.ESTUDIANTE, 'expediente.ver', { area_id: 'AREA_ACADEMICA' }),
      ).toBe(true);
      expect(
        await servicio.rolTienePermiso(IDS_ROL.ESTUDIANTE, 'expediente.ver', { area_id: 'AREA_JURIDICA' }),
      ).toBe(false);
    });

    it('propaga la restricción a la autorización del usuario, no solo al rol', async () => {
      estado.restriccionesArea.set('expediente.ver', ['AREA_ACADEMICA']);

      expect(
        await servicio.usuarioTienePermiso(CUENTA_ESTUDIANTE, 'expediente.ver', {
          area_id: 'AREA_JURIDICA',
        }),
      ).toBe(false);
      expect(
        await servicio.usuarioTienePermiso(CUENTA_ESTUDIANTE, 'expediente.ver', {
          area_id: 'AREA_ACADEMICA',
        }),
      ).toBe(true);
    });

    it('expone las áreas de la restricción en la matriz', async () => {
      estado.restriccionesArea.set('expediente.ver', ['AREA_ACADEMICA']);

      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`);

      const permiso = respuesta.body.matriz
        .flatMap((rol: { permisos: unknown[] }) => rol.permisos)
        .find((p: { codigo: string }) => p.codigo === 'expediente.ver');

      expect(permiso.subareas).toEqual(['AREA_ACADEMICA']);
    });
  });

  describe('6. OC-09 · el SQL usa los nombres canónicos de 03_sigd_org.sql', () => {
    it('consulta vigente, id_usuario, nombre y ambito', async () => {
      await servicio.obtenerRoles(true);
      await servicio.obtenerPermisos();
      await servicio.rolesDeUsuario(CUENTA_ADMIN);
      await servicio.obtenerPermisosDeRol(IDS_ROL.ESTUDIANTE);

      const sql = bd.consultas.join('\n');
      expect(sql).toContain('vigente = true');
      expect(sql).toContain('ur.id_usuario = $1');
      expect(sql).toContain('p.nombre');
      expect(sql).toContain('p.ambito');
    });

    it('nunca usa las columnas que solo existen en el DDL propio', async () => {
      await servicio.obtenerMatrizRolesPermisos();
      await servicio.actualizarPermisosDeRol({
        rol_id: IDS_ROL.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      const sql = bd.consultas.join('\n');
      for (const prohibido of ['cuenta_id', 'alcance_predeterminado', 'p.activo', 'r.activo', 'vigencia @>']) {
        expect(sql).not.toContain(prohibido);
      }
    });
  });

  /**
   * DoD: "SUPER_ADMIN tiene trazabilidad total pero no puede eludir los triggers de
   * inmutabilidad WORM". La inmutabilidad real la garantizan los triggers y los
   * GRANT/REVOKE de PostgreSQL (docs/00_corelink/06_sigd_audit_esquema_ddl.sql); lo
   * que se verifica aqui es el limite de la capa de aplicacion: el RBAC solo anade
   * filas a la bitacora, no las modifica ni las borra, no admite permisos fuera del
   * catalogo y no otorga exencion permanente al rol mas alto.
   */
  describe('7. SUPER_ADMIN: trazabilidad total sin eludir WORM', () => {
    it('deja una unica entrada en la bitacora por cada mutacion de la matriz', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({ rol_id: IDS_ROL.DOCENTE, codigos_permisos: ['expediente.ver', 'firma.firmar'] });

      expect(respuesta.status).toBe(200);
      expect(bd.count('sigd_audit.bitacora_auditoria')).toBe(1);
    });

    it('la bitacora es append-only: el servicio nunca la actualiza ni la borra', async () => {
      await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({ rol_id: IDS_ROL.DOCENTE, codigos_permisos: ['expediente.ver'] });

      const escriturasNoInsert = bd.consultas.filter(
        (sql) => sql.includes('sigd_audit.bitacora_auditoria') && !sql.startsWith('INSERT'),
      );

      expect(escriturasNoInsert).toEqual([]);
    });

    it('no concede a SUPER_ADMIN nada fuera del catalogo, asi que no hay atajo WORM', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`);

      const superAdmin = respuesta.body.matriz.find(
        (rol: { codigo: string }) => rol.codigo === 'SUPER_ADMIN',
      );
      const concedidos: string[] = superAdmin.permisos.map((p: { codigo: string }) => p.codigo).sort();

      expect(concedidos).toEqual([...CATALOGO].sort());
      expect(concedidos.some((codigo) => /trigger|worm|replication_role|bitacora/.test(codigo))).toBe(
        false,
      );
    });

    it('rechaza fabricar un permiso de evasion WORM y deja la matriz intacta', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', `Bearer ${token(CUENTA_ADMIN)}`)
        .send({
          rol_id: IDS_ROL.SUPER_ADMIN,
          codigos_permisos: ['worm.desabilitar', 'trigger.eliminar', 'session_replication_role'],
        });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.code).toBe('VALIDATION_ERROR');
      expect(estado.matriz.get(IDS_ROL.SUPER_ADMIN)).toEqual(new Set(CATALOGO));
    });

    it('no tiene auto-exencion: al revocarse su propio permiso de gestion queda bloqueado', async () => {
      const jwt = `Bearer ${token(CUENTA_ADMIN)}`;

      const lecturaPrevia = await request(app).get('/api/v1/admin/roles-permisos').set('authorization', jwt);
      expect(lecturaPrevia.status).toBe(200);

      const revocacion = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', jwt)
        .send({ rol_id: IDS_ROL.SUPER_ADMIN, codigos_permisos: ['rol.ver'] });
      expect(revocacion.status).toBe(200);

      const escritura = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('authorization', jwt)
        .send({ rol_id: IDS_ROL.DOCENTE, codigos_permisos: [] });
      expect(escritura.status).toBe(403);

      const lecturaPosterior = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('authorization', jwt);
      expect(lecturaPosterior.status).toBe(200);
    });
  });
});
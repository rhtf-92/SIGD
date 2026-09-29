import { describe, it, expect, beforeEach } from 'vitest';
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
import { RbacService } from '../../../../src/domains/organicore/rbac.service.js';
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

const IDs = {
  SUPER_ADMIN: 'aaaaaaaa-0000-4000-8000-000000000001',
  DIRECTOR: 'aaaaaaaa-0000-4000-8000-000000000002',
  DOCENTE: 'aaaaaaaa-0000-4000-8000-000000000003',
  MESA_PARTES: 'aaaaaaaa-0000-4000-8000-000000000004',
  ESTUDIANTE: 'aaaaaaaa-0000-4000-8000-000000000005',
} as const;

function estadoBase(): EstadoRbac {
  const estado = crearEstadoRbac();

  estado.roles = [
    { rol_id: IDs.SUPER_ADMIN, codigo: 'SUPER_ADMIN', nombre: 'Superadministrador', descripcion: null, activo: true },
    { rol_id: IDs.DIRECTOR, codigo: 'DIRECTOR', nombre: 'Director', descripcion: null, activo: true },
    { rol_id: IDs.DOCENTE, codigo: 'DOCENTE', nombre: 'Docente', descripcion: null, activo: true },
    { rol_id: IDs.MESA_PARTES, codigo: 'MESA_PARTES', nombre: 'Mesa de Partes', descripcion: null, activo: true },
    { rol_id: IDs.ESTUDIANTE, codigo: 'ESTUDIANTE', nombre: 'Estudiante', descripcion: null, activo: true },
  ];

  estado.permisos = CATALOGO.map((codigo, indice) => ({
    permiso_id: `bbbbbbbb-0000-4000-8000-${indice.toString().padStart(12, '0')}`,
    codigo,
    descripcion: `Permiso ${codigo}`,
    alcance_predeterminado:
      codigo.startsWith('rol.') || codigo.startsWith('configuracion.')
        ? ('GLOBAL' as const)
        : ('AREA' as const),
    activo: true,
  }));

  estado.matriz.set(IDs.SUPER_ADMIN, new Set(CATALOGO));
  estado.matriz.set(IDs.ESTUDIANTE, new Set(PERMISOS_ESTUDIANTE));
  estado.matriz.set(IDs.DOCENTE, new Set(PERMISOS_DOCENTE));
  estado.matriz.set(IDs.MESA_PARTES, new Set(PERMISOS_MESA_PARTES));

  estado.usuarioRoles.set(CUENTA_ADMIN, [{ rol_id: IDs.SUPER_ADMIN, codigo: 'SUPER_ADMIN' }]);
  estado.usuarioRoles.set(CUENTA_ESTUDIANTE, [{ rol_id: IDs.ESTUDIANTE, codigo: 'ESTUDIANTE' }]);

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

  beforeEach(() => {
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
        .set('x-usuario-id', CUENTA_ADMIN);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.total_roles).toBe(5);
      expect(respuesta.body.matriz).toHaveLength(5);
    });

    it('devuelve la matriz completa de los 5 roles canónicos con sus permisos', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN);

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

    it('responde 403 Forbidden cuando el usuario no posee el permiso', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ESTUDIANTE);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.code).toBe('FORBIDDEN');
    });

    it('responde 403 cuando ESTUDIANTE intenta una función administrativa', async () => {
      const lectura = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ESTUDIANTE);
      expect(lectura.status).toBe(403);

      const escritura = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ESTUDIANTE)
        .send({ rol_id: IDs.ESTUDIANTE, codigos_permisos: ['configuracion.editar'] });
      expect(escritura.status).toBe(403);
      expect(escritura.body.code).toBe('FORBIDDEN');

      expect(estado.matriz.get(IDs.ESTUDIANTE)).toEqual(new Set(PERMISOS_ESTUDIANTE));
    });

    it('responde 403 al acceder a firma sin el permiso correspondiente', async () => {
      const respuesta = await request(app)
        .post('/firma/firmar')
        .set('x-usuario-id', CUENTA_ESTUDIANTE);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.code).toBe('FORBIDDEN');
      // ESTUDIANTE puede solicitar firma, pero no firmarla.
      expect(estado.matriz.get(IDs.ESTUDIANTE)?.has('firma.firmar')).toBe(false);
    });

    it('responde 403 al acceder a configuración sin el permiso correspondiente', async () => {
      const respuesta = await request(app)
        .put('/configuracion/parametros')
        .set('x-usuario-id', CUENTA_ESTUDIANTE)
        .send({ parametro: 'x' });

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.code).toBe('FORBIDDEN');
    });

    it('devuelve un cuerpo de error compatible con RFC 7807', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ESTUDIANTE);

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
      const permisos = await servicio.obtenerPermisosDeRol(IDs.ESTUDIANTE);

      expect(permisos).toEqual([...PERMISOS_ESTUDIANTE].sort());
      expect(bd.count('rp.rol_id = $1')).toBe(1);
      expect(cache.lecturas).toEqual([IDs.ESTUDIANTE]);
      expect(cache.escrituras).toEqual([
        { rol_id: IDs.ESTUDIANTE, permisos: [...PERMISOS_ESTUDIANTE].sort() },
      ]);
    });

    it('cache-hit: NO consulta PostgreSQL en la segunda lectura', async () => {
      await servicio.obtenerPermisosDeRol(IDs.ESTUDIANTE);
      const consultasTrasPrimera = bd.consultas.length;

      const permisos = await servicio.obtenerPermisosDeRol(IDs.ESTUDIANTE);

      expect(permisos).toEqual([...PERMISOS_ESTUDIANTE].sort());
      expect(bd.consultas.length).toBe(consultasTrasPrimera);
      expect(bd.count('rp.rol_id = $1')).toBe(1);
      expect(cache.escrituras).toHaveLength(1);
    });

    it('cache-hit: las peticiones HTTP repetidas no vuelven a consultar la matriz', async () => {
      await request(app).get('/api/v1/admin/roles-permisos').set('x-usuario-id', CUENTA_ADMIN);
      const trasPrimera = bd.count('rp.rol_id = $1');

      await request(app).get('/api/v1/admin/roles-permisos').set('x-usuario-id', CUENTA_ADMIN);

      expect(bd.count('rp.rol_id = $1')).toBe(trasPrimera);
    });

    it('puede saltarse la caché de forma explícita', async () => {
      await servicio.obtenerPermisosDeRol(IDs.ESTUDIANTE);
      await servicio.obtenerPermisosDeRol(IDs.ESTUDIANTE, { usarCache: false });

      expect(bd.count('rp.rol_id = $1')).toBe(2);
    });
  });

  describe('3. Invalidación de caché tras modificar la matriz', () => {
    it('invalida la clave del rol y vuelve a publicar los permisos vigentes', async () => {
      await servicio.obtenerPermisosDeRol(IDs.ESTUDIANTE);
      expect(cache.invalidaciones).toEqual([]);

      const resultado = await servicio.actualizarPermisosDeRol({
        rol_id: IDs.ESTUDIANTE,
        codigos_permisos: ['expediente.ver', 'reporte.ver'],
      });

      expect(resultado.codigo).toBe('ESTUDIANTE');
      expect(resultado.permisos_agregados).toEqual([]);
      expect(resultado.permisos_revocados).toEqual(
        PERMISOS_ESTUDIANTE.filter((c) => !['expediente.ver', 'reporte.ver'].includes(c)).sort(),
      );
      expect(cache.invalidaciones).toEqual([IDs.ESTUDIANTE]);
      expect(cache.escrituras.at(-1)?.permisos).toEqual(['expediente.ver', 'reporte.ver'].sort());
    });

    it('un permiso revocado deja de concederse en la siguiente petición (fail closed)', async () => {
      await servicio.obtenerPermisosDeRol(IDs.ESTUDIANTE);
      expect(await servicio.rolTienePermiso(IDs.ESTUDIANTE, 'firma.solicitar')).toBe(true);

      await servicio.actualizarPermisosDeRol({
        rol_id: IDs.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      expect(await servicio.rolTienePermiso(IDs.ESTUDIANTE, 'firma.solicitar')).toBe(false);
      expect(await servicio.rolTienePermiso(IDs.ESTUDIANTE, 'expediente.ver')).toBe(true);
    });

    it('un permiso agregado se concede después de actualizar la matriz', async () => {
      await servicio.actualizarPermisosDeRol({
        rol_id: IDs.MESA_PARTES,
        codigos_permisos: ['radicacion.registrar', 'expediente.crear', 'auditoria.ver'],
      });

      expect(await servicio.rolTienePermiso(IDs.MESA_PARTES, 'auditoria.ver')).toBe(true);
    });

    it('propaga la invalidación por Pub/Sub cuando hay varias instancias', async () => {
      const publicaciones: string[] = [];
      const servicioConPubSub = new RbacService(comoClienteSql(bd), cache, {
        propagarInvalidacion: async (rol_id) => {
          publicaciones.push(rol_id);
        },
      });

      const resultado = await servicioConPubSub.actualizarPermisosDeRol({
        rol_id: IDs.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      expect(publicaciones).toEqual([IDs.ESTUDIANTE]);
      expect(resultado.cache_invalidation).toEqual({ emitido_local: true, propagado: true });
    });

    it('sin Pub/Sub configurado la invalidación local sí ocurre', async () => {
      const resultado = await servicio.actualizarPermisosDeRol({
        rol_id: IDs.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      expect(resultado.cache_invalidation).toEqual({ emitido_local: true, propagado: false });
      expect(cache.invalidaciones).toContain(IDs.ESTUDIANTE);
    });

    it('registra la mutación en la bitácora de auditoría', async () => {
      await servicio.actualizarPermisosDeRol({
        rol_id: IDs.ESTUDIANTE,
        codigos_permisos: ['expediente.ver'],
      });

      expect(bd.count('sigd_audit.bitacora_auditoria')).toBe(1);
    });

    it('la revocación surte efecto también sobre una petición HTTP posterior', async () => {
      const antes = await request(app).post('/firma/firmar').set('x-usuario-id', CUENTA_ESTUDIANTE);
      expect(antes.status).toBe(403);

      estado.usuarioRoles.set(CUENTA_ESTUDIANTE, [{ rol_id: IDs.DOCENTE, codigo: 'DOCENTE' }]);
      await servicio.actualizarPermisosDeRol({ rol_id: IDs.DOCENTE, codigos_permisos: [] });

      const despues = await request(app).post('/firma/firmar').set('x-usuario-id', CUENTA_ESTUDIANTE);
      expect(despues.status).toBe(403);
    });
  });

  describe('4. Validación de las actualizaciones', () => {
    it('rechaza permisos que no existen en el catálogo con 400 e invalid_params', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN)
        .send({
          rol_id: IDs.ESTUDIANTE,
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
        .set('x-usuario-id', CUENTA_ADMIN)
        .send({ rol_id: IDs.ESTUDIANTE, codigos_permisos: ['permiso.inexistente'] });

      expect(estado.matriz.get(IDs.ESTUDIANTE)).toEqual(new Set(PERMISOS_ESTUDIANTE));
    });

    it('rechaza un rol_id que no es UUID', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN)
        .send({ rol_id: 'no-es-uuid', codigos_permisos: [] });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.code).toBe('VALIDATION_ERROR');
    });

    it('rechaza códigos de permiso con formato inválido', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN)
        .send({ rol_id: IDs.ESTUDIANTE, codigos_permisos: ['PERMISO_SIN_PUNTO'] });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.code).toBe('VALIDATION_ERROR');
    });

    it('responde 404 cuando el rol no existe', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN)
        .send({ rol_id: '99999999-9999-4999-8999-999999999999', codigos_permisos: [] });

      expect(respuesta.status).toBe(404);
      expect(respuesta.body.code).toBe('NOT_FOUND');
    });

    it('responde 409 al modificar los permisos de un rol inactivo', async () => {
      estado.roles[4] = { ...estado.roles[4], activo: false };

      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN)
        .send({ rol_id: IDs.ESTUDIANTE, codigos_permisos: ['expediente.ver'] });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.code).toBe('ROL_INACTIVO');
    });

    it('admite un array vacío para revocar todos los permisos de un rol', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN)
        .send({ rol_id: IDs.MESA_PARTES, codigos_permisos: [] });

      expect(respuesta.status).toBe(200);
      expect(estado.matriz.get(IDs.MESA_PARTES)?.size).toBe(0);
    });

    it('normaliza duplicados y espacios en blanco', async () => {
      const respuesta = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN)
        .send({
          rol_id: IDs.MESA_PARTES,
          codigos_permisos: ['  expediente.ver  ', 'expediente.ver', 'radicacion.registrar'],
        });

      expect(respuesta.status).toBe(200);
      expect([...(estado.matriz.get(IDs.MESA_PARTES) ?? [])].sort()).toEqual([
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

    it('responde 403 cuando la cuenta no tiene ningún rol vigente', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_SIN_ROL);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.code).toBe('FORBIDDEN');
    });

    it('ignora un encabezado x-rol falsificado: el rol sale de PostgreSQL', async () => {
      const respuesta = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ESTUDIANTE)
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

      const respuesta = await request(appSinAuth).post('/directo').set('x-usuario-id', CUENTA_ADMIN);

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.code).toBe('UNAUTHORIZED');
    });

    it('deniega el acceso cuando el permiso exigido no existe en el catálogo', async () => {
      const appFantasma = express();
      appFantasma.use(express.json());
      appFantasma.use(contextMiddleware);
      appFantasma.use((req, _res, next) => {
        conectarActor(req, { cuenta_id: CUENTA_ADMIN, roles: [{ rol_id: IDs.SUPER_ADMIN, codigo: 'SUPER_ADMIN' }] });
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
        conectarActor(req, { cuenta_id: CUENTA_ADMIN, roles: [{ rol_id: IDs.SUPER_ADMIN, codigo: 'SUPER_ADMIN' }] });
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
      estado.matriz.set(IDs.ESTUDIANTE, new Set());
      await cache.guardar(IDs.ESTUDIANTE, []);

      const admin = await request(app).get('/api/v1/admin/roles-permisos').set('x-usuario-id', CUENTA_ADMIN);
      expect(admin.status).toBe(200);

      const estudiante = await request(app)
        .get('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ESTUDIANTE);
      expect(estudiante.status).toBe(403);
    });

    it('SUPER_ADMIN no puede conceder permisos inexistentes ni tocar otros roles sin permiso', async () => {
      const invalido = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN)
        .send({ rol_id: IDs.DOCENTE, codigos_permisos: ['permiso.fabricalo'] });
      expect(invalido.status).toBe(400);

      const valido = await request(app)
        .put('/api/v1/admin/roles-permisos')
        .set('x-usuario-id', CUENTA_ADMIN)
        .send({
          rol_id: IDs.DOCENTE,
          codigos_permisos: ['expediente.ver', 'firma.firmar', 'auditoria.ver'],
        });
      expect(valido.status).toBe(200);
      expect(estado.matriz.get(IDs.DOCENTE)).toEqual(
        new Set(['expediente.ver', 'firma.firmar', 'auditoria.ver']),
      );
    });
  });
});

import request from 'supertest';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

const usuarioCasilla = '11111111-1111-4111-8111-111111111111';
const otroUsuarioCasilla = '22222222-2222-4222-8222-222222222222';
const notificacionCasilla = '33333333-3333-4333-8333-333333333333';
const rutasCasilla = [
  { method: 'get', path: '/casilla/notificaciones' },
  { method: 'get', path: '/casilla/bandeja' },
  { method: 'get', path: '/casilla/estadisticas' },
  { method: 'get', path: `/casilla/notificaciones/${notificacionCasilla}` },
  { method: 'patch', path: `/casilla/notificaciones/${notificacionCasilla}/lectura` },
  { method: 'post', path: `/casilla/notificaciones/${notificacionCasilla}/acuse` },
  { method: 'get', path: `/casilla/notificaciones/${notificacionCasilla}/documento/descargar` },
  { method: 'get', path: `/casilla/notificaciones/${notificacionCasilla}/acuse/descargar` },
] as const;
const rutasRecursoCasilla = rutasCasilla.slice(3);

/** Pool exclusivamente en memoria: estas pruebas no abren conexiones PostgreSQL ni S3. */
function prepararCasilla(
  propietario: string | null = usuarioCasilla,
  perderPropiedad = false,
  opciones: { cuenta?: 'activa' | 'inexistente' | 'desactivada'; falloCuenta?: boolean } = {},
) {
  const fila = {
    id: notificacionCasilla,
    usuario_id: propietario,
    correo_destinatario: null,
    cut: 'EXP-2026-999999',
    asunto: 'Notificación sintética de prueba unitaria',
    tipo_acto: 'PRUEBA',
    numero_documento: 'PRUEBA-UNITARIA',
    cuerpo: {},
    referencia: null,
    estado: 'NO_LEIDO',
    fecha_deposito: '2026-01-05T13:00:00.000Z',
    fecha_lectura: null as string | null,
    hash_sha256: 'a'.repeat(64),
    cvd: 'CVD-PRUEBA-UNITARIA',
    id_acuse: null as string | null,
    acuse_hash_sha256: null as string | null,
    acuse_sellado_tiempo: null as string | null,
    documento_url: null as string | null,
    creado_en: '2026-01-05T13:00:00.000Z',
  };
  const query = vi.fn(async (sql: string, parametros: unknown[] = []) => {
    if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
      expect(sql).toContain('WHERE id_usuario = $1::uuid AND activo = TRUE');
      expect(parametros).toHaveLength(1);
      if (opciones.falloCuenta) throw new Error('Estado de cuenta no disponible en prueba aislada.');
      const activa = !opciones.cuenta || opciones.cuenta === 'activa';
      return { rows: activa ? [{ id_usuario: parametros[0] }] : [], rowCount: activa ? 1 : 0 };
    }
    if (sql.startsWith('SELECT *')) {
      return { rows: parametros[0] === fila.id ? [{ ...fila }] : [], rowCount: parametros[0] === fila.id ? 1 : 0 };
    }
    if (sql.includes('COUNT(*)') || sql.includes('ORDER BY fecha_deposito')) {
      expect(sql).toMatch(/WHERE usuario_id = \$1/);
      // El OR de búsqueda asunto/CUT es legítimo; no puede ampliar la propiedad.
      expect(sql).not.toMatch(/usuario_id IS NULL|\bOR\s+\$1\s*=|WHERE usuario_id = \$1\s+OR\b/);
      const propia = parametros[0] === fila.usuario_id;
      if (sql.includes('FILTER')) {
        return { rows: [{ no_leidas: propia && fila.estado === 'NO_LEIDO' ? '1' : '0', total: propia ? '1' : '0' }], rowCount: 1 };
      }
      if (sql.includes('COUNT(*)')) return { rows: [{ total: propia ? '1' : '0' }], rowCount: 1 };
      return { rows: propia ? [{ ...fila }] : [], rowCount: propia ? 1 : 0 };
    }
    if (sql.includes('UPDATE sigd_auth.notificacion_casilla')) {
      if (perderPropiedad) fila.usuario_id = otroUsuarioCasilla;
      const lectura = sql.includes("SET estado = 'LEIDO'");
      expect(sql).toMatch(lectura ? /WHERE id = \$1 AND usuario_id = \$2::uuid/ : /WHERE id = \$4 AND usuario_id = \$5::uuid/);
        const id = parametros[lectura ? 0 : 3];
        const usuario = parametros[lectura ? 1 : 4];
      if (id !== fila.id || usuario !== fila.usuario_id || (!lectura && fila.id_acuse)) {
        return { rows: [], rowCount: 0 };
      }
      if (lectura) {
        fila.estado = 'LEIDO';
        fila.fecha_lectura ??= '2026-01-05T14:00:00.000Z';
      } else {
        fila.id_acuse = parametros[0] as string;
        fila.acuse_hash_sha256 = parametros[1] as string;
        fila.acuse_sellado_tiempo = parametros[2] as string;
      }
      return lectura
        ? { rows: [{ ...fila }], rowCount: 1 }
        : { rows: [{ acuse_sellado_tiempo: fila.acuse_sellado_tiempo }], rowCount: 1 };
    }
    throw new Error('Consulta inesperada en la prueba aislada de Casilla.');
  });
  return { app: construirApp({ query } as unknown as Pool), query, fila };
}

describe('Casilla: autenticación JWT y autorización por propietario', () => {
  const tokenPropio = () => firmarTokenAcceso({ sub: usuarioCasilla });

  describe.each([
    { caso: 'sin JWT', token: undefined, cabecera: undefined },
    { caso: 'JWT inválido', token: 'no.es.valido', cabecera: undefined },
    { caso: 'JWT con firma alterada', token: firmarTokenAcceso({ sub: usuarioCasilla }).replace(/.$/, c => c === 'a' ? 'b' : 'a'), cabecera: undefined },
    { caso: 'JWT expirado', token: firmarTokenAcceso({ sub: usuarioCasilla, ahora: Date.now() - 60_000, expiraSegundos: 1 }), cabecera: undefined },
    { caso: 'solo x-usuario-id', token: undefined, cabecera: usuarioCasilla },
    { caso: 'JWT inválido con cabecera de respaldo', token: 'no.es.valido', cabecera: usuarioCasilla },
    { caso: 'JWT firmado con identidad no UUID', token: firmarTokenAcceso({ sub: 'identidad-no-valida' }), cabecera: undefined },
  ])('$caso', ({ token, cabecera }) => {
    it.each(rutasCasilla)('$method $path devuelve 401 sin consultar PostgreSQL', async ({ method, path }) => {
      const { app, query } = prepararCasilla();
      const peticion = request(app)[method](`/api/v1${path}`);
      if (token) peticion.set('Authorization', `Bearer ${token}`);
      if (cabecera) peticion.set('x-usuario-id', cabecera);
      const res = await peticion;
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe.each(['inexistente', 'desactivada'] as const)('cuenta %s con JWT vigente', cuenta => {
    it.each(rutasCasilla)('$method $path devuelve 403 antes de acceder a notificaciones', async ({ method, path }) => {
      const { app, query, fila } = prepararCasilla(usuarioCasilla, false, { cuenta });
      const anterior = { ...fila };
      const res = await request(app)[method](`/api/v1${path}`)
        .set('Authorization', `Bearer ${tokenPropio()}`)
        .set('x-usuario-id', otroUsuarioCasilla);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.downloadUrl).toBeUndefined();
      expect(res.body.data).toBeUndefined();
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][1]).toEqual([usuarioCasilla]);
      expect(fila).toEqual(anterior);
    });
  });

  it.each(rutasCasilla)('$method $path falla de forma segura si PostgreSQL no permite verificar la cuenta', async ({ method, path }) => {
    const { app, query, fila } = prepararCasilla(usuarioCasilla, false, { falloCuenta: true });
    const anterior = { ...fila };
    const res = await request(app)[method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${tokenPropio()}`);
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.downloadUrl).toBeUndefined();
    expect(res.body.data).toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
    expect(fila).toEqual(anterior);
  });

  it('consulta el estado actual en cada petición aunque se reutilice el mismo JWT', async () => {
    const opciones: { cuenta: 'activa' | 'desactivada' } = { cuenta: 'activa' };
    const { app, query } = prepararCasilla(usuarioCasilla, false, opciones);
    const token = tokenPropio();
    const consultar = () => request(app).get('/api/v1/casilla/bandeja')
      .set('Authorization', `Bearer ${token}`);
    expect((await consultar()).status).toBe(200);
    opciones.cuenta = 'desactivada';
    query.mockClear();
    expect((await consultar()).status).toBe(403);
    expect(query).toHaveBeenCalledTimes(1);
  });

  describe.each([
    { caso: 'notificación ajena', propietario: otroUsuarioCasilla },
    { caso: 'notificación sin propietario definido', propietario: null },
  ])('$caso', ({ propietario }) => {
    it.each(rutasRecursoCasilla)('$method $path devuelve 403 sin escrituras ni descarga', async ({ method, path }) => {
      const { app, query, fila } = prepararCasilla(propietario);
      const anterior = { ...fila };
      const res = await request(app)[method](`/api/v1${path}`)
        .set('Authorization', `Bearer ${tokenPropio()}`)
        .set('x-usuario-id', propietario ?? usuarioCasilla);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.downloadUrl).toBeUndefined();
      expect(res.body.data).toBeUndefined();
      expect(fila).toEqual(anterior);
      expect(query.mock.calls.every(([sql]) => !sql.includes('UPDATE'))).toBe(true);
    });

    it.each(rutasCasilla.slice(0, 3))('$path excluye filas no propias de listados y contadores', async ({ path }) => {
      const { app } = prepararCasilla(propietario);
      const res = await request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${tokenPropio()}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      if (res.body.notificaciones) expect(res.body.notificaciones).toEqual([]);
    });
  });

  it.each(rutasCasilla)('$method $path conserva el éxito y usa el propietario del JWT', async ({ method, path }) => {
    const { app, query } = prepararCasilla();
    const peticion = request(app)[method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${tokenPropio()}`)
      .set('x-usuario-id', otroUsuarioCasilla);
    if (method === 'post') peticion.send({ confirmacionAdministrado: true });
    const res = await peticion;
    const documentoSinReferencia = path.endsWith('/documento/descargar');
    const acuseSinRegistro = path.endsWith('/acuse/descargar');
    expect(res.status).toBe(documentoSinReferencia ? 503 : acuseSinRegistro ? 409 : method === 'post' ? 201 : 200);
    if (documentoSinReferencia) {
      expect(res.body.code).toBe('STORAGE_REFERENCE_UNAVAILABLE');
      expect(res.body).not.toHaveProperty('downloadUrl');
    } else if (acuseSinRegistro) {
      expect(res.body.code).toBe('ACK_NOT_REGISTERED');
      expect(res.body).not.toHaveProperty('downloadUrl');
    } else expect(res.body.code).toBeUndefined();
    expect(query.mock.calls.flatMap(([, parametros]) => parametros ?? [])).not.toContain(otroUsuarioCasilla);
    if (documentoSinReferencia) {
      // No existe un PDF vinculado en este fixture; no se inventa una clave S3.
    } else if (acuseSinRegistro) {
      expect(res.body.code).toBe('ACK_NOT_REGISTERED');
    } else if (path.endsWith('descargar')) {
      expect(res.body).toMatchObject({ downloadUrl: expect.any(String), expiraEnSegundos: 900 });
    } else if (path.endsWith('lectura')) {
      expect(res.body).toEqual({ idNotificacion: notificacionCasilla, estado: 'LEIDO', leidoEn: expect.any(String) });
    } else if (method === 'post') {
      expect(res.body.success).toBe(true);
      expect(res.body.data.idNotificacion).toBe(notificacionCasilla);
    } else if (res.body.notificaciones) {
      expect(res.body.notificaciones).toHaveLength(1);
      expect(res.body.data).toEqual(res.body.notificaciones);
      expect(res.body.meta.totalItems).toBe(1);
    } else if (path.endsWith('estadisticas')) {
      expect(res.body).toMatchObject({ total: 1, noLeidas: 1, noLeidos: 1, leidos: 0 });
    } else {
      expect(res.body).toMatchObject({ id: notificacionCasilla, usuarioId: usuarioCasilla });
    }
  });

  it.each(rutasRecursoCasilla)('$method $path conserva 404 para un recurso inexistente', async ({ method, path }) => {
    const { app, query } = prepararCasilla();
    const res = await request(app)[method](`/api/v1${path.replace(notificacionCasilla, otroUsuarioCasilla)}`)
      .set('Authorization', `Bearer ${tokenPropio()}`);
    expect(res.status).toBe(404);
    expect(query.mock.calls.every(([sql]) => !sql.includes('UPDATE'))).toBe(true);
  });

  it('conserva la primera lectura y recupera el acuse propio sin volver a emitirlo', async () => {
    const { app, query } = prepararCasilla();
    const token = tokenPropio();
    const lectura = () => request(app).patch(`/api/v1/casilla/notificaciones/${notificacionCasilla}/lectura`).set('Authorization', `Bearer ${token}`);
    const primera = await lectura();
    const segunda = await lectura();
    expect(segunda.body).toEqual(primera.body);
    const acuse = () => request(app).post(`/api/v1/casilla/notificaciones/${notificacionCasilla}/acuse`).set('Authorization', `Bearer ${token}`).send({ confirmacionAdministrado: true });
    const primero = await acuse();
    expect(primero.status).toBe(201);
    query.mockClear();
    const existente = await acuse();
    expect(existente.status).toBe(200);
    expect(existente.body.data.timestampGeneracionIso).toBe(primero.body.data.timestampGeneracionIso);
    expect(existente.body.data.timestampGeneracionIso).toEqual(expect.any(String));
    expect(existente.body.data.cvdAcuse).toBeNull();
    expect(query.mock.calls.every(([sql]) => !sql.includes('UPDATE'))).toBe(true);
  });

  it('el detalle refleja únicamente metadatos persistidos y no genera identificadores o firmas ficticios', async () => {
    const { app } = prepararCasilla();
    const res = await request(app).get(`/api/v1/casilla/notificaciones/${notificacionCasilla}`)
      .set('Authorization', `Bearer ${tokenPropio()}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: notificacionCasilla,
      numeroNotificacion: notificacionCasilla,
      numeroExpediente: 'EXP-2026-999999',
      estado: 'NO_LEIDO',
      actoAdministrativo: {
        numeroDocumento: 'PRUEBA-UNITARIA',
        hashIntegridadSha256: 'a'.repeat(64),
        cvd: 'CVD-PRUEBA-UNITARIA',
        firmantes: [],
      },
    });
    expect(res.body.actoAdministrativo.nombreArchivoPdf).toBeNull();
    expect(res.body.acuse).toBeNull();
  });

  it('requiere confirmación explícita y no escribe un acuse sin ella', async () => {
    const { app, query } = prepararCasilla();
    const res = await request(app).post(`/api/v1/casilla/notificaciones/${notificacionCasilla}/acuse`)
      .set('Authorization', `Bearer ${tokenPropio()}`)
      .send({ confirmacionAdministrado: false });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ACK_CONFIRMATION_REQUIRED');
    expect(query.mock.calls.every(([sql]) => !sql.includes('UPDATE'))).toBe(true);
  });

  it('no otorga acceso general al UUID usado anteriormente como identidad predeterminada', async () => {
    const { app } = prepararCasilla(otroUsuarioCasilla);
    const token = firmarTokenAcceso({ sub: '00000000-0000-0000-0000-000000000001' });
    const listado = await request(app).get('/api/v1/casilla/bandeja').set('Authorization', `Bearer ${token}`);
    expect(listado.status).toBe(200);
    expect(listado.body.total).toBe(0);
    expect((await request(app).get(`/api/v1/casilla/notificaciones/${notificacionCasilla}`).set('Authorization', `Bearer ${token}`)).status).toBe(403);
  });

  it('mantiene búsqueda y paginación dentro de la propiedad autenticada', async () => {
    const { app, query } = prepararCasilla();
    const res = await request(app).get('/api/v1/casilla/notificaciones?page=2&limit=5&estado=NO_LEIDO&busqueda=prueba')
      .set('Authorization', `Bearer ${tokenPropio()}`);
    expect(res.status).toBe(200);
    const consultasNotificaciones = query.mock.calls.filter(([sql]) => sql.includes('FROM sigd_auth.notificacion_casilla'));
    expect(consultasNotificaciones[0][1]).toEqual([usuarioCasilla, 'NO_LEIDO', '%prueba%']);
    expect(consultasNotificaciones[1][1]).toEqual([usuarioCasilla, 'NO_LEIDO', '%prueba%', 5, 5]);
    expect(res.body).toMatchObject({ pagina: 2, porPagina: 5 });
  });

  it('aplica tipo y rango de fechas antes del conteo y de la paginación', async () => {
    const { app, query } = prepararCasilla();
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones?tipo=RESOLUCION&fechaInicio=2026-01-01&fechaFin=2026-01-31&limit=1')
      .set('Authorization', `Bearer ${tokenPropio()}`);
    expect(res.status).toBe(200);
    const consultas = query.mock.calls.filter(([sql]) => sql.includes('FROM sigd_auth.notificacion_casilla'));
    expect(consultas).toHaveLength(2);
    for (const [sql, params] of consultas) {
      expect(sql).toContain('WHERE usuario_id = $1');
      expect(sql).toContain('translate(upper(tipo_acto)');
      expect(sql).toContain('fecha_deposito >= $3::date');
      expect(sql).toContain("fecha_deposito < ($4::date + INTERVAL '1 day')");
      expect(params?.slice(0, 4)).toEqual([usuarioCasilla, 'RESOLUCION', '2026-01-01', '2026-01-31']);
    }
  });

  it('rechaza fechas imposibles y rangos invertidos antes de consultar notificaciones', async () => {
    const { app, query } = prepararCasilla();
    for (const parametros of ['fechaInicio=2026-02-30', 'fechaInicio=2026-03-02&fechaFin=2026-03-01']) {
      query.mockClear();
      const res = await request(app).get(`/api/v1/casilla/notificaciones?${parametros}`)
        .set('Authorization', `Bearer ${tokenPropio()}`);
      expect(res.status).toBe(400);
      expect(query.mock.calls.every(([sql]) => !sql.includes('FROM sigd_auth.notificacion_casilla'))).toBe(true);
    }
  });

  it.each(['https://almacen-prueba.invalid/acto.pdf?firma=sintetica', '/api/v1/storage/download/pruebas/documento.pdf'])
  ('la descarga de documento utiliza la referencia persistida %s', async referencia => {
    const { app, fila } = prepararCasilla();
    fila.documento_url = referencia;
    const res = await request(app).get(`/api/v1/casilla/notificaciones/${notificacionCasilla}/documento/descargar`)
      .set('Authorization', `Bearer ${tokenPropio()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ downloadUrl: referencia, expiraEnSegundos: 900 });
  });

  it('no genera un documento de acuse a partir de un identificador sin referencia persistida', async () => {
    const { app, fila } = prepararCasilla();
    fila.id_acuse = 'ACU-2026-00000001';
    const res = await request(app).get(`/api/v1/casilla/notificaciones/${notificacionCasilla}/acuse/descargar`)
      .set('Authorization', `Bearer ${tokenPropio()}`);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ACK_DOCUMENT_REFERENCE_UNAVAILABLE');
    expect(res.body).not.toHaveProperty('downloadUrl');
  });

  it.each(['javascript:alert(1)', '//otro-servidor.invalid/a', 'archivo-sin-referencia.pdf'])
  ('no inventa ni devuelve una referencia de descarga inválida %s', async referencia => {
    const { app, fila } = prepararCasilla();
    fila.documento_url = referencia;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get(`/api/v1/casilla/notificaciones/${notificacionCasilla}/documento/descargar`)
      .set('Authorization', `Bearer ${tokenPropio()}`);
    expect(res.status).toBe(503);
    expect(res.body).not.toHaveProperty('downloadUrl');
  });

  it('el filtro NOTIFICADO usa el acuse persistido antes del conteo y paginación', async () => {
    const { app, query, fila } = prepararCasilla();
    fila.id_acuse = 'ACUSE-SINTETICO';
    const res = await request(app).get('/api/v1/casilla/notificaciones?estado=NOTIFICADO&limit=1')
      .set('Authorization', `Bearer ${tokenPropio()}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].estado).toBe('NOTIFICADO');
    const consultas = query.mock.calls.filter(([sql]) => sql.includes('FROM sigd_auth.notificacion_casilla'));
    expect(consultas).toHaveLength(2);
    for (const [sql, params] of consultas) {
      expect(sql).toContain('WHERE usuario_id = $1 AND (CASE WHEN id_acuse IS NOT NULL');
      expect(params?.slice(0, 2)).toEqual([usuarioCasilla, 'NOTIFICADO']);
    }
  });

  it('las estadísticas separan lectura y acuse sin contar toda la casilla como notificada', async () => {
    const { app, query } = prepararCasilla();
    query.mockImplementationOnce(async () => ({ rows: [{ id_usuario: usuarioCasilla }], rowCount: 1 }))
      .mockImplementationOnce(async (sql, params) => {
        expect(sql).toContain("= 'NOTIFICADO')::text AS notificadas");
        expect(sql).toContain("= 'LEIDO')::text AS leidas");
        expect(params).toEqual([usuarioCasilla]);
        return { rows: [{ no_leidas: '2', leidas: '1', notificadas: '3', total: '6' }], rowCount: 1 };
      });
    const res = await request(app).get('/api/v1/casilla/estadisticas')
      .set('Authorization', `Bearer ${tokenPropio()}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 6, noLeidos: 2, leidos: 1, notificados: 3 });
  });

  it.each(rutasCasilla.filter(({ method }) => method !== 'get'))('no confirma $path si cambia el propietario antes del UPDATE', async ({ method, path }) => {
    const { app, fila } = prepararCasilla(usuarioCasilla, true);
    const peticion = request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${tokenPropio()}`);
    if (method === 'post') peticion.send({ confirmacionAdministrado: true });
    const res = await peticion;
    expect(res.status).toBe(method === 'post' ? 409 : 404);
    expect(fila.estado).toBe('NO_LEIDO');
    expect(fila.id_acuse).toBeNull();
  });
});

describe('Auth Router — Schema Alignment & Database Interactions', () => {
  const hashValido = Argon2Service.generateFallbackHash('PasswordValida123!');

  it('POST /api/v1/auth/login ejecuta query alineada a 02_sigd_auth y 03_sigd_org', async () => {
    let capturedQuery = '';
    let capturedParams: any[] = [];
    let sessionInsertExecuted = false;

    const fakePool = {
      query: vi.fn(async (queryText: string, params?: any[]) => {
        if (queryText.includes('sigd_org.usuario_capacidad')) return { rows: [], rowCount: 0 };
        if (queryText.includes('AS permisos')) return { rows: [{ id_asignacion: '33333333-3333-3333-3333-333333333333', codigo: 'ADMINISTRADOR', nombre: 'Administrador', roles: ['ADMINISTRADOR'], permisos: [] }], rowCount: 1 };
        if (queryText.includes('FROM sigd_auth.cuenta_usuario')) {
          capturedQuery = queryText;
          capturedParams = params ?? [];
          return {
            rows: [
              {
                id_usuario: '11111111-1111-1111-1111-111111111111',
                id_persona: '22222222-2222-2222-2222-222222222222',
                usuario: 'admin.institucional',
                correo: 'admin@iestp-suiza.edu.pe',
                password_hash: hashValido,
                activo: true,
                nombre_completo: 'Administrador General',
                rol_codigo: 'ADMINISTRADOR',
                area_id: null,
              },
            ],
            rowCount: 1,
          };
        }
        if (queryText.includes('INSERT INTO sigd_auth.sesion_usuario')) {
          sessionInsertExecuted = true;
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => ({
        query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
        release: vi.fn(),
      })),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identificador: 'admin.institucional',
        password: 'PasswordValida123!',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.usuario).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      nombreCompleto: 'Administrador General',
      correo: 'admin@iestp-suiza.edu.pe',
      rol: 'ADMINISTRADOR',
    });

    // Validar alineación exacta de columnas en el SQL capturado
    expect(capturedQuery).toContain('c.usuario');
    expect(capturedQuery).toContain('c.correo');
    expect(capturedQuery).not.toContain('c.username');
    expect(capturedQuery).not.toContain('c.correo_institucional');
    expect(capturedQuery).not.toContain('bloqueado_hasta');
    expect(capturedQuery).toContain('(ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())');
    expect(capturedQuery).toContain('r.rol_id = ur.rol_id');
    expect(capturedQuery).not.toContain('r.id_rol');
    expect(capturedQuery).not.toContain('ur.estado');
    expect(capturedQuery).toContain('(c.usuario = $1 OR c.correo = $1)');
    expect(sessionInsertExecuted).toBe(true);
  });

  it('POST /api/v1/auth/login propaga error 500 si falla la insercion de sesion (no swallow)', async () => {
    const fakePool = {
      query: vi.fn(async (queryText: string) => {
        if (queryText.includes('sigd_org.usuario_capacidad')) return { rows: [], rowCount: 0 };
        if (queryText.includes('AS permisos')) return { rows: [{ id_asignacion: '33333333-3333-3333-3333-333333333333', codigo: 'ADMINISTRADOR', nombre: 'Administrador', roles: ['ADMINISTRADOR'], permisos: [] }], rowCount: 1 };
        if (queryText.includes('FROM sigd_auth.cuenta_usuario')) {
          return {
            rows: [
              {
                id_usuario: '11111111-1111-1111-1111-111111111111',
                usuario: 'admin.institucional',
                correo: 'admin@iestp-suiza.edu.pe',
                password_hash: hashValido,
                activo: true,
                nombre_completo: 'Admin',
                rol_codigo: 'ADMINISTRADOR',
              },
            ],
            rowCount: 1,
          };
        }
        if (queryText.includes('INSERT INTO sigd_auth.sesion_usuario')) {
          throw new Error('violacion de llave foranea o base de datos inaccesible');
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identificador: 'admin.institucional',
        password: 'PasswordValida123!',
      });

    // No debe tragar el error con 200
    expect(res.status).toBe(500);
  });

  it('POST /api/v1/auth/refresh ejecuta query alineada a rol_id y vigente_hasta', async () => {
    let capturedQuery = '';
    const expiraEn = new Date(Date.now() + 3600 * 1000).toISOString();

    const fakePool = {
      query: vi.fn(async (queryText: string) => {
        if (queryText.includes('sigd_org.usuario_capacidad')) return { rows: [], rowCount: 0 };
        if (queryText.includes('AS permisos')) return { rows: [{ id_asignacion: '33333333-3333-3333-3333-333333333333', codigo: 'ADMINISTRADOR', nombre: 'Administrador', roles: ['ADMINISTRADOR'], permisos: [] }], rowCount: 1 };
        if (queryText.includes('FROM sigd_auth.sesion_usuario s')) {
          capturedQuery = queryText;
          return {
            rows: [
              {
                id_usuario: '11111111-1111-1111-1111-111111111111',
                expira_en: expiraEn,
                revocado_en: null,
                rol_codigo: 'ADMINISTRADOR',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'abcdef1234567890abcdef1234567890' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');

    expect(capturedQuery).toContain('(ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())');
    expect(capturedQuery).toContain('r.rol_id = ur.rol_id');
    expect(capturedQuery).not.toContain('ur.estado');
    expect(capturedQuery).not.toContain('r.id_rol');
  });

  it('GET /api/v1/auth/me retorna usuario con correo y usuario alineados', async () => {
    let capturedQuery = '';
    const token = firmarTokenAcceso({
      sub: '11111111-1111-1111-1111-111111111111',
      roles: ['ADMINISTRADOR'],
      expiraSegundos: 300,
    });

    const fakePool = {
      query: vi.fn(async (queryText: string) => {
        if (queryText.includes('sigd_org.usuario_capacidad')) return { rows: [], rowCount: 0 };
        if (queryText.includes('AS permisos')) return { rows: [{ id_asignacion: '33333333-3333-3333-3333-333333333333', codigo: 'ADMINISTRADOR', nombre: 'Administrador', roles: ['ADMINISTRADOR'], permisos: [] }], rowCount: 1 };
        if (queryText.includes('FROM sigd_auth.cuenta_usuario c')) {
          capturedQuery = queryText;
          return {
            rows: [
              {
                id_usuario: '11111111-1111-1111-1111-111111111111',
                id_persona: '22222222-2222-2222-2222-222222222222',
                usuario: 'admin.institucional',
                correo: 'admin@iestp-suiza.edu.pe',
                nombre_completo: 'Administrador General',
                rol_codigo: 'ADMINISTRADOR',
                area_id: '33333333-3333-3333-3333-333333333333',
                cargo_id: null,
                telefono: '987654321',
                tipo_persona: 'NATURAL',
                id_documento: '12345678',
                tipo_documento: 'DNI',
                nombres: 'Ciudadana',
                apellidos: 'De Prueba',
                razon_social: null,
                fecha_nacimiento: '1990-01-02',
                correo_persona: 'persona@example.invalid',
                telefono_persona: '987654321',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      usuario: 'admin.institucional',
      correo: 'admin@iestp-suiza.edu.pe',
      nombreCompleto: 'Administrador General',
      rol: 'ADMINISTRADOR',
      identidad: {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        nombres: 'Ciudadana',
        apellidos: 'De Prueba',
        razonSocial: null,
        fechaNacimiento: '1990-01-02',
        correo: 'admin@iestp-suiza.edu.pe',
        telefono: '987654321',
      },
    });

    expect(capturedQuery).toContain('c.usuario');
    expect(capturedQuery).toContain('c.correo');
    expect(capturedQuery).toContain('persona.id_documento');
    expect(capturedQuery).toContain('persona_documento_historial');
    expect(capturedQuery).toContain("COALESCE(to_jsonb(p)->>'direccion', pj.direccion) AS direccion_persona");
    expect(capturedQuery).not.toContain('pn.direccion');
    expect(capturedQuery).not.toContain('c.username');
    expect(capturedQuery).not.toContain('c.correo_institucional');
    expect(capturedQuery).toContain('(ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())');
    expect(capturedQuery).toContain('r.rol_id = ur.rol_id');
  });
});

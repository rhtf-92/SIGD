// Doble del verificador SOLO para probar contratos HTTP. Criptografia real en verificadorPades.spec.ts.
vi.mock('../../src/domains/docucore/verificadorPades.service.js', () => ({ validarFirmaPades: vi.fn(async () => ({ valido: true, validacionCriptografica: true, integridadBytesProtegidos: true, tipoFirma: 'FIRMA_PADES_VALIDA', detalles: { tieneFirmaCms: true } })), obtenerPoliticaValidacionPades: vi.fn(() => ({ exigirTsa: false, exigirRevocacion: false })) }));
import { afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { construirApp } from '../../src/app.js';
import { crearRouterStorage } from '../../src/core/storage/storage.router.js';
import * as s3Storage from '../../src/core/storage/s3-storage.service.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../src/middleware/error-middleware.js';

const usuarioStorage = '11111111-1111-4111-8111-111111111111';
const personaStorage = '22222222-2222-4222-8222-222222222222';
const otroIdStorage = '33333333-3333-4333-8333-333333333333';
const expedienteStorage = '44444444-4444-4444-8444-444444444444';
const adjuntoStorage = '55555555-5555-4555-8555-555555555555';
const claveStorage = `expedientes/2026/${adjuntoStorage}.pdf`;
const bucketStorage = 'sigd-expedientes';
const tokenStorage = () => firmarTokenAcceso({ sub: usuarioStorage });
const rutaDescargaStorage = `/api/v1/storage/download/${bucketStorage}/${encodeURIComponent(claveStorage)}`;

afterEach(() => vi.restoreAllMocks());

describe('RutaDoc: autorización real del proveedor JWT con PostgreSQL simulado', () => {
  const usuario = '10000000-0000-4000-8000-000000000001';
  const persona = '20000000-0000-4000-8000-000000000002';
  const expediente = '30000000-0000-4000-8000-000000000003';
  const otraPersona = '40000000-0000-4000-8000-000000000004';
  const rutas = ['', '/trazabilidad', '/foliacion', '/sla-status'];
  const token = (roles: string[] = []) => firmarTokenAcceso({ sub: usuario, roles });

  function escenario() {
    const estado = {
      cuentaExiste: true, activa: true, propietario: persona as string | null,
      permiso: false, rolVigente: true, asignacionVigente: true,
      codigoPermiso: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', falla: false,
    };
    const query = vi.fn(async (sql: string, parametros?: unknown[]) => {
      if (sql.includes('AS permisos')) {
        if (estado.falla) throw new Error('Fallo PostgreSQL sintético');
        return { rows: estado.cuentaExiste && estado.activa ? [{ roles: [], permisos: [] }] : [], rowCount: 1 };
      }
      if (sql.includes('AS autorizado')) {
        // Comprobar la consulta productiva, no sólo devolver una autorización fija.
        for (const condicion of [
          'FROM sigd_auth.cuenta_usuario cu',
          'JOIN sigd_tra.expediente e ON e.expediente_id = $2::uuid',
          'cu.id_usuario = $1::uuid AND cu.activo = TRUE',
          'e.solicitante_id = cu.id_persona',
          'JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE',
          'JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id',
          'JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id',
          'ur.id_usuario = cu.id_usuario', 'ur.vigente_desde <= now()',
          'ur.vigente_hasta IS NULL OR ur.vigente_hasta > now()',
          "p.codigo = 'EXPEDIENTE_LEER' AND p.ambito = 'GLOBAL'",
        ]) expect(sql).toContain(condicion);
        expect(parametros).toEqual([usuario, expediente]);
        if (estado.falla) throw new Error('Fallo PostgreSQL sintético');
        const institucional = estado.permiso && estado.rolVigente && estado.asignacionVigente
          && estado.codigoPermiso === 'EXPEDIENTE_LEER' && estado.ambito === 'GLOBAL';
        return { rows: [{ autorizado: estado.cuentaExiste && estado.activa
          && (estado.propietario === persona || institucional) }], rowCount: 1 };
      }
      if (sql.includes('SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente')) {
        return { rows: [{ existe: true }], rowCount: 1 };
      }
      if (sql.includes('fecha_radicacion AT TIME ZONE')) {
        const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima',
          year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        return { rows: [{ fecha_inicio: hoy }], rowCount: 1 };
      }
      if (sql.includes('to_regclass')) return { rows: [{ existe: null }], rowCount: 1 };
      if (sql.includes('WITH historial AS') || sql.includes('SELECT id_documento::text')
          || sql.includes('sigd_tra.expediente_acumulacion') || sql.includes('sigd_rut.expediente_observacion')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('e.solicitante_id::text')) return { rows: [{
        id_expediente: expediente, cut: 'EXP-2026-999999', asunto: 'Fixture no persistido',
        fecha_radicacion: new Date('2026-10-18T12:00:00Z'), estado_actual: 'REGISTRADO',
        area_actual_id: null, solicitante_id: estado.propietario, id_movimiento: null,
        evento: null, fecha_hora: null, usuario_operador_id: null,
      }], rowCount: 1 };
      throw new Error('Consulta no prevista en prueba aislada RutaDoc');
    });
    const connect = vi.fn(() => { throw new Error('No se permiten transacciones ni escrituras'); });
    return { app: construirApp({ query, connect } as unknown as Pool), estado, query, connect };
  }

  describe.each(rutas)('GET /expedientes/:id%s', (sufijo) => {
    it.each(['ausente', 'inválido', 'expirado', 'sólo cabecera'])('deniega JWT %s', async (caso) => {
      const { app, query, connect } = escenario();
      const req = request(app).get(`/api/v1/expedientes/${expediente}${sufijo}`);
      if (caso === 'inválido') req.set('Authorization', 'Bearer no.es.valido');
      if (caso === 'expirado') req.set('Authorization', `Bearer ${firmarTokenAcceso({
        sub: usuario, ahora: Date.now() - 60_000, expiraSegundos: 1,
      })}`);
      if (caso === 'sólo cabecera') req.set('x-usuario-id', usuario);
      const res = await req;
      expect(res.status).toBe(401);
      expect(query).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    });

    it('permite al propietario sin exigir roles en el JWT', async () => {
      const { app, connect } = escenario();
      const res = await request(app).get(`/api/v1/expedientes/${expediente}${sufijo}`)
        .set('Authorization', `Bearer ${token()}`).set('x-usuario-id', otraPersona);
      expect(res.status, res.text).toBe(200);
      if (sufijo === '') expect(res.body).toMatchObject({ idExpediente: expediente,
        cut: 'EXP-2026-999999', solicitanteId: persona, resumenDocumentos: null,
        ultimoMovimiento: null, sla: null });
      if (sufijo === '/trazabilidad') expect(res.body).toEqual({ expedienteId: expediente, actuaciones: [] });
      expect(connect).not.toHaveBeenCalled();
    });

    it.each(['ajeno sin roles', 'rol JWT sin permiso', 'cuenta inexistente', 'cuenta inactiva',
      'sin propietario', 'rol revocado', 'asignación fuera de vigencia', 'permiso de área', 'otro permiso'])
    ('deniega %s sin exponer el expediente', async (caso) => {
      const { app, estado, query } = escenario();
      estado.propietario = otraPersona;
      if (caso === 'cuenta inexistente') estado.cuentaExiste = false;
      if (caso === 'cuenta inactiva') { estado.activa = false; estado.permiso = true; }
      if (caso === 'sin propietario') estado.propietario = null;
      if (caso === 'rol revocado') { estado.permiso = true; estado.rolVigente = false; }
      if (caso === 'asignación fuera de vigencia') { estado.permiso = true; estado.asignacionVigente = false; }
      if (caso === 'permiso de área') { estado.permiso = true; estado.ambito = 'AREA'; }
      if (caso === 'otro permiso') { estado.permiso = true; estado.codigoPermiso = 'EXPEDIENTE_DERIVAR'; }
      const res = await request(app).get(`/api/v1/expedientes/${expediente}${sufijo}`)
        .set('Authorization', `Bearer ${token(caso === 'rol JWT sin permiso' ? ['SUPER_ADMIN'] : [])}`)
        .set('x-usuario-id', persona);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'FORBIDDEN' });
      expect(res.body).not.toHaveProperty('actuaciones');
      expect(res.body).not.toHaveProperty('solicitanteId');
      expect(query.mock.calls.some(([sql]) => sql.includes('e.solicitante_id::text')
        || sql.includes('WITH historial AS') || sql.includes('SELECT id_documento::text'))).toBe(false);
    });

    it('permite un permiso GLOBAL comprobado, aunque el JWT no declare roles', async () => {
      const { app, estado } = escenario();
      estado.propietario = otraPersona;
      estado.permiso = true;
      const res = await request(app).get(`/api/v1/expedientes/${expediente}${sufijo}`)
        .set('Authorization', `Bearer ${token()}`);
      expect(res.status, res.text).toBe(200);
    });

    it('falla cerrado cuando PostgreSQL no permite comprobar el acceso', async () => {
      const { app, estado } = escenario();
      estado.falla = true;
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(app).get(`/api/v1/expedientes/${expediente}${sufijo}`)
        .set('Authorization', `Bearer ${token()}`);
      expect(res.status).toBe(500);
      expect(res.body).not.toHaveProperty('actuaciones');
      expect(res.body).not.toHaveProperty('solicitanteId');
    });
  });

  it('consulta de nuevo el estado y los permisos con el mismo JWT en cada solicitud', async () => {
    const { app, estado } = escenario();
    estado.propietario = otraPersona;
    estado.permiso = true;
    const bearer = `Bearer ${token()}`;
    const consultar = () => request(app).get(`/api/v1/expedientes/${expediente}`).set('Authorization', bearer);
    expect((await consultar()).status).toBe(200);
    estado.permiso = false;
    expect((await consultar()).status).toBe(403);
    estado.propietario = persona;
    expect((await consultar()).status).toBe(200);
    estado.activa = false;
    expect((await consultar()).status).toBe(403);
  });

  it('no utiliza como persona el sub del JWT ni acepta una identidad no UUID', async () => {
    const { app, estado, query } = escenario();
    estado.propietario = usuario;
    expect((await request(app).get(`/api/v1/expedientes/${expediente}`)
      .set('Authorization', `Bearer ${token()}`)).status).toBe(403);
    query.mockClear();
    expect((await request(app).get(`/api/v1/expedientes/${expediente}`)
      .set('Authorization', `Bearer ${firmarTokenAcceso({ sub: '7' })}`)).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('Seguridad de almacenamiento: JWT, propiedad y descarga pública CVD', () => {
  const rutas = [
    { metodo: 'get', ruta: rutaDescargaStorage },
    { metodo: 'post', ruta: '/api/v1/storage/presigned-url' },
    { metodo: 'post', ruta: '/api/v1/storage/confirmar-carga' },
  ] as const;

  describe.each([
    { caso: 'sin JWT', token: undefined, cabecera: undefined },
    { caso: 'JWT inválido', token: 'no.es.valido', cabecera: undefined },
    { caso: 'JWT inválido con cabecera de respaldo', token: 'no.es.valido', cabecera: usuarioStorage },
    { caso: 'JWT expirado', token: firmarTokenAcceso({ sub: usuarioStorage, ahora: Date.now() - 60_000, expiraSegundos: 1 }), cabecera: undefined },
    { caso: 'firma alterada', token: tokenStorage().replace(/.$/, c => c === 'a' ? 'b' : 'a'), cabecera: undefined },
    { caso: 'cabecera sin JWT', token: undefined, cabecera: usuarioStorage },
    { caso: 'identidad JWT no UUID', token: firmarTokenAcceso({ sub: 'no-uuid' }), cabecera: undefined },
  ])('$caso', ({ token, cabecera }) => {
    it.each(rutas)('$metodo $ruta devuelve 401 antes de consultar o firmar', async ({ metodo, ruta }) => {
      const { app, query } = appStorage();
      const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned');
      const peticion = request(app)[metodo](ruta);
      if (token) peticion.set('Authorization', `Bearer ${token}`);
      if (cabecera) peticion.set('x-usuario-id', cabecera);
      const res = await peticion;
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(query).not.toHaveBeenCalled();
      expect(firmar).not.toHaveBeenCalled();
    });
  });

  it.each(rutas)('deniega $ruta a una cuenta inactiva aunque su JWT siga vigente', async ({ metodo, ruta }) => {
    const { app } = appStorage({ cuentaActiva: false });
    const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned');
    const res = await request(app)[metodo](ruta).set('Authorization', `Bearer ${tokenStorage()}`);
    expect(res.status).toBe(403);
    expect(firmar).not.toHaveBeenCalled();
  });

  it('sin PostgreSQL disponible no emite URLs como mecanismo de respaldo', async () => {
    const app = express();
    app.use(crearRouterStorage());
    app.use(errorMiddleware);
    const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned');
    const res = await request(app).get(`/storage/download/${bucketStorage}/${encodeURIComponent(claveStorage)}`)
      .set('Authorization', `Bearer ${tokenStorage()}`);
    expect(res.status).toBe(503);
    expect(firmar).not.toHaveBeenCalled();
  });

  it('firma la descarga propia solo después de consultar la cuenta y la relación documental', async () => {
    const { app, query } = appStorage();
    const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned').mockImplementation(() => {
      expect(query).toHaveBeenCalledTimes(2);
      return 'https://almacen.invalid/descarga-temporal';
    });
    const res = await request(app).get(rutaDescargaStorage)
      .set('Authorization', `Bearer ${tokenStorage()}`).set('x-usuario-id', otroIdStorage);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['downloadUrl', 'expiraEnSegundos']);
    expect(res.body.expiraEnSegundos).toBe(900);
    expect(firmar).toHaveBeenCalledTimes(1);
    expect(firmar.mock.calls[0][0]).toBe(claveStorage);
    expect(firmar.mock.calls[0][1].bucket).toBe(bucketStorage);
    expect(firmar.mock.calls[0][2]).toMatchObject({ metodo: 'GET', expiraSegundos: 900 });
    // Una etiqueta de rol persistida tampoco sustituye al permiso documental.
    const sqlAutorizacion = query.mock.calls[1][0] as string;
    expect(sqlAutorizacion).not.toContain("OR r.codigo IN ('ADMINISTRADOR', 'DIRECTOR')");
    expect(sqlAutorizacion).toContain("p.codigo = 'EXPEDIENTE_LEER' AND p.ambito = 'GLOBAL' AND ur.area_id IS NULL");
    expect(sqlAutorizacion).toContain("r.codigo <> 'CIUDADANO'");
    expect(sqlAutorizacion).toContain("WHEN a_rut.expediente_id IS NOT NULL THEN NULLIF(a_rut.area_actual_id, '')");
    expect(sqlAutorizacion).not.toContain('OR ar.area_origen_id');
    expect(sqlAutorizacion).not.toContain('OR ar.area_destino_id');
  });

  it('deniega el documento ajeno incluso si el JWT declara un rol administrativo', async () => {
    const { app } = appStorage({ ajeno: true });
    const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned');
    const token = firmarTokenAcceso({ sub: usuarioStorage, roles: ['ADMINISTRADOR'] });
    const res = await request(app).get(rutaDescargaStorage).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.downloadUrl).toBeUndefined();
    expect(firmar).not.toHaveBeenCalled();
  });

  it('respeta el permiso GLOBAL EXPEDIENTE_LEER obtenido desde las relaciones vigentes de PostgreSQL', async () => {
    const { app } = appStorage({ ajeno: true, permisoGlobal: true });
    const res = await request(app).get(rutaDescargaStorage).set('Authorization', `Bearer ${tokenStorage()}`);
    expect(res.status).toBe(200);
    expect(res.body.expiraEnSegundos).toBe(900);
  });

  it.each([
    { bucket: 'bucket-ajeno', key: claveStorage },
    { bucket: bucketStorage, key: 'expedientes/2026/ajeno.pdf' },
    { bucket: bucketStorage, key: 'expedientes/2026/../ajeno.pdf' },
    { bucket: bucketStorage, key: 'expedientes//2026/ajeno.pdf' },
  ])('rechaza la manipulación de $bucket y $key sin emitir URL', async ({ bucket, key }) => {
    const { app } = appStorage();
    const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned');
    const res = await request(app).get(`/api/v1/storage/download/${bucket}/${encodeURIComponent(key)}`)
      .set('Authorization', `Bearer ${tokenStorage()}`);
    expect(res.status).toBe(403);
    expect(res.body.detail).not.toContain(key);
    expect(res.body.downloadUrl).toBeUndefined();
    expect(firmar).not.toHaveBeenCalled();
  });

  it('una copia firmada sigue siendo privada en la ruta genérica: no basta conocer su clave', async () => {
    const { app } = appStorage({ firmado: true, ajeno: true });
    const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned');
    const ruta = `/api/v1/storage/download/${bucketStorage}/${encodeURIComponent('firmados/prueba.pdf')}`;
    expect((await request(app).get(ruta)).status).toBe(401);
    expect((await request(app).get(ruta).set('Authorization', `Bearer ${tokenStorage()}`)).status).toBe(403);
    expect(firmar).not.toHaveBeenCalled();
  });

  it('conserva la descarga privada de una copia firmada relacionada con el adjunto propio', async () => {
    const { app } = appStorage({ firmado: true });
    const res = await request(app).get(`/api/v1/storage/download/${bucketStorage}/${encodeURIComponent('firmados/prueba.pdf')}`)
      .set('Authorization', `Bearer ${tokenStorage()}`);
    expect(res.status).toBe(200);
  });

  it('el Wizard autenticado recibe una clave nueva del servidor sin poder elegir el bucket ni sobrescribir una clave existente', async () => {
    const { app } = appStorage();
    const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned');
    const res = await request(app).post('/api/v1/storage/presigned-url')
      .set('Authorization', `Bearer ${tokenStorage()}`).send({
        nombreArchivo: 'solicitud.pdf', mimeType: 'application/pdf', tamanoBytes: 512,
        checksumSha256: 'a'.repeat(64), bucket: 'bucket-ajeno', s3Key: claveStorage,
      });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['expiraEnSegundos', 'expiresIn', 's3Key', 'uploadUrl']);
    expect(res.body.s3Key).toMatch(/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/);
    expect(res.body.s3Key).not.toBe(claveStorage);
    expect(res.body.expiresIn).toBe(res.body.expiraEnSegundos);
    expect(firmar.mock.calls[0][1].bucket).toBe(process.env.S3_BUCKET ?? bucketStorage);
    expect(firmar.mock.calls[0][2]?.metodo).toBe('PUT');
  });

  it.each([
    { caso: 'adjunto ajeno', opciones: { ajeno: true }, datos: {} },
    { caso: 'clave no relacionada', opciones: {}, datos: { s3Key: 'expedientes/2026/no-registrado.pdf' } },
    { caso: 'expediente manipulado', opciones: {}, datos: { idExpediente: otroIdStorage } },
    { caso: 'hash diferente', opciones: {}, datos: { sha256Hash: 'b'.repeat(64) } },
  ])('confirmar-carga rechaza $caso antes de intentar una inserción', async ({ opciones, datos }) => {
    const { app, query } = appStorage(opciones);
    const res = await request(app).post('/api/v1/storage/confirmar-carga')
      .set('Authorization', `Bearer ${tokenStorage()}`)
      .send({ s3Key: claveStorage, sha256Hash: 'a'.repeat(64), ...datos });
    expect(res.status).toBe(403);
    expect(query.mock.calls.every(([sql]) => !sql.includes('INSERT'))).toBe(true);
    expect(res.body.confirmado).toBeUndefined();
  });

  it('no confirma éxito cuando falla la persistencia legacy de confirmar-carga', async () => {
    const { app } = appStorage();
    const res = await request(app).post('/api/v1/storage/confirmar-carga')
      .set('Authorization', `Bearer ${tokenStorage()}`).send({ s3Key: claveStorage, sha256Hash: 'a'.repeat(64) });
    expect(res.status).toBe(500);
    expect(res.body.confirmado).toBeUndefined();
  });

  it.each(['/api/v1/validador/cvd/', '/api/v1/validador-cvd/verificar/'])('conserva la descarga pública desde un CVD válido en %s', async prefijo => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('%PDF-prueba-cvd', { status: 200 }));
    const { pool, query } = poolStorage();
    const app = construirApp(pool);
    const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned');
    const res = await request(app).get(`${prefijo}CVD-PRUEBA-123456?bucket=bucket-ajeno&key=ajeno.pdf`);
    expect(res.status).toBe(200);
    expect(res.body.esValido).toBe(true);
    expect(res.body.documento.numeroDocumento).toBeNull();
    expect(res.body.documento.firmantes[0].entidadCertificadora).toBeNull();
    expect(res.body.documento.urlDescargaAutentica).toBe(res.body.descarga_copia_certificada);
    expect(new URL(res.body.descarga_copia_certificada).searchParams.get('X-Amz-Expires')).toBe('900');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(['CVD-PRUEBA-123456']);
    expect(firmar.mock.calls[0][0]).toBe('firmados/prueba.pdf');
    expect(firmar.mock.calls[0][1].bucket).toBe(bucketStorage);
  });

  it('no acredita un PDF cuyo SHA-256 difiere del registro de firma', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('%PDF-contenido-diferente', { status: 200 }));
    const res = await request(construirApp(poolStorage().pool)).get('/api/v1/validador/cvd/CVD-PRUEBA-123456');
    expect(res.status).toBe(200);
    expect(res.body.esValido).toBe(false);
    expect(res.body.documento).toBeNull();
    expect(res.body.descarga_copia_certificada).toBe('');
  });

  it('responde 503 sin resultado positivo si el objeto firmado no está disponible', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 }));
    const res = await request(construirApp(poolStorage().pool)).get('/api/v1/validador/cvd/CVD-PRUEBA-123456');
    expect(res.status).toBe(503);
    expect(res.body.esValido).toBeUndefined();
    expect(res.body.descarga_copia_certificada).toBeUndefined();
  });

  it('no firma la descarga de un CVD inexistente', async () => {
    const { pool } = poolStorage();
    const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned');
    const res = await request(construirApp(pool)).get('/api/v1/validador/cvd/CVD-NO-EXISTENTE');
    expect(res.status).toBe(404);
    expect(firmar).not.toHaveBeenCalled();
  });

  it('conserva la respuesta de CVD no válido sin emitir una URL de descarga', async () => {
    const { pool } = poolStorage({ estadoFirma: 'NO_VALIDO' });
    const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned');
    const res = await request(construirApp(pool)).get('/api/v1/validador/cvd/CVD-PRUEBA-123456');
    expect(res.status).toBe(200);
    expect(res.body.esValido).toBe(false);
    expect(res.body.documento).toBeNull();
    expect(res.body.descarga_copia_certificada).toBe('');
    expect(firmar).not.toHaveBeenCalled();
  });

  it.each(['', '../otro.pdf'])('no inventa una ubicación pública si la referencia persistida es inválida', async referenciaFirma => {
    const { pool } = poolStorage({ referenciaFirma });
    const firmar = vi.spyOn(s3Storage, 'generarUrlPresigned');
    const res = await request(construirApp(pool)).get('/api/v1/validador/cvd/CVD-PRUEBA-123456');
    expect(res.status).toBe(503);
    expect(firmar).not.toHaveBeenCalled();
  });
});

/** Solo datos sintéticos en memoria. No crea clientes PostgreSQL ni llama a MinIO. */
function poolStorage(opciones: { ajeno?: boolean; permisoGlobal?: boolean; cuentaActiva?: boolean;
  firmado?: boolean; estadoFirma?: string; referenciaFirma?: string } = {}) {
  const query = vi.fn(async (sql: string, parametros: unknown[] = []) => {
    if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
      expect(sql).toContain('activo = TRUE');
      return { rows: opciones.cuentaActiva === false ? [] : [{ id_usuario: usuarioStorage, id_persona: personaStorage }], rowCount: opciones.cuentaActiva === false ? 0 : 1 };
    }
    if (sql.includes('FROM sigd_doc.documento_adjunto a')) {
      expect(sql).toContain('JOIN sigd_doc.expediente e ON e.expediente_id = a.expediente_id');
      expect(sql).toContain('e.solicitante_id = $4::uuid');
      expect(sql).toContain('p.codigo = \'EXPEDIENTE_LEER\' AND p.ambito = \'GLOBAL\'');
      expect(sql).toContain('r.vigente = TRUE');
      expect(sql).toContain('ur.vigente_desde <= now()');
      expect(sql).toContain('ur.vigente_hasta > now()');
      expect(sql).toContain('f.documento_id = a.documento_adjunto_id');
      expect(parametros.slice(2, 4)).toEqual([usuarioStorage, personaStorage]);
      const coincide = parametros[4] === adjuntoStorage || parametros[0] === bucketStorage
        && (parametros[1] === claveStorage || (opciones.firmado && parametros[1] === 'firmados/prueba.pdf'));
      const autorizado = coincide && (!opciones.ajeno || opciones.permisoGlobal);
      return { rows: autorizado ? [{ documento_adjunto_id: adjuntoStorage, expediente_id: expedienteStorage, sha256: 'a'.repeat(64), s3_bucket: bucketStorage, s3_key: claveStorage }] : [], rowCount: autorizado ? 1 : 0 };
    }
    if (sql.includes('FROM sigd_doc.firma_digital_documento')) {
      return { rows: parametros[0] === 'CVD-PRUEBA-123456' ? [{
        cvd: 'CVD-PRUEBA-123456', sha256_firmado: createHash('sha256').update('%PDF-prueba-cvd').digest('hex'), firmante: 'Firmante sintético',
        fecha_sello_tsa: '2026-01-01T13:00:00.000Z', estado: opciones.estadoFirma ?? 'FIRMADO_DIGITALMENTE',
        s3_bucket: bucketStorage, s3_key: opciones.referenciaFirma ?? 'firmados/prueba.pdf',
      }] : [], rowCount: parametros[0] === 'CVD-PRUEBA-123456' ? 1 : 0 };
    }
    throw new Error('Consulta inesperada en prueba aislada de almacenamiento.');
  });
  return { pool: { query } as unknown as Pool, query };
}

function appStorage(opciones: Parameters<typeof poolStorage>[0] = {}) {
  const { pool, query } = poolStorage(opciones);
  const app = express();
  app.use(express.json());
  app.use('/api/v1', crearRouterStorage(pool));
  app.use(errorMiddleware);
  return { app, query };
}

describe('Descarga documental por identificador opaco', () => {
  it('exige JWT y no entrega la referencia S3 a cuentas ajenas', async () => {
    const ruta = `/api/v1/storage/documentos/${adjuntoStorage}/download`;
    expect((await request(appStorage().app).get(ruta)).status).toBe(401);
    const ajeno = await request(appStorage({ ajeno: true }).app).get(ruta)
      .set('Authorization', `Bearer ${tokenStorage()}`);
    expect(ajeno.status).toBe(403);
    expect(ajeno.body).not.toHaveProperty('downloadUrl');
  });

  it('reutiliza la autorización persistida para el titular', async () => {
    const { app, query } = appStorage();
    const respuesta = await request(app).get(`/api/v1/storage/documentos/${adjuntoStorage}/download`)
      .set('Authorization', `Bearer ${tokenStorage()}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('downloadUrl');
    expect(respuesta.body).not.toHaveProperty('s3_key');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('a.documento_adjunto_id = $5::uuid'),
      [null, null, usuarioStorage, personaStorage, adjuntoStorage]);
  });
});

describe('App Routing & Health Verification', () => {
  const fakePool = {
    query: async (sql: string) => sql.includes('FROM sigd_auth.cuenta_usuario')
      ? { rows: [{ id_usuario: usuarioStorage, id_persona: personaStorage }], rowCount: 1 }
      : { rows: [], rowCount: 0 },
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    }),
  } as unknown as Pool;

  const app = construirApp(fakePool);

  it('GET /health responde 200 con estado UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('UP');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /ready responde 200 con estado READY', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('READY');
  });

  it('POST /api/v1/auth/login responde con error de validacion estructurado si falta body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});
    // No debe lanzar un 500 fatal de ruta no encontrada ni de sintaxis
    expect([400, 422]).toContain(res.status);
    expect(res.body).toHaveProperty('title');
  });

  it('GET /api/v1/admin/organigrama/arbol responde adecuadamente con 200', async () => {
    const res = await request(app).get('/api/v1/admin/organigrama/arbol');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/validador/cvd/:codigo responde ante formato CVD', async () => {
    const res = await request(app).get('/api/v1/validador/cvd/CVD-INEXISTENTE-123');
    // Puede responder 404 (no encontrado) o 400 pero no 500
    expect([400, 404]).toContain(res.status);
  });

  it('GET /api/v1/admin/auditoria/bitacora exige autenticación y no expone registros', async () => {
    const res = await request(app).get('/api/v1/admin/auditoria/bitacora');
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('registros');
  });

  it('GET /api/v1/admin/roles-permisos requiere autenticación', async () => {
    const res = await request(app).get('/api/v1/admin/roles-permisos');
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('roles');
  });

  it('GET /api/v1/admin/maestras/sede responde con sedes institucionales', async () => {
    const res = await request(app).get('/api/v1/admin/maestras/sede');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sedes');
  });

  it('GET /api/v1/admin/maestras/tipo-documento responde con tipos documentales', async () => {
    const res = await request(app).get('/api/v1/admin/maestras/tipo-documento');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/storage/presigned-url responde con error de validacion si faltan datos', async () => {
    const res = await request(app).post('/api/v1/storage/presigned-url')
      .set('Authorization', `Bearer ${tokenStorage()}`).send({});
    expect([400, 422]).toContain(res.status);
  });

  it('firma la URL S3 local para el host del navegador y mantiene el host Docker en llamadas internas', async () => {
    const endpointAnterior = process.env.S3_ENDPOINT;
    process.env.S3_ENDPOINT = 'http://minio:9000';
    try {
      const storageApp = express();
      storageApp.use(express.json());
      storageApp.use(crearRouterStorage(poolStorage().pool));
      const body = {
        nombreArchivo: 'solicitud.pdf',
        mimeType: 'application/pdf',
        tamanoBytes: 512,
        checksumSha256: 'a'.repeat(64),
      };

      const browserResponse = await request(storageApp)
        .post('/storage/presigned-url')
        .set('Authorization', `Bearer ${tokenStorage()}`)
        .set('Origin', 'http://localhost:5173')
        .send(body);
      expect(browserResponse.status, browserResponse.text).toBe(200);
      expect(new URL(browserResponse.body.uploadUrl).host).toBe('localhost:9000');
      expect(browserResponse.body.s3Key).toMatch(/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i);

      const internalResponse = await request(storageApp).post('/storage/presigned-url')
        .set('Authorization', `Bearer ${tokenStorage()}`).send(body);
      expect(internalResponse.status).toBe(200);
      expect(new URL(internalResponse.body.uploadUrl).host).toBe('minio:9000');

      const downloadResponse = await request(storageApp)
        .get(`/storage/download/sigd-expedientes/${encodeURIComponent(claveStorage)}`)
        .set('Authorization', `Bearer ${tokenStorage()}`)
        .set('Origin', 'http://localhost:5174');
      expect(downloadResponse.status).toBe(200);
      const downloadUrl = new URL(downloadResponse.body.downloadUrl);
      expect(downloadUrl.host).toBe('localhost:9000');
      expect(downloadUrl.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
      expect(Object.keys(downloadResponse.body).sort()).toEqual(['downloadUrl', 'expiraEnSegundos']);

      const internalDownload = await request(storageApp)
        .get(`/storage/download/sigd-expedientes/${encodeURIComponent(claveStorage)}`)
        .set('Authorization', `Bearer ${tokenStorage()}`);
      expect(new URL(internalDownload.body.downloadUrl).host).toBe('minio:9000');
    } finally {
      if (endpointAnterior === undefined) delete process.env.S3_ENDPOINT;
      else process.env.S3_ENDPOINT = endpointAnterior;
    }
  });

  it('GET /api/v1/firmas/cola-firmantes responde protegiendo acceso sin autenticacion', async () => {
    const res = await request(app).get('/api/v1/firmas/cola-firmantes');
    expect([401, 403]).toContain(res.status);
  });
});

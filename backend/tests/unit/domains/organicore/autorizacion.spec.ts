/**
 * Pruebas del control de acceso de `POST /api/v1/admin/calendario-laboral/feriado-excepcional`
 * (T-BE-OC-16).
 *
 * Se ejercita la aplicación completa (`construirApp`) por HTTP con `supertest` y
 * un doble de `Pool` que enruta cada sentencia por su texto. Así se cubre de
 * verdad la cadenaMiddleware -> controlador -> servicio -> repositorio, con las
 * respuestas RFC 7807 que produce `errorMiddleware`, sin necesidad de PostgreSQL.
 *
 * Escenarios cubiertos:
 *   1. Petición sin credencial            -> 401 UNAUTHORIZED
 *   2. Autenticado sin el permiso         -> 403 FORBIDDEN
 *   3. Autenticado con el permiso         -> 201 y escritura efectiva
 *   4. Intentos no autorizados            -> 403, sin escritura ni rastro WORM
 *   5. Credencial por `Authorization: Bearer` (convención del cliente web)
 *   6. El RBAC no desplegado              -> falla cerrado (403)
 */

import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, beforeEach } from 'vitest';

import { construirApp } from '../../../../src/app.js';
import {
  PERMISO_GESTIONAR_CALENDARIO_LABORAL,
  credencialDe,
  cuentaDe,
} from '../../../../src/middleware/autorizacion.js';
import { SQL_PERMISO_CONCEDIDO } from '../../../../src/domains/organicore/autorizacion.repository.js';

const CUENTA_ADMIN = '11111111-1111-4111-8111-111111111111';
const CUENTA_SIN_PERMISO = '22222222-2222-4222-8222-222222222222';
const CREDENCIAL = 't'.repeat(16);
const RUTA = '/api/v1/admin/calendario-laboral/feriado-excepcional';

const CUERPO_VALIDO = {
  fecha: '2026-11-18',
  descripcion: 'Feriado excepcional institucional',
  tipo_feriado: 'INSTITUCIONAL',
};

const FILA_INSERTADA = {
  id_calendario: 'aaaaaaaa-0000-4000-8000-000000000001',
  fecha: '2026-11-18',
  anio: 2026,
  tipo_feriado: 'INSTITUCIONAL',
  descripcion: 'Feriado excepcional institucional',
  unidad_territorial: 'IESTP_SUIZA',
  es_laborable: false,
  base_legal: null,
  activo: true,
  creado_en: '2026-09-28T00:00:00.000Z',
};

interface SentenciaRegistrada {
  sql: string;
  params: unknown[];
}

/** Controla qué permisos están concedidos y registra lo que se intentó escribir. */
class DoblePool {
  readonly consultasPermiso: SentenciaRegistrada[] = [];
  readonly escrituras: SentenciaRegistrada[] = [];
  private readonly concedidos = new Set<string>();

  concede(cuenta: string, permiso: string): void {
    this.concedidos.add(`${cuenta}|${permiso}`);
  }

  /** Simula que el esquema RBAC todavía no está desplegado. */
  rbacAusente = false;

  private cliente(): PoolClient {
    return {
      query: async (sql: string, params: unknown[] = []) => {
        this.registrar(sql, params);
        return this.responder(sql, params);
      },
      release: () => undefined,
    } as unknown as PoolClient;
  }

  registrar(sql: string, params: unknown[]): void {
    if (this.esConsultaDePermiso(sql)) {
      this.consultasPermiso.push({ sql, params });
    } else if (!/^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/i.test(sql)) {
      this.escrituras.push({ sql, params });
    }
  }

  private esConsultaDePermiso(sql: string): boolean {
    return sql.includes('usuario_rol');
  }

  private async responder(sql: string, params: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> {
    if (this.esConsultaDePermiso(sql)) {
      if (this.rbacAusente) {
        const error = new Error('relation "sigd_org.usuario_rol" does not exist') as Error & {
          code: string;
        };
        error.code = '42P01';
        throw error;
      }
      const [cuenta, permiso] = params as [string, string];
      const concedido = this.concedidos.has(`${cuenta}|${permiso}`);
      return { rows: concedido ? [{ '?column?': 1 }] : [], rowCount: concedido ? 1 : 0 };
    }

    if (/^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/i.test(sql)) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes('SELECT EXISTS')) {
      return { rows: [{ existe: false }], rowCount: 1 };
    }

    if (sql.includes('INSERT INTO sigd_org.calendario_laboral')) {
      return { rows: [FILA_INSERTADA], rowCount: 1 };
    }

    if (sql.includes('bitacora_auditoria')) {
      return { rows: [{ id_auditoria: 'aud-1' }], rowCount: 1 };
    }

    if (sql.includes('evento_outbox')) {
      return { rows: [{ id_evento: 'evt-1' }], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  asPool(): Pool {
    return {
      query: async (sql: string, params: unknown[] = []) => {
        this.registrar(sql, params);
        return this.responder(sql, params);
      },
      connect: async () => this.cliente(),
    } as unknown as Pool;
  }

  get escribioCalendario(): boolean {
    return this.escrituras.some((s) => s.sql.includes('INSERT INTO sigd_org.calendario_laboral'));
  }

  get escribioWorm(): boolean {
    return this.escrituras.some((s) => s.sql.includes('bitacora_auditoria'));
  }

  get escribioOutbox(): boolean {
    return this.escrituras.some((s) => s.sql.includes('evento_outbox'));
  }
}

let doble: DoblePool;
let app: ReturnType<typeof construirApp>;

beforeEach(() => {
  doble = new DoblePool();
  app = construirApp(doble.asPool());
});

describe('Control de acceso · POST /api/v1/admin/calendario-laboral/feriado-excepcional', () => {
  it('1. rechaza con 401 UNAUTHORIZED una petición sin autenticación', async () => {
    const respuesta = await request(app).post(RUTA).send(CUERPO_VALIDO);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.code).toBe('UNAUTHORIZED');
    expect(respuesta.body.status).toBe(401);
    expect(respuesta.body.type).toMatch(/unauthorized$/);
    expect(respuesta.body.correlation_id).toBeTruthy();
    // Ni se consulta el RBAC ni se intenta escribir.
    expect(doble.consultasPermiso).toHaveLength(0);
    expect(doble.escribioCalendario).toBe(false);
  });

  it('2. rechaza con 403 FORBIDDEN a un usuario autenticado sin el permiso', async () => {
    const respuesta = await request(app)
      .post(RUTA)
      .set('x-auth', CREDENCIAL)
      .set('x-usuario-id', CUENTA_SIN_PERMISO)
      .send(CUERPO_VALIDO);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.code).toBe('FORBIDDEN');
    expect(respuesta.body.status).toBe(403);
    expect(respuesta.body.type).toMatch(/forbidden$/);
    expect(respuesta.body.correlation_id).toBeTruthy();
    expect(respuesta.body.detail).toContain(PERMISO_GESTIONAR_CALENDARIO_LABORAL);
    // Se consultó el RBAC con la cuenta y el permiso correctos.
    expect(doble.consultasPermiso).toHaveLength(1);
    expect(doble.consultasPermiso[0].params).toEqual([
      CUENTA_SIN_PERMISO,
      PERMISO_GESTIONAR_CALENDARIO_LABORAL,
    ]);
    expect(doble.escribioCalendario).toBe(false);
  });

  it('3. permite a un usuario con el permiso y registra el feriado', async () => {
    doble.concede(CUENTA_ADMIN, PERMISO_GESTIONAR_CALENDARIO_LABORAL);

    const respuesta = await request(app)
      .post(RUTA)
      .set('x-auth', CREDENCIAL)
      .set('x-usuario-id', CUENTA_ADMIN)
      .send(CUERPO_VALIDO);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.id_calendario).toBe(FILA_INSERTADA.id_calendario);
    expect(respuesta.body.fecha).toBe('2026-11-18');
    // La escritura va acompañada de su asiento WORM y su evento de outbox.
    expect(doble.escribioCalendario).toBe(true);
    expect(doble.escribioWorm).toBe(true);
    expect(doble.escribioOutbox).toBe(true);
  });

  it('4. ningún intento no autorizado altera el calendario, ni deja rastro WORM', async () => {
    const intentos = [
      // Sin credencial alguna.
      request(app).post(RUTA),
      // Credencial pero sin cuenta declarada: no hay sujeto que autorizar.
      request(app).post(RUTA).set('x-auth', CREDENCIAL),
      // Cuenta mal formada.
      request(app)
        .post(RUTA)
        .set('x-auth', CREDENCIAL)
        .set('x-usuario-id', 'no-es-un-uuid'),
      // Cuenta válida sin el permiso.
      request(app)
        .post(RUTA)
        .set('x-auth', CREDENCIAL)
        .set('x-usuario-id', CUENTA_SIN_PERMISO),
    ];

    for (const intento of intentos) {
      const respuesta = await intento.send(CUERPO_VALIDO);
      expect([401, 403]).toContain(respuesta.status);
      expect(respuesta.body.code).toMatch(/^(UNAUTHORIZED|FORBIDDEN)$/);
    }

    expect(doble.escribioCalendario).toBe(false);
    expect(doble.escribioWorm).toBe(false);
    expect(doble.escribioOutbox).toBe(false);
  });

  it('5. acepta la credencial que envía el cliente web (Authorization: Bearer)', async () => {
    doble.concede(CUENTA_ADMIN, PERMISO_GESTIONAR_CALENDARIO_LABORAL);

    const respuesta = await request(app)
      .post(RUTA)
      .set('Authorization', `Bearer ${CREDENCIAL}`)
      .set('x-usuario-id', CUENTA_ADMIN)
      .send(CUERPO_VALIDO);

    expect(respuesta.status).toBe(201);
  });

  it('6. falla cerrado: si el esquema RBAC no está desplegado, deniega el acceso', async () => {
    doble.rbacAusente = true;
    // Aunque la cuenta "tendría" el permiso, sin RBAC consultable no se concede.
    doble.concede(CUENTA_ADMIN, PERMISO_GESTIONAR_CALENDARIO_LABORAL);

    const respuesta = await request(app)
      .post(RUTA)
      .set('x-auth', CREDENCIAL)
      .set('x-usuario-id', CUENTA_ADMIN)
      .send(CUERPO_VALIDO);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.code).toBe('FORBIDDEN');
    expect(doble.escribioCalendario).toBe(false);
  });

  it('7. no deja montar una ruta alternativa que evite el control de acceso', async () => {
    // Variantes de método y de ruta tampoco deben esquivar el guard.
    const bypass = [
      request(app).put(RUTA).set('x-auth', CREDENCIAL).set('x-usuario-id', CUENTA_ADMIN),
      request(app).patch(RUTA).set('x-auth', CREDENCIAL).set('x-usuario-id', CUENTA_ADMIN),
      request(app).delete(RUTA).set('x-auth', CREDENCIAL).set('x-usuario-id', CUENTA_ADMIN),
      request(app).post('/api/v1/admin/calendario-laboral/feriado-excepcional/'),
    ];

    for (const intento of bypass) {
      const respuesta = await intento.send(CUERPO_VALIDO);
      // 404/405 del enrutador o 401/403 del guard: nunca una escritura.
      expect([401, 403, 404, 405]).toContain(respuesta.status);
    }

    expect(doble.escribioCalendario).toBe(false);
  });

  it('8. la consulta de permisos exige rol activo, permiso activo y vigencia vigente', () => {
    // El filtro de vigencia y de activos no puede desaparecer sin quebrar la prueba.
    expect(SQL_PERMISO_CONCEDIDO).toContain('ur.vigencia @> now()');
    expect(SQL_PERMISO_CONCEDIDO).toContain('p.activo = TRUE');
    expect(SQL_PERMISO_CONCEDIDO).toContain('r.activo = TRUE');
    expect(SQL_PERMISO_CONCEDIDO).toContain('p.codigo = $2');
  });
});

describe('Utilidades de la cabecera de autorización', () => {
  const peticion = (headers: Record<string, string>) =>
    ({ get: (nombre: string) => headers[nombre.toLowerCase()] ?? undefined }) as never;

  it('normaliza las dos convenciones de credencial del proyecto', () => {
    expect(credencialDe(peticion({ 'x-auth': ' abc ' }))).toBe('abc');
    expect(credencialDe(peticion({ authorization: 'Bearer xyz' }))).toBe('xyz');
    expect(credencialDe(peticion({ authorization: 'bearer xyz' }))).toBe('xyz');
  });

  it('rechaza credenciales ausentes o vacías', () => {
    expect(credencialDe(peticion({}))).toBeNull();
    expect(credencialDe(peticion({ 'x-auth': '   ' }))).toBeNull();
    expect(credencialDe(peticion({ authorization: 'Bearer   ' }))).toBeNull();
    expect(credencialDe(peticion({ authorization: 'Basic abc' }))).toBeNull();
  });

  it('sólo acepta cuentas con forma de UUID, en minúsculas', () => {
    expect(cuentaDe(peticion({ 'x-usuario-id': CUENTA_ADMIN.toUpperCase() }))).toBe(CUENTA_ADMIN);
    expect(cuentaDe(peticion({ 'x-usuario-id': CUENTA_ADMIN }))).toBe(CUENTA_ADMIN);
    expect(cuentaDe(peticion({ 'x-usuario-id': '12345' }))).toBeNull();
    expect(cuentaDe(peticion({ 'x-usuario-id': '' }))).toBeNull();
  });
});

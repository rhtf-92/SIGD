import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { IdentidadOtpService } from '../../../../src/domains/identicore/identidadOtp.service.js';
import { Argon2Service } from '../../../../src/domains/identicore/argon2.service.js';
import { RegistroCiudadanoService } from '../../../../src/domains/identicore/registroCiudadano.service.js';
import type { UbigeoService } from '../../../../src/domains/identicore/ubigeo.service.js';
import type { RegistroCiudadanoInput, RegistroPersonaJuridicaInput } from '../../../../src/domains/identicore/registro.schemas.js';

const natural: RegistroCiudadanoInput = {
  tipoPersona: 'NATURAL',
  tipoDocumento: 'DNI',
  dni: '74561238',
  nombres: 'Sergio',
  apellidoPaterno: 'Serruche',
  apellidoMaterno: 'Panduro',
  fechaNacimiento: '1990-01-01',
  correo: 'sergio@example.com',
  celular: '961234567',
  ubigeoDistrito: '250101',
  direccion: 'Jr. Tarapaca 645',
  password: 'PasswordValida123!',
  consentimientoDatos: true,
  declaracionJuradaAceptada: true,
  aceptaNotificaciones: false,
};

const juridica: RegistroPersonaJuridicaInput = {
  tipoPersona: 'JURIDICA',
  ruc: '20131312955',
  razonSocial: 'Amazonas Soft SAC',
  correo: 'contacto@example.com',
  celular: '961234567',
  ubigeoDistrito: '250101',
  direccion: 'Jr. Tarapaca 645',
  password: 'PasswordValida123!',
  consentimientoDatos: true,
  aceptaNotificaciones: false,
  dniRepresentante: '74561238',
  tipoDocumentoRepresentante: 'DNI',
  nombreRepresentante: 'Carlos Davila Ruiz',
  cargoRepresentante: 'Gerente',
  declaracionJuradaAceptada: true,
};

describe('RegistroCiudadanoService: compatibilidad de persistencia', () => {
  afterEach(() => vi.restoreAllMocks());

  function escenario(options: { duplicado?: boolean; conflicto?: boolean; nombre?: string; fecha?: string | null; rol?: number; nueva?: boolean; conExpedientes?: boolean; domicilio?: boolean } = {}) {
    const id = '11111111-1111-4111-8111-111111111111';
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('FOR UPDATE OF pn, p')) return { rows: [{ id: '33333333-3333-4333-8333-333333333333', nombres: 'Carlos', apellidos: 'Davila Ruiz', correo: 'representante@example.com' }] };
      if (sql.includes('FOR UPDATE OF p')) return { rows: [{ id, correo: 'original@example.com', nombres: options.nombre ?? 'Sérgio', apellidos: '  SERRUCHE   Panduro ', fecha_nacimiento: options.fecha === undefined ? '1990-01-01' : options.fecha }] };
      if (sql.includes('INSERT INTO sigd_auth.persona_juridica')) return { rows: [{ id }] };
      if (sql.includes('FROM sigd_tra.expediente')) return { rows: [{ existe: options.conExpedientes ?? true }] };
      if (sql.includes('AS existe')) return { rows: [{ existe: sql.includes('WHERE id_persona=$1::uuid') ? options.conflicto ?? false : options.duplicado ?? false }] };
      if (sql.includes('INSERT INTO sigd_auth.persona (')) return { rows: options.nueva ? [{ id }] : [] };
      if (sql.includes('INSERT INTO sigd_auth.cuenta_usuario')) return { rows: [{ id: '22222222-2222-4222-8222-222222222222' }] };
      return { rows: [], rowCount: sql.includes('INSERT INTO sigd_org.usuario_rol') ? options.rol ?? 1 : 1 };
    });
    const poolQuery = vi.fn(async (sql: string) => sql.includes('information_schema')
      ? { rows: [
        ['persona', 'id_persona'],
        ['persona_natural', 'id_persona'], ['persona_natural', 'direccion'], ['persona_natural', 'ubigeo_distrito'],
        ['persona_juridica', 'id_persona'], ['persona_juridica', 'direccion'], ['persona_juridica', 'ubigeo_distrito'],
        ['perfil_usuario', 'id_usuario'], ['perfil_usuario', 'direccion'], ['perfil_usuario', 'ubigeo_distrito'], ['perfil_usuario', 'referencia'], ['cuenta_usuario', 'id_usuario'], ['consentimiento_datos', 'id_consentimiento'], ['auditoria_usuarios', 'id_auditoria'],
      ].filter(([table, col]) => options.domicilio !== false || table !== 'perfil_usuario' || col === 'id_usuario').map(([table_name, column_name]) => ({ table_name, column_name })) }
      : { rows: [{ id: '1' }] });
    const release = vi.fn();
    const connect = vi.fn().mockResolvedValue({ query, release });
    const service = new RegistroCiudadanoService({ query: poolQuery, connect } as unknown as Pool,
      { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService);
    vi.spyOn(Argon2Service, 'hashArgon2id').mockResolvedValue('solo-doble-unitario');
    return { service, query, release, connect, id };
  }

  it('registra una persona nueva sin pedir domicilio cuando el esquema no lo soporta', async () => {
    const { service, query } = escenario({ nueva: true, domicilio: false });
    await expect(service.registrarCiudadano({ ...natural, direccion: undefined, ubigeoDistrito: undefined }, null)).resolves.toMatchObject({ mensaje: 'Registro exitoso' });
    const profile = query.mock.calls.find(([s]) => s.includes('INSERT INTO sigd_auth.perfil_usuario'));
    expect(profile?.[0]).not.toContain('direccion');
    expect(query).toHaveBeenLastCalledWith('COMMIT');
  });
  it('no descarta un domicilio enviado por un cliente antiguo si el esquema no puede guardarlo', async () => {
    const { service, connect } = escenario({ nueva: true, domicilio: false });
    await expect(service.registrarCiudadano(natural, null)).rejects.toMatchObject({ status: 400 });
    expect(connect).not.toHaveBeenCalled();
  });
  it('reutiliza la misma persona y audita la vinculacion solo tras consumir la prueba OTP', async () => {
    const consumir = vi.spyOn(IdentidadOtpService.prototype, 'consumir').mockResolvedValueOnce(undefined);
    const { service, query, id } = escenario();
    const proof = 'a'.repeat(64);
    await expect(service.registrarCiudadano({ ...natural, verificacionTitularidad: proof }, null)).resolves.toMatchObject({ idPersona: id });
    expect(consumir).toHaveBeenCalledWith(proof, id, natural.dni, 'original@example.com');
    expect(query.mock.calls.some(([s]) => s.includes('INSERT INTO sigd_auth.persona_natural'))).toBe(false);
    const audit = query.mock.calls.find(([s]) => s.includes('INSERT INTO sigd_auth.auditoria_usuarios'));
    expect(JSON.parse(String(audit?.[1]?.[3]))).toMatchObject({ personaReutilizada: true, verificacionVinculacion: 'CONTROL_CONTACTO_PREEXISTENTE_OTP_NO_ACREDITA_IDENTIDAD_OFICIAL' });
  });

  it('permite crear cuenta jurídica online sin bloquear por falta de OTP presencial', async () => {
    const { service, query } = escenario({ nueva: true });
    await expect(service.registrarPersonaJuridica(juridica, null)).resolves.toMatchObject({ mensaje: 'Registro exitoso' });
    expect(query.mock.calls.some(([s]) => s.includes('INSERT INTO sigd_auth.cuenta_usuario'))).toBe(true);
    expect(query).toHaveBeenLastCalledWith('COMMIT');
  });
  it('crea la persona juridica y consume la prueba del representante cuando se proporciona', async () => {
    const consumir = vi.spyOn(IdentidadOtpService.prototype, 'consumir').mockResolvedValueOnce(undefined);
    const { service } = escenario({ nueva: true }); const prueba = 'b'.repeat(64);
    await expect(service.registrarPersonaJuridica({ ...juridica, verificacionTitularidad: prueba }, null)).resolves.toMatchObject({ mensaje: 'Registro exitoso' });
    expect(consumir).toHaveBeenCalledWith(prueba, '33333333-3333-4333-8333-333333333333', juridica.dniRepresentante, 'representante@example.com');
  });

  it.each([false, true])('permite crear cuenta para persona preexistente sin vincular expedientes históricos (Regla 5) (prior expediente: %s)', async conExpedientes => {
    const { service, query } = escenario({ conExpedientes });
    await expect(service.registrarCiudadano(natural, null)).resolves.toMatchObject({
      mensaje: 'Registro exitoso',
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO sigd_auth.cuenta_usuario'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('sigd_tra.vinculacion_expediente_cuenta'))).toBe(false);
    expect(query).toHaveBeenLastCalledWith('COMMIT');
  });

  it.each([{ duplicado: true }, { conflicto: true }])('rechaza una cuenta previa o concurrente sin persistir', async options => {
    const { service, query, release } = escenario({ ...options, conExpedientes: false });
    await expect(service.registrarCiudadano(natural, null)).rejects.toMatchObject({ status: 409, code: 'CITIZEN_ALREADY_EXISTS' });
    expect(query.mock.calls.some(([s]) => s.includes('INSERT INTO sigd_auth.cuenta_usuario'))).toBe(false);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });

  it.each([{ nombre: 'Otra persona' }, { fecha: '1991-01-01' }])('rechaza datos incompatibles con la identidad existente', async options => {
    const { service, query } = escenario({ ...options, conExpedientes: false });
    await expect(service.registrarCiudadano(natural, null)).rejects.toMatchObject({ code: 'CITIZEN_IDENTITY_CONFLICT', status: 409 });
    expect(query.mock.calls.some(([s]) => s.includes('INSERT INTO sigd_auth.cuenta_usuario'))).toBe(false);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('revierte el alta si el rol canónico CIUDADANO no está configurado', async () => {
    const { service, query } = escenario({ nueva: true, rol: 0 });
    await expect(service.registrarCiudadano(natural, null)).rejects.toMatchObject({ code: 'CITIZEN_ROLE_NOT_CONFIGURED', status: 503 });
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('no crea cuentas si Argon2id no está disponible', async () => {
    const { service, connect } = escenario();
    vi.mocked(Argon2Service.hashArgon2id).mockRejectedValue(new Error('native unavailable'));
    await expect(service.registrarCiudadano(natural, null)).rejects.toMatchObject({ code: 'REGISTRATION_HASH_UNAVAILABLE', status: 503 });
    expect(connect).not.toHaveBeenCalled();
  });
  it.each([
    ['persona natural', 'registrarCiudadano', natural],
    ['persona jurídica', 'registrarPersonaJuridica', juridica],
  ] as const)('%s queda bloqueada sin soporte persistente de domicilio y ubigeo', async (_label, metodo, input) => {
    const query = vi.fn().mockResolvedValue({ rows: [{ table_name: 'persona_juridica', column_name: 'direccion' }] });
    const connect = vi.fn();
    const pool = { query, connect } as unknown as Pool;
    const contieneDistrito = vi.fn();
    const service = new RegistroCiudadanoService(pool, { contieneDistrito } as unknown as UbigeoService);

    const resultado = metodo === 'registrarCiudadano'
      ? service.registrarCiudadano(input as RegistroCiudadanoInput, null)
      : service.registrarPersonaJuridica(input as RegistroPersonaJuridicaInput, null);

    await expect(resultado).rejects.toMatchObject({
      status: 503,
      code: 'REGISTRO_MODELO_NO_COMPATIBLE',
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(contieneDistrito).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it('rechaza el registro sin tipo documental vigente antes de abrir una transacción', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [
        { table_name: 'persona', column_name: 'id_persona' },
        { table_name: 'persona_natural', column_name: 'id_persona' },
        { table_name: 'persona_juridica', column_name: 'id_persona' },
        { table_name: 'perfil_usuario', column_name: 'direccion' },
        { table_name: 'perfil_usuario', column_name: 'ubigeo_distrito' },
        { table_name: 'perfil_usuario', column_name: 'referencia' },
        { table_name: 'persona_natural', column_name: 'ubigeo_distrito' },
        { table_name: 'cuenta_usuario', column_name: 'id_usuario' },
        { table_name: 'consentimiento_datos', column_name: 'id_consentimiento' },
        { table_name: 'auditoria_usuarios', column_name: 'id_auditoria' },
      ] })
      .mockResolvedValueOnce({ rows: [] });
    const connect = vi.fn();
    const pool = { query, connect } as unknown as Pool;
    const contieneDistrito = vi.fn();
    const service = new RegistroCiudadanoService(pool, { contieneDistrito } as unknown as UbigeoService);

    await expect(service.registrarCiudadano(natural, null)).rejects.toMatchObject({
      status: 503,
      code: 'DOCUMENT_TYPE_NOT_CONFIGURED',
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(contieneDistrito).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it('construye las escrituras con las columnas UUID del esquema institucional cuando la prevalidación es compatible', async () => {
    const poolQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [
        { table_name: 'persona', column_name: 'id_persona' },
        { table_name: 'persona_natural', column_name: 'id_persona' },
        { table_name: 'persona_juridica', column_name: 'id_persona' },
        { table_name: 'perfil_usuario', column_name: 'direccion' },
        { table_name: 'perfil_usuario', column_name: 'ubigeo_distrito' },
        { table_name: 'perfil_usuario', column_name: 'referencia' },
        { table_name: 'persona_natural', column_name: 'ubigeo_distrito' },
        { table_name: 'cuenta_usuario', column_name: 'id_usuario' },
        { table_name: 'consentimiento_datos', column_name: 'id_consentimiento' },
        { table_name: 'auditoria_usuarios', column_name: 'id_auditoria' },
      ] })
      .mockResolvedValueOnce({ rows: [{ id: '1' }] });
    const clientQuery = vi.fn()
      .mockResolvedValue({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ existe: false }] })
      .mockResolvedValueOnce({ rows: [{ id: '11111111-1111-4111-8111-111111111111' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '22222222-2222-4222-8222-222222222222' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id_evento: '99999999-9999-4999-8999-999999999999' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const release = vi.fn();
    const connect = vi.fn().mockResolvedValue({ query: clientQuery, release });
    const service = new RegistroCiudadanoService(
      { query: poolQuery, connect } as unknown as Pool,
      { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService,
    );
    const hash = vi.spyOn(Argon2Service, 'hashArgon2id').mockResolvedValue('hash-sintetico-de-unit-test');

    try {
      await expect(service.registrarCiudadano(natural, null)).resolves.toMatchObject({
        idPersona: '11111111-1111-4111-8111-111111111111',
        mensaje: 'Registro exitoso',
      });
      const sentSql = clientQuery.mock.calls.map(([sql]) => String(sql));
      expect(sentSql.some((sql) => sql.includes('INSERT INTO sigd_auth.persona (tipo, id_documento)'))).toBe(true);
      expect(sentSql.some((sql) => sql.includes('id_persona, nombres, apellidos, nombre_completo, fecha_nacimiento, correo, telefono'))).toBe(true);
      expect(sentSql.some((sql) => sql.includes('id_persona, usuario, correo, password_hash'))).toBe(true);
      expect(sentSql.some((sql) => sql.includes('sigd_auth.consentimiento_datos'))).toBe(true);
      expect(sentSql.some((sql) => sql.includes('sigd_auth.auditoria_usuarios'))).toBe(true);
      expect(sentSql.some((sql) => sql.includes('sigd_org.usuario_rol'))).toBe(true);
      expect(sentSql.some((sql) => sql.includes('email_login') || sql.includes('username') || sql.includes('persona_id'))).toBe(false);
      expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
    } finally {
      hash.mockRestore();
    }
    expect(release).toHaveBeenCalledOnce();
  });

  describe('activarCuenta', () => {
    it('activa la cuenta, inicializa la Casilla Electrónica y encola el evento outbox con un token válido', async () => {
      const clientQuery = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT t.id, t.id_usuario')) {
          return {
            rows: [{
              id: 'tok-1',
              id_usuario: 'usr-1',
              correo: 'sergio@example.com',
              tipo: 'ACTIVACION_CUENTA',
              expira_en: new Date(Date.now() + 3600000).toISOString(),
              usado_en: null,
              activo: false,
              usuario: '74561238',
              titular: 'Sergio Serruche',
            }],
          };
        }
        if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
          return { rows: [{ id_evento: 'evt-1' }] };
        }
        return { rows: [] };
      });
      const release = vi.fn();
      const connect = vi.fn().mockResolvedValue({ query: clientQuery, release });
      const service = new RegistroCiudadanoService(
        { query: vi.fn(), connect } as unknown as Pool,
        { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService,
      );

      const res = await service.activarCuenta('a'.repeat(64), '127.0.0.1');
      expect(res).toEqual({
        exito: true,
        mensaje: 'Cuenta activada exitosamente. Su Casilla Electrónica Institucional ha sido habilitada.',
        idUsuario: 'usr-1',
        correo: 'sergio@example.com',
      });
      expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('UPDATE sigd_auth.cuenta_usuario\n            SET activo = TRUE'))).toBe(true);
      expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO sigd_auth.notificacion_casilla'))).toBe(true);
      expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
    });

    it('rechaza con 404 si el token no existe', async () => {
      const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
      const connect = vi.fn().mockResolvedValue({ query: clientQuery, release: vi.fn() });
      const service = new RegistroCiudadanoService(
        { query: vi.fn(), connect } as unknown as Pool,
        { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService,
      );

      await expect(service.activarCuenta('b'.repeat(64), null)).rejects.toMatchObject({
        status: 404,
        code: 'TOKEN_INVALIDO',
      });
    });

    it('rechaza con 409 si el token ya fue utilizado', async () => {
      const clientQuery = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT t.id, t.id_usuario')) {
          return {
            rows: [{
              id: 'tok-2',
              id_usuario: 'usr-2',
              correo: 'sergio@example.com',
              tipo: 'ACTIVACION_CUENTA',
              expira_en: new Date(Date.now() + 3600000).toISOString(),
              usado_en: new Date().toISOString(),
              activo: true,
              usuario: '74561238',
              titular: 'Sergio Serruche',
            }],
          };
        }
        return { rows: [] };
      });
      const connect = vi.fn().mockResolvedValue({ query: clientQuery, release: vi.fn() });
      const service = new RegistroCiudadanoService(
        { query: vi.fn(), connect } as unknown as Pool,
        { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService,
      );

      await expect(service.activarCuenta('c'.repeat(64), null)).rejects.toMatchObject({
        status: 409,
        code: 'TOKEN_YA_UTILIZADO',
      });
    });

    it('rechaza con 410 si el token ha expirado', async () => {
      const clientQuery = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT t.id, t.id_usuario')) {
          return {
            rows: [{
              id: 'tok-3',
              id_usuario: 'usr-3',
              correo: 'sergio@example.com',
              tipo: 'ACTIVACION_CUENTA',
              expira_en: new Date(Date.now() - 3600000).toISOString(), // Expirado hace 1 hora
              usado_en: null,
              activo: false,
              usuario: '74561238',
              titular: 'Sergio Serruche',
            }],
          };
        }
        return { rows: [] };
      });
      const connect = vi.fn().mockResolvedValue({ query: clientQuery, release: vi.fn() });
      const service = new RegistroCiudadanoService(
        { query: vi.fn(), connect } as unknown as Pool,
        { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService,
      );

      await expect(service.activarCuenta('d'.repeat(64), null)).rejects.toMatchObject({
        status: 410,
        code: 'TOKEN_EXPIRADO',
      });
    });
  });

  describe('reenviarVerificacion', () => {
    it('retorna mensaje anti-enumeración neutro si el usuario no existe', async () => {
      const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
      const connect = vi.fn().mockResolvedValue({ query: clientQuery, release: vi.fn() });
      const service = new RegistroCiudadanoService(
        { query: vi.fn(), connect } as unknown as Pool,
        { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService,
      );

      const res = await service.reenviarVerificacion('99999999', null);
      expect(res.exito).toBe(true);
      expect(res.mensaje).toContain('Si los datos corresponden');
      expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
    });

    it('rechaza con 409 si la cuenta ya está activa', async () => {
      const clientQuery = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT c.id_usuario')) {
          return {
            rows: [{
              id_usuario: 'usr-4',
              correo: 'sergio@example.com',
              activo: true,
              usuario: '74561238',
              titular: 'Sergio Serruche',
            }],
          };
        }
        return { rows: [] };
      });
      const connect = vi.fn().mockResolvedValue({ query: clientQuery, release: vi.fn() });
      const service = new RegistroCiudadanoService(
        { query: vi.fn(), connect } as unknown as Pool,
        { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService,
      );

      await expect(service.reenviarVerificacion('74561238', null)).rejects.toMatchObject({
        status: 409,
        code: 'CUENTA_YA_ACTIVA',
      });
    });

    it('genera un nuevo token e invalida los anteriores si la cuenta está pendiente', async () => {
      const clientQuery = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT c.id_usuario')) {
          return {
            rows: [{
              id_usuario: 'usr-5',
              correo: 'pendiente@example.com',
              activo: false,
              usuario: '74561238',
              titular: 'Sergio Serruche',
            }],
          };
        }
        if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
          return { rows: [{ id_evento: 'evt-2' }] };
        }
        return { rows: [] };
      });
      const connect = vi.fn().mockResolvedValue({ query: clientQuery, release: vi.fn() });
      const service = new RegistroCiudadanoService(
        { query: vi.fn(), connect } as unknown as Pool,
        { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService,
      );

      const res = await service.reenviarVerificacion('74561238', null);
      expect(res.exito).toBe(true);
      expect(res.correo).toBe('pendiente@example.com');
      expect(res.tokenVerificacion).toBeDefined();
      expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('UPDATE sigd_auth.token_verificacion_correo'))).toBe(true);
      expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO sigd_auth.token_verificacion_correo'))).toBe(true);
      expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
    });
  });
});

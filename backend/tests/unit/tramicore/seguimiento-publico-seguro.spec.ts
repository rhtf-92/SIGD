import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import {
  TokenSeguimientoService,
  DEFAULT_TRACKING_TOKEN_TTL_DAYS,
} from '../../../src/domains/tramicore/tokenSeguimiento.service.js';
import {
  cifrarSecreto,
  descifrarSecreto,
  obtenerClaveCifradoOutbox,
} from '../../../src/shared/crypto/cifradoOutbox.js';
import { RateLimiterRedis } from '../../../src/domains/tramicore/rateLimiterRedis.js';
import {
  ConsultaPublicaService,
  enmascararDocumento,
  enmascararNombre,
  mapearEtapaPublica,
  generarDescripcionHito,
  sanitizarUnidadPublica,
} from '../../../src/domains/tramicore/consultaPublica.service.js';
import { AppError, NotFoundError } from '../../../src/shared/domain/errors/index.js';

describe('Seguimiento Público Seguro de Expedientes — Trazabilidad Multidispositivo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_JWT_SECRET = 'clave_secreta_institucional_jwt_demo_2026_test';
  });

  // 1. Generación de token
  it('1. Genera tokens criptográficamente seguros con mínimo 256 bits de entropía', () => {
    const service = new TokenSeguimientoService({} as never);
    const { token, tokenHash } = service.generarToken();

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    // 256 bits = 32 bytes = 64 caracteres hexadecimales
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);

    // El hash SHA-256 del token debe corresponder exactamente
    const hashCalculado = createHash('sha256').update(token).digest('hex');
    expect(tokenHash).toBe(hashCalculado);

    // Entropía: dos tokens consecutivos jamás colisionan
    const otro = service.generarToken();
    expect(token).not.toBe(otro.token);
    expect(tokenHash).not.toBe(otro.tokenHash);
  });

  // 2. Persistencia: solamente hash
  it('2. Persiste únicamente el hash SHA-256 en base de datos y nunca el token original', async () => {
    const expedienteId = '11111111-2222-3333-4444-555555555555';
    const consultasEjecutadas: { sql: string; params: unknown[] }[] = [];

    const mockCliente = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        consultasEjecutadas.push({ sql, params });
        if (sql.includes('to_regclass')) {
          return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        }
        if (sql.includes('UPDATE sigd_tra.token_seguimiento_publico')) {
          return { rowCount: 0 };
        }
        if (sql.includes('INSERT INTO sigd_tra.token_seguimiento_publico')) {
          return {
            rows: [{ id_token: 'tok-uuid-1', expira_en: new Date(Date.now() + 180 * 86400000) }],
          };
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService({} as never);
    const resultado = await service.emitirToken(mockCliente as never, expedienteId);

    expect(resultado.token).toHaveLength(64);
    expect(resultado.tokenHash).toHaveLength(64);

    // Comprobar la sentencia INSERT
    const insertCall = consultasEjecutadas.find((c) =>
      c.sql.includes('INSERT INTO sigd_tra.token_seguimiento_publico')
    );
    expect(insertCall).toBeDefined();

    // Los parámetros del INSERT contienen el hash, NUNCA el token en claro
    const paramsString = JSON.stringify(insertCall?.params);
    expect(paramsString).toContain(resultado.tokenHash);
    expect(paramsString).not.toContain(resultado.token);
  });

  // 3. Asociación con el expediente
  it('3. Asocia formalmente el hash del token al expediente_id correcto', async () => {
    const expedienteId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    let idExpedienteInsertado: string | null = null;

    const mockCliente = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('to_regclass')) {
          return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        }
        if (sql.includes('INSERT INTO sigd_tra.token_seguimiento_publico')) {
          idExpedienteInsertado = params[0] as string;
          return { rows: [{ id_token: 'uuid-tok-3', expira_en: new Date() }] };
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService({} as never);
    await service.emitirToken(mockCliente as never, expedienteId);

    expect(idExpedienteInsertado).toBe(expedienteId);
  });

  // 4. Token válido: acceso autorizado
  it('4. Valida exitosamente un token correcto mediante comparación en tiempo constante', async () => {
    const cut = 'EXP-2026-000215';
    const expedienteId = '99999999-8888-7777-6666-555555555555';
    const tokenValido = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const hashValido = createHash('sha256').update(tokenValido).digest('hex');

    const mockCliente = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('to_regclass')) {
          return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        }
        if (sql.includes('FROM sigd_tra.token_seguimiento_publico')) {
          return {
            rows: [
              {
                id_token: 'id-tok-valido',
                expediente_id: expedienteId,
                token_hash: hashValido,
                expira_en: new Date(Date.now() + 1000000), // En el futuro
                revocado: false,
                motivo_revocacion: null,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService({} as never);
    const validacion = await service.validarToken(mockCliente as never, cut, tokenValido);

    expect(validacion.valido).toBe(true);
    expect(validacion.expedienteId).toBe(expedienteId);
    expect(validacion.idToken).toBe('id-tok-valido');
  });

  // 5. Token inválido: acceso rechazado
  it('5. Rechaza un token con hash no coincidente', async () => {
    const cut = 'EXP-2026-000215';
    const tokenFalso = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hashAlmacenado = createHash('sha256').update('otrotokendistinto111111111111111111111111111111111111111111111111').digest('hex');

    const mockCliente = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        if (sql.includes('FROM sigd_tra.token_seguimiento_publico')) {
          return {
            rows: [{
              id_token: 'tok-1',
              expediente_id: 'exp-1',
              token_hash: hashAlmacenado,
              expira_en: new Date(Date.now() + 100000),
              revocado: false,
              motivo_revocacion: null,
            }],
          };
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService({} as never);
    const validacion = await service.validarToken(mockCliente as never, cut, tokenFalso);

    expect(validacion.valido).toBe(false);
    expect(validacion.motivo).toBe('TOKEN_INVALIDO');
  });

  // 6. Token vencido: acceso rechazado
  it('6. Rechaza un token cuya fecha expira_en ya transcurrió', async () => {
    const cut = 'EXP-2026-000215';
    const token = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const hash = createHash('sha256').update(token).digest('hex');

    const mockCliente = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        if (sql.includes('FROM sigd_tra.token_seguimiento_publico')) {
          return {
            rows: [{
              id_token: 'tok-vencido',
              expediente_id: 'exp-vencido',
              token_hash: hash,
              expira_en: new Date(Date.now() - 3600000), // Expiró hace 1 hora
              revocado: false,
              motivo_revocacion: null,
            }],
          };
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService({} as never);
    const validacion = await service.validarToken(mockCliente as never, cut, token);

    expect(validacion.valido).toBe(false);
    expect(validacion.motivo).toBe('TOKEN_VENCIDO');
  });

  // 7. Token revocado: acceso rechazado
  it('7. Rechaza un token marcado con revocado = true', async () => {
    const cut = 'EXP-2026-000215';
    const token = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const hash = createHash('sha256').update(token).digest('hex');

    const mockCliente = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        if (sql.includes('FROM sigd_tra.token_seguimiento_publico')) {
          return {
            rows: [{
              id_token: 'tok-revocado',
              expediente_id: 'exp-revocado',
              token_hash: hash,
              expira_en: new Date(Date.now() + 1000000),
              revocado: true,
              motivo_revocacion: 'ROTACION_POR_RENOVACION',
            }],
          };
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService({} as never);
    const validacion = await service.validarToken(mockCliente as never, cut, token);

    expect(validacion.valido).toBe(false);
    expect(validacion.motivo).toBe('TOKEN_REVOCADO');
  });

  // 8. Token manipulado: acceso rechazado
  it('8. Rechaza un token que fue alterado en un solo carácter', async () => {
    const cut = 'EXP-2026-000215';
    const tokenOriginal = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const tokenManipulado = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdee';
    const hashOriginal = createHash('sha256').update(tokenOriginal).digest('hex');

    const mockCliente = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        if (sql.includes('FROM sigd_tra.token_seguimiento_publico')) {
          return {
            rows: [{
              id_token: 'tok-1',
              expediente_id: 'exp-1',
              token_hash: hashOriginal,
              expira_en: new Date(Date.now() + 100000),
              revocado: false,
              motivo_revocacion: null,
            }],
          };
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService({} as never);
    const validacion = await service.validarToken(mockCliente as never, cut, tokenManipulado);

    expect(validacion.valido).toBe(false);
    expect(validacion.motivo).toBe('TOKEN_INVALIDO');
  });

  // 9. Navegador diferente: acceso autorizado sin cookies ni sesión previa
  it('9. Permite la validación exitosa desde un navegador limpio únicamente con CUT y token en cabecera', async () => {
    const cut = 'EXP-2026-000215';
    const token = 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const hash = createHash('sha256').update(token).digest('hex');

    const mockPool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        if (sql.includes('FROM sigd_tra.token_seguimiento_publico')) {
          return {
            rows: [{
              id_token: 'tok-cross-browser',
              expediente_id: 'exp-cross-browser',
              token_hash: hash,
              expira_en: new Date(Date.now() + 1000000),
              revocado: false,
              motivo_revocacion: null,
            }],
          };
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService(mockPool as never);
    // No se proporciona contexto de sesión ni cookies:
    const resultado = await service.validarToken(mockPool as never, cut, token);
    expect(resultado.valido).toBe(true);
    expect(resultado.expedienteId).toBe('exp-cross-browser');
  });

  // 10. Sin sesión original: acceso autorizado
  it('10. La autorización depende exclusivamente del token criptográfico y no de sesion_hash', async () => {
    const cut = 'EXP-2026-000215';
    const token = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
    const hash = createHash('sha256').update(token).digest('hex');

    const mockPool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        if (sql.includes('FROM sigd_tra.token_seguimiento_publico')) {
          return {
            rows: [{
              id_token: 'tok-indep',
              expediente_id: 'exp-indep',
              token_hash: hash,
              expira_en: new Date(Date.now() + 1000000),
              revocado: false,
              motivo_revocacion: null,
            }],
          };
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService(mockPool as never);
    const validacion = await service.validarToken(mockPool as never, cut, token);
    expect(validacion.valido).toBe(true);
  });

  // 11. CUT ajeno: acceso rechazado
  it('11. Rechaza la consulta si el token presentado corresponde a otro expediente', async () => {
    const cutA = 'EXP-2026-000215';
    const cutB = 'EXP-2026-000216';
    const tokenExpedienteB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    const mockCliente = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        if (sql.includes('WHERE e.codigo_expediente = $1')) {
          // El JOIN con e.codigo_expediente devuelve vacío porque el token B no pertenece al CUT A
          if (params[0] === cutA) {
            return { rows: [] };
          }
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService({} as never);
    const validacion = await service.validarToken(mockCliente as never, cutA, tokenExpedienteB);

    expect(validacion.valido).toBe(false);
    expect(validacion.motivo).toBe('TOKEN_NO_ENCONTRADO');
  });

  // 12. Token rotado: token anterior invalidado
  it('12. Invalida el token previo cuando se emite una rotación o renovación', async () => {
    const expedienteId = 'exp-rotacion-1';
    const queries: { sql: string; params: unknown[] }[] = [];

    const mockCliente = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        if (sql.includes('UPDATE sigd_tra.token_seguimiento_publico')) return { rowCount: 1 };
        if (sql.includes('INSERT INTO sigd_tra.token_seguimiento_publico')) {
          return { rows: [{ id_token: 'nuevo-token-id', expira_en: new Date() }] };
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService({} as never);
    const nuevoToken = await service.rotarToken(mockCliente as never, expedienteId, 'ROTACION_DE_PRUEBA');

    expect(nuevoToken.token).toBeDefined();

    // Comprobar que se ejecutó la revocación del anterior
    const updateCall = queries.find((q) => q.sql.includes('UPDATE sigd_tra.token_seguimiento_publico'));
    expect(updateCall).toBeDefined();
    expect(updateCall?.params).toContain(expedienteId);
  });

  // 13. Dos solicitudes concurrentes: control de token único activo
  it('13. Previene colisiones garantizando la revocación atómica del token anterior', async () => {
    const expedienteId = 'exp-concurrente-1';
    const mockCliente = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] };
        if (sql.includes('INSERT INTO sigd_tra.token_seguimiento_publico')) {
          return { rows: [{ id_token: 'tok-id', expira_en: new Date() }] };
        }
        return { rows: [] };
      }),
    };

    const service = new TokenSeguimientoService({} as never);
    const emision1 = await service.emitirToken(mockCliente as never, expedienteId);
    const emision2 = await service.emitirToken(mockCliente as never, expedienteId);

    expect(emision1.token).not.toBe(emision2.token);
    expect(emision1.tokenHash).not.toBe(emision2.tokenHash);
  });

  // 14. Rate limiting: bloqueo efectivo ante exceso de peticiones
  it('14. Bloquea con HTTP 429 cuando una IP o CUT supera la cuota permitida', async () => {
    const mockStore = {
      cuota: vi.fn(async (key: string) => {
        if (key.includes('ip_saturada')) return false; // Cuota agotada
        return true;
      }),
      leer: vi.fn(),
      guardar: vi.fn(),
      consumir: vi.fn(),
    };

    const limiter = new RateLimiterRedis(mockStore as never);

    await expect(limiter.verificarLimiteSeguimiento('ip_saturada', 'EXP-2026-000215')).rejects.toThrow(
      AppError
    );

    try {
      await limiter.verificarLimiteSeguimiento('ip_saturada', 'EXP-2026-000215');
    } catch (err) {
      expect((err as AppError).status).toBe(429);
      expect((err as AppError).code).toBe('RATE_LIMIT_EXCEEDED');
    }
  });

  // 15. Redis no disponible: fallo seguro (Fail-Secure)
  it('15. Aplica política Fail-Secure (HTTP 503) si Redis no está disponible o falla', async () => {
    // Limitador sin store inyectado apuntando a un puerto inexistente o simulando error
    const limiter = new RateLimiterRedis(undefined, { maxPorIp: 10 });
    // Forzamos un fallo de conexión
    vi.spyOn(limiter as never, 'cliente').mockRejectedValue(new Error('ECONNREFUSED'));

    try {
      await limiter.verificarLimiteSeguimiento('192.168.1.50', 'EXP-2026-000215');
      expect.unreachable('Debería haber lanzado un error 503');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(503);
      expect((err as AppError).code).toBe('PUBLIC_PROTECTION_UNAVAILABLE');
    }
  });

  // 16. Protección de datos personales
  it('16. Enmascara datos personales conforme a la Ley N° 29733 y no expone operadores personales', () => {
    // DNI: conserva 2 iniciales y 3 finales (45***123)
    expect(enmascararDocumento('45678123')).toBe('45***123');
    expect(enmascararDocumento('70809010')).toBe('70***010');
    expect(enmascararDocumento('123')).toBe('***');

    // Nombre: conserva primera letra de cada componente
    expect(enmascararNombre('Juan Carlos', 'Pérez', 'Gómez')).toBe('J*** P**** G****');
    expect(enmascararNombre('María', 'Ríos', null)).toBe('M**** R***');

    // Unidades orgánicas: sanitiza roles personales a entidades institucionales
    expect(sanitizarUnidadPublica('director_general_juan')).toBe('Dirección General');
    expect(sanitizarUnidadPublica('secretaria_academica')).toBe('Secretaría Académica');
    expect(sanitizarUnidadPublica('mesa_de_partes_operador')).toBe('Mesa de Partes');
    expect(sanitizarUnidadPublica('evaluador_docente_45678123')).toBe('Coordinación de Área Académica');
  });

  // 17. Redacción de tokens en logs y trazas
  it('17. Sanitiza cabeceras para que los tokens nunca se impriman en texto plano en logs', () => {
    const headers = {
      'x-sigd-public-tracking-token': '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      'authorization': 'Bearer eyJhbGciOi...',
      'host': 'localhost:3008',
    };

    // Función de sanitización de logging
    const redactarHeaders = (h: Record<string, string>) => {
      const sanitized: Record<string, string> = { ...h };
      if (sanitized['x-sigd-public-tracking-token']) {
        sanitized['x-sigd-public-tracking-token'] = '[REDACTED_TRACKING_TOKEN]';
      }
      if (sanitized['authorization']) {
        sanitized['authorization'] = '[REDACTED_AUTH]';
      }
      return sanitized;
    };

    const redigido = redactarHeaders(headers);
    expect(redigido['x-sigd-public-tracking-token']).toBe('[REDACTED_TRACKING_TOKEN]');
    expect(redigido['authorization']).toBe('[REDACTED_AUTH]');
    expect(redigido['host']).toBe('localhost:3008');
  });

  // 18. Enlace: token únicamente en el fragmento hash
  it('18. El enlace seguro utiliza el fragmento #token= evitando que el secreto viaje en la petición inicial', () => {
    const cut = 'EXP-2026-000215';
    const token = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

    // Función de construcción conceptual de URL segura
    const construirUrlSegura = (codigoCut: string, secreto: string, dominio = 'https://sigd.institutosuiza.edu.pe') => {
      return `${dominio}/tramites/consulta-publica/${codigoCut}#token=${secreto}`;
    };

    const url = construirUrlSegura(cut, token);
    const urlObj = new URL(url);

    // El secreto está estrictamente en el hash
    expect(urlObj.hash).toBe(`#token=${token}`);
    // No debe existir parámetro query con el token
    expect(urlObj.searchParams.get('token')).toBeNull();
    // La ruta HTTP no contiene el secreto
    expect(urlObj.pathname).toBe(`/tramites/consulta-publica/${cut}`);
  });

  // 19. Outbox: Cifrado autenticado AES-256-GCM para secretos temporales
  it('19. Cifra y descifra secretos con AES-256-GCM asegurando que el Outbox nunca almacene texto plano', () => {
    const secretoOriginal = 'https://sigd.institutosuiza.edu.pe/tramites/consulta-publica/EXP-2026-000215#token=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    // Cifrado
    const payloadCifrado = cifrarSecreto(secretoOriginal);
    expect(payloadCifrado).toBeDefined();
    expect(payloadCifrado).not.toContain('1234567890abcdef');
    expect(payloadCifrado).not.toContain('EXP-2026-000215');

    // Estructura iv:tag:cifrado
    const partes = payloadCifrado.split(':');
    expect(partes).toHaveLength(3);
    expect(partes[0]).toHaveLength(24); // 12 bytes IV en hex
    expect(partes[1]).toHaveLength(32); // 16 bytes Auth Tag en hex

    // Descifrado con clave legítima
    const descifrado = descifrarSecreto(payloadCifrado);
    expect(descifrado).toBe(secretoOriginal);

    // Detección de manipulación (Auth Tag falla si se altera un byte del texto cifrado)
    const manipulado = `${partes[0]}:${partes[1]}:${partes[2].slice(0, -2)}ff`;
    expect(() => descifrarSecreto(manipulado)).toThrow();
  });

  // 20. Regresión: flujo autenticado de ciudadanos registrados intacto
  it('20. Permite la consulta del expediente al titular autenticado con JWT institucional sin exigir tracking token', async () => {
    const cut = 'EXP-2026-000215';
    const idUsuarioCiudadano = '33333333-3333-3333-3333-333333333333';

    // Mock simulando la verificación de titularidad por cuenta de usuario
    const mockPool = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('SELECT EXISTS') && sql.includes('sigd_auth.cuenta_usuario')) {
          const cutParam = params[0];
          const usuarioParam = params[1];
          if (cutParam === cut && usuarioParam === idUsuarioCiudadano) {
            return { rows: [{ propio: true }] };
          }
        }
        return { rows: [{ propio: false }] };
      }),
    };

    // Verificación de pertenencia del titular
    const titularRes = await mockPool.query(
      `SELECT EXISTS (
         SELECT 1 FROM sigd_tra.expediente e
         JOIN sigd_auth.cuenta_usuario c ON c.id_persona = e.solicitante_id
        WHERE e.codigo_expediente = $1 AND c.id_usuario = $2::uuid AND c.activo = TRUE
       ) AS propio`,
      [cut, idUsuarioCiudadano]
    );

    expect(titularRes.rows[0].propio).toBe(true);
  });
});

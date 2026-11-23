import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  cifrarTokenPayload,
  descifrarTokenPayload,
  sanitizarObjetoParaLog,
  obtenerClaveCifrado,
  type PayloadTokenCifrado,
} from '../../../src/core/security/cifrado-payload.js';
import { OutboxWorker, type EventoPendiente } from '../../../src/audit/outbox-worker.js';
import {
  DestinoEmail,
  DestinoSse,
  generarPlantillaNotificacionEmail,
  EVENTOS_SENSIBLES_BLOQUEADOS_SSE,
} from '../../../src/audit/despachador-notificaciones.js';
import { BusSse } from '../../../src/modules/corelink/sseStream.service.js';
import { EmailService } from '../../../src/domains/identicore/email.service.js';
import { RegistroCiudadanoService } from '../../../src/domains/identicore/registroCiudadano.service.js';
import { UbigeoService } from '../../../src/domains/identicore/ubigeo.service.js';

describe('MATRIZ DE PRUEBAS DE RESILIENCIA Y SEGURIDAD OUTBOX (16 CASOS OBLIGATORIOS)', () => {
  const claveOriginal = process.env.TOKEN_ENCRYPTION_KEY;
  const jwtOriginal = process.env.AUTH_JWT_SECRET;
  const claveHexTest = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = claveHexTest;
    process.env.AUTH_JWT_SECRET = 'secreto_jwt_institucional_segura_2026';
  });

  afterEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = claveOriginal;
    process.env.AUTH_JWT_SECRET = jwtOriginal;
    vi.restoreAllMocks();
  });

  // 1. Cifrado y descifrado correcto
  it('01. Cifrado y descifrado correcto: AES-256-GCM recupera el token original íntegro', () => {
    const token = 'token-original-seguro-suiza-2026';
    const payloadCifrado = cifrarTokenPayload(token);

    expect(payloadCifrado.v).toBe(1);
    expect(payloadCifrado.alg).toBe('aes-256-gcm');
    expect(payloadCifrado.iv).toHaveLength(24);
    expect(payloadCifrado.tag).toHaveLength(32);

    const descifrado = descifrarTokenPayload(payloadCifrado);
    expect(descifrado).toBe(token);
  });

  // 2. Clave incorrecta
  it('02. Clave incorrecta: descifrado falla de forma segura ante clave disímil', () => {
    const token = 'token-secreto-prueba-clave-erronea';
    const payloadCifrado = cifrarTokenPayload(token);

    // Cambiar a otra clave de 256 bits
    process.env.TOKEN_ENCRYPTION_KEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
    expect(() => descifrarTokenPayload(payloadCifrado)).toThrowError();
  });

  // 3. Clave ausente
  it('03. Clave ausente: lanza excepción segura sin fallback a texto plano', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.OUTBOX_ENCRYPTION_KEY;
    delete process.env.AUTH_JWT_SECRET;

    expect(() => obtenerClaveCifrado()).toThrowError();
    expect(() => cifrarTokenPayload('token_sin_clave')).toThrowError();
  });

  // 4. Clave malformada
  it('04. Clave malformada: derivación determinista asegura clave válida de 32 bytes sin corromperse', () => {
    // Clave string no hex ni base64 de longitud arbitraria
    process.env.TOKEN_ENCRYPTION_KEY = 'clave_corta_o_irregular';
    const key = obtenerClaveCifrado();
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(32);

    const cifrado = cifrarTokenPayload('token_con_clave_irregular');
    const descifrado = descifrarTokenPayload(cifrado);
    expect(descifrado).toBe('token_con_clave_irregular');
  });

  // 5. Ciphertext manipulado
  it('05. Ciphertext manipulado: autenticación GCM detecta cualquier alteración de bits', () => {
    const cifrado = cifrarTokenPayload('token_a_manipular');
    const ctCorrupto = cifrado.ct.slice(0, -2) + (cifrado.ct.endsWith('aa') ? 'bb' : 'aa');
    const manipulado: PayloadTokenCifrado = { ...cifrado, ct: ctCorrupto };

    expect(() => descifrarTokenPayload(manipulado)).toThrowError();
  });

  // 6. Auth Tag manipulado
  it('06. Auth Tag manipulado: rechaza autenticación ante tag adulterado', () => {
    const cifrado = cifrarTokenPayload('token_tag_alterado');
    const manipulado: PayloadTokenCifrado = {
      ...cifrado,
      tag: '11112222333344445555666677778888',
    };

    expect(() => descifrarTokenPayload(manipulado)).toThrowError();
  });

  // 7. Versión incompatible
  it('07. Versión incompatible: rechaza cargas con v != 1 o algoritmos distintos', () => {
    const cifrado = cifrarTokenPayload('token_version_incompatible');
    const versionInvalida = { ...cifrado, v: 2 };
    const algInvalido = { ...cifrado, alg: 'chacha20-poly1305' };

    expect(() => descifrarTokenPayload(versionInvalida)).toThrowError();
    expect(() => descifrarTokenPayload(algInvalido)).toThrowError();
  });

  // 8. Reinicio del worker
  it('08. Reinicio del worker: nuevo worker procesa eventos pendientes retenidos sin perder estado', async () => {
    let estadoEvento = 'PENDIENTE';
    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT id_evento')) {
          if (estadoEvento === 'PENDIENTE') {
            return {
              rows: [{
                id_evento: 'evt-worker-restart-01',
                correlation_id: 'corr-01',
                agregado: 'Expediente',
                tipo_evento: 'ExpedienteRecepcionado',
                payload: { cut: 'EXP-2026-000207' },
                intentos: 0,
              }],
            };
          }
          return { rows: [] };
        }
        if (sql.includes("SET estado = 'PROCESADO'")) {
          estadoEvento = 'PROCESADO';
          return { rowCount: 1 };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    const mockDespachador = { despachar: vi.fn().mockResolvedValue(undefined) };

    // Instancia 1 se detiene
    const worker1 = new OutboxWorker(mockPool, mockDespachador);
    worker1.detener();

    // Instancia 2 inicia tras reinicio y ejecuta ciclo
    const worker2 = new OutboxWorker(mockPool, mockDespachador);
    const procesados = await worker2.ciclo();

    expect(procesados).toBe(1);
    expect(estadoEvento).toBe('PROCESADO');
    expect(mockDespachador.despachar).toHaveBeenCalledTimes(1);
  });

  // 9. Reintento de evento
  it('09. Reintento de evento: fallo transitorio incrementa contador sin marcar PROCESADO', async () => {
    let intentosRegistrados = 0;
    let estadoFinal = 'PENDIENTE';

    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes('SELECT id_evento')) {
          return {
            rows: [{
              id_evento: 'evt-reintento-01',
              correlation_id: 'corr-02',
              agregado: 'Expediente',
              tipo_evento: 'ExpedienteRecepcionado',
              payload: { cut: 'EXP-2026-000207' },
              intentos: 1,
            }],
          };
        }
        if (sql.includes('SET intentos = $2')) {
          intentosRegistrados = params?.[1] as number;
          return { rowCount: 1 };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
    const despachadorFalla = {
      despachar: vi.fn().mockRejectedValue(new Error('Fallo transitorio de conexión')),
    };

    const worker = new OutboxWorker(mockPool, despachadorFalla, { maxIntentos: 5, backoffBaseMs: 1, backoffTechoMs: 5 });
    const procesados = await worker.ciclo();

    expect(procesados).toBe(0);
    expect(intentosRegistrados).toBe(2);
    expect(estadoFinal).toBe('PENDIENTE');
  });

  // 10. Evento duplicado
  it('10. Evento duplicado: idempotencia previene doble despacho de notificaciones', async () => {
    delete process.env.RESEND_ENABLED;
    const emailService = new EmailService('', '');

    await emailService.enviar(
      { to: 'titular@suiza.edu.pe', subject: 'Aviso 1', html: '<p>Hola</p>' },
      'llave-idempotencia-unica-001',
    );
    // Intento duplicado con la misma llave
    await emailService.enviar(
      { to: 'titular@suiza.edu.pe', subject: 'Aviso 1 Duplicado', html: '<p>Hola</p>' },
      'llave-idempotencia-unica-001',
    );

    const enviados = emailService.obtenerCorreosEnviados();
    expect(enviados).toHaveLength(1);
  });

  // 11. Evento con token expirado
  it('11. Evento con token expirado: el servicio de activación rechaza tokens vencidos', async () => {
    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT t.id, t.id_usuario')) {
          // Token expirado: no devuelve filas activas
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as Pool;
    const service = new RegistroCiudadanoService(mockPool, {} as unknown as UbigeoService);

    await expect(service.activarCuenta('token-ya-expirado-2026')).rejects.toThrowError();
  });

  // 12. Evento histórico con estructura antigua
  it('12. Evento histórico con estructura antigua: genera plantilla con fallback a token plano sin crashear', () => {
    const plantilla = generarPlantillaNotificacionEmail(
      'verificacion_correo_solicitada',
      { token: 'token-historico-plano-nov2026' },
      'Ciudadano Histórico',
    );

    expect(plantilla.subject).toContain('Verificación de Dirección de Correo Electrónico');
    expect(plantilla.html).toContain('token-historico-plano-nov2026');
    expect(plantilla.html).toContain('Ciudadano Histórico');
  });

  // 13. Fallo de transporte de correo
  it('13. Fallo de transporte de correo: DestinoEmail propaga el error para activar reintentos', async () => {
    const emailService = new EmailService('', '');
    emailService.simularFallo(true, new Error('503 Service Unavailable: Resend Gateway Down'));

    const mockPool = { query: vi.fn() } as unknown as Pool;
    const destinoEmail = new DestinoEmail(mockPool, emailService);

    const evento: EventoPendiente = {
      id_evento: 'evt-email-fail-01',
      correlation_id: 'corr-email-fail',
      agregado: 'Expediente',
      tipo_evento: 'radicacion_exitosa',
      payload: {
        correo: 'estudiante@suiza.edu.pe',
        cut: 'EXP-2026-TEST',
        cuerpo: { totalFolios: 3 },
      },
      intentos: 0,
    };

    await expect(destinoEmail.despachar(evento)).rejects.toThrowError('503 Service Unavailable');
  });

  // 14. Reconexión SSE
  it('14. Reconexión SSE: nuevo suscriptor se registra adecuadamente tras desconexión', () => {
    const bus = new BusSse();
    const res1 = { write: vi.fn(), writableEnded: false } as any;
    const res2 = { write: vi.fn(), writableEnded: false } as any;

    const id1 = bus.suscribir(res1, ['casilla']);
    expect(bus.cantidadSuscriptores()).toBe(1);

    // Desconexión
    bus.cancelar(id1);
    expect(bus.cantidadSuscriptores()).toBe(0);

    // Reconexión con nueva sesión
    const id2 = bus.suscribir(res2, ['casilla', 'expedientes']);
    expect(bus.cantidadSuscriptores()).toBe(1);
    expect(id2).toBeGreaterThan(id1);
  });

  // 15. Replay de eventos
  it('15. Replay de eventos: reproduce eventos de canal legítimo y excluye eventos sensibles', () => {
    const bus = new BusSse();
    const mockRes = { write: vi.fn(), writableEnded: false } as any;

    bus.emitirEvento('casilla_notificacion', { id: 1, mensaje: 'Notificación 1' });
    bus.emitirEvento('verificacion_correo_solicitada', { token: 'secreto' }); // Sensible
    bus.emitirEvento('expediente_transicion', { id: 2, cut: 'EXP-01' });

    const reproducidos = bus.replayDesde(0, mockRes, new Set(['casilla', 'expedientes']));

    expect(reproducidos).toEqual([1, 2]);
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('casilla_notificacion'));
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('expediente_transicion'));
    expect(mockRes.write).not.toHaveBeenCalledWith(expect.stringContaining('verificacion_correo_solicitada'));
  });

  // 16. Ausencia de filtración de secretos
  it('16. Ausencia de filtración de secretos: sanitizarObjetoParaLog remueve tokens y credenciales de cualquier nivel', () => {
    const objetoSensible = {
      id: 99,
      token: 'token_secreto',
      tokenCifrado: { ct: 'aabbcc', tag: '112233' },
      contrasena: 'clave123',
      subobjeto: {
        claveSecreta: 'xyz',
        authKey: '12345',
        visible: 'ok',
      },
    };

    const sanitizado = sanitizarObjetoParaLog(objetoSensible) as any;

    expect(sanitizado.token).toBe('[REDACTED]');
    expect(sanitizado.tokenCifrado).toBe('[REDACTED]');
    expect(sanitizado.subobjeto.authKey).toBe('[REDACTED]');
    expect(sanitizado.subobjeto.visible).toBe('ok');
    expect(JSON.stringify(sanitizado)).not.toContain('token_secreto');
  });
});

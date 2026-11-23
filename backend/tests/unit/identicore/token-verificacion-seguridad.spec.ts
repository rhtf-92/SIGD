import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { RegistroCiudadanoService } from '../../../src/domains/identicore/registroCiudadano.service.js';
import { UbigeoService } from '../../../src/domains/identicore/ubigeo.service.js';
import {
  cifrarTokenPayload,
  descifrarTokenPayload,
  sanitizarObjetoParaLog,
  obtenerClaveCifrado,
  type PayloadTokenCifrado,
} from '../../../src/core/security/cifrado-payload.js';
import { BusSse, CANALES_SSE } from '../../../src/modules/corelink/sseStream.service.js';
import {
  DestinoSse,
  DestinoEmail,
  generarPlantillaNotificacionEmail,
  EVENTOS_SENSIBLES_BLOQUEADOS_SSE,
} from '../../../src/audit/despachador-notificaciones.js';
import { EmailService } from '../../../src/domains/identicore/email.service.js';
import type { EventoPendiente } from '../../../src/audit/outbox-worker.js';

describe('FASE DE CORRECCIÓN DE SEGURIDAD CRIPTOGRÁFICA Y PROTECCIÓN DE TOKENS (SIGD RENATO)', () => {
  const claveOriginal = process.env.TOKEN_ENCRYPTION_KEY;
  const jwtOriginal = process.env.AUTH_JWT_SECRET;

  beforeEach(() => {
    // Configurar clave de prueba de 32 bytes hex
    process.env.TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.AUTH_JWT_SECRET = 'secreto_jwt_prueba_institucional_segura_2026';
  });

  afterEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = claveOriginal;
    process.env.AUTH_JWT_SECRET = jwtOriginal;
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. SEGURIDAD HTTP: ELIMINACIÓN DE EXPOSICIÓN DEL TOKEN
  // ---------------------------------------------------------------------------
  describe('1. Seguridad HTTP y Eliminación de Exposición de Tokens', () => {
    it('1.1 reenviarVerificacion NO expone tokenVerificacion ni token en la respuesta', async () => {
      const mockQuery = vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT c.id_usuario')) {
          return {
            rows: [{
              id_usuario: '11111111-2222-4333-8444-555555555555',
              correo: 'estudiante.test@iestpsuiza.edu.pe',
              activo: false,
              usuario: '74561238',
              titular: 'Estudiante Prueba Suiza',
            }],
          };
        }
        if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
          return { rows: [{ id_evento: 'evt-sec-01' }] };
        }
        return { rows: [] };
      });

      const client = { query: mockQuery, release: vi.fn() };
      const pool = {
        connect: vi.fn().mockResolvedValue(client),
        query: vi.fn(),
      } as unknown as Pool;

      const ubigeo = { contieneDistrito: vi.fn().mockResolvedValue(true) } as unknown as UbigeoService;
      const service = new RegistroCiudadanoService(pool, ubigeo);

      const resultado = await service.reenviarVerificacion('74561238', '192.168.1.100');

      // Comprobar que no existe token en ninguna propiedad
      expect(resultado.exito).toBe(true);
      expect(resultado.correo).toBe('estudiante.test@iestpsuiza.edu.pe');
      expect(resultado).not.toHaveProperty('tokenVerificacion');
      expect(resultado).not.toHaveProperty('token');
      expect(resultado).not.toHaveProperty('tokenRaw');
      expect((resultado as Record<string, unknown>).tokenVerificacion).toBeUndefined();
      expect((resultado as Record<string, unknown>).token).toBeUndefined();
    });

    it('1.2 Protección anti-enumeración no filtra existencia ni tokens ante usuarios inexistentes', async () => {
      const mockQuery = vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT c.id_usuario')) {
          return { rows: [] }; // Usuario inexistente
        }
        return { rows: [] };
      });

      const client = { query: mockQuery, release: vi.fn() };
      const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
      const service = new RegistroCiudadanoService(pool, {} as unknown as UbigeoService);

      const resultado = await service.reenviarVerificacion('usuario_desconocido@suiza.edu.pe');

      expect(resultado.exito).toBe(true);
      expect(resultado.mensaje).toContain('Si los datos corresponden a una cuenta pendiente');
      expect(resultado).not.toHaveProperty('tokenVerificacion');
      expect(resultado).not.toHaveProperty('token');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. SEGURIDAD CRIPTOGRÁFICA EN TRANSACTIONAL OUTBOX (AES-256-GCM)
  // ---------------------------------------------------------------------------
  describe('2. Seguridad Criptográfica y Cifrado Autenticado (AES-256-GCM)', () => {
    it('2.1 Cifra correctamente con AES-256-GCM incluyendo versión, IV, tag y ct', () => {
      const tokenOriginal = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0';
      const cifrado = cifrarTokenPayload(tokenOriginal);

      expect(cifrado.v).toBe(1);
      expect(cifrado.alg).toBe('aes-256-gcm');
      expect(cifrado.iv).toMatch(/^[0-9a-f]{24}$/); // 12 bytes = 24 hex
      expect(cifrado.tag).toMatch(/^[0-9a-f]{32}$/); // 16 bytes = 32 hex
      expect(cifrado.ct).toBeDefined();
      expect(cifrado.ct).not.toBe(tokenOriginal);
      expect(cifrado.ct).not.toContain(tokenOriginal);

      // Descifrado exitoso con la misma clave
      const descifrado = descifrarTokenPayload(cifrado);
      expect(descifrado).toBe(tokenOriginal);
    });

    it('2.2 Rechaza un ciphertext manipulado (integridad autenticada GCM)', () => {
      const tokenOriginal = 'token_secreto_super_seguro_2026';
      const cifrado = cifrarTokenPayload(tokenOriginal);

      // Manipular el último byte del ciphertext
      const ultimoChar = cifrado.ct.slice(-1);
      const reemplazo = ultimoChar === 'a' ? 'b' : 'a';
      const manipulado: PayloadTokenCifrado = {
        ...cifrado,
        ct: cifrado.ct.slice(0, -1) + reemplazo,
      };

      expect(() => descifrarTokenPayload(manipulado)).toThrowError();
    });

    it('2.3 Rechaza una etiqueta de autenticación (tag) manipulada', () => {
      const tokenOriginal = 'token_prueba_integridad_tag';
      const cifrado = cifrarTokenPayload(tokenOriginal);

      const tagManipulado: PayloadTokenCifrado = {
        ...cifrado,
        tag: '00000000000000000000000000000000',
      };

      expect(() => descifrarTokenPayload(tagManipulado)).toThrowError();
    });

    it('2.4 Falla de forma segura si falta la clave y no puede derivarse', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      delete process.env.OUTBOX_ENCRYPTION_KEY;
      delete process.env.AUTH_JWT_SECRET;

      expect(() => obtenerClaveCifrado()).toThrowError();
      expect(() => cifrarTokenPayload('token_sin_clave')).toThrowError();
    });

    it('2.5 El payload insertado en sigd_audit.evento_outbox NO contiene el token en texto plano', async () => {
      let payloadCapturado: Record<string, unknown> | null = null;

      const mockQuery = vi.fn().mockImplementation(async (sql: string, params: unknown[]) => {
        if (sql.includes('SELECT c.id_usuario')) {
          return {
            rows: [{
              id_usuario: '11111111-2222-4333-8444-555555555555',
              correo: 'seguridad@iestpsuiza.edu.pe',
              activo: false,
              usuario: '74561238',
              titular: 'Auditor Seguridad',
            }],
          };
        }
        if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
          payloadCapturado = JSON.parse(params[3] as string);
          return { rows: [{ id_evento: 'evt-sec-02' }] };
        }
        return { rows: [] };
      });

      const client = { query: mockQuery, release: vi.fn() };
      const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
      const service = new RegistroCiudadanoService(pool, {} as unknown as UbigeoService);

      await service.reenviarVerificacion('74561238');

      expect(payloadCapturado).not.toBeNull();
      expect(payloadCapturado).not.toHaveProperty('token');
      expect(payloadCapturado).toHaveProperty('tokenCifrado');

      const tc = payloadCapturado!.tokenCifrado as PayloadTokenCifrado;
      expect(tc.v).toBe(1);
      expect(tc.alg).toBe('aes-256-gcm');
      expect(tc.ct).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. BLOQUEO ESTRICTO EN SSE (SERVER-SENT EVENTS)
  // ---------------------------------------------------------------------------
  describe('3. Bloqueo de Difusión de Eventos Sensibles en SSE', () => {
    it('3.1 verificacion_correo_solicitada está explícitamente en el conjunto bloqueado', () => {
      expect(EVENTOS_SENSIBLES_BLOQUEADOS_SSE.has('verificacion_correo_solicitada')).toBe(true);
    });

    it('3.2 DestinoSse omite y no emite verificacion_correo_solicitada hacia BusSse ni Bridge', async () => {
      const mockBus = { emitirEvento: vi.fn() } as unknown as BusSse;
      const mockBridge = { publicar: vi.fn().mockResolvedValue(undefined) };
      const destinoSse = new DestinoSse(mockBus, mockBridge as any);

      const eventoSensible: EventoPendiente = {
        id_evento: 'evt-sse-01',
        correlation_id: crypto.randomUUID(),
        agregado: 'cuenta_usuario',
        tipo_evento: 'verificacion_correo_solicitada',
        payload: {
          correo: 'victima@suiza.edu.pe',
          tokenCifrado: cifrarTokenPayload('secreto123'),
        },
        intentos: 0,
      };

      await destinoSse.despachar(eventoSensible);

      expect(mockBus.emitirEvento).not.toHaveBeenCalled();
      expect(mockBridge.publicar).not.toHaveBeenCalled();
    });

    it('3.3 BusSse rechaza y no difunde verificacion_correo_solicitada a ningún suscriptor', () => {
      const bus = new BusSse();
      const mockRes = { write: vi.fn(), writableEnded: false } as any;

      // Suscribir a todos los canales posibles
      bus.suscribir(mockRes, CANALES_SSE);

      bus.emitirEvento('verificacion_correo_solicitada', {
        token: 'token_que_nunca_debe_salir',
        correo: 'admin@suiza.edu.pe',
      });

      expect(mockRes.write).not.toHaveBeenCalled();
    });

    it('3.4 replayDesde omite eventos sensibles durante reconexiones de clientes', () => {
      const bus = new BusSse();
      const mockRes = { write: vi.fn(), writableEnded: false } as any;

      bus.emitirEvento('casilla_notificacion', { id: 101, asunto: 'Legítimo' });
      // Evento sensible forzado
      bus.emitirEvento('verificacion_correo_solicitada', { token: 'fugado' });

      const reproducidos = bus.replayDesde(0, mockRes, new Set(['casilla', 'expedientes']));

      expect(reproducidos).toEqual([1]);
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('event: casilla_notificacion'));
      expect(mockRes.write).not.toHaveBeenCalledWith(expect.stringContaining('verificacion_correo_solicitada'));
    });

    it('3.5 Los eventos públicos legítimos continúan difundiéndose normalmente por SSE', async () => {
      const mockBus = { emitirEvento: vi.fn() } as unknown as BusSse;
      const destinoSse = new DestinoSse(mockBus);

      const eventoLegitimo: EventoPendiente = {
        id_evento: 'evt-sse-legitimo',
        correlation_id: crypto.randomUUID(),
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteDerivado',
        payload: { cut: 'EXP-2026-000207', motivo: 'Pase a Dirección' },
        intentos: 0,
      };

      await destinoSse.despachar(eventoLegitimo);

      expect(mockBus.emitirEvento).toHaveBeenCalledWith(
        'ExpedienteDerivado',
        expect.objectContaining({ cut: 'EXP-2026-000207' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. DESPACHO DE CORREO: DESCIFRADO AUTORIZADO Y SANEAMIENTO DE LOGS
  // ---------------------------------------------------------------------------
  describe('4. Despacho Seguro de Correo y Saneamiento de Logs', () => {
    it('4.1 generarPlantillaNotificacionEmail descifra el token cifrado exclusivamente para el correo', () => {
      const tokenOriginal = 'tok-4289-abcd-ef01-2345';
      const tokenCifrado = cifrarTokenPayload(tokenOriginal);

      const plantilla = generarPlantillaNotificacionEmail(
        'verificacion_correo_solicitada',
        { tokenCifrado },
        'Juan Pérez',
      );

      expect(plantilla.subject).toContain('Verificación de Dirección de Correo Electrónico');
      expect(plantilla.html).toContain(tokenOriginal);
      expect(plantilla.html).toContain('Juan Pérez');
      expect(plantilla.html).toContain('AVISO LEGAL OBLIGATORIO');
    });

    it('4.2 sanitizarObjetoParaLog remueve tokens, contraseñas y secretos recursivamente', () => {
      const datosSucios = {
        idUsuario: 'uuid-123',
        correo: 'seguro@suiza.edu.pe',
        token: 'super_secreto',
        tokenVerificacion: 'secreto2',
        password_hash: 'argon2id$v=19...',
        apiKey: 'secret_live_key',
        anidado: {
          credencial: 'clave123',
          normal: 'valor_publico',
        },
      };

      const sanitizado = sanitizarObjetoParaLog(datosSucios) as Record<string, unknown>;

      expect(sanitizado.idUsuario).toBe('uuid-123');
      expect(sanitizado.correo).toBe('seguro@suiza.edu.pe');
      expect(sanitizado.token).toBe('[REDACTED]');
      expect(sanitizado.tokenVerificacion).toBe('[REDACTED]');
      expect(sanitizado.password_hash).toBe('[REDACTED]');
      expect(sanitizado.apiKey).toBe('[REDACTED]');
      expect((sanitizado.anidado as Record<string, unknown>).credencial).toBe('[REDACTED]');
      expect((sanitizado.anidado as Record<string, unknown>).normal).toBe('valor_publico');
    });

    it('4.3 EmailService no emite correos reales si RESEND_ENABLED !== true y sanitiza log', async () => {
      delete process.env.RESEND_ENABLED;
      const emailService = new EmailService('', '');
      const spyConsole = vi.spyOn(console, 'log').mockImplementation(() => {});

      await emailService.enviar(
        {
          to: 'destinatario@suiza.edu.pe',
          subject: 'Asunto de Prueba',
          html: '<p>Contenido con token 123456</p>',
        },
        'key-idempotencia-test-01',
      );

      expect(spyConsole).toHaveBeenCalledWith(
        expect.stringContaining('[EMAIL] Modo simulado (RESEND_ENABLED != true)'),
      );
      // El log de consola no vuelca el cuerpo HTML del correo
      const llamada = spyConsole.mock.calls.find((c) => String(c[0]).includes('[EMAIL] Modo simulado'));
      expect(String(llamada)).not.toContain('Contenido con token 123456');

      const enviados = emailService.obtenerCorreosEnviados();
      expect(enviados).toHaveLength(1);
      expect(enviados[0].to).toBe('destinatario@suiza.edu.pe');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. CONTROL DE IDENTIDAD: UNICIDAD Y CADUCIDAD DE TOKENS
  // ---------------------------------------------------------------------------
  describe('5. Integridad de Cuenta y Caducidad de Tokens en Base de Datos', () => {
    it('5.1 La activación rechaza tokens vencidos o ya utilizados', async () => {
      const mockQuery = vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT t.id, t.id_usuario')) {
          // Token no encontrado (vencido o usado_en IS NOT NULL)
          return { rows: [] };
        }
        return { rows: [] };
      });

      const client = { query: mockQuery, release: vi.fn() };
      const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
      const service = new RegistroCiudadanoService(pool, {} as unknown as UbigeoService);

      await expect(service.activarCuenta('token_vencido_o_usado')).rejects.toThrowError();
    });
  });
});

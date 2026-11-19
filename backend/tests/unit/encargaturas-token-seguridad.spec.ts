import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  TransaccionalTokenService,
  type TokenTransaccionalInput,
} from '../../src/core/auth/transaccional-token.service.js';
import { EncargaturaService } from '../../src/modules/encargaturas/encargatura.service.js';

describe('TSK-1.2-M.1 · Suite Integral de Seguridad Criptográfica, Concurrencia y Multiinstitucionalidad (23 Vectores)', () => {
  const SECRET_ACTIVO = 'test_secret_key_institucional_suiza_2026_12345';
  const KID_ACTIVO = 'sigd_k2026_primary_a1b2';
  const USUARIO_ID = '018f9810-72cb-7101-b258-3d12d4a12345';
  const ENCARGATURA_ID = '018f9815-a34e-7202-9988-5c44a2b10011';
  const PERMISO_ID = '018f9820-b45f-7303-aa99-6d55b3c20022';
  const INSTITUCION_ID = '018f9805-51aa-7000-8111-2b00c3f00001';
  const CORRELATION_ID = '018f9830-c56a-7404-bb00-7e66c4d30033';

  // Helper para crear tokens HMAC firmados manualmente con payloads arbitrarios para pruebas negativas
  function armarTokenFirmado(payload: any, secret: string = SECRET_ACTIVO): string {
    const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    const sig = crypto.createHmac('sha256', secret).update(b64).digest('hex');
    return `${b64}.${sig}`;
  }

  describe('1. Pruebas Criptográficas y Validación Fail-Closed del Token Transaccional', () => {
    it('TC-01: Genera y valida un token legítimo con estructura canónica completa', () => {
      const contentHash = TransaccionalTokenService.calcularContentHashSuplencia({
        encargaturaId: ENCARGATURA_ID,
        codigoPermiso: 'FIRMA_FIRMAR',
        tipoDocumento: 'RESOLUCION_DIRECTORAL',
      });

      const token = TransaccionalTokenService.generarToken(
        {
          kid: KID_ACTIVO,
          userId: USUARIO_ID,
          op: 'AUTORIZAR_SUPLENCIA',
          targetId: ENCARGATURA_ID,
          subTargetId: 'FIRMA_FIRMAR',
          contentHash,
          institucionId: INSTITUCION_ID,
          correlationId: CORRELATION_ID,
          ventanaSegundos: 30,
        },
        SECRET_ACTIVO,
      );

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(2);

      const payload = TransaccionalTokenService.validarTokenLocal(
        token,
        SECRET_ACTIVO,
        'AUTORIZAR_SUPLENCIA',
        ENCARGATURA_ID,
        'FIRMA_FIRMAR',
        contentHash,
      );

      expect(payload.iss).toBe('SIGD_API_BACKEND');
      expect(payload.aud).toBe('SIGD_POSTGRESQL_ENGINE');
      expect(payload.user_id).toBe(USUARIO_ID);
      expect(payload.op).toBe('AUTORIZAR_SUPLENCIA');
      expect(payload.nonce).toBeDefined();
      expect(payload.nonce.length).toBe(64);
    });

    it('TC-02: Rechaza un token con firma falsificada o secreto incorrecto', () => {
      const contentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const token = TransaccionalTokenService.generarToken(
        {
          kid: KID_ACTIVO,
          userId: USUARIO_ID,
          op: 'REVOCAR_PERMISO',
          targetId: ENCARGATURA_ID,
          subTargetId: PERMISO_ID,
          contentHash,
          institucionId: INSTITUCION_ID,
          correlationId: CORRELATION_ID,
        },
        'clave_falsa_atacante',
      );

      expect(() => {
        TransaccionalTokenService.validarTokenLocal(
          token,
          SECRET_ACTIVO,
          'REVOCAR_PERMISO',
          ENCARGATURA_ID,
          PERMISO_ID,
          contentHash,
        );
      }).toThrowError(/Firma del token transaccional inválida/);
    });

    it('TC-03: Rechaza un token expirado (exp <= now)', () => {
      const nowEpoch = Date.now() / 1000;
      const payloadExpirado = {
        iss: 'SIGD_API_BACKEND',
        aud: 'SIGD_POSTGRESQL_ENGINE',
        kid: KID_ACTIVO,
        user_id: USUARIO_ID,
        op: 'AUTORIZAR_SUPLENCIA',
        target_id: ENCARGATURA_ID,
        content_hash: 'abc',
        institucion_id: INSTITUCION_ID,
        correlation_id: CORRELATION_ID,
        iat: nowEpoch - 70,
        exp: nowEpoch - 10,
        nonce: crypto.randomBytes(32).toString('hex'),
      };
      const token = armarTokenFirmado(payloadExpirado);

      expect(() => {
        TransaccionalTokenService.validarTokenLocal(token, SECRET_ACTIVO, 'AUTORIZAR_SUPLENCIA', ENCARGATURA_ID);
      }).toThrowError(/Token transaccional expirado/);
    });

    it('TC-04: Rechaza un token prematuro emitido en el futuro (iat > now + 5s)', () => {
      const nowEpoch = Date.now() / 1000;
      const payloadPrematuro = {
        iss: 'SIGD_API_BACKEND',
        aud: 'SIGD_POSTGRESQL_ENGINE',
        kid: KID_ACTIVO,
        user_id: USUARIO_ID,
        op: 'AUTORIZAR_SUPLENCIA',
        target_id: ENCARGATURA_ID,
        content_hash: 'abc',
        institucion_id: INSTITUCION_ID,
        correlation_id: CORRELATION_ID,
        iat: nowEpoch + 20,
        exp: nowEpoch + 40,
        nonce: crypto.randomBytes(32).toString('hex'),
      };
      const token = armarTokenFirmado(payloadPrematuro);

      expect(() => {
        TransaccionalTokenService.validarTokenLocal(token, SECRET_ACTIVO, 'AUTORIZAR_SUPLENCIA', ENCARGATURA_ID);
      }).toThrowError(/Token transaccional emitido en el futuro/);
    });

    it('TC-05: Rechaza un token con ventana excesiva superior a 60 segundos', () => {
      const nowEpoch = Date.now() / 1000;
      const payloadVentanaExcesiva = {
        iss: 'SIGD_API_BACKEND',
        aud: 'SIGD_POSTGRESQL_ENGINE',
        kid: KID_ACTIVO,
        user_id: USUARIO_ID,
        op: 'AUTORIZAR_SUPLENCIA',
        target_id: ENCARGATURA_ID,
        content_hash: 'abc',
        institucion_id: INSTITUCION_ID,
        correlation_id: CORRELATION_ID,
        iat: nowEpoch,
        exp: nowEpoch + 120, // 2 minutos
        nonce: crypto.randomBytes(32).toString('hex'),
      };
      const token = armarTokenFirmado(payloadVentanaExcesiva);

      expect(() => {
        TransaccionalTokenService.validarTokenLocal(token, SECRET_ACTIVO, 'AUTORIZAR_SUPLENCIA', ENCARGATURA_ID);
      }).toThrowError(/Ventana de validez del token transaccional inválida/);
    });

    it('TC-06: Rechaza discrepancia entre operación solicitada y autorizada', () => {
      const contentHash = 'abc';
      const token = TransaccionalTokenService.generarToken(
        {
          kid: KID_ACTIVO,
          userId: USUARIO_ID,
          op: 'REVOCAR_PERMISO',
          targetId: ENCARGATURA_ID,
          contentHash,
          institucionId: INSTITUCION_ID,
          correlationId: CORRELATION_ID,
        },
        SECRET_ACTIVO,
      );

      expect(() => {
        TransaccionalTokenService.validarTokenLocal(token, SECRET_ACTIVO, 'RECTIFICAR_ENCARGATURA', ENCARGATURA_ID);
      }).toThrowError(/Operación autorizada \(REVOCAR_PERMISO\) no coincide con la esperada \(RECTIFICAR_ENCARGATURA\)/);
    });

    it('TC-07: Rechaza discrepancia de content_hash (parámetros alterados en tránsito)', () => {
      const token = TransaccionalTokenService.generarToken(
        {
          kid: KID_ACTIVO,
          userId: USUARIO_ID,
          op: 'RECTIFICAR_ENCARGATURA',
          targetId: ENCARGATURA_ID,
          subTargetId: 'inicio',
          contentHash: 'hash_original_esperado',
          institucionId: INSTITUCION_ID,
          correlationId: CORRELATION_ID,
        },
        SECRET_ACTIVO,
      );

      expect(() => {
        TransaccionalTokenService.validarTokenLocal(
          token,
          SECRET_ACTIVO,
          'RECTIFICAR_ENCARGATURA',
          ENCARGATURA_ID,
          'inicio',
          'hash_alterado_por_atacante',
        );
      }).toThrowError(/El resumen criptográfico del contenido no coincide/);
    });

    it('TC-08: Verifica cálculo canónico de content_hash para RECTIFICAR_ENCARGATURA', () => {
      const hash = TransaccionalTokenService.calcularContentHashRectificar({
        encargaturaId: ENCARGATURA_ID,
        campo: 'inicio',
        valorAnterior: '2026-01-01T00:00:00Z',
        valorNuevo: '2026-02-01T00:00:00Z',
        documentoSustentoTipo: 'RESOLUCION_DIRECTORAL',
        documentoSustentoNumero: 'RD-045-2026',
        justificacion: 'Corrección de fecha de inicio por resolución modificatoria.',
      });

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);

      const canonicalEsperado =
        `OP:RECTIFICAR_ENCARGATURA|TARGET:${ENCARGATURA_ID}|CAMPO:inicio` +
        `|VAL_ANT:2026-01-01T00:00:00Z|VAL_NUEVO:2026-02-01T00:00:00Z` +
        `|DOC_TIPO:RESOLUCION_DIRECTORAL|DOC_NUM:RD-045-2026` +
        `|JUST:Corrección de fecha de inicio por resolución modificatoria.`;
      const hashManual = crypto.createHash('sha256').update(canonicalEsperado, 'utf8').digest('hex');
      expect(hash).toBe(hashManual);
    });

    it('TC-09: Verifica cálculo canónico de content_hash para REVOCAR_PERMISO', () => {
      const hash = TransaccionalTokenService.calcularContentHashRevocar({
        encargaturaId: ENCARGATURA_ID,
        permisoId: PERMISO_ID,
        motivo: 'Revocación por reestructuración del despacho directivo.',
      });

      const canonicalEsperado =
        `OP:REVOCAR_PERMISO|TARGET:${ENCARGATURA_ID}|PERM:${PERMISO_ID}` +
        `|MOTIVO:Revocación por reestructuración del despacho directivo.`;
      const hashManual = crypto.createHash('sha256').update(canonicalEsperado, 'utf8').digest('hex');
      expect(hash).toBe(hashManual);
    });

    it('TC-10: Verifica cálculo canónico de content_hash para ASIGNAR_PERMISO', () => {
      const hash = TransaccionalTokenService.calcularContentHashAsignar({
        encargaturaId: ENCARGATURA_ID,
        permisoId: PERMISO_ID,
      });

      const canonicalEsperado = `OP:ASIGNAR_PERMISO|TARGET:${ENCARGATURA_ID}|PERM:${PERMISO_ID}`;
      const hashManual = crypto.createHash('sha256').update(canonicalEsperado, 'utf8').digest('hex');
      expect(hash).toBe(hashManual);
    });

    it('TC-11: Verifica cálculo canónico de content_hash para AUTORIZAR_SUPLENCIA', () => {
      const hash = TransaccionalTokenService.calcularContentHashSuplencia({
        encargaturaId: ENCARGATURA_ID,
        codigoPermiso: 'EXPEDIENTE_DERIVAR',
        tipoDocumento: 'OFICIO_MULTIPLE',
      });

      const canonicalEsperado = `OP:AUTORIZAR_SUPLENCIA|TARGET:${ENCARGATURA_ID}|PERM:EXPEDIENTE_DERIVAR|DOC_TIPO:OFICIO_MULTIPLE`;
      const hashManual = crypto.createHash('sha256').update(canonicalEsperado, 'utf8').digest('hex');
      expect(hash).toBe(hashManual);
    });

    it('TC-12: Rechaza token con propiedades obligatorias faltantes', () => {
      const nowEpoch = Date.now() / 1000;
      // Payload sin nonce ni institucion_id
      const payloadIncompleto: any = {
        iss: 'SIGD_API_BACKEND',
        aud: 'SIGD_POSTGRESQL_ENGINE',
        kid: KID_ACTIVO,
        user_id: USUARIO_ID,
        op: 'AUTORIZAR_SUPLENCIA',
        target_id: ENCARGATURA_ID,
        content_hash: 'abc',
        iat: nowEpoch,
        exp: nowEpoch + 30,
      };
      const token = armarTokenFirmado(payloadIncompleto);

      expect(() => {
        TransaccionalTokenService.validarTokenLocal(token, SECRET_ACTIVO, 'AUTORIZAR_SUPLENCIA', ENCARGATURA_ID);
      }).toThrowError(/El token transaccional carece de propiedades obligatorias/);
    });

    it('TC-13: Rechaza token con emisor (iss) o audiencia (aud) no autorizados', () => {
      const nowEpoch = Date.now() / 1000;
      const payloadInvalido = {
        iss: 'MALICIOUS_APP',
        aud: 'SIGD_POSTGRESQL_ENGINE',
        kid: KID_ACTIVO,
        user_id: USUARIO_ID,
        op: 'AUTORIZAR_SUPLENCIA',
        target_id: ENCARGATURA_ID,
        content_hash: 'abc',
        institucion_id: INSTITUCION_ID,
        correlation_id: CORRELATION_ID,
        iat: nowEpoch,
        exp: nowEpoch + 30,
        nonce: crypto.randomBytes(32).toString('hex'),
      };
      const token = armarTokenFirmado(payloadInvalido);

      expect(() => {
        TransaccionalTokenService.validarTokenLocal(token, SECRET_ACTIVO, 'AUTORIZAR_SUPLENCIA', ENCARGATURA_ID);
      }).toThrowError(/Emisor \(iss\) o audiencia \(aud\) no válidos/);
    });

    it('TC-14: Rechaza token corrupto no convertible a JSON', () => {
      const base64Invalido = Buffer.from('ESTO_NO_ES_UN_JSON').toString('base64');
      const sig = crypto.createHmac('sha256', SECRET_ACTIVO).update(base64Invalido).digest('hex');
      const token = `${base64Invalido}.${sig}`;

      expect(() => {
        TransaccionalTokenService.validarTokenLocal(token, SECRET_ACTIVO, 'AUTORIZAR_SUPLENCIA', ENCARGATURA_ID);
      }).toThrowError(/La carga del token transaccional no es un JSON válido/);
    });

    it('TC-15: Rechaza token con formato estructural inválido (no 2 segmentos delimitados por punto)', () => {
      expect(() => {
        TransaccionalTokenService.validarTokenLocal('token.con.demasiados.puntos', SECRET_ACTIVO, 'AUTORIZAR_SUPLENCIA', ENCARGATURA_ID);
      }).toThrowError(/El token debe contener exactamente <payload_b64>\.<signature_hex>/);

      expect(() => {
        TransaccionalTokenService.validarTokenLocal('tokensinpuntos', SECRET_ACTIVO, 'AUTORIZAR_SUPLENCIA', ENCARGATURA_ID);
      }).toThrowError(/El token debe contener exactamente <payload_b64>\.<signature_hex>/);
    });

    it('TC-16: Rechaza token con target_id discrepante', () => {
      const contentHash = 'abc';
      const token = TransaccionalTokenService.generarToken(
        {
          kid: KID_ACTIVO,
          userId: USUARIO_ID,
          op: 'AUTORIZAR_SUPLENCIA',
          targetId: '018f9815-0000-0000-0000-000000000001',
          contentHash,
          institucionId: INSTITUCION_ID,
          correlationId: CORRELATION_ID,
        },
        SECRET_ACTIVO,
      );

      expect(() => {
        TransaccionalTokenService.validarTokenLocal(token, SECRET_ACTIVO, 'AUTORIZAR_SUPLENCIA', ENCARGATURA_ID);
      }).toThrowError(/Destino autorizado no coincide/);
    });

    it('TC-17: Rechaza token con sub_target_id discrepante', () => {
      const contentHash = 'abc';
      const token = TransaccionalTokenService.generarToken(
        {
          kid: KID_ACTIVO,
          userId: USUARIO_ID,
          op: 'RECTIFICAR_ENCARGATURA',
          targetId: ENCARGATURA_ID,
          subTargetId: 'inicio',
          contentHash,
          institucionId: INSTITUCION_ID,
          correlationId: CORRELATION_ID,
        },
        SECRET_ACTIVO,
      );

      expect(() => {
        TransaccionalTokenService.validarTokenLocal(token, SECRET_ACTIVO, 'RECTIFICAR_ENCARGATURA', ENCARGATURA_ID, 'fin');
      }).toThrowError(/Sub-destino autorizado no coincide/);
    });

    it('TC-18: Falla la generación de token si no se suministra el secreto institucional', () => {
      expect(() => {
        TransaccionalTokenService.generarToken(
          {
            kid: KID_ACTIVO,
            userId: USUARIO_ID,
            op: 'AUTORIZAR_SUPLENCIA',
            targetId: ENCARGATURA_ID,
            contentHash: 'abc',
            institucionId: INSTITUCION_ID,
            correlationId: CORRELATION_ID,
          },
          '',
        );
      }).toThrowError(/No se configuró el secreto de firma transaccional/);
    });
  });

  describe('2. Contratos de Integridad, Lógica de Negocio y Reglas Institucionales', () => {
    it('TC-19: Simula y valida detección de colisión cuando valor anterior no coincide en rectificación', async () => {
      const mockQuery = vi.fn().mockImplementation(() => {
        const err: any = new Error('RECTIFICACION_VALOR_ANTERIOR_DISCREPANTE: El valor anterior no coincide');
        err.code = '23514';
        throw err;
      });

      const mockPool: any = {
        connect: vi.fn().mockResolvedValue({
          query: mockQuery,
          release: vi.fn(),
        }),
      };

      const service = new EncargaturaService(mockPool, KID_ACTIVO, SECRET_ACTIVO);
      await expect(
        service.rectificarEncargatura({
          encargaturaId: ENCARGATURA_ID,
          campo: 'inicio',
          valorAnterior: '2026-01-01T00:00:00Z',
          valorNuevo: '2026-02-01T00:00:00Z',
          documentoSustentoTipo: 'RESOLUCION_DIRECTORAL',
          documentoSustentoNum: 'RD-045-2026',
          justificacion: 'Corrección de fecha de inicio por resolución modificatoria.',
          actorUsuarioId: USUARIO_ID,
          institucionId: INSTITUCION_ID,
          correlationId: CORRELATION_ID,
        }),
      ).rejects.toThrowError(/RECTIFICACION_VALOR_ANTERIOR_DISCREPANTE/);
    });

    it('TC-20: Simula y valida detección de duplicidad cuando un permiso ya está revocado', async () => {
      const mockQuery = vi.fn().mockImplementation(() => {
        const err: any = new Error('REVOCACION_PERMISO_YA_REVOCADO: El permiso ya se encuentra REVOCADO');
        err.code = '23514';
        throw err;
      });

      const mockPool: any = {
        connect: vi.fn().mockResolvedValue({
          query: mockQuery,
          release: vi.fn(),
        }),
      };

      const service = new EncargaturaService(mockPool, KID_ACTIVO, SECRET_ACTIVO);
      await expect(
        service.revocarPermisoEncargatura({
          encargaturaId: ENCARGATURA_ID,
          permisoId: PERMISO_ID,
          motivo: 'Revocación por reestructuración del despacho directivo.',
          actorUsuarioId: USUARIO_ID,
          institucionId: INSTITUCION_ID,
          correlationId: CORRELATION_ID,
        }),
      ).rejects.toThrowError(/REVOCACION_PERMISO_YA_REVOCADO/);
    });

    it('TC-21: Valida rechazo de asignación de permisos no delegables fuera de la whitelist oficial', async () => {
      const mockQuery = vi.fn().mockImplementation(() => {
        const err: any = new Error('ASIGNACION_PERMISO_NO_DELEGABLE: El permiso "SISTEMA_CONFIGURAR" no es delegable');
        err.code = '23514';
        throw err;
      });

      const mockPool: any = {
        connect: vi.fn().mockResolvedValue({
          query: mockQuery,
          release: vi.fn(),
        }),
      };

      const service = new EncargaturaService(mockPool, KID_ACTIVO, SECRET_ACTIVO);
      await expect(
        service.asignarPermisoEncargatura({
          encargaturaId: ENCARGATURA_ID,
          permisoId: PERMISO_ID,
          actorUsuarioId: USUARIO_ID,
          institucionId: INSTITUCION_ID,
          correlationId: CORRELATION_ID,
        }),
      ).rejects.toThrowError(/ASIGNACION_PERMISO_NO_DELEGABLE/);
    });
  });

  describe('3. Segregación Multiinstitucional y Resiliencia Concurrente', () => {
    it('TC-22: Valida aislamiento cross-tenant institucional denegando acceso si la institución difiere', async () => {
      const mockQuery = vi.fn().mockImplementation(() => {
        const err: any = new Error('RECTIFICACION_INSTITUCION_MISMATCH: Encargatura no pertenece a la institución del token');
        err.code = '42501';
        throw err;
      });

      const mockPool: any = {
        connect: vi.fn().mockResolvedValue({
          query: mockQuery,
          release: vi.fn(),
        }),
      };

      const service = new EncargaturaService(mockPool, KID_ACTIVO, SECRET_ACTIVO);
      await expect(
        service.rectificarEncargatura({
          encargaturaId: ENCARGATURA_ID,
          campo: 'inicio',
          valorAnterior: '2026-01-01T00:00:00Z',
          valorNuevo: '2026-02-01T00:00:00Z',
          documentoSustentoTipo: 'RD',
          documentoSustentoNum: '001',
          justificacion: 'Ajuste institucional para otra sede.',
          actorUsuarioId: USUARIO_ID,
          institucionId: '018f9805-9999-9999-9999-999999999999', // Institución ajena
          correlationId: CORRELATION_ID,
        }),
      ).rejects.toThrowError(/RECTIFICACION_INSTITUCION_MISMATCH/);
    });

    it('TC-23: Concurrencia transaccional: reintenta automáticamente ante 40P01 / 40001 y falla limpiamente al agotar reintentos', async () => {
      // 1. Caso exitoso tras reintento por 40P01 (deadlock)
      let intentos1 = 0;
      const mockQuery1 = vi.fn().mockImplementation(() => {
        intentos1 += 1;
        if (intentos1 === 1) {
          const err: any = new Error('deadlock detected');
          err.code = '40P01';
          throw err;
        }
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              autorizado: true,
              usuario_suplente_id: USUARIO_ID,
              titular_usuario_id: '018f9810-0000-0000-0000-000000000001',
              cargo_id: '018f9810-0000-0000-0000-000000000002',
              area_despacho_id: '018f9810-0000-0000-0000-000000000003',
              institucion_id: INSTITUCION_ID,
              documento_sustento_tipo: 'RD',
              documento_sustento_num: '001',
              correlation_id: CORRELATION_ID,
            },
          ],
        });
      });

      const mockPool1: any = {
        connect: vi.fn().mockResolvedValue({
          query: mockQuery1,
          release: vi.fn(),
        }),
      };

      const service1 = new EncargaturaService(mockPool1, KID_ACTIVO, SECRET_ACTIVO);
      const res = await service1.adquirirAutorizacionSuplencia({
        encargaturaId: ENCARGATURA_ID,
        codigoPermiso: 'FIRMA_FIRMAR',
        usuarioId: USUARIO_ID,
        institucionId: INSTITUCION_ID,
        correlationId: CORRELATION_ID,
      });

      expect(res.autorizado).toBe(true);
      expect(intentos1).toBe(2);

      // 2. Caso fallido continuo que agota el umbral
      const mockQuery2 = vi.fn().mockImplementation(() => {
        const err: any = new Error('deadlock detected continuously');
        err.code = '40P01';
        throw err;
      });

      const mockPool2: any = {
        connect: vi.fn().mockResolvedValue({
          query: mockQuery2,
          release: vi.fn(),
        }),
      };

      const service2 = new EncargaturaService(mockPool2, KID_ACTIVO, SECRET_ACTIVO);
      await expect(
        service2.adquirirAutorizacionSuplencia({
          encargaturaId: ENCARGATURA_ID,
          codigoPermiso: 'FIRMA_FIRMAR',
          usuarioId: USUARIO_ID,
          institucionId: INSTITUCION_ID,
          correlationId: CORRELATION_ID,
        }),
      ).rejects.toThrowError(/deadlock detected continuously/);
    });
  });
});

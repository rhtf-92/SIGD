import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generarPlantillaNotificacionEmail,
  resolverEnlaceAccionRadicacion,
  obtenerFrontendUrl,
} from '../../../src/audit/despachador-notificaciones.js';
import {
  cifrarSecreto,
  descifrarSecreto,
  obtenerClaveCifradoOutbox,
} from '../../../src/shared/crypto/cifradoOutbox.js';
import { TokenSeguimientoService } from '../../../src/domains/tramicore/tokenSeguimiento.service.js';

describe('Subsanación y Validación Integral del Enlace Público Pre-Migración DDL 31', () => {
  const envOriginal = { ...process.env };
  const CUT_PRUEBA = 'EXP-2026-000215';
  const TOKEN_HEX_64 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FRONTEND_URL = 'http://localhost:5178';
    process.env.AUTH_JWT_SECRET = 'clave_secreta_institucional_jwt_demo_2026_test';
    delete process.env.OUTBOX_SECRETS_ENCRYPTION_KEY;
  });

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  describe('Auditoría y Corrección del Flujo de Notificaciones (Fallo Seguro)', () => {
    it('1. Ciudadano público con token válido: recibe el enlace seguro descifrado con fragmento #token=...', () => {
      const frontendUrl = obtenerFrontendUrl();
      const urlOriginal = `${frontendUrl}/tramites/consulta-publica/${CUT_PRUEBA}#token=${TOKEN_HEX_64}`;
      const enlaceCifrado = cifrarSecreto(urlOriginal);

      const payload = {
        cut: CUT_PRUEBA,
        tipo_acto: 'RADICACION_PUBLICO',
        correoDeclarado: 'ciudadano.prueba@correo.pe',
        nombreDeclarado: 'Pedro Administrado',
        cuerpo: {
          totalFolios: 3,
          fechaRadicacionLegal: '2026-11-23T10:00:00.000Z',
          enlaceSeguroCifrado: enlaceCifrado,
        },
      };

      const plantilla = generarPlantillaNotificacionEmail(
        'radicacion_exitosa',
        payload,
        'Pedro Administrado',
        CUT_PRUEBA
      );

      expect(plantilla.subject).toContain(CUT_PRUEBA);
      expect(plantilla.html).toContain(urlOriginal);
      expect(plantilla.html).toContain('href="' + urlOriginal + '"');
      expect(plantilla.html).not.toContain('/tramites/mis-expedientes');
      expect(plantilla.html).not.toContain('/login');
    });

    it('2. El enlace seguro se descifra en memoria y preserva íntegramente los 64 hex del token', () => {
      const frontendUrl = obtenerFrontendUrl();
      const urlCompleta = `${frontendUrl}/tramites/consulta-publica/${CUT_PRUEBA}#token=${TOKEN_HEX_64}`;
      const payloadCifrado = cifrarSecreto(urlCompleta);

      const cuerpo = { enlaceSeguroCifrado: payloadCifrado };
      const accion = resolverEnlaceAccionRadicacion({}, cuerpo, CUT_PRUEBA);

      expect(accion.texto).toBe('Consultar Estado del Trámite');
      expect(accion.url).toBe(urlCompleta);
      expect(accion.url.includes('#token=' + TOKEN_HEX_64)).toBe(true);
    });

    it('3. El enlace lleva a consulta pública con token y NUNCA a login ni a mis-expedientes', () => {
      const frontendUrl = obtenerFrontendUrl();
      const urlCompleta = `${frontendUrl}/tramites/consulta-publica/${CUT_PRUEBA}#token=${TOKEN_HEX_64}`;
      const payloadCifrado = cifrarSecreto(urlCompleta);

      const accion = resolverEnlaceAccionRadicacion(
        { tipo_acto: 'RADICACION_PUBLICO' },
        { enlaceSeguroCifrado: payloadCifrado },
        CUT_PRUEBA
      );

      expect(accion.url).toContain('/tramites/consulta-publica/');
      expect(accion.url).toContain('#token=');
      expect(accion.url).not.toContain('/login');
      expect(accion.url).not.toContain('/mis-expedientes');
      expect(accion.url).not.toContain('/casilla');
    });

    it('4. Usuario registrado conserva su flujo institucional autenticado hacia /mis-expedientes', () => {
      const payloadAutenticado = {
        usuario_id: '11111111-2222-3333-4444-555555555555',
        cut: CUT_PRUEBA,
        tipo_acto: 'RADICACION_VIRTUAL',
        cuerpo: {
          totalFolios: 2,
          fechaRadicacionLegal: '2026-11-23T11:00:00.000Z',
        },
      };

      const plantilla = generarPlantillaNotificacionEmail(
        'radicacion_exitosa',
        payloadAutenticado,
        'Estudiante Institucional',
        CUT_PRUEBA
      );

      const frontendUrl = obtenerFrontendUrl();
      expect(plantilla.html).toContain(`${frontendUrl}/tramites/mis-expedientes`);
    });

    it('5. Ciudadano público sin token: aplica FALLO SEGURO (lanza TOKEN_SEGUIMIENTO_REQUERIDO) y no emite URL desprovista de autenticación', () => {
      const payloadSinEnlace = {
        cut: CUT_PRUEBA,
        tipo_acto: 'RADICACION_PUBLICO',
        correoDeclarado: 'publico.sin.enlace@correo.pe',
        cuerpo: { totalFolios: 1 },
      };

      // Debe fallar de manera cerrada (fail-closed), jamás construir /tramites/consulta-publica/CUT a secas
      expect(() => {
        resolverEnlaceAccionRadicacion(payloadSinEnlace, payloadSinEnlace.cuerpo, CUT_PRUEBA);
      }).toThrowError(/TOKEN_SEGUIMIENTO_REQUERIDO/);
    });

    it('6. Ciudadano público con token cifrado corrupto: lanza FALLO_DESCIFRADO_ENLACE_SEGURO sin sustitución silenciosa', () => {
      const payloadCorrupto = {
        enlaceSeguroCifrado: 'iv_falso:tag_falso:datos_corruptos',
      };

      expect(() => {
        resolverEnlaceAccionRadicacion({}, payloadCorrupto, CUT_PRUEBA);
      }).toThrowError(/FALLO_DESCIFRADO_ENLACE_SEGURO/);
    });

    it('7. Ciudadano público con enlace externo manipulado: rechaza Open Redirect con ENLACE_SEGURO_INVALIDO', () => {
      const urlMaliciosa = `https://sitio-malicioso-externo.com/tramites/consulta-publica/${CUT_PRUEBA}#token=${TOKEN_HEX_64}`;
      const cifradoMalicioso = cifrarSecreto(urlMaliciosa);

      expect(() => {
        resolverEnlaceAccionRadicacion({}, { enlaceSeguroCifrado: cifradoMalicioso }, CUT_PRUEBA);
      }).toThrowError(/ENLACE_SEGURO_INVALIDO/);
    });

    it('8. Expediente presencial histórico sin token: no inventa credenciales y rechaza notificación pública sin token', () => {
      // Expediente histórico ingresado por ventanilla presencial sin cuenta ni token
      const payloadHistoricoPresencial = {
        cut: 'EXP-2026-000203',
        tipo_acto: 'RADICACION_PRESENCIAL',
        correoDeclarado: 'solicitante.presencial@correo.pe',
        cuerpo: { totalFolios: 5 },
      };

      expect(() => {
        resolverEnlaceAccionRadicacion(
          payloadHistoricoPresencial,
          payloadHistoricoPresencial.cuerpo,
          'EXP-2026-000203'
        );
      }).toThrowError(/TOKEN_SEGUIMIENTO_REQUERIDO/);
    });

    it('9. Ausencia total de filtración de tokens en registros o logs ante errores de descifrado o validación', () => {
      const spyConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        resolverEnlaceAccionRadicacion(
          {},
          { enlaceSeguroCifrado: 'invalido:no:hex' },
          CUT_PRUEBA
        );
      } catch {
        // Excepción esperada
      }

      expect(spyConsoleError).toHaveBeenCalled();
      const argumentosLog = spyConsoleError.mock.calls.flat().join(' ');
      // El log jamás debe contener fragmentos de claves, tokens o texto cifrado
      expect(argumentosLog).not.toContain(TOKEN_HEX_64);
      expect(argumentosLog).not.toContain('invalido:no:hex');
      expect(argumentosLog).toContain(CUT_PRUEBA);

      spyConsoleError.mockRestore();
    });

    it('10. Falla de forma cerrada (fail-closed) si la clave de cifrado no está configurada', () => {
      delete process.env.AUTH_JWT_SECRET;
      delete process.env.OUTBOX_SECRETS_ENCRYPTION_KEY;

      expect(() => {
        obtenerClaveCifradoOutbox();
      }).toThrowError(/OUTBOX_SECRETS_ENCRYPTION_KEY_MISSING/);
    });
  });

  describe('Contrato de Consulta Pública Multidispositivo (Backend / Controller)', () => {
    it('11. Intento de acceso público con solo el CUT (sin token, sin sesión, sin JWT) es denegado por contrato', async () => {
      // Verificamos que el validador rechaza tokens inexistentes o con formato inválido
      const service = new TokenSeguimientoService({} as never);
      const res = await service.validarToken({} as never, CUT_PRUEBA, '');
      expect(res.valido).toBe(false);
      expect(res.motivo).toBe('FORMATO_INVALIDO');
    });

    it('12. Token válido permite acceso multidispositivo independiente de cookies o sesiones previas', async () => {
      const tokenValido = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
      const hashEsperado = 'sha256_del_token';

      // Mock de cliente de BD simulando la tabla tras migración
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('to_regclass')) {
            return Promise.resolve({ rows: [{ existe: 'sigd_tra.token_seguimiento_publico' }] });
          }
          if (sql.includes('SELECT t.id_token')) {
            const crypto = require('node:crypto');
            const realHash = crypto.createHash('sha256').update(tokenValido).digest('hex');
            return Promise.resolve({
              rows: [
                {
                  id_token: 'uuid-token-1',
                  expediente_id: 'uuid-expediente-1',
                  token_hash: realHash,
                  expira_en: new Date(Date.now() + 86400000),
                  revocado: false,
                  motivo_revocacion: null,
                },
              ],
            });
          }
          if (sql.includes('UPDATE sigd_tra.token_seguimiento_publico')) {
            return Promise.resolve({ rowCount: 1 });
          }
          return Promise.resolve({ rows: [] });
        }),
      };

      const service = new TokenSeguimientoService({} as never);
      const resultado = await service.validarToken(mockClient as never, CUT_PRUEBA, tokenValido);

      expect(resultado.valido).toBe(true);
      expect(resultado.expedienteId).toBe('uuid-expediente-1');
      expect(resultado.idToken).toBe('uuid-token-1');
    });
  });

  describe('Brecha 2: Verificación Rigurosa de Reversión SQL', () => {
    const rutaScript = resolve(__dirname, '../../../migraciones_reversion/reversion_31_sigd_tra_token_seguimiento_publico.sql');
    let contenidoSql: string;

    beforeEach(() => {
      contenidoSql = readFileSync(rutaScript, 'utf8');
    });

    it('13. Contiene verificación de existencia previa de la tabla con to_regclass', () => {
      expect(contenidoSql).toContain("to_regclass('sigd_tra.token_seguimiento_publico')");
      expect(contenidoSql).toMatch(/IF\s+to_regclass\('sigd_tra\.token_seguimiento_publico'\)\s+IS\s+NULL\s+THEN/i);
    });

    it('14. Implementa bloqueo exclusivo ACCESS EXCLUSIVE MODE para protección contra concurrencia', () => {
      expect(contenidoSql).toMatch(/LOCK\s+TABLE\s+sigd_tra\.token_seguimiento_publico\s+IN\s+ACCESS\s+EXCLUSIVE\s+MODE/i);
    });

    it('15. Cuenta todos los registros sin discriminación y lanza excepción ante tokens existentes', () => {
      expect(contenidoSql).toMatch(/SELECT\s+count\(\*\)\s+INTO\s+v_total\s+FROM\s+sigd_tra\.token_seguimiento_publico/i);
      expect(contenidoSql).toMatch(/IF\s+v_total\s*>\s*0\s+THEN\s+RAISE\s+EXCEPTION/i);
    });

    it('16. No contiene cláusulas WHERE revocado=false en el conteo (protege también tokens revocados)', () => {
      const lineasConteo = contenidoSql
        .split('\n')
        .filter((l) => l.includes('v_total FROM sigd_tra.token_seguimiento_publico'));
      expect(lineasConteo).toHaveLength(1);
      expect(lineasConteo[0]).not.toContain('WHERE');
    });

    it('17. Protege igualmente tokens expirados (ninguna cláusula excluye por expira_en)', () => {
      expect(contenidoSql).not.toContain('WHERE expira_en >');
    });

    it('18. Solo ejecuta DROP TABLE e índices tras la salvaguarda de excepción', () => {
      const posicionExcepcion = contenidoSql.indexOf('RAISE EXCEPTION');
      const posicionDropTable = contenidoSql.indexOf('DROP TABLE IF EXISTS sigd_tra.token_seguimiento_publico');

      expect(posicionExcepcion).toBeGreaterThan(0);
      expect(posicionDropTable).toBeGreaterThan(posicionExcepcion);
    });

    it('19. Mantiene coherencia transaccional con BEGIN y COMMIT', () => {
      expect(contenidoSql).toMatch(/^BEGIN;\s*$/m);
      expect(contenidoSql).toMatch(/^COMMIT;\s*$/m);
    });
  });

  describe('Brecha 3: Clave Independiente de Cifrado (OUTBOX_SECRETS_ENCRYPTION_KEY)', () => {
    it('20. Utiliza la clave independiente OUTBOX_SECRETS_ENCRYPTION_KEY si está configurada', () => {
      const claveDedicadaHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.OUTBOX_SECRETS_ENCRYPTION_KEY = claveDedicadaHex;

      const clave = obtenerClaveCifradoOutbox();
      expect(clave).toEqual(Buffer.from(claveDedicadaHex, 'hex'));
      expect(clave.length).toBe(32);
    });

    it('21. El cifrado y descifrado con la clave independiente son simétricos y válidos', () => {
      process.env.OUTBOX_SECRETS_ENCRYPTION_KEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      const secretoOriginal = 'https://portal.iestpsuiza.edu.pe/tramites/consulta-publica/EXP-2026-000215#token=1234';

      const cifrado = cifrarSecreto(secretoOriginal);
      const descifrado = descifrarSecreto(cifrado);

      expect(descifrado).toBe(secretoOriginal);
    });
  });
});

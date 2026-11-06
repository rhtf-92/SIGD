import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  radicacionVirtualSchema,
  ventanillaPresencialSchema,
  consultaPublicaParamsSchema,
  adjuntoRadicacionSchema,
} from '../../../../src/domains/tramicore/tramites.schemas.js';
import { RadicacionVirtualService } from '../../../../src/domains/tramicore/radicacionVirtual.service.js';
import { VentanillaPresencialService } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';

describe('Adversarial Challenge — Milestone 1: TramiCore & DDL Seeding', () => {
  const dummyHash1 = 'a'.repeat(64);
  const dummyHash2 = 'b'.repeat(64);

  const payloadValidoBase = {
    asunto: 'Solicitud formal para expedición de certificado oficial',
    idTipoTramiteTupa: 'TUPA-01',
    idPersona: '00000000-0000-0000-0002-000000000001',
    nombreSolicitante: 'Juan Carlos Pérez Gómez',
    correo: 'estudiante@iestpsuiza.edu.pe',
    totalFolios: 3,
    documentos: [
      {
        nombreArchivo: 'solicitud_fut.pdf',
        contentType: 'application/pdf' as const,
        tamanoBytes: 1024 * 50,
        hashSha256: dummyHash1,
      },
    ],
  };

  describe('1. Zod Schema: radicacionVirtualSchema', () => {
    it.each([
      'TUPA-01',
      'TUPA-05',
      'TUPA-09',
      'TUPA-22',
      'TUPA-48',
      'LIBRE-01',
      '01',
      '48',
      '00000000-0000-0000-0001-000000000001',
      '00000000-0000-0000-0001-000000000048',
      '00000000-0000-0000-0001-000000000099',
      'e1b4c810-7b24-4f51-b847-9759e66ff7c5',
    ])('admite trámite TUPA válido: %s', (idTipoTramite) => {
      const parsed = radicacionVirtualSchema.safeParse({
        ...payloadValidoBase,
        idTipoTramiteTupa: idTipoTramite,
      });
      expect(parsed.success).toBe(true);
    });

    it('rechaza el nil UUID como tipo de trámite', () => {
      const parsed = radicacionVirtualSchema.safeParse({
        ...payloadValidoBase,
        idTipoTramiteTupa: '00000000-0000-0000-0000-000000000000',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('UUID nulo');
      }
    });

    it('rechaza identificador de trámite vacío o de solo espacios', () => {
      const parsed1 = radicacionVirtualSchema.safeParse({
        ...payloadValidoBase,
        idTipoTramiteTupa: '',
      });
      expect(parsed1.success).toBe(false);

      const parsed2 = radicacionVirtualSchema.safeParse({
        ...payloadValidoBase,
        idTipoTramiteTupa: '   ',
      });
      expect(parsed2.success).toBe(false);
    });

    it('rechaza identificador de trámite que supera 64 caracteres', () => {
      const parsed = radicacionVirtualSchema.safeParse({
        ...payloadValidoBase,
        idTipoTramiteTupa: 'T'.repeat(65),
      });
      expect(parsed.success).toBe(false);
    });

    it.each([
      ['UUID estándar', '00000000-0000-0000-0002-000000000001', true],
      ['Entero positivo como número', 15, true],
      ['Entero positivo como string numérico', '1005', true],
      ['DNI de 8 dígitos', '72345678', true],
      ['RUC de 11 dígitos', '20485963211', true],
      ['Entero negativo', -5, false],
      ['Cero numérico', 0, false],
      ['String vacío', '', false],
    ])('valida idPersona: %s (%s) => %s', (_desc, idPersona, expectedSuccess) => {
      const parsed = radicacionVirtualSchema.safeParse({
        ...payloadValidoBase,
        idPersona,
      });
      expect(parsed.success).toBe(expectedSuccess);
    });

    it('rechaza asunto menor a 10 caracteres o compuesto solo de espacios', () => {
      expect(radicacionVirtualSchema.safeParse({ ...payloadValidoBase, asunto: '123456789' }).success).toBe(false);
      expect(radicacionVirtualSchema.safeParse({ ...payloadValidoBase, asunto: '          ' }).success).toBe(false);
      expect(radicacionVirtualSchema.safeParse({ ...payloadValidoBase, asunto: '1234567890' }).success).toBe(true);
    });

    it('rechaza asunto mayor a 500 caracteres', () => {
      expect(radicacionVirtualSchema.safeParse({ ...payloadValidoBase, asunto: 'A'.repeat(501) }).success).toBe(false);
      expect(radicacionVirtualSchema.safeParse({ ...payloadValidoBase, asunto: 'A'.repeat(500) }).success).toBe(true);
    });

    it('rechaza documentos con nombres duplicados (case-insensitive)', () => {
      const parsed = radicacionVirtualSchema.safeParse({
        ...payloadValidoBase,
        documentos: [
          {
            nombreArchivo: 'informe.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256: dummyHash1,
          },
          {
            nombreArchivo: 'INFORME.PDF',
            contentType: 'application/pdf',
            tamanoBytes: 2048,
            hashSha256: dummyHash2,
          },
        ],
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.message.includes('nombres duplicados'))).toBe(true);
      }
    });

    it('rechaza documentos con hash SHA-256 duplicado', () => {
      const parsed = radicacionVirtualSchema.safeParse({
        ...payloadValidoBase,
        documentos: [
          {
            nombreArchivo: 'informe1.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256: dummyHash1,
          },
          {
            nombreArchivo: 'informe2.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256: dummyHash1.toUpperCase(),
          },
        ],
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.message.includes('mismo hash SHA-256'))).toBe(true);
      }
    });

    it('rechaza path traversal en nombreArchivo', () => {
      const ataques = [
        '../solicitud.pdf',
        '..\\solicitud.pdf',
        'sub/solicitud.pdf',
        'sub\\solicitud.pdf',
        'sin_extension',
      ];
      for (const ataque of ataques) {
        const parsed = adjuntoRadicacionSchema.safeParse({
          nombreArchivo: ataque,
          contentType: 'application/pdf',
          tamanoBytes: 1024,
          hashSha256: dummyHash1,
        });
        expect(parsed.success).toBe(false);
      }
    });
  });

  describe('2. Zod Schema: ventanillaPresencialSchema', () => {
    it('admite radicación presencial sin identificadores TUPA (trámite ordinario)', () => {
      const parsed = ventanillaPresencialSchema.safeParse({
        dniSolicitante: '45678912',
        datosRemitente: 'Carlos Benavides Ríos',
        asunto: 'Presentación de memorial vecinal',
        foliosTotales: 4,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.idTipoTramiteTupa).toBeUndefined();
        expect(parsed.data.codigoTupa).toBeUndefined();
      }
    });

    it('admite radicación presencial con idTipoTramiteTupa UUID', () => {
      const parsed = ventanillaPresencialSchema.safeParse({
        dniSolicitante: '45678912',
        datosRemitente: 'Carlos Benavides Ríos',
        asunto: 'Trámite de titulación profesional',
        foliosTotales: 15,
        idTipoTramiteTupa: '00000000-0000-0000-0001-000000000009',
      });
      expect(parsed.success).toBe(true);
    });

    it('admite radicación presencial con codigoTupa alfanumérico', () => {
      const parsed = ventanillaPresencialSchema.safeParse({
        dniSolicitante: '45678912',
        datosRemitente: 'Carlos Benavides Ríos',
        asunto: 'Examen extraordinario de subsanación',
        foliosTotales: 2,
        codigoTupa: 'TUPA-13',
      });
      expect(parsed.success).toBe(true);
    });

    it('rechaza DNI que no tenga exactamente 8 dígitos numéricos', () => {
      const invalidos = ['1234567', '123456789', '1234567a', 'abcdefgh'];
      for (const dni of invalidos) {
        const parsed = ventanillaPresencialSchema.safeParse({
          dniSolicitante: dni,
          datosRemitente: 'Carlos Benavides Ríos',
          asunto: 'Trámite con DNI erróneo',
          foliosTotales: 1,
        });
        expect(parsed.success).toBe(false);
      }
    });

    it('rechaza folios menores o iguales a cero', () => {
      const parsedZero = ventanillaPresencialSchema.safeParse({
        dniSolicitante: '12345678',
        datosRemitente: 'Carlos Benavides Ríos',
        asunto: 'Trámite sin folios',
        foliosTotales: 0,
      });
      expect(parsedZero.success).toBe(false);

      const parsedNeg = ventanillaPresencialSchema.safeParse({
        dniSolicitante: '12345678',
        datosRemitente: 'Carlos Benavides Ríos',
        asunto: 'Trámite con folios negativos',
        foliosTotales: -2,
      });
      expect(parsedNeg.success).toBe(false);
    });
  });

  describe('3. DDL Seeding: 04_sigd_doc.sql Integridad Forense', () => {
    const ddlPath = path.resolve(__dirname, '../../../../migraciones/04_sigd_doc.sql');
    const sqlContent = fs.readFileSync(ddlPath, 'utf-8');

    it('el archivo de migración contiene exactamente 48 procedimientos TUPA y LIBRE-01', () => {
      const tupaMatches = [...sqlContent.matchAll(/'(00000000-0000-0000-0001-[0-9a-f]{12})',\s*'(TUPA-\d{2}|LIBRE-01)'/g)];
      expect(tupaMatches.length).toBe(49); // 48 TUPA + 1 LIBRE-01
    });

    it('todos los UUIDs de tipo_tramite_tupa son deterministas y únicos', () => {
      const uuidMatches = [...sqlContent.matchAll(/'(00000000-0000-0000-0001-[0-9a-f]{12})'/g)].map((m) => m[1]);
      const uniqueUuidsInTupa = new Set(uuidMatches);
      expect(uniqueUuidsInTupa.size).toBe(49);
    });

    it('todos los códigos TUPA (TUPA-01 a TUPA-48) y LIBRE-01 son únicos', () => {
      const codigos = [...sqlContent.matchAll(/'(TUPA-[0-9]{2}|LIBRE-01)'/g)].map((m) => m[1]);
      const uniqueCodigos = new Set(codigos);
      expect(uniqueCodigos.size).toBe(49);
      for (let i = 1; i <= 48; i++) {
        const codigo = `TUPA-${String(i).padStart(2, '0')}`;
        expect(uniqueCodigos.has(codigo)).toBe(true);
      }
      expect(uniqueCodigos.has('LIBRE-01')).toBe(true);
    });

    it('todos los requisitos de sigd_doc.requisito referencian un tipo_tramite_id existente', () => {
      const tupaUuids = new Set(
        [...sqlContent.matchAll(/'(00000000-0000-0000-0001-[0-9a-f]{12})',\s*'(TUPA-\d{2}|LIBRE-01)'/g)].map(
          (m) => m[1],
        ),
      );

      const requisitoRefMatches = [
        ...sqlContent.matchAll(
          /\('([0-9a-f-]{36})',\s*'(REQ-[0-9]{2}-[0-9]{2})'/g,
        ),
      ];

      expect(requisitoRefMatches.length).toBeGreaterThan(50);
      for (const match of requisitoRefMatches) {
        const refId = match[1];
        const reqCodigo = match[2];
        expect(tupaUuids.has(refId), `Requisito ${reqCodigo} referencia UUID desconocido: ${refId}`).toBe(true);
      }
    });

    it('contiene las 5 semillas canónicas de sigd_doc.tipo_documento', () => {
      const tiposDocs = ['SOLICITUD', 'OFICIO', 'MEMORANDO', 'INFORME', 'RESOLUCION'];
      for (const td of tiposDocs) {
        expect(sqlContent).toContain(`'${td}'`);
      }
    });
  });

  describe('4. Servicios SQL: RadicacionVirtualService y VentanillaPresencialService', () => {
    it('verificarTipoTramite resuelve por UUID v4 canónico', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [
          {
            tipo_tramite_id: '00000000-0000-0000-0001-000000000001',
            codigo: 'TUPA-01',
            denominacion: 'Certificado de estudios',
            unidad_organica: 'Secretaría Académica',
            plazo_dias: 5,
            silencio_administrativo: 'POSITIVO',
            vigente: true,
          },
        ],
      });
      const mockClient = { query: mockQuery } as any;

      const service = new RadicacionVirtualService({ connect: vi.fn() } as any, async () => []);
      const resultado = await (service as any).verificarTipoTramite(
        mockClient,
        '00000000-0000-0000-0001-000000000001',
      );

      expect(resultado.codigo).toBe('TUPA-01');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tipo_tramite_id = $1::uuid'),
        ['00000000-0000-0000-0001-000000000001'],
      );
    });

    it('verificarTipoTramite resuelve por código institucional (TUPA-05 o 05)', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [
          {
            tipo_tramite_id: '00000000-0000-0000-0001-000000000005',
            codigo: 'TUPA-05',
            denominacion: 'Aprobación de borrador de informe de práctica profesional',
            unidad_organica: 'Área Académica',
            plazo_dias: 7,
            silencio_administrativo: 'POSITIVO',
            vigente: true,
          },
        ],
      });
      const mockClient = { query: mockQuery } as any;

      const service = new RadicacionVirtualService({ connect: vi.fn() } as any, async () => []);
      const resultado = await (service as any).verificarTipoTramite(mockClient, 'TUPA-05');

      expect(resultado.codigo).toBe('TUPA-05');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE codigo = $1"),
        ['TUPA-05'],
      );
    });

    it('verificarTipoTramite lanza ValidationError si el trámite no existe', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const mockClient = { query: mockQuery } as any;

      const service = new RadicacionVirtualService({ connect: vi.fn() } as any, async () => []);
      try {
        await (service as any).verificarTipoTramite(mockClient, 'TUPA-INEXISTENTE');
        expect.unreachable('Debería haber lanzado ValidationError');
      } catch (err: any) {
        expect(err.name).toBe('ValidationError');
        expect(err.invalidParams[0].reason).toContain('TIPO_TRAMITE_DESCONOCIDO');
      }
    });

    it('verificarTipoTramite lanza ValidationError si el trámite está inactivo (vigente = false)', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [
          {
            tipo_tramite_id: '00000000-0000-0000-0001-000000000001',
            codigo: 'TUPA-01',
            denominacion: 'Certificado de estudios',
            unidad_organica: 'Secretaría Académica',
            plazo_dias: 5,
            silencio_administrativo: 'POSITIVO',
            vigente: false,
          },
        ],
      });
      const mockClient = { query: mockQuery } as any;

      const service = new RadicacionVirtualService({ connect: vi.fn() } as any, async () => []);
      try {
        await (service as any).verificarTipoTramite(mockClient, 'TUPA-01');
        expect.unreachable('Debería haber lanzado ValidationError');
      } catch (err: any) {
        expect(err.name).toBe('ValidationError');
        expect(err.invalidParams[0].reason).toContain('TIPO_TRAMITE_INACTIVO');
      }
    });

    it('verificarAdministrado resuelve tanto UUID como DNI numérico', async () => {
      const mockClientUuid = {
        query: vi.fn().mockResolvedValue({
          rows: [{ id_persona: 'e1b4c810-7b24-4f51-b847-9759e66ff7c5' }],
        }),
      } as any;

      const service = new RadicacionVirtualService({ connect: vi.fn() } as any, async () => []);
      const resUuid = await (service as any).verificarAdministrado(
        mockClientUuid,
        'e1b4c810-7b24-4f51-b847-9759e66ff7c5',
      );
      expect(resUuid).toBe('e1b4c810-7b24-4f51-b847-9759e66ff7c5');

      const mockClientDni = {
        query: vi.fn().mockResolvedValue({
          rows: [{ id_persona: 'e1b4c810-7b24-4f51-b847-9759e66ff7c5' }],
        }),
      } as any;
      const resDni = await (service as any).verificarAdministrado(mockClientDni, '72345678');
      expect(resDni).toBe('e1b4c810-7b24-4f51-b847-9759e66ff7c5');
    });

    it('VentanillaPresencialService registra y vincula TUPA opcional en sigd_doc.expediente', async () => {
      const querySpy = vi.fn().mockImplementation((sql: string, _params: any[]) => {
        if (sql.includes('generar_cut_expediente')) {
          return Promise.resolve({ rows: [{ cut: 'EXP-2026-000123' }] });
        }
        if (sql.includes('sigd_auth.persona')) {
          return Promise.resolve({ rows: [{ id_persona: '00000000-0000-0000-0002-000000000001' }] });
        }
        if (sql.includes('INSERT INTO sigd_tra.expediente')) {
          return Promise.resolve({ rows: [{ expediente_id: 'exp-uuid-1234' }] });
        }
        if (sql.includes('sigd_doc.tipo_tramite_tupa')) {
          return Promise.resolve({ rows: [{ tipo_tramite_id: '00000000-0000-0000-0001-000000000005' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const mockClient = {
        query: querySpy,
      } as any;

      const service = new VentanillaPresencialService({} as any);
      const resultado = await service.registrarExpedienteVentanilla(
        {
          dniSolicitante: '72345678',
          datosRemitente: 'María Fernández',
          asunto: 'Presentación de informe de prácticas',
          foliosTotales: 8,
          codigoTupa: 'TUPA-05',
        },
        mockClient,
      );

      expect(resultado.cut).toBe('EXP-2026-000123');
      expect(resultado.expedienteId).toBe('exp-uuid-1234');
      expect(resultado.ticketImpresion).toContain('EXP-2026-000123');

      // Verificar que se haya emitido el insert condicional a sigd_doc.expediente
      const insertDocExp = querySpy.mock.calls.find((call) =>
        typeof call[0] === 'string' && call[0].includes('INSERT INTO sigd_doc.expediente'),
      );
      expect(insertDocExp).toBeDefined();
    });

    it('RadicacionVirtualService.radicar ejecuta ciclo transaccional completo (BEGIN -> INSERTs -> COMMIT)', async () => {
      const queriesEjecutadas: string[] = [];
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          queriesEjecutadas.push(sql);
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('sigd_doc.tipo_tramite_tupa')) {
            return Promise.resolve({
              rows: [
                {
                  tipo_tramite_id: '00000000-0000-0000-0001-000000000001',
                  codigo: 'TUPA-01',
                  denominacion: 'Certificado de estudios',
                  unidad_organica: 'Secretaría Académica',
                  plazo_dias: 5,
                  silencio_administrativo: 'POSITIVO',
                  vigente: true,
                },
              ],
            });
          }
          if (sql.includes('sigd_auth.persona')) {
            return Promise.resolve({
              rows: [{ id_persona: '00000000-0000-0000-0002-000000000001' }],
            });
          }
          if (sql.includes('INSERT INTO sigd_doc.expediente')) {
            return Promise.resolve({
              rows: [{ expediente_id: 'doc-exp-uuid-1234' }],
            });
          }
          if (sql.includes('INSERT INTO sigd_tra.expediente')) {
            return Promise.resolve({
              rows: [{ expediente_id: 'doc-exp-uuid-1234' }],
            });
          }
          if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('INSERT INTO sigd_tra.asiento_registro')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('secuencia_anual_cut') || sql.includes('generar_cut')) {
            return Promise.resolve({ rows: [{ cut: 'EXP-2026-000042' }] });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as any;

      const service = new RadicacionVirtualService(mockPool, async () => []);
      // Mock cutService.generar
      (service as any).cutService = {
        generar: vi.fn().mockResolvedValue({ cut: 'EXP-2026-000042', anio: 2026 }),
      };

      const resultado = await service.radicar(payloadValidoBase);

      expect(resultado.cut).toBe('EXP-2026-000042');
      expect(resultado.expedienteId).toBe('doc-exp-uuid-1234');
      expect(resultado.totalFolios).toBe(3);
      expect(resultado.cargoDigital.codigo).toMatch(/^CARGO-[A-F0-9]{8}$/);
      expect(resultado.cargoDigital.hashSha256).toHaveLength(64);

      expect(queriesEjecutadas).toContain('BEGIN');
      expect(queriesEjecutadas).toContain('COMMIT');
      expect(queriesEjecutadas).not.toContain('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('RadicacionVirtualService.radicar ejecuta ROLLBACK y libera cliente si ocurre un fallo en la transacción', async () => {
      const queriesEjecutadas: string[] = [];
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          queriesEjecutadas.push(sql);
          if (sql === 'BEGIN' || sql === 'ROLLBACK') {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('sigd_doc.tipo_tramite_tupa')) {
            return Promise.resolve({
              rows: [
                {
                  tipo_tramite_id: '00000000-0000-0000-0001-000000000001',
                  codigo: 'TUPA-01',
                  denominacion: 'Certificado de estudios',
                  unidad_organica: 'Secretaría Académica',
                  plazo_dias: 5,
                  silencio_administrativo: 'POSITIVO',
                  vigente: true,
                },
              ],
            });
          }
          if (sql.includes('sigd_auth.persona')) {
            return Promise.reject(new Error('Simulated DB Failure on Persona Check'));
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as any;

      const service = new RadicacionVirtualService(mockPool, async () => []);
      await expect(service.radicar(payloadValidoBase)).rejects.toThrow('Simulated DB Failure');

      expect(queriesEjecutadas).toContain('BEGIN');
      expect(queriesEjecutadas).toContain('ROLLBACK');
      expect(queriesEjecutadas).not.toContain('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('5. Exhaustive TUPA Matrix: Cobertura Integral de los 48 Trámites + LIBRE-01', () => {
    const ddlPath = path.resolve(__dirname, '../../../../migraciones/04_sigd_doc.sql');
    const sqlContent = fs.readFileSync(ddlPath, 'utf-8');

    it('cada uno de los 48 trámites TUPA y LIBRE-01 supera la validación de radicacionVirtualSchema por código', () => {
      for (let i = 1; i <= 48; i++) {
        const codigo = `TUPA-${String(i).padStart(2, '0')}`;
        const parsed = radicacionVirtualSchema.safeParse({
          ...payloadValidoBase,
          idTipoTramiteTupa: codigo,
        });
        expect(parsed.success, `Fallo en código ${codigo}`).toBe(true);
      }

      const parsedLibre = radicacionVirtualSchema.safeParse({
        ...payloadValidoBase,
        idTipoTramiteTupa: 'LIBRE-01',
      });
      expect(parsedLibre.success).toBe(true);
    });

    it('cada uno de los 48 trámites TUPA y LIBRE-01 supera la validación por UUID determinista', () => {
      for (let i = 1; i <= 48; i++) {
        const uuid = `00000000-0000-0000-0001-${String(i).padStart(12, '0')}`;
        const parsed = radicacionVirtualSchema.safeParse({
          ...payloadValidoBase,
          idTipoTramiteTupa: uuid,
        });
        expect(parsed.success, `Fallo en UUID ${uuid}`).toBe(true);
      }

      const uuidLibre = '00000000-0000-0000-0001-000000000099';
      const parsedLibre = radicacionVirtualSchema.safeParse({
        ...payloadValidoBase,
        idTipoTramiteTupa: uuidLibre,
      });
      expect(parsedLibre.success).toBe(true);
    });

    it('cada fila de tipo_tramite_tupa en el DDL cumple las restricciones CHECK chk_tupa_silencio y chk_tupa_plazo', () => {
      // Extraer todas las tuplas de tipo_tramite_tupa insertadas
      const regexFila = /\('([0-9a-f-]{36})',\s*'([^']+)',\s*'([^']+)',\s*'([^']*)',\s*'([^']+)',\s*(\d+),\s*'([^']+)',\s*'([^']*)',\s*(TRUE|FALSE)\)/gi;
      const filas = [...sqlContent.matchAll(regexFila)];

      expect(filas.length).toBe(49);

      for (const fila of filas) {
        const [, uuid, codigo, denominacion, , unidad, plazoStr, silencio, , vigenteStr] = fila;
        const plazo = parseInt(plazoStr, 10);

        // CHECK (plazo_dias > 0)
        expect(plazo, `Código ${codigo} tiene plazo inválido: ${plazo}`).toBeGreaterThan(0);

        // CHECK (silencio_administrativo IN ('POSITIVO', 'NEGATIVO'))
        expect(['POSITIVO', 'NEGATIVO'], `Código ${codigo} tiene silencio inválido: ${silencio}`).toContain(silencio);

        // NOT NULLs y tipos
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(codigo.length).toBeGreaterThan(0);
        expect(denominacion.length).toBeGreaterThan(0);
        expect(unidad.length).toBeGreaterThan(0);
        expect(['TRUE', 'FALSE']).toContain(vigenteStr.toUpperCase());
      }
    });

    it('cada requisito en el DDL tiene orden no negativo y código bien formado', () => {
      const regexReq = /\('([0-9a-f-]{36})',\s*'([^']+)',\s*'([^']+)',\s*(TRUE|FALSE),\s*(\d+)\)/gi;
      const reqs = [...sqlContent.matchAll(regexReq)];

      expect(reqs.length).toBeGreaterThan(50);

      const codigosPorTramite = new Map<string, Set<string>>();

      for (const req of reqs) {
        const [, tramiteId, codigo, denominacion, , ordenStr] = req;
        const orden = parseInt(ordenStr, 10);

        expect(orden).toBeGreaterThanOrEqual(0);
        expect(codigo.length).toBeGreaterThan(0);
        expect(denominacion.length).toBeGreaterThan(0);

        // Verificar unicidad de (tipo_tramite_id, codigo)
        if (!codigosPorTramite.has(tramiteId)) {
          codigosPorTramite.set(tramiteId, new Set());
        }
        const setCodigos = codigosPorTramite.get(tramiteId)!;
        expect(
          setCodigos.has(codigo),
          `Requisito duplicado para el trámite ${tramiteId}: ${codigo}`,
        ).toBe(false);
        setCodigos.add(codigo);
      }
    });
  });

  describe('6. Edge Cases & Boundary Analysis en ventanillaPresencialSchema', () => {
    it('valida límites de longitud de asunto en ventanillaPresencialSchema', () => {
      const base = {
        dniSolicitante: '87654321',
        datosRemitente: 'Pedro Castillo',
        foliosTotales: 1,
      };

      // < 5 caracteres: debe fallar
      expect(ventanillaPresencialSchema.safeParse({ ...base, asunto: '1234' }).success).toBe(false);
      // = 5 caracteres: debe pasar
      expect(ventanillaPresencialSchema.safeParse({ ...base, asunto: '12345' }).success).toBe(true);
      // = 500 caracteres: debe pasar
      expect(ventanillaPresencialSchema.safeParse({ ...base, asunto: 'X'.repeat(500) }).success).toBe(true);
      // > 500 caracteres: debe fallar
      expect(ventanillaPresencialSchema.safeParse({ ...base, asunto: 'X'.repeat(501) }).success).toBe(false);
    });

    it('idTipoTramiteTupa en ventanillaPresencialSchema debe ser un UUID estricto si se proporciona', () => {
      const base = {
        dniSolicitante: '87654321',
        datosRemitente: 'Pedro Castillo',
        asunto: 'Solicitud regular',
        foliosTotales: 1,
      };

      // UUID válido: pasa
      expect(
        ventanillaPresencialSchema.safeParse({
          ...base,
          idTipoTramiteTupa: '00000000-0000-0000-0001-000000000001',
        }).success,
      ).toBe(true);

      // Código de texto en idTipoTramiteTupa: falla porque el campo exige UUID
      expect(
        ventanillaPresencialSchema.safeParse({
          ...base,
          idTipoTramiteTupa: 'TUPA-01',
        }).success,
      ).toBe(false);

      // Código de texto en codigoTupa: pasa porque el campo acepta string
      expect(
        ventanillaPresencialSchema.safeParse({
          ...base,
          codigoTupa: 'TUPA-01',
        }).success,
      ).toBe(true);
    });
  });
});


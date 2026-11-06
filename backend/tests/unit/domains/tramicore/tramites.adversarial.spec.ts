import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { construirApp } from '../../../../src/app.js';
import { RadicacionVirtualService } from '../../../../src/domains/tramicore/radicacionVirtual.service.js';
import { VentanillaPresencialService } from '../../../../src/domains/tramicore/ventanillaPresencial.service.js';
import {
  radicacionVirtualSchema,
  ventanillaPresencialSchema,
} from '../../../../src/domains/tramicore/tramites.schemas.js';

describe('Adversarial Challenger — Milestone 1: TramiCore, Catálogo TUPA, Cargo & SQL DDL', () => {
  // ---------------------------------------------------------------------------
  // 1. ENDPOINTS: GET /api/v1/tramites/tipos y GET /api/v1/tramites/tupa
  // ---------------------------------------------------------------------------
  describe('Endpoints /tramites/tipos y /tramites/tupa', () => {
    it('Ambas rutas ejecutan la consulta canónica y devuelven el catálogo enriquecido', async () => {
      let queryCapturada = '';

      const fakePool = {
        query: vi.fn(async (text: string) => {
          queryCapturada = text;
          return {
            rows: [
              {
                id: '00000000-0000-0000-0001-000000000001',
                id_tipo_tramite: '00000000-0000-0000-0001-000000000001',
                id_tipo_tramite_tupa: '00000000-0000-0000-0001-000000000001',
                codigo: 'TUPA-01',
                denominacion: 'Certificado de estudios',
                nombre: 'Certificado de estudios',
                descripcion: 'Expedición de certificados oficiales',
                unidad_organica: 'Secretaría Académica',
                dependencia: 'Secretaría Académica',
                plazo_dias: 5,
                plazo_dias_habiles: 5,
                silencio_administrativo: 'POSITIVO',
                calificacion: 'POSITIVO',
                base_legal: 'RVM N° 277-2019-MINEDU',
                vigente: true,
                es_tupa: true,
                requisitos: ['Solicitud FUT', 'Constancia de No Adeudar', 'Derecho de trámite'],
              },
              {
                id: '00000000-0000-0000-0001-000000000099',
                id_tipo_tramite: '00000000-0000-0000-0001-000000000099',
                id_tipo_tramite_tupa: '00000000-0000-0000-0001-000000000099',
                codigo: 'LIBRE-01',
                denominacion: 'Solicitud Formal General',
                nombre: 'Solicitud Formal General',
                descripcion: 'Ingreso documentario de solicitudes libres',
                unidad_organica: 'Mesa de Partes General',
                dependencia: 'Mesa de Partes General',
                plazo_dias: 30,
                plazo_dias_habiles: 30,
                silencio_administrativo: 'POSITIVO',
                calificacion: 'POSITIVO',
                base_legal: 'TUO Ley N° 27444',
                vigente: true,
                es_tupa: true,
                requisitos: [],
              },
            ],
          };
        }),
        connect: vi.fn(async () => ({
          query: vi.fn(),
          release: vi.fn(),
        })),
      } as unknown as Pool;

      const app = construirApp(fakePool);

      // Probar GET /api/v1/tramites/tipos
      const resTipos = await request(app).get('/api/v1/tramites/tipos');
      expect(resTipos.status).toBe(200);
      expect(Array.isArray(resTipos.body)).toBe(true);
      expect(resTipos.body).toHaveLength(2);
      expect(resTipos.body[0].codigo).toBe('TUPA-01');
      expect(resTipos.body[0].arancel).toBe('S/. 11.00 por semestre; S/. 2.00');
      expect(resTipos.body[0].derecho_pago).toBe('S/. 11.00 por semestre; S/. 2.00');
      expect(resTipos.body[0].derechoPago).toBe('S/. 11.00 por semestre; S/. 2.00');
      expect(resTipos.body[0].requisitos).toHaveLength(3);
      expect(resTipos.body[1].codigo).toBe('LIBRE-01');
      expect(resTipos.body[1].arancel).toBe('Gratuito');

      // Probar alias GET /api/v1/tramites/tupa
      const resTupa = await request(app).get('/api/v1/tramites/tupa');
      expect(resTupa.status).toBe(200);
      expect(resTupa.body).toHaveLength(2);

      // Probar alias GET /api/v1/tramites/catalogo-tupa
      const resCatalogoTupa = await request(app).get('/api/v1/tramites/catalogo-tupa');
      expect(resCatalogoTupa.status).toBe(200);
      expect(resCatalogoTupa.body).toHaveLength(2);

      // Verificar que la query apunte a las columnas canónicas de sigd_doc.tipo_tramite_tupa y sigd_doc.requisito
      expect(queryCapturada).toContain('FROM sigd_doc.tipo_tramite_tupa');
      expect(queryCapturada).toContain('LEFT JOIN sigd_doc.requisito');
      expect(queryCapturada).toContain('WHERE t.vigente = TRUE');
      expect(queryCapturada).toContain('json_agg(r.denominacion ORDER BY r.orden)');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. ENDPOINT: GET /api/v1/tramites/ventanilla/cargo/:cut
  // ---------------------------------------------------------------------------
  describe('Endpoint /tramites/ventanilla/cargo/:cut', () => {
    it('Devuelve 200 y el ticket térmico formateado para un CUT existente', async () => {
      let queryCapturada = '';
      let cutParam = '';

      const fakePool = {
        query: vi.fn(async (text: string, params?: any[]) => {
          queryCapturada = text;
          cutParam = params?.[0];
          return {
            rows: [
              {
                expediente_id: 'a1b2c3d4-1111-2222-3333-444455556666',
                cut: 'EXP-2026-000001',
                fecha_radicacion: new Date('2026-10-05T10:00:00Z'),
                remitente_documento: '45872315',
                remitente: 'Carlos Benitez Flores',
                asunto: 'Certificado de Estudios Semestre I y II',
                fecha_ingreso: new Date('2026-10-05T10:00:00Z'),
                numero_registro: 10001,
                folios: 4,
              },
            ],
          };
        }),
      } as unknown as Pool;

      const app = construirApp(fakePool);

      // Envío con CUT en minúsculas y espacios para verificar normalización
      const res = await request(app).get('/api/v1/tramites/ventanilla/cargo/ exp-2026-000001 ');

      expect(res.status).toBe(200);
      expect(cutParam).toBe('EXP-2026-000001');
      expect(res.body.cut).toBe('EXP-2026-000001');
      expect(res.body.remitente).toBe('Carlos Benitez Flores');
      expect(res.body.dni).toBe('45872315');
      expect(res.body.asunto).toBe('Certificado de Estudios Semestre I y II');
      expect(res.body.folios).toBe(4);
      expect(res.body.ticketTermicoTexto).toContain('EXP-2026-000001');
      expect(res.body.ticketTermicoTexto).toContain('NRO. FOLIOS: 4');
      expect(res.body.ticketTermicoTexto).toContain('https://sigd.iestp-suiza.edu.pe/consulta/EXP-2026-000001');

      // Validar las tablas y columnas unidas en la consulta SQL
      expect(queryCapturada).toContain('FROM sigd_tra.expediente e');
      expect(queryCapturada).toContain('LEFT JOIN sigd_tra.asiento_registro a ON a.expediente_id = e.expediente_id');
      expect(queryCapturada).toContain('LEFT JOIN sigd_doc.expediente de ON de.codigo_expediente = e.codigo_expediente');
      expect(queryCapturada).toContain('LEFT JOIN sigd_auth.persona p ON p.id_persona = e.solicitante_id');
      expect(queryCapturada).toContain('LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona');
      expect(queryCapturada).toContain('MAX(folio_fin) FROM sigd_tra.expediente_documento_folio');
    });

    it('Devuelve 404 con error estructurado cuando el CUT no existe', async () => {
      const fakePool = {
        query: vi.fn(async () => ({ rows: [] })),
      } as unknown as Pool;

      const app = construirApp(fakePool);
      const res = await request(app).get('/api/v1/tramites/ventanilla/cargo/EXP-2026-999999');

      expect(res.status).toBe(404);
      expect(res.body.detail).toContain('No se encontró cargo físico registrado para el CUT EXP-2026-999999');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. RADICACIÓN VIRTUAL SERVICE & SCHEMAS
  // ---------------------------------------------------------------------------
  describe('RadicacionVirtualService & Schemas', () => {
    it('Schema admite UUIDs, enteros y cadenas DNI para idPersona', () => {
      const basePayload = {
        asunto: 'Solicitud formal de titulación técnica',
        idTipoTramiteTupa: '00000000-0000-0000-0001-000000000001',
        nombreSolicitante: 'Juan Pérez Silva',
        correo: 'juan.perez@iestpsuiza.edu.pe',
        totalFolios: 2,
        documentos: [
          {
            nombreArchivo: 'expediente.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256: 'a'.repeat(64),
          },
        ],
      };

      // UUID
      expect(
        radicacionVirtualSchema.safeParse({
          ...basePayload,
          idPersona: '11111111-2222-3333-4444-555555555555',
        }).success,
      ).toBe(true);

      // Entero
      expect(
        radicacionVirtualSchema.safeParse({
          ...basePayload,
          idPersona: 458723,
        }).success,
      ).toBe(true);

      // DNI como string
      expect(
        radicacionVirtualSchema.safeParse({
          ...basePayload,
          idPersona: '45872315',
        }).success,
      ).toBe(true);
    });

    it('Schema admite códigos TUPA ("TUPA-01", "LIBRE-01") y rechaza nil UUID', () => {
      const basePayload = {
        asunto: 'Solicitud de certificado de estudios',
        idPersona: '45872315',
        nombreSolicitante: 'Rosa Melgar',
        correo: 'rosa.melgar@gmail.com',
        totalFolios: 1,
        documentos: [
          {
            nombreArchivo: 'recibo.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 2048,
            hashSha256: 'b'.repeat(64),
          },
        ],
      };

      // TUPA-01
      expect(
        radicacionVirtualSchema.safeParse({
          ...basePayload,
          idTipoTramiteTupa: 'TUPA-01',
        }).success,
      ).toBe(true);

      // LIBRE-01
      expect(
        radicacionVirtualSchema.safeParse({
          ...basePayload,
          idTipoTramiteTupa: 'LIBRE-01',
        }).success,
      ).toBe(true);

      // Nil UUID debe ser rechazado
      const nilRes = radicacionVirtualSchema.safeParse({
        ...basePayload,
        idTipoTramiteTupa: '00000000-0000-0000-0000-000000000000',
      });
      expect(nilRes.success).toBe(false);
    });

    it('RadicacionVirtualService ejecuta el pipeline transaccional completo contra las tablas PG18', async () => {
      const queriesEjecutadas: string[] = [];

      const fakeClient = {
        query: vi.fn(async (sql: string, params?: any[]) => {
          queriesEjecutadas.push(sql);

          if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) {
            return {
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
            };
          }
          if (sql.includes('FROM sigd_auth.persona')) {
            return {
              rows: [{ id_persona: '22222222-3333-4444-5555-666666666666' }],
            };
          }
          if (sql.includes('fn_generar_cut')) {
            return {
              rows: [{ cut: 'EXP-2026-000042' }],
            };
          }
          if (sql.includes('INSERT INTO sigd_doc.expediente')) {
            return {
              rows: [{ expediente_id: 'exp-doc-1234' }],
            };
          }
          if (sql.includes('INSERT INTO sigd_tra.expediente')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO sigd_tra.asiento_registro')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const fakePool = {
        connect: vi.fn(async () => fakeClient),
        query: vi.fn(async () => ({ rows: [] })),
      } as unknown as Pool;

      const service = new RadicacionVirtualService(fakePool, async () => []);

      const resultado = await service.radicar({
        asunto: 'Solicitud de certificado de estudios semestral',
        idTipoTramiteTupa: 'TUPA-01',
        idPersona: '45872315',
        nombreSolicitante: 'Ana Ramos',
        correo: 'ana.ramos@iestpsuiza.edu.pe',
        totalFolios: 3,
        documentos: [
          {
            nombreArchivo: 'fut_digital.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 5000,
            hashSha256: 'c'.repeat(64),
          },
        ],
      });

      expect(resultado.cut).toBe('EXP-2026-000042');
      expect(resultado.expedienteId).toBe('exp-doc-1234');
      expect(resultado.cargoDigital.codigo).toMatch(/^CARGO-/);

      // Verificar que se ejecutó BEGIN y COMMIT
      expect(queriesEjecutadas).toContain('BEGIN');
      expect(queriesEjecutadas).toContain('COMMIT');

      // Verificar inserciones canónicas exactas
      const insertDocExp = queriesEjecutadas.find((q) => q.includes('INSERT INTO sigd_doc.expediente'));
      expect(insertDocExp).toBeDefined();
      expect(insertDocExp).toContain('tipo_tramite_id');
      expect(insertDocExp).toContain('codigo_expediente');
      expect(insertDocExp).toContain('solicitante_id');

      const insertTraExp = queriesEjecutadas.find((q) => q.includes('INSERT INTO sigd_tra.expediente'));
      expect(insertTraExp).toBeDefined();
      expect(insertTraExp).toContain('tipo_documental_id');
      expect(insertTraExp).toContain('dni_solicitante');
      expect(insertTraExp).toContain('fecha_radicacion');

      const insertAdjunto = queriesEjecutadas.find((q) => q.includes('INSERT INTO sigd_doc.documento_adjunto'));
      expect(insertAdjunto).toBeDefined();
      expect(insertAdjunto).toContain('s3_bucket');
      expect(insertAdjunto).toContain('s3_key');
      expect(insertAdjunto).toContain('sha256');

      const insertAsiento = queriesEjecutadas.find((q) => q.includes('INSERT INTO sigd_tra.asiento_registro'));
      expect(insertAsiento).toBeDefined();
      expect(insertAsiento).toContain("'MESA_VIRTUAL'");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. VENTANILLA PRESENCIAL SERVICE
  // ---------------------------------------------------------------------------
  describe('VentanillaPresencialService', () => {
    it('registrarExpedienteVentanilla genera CUT atómico y persiste en tablas canónicas', async () => {
      const queriesEjecutadas: string[] = [];

      const fakeClient = {
        query: vi.fn(async (sql: string, params?: any[]) => {
          queriesEjecutadas.push(sql);

          if (sql.includes('sigd_tra.generar_cut_expediente')) {
            return { rows: [{ cut: 'EXP-2026-000088' }] };
          }
          if (sql.includes('FROM sigd_auth.persona p')) {
            return { rows: [] }; // No existe, se creará
          }
          if (sql.includes('INSERT INTO sigd_auth.persona')) {
            return { rows: [{ id_persona: 'persona-uuid-1' }] };
          }
          if (sql.includes('INSERT INTO sigd_auth.persona_natural')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO sigd_tra.expediente')) {
            return { rows: [{ expediente_id: 'exp-tra-uuid-88' }] };
          }
          if (sql.includes('FROM sigd_doc.tipo_tramite_tupa')) {
            return { rows: [{ tipo_tramite_id: '00000000-0000-0000-0001-000000000001' }] };
          }
          if (sql.includes('INSERT INTO sigd_doc.expediente')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO sigd_tra.asiento_registro')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const fakePool = {
        connect: vi.fn(async () => fakeClient),
        query: vi.fn(async () => ({ rows: [] })),
      } as unknown as Pool;

      const service = new VentanillaPresencialService(fakePool);

      const resultado = await service.registrarExpedienteVentanilla({
        dniSolicitante: '74561238',
        datosRemitente: 'Pedro Pablo Kuczynski',
        asunto: 'Tramite TUPA-01: Certificado de estudios',
        foliosTotales: 5,
        codigoTupa: 'TUPA-01',
      });

      expect(resultado.cut).toBe('EXP-2026-000088');
      expect(resultado.expedienteId).toBe('exp-tra-uuid-88');
      expect(resultado.cargo.dni).toBe('74561238');
      expect(resultado.cargo.folios).toBe(5);
      expect(resultado.ticketImpresion).toContain('EXP-2026-000088');

      // Validar llamadas SQL
      expect(queriesEjecutadas.some((q) => q.includes('sigd_tra.generar_cut_expediente'))).toBe(true);
      expect(queriesEjecutadas.some((q) => q.includes('INSERT INTO sigd_auth.persona'))).toBe(true);
      expect(queriesEjecutadas.some((q) => q.includes('INSERT INTO sigd_tra.expediente'))).toBe(true);
      expect(queriesEjecutadas.some((q) => q.includes('INSERT INTO sigd_doc.expediente'))).toBe(true);
      expect(queriesEjecutadas.some((q) => q.includes('INSERT INTO sigd_tra.asiento_registro'))).toBe(true);
    });

    // -------------------------------------------------------------------------
    // ADVERSARIAL FINDING: Método estático heredado registrarExpediente
    // -------------------------------------------------------------------------
    it('ADVERSARIAL CHALLENGE: registrarExpediente estático conserva columnas incompatibles con 05_sigd_tra.sql', async () => {
      // Este test demuestra empíricamente que el método estático registrarExpediente
      // usa columnas inexistentes en sigd_tra.expediente:
      // - 'cut' en vez de 'codigo_expediente'
      // - 'canal_recepcion' (no existe)
      // - 'id_operador_ventanilla' (no existe)
      // - 'datos_remitente' (no existe)
      // - 'folios' (no existe)
      // - 'estado_tramite' en vez de 'estado'
      let queryCapturada = '';
      const mockDb = {
        query: vi.fn(async (sql: string) => {
          queryCapturada = sql;
          return { rows: [{ id_expediente: 'dummy' }] };
        }),
      };

      await VentanillaPresencialService.registrarExpediente(
        {
          idOperadorVentanilla: 1,
          datosRemitente: 'Test',
          asunto: 'Test Asunto',
          foliosTotales: 1,
        },
        mockDb,
      );

      // Confirmar que la consulta del método estático todavía contiene las columnas no canónicas
      const columnasIncompatibles = [
        'cut,',
        'canal_recepcion,',
        'id_operador_ventanilla,',
        'datos_remitente,',
        'folios,',
        'estado_tramite,',
      ];
      for (const col of columnasIncompatibles) {
        expect(queryCapturada).toContain(col);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 5. ORACLE DDL: VERIFICACIÓN FORENSE DE COLUMNAS VS MIGRACIONES 01 A 07
  // ---------------------------------------------------------------------------
  describe('Forensic Schema Cross-Verification (DDL 01..07 vs TramiCore Services)', () => {
    it('Todas las columnas usadas en consultas SQL de producción existen en las migraciones DDL', () => {
      const migracionesDir = path.resolve(__dirname, '../../../../migraciones');
      const archivosDdl = [
        '01_sigd_audit.sql',
        '02_sigd_auth.sql',
        '03_sigd_org.sql',
        '04_sigd_doc.sql',
        '05_sigd_tra.sql',
        '06_sigd_rut.sql',
        '07_sigd_reportes.sql',
      ];

      const contenidoTotalDdl = archivosDdl
        .map((f) => fs.readFileSync(path.join(migracionesDir, f), 'utf-8'))
        .join('\n');

      // 1. Columnas de sigd_doc.tipo_tramite_tupa
      const colsTipoTramite = [
        'tipo_tramite_id',
        'codigo',
        'denominacion',
        'descripcion',
        'unidad_organica',
        'plazo_dias',
        'silencio_administrativo',
        'base_legal',
        'vigente',
      ];
      for (const col of colsTipoTramite) {
        expect(contenidoTotalDdl).toContain(col);
      }

      // 2. Columnas de sigd_tra.expediente
      const colsTraExpediente = [
        'expediente_id',
        'codigo_expediente',
        'numero',
        'dni_solicitante',
        'tipo_documental_id',
        'solicitante_id',
        'area_destino_id',
        'estado',
        'fecha_radicacion',
      ];
      for (const col of colsTraExpediente) {
        expect(contenidoTotalDdl).toContain(col);
      }

      // 3. Columnas de sigd_doc.expediente
      const colsDocExpediente = [
        'expediente_id',
        'tipo_tramite_id',
        'codigo_expediente',
        'asunto',
        'solicitante_id',
        'estado',
        'fecha_registro',
      ];
      for (const col of colsDocExpediente) {
        expect(contenidoTotalDdl).toContain(col);
      }

      // 4. Columnas de sigd_tra.asiento_registro
      const colsAsiento = [
        'id_asiento',
        'numero_registro',
        'expediente_id',
        'fecha_ingreso',
        'canal_ingreso',
        'asunto',
        'remitente_id',
      ];
      for (const col of colsAsiento) {
        expect(contenidoTotalDdl).toContain(col);
      }

      // 5. Columnas de sigd_doc.documento_adjunto
      const colsAdjunto = [
        'documento_adjunto_id',
        'expediente_id',
        'tipo_documental_id',
        'nombre_archivo',
        's3_bucket',
        's3_key',
        'sha256',
        'tamano_bytes',
        'mime_type',
        'subido_por',
      ];
      for (const col of colsAdjunto) {
        expect(contenidoTotalDdl).toContain(col);
      }

      // 6. Columnas de sigd_auth.persona y persona_natural
      const colsAuth = [
        'id_persona',
        'tipo',
        'id_documento',
        'nombres',
        'apellidos',
        'nombre_completo',
      ];
      for (const col of colsAuth) {
        expect(contenidoTotalDdl).toContain(col);
      }
    });
  });
});

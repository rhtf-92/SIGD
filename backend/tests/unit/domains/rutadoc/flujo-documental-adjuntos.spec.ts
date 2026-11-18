import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { RepositorioPostgresRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.repository.js';

describe('SIGD 2026 — Flujo Documental Completo: Adjuntos del Ciudadano -> Expediente -> Mesa de Partes', () => {
  const ID_USUARIO_CIUDADANO = '11111111-1111-4111-8111-111111111111';
  const ID_PERSONA_CIUDADANO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const ID_USUARIO_AJENO = '22222222-2222-4222-8222-222222222222';
  const ID_PERSONA_AJENO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const ID_USUARIO_MESA_PARTES = '33333333-3333-4333-8333-333333333333';
  const ID_USUARIO_ADMIN = '44444444-4444-4444-8444-444444444444';

  const ID_EXPEDIENTE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const ID_DOCUMENTO_1 = 'd1111111-1111-4111-8111-111111111111';
  const ID_DOCUMENTO_2 = 'd2222222-2222-4222-8222-222222222222';
  const ID_TIPO_DOC = 'a373f0c7-8d3e-4328-aec1-78409b539131';

  const tokenCiudadano = firmarTokenAcceso({
    sub: ID_USUARIO_CIUDADANO,
    roles: ['CIUDADANO'],
  });

  const tokenAjeno = firmarTokenAcceso({
    sub: ID_USUARIO_AJENO,
    roles: ['CIUDADANO'],
  });

  const tokenMesaPartes = firmarTokenAcceso({
    sub: ID_USUARIO_MESA_PARTES,
    roles: ['MESA_PARTES'],
  });

  const tokenAdmin = firmarTokenAcceso({
    sub: ID_USUARIO_ADMIN,
    roles: ['ADMINISTRADOR'],
  });

  describe('1. Unidad Repository: Conteo real y separación de Documentos vs Folios', () => {
    it('documento sin foliación sigue contando como documento existente (cantidadDocumentos: 1, totalFolios: 0)', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          const s = String(sql);
          if (s.includes('FROM sigd_tra.expediente e')) {
            return {
              rowCount: 1,
              rows: [
                {
                  id_expediente: ID_EXPEDIENTE,
                  cut: 'EXP-2026-000014',
                  asunto: 'Prueba unitaria',
                  fecha_radicacion: new Date('2026-10-28T10:00:00Z'),
                  estado_actual: 'REGISTRADO',
                  area_actual_id: null,
                  solicitante_id: ID_PERSONA_CIUDADANO,
                  id_movimiento: null,
                  evento: null,
                  fecha_hora: null,
                  usuario_operador_id: null,
                },
              ],
            };
          }
          if (s.includes("to_regclass('sigd_doc.documento_adjunto')")) {
            return { rows: [{ existe: 'sigd_doc.documento_adjunto' }] };
          }
          if (s.includes('FROM sigd_doc.documento_adjunto') && s.includes('count(*)')) {
            return { rows: [{ cantidad: 1 }] };
          }
          if (s.includes("to_regclass('sigd_tra.expediente_documento_folio')")) {
            return { rows: [{ existe: 'sigd_tra.expediente_documento_folio' }] };
          }
          if (s.includes('FROM sigd_tra.expediente_documento_folio')) {
            return { rows: [{ cantidad: 0, total: 0 }] };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as Pool;

      const repo = new RepositorioPostgresRutaDoc(mockPool);
      const detalle = await repo.obtener(ID_EXPEDIENTE);

      expect(detalle).not.toBeNull();
      expect(detalle?.resumenDocumentos).toEqual({
        cantidadDocumentos: 1,
        totalFolios: 0,
        cantidadFoliados: 0,
      });
    });

    it('soporta múltiples documentos adjuntos en el expediente (ej. 2 documentos)', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          const s = String(sql);
          if (s.includes('FROM sigd_tra.expediente e')) {
            return {
              rowCount: 1,
              rows: [{
                id_expediente: ID_EXPEDIENTE,
                cut: 'EXP-2026-000014',
                asunto: 'Dos adjuntos',
                fecha_radicacion: new Date('2026-10-28T10:00:00Z'),
                estado_actual: 'REGISTRADO',
                solicitante_id: ID_PERSONA_CIUDADANO,
              }],
            };
          }
          if (s.includes("to_regclass('sigd_doc.documento_adjunto')")) {
            return { rows: [{ existe: 'sigd_doc.documento_adjunto' }] };
          }
          if (s.includes('FROM sigd_doc.documento_adjunto') && s.includes('count(*)')) {
            return { rows: [{ cantidad: 2 }] };
          }
          if (s.includes("to_regclass('sigd_tra.expediente_documento_folio')")) {
            return { rows: [{ existe: 'sigd_tra.expediente_documento_folio' }] };
          }
          if (s.includes('FROM sigd_tra.expediente_documento_folio')) {
            return { rows: [{ cantidad: 1, total: 3 }] };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as Pool;

      const repo = new RepositorioPostgresRutaDoc(mockPool);
      const detalle = await repo.obtener(ID_EXPEDIENTE);

      expect(detalle?.resumenDocumentos).toEqual({
        cantidadDocumentos: 2,
        totalFolios: 3,
        cantidadFoliados: 1,
      });
    });

    it('listarDocumentosAdjuntos devuelve metadatos completos ordenados', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          const s = String(sql);
          if (s.includes("to_regclass('sigd_doc.documento_adjunto')")) {
            return { rows: [{ existe: 'sigd_doc.documento_adjunto' }] };
          }
          if (s.includes('FROM sigd_doc.documento_adjunto da')) {
            return {
              rows: [
                {
                  id_documento: ID_DOCUMENTO_1,
                  nombre_archivo: 'requisito1.pdf',
                  tamano_bytes: '1024',
                  mime_type: 'application/pdf',
                  sha256: 'a'.repeat(64),
                  creado_en: new Date('2026-10-28T10:00:00Z'),
                  tipo_documental: 'Solicitud',
                  folio_inicio: null,
                  folio_fin: null,
                },
                {
                  id_documento: ID_DOCUMENTO_2,
                  nombre_archivo: 'requisito2.pdf',
                  tamano_bytes: '2048',
                  mime_type: 'application/pdf',
                  sha256: 'b'.repeat(64),
                  creado_en: new Date('2026-10-28T10:05:00Z'),
                  tipo_documental: 'Anexo',
                  folio_inicio: 1,
                  folio_fin: 2,
                },
              ],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const repo = new RepositorioPostgresRutaDoc(mockPool);
      const docs = await repo.listarDocumentosAdjuntos(ID_EXPEDIENTE);

      expect(docs).toHaveLength(2);
      expect(docs[0].nombreArchivo).toBe('requisito1.pdf');
      expect(docs[0].foliado).toBe(false);
      expect(docs[0].folios).toBeNull();
      expect(docs[1].nombreArchivo).toBe('requisito2.pdf');
      expect(docs[1].foliado).toBe(true);
      expect(docs[1].folios).toBe('F. 0001 - F. 0002');
    });
  });

  describe('2. Endpoint HTTP /expedientes/:id/resumen y Detalle Documental', () => {
    it('GET /resumen devuelve la lista de documentos y resumen documental fiel', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          const s = String(sql);
          if (s.includes('sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_persona: ID_PERSONA_CIUDADANO, area_id: null }] };
          }
          if (s.includes('sigd_tra.expediente') && s.includes('solicitante_id::text AS solicitante_id')) {
            return { rows: [{ solicitante_id: ID_PERSONA_CIUDADANO, area_destino_id: null, estado: 'REGISTRADO' }] };
          }
          if (s.includes('FROM sigd_tra.expediente e')) {
            return {
              rowCount: 1,
              rows: [{
                id_expediente: ID_EXPEDIENTE,
                cut: 'EXP-2026-000014',
                asunto: 'Asunto de prueba',
                fecha_radicacion: new Date('2026-10-28T10:00:00Z'),
                estado_actual: 'REGISTRADO',
                solicitante_id: ID_PERSONA_CIUDADANO,
              }],
            };
          }
          if (s.includes("to_regclass('sigd_doc.documento_adjunto')")) {
            return { rows: [{ existe: 'sigd_doc.documento_adjunto' }] };
          }
          if (s.includes('count(*)')) {
            return { rows: [{ cantidad: 1 }] };
          }
          if (s.includes("to_regclass('sigd_tra.expediente_documento_folio')")) {
            return { rows: [{ existe: 'sigd_tra.expediente_documento_folio' }] };
          }
          if (s.includes('FROM sigd_tra.expediente_documento_folio')) {
            return { rows: [{ cantidad: 0, total: 0 }] };
          }
          if (s.includes('FROM sigd_doc.documento_adjunto da')) {
            return {
              rows: [{
                id_documento: ID_DOCUMENTO_1,
                nombre_archivo: 'documento_oficial.pdf',
                tamano_bytes: '1810090',
                mime_type: 'application/pdf',
                sha256: 'c'.repeat(64),
                creado_en: new Date('2026-10-28T10:00:00Z'),
                tipo_documental: 'Solicitud',
                folio_inicio: null,
                folio_fin: null,
              }],
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      } as unknown as Pool;

      const app = construirApp(mockPool);
      const res = await request(app)
        .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/resumen`)
        .set('Authorization', `Bearer ${tokenCiudadano}`);

      expect(res.status).toBe(200);
      expect(res.body.foliacionResumen.cantidadDocumentos).toBe(1);
      expect(res.body.foliacionResumen.totalFolios).toBe(0);
      expect(res.body.documentos).toHaveLength(1);
      expect(res.body.documentos[0].nombreArchivo).toBe('documento_oficial.pdf');
      expect(res.body.documentos[0].tamanoBytes).toBe(1810090);
    });
  });

  describe('3. Seguridad Presigned GET, RBAC y BOLA/IDOR en Documentos', () => {
    const s3KeyValida = 'expedientes/2026/archivo.pdf';

    it('ciudadano ajeno es bloqueado (403 Forbidden)', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          const s = String(sql);
          if (s.includes('sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_persona: ID_PERSONA_AJENO, area_id: null }] };
          }
          if (s.includes('sigd_tra.expediente') && s.includes('solicitante_id::text AS solicitante_id')) {
            return { rows: [{ solicitante_id: ID_PERSONA_CIUDADANO, area_destino_id: null, estado: 'REGISTRADO' }] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = construirApp(mockPool);
      const res = await request(app)
        .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/documentos/${ID_DOCUMENTO_1}/url-archivo`)
        .set('Authorization', `Bearer ${tokenAjeno}`);

      expect(res.status).toBe(403);
    });

    it('Mesa de Partes tiene acceso autorizado al documento', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          const s = String(sql);
          if (s.includes('sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_persona: null, area_id: 'AREA-MP' }] };
          }
          if (s.includes('sigd_tra.expediente') && s.includes('solicitante_id::text AS solicitante_id')) {
            return { rows: [{ solicitante_id: ID_PERSONA_CIUDADANO, area_destino_id: null, estado: 'REGISTRADO' }] };
          }
          if (s.includes('FROM sigd_doc.documento_adjunto')) {
            return {
              rows: [{
                documento_adjunto_id: ID_DOCUMENTO_1,
                nombre_archivo: 'doc.pdf',
                s3_bucket: 'sigd-expedientes',
                s3_key: s3KeyValida,
                mime_type: 'application/pdf',
                sha256: 'a'.repeat(64),
                tamano_bytes: '5000',
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = construirApp(mockPool);

      // Simulamos respuesta HEAD de MinIO para no depender de red externa en test unitario
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts?: any) => {
        if (opts?.method === 'HEAD') {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-length': '5000', 'content-type': 'application/pdf' }),
          };
        }
        return { ok: true, status: 200 };
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await request(app)
        .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/documentos/${ID_DOCUMENTO_1}/url-archivo`)
        .set('Authorization', `Bearer ${tokenMesaPartes}`);

      vi.unstubAllGlobals();

      expect(res.status).toBe(200);
      expect(res.body.url).toContain('/sigd-expedientes/');
      expect(res.body.nombreArchivo).toBe('doc.pdf');
      expect(res.body.expiraEnSegundos).toBe(900);
    });

    it('IDOR / BOLA: si el documento no pertenece al expediente solicitado devuelve 404', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          const s = String(sql);
          if (s.includes('sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_persona: null, area_id: 'AREA-MP' }] };
          }
          if (s.includes('sigd_tra.expediente') && s.includes('solicitante_id::text AS solicitante_id')) {
            return { rows: [{ solicitante_id: ID_PERSONA_CIUDADANO, area_destino_id: null, estado: 'REGISTRADO' }] };
          }
          if (s.includes('FROM sigd_doc.documento_adjunto')) {
            // El documento pertenece a OTRO expediente, la query con WHERE (expediente_id = $2) retorna 0 filas
            return { rows: [] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = construirApp(mockPool);
      const res = await request(app)
        .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/documentos/${ID_DOCUMENTO_2}/url-archivo`)
        .set('Authorization', `Bearer ${tokenMesaPartes}`);

      expect(res.status).toBe(404);
      expect(res.body.detail).toContain('asociado al expediente indicado');
    });

    it('si el archivo físico no existe en MinIO, devuelve error 404 real (NO placeholder txt)', async () => {
      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          const s = String(sql);
          if (s.includes('sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_persona: null, area_id: 'AREA-MP' }] };
          }
          if (s.includes('sigd_tra.expediente') && s.includes('solicitante_id::text AS solicitante_id')) {
            return { rows: [{ solicitante_id: ID_PERSONA_CIUDADANO, area_destino_id: null, estado: 'REGISTRADO' }] };
          }
          if (s.includes('FROM sigd_doc.documento_adjunto')) {
            return {
              rows: [{
                documento_adjunto_id: ID_DOCUMENTO_1,
                nombre_archivo: 'inexistente.pdf',
                s3_bucket: 'sigd-expedientes',
                s3_key: 'expedientes/2026/no-existe.pdf',
                mime_type: 'application/pdf',
                sha256: 'a'.repeat(64),
                tamano_bytes: '5000',
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = construirApp(mockPool);

      // Simular que MinIO devuelve 404 en HEAD
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts?: any) => {
        if (opts?.method === 'HEAD') {
          return {
            ok: false,
            status: 404,
            headers: new Headers(),
          };
        }
        return { ok: false, status: 404 };
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await request(app)
        .get(`/api/v1/expedientes/${ID_EXPEDIENTE}/documentos/${ID_DOCUMENTO_1}/url-archivo`)
        .set('Authorization', `Bearer ${tokenMesaPartes}`);

      vi.unstubAllGlobals();

      expect(res.status).toBe(404);
      expect(res.body.detail).toContain('almacenamiento MinIO');
    });
  });

  describe('4. Confirmación de Carga y Vínculo con Expediente', () => {
    it('POST /confirmar-carga registra documento adjunto vinculado a expediente TRA', async () => {
      const mockS3Client = {
        send: vi.fn().mockImplementation(async () => {
          const pdfBuffer = Buffer.concat([
            Buffer.from('%PDF-1.4\n%'),
            Buffer.from('Contenido de prueba oficial'),
          ]);
          return {
            Body: Readable.from([pdfBuffer]),
            ContentType: 'application/pdf',
            ContentLength: pdfBuffer.length,
          };
        }),
      };

      const pdfContenido = Buffer.concat([
        Buffer.from('%PDF-1.4\n%'),
        Buffer.from('Contenido de prueba oficial'),
      ]);
      const sha256Calculado = crypto.createHash('sha256').update(pdfContenido).digest('hex');

      const mockPool = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          const s = String(sql);
          if (s.includes('sigd_auth.cuenta_usuario')) {
            return { rows: [{ id_persona: ID_PERSONA_CIUDADANO, area_id: null }] };
          }
          if (s.includes('FROM sigd_tra.expediente')) {
            return { rowCount: 1, rows: [{ expediente_id: ID_EXPEDIENTE, solicitante_id: ID_PERSONA_CIUDADANO, area_destino_id: null, area_actual_id: null, estado: 'REGISTRADO' }] };
          }
          if (s.includes('FROM sigd_doc.tipo_documento')) {
            return { rows: [{ tipo_documental_id: ID_TIPO_DOC, vigente: true }] };
          }
          if (s.includes('FROM sigd_doc.documento_adjunto') && s.includes('sha256 = $2')) {
            return { rows: [] };
          }
          if (s.includes('INSERT INTO sigd_doc.documento_adjunto')) {
            return {
              rows: [{
                documento_adjunto_id: ID_DOCUMENTO_1,
                sha256: sha256Calculado,
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const app = construirApp(mockPool, { s3Client: mockS3Client as any });
      const res = await request(app)
        .post('/api/v1/storage/confirmar-carga')
        .set('Authorization', `Bearer ${tokenCiudadano}`)
        .send({
          s3Key: 'expedientes/2026/archivo_prueba.pdf',
          sha256Hash: sha256Calculado,
          idExpediente: ID_EXPEDIENTE,
          tipoDocumentalId: ID_TIPO_DOC,
          origenExpediente: 'TRA',
          nombreArchivo: 'mi_archivo.pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.confirmado).toBe(true);
      expect(res.body.documentoId).toBe(ID_DOCUMENTO_1);
      expect(res.body.sha256).toBe(sha256Calculado);
    });
  });
});

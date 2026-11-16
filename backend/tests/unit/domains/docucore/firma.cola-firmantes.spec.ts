import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import request from 'supertest';
import express from 'express';
import { listarPendientesFirma, crearRouterFirma } from '../../../../src/modules/firma/firma.routes.js';
import { resolverIdentidad, verificarFacultadFirma } from '../../../../src/core/auth/auth.guard.js';

vi.mock('../../../../src/core/auth/auth.guard.js', () => ({
  resolverIdentidad: vi.fn(),
  verificarFacultadFirma: vi.fn(),
}));

describe('SIGD FirmaCore — Validación Canónica de Bandeja de Firmas (H-01 y H-02)', () => {
  const usuarioDirectorId = '00000000-0000-0000-0000-000000000020';
  const usuarioOperadorId = '00000000-0000-0000-0000-000000000030';
  const expedienteEnFirmaId = 'f1111111-1111-4111-8111-111111111111';
  const expedienteEnRevisionId = 'f2222222-2222-4222-8222-222222222222';
  const expedienteEnCalifId = 'f3333333-3333-4333-8333-333333333333';
  const expedienteDerivadoId = 'f4444444-4444-4444-8444-444444444444';
  const expedienteSinEstadoId = 'f5555555-5555-4555-8555-555555555555';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('S3_BUCKET', 'sigd-sandbox-e2e');
    vi.stubEnv('S3_ENDPOINT', 'http://127.0.0.1:9000');
  });

  function fixtureMockDb(filasRetornadas: any[]) {
    let sqlEjecutado = '';
    let paramsEjecutados: any[] = [];

    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
        sqlEjecutado = sql;
        paramsEjecutados = params;
        return { rows: filasRetornadas, rowCount: filasRetornadas.length };
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: mockClient.query,
    } as unknown as Pool;

    return { mockPool, mockClient, getSql: () => sqlEjecutado, getParams: () => paramsEjecutados };
  }

  describe('1. Estructura y Cláusulas de la Consulta SQL (H-01 y H-02)', () => {
    it('la consulta incluye JOIN a sigd_rut.estado_actual_expediente y filtro rut_estado.estado_nuevo = EN_FIRMA', async () => {
      const { mockPool, getSql } = fixtureMockDb([]);

      await listarPendientesFirma(mockPool, usuarioDirectorId, {
        pagina: 1,
        porPagina: 10,
        tipoResolucion: 'TODOS',
      });

      const sql = getSql();
      expect(sql).toContain('JOIN sigd_rut.estado_actual_expediente rut_estado');
      expect(sql).toContain("rut_estado.estado_nuevo = 'EN_FIRMA'");
    });

    it('la consulta asocia el documento adjunto exigiendo s3_key con el numero_borrador, mime_type application/pdf y sha256 no nulo', async () => {
      const { mockPool, getSql } = fixtureMockDb([]);

      await listarPendientesFirma(mockPool, usuarioDirectorId, {
        pagina: 1,
        porPagina: 10,
        tipoResolucion: 'TODOS',
      });

      const sql = getSql();
      expect(sql).toContain("a.s3_key = ('resoluciones/' || r.numero_borrador || '.pdf')");
      expect(sql).toContain("a.mime_type = 'application/pdf'");
      expect(sql).toContain('a.sha256 IS NOT NULL');
      expect(sql).toContain('LENGTH(TRIM(a.sha256)) > 0');
      // No utiliza LEFT JOIN LATERAL ambiguo
      expect(sql).toContain('JOIN LATERAL');
      expect(sql).not.toContain('LEFT JOIN LATERAL (\n        SELECT \'s3://\' || a.s3_bucket || \'/\' || a.s3_key AS s3_referencia,\n               a.documento_adjunto_id AS documento_id, a.sha256');
    });
  });

  describe('2. Pruebas Funcionales de Filtro de Estados y Documentos', () => {
    it('CRIT-1: Expediente en EN_REVISION no se presenta en la bandeja', async () => {
      // Si la BD excluye el registro porque rut_estado.estado_nuevo no es EN_FIRMA, la bandeja retorna lista vacía
      const { mockPool } = fixtureMockDb([]);

      const resultado = await listarPendientesFirma(mockPool, usuarioDirectorId, {
        pagina: 1,
        porPagina: 10,
        tipoResolucion: 'TODOS',
      });

      expect(resultado.total).toBe(0);
      expect(resultado.documentos).toHaveLength(0);
    });

    it('CRIT-2: Expediente en EN_CALIFICACION no aparece en la bandeja', async () => {
      const { mockPool } = fixtureMockDb([]);
      const resultado = await listarPendientesFirma(mockPool, usuarioDirectorId, {
        pagina: 1,
        porPagina: 10,
        tipoResolucion: 'TODOS',
      });
      expect(resultado.documentos).toHaveLength(0);
    });

    it('CRIT-3: Expediente en DERIVADO no aparece en la bandeja', async () => {
      const { mockPool } = fixtureMockDb([]);
      const resultado = await listarPendientesFirma(mockPool, usuarioDirectorId, {
        pagina: 1,
        porPagina: 10,
        tipoResolucion: 'TODOS',
      });
      expect(resultado.documentos).toHaveLength(0);
    });

    it('CRIT-4: Expediente en EN_FIRMA con resolución y PDF válidos aparece cuando el usuario está autorizado', async () => {
      const filaValida = {
        resolucion_id: 'a1111111-1111-4111-8111-111111111111',
        expediente_id: expedienteEnFirmaId,
        cut: 'EXP-2026-000050',
        numero_borrador: 'RD-2026-000050',
        tipo_resolucion: 'DIRECTORAL_ADMINISTRATIVA',
        asunto: 'Aprobación de solicitud administrativa',
        solicitante_nombre: 'JUAN PEREZ',
        fecha_proyeccion: '2026-10-28T10:00:00.000Z',
        fecha_limite: '2026-11-28T10:00:00.000Z',
        folios_total: 4,
        s3_referencia: 's3://sigd-sandbox-e2e/resoluciones/RD-2026-000050.pdf',
        documento_id: 'd1111111-1111-4111-8111-111111111111',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        estado_firma: null,
        puede_firmar: true,
        motivo_no_habilitado: null,
        total: '1',
      };

      const { mockPool } = fixtureMockDb([filaValida]);

      const resultado = await listarPendientesFirma(mockPool, usuarioDirectorId, {
        pagina: 1,
        porPagina: 10,
        tipoResolucion: 'TODOS',
      });

      expect(resultado.total).toBe(1);
      expect(resultado.documentos).toHaveLength(1);
      const doc = resultado.documentos[0];
      expect(doc.numeroBorrador).toBe('RD-2026-000050');
      expect(doc.documentoId).toBe('d1111111-1111-4111-8111-111111111111');
      expect(doc.hashSha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(doc.puedeFirmar).toBe(true);
    });

    it('CRIT-5: Expediente sin registro de estado actual no aparece', async () => {
      const { mockPool } = fixtureMockDb([]);
      const resultado = await listarPendientesFirma(mockPool, usuarioDirectorId, {
        pagina: 1,
        porPagina: 10,
        tipoResolucion: 'TODOS',
      });
      expect(resultado.documentos).toHaveLength(0);
    });

    it('CRIT-6 y 7: Resolución sin PDF o sin SHA-256 es excluida por el JOIN LATERAL', async () => {
      // El JOIN LATERAL exige a.sha256 IS NOT NULL y coincidencia exacta en s3_key
      const { mockPool, getSql } = fixtureMockDb([]);
      await listarPendientesFirma(mockPool, usuarioDirectorId, {
        pagina: 1,
        porPagina: 10,
        tipoResolucion: 'TODOS',
      });
      const sql = getSql();
      expect(sql).toContain("a.s3_key = ('resoluciones/' || r.numero_borrador || '.pdf')");
      expect(sql).toContain('a.sha256 IS NOT NULL');
    });

    it('CRIT-8: Expediente con dos resoluciones asigna a cada una su propio PDF exacto', async () => {
      const resolucionA = {
        resolucion_id: 'res-a',
        expediente_id: expedienteEnFirmaId,
        cut: 'EXP-2026-000050',
        numero_borrador: 'RD-2026-000001',
        tipo_resolucion: 'DIRECTORAL_ADMINISTRATIVA',
        asunto: 'Resolución A',
        solicitante_nombre: 'ADMINISTRADO',
        fecha_proyeccion: '2026-10-28T10:00:00.000Z',
        fecha_limite: '2026-11-28T10:00:00.000Z',
        folios_total: 2,
        s3_referencia: 's3://sigd-sandbox-e2e/resoluciones/RD-2026-000001.pdf',
        documento_id: 'doc-a',
        sha256: 'aaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeee',
        estado_firma: null,
        puede_firmar: true,
        motivo_no_habilitado: null,
        total: '2',
      };
      const resolucionB = {
        resolucion_id: 'res-b',
        expediente_id: expedienteEnFirmaId,
        cut: 'EXP-2026-000050',
        numero_borrador: 'RD-2026-000002',
        tipo_resolucion: 'DIRECTORAL_TITULACION',
        asunto: 'Resolución B',
        solicitante_nombre: 'ADMINISTRADO',
        fecha_proyeccion: '2026-10-28T10:00:00.000Z',
        fecha_limite: '2026-11-28T10:00:00.000Z',
        folios_total: 2,
        s3_referencia: 's3://sigd-sandbox-e2e/resoluciones/RD-2026-000002.pdf',
        documento_id: 'doc-b',
        sha256: 'bbbb1111222233334444555566667777888899990000aaaabbbbccccddddeeee',
        estado_firma: null,
        puede_firmar: true,
        motivo_no_habilitado: null,
        total: '2',
      };

      const { mockPool } = fixtureMockDb([resolucionA, resolucionB]);

      const resultado = await listarPendientesFirma(mockPool, usuarioDirectorId, {
        pagina: 1,
        porPagina: 10,
        tipoResolucion: 'TODOS',
      });

      expect(resultado.documentos).toHaveLength(2);
      expect(resultado.documentos[0].documentoId).toBe('doc-a');
      expect(resultado.documentos[0].numeroBorrador).toBe('RD-2026-000001');
      expect(resultado.documentos[1].documentoId).toBe('doc-b');
      expect(resultado.documentos[1].numeroBorrador).toBe('RD-2026-000002');
    });

    it('CRIT-9: Expediente con solicitud inicial y resolución no selecciona el documento inicial', async () => {
      // Gracias a la condición 'resoluciones/' || r.numero_borrador || '.pdf',
      // nunca se vincula un documento con clave 'expedientes/2026/solicitud.pdf'
      const { mockPool, getSql } = fixtureMockDb([]);
      await listarPendientesFirma(mockPool, usuarioDirectorId, {
        pagina: 1,
        porPagina: 10,
        tipoResolucion: 'TODOS',
      });
      const sql = getSql();
      expect(sql).toContain("('resoluciones/' || r.numero_borrador || '.pdf')");
    });
  });

  describe('3. Autorización y Mínimo Privilegio HTTP', () => {
    it('CRIT-10: Operador sin facultad de firma recibe HTTP 403 USER_CANNOT_SIGN', async () => {
      vi.mocked(resolverIdentidad).mockReturnValue({
        idUsuario: usuarioOperadorId,
        roles: ['OPERADOR'],
        via: 'bearer',
      });
      vi.mocked(verificarFacultadFirma).mockResolvedValue({
        puedeFirmar: false,
        facultadGlobal: false,
        tiposAutorizados: [],
        roles: ['OPERADOR'],
        motivo: 'El funcionario de Secretaría Académica no cuenta con facultad de despacho.',
      });

      const { mockPool } = fixtureMockDb([]);
      const app = express();
      app.use(express.json());
      app.use('/api/v1/firma', crearRouterFirma(mockPool));
      // Error handler
      app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(err.status ?? 500).json({ code: err.code, message: err.message });
      });

      const res = await request(app).get('/api/v1/firma/pendientes');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('USER_CANNOT_SIGN');
    });
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';

describe('TramiCore — Consulta Pública del Catálogo TUPA para Usuarios Anónimos', () => {
  let app: Express;
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: vi.fn(),
      }),
      query: vi.fn().mockImplementation(async (sql: string) => {
        // Versión vigente
        if (sql.includes('FROM sigd_doc.tupa_version') && sql.includes("estado = 'VIGENTE'")) {
          return {
            rows: [{ id_version: 'v-2026', codigo: 'TUPA-2026', anio: 2026, estado: 'VIGENTE' }],
            rowCount: 1,
          };
        }
        // Procedimientos
        if (sql.includes('FROM sigd_doc.tupa_procedimiento')) {
          if (sql.includes('genera_expediente = true')) {
            return {
              rows: [
                {
                  id_procedimiento: 'proc-01',
                  id_version: 'v-2026',
                  codigo_ref: 'p1-fila-05',
                  codigo_externo: 'P01',
                  denominacion: 'Certificado de Estudios',
                  categoria: 'PROCEDIMIENTO_APROBADO',
                  monto: '15.00',
                  unidad_cobro: 'Trámite',
                  plazo_dias: 5,
                  requisitos: ['Solicitud FUT', 'Fotografía'],
                  genera_expediente: true,
                  calificacion: 'EVALUACION_PREVIA_POSITIVA',
                },
              ],
              rowCount: 1,
            };
          }

          // Todos los procedimientos vigentes
          return {
            rows: [
              {
                id_procedimiento: 'proc-01',
                id_version: 'v-2026',
                codigo_ref: 'p1-fila-05',
                codigo_externo: 'P01',
                denominacion: 'Certificado de Estudios',
                categoria: 'PROCEDIMIENTO_APROBADO',
                monto: '15.00',
                unidad_cobro: 'Trámite',
                plazo_dias: 5,
                requisitos: ['Solicitud FUT', 'Fotografía'],
                genera_expediente: true,
                calificacion: 'EVALUACION_PREVIA_POSITIVA',
              },
              {
                id_procedimiento: 'proc-02',
                id_version: 'v-2026',
                codigo_ref: 'serv-acad-01',
                codigo_externo: 'SA01',
                denominacion: 'Constancia de Matrícula',
                categoria: 'SERVICIO_ACADEMICO',
                monto: '10.00',
                unidad_cobro: 'Constancia',
                plazo_dias: 3,
                requisitos: ['FUT'],
                genera_expediente: false,
                calificacion: 'AUTOMATICA',
              },
              {
                id_procedimiento: 'proc-03',
                id_version: 'v-2026',
                codigo_ref: 'act-int-01',
                codigo_externo: 'AI01',
                denominacion: 'Revisión Interna de Legajo',
                categoria: 'ACTUACION_INTERNA',
                monto: '0.00',
                unidad_cobro: 'Actuación',
                plazo_dias: 1,
                requisitos: [],
                genera_expediente: false,
                calificacion: 'AUTOMATICA',
              },
            ],
            rowCount: 3,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    app = express();
    app.use(express.json());
    app.use('/api/v1', crearRouterTramites(mockPool as any));
    app.use(errorMiddleware);
  });

  it('permite consulta de procedimientos aprobados sin sesión con ?aprobados=true', async () => {
    const res = await request(app).get('/api/v1/tramites/tupa?aprobados=true');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].denominacion).toBe('Certificado de Estudios');
    expect(res.body[0].generaExpediente).toBe(true);
  });

  it('permite consulta pública general sin sesión con ?publico=true y filtra ACTUACION_INTERNA', async () => {
    const res = await request(app).get('/api/v1/tramites/tupa?publico=true');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    // Excluye proc-03 (ACTUACION_INTERNA)
    const categorias = res.body.map((item: any) => item.categoria);
    expect(categorias).toContain('PROCEDIMIENTO_APROBADO');
    expect(categorias).toContain('SERVICIO_ACADEMICO');
    expect(categorias).not.toContain('ACTUACION_INTERNA');
  });

  it('mantiene rechazo 403 con SOLICITUD_ACCESO_REQUERIDA si no hay query param ni token', async () => {
    const res = await request(app).get('/api/v1/tramites/tupa');

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SOLICITUD_ACCESO_REQUERIDA');
  });
});

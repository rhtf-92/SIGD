import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import request from 'supertest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

// Identificadores sintéticos UUIDv4
const USUARIO_ESTUDIANTE_TITULAR = '10000000-0000-4000-8000-000000000001';
const USUARIO_ESTUDIANTE_AJENO   = '10000000-0000-4000-8000-000000000002';
const USUARIO_CIUDADANO_TITULAR  = '10000000-0000-4000-8000-000000000003';
const USUARIO_CIUDADANO_AJENO    = '10000000-0000-4000-8000-000000000004';
const USUARIO_DOCENTE_ASIGNADO   = '10000000-0000-4000-8000-000000000005';
const USUARIO_DOCENTE_NO_ASIGN   = '10000000-0000-4000-8000-000000000006';
const USUARIO_COORDINADOR_AREA   = '10000000-0000-4000-8000-000000000007';
const USUARIO_COORDINADOR_OTRA   = '10000000-0000-4000-8000-000000000008';

const PERSONA_ESTUDIANTE_TITULAR = '20000000-0000-4000-8000-000000000001';
const PERSONA_ESTUDIANTE_AJENO   = '20000000-0000-4000-8000-000000000002';
const PERSONA_CIUDADANO_TITULAR  = '20000000-0000-4000-8000-000000000003';
const PERSONA_CIUDADANO_AJENO    = '20000000-0000-4000-8000-000000000004';

const AREA_ACADEMICA             = '30000000-0000-4000-8000-000000000001';
const AREA_OTRA                  = '30000000-0000-4000-8000-000000000002';

const EXPEDIENTE_ID              = '40000000-0000-4000-8000-000000000001';

interface ContextoActor {
  usuarioId: string;
  personaId: string;
  roles: string[];
  unidadOrganicaId?: string | null;
  permisos?: Array<{ codigo: string; ambito: 'GLOBAL' | 'AREA'; areaId: string | null }>;
}

function crearAppEvaluadores(actorActual: ContextoActor, opciones?: {
  expedienteSolicitanteId?: string;
  expedienteAreaActualId?: string;
  docenteAsignadoId?: string;
}) {
  const solicitanteExpediente = opciones?.expedienteSolicitanteId ?? PERSONA_ESTUDIANTE_TITULAR;
  const areaExpediente = opciones?.expedienteAreaActualId ?? AREA_ACADEMICA;
  const evaluadorDocenteId = opciones?.docenteAsignadoId ?? USUARIO_DOCENTE_ASIGNADO;

  let queryEvaluadoresLlamada = false;

  const pool = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      // 1. Autorización de cuenta (obtenerAutorizacionCuenta)
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu') && sql.includes('AS roles')) {
        return {
          rows: [{
            roles: actorActual.roles,
            permisos: actorActual.permisos ?? [],
            unidad_organica_id: actorActual.unidadOrganicaId ?? null,
          }],
          rowCount: 1,
        };
      }

      // 2. puedeVerExpediente (en app.ts)
      if (sql.includes('SELECT EXISTS') && sql.includes('cu.id_usuario = $1::uuid AND cu.activo = TRUE')) {
        const uId = params?.[0];
        const expId = params?.[1];

        if (expId !== EXPEDIENTE_ID) return { rows: [{ autorizado: false }], rowCount: 1 };

        // Rama A: Titularidad (solicitante_id = cu.id_persona)
        if (actorActual.personaId === solicitanteExpediente) {
          return { rows: [{ autorizado: true }], rowCount: 1 };
        }

        // Rama B: Evaluador docente activo asignado al expediente
        if (uId === evaluadorDocenteId && uId === USUARIO_DOCENTE_ASIGNADO) {
          return { rows: [{ autorizado: true }], rowCount: 1 };
        }

        // Rama C: Funcionario institucional con permiso EXPEDIENTE_LEER en el área o global
        // CIUDADANO y ESTUDIANTE están excluidos de esta rama
        if (actorActual.roles.includes('CIUDADANO') || actorActual.roles.includes('ESTUDIANTE')) {
          return { rows: [{ autorizado: false }], rowCount: 1 };
        }

        const tienePermisoLeerArea = (actorActual.permisos ?? []).some(
          (p) => p.codigo === 'EXPEDIENTE_LEER' && (p.ambito === 'GLOBAL' || (p.ambito === 'AREA' && p.areaId === areaExpediente))
        );

        if (actorActual.unidadOrganicaId === areaExpediente && tienePermisoLeerArea) {
          return { rows: [{ autorizado: true }], rowCount: 1 };
        }

        return { rows: [{ autorizado: false }], rowCount: 1 };
      }

      // 3. Consulta de detalle de expediente (rutadoc.repository.ts)
      if (sql.includes('FROM sigd_tra.expediente e') && sql.includes('COALESCE(ultimo.estado_nuevo, \'REGISTRADO\') AS estado_actual')) {
        return {
          rows: [{
            id_expediente: EXPEDIENTE_ID,
            cut: 'EXP-2026-000099',
            asunto: 'Trámite de titulación estudiantil',
            fecha_radicacion: new Date('2026-03-01T10:00:00Z'),
            estado_actual: 'EN_TRAMITE',
            area_actual_id: areaExpediente,
            solicitante_id: solicitanteExpediente,
            id_movimiento: '60000000-0000-4000-8000-000000000001',
            evento: 'RECEPCION',
            fecha_hora: new Date('2026-03-01T11:00:00Z'),
            usuario_operador_id: USUARIO_COORDINADOR_AREA,
          }],
          rowCount: 1,
        };
      }

      // 4. Folios / adjuntos / integridad
      if (sql.includes('expediente_documento_folio')) return { rows: [{ cantidad: 1, total: 5 }], rowCount: 1 };
      if (sql.includes('documento_adjunto')) return { rows: [], rowCount: 0 };
      if (sql.includes('AS inconsistente')) return { rows: [{ inconsistente: false }], rowCount: 1 };

      // 5. Consultas de evaluadores (evaluadores.service.ts)
      if (sql.includes('FROM sigd_rut.expediente_evaluador ee')) {
        queryEvaluadoresLlamada = true;
        if (sql.includes('ee.activo = TRUE')) {
          return {
            rowCount: 1,
            rows: [{
              id_asignacion: '70000000-0000-4000-8000-000000000001',
              id_usuario_docente: evaluadorDocenteId,
              docente_nombre: 'Ing. Docente Evaluador',
              docente_email: 'docente@iestpsuiza.edu.pe',
              area_id: areaExpediente,
              area_nombre: 'Área Académica',
              asignado_por: USUARIO_COORDINADOR_AREA,
              asignador_nombre: 'Coordinador Área',
              motivo_asignacion: 'Designación de jurado calificador',
              es_reasignacion: false,
              justificacion_reasignacion: null,
              asignado_en: new Date('2026-03-01T12:00:00Z'),
              estado_evaluacion: 'PENDIENTE',
              observaciones: null,
            }],
          };
        }
        // Historial completo
        return {
          rowCount: 1,
          rows: [{
            id_asignacion: '70000000-0000-4000-8000-000000000001',
            id_usuario_docente: evaluadorDocenteId,
            docente_nombre: 'Ing. Docente Evaluador',
            docente_email: 'docente@iestpsuiza.edu.pe',
            area_id: areaExpediente,
            area_nombre: 'Área Académica',
            asignado_por: USUARIO_COORDINADOR_AREA,
            asignador_nombre: 'Coordinador Área',
            motivo_asignacion: 'Designación de jurado calificador',
            es_reasignacion: false,
            justificacion_reasignacion: null,
            asignado_en: new Date('2026-03-01T12:00:00Z'),
            estado_evaluacion: 'PENDIENTE',
            observaciones: null,
            activo: true,
            desactivado_por: null,
            desactivador_nombre: null,
            desactivado_en: null,
            motivo_desasignacion: null,
          }],
        };
      }

      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(async () => ({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    })),
  } as unknown as Pool;

  const app = construirApp(pool);
  return {
    app,
    pool,
    getEvaluadoresLlamada: () => queryEvaluadoresLlamada,
  };
}

describe('R2: Endurecimiento de Autorización Contextual (ESTUDIANTE y Evaluadores)', () => {

  describe('5.2. Escenarios de autorización contextual por rol', () => {

    it('[R2-01] Estudiante consulta su propio expediente (titularidad) -> Permitido (200)', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_ESTUDIANTE_TITULAR,
        personaId: PERSONA_ESTUDIANTE_TITULAR,
        roles: ['ESTUDIANTE'],
        unidadOrganicaId: null,
      };

      const { app } = crearAppEvaluadores(actor, {
        expedienteSolicitanteId: PERSONA_ESTUDIANTE_TITULAR,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_ESTUDIANTE_TITULAR, roles: ['ESTUDIANTE'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cut).toBe('EXP-2026-000099');
    });

    it('[R2-02] Estudiante consulta expediente ajeno -> Denegado (403 Forbidden)', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_ESTUDIANTE_AJENO,
        personaId: PERSONA_ESTUDIANTE_AJENO,
        roles: ['ESTUDIANTE'],
        unidadOrganicaId: null,
      };

      const { app } = crearAppEvaluadores(actor, {
        expedienteSolicitanteId: PERSONA_ESTUDIANTE_TITULAR, // Solicitante ajeno
      });

      const token = firmarTokenAcceso({ sub: USUARIO_ESTUDIANTE_AJENO, roles: ['ESTUDIANTE'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('[R2-03] Estudiante con area_id IS NULL intenta lectura global de expediente ajeno -> Denegado (403 Forbidden)', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_ESTUDIANTE_AJENO,
        personaId: PERSONA_ESTUDIANTE_AJENO,
        roles: ['ESTUDIANTE'],
        unidadOrganicaId: null,
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null }],
      };

      const { app } = crearAppEvaluadores(actor, {
        expedienteSolicitanteId: PERSONA_ESTUDIANTE_TITULAR,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_ESTUDIANTE_AJENO, roles: ['ESTUDIANTE'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('[R2-04] Ciudadano consulta su propio expediente (titularidad) -> Permitido (200)', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_CIUDADANO_TITULAR,
        personaId: PERSONA_CIUDADANO_TITULAR,
        roles: ['CIUDADANO'],
        unidadOrganicaId: null,
      };

      const { app } = crearAppEvaluadores(actor, {
        expedienteSolicitanteId: PERSONA_CIUDADANO_TITULAR,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_CIUDADANO_TITULAR, roles: ['CIUDADANO'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('[R2-05] Ciudadano consulta expediente ajeno -> Denegado (403 Forbidden)', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_CIUDADANO_AJENO,
        personaId: PERSONA_CIUDADANO_AJENO,
        roles: ['CIUDADANO'],
        unidadOrganicaId: null,
      };

      const { app } = crearAppEvaluadores(actor, {
        expedienteSolicitanteId: PERSONA_CIUDADANO_TITULAR,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_CIUDADANO_AJENO, roles: ['CIUDADANO'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('[R2-06] Docente consulta expediente donde está asignado como evaluador -> Permitido (200)', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_DOCENTE_ASIGNADO,
        personaId: '20000000-0000-4000-8000-000000000005',
        roles: ['DOCENTE'],
        unidadOrganicaId: AREA_ACADEMICA,
      };

      const { app } = crearAppEvaluadores(actor, {
        expedienteSolicitanteId: PERSONA_ESTUDIANTE_TITULAR,
        docenteAsignadoId: USUARIO_DOCENTE_ASIGNADO,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_DOCENTE_ASIGNADO, roles: ['DOCENTE'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('[R2-07] Docente consulta expediente donde NO está asignado -> Denegado (403 Forbidden)', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_DOCENTE_NO_ASIGN,
        personaId: '20000000-0000-4000-8000-000000000006',
        roles: ['DOCENTE'],
        unidadOrganicaId: AREA_ACADEMICA,
      };

      const { app } = crearAppEvaluadores(actor, {
        expedienteSolicitanteId: PERSONA_ESTUDIANTE_TITULAR,
        docenteAsignadoId: USUARIO_DOCENTE_ASIGNADO, // Asignado a otro docente
      });

      const token = firmarTokenAcceso({ sub: USUARIO_DOCENTE_NO_ASIGN, roles: ['DOCENTE'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('[R2-08] Coordinador consulta expediente de su propia área académica -> Permitido (200)', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_COORDINADOR_AREA,
        personaId: '20000000-0000-4000-8000-000000000007',
        roles: ['COORDINADOR_AREA'],
        unidadOrganicaId: AREA_ACADEMICA,
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_ACADEMICA }],
      };

      const { app } = crearAppEvaluadores(actor, {
        expedienteAreaActualId: AREA_ACADEMICA,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_COORDINADOR_AREA, roles: ['COORDINADOR_AREA'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('[R2-09] Coordinador consulta expediente de otra área institucional -> Denegado (403 Forbidden)', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_COORDINADOR_OTRA,
        personaId: '20000000-0000-4000-8000-000000000008',
        roles: ['COORDINADOR_AREA'],
        unidadOrganicaId: AREA_OTRA,
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_OTRA }],
      };

      const { app } = crearAppEvaluadores(actor, {
        expedienteAreaActualId: AREA_ACADEMICA, // Expediente está en Área Académica
      });

      const token = firmarTokenAcceso({ sub: USUARIO_COORDINADOR_OTRA, roles: ['COORDINADOR_AREA'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

  });

  describe('5.3. Endpoints GET de evaluadores con verificación de visibilidad contextual', () => {

    it('[R2-10] GET /:id/evaluador-activo: Actor autorizado (Coordinador) -> 200 OK con datos', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_COORDINADOR_AREA,
        personaId: '20000000-0000-4000-8000-000000000007',
        roles: ['COORDINADOR_AREA'],
        unidadOrganicaId: AREA_ACADEMICA,
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_ACADEMICA }],
      };

      const { app, getEvaluadoresLlamada } = crearAppEvaluadores(actor, {
        expedienteAreaActualId: AREA_ACADEMICA,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_COORDINADOR_AREA, roles: ['COORDINADOR_AREA'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}/evaluador-activo`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.evaluador.idUsuarioDocente).toBe(USUARIO_DOCENTE_ASIGNADO);
      expect(getEvaluadoresLlamada()).toBe(true);
    });

    it('[R2-11] GET /:id/evaluador-activo: Estudiante ajeno autenticado sin visibilidad -> HTTP 403 y NO consulta evaluador', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_ESTUDIANTE_AJENO,
        personaId: PERSONA_ESTUDIANTE_AJENO,
        roles: ['ESTUDIANTE'],
        unidadOrganicaId: null,
      };

      const { app, getEvaluadoresLlamada } = crearAppEvaluadores(actor, {
        expedienteSolicitanteId: PERSONA_ESTUDIANTE_TITULAR,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_ESTUDIANTE_AJENO, roles: ['ESTUDIANTE'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}/evaluador-activo`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      // La verificación de autorización previa impidió la ejecución de la consulta a expediente_evaluador
      expect(getEvaluadoresLlamada()).toBe(false);
    });

    it('[R2-12] GET /:id/evaluador-activo: Ciudadano ajeno autenticado sin visibilidad -> HTTP 403 y NO consulta evaluador', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_CIUDADANO_AJENO,
        personaId: PERSONA_CIUDADANO_AJENO,
        roles: ['CIUDADANO'],
        unidadOrganicaId: null,
      };

      const { app, getEvaluadoresLlamada } = crearAppEvaluadores(actor, {
        expedienteSolicitanteId: PERSONA_CIUDADANO_TITULAR,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_CIUDADANO_AJENO, roles: ['CIUDADANO'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}/evaluador-activo`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(getEvaluadoresLlamada()).toBe(false);
    });

    it('[R2-13] GET /:id/evaluadores (historial): Actor autorizado (Coordinador) -> 200 OK con historial', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_COORDINADOR_AREA,
        personaId: '20000000-0000-4000-8000-000000000007',
        roles: ['COORDINADOR_AREA'],
        unidadOrganicaId: AREA_ACADEMICA,
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_ACADEMICA }],
      };

      const { app, getEvaluadoresLlamada } = crearAppEvaluadores(actor, {
        expedienteAreaActualId: AREA_ACADEMICA,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_COORDINADOR_AREA, roles: ['COORDINADOR_AREA'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}/evaluadores`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.total).toBe(1);
      expect(Array.isArray(res.body.historial)).toBe(true);
      expect(getEvaluadoresLlamada()).toBe(true);
    });

    it('[R2-14] GET /:id/evaluadores (historial): Usuario de otra área sin visibilidad -> HTTP 403 y NO consulta historial', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_COORDINADOR_OTRA,
        personaId: '20000000-0000-4000-8000-000000000008',
        roles: ['COORDINADOR_AREA'],
        unidadOrganicaId: AREA_OTRA,
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_OTRA }],
      };

      const { app, getEvaluadoresLlamada } = crearAppEvaluadores(actor, {
        expedienteAreaActualId: AREA_ACADEMICA,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_COORDINADOR_OTRA, roles: ['COORDINADOR_AREA'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}/evaluadores`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(getEvaluadoresLlamada()).toBe(false);
    });

    it('[R2-15] Solicitud sin autenticación (401 Unauthorized)', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_COORDINADOR_AREA,
        personaId: '20000000-0000-4000-8000-000000000007',
        roles: ['COORDINADOR_AREA'],
      };

      const { app, getEvaluadoresLlamada } = crearAppEvaluadores(actor);

      const resActivo = await request(app).get(`/api/v1/expedientes/${EXPEDIENTE_ID}/evaluador-activo`);
      expect(resActivo.status).toBe(401);

      const resHistorial = await request(app).get(`/api/v1/expedientes/${EXPEDIENTE_ID}/evaluadores`);
      expect(resHistorial.status).toBe(401);

      expect(getEvaluadoresLlamada()).toBe(false);
    });

    it('[R2-16] Identificador no UUID es rechazado con 400 antes de autorización o SQL', async () => {
      const actor: ContextoActor = {
        usuarioId: USUARIO_COORDINADOR_AREA,
        personaId: '20000000-0000-4000-8000-000000000007',
        roles: ['COORDINADOR_AREA'],
      };

      const { app, getEvaluadoresLlamada } = crearAppEvaluadores(actor);
      const token = firmarTokenAcceso({ sub: USUARIO_COORDINADOR_AREA, roles: ['COORDINADOR_AREA'] });

      const res = await request(app)
        .get('/api/v1/expedientes/identificador-invalido-123/evaluador-activo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(getEvaluadoresLlamada()).toBe(false);
    });

  });

});

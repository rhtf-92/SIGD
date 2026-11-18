import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Pool, PoolClient } from 'pg';
import { crearRouterDerivaciones } from '../../../../src/domains/rutadoc/derivaciones.controller.js';
import { evaluarCapacidadesExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { RepositorioPostgresRutaDoc, SQL_LISTAR_RUTADOC } from '../../../../src/domains/rutadoc/rutadoc.repository.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import { runWithContext } from '../../../../src/shared/request-context/request-context.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { crearJwtActorProvider } from '../../../../src/domains/rutadoc/rutadoc.actor-provider.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

describe('Coherencia Integral de Autorización, Custodia, Asignación y Capacidades (/resumen + HTTP)', () => {
  const ID_EXPEDIENTE = '11111111-1111-4111-8111-111111111111';
  const AREA_SDA = 'a0000000-0000-0000-0000-000000000001';
  const AREA_DIR = 'a0000000-0000-0000-0000-000000000002';
  const AREA_OTRA = 'a0000000-0000-0000-0000-000000000099';

  const USER_TITULAR = '10000000-0000-4000-8000-000000000001';
  const PERSONA_TITULAR = '20000000-0000-4000-8000-000000000001';
  const USER_DIRECTOR = '10000000-0000-4000-8000-000000000002';
  const PERSONA_DIRECTOR = '20000000-0000-4000-8000-000000000002';
  const USER_SECRETARIO_SDA = '10000000-0000-4000-8000-000000000003';
  const PERSONA_SECRETARIO_SDA = '20000000-0000-4000-8000-000000000003';
  const USER_ESPECIALISTA_SDA = '10000000-0000-4000-8000-000000000004';
  const PERSONA_ESPECIALISTA_SDA = '20000000-0000-4000-8000-000000000004';
  const USER_OTRO_ESPECIALISTA = '10000000-0000-4000-8000-000000000005';
  const PERSONA_OTRO_ESPECIALISTA = '20000000-0000-4000-8000-000000000005';
  const USER_ADMIN = '10000000-0000-4000-8000-000000000006';
  const USER_TESORERIA = '10000000-0000-4000-8000-000000000007';

  let estadoActual = 'EN_REVISION';
  let areaActualId = AREA_SDA;
  let usuarioAsignadoId: string | null = null;
  let personaAsignadaId: string | null = null;
  let dictamenCompletado = false;
  let requiereTecnica = true;
  let tracker = { begins: 0, commits: 0, mutaciones: 0 };

  beforeEach(() => {
    estadoActual = 'EN_REVISION';
    areaActualId = AREA_SDA;
    usuarioAsignadoId = null;
    personaAsignadaId = null;
    dictamenCompletado = false;
    requiereTecnica = true;
    tracker = { begins: 0, commits: 0, mutaciones: 0 };
  });

  const usersMeta: Record<string, { idPersona: string | null; areaId: string | null }> = {
    [USER_TITULAR]: { idPersona: PERSONA_TITULAR, areaId: null },
    [USER_DIRECTOR]: { idPersona: PERSONA_DIRECTOR, areaId: AREA_DIR },
    [USER_SECRETARIO_SDA]: { idPersona: PERSONA_SECRETARIO_SDA, areaId: AREA_SDA },
    [USER_ESPECIALISTA_SDA]: { idPersona: PERSONA_ESPECIALISTA_SDA, areaId: AREA_SDA },
    [USER_OTRO_ESPECIALISTA]: { idPersona: PERSONA_OTRO_ESPECIALISTA, areaId: AREA_OTRA },
    [USER_ADMIN]: { idPersona: '20000000-0000-4000-8000-000000000006', areaId: AREA_DIR },
    [USER_TESORERIA]: { idPersona: '20000000-0000-4000-8000-000000000007', areaId: AREA_DIR },
  };

  function handleQuery(sql: string, params?: unknown[]) {
    const s = String(sql);
    if (s.trim().toUpperCase() === 'BEGIN') {
      tracker.begins += 1;
      return { rowCount: 1, rows: [] };
    }
    if (s.trim().toUpperCase() === 'COMMIT') {
      tracker.commits += 1;
      return { rowCount: 1, rows: [] };
    }
    if (s.trim().toUpperCase() === 'ROLLBACK' || s.includes('pg_advisory_xact_lock')) {
      return { rowCount: 1, rows: [] };
    }

    if (s.includes('sigd_auth.cuenta_usuario')) {
      const uid = String(params?.[0] ?? '');
      const u = usersMeta[uid];
      return u ? { rowCount: 1, rows: [{ id_persona: u.idPersona, area_id: u.areaId }] } : { rowCount: 0, rows: [] };
    }

    if (s.includes('sigd_org.usuario_rol')) {
      return { rowCount: 0, rows: [] };
    }

    if (s.includes('sigd_org.responsabilidad_temporal')) {
      return { rowCount: 0, rows: [] };
    }

    if (s.includes('sigd_rut.expediente_asignacion')) {
      if (usuarioAsignadoId) {
        return {
          rowCount: 1,
          rows: [{ id_usuario: usuarioAsignadoId, id_persona: personaAsignadaId }],
        };
      }
      return { rowCount: 0, rows: [] };
    }

    if (s.includes('sigd_tra.expediente') && s.includes('solicitante_id')) {
      return {
        rowCount: 1,
        rows: [{
          expediente_id: ID_EXPEDIENTE,
          solicitante_id: PERSONA_TITULAR,
          estado_actual_id: estadoActual,
          estado_actual: estadoActual,
          area_contexto_id: areaActualId,
          area_actual_id: areaActualId,
          codigo_expediente: 'EXP-2026-000888',
          unidad_responsable_id: requiereTecnica ? AREA_SDA : AREA_DIR,
          unidad_resolutiva_id: AREA_DIR,
        }],
      };
    }

    if (s.includes('sigd_doc.expediente_tupa_vinculo')) {
      return {
        rowCount: 1,
        rows: [{
          registro_version_id: 'reg-ver-1',
          id_procedimiento: 'proc-1',
          unidad_responsable_id: requiereTecnica ? AREA_SDA : AREA_DIR,
          unidad_resolutiva_id: AREA_DIR,
          monto_efectivo: '0',
          monto_proc: '0',
          intervencion_financiera: 'NO_APLICA',
        }],
      };
    }

    if (s.includes('sigd_rut.workflow_instancia')) {
      if (dictamenCompletado) {
        return {
          rowCount: 1,
          rows: [{
            paso_actual: 4,
            tiene_asignacion: Boolean(usuarioAsignadoId),
            historial_pasos: [{ evento: 'ATENCION_TECNICA' }],
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    }

    if (s.includes('INSERT INTO sigd_rut.movimiento_tramite') || s.includes('UPDATE sigd_tra.expediente')) {
      tracker.mutaciones += 1;
      return { rowCount: 1, rows: [{ movimiento_id: 'mov-test-1' }] };
    }

    if (s.includes('INSERT INTO') || s.includes('UPDATE ') || s.includes('SELECT sigd_tra.acumular_expediente')) {
      tracker.mutaciones += 1;
      return { rowCount: 1, rows: [{ id_acumulacion: 'acum-1' }] };
    }

    return { rowCount: 0, rows: [] };
  }

  const fakePool = {
    query: async (sql: string, params?: unknown[]) => handleQuery(sql, params),
    connect: async () => ({
      query: async (sql: string, params?: unknown[]) => handleQuery(sql, params),
      release: () => {},
    } as unknown as PoolClient),
  } as unknown as Pool;

  function buildApp() {
    process.env.AUTH_JWT_SECRET =
      process.env.AUTH_JWT_SECRET || 'unit-test-secret-not-for-production-min32chars';

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      let uid = 'anon';
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        try {
          const payload = JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64').toString('utf8'));
          uid = payload.sub || uid;
        } catch {
          // ignore
        }
      }
      runWithContext(
        { correlation_id: 'corr-coherencia', usuario_id: uid, ip_origen: '127.0.0.1', user_agent: 'vitest' },
        () => next(),
      );
    });
    app.use('/api/v1/expedientes', crearRouterDerivaciones(fakePool, crearJwtActorProvider(fakePool)));
    app.use(errorMiddleware);
    return app;
  }

  it('contexto PERSONAL e intento directo sin custodia o con admin técnico nunca mutan BD (403)', async () => {
    const app = buildApp();
    const tokDirector = firmarTokenAcceso({ sub: USER_DIRECTOR, roles: ['DIRECTOR'] });
    const tokOtraArea = firmarTokenAcceso({ sub: USER_OTRO_ESPECIALISTA, roles: ['SECRETARIO'] });
    const tokAdmin = firmarTokenAcceso({ sub: USER_ADMIN, roles: ['ADMINISTRADOR'] });
    const tokTesoreria = firmarTokenAcceso({ sub: USER_TESORERIA, roles: ['TESORERIA'] });

    // Director en contexto PERSONAL intentando acciones
    const rPersonal = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
      .set('Authorization', `Bearer ${tokDirector}`)
      .set('X-Contexto-Operacion', 'PERSONAL')
      .send({ motivo: 'Intento desde contexto personal' });
    expect(rPersonal.status).toBe(403);
    expect(rPersonal.body.code).toBe('CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES');

    // Director sin custodia en SDA tampoco puede observar ni iniciar revisión ni enviar a firma ni archivar
    const rDirObs = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/observar`)
      .set('Authorization', `Bearer ${tokDirector}`)
      .send({ motivo: 'Sin custodia en SDA' });
    expect(rDirObs.status).toBe(403);
    expect(rDirObs.body.code).toBe('BOLA_VIOLATION_CUSTODIA_AJENA');

    const rOtraArea = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/derivar`)
      .set('Authorization', `Bearer ${tokOtraArea}`)
      .send({ destinos: [{ area_destino_id: AREA_DIR, es_copia: false }], proveido: 'Custodia ajena' });
    expect(rOtraArea.status).toBe(403);
    expect(rOtraArea.body.code).toBe('BOLA_VIOLATION_CUSTODIA_AJENA');

    // Admin técnico bloqueado en resolver, archivar, enviar-a-firma y atender
    for (const [ruta, body, expectedCode] of [
      [`/api/v1/expedientes/${ID_EXPEDIENTE}/enviar-a-firma`, { resultado_resumen: 'x' }, 'PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO'],
      [`/api/v1/expedientes/${ID_EXPEDIENTE}/resolver`, { resultado_resumen: 'x' }, 'SIN_FACULTAD_RESOLUTIVA'],
      [`/api/v1/expedientes/${ID_EXPEDIENTE}/archivar`, { estante: 'A', balda: '1', caja: '1' }, 'PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO'],
      [`/api/v1/expedientes/${ID_EXPEDIENTE}/atender`, { resultado_resumen: 'x' }, 'PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO'],
    ] as const) {
      const rAdmin = await request(app)
        .post(ruta)
        .set('Authorization', `Bearer ${tokAdmin}`)
        .send(body);
      expect(rAdmin.status).toBe(403);
      expect(rAdmin.body.code).toBe(expectedCode);
    }

    // Tesorería bloqueada en tramitación documental
    const rTes = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/derivar`)
      .set('Authorization', `Bearer ${tokTesoreria}`)
      .send({ destinos: [{ area_destino_id: AREA_DIR, es_copia: false }], proveido: 'Derivar' });
    expect(rTes.status).toBe(403);
    expect(rTes.body.code).toBe('ROL_FINANCIERO_SIN_FACULTAD_DERIVAR');

    expect(tracker.mutaciones).toBe(0);
  });

  it('evaluarCapacidadesExpediente refleja exactamente custodia, asignación, TUPA técnico y estado FSM', async () => {
    const pre = {
      elegibilidad: {
        puedeDerivar: true,
        requisitosConformes: true,
        pagoConforme: true,
        bloqueos: [],
        totalRequisitosDocumentalesObligatorios: 0,
        totalRequisitosDocumentalesConformes: 0,
        montoRequerido: 0,
        pagoRegistrado: false,
      },
      etapaTecnica: {
        requiereEvaluacionTecnica: true,
        tieneAsignacion: false,
        tieneDictamenTecnico: false,
        completada: false,
        areaActualId: AREA_SDA,
        areaResponsableId: AREA_SDA,
        areaResolutivaId: AREA_DIR,
      },
    };

    // 1. Especialista SDA sin asignación ni perfil EXPEDIENTE_DERIVAR -> Atender visible=true habilitado=false, Derivar y Enviar a Firma ocultos
    const actorEsp: ActorRutaDoc = {
      id: USER_ESPECIALISTA_SDA,
      idPersona: PERSONA_ESPECIALISTA_SDA,
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: AREA_SDA,
    };
    const capSinAsig = await evaluarCapacidadesExpediente(fakePool, ID_EXPEDIENTE, actorEsp, 'INSTITUCIONAL', pre);
    expect(capSinAsig.atender.visible).toBe(true);
    expect(capSinAsig.atender.habilitado).toBe(false);
    expect(capSinAsig.atender.codigo).toBe('EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA');
    expect(capSinAsig.derivar.visible).toBe(false);
    expect(capSinAsig.derivar.habilitado).toBe(false);
    expect(capSinAsig.derivar.codigo).toBe('SIN_FACULTAD_DERIVACION');
    expect(capSinAsig.enviarAFirma.visible).toBe(false);
    expect(capSinAsig.asignar.visible).toBe(false);
    expect(capSinAsig.resolver.visible).toBe(false);

    // 1b. Especialista con perfil operativo EXPEDIENTE_DERIVAR en SDA sí ve Derivar habilitado en SDA y bloqueado por custodia en DIR
    const poolConPerfilDerivar = {
      ...fakePool,
      query: async (sql: string, params?: unknown[]) => {
        if (String(sql).includes('asignacion_perfil_operativo') && String(sql).includes('EXPEDIENTE_DERIVAR')) {
          return { rowCount: 1, rows: [{ '?column?': 1 }] };
        }
        return handleQuery(sql, params);
      },
    } as unknown as Pool;
    const capEspConPerfil = await evaluarCapacidadesExpediente(poolConPerfilDerivar, ID_EXPEDIENTE, actorEsp, 'INSTITUCIONAL', pre);
    expect(capEspConPerfil.derivar.visible).toBe(true);
    expect(capEspConPerfil.derivar.habilitado).toBe(true);

    // 2. Especialista SDA con asignación activa -> Atender habilitado=true
    usuarioAsignadoId = USER_ESPECIALISTA_SDA;
    personaAsignadaId = PERSONA_ESPECIALISTA_SDA;
    const capConAsig = await evaluarCapacidadesExpediente(fakePool, ID_EXPEDIENTE, actorEsp, 'INSTITUCIONAL', {
      ...pre,
      etapaTecnica: { ...pre.etapaTecnica, tieneAsignacion: true },
    });
    expect(capConAsig.atender.visible).toBe(true);
    expect(capConAsig.atender.habilitado).toBe(true);

    // 3. Cambio de custodia a DIR -> Especialista con perfil pierde custodia de Derivar; Atender también bloqueado
    areaActualId = AREA_DIR;
    const capCustodiaPerdida = await evaluarCapacidadesExpediente(poolConPerfilDerivar, ID_EXPEDIENTE, actorEsp, 'INSTITUCIONAL', pre);
    expect(capCustodiaPerdida.derivar.habilitado).toBe(false);
    expect(capCustodiaPerdida.derivar.codigo).toBe('BOLA_VIOLATION_CUSTODIA_AJENA');
    expect(capCustodiaPerdida.observar.habilitado).toBe(false);
    expect(capCustodiaPerdida.atender.habilitado).toBe(false);

    // 4. DIRECTOR en DIR con evaluación pendiente -> Atender oculto; Enviar a Firma y Resolver bloqueados; Derivar habilitado
    const actorDir: ActorRutaDoc = {
      id: USER_DIRECTOR,
      idPersona: PERSONA_DIRECTOR,
      roles: ['DIRECTOR'],
      unidadOrganicaId: AREA_DIR,
    };
    const capDirPendiente = await evaluarCapacidadesExpediente(fakePool, ID_EXPEDIENTE, actorDir, 'INSTITUCIONAL', pre);
    expect(capDirPendiente.atender.visible).toBe(false);
    expect(capDirPendiente.asignar.visible).toBe(false);
    expect(capDirPendiente.enviarAFirma.habilitado).toBe(false);
    expect(capDirPendiente.enviarAFirma.codigo).toBe('ATENCION_TECNICA_REQUERIDA');
    expect(capDirPendiente.resolver.habilitado).toBe(false);
    expect(capDirPendiente.derivar.habilitado).toBe(true);

    // 5. DIRECTOR en EN_FIRMA en DIR con dictamen completo -> Resolver habilitado=true
    estadoActual = 'EN_FIRMA';
    dictamenCompletado = true;
    const capDirFirma = await evaluarCapacidadesExpediente(fakePool, ID_EXPEDIENTE, actorDir, 'INSTITUCIONAL', {
      ...pre,
      etapaTecnica: {
        ...pre.etapaTecnica,
        tieneAsignacion: true,
        tieneDictamenTecnico: true,
        completada: true,
      },
    });
    expect(capDirFirma.resolver.visible).toBe(true);
    expect(capDirFirma.resolver.habilitado).toBe(true);

    // 6. En contexto PERSONAL todo está restringido sin abrir facultades institucionales
    const capPersonal = await evaluarCapacidadesExpediente(fakePool, ID_EXPEDIENTE, actorDir, 'PERSONAL', pre);
    expect(capPersonal.derivar.habilitado).toBe(false);
    expect(capPersonal.derivar.codigo).toBe('CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES');
    expect(capPersonal.enviarAFirma.visible).toBe(false);
    expect(capPersonal.resolver.visible).toBe(false);
    expect(capPersonal.archivar.visible).toBe(false);
  });

  it('ESPECIALISTA sin perfil EXPEDIENTE_DERIVAR ni delegación DERIVACION recibe 403 SIN_FACULTAD_DERIVACION aun en su propia área', async () => {
    const app = buildApp();
    areaActualId = AREA_SDA;
    const tokEspSda = firmarTokenAcceso({ sub: USER_ESPECIALISTA_SDA, roles: ['ESPECIALISTA'] });

    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/derivar`)
      .set('Authorization', `Bearer ${tokEspSda}`)
      .send({
        destinos: [{ area_destino_id: AREA_DIR, es_copia: false }],
        proveido: 'Intento de derivar sin facultad ni delegación',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SIN_FACULTAD_DERIVACION');
    expect(tracker.mutaciones).toBe(0);
  });

  it('regresión estado canónico: lectura RutaDoc usa sigd_tra.expediente.estado cuando falta fila en estado_actual_expediente', async () => {
    expect(SQL_LISTAR_RUTADOC).toContain("COALESCE(ultimo.estado_nuevo, NULLIF(btrim(e.estado), ''), 'REGISTRADO')");

    const poolMockLectura = {
      query: async (sql: string) => {
        const s = String(sql);
        if (s.includes('FROM sigd_tra.expediente e') && s.includes('NULLIF(btrim(e.estado)')) {
          return {
            rowCount: 1,
            rows: [{
              id_expediente: ID_EXPEDIENTE,
              cut: 'EXP-2026-976952',
              asunto: 'Trámite sin proyección en rutadoc',
              fecha_radicacion: new Date('2026-11-10T10:00:00Z'),
              estado_actual: 'EN_REVISION',
              area_actual_id: AREA_SDA,
              area_actual_nombre: 'Subdirección Académica',
              area_actual_codigo: 'SDA',
              persona_asignada_id: null,
              usuario_asignado_id: null,
              solicitante_id: PERSONA_TITULAR,
              id_movimiento: null,
              evento: null,
              fecha_hora: null,
              usuario_operador_id: null,
            }],
          };
        }
        return { rowCount: 0, rows: [{ existe: null }] };
      },
    } as unknown as Pool;

    const repo = new RepositorioPostgresRutaDoc(poolMockLectura);
    const detalle = await repo.obtener(ID_EXPEDIENTE);
    expect(detalle).not.toBeNull();
    expect(detalle?.estadoActual).toBe('EN_REVISION');
    expect(detalle?.areaActualId).toBe(AREA_SDA);
  });
});

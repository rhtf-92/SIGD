import { describe, it, expect, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import express from 'express';
import { EventEmitter } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import {
  ESTADOS_FLUJO_CERTIFICADO,
  ESTADOS_TERMINALES_FLUJO_CERTIFICADO,
  EVENTOS_FLUJO_CERTIFICADO,
  MAPEO_ESTADO_FLUJO_A_RUTADOC,
  ROLES_AUTORIZADOS_FLUJO_CERTIFICADO,
  TRANSICIONES_FLUJO_CERTIFICADO,
  FlujoRolNoAutorizadoError,
  FlujoTransicionInvalidaError,
  esEstadoFlujoCertificado,
  esEstadoTerminalFlujoCertificado,
  esEventoFlujoCertificado,
  obtenerDefinicionMaquinaEstadosFlujoCertificado,
  obtenerSiguienteEstadoFlujoCertificado,
  puedeTransicionarFlujoCertificado,
  validarRolAutorizadoFlujoCertificado,
} from '../../../../src/domains/rutadoc/flujoCertificado.fsm.js';
import { TRANSICIONES_RUTADOC, type EstadoRutaDoc, type EventoRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.fsm.js';
import { crearRouterDerivaciones } from '../../../../src/domains/rutadoc/derivaciones.controller.js';
import { AREA_DIR_ID, AREA_SDA_ID } from '../../../../src/domains/rutadoc/flujoCertificado.service.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import { contextMiddleware } from '../../../../src/middleware/context-middleware.js';

interface FakeDbState {
  expedientes: Map<
    string,
    {
      expediente_id: string;
      codigo_expediente: string;
      solicitante_id: string;
      id_usuario_creador: string | null;
      estado: string;
      area_destino_id: string | null;
    }
  >;
  estadoActual: Map<
    string,
    {
      expediente_id: string;
      secuencia: number;
      estado_nuevo: string;
      evento: string;
      area_actual_id: string | null;
      id_movimiento: string;
      persona_asignada_id: string | null;
      usuario_asignado_id: string | null;
    }
  >;
  movimientos: Array<{
    id_movimiento: string;
    expediente_id: string;
    secuencia: number;
    estado_anterior: string;
    evento: string;
    estado_nuevo: string;
    datos: Record<string, unknown>;
  }>;
  flujos: Map<string, Record<string, any>>;
  historiales: Array<Record<string, any>>;
  asignaciones: Array<Record<string, any>>;
  documentos: Map<string, Record<string, any>>;
  firmas: Map<string, Record<string, any>>;
  outbox: Array<{ tipo_evento: string; payload: Record<string, unknown> }>;
  cuentas: Map<string, { id_usuario: string; id_persona: string; activo: boolean }>;
  pagoPendiente: Set<string>;
}

function crearFakeDb(): { pool: Pool; state: FakeDbState } {
  const EXP_DEFAULT_ID = '11111111-1111-4111-8111-111111111111';
  const PERSONA_CIUDADANO = '22222222-2222-4222-8222-222222222222';
  const USER_CIUDADANO = '33333333-3333-4333-8333-333333333333';
  const PERSONA_ESPECIALISTA = '44444444-4444-4444-8444-444444444444';
  const USER_ESPECIALISTA = '55555555-5555-4555-8555-555555555555';
  const PERSONA_OTRO_ESP = '66666666-6666-4666-8666-666666666666';
  const USER_OTRO_ESP = '77777777-7777-4777-8777-777777777777';

  const state: FakeDbState = {
    expedientes: new Map([
      [
        EXP_DEFAULT_ID,
        {
          expediente_id: EXP_DEFAULT_ID,
          codigo_expediente: 'EXP-2026-000101',
          solicitante_id: PERSONA_CIUDADANO,
          id_usuario_creador: USER_CIUDADANO,
          estado: 'REGISTRADO',
          area_destino_id: AREA_DIR_ID,
        },
      ],
    ]),
    estadoActual: new Map([
      [
        EXP_DEFAULT_ID,
        {
          expediente_id: EXP_DEFAULT_ID,
          secuencia: 1,
          estado_nuevo: 'REGISTRADO',
          evento: 'RADICACION_DIGITAL_PUBLICA',
          area_actual_id: AREA_DIR_ID,
          id_movimiento: randomUUID(),
          persona_asignada_id: null,
          usuario_asignado_id: null,
        },
      ],
    ]),
    movimientos: [],
    flujos: new Map(),
    historiales: [],
    asignaciones: [],
    documentos: new Map(),
    firmas: new Map(),
    outbox: [],
    cuentas: new Map([
      [USER_CIUDADANO, { id_usuario: USER_CIUDADANO, id_persona: PERSONA_CIUDADANO, activo: true }],
      [USER_ESPECIALISTA, { id_usuario: USER_ESPECIALISTA, id_persona: PERSONA_ESPECIALISTA, activo: true }],
      [USER_OTRO_ESP, { id_usuario: USER_OTRO_ESP, id_persona: PERSONA_OTRO_ESP, activo: true }],
    ]),
    pagoPendiente: new Set(),
  };

  async function queryImpl(rawSql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const sql = rawSql.replace(/\s+/g, ' ').trim();

    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.includes('pg_advisory_xact_lock')) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes('FROM sigd_tra.expediente e LEFT JOIN sigd_rut.estado_actual_expediente u')) {
      const exp = state.expedientes.get(params[0]);
      if (!exp) return { rows: [], rowCount: 0 };
      const u = state.estadoActual.get(params[0]);
      return {
        rowCount: 1,
        rows: [
          {
            expediente_id: exp.expediente_id,
            codigo_expediente: exp.codigo_expediente,
            solicitante_id: exp.solicitante_id,
            id_usuario_creador: exp.id_usuario_creador,
            estado_actual: exp.estado === 'PENDIENTE_PAGO' ? 'PENDIENTE_PAGO' : u?.estado_nuevo ?? exp.estado,
            area_actual_id: u?.area_actual_id ?? exp.area_destino_id ?? '',
          },
        ],
      };
    }

    if (sql.startsWith('SELECT * FROM sigd_rut.expediente_flujo_certificado WHERE expediente_id =')) {
      const flujo = state.flujos.get(params[0]);
      return flujo ? { rows: [{ ...flujo }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (sql.startsWith('INSERT INTO sigd_rut.expediente_flujo_certificado')) {
      const ahora = new Date();
      const row: Record<string, any> = {
        id_flujo: randomUUID(),
        expediente_id: params[0],
        codigo_procedimiento: params[1],
        nombre_tramite: params[2],
        estado_flujo: 'SOLICITUD_INICIADA',
        canal_entrega: params[3],
        requisitos_validados: false,
        validado_mp_por: null,
        validado_mp_en: null,
        especialista_asignado_usuario_id: null,
        especialista_asignado_persona_id: null,
        derivado_especialista_por: null,
        derivado_especialista_en: null,
        fecha_evaluacion: null,
        modalidad_evaluacion: null,
        lugar_enlace_evaluacion: null,
        evaluacion_observaciones: null,
        evaluacion_programada_por: null,
        evaluacion_programada_en: null,
        asistencia_evaluacion: null,
        nota_evaluacion: null,
        nivel_mcer: null,
        resultado_evaluacion: null,
        calificacion_observaciones: null,
        calificado_por: null,
        calificado_en: null,
        numero_informe: null,
        tipo_informe: null,
        informe_resumen: null,
        informe_documento_id: null,
        informe_emitido_por: null,
        informe_emitido_en: null,
        codigo_certificado: null,
        sello_firma_sda: null,
        certificado_documento_id: null,
        certificado_emitido_por: null,
        certificado_emitido_en: null,
        visto_bueno_direccion: false,
        visto_bueno_por: null,
        visto_bueno_en: null,
        firma_digital_cvd: null,
        firma_digital_sha256: null,
        firma_digital_documento_id: null,
        firma_digital_s3_key: null,
        firmado_digital_por: null,
        firmado_digital_en: null,
        documento_valido: false,
        descarga_habilitada: false,
        notificado_en: null,
        plazo_recojo_dias: params[4],
        fecha_limite_recojo: null,
        fecha_entrega_presencial: null,
        entregado_a_dni: null,
        entregado_a_nombre: null,
        en_custodia: false,
        custodia_ubicacion: null,
        motivo_cierre: null,
        creado_en: ahora,
        actualizado_en: ahora,
        finalizado_en: null,
      };
      state.flujos.set(params[0], row);
      return { rows: [{ ...row }], rowCount: 1 };
    }

    if (sql.startsWith('UPDATE sigd_rut.expediente_flujo_certificado SET')) {
      const flujo = state.flujos.get(params[0]);
      if (!flujo) return { rows: [], rowCount: 0 };
      const setMatch = sql.match(/SET (.+?) WHERE expediente_id/);
      if (setMatch) {
        for (const asignacion of setMatch[1].split(',').map((s) => s.trim())) {
          if (asignacion === 'actualizado_en = now()') {
            flujo.actualizado_en = new Date();
            continue;
          }
          const m = asignacion.match(/^([a-z_]+)\s*=\s*\$(\d+)(?:::[a-z]+)?$/);
          if (m) {
            const col = m[1];
            const idx = Number(m[2]) - 1;
            let val = params[idx];
            if (asignacion.endsWith('::jsonb') && typeof val === 'string') {
              val = JSON.parse(val);
            }
            flujo[col] = val;
          }
        }
      }
      return { rows: [{ ...flujo }], rowCount: 1 };
    }

    if (sql.startsWith('INSERT INTO sigd_rut.expediente_flujo_historial')) {
      const prevSeq = state.historiales
        .filter((h) => h.expediente_id === params[0])
        .reduce((max, h) => Math.max(max, Number(h.secuencia)), 0);
      const row = {
        id_historial: randomUUID(),
        expediente_id: params[0],
        secuencia: prevSeq + 1,
        estado_anterior: params[1],
        evento: params[2],
        estado_nuevo: params[3],
        estado_rutadoc_anterior: params[4],
        estado_rutadoc_nuevo: params[5],
        rol_actor: params[6],
        usuario_actor_id: params[7],
        area_origen_id: params[8],
        area_destino_id: params[9],
        id_movimiento_rutadoc: params[10],
        detalle: params[11],
        metadatos: typeof params[12] === 'string' ? JSON.parse(params[12]) : params[12],
        creado_en: new Date(),
      };
      state.historiales.push(row);
      return { rows: [{ ...row }], rowCount: 1 };
    }

    if (sql.startsWith('SELECT * FROM sigd_rut.expediente_flujo_historial')) {
      const rows = state.historiales
        .filter((h) => h.expediente_id === params[0])
        .sort((a, b) => a.secuencia - b.secuencia);
      return { rows, rowCount: rows.length };
    }

    if (sql.startsWith('INSERT INTO sigd_rut.movimiento_tramite')) {
      const [expedienteId, estadoAnterior, evento, estadoNuevo, _opId, _claveIdem, datosStr] = params;
      const esperado = TRANSICIONES_RUTADOC[estadoAnterior as EstadoRutaDoc]?.[evento as EventoRutaDoc];
      if (esperado !== estadoNuevo) {
        throw new Error(`FK_MOVIMIENTO_TRANSICION_VIOLADA: ${estadoAnterior} + ${evento} -> ${estadoNuevo}`);
      }
      const idMov = randomUUID();
      const datos = typeof datosStr === 'string' ? JSON.parse(datosStr) : datosStr;
      const actual = state.estadoActual.get(expedienteId);
      const sec = (actual?.secuencia ?? 0) + 1;
      state.movimientos.push({
        id_movimiento: idMov,
        expediente_id: expedienteId,
        secuencia: sec,
        estado_anterior: estadoAnterior,
        evento,
        estado_nuevo: estadoNuevo,
        datos,
      });
      state.estadoActual.set(expedienteId, {
        expediente_id: expedienteId,
        secuencia: sec,
        estado_nuevo: estadoNuevo,
        evento,
        area_actual_id: (datos?.areaId as string | undefined) ?? actual?.area_actual_id ?? null,
        id_movimiento: idMov,
        persona_asignada_id: actual?.persona_asignada_id ?? null,
        usuario_asignado_id: actual?.usuario_asignado_id ?? null,
      });
      return { rows: [{ id_movimiento: idMov }], rowCount: 1 };
    }

    if (sql.startsWith('UPDATE sigd_tra.expediente SET estado =')) {
      const exp = state.expedientes.get(params[0]);
      if (!exp) return { rows: [], rowCount: 0 };
      const estadoMatch = sql.match(/estado = '([A-Z_]+)'/);
      if (estadoMatch) exp.estado = estadoMatch[1];
      if (params[1]) exp.area_destino_id = params[1];
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes('FROM sigd_doc.expediente_tupa_vinculo v')) {
      if (state.pagoPendiente.has(params[0])) {
        return {
          rowCount: 1,
          rows: [
            {
              registro_version_id: randomUUID(),
              id_procedimiento: randomUUID(),
              monto_efectivo: '100.00',
              monto_proc: '100.00',
              intervencion_financiera: 'REQUIERE_PAGO',
            },
          ],
        };
      }
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes('FROM sigd_doc.tupa_requisito_documental r')) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes('FROM sigd_tra.orden_pago')) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes('FROM areas_solicitadas s')) {
      return {
        rowCount: 1,
        rows: [
          {
            solicitadaId: AREA_SDA_ID,
            areaId: AREA_SDA_ID,
            nombre: 'Subdirección Académica',
            codigo: 'SDA',
            vigente: true,
            receptoresOperativos: 2,
          },
        ],
      };
    }

    if (sql.includes('SELECT id_persona::text AS id_persona FROM sigd_auth.cuenta_usuario')) {
      const c = state.cuentas.get(params[0]);
      return c ? { rows: [{ id_persona: c.id_persona }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (sql.includes('SELECT COALESCE(u.area_actual_id, e.area_destino_id::text) AS area_actual_id')) {
      const u = state.estadoActual.get(params[0]);
      const e = state.expedientes.get(params[0]);
      return e ? { rows: [{ area_actual_id: u?.area_actual_id ?? e.area_destino_id }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (sql.startsWith('SELECT id_persona FROM sigd_auth.persona WHERE id_persona =')) {
      return { rows: [{ id_persona: params[0] }], rowCount: 1 };
    }

    if (sql.startsWith('SELECT id_usuario, activo, id_persona FROM sigd_auth.cuenta_usuario')) {
      const c = state.cuentas.get(params[0]);
      return c ? { rows: [c], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (sql.includes('FROM sigd_auth.vinculo_institucional')) {
      return { rows: [{ id_vinculo: 'vinc-1' }], rowCount: 1 };
    }

    if (sql.includes('AS valida') && sql.includes('sigd_org.asignacion_personal')) {
      return { rows: [{ valida: true }], rowCount: 1 };
    }

    if (sql.startsWith('UPDATE sigd_rut.expediente_asignacion SET activo = false')) {
      for (const a of state.asignaciones) {
        if (a.expediente_id === params[0] && a.activo) a.activo = false;
      }
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith('INSERT INTO sigd_rut.expediente_asignacion')) {
      const asig = {
        id_asignacion: randomUUID(),
        expediente_id: params[0],
        id_persona: params[1],
        id_usuario: params[2],
        id_area: params[3],
        asignado_por: params[4],
        motivo: params[5],
        activo: true,
        asignado_en: new Date(),
        desasignado_en: null,
        desasignado_por: null,
        motivo_desasignacion: null,
        area_nombre: 'Subdirección Académica',
      };
      state.asignaciones.push(asig);
      return { rows: [asig], rowCount: 1 };
    }

    if (sql.startsWith('UPDATE sigd_rut.estado_actual_expediente SET persona_asignada_id =')) {
      const u = state.estadoActual.get(params[0]);
      if (u) {
        u.persona_asignada_id = params[1];
        u.usuario_asignado_id = params[2];
      }
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes('FROM sigd_rut.expediente_asignacion a')) {
      const act = state.asignaciones.find((a) => a.expediente_id === params[0] && a.activo);
      return act ? { rows: [act], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (sql.includes('FROM sigd_doc.tipo_documento')) {
      return { rows: [{ tipo_documental_id: '88888888-8888-4888-8888-888888888888' }], rowCount: 1 };
    }

    if (sql.startsWith('INSERT INTO sigd_doc.documento_adjunto')) {
      state.documentos.set(params[0], {
        documento_adjunto_id: params[0],
        expediente_tra_id: params[1],
        nombre_archivo: params[3],
        s3_bucket: params[4],
        s3_key: params[5],
        sha256: params[6],
        id_requisito: null,
      });
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith('SELECT id_requisito, s3_key FROM sigd_doc.documento_adjunto')) {
      const doc = state.documentos.get(params[0]);
      return doc ? { rows: [doc], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (sql.includes('FROM sigd_doc.firma_digital_documento f')) {
      const firma = [...state.firmas.values()].find((f) => f.expediente_id === params[0]);
      return firma ? { rows: [firma], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (sql.startsWith('INSERT INTO sigd_doc.firma_digital_documento')) {
      const doc = state.documentos.get(params[0]);
      state.firmas.set(params[0], {
        documento_id: params[0],
        expediente_id: doc?.expediente_tra_id ?? null,
        cvd: params[1],
        sha256_firmado: params[2],
        s3_key: params[4],
      });
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith('INSERT INTO sigd_audit.evento_outbox')) {
      state.outbox.push({
        tipo_evento: params[2],
        payload: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
      });
      return { rows: [{ id_evento: randomUUID() }], rowCount: 1 };
    }

    if (sql.includes('FROM sigd_rut.workflow_instancia') || sql.includes('FROM sigd_org.usuario_rol') || sql.includes('FROM sigd_org.responsabilidad_temporal')) {
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  }

  const client = {
    query: queryImpl,
    release: () => undefined,
  } as unknown as PoolClient;

  const pool = {
    query: queryImpl,
    connect: async () => client,
  } as unknown as Pool;

  return { pool, state };
}

function crearAppTest(pool: Pool, actorActual: () => ActorRutaDoc | null) {
  const app = express();
  app.use(express.json());
  app.use(contextMiddleware);
  app.use(
    '/api/v1/expedientes',
    crearRouterDerivaciones(pool, {
      obtenerActor: async () => actorActual(),
    }),
  );
  app.use(errorMiddleware);
  return app;
}

interface RespuestaEnMemoria {
  status: number;
  body: any;
  headers: Record<string, string>;
}

function ejecutarHttpEnMemoria(
  app: express.Express,
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
): Promise<RespuestaEnMemoria> {
  return new Promise((resolve, reject) => {
    const reqHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'vitest-in-memory',
    };
    const req: any = Object.assign(new EventEmitter(), {
      method,
      url,
      originalUrl: url,
      headers: reqHeaders,
      _body: true,
      body: body ?? {},
      socket: { remoteAddress: '127.0.0.1' },
      connection: { remoteAddress: '127.0.0.1' },
      get(nombre: string) {
        return reqHeaders[nombre.toLowerCase()];
      },
      header(nombre: string) {
        return reqHeaders[nombre.toLowerCase()];
      },
    });

    const resHeaders: Record<string, string> = {};
    let finalizado = false;
    const finalizar = (payload?: unknown) => {
      if (finalizado) return;
      finalizado = true;
      res.headersSent = true;
      resolve({ status: res.statusCode, body: payload, headers: resHeaders });
    };

    const res: any = Object.assign(new EventEmitter(), {
      statusCode: 200,
      headersSent: false,
      locals: {},
      setHeader(k: string, v: string | string[]) {
        resHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(',') : String(v);
      },
      getHeader(k: string) {
        return resHeaders[k.toLowerCase()];
      },
      removeHeader(k: string) {
        delete resHeaders[k.toLowerCase()];
      },
      set(k: string | Record<string, string>, v?: string) {
        if (typeof k === 'string' && v !== undefined) res.setHeader(k, v);
        else if (typeof k === 'object') Object.entries(k).forEach(([hk, hv]) => res.setHeader(hk, hv));
        return res;
      },
      header(k: string | Record<string, string>, v?: string) {
        return res.set(k, v);
      },
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(data: unknown) {
        finalizar(data);
        return res;
      },
      send(data: unknown) {
        if (typeof data === 'string') {
          try {
            finalizar(JSON.parse(data));
          } catch {
            finalizar(data);
          }
        } else {
          finalizar(data);
        }
        return res;
      },
      end(data?: unknown) {
        finalizar(data);
        return res;
      },
    });

    (app as unknown as (req: any, res: any, next: (err?: unknown) => void) => void)(req, res, (err?: unknown) => {
      if (err) reject(err);
      else if (!finalizado) finalizar(undefined);
    });
  });
}

function request(app: express.Express) {
  return {
    get(url: string) {
      return ejecutarHttpEnMemoria(app, 'GET', url);
    },
    post(url: string) {
      return {
        send(body?: unknown) {
          return ejecutarHttpEnMemoria(app, 'POST', url, body);
        },
      };
    },
  };
}

describe('Flujo Certificado de Inglés — Máquina de Estados y API Backend', () => {
  const EXP_ID = '11111111-1111-4111-8111-111111111111';
  const PERSONA_CIUDADANO = '22222222-2222-4222-8222-222222222222';
  const USER_CIUDADANO = '33333333-3333-4333-8333-333333333333';
  const PERSONA_ESPECIALISTA = '44444444-4444-4444-8444-444444444444';
  const USER_ESPECIALISTA = '55555555-5555-4555-8555-555555555555';
  const PERSONA_OTRO_ESP = '66666666-6666-4666-8666-666666666666';
  const USER_OTRO_ESP = '77777777-7777-4777-8777-777777777777';
  const USER_MESA_PARTES = '99999999-9999-4999-8999-999999999991';
  const USER_SECRETARIO_SDA = '99999999-9999-4999-8999-999999999992';
  const USER_DIRECTOR_DIR = '99999999-9999-4999-8999-999999999993';
  const USER_TESORERIA = '99999999-9999-4999-8999-999999999994';

  const ACTORES = {
    ciudadano: { id: USER_CIUDADANO, idPersona: PERSONA_CIUDADANO, roles: ['CIUDADANO'], unidadOrganicaId: null },
    mesaPartes: { id: USER_MESA_PARTES, roles: ['MESA_PARTES'], unidadOrganicaId: AREA_DIR_ID },
    secretarioSda: { id: USER_SECRETARIO_SDA, roles: ['SECRETARIO'], unidadOrganicaId: AREA_SDA_ID },
    especialistaIdiomas: {
      id: USER_ESPECIALISTA,
      idPersona: PERSONA_ESPECIALISTA,
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: AREA_SDA_ID,
    },
    otroEspecialista: {
      id: USER_OTRO_ESP,
      idPersona: PERSONA_OTRO_ESP,
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: AREA_SDA_ID,
    },
    director: { id: USER_DIRECTOR_DIR, roles: ['DIRECTOR'], unidadOrganicaId: AREA_DIR_ID },
    tesoreria: { id: USER_TESORERIA, roles: ['TESORERIA'], unidadOrganicaId: AREA_DIR_ID },
  } as const;

  let actorEnTurno: ActorRutaDoc | null = ACTORES.ciudadano;
  let fakeDb: ReturnType<typeof crearFakeDb>;
  let app: express.Express;

  beforeEach(() => {
    fakeDb = crearFakeDb();
    actorEnTurno = ACTORES.ciudadano;
    app = crearAppTest(fakeDb.pool, () => actorEnTurno);
  });

  // =========================================================================
  // 1. Pruebas Unitarias de Máquina de Estados Pura (FSM)
  // =========================================================================
  describe('FlujoCertificadoFSM', () => {
    it('define los 16 estados de negocio, 18 eventos, estados terminales y mapeo completo a RutaDoc', () => {
      expect(ESTADOS_FLUJO_CERTIFICADO).toHaveLength(16);
      expect(EVENTOS_FLUJO_CERTIFICADO).toHaveLength(18);
      expect(ESTADOS_TERMINALES_FLUJO_CERTIFICADO).toEqual([
        'ARCHIVADO_POR_INASISTENCIA',
        'ATENDIDO_NOTIFICADO',
        'ARCHIVADO_NO_RECOGIDO',
      ]);
      for (const estado of ESTADOS_FLUJO_CERTIFICADO) {
        expect(esEstadoFlujoCertificado(estado)).toBe(true);
        expect(MAPEO_ESTADO_FLUJO_A_RUTADOC[estado]).toBeDefined();
      }
      for (const evento of EVENTOS_FLUJO_CERTIFICADO) {
        expect(esEventoFlujoCertificado(evento)).toBe(true);
        expect(ROLES_AUTORIZADOS_FLUJO_CERTIFICADO[evento].length).toBeGreaterThan(0);
      }
      for (const terminal of ESTADOS_TERMINALES_FLUJO_CERTIFICADO) {
        expect(esEstadoTerminalFlujoCertificado(terminal)).toBe(true);
        expect(TRANSICIONES_FLUJO_CERTIFICADO[terminal]).toEqual({});
      }
      const def = obtenerDefinicionMaquinaEstadosFlujoCertificado();
      expect(def.extensible).toBe(true);
      expect(def.transiciones.length).toBeGreaterThanOrEqual(15);
    });

    it('rechaza saltos inválidos de estado y roles no autorizados', () => {
      expect(puedeTransicionarFlujoCertificado('SOLICITUD_INICIADA', 'VISAR_Y_FIRMAR_DIRECCION_DIGITAL')).toBe(false);
      expect(() =>
        obtenerSiguienteEstadoFlujoCertificado('SOLICITUD_INICIADA', 'EMITIR_Y_FIRMAR_CERTIFICADO_SDA'),
      ).toThrow(FlujoTransicionInvalidaError);

      expect(() => validarRolAutorizadoFlujoCertificado('VISAR_Y_FIRMAR_DIRECCION_DIGITAL', ['ESPECIALISTA'])).toThrow(
        FlujoRolNoAutorizadoError,
      );
      expect(() => validarRolAutorizadoFlujoCertificado('PROGRAMAR_EVALUACION', ['MESA_PARTES'])).toThrow(
        FlujoRolNoAutorizadoError,
      );
      expect(validarRolAutorizadoFlujoCertificado('DERIVAR_A_SUBDIRECCION', ['MESA_PARTES'])).toBe('MESA_PARTES');
    });
  });

  // =========================================================================
  // 2. Flujo Principal (Camino Feliz) — Canal Digital
  // =========================================================================
  it('ejecuta el Camino Feliz completo (Pasos 1 al 6) en Canal Digital hasta ATENDIDO_NOTIFICADO y habilita descarga PDF', async () => {
    // Paso 1: Ciudadano inicia solicitud de Certificado de Inglés
    actorEnTurno = ACTORES.ciudadano;
    const res1 = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/iniciar`)
      .send({ codigo_procedimiento: 'p1-fila-06', nombre_tramite: 'Certificado de Inglés', canal_entrega: 'DIGITAL' });
    expect(res1.status).toBe(201);
    expect(res1.body.estadoFlujoNuevo).toBe('SOLICITUD_INICIADA');

    // Paso 2a y 2b: Mesa de Partes valida requisitos y deriva a Subdirección Académica (SDA)
    actorEnTurno = ACTORES.mesaPartes;
    const res2a = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/mesa-partes/validar`)
      .send({ observaciones: 'Requisitos TUPA conformes' });
    expect(res2a.status).toBe(200);
    expect(res2a.body.estadoFlujoNuevo).toBe('VALIDADO_MESA_PARTES');
    expect(res2a.body.estadoRutaDoc).toBe('EN_CALIFICACION');

    const res2b = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/mesa-partes/derivar-sda`)
      .send({ proveido: 'Derivar a Subdirección Académica para evaluación de idiomas', requisitos_validados: true });
    expect(res2b.status).toBe(200);
    expect(res2b.body.estadoFlujoNuevo).toBe('DERIVADO_SUBDIRECCION');
    expect(res2b.body.estadoRutaDoc).toBe('DERIVADO');

    // Paso 3: Sub D. Acad. (SECRETARIO) deriva/asigna al Especialista del Centro de Idiomas
    actorEnTurno = ACTORES.secretarioSda;
    const res3 = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/sda/derivar-especialista`)
      .send({
        especialista_usuario_id: USER_ESPECIALISTA,
        especialista_persona_id: PERSONA_ESPECIALISTA,
        motivo: 'Asignación a Especialista del Centro de Idiomas para evaluación',
      });
    expect(res3.status).toBe(200);
    expect(res3.body.estadoFlujoNuevo).toBe('EN_EVALUACION_ESPECIALISTA');
    expect(res3.body.estadoRutaDoc).toBe('EN_REVISION');

    // Paso 4 (3 sub-acciones): Especialista programa, califica y emite informe devolviendo a SDA
    actorEnTurno = ACTORES.especialistaIdiomas;
    const res4a = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/programar-evaluacion`)
      .send({
        fecha_evaluacion: '2026-11-25T15:00:00.000Z',
        modalidad: 'PRESENCIAL',
        lugar_enlace: 'Laboratorio Centro de Idiomas - Aula 204',
      });
    expect(res4a.status).toBe(200);
    expect(res4a.body.estadoFlujoNuevo).toBe('EVALUACION_PROGRAMADA');

    const res4b = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/calificar`)
      .send({
        asistio: true,
        nota: 18,
        nivel_mcer: 'B2',
        resultado: 'APROBADO',
        observaciones: 'Dominio oral y escrito aprobado.',
      });
    expect(res4b.status).toBe(200);
    expect(res4b.body.estadoFlujoNuevo).toBe('EVALUACION_CALIFICADA');
    expect(res4b.body.flujo.resultadoEvaluacion).toBe('APROBADO');

    const shaInf = createHash('sha256').update('INFORME_INGLES_PDF').digest('hex');
    const res4c = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/emitir-informe`)
      .send({
        numero_informe: 'INF-CI-2026-045',
        tipo_informe: 'RESULTADOS',
        resumen: 'Solicitante aprobó evaluación de inglés Nivel B2 con nota 18.',
        nombre_archivo: 'Informe_Resultados_045.pdf',
        s3_key: 'dictamenes/2026/inf-045.pdf',
        sha256: shaInf,
        tamano_bytes: 2048,
      });
    expect(res4c.status).toBe(200);
    expect(res4c.body.estadoFlujoNuevo).toBe('INFORME_DEVUELTO_SUBDIRECCION');

    // Paso 5: Sub D. Acad. revisa informe, emite el certificado y estampa su firma
    actorEnTurno = ACTORES.secretarioSda;
    const certDocId = randomUUID();
    const shaCert = createHash('sha256').update('CERTIFICADO_INGLES_FINAL_PDF').digest('hex');
    const res5 = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/sda/emitir-certificado`)
      .send({
        codigo_certificado: 'CERT-ING-2026-0045',
        sello_firma_sda: 'FIRMA-ACADEMICA-SDA-2026',
        documento_certificado_id: certDocId,
        nombre_archivo: 'Certificado_Ingles_0045.pdf',
        s3_key: `certificados/2026/${certDocId}.pdf`,
        sha256: shaCert,
        tamano_bytes: 4096,
      });
    expect(res5.status).toBe(200);
    expect(res5.body.estadoFlujoNuevo).toBe('CERTIFICADO_EMITIDO_SDA');
    expect(res5.body.estadoRutaDoc).toBe('EN_FIRMA');

    // Paso 6: Dirección General da Visto Bueno (V/B) y Firma Digital -> ATENDIDO_NOTIFICADO + descarga PDF
    actorEnTurno = ACTORES.director;
    const res6 = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/direccion/visar-y-firmar`)
      .send({
        visto_bueno: true,
        canal_entrega: 'DIGITAL',
        cvd: 'CVD-2026-INGLES01',
        sha256_firmado: shaCert,
        documento_firmado_id: certDocId,
        s3_key: `certificados/2026/${certDocId}.pdf`,
      });
    expect(res6.status).toBe(200);
    expect(res6.body.estadoFlujoNuevo).toBe('LISTO_PARA_ENTREGA');
    expect(res6.body.estadoRutaDoc).toBe('RESUELTO');
    expect(res6.body.flujo.vistoBuenoDireccion).toBe(true);

    // Mesa de Partes realiza la entrega y notificación al ciudadano
    actorEnTurno = ACTORES.mesaPartes;
    const resEntrega = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/entrega-presencial`)
      .send({
        dni_receptor: '99000001',
        nombre_receptor: 'Ciudadano Demo Laboratorio',
        observaciones: 'Notificación y entrega completada',
      });
    expect(resEntrega.status).toBe(200);
    expect(resEntrega.body.estadoFlujoNuevo).toBe('ATENDIDO_NOTIFICADO');
    expect(resEntrega.body.flujo.documentoValido).toBe(true);
    expect(resEntrega.body.flujo.descargaHabilitada).toBe(true);

    // Usuario solicitante descarga PDF directamente sin presencia física
    actorEnTurno = ACTORES.ciudadano;
    const resDescarga = await request(app).get(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/descargar-certificado`);
    expect(resDescarga.status).toBe(200);
    expect(resDescarga.body.documentoValido).toBe(true);
    expect(resDescarga.body.descargaHabilitada).toBe(true);
    expect(resDescarga.body.cvd).toBe('CVD-2026-INGLES01');
    expect(resDescarga.body.urlDescarga).toContain(certDocId);

    // Verificar historial completo WORM y movimientos RutaDoc
    const resHist = await request(app).get(`/api/v1/expedientes/${EXP_ID}/flujo-certificado`);
    expect(resHist.status).toBe(200);
    expect(resHist.body.historial.map((h: any) => h.estadoNuevo)).toEqual([
      'SOLICITUD_INICIADA',
      'VALIDADO_MESA_PARTES',
      'DERIVADO_SUBDIRECCION',
      'EN_EVALUACION_ESPECIALISTA',
      'EVALUACION_PROGRAMADA',
      'EVALUACION_CALIFICADA',
      'INFORME_DEVUELTO_SUBDIRECCION',
      'CERTIFICADO_EMITIDO_SDA',
      'LISTO_PARA_ENTREGA',
      'ATENDIDO_NOTIFICADO',
    ]);
  });

  it('ejecuta el sub-circuito con Memorándum al Centro de Idiomas y Asignación por el Coordinador de Idiomas', async () => {
    actorEnTurno = ACTORES.ciudadano;
    await request(app).post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/iniciar`).send({});

    actorEnTurno = ACTORES.mesaPartes;
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/mesa-partes/derivar-sda`)
      .send({ proveido: 'Pase formal a Subdirección Académica' });

    // Subdirección Académica emite Memorándum al Centro de Idiomas
    actorEnTurno = ACTORES.secretarioSda;
    const resMemo = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/sda/memorandum-centro-idiomas`)
      .send({
        numero_memorandum: 'MEM-2026-SDA-000045',
        proveido: 'Se deriva expediente para evaluación y suficiencia en idioma inglés.',
        idioma: 'Inglés',
      });
    expect(resMemo.status).toBe(200);
    expect(resMemo.body.estadoFlujoNuevo).toBe('DERIVADO_CENTRO_IDIOMAS');

    // Coordinador de Centro de Idiomas encarga al especialista correspondiente
    actorEnTurno = ACTORES.especialistaIdiomas; // Opera con rol especialista/coordinador
    const resAsignar = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/centro-idiomas/asignar-especialista`)
      .send({
        especialista_usuario_id: USER_ESPECIALISTA,
        especialista_persona_id: PERSONA_ESPECIALISTA,
        idioma: 'Inglés',
        motivo: 'Se encarga evaluación técnica según especialidad.',
      });
    expect(resAsignar.status).toBe(200);
    expect(resAsignar.body.estadoFlujoNuevo).toBe('EN_EVALUACION_ESPECIALISTA');
  });

  // =========================================================================
  // 3. Flujo de Excepción 1: Inasistencia a Evaluación (NSP)
  // =========================================================================
  it('maneja Inasistencia (NSP) -> informe NSP a Sub D. Acad. -> cierra como IMPROCEDENTE / ARCHIVADO_POR_INASISTENCIA', async () => {
    actorEnTurno = ACTORES.ciudadano;
    await request(app).post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/iniciar`).send({});

    actorEnTurno = ACTORES.mesaPartes;
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/mesa-partes/derivar-sda`)
      .send({ proveido: 'Pase a Subdirección Académica' });

    actorEnTurno = ACTORES.secretarioSda;
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/sda/derivar-especialista`)
      .send({
        especialista_usuario_id: USER_ESPECIALISTA,
        especialista_persona_id: PERSONA_ESPECIALISTA,
        motivo: 'Asignación a especialista de idiomas',
      });

    actorEnTurno = ACTORES.especialistaIdiomas;
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/programar-evaluacion`)
      .send({
        fecha_evaluacion: '2026-11-26T10:00:00.000Z',
        modalidad: 'PRESENCIAL',
        lugar_enlace: 'Aula 102',
      });

    // Solicitante no se presenta (NSP)
    const resNsp = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/calificar`)
      .send({ asistio: false, observaciones: 'No se presentó a la evaluación programada.' });
    expect(resNsp.status).toBe(200);
    expect(resNsp.body.estadoFlujoNuevo).toBe('INASISTENCIA_REGISTRADA');
    expect(resNsp.body.flujo.resultadoEvaluacion).toBe('NSP');

    // No permite emitir informe de RESULTADOS cuando hay inasistencia NSP
    const resInfMalo = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/emitir-informe`)
      .send({
        numero_informe: 'INF-NSP-001',
        tipo_informe: 'RESULTADOS',
        resumen: 'Intento incompatible con inasistencia',
      });
    expect(resInfMalo.status).toBe(422);
    expect(resInfMalo.body.code).toBe('TIPO_INFORME_INCOMPATIBLE');

    // Emite informe NSP y devuelve a Sub D. Acad.
    const resInfNsp = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/emitir-informe`)
      .send({
        numero_informe: 'INF-NSP-2026-009',
        tipo_informe: 'INASISTENCIA_NSP',
        resumen: 'Informe NSP: El postulante no se presentó en la fecha y hora programadas.',
      });
    expect(resInfNsp.status).toBe(200);
    expect(resInfNsp.body.estadoFlujoNuevo).toBe('INFORME_NSP_DEVUELTO_SUBDIRECCION');

    // Sub D. Acad. NO puede emitir certificado en un caso NSP
    actorEnTurno = ACTORES.secretarioSda;
    const resEmitirBloqueado = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/sda/emitir-certificado`)
      .send({ codigo_certificado: 'CERT-FAKE', sello_firma_sda: 'SDA' });
    expect(resEmitirBloqueado.status).toBe(422);
    expect(resEmitirBloqueado.body.code).toBe('FLUJO_TRANSICION_INVALIDA');

    // Sub D. Acad. cierra como IMPROCEDENTE / ARCHIVADO_POR_INASISTENCIA
    const resCierre = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/sda/cerrar-inasistencia`)
      .send({
        motivo_improcedencia: 'Se declara IMPROCEDENTE por inasistencia injustificada (NSP) del solicitante.',
        estante: 'EST-NSP',
        balda: 'B2',
        caja: 'C-2026',
      });
    expect(resCierre.status).toBe(200);
    expect(resCierre.body.estadoFlujoNuevo).toBe('ARCHIVADO_POR_INASISTENCIA');
    expect(resCierre.body.estadoRutaDoc).toBe('ARCHIVADO');
    expect(resCierre.body.flujo.documentoValido).toBe(false);

    // Historial registra la transición IMPROCEDENTE -> ARCHIVADO_POR_INASISTENCIA
    const histEstados = fakeDb.state.historiales.map((h) => h.estado_nuevo);
    expect(histEstados).toContain('IMPROCEDENTE');
    expect(histEstados).toContain('ARCHIVADO_POR_INASISTENCIA');
  });

  // =========================================================================
  // 4. Flujo de Excepción 2: Canal Presencial y No Recojo (30 días)
  // =========================================================================
  it('en Canal Presencial pasa a LISTO_PARA_ENTREGA y tras 30 días pasa a ARCHIVADO_NO_RECOGIDO sin invalidar documento', async () => {
    actorEnTurno = ACTORES.ciudadano;
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/iniciar`)
      .send({ canal_entrega: 'PRESENCIAL', plazo_recojo_dias: 30 });

    actorEnTurno = ACTORES.mesaPartes;
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/mesa-partes/derivar-sda`)
      .send({ proveido: 'Derivar a Subdirección Académica' });

    actorEnTurno = ACTORES.secretarioSda;
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/sda/derivar-especialista`)
      .send({
        especialista_usuario_id: USER_ESPECIALISTA,
        especialista_persona_id: PERSONA_ESPECIALISTA,
        motivo: 'Asignar a especialista',
      });

    actorEnTurno = ACTORES.especialistaIdiomas;
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/programar-evaluacion`)
      .send({ fecha_evaluacion: '2026-11-20T14:00:00.000Z', modalidad: 'PRESENCIAL', lugar_enlace: 'Aula 101' });
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/calificar`)
      .send({ asistio: true, nota: 17, nivel_mcer: 'B2', resultado: 'APROBADO' });
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/emitir-informe`)
      .send({ numero_informe: 'INF-CI-2026-088', tipo_informe: 'RESULTADOS', resumen: 'Aprobado nivel B2 con nota 17.' });

    actorEnTurno = ACTORES.secretarioSda;
    const certDocId = randomUUID();
    const shaCert = createHash('sha256').update('CERT_PRESENCIAL_PDF').digest('hex');
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/sda/emitir-certificado`)
      .send({
        codigo_certificado: 'CERT-ING-2026-0088',
        sello_firma_sda: 'FIRMA-SDA-088',
        documento_certificado_id: certDocId,
      });

    // Dirección General da V/B y Firma Digital -> LISTO_PARA_ENTREGA (no digital)
    actorEnTurno = ACTORES.director;
    const resFirmaPres = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/direccion/visar-y-firmar`)
      .send({
        visto_bueno: true,
        canal_entrega: 'PRESENCIAL',
        plazo_recojo_dias: 30,
        cvd: 'CVD-2026-PRES088',
        sha256_firmado: shaCert,
        documento_firmado_id: certDocId,
        s3_key: `certificados/2026/${certDocId}.pdf`,
      });
    expect(resFirmaPres.status).toBe(200);
    expect(resFirmaPres.body.estadoFlujoNuevo).toBe('LISTO_PARA_ENTREGA');
    expect(resFirmaPres.body.flujo.documentoValido).toBe(true);
    expect(resFirmaPres.body.flujo.descargaHabilitada).toBe(false);
    expect(resFirmaPres.body.flujo.fechaLimiteRecojo).toBeTruthy();

    // Descarga digital bloqueada mientras requiera recojo presencial
    actorEnTurno = ACTORES.ciudadano;
    const resDescargaBloq = await request(app).get(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/descargar-certificado`);
    expect(resDescargaBloq.status).toBe(409);
    expect(resDescargaBloq.body.code).toBe('ENTREGA_PRESENCIAL_REQUERIDA');

    // No se puede archivar por no recojo antes del vencimiento de 30 días
    actorEnTurno = ACTORES.mesaPartes;
    const resAntesPlazo = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/archivar-no-recojo`)
      .send({
        fecha_evaluacion: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        estante: 'CUST-01',
        balda: 'B1',
        caja: 'C-01',
      });
    expect(resAntesPlazo.status).toBe(422);
    expect(resAntesPlazo.body.code).toBe('PLAZO_RECOJO_VIGENTE');

    // Pasados los 30 días, pasa a ARCHIVADO_NO_RECOGIDO (en custodia) SIN invalidar el documento
    const resDespuesPlazo = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/archivar-no-recojo`)
      .send({
        fecha_evaluacion: new Date(Date.now() + 31 * 86_400_000).toISOString(),
        estante: 'CUST-01',
        balda: 'B1',
        caja: 'C-01',
        observaciones: 'Vencido plazo de 30 días, pasa a custodia física.',
      });
    expect(resDespuesPlazo.status).toBe(200);
    expect(resDespuesPlazo.body.estadoFlujoNuevo).toBe('ARCHIVADO_NO_RECOGIDO');
    expect(resDespuesPlazo.body.estadoRutaDoc).toBe('ARCHIVADO');
    expect(resDespuesPlazo.body.flujo.enCustodia).toBe(true);
    expect(resDespuesPlazo.body.flujo.documentoValido).toBe(true);
  });

  // =========================================================================
  // 5. Validaciones estrictas de Rol, Gate de Pago y Estado Actual
  // =========================================================================
  it('bloquea actores no autorizados, especialistas no asignados, pago pendiente y saltos de estado', async () => {
    actorEnTurno = ACTORES.ciudadano;
    await request(app).post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/iniciar`).send({});

    // Solicitante titular no puede auto-derivar su propio expediente (403 CONFLICTO_INTERES_EXPEDIENTE_PROPIO)
    const resCiudadanoDeriva = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/mesa-partes/derivar-sda`)
      .send({ proveido: 'Intento ciudadano' });
    expect(resCiudadanoDeriva.status).toBe(403);
    expect(resCiudadanoDeriva.body.code).toBe('CONFLICTO_INTERES_EXPEDIENTE_PROPIO');

    // Tesorería no tiene rol autorizado para derivar a SDA (403 FLUJO_ROL_NO_AUTORIZADO)
    actorEnTurno = ACTORES.tesoreria;
    const resTesoreria = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/mesa-partes/derivar-sda`)
      .send({ proveido: 'Intento tesorería' });
    expect(resTesoreria.status).toBe(403);
    expect(resTesoreria.body.code).toBe('FLUJO_ROL_NO_AUTORIZADO');

    // Consulta de máquina de estados formal vía HTTP
    const resFsm = await request(app).get('/api/v1/expedientes/flujo-certificado/maquina-estados');
    expect(resFsm.status).toBe(200);
    expect(resFsm.body.maquinaEstados.estados).toHaveLength(16);

    // Si el expediente tiene pago pendiente, Mesa de Partes no puede derivar a SDA (409 PAGO_PENDIENTE)
    fakeDb.state.pagoPendiente.add(EXP_ID);
    actorEnTurno = ACTORES.mesaPartes;
    const resPagoPendiente = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/mesa-partes/derivar-sda`)
      .send({ proveido: 'Intento derivar sin pagar' });
    expect(resPagoPendiente.status).toBe(409);
    expect(resPagoPendiente.body.code).toBe('PAGO_PENDIENTE');

    // Liberar pago y derivar a SDA
    fakeDb.state.pagoPendiente.delete(EXP_ID);
    const resDerivarOk = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/mesa-partes/derivar-sda`)
      .send({ proveido: 'Derivar a Subdirección Académica tras pago' });
    expect(resDerivarOk.status).toBe(200);

    // Saltar paso 3: Especialista no puede programar evaluación antes que Sub D. Acad. lo asigne (422)
    actorEnTurno = ACTORES.especialistaIdiomas;
    const resSalto = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/programar-evaluacion`)
      .send({ fecha_evaluacion: '2026-11-25T15:00:00.000Z', modalidad: 'VIRTUAL', lugar_enlace: 'https://meet.test/1' });
    expect(resSalto.status).toBe(422);
    expect(resSalto.body.code).toBe('FLUJO_TRANSICION_INVALIDA');

    // Sub D. Acad. asigna al especialista principal
    actorEnTurno = ACTORES.secretarioSda;
    await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/sda/derivar-especialista`)
      .send({
        especialista_usuario_id: USER_ESPECIALISTA,
        especialista_persona_id: PERSONA_ESPECIALISTA,
        motivo: 'Asignación formal al especialista titular',
      });

    // Otro especialista distinto al asignado es bloqueado con 403 EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA
    actorEnTurno = ACTORES.otroEspecialista;
    const resOtroEsp = await request(app)
      .post(`/api/v1/expedientes/${EXP_ID}/flujo-certificado/especialista/programar-evaluacion`)
      .send({ fecha_evaluacion: '2026-11-25T15:00:00.000Z', modalidad: 'VIRTUAL', lugar_enlace: 'https://meet.test/1' });
    expect(resOtroEsp.status).toBe(403);
    expect(resOtroEsp.body.code).toBe('EXPEDIENTE_NO_ASIGNADO_AL_ESPECIALISTA');
  });
});

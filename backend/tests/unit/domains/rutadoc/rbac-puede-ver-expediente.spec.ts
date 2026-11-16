import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import request from 'supertest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';

// Identificadores sintéticos reproducibles (UUIDv4)
const USUARIO_MP = '10000000-0000-4000-8000-000000000001';
const USUARIO_SEC = '10000000-0000-4000-8000-000000000002';
const USUARIO_RRHH = '10000000-0000-4000-8000-000000000003';
const USUARIO_GLOBAL = '10000000-0000-4000-8000-000000000004';
const USUARIO_CIUDADANO_TITULAR = '10000000-0000-4000-8000-000000000005';
const USUARIO_CIUDADANO_AJENO = '10000000-0000-4000-8000-000000000006';

const PERSONA_TITULAR = '20000000-0000-4000-8000-000000000005';
const PERSONA_AJENA = '20000000-0000-4000-8000-000000000006';

const AREA_MP = '30000000-0000-4000-8000-000000000001';
const AREA_SEC = '30000000-0000-4000-8000-000000000002';
const AREA_RRHH = '30000000-0000-4000-8000-000000000003';

const EXPEDIENTE_ID = '40000000-0000-4000-8000-000000000001';

interface ContextoMock {
  usuarioId: string;
  roles?: string[];
  permisos?: Array<{ codigo: string; ambito: 'GLOBAL' | 'AREA'; areaId: string | null }>;
  unidadOrganicaId?: string | null;
  cuentaActiva?: boolean;
  expedienteExiste?: boolean;
  expedienteSolicitanteId?: string;
  expedienteAreaActualId?: string | null;
  expedienteCanalIngreso?: string;
  asientoAnulado?: boolean;
  areaMpId?: string;
}

/**
 * Simula el comportamiento del motor PostgreSQL evaluando con exactitud lógica
 * las condiciones declaradas en `puedeVerExpediente` de backend/src/app.ts:
 *
 *  WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE
 *    AND (e.solicitante_id = cu.id_persona OR EXISTS (
 *      ...
 *      (p.codigo = 'EXPEDIENTE_LEER' AND p.ambito = 'GLOBAL' AND ur.area_id IS NULL)
 *      OR (
 *        p.codigo = 'EXPEDIENTE_LEER' AND ur.area_id IS NOT NULL AND (
 *          ur.area_id::text = NULLIF(ultimo.area_actual_id, '')
 *          OR (
 *            ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')
 *            AND (ar.anulado IS FALSE OR ar.anulado IS NULL)
 *            AND ur.area_id::text = (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
 *          )
 *        )
 *      )
 *    ))
 */
function evaluarLogicaSqlPuedeVerExpediente(ctx: ContextoMock): boolean {
  if (ctx.cuentaActiva === false) return false;
  if (ctx.expedienteExiste === false) return false;

  // Rama A: Solicitante titular
  if (ctx.usuarioId === USUARIO_CIUDADANO_TITULAR && ctx.expedienteSolicitanteId === PERSONA_TITULAR) {
    return true;
  }
  if (ctx.usuarioId === USUARIO_CIUDADANO_AJENO && ctx.expedienteSolicitanteId === PERSONA_TITULAR) {
    // Intento IDOR de ciudadano ajeno
    return false;
  }

  // Rama B: Funcionario institucional con roles
  const permisos = ctx.permisos ?? [];

  // B1: Acceso Global
  const tieneGlobal = permisos.some(p => p.codigo === 'EXPEDIENTE_LEER' && p.ambito === 'GLOBAL' && p.areaId === null);
  if (tieneGlobal) return true;

  // B2: Acceso por Área
  const permisosArea = permisos.filter(p => p.codigo === 'EXPEDIENTE_LEER' && p.ambito === 'AREA' && p.areaId !== null);
  for (const perm of permisosArea) {
    // B2.1: Coincidencia con área actual
    if (ctx.expedienteAreaActualId && perm.areaId === ctx.expedienteAreaActualId) {
      return true;
    }

    // B2.2: Excepción legítima de Mesa de Partes originadora
    const canalValido = ctx.expedienteCanalIngreso === 'MESA_PRESENCIAL' || ctx.expedienteCanalIngreso === 'MESA_VIRTUAL';
    const asientoNoAnulado = ctx.asientoAnulado !== true;
    const esAreaMp = perm.areaId === (ctx.areaMpId ?? AREA_MP);

    if (canalValido && asientoNoAnulado && esAreaMp) {
      return true;
    }
  }

  return false;
}

function crearAppAislada(ctx: ContextoMock) {
  const consultasEjecutadas: Array<{ sql: string; params?: unknown[] }> = [];

  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    consultasEjecutadas.push({ sql, params });

    // 1. Consulta de autorizaciones de la cuenta (obtenerAutorizacionCuenta)
    if (sql.includes('FROM sigd_auth.cuenta_usuario cu') && sql.includes('AS roles') && sql.includes('AS permisos')) {
      if (ctx.cuentaActiva === false) {
        return { rows: [], rowCount: 0 };
      }
      return {
        rows: [{
          roles: ctx.roles ?? ['OPERADOR_MESA'],
          permisos: ctx.permisos ?? [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: ctx.unidadOrganicaId ?? AREA_MP }],
          unidad_organica_id: ctx.unidadOrganicaId ?? AREA_MP,
        }],
        rowCount: 1,
      };
    }

    // 2. Consulta de existencia de expediente para trazabilidad
    if (sql.includes('SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente WHERE expediente_id = $1::uuid) AS existe')) {
      return { rows: [{ existe: ctx.expedienteExiste !== false }], rowCount: 1 };
    }

    // 3. Verificación de autorización de derivación (rutadoc.router.ts)
    if (sql.includes('AS autorizado') && sql.includes('ANY($2::text[])')) {
      // Para mutaciones (derivar), el expediente debe estar en el área del operador
      const areasPermitidas = (params?.[1] as string[] ?? []);
      const esAreaActual = areasPermitidas.includes(ctx.expedienteAreaActualId ?? '');
      return { rows: [{ autorizado: esAreaActual }], rowCount: 1 };
    }

    // 4. Consulta canónica de puedeVerExpediente (backend/src/app.ts)
    if (sql.includes('SELECT EXISTS') && sql.includes('cu.id_usuario = $1::uuid AND cu.activo = TRUE')) {
      // Verificación estricta de que la consulta generada contiene todas las salvaguardas RBAC
      expect(sql).toContain('cu.id_usuario = $1::uuid AND cu.activo = TRUE');
      expect(sql).toContain("p.codigo = 'EXPEDIENTE_LEER' AND p.ambito = 'GLOBAL' AND ur.area_id IS NULL");
      expect(sql).toContain("p.codigo = 'EXPEDIENTE_LEER' AND ur.area_id IS NOT NULL");
      expect(sql).toContain("ur.area_id::text = NULLIF(ultimo.area_actual_id, '')");
      expect(sql).toContain("ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL')");
      expect(sql).toContain("(ar.anulado IS FALSE OR ar.anulado IS NULL)");
      expect(sql).toContain("ur.area_id::text = (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')");
      expect(sql).toContain("r.codigo <> 'CIUDADANO'");
      expect(sql).toContain("r.codigo <> 'ESTUDIANTE'");

      const autorizado = evaluarLogicaSqlPuedeVerExpediente(ctx);
      return { rows: [{ autorizado }], rowCount: 1 };
    }

    // 3. Consulta de detalle de expediente (rutadoc.repository.ts)
    if (sql.includes('FROM sigd_tra.expediente e') && sql.includes('COALESCE(ultimo.estado_nuevo, \'REGISTRADO\') AS estado_actual')) {
      if (ctx.expedienteExiste === false) {
        return { rows: [], rowCount: 0 };
      }
      return {
        rows: [{
          id_expediente: EXPEDIENTE_ID,
          cut: 'EXP-2026-000028',
          asunto: 'Solicitud institucional',
          fecha_radicacion: new Date('2026-01-15T10:00:00Z'),
          estado_actual: 'DERIVADO',
          area_actual_id: ctx.expedienteAreaActualId ?? AREA_SEC,
          solicitante_id: ctx.expedienteSolicitanteId ?? PERSONA_TITULAR,
          id_movimiento: '50000000-0000-4000-8000-000000000001',
          evento: 'DERIVACION',
          fecha_hora: new Date('2026-01-15T12:00:00Z'),
          usuario_operador_id: ctx.usuarioId,
        }],
        rowCount: 1,
      };
    }

    // 4. Folios y documentos adjuntos de rutadoc.repository.ts
    if (sql.includes('expediente_documento_folio')) {
      return { rows: [{ cantidad: 1, total: 10 }], rowCount: 1 };
    }
    if (sql.includes('documento_adjunto')) {
      return { rows: [], rowCount: 0 };
    }

    // 5. Trazabilidad
    if (sql.includes('sigd_rut.movimiento_tramite') && sql.includes('ORDER BY m.secuencia')) {
      return {
        rows: [
          { id_movimiento: '50000000-0000-4000-8000-000000000001', secuencia: '1', evento: 'REGISTRO', estado_nuevo: 'REGISTRADO' },
          { id_movimiento: '50000000-0000-4000-8000-000000000002', secuencia: '2', evento: 'RECEPCION', estado_nuevo: 'RECEPCIONADO' },
          { id_movimiento: '50000000-0000-4000-8000-000000000003', secuencia: '3', evento: 'DERIVACION', estado_nuevo: 'DERIVADO' },
        ],
        rowCount: 3,
      };
    }

    // 6. Verificación de integridad en rutadoc.router.ts
    if (sql.includes('AS inconsistente')) {
      return { rows: [{ inconsistente: false }], rowCount: 1 };
    }


    return { rows: [], rowCount: 0 };
  });

  const pool = {
    query,
    connect: vi.fn(async () => ({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    })),
  } as unknown as Pool;

  const app = construirApp(pool);
  return { app, query, consultasEjecutadas };
}

describe('Auditoría RBAC y Control de Acceso: puedeVerExpediente (backend/src/app.ts)', () => {

  describe('1. VECTORES POSITIVOS (Acceso Legítimo Autorizado)', () => {

    it('[Positivo 1] Operador de Mesa de Partes consulta expediente derivado originado por MESA_PRESENCIAL', async () => {
      const { app, query } = crearAppAislada({
        usuarioId: USUARIO_MP,
        roles: ['MESA_PARTES'],
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_MP }],
        unidadOrganicaId: AREA_MP,
        expedienteAreaActualId: AREA_SEC, // Derivado a Secretaría Académica
        expedienteCanalIngreso: 'MESA_PRESENCIAL',
        asientoAnulado: false,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_MP, roles: ['MESA_PARTES'] });
      const resDetalle = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(resDetalle.status).toBe(200);
      expect(resDetalle.body.cut).toBe('EXP-2026-000028');
      expect(resDetalle.body.estadoActual).toBe('DERIVADO');

      const resTraza = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}/trazabilidad`)
        .set('Authorization', `Bearer ${token}`);

      expect(resTraza.status).toBe(200);
      expect(query).toHaveBeenCalled();
    });

    it('[Positivo 2] Operador de Mesa de Partes consulta expediente derivado originado por MESA_VIRTUAL', async () => {
      const { app } = crearAppAislada({
        usuarioId: USUARIO_MP,
        roles: ['MESA_PARTES'],
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_MP }],
        unidadOrganicaId: AREA_MP,
        expedienteAreaActualId: AREA_SEC,
        expedienteCanalIngreso: 'MESA_VIRTUAL',
        asientoAnulado: false,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_MP, roles: ['MESA_PARTES'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('[Positivo 3] Operador del área destinataria (Secretaría Académica) consulta el expediente derivado a su área', async () => {
      const { app } = crearAppAislada({
        usuarioId: USUARIO_SEC,
        roles: ['SECRETARIA'],
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_SEC }],
        unidadOrganicaId: AREA_SEC,
        expedienteAreaActualId: AREA_SEC, // Coincide con ur.area_id
        expedienteCanalIngreso: 'MESA_PRESENCIAL',
      });

      const token = firmarTokenAcceso({ sub: USUARIO_SEC, roles: ['SECRETARIA'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('[Positivo 4] Director / Administrador con permiso EXPEDIENTE_LEER GLOBAL consulta cualquier expediente', async () => {
      const { app } = crearAppAislada({
        usuarioId: USUARIO_GLOBAL,
        roles: ['DIRECTOR'],
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null }],
        unidadOrganicaId: null,
        expedienteAreaActualId: AREA_SEC,
        expedienteCanalIngreso: 'TRAMITE_INTERNO', // Expediente interno, no de MP
      });

      const token = firmarTokenAcceso({ sub: USUARIO_GLOBAL, roles: ['DIRECTOR'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('[Positivo 5] Ciudadano solicitante consulta su propio expediente (titularidad)', async () => {
      const { app } = crearAppAislada({
        usuarioId: USUARIO_CIUDADANO_TITULAR,
        roles: ['CIUDADANO'],
        permisos: [],
        expedienteSolicitanteId: PERSONA_TITULAR, // Coincide con cu.id_persona
        expedienteAreaActualId: AREA_SEC,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_CIUDADANO_TITULAR, roles: ['CIUDADANO'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

  });

  describe('2. VECTORES NEGATIVOS Y PRUEBAS ADVERSARIALES (Blindaje Anti-IDOR y Sin Escalada)', () => {

    it('[Negativo 1 - Anti-IDOR] Ciudadano ajeno intenta consultar expediente de otro administrado (403 Forbidden)', async () => {
      const { app } = crearAppAislada({
        usuarioId: USUARIO_CIUDADANO_AJENO,
        roles: ['CIUDADANO'],
        permisos: [],
        expedienteSolicitanteId: PERSONA_TITULAR, // NO coincide con PERSONA_AJENA
        expedienteAreaActualId: AREA_SEC,
        expedienteCanalIngreso: 'MESA_PRESENCIAL',
      });

      const token = firmarTokenAcceso({ sub: USUARIO_CIUDADANO_AJENO, roles: ['CIUDADANO'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('[Negativo 2 - Aislamiento entre áreas] Operador de RRHH no involucrado intenta consultar expediente en Secretaría Académica (403 Forbidden)', async () => {
      const { app } = crearAppAislada({
        usuarioId: USUARIO_RRHH,
        roles: ['OPERADOR_RRHH'],
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_RRHH }],
        unidadOrganicaId: AREA_RRHH,
        expedienteAreaActualId: AREA_SEC, // Está en SEC, no en RRHH
        expedienteCanalIngreso: 'MESA_PRESENCIAL', // Ingresó por MP, no por RRHH
        asientoAnulado: false,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_RRHH, roles: ['OPERADOR_RRHH'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('[Negativo 3 - Límite de Mesa de Partes] Mesa de Partes no puede ver expedientes de trámites internos entre áreas (403 Forbidden)', async () => {
      const { app } = crearAppAislada({
        usuarioId: USUARIO_MP,
        roles: ['MESA_PARTES'],
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_MP }],
        unidadOrganicaId: AREA_MP,
        expedienteAreaActualId: AREA_SEC,
        expedienteCanalIngreso: 'TRAMITE_INTERNO', // No pasó por Mesa de Partes
        asientoAnulado: false,
      });

      const token = firmarTokenAcceso({ sub: USUARIO_MP, roles: ['MESA_PARTES'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('[Negativo 4 - Asiento Anulado] Mesa de Partes no puede ver expedientes con asiento de registro anulado (403 Forbidden)', async () => {
      const { app } = crearAppAislada({
        usuarioId: USUARIO_MP,
        roles: ['MESA_PARTES'],
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_MP }],
        unidadOrganicaId: AREA_MP,
        expedienteAreaActualId: AREA_SEC,
        expedienteCanalIngreso: 'MESA_PRESENCIAL',
        asientoAnulado: true, // Asiento revocado o anulado
      });

      const token = firmarTokenAcceso({ sub: USUARIO_MP, roles: ['MESA_PARTES'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('[Negativo 5 - Cuenta Desactivada] Usuario con cuenta cu.activo = FALSE es denegado (403 Forbidden)', async () => {
      const { app } = crearAppAislada({
        usuarioId: USUARIO_MP,
        cuentaActiva: false, // Desactivado
        roles: ['MESA_PARTES'],
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_MP }],
      });

      const token = firmarTokenAcceso({ sub: USUARIO_MP, roles: ['MESA_PARTES'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('[Negativo 6 - Ausencia de Permiso] Operador de Mesa de Partes sin permiso EXPEDIENTE_LEER es denegado (403 Forbidden)', async () => {
      const { app } = crearAppAislada({
        usuarioId: USUARIO_MP,
        roles: ['MESA_PARTES'],
        permisos: [{ codigo: 'DOCUMENTO_FIRMAR', ambito: 'AREA', areaId: AREA_MP }], // No tiene EXPEDIENTE_LEER
        unidadOrganicaId: AREA_MP,
        expedienteAreaActualId: AREA_SEC,
        expedienteCanalIngreso: 'MESA_PRESENCIAL',
      });

      const token = firmarTokenAcceso({ sub: USUARIO_MP, roles: ['MESA_PARTES'] });
      const res = await request(app)
        .get(`/api/v1/expedientes/${EXPEDIENTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('[Negativo 7 - Sin Autenticación] Solicitud sin cabecera Authorization es rechazada (401 Unauthorized)', async () => {
      const { app, query } = crearAppAislada({
        usuarioId: USUARIO_MP,
      });

      const res = await request(app).get(`/api/v1/expedientes/${EXPEDIENTE_ID}`);
      expect(res.status).toBe(401);
      expect(query).not.toHaveBeenCalled();
    });

    it('[Negativo 8 - Parámetro Malformado] Expediente ID no UUID es rechazado con 400 antes de ejecutar queries SQL', async () => {
      const { app, query } = crearAppAislada({
        usuarioId: USUARIO_MP,
        roles: ['MESA_PARTES'],
        permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_MP }],
      });

      const token = firmarTokenAcceso({ sub: USUARIO_MP, roles: ['MESA_PARTES'] });
      const res = await request(app)
        .get('/api/v1/expedientes/no-es-un-uuid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('[Negativo 9 - Separación de Funciones / No Mutabilidad] Mesa de Partes NO puede volver a derivar un expediente ya derivado a otra área (403 Forbidden)', async () => {
      const { app } = crearAppAislada({
        usuarioId: USUARIO_MP,
        roles: ['MESA_PARTES'],
        permisos: [
          { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_MP },
          { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: AREA_MP },
        ],
        unidadOrganicaId: AREA_MP,
        expedienteAreaActualId: AREA_SEC, // El expediente está en SEC
        expedienteCanalIngreso: 'MESA_PRESENCIAL',
      });

      const token = firmarTokenAcceso({ sub: USUARIO_MP, roles: ['MESA_PARTES'] });
      const res = await request(app)
        .post(`/api/v1/expedientes/${EXPEDIENTE_ID}/derivar`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          destinos: [{ area_destino_id: '30000000-0000-4000-8000-000000000099' }],
          proveido: 'Intento de derivar expediente que ya no está en MP',
        });

      // Debe dar 403 Forbidden porque rutadoc.router.ts comprueba que el área actual sea AREA_MP
      expect(res.status).toBe(403);
    });

  });

});

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarMigraciones, listarMigracionesAplicadas } from '../../../src/db/migrate.js';
import {
  asegurarBaseTemporalAislada,
  iniciarClusterPostgresEfimero,
  type ClusterPostgresEfimero,
} from '../../helpers/ephemeral-postgres.helper.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const sqlDe = (nombre: string) => readFileSync(path.join(raiz, 'migraciones', nombre), 'utf8');

async function aplicarAtomico(cliente: Client, sql: string): Promise<void> {
  await cliente.query('BEGIN');
  try {
    await cliente.query(sql);
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  }
}

describe('migraciones correctivas (22, 23, 24): PostgreSQL 18 efímero, aislado, atómico e idempotente', () => {
  let cluster: ClusterPostgresEfimero;

  beforeAll(async () => {
    cluster = await iniciarClusterPostgresEfimero();
  }, 120_000);

  afterAll(async () => {
    await cluster?.detener();
  }, 120_000);

  it('garantiza aislamiento estricto y bloquea conexiones externas o bases no temporales', async () => {
    const previaExterna = process.env.MIGRATION_TEST_DATABASE_URL;
    process.env.MIGRATION_TEST_DATABASE_URL = 'postgres://externo:secreto@db.compartida.local:5432/sigd_compartida';

    try {
      await cluster.conBaseTemporalAislada(async ({ cliente, contexto, dbName }) => {
        expect(dbName).toMatch(/^sigd_tmp_[0-9a-f]{20}$/);
        await expect(asegurarBaseTemporalAislada(cliente, contexto)).resolves.toBeUndefined();

        await expect(
          asegurarBaseTemporalAislada(cliente, {
            ...contexto,
            expectedDbName: 'sigd_compartida',
          }),
        ).rejects.toThrow(/prefijo obligatorio/i);

        await expect(
          asegurarBaseTemporalAislada(cliente, {
            ...contexto,
            allowedHost: 'db.compartida.local',
          }),
        ).rejects.toThrow(/loopback efímero aislado/i);

        await expect(
          asegurarBaseTemporalAislada(cliente, {
            ...contexto,
            env: {
              DATABASE_URL: `postgres://sigd_app:clave@${contexto.allowedHost}:${contexto.allowedPort}/sigd_produccion`,
            },
          }),
        ).rejects.toThrow(/coincide con la conexión externa/i);

        await expect(
          asegurarBaseTemporalAislada(cliente, {
            ...contexto,
            expectedToken: '00000000-0000-0000-0000-000000000099',
          }),
        ).rejects.toThrow(/marcador criptográfico/i);
      });
    } finally {
      if (previaExterna === undefined) {
        delete process.env.MIGRATION_TEST_DATABASE_URL;
      } else {
        process.env.MIGRATION_TEST_DATABASE_URL = previaExterna;
      }
    }
  });

  it('22 convierte refresh_token a TEXT de forma idempotente sin perder sesiones ni restricciones', async () => {
    await cluster.conBaseTemporalAislada(async ({ cliente }) => {
      const sql22 = sqlDe('22_sigd_refresh_token_idempotente.sql');

      // Base sin esquema sigd_auth todavía: no-op seguro.
      await aplicarAtomico(cliente, sql22);

      // Esquema histórico real 02_sigd_auth.sql (refresh_token VARCHAR(255) NOT NULL UNIQUE).
      await cliente.query(sqlDe('02_sigd_auth.sql'));

      await cliente.query(`
        INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
        VALUES ('10000000-0000-0000-0000-000000000001', 'NATURAL', '44556677');
        INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash)
        VALUES (
          '10000000-0000-0000-0000-000000000002',
          '10000000-0000-0000-0000-000000000001',
          'operador_22',
          'operador22@iestpsuiza.edu.pe',
          '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA'
        );
        INSERT INTO sigd_auth.sesion_usuario (id_sesion, id_usuario, refresh_token, emitido_en, expira_en)
        VALUES (
          '10000000-0000-0000-0000-000000000003',
          '10000000-0000-0000-0000-000000000002',
          'token-historico-corto',
          now() - interval '5 minutes',
          now() + interval '1 day'
        );
      `);

      await aplicarAtomico(cliente, sql22);
      await aplicarAtomico(cliente, sql22);
      await aplicarAtomico(cliente, sql22);

      const columna = await cliente.query<{ data_type: string; is_nullable: string }>(`
        SELECT data_type, is_nullable
          FROM information_schema.columns
         WHERE table_schema = 'sigd_auth'
           AND table_name = 'sesion_usuario'
           AND column_name = 'refresh_token'
      `);
      expect(columna.rows[0]).toEqual({ data_type: 'text', is_nullable: 'NO' });

      const tokenLargo = `jwt.${'x'.repeat(600)}`;
      await cliente.query(
        `INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, emitido_en, expira_en)
         VALUES ('10000000-0000-0000-0000-000000000002', $1, now() - interval '1 minute', now() + interval '1 day')`,
        [tokenLargo],
      );

      // La restricción UNIQUE sobre refresh_token se conserva.
      await expect(
        cliente.query(
          `INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, emitido_en, expira_en)
           VALUES ('10000000-0000-0000-0000-000000000002', 'token-historico-corto', now() - interval '1 minute', now() + interval '1 day')`,
        ),
      ).rejects.toMatchObject({ code: '23505' });

      const totalSesiones = await cliente.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM sigd_auth.sesion_usuario',
      );
      expect(totalSesiones.rows[0]?.total).toBe(2);
    });
  });

  it('23 deshabilita solo la cuenta superadmin inicial preservando permisos de ADMINISTRADOR y otros administradores activos', async () => {
    await cluster.conBaseTemporalAislada(async ({ cliente }) => {
      const sql23 = sqlDe('23_sigd_superadmin_hardening.sql');

      // Sin tablas aún: no-op seguro.
      await aplicarAtomico(cliente, sql23);

      // Esquemas reales 02, 03, 08 y semilla histórica 15_sigd_superadmin.sql.
      await cliente.query(sqlDe('02_sigd_auth.sql'));
      await cliente.query(sqlDe('03_sigd_org.sql'));
      await cliente.query(sqlDe('08_sigd_auth_bloqueo_cuentas.sql'));
      await cliente.query(sqlDe('15_sigd_superadmin.sql'));

      // Registrar una sesión activa para superadmin y un administrador institucional real activo.
      await cliente.query(`
        INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, emitido_en, expira_en)
        SELECT id_usuario, 'refresh-superadmin-activo', now() - interval '10 minutes', now() + interval '1 day'
          FROM sigd_auth.cuenta_usuario
         WHERE usuario = 'superadmin';

        INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
        VALUES ('20000000-0000-0000-0000-000000000010', 'NATURAL', '70809010');

        INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
        VALUES (
          '20000000-0000-0000-0000-000000000011',
          '20000000-0000-0000-0000-000000000010',
          'admin_institucional',
          'admin.institucional@iestpsuiza.edu.pe',
          '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA',
          TRUE
        );

        INSERT INTO sigd_auth.sesion_usuario (id_usuario, refresh_token, emitido_en, expira_en)
        VALUES (
          '20000000-0000-0000-0000-000000000011',
          'refresh-admin-institucional',
          now() - interval '10 minutes',
          now() + interval '1 day'
        );

        INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, vigente_desde)
        SELECT '20000000-0000-0000-0000-000000000011'::uuid, rol_id, now() - interval '1 hour'
          FROM sigd_org.rol_sistema
         WHERE codigo = 'ADMINISTRADOR';
      `);

      const permisosAntes = await cliente.query<{ total: number }>(`
        SELECT COUNT(*)::int AS total
          FROM sigd_org.rol_permiso rp
          JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
         WHERE r.codigo = 'ADMINISTRADOR'
      `);
      expect(permisosAntes.rows[0]?.total).toBeGreaterThan(0);

      // Probar también el caso crítico donde usuario_rol de superadmin se crea en la MISMA transacción (vigente_desde = now()).
      await cliente.query('BEGIN');
      await cliente.query(`
        DELETE FROM sigd_org.usuario_rol
         WHERE id_usuario = (SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE usuario = 'superadmin');
        INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, vigente_desde)
        SELECT c.id_usuario, r.rol_id, now()
          FROM sigd_auth.cuenta_usuario c
         CROSS JOIN sigd_org.rol_sistema r
         WHERE c.usuario = 'superadmin'
           AND r.codigo = 'ADMINISTRADOR';
      `);
      await cliente.query(sql23);
      await cliente.query(sql23);
      await cliente.query('COMMIT');

      // Re-ejecución posterior adicional para verificar idempotencia estricta.
      const marcaAntesReejecucion = await cliente.query<{ revocado_en: Date }>(`
        SELECT s.revocado_en
          FROM sigd_auth.sesion_usuario s
          JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = s.id_usuario
         WHERE c.usuario = 'superadmin'
      `);
      await aplicarAtomico(cliente, sql23);
      const marcaDespuesReejecucion = await cliente.query<{ revocado_en: Date }>(`
        SELECT s.revocado_en
          FROM sigd_auth.sesion_usuario s
          JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = s.id_usuario
         WHERE c.usuario = 'superadmin'
      `);
      expect(marcaDespuesReejecucion.rows[0]?.revocado_en.toISOString()).toBe(
        marcaAntesReejecucion.rows[0]?.revocado_en.toISOString(),
      );

      // Verificaciones sobre superadmin sembrado:
      const estadoSeed = await cliente.query<{
        activo: boolean;
        bloqueado_infinito: boolean;
        intentos_fallidos: number;
      }>(`
        SELECT activo,
               (bloqueado_hasta = 'infinity'::timestamptz) AS bloqueado_infinito,
               intentos_fallidos
          FROM sigd_auth.cuenta_usuario
         WHERE usuario = 'superadmin'
      `);
      expect(estadoSeed.rows[0]).toEqual({
        activo: false,
        bloqueado_infinito: true,
        intentos_fallidos: 0,
      });

      const sesionesSeedActivas = await cliente.query(`
        SELECT 1
          FROM sigd_auth.sesion_usuario s
          JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = s.id_usuario
         WHERE c.usuario = 'superadmin'
           AND s.revocado_en IS NULL
      `);
      expect(sesionesSeedActivas.rowCount).toBe(0);

      const rolesSeedActivos = await cliente.query(`
        SELECT 1
          FROM sigd_org.usuario_rol ur
          JOIN sigd_auth.cuenta_usuario c ON c.id_usuario = ur.id_usuario
         WHERE c.usuario = 'superadmin'
           AND ur.vigente_desde <= now()
           AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
      `);
      expect(rolesSeedActivos.rowCount).toBe(0);

      // Verificaciones sobre permisos globales de ADMINISTRADOR y el otro administrador real:
      const permisosDespues = await cliente.query<{ total: number }>(`
        SELECT COUNT(*)::int AS total
          FROM sigd_org.rol_permiso rp
          JOIN sigd_org.rol_sistema r ON r.rol_id = rp.rol_id
         WHERE r.codigo = 'ADMINISTRADOR'
      `);
      expect(permisosDespues.rows[0]?.total).toBe(permisosAntes.rows[0]?.total);

      const adminReal = await cliente.query<{ activo: boolean; bloqueado_hasta: Date | null }>(`
        SELECT activo, bloqueado_hasta
          FROM sigd_auth.cuenta_usuario
         WHERE usuario = 'admin_institucional'
      `);
      expect(adminReal.rows[0]).toEqual({ activo: true, bloqueado_hasta: null });

      const sesionAdminReal = await cliente.query(`
        SELECT 1
          FROM sigd_auth.sesion_usuario
         WHERE id_usuario = '20000000-0000-0000-0000-000000000011'
           AND revocado_en IS NULL
      `);
      expect(sesionAdminReal.rowCount).toBe(1);

      const rolAdminReal = await cliente.query(`
        SELECT 1
          FROM sigd_org.usuario_rol
         WHERE id_usuario = '20000000-0000-0000-0000-000000000011'
           AND vigente_desde <= now()
           AND (vigente_hasta IS NULL OR vigente_hasta > now())
      `);
      expect(rolAdminReal.rowCount).toBe(1);
    });
  });

  it('24 exige mapeo completo con rollback atómico y convierte actor_id in-place conservando datos, attnum, NOT NULL, índices, relaciones y dependencias', async () => {
    await cluster.conBaseTemporalAislada(async ({ cliente }) => {
      const sql24 = sqlDe('24_sigd_rut_actor_uuid_mapeo_seguro.sql');

      // Sin esquema sigd_rut todavía: no-op seguro.
      await aplicarAtomico(cliente, sql24);

      // Cargar el esquema histórico real 06_sigd_rut.sql (con movimiento_compensatorio y solicitud_compensacion_folios).
      await cliente.query(sqlDe('06_sigd_rut.sql'));

      // Crear rol de prueba, índices simples/compuestos, tabla hija con FK entrante, trigger, comentario, privilegios y vistas dependientes en cadena.
      await cliente.query(`
        DO $role$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigd_lector_rut_test') THEN
            CREATE ROLE sigd_lector_rut_test NOLOGIN;
          END IF;
        END $role$;

        GRANT USAGE ON SCHEMA sigd_rut TO sigd_lector_rut_test;
        GRANT SELECT (id_solicitud, actor_id, estado) ON sigd_rut.solicitud_compensacion_folios TO sigd_lector_rut_test;
        COMMENT ON COLUMN sigd_rut.solicitud_compensacion_folios.actor_id IS 'Identificador IdentiCore del actor solicitante';

        CREATE INDEX ix_solicitud_folios_actor
          ON sigd_rut.solicitud_compensacion_folios (actor_id);
        CREATE INDEX ix_solicitud_folios_actor_estado
          ON sigd_rut.solicitud_compensacion_folios (actor_id, estado);

        CREATE TABLE sigd_rut.seguimiento_compensacion_test (
          id_seguimiento uuid PRIMARY KEY,
          id_solicitud uuid NOT NULL
            REFERENCES sigd_rut.solicitud_compensacion_folios (id_solicitud) ON DELETE RESTRICT,
          nota text NOT NULL
        );

        CREATE FUNCTION sigd_rut.fn_touch_actualizado_solicitud_test()
        RETURNS trigger LANGUAGE plpgsql AS $fn$
        BEGIN
          NEW.actualizado_en := CURRENT_TIMESTAMP(3);
          RETURN NEW;
        END $fn$;

        CREATE TRIGGER tr_touch_actualizado_solicitud_test
          BEFORE UPDATE ON sigd_rut.solicitud_compensacion_folios
          FOR EACH ROW EXECUTE FUNCTION sigd_rut.fn_touch_actualizado_solicitud_test();

        CREATE VIEW sigd_rut.v_solicitudes_compensacion_actor AS
          SELECT id_solicitud, expediente_id, actor_id, estado
            FROM sigd_rut.solicitud_compensacion_folios;

        COMMENT ON VIEW sigd_rut.v_solicitudes_compensacion_actor IS 'Vista operativa de solicitudes por actor';
        GRANT SELECT ON sigd_rut.v_solicitudes_compensacion_actor TO sigd_lector_rut_test;

        CREATE VIEW sigd_rut.v_resumen_compensacion_actor AS
          SELECT actor_id, COUNT(*)::bigint AS total_solicitudes
            FROM sigd_rut.v_solicitudes_compensacion_actor
           GROUP BY actor_id;
      `);

      // Sembrar movimientos ordinarios, asientos compensatorios padres y 3 solicitudes históricas (actor_id 7 repetido y actor_id 42).
      await cliente.query(`
        INSERT INTO sigd_rut.movimiento_tramite (
          id_movimiento, expediente_id, estado_anterior, evento, estado_nuevo,
          usuario_operador_id, fecha_hora, datos
        ) VALUES
          (
            '30000000-0000-0000-0000-000000000301',
            '30000000-0000-0000-0000-000000000001',
            'REGISTRADO', 'RECEPCION', 'RECEPCIONADO',
            '30000000-0000-0000-0000-000000000901', '2026-10-01T09:00:00Z', '{}'::jsonb
          ),
          (
            '30000000-0000-0000-0000-000000000302',
            '30000000-0000-0000-0000-000000000002',
            'REGISTRADO', 'RECEPCION', 'RECEPCIONADO',
            '30000000-0000-0000-0000-000000000901', '2026-10-01T09:30:00Z', '{}'::jsonb
          ),
          (
            '30000000-0000-0000-0000-000000000303',
            '30000000-0000-0000-0000-000000000003',
            'REGISTRADO', 'RECEPCION', 'RECEPCIONADO',
            '30000000-0000-0000-0000-000000000902', '2026-10-01T09:45:00Z', '{}'::jsonb
          );

        INSERT INTO sigd_rut.movimiento_compensatorio (
          id_movimiento, expediente_id, estado_anterior, estado_nuevo, usuario_operador_id,
          fecha_hora, correlation_id, clave_idempotencia, movimiento_objetivo_fecha_hora,
          movimiento_objetivo_id, movimiento_objetivo_secuencia, huella_comando, motivo,
          compensacion_folios, datos
        ) VALUES
          (
            '30000000-0000-0000-0000-000000000101',
            '30000000-0000-0000-0000-000000000001',
            'EN_CALIFICACION', 'RECEPCIONADO', '30000000-0000-0000-0000-000000000901',
            '2026-10-01T10:00:00Z', 'corr-1', '30000000-0000-0000-0000-000000000201',
            '2026-10-01T09:00:00Z', '30000000-0000-0000-0000-000000000301', 1, 'huella-1', 'Motivo compensación 1',
            '{}'::jsonb, '{}'::jsonb
          ),
          (
            '30000000-0000-0000-0000-000000000102',
            '30000000-0000-0000-0000-000000000002',
            'EN_CALIFICACION', 'RECEPCIONADO', '30000000-0000-0000-0000-000000000901',
            '2026-10-01T11:00:00Z', 'corr-2', '30000000-0000-0000-0000-000000000202',
            '2026-10-01T09:30:00Z', '30000000-0000-0000-0000-000000000302', 1, 'huella-2', 'Motivo compensación 2',
            '{}'::jsonb, '{}'::jsonb
          ),
          (
            '30000000-0000-0000-0000-000000000103',
            '30000000-0000-0000-0000-000000000003',
            'EN_CALIFICACION', 'RECEPCIONADO', '30000000-0000-0000-0000-000000000902',
            '2026-10-01T12:00:00Z', 'corr-3', '30000000-0000-0000-0000-000000000203',
            '2026-10-01T09:45:00Z', '30000000-0000-0000-0000-000000000303', 1, 'huella-3', 'Motivo compensación 3',
            '{}'::jsonb, '{}'::jsonb
          );

        INSERT INTO sigd_rut.solicitud_compensacion_folios (
          id_solicitud, expediente_id, movimiento_original_id, movimiento_compensatorio_id,
          rango_afectado, motivo, actor_id, correlation_id, clave_idempotencia, estado
        ) VALUES
          (
            '40000000-0000-0000-0000-000000000001',
            '30000000-0000-0000-0000-000000000001',
            '30000000-0000-0000-0000-000000000301',
            '30000000-0000-0000-0000-000000000101',
            '{"inicio": 1, "fin": 3}'::jsonb,
            'Reversión folio lote A', 7, 'corr-1', '50000000-0000-0000-0000-000000000001', 'PENDIENTE'
          ),
          (
            '40000000-0000-0000-0000-000000000002',
            '30000000-0000-0000-0000-000000000002',
            '30000000-0000-0000-0000-000000000302',
            '30000000-0000-0000-0000-000000000102',
            NULL,
            'Reversión folio lote B', 7, 'corr-2', '50000000-0000-0000-0000-000000000002', 'COMPLETADO'
          ),
          (
            '40000000-0000-0000-0000-000000000003',
            '30000000-0000-0000-0000-000000000003',
            '30000000-0000-0000-0000-000000000303',
            '30000000-0000-0000-0000-000000000103',
            '{"inicio": 4, "fin": 5}'::jsonb,
            'Reversión folio lote C', 42, 'corr-3', '50000000-0000-0000-0000-000000000003', 'PENDIENTE'
          );

        INSERT INTO sigd_rut.seguimiento_compensacion_test (id_seguimiento, id_solicitud, nota)
        VALUES ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Seguimiento inicial');
      `);

      const attnumAntesRes = await cliente.query<{ attnum: number }>(`
        SELECT attnum::int AS attnum
          FROM pg_catalog.pg_attribute
         WHERE attrelid = 'sigd_rut.solicitud_compensacion_folios'::regclass
           AND attname = 'actor_id'
           AND NOT attisdropped
      `);
      const attnumAntes = attnumAntesRes.rows[0]?.attnum;
      expect(attnumAntes).toBeGreaterThan(0);

      // 1) Sin mapeo: aborta y hace rollback atómico completo.
      await expect(aplicarAtomico(cliente, sql24)).rejects.toThrow(/3 fila\(s\) no tienen correspondencia/i);

      const tipoTrasFallo1 = await cliente.query<{ data_type: string }>(`
        SELECT data_type
          FROM information_schema.columns
         WHERE table_schema = 'sigd_rut'
           AND table_name = 'solicitud_compensacion_folios'
           AND column_name = 'actor_id'
      `);
      expect(tipoTrasFallo1.rows[0]?.data_type).toBe('bigint');

      // 2) Mapeo parcial (solo actor 7, falta actor 42): aborta y hace rollback atómico.
      await cliente.query(`
        CREATE TABLE sigd_rut.actor_id_uuid_mapeo (
          actor_id_numerico BIGINT PRIMARY KEY,
          actor_uuid UUID NOT NULL UNIQUE,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        INSERT INTO sigd_rut.actor_id_uuid_mapeo (actor_id_numerico, actor_uuid)
        VALUES (7, '70000000-0000-0000-0000-000000000007');
      `);

      await expect(aplicarAtomico(cliente, sql24)).rejects.toThrow(/1 fila\(s\) no tienen correspondencia/i);

      const tipoTrasFallo2 = await cliente.query<{ data_type: string }>(`
        SELECT data_type
          FROM information_schema.columns
         WHERE table_schema = 'sigd_rut'
           AND table_name = 'solicitud_compensacion_folios'
           AND column_name = 'actor_id'
      `);
      expect(tipoTrasFallo2.rows[0]?.data_type).toBe('bigint');

      // 3) Mapeo completo: convierte in-place y soporta ejecuciones repetidas (idempotencia).
      await cliente.query(`
        INSERT INTO sigd_rut.actor_id_uuid_mapeo (actor_id_numerico, actor_uuid)
        VALUES (42, '70000000-0000-0000-0000-000000000042');
      `);

      await aplicarAtomico(cliente, sql24);
      await aplicarAtomico(cliente, sql24);
      await aplicarAtomico(cliente, sql24);

      // Identidad de columna (attnum), tipo UUID y restricción NOT NULL conservados:
      const colFinal = await cliente.query<{ attnum: number; tipo: string; notnull: boolean; comentario: string | null }>(`
        SELECT a.attnum::int AS attnum,
               pg_catalog.format_type(a.atttypid, a.atttypmod) AS tipo,
               a.attnotnull AS notnull,
               pg_catalog.col_description(a.attrelid, a.attnum) AS comentario
          FROM pg_catalog.pg_attribute a
         WHERE a.attrelid = 'sigd_rut.solicitud_compensacion_folios'::regclass
           AND a.attname = 'actor_id'
           AND NOT a.attisdropped
      `);
      expect(colFinal.rows[0]).toEqual({
        attnum: attnumAntes,
        tipo: 'uuid',
        notnull: true,
        comentario: 'Identificador IdentiCore del actor solicitante',
      });

      // Datos exactos conservados sin pérdidas:
      const filas = await cliente.query<{ id_solicitud: string; actor_id: string; motivo: string; estado: string }>(`
        SELECT id_solicitud::text, actor_id::text, motivo, estado
          FROM sigd_rut.solicitud_compensacion_folios
         ORDER BY id_solicitud
      `);
      expect(filas.rows).toEqual([
        {
          id_solicitud: '40000000-0000-0000-0000-000000000001',
          actor_id: '70000000-0000-0000-0000-000000000007',
          motivo: 'Reversión folio lote A',
          estado: 'PENDIENTE',
        },
        {
          id_solicitud: '40000000-0000-0000-0000-000000000002',
          actor_id: '70000000-0000-0000-0000-000000000007',
          motivo: 'Reversión folio lote B',
          estado: 'COMPLETADO',
        },
        {
          id_solicitud: '40000000-0000-0000-0000-000000000003',
          actor_id: '70000000-0000-0000-0000-000000000042',
          motivo: 'Reversión folio lote C',
          estado: 'PENDIENTE',
        },
      ]);

      // Índices simples, compuestos e históricos reconstruidos y válidos:
      const indices = await cliente.query<{ indexname: string; indisvalid: boolean }>(`
        SELECT c.relname AS indexname, idx.indisvalid
          FROM pg_catalog.pg_index idx
          JOIN pg_catalog.pg_class c ON c.oid = idx.indexrelid
         WHERE idx.indrelid = 'sigd_rut.solicitud_compensacion_folios'::regclass
      `);
      for (const esperado of [
        'ix_solicitud_folios_estado_fecha',
        'ix_solicitud_folios_actor',
        'ix_solicitud_folios_actor_estado',
      ]) {
        expect(indices.rows.find((i) => i.indexname === esperado)).toEqual({
          indexname: esperado,
          indisvalid: true,
        });
      }

      // Relaciones FK (entrante ON DELETE RESTRICT -> 23001 y saliente a movimiento_compensatorio -> 23503) activas:
      await expect(
        cliente.query(`
          DELETE FROM sigd_rut.solicitud_compensacion_folios
           WHERE id_solicitud = '40000000-0000-0000-0000-000000000001'
        `),
      ).rejects.toMatchObject({ code: '23001' });

      await expect(
        cliente.query(`
          INSERT INTO sigd_rut.solicitud_compensacion_folios (
            id_solicitud, expediente_id, movimiento_original_id, movimiento_compensatorio_id,
            motivo, actor_id, correlation_id, clave_idempotencia
          ) VALUES (
            '40000000-0000-0000-0000-000000000099',
            '30000000-0000-0000-0000-000000000001',
            '30000000-0000-0000-0000-000000000301',
            '30000000-0000-0000-0000-000000009999',
            'FK inexistente',
            '70000000-0000-0000-0000-000000000007',
            'corr-99',
            '50000000-0000-0000-0000-000000000099'
          )
        `),
      ).rejects.toMatchObject({ code: '23503' });

      // Vistas dependientes directa y transitiva preservadas con privilegios y comentarios:
      const resumenVista = await cliente.query<{ actor_id: string; total_solicitudes: string }>(`
        SELECT actor_id::text, total_solicitudes::text
          FROM sigd_rut.v_resumen_compensacion_actor
         ORDER BY actor_id
      `);
      expect(resumenVista.rows).toEqual([
        { actor_id: '70000000-0000-0000-0000-000000000007', total_solicitudes: '2' },
        { actor_id: '70000000-0000-0000-0000-000000000042', total_solicitudes: '1' },
      ]);

      const comentarioVista = await cliente.query<{ comentario: string | null }>(
        "SELECT obj_description('sigd_rut.v_solicitudes_compensacion_actor'::regclass, 'pg_class') AS comentario",
      );
      expect(comentarioVista.rows[0]?.comentario).toBe('Vista operativa de solicitudes por actor');

      const privilegiosConservados = await cliente.query<{ col_priv: boolean; view_priv: boolean }>(`
        SELECT has_column_privilege('sigd_lector_rut_test', 'sigd_rut.solicitud_compensacion_folios', 'actor_id', 'SELECT') AS col_priv,
               has_table_privilege('sigd_lector_rut_test', 'sigd_rut.v_solicitudes_compensacion_actor', 'SELECT') AS view_priv
      `);
      expect(privilegiosConservados.rows[0]).toEqual({ col_priv: true, view_priv: true });

      // Trigger preservado y función auxiliar temporal retirada:
      await cliente.query(`
        UPDATE sigd_rut.solicitud_compensacion_folios
           SET actualizado_en = '2020-01-01T00:00:00Z'
         WHERE id_solicitud = '40000000-0000-0000-0000-000000000001'
      `);
      const tsTrigger = await cliente.query<{ actualizado_reciente: boolean }>(`
        SELECT (actualizado_en > '2025-01-01T00:00:00Z'::timestamptz) AS actualizado_reciente
          FROM sigd_rut.solicitud_compensacion_folios
         WHERE id_solicitud = '40000000-0000-0000-0000-000000000001'
      `);
      expect(tsTrigger.rows[0]?.actualizado_reciente).toBe(true);

      const fnTemporal = await cliente.query<{ fn: string | null }>(
        "SELECT to_regprocedure('sigd_rut._map_actor_id_uuid(bigint)')::text AS fn",
      );
      expect(fnTemporal.rows[0]?.fn).toBeNull();
    });
  });

  it('ejecuta el runner oficial con ledger SHA-256 sobre 22, 23 y 24 (tabla vacía) de forma atómica e idempotente', async () => {
    await cluster.conBaseTemporalAislada(async ({ cliente, crearPool }) => {
      await cliente.query(sqlDe('02_sigd_auth.sql'));
      await cliente.query(sqlDe('03_sigd_org.sql'));
      await cliente.query(sqlDe('06_sigd_rut.sql'));
      await cliente.query(sqlDe('08_sigd_auth_bloqueo_cuentas.sql'));
      await cliente.query(sqlDe('15_sigd_superadmin.sql'));

      const dirTemporal = mkdtempSync(path.join(os.tmpdir(), 'sigd-mig-runner-'));
      const previoDir = process.env.MIGRATIONS_DIR;

      try {
        for (const nombre of [
          '22_sigd_refresh_token_idempotente.sql',
          '23_sigd_superadmin_hardening.sql',
          '24_sigd_rut_actor_uuid_mapeo_seguro.sql',
        ]) {
          writeFileSync(path.join(dirTemporal, nombre), sqlDe(nombre), 'utf8');
        }

        process.env.MIGRATIONS_DIR = dirTemporal;
        const pool = crearPool();

        const primeraCorrida = await ejecutarMigraciones(pool);
        expect(primeraCorrida).toEqual([
          '22_sigd_refresh_token_idempotente.sql',
          '23_sigd_superadmin_hardening.sql',
          '24_sigd_rut_actor_uuid_mapeo_seguro.sql',
        ]);

        const segundaCorrida = await ejecutarMigraciones(pool);
        expect(segundaCorrida).toEqual([]);

        const registradas = await listarMigracionesAplicadas(pool);
        expect(registradas.map((r) => r.nombre_script)).toEqual([
          '22_sigd_refresh_token_idempotente.sql',
          '23_sigd_superadmin_hardening.sql',
          '24_sigd_rut_actor_uuid_mapeo_seguro.sql',
        ]);

        const tipoActor = await cliente.query<{ data_type: string }>(`
          SELECT data_type
            FROM information_schema.columns
           WHERE table_schema = 'sigd_rut'
             AND table_name = 'solicitud_compensacion_folios'
             AND column_name = 'actor_id'
        `);
        expect(tipoActor.rows[0]?.data_type).toBe('uuid');
      } finally {
        if (previoDir === undefined) {
          delete process.env.MIGRATIONS_DIR;
        } else {
          process.env.MIGRATIONS_DIR = previoDir;
        }
        rmSync(dirTemporal, { recursive: true, force: true });
      }
    });
  });
});

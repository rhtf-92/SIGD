import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const sqlDe = (nombre: string) => readFileSync(path.join(raiz, 'migraciones', nombre), 'utf8');

describe('migraciones correctivas: PostgreSQL real, atomicidad e idempotencia', () => {
  let contenedor: StartedPostgreSqlContainer;
  let cliente: Client;

  beforeAll(async () => {
    const urlExterna = process.env.MIGRATION_TEST_DATABASE_URL;
    if (urlExterna) {
      cliente = new Client({ connectionString: urlExterna });
    } else {
      contenedor = await new PostgreSqlContainer('postgres:18-alpine').start();
      cliente = new Client({
        connectionString: `postgres://${encodeURIComponent(contenedor.getUsername())}:${encodeURIComponent(contenedor.getPassword())}@${contenedor.getHost()}:${contenedor.getPort()}/${contenedor.getDatabase()}`,
      });
    }
    await cliente.connect();
    await cliente.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  }, 120_000);

  beforeEach(async () => {
    await cliente.query('DROP SCHEMA IF EXISTS sigd_auth CASCADE');
    await cliente.query('DROP SCHEMA IF EXISTS sigd_org CASCADE');
    await cliente.query('DROP SCHEMA IF EXISTS sigd_rut CASCADE');
  });

  afterAll(async () => {
    await cliente?.end();
    await contenedor?.stop();
  }, 120_000);

  async function aplicarAtomico(sql: string): Promise<void> {
    await cliente.query('BEGIN');
    try {
      await cliente.query(sql);
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    }
  }

  it('22 convierte TEXT y puede ejecutarse dos veces', async () => {
    await cliente.query('CREATE SCHEMA sigd_auth');
    await cliente.query(`CREATE TABLE sigd_auth.sesion_usuario (
      id_sesion uuid PRIMARY KEY DEFAULT gen_random_uuid(), refresh_token varchar(255) NOT NULL)`);
    const sql = sqlDe('22_sigd_refresh_token_idempotente.sql');

    await aplicarAtomico(sql);
    await aplicarAtomico(sql);

    const resultado = await cliente.query<{ data_type: string }>(`SELECT data_type
      FROM information_schema.columns WHERE table_schema = 'sigd_auth'
      AND table_name = 'sesion_usuario' AND column_name = 'refresh_token'`);
    expect(resultado.rows[0]?.data_type).toBe('text');
    await cliente.query('DROP SCHEMA sigd_auth CASCADE');
  });

  it('23 deshabilita credencial conocida, revoca sesión/rol y retira permisos masivos', async () => {
    await cliente.query('CREATE SCHEMA sigd_auth');
    await cliente.query('CREATE SCHEMA sigd_org');
    await cliente.query(`CREATE TABLE sigd_auth.cuenta_usuario (
      id_usuario uuid PRIMARY KEY, usuario text UNIQUE NOT NULL, correo text UNIQUE NOT NULL,
      activo boolean NOT NULL DEFAULT true, bloqueado_hasta timestamptz,
      intentos_fallidos smallint NOT NULL DEFAULT 0, password_hash text NOT NULL)`);
    await cliente.query(`CREATE TABLE sigd_auth.sesion_usuario (
      id_sesion uuid PRIMARY KEY, id_usuario uuid NOT NULL, revocado_en timestamptz)`);
    await cliente.query(`CREATE TABLE sigd_org.rol_sistema (
      rol_id uuid PRIMARY KEY, codigo text UNIQUE NOT NULL)`);
    await cliente.query(`CREATE TABLE sigd_org.usuario_rol (
      id_usuario_rol uuid PRIMARY KEY, id_usuario uuid NOT NULL, rol_id uuid NOT NULL,
      vigente_desde timestamptz NOT NULL, vigente_hasta timestamptz)`);
    await cliente.query(`CREATE TABLE sigd_org.rol_permiso (rol_id uuid NOT NULL, permiso_id uuid NOT NULL)`);
    await cliente.query(`INSERT INTO sigd_auth.cuenta_usuario
      (id_usuario, usuario, correo, password_hash) VALUES
      ('00000000-0000-0000-0000-000000000001', 'superadmin', 'superadmin@sigd.local', '$argon2id$known')`);
    await cliente.query(`INSERT INTO sigd_org.rol_sistema (rol_id, codigo)
      VALUES ('00000000-0000-0000-0000-000000000002', 'ADMINISTRADOR')`);
    await cliente.query(`INSERT INTO sigd_auth.sesion_usuario (id_sesion, id_usuario)
      VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001')`);
    await cliente.query(`INSERT INTO sigd_org.usuario_rol
      (id_usuario_rol, id_usuario, rol_id, vigente_desde)
      VALUES ('00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', now())`);
    await cliente.query(`INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id) VALUES
      ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005'),
      ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006')`);

    const sql = sqlDe('23_sigd_superadmin_hardening.sql');
    await aplicarAtomico(sql);
    await aplicarAtomico(sql);

    const cuenta = await cliente.query<{ activo: boolean }>(
      `SELECT activo FROM sigd_auth.cuenta_usuario WHERE usuario = 'superadmin'`,
    );
    const sesiones = await cliente.query(`SELECT 1 FROM sigd_auth.sesion_usuario WHERE revocado_en IS NULL`);
    const roles = await cliente.query(`SELECT 1 FROM sigd_org.usuario_rol WHERE vigente_hasta IS NULL OR vigente_hasta > now()`);
    const permisos = await cliente.query(`SELECT 1 FROM sigd_org.rol_permiso`);
    expect(cuenta.rows[0]?.activo).toBe(false);
    expect(sesiones.rowCount).toBe(0);
    expect(roles.rowCount).toBe(0);
    expect(permisos.rowCount).toBe(0);
    await cliente.query('DROP SCHEMA sigd_auth CASCADE');
    await cliente.query('DROP SCHEMA sigd_org CASCADE');
  });

  it('24 exige mapeo, conserva datos y es idempotente', async () => {
    await cliente.query('CREATE SCHEMA sigd_rut');
    await cliente.query(`CREATE TABLE sigd_rut.solicitud_compensacion_folios (
      id_solicitud uuid PRIMARY KEY, actor_id bigint NOT NULL)`);
    await cliente.query(`INSERT INTO sigd_rut.solicitud_compensacion_folios
      (id_solicitud, actor_id) VALUES ('00000000-0000-0000-0000-000000000007', 7)`);
    const sql = sqlDe('24_sigd_rut_actor_uuid_mapeo_seguro.sql');

    await expect(aplicarAtomico(sql)).rejects.toThrow(/no tienen correspondencia/i);
    const tipoAntes = await cliente.query<{ data_type: string }>(`SELECT data_type
      FROM information_schema.columns WHERE table_schema = 'sigd_rut'
      AND table_name = 'solicitud_compensacion_folios' AND column_name = 'actor_id'`);
    expect(tipoAntes.rows[0]?.data_type).toBe('bigint');

    await cliente.query(`CREATE TABLE sigd_rut.actor_id_uuid_mapeo (
      actor_id_numerico bigint PRIMARY KEY, actor_uuid uuid NOT NULL UNIQUE,
      creado_en timestamptz NOT NULL DEFAULT now())`);
    await cliente.query(`INSERT INTO sigd_rut.actor_id_uuid_mapeo (actor_id_numerico, actor_uuid)
      VALUES (7, '00000000-0000-0000-0000-000000000008')`);
    await aplicarAtomico(sql);
    await aplicarAtomico(sql);

    const fila = await cliente.query<{ actor_id: string }>(
      `SELECT actor_id::text FROM sigd_rut.solicitud_compensacion_folios`,
    );
    expect(fila.rows[0]?.actor_id).toBe('00000000-0000-0000-0000-000000000008');
    await cliente.query('DROP SCHEMA sigd_rut CASCADE');
  });
});

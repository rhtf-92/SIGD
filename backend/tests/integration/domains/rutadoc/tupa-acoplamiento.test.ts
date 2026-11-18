import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let contenedor: StartedPostgreSqlContainer;
let cliente: Client;
const migraciones = ['01_sigd_audit.sql', '02_sigd_auth.sql', '03_sigd_org.sql', '04_sigd_doc.sql', '05_sigd_tra.sql'];
const migracionNueva = '08_sigd_tupa_acoplamiento.sql';

function sql(nombre: string): string {
  return readFileSync(path.resolve(process.cwd(), 'migraciones', nombre), 'utf8');
}

async function crearExpediente(): Promise<string> {
  const documento = `T${randomUUID().replaceAll('-', '').slice(0, 18)}`;
  const persona = await cliente.query<{ id_persona: string }>(
    `INSERT INTO sigd_auth.persona (tipo, id_documento) VALUES ('NATURAL', $1) RETURNING id_persona`,
    [documento],
  );
  const expediente = await cliente.query<{ expediente_id: string }>(
    `INSERT INTO sigd_tra.expediente (codigo_expediente, numero, tipo_documental_id, solicitante_id)
     VALUES (NULL, $1, $2, $3) RETURNING expediente_id`,
    [`PR-${randomUUID().slice(0, 8)}`, randomUUID(), persona.rows[0].id_persona],
  );
  return expediente.rows[0].expediente_id;
}

async function crearVersion(estado = 'PENDIENTE_VALIDACION'): Promise<string> {
  const version = await cliente.query<{ registro_version_id: string }>(
    `INSERT INTO sigd_doc.tupa_registro_version
      (documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
       denominacion_original, estado_validacion, referencia_aprobacion)
     VALUES ($1, 'fuente de prueba', 1, $2, 1, 'Procedimiento de prueba', $3, $4)
     RETURNING registro_version_id`,
    [randomUUID().replaceAll('-', '').padEnd(64, '0'), randomUUID(), estado,
      estado === 'APROBADO' ? 'acta-prueba' : null],
  );
  return version.rows[0].registro_version_id;
}

async function comprobarTruncateRechazado(tabla: 'tupa_registro_version' | 'expediente_tupa_vinculo'): Promise<void> {
  const nombre = `sigd_doc.${tabla}`;
  const esVersion = tabla === 'tupa_registro_version';
  const previo = await cliente.query<{ total: string }>(`SELECT count(*)::text AS total FROM ${nombre}`);
  expect(Number(previo.rows[0].total)).toBeGreaterThan(0);
  await cliente.query('BEGIN');
  try {
    await cliente.query('SAVEPOINT antes_de_truncate');
    if (esVersion) {
      await expect(cliente.query(`TRUNCATE TABLE ${nombre}`)).rejects.toMatchObject({ code: '0A000' });
      await cliente.query('ROLLBACK TO SAVEPOINT antes_de_truncate');
      await cliente.query('SAVEPOINT antes_de_truncate');
    }
    await expect(cliente.query(`TRUNCATE TABLE ${nombre}${esVersion ? ' CASCADE' : ''}`))
      .rejects.toMatchObject({ code: '23001' });
    await cliente.query('ROLLBACK TO SAVEPOINT antes_de_truncate');
    const posterior = await cliente.query<{ total: string }>(`SELECT count(*)::text AS total FROM ${nombre}`);
    expect(posterior.rows[0].total).toBe(previo.rows[0].total);
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  }
  const confirmado = await cliente.query<{ total: string }>(`SELECT count(*)::text AS total FROM ${nombre}`);
  expect(confirmado.rows[0].total).toBe(previo.rows[0].total);
}

describe('Base TUPA Geric en PostgreSQL 18 aislado', () => {
  beforeAll(async () => {
    contenedor = await new PostgreSqlContainer('postgres:18-alpine').withDatabase('sigd_tupa_geric_test').start();
    cliente = new Client({ connectionString: contenedor.getConnectionUri() });
    await cliente.connect();
    for (const nombre of migraciones) await cliente.query(sql(nombre));
  });

  afterAll(async () => {
    await cliente?.end();
    await contenedor?.stop();
  });

  it('instala 08 dos veces sin alterar el catálogo legado ni publicar tarifas', async () => {
    const anteriores = await cliente.query<{ total: string }>('SELECT count(*)::text AS total FROM sigd_doc.tipo_tramite_tupa');
    await cliente.query(sql(migracionNueva));
    await cliente.query(sql(migracionNueva));
    const conteos = await cliente.query<{ versiones: string; vinculos: string; legado: string }>(`
      SELECT (SELECT count(*) FROM sigd_doc.tupa_registro_version)::text AS versiones,
             (SELECT count(*) FROM sigd_doc.expediente_tupa_vinculo)::text AS vinculos,
             (SELECT count(*) FROM sigd_doc.tipo_tramite_tupa)::text AS legado`);
    expect(conteos.rows[0]).toEqual({ versiones: '0', vinculos: '0', legado: anteriores.rows[0].total });
  });

  it('conserva identidad UUID física y la vinculación opcional por FK', async () => {
    const columnas = await cliente.query<{ tabla: string; columna: string; tipo: string }>(`
      SELECT table_name AS tabla, column_name AS columna, udt_name AS tipo
      FROM information_schema.columns
      WHERE table_schema = 'sigd_doc'
        AND (table_name, column_name) IN
          (('expediente_tupa_vinculo', 'expediente_id'), ('expediente_tupa_vinculo', 'registro_version_id'))
      ORDER BY column_name`);
    expect(columnas.rows).toEqual([
      { tabla: 'expediente_tupa_vinculo', columna: 'expediente_id', tipo: 'uuid' },
      { tabla: 'expediente_tupa_vinculo', columna: 'registro_version_id', tipo: 'uuid' },
    ]);
    const expediente = await crearExpediente();
    const version = await crearVersion('APROBADO');
    await cliente.query(
      'INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id) VALUES ($1, $2)',
      [expediente, version],
    );
    await expect(cliente.query(
      'INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id) VALUES ($1, $2)',
      [randomUUID(), version],
    )).rejects.toMatchObject({ code: '23503' });
  });

  it('conserva procedencia versionada sin unicidad global del código externo', async () => {
    const hash = 'a'.repeat(64);
    await cliente.query(`INSERT INTO sigd_doc.tupa_registro_version
      (documento_sha256, fuente_nombre, pagina, referencia_fila, revision, codigo_externo, denominacion_original)
      VALUES ($1, 'PDF de prueba', 2, 'fila-a', 1, 'COD-1', 'Prueba')`, [hash]);
    await expect(cliente.query(`INSERT INTO sigd_doc.tupa_registro_version
      (documento_sha256, fuente_nombre, pagina, referencia_fila, revision, codigo_externo, denominacion_original)
      VALUES ($1, 'PDF de prueba', 2, 'fila-a', 1, 'COD-1', 'Prueba')`, [hash]))
      .rejects.toMatchObject({ code: '23505' });
    await cliente.query(`INSERT INTO sigd_doc.tupa_registro_version
      (documento_sha256, fuente_nombre, pagina, referencia_fila, revision, codigo_externo, denominacion_original)
      VALUES ($1, 'PDF de prueba', 2, 'fila-a', 2, 'COD-1', 'Prueba corregida')`, [hash]);
  });

  it('impide vincular registros pendientes o declarar aprobación sin respaldo', async () => {
    const expediente = await crearExpediente();
    const pendiente = await crearVersion();
    await expect(cliente.query(
      'INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id) VALUES ($1, $2)',
      [expediente, pendiente],
    )).rejects.toMatchObject({ code: '23514' });
    await expect(cliente.query(`INSERT INTO sigd_doc.tupa_registro_version
      (documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
       denominacion_original, estado_validacion)
      VALUES ($1, 'PDF de prueba', 1, 'fila', 1, 'Prueba', 'APROBADO')`, ['b'.repeat(64)]))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('mantiene una cadena de correcciones del mismo expediente sin reescribir vínculos', async () => {
    const expediente = await crearExpediente();
    const otroExpediente = await crearExpediente();
    const version1 = await crearVersion('APROBADO');
    const version2 = await crearVersion('APROBADO');
    const original = await cliente.query<{ vinculo_id: string }>(
      `INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id)
       VALUES ($1, $2) RETURNING vinculo_id`, [expediente, version1],
    );
    await expect(cliente.query(
      `INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id, reemplaza_vinculo_id)
       VALUES ($1, $2, $3)`, [otroExpediente, version2, original.rows[0].vinculo_id],
    )).rejects.toMatchObject({ code: '23514' });
    await cliente.query(
      `INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id, reemplaza_vinculo_id)
       VALUES ($1, $2, $3)`, [expediente, version2, original.rows[0].vinculo_id],
    );
    await expect(cliente.query(
      `INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id, reemplaza_vinculo_id)
       VALUES ($1, $2, $3)`, [expediente, version1, original.rows[0].vinculo_id],
    )).rejects.toMatchObject({ code: '23505' });
    await expect(cliente.query(
      `UPDATE sigd_doc.expediente_tupa_vinculo SET motivo = 'alterado' WHERE vinculo_id = $1`,
      [original.rows[0].vinculo_id],
    )).rejects.toMatchObject({ code: '23001' });
  });

  it('impide un segundo vínculo raíz y protege versiones y vínculos contra borrado', async () => {
    const expediente = await crearExpediente();
    const version = await crearVersion('APROBADO');
    const vinculo = await cliente.query<{ vinculo_id: string }>(
      `INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id)
       VALUES ($1, $2) RETURNING vinculo_id`, [expediente, version],
    );
    await expect(cliente.query(
      `INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id)
       VALUES ($1, $2)`, [expediente, version],
    )).rejects.toMatchObject({ code: '23505' });
    await expect(cliente.query(
      `UPDATE sigd_doc.tupa_registro_version SET monto_original = '1.00'
       WHERE registro_version_id = $1`, [version],
    )).rejects.toMatchObject({ code: '23001' });
    await expect(cliente.query(
      `DELETE FROM sigd_doc.expediente_tupa_vinculo WHERE vinculo_id = $1`,
      [vinculo.rows[0].vinculo_id],
    )).rejects.toMatchObject({ code: '23001' });
    await expect(cliente.query(
      `DELETE FROM sigd_doc.tupa_registro_version WHERE registro_version_id = $1`, [version],
    )).rejects.toMatchObject({ code: '23001' });
  });

  it('revierte versiones y vínculos juntos si falla la transacción', async () => {
    const expediente = await crearExpediente();
    const previo = await cliente.query<{ versiones: string; vinculos: string }>(`
      SELECT (SELECT count(*) FROM sigd_doc.tupa_registro_version)::text AS versiones,
             (SELECT count(*) FROM sigd_doc.expediente_tupa_vinculo)::text AS vinculos`);
    await cliente.query('BEGIN');
    try {
      const version = await crearVersion('APROBADO');
      await cliente.query(
        'INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id) VALUES ($1, $2)',
        [expediente, version],
      );
    } finally {
      await cliente.query('ROLLBACK');
    }
    const posterior = await cliente.query<{ versiones: string; vinculos: string }>(`
      SELECT (SELECT count(*) FROM sigd_doc.tupa_registro_version)::text AS versiones,
             (SELECT count(*) FROM sigd_doc.expediente_tupa_vinculo)::text AS vinculos`);
    expect(posterior.rows[0]).toEqual(previo.rows[0]);
  });

  it('reinstala 08 con datos sin duplicarlos ni alterar los vínculos', async () => {
    const previo = await cliente.query<{ versiones: string; vinculos: string }>(`
      SELECT (SELECT count(*) FROM sigd_doc.tupa_registro_version)::text AS versiones,
             (SELECT count(*) FROM sigd_doc.expediente_tupa_vinculo)::text AS vinculos`);
    await cliente.query(sql(migracionNueva));
    const posterior = await cliente.query<{ versiones: string; vinculos: string }>(`
      SELECT (SELECT count(*) FROM sigd_doc.tupa_registro_version)::text AS versiones,
             (SELECT count(*) FROM sigd_doc.expediente_tupa_vinculo)::text AS vinculos`);
    expect(posterior.rows[0]).toEqual(previo.rows[0]);
    await comprobarTruncateRechazado('tupa_registro_version');
    await comprobarTruncateRechazado('expediente_tupa_vinculo');
  });

  it('rechaza TRUNCATE de versiones sin perder registros y permite continuar la transacción', async () => {
    await crearVersion('APROBADO');
    await comprobarTruncateRechazado('tupa_registro_version');
  });

  it('rechaza TRUNCATE de vínculos sin perder registros y permite continuar la transacción', async () => {
    const expediente = await crearExpediente();
    const version = await crearVersion('APROBADO');
    await cliente.query(
      'INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id) VALUES ($1, $2)',
      [expediente, version],
    );
    await comprobarTruncateRechazado('expediente_tupa_vinculo');
  });
});

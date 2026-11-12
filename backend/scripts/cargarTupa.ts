import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import { crearPool } from '../src/database.js';
import { parsearTupaMarkdown } from '../src/domains/tupa/tupa.parser.js';

const CODIGO_BASE = 'TUPA-BASE-PROYECTO';
const CODIGO_VERSION = 'TUPA-2026-v1.0';
const directorioActual = path.dirname(fileURLToPath(import.meta.url));
const rutaFuente = path.resolve(directorioActual, '../data/tupa/TUPA_2026_IESTP_Suiza_estructurado.md');

async function obtenerVersion(client: PoolClient, codigo: string): Promise<{ version_id: string; estado: string } | null> {
  const resultado = await client.query(
    'SELECT version_id, estado FROM sigd_tupa.version WHERE codigo = $1',
    [codigo],
  );
  return resultado.rows[0] ?? null;
}

async function crearVersionBase(client: PoolClient): Promise<{ version_id: string; estado: string }> {
  const previa = await obtenerVersion(client, CODIGO_BASE);
  if (previa) return previa;

  const version = await client.query(
    `INSERT INTO sigd_tupa.version (codigo, nombre, uit_vigente)
     VALUES ($1, $2, NULL)
     RETURNING version_id, estado`,
    [CODIGO_BASE, 'TUPA original del proyecto'],
  );
  const id = version.rows[0].version_id as string;

  await client.query(
    `INSERT INTO sigd_tupa.tramite_version (
       version_id, codigo, denominacion, descripcion, rubro, plazo_dias_habiles,
       plazo_texto, calificacion, silencio_administrativo, base_legal, observaciones
     )
     SELECT $1, codigo, denominacion, descripcion, unidad_organica, plazo_dias,
            plazo_dias::text || ' días hábiles', 'EVALUACION_PREVIA',
            silencio_administrativo, base_legal, 'Copia del TUPA original del proyecto'
       FROM sigd_doc.tipo_tramite_tupa`,
    [id],
  );

  const vigente = await client.query(
    `UPDATE sigd_tupa.version
        SET estado = 'VIGENTE'
      WHERE version_id = $1
      RETURNING version_id, estado`,
    [id],
  );
  return vigente.rows[0] as { version_id: string; estado: string };
}

async function crearVersion2026(
  client: PoolClient,
  versionBaseId: string,
  fichas: ReturnType<typeof parsearTupaMarkdown>,
): Promise<void> {
  if (await obtenerVersion(client, CODIGO_VERSION)) return;

  const insertada = await client.query(
    `INSERT INTO sigd_tupa.version (codigo, nombre, uit_vigente, version_anterior_id)
     VALUES ($1, $2, 5500.00, $3)
     RETURNING version_id`,
    [CODIGO_VERSION, 'TUPA 2026 — IESTP Suiza', versionBaseId],
  );
  const versionId = insertada.rows[0].version_id as string;

  for (const ficha of fichas) {
    const tramite = await client.query(
      `INSERT INTO sigd_tupa.tramite_version (
         version_id, codigo, denominacion, descripcion, rubro, derecho_monto,
         derecho_porcentaje_uit, derecho_texto, cuenta_pago, plazo_texto,
         plazo_dias_habiles, calificacion, silencio_administrativo, unidad_recibe,
         autoridad_resuelve, recursos, base_legal, observaciones
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
       )
       RETURNING tramite_version_id`,
      [
        versionId,
        ficha.codigo,
        ficha.denominacion,
        ficha.descripcion,
        ficha.rubro,
        ficha.derecho_monto,
        ficha.derecho_porcentaje_uit,
        ficha.derecho_texto,
        ficha.cuenta_pago,
        ficha.plazo_texto,
        ficha.plazo_dias_habiles,
        ficha.calificacion,
        ficha.silencio_administrativo,
        ficha.unidad_recibe,
        ficha.autoridad_resuelve,
        ficha.recursos,
        ficha.base_legal,
        ficha.observaciones,
      ],
    );
    const tramiteId = tramite.rows[0].tramite_version_id as string;

    for (const [indice, requisito] of ficha.requisitos.entries()) {
      await client.query(
        `INSERT INTO sigd_tupa.tramite_requisito (tramite_version_id, orden, texto)
         VALUES ($1, $2, $3)`,
        [tramiteId, indice + 1, requisito],
      );
    }
  }
}

async function validarCarga(client: PoolClient): Promise<void> {
  const resumen = await client.query(
    `SELECT v.estado,
            count(t.tramite_version_id)::int AS total,
            count(*) FILTER (WHERE t.codigo LIKE 'TUPA-PRO-%')::int AS total_pro,
            count(*) FILTER (WHERE t.codigo LIKE 'TUPA-ACA-%')::int AS total_aca,
            COALESCE(sum(t.derecho_monto) FILTER (WHERE t.codigo ~ '^TUPA-ACA-(00[1-9]|01[0-4])$'), 0) AS suma_aca_001_014
       FROM sigd_tupa.version v
       LEFT JOIN sigd_tupa.tramite_version t ON t.version_id = v.version_id
      WHERE v.codigo = $1
      GROUP BY v.version_id`,
    [CODIGO_VERSION],
  );
  const versionBase = await obtenerVersion(client, CODIGO_BASE);
  const carga = resumen.rows[0];
  const suma = Number(carga?.suma_aca_001_014);
  const errores: string[] = [];

  if (carga?.estado !== 'BORRADOR') errores.push(`la versión ${CODIGO_VERSION} no está en BORRADOR`);
  if (Number(carga?.total) !== 81) errores.push(`se esperaban 81 trámites y hay ${carga?.total ?? 0}`);
  if (Number(carga?.total_pro) !== 37) errores.push(`se esperaban 37 fichas PRO y hay ${carga?.total_pro ?? 0}`);
  if (Number(carga?.total_aca) !== 44) errores.push(`se esperaban 44 fichas ACA y hay ${carga?.total_aca ?? 0}`);
  if (suma !== 917.5) errores.push(`la suma ACA-001 a ACA-014 es S/ ${suma.toFixed(2)}, no S/ 917.50`);
  if (versionBase?.estado !== 'VIGENTE') errores.push(`la versión base no quedó VIGENTE (estado: ${versionBase?.estado ?? 'inexistente'})`);

  if (errores.length) {
    throw new Error(`La validación de carga TUPA falló: ${errores.join('; ')}.`);
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL no está configurada; no se iniciará ninguna conexión.');

  const contenido = await fs.readFile(rutaFuente, 'utf8');
  const fichas = parsearTupaMarkdown(contenido);
  const pool = crearPool(databaseUrl);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['sigd_tupa.cargar_tupa']);
    const versionBase = await crearVersionBase(client);
    await crearVersion2026(client, versionBase.version_id, fichas);
    await validarCarga(client);
    await client.query('COMMIT');
    console.log(`Carga TUPA validada: ${CODIGO_BASE} vigente y ${CODIGO_VERSION} borrador con 81 trámites.`);
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError: unknown) => {
      console.error('[TUPA] No se pudo revertir la carga:', rollbackError);
    });
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[TUPA] Error en carga idempotente:', error);
  process.exitCode = 1;
});

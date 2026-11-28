/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria)
 * ARCHIVO: backend/scripts/seedTupaPasco.ts
 * DESCRIPCIÓN:
 * Sembrador oficial del Texto Único de Procedimientos Administrativos (TUPA) 2026
 * del Instituto de Educación Superior Tecnológico Público Pasco (IESTP Pasco).
 * 
 * Inserta de forma idempotente y atómica los 48 procedimientos administrativos
 * oficiales con sus 166 requisitos documentales, derechos de tramitación,
 * dependencias instructoras y plazos resolutivos bajo la UIT vigente (S/ 5,500.00).
 * ==============================================================================
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import { crearPool } from '../src/database.js';

const CODIGO_VERSION = 'TUPA-PASCO-2026';
const NOMBRE_VERSION = 'Texto Único de Procedimientos Administrativos (TUPA) 2026 — IESTP Pasco';
const RESOLUCION_NUMERO = 'R.D. N° 015-2026-D-IESTP-PASCO';

const directorioActual = path.dirname(fileURLToPath(import.meta.url));
const rutaMigracion = path.resolve(directorioActual, '../migraciones/14_sigd_tupa_pasco_2026.sql');

async function validarCargaPasco(client: PoolClient): Promise<void> {
  const resumen = await client.query<{
    codigo: string;
    nombre: string;
    estado: string;
    uit_vigente: string;
    resolucion_numero: string;
    total_tramites: number;
    total_requisitos: number;
  }>(
    `SELECT v.codigo,
            v.nombre,
            v.estado,
            v.uit_vigente::text AS uit_vigente,
            v.resolucion_numero,
            count(DISTINCT t.tramite_version_id)::int AS total_tramites,
            count(r.requisito_id)::int AS total_requisitos
       FROM sigd_tupa.version v
       JOIN sigd_tupa.tramite_version t ON t.version_id = v.version_id
       LEFT JOIN sigd_tupa.tramite_requisito r ON r.tramite_version_id = t.tramite_version_id
      WHERE v.codigo = $1
      GROUP BY v.version_id, v.codigo, v.nombre, v.estado, v.uit_vigente, v.resolucion_numero`,
    [CODIGO_VERSION],
  );

  const carga = resumen.rows[0];
  if (!carga) {
    throw new Error(`La versión ${CODIGO_VERSION} no fue encontrada en la base de datos.`);
  }

  const errores: string[] = [];
  if (carga.estado !== 'VIGENTE') errores.push(`estado esperado VIGENTE, actual: ${carga.estado}`);
  if (carga.total_tramites !== 48) errores.push(`se esperaban 48 trámites y se encontraron ${carga.total_tramites}`);
  if (carga.total_requisitos < 100) errores.push(`se esperaban al menos 100 requisitos y se encontraron ${carga.total_requisitos}`);
  if (Number(carga.uit_vigente) !== 5500) errores.push(`UIT esperada 5500.00, actual: ${carga.uit_vigente}`);

  if (errores.length > 0) {
    throw new Error(`Validación de TUPA Pasco falló: ${errores.join('; ')}`);
  }

  console.log(`[TUPA-PASCO] Validación exitosa: ${carga.codigo} (${carga.nombre}) estado ${carga.estado} con ${carga.total_tramites} trámites y ${carga.total_requisitos} requisitos.`);
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres_password@localhost:5432/sigd_prueba';
  const pool = crearPool(databaseUrl);
  const client = await pool.connect();

  try {
    console.log(`[TUPA-PASCO] Iniciando siembra oficial del TUPA Pasco 2026...`);
    const sql = await fs.readFile(rutaMigracion, 'utf8');
    await client.query(sql);
    await validarCargaPasco(client);
    console.log(`[TUPA-PASCO] Siembra y conmutación oficial completada con éxito.`);
  } catch (error) {
    console.error('[TUPA-PASCO] Error durante la siembra:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[TUPA-PASCO] Error no controlado:', error);
  process.exitCode = 1;
});

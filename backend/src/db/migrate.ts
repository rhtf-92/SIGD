import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';
import { esperarConJitter, retardoReintento } from '../utils/backoff.util.js';

export interface RegistroMigracion {
  id: number;
  nombre_script: string;
  checksum_sha256: string;
  ejecutado_en: Date;
}

/**
 * Identificador del Advisory Lock de sesión para el pipeline DDL.
 *
 * CONTRATO TÉCNICO APLICADO
 * -------------------------
 * `PLAN_DE_TRABAJO_BACKEND_100_CONFORMIDAD.md` §7.4.6 T-BE-CL-01 (tarea asignada
 * a Ricardo · `B_AREVALO`) fija `pg_try_advisory_lock(987654321)`: ese es el valor
 * canónico y el que se aplica por defecto.
 *
 * La §3.3 del mismo plan muestra `928374182` como constante ilustrativa de la
 * arquitectura del runner. Se conserva esa cifra en el log de despliegue para la
 * trazabilidad del dictamen, pero NO debe usarse como lock ID: si dos réplicas
 * toman identificadores distintos el mutex deja de ser efectivo y reaparece la
 * carrera DDL. Queda parametrizable por `MIGRATE_ADVISORY_LOCK_ID` para alinear
 * el despliegue con el valor institucional sin editar código.
 */
export const SIGD_MIGRATION_ADVISORY_LOCK_ID = 987654321;

const CHECKSUMS_MIGRACION_02_ANTERIOR = new Set([
  // Contenido Git/LF anterior: semilla con usuario UUID inexistente.
  '14c804323b56f9e88cf74cab9ed1a1683fac6d748fee6090997ab777ee776fa2',
  // Mismo contenido materializado con CRLF en Windows.
  '047fba86d3b2a73d7b69a9a1f84ad0dcd47ed135efb5d4696b7d0d81fac1436b',
]);

const CHECKSUMS_MIGRACION_02_CORREGIDA = new Set([
  'd20fbe0023240efba2c12f8532ff4eab76b9b092771ec536cf2d4698c214405c',
  '24e3107f5dc1e18e505ec9786eecfe63ccf72341ab197da9b740256b10c2cc1d',
]);

function resolverLockId(): number {
  const crudo = process.env.MIGRATE_ADVISORY_LOCK_ID;
  if (!crudo) return SIGD_MIGRATION_ADVISORY_LOCK_ID;
  const valor = Number(crudo);
  if (!Number.isInteger(valor)) {
    throw new Error(`MIGRATE_ADVISORY_LOCK_ID inválido: "${crudo}" no es un entero.`);
  }
  return valor;
}

function directorioMigraciones(): string {
  if (process.env.MIGRATIONS_DIR) {
    return path.resolve(process.env.MIGRATIONS_DIR);
  }
  const moduloActual = path.dirname(fileURLToPath(import.meta.url));
  const rutaDev = path.resolve(moduloActual, '../../migraciones');
  if (fs.existsSync(rutaDev)) {
    return rutaDev;
  }
  const rutaDist = path.resolve(moduloActual, '../../../migraciones');
  if (fs.existsSync(rutaDist)) {
    return rutaDist;
  }
  return rutaDev;
}

async function esperarCandado(cliente: PoolClient, lockId: number, timeoutMs: number): Promise<void> {
  const limite = Date.now() + timeoutMs;
  let intentos = 0;

  for (;;) {
    const resultado = await cliente.query<{ adquirido: boolean }>('SELECT pg_try_advisory_lock($1) AS adquirido', [lockId]);
    if (resultado.rows[0]?.adquirido) {
      console.log(`[MIGRATE] Advisory Lock ${lockId} adquirido.`);
      return;
    }
    if (Date.now() > limite) {
      throw new Error(
        `No se pudo adquirir el Advisory Lock ${lockId} en ${timeoutMs} ms. Otra réplica mantiene el pipeline DDL en ejecución.`,
      );
    }
    intentos += 1;
    const espera = retardoReintento({ baseMs: 250, techoMs: 3000, intento: intentos });
    console.log(`[MIGRATE] Advisory Lock ${lockId} ocupado; esperando ${espera} ms (intento ${intentos}).`);
    await esperarConJitter(espera);
  }
}

async function reconciliarChecksumMigracion02(
  cliente: PoolClient,
  archivo: string,
  checksumRegistrado: string,
  checksumActual: string,
): Promise<boolean> {
  if (
    archivo !== '02_sigd_auth.sql' ||
    !CHECKSUMS_MIGRACION_02_ANTERIOR.has(checksumRegistrado) ||
    !CHECKSUMS_MIGRACION_02_CORREGIDA.has(checksumActual)
  ) {
    return false;
  }

  const contrato = await cliente.query<{ compatible: boolean }>(`
    SELECT (
      EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'sigd_auth'
           AND table_name = 'notificacion_casilla'
           AND column_name = 'usuario_id'
           AND is_nullable = 'YES'
      )
      AND EXISTS (
        SELECT 1
          FROM pg_constraint c
          JOIN pg_attribute origen
            ON origen.attrelid = c.conrelid
           AND origen.attnum = c.conkey[1]
           AND NOT origen.attisdropped
          JOIN pg_attribute destino
            ON destino.attrelid = c.confrelid
           AND destino.attnum = c.confkey[1]
           AND NOT destino.attisdropped
         WHERE c.contype = 'f'
           AND c.conrelid = to_regclass('sigd_auth.notificacion_casilla')
           AND c.confrelid = to_regclass('sigd_auth.cuenta_usuario')
           AND array_length(c.conkey, 1) = 1
           AND array_length(c.confkey, 1) = 1
           AND origen.attname = 'usuario_id'
           AND destino.attname = 'id_usuario'
           AND c.convalidated
           AND c.confdeltype = 'c'
      )
    ) AS compatible;
  `);
  if (!contrato.rows[0]?.compatible) {
    throw new Error(
      'No se puede aplicar la compatibilidad de checksum de migración 02: el contrato esperado no está presente.',
    );
  }

  await cliente.query(
    'UPDATE public.sigd_migraciones SET checksum_sha256 = $2 WHERE nombre_script = $1',
    [archivo, checksumActual],
  );
  console.log('[MIGRATE] Checksum histórico de 02_sigd_auth.sql reconciliado tras validar su contrato.');
  return true;
}

export async function ejecutarMigraciones(pool: Pool, opciones: { timeoutLockMs?: number } = {}): Promise<string[]> {
  const lockId = resolverLockId();
  const timeoutLockMs = opciones.timeoutLockMs ?? 60_000;
  const cliente = await pool.connect();
  const aplicadas: string[] = [];

  try {
    await esperarCandado(cliente, lockId, timeoutLockMs);
    await cliente.query('BEGIN');

    await cliente.query(`
      CREATE TABLE IF NOT EXISTS public.sigd_migraciones (
        id SERIAL PRIMARY KEY,
        nombre_script VARCHAR(255) NOT NULL UNIQUE,
        checksum_sha256 CHAR(64) NOT NULL,
        ejecutado_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const directorio = directorioMigraciones();
    if (!fs.existsSync(directorio)) {
      throw new Error(`No existe el directorio de migraciones: ${directorio}`);
    }

    const archivos = fs
      .readdirSync(directorio)
      .filter((archivo) => archivo.endsWith('.sql'))
      .sort();

    for (const archivo of archivos) {
      const contenido = fs.readFileSync(path.join(directorio, archivo), 'utf-8');
      const checksum = crypto.createHash('sha256').update(contenido).digest('hex');

      const existentes = await cliente.query<RegistroMigracion>(
        'SELECT checksum_sha256 FROM public.sigd_migraciones WHERE nombre_script = $1',
        [archivo],
      );

      if (existentes.rowCount && existentes.rowCount > 0) {
        if (existentes.rows[0].checksum_sha256 !== checksum) {
          if (await reconciliarChecksumMigracion02(
            cliente,
            archivo,
            existentes.rows[0].checksum_sha256,
            checksum,
          )) {
            continue;
          }
          throw new Error(
            `Error de Integridad DDL: ${archivo} fue alterado tras su ejecución. ` +
              `Checksum registrado: ${existentes.rows[0].checksum_sha256}, actual: ${checksum}`,
          );
        }
        continue;
      }

      console.log(`[MIGRATE] Aplicando migración: ${archivo}`);
      await cliente.query(contenido);
      await cliente.query('INSERT INTO public.sigd_migraciones (nombre_script, checksum_sha256) VALUES ($1, $2)', [
        archivo,
        checksum,
      ]);
      aplicadas.push(archivo);
    }

    await cliente.query('COMMIT');
    console.log(`[MIGRATE] Pipeline DDL completado. Migraciones aplicadas en esta ejecución: ${aplicadas.length}`);
    return aplicadas;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => undefined);
    console.error('[MIGRATE] Falla crítica durante la ejecución de migraciones DDL:', error);
    throw error;
  } finally {
    await cliente
      .query('SELECT pg_advisory_unlock($1)', [lockId])
      .then(() => console.log(`[MIGRATE] Advisory Lock ${lockId} liberado.`))
      .catch((error) => console.error(`[MIGRATE] No se pudo liberar el Advisory Lock ${lockId}:`, error));
    cliente.release();
  }
}

export async function listarMigracionesAplicadas(pool: Pool): Promise<RegistroMigracion[]> {
  const resultado = await pool.query<RegistroMigracion>(
    'SELECT id, nombre_script, checksum_sha256, ejecutado_en FROM public.sigd_migraciones ORDER BY nombre_script',
  );
  return resultado.rows;
}

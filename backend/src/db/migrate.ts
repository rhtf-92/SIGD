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

const PERFIL_BASELINE = 'BASELINE_2026_V1';
const MANIFIESTO_BASELINE = [
  '01_sigd_audit.sql', '02_sigd_auth.sql', '03_sigd_org.sql',
  '04_sigd_doc.sql', '05_sigd_tra.sql', 'BASELINE_2026_V1.sql',
  '08_sigd_tupa_acoplamiento.sql',
] as const;

interface ScriptMigracion { nombre: string; contenido: string; checksum: string }

function cargarManifiesto(directorio: string): ScriptMigracion[] {
  return MANIFIESTO_BASELINE.map((nombre) => {
    const ruta = nombre === PERFIL_BASELINE + '.sql'
      ? path.resolve(directorio, '../baselines', nombre)
      : path.join(directorio, nombre);
    const contenido = fs.readFileSync(ruta, 'utf8');
    return { nombre, contenido, checksum: crypto.createHash('sha256').update(contenido).digest('hex') };
  });
}

/** Se ejecuta bajo el mismo advisory lock y antes de crear el ledger. */
async function clasificarDestino(cliente: PoolClient, manifiesto: ScriptMigracion[]): Promise<'FRESH' | 'COMPLETE_BASELINE'> {
  const ledger = await cliente.query<{ existe: string | null }>(
    "SELECT to_regclass('public.sigd_migraciones')::text AS existe");
  if (ledger.rows[0]?.existe) {
    const estructura = await cliente.query<{ valida: boolean }>(`
      SELECT count(*) = 4 AND
        count(*) FILTER (WHERE column_name = 'id' AND data_type = 'integer') = 1 AND
        count(*) FILTER (WHERE column_name = 'nombre_script' AND data_type = 'character varying') = 1 AND
        count(*) FILTER (WHERE column_name = 'checksum_sha256' AND data_type = 'character') = 1 AND
        count(*) FILTER (WHERE column_name = 'ejecutado_en' AND data_type = 'timestamp with time zone') = 1
        AS valida
        FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'sigd_migraciones'`);
    if (!estructura.rows[0]?.valida) {
      throw new Error('BASELINE_2026_V1 rechazado: ledger con estructura desconocida.');
    }
  }
  const registros = ledger.rows[0]?.existe
    ? (await cliente.query<Pick<RegistroMigracion, 'nombre_script' | 'checksum_sha256'>>(
      'SELECT nombre_script, checksum_sha256 FROM public.sigd_migraciones')).rows
    : [];
  if (registros.length === 0) {
    const objetos = await cliente.query<{ total: string }>(`
      SELECT (
        SELECT count(*) FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_%'
          AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
          AND NOT (n.nspname = 'public' AND c.relname IN ('sigd_migraciones', 'sigd_migraciones_id_seq'))
      ) + (
        SELECT count(*) FROM pg_catalog.pg_namespace
        WHERE nspname NOT IN ('public', 'information_schema') AND nspname NOT LIKE 'pg_%'
      ) + (
        SELECT count(*) FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d
            WHERE d.classid = 'pg_catalog.pg_proc'::regclass AND d.objid = p.oid
              AND d.deptype = 'e')
      ) AS total`);
    if (Number(objetos.rows[0]?.total) === 0) return 'FRESH';
    throw new Error('BASELINE_2026_V1 rechazado: el destino no está vacío.');
  }
  if (registros.length !== manifiesto.length ||
      registros.some((registro) => !manifiesto.some((script) =>
        script.nombre === registro.nombre_script && script.checksum === registro.checksum_sha256))) {
    throw new Error('BASELINE_2026_V1 rechazado: ledger parcial, desconocido o checksum distinto.');
  }
  const contrato = await cliente.query<{ valido: boolean }>(`
    SELECT
      (SELECT count(*) = 11 FROM (VALUES
        ('sigd_tra.expediente'), ('sigd_rut.movimiento_tramite'),
        ('sigd_rut.movimiento_compensatorio'), ('sigd_rut.estado_actual_expediente'),
        ('sigd_doc.tupa_registro_version'), ('sigd_tra.mv_kpis_mgd_mensual'),
        ('sigd_tra.mv_tiempos_retencion_area'), ('sigd_doc.expediente_tupa_vinculo'),
        ('sigd_rut.estado_tramite'), ('sigd_rut.transicion_estado_tramite'),
        ('sigd_rut.contador_pestana_local')) AS t(nombre)
        WHERE to_regclass(t.nombre) IS NOT NULL)
      AND (SELECT count(*) = 4 FROM (VALUES
        ('sigd_tra.expediente'), ('sigd_rut.movimiento_tramite'),
        ('sigd_rut.movimiento_compensatorio'), ('sigd_rut.estado_actual_expediente'))
        AS t(nombre) JOIN pg_catalog.pg_attribute a
          ON a.attrelid = to_regclass(t.nombre) AND a.attname = 'expediente_id'
         AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped)
      AND (SELECT count(*) = 3 FROM pg_catalog.pg_inherits
        WHERE inhparent = to_regclass('sigd_rut.movimiento_tramite'))
      AND (SELECT count(*) = 6 FROM (VALUES
        ('sigd_rut.movimiento_secuencia', 'fk_rut_secuencia_expediente'),
        ('sigd_rut.movimiento_identidad', 'fk_rut_identidad_expediente'),
        ('sigd_rut.movimiento_tramite', 'fk_rut_movimiento_expediente'),
        ('sigd_rut.movimiento_compensatorio', 'fk_rut_compensacion_expediente'),
        ('sigd_rut.solicitud_compensacion_folios', 'fk_rut_folios_expediente'),
        ('sigd_rut.estado_actual_expediente', 'fk_rut_estado_expediente')) AS fk(tabla, nombre)
        JOIN pg_catalog.pg_constraint c ON c.conrelid = to_regclass(fk.tabla)
          AND c.conname = fk.nombre AND c.contype = 'f'
          AND c.confrelid = to_regclass('sigd_tra.expediente'))
      AND (SELECT count(*) = 5 FROM pg_catalog.pg_trigger
        WHERE NOT tgisinternal AND tgenabled IN ('O', 'A') AND (
          (tgrelid = to_regclass('sigd_rut.movimiento_tramite') AND tgname = 'tr_registrar_movimiento_identidad') OR
          (tgrelid = to_regclass('sigd_rut.movimiento_compensatorio') AND tgname = 'tr_compensacion_inmutable') OR
          (tgrelid = to_regclass('sigd_rut.movimiento_compensatorio') AND tgname = 'tr_compensacion_no_truncar') OR
          (tgrelid = to_regclass('sigd_rut.estado_actual_expediente') AND tgname = 'tr_contador_pestana_local') OR
          (tgrelid = to_regclass('sigd_tra.expediente') AND tgname = 'tr_rutadoc_contador_expediente')))
      AND (SELECT count(*) = 2 FROM pg_catalog.pg_index i
        WHERE i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NULL
          AND i.indexprs IS NULL AND i.indrelid IN (
            to_regclass('sigd_tra.mv_kpis_mgd_mensual'),
            to_regclass('sigd_tra.mv_tiempos_retencion_area')))
      AS valido`);
  if (!contrato.rows[0]?.valido) {
    throw new Error('BASELINE_2026_V1 rechazado: falta parte del contrato físico.');
  }
  const catalogos = await cliente.query<{ valido: boolean }>(`
    SELECT (SELECT count(*) = 10 FROM sigd_rut.estado_tramite)
       AND (SELECT count(*) = 13 FROM sigd_rut.transicion_estado_tramite)
       AND (SELECT es_terminal FROM sigd_rut.estado_tramite WHERE codigo = 'ARCHIVADO')
       AND (SELECT count(*) = 6 FROM sigd_rut.contador_pestana_local) AS valido`);
  if (!catalogos.rows[0]?.valido) {
    throw new Error('BASELINE_2026_V1 rechazado: catálogos o contadores incompletos.');
  }
  return 'COMPLETE_BASELINE';
}

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

export async function ejecutarMigraciones(pool: Pool, opciones: { timeoutLockMs?: number } = {}): Promise<string[]> {
  const perfil = process.env.SIGD_MIGRATION_PROFILE;
  if (perfil !== undefined && perfil !== PERFIL_BASELINE) {
    throw new Error('SIGD_MIGRATION_PROFILE no reconocido.');
  }
  const lockId = resolverLockId();
  const timeoutLockMs = opciones.timeoutLockMs ?? 60_000;
  const cliente = await pool.connect();
  const aplicadas: string[] = [];

  try {
    await esperarCandado(cliente, lockId, timeoutLockMs);
    await cliente.query('BEGIN');

    let manifiesto: ScriptMigracion[] | null = null;
    if (perfil === PERFIL_BASELINE) {
      const directorioPerfil = directorioMigraciones();
      if (!fs.existsSync(directorioPerfil)) {
        throw new Error(`No existe el directorio de migraciones: ${directorioPerfil}`);
      }
      manifiesto = cargarManifiesto(directorioPerfil);
    }
    if (manifiesto) {
      const estado = await clasificarDestino(cliente, manifiesto);
      if (estado === 'COMPLETE_BASELINE') {
        await cliente.query('COMMIT');
        return [];
      }
    }

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

    const archivos = manifiesto?.map((script) => script.nombre) ?? fs
      .readdirSync(directorio)
      .filter((archivo) => archivo.endsWith('.sql'))
      .sort();

    for (const archivo of archivos) {
      const contenido = manifiesto?.find((script) => script.nombre === archivo)?.contenido ??
        fs.readFileSync(path.join(directorio, archivo), 'utf-8');
      const checksum = crypto.createHash('sha256').update(contenido).digest('hex');

      const existentes = await cliente.query<RegistroMigracion>(
        'SELECT checksum_sha256 FROM public.sigd_migraciones WHERE nombre_script = $1',
        [archivo],
      );

      if (existentes.rowCount && existentes.rowCount > 0) {
        if (existentes.rows[0].checksum_sha256 !== checksum) {
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
    if (perfil === PERFIL_BASELINE) {
      console.error('[MIGRATE] Perfil BASELINE_2026_V1 falló:', error instanceof Error ? error.message : 'error desconocido');
    } else {
      console.error('[MIGRATE] Falla crítica durante la ejecución de migraciones DDL:', error);
    }
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

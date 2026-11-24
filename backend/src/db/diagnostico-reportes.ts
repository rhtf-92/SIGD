import 'dotenv/config';
import { crearPool } from '../database.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/sigd_prueba';

const pool = crearPool(databaseUrl);

const MIGRACIONES = [
  '14_sigd_reportes_mgd_compatible.sql',
  '15_sigd_reportes_mgd_reaplicar.sql',
] as const;

const COLUMNAS_ESPERADAS: Record<string, readonly string[]> = {
  'mv_kpis_mgd_mensual': [
    'periodo',
    'unidad_organica_id',
    'n_radicados',
    'n_atendidos',
    'n_archivados',
    'n_resueltos',
    'n_resueltos_dentro_plazo',
  ],
  'mv_tiempos_retencion_area': [
    'periodo',
    'unidad_organica_id',
    'tramo_permanencia_dias_habiles',
    'n_expedientes',
    'promedio_dias_habiles_permanencia',
    'porcentaje_del_area',
  ],
};

async function main(): Promise<void> {
  const migraciones = await pool.query<{
    nombre_script: string;
    ejecutado_en: Date;
    checksum_sha256: string;
  }>(
    `SELECT nombre_script, ejecutado_en, checksum_sha256
       FROM public.sigd_migraciones
      WHERE nombre_script = ANY($1::text[])
      ORDER BY nombre_script`,
    [[...MIGRACIONES]],
  );

  console.log('[DIAG] Migraciones de reportes:');
  for (const nombre of MIGRACIONES) {
    const registro = migraciones.rows.find((fila) => fila.nombre_script === nombre);
    console.log(
      registro
        ? `  [OK] ${nombre} · aplicada ${registro.ejecutado_en.toISOString()} · ${registro.checksum_sha256}`
        : `  [FALTA] ${nombre}`,
    );
  }

  const columnas = await pool.query<{ tabla: string; columna: string }>(
    `SELECT c.relname AS tabla, a.attname AS columna
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      WHERE n.nspname = 'sigd_tra'
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname, a.attnum`,
    [Object.keys(COLUMNAS_ESPERADAS)],
  );

  console.log('[DIAG] Contrato de vistas materializadas:');
  const problemas: string[] = [];

  for (const [tabla, esperadas] of Object.entries(COLUMNAS_ESPERADAS)) {
    const presentes = new Set(
      columnas.rows.filter((fila) => fila.tabla === tabla).map((fila) => fila.columna),
    );
    const faltan = esperadas.filter((columna) => !presentes.has(columna));

    if (faltan.length === 0) {
      console.log(`  [OK] sigd_tra.${tabla} (${esperadas.length} columnas verificadas)`);
    } else {
      console.log(`  [FALTA] sigd_tra.${tabla}: ${faltan.join(', ')}`);
      problemas.push(`${tabla}: ${faltan.join(', ')}`);
    }
  }

  if (problemas.length > 0) {
    console.error('[DIAG] El contrato del tablero no coincide. Reinicia el backend para aplicar la migración 15.');
    process.exitCode = 1;
    return;
  }

  console.log('[DIAG] OK: el contrato del tablero ejecutivo coincide con el backend.');
}

try {
  await main();
} catch (error: unknown) {
  console.error('[DIAG] No se pudo verificar el entorno:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

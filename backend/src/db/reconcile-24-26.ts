/**
 * Reconciliación excepcional para LAB: el esquema 24–26 fue aplicado fuera del
 * runner, pero sus entradas faltan en el ledger. Nunca ejecuta los DDL de esas
 * migraciones. Registra por separado la evidencia y el origen reconciliado.
 * Uso: tsx src/db/reconcile-24-26.ts --check | --apply
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';

const nombres = [
  '24_sigd_tupa_requisitos_documentales.sql',
  '25_sigd_vinculacion_historica.sql',
  '26_sigd_devoluciones_y_pagos_adicionales.sql',
] as const;
const directorio = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migraciones');

async function exigir(cliente: PoolClient, nombre: string, sql: string): Promise<void> {
  const respuesta = await cliente.query<{ valido: boolean }>(sql);
  if (respuesta.rows[0]?.valido !== true) throw new Error(`Contrato físico incompatible: ${nombre}`);
}

async function verificarCatalogo(cliente: PoolClient): Promise<void> {
  await exigir(cliente, '24 columnas y defaults', `
    SELECT (SELECT count(*) = 14 FROM (VALUES
      ('id_requisito','uuid',true,'gen_random_uuid()'),
      ('id_procedimiento','uuid',true,NULL),
      ('registro_version_id','uuid',false,NULL),
      ('nombre','character varying(250)',true,NULL),
      ('descripcion','text',false,NULL),
      ('tipo_requisito','character varying(40)',true,NULL),
      ('es_anexo_digital','boolean',true,'false'),
      ('obligatorio','boolean',true,'true'),
      ('orden','smallint',true,'1'),
      ('formatos_permitidos','character varying(100)',true,'''application/pdf''::character varying'),
      ('activo','boolean',true,'true'),
      ('fuente_original','text',true,NULL),
      ('creado_en','timestamp with time zone',true,'now()'),
      ('actualizado_en','timestamp with time zone',true,'now()')
    ) AS esperado(col,tipo,obligatorio,por_defecto)
    JOIN pg_attribute a ON a.attrelid=to_regclass('sigd_doc.tupa_requisito_documental')
      AND a.attname=esperado.col AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE format_type(a.atttypid,a.atttypmod)=esperado.tipo
      AND a.attnotnull=esperado.obligatorio
      AND pg_get_expr(d.adbin,d.adrelid) IS NOT DISTINCT FROM esperado.por_defecto)
    AND (SELECT count(*)=14 FROM pg_attribute WHERE attrelid=to_regclass('sigd_doc.tupa_requisito_documental') AND attnum>0 AND NOT attisdropped)
    AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass('sigd_doc.documento_adjunto') AND a.attname='id_requisito' AND a.atttypid='uuid'::regtype AND NOT a.attnotnull) AS valido`);
  await exigir(cliente, '24 FKs, checks e índices', `
    SELECT (SELECT count(*)=4 FROM pg_constraint WHERE conrelid=to_regclass('sigd_doc.tupa_requisito_documental') AND conname IN
      ('tupa_requisito_documental_pkey','tupa_requisito_documental_id_procedimiento_fkey','tupa_requisito_documental_registro_version_id_fkey','tupa_requisito_documental_tipo_requisito_check'))
    AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('sigd_doc.documento_adjunto') AND confrelid=to_regclass('sigd_doc.tupa_requisito_documental') AND pg_get_constraintdef(oid) LIKE '%ON DELETE SET NULL%')
    AND (SELECT count(*)=5 FROM pg_indexes WHERE (schemaname,tablename,indexname) IN (
      ('sigd_doc','tupa_requisito_documental','idx_tupa_req_procedimiento'),
      ('sigd_doc','tupa_requisito_documental','idx_tupa_req_registro_version'),
      ('sigd_doc','tupa_requisito_documental','idx_tupa_req_tipo'),
      ('sigd_doc','tupa_requisito_documental','idx_tupa_req_anexo_activo'),
      ('sigd_doc','documento_adjunto','idx_doc_adjunto_requisito')))
    AND EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_tupa_req_anexo_activo' AND indexdef LIKE '%WHERE (activo = true)%')
    AS valido`);
  await exigir(cliente, '24 semilla TUPA', `
    SELECT NOT EXISTS (
      SELECT 1 FROM sigd_doc.tupa_procedimiento p
      CROSS JOIN LATERAL jsonb_array_elements_text(p.requisitos) WITH ORDINALITY AS e(req,ord)
      FULL JOIN sigd_doc.tupa_requisito_documental r ON r.id_procedimiento=p.id_procedimiento AND r.orden=e.ord
      WHERE r.id_requisito IS NULL OR p.id_procedimiento IS NULL
         OR r.fuente_original IS DISTINCT FROM trim(e.req)
         OR r.nombre IS DISTINCT FROM trim(e.req)
         OR r.registro_version_id IS DISTINCT FROM p.registro_version_id
    ) AND (SELECT count(*) FROM sigd_doc.tupa_requisito_documental) =
          (SELECT sum(jsonb_array_length(requisitos)) FROM sigd_doc.tupa_procedimiento) AS valido`);

  await exigir(cliente, '25 columnas, FKs, checks, índices y backfill', `
    SELECT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass('sigd_tra.expediente') AND a.attname='id_usuario_creador' AND a.atttypid='uuid'::regtype AND NOT a.attnotnull)
      AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('sigd_tra.expediente') AND confrelid=to_regclass('sigd_auth.cuenta_usuario') AND pg_get_constraintdef(oid) LIKE '%id_usuario_creador%ON DELETE SET NULL%')
      AND (SELECT count(*)=10 FROM pg_attribute WHERE attrelid=to_regclass('sigd_tra.solicitud_vinculacion_expediente') AND attnum>0 AND NOT attisdropped)
      AND (SELECT count(*)=4 FROM pg_constraint WHERE conrelid=to_regclass('sigd_tra.solicitud_vinculacion_expediente') AND contype='f')
      AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('sigd_tra.solicitud_vinculacion_expediente') AND conname='chk_solicitud_vinculacion_estado')
      AND (SELECT count(*)=7 FROM pg_indexes WHERE schemaname='sigd_tra' AND tablename='solicitud_vinculacion_expediente')
      AND EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='uq_solicitud_vinculacion_activa' AND indexdef LIKE '%PENDIENTE%' AND indexdef LIKE '%APROBADA%')
      AND EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_tra_expediente_creador' AND indexdef LIKE '%IS NOT NULL%')
      AND NOT EXISTS (SELECT 1 FROM sigd_tra.expediente e JOIN sigd_tra.asiento_registro ar ON ar.expediente_id=e.expediente_id
        JOIN sigd_auth.cuenta_usuario cu ON cu.id_persona=e.solicitante_id WHERE ar.canal_ingreso='MESA_VIRTUAL' AND e.id_usuario_creador IS NULL)
      AS valido`);

  await exigir(cliente, '26 columnas, constraints e índices', `
    SELECT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass('sigd_tra.orden_pago') AND a.attname='tipo_orden' AND format_type(a.atttypid,a.atttypmod)='character varying(20)' AND a.attnotnull)
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass('sigd_tra.orden_pago') AND a.attname='motivo_adicional' AND a.atttypid='text'::regtype AND NOT a.attnotnull)
      AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('sigd_tra.orden_pago') AND conname='chk_tra_orden_pago_tipo')
      AND (SELECT count(*)=26 FROM pg_attribute WHERE attrelid=to_regclass('sigd_tra.solicitud_devolucion') AND attnum>0 AND NOT attisdropped)
      AND (SELECT count(*)=6 FROM pg_constraint WHERE conrelid=to_regclass('sigd_tra.solicitud_devolucion') AND contype='f')
      AND (SELECT count(*)=8 FROM pg_constraint WHERE conrelid=to_regclass('sigd_tra.solicitud_devolucion') AND contype='c')
      AND (SELECT count(*)=13 FROM pg_indexes WHERE schemaname='sigd_tra' AND tablename='solicitud_devolucion')
      AND EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='uq_tra_orden_pago_principal_activa' AND indexdef LIKE '%PRINCIPAL%' AND indexdef LIKE '%PENDIENTE%' AND indexdef LIKE '%CONFIRMADO%')
      AND EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='uq_tra_orden_pago_adicional_pendiente' AND indexdef LIKE '%ADICIONAL%' AND indexdef LIKE '%PENDIENTE%')
      AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='uq_tra_orden_pago_activa_expediente')
      AND to_regclass('sigd_tra.seq_devolucion_correlativo') IS NOT NULL
      AND to_regclass('sigd_tra.seq_constancia_devolucion_correlativo') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM sigd_tra.orden_pago WHERE tipo_orden IS DISTINCT FROM 'PRINCIPAL' AND tipo_orden IS DISTINCT FROM 'ADICIONAL')
      AS valido`);
  await exigir(cliente, '24–26 sin triggers ni funciones nuevas', `
    SELECT NOT EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (
      to_regclass('sigd_doc.tupa_requisito_documental'),
      to_regclass('sigd_tra.solicitud_vinculacion_expediente'),
      to_regclass('sigd_tra.solicitud_devolucion'))) AS valido`);
}

export async function reconciliarMigraciones24a26(pool: Pool, aplicar: boolean): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Reconciliación prohibida en producción.');
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT pg_advisory_xact_lock(987654321)');
    const db = await cliente.query<{ database_name: string }>('SELECT current_database() AS database_name');
    if (db.rows[0]?.database_name !== 'sigd_prueba') throw new Error('Reconciliación permitida solo en sigd_prueba.');
    const ledger = await cliente.query<{ nombre_script: string }>('SELECT nombre_script FROM public.sigd_migraciones ORDER BY id');
    const yaRegistradas = ledger.rows.filter((fila) => nombres.includes(fila.nombre_script as typeof nombres[number]));
    if (yaRegistradas.length !== 0 && yaRegistradas.length !== nombres.length) {
      throw new Error('Ledger 24–26 parcialmente registrado. Requiere revisión manual.');
    }
    if (yaRegistradas.length === 0 && ledger.rows.at(-1)?.nombre_script !== '23_sigd_orden_pago_metodo_qr_longitud.sql') {
      throw new Error('Ledger no es un prefijo limpio hasta migración 23.');
    }
    if (yaRegistradas.length === nombres.length) {
      const registradas = await cliente.query<{ nombre_script: string; checksum_sha256: string }>(
        "SELECT nombre_script, checksum_sha256 FROM public.sigd_migraciones WHERE nombre_script = ANY($1::text[]) ORDER BY id", [nombres],
      );
      for (let i = 0; i < nombres.length; i += 1) {
        const checksum = crypto.createHash('sha256').update(fs.readFileSync(path.join(directorio, nombres[i]))).digest('hex');
        if (registradas.rows[i]?.nombre_script !== nombres[i] || registradas.rows[i]?.checksum_sha256 !== checksum) {
          throw new Error('Ledger 24–26 no coincide con archivos SQL u orden esperado.');
        }
      }
    }
    await verificarCatalogo(cliente);
    if (aplicar && yaRegistradas.length === 0) {
      await cliente.query(`CREATE TABLE IF NOT EXISTS public.sigd_migraciones_reconciliacion (
        nombre_script varchar(255) PRIMARY KEY REFERENCES public.sigd_migraciones(nombre_script),
        checksum_sha256 char(64) NOT NULL,
        clasificacion varchar(40) NOT NULL CHECK (clasificacion = 'COMPATIBLE_WITH_DRIFT'),
        metodo text NOT NULL,
        verificado_en timestamptz NOT NULL DEFAULT now()
      )`);
      for (const nombre of nombres) {
        const checksum = crypto.createHash('sha256').update(fs.readFileSync(path.join(directorio, nombre))).digest('hex');
        await cliente.query('INSERT INTO public.sigd_migraciones(nombre_script,checksum_sha256) VALUES ($1,$2)', [nombre, checksum]);
        await cliente.query(`INSERT INTO public.sigd_migraciones_reconciliacion(nombre_script,checksum_sha256,clasificacion,metodo)
          VALUES ($1,$2,'COMPATIBLE_WITH_DRIFT','Catálogo físico y datos comparados con SQL 24–26; esquema aplicado fuera del runner; DDL no reejecutado')`, [nombre, checksum]);
      }
    }
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { cliente.release(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const modo = process.argv[2];
  if (modo !== '--check' && modo !== '--apply') throw new Error('Use --check o --apply.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  reconciliarMigraciones24a26(pool, modo === '--apply')
    .then(() => console.log(modo === '--apply' ? '24–26 reconciliadas con auditoría física.' : '24–26: contrato físico compatible.'))
    .catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Error de reconciliación.'); process.exitCode = 1; })
    .finally(() => pool.end());
}

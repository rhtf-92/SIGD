import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const { rows: exps } = await client.query<{ expediente_id: string; codigo_expediente: string }>(
      `SELECT expediente_id, codigo_expediente FROM sigd_tra.expediente WHERE codigo_expediente <> 'EXP-2026-000012'`
    );
    console.log(`Expedientes a depurar: ${exps.length}`);
    if (exps.length === 0) {
      console.log('No hay expedientes anteriores para depurar.');
      return;
    }
    const ids = exps.map(e => e.expediente_id);

    // Desactivar triggers restrictivos
    await client.query('ALTER TABLE sigd_tra.expediente_documento_folio DISABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_doc.expediente_tupa_vinculo DISABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_rut.movimiento_tramite DISABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_rut.movimiento_tramite_2026 DISABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_rut.accion_compensatoria DISABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_tra.asiento_registro DISABLE TRIGGER ALL;');

    const exec = async (sql: string, params?: any[]) => {
      try {
        if (params) await client.query(sql, params);
        else await client.query(sql);
      } catch (e: any) {
        console.log(`Info (${sql.substring(0, 40)}...): ${e.message}`);
      }
    };

    await exec('DELETE FROM sigd_tra.orden_pago WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_tra.expediente_documento_folio WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_tra.expediente_acumulacion WHERE expediente_principal = ANY($1::uuid[]) OR expediente_accesorio = ANY($1::uuid[])', [ids]);

    await exec('DELETE FROM sigd_doc.firma_digital_documento WHERE cvd NOT IN (SELECT cvd FROM sigd_doc.firma_digital_documento fd JOIN sigd_tra.expediente e ON e.expediente_id = fd.documento_id WHERE e.codigo_expediente = \'EXP-2026-000012\')');
    await exec('DELETE FROM sigd_doc.documento_adjunto WHERE s3_key NOT LIKE \'%EXP-2026-000012%\' AND s3_key NOT LIKE \'%' + ids.join('%\' AND s3_key NOT LIKE \'%') + '\'');
    await exec('DELETE FROM sigd_doc.documento_adjunto WHERE expediente_tra_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_doc.documento_adjunto WHERE expediente_id = ANY($1::uuid[])', [ids]);
    
    await exec('DELETE FROM sigd_doc.expediente_tupa_vinculo WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_doc.expediente_formulario_respuesta WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_doc.expediente_requisito WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_doc.resolucion WHERE expediente_id = ANY($1::uuid[])', [ids]);

    await exec('DELETE FROM sigd_rut.solicitud_compensacion_folios WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_rut.movimiento_compensatorio WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_rut.accion_compensatoria WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_rut.movimiento_identidad WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_rut.estado_actual_expediente WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_rut.movimiento_secuencia WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_rut.movimiento_tramite_2026 WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_rut.movimiento_tramite WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_rut.expediente_asignacion WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_rut.workflow_instancia WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_doc.flujo_certificado_ingles WHERE expediente_id = ANY($1::uuid[])', [ids]);

    await exec('DELETE FROM sigd_tra.asiento_registro WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_tra.tramite WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_doc.expediente WHERE expediente_id = ANY($1::uuid[])', [ids]);
    await exec('DELETE FROM sigd_tra.expediente WHERE expediente_id = ANY($1::uuid[])', [ids]);

    // Reactivar triggers
    await client.query('ALTER TABLE sigd_tra.expediente_documento_folio ENABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_doc.expediente_tupa_vinculo ENABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_rut.movimiento_tramite ENABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_rut.movimiento_tramite_2026 ENABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_rut.accion_compensatoria ENABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_tra.asiento_registro ENABLE TRIGGER ALL;');

    console.log('✓ Limpieza completada. Solo EXP-2026-000012 se mantiene activo.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);

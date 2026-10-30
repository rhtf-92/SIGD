import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno desde backend/.env si existe
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function ejecutarResetDemoDev(poolParam?: Pool): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo reset refused in production');
  }
  if (process.env.ALLOW_DEMO_RESET !== 'true') {
    throw new Error('Demo reset disabled: ALLOW_DEMO_RESET=true is required');
  }

  let pool: Pool;
  if (poolParam) {
    pool = poolParam;
  } else {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl?.trim()) {
      throw new Error('Falta definir DATABASE_URL para ejecutar la limpieza de datos demo.');
    }
    pool = new Pool({ connectionString: databaseUrl });
  }

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    const database = await client.query<{ database_name: string }>('SELECT current_database() AS database_name');
    if (database.rows[0]?.database_name !== 'sigd_prueba') {
      throw new Error('Demo reset refused: connected database must be sigd_prueba');
    }

    console.log('--- Iniciando Limpieza Controlada de Datos Transaccionales Demo (SIGD 2026) ---');
    await client.query('BEGIN');
    transactionStarted = true;

    // 1. Limpieza de tablas hijas y dependientes transaccionales
    console.log('1. Limpiando órdenes de pago y folios...');
    await client.query('ALTER TABLE sigd_tra.expediente_documento_folio DISABLE TRIGGER ALL;');
    await client.query('DELETE FROM sigd_tra.orden_pago;');
    await client.query('DELETE FROM sigd_tra.expediente_documento_folio;');
    await client.query('DELETE FROM sigd_tra.expediente_acumulacion;');
    await client.query('ALTER TABLE sigd_tra.expediente_documento_folio ENABLE TRIGGER ALL;');

    console.log('2. Limpiando firmas digitales y documentos adjuntos...');
    await client.query('ALTER TABLE sigd_doc.expediente_tupa_vinculo DISABLE TRIGGER ALL;');
    await client.query('DELETE FROM sigd_doc.firma_digital_documento;');
    await client.query('DELETE FROM sigd_doc.documento_adjunto;');
    await client.query('DELETE FROM sigd_doc.expediente_tupa_vinculo;');
    await client.query('DELETE FROM sigd_doc.expediente_formulario_respuesta;');
    await client.query('DELETE FROM sigd_doc.expediente_requisito;');
    await client.query('DELETE FROM sigd_doc.resolucion;');
    await client.query('ALTER TABLE sigd_doc.expediente_tupa_vinculo ENABLE TRIGGER ALL;');

    console.log('3. Limpiando movimientos de trámite y trazabilidad...');
    await client.query('ALTER TABLE sigd_rut.movimiento_tramite DISABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_rut.movimiento_tramite_2026 DISABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_rut.accion_compensatoria DISABLE TRIGGER ALL;');
    await client.query('DELETE FROM sigd_rut.solicitud_compensacion_folios;');
    await client.query('DELETE FROM sigd_rut.movimiento_compensatorio;');
    await client.query('DELETE FROM sigd_rut.accion_compensatoria;');
    await client.query('DELETE FROM sigd_rut.movimiento_identidad;');
    await client.query('DELETE FROM sigd_rut.estado_actual_expediente;');
    await client.query('DELETE FROM sigd_rut.movimiento_secuencia;');
    await client.query('DELETE FROM sigd_rut.movimiento_tramite_2026;');
    await client.query('DELETE FROM sigd_rut.movimiento_tramite;');
    await client.query('ALTER TABLE sigd_rut.movimiento_tramite_2026 ENABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_rut.movimiento_tramite ENABLE TRIGGER ALL;');
    await client.query('ALTER TABLE sigd_rut.accion_compensatoria ENABLE TRIGGER ALL;');

    console.log('4. Limpiando asientos de registro, trámites y expedientes...');
    await client.query('ALTER TABLE sigd_tra.asiento_registro DISABLE TRIGGER ALL;');
    await client.query('DELETE FROM sigd_tra.asiento_registro;');
    await client.query('ALTER TABLE sigd_tra.asiento_registro ENABLE TRIGGER ALL;');
    await client.query('DELETE FROM sigd_tra.tramite;');
    await client.query('DELETE FROM sigd_doc.expediente;');
    await client.query('DELETE FROM sigd_tra.expediente;');

    console.log('5. Limpiando solicitudes dinámicas y notificaciones de casilla demo...');
    await client.query('DELETE FROM sigd_doc.solicitud_tramite_dinamico;');
    await client.query('DELETE FROM sigd_auth.notificacion_casilla;');
    await client.query('DELETE FROM sigd_audit.evento_outbox;');

    console.log('6. Reiniciando correlativos de laboratorio a 1...');
    // CUT: se deja ultimo_correlativo = 0 para que el próximo generado sea EXP-2026-000001
    await client.query(`
      INSERT INTO sigd_tra.secuencia_anual_cut (anio_fiscal, ultimo_correlativo)
      VALUES (2026, 0)
      ON CONFLICT (anio_fiscal) DO UPDATE
        SET ultimo_correlativo = 0;
    `);

    // Secuencias de órdenes de pago y recibos
    await client.query('ALTER SEQUENCE sigd_tra.seq_orden_pago_correlativo RESTART WITH 1;');
    await client.query('ALTER SEQUENCE sigd_tra.seq_recibo_pago_correlativo RESTART WITH 1;');

    // Reset de contadores locales de pestaña
    await client.query('UPDATE sigd_rut.contador_pestana_local SET cantidad = 0;');

    // 7. Registro de auditoría del evento de reseteo controlado
    await client.query(`
      INSERT INTO sigd_audit.bitacora_auditoria (
        correlation_id, esquema, tabla, operacion, datos_despues
      ) VALUES (
        gen_random_uuid(),
        'sigd_tra',
        'reset_demo',
        'DELETE',
        '{"accion": "RESET_DATOS_DEMO_PRE_DEMO", "motivo": "Limpieza controlada pre-demo para correlativos limpios EXP-2026-000001, PAG-2026-000001, REC-2026-000001"}'::jsonb
      );
    `);

    await client.query('COMMIT');
    console.log('✓ Limpieza de datos transaccionales completada con éxito.');
    console.log('✓ Correlativos listos: EXP-2026-000001, PAG-2026-000001, REC-2026-000001.');
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error('Error durante la limpieza de datos demo:', error);
    throw error;
  } finally {
    client.release();
    if (!poolParam) {
      await pool.end();
    }
  }
}

// Ejecución directa si se invoca por CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  ejecutarResetDemoDev().catch((err) => {
    console.error('Error fatal al ejecutar reset-demo-dev:', err);
    process.exit(1);
  });
}

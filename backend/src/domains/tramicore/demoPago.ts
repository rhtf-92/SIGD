import type { Pool, PoolClient } from 'pg';
import { AppError } from '../../shared/domain/errors/index.js';

type Conexion = Pick<Pool | PoolClient, 'query'>;
export const MARCA_PAGO_DEMO = 'RADICACIÓN DEMOSTRATIVA SIN VERIFICACIÓN DE PAGO';

/** The flag alone is insufficient: verify the effective backend connection. */
export async function omitirPagoDemo(conexion: Conexion): Promise<boolean> {
  if (process.env.SIGD_DEMO_OMITIR_PAGO !== 'true' || process.env.NODE_ENV === 'production') return false;
  const identidad = await conexion.query<{ db: string }>('SELECT current_database() AS db');
  return identidad.rows[0]?.db === 'sigd_jacobo_demo';
}

/** Durable hold survives disabling the flag. No inference of payment from a PDF. */
export async function exigirSinPagoDemoPendiente(conexion: Conexion, expedienteId: string): Promise<void> {
  const identidad = await conexion.query<{ db: string }>('SELECT current_database() AS db');
  if (identidad.rows[0]?.db !== 'sigd_jacobo_demo') return;
  // El hecho inicial sigue inmutable; el estado actual se deriva de Tesorería.
  const instalada=await conexion.query<{tabla:string|null}>("SELECT to_regclass('sigd_tes.aplicacion_pago')::text tabla");
  if(instalada.rows[0]?.tabla){
    const estado=await conexion.query<{tiene_orden:boolean;verificado:boolean}>(`SELECT 
        EXISTS(SELECT 1 FROM sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o ON o.id=a.orden_id WHERE a.expediente_id=$1 AND o.importe > 0) tiene_orden,
        EXISTS(SELECT 1 FROM sigd_tes.aplicacion_pago a JOIN sigd_tes.pago p ON p.orden_id=a.orden_id WHERE a.expediente_id=$1 AND p.estado='VERIFICADO'
          AND NOT EXISTS(SELECT 1 FROM sigd_tes.devolucion d WHERE d.pago_id=p.id AND d.estado<>'RECHAZADA')) verificado`,[expedienteId]);
    if(estado.rows[0]?.verificado===true)return;
    if(estado.rows[0]?.tiene_orden===true){
      throw new AppError({ status: 422, code: 'DEMO_PAYMENT_PENDING',
        message: 'Expediente con orden de pago pendiente: el pago NO ha sido verificado en Tesorería. No puede avanzar ni generar resolución hasta su verificación institucional.' });
    }
  }
  const pendiente = await conexion.query(`SELECT 1 AS pendiente FROM sigd_tra.radicacion_publica
    WHERE expediente_id=$1::uuid AND datos_declarados->>'estado_economico'='NO_VERIFICADO'
      AND datos_declarados->>'modalidad'=$2
    UNION ALL SELECT 1 FROM sigd_audit.bitacora_auditoria
    WHERE esquema='sigd_tra' AND tabla='radicacion_virtual'
      AND datos_despues->>'expediente_id'=$1::text
      AND datos_despues->>'estado_economico'='NO_VERIFICADO'
      AND datos_despues->>'modalidad'=$2`, [expedienteId, MARCA_PAGO_DEMO]);
  if (pendiente.rows.length) throw new AppError({ status: 422, code: 'DEMO_PAYMENT_PENDING',
    message: 'Radicación demostrativa: pago NO VERIFICADO. No puede avanzar ni generar resolución hasta su verificación institucional.' });
}

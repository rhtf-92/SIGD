import type { Pool,PoolClient } from 'pg';
import { fallo,condicionFinanciera } from './tesoreria.rules.js';

export async function consultarCondicionFinanciera(c:Pick<Pool,'query'>,procedimiento:string){
 const instalado=await c.query("SELECT to_regclass('sigd_tes.orden_pago')::text tabla");
 if(!instalado.rows[0]?.tabla)return 'PENDIENTE_VALIDACION' as const;
 const tarifas=(await c.query(`SELECT f.importe::text FROM sigd_tes.tarifa f JOIN sigd_doc.tipo_tramite_tupa t USING(tipo_tramite_id)
  WHERE f.tipo_tramite_id=$1 AND t.vigente AND f.estado='VALIDADA' AND f.vigente_desde<=(now() AT TIME ZONE 'America/Lima')::date
  AND (f.vigente_hasta IS NULL OR f.vigente_hasta>=(now() AT TIME ZONE 'America/Lima')::date)`,[procedimiento])).rows;
 return condicionFinanciera(tarifas);
}

/** Compatibilidad con órdenes antiguas: valida titularidad, nunca exige pago para recibir. */
export async function validarPagoRadicacion(c:PoolClient,procedimiento:string,persona:string,usuario:string|null,ordenId:string|undefined,demo:boolean,sesionPublicaHash?:string):Promise<string|null>{
 if(!ordenId)return null;
 void demo;
 const instalado=await c.query("SELECT to_regclass('sigd_tes.orden_pago')::text tabla");
 if(!instalado.rows[0]?.tabla){if(demo&&!ordenId)return null;fallo('TESORERIA_NO_INSTALADA','No se puede verificar la condición económica; Tesorería aún no está instalada.',503);}
 if(ordenId){
  const o=(await c.query(`SELECT o.* FROM sigd_tes.orden_pago o WHERE o.id=$1 FOR UPDATE OF o`,[ordenId])).rows[0];
  const titular=usuario!==null?o?.ciudadano_id===usuario:Boolean(sesionPublicaHash&&/^[0-9a-f]{64}$/.test(sesionPublicaHash)&&o?.ciudadano_id===null&&o.sesion_publica_hash===sesionPublicaHash);
  if(!o||o.persona_id!==persona||!titular||o.tipo_tramite_id!==procedimiento)fallo('ORDEN_INCOMPATIBLE','La orden no pertenece al titular y procedimiento de esta solicitud.',403);
  if((await c.query('SELECT 1 FROM sigd_tes.aplicacion_pago WHERE orden_id=$1',[ordenId])).rowCount)fallo('ORDEN_YA_APLICADA','La orden ya se aplicó a otro expediente.',409);
  if((await c.query(`SELECT 1 FROM sigd_tes.devolucion d JOIN sigd_tes.pago p ON p.id=d.pago_id
    WHERE p.orden_id=$1 AND d.estado<>'RECHAZADA' LIMIT 1`,[ordenId])).rowCount)fallo('PAGO_EN_DEVOLUCION','La operación tiene una devolución solicitada y no puede aplicarse.');
  return ordenId;
 }
 return null;
}

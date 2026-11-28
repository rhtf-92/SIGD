import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { centimos, fallo } from './tesoreria.rules.js';

export type TitularOrdenPosterior = { usuario: string; sesionHash?: never } | { usuario?: never; sesionHash: string };
export interface OrdenPosteriorResultado {
 estado: 'PENDIENTE_PAGO' | 'PAGO_VERIFICADO' | 'GRATUITO' | 'PENDIENTE_VALIDACION' | 'REQUIERE_CANTIDAD' | 'ERROR';
 ordenId?: string; codigo?: string; importe?: string; moneda?: string; mensaje: string;
}
/** Transacción independiente, exclusivamente después del COMMIT de M3. */
export async function generarOrdenPosterior(pool: Pool, expediente: string, titular: TitularOrdenPosterior, cantidad?: number, procedimientoEsperado?:string): Promise<OrdenPosteriorResultado> {
 const c=await pool.connect();
 try {
  await c.query('BEGIN');
  await c.query('SELECT expediente_id FROM sigd_doc.expediente WHERE expediente_id=$1::uuid FOR UPDATE',[expediente]);
  const e=(await c.query(`SELECT e.expediente_id,e.codigo_expediente,e.tipo_tramite_id,e.solicitante_id,t.denominacion,t.tupa_fuente,
   r.datos_declarados FROM sigd_doc.expediente e JOIN sigd_doc.tipo_tramite_tupa t USING(tipo_tramite_id)
   LEFT JOIN sigd_tra.radicacion_publica r ON r.expediente_id=e.expediente_id
   WHERE e.expediente_id=$1 AND
   (($2::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM sigd_auth.cuenta_usuario c WHERE c.id_usuario=$2 AND c.activo AND c.id_persona=e.solicitante_id))
    OR ($3::text IS NOT NULL AND r.sesion_hash=$3 AND r.respuesta IS NOT NULL))`,[expediente,titular.usuario??null,titular.sesionHash??null])).rows[0];
  if(!e)fallo('NO_ENCONTRADO','No se encontró un expediente propio para generar la orden.',404);
  if(procedimientoEsperado&&e.tipo_tramite_id!==procedimientoEsperado)fallo('PROCEDIMIENTO_INCOMPATIBLE','El procedimiento no corresponde al expediente.',409);
  const previa=(await c.query(`SELECT o.id,o.codigo,o.importe::text,o.moneda,
   EXISTS(SELECT 1 FROM sigd_tes.pago p WHERE p.orden_id=o.id AND p.estado='VERIFICADO') pago_verificado
   FROM sigd_tes.aplicacion_pago a JOIN sigd_tes.orden_pago o ON o.id=a.orden_id WHERE a.expediente_id=$1
   ORDER BY o.creado_en DESC,o.id DESC LIMIT 1`,[expediente])).rows[0];
  if(previa){await c.query('COMMIT');return {estado:previa.pago_verificado?'PAGO_VERIFICADO':'PENDIENTE_PAGO',ordenId:previa.id,codigo:previa.codigo,importe:previa.importe,moneda:previa.moneda,mensaje:'Orden vinculada al expediente.'};}
  const tarifas=(await c.query(`SELECT f.* FROM sigd_tes.tarifa f WHERE f.tipo_tramite_id=$1 AND f.estado='VALIDADA'
   AND f.vigente_desde<=(now() AT TIME ZONE 'America/Lima')::date
   AND (f.vigente_hasta IS NULL OR f.vigente_hasta>=(now() AT TIME ZONE 'America/Lima')::date)`,[e.tipo_tramite_id])).rows;
  if(tarifas.length!==1){await c.query('COMMIT');return {estado:'PENDIENTE_VALIDACION',mensaje:'Expediente recibido. Tesorería debe confirmar la tarifa y su modalidad antes de emitir una orden.'};}
  const f=tarifas[0],unitario=centimos(f.importe);
  if(unitario===0n){await c.query('COMMIT');return {estado:'GRATUITO',mensaje:'Procedimiento gratuito; no genera orden de pago.'};}
  const fuente=`${e.tupa_fuente?.nombre??''} ${e.tupa_fuente?.costoFuente??''}`;
  const porUnidad=/por (?:cada|unidad|cr[eé]dito|d[ií]a|hoja|m[oó]dulo|semestre)/i.test(fuente);
  if(porUnidad&&cantidad===undefined){await c.query('COMMIT');return {estado:'REQUIERE_CANTIDAD',importe:String(f.importe),moneda:'PEN',mensaje:'El expediente está recibido. Indique la cantidad de unidades de la tarifa documentada para generar la orden.'};}
  if(cantidad!==undefined&&(!Number.isSafeInteger(cantidad)||cantidad<1||cantidad>10000||(!porUnidad&&cantidad!==1)))fallo('CANTIDAD_INVALIDA','La cantidad no corresponde a la modalidad documentada.');
  const unidades=cantidad??1,total=unitario*BigInt(unidades);if(total>99999999999999n)fallo('IMPORTE_EXCEDIDO','El importe supera el límite contable.');
  const importe=`${total/100n}.${String(total%100n).padStart(2,'0')}`,id=randomUUID();
  const declarados=titular.sesionHash?e.datos_declarados:null;
  await c.query(`INSERT INTO sigd_tes.orden_pago(id,codigo,ciudadano_id,persona_id,tarifa_id,tipo_tramite_id,importe,concepto,clave_solicitud,sesion_publica_hash,solicitante_declarado)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,[id,'OP-'+id.toUpperCase(),titular.usuario??null,e.solicitante_id,f.id,e.tipo_tramite_id,importe,f.concepto,expediente,titular.sesionHash??null,declarados?JSON.stringify(declarados):null]);
  await c.query('INSERT INTO sigd_tes.aplicacion_pago(orden_id,expediente_id) VALUES($1,$2)',[id,expediente]);
  await registrarMutacion(c,{esquema:'sigd_tes',tabla:'orden_pago',operacion:'INSERT',datos_despues:{id,accion:'ORDEN_POSTERIOR_RADICACION',expediente_id:expediente,cut:e.codigo_expediente,tarifa_id:f.id,importe_unitario:String(f.importe),cantidad:unidades,importe,fuente:f.fuente}});
  await c.query('COMMIT');return {estado:'PENDIENTE_PAGO',ordenId:id,codigo:'OP-'+id.toUpperCase(),importe,moneda:'PEN',mensaje:'Pague en efectivo en Tesorería indicando el CUT. La orden no acredita pago.'};
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}
export async function intentarOrdenPosterior(pool:Pool,expediente:string,titular:TitularOrdenPosterior):Promise<OrdenPosteriorResultado>{
 try{return await generarOrdenPosterior(pool,expediente,titular);}catch{return {estado:'PENDIENTE_VALIDACION',mensaje:'El expediente y CUT están registrados conforme al TUO de la Ley N° 27444. Tesorería confirmará la condición arancelaria.'};}
}

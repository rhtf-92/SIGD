import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { z } from 'zod';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import { TesoreriaRepository } from './tesoreria.repository.js';
import { exigir, type ActorTesoreria } from './tesoreria.service.js';
import { centimos, decimal, fallo, validarSaldo } from './tesoreria.rules.js';
import { hashPagosConfirmados } from './pago.snapshot.js';

const dinero=z.string().regex(/^(?:0|[1-9]\d{0,11})\.\d{2}$/);
export const aperturaCajaSchema=z.object({saldoInicial:dinero,claveSolicitud:z.string().uuid()}).strict();
export const cierreCajaSchema=z.object({efectivoContado:dinero,observaciones:z.string().trim().min(10).max(2000)}).strict();
export const cobroEfectivoSchema=z.object({ordenId:z.string().uuid(),efectivoRecibido:dinero,confirmaRecepcion:z.literal(true),autorizacionAdicionalId:z.string().uuid().optional()}).strict();
export const entregaEfectivoSchema=z.object({confirmaEntrega:z.literal(true)}).strict();
export function calcularVuelto(importe:string,recibido:string):string{
 if(centimos(importe)<=0n)fallo('PROCEDIMIENTO_GRATUITO','Un procedimiento gratuito no admite cobro.');
 if(centimos(recibido)<centimos(importe))fallo('EFECTIVO_INSUFICIENTE','El efectivo recibido no cubre la tarifa oficial.');
 return decimal(centimos(recibido)-centimos(importe));
}

/** Caja se bloquea después de orden/pago/devolución. El cierre solo toma caja: no hay inversión de bloqueos. */
export class TesoreriaEfectivo {
 constructor(readonly repo:TesoreriaRepository){}
 private async demo(c:PoolClient):Promise<boolean>{return (await c.query('SELECT current_database() db')).rows[0].db==='sigd_jacobo_demo';}
 private async cajaAbierta(c:PoolClient){
  const caja=(await c.query('SELECT * FROM sigd_tes.caja WHERE cerrada_en IS NULL FOR UPDATE')).rows[0];
  if(!caja)fallo('CAJA_CERRADA','Abra la caja antes de registrar efectivo.',409);return caja;
 }
 private async saldo(c:PoolClient,id:string,inicial:string){
  const m=(await c.query("SELECT COALESCE(sum(CASE WHEN tipo='INGRESO' THEN importe ELSE -importe END),0)::numeric(14,2)::text neto FROM sigd_tes.movimiento_caja WHERE caja_id=$1",[id])).rows[0];
  // PostgreSQL calcula el neto firmado. El resultado final nunca debe ser negativo.
  const negativo=m.neto.startsWith('-');const n=centimos(negativo?m.neto.slice(1):m.neto);
  return decimal(centimos(inicial)+(negativo?-n:n));
 }
 async consultar(actor:ActorTesoreria){
  exigir(actor,'TESORERIA_LEER');
  return this.repo.transaccion(async c=>{
   const cajas=(await c.query('SELECT * FROM sigd_tes.caja ORDER BY abierta_en DESC LIMIT 30')).rows;
   const actual=cajas.find(x=>!x.cerrada_en);
   return{cajas,actual:actual?{...actual,saldo_esperado:await this.saldo(c,actual.id,actual.saldo_inicial)}:null,
    movimientos:actual?(await c.query('SELECT * FROM sigd_tes.movimiento_caja WHERE caja_id=$1 ORDER BY creado_en DESC,id LIMIT 200',[actual.id])).rows:[]};
  });
 }
 async abrir(actor:ActorTesoreria,d:z.infer<typeof aperturaCajaSchema>){
  exigir(actor,'TESORERIA_PAGO_REGISTRAR');
  return this.repo.transaccion(async c=>{
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended('tesoreria-apertura',0))");
   const previa=(await c.query('SELECT * FROM sigd_tes.caja WHERE clave_solicitud=$1',[d.claveSolicitud])).rows[0];
   if(previa){if(previa.abierta_por!==actor.usuario||previa.saldo_inicial!==d.saldoInicial)fallo('CLAVE_REUTILIZADA','La clave identifica otra apertura.',409);return previa;}
   if((await c.query('SELECT 1 FROM sigd_tes.caja WHERE cerrada_en IS NULL')).rowCount)fallo('CAJA_ABIERTA','Ya existe una caja abierta.',409);
   const caja=(await c.query('INSERT INTO sigd_tes.caja(clave_solicitud,abierta_por,saldo_inicial,demostracion) VALUES($1,$2,$3,$4) RETURNING *',[d.claveSolicitud,actor.usuario,d.saldoInicial,await this.demo(c)])).rows[0];
   await this.repo.hecho(c,'caja',caja.id,actor.usuario,'CAJA_ABIERTA','Saldo inicial declarado: '+d.saldoInicial);return caja;
  });
 }
 async cerrar(actor:ActorTesoreria,id:string,d:z.infer<typeof cierreCajaSchema>){
  exigir(actor,'TESORERIA_PAGO_REGISTRAR');
  return this.repo.transaccion(async c=>{
   const caja=(await c.query('SELECT * FROM sigd_tes.caja WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!caja)fallo('NO_ENCONTRADO','No existe la caja.',404);
   if(caja.cerrada_en){if(caja.efectivo_contado!==d.efectivoContado||caja.observaciones!==d.observaciones)fallo('CAJA_CERRADA','El cierre no puede modificarse.',409);return caja;}
   const esperado=await this.saldo(c,id,caja.saldo_inicial);
   const r=(await c.query('UPDATE sigd_tes.caja SET cerrada_por=$2,cerrada_en=clock_timestamp(),efectivo_contado=$3,saldo_esperado=$4,diferencia=$3::numeric-$4::numeric,observaciones=$5 WHERE id=$1 RETURNING *',[id,actor.usuario,d.efectivoContado,esperado,d.observaciones])).rows[0];
   await this.repo.hecho(c,'caja',id,actor.usuario,'CAJA_CERRADA',d.observaciones);return r;
  });
 }
 private async recibo(c:PoolClient,actor:ActorTesoreria,codigo:string,lineas:string[],demo:boolean){
  const pdf=await PDFDocument.create(),page=pdf.addPage(),font=await pdf.embedFont(StandardFonts.Helvetica);
  const texto=['IESTP PUBLICO SUIZA - TESORERIA','RECIBO INTERNO '+codigo,...(demo?['DEMOSTRACION - SIN MOVIMIENTO DE DINERO REAL']:[]),...lineas,
   'Fecha Peru: '+new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'medium'}).format(new Date()),
   'Responsable: '+actor.usuario,'No es boleta ni factura SUNAT. No acredita una operacion bancaria.'];
  let y=800;for(const l of texto){page.drawText(l.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' ').slice(0,110),{x:30,y,size:10,font});y-=23;}
  const bytes=Buffer.from(await pdf.save()),sha=createHash('sha256').update(bytes).digest('hex'),config=obtenerConfiguracionS3(),key=`tesoreria/recibos/${randomUUID()}.pdf`;
  const put=await fetch(generarUrlPresigned(key,config,{metodo:'PUT',contentType:'application/pdf',expiraSegundos:60}),{method:'PUT',headers:{'Content-Type':'application/pdf'},body:new Uint8Array(bytes),signal:AbortSignal.timeout(15000)});
  await put.body?.cancel();if(!put.ok)fallo('STORAGE_NO_DISPONIBLE','No se pudo almacenar el recibo.',503);
  const get=await fetch(generarUrlPresigned(key,config,{metodo:'GET',expiraSegundos:60}),{signal:AbortSignal.timeout(10000)});
  if(!get.ok)fallo('STORAGE_NO_DISPONIBLE','No se pudo comprobar el recibo.',503);
  const almacenado=Buffer.from(await get.arrayBuffer());
  if(almacenado.length!==bytes.length||createHash('sha256').update(almacenado).digest('hex')!==sha)fallo('STORAGE_INTEGRIDAD','El recibo no superó la comprobación SHA-256.',503);
  return(await c.query('INSERT INTO sigd_tes.documento(propietario_id,nombre,bucket,clave,sha256,bytes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[actor.usuario,codigo+'.pdf',config.bucket,key,sha,bytes.length])).rows[0].id as string;
 }
 async cobrar(actor:ActorTesoreria,d:z.infer<typeof cobroEfectivoSchema>){
  exigir(actor,'TESORERIA_PAGO_REGISTRAR');exigir(actor,'TESORERIA_PAGO_VERIFICAR');
  return this.repo.transaccion(async c=>{
   const o=(await c.query('SELECT * FROM sigd_tes.orden_pago WHERE id=$1 FOR UPDATE',[d.ordenId])).rows[0];
   if(!o)fallo('NO_ENCONTRADO','No existe la orden.',404);
   if(o.ciudadano_id===actor.usuario)fallo('OPERACION_PROPIA','No puede cobrar una orden propia.',403);
   const pagosPrevios=(await c.query('SELECT id,estado,referencia,fecha_operacion,importe_aplicado::text importe,numero_recibo FROM sigd_tes.pago WHERE orden_id=$1 ORDER BY fecha_operacion,id FOR UPDATE',[o.id])).rows;
   const confirmados=pagosPrevios.filter(p=>p.estado==='VERIFICADO');
   let autorizacionId:string|null=null;
   if(confirmados.length){
    if(!d.autorizacionAdicionalId)fallo('PAGO_DUPLICADO','Este expediente ya registra un pago confirmado. Revise sus recibos y complete la confirmación expresa antes de recibir otro pago.',409);
    const auth=(await c.query(`SELECT * FROM sigd_tes.autorizacion_pago_adicional
      WHERE id=$1 AND orden_id=$2 AND solicitante_id=$3 FOR UPDATE`,[d.autorizacionAdicionalId,o.id,o.ciudadano_id])).rows[0];
    if(!auth||auth.confirmada_en==null||auth.consumida_en!=null||new Date(auth.expira_en).getTime()<=Date.now()
      ||auth.expediente_id==null||auth.importe_autorizado!==o.importe||auth.confirmada_por!==actor.usuario||auth.creada_por!==actor.usuario)
      fallo('AUTORIZACION_INVALIDA','La autorización de pago adicional está ausente, vencida, consumida o no corresponde a esta orden y usuario.',409);
    const snapshotActual=hashPagosConfirmados(confirmados);
    if(snapshotActual!==auth.snapshot_sha256)fallo('ESTADO_PAGO_CAMBIADO','El historial de pagos confirmados cambió después de la confirmación. Vuelva a revisar y confirmar.',409);
    autorizacionId=auth.id;
   }else if(d.autorizacionAdicionalId)fallo('AUTORIZACION_INVALIDA','No hay un pago confirmado que justifique una autorización adicional.',409);
   if(pagosPrevios.some(p=>p.estado!=='VERIFICADO'&&p.estado!=='ANULADO'&&p.estado!=='RECHAZADO'))
    fallo('PAGO_EN_PROCESO','La orden ya tiene un pago en proceso. Revise su estado antes de recibir efectivo.',409);
   const vuelto=calcularVuelto(o.importe,d.efectivoRecibido),caja=await this.cajaAbierta(c),demo=await this.demo(c);
   if(caja.demostracion!==demo)fallo('CAJA_INCOMPATIBLE','La caja no corresponde al entorno.',409);
   const numero=(await c.query("SELECT nextval(pg_get_serial_sequence('sigd_tes.pago','numero_recibo'))::text n")).rows[0].n as string;
   const referencia=(demo?'DEMO-':'')+'RC-'+numero;
   const doc=await this.recibo(c,actor,referencia,['Orden: '+o.codigo,'Concepto: '+o.concepto,'Importe aplicado PEN: '+o.importe,'Efectivo recibido PEN: '+d.efectivoRecibido,'Vuelto PEN: '+vuelto,...(autorizacionId?['PAGO ADICIONAL CONFIRMADO EXPRESAMENTE']:[])],demo);
   const p=(await c.query(`INSERT INTO sigd_tes.pago(orden_id,medio,entidad,referencia,fecha_operacion,documento_id,registrado_por,estado,verificado_por,verificado_en,caja_id,efectivo_recibido,vuelto,importe_aplicado,numero_recibo,demostracion,autorizacion_adicional_id)
    VALUES($1,'CAJA','IESTP SUIZA - CAJA',$2,clock_timestamp(),$3,$4,'VERIFICADO',$4,clock_timestamp(),$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[o.id,referencia,doc,actor.usuario,caja.id,d.efectivoRecibido,vuelto,o.importe,numero,demo,autorizacionId])).rows[0];
   if(autorizacionId){const consumida=await c.query('UPDATE sigd_tes.autorizacion_pago_adicional SET consumida_en=clock_timestamp() WHERE id=$1 AND confirmada_en IS NOT NULL AND consumida_en IS NULL RETURNING id',[autorizacionId]);if(!consumida.rowCount)fallo('AUTORIZACION_REUTILIZADA','La autorización ya fue consumida.',409);}
   await c.query("INSERT INTO sigd_tes.movimiento_caja(caja_id,tipo,importe,pago_id,actor_id) VALUES($1,'INGRESO',$2,$3,$4)",[caja.id,o.importe,p.id,actor.usuario]);
   await this.repo.hecho(c,'pago',p.id,actor.usuario,'PAGO_VERIFICADO',(demo?'DEMOSTRACION: ':'')+'Recepción de efectivo confirmada; recibo interno '+referencia,o.id);return p;
  });
 }
 /** Invocada dentro de la misma transacción que cambia DEVUELTA y publica Outbox. */
 async entregar(c:PoolClient,actor:ActorTesoreria,d:{id:string;importe:string;pago_id:string;total:string},confirmacion:boolean){
  exigir(actor,'TESORERIA_DEVOLUCION_EJECUTAR');if(!confirmacion)fallo('ENTREGA_NO_CONFIRMADA','Confirme la entrega efectiva de dinero en caja.');
  const ejecutado=(await c.query('SELECT COALESCE(sum(e.importe),0)::numeric(14,2)::text importe FROM sigd_tes.ejecucion_devolucion e JOIN sigd_tes.devolucion d ON d.id=e.devolucion_id WHERE d.pago_id=$1',[d.pago_id])).rows[0].importe;
  validarSaldo(d.importe,d.total,ejecutado);
  const caja=await this.cajaAbierta(c);if(centimos(await this.saldo(c,caja.id,caja.saldo_inicial))<centimos(d.importe))fallo('CAJA_SIN_FONDOS','La caja no dispone del saldo para esta entrega.',409);
  const demo=await this.demo(c),ref=(demo?'DEMO-':'')+'RD-'+d.id.toUpperCase();
  const doc=await this.recibo(c,actor,ref,['Devolucion: '+d.id,'Importe entregado en efectivo PEN: '+d.importe],demo);
  const e=(await c.query(`INSERT INTO sigd_tes.ejecucion_devolucion(devolucion_id,importe,entidad,referencia,fecha_operacion,documento_id,ejecutada_por,caja_id,demostracion)
   VALUES($1,$2,'IESTP SUIZA - CAJA',$3,clock_timestamp(),$4,$5,$6,$7) RETURNING id`,[d.id,d.importe,ref,doc,actor.usuario,caja.id,demo])).rows[0];
  await c.query("INSERT INTO sigd_tes.movimiento_caja(caja_id,tipo,importe,ejecucion_id,actor_id) VALUES($1,'DEVOLUCION',$2,$3,$4)",[caja.id,d.importe,e.id,actor.usuario]);
 }
}

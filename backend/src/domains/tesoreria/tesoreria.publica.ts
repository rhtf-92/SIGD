import { z } from 'zod';
import type { Pool, PoolClient } from 'pg';
import { fallo } from './tesoreria.rules.js';
import { generarOrdenPosterior } from './ordenPosterior.service.js';
import { TesoreriaRepository } from './tesoreria.repository.js';

/** Datos declarados; no acredita identidad oficial ni acceso a expedientes antiguos. */
export const ordenPublicaSchema=z.object({
 procedimientoId:z.string().uuid(),claveSolicitud:z.string().uuid(),expedienteId:z.string().uuid().optional(),cantidad:z.number().int().min(1).max(10000).optional(),
 tipoDocumento:z.enum(['DNI','CE']),numeroDocumento:z.string().trim(),
 nombres:z.string().trim().min(2).max(120),apellidos:z.string().trim().min(2).max(120),
 correo:z.string().email().max(254),telefono:z.string().regex(/^\d{7,12}$/),
 declaracionVeracidad:z.literal(true),aceptaTerminos:z.literal(true),
}).strict().superRefine((d,c)=>{if(!(d.tipoDocumento==='DNI'?/^\d{8}$/:/^[A-Za-z0-9]{6,12}$/).test(d.numeroDocumento))c.addIssue({code:'custom',path:['numeroDocumento'],message:'Documento inválido.'});});

export async function ordenesPublicasInstaladas(pool:Pick<Pool,'query'>):Promise<boolean>{
 return(await pool.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='sigd_tes' AND table_name='orden_pago' AND column_name='sesion_publica_hash') habilitado")).rows[0]?.habilitado===true;
}
export class TesoreriaPublica {
 constructor(readonly repo:TesoreriaRepository){}
 async crear(hash:string,d:z.infer<typeof ordenPublicaSchema>){
  if(!/^[0-9a-f]{64}$/.test(hash))fallo('PUBLIC_SESSION_INVALID','La sesión pública no es válida.',403);
  if(!await ordenesPublicasInstaladas(this.repo.pool))fallo('PUBLIC_ORDER_NOT_INSTALLED','Las órdenes públicas están pendientes de activación institucional.',503);
  if(!d.expedienteId)fallo('RADICACION_REQUERIDA','Primero registre su solicitud y obtenga el CUT.');
  const resultado=await generarOrdenPosterior(this.repo.pool,d.expedienteId,{sesionHash:hash},d.cantidad,d.procedimientoId);
  return {...resultado,id:resultado.ordenId};
 }
 /** No lista por DNI ni devuelve personas, cuentas, secretos o historial de terceros. */
 async consultar(id:string,hash:string){
  if(!await ordenesPublicasInstaladas(this.repo.pool))fallo('PUBLIC_ORDER_NOT_INSTALLED','La orden pública no está activada.',503);
  return this.presentar(this.repo.pool,id,hash);
 }
 private async presentar(c:Pick<PoolClient,'query'>,id:string,hash:string){
  const o=(await c.query(`SELECT o.id,o.codigo,o.tipo_tramite_id,o.importe::text,o.moneda,o.concepto,o.creado_en,o.solicitante_declarado,
   t.codigo procedimiento,
   CASE WHEN EXISTS(SELECT 1 FROM sigd_tes.pago pv WHERE pv.orden_id=o.id AND pv.estado='VERIFICADO') THEN 'VERIFICADO'
    ELSE (SELECT pu.estado FROM sigd_tes.pago pu WHERE pu.orden_id=o.id ORDER BY pu.creado_en DESC,pu.id DESC LIMIT 1) END estado_pago,
   (SELECT pu.referencia FROM sigd_tes.pago pu WHERE pu.orden_id=o.id ORDER BY pu.creado_en DESC,pu.id DESC LIMIT 1) referencia,
   COALESCE((SELECT json_agg(json_build_object('id',p.id,'estado',p.estado,'referencia',p.referencia,'fechaOperacion',p.fecha_operacion,
    'importe',p.importe_aplicado::text,'numeroRecibo',p.numero_recibo) ORDER BY p.creado_en,p.id) FROM sigd_tes.pago p WHERE p.orden_id=o.id),'[]'::json) pagos,
   EXISTS(SELECT 1 FROM sigd_tes.aplicacion_pago a WHERE a.orden_id=o.id) aplicada,
   EXISTS(SELECT 1 FROM sigd_tes.devolucion d JOIN sigd_tes.pago p2 ON p2.id=d.pago_id WHERE p2.orden_id=o.id AND d.estado<>'RECHAZADA') en_devolucion
   FROM sigd_tes.orden_pago o JOIN sigd_doc.tipo_tramite_tupa t USING(tipo_tramite_id)
   WHERE o.id=$1 AND o.sesion_publica_hash=$2 AND o.ciudadano_id IS NULL`,[id,hash])).rows[0];
  if(!o)fallo('NO_ENCONTRADO','No se encontró una orden para este formulario.',404);return o;
 }
}

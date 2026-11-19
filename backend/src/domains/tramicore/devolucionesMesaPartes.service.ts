import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { TesoreriaRepository } from '../tesoreria/tesoreria.repository.js';
import { AppError, NotFoundError } from '../../shared/domain/errors/index.js';

const estados=['EN_EVALUACION','OBSERVADA','PENDIENTE_APROBACION','APROBADA','RECHAZADA'] as const;
export type EstadoRevisionDevolucionMesa=typeof estados[number];
export function validarEstadoRevisionDevolucionMesa(value:string):value is EstadoRevisionDevolucionMesa{return estados.includes(value as EstadoRevisionDevolucionMesa);}
export function puedeTransicionarDevolucionMesa(actual:string,siguiente:string):boolean{
 const mapa:Record<string,readonly string[]>={SOLICITADA:['EN_EVALUACION'],EN_EVALUACION:['OBSERVADA','PENDIENTE_APROBACION','APROBADA','RECHAZADA'],OBSERVADA:['EN_EVALUACION'],PENDIENTE_APROBACION:['APROBADA','RECHAZADA']};
 return Boolean(mapa[actual]?.includes(siguiente));
}
function conflicto(mensaje:string):never{throw new AppError({status:409,code:'DEVOLUCION_TRANSICION_INVALIDA',message:mensaje});}

export class DevolucionesMesaPartesService{
 private readonly tesoreria:TesoreriaRepository;
 constructor(private readonly pool:Pool){this.tesoreria=new TesoreriaRepository(pool);}
 async listar(){
  return (await this.pool.query(`SELECT d.id,d.codigo,d.estado,d.motivo,d.sustento,d.importe::text importe,d.creada_en,
    p.id pago_id,p.referencia recibo,p.documento_id recibo_documento_id,rd.nombre recibo_nombre,rd.paginas recibo_paginas,p.numero_recibo,p.fecha_operacion,
    o.codigo orden,o.ciudadano_id,e.expediente_id,e.codigo_expediente cut,persona.id_documento,
    COALESCE(pn.nombre_completo,pn.nombres||' '||pn.apellidos,pj.razon_social) administrado,d.documento_id sustento_documento,sd.nombre sustento_nombre,sd.paginas sustento_paginas,
    od.codigo orden_devolucion,od.aprobada_por,od.aprobada_en,
    COALESCE((SELECT json_agg(json_build_object('documentoId',df.documento_id,'nombre',td.nombre,'paginas',df.paginas,'folioInicio',df.folio_inicio,'folioFin',df.folio_fin,'etapa',df.etapa) ORDER BY df.folio_inicio)
      FROM sigd_tes.devolucion_documento_folio df JOIN sigd_tes.documento td ON td.id=df.documento_id WHERE df.devolucion_id=d.id),'[]'::json) documentos_sustento
   FROM sigd_tes.devolucion d JOIN sigd_tes.pago p ON p.id=d.pago_id
   JOIN sigd_tes.orden_pago o ON o.id=p.orden_id
   LEFT JOIN sigd_tes.aplicacion_pago ap ON ap.orden_id=o.id
   LEFT JOIN sigd_doc.expediente e ON e.expediente_id=ap.expediente_id
   JOIN sigd_auth.persona persona ON persona.id_persona=o.persona_id
   LEFT JOIN sigd_tes.documento rd ON rd.id=p.documento_id
   LEFT JOIN sigd_tes.documento sd ON sd.id=d.documento_id
   LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona=persona.id_persona
   LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona=persona.id_persona
   LEFT JOIN sigd_tes.orden_devolucion od ON od.devolucion_id=d.id
   ORDER BY CASE WHEN d.estado IN('SOLICITADA','EN_EVALUACION','OBSERVADA','PENDIENTE_APROBACION') THEN 0 ELSE 1 END,d.creada_en,d.id LIMIT 500`)).rows;
 }
 async revisar(actor:string,id:string,estado:EstadoRevisionDevolucionMesa,motivo:string){
  return this.tesoreria.transaccion(async c=>{
   const d=(await c.query(`SELECT d.*,p.orden_id,p.estado estado_pago,o.importe total,
      o.ciudadano_id,o.persona_id,p.documento_id recibo_documento_id,e.expediente_id,e.codigo_expediente cut
     FROM sigd_tes.devolucion d JOIN sigd_tes.pago p ON p.id=d.pago_id
     JOIN sigd_tes.orden_pago o ON o.id=p.orden_id
     LEFT JOIN sigd_tes.aplicacion_pago a ON a.orden_id=o.id
     LEFT JOIN sigd_doc.expediente e ON e.expediente_id=a.expediente_id
     WHERE d.id=$1 FOR UPDATE OF d,p,o`,[id])).rows[0];
   if(!d)throw new NotFoundError({message:'No se encontró la solicitud de devolución.'});
    if(d.estado===estado)return d;
   if(!puedeTransicionarDevolucionMesa(d.estado,estado))conflicto('La solicitud no admite la transición indicada.');
   if(motivo.trim().length<10)throw new AppError({status:422,code:'FUNDAMENTO_REQUERIDO',message:'Registre el motivo de la evaluación.'});
   if(estado==='APROBADA'){
    if(d.estado_pago!=='VERIFICADO')conflicto('Solo se aprueba la devolución de un pago confirmado.');
    if(!d.expediente_id||!d.cut||!d.recibo_documento_id)conflicto('La devolución carece de expediente, CUT o recibo original vinculado.');
    const idOrden=randomUUID();
    const ticket=(await c.query(`INSERT INTO sigd_tes.orden_devolucion(id,codigo,devolucion_id,expediente_id,cut,pago_id,recibo_documento_id,
      solicitante_id,importe,aprobada_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [idOrden,'ORD-DEV-'+idOrden.toUpperCase(),d.id,d.expediente_id,d.cut,d.pago_id,d.recibo_documento_id,d.ciudadano_id,d.importe,actor])).rows[0];
    await c.query(`UPDATE sigd_tes.devolucion SET estado='APROBADA',aprobada_por=$2 WHERE id=$1`,[id,actor]);
    await this.tesoreria.hecho(c,'orden_devolucion',ticket.id,actor,'DEVOLUCION_ORDEN_GENERADA',motivo,d.orden_id,d.id);
    return ticket;
   }
   const campos=estado==='EN_EVALUACION'?'evaluada_por=COALESCE(evaluada_por,$2::uuid),estado=$3': 'estado=$3';
   const resultado=await c.query(`UPDATE sigd_tes.devolucion SET ${campos} WHERE id=$1 RETURNING *`,[id,actor,estado]);
   await this.tesoreria.hecho(c,'devolucion',id,actor,'DEVOLUCION_MESA_PARTES_'+estado,motivo,d.orden_id,id);
   return resultado.rows[0];
  });
 }
}

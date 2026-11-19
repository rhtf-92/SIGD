import {createHash} from 'node:crypto';
export interface PagoConfirmadoSnapshot {id:string;referencia:string;fecha_operacion:Date|string;importe:string;numero_recibo:string|number}
export function hashPagosConfirmados(pagos:readonly PagoConfirmadoSnapshot[]):string{
 const datos=pagos.map(p=>({id:p.id,referencia:p.referencia,fecha:p.fecha_operacion,importe:p.importe,numeroRecibo:p.numero_recibo}));
 return createHash('sha256').update(JSON.stringify(datos)).digest('hex');
}

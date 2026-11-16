import { createHash, randomBytes } from 'node:crypto';
import { TesoreriaRepository } from './tesoreria.repository.js';
import { exigir, type ActorTesoreria } from './tesoreria.service.js';
import { fallo } from './tesoreria.rules.js';
import { hashPagosConfirmados } from './pago.snapshot.js';

function sha(value: string): string { return createHash('sha256').update(value).digest('hex'); }

export class PagoAdicionalService {
  constructor(private readonly repo: TesoreriaRepository) {}

  async detectar(actor: ActorTesoreria, ordenId: string) {
    exigir(actor, 'TESORERIA_PAGO_REGISTRAR');
    return this.repo.transaccion(async c => {
      const orden = (await c.query(`SELECT o.id,o.ciudadano_id,o.importe::text importe,a.expediente_id
        FROM sigd_tes.orden_pago o LEFT JOIN sigd_tes.aplicacion_pago a ON a.orden_id=o.id
        WHERE o.id=$1 FOR UPDATE OF o`, [ordenId])).rows[0];
      if (!orden || !orden.expediente_id) fallo('NO_ENCONTRADO', 'No se encontró la orden asociada a un expediente.', 404);
      if (orden.ciudadano_id === actor.usuario) fallo('OPERACION_PROPIA', 'El TESORERO no puede autorizar ni cobrar su propia orden.', 403);
      const pagos = (await c.query(`SELECT p.id,p.referencia,p.fecha_operacion,p.importe_aplicado::text importe,p.estado,
          p.numero_recibo,d.nombre recibo
        FROM sigd_tes.pago p LEFT JOIN sigd_tes.documento d ON d.id=p.documento_id
        WHERE p.orden_id=$1 AND p.estado='VERIFICADO' ORDER BY p.fecha_operacion,p.id`, [ordenId])).rows;
      if (!pagos.length) return { requiereConfirmacion: false, pagos: [] };

      const token = randomBytes(32).toString('base64url');
      const snapshot = hashPagosConfirmados(pagos);
      await c.query(`INSERT INTO sigd_tes.autorizacion_pago_adicional
        (orden_id,expediente_id,solicitante_id,importe_autorizado,token_sha256,snapshot_sha256,creada_por,expira_en)
        VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval '10 minutes')`,
      [ordenId,orden.expediente_id,orden.ciudadano_id,orden.importe,sha(token),snapshot,actor.usuario]);
      return { requiereConfirmacion: true, token, importe: orden.importe, pagos };
    });
  }

  async confirmar(actor: ActorTesoreria, ordenId: string, token: string) {
    exigir(actor, 'TESORERIA_PAGO_REGISTRAR');
    const tokenHash=sha(token);
    return this.repo.transaccion(async c => {
      const orden=(await c.query(`SELECT o.id,o.ciudadano_id,o.importe::text importe,a.expediente_id
        FROM sigd_tes.orden_pago o LEFT JOIN sigd_tes.aplicacion_pago a ON a.orden_id=o.id
        WHERE o.id=$1 FOR UPDATE OF o`,[ordenId])).rows[0];
      if(!orden||!orden.expediente_id)fallo('NO_ENCONTRADO','No se encontró la orden asociada a un expediente.',404);
      if(orden.ciudadano_id===actor.usuario)fallo('OPERACION_PROPIA','El TESORERO no puede confirmar ni cobrar su propia orden.',403);
      const autorizacion=(await c.query(`SELECT * FROM sigd_tes.autorizacion_pago_adicional
        WHERE orden_id=$1 AND token_sha256=$2 FOR UPDATE`,[ordenId,tokenHash])).rows[0];
      if(!autorizacion||autorizacion.solicitante_id!==orden.ciudadano_id||autorizacion.expediente_id!==orden.expediente_id||autorizacion.creada_por!==actor.usuario)
        fallo('AUTORIZACION_INVALIDA','La confirmación no corresponde a esta orden.',403);
      if(autorizacion.consumida_en||autorizacion.confirmada_en)fallo('AUTORIZACION_REUTILIZADA','La confirmación ya se utilizó.',409);
      if(new Date(autorizacion.expira_en).getTime()<=Date.now())fallo('AUTORIZACION_EXPIRADA','La confirmación venció. Vuelva a revisar los pagos previos.',409);
      if(autorizacion.importe_autorizado!==orden.importe)fallo('IMPORTE_CAMBIADO','El importe de la orden cambió; solicite una nueva confirmación.',409);
      const pagos=(await c.query(`SELECT id,referencia,fecha_operacion,importe_aplicado::text importe,numero_recibo
        FROM sigd_tes.pago WHERE orden_id=$1 AND estado='VERIFICADO' ORDER BY fecha_operacion,id`,[ordenId])).rows;
      const snapshot=hashPagosConfirmados(pagos);
      if(snapshot!==autorizacion.snapshot_sha256)fallo('ESTADO_PAGO_CAMBIADO','El estado de los pagos cambió. Revise nuevamente antes de continuar.',409);
      const actualizada=(await c.query(`UPDATE sigd_tes.autorizacion_pago_adicional SET confirmada_en=clock_timestamp(),confirmada_por=$2
        WHERE id=$1 AND confirmada_en IS NULL AND consumida_en IS NULL RETURNING id,expira_en`,[autorizacion.id,actor.usuario])).rows[0];
      if(!actualizada)fallo('AUTORIZACION_REUTILIZADA','La confirmación ya se utilizó.',409);
      await this.repo.hecho(c,'autorizacion_pago_adicional',autorizacion.id,actor.usuario,
        'PAGO_ADICIONAL_CONFIRMADO','Confirmación expresa posterior a advertencia de pago confirmado.',ordenId);
      return { autorizacionId:actualizada.id, expiraEn:actualizada.expira_en };
    });
  }
}


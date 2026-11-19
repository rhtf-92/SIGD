import {describe,it,expect,vi} from 'vitest';
import type {Pool} from 'pg';
import {calcularVuelto,cobroEfectivoSchema,aperturaCajaSchema,cierreCajaSchema,TesoreriaEfectivo} from '../../../../src/domains/tesoreria/tesoreria.efectivo.js';
import {TesoreriaRepository} from '../../../../src/domains/tesoreria/tesoreria.repository.js';
import {permisoTransicion} from '../../../../src/domains/tesoreria/tesoreria.rules.js';
const id='11111111-1111-4111-8111-111111111111';
describe('Efectivo y rol único TESORERO',()=>{
 it.each([['80.00','100.00','20.00'],['124.00','124.00','0.00'],['16.50','20.00','3.50'],['0.10','0.30','0.20']])('vuelto exacto %s / %s',(importe,recibido,vuelto)=>expect(calcularVuelto(importe,recibido)).toBe(vuelto));
 it('no permite cobro insuficiente',()=>expect(()=>calcularVuelto('124.00','100.00')).toThrow());
 it('no cobra un procedimiento gratuito',()=>expect(()=>calcularVuelto('0.00','10.00')).toThrow());
 it('no acepta importe definitivo ni identidad desde React',()=>expect(cobroEfectivoSchema.safeParse({ordenId:id,efectivoRecibido:'124.00',confirmaRecepcion:true,importe:'1.00',personaId:id}).success).toBe(false));
 it('exige confirmación de recepción',()=>expect(cobroEfectivoSchema.safeParse({ordenId:id,efectivoRecibido:'124.00',confirmaRecepcion:false}).success).toBe(false));
 it('no permite pasar una referencia bancaria como pago en efectivo',()=>expect(cobroEfectivoSchema.safeParse({ordenId:id,efectivoRecibido:'124.00',confirmaRecepcion:true,medio:'TRANSFERENCIA'}).success).toBe(false));
 it('mantiene apertura idempotente y saldo no negativo',()=>{expect(aperturaCajaSchema.safeParse({saldoInicial:'0.00',claveSolicitud:id}).success).toBe(true);expect(aperturaCajaSchema.safeParse({saldoInicial:'-1.00',claveSolicitud:id}).success).toBe(false);});
 it('requiere observaciones al cerrar, incluso con diferencia cero',()=>expect(cierreCajaSchema.safeParse({efectivoContado:'124.00',observaciones:''}).success).toBe(false));
 it('Mesa de Partes evalúa y aprueba solicitudes antes de Tesorería',()=>expect(permisoTransicion('EN_EVALUACION','APROBADA')).toBe('TRAMICORE_DEVOLUCION_EVALUAR'));
 it('la decisión pendiente de aprobación sigue bajo Mesa de Partes',()=>expect(permisoTransicion('PENDIENTE_APROBACION','APROBADA')).toBe('TRAMICORE_DEVOLUCION_EVALUAR'));
 it('no permite saltar desde solicitada a entrega',()=>expect(()=>permisoTransicion('SOLICITADA','DEVUELTA')).toThrow());
 it('la API de caja rechaza un pago adicional sin autorización antes de escribir o acceder a MinIO',async()=>{
  const query=vi.fn(async(sql:string)=>sql.includes('SELECT * FROM sigd_tes.orden_pago WHERE id=$1 FOR UPDATE')?{rows:[{id,ciudadano_id:'22222222-2222-4222-8222-222222222222',importe:'80.00'}],rowCount:1}:sql.includes('FROM sigd_tes.pago WHERE orden_id=$1 ORDER BY fecha_operacion,id FOR UPDATE')?{rows:[{id:'33333333-3333-4333-8333-333333333333',estado:'VERIFICADO'}],rowCount:1}:{rows:[],rowCount:1});
  const client={query,release:vi.fn()},repo=new TesoreriaRepository({connect:vi.fn().mockResolvedValue(client)} as unknown as Pool);
  const service=new TesoreriaEfectivo(repo),actor={usuario:'44444444-4444-4444-8444-444444444444',persona:id,ciudadano:false,permisos:['TESORERIA_PAGO_REGISTRAR','TESORERIA_PAGO_VERIFICAR']};
  await expect(service.cobrar(actor,cobroEfectivoSchema.parse({ordenId:id,efectivoRecibido:'100.00',confirmaRecepcion:true}))).rejects.toMatchObject({code:'PAGO_DUPLICADO',status:409});
  expect(query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'),[id]);
  expect(query.mock.calls.some(([sql])=>String(sql).startsWith('INSERT'))).toBe(false);
  expect(query).toHaveBeenCalledWith('ROLLBACK');
 });
});

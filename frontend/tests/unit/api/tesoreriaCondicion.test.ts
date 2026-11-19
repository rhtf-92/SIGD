import{describe,it,expect}from'vitest';
import{condicionDeTarifa,saldoDevolucion,type CatalogoFinanciero,type DevolucionFinanciera}from'@/services/tesoreriaService';
const t={id:'fixture',codigo:'FIXTURE',denominacion:'Solo prueba',tarifas:[]}as CatalogoFinanciero;
const d=(estado:string,importe:string)=>({estado,importe})as DevolucionFinanciera;
describe('Condición financiera y elegibilidad de devolución',()=>{
 it('no presume gratuidad sin tarifa ni ante respuestas incompletas',()=>{expect(condicionDeTarifa(t)).toBe('PENDIENTE_VALIDACION');expect(condicionDeTarifa({...t,tarifas:undefined}as unknown as CatalogoFinanciero)).toBe('PENDIENTE_VALIDACION');});
 it('distingue tarifa validada gratuita y tarifada sin calcular precios nuevos',()=>{expect(condicionDeTarifa({...t,tarifas:[{id:'f',importe:'0.00',concepto:'Fixture',fuente:'Solo prueba'}]})).toBe('GRATUITO');expect(condicionDeTarifa({...t,tarifas:[{id:'f',importe:'124.00',concepto:'Fixture',fuente:'Solo prueba'}]})).toBe('SUJETO_PAGO');});
 it('reserva una solicitud activa y oculta una segunda solicitud',()=>{expect(saldoDevolucion('80.00',[d('SOLICITADA','10.00')])).toEqual({importe:'70.00',admiteSolicitud:false});});
 it('descuenta devoluciones ejecutadas y permite solicitar el saldo restante',()=>{expect(saldoDevolucion('80.00',[d('CERRADA','10.00'),d('RECHAZADA','20.00')])).toEqual({importe:'70.00',admiteSolicitud:true});});
 it('no ofrece devolución cuando se agotó el saldo y suma céntimos exactos',()=>{expect(saldoDevolucion('0.30',[d('DEVUELTA','0.10'),d('CERRADA','0.20')])).toEqual({importe:'0.00',admiteSolicitud:false});});
});

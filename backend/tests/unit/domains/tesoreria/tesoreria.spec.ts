import { describe,it,expect,vi,afterEach } from 'vitest';
import type { Pool,PoolClient } from 'pg';
import { centimos,decimal,validarSaldo,permisoTransicion,permisosM10ParaRoles } from '../../../../src/domains/tesoreria/tesoreria.rules.js';
import { pagoSchema,ordenSchema,tarifaSchema,devolucionSchema,periodoSchema } from '../../../../src/domains/tesoreria/tesoreria.schemas.js';
import { exigir } from '../../../../src/domains/tesoreria/tesoreria.service.js';
import { validarPagoRadicacion } from '../../../../src/domains/tesoreria/tesoreria.radicacion.js';
import { TesoreriaRepository } from '../../../../src/domains/tesoreria/tesoreria.repository.js';
const ID='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
afterEach(()=>vi.restoreAllMocks());
describe('M10 importes, contratos y segregación',()=>{
 it('calcula céntimos exactos sin coma flotante',()=>{expect(centimos('0.10')+centimos('0.20')).toBe(30n);expect(decimal(centimos('999999999999.99'))).toBe('999999999999.99');});
 it.each(['NaN','-1.00','1e3','0.001','1','01.00','1000000000000.00'])('rechaza importe %s',v=>expect(()=>centimos(v)).toThrow());
 it('reserva saldo y admite exactamente el restante',()=>{expect(()=>validarSaldo('20.00','100.00','80.00')).not.toThrow();expect(()=>validarSaldo('20.01','100.00','80.00')).toThrow();expect(()=>validarSaldo('0.00','100.00','0.00')).toThrow();});
 it('no admite importes, titular o estados impuestos al generar orden',()=>{expect(ordenSchema.safeParse({procedimientoId:ID,claveSolicitud:OTHER,importe:'0.00',personaId:ID}).success).toBe(false);});
 it('no permite marcar un voucher como verificado desde el registro',()=>{expect(pagoSchema.safeParse({ordenId:ID,medio:'TRANSFERENCIA',entidad:'DEMO',referencia:'OP-DEMO',fechaOperacion:new Date().toISOString(),documentoId:ID,estado:'VERIFICADO'}).success).toBe(false);});
 it('rechaza pago sin documento y medio no contratado',()=>{expect(pagoSchema.safeParse({ordenId:ID,medio:'NIUBIZ'}).success).toBe(false);});
 it('no permite tarifa sin evidencia y fuente',()=>{expect(tarifaSchema.safeParse({procedimientoId:ID,importe:'80.00'}).success).toBe(false);});
 it('admite propuesta de gratuidad explícita con evidencia',()=>{expect(tarifaSchema.safeParse({procedimientoId:ID,importe:'0.00',concepto:'Gratuidad de prueba',fuente:'Documento exclusivamente unitario',documentoId:ID,vigenteDesde:'2026-01-01'}).success).toBe(true);});
 it('requiere sustento y motivo autorizado en devolución',()=>{expect(devolucionSchema.safeParse({pagoId:ID,importe:'80.00',motivo:'TRAMITE_EQUIVOCADO',sustento:'Procedimiento seleccionado por equivocación',claveSolicitud:OTHER}).success).toBe(true);});
 it('asigna revisión y aprobación a Mesa de Partes y ejecución a Tesorería',()=>{expect(permisoTransicion('SOLICITADA','EN_EVALUACION')).toBe('TRAMICORE_DEVOLUCION_EVALUAR');expect(permisoTransicion('PENDIENTE_APROBACION','APROBADA')).toBe('TRAMICORE_DEVOLUCION_EVALUAR');expect(permisoTransicion('EN_PROCESO_DEVOLUCION','DEVUELTA')).toBe('TESORERIA_DEVOLUCION_EJECUTAR');});
 it.each([['SOLICITADA','DEVUELTA'],['RECHAZADA','APROBADA'],['DEVUELTA','EN_EVALUACION']])('rechaza salto %s a %s',(a,b)=>expect(()=>permisoTransicion(a,b)).toThrow());
 it('no confiere privilegios financieros por llamarse administrador',()=>{expect(()=>exigir({usuario:ID,persona:ID,ciudadano:false,permisos:[]},'TESORERIA_DEVOLUCION_APROBAR')).toThrow();});
 it('ADMINISTRADOR recibe solo lectura y reportes; TESORERO conserva los permisos RBAC efectivos',()=>{
  const admin=permisosM10ParaRoles(['ADMINISTRADOR'],[]);
  expect(admin.sort()).toEqual(['TESORERIA_LEER','TESORERIA_REPORTES']);
  expect(permisosM10ParaRoles(['SUPER_ADMIN'],[]).sort()).toEqual(['TESORERIA_LEER','TESORERIA_REPORTES']);
  expect(permisosM10ParaRoles(['MESA_PARTES'],[],true).sort()).toEqual(['TESORERIA_LEER','TESORERIA_REPORTES']);
  expect(()=>exigir({usuario:ID,persona:ID,ciudadano:false,permisos:admin},'TESORERIA_PAGO_REGISTRAR')).toThrow();
  expect(()=>exigir({usuario:ID,persona:ID,ciudadano:false,permisos:admin},'TESORERIA_DEVOLUCION_EJECUTAR')).toThrow();
  expect(permisosM10ParaRoles(['TESORERO'],['TESORERIA_LEER','TESORERIA_PAGO_REGISTRAR'])).toEqual(['TESORERIA_LEER','TESORERIA_PAGO_REGISTRAR']);
  expect(permisosM10ParaRoles(['CAJERO'],['TESORERIA_LEER','TESORERIA_PAGO_REGISTRAR'])).toEqual([]);
 });
 it('limita el reporte a un periodo válido',()=>{expect(periodoSchema.safeParse({desde:'2026-01-01',hasta:'2028-01-01'}).success).toBe(false);});
});
describe('M10 → M3: condiciones antes del CUT',()=>{
 function cliente(orden?:Record<string,unknown>,reservada=false,devolucion=false){return{query:vi.fn(async(sql:string)=>{
  if(sql.includes('to_regclass'))return{rows:[{tabla:'sigd_tes.orden_pago'}]};
  if(sql.includes('FOR UPDATE'))return{rows:orden?[orden]:[]};
  if(sql.includes('aplicacion_pago'))return{rows:[],rowCount:reservada?1:0};
  if(sql.includes('devolucion'))return{rows:[],rowCount:devolucion?1:0};
  return{rows:[{importe:'80.00'}]};
 })} as unknown as PoolClient;}
 const orden={id:ID,persona_id:ID,ciudadano_id:ID,tipo_tramite_id:ID,importe:'80.00',estado_pago:'VERIFICADO',pago_id:ID};
 it('recibe un procedimiento con costo sin exigir orden previa',async()=>{expect(await validarPagoRadicacion(cliente(),ID,ID,ID,undefined,false)).toBe(null);});
 it('la ausencia de Tesorería no impide recibir y emitir el CUT',async()=>{const c={query:vi.fn().mockResolvedValue({rows:[{tabla:null}]})} as unknown as PoolClient;expect(await validarPagoRadicacion(c,ID,ID,ID,undefined,false)).toBe(null);expect(c.query).not.toHaveBeenCalled();});
 it('una orden propia pendiente permite recepción sin marcar el pago verificado',async()=>{expect(await validarPagoRadicacion(cliente({...orden,estado_pago:'REGISTRADO'}),ID,ID,ID,ID,false)).toBe(ID);});
 it('acepta pago verificado del titular y procedimiento correctos',async()=>{expect(await validarPagoRadicacion(cliente(orden),ID,ID,ID,ID,false)).toBe(ID);});
 it('rechaza orden de otro procedimiento',async()=>{await expect(validarPagoRadicacion(cliente(orden),OTHER,ID,ID,ID,false)).rejects.toMatchObject({status:403});});
 it('rechaza orden de otra cuenta aun con persona coincidente',async()=>{await expect(validarPagoRadicacion(cliente(orden),ID,ID,OTHER,ID,false)).rejects.toMatchObject({status:403});});
 it('rechaza segunda aplicación y reserva por devolución',async()=>{await expect(validarPagoRadicacion(cliente(orden,true),ID,ID,ID,ID,false)).rejects.toMatchObject({code:'ORDEN_YA_APLICADA'});await expect(validarPagoRadicacion(cliente(orden,false,true),ID,ID,ID,ID,false)).rejects.toMatchObject({code:'PAGO_EN_DEVOLUCION'});});
 it('la gratuidad validada no exige comprobante',async()=>{const c={query:vi.fn().mockResolvedValueOnce({rows:[{tabla:'sigd_tes.orden_pago'}]}).mockResolvedValueOnce({rows:[{importe:'0.00'}]})} as unknown as PoolClient;expect(await validarPagoRadicacion(c,ID,ID,ID,undefined,false)).toBe(null);});
 it('la excepción demo no genera un pago',async()=>{const c=cliente();expect(await validarPagoRadicacion(c,ID,ID,ID,undefined,true)).toBe(null);expect(c.query).not.toHaveBeenCalled();});
 it('revierte y libera la conexión si falla una mutación',async()=>{const c={query:vi.fn(),release:vi.fn()};const repo=new TesoreriaRepository({connect:vi.fn(async()=>c)} as unknown as Pool);await expect(repo.transaccion(async()=>{throw Error('fallo de ensayo');})).rejects.toThrow('fallo de ensayo');expect(c.query.mock.calls.map(v=>v[0])).toEqual(['BEGIN','ROLLBACK']);expect(c.release).toHaveBeenCalledOnce();});
});

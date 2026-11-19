import { describe,it,expect,vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../../../src/app.js';
const id='6e1ca447-238a-4c03-869d-2690e674a397';
function fixture(inconsistente:boolean,autorizado=true){
 const query=vi.fn(async(sql:string)=>{
  if(sql.includes('AS inconsistente'))return {rows:[{inconsistente}]};
  if(sql.includes('fecha_radicacion AT TIME ZONE'))return {rows:[{fecha_inicio:'2026-10-27'}]};
  throw Error('Consulta inesperada');
 });
 const connect=vi.fn(async()=>({query:vi.fn(async()=>({rowCount:0,rows:[]})),release:vi.fn()}));
 const app=construirApp({query,connect} as unknown as Pool,{actorProviderRutaDoc:{obtenerActor:()=>({id:'11111111-1111-4111-8111-111111111111',roles:[],permisos:autorizado?[{codigo:'EXPEDIENTE_DERIVAR',ambito:'GLOBAL' as const,areaId:null},{codigo:'EXPEDIENTE_RESOLVER',ambito:'GLOBAL' as const,areaId:null},{codigo:'EXPEDIENTE_RECEPCIONAR',ambito:'GLOBAL' as const,areaId:null},{codigo:'EXPEDIENTE_OBSERVAR',ambito:'GLOBAL' as const,areaId:null},{codigo:'EXPEDIENTE_SUBSANAR',ambito:'GLOBAL' as const,areaId:null}]:[]})}});
 return {app,query,connect};
}
describe('Integridad de la proyeccion de RutaDoc antes de escribir (HTTP con mocks)',()=>{
 it.each(['derivar','recepcionar','archivar','atender','observar','subsanar'])('rechaza %s sin actuaciones coincidentes antes de abrir transaccion',async(accion)=>{
  const f=fixture(true);const r=await request(f.app).post(`/api/v1/expedientes/${id}/${accion}`).send({});
  expect(r.status).toBe(409);expect(r.body.code).toBe('ESTADO_SIN_TRAZABILIDAD');expect(f.connect).not.toHaveBeenCalled();
 });
 it('comprueba autorizacion antes de revelar la inconsistencia del expediente',async()=>{
  const f=fixture(true,false);const r=await request(f.app).post(`/api/v1/expedientes/${id}/derivar`).send({});
  expect(r.status).toBe(403);expect(f.query).not.toHaveBeenCalled();expect(f.connect).not.toHaveBeenCalled();
 });
 it('una proyeccion respaldada conserva las validaciones originales del endpoint',async()=>{
  const f=fixture(false);const r=await request(f.app).post(`/api/v1/expedientes/${id}/derivar`).send({});
  expect(r.status).toBe(400);expect(r.body.code).toBe('VALIDATION_ERROR');
 });
});

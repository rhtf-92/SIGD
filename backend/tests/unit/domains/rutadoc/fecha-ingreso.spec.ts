import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { RepositorioPostgresRutaDoc, SQL_LISTAR_RUTADOC, SQL_CONTADORES_SIN_TERMINO_RUTADOC } from '../../../../src/domains/rutadoc/rutadoc.repository.js';
describe('lectura de fecha de ingreso sin alterar fecha legal ni cursores',()=>{
 it('proyecta ingreso del primer asiento o registro documental y filtra el día peruano',()=>{
  for(const sql of [SQL_LISTAR_RUTADOC, SQL_CONTADORES_SIN_TERMINO_RUTADOC]){
   expect(sql).toContain('COALESCE(ar.fecha_ingreso, recibido.fecha_registro)');
   expect(sql).toContain("AT TIME ZONE 'America/Lima'");
   expect(sql).not.toContain("AT TIME ZONE 'UTC'");
  }
  expect(SQL_LISTAR_RUTADOC).toContain('ORDER BY expediente_id, numero_registro ASC');
  expect(SQL_LISTAR_RUTADOC).toContain('(e.fecha_radicacion, e.expediente_id)');
 });
 it('separa las dos fechas al mapear la respuesta y conserva ausencia real como null',async()=>{
  const query=vi.fn().mockResolvedValue({rows:[{elementos:[
   {id_expediente:'1',cut:'EXP-2026-000034',asunto:'Fixture',fecha_radicacion:'2026-11-02T13:00:00Z',fecha_ingreso:'2026-10-30T23:31:43.406Z',estado_actual:'REGISTRADO',area_actual_id:null},
   {id_expediente:'2',cut:'EXP-2026-000035',asunto:'Fixture sin recepción',fecha_radicacion:'2026-11-02T13:00:00Z',fecha_ingreso:null,estado_actual:'REGISTRADO',area_actual_id:null},
  ],contadores:{}}]});
  const result=await new RepositorioPostgresRutaDoc({query} as unknown as Pool).listar({pestana:'PENDIENTES',limite:20},['REGISTRADO'],null,{accesoGlobal:true,solicitanteId:null});
  expect(result.elementos[0]).toMatchObject({fechaIngreso:'2026-10-30T23:31:43.406Z',fechaRadicacion:'2026-11-02T13:00:00.000Z'});
  expect(result.elementos[1].fechaIngreso).toBeNull();
 });
});

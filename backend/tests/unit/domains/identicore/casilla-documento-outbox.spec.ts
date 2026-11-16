import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { crearRouterCasilla } from '../../../../src/domains/identicore/casilla.router.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { cotejarPdfFirmado } from '../../../../src/domains/docucore/callbackRefirma.service.js';
vi.mock('../../../../src/core/storage/storage.router.js', () => ({ generarDescargaAutorizada: (bucket: string, key: string) => 'https://storage.invalid/' + bucket + '/' + key }));
vi.mock('../../../../src/domains/docucore/callbackRefirma.service.js', () => ({ cotejarPdfFirmado: vi.fn(async () => Buffer.from('Contrato simulado; no firma real')) }));
const usuario='11111111-1111-4111-8111-111111111111', documento='22222222-2222-4222-8222-222222222222';
function fixture({ resolucion=false, ajena=false, disponible=true }={}) {
  const query=vi.fn(async(sql:string) => {
    if(sql.includes('cuenta_usuario')) return {rows:[{id_usuario:usuario}]};
    if(sql.includes('SELECT * FROM sigd_auth.notificacion_casilla')) return {rows:[{usuario_id:ajena?'33333333-3333-4333-8333-333333333333':usuario,cut:'EXP-PRUEBA',tipo_acto:resolucion?'resolucion_emitida':'observacion',cuerpo:resolucion?{tipo_acto:'resolucion_emitida',cvd:'CVD-UNITARIO'}:{},documento_url:`/api/v1/storage/documentos/${documento}/download`}]};
    if(sql.includes('FROM sigd_doc.documento_adjunto')) return {rows: disponible?[{s3_bucket:'bucket-unitario',s3_key:resolucion?'firmado.pdf':'adjunto.pdf',sha256_firmado:'a'.repeat(64)}]:[]};
    throw Error('SQL inesperado');
  });
  const app=express();app.use('/api/v1',crearRouterCasilla({query} as unknown as Pool));
  app.use((error:{status?:number},_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(error.status??500).json({error:true}));
  return {app,query};
}
beforeEach(()=>vi.clearAllMocks());
describe('Descarga del acto de Casilla con contrato simulado',()=>{
 it('resuelve el identificador opaco del Outbox por el expediente de la notificacion',async()=>{
   const f=fixture();const r=await request(f.app).get('/api/v1/casilla/notificaciones/notif/documento/descargar').auth(firmarTokenAcceso({sub:usuario}),{type:'bearer'});
   expect(r.status).toBe(200);expect(r.body.downloadUrl).toContain('adjunto.pdf');
   expect(f.query).toHaveBeenCalledWith(expect.stringContaining('e.codigo_expediente = $2'),[documento,'EXP-PRUEBA',false,null]);expect(cotejarPdfFirmado).not.toHaveBeenCalled();
 });
 it('una resolucion entrega el artefacto firmado cotejado, sin devolver el borrador',async()=>{
   const f=fixture({resolucion:true});const r=await request(f.app).get('/api/v1/casilla/notificaciones/notif/documento/descargar').auth(firmarTokenAcceso({sub:usuario}),{type:'bearer'});
   expect(r.status).toBe(200);expect(r.body.downloadUrl).toContain('firmado.pdf');expect(cotejarPdfFirmado).toHaveBeenCalledWith({s3_bucket:'bucket-unitario',s3_key:'firmado.pdf',sha256_firmado:'a'.repeat(64)});
 });
 it('no inventa una referencia si falta el documento o la evidencia',async()=>{
   const f=fixture({resolucion:true,disponible:false});const r=await request(f.app).get('/api/v1/casilla/notificaciones/notif/documento/descargar').auth(firmarTokenAcceso({sub:usuario}),{type:'bearer'});expect(r.status).toBe(503);expect(cotejarPdfFirmado).not.toHaveBeenCalled();
 });
 it('rechaza al ajeno antes de consultar documentos o Storage',async()=>{
   const f=fixture({ajena:true});const r=await request(f.app).get('/api/v1/casilla/notificaciones/notif/documento/descargar').auth(firmarTokenAcceso({sub:usuario}),{type:'bearer'});expect(r.status).toBe(403);expect(f.query.mock.calls.some(([sql])=>sql.includes('FROM sigd_doc.documento_adjunto'))).toBe(false);expect(cotejarPdfFirmado).not.toHaveBeenCalled();
 });
});

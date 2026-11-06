import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { ejecutarMigraciones } from '../../src/db/migrate.js';
import { RepositorioMgdAnalytics } from '../../src/domains/corelink/mgdAnalytics.repository.js';
const url=new URL(process.env.DATABASE_URL!);
assert.equal(url.pathname,'/sigd_validacion_f_bartra');
const pool=new Pool({connectionString:url.toString()});
const base='http://localhost:3001';
const credentials=readFileSync('.env.demo.test.local','utf8');
const identificador=credentials.match(/^DEMO_USER=(.+)$/m)![1],password=credentials.match(/^DEMO_PASSWORD=(.+)$/m)![1];
const flow=JSON.parse(readFileSync('../frontend/node_modules/.cache/sigd-browser/evidence/test-flow.json','utf8'));
try{
 assert.equal((await ejecutarMigraciones(pool)).length,0);
 const login=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identificador,password})});
 assert.equal(login.status,200);const session=await login.json() as any;
 const headers={authorization:'Bearer '+session.accessToken,'content-type':'application/json'};
 const invalid=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identificador,password:'incorrecta'})});assert.equal(invalid.status,401);
 for(const endpoint of ['/expedientes/'+flow.expedienteId+'/trazabilidad','/reportes/dashboard/resumen']){
  assert.equal((await fetch(base+'/api/v1'+endpoint)).status,401);
 }
 const {rows}=await pool.query(`SELECT e.codigo_expediente,d.*,c.estado AS carga_estado
  FROM sigd_tra.expediente e JOIN sigd_doc.documento_adjunto d USING(expediente_id)
  JOIN sigd_doc.carga_documento c ON c.carga_id=d.documento_adjunto_id WHERE e.expediente_id=$1`,[flow.expedienteId]);
 assert.equal(rows.length,1);assert.equal(rows[0].codigo_expediente,flow.cut);assert.equal(rows[0].carga_estado,'VINCULADO');
 const download=await fetch(base+'/api/v1/storage/download/'+rows[0].s3_bucket+'/'+encodeURIComponent(rows[0].s3_key),{headers});
 assert.equal(download.status,200);const object=await fetch((await download.json() as any).downloadUrl);
 assert.equal(object.status,200);const bytes=Buffer.from(await object.arrayBuffer());
 assert.equal(bytes.length,Number(rows[0].tamano_bytes));assert.equal(createHash('sha256').update(bytes).digest('hex'),rows[0].sha256);
 const publicResponse=await fetch(base+'/api/v1/tramites/consulta-publica/'+flow.cut);assert.equal(publicResponse.status,200);
 const publicData=await publicResponse.json() as any;assert.equal(publicData.estadoTramite,'RECEPCIONADO');
 assert.equal(publicData.documentos.length,1);assert.ok(!JSON.stringify(publicData).includes('@example.test'));assert.ok(!JSON.stringify(publicData).includes('documentos/'));
 const trace=await fetch(base+'/api/v1/expedientes/'+flow.expedienteId+'/trazabilidad',{headers});assert.equal(trace.status,200);
 assert.equal((await trace.json() as any).actuaciones[0].evento,'RECEPCION');
 const payload={idPersona:randomUUID(),idTipoTramiteTupa:'00000000-0000-0000-0000-000000000001',nombreSolicitante:'Persona ajena',correo:'otro@example.test',asunto:'Solicitud no autorizada',totalFolios:1,documentos:[{nombreArchivo:rows[0].nombre_archivo,contentType:'application/pdf',tamanoBytes:Number(rows[0].tamano_bytes),hashSha256:rows[0].sha256,storagePath:rows[0].s3_key}]};
 const spoof=await fetch(base+'/api/v1/tramites/radicacion-virtual',{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(spoof.status,403);
 const before=(await pool.query('SELECT count(*)::int AS n FROM sigd_tra.expediente')).rows[0].n;
 payload.idPersona=session.usuario.idPersona;
 const reused=await fetch(base+'/api/v1/tramites/radicacion-virtual',{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(reused.status,400);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM sigd_tra.expediente')).rows[0].n,before);
 const unknown=await fetch(base+'/api/v1/storage/confirmar-carga',{method:'POST',headers,body:JSON.stringify({s3Key:'documentos/'+randomUUID()+'.pdf',sha256Hash:'a'.repeat(64)})});assert.equal(unknown.status,404);
 const repo=new RepositorioMgdAnalytics(pool);await repo.refrescarVistasMgd();
 const n=(await pool.query('SELECT sum(n_radicados)::int AS n FROM sigd_tra.mv_kpis_mgd_mensual_v2')).rows[0].n;assert.equal(n,before);
 const times=(await pool.query(`SELECT sigd_tra.fn_mgd_horas_habiles('2026-10-09 16:00-05','2026-10-12 09:00-05') AS horas,
  sigd_tra.fn_mgd_dias_habiles_entre('2026-10-09 16:00-05','2026-10-12 09:00-05') AS dias`)).rows[0];
 assert.equal(Number(times.horas),1.5);assert.equal(Number(times.dias),1);
 for(const endpoint of ['/reportes/dashboard/resumen','/reportes/dashboard/resumen?periodo=2026-10',
  '/reportes/dashboard/cuellos-botella','/reportes/dashboard/cuellos-botella?periodo=2026-10',
  '/reportes/dashboard/tendencias?anio=2026']){
  const response=await fetch(base+'/api/v1'+endpoint,{headers});assert.equal(response.status,200,await response.text());
 }
 assert.equal((await fetch(base+'/api/v1/reportes/vistas-materializadas/refresh',{headers})).status,403);
 const contents=Buffer.from('%NOT-PDF'+randomUUID());
 const expectedHash=createHash('sha256').update(contents).digest('hex');
 const presign=await fetch(base+'/api/v1/storage/presigned-url',{method:'POST',headers,body:JSON.stringify({
  nombreArchivo:'invalido.pdf',tamanoBytes:contents.length,mimeType:'application/pdf',sha256Hash:expectedHash})});
 assert.equal(presign.status,200);const upload=await presign.json() as any;
 assert.ok((await fetch(upload.uploadUrl,{method:'PUT',headers:{'content-type':'application/pdf'},body:contents})).ok);
 const confirm=await fetch(base+'/api/v1/storage/confirmar-carga',{method:'POST',headers,
  body:JSON.stringify({s3Key:upload.s3Key,sha256Hash:expectedHash})});assert.equal(confirm.status,400);
 assert.equal((await pool.query('SELECT estado FROM sigd_doc.carga_documento WHERE s3_key=$1',[upload.s3Key])).rows[0].estado,'PENDIENTE');
 console.log('PASS: migraciones idempotentes; login Argon2id; PDF persistido y SHA256; consulta privada minimizada; trazabilidad; 401/403/404/400; rollback; reportes y calendario habil.');
}finally{await pool.end();}

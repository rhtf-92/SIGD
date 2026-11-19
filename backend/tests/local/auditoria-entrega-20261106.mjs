// Auditoría HTTP: GETs; únicamente login/logout crean/revocan su sesión demo.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const expected = 'sigd_fbartra_demo_20261030';
const envLines = execFileSync('docker', ['inspect','sigd_backend','--format','{{range .Config.Env}}{{println .}}{{end}}'], {encoding:'utf8'});
const connection = new URL(envLines.split(/\r?\n/).find(x=>x.startsWith('DATABASE_URL=')).slice(13));
assert.equal(connection.pathname, '/'+expected);
assert.equal(connection.username, 'sigd_app');
const realDb=execFileSync('docker',['exec','sigd_postgres','psql','-X','-U','postgres','-d',expected,'-Atc','SELECT current_database()'],{encoding:'utf8'}).trim();
assert.equal(realDb,expected);
const base='http://127.0.0.1:3000';
const results=[];
async function check(path, token, options={}) {
 const response=await fetch(base+path,{...options,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(options.body?{'content-type':'application/json'}:{}),...options.headers},signal:AbortSignal.timeout(15000)});
 const raw=await response.text(); let body; try {body=JSON.parse(raw);}catch{body={text:raw.slice(0,150)}}
 results.push({path,method:options.method??'GET',authenticated:!!token,status:response.status,code:body?.code,correlation:body?.correlation_id,keys:body&&typeof body==='object'?Object.keys(body):[],count:Array.isArray(body)?body.length:undefined});
 return {response,body};
}
await check('/health');await check('/ready');
for(const path of ['/api/v1/expedientes?pestana=PENDIENTES','/api/v1/casilla/notificaciones','/api/v1/admin/usuarios','/api/v1/reportes/dashboard/resumen','/api/v1/tramites/ventanilla/cargo/EXP-2026-000003','/api/v1/tramites/consulta-publica/EXP-2026-000003']) await check(path);
const password=fs.readFileSync('.env.academico','utf8').split(/\r?\n/).find(l=>l.startsWith('ACADEMIC_DEMO_PASSWORD=')).split('=').slice(1).join('=');
const login=await check('/api/v1/auth/login',null,{method:'POST',body:JSON.stringify({identificador:'demo.academico',password})});
assert.equal(login.response.status,200,'Login demo failed; no reset will be performed');
const token=login.body.accessToken; assert(token);
const person={role:login.body.usuario?.rol,roles:login.body.usuario?.roles};
const id='12c85a03-93c8-46bb-9725-1a5730b4a93f';
for (const path of [
 '/api/v1/auth/me','/api/v1/tramites/tupa', '/api/v1/expedientes?pestana=PENDIENTES',
 `/api/v1/expedientes/${id}`, `/api/v1/expedientes/${id}/trazabilidad`, `/api/v1/expedientes/${id}/foliacion`, `/api/v1/expedientes/${id}/sla-status`,
 '/api/v1/casilla/notificaciones','/api/v1/casilla/estadisticas',
 '/api/v1/reportes/dashboard/resumen','/api/v1/reportes/dashboard/cuellos-botella','/api/v1/reportes/dashboard/tendencias',
 '/api/v1/admin/usuarios','/api/v1/admin/roles-permisos','/api/v1/admin/tablas-maestras','/api/v1/admin/calendario-laboral','/api/v1/admin/calendario-laboral/configuracion',
 '/api/v1/admin/seguridad/politicas','/api/v1/admin/seguridad/intentos','/api/v1/admin/seguridad/cuentas-bloqueadas','/api/v1/admin/auditoria/bitacora','/api/v1/admin/maestras/tipo-documento',
 '/api/v1/flujos/titulacion','/api/v1/firmas/pendientes','/api/v1/tramites/consulta-publica/EXP-2026-000003','/api/v1/tramites/ventanilla/cargo/EXP-2026-000003'
]) await check(path,token);
const documents=await check(`/api/v1/expedientes/${id}/documentos`,token);
if(documents.response.ok && Array.isArray(documents.body) && documents.body[0]?.downloadUrl){
 const doc=documents.body[0], response=await fetch(doc.downloadUrl,{signal:AbortSignal.timeout(15000)}), bytes=Buffer.from(await response.arrayBuffer());
 results.push({path:'S3 documento EXP-2026-000003 (URL firmada omitida)',status:response.status,bytes:bytes.length,pdf:bytes.subarray(0,5).toString()==='%PDF-',sha256Matches:createHash('sha256').update(bytes).digest('hex')===doc.sha256});
}
await check('/api/v1/auth/logout',token,{method:'POST',body:JSON.stringify({refreshToken:login.body.refreshToken})});
await check('/api/v1/auth/me',token);
console.log(JSON.stringify({timestamp:new Date().toISOString(),database:realDb,person,results},null,2));

import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import argon2 from 'argon2';
import { Pool } from 'pg';

const url=new URL(process.env.DATABASE_URL!);
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.ok(['/sigd_prueba','/sigd_validacion_f_bartra'].includes(url.pathname));
const test=url.pathname.includes('validacion');
const usuario=test?'prueba.bartra':'demo.bartra';
const credentialPath=test?'.env.demo.test.local':'.env.demo.local';
const pool=new Pool({connectionString:url.toString()});
try{
 await pool.query(`INSERT INTO sigd_org.rol_permiso(rol_id,permiso_id)
  SELECT r.rol_id,p.permiso_id FROM sigd_org.rol_sistema r CROSS JOIN sigd_org.permiso_sistema p
  WHERE r.codigo='DIRECTOR' AND p.codigo IN ('EXPEDIENTE_LEER','REPORTE_LEER')
  ON CONFLICT DO NOTHING`);
 const existente=(await pool.query('SELECT password_hash FROM sigd_auth.cuenta_usuario WHERE usuario=$1',[usuario])).rows[0];
 if(existente){
  assert.ok(existsSync(credentialPath),'La cuenta existe: no se modifica su clave.');
  const password=readFileSync(credentialPath,'utf8').match(/^DEMO_PASSWORD=(.+)$/m)![1];
  assert.ok(await argon2.verify(existente.password_hash,password));
  console.log(JSON.stringify({usuario,base:url.pathname,argon2idVerificado:true,existente:true}));
 }else{
  const password='SIGD-'+randomBytes(12).toString('base64url')+'!';
  const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:4});
  assert.ok(hash.startsWith('$argon2id$')&&await argon2.verify(hash,password));
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const persona=(await c.query("INSERT INTO sigd_auth.persona(tipo,id_documento) VALUES('NATURAL',$1) RETURNING id_persona",[test?'DEMO-TEST-BARTRA':'DEMO-LOCAL-BARTRA'])).rows[0].id_persona;
   await c.query(`INSERT INTO sigd_auth.persona_natural(id_persona,nombres,apellidos,nombre_completo,correo)
    VALUES($1,'Usuario','Demostracion Local','Usuario Demostracion Local',$2)`,[persona,usuario+'@example.test']);
   const cuenta=(await c.query(`INSERT INTO sigd_auth.cuenta_usuario(id_persona,usuario,correo,password_hash)
    VALUES($1,$2,$3,$4) RETURNING id_usuario`,[persona,usuario,usuario+'@example.test',hash])).rows[0].id_usuario;
   const area=(await c.query(`INSERT INTO sigd_org.area(codigo,nombre) VALUES($1,'Mesa de demostracion local')
    ON CONFLICT(codigo) DO UPDATE SET nombre=sigd_org.area.nombre RETURNING area_id`,[test?'DEMO-TEST':'DEMO-LOCAL'])).rows[0].area_id;
   await c.query('INSERT INTO sigd_auth.perfil_usuario(id_usuario,area_id) VALUES($1,$2)',[cuenta,area]);
   await c.query(`INSERT INTO sigd_org.usuario_rol(id_usuario,rol_id)
    SELECT $1,rol_id FROM sigd_org.rol_sistema WHERE codigo='DIRECTOR'`,[cuenta]);
   // Solo permisos de lectura y reportes; no se asigna ADMINISTRADOR.
   assert.ok((await c.query(`SELECT 1 FROM sigd_org.usuario_rol WHERE id_usuario=$1`,[cuenta])).rowCount);
   await c.query('COMMIT');
   writeFileSync(credentialPath,`DEMO_USER=${usuario}\nDEMO_PASSWORD=${password}\n`);
   console.log(JSON.stringify({usuario,base:url.pathname,argon2idVerificado:true,rol:'DIRECTOR'}));
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
}finally{await pool.end();}

const {Pool}=require('pg');
const {Argon2Service}=require('./src/domains/identicore/argon2.service');
(async()=>{
  const p=new Pool({connectionString:'postgres://postgres:15092006@localhost:5432/sigd_prueba'});
  const h=await Argon2Service.hash('Demo1234');
  await p.query("INSERT INTO sigd_auth.persona(id_persona,tipo,id_documento) VALUES('11111111-1111-1111-1111-111111111111','NATURAL','00000000') ON CONFLICT DO NOTHING");
  await p.query("INSERT INTO sigd_auth.cuenta_usuario(id_usuario,id_persona,usuario,correo,password_hash) VALUES('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','admin','admin@test.com',) ON CONFLICT(usuario) DO UPDATE SET password_hash=",[h]);
  await p.query("INSERT INTO sigd_org.rol_sistema(rol_id,codigo,nombre,activo) VALUES(1,'ADMINISTRADOR','Administrador',true) ON CONFLICT DO NOTHING");
  await p.query("INSERT INTO sigd_org.usuario_rol(id_usuario_rol,id_usuario,rol_id) VALUES('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',1) ON CONFLICT DO NOTHING");
  console.log('done');
  await p.end();
})();

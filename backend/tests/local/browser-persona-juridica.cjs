const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
require('dotenv').config();const {Pool}=require('pg'),argon2=require('argon2');
const {chromium}=require('../../../frontend/.npm-cache/browser-tools/node_modules/playwright');
(async()=>{
 assert.equal(new URL(process.env.DATABASE_URL).pathname,'/sigd_validacion_f_bartra');assert.equal(new URL(process.env.DATABASE_URL).hostname,'localhost');
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),output=path.resolve('../frontend/node_modules/.cache/sigd-browser/evidence');
 const natural=JSON.parse(fs.readFileSync(path.join(output,'pendientes-locales.json'),'utf8'));
 const rucBase='20'+String(crypto.randomInt(10000000,99999999)),weights=[5,4,3,2,7,6,5,4,3,2];
 const check=11-[...rucBase].reduce((sum,n,i)=>sum+Number(n)*weights[i],0)%11;
 const ruc=rucBase+(check===11?0:check===10?1:check),password='Local-'+crypto.randomBytes(10).toString('hex')+'!';
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const api='http://localhost:3001/api/v1',payload={tipoPersona:'JURIDICA',ruc,razonSocial:'Empresa Prueba Local',dniRepresentante:natural.dni,nombreRepresentante:'Nombre incorrecto',correo:ruc+'@example.test',celular:'987654321',ubigeoDistrito:'250101',direccion:'Jiron Prueba Local 123',password,consentimientoDatos:true};
  assert.equal((await page.request.post(api+'/auth/registro-persona-juridica',{data:payload})).status(),400);
  assert.equal(Number((await pool.query('SELECT count(*) FROM sigd_auth.persona WHERE id_documento=$1',[ruc])).rows[0].count),0);
  await page.goto('http://127.0.0.1:5174/registro');await page.getByRole('tab',{name:'Persona Jurídica'}).click();
  await page.getByLabel('Clave para iniciar sesión').fill(password);await page.getByLabel('Confirmar clave').fill(password);
  await page.getByLabel('RUC *',{exact:true}).fill(ruc);await page.getByLabel('Razón Social *',{exact:true}).fill('Empresa Prueba Local');
  await page.getByLabel('Número de Documento *',{exact:true}).fill(natural.dni);await page.getByLabel('Nombres *',{exact:true}).fill('Ciudadano');await page.getByLabel('Apellidos *',{exact:true}).fill('Prueba Local');
  await page.getByLabel('Cargo *',{exact:true}).fill('Representante legal');await page.getByLabel('Partida SUNARP',{exact:false}).fill('12345678');
  await page.getByLabel('Correo Corporativo *',{exact:true}).fill(ruc+'@example.test');await page.getByLabel('Celular de Contacto *',{exact:true}).fill('987654321');
  await page.getByLabel('Seleccionar Provincia de Ucayali').selectOption('2501');await page.getByLabel('Seleccionar Distrito').selectOption('250101');await page.getByLabel('Dirección Exacta',{exact:false}).fill('Jiron Prueba Local 123');
  await page.getByRole('checkbox',{name:/Declaro bajo juramento/}).check();await page.getByRole('checkbox',{name:/conforme a la Ley/}).check();
  const registered=page.waitForResponse(r=>r.url().endsWith('/auth/registro-persona-juridica')&&r.request().method()==='POST');await page.getByRole('button',{name:'Registrar Empresa y Crear Casilla'}).click();const response=await registered;assert.equal(response.status(),201,await response.text());
  await page.getByText(/Cuenta creada/).waitFor();await page.screenshot({path:path.join(output,'registro-juridica.png'),fullPage:true});
  const account=(await pool.query('SELECT id_usuario,id_persona,password_hash FROM sigd_auth.cuenta_usuario WHERE usuario=$1',[ruc])).rows[0];assert.equal(await argon2.verify(account.password_hash,password),true);
  assert.equal(Number((await pool.query('SELECT count(*) FROM sigd_auth.representacion_legal WHERE id_persona_juridica=$1 AND id_persona_natural=$2',[account.id_persona,natural.idPersona])).rows[0].count),1);
  await page.getByRole('link',{name:'Iniciar sesión',exact:true}).click();await page.getByLabel('Usuario o correo').fill(ruc);await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button',{name:'Ingresar al sistema'}).click();await page.waitForURL('**/tramite/mesa-partes-virtual');
  assert.equal((await page.request.post(api+'/auth/registro-persona-juridica',{data:{...payload,nombreRepresentante:'Ciudadano Prueba Local'}})).status(),409);assert.deepEqual(errors,[]);
  const evidence={database:'sigd_validacion_f_bartra',ruc,idPersona:account.id_persona,registro201:true,login:true,argon2id:true,representacionLegal:true,nombreIncorrecto400Rollback:true,duplicate409:true,errors};
  fs.writeFileSync(path.join(output,'persona-juridica.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
 }finally{await browser.close();await pool.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});

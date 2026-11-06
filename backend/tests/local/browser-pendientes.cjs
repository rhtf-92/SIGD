const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
require('dotenv').config();
const {Pool}=require('pg'),argon2=require('argon2'),{PDFDocument}=require('pdf-lib');
const {chromium}=require('../../../frontend/.npm-cache/browser-tools/node_modules/playwright');
(async()=>{
 const url=process.env.DATABASE_URL; assert.equal(new URL(url).pathname,'/sigd_validacion_f_bartra');
 assert.equal(new URL(url).hostname,'localhost');
 const pool=new Pool({connectionString:url}),base='http://127.0.0.1:5174',api='http://localhost:3001/api/v1';
 const output=path.resolve('../frontend/node_modules/.cache/sigd-browser/evidence');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),reportPage=await (await browser.newContext({acceptDownloads:true})).newPage();
 const errors=[],responses=[]; for(const p of [page,reportPage]){p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/api/v1/'))responses.push({url:r.url(),status:r.status()});});}
 const dni=String(70000000+crypto.randomInt(9999999)),password='Local-'+crypto.randomBytes(10).toString('hex')+'!';
 try{
  const credentials=fs.readFileSync('.env.demo.test.local','utf8');
  await reportPage.goto(base+'/login');await reportPage.getByLabel('Usuario o correo').fill(credentials.match(/^DEMO_USER=(.+)$/m)[1]);
  await reportPage.getByLabel('Contraseña').fill(credentials.match(/^DEMO_PASSWORD=(.+)$/m)[1]);
  await reportPage.getByRole('button',{name:'Ingresar al sistema'}).click();await reportPage.waitForURL('**/tramite/mesa-partes-virtual');
  const before=Number((await pool.query('SELECT count(*) FROM sigd_tra.expediente')).rows[0].count);
  await reportPage.goto(base+'/reportes');await reportPage.getByText('Expedientes registrados',{exact:true}).waitFor({timeout:30000});
  await page.goto(base+'/registro');
  await page.getByLabel('Clave para iniciar sesión').fill(password);await page.getByLabel('Confirmar clave').fill(password);
  await page.getByLabel('Número de Documento', {exact:false}).fill(dni);
  await page.getByLabel('Nombres', {exact:false}).fill('Ciudadano');await page.getByLabel('Apellidos',{exact:false}).fill('Prueba Local');
  await page.getByLabel('Fecha de Nacimiento',{exact:false}).fill('1995-01-01');await page.getByLabel('Correo',{exact:false}).fill('ciudadano-'+dni+'@example.test');
  await page.getByLabel('Celular',{exact:false}).fill('987654321');
  await page.getByLabel('Seleccionar Provincia de Ucayali').selectOption('2501');await page.getByLabel('Seleccionar Distrito').selectOption('250101');
  await page.getByLabel('Dirección Exacta',{exact:false}).fill('Jiron Prueba Local 123');
  await page.getByRole('checkbox',{name:/Declaro bajo juramento/}).check();await page.getByRole('checkbox',{name:/conforme a la Ley/}).check();
  const registro=page.waitForResponse(r=>r.url().endsWith('/auth/registro-ciudadano')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Registrar y Crear Casilla'}).click();const registered=await registro;assert.equal(registered.status(),201,await registered.text());
  await page.getByText(/Cuenta creada/).waitFor();await page.screenshot({path:path.join(output,'registro-ciudadano.png'),fullPage:true});
  const account=(await pool.query(`SELECT c.id_usuario,c.id_persona,c.password_hash,r.codigo FROM sigd_auth.cuenta_usuario c JOIN sigd_org.usuario_rol ur USING(id_usuario) JOIN sigd_org.rol_sistema r USING(rol_id) WHERE usuario=$1`,[dni])).rows[0];
  assert.equal(account.codigo,'CIUDADANO');assert.match(account.password_hash,/^\$argon2id\$/);assert.equal(await argon2.verify(account.password_hash,password),true);
  assert.equal((await pool.query("SELECT to_char(fecha_nacimiento,'YYYY-MM-DD') AS fecha FROM sigd_auth.persona_natural WHERE id_persona=$1",[account.id_persona])).rows[0].fecha,'1995-01-01');
  await page.getByRole('link',{name:'Iniciar sesión',exact:true}).click();await page.getByLabel('Usuario o correo').fill(dni);await page.getByLabel('Contraseña').fill(password);
  const loginResponse=page.waitForResponse(r=>r.url().endsWith('/auth/login')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Ingresar al sistema'}).click();const login=await (await loginResponse).json();assert.equal(login.usuario.rol,'ESTUDIANTE');
  await page.waitForURL('**/tramite/mesa-partes-virtual');
  await page.getByLabel('Tipo de tr').selectOption({index:1});const asunto='Solicitud ciudadano '+dni;await page.getByLabel('Asunto').fill(asunto);
  const pdf=await PDFDocument.create();pdf.addPage().drawText(asunto);const buffer=Buffer.from(await pdf.save());
  await page.locator('input[type=file]').setInputFiles({name:'ciudadano-'+dni+'.pdf',mimeType:'application/pdf',buffer});
  await page.getByRole('button',{name:'Registrar expediente',exact:true}).click({timeout:30000});await page.getByRole('heading',{name:/Expediente registrado:/}).waitFor({timeout:30000});
  const cut=(await page.getByRole('heading',{name:/Expediente registrado:/}).textContent()).match(/EXP-\d{4}-\d{6}/)[0];
  const trace=await page.getByRole('link',{name:'Ver trazabilidad'}).getAttribute('href');
  await page.getByRole('link',{name:'Consultar expediente',exact:true}).click();await page.getByText(asunto,{exact:true}).waitFor();
  await page.goto(base+trace);await page.getByText('RECEPCION',{exact:true}).waitFor();
  const docs=await (await context.request.get(api+'/expedientes/'+trace.split('/')[2]+'/documentos',{headers:{Authorization:'Bearer '+login.accessToken}})).json();
  const attachment=await context.request.get(docs[0].downloadUrl);assert.equal(attachment.status(),200);assert.equal(crypto.createHash('sha256').update(await attachment.body()).digest('hex'),crypto.createHash('sha256').update(buffer).digest('hex'));
  const headers={Authorization:'Bearer '+login.accessToken};
  assert.equal((await context.request.get(api+'/reportes/dashboard/resumen',{headers})).status(),403);
  assert.equal((await context.request.get(api+'/expedientes?pestana=PENDIENTES',{headers})).status(),403);
  const duplicate={tipoPersona:'NATURAL',dni,nombres:'Ciudadano',apellidoPaterno:'Prueba',apellidoMaterno:'Local',correo:'ciudadano-'+dni+'@example.test',celular:'987654321',direccion:'Jiron Prueba Local 123',ubigeoDistrito:'250101',password,consentimientoDatos:true};
  assert.equal((await context.request.post(api+'/auth/registro-ciudadano',{data:duplicate})).status(),409);
  assert.equal((await context.request.post(api+'/auth/login',{data:{identificador:dni,password:'ClaveIncorrecta!'}})).status(),401);
  // No manual refresh: the existing report page must update after registration and the scheduled DB refresh.
  await reportPage.waitForFunction(n=>{const heading=[...document.querySelectorAll('h2,h3,p')].find(e=>e.textContent==='Expedientes registrados');return heading?.parentElement?.textContent?.includes(String(n));},before+1,{timeout:100000});
  assert.equal(Number((await pool.query('SELECT sum(n_radicados) AS n FROM sigd_tra.mv_kpis_mgd_mensual_v2')).rows[0].n),before+1);
  const downloads=[];
  for(const [label,ext] of [['Excel XML (.xml)','xml'],['PDF (A4)','pdf']]){
   await reportPage.getByRole('button',{name:'Abrir opciones de exportación del dashboard'}).click();const download=reportPage.waitForEvent('download');
   await reportPage.getByRole('button',{name:label,exact:true}).click();const d=await download;const target=path.join(output,'reporte-real.'+ext);await d.saveAs(target);const bytes=fs.readFileSync(target);
   if(ext==='pdf'){assert.equal(bytes.subarray(0,8).toString(),'%PDF-1.4');assert.equal((await PDFDocument.load(bytes)).getPageCount(),2);assert.match(bytes.toString(),new RegExp('\\('+String(before+1)+'\\) Tj'));}
   else {const xml=bytes.toString('utf8');assert.match(xml,/Workbook/);assert.match(xml,new RegExp('<Data ss:Type="Number">'+String(before+1)+'</Data>'));assert.match(xml,/Expedientes registrados/);}
   downloads.push({filename:d.suggestedFilename(),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  await reportPage.screenshot({path:path.join(output,'reportes-automaticos.png'),fullPage:true});assert.deepEqual(errors,[]);
  const evidence={base,database:'sigd_validacion_f_bartra',dni,cut,idPersona:account.id_persona,argon2id:true,fechaNacimientoPersistida:true,login:true,wrongPassword401:true,consulta:true,trazabilidad:true,adjuntoSha256:true,duplicate409:true,citizenReports403:true,citizenInbox403:true,automaticRefresh:{before,after:before+1},downloads,errors,responses};
  fs.writeFileSync(path.join(output,'pendientes-locales.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({...evidence,responses:responses.length}));
 }catch(e){await page.screenshot({path:path.join(output,'pendientes-failure.png'),fullPage:true});console.error(responses,errors);throw e;}
 finally{await browser.close();await pool.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});

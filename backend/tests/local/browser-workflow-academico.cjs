const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../../../frontend/.npm-cache/browser-tools/node_modules/playwright');
(async()=>{
 const base=process.env.BROWSER_URL||'http://127.0.0.1:5174';
 const main=base.endsWith('5173');
 const credentials=fs.readFileSync(main?'.env.demo.local':'.env.demo.test.local','utf8');
 const output=path.resolve('../frontend/node_modules/.cache/sigd-browser/evidence');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
 const errors=[],responses=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/api/v1/flujos/titulacion'))responses.push({method:r.request().method(),url:r.url(),status:r.status()});});
 try{
  await page.goto(base+'/login');
  await page.getByLabel('Usuario o correo').fill(credentials.match(/^DEMO_USER=(.+)$/m)[1]);
  await page.locator('input[type=password]').fill(credentials.match(/^DEMO_PASSWORD=(.+)$/m)[1]);
  await page.getByRole('button',{name:'Ingresar al sistema'}).click();await page.waitForURL('**/tramite/mesa-partes-virtual');
  await page.goto(base+'/flujos/titulacion');
  await page.getByRole('heading',{name:/Visualizador de Workflows Académicos/}).waitFor();
  await page.getByText('FSM backend conectada',{exact:true}).waitFor();
  await page.getByText('EXP-2026-000412',{exact:false}).first().waitFor();
  await page.getByText('EXP-2026-000415',{exact:false}).first().waitFor();
  assert.equal(await page.getByTestId('expediente-cut').textContent(),'EXP-2026-000412');
  const tomar=page.getByRole('button',{name:'Tomar en revisión'});
  if(await tomar.isEnabled()){
   await tomar.click();await page.getByText('En revisión',{exact:true}).first().waitFor();
  }
  const aprobar=page.getByRole('button',{name:'Aprobar etapa'});
  if(await aprobar.isEnabled()){
   await aprobar.click();await page.getByText('En trámite',{exact:true}).first().waitFor();
   await tomar.click();await page.getByText('En revisión',{exact:true}).first().waitFor();
  }
  await page.getByText(/Bloqueo FSM activo: faltan 3 requisito/).waitFor();
  assert.equal(await aprobar.isDisabled(),true);
  await page.getByRole('button',{name:'Observar',exact:true}).click();
  await page.getByText('Observado',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'Registrar subsanación'}).click();
  await page.getByText('Subsanado',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'Reanudar revisión'}).click();
  await page.getByText('En revisión',{exact:true}).first().waitFor();
  await page.screenshot({path:path.join(output,'workflow-academico-backend.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.ok(responses.length>=5);assert.ok(responses.every(r=>r.status===200));
  const evidence={database:main?'sigd_prueba':'sigd_validacion_f_bartra',workflow:412,backend:true,listaPersistida:true,transicionesPersistidas:true,bloqueoRequisitos:true,responses:responses.length,errors};
  fs.writeFileSync(path.join(output,'workflow-academico-backend.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
 }catch(e){await page.screenshot({path:path.join(output,'workflow-academico-failure.png'),fullPage:true});console.error(errors,responses);throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

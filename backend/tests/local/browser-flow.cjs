const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('../../../frontend/.npm-cache/browser-tools/node_modules/playwright');
const {PDFDocument}=require('pdf-lib');

(async()=>{
 const base=process.env.BROWSER_URL||'http://127.0.0.1:5174';
 assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):517[34]$/);
 const main=base.endsWith('5173');
 const credentials=fs.readFileSync(main?'.env.demo.local':'.env.demo.test.local','utf8');
 const user=credentials.match(/^DEMO_USER=(.+)$/m)[1],password=credentials.match(/^DEMO_PASSWORD=(.+)$/m)[1];
 const output=path.resolve('../frontend/node_modules/.cache/sigd-browser/evidence');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();const responses=[];const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/api/v1/')||r.url().includes(':9000/'))responses.push({url:r.url().split('?')[0],status:r.status(),method:r.request().method()});});
 try{
  await page.goto(base+'/login');
  await page.getByLabel('Usuario o correo').fill(user);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button',{name:'Ingresar al sistema'}).click();
  await page.waitForURL('**/tramite/mesa-partes-virtual');
  await page.getByLabel('Tipo de tr').selectOption({index:1});
  const asunto='Solicitud de demostracion real '+Date.now();
  await page.getByLabel('Asunto').fill(asunto);
  const pdf=await PDFDocument.create();pdf.addPage().drawText(asunto);const buffer=Buffer.from(await pdf.save());
  await page.locator('input[type=file]').setInputFiles({name:'solicitud-'+Date.now()+'.pdf',mimeType:'application/pdf',buffer});
  await page.getByRole('button',{name:'Registrar expediente',exact:true}).waitFor();
  await page.getByRole('button',{name:'Registrar expediente',exact:true}).click({timeout:30000});
  await page.getByRole('heading',{name:/Expediente registrado:/}).waitFor({timeout:30000});
  const title=await page.getByRole('heading',{name:/Expediente registrado:/}).textContent();
  const cut=title.match(/EXP-\d{4}-\d{6}/)[0];
  const traceLink=await page.getByRole('link',{name:'Ver trazabilidad'}).getAttribute('href');
  await page.screenshot({path:path.join(output,main?'local-radicacion.png':'pruebas-radicacion.png'),fullPage:true});
  await page.getByRole('link',{name:'Consultar expediente',exact:true}).click();
  await page.getByText(asunto,{exact:true}).waitFor({timeout:15000});
  await page.screenshot({path:path.join(output,main?'local-consulta.png':'pruebas-consulta.png'),fullPage:true});
  await page.goto(base+traceLink);
  await page.getByText('RECEPCION',{exact:true}).waitFor();
  await page.screenshot({path:path.join(output,main?'local-trazabilidad.png':'pruebas-trazabilidad.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,main?'local-flow.json':'test-flow.json'),JSON.stringify({base,cut,expedienteId:traceLink.split('/')[2],asunto,responses,errors},null,2));
  console.log(JSON.stringify({base,cut,expedienteId:traceLink.split('/')[2],browser:'Microsoft Edge',flow:'login > PDF S3 > radicacion > consulta > trazabilidad',errors}));
 }catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});console.error(responses,errors);throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

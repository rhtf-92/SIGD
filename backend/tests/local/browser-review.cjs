const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../../../frontend/.npm-cache/browser-tools/node_modules/playwright');
(async()=>{
 const base=process.env.BROWSER_URL||'http://127.0.0.1:5174', main=base.endsWith('5173');
 assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):517[34]$/);
 const evidence=path.resolve('../frontend/node_modules/.cache/sigd-browser/evidence');
 const flow=JSON.parse(fs.readFileSync(path.join(evidence,main?'local-flow.json':'test-flow.json'),'utf8'));
 const credentials=fs.readFileSync(main?'.env.demo.local':'.env.demo.test.local','utf8');
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
 const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/api/v1/')&&r.status()>=400)failed.push({url:r.url(),status:r.status()});});
 try{
  await page.goto(base+'/login');await page.getByLabel('Usuario o correo').fill(credentials.match(/^DEMO_USER=(.+)$/m)[1]);
  await page.getByLabel('Contraseña').fill(credentials.match(/^DEMO_PASSWORD=(.+)$/m)[1]);
  await page.getByRole('button',{name:'Ingresar al sistema'}).click();await page.waitForURL('**/tramite/mesa-partes-virtual');
  await page.goto(base+'/expedientes/'+flow.expedienteId);await page.getByText('RECEPCION',{exact:true}).waitFor();
  await page.getByRole('link',{name:'Descargar PDF',exact:true}).first().waitFor();
  await page.screenshot({path:path.join(evidence,main?'local-detalle.png':'pruebas-detalle.png'),fullPage:true});
  await page.goto(base+'/reportes');await page.getByText('Expedientes registrados',{exact:true}).waitFor({timeout:30000});
  await page.screenshot({path:path.join(evidence,main?'local-reportes.png':'pruebas-reportes.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const report={base,expedienteId:flow.expedienteId,detalle:true,adjuntoDescargable:true,reportes:true,errors,failed};
  fs.writeFileSync(path.join(evidence,main?'local-review.json':'test-review.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(e){await page.screenshot({path:path.join(evidence,'review-failure.png'),fullPage:true});console.error(errors,failed);throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

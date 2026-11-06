const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('../../../frontend/.npm-cache/browser-tools/node_modules/playwright');
(async()=>{
 const base=process.env.BROWSER_URL||'http://127.0.0.1:5173';
 assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):517[34]$/);
 const main=base.endsWith('5173'),cut=process.env.EXPEDIENTE_CUT||(main?'EXP-2026-000002':'EXP-2026-000001');
 const credential=fs.readFileSync(main?'.env.demo.local':'.env.demo.test.local','utf8');
 const output=path.resolve('../frontend/node_modules/.cache/sigd-browser/evidence');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/api/v1/expedientes'))requests.push({url:r.url(),status:r.status()});});
 const responseFor=(conditions)=>page.waitForResponse(r=>{
  const url=new URL(r.url());return url.pathname==='/api/v1/expedientes'&&Object.entries(conditions).every(([k,v])=>url.searchParams.get(k)===v);
 });
 try{
  await page.goto(base+'/login');await page.getByLabel('Usuario o correo').fill(credential.match(/^DEMO_USER=(.+)$/m)[1]);
  await page.locator('input[type=password]').fill(credential.match(/^DEMO_PASSWORD=(.+)$/m)[1]);
  await page.getByRole('button',{name:'Ingresar al sistema'}).click();await page.waitForURL('**/tramite/mesa-partes-virtual');
  const first=responseFor({pestana:'PENDIENTES'});await page.goto(base+'/expedientes');const initial=await first;
  assert.equal(initial.status(),200);const list=await initial.json(),exp=list.elementos.find(e=>e.cut===cut);assert.ok(exp,'El expediente debe figurar en Pendientes');
  await page.getByRole('cell',{name:cut,exact:true}).waitFor();
  const search=page.getByRole('searchbox');await search.fill(cut);
  let next=responseFor({terminoBusqueda:cut});await page.getByRole('button',{name:'Buscar',exact:true}).click();assert.equal((await next).status(),200);
  assert.equal(await page.locator('tbody tr').count(),1);
  await search.fill('inexistente-bandeja-local');next=responseFor({terminoBusqueda:'inexistente-bandeja-local'});await page.getByRole('button',{name:'Buscar',exact:true}).click();await next;
  await page.getByText(/No hay expedientes/).waitFor();
  await page.getByRole('button',{name:'Limpiar filtros'}).click();await page.getByRole('cell',{name:cut,exact:true}).waitFor();
  await search.fill(exp.asunto.slice(0,30));next=responseFor({terminoBusqueda:exp.asunto.slice(0,30)});await page.getByRole('button',{name:'Buscar',exact:true}).click();await next;await page.getByRole('cell',{name:cut,exact:true}).waitFor();
  await page.getByRole('button',{name:'Limpiar filtros'}).click();
  for(const label of ['En trámite','Derivados','Por firmar','Atendidos','Archivados']){
   await page.getByRole('tab',{name:new RegExp('^'+label)}).click();
   await page.getByText(/No hay expedientes/).waitFor();assert.equal(await page.getByRole('cell',{name:cut,exact:true}).count(),0);
  }
  await page.getByRole('tab',{name:/^Pendientes/}).click();await page.getByRole('cell',{name:cut,exact:true}).waitFor();
  const date=exp.fechaRadicacion.slice(0,10);
  await page.getByLabel('Fecha desde').fill(date);next=responseFor({fechaDesde:date,fechaHasta:date});await page.getByLabel('Fecha hasta').fill(date);await next;
  await page.getByRole('cell',{name:cut,exact:true}).waitFor();
  await page.getByLabel('Fecha desde').fill('2000-01-01');next=responseFor({fechaHasta:'2000-01-02'});await page.getByLabel('Fecha hasta').fill('2000-01-02');await next;await page.getByText(/No hay expedientes/).waitFor();
  await page.getByRole('button',{name:'Limpiar filtros'}).click();await page.getByRole('cell',{name:cut,exact:true}).waitFor();
  await page.screenshot({path:path.join(output,main?'bandeja-after.png':'bandeja-test-after.png'),fullPage:true});
  await page.getByRole('row').filter({has:page.getByRole('cell',{name:cut,exact:true})}).getByRole('link',{name:'Ver expediente'}).click();
  await page.getByRole('heading',{name:cut,exact:true}).waitFor();await page.getByText('RECEPCION',{exact:true}).waitFor();
  const docsResponse=await page.request.get('http://localhost:'+(main?3000:3001)+'/api/v1/expedientes/'+exp.idExpediente+'/documentos',{
   headers:{authorization:'Bearer '+await page.evaluate(()=>localStorage.getItem('sigd_token'))}
  });assert.equal(docsResponse.status(),200);const documents=await docsResponse.json();assert.ok(documents.length);
  const link=page.getByRole('link',{name:'Descargar PDF',exact:true}).first();await link.waitFor();
  await page.getByText(documents[0].nombreArchivo,{exact:true}).waitFor();
  const color=await link.evaluate(e=>getComputedStyle(e).backgroundColor);
  await link.hover();await page.waitForTimeout(250);assert.notEqual(await link.evaluate(e=>getComputedStyle(e).backgroundColor),color);
  await page.mouse.move(0,0);await page.keyboard.press('Tab');await link.focus();assert.equal(await link.evaluate(e=>e.matches(':focus-visible')),true);
  await page.setViewportSize({width:390,height:844});
  const rect=await link.boundingBox();assert.ok(rect.width>300 && rect.x+rect.width<=390);
  await page.screenshot({path:path.join(output,main?'descarga-pdf-movil.png':'descarga-pdf-test-movil.png'),fullPage:true});
  const object=await page.request.get(await link.getAttribute('href'));assert.equal(object.status(),200);
  const bytes=await object.body();assert.equal(bytes.length,documents[0].tamanoBytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),documents[0].sha256);
  const popupPromise=page.waitForEvent('popup');await link.press('Enter');const popup=await popupPromise;
  await page.getByText(/Abriendo PDF en otra pestaña/).waitFor();
  // La integridad se verifica sobre los bytes del recurso firmado, descargados
  // arriba, independientemente de cómo Edge entregue el visor PDF al popup.
  assert.ok(popup.url().startsWith(documents[0].downloadUrl));
  await popup.close();
  await page.screenshot({path:path.join(output,main?'bandeja-detalle.png':'bandeja-test-detalle.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.status===200));
  const result={cut,expedienteId:exp.idExpediente,estado:exp.estadoActual,searchCut:true,searchAsunto:true,tabs:true,dates:true,detalle:true,adjuntoSha256:true,trazabilidad:true,requests,errors};
  fs.writeFileSync(path.join(output,main?'bandeja-after.json':'bandeja-test-after.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,requests:requests.length}));
 }catch(e){await page.screenshot({path:path.join(output,'bandeja-failure.png'),fullPage:true});console.error(errors,requests);throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

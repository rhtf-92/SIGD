"""Disposable G6-04 verification; credentials are generated in memory, never saved."""
import datetime,hashlib,json,os,pathlib,secrets,shutil,socket,subprocess,sys,tempfile,time,urllib.request,urllib.error,urllib.parse,uuid
ROOT=pathlib.Path(__file__).resolve().parents[3]
RUN="g604-"+uuid.uuid4().hex[:12]; LABEL="g604.validation"; DB=RUN.replace("-","_")
N={k:RUN+"-"+k for k in ["net","work","pg","api"]}
PW=secrets.token_urlsafe(32); JWT=secrets.token_urlsafe(48); LOGINPW=secrets.token_urlsafe(24)
REDACT=[PW,JWT,LOGINPW]; created=[]; children=[]; profiles=[]
R={"run":RUN,"started_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"checks":[],"resources":{},"cleanup":[],"status":"RUNNING"}
def safe(s):
    for secret in REDACT:
        if secret:s=s.replace(secret,"[REDACTED]")
    return s
def say(s):print(s,flush=True)
def call(args,data=None,timeout=90,check=True,env=None,cwd=None):
    p=subprocess.run(args,input=data,capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=timeout,env=env,cwd=cwd)
    if check and p.returncode:raise RuntimeError(safe("Command failed ("+args[0]+"): "+(p.stdout+p.stderr)[-2200:]))
    return p
def d(*a,**kw):return call(["docker",*a],**kw)
def ok(name,value):
    R["checks"].append({"check":name,"pass":bool(value)})
    if not value:raise RuntimeError("Check failed: "+name)
def wait(fn,timeout=60):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        try:
            v=fn()
            if v:return v
        except Exception:pass
        time.sleep(.4)
    raise RuntimeError("Readiness timeout")
def port():
    with socket.socket() as s:s.bind(("127.0.0.1",0));return s.getsockname()[1]
def http(path,token=None,payload=None):
    h={"Content-Type":"application/json"}
    if token:h["Authorization"]="Bearer "+token
    q=urllib.request.Request(R["api_origin"]+path,headers=h,data=json.dumps(payload).encode() if payload is not None else None)
    try:
        with urllib.request.urlopen(q,timeout=15) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:
        try:b=json.load(e)
        except Exception:b={}
        return e.code,b
def sql(s):
    return d("exec","-i",N["pg"],"psql","-X","-v","ON_ERROR_STOP=1","-U","g604","-d",DB,"-At",data=s).stdout.strip()

SEED=r"""
import { Pool } from 'pg'; import argon2 from 'argon2'; import { randomUUID } from 'node:crypto';
const p=new Pool({connectionString:process.env.DATABASE_URL});
const person=(await p.query("INSERT INTO sigd_auth.persona(tipo,id_documento) VALUES('NATURAL',$1) RETURNING id_persona",['G604-'+randomUUID().slice(0,8)])).rows[0].id_persona;
const hash=await argon2.hash(process.env.G604_PASSWORD,{type:argon2.argon2id});
for(const [user,role] of [['g604_operator','MESA_PARTES'],['g604_citizen','CIUDADANO']]){
 const account=(await p.query("INSERT INTO sigd_auth.cuenta_usuario(id_persona,usuario,correo,password_hash) VALUES($1,$2,$3,$4) RETURNING id_usuario",[person,user,user+'@example.invalid',hash])).rows[0].id_usuario;
 await p.query("INSERT INTO sigd_org.rol_sistema(codigo,nombre) VALUES($1,$1) ON CONFLICT(codigo) DO NOTHING",[role]);
 await p.query("INSERT INTO sigd_org.usuario_rol(id_usuario,rol_id) SELECT $1,rol_id FROM sigd_org.rol_sistema WHERE codigo=$2",[account,role]);
}
const rows=[];
for(const [index,days,folios] of [[1,1,3],[2,75,7]]){
 const id=randomUUID(),doc=randomUUID(),date=new Date(Date.now()-days*86400000).toISOString(),cut='EXP-2026-'+String(index).padStart(6,'0');
 await p.query("INSERT INTO sigd_tra.expediente(expediente_id,codigo_expediente,numero,tipo_documental_id,solicitante_id,fecha_radicacion) VALUES($1,$2,$3,$4,$5,$6)",[id,cut,'G604-'+index,randomUUID(),person,date]);
 await p.query("INSERT INTO sigd_tra.tramite(expediente_id,asunto) VALUES($1,$2)",[id,'G604 asunto '+index]);
 const movement=(await p.query("INSERT INTO sigd_rut.movimiento_tramite(expediente_id,estado_anterior,evento,estado_nuevo,usuario_operador_id,fecha_hora) VALUES($1,'REGISTRADO','RECEPCION','RECEPCIONADO',$2,$3) RETURNING id_movimiento::text",[id,index+6,new Date(Date.parse(date)+3600000).toISOString()])).rows[0].id_movimiento;
 await p.query("INSERT INTO sigd_tra.expediente_documento_folio(expediente_id,id_documento,folio_inicio,folio_fin) VALUES($1,$2,1,$3)",[id,doc,folios]);
 rows.push({id,doc,movement,cut,folios});
}
await p.end();console.log(JSON.stringify(rows));
"""

BROWSER=r"""
const front=process.env.G604_FRONT,debug=process.env.G604_DEBUG,sess=JSON.parse(process.env.G604_SESSION),rows=JSON.parse(process.env.G604_ROWS),slas=JSON.parse(process.env.G604_SLA);
const target=await(await fetch(debug+'/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let counter=0;const pending=new Map(),network=[],checks=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(new Error(m.error.message));else p?.resolve(m.result);}else if(m.method==='Network.requestWillBeSent'){const r=m.params.request,u=new URL(r.url);if(u.pathname.startsWith('/api/'))network.push({method:r.method,path:u.pathname});}};
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++counter;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Browser evaluation failed');return r.result.value;}
async function until(expression){const end=Date.now()+20000;while(Date.now()<end){try{if(await evaluate(expression))return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Browser readiness timeout');}
async function nav(path){await send('Page.navigate',{url:front+path});await until('document.readyState==="complete"');}
function ok(name,v){checks.push({check:name,pass:!!v});if(!v)throw new Error(name);}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await nav('/');
 await evaluate("localStorage.setItem('sigd_token',"+JSON.stringify(sess.accessToken)+");localStorage.setItem('sigd_rol',"+JSON.stringify(sess.usuario.rol)+");localStorage.setItem('sigd_auth',"+JSON.stringify(JSON.stringify({state:{...sess,isAuthenticated:true}}))+");true");
 await nav('/expedientes');
 await until("document.body.innerText.includes("+JSON.stringify(rows[0].cut)+") && document.body.innerText.includes("+JSON.stringify(rows[1].cut)+")");
 ok('browser_bandeja_real',true);
 await evaluate("document.querySelector('select[name=limite]').value='1';document.querySelector('form').requestSubmit();true");
 await until("document.querySelector('table tbody')?.rows.length===1 && ![...document.querySelectorAll('button')].find(b=>b.textContent==='Siguiente')?.disabled");
 const first=await evaluate("document.querySelector('table tbody').innerText");
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Siguiente').click();true");
 await until("document.querySelector('table tbody')?.rows.length===1 && document.querySelector('table tbody').innerText!=="+JSON.stringify(first));
 ok('browser_paginacion_real',true);
 for(let i=0;i<rows.length;i++){
  const r=rows[i],other=rows[1-i];await nav('/expedientes/'+r.id);
  await until("document.body.innerText.includes("+JSON.stringify(r.movement)+") && document.body.innerText.includes("+JSON.stringify(r.doc)+") && document.body.innerText.includes('Calendario SLA provisional')");
  ok('browser_aislamiento_'+i,await evaluate("!document.body.innerText.includes("+JSON.stringify(other.movement)+") && !document.body.innerText.includes("+JSON.stringify(other.doc)+")"));
  ok('browser_acciones_bloqueadas_'+i,await evaluate("['Derivar','Observar','Acumular'].every(n=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===n && b.disabled)) && !document.querySelector('[role=dialog]')"));
  const actual=await evaluate("Object.fromEntries([...document.querySelectorAll('section[aria-label=SLA] dt')].map(dt=>[dt.textContent,dt.nextElementSibling.textContent]))");
  const s=slas[i],want={'Estado SLA':s.estado,'Inicio':s.fechaInicio,'Calculado':s.fechaCalculo,'Fecha límite':s.fechaLimite,'Plazo hábil':String(s.diasHabilesLimite),'Días transcurridos':String(s.diasHabilesTranscurridos),'Días restantes':String(s.diasHabilesRestantes),'Porcentaje':s.porcentaje+'%'};
  ok('browser_sla_literal_'+i,JSON.stringify(actual)===JSON.stringify(want));
 }
 ok('browser_sin_escrituras',network.every(r=>['GET','OPTIONS','HEAD'].includes(r.method)));
 console.log(JSON.stringify({status:'PASS',checks,requests:network}));
}catch(e){console.log(JSON.stringify({status:'FAIL',checks,error:e.message,requests:network}));process.exitCode=1;}finally{try{ws.send(JSON.stringify({id:++counter,method:'Browser.close'}));}catch{}ws.close();}
"""
try:
    R["branch"]=call(["git","branch","--show-current"],cwd=ROOT).stdout.strip()
    R["head"]=call(["git","rev-parse","HEAD"],cwd=ROOT).stdout.strip()
    ok("exact_branch_target",R["branch"]=="B_JHASY" and R["head"]=="4e06e512fe08d01712bc0b6feb33e95ca28c1b10")
    say("INTEGRATION: creating new labelled resources")
    for kind,k in [("network","net"),("volume","work"),("container","pg"),("container","api")]:
        ok("fresh_"+k,d(kind,"inspect",N[k],check=False).returncode!=0)
    d("network","create","--label",LABEL+"="+RUN,N["net"]);created.append(("network",N["net"]))
    d("volume","create","--label",LABEL+"="+RUN,N["work"]);created.append(("volume",N["work"]))
    d("run","-d","--name",N["pg"],"--label",LABEL+"="+RUN,"--network",N["net"],"--tmpfs","/var/lib/postgresql:rw",
      "-e","POSTGRES_USER=g604","-e","POSTGRES_PASSWORD="+PW,"-e","POSTGRES_DB="+DB,"postgres:18-alpine");created.append(("container",N["pg"]))
    wait(lambda:d("exec",N["pg"],"pg_isready","-U","g604","-d",DB,check=False,timeout=10).returncode==0)
    ok("empty_new_database_not_demo",DB!="sigd_demo" and sql("SELECT count(*) FROM pg_namespace WHERE nspname LIKE 'sigd_%';")=="0")
    pgmeta=json.loads(d("container","inspect",N["pg"]).stdout)[0]
    mounts=pgmeta["Mounts"]
    tmpfs=pgmeta["HostConfig"].get("Tmpfs",{})
    R["postgres_storage_evidence"]={"tmpfs":tmpfs,"mount_types":[m["Type"] for m in mounts]}
    ok("postgres_tmpfs_no_volume","/var/lib/postgresql" in tmpfs and not any(m["Type"]=="volume" for m in mounts))
    dsn="postgresql://g604:"+PW+"@"+N["pg"]+":5432/"+DB
    d("run","-d","--name",N["api"],"--label",LABEL+"="+RUN,"--network",N["net"],"-p","127.0.0.1::3000",
      "--mount","type=bind,source="+str(ROOT/"backend")+",target=/src,readonly",
      "--mount","type=volume,source="+N["work"]+",target=/app","-w","/app","-e","DATABASE_URL="+dsn,
      "-e","AUTH_JWT_SECRET="+JWT,"-e","G604_PASSWORD="+LOGINPW,"-e","SIGD_MIGRATION_PROFILE=BASELINE_2026_V1",
      "-e","NODE_ENV=test","-e","PORT=3000","node:24.19-bookworm-slim","tail","-f","/dev/null");created.append(("container",N["api"]))
    R["resources"]={"database":DB,"postgres":N["pg"],"backend":N["api"],"network":N["net"],"dependency_volume":N["work"],
                    "postgres_storage":"new tmpfs","reused_existing_resources":False,"images":["postgres:18-alpine","node:24.19-bookworm-slim"]}
    d("exec",N["api"],"sh","-c","cp -r /src/src /src/migraciones /src/baselines /app/ && cp /src/package.json /src/package-lock.json /src/tsconfig*.json /app/")
    say("INTEGRATION: npm ci backend in new Linux volume")
    deps=d("exec",N["api"],"npm","ci","--no-audit","--no-fund",timeout=480,check=False)
    R["backend_dependencies_exit"]=deps.returncode
    if deps.returncode:raise RuntimeError("Backend npm ci failed:\n"+safe((deps.stdout+deps.stderr)[-2200:]))
    ok("backend_manifests_unchanged",d("exec",N["api"],"sh","-c","cmp /src/package.json /app/package.json && cmp /src/package-lock.json /app/package-lock.json",check=False).returncode==0)
    say("INTEGRATION: starting updated server and baseline on new database")
    d("exec","-d",N["api"],"sh","-c","node node_modules/tsx/dist/cli.mjs src/server.ts >/tmp/g604-api.log 2>&1")
    bindings=json.loads(d("container","inspect","--format","{{json .NetworkSettings.Ports}}",N["api"]).stdout)
    R["api_origin"]="http://127.0.0.1:"+bindings["3000/tcp"][0]["HostPort"]
    try:wait(lambda:http("/ready")[0]==200,75)
    except Exception:raise RuntimeError("Updated API not ready:\n"+safe(d("exec",N["api"],"tail","-n","30","/tmp/g604-api.log",check=False).stdout))
    ledger=sql("SELECT nombre_script FROM public.sigd_migraciones ORDER BY nombre_script;").splitlines();R["ledger"]=ledger
    ok("baseline_ledger_seven_scripts",len(ledger)==7 and "BASELINE_2026_V1.sql" in ledger and not any(s.startswith(("06_","07_")) for s in ledger))
    rows=json.loads(d("exec","-i",N["api"],"node","--input-type=module",data=SEED).stdout);R["fixture_uuids"]=[r["id"] for r in rows]
    code,session=http("/api/v1/auth/login",payload={"identificador":"g604_operator","password":LOGINPW})
    ok("real_operator_login",code==200 and session.get("usuario",{}).get("rol")=="MESA_PARTES" and bool(session.get("accessToken")))
    token=session["accessToken"];REDACT.extend([token,session.get("refreshToken","")])
    code,citizen=http("/api/v1/auth/login",payload={"identificador":"g604_citizen","password":LOGINPW})
    ok("real_citizen_login",code==200 and bool(citizen.get("accessToken")));REDACT.extend([citizen["accessToken"],citizen.get("refreshToken","")])
    ok("http_401_no_token",http("/api/v1/expedientes?pestana=PENDIENTES")[0]==401)
    ok("http_403_bandeja_role",http("/api/v1/expedientes?pestana=PENDIENTES",citizen["accessToken"])[0]==403)
    ok("http_400_invalid_uuid",http("/api/v1/expedientes/not-a-uuid",token)[0]==400)
    ok("http_404_missing_uuid",http("/api/v1/expedientes/"+str(uuid.uuid4()),token)[0]==404)
    code,page=http("/api/v1/expedientes?pestana=PENDIENTES&limite=1",token)
    ok("first_page_real",code==200 and len(page["elementos"])==1 and page["tieneMas"] and page["contadores"]["PENDIENTES"]==2)
    code,nextpage=http("/api/v1/expedientes?pestana=PENDIENTES&limite=1&cursor="+urllib.parse.quote(page["siguienteCursor"],safe=""),token)
    ok("opaque_cursor_distinct_pages",code==200 and not nextpage["tieneMas"] and {page["elementos"][0]["idExpediente"],nextpage["elementos"][0]["idExpediente"]}==set(r["id"] for r in rows))
    slas=[]
    for i,row in enumerate(rows):
        base="/api/v1/expedientes/"+row["id"]
        code,detail=http(base,token);ok("detail_uuid_"+str(i),code==200 and detail["idExpediente"]==row["id"])
        code,h=http(base+"/trazabilidad",token);ok("history_isolation_"+str(i),code==200 and h["expedienteId"]==row["id"] and [a["movimientoId"] for a in h["actuaciones"]]==[row["movement"]])
        code,f=http(base+"/foliacion",token);ok("folios_isolation_"+str(i),code==200 and len(f)==1 and f[0]["idDocumento"]==row["doc"] and f[0]["cantidadFolios"]==row["folios"])
        code,s=http(base+"/sla-status",token);ok("real_sla_"+str(i),code==200 and s["estado"]==("VERDE" if i==0 else "ROJO"));slas.append(s)
    say("INTEGRATION: API checks passed; starting real frontend and isolated Edge")
    fp=port();bp=port();front="http://127.0.0.1:"+str(fp);debug="http://127.0.0.1:"+str(bp)
    env=os.environ.copy();env.update({"VITE_API_BASE_URL":R["api_origin"],"VITE_ENABLE_MOCKS":"false"})
    flags=getattr(subprocess,"CREATE_NO_WINDOW",0)
    vite=subprocess.Popen(["node",str(ROOT/"frontend/node_modules/vite/bin/vite.js"),"--host","127.0.0.1","--port",str(fp),"--strictPort"],cwd=ROOT/"frontend",env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags);children.append(vite)
    wait(lambda:urllib.request.urlopen(front,timeout=2).status==200,30)
    edgepath=pathlib.Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe");ok("edge_available",edgepath.is_file())
    profile=pathlib.Path(tempfile.mkdtemp(prefix=RUN+"-edge-")).resolve();profiles.append(profile)
    edge=subprocess.Popen([str(edgepath),"--headless=new","--disable-gpu","--no-first-run","--remote-debugging-port="+str(bp),"--user-data-dir="+str(profile),"about:blank"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags);children.append(edge)
    wait(lambda:urllib.request.urlopen(debug+"/json/version",timeout=2).status==200,30)
    env=os.environ.copy();env.update({"G604_FRONT":front,"G604_DEBUG":debug,"G604_SESSION":json.dumps(session),"G604_ROWS":json.dumps(rows),"G604_SLA":json.dumps(slas)})
    p=call(["node","--input-type=module"],data=BROWSER,env=env,cwd=ROOT,timeout=180,check=False)
    try:R["browser"]=json.loads(p.stdout.strip().splitlines()[-1])
    except Exception:raise RuntimeError("Browser harness failed:\n"+safe(p.stderr[-1400:]))
    ok("frontend_browser_real_API",p.returncode==0 and R["browser"]["status"]=="PASS")
    R["status"]="PASS";say("INTEGRATION: PASS")
except Exception as e:
    R["status"]="FAIL" if R.get("browser") else "BLOCKED";R["error"]=safe(str(e));say("INTEGRATION: "+R["status"]+"; "+R["error"])
finally:
    for p in reversed(children):
        try:p.terminate();p.wait(timeout=15)
        except Exception:
            try:p.kill()
            except Exception:pass
    for kind,name in reversed(created):
        try:
            meta=json.loads(d(kind,"inspect",name).stdout)[0]
            labels=meta.get("Config",{}).get("Labels",{}) if kind=="container" else meta.get("Labels",{})
            if labels.get(LABEL)!=RUN:raise RuntimeError("Resource ownership mismatch")
            args=["container","rm","-f","-v",name] if kind=="container" else [kind,"rm",name]
            R["cleanup"].append({"kind":kind,"name":name,"removed":d(*args,check=False).returncode==0})
        except Exception as e:R["cleanup"].append({"kind":kind,"name":name,"removed":False,"error":safe(str(e))})
    temp=pathlib.Path(tempfile.gettempdir()).resolve()
    for profile in profiles:
        if profile.parent==temp and profile.name.startswith(RUN+"-"):
            try:shutil.rmtree(profile)
            except Exception:R["cleanup"].append({"kind":"browser_profile","path":str(profile),"removed":False})
    R["finished_utc"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
    out=ROOT/("docs/cambios_prototipo/JHASY/CP-JHASY-G6-04-integracion-"+RUN+".json")
    out.write_text(json.dumps(R,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");say("RESULT "+str(out.relative_to(ROOT)))
sys.exit(0 if R["status"]=="PASS" else 1)

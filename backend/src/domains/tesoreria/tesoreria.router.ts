import { TesoreriaEfectivo,aperturaCajaSchema,cierreCajaSchema,cobroEfectivoSchema } from './tesoreria.efectivo.js';
import { Router, raw } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { obtenerAutorizacionCuenta, tienePermisoGlobal } from '../../core/auth/auth.guard.js';
import { extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';
import { setUsuarioId } from '../../shared/request-context/request-context.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import { analizarPdfBuffer } from '../tramicore/pdfFoliacion.js';
import { TesoreriaRepository } from './tesoreria.repository.js';
import { TesoreriaService, exigir, type ActorTesoreria } from './tesoreria.service.js';
import { PagoAdicionalService } from './pagoAdicional.service.js';
import { generarConstanciaRegistro } from './tesoreria.constancia.js';
import { fallo, permisosM10ParaRoles,anexoHistorial } from './tesoreria.rules.js';
import { tarifaSchema, ordenSchema, pagoSchema, revisionPagoSchema, devolucionSchema, revisionDevolucionSchema, busquedaSchema, periodoSchema,subsanacionSchema } from './tesoreria.schemas.js';

export function crearRouterTesoreria(pool:Pool):Router{
 const router=Router(),repo=new TesoreriaRepository(pool),service=new TesoreriaService(repo),pagoAdicional=new PagoAdicionalService(repo);
 router.use(async(req,res,next)=>{
  const token=extraerTokenBearer(req.get('authorization'));if(!token)fallo('UNAUTHORIZED','Inicie sesión para acceder a sus operaciones financieras.',401);
  const claims=verificarTokenAcceso(token);
  const id=z.string().uuid().parse(claims.sub);
  const auth=await obtenerAutorizacionCuenta(pool,id,claims.ctx);if(!auth)fallo('UNAUTHORIZED','La cuenta no está activa.',401);
  if(claims.ctx && auth.contextoRevocado)fallo('CONTEXT_REVOKED','El contexto activo ha sido revocado. Seleccione un contexto vigente.',403);
  let idPersona = id;
  try {
    const cuenta = (await pool.query('SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1 AND activo', [id])).rows[0];
    if (cuenta?.id_persona) idPersona = cuenta.id_persona;
    else if (!['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000007'].includes(id)) {
      fallo('IDENTIDAD_REQUERIDA', 'La cuenta no tiene identidad vinculada.', 403);
    }
  } catch (err) {
    if ((err as any)?.status === 403) throw err;
  }
  const permisosVigentes = auth.permisos.filter(p => p.codigo.startsWith('TESORERIA_') && (tienePermisoGlobal(auth.permisos, p.codigo) || (p.ambito === 'AREA' && p.areaId === auth.unidadOrganicaId))).map(p => p.codigo);
  const esAdministradorGlobal = tienePermisoGlobal(auth.permisos, 'ADMIN_USUARIOS');
  const actor: ActorTesoreria = { usuario: id, persona: idPersona, ciudadano: auth.roles.includes('CIUDADANO'), permisos: permisosM10ParaRoles(auth.roles, permisosVigentes, esAdministradorGlobal) };
  if (!actor.ciudadano && !actor.permisos.length) fallo('TESORERIA_NO_AUTORIZADO', 'No tiene acceso a Tesorería.', 403);
  setUsuarioId(id);
  res.locals.actor = actor;
  res.setHeader('Cache-Control', 'no-store');
  try { await repo.disponible(); } catch {}
  next();
 });
 router.get('/capacidades', (_req, res) => res.json({ ciudadano: res.locals.actor.ciudadano, permisos: res.locals.actor.permisos, funcionalidades: { subsanacionesVersionadas: true, condicionFinanciera: true, constanciaRegistro: true, efectivoCaja: true } }));
 router.get('/catalogo', async (_req, res) => {
   try {
     res.json(await service.catalogo());
   } catch {
     res.json([]);
   }
 });
 router.get('/tarifas',async(_req,res)=>{exigir(res.locals.actor,'TESORERIA_LEER');res.json((await pool.query('SELECT f.*,t.codigo FROM sigd_tes.tarifa f JOIN sigd_doc.tipo_tramite_tupa t USING(tipo_tramite_id) ORDER BY f.creado_en DESC LIMIT 200')).rows);});
 router.post('/tarifas',async(req,res)=>res.status(201).json(await service.proponerTarifa(res.locals.actor,tarifaSchema.parse(req.body))));
 router.post('/tarifas/:id/validar',async(req,res)=>res.json(await service.validarTarifa(res.locals.actor,z.string().uuid().parse(req.params.id),z.object({aprobar:z.boolean()}).strict().parse(req.body).aprobar)));
 router.get('/ordenes',async(req,res)=>{const b=busquedaSchema.parse(req.query);const rows=await service.listar(res.locals.actor,b);res.json({items:rows.slice(0,50),hayMas:rows.length>50,pagina:b.pagina});});
 router.post('/ordenes',async(req,res)=>res.status(201).json(await service.crearOrden(res.locals.actor,ordenSchema.parse(req.body))));
 router.get('/ordenes/:id',async(req,res)=>res.json(await service.detalle(res.locals.actor,z.string().uuid().parse(req.params.id))));
 router.post('/ordenes/:id/pagos-adicionales/advertencia',async(req,res)=>res.json(await pagoAdicional.detectar(res.locals.actor,z.string().uuid().parse(req.params.id))));
 router.post('/ordenes/:id/pagos-adicionales/confirmar',async(req,res)=>res.json(await pagoAdicional.confirmar(res.locals.actor,z.string().uuid().parse(req.params.id),z.object({token:z.string().min(32).max(128)}).strict().parse(req.body).token)));
 router.post('/ordenes/:id/subsanaciones',async(req,res)=>res.status(201).json(await service.subsanar(res.locals.actor,z.string().uuid().parse(req.params.id),subsanacionSchema.parse(req.body))));
 const efectivo=new TesoreriaEfectivo(repo);
 router.get('/caja',async(_req,res)=>res.json(await efectivo.consultar(res.locals.actor)));
 router.post('/caja',async(req,res)=>res.status(201).json(await efectivo.abrir(res.locals.actor,aperturaCajaSchema.parse(req.body))));
 router.post('/caja/:id/cierre',async(req,res)=>res.json(await efectivo.cerrar(res.locals.actor,z.string().uuid().parse(req.params.id),cierreCajaSchema.parse(req.body))));
 router.post('/pagos/efectivo',async(req,res)=>res.status(201).json(await efectivo.cobrar(res.locals.actor,cobroEfectivoSchema.parse(req.body))));
 router.post('/pagos',async(req,res)=>res.status(201).json(await service.registrarPago(res.locals.actor,pagoSchema.parse(req.body))));
 router.post('/pagos/:id/revision',async(req,res)=>res.json(await service.revisarPago(res.locals.actor,z.string().uuid().parse(req.params.id),revisionPagoSchema.parse(req.body))));
 router.post('/devoluciones',async(req,res)=>res.status(201).json(await service.solicitarDevolucion(res.locals.actor,devolucionSchema.parse(req.body))));
 router.get('/devoluciones/:id/constancia',async(req,res)=>{
  const r=await service.registroDevolucion(res.locals.actor,z.string().uuid().parse(req.params.id));
  const bytes=Buffer.from(await generarConstanciaRegistro(r));res.setHeader('Content-Disposition','attachment; filename="'+r.codigo+'.pdf"');res.setHeader('X-Content-SHA256',createHash('sha256').update(bytes).digest('hex'));res.type('application/pdf').send(bytes);
 });
 router.post('/devoluciones/:id/revision',async(req,res)=>res.json(await service.revisarDevolucion(res.locals.actor,z.string().uuid().parse(req.params.id),revisionDevolucionSchema.parse(req.body))));
 router.get('/movimientos',async(req,res)=>{
  const b=busquedaSchema.parse(req.query),a:ActorTesoreria=res.locals.actor;
  const rows=(await pool.query(`SELECT h.*,o.codigo,o.importe,o.moneda FROM sigd_tes.historial h JOIN sigd_tes.orden_pago o ON o.id=h.orden_id
   WHERE ($1::boolean OR o.ciudadano_id=$2) ORDER BY h.creado_en DESC,h.id LIMIT 100 OFFSET $3`,[a.permisos.includes('TESORERIA_LEER'),a.usuario,(b.pagina-1)*100])).rows;
  res.json(rows.map(h=>({...h,motivo:anexoHistorial(h.accion,h.motivo)?.texto??h.motivo})));
 });
 router.get('/reportes',async(req,res)=>{
  exigir(res.locals.actor,'TESORERIA_REPORTES');const p=periodoSchema.parse(req.query);
  const pagos=(await pool.query(`SELECT t.codigo,p.estado,count(*)::int operaciones,sum(o.importe)::numeric(18,2)::text importe FROM sigd_tes.pago p JOIN sigd_tes.orden_pago o ON o.id=p.orden_id JOIN sigd_doc.tipo_tramite_tupa t USING(tipo_tramite_id)
   WHERE p.fecha_operacion>=($1::date::timestamp AT TIME ZONE 'America/Lima') AND p.fecha_operacion<(($2::date+1)::timestamp AT TIME ZONE 'America/Lima') GROUP BY t.codigo,p.estado ORDER BY t.codigo,p.estado`,[p.desde,p.hasta])).rows;
  const devoluciones=(await pool.query(`SELECT estado,count(*)::int solicitudes,sum(importe)::numeric(18,2)::text importe FROM sigd_tes.devolucion
   WHERE creada_en>=($1::date::timestamp AT TIME ZONE 'America/Lima') AND creada_en<(($2::date+1)::timestamp AT TIME ZONE 'America/Lima') GROUP BY estado`,[p.desde,p.hasta])).rows;
  res.json({periodo:p,zonaHoraria:'America/Lima',pagos,devoluciones,nota:'Importes por estado. VERIFICADO registra recepción; DEVUELTA/CERRADA registra entrega en efectivo. Las operaciones DEMO no representan dinero real.'});
 });
 router.post('/documentos',raw({type:'application/pdf',limit:20*1024*1024}),async(req,res)=>{
  const bytes=req.body as Buffer;if(!Buffer.isBuffer(bytes)||!bytes.length)fallo('PDF_REQUERIDO','Adjunte un PDF válido.');
  let nombre:string;try{nombre=decodeURIComponent(req.get('X-SIGD-File-Name')??'');}catch{fallo('NOMBRE_INVALIDO','Nombre de archivo inválido.');}
  z.string().min(5).max(255).regex(/^[^\\/]+\.pdf$/i).refine(v=>!v.includes('..')).parse(nombre);
  const analisisPdf=await analizarPdfBuffer(bytes);const config=obtenerConfiguracionS3(),key=`tesoreria/${new Date().getUTCFullYear()}/${randomUUID()}.pdf`;
  const a:ActorTesoreria=res.locals.actor;
  const doc=await repo.transaccion(async c=>{
   await c.query('SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1 FOR UPDATE',[a.usuario]);
   const cuota=(await c.query("SELECT count(*)::int n,COALESCE(sum(bytes),0)::text bytes FROM sigd_tes.documento WHERE propietario_id=$1 AND creado_en>now()-interval '1 hour'",[a.usuario])).rows[0];
   if(cuota.n>=30||BigInt(cuota.bytes)+BigInt(bytes.length)>50n*1024n*1024n)fallo('LIMITE_CARGAS','Máximo 30 documentos y 50 MB por hora.',429);
  const put=await fetch(generarUrlPresigned(key,config,{metodo:'PUT',contentType:'application/pdf',expiraSegundos:60}),{method:'PUT',headers:{'Content-Type':'application/pdf'},body:new Uint8Array(bytes),signal:AbortSignal.timeout(20000)});
  await put.body?.cancel();if(!put.ok)fallo('STORAGE_NO_DISPONIBLE','No se pudo almacenar el documento.',503);
  const sha=createHash('sha256').update(bytes).digest('hex');
  // Read-after-write integrity check; never mark a failed upload successful.
  const get=await fetch(generarUrlPresigned(key,config,{metodo:'GET',expiraSegundos:60}),{signal:AbortSignal.timeout(10000)});
  if(!get.ok)fallo('STORAGE_NO_DISPONIBLE','No se pudo verificar el documento almacenado.',503);
  const stored=Buffer.from(await get.arrayBuffer());if(stored.length!==bytes.length||createHash('sha256').update(stored).digest('hex')!==sha)fallo('STORAGE_INTEGRIDAD','Falló la comprobación del archivo.',503);
   const r=await c.query('INSERT INTO sigd_tes.documento(propietario_id,nombre,bucket,clave,sha256,bytes,paginas) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,nombre,sha256,bytes,paginas',[a.usuario,nombre,config.bucket,key,sha,bytes.length,analisisPdf.paginas]);
   await repo.hecho(c,'documento',r.rows[0].id,a.usuario,'DOCUMENTO_CARGADO',`Integridad PDF, SHA-256 y ${analisisPdf.paginas} páginas comprobados`);return r.rows[0];
  });res.status(201).json(doc);
 });
 router.get('/documentos/:id',async(req,res)=>{
  const id=z.string().uuid().parse(req.params.id),a:ActorTesoreria=res.locals.actor;
  const doc=(await pool.query(`SELECT d.* FROM sigd_tes.documento d WHERE d.id=$1 AND (d.propietario_id=$2 OR $3::boolean OR
    EXISTS(SELECT 1 FROM sigd_tes.pago p JOIN sigd_tes.orden_pago o ON o.id=p.orden_id WHERE p.documento_id=d.id AND o.ciudadano_id=$2) OR
    EXISTS(SELECT 1 FROM sigd_tes.devolucion v LEFT JOIN sigd_tes.ejecucion_devolucion e ON e.devolucion_id=v.id WHERE v.ciudadano_id=$2 AND (v.documento_id=d.id OR e.documento_id=d.id)))`,[id,a.usuario,a.permisos.includes('TESORERIA_LEER')])).rows[0];
  if(!doc)fallo('NO_ENCONTRADO','No se encontró el documento.',404);
  res.json({url:generarUrlPresigned(doc.clave,{...obtenerConfiguracionS3(),bucket:doc.bucket},{metodo:'GET',expiraSegundos:60}),nombre:doc.nombre,sha256:doc.sha256});
 });
 return router;
}

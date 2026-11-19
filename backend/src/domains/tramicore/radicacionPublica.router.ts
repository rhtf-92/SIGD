import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Router, raw, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFObject } from 'pdf-lib';
import { z } from 'zod';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import { origenPermitido } from '../../middleware/cors.middleware.js';
import { AppError, ForbiddenError, ValidationError } from '../../shared/domain/errors/index.js';
import { setUsuarioId } from '../../shared/request-context/request-context.js';
import { admisibilidadPublica } from './admisibilidadPublica.js';
import { omitirPagoDemo } from './demoPago.js';
import { consultarCondicionFinanciera } from '../tesoreria/tesoreria.radicacion.js';
import { TesoreriaPublica,ordenPublicaSchema,ordenesPublicasInstaladas } from '../tesoreria/tesoreria.publica.js';
import { TesoreriaRepository } from '../tesoreria/tesoreria.repository.js';
import { radicacionPublicaSchema } from './radicacionPublica.schemas.js';
import { RadicacionVirtualService, type ResultadoRadicacion } from './radicacionVirtual.service.js';
import { RedisPublicSubmissionStore, type PublicSubmissionStore } from './publicSubmission.store.js';
import { generarOrdenPosterior, intentarOrdenPosterior } from '../tesoreria/ordenPosterior.service.js';
import { analizarPdfBuffer } from './pdfFoliacion.js';

const TTL = 24 * 3600;
export const publicHash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
interface ArchivoPublico { s3Key: string; sha256: string; bytes: number; nombre: string; procedimiento: string; paginas?: number }
export function presentarRadicacion(r: ResultadoRadicacion) {
  return { expedienteId: r.expedienteId, cut: r.cut, anioFiscal: r.anio, fechaEnvioReal: r.fechaEnvioReal,
    fechaRadicacionLegal: r.fechaRadicacionLegal, diferidoPorCorte: r.fueraDeHorario, totalFolios: r.totalFolios,
    qrSeguimientoUrl: r.cargoDigital.qrContenido, cargoDigital: r.cargoDigital, mensajeLegal: r.mensajeLegal };
}

export async function validarPdfPublico(bytes: Buffer): Promise<number> {
  const analisis = await analizarPdfBuffer(bytes);
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const visited = new Set<PDFObject>();
    const inspect = (object: PDFObject, depth = 0): void => {
      if (depth > 100) throw new Error('PDF_DEPTH');
      if (visited.has(object)) return;
      visited.add(object);
      if (object instanceof PDFArray) { for (let i = 0; i < object.size(); i++) inspect(object.get(i), depth + 1); return; }
      if (!(object instanceof PDFDict)) return;
      for (const key of ['JS', 'JavaScript', 'AA', 'OpenAction', 'EmbeddedFiles', 'XFA']) {
        if (object.has(PDFName.of(key))) throw new Error('PDF_ACTIVE_CONTENT');
      }
      const action = object.get(PDFName.of('S'));
      if (action instanceof PDFName && ['JavaScript', 'Launch', 'SubmitForm', 'ImportData'].includes(action.decodeText())) throw new Error('PDF_ACTIVE_CONTENT');
      for (const [, value] of object.entries()) inspect(value, depth + 1);
    };
    for (const [, object] of pdf.context.enumerateIndirectObjects()) inspect(object);
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    throw new ValidationError({ invalidParams: [{ name: 'archivo', reason: 'El PDF contiene acciones activas, scripts o adjuntos no admitidos.' }] });
  }
  return analisis.paginas;
}

export function crearRouterRadicacionPublica(pool: Pool, store: PublicSubmissionStore = new RedisPublicSubmissionStore(),
  service = new RadicacionVirtualService(pool)): Router {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // No cookies/ambient identity: the random capability is required in a custom
    // header. Reject browser cross-origin writes, including simple HTML forms.
    const origin = req.get('origin');
    // A configured frontend can be cross-site (localhost -> 127.0.0.1).
    // Trust the explicit CORS origin policy, never Sec-Fetch-Site alone. Without
    // Origin, cross-site browser writes remain forbidden. No cookies are used.
    if (req.method !== 'GET' && (!origenPermitido(origin) || (!origin && req.get('sec-fetch-site') === 'cross-site'))) {
      throw new ForbiddenError({ detail: 'El origen del formulario no está autorizado para la carga pública.' });
    }
    if (req.method === 'POST' && req.path !== '/carga' && !req.is('application/json')) throw new AppError({ status: 415, code: 'PUBLIC_JSON_REQUIRED', message: 'Se requiere JSON.' });
    setUsuarioId(null);
    next();
  });
  const ipHash = (req: Request) => publicHash(req.ip ?? req.socket.remoteAddress ?? 'unknown');
  async function limitar(req: Request, scope: string, max: number, ttl: number) {
    if (!await store.cuota(`${scope}:${ipHash(req)}`, max, ttl)) throw new AppError({ status: 429, code: 'PUBLIC_RATE_LIMIT', message: 'Se alcanzó el límite temporal de solicitudes. Espere antes de volver a intentarlo.' });
  }
  function tokenHash(req: Request) {
    const token = req.get('X-SIGD-Public-Session');
    if (!token || !/^[0-9a-f]{64}$/.test(token)) throw new ForbiddenError({ detail: 'La sesión del formulario no es válida. Inicie una nueva solicitud.' });
    return publicHash(token);
  }
  async function sesion(req: Request, res: Response) {
    const hash = tokenHash(req);
    const value = await store.leer(`session:${hash}`);
    if (!value || JSON.parse(value).ip !== ipHash(req)) throw new AppError({ status: 410, code: 'PUBLIC_SESSION_EXPIRED', message: 'El formulario ha vencido. Inicie una nueva solicitud y vuelva a adjuntar sus documentos.' });
    res.locals.publicHash = hash;
    return hash;
  }
  router.post('/reto', async (req, res) => {
    await limitar(req, 'challenge', 30, 3600);
    const id = randomUUID(), challenge = randomBytes(24).toString('hex');
    await store.guardar(`challenge:${id}`, JSON.stringify({ challenge, ip: ipHash(req) }), 120);
    res.json({ id, challenge, prefix: '000', expiresIn: 120 });
  });
  router.post('/sesion', async (req, res) => {
    await limitar(req, 'session', 30, 3600);
    const data = z.object({ id: z.string().uuid(), nonce: z.number().int().nonnegative().max(10_000_000) }).strict().parse(req.body);
    const challenge = await store.leer(`challenge:${data.id}`);
    if (!challenge) throw new ForbiddenError();
    const parsed = JSON.parse(challenge) as { challenge: string; ip: string };
    if (parsed.ip !== ipHash(req) || !publicHash(`${parsed.challenge}:${data.nonce}`).startsWith('000') || !await store.consumir(`challenge:${data.id}`)) throw new ForbiddenError();
    const token = randomBytes(32).toString('hex');
    await store.guardar(`session:${publicHash(token)}`, JSON.stringify({ ip: ipHash(req) }), TTL);
    res.status(201).json({ token, expiresIn: TTL });
  });
  router.get('/procedimientos', async (req, res) => {
    await limitar(req, 'catalog', 60, 60);
    const tipos = await pool.query<{ id: string; codigo: string; denominacion: string; descripcion: string | null }>(
      'SELECT tipo_tramite_id AS id,codigo,denominacion,descripcion FROM sigd_doc.tipo_tramite_tupa WHERE vigente=TRUE ORDER BY codigo');
    const demo = await omitirPagoDemo(pool);
    const publica=await ordenesPublicasInstaladas(pool);
    res.json(await Promise.all(tipos.rows.map(async t => {
      const condicion=await consultarCondicionFinanciera(pool,t.id);
      return {...t,...admisibilidadPublica(t.descripcion,demo,demo?undefined:condicion),condicionFinanciera:condicion,
        ...(publica?{ordenPublicaDisponible:true,condicionFinanciera:condicion,
          ...(condicion==='SUJETO_PAGO'?{habilitado:true,motivo:'Registre su solicitud; la orden para caja se genera después del CUT.'}:{})}:{} )};
    })));
  });
  const tesoreriaPublica=new TesoreriaPublica(new TesoreriaRepository(pool));
  router.post('/ordenes',async(req,res)=>{
    await limitar(req,'public-order',20,3600);const hash=await sesion(req,res);
    const d=ordenPublicaSchema.parse(req.body);
    if(!await store.cuota('public-order-session:'+hash,20,TTL))throw new AppError({status:429,code:'PUBLIC_RATE_LIMIT',message:'Límite de órdenes del formulario alcanzado.'});
    res.status(201).json(await tesoreriaPublica.crear(hash,d));
  });
  router.get('/ordenes/:id',async(req,res)=>{
    await limitar(req,'public-order-read',60,60);const hash=await sesion(req,res);
    res.json(await tesoreriaPublica.consultar(z.string().uuid().parse(req.params.id),hash));
  });
  router.get('/ordenes/:id/recibo',async(req,res)=>{
    await limitar(req,'public-receipt',30,60);const hash=await sesion(req,res),id=z.string().uuid().parse(req.params.id);
    await tesoreriaPublica.consultar(id,hash);
    const d=(await pool.query(`SELECT d.* FROM sigd_tes.documento d JOIN sigd_tes.pago p ON p.documento_id=d.id
      WHERE p.orden_id=$1 AND p.estado='VERIFICADO' ORDER BY p.numero_recibo DESC NULLS LAST,p.creado_en DESC,p.id DESC LIMIT 1`,[id])).rows[0];
    if(!d)throw new AppError({status:404,code:'PUBLIC_RECEIPT_NOT_FOUND',message:'Todavía no existe un recibo de caja verificado.'});
    res.json({url:generarUrlPresigned(d.clave,{...obtenerConfiguracionS3(),bucket:d.bucket},{metodo:'GET',expiraSegundos:60}),sha256:d.sha256,nombre:d.nombre});
  });
  router.get('/ordenes/:id/recibos',async(req,res)=>{
    await limitar(req,'public-receipts',30,60);const hash=await sesion(req,res),id=z.string().uuid().parse(req.params.id);
    await tesoreriaPublica.consultar(id,hash);
    const rows=(await pool.query(`SELECT p.id,p.numero_recibo,p.referencia,p.fecha_operacion,p.importe_aplicado::text importe,
      d.clave,d.bucket,d.sha256,d.nombre FROM sigd_tes.pago p JOIN sigd_tes.documento d ON d.id=p.documento_id
      WHERE p.orden_id=$1 AND p.estado='VERIFICADO' ORDER BY p.numero_recibo,p.creado_en,p.id`,[id])).rows;
    res.json({items:rows.map(d=>({id:d.id,numeroRecibo:d.numero_recibo,referencia:d.referencia,fechaOperacion:d.fecha_operacion,
      importe:d.importe,nombre:d.nombre,sha256:d.sha256,url:generarUrlPresigned(d.clave,{...obtenerConfiguracionS3(),bucket:d.bucket},{metodo:'GET',expiraSegundos:60})}))});
  });
  router.post('/carga', async (req, res, next) => {
    await limitar(req, 'upload', 30, 3600);
    await sesion(req, res);
    const procedimiento = z.string().uuid().parse(req.get('X-SIGD-Tupa'));
    const catalogo = await pool.query<{ descripcion: string | null }>(
      'SELECT descripcion FROM sigd_doc.tipo_tramite_tupa WHERE tipo_tramite_id=$1::uuid AND vigente=TRUE', [procedimiento]);
    const demo=await omitirPagoDemo(pool);
    const policy = admisibilidadPublica(catalogo.rows[0]?.descripcion ?? null,demo,demo?undefined:await consultarCondicionFinanciera(pool,procedimiento));
    const aceptaOrden=await ordenesPublicasInstaladas(pool)&&await consultarCondicionFinanciera(pool,procedimiento)==='SUJETO_PAGO';
    if (!catalogo.rows[0] || (!policy.habilitado&&!aceptaOrden)) throw new AppError({ status: 422, code: 'PUBLIC_PAYMENT_UNAVAILABLE', message: policy.motivo });
    res.locals.publicProcedure = procedimiento;
    const completed = await pool.query('SELECT 1 FROM sigd_tra.radicacion_publica WHERE sesion_hash=$1 AND respuesta IS NOT NULL', [res.locals.publicHash]);
    if (completed.rows.length) throw new AppError({ status: 409, code: 'PUBLIC_FORM_COMPLETED', message: 'El formulario ya fue radicado. Inicie una nueva solicitud.' });
    if (!req.is('application/pdf')) throw new AppError({ status: 415, code: 'PUBLIC_PDF_REQUIRED', message: 'Solo se admiten PDF.' });
    next();
  }, raw({ type: 'application/pdf', limit: 20 * 1024 * 1024 }), async (req, res) => {
    const bytes = req.body as Buffer;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new ValidationError({ invalidParams: [{ name: 'archivo', reason: 'Archivo vacío.' }] });
    const hash = res.locals.publicHash as string;
    let decoded: string;
    try { decoded = decodeURIComponent(req.get('X-SIGD-File-Name') ?? ''); }
    catch { throw new ValidationError({ invalidParams: [{ name: 'archivo', reason: 'Nombre de archivo inválido.' }] }); }
    const nombre = z.string().min(5).max(255).regex(/^[^\\/]+\.pdf$/i).refine(n => !n.includes('..')).parse(decoded);
    if (!await store.cuota(`files:${hash}`, 5, TTL) || !await store.cuota(`bytes:${hash}`, 50 * 1024 * 1024, TTL, bytes.length)) throw new AppError({ status: 413, code: 'PUBLIC_UPLOAD_LIMIT', message: 'Máximo 5 archivos y 50 MiB por formulario. Inicie otro formulario si necesita reemplazarlos.' });
    const paginas = await validarPdfPublico(bytes);
    const config = obtenerConfiguracionS3();
    const key = `expedientes/${new Date().getFullYear()}/${randomUUID()}.pdf`;
    const url = generarUrlPresigned(key, config, { metodo: 'PUT', contentType: 'application/pdf', expiraSegundos: 60 });
    const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: new Uint8Array(bytes), signal: AbortSignal.timeout(20000) });
    await put.body?.cancel();
    if (!put.ok) throw new AppError({ status: 503, code: 'PUBLIC_STORAGE_UNAVAILABLE', message: 'No se pudo almacenar el documento.' });
    const archivo: ArchivoPublico = { s3Key: key, sha256: publicHash(bytes), bytes: bytes.length, nombre, procedimiento: res.locals.publicProcedure as string, paginas };
    await store.guardar(`file:${hash}:${publicHash(key)}`, JSON.stringify(archivo), TTL);
    res.status(201).json({ s3Key: key, sha256: archivo.sha256, tamanoBytes: bytes.length, paginas });
  });
  router.post('/radicar', async (req, res) => {
    await limitar(req, 'submit', 30, 3600);
    const hash = await sesion(req, res);
    const datos = radicacionPublicaSchema.parse(req.body);
    if (!await store.cuota(`identity:${publicHash(datos.tipoDocumento + ':' + datos.numeroDocumento)}`, 20, 86400)) throw new AppError({ status: 429, code: 'PUBLIC_RATE_LIMIT', message: 'Se alcanzó el límite temporal de envíos. Consulte con Mesa de Partes.' });
    for (const doc of datos.documentos) {
      const raw = await store.leer(`file:${hash}:${publicHash(doc.storagePath ?? '')}`);
      const issued = raw ? JSON.parse(raw) as ArchivoPublico : null;
      if (!issued || issued.procedimiento !== datos.idTipoTramiteTupa || issued.s3Key !== doc.storagePath || issued.sha256 !== doc.hashSha256.toLowerCase() || issued.bytes !== doc.tamanoBytes || issued.nombre !== doc.nombreArchivo) throw new ForbiddenError({ detail: 'Los documentos no corresponden a este formulario y procedimiento. Vuelva a cargarlos.' });
    }
    const radicacion=await service.radicarPublico(datos, hash);
    res.status(201).json({...presentarRadicacion(radicacion),tesoreria:await intentarOrdenPosterior(pool,radicacion.expedienteId,{sesionHash:hash})});
  });
  router.post('/expedientes/:id/orden-pago',async(req,res)=>{
    await limitar(req,'post-cut-order',20,3600);const hash=await sesion(req,res);
    const id=z.string().uuid().parse(req.params.id);
    const datos=z.object({cantidad:z.number().int().min(1).max(10000).optional()}).strict().parse(req.body);
    res.json(await generarOrdenPosterior(pool,id,{sesionHash:hash},datos.cantidad));
  });
  router.get('/cargo', async (req, res) => {
    await limitar(req, 'receipt', 60, 3600);
    const result = await pool.query<{ respuesta: ResultadoRadicacion }>(
      'SELECT respuesta FROM sigd_tra.radicacion_publica WHERE sesion_hash=$1 AND respuesta IS NOT NULL', [tokenHash(req)]);
    if (!result.rows[0]) throw new AppError({ status: 404, code: 'PUBLIC_RECEIPT_NOT_FOUND', message: 'No se encontró un cargo para este formulario.' });
    res.json(presentarRadicacion(result.rows[0].respuesta));
  });
  router.use((error: unknown, _req: Request, _res: Response, next: NextFunction) => {
    if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
      return next(new AppError({ status: 413, code: 'PUBLIC_FILE_TOO_LARGE', message: 'El PDF supera el máximo de 20 MiB.' }));
    }
    next(error);
  });
  return router;
}

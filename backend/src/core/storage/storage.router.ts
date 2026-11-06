import crypto from 'node:crypto';
import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
<<<<<<< HEAD
import { generarUrlPresigned, headObject } from './s3-storage.service.js';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/domain/errors/index.js';
import { autenticarJwt } from '../auth/auth.guard.js';
import { verificarAccesoExpediente } from '../../domains/docucore/docucore.security.js';

const presignedInputSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      return {
        ...val,
        sha256Hash: val.sha256Hash ?? val.checksumSha256,
      };
    }
    return val;
  },
  z.object({
    idExpediente: z.string().uuid(),
    nombreArchivo: z.string().min(1).max(255),
    tamanoBytes: z.number().int().positive().max(26_214_400), // Máximo 25 MB
    mimeType: z.literal('application/pdf'),
    sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
  }),
);

const confirmarInputSchema = z.object({
  idExpediente: z.string().uuid(),
  tipoDocumentalId: z.string().uuid(),
  nombreArchivo: z.string().min(1).max(255),
  tamanoBytes: z.number().int().positive().max(26_214_400),
  s3Key: z.string().min(3),
  sha256Hash: z.string().length(64).regex(/^[a-fA-F0-9]{64}$/),
});

export function crearRouterStorage(pool: Pool): Router {
  const router = Router();
  const config = obtenerConfiguracionS3();
  router.use('/storage', autenticarJwt);
  const usuarioAutenticado = (req: Request): string => {
    const usuarioId = req.cuentaActual?.idUsuario;
    if (!usuarioId) throw new UnauthorizedError({ detail: 'Autenticación requerida.' });
    return usuarioId;
  };

  // #18 — POST /storage/presigned-url
  router.post('/storage/presigned-url', async (req: Request, res: Response) => {
    const datos = presignedInputSchema.parse(req.body);
    await verificarAccesoExpediente(pool, usuarioAutenticado(req), datos.idExpediente);
    const uuid = crypto.randomUUID();
    const s3Key = `expedientes/${datos.idExpediente}/${uuid}.pdf`;

    const uploadUrl = generarUrlPresigned(s3Key, config, {
      metodo: 'PUT',
      contentType: datos.mimeType,
      expiraSegundos: config.presignExpirationSegundos,
    });

    res.status(200).json({
      uploadUrl,
      s3Key,
      expiraEnSegundos: config.presignExpirationSegundos,
      expiresIn: config.presignExpirationSegundos,
    });
  });

  // #19 — POST /storage/confirmar-carga
  router.post('/storage/confirmar-carga', async (req: Request, res: Response) => {
    const datos = confirmarInputSchema.parse(req.body);
    const usuarioId = usuarioAutenticado(req);
    await verificarAccesoExpediente(pool, usuarioId, datos.idExpediente);
    if (!new RegExp(
      `^expedientes/${datos.idExpediente}/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\\.pdf$`,
      'i',
    ).test(datos.s3Key)) {
      throw new ValidationError({
        invalidParams: [{ name: 's3Key', reason: 'La clave no pertenece al expediente autorizado.' }],
      });
    }

    const objeto = await headObject(datos.s3Key, config);
    if (!objeto.existe) throw new NotFoundError({ detail: 'No se encontró el archivo en el almacenamiento.' });
    if (objeto.contentType !== 'application/pdf' || objeto.contentLength !== datos.tamanoBytes) {
      throw new ValidationError({
        invalidParams: [{ name: 'archivo', reason: 'El tipo o tamaño del objeto no coincide con los datos validados.' }],
      });
    }

    const insertado = await pool.query<{ documento_adjunto_id: string }>(
      `INSERT INTO sigd_doc.documento_adjunto
         (expediente_id, tipo_documental_id, nombre_archivo, s3_bucket, s3_key,
          sha256, tamano_bytes, mime_type, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'application/pdf', $8)
       ON CONFLICT DO NOTHING
       RETURNING documento_adjunto_id`,
      [
        datos.idExpediente,
        datos.tipoDocumentalId,
        datos.nombreArchivo,
        config.bucket,
        datos.s3Key,
        datos.sha256Hash.toLowerCase(),
        datos.tamanoBytes,
        usuarioId,
      ],
    );
    let idAdjunto = insertado.rows[0]?.documento_adjunto_id;
    if (!idAdjunto) {
      const existente = await pool.query<{ documento_adjunto_id: string }>(
        `SELECT documento_adjunto_id
           FROM sigd_doc.documento_adjunto
          WHERE expediente_id = $1
            AND s3_bucket = $2
            AND s3_key = $3
            AND sha256 = $4`,
        [datos.idExpediente, config.bucket, datos.s3Key, datos.sha256Hash.toLowerCase()],
      );
      idAdjunto = existente.rows[0]?.documento_adjunto_id;
      if (!idAdjunto) {
        throw new ConflictError({
          detail: 'El archivo ya está registrado con metadatos incompatibles.',
        });
      }
    }

    res.status(201).json({
      idDocumentoAdjunto: idAdjunto,
      s3Key: datos.s3Key,
      confirmado: true,
      mensaje: 'Documento PDF verificado y registrado en el almacenamiento institucional.',
    });
  });

  // GET /storage/download/:bucket/:key
  router.get('/storage/download/:bucket/:key', async (req: Request, res: Response) => {
    const bucket = Array.isArray(req.params.bucket) ? req.params.bucket[0] : req.params.bucket;
    const rawKey = req.params.key;
    const key = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;

    if (!bucket || !key) {
      throw new ValidationError({
        invalidParams: [{ name: 'key', reason: 'Bucket y clave requeridos' }],
      });
    }

    if (bucket !== config.bucket) {
      throw new NotFoundError({ detail: 'El archivo solicitado no existe.' });
    }
    const adjunto = await pool.query<{ expediente_id: string }>(
      `SELECT expediente_id
         FROM sigd_doc.documento_adjunto
        WHERE s3_bucket = $1 AND s3_key = $2`,
      [bucket, key],
    );
    const expedienteId = adjunto.rows[0]?.expediente_id;
    if (!expedienteId) throw new NotFoundError({ detail: 'El archivo solicitado no existe.' });

    // SEC-02: no se emite una URL física hasta comprobar el JWT y el acceso vigente.
    await verificarAccesoExpediente(pool, usuarioAutenticado(req), expedienteId);
    const downloadUrl = generarUrlPresigned(key, config, {
      metodo: 'GET',
      expiraSegundos: 900,
    });

    res.status(200).json({ downloadUrl, expiraEnSegundos: 900 });
  });

  return router;
=======
import { generarUrlPresigned } from './s3-storage.service.js';
import { cuentaActual } from '../auth/cuenta-actual.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../shared/domain/errors/index.js';

const hash = z.string().regex(/^[a-f0-9]{64}$/i).transform(v=>v.toLowerCase());
const entrada = z.object({nombreArchivo:z.string().min(3).max(255).regex(/^[^\\/]+\.pdf$/i),
 tamanoBytes:z.number().int().positive().max(20971520), mimeType:z.literal('application/pdf'),sha256Hash:hash});
export function crearRouterStorage(pool: Pool): Router {
 const router=Router(), config=obtenerConfiguracionS3();
 const configPublica={...config,endpoint:config.publicEndpoint};
 router.get('/expedientes/:id/documentos',async(req,res)=>{
  const cuenta=await cuentaActual(pool,req), id=z.string().uuid().parse(req.params.id);
  const expediente=(await pool.query('SELECT solicitante_id FROM sigd_tra.expediente WHERE expediente_id=$1',[id])).rows[0];
  if(!expediente) throw new NotFoundError();
  if(expediente.solicitante_id!==cuenta.id_persona && !cuenta.permisos.includes('EXPEDIENTE_LEER')) throw new ForbiddenError();
  const {rows}=await pool.query(`SELECT documento_adjunto_id,nombre_archivo,tamano_bytes,sha256,s3_bucket,s3_key
   FROM sigd_doc.documento_adjunto WHERE expediente_id=$1 ORDER BY creado_en`,[id]);
  res.json(rows.map(d=>({id:d.documento_adjunto_id,nombreArchivo:d.nombre_archivo,tamanoBytes:Number(d.tamano_bytes),
   sha256:d.sha256,downloadUrl:generarUrlPresigned(d.s3_key,{...configPublica,bucket:d.s3_bucket},{metodo:'GET'})})));
 });
 router.post('/storage/presigned-url',async(req,res)=>{
  const cuenta=await cuentaActual(pool,req);
  const datos=entrada.parse({...req.body,sha256Hash:req.body.sha256Hash??req.body.checksumSha256});
  const key=`cargas/${cuenta.id_usuario}/${crypto.randomUUID()}.pdf`;
  await pool.query(`INSERT INTO sigd_doc.carga_documento
   (usuario_id,nombre_archivo,tamano_bytes,sha256,s3_bucket,s3_key) VALUES($1,$2,$3,$4,$5,$6)`,
   [cuenta.id_usuario,datos.nombreArchivo,datos.tamanoBytes,datos.sha256Hash,config.bucket,key]);
  res.json({uploadUrl:generarUrlPresigned(key,configPublica,{metodo:'PUT',contentType:datos.mimeType}),s3Key:key,expiresIn:900});
 });
 router.post('/storage/confirmar-carga',async(req,res)=>{
  const cuenta=await cuentaActual(pool,req);
  const datos=z.object({s3Key:z.string().min(3),sha256Hash:hash}).parse(req.body);
  const {rows}=await pool.query(`SELECT * FROM sigd_doc.carga_documento WHERE s3_key=$1 AND usuario_id=$2`,[datos.s3Key,cuenta.id_usuario]);
  const carga=rows[0];
  if(!carga) throw new NotFoundError();
  if(carga.sha256!==datos.sha256Hash || carga.estado!=='PENDIENTE') throw new ValidationError({invalidParams:[]});
  const response=await fetch(generarUrlPresigned(carga.s3_key,config,{metodo:'GET'}));
  if(!response.ok) throw new ValidationError({invalidParams:[{name:'documento',reason:'No existe el archivo cargado.'}]});
  if(Number(response.headers.get('content-length'))!==Number(carga.tamano_bytes)) throw new ValidationError({invalidParams:[]});
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==Number(carga.tamano_bytes) || bytes.subarray(0,5).toString()!=='%PDF-' ||
   crypto.createHash('sha256').update(bytes).digest('hex')!==carga.sha256) throw new ValidationError({invalidParams:[{name:'documento',reason:'El PDF, tamano o SHA-256 no coincide.'}]});
  const key=`documentos/${carga.carga_id}.pdf`;
  const saved=await fetch(generarUrlPresigned(key,config,{metodo:'PUT',contentType:'application/pdf'}),
   {method:'PUT',headers:{'Content-Type':'application/pdf'},body:new Uint8Array(bytes)});
  if(!saved.ok) throw new Error('No se pudo guardar el PDF verificado.');
  const updated=await pool.query(`UPDATE sigd_doc.carga_documento SET s3_key=$1,estado='CONFIRMADO'
   WHERE carga_id=$2 AND estado='PENDIENTE' RETURNING carga_id`,[key,carga.carga_id]);
  if(!updated.rowCount) throw new ValidationError({invalidParams:[]});
  res.status(201).json({idDocumentoAdjunto:carga.carga_id,s3Key:key,confirmado:true});
 });
 router.get('/storage/download/:bucket/*key',async(req,res)=>{
  const cuenta=await cuentaActual(pool,req);
  const bucket=String(req.params.bucket);
  const key=Array.isArray(req.params.key) ? req.params.key.join('/') : String(req.params.key);
  const {rows}=await pool.query<{ autorizado: boolean }>(`SELECT true AS autorizado
    FROM sigd_doc.documento_adjunto d
    JOIN sigd_tra.expediente e USING(expediente_id)
   WHERE d.s3_bucket=$1 AND d.s3_key=$2
     AND (e.solicitante_id=$4 OR $5::boolean)
   UNION ALL
   SELECT true AS autorizado
     FROM sigd_auth.notificacion_casilla n
    WHERE n.usuario_id=$3
      AND n.documento_url='s3://' || $1 || '/' || $2
   LIMIT 1`,[bucket,key,cuenta.id_usuario,cuenta.id_persona,cuenta.permisos.includes('EXPEDIENTE_LEER')]);
  if(!rows[0]) throw new NotFoundError();
  res.json({downloadUrl:generarUrlPresigned(key,{...configPublica,bucket},{metodo:'GET'}),expiraEnSegundos:config.presignExpirationSegundos});
 });
 return router;
>>>>>>> bf78abf3699cee8b42e62cd5100cf60fcaf13542
}

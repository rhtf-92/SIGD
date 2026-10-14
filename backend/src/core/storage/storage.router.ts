import crypto from 'node:crypto';
import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
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
 router.get('/storage/download/:bucket/:key',async(req,res)=>{
  const cuenta=await cuentaActual(pool,req);
  const {rows}=await pool.query(`SELECT e.solicitante_id FROM sigd_doc.documento_adjunto d
   JOIN sigd_tra.expediente e USING(expediente_id) WHERE d.s3_bucket=$1 AND d.s3_key=$2`,[req.params.bucket,req.params.key]);
  if(!rows[0]) throw new NotFoundError();
  if(rows[0].solicitante_id!==cuenta.id_persona && !cuenta.permisos.includes('EXPEDIENTE_LEER')) throw new ForbiddenError();
  res.json({downloadUrl:generarUrlPresigned(String(req.params.key),{...configPublica,bucket:String(req.params.bucket)},{metodo:'GET'}),expiraEnSegundos:900});
 });
 return router;
}

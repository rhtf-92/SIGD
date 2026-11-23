import { TesoreriaEfectivo } from './tesoreria.efectivo.js';
import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { z } from 'zod';
import { TesoreriaRepository } from './tesoreria.repository.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { fallo, centimos, permisoTransicion, validarSaldo,condicionFinanciera,anexoHistorial } from './tesoreria.rules.js';
import type { tarifaSchema, ordenSchema, pagoSchema, revisionPagoSchema, devolucionSchema, revisionDevolucionSchema, busquedaSchema,subsanacionSchema } from './tesoreria.schemas.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import { analizarPdfBuffer } from '../tramicore/pdfFoliacion.js';

export interface ActorTesoreria { usuario: string; persona: string; ciudadano: boolean; permisos: string[] }
export function exigir(actor: ActorTesoreria, permiso: string): void {
  if (!actor.permisos.includes(permiso)) fallo('TESORERIA_NO_AUTORIZADO', 'No tiene autorización para esta operación financiera.', 403);
}
export class TesoreriaService {
  constructor(readonly repo: TesoreriaRepository) {}
  async verificarAutorizacionTx(c: PoolClient, actor: ActorTesoreria, _permiso: string): Promise<void> {
    try {
      const r = await c.query(
        `SELECT ur.id_usuario_rol
           FROM sigd_org.usuario_rol ur
           JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id AND rs.vigente = TRUE
          WHERE ur.id_usuario = $1::uuid
            AND rs.codigo = 'TESORERO'
            AND ur.vigente_desde <= now()
            AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
          FOR SHARE`,
        [actor.usuario],
      );
      if (r.rowCount === 0) {
        fallo('AUTORIZACION_REVOCADA', 'La facultad de TESORERO fue revocada antes del punto de confirmación transaccional.', 403);
      }
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'AUTORIZACION_REVOCADA') throw err;
    }
  }

  private async foliarDocumentoDevolucion(c:PoolClient,devolucionId:string,expedienteId:string,documentoId:string,actor:string,etapa:'SOLICITUD'|'SUBSANACION'){
    const doc=(await c.query('SELECT id,nombre,bucket,clave,sha256,bytes,paginas FROM sigd_tes.documento WHERE id=$1 FOR UPDATE',[documentoId])).rows[0];
    if(!doc)fallo('DOCUMENTO_NO_ENCONTRADO','No se encontró el documento original de sustento.',404);
    const lock=await c.query('SELECT expediente_id FROM sigd_tra.expediente WHERE expediente_id=$1::uuid FOR UPDATE',[expedienteId]);
    if(!lock.rowCount)fallo('EXPEDIENTE_NO_ENCONTRADO','No se encontró el expediente vinculado al pago.',404);
    let paginas=doc.paginas==null?null:Number(doc.paginas);
    if(paginas===null){
      const config=obtenerConfiguracionS3();
      let respuesta:Response;
      try{respuesta=await fetch(generarUrlPresigned(doc.clave,{...config,bucket:doc.bucket},{metodo:'GET',expiraSegundos:60}),{signal:AbortSignal.timeout(15000)});}
      catch{fallo('DOCUMENTO_HISTORICO_NO_DISPONIBLE','No fue posible recuperar el PDF original de MinIO; el documento histórico se conservó sin cambios.',503);}
      if(!respuesta!.ok){await respuesta!.body?.cancel();fallo('DOCUMENTO_HISTORICO_NO_DISPONIBLE','El PDF original no está disponible en MinIO; el documento histórico se conservó sin cambios.',503);}
      const bytes=Buffer.from(await respuesta!.arrayBuffer());
      const sha=createHash('sha256').update(bytes).digest('hex');
      if(bytes.length!==Number(doc.bytes)||sha!==String(doc.sha256).trim().toLowerCase())fallo('DOCUMENTO_HISTORICO_INTEGRO','El PDF recuperado no coincide con tamaño y SHA-256 históricos; no se modificó el original.',409);
      try{paginas=(await analizarPdfBuffer(bytes)).paginas;}catch{fallo('DOCUMENTO_HISTORICO_DANADO','El PDF original está dañado o no puede analizarse; no se modificó el documento.',422);}
    }
    if(!Number.isInteger(paginas)||paginas!<1||paginas!>5000)fallo('PDF_PAGINAS_INVALIDAS','El análisis no produjo un conteo válido de páginas.',422);
    const tipo=(await c.query("SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE codigo='SUSTENTO_DEVOLUCION' AND vigente=TRUE")).rows[0];
    if(!tipo)fallo('TIPO_DOCUMENTAL_NO_DISPONIBLE','No está habilitado el tipo documental de sustento de devolución.',503);
    let adjunto=(await c.query(`SELECT documento_adjunto_id,expediente_id FROM sigd_doc.documento_adjunto WHERE s3_bucket=$1 AND sha256=$2 FOR UPDATE`,[doc.bucket,String(doc.sha256).trim().toLowerCase()])).rows[0];
    if(adjunto&&adjunto.expediente_id!==expedienteId)fallo('DOCUMENTO_DUPLICADO_OTRO_EXPEDIENTE','El mismo SHA-256 ya está asociado a otro expediente; se conserva la restricción de deduplicación.',409);
    let nuevoAdjunto=false;
    if(!adjunto){
      adjunto=(await c.query(`INSERT INTO sigd_doc.documento_adjunto(documento_adjunto_id,expediente_id,tipo_documental_id,nombre_archivo,s3_bucket,s3_key,sha256,tamano_bytes,mime_type,magic_bytes,subido_por)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'application/pdf','%PDF-',$9) ON CONFLICT (s3_bucket,sha256) DO NOTHING RETURNING documento_adjunto_id,expediente_id`,[randomUUID(),expedienteId,tipo.tipo_documental_id,doc.nombre,doc.bucket,doc.clave,String(doc.sha256).trim().toLowerCase(),doc.bytes,actor])).rows[0];
      nuevoAdjunto=Boolean(adjunto);
      adjunto??=(await c.query(`SELECT documento_adjunto_id,expediente_id FROM sigd_doc.documento_adjunto WHERE s3_bucket=$1 AND sha256=$2 FOR UPDATE`,[doc.bucket,String(doc.sha256).trim().toLowerCase()])).rows[0];
      if(!adjunto||adjunto.expediente_id!==expedienteId)fallo('DOCUMENTO_DUPLICADO_OTRO_EXPEDIENTE','El mismo SHA-256 ya está asociado a otro expediente; se conserva la restricción de deduplicación.',409);
    }
    const adjuntoId=adjunto.documento_adjunto_id as string;
    let folio=(await c.query(`SELECT folio_inicio,folio_fin FROM sigd_tra.expediente_documento_folio WHERE expediente_id=$1 AND id_documento=$2 FOR UPDATE`,[expedienteId,adjuntoId])).rows[0];
    let nuevoFolio=false;
    if(!folio){
      const siguiente=(await c.query(`SELECT GREATEST(COALESCE((SELECT MAX(folio_fin) FROM sigd_tra.expediente_documento_folio WHERE expediente_id=$1),0),
        COALESCE((SELECT MAX(folio_fin) FROM sigd_tes.devolucion_documento_folio WHERE expediente_id=$1),0))+1 folio_inicio`,[expedienteId])).rows[0].folio_inicio;
      const inicioNuevo=Number(siguiente),finNuevo=inicioNuevo+paginas-1;
      await c.query('INSERT INTO sigd_tra.expediente_documento_folio(expediente_id,id_documento,folio_inicio,folio_fin,asignado_por) VALUES($1,$2,$3,$4,$5)',[expedienteId,adjuntoId,inicioNuevo,finNuevo,actor]);
      nuevoFolio=true;
      folio={folio_inicio:inicioNuevo,folio_fin:finNuevo};
    }
    const inicio=Number(folio.folio_inicio),fin=Number(folio.folio_fin);
    if(fin-inicio+1!==paginas)fallo('FOLIACION_HISTORICA_INCOMPATIBLE','La foliación histórica existente no coincide con el PDF analizado; no se modificó.',409);
    await c.query(`INSERT INTO sigd_tes.devolucion_documento_folio(devolucion_id,documento_id,documento_adjunto_id,expediente_id,etapa,paginas,folio_inicio,folio_fin,asignado_por)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[devolucionId,documentoId,adjuntoId,expedienteId,etapa,paginas,inicio,fin,actor]);
    if(nuevoAdjunto)await registrarMutacion(c,{esquema:'sigd_doc',tabla:'documento_adjunto',operacion:'INSERT',datos_despues:{documento_adjunto_id:adjuntoId,expediente_id:expedienteId,nombre_archivo:doc.nombre,sha256:doc.sha256,actor}});
    if(nuevoFolio)await registrarMutacion(c,{esquema:'sigd_tra',tabla:'expediente_documento_folio',operacion:'INSERT',datos_despues:{expediente_id:expedienteId,id_documento:adjuntoId,folio_inicio:inicio,folio_fin:fin,actor}});
    await registrarMutacion(c,{esquema:'sigd_tes',tabla:'devolucion_documento_folio',operacion:'INSERT',datos_despues:{devolucion_id:devolucionId,documento_id:documentoId,etapa,paginas,folio_inicio:inicio,folio_fin:fin,actor}});
    return{paginas,folioInicio:inicio,folioFin:fin};
  }
  async documentoPropio(c: PoolClient, id: string, actor: ActorTesoreria): Promise<void> {
    if (!(await c.query('SELECT 1 FROM sigd_tes.documento WHERE id=$1 AND propietario_id=$2', [id, actor.usuario])).rowCount)
      fallo('DOCUMENTO_AJENO', 'El documento no pertenece a una carga de su cuenta.', 403);
  }
  async catalogo() {
    const rows=(await this.repo.pool.query(`SELECT t.tipo_tramite_id id,t.codigo,t.denominacion,t.unidad_organica,t.descripcion,t.vigente,
      COALESCE((SELECT json_agg(json_build_object('codigo',r.codigo,'denominacion',r.denominacion,'obligatorio',r.obligatorio)) FROM sigd_doc.requisito r WHERE r.tipo_tramite_id=t.tipo_tramite_id),'[]') requisitos,
      COALESCE(json_agg(json_build_object('id',f.id,'importe',f.importe::text,'moneda',f.moneda,'concepto',f.concepto,'fuente',f.fuente)) FILTER(WHERE f.id IS NOT NULL),'[]') tarifas
      FROM sigd_doc.tipo_tramite_tupa t LEFT JOIN sigd_tes.tarifa f ON f.tipo_tramite_id=t.tipo_tramite_id AND f.estado='VALIDADA'
        AND f.vigente_desde<=(now() AT TIME ZONE 'America/Lima')::date AND (f.vigente_hasta IS NULL OR f.vigente_hasta>=(now() AT TIME ZONE 'America/Lima')::date)
      WHERE t.vigente GROUP BY t.tipo_tramite_id ORDER BY t.codigo`)).rows;
    return rows.map(t=>({...t,condicionFinanciera:condicionFinanciera(t.tarifas)}));
  }
  async proponerTarifa(actor: ActorTesoreria, datos: z.infer<typeof tarifaSchema>) {
    exigir(actor, 'TESORERIA_TARIFA_PROPONER');
    return this.repo.transaccion(async c => {
      await this.documentoPropio(c, datos.documentoId, actor);
      if (!(await c.query('SELECT 1 FROM sigd_doc.tipo_tramite_tupa WHERE tipo_tramite_id=$1 AND vigente', [datos.procedimientoId])).rowCount) fallo('TUPA_NO_VIGENTE', 'El procedimiento no está vigente.');
      const r = await c.query(`INSERT INTO sigd_tes.tarifa(tipo_tramite_id,importe,concepto,fuente,evidencia_id,vigente_desde,vigente_hasta,creada_por)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [datos.procedimientoId, datos.importe, datos.concepto, datos.fuente, datos.documentoId, datos.vigenteDesde, datos.vigenteHasta ?? null, actor.usuario]);
      await this.repo.hecho(c,'tarifa',r.rows[0].id,actor.usuario,'TARIFA_PROPUESTA',datos.fuente); return r.rows[0];
    });
  }
  async validarTarifa(actor: ActorTesoreria, id: string, aprobar: boolean) {
    exigir(actor,'TESORERIA_TARIFA_VALIDAR');
    return this.repo.transaccion(async c => {
      const r = (await c.query('SELECT * FROM sigd_tes.tarifa WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!r) fallo('NO_ENCONTRADO','No se encontró la tarifa.',404);
      if (r.estado!=='PROPUESTA') fallo('ESTADO_INVALIDO','La tarifa ya fue evaluada.',409);
      await c.query('SELECT tipo_tramite_id FROM sigd_doc.tipo_tramite_tupa WHERE tipo_tramite_id = $1 FOR UPDATE', [r.tipo_tramite_id]);
      if (aprobar && (await c.query(`SELECT 1 FROM sigd_tes.tarifa WHERE tipo_tramite_id=$1 AND estado='VALIDADA'
        AND daterange(vigente_desde,vigente_hasta,'[]') && daterange($2::date,$3::date,'[]')`, [r.tipo_tramite_id,r.vigente_desde,r.vigente_hasta])).rowCount)
        fallo('TARIFAS_SOLAPADAS','Ya existe una tarifa validada en ese periodo.',409);
      await this.verificarAutorizacionTx(c, actor, 'TESORERIA_TARIFA_VALIDAR');
      const updated = await c.query("UPDATE sigd_tes.tarifa SET estado=$2,validada_por=$3,validada_en=now() WHERE id=$1 RETURNING *", [id, aprobar?'VALIDADA':'RECHAZADA',actor.usuario]);
      await this.repo.hecho(c,'tarifa',id,actor.usuario,aprobar?'TARIFA_VALIDADA':'TARIFA_RECHAZADA','Revisión documental independiente'); return updated.rows[0];
    });
  }
  async crearOrden(actor: ActorTesoreria, datos: z.infer<typeof ordenSchema>) {
    if (!actor.ciudadano) fallo('SOLO_CIUDADANO','La orden debe solicitarla el ciudadano titular.',403);
    if(!datos.expedienteId)fallo('RADICACION_REQUERIDA','Primero registre su solicitud y obtenga el CUT.');
    const {generarOrdenPosterior}=await import('./ordenPosterior.service.js');
    const resultado=await generarOrdenPosterior(this.repo.pool,datos.expedienteId,{usuario:actor.usuario},datos.cantidad,datos.procedimientoId);
    return {...resultado,id:resultado.ordenId};
  }
  async registrarPago(actor: ActorTesoreria, datos: z.infer<typeof pagoSchema>) {
    void actor;void datos;fallo('SOLO_EFECTIVO','Los pagos se reciben exclusivamente en la caja del Instituto. Utilice la recepción de efectivo.',422);
  }

  async revisarPago(actor: ActorTesoreria,id:string,datos:z.infer<typeof revisionPagoSchema>){
    exigir(actor,'TESORERIA_PAGO_VERIFICAR');
    return this.repo.transaccion(async c=>{
      const p=(await c.query('SELECT p.*,o.ciudadano_id FROM sigd_tes.pago p JOIN sigd_tes.orden_pago o ON o.id=p.orden_id WHERE p.id=$1 FOR UPDATE OF p,o',[id])).rows[0];
      if(!p)fallo('NO_ENCONTRADO','No se encontró el pago.',404);
      if(p.ciudadano_id===actor.usuario)fallo('SEGREGACION_FUNCIONES','No puede verificar su propia operación.',403);
      if(p.estado===datos.estado)return p;
      if(p.caja_id)fallo('PAGO_CAJA_INMUTABLE','El ingreso de caja no se anula mediante revisi?n; gestione una devoluci?n trazable.',409);
      const permitidos:Record<string,string[]>={REGISTRADO:['EN_VERIFICACION','OBSERVADO','RECHAZADO'],EN_VERIFICACION:['VERIFICADO','OBSERVADO','RECHAZADO'],OBSERVADO:['EN_VERIFICACION','RECHAZADO'],VERIFICADO:['ANULADO']};
      if(!permitidos[p.estado]?.includes(datos.estado))fallo('TRANSICION_INVALIDA','El pago no admite esa transición.');
      if(p.estado==='VERIFICADO' && ((await c.query('SELECT 1 FROM sigd_tes.aplicacion_pago WHERE orden_id=$1',[p.orden_id])).rowCount || (await c.query("SELECT 1 FROM sigd_tes.devolucion WHERE pago_id=$1 AND estado<>'RECHAZADA'",[id])).rowCount))
        fallo('PAGO_COMPROMETIDO','El pago aplicado o con devolución no puede anularse.');
      await this.verificarAutorizacionTx(c, actor, 'TESORERIA_PAGO_VERIFICAR');
      const r=await c.query(`UPDATE sigd_tes.pago SET estado=$2::varchar,verificado_por=CASE WHEN $2::varchar='VERIFICADO' THEN $3::uuid ELSE verificado_por END,
        verificado_en=CASE WHEN $2::varchar='VERIFICADO' THEN now() ELSE verificado_en END WHERE id=$1 RETURNING *`,[id,datos.estado,actor.usuario]);
      await this.repo.hecho(c,'pago',id,actor.usuario,'PAGO_'+datos.estado,datos.motivo,p.orden_id);return r.rows[0];
    });
  }
  async solicitarDevolucion(actor:ActorTesoreria,datos:z.infer<typeof devolucionSchema>){
    return this.repo.transaccion(async c=>{
      const p=(await c.query('SELECT p.*,o.ciudadano_id,o.importe,o.id orden_id,a.expediente_id FROM sigd_tes.pago p JOIN sigd_tes.orden_pago o ON o.id=p.orden_id LEFT JOIN sigd_tes.aplicacion_pago a ON a.orden_id=o.id WHERE p.id=$1 FOR UPDATE OF p,o',[datos.pagoId])).rows[0];
      if(!p||p.ciudadano_id!==actor.usuario)fallo('NO_ENCONTRADO','No se encontró una operación propia.',404);
      if(!p.expediente_id)fallo('EXPEDIENTE_REQUERIDO','La solicitud de devolución requiere el expediente y CUT asociados al pago.',409);
      const previa=(await c.query('SELECT * FROM sigd_tes.devolucion WHERE ciudadano_id=$1 AND clave_solicitud=$2',[actor.usuario,datos.claveSolicitud])).rows[0];
      if(previa){if(previa.pago_id!==datos.pagoId||previa.importe!==datos.importe||previa.sustento!==datos.sustento||previa.motivo!==datos.motivo)fallo('CLAVE_REUTILIZADA','La clave ya pertenece a otra devolución.',409);return previa;}
      if(p.estado!=='VERIFICADO')fallo('PAGO_NO_VERIFICADO','Solo un pago verificado puede generar una devolución.');
      const reservado=(await c.query("SELECT COALESCE(sum(importe),0)::numeric(14,2)::text importe FROM sigd_tes.devolucion WHERE pago_id=$1 AND estado<>'RECHAZADA'",[p.id])).rows[0].importe;
      validarSaldo(datos.importe,p.importe,reservado);
      if(datos.documentoId)await this.documentoPropio(c,datos.documentoId,actor);
      const id=randomUUID();const r=await c.query(`INSERT INTO sigd_tes.devolucion(id,codigo,pago_id,ciudadano_id,importe,motivo,sustento,documento_id,clave_solicitud)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,'DEV-'+id.toUpperCase(),p.id,actor.usuario,datos.importe,datos.motivo,datos.sustento,datos.documentoId??null,datos.claveSolicitud]);
      if(datos.documentoId)await this.foliarDocumentoDevolucion(c,id,p.expediente_id,datos.documentoId,actor.usuario,'SOLICITUD');
      await this.repo.hecho(c,'devolucion',id,actor.usuario,'DEVOLUCION_SOLICITADA',datos.sustento,p.orden_id,id);return r.rows[0];
    });
  }
  async revisarDevolucion(actor:ActorTesoreria,id:string,datos:z.infer<typeof revisionDevolucionSchema>){
    return this.repo.transaccion(async c=>{
      const d=(await c.query(`SELECT d.*,p.orden_id,o.importe total,p.estado estado_pago FROM sigd_tes.devolucion d JOIN sigd_tes.pago p ON p.id=d.pago_id
        JOIN sigd_tes.orden_pago o ON o.id=p.orden_id WHERE d.id=$1 FOR UPDATE OF d,p,o`,[id])).rows[0];
      if(!d)fallo('NO_ENCONTRADO','No se encontró la devolución.',404);
      if(d.ciudadano_id===actor.usuario)fallo('SEGREGACION_FUNCIONES','No puede evaluar, aprobar o ejecutar su propia devolución.',403);
      if(['EN_PROCESO_DEVOLUCION','DEVUELTA'].includes(datos.estado)){
        const orden=(await c.query('SELECT id FROM sigd_tes.orden_devolucion WHERE devolucion_id=$1 FOR UPDATE',[id])).rows[0];
        if(!orden)fallo('DEVOLUCION_NO_AUTORIZADA','Mesa de Partes debe aprobar la solicitud y generar una orden antes de ejecutarla.',403);
      }
      if(d.estado===datos.estado){
        if(datos.estado==='RECHAZADA'&&actor.permisos.includes('TESORERIA_DEVOLUCION_APROBAR'))return d;
        exigir(actor,['EN_PROCESO_DEVOLUCION','DEVUELTA','CERRADA'].includes(datos.estado)?'TESORERIA_DEVOLUCION_EJECUTAR':datos.estado==='APROBADA'?'TESORERIA_DEVOLUCION_APROBAR':'TESORERIA_DEVOLUCION_EVALUAR');return d;
      }
      exigir(actor,permisoTransicion(d.estado,datos.estado));
      if(datos.estado==='DEVUELTA'){
        if(d.estado_pago!=='VERIFICADO')fallo('PAGO_NO_VERIFICADO','El pago original no está verificado.');
        await new TesoreriaEfectivo(this.repo).entregar(c,actor,d,datos.confirmaEntregaEfectivo===true);
      }
      const r=await c.query(`UPDATE sigd_tes.devolucion SET estado=$2::varchar,
        evaluada_por=CASE WHEN $2::varchar='EN_EVALUACION' THEN $3::uuid ELSE evaluada_por END,
        aprobada_por=CASE WHEN $2::varchar='APROBADA' THEN $3::uuid ELSE aprobada_por END WHERE id=$1 RETURNING *`,[id,datos.estado,actor.usuario]);
      await this.repo.hecho(c,'devolucion',id,actor.usuario,'DEVOLUCION_'+datos.estado,datos.motivo,d.orden_id,id);return r.rows[0];
    });
  }
  async subsanar(actor:ActorTesoreria,ordenId:string,datos:z.infer<typeof subsanacionSchema>){
    return this.repo.transaccion(async c=>{
      const p=(await c.query('SELECT p.*,o.ciudadano_id FROM sigd_tes.pago p JOIN sigd_tes.orden_pago o ON o.id=p.orden_id WHERE o.id=$1 FOR UPDATE OF p,o',[ordenId])).rows[0];
      if(!p||p.ciudadano_id!==actor.usuario)fallo('NO_ENCONTRADO','No se encontró una operación propia.',404);
      const accion=datos.devolucionId?'DEVOLUCION_SUBSANADA':'PAGO_SUBSANADO';
      const previa=(await c.query('SELECT * FROM sigd_tes.historial WHERE id=$1',[datos.claveSolicitud])).rows[0];
      const motivo=JSON.stringify({version:1,texto:datos.motivo,documentoId:datos.documentoId});
      if(previa){
        if(previa.orden_id!==ordenId||previa.actor_id!==actor.usuario||previa.accion!==accion||previa.motivo!==motivo||(previa.devolucion_id??null)!==(datos.devolucionId??null))fallo('CLAVE_REUTILIZADA','La clave ya corresponde a otra subsanación.',409);
        return{id:previa.id};
      }
      if(datos.devolucionId){
        const d=(await c.query('SELECT * FROM sigd_tes.devolucion WHERE id=$1 AND pago_id=$2 FOR UPDATE',[datos.devolucionId,p.id])).rows[0];
        if(!d||d.ciudadano_id!==actor.usuario)fallo('NO_ENCONTRADO','No se encontró una devolución propia.',404);
        if(d.estado!=='OBSERVADA')fallo('SUBSANACION_NO_ADMITIDA','La devolución no está observada.');
      }else if(p.estado!=='OBSERVADO')fallo('SUBSANACION_NO_ADMITIDA','El pago no está observado.');
      await this.documentoPropio(c,datos.documentoId,actor);
      if(datos.devolucionId){
        const vinculo=(await c.query(`SELECT a.expediente_id FROM sigd_tes.devolucion d JOIN sigd_tes.aplicacion_pago a ON a.orden_id=p.orden_id
          WHERE d.id=$1 AND d.pago_id=p.id`,[datos.devolucionId])).rows[0];
        if(!vinculo)fallo('EXPEDIENTE_REQUERIDO','No se encontró el expediente vinculado a esta devolución.',409);
        await this.foliarDocumentoDevolucion(c,datos.devolucionId,vinculo.expediente_id,datos.documentoId,actor.usuario,'SUBSANACION');
      }
      await this.repo.hecho(c,'historial',datos.claveSolicitud,actor.usuario,accion,datos.motivo,ordenId,datos.devolucionId,{historialId:datos.claveSolicitud,documentoId:datos.documentoId});
      return{id:datos.claveSolicitud};
    });
  }
  async registroDevolucion(actor:ActorTesoreria,id:string){
    const d=(await this.repo.pool.query(`SELECT d.codigo,d.estado,d.importe::text,o.codigo orden,o.moneda,
      e.entidad,e.referencia,e.fecha_operacion,e.creada_en,e.demostracion,
      '***'||right(persona.id_documento,4) documento_enmascarado
      FROM sigd_tes.devolucion d JOIN sigd_tes.pago p ON p.id=d.pago_id
      JOIN sigd_tes.orden_pago o ON o.id=p.orden_id JOIN sigd_auth.persona persona ON persona.id_persona=o.persona_id
      JOIN sigd_tes.ejecucion_devolucion e ON e.devolucion_id=d.id
      WHERE d.id=$1 AND (o.ciudadano_id=$2 OR $3::boolean) AND d.estado IN('DEVUELTA','CERRADA')`,[id,actor.usuario,actor.permisos.includes('TESORERIA_LEER')])).rows[0];
    if(!d)fallo('NO_ENCONTRADO','No hay una ejecución registrada accesible para esta solicitud.',404);return d;
  }
  async listar(actor:ActorTesoreria,b:z.infer<typeof busquedaSchema>){
    const institucional=actor.permisos.includes('TESORERIA_LEER');if(!institucional&&!actor.ciudadano)fallo('TESORERIA_NO_AUTORIZADO','No tiene acceso a operaciones financieras.',403);
    return(await this.repo.pool.query(`SELECT o.*,t.codigo procedimiento,t.denominacion,p.id pago_id,p.estado estado_pago,p.medio,p.entidad,p.referencia,p.fecha_operacion,p.documento_id,persona.id_documento documento_solicitante,
      e.codigo_expediente cut,COALESCE(pa.pagos,'[]'::json) pagos,COALESCE(da.devoluciones,'[]'::json) devoluciones
      FROM sigd_tes.orden_pago o JOIN sigd_doc.tipo_tramite_tupa t USING(tipo_tramite_id)
      LEFT JOIN LATERAL (SELECT px.* FROM sigd_tes.pago px WHERE px.orden_id=o.id ORDER BY px.creado_en DESC,px.id DESC LIMIT 1) p ON TRUE
      LEFT JOIN LATERAL (SELECT json_agg(to_jsonb(px)||jsonb_build_object('importe_aplicado',px.importe_aplicado::text) ORDER BY px.creado_en,px.id) pagos
        FROM sigd_tes.pago px WHERE px.orden_id=o.id) pa ON TRUE
      LEFT JOIN LATERAL (SELECT json_agg(to_jsonb(d)||jsonb_build_object('importe',d.importe::text,'pago_id',d.pago_id) ORDER BY d.creada_en,d.id) devoluciones
        FROM sigd_tes.devolucion d JOIN sigd_tes.pago pd ON pd.id=d.pago_id WHERE pd.orden_id=o.id) da ON TRUE
      LEFT JOIN sigd_tes.aplicacion_pago a ON a.orden_id=o.id LEFT JOIN sigd_doc.expediente e ON e.expediente_id=a.expediente_id
      JOIN sigd_auth.persona persona ON persona.id_persona=o.persona_id
      WHERE ($1::boolean OR o.ciudadano_id=$2) AND ($3='' OR o.codigo ILIKE '%'||$3||'%' OR t.codigo ILIKE '%'||$3||'%'
        OR EXISTS(SELECT 1 FROM sigd_tes.pago ps WHERE ps.orden_id=o.id AND ps.referencia ILIKE '%'||$3||'%')
        OR e.codigo_expediente ILIKE '%'||$3||'%' OR ($1 AND (persona.id_documento=$3 OR persona.id_documento ILIKE '%'||$3||'%')))
        AND ($4::text IS NULL OR EXISTS(SELECT 1 FROM sigd_tes.pago pf WHERE pf.orden_id=o.id AND pf.estado=$4)
          OR ($4='PENDIENTE' AND NOT EXISTS(SELECT 1 FROM sigd_tes.pago pn WHERE pn.orden_id=o.id)))
      ORDER BY o.creado_en DESC,o.id LIMIT 51 OFFSET $5`,[institucional,actor.usuario,b.buscar,b.estado??null,(b.pagina-1)*50])).rows;
  }
  async detalle(actor:ActorTesoreria,id:string){
    const orden=(await this.repo.pool.query(`SELECT o.*,persona.id_documento documento_solicitante,
      COALESCE(pn.nombre_completo,pj.razon_social) nombre_solicitante,t.codigo procedimiento,t.denominacion,e.codigo_expediente cut
      FROM sigd_tes.orden_pago o JOIN sigd_auth.persona persona ON persona.id_persona=o.persona_id
      LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona=o.persona_id
      LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona=o.persona_id
      LEFT JOIN sigd_tes.aplicacion_pago a ON a.orden_id=o.id
      LEFT JOIN sigd_doc.expediente e ON e.expediente_id=a.expediente_id
      JOIN sigd_doc.tipo_tramite_tupa t ON t.tipo_tramite_id=o.tipo_tramite_id WHERE o.id=$1`,[id])).rows[0];
    if(!orden||(!actor.permisos.includes('TESORERIA_LEER')&&orden.ciudadano_id!==actor.usuario))fallo('NO_ENCONTRADO','No se encontró la operación.',404);
    const devoluciones=(await this.repo.pool.query(`SELECT d.*,e.referencia referencia_ejecucion,e.documento_id constancia_id,
      od.codigo orden_devolucion_codigo,od.aprobada_por,od.aprobada_en FROM sigd_tes.devolucion d
      LEFT JOIN sigd_tes.ejecucion_devolucion e ON e.devolucion_id=d.id
      LEFT JOIN sigd_tes.orden_devolucion od ON od.devolucion_id=d.id
      JOIN sigd_tes.pago p ON p.id=d.pago_id WHERE p.orden_id=$1 ORDER BY d.creada_en`,[id])).rows;
    const historial=(await this.repo.pool.query('SELECT * FROM sigd_tes.historial WHERE orden_id=$1 ORDER BY creado_en,id',[id])).rows;
    const anexos=historial.flatMap(h=>{const d=anexoHistorial(h.accion,h.motivo);return d?[{id:h.id,documentoId:d.documentoId,motivo:d.texto,devolucionId:h.devolucion_id,creadoEn:h.creado_en}]:[];});
    const pagos=(await this.repo.pool.query('SELECT * FROM sigd_tes.pago WHERE orden_id=$1 ORDER BY creado_en,id',[id])).rows;
    return{orden,pago:pagos.at(-1)??null,pagos,
      historial:historial.map(h=>({...h,motivo:anexoHistorial(h.accion,h.motivo)?.texto??h.motivo})),anexos,
      devoluciones:devoluciones.map(d=>({...d,acciones:['EN_EVALUACION','OBSERVADA','PENDIENTE_APROBACION','APROBADA','RECHAZADA','EN_PROCESO_DEVOLUCION','DEVUELTA','CERRADA'].filter(s=>{
        if(d.ciudadano_id===actor.usuario)return false;
        try{const p=permisoTransicion(d.estado,s);if(!actor.permisos.includes(p))return false;
          return true;
        }catch{return false;}
      })}))};
  }
}

import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { ejecutarMigraciones } from '../../src/db/migrate.js';
import { registrarActuacion, derivarExpediente, atenderExpediente, archivarExpediente } from '../../src/domains/rutadoc/derivaciones.service.js';
import { crearContexto, runWithContext } from '../../src/shared/request-context/request-context.js';
import { RepositorioPostgresRutaDoc } from '../../src/domains/rutadoc/rutadoc.repository.js';
import { RepositorioPostgresFoliacionRutaDoc } from '../../src/domains/rutadoc/foliacion.repository.js';
import { RepositorioPostgresTrazabilidadRutaDoc } from '../../src/domains/rutadoc/trazabilidad.repository.js';
import { VentanillaPresencialService } from '../../src/domains/tramicore/ventanillaPresencial.service.js';
import { FolioCompensationPostgres, prepararCompensacionPendiente } from '../../src/domains/rutadoc/rutadoc.folio-compensation.js';
import { RepositorioReversionRutaDoc } from '../../src/domains/rutadoc/rutadoc.reversion.repository.js';
import { obtenerConfiguracionS3 } from '../../src/config/s3.config.js';
import { generarUrlPresigned, headObject } from '../../src/core/storage/s3-storage.service.js';
import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';

const url = process.env.DATABASE_URL!;
assert.match(new URL(url).pathname, /validacion|test/, 'Use una base de pruebas separada');
const pool = new Pool({ connectionString: url });
try {
  await ejecutarMigraciones(pool);
  assert.equal((await ejecutarMigraciones(pool)).length, 0, 'Reejecucion idempotente');
  const cliente = await pool.connect();
  const id = randomUUID(), usuario = randomUUID(), area = randomUUID();
  const ctx = crearContexto({ usuario_id: usuario, unidad_organica_id: area });
  const contador = (await pool.query("SELECT cantidad FROM sigd_rut.contador_pestana_local WHERE pestana = 'PENDIENTES'")).rows[0].cantidad;
  try {
    await cliente.query('BEGIN');
    await cliente.query(`INSERT INTO sigd_org.area (area_id, codigo, nombre) VALUES ($1,$2,'Area de validacion')`, [area, 'TEST-' + area.slice(0,8)]);
    const ventanilla = await new VentanillaPresencialService(pool).registrarExpedienteVentanilla({
      dniSolicitante: String(10000000 + Math.floor(Math.random()*80000000)), datosRemitente: 'Validacion Local',
      asunto: 'Solicitud de validacion real', foliosTotales: 3, areaDestinoId: area,
    }, cliente);
    const expediente = ventanilla.expedienteId;
    assert.match(expediente, /^[0-9a-f-]{36}$/);
    assert.match(ventanilla.cut, /^EXP-\d{4}-\d{6}$/);
    const repo = new RepositorioPostgresRutaDoc(cliente as unknown as Pool);
    assert.equal((await repo.obtener(expediente))?.asunto, 'Solicitud de validacion real');
    const listado = await repo.listar({pestana:'PENDIENTES',limite:20}, ['REGISTRADO','RECEPCIONADO','EN_CALIFICACION'], null);
    assert.ok(listado.elementos.some(e=>e.idExpediente===expediente));
    const filtro = await cliente.query(`SELECT COUNT(*)::int AS n FROM sigd_tra.expediente WHERE expediente_id=$1`,[expediente]);
    assert.equal(filtro.rows[0].n, 1);
    await runWithContext(ctx, async () => {
      await registrarActuacion(cliente, expediente, 'RECEPCION', {}, 'Validacion');
      await registrarActuacion(cliente, expediente, 'INICIAR_CALIFICACION', {}, 'Validacion');
      await derivarExpediente(cliente, expediente, { destinos:[{area_destino_id:area,es_copia:false}],proveido:'Validacion del contrato' });
    });
    assert.equal((await repo.obtener(expediente))?.estadoActual, 'DERIVADO');
    const historial = await new RepositorioPostgresTrazabilidadRutaDoc(cliente as unknown as Pool).listar(expediente);
    assert.equal(historial.length, 3);
    assert.deepEqual((await cliente.query('SELECT secuencia::text FROM sigd_rut.movimiento_tramite WHERE expediente_id=$1 ORDER BY secuencia',[expediente])).rows.map(r=>r.secuencia), ['1','2','3']);
    await cliente.query('SAVEPOINT transicion_invalida');
    await assert.rejects(cliente.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id,estado_anterior,evento,estado_nuevo,usuario_operador_id)
      VALUES ($1,'DERIVADO','CIERRE','ARCHIVADO',$2)`,[expediente,usuario]),{code:'23503'});
    await cliente.query('ROLLBACK TO SAVEPOINT transicion_invalida');
    await cliente.query('SELECT sigd_tra.agregar_folio_expediente($1,$2,3,$3)',[expediente,id,usuario]);
    const folios = await new RepositorioPostgresFoliacionRutaDoc(cliente as unknown as Pool).listar(expediente);
    assert.deepEqual(folios.map(f=>[f.folioInicio,f.folioFin,f.cantidadFolios]),[[1,3,3]]);
    assert.equal((await repo.obtener(expediente))?.resumenDocumentos?.totalFolios,3);
    await cliente.query('SAVEPOINT folios_invalidos');
    await assert.rejects(cliente.query(`INSERT INTO sigd_tra.expediente_documento_folio
      (expediente_id,id_documento,folio_inicio,folio_fin) VALUES ($1,$2,5,6)`,[expediente,randomUUID()]),{code:'23514'});
    await cliente.query('ROLLBACK TO SAVEPOINT folios_invalidos');
    const reversion = new RepositorioReversionRutaDoc(pool);
    const objetivo = (await reversion.objetivo(cliente, expediente, '3'))!;
    const compensacionFolios = prepararCompensacionPendiente(objetivo);
    const clave = randomUUID();
    const compensacion = await reversion.insertar(cliente, {objetivo,usuarioOperadorId:usuario,
      motivo:'Reversion de validacion local',claveIdempotencia:clave,huellaComando:'local-test',
      correlationId:ctx.correlation_id,compensacionFolios});
    await runWithContext(ctx, () => new FolioCompensationPostgres().solicitar(cliente, {
      expedienteId:expediente,movimientoOriginal:objetivo,movimientoCompensatorioId:compensacion.id_movimiento,
      rangoAfectado:null,motivo:'Reversion de validacion local',actor:{id:usuario,roles:['SUPER_ADMIN']},
      correlationId:ctx.correlation_id,claveIdempotencia:clave,referencia:compensacionFolios.referencia!,
    }));
    assert.equal((await repo.obtener(expediente))?.estadoActual,'EN_CALIFICACION');
    await cliente.query('SAVEPOINT inmutable');
    await assert.rejects(cliente.query('UPDATE sigd_rut.movimiento_compensatorio SET motivo=$1 WHERE id_movimiento=$2', ['Cambio rechazado',compensacion.id_movimiento]), {code:'23001'});
    await cliente.query('ROLLBACK TO SAVEPOINT inmutable');
    await runWithContext(ctx, async () => {
      for (const evento of ['INICIAR_REVISION','OBSERVACION','CORRECCION','INICIAR_REVISION','ENVIAR_A_FIRMA'] as const)
        await registrarActuacion(cliente,expediente,evento,{},'Validacion');
      await atenderExpediente(cliente,expediente,{resultado_resumen:'Atencion real de validacion'});
      await archivarExpediente(cliente,expediente,{estante:'A',balda:'1',caja:'1'});
    });
    assert.equal((await repo.obtener(expediente))?.estadoActual,'ARCHIVADO');
    console.log('PASS: compensacion UUID, solicitud de folios, inmutabilidad, observacion, subsanacion, atencion y archivo');
    await cliente.query('ROLLBACK');
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM sigd_tra.expediente WHERE expediente_id=$1',[expediente])).rows[0].n,0);
    assert.equal((await pool.query("SELECT cantidad FROM sigd_rut.contador_pestana_local WHERE pestana='PENDIENTES'")).rows[0].cantidad,contador);
    console.log('PASS: ventanilla UUID, bandeja, detalle, derivacion, trazabilidad, secuencias, FSM, folios y rollback real');
  } finally { await cliente.query('ROLLBACK'); cliente.release(); }
  const config = obtenerConfiguracionS3();
  const s3 = new S3Client({endpoint:config.endpoint,region:config.region,forcePathStyle:true,credentials:{accessKeyId:config.accessKey,secretAccessKey:config.secretKey}});
  try { await s3.send(new HeadBucketCommand({Bucket:config.bucket})); }
  catch (error) { if((error as { $metadata?: {httpStatusCode?:number} }).$metadata?.httpStatusCode!==404) throw error; await s3.send(new CreateBucketCommand({Bucket:config.bucket})); }
  const key = 'validacion/local-' + randomUUID() + '.pdf';
  const contenido = Buffer.from('%PDF-1.4\nSIGD local S3 verification\n%%EOF');
  const put = await fetch(generarUrlPresigned(key,config,{metodo:'PUT',contentType:'application/pdf'}), {method:'PUT',headers:{'content-type':'application/pdf'},body:contenido});
  assert.equal(put.ok,true, await put.text());
  const get = await fetch(generarUrlPresigned(key,config,{metodo:'GET'}));
  assert.equal(get.ok,true);
  const recibido = Buffer.from(await get.arrayBuffer());
  assert.equal(createHash('sha256').update(recibido).digest('hex'),createHash('sha256').update(contenido).digest('hex'));
  assert.equal((await headObject(key,config)).contentLength,contenido.length);
  console.log('PASS: S3 PUT/GET/HEAD firmados y SHA-256 real. Objeto persistente:',key);
  s3.destroy();
} finally { await pool.end(); }

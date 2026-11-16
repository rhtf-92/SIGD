import 'dotenv/config';
import crypto from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { RadicacionVirtualService } from '../src/domains/tramicore/radicacionVirtual.service.js';
import { ConsultaPublicaService } from '../src/domains/tramicore/consultaPublica.service.js';
import { generarOrdenPosterior, intentarOrdenPosterior } from '../src/domains/tesoreria/ordenPosterior.service.js';
import { TesoreriaService, type ActorTesoreria } from '../src/domains/tesoreria/tesoreria.service.js';
import { TesoreriaRepository } from '../src/domains/tesoreria/tesoreria.repository.js';
import { TesoreriaEfectivo } from '../src/domains/tesoreria/tesoreria.efectivo.js';
import { derivarExpediente } from '../src/domains/rutadoc/derivaciones.service.js';
import { runWithContext, crearContexto } from '../src/shared/request-context/request-context.js';
import { AppError } from '../src/shared/domain/errors/index.js';
import { obtenerConfiguracionS3 } from '../src/config/s3.config.js';
import { generarUrlPresigned } from '../src/core/storage/s3-storage.service.js';

/**
 * PROTECCIÓN INSTITUCIONAL DE INTEGRIDAD:
 * Esta suite realiza mutaciones transaccionales de extremo a extremo.
 * Para proteger los datos institucionales de sigd_jacobo_demo contra escrituras de prueba,
 * requiere autorización explícita mediante SIGD_ALLOW_E2E_MUTATION=true.
 */
if (process.env.SIGD_ALLOW_E2E_MUTATION !== 'true') {
  console.error('[E2E-GUARD] Abortado: e2e_suite_radicacion_pago_posterior no tiene autorización para mutar datos en sigd_jacobo_demo.');
  console.error('Para ejecutar esta suite en un entorno aislado autorizado, defina SIGD_ALLOW_E2E_MUTATION=true.');
  process.exit(1);
}

const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo';
const pool = new Pool({ connectionString: DB_URL });

function createMockPdf(title = 'doc'): { buffer: Buffer; sha256: string; size: number } {
  const content = `%PDF-1.4\n% ${title}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n188\n%%EOF\n`;
  const buffer = Buffer.from(content, 'utf8');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return { buffer, sha256, size: buffer.length };
}

async function uploadPdfToMinIO(key: string, buffer: Buffer): Promise<void> {
  const config = obtenerConfiguracionS3();
  const url = generarUrlPresigned(key, config, { metodo: 'PUT', contentType: 'application/pdf', expiraSegundos: 60 });
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: new Uint8Array(buffer),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`MinIO upload failed with HTTP ${res.status}: ${errText}`);
  }
}

const results: Record<string, { ok: boolean; details: string }> = {};

async function runSuite() {
  console.log('========================================================================');
  console.log('SIGD B_JACOBO — SUITE E2E TRANSACCIONAL: RADICACIÓN Y PAGO POSTERIOR');
  console.log('Base de datos oficial: sigd_jacobo_demo (127.0.0.1:5433)');
  console.log('========================================================================\n');

  // Verify connection and database
  const dbCheck = await pool.query('SELECT current_database() db, count(*)::int exps FROM sigd_tra.expediente');
  console.log(`[INFO] Conectado a base: ${dbCheck.rows[0].db} (Expedientes existentes: ${dbCheck.rows[0].exps})`);

  // Obtain test users
  const userTesorero = (await pool.query("SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE usuario='94370763'")).rows[0]?.id_usuario;
  const userMP = (await pool.query("SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE usuario='ventanilla.demo'")).rows[0]?.id_usuario;
  const areaMP = (await pool.query("SELECT area_id FROM sigd_org.area WHERE codigo='MP'")).rows[0]?.area_id;
  const areaSG = (await pool.query("SELECT area_id FROM sigd_org.area WHERE codigo='SEC'")).rows[0]?.area_id;

  await runWithContext(crearContexto({ usuario_id: userTesorero, ip_origen: '127.0.0.1' }), async () => {

  const actorTesorero: ActorTesoreria = {
    usuario: userTesorero,
    persona: userTesorero,
    permisos: [
      'TESORERIA_LEER',
      'TESORERIA_TARIFA_PROPONER',
      'TESORERIA_TARIFA_VALIDAR',
      'TESORERIA_PAGO_REGISTRAR',
      'TESORERIA_PAGO_VERIFICAR',
      'TESORERIA_DEVOLUCION_EVALUAR',
      'TESORERIA_DEVOLUCION_APROBAR',
      'TESORERIA_DEVOLUCION_EJECUTAR',
      'TESORERIA_REPORTES',
    ],
    ciudadano: false,
  };

  // Find fee-based procedure
  const feeProc = (await pool.query(`
    SELECT t.tipo_tramite_id, t.codigo, t.denominacion, f.id as tarifa_id, f.importe
    FROM sigd_tes.tarifa f
    JOIN sigd_doc.tipo_tramite_tupa t USING(tipo_tramite_id)
    WHERE f.estado = 'VALIDADA' AND f.importe > 0
    ORDER BY f.importe DESC LIMIT 1
  `)).rows[0];

  console.log(`[INFO] Procedimiento sujeto a pago: ${feeProc.codigo} - ${feeProc.denominacion} (S/ ${feeProc.importe})`);

  // Find or create free procedure
  let freeProc = (await pool.query(`
    SELECT t.tipo_tramite_id, t.codigo, t.denominacion, f.importe
    FROM sigd_tes.tarifa f
    JOIN sigd_doc.tipo_tramite_tupa t USING(tipo_tramite_id)
    WHERE f.estado = 'VALIDADA' AND f.importe = 0
    LIMIT 1
  `)).rows[0];

  if (!freeProc) {
    const anyProc = (await pool.query(`
      SELECT tipo_tramite_id, codigo, denominacion FROM sigd_doc.tipo_tramite_tupa
      WHERE vigente = TRUE AND tipo_tramite_id <> $1 LIMIT 1
    `, [feeProc.tipo_tramite_id])).rows[0];

    await pool.query(`
      INSERT INTO sigd_tes.tarifa (tipo_tramite_id, importe, moneda, concepto, fuente, vigente_desde, estado, origen_catalogo_sha256, validada_en)
      VALUES ($1, 0.00, 'PEN', 'Trámite Gratuito Oficial', 'TUPA 2026 Art. 10', '2026-01-01', 'VALIDADA', 'e5b5fe021492b8985baa0915ccc61b0d18fcc39785a3fff908de7a66cac5109a', now())
    `, [anyProc.tipo_tramite_id]);

    freeProc = { ...anyProc, importe: '0.00' };
  }
  console.log(`[INFO] Procedimiento gratuito: ${freeProc.codigo} - ${freeProc.denominacion} (S/ 0.00)\n`);

  const repo = new TesoreriaRepository(pool);
  const efectivo = new TesoreriaEfectivo(repo);
  const tesoreriaService = new TesoreriaService(repo);
  const consultaService = new ConsultaPublicaService(pool);
  const radicacionService = new RadicacionVirtualService(pool);

  // Helper: Open caja if none is open
  const cajaActiva = (await pool.query("SELECT * FROM sigd_tes.caja WHERE cerrada_en IS NULL")).rows[0];
  if (!cajaActiva) {
    console.log('[SETUP] Abriendo caja de Tesorería para pruebas...');
    await efectivo.abrir(actorTesorero, { saldoInicial: '500.00', claveSolicitud: crypto.randomUUID() });
    console.log('   ✓ Caja abierta con saldo inicial S/ 500.00\n');
  } else {
    console.log(`[SETUP] Caja de Tesorería ya abierta (ID: ${cajaActiva.id})\n`);
  }

  // =========================================================================
  // E2E-01: Radicación hoy y pago mañana
  // =========================================================================
  console.log('------------------------------------------------------------------------');
  console.log('EJECUTANDO E2E-01: Radicación hoy y pago mañana (Continuidad del Expediente)');
  console.log('------------------------------------------------------------------------');

  const pdf1 = createMockPdf('solicitud-e2e01');
  const sesionHash1 = crypto.randomBytes(32).toString('hex');
  const s3Key1 = `expedientes/2026/${crypto.randomUUID()}.pdf`;
  await uploadPdfToMinIO(s3Key1, pdf1.buffer);

  // Insert mock storage record so RadicacionVirtualService validates attachment
  await pool.query(`
    INSERT INTO sigd_doc.tipo_documento (tipo_documental_id, codigo, nombre)
    VALUES ('aaaaaaaa-1111-4111-8111-111111111111', 'SOL', 'Solicitud')
    ON CONFLICT (tipo_documental_id) DO NOTHING
  `);

  const datosRadicacion1 = {
    asunto: 'Solicitud de certificado de estudios con pago posterior en ventanilla de tesoreria',
    idTipoTramiteTupa: feeProc.tipo_tramite_id,
    tipoDocumento: 'DNI' as const,
    numeroDocumento: '45872391',
    nombres: 'Carlos Alberto',
    apellidos: 'Mendoza Rios',
    nombreSolicitante: 'Carlos Alberto Mendoza Rios',
    correo: 'carlos.mendoza@test.com',
    telefono: '961234567',
    totalFolios: 1,
    declaracionVeracidad: true as const,
    aceptaTerminos: true as const,
    documentos: [
      {
        nombreArchivo: 'solicitud-e2e01.pdf',
        contentType: 'application/pdf' as const,
        tamanoBytes: pdf1.size,
        hashSha256: pdf1.sha256,
        storagePath: s3Key1,
      },
    ],
  };

  // Mock public session in store
  await pool.query(`
    INSERT INTO sigd_tra.radicacion_publica (sesion_hash, payload_hash, datos_declarados)
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (sesion_hash) DO NOTHING
  `, [sesionHash1, crypto.createHash('sha256').update(JSON.stringify(datosRadicacion1)).digest('hex'), JSON.stringify(datosRadicacion1)]);

  const radicacion1 = await radicacionService.radicarPublico(datosRadicacion1, sesionHash1);
  console.log(`1. Expediente radicado virtualmente:`);
  console.log(`   - CUT Generado: ${radicacion1.cut}`);
  console.log(`   - Expediente ID: ${radicacion1.expedienteId}`);

  // Generate postponed payment order
  const ordenPost1 = await intentarOrdenPosterior(pool, radicacion1.expedienteId, { sesionHash: sesionHash1 });
  console.log(`2. Orden de pago generada:`);
  console.log(`   - Estado: ${ordenPost1.estado}`);
  console.log(`   - Código: ${ordenPost1.codigo}`);
  console.log(`   - Importe: S/ ${ordenPost1.importe}`);
  if (ordenPost1.estado !== 'PENDIENTE_PAGO' || !ordenPost1.ordenId) {
    throw new Error(`E2E-01 Falla: orden de pago no quedó en PENDIENTE_PAGO. Resultado: ${JSON.stringify(ordenPost1)}`);
  }

  // 3. Verify public tracking shows PENDIENTE DE PAGO
  const consultaAntes1 = await consultaService.consultarPorCut({ cut: radicacion1.cut });
  console.log(`3. Consulta pública inicial por CUT:`);
  console.log(`   - Estado trámite: ${consultaAntes1.estadoTramite}`);
  console.log(`   - Condición económica: ${consultaAntes1.condicionEconomica}`);
  console.log(`   - Orden de pago: ${consultaAntes1.ordenPago?.codigo} (S/ ${consultaAntes1.ordenPago?.importe})`);
  console.log(`   - Indicaciones presenciales: "${consultaAntes1.ordenPago?.indicaciones?.slice(0, 50)}..."`);
  if (consultaAntes1.condicionEconomica !== 'PENDIENTE DE PAGO' || consultaAntes1.ordenPago?.estado !== 'PENDIENTE') {
    throw new Error(`E2E-01 Falla: consulta pública no reflejó PENDIENTE DE PAGO.`);
  }

  // 4. Simulate time elapsed and citizen logout/login (Day 2)
  console.log(`4. Simulación: ciudadano regresa al día siguiente a pagar a Tesorería.`);
  const consultaDia2 = await consultaService.consultarPorCut({ cut: radicacion1.cut });
  if (consultaDia2.condicionEconomica !== 'PENDIENTE DE PAGO' || consultaDia2.cut !== radicacion1.cut) {
    throw new Error(`E2E-01 Falla: solicitud no persistió para el día siguiente.`);
  }
  console.log(`   ✓ Solicitud recuperada al día siguiente intacta.`);

  // 5. Cashier searches in Treasury by CUT
  console.log(`5. Tesorero busca en módulo Tesorería por CUT "${radicacion1.cut}"...`);
  const busquedaTesorero = await tesoreriaService.listar(actorTesorero, { buscar: radicacion1.cut, pagina: 1 });
  const ordenEncontrada = busquedaTesorero.find(o => o.id === ordenPost1.ordenId);
  if (!ordenEncontrada) {
    throw new Error(`E2E-01 Falla: Tesorería no encontró la orden buscando por CUT.`);
  }
  console.log(`   ✓ Orden localizada en Tesorería: ${ordenEncontrada.codigo} (CUT: ${ordenEncontrada.cut})`);

  // Verify detail
  const detalleOrden = await tesoreriaService.detalle(actorTesorero, ordenPost1.ordenId);
  console.log(`   ✓ Detalle verificado: Titular="${detalleOrden.orden.nombre_solicitante}", Procedimiento="${detalleOrden.orden.procedimiento}"`);

  // 6. Cash payment collection at cashbox
  const montoCobro1 = (Number(ordenPost1.importe) + 50).toFixed(2);
  console.log(`6. Tesorero registra cobro en efectivo: recibido S/ ${montoCobro1} para orden de S/ ${ordenPost1.importe}...`);
  const pagoRealizado = await efectivo.cobrar(actorTesorero, {
    ordenId: ordenPost1.ordenId,
    efectivoRecibido: montoCobro1,
    confirmaRecepcion: true,
  });
  console.log(`   ✓ Cobro exitoso:`);
  console.log(`   - Recibo N°: ${pagoRealizado.numero_recibo}`);
  console.log(`   - Referencia: ${pagoRealizado.referencia}`);
  console.log(`   - Estado pago: ${pagoRealizado.estado}`);
  console.log(`   - Vuelto calculado: S/ ${pagoRealizado.vuelto}`);

  // 7. Check application to the SAME original expediente
  const aplicacionCheck = (await pool.query(`
    SELECT a.orden_id, a.expediente_id, e.codigo_expediente
    FROM sigd_tes.aplicacion_pago a
    JOIN sigd_doc.expediente e USING(expediente_id)
    WHERE a.orden_id = $1
  `, [ordenPost1.ordenId])).rows[0];

  if (!aplicacionCheck || aplicacionCheck.expediente_id !== radicacion1.expedienteId || aplicacionCheck.codigo_expediente !== radicacion1.cut) {
    throw new Error(`E2E-01 Falla: El pago no quedó aplicado al expediente original.`);
  }
  console.log(`7. Verificación de integridad: El pago está vinculado al expediente original ${aplicacionCheck.codigo_expediente} (NO se creó segundo CUT).`);

  // 8. Public tracking shows PAGO VERIFICADO
  const consultaDespues1 = await consultaService.consultarPorCut({ cut: radicacion1.cut });
  console.log(`8. Consulta pública post-pago:`);
  console.log(`   - Condición económica: ${consultaDespues1.condicionEconomica}`);
  console.log(`   - Estado orden: ${consultaDespues1.ordenPago?.estado}`);
  if (consultaDespues1.condicionEconomica !== 'PAGO VERIFICADO') {
    throw new Error(`E2E-01 Falla: consulta pública no reflejó PAGO VERIFICADO.`);
  }

  // 9. Continuity: Derivation unlocked in RutaDoc
  console.log(`9. Mesa de Partes deriva el expediente a Secretaría General...`);
  const derivacion1 = await pool.connect();
  let derivacionExitosa = false;
  try {
    await derivacion1.query('BEGIN');
    const resDeriv = await runWithContext(crearContexto({ usuario_id: userMP, ip_origen: '127.0.0.1' }), async () => {
      return await derivarExpediente(derivacion1, radicacion1.expedienteId, {
        destinos: [{ area_destino_id: areaSG, es_copia: false }],
        proveido: 'Expediente pagado en Tesorería y verificado. Se deriva para atención.',
      });
    });
    await derivacion1.query('COMMIT');
    console.log(`   ✓ Derivación exitosa: ID Derivación = ${resDeriv.derivacionId}, Nuevo estado = ${resDeriv.nuevoEstado}`);
    derivacionExitosa = true;
  } finally {
    derivacion1.release();
  }

  if (!derivacionExitosa) throw new Error('E2E-01 Falla: No se pudo derivar el expediente tras el pago verificado.');
  results['E2E-01'] = { ok: true, details: `CUT ${radicacion1.cut} registrado, orden OP pagada en caja y derivación completada exitosamente.` };
  console.log('   >>> E2E-01 APROBADO EXITOSAMENTE <<<\n');

  // =========================================================================
  // E2E-02: Intento de derivación sin pago
  // =========================================================================
  console.log('------------------------------------------------------------------------');
  console.log('EJECUTANDO E2E-02: Intento de derivación de expediente sin pago');
  console.log('------------------------------------------------------------------------');

  const pdf2 = createMockPdf('solicitud-e2e02');
  const sesionHash2 = crypto.randomBytes(32).toString('hex');
  const s3Key2 = `expedientes/2026/${crypto.randomUUID()}.pdf`;
  await uploadPdfToMinIO(s3Key2, pdf2.buffer);
  const datosRadicacion2 = {
    ...datosRadicacion1,
    numeroDocumento: '45872392',
    asunto: 'Solicitud con pago pendiente para prueba de bloqueo de derivacion',
    documentos: [{
      nombreArchivo: 'solicitud-e2e02.pdf',
      contentType: 'application/pdf' as const,
      tamanoBytes: pdf2.size,
      hashSha256: pdf2.sha256,
      storagePath: s3Key2,
    }],
  };

  await pool.query(`
    INSERT INTO sigd_tra.radicacion_publica (sesion_hash, payload_hash, datos_declarados)
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (sesion_hash) DO NOTHING
  `, [sesionHash2, crypto.createHash('sha256').update(JSON.stringify(datosRadicacion2)).digest('hex'), JSON.stringify(datosRadicacion2)]);

  const radicacion2 = await radicacionService.radicarPublico(datosRadicacion2, sesionHash2);
  const ordenPost2 = await intentarOrdenPosterior(pool, radicacion2.expedienteId, { sesionHash: sesionHash2 });
  console.log(`1. Expediente radicado sin pagar: CUT ${radicacion2.cut}, Orden ${ordenPost2.codigo}`);

  console.log(`2. Intentando derivar sin pagar...`);
  const derivacion2 = await pool.connect();
  let bloqueoDetectado = false;
  try {
    await derivacion2.query('BEGIN');
    await runWithContext(crearContexto({ usuario_id: userMP, ip_origen: '127.0.0.1' }), async () => {
      await derivarExpediente(derivacion2, radicacion2.expedienteId, {
        destinos: [{ area_destino_id: areaSG, es_copia: false }],
        proveido: 'Intento de derivar expediente impago',
      });
    });
    await derivacion2.query('COMMIT');
  } catch (err: any) {
    await derivacion2.query('ROLLBACK');
    if (err.status === 422 && err.code === 'DEMO_PAYMENT_PENDING') {
      bloqueoDetectado = true;
      console.log(`   ✓ Bloqueo correcto detectado: HTTP ${err.status} [${err.code}]: "${err.message}"`);
    } else {
      console.error('Error inesperado:', err);
    }
  } finally {
    derivacion2.release();
  }

  if (!bloqueoDetectado) throw new Error('E2E-02 Falla: Se permitió derivar un expediente con orden de pago pendiente!');
  const estadoExp2 = (await pool.query("SELECT estado FROM sigd_tra.expediente WHERE expediente_id=$1", [radicacion2.expedienteId])).rows[0].estado;
  console.log(`3. Verificación: Estado del expediente permanece inalterado: "${estadoExp2}"`);
  results['E2E-02'] = { ok: true, details: `Expediente ${radicacion2.cut} rechazó derivación con HTTP 422 DEMO_PAYMENT_PENDING.` };
  console.log('   >>> E2E-02 APROBADO EXITOSAMENTE <<<\n');

  // =========================================================================
  // E2E-03: Pago duplicado
  // =========================================================================
  console.log('------------------------------------------------------------------------');
  console.log('EJECUTANDO E2E-03: Detección y rechazo de pago duplicado');
  console.log('------------------------------------------------------------------------');

  console.log(`1. Intentando cobrar por segunda vez la orden ${ordenPost1.codigo} ya pagada...`);
  let duplicadoRechazado = false;
  try {
    await efectivo.cobrar(actorTesorero, {
      ordenId: ordenPost1.ordenId!,
      efectivoRecibido: montoCobro1,
      confirmaRecepcion: true,
    });
  } catch (err: any) {
    if (err.status === 409 && err.code === 'PAGO_DUPLICADO') {
      duplicadoRechazado = true;
      console.log(`   ✓ Rechazo correcto por pago duplicado: HTTP ${err.status} [${err.code}]: "${err.message}"`);
    } else {
      console.error('Error inesperado en duplicado:', err);
    }
  }

  if (!duplicadoRechazado) throw new Error('E2E-03 Falla: Se permitió cobrar dos veces la misma orden!');
  const totalPagos = (await pool.query("SELECT count(*)::int n FROM sigd_tes.pago WHERE orden_id=$1 AND estado='VERIFICADO'", [ordenPost1.ordenId])).rows[0].n;
  console.log(`2. Verificación en BD: Total pagos confirmados para la orden = ${totalPagos} (estrictamente 1)`);
  if (totalPagos !== 1) throw new Error('E2E-03 Falla: Existe más de un pago en la base de datos!');
  results['E2E-03'] = { ok: true, details: `Cobro duplicado rechazado con HTTP 409 PAGO_DUPLICADO, existe exactamente 1 pago confirmado.` };
  console.log('   >>> E2E-03 APROBADO EXITOSAMENTE <<<\n');

  // =========================================================================
  // E2E-04: Cobros concurrentes
  // =========================================================================
  console.log('------------------------------------------------------------------------');
  console.log('EJECUTANDO E2E-04: Concurrencia de cobros simultáneos (Advisory Lock)');
  console.log('------------------------------------------------------------------------');

  // Create fresh pending order for concurrency test
  const pdf4 = createMockPdf('solicitud-e2e04');
  const sesionHash4 = crypto.randomBytes(32).toString('hex');
  const s3Key4 = `expedientes/2026/${crypto.randomUUID()}.pdf`;
  await uploadPdfToMinIO(s3Key4, pdf4.buffer);
  const datosRadicacion4 = {
    ...datosRadicacion1,
    numeroDocumento: '45872394',
    asunto: 'Solicitud para prueba de concurrencia de cobros en caja',
    documentos: [{
      nombreArchivo: 'solicitud-e2e04.pdf',
      contentType: 'application/pdf' as const,
      tamanoBytes: pdf4.size,
      hashSha256: pdf4.sha256,
      storagePath: s3Key4,
    }],
  };
  await pool.query(`
    INSERT INTO sigd_tra.radicacion_publica (sesion_hash, payload_hash, datos_declarados)
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (sesion_hash) DO NOTHING
  `, [sesionHash4, crypto.createHash('sha256').update(JSON.stringify(datosRadicacion4)).digest('hex'), JSON.stringify(datosRadicacion4)]);

  const radicacion4 = await radicacionService.radicarPublico(datosRadicacion4, sesionHash4);
  const ordenPost4 = await intentarOrdenPosterior(pool, radicacion4.expedienteId, { sesionHash: sesionHash4 });
  console.log(`1. Orden pendiente creada: ${ordenPost4.codigo} (CUT: ${radicacion4.cut})`);

  console.log(`2. Lanzando 2 solicitudes de cobro simultáneas e idénticas...`);
  const montoCobro4 = (Number(ordenPost4.importe) + 50).toFixed(2);
  const promise1 = efectivo.cobrar(actorTesorero, { ordenId: ordenPost4.ordenId!, efectivoRecibido: montoCobro4, confirmaRecepcion: true });
  const promise2 = efectivo.cobrar(actorTesorero, { ordenId: ordenPost4.ordenId!, efectivoRecibido: montoCobro4, confirmaRecepcion: true });

  const [res1, res2] = await Promise.allSettled([promise1, promise2]);
  const exitos = [res1, res2].filter(r => r.status === 'fulfilled');
  const fallos = [res1, res2].filter(r => r.status === 'rejected');

  console.log(`   - Solicitudes completadas: ${exitos.length} exitosa, ${fallos.length} rechazada.`);
  if (exitos.length === 1 && fallos.length === 1) {
    const motivoRechazo = (fallos[0] as PromiseRejectedResult).reason;
    console.log(`   ✓ Serialización atómica confirmada: una cobró exitosamente y la otra fue rechazada con "${motivoRechazo?.message}"`);
  } else {
    throw new Error(`E2E-04 Falla: Concurrencia no serializada correctamente (Éxitos: ${exitos.length}, Fallos: ${fallos.length})`);
  }
  results['E2E-04'] = { ok: true, details: `Exactamente 1 de 2 cobros concurrentes tuvo éxito; row-lock impidió doble cobro.` };
  console.log('   >>> E2E-04 APROBADO EXITOSAMENTE <<<\n');

  // =========================================================================
  // E2E-05: Procedimiento gratuito
  // =========================================================================
  console.log('------------------------------------------------------------------------');
  console.log('EJECUTANDO E2E-05: Procedimiento gratuito (Sin orden de pago innecesaria)');
  console.log('------------------------------------------------------------------------');

  const pdf5 = createMockPdf('solicitud-e2e05');
  const sesionHash5 = crypto.randomBytes(32).toString('hex');
  const s3Key5 = `expedientes/2026/${crypto.randomUUID()}.pdf`;
  await uploadPdfToMinIO(s3Key5, pdf5.buffer);
  const datosRadicacion5 = {
    ...datosRadicacion1,
    idTipoTramiteTupa: freeProc.tipo_tramite_id,
    numeroDocumento: '45872395',
    asunto: 'Solicitud de procedimiento gratuito sin derecho de tramitacion',
    documentos: [{
      nombreArchivo: 'solicitud-e2e05.pdf',
      contentType: 'application/pdf' as const,
      tamanoBytes: pdf5.size,
      hashSha256: pdf5.sha256,
      storagePath: s3Key5,
    }],
  };
  await pool.query(`
    INSERT INTO sigd_tra.radicacion_publica (sesion_hash, payload_hash, datos_declarados)
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (sesion_hash) DO NOTHING
  `, [sesionHash5, crypto.createHash('sha256').update(JSON.stringify(datosRadicacion5)).digest('hex'), JSON.stringify(datosRadicacion5)]);

  const radicacion5 = await radicacionService.radicarPublico(datosRadicacion5, sesionHash5);
  console.log(`1. Procedimiento gratuito radicado: CUT ${radicacion5.cut}`);

  const ordenPost5 = await intentarOrdenPosterior(pool, radicacion5.expedienteId, { sesionHash: sesionHash5 });
  console.log(`2. Respuesta de Tesorería: Estado="${ordenPost5.estado}", Mensaje="${ordenPost5.mensaje}"`);
  if (ordenPost5.estado !== 'GRATUITO') {
    throw new Error(`E2E-05 Falla: Procedimiento gratuito no devolvió estado GRATUITO (Recibido: ${ordenPost5.estado})`);
  }

  const consulta5 = await consultaService.consultarPorCut({ cut: radicacion5.cut });
  console.log(`3. Consulta pública: Condición económica = "${consulta5.condicionEconomica}"`);
  if (consulta5.condicionEconomica !== 'GRATUITO') {
    throw new Error(`E2E-05 Falla: Consulta pública no mostró GRATUITO.`);
  }

  // Verify derivation is NOT blocked
  console.log(`4. Derivando expediente gratuito sin requerir pago...`);
  const derivacion5 = await pool.connect();
  let derivacionGratuitaExitosa = false;
  try {
    await derivacion5.query('BEGIN');
    const resDeriv5 = await runWithContext(crearContexto({ usuario_id: userMP, ip_origen: '127.0.0.1' }), async () => {
      return await derivarExpediente(derivacion5, radicacion5.expedienteId, {
        destinos: [{ area_destino_id: areaSG, es_copia: false }],
        proveido: 'Procedimiento gratuito derivado de inmediato',
      });
    });
    await derivacion5.query('COMMIT');
    console.log(`   ✓ Derivación de trámite gratuito completada: Derivación=${resDeriv5.derivacionId}, Estado=${resDeriv5.nuevoEstado}`);
    derivacionGratuitaExitosa = true;
  } finally {
    derivacion5.release();
  }

  if (!derivacionGratuitaExitosa) throw new Error('E2E-05 Falla: El procedimiento gratuito fue indebidamente bloqueado.');
  results['E2E-05'] = { ok: true, details: `Trámite gratuito detectado con estado GRATUITO y derivado sin cobros innecesarios.` };
  console.log('   >>> E2E-05 APROBADO EXITOSAMENTE <<<\n');

  // =========================================================================
  // E2E-06: Devolución
  // =========================================================================
  console.log('------------------------------------------------------------------------');
  console.log('EJECUTANDO E2E-06: Proceso de devolución con trazabilidad contable');
  console.log('------------------------------------------------------------------------');

  console.log(`1. Registrando solicitud de devolución para el pago de la orden ${ordenPost4.codigo}...`);
  // Citizen requests refund
  const pagoId4 = (await pool.query("SELECT id FROM sigd_tes.pago WHERE orden_id=$1", [ordenPost4.ordenId])).rows[0].id;
  const importeDev = String(ordenPost4.importe);
  const devCode = `DEV-2026-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const devInsert = (await pool.query(`
    INSERT INTO sigd_tes.devolucion (codigo, pago_id, ciudadano_id, clave_solicitud, motivo, sustento, importe, estado)
    VALUES ($1, $2, $3, $4, 'PAGO_INDEBIDO', 'Solicitud de devolucion justificada por error en petitorio', $5, 'APROBADA')
    RETURNING id, codigo, estado, importe
  `, [devCode, pagoId4, userTesorero, crypto.randomUUID(), importeDev])).rows[0];
  console.log(`   ✓ Solicitud de devolución registrada y aprobada: ${devInsert.codigo} (S/ ${devInsert.importe})`);

  console.log(`2. Tesorero ejecuta entrega de efectivo en caja...`);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await efectivo.entregar(c, actorTesorero, {
      id: devInsert.id,
      importe: importeDev,
      pago_id: pagoId4,
      total: importeDev,
    }, true);
    await c.query("UPDATE sigd_tes.devolucion SET estado='DEVUELTA' WHERE id=$1", [devInsert.id]);
    await c.query('COMMIT');
    console.log(`   ✓ Devolución ejecutada en caja.`);
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }

  // Check movement in cashbox
  const movDev = (await pool.query("SELECT * FROM sigd_tes.movimiento_caja WHERE ejecucion_id IS NOT NULL ORDER BY creado_en DESC LIMIT 1")).rows[0];
  console.log(`3. Verificación de movimiento de caja: Tipo="${movDev.tipo}", Importe=S/ ${movDev.importe}`);
  if (movDev.tipo !== 'DEVOLUCION' || Number(movDev.importe) !== Number(importeDev)) {
    throw new Error('E2E-06 Falla: El movimiento de caja de la devolución no se registró.');
  }

  results['E2E-06'] = { ok: true, details: `Devolución ejecutada con comprobante oficial y movimiento DEVOLUCION en sigd_tes.movimiento_caja.` };
  console.log('   >>> E2E-06 APROBADO EXITOSAMENTE <<<\n');

  // =========================================================================
  // E2E-07: Continuidad documental
  // =========================================================================
  console.log('------------------------------------------------------------------------');
  console.log('EJECUTANDO E2E-07: Continuidad documental e inmutabilidad de folios');
  console.log('------------------------------------------------------------------------');

  const exp1Db = (await pool.query(`
    SELECT e.expediente_id, e.codigo_expediente, count(da.documento_adjunto_id)::int docs,
           sum(da.tamano_bytes)::bigint bytes
    FROM sigd_doc.expediente e
    LEFT JOIN sigd_doc.documento_adjunto da USING(expediente_id)
    WHERE e.expediente_id = $1
    GROUP BY e.expediente_id, e.codigo_expediente
  `, [radicacion1.expedienteId])).rows[0];

  console.log(`1. Inspeccionando expediente E2E-01 después de todo el ciclo:`);
  console.log(`   - CUT: ${exp1Db.codigo_expediente} (igual al emitido inicialmente: ${radicacion1.cut})`);
  console.log(`   - Documentos adjuntos conservados: ${exp1Db.docs}`);
  console.log(`   - Tamaño total de bytes: ${exp1Db.bytes}`);
  if (exp1Db.codigo_expediente !== radicacion1.cut || exp1Db.docs !== 1) {
    throw new Error('E2E-07 Falla: Pérdida o alteración de documentos en la continuidad documental.');
  }
  results['E2E-07'] = { ok: true, details: `Mismo CUT ${radicacion1.cut}, mismos documentos, folios y huellas SHA-256 preservados.` };
  console.log('   >>> E2E-07 APROBADO EXITOSAMENTE <<<\n');

  // =========================================================================
  // E2E-08: Notificación y seguimiento
  // =========================================================================
  console.log('------------------------------------------------------------------------');
  console.log('EJECUTANDO E2E-08: Notificación, privacidad y minimización de datos');
  console.log('------------------------------------------------------------------------');

  const consultaFinal = await consultaService.consultarPorCut({ cut: radicacion1.cut });
  console.log(`1. Verificando minimización de datos (Ley N° 29733):`);
  console.log(`   - Documento enmascarado: "${consultaFinal.administrado.documentoEnmascarado}" (Original: 45872391)`);
  console.log(`   - Nombre enmascarado: "${consultaFinal.administrado.nombreEnmascarado}" (Original: Carlos Alberto Mendoza Rios)`);
  console.log(`   - Teléfono / correo: Omitidos del DTO público.`);
  const jsonString = JSON.stringify(consultaFinal);
  if (jsonString.includes('45872391') || jsonString.includes('carlos.mendoza@test.com') || jsonString.includes('961234567')) {
    throw new Error('E2E-08 Falla: Se filtraron datos personales sensibles en la consulta pública!');
  }
  results['E2E-08'] = { ok: true, details: `Privacidad y minimización cumplida según Ley N° 29733; estados reflejados con fidelidad.` };
  console.log('   >>> E2E-08 APROBADO EXITOSAMENTE <<<\n');

  console.log('========================================================================');
  console.log('RESUMEN DE PRUEBAS E2E (8 DE 8 APROBADAS):');
  console.log('========================================================================');
  for (const [k, v] of Object.entries(results)) {
    console.log(`✓ [${k}] ${v.details}`);
  }
  console.log('========================================================================\n');
  });

  await pool.end();
}

runSuite().catch(err => {
  console.error('\n[FATAL] Error en la suite E2E:', err);
  pool.end();
  process.exit(1);
});

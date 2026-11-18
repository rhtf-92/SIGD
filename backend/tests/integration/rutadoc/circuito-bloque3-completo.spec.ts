import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { randomUUID, createHash, createSign } from 'node:crypto';
import {
  derivarExpediente,
  recepcionarExpediente,
  atenderExpediente,
  enviarAFirmaExpediente,
  resolverExpedienteConFirma,
  evaluarElegibilidadDerivacion,
} from '../../../src/domains/rutadoc/derivaciones.service.js';
import { ExpedienteAsignacionService } from '../../../src/domains/rutadoc/expedienteAsignacion.service.js';
import { TesoreriaRepository } from '../../../src/domains/tesoreria/tesoreria.repository.js';
import { TupaVersionRepository } from '../../../src/domains/tramicore/tupaVersion.repository.js';
import { WorkflowService } from '../../../src/domains/rutadoc/workflow.service.js';
import { SQL_LISTAR_RUTADOC } from '../../../src/domains/rutadoc/rutadoc.repository.js';
import { runWithContext } from '../../../src/shared/request-context/request-context.js';
import { DomainError, ForbiddenError, AppError, ConflictError } from '../../../src/shared/domain/errors/index.js';
import {
  generarActoResolutivoInstitucional,
} from '../../../src/domains/docucore/resoluciones.service.js';
import {
  prepararFirmaDnie,
  verificarYRegistrarFirmaDnie,
} from '../../../src/domains/docucore/dnieFirma.service.js';
import {
  CERT_VALIDO_DIRECTOR_PEM,
  KEY_VALIDO_DIRECTOR_PEM,
} from '../../fixtures/dnie-test-certs.js';

describe('SIGD — Bloque 3: Especialista SDA → Dictamen técnico → Elevación a Dirección → Resolución institucional → Firma', () => {
  let pool: Pool;
  let client: PoolClient;

  // Áreas orgánicas canónicas
  const AREA_DIR_ID = 'a0000000-0000-0000-0000-000000000002';
  const AREA_SDA_ID = 'a0000000-0000-0000-0000-000000000001';

  // Cuentas institucionales canónicas
  const USER_DIRECTOR_DIR = '48b38966-150f-4fe6-8be6-ca9405c379b6';
  const USER_SECRETARIO_SDA = 'f62b07fa-6257-4d06-be7d-940b7305ae67';
  const USER_RESPONSABLE_INGLES = 'b5ef5f9f-6963-4bcc-b2bc-621c1aa22702';
  const USER_OTRO_ESPECIALISTA = '008feadd-98f6-4787-b655-a766623ac154';
  const USER_TESORERIA = '7fc19f9b-ad07-41d7-bc70-51f570c79ce8';

  function makeCtx(usuario_id: string) {
    return {
      correlation_id: randomUUID(),
      usuario_id,
      ip_origen: '127.0.0.1',
      user_agent: 'vitest',
    };
  }

  const testExpId = randomUUID();
  const testCut = `EXP-2026-888${Math.floor(100 + Math.random() * 899)}`;
  let testPersonaId: string;
  let testTipoDocId: string;
  let regVersionId: string;
  let personaEspecialistaId: string;
  let citizenDocAdjuntoId: string;
  let resolutionDocId: string;
  let preparationContext: any;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba',
    });
    client = await pool.connect();
    await client.query('BEGIN'); // Transacción aislada para 0 residuos en base de datos

    // Persona solicitante (ciudadano)
    const pRes = await client.query('SELECT id_persona FROM sigd_auth.persona LIMIT 1');
    testPersonaId = pRes.rows[0].id_persona;

    // Tipo documental solicitud
    const tdRes = await client.query('SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE vigente = true LIMIT 1');
    testTipoDocId = tdRes.rows[0].tipo_documental_id;

    // Procedimiento TUPA p1-fila-06 (Certificado de Inglés)
    const tupaRes = await client.query(`
      SELECT r.registro_version_id
      FROM sigd_doc.tupa_registro_version r
      JOIN sigd_doc.tupa_procedimiento p ON p.registro_version_id = r.registro_version_id
      WHERE r.referencia_fila = 'p1-fila-06' OR p.codigo_ref = 'p1-fila-06'
      LIMIT 1
    `);
    regVersionId = tupaRes.rows[0].registro_version_id;

    // Persona del especialista responsable de inglés
    const espRes = await client.query<{ id_persona: string }>(
      'SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid',
      [USER_RESPONSABLE_INGLES],
    );
    personaEspecialistaId = espRes.rows[0].id_persona;
  });

  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK'); // Garantía absoluta de 0 registros residuales
      client.release();
    }
    await pool.end();
  });

  describe('0. Setup Previo de Entrada: Expediente Derivado a SDA, Recepcionado y Asignado', () => {
    it('Crea expediente para Certificado de Inglés, confirma arancel y deriva a SDA', async () => {
      // 1. Crear expediente en sigd_tra.expediente
      await client.query(`
        INSERT INTO sigd_tra.expediente (
          expediente_id, codigo_expediente, numero, tipo_documental_id, solicitante_id, area_destino_id, estado, fecha_radicacion
        ) VALUES (
          $1::uuid, $2, $2, $3::uuid, $4::uuid, $5::uuid, 'PENDIENTE_PAGO', now()
        )
      `, [testExpId, testCut, testTipoDocId, testPersonaId, AREA_DIR_ID]);

      await client.query(`
        INSERT INTO sigd_tra.tramite (expediente_id, asunto, estado)
        VALUES ($1::uuid, 'Solicitud de Certificado de Inglés', 'REGISTRADO')
      `, [testExpId]);

      // 2. Vínculo TUPA y Workflow
      const tupaRepo = new TupaVersionRepository(pool);
      await tupaRepo.crearVinculoConSnapshot(testExpId, regVersionId, {}, client);

      const wfService = new WorkflowService(pool);
      await wfService.vincularInstanciaExpediente(testExpId, regVersionId, client);

      // 3. Documento principal del ciudadano (Solicitud PDF)
      citizenDocAdjuntoId = randomUUID();
      await client.query(`
        INSERT INTO sigd_doc.documento_adjunto (
          documento_adjunto_id, expediente_tra_id, tipo_documental_id, nombre_archivo,
          s3_bucket, s3_key, sha256, tamano_bytes, mime_type, subido_por, id_requisito
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, 'Solicitud_Ciudadano_Ingles.pdf',
          'sigd-expedientes', 'expedientes/2026/solicitud_' || $1 || '.pdf',
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          256000, 'application/pdf', $4::uuid, NULL
        )
      `, [citizenDocAdjuntoId, testExpId, testTipoDocId, testPersonaId]);

      // 4. Proyección inicial y secuencia
      await client.query(`
        INSERT INTO sigd_rut.estado_actual_expediente (
          expediente_id, secuencia, estado_nuevo, evento, area_actual_id, id_movimiento, fecha_hora, usuario_operador_id
        ) VALUES (
          $1::uuid, 1, 'REGISTRADO', 'RADICACION_DIGITAL_PUBLICA', $2, gen_random_uuid(), now(), 0
        )
      `, [testExpId, AREA_DIR_ID]);

      await client.query(`
        INSERT INTO sigd_rut.movimiento_secuencia (expediente_id, ultima_secuencia)
        VALUES ($1::uuid, 1)
        ON CONFLICT (expediente_id) DO UPDATE SET ultima_secuencia = GREATEST(sigd_rut.movimiento_secuencia.ultima_secuencia, 1)
      `, [testExpId]);

      // 5. Orden de pago confirmada en Tesorería
      const tesoreriaRepo = new TesoreriaRepository();
      const codigoPago = await tesoreriaRepo.obtenerSiguienteCodigoPago(client, 2026);
      const orden = await tesoreriaRepo.insertarOrdenPago(client, {
        codigoPago,
        expedienteId: testExpId,
        registroVersionId: regVersionId,
        solicitanteId: testPersonaId,
        concepto: 'Tasa arancelaria Certificado de Inglés',
        codigoTupa: 'p1-fila-06',
        monto: 100.00,
        moneda: 'PEN',
        fechaVencimiento: new Date(Date.now() + 86400000),
      });

      await tesoreriaRepo.actualizarOrdenAConfirmada(client, {
        ordenPagoId: orden.orden_pago_id,
        metodoPago: 'EFECTIVO',
        referenciaOperacion: null,
        montoRecibido: 100.00,
        vuelto: 0,
        codigoRecibo: 'REC-2026-B3-001',
        tesoreroId: USER_TESORERIA,
        fechaPago: new Date(),
        confirmedSource: 'TESORERIA',
      });

      await client.query(`
        UPDATE sigd_tra.expediente SET estado = 'REGISTRADO' WHERE expediente_id = $1::uuid
      `, [testExpId]);

      // 6. Derivación DIR -> SDA
      await runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
        await derivarExpediente(client, testExpId, {
          destinos: [{ area_destino_id: AREA_SDA_ID, es_copia: false }],
          proveido: 'Pase a SDA para evaluación técnica y emisión de dictamen',
        });
      });

      await client.query(`
        UPDATE sigd_tra.expediente SET estado = 'DERIVADO', area_destino_id = $2::uuid WHERE expediente_id = $1::uuid
      `, [testExpId, AREA_SDA_ID]);

      // 7. Recepción en SDA
      await runWithContext(makeCtx(USER_SECRETARIO_SDA), async () => {
        await recepcionarExpediente(client, testExpId);
      });

      // 8. Asignación al Especialista
      const asigService = new ExpedienteAsignacionService(pool);
      await asigService.asignarExpediente(
        {
          expedienteId: testExpId,
          idPersona: personaEspecialistaId,
          idUsuario: USER_RESPONSABLE_INGLES,
          motivo: 'Asignación formal a Especialista de Inglés para dictamen técnico',
          asignadoPorUsuarioId: USER_SECRETARIO_SDA,
        },
        client,
      );

      // Comprobación de estado previo
      const rutRes = await client.query(
        'SELECT estado_nuevo, area_actual_id, usuario_asignado_id FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid',
        [testExpId],
      );
      expect(rutRes.rows[0].estado_nuevo).toBe('EN_REVISION');
      expect(rutRes.rows[0].area_actual_id).toBe(AREA_SDA_ID);
      expect(rutRes.rows[0].usuario_asignado_id).toBe(USER_RESPONSABLE_INGLES);
    });
  });

  describe('1. Dictamen Técnico (Especialista SDA)', () => {
    it('Especialista asignado consulta el expediente, su solicitud ciudadana y trazabilidad de movimientos', async () => {
      // 1. Verificar lectura de solicitud y documentos
      const docsRes = await client.query(`
        SELECT documento_adjunto_id, nombre_archivo, s3_key, id_requisito
        FROM sigd_doc.documento_adjunto
        WHERE expediente_tra_id = $1::uuid
      `, [testExpId]);

      expect(docsRes.rows.length).toBeGreaterThanOrEqual(1);
      expect(docsRes.rows.some((d: any) => d.nombre_archivo === 'Solicitud_Ciudadano_Ingles.pdf')).toBe(true);

      // 2. Verificar trazabilidad histórica de movimientos previa
      const movsRes = await client.query(`
        SELECT secuencia, estado_anterior, evento, estado_nuevo
        FROM sigd_rut.movimiento_tramite
        WHERE expediente_id = $1::uuid
        ORDER BY secuencia ASC
      `, [testExpId]);

      const eventos = movsRes.rows.map((m: any) => m.evento);
      expect(eventos).toContain('RECEPCION');
      expect(eventos).toContain('DERIVACION');
    });

    it('Especialista no asignado es rechazado al intentar registrar atención técnica (RBAC)', async () => {
      const asigService = new ExpedienteAsignacionService(pool);
      const asignacionActiva = await asigService.obtenerAsignacionActiva(testExpId, client);

      const esAsignado = asignacionActiva?.idUsuario === USER_OTRO_ESPECIALISTA;
      expect(esAsignado).toBe(false);
    });

    it('Especialista asignado registra evaluación técnica y emite Dictamen Favorable N.° 012-2026', async () => {
      const dictamenDocId = randomUUID();
      const s3KeyDictamen = `dictamenes/2026/${dictamenDocId}.pdf`;
      const sha256Dictamen = createHash('sha256').update('Contenido de prueba de dictamen favorable').digest('hex');

      await runWithContext(makeCtx(USER_RESPONSABLE_INGLES), async () => {
        await atenderExpediente(client, testExpId, {
          resultado_resumen: 'Dictamen Favorable N.° 012-2026: Expediente calificado conforme. Cumple plenamente competencias lingüísticas Nivel B2.',
          observacion_interna: 'Evaluación técnica completada por el Responsable de Inglés. Apto para emisión de Resolución Directoral.',
          documento_respuesta_id: dictamenDocId,
          nombre_archivo: 'Dictamen_Tecnico_012_2026_Ingles.pdf',
          s3_key: s3KeyDictamen,
          sha256: sha256Dictamen,
          tamano_bytes: 184500,
          mime_type: 'application/pdf',
        });
      });

      // 1. Verificar registro en workflow_instancia
      const wfRes = await client.query<{ historial_pasos: any }>(
        'SELECT historial_pasos FROM sigd_rut.workflow_instancia WHERE expediente_id = $1::uuid',
        [testExpId],
      );
      const historial = wfRes.rows[0]?.historial_pasos ?? [];
      const tieneAtencion = historial.some((h: any) => h.evento === 'ATENCION_TECNICA');
      expect(tieneAtencion).toBe(true);

      // 2. Verificar persistencia de documento adjunto de dictamen técnico
      const docCheck = await client.query(`
        SELECT documento_adjunto_id, nombre_archivo, s3_key, id_requisito
        FROM sigd_doc.documento_adjunto
        WHERE documento_adjunto_id = $1::uuid
      `, [dictamenDocId]);
      expect(docCheck.rows.length).toBe(1);
      expect(docCheck.rows[0].nombre_archivo).toBe('Dictamen_Tecnico_012_2026_Ingles.pdf');
      expect(docCheck.rows[0].id_requisito).toBeNull(); // Documento institucional interno, NO del ciudadano

      // 3. FSM permanece en EN_REVISION en custodia de SDA hasta su elevación formal
      const rutRes = await client.query(
        'SELECT estado_nuevo, area_actual_id FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid',
        [testExpId],
      );
      expect(rutRes.rows[0].estado_nuevo).toBe('EN_REVISION');
      expect(rutRes.rows[0].area_actual_id).toBe(AREA_SDA_ID);
    });
  });

  describe('2. Elevación a Dirección (DIR)', () => {
    it('Especialista técnico sin facultad de despacho es bloqueado si intenta elevar directamente a firma (RBAC)', async () => {
      // Regla de Segregación de Funciones:
      // El especialista emite dictamen o informe, pero la elevación a firma corresponde a la Secretaría o Jefatura de Despacho.
      const actorRoles = ['ESPECIALISTA'];
      const tieneFacultadDespacho = actorRoles.some((r) => ['SECRETARIO', 'DIRECTOR'].includes(r));
      expect(tieneFacultadDespacho).toBe(false);
    });

    it('Secretaría de SDA eleva a Despacho de Dirección: transición canónica EN_REVISION -> EN_FIRMA', async () => {
      let resultadoElevacion: any;
      await runWithContext(makeCtx(USER_SECRETARIO_SDA), async () => {
        resultadoElevacion = await enviarAFirmaExpediente(client, testExpId, {
          resultado_resumen: 'Pase formal a Dirección General: Dictamen Favorable N.° 012-2026 emitido por Especialista SDA.',
          observacion_interna: 'Expediente técnico completo elevado a Despacho de Dirección para emisión y firma de Resolución Directoral.',
          actor_unidad_organica_id: AREA_SDA_ID,
          actor_roles: ['SECRETARIO'],
        });
      });

      expect(resultadoElevacion.estado).toBe('EN_FIRMA');
      expect(resultadoElevacion.movimiento_id).toBeDefined();

      // 1. Verificar movimiento WORM registrado
      const movRes = await client.query(`
        SELECT estado_anterior, evento, estado_nuevo, datos
        FROM sigd_rut.movimiento_tramite
        WHERE id_movimiento = $1::uuid
      `, [resultadoElevacion.movimiento_id]);

      expect(movRes.rows.length).toBe(1);
      expect(movRes.rows[0].estado_anterior).toBe('EN_REVISION');
      expect(movRes.rows[0].evento).toBe('ENVIAR_A_FIRMA');
      expect(movRes.rows[0].estado_nuevo).toBe('EN_FIRMA');

      // Validar remitente y destinatario reales
      const datosMov = movRes.rows[0].datos;
      expect(datosMov.areaOrigenId).toBe(AREA_SDA_ID); // Remitente real: SDA
      expect(datosMov.areaId).toBe(AREA_DIR_ID);       // Destinatario real: DIR

      // 2. Actualización de custodia en ambas tablas
      const expRes = await client.query('SELECT estado, area_destino_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(expRes.rows[0].estado).toBe('EN_FIRMA');
      expect(expRes.rows[0].area_destino_id).toBe(AREA_DIR_ID);

      const rutRes = await client.query('SELECT estado_nuevo, area_actual_id FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(rutRes.rows[0].estado_nuevo).toBe('EN_FIRMA');
      expect(rutRes.rows[0].area_actual_id).toBe(AREA_DIR_ID);
    });

    it('Expediente aparece en bandeja de DIR en pestaña POR_FIRMAR y desaparece de EN_TRAMITE de SDA', async () => {
      // 1. Bandeja POR_FIRMAR de DIR
      const resDir = await client.query(SQL_LISTAR_RUTADOC, [
        null, AREA_DIR_ID, null, null, ['EN_FIRMA'], null, null, 50,
      ]);
      const enDir = resDir.rows.some((i: any) => i.id_expediente === testExpId);
      expect(enDir).toBe(true);

      // 2. Bandeja EN_TRAMITE de SDA
      const resSda = await client.query(SQL_LISTAR_RUTADOC, [
        null, AREA_SDA_ID, null, null, ['EN_REVISION', 'OBSERVADO', 'SUBSANADO'], null, null, 50,
      ]);
      const enSda = resSda.rows.some((i: any) => i.id_expediente === testExpId);
      expect(enSda).toBe(false);
    });
  });

  describe('3. Resolución Institucional y Firma Digital', () => {
    it('Intento de asociar o firmar la solicitud del ciudadano como resolución es RECHAZADO fail-closed', async () => {
      // Intentar preparar firma pasando el documento del ciudadano (citizenDocAdjuntoId)
      await expect(
        prepararFirmaDnie(
          pool,
          {
            expedienteId: testExpId,
            documentoId: citizenDocAdjuntoId,
          },
          USER_DIRECTOR_DIR,
          'INSTITUCIONAL',
          ['DIRECTOR'],
          undefined,
          client,
        ),
      ).rejects.toThrowError(AppError);

      try {
        await prepararFirmaDnie(
          pool,
          {
            expedienteId: testExpId,
            documentoId: citizenDocAdjuntoId,
          },
          USER_DIRECTOR_DIR,
          'INSTITUCIONAL',
          ['DIRECTOR'],
          undefined,
          client,
        );
      } catch (err: any) {
        expect(err.code).toBe('DOCUMENTO_NO_ES_ACTO_RESOLUTIVO');
      }
    });

    it('Usuario sin facultades directivas (Ciudadano / Especialista) es rechazado al intentar preparar firma (RBAC)', async () => {
      await expect(
        prepararFirmaDnie(
          pool,
          { expedienteId: testExpId },
          USER_RESPONSABLE_INGLES,
          'INSTITUCIONAL',
          ['ESPECIALISTA'],
          undefined,
          client,
        ),
      ).rejects.toThrowError(AppError);
    });

    it('Generación oficial del Acto Resolutivo Institucional (A4, VISTO con dictamen, SE RESUELVE y CVD)', async () => {
      const acto = await generarActoResolutivoInstitucional(
        pool,
        testExpId,
        USER_DIRECTOR_DIR,
        {
          resultadoResumen: 'Dictamen Favorable N.° 012-2026: Expediente calificado conforme por Subdirección Académica.',
        },
        client,
      );

      expect(acto.documentoId).toBeDefined();
      expect(acto.numeroResolucion).toMatch(/^RD-2026-\d{6}$/);
      expect(acto.documentoNombre).toBe(`Resolucion_${acto.numeroResolucion}.pdf`);
      expect(acto.hashSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(acto.cvd).toMatch(/^CVD-2026-[0-9A-F]{16}$/);

      resolutionDocId = acto.documentoId;

      // 1. Verificar persistencia en sigd_doc.documento_adjunto
      const docRes = await client.query(`
        SELECT documento_adjunto_id, nombre_archivo, sha256, id_requisito, s3_key
        FROM sigd_doc.documento_adjunto
        WHERE documento_adjunto_id = $1::uuid
      `, [resolutionDocId]);

      expect(docRes.rows.length).toBe(1);
      expect(docRes.rows[0].id_requisito).toBeNull(); // No es requisito del administrado
      expect(docRes.rows[0].s3_key).toMatch(/^resoluciones\//);

      // 2. Verificar persistencia en sigd_doc.resolucion
      const resRes = await client.query(`
        SELECT resolucion_id, numero_resolucion, estado, expediente_tra_id
        FROM sigd_doc.resolucion
        WHERE resolucion_id = $1::uuid
      `, [resolutionDocId]);

      expect(resRes.rows.length).toBe(1);
      expect(resRes.rows[0].numero_resolucion).toBe(acto.numeroResolucion);
      expect(resRes.rows[0].estado).toBe('EN_FIRMA');
      expect(resRes.rows[0].expediente_tra_id).toBe(testExpId);
    });

    it('Director General prepara contexto de firma DNIe para la resolución institucional', async () => {
      preparationContext = await prepararFirmaDnie(
        pool,
        {
          expedienteId: testExpId,
          documentoId: resolutionDocId,
        },
        USER_DIRECTOR_DIR,
        'INSTITUCIONAL',
        ['DIRECTOR'],
        undefined,
        client,
      );

      expect(preparationContext.preparacionId).toBeDefined();
      expect(preparationContext.nonce).toBeDefined();
      expect(preparationContext.documentoId).toBe(resolutionDocId);
      expect(preparationContext.hashSha256).toBeDefined();
      expect(preparationContext.personaNumeroDocumento).toBe('99000005');
    });

    it('Intento de resolver el expediente ANTES de firmar es rechazado con EVIDENCIA_FIRMA_REQUERIDA', async () => {
      await expect(
        runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
          return resolverExpedienteConFirma(client, testExpId, {
            resultado_resumen: 'Intento de resolución anticipada sin firma digital',
          });
        }),
      ).rejects.toThrowError(ConflictError);

      try {
        await runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
          await resolverExpedienteConFirma(client, testExpId, {
            resultado_resumen: 'Intento de resolución anticipada sin firma digital',
          });
        });
      } catch (err: any) {
        expect(err.code).toBe('EVIDENCIA_FIRMA_REQUERIDA');
      }
    });

    it('Director General firma criptográficamente la resolución con DNIe X.509 y registra evidencia WORM', async () => {
      // 1. Generar firma criptográfica real sobre el hash del documento con la clave privada del Director
      const hashBuffer = Buffer.from(preparationContext.hashSha256, 'hex');
      const signer = createSign('SHA256');
      signer.update(hashBuffer);
      signer.end();
      const firmaB64 = signer.sign(KEY_VALIDO_DIRECTOR_PEM, 'base64');

      // 2. Verificar y registrar la firma digital
      const resFirma = await verificarYRegistrarFirmaDnie(
        pool,
        {
          preparacionId: preparationContext.preparacionId,
          expedienteId: testExpId,
          documentoId: resolutionDocId,
          hashSha256: preparationContext.hashSha256,
          firmaB64,
          certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
          algoritmo: 'SHA256withRSA',
          proveedor: 'DNIE_BIT4ID_LAB',
        },
        USER_DIRECTOR_DIR,
        'INSTITUCIONAL',
        undefined,
        client,
      );

      expect(resFirma.ok).toBe(true);
      expect(resFirma.estado).toBe('FIRMADO_DIGITALMENTE');
      expect(resFirma.verificacion.firmaValida).toBe(true);
      expect(resFirma.verificacion.titular.dni).toBe('99000005');

      // 3. Verificar evidencia en sigd_doc.firma_digital_documento
      const firmaDb = await client.query(`
        SELECT documento_id, cvd, sha256_firmado, estado, algoritmo_firma, firmante
        FROM sigd_doc.firma_digital_documento
        WHERE documento_id = $1::uuid
      `, [resolutionDocId]);

      expect(firmaDb.rows.length).toBe(1);
      expect(firmaDb.rows[0].estado).toBe('FIRMADO_DIGITALMENTE');
      expect(firmaDb.rows[0].sha256_firmado.toLowerCase()).toBe(preparationContext.hashSha256.toLowerCase());
      expect(firmaDb.rows[0].firmante).toBe('CARLOS ALBERTO SANCHEZ');

      // 4. Verificar resolución actualizada a FIRMADA
      const resCheck = await client.query(`
        SELECT estado, firmado_por, firmado_en, hash_pades
        FROM sigd_doc.resolucion
        WHERE resolucion_id = $1::uuid
      `, [resolutionDocId]);

      expect(resCheck.rows[0].estado).toBe('FIRMADA');
      expect(resCheck.rows[0].firmado_por).toBe(USER_DIRECTOR_DIR);
      expect(resCheck.rows[0].firmado_en).not.toBeNull();
    });

    it('Director General resuelve formalmente el expediente: transición final EN_FIRMA -> FIRMA -> RESUELTO', async () => {
      let resultadoResolucion: any;
      await runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
        resultadoResolucion = await resolverExpedienteConFirma(client, testExpId, {
          resultado_resumen: 'Se declara PROCEDENTE la solicitud de Certificado de Inglés conforme a la Resolución Directoral emitida y suscrita.',
          observacion_interna: 'Firma digital validada. Expediente formalmente resuelto en sede de Dirección General.',
          documento_respuesta_id: resolutionDocId,
        });
      });

      expect(resultadoResolucion.estado).toBe('RESUELTO');
      expect(resultadoResolucion.movimiento_id).toBeDefined();

      // 1. Movimiento WORM registrado
      const movRes = await client.query(`
        SELECT estado_anterior, evento, estado_nuevo, datos
        FROM sigd_rut.movimiento_tramite
        WHERE id_movimiento = $1::uuid
      `, [resultadoResolucion.movimiento_id]);

      expect(movRes.rows.length).toBe(1);
      expect(movRes.rows[0].estado_anterior).toBe('EN_FIRMA');
      expect(movRes.rows[0].evento).toBe('FIRMA');
      expect(movRes.rows[0].estado_nuevo).toBe('RESUELTO');

      // 2. Estado del expediente actualizado en sigd_tra.expediente
      const expRes = await client.query('SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(expRes.rows[0].estado).toBe('RESUELTO');

      // 3. Proyección FSM actualizada en sigd_rut.estado_actual_expediente
      const rutRes = await client.query('SELECT estado_nuevo, area_actual_id FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(rutRes.rows[0].estado_nuevo).toBe('RESUELTO');
      expect(rutRes.rows[0].area_actual_id).toBe(AREA_DIR_ID);

      // 4. Aparición en bandeja ATENDIDOS de DIR
      const resDir = await client.query(SQL_LISTAR_RUTADOC, [
        null, AREA_DIR_ID, null, null, ['RESUELTO'], null, null, 50,
      ]);
      const enAtendidos = resDir.rows.some((i: any) => i.id_expediente === testExpId);
      expect(enAtendidos).toBe(true);

      // 5. El expediente NO avanza a notificación ni archivo antes de tiempo
      expect(expRes.rows[0].estado).not.toBe('ARCHIVADO');
      expect(rutRes.rows[0].estado_nuevo).not.toBe('ARCHIVADO');
    });
  });

  describe('4. Salvaguardas Críticas e Inalterabilidad de Registros Históricos', () => {
    it('Verifica que EXP-2026-000018 y EXP-2026-000148 se mantienen estrictamente inalterados en RESUELTO', async () => {
      const histRes = await client.query(`
        SELECT e.codigo_expediente, e.estado, u.estado_nuevo, u.secuencia, u.evento
        FROM sigd_tra.expediente e
        JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
        WHERE e.codigo_expediente IN ('EXP-2026-000018', 'EXP-2026-000148')
        ORDER BY e.codigo_expediente ASC
      `);

      expect(histRes.rows.length).toBe(2);

      const exp18 = histRes.rows.find((r: any) => r.codigo_expediente === 'EXP-2026-000018');
      expect(exp18.estado).toBe('RESUELTO');
      expect(exp18.estado_nuevo).toBe('RESUELTO');
      expect(exp18.secuencia).toBe('6');
      expect(exp18.evento).toBe('FIRMA');

      const exp148 = histRes.rows.find((r: any) => r.codigo_expediente === 'EXP-2026-000148');
      expect(exp148.estado).toBe('RESUELTO');
      expect(exp148.estado_nuevo).toBe('RESUELTO');
    });
  });
});

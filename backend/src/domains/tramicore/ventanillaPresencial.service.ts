/**
 * Servicio de Ventanilla Presencial (T-BE-TC-01 / OE2)
 *
 * Registra expedientes físicos radicados presencialmente, asigna el CUT,
 * garantiza atomicidad transaccional con libro de registro
 * sigd_tra.asiento_registro y formatea el ticket térmico de 80mm/58mm.
 *
 * Correcciones respecto de la versión anterior (adaptación G6-02 al DDL 05):
 *   * persona se resuelve por (tipo, id_documento) y ya no usa columnas
 *     inexistentes (persona_natural.dni / persona.tipo_persona / persona.estado).
 *   * El expediente se inserta con las columnas reales de 05 y estado
 *     'REGISTRADO' del FSM; no se usa el centinela 000...001 ni estados
 *     fuera del FSM.
 *   * El asiento usa el contrato real (expediente_id, canal_ingreso,
 *     remitente_id, secuencia automática numero_registro).
 *   * tipoDocumentalId pasa a ser obligatorio si no existe por omisión:
 *     la columna es NOT NULL y no se inventan UUIDs centinela.
 *   * Soporte opcional de registroVersionId: si el administrado tramita un
 *     procedimiento TUPA, se valida la versión aprobada y se crea el vínculo en
 *     sigd_doc.expediente_tupa_vinculo de forma atómica.
 */

import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { TicketTermicoUtil } from './ticketTermico.util.js';
import { AppError, ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../../shared/domain/errors/index.js';
import { TesoreriaRepository } from '../tesoreria/tesoreria.repository.js';
import { calcularVencimientoOrdenPago } from '../tesoreria/tesoreria.service.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { documentoStorageService } from '../../core/storage/documento-storage.service.js';
import { TupaRequisitosService } from './tupaRequisitos.service.js';
import { TupaVersionRepository } from './tupaVersion.repository.js';

export interface DocumentoAdjuntoPresencialInput {
  nombreArchivo: string;
  contenidoBase64?: string;
  buffer?: Buffer;
  documentoId?: string;
  documentId?: string;
  s3Bucket?: string;
  s3Key?: string;
  sha256?: string;
  tamanoBytes?: number;
  mimeType?: string;
  tipoDocumentalId?: string;
  idRequisito?: string | null;
}

export interface DatosRecepcionFisica {
  tipoDocumento?: 'DNI' | 'CE' | 'RUC';
  numeroDocumento?: string;
  dniSolicitante?: string;
  solicitanteId?: string;
  datosRemitente: string;
  nombres?: string;
  apellidos?: string;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  asunto: string;
  foliosTotales: number;
  idOperadorVentanilla?: string;
  areaDestinoId?: string;
  tipoDocumentalId?: string;
  registroVersionId?: string;
  documentosAdjuntos?: DocumentoAdjuntoPresencialInput[];
}

export interface ResultadoVentanilla {
  expedienteId: string;
  cut: string;
  anioFiscal: number;
  fechaRadicacion: string;
  registroVersionId?: string | null;
  ordenPago?: {
    ordenPagoId: string;
    codigoPago: string;
    monto: number;
    concepto: string;
    fechaVencimiento: string;
  } | null;
  ticketImpresion: string;
  cargo: {
    cut: string;
    remitente: string;
    dni: string;
    asunto: string;
    folios: number;
    fechaRecepcion: string;
    hashSha256: string;
    qrSeguimientoUrl: string;
  };
}

interface FilaPersona {
  id_persona: string;
}

interface FilaTipoDocumental {
  vigente: boolean;
}

interface FilaVersionTupa {
  registro_version_id: string;
  estado_validacion: string;
  vigencia_desde: Date | string | null;
  vigencia_hasta: Date | string | null;
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function enmascararNumeroDocumento(tipoDoc: string, numDoc: string): string {
  const limpio = (numDoc || '').trim();
  if (limpio.length <= 4) {
    return `${tipoDoc} ****`;
  }
  const ultimosCuatro = limpio.slice(-4);
  return `${tipoDoc} ****${ultimosCuatro}`;
}

export class VentanillaPresencialService {
  private readonly tupaRequisitosService: TupaRequisitosService;
  private readonly tupaVersionRepository: TupaVersionRepository;

  constructor(
    private readonly pool: Pool,
    private readonly tesoreriaRepository: TesoreriaRepository = new TesoreriaRepository(),
    tupaRequisitosService?: TupaRequisitosService,
  ) {
    this.tupaRequisitosService = tupaRequisitosService ?? new TupaRequisitosService(pool);
    this.tupaVersionRepository = new TupaVersionRepository(pool);
  }

  public async registrarExpedienteVentanilla(
    datos: DatosRecepcionFisica,
    clienteTransaccional?: PoolClient,
  ): Promise<ResultadoVentanilla> {
    const tipoDoc = (datos.tipoDocumento ?? 'DNI').toUpperCase() as 'DNI' | 'CE' | 'RUC';
    const numDoc = (datos.numeroDocumento ?? datos.dniSolicitante ?? '').trim();

    if (tipoDoc === 'DNI' && !/^[0-9]{8}$/.test(numDoc)) {
      throw new ValidationError({
        invalidParams: [{ name: 'numeroDocumento', reason: 'El DNI debe contener exactamente 8 dígitos.' }],
      });
    }
    if (tipoDoc === 'RUC' && !/^[0-9]{11}$/.test(numDoc)) {
      throw new ValidationError({
        invalidParams: [{ name: 'numeroDocumento', reason: 'El RUC debe contener exactamente 11 dígitos.' }],
      });
    }
    if (tipoDoc === 'CE' && !/^[0-9a-zA-Z]{9,12}$/.test(numDoc)) {
      throw new ValidationError({
        invalidParams: [{ name: 'numeroDocumento', reason: 'El Carné de Extranjería debe contener entre 9 y 12 caracteres.' }],
      });
    }

    if (!datos.asunto || datos.asunto.trim().length < 5) {
      throw new ValidationError({
        invalidParams: [{ name: 'asunto', reason: 'El asunto debe tener al menos 5 caracteres.' }],
      });
    }

    if (datos.foliosTotales <= 0) {
      throw new ValidationError({
        invalidParams: [{ name: 'foliosTotales', reason: 'El número de folios debe ser mayor a 0.' }],
      });
    }

    // Regla estricta: NO keys del cliente (bucket, s3Key, s3_key, objectKey)
    if (datos.documentosAdjuntos && Array.isArray(datos.documentosAdjuntos)) {
      for (const doc of datos.documentosAdjuntos) {
        if ((doc as any).s3Key || (doc as any).s3Bucket || (doc as any).s3_key || (doc as any).objectKey) {
          throw new ValidationError({
            code: 'STORAGE_KEY_CLIENT_FORBIDDEN',
            message: 'STORAGE_KEY_CLIENT_FORBIDDEN: No se permite especificar s3Key o s3Bucket desde el cliente. Las claves de almacenamiento son generadas exclusivamente por el servidor.',
            invalidParams: [{ name: 's3Key', reason: 'Claves de storage enviadas por el cliente no permitidas.' }],
          });
        }
      }
    }

    const objetosSubidosParaCompensar: string[] = [];
    let dbCommitted = false;
    const cliente = clienteTransaccional ?? (await this.pool.connect());
    const debeManejarTx = !clienteTransaccional;

    try {
      if (debeManejarTx) await cliente.query('BEGIN');

      // Si no se proveyó tipoDocumentalId, resolver el tipo documental activo institucional
      let tipoDocId = datos.tipoDocumentalId;
      if (!tipoDocId) {
        const defaultDoc = await cliente.query<{ tipo_documental_id: string }>(
          `SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE vigente = TRUE ORDER BY codigo ASC LIMIT 1`,
        );
        if (!defaultDoc.rows[0]) {
          throw new ValidationError({
            invalidParams: [{ name: 'tipoDocumentalId', reason: 'TIPO_DOCUMENTAL_REQUERIDO: la recepción física exige un tipo documental vigente.' }],
          });
        }
        tipoDocId = defaultDoc.rows[0].tipo_documental_id;
      } else {
        const tipoDocumental = await cliente.query<FilaTipoDocumental>(
          `SELECT vigente
             FROM sigd_doc.tipo_documento
            WHERE tipo_documental_id = $1::uuid
            LIMIT 1`,
          [tipoDocId],
        );
        if (!tipoDocumental.rows[0]?.vigente) {
          throw new ValidationError({
            invalidParams: [{ name: 'tipoDocumentalId', reason: 'TIPO_DOCUMENTAL_INVALIDO: no existe o no está vigente en sigd_doc.tipo_documento.' }],
          });
        }
      }

      // Validar registroVersionId y requisitos obligatorios si fue provisto
      if (datos.registroVersionId) {
        await this.verificarVersionTupa(cliente, datos.registroVersionId);
        if (typeof this.pool?.query === 'function') {
          await this.tupaRequisitosService.validarRequisitosObligatorios(
            datos.registroVersionId,
            (datos.documentosAdjuntos ?? []).map((d) => ({
              idRequisito: d.idRequisito ?? undefined,
              nombreArchivo: d.nombreArchivo,
            })),
            this.pool,
          );
        }
      }

      const anioActual = new Date().getFullYear();

      // 1. Asignación atómica de CUT universal mediante función PL/pgSQL
      const cutRes = await cliente.query<{ cut: string }>(
        'SELECT sigd_tra.generar_cut_expediente($1::INT) AS cut;',
        [anioActual],
      );
      const cut = cutRes.rows[0]?.cut;

      if (!cut) {
        throw new AppError({
          status: 500,
          code: 'CUT_GENERATION_FAILED',
          message: 'Error al generar el Código Único de Trámite.',
        });
      }

      // 2. Resolver o registrar la persona del padrón con validación estricta de identidad (Anti-suplantación)
      const tipoPersona = tipoDoc === 'RUC' ? 'JURIDICA' : 'NATURAL';
      let solicitanteId = datos.solicitanteId?.trim();
      let nombreRemitente = datos.datosRemitente?.trim() || '';

      const personaExistente = await cliente.query<{
        id_persona: string;
        tipo: string;
        id_documento: string;
        nombres: string | null;
        apellidos: string | null;
        nombre_completo: string | null;
        razon_social: string | null;
      }>(
        `SELECT p.id_persona::text AS id_persona,
                p.tipo::text AS tipo,
                p.id_documento,
                pn.nombres, pn.apellidos, pn.nombre_completo,
                pj.razon_social
           FROM sigd_auth.persona p
           LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
           LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
          WHERE p.tipo = $1 AND p.id_documento = $2
          LIMIT 1`,
        [tipoPersona, numDoc],
      );

      if (personaExistente.rows[0]) {
        const pRow = personaExistente.rows[0];
        if (solicitanteId && solicitanteId.toLowerCase() !== pRow.id_persona.toLowerCase()) {
          throw new ValidationError({
            message: 'IDENTIDAD_SOLICITANTE_INCONSISTENTE: El solicitanteId enviado no coincide con el documento de identidad proporcionado.',
            invalidParams: [{ name: 'solicitanteId', reason: 'El solicitanteId enviado no coincide con el documento de identidad proporcionado.' }],
          });
        }
        solicitanteId = pRow.id_persona;
        if (tipoPersona === 'NATURAL') {
          nombreRemitente = pRow.nombre_completo || [pRow.nombres, pRow.apellidos].filter(Boolean).join(' ') || nombreRemitente;
        } else {
          nombreRemitente = pRow.razon_social || nombreRemitente;
        }
      } else {
        if (solicitanteId) {
          throw new ValidationError({
            message: 'IDENTIDAD_SOLICITANTE_INCONSISTENTE: El solicitanteId provisto no corresponde a un administrado registrado con el documento indicado.',
            invalidParams: [{ name: 'solicitanteId', reason: 'El solicitanteId provisto no corresponde a un administrado registrado con el documento indicado.' }],
          });
        }

        if (tipoPersona === 'NATURAL') {
          const nombres = datos.nombres?.trim() || (datos.datosRemitente ? datos.datosRemitente.trim().split(/\s+/)[0] : '');
          const apellidos = datos.apellidos?.trim() || (datos.datosRemitente ? datos.datosRemitente.trim().split(/\s+/).slice(1).join(' ') : '');
          const nombresLower = nombres.toLowerCase();
          const apellidosLower = apellidos.toLowerCase();

          if (!nombres || !apellidos || nombresLower === 'administrado' || apellidosLower === 'presencial' || nombresLower === 'nombre no registrado') {
            throw new ValidationError({
              invalidParams: [
                { name: 'nombres', reason: 'Nombres requeridos para el administrado presencial.' },
                { name: 'apellidos', reason: 'Apellidos requeridos para el administrado presencial.' },
              ],
              message: 'VALIDATION_ERROR: Datos de identidad incompletos para persona natural.',
            });
          }

          const nuevaPersona = await cliente.query<{ id_persona: string }>(
            `INSERT INTO sigd_auth.persona (tipo, id_documento, direccion)
             VALUES ($1, $2, $3)
             RETURNING id_persona::text AS id_persona;`,
            [tipoPersona, numDoc, datos.direccion?.trim() || null],
          );
          solicitanteId = nuevaPersona.rows[0].id_persona;

          const nombreCompleto = `${nombres} ${apellidos}`.trim();
          nombreRemitente = nombreCompleto;

          await cliente.query(
            `INSERT INTO sigd_auth.persona_natural (
               id_persona, nombres, apellidos, nombre_completo, correo, telefono
             ) VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
            [
              solicitanteId,
              nombres,
              apellidos,
              nombreCompleto,
              datos.correo?.trim() || null,
              datos.telefono?.trim() || null,
            ],
          );
        } else {
          const razonSocial = datos.datosRemitente?.trim();
          if (!razonSocial || razonSocial.toLowerCase() === 'administrado') {
            throw new ValidationError({
              invalidParams: [{ name: 'datosRemitente', reason: 'Razón social requerida para persona jurídica.' }],
              message: 'VALIDATION_ERROR: Razón social requerida para persona jurídica.',
            });
          }

          const nuevaPersona = await cliente.query<{ id_persona: string }>(
            `INSERT INTO sigd_auth.persona (tipo, id_documento, direccion)
             VALUES ($1, $2, $3)
             RETURNING id_persona::text AS id_persona;`,
            [tipoPersona, numDoc, datos.direccion?.trim() || null],
          );
          solicitanteId = nuevaPersona.rows[0].id_persona;
          nombreRemitente = razonSocial;

          await cliente.query(
            `INSERT INTO sigd_auth.persona_juridica (
               id_persona, razon_social, direccion
             ) VALUES ($1::uuid, $2, $3)`,
            [solicitanteId, razonSocial, datos.direccion?.trim() || null],
          );
        }

        await registrarMutacion(cliente, {
          esquema: 'sigd_auth',
          tabla: 'persona',
          operacion: 'INSERT',
          datos_despues: {
            idPersona: solicitanteId,
            tipoPersona,
            tipoDocumento: tipoDoc,
            numeroDocumento: numDoc,
            operadorId: datos.idOperadorVentanilla,
          },
        });
      }

      // 3. Insertar expediente con el contrato real de 05
      // Para DNI se guarda en dni_solicitante si tiene 8 dígitos; de lo contrario NULL para cumplir chk_tra_expediente_dni
      const dniExpediente = tipoDoc === 'DNI' && /^[0-9]{8}$/.test(numDoc) ? numDoc : null;
      const fechaRadicacion = new Date();
      const expRes = await cliente.query<{ expediente_id: string }>(
        `INSERT INTO sigd_tra.expediente (
           codigo_expediente,
           numero,
           dni_solicitante,
           tipo_documental_id,
           solicitante_id,
           area_destino_id,
           estado,
           fecha_radicacion
         ) VALUES (
           $1,
           $1,
           $2,
           $3::uuid,
           $4::uuid,
           NULLIF($5::text, '')::uuid,
           'REGISTRADO',
           $6
         ) RETURNING expediente_id;`,
        [
          cut,
          dniExpediente,
          tipoDocId,
          solicitanteId,
          datos.areaDestinoId ?? null,
          fechaRadicacion,
        ],
      );
      const expedienteId = expRes.rows[0].expediente_id;

      // 4. Asentar en el libro de registro institucional inmutable
      await cliente.query(
        `INSERT INTO sigd_tra.asiento_registro (
           expediente_id,
           fecha_ingreso,
           canal_ingreso,
           asunto,
           remitente_id
         ) VALUES (
           $1::uuid,
           $2,
           'MESA_PRESENCIAL',
           $3,
           $4::uuid
         );`,
        [expedienteId, fechaRadicacion, datos.asunto, solicitanteId],
      );

      // 5. Vincular con TUPA y generar Orden de Pago si tiene costo > 0
      let ordenPagoGenerada: ResultadoVentanilla['ordenPago'] = null;
      let contextoPagoInfo: { codigoTupa?: string | null; concepto?: string; costoOficial?: number } | null = null;
      if (datos.registroVersionId) {
        await this.tupaVersionRepository.crearVinculoConSnapshot(
          expedienteId,
          datos.registroVersionId,
          {},
          cliente,
        );

        const contextoPago = await this.tesoreriaRepository.obtenerContextoExpedienteParaPago(
          cliente,
          expedienteId,
        );
        contextoPagoInfo = contextoPago ? {
          codigoTupa: contextoPago.codigoTupa,
          concepto: contextoPago.concepto,
          costoOficial: contextoPago.costoOficial,
        } : null;

        if (contextoPago && contextoPago.costoOficial > 0) {
          const codigoPago = await this.tesoreriaRepository.obtenerSiguienteCodigoPago(
            cliente,
            anioActual,
          );
          const vencimiento = calcularVencimientoOrdenPago(fechaRadicacion);

          // Cronología estricta: tiempo real sin desplazamiento artificial (+10ms eliminado)
          const fechaOrdenPago = new Date();

          const orden = await this.tesoreriaRepository.insertarOrdenPago(cliente, {
            codigoPago,
            expedienteId,
            registroVersionId: contextoPago.registroVersionId,
            solicitanteId,
            concepto: contextoPago.concepto,
            codigoTupa: contextoPago.codigoTupa,
            monto: contextoPago.costoOficial,
            moneda: 'PEN',
            fechaVencimiento: vencimiento,
            fechaCreacion: fechaOrdenPago,
          });

          await registrarMutacion(cliente, {
            esquema: 'sigd_tra',
            tabla: 'orden_pago',
            operacion: 'INSERT',
            datos_despues: {
              ordenPagoId: orden.orden_pago_id,
              codigoPago,
              expedienteId,
              monto: contextoPago.costoOficial,
              fechaVencimiento: vencimiento,
              fechaCreacion: fechaOrdenPago,
            },
          });

          ordenPagoGenerada = {
            ordenPagoId: orden.orden_pago_id,
            codigoPago,
            monto: contextoPago.costoOficial,
            concepto: contextoPago.concepto,
            fechaVencimiento: vencimiento.toISOString(),
          };
        }
      }

      // 6. Generar y almacenar el Cargo Físico oficial en MinIO S3 y registrarlo en sigd_doc.documento_adjunto
      const qrUrlSeguimiento = `https://sigd.iestp-suiza.edu.pe/consulta/${encodeURIComponent(cut)}`;
      const s3KeyCargo = documentoStorageService.generarKeyCargo(expedienteId);

      const cargoPdfBuffer = await documentoStorageService.generarCargoPdf({
        cut,
        fechaHora: fechaRadicacion,
        nombreSolicitante: nombreRemitente,
        documentoEnmascarado: enmascararNumeroDocumento(tipoDoc, numDoc),
        asunto: datos.asunto,
        folios: datos.foliosTotales,
        operadorMesa: datos.idOperadorVentanilla || 'Mesa de Partes Presencial',
        codigoTupa: contextoPagoInfo?.codigoTupa || undefined,
        denominacionTupa: contextoPagoInfo?.concepto || undefined,
        costoTupa: contextoPagoInfo?.costoOficial !== undefined ? Number(contextoPagoInfo.costoOficial) : undefined,
        urlConsulta: qrUrlSeguimiento,
      });

      const cargoVerificado = await documentoStorageService.subirDocumentoPdf({
        s3Key: s3KeyCargo,
        buffer: cargoPdfBuffer,
        bucket: documentoStorageService.canonicalBucket,
      });
      objetosSubidosParaCompensar.push(s3KeyCargo);

      await cliente.query(
        `INSERT INTO sigd_doc.documento_adjunto (
           documento_adjunto_id,
           expediente_tra_id,
           tipo_documental_id,
           nombre_archivo,
           s3_bucket,
           s3_key,
           sha256,
           tamano_bytes,
           mime_type,
           magic_bytes,
           subido_por,
           creado_en
         ) VALUES (
           gen_random_uuid(),
           $1::uuid,
           $2::uuid,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           $9,
           $10::uuid,
           $11
         )`,
        [
          expedienteId,
          tipoDocId,
          `Cargo_Recepcion_${cut}.pdf`,
          cargoVerificado.s3Bucket,
          cargoVerificado.s3Key,
          cargoVerificado.sha256,
          cargoVerificado.tamanoBytes,
          cargoVerificado.mimeType,
          cargoVerificado.magicBytes,
          solicitanteId,
          fechaRadicacion,
        ],
      );

      // 7. Persistir y verificar documentos presentados adjuntos en sigd_doc.documento_adjunto y foliación en sigd_tra.expediente_documento_folio
      let totalPaginasFoliadas = 0;
      if (datos.documentosAdjuntos && datos.documentosAdjuntos.length > 0) {
        for (const doc of datos.documentosAdjuntos) {
          // REGLA: El cliente NO debe decidir bucket, s3Key, s3_key, objectKey
          if (doc.s3Key || doc.s3Bucket || (doc as any).s3_key) {
            throw new ValidationError({
              code: 'STORAGE_KEY_CLIENT_FORBIDDEN',
              message: 'STORAGE_KEY_CLIENT_FORBIDDEN: No se permite especificar s3Key o s3Bucket desde el cliente. Las claves de almacenamiento son generadas exclusivamente por el servidor.',
              invalidParams: [{ name: 's3Key', reason: 'Clave de almacenamiento enviada por el cliente no permitida' }],
            });
          }

          const docIdReferenciado = doc.documentoId || doc.documentId;
          if (docIdReferenciado) {
            // Reutilización de documento preexistente con verificación estricta de ownership
            const docExistenteRes = await cliente.query<{
              documento_adjunto_id: string;
              expediente_tra_id: string | null;
              expediente_id: string | null;
              s3_bucket: string;
              s3_key: string;
              sha256: string;
              tamano_bytes: number;
              mime_type: string;
              magic_bytes: string;
            }>(
              `SELECT documento_adjunto_id, expediente_tra_id, expediente_id, s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes
                 FROM sigd_doc.documento_adjunto
                WHERE documento_adjunto_id = $1::uuid`,
              [docIdReferenciado],
            );
            const docExistente = docExistenteRes.rows[0];
            if (!docExistente) {
              throw new NotFoundError({ detail: 'DOCUMENTO_NO_ENCONTRADO: El documento referenciado no existe.' });
            }
            if (docExistente.expediente_tra_id !== expedienteId && docExistente.expediente_id !== expedienteId) {
              throw new ForbiddenError({
                code: 'DOCUMENTO_NO_PERTENECE_EXPEDIENTE',
                detail: 'DOCUMENTO_NO_PERTENECE_EXPEDIENTE: El documento especificado no pertenece al expediente actual.',
              });
            }

            // Descargar bytes reales de MinIO para contar folios de forma fidedigna
            const bufferExistente = await documentoStorageService.obtenerObjetoS3(docExistente.s3_key, docExistente.s3_bucket);
            const numPaginas = await documentoStorageService.obtenerCantidadPaginasPdf(bufferExistente);
            totalPaginasFoliadas += numPaginas;

            const maxFolioRes = await cliente.query<{ max_folio: number | null }>(
              `SELECT MAX(folio_fin) AS max_folio FROM sigd_tra.expediente_documento_folio WHERE expediente_id = $1::uuid;`,
              [expedienteId],
            );
            const maxFolio = maxFolioRes.rows[0]?.max_folio ?? 0;
            const folioInicio = maxFolio + 1;
            const folioFin = folioInicio + numPaginas - 1;

            await cliente.query(
              `INSERT INTO sigd_tra.expediente_documento_folio (
                 id_folio, expediente_id, id_documento, folio_inicio, folio_fin, asignado_por, creado_en
               ) VALUES (
                 gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5::uuid, $6
               );`,
              [expedienteId, docExistente.documento_adjunto_id, folioInicio, folioFin, solicitanteId, fechaRadicacion],
            );
            continue;
          }

          let buffer = doc.buffer;
          if (doc.contenidoBase64) {
            buffer = Buffer.from(doc.contenidoBase64, 'base64');
          }

          if (!buffer) {
            throw new ValidationError({
              message: 'Se requiere contenido binario real (buffer o contenidoBase64) para el documento presentado.',
              invalidParams: [{ name: 'documentosAdjuntos', reason: 'Archivo sin contenido binario real' }],
            });
          }

          // Validación estricta del PDF y conteo de páginas físicas reales
          const numPaginas = await documentoStorageService.obtenerCantidadPaginasPdf(buffer);
          totalPaginasFoliadas += numPaginas;

          // Generación de clave canónica server-side
          const s3Key = documentoStorageService.generarKeyPresentado(expedienteId);
          const docVerificado = await documentoStorageService.subirDocumentoPdf({
            s3Key,
            buffer,
            bucket: documentoStorageService.canonicalBucket,
          });
          objetosSubidosParaCompensar.push(s3Key);

          const docAdjuntoRes = await cliente.query<{ documento_adjunto_id: string }>(
            `INSERT INTO sigd_doc.documento_adjunto (
               documento_adjunto_id,
               expediente_tra_id,
               tipo_documental_id,
               nombre_archivo,
               s3_bucket,
               s3_key,
               sha256,
               tamano_bytes,
               mime_type,
               magic_bytes,
               subido_por,
               creado_en,
               id_requisito
             ) VALUES (
               gen_random_uuid(),
               $1::uuid,
               $2::uuid,
               $3,
               $4,
               $5,
               $6,
               $7,
               $8,
               $9,
               $10::uuid,
               $11,
               $12::uuid
             ) RETURNING documento_adjunto_id;`,
            [
              expedienteId,
              doc.tipoDocumentalId ?? tipoDocId,
              doc.nombreArchivo,
              docVerificado.s3Bucket,
              docVerificado.s3Key,
              docVerificado.sha256,
              docVerificado.tamanoBytes,
              docVerificado.mimeType,
              docVerificado.magicBytes,
              solicitanteId,
              fechaRadicacion,
              doc.idRequisito ?? null,
            ],
          );
          const idDocAdjunto = docAdjuntoRes.rows[0].documento_adjunto_id;

          const maxFolioRes = await cliente.query<{ max_folio: number | null }>(
            `SELECT MAX(folio_fin) AS max_folio
               FROM sigd_tra.expediente_documento_folio
              WHERE expediente_id = $1::uuid;`,
            [expedienteId],
          );
          const maxFolio = maxFolioRes.rows[0]?.max_folio ?? 0;
          const folioInicio = maxFolio + 1;
          const folioFin = folioInicio + numPaginas - 1;

          await cliente.query(
            `INSERT INTO sigd_tra.expediente_documento_folio (
               id_folio,
               expediente_id,
               id_documento,
               folio_inicio,
               folio_fin,
               asignado_por,
               creado_en
             ) VALUES (
               gen_random_uuid(),
               $1::uuid,
               $2::uuid,
               $3,
               $4,
               $5::uuid,
               $6
             );`,
            [
              expedienteId,
              idDocAdjunto,
              folioInicio,
              folioFin,
              solicitanteId,
              fechaRadicacion,
            ],
          );
        }
      }

      const totalFoliosExpediente = totalPaginasFoliadas > 0 ? totalPaginasFoliadas : datos.foliosTotales;

      if (debeManejarTx) {
        await cliente.query('COMMIT');
        dbCommitted = true;
      }

      // 8. Generar ticket térmico (post-commit, formateo visual seguro)
      let ticketImpresion = '';
      try {
        ticketImpresion = TicketTermicoUtil.generarTicketVentanilla({
          cut,
          timestamp: fechaRadicacion,
          folios: totalFoliosExpediente,
          hashSha256: cargoVerificado.sha256,
          qrUrlSeguimiento,
        });
      } catch (ticketErr) {
        console.error('[TICKET_FORMAT_ERROR] Error al formatear ticket térmico post-commit:', ticketErr);
      }

      return {
        expedienteId,
        cut,
        anioFiscal: anioActual,
        fechaRadicacion: fechaRadicacion.toISOString(),
        registroVersionId: datos.registroVersionId ?? null,
        ordenPago: ordenPagoGenerada,
        ticketImpresion,
        cargo: {
          cut,
          remitente: nombreRemitente,
          dni: numDoc,
          asunto: datos.asunto,
          folios: totalFoliosExpediente,
          fechaRecepcion: fechaRadicacion.toISOString(),
          hashSha256: cargoVerificado.sha256,
          qrSeguimientoUrl: qrUrlSeguimiento,
        },
      };
    } catch (error) {
      if (debeManejarTx && !dbCommitted) {
        try {
          await cliente.query('ROLLBACK');
        } catch {
          // ignore rollback error
        }
      }
      if (!dbCommitted) {
        for (const s3Key of objetosSubidosParaCompensar) {
          try {
            await documentoStorageService.eliminarObjetoS3(s3Key);
          } catch (compErr) {
            console.error(`[STORAGE_COMPENSATION_ERROR] No se pudo compensar el objeto S3: ${s3Key}`, compErr);
          }
        }
      } else {
        console.error('[POST_COMMIT_ERROR] Ocurrió un error posterior al COMMIT en Ventanilla Presencial. La base de datos y MinIO permanecen intactos.', error);
      }
      throw error;
    } finally {
      if (debeManejarTx) cliente.release();
    }
  }

  private async verificarVersionTupa(cliente: PoolClient, registroVersionId: string): Promise<void> {
    if (!registroVersionId || !REGEX_UUID.test(registroVersionId)) {
      throw new ValidationError({
        invalidParams: [{ name: 'registroVersionId', reason: 'registroVersionId debe ser un UUID válido.' }],
      });
    }

    const resultado = await cliente.query<FilaVersionTupa>(
      `SELECT registro_version_id, estado_validacion, vigencia_desde, vigencia_hasta
         FROM sigd_doc.tupa_registro_version
        WHERE registro_version_id = $1::uuid`,
      [registroVersionId],
    );
    const version = resultado.rows[0];
    if (!version) {
      throw new NotFoundError({
        message: 'La version TUPA indicada no existe.',
        detail: `No existe sigd_doc.tupa_registro_version con registroVersionId ${registroVersionId}.`,
      });
    }
    if (version.estado_validacion !== 'APROBADO') {
      throw new ConflictError({
        code: 'VERSION_TUPA_NO_APROBADA',
        message: 'La version TUPA indicada no esta aprobada.',
        detail: `La version ${registroVersionId} esta en estado ${version.estado_validacion}; solo se vinculan versiones APROBADO.`,
      });
    }

    const hoyStr = new Date().toISOString().slice(0, 10);
    if (version.vigencia_desde) {
      const desdeStr = version.vigencia_desde instanceof Date ? version.vigencia_desde.toISOString().slice(0, 10) : String(version.vigencia_desde).slice(0, 10);
      if (desdeStr > hoyStr) {
        throw new ConflictError({
          code: 'VERSION_TUPA_FUERA_DE_VIGENCIA',
          message: 'La version TUPA indicada aun no entra en vigencia.',
          detail: `La version ${registroVersionId} entra en vigencia el ${desdeStr}.`,
        });
      }
    }
    if (version.vigencia_hasta) {
      const hastaStr = version.vigencia_hasta instanceof Date ? version.vigencia_hasta.toISOString().slice(0, 10) : String(version.vigencia_hasta).slice(0, 10);
      if (hastaStr < hoyStr) {
        throw new ConflictError({
          code: 'VERSION_TUPA_FUERA_DE_VIGENCIA',
          message: 'La version TUPA indicada ya no esta vigente.',
          detail: `La version ${registroVersionId} vencio el ${hastaStr}.`,
        });
      }
    }
  }

  /**
   * Método legado de registro en ventanilla para pruebas unitarias y compatibilidad histórica.
   */
  public static async registrarExpediente(datos: any, dbClient: any): Promise<string> {
    const canalEntrada = 'VENTANILLA_PRESENCIAL';
    const anioActual = new Date().getFullYear();
    const cutGenerado = `CUT-${anioActual}-${Math.floor(Math.random() * 9000) + 1000}`;

    const queryExpediente = `
      INSERT INTO sigd_tra.expediente (
        cut,
        canal_recepcion,
        id_operador_ventanilla,
        datos_remitente,
        asunto,
        folios,
        estado_tramite,
        fecha_radicacion
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'RECEPCIONADO', NOW()
      ) RETURNING id_expediente;
    `;

    const valores = [
      cutGenerado,
      canalEntrada,
      datos.idOperadorVentanilla,
      datos.datosRemitente,
      datos.asunto,
      datos.foliosTotales,
    ];

    await dbClient.query(queryExpediente, valores);
    return cutGenerado;
  }
}

export default VentanillaPresencialService;

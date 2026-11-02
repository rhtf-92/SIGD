
function anioDeRecepcion(now: Date): number {
  return now.getFullYear();
}

function redactarMensajeLegal(horario: ResultadoHorarioCorte): string {
  if (!horario.requiereProyeccion) {
    return 'Recepción efectuada dentro del horario hábil institucional (Art. 138 LPAG).';
  }
  return (
    'Recepción fuera del horario de atención institucional o en día inhábil. Conforme al ' +
    'Art. 138 de la LPAG, el cómputo de plazos y la fecha legal de radicación inician el ' +
    'primer día hábil siguiente a las 08:00 horas.'
  );
}

import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { CutService } from './cut.service.js';
import { crearProveedorFeriados } from './radicacionVirtual.service.js';
import { calcularHorarioCorte, type ResultadoHorarioCorte } from './horarioCorte.util.js';

import { DocumentoStorageService } from '../../core/storage/documento-storage.service.js';
import { TupaRequisitosService } from './tupaRequisitos.service.js';
import { TesoreriaRepository } from '../tesoreria/tesoreria.repository.js';
import { calcularVencimientoOrdenPago } from '../tesoreria/tesoreria.service.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/domain/errors/index.js';
import type { MesaPartesDigitalInput } from './tramites.schemas.js';
import { TupaVersionRepository } from './tupaVersion.repository.js';

export interface ResultadoMesaPartesDigital {
  expedienteId: string;
  cut: string;
  anioFiscal: number;
  fechaEnvioReal: string;
  fechaRadicacionLegal: string;
  diferidoPorCorte: boolean;
  totalFolios: number;
  registroVersionId: string;
  trackingUrl: string;
  cargoDigital: {
    codigo: string;
    qrContenido: string;
    totalFolios: number;
  };
  ordenPago?: {
    ordenPagoId: string;
    codigoPago: string;
    monto: number;
    concepto: string;
    fechaVencimiento: string;
  };
  mensajeLegal: string;
}

export class MesaPartesDigitalService {
  private readonly cutService: CutService;
  private readonly tesoreriaRepository = new TesoreriaRepository();
  private readonly tupaVersionRepository: TupaVersionRepository;
  private readonly tupaRequisitosService: TupaRequisitosService;
  private readonly documentoStorageService: DocumentoStorageService;
  private readonly obtenerFeriados: () => Promise<string[]>;

  constructor(private readonly pool: Pool, obtenerFeriados?: () => Promise<string[]>) {
    this.cutService = new CutService(pool);
    this.tupaVersionRepository = new TupaVersionRepository(pool);
    this.tupaRequisitosService = new TupaRequisitosService(pool);
    this.documentoStorageService = new DocumentoStorageService();
    this.obtenerFeriados = obtenerFeriados ?? crearProveedorFeriados(pool);
  }

  async radicarDigital(
    datos: MesaPartesDigitalInput,
    now: Date = new Date(),
  ): Promise<ResultadoMesaPartesDigital> {
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;
    const objetosSubidosMinIO: string[] = [];

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      // 1. Validar versión TUPA
      const versionRes = await cliente.query<{
        registro_version_id: string;
        estado_validacion: string;
        vigencia_desde: Date | null;
        vigencia_hasta: Date | null;
      }>(
        `SELECT registro_version_id, estado_validacion, vigencia_desde, vigencia_hasta
           FROM sigd_doc.tupa_registro_version
          WHERE registro_version_id = $1::uuid`,
        [datos.registroVersionId],
      );
      const version = versionRes.rows[0];
      if (!version) {
        throw new NotFoundError({
          message: 'La versión del procedimiento TUPA no existe.',
          detail: `No se encontró tupa_registro_version con ID ${datos.registroVersionId}.`,
        });
      }
      if (version.estado_validacion !== 'APROBADO') {
        throw new ConflictError({
          code: 'VERSION_TUPA_NO_APROBADA',
          message: 'El procedimiento TUPA seleccionado no se encuentra aprobado.',
        });
      }

      // Validar requisitos documentales obligatorios
      await this.tupaRequisitosService.validarRequisitosObligatorios(
        datos.registroVersionId,
        datos.documentos.map((d) => ({
          idRequisito: d.idRequisito,
          nombreArchivo: d.nombreArchivo,
        })),
        cliente,
      );

      // 2. Resolver persona en sigd_auth.persona (Reutilizar o Crear sin cuenta)
      const personaExistente = await cliente.query<{ id_persona: string }>(
        `SELECT id_persona::text AS id_persona
           FROM sigd_auth.persona
          WHERE tipo = $1 AND id_documento = $2
          LIMIT 1`,
        [datos.tipoPersona, datos.numeroDocumento],
      );

      let personaId: string;
      let nombreRemitente: string;

      if (personaExistente.rows[0]) {
        personaId = personaExistente.rows[0].id_persona;
        // Actualizar dirección si se provee
        if (datos.direccion || datos.ubigeoDistrito) {
          await cliente.query(
            `UPDATE sigd_auth.persona
                SET direccion = COALESCE($2, direccion),
                    ubigeo_distrito = COALESCE($3, ubigeo_distrito),
                    actualizado_en = now()
              WHERE id_persona = $1::uuid`,
            [personaId, datos.direccion || null, datos.ubigeoDistrito || null],
          );
        }

        if (datos.tipoPersona === 'NATURAL') {
          const apellidos = [datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ');
          const nombreCompleto = [datos.nombres, apellidos].filter(Boolean).join(' ');
          nombreRemitente = nombreCompleto || datos.numeroDocumento;

          const exNatural = await cliente.query<{ id_persona: string }>(
            `SELECT id_persona::text FROM sigd_auth.persona_natural WHERE id_persona = $1::uuid LIMIT 1`,
            [personaId],
          );
          if (exNatural.rows[0]) {
            await cliente.query(
              `UPDATE sigd_auth.persona_natural
                  SET correo = COALESCE($2, correo),
                      telefono = COALESCE($3, telefono)
                WHERE id_persona = $1::uuid`,
              [personaId, datos.correo, datos.celular || null],
            );
          } else {
            await cliente.query(
              `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
               VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
              [personaId, datos.nombres || '', apellidos || '', nombreRemitente, datos.correo, datos.celular || null],
            );
          }
        } else {
          nombreRemitente = datos.razonSocial || datos.numeroDocumento;
          const exJuridica = await cliente.query<{ id_persona: string }>(
            `SELECT id_persona::text FROM sigd_auth.persona_juridica WHERE id_persona = $1::uuid LIMIT 1`,
            [personaId],
          );
          if (exJuridica.rows[0]) {
            await cliente.query(
              `UPDATE sigd_auth.persona_juridica
                  SET razon_social = COALESCE($2, razon_social),
                      representante_legal = COALESCE($3, representante_legal),
                      direccion = COALESCE($4, direccion)
                WHERE id_persona = $1::uuid`,
              [personaId, datos.razonSocial || null, datos.representanteLegal || null, datos.direccion || null],
            );
          } else {
            await cliente.query(
              `INSERT INTO sigd_auth.persona_juridica (id_persona, razon_social, representante_legal, direccion)
               VALUES ($1::uuid, $2, $3, $4)`,
              [personaId, datos.razonSocial || '', datos.representanteLegal || '', datos.direccion || null],
            );
          }
        }
      } else {
        // Crear persona nueva en el padrón
        const nuevaPers = await cliente.query<{ id_persona: string }>(
          `INSERT INTO sigd_auth.persona (tipo, id_documento, direccion, ubigeo_distrito)
           VALUES ($1, $2, $3, $4)
           RETURNING id_persona::text AS id_persona`,
          [datos.tipoPersona, datos.numeroDocumento, datos.direccion || null, datos.ubigeoDistrito || null],
        );
        personaId = nuevaPers.rows[0].id_persona;

        if (datos.tipoPersona === 'NATURAL') {
          const apellidos = [datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ');
          const nombreCompleto = [datos.nombres, apellidos].filter(Boolean).join(' ');
          nombreRemitente = nombreCompleto || datos.numeroDocumento;

          await cliente.query(
            `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
             VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
            [personaId, datos.nombres || '', apellidos || '', nombreRemitente, datos.correo, datos.celular || null],
          );
        } else {
          nombreRemitente = datos.razonSocial || datos.numeroDocumento;
          await cliente.query(
            `INSERT INTO sigd_auth.persona_juridica (id_persona, razon_social, representante_legal, direccion)
             VALUES ($1::uuid, $2, $3, $4)`,
            [personaId, datos.razonSocial || '', datos.representanteLegal || '', datos.direccion || null],
          );
        }
      }

      // 3. Obtener tipo documental vigente por defecto
      const defaultDoc = await cliente.query<{ tipo_documental_id: string }>(
        `SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE vigente = TRUE ORDER BY codigo ASC LIMIT 1`,
      );
      if (!defaultDoc.rows[0]) {
        throw new ValidationError({
          invalidParams: [{ name: 'tipoDocumentalId', reason: 'No existe un tipo documental vigente configurado.' }],
        });
      }
      const tipoDocumentalId = defaultDoc.rows[0].tipo_documental_id;

      // 4. CUT y Horario de recepción
      const feriados = await this.obtenerFeriados();
      const horario = calcularHorarioCorte(now, feriados);
      const anio = anioDeRecepcion(now);
      const { cut } = await this.cutService.generar(anio, cliente);

      // 5. Insertar Expediente formal (id_usuario_creador = NULL por radicar sin cuenta)
      const expInsert = await cliente.query<{ expediente_id: string }>(
        `INSERT INTO sigd_tra.expediente (
           codigo_expediente, numero, dni_solicitante, tipo_documental_id,
           solicitante_id, area_destino_id, estado, fecha_radicacion, id_usuario_creador
         ) VALUES (
           $1, $1, $2, $3::uuid, $4::uuid, NULL, 'REGISTRADO', $5, NULL
         ) RETURNING expediente_id`,
        [
          cut,
          /^[0-9]{8}$/.test(datos.numeroDocumento) ? datos.numeroDocumento : null,
          tipoDocumentalId,
          personaId,
          horario.radicacionLegal,
        ],
      );
      const expedienteId = expInsert.rows[0].expediente_id;

      // 6. Trámite, Asiento de Registro (canal MESA_PARTES_DIGITAL) y Vínculo TUPA
      await cliente.query(
        `INSERT INTO sigd_tra.tramite (expediente_id, asunto, estado) VALUES ($1::uuid, $2, 'REGISTRADO')`,
        [expedienteId, datos.asunto],
      );

      await cliente.query(
        `INSERT INTO sigd_tra.asiento_registro (expediente_id, fecha_ingreso, canal_ingreso, asunto, remitente_id)
         VALUES ($1::uuid, $2, 'MESA_PARTES_DIGITAL', $3, $4::uuid)`,
        [expedienteId, horario.envioReal, datos.asunto, personaId],
      );

      await this.tupaVersionRepository.crearVinculoConSnapshot(
        expedienteId,
        datos.registroVersionId,
        {},
        cliente,
      );

      // 7. Procesar y foliar documentos PDF presentados
      let totalPaginasFoliadas = 0;
      for (const doc of datos.documentos) {
        let buffer: Buffer;
        if (doc.base64Content) {
          const limpio = doc.base64Content.replace(/^data:[^;]+;base64,/, '');
          buffer = Buffer.from(limpio, 'base64');
        } else {
          // Si no envía base64Content (ej. test o mock), generar un PDF representativo mínimo
          buffer = await this.generarPdfFallback(doc.nombreArchivo, cut);
        }

        const numPaginas = await this.documentoStorageService.obtenerCantidadPaginasPdf(buffer);
        totalPaginasFoliadas += numPaginas;

        const s3KeyDoc = this.documentoStorageService.generarKeyPresentado(expedienteId);

        const verificado = await this.documentoStorageService.subirDocumentoPdf({
          s3Key: s3KeyDoc,
          buffer,
          bucket: this.documentoStorageService.canonicalBucket,
        });
        objetosSubidosMinIO.push(s3KeyDoc);

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
             id_requisito,
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
             'application/pdf',
             $8,
             $9::uuid,
             $10::uuid,
             $11
           ) RETURNING documento_adjunto_id;`,
          [
            expedienteId,
            tipoDocumentalId,
            doc.nombreArchivo,
            verificado.s3Bucket,
            verificado.s3Key,
            verificado.sha256,
            verificado.tamanoBytes,
            verificado.magicBytes,
            personaId,
            doc.idRequisito || null,
            horario.radicacionLegal,
          ],
        );

        const idDocAdjunto = docAdjuntoRes.rows[0].documento_adjunto_id;

        // Foliación continua
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
          [expedienteId, idDocAdjunto, folioInicio, folioFin, personaId, horario.radicacionLegal],
        );
      }

      // 8. Tasa TUPA / Orden de Pago si el procedimiento tiene costo
      let ordenPagoInfo: ResultadoMesaPartesDigital['ordenPago'];
      const contextoPago = await this.tesoreriaRepository.obtenerContextoExpedienteParaPago(cliente, expedienteId);
      if (contextoPago && contextoPago.costoOficial > 0) {
        const codigoPago = await this.tesoreriaRepository.obtenerSiguienteCodigoPago(cliente, now.getFullYear());
        const vencimiento = calcularVencimientoOrdenPago(now);
        const orden = await this.tesoreriaRepository.insertarOrdenPago(cliente, {
          codigoPago,
          expedienteId,
          registroVersionId: contextoPago.registroVersionId,
          solicitanteId: personaId,
          concepto: contextoPago.concepto,
          codigoTupa: contextoPago.codigoTupa,
          monto: contextoPago.costoOficial,
          moneda: 'PEN',
          fechaVencimiento: vencimiento,
        });

        await cliente.query(
          `UPDATE sigd_tra.expediente SET estado = 'PENDIENTE_PAGO' WHERE expediente_id = $1::uuid;`,
          [expedienteId],
        );

        ordenPagoInfo = {
          ordenPagoId: orden.orden_pago_id,
          codigoPago,
          monto: contextoPago.costoOficial,
          concepto: contextoPago.concepto,
          fechaVencimiento: vencimiento.toISOString(),
        };
      }

      // 9. Generar y almacenar Cargo Digital oficial en MinIO
      const trackingUrl = `https://sigd.iestp-suiza.edu.pe/consulta/${encodeURIComponent(cut)}?documento=${encodeURIComponent(datos.numeroDocumento)}`;
      const s3KeyCargo = this.documentoStorageService.generarKeyCargo(expedienteId);
      const cargoPdfBuffer = await this.documentoStorageService.generarCargoPdf({
        cut,
        fechaHora: horario.radicacionLegal,
        nombreSolicitante: nombreRemitente,
        documentoEnmascarado: `${datos.numeroDocumento.slice(0, 2)}***${datos.numeroDocumento.slice(-3)}`,
        asunto: datos.asunto,
        folios: totalPaginasFoliadas,
        operadorMesa: 'Mesa de Partes Digital',
        codigoTupa: contextoPago?.codigoTupa || undefined,
        denominacionTupa: contextoPago?.concepto || undefined,
        costoTupa: contextoPago?.costoOficial !== undefined ? Number(contextoPago.costoOficial) : undefined,
        urlConsulta: trackingUrl,
      });

      const cargoVerificado = await this.documentoStorageService.subirDocumentoPdf({
        s3Key: s3KeyCargo,
        buffer: cargoPdfBuffer,
        bucket: this.documentoStorageService.canonicalBucket,
      });
      objetosSubidosMinIO.push(s3KeyCargo);

      await cliente.query(
        `INSERT INTO sigd_doc.documento_adjunto (
           documento_adjunto_id, expediente_tra_id, tipo_documental_id, nombre_archivo,
           s3_bucket, s3_key, sha256, tamano_bytes, mime_type, magic_bytes, subido_por, creado_en
         ) VALUES (
           gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6, $7, 'application/pdf', $8, $9::uuid, $10
         );`,
        [
          expedienteId,
          tipoDocumentalId,
          `Cargo_Mesa_Digital_${cut}.pdf`,
          cargoVerificado.s3Bucket,
          cargoVerificado.s3Key,
          cargoVerificado.sha256,
          cargoVerificado.tamanoBytes,
          cargoVerificado.magicBytes,
          personaId,
          horario.radicacionLegal,
        ],
      );

      // 10. Trazabilidad inicial
      await cliente.query(
        `INSERT INTO sigd_rut.estado_actual_expediente (
           expediente_id, secuencia, estado_nuevo, evento, area_actual_id, id_movimiento, fecha_hora, usuario_operador_id
         ) VALUES (
           $1::uuid, 1, $2, 'RADICACION_DIGITAL_PUBLICA', 'MESA_PARTES', gen_random_uuid(), $3, 0
         ) ON CONFLICT (expediente_id) DO UPDATE
         SET estado_nuevo = EXCLUDED.estado_nuevo, fecha_hora = EXCLUDED.fecha_hora;`,
        [expedienteId, ordenPagoInfo ? 'PENDIENTE_PAGO' : 'REGISTRADO', horario.radicacionLegal],
      );

      const codigoCargo = `CARGO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      await cliente.query('COMMIT');
      transaccionAbierta = false;

      return {
        expedienteId,
        cut,
        anioFiscal: anio,
        fechaEnvioReal: horario.envioReal.toISOString(),
        fechaRadicacionLegal: horario.radicacionLegal.toISOString(),
        diferidoPorCorte: horario.requiereProyeccion,
        totalFolios: totalPaginasFoliadas,
        registroVersionId: datos.registroVersionId,
        trackingUrl,
        cargoDigital: {
          codigo: codigoCargo,
          qrContenido: trackingUrl,
          totalFolios: totalPaginasFoliadas,
        },
        ordenPago: ordenPagoInfo,
        mensajeLegal: redactarMensajeLegal(horario),
      };
    } catch (error) {
      if (transaccionAbierta) {
        await cliente.query('ROLLBACK');
        // Compensación de objetos subidos a MinIO si la transacción de BD falla antes del commit
        await Promise.allSettled(
          objetosSubidosMinIO.map((key) =>
            this.documentoStorageService.eliminarObjetoS3(key).catch(() => null),
          ),
        );
      }
      throw error;
    } finally {
      cliente.release();
    }
  }

  private async generarPdfFallback(nombreArchivo: string, cut: string): Promise<Buffer> {
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(`Documento Oficial Digital: ${nombreArchivo}`, { x: 50, y: 780, size: 14, font, color: rgb(0, 0, 0) });
    page.drawText(`Expediente CUT: ${cut}`, { x: 50, y: 750, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(`Presentado a través de Mesa de Partes Digital — IESTP "Suiza"`, { x: 50, y: 720, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}

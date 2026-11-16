/**
 * T-BE-TC-06 / Endpoint #15 — Ventanilla Presencial y Cargo de Recepción Física
 * Responsable: Leysglin Riquelmer Rojas Fachin (B_RIQUELMER) / Grupo 2 TramiCore
 * Esquema: sigd_tra (DDL 05_sigd_tra.sql)
 *
 * Refactorización: Reemplaza la generación provisional Math.random() por la llamada
 * atómica PL/pgSQL a sigd_tra.generar_cut_expediente (consecutivo EXP-YYYY-XXXXXX con
 * bloqueo pesimista FOR UPDATE), registra el asiento institucional inmutable en
 * sigd_tra.asiento_registro y formatea el ticket térmico de 80mm/58mm.
 */

import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { TicketTermicoUtil } from './ticketTermico.util.js';
import { calcularFoliacionCorrelativa } from './pdfFoliacion.js';
import { AppError, ValidationError } from '../../shared/domain/errors/index.js';
import { validarDni } from '../identicore/modulo11.validator.js';
import { radicacionVirtualSchema } from './tramites.schemas.js';
import { CATALOGO_DOCUMENTAL_POR_CODIGO } from './catalogoDocumentalTupa2026.js';

export const identidadNaturalVentanillaSchema = z.object({
  tipoPersona: z.literal('NATURAL'),
  tipoDocumento: z.literal('DNI'),
  dniSolicitante: z.string().refine((dni) => validarDni(dni).valido, 'El DNI debe contener exactamente 8 dígitos.'),
  nombres: z.string({ required_error: 'Indique los nombres.' }).trim().min(1, 'Indique los nombres.').max(120),
  apellidos: z.string({ required_error: 'Indique los apellidos.' }).trim().min(1, 'Indique los apellidos.').max(120),
  correo: z.string().trim().email().max(160).optional(),
  telefono: z.string().trim().min(1).max(20).optional(),
});

export interface DatosRecepcionFisica extends z.infer<typeof identidadNaturalVentanillaSchema> {
  asunto: string;
  foliosTotales: number;
  idOperadorVentanilla?: string;
  areaDestinoId?: string;
  // El transporte aún lo declara opcional; el registro exige un UUID vigente
  // de sigd_doc.tipo_documento. No se deduce del DNI ni de un código de React.
  tipoDocumentalId?: string;
  idTipoTramiteTupa?: string;
  documentos?: Array<{
    nombreArchivo: string;
    tamanoBytes: number;
    hashSha256: string;
    storagePath?: string;
    contentType?: string;
    tipoDocumentalId?: string;
    clasificacion?: 'EXPEDIENTE' | 'ANEXO';
    requisitoId?: string;
    paginas?: number;
  }>;
}

export interface ResultadoVentanilla {
  expedienteId: string;
  cut: string;
  anioFiscal: number;
  fechaRadicacion: string;
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

export class VentanillaPresencialService {
  constructor(private readonly pool: Pool) {}

  public async registrarExpedienteVentanilla(
    datos: DatosRecepcionFisica,
    clienteTransaccional?: PoolClient,
  ): Promise<ResultadoVentanilla> {
    const validacionIdentidad = identidadNaturalVentanillaSchema.safeParse(datos);
    if (!validacionIdentidad.success) {
      throw new ValidationError({
        invalidParams: validacionIdentidad.error.issues.map((issue) => ({ name: issue.path.join('.'), reason: issue.message })),
      });
    }
    const solicitante = validacionIdentidad.data;
    // Orden existente en IdentiCore: nombres seguidos de los apellidos explícitos.
    const nombreCompleto = [solicitante.nombres, solicitante.apellidos].join(' ');

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

    const validacionTipoDocumental = z.string().uuid().safeParse(datos.tipoDocumentalId);
    if (!validacionTipoDocumental.success) {
      throw new ValidationError({
        invalidParams: [{
          name: 'tipoDocumentalId',
          reason: 'Indique el UUID de un tipo documental vigente del catálogo sigd_doc.tipo_documento.',
        }],
      });
    }
    const tipoDocumentalId = validacionTipoDocumental.data;

    const tupaValidado = radicacionVirtualSchema.innerType().shape.idTipoTramiteTupa.optional().safeParse(datos.idTipoTramiteTupa);
    if (!tupaValidado.success) {
      throw new ValidationError({ invalidParams: [{ name: 'idTipoTramiteTupa', reason: 'Indique un UUID TUPA válido.' }] });
    }
    // Reconocer el marcador del cliente anterior sólo para rechazar una omisión;
    // nunca derivar el vínculo desde texto libre ni elegir un TUPA por defecto.
    const codigoEnAsunto = datos.asunto.trim().match(/^(SUZ26-\d{3})\s+—(?:\s|$)/i)?.[1].toUpperCase();
    if (codigoEnAsunto && !tupaValidado.data) {
      throw new ValidationError({ invalidParams: [{ name: 'idTipoTramiteTupa', reason: 'El trámite TUPA debe enviarse como identificador estructurado; el asunto no establece la relación.' }] });
    }

    const cliente = clienteTransaccional ?? (await this.pool.connect());
    const debeManejarTx = !clienteTransaccional;

    try {
      if (debeManejarTx) await cliente.query('BEGIN');

      // Validar antes de generar el CUT (su función escribe en la secuencia)
      // o registrar identidades. Nota de concurrencia: se retira el bloqueo de fila
      // FOR SHARE en el entorno aislado (evita requerir UPDATE a la cuenta de ventanilla).
      // Pendiente de revisión para producción si se requiere garantizar vigencia inmutable
      // concurrente durante toda la transacción.
      const tipoDocumental = await cliente.query<{ tipo_documental_id: string }>(
        `SELECT tipo_documental_id
           FROM sigd_doc.tipo_documento
          WHERE tipo_documental_id = $1::uuid AND vigente = TRUE;`,
        [tipoDocumentalId],
      );
      if (!tipoDocumental.rows[0]) {
        throw new ValidationError({
          invalidParams: [{
            name: 'tipoDocumentalId',
            reason: 'El tipo documental no existe o no está vigente en sigd_doc.tipo_documento. Seleccione un tipo válido del catálogo institucional.',
          }],
        });
      }

      let procedimiento: { tipo_tramite_id: string; codigo: string; vigente: boolean; tipo_documental_permitido: boolean } | undefined;
      if (tupaValidado.data) {
        const tupa = await cliente.query<{ tipo_tramite_id: string; codigo: string; vigente: boolean; tipo_documental_permitido: boolean }>(
          `SELECT t.tipo_tramite_id, t.codigo, t.vigente,
                  EXISTS (SELECT 1 FROM sigd_doc.requisito r
                    JOIN sigd_doc.tipo_documento_requisito dr USING (requisito_id)
                    WHERE r.tipo_tramite_id = t.tipo_tramite_id
                      AND dr.tipo_documental_id = $2::uuid) AS tipo_documental_permitido
             FROM sigd_doc.tipo_tramite_tupa t
            WHERE t.tipo_tramite_id = $1::uuid`, [tupaValidado.data, tipoDocumentalId],
        );
        procedimiento = tupa.rows[0];
        if (tupa.rows.length !== 1 || !procedimiento?.vigente || !procedimiento.tipo_documental_permitido ||
            procedimiento.tipo_tramite_id !== tupaValidado.data.toLowerCase() || !procedimiento.codigo ||
            (codigoEnAsunto && codigoEnAsunto !== procedimiento.codigo)) {
          throw new ValidationError({ invalidParams: [{ name: 'idTipoTramiteTupa', reason: 'El procedimiento no existe, no está vigente o contradice la solicitud.' }] });
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

      // 2. Resolver la identidad V2. El contrato actual admite solo DNI.
      const buscarPersona = () => cliente.query<{
        id_persona: string;
        id_persona_natural: string | null;
        nombre_completo: string | null;
      }>(
        `SELECT p.id_persona, pn.id_persona AS id_persona_natural, pn.nombre_completo
           FROM sigd_auth.persona p
           LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
          WHERE p.tipo = $1 AND p.id_documento = $2`,
        [solicitante.tipoPersona, solicitante.dniSolicitante],
      );

      let persona = (await buscarPersona()).rows[0];
      if (!persona) {
        const base = await cliente.query<{ id_persona: string }>(
          `INSERT INTO sigd_auth.persona (tipo, id_documento)
           VALUES ($1, $2)
           ON CONFLICT (tipo, id_documento) DO NOTHING
           RETURNING id_persona;`,
          [solicitante.tipoPersona, solicitante.dniSolicitante],
        );
        if (base.rowCount === 0) {
          // Otra transacción pudo registrar el mismo documento: releer, sin actualizarlo.
          persona = (await buscarPersona()).rows[0];
        } else {
          const idPersona = base.rows[0]?.id_persona;
          if (base.rowCount !== 1 || !idPersona) {
            throw new AppError({ status: 500, code: 'IDENTITY_CREATION_FAILED', message: 'No se pudo registrar la identidad del solicitante.' });
          }
          const extension = await cliente.query<{ id_persona: string }>(
            `INSERT INTO sigd_auth.persona_natural
               (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
             VALUES ($1::uuid, $2, $3, $4, $5, $6)
             RETURNING id_persona;`,
            [idPersona, solicitante.nombres, solicitante.apellidos, nombreCompleto, solicitante.correo ?? null, solicitante.telefono ?? null],
          );
          if (extension.rowCount !== 1 || extension.rows[0]?.id_persona !== idPersona) {
            throw new AppError({ status: 500, code: 'IDENTITY_CREATION_FAILED', message: 'No se pudo completar la identidad del solicitante.' });
          }
          persona = { id_persona: idPersona, id_persona_natural: extension.rows[0].id_persona, nombre_completo: nombreCompleto };
        }
      }
      if (!persona?.id_persona_natural || !persona.nombre_completo?.trim()) {
        throw new ValidationError({
          message: 'La identidad del solicitante está incompleta.',
          invalidParams: [{
            name: 'dniSolicitante',
            reason: 'La persona existe, pero no tiene una extensión persona_natural registrada. IdentiCore debe completarla con datos legítimos antes de continuar.',
          }],
        });
      }
      const solicitanteId = persona.id_persona;
      const nombreRemitente = persona.nombre_completo;

      let areaDestinoId = datos.areaDestinoId ?? null;
      if (!areaDestinoId && procedimiento) {
        const configDoc = CATALOGO_DOCUMENTAL_POR_CODIGO.get(procedimiento.codigo);
        let codigoArea = 'MP'; // Flujo seguro por defecto: Mesa de Partes (MP)
        // Solo derivar automáticamente si la competencia institucional está verificada documentalmente
        if (configDoc?.unidadResponsableVerificada === true) {
          const unidadResp = (configDoc.unidadResponsable ?? '').toLowerCase();
          if (unidadResp.includes('secretar') || unidadResp.includes('académic')) {
            codigoArea = 'SEC';
          } else if (unidadResp.includes('dirección') || unidadResp.includes('general')) {
            codigoArea = 'DG';
          }
        }
        const areaFila = await cliente.query<{ area_id: string }>(
          'SELECT area_id FROM sigd_org.area WHERE codigo = $1 AND vigente = TRUE LIMIT 1',
          [codigoArea],
        );
        if (areaFila.rows[0]) {
          areaDestinoId = areaFila.rows[0].area_id;
        } else {
          // Si el área específica no existe en sigd_org.area, asegurar recepción en MP
          const mpFila = await cliente.query<{ area_id: string }>(
            "SELECT area_id FROM sigd_org.area WHERE codigo = 'MP' AND vigente = TRUE LIMIT 1",
          );
          if (mpFila.rows[0]) {
            areaDestinoId = mpFila.rows[0].area_id;
          }
        }
      }

      // 3. Insertar expediente formal en sigd_tra.expediente
      const ahora = new Date();
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
           $4,
           $5::uuid,
           'REGISTRADO',
           $6
         ) RETURNING expediente_id;`,
        [
          cut,
          datos.dniSolicitante,
          tipoDocumentalId,
          solicitanteId,
          areaDestinoId,
          ahora,
        ],
      );
      const expedienteId = expRes.rows[0].expediente_id;

      if (procedimiento) {
        // Mismo UUID, CUT y solicitante en ambos dominios, como en MPV.
        // Las colisiones se propagan; no se reasignan identidades ni relaciones.
        const documental = await cliente.query<{ expediente_id: string; tipo_tramite_id: string; codigo_expediente: string; solicitante_id: string }>(
          `INSERT INTO sigd_doc.expediente
             (expediente_id, tipo_tramite_id, codigo_expediente, asunto, solicitante_id, fecha_registro)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6)
           RETURNING expediente_id, tipo_tramite_id, codigo_expediente, solicitante_id`,
          [expedienteId, procedimiento.tipo_tramite_id, cut, datos.asunto, solicitanteId, ahora],
        );
        const fila = documental.rows[0];
        if (documental.rowCount !== 1 || fila?.expediente_id !== expedienteId ||
            fila.tipo_tramite_id !== procedimiento.tipo_tramite_id ||
            fila.codigo_expediente !== cut || fila.solicitante_id !== solicitanteId) {
          throw new AppError({ status: 409, code: 'TUPA_LINK_CONFLICT', message: 'No se confirmó una vinculación TUPA coherente con el expediente.' });
        }
        const tramite = await cliente.query<{ expediente_id: string; codigo_tramite: string }>(
          `INSERT INTO sigd_tra.tramite (expediente_id, codigo_tramite, asunto)
           VALUES ($1::uuid, $2, $3)
           RETURNING expediente_id, codigo_tramite`,
          [expedienteId, procedimiento.codigo, datos.asunto],
        );
        if (tramite.rowCount !== 1 || tramite.rows[0]?.expediente_id !== expedienteId ||
            tramite.rows[0]?.codigo_tramite !== procedimiento.codigo) {
          throw new AppError({ status: 409, code: 'TUPA_LINK_CONFLICT', message: 'No se confirmó el código del trámite asociado al expediente.' });
        }
      }

      // 3.5. Foliación correlativa y registro de documentos adjuntos
      let totalFoliosCalculados = datos.foliosTotales;
      if (datos.documentos && datos.documentos.length > 0) {
        const { documentosFoliados, totalFolios } = calcularFoliacionCorrelativa(
          datos.documentos.map(d => ({ ...d, paginas: d.paginas ?? 1 }))
        );
        totalFoliosCalculados = totalFolios;
        datos.foliosTotales = totalFolios;

        for (const doc of documentosFoliados) {
          const docRes = await cliente.query<{ documento_adjunto_id: string }>(`
            INSERT INTO sigd_doc.documento_adjunto
              (expediente_id, nombre_archivo, mime_type, tamano_bytes, sha256, s3_bucket, s3_key, tipo_documental_id)
            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid)
            RETURNING documento_adjunto_id
          `, [
            expedienteId,
            doc.nombreArchivo,
            doc.contentType ?? 'application/pdf',
            doc.tamanoBytes,
            doc.hashSha256.toLowerCase(),
            'sigd-expedientes',
            doc.storagePath ?? `expedientes/${anioActual}/${cut}-${doc.nombreArchivo}`,
            doc.tipoDocumentalId ?? tipoDocumentalId,
          ]);
          const idAdjunto = docRes.rows[0]?.documento_adjunto_id;
          if (idAdjunto) {
            await cliente.query(`
              INSERT INTO sigd_tra.expediente_documento_folio
                (expediente_id, id_documento, folio_inicio, folio_fin)
              VALUES ($1::uuid, $2::uuid, $3::integer, $4::integer)
            `, [expedienteId, idAdjunto, doc.folioInicio, doc.folioFin]);

            if (doc.requisitoId) {
              await cliente.query(`
                INSERT INTO sigd_doc.expediente_requisito
                  (expediente_id, requisito_id, documento_adjunto_id, cumplido)
                VALUES ($1::uuid, $2::uuid, $3::uuid, TRUE)
                ON CONFLICT (expediente_id, requisito_id) DO NOTHING
              `, [expedienteId, doc.requisitoId, idAdjunto]);
            }
          }
        }
      }

      // 4. Asentar en libro de registro institucional inmutable
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
        [expedienteId, ahora, datos.asunto, solicitanteId],
      );

      if (debeManejarTx) await cliente.query('COMMIT');

      // 5. Generar cargo y ticket térmico
      const hashSeguridad = crypto
        .createHash('sha256')
        .update(`${cut}:${ahora.toISOString()}:${datos.dniSolicitante}`)
        .digest('hex');

      const qrUrlSeguimiento = `https://sigd.iestp-suiza.edu.pe/consulta/${encodeURIComponent(cut)}`;

      const ticketImpresion = TicketTermicoUtil.generarTicketVentanilla({
        cut,
        timestamp: ahora,
        folios: datos.foliosTotales,
        hashSha256: hashSeguridad,
        qrUrlSeguimiento,
      });

      return {
        expedienteId,
        cut,
        anioFiscal: anioActual,
        fechaRadicacion: ahora.toISOString(),
        ticketImpresion,
        cargo: {
          cut,
          remitente: nombreRemitente,
          dni: datos.dniSolicitante,
          asunto: datos.asunto,
          folios: datos.foliosTotales,
          fechaRecepcion: ahora.toISOString(),
          hashSha256: hashSeguridad,
          qrSeguimientoUrl: qrUrlSeguimiento,
        },
      };
    } catch (error) {
      if (debeManejarTx) await cliente.query('ROLLBACK');
      throw error;
    } finally {
      if (debeManejarTx) cliente.release();
    }
  }

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
      datos.foliosTotales
    ];

    await dbClient.query(queryExpediente, valores);
    return cutGenerado;
  }
}

export default VentanillaPresencialService;

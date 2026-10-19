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
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';

export interface DatosRecepcionFisica {
  dniSolicitante: string;
  datosRemitente: string;
  asunto: string;
  foliosTotales: number;
  idOperadorVentanilla?: string;
  areaDestinoId?: string;
  tipoDocumentalId?: string;
  registroVersionId?: string;
}

export interface ResultadoVentanilla {
  expedienteId: string;
  cut: string;
  anioFiscal: number;
  fechaRadicacion: string;
  registroVersionId?: string | null;
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

export class VentanillaPresencialService {
  constructor(private readonly pool: Pool) {}

  public async registrarExpedienteVentanilla(
    datos: DatosRecepcionFisica,
    clienteTransaccional?: PoolClient,
  ): Promise<ResultadoVentanilla> {
    if (!/^[0-9]{8}$/.test(datos.dniSolicitante)) {
      throw new ValidationError({
        invalidParams: [{ name: 'dniSolicitante', reason: 'El DNI debe contener exactamente 8 dígitos.' }],
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

      // Validar registroVersionId si fue provisto
      if (datos.registroVersionId) {
        await this.verificarVersionTupa(cliente, datos.registroVersionId);
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

      // 2. Resolver o registrar la persona del padrón
      const personaExistente = await cliente.query<FilaPersona>(
        `SELECT id_persona::text AS id_persona
           FROM sigd_auth.persona
          WHERE tipo = 'NATURAL' AND id_documento = $1
          LIMIT 1`,
        [datos.dniSolicitante],
      );

      let solicitanteId: string;
      if (personaExistente.rows[0]) {
        solicitanteId = personaExistente.rows[0].id_persona;
      } else {
        const nuevaPersona = await cliente.query<FilaPersona>(
          `INSERT INTO sigd_auth.persona (tipo, id_documento)
           VALUES ('NATURAL', $1)
           RETURNING id_persona::text AS id_persona;`,
          [datos.dniSolicitante],
        );
        solicitanteId = nuevaPersona.rows[0].id_persona;
      }

      // 3. Insertar expediente con el contrato real de 05
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
           $4::uuid,
           NULLIF($5::text, '')::uuid,
           'REGISTRADO',
           $6
         ) RETURNING expediente_id;`,
        [
          cut,
          datos.dniSolicitante,
          tipoDocId,
          solicitanteId,
          datos.areaDestinoId ?? null,
          ahora,
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
        [expedienteId, ahora, datos.asunto, solicitanteId],
      );

      // 5. Vincular con TUPA si aplica
      if (datos.registroVersionId) {
        await cliente.query(
          `INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id)
           VALUES ($1::uuid, $2::uuid);`,
          [expedienteId, datos.registroVersionId],
        );
      }

      if (debeManejarTx) await cliente.query('COMMIT');

      // 6. Generar cargo y ticket térmico
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
        registroVersionId: datos.registroVersionId ?? null,
        ticketImpresion,
        cargo: {
          cut,
          remitente: datos.datosRemitente,
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

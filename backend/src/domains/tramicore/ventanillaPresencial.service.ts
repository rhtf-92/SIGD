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
import { TicketTermicoUtil } from './ticketTermico.util.js';
import { AppError, ValidationError } from '../../shared/domain/errors/index.js';

export interface DatosRecepcionFisica {
  dniSolicitante: string;
  datosRemitente: string;
  asunto: string;
  foliosTotales: number;
  idOperadorVentanilla?: string;
  areaDestinoId?: string;
  tipoDocumentalId?: string;
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

      // 2. Resolver o registrar persona solicitante (DDL real 02_sigd_auth.sql:
      //    persona(tipo, id_documento) + persona_natural(nombres, apellidos, nombre_completo)).
      //    El DNI vive en persona.id_documento, no en persona_natural.
      let solicitanteId: string;
      const personaExistente = await cliente.query<{ id_persona: string }>(
        `SELECT id_persona FROM sigd_auth.persona
          WHERE tipo = 'NATURAL' AND id_documento = $1 LIMIT 1`,
        [datos.dniSolicitante],
      );

      if (personaExistente.rows[0]) {
        solicitanteId = personaExistente.rows[0].id_persona;
      } else {
        const nombreLimpio = datos.datosRemitente.trim().slice(0, 120) || 'Ciudadano Administrado';
        const nuevaPersona = await cliente.query<{ id_persona: string }>(
          `INSERT INTO sigd_auth.persona (tipo, id_documento)
           VALUES ('NATURAL', $1)
           ON CONFLICT (tipo, id_documento) DO NOTHING
           RETURNING id_persona;`,
          [datos.dniSolicitante],
        );
        solicitanteId =
          nuevaPersona.rows[0]?.id_persona ??
          (
            await cliente.query<{ id_persona: string }>(
              `SELECT id_persona FROM sigd_auth.persona
                WHERE tipo = 'NATURAL' AND id_documento = $1 LIMIT 1`,
              [datos.dniSolicitante],
            )
          ).rows[0].id_persona;

        await cliente.query(
          `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo)
           VALUES ($1, $2, 'REGISTRADO', $2)
           ON CONFLICT (id_persona) DO NOTHING;`,
          [solicitanteId, nombreLimpio],
        );
      }

      // 3. Insertar expediente formal en sigd_tra.expediente (DDL real 05_sigd_tra.sql).
      //    tipo_documental_id es NOT NULL sin FK: se conserva el UUID provisto o el
      //    marcador histórico cuando ventanilla no lo envía.
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
           COALESCE($3::uuid, '00000000-0000-0000-0000-000000000001'::uuid),
           $4,
           $5::uuid,
           'REGISTRADO',
           $6
         ) RETURNING expediente_id;`,
        [
          cut,
          datos.dniSolicitante,
          datos.tipoDocumentalId ?? null,
          solicitanteId,
          datos.areaDestinoId ?? null,
          ahora,
        ],
      );
      const expedienteId = expRes.rows[0].expediente_id;

      // 4. Asentar en libro de registro institucional inmutable (DDL real 05_sigd_tra.sql:
      //    asiento_registro(expediente_id, canal_ingreso, asunto, remitente_id).
      //    canal_ingreso solo admite MESA_VIRTUAL | MESA_PRESENCIAL.
      await cliente.query(
        `INSERT INTO sigd_tra.asiento_registro (
           expediente_id,
           canal_ingreso,
           asunto,
           remitente_id,
           fecha_ingreso
         ) VALUES (
           $1,
           'MESA_PRESENCIAL',
           $2,
           $3,
           $4
         );`,
        [expedienteId, datos.asunto, solicitanteId, ahora],
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
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

      let solicitanteId: string;
      const personaExistente = await cliente.query<{ id_persona: string }>(
        `SELECT p.id_persona::text AS id_persona
           FROM sigd_auth.persona p
          WHERE p.tipo = 'NATURAL' AND p.id_documento = $1
          LIMIT 1`,
        [datos.dniSolicitante],
      );

      if (personaExistente.rows[0]) {
        solicitanteId = personaExistente.rows[0].id_persona;
      } else {
        const nuevaPersona = await cliente.query<{ id_persona: string }>(
          `INSERT INTO sigd_auth.persona (tipo, id_documento)
           VALUES ('NATURAL', $1)
           RETURNING id_persona::text AS id_persona;`,
          [datos.dniSolicitante],
        );
        solicitanteId = nuevaPersona.rows[0].id_persona;

        await cliente.query(
          `INSERT INTO sigd_auth.persona_natural
             (id_persona, nombres, apellidos, nombre_completo)
           VALUES ($1, $2, '', $2)
           ON CONFLICT (id_persona) DO NOTHING;`,
          [solicitanteId, datos.datosRemitente],
        );
      }

      const tipoDocumentalId = await this.obtenerTipoDocumental(cliente, datos.tipoDocumentalId);

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
            $3,
            $4,
            $5::uuid,
           'RECEPCIONADO',
           $6
         ) RETURNING expediente_id;`,
        [
          cut,
          datos.dniSolicitante,
          tipoDocumentalId,
          solicitanteId,
          datos.areaDestinoId ?? null,
          ahora,
        ],
      );
      const expedienteId = expRes.rows[0].expediente_id;

      await cliente.query(
        `INSERT INTO sigd_tra.asiento_registro
           (expediente_id, canal_ingreso, asunto, remitente_id, fecha_ingreso)
          VALUES ($1, 'MESA_PRESENCIAL', $2, $3, $4)`,
        [expedienteId, datos.asunto, solicitanteId, ahora],
      );

      await cliente.query(
        `INSERT INTO sigd_tra.tramite
           (expediente_id, codigo_tramite, asunto, estado)
          VALUES ($1, $2, $3, 'REGISTRADO')`,
        [expedienteId, cut, datos.asunto],
      );

      if (debeManejarTx) await cliente.query('COMMIT');

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

  private async obtenerTipoDocumental(
    cliente: PoolClient,
    tipoDocumentalId?: string,
  ): Promise<string> {
    if (tipoDocumentalId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tipoDocumentalId)) {
      const configurado = await cliente.query<{ tipo_documental_id: string }>(
        `SELECT tipo_documental_id::text AS tipo_documental_id
           FROM sigd_doc.tipo_documento
          WHERE tipo_documental_id = $1 AND vigente = TRUE`,
        [tipoDocumentalId],
      );
      const id = configurado.rows[0]?.tipo_documental_id;
      if (id) return id;
    }

    const resultado = await cliente.query<{ tipo_documental_id: string }>(
      `SELECT tipo_documental_id::text AS tipo_documental_id
         FROM sigd_doc.tipo_documento
        WHERE codigo = 'SOLICITUD' AND vigente = TRUE
        LIMIT 1`,
    );
    const id = resultado.rows[0]?.tipo_documental_id;
    if (!id) {
      throw new ValidationError({
        invalidParams: [{ name: 'tipoDocumentalId', reason: 'TIPO_DOCUMENTAL_NO_CONFIGURADO: falta el tipo documental SOLICITUD en el catálogo.' }],
      });
    }
    return id;
  }
}

export default VentanillaPresencialService;
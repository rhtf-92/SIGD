import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { TicketTermicoUtil } from './ticketTermico.util.js';
import { CutService } from './cut.service.js';
import { calcularHorarioCorte } from './horarioCorte.util.js';
import { ValidationError } from '../../shared/domain/errors/index.js';

/**
 * T-BE-TC-06 / Endpoint #15 — Ventanilla Presencial y Cargo de Recepción Física
 * Responsable: Leysglin Riquelmer Rojas Fachin (B_RIQUELMER) / Grupo 2 TramiCore
 *
 * Esquema canónico: `docs/04_tramicore/05_esquema_sigd_tra_v6.3.sql`.
 *
 * Alineación a v6.3:
 *   * El CUT se reserva con `sigd_tra.fn_generar_cut` a través de `CutService`
 *     (v6.3 no expone `generar_cut_expediente`).
 *   * El solicitante se resuelve contra `sigd_auth.persona` (persona plana del
 *     DDL canónico de IdentiCore), no contra `sigd_auth.persona_natural`.
 *   * La cabecera se persiste en las columnas reales de `sigd_tra.expediente`
 *     (cut, id_persona, id_tipo_tramite_tupa, nombre_solicitante,
 *     correo_notificacion, asunto, canal_recepcion, estado_tramite,
 *     total_folios, fecha_envio_real, fecha_radicacion_legal, fuera_de_horario).
 *   * Se elimina el asiento en `sigd_tra.asiento_registro`: esa tabla no existe
 *     en v6.3 (pertenece a `03_esquema_sigd_tra_cut_foliado.sql`).
 *   * v6.3 exige al menos un `documento_adjunto` por expediente (trigger diferido
 *     `trg_expediente_exigir_adjunto`). Como en ventanilla el sustento viaja en
 *     físico, se asienta el acuse de recepción como adjunto institucional.
 */

export interface DatosRecepcionFisica {
  dniSolicitante: string;
  datosRemitente: string;
  asunto: string;
  foliosTotales: number;
  correo: string;
  idTipoTramiteTupa: string;
  nombreSolicitante?: string;
  idOperadorVentanilla?: string;
}

export interface ResultadoVentanilla {
  expedienteId: string;
  cut: string;
  anioFiscal: number;
  fechaRadicacion: string;
  fechaRadicacionLegal: string;
  fueraDeHorario: boolean;
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

const REGEX_DNI = /^[0-9]{8}$/;
const REGEX_CORREO = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

export class VentanillaPresencialService {
  private readonly cutService: CutService;

  constructor(private readonly pool: Pool) {
    this.cutService = new CutService(pool);
  }

  public async registrarExpedienteVentanilla(
    datos: DatosRecepcionFisica,
    clienteTransaccional?: PoolClient,
  ): Promise<ResultadoVentanilla> {
    if (!REGEX_DNI.test(datos.dniSolicitante)) {
      throw new ValidationError({
        invalidParams: [{ name: 'dniSolicitante', reason: 'El DNI debe contener exactamente 8 dígitos.' }],
      });
    }

    if (!datos.asunto || datos.asunto.trim().length < 5) {
      throw new ValidationError({
        invalidParams: [{ name: 'asunto', reason: 'El asunto debe tener al menos 5 caracteres.' }],
      });
    }

    if (!Number.isInteger(datos.foliosTotales) || datos.foliosTotales <= 0) {
      throw new ValidationError({
        invalidParams: [{ name: 'foliosTotales', reason: 'El número de folios debe ser mayor a 0.' }],
      });
    }

    if (!datos.correo || !REGEX_CORREO.test(datos.correo)) {
      throw new ValidationError({
        invalidParams: [{ name: 'correo', reason: 'El correo de notificación no tiene un formato válido.' }],
      });
    }

    if (!datos.idTipoTramiteTupa) {
      throw new ValidationError({
        invalidParams: [{ name: 'idTipoTramiteTupa', reason: 'Debe indicar el tipo de trámite TUPA.' }],
      });
    }

    const nombreSolicitante = (datos.nombreSolicitante ?? datos.datosRemitente).trim();
    const correo = datos.correo.trim().toLowerCase();

    const ahora = new Date();
    const horario = calcularHorarioCorte(ahora);
    const anioFiscal = CutService.anioFiscalCorriente(ahora);

    const cliente = clienteTransaccional ?? (await this.pool.connect());
    const debeManejarTx = !clienteTransaccional;

    try {
      if (debeManejarTx) await cliente.query('BEGIN');

      // 1. Resolver el administrado en el padrón canónico de IdentiCore.
      const persona = await cliente.query<{ id: number }>(
        `SELECT id
           FROM sigd_auth.persona
          WHERE numero_documento = $1
            AND estado = TRUE
          ORDER BY id
          LIMIT 1`,
        [datos.dniSolicitante],
      );
      const idPersona = persona.rows[0]?.id;
      if (idPersona === undefined) {
        throw new ValidationError({
          invalidParams: [
            {
              name: 'dniSolicitante',
              reason: 'ADMINISTRADO_NO_REGISTRADO: el DNI no corresponde a una persona activa del padrón.',
            },
          ],
        });
      }

      // 2. Verificar que el tipo de trámite TUPA exista y esté vigente.
      const tupa = await cliente.query(
        `SELECT 1
           FROM sigd_doc.tipo_tramite_tupa
          WHERE id_tipo_tramite_tupa = $1
            AND activo = TRUE`,
        [datos.idTipoTramiteTupa],
      );
      if (!tupa.rows[0]) {
        throw new ValidationError({
          invalidParams: [
            {
              name: 'idTipoTramiteTupa',
              reason: 'TIPO_TRAMITE_DESCONOCIDO: el trámite no existe o no está vigente en el catálogo TUPA.',
            },
          ],
        });
      }

      // 3. Asignación atómica del CUT dentro de la misma transacción.
      const { cut } = await this.cutService.generar(anioFiscal, cliente);

      // 4. Hash de seguridad del acuse (también respalda el adjunto obligatorio).
      const hashSeguridad = crypto
        .createHash('sha256')
        .update(`${cut}:${ahora.toISOString()}:${datos.dniSolicitante}`)
        .digest('hex');

      // 5. Insertar el expediente con el contrato de columnas de v6.3.
      const expRes = await cliente.query<{ expediente_id: string }>(
        `INSERT INTO sigd_tra.expediente (
           cut,
           id_persona,
           id_tipo_tramite_tupa,
           nombre_solicitante,
           correo_notificacion,
           asunto,
           canal_recepcion,
           estado_tramite,
           total_folios,
           fecha_envio_real,
           fecha_radicacion_legal,
           fuera_de_horario
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           'VENTANILLA_PRESENCIAL', 'REGISTRADO',
           $7, $8, $9, $10
         ) RETURNING expediente_id;`,
        [
          cut,
          idPersona,
          datos.idTipoTramiteTupa,
          nombreSolicitante,
          correo,
          datos.asunto,
          datos.foliosTotales,
          horario.envioReal,
          horario.radicacionLegal,
          horario.requiereProyeccion,
        ],
      );
      const expedienteId = expRes.rows[0].expediente_id;

      // 6. Acuse de recepción física: satisface el trigger que exige adjunto.
      await cliente.query(
        `INSERT INTO sigd_tra.documento_adjunto (
           expediente_id,
           nombre_archivo,
           content_type,
           tamano_bytes,
           hash_sha256,
           storage_path
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [expedienteId, `acuse-${cut}.pdf`, 'application/pdf', datos.foliosTotales, hashSeguridad, null],
      );

      if (debeManejarTx) await cliente.query('COMMIT');

      const qrUrlSeguimiento = `https://sigd.iestp-suiza.edu.pe/api/v1/tramites/consulta-publica/${encodeURIComponent(cut)}`;

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
        anioFiscal,
        fechaRadicacion: ahora.toISOString(),
        fechaRadicacionLegal: horario.radicacionLegal.toISOString(),
        fueraDeHorario: horario.requiereProyeccion,
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
}

export default VentanillaPresencialService;

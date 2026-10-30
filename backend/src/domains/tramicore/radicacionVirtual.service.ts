import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';
import { CutService } from './cut.service.js';
import { calcularHorarioCorte, type ResultadoHorarioCorte } from './horarioCorte.util.js';
import type { RadicacionVirtualInput } from './tramites.schemas.js';
import type { DtoContextoTupa } from './tupaVersionado.service.js';
import { TesoreriaRepository } from '../tesoreria/tesoreria.repository.js';
import { calcularVencimientoOrdenPago } from '../tesoreria/tesoreria.service.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';

/**
 * T-BE-TC-02 y T-BE-TC-03 — Logica de negocio de la radicacion virtual
 * (Mesa de Partes Virtual 24x7, endpoint #14), adaptada al DDL ejecutable
 * 05_sigd_tra.sql y a la migracion TUPA 08_sigd_tupa_acoplamiento.sql.
 *
 * Garantias que ofrece este servicio:
 *   * La asignacion del CUT ocurre DENTRO de la misma transaccion que la
 *     escritura del expediente. Si algo posterior falla, el ROLLBACK libera el
 *     correlativo y no se quema un numero que el ciudadano nunca vio.
 *   * `fecha_envio_real` (metadato pericial) y `fecha_radicacion_legal` (inicio
 *     del computo de plazos, Art. 138 LPAG) se calculan en `horarioCorte.util.ts`.
 *     La fecha legal se persiste en `sigd_tra.expediente.fecha_radicacion` y la
 *     fecha de envio real en `sigd_tra.asiento_registro.fecha_ingreso`; ambos
 *     timestamps fisicos permiten reconstruir `fuera_de_horario`.
 *   * Cabecera, tramite, asiento y vinculo TUPA se escriben en UNA sola
 *     transaccion: cualquier fallo produce ROLLBACK total y no deja expediente
 *     huerfano ni escrituras parciales.
 *   * El vinculo TUPA solo se crea con una version APROBADA de
 *     sigd_doc.tupa_registro_version; el trigger de la base revalida la regla.
 *   * Flujo libre: si registroVersionId es nulo o ausente, la radicación procede
 *     normalmente sin crear fila en sigd_doc.expediente_tupa_vinculo.
 */

export interface ResultadoRadicacion {
  expedienteId: string;
  tipoDocumentalId: string;
  cut: string;
  anio: number;
  fechaEnvioReal: string;
  fechaRadicacionLegal: string;
  fueraDeHorario: boolean;
  mensajeLegal: string;
  totalFolios: number;
  registroVersionId?: string | null;
  cargoDigital: {
    codigo: string;
    hashSha256: string;
    qrContenido: string;
  };
}

export interface DtoDetalleExpediente {
  expedienteId: string;
  cut: string;
  codigoExpediente: string;
  numero: string;
  asunto: string;
  dniSolicitante: string | null;
  solicitanteId: string;
  tipoDocumentalId: string;
  areaDestinoId: string | null;
  estado: string;
  fechaRadicacion: string;
  canalIngreso: string | null;
  tupa: DtoContextoTupa | null;
}

interface FilaExpediente {
  expediente_id: string;
}

interface FilaTramiteTupa {
  vigente: boolean;
}

interface FilaTipoDocumental {
  vigente: boolean;
}

interface FilaPersona {
  id_persona: string;
  id_documento: string;
}

interface FilaVersionTupa {
  registro_version_id: string;
  estado_validacion: string;
  vigencia_desde: Date | string | null;
  vigencia_hasta: Date | string | null;
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Origen del calendario de feriados. Inyectable para poder testear sin BD. */
export type ProveedorFeriados = () => Promise<string[]>;

export class RadicacionVirtualService {
  private readonly cutService: CutService;
  private readonly tesoreriaRepository = new TesoreriaRepository();
  private readonly obtenerFeriados: ProveedorFeriados;

  constructor(private readonly pool: Pool, obtenerFeriados?: ProveedorFeriados) {
    this.cutService = new CutService(pool);
    this.obtenerFeriados = obtenerFeriados ?? crearProveedorFeriados(pool);
  }

  async radicar(datos: RadicacionVirtualInput, now: Date = new Date()): Promise<ResultadoRadicacion> {
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      if (datos.idTipoTramiteTupa) {
        await this.verificarTipoTramite(cliente, datos.idTipoTramiteTupa);
      }

      let tipoDocId = datos.tipoDocumentalId;
      if (!tipoDocId) {
        const defaultDoc = await cliente.query<{ tipo_documental_id: string }>(
          `SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE vigente = TRUE ORDER BY codigo ASC LIMIT 1`,
        );
        if (!defaultDoc.rows[0]) {
          throw new ValidationError({
            invalidParams: [
              { name: 'tipoDocumentalId', reason: 'TIPO_DOCUMENTAL_REQUERIDO: la radicacion exige un tipo documental vigente.' },
            ],
          });
        }
        tipoDocId = defaultDoc.rows[0].tipo_documental_id;
      } else {
        await this.verificarTipoDocumental(cliente, tipoDocId);
      }

      const persona = await this.verificarAdministrado(cliente, datos.idPersona);

      if (datos.registroVersionId) {
        await this.verificarVersionTupa(cliente, datos.registroVersionId, now);
      }

      const [{ cut, anio }, horario] = await Promise.all([
        this.cutService.generar(anioDeRecepcion(now), cliente),
        this.evaluarHorario(now),
      ]);

      const expediente = await this.insertarExpediente(
        cliente, datos, persona, tipoDocId, cut, horario,
      );
      await this.insertarTramite(cliente, expediente.expediente_id, datos.asunto);
      await this.insertarAsiento(cliente, expediente.expediente_id, persona, datos.asunto, horario);

      if (datos.registroVersionId) {
        await this.insertarVinculoTupa(cliente, expediente.expediente_id, datos.registroVersionId);
        const contextoPago = await this.tesoreriaRepository.obtenerContextoExpedienteParaPago(cliente, expediente.expediente_id);
        if (!contextoPago) throw new Error('No se pudo resolver el costo TUPA del expediente radicado.');
        if (contextoPago.costoOficial > 0) {
          const codigoPago = await this.tesoreriaRepository.obtenerSiguienteCodigoPago(cliente, now.getFullYear());
          const orden = await this.tesoreriaRepository.insertarOrdenPago(cliente, {
            codigoPago,
            expedienteId: expediente.expediente_id,
            registroVersionId: contextoPago.registroVersionId,
            solicitanteId: contextoPago.solicitanteId,
            concepto: contextoPago.concepto,
            codigoTupa: contextoPago.codigoTupa,
            monto: contextoPago.costoOficial,
            moneda: 'PEN',
            fechaVencimiento: calcularVencimientoOrdenPago(now),
          });
          await cliente.query(
            `UPDATE sigd_tra.expediente SET estado = 'PENDIENTE_PAGO'
              WHERE expediente_id = $1::uuid AND estado = 'REGISTRADO'`,
            [expediente.expediente_id],
          );
          await registrarMutacion(cliente, {
            esquema: 'sigd_tra', tabla: 'orden_pago', operacion: 'INSERT',
            datos_despues: { ordenPagoId: orden.orden_pago_id, codigoPago, expedienteId: expediente.expediente_id,
              monto: contextoPago.costoOficial, fechaVencimiento: orden.fecha_vencimiento },
          });
        }
      }
      const cargo = this.emitirCargoDigital(expediente.expediente_id, datos, now);

      await cliente.query('COMMIT');
      transaccionAbierta = false;

      return {
        expedienteId: expediente.expediente_id,
        tipoDocumentalId: tipoDocId,
        cut,
        anio,
        fechaEnvioReal: horario.envioReal.toISOString(),
        fechaRadicacionLegal: horario.radicacionLegal.toISOString(),
        fueraDeHorario: horario.requiereProyeccion,
        mensajeLegal: redactarMensajeLegal(horario),
        totalFolios: datos.totalFolios,
        registroVersionId: datos.registroVersionId ?? null,
        cargoDigital: cargo,
      };
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async obtenerDetalleExpediente(expedienteId: string): Promise<DtoDetalleExpediente> {
    if (!expedienteId || !REGEX_UUID.test(expedienteId)) {
      throw new ValidationError({
        invalidParams: [{ name: 'expedienteId', reason: 'El identificador del expediente debe ser un UUID valido.' }],
      });
    }

    const cliente = await this.pool.connect();
    try {
      const expRes = await cliente.query<{
        expediente_id: string;
        codigo_expediente: string;
        numero: string;
        dni_solicitante: string | null;
        tipo_documental_id: string;
        solicitante_id: string;
        area_destino_id: string | null;
        estado: string;
        fecha_radicacion: Date;
        asunto: string | null;
        canal_ingreso: string | null;
      }>(
        `SELECT e.expediente_id, e.codigo_expediente, e.numero, e.dni_solicitante,
                e.tipo_documental_id, e.solicitante_id, e.area_destino_id,
                e.estado, e.fecha_radicacion,
                t.asunto,
                ar.canal_ingreso
           FROM sigd_tra.expediente e
           LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
           LEFT JOIN sigd_tra.asiento_registro ar ON ar.expediente_id = e.expediente_id
          WHERE e.expediente_id = $1::uuid
          LIMIT 1`,
        [expedienteId],
      );

      const exp = expRes.rows[0];
      if (!exp) {
        throw new NotFoundError({
          detail: `No existe un expediente con el identificador ${expedienteId}.`,
        });
      }

      const vinculoRes = await cliente.query<{
        registro_version_id: string;
        codigo_externo: string | null;
        denominacion_original: string;
        monto_original: string | null;
        requisitos_original: unknown | null;
        fuente_nombre: string;
        pagina: number;
        revision: number;
        version_fuente: string | null;
        estado_validacion: string;
        vinculado_en: Date;
      }>(
        `SELECT rv.registro_version_id, rv.codigo_externo, rv.denominacion_original,
                rv.monto_original, rv.requisitos_original, rv.fuente_nombre,
                rv.pagina, rv.revision, rv.version_fuente, rv.estado_validacion,
                v.vinculado_en
           FROM sigd_doc.expediente_tupa_vinculo v
           JOIN sigd_doc.tupa_registro_version rv ON rv.registro_version_id = v.registro_version_id
          WHERE v.expediente_id = $1::uuid
            AND v.reemplaza_vinculo_id IS NULL
          ORDER BY v.vinculado_en DESC, v.vinculo_id DESC
          LIMIT 1`,
        [expedienteId],
      );

      const v = vinculoRes.rows[0];
      const tupa: DtoContextoTupa | null = v
        ? {
            registroVersionId: v.registro_version_id,
            codigoExterno: v.codigo_externo,
            codigo: v.codigo_externo,
            denominacion: v.denominacion_original,
            monto: v.monto_original,
            requisitos: Array.isArray(v.requisitos_original) ? (v.requisitos_original as unknown[]) : null,
            fuente: v.fuente_nombre,
            pagina: v.pagina,
            revision: v.revision,
            version: v.version_fuente,
            estadoValidacion: v.estado_validacion,
            vinculadoEn: v.vinculado_en.toISOString(),
          }
        : null;

      return {
        expedienteId: exp.expediente_id,
        cut: exp.codigo_expediente,
        codigoExpediente: exp.codigo_expediente,
        numero: exp.numero,
        asunto: exp.asunto ?? '',
        dniSolicitante: exp.dni_solicitante,
        solicitanteId: exp.solicitante_id,
        tipoDocumentalId: exp.tipo_documental_id,
        areaDestinoId: exp.area_destino_id,
        estado: exp.estado,
        fechaRadicacion: exp.fecha_radicacion.toISOString(),
        canalIngreso: exp.canal_ingreso,
        tupa,
      };
    } finally {
      cliente.release();
    }
  }

  private async evaluarHorario(now: Date): Promise<ResultadoHorarioCorte> {
    const feriados = await this.obtenerFeriados();
    return calcularHorarioCorte(now, feriados);
  }

  private async verificarTipoTramite(cliente: PoolClient, idTipoTramiteTupa: string): Promise<void> {
    const resultado = await cliente.query<FilaTramiteTupa>(
      `SELECT vigente
         FROM sigd_doc.tipo_tramite_tupa
        WHERE tipo_tramite_id = $1::uuid`,
      [idTipoTramiteTupa],
    );
    const tipo = resultado.rows[0];
    if (!tipo) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idTipoTramiteTupa', reason: 'TIPO_TRAMITE_DESCONOCIDO: el tramite no existe en el catalogo TUPA.' },
        ],
      });
    }
    if (!tipo.vigente) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idTipoTramiteTupa', reason: 'TIPO_TRAMITE_INACTIVO: el tramite ya no admite nuevas radicaciones.' },
        ],
      });
    }
  }

  private async verificarTipoDocumental(cliente: PoolClient, tipoDocumentalId: string): Promise<void> {
    const resultado = await cliente.query<FilaTipoDocumental>(
      `SELECT vigente
         FROM sigd_doc.tipo_documento
        WHERE tipo_documental_id = $1::uuid`,
      [tipoDocumentalId],
    );
    const tipo = resultado.rows[0];
    if (!tipo || !tipo.vigente) {
      throw new ValidationError({
        invalidParams: [
          { name: 'tipoDocumentalId', reason: 'TIPO_DOCUMENTAL_INVALIDO: no existe o no esta vigente en sigd_doc.tipo_documento.' },
        ],
      });
    }
  }

  private async verificarAdministrado(cliente: PoolClient, idPersona: string): Promise<FilaPersona> {
    const resultado = await cliente.query<FilaPersona>(
      `SELECT id_persona::text AS id_persona, id_documento
         FROM sigd_auth.persona
        WHERE id_persona = $1::uuid`,
      [idPersona],
    );
    const persona = resultado.rows[0];
    if (!persona) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idPersona', reason: 'ADMINISTRADO_NO_REGISTRADO: el UUID no corresponde a una persona del padron.' },
        ],
      });
    }
    return persona;
  }

  private async verificarVersionTupa(cliente: PoolClient, registroVersionId: string, now: Date): Promise<void> {
    if (!registroVersionId || !REGEX_UUID.test(registroVersionId)) {
      throw new ValidationError({
        invalidParams: [
          { name: 'registroVersionId', reason: 'registroVersionId debe ser un UUID valido de sigd_doc.tupa_registro_version.' },
        ],
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

    const hoyStr = now.toISOString().slice(0, 10);
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

  private async insertarExpediente(
    cliente: PoolClient,
    datos: RadicacionVirtualInput,
    persona: FilaPersona,
    tipoDocumentalId: string,
    cut: string,
    horario: ResultadoHorarioCorte,
  ): Promise<FilaExpediente> {
    const resultado = await cliente.query<FilaExpediente>(
      `INSERT INTO sigd_tra.expediente
         (codigo_expediente, numero, dni_solicitante, tipo_documental_id,
          solicitante_id, area_destino_id, estado, fecha_radicacion)
       VALUES ($1, $1, $2, $3::uuid, $4::uuid, NULL, 'REGISTRADO', $5)
       RETURNING expediente_id`,
      [
        cut,
        /^[0-9]{8}$/.test(persona.id_documento) ? persona.id_documento : null,
        tipoDocumentalId,
        persona.id_persona,
        horario.radicacionLegal,
      ],
    );
    const expediente = resultado.rows[0];
    if (!expediente) {
      throw new Error('La insercion del expediente no devolvio fila.');
    }
    return expediente;
  }

  private async insertarTramite(cliente: PoolClient, expedienteId: string, asunto: string): Promise<void> {
    await cliente.query(
      `INSERT INTO sigd_tra.tramite (expediente_id, asunto, estado)
       VALUES ($1::uuid, $2, 'REGISTRADO')`,
      [expedienteId, asunto],
    );
  }

  private async insertarAsiento(
    cliente: PoolClient,
    expedienteId: string,
    persona: FilaPersona,
    asunto: string,
    horario: ResultadoHorarioCorte,
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO sigd_tra.asiento_registro
         (expediente_id, fecha_ingreso, canal_ingreso, asunto, remitente_id)
       VALUES ($1::uuid, $2, 'MESA_VIRTUAL', $3, $4::uuid)`,
      [expedienteId, horario.envioReal, asunto, persona.id_persona],
    );
  }

  private async insertarVinculoTupa(
    cliente: PoolClient,
    expedienteId: string,
    registroVersionId: string,
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO sigd_doc.expediente_tupa_vinculo (expediente_id, registro_version_id)
       VALUES ($1::uuid, $2::uuid)`,
      [expedienteId, registroVersionId],
    );
  }

  private emitirCargoDigital(
    expedienteId: string,
    datos: RadicacionVirtualInput,
    now: Date,
  ): ResultadoRadicacion['cargoDigital'] {
    const codigo = `CARGO-${randomUUID().slice(0, 8).toUpperCase()}`;
    const contenido = JSON.stringify({
      codigo,
      expedienteId,
      totalFolios: datos.totalFolios,
      emitidoEn: now.toISOString(),
    });
    const hashSha256 = createHash('sha256').update(contenido).digest('hex');
    const qrContenido = `SIGD://cargo/${codigo}?h=${hashSha256.slice(0, 16)}`;

    return { codigo, hashSha256, qrContenido };
  }
}

function anioDeRecepcion(now: Date): number {
  return CutService.anioFiscalCorriente(now);
}

function redactarMensajeLegal(horario: ResultadoHorarioCorte): string {
  if (!horario.requiereProyeccion) {
    return 'Radicacion dentro del horario de atencion. El computo de plazos comienza de inmediato.';
  }
  if (horario.diaNoHabil) {
    return `Recibido en dia no habil. Por Art. 138 de la LPAG el computo de plazos comienza el ${horario.fechaLegal} a las 08:00.`;
  }
  return `Recibido despues del corte de las 16:30. Por Art. 138 de la LPAG el computo de plazos comienza el ${horario.fechaLegal} a las 08:00.`;
}

export function crearProveedorFeriados(pool: Pool): ProveedorFeriados {
  return async function obtenerFeriados(): Promise<string[]> {
    const cliente = await pool.connect();
    try {
      const resultado = await cliente.query<{ fecha: string }>(
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha
           FROM sigd_org.calendario_laboral
          WHERE es_feriado = TRUE`,
      );
      return resultado.rows.map((fila) => fila.fecha);
    } catch {
      return [];
    } finally {
      cliente.release();
    }
  };
}

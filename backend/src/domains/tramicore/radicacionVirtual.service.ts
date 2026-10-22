import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ValidationError } from '../../shared/domain/errors/index.js';
import { calcularHorarioCorte, type ResultadoHorarioCorte } from './horarioCorte.util.js';
import type { RadicacionVirtualInput } from './tramites.schemas.js';

/**
 * T-BE-TC-02 y T-BE-TC-03 · Logica de negocio de la radicacion virtual
 * (Mesa de Partes Virtual 24x7, endpoint #14).
 *
 * Esquema real: sigd_tra.expediente (expediente_id, codigo_expediente, numero,
 * dni_solicitante, tipo_documental_id NOT NULL, solicitante_id NOT NULL,
 * area_destino_id, estado, fecha_radicacion, fecha_limite) y
 * sigd_tra.asiento_registro (numero_registro, expediente_id, fecha_ingreso,
 * canal_ingreso, asunto, remitente_id). El trigger tr_tra_expediente_asignar_cut
 * genera el CUT (EXP-YYYY-XXXXXX) con sigd_tra.generar_cut_expediente, la misma
 * funcion que CutService invoca (fn_generar_cut es su alias), por lo que la base
 * lo asigna al insertar sin codigo_expediente.
 *
 * No existen sigd_tra.cargo_digital ni sigd_tra.documento_adjunto; el cargo
 * digital es un codigo determinista recalculable y los adjuntos no se persisten
 * en esta etapa (ver TODO).
 */
export interface ResultadoRadicacion {
  expedienteId: string;
  cut: string;
  anio: number;
  fechaEnvioReal: string;
  fechaRadicacionLegal: string;
  fueraDeHorario: boolean;
  mensajeLegal: string;
  totalFolios: number;
  cargoDigital: {
    codigo: string;
    hashSha256: string;
    qrContenido: string;
  };
}

interface FilaExpediente {
  expediente_id: string;
  cut: string;
  fecha_radicacion_legal: Date;
}

interface FilaTipoTramite {
  tipo_tramite_id: string;
  vigente: boolean;
}

interface FilaTipoDocumento {
  tipo_documental_id: string;
}

interface FilaPersona {
  id_persona: string;
  id_documento: string | null;
}

/** Origen del calendario de feriados. Inyectable para poder testear sin BD. */
export type ProveedorFeriados = () => Promise<string[]>;

export class RadicacionVirtualService {
  private readonly pool: Pool;
  private readonly obtenerFeriados: ProveedorFeriados;

  constructor(pool: Pool, obtenerFeriados?: ProveedorFeriados) {
    this.pool = pool;
    this.obtenerFeriados = obtenerFeriados ?? crearProveedorFeriados(pool);
  }

  async radicar(
    datos: RadicacionVirtualInput,
    idPersonaAutenticada: string,
    idUsuario: string,
    now: Date = new Date(),
  ): Promise<ResultadoRadicacion> {
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;

      const tipoDocumentalId = await this.resolverTipoDocumental(cliente, datos.idTipoTramiteTupa);
      await this.verificarAdministrado(cliente, idPersonaAutenticada);

      const horario = await this.evaluarHorario(now);
      const anio = anioDeRecepcion(now);

      const expediente = await this.insertarExpediente(
        cliente,
        datos,
        tipoDocumentalId,
        idPersonaAutenticada,
        horario.radicacionLegal,
      );
      const cut = expediente.cut;
      const anioFiscal = Number(cut.slice(4, 8));

      await this.insertarAsiento(cliente, expediente.expediente_id, datos, horario.envioReal, idPersonaAutenticada);
      await this.insertarConstanciaCasilla(cliente, idUsuario, cut, datos, horario.envioReal);
      // Etapa 2b: integrar con sigd_doc.expediente y MinIO.
      // Los adjuntos se validan en el DTO pero no se persisten en esta etapa.
      const cargo = this.emitirCargoDigital(expediente.expediente_id, cut, datos, horario.envioReal);

      await cliente.query('COMMIT');
      transaccionAbierta = false;

      return {
        expedienteId: expediente.expediente_id,
        cut,
        anio: anioFiscal,
        fechaEnvioReal: horario.envioReal.toISOString(),
        fechaRadicacionLegal: expediente.fecha_radicacion_legal.toISOString(),
        fueraDeHorario: horario.requiereProyeccion,
        mensajeLegal: redactarMensajeLegal(horario),
        totalFolios: datos.totalFolios,
        cargoDigital: cargo,
      };
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  private async evaluarHorario(now: Date): Promise<ResultadoHorarioCorte> {
    const feriados = await this.obtenerFeriados();
    return calcularHorarioCorte(now, feriados);
  }

  private async resolverTipoDocumental(
    cliente: PoolClient,
    idTipoTramiteTupa: string,
  ): Promise<string> {
    const resultado = await cliente.query<FilaTipoDocumento>(
      `SELECT td.tipo_documental_id
         FROM sigd_doc.tipo_documento td
         JOIN sigd_doc.tipo_tramite_tupa t ON t.codigo = td.codigo
        WHERE t.tipo_tramite_id = $1
          AND td.vigente = TRUE
          AND t.vigente = TRUE
        LIMIT 1`,
      [idTipoTramiteTupa],
    );
    const fila = resultado.rows[0];
    if (!fila) {
      throw new ValidationError({
        invalidParams: [
          {
            name: 'idTipoTramiteTupa',
            reason: 'TIPO_DOCUMENTAL_SIN_CONFIGURAR: no existe un tipo documental vinculado al tramite elegido.',
          },
        ],
      });
    }
    return fila.tipo_documental_id;
  }

  private async verificarTipoTramite(cliente: PoolClient, idTipoTramiteTupa: string): Promise<void> {
    const resultado = await cliente.query<FilaTipoTramite>(
      `SELECT tipo_tramite_id, vigente
         FROM sigd_doc.tipo_tramite_tupa
        WHERE tipo_tramite_id = $1`,
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

  private async verificarAdministrado(cliente: PoolClient, idPersona: string): Promise<void> {
    const resultado = await cliente.query<FilaPersona>(
      'SELECT id_persona, id_documento FROM sigd_auth.persona WHERE id_persona = $1',
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
  }

  private async insertarExpediente(
    cliente: PoolClient,
    datos: RadicacionVirtualInput,
    tipoDocumentalId: string,
    idPersona: string,
    fechaRadicacionLegal: Date,
  ): Promise<FilaExpediente> {
    const idDocumento = await this.obtenerIdDocumentoPersona(cliente, idPersona);
    const dniSolicitante = idDocumento && /^[0-9]{8}$/.test(idDocumento) ? idDocumento : null;

    // numero es NOT NULL UNIQUE; el CUT lo genera el trigger y se asigna despues.
    const numeroTemporal = `TMP-${createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 12)}`;

    const resultado = await cliente.query<FilaExpediente>(
      `INSERT INTO sigd_tra.expediente
         (numero, dni_solicitante, tipo_documental_id, solicitante_id,
          area_destino_id, estado, fecha_radicacion, fecha_limite)
       VALUES ($1, $2, $3, $4, NULL, 'REGISTRADO', $5, NULL)
       RETURNING expediente_id, codigo_expediente AS cut, fecha_radicacion AS fecha_radicacion_legal`,
      [numeroTemporal, dniSolicitante, tipoDocumentalId, idPersona, fechaRadicacionLegal],
    );
    const expediente = resultado.rows[0];
    if (!expediente) {
      throw new Error('La insercion del expediente no devolvio fila.');
    }

    await cliente.query(`UPDATE sigd_tra.expediente SET numero = $1 WHERE expediente_id = $2`, [
      expediente.cut,
      expediente.expediente_id,
    ]);

    return expediente;
  }

  private async obtenerIdDocumentoPersona(cliente: PoolClient, idPersona: string): Promise<string | null> {
    const resultado = await cliente.query<{ id_documento: string | null }>(
      'SELECT id_documento FROM sigd_auth.persona WHERE id_persona = $1',
      [idPersona],
    );
    return resultado.rows[0]?.id_documento ?? null;
  }

  private async insertarAsiento(
    cliente: PoolClient,
    expedienteId: string,
    datos: RadicacionVirtualInput,
    fechaEnvioReal: Date,
    idPersona: string,
  ): Promise<void> {
    await cliente.query(
      `INSERT INTO sigd_tra.asiento_registro
         (expediente_id, fecha_ingreso, canal_ingreso, asunto, remitente_id)
       VALUES ($1, $2, 'MESA_VIRTUAL', $3, $4)`,
      [expedienteId, fechaEnvioReal, datos.asunto, idPersona],
    );
  }

  private async insertarConstanciaCasilla(
    cliente: PoolClient,
    idUsuario: string,
    cut: string,
    datos: RadicacionVirtualInput,
    fechaEnvioReal: Date,
  ): Promise<void> {
    const cuerpo = {
      cut,
      asunto: datos.asunto,
      fechaRecepcionReal: fechaEnvioReal.toISOString(),
    };
    await cliente.query(
      `INSERT INTO sigd_auth.notificacion_casilla
         (usuario_id, cut, asunto, tipo_acto, cuerpo)
       VALUES ($1, $2, $3, 'Radizacion Virtual', $4::jsonb)`,
      [idUsuario, cut, 'Constancia de presentacion de tramite', JSON.stringify(cuerpo)],
    );
  }

  private emitirCargoDigital(
    expedienteId: string,
    codigoExpediente: string,
    datos: RadicacionVirtualInput,
    fechaIngreso: Date,
  ): ResultadoRadicacion['cargoDigital'] {
    const input = `${expedienteId}|${codigoExpediente}|${fechaIngreso.toISOString()}`;
    const hashCompleto = createHash('sha256').update(input).digest('hex');
    const codigo = `CARGO-${hashCompleto.slice(0, 8).toUpperCase()}`;
    const contenido = JSON.stringify({
      codigo,
      expedienteId,
      cut: codigoExpediente,
      totalFolios: datos.totalFolios,
      emitidoEn: fechaIngreso.toISOString(),
    });
    const hashSha256 = createHash('sha256').update(contenido).digest('hex');
    const qrContenido = `SIGD://cargo/${codigo}?h=${hashSha256.slice(0, 16)}`;
    return { codigo, hashSha256, qrContenido };
  }
}

/**
 * El ejercicio fiscal del CUT sigue al ano de la recepcion tecnica, no al ano
 * de la fecha legal proyectada: un documento recibido el 31 de diciembre a las
 * 18:00 conserva el correlativo de diciembre aunque su computo de plazos
 * arranque en enero.
 */
function anioDeRecepcion(now: Date): number {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
  }).formatToParts(now);
  const anio = Number(partes.find((parte) => parte.type === 'year')?.value);
  if (!Number.isFinite(anio)) {
    throw new Error('No se pudo determinar el anio fiscal corriente.');
  }
  return anio;
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

/**
 * Proveedor por defecto: lee los feriados del calendario laboral si el modulo de
 * OrganiCore ya lo publico. La ausencia del catalogo no debe impedir radicar,
 * por lo que se degrada a un calendario vacio en lugar de fallar.
 */
export function crearProveedorFeriados(pool: Pool): ProveedorFeriados {
  return async function obtenerFeriados(): Promise<string[]> {
    const cliente = await pool.connect();
    try {
      const resultado = await cliente.query<{ fecha: string }>(
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha
           FROM sigd_org.calendario_laboral
          WHERE es_feriado = TRUE
            AND fecha >= CURRENT_DATE - INTERVAL '1 year'
            AND fecha <= CURRENT_DATE + INTERVAL '5 years'`,
      );
      return resultado.rows.map((fila) => fila.fecha);
    } catch {
      return [];
    } finally {
      cliente.release();
    }
  };
}

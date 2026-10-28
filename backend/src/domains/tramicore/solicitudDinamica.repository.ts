import type { Pool } from 'pg';

export type TipoFormularioDinamico =
  | 'DOCUMENTARIO'
  | 'ACADEMICO'
  | 'SERVICIO'
  | 'VENTA_BIEN'
  | 'ALQUILER'
  | 'ACTUACION_INTERNA'
  | 'OTRO';

export type EstadoSolicitudDinamica =
  | 'SOLICITADO'
  | 'EN_REVISION'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'ATENDIDO'
  | 'CANCELADO';

export interface SolicitudDinamicaRegistro {
  idSolicitud: string;
  codigoSolicitud: string;
  tipoFormulario: TipoFormularioDinamico;
  codigoTupa: string;
  denominacion: string;
  idPersona: string;
  nombreSolicitante: string;
  correo: string;
  telefono: string | null;
  montoTotal: number;
  datosFormulario: Record<string, unknown>;
  estado: EstadoSolicitudDinamica;
  observacion: string | null;
  fechaSolicitud: string;
  fechaActualizacion: string;
}

interface FilaSolicitudDinamicaDb {
  id_solicitud: string;
  codigo_solicitud: string;
  tipo_formulario: TipoFormularioDinamico;
  codigo_tupa: string;
  denominacion: string;
  id_persona: string;
  nombre_solicitante: string;
  correo: string;
  telefono: string | null;
  monto_total: string | number;
  datos_formulario: Record<string, unknown>;
  estado: EstadoSolicitudDinamica;
  observacion: string | null;
  fecha_solicitud: Date;
  fecha_actualizacion: Date;
}

function mapearFila(f: FilaSolicitudDinamicaDb): SolicitudDinamicaRegistro {
  return {
    idSolicitud: f.id_solicitud,
    codigoSolicitud: f.codigo_solicitud,
    tipoFormulario: f.tipo_formulario,
    codigoTupa: f.codigo_tupa,
    denominacion: f.denominacion,
    idPersona: f.id_persona,
    nombreSolicitante: f.nombre_solicitante,
    correo: f.correo,
    telefono: f.telefono,
    montoTotal: Number(f.monto_total),
    datosFormulario: f.datos_formulario,
    estado: f.estado,
    observacion: f.observacion,
    fechaSolicitud: f.fecha_solicitud.toISOString(),
    fechaActualizacion: f.fecha_actualizacion.toISOString(),
  };
}

export class SolicitudDinamicaRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Genera el siguiente correlativo canónico SOL-2026-XXXXXX a partir de la secuencia.
   */
  async generarCodigoCorrelativo(): Promise<string> {
    const res = await this.pool.query<{ val: string }>(
      "SELECT nextval('sigd_doc.secuencia_solicitud_dinamica_2026')::text AS val;"
    );
    if (!res.rows[0]?.val) throw new Error('La secuencia de solicitudes no devolvió un correlativo.');
    return `SOL-2026-${res.rows[0].val.padStart(6, '0')}`;
  }

  /**
   * Registra una solicitud no documentaria derivada del TUPA.
   */
  async crearSolicitud(params: {
    tipoFormulario: TipoFormularioDinamico;
    codigoTupa: string;
    denominacion: string;
    idPersona: string;
    nombreSolicitante: string;
    correo: string;
    telefono?: string;
    montoTotal: number;
    datosFormulario: Record<string, unknown>;
    observacion?: string;
  }): Promise<SolicitudDinamicaRegistro> {
    const codigoSolicitud = await this.generarCodigoCorrelativo();
    const query = `
      INSERT INTO sigd_doc.solicitud_tramite_dinamico (
        codigo_solicitud,
        tipo_formulario,
        codigo_tupa,
        denominacion,
        id_persona,
        nombre_solicitante,
        correo,
        telefono,
        monto_total,
        datos_formulario,
        estado,
        observacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SOLICITADO', $11)
      RETURNING *;
    `;
    const resultado = await this.pool.query<FilaSolicitudDinamicaDb>(query, [
      codigoSolicitud,
      params.tipoFormulario,
      params.codigoTupa,
      params.denominacion,
      params.idPersona,
      params.nombreSolicitante,
      params.correo.trim().toLowerCase(),
      params.telefono?.trim() ?? null,
      params.montoTotal,
      JSON.stringify(params.datosFormulario),
      params.observacion?.trim() ?? null,
    ]);
    return mapearFila(resultado.rows[0]);
  }

  /**
   * Lista solicitudes ciudadanas propias (Anti-BOLA estricto por idPersona).
   */
  async listarPorPersona(idPersona: string): Promise<SolicitudDinamicaRegistro[]> {
    const query = `
      SELECT *
        FROM sigd_doc.solicitud_tramite_dinamico
       WHERE id_persona = $1
       ORDER BY fecha_solicitud DESC;
    `;
    const resultado = await this.pool.query<FilaSolicitudDinamicaDb>(query, [idPersona]);
    return resultado.rows.map(mapearFila);
  }

  /**
   * Consulta una solicitud por su código canónico con filtro opcional de idPersona.
   */
  async obtenerPorCodigo(codigoSolicitud: string, idPersona?: string): Promise<SolicitudDinamicaRegistro | null> {
    const condiciones = ['codigo_solicitud = $1'];
    const params: (string | number)[] = [codigoSolicitud];

    if (idPersona) {
      params.push(idPersona);
      condiciones.push(`id_persona = $${params.length}`);
    }

    const query = `
      SELECT *
        FROM sigd_doc.solicitud_tramite_dinamico
       WHERE ${condiciones.join(' AND ')};
    `;
    const resultado = await this.pool.query<FilaSolicitudDinamicaDb>(query, params);
    if (resultado.rows.length === 0) return null;
    return mapearFila(resultado.rows[0]);
  }

  /**
   * Lista todas las solicitudes para vista institucional.
   */
  async listarTodas(filtros?: {
    tipoFormulario?: TipoFormularioDinamico;
    estado?: EstadoSolicitudDinamica;
  }): Promise<SolicitudDinamicaRegistro[]> {
    const condiciones: string[] = [];
    const params: (string | number)[] = [];

    if (filtros?.tipoFormulario) {
      params.push(filtros.tipoFormulario);
      condiciones.push(`tipo_formulario = $${params.length}`);
    }

    if (filtros?.estado) {
      params.push(filtros.estado);
      condiciones.push(`estado = $${params.length}`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const query = `
      SELECT *
        FROM sigd_doc.solicitud_tramite_dinamico
       ${where}
       ORDER BY fecha_solicitud DESC;
    `;
    const resultado = await this.pool.query<FilaSolicitudDinamicaDb>(query, params);
    return resultado.rows.map(mapearFila);
  }
}

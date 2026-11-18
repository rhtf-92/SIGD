import type { Pool } from 'pg';

export type EstadoSolicitudTupa = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'EXPIRADA';

export interface SolicitudTupaRegistro {
  idSolicitud: string;
  idPersona: string;
  correo: string;
  motivo: string;
  fechaSolicitud: string;
  estado: EstadoSolicitudTupa;
  fechaResolucion: string | null;
  resueltoPor: string | null;
  observacionResolucion: string | null;
  vigenciaHasta: string | null;
  nombreSolicitante?: string;
  numeroDocumento?: string;
}

interface FilaSolicitudTupaDb {
  id_solicitud: string;
  id_persona: string;
  correo: string;
  motivo: string;
  fecha_solicitud: Date;
  estado: EstadoSolicitudTupa;
  fecha_resolucion: Date | null;
  resuelto_por: string | null;
  observacion_resolucion: string | null;
  vigencia_hasta: Date | null;
  nombre_completo?: string | null;
  id_documento?: string | null;
}

function mapearFila(f: FilaSolicitudTupaDb): SolicitudTupaRegistro {
  return {
    idSolicitud: f.id_solicitud,
    idPersona: f.id_persona,
    correo: f.correo,
    motivo: f.motivo,
    fechaSolicitud: f.fecha_solicitud.toISOString(),
    estado: f.estado,
    fechaResolucion: f.fecha_resolucion ? f.fecha_resolucion.toISOString() : null,
    resueltoPor: f.resuelto_por,
    observacionResolucion: f.observacion_resolucion,
    vigenciaHasta: f.vigencia_hasta ? f.vigencia_hasta.toISOString() : null,
    nombreSolicitante: f.nombre_completo ?? undefined,
    numeroDocumento: f.id_documento ?? undefined,
  };
}

export class TupaAccesoRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Crea una solicitud de acceso al TUPA para una persona determinada (derivada de JWT).
   */
  async crearSolicitud(params: {
    idPersona: string;
    correo: string;
    motivo: string;
  }): Promise<SolicitudTupaRegistro> {
    const query = `
      INSERT INTO sigd_doc.tupa_solicitud_acceso (
        id_persona,
        correo,
        motivo,
        estado
      ) VALUES ($1, $2, $3, 'PENDIENTE')
      RETURNING id_solicitud, id_persona, correo, motivo, fecha_solicitud,
                estado, fecha_resolucion, resuelto_por, observacion_resolucion;
    `;
    const resultado = await this.pool.query<FilaSolicitudTupaDb>(query, [
      params.idPersona,
      params.correo.trim().toLowerCase(),
      params.motivo.trim(),
    ]);
    return mapearFila(resultado.rows[0]);
  }

  /**
   * Obtiene la solicitud activa más reciente de una persona para verificar autorización.
   */
  async obtenerUltimaSolicitud(idPersona: string): Promise<SolicitudTupaRegistro | null> {
    const query = `
      SELECT s.id_solicitud, s.id_persona, s.correo, s.motivo, s.fecha_solicitud,
             s.estado, s.fecha_resolucion, s.resuelto_por, s.observacion_resolucion,
             s.vigencia_hasta,
             pn.nombre_completo, p.id_documento
        FROM sigd_doc.tupa_solicitud_acceso s
        JOIN sigd_auth.persona p ON p.id_persona = s.id_persona
   LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = s.id_persona
       WHERE s.id_persona = $1
       ORDER BY s.fecha_solicitud DESC
       LIMIT 1;
    `;
    const resultado = await this.pool.query<FilaSolicitudTupaDb>(query, [idPersona]);
    if (resultado.rows.length === 0) return null;
    return mapearFila(resultado.rows[0]);
  }

  /**
   * Verifica de manera directa si una persona cuenta con autorización TUPA vigente y aprobada.
   * La vigencia es de 30 días naturales desde la fecha de aprobación (vigencia_hasta > now()).
   */
  async tieneAccesoAprobado(idPersona: string): Promise<boolean> {
    const query = `
      SELECT 1
        FROM sigd_doc.tupa_solicitud_acceso
       WHERE id_persona = $1
         AND estado = 'APROBADA'
         AND (vigencia_hasta IS NULL OR vigencia_hasta > now())
       LIMIT 1;
    `;
    const resultado = await this.pool.query(query, [idPersona]);
    return (resultado.rowCount ?? 0) > 0;
  }

  /**
   * Lista el histórico de solicitudes de una persona específica (Anti-BOLA).
   */
  async listarPorPersona(idPersona: string): Promise<SolicitudTupaRegistro[]> {
    const query = `
      SELECT s.id_solicitud, s.id_persona, s.correo, s.motivo, s.fecha_solicitud,
             s.estado, s.fecha_resolucion, s.resuelto_por, s.observacion_resolucion,
             s.vigencia_hasta,
             pn.nombre_completo, p.id_documento
        FROM sigd_doc.tupa_solicitud_acceso s
        JOIN sigd_auth.persona p ON p.id_persona = s.id_persona
   LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = s.id_persona
       WHERE s.id_persona = $1
       ORDER BY s.fecha_solicitud DESC;
    `;
    const resultado = await this.pool.query<FilaSolicitudTupaDb>(query, [idPersona]);
    return resultado.rows.map(mapearFila);
  }

  /**
   * Lista todas las solicitudes institucionales para Mesa de Partes / Administrador.
   */
  async listarTodas(filtros?: { estado?: EstadoSolicitudTupa; busqueda?: string }): Promise<SolicitudTupaRegistro[]> {
    const condiciones: string[] = [];
    const params: (string | number)[] = [];

    if (filtros?.estado) {
      params.push(filtros.estado);
      condiciones.push(`s.estado = $${params.length}`);
    }

    if (filtros?.busqueda) {
      params.push(`%${filtros.busqueda.trim()}%`);
      condiciones.push(`(
        s.correo ILIKE $${params.length} OR
        s.motivo ILIKE $${params.length} OR
        pn.nombre_completo ILIKE $${params.length} OR
        p.id_documento ILIKE $${params.length}
      )`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const query = `
      SELECT s.id_solicitud, s.id_persona, s.correo, s.motivo, s.fecha_solicitud,
             s.estado, s.fecha_resolucion, s.resuelto_por, s.observacion_resolucion,
             s.vigencia_hasta,
             pn.nombre_completo, p.id_documento
        FROM sigd_doc.tupa_solicitud_acceso s
        JOIN sigd_auth.persona p ON p.id_persona = s.id_persona
   LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = s.id_persona
       ${where}
       ORDER BY s.fecha_solicitud DESC;
    `;
    const resultado = await this.pool.query<FilaSolicitudTupaDb>(query, params);
    return resultado.rows.map(mapearFila);
  }

  /**
   * Resuelve una solicitud (APROBAR / RECHAZAR). Exclusivo Mesa de Partes / Admin.
   * Cuando se aprueba, la vigencia se calcula a 30 días naturales desde la fecha de aprobación.
   */
  async resolverSolicitud(params: {
    idSolicitud: string;
    estado: 'APROBADA' | 'RECHAZADA';
    resueltoPor: string;
    observacionResolucion?: string;
  }): Promise<SolicitudTupaRegistro | null> {
    const query = `
      UPDATE sigd_doc.tupa_solicitud_acceso
         SET estado = $1::varchar(20),
             fecha_resolucion = now(),
             resuelto_por = $2,
             observacion_resolucion = $3,
             vigencia_hasta = CASE WHEN $1::varchar(20) = 'APROBADA' THEN now() + INTERVAL '30 days' ELSE NULL END
       WHERE id_solicitud = $4
      RETURNING id_solicitud, id_persona, correo, motivo, fecha_solicitud,
                estado, fecha_resolucion, resuelto_por, observacion_resolucion, vigencia_hasta;
    `;
    const resultado = await this.pool.query<FilaSolicitudTupaDb>(query, [
      params.estado,
      params.resueltoPor,
      params.observacionResolucion?.trim() ?? null,
      params.idSolicitud,
    ]);
    if (resultado.rows.length === 0) return null;
    return mapearFila(resultado.rows[0]);
  }
}

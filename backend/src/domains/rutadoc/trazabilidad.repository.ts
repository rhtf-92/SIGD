import type { Pool } from 'pg';
import type { RepositorioTrazabilidadRutaDoc, TipoActuacionTrazabilidad } from './trazabilidad.types.js';

interface FilaActuacion {
  movimiento_id: string;
  secuencia: string;
  fecha_hora: Date;
  estado_anterior: string;
  evento: string;
  estado_nuevo: string;
  usuario_operador_id: string;
  area_anterior_id: string | null;
  area_destino_id: string | null;
  remitente: string | null;
  destinatario: string | null;
  proveido: unknown | null;
  datos_asociados: Record<string, unknown>;
  tipo_actuacion: TipoActuacionTrazabilidad;
  origen?: string;
  unidad_organica?: string | null;
  rol?: string | null;
}

export class RepositorioPostgresTrazabilidadRutaDoc implements RepositorioTrazabilidadRutaDoc {
  constructor(private readonly pool: Pool) {}

  async existeExpediente(idExpediente: string): Promise<boolean> {
    const r = await this.pool.query<{ existe: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM sigd_tra.expediente WHERE expediente_id = $1::uuid) AS existe', [idExpediente]);
    return r.rows[0].existe;
  }

  async listar(idExpediente: string) {
    const r = await this.pool.query<FilaActuacion>(`
      WITH raw_hitos AS (
        -- 1. Radicación Ciudadana / Asiento Registral
        SELECT 
          ar.id_asiento::uuid AS id_movimiento,
          ar.fecha_ingreso AS fecha_hora,
          'INICIO'::text AS estado_anterior,
          'RADICACION_ASIENTO_REGISTRAL'::text AS evento,
          'REGISTRADO'::text AS estado_nuevo,
          COALESCE(e.solicitante_id::text, 'CIUDADANO') AS usuario_operador_id,
          e.area_destino_id::text AS area_destino_id,
          COALESCE(pn.nombre_completo, e.dni_solicitante) AS remitente,
          'Mesa de Partes'::text AS destinatario,
          to_jsonb(ar.asunto) AS proveido,
          jsonb_build_object(
            'cut', e.codigo_expediente,
            'numeroRegistro', ar.numero_registro,
            'canalIngreso', ar.canal_ingreso,
            'dniSolicitante', e.dni_solicitante,
            'asunto', ar.asunto
          ) AS datos,
          'REGISTRAL'::text AS tipo_actuacion,
          'TRAMICORE'::text AS origen,
          'Mesa de Partes'::text AS unidad_organica,
          'Administrado / Mesa de Partes'::text AS rol,
          1 AS orden_causal
        FROM sigd_tra.asiento_registro ar
        JOIN sigd_tra.expediente e ON e.expediente_id = ar.expediente_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = e.solicitante_id
        WHERE e.expediente_id = $1::uuid

        UNION ALL

        -- 2. Orden de Pago (si existe en Tesorería)
        SELECT
          op.id::uuid AS id_movimiento,
          op.creado_en AS fecha_hora,
          'REGISTRADO'::text AS estado_anterior,
          'ORDEN_PAGO_GENERADA'::text AS evento,
          'PENDIENTE_PAGO'::text AS estado_nuevo,
          op.persona_id::text AS usuario_operador_id,
          NULL::text AS area_destino_id,
          'Tesorería'::text AS remitente,
          COALESCE(pn.nombre_completo, 'Administrado') AS destinatario,
          to_jsonb('Emisión de orden de pago por tasa de tramitación TUPA'::text) AS proveido,
          jsonb_build_object(
            'ordenCodigo', op.codigo,
            'concepto', op.concepto,
            'importe', op.importe,
            'moneda', op.moneda
          ) AS datos,
          'FINANCIERO'::text AS tipo_actuacion,
          'TESORERIA'::text AS origen,
          'Unidad de Tesorería'::text AS unidad_organica,
          'Tesorero'::text AS rol,
          2 AS orden_causal
        FROM sigd_tra.expediente_habilitacion eh
        JOIN sigd_tes.orden_pago op ON op.id = eh.orden_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = op.persona_id
        WHERE eh.expediente_id = $1::uuid AND eh.orden_id IS NOT NULL

        UNION ALL

        -- 3. Confirmación de Pago en Caja
        SELECT
          COALESCE(p.id, eh.pago_id, eh.expediente_id) AS id_movimiento,
          COALESCE(p.fecha_operacion, eh.fecha_confirmacion_pago, eh.creado_en) AS fecha_hora,
          'PENDIENTE_PAGO'::text AS estado_anterior,
          'PAGO_CONFIRMADO'::text AS evento,
          'REGISTRADO'::text AS estado_nuevo,
          COALESCE(p.registrado_por::text, 'SISTEMA_TESORERIA') AS usuario_operador_id,
          NULL::text AS area_destino_id,
          'Tesorería'::text AS remitente,
          'Mesa de Partes'::text AS destinatario,
          to_jsonb(COALESCE('Recibo de Caja: ' || p.numero_recibo, 'Confirmación de pago en Tesorería')) AS proveido,
          jsonb_build_object(
            'numeroRecibo', p.numero_recibo,
            'medioPago', p.medio,
            'importeAplicado', p.importe_aplicado,
            'estadoPago', eh.estado_pago
          ) AS datos,
          'FINANCIERO'::text AS tipo_actuacion,
          'TESORERIA'::text AS origen,
          'Unidad de Tesorería'::text AS unidad_organica,
          'Tesorero'::text AS rol,
          3 AS orden_causal
        FROM sigd_tra.expediente_habilitacion eh
        LEFT JOIN sigd_tes.pago p ON p.id = eh.pago_id
        WHERE eh.expediente_id = $1::uuid AND (eh.fecha_confirmacion_pago IS NOT NULL OR p.id IS NOT NULL)

        UNION ALL

        -- 4. Habilitación Formal del Expediente (Cómputo 15 días hábiles LPAG)
        SELECT
          md5(eh.expediente_id::text || '-habilitacion')::uuid AS id_movimiento,
          eh.fecha_habilitacion::timestamp with time zone AS fecha_hora,
          'REGISTRADO'::text AS estado_anterior,
          'EXPEDIENTE_HABILITADO'::text AS evento,
          'HABILITADO'::text AS estado_nuevo,
          'SISTEMA_TRAMICORE'::text AS usuario_operador_id,
          NULL::text AS area_destino_id,
          'Tesorería / Sistema'::text AS remitente,
          'Mesa de Partes'::text AS destinatario,
          to_jsonb('Habilitación formal cumplida tras el cómputo de 15 días hábiles (Art. 143 LPAG)'::text) AS proveido,
          jsonb_build_object(
            'fechaInicioComputo', eh.fecha_inicio_computo,
            'fechaHabilitacion', eh.fecha_habilitacion,
            'diasHabilesRegla', eh.dias_habiles_regla,
            'habilitado', eh.habilitado
          ) AS datos,
          'HABILITACION'::text AS tipo_actuacion,
          'TRAMICORE'::text AS origen,
          'Mesa de Partes'::text AS unidad_organica,
          'Mesa de Partes'::text AS rol,
          4 AS orden_causal
        FROM sigd_tra.expediente_habilitacion eh
        WHERE eh.expediente_id = $1::uuid AND eh.habilitado = TRUE

        UNION ALL

        -- 5. Movimientos FSM RutaDoc (Mesa de Partes, Calificación, Derivación, Revisión, Atención, Firma)
        SELECT 
          mt.id_movimiento::uuid,
          mt.fecha_hora,
          mt.estado_anterior::text,
          mt.evento::text,
          mt.estado_nuevo::text,
          mt.usuario_operador_id::text,
          mt.datos->>'areaId' AS area_destino_id,
          mt.datos->>'remitente' AS remitente,
          mt.datos->>'destinatario' AS destinatario,
          mt.datos->'proveido' AS proveido,
          mt.datos,
          'NORMAL'::text AS tipo_actuacion,
          'RUTADOC'::text AS origen,
          COALESCE(a.nombre, 'Área Institucional') AS unidad_organica,
          COALESCE(mt.datos->>'rol', 'Operador Administrativo') AS rol,
          10 AS orden_causal
        FROM sigd_rut.movimiento_tramite mt
        LEFT JOIN sigd_org.area a ON a.area_id::text = mt.datos->>'areaId'
        WHERE mt.expediente_id = $1::uuid
          AND NOT (mt.evento = 'CIERRE' AND EXISTS (SELECT 1 FROM sigd_rut.expediente_cierre_historial ech WHERE ech.expediente_id = mt.expediente_id))

        UNION ALL

        -- 5. Movimientos Compensatorios (si existen)
        SELECT
          mc.id_movimiento::uuid,
          mc.fecha_hora,
          mc.estado_anterior::text,
          mc.evento::text,
          mc.estado_nuevo::text,
          mc.usuario_operador_id::text,
          mc.datos->>'areaId' AS area_destino_id,
          mc.datos->>'remitente' AS remitente,
          mc.datos->>'destinatario' AS destinatario,
          mc.datos->'proveido' AS proveido,
          mc.datos,
          'COMPENSATORIA'::text AS tipo_actuacion,
          'RUTADOC'::text AS origen,
          'Administración Central'::text AS unidad_organica,
          'Auditor / Supervisor'::text AS rol,
          11 AS orden_causal
        FROM sigd_rut.movimiento_compensatorio mc
        WHERE mc.expediente_id = $1::uuid

        UNION ALL

        -- 6. Asignación de Evaluador Docente
        SELECT
          ee.id_asignacion::uuid AS id_movimiento,
          ee.asignado_en AS fecha_hora,
          'EN_REVISION'::text AS estado_anterior,
          'ASIGNACION_EVALUADOR_DOCENTE'::text AS evento,
          'EN_EVALUACION'::text AS estado_nuevo,
          ee.asignado_por::text AS usuario_operador_id,
          ee.area_id::text AS area_destino_id,
          'Jefatura de Unidad Académica'::text AS remitente,
          'Docente Evaluador (' || ee.id_usuario_docente::text || ')' AS destinatario,
          to_jsonb(ee.motivo_asignacion) AS proveido,
          jsonb_build_object(
            'docenteId', ee.id_usuario_docente,
            'esReasignacion', ee.es_reasignacion,
            'estadoEvaluacion', ee.estado_evaluacion
          ) AS datos,
          'EVALUACION_ACADEMICA'::text AS tipo_actuacion,
          'RUTADOC'::text AS origen,
          'Unidad Académica'::text AS unidad_organica,
          'Coordinador de Área'::text AS rol,
          15 AS orden_causal
        FROM sigd_rut.expediente_evaluador ee
        WHERE ee.expediente_id = $1::uuid

        UNION ALL

        -- 7. Proyecto de Resolución (Borrador elaborado)
        SELECT
          r.resolucion_id::uuid AS id_movimiento,
          r.creado_en AS fecha_hora,
          'ATENDIDO'::text AS estado_anterior,
          'PROYECTO_RESOLUCION_ELABORADO'::text AS evento,
          r.estado::text AS estado_nuevo,
          COALESCE(r.proyectado_por::text, 'SECRETARIA_GENERAL') AS usuario_operador_id,
          NULL::text AS area_destino_id,
          'Secretaría Académica'::text AS remitente,
          'Dirección General'::text AS destinatario,
          to_jsonb(r.asunto) AS proveido,
          jsonb_build_object(
            'numeroBorrador', r.numero_borrador,
            'tipoResolucion', r.tipo_resolucion,
            'asunto', r.asunto
          ) AS datos,
          'PROYECCION_RESOLUTIVA'::text AS tipo_actuacion,
          'DOCUCORE'::text AS origen,
          'Secretaría General'::text AS unidad_organica,
          'Secretario'::text AS rol,
          18 AS orden_causal
        FROM sigd_doc.resolucion r
        WHERE r.expediente_id = $1::uuid

        UNION ALL

        -- 9. Depósito de Notificación en Casilla Electrónica
        SELECT
          nc.id::uuid AS id_movimiento,
          nc.fecha_deposito AS fecha_hora,
          'RESUELTO'::text AS estado_anterior,
          'NOTIFICACION_DEPOSITADA_CASILLA'::text AS evento,
          'RESUELTO'::text AS estado_nuevo,
          'DIRECCION_GENERAL'::text AS usuario_operador_id,
          NULL::text AS area_destino_id,
          'Dirección General'::text AS remitente,
          nc.correo_destinatario AS destinatario,
          to_jsonb('Depósito de acto resolutivo en Casilla Electrónica Ciudadana'::text) AS proveido,
          jsonb_build_object(
            'tipoActo', nc.tipo_acto,
            'numeroDocumento', nc.numero_documento,
            'fechaDeposito', nc.fecha_deposito
          ) AS datos,
          'NOTIFICACION'::text AS tipo_actuacion,
          'CASILLA_ELECTRONICA'::text AS origen,
          'Casilla Electrónica'::text AS unidad_organica,
          'Notificador Institucional'::text AS rol,
          20 AS orden_causal
        FROM sigd_auth.notificacion_casilla nc
        JOIN sigd_tra.expediente exp ON exp.codigo_expediente = nc.cut
        WHERE exp.expediente_id = $1::uuid AND nc.fecha_deposito IS NOT NULL

        UNION ALL

        -- 10. Acuse Digital en Casilla Electrónica
        SELECT
          md5(nc.id::text || '-acuse')::uuid AS id_movimiento,
          COALESCE(nc.acuse_sellado_tiempo, nc.fecha_lectura) AS fecha_hora,
          'RESUELTO'::text AS estado_anterior,
          'ACUSE_DIGITAL_GENERADO'::text AS evento,
          'RESUELTO'::text AS estado_nuevo,
          nc.usuario_id::text AS usuario_operador_id,
          NULL::text AS area_destino_id,
          'Dirección General'::text AS remitente,
          nc.correo_destinatario AS destinatario,
          to_jsonb('Acuse Notificatorio Digital emitido por el administrado'::text) AS proveido,
          jsonb_build_object(
            'idAcuse', nc.id_acuse,
            'hashSha256', COALESCE(nc.acuse_hash_sha256, nc.hash_sha256),
            'tipoActo', nc.tipo_acto,
            'numeroDocumento', nc.numero_documento,
            'selladoTiempo', nc.acuse_sellado_tiempo
          ) AS datos,
          'ACUSE_DIGITAL'::text AS tipo_actuacion,
          'CASILLA_ELECTRONICA'::text AS origen,
          'Casilla Electrónica'::text AS unidad_organica,
          'Ciudadano / Administrado'::text AS rol,
          22 AS orden_causal
        FROM sigd_auth.notificacion_casilla nc
        JOIN sigd_tra.expediente exp ON exp.codigo_expediente = nc.cut
        WHERE exp.expediente_id = $1::uuid
          AND (nc.id_acuse IS NOT NULL OR nc.fecha_lectura IS NOT NULL)

        UNION ALL

        -- 11. Cierre Formal del Procedimiento Administrativo (Deduplicado)
        SELECT
          ech.id_cierre::uuid AS id_movimiento,
          ech.fecha_hora AS fecha_hora,
          ech.estado_anterior::text AS estado_anterior,
          'CIERRE_ADMINISTRATIVO'::text AS evento,
          ech.estado_posterior::text AS estado_nuevo,
          ech.usuario_id::text AS usuario_operador_id,
          ech.unidad_area_id::text AS area_destino_id,
          'Secretaría General'::text AS remitente,
          'Archivo Central'::text AS destinatario,
          to_jsonb(ech.justificacion) AS proveido,
          jsonb_build_object(
            'tipoActuacion', ech.tipo_actuacion,
            'permisoUtilizado', ech.permiso_utilizado,
            'condiciones', ech.condiciones_verificadas
          ) AS datos,
          'CIERRE'::text AS tipo_actuacion,
          'RUTADOC'::text AS origen,
          'Secretaría General'::text AS unidad_organica,
          'Secretario'::text AS rol,
          25 AS orden_causal
        FROM (
          SELECT DISTINCT ON (expediente_id) *
          FROM sigd_rut.expediente_cierre_historial
          WHERE expediente_id = $1::uuid
          ORDER BY expediente_id, fecha_hora ASC
        ) ech

        UNION ALL

        -- 12. Custodia Física en Archivo Central (Deduplicada)
        SELECT
          ec.id_custodia::uuid AS id_movimiento,
          ec.desde AS fecha_hora,
          'ARCHIVADO'::text AS estado_anterior,
          'CUSTODIA_ARCHIVO_CENTRAL'::text AS evento,
          'EN_CUSTODIA'::text AS estado_nuevo,
          ec.custodio_usuario_id::text AS usuario_operador_id,
          ec.area_custodia_id::text AS area_destino_id,
          'Secretaría General'::text AS remitente,
          'Archivo Central'::text AS destinatario,
          to_jsonb(ec.motivo_custodia) AS proveido,
          jsonb_build_object(
            'ubicacionFisica', ec.ubicacion_fisica,
            'activo', ec.activo
          ) AS datos,
          'CUSTODIA'::text AS tipo_actuacion,
          'ARCHIVO_CENTRAL'::text AS origen,
          'Archivo Central'::text AS unidad_organica,
          'Custodio / Archivero Central'::text AS rol,
          30 AS orden_causal
        FROM (
          SELECT DISTINCT ON (expediente_id) *
          FROM sigd_rut.expediente_custodia
          WHERE expediente_id = $1::uuid AND activo = TRUE
          ORDER BY expediente_id, desde ASC
        ) ec
      ), ordenado AS (
        SELECT 
          *,
          ROW_NUMBER() OVER (ORDER BY fecha_hora ASC, orden_causal ASC, id_movimiento ASC) AS secuencia_num,
          lag(area_destino_id) OVER (ORDER BY fecha_hora ASC, orden_causal ASC, id_movimiento ASC) AS area_anterior_id
        FROM raw_hitos
      )
      SELECT
        id_movimiento::text AS movimiento_id,
        secuencia_num::text AS secuencia,
        fecha_hora,
        estado_anterior,
        evento,
        estado_nuevo,
        usuario_operador_id,
        area_anterior_id,
        area_destino_id,
        remitente,
        destinatario,
        proveido,
        datos AS datos_asociados,
        tipo_actuacion,
        origen,
        unidad_organica,
        rol
      FROM ordenado
      ORDER BY fecha_hora ASC, orden_causal ASC, id_movimiento ASC`, [idExpediente]);

    return r.rows.map((fila) => ({
      movimientoId: fila.movimiento_id,
      secuencia: fila.secuencia,
      fechaHora: fila.fecha_hora.toISOString(),
      estadoAnterior: fila.estado_anterior,
      evento: fila.evento,
      estadoNuevo: fila.estado_nuevo,
      usuarioOperadorId: fila.usuario_operador_id,
      areaAnteriorId: fila.area_anterior_id,
      areaDestinoId: fila.area_destino_id,
      remitente: fila.remitente,
      destinatario: fila.destinatario,
      proveido: fila.proveido,
      datosAsociados: fila.datos_asociados,
      tipoActuacion: fila.tipo_actuacion,
      origen: fila.origen,
      unidadOrganica: fila.unidad_organica,
      rol: fila.rol,
    }));
  }
}

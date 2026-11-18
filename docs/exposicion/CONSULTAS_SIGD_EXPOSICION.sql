-- =============================================================================
-- SIGD · IESTP "Suiza" (Pucallpa) — Consultas SELECT verificadas para Exposición
-- Versión base: B_GERIC · commit 3e652ead
-- MODO SOLO LECTURA: Ninguna sentencia modifica datos ni esquemas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXPEDIENTES, CUT Y TUPA
-- -----------------------------------------------------------------------------

-- 1.1 Resumen de un expediente específico con su vínculo TUPA y custodia actual
SELECT
  e.expediente_id,
  e.codigo_expediente AS cut,
  e.estado AS estado_expediente,
  ea.estado_nuevo AS estado_fsm,
  ea.secuencia,
  ar.codigo AS area_actual_codigo,
  ar.nombre AS area_actual_nombre,
  t.asunto,
  v.codigo_ref AS tupa_ref,
  v.denominacion_snapshot AS procedimiento_tupa,
  v.monto_efectivo,
  v.unidad_receptora_codigo,
  v.unidad_responsable_codigo,
  v.unidad_resolutiva_codigo,
  e.fecha_radicacion
FROM sigd_tra.expediente e
LEFT JOIN sigd_tra.tramite t ON t.expediente_id = e.expediente_id
LEFT JOIN sigd_rut.estado_actual_expediente ea ON ea.expediente_id = e.expediente_id
LEFT JOIN sigd_org.area ar ON ar.area_id::text = COALESCE(ea.area_actual_id, e.area_destino_id::text)
LEFT JOIN sigd_doc.expediente_tupa_vinculo v ON v.expediente_id = e.expediente_id
WHERE e.codigo_expediente = 'EXP-2026-000149';

-- 1.2 Procedimiento TUPA p1-fila-06 (Certificado de Inglés) y su versión vigente
SELECT
  p.id_procedimiento,
  p.codigo_ref,
  p.denominacion,
  p.categoria,
  p.monto,
  p.plazo_dias,
  p.calificacion,
  rv.referencia_fila,
  rv.fuente_nombre,
  rv.estado_validacion,
  ar_rec.codigo AS receptora,
  ar_res.codigo AS responsable_tecnica,
  ar_dir.codigo AS resolutiva
FROM sigd_doc.tupa_procedimiento p
LEFT JOIN sigd_doc.tupa_registro_version rv ON rv.registro_version_id = p.registro_version_id
LEFT JOIN sigd_org.area ar_rec ON ar_rec.area_id = p.unidad_receptora_id
LEFT JOIN sigd_org.area ar_res ON ar_res.area_id = p.unidad_responsable_id
LEFT JOIN sigd_org.area ar_dir ON ar_dir.area_id = p.unidad_resolutiva_id
WHERE p.codigo_ref = 'p1-fila-06' OR rv.referencia_fila = 'p1-fila-06';

-- 1.3 Distribución real de expedientes por estado en sigd_tra.expediente
SELECT
  estado,
  COUNT(*)::int AS total
FROM sigd_tra.expediente
GROUP BY estado
ORDER BY total DESC, estado ASC;

-- -----------------------------------------------------------------------------
-- 2. USUARIOS, ROLES, ÁREAS Y PERFILES OPERATIVOS (SIN CREDENCIALES)
-- -----------------------------------------------------------------------------

-- 2.1 Cuentas institucionales de laboratorio con rol, área y perfil operativo
SELECT
  cu.id_usuario,
  cu.usuario,
  pn.nombre_completo,
  rs.codigo AS rol,
  ar.codigo AS area_codigo,
  ar.nombre AS area_nombre,
  po.codigo AS perfil_operativo,
  apo.scope,
  apo.estado AS estado_perfil
FROM sigd_auth.cuenta_usuario cu
JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
LEFT JOIN sigd_org.usuario_rol ur
  ON ur.id_usuario = cu.id_usuario
  AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
LEFT JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id
LEFT JOIN sigd_org.area ar ON ar.area_id = ur.area_id
LEFT JOIN sigd_org.asignacion_perfil_operativo apo
  ON apo.id_usuario = cu.id_usuario
  AND apo.estado = 'ACTIVO'
LEFT JOIN sigd_org.perfil_operativo po ON po.perfil_id = apo.perfil_id
WHERE cu.usuario LIKE '%_demo'
ORDER BY cu.usuario;

-- 2.2 Áreas orgánicas vigentes registradas en OrganiCore
SELECT
  area_id,
  codigo,
  nombre,
  tipo_unidad,
  nivel,
  vigente
FROM sigd_org.area
WHERE vigente = true
ORDER BY nivel, codigo;

-- -----------------------------------------------------------------------------
-- 3. PAGOS Y RECIBOS (TESORERÍA)
-- -----------------------------------------------------------------------------

-- 3.1 Últimas órdenes de cobro y recibos emitidos
SELECT
  op.codigo_pago,
  e.codigo_expediente AS cut,
  op.codigo_tupa,
  op.monto,
  op.moneda,
  op.estado,
  op.metodo_pago,
  op.codigo_recibo,
  op.confirmed_source,
  op.fecha_pago
FROM sigd_tra.orden_pago op
JOIN sigd_tra.expediente e ON e.expediente_id = op.expediente_id
ORDER BY op.created_at DESC
LIMIT 15;

-- -----------------------------------------------------------------------------
-- 4. MOVIMIENTOS WORM Y CUSTODIA (RUTADOC)
-- -----------------------------------------------------------------------------

-- 4.1 Historial secuencial inmutable de movimientos para EXP-2026-000149
SELECT
  m.secuencia,
  m.estado_anterior,
  m.evento,
  m.estado_nuevo,
  m.usuario_operador_id,
  m.fecha_hora,
  m.datos->>'proveido' AS proveido,
  m.datos->>'resultado_resumen' AS resultado_resumen,
  m.datos->>'estante' AS estante_archivo,
  m.datos->>'caja' AS caja_archivo
FROM sigd_rut.movimiento_tramite m
JOIN sigd_tra.expediente e ON e.expediente_id = m.expediente_id
WHERE e.codigo_expediente = 'EXP-2026-000149'
ORDER BY m.secuencia ASC;

-- -----------------------------------------------------------------------------
-- 5. ASIGNACIONES Y DICTÁMENES TÉCNICOS
-- -----------------------------------------------------------------------------

-- 5.1 Historial de asignaciones a especialistas para EXP-2026-000149
SELECT
  ea.id_asignacion,
  e.codigo_expediente AS cut,
  ar.codigo AS area_codigo,
  pn.nombre_completo AS especialista_asignado,
  cu.usuario AS cuenta_especialista,
  ea.motivo,
  ea.activo,
  ea.asignado_en,
  ea.desasignado_en
FROM sigd_rut.expediente_asignacion ea
JOIN sigd_tra.expediente e ON e.expediente_id = ea.expediente_id
JOIN sigd_org.area ar ON ar.area_id = ea.id_area
LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = ea.id_usuario
LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = ea.id_persona
WHERE e.codigo_expediente = 'EXP-2026-000149'
ORDER BY ea.asignado_en ASC;

-- -----------------------------------------------------------------------------
-- 6. RESOLUCIONES, DOCUMENTOS EN MINIO, SHA-256 Y FIRMA CVD
-- -----------------------------------------------------------------------------

-- 6.1 Documentos adjuntos, resoluciones, llaves S3 y evidencia criptográfica (EXP-2026-000149 vs EXP-2026-000150)
SELECT
  e.codigo_expediente AS cut,
  da.documento_adjunto_id,
  da.nombre_archivo,
  da.s3_bucket,
  da.s3_key,
  da.tamano_bytes,
  da.sha256,
  r.numero_resolucion,
  r.estado AS estado_resolucion,
  f.cvd,
  f.estado AS estado_firma,
  f.proveedor_firma,
  f.algoritmo_firma,
  f.fecha_sello_tsa
FROM sigd_doc.documento_adjunto da
JOIN sigd_tra.expediente e ON e.expediente_id = COALESCE(da.expediente_tra_id, da.expediente_id)
LEFT JOIN sigd_doc.resolucion r ON r.resolucion_id = da.documento_adjunto_id
LEFT JOIN sigd_doc.firma_digital_documento f ON f.documento_id = da.documento_adjunto_id
WHERE e.codigo_expediente IN ('EXP-2026-000149', 'EXP-2026-000150')
ORDER BY e.codigo_expediente, da.creado_en ASC;

-- -----------------------------------------------------------------------------
-- 7. NOTIFICACIONES, VINCULACIÓN Y AUDITORÍA OUTBOX
-- -----------------------------------------------------------------------------

-- 7.1 Notificaciones depositadas en Casilla y su trazabilidad de entrega/acuse
SELECT
  nc.id AS notificacion_id,
  nc.cut,
  nc.usuario_id,
  nc.persona_id,
  nc.correo_destinatario,
  nc.tipo_acto,
  nc.estado AS estado_notificacion,
  nc.cvd,
  nc.id_acuse,
  nc.fecha_deposito,
  nc.fecha_lectura,
  nc.fecha_descarga,
  nte.tipo_evento AS ultimo_evento_traza,
  nte.canal,
  nte.registrado_en
FROM sigd_auth.notificacion_casilla nc
LEFT JOIN sigd_auth.notificacion_trazabilidad_evento nte ON nte.notificacion_id = nc.id
WHERE nc.cut = 'EXP-2026-000149'
ORDER BY nc.fecha_deposito DESC, nte.registrado_en DESC
LIMIT 10;

-- 7.2 Últimos eventos procesados en Outbox y bitácora general de auditoría
SELECT
  eo.id_evento,
  eo.agregado,
  eo.tipo_evento,
  eo.estado,
  eo.intentos,
  eo.creado_en,
  eo.procesado_en
FROM sigd_audit.evento_outbox eo
ORDER BY eo.creado_en DESC
LIMIT 15;

SELECT
  ba.id_auditoria,
  ba.correlation_id,
  ba.esquema,
  ba.tabla,
  ba.operacion,
  ba.fecha_hora
FROM sigd_audit.bitacora_auditoria ba
ORDER BY ba.fecha_hora DESC
LIMIT 10;

-- -----------------------------------------------------------------------------
-- 8. TABLERO DIRECTIVO MGD (VISTAS MATERIALIZADAS)
-- -----------------------------------------------------------------------------

-- 8.1 Contadores agregados por período en la vista materializada del tablero
SELECT
  periodo,
  unidad_organica_id,
  n_radicados,
  n_atendidos,
  n_archivados,
  n_resueltos,
  n_observados
FROM sigd_tra.mv_kpis_mgd_mensual
ORDER BY periodo DESC, n_radicados DESC;

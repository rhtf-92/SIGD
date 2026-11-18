-- =============================================================================
-- Migración 18 · Índices de Optimización de Rendimiento y Llaves Foráneas
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)
-- =============================================================================

-- 1. Índice en solicitante_id de sigd_tra.expediente (optimiza mis-expedientes de ciudadanos)
CREATE INDEX IF NOT EXISTS idx_tra_expediente_solicitante
    ON sigd_tra.expediente (solicitante_id);

-- 2. Índices en llaves foráneas de roles de usuario
CREATE INDEX IF NOT EXISTS idx_org_usuario_rol_rol
    ON sigd_org.usuario_rol (rol_id);

CREATE INDEX IF NOT EXISTS idx_org_usuario_rol_area
    ON sigd_org.usuario_rol (area_id);

-- 3. Índices en llaves foráneas de asignación de personal institucional
CREATE INDEX IF NOT EXISTS idx_org_asignacion_personal_area
    ON sigd_org.asignacion_personal (area_id);

CREATE INDEX IF NOT EXISTS idx_org_asignacion_personal_cargo
    ON sigd_org.asignacion_personal (cargo_id);

-- 4. Índice en tipo_documental_id de documento_adjunto
CREATE INDEX IF NOT EXISTS idx_doc_documento_adjunto_tipo
    ON sigd_doc.documento_adjunto (tipo_documental_id);

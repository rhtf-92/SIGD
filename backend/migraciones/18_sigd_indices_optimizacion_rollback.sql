-- =============================================================================
-- Rollback Migración 18 · Índices de Optimización de Rendimiento
-- =============================================================================

DROP INDEX IF EXISTS sigd_doc.idx_doc_documento_adjunto_tipo;
DROP INDEX IF EXISTS sigd_org.idx_org_asignacion_personal_cargo;
DROP INDEX IF EXISTS sigd_org.idx_org_asignacion_personal_area;
DROP INDEX IF EXISTS sigd_org.idx_org_usuario_rol_area;
DROP INDEX IF EXISTS sigd_org.idx_org_usuario_rol_rol;
DROP INDEX IF EXISTS sigd_tra.idx_tra_expediente_solicitante;

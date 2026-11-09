-- =============================================================================
-- Migración 35 · Esquema sigd_org · Perfil Operativo AUTORIZADOR_DEVOLUCION (Fase 5D)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Segregación formal de autoridad de devoluciones SIGD 2026
-- Depende de: 34_sigd_autorizacion_perfiles_operativos.sql
-- =============================================================================

BEGIN;

-- 1. Insertar nuevo perfil operativo independiente: AUTORIZADOR_DEVOLUCION (DISEÑO_SIGD)
INSERT INTO sigd_org.perfil_operativo (codigo, nombre, descripcion)
VALUES (
    'AUTORIZADOR_DEVOLUCION',
    'Autorizador de Devolución',
    'Perfil funcional independiente con competencia formal para autorizar solicitudes de devolución arancelaria'
)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Retirar DEVOLUCION_AUTORIZAR de GESTOR_RECEPCION_DOCUMENTAL (Mesa de Partes sólo conserva DEVOLUCION_REVISAR)
DELETE FROM sigd_org.perfil_permiso
WHERE perfil_id = (SELECT perfil_id FROM sigd_org.perfil_operativo WHERE codigo = 'GESTOR_RECEPCION_DOCUMENTAL')
  AND permiso_id = (SELECT permiso_id FROM sigd_org.permiso_sistema WHERE codigo = 'DEVOLUCION_AUTORIZAR');

-- 3. Asignar DEVOLUCION_AUTORIZAR al nuevo perfil AUTORIZADOR_DEVOLUCION
INSERT INTO sigd_org.perfil_permiso (perfil_id, permiso_id)
SELECT p.perfil_id, perm.permiso_id
FROM sigd_org.perfil_operativo p, sigd_org.permiso_sistema perm
WHERE p.codigo = 'AUTORIZADOR_DEVOLUCION'
  AND perm.codigo = 'DEVOLUCION_AUTORIZAR'
ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- SIGD · Grupo 2 "TramiCore" - DATOS DEMOSTRATIVOS (NO OFICIALES)
-- Ejecutar DESPUÉS de 03_esquema_sigd_tra_cut_foliado.sql
--
-- Todos los registros son FICTICIOS y solo demuestran el funcionamiento.
-- Ningún código, nombre, DNI o documento representa información institucional.
-- =============================================================================

SET search_path TO sigd_tra, public;

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TRÁMITES (codigo_tramite NULL: formato institucional PENDIENTE)
-- -----------------------------------------------------------------------------
INSERT INTO tramite (asunto, estado, fk_remitente, fk_destinatario) VALUES
('Solicitud de Expedición de Título Profesional', 'EN_TRAMITE', 101, 301),
('Rectificación de Notas de Asignatura de Base de Datos', 'OBSERVADO', 102, 302),
('Mantenimiento preventivo de Servidores de Red', 'REGISTRADO', 103, 303),
('Solicitud Inválida con Error de Formato', 'ANULADO', 104, 301);

-- -----------------------------------------------------------------------------
-- 2. EXPEDIENTES
-- Se insertan SIN codigo_expediente: el trigger trg_expediente_asignar_cut
-- genera automáticamente el CUT EXP-2026-000001 .. EXP-2026-000005,
-- demostrando la conexión automática entre la función y el INSERT.
-- -----------------------------------------------------------------------------
INSERT INTO expediente (fk_tramite) VALUES
(1), (1), (2), (3), (4);

-- Verificación de la auto-generación de CUT:
-- SELECT id_expediente, codigo_expediente, estado_expediente FROM expediente ORDER BY id_expediente;

-- -----------------------------------------------------------------------------
-- 3. ACUMULACIÓN (vía función validada)
-- Principal 1 -> accesorio 2 · Principal 4 -> accesorio 5
-- -----------------------------------------------------------------------------
SELECT sigd_tra.acumular_expediente(
    1, 2, 'Acto Resolutivo N° 001-2026: Fusión de expedientes accesorios por conexidad jurídica'
);
SELECT sigd_tra.acumular_expediente(
    4, 5, 'Acto Resolutivo N° 002-2026: Acumulación por vinculación administrativa'
);

-- -----------------------------------------------------------------------------
-- 4. FOLIACIÓN (vía función canónica que garantiza rangos contiguos)
-- -----------------------------------------------------------------------------
SELECT sigd_tra.agregar_folio_expediente(1, 101, 5);  -- folios 1-5
SELECT sigd_tra.agregar_folio_expediente(1, 102, 7);  -- folios 6-12
SELECT sigd_tra.agregar_folio_expediente(3, 201, 3);  -- folios 1-3
SELECT sigd_tra.agregar_folio_expediente(4, 301, 10); -- folios 1-10

-- -----------------------------------------------------------------------------
-- 5. ASIENTOS DEL LIBRO GENERAL DE REGISTROS (número_registro auto: 10001-10004)
-- -----------------------------------------------------------------------------
INSERT INTO asiento_registro (canal_ingreso, asunto, fk_expediente, fk_remitente, fk_destinatario, anulado, motivo_anulacion) VALUES
('MESA_VIRTUAL', 'Solicitud de Expedición de Título Profesional', 1, 101, 301, FALSE, NULL),
('MESA_PRESENCIAL', 'Rectificación de Notas de Asignatura de Base de Datos', 3, 102, 302, FALSE, NULL),
('MESA_VIRTUAL', 'Mantenimiento preventivo de Servidores de Red', 4, 103, 303, FALSE, NULL),
('MESA_PRESENCIAL', 'Solicitud Inválida con Error de Formato', 5, 104, 301, TRUE, 'Registro duplicado por error material del operador');

COMMIT;

-- =============================================================================
-- RESUMEN DE CARGA (registros de verificación, NO con valor):
-- SELECT 'tramite'      AS tabla, COUNT(*) FROM tramite
-- UNION ALL SELECT 'expediente',            COUNT(*) FROM expediente
-- UNION ALL SELECT 'expediente_acumulacion',COUNT(*) FROM expediente_acumulacion
-- UNION ALL SELECT 'expediente_documento_folio', COUNT(*) FROM expediente_documento_folio
-- UNION ALL SELECT 'asiento_registro',       COUNT(*) FROM asiento_registro;
-- =============================================================================
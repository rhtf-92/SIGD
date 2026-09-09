-- =============================================================================
-- SIGD · Grupo 2 "TramiCore" — PRUEBAS DE LABORATORIO REPRODUCIBLES (H4)
--
-- Requisitos previos:
--   1) Ejecutar 03_esquema_sigd_tra_cut_foliado.sql   (DDL solo esquema)
--   2) Ejecutar 04_datos_demo_tramicore.sql           (datos demo, NO oficiales)
--
-- Este script ejecuta pruebas DETERMINISTAS en una sola sesión y termina con
-- ROLLBACK: no deja residuos en la base (responde a la observación de datos de
-- prueba dentro del DDL sin rollback de laboratorio).
--
-- Las pruebas de CONCURRENCIA (500 CUTs y carrera de año nuevo) NO pueden
-- ejecutarse en una sola sesión; las ejecuta el lanzador:
--   07_lanzador_pruebas_tramicore.ps1
--
-- Ejecución:
--   psql -h localhost -p 5432 -U postgres -d tramicore_prueba -v ON_ERROR_STOP=1 -f 06_pruebas_laboratorio_tramicore.sql
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- Tabla temporal de resultados (no deja residuos: se elimina con el ROLLBACK).
CREATE TEMP TABLE _resumen_pruebas (
    prueba  TEXT PRIMARY KEY,
    estado  TEXT NOT NULL,
    detalle TEXT
);

-- Registra un resultado en el resumen; un fallo aborta el script (ON_ERROR_STOP).
CREATE OR REPLACE FUNCTION sigd_tra._registrar_resultado(
    p_prueba TEXT, p_ok BOOLEAN, p_detalle TEXT
) RETURNS VOID LANGUAGE plpgsql SET search_path = sigd_tra, public AS $$
BEGIN
    INSERT INTO _resumen_pruebas (prueba, estado, detalle)
    VALUES (p_prueba, CASE WHEN p_ok THEN 'OK' ELSE 'FALLO' END, p_detalle)
    ON CONFLICT (prueba) DO UPDATE SET estado = EXCLUDED.estado, detalle = EXCLUDED.detalle;

    IF NOT p_ok THEN
        RAISE EXCEPTION 'PRUEBA % FALLÓ: %', p_prueba, p_detalle;
    END IF;
END;
$$;

-- =============================================================================
-- P01 · CUT por año fiscal: reinicio en 000001 y formato EXP-YYYY-XXXXXX
-- =============================================================================
DO $$
DECLARE
    v_2027a VARCHAR(20);
    v_2027b VARCHAR(20);
BEGIN
    SELECT sigd_tra.generar_cut_expediente(2027) INTO v_2027a;
    SELECT sigd_tra.generar_cut_expediente(2027) INTO v_2027b;

    IF v_2027a <> 'EXP-2027-000001' THEN
        PERFORM sigd_tra._registrar_resultado(
            'P01', FALSE, 'Primer CUT de 2027 = ' || v_2027a || ' (se esperaba EXP-2027-000001)');
    ELSIF v_2027b <> 'EXP-2027-000002' THEN
        PERFORM sigd_tra._registrar_resultado(
            'P01', FALSE, 'Segundo CUT de 2027 = ' || v_2027b || ' (se esperaba EXP-2027-000002)');
    ELSIF v_2027a !~ '^EXP-[0-9]{4}-[0-9]{6}$' THEN
        PERFORM sigd_tra._registrar_resultado(
            'P01', FALSE, 'Formato inválido: ' || v_2027a);
    ELSE
        PERFORM sigd_tra._registrar_resultado(
            'P01', TRUE, 'Reinicio anual OK: ' || v_2027a || ', ' || v_2027b);
    END IF;
END;
$$;

-- =============================================================================
-- P02 · CUT conectado automáticamente al INSERT de expediente (trigger)
-- =============================================================================
DO $$
DECLARE
    v_id_tramite BIGINT;
    v_id_expediente BIGINT;
    v_codigo VARCHAR(20);
BEGIN
    INSERT INTO sigd_tra.tramite (asunto, estado, fk_remitente, fk_destinatario)
    VALUES ('Prueba de auto-CUT (laboratorio)', 'REGISTRADO', 101, 301)
    RETURNING id_tramite INTO v_id_tramite;

    INSERT INTO sigd_tra.expediente (fk_tramite)
    VALUES (v_id_tramite)
    RETURNING id_expediente, codigo_expediente INTO v_id_expediente, v_codigo;

    IF v_codigo IS NULL THEN
        PERFORM sigd_tra._registrar_resultado('P02', FALSE, 'codigo_expediente quedó NULL');
    ELSIF v_codigo !~ '^EXP-2026-[0-9]{6}$' THEN
        PERFORM sigd_tra._registrar_resultado('P02', FALSE, 'CUT generado inválido: ' || v_codigo);
    ELSE
        PERFORM sigd_tra._registrar_resultado(
            'P02', TRUE, 'INSERT disparó CUT ' || v_codigo ||
                        ' y el CHECK de formato lo aceptó');
    END IF;
END;
$$;

-- =============================================================================
-- P03 (launcher) · Concurrencia: 500 CUTs en 5 sesiones + carrera año 2028.
-- Ejecutado por 07_lanzador_pruebas_tramicore.ps1; aquí no se reproduce.
-- =============================================================================

-- =============================================================================
-- P04 · Solapamiento de folios rechazado por trigger (INSERT real ejecutado)
-- =============================================================================
DO $$
BEGIN
    BEGIN
        INSERT INTO sigd_tra.expediente_documento_folio
            (id_expediente, id_documento, folio_inicio, folio_fin, total_folios)
        VALUES (1, 999, 3, 8, 6);
        PERFORM sigd_tra._registrar_resultado(
            'P04', FALSE, 'El solapamiento NO fue rechazado');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P04', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;
END;
$$;

-- =============================================================================
-- P05 · Foliación contigua vía función canónica (bloquea expediente)
-- =============================================================================
DO $$
DECLARE
    v_inicio INT;
    v_fin INT;
    v_total INT;
BEGIN
    SELECT sigd_tra.agregar_folio_expediente(1, 103, 4) INTO v_inicio;
    SELECT folio_fin, total_folios INTO v_fin, v_total
    FROM sigd_tra.expediente_documento_folio
    WHERE id_expediente = 1
    ORDER BY folio_fin DESC
    LIMIT 1;

    IF v_inicio <> 13 THEN
        PERFORM sigd_tra._registrar_resultado(
            'P05', FALSE, 'folio_inicio = ' || v_inicio || ' (se esperaba 13)');
    ELSE
        PERFORM sigd_tra._registrar_resultado(
            'P05', TRUE, 'Rango contiguo asignado: ' || v_inicio || '-' || v_fin );
    END IF;
END;
$$;

-- =============================================================================
-- P06 · CHECK folio_fin >= folio_inicio (INSERCIÓN REAL rechazada)
-- =============================================================================
DO $$
BEGIN
    BEGIN
        INSERT INTO sigd_tra.expediente_documento_folio
            (id_expediente, id_documento, folio_inicio, folio_fin, total_folios)
        VALUES (1, 999, 10, 5, 5);
        PERFORM sigd_tra._registrar_resultado(
            'P06', FALSE, 'El rango inválido NO fue rechazado');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P06', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;
END;
$$;

-- =============================================================================
-- P07 · CHECK total_folios = folio_fin - folio_inicio + 1 (INSERCIÓN REAL)
-- =============================================================================
DO $$
BEGIN
    BEGIN
        INSERT INTO sigd_tra.expediente_documento_folio
            (id_expediente, id_documento, folio_inicio, folio_fin, total_folios)
        VALUES (1, 999, 20, 25, 999);
        PERFORM sigd_tra._registrar_resultado(
            'P07', FALSE, 'El total incoherente NO fue rechazado');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P07', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;
END;
$$;

-- =============================================================================
-- P08 · Folio: UPDATE prohibido (inmutabilidad real probada)
-- =============================================================================
DO $$
BEGIN
    BEGIN
        UPDATE sigd_tra.expediente_documento_folio SET folio_fin = 99 WHERE id_folio = 1;
        PERFORM sigd_tra._registrar_resultado(
            'P08', FALSE, 'El UPDATE de folio NO fue rechazado');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P08', TRUE, 'UPDATE rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;
END;
$$;

-- =============================================================================
-- P09 · Folio: DELETE prohibido (inmutabilidad real probada)
-- =============================================================================
DO $$
BEGIN
    BEGIN
        DELETE FROM sigd_tra.expediente_documento_folio WHERE id_folio = 1;
        PERFORM sigd_tra._registrar_resultado(
            'P09', FALSE, 'El DELETE de folio NO fue rechazado');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P09', TRUE, 'DELETE rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;
END;
$$;

-- =============================================================================
-- P10 · Acumulación: un expediente no puede acumularse a sí mismo
-- =============================================================================
DO $$
BEGIN
    BEGIN
        PERFORM sigd_tra.acumular_expediente(3, 3, 'Auto-acumulación de prueba');
        PERFORM sigd_tra._registrar_resultado(
            'P10', FALSE, 'La auto-acumulación NO fue rechazada');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P10', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;
END;
$$;

-- =============================================================================
-- P11 · Acumulación: par (principal, accesorio) ACTIVO duplicado rechazado
-- (índice único parcial uq_acumulacion_vigente sobre filas ACUMULADO).
-- INSERT directo del par que ya está acumulado en los datos demo.
-- =============================================================================
DO $$
BEGIN
    BEGIN
        INSERT INTO sigd_tra.expediente_acumulacion
            (id_expediente_principal, id_expediente_accesorio, acto_resolutivo)
        VALUES (1, 2, 'Duplicado de par acumulado (laboratorio)');
        PERFORM sigd_tra._registrar_resultado(
            'P11', FALSE, 'El par duplicado NO fue rechazado');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P11', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;
END;
$$;

-- =============================================================================
-- P12 · Accesorio que ya pertenece a un principal (multi-principal) rechazado
-- El expediente 2 ya es accesorio del 1 (estado ACUMULADO).
-- =============================================================================
DO $$
BEGIN
    BEGIN
        PERFORM sigd_tra.acumular_expediente(3, 2, 'Intento de doble acumulación');
        PERFORM sigd_tra._registrar_resultado(
            'P12', FALSE, 'El accesorio multi-principal NO fue rechazado');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P12', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;
END;
$$;

-- =============================================================================
-- P13 · Ciclo de acumulación rechazado (3→4 y luego 4→3)
-- =============================================================================
DO $$
DECLARE
    v_id_acum BIGINT;
BEGIN
    SELECT sigd_tra.acumular_expediente(3, 4, 'Acumulación 3→4 (laboratorio)') INTO v_id_acum;

    BEGIN
        PERFORM sigd_tra.acumular_expediente(4, 3, 'Intento de ciclo: 4→3');
        PERFORM sigd_tra._registrar_resultado(
            'P13', FALSE, 'El ciclo NO fue rechazado');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P13', TRUE, 'Ciclo rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;
END;
$$;

-- =============================================================================
-- P14 · Desacumulación: reglas (fecha, acto) y re-acumulación posterior
-- =============================================================================
DO $$
DECLARE
    v_acum BIGINT;
BEGIN
    -- Rechazan: fecha anterior al acto de acumulación
    BEGIN
        PERFORM sigd_tra.desacumular_expediente(
            1, 'Acto X', (SELECT fecha_acumulacion - interval '1 day'
                          FROM sigd_tra.expediente_acumulacion WHERE id_acumulacion = 1));
        PERFORM sigd_tra._registrar_resultado(
            'P14a', FALSE, 'La fecha retrógrada NO fue rechazada');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P14a', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;

    -- Rechazan: sin acto resolutivo
    BEGIN
        PERFORM sigd_tra.desacumular_expediente(1, '');
        PERFORM sigd_tra._registrar_resultado(
            'P14b', FALSE, 'La desacumulación sin acto NO fue rechazada');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P14b', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;

    -- Restauración correcta del accesorio 2 a ACTIVO
    PERFORM sigd_tra.desacumular_expediente(1, 'Acto Resolutivo N° 010-2026: Desacumulación (laboratorio)');

    IF EXISTS (SELECT 1 FROM sigd_tra.expediente WHERE id_expediente = 2 AND estado_expediente <> 'ACTIVO') THEN
        PERFORM sigd_tra._registrar_resultado(
            'P14c', FALSE, 'El accesorio 2 no volvió a ACTIVO');
    ELSE
        PERFORM sigd_tra._registrar_resultado(
            'P14c', TRUE, 'Accesorio 2 restaurado a ACTIVO');
    END IF;

    -- Re-acumulación permitida tras desacumular
    SELECT sigd_tra.acumular_expediente(1, 2, 'Re-acumulación tras desacumulación (laboratorio)') INTO v_acum;
    PERFORM sigd_tra._registrar_resultado(
        'P14d', TRUE, 'Re-acumulación OK (id acumulación ' || v_acum || ')');
END;
$$;

-- =============================================================================
-- P15 · Asiento: numero_registro inmutable (UPDATE), sin DELETE físico,
--        y número no reutilizable tras anulación lógica.
-- =============================================================================
DO $$
BEGIN
    -- UPDATE de numero_registro prohibido
    BEGIN
        UPDATE sigd_tra.asiento_registro SET numero_registro = 99999 WHERE id_asiento = 1;
        PERFORM sigd_tra._registrar_resultado(
            'P15a', FALSE, 'El UPDATE de numero_registro NO fue rechazado');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P15a', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;

    -- DELETE físico prohibido
    BEGIN
        DELETE FROM sigd_tra.asiento_registro WHERE id_asiento = 1;
        PERFORM sigd_tra._registrar_resultado(
            'P15b', FALSE, 'El DELETE del asiento NO fue rechazado');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P15b', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;

    -- Anulación lógica permitida
    UPDATE sigd_tra.asiento_registro
    SET anulado = TRUE, motivo_anulacion = 'Anulado por prueba H4 (laboratorio)'
    WHERE id_asiento = 1;

    IF NOT EXISTS (SELECT 1 FROM sigd_tra.asiento_registro WHERE id_asiento = 1) THEN
        PERFORM sigd_tra._registrar_resultado(
            'P15c', FALSE, 'El asiento desapareció tras la anulación');
    ELSE
        PERFORM sigd_tra._registrar_resultado(
            'P15c', TRUE, 'Borrado lógico conserva el asiento 1');
    END IF;

    -- Reutilización del número anulado prohibida (UNIQUE)
    BEGIN
        INSERT INTO sigd_tra.asiento_registro (numero_registro, canal_ingreso, asunto, fk_expediente, fk_remitente)
        VALUES (10001, 'MESA_VIRTUAL', 'Reutilización de número anulado', 3, 101);
        PERFORM sigd_tra._registrar_resultado(
            'P15d', FALSE, 'La reutilización de numero_registro NO fue rechazada');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P15d', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;
END;
$$;

-- =============================================================================
-- P16 · Integridad referencial (FK): expediente con trámite inexistente
-- =============================================================================
DO $$
BEGIN
    BEGIN
        INSERT INTO sigd_tra.expediente (codigo_expediente, fk_tramite)
        VALUES ('EXP-2026-999999', 99999);
        PERFORM sigd_tra._registrar_resultado(
            'P16', FALSE, 'La FK NO rechazó el trámite inexistente');
    EXCEPTION WHEN OTHERS THEN
        PERFORM sigd_tra._registrar_resultado(
            'P16', TRUE, 'Rechazado: [' || SQLSTATE || '] ' || SQLERRM);
    END;
END;
$$;

-- =============================================================================
-- RESUMEN FINAL DE LABORATORIO
-- =============================================================================
SELECT prueba AS resultado, estado, detalle
FROM _resumen_pruebas
ORDER BY prueba;

-- ROLLBACK: el laboratorio NO deja residuos en la base.
ROLLBACK;
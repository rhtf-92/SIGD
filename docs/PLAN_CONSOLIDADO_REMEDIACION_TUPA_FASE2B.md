# SIGD IESTP SUIZA 2026 — FASE 2B: PLAN CONSOLIDADO DE REMEDIACIÓN TUPA Y VALIDACIÓN FUNCIONAL

**Fecha:** 26 de octubre de 2026  
**Repositorio:** `C:\Users\Liz\Desktop\SIGD\SIGD`  
**Rama activa:** `B_JACOBO`  
**HEAD commit:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Base de datos de demostración:** `sigd_jacobo_demo` en puerto `5433` (Docker: `sigd-postgres-1`)  
**Carácter del documento:** Propuesta Definitiva, Consolidación de Informes y Protocolo de Verificación (Zero-Write Audit)

---

## ÍNDICE GENERAL

1. [1. Preservación del Entorno y Estado Verificado en Tiempo Real](#1-preservación-del-entorno-y-estado-verificado-en-tiempo-real)
2. [2. Consolidación de Informes y Erradicación de Inconsistencias](#2-consolidación-de-informes-y-erradicación-de-inconsistencias)
3. [3. Análisis Riguroso de la Obligatoriedad (Sustantiva vs. Instrumental vs. Código)](#3-análisis-riguroso-de-la-obligatoriedad-sustantiva-vs-instrumental-vs-código)
4. [4. Análisis y Tratamiento Institucional del FUT en SUZ26-066](#4-análisis-y-tratamiento-institucional-del-fut-en-suz26-066)
5. [5. Especificación y Ruta del Script SQL Propuesto](#5-especificación-y-ruta-del-script-sql-propuesto)
6. [6. Tabla de Precondiciones y Resultados Esperados](#6-tabla-de-precondiciones-y-resultados-esperados)
7. [7. Matriz Integral de Riesgos y Decisiones Pendientes](#7-matriz-integral-de-riesgos-y-decisiones-pendientes)
8. [8. Plan de Pruebas E2E Controlado (Diseño sin Ejecución)](#8-plan-de-pruebas-e2e-controlado-diseño-sin-ejecución)
9. [9. Dictamen Final y Autorizaciones Específicas por Fase](#9-dictamen-final-y-autorizaciones-específicas-por-fase)

---

## 1. PRESERVACIÓN DEL ENTORNO Y ESTADO VERIFICADO EN TIEMPO REAL

Se ejecutaron pruebas directas de inspección sobre el entorno activo, constatando que no se han introducido desviaciones:

* **Rama:** `B_JACOBO` (confirmada vía `git rev-parse --abbrev-ref HEAD`).
* **HEAD:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
* **Git Status:** Todos los cambios preexistentes se preservan íntegros. La rama docente `main` y la base institucional `sigd_prueba` permanecen 100% aisladas e intactas.
* **Infraestructura de Soporte (Docker):**
  - `sigd-postgres-1`: `127.0.0.1:5433->5432` (healthy, base `sigd_jacobo_demo`).
  - `sigd-redis-1`: `127.0.0.1:6379->6379` (healthy, DB 1).
  - `sigd-minio-1`: `127.0.0.1:9000/9001` (healthy, bucket `sigd-documentos`).
* **Procesos Locales en Ejecución:**
  - Backend Express: PID `27572` en `http://127.0.0.1:3008` (`/health` HTTP 200 UP).
  - Frontend Vite: PID `9240` en `http://127.0.0.1:5178` (`/` HTTP 200 OK).
* **Estado Actual de Tablas y Secuencias (Verificado en PostgreSQL 5433):**
  - `sigd_doc.tipo_tramite_tupa`: 22 registros (19 vigentes, 3 inactivos).
  - `sigd_doc.tipo_documento`: 2 tipos vigentes (`COMPROBANTE_PAGO` y `FUT`).
  - `sigd_tra.secuencia_anual_cut`: `ultimo_correlativo = 5` para `anio_fiscal = 2026`.
  - `sigd_tra.seq_asiento_numero_registro`: `last_value = 10004` (`is_called = true`).
  - Total de expedientes históricos en base: 5 (`EXP-2026-000001`, `000003`, `000004`, `000005`, `000142`).
  - Total de asientos en Libro General: 4 (asientos `10001` a `10004`).
* **Configuración Actual de los Cuatro Procedimientos Observados:**
  - `SUZ26-050` (Reincorporación): 0 requisitos configurados en `sigd_doc.requisito`.
  - `SUZ26-051` (Constancia Egresado): 0 requisitos configurados en `sigd_doc.requisito`.
  - `SUZ26-054` (Convalidación Planes): 0 requisitos configurados en `sigd_doc.requisito`.
  - `SUZ26-066` (Traslado Externo): 2 requisitos configurados (`COMPROBANTE_PAGO` y `FUT`), ambos con relación activa en `sigd_doc.tipo_documento_requisito`.

---

## 2. CONSOLIDACIÓN DE INFORMES Y ERRADICACIÓN DE INCONSISTENCIAS

Para evitar duplicaciones y contradicciones detectadas entre el diagnóstico inicial ([`INFORME_DIAGNOSTICO_MESA_DE_PARTES_FASE1.md`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/docs/INFORME_DIAGNOSTICO_MESA_DE_PARTES_FASE1.md)), el plan preliminar ([`PLAN_REMEDIACION_TUPA_FASE2A.md`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/docs/PLAN_REMEDIACION_TUPA_FASE2A.md)) y la revisión crítica ([`REVISION_CRITICA_REMEDIACION_TUPA.md`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/docs/REVISION_CRITICA_REMEDIACION_TUPA.md)), este informe consolida la verdad técnica bajo cuatro categorías estrictamente diferenciadas:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             ESTRUCTURA DE CERTEZA TÉCNICA                                      │
├───────────────────────────────┬────────────────────────────────────────────────────────────────┤
│ 1. HALLAZGOS CONFIRMADOS      │ Hechos técnicos demostrados empíricamente en código y base de  │
│    (Evidencia Objetiva)       │ datos. No admiten discusión fáctica.                           │
├───────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ 2. CAMBIOS PROPUESTOS         │ Modificaciones de datos y configuración planificadas para ser  │
│    (Pendientes de Ejecución)  │ aplicadas mediante script controlado.                          │
├───────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ 3. CAMBIOS EJECUTADOS         │ CERO (0). En esta fase no se ha insertado, modificado ni       │
│    (Estado Real en Base)      │ borrado ningún registro en la base de datos.                   │
├───────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ 4. DECISIONES PENDIENTES      │ Definiciones normativas y de gestión que corresponden a la     │
│    (Autoridad Institucional)  │ Dirección General y Secretaría Académica del IESTP Suiza.      │
└───────────────────────────────┴────────────────────────────────────────────────────────────────┘
```

### Corrección de Inconsistencias Documentales Previas:
1. **Inconsistencia de "TUPA Reparado":**  
   *Corrección:* No se debe catalogar ningún trámite como "reparado". La realidad es que 15 trámites cumplen la regla estática de admisibilidad unívoca, 3 trámites no tienen requisitos (`SUZ26-050`, `051`, `054`) y 1 trámite tiene ambigüedad documental (`SUZ26-066`).
2. **Inconsistencia sobre Pruebas E2E Aprobadas:**  
   *Corrección:* Se rectifica la matriz probatoria. Solo `SUZ26-035` (`EXP-2026-000005`) ha sido radicado de punta a punta. Los demás 14 trámites no han sido ejecutados en tiempo real; cuentan con estructura relacional admisible para ser procesados cuando se autorice.
3. **Inconsistencia de UUIDs Estáticos:**  
   *Corrección:* Se abandonan los UUIDs fijos propuestos en la Fase 2A. La propuesta DML resuelve dinámicamente las claves para erradicar cualquier riesgo de violación de claves foráneas.

---

## 3. ANÁLISIS RIGUROSO DE LA OBLIGATORIEDAD (SUSTANTIVA VS. INSTRUMENTAL VS. CÓDIGO)

Es mandatario disipar cualquier confusión entre el mandato legal de pago y la configuración técnica del software:

### 3.1. Las Tres Dimensiones de la Obligatoriedad

1. **Obligatoriedad Sustantiva Legal (Derecho de Tramitación TUPA):**  
   En los procedimientos `SUZ26-050` (S/ 300.00), `SUZ26-051` (S/ 31.00), `SUZ26-054` (S/ 46.50) y `SUZ26-066` (S/ 412.00), el pago en Tesorería es un **requisito de admisibilidad legal vinculante** bajo el TUO de la Ley N° 27444. La omisión del pago impide válidamente la emisión del pronunciamiento de fondo por la administración.
2. **Obligatoriedad Instrumental Digital (Mesa de Partes Virtual):**  
   Corresponde a la regla de interacción del canal digital: ¿debe el administrado adjuntar obligatoriamente el comprobante digital en el momento de radicar ex-ante, o se le permite radicar la petición y acreditar el pago con posterioridad mediante cruce de caja interno?
3. **Comportamiento en Runtime del Código Fuente:**  
   - En [`radicacionVirtual.service.ts:211-218`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/radicacionVirtual.service.ts#L211-L218), el servicio ejecuta:
     ```sql
     SELECT td.tipo_documental_id,
            bool_or(dr.condicion_json_pointer IS NOT NULL) AS requiere_condicion
       FROM sigd_doc.requisito r
       JOIN sigd_doc.tipo_documento_requisito dr ON dr.requisito_id = r.requisito_id
       JOIN sigd_doc.tipo_documento td ON td.tipo_documental_id = dr.tipo_documental_id
      WHERE r.tipo_tramite_id = $1::uuid AND td.vigente = TRUE
      GROUP BY td.tipo_documental_id
     ```
     **Evidencia objetiva:** El backend NO selecciona, no filtra ni condiciona la transacción sobre la columna `r.obligatorio`. Únicamente comprueba que exista exactamente un tipo documental asociado (`rows.length === 1`).
   - En [`StepDocumentos.tsx:373`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx#L373), el frontend consigna expresamente: *"La API disponible no informa los requisitos documentales ni su obligatoriedad..."*. El frontend solo exige subir 1 archivo PDF.

### 3.2. Justificación de la Convención en la Propuesta
* El esquema de BD define `obligatorio BOOLEAN NOT NULL DEFAULT TRUE` ([`04_sigd_doc.sql:137`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/04_sigd_doc.sql#L137)).
* La regla `RN-REQ-001` exige clasificar formalmente todo requisito.
* La carga original [`backend/carga_tupa_suiza_2026.sql:9`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/carga_tupa_suiza_2026.sql#L9) estableció `obligatorio = FALSE` como anotación documental informativa porque el folleto TUPA no empleaba la frase "adjuntar comprobante".
* **Decisión Institucional Pendiente:** La Dirección General debe definir formalmente si la acreditación digital del comprobante es obligatoria ex-ante (`obligatorio = TRUE`) o si se conserva como mención informativa sujeta a validación posterior (`obligatorio = FALSE`). Para fines del prototipo de software, ambos valores se comportan de manera idéntica.

---

## 4. ANÁLISIS Y TRATAMIENTO INSTITUCIONAL DEL FUT EN SUZ26-066

### 4.1. Qué se Captura y Persiste Realmente en el Asistente Web
Se inspeccionó exhaustivamente el código del asistente de radicación:
1. **Frontend:** [`TramiteWizard.tsx`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/components/tramite/TramiteWizard.tsx) captura datos de identidad en el Paso 1, procedimiento en el Paso 2, y en el Paso 3 captura únicamente:
   - `asunto`: texto de hasta 500 caracteres.
   - `fundamentacion`: texto descriptivo del petitorio.
   - `archivos`: 1 archivo binario cargado a MinIO vía URL prefirmada.
2. **Payload:** [`StepConfirmacion.tsx:248-257`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/components/tramite/WizardSteps/StepConfirmacion.tsx#L248-L257) envía a `/api/v1/tramites/radicacion-virtual` el objeto con `asunto`, identidad, folios y el array `documentos`.
3. **Persistencia:** [`radicacionVirtual.service.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/radicacionVirtual.service.ts#L402-L406) inserta en [`sigd_tra.asiento_registro`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/05_sigd_tra.sql#L368-L383) los campos: `expediente_id`, `fecha_ingreso`, `canal_ingreso = 'MESA_VIRTUAL'`, `asunto` y `remitente_id`.
4. **Constatación:** El sistema **no genera ningún documento PDF representativo del Formulario Único de Trámite (FUT)** ni almacena los campos estructurados del formato oficial (programa de estudios de procedencia, código de matrícula, semestre, turno, firma gráfica).
5. **Veredicto:** Afirmar que el asistente web "equivale al FUT" es una conjetura sin valor legal.

### 4.2. Opciones de Tratamiento Institucional para SUZ26-066

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        ALTERNATIVAS DE TRATAMIENTO INSTITUCIONAL PARA SUZ26-066                        │
├───────────────────────────────────┬───────────────────────────────────┬────────────────────────────────┤
│ OPCIÓN A: HOMOLOGACIÓN VIRTUAL    │ OPCIÓN B: FUT ESCANEADO CONJUNTO  │ OPCIÓN C: EVOLUCIÓN MULTI-FILE │
├───────────────────────────────────┼───────────────────────────────────┼────────────────────────────────┤
│ • La Dirección General aprueba    │ • La institución instruye al      │ • Se amplía el código de       │
│   resolución directoral que       │   estudiante a descargar el FUT,  │   radicacionVirtual.service.ts │
│   reconoce el registro web como   │   firmarlo, escanearlo y unirlo   │   para admitir varios archivos │
│   sustituto formal del FUT en     │   en un único PDF junto con el    │   separados (FUT + Comprobante)│
│   Mesa de Partes Virtual.         │   comprobante de arancel.         │   con clasificación individual.│
│ • Efecto: Se desvincula la        │ • Efecto: Se clasifica el PDF     │ • Efecto: Modificación de      │
│   relación FUT en la BD y se      │   único bajo el tipo que          │   código y arquitectura (fuera │
│   exige adjuntar el voucher.      │   determine la Dirección.         │   del alcance de la Fase 2B).  │
└───────────────────────────────────┴───────────────────────────────────┴────────────────────────────────┘
```

* **Tratamiento en la Propuesta SQL:**  
  En estricto cumplimiento de las instrucciones de auditoría, **NO se elimina automáticamente la relación de FUT**. El script propuesto incluye la Opción A como un bloque estrictamente condicionado (`v_aplicar_homologacion_fut_066 := FALSE`), preservando el estado de ambigüedad hasta que exista una decisión institucional expresa.

---

## 5. ESPECIFICACIÓN Y RUTA DEL SCRIPT SQL PROPUESTO

Se ha preparado un archivo independiente para revisión técnica, ubicado físicamente en:

📂 **Ruta física del archivo:**  
[`C:\Users\Liz\Desktop\SIGD\SIGD\scripts\propuesta_remediacion_tupa_fase2b.sql`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/scripts/propuesta_remediacion_tupa_fase2b.sql)

### Contenido Completo del Script para Revisión:

```sql
-- =============================================================================
-- SIGD IESTP SUIZA 2026 — PROPUESTA TÉCNICA DE REMEDIACIÓN DML FASE 2B
-- Archivo: scripts/propuesta_remediacion_tupa_fase2b.sql
-- Estado: PROPUESTA PARA REVISIÓN — NO EJECUTADA EN ESTA FASE
-- Objetivo: Configurar metadatos documentales para SUZ26-050, 051, 054
--           y preparar la alternativa institucional para SUZ26-066.
-- Base de datos objetivo: sigd_jacobo_demo (Puerto 5433)
-- =============================================================================

BEGIN;

-- 1. Límite de tiempo estricto para evitar bloqueos prolongados
SET LOCAL statement_timeout = '10s';

DO $remediacion_fase2b$
DECLARE
    v_db_actual text;
    v_tipo_doc_pago uuid;
    v_tipo_doc_fut uuid;
    
    -- UUIDs de los trámites TUPA
    v_tupa_050 uuid;
    v_tupa_051 uuid;
    v_tupa_054 uuid;
    v_tupa_066 uuid;
    
    -- UUIDs de requisitos (resueltos dinámicamente)
    v_req_050 uuid;
    v_req_051 uuid;
    v_req_054 uuid;
    v_req_066_fut uuid;
    
    -- Conteo de validación
    v_count integer;

    -- =========================================================================
    -- BANDERA DE DECISIÓN INSTITUCIONAL PARA SUZ26-066 (TRASLADO EXTERNO)
    -- Por defecto: FALSE. Preserva la relación de FUT intacta hasta contar con
    -- la aprobación formal de la Dirección (Opción A de homologación).
    -- Si se define TRUE: Desvincula la relación FUT en tipo_documento_requisito.
    -- =========================================================================
    v_aplicar_homologacion_fut_066 constant boolean := FALSE;

BEGIN
    -- -------------------------------------------------------------------------
    -- PASO 1: FRENO FAIL-SAFE DE BASE DE DATOS
    -- -------------------------------------------------------------------------
    SELECT current_database() INTO v_db_actual;
    IF v_db_actual <> 'sigd_jacobo_demo' THEN
        RAISE EXCEPTION 'FRENO DE SEGURIDAD ACTIVADO: La base conectada es "%", pero el destino obligatorio es "sigd_jacobo_demo". Transacción abortada.', v_db_actual
            USING ERRCODE = 'P0001';
    END IF;

    -- -------------------------------------------------------------------------
    -- PASO 2: COMPROBACIÓN DE PRECONDICIONES (TIPOS DOCUMENTALES CANÓNICOS)
    -- -------------------------------------------------------------------------
    SELECT tipo_documental_id INTO v_tipo_doc_pago 
      FROM sigd_doc.tipo_documento 
     WHERE codigo = 'COMPROBANTE_PAGO' AND vigente = TRUE;

    IF v_tipo_doc_pago IS NULL THEN
        RAISE EXCEPTION 'PRECONDICIÓN FALLIDA: No existe tipo documental COMPROBANTE_PAGO activo en sigd_doc.tipo_documento.'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT tipo_documental_id INTO v_tipo_doc_fut 
      FROM sigd_doc.tipo_documento 
     WHERE codigo = 'FUT' AND vigente = TRUE;

    IF v_tipo_doc_fut IS NULL THEN
        RAISE EXCEPTION 'PRECONDICIÓN FALLIDA: No existe tipo documental FUT activo en sigd_doc.tipo_documento.'
            USING ERRCODE = 'P0002';
    END IF;

    -- -------------------------------------------------------------------------
    -- PASO 3: COMPROBACIÓN DE PRECONDICIONES (TRÁMITES TUPA EN CATÁLOGO)
    -- -------------------------------------------------------------------------
    SELECT tipo_tramite_id INTO v_tupa_050 FROM sigd_doc.tipo_tramite_tupa WHERE codigo = 'SUZ26-050';
    SELECT tipo_tramite_id INTO v_tupa_051 FROM sigd_doc.tipo_tramite_tupa WHERE codigo = 'SUZ26-051';
    SELECT tipo_tramite_id INTO v_tupa_054 FROM sigd_doc.tipo_tramite_tupa WHERE codigo = 'SUZ26-054';
    SELECT tipo_tramite_id INTO v_tupa_066 FROM sigd_doc.tipo_tramite_tupa WHERE codigo = 'SUZ26-066';

    IF v_tupa_050 IS NULL OR v_tupa_051 IS NULL OR v_tupa_054 IS NULL OR v_tupa_066 IS NULL THEN
        RAISE EXCEPTION 'PRECONDICIÓN FALLIDA: Uno o más trámites (SUZ26-050, SUZ26-051, SUZ26-054, SUZ26-066) no existen en sigd_doc.tipo_tramite_tupa.'
            USING ERRCODE = 'P0003';
    END IF;

    -- -------------------------------------------------------------------------
    -- PASO 4: REMEDIACIÓN SUZ26-050 (Derecho de Reincorporación)
    -- -------------------------------------------------------------------------
    -- 4.1 Identificar o crear requisito
    SELECT requisito_id INTO v_req_050 
      FROM sigd_doc.requisito 
     WHERE tipo_tramite_id = v_tupa_050 AND codigo = 'COMPROBANTE_PAGO';

    IF v_req_050 IS NULL THEN
        INSERT INTO sigd_doc.requisito (
            requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden
        ) VALUES (
            gen_random_uuid(),
            v_tupa_050,
            'COMPROBANTE_PAGO',
            'Comprobante de Pago (mención documental; pago del derecho en Tesorería S/ 300.00)',
            FALSE,
            0
        ) RETURNING requisito_id INTO v_req_050;
    END IF;

    -- 4.2 Enlace documental (idempotente)
    INSERT INTO sigd_doc.tipo_documento_requisito (
        id_relacion, requisito_id, tipo_documental_id, condicion_json_pointer
    ) VALUES (
        gen_random_uuid(), v_req_050, v_tipo_doc_pago, NULL
    ) ON CONFLICT (requisito_id, tipo_documental_id) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- PASO 5: REMEDIACIÓN SUZ26-051 (Constancia de Egresado)
    -- -------------------------------------------------------------------------
    SELECT requisito_id INTO v_req_051 
      FROM sigd_doc.requisito 
     WHERE tipo_tramite_id = v_tupa_051 AND codigo = 'COMPROBANTE_PAGO';

    IF v_req_051 IS NULL THEN
        INSERT INTO sigd_doc.requisito (
            requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden
        ) VALUES (
            gen_random_uuid(),
            v_tupa_051,
            'COMPROBANTE_PAGO',
            'Comprobante de Pago (mención documental; pago del derecho en Tesorería S/ 31.00)',
            FALSE,
            0
        ) RETURNING requisito_id INTO v_req_051;
    END IF;

    INSERT INTO sigd_doc.tipo_documento_requisito (
        id_relacion, requisito_id, tipo_documental_id, condicion_json_pointer
    ) VALUES (
        gen_random_uuid(), v_req_051, v_tipo_doc_pago, NULL
    ) ON CONFLICT (requisito_id, tipo_documental_id) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- PASO 6: REMEDIACIÓN SUZ26-054 (Convalidación entre Planes de Estudios)
    -- -------------------------------------------------------------------------
    SELECT requisito_id INTO v_req_054 
      FROM sigd_doc.requisito 
     WHERE tipo_tramite_id = v_tupa_054 AND codigo = 'COMPROBANTE_PAGO';

    IF v_req_054 IS NULL THEN
        INSERT INTO sigd_doc.requisito (
            requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden
        ) VALUES (
            gen_random_uuid(),
            v_tupa_054,
            'COMPROBANTE_PAGO',
            'Comprobante de Pago (mención documental; pago del derecho en Tesorería S/ 46.50)',
            FALSE,
            0
        ) RETURNING requisito_id INTO v_req_054;
    END IF;

    INSERT INTO sigd_doc.tipo_documento_requisito (
        id_relacion, requisito_id, tipo_documental_id, condicion_json_pointer
    ) VALUES (
        gen_random_uuid(), v_req_054, v_tipo_doc_pago, NULL
    ) ON CONFLICT (requisito_id, tipo_documental_id) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- PASO 7: TRATAMIENTO CONDICIONAL DE SUZ26-066 (Traslado Externo)
    -- -------------------------------------------------------------------------
    IF v_aplicar_homologacion_fut_066 THEN
        -- Opción A autorizada: Se desvincula la relación del FUT para unificar adjunto a comprobante
        SELECT requisito_id INTO v_req_066_fut 
          FROM sigd_doc.requisito 
         WHERE tipo_tramite_id = v_tupa_066 AND codigo = 'FUT';

        IF v_req_066_fut IS NOT NULL THEN
            DELETE FROM sigd_doc.tipo_documento_requisito 
             WHERE requisito_id = v_req_066_fut AND tipo_documental_id = v_tipo_doc_fut;
            RAISE NOTICE 'SUZ26-066: Relación documental FUT desvinculada conforme a Opción A (homologación virtual).';
        END IF;
    ELSE
        -- Opción por defecto: Se preserva la relación de FUT intacta
        RAISE NOTICE 'SUZ26-066: Relación de FUT preservada. Se mantiene estado de ambigüedad a la espera de decisión institucional.';
    END IF;

    -- -------------------------------------------------------------------------
    -- PASO 8: VALIDACIONES POSTERIORES (ASSERTIONS EN TIEMPO DE EJECUCIÓN)
    -- -------------------------------------------------------------------------
    -- Verificar que SUZ26-050 tenga exactamente 1 tipo documental asociado
    SELECT COUNT(DISTINCT tdr.tipo_documental_id) INTO v_count
      FROM sigd_doc.requisito r
      JOIN sigd_doc.tipo_documento_requisito tdr ON tdr.requisito_id = r.requisito_id
     WHERE r.tipo_tramite_id = v_tupa_050;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'POST-VALIDACIÓN FALLIDA: SUZ26-050 quedó con % tipos asociados (se esperaba exactamente 1).', v_count;
    END IF;

    -- Verificar que SUZ26-051 tenga exactamente 1 tipo documental asociado
    SELECT COUNT(DISTINCT tdr.tipo_documental_id) INTO v_count
      FROM sigd_doc.requisito r
      JOIN sigd_doc.tipo_documento_requisito tdr ON tdr.requisito_id = r.requisito_id
     WHERE r.tipo_tramite_id = v_tupa_051;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'POST-VALIDACIÓN FALLIDA: SUZ26-051 quedó con % tipos asociados (se esperaba exactamente 1).', v_count;
    END IF;

    -- Verificar que SUZ26-054 tenga exactamente 1 tipo documental asociado
    SELECT COUNT(DISTINCT tdr.tipo_documental_id) INTO v_count
      FROM sigd_doc.requisito r
      JOIN sigd_doc.tipo_documento_requisito tdr ON tdr.requisito_id = r.requisito_id
     WHERE r.tipo_tramite_id = v_tupa_054;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'POST-VALIDACIÓN FALLIDA: SUZ26-054 quedó con % tipos asociados (se esperaba exactamente 1).', v_count;
    END IF;

    RAISE NOTICE 'PROPUESTA DML FASE 2B: Todas las precondiciones, operaciones y post-validaciones superadas satisfactoriamente.';
END $remediacion_fase2b$;

COMMIT;
```

---

## 6. TABLA DE PRECONDICIONES Y RESULTADOS ESPERADOS

| N° | Precondición Evaluada | Expresión SQL de Comprobación | Resultado Esperado | Acción si Falla |
|:---:|:---|:---|:---:|:---|
| **PRE-01** | Base de datos activa correcta | `SELECT current_database()` | `'sigd_jacobo_demo'` | Aborto inmediato (`RAISE EXCEPTION P0001`). Protege `sigd_prueba`. |
| **PRE-02** | Existencia de tipos documentales | `SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE codigo IN ('COMPROBANTE_PAGO', 'FUT')` | 2 UUIDs no nulos | Aborto (`P0002`). Evita registrar referencias huérfanas. |
| **PRE-03** | Existencia de trámites TUPA | `SELECT tipo_tramite_id FROM sigd_doc.tipo_tramite_tupa WHERE codigo IN ('SUZ26-050', '051', '054', '066')` | 4 UUIDs no nulos | Aborto (`P0003`). Previene fallos por claves foráneas inexistentes. |
| **POST-01** | Clasificación unívoca `SUZ26-050` | `COUNT(DISTINCT tipo_documental_id) WHERE tramite = 'SUZ26-050'` | 1 (`COMPROBANTE_PAGO`) | Rollback automático de la transacción completa. |
| **POST-02** | Clasificación unívoca `SUZ26-051` | `COUNT(DISTINCT tipo_documental_id) WHERE tramite = 'SUZ26-051'` | 1 (`COMPROBANTE_PAGO`) | Rollback automático de la transacción completa. |
| **POST-03** | Clasificación unívoca `SUZ26-054` | `COUNT(DISTINCT tipo_documental_id) WHERE tramite = 'SUZ26-054'` | 1 (`COMPROBANTE_PAGO`) | Rollback automático de la transacción completa. |
| **POST-04** | Idempotencia ante 2da ejecución | Re-ejecutar el bloque completo sobre la base | `0 filas duplicadas, 0 errores` | La transacción concluye con éxito idéntico. |

---

## 7. MATRIZ INTEGRAL DE RIESGOS Y DECISIONES PENDIENTES

| ID | Riesgo Identificado | Probabilidad / Impacto | Mitigación Arquitectónica Incorporada | Decisión Pendiente | Responsable |
|:---:|:---|:---:|:---|:---|:---:|
| **RSK-01** | **Contaminación de la base docente `sigd_prueba`** | Baja / Crítico | Freno fail-safe en el encabezado del script (`IF current_database() <> 'sigd_jacobo_demo'`). | Ninguna (mitigado en código). | Arquitecto de Software |
| **RSK-02** | **Conflicto de Claves Foráneas por UUID preexistente** | Media / Alto | Resolución dinámica de claves (`SELECT requisito_id INTO v_req`). Reutiliza registros si ya existen. | Ninguna (mitigado en código). | Especialista PostgreSQL |
| **RSK-03** | **Cuestionamiento legal sobre la validez del FUT en `SUZ26-066`** | Media / Alto | El DML no desvincula el FUT de forma automática. Se requiere resolución explícita para activar la bandera. | Elegir formalmente entre Opción A (Homologación) u Opción B (PDF Conjunto). | Dirección General / Secretaría Académica |
| **RSK-04** | **Reclamo de administrados por cobro de tasa con `obligatorio = FALSE`** | Baja / Medio | Documentar en la guía del usuario que la tasa es legalmente vinculante conforme al TUPA. | Definir directiva sobre exigencia de adjunto digital ex-ante. | Dirección General |
| **RSK-05** | **Imposibilidad de borrar físicamente el expediente de prueba E2E** | Alta / Medio | El trigger `trg_asiento_inmutable` rechaza `DELETE`. El expediente se mantendrá como registro de homologación o se anulará lógicamente (`anulado = TRUE`). | Autorizar el avance del correlativo oficial 5 a 6 en la base de demo. | Usuario / Docente Evaluador |

---

## 8. PLAN DE PRUEBAS E2E CONTROLADO (DISEÑO SIN EJECUCIÓN)

Una vez autorizado el DML para la fase de implementación, se ejecutará una validación integral de radicación virtual para comprobar el ciclo completo:

### 8.1. Parámetros de la Prueba E2E
* **Identidad de Demostración:** `ciudadano.demo` (DNI: `00000050`, email: `ciudadano.demo@iestpsuiza.edu.pe`).
* **Trámite Seleccionado:** `SUZ26-050` (Derecho de Reincorporación).
* **Documento Adjunto:** Archivo PDF sintético con magic bytes `%PDF-1.4`, tamaño ~100 KB, hash SHA-256 precalculado.
* **Canal:** `POST /api/v1/tramites/radicacion-virtual`.

### 8.2. Verificación Dinámica de CUT y Control de Concurrencia
- **Prohibido asumir `EXP-2026-000006`:** El script de prueba capturará la respuesta JSON del servidor y validará mediante expresión regular:
  ```typescript
  const cutRecibido = response.body.cut;
  expect(cutRecibido).toMatch(/^EXP-2026-\d{6}$/);
  ```
- Se consultará la base para contrastar que el CUT corresponda exactamente a `ultimo_correlativo` de `sigd_tra.secuencia_anual_cut`.

### 8.3. Inventario Exhaustivo de Registros Persistentes Generados
La ejecución creará en el sistema:
1. `sigd_doc.expediente`: 1 fila (metadatos documentales).
2. `sigd_tra.expediente`: 1 fila (metadatos tramitológicos).
3. `sigd_tra.tramite`: 1 fila (asunto y descripción).
4. `sigd_doc.documento_adjunto`: 1 fila (hash SHA-256, peso y S3 key).
5. `sigd_tra.expediente_documento_folio`: 1 fila (foliación inicial y final).
6. `sigd_tra.asiento_registro`: 1 fila (asiento inmutable en Libro General).
7. MinIO: 1 objeto en `sigd-documentos/expedientes/2026/<uuid>.pdf`.
8. Secuencia CUT: `ultimo_correlativo` incrementará de 5 a 6.
9. Secuencia Asiento: `nextval('sigd_tra.seq_asiento_numero_registro')` pasará de 10004 a 10005.

### 8.4. Verificación de Consulta Pública y Protección de Datos
Se ejecutará `GET /api/v1/tramites/consulta-publica/{cut}` verificando:
- HTTP status: `200 OK`.
- Enmascaramiento de datos personales bajo la Ley N° 29733 (DNI visible solo primeros/últimos dígitos; nombres con máscara).
- Visualización del estado: `REGISTRADO`.

### 8.5. Procedimiento de Recuperación y Anulación Lógica
- Debido a la regla institucional de inmutabilidad ([`05_sigd_tra.sql:391`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/05_sigd_tra.sql#L391)), si el usuario solicita retirar el expediente de prueba después de la validación, **no se debe ejecutar `DELETE`**.
- El mecanismo formal de anulación admitido por el sistema es:
  ```sql
  UPDATE sigd_tra.asiento_registro
     SET anulado = TRUE,
         motivo_anulacion = 'Expediente de prueba de homologación E2E - Fase 2B'
   WHERE expediente_id = 'UUID_DEL_EXPEDIENTE';
  ```
  Al anularse el asiento, el backend (`consultaPublica.service.ts:95-101`) automáticamente responde `404 Not Found` en la consulta pública y lo excluye de las bandejas operativas de RutaDoc.

---

## 9. DICTAMEN FINAL Y AUTORIZACIONES ESPECÍFICAS POR FASE

### **DICTAMEN TÉCNICO: APTO CON CONDICIONES**

#### Fundamento del Dictamen:
1. La propuesta técnica resuelve de forma definitiva las inconsistencias de los trámites `SUZ26-050`, `SUZ26-051` y `SUZ26-054` sin modificar una sola línea de código fuente ni alterar esquemas o contenedores.
2. La propuesta DML es matemáticamente idempotente, resuelve dinámicamente sus dependencias y cuenta con freno fail-safe para garantizar la preservación absoluta de `sigd_prueba`.
3. El trámite `SUZ26-066` queda técnicamente preparado para ser desambiguado en el momento en que se apruebe la Opción A de homologación institucional.

---

### Autorizaciones Requeridas para Proceder:

Para iniciar la ejecución controlada en una siguiente sesión, se requerirá emitir las siguientes autorizaciones:

1. **Autorización Fase 2B.1 (DML sobre Trámites con Arancel Omitido):**  
   Autorización para ejecutar `scripts/propuesta_remediacion_tupa_fase2b.sql` (con `v_aplicar_homologacion_fut_066 := FALSE`) para habilitar `SUZ26-050`, `SUZ26-051` y `SUZ26-054`.
2. **Autorización Fase 2B.2 (Decisión Institucional para SUZ26-066):**  
   Definición formal de la Dirección General sobre si se aprueba la Opción A (homologación del formulario web como sustituto del FUT) para proceder a su desambiguación.
3. **Autorización Fase 2B.3 (Ejecución de Prueba E2E y Consumo de Correlativo):**  
   Autorización expresa para emitir el expediente de homologación (correlativo 6) en la base de demostración con el usuario `ciudadano.demo`.

---

> [!NOTE]
> **DECLARACIÓN DE NO EJECUCIÓN (ZERO-WRITE AUDIT):**  
> Se deja constancia expresa de que en esta fase de trabajo **NO se ha ejecutado ninguna operación de escritura (CERO DDL, CERO DML)** en la base de datos PostgreSQL, no se ha consumido ningún correlativo de secuencias, no se ha modificado código TypeScript ni configuraciones de infraestructura. La propuesta queda completamente preparada y lista para revisión.

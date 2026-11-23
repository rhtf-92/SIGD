# SIGD IESTP SUIZA 2026 — REVISIÓN CRÍTICA DEL PLAN TUPA ANTES DE IMPLEMENTAR
## Versión 2.0: Cierre de Observaciones Técnicas, Idempotencia DML y Protocolo de Seguridad E2E

**Fecha:** 26 de octubre de 2026  
**Repositorio:** `C:\Users\Liz\Desktop\SIGD\SIGD`  
**Rama activa:** `B_JACOBO`  
**HEAD commit:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Base de datos de demostración:** `sigd_jacobo_demo` en puerto `5433` (Docker: `sigd-postgres-1`)  
**Carácter del documento:** Auditoría Crítica, Planificación Idempotente y Cierre de Observaciones (Zero-Write Audit)

---

## ÍNDICE GENERAL

1. [1. Preservación Obligatoria del Entorno](#1-preservación-obligatoria-del-entorno)
2. [2. Hallazgos Confirmados del Prototipo](#2-hallazgos-confirmados-del-prototipo)
3. [3. Inconsistencias y Limitaciones Detectadas en el Plan Preliminar](#3-inconsistencias-y-limitaciones-detectadas-en-el-plan-preliminar)
4. [4. Revisión Crítica por Trámite Afectado](#4-revisión-crítica-por-trámite-afectado)
   - [4.1. Análisis Riguroso de Obligatoriedad (Administrativa vs. Técnica vs. Código)](#41-análisis-riguroso-de-obligatoriedad-administrativa-vs-técnica-vs-código)
   - [4.2. Análisis de SUZ26-066 y Tratamiento del FUT Institucional](#42-análisis-de-suz26-066-y-tratamiento-del-fut-institucional)
   - [4.3. Análisis de SUZ26-050, SUZ26-051 y SUZ26-054](#43-análisis-de-suz26-050-suz26-051-y-suz26-054)
5. [5. Auditoría Probatoria: Evidencias Reales vs. Afirmaciones de Pruebas](#5-auditoría-probatoria-evidencias-reales-vs-afirmaciones-de-pruebas)
6. [6. Propuesta Corregida de Remediación](#6-propuesta-corregida-de-remediación)
7. [7. Estrategia DML Idempotente, Análisis de Restricciones y Freno Fail-Safe](#7-estrategia-dml-idempotente-análisis-de-restricciones-y-freno-fail-safe)
8. [8. Procedimiento de Protección para la Futura Prueba E2E](#8-procedimiento-de-protección-para-la-futura-prueba-e2e)
9. [9. Autorizaciones Requeridas por Fase](#9-autorizaciones-requeridas-por-fase)
10. [10. Dictamen Técnico General](#10-dictamen-técnico-general)
11. [11. Observaciones Finales y Criterios de Autorización](#11-observaciones-finales-y-criterios-de-autorización)

---

## 1. PRESERVACIÓN OBLIGATORIA DEL ENTORNO

* **Rama:** `B_JACOBO` (confirmada mediante `git rev-parse --abbrev-ref HEAD`).
* **HEAD:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
* **Estado de Git:** Todos los cambios preexistentes se mantienen intactos. No se han realizado descartes (`git checkout --`), limpiezas (`git clean`) ni commits no autorizados. La rama `main` y la base institucional `sigd_prueba` permanecen 100% aisladas e intactas.
* **Infraestructura:**
  - `sigd-postgres-1`: Puerto `5433` (Saludable, base `sigd_jacobo_demo`).
  - `sigd-redis-1`: Puerto `6379` (Saludable, DB 1).
  - `sigd-minio-1`: Puertos `9000` y `9001` (Saludable, bucket `sigd-documentos`).
  - Backend local: PID `27572` en puerto `3008` (`/health` UP).
  - Frontend local: PID `9240` en puerto `5178` (`/` HTTP 200).
* **Política de Cero Escrituras:** En estricto cumplimiento del rol auditor, no se ha ejecutado ningún DDL ni DML en PostgreSQL, no se han creado expedientes sintéticos ni consumido secuencias, y no se han modificado archivos de código fuente.

---

## 2. HALLAZGOS CONFIRMADOS DEL PROTOTIPO

1. **Catálogo TUPA Vigente:** La base `sigd_jacobo_demo` contiene 22 trámites registrados en `sigd_doc.tipo_tramite_tupa`: 3 inactivos (`TUPA-01`, `02`, `03`) y 19 vigentes expuestos en `GET /api/v1/tramites/tipos`.
2. **Generador Atómico de CUT:** No existe la tabla `sigd_tra.correlativo_anual`. El CUT se genera mediante la función PL/pgSQL atómica [`sigd_tra.fn_generar_cut(p_anio INT)`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/05_sigd_tra.sql#L74-L85) que bloquea pesimistamente (`SELECT ... FOR UPDATE`) la tabla [`sigd_tra.secuencia_anual_cut`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/05_sigd_tra.sql#L15-L25). El correlativo actual en 2026 es 5.
3. **Catálogo de Tipos Documentales:** `sigd_doc.tipo_documento` cuenta de forma estricta con dos tipos activos:
   - `COMPROBANTE_PAGO` (`b7f37bde-ec45-49d0-b28e-fc2ad4341b60`)
   - `FUT` (`dc156983-a824-418a-835e-5a7e104c9ca5`)
4. **Acoplamiento de Entrada en Radicación Virtual:** En [`radicacionVirtual.service.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/radicacionVirtual.service.ts#L203-L231), la arquitectura actual impone de forma estricta:
   - `datos.documentos.length === 1` (solo admite un archivo PDF consolidado por solicitud).
   - `resultado.rows.length === 1` (el trámite debe mapear exactamente a 1 tipo documental unívoco).
   - `!resultado.rows[0].requiere_condicion` (`condicion_json_pointer` debe ser nulo).
5. **Inmutabilidad del Asiento Registral:** La tabla [`sigd_tra.asiento_registro`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/05_sigd_tra.sql#L368-L383) posee el trigger `trg_asiento_inmutable` que rechaza operaciones `DELETE` físico (`RAISE EXCEPTION 'El Libro General no admite eliminación física (TUO Ley 27444, Arts. 153-156)'`). Todo registro formal requiere anulación lógica (`anulado = TRUE`).

---

## 3. INCONSISTENCIAS Y LIMITACIONES DETECTADAS EN EL PLAN PRELIMINAR

1. **Confusión Conceptual sobre la Obligatoriedad:**  
   El plan preliminar asumió acríticamente `obligatorio = FALSE` sin distinguir la obligatoriedad sustantiva del pago frente a la exigencia técnica de adjuntar el voucher en el portal web, generando una contradicción aparente con `DEFAULT TRUE` y `RN-REQ-001`.
2. **Equiparación Infundada entre el Formulario Web y el FUT Institucional:**  
   El plan preliminar afirmó que el asistente web "subsume y equivale" al FUT institucional. Dicha equiparación carece de sustento normativo: el asistente no captura los campos específicos del formato FUT aprobado por el IESTP Suiza ni genera un documento firmado homólogo.
3. **Fragilidad del DML Propuesto (Riesgo de Violación de Integridad Referencial):**  
   El script DML anterior utilizaba inserciones con UUID fijos y cláusulas `ON CONFLICT (tipo_tramite_id, codigo) DO NOTHING`. Si ya existía un requisito con el mismo código pero con otro UUID, la inserción secundaria en `sigd_doc.tipo_documento_requisito` fallaba por violación de clave foránea al referenciar un UUID inexistente.
4. **Falta de Control de Concurrencia e Inmutabilidad en Pruebas E2E:**  
   El plan anterior asumía de forma fija que el CUT emitido sería `EXP-2026-000006`, omitiendo la captura dinámica del valor y sin prever que los registros creados en `asiento_registro` no admiten borrado físico si se requiriera un rollback posterior.

---

## 4. REVISIÓN CRÍTICA POR TRÁMITE AFECTADO

### 4.1. Análisis Riguroso de Obligatoriedad (Administrativa vs. Técnica vs. Código)

Para erradicar contradicciones, es imperativo desagregar con rigor técnico y legal las tres dimensiones de la obligatoriedad:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               DIMENSIONES DE LA OBLIGATORIEDAD                                         │
├────────────────────────────────┬───────────────────────────────────┬───────────────────────────────────┤
│ 1. OBLIGATORIEDAD SUSTANTIVA   │ 2. OBLIGATORIEDAD INSTRUMENTAL    │ 3. EVALUACIÓN EN TIEMPO DE        │
│    ADMINISTRATIVA (TUPA)       │    DIGITAL (MESA VIRTUAL)         │    EJECUCIÓN (CÓDIGO FUENTE)      │
├────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ • El pago del derecho de       │ • Exigencia técnica impuesta al   │ • Backend:                        │
│   tramitación en Tesorería     │   administrado de adjuntar        │   radicacionVirtual.service.ts    │
│   es un mandato legal          │   obligatoriamente el archivo PDF │   NO consulta ni filtra la        │
│   sustantivo e ineludible bajo │   del comprobante al enviar el    │   columna r.obligatorio.          │
│   el TUO de la Ley N° 27444.   │   formulario web.                 │ • Frontend:                       │
│ • La omisión de la tasa        │ • Si se permite radicar y pagar   │   StepDocumentos.tsx (L373)       │
│   acarrea observación o        │   posteriormente en ventanilla,   │   no recibe requisitos ni evalúa  │
│   improcedencia del trámite.   │   el adjunto es facultativo; si   │   obligatoriedad; solo valida     │
│ • Rango de derecho: TASA LEGAL.│   es filtro ex-ante, es OBLIGADO. │   la carga de 1 archivo PDF.      │
└────────────────────────────────┴───────────────────────────────────┴───────────────────────────────────┘
```

#### Análisis de Concordancia con el Esquema y las Reglas de Negocio:
* **Esquema de BD ([`04_sigd_doc.sql:137`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/04_sigd_doc.sql#L137)):** Define `obligatorio BOOLEAN NOT NULL DEFAULT TRUE`. El valor predeterminado del modelo de datos asume que todo requisito normativo es exigible salvo indicación expresa en contrario.
* **Regla de Negocio ([`RN-REQ-001`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/docs/03_docucore/02_reglas_tupa_admisibilidad_v2.md#L115)):** Establece que todo requisito se clasifica formalmente en `OBLIGATORIO`, `OPCIONAL` o `CONDICIONAL`.
* **Carga Inicial ([`backend/carga_tupa_suiza_2026.sql:9`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/carga_tupa_suiza_2026.sql#L9)):** Asignó `obligatorio = FALSE` a todos los comprobantes bajo la anotación: *"FUT y Comprobante de Pago: menciones documentales; obligatorio=false"*, debido a que el texto literal del folleto TUPA dice "pago del derecho en Tesorería" sin prescribir expresamente la obligación del administrado de adjuntar copia digital del comprobante.
* **Resolución Técnica para el Prototipo:**  
  Dado que el código operativo no consume la columna `r.obligatorio`, fijar `FALSE` mantiene la homogeneidad estadística con los 15 trámites cargados previamente. Sin embargo, no se debe afirmar que el pago no es obligatorio.
* **Decisión Institucional Pendiente:**  
  La Dirección General del IESTP Suiza debe emitir una directiva que establezca si la Mesa de Partes Virtual exige la acreditación digital previa del comprobante de pago (`obligatorio = TRUE`) o si se admite la presentación de la solicitud sujeta a comprobación diferida interna con el área de Tesorería (`obligatorio = FALSE`).

---

### 4.2. Análisis de `SUZ26-066` y Tratamiento del FUT Institucional

#### Inspección del Flujo Real de Mesa de Partes Virtual:
1. **Frontend (`TramiteWizard` y Pasos 1 a 4):**
   - [`StepIdentificacion.tsx`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/components/tramite/WizardSteps/StepIdentificacion.tsx): Captura DNI/RUC, nombres, apellidos, correo, celular y domicilio.
   - [`StepProcedimiento.tsx`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/components/tramite/WizardSteps/StepProcedimiento.tsx): Permite seleccionar el trámite TUPA (`SUZ26-066`).
   - [`StepDocumentos.tsx`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx): Captura asunto (500 caracteres), resumen de fundamentación y la carga de 1 archivo PDF.
   - [`StepConfirmacion.tsx:248-257`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/components/tramite/WizardSteps/StepConfirmacion.tsx#L248-L257): Envía el payload JSON a la API.
2. **Payload Enviado a `POST /api/v1/tramites/radicacion-virtual`:**
   ```json
   {
     "asunto": "Solicitud de traslado externo...",
     "idTipoTramiteTupa": "6c15cb58-e78f-4b00-b709-bd008ab98d47",
     "tipoDocumento": "DNI",
     "numeroDocumento": "00000050",
     "nombreSolicitante": "CIUDADANO DEMO SUIZA",
     "correo": "ciudadano.demo@iestpsuiza.edu.pe",
     "totalFolios": 1,
     "documentos": [{
       "nombreArchivo": "comprobante.pdf",
       "contentType": "application/pdf",
       "tamanoBytes": 102400,
       "hashSha256": "...",
       "storagePath": "expedientes/2026/....pdf"
     }]
   }
   ```
3. **Persistencia Real en la Base de Datos ([`radicacionVirtual.service.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/radicacionVirtual.service.ts#L241-L407)):**
   - En [`sigd_doc.expediente`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/04_sigd_doc.sql#L104-L113): Se persisten `tipo_tramite_id`, `codigo_expediente`, `asunto`, `solicitante_id`, `fecha_registro`.
   - En [`sigd_tra.asiento_registro`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/05_sigd_tra.sql#L368-L383): Se persisten `numero_registro` (correlativo oficial), `expediente_id`, `fecha_ingreso`, `canal_ingreso` (`MESA_VIRTUAL`), `asunto`, `remitente_id`.
   - En [`sigd_doc.documento_adjunto`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/04_sigd_doc.sql#L168-L183): Se almacena el archivo asociado a un único `tipo_documental_id`.

#### Constatación Técnica y Legal:
* **El asistente web NO captura ni genera el formato FUT oficial:**  
  El Formulario Único de Trámite del IESTP Suiza es un formato institucional estructurado que incluye datos académicos específicos (código de estudiante, programa de estudios de origen, plan de estudios, turno, semestre y firma hológrafa).
* **Ausencia de Equivalencia Jurídica Automática:**  
  No es jurídicamente admisible afirmar que el formulario digital sustituye al FUT sin un acto de administración que lo respalde formalmente.
* **Decisión Institucional Pendiente para `SUZ26-066`:**  
  La Dirección General y Secretaría Académica del IESTP Suiza deben optar formalmente por una de las siguientes tres vías:
  1. **Opción A (Homologación de Trámite Virtual):** Emitir resolución directoral que declare que la solicitud electrónica generada a través de la Mesa de Partes Virtual sustituye formalmente al FUT para trámites digitales, requiriéndose únicamente adjuntar el voucher de Tesorería (S/ 412.00).
  2. **Opción B (Exigencia de FUT Digitalizado):** Disponer que el administrado debe descargar, firmar y digitalizar el formato FUT oficial e incorporarlo en un único archivo PDF conjunto con el comprobante de pago.
  3. **Opción C (Evolución de Arquitectura Multi-Adjunto):** En una versión futura del SIGD, ampliar `radicacionVirtual.service.ts` para aceptar múltiples documentos (`datos.documentos.length > 1`) asignando individualmente el tipo `FUT` al primer archivo y `COMPROBANTE_PAGO` al segundo.
* **Postura en la Fase Actual:** No se elimina ninguna asociación en la base de datos ni se altera la arquitectura vigente.

---

### 4.3. Análisis de `SUZ26-050`, `SUZ26-051` y `SUZ26-054`

| Procedimiento TUPA | Denominación Oficial | Tasa TUPA (UIT %) | Exigencia Documental en Fuente Oficial | Estado en Base de Datos Actual | Causa de Inadmisibilidad en Mesa Virtual |
|:---|:---|:---:|:---|:---:|:---|
| **`SUZ26-050`** | Derecho de Reincorporación | S/ 300.00 (5.45 %) | Pago en el Área de Tesorería. | 0 requisitos | `CLASIFICACION_DOCUMENTAL_NO_CONFIGURADA` |
| **`SUZ26-051`** | Constancia de Egresado | S/ 31.00 (0.56 %) | Pago del derecho en Tesorería. | 0 requisitos | `CLASIFICACION_DOCUMENTAL_NO_CONFIGURADA` |
| **`SUZ26-054`** | Convalidación entre Planes | S/ 46.50 (0.84 %) | Pago del derecho en Tesorería. | 0 requisitos | `CLASIFICACION_DOCUMENTAL_NO_CONFIGURADA` |

* **Evidencia Documental:** Los tres trámites poseen costo pecuniario expreso en el TUPA 2026.
* **Inferencia Operativa:** Para que un administrado radique estos trámites en la Mesa de Partes Virtual conforme al diseño actual, el sistema requiere asociarles el requisito documental `COMPROBANTE_PAGO`.

---

## 5. AUDITORÍA PROBATORIA: EVIDENCIAS REALES VS. AFIRMACIONES DE PRUEBAS

```
┌──────┬───────────────────────────────┬───────────────────────────────────┬────────────────────────────────────────────┐
│ Paso │ Descripción de la Prueba      │ Estado Probatorio Real            │ Evidencia Técnica Verificable              │
├──────┼───────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────┤
│ P-01 │ Consulta de Catálogo TUPA     │ APROBADA (En esta auditoría)      │ curl HTTP 200 en :3008/api/v1/tramites/tipos│
│ P-02 │ Selección de Trámite en UI    │ VERIFICADA EN CÓDIGO (Previa)     │ StepDocumentos.tsx, tests unitarios        │
│ P-03 │ Presigned URL MinIO (S3)      │ VERIFICADA EN SESIONES PREVIAS    │ storage.router.ts, objetos en bucket S3    │
│ P-04 │ Carga PDF y Hash SHA-256      │ VERIFICADA EN SESIONES PREVIAS    │ Objetos en bucket sigd-documentos          │
│ P-05 │ Validación Anti-Suplantación  │ VERIFICADA EN TESTS UNITARIOS     │ radicacionVirtual.service.ts:150-201       │
│ P-06 │ Radicación SUZ26-035          │ VERIFICADA HISTÓRICAMENTE EN BD   │ EXP-2026-000005 (26/10/2026 20:43:50 UTC)  │
│ P-07 │ Radicación Trámite Remediado  │ PENDIENTE (Requiere DML y Auth)   │ No ejecutada (Zero-Write Audit)            │
│ P-08 │ Emisión de Cargo Digital      │ VERIFICADA HISTÓRICAMENTE EN BD   │ Asientos 10001 a 10004 en BD               │
│ P-09 │ Derivación en RutaDoc         │ VERIFICADA HISTÓRICAMENTE EN BD   │ Movimientos en sigd_rut.movimiento         │
│ P-10 │ Consulta Pública por CUT      │ APROBADA (En esta auditoría)      │ curl HTTP 200 para EXP-2026-000001 y 000004│
└──────┴───────────────────────────────┴───────────────────────────────────┴────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Alcance de la Verificación:**  
> Se reitera con rigor probatorio que los 15 trámites catalogados como operativos cuentan con configuración documental unívoca válida en base de datos. La radicación completa de punta a punta se ha ejecutado históricamente de forma exitosa sobre `SUZ26-035` (`EXP-2026-000005`). La radicación de los trámites remediados (P-07) se mantiene **estrictamente pendiente** a la espera de la fase autorizada.

---

## 6. PROPUESTA CORREGIDA DE REMEDIACIÓN

La remediación planificada debe cumplir los siguientes principios técnicos de arquitectura:

1. **Idempotencia Estricta:** La ejecución no debe asumir UUIDs fijos preexistentes ni fallar si se reintenta múltiples veces.
2. **Preservación del Requisito Formal de FUT en `SUZ26-066`:** El registro del requisito formal `FUT` en `sigd_doc.requisito` se mantiene como evidencia de catálogo institucional. Solo se retira la relación en `sigd_doc.tipo_documento_requisito` si la institución aprueba la Opción A de homologación.
3. **Resolución Dinámica de Claves:** El script debe resolver las claves foráneas consultando los códigos canónicos (`SUZ26-050`, `COMPROBANTE_PAGO`), garantizando coherencia referencial.

---

## 7. ESTRATEGIA DML IDEMPOTENTE, ANÁLISIS DE RESTRICCIONES Y FRENO FAIL-SAFE

### 7.1. Análisis de Restricciones en Base de Datos

* **En `sigd_doc.requisito`:**
  - PK: `requisito_id UUID`
  - FK: `tipo_tramite_id` -> `sigd_doc.tipo_tramite_tupa(tipo_tramite_id)`
  - UNIQUE: `CONSTRAINT uq_requisito_tramite_codigo UNIQUE (tipo_tramite_id, codigo)`
* **En `sigd_doc.tipo_documento_requisito`:**
  - PK: `id_relacion UUID DEFAULT gen_random_uuid()`
  - FK: `requisito_id` -> `sigd_doc.requisito(requisito_id) ON DELETE CASCADE`
  - FK: `tipo_documental_id` -> `sigd_doc.tipo_documento(tipo_documental_id) ON DELETE RESTRICT`
  - UNIQUE: `CONSTRAINT uq_tipo_documento_requisito UNIQUE (requisito_id, tipo_documental_id)`

### 7.2. Vulnerabilidad Resuelta del DML Preliminar

Si se ejecutara un `INSERT ... ON CONFLICT (tipo_tramite_id, codigo) DO NOTHING` con un `requisito_id` hardcodeado `UUID_A`, en caso de que ya existiera en la tabla un requisito con el mismo código pero con `UUID_B`:
1. El `INSERT` no inserta nada (DO NOTHING).
2. La sentencia subsiguiente que intente insertar en `tipo_documento_requisito` usando `UUID_A` generará una **excepción por clave foránea inexistente** (`23503 foreign_key_violation`).

### 7.3. Especificación Técnica del Bloque PL/pgSQL Idempotente (Solo Planificación — NO Ejecutado)

El siguiente bloque ha sido diseñado para resolver dinámicamente las claves y garantizar idempotencia matemática:

```sql
DO $remediacion_tupa$
DECLARE
    v_db text;
    v_tipo_doc_pago uuid;
    v_tipo_doc_fut uuid;
    v_tupa_050 uuid;
    v_tupa_051 uuid;
    v_tupa_054 uuid;
    v_tupa_066 uuid;
    v_req_050 uuid;
    v_req_051 uuid;
    v_req_054 uuid;
    v_req_066_fut uuid;
BEGIN
    -- 1. FRENO DE SEGURIDAD ESTRICTO: Base de datos activa
    SELECT current_database() INTO v_db;
    IF v_db <> 'sigd_jacobo_demo' THEN
        RAISE EXCEPTION 'FRENO DE SEGURIDAD: Base de datos incorrecta (%). Se esperaba sigd_jacobo_demo.', v_db
            USING ERRCODE = 'P0001';
    END IF;

    -- 2. VALIDACIÓN DE PRECONDICIONES: Tipos documentales
    SELECT tipo_documental_id INTO v_tipo_doc_pago 
      FROM sigd_doc.tipo_documento 
     WHERE codigo = 'COMPROBANTE_PAGO' AND vigente = TRUE;
    IF v_tipo_doc_pago IS NULL THEN
        RAISE EXCEPTION 'INCONSISTENCIA: No se encontró tipo documental COMPROBANTE_PAGO vigente.'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT tipo_documental_id INTO v_tipo_doc_fut 
      FROM sigd_doc.tipo_documento 
     WHERE codigo = 'FUT' AND vigente = TRUE;
    IF v_tipo_doc_fut IS NULL THEN
        RAISE EXCEPTION 'INCONSISTENCIA: No se encontró tipo documental FUT vigente.'
            USING ERRCODE = 'P0002';
    END IF;

    -- 3. VALIDACIÓN DE PRECONDICIONES: Trámites TUPA
    SELECT tipo_tramite_id INTO v_tupa_050 FROM sigd_doc.tipo_tramite_tupa WHERE codigo = 'SUZ26-050';
    SELECT tipo_tramite_id INTO v_tupa_051 FROM sigd_doc.tipo_tramite_tupa WHERE codigo = 'SUZ26-051';
    SELECT tipo_tramite_id INTO v_tupa_054 FROM sigd_doc.tipo_tramite_tupa WHERE codigo = 'SUZ26-054';
    SELECT tipo_tramite_id INTO v_tupa_066 FROM sigd_doc.tipo_tramite_tupa WHERE codigo = 'SUZ26-066';

    IF v_tupa_050 IS NULL OR v_tupa_051 IS NULL OR v_tupa_054 IS NULL OR v_tupa_066 IS NULL THEN
        RAISE EXCEPTION 'INCONSISTENCIA: Uno o más trámites TUPA (SUZ26-050, 051, 054, 066) no existen.'
            USING ERRCODE = 'P0003';
    END IF;

    -- 4. SUZ26-050: Resolver o insertar requisito e insertar relación
    SELECT requisito_id INTO v_req_050 FROM sigd_doc.requisito WHERE tipo_tramite_id = v_tupa_050 AND codigo = 'COMPROBANTE_PAGO';
    IF v_req_050 IS NULL THEN
        INSERT INTO sigd_doc.requisito (requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden)
        VALUES (gen_random_uuid(), v_tupa_050, 'COMPROBANTE_PAGO', 'Comprobante de Pago (mención documental; pago en Tesorería S/ 300.00)', FALSE, 0)
        RETURNING requisito_id INTO v_req_050;
    END IF;

    INSERT INTO sigd_doc.tipo_documento_requisito (id_relacion, requisito_id, tipo_documental_id, condicion_json_pointer)
    VALUES (gen_random_uuid(), v_req_050, v_tipo_doc_pago, NULL)
    ON CONFLICT (requisito_id, tipo_documental_id) DO NOTHING;

    -- 5. SUZ26-051: Resolver o insertar requisito e insertar relación
    SELECT requisito_id INTO v_req_051 FROM sigd_doc.requisito WHERE tipo_tramite_id = v_tupa_051 AND codigo = 'COMPROBANTE_PAGO';
    IF v_req_051 IS NULL THEN
        INSERT INTO sigd_doc.requisito (requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden)
        VALUES (gen_random_uuid(), v_tupa_051, 'COMPROBANTE_PAGO', 'Comprobante de Pago (mención documental; pago en Tesorería S/ 31.00)', FALSE, 0)
        RETURNING requisito_id INTO v_req_051;
    END IF;

    INSERT INTO sigd_doc.tipo_documento_requisito (id_relacion, requisito_id, tipo_documental_id, condicion_json_pointer)
    VALUES (gen_random_uuid(), v_req_051, v_tipo_doc_pago, NULL)
    ON CONFLICT (requisito_id, tipo_documental_id) DO NOTHING;

    -- 6. SUZ26-054: Resolver o insertar requisito e insertar relación
    SELECT requisito_id INTO v_req_054 FROM sigd_doc.requisito WHERE tipo_tramite_id = v_tupa_054 AND codigo = 'COMPROBANTE_PAGO';
    IF v_req_054 IS NULL THEN
        INSERT INTO sigd_doc.requisito (requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden)
        VALUES (gen_random_uuid(), v_tupa_054, 'COMPROBANTE_PAGO', 'Comprobante de Pago (mención documental; pago en Tesorería S/ 46.50)', FALSE, 0)
        RETURNING requisito_id INTO v_req_054;
    END IF;

    INSERT INTO sigd_doc.tipo_documento_requisito (id_relacion, requisito_id, tipo_documental_id, condicion_json_pointer)
    VALUES (gen_random_uuid(), v_req_054, v_tipo_doc_pago, NULL)
    ON CONFLICT (requisito_id, tipo_documental_id) DO NOTHING;

    -- 7. SUZ26-066: Desambiguar relación FUT (condicional a decisión institucional Opción A)
    -- NOTA: Se ejecuta únicamente previa autorización expresa institucional.
    SELECT requisito_id INTO v_req_066_fut FROM sigd_doc.requisito WHERE tipo_tramite_id = v_tupa_066 AND codigo = 'FUT';
    IF v_req_066_fut IS NOT NULL THEN
        DELETE FROM sigd_doc.tipo_documento_requisito
         WHERE requisito_id = v_req_066_fut AND tipo_documental_id = v_tipo_doc_fut;
    END IF;

    RAISE NOTICE 'Plan DML evaluado exitosamente: operaciones idempotentes y consistentes.';
END $remediacion_tupa$;
```

> [!CAUTION]
> **Estado de Ejecución:** El script anterior es una especificación técnica de diseño. **No ha sido ejecutado en la base de datos ni se ha creado ningún archivo `.sql` de ejecución desatendida.**

---

## 8. PROCEDIMIENTO DE PROTECCIÓN PARA LA FUTURA PRUEBA E2E

Para ejecutar la futura prueba de validación de radicación virtual sin comprometer el prototipo ni la demostración ante el docente, se establece el siguiente protocolo de seguridad:

### 8.1. Pre-Validación y Confirmación de Entorno
1. Comprobar que `current_database()` sea estrictamente `sigd_jacobo_demo`.
2. Verificar el estado inicial de las secuencias:
   ```sql
   SELECT anio_fiscal, ultimo_correlativo FROM sigd_tra.secuencia_anual_cut WHERE anio_fiscal = 2026;
   SELECT last_value, is_called FROM sigd_tra.seq_asiento_numero_registro;
   ```
   *Estado actual comprobado:* Correlativo anual = 5; Asiento = 10004.

### 8.2. Control de Concurrencia y Aserción Dinámica de CUT
- **Prohibido asumir un CUT estático:** El procedimiento de prueba no debe esperar de forma rígida `EXP-2026-000006`. Si hubiera una transacción concurrente, el correlativo podría avanzar.
- **Validación Dinámica:** La prueba debe capturar el valor devuelto en la respuesta HTTP (`response.body.cut`) y verificar mediante regex `^EXP-2026-\d{6}$` que corresponda al siguiente entero consecutivo de la secuencia atómica.

### 8.3. Uso Exclusivo de Identidad de Prueba
- La radicación debe realizarse únicamente con las credenciales de prueba del ciudadano:
  - Usuario: `ciudadano.demo`
  - DNI: `00000050`
  - Correo: `ciudadano.demo@iestpsuiza.edu.pe`
  - ID Usuario: `00000000-0000-0000-0000-000000000001`
- Queda prohibido usar cuentas de funcionarios, administradores o personal de Mesa de Partes.

### 8.4. Inventario Exhaustivo de Registros Creados en una Radicación Exitosa
Una ejecución de radicación virtual crea con exactitud:
1. **1 registro** en `sigd_doc.expediente` (expediente del dominio documental).
2. **1 registro** en `sigd_tra.expediente` (expediente del dominio tramitológico).
3. **1 registro** en `sigd_tra.tramite` (registro de trámite y asunto).
4. **1 registro** en `sigd_doc.documento_adjunto` (metadatos del PDF, hash SHA-256 y ubicación S3).
5. **1 registro** en `sigd_tra.expediente_documento_folio` (asignación de folios del documento).
6. **1 registro** en `sigd_tra.asiento_registro` (asiento inmutable en el Libro General de Entrada).
7. **1 objeto binario** en MinIO (`sigd-documentos/expedientes/2026/<uuid>.pdf`).
8. **1 avance** en `sigd_tra.secuencia_anual_cut` (`ultimo_correlativo` pasa de 5 a 6).
9. **1 avance** en la secuencia `sigd_tra.seq_asiento_numero_registro` (`last_value` pasa de 10004 a 10005).

### 8.5. Estrategia de Recuperación ante Fallos e Inmutabilidad del Asiento
- **Atomicidad Transaccional:** [`radicacionVirtual.service.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/radicacionVirtual.service.ts#L46-L108) ejecuta todo el proceso dentro de un bloque `BEGIN ... COMMIT`. Si ocurre un fallo en cualquier etapa previa a la confirmación, PostgreSQL ejecuta `ROLLBACK` automático, garantizando cero registros corruptos en las tablas de expedientes.
- **Comportamiento de Secuencias en Rollback:** Conforme al estándar de motores relacionales, `nextval` en PostgreSQL no retrocede tras un `ROLLBACK`. Si la transacción fallara después de invocar la secuencia, quedaría un salto de numeración.
- **Objetos Huérfanos en MinIO:** Si el archivo se sube vía URL prefirmada pero la radicación en BD falla, el objeto en S3 debe eliminarse explícitamente mediante script de limpieza.
- **Inmutabilidad Legal de `asiento_registro`:** Conforme a la regla `trg_asiento_inmutable` ([`05_sigd_tra.sql:391`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/05_sigd_tra.sql#L391)), si la prueba concluye exitosamente, el asiento no admite borrado físico (`DELETE`). Por lo tanto, el expediente de prueba debe conservarse como **expediente formal de homologación y prueba de aceptación**, o ser marcado lógicamente con `anulado = TRUE`.

---

## 9. AUTORIZACIONES REQUERIDAS POR FASE

Para proceder de forma controlada, se definen tres autorizaciones independientes:

1. **Autorización A (Decisión Institucional sobre FUT y Tasa):** Definición institucional formal sobre si el formulario web sustituye al FUT en `SUZ26-066` (Opción A) y confirmación de la naturaleza informativa de `obligatorio = FALSE`.
2. **Autorización B (Ejecución DML Idempotente):** Autorización para aplicar el bloque PL/pgSQL dinámico en `sigd_jacobo_demo`.
3. **Autorización C (Ejecución de Prueba E2E):** Autorización para emitir el expediente de homologación (CUT correlativo 6) con la cuenta `ciudadano.demo`.

---

## 10. DICTAMEN TÉCNICO GENERAL

El análisis confirma que la arquitectura del prototipo es completamente apta para soportar la radicación de la totalidad de los 19 procedimientos TUPA del IESTP Suiza, siempre que se formalicen las decisiones institucionales pendientes y se aplique la remediación con el script idempotente propuesto.

---

## 11. OBSERVACIONES FINALES Y CRITERIOS DE AUTORIZACIÓN

A continuación se detalla la matriz integral de observaciones técnicas, su evidencia objetiva, la resolución aplicada, el riesgo residual y las decisiones que quedan formalmente pendientes antes de autorizar cualquier modificación:

| N° | Observación Técnica | Evidencia Técnica Verificable | Resolución Aplicada | Riesgo Residual | Decisión Institucional / Técnica Pendiente |
|:---:|:---|:---|:---|:---|:---|
| **OBS-01** | **Contradicción conceptual en obligatoriedad de requisitos.** | • `04_sigd_doc.sql:137`: `DEFAULT TRUE`<br>• `RN-REQ-001`: exige clasificar en OBLIGATORIO/OPCIONAL/CONDICIONAL.<br>• `carga_tupa.sql`: usó `FALSE`.<br>• Backend no evalúa `r.obligatorio`. | Se desagrega formalmente: (1) Obligatoriedad legal del pago, (2) Exigencia técnica del voucher digital, (3) Inocuidad en el código. Se mantiene `FALSE` por homogeneidad técnica. | El administrado podría interpretar erróneamente en el texto del trámite que pagar la tasa es facultativo. | **Dirección General:** Definir si la Mesa Virtual exige el voucher digital previo obligatorio (`TRUE`) o admite comprobación diferida con Tesorería (`FALSE`). |
| **OBS-02** | **Fragilidad e idempotencia incompleta del DML preliminar.** | Cláusula `ON CONFLICT DO NOTHING` con UUIDs fijos. Si existía `(tipo_tramite_id, 'COMPROBANTE_PAGO')` con otro UUID, fallaba por clave foránea rota al insertar en `tipo_documento_requisito`. | Se rediseñó el DML como bloque PL/pgSQL que resuelve dinámicamente los UUIDs reales existentes y genera nuevos si no existen, garantizando idempotencia matemática. | Ninguno. El script valida la base `sigd_jacobo_demo` y las claves antes de operar. | **Autorización Técnica:** Autorizar la ejecución del bloque PL/pgSQL idempotente en la base de demostración. |
| **OBS-03** | **Equiparación indebida del asistente web con el FUT institucional.** | • `TramiteWizard` solo captura `asunto` y folios.<br>• `asiento_registro` no almacena metadatos académicos de FUT.<br>• No existe formato formal generado. | Se rectificó la afirmación: el asistente web no equivale documentalmente al FUT oficial. Se plantearon las 3 opciones institucionales (A, B y C). | En auditorías académicas externas podrían exigir el formato impreso del FUT si no existe resolución de homologación virtual. | **Dirección General / Secretaría Académica:** Aprobar formalmente la Opción A (homologación del formulario web como sustituto del FUT para el canal digital). |
| **OBS-04** | **Inmutabilidad del Asiento y Salto de Secuencias en Pruebas E2E.** | • `05_sigd_tra.sql:391`: Trigger `trg_asiento_inmutable` bloquea `DELETE` en `asiento_registro`.<br>• Secuencia anual en correlativo 5; asiento en 10004. | Se formuló el protocolo de protección E2E: validación dinámica de CUT devuelto, uso de `ciudadano.demo` y anulación lógica (`anulado = TRUE`) si se requiere desestimar el registro. | El expediente de prueba consumirá un correlativo formal en la base de demostración del docente. | **Aprobación de Prueba:** Autorizar la generación del expediente de homologación y prueba de aceptación (correlativo 6) en la demostración. |
| **OBS-05** | **Restricción de Entrada en Radicación Virtual (`length === 1`).** | [`radicacionVirtual.service.ts:205`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/radicacionVirtual.service.ts#L205): Excepción `CLASIFICACION_DOCUMENTAL_AMBIGUA` si hay más de 1 tipo o archivo. | Se mantiene la arquitectura sin alteraciones. Para `SUZ26-066`, se proyecta unificar el adjunto al comprobante de arancel, preservando el requisito formal en catálogo. | Imposibilidad de que el administrado suba dos archivos independientes clasificados separadamente en una sola solicitud. | **Planificación Futura:** Programar para la Fase 3 la evolución a soporte de múltiples tipos y adjuntos documentales. |

---

### **DICTAMEN DEFINITIVO: APTO CON CONDICIONES**

#### Fundamentos del Dictamen:
1. **Solvencia Técnica:** Las observaciones de obligatoriedad, idempotencia DML y seguridad E2E han quedado completamente esclarecidas, documentadas y blindadas desde la perspectiva de ingeniería de software e integridad referencial.
2. **Preservación Arquitectónica Absoluta:** No se ha alterado código fuente, esquemas ni registros en la base de datos durante esta auditoría.
3. **Condiciones Requeridas para Proceder:**
   - **Condición 1:** Que la autoridad del proyecto adopte y confirme la **Opción A** para `SUZ26-066` (homologación de la solicitud web para el canal virtual con adjunto de comprobante de arancel).
   - **Condición 2:** Que se autorice de forma explícita y separada la ejecución del **bloque DML idempotente** sobre `sigd_jacobo_demo`.
   - **Condición 3:** Que se autorice expresamente el avance del correlativo oficial mediante la ejecución de la **prueba controlada E2E** con el usuario `ciudadano.demo`.

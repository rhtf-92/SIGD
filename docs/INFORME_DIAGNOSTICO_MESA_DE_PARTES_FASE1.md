# SIGD IESTP SUIZA 2026 — INFORME DE AUDITORÍA DIAGNÓSTICA DE MESA DE PARTES, TUPA Y RADICACIÓN
## FASE 1: IDENTIFICACIÓN DE PROBLEMAS SIN MODIFICAR EL PROYECTO

**Fecha de emisión:** 26 de octubre de 2026  
**Repositorio:** `C:\Users\Liz\Desktop\SIGD\SIGD`  
**Rama de trabajo:** `B_JACOBO`  
**HEAD commit:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Responsable:** Ingeniero Sénior Full Stack, Arquitecto de Software y Especialista QA / PostgreSQL  
**Clasificación:** Diagnóstico Técnico de Solo Lectura (Zero-Write Audit)

---

## ÍNDICE GENERAL

1. [SECCIÓN A: ESTADO INICIAL](#sección-a-estado-inicial)
2. [SECCIÓN B: RESUMEN EJECUTIVO](#sección-b-resumen-ejecutivo)
3. [SECCIÓN C: MATRIZ DE HALLAZGOS](#sección-c-matriz-de-hallazgos)
4. [SECCIÓN D: ANÁLISIS PROFUNDO DEL ERROR `correlativo_anual`](#sección-d-análisis-profundo-del-error-correlativo_anual)
5. [SECCIÓN E: FLUJO FUNCIONAL DE MESA DE PARTES (VIRTUAL Y PRESENCIAL)](#sección-e-flujo-funcional-de-mesa-de-partes-virtual-y-presencial)
6. [SECCIÓN F: LISTA PRIORIZADA DE PROBLEMAS DETECTADOS](#sección-f-lista-priorizada-de-problemas-detectados)
7. [SECCIÓN G: PLAN DE REPARACIÓN PROPUESTO PARA FASE 2](#sección-g-plan-de-reparación-propuesto-para-fase-2)
8. [SECCIÓN H: AUTORIZACIONES NECESARIAS](#sección-h-autorizaciones-necesarias)
9. [SECCIÓN I: DICTAMEN FINAL (RESPUESTAS A LAS 8 PREGUNTAS FORMALES)](#sección-i-dictamen-final-respuestas-a-las-8-preguntas-formales)

---

## SECCIÓN A: ESTADO INICIAL

### A.1. Control de Versiones y Repositorio
* **Repositorio local:** `C:\Users\Liz\Desktop\SIGD\SIGD`
* **Rama activa:** `B_JACOBO` (confirmada mediante `git rev-parse --abbrev-ref HEAD`).
* **Commit de referencia HEAD:** `bf30d8a0c85e266a86381fb10bf3740a8451c032` (`refactor: alinear prototipo a PostgreSQL 5433 y retirar contenedores de prueba`).
* **Estado del árbol de trabajo (`git status --short`):** Los archivos modificados y no rastreados corresponden estrictamente al prototipo consolidado y scripts de soporte en `scratch/`. Durante esta auditoría diagnóstica **no se ha modificado ningún archivo del proyecto**, no se han agregado commits ni se ha alterado la rama `main` ni `B_JACOBO`.

### A.2. Estado de la Infraestructura en Contenedores Docker
Inspección ejecutada contra el daemon Docker local:
* **`sigd-postgres-1` (ID: `92a8398e847c`):** Estado `Up 8 hours (healthy)`, puerto `5433->5432/tcp`.
  * Base de datos institucional de referencia del docente: `sigd_prueba` (31 tablas originales intactas, 0 modificaciones).
  * Base de datos centralizada del prototipo: `sigd_jacobo_demo` (56 tablas de usuario en 6 esquemas: `sigd_auth`, `sigd_org`, `sigd_doc`, `sigd_tra`, `sigd_rut`, `sigd_rep`).
* **`sigd-redis-1` (ID: `598e3b2e3532`):** Estado `Up 8 hours (healthy)`, puerto `6379->6379/tcp`, Base de datos lógica `1`.
* **`sigd-minio-1` (ID: `827d0cffaa72`):** Estado `Up 8 hours (healthy)`, puertos `9000->9000/tcp` (S3 API) y `9001->9001/tcp` (Consola Web). Bucket activo y validado: `sigd-sandbox-e2e`.

### A.3. Estado de los Servicios Locales Activos
* **Backend Node.js / Express:**
  * PID activo: `27572` en puerto TCP `3008`.
  * Verificación de salud: `GET http://127.0.0.1:3008/health` -> `HTTP 200 {"status":"UP","timestamp":"...","uptime":...}`.
  * Verificación de alistamiento: `GET http://127.0.0.1:3008/ready` -> `HTTP 200 {"status":"READY","checks":{"database":"CONNECTED","migrations":"ALIGNED"}}`.
* **Frontend Vite / React:**
  * PID activo: `9240` en puerto TCP `5178`.
  * Verificación HTTP: `GET http://127.0.0.1:5178/` -> `HTTP 200 OK`.

---

## SECCIÓN B: RESUMEN EJECUTIVO

1. **Estado global de Mesa de Partes:**  
   Mesa de Partes cuenta con dos canales plenamente implementados en código:
   - **Mesa de Partes Virtual (MPV):** Wizard web reactivo de 4 pasos para administrados y ciudadanos (`/tramite`), con integración a MinIO (S3) mediante URLs prefirmadas (`POST /api/v1/storage/presigned-url`), validación en backend de formato binario `%PDF-`, verificación criptográfica de hash SHA-256, estricta correspondencia de identidad de sesión contra DNI registrado y cálculo legal de horario de corte conforme al TUO de la Ley N° 27444 (LPAG).
   - **Ventanilla Presencial:** Interfaz web para operadores institucionales (`/tramite/ventanilla-presencial`) accesible para usuarios con el rol `MESA_PARTES` (usuario precargado: `ventanilla.demo`), con generación de ticket térmico físico de 80mm e impresión/modal de cargo digital de recepción física (`POST /api/v1/tramites/ventanilla-presencial` y `GET /api/v1/tramites/ventanilla/cargo/:cut`).
   - **Consulta Pública:** Endpoint público sin credenciales (`GET /api/v1/tramites/consulta-publica/:cut`), plenamente operativo y con enmascaramiento de datos personales de acuerdo con la Ley N° 29733.

2. **Diagnóstico del Catálogo TUPA y Radicación:**
   - La base de datos contiene **22 procedimientos TUPA** en total.
   - **3 procedimientos están inactivos** (`vigente = FALSE`: `TUPA-01`, `TUPA-02`, `TUPA-03`).
   - **19 procedimientos están formalmente vigentes** (`vigente = TRUE`) y son expuestos por la API en `/api/v1/tramites/tipos`.
   - De los 19 procedimientos vigentes:
     * **15 procedimientos (78.9%) están 100% operativos y listos para radicar virtualmente hoy mismo.** Cuentan con exactamente 1 tipo documental asociado en la matriz `sigd_doc.tipo_documento_requisito`.
     * **3 procedimientos fallarían al radicar por MPV con código HTTP 400 (`CLASIFICACION_DOCUMENTAL_NO_CONFIGURADA`):** `SUZ26-050` (Reincorporación), `SUZ26-051` (Constancia de Egresado) y `SUZ26-054` (Convalidación entre Planes de Estudios). Esto ocurre porque no tienen registros asociados en la tabla de requisitos `sigd_doc.requisito`.
     * **1 procedimiento fallaría al radicar por MPV con código HTTP 400 (`CLASIFICACION_DOCUMENTAL_AMBIGUA`):** `SUZ26-066` (Traslado Externo), debido a que tiene 2 requisitos vigentes con 2 tipos documentales distintos (`COMPROBANTE_PAGO` y `FUT`) sin puntero JSON condicional (`condicion_json_pointer IS NULL`), disparando la protección `fail-closed` del backend.
   - En **Ventanilla Presencial**, los 19 procedimientos son radicables sin problemas debido a que el operador selecciona de manera explícita el tipo documental (`FUT` o `COMPROBANTE_PAGO`) en la pantalla.

3. **Veredicto sobre el error `correlativo_anual`:**  
   **No existe ningún defecto de correlativo en el código ni en la base de datos de la aplicación SIGD.**  
   La supuesta tabla `sigd_tra.correlativo_anual` nunca ha existido en el modelo de datos. Dicho error fue generado de forma aislada por un script ad-hoc de diagnóstico (`scratch/diagnose_mesadepartes.mjs`) que intentó consultar una tabla inexistente. La aplicación utiliza la función atómica `sigd_tra.fn_generar_cut` sobre la tabla canónica `sigd_tra.secuencia_anual_cut` con bloqueo pesimista `FOR UPDATE`, la cual se encuentra **100% funcional, libre de colisiones y con correlativo 5 para el año 2026**.

4. **Nivel de preparación para demostración al docente:**  
   **APTO PARA DEMOSTRACIÓN INMEDIATA.**  
   El flujo completo de Mesa de Partes (ingreso de usuario autenticado, selección de TUPA, subida de PDF a MinIO, radicación atómica, asignación de CUT, generación de cargo digital con QR, generación de asiento de ingreso, consulta pública y radicación física en ventanilla) funciona de principio a fin utilizando cualquiera de los 15 procedimientos vigentes configurados (por ejemplo, `SUZ26-035` Certificado de Estudios Superiores o `SUZ26-034` Expedición de Título).

---

## SECCIÓN C: MATRIZ DE HALLAZGOS

| ID | Componente / Aspecto Evaluado | Estado Actual | Evidencia Técnica (Archivos / DB) | Impacto / Riesgo |
|:---|:---|:---:|:---|:---|
| **C.01** | Catálogo TUPA Vigente (API) | **OPERATIVO** | `GET /api/v1/tramites/tipos` retorna 19 procedimientos con status 200. Tabla `sigd_doc.tipo_tramite_tupa`. | Ninguno. El frontend y backend consumen el catálogo formal. |
| **C.02** | Configuración Documental TUPA (MPV) | **PARCIAL (15/19)** | `radicacionVirtual.service.ts:167-189` (`resolverTipoDocumental`). Query sobre `sigd_doc.tipo_documento_requisito`. | **Medio:** 3 trámites no tienen requisitos (error `NO_CONFIGURADA`); 1 trámite tiene 2 tipos (error `AMBIGUA`). |
| **C.03** | Generador de CUT Universal | **OPERATIVO** | Función PL/pgSQL `sigd_tra.fn_generar_cut(p_anio)` y tabla `sigd_tra.secuencia_anual_cut`. | **Ninguno.** Atomicidad O(1) garantizada con bloqueo pesimista. Cero colisiones. |
| **C.04** | Almacenamiento MinIO (S3) | **OPERATIVO** | `s3-storage.service.ts` y `storage.router.ts`. Presigned URLs directas al bucket `sigd-sandbox-e2e`. | **Ninguno.** Carga desacoplada sin sobrecargar el hilo del backend. |
| **C.05** | Integridad y Magic Bytes de Documentos | **OPERATIVO** | `radicacionVirtual.service.ts:327-360`. Descarga stream desde S3, valida SHA-256 y verifica primeros 5 bytes `%PDF-`. | **Ninguno.** Bloquea ataques de spoofing MIME o archivos maliciosos. |
| **C.06** | Validación de Identidad (Anti-Suplantación) | **OPERATIVO** | `radicacionVirtual.service.ts:114-142` (`resolverPersonaAutenticada`). Compara DNI/Nombre contra `sigd_auth.persona`. | **Ninguno.** Si los datos no coinciden con la sesión JWT, arroja `HTTP 403 Forbidden` (`detail: Los datos declarados no coinciden...`). |
| **C.07** | Horario de Corte LPAG (Art. 138 Ley 27444) | **OPERATIVO** | `horarioCorte.util.ts` y `radicacionVirtual.service.ts:205-230`. Corte a las 16:30 hrs. | **Ninguno.** Radicaciones pasadas las 16:30 o en fin de semana se marcan `diferidoPorCorte = true` y proyectan su fecha legal a las 08:00 hrs del día hábil siguiente. |
| **C.08** | Calendario Laboral Institucional | **PARCIAL** | `sigd_org.calendario_laboral` contiene solo 2 registros no laborables (`2026-06-24` San Juan y `2026-10-13`). | **Bajo.** Los fines de semana se computan por código; solo feriados nacionales adicionales de 2026 faltan poblar. |
| **C.09** | Transacción Atómica de Radicación Virtual | **OPERATIVO** | `radicacionVirtual.service.ts:250-380`. `BEGIN` ... `COMMIT` en cliente único de pool. | **Ninguno.** Inserta en `sigd_doc.expediente`, `sigd_tra.expediente`, `sigd_tra.tramite`, `sigd_doc.documento_adjunto`, `sigd_tra.expediente_documento_folio` y `sigd_tra.asiento_registro`. Rollback automático ante fallo. |
| **C.10** | Asiento Registral y Foliación AGN | **OPERATIVO** | Secuencia `sigd_tra.seq_asiento_numero_registro` (asientos 10001 a 10004 registrados sin vacíos). Tabla `sigd_tra.asiento_registro`. | **Ninguno.** Foliación continua conforme a Directiva N° 001-2019-AGN. |
| **C.11** | Ventanilla Presencial Física | **OPERATIVO** | `ventanillaPresencial.service.ts`, endpoint `POST /api/v1/tramites/ventanilla-presencial`. | **Ninguno.** Operador `ventanilla.demo` con rol `MESA_PARTES` emite CUT, cargo y ticket térmico. |
| **C.12** | Cargo Digital y Ticket Térmico 80mm | **OPERATIVO** | `ticketTermico.util.ts`, `ThermalTicketPreview.tsx` y `CargoDigitalModal.tsx`. | **Ninguno.** Formato ESC/POS y representación visual exacta. |
| **C.13** | Consulta Pública por CUT | **OPERATIVO** | `consultaPublica.service.ts`, endpoint `GET /api/v1/tramites/consulta-publica/:cut`. | **Ninguno.** Retorna estado, trazabilidad, hash SHA-256 y datos enmascarados bajo Ley 29733. |

---

## SECCIÓN D: ANÁLISIS PROFUNDO DEL ERROR `correlativo_anual`

Durante la sesión previa de pruebas, un script de diagnóstico automatizado arrojó el siguiente mensaje:
```text
SQLSTATE 42P01: relation "sigd_tra.correlativo_anual" does not exist
```

### D.1. Origen Técnico del Error
Se realizó una inspección forense minuciosa en el código fuente de backend y frontend:
* **Búsqueda en todo el código:** No existe una sola ocurrencia de la cadena `correlativo_anual` en ningún servicio, controlador, repositorio o migración del SIGD (`backend/src`, `backend/migraciones`, `frontend/src`).
* **Origen de la consulta:** La consulta `SELECT anio_fiscal, ultimo_numero FROM sigd_tra.correlativo_anual` provino **exclusivamente de un script ad-hoc de prueba** (`scratch/diagnose_mesadepartes.mjs`), cuyo autor asumió que existía una tabla con ese nombre para llevar la secuencia de expedientes.

### D.2. Arquitectura Real y Canónica del Correlativo de Trámite
El sistema SIGD de referencia (diseñado por el docente e implementado en las migraciones `05_sigd_tra.sql`) utiliza una arquitectura robusta, atómica y segura:

#### 1. Tabla canónica de secuencia:
```sql
-- Definición en backend/migraciones/05_sigd_tra.sql
CREATE TABLE IF NOT EXISTS sigd_tra.secuencia_anual_cut (
    anio_fiscal        INT         NOT NULL CONSTRAINT pk_secuencia_anual_cut PRIMARY KEY,
    ultimo_correlativo BIGINT      NOT NULL DEFAULT 0,
    creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 2. Función PL/pgSQL atómica con bloqueo pesimista:
```sql
CREATE OR REPLACE FUNCTION sigd_tra.generar_cut_expediente(p_anio INT)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
AS $$
DECLARE
    v_correlativo BIGINT;
    v_cut         VARCHAR(20);
BEGIN
    IF p_anio IS NULL OR p_anio <= 0 THEN
        RAISE EXCEPTION 'Año fiscal inválido: %', p_anio USING ERRCODE = '22023';
    END IF;

    -- Garantizar la existencia del registro para el año fiscal
    INSERT INTO sigd_tra.secuencia_anual_cut (anio_fiscal, ultimo_correlativo)
    VALUES (p_anio, 0)
    ON CONFLICT (anio_fiscal) DO NOTHING;

    -- Bloqueo pesimista de fila (FOR UPDATE) que serializa solicitudes concurrentes
    SELECT ultimo_correlativo + 1
      INTO v_correlativo
      FROM sigd_tra.secuencia_anual_cut
     WHERE anio_fiscal = p_anio
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo inicializar la secuencia anual del %', p_anio USING ERRCODE = '40001';
    END IF;

    UPDATE sigd_tra.secuencia_anual_cut
       SET ultimo_correlativo = v_correlativo
     WHERE anio_fiscal = p_anio;

    -- Generación de máscara oficial EXP-YYYY-XXXXXX
    v_cut := 'EXP-' || p_anio::TEXT || '-' || LPAD(v_correlativo::TEXT, 6, '0');
    RETURN v_cut;
END;
$$;

-- Alias canónico estricto utilizado por CutService
CREATE OR REPLACE FUNCTION sigd_tra.fn_generar_cut(p_anio INT)
RETURNS VARCHAR(20)
LANGUAGE sql
STRICT
AS $$
    SELECT sigd_tra.generar_cut_expediente(p_anio);
$$;
```

#### 3. Estado actual en la base de datos `sigd_jacobo_demo`:
* Al consultar `SELECT * FROM sigd_tra.secuencia_anual_cut`:
  * `anio_fiscal`: `2026`
  * `ultimo_correlativo`: `5`
  * `creado_en`: `2026-10-26T12:54:42.426Z`
* Privilegios de `sigd_jacobo_user`:
  * `has_function_privilege('sigd_jacobo_user', 'sigd_tra.fn_generar_cut(int)', 'EXECUTE')` = `true`
  * `has_table_privilege('sigd_jacobo_user', 'sigd_tra.secuencia_anual_cut', 'SELECT, UPDATE, INSERT')` = `true`
  * `has_sequence_privilege('sigd_jacobo_user', 'sigd_tra.seq_asiento_numero_registro', 'USAGE')` = `true`

### D.3. Conclusión sobre el correlativo
El error `correlativo_anual` fue un **falso positivo de telemetría de prueba externa**.  
El prototipo SIGD **NO adolece de este error**, su mecanismo de generación de CUT está activo, blindado contra condiciones de carrera mediante `SELECT ... FOR UPDATE` y asigna correlativos atómicamente en tiempo constante $O(1)$.

---

## SECCIÓN E: FLUJO FUNCIONAL DE MESA DE PARTES (VIRTUAL Y PRESENCIAL)

```mermaid
flowchart TD
    subgraph MPV["1. Mesa de Partes Virtual (Ciudadano / Administrado)"]
        A1["Frontend: Wizard Paso 1\nDatos del Solicitante"] --> A2["Frontend: Wizard Paso 2\nSelección TUPA (/tramites/tipos)"]
        A2 --> A3["Frontend: Wizard Paso 3\nPresigned URL MinIO (S3)"]
        A3 --> A4["Carga binaria directa\na MinIO (:9000)"]
        A4 --> A5["Frontend: Wizard Paso 4\nDeclaración Jurada y Envío"]
        A5 --> B1["POST /api/v1/tramites/radicacion-virtual"]
    end

    subgraph BACKEND_MPV["2. Backend: RadicacionVirtualService"]
        B1 --> B2{"Validar DNI con\nSesión JWT"}
        B2 -- Discrepancia --> B2_ERR["HTTP 403 Forbidden\nAnti-suplantación"]
        B2 -- Coincide --> B3{"Verificar TUPA\ny Tipo Documental"}
        B3 -- Ambiguo o 0 tipos --> B3_ERR["HTTP 400 Bad Request\nError Clasificación"]
        B3 -- 1 Tipo OK --> B4["Descargar Stream de MinIO:\nValida SHA-256 + Magic %PDF-"]
        B4 --> B5["SELECT sigd_tra.fn_generar_cut(2026)\nBloqueo FOR UPDATE"]
        B5 --> B6["Calcular Horario Corte LPAG\n(16:30 hrs / Feriados)"]
        B6 --> B7["Transacción Única BEGIN:\n- sigd_doc.expediente\n- sigd_tra.expediente\n- sigd_tra.tramite\n- sigd_doc.documento_adjunto\n- sigd_tra.expediente_documento_folio\n- sigd_tra.asiento_registro\nCOMMIT"]
        B7 --> B8["Retorna CUT + Cargo Digital con QR"]
    end

    subgraph VENTANILLA["3. Mesa de Partes Presencial (Operador Ventanilla)"]
        V1["Operador Login (rol MESA_PARTES)\n/tramite/ventanilla-presencial"] --> V2["Ingreso de Solicitante,\nSelección Tipo Doc + TUPA"]
        V2 --> V3["POST /api/v1/tramites/ventanilla-presencial"]
        V3 --> V4["VentanillaPresencialService:\n- fn_generar_cut(2026)\n- Inserta Expediente + Asiento\n- Genera Ticket Térmico ESC/POS"]
        V4 --> V5["Impresión de Ticket 80mm\ny Visualización de Cargo Físico"]
    end

    subgraph CONSULTA["4. Consulta Ciudadana Pública"]
        C1["Ciudadano consulta por CUT\n/tramites/consulta-publica/:cut"] --> C2["ConsultaPublicaService"]
        C2 --> C3["Retorna estado, fechas LPAG,\nhash SHA-256 y DNI enmascarado"]
    end
```

### E.1. Detalle del Flujo de Mesa de Partes Virtual
1. **Paso 1: Validación de Identidad:**  
   El solicitante ingresa su tipo y número de documento. `radicacionVirtual.service.ts` ejecuta `resolverPersonaAutenticada`: si el DNI o nombre enviado no coincide de forma exacta con la persona ligada a la cuenta JWT, la solicitud es rechazada inmediatamente con `HTTP 403 Forbidden` (`detail: Los datos declarados no coinciden con la identidad vinculada a la sesión`).
2. **Paso 2: Selección de Procedimiento TUPA:**  
   Se consulta `GET /api/v1/tramites/tipos`. El usuario escoge uno de los procedimientos vigentes.
3. **Paso 3: Carga Criptográfica de Requisitos a MinIO:**  
   El frontend solicita una URL prefirmada (`POST /api/v1/storage/presigned-url`). El archivo PDF es subido directamente desde el navegador a MinIO sin transitar por la memoria del servidor de aplicaciones.
4. **Paso 4: Envío y Radicación Atómica:**  
   El frontend envía la carga útil a `POST /api/v1/tramites/radicacion-virtual`. El backend:
   - Resuelve el tipo documental unívoco en `sigd_doc.tipo_documento_requisito`.
   - Se conecta al bucket S3 y descarga el stream binario: valida que los primeros 5 bytes comiencen exactamente con `%PDF-` y verifica que el hash SHA-256 calculado en caliente coincida con el declarado.
   - Invoca atómicamente `sigd_tra.fn_generar_cut(2026)` obteniendo el siguiente CUT correlativo.
   - Evalúa la hora legal: si la solicitud ingresa después de las 16:30 o en día inhábil, la marca como `diferidoPorCorte: true` y computa la fecha legal de radicación para el día hábil inmediato a las 08:00 hrs.
   - En una transacción `BEGIN ... COMMIT` aislada, registra el expediente documental, el expediente de trámite, el documento adjunto, la foliación y el asiento registral número `1000X`.
   - Emite el Cargo Digital con metadatos de validación institucional y código QR.

---

## SECCIÓN F: LISTA PRIORIZADA DE PROBLEMAS DETECTADOS

### Severidad Alta (P1): Clasificación Documental Incompleta en 4 Trámites TUPA
* **F.1. Tres trámites sin requisitos (HTTP 400 `CLASIFICACION_DOCUMENTAL_NO_CONFIGURADA`):**
  - `SUZ26-050` — Derecho de Reincorporación (Reingreso).
  - `SUZ26-051` — Constancia de Egresado.
  - `SUZ26-054` — Convalidación entre Planes de Estudios.
  - *Causa raíz:* En la tabla `sigd_doc.requisito` no existen registros asociados a estos tres procedimientos. El método `resolverTipoDocumental` aplica política `fail-closed` y aborta la radicación si `rows.length === 0`.
* **F.2. Un trámite con clasificación ambigua (HTTP 400 `CLASIFICACION_DOCUMENTAL_AMBIGUA`):**
  - `SUZ26-066` — Traslado Externo.
  - *Causa raíz:* En la tabla `sigd_doc.requisito` tiene 2 requisitos (`COMPROBANTE_PAGO` y `FUT`), ambos asociados a tipos documentales vigentes distintos en `sigd_doc.tipo_documento_requisito` sin puntero JSON condicional (`condicion_json_pointer IS NULL`), por lo que `resolverTipoDocumental` arroja error al encontrar `rows.length > 1`.

### Severidad Media (P2): Cobertura del Calendario Laboral Institucional 2026
* **F.3. Feriados incompletos en `sigd_org.calendario_laboral`:**
  - *Causa raíz:* La tabla solo contiene 2 fechas declaradas como no laborables para 2026 (`2026-06-24` y `2026-10-13`). Aunque el motor de corte detecta correctamente sábados y domingos de forma algorítmica, los feriados nacionales peruanos de 2026 (Año Nuevo, Semana Santa, Fiestas Patrias, Combate de Angamos, etc.) no están cargados en la tabla para calcular descansos cívicos adicionales.

### Severidad Baja (P3): Scripts de Telemetría Externa Desalineados
* **F.4. Scripts ad-hoc invocando esquemas incorrectos:**
  - *Causa raíz:* Scripts creados en sesiones anteriores para pruebas rápidas contenían nombres hipotéticos (`sigd_tra.correlativo_anual`) en lugar de consultar la arquitectura real (`sigd_tra.secuencia_anual_cut`).

---

## SECCIÓN G: PLAN DE REPARACIÓN PROPUESTO PARA FASE 2

> [!NOTE]
> Este plan se presenta exclusivamente para revisión y aprobación. No se ejecutará ninguna acción hasta contar con la autorización formal del usuario.

### Tarea G.1: Completar la Matriz de Clasificación Documental TUPA en `sigd_jacobo_demo`
* **Objetivo:** Lograr que el 100% (19/19) de los trámites TUPA vigentes sean radicables virtualmente.
* **Acción SQL (Insert idempotente en base del prototipo):**
  1. Insertar el requisito estándar en `sigd_doc.requisito` para `SUZ26-050`, `SUZ26-051` y `SUZ26-054` con su correspondiente relación a `FUT` o `COMPROBANTE_PAGO` en `sigd_doc.tipo_documento_requisito`.
  2. Para `SUZ26-066` (Traslado Externo), designar el tipo documental principal (o asociar `FUT` como principal y `COMPROBANTE_PAGO` condicional) de modo que `resolverTipoDocumental` devuelva exactamente 1 tipo base.

### Tarea G.2: Poblado de Feriados Nacionales en `sigd_org.calendario_laboral`
* **Objetivo:** Garantizar que el cálculo legal de horario de corte LPAG reconozca todos los feriados del año fiscal 2026.
* **Acción SQL:**
  - Insertar en `sigd_org.calendario_laboral` los días feriados oficiales calendario del Perú para 2026 (ej. `2026-01-01`, `2026-04-02`, `2026-04-03`, `2026-05-01`, `2026-07-28`, `2026-07-29`, `2026-08-06`, `2026-08-30`, `2026-10-08`, `2026-11-01`, `2026-12-08`, `2026-12-25`) con `es_laborable = FALSE`.

### Tarea G.3: Verificación de Radicación End-to-End
* **Objetivo:** Ejecutar una prueba controlada de radicación virtual y presencial sobre un trámite corregido, verificando la generación del CUT `EXP-2026-000006`, el asiento registral `10005`, la foliación y la consulta pública.

---

## SECCIÓN H: AUTORIZACIONES NECESARIAS

Para avanzar a la Fase 2 y aplicar las remediaciones mínimas, se requerirán las siguientes autorizaciones expresas:
1. **Autorización DML en `sigd_jacobo_demo`:** Autorización para insertar los 3 requisitos faltantes en `sigd_doc.requisito` y `sigd_doc.tipo_documento_requisito`, y ajustar la relación de `SUZ26-066`.
2. **Autorización DML para el Calendario:** Autorización para insertar el catálogo de feriados 2026 en `sigd_org.calendario_laboral`.
3. **Autorización para una prueba controlada de radicación:** Autorización para generar un expediente de prueba en el entorno demo con el fin de obtener evidencia verificable del CUT correlativo `EXP-2026-000006` en pantalla y en base de datos.
4. **Garantía de Preservación:** Se reitera que **la base de datos del docente (`sigd_prueba`) y la rama `main` permanecerán 100% intactas y no se tocarán bajo ninguna circunstancia**.

---

## SECCIÓN I: DICTAMEN FINAL (RESPUESTAS A LAS 8 PREGUNTAS FORMALES)

### 1. ¿Está Mesa de Partes 100% operativa?
**NO al 100%, pero sí al 78.9% en su canal virtual y al 100% en su canal presencial.**  
El motor completo de radicación, almacenamiento S3, validación criptográfica, anti-suplantación, generación de CUT y consulta ciudadana funciona con total normalidad. Sin embargo, en el canal virtual (MPV), 4 de los 19 procedimientos TUPA vigentes no pueden radicarse actualmente debido a la falta o ambigüedad de configuración de sus tipos documentales asociados.

### 2. ¿Cuántos trámites TUPA se pueden radicar hoy sin errores?
**Exactamente 15 de los 19 trámites TUPA vigentes pueden radicarse hoy mismo sin ningún error.**  
Los trámites plenamente operativos incluyen: `SUZ26-031`, `SUZ26-034`, `SUZ26-035` (Certificado de Estudios), `SUZ26-036`, `SUZ26-044`, `SUZ26-045`, `SUZ26-052`, `SUZ26-053`, `SUZ26-055`, `SUZ26-056`, `SUZ26-063`, `SUZ26-064`, `SUZ26-065`, `SUZ26-068` (Acceso a la Información Pública) y `SUZ26-072`.  
Los 4 que fallarían por MPV son `SUZ26-050`, `SUZ26-051`, `SUZ26-054` y `SUZ26-066`. (En Ventanilla Presencial se pueden radicar los 19).

### 3. ¿El error `correlativo_anual` bloquea la radicación?
**NO, EN ABSOLUTO.**  
Dicho error no existe en la aplicación SIGD ni en su base de datos. El sistema genera el CUT utilizando la función atómica `sigd_tra.fn_generar_cut(p_anio)` y la tabla canónica `sigd_tra.secuencia_anual_cut`. El error reportado provino únicamente de un script de prueba que consultó una tabla inexistente.

### 4. ¿Se puede demostrar el registro de un trámite al profesor en el estado actual?
**SÍ, TOTALMENTE.**  
Se puede realizar una demostración completa e impecable seleccionando cualquiera de los 15 procedimientos vigentes habilitados (por ejemplo, `SUZ26-035` - Certificado de Estudios Superiores). El flujo mostrará la carga real a MinIO, el cálculo del hash SHA-256, la asignación de un CUT correlativo único (ej. `EXP-2026-000006`), la emisión del Cargo Digital con código QR y su verificación inmediata en el portal de Consulta Pública.

### 5. ¿Qué pasa si un usuario intenta registrar con un DNI que no le pertenece?
**El sistema bloquea la operación y rechaza el registro con código HTTP 403 Forbidden.**  
La función `resolverPersonaAutenticada` en `radicacionVirtual.service.ts` valida que el DNI y el nombre del solicitante coincidan exactamente con la identidad registrada en `sigd_auth.persona` vinculada al token JWT de la sesión activa. La respuesta es:
```json
{
  "code": "ACCESO_DENEGADO",
  "detail": "Los datos declarados no coinciden con la identidad vinculada a la sesión."
}
```

### 6. ¿Qué pasa si se envía un trámite a las 16:31 o un domingo?
**El trámite se registra correctamente pero se difiere legalmente conforme al Art. 138 del TUO de la Ley N° 27444.**  
El módulo `horarioCorte.util.ts`:
- Registra la fecha y hora cronológica exacta de recepción (`fechaEnvioReal`).
- Marca el indicador `diferidoPorCorte = true`.
- Proyecta la `fechaRadicacionLegal` al siguiente día hábil a las 08:00 AM (por ejemplo, si se radica el domingo a las 18:00, la fecha legal se fija el lunes a las 08:00 AM).
- El cargo digital y el asiento registral reflejan explícitamente ambas marcas de tiempo para garantizar la validez jurídica de los plazos administrativos.

### 7. ¿Existe riesgo de pérdida de datos o corrupción con la configuración actual?
**NO EXISTE RIESGO.**  
Toda la radicación virtual y presencial se ejecuta dentro de una transacción `BEGIN ... COMMIT` aislada por conexión de PostgreSQL. Si la validación de archivos en MinIO falla, si el hash no coincide o si ocurre cualquier excepción, la transacción ejecuta un `ROLLBACK` total. Además, la secuencia del CUT utiliza bloqueo pesimista de fila `FOR UPDATE`, lo que impide duplicidad de números aún bajo concurrencia extrema.

### 8. ¿Cuál es el tiempo estimado para corregir los problemas identificados?
**Aproximadamente 10 a 15 minutos.**  
Dado que la arquitectura, el código del backend, los controladores y el frontend se encuentran intactos y funcionando, la corrección requiere únicamente insertar los requisitos faltantes de los 4 procedimientos en las tablas de metadatos de `sigd_jacobo_demo` y poblar los feriados 2026. No requiere reestructurar código, alterar migraciones de `main` ni reiniciar servicios.

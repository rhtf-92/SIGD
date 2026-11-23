# SIGD IESTP SUIZA 2026 — INVESTIGACIÓN DE CAUSA RAÍZ Y SOLUCIÓN CONTROLADA DE AUDITORÍA TUPA

**Fecha:** 26 de octubre de 2026  
**Repositorio:** `C:\Users\Liz\Desktop\SIGD\SIGD`  
**Rama activa:** `B_JACOBO`  
**HEAD commit:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Base de datos inspeccionada:** `sigd_jacobo_demo` en puerto `5433` (Docker: `sigd-postgres-1`)  
**Modo de ejecución:** Solo Lectura Estricto (`default_transaction_read_only=on`)

---

## ÍNDICE GENERAL

1. [SECCIÓN A: ESTADO INICIAL DE GIT Y DE LOS SERVICIOS](#sección-a-estado-inicial-de-git-y-de-los-servicios)
2. [SECCIÓN B: CAUSA RAÍZ DE CADA ERROR ENCONTRADO](#sección-b-causa-raíz-de-cada-error-encontrado)
3. [SECCIÓN C: ARCHIVOS MODIFICADOS Y JUSTIFICACIÓN DE CADA CAMBIO](#sección-c-archivos-modificados-y-justificación-de-cada-cambio)
4. [SECCIÓN D: CONSULTAS EJECUTADAS Y EVIDENCIAS DE LOS RESULTADOS](#sección-d-consultas-ejecutadas-y-evidencias-de-los-resultados)
5. [SECCIÓN E: ESTADO REAL DEL CATÁLOGO TUPA SUIZA 2026](#sección-e-estado-real-del-catálogo-tupa-suiza-2026)
6. [SECCIÓN F: ESTADO DE GENERACIÓN DE CUT, REGISTRO, DERIVACIONES Y SEGUIMIENTO](#sección-f-estado-de-generación-de-cut-registro-derivaciones-y-seguimiento)
7. [SECCIÓN G: PRUEBAS REALIZADAS, RESULTADOS Y LIMITACIONES](#sección-g-pruebas-realizadas-resultados-y-limitaciones)
8. [SECCIÓN H: PROBLEMAS PENDIENTES PRIORIZADOS POR GRAVEDAD](#sección-h-problemas-pendientes-priorizados-por-gravedad)
9. [SECCIÓN I: RECOMENDACIONES PARA SIGUIENTE FASE DE REPARACIÓN FUNCIONAL](#sección-i-recomendaciones-para-siguiente-fase-de-reparación-funcional)
10. [SECCIÓN J: CONFIRMACIÓN DE PRESERVACIÓN DE ESQUEMA, DATOS Y ARQUITECTURA](#sección-j-confirmación-de-preservación-de-esquema-datos-y-arquitectura)

---

## SECCIÓN A: ESTADO INICIAL DE GIT Y DE LOS SERVICIOS

### A.1. Control de Versiones Git
* **Rama:** `B_JACOBO` (verificada con `git rev-parse --abbrev-ref HEAD`).
* **HEAD Commit:** `bf30d8a0c85e266a86381fb10bf3740a8451c032` (`refactor: alinear prototipo a PostgreSQL 5433 y retirar contenedores de prueba`).
* **Estado de archivos en el árbol de trabajo:**
  * No se ha realizado ningún commit ni cambio de rama.
  * La rama institucional de referencia `main` se encuentra 100% intacta.
  * Los cambios modificados preexistentes en `git diff --stat` corresponden a la consolidación del prototipo de nueve módulos.
  * Los tres archivos tocados o creados recientemente corresponden de manera exclusiva a herramientas de auditoría y documentación:
    1. `scratch/audit_tupa_detailed.mjs` (script de diagnóstico).
    2. `scratch/inspect_full_schema.mjs` (script de inspección de esquema en solo lectura).
    3. `docs/INFORME_DIAGNOSTICO_MESA_DE_PARTES_FASE1.md` (informe técnico).
    Ninguno de ellos es un archivo funcional de la aplicación ni altera el código de producción.

### A.2. Servicios Locales y Contenedores
* **Contenedores Docker:**
  * `sigd-postgres-1` (puerto `5433->5432`): `healthy`. Alberga `sigd_prueba` (base del docente, intacta) y `sigd_jacobo_demo` (base del prototipo consolidado).
  * `sigd-redis-1` (puerto `6379->6379`, DB 1): `healthy`.
  * `sigd-minio-1` (puerto `9000` S3 API, `9001` Consola): `healthy`. Bucket: `sigd-sandbox-e2e`.
* **Procesos Locales Desacoplados:**
  * Backend Node.js / Express: PID `27572` en puerto `3008` (`/health` HTTP 200 UP, `/ready` HTTP 200 READY).
  * Frontend Vite / React: PID `9240` en puerto `5178` (`GET /` HTTP 200 OK).

---

## SECCIÓN B: CAUSA RAÍZ DE CADA ERROR ENCONTRADO

Se investigaron y aislaron los dos errores reportados de forma totalmente independiente:

### B.1. Error 1: `column "descripcion" does not exist` en `scratch/audit_tupa_detailed.mjs` (línea 30)

#### 1. Consulta exacta que falló:
```sql
SELECT requisito_id, orden, descripcion, obligatorio, tipo_documento_id
FROM sigd_doc.requisito
WHERE tipo_tramite_id = $1
ORDER BY orden ASC;
```

#### 2. Causa raíz técnica:
El autor del script de auditoría supuso incorrectamente los nombres de columnas y el modelo relacional de la tabla `sigd_doc.requisito`:
1. Supuso que el texto del requisito se llamaba `descripcion`. En la definición formal del esquema (migración `04_sigd_doc.sql`), la columna se denomina **`denominacion`** (`VARCHAR(300) NOT NULL`).
2. Supuso que existía una clave foránea directa `tipo_documento_id` dentro de `sigd_doc.requisito`. En la arquitectura formal de la base de datos, la relación entre requisitos y tipos documentales es de cardinalidad $M:N$, implementada mediante la tabla intermedia **`sigd_doc.tipo_documento_requisito`** con las columnas `(id_relacion, requisito_id, tipo_documental_id, condicion_json_pointer)`.

#### 3. Verificación de la base de datos conectada:
Se verificó mediante la función del sistema `SELECT current_database(), current_user, inet_server_port()`:
* Base conectada: **`sigd_jacobo_demo`**
* Usuario: **`sigd_jacobo_user`**
* Puerto: **`5432`** (mapeado a `5433` en el host).
La conexión **apunta fehacientemente a la base del prototipo**, no a otra instancia.

#### 4. Impacto en el código funcional de la aplicación:
**EL CÓDIGO FUNCIONAL NO PADECE ESTE ERROR.**  
Se inspeccionó [`backend/src/domains/tramicore/radicacionVirtual.service.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/radicacionVirtual.service.ts#L210-L219). La consulta que realiza el backend institucional en `resolverTipoDocumental` es:
```sql
SELECT td.tipo_documental_id,
       bool_or(dr.condicion_json_pointer IS NOT NULL) AS requiere_condicion
  FROM sigd_doc.requisito r
  JOIN sigd_doc.tipo_documento_requisito dr ON dr.requisito_id = r.requisito_id
  JOIN sigd_doc.tipo_documento td ON td.tipo_documental_id = dr.tipo_documental_id
 WHERE r.tipo_tramite_id = $1::uuid AND td.vigente = TRUE
 GROUP BY td.tipo_documental_id;
```
El backend funcional **no consulta `r.descripcion`**, sino que une correctamente `sigd_doc.requisito` con `sigd_doc.tipo_documento_requisito` y `sigd_doc.tipo_documento`. El error estuvo confinado 100% al script de prueba `scratch/audit_tupa_detailed.mjs`.

---

### B.2. Error 2: `SQLSTATE 42P01: relation "sigd_tra.correlativo_anual" does not exist`

#### 1. Consulta exacta que falló:
```sql
SELECT anio_fiscal, ultimo_numero FROM sigd_tra.correlativo_anual;
```

#### 2. Causa raíz técnica:
1. La tabla `sigd_tra.correlativo_anual` **nunca ha existido** ni en el esquema original del docente ni en las 7 migraciones de `backend/migraciones/`.
2. El script ad-hoc previo (`scratch/diagnose_mesadepartes.mjs`) asumió una nomenclatura simplista (`correlativo_anual`).
3. La arquitectura canónica del docente implementa el correlativo mediante la tabla **`sigd_tra.secuencia_anual_cut`** (`anio_fiscal INT PRIMARY KEY, ultimo_correlativo BIGINT, creado_en TIMESTAMPTZ`) y la función PL/pgSQL atómica con bloqueo pesimista **`sigd_tra.generar_cut_expediente(p_anio INT)`**, expuesta canónicamente vía **`sigd_tra.fn_generar_cut(p_anio INT)`**.

#### 3. Impacto en el código funcional:
**CERO IMPACTO.** Tanto [`CutService.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/cut.service.ts) como [`VentanillaPresencialService.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/ventanillaPresencial.service.ts) invocan `sigd_tra.fn_generar_cut` y `sigd_tra.generar_cut_expediente` respectivamente. La tabla real `sigd_tra.secuencia_anual_cut` existe, contiene el año `2026` con `ultimo_correlativo = 5`, y está operativa con bloqueo pesimista `FOR UPDATE`.

---

## SECCIÓN C: ARCHIVOS MODIFICADOS Y JUSTIFICACIÓN DE CADA CAMBIO

En estricto cumplimiento de la regla de no modificar archivos funcionales ni el esquema de base de datos en esta fase:

1. **`scratch/audit_tupa_detailed.mjs` (Script de Auditoría):**
   - *Modificación:* Se corrigió la consulta SQL sustituyendo la columna inexistente `r.descripcion` por `r.denominacion`, y se sustituyó la suposición de `tipo_documento_id` uniendo correctamente con `sigd_doc.tipo_documento_requisito` y `sigd_doc.tipo_documento`.
   - *Justificación:* Permitir que la herramienta de diagnóstico ejecute la auditoría completa de los 22 procedimientos en modo de solo lectura.
2. **`scratch/inspect_full_schema.mjs` (Herramienta de Inspección de Metadatos):**
   - *Modificación:* Archivo nuevo en `scratch/` que consulta `information_schema.columns` y `table_constraints` bajo bandera `default_transaction_read_only=on`.
   - *Justificación:* Extraer evidencia irrefutable del diccionario de datos de PostgreSQL sin ejecutar DDL ni DML.
3. **`docs/INFORME_DIAGNOSTICO_MESA_DE_PARTES_FASE1.md` (Documentación):**
   - *Modificación:* Documento técnico con los hallazgos de la auditoría.
   - *Justificación:* Entregable requerido para la trazabilidad del prototipo en `B_JACOBO`.

> **Archivos funcionales modificados en esta sesión:** CERO (0).  
> **Migraciones modificadas:** CERO (0).  
> **Tablas modificadas/alteradas:** CERO (0).

---

## SECCIÓN D: CONSULTAS EJECUTADAS Y EVIDENCIAS DE LOS RESULTADOS

Todas las consultas fueron ejecutadas con el flag de conexión `-c default_transaction_read_only=on`.

### D.1. Verificación del Diccionario de Datos (`information_schema.columns`)

```
Tabla: sigd_doc.tipo_tramite_tupa (9 columnas)
├── tipo_tramite_id (uuid, NOT NULL, DEFAULT gen_random_uuid()) [PK]
├── codigo (character varying(30), NOT NULL, UNIQUE)
├── denominacion (character varying(300), NOT NULL)
├── descripcion (text, NULL)  <-- AQUÍ SÍ EXISTE descripcion
├── unidad_organica (character varying(160), NOT NULL)
├── plazo_dias (smallint, NOT NULL, DEFAULT 30)
├── silencio_administrativo (character varying(30), NOT NULL, DEFAULT 'POSITIVO')
├── base_legal (character varying(500), NULL)
└── vigente (boolean, NOT NULL, DEFAULT true)

Tabla: sigd_doc.requisito (6 columnas)
├── requisito_id (uuid, NOT NULL, DEFAULT gen_random_uuid()) [PK]
├── tipo_tramite_id (uuid, NOT NULL) [FK -> sigd_doc.tipo_tramite_tupa]
├── codigo (character varying(30), NOT NULL)
├── denominacion (character varying(300), NOT NULL)  <-- LA COLUMNA REAL ES denominacion
├── obligatorio (boolean, NOT NULL, DEFAULT true)
└── orden (smallint, NOT NULL, DEFAULT 0)

Tabla: sigd_doc.tipo_documento_requisito (4 columnas)
├── id_relacion (uuid, NOT NULL, DEFAULT gen_random_uuid()) [PK]
├── requisito_id (uuid, NOT NULL) [FK -> sigd_doc.requisito ON DELETE CASCADE]
├── tipo_documental_id (uuid, NOT NULL) [FK -> sigd_doc.tipo_documento]
└── condicion_json_pointer (character varying(200), NULL)

Tabla: sigd_tra.secuencia_anual_cut (3 columnas)
├── anio_fiscal (integer, NOT NULL) [PK]
├── ultimo_correlativo (bigint, NOT NULL, DEFAULT 0)
└── creado_en (timestamp with time zone, NOT NULL, DEFAULT now())
```

---

## SECCIÓN E: ESTADO REAL DEL CATÁLOGO TUPA SUIZA 2026

Al ejecutar `scratch/audit_tupa_detailed.mjs` contra `sigd_jacobo_demo`, se obtuvieron los siguientes resultados certificados:

* **Total de registros en `sigd_doc.tipo_tramite_tupa`:** 22
* **Procedimientos inactivos (`vigente = FALSE`):** 3 (`TUPA-01`, `TUPA-02`, `TUPA-03`). Son registros semilla iniciales que fueron reemplazados por el catálogo oficial Suiza 2026.
* **Procedimientos vigentes (`vigente = TRUE`):** 19 procedimientos.

### Matriz de Clasificación Documental de los 19 Procedimientos Vigentes:

| # | Código | Denominación del Procedimiento | Requisitos en DB | Tipos Doc. Vinculados | Estado en MPV | Motivo / Causa Técnica |
|:---:|:---|:---|:---:|:---:|:---:|:---|
| 1 | `SUZ26-031` | Constancia de No Adeudar — titulación | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 2 | `SUZ26-034` | Expedición de Título | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 3 | `SUZ26-035` | Certificado de Estudios Superiores (6 sem.) | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 4 | `SUZ26-036` | Visación de Certificado de Estudios | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 5 | `SUZ26-044` | Modificación de Datos del Título | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 6 | `SUZ26-045` | Derecho de duplicado de Título | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 7 | `SUZ26-050` | Derecho de Reincorporación (Reingreso) | 0 | 0 | **FALLARÍA** | `CLASIFICACION_DOCUMENTAL_NO_CONFIGURADA` (0 requisitos) |
| 8 | `SUZ26-051` | Constancia de Egresado | 0 | 0 | **FALLARÍA** | `CLASIFICACION_DOCUMENTAL_NO_CONFIGURADA` (0 requisitos) |
| 9 | `SUZ26-052` | Certificado de Bachillerato | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 10 | `SUZ26-053` | Constancias — de título, estudios o matrícula | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 11 | `SUZ26-054` | Convalidación entre Planes de Estudios | 0 | 0 | **FALLARÍA** | `CLASIFICACION_DOCUMENTAL_NO_CONFIGURADA` (0 requisitos) |
| 12 | `SUZ26-055` | Convalidación por Unidades de Competencia | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 13 | `SUZ26-056` | Devolución de Expediente | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 14 | `SUZ26-063` | Reserva de Matrícula — ingresantes | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 15 | `SUZ26-064` | Licencia de Estudios — estudiantes antiguos | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 16 | `SUZ26-065` | Traslado Interno | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |
| 17 | `SUZ26-066` | Traslado Externo | 2 | 2 | **FALLARÍA** | `CLASIFICACION_DOCUMENTAL_AMBIGUA` (2 tipos: Comprobante y FUT) |
| 18 | `SUZ26-068` | Acceso a la Información Pública | 1 | 1 | **LISTO** | Configuración unívoca: FUT |
| 19 | `SUZ26-072` | Titulación de Otros Institutos Tecnológicos | 1 | 1 | **LISTO** | Configuración unívoca: Comprobante de Pago |

* **Total operativos en MPV:** 15 de 19 (78.9%).
* **Total operativos en Ventanilla Presencial:** 19 de 19 (100%), ya que el operador selecciona directamente el tipo documental en UI.

---

## SECCIÓN F: ESTADO DE GENERACIÓN DE CUT, REGISTRO, DERIVACIONES Y SEGUIMIENTO

### F.1. Generación de CUT y Correlativos
* Tabla `sigd_tra.secuencia_anual_cut`:
  * `anio_fiscal`: `2026`
  * `ultimo_correlativo`: `5`
* Función generadora: `sigd_tra.fn_generar_cut(2026)` -> `EXP-2026-000006` garantizado para el próximo expediente.
* Bloqueo pesimista: `SELECT ... FOR UPDATE` sobre la fila del año, serializando solicitudes concurrentes sin saltos ni duplicaciones.

### F.2. Expedientes y Asientos Registrales
* Registros existentes en `sigd_tra.expediente` y `sigd_doc.expediente`:
  1. `EXP-2026-000001` (DNI: `72145896`, Asiento: `10001`, Estado: `REGISTRADO`)
  2. `EXP-2026-000003` (DNI: `72145896`, Asiento: `10002`, Estado: `REGISTRADO`)
  3. `EXP-2026-000004` (DNI: `00000050`, Asiento: `10003`, Estado: `REGISTRADO`)
  4. `EXP-2026-000005` (DNI: `00000050`, Asiento: `10004`, Estado: `REGISTRADO`)
  5. `EXP-2026-000142` (Expediente oficial RD-0142-2026, Estado: `RESUELTO`)
* Asientos registrales (`sigd_tra.asiento_registro`): Correlativos continuos del `10001` al `10004` vía secuencia institucional `sigd_tra.seq_asiento_numero_registro`.

### F.3. Trazabilidad y Derivaciones (RutaDoc)
* Tabla `sigd_rut.movimiento_tramite`: Contiene 4 movimientos oficiales registrados.
* Tabla `sigd_rut.estado_actual_expediente`:
  * Los 4 expedientes de trámite (`EXP-2026-000001`, `000003`, `000004` y `000005`) se encuentran en estado **`DERIVADO`** bajo el evento **`DERIVACION`**.
  * El expediente `EXP-2026-000142` se encuentra en **`EN_CALIFICACION`** con evento `INICIAR_CALIFICACION`.

### F.4. Consulta Pública por CUT
* Endpoint `GET /api/v1/tramites/consulta-publica/:cut`:
  * Probado en vivo con `EXP-2026-000001` y `EXP-2026-000004`.
  * Retorna HTTP 200 con CUT, estado del trámite, fechas legales LPAG, hash SHA-256 del documento adjunto y enmascaramiento estricto de datos personales conforme a la Ley N° 29733 (ej. `72***896`, `C***** V******`).

---

## SECCIÓN G: PRUEBAS REALIZADAS, RESULTADOS Y LIMITACIONES

### G.1. Pruebas Realizadas
1. **Auditoría de solo lectura del catálogo TUPA:** Ejecución completa de `scratch/audit_tupa_detailed.mjs` sin errores.
2. **Inspección de Diccionario de Datos:** Ejecución de `scratch/inspect_full_schema.mjs` sobre `information_schema.columns` y restricciones de clave foránea.
3. **Consumo de la API formal TUPA:** `GET /api/v1/tramites/tipos` probado contra el backend en el puerto `3008`, confirmando la entrega de los 19 procedimientos con código HTTP 200.
4. **Verificación del Contrato de Frontend:** Verificación de las interfaces TypeScript en `StepDocumentos.tsx` y `StepConfirmacion.tsx`, confirmando compatibilidad exacta con los datos emitidos por el backend.
5. **Verificación de Consulta Pública:** Pruebas HTTP `GET` sobre los expedientes existentes.

### G.2. Resultados
* **Aprobados:**
  - Integridad de la base de datos `sigd_jacobo_demo` (56 tablas intactas).
  - Consulta del catálogo formal TUPA (19 procedimientos vigentes).
  - Módulo de Consulta Pública por CUT con enmascaramiento legal.
  - Mecanismo de generación de CUT con bloqueo pesimista `FOR UPDATE`.
  - Módulo de Ventanilla Presencial para operadores con rol `MESA_PARTES`.
* **Fallidos / Observados:**
  - 3 procedimientos TUPA no pueden radicarse en MPV por falta de registros en `sigd_doc.requisito`.
  - 1 procedimiento TUPA (`SUZ26-066`) no puede radicarse en MPV por ambigüedad al tener 2 tipos documentales sin discriminador condicional.
* **Limitaciones:**
  - No se insertaron registros ni se ejecutó una radicación de prueba en esta fase, en estricto cumplimiento de la prohibición de escrituras sin autorización expresa.

---

## SECCIÓN H: PROBLEMAS PENDIENTES PRIORIZADOS POR GRAVEDAD

### Prioridad 1 (Alta): Configuración documental incompleta para 4 trámites en MPV
* **Descripción:** `SUZ26-050`, `SUZ26-051` y `SUZ26-054` carecen de requisitos asociados en `sigd_doc.requisito`. `SUZ26-066` tiene 2 tipos documentales vinculados sin puntero condicional.
* **Impacto:** Si un ciudadano selecciona uno de estos 4 trámites en el portal web, el sistema responde `400 Bad Request` impidiendo la radicación virtual.
* **Causa raíz:** Datos semilla TUPA con requisitos incompletos en la base de datos del prototipo.

### Prioridad 2 (Media): Feriados no laborables del año 2026 incompletos
* **Descripción:** La tabla `sigd_org.calendario_laboral` contiene únicamente 2 registros no laborables (`2026-06-24` y `2026-10-13`).
* **Impacto:** Aunque los fines de semana (sábados y domingos) son diferidos correctamente por código, los feriados cívicos nacionales del 2026 no desplazarían el horario de corte legal.

### Prioridad 3 (Baja): Limpieza de scripts obsoletos en `scratch/`
* **Descripción:** Coexisten scripts antiguos con supuestos desalineados (`correlativo_anual`, columnas inexistentes).
* **Impacto:** Posible confusión para futuros diagnósticos o auditorías externas.

---

## SECCIÓN I: RECOMENDACIONES PARA SIGUIENTE FASE DE REPARACIÓN FUNCIONAL

Para la siguiente fase (Fase 2: Remediación Controlada), se recomienda ejecutar un script DML mínimo, idempotente y de bajo impacto exclusivamente sobre `sigd_jacobo_demo`:

1. **Insertar requisitos faltantes:**
   - Asociar a `SUZ26-050`, `SUZ26-051` y `SUZ26-054` su requisito correspondiente (ej. `FUT` o `COMPROBANTE_PAGO`) en `sigd_doc.requisito` y `sigd_doc.tipo_documento_requisito`.
2. **Desambiguar `SUZ26-066`:**
   - Designar el `FUT` como tipo documental principal y asociar el `COMPROBANTE_PAGO` con puntero condicional o requisito secundario.
3. **Poblar Feriados Oficiales 2026:**
   - Cargar los feriados nacionales del calendario peruano 2026 en `sigd_org.calendario_laboral`.
4. **Prueba Controlada:**
   - Ejecutar una radicación virtual de demostración para emitir el CUT `EXP-2026-000006` y constatar la emisión del Cargo Digital oficial.

---

## SECCIÓN J: CONFIRMACIÓN DE PRESERVACIÓN DE ESQUEMA, DATOS Y ARQUITECTURA

Se certifica formalmente que durante toda la ejecución de esta auditoría:
- **NO se aplicó ningún DDL ni DML:** No se ejecutó ningún `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE` ni `TRUNCATE` sobre las bases de datos.
- **NO se modificaron archivos funcionales del backend ni del frontend:** Todos los controladores, servicios, repositorios, componentes React y rutas permanecen inalterados.
- **NO se modificaron migraciones:** Las migraciones `01` a `07` y las migraciones automáticas permanecen intactas y desactivadas.
- **NO se tocó la base del docente:** La base `sigd_prueba` permanece con sus 31 tablas originales sin alteración.
- **NO se reiniciaron ni detuvieron contenedores:** Los contenedores `sigd-postgres-1`, `sigd-redis-1` y `sigd-minio-1` se mantuvieron activos y saludables de manera ininterrumpida.
- **Se preservaron todos los cambios existentes:** La rama de trabajo continúa siendo estrictamente `B_JACOBO` en su HEAD `bf30d8a`.

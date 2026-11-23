# SIGD IESTP SUIZA 2026 — FASE 2A: PLAN DE REMEDIACIÓN TUPA Y VALIDACIÓN FUNCIONAL
## Diagnóstico Técnico, Fuentes Oficiales y Plan de Remediación de Metadatos Documentales

**Fecha:** 26 de octubre de 2026  
**Repositorio:** `C:\Users\Liz\Desktop\SIGD\SIGD`  
**Rama de trabajo:** `B_JACOBO`  
**HEAD commit:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Base de datos de trabajo:** `sigd_jacobo_demo` en PostgreSQL puerto `5433` (Docker: `sigd-postgres-1`)  
**Modo de ejecución:** Exclusivamente de Diagnóstico y Planificación (Cero DDL / Cero DML)

---

## ÍNDICE GENERAL

1. [1. FASE 1: PRESERVACIÓN Y ESTADO INICIAL](#1-fase-1-preservación-y-estado-inicial)
2. [2. FASE 2: VERIFICACIÓN DE REQUISITOS EN FUENTES OFICIALES](#2-fase-2-verificación-de-requisitos-en-fuentes-oficiales)
3. [3. FASE 3: PLAN TÉCNICO DE REPARACIÓN POR PROCEDIMIENTO](#3-fase-3-plan-técnico-de-reparación-por-procedimiento)
   - [3.1. SUZ26-050: Derecho de Reincorporación (Reingreso)](#31-suz26-050-derecho-de-reincorporación-reingreso)
   - [3.2. SUZ26-051: Constancia de Egresado](#32-suz26-051-constancia-de-egresado)
   - [3.3. SUZ26-054: Convalidación entre Planes de Estudios](#33-suz26-054-convalidación-entre-planes-de-estudios)
   - [3.4. SUZ26-066: Traslado Externo (Resolución de Ambigüedad)](#34-suz26-066-traslado-externo-resolución-de-ambigüedad)
4. [4. FASE 4: PRUEBAS FUNCIONALES PLANIFICADAS (MATRIZ E2E)](#4-fase-4-pruebas-funcionales-planificadas-matriz-e2e)
5. [5. RIESGOS, INTEGRIDAD Y PREVENCIÓN DE DUPLICADOS](#5-riesgos-integridad-y-prevención-de-duplicados)
6. [6. ESTADO DE CERTEZA: DATOS CONFIRMADOS, FALTANTES Y AUTORIZACIONES REQUERIDAS](#6-estado-de-certeza-datos-confirmados-faltantes-y-autorizaciones-requeridas)

---

## 1. FASE 1: PRESERVACIÓN Y ESTADO INICIAL

### 1.1. Control de Versiones Git
* **Rama:** `B_JACOBO` (invariable y confirmada vía `git rev-parse --abbrev-ref HEAD`).
* **HEAD Commit:** `bf30d8a0c85e266a86381fb10bf3740a8451c032` (`refactor: alinear prototipo a PostgreSQL 5433 y retirar contenedores de prueba`).
* **Árbol de Trabajo:** Todos los cambios preexistentes en `git diff --stat` se conservan intactos. No se han descartado cambios, no se han ejecutado limpiezas masivas y la rama institucional `main` no ha sido alterada.
* **Archivos auxiliares incorporados en turnos recientes:**
  - `scratch/audit_tupa_detailed.mjs`: Herramienta de auditoría TUPA de solo lectura.
  - `scratch/check_tupa_details.mjs`: Script de inspección relacional TUPA.
  - `scratch/inspect_full_schema.mjs`: Script de extracción de metadatos de PostgreSQL.
  - `docs/INFORME_DIAGNOSTICO_MESA_DE_PARTES_FASE1.md` y `docs/INFORME_CAUSA_RAIZ_Y_SOLUCION_AUDITORIA_TUPA.md`: Documentos técnicos de diagnóstico previo.

### 1.2. Infraestructura y Procesos Activos
* **Contenedores Docker:**
  - `sigd-postgres-1` (puerto `5433->5432`): `healthy`. Bases: `sigd_prueba` (docente, intacta) y `sigd_jacobo_demo` (prototipo).
  - `sigd-redis-1` (puerto `6379->6379`, DB 1): `healthy`.
  - `sigd-minio-1` (puerto `9000` S3 API, `9001` Consola): `healthy`. Bucket: `sigd-sandbox-e2e`.
* **Procesos Locales Desacoplados:**
  - Backend Express: PID `27572` en `http://127.0.0.1:3008` (`/health` HTTP 200 UP).
  - Frontend Vite: PID `9240` en `http://127.0.0.1:5178` (`GET /` HTTP 200 OK).

---

## 2. FASE 2: VERIFICACIÓN DE REQUISITOS EN FUENTES OFICIALES

Se realizó un cotejo exhaustivo de la documentación oficial y fuentes de datos presentes en el repositorio:
1. **Archivo de carga institucional:** [`backend/carga_tupa_suiza_2026.sql`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/carga_tupa_suiza_2026.sql), cuya fuente documental certificada es:
   - Documento: `TUPA_2026_IESTP_Suiza.pdf` (6 páginas).
   - SHA-256 de la fuente: `377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622`.
2. **Matriz de Reglas TUPA y Admisibilidad:** [`backend/docs/03_docucore/02_reglas_tupa_admisibilidad_v2.md`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/docs/03_docucore/02_reglas_tupa_admisibilidad_v2.md) (versión 2.3, aprobada por el analista de requisitos de DocuCore).
3. **Catálogo Informativo Suiza 2026:** [`frontend/src/data/tupaSuiza2026.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/data/tupaSuiza2026.ts) (75 conceptos institucionales).

### Cotejo de los Cuatro Procedimientos Observados:

| Código | Denominación Institucional | Página PDF | Rubro Institucional | Requisitos y Pagos Textuales en Fuente Oficial | Plazo Oficial en Fuente | Silencio en Fuente |
|:---:|:---|:---:|:---|:---|:---:|:---:|
| **`SUZ26-050`** | Derecho de Reincorporación (Reingreso) | Pág. 5 | Otros Servicios Académicos | "Pago en el área de Tesorería. Derecho de pago: S/ 300.00." | No especificado | No especificado |
| **`SUZ26-051`** | Constancia de Egresado | Pág. 5 | Otros Servicios Académicos | "Pago del derecho en Tesorería. Derecho de pago: S/ 31.00." | No especificado | No especificado |
| **`SUZ26-054`** | Convalidación entre Planes de Estudios | Pág. 5 | Otros Servicios Académicos | "Pago del derecho en Tesorería. Derecho de pago: S/ 46.50 (0.84 % UIT vigente)." | No especificado | No especificado |
| **`SUZ26-066`** | Traslado Externo | Pág. 5 | Otros Servicios Académicos | "Solicitud en FUT dirigida al Director, vacante en la carrera, Resolución Directoral — Secretaría Académica, pago del derecho en Tesorería y comprobante de pago. Derecho de pago: S/ 412.00 (7.48 % UIT vigente)." | No especificado | No especificado |

> [!NOTE]
> **Hallazgo fundamental de la fuente:**
> En los tres procedimientos `SUZ26-050`, `SUZ26-051` y `SUZ26-054`, la fuente oficial exige expresamente el **pago del derecho en Tesorería**.  
> El autor del archivo de carga `carga_tupa_suiza_2026.sql` dejó anotado en la línea 10:
> `-- No se agregan requisitos a SUZ26-050/051/054 ni se resuelve por inferencia SUZ26-066.`
> Dicha omisión fue deliberada para no "inferir" la palabra "comprobante" donde el PDF decía únicamente "pago en Tesorería". Sin embargo, en el diseño del sistema, un pago en Tesorería se acredita documentalmente mediante el **Comprobante de Pago**.

---

## 3. FASE 3: PLAN TÉCNICO DE REPARACIÓN POR PROCEDIMIENTO

### Invariante de Arquitectura en `radicacionVirtual.service.ts`
En [`backend/src/domains/tramicore/radicacionVirtual.service.ts:203-231`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/radicacionVirtual.service.ts#L203-L231), el método `resolverTipoDocumental` exige de manera estricta:
1. `datos.documentos.length === 1` (la radicación virtual acepta un único archivo adjunto consolidado).
2. `resultado.rows.length === 1` (el procedimiento debe mapear exactamente a 1 tipo documental vigente).
3. `!resultado.rows[0].requiere_condicion` (`condicion_json_pointer` debe ser nulo).

El catálogo formal de tipos documentales en `sigd_doc.tipo_documento` cuenta únicamente con dos tipos oficiales vigentes:
- `COMPROBANTE_PAGO` (`tipo_documental_id: b7f37bde-ec45-49d0-b28e-fc2ad4341b60`)
- `FUT` (`tipo_documental_id: dc156983-a824-418a-835e-5a7e104c9ca5`)

---

### 3.1. SUZ26-050: Derecho de Reincorporación (Reingreso)
* **Requisito Oficial:** Pago del derecho de reincorporación en Tesorería (S/ 300.00).
* **Fuente:** `TUPA_2026_IESTP_Suiza.pdf`, página 5.
* **Tipo Documental Asociado:** `COMPROBANTE_PAGO` (`b7f37bde-ec45-49d0-b28e-fc2ad4341b60`).
* **Condición:** Ninguna (`condicion_json_pointer: NULL`).
* **Registros Propuestos (DML para Fase de Implementación):**
  ```sql
  -- 1. Insertar requisito en sigd_doc.requisito
  INSERT INTO sigd_doc.requisito (requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden)
  VALUES (
    '8e1467a1-2996-48cb-8f19-a9a3b6e70050',
    '65950f60-be67-42c7-8a76-8bb0698f7868',
    'COMPROBANTE_PAGO',
    'Comprobante de Pago (mención documental; pago del derecho en Tesorería S/ 300.00)',
    FALSE,
    0
  ) ON CONFLICT (tipo_tramite_id, codigo) DO NOTHING;

  -- 2. Vincular con tipo documental en sigd_doc.tipo_documento_requisito
  INSERT INTO sigd_doc.tipo_documento_requisito (id_relacion, requisito_id, tipo_documental_id, condicion_json_pointer)
  VALUES (
    '4a7e93c1-b0e2-45bb-b5e1-7d19e0050001',
    '8e1467a1-2996-48cb-8f19-a9a3b6e70050',
    'b7f37bde-ec45-49d0-b28e-fc2ad4341b60',
    NULL
  ) ON CONFLICT (requisito_id, tipo_documental_id) DO NOTHING;
  ```

---

### 3.2. SUZ26-051: Constancia de Egresado
* **Requisito Oficial:** Pago del derecho de constancia en Tesorería (S/ 31.00).
* **Fuente:** `TUPA_2026_IESTP_Suiza.pdf`, página 5.
* **Tipo Documental Asociado:** `COMPROBANTE_PAGO` (`b7f37bde-ec45-49d0-b28e-fc2ad4341b60`).
* **Condición:** Ninguna (`condicion_json_pointer: NULL`).
* **Registros Propuestos (DML para Fase de Implementación):**
  ```sql
  -- 1. Insertar requisito en sigd_doc.requisito
  INSERT INTO sigd_doc.requisito (requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden)
  VALUES (
    '8e1467a1-2996-48cb-8f19-a9a3b6e70051',
    '5fc07beb-8d3e-458d-af3e-1e040928f711',
    'COMPROBANTE_PAGO',
    'Comprobante de Pago (mención documental; pago del derecho en Tesorería S/ 31.00)',
    FALSE,
    0
  ) ON CONFLICT (tipo_tramite_id, codigo) DO NOTHING;

  -- 2. Vincular con tipo documental en sigd_doc.tipo_documento_requisito
  INSERT INTO sigd_doc.tipo_documento_requisito (id_relacion, requisito_id, tipo_documental_id, condicion_json_pointer)
  VALUES (
    '4a7e93c1-b0e2-45bb-b5e1-7d19e0051001',
    '8e1467a1-2996-48cb-8f19-a9a3b6e70051',
    'b7f37bde-ec45-49d0-b28e-fc2ad4341b60',
    NULL
  ) ON CONFLICT (requisito_id, tipo_documental_id) DO NOTHING;
  ```

---

### 3.3. SUZ26-054: Convalidación entre Planes de Estudios
* **Requisito Oficial:** Pago del derecho de convalidación en Tesorería (S/ 46.50).
* **Fuente:** `TUPA_2026_IESTP_Suiza.pdf`, página 5.
* **Tipo Documental Asociado:** `COMPROBANTE_PAGO` (`b7f37bde-ec45-49d0-b28e-fc2ad4341b60`).
* **Condición:** Ninguna (`condicion_json_pointer: NULL`).
* **Registros Propuestos (DML para Fase de Implementación):**
  ```sql
  -- 1. Insertar requisito en sigd_doc.requisito
  INSERT INTO sigd_doc.requisito (requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden)
  VALUES (
    '8e1467a1-2996-48cb-8f19-a9a3b6e70054',
    '1c39704c-1b93-4dfd-a064-76145939028e',
    'COMPROBANTE_PAGO',
    'Comprobante de Pago (mención documental; pago del derecho en Tesorería S/ 46.50)',
    FALSE,
    0
  ) ON CONFLICT (tipo_tramite_id, codigo) DO NOTHING;

  -- 2. Vincular con tipo documental en sigd_doc.tipo_documento_requisito
  INSERT INTO sigd_doc.tipo_documento_requisito (id_relacion, requisito_id, tipo_documental_id, condicion_json_pointer)
  VALUES (
    '4a7e93c1-b0e2-45bb-b5e1-7d19e0054001',
    '8e1467a1-2996-48cb-8f19-a9a3b6e70054',
    'b7f37bde-ec45-49d0-b28e-fc2ad4341b60',
    NULL
  ) ON CONFLICT (requisito_id, tipo_documental_id) DO NOTHING;
  ```

---

### 3.4. SUZ26-066: Traslado Externo (Resolución de Ambigüedad)

#### Diagnóstico del Conflicto Actual
En la base de datos `sigd_jacobo_demo`, `SUZ26-066` tiene actualmente:
- Requisito `694dc8b4-6e4d-438e-bea4-b7b36060875a` (`COMPROBANTE_PAGO`) -> vinculado a `b7f37bde-ec45-49d0-b28e-fc2ad4341b60` (`COMPROBANTE_PAGO`).
- Requisito `d5e091d3-5c9a-4484-99e0-a03a6377cc1e` (`FUT`) -> vinculado a `dc156983-a824-418a-835e-5a7e104c9ca5` (`FUT`).

Al consultar `resolverTipoDocumental`:
```sql
SELECT td.tipo_documental_id, bool_or(dr.condicion_json_pointer IS NOT NULL) AS requiere_condicion
  FROM sigd_doc.requisito r
  JOIN sigd_doc.tipo_documento_requisito dr ON dr.requisito_id = r.requisito_id
  JOIN sigd_doc.tipo_documento td ON td.tipo_documental_id = dr.tipo_documental_id
 WHERE r.tipo_tramite_id = '6c15cb58-e78f-4b00-b709-bd008ab98d47'::uuid AND td.vigente = TRUE
 GROUP BY td.tipo_documental_id;
```
La consulta devuelve **dos filas**. El backend aplica `resultado.rows.length !== 1` y arroja `400 Bad Request` (`CLASIFICACION_DOCUMENTAL_AMBIGUA`).

#### Solución Técnica Armónica
1. **Fundamento:** En los otros 14 procedimientos con derecho de pago en Tesorería del TUPA Suiza 2026 (`SUZ26-031`, `034`, `035`, `036`, `044`, `045`, `052`, `053`, `055`, `056`, `063`, `064`, `065`, `072`), el único tipo documental vinculado en `sigd_doc.tipo_documento_requisito` es `COMPROBANTE_PAGO`. El FUT es la solicitud electrónica que el usuario diligencia en el asistente web.
2. **Propuesta:** Conservar el requisito `FUT` en `sigd_doc.requisito` como metadato informativo institucional (para que conste que el TUPA menciona el FUT), pero **retirar la relación documental activa de `FUT` en `sigd_doc.tipo_documento_requisito`**, dejando como único tipo documental exigible al adjunto el `COMPROBANTE_PAGO`.
3. **Registro a Modificar (DML para Fase de Implementación):**
  ```sql
  -- Eliminar la relación ambigua de FUT para SUZ26-066 en tipo_documento_requisito
  DELETE FROM sigd_doc.tipo_documento_requisito
   WHERE id_relacion = 'aa27e318-abf3-4227-851b-d4f6069461e3';
  ```
  *(Nota: Se conserva el registro `d5e091d3-5c9a-4484-99e0-a03a6377cc1e` en `sigd_doc.requisito`, garantizando que la información del FUT no se pierde).*

---

## 4. FASE 4: PRUEBAS FUNCIONALES PLANIFICADAS (MATRIZ E2E)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          MATRIZ DE PRUEBAS FUNCIONALES E2E                             │
├───────┬───────────────────────────────┬─────────────────┬──────────────┬───────────────┤
│ Paso  │ Descripción de la Prueba      │ Canal / Endpoint│ Estado Actual│ Requiere DML  │
├───────┼───────────────────────────────┼─────────────────┼──────────────┼───────────────┤
│ P-01  │ Consulta de Catálogo TUPA     │ GET /tipos      │ APROBADA     │ NO            │
│ P-02  │ Selección de Trámite en UI    │ /tramite (Wiz)  │ APROBADA     │ NO            │
│ P-03  │ Generación Presigned URL MinIO│ POST /storage   │ APROBADA     │ NO            │
│ P-04  │ Carga de PDF y Hash SHA-256   │ MinIO (:9000)   │ APROBADA     │ NO            │
│ P-05  │ Validación Anti-Suplantación  │ JWT vs DNI      │ APROBADA     │ NO            │
│ P-06  │ Radicación SUZ26-035 (Actual) │ POST /radicacion│ APROBADA     │ SÍ (CUT 5)    │
│ P-07  │ Radicación Trámite Remediado  │ POST /radicacion│ PROPUESTA    │ SÍ (CUT 6)    │
│ P-08  │ Emisión Cargo Digital con QR  │ Respuesta 201   │ APROBADA     │ NO            │
│ P-09  │ Derivación en RutaDoc         │ POST /derivacion│ APROBADA     │ SÍ (FSM)      │
│ P-10  │ Consulta Pública por CUT      │ GET /consulta   │ APROBADA     │ NO            │
└───────┴───────────────────────────────┴─────────────────┴──────────────┴───────────────┘
```

### Detalle de las Pruebas Propuestas para la Fase de Validación:
1. **Prueba E2E-REM-01: Radicación Virtual de `SUZ26-050` (Reincorporación)**
   - Autenticación con `ciudadano.demo` (DNI: `00000050`).
   - Carga de archivo PDF firmado de comprobante a MinIO.
   - Envío a `POST /api/v1/tramites/radicacion-virtual`.
   - Criterio de éxito: Código HTTP `201 Created`, asignación del CUT correlativo `EXP-2026-000006`, cargo digital con hash y QR emitidos, asiento de registro generado.
2. **Prueba E2E-REM-02: Radicación Virtual de `SUZ26-066` (Traslado Externo)**
   - Envío tras la desambiguación.
   - Criterio de éxito: Código HTTP `201 Created` sin error `CLASIFICACION_DOCUMENTAL_AMBIGUA`.
3. **Prueba E2E-REM-03: Derivación a Unidad Orgánica (RutaDoc)**
   - Envío a `POST /api/v1/rutadoc/derivaciones` desde la bandeja de entrada hacia la Dirección Académica.
   - Criterio de éxito: Transición a estado `DERIVADO` registrada en `sigd_rut.movimiento_tramite`.
4. **Prueba E2E-REM-04: Consulta Pública Externa**
   - Invocación de `GET /api/v1/tramites/consulta-publica/EXP-2026-000006`.
   - Criterio de éxito: Datos visibles con enmascaramiento legal (Ley N° 29733) y fecha legal computada por corte LPAG.

---

## 5. RIESGOS, INTEGRIDAD Y PREVENCIÓN DE DUPLICADOS

1. **Prevención de Duplicados:**
   - La tabla `sigd_doc.requisito` cuenta con la restricción de unicidad:
     `CONSTRAINT uq_requisito_tramite_codigo UNIQUE (tipo_tramite_id, codigo);`
     Cualquier intento de insertar un requisito duplicado es rechazado a nivel de motor de base de datos (`ON CONFLICT DO NOTHING`).
   - La tabla `sigd_doc.tipo_documento_requisito` cuenta con:
     `CONSTRAINT uq_tipo_documento_requisito UNIQUE (requisito_id, tipo_documental_id);`
2. **Aislamiento de la Base del Docente:**
   - Todas las operaciones propuestas se limitan estrictamente a la base de datos `sigd_jacobo_demo`.
   - La base del docente `sigd_prueba` no se toca ni se referencia.
3. **Rollback Transaccional:**
   - Las sentencias de inserción se empaquetarán en un bloque transaccional atómico:
     `BEGIN; ... COMMIT;` con `SET LOCAL statement_timeout = '10s'`. Ante cualquier fallo o inconsistencia de UUID, se ejecutará un rollback inmediato.

---

## 6. ESTADO DE CERTEZA: DATOS CONFIRMADOS, FALTANTES Y AUTORIZACIONES REQUERIDAS

### 6.1. Datos Confirmados (100% Verificados)
* La arquitectura de la aplicación, el generador de CUT (`fn_generar_cut`), el almacenamiento S3 (MinIO), el cálculo de corte LPAG y la consulta pública están **100% operativos**.
* 15 de los 19 procedimientos vigentes funcionan hoy sin necesidad de ninguna modificación.
* Los importes de las tasas y los requisitos textuales de `SUZ26-050`, `SUZ26-051`, `SUZ26-054` y `SUZ26-066` han sido extraídos de forma fiel del documento `TUPA_2026_IESTP_Suiza.pdf` (pág. 5).
* La causa del bloqueo en los 4 procedimientos es la falta del vínculo en `sigd_doc.tipo_documento_requisito` hacia el tipo documental `COMPROBANTE_PAGO`.

### 6.2. Información Faltante
* **Plazos oficiales específicos:** La fuente `TUPA_2026_IESTP_Suiza.pdf` no desglosa días hábiles para cada concepto académico (se aplican los 30 días hábiles por defecto supletorio del Art. 143 del TUO de la Ley N° 27444).
* **Feriados nacionales adicionales de 2026:** Para que el corte LPAG proyecte con exactitud feriados como Semana Santa o Fiestas Patrias, la tabla `sigd_org.calendario_laboral` requiere el catálogo cívico completo del año 2026 (actualmente solo tiene 2 fechas).

### 6.3. Autorizaciones Requeridas para Pasar a Implementación
Para ejecutar la remediación en la siguiente fase se requiere la autorización formal del usuario para:
1. **Ejecutar las 3 inserciones DML** en `sigd_doc.requisito` y `sigd_doc.tipo_documento_requisito` para `SUZ26-050`, `SUZ26-051` y `SUZ26-054` en `sigd_jacobo_demo`.
2. **Ejecutar 1 eliminación DML** del registro ambiguo en `sigd_doc.tipo_documento_requisito` para `SUZ26-066`.
3. **Ejecutar 1 radicación sintética de prueba** para verificar la emisión del CUT correlativo `EXP-2026-000006` y constatar la emisión del cargo digital.

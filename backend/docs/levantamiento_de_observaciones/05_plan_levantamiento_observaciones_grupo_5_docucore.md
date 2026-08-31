# PLAN DE TRABAJO: LEVANTAMIENTO DE OBSERVACIONES
## Grupo 5 “DocuCore” · Documentos, Requisitos y Formularios

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Institución:** IESTP "Suiza" (Pucallpa, Ucayali, Perú) — PE DSI  
**Área:** Backend  
**Líder General:** Geric · `B_GERIC` | **Sublíder:** Cristian · `B_CHRISTIAN`  
**Integrantes:** Cristian (`B_CHRISTIAN`), Azareño (`B_AZAREÑO`), Valentín (`B_VALENTIN`), Piero (`B_PIERO`)  
**Fecha:** 30 de agosto de 2026  
**Versión:** 2.0 (Fase 2 — JSON Schema, PostgreSQL JSONB y Storage S3/MinIO)  
**Ubicación:** `backend/docs/levantamiento_de_observaciones/05_plan_levantamiento_observaciones_grupo_5_docucore.md`

---

## 1. Objetivo del Levantamiento de Observaciones

Subsanar las observaciones arquitecturales identificadas en el diagnóstico senior, reemplazando el antipatrón EAV relacional por la adopción del estándar internacional **JSON Schema (Draft 2020-12) + `JSONB`** en PostgreSQL con índices GIN, diseñando la arquitectura de almacenamiento desacoplado de archivos en **MinIO / S3** con **URLs Prefirmadas (Presigned URLs)**, validación obligatoria de **Magic Bytes** (firmas binarias reales) y cálculo de hash criptográfico **SHA-256**, e incorporando la calificación administrativa oficial del catálogo TUPA.

---

## 2. Alcance Específico de las Mejoras

1. **Reingeniería de Formularios Dinámicos (JSON Schema + JSONB):**
   - Eliminar las tablas relacionales fragmentadas `campo_formulario` y `opcion_campo`.
   - Incorporar en `sigd_doc.formulario_version` la columna `schema_definicion JSONB` conteniendo la especificación estándar JSON Schema.
   - Almacenar los datos capturados del trámite en `sigd_doc.expediente_formulario_respuesta` en la columna `payload_respuestas JSONB` indexada con índice GIN (`jsonb_path_ops`).
2. **Arquitectura de Almacenamiento de Archivos Desacoplado (MinIO / S3):**
   - Eliminar el almacenamiento de archivos en el disco local del servidor web de la aplicación.
   - El backend gestionará únicamente los metadatos en `sigd_doc.documento_adjunto` (`id_adjunto`, `nombre_archivo`, `mime_type`, `tamanio_bytes`, `sha256_hash`, `s3_key`, `s3_bucket`) y emitirá *Presigned URLs* para subida/descarga directa y segura.
3. **Validación de Integridad y Seguridad Binaria:**
   - Validar los primeros bytes binarios (*Magic Bytes*) del archivo subido para verificar que coincidan con su tipo MIME declarado (impidiendo ataques de ejecutables camuflados como PDF).
   - Calcular y persistir de forma obligatoria e inmutable el hash SHA-256 de cada archivo adjunto.
4. **Catálogo TUPA con Calificación Administrativa:**
   - Asociar tipos de trámites con su calificación legal: Aprobación Automática o Evaluación Previa (con Silencio Administrativo Positivo o Negativo).

---

## 3. Límites y Criterios de Validación

- Los esquemas JSON Schema deben ser validados sintácticamente mediante **Ajv / Zod** antes de ser persistidos en la base de datos.
- El backend nunca recibirá streams pesados de archivos en memoria multipart; la carga de binarios se delega al almacenamiento de objetos MinIO/S3.
- Toda decisión técnica se etiquetará según la taxonomía oficial: `CONFIRMADO`, `PROPUESTO`, `PENDIENTE` o `EJEMPLO`.

---

## 4. Organización del Equipo y Ramas Git

| Integrante | Rama Personal | Rol / Responsabilidad en Levantamiento | Entregable Principal |
| :--- | :--- | :--- | :--- |
| **Cristian** | `B_CHRISTIAN` | Sublíder y Modelador | Modelo lógico v2.0, diccionario de datos y consolidación. |
| **Azareño** | `B_AZAREÑO` | Analista Funcional | Especificación funcional de JSON Schema y arquitectura S3 Presigned. |
| **Valentín** | `B_VALENTIN` | Analista de Requisitos TUPA | Matriz de trámites TUPA, admisibilidad y requisitos obligatorios. |
| **Piero** | `B_PIERO` | Implementador SQL y QA | Script DDL `sigd_doc` con JSONB, índices GIN y casos de prueba. |

---

## 5. Responsabilidades Individuales Detalladas

### Azareño (`B_AZAREÑO`)
- Redactar `01_analisis_json_schema_storage_s3.md` detallando:
  - Estructura de esquemas JSON Schema para formularios académicos e institucionales.
  - Flujo de generación y consumo de Presigned Upload URLs hacia MinIO/S3.
  - Protocolo de validación de Magic Bytes y cálculo de hash SHA-256.

### Valentín (`B_VALENTIN`)
- Redactar `02_reglas_tupa_admisibilidad_v2.md` documentando:
  - Catálogo de trámites TUPA y no TUPA con tipo de calificación administrativa.
  - Reglas de admisibilidad formal, formatos permitidos (PDF/A) y límites de tamaño (hasta 25MB por archivo).

### Cristian (`B_CHRISTIAN`)
- Diseñar `03_modelo_datos_docucore_v2.md` y `04_diccionario_datos_docucore_v2.md` con las entidades `tipo_documento`, `formulario_version`, `requisito_tupa`, `documento_adjunto` y `expediente_formulario_respuesta`.
- Actualizar el archivo Draw.io editable y exportar la versión PNG.
- Redactar `07_decisiones_levantamiento_docucore.md` y consolidar en `B_CHRISTIAN`.

### Piero (`B_PIERO`)
- Implementar `05_esquema_sigd_doc_jsonb.sql` en PostgreSQL 18 con:
  - Tablas simplificadas con columnas `JSONB` e índices GIN.
  - Restricción `CHECK` para hash SHA-256 de 64 caracteres hexadecimales.
- Ejecutar la suite `06_validacion_docucore_v2.md` demostrando:
  - Inserción y consulta indexada sobre payloads JSONB.
  - Validación de esquemas y rechazo de hashes inválidos.

---

## 6. Cronograma de Trabajo (Sprint de 2 Semanas)

| Hito | Actividad | Responsable | Plazo |
| :---: | :--- | :---: | :---: |
| **H1** | Análisis de JSON Schema, Storage S3 y Reglas TUPA | Azareño / Valentín | Días 1 - 4 |
| **H2** | Modelo Lógico v2.0, Diccionario y Diagrama Draw.io | Cristian | Días 5 - 7 |
| **H3** | DDL SQL con JSONB, Índices GIN y Metadatos de Storage | Piero | Días 8 - 10 |
| **H4** | Validación Técnica de Consultas JSONB y Casos de Prueba | Piero | Días 11 - 12 |
| **H5** | Integración en `B_CHRISTIAN` y PR hacia `B_GERIC` | Cristian | Días 13 - 14 |

---

## 7. Dependencias y Contratos con Otros Grupos

- **Grupo 2 (TramiCore):** DocuCore provee los metadatos de los archivos validados y sus hashes SHA-256 para que TramiCore los folie dentro del expediente.
- **Grupo 1 (RutaDoc):** DocuCore vincula los documentos de respuesta generados en el movimiento de atención final.

---

## 8. LISTA DE VERIFICACIÓN PARA LA ENTREGA DEL LEVANTAMIENTO DE OBSERVACIONES

| Estado | Criterio de Verificación Técnico y Metodológico | Responsable | Evidencia Requerida |
| :---: | :--- | :---: | :--- |
| ☐ | Se eliminó el antipatrón EAV relacional en favor de **JSON Schema (Draft 2020-12) + `JSONB`** indexado con GIN. | Azareño / Cristian | `01_analisis...md` y DDL SQL |
| ☐ | El modelo de almacenamiento de archivos está completamente desacoplado y diseñado para **MinIO / S3 Presigned URLs**. | Azareño | Diagrama de flujo en `01_analisis...md` |
| ☐ | La entidad `documento_adjunto` almacena obligatoriamente el hash criptográfico SHA-256 (64 hex) y metadatos de Storage. | Piero | Restricción en `05_esquema...sql` |
| ☐ | Se define el protocolo de validación de **Magic Bytes** para evitar ataques de subida de ejecutables camuflados. | Azareño / Valentín | Especificación en `01_analisis...md` |
| ☐ | El catálogo de tipos documentales incorpora la calificación administrativa TUPA (Silencio Positivo / Negativo). | Valentín | `02_reglas_tupa...md` |
| ☐ | Diagrama ER actualizado en Draw.io y exportado a imagen PNG. | Cristian | Archivos `.drawio` y `.png` |
| ☐ | Decisiones técnicas y justificación de migración a JSONB registradas en el log de decisiones. | Cristian | `07_decisiones_levantamiento_docucore.md` |
| ☐ | Commits individuales verificables en `B_AZAREÑO`, `B_VALENTIN`, `B_PIERO` y `B_CHRISTIAN`. | Todos | Historial de Git |
| ☐ | Sublíder integró formalmente mediante Pull Request hacia `B_GERIC`. | Cristian | PR en GitHub |

---

## 9. Resultado Esperado

Al finalizar este plan, el Grupo 5 entregará un motor de formularios dinámicos ultraveloz y moderno basado en JSON Schema, y un subsistema de almacenamiento de adjuntos seguro, escalable y listo para operar sobre MinIO/S3 en la nube.

| Líder General Backend | Sublíder Responsable DocuCore | Fecha de Conformidad |
| :---: | :---: | :---: |
| **Geric** · `B_GERIC` | **Cristian** · `B_CHRISTIAN` | Pendiente de Revisión |

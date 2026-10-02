# 01. Análisis Funcional A: Objetivo, Actores y Flujo Normal

**Sistema:** Sistema Integral de Gestión Documentaria (SIGD)

**Módulo:** Módulo de Gestión Documental y Expedientes - DocuCore

**Autor:** Valentín

**Rama Git:** `B_VALENTIN`

**Entregable:** `backend/docs/levantamiento_de_observaciones/01_analisis_json_schema_storage_s3.md`

**Destinatario:** Cristian (Modelado de Datos - `B_CHRISTIAN`)

**Fecha:** 29 de agosto de 2026

**Versión:** 3.2 — versión ejecutiva con encabezado completo

---

## 1. Objetivo del Módulo

DocuCore centraliza la **configuración y captura de trámites documentarios**. Implementa **JSON Schema** para generar formularios dinámicos en el cliente sin alterar la estructura relacional de la base de datos.

* **Configuración y Versionamiento:** Mantiene el histórico inmutable de esquemas JSON.
* **Captura y Storage:** Valida payload y gestiona la carga directa de adjuntos a MinIO/S3.
* **Preparación:** Empaqueta datos en estado `BORRADOR` antes del registro oficial.

---

## 2. Alcance

* **Cubre:** Definición de esquemas JSON, lógica condicional, carga directa de adjuntos, Magic Bytes, SHA-256, excepciones de red y flujo normal.
* **No cubre:**
* Reglas TUPA, plazos y tasas (`02_reglas_tupa_admisibilidad_v2.md`).
* Modelo ER y diccionario de datos (`B_CHRISTIAN`).
* DDL `JSONB` y políticas de buckets (`B_PIERO`).



---

## 3. Actores

* **Administrador:** Diseña y versiona los esquemas JSON.
* **Solicitante:** Llena el formulario dinámico y carga adjuntos.
* **Evaluador:** Revisa datos estructurados y requisitos.
* **Consultante:** Rol de auditoría y lectura.

---

## 4. Catálogo TUPA Académico (IESTP "Suiza")

Vinculado a la Sección 4.4 de `02_reglas_tupa_admisibilidad_v2.md`:

| Código | Trámite TUPA |
| --- | --- |
| **TUPA-001** | Constancia de Matrícula |
| **TUPA-002** | Constancia de Egresado / Notas / Estudios |
| **TUPA-003** | Certificado de Estudios |
| **TUPA-004** | Certificado Modular |
| **TUPA-005** | Convalidación de Estudios |
| **TUPA-006** | Traslado Interno / Externo |
| **TUPA-007** | Rectificación de Datos del Alumno |
| **TUPA-008** | Título Profesional Técnico |

---

## 5. Esquemas JSON y Lógica Condicional

Basado en **JSON Schema Draft 2020-12**:

* **Tipos de datos:** Cadenas, números, fechas (`format: "date"`), selecciones (`enum`) y booleanos.
* **Reglas dinámicas (`if/then/else`):** Soporta **RN-REQ-002** para activar campos según la opción elegida (ej. *Persona Jurídica* exige *RUC* y *Razón Social*).
* **Inmutabilidad:** Cada registro en `formulario_version.schema_definicion` (`JSONB`) queda congelado con su `version_id`.

---

## 6. Arquitectura de Carga Directa (MinIO/S3)

```
[Cliente] ---- 1. Datos del archivo ----> [Backend]
[Cliente] <--- 2. Presigned URL (PUT) --- [Backend]
[Cliente] ---- 3. Carga directa (PUT) --> [MinIO/S3]
[Cliente] ---- 4. Hash SHA-256 ---------> [Backend]

```

1. **Solicitud:** Cliente envía metadatos (nombre, tipo, tamaño).
2. **Presigned URL:** Backend genera ticket temporal `PUT` (expira en 15 min).
3. **Upload Directo:** Cliente sube el binario directamente a MinIO/S3.
4. **Confirmación:** Cliente notifica al backend enviando el hash SHA-256.

---

## 7. Protocolo de Validación de Adjuntos

* **7.1. Magic Bytes:** Backend verifica los primeros 512 bytes del archivo en MinIO (ej. `%PDF-`) para prevenir archivos maliciosos renombrados.
* **7.2. Integridad SHA-256:** Registro inmutable del hash de 64 caracteres hex para auditoría y no repudio.

---

## 8. Excepciones Técnicas de Storage

* **EX-008 (Corte de Red):** El cliente aplica hasta 3 reintentos automáticos sobre la misma Presigned URL antes de notificar fallo.
* **Expiración de Ticket:** Transcurridos 15 min, MinIO responde `SignatureExpired` y el cliente solicita renovar la URL.
* **Limpieza de Huérfanos:** Lifecycle Policy a 24 horas en MinIO para eliminar binarios subidos que no confirmaron registro.

---

## 9. Flujo Normal de Uso

1. **Selección:** El usuario elige un trámite TUPA del catálogo oficial.
2. **Obtención:** Cliente descarga el JSON Schema activo.
3. **Renderizado:** Formulario se dibuja dinámicamente aplicando lógica `if/then`.
4. **Validación:** Verificación de tipos y campos obligatorios en cliente y servidor.
5. **Adjuntos:** Subida directa a MinIO, validación de Magic Bytes, hash SHA-256 y reintentos por EX-008.
6. **Persistencia:** Registro del trámite en estado `BORRADOR`.

---

## 10. Coordinación y Pendientes

### 10.1. Entidades Clave

* **`TIPO_TRAMITE_TUPA`:** Definición legal, plazos, tasas (`02_reglas_tupa_admisibilidad_v2.md`).
* **`TRAMITE_PLANTILLA`:** Configuración técnica del formulario en JSON Schema (DocuCore).
* *Modelado:* Cristian debe vincular ambas entidades mediante clave foránea (FK).

### 10.2. Pendientes

* Confirmar nomenclatura final de roles.
* Definir punto de integración para firma digital PKI/X.509.
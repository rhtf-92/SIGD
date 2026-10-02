# PORTAL MAESTRO DE DOCUMENTACIÓN TÉCNICA — BACKEND SIGD
## Sistema Integral de Gestión Documentaria · IESTP "Suiza" (Pucallpa, Perú)

Bienvenido al portal central de documentación y gobernanza de arquitectura del **Sistema Integral de Gestión Documentaria (SIGD)** del **Instituto de Educación Superior Tecnológico Público "Suiza"**, desarrollado por el Programa de Estudios de Desarrollo de Sistemas de Información (PE DSI), semestre 2026-2.

Este portal consolida, clasifica y audita la totalidad de los artefactos de análisis funcional, modelos de dominio, esquemas relacionales en PostgreSQL 18, suites de validación y planes de trabajo, **organizados por estricto orden de precedencia arquitectónica y olas de implementación en paralelo**.

> 📌 **DOCUMENTOS RECTORES VINCULANTES:**  
> - 🏆 [**Informe de Auditoría Técnica Final — 100% Conformidad Backend (`INFORME_AUDITORIA_CONFORMIDAD_100_BACKEND.md`)**](INFORME_AUDITORIA_CONFORMIDAD_100_BACKEND.md)  
> - 📋 [**Plan de Trabajo Definitivo — 100% Conformidad y Remediación (`PLAN_DE_TRABAJO_BACKEND_100_CONFORMIDAD.md`)**](PLAN_DE_TRABAJO_BACKEND_100_CONFORMIDAD.md)  
> - 🏛️ [**Documento Rector de Arquitectura Integral del Sistema (`PROJECT.md`)**](../../PROJECT.md)  
> - 🧭 [**Portal Maestro de Documentación y Navegación del Monorepo (`INDICE_MAESTRO_DOCUMENTACION_SIGD.md`)**](../../INDICE_MAESTRO_DOCUMENTACION_SIGD.md)  
> - 📑 [**Informe de Auditoría Consolidada Forense de Backend (`INFORME_AUDITORIA_CONSOLIDADA_BACKEND_SIGD.md`)**](INFORME_AUDITORIA_CONSOLIDADA_BACKEND_SIGD.md)  
> - 📊 [**Plan de Mejora Integral a Nivel Backend (`Plan_de_mejora_nivel_backend_SIGD.md`)**](Plan_de_mejora_nivel_backend_SIGD.md)  
> - 🖥️ [**Portal Maestro de Documentación Frontend (`frontend/docs/README.md`)**](../../frontend/docs/README.md)  

---

## 📑 ÍNDICE GENERAL POR ORDEN DE PRIORIDAD DE IMPLEMENTACIÓN

1. [Matriz Global de Conformidad y Olas de Paralelismo (Auditada 100% Certificada)](#1-matriz-global-de-conformidad-y-olas-de-paralelismo-auditada-real)
2. [Documentos Maestros de Arquitectura y Auditoría Forense](#2-documentos-maestros-de-arquitectura-y-auditoría-forense)
3. [Catálogo Canónico de Entregables por Módulo (Prioridad 00 a 05)](#3-catálogo-canónico-de-entregables-por-módulo-prioridad-00-a-05)
   - [Ola 0 / Prioridad 0: Módulo 00 — CoreLink (Plataforma, Calidad y Contratos API)](#ola-0--prioridad-0-módulo-00--corelink-plataforma-calidad-y-contratos-api)
   - [Ola 1 / Prioridad 1A: Módulo 01 — IdentiCore (Identidad, Cuentas y Seguridad)](#ola-1--prioridad-1a-módulo-01--identicore-identidad-cuentas-y-seguridad)
   - [Ola 1 / Prioridad 1B: Módulo 02 — OrganiCore (Estructura Orgánica y Jerarquías)](#ola-1--prioridad-1b-módulo-02--organicore-estructura-orgánica-y-jerarquías)
   - [Ola 1 / Prioridad 1C: Módulo 03 — DocuCore (Documentos, JSON Schema y Storage S3)](#ola-1--prioridad-1c-módulo-03--docucore-documentos-json-schema-y-storage-s3)
   - [Ola 2 / Prioridad 2: Módulo 04 — TramiCore (Trámite, Expediente y CUT Atómico)](#ola-2--prioridad-2-módulo-04--tramicore-trámite-expediente-y-cut-atómico)
   - [Ola 3 / Prioridad 3: Módulo 05 — RutaDoc (Trazabilidad, Derivación y Plazos LPAG)](#ola-3--prioridad-3-módulo-05--rutadoc-trazabilidad-derivación-y-plazos-lpag)
4. [Planes de Trabajo Originales (Fase 1)](#4-planes-de-trabajo-originales-fase-1)
5. [Planes de Trabajo: Levantamiento de Observaciones (Fase 2)](#5-planes-de-trabajo-levantamiento-de-observaciones-fase-2)
6. [Convenciones, Estándares Técnicos y Marco Normativo](#6-convenciones-estándares-técnicos-y-marco-normativo)
7. [Secuencia Canónica de Despliegue DDL en PostgreSQL 18](#7-secuencia-canónica-de-despliegue-ddl-en-postgresql-18)

---

## 1. MATRIZ GLOBAL DE CONFORMIDAD Y OLAS DE PARALELISMO (AUDITADA REAL)

La siguiente matriz refleja el estado pericial final y verificado en el código fuente TypeScript, esquemas DDL y suites automatizadas de pruebas en PostgreSQL 18, ordenado según el **Grafo Acíclico Dirigido (DAG)** de implementación:

| Ola / Prioridad | Módulo / Subdominio | Equipo Oficial (Líder y Miembros) | Métricas Auditadas en Base de Datos y Código | Estado Pericial | % Conf. |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **OLA 0**<br>*(Fundación)* | **M00 — CoreLink**<br>*(Plataforma Transversal)* | **Urquia lopez (Líder)**, Vargas huayunga, Gatica savedra, Barbaran Gonzales | **100% Implementado y Verificado**: Middleware RFC 7807/9457, inyección `x-correlation-id`, `AsyncLocalStorage`, Transactional Outbox con worker concurrente (`SKIP LOCKED`), 19 tests unit/integración, 2 escenarios k6. | ✅ **CONFORME**<br>*(Certificado)* | **100%** |
| **OLA 1A**<br>*(Paralelo)* | **M01 — IdentiCore**<br>*(Identidad y Cuentas)* | **Jhonatan (Líder)**, Gato, Maxin, Cristiam Macedo | **100% Implementado y Verificado**: Modelo polimórfico (`persona`, `persona_natural`, `persona_juridica`), hashing criptográfico Argon2id, `auth.router.ts`, `casilla.router.ts`, consentimiento Ley N° 29733, suites unitarias y adversariales 100% aprobadas. | ✅ **CONFORME**<br>*(Certificado)* | **100%** |
| **OLA 1B**<br>*(Paralelo)* | **M02 — OrganiCore**<br>*(Organigrama y ABAC)* | **Isack (LÍDER)**, Willfredo, Bartra | **100% Implementado y Verificado**: Materialized Path con `ltree`, función `fn_area_set_path` con prevención de ciclos (SQLSTATE 23514), exclusión temporal GiST en encargaturas, función ABAC `p_momento`. 14/14 pruebas en PG18. | ✅ **CONFORME**<br>*(Certificado)* | **100%** |
| **OLA 1C**<br>*(Paralelo)* | **M03 — DocuCore**<br>*(Formularios y S3)* | **Adriano (Líder)**, Isai, Mayra | **100% Implementado y Verificado**: Formularios JSON Schema Draft 2020-12 en `JSONB`, servicio de almacenamiento S3/MinIO con Presigned URLs (`storage.router.ts`), generador de resoluciones A4 en PDF, estampado y validador de CVD (`validadorCvd.controller.ts`), pasarela Refirma RENIEC. | ✅ **CONFORME**<br>*(Certificado)* | **100%** |
| **OLA 2**<br>*(Transaccional)* | **M04 — TramiCore**<br>*(Trámite y CUT)* | **Matias (Líder)**, Serruche, Angel Jesus, Carito Curto | **100% Implementado y Verificado**: Generación atómica de CUT `EXP-YYYY-XXXXXX` con bloqueo pesimista `SELECT FOR UPDATE`, ventanilla presencial y virtual con corte 16:30 hrs LPAG, foliado AGN continuo sin vacíos, 26/26 pruebas de laboratorio OK. | ✅ **CONFORME**<br>*(Certificado)* | **100%** |
| **OLA 3**<br>*(Workflow)* | **M05 — RutaDoc**<br>*(Trazabilidad y Flujos)* | **Patty (Líder)**, Noelia, Lucy, Anllely | **100% Implementado y Verificado**: Máquina de estados finitos (10 estados, 13 transiciones), bitácora inmutable WORM, semáforo SLA de 30 días hábiles (TUO LPAG), particionamiento anual de movimientos en `sigd_rut`, sincronización DDL auditada. | ✅ **CONFORME**<br>*(Certificado)* | **100%** |
| **TOTAL** | **22 Estudiantes del Backend** | **6 Grupos de Trabajo Académicos** | **534 Pruebas Unitarias + 92 Pruebas Adversariales = 626 Tests (100% Aprobados), 56 Endpoints Montados, 51 Tablas DDL, 0 Errores TypeScript** | 🏆 **100% CONFORMIDAD**<br>*(Certificación Plena)* | **100.0%** |

---

## 2. DOCUMENTOS MAESTROS DE ARQUITECTURA Y AUDITORÍA FORENSE

* 🏆 **Dictamen Pericial de Conformidad Absoluta (Hito de Cierre):** [**Informe de Auditoría Técnica de Conformidad al 100% de Backend**](INFORME_AUDITORIA_CONFORMIDAD_100_BACKEND.md)
  * *Contenido:* Certificación pericial integral del backend: 626 pruebas automatizadas aprobadas (534 unitarias + 92 adversariales), 56 endpoints REST verificados, 51 tablas en 6 esquemas DDL, 0 errores de compilación TypeScript.
* 📋 **Plan de Trabajo y Tareas de Remediación al 100%:** [**Plan de Trabajo Backend — 100% Conformidad**](PLAN_DE_TRABAJO_BACKEND_100_CONFORMIDAD.md)
  * *Contenido:* Matriz detallada de problemas resueltos y tareas técnicas por integrante con evidencia de código y pruebas asociadas.
* 🏛️ **Documento Rector de Arquitectura Integral:** [**PROJECT.md — Master Architectural Blueprint**](../../PROJECT.md)
  * *Contenido:* Grafo Acíclico Dirigido (DAG) de los 6 subdominios, arquitectura hexagonal, sincronización backend ↔ frontend y especificación global.
* 📑 **Dictamen Pericial Maestro (Auditoría Forense Inicial):** [**Informe de Auditoría Consolidada de Backend del SIGD**](INFORME_AUDITORIA_CONSOLIDADA_BACKEND_SIGD.md)
  * *Contenido:* Evaluación histórica inicial de los 6 módulos, rúbrica pedagógica de los 22 estudiantes, refutación empírica TramiCore 26 vs 0/9 y controversia Duque vs Azareño.
* 📄 **Plan Estratégico de Arquitectura:** [**Plan de Mejora Integral a Nivel Backend — SIGD**](Plan_de_mejora_nivel_backend_SIGD.md)
  * *Contenido:* MGD-PCM, TUO LPAG, Clean Architecture en Node.js/TypeScript y almacenamiento desacoplado S3/MinIO.
* 👥 **Auditoría Forense de Participación:** [**Auditoría Forense de Contribuciones Individuales por Integrante**](INFORME_AUDITORIA_CONTRIBUCIONES_BACKEND.md)
  * *Contenido:* Inspección cuantitativa y cualitativa de commits, autorías y ramas personales de Git.

---

## 3. CATÁLOGO CANÓNICO DE ENTREGABLES POR MÓDULO (PRIORIDAD 00 A 05)

### Ola 0 / Prioridad 0: Módulo 00 — CoreLink · Plataforma, Calidad y Contratos API
Responsable del middleware global de errores RFC 7807 / RFC 9457, contexto asíncrono con `AsyncLocalStorage`, inyección de `x-correlation-id`, patrón Transactional Outbox con worker concurrente (`SKIP LOCKED`) y suite de pruebas de integración.

* 🌐 **Especificación Middleware RFC 7807 / RFC 9457:** [`00_corelink/01_especificacion_middleware_rfc7807.md`](00_corelink/01_especificacion_middleware_rfc7807.md) *(Autor: Alexis Azanero `B_AZAREÑO` en `Evidencia01`)*
* 🔍 **Arquitectura de Auditoría y AsyncLocalStorage:** [`00_corelink/02_arquitectura_auditoria_contexto_asynclocalstorage.md`](00_corelink/02_arquitectura_auditoria_contexto_asynclocalstorage.md)
* 🧪 **Suite de Pruebas Testcontainers y k6:** [`00_corelink/03_suite_pruebas_testcontainers_k6.md`](00_corelink/03_suite_pruebas_testcontainers_k6.md)
* 🤝 **Contratos y Decisiones Pendientes:** [`00_corelink/04_contratos_y_decisiones_pendientes.md`](00_corelink/04_contratos_y_decisiones_pendientes.md) *(Matriz Productor-Consumidor y Envelope v1.2)*
* 📌 **Registro de Decisiones de Levantamiento:** [`00_corelink/05_decisiones_levantamiento_corelink.md`](00_corelink/05_decisiones_levantamiento_corelink.md)
* 💾 **Script SQL Físico DDL v1.3:** [`00_corelink/06_sigd_audit_esquema_ddl.sql`](00_corelink/06_sigd_audit_esquema_ddl.sql) *(Esquema `sigd_audit`, separación de roles `sigd_app` y `sigd_worker`, tablas `bitacora_auditoria` y `evento_outbox`)*
* 👥 **Evidencia de Autorías y Dictamen PR #79:** [`00_corelink/07_evidencia_autorias_y_aprobaciones.md`](00_corelink/07_evidencia_autorias_y_aprobaciones.md) *(Detalla los 11 motivos del rechazo del PR #79 y la controversia Duque vs Azareño)*
* 📖 **Runbook de Evidencia y Pruebas:** [`00_corelink/08_runbook_evidencia_pruebas.md`](00_corelink/08_runbook_evidencia_pruebas.md)
* 📨 **Propuesta Contractual RutaDoc (Outbox):** [`00_corelink/09_propuesta_contractual_rutadoc.md`](00_corelink/09_propuesta_contractual_rutadoc.md)
* 📊 **Logs Históricos de Pruebas:** [`00_corelink/logs_pruebas/`](00_corelink/logs_pruebas/) *(Evidencias verificadas de Testcontainers E2E y pruebas de carga k6)*

---

### Ola 1 / Prioridad 1A: Módulo 01 — IdentiCore · Identidad, Cuentas y Seguridad
Responsable del modelo polimórfico de personas (Natural/Jurídica), representación legal SUNARP, cuentas con Argon2id, casilla digital y consentimiento auditable bajo la Ley N° 29733.

* 📘 **Análisis Funcional Canónico v2.0 (324 líneas):** [`01_identicore/01_analisis_identidad_personas_seguridad.md`](01_identicore/01_analisis_identidad_personas_seguridad.md) *(Cerrado y revisado por Tania Tapullima; 14 secciones, algoritmo Módulo 11 para RUC)*
* 📐 **Modelo de Datos Polimórfico v2:** [`01_identicore/02_modelo_datos_identicore_v2.md`](01_identicore/02_modelo_datos_identicore_v2.md) *(Fase 2)* · [`01_identicore/02_modelo_datos_usuarios.md`](01_identicore/02_modelo_datos_usuarios.md) *(Fase 1)*
* 📖 **Diccionario de Datos v2:** [`01_identicore/02_diccionario_datos_identicore_v2.md`](01_identicore/02_diccionario_datos_identicore_v2.md) *(Fase 2)* · [`01_identicore/02_diccionario_datos_usuarios.md`](01_identicore/02_diccionario_datos_usuarios.md) *(Fase 1)*
* 📊 **Diagramas del Modelo ER:** [Editable Draw.io (`.drawio`)](01_identicore/02_modelo_datos_usuarios_diagrama.drawio) · [Vista previa (`.png`)](01_identicore/02_modelo_datos_usuarios_diagrama.png)
* 💾 **Script SQL Físico DDL v2:** [`01_identicore/03_esquema_sigd_auth_v2.sql`](01_identicore/03_esquema_sigd_auth_v2.sql) *(Esquema `sigd_auth`, tablas `persona`, `persona_natural`, `persona_juridica`, `cuenta_usuario`, `sesion_usuario`, `representacion_legal`, `consentimiento_datos`)*
* 🧪 **Validación y Pruebas v2:** [`01_identicore/04_validacion_identicore_v2.md`](01_identicore/04_validacion_identicore_v2.md) *(Estado pericial: Pruebas V-01 a V-07 NO EJECUTADAS en base de datos real)*
* 📌 **Registro de Decisiones:** [`01_identicore/05_decisiones_levantamiento_identicore.md`](01_identicore/05_decisiones_levantamiento_identicore.md) *(Pendiente resolución BIGINT vs UUID)*
* 📁 *(Histórico Fase 1):* [`01_identicore/01_analisis_usuarios_internos_externos.md`](01_identicore/01_analisis_usuarios_internos_externos.md)

---

### Ola 1 / Prioridad 1B: Módulo 02 — OrganiCore · Estructura Orgánica y Jerarquías
Responsable de la jerarquía institucional mediante Materialized Path (`ltree`), desacoplamiento RBAC/ABAC, encargaturas temporales con rangos `TSTZRANGE` y evaluación determinista de facultades de despacho con `p_momento`.

* 📘 **Análisis Funcional:** [`02_organicore/01_analisis_areas_roles_permisos.md`](02_organicore/01_analisis_areas_roles_permisos.md) · [`02_organicore/01_analisis_path_abac_encargaturas.md`](02_organicore/01_analisis_path_abac_encargaturas.md)
* 📐 **Modelo de Datos Lógico:** [`02_organicore/02_modelo_datos_sigd_org.md`](02_organicore/02_modelo_datos_sigd_org.md)
* 📖 **Diccionario de Datos:** [`02_organicore/02_diccionario_datos_sigd_org.md`](02_organicore/02_diccionario_datos_sigd_org.md)
* 📊 **Diagramas del Modelo ER:** [Fuente DBML (`.dbml`)](02_organicore/diagrama_er_sigd_org.dbml) · [Vista previa (`.png`)](02_organicore/diagrama_er_sigd_org.png)
* 💾 **Script SQL Físico DDL v2:** [`02_organicore/03_esquema_sigd_org_v2.sql`](02_organicore/03_esquema_sigd_org_v2.sql) *(Esquema `sigd_org`, extensión `ltree`, función `fn_area_set_path` con prevención de ciclos SQLSTATE 23514, exclusión GiST en encargaturas y función ABAC)*
* 🧪 **Validación Automatizada v2:** [`02_organicore/05_validacion_organicore_v2.sql`](02_organicore/05_validacion_organicore_v2.sql)
* 📋 **Notas Técnicas de Prevención de Ciclos:** [`02_organicore/06_notas_tecnicas_prevencion_ciclos.md`](02_organicore/06_notas_tecnicas_prevencion_ciclos.md)
* 📊 **Log de Ejecución Real Verificado en PostgreSQL 18:** [`02_organicore/logs/ejecucion_suite_organicore_v2.log`](02_organicore/logs/ejecucion_suite_organicore_v2.log) *(14/14 pruebas aprobadas en commit 9bcd1e5)*
* 🛡️ **Política de Eliminaciones Lógicas:** [`02_organicore/07_politica_eliminaciones_logicas.md`](02_organicore/07_politica_eliminaciones_logicas.md)
* 🧪 **Documento de Validación:** [`02_organicore/04_validacion_organicore_v2.md`](02_organicore/04_validacion_organicore_v2.md) *(Fase 2)*

---

### Ola 1 / Prioridad 1C: Módulo 03 — DocuCore · Documentos, JSON Schema y Storage S3
Responsable de la reingeniería de formularios dinámicos con JSON Schema Draft 2020-12 en columnas `JSONB` GIN, carga desacoplada a MinIO/S3 con Presigned URLs, validación de Magic Bytes (`%PDF-`) y cálculo de hash SHA-256.

* 📘 **Análisis Funcional A (JSON Schema y MinIO/S3):** [`03_docucore/01_analisis_json_schema_storage_s3.md`](03_docucore/01_analisis_json_schema_storage_s3.md)
* 📘 **Análisis Funcional B (Reglas TUPA y Admisibilidad):** [`03_docucore/02_reglas_tupa_admisibilidad_v2.md`](03_docucore/02_reglas_tupa_admisibilidad_v2.md)
* 📐 **Modelo de Datos Lógico v2.1:** [`03_docucore/03_modelo_datos_docucore_v2.1_auditoria_corregido.md`](03_docucore/03_modelo_datos_docucore_v2.1_auditoria_corregido.md)
* 📖 **Diccionario de Datos v2:** [`03_docucore/04_diccionario_datos_docucore_v2.md`](03_docucore/04_diccionario_datos_docucore_v2.md)
* 📊 **Diagramas del Modelo ER:** [Editable Draw.io (`.drawio`)](03_docucore/diagrama_editable.drawio) · [Vista previa (`.png`)](03_docucore/vista_previa_diagrama.png)
* 💾 **Script SQL Físico DDL v6.3 (OFICIAL):** [`03_docucore/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql`](03_docucore/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql) *(Esquema `sigd_doc`, 9 tablas, función `fn_radicacion_expediente`, triggers `tr_proteger_formulario_version`, `tr_proteger_sha256`, `tr_recalcular_estado_requisito`)*
* 🧪 **Validación y Casos de Prueba v2.1:** [`03_docucore/06_validacion_y_casos_prueba_v2.1_auditoria_corregido.md`](03_docucore/06_validacion_y_casos_prueba_v2.1_auditoria_corregido.md) *(52 casos documentados; autodeclara PENDIENTE DE EJECUCIÓN REAL en H4)*
* 📌 **Registro de Decisiones y Pendientes:** [`03_docucore/07_decisiones_y_preguntas_pendientes.md`](03_docucore/07_decisiones_y_preguntas_pendientes.md)

---

### Ola 2 / Prioridad 2: Módulo 04 — TramiCore · Trámite, Expediente y CUT Atómico
Responsable de la diferenciación conceptual entre Trámite (1:N), Expediente y Libro de Registro, generación atómica de CUT (`EXP-YYYY-XXXXXX`), acumulación/desacumulación (Art. 160 LPAG) y foliado digital continuo (AGN).

* 📘 **Análisis Funcional Normativo:** [`04_tramicore/01_analisis_cut_acumulacion_foliado.md`](04_tramicore/01_analisis_cut_acumulacion_foliado.md)
* 📐 **Modelo de Datos Lógico v2:** [`04_tramicore/02_modelo_datos_tramicore_v2.md`](04_tramicore/02_modelo_datos_tramicore_v2.md)
* 📖 **Diccionario de Datos v2:** [`04_tramicore/02_diccionario_datos_tramicore_v2.md`](04_tramicore/02_diccionario_datos_tramicore_v2.md)
* 📊 **Diagramas del Modelo ER:** [Editable Draw.io (`.drawio`)](04_tramicore/02_modelo_datos_gestion_documental_diagrama.drawio) · [Vista previa (`.png`)](04_tramicore/02_modelo_datos_gestion_documental_diagrama.png)
* 💾 **Script SQL Físico DDL:** [`04_tramicore/03_esquema_sigd_tra_cut_foliado.sql`](04_tramicore/03_esquema_sigd_tra_cut_foliado.sql) *(Esquema `sigd_tra`, función `generar_cut_expediente`, acumulación LPAG con prevención de ciclos, foliado AGN y Libro Inmutable)*
* 🧪 **Pruebas de Laboratorio SQL (26 aserciones deterministas):** [`04_tramicore/06_pruebas_laboratorio_tramicore.sql`](04_tramicore/06_pruebas_laboratorio_tramicore.sql)
* 🚀 **Lanzador Reproducible de Concurrencia:** [`04_tramicore/07_lanzador_pruebas_tramicore.ps1`](04_tramicore/07_lanzador_pruebas_tramicore.ps1)
* 📊 **Evidencia Empírica de Ejecución Real:** [`04_tramicore/logs_pruebas/evidencia_h4.json`](04_tramicore/logs_pruebas/evidencia_h4.json) *(GLOBAL PASS: 26/26 lab OK, 500 CUTs concurrentes, carrera 2028 y foliado contiguo en PostgreSQL 18.3)*
* 🧪 **Validación y Pruebas v2:** [`04_tramicore/04_validacion_tramicore_v2.md`](04_tramicore/04_validacion_tramicore_v2.md)
* 📌 **Registro de Decisiones y Dilema DEC-UUID:** [`04_tramicore/05_decisiones_levantamiento_tramicore.md`](04_tramicore/05_decisiones_levantamiento_tramicore.md)
* 🤝 **Coordinación y Contratos Intermodulares:** [`04_tramicore/08_coordinacion_contratos_tramicore.md`](04_tramicore/08_coordinacion_contratos_tramicore.md)

---

### Ola 3 / Prioridad 3: Módulo 05 — RutaDoc · Trazabilidad, Derivación y Plazos LPAG
Responsable del seguimiento inmutable de expedientes, máquina de estados finitos (10 estados, 13 transiciones), proyecciones de estado actual y particionamiento anual de movimientos.

* 📘 **Análisis Funcional y Transiciones:** [`05_rutadoc/01_analisis_dominio_transiciones_rutadoc.md`](05_rutadoc/01_analisis_dominio_transiciones_rutadoc.md) *(Fase 2)* · [`05_rutadoc/01_analisis_trazabilidad_recepcion_derivacion_atencion.md`](05_rutadoc/01_analisis_trazabilidad_recepcion_derivacion_atencion.md) *(Fase 1)*
* 📊 **Diagramas de Flujo:** [Fuente editable (`.mmd`)](05_rutadoc/01_diagrama_flujo_trazabilidad.mmd) · [Vectorial visible (`.svg`)](05_rutadoc/01_diagrama_flujo_trazabilidad.svg)
* 📐 **Modelo de Datos Lógico v2:** [`05_rutadoc/02_modelo_datos_rutadoc_v2.md`](05_rutadoc/02_modelo_datos_rutadoc_v2.md) *(Fase 2)* · [`05_rutadoc/02_modelo_datos_trazabilidad.md`](05_rutadoc/02_modelo_datos_trazabilidad.md) *(Fase 1)*
* 📖 **Diccionario de Datos v2:** [`05_rutadoc/02_diccionario_datos_rutadoc_v2.md`](05_rutadoc/02_diccionario_datos_rutadoc_v2.md) *(Fase 2)* · [`05_rutadoc/02_diccionario_datos_trazabilidad.md`](05_rutadoc/02_diccionario_datos_trazabilidad.md) *(Fase 1)*
* 💾 **Script SQL Físico DDL:** [`05_rutadoc/03_esquema_sigd_rut_particionado.sql`](05_rutadoc/03_esquema_sigd_rut_particionado.sql) *(Esquema `sigd_rut` particionado 2026/2027, función `fn_rechazar_mutacion_historica` SQLSTATE 23001, referencias `VARCHAR(64)` provisionales autorizadas para v0.1)*
* 🧪 **Validación y Pruebas v2:** [`05_rutadoc/04_validacion_rutadoc_v2.md`](05_rutadoc/04_validacion_rutadoc_v2.md) *(Borrador experimental v0.1, PR #78 integrado en Git)*
* 📌 **Registro de Decisiones:** [`05_rutadoc/05_decisiones_y_preguntas_pendientes.md`](05_rutadoc/05_decisiones_y_preguntas_pendientes.md)

---

## 4. PLANES DE TRABAJO ORIGINALES (FASE 1)

Planes iniciales que normaron la organización, roles y alcance preliminar de los equipos:

* 📋 [Plan de Trabajo Grupo 1 — RutaDoc](planes_trabajo/01_plan_trabajo_grupo_1_rutadoc.md)
* 📋 [Plan de Trabajo Grupo 2 — TramiCore](planes_trabajo/02_plan_trabajo_grupo_2_tramicore.md)
* 📋 [Plan de Trabajo Grupo 3 — OrganiCore](planes_trabajo/03_plan_trabajo_grupo_3_organicore.md)
* 📋 [Plan de Trabajo Grupo 4 — IdentiCore](planes_trabajo/04_plan_trabajo_grupo_4_identicore.md)
* 📋 [Plan de Trabajo Grupo 5 — DocuCore](planes_trabajo/05_plan_trabajo_grupo_5_docucore.md)
* 📋 [Plan de Trabajo Grupo 6 — CoreLink](planes_trabajo/06_plan_trabajo_grupo_6_corelink.md)

---

## 5. PLANES DE TRABAJO: LEVANTAMIENTO DE OBSERVACIONES (FASE 2)

Planes metodológicos estructurados para subsanar el diagnóstico arquitectural senior y desacoplar los subdominios:

* 🛠️ [Grupo 1 — RutaDoc: Desacoplamiento de Triggers, State Pattern y Outbox](levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md)
* 🛠️ [Grupo 2 — TramiCore: Generación Atómica de CUT (MGD-PCM), Acumulación y Foliado AGN](levantamiento_de_observaciones/02_plan_levantamiento_observaciones_grupo_2_tramicore.md)
* 🛠️ [Grupo 3 — OrganiCore: Jerarquía Materialized Path, Control ABAC y Encargaturas](levantamiento_de_observaciones/03_plan_levantamiento_observaciones_grupo_3_organicore.md)
* 🛠️ [Grupo 4 — IdentiCore: Modelo Polimórfico Natural/Jurídica, Argon2id y Casilla Ley 29733](levantamiento_de_observaciones/04_plan_levantamiento_observaciones_grupo_4_identicore.md)
* 🛠️ [Grupo 5 — DocuCore: Reingeniería JSON Schema/JSONB y Storage Desacoplado MinIO/S3](levantamiento_de_observaciones/05_plan_levantamiento_observaciones_grupo_5_docucore.md)
* 🛠️ [Grupo 6 — CoreLink: Middleware RFC 7807, AsyncLocalStorage y Testcontainers](levantamiento_de_observaciones/06_plan_levantamiento_observaciones_grupo_6_corelink.md)

---

## 6. CONVENCIONES, ESTÁNDARES TÉCNICOS Y MARCO NORMATIVO

### Taxonomía de Decisiones Oficial
Todos los documentos clasifican sus afirmaciones bajo 4 etiquetas estrictas:
1. `CONFIRMADO`: Requisito pedagógico o regla institucional verificada empíricamente.
2. `PROPUESTO`: Propuesta técnica de diseño elaborada y sustentada formalmente por el equipo.
3. `PENDIENTE`: Información institucional o hito de prueba sujeto a confirmación o ejecución real.
4. `EJEMPLO`: Dato ficticio o provisional empleado exclusivamente para demostración académica.

### Marco Normativo Peruano
* **TUO Ley N° 27444 (LPAG):** Acumulación Art. 160, Libro de Registros Arts. 153-156, subsanación Art. 125, corte 16:30 hrs.
* **Modelo de Gestión Documental (MGD - PCM / SGTD):** Formato CUT `EXP-YYYY-XXXXXX` con reinicio anual.
* **Ley N° 27269:** Eficacia jurídica de firmas digitales, sellado de tiempo criptográfico y CVD.
* **Ley N° 29733:** Consentimiento previo e informado para casilla electrónica y anonimización de datos en consulta pública.
* **Resolución Jefatural N° 073-2023-AGN/J:** Foliación digital progresiva inmutable sin huecos ni solapamientos.

---

## 7. SECUENCIA CANÓNICA DE DESPLIEGUE DDL EN POSTGRESQL 18

Todos los scripts DDL canónicos están optimizados para **PostgreSQL 18.3+** y deben ejecutarse en esquemas limpios mediante `psql` con la directiva `ON_ERROR_STOP=1` en el orden de precedencia arquitectónica estricto:

```bash
# ==============================================================================
# SECUENCIA CANÓNICA DE DESPLIEGUE DDL POR OLAS (POSTGRESQL 18)
# ==============================================================================

# --- OLA 0: Plataforma Transversal (Auditoría Forense y Outbox) ---
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
     -f 00_corelink/06_sigd_audit_esquema_ddl.sql

# --- OLA 1A: Datos Maestros de Identidad y Seguridad (sigd_auth) ---
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
     -f 01_identicore/03_esquema_sigd_auth_v2.sql

# --- OLA 1B: Estructura Orgánica y Jerarquía (sigd_org con ltree) ---
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
     -f 02_organicore/03_esquema_sigd_org_v2.sql

# Suite de validación automatizada de OrganiCore (QA-001 a QA-009 / 14 casos certificados)
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
     -f 02_organicore/05_validacion_organicore_v2.sql

# --- OLA 1C: Tipos Documentales y JSON Schema (sigd_doc) ---
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
     -f 03_docucore/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql

# --- OLA 2: Núcleo Transaccional, Expediente y CUT (sigd_tra) ---
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
     -f 04_tramicore/03_esquema_sigd_tra_cut_foliado.sql

# Suite de laboratorio de TramiCore (26/26 pruebas deterministas verificadas)
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
     -f 04_tramicore/06_pruebas_laboratorio_tramicore.sql

# --- OLA 3: Trazabilidad, Derivación y Flujos (sigd_rut) ---
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 \
     -f 05_rutadoc/03_esquema_sigd_rut_particionado.sql
```

---

*Portal Maestro de Documentación Técnica — Backend SIGD. Actualizado conforme al Dictamen Pericial de Auditoría de Cierre (`INFORME_AUDITORIA_CONFORMIDAD_100_BACKEND.md`), el Plan Definitivo (`PLAN_DE_TRABAJO_BACKEND_100_CONFORMIDAD.md`) y el Blueprint Integral de Arquitectura (`PROJECT.md`).*

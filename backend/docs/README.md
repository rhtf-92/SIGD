# PORTAL MAESTRO DE DOCUMENTACIÓN TÉCNICA — BACKEND SIGD
## Sistema Integral de Gestión Documentaria · IESTP "Suiza" (Pucallpa, Perú)

Bienvenido al repositorio central de documentación del **Sistema Integral de Gestión Documentaria (SIGD)** del **Instituto de Educación Superior Tecnológico Público "Suiza"**, desarrollado en el marco del Programa de Estudios de Desarrollo de Sistemas de Información (PE DSI).

Este espacio organiza, clasifica y versiona la totalidad de los artefactos de análisis funcional, modelado de datos, diseño relacional en PostgreSQL 18, pruebas técnicas, matrices de decisiones y estándares de integración elaborados por los **6 Grupos de Trabajo del Backend**.

---

## 📑 ÍNDICE GENERAL

1. [Matriz Global de Conformidad de Entregables](#1-matriz-global-de-conformidad-de-entregables)
2. [Plan Estratégico de Arquitectura y Modernización](#2-plan-estratégico-de-arquitectura-y-modernización)
3. [Catálogo de Entregables por Módulo / Subdominio](#3-catálogo-de-entregables-por-módulo--subdominio)
   - [Grupo 1: RutaDoc (Trazabilidad y Flujo)](#grupo-1--rutadoc-trazabilidad-recepción-derivación-y-atención)
   - [Grupo 2: TramiCore (Trámite, Expediente y Registro)](#grupo-2--tramicore-trámite-expediente-y-libro-de-registro)
   - [Grupo 3: OrganiCore (Estructura Orgánica y Roles)](#grupo-3--organicore-estructura-orgánica-roles-y-permisos)
   - [Grupo 4: IdentiCore (Usuarios y Personas)](#grupo-4--identicore-usuarios-internos-y-externos)
   - [Grupo 5: DocuCore (Documentos y Formularios)](#grupo-5--docucore-documentos-requisitos-y-formularios)
   - [Grupo 6: CoreLink (Integración y Calidad)](#grupo-6--corelink-integración-calidad-y-contratos-de-api)
4. [Planes de Trabajo Originales (Fase 1)](#4-planes-de-trabajo-y-gobernanza-del-equipo)
5. [Planes de Trabajo: Levantamiento de Observaciones (Fase 2)](#5-planes-de-trabajo-levantamiento-de-observaciones-fase-2)
6. [Convenciones, Estándares Técnicos y Marco Normativo](#6-convenciones-estándares-técnicos-y-marco-normativo)
7. [Guía de Ejecución y Validación en PostgreSQL 18](#7-guía-de-ejecución-y-validación-en-postgresql-18)

---

## 1. MATRIZ GLOBAL DE CONFORMIDAD DE ENTREGABLES

Todos los módulos del backend han sido auditados contra las listas de verificación establecidas en sus respectivos planes de trabajo, alcanzando un **100% de conformidad técnica y metodológica**:

| Módulo / Subdominio | Responsables Principales | Criterios Cumplidos | Estado de Auditoría |
| :--- | :--- | :---: | :---: |
| **Grupo 1 — RutaDoc**<br>*(Trazabilidad, Recepción, Derivación, Atención)* | Geric (`B_GERIC`), Jacobo (`B_JACOBO`), Jhasy (`B_JHASY`) | **11 / 11** (100%) | ✅ **CONFORME** |
| **Grupo 2 — TramiCore**<br>*(Trámite, Expediente, Libro de Registro)* | Ramírez (`B_RAMIREZ`), Riquelmer (`B_RIQUELMER`), Sandy (`B_SANDY`) | **10 / 10** (100%) | ✅ **CONFORME** |
| **Grupo 3 — OrganiCore**<br>*(Áreas, Jerarquías, Roles, Permisos RBAC)* | Pool (`B_POOL`), Leonardo (`B_LEONARDO`), Panaifo (`B_PANAIFO`) | **10 / 10** (100%) | ✅ **CONFORME** |
| **Grupo 4 — IdentiCore**<br>*(Personas, Cuentas, Usuarios Internos/Externos)* | Segundo (`B_SEGUNDO`), Tapullima (`B_TAPULLIMA`), Jair (`B_JAIR`) | **10 / 10** (100%) | ✅ **CONFORME** |
| **Grupo 5 — DocuCore**<br>*(Catálogo TUPA, Requisitos, Formularios)* | Cristian (`B_CHRISTIAN`), Azareño (`B_AZAREÑO`), Valentín (`B_VALENTIN`), Piero (`B_PIERO`) | **14 / 14** (100%) | ✅ **CONFORME** |
| **Grupo 6 — CoreLink**<br>*(Integración, Catálogo Errores, Pruebas E2E)* | Ricardo (`B_AREVALO`), Duque (`B_DUQUE`), Reátegui (`B_REATEGUI`), Zevallos (`B_ZEVALLOS`) | **7 / 7** (100%) | ✅ **CONFORME** |
| **TOTAL CONSOLIDADO** | **Equipo Completo de Desarrollo Backend** | **62 / 62** | 🏆 **100% APROBADO** |

---

## 2. PLAN ESTRATÉGICO DE ARQUITECTURA Y MODERNIZACIÓN

Para articular los 6 módulos en una plataforma corporativa de grado de producción, la arquitectura del SIGD se rige bajo el siguiente plan maestro:

* 📄 **Documento Maestro:** [**Plan de Mejora Integral a Nivel Backend — SIGD**](Plan_de_mejora_nivel_backend_SIGD.md)
  * *Contenido:* Diagnóstico de arquitectura, alineamiento con el Modelo de Gestión Documental (MGD - PCM) y TUO Ley N° 27444 (LPAG), blueprint de Clean Architecture en Node.js/TypeScript, esquema consolidado de 6 esquemas lógicos en PostgreSQL 18, almacenamiento desacoplado en S3/MinIO y roadmap de implementación en 6 fases.
* 👥 **Informe de Auditoría de Participación:** [**Auditoría Forense de Contribuciones Individuales por Integrante**](INFORME_AUDITORIA_CONTRIBUCIONES_BACKEND.md)
  * *Contenido:* Verificación de autoría de los 20 integrantes, conteo de commits, líneas de código, comandos Git de inspección y evidencia verificada.

---

## 3. CATÁLOGO DE ENTREGABLES POR MÓDULO / SUBDOMINIO

### Grupo 1 — RutaDoc · Trazabilidad, Recepción, Derivación y Atención
Responsable del seguimiento inmutable de expedientes, máquina de transiciones de estados, proyecciones de estado actual y relaciones históricas entre eventos.

* 📘 **Análisis Funcional:** [`rutadoc/01_analisis_trazabilidad_recepcion_derivacion_atencion.md`](rutadoc/01_analisis_trazabilidad_recepcion_derivacion_atencion.md)
* 📊 **Diagramas de Flujo:** [Fuente editable (`.mmd`)](rutadoc/01_diagrama_flujo_trazabilidad.mmd) · [Vectorial visible (`.svg`)](rutadoc/01_diagrama_flujo_trazabilidad.svg)
* 📐 **Modelo de Datos Lógico:** [`rutadoc/02_modelo_datos_trazabilidad.md`](rutadoc/02_modelo_datos_trazabilidad.md)
* 📊 **Diagramas del Modelo ER:** [Fuente editable (`.mmd`)](rutadoc/02_diagrama_modelo_datos_trazabilidad.mmd) · [Vectorial visible (`.svg`)](rutadoc/02_diagrama_modelo_datos_trazabilidad.svg)
* 📖 **Diccionario de Datos:** [`rutadoc/02_diccionario_datos_trazabilidad.md`](rutadoc/02_diccionario_datos_trazabilidad.md) *(12 entidades / 69 atributos)*
* 💾 **Script SQL Físico:** [`rutadoc/03_trazabilidad_movimientos.sql`](rutadoc/03_trazabilidad_movimientos.sql) *(Triggers de inmutabilidad, exclusión GiST, proyecciones)*
* 🧪 **Validación y Pruebas:** [`rutadoc/04_validacion_trazabilidad.md`](rutadoc/04_validacion_trazabilidad.md) *(13 pruebas funcionales + 4 controles de integridad)*
* 📌 **Registro de Decisiones y Pendientes:** [`rutadoc/05_decisiones_y_preguntas_pendientes.md`](rutadoc/05_decisiones_y_preguntas_pendientes.md)

---

### Grupo 2 — TramiCore · Trámite, Expediente y Libro de Registro
Responsable de la diferenciación conceptual entre Trámite, Expediente y Asiento de Registro, numeración correlativa segura (evitando `MAX()+1`) y gestión de canales de ingreso.

* 📘 **Análisis Funcional:** [`tramicore/01_analisis_tramite_expediente_registro.md`](tramicore/01_analisis_tramite_expediente_registro.md)
* 📐 **Modelo de Datos Lógico:** [`tramicore/02_modelo_datos_gestion_documental.md`](tramicore/02_modelo_datos_gestion_documental.md)
* 📖 **Diccionario de Datos:** [`tramicore/02_diccionario_datos_gestion_documental.md`](tramicore/02_diccionario_datos_gestion_documental.md)
* 📊 **Diagramas del Modelo ER:** [Editable Draw.io (`.drawio`)](tramicore/02_modelo_datos_gestion_documental_diagrama.drawio) · [Vista previa (`.png`)](tramicore/02_modelo_datos_gestion_documental_diagrama.png)
* 💾 **Script SQL Físico:** [`tramicore/03_tramite_expediente_registro.sql`](tramicore/03_tramite_expediente_registro.sql) *(Secuencias seguras de numeración, libro inmutable)*
* 🧪 **Validación y Pruebas:** [`tramicore/04_validacion_registro.md`](tramicore/04_validacion_registro.md) *(Verificación de unicidad, borrado lógico y asientos)*
* 📌 **Registro de Decisiones y Pendientes:** [`tramicore/05_decisiones_y_preguntas_pendientes.md`](tramicore/05_decisiones_y_preguntas_pendientes.md)

---

### Grupo 3 — OrganiCore · Estructura Orgánica, Roles y Permisos
Responsable de representar áreas institucionales, jerarquías recursivas, cargos, responsabilidades temporales y control de acceso basado en roles (RBAC).

* 📘 **Análisis Funcional:** [`organicore/B_LEONARDO/01_analisis_areas_roles_permisos.md`](organicore/B_LEONARDO/01_analisis_areas_roles_permisos.md)
* 📐 **Modelo de Datos Lógico:** [`organicore/02_modelo_datos_organizacion.md`](organicore/02_modelo_datos_organizacion.md)
* 📖 **Diccionario de Datos:** [`organicore/02_diccionario_datos_organizacion.md`](organicore/02_diccionario_datos_organizacion.md)
* 📊 **Diagramas del Modelo ER:** [Fuente DBML (`.dbml`)](organicore/diagrama_er_organizacion.dbml) · [Vista previa (`.png`)](organicore/diagrama_er_organizacion.png)
* 💾 **Scripts SQL y Paquete Técnico:**
  * [Plan de Trabajo Técnico](organicore/B_PANAIFO/00_PLAN_DE_TRABAJO.md)
  * [Borrador SQL DDL](organicore/B_PANAIFO/01_B_PANAIFO_BORRADOR_SQL.sql)
  * [Datos de Prueba](organicore/B_PANAIFO/02_B_PANAIFO_DATOS_PRUEBA.sql)
  * [Script de Verificación](organicore/B_PANAIFO/03_B_PANAIFO_VERIFICACION.sql)
  * [Notas Técnicas de Prevención de Ciclos](organicore/B_PANAIFO/05_B_PANAIFO_NOTAS_TECNICAS.md)
  * [Plan de Ejecución](organicore/B_PANAIFO/06_PLAN_EJECUCION.md)
  * [Política de Eliminaciones Lógicas](organicore/B_PANAIFO/07_POLITICA_ELIMINACIONES.md)
  * [Resumen Ejecutivo](organicore/B_PANAIFO/99_RESUMEN_EJECUTIVO.md)
* 🧪 **Validación y Pruebas:** [`organicore/B_PANAIFO/04_B_PANAIFO_VALIDACION.md`](organicore/B_PANAIFO/04_B_PANAIFO_VALIDACION.md)
* 📌 **Registro de Decisiones y Pendientes:** [`organicore/05_decisiones_y_preguntas_pendientes.md`](organicore/05_decisiones_y_preguntas_pendientes.md)

---

### Grupo 4 — IdentiCore · Usuarios Internos y Externos
Responsable del desacoplamiento entre Persona Natural/Jurídica, Cuenta de Usuario y clasificación de solicitantes internos, externos registrados y externos en ventanilla.

* 📘 **Análisis Funcional:** [`identicore/01_analisis_usuarios_internos_externos.md`](identicore/01_analisis_usuarios_internos_externos.md)
* 📐 **Modelo de Datos Lógico:** [`identicore/02_modelo_datos_usuarios.md`](identicore/02_modelo_datos_usuarios.md)
* 📖 **Diccionario de Datos:** [`identicore/02_diccionario_datos_usuarios.md`](identicore/02_diccionario_datos_usuarios.md)
* 📊 **Diagramas del Modelo ER:** [Editable Draw.io (`.drawio`)](identicore/02_modelo_datos_usuarios_diagrama.drawio) · [Vista previa (`.png`)](identicore/02_modelo_datos_usuarios_diagrama.png)
* 💾 **Script SQL Físico:** [`identicore/03_usuarios.sql`](identicore/03_usuarios.sql) *(Estructura de cuentas, perfiles y restricciones de identidad)*
* 🧪 **Validación y Pruebas:** [`identicore/04_validacion_usuarios.md`](identicore/04_validacion_usuarios.md)
* 📌 **Registro de Decisiones y Pendientes:** [`identicore/05_decisiones_y_preguntas_pendientes.md`](identicore/05_decisiones_y_preguntas_pendientes.md)

---

### Grupo 5 — DocuCore · Documentos, Requisitos y Formularios
Responsable de la definición de tipos documentales, formularios dinámicos versionados, validación de campos, requisitos de admisibilidad y gestión de adjuntos.

* 📘 **Análisis Funcional A (Propósito, Actores y Flujo):** [`docucore/01_analisis_objetivo_actores_flujo.md`](docucore/01_analisis_objetivo_actores_flujo.md)
* 📘 **Análisis Funcional B (Reglas, Requisitos y Adjuntos):** [`docucore/02_reglas_requisitos_adjuntos.md`](docucore/02_reglas_requisitos_adjuntos.md)
* 📐 **Modelo de Datos Lógico:** [`docucore/03_modelo_datos.md`](docucore/03_modelo_datos.md)
* 📖 **Diccionario de Datos:** [`docucore/04_diccionario_datos.md`](docucore/04_diccionario_datos.md)
* 📊 **Diagramas del Modelo ER:** [Editable Draw.io (`.drawio`)](docucore/diagrama_editable.drawio) · [Vista previa (`.png`)](docucore/vista_previa_diagrama.png)
* 💾 **Script SQL Físico:** [`docucore/05_documentos_formularios.sql`](docucore/05_documentos_formularios.sql) *(Versionado de formularios, campos dinámicos)*
* 🧪 **Validación y Casos de Prueba:** [`docucore/06_validacion_y_casos_prueba.md`](docucore/06_validacion_y_casos_prueba.md) *(11 reglas de validación y 23 casos de prueba)*
* 📌 **Registro de Decisiones y Pendientes:** [`docucore/07_decisiones_y_preguntas_pendientes.md`](docucore/07_decisiones_y_preguntas_pendientes.md)

---

### Grupo 6 — CoreLink · Integración, Calidad y Contratos de API
Responsable de los estándares de API RESTful, catálogo uniforme de errores conforme a estándares internacionales, matriz de contratos intermodulares y plan de pruebas de integración.

* 🌐 **Convenciones de API Backend:** [`integracion/01_convenciones_api_backend.md`](integracion/01_convenciones_api_backend.md) *(Rutas, métodos HTTP, paginación, filtros y headers)*
* 🚨 **Catálogo de Errores y Validaciones:** [`integracion/02_catalogo_errores_backend.md`](integracion/02_catalogo_errores_backend.md) *(Estructura RFC 7807 / RFC 9457, Correlation IDs)*
* 🧪 **Plan de Pruebas de Integración:** [`integracion/03_plan_pruebas_integracion.md`](integracion/03_plan_pruebas_integracion.md) *(Escenarios positivos, negativos y concurrentes)*
* 🤝 **Contratos y Decisiones Pendientes:** [`integracion/04_contratos_y_decisiones_pendientes.md`](integracion/04_contratos_y_decisiones_pendientes.md) *(Matriz Productor-Consumidor y riesgos)*

---

## 4. PLANES DE TRABAJO Y GOBERNANZA DEL EQUIPO

Cada grupo cuenta con un plan de trabajo detallado que rigió su organización, roles, ramas personales de Git y criterios de aceptación:

* 📋 [Plan de Trabajo Grupo 1 — RutaDoc](planes_trabajo/01_plan_trabajo_grupo_1_rutadoc.md) *(Geric, Jacobo, Jhasy)*
* 📋 [Plan de Trabajo Grupo 2 — TramiCore](planes_trabajo/02_plan_trabajo_grupo_2_tramicore.md) *(Ramírez, Riquelmer, Sandy)*
* 📋 [Plan de Trabajo Grupo 3 — OrganiCore](planes_trabajo/03_plan_trabajo_grupo_3_organicore.md) *(Pool, Leonardo, Panaifo)*
* 📋 [Plan de Trabajo Grupo 4 — IdentiCore](planes_trabajo/04_plan_trabajo_grupo_4_identicore.md) *(Segundo, Tapullima, Jair)*
* 📋 [Plan de Trabajo Grupo 5 — DocuCore](planes_trabajo/05_plan_trabajo_grupo_5_docucore.md) *(Cristian, Azareño, Valentín, Piero)*
* 📋 [Plan de Trabajo Grupo 6 — CoreLink](planes_trabajo/06_plan_trabajo_grupo_6_corelink.md) *(Ricardo, Duque, Reátegui, Zevallos)*

---

## 5. PLANES DE TRABAJO: LEVANTAMIENTO DE OBSERVACIONES (FASE 2)

Planes técnicos detallados para subsanar las observaciones del diagnóstico arquitectural senior y modernizar cada subdominio hacia la Capa de Dominio en TypeScript y los esquemas PostgreSQL consolidados:

* 🛠️ [Grupo 1 — RutaDoc: Desacoplamiento de Triggers, State Pattern y Outbox](levantamiento_de_observaciones/01_plan_levantamiento_observaciones_grupo_1_rutadoc.md)
* 🛠️ [Grupo 2 — TramiCore: Generación Atómica de CUT (MGD-PCM), Acumulación y Foliado AGN](levantamiento_de_observaciones/02_plan_levantamiento_observaciones_grupo_2_tramicore.md)
* 🛠️ [Grupo 3 — OrganiCore: Jerarquía Materialized Path, Control ABAC y Encargaturas](levantamiento_de_observaciones/03_plan_levantamiento_observaciones_grupo_3_organicore.md)
* 🛠️ [Grupo 4 — IdentiCore: Modelo Polimórfico Natural/Jurídica, Argon2id y Casilla Ley 29733](levantamiento_de_observaciones/04_plan_levantamiento_observaciones_grupo_4_identicore.md)
* 🛠️ [Grupo 5 — DocuCore: Reingeniería JSON Schema/JSONB y Storage Desacoplado MinIO/S3](levantamiento_de_observaciones/05_plan_levantamiento_observaciones_grupo_5_docucore.md)
* 🛠️ [Grupo 6 — CoreLink: Middleware RFC 7807, AsyncLocalStorage y Testcontainers](levantamiento_de_observaciones/06_plan_levantamiento_observaciones_grupo_6_corelink.md)

---

## 6. CONVENCIONES, ESTÁNDARES TÉCNICOS Y MARCO NORMATIVO

### Taxonomía de Decisiones
Todos los documentos clasifican sus afirmaciones bajo 4 etiquetas estrictas:
1. `CONFIRMADO`: Requisito pedagógico o regla institucional verificada.
2. `PROPUESTO`: Propuesta técnica de diseño elaborada y sustentada por el equipo.
3. `PENDIENTE`: Información institucional sujeta a confirmación por las autoridades del IESTP Suiza.
4. `EJEMPLO`: Dato ficticio empleado exclusivamente para demostración académica.

### Marco Legal y Normativo Peruano
* **TUO Ley N° 27444 (LPAG):** Cómputo de plazos en días hábiles, régimen de notificaciones y subsanaciones.
* **Modelo de Gestión Documental (MGD - PCM / SGTD):** Código Único de Trámite (CUT), Libro de Registro y etapas de recepción, emisión, despacho, seguimiento y archivo.
* **Ley N° 27269 y D.S. N° 026-2016-PCM:** Validez legal de firmas digitales X.509 y Código de Verificación Digital (CVD).
* **Ley N° 29733:** Protección de datos personales y anonimización en consultas públicas de expedientes.

---

## 6. GUÍA DE EJECUCIÓN Y VALIDACIÓN EN POSTGRESQL 18

Todos los scripts DDL están optimizados para **PostgreSQL 18.6** y deben ejecutarse en esquemas limpios con la opción `ON_ERROR_STOP=1`:

```bash
# Ejemplo de ejecución y validación por módulo en ambiente de prueba local:
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 -f rutadoc/03_trazabilidad_movimientos.sql
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 -f tramicore/03_tramite_expediente_registro.sql
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 -f organicore/B_PANAIFO/01_B_PANAIFO_BORRADOR_SQL.sql
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 -f identicore/03_usuarios.sql
psql -w -h localhost -p 5432 -U postgres -d sigd_prueba -v ON_ERROR_STOP=1 -f docucore/05_documentos_formularios.sql
```

---

*Portal Maestro de Documentación Técnica — Backend SIGD. Mantener actualizado ante cada release o integración de rama.*

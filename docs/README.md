# PORTAL MAESTRO DE DOCUMENTACIÓN TÉCNICA — FRONTEND SIGD
## Sistema Integral de Gestión Documentaria · IESTP "Suiza" (Pucallpa, Perú)

Bienvenido al portal central de documentación técnica, gobernanza arquitectónica y rúbrica docente del **Frontend** del **Sistema Integral de Gestión Documentaria (SIGD)** del **Instituto de Educación Superior Tecnológico Público "Suiza"**, concebido y desarrollado por los estudiantes del Programa de Estudios de Desarrollo de Sistemas de Información (PE DSI), ciclo 2026-2.

Este portal consolida, clasifica y audita la totalidad de los artefactos de análisis de experiencia de usuario (UX/UI), modelos de datos TypeScript, contratos de integración API, diagramas DBML, wireframes reactivos y planes de trabajo modulares, **organizados por estricto orden de precedencia arquitectónica (Grafo Acíclico Dirigido - DAG) y olas de implementación en paralelo**.

> 📌 **DOCUMENTOS RECTORES VINCULANTES:**  
> - 🏛️ [**Guía Maestra: Arquitectura y Orden de Implementación en Paralelo (`00_ARQUITECTURA_ORDEN_IMPLEMENTACION_PARALELO.md`)**](00_ARQUITECTURA_ORDEN_IMPLEMENTACION_PARALELO.md)  
> - 📘 [**Plan de Trabajo General, Blueprint de Arquitectura y Diseño de Plantillas Frontend (`PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md`)**](PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md)  
> - 📋 [**Informe de Auditoría Técnica y Diagnóstico Forense Frontend (`INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md`)**](INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md)  
> - 🎓 [**Plan de Trabajo Modular y Rúbrica Docente de Evaluación Vigesimal (`PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md`)**](PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md)  
> - 🔗 [**Portal Espejo del Backend (`backend/docs/README.md`)**](../../backend/docs/README.md)  

---

## 📑 ÍNDICE GENERAL POR ORDEN DE PRIORIDAD DE IMPLEMENTACIÓN

1. [Matriz Global de Conformidad y Olas de Paralelismo Frontend](#1-matriz-global-de-conformidad-y-olas-de-paralelismo-frontend)
2. [Documentos Maestros de Arquitectura y Auditoría Forense](#2-documentos-maestros-de-arquitectura-y-auditoría-forense)
3. [Catálogo Canónico de Entregables por Módulo (Prioridad 01 a 06)](#3-catálogo-canónico-de-entregables-por-módulo-prioridad-01-a-06)
   - [Ola 1A: Módulo 01 — Identidad, Registro de Usuarios y Casilla Electrónica (`01_registro-usuarios-casilla/`)](#ola-1a-módulo-01--identidad-registro-de-usuarios-y-casilla-electrónica-01_registro-usuarios-casilla)
   - [Ola 1B: Módulo 02 — Administración Institucional, Seguridad RBAC y Auditoría (`02_administracion-seguridad-auditoria/`)](#ola-1b-módulo-02--administración-institucional-seguridad-rbac-y-auditoría-02_administracion-seguridad-auditoria)
   - [Ola 1C: Módulo 03 — Flujos Académicos, Firma Digital y Validez Legal (`03_flujo-validez-legal/`)](#ola-1c-módulo-03--flujos-académicos-firma-digital-y-validez-legal-03_flujo-validez-legal)
   - [Ola 2: Módulo 04 — Registro Documentario, Ventanilla y Mesa de Partes (`04_registro-documentario/`)](#ola-2-módulo-04--registro-documentario-ventanilla-y-mesa-de-partes-04_registro-documentario)
   - [Ola 3: Módulo 05 — Bandejas del Servidor y Gestión de Expedientes (`05_gestion-expedientes/`)](#ola-3-módulo-05--bandejas-del-servidor-y-gestión-de-expedientes-05_gestion-expedientes)
   - [Ola 4: Módulo 06 — Indicadores de Gestión, KPIs MGD y Tableros Directivos (`06_reportes-tableros-control/`)](#ola-4-módulo-06--indicadores-de-gestión-kpis-mgd-y-tableros-directivos-06_reportes-tableros-control)
4. [Arquitectura Tecnológica de Referencia (Frontend Stack)](#4-arquitectura-tecnológica-de-referencia-frontend-stack)
5. [Estrategia de Desacoplamiento y Paralelismo (Contratos Zod y Mocks)](#5-estrategia-de-desacoplamiento-y-paralelismo-contratos-zod-y-mocks)
6. [Marco Normativo, Accesibilidad WCAG 2.1 AA y Regla LPAG 16:30 hrs](#6-marco-normativo-accesibilidad-wcag-21-aa-y-regla-lpag-1630-hrs)
7. [Rúbrica Pedagógica de Evaluación Vigesimal (174 Story Points)](#7-rúbrica-pedagógica-de-evaluación-vigesimal-174-story-points)

---

## 1. MATRIZ GLOBAL DE CONFORMIDAD Y OLAS DE PARALELISMO FRONTEND

La siguiente matriz presenta el estado pericial del frontend auditado en el repositorio (`src/` vs `docs/`), ordenado por el **Grafo Acíclico Dirigido (DAG)** de dependencias funcionales:

| Ola / Prioridad | Módulo / Subdominio | Equipo Oficial (Líder y Miembros) | Carga (SP) | Esquema Backend Sincronizado | Estado de Implementación en Código | % Conf. |
| :---: | :--- | :--- | :---: | :---: | :--- | :---: |
| **OLA 0**<br>*(Fundación)* | **Plataforma Compartida**<br>`src/shared/`, `src/api/` | **Transversal** *(Liderado por CoreLink)* | — | `sigd_audit`<br>*(CoreLink)* | Cliente Axios tipado, interceptor RFC 7807 (`X-Correlation-ID`), Design Tokens Tailwind CSS 4 y Layout `MainLayout.tsx`. | **90%** |
| **OLA 1A**<br>*(Paralelo)* | **Módulo 01 — Identidad y Casilla**<br>`01_registro-usuarios-casilla/` | **Matías Zumaeta (Líder)**, Sergio Serruche, Ángel Jesús Vásquez, Carito Curto *(Grupo 2)* | **26 SP** | `sigd_auth`<br>*(IdentiCore)* | Documentación exhaustiva (3 especificaciones técnicas). Wizard de registro, validación DNI/RUC M11 y Casilla Ley 29733 listos para codificación. | **80%** |
| **OLA 1B**<br>*(Paralelo)* | **Módulo 02 — Administración y RBAC**<br>`02_administracion-seguridad-auditoria/` | **Jhonatan Gonzales (Líder)**, Brayan Gato, Leonel Rivera Maxin, Cristian Macedo *(Grupo 4)* | **28 SP** | `sigd_org`<br>*(OrganiCore)* | **7 PANTALLAS COMPLETAS EN REACT 19** (`src/pages/administracion/`, PR #75, commit `4ec0c3a`): Hub, Usuarios, Roles, Auditoría, Maestras, Calendario LPAG y Seguridad. | **100%** |
| **OLA 1C**<br>*(Paralelo)* | **Módulo 03 — Validez Legal y Firmas**<br>`03_flujo-validez-legal/` | **Adriano Espinoza (Líder)**, Isaí Pizango, Mayra García *(Grupo 5)* | **29 SP** | `sigd_doc`<br>*(DocuCore)* | Documentación cerrada (6 especificaciones + DBML). Contratos OpenAPI 3.1, pasarela Refirma RENIEC, validador público CVD y plantillas JSON Schema. | **85%** |
| **OLA 2**<br>*(Transaccional)* | **Módulo 04 — Registro Documentario**<br>`04_registro-documentario/` | **Patty Marina (Líder)**, Noelia Alva, Lucy López, Anllely Melgarejo *(Grupo 1)* | **34 SP** | `sigd_tra`<br>*(TramiCore)* | Documentación completa (3 especificaciones técnicas). Carga desacoplada MinIO con URLs prefirmadas, Wizard MPV 24x7, corte 16:30 hrs y generación CUT. | **80%** |
| **OLA 3**<br>*(Workflow)* | **Módulo 05 — Bandeja de Expedientes**<br>`05_gestion-expedientes/` | **Isack Vargas (Líder)**, Willfredo Soria, Piero Bartra *(Grupo 3)* | **28 SP** | `sigd_rut`<br>*(RutaDoc)* | Documentación cerrada (3 especificaciones técnicas). Bandeja del servidor de 6 pestañas, semáforo SLA LPAG (30 días), CCD archivística AGN y foliado inmutable. | **80%** |
| **OLA 4**<br>*(Analítica)* | **Módulo 06 — Reportes y Tableros MGD**<br>`06_reportes-tableros-control/` | **Fernando Urquia (Líder)**, Lloner Vargas, Daniel Gatica, Christian Barbarán *(Grupo 6)* | **29 SP** | Capa Analítica Global | Documentación completa (6 especificaciones + DBML). Fórmulas matemáticas de desempeño MGD-PCM (TAO, TPT, ICL, PEO) y cuadrículas ejecutivas accesibles. | **85%** |
| **TOTAL** | **6 Módulos Funcionales + Base** | **22 Estudiantes del PE DSI** | **174 SP** | **6 Esquemas Canónicos** | **Consolidación General de Arquitectura Frontend** | **85.7%** |

---

## 2. DOCUMENTOS MAESTROS DE ARQUITECTURA Y AUDITORÍA FORENSE

* 🏛️ [**Arquitectura y Orden de Implementación en Paralelo (`00_ARQUITECTURA_ORDEN_IMPLEMENTACION_PARALELO.md`)**](00_ARQUITECTURA_ORDEN_IMPLEMENTACION_PARALELO.md)  
  *Define el Grafo Acíclico Dirigido (DAG) de 5 Olas, la arquitectura de contratos TypeScript desacoplados, la política de Mocking con TanStack Query v5, la gestión centralizada de excepciones RFC 7807 y los lineamientos de accesibilidad WCAG 2.1 AA.*

* 📘 [**Plan de Trabajo General, Blueprint de Arquitectura y Plantillas (`PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md`)**](PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md)  
  *Blueprint estructural del frontend en React 19 + TypeScript 5.9 + Tailwind CSS 4 + Vite 6. Define el Atomic Design institucional, diseño de plantillas SPA, estados reactivos de formulario y el catálogo de design tokens institucionales.*

* 📋 [**Informe de Auditoría Técnica y Diagnóstico Forense (`INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md`)**](INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md)  
  *Inspección pericial de ramas Git (`F_*`), análisis forense del PR #75, evaluación de autorías individuales, trazabilidad de commits y resolución de discrepancias en la estructura de carpetas.*

* 🎓 [**Plan de Trabajo Modular y Rúbrica Docente de Evaluación Vigesimal (`PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md`)**](PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md)  
  *Instrumento pedagógico oficial de evaluación. Desglosa los 174 Story Points (SP) en 32 entregables atómicos individuales, distribuidos con precisión nominal entre los 22 estudiantes bajo la escala vigesimal (0 a 20).*

---

## 3. CATÁLOGO CANÓNICO DE ENTREGABLES POR MÓDULO (PRIORIDAD 01 A 06)

### Ola 1A: Módulo 01 — Identidad, Registro de Usuarios y Casilla Electrónica (`01_registro-usuarios-casilla/`)
*Sincronizado con esquema `sigd_auth` (IdentiCore) · Sub-Equipo Responsable: Grupo 2 (Matías Zumaeta, Sergio Serruche, Ángel Jesús Vásquez, Carito Curto)*

Responsable de la interfaz ciudadana para el registro y validación de identidad (DNI / RUC con Módulo 11), consentimiento expreso según la Ley N° 29733, selector geográfico en cascada adaptado a Ucayali y la Casilla Electrónica con acuse notificatorio legal.

* 🎯 **Plan Modular y Evaluación Docente (26 SP):** [`01_registro-usuarios-casilla/00_plan_de_trabajo_y_evaluacion_docente.md`](01_registro-usuarios-casilla/00_plan_de_trabajo_y_evaluacion_docente.md)
* 👤 **01. Registro de Ciudadanos, Persona Natural y Jurídica:** [`01_registro-usuarios-casilla/01_registro_ciudadano_persona_natural_juridica.md`](01_registro-usuarios-casilla/01_registro_ciudadano_persona_natural_juridica.md)  
  *Wizard de 3 pasos, validación DNI (8 dígitos) ante servicio RENIEC stub, validación RUC (11 dígitos, prefijos 10/20) y captura de consentimiento informado Ley 29733.*
* 🗺️ **02. Selector de Ubigeo en Cascada para Ucayali y SIAGIE:** [`01_registro-usuarios-casilla/02_ubigeo_cascada_ucayali_siagie.md`](01_registro-usuarios-casilla/02_ubigeo_cascada_ucayali_siagie.md)  
  *Selector anidado Departamento $\rightarrow$ Provincia $\rightarrow$ Distrito $\rightarrow$ Centro Poblado con precarga de las 4 provincias de Ucayali (Coronel Portillo, Atalaya, Padre Abad, Purús) y normalización INEI/SIAGIE.*
* 📬 **03. Casilla Electrónica Ciudadana y Acuse Notificatorio:** [`01_registro-usuarios-casilla/03_casilla_electronica_y_ley_29733.md`](01_registro-usuarios-casilla/03_casilla_electronica_y_ley_29733.md)  
  *Bandeja de notificaciones administrativas con estado de lectura, cómputo del acuse de recibo con marca temporal legal y descarga de cédula de notificación.*

---

### Ola 1B: Módulo 02 — Administración Institucional, Seguridad RBAC y Auditoría (`02_administracion-seguridad-auditoria/`)
*Sincronizado con esquema `sigd_org` (OrganiCore) · Sub-Equipo Responsable: Grupo 4 (Jhonatan Gonzales, Brayan Gato, Leonel Rivera Maxin, Cristian Macedo)*

Responsable de la gobernanza global del sistema: gestión de tablas maestras, organigrama institucional con jerarquía `ltree`, matriz de roles y permisos RBAC, bitácora forense de eventos inmutables y cómputo del calendario laboral LPAG (corte 16:30 hrs). **Módulo con implementación física en React 19 completada (PR #75)**.

* 🎯 **Plan Modular y Evaluación Docente (28 SP):** [`02_administracion-seguridad-auditoria/00_plan_de_trabajo_y_evaluacion_docente.md`](02_administracion-seguridad-auditoria/00_plan_de_trabajo_y_evaluacion_docente.md)
* 🏛️ **01. Descripción General de Administración y Gobernanza:** [`02_administracion-seguridad-auditoria/01_descripcion_general_administracion.md`](02_administracion-seguridad-auditoria/01_descripcion_general_administracion.md)  
  *Arquitectura del Panel Hub (`AdministracionPage.tsx`), navegación modular y políticas de gobernanza DSI.*
* 🗂️ **02. Mantenimiento de Tablas Maestras y Catálogos TUPA:** [`02_administracion-seguridad-auditoria/02_tablas_maestras_y_catalogos.md`](02_administracion-seguridad-auditoria/02_tablas_maestras_y_catalogos.md)  
  *CRUD reactivo de sedes, áreas académicas y administrativas en árbol jerárquico, cargos y procedimientos TUPA institucionales.*
* 🛡️ **03. Control de Acceso Basado en Roles (RBAC) y Matriz de Permisos:** [`02_administracion-seguridad-auditoria/03_control_acceso_roles_permisos_rbac.md`](02_administracion-seguridad-auditoria/03_control_acceso_roles_permisos_rbac.md)  
  *Matriz interactiva bidimensional de roles (SuperAdmin, Funcionario, MesaPartes, Alumno) vs operaciones atómicas (Create, Read, Update, Delete, Sign, Dispatch).*
* 📜 **04. Logs de Auditoría Inmutable y Bitácora Forense:** [`02_administracion-seguridad-auditoria/04_logs_auditoria_inmutable_trazabilidad.md`](02_administracion-seguridad-auditoria/04_logs_auditoria_inmutable_trazabilidad.md)  
  *Visor forense de eventos con filtros multicriterio por `x-correlation-id`, usuario, entidad afectada, dirección IP y rango de fechas con exportación auditada.*
* 👥 **05. Directorio de Usuarios y Políticas de Seguridad de Acceso:** [`02_administracion-seguridad-auditoria/05_directorio_usuarios_y_seguridad_acceso.md`](02_administracion-seguridad-auditoria/05_directorio_usuarios_y_seguridad_acceso.md)  
  *Gestión del ciclo de vida de usuarios institucionales, bloqueo por intentos fallidos, reseteo de claves y políticas de contraseñas fuertes.*
* 📅 **06. Calendario Laboral y Cómputo de Plazos LPAG (Corte 16:30 hrs):** [`02_administracion-seguridad-auditoria/06_calendario_laboral_y_jornada_lpag.md`](02_administracion-seguridad-auditoria/06_calendario_laboral_y_jornada_lpag.md)  
  *Gestor de días no laborables regionales/nacionales, cómputo estricto de días hábiles TUO Ley N° 27444 y corte automático de jornada a las 16:30 hrs.*

---

### Ola 1C: Módulo 03 — Flujos Académicos, Firma Digital y Validez Legal (`03_flujo-validez-legal/`)
*Sincronizado con esquema `sigd_doc` (DocuCore) · Sub-Equipo Responsable: Grupo 5 (Adriano Espinoza, Isaí Pizango, Mayra García)*

Responsable de la redacción estructurada de documentos oficiales, validación esquemática vía JSON Schema Draft 2020-12, workflow de proyección de resoluciones directoriales, integración con la pasarela de firma digital Refirma de RENIEC y verificación pública mediante Código de Verificación Digital (CVD) y QR.

* 🎯 **Plan Modular y Evaluación Docente (29 SP):** [`03_flujo-validez-legal/00_plan_de_trabajo_y_evaluacion_docente.md`](03_flujo-validez-legal/00_plan_de_trabajo_y_evaluacion_docente.md)
* 📋 **01. Descripción General del Módulo de Validez Legal:** [`03_flujo-validez-legal/01_descripcion_general_validez_legal.md`](03_flujo-validez-legal/01_descripcion_general_validez_legal.md)
* 🎓 **02. Flujos de Trabajo Workflow Académico y Titulación:** [`03_flujo-validez-legal/02_flujos_trabajo_workflow_academico.md`](03_flujo-validez-legal/02_flujos_trabajo_workflow_academico.md)  
  *Máquina de estados finitos (FSM) para solicitudes de matrícula, convalidación, certificados de estudio y expedientes de titulación profesional técnica.*
* 📝 **03. Documentos Oficiales y Proyección de Resoluciones:** [`03_flujo-validez-legal/03_documentos_oficiales_firma_digital.md`](03_flujo-validez-legal/03_documentos_oficiales_firma_digital.md)  
  *Editor estructurado de resoluciones directoriales, proveídos y oficios con campos variables tipados y previsualización PDF/A en tiempo real.*
* 🔏 **04. Validez Legal, Pasarela Refirma RENIEC y Validador CVD:** [`03_flujo-validez-legal/04_validez_legal_y_validador_cvd.md`](03_flujo-validez-legal/04_validez_legal_y_validador_cvd.md)  
  *Protocolo de invocación de firma digital acreditada (IOFE/RENIEC), sellado de tiempo criptográfico (TSA) y validador web público mediante CVD de 16 caracteres y código QR.*
* 🔌 **05. Arquitectura Técnica y Contratos de Integración API:** [`03_flujo-validez-legal/05_arquitectura_tecnica_y_contratos_api.md`](03_flujo-validez-legal/05_arquitectura_tecnica_y_contratos_api.md)
* 🖥️ **06. Componentes de Interfaz UI y Visores Documentales:** [`03_flujo-validez-legal/06_componentes_interfaz_ui.md`](03_flujo-validez-legal/06_componentes_interfaz_ui.md)  
  *Visor PDF integrado con zoom, navegación por páginas y visor de capas de firmas digitales.*
* 📊 **Diagrama de Datos DBML:** [`03_flujo-validez-legal/diagrama_flujo_validez_legal.dbml`](03_flujo-validez-legal/diagrama_flujo_validez_legal.dbml)

---

### Ola 2: Módulo 04 — Registro Documentario, Ventanilla y Mesa de Partes (`04_registro-documentario/`)
*Sincronizado con esquema `sigd_tra` (TramiCore) · Sub-Equipo Responsable: Grupo 1 (Patty Marina, Noelia Alva, Lucy López, Anllely Melgarejo)*

Responsable de la recepción y registro oficial de documentos tanto en Ventanilla Presencial como en la Mesa de Partes Virtual (MPV 24x7). Implementa la carga desacoplada directa a MinIO con cálculo de hash SHA-256 en cliente, foliación automática y generación del Código Único de Trámite (CUT) con cargo de recepción sellado.

* 🎯 **Plan Modular y Evaluación Docente (34 SP):** [`04_registro-documentario/00_plan_de_trabajo_y_evaluacion_docente.md`](04_registro-documentario/00_plan_de_trabajo_y_evaluacion_docente.md)
* ☁️ **01. Arquitectura Técnica de Registro y Carga Desacoplada MinIO:** [`04_registro-documentario/01_arquitectura_tecnica_registro_documentario.md`](04_registro-documentario/01_arquitectura_tecnica_registro_documentario.md)  
  *Patrón de subida directa S3 mediante URLs prefirmadas (`presigned PUT URLs`), minimizando la carga en el servidor backend.*
* 📥 **02. Especificación Funcional de Ventanilla Presencial y MPV:** [`04_registro-documentario/02_especificacion_funcional_ventanilla_y_mesa_partes.md`](04_registro-documentario/02_especificacion_funcional_ventanilla_y_mesa_partes.md)  
  *Regla de jornada hábil: documentos ingresados después de las 16:30 hrs o en días no laborables reciben fecha formal del siguiente día hábil institucional.*
* 🧩 **03. Componentes UI y Estados Reactivos de Formularios:** [`04_registro-documentario/03_componentes_ui_y_estados_formulario.md`](04_registro-documentario/03_componentes_ui_y_estados_formulario.md)  
  *Wizard de registro de 4 pasos (Remitente, Documento, Anexos y Confirmación), dropzone interactivo con validación de tipo MIME y vista previa del cargo.*

---

### Ola 3: Módulo 05 — Bandejas del Servidor y Gestión de Expedientes (`05_gestion-expedientes/`)
*Sincronizado con esquema `sigd_rut` (RutaDoc) · Sub-Equipo Responsable: Grupo 3 (Isack Vargas, Willfredo Soria, Piero Bartra)*

Responsable de la interfaz diaria de trabajo de los servidores y docentes del instituto. Gestiona la bandeja operativa segmentada en 6 pestañas, la derivación de expedientes con asignación de plazos máximos según LPAG, el Cuadro de Clasificación Documental (CCD) según el Archivo General de la Nación (AGN) y la trazabilidad inmutable del expediente.

* 🎯 **Plan Modular y Evaluación Docente (28 SP):** [`05_gestion-expedientes/00_plan_de_trabajo_y_evaluacion_docente.md`](05_gestion-expedientes/00_plan_de_trabajo_y_evaluacion_docente.md)
* 🗃️ **01. Bandeja de Trabajo Diario del Servidor (6 Pestañas y Semáforo SLA):** [`05_gestion-expedientes/01_bandeja_trabajo_diario_6_pestanas.md`](05_gestion-expedientes/01_bandeja_trabajo_diario_6_pestanas.md)  
  *Organización en 6 vistas operativas: `Recibidos`, `Pendientes`, `En Trámite`, `Para Despacho/Firma`, `Archivados` y `Derivados`. Semáforo de alerta LPAG: Verde ($\le 15$ días), Amarillo ($16$ a $25$ días) y Rojo ($> 25$ días o vencido).*
* 📚 **02. Cuadro de Clasificación Documental (CCD) y Archivística AGN:** [`05_gestion-expedientes/02_cuadro_clasificacion_documental_ccd_y_archivistica.md`](05_gestion-expedientes/02_cuadro_clasificacion_documental_ccd_y_archivistica.md)  
  *Taxonomía de series y subseries documentales, períodos de retención y control de foliación progresiva.*
* 🧬 **03. Modelo de Datos TypeScript y Trazabilidad Inmutable:** [`05_gestion-expedientes/03_modelo_datos_typescript_y_trazabilidad_inmutable.md`](05_gestion-expedientes/03_modelo_datos_typescript_y_trazabilidad_inmutable.md)  
  *Línea de tiempo interactiva de movimientos, auditoría de recepciones y registro inalterable de proveídos de derivación.*

---

### Ola 4: Módulo 06 — Indicadores de Gestión, KPIs MGD y Tableros Directivos (`06_reportes-tableros-control/`)
*Sincronizado con la Capa Analítica Global · Sub-Equipo Responsable: Grupo 6 (Fernando Urquia, Lloner Vargas, Daniel Gatica, Christian Barbarán)*

Responsable de los paneles ejecutivos de monitoreo en tiempo real para la Dirección General, Jefatura Académica y Área de Administración. Consolida las métricas oficiales del Modelo de Gestión Documental de la PCM, volumetría de expedientes y reportes estadísticos exportables.

* 🎯 **Plan Modular y Evaluación Docente (29 SP):** [`06_reportes-tableros-control/00_plan_de_trabajo_y_evaluacion_docente.md`](06_reportes-tableros-control/00_plan_de_trabajo_y_evaluacion_docente.md)
* 📊 **01. Descripción General de Reportes y Tableros Directivos:** [`06_reportes-tableros-control/01_descripcion_general_reportes_dashboard.md`](06_reportes-tableros-control/01_descripcion_general_reportes_dashboard.md)
* 📈 **02. Catálogo de KPIs y Métricas Institucionales MGD:** [`06_reportes-tableros-control/02_catalogo_kpis_y_metricas_institucionales.md`](06_reportes-tableros-control/02_catalogo_kpis_y_metricas_institucionales.md)  
  *Indicadores oficiales: **TAO** (Tiempo Promedio de Atención Operativa), **TPT** (Tasa de Productividad por Trámite), **ICL** (Índice de Cumplimiento Legal de Plazos LPAG) y **PEO** (Porcentaje de Expedientes Observados).*
* 🧮 **03. Fuentes de Datos y Fórmulas Matemáticas de Desempeño:** [`06_reportes-tableros-control/03_fuentes_datos_formulas_matematicas.md`](06_reportes-tableros-control/03_fuentes_datos_formulas_matematicas.md)  
  *Definición matemática formal de agregaciones, exclusión de días no laborables en cálculos de latencia y promedios móviles institucionales.*
* 🎨 **04. Diseño Visual, Cuadrículas y Gráficos Estadísticos:** [`06_reportes-tableros-control/04_diseno_visual_graficos_y_componentes.md`](06_reportes-tableros-control/04_diseno_visual_graficos_y_componentes.md)  
  *Tableros modulares construidos con Recharts, gráficos de líneas de tendencia, barras de carga por área y donas de estado documental.*
* ♿ **05. Navegación, Filtros Multicriterio y Accesibilidad UX:** [`06_reportes-tableros-control/05_navegacion_filtros_y_accesibilidad_ux.md`](06_reportes-tableros-control/05_navegacion_filtros_y_accesibilidad_ux.md)  
  *Filtros reactivos por rango de fechas, carrera profesional y sede. Cumplimiento WCAG 2.1 AA en tablas de datos y exportación a PDF y Excel.*
* ⚙️ **06. Arquitectura Frontend y Plan de Pruebas de Métricas:** [`06_reportes-tableros-control/06_arquitectura_frontend_y_plan_pruebas.md`](06_reportes-tableros-control/06_arquitectura_frontend_y_plan_pruebas.md)
* 📊 **Diagrama de Datos DBML:** [`06_reportes-tableros-control/diagrama_metricas_dashboard.dbml`](06_reportes-tableros-control/diagrama_metricas_dashboard.dbml)

---

## 4. ARQUITECTURA TECNOLÓGICA DE REFERENCIA (FRONTEND STACK)

El frontend del SIGD se construye sobre un stack moderno y eficiente optimizado para aplicaciones SPA de misión crítica:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAPA DE PRESENTACIÓN (SPA)                        │
│   React 19  │  React Router v7  │  Tailwind CSS 4  │  Lucide React Icons    │
├─────────────────────────────────────────────────────────────────────────────┤
│                           CAPA DE ESTADO Y DATOS                            │
│   TanStack Query v5 (Servidor / Caché)  │  Zustand / React Context (Local)  │
├─────────────────────────────────────────────────────────────────────────────┤
│                           CAPA DE COMUNICACIÓN HTTP                         │
│   Axios Client  │  Interceptors (X-Correlation-ID, RFC 7807)  │  Zod Schemas│
└─────────────────────────────────────────────────────────────────────────────┘
```

| Componente | Tecnología | Versión | Responsabilidad en el Sistema |
| :--- | :--- | :---: | :--- |
| **Core UI** | React | `19.x` | Renderizado declarativo basado en componentes y hooks funcionales. |
| **Lenguaje** | TypeScript | `5.9.x` | Tipado estático estricto, contratos de dominio e interfaces de API. |
| **Bundler / Servidor** | Vite | `6.x` | Compilación ESM instantánea y hot-module replacement (HMR). |
| **Estilos** | Tailwind CSS | `4.x` | Clases de utilidad con variables de diseño institucional del IESTP "Suiza". |
| **Enrutamiento** | React Router DOM | `7.x` | Enrutamiento declarativo, layouts jerárquicos y guardianes RBAC. |
| **Estado Asíncrono** | TanStack Query | `5.x` | Cacheo de peticiones, mutaciones optimistas y sincronización reactiva. |
| **Validación de Formularios** | React Hook Form + Zod | `7.x` / `3.x` | Formularios de alto rendimiento y validación declarativa tipada. |
| **Visualización PDF** | react-pdf / PDF.js | `9.x` | Renderizado integrado en cliente de documentos y cargos con sello. |

---

## 5. ESTRATEGIA DE DESACOPLAMIENTO Y PARALELISMO (CONTRATOS ZOD Y MOCKS)

Para garantizar que los **6 grupos de desarrollo puedan avanzar en simultáneo** sin esperar a que los endpoints del backend estén desplegados, se implementa el patrón **Contract-First con Mocks Tipados**:

```text
               ┌──────────────────────────────────────┐
               │    Contrato TypeScript / Zod Schema  │
               │   (Fuente Única de Verdad de Tipos)  │
               └──────────────────┬───────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Modo Desarrollo / Stubs     │       │     Modo Integración / Real     │
│   TanStack Query Mock Handlers  │       │       Axios HTTP Client         │
│   (Fixtures JSON locales)       │       │    (Backend PostgreSQL 18)      │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

1. **Ubicación de Contratos:** Cada módulo expone sus esquemas en `src/types/[modulo].ts`.
2. **Definición de Fixtures:** Se proporcionan stubs locales tipados que simulan respuestas exitosas y errores RFC 7807.
3. **Bandera de Conmutación:** El archivo `.env` controla el origen de los datos:
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   VITE_ENABLE_MOCKS=false # true durante desarrollo aislado
   ```

---

## 6. MARCO NORMATIVO, ACCESIBILIDAD WCAG 2.1 AA Y REGLA LPAG 16:30 HRS

La interfaz de usuario del SIGD cumple obligatoriamente con el marco legal peruano de gobierno digital:

1. **Texto Único Ordenado de la Ley N° 27444 (LPAG):**
   - **Regla de Corte Diario:** Todo trámite ingresado por Mesa de Partes Virtual pasadas las **16:30 hrs** o en días feriados/inhábiles muestra un banner informativo notificando al administrado que su registro surtirá efectos formales a primera hora del **siguiente día hábil**.
   - **Cómputo de Plazos:** Plazos máximos legales de 30 días hábiles visualizados mediante semáforo de criticidad.
2. **Ley N° 29733 (Protección de Datos Personales):**
   - Casilla de verificación mandatoria de consentimiento informado con registro de fecha, IP y versión de los términos aceptados.
3. **Pautas de Accesibilidad Web (WCAG 2.1 Nivel AA):**
   - Ratio de contraste visual mínimo de **4.5:1** para texto regular y **3:1** para componentes gráficos.
   - Navegación completa mediante teclado (`Tab`, `Shift+Tab`, `Enter`, `Escape`) con indicadores de foco visibles.
   - Compatibilidad total con lectores de pantalla mediante etiquetas semánticas HTML5 y atributos ARIA (`aria-label`, `aria-expanded`, `aria-live`).

---

## 7. RÚBRICA PEDAGÓGICA DE EVALUACIÓN VIGESIMAL (174 STORY POINTS)

Conforme a la directiva pedagógica del **Plan de Trabajo Modular y Rúbrica Docente**, el desarrollo del frontend se evalúa sobre la escala vigesimal peruana (**0 a 20**) a partir del cumplimiento riguroso de los **174 Story Points**:

$$\text{Nota Final} = \left( \frac{\text{Story Points Completados}}{\text{Story Points Asignados}} \times 14 \right) + \text{Calidad Técnica y Código (0-3)} + \text{Accesibilidad y UX (0-3)}$$

### Distribución de Carga por Módulo y Grupo:

| Grupo Académico | Líder de Grupo | Módulo Asignado | Story Points | Entregables Evaluados |
| :---: | :--- | :--- | :---: | :---: |
| **Grupo 1** | Patty Marina | `04_registro-documentario` (TramiCore UI) | **34 SP** | 6 entregables |
| **Grupo 2** | Matías Zumaeta | `01_registro-usuarios-casilla` (IdentiCore UI) | **26 SP** | 5 entregables |
| **Grupo 3** | Isack Vargas | `05_gestion-expedientes` (RutaDoc UI) | **28 SP** | 5 entregables |
| **Grupo 4** | Jhonatan Gonzales | `02_administracion-seguridad-auditoria` (OrganiCore UI) | **28 SP** | 6 entregables |
| **Grupo 5** | Adriano Espinoza | `03_flujo-validez-legal` (DocuCore UI) | **29 SP** | 5 entregables |
| **Grupo 6** | Fernando Urquia | `06_reportes-tableros-control` (Analítica UI) | **29 SP** | 5 entregables |
| **TOTAL** | **6 Sub-Equipos** | **Ecosistema Completo Frontend SIGD** | **174 SP** | **32 Entregables** |

> Para consultar el detalle nominal de cada uno de los 22 estudiantes y sus criterios específicos de evaluación, remitirse a:  
> 🎓 [**Plan de Trabajo Modular y Rúbrica Docente de Evaluación Vigesimal (`PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md`)**](PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md).

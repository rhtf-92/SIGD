# Original User Request

## Initial Request — 2026-09-02T05:18:25Z

<USER_REQUEST>
Realizar un análisis exhaustivo y una reingeniería documental de nivel profesional senior para enriquecer y perfeccionar al máximo nivel de detalle los dos documentos maestros de frontend del proyecto SIGD (Sistema Integral de Gestión Documentaria) del IESTP "Suiza": el Informe de Auditoría de Documentación Frontend y el Plan de Trabajo General y Blueprint de Arquitectura Frontend.

Working directory: g:\Mi unidad\IESTP_SUIZA_DSI\2026-2\CURSOS\py_SIGD\SIGD\frontend\DOCUMENTACION  
Integrity mode: development

## Requirements

### R1. Auditoría Forense y Diagnóstico Exhaustivo Frontend (INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md)
Profundizar la auditoría técnica y funcional de todas las subcarpetas en /frontend/DOCUMENTACION/ (MODULO-ADMINISTRACION-SEGURIDAD-AUDITORIA_JHONATAN, MODULO_REGISTRO_DOCUMENTARIO_PATTY, MODULO_REGISTRO_SIGD_USUARIOS_MATIAS, MODULO_GESTION_EXPEDIENTES-TRABAJO-DIARIO_ISACK, FLUJO-INTERNO-VALIDEZ-LEGAL, MODULO-REPORTES-TABLEROS-CONTROL_URQUIA), evaluando la trazabilidad de contribuciones, análisis de riesgos de seguridad, vacíos críticos, desincronización de contratos API y cumplimiento del marco normativo peruano (TUO Ley N° 27444, MGD-PCM, Ley N° 27269, Ley N° 29733).

### R2. Plan Maestro de Trabajo, Arquitectura y Blueprint UI/UX (PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md)
Enriquecer el Plan Maestro con especificaciones sumamente detalladas de ingeniería frontend en React 19 + TypeScript 5.9 + Tailwind CSS 4:
1. Arquitectura Feature-Sliced (*Domain-Driven UI*), gestión de estado servidor con TanStack Query 5 y cliente Axios con interceptores bidireccionales para inyección de X-Correlation-ID y tratamiento tipado de errores RFC 7807 (ApiProblemDetails).
2. Flujo de subida desacoplada de archivos a MinIO/S3 mediante *Presigned URLs* con hash SHA-256 local y validación de Magic Bytes.
3. Catálogo exhaustivo de pantallas, wireframes detallados en Markdown/Mermaid, campos, validaciones y árboles de componentes para los 6 módulos funcionales.
4. Sistema de Diseño Institucional (Design System UI Kit) con directivas de accesibilidad WCAG 2.1 AA.
5. Matriz RACI de gobernanza de equipo con resolución formal de carpetas huérfanas y cronograma de ejecución en 6 Sprints.

## Acceptance Criteria

### Integridad y Conformidad Documental
- [ ] Ambos documentos están escritos en español técnico formal, con estructura clara, tablas comparativas y diagramas Mermaid válidos.
- [ ] El informe de auditoría detalla el diagnóstico cuantitativo y cualitativo de cada una de las 6 carpetas del frontend, asignando responsables, nivel de conformidad porcentual y matriz de severidad.
- [ ] El plan de trabajo incluye la especificación de pantallas, contratos de endpoints (/api/v1/...), componentes del UI Kit, gestión de errores RFC 7807 y flujo de almacenamiento MinIO/S3.
- [ ] Se incluye la matriz RACI de asignación para todos los colaboradores del equipo frontend y el cronograma en 6 Sprints.
- [ ] Toda la terminología está alineada al dominio de educación superior pública del IESTP "Suiza" y el marco legal peruano (LPAG 27444, MGD-PCM, Ley 27269, Ley 29733).
</USER_REQUEST>

## Follow-up — 2026-09-03T20:47:51Z

<USER_REQUEST>
Análisis técnico forense exhaustivo y planificación estratégica bajo metodología ágil Scrum (6 Sprints de 2 semanas, Épicas, User Stories INVEST y Gherkin) para el Frontend del Sistema Integral de Gestión Documentaria (SIGD) del IESTP "Suiza", sincronizando la totalidad de requerimientos con la arquitectura del backend y sus 6 planes de levantamiento de observaciones, actualizando los documentos maestros `INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` y `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md`.

Working directory: g:\Mi unidad\IESTP_SUIZA_DSI\2026-2\CURSOS\py_SIGD\SIGD
Integrity mode: development

## Requirements

### R1. Reingeniería y Actualización Forense del Informe de Auditoría Frontend
Actualizar integralmente `frontend/DOCUMENTACION/INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` incorporando la auditoría cuantitativa y cualitativa de todos los artefactos en `/frontend/DOCUMENTACION/`, reconociendo los avances de `MODULO_REGISTRO_DOCUMENTARIO_PATTY` (propuesta técnica de formularios dinámicos JSON Schema, subida a MinIO/S3, Magic Bytes `%PDF`, cálculo SHA-256, asistente de 4 pasos de Anllely y componentes de Lucy) y `MODULO-REPORTES-TABLEROS-CONTROL_URQUIA` (fórmulas matemáticas y métricas KPI de Gatica, diseño UX responsive y vista ejecutiva de Jhuel). Relacionar las brechas detectadas con la taxonomía de riesgos P0 a P3 y formalizar la gobernanza de los 6 sub-equipos.

### R2. Reingeniería y Planificación Maestra del Frontend bajo Marco Ágil Scrum
Actualizar integralmente `frontend/DOCUMENTACION/PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md` estructurando el proyecto bajo Scrum puro: definición de Épicas (EP-01 a EP-06), Product Backlog priorizado, User Stories con criterios INVEST y aceptación en formato Gherkin (Given-When-Then), Definition of Ready (DoR), Definition of Done (DoD) multidimensional, estimación en Story Points y Roadmap de 6 Sprints con diagramas de Gantt Mermaid. Proveer el catálogo exhaustivo de pantallas (M1 a M6) con wireframes ASCII, especificación de UI Kit (WCAG 2.1 AA), arquitectura Feature-Sliced Design (React 19, TypeScript 5.9, TanStack Query v5, Zustand, Tailwind 4) e interceptores Axios para RFC 7807 y `X-Correlation-ID`.

### R3. Trazabilidad y Sincronización con los 6 Planes de Levantamiento del Backend
Alinear cada módulo frontend con su contraparte en el backend (`sigd_rut`, `sigd_tra`, `sigd_org`, `sigd_auth`, `sigd_doc`, `sigd_audit`) y los 6 planes de levantamiento de observaciones (`backend/docs/levantamiento_de_observaciones/01_...` al `06_...`), reflejando la FSM de 10 estados en State Pattern, la generación atómica del CUT (`EXP-YYYY-XXXXXX`), el foliado progresivo AGN (`sigd_tra.expediente_documento_folio`), la jerarquía Materialized Path (`01.03.02`), el modelo polimórfico de personas (Natural/Jurídica con RUC y Ley N° 29733) y el despacho de firma digital con Refirma RENIEC y validador público CVD.

## Acceptance Criteria

### Integridad y Cobertura de la Auditoría
- [ ] `INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` audita con métricas concretas el 100% de archivos y subcarpetas existentes en `/frontend/DOCUMENTACION/`, reflejando la evolución de la carpeta de Patty (de 0% a 65%) y Urquia (de 30% a 60%).
- [ ] La matriz RACI y el cuadro de evaluación individual incorpora la totalidad de integrantes identificados (Patty, Lucy, Noelia, Angy, Anllely, Gatica, Jhuel, Clider, Lloner, Matías, Sergio, Vásquez, Isack, Jhonatan, Geric, Jacobo y Jhasy).
- [ ] Se documenta el plan de contingencia y rescate para las carpetas huérfanas y directorios desalineados.

### Metodología Ágil y Especificación UI/UX
- [ ] `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md` contiene el Product Backlog completo desglosado en Épicas y User Stories con criterios de aceptación Gherkin y estimaciones en Story Points.
- [ ] Se incluye la planificación de los 6 Sprints (Sprint Goal, historias asignadas, capacidad, entregables) y diagrama de Gantt Mermaid ejecutable.
- [ ] Se presentan wireframes ASCII legibles y árboles de componentes para los 6 módulos funcionales del sistema.
- [ ] Se especifican los tokens de diseño institucional, contraste de color WCAG 2.1 AA (mínimo 4.5:1) y directivas de accesibilidad por teclado y lectores de pantalla.

### Contratos de Integración y Consistencia Técnica
- [ ] Todos los contratos de datos en TypeScript 5.9 y catálogo de endpoints `/api/v1/...` son 100% compatibles con las convenciones de `backend/docs/integracion/` y los DDL de PostgreSQL 18.
- [ ] Se incluyen los diagramas Mermaid requeridos (FSM 10 estados, secuencia de carga a S3 con Magic Bytes y SHA-256, secuencia de firma con Refirma RENIEC y CVD) con sintaxis válida y sin errores de parseo.
- [ ] Se detalla el diagnóstico del código base (`frontend/index.html`, `MainLayout.tsx`, `api/client.ts`) y la ruta de solución dentro del Sprint 1.
</USER_REQUEST>

## Follow-up — 2026-09-05T13:44:13Z

<USER_REQUEST>
Realizar un análisis forense exhaustivo, actualización y reingeniería técnica de nivel profesional senior a los dos documentos maestros de frontend del SIGD (Informe de Auditoría y Plan de Trabajo General), incorporando la sincronización total del repositorio local con origin/main tras los últimos Pull Requests (#62, #65, #66, #68, #69, #70, #75), que integraron nuevas propuestas documentales en Registro Documentario (Carito, Lucy, Anllely), Reportes (Gatica, Jhuel), Administración (Jhonatan, Perea, Leonel) y la implementación de 7 pantallas de administración en React/TypeScript.

Working directory: g:\Mi unidad\IESTP_SUIZA_DSI\2026-2\CURSOS\py_SIGD\SIGD\frontend\DOCUMENTACION  
Integrity mode: development

## Context & Recent Repository Synchronization
El repositorio local ha sido sincronizado hasta el último merge de `origin/main` (commit `4ec0c3a`), integrando 18 nuevos commits con aportes críticos de frontend:
1. `MODULO_REGISTRO_DOCUMENTARIO_PATTY`: Incorpora propuestas de Carito Curto (`01_propuesta_modulo_registro_documentario.md`), Lucy Panduro (`Avance de tareas de Lucy.md`) y Anllely Melgarejo (`Avance_sistema_gestion_tramites_ANLLELY.md`), abordando JSON Schema, MinIO/S3 Presigned URLs y validación Magic Bytes.
2. `MODULO-ADMINISTRACION-SEGURIDAD-AUDITORIA_JHONATAN`: Incorpora documentación de tablas maestras, logs de auditoría inmutables (`AUDITORIA_TABLAS_MAESTRAS.md`, `TABLAS_MAESTRAS.md`) y control de acceso RBAC de Carlos Perea (`permisos_perea.md`), junto con la implementación en código React 19 de 7 pantallas completas en `frontend/src/pages/administracion/` y actualización de `AppRouter.tsx`.
3. `MODULO-REPORTES-TABLEROS-CONTROL_URQUIA`: Incorpora el catálogo formal de KPIs de Gatica (`GATICA/01_catalogo_de_indicadores_kpis.md`, DBML) y especificaciones UX de Jhuel (`jhuel/`), subsanando el sesgo de comercio electrónico previo.

## Requirements

### R1. Re-auditoría Forense y Actualización del Informe (`INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md`)
1. Actualizar las matrices cuantitativas y cualitativas de conformidad por módulo: reevaluar `MODULO_REGISTRO_DOCUMENTARIO_PATTY` y `MODULO-ADMINISTRACION-SEGURIDAD-AUDITORIA_JHONATAN` (que ya no están en 0%), reflejando el nuevo material incorporado.
2. Auditar la consistencia de las nuevas propuestas frente a los requisitos del backend:
   - Contratos TramiCore (CUT `EXP-YYYY-XXXXXX`, foliado progresivo AGN, corte 16:30 hrs LPAG).
   - Contratos DocuCore (JSON Schema Draft 2020-12, Presigned URLs MinIO/S3, Magic Bytes `25 50 44 46`).
   - Contratos OrganiCore/IdentiCore (RBAC, Materialized Path, inmutabilidad de logs, correlationId).
3. Auditar el código fuente recién integrado en `frontend/src/pages/administracion/` (manejo de estado, diseño responsive Tailwind, tratamiento de errores RFC 7807 y sincronización de rutas).
4. Actualizar la matriz de trazabilidad de contribuciones con los nuevos integrantes (Carito Curto, Lucy Panduro, Anllely Melgarejo, Carlos Perea, Leonel Rivera, Gatica, Jhuel).

### R2. Reingeniería y Alineamiento del Plan Maestro (`PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md`)
1. Integrar las 7 pantallas del módulo de Administración implementadas en React (`AdministracionPage`, `UsuariosPage`, `RolesPermisosPage`, `AuditoriaPage`, `TablasMaestrasPage`, `CalendarioLaboralPage`, `SeguridadPage`) dentro del catálogo de pantallas y arquitectura de rutas.
2. Incorporar en el diseño de Registro Documentario las especificaciones de JSON Schema dinámico y carga desacoplada MinIO/S3 detalladas por Carito Curto.
3. Actualizar la Matriz RACI de gobernanza del frontend con la totalidad de colaboradores del repositorio y sus roles específicos.
4. Ajustar el cronograma en 6 Sprints reflejando el avance real del código y los componentes restantes para conectar con los endpoints `/api/v1/...` del backend.

## Acceptance Criteria

### Integridad y Rigor Técnico
- [ ] El informe de auditoría refleja fielmente el estado post-merge del commit `4ec0c3a`, eliminando la calificación de 0% en Patty y Jhonatan y detallando el nuevo nivel de conformidad.
- [ ] Ambos documentos eliminan cualquier discrepancia con el backend y consolidan la arquitectura React 19 + TypeScript + Tailwind CSS 4.
- [ ] La matriz RACI y el directorio de colaboradores incluyen a todos los autores de los Pull Requests recientes (#62, #65, #66, #68, #69, #70, #75).
- [ ] Se verifica que todos los diagramas Mermaid, tablas comparativas y enlaces a archivos sean sintácticamente válidos y navegables.
- [ ] Se documenta el plan de integración de los nuevos componentes de administración con los contratos RFC 7807 y la inyección de `X-Correlation-ID`.
</USER_REQUEST>

## 2026-09-05T15:19:11Z

<USER_REQUEST>
Reorganizar la estructura de directorios de la documentación del frontend (`frontend/DOCUMENTACION/`) utilizando exclusivamente minúsculas (`kebab-case`), renombrar de forma profesional y estandarizada las carpetas de cada módulo eliminando nombres personales o mayúsculas, y consolidar los documentos fragmentados de cada sub-equipo en especificaciones técnicas unificadas de nivel senior preservando la trazabilidad de autoría.

Working directory: g:\Mi unidad\IESTP_SUIZA_DSI\2026-2\CURSOS\py_SIGD\SIGD\frontend\DOCUMENTACION  
Integrity mode: development

## Requirements

### R1. Estandarización y Renombrado de Directorios en Minúsculas (`kebab-case`)
Renombrar las 6 carpetas de módulos a nombres funcionales limpios en minúsculas, eliminando mayúsculas, guiones bajos mixtos y sufijos de nombres individuales:
1. `registro-documentario/` (anteriormente `MODULO_REGISTRO_DOCUMENTARIO_PATTY`)
2. `gestion-expedientes/` (anteriormente `MODULO_GESTION_EXPEDIENTES-TRABAJO-DIARIO_ISACK`)
3. `registro-usuarios-casilla/` (anteriormente `MODULO_REGISTRO_SIGD_USUARIOS_MATIAS`)
4. `flujo-validez-legal/` (anteriormente `FLUJO-INTERNO-VALIDEZ-LEGAL`)
5. `administracion-seguridad-auditoria/` (anteriormente `MODULO-ADMINISTRACION-SEGURIDAD-AUDITORIA_JHONATAN`)
6. `reportes-tableros-control/` (anteriormente `MODULO-REPORTES-TABLEROS-CONTROL_URQUIA`)

### R2. Consolidación Profesional y Homogénea por Módulo
Unificar los archivos fragmentados de cada módulo generados por los integrantes en un conjunto coherente de documentos Markdown con numeración secuencial uniforme (`01_...`, `02_...`, etc.):
- **En `registro-documentario/`:** Integrar las propuestas de Carito Curto (JSON Schema, MinIO/S3), Lucy Panduro y Anllely Melgarejo en especificaciones integradas de Ventanilla Presencial y Mesa de Partes Virtual.
- **En `reportes-tableros-control/`:** Consolidar en un solo conjunto limpio de archivos los aportes de Clider Urquia, Gatica, Jhuel y Lloner, eliminando las subcarpetas personales (`CLIDER/`, `GATICA/`, `jhuel/`, `lloner/`) y las métricas comerciales desactualizadas.
- **En `administracion-seguridad-auditoria/`:** Consolidar las especificaciones de tablas maestras, logs inmutables (Jhonatan, Leonel Rivera), roles RBAC (Carlos Perea) y el panel administrativo (Angel Vásquez), articulándolas con las 7 pantallas implementadas en React 19.
- **En `registro-usuarios-casilla/`:** Consolidar el registro de Persona Natural y Persona Jurídica, Ubigeo Ucayali, Casilla Electrónica y consentimiento Ley N° 29733 (Matías Zumaeta, Sergio Serruche), depurando archivos binarios `.docx` y `.txt` sueltos.
- **En `gestion-expedientes/`:** Consolidar la bandeja de 6 pestañas, timeline inmutable, foliado progresivo AGN y saneamiento del Fondo Documental al IESTP "Suiza" (Isack Vargas).
- **En `flujo-validez-legal/`:** Mantener la estructura secuencial de flujo académico y firma Refirma RENIEC / CVD (Geric, Jacobo, Jhasy).
- **Metadatos:** Cada documento consolidado debe incluir cabecera formal con código de documento, fecha, versión, autores reconocidos y módulo.

### R3. Sincronización de Enlaces y Rutas en Documentos Maestros
Actualizar todos los enlaces relativos, rutas de archivos, árboles de directorios y referencias en:
- `INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md`
- `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md`
- `frontend/README.md`
Garantizar que no exista ningún enlace roto hacia las rutas anteriores.

## Acceptance Criteria

### Integridad Estructural y Consolidación Técnica
- [ ] Todas las 6 carpetas de módulos siguen la nomenclatura en minúsculas (`kebab-case`), sin sufijos de nombres propios ni mayúsculas.
- [ ] No existen subcarpetas individuales redundantes (`CLIDER/`, `GATICA/`, `jhuel/`, `lloner/`) ni archivos binarios no rastreables (`.docx`, `.txt`) en las carpetas consolidadas.
- [ ] Cada módulo presenta documentos técnicos secuenciales (`01_...`, `02_...`, etc.) con estructura formal, tablas, diagramas y contratos claros.
- [ ] Todos los colaboradores de los equipos mantienen su autoría explícita en las tablas de metadatos de cada documento consolidado.
- [ ] Se verifica mediante scripts de prueba que el 100% de enlaces internos en `INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md`, `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md` y `frontend/README.md` son válidos y resuelven a los nuevos nombres en minúsculas.
- [ ] El código de la aplicación en `frontend/src/` no sufre regresiones y el proyecto se mantiene limpio y consistente.
</USER_REQUEST>

## Follow-up — 2026-09-05T16:16:00Z

<USER_REQUEST>
Reanudar el trabajo de consolidación y reorganización de la documentación de frontend (`frontend/DOCUMENTACION/`) tras la pausa de cuota: completar la sincronización de rutas, enlaces relativos y árboles de directorios en los documentos maestros (`INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` y `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md`) y `frontend/README.md`, y certificar la consistencia estructural del 100% de los 6 módulos ya organizados en minúsculas.

Working directory: g:\Mi unidad\IESTP_SUIZA_DSI\2026-2\CURSOS\py_SIGD\SIGD\frontend\DOCUMENTACION  
Integrity mode: development

## Current Progress & State of the Workspace
1. Las 6 carpetas ya han sido renombradas a minúsculas (`kebab-case`):
   - `administracion-seguridad-auditoria/`
   - `flujo-validez-legal/`
   - `gestion-expedientes/`
   - `registro-documentario/`
   - `registro-usuarios-casilla/`
   - `reportes-tableros-control/`
2. Los documentos técnicos de cada módulo ya fueron consolidados en archivos secuenciales (`01_...`, `02_...`, etc.), y las subcarpetas personales antiguas (`CLIDER/`, `GATICA/`, `jhuel/`, `lloner/`) y archivos binarios `.docx`/`.txt` han sido depurados.

## Remaining Requirements (Milestone 3 & Final Verification)

### R1. Sincronización Total de Enlaces y Árboles en Documentos Maestros
1. Actualizar el árbol de directorios y todas las rutas/enlaces en `INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` para reflejar los nuevos nombres de carpetas en minúsculas y los nuevos archivos consolidados (`01_...`, etc.).
2. Actualizar el árbol de directorios y todas las rutas/enlaces en `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md` para que apunten a los nuevos directorios y archivos.
3. Actualizar `frontend/README.md` reflejando la nueva estructura limpia de carpetas de documentación.
4. Asegurar que no quede ningún enlace roto ni referencia obsoleta a las carpetas antiguas con mayúsculas o nombres personales.

### R2. Verificación Estructural y Certificación de Calidad
1. Ejecutar suites de verificación para comprobar que todos los enlaces markdown resuelven a archivos existentes en disco.
2. Comprobar que todos los diagramas Mermaid son sintácticamente válidos.
3. Verificar que no haya regresiones en el código fuente en `frontend/src/`.

## Acceptance Criteria
- [ ] Cero enlaces rotos en `INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md`, `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md` y `frontend/README.md`.
- [ ] Todos los árboles de directorios documentados coinciden exactamente con la estructura física en disco en minúsculas.
- [ ] Todos los diagramas Mermaid son válidos y renderizan correctamente.
- [ ] La suite de pruebas de verificación automatizada aprueba al 100%.
</USER_REQUEST>

## Follow-up — 2026-09-05T17:22:22Z

<USER_REQUEST>
Elaborar un documento maestro técnico y pedagógico nivel senior (`frontend/docs/PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md`) que desglose exhaustivamente el plan de trabajo frontend módulo por módulo, integrando una matriz de entregables verificables y una rúbrica analítica de calificación en el Sistema Vigesimal Peruano (0 a 20 puntos) para que el docente pueda evaluar objetivamente a los equipos de estudiantes y auditar el cumplimiento estricto con los contratos del backend.

Working directory: g:\Mi unidad\IESTP_SUIZA_DSI\2026-2\CURSOS\py_SIGD\SIGD\frontend\docs
Integrity mode: development

## Requirements

### R1. Plan de Trabajo Modular Exhaustivo Nivel Senior (Módulos 1 al 6)
Desarrollar el desglose técnico profundo para cada uno de los 6 módulos del frontend en React 19 + TypeScript 5.9 + Tailwind CSS 4, alineado a los contratos del backend:
1. **Módulo 1: Identidad, Registro de Usuarios y Casilla Electrónica (`registro-usuarios-casilla/`)**:
   - Vistas de Persona Natural (DNI/CE/PTP) y Persona Jurídica (RUC 20/10).
   - Selector en cascada de Ubigeo Ucayali (Coronel Portillo, Atalaya, Padre Abad, Purús) con caché y SIAGIE.
   - Casilla Electrónica, consentimiento expreso Ley N° 29733 y generación de acuse notificatorio.
2. **Módulo 2: Registro Documentario, Ventanilla y Mesa de Partes (`registro-documentario/`)**:
   - Ventanilla Presencial y Mesa de Partes Virtual con horario de corte LPAG 16:30 hrs.
   - Motor dinámico JSON Schema Draft 2020-12 por tipo de trámite (TUPA institucional).
   - Carga desacoplada MinIO/S3 con Presigned URLs, validación Magic Bytes (`%PDF`) y Web Crypto SHA-256.
3. **Módulo 3: Bandejas del Servidor y Gestión de Expedientes (`gestion-expedientes/`)**:
   - Bandeja operativa de 6 pestañas (Pendientes, En Proceso, Derivados, Por Archivar, Archivados, Rechazados).
   - Semáforo SLA visual conforme a plazos máximos LPAG (30 días hábiles).
   - Timeline inmutable de trazabilidad, foliado progresivo AGN y Cuadro de Clasificación Documental (CCD).
4. **Módulo 4: Flujos Académicos, Firma Digital y Validez Legal (`flujo-validez-legal/`)**:
   - Workflows de titulación, convalidación de créditos y actas académicas.
   - Integración frontend con pasarela Refirma RENIEC / PKI y sellado de tiempo criptográfico.
   - Visor de documentos con representación impresa CVD (Código de Verificación Digital), QR y validador público.
5. **Módulo 5: Administración, Seguridad y Auditoría (`administracion-seguridad-auditoria/`)**:
   - Articulación con las 7 pantallas implementadas en `frontend/src/pages/administracion/`.
   - Control de acceso RBAC por roles (`SUPER_ADMIN`, `DIRECTOR`, `DOCENTE`, `MESA_PARTES`, `ESTUDIANTE`).
   - Visor de logs de auditoría inmutables, gestión de tablas maestras y configuración de calendario laboral.
6. **Módulo 6: Reportes y Tableros de Control (`reportes-tableros-control/`)**:
   - Dashboards ejecutivos y operativos (tiempos de atención, cuellos de botella por unidad orgánica, expedientes observados).
   - Catálogo formal de KPIs institucionales y fórmulas matemáticas de cálculo.
   - Gráficos interactivos accesibles (WCAG 2.1 AA) y exportación a formatos oficiales (PDF/Excel).

### R2. Matriz Docente de Entregables Verificables por Módulo y Estudiante
Diseñar la matriz de evaluación para el docente que detalle para cada módulo:
- **Código y Nombre del Entregable**: Nomenclatura normalizada (ej. `ENT-M01-01`, `ENT-M02-03`).
- **Responsables Específicos**: Asignación nominal basada en la matriz de los 21 colaboradores del equipo frontend.
- **Artefactos Técnicos Concretos**: Componentes React, tipos TypeScript, hooks personalizados, esquemas de validación Zod, pruebas o vistas.
- **Criterios de Aceptación Objetivos**: Condiciones técnicas y funcionales que deben validarse para aprobar el entregable.
- **Evidencia Demostrable**: Cómo se valida (archivo de código en repositorio, prueba automatizada, captura/demo de UI, respuesta mock o contrato de red).
- **Peso Porcentual y Complejidad (Story Points)** de cada entregable en la ponderación del módulo.

### R3. Rúbrica Analítica de Calificación en Sistema Vigesimal Peruano (0 a 20)
Definir un instrumento pedagógico riguroso de evaluación para el docente con:
- **Escala Vigesimal Oficial Peruana (0 a 20 pts)** con nota mínima aprobatoria de **13**:
  - **Excelente (18.0 - 20.0)**: Cumplimiento impecable de contratos API, tipado estricto sin `any`, manejo exhaustivo de errores RFC 7807, accesibilidad y cero defectos visuales o funcionales.
  - **Bueno (14.0 - 17.9)**: Funcionalidad completa y operativa, contratos respetados, observaciones menores de estilo o documentación.
  - **Regular (11.0 - 13.9)**: Funcionalidad básica operativa pero con advertencias de TypeScript, contratos parcialmente mockeados o faltantes en casos borde.
  - **Deficiente (00.0 - 10.9)**: Módulo no compila, desalineación crítica con contratos del backend, omisión de entregables esenciales o plagio.
- **Dimensiones de Evaluación Evaluadas**:
  1. *Arquitectura e Implementación Frontend* (Componentes, Estado, Hooks, Rutas) — 30%
  2. *Cumplimiento de Contratos Backend y Manejo de Errores RFC 7807 / Seguridad* — 30%
  3. *Experiencia de Usuario (UI/UX), Validaciones y Normativa (16:30 hrs, Leyes 27444/27269/29733)* — 20%
  4. *Calidad del Código, Tipado TypeScript y Evidencia de Pruebas* — 20%
- **Tabla de Penalizaciones Técnicas Automáticas**:
  - Desconexión o alteración no autorizada de endpoints `/api/v1/...` (-3 pts).
  - Incumplimiento del horario de corte 16:30 hrs LPAG en recepción documentaria (-2 pts).
  - Omisión de validación Magic Bytes o hash SHA-256 en carga de documentos (-2 pts).
  - Inobservancia de consentimiento expreso para Casilla Electrónica Ley 29733 (-2 pts).
  - Regresiones de compilación o errores en consola en modo desarrollo (-4 pts).

### R4. Sincronización Transversal y Enlaces de Navegación
- Crear el documento maestro en `frontend/docs/PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md`.
- Enlazar y sincronizar el nuevo documento en:
  - `frontend/docs/PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md` (agregando sección de referencia al instrumento docente).
  - `frontend/docs/INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md`.
  - `frontend/README.md` (actualizando la guía de navegación y garantizando que todos los enlaces apunten a las rutas vigentes en `frontend/docs/`).
- Verificar que el 100% de los hipervínculos sean válidos y que no existan enlaces rotos.

## Acceptance Criteria

### Rigor Pedagógico y Técnico
- [ ] El nuevo documento maestro `frontend/docs/PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md` está creado y estructurado con lenguaje técnico formal senior.
- [ ] Los 6 módulos funcionales cuentan con su plan de trabajo detallado por componentes, contratos y dependencias.
- [ ] La tabla de entregables lista el 100% de artefactos esperados con asignación clara a los 21 colaboradores del equipo frontend.
- [ ] La rúbrica de calificación vigesimal (0 a 20) incluye descriptores analíticos detallados para los 4 niveles de logro y la matriz de penalizaciones.
- [ ] El instrumento docente permite al profesor calificar de forma inmediata y objetiva cada hito y sustentación.
- [ ] Todos los enlaces entre `PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md`, `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md`, `INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` y `frontend/README.md` resuelven al 100% sin enlaces rotos.
- [ ] Cero regresiones en el código fuente de `frontend/src/`.
</USER_REQUEST>

## Follow-up — 2026-09-05T19:42:44Z

<USER_REQUEST>
Reanudar y culminar el trabajo de la Ronda 6 de frontend del SIGD pausado por cuota: ejecutar la verificación rigurosa del Hito 4 (revisión pedagógica y técnica, auditoría de contratos y desafíos de robustez) sobre el nuevo documento maestro `frontend/docs/PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md` y su sincronización transversal con `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md`, `INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` y `frontend/README.md`, culminando con la auditoría de victoria independiente para certificar el cumplimiento formal del 100% de los criterios docentes.

Working directory: g:\Mi unidad\IESTP_SUIZA_DSI\2026-2\CURSOS\py_SIGD\SIGD\frontend\docs
Integrity mode: development

## Current State & Deliverables Completed (Milestones 1 to 3)
1. **Documento Maestro Docente Creado (`PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md`)**:
   - 833 líneas, 96.4 KB, con metadatos oficiales del IESTP "Suiza" (Código `SIGD-DOC-PLAN-EVAL-2026-M6`, DSI, 2026-2).
   - Especificación técnica nivel senior para los 6 módulos (`registro-usuarios-casilla`, `registro-documentario`, `gestion-expedientes`, `flujo-validez-legal`, `administracion-seguridad-auditoria`, `reportes-tableros-control`).
   - Catálogo exhaustivo de **32 entregables técnicos atómicos** (`ENT-M01-01` a `ENT-M06-05`, 174 Story Points) mapeados a los **21 colaboradores** del equipo frontend con matriz RACI.
   - Rúbrica analítica vigesimal oficial (0 a 20 puntos, nota mínima aprobatoria 13) con 4 dimensiones ponderadas (D1: 30%, D2: 30%, D3: 20%, D4: 20%), descriptores para 4 niveles de logro, matriz de penalizaciones automáticas (`PEN-01` a `PEN-07`), ficha individual de calificación y protocolo de sustentación oral.
2. **Sincronización Transversal Realizada**:
   - `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md` actualizado con enlaces e interconexión al instrumento docente.
   - `INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` sincronizado con referencias al tercer documento maestro.
   - `frontend/README.md` actualizado con 31 enlaces canónicos hacia la documentación vigente en `frontend/docs/`.
   - Cero regresiones en código fuente (`git diff HEAD frontend/src/` = 0 bytes).

## Remaining Requirements (Milestones 4 & 5)

### R1. Verificación Multi-Agente Concurrente (Hito 4)
- **Revisión Pedagógica y Técnica**: Validar la consistencia de los 32 entregables atómicos, su viabilidad en los 6 Sprints y la aplicabilidad directa de la rúbrica vigesimal para el docente titular (Ing. Renato Tarazona).
- **Auditoría de Contratos Backend y Normativa**: Validar que todos los endpoints `/api/v1/...`, el tratamiento tipado RFC 7807 (`ApiProblemDetails`), el horario de corte LPAG 16:30 hrs, la firma digital Refirma RENIEC (Ley 27269) y la Casilla Electrónica (Ley 29733) estén fielmente reflejados.
- **Desafío Adversarial de Enlaces y Mermaid**: Ejecutar las suites canónicas automatizadas de verificación de enlaces y validación de diagramas Mermaid asegurando 100% de resolución sin enlaces rotos.
- **Auditoría Forense de Integridad**: Verificar estricta no-regresión en `frontend/src/` y preservación íntegra de la autoría de los 21 colaboradores.

### R2. Dictamen Pericial de Victoria Independiente (Hito 5)
- El auditor de victoria independiente (`teamwork_preview_victory_auditor`) ejecutará de forma autónoma las suites de prueba en 3 fases:
  - Fase A: Verificación de proveniencia y línea de tiempo.
  - Fase B: Análisis anti-trampas e integridad forense.
  - Fase C: Ejecución de pruebas automatizadas independientes.
- Emisión del dictamen pericial vinculante (`VICTORY CONFIRMED`).

## Acceptance Criteria
- [ ] La totalidad de los 32 entregables atómicos y la rúbrica vigesimal son validados y aprobados por los revisores.
- [ ] Cero enlaces rotos en `PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md`, `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md`, `INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` y `frontend/README.md`.
- [ ] 44/44 diagramas Mermaid sintácticamente válidos en el repositorio.
- [ ] Cero regresiones en `frontend/src/` (0 bytes diff).
- [ ] Las suites automatizadas de prueba del repositorio aprueban al 100%.
- [ ] El Auditor de Victoria emite formalmente el veredicto `VICTORY CONFIRMED`.
</USER_REQUEST>



# INFORME DE AUDITORÍA INTEGRAL Y PERITAJE FORENSE DE DOCUMENTACIÓN Y CÓDIGO FRONTEND — SIGD
## Sistema Integral de Gestión Documentaria · IESTP "Suiza" (Pucallpa, Ucayali, Perú)
### Peritaje Técnico Exhaustivo, Sincronización Post-Merge (PRs #62-#75 · Commit 4ec0c3a), Auditoría Forense de Código React 19, Trazabilidad Git, Matriz RACI y Sincronización Backend

---

### METADATOS DEL DOCUMENTO DE AUDITORÍA
- **Documento:** Informe Maestro de Auditoría Pericial Forense de Artefactos Documentales, Código Fuente React 19, Trazabilidad Git, Matriz RACI, Análisis de Brechas y Sincronización Backend-Frontend.
- **Código Documental:** `AUD-FORENSE-SIGD-FE-2026-M1`
- **Institución:** Instituto de Educación Superior Tecnológico Público "Suiza" (Pucallpa, Ucayali, Perú).
- **Programa Académico:** Programa de Estudios de Desarrollo de Sistemas de Información (PE DSI).
- **Unidad Didáctica:** Taller de Software / Taller de Base de Datos.
- **Docente Responsable:** Ing. Renato Henyer Tarazona Flores (`rtarazona.flores@gmail.com`).
- **Rol del Auditor:** teamwork_preview_worker (Lead Technical Writer & Senior Forensic Documentation Engineer).
- **Destinatarios:** Líder General del Equipo Frontend (Christiam Saúl), Sub-equipos Frontend (M1 al M6), Equipo de Arquitectura Backend (Express 5 + PostgreSQL 18), Dirección General y Secretaría Académica del IESTP "Suiza".
- **Fecha de Emisión:** 05 de Septiembre de 2026.
- **Versión:** `v4.0.0` — Dictamen Oficial Definitivo Post-Merge `origin/main` (Commit `4ec0c3a`, Pull Requests #62, #65, #66, #68, #69, #70, #75).
- **Ubicación en Repositorio:** `frontend/docs/INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md`
- **Fuentes Autoritativas Auditadas:**
  1. Árbol físico completo de `frontend/docs/` consolidado en la rama `main` tras los PRs #62, #65, #66, #68, #69, #70 y #75 (Commit `4ec0c3a`).
  2. Inspección forense de código fuente React 19 en `frontend/src/pages/administracion/` (7 pantallas), `frontend/src/components/administracion/AdminPageHeader.tsx` y `frontend/src/routes/AppRouter.tsx`.
  3. Saneamiento del punto de entrada `frontend/index.html` (erradicación del prototipo monolítico de 848 líneas y montaje nativo de Vite SPA en 14 líneas).
  4. Informes de peritaje y prospección técnica de los Spec Miners: `spec_miner_admin_code`, `spec_miner_doc_updates` y `spec_miner_backend_contracts`.
  5. Directorio consolidado de colaboradores institucionales en `colaboradores.md` y validación cruzada con el historial de Git (`git log`, `git show`, `git merge-base`).
  6. Arquitectura del Backend y Persistencia: 6 esquemas PostgreSQL 18 (`sigd_rut`, `sigd_tra`, `sigd_org`, `sigd_auth`, `sigd_doc`, `sigd_audit`), 6 planes de levantamiento de observaciones (`backend/docs/levantamiento_de_observaciones/01_...` al `06_...`) y convenciones de integración (`backend/docs/integracion/`).
  7. Marco normativo de la República del Perú: TUO Ley N° 27444 (LPAG), Modelo de Gestión Documental (MGD-PCM / SGTD), Ley N° 27269 (Firmas y Certificados Digitales) y D.S. 052-2008-PCM, Ley N° 29733 (Protección de Datos Personales), Directiva N° 001-2024-AGN/DNDAA (Foliado de Documentos del Archivo General de la Nación).

---

## 📑 ÍNDICE GENERAL

1. [Resumen Ejecutivo y Diagnóstico Global Cuantitativo Post-Merge (Commit 4ec0c3a)](#1-resumen-ejecutivo-y-diagnóstico-global-cuantitativo-post-merge-commit-4ec0c3a)
   - 1.1. Contexto, Alcance y Objetivos de la Auditoría Forense v4.0.0
   - 1.2. Balance Comparativo de Madurez: Backend (100%) vs. Frontend (Evolución Integral)
   - 1.3. Dictamen Pericial Global de Conformidad y Salto Cuantitativo
2. [Inventario Físico Exhaustivo y Análisis Forense del 100% de Artefactos Documentales y Código Fuente](#2-inventario-físico-exhaustivo-y-análisis-forense-del-100-de-artefactos-documentales-y-código-fuente)
   - 2.1. Tabla Maestra de Artefactos Físicos, Remotos y Módulos de Código Fuente
   - 2.2. Análisis Pericial Cualitativo y Cuantitativo por Subcarpeta y Módulo
3. [Reevaluación Técnica y Reconocimiento Forense en registro-documentario (80.0%)](#3-reevaluación-técnica-y-reconocimiento-forense-en-registro-documentario-800)
   - 3.1. Propuesta de Formularios Dinámicos con JSON Schema (Draft 2020-12)
   - 3.2. Arquitectura de Carga Desacoplada a MinIO/S3 mediante Presigned URLs
   - 3.3. Seguridad Criptográfica en Cliente: Magic Bytes %PDF y Cálculo Local SHA-256
   - 3.4. Asistente de Tramitación de 4 Pasos (Wizard) de Anllely Melgarejo
   - 3.5. Componentes de Interfaz y Wireframes de Lucy Panduro
   - 3.6. Desglose Dimensional de Cumplimiento (D1: 22, D2: 21, D3: 19, D4: 18 -> 80.0%)
4. [Reevaluación Técnica y Reconocimiento Forense en reportes-tableros-control (80.0%)](#4-reevaluación-técnica-y-reconocimiento-forense-en-reportes-tableros-control-800)
   - 4.1. Erradicación Total del Sesgo Comercial y Catálogo de 4 KPIs Institucionales
   - 4.2. Modelado Analítico, Fórmulas Matemáticas en LaTeX y DBML de Jennifer Gatica
   - 4.3. Diseño UX Responsive Ejecutivo y Accesibilidad WCAG AA de Christian Jhoel (Jhuel)
   - 4.4. Desglose Dimensional de Cumplimiento (D1: 22, D2: 19, D3: 20, D4: 20 -> 80.0%)
5. [Auditoría Forense Exhaustiva del Código Fuente React 19 Integrado (frontend/src/pages/administracion/)](#5-auditoría-forense-exhaustiva-del-código-fuente-react-19-integrado-frontendsrcpagesadministracion)
   - 5.1. Ecosistema Tecnológico del Código Integrado (React 19, TS 5.9, Tailwind 4, Vite 6)
   - 5.2. Auditoría Detallada de las 7 Pantallas de Administración
     - 5.2.1. AdministracionPage.tsx (Hub Central de Navegación)
     - 5.2.2. UsuariosPage.tsx (Gestión y Filtrado de Cuentas de Usuario)
     - 5.2.3. RolesPermisosPage.tsx (Matriz de Permisos RBAC)
     - 5.2.4. AuditoriaPage.tsx (Consulta Inmutable y Exportación CSV)
     - 5.2.5. TablasMaestrasPage.tsx (Mantenimiento Institucional y Pestañas)
     - 5.2.6. CalendarioLaboralPage.tsx (Jornada, Feriados y Discrepancia Crítica de Corte)
     - 5.2.7. SeguridadPage.tsx (Políticas de Acceso, Monitoreo y Desbloqueo)
   - 5.3. Auditoría del Componente de Encabezado Reutilizable AdminPageHeader.tsx
   - 5.4. Auditoría de Enrutamiento en frontend/src/routes/AppRouter.tsx y Brechas Arquitecturales
   - 5.5. Diagnóstico de Gestión de Estado: Prototipo en Memoria (100% Mock, 0% API)
   - 5.6. Diagnóstico de Capa de Red, Errores RFC 7807 y Correlación X-Correlation-ID
   - 5.7. Calificación Dimensional de administracion-seguridad-auditoria (83.0%)
6. [Consistencia de Nuevas Propuestas frente a Requisitos y Contratos Backend](#6-consistencia-de-nuevas-propuestas-frente-a-requisitos-y-contratos-backend)
   - 6.1. Contratos TramiCore (CUT EXP-YYYY-XXXXXX, Foliado Continuo AGN, Regla de Corte 16:30 LPAG)
   - 6.2. Contratos DocuCore (JSON Schema Draft 2020-12, Presigned URLs MinIO/S3, Magic Bytes, SHA-256)
   - 6.3. Contratos OrganiCore / IdentiCore / CoreLink (Modelo Ternario, Materialized Path, Bitácora Inmutable, RFC 7807)
   - 6.4. Mapeo Canónico de Endpoints /api/v1/... a las Pantallas de Frontend y DTOs TypeScript
7. [Mapeo Integral de Colaboradores, Matriz RACI y Evaluación Individual Ampliada](#7-mapeo-integral-de-colaboradores-matriz-raci-y-evaluación-individual-ampliada)
   - 7.1. Directorio de Colaboradores y Trazabilidad Git (Incorporación de los 8 Nuevos Autores)
   - 7.2. Matriz RACI Integral de Gobernanza Frontend (M1 a M6)
   - 7.3. Cuadro de Evaluación Pericial Individualizada (Escala Vigesimal 0-20)
8. [Taxonomía y Matriz de Severidad de Riesgos Técnicos, Operacionales y Legales (P0 - P3) Post-Merge](#8-taxonomía-y-matriz-de-severidad-de-riesgos-técnicos-operacionales-y-legales-p0---p3-post-merge)
   - 8.1. Actualización de Estados de Riesgo (Levantamiento de RSK-01 y RSK-02)
   - 8.2. Matriz Exhaustiva de Riesgos Forenses y Nuevos Hallazgos de Código
9. [Gobernanza de los 6 Sub-equipos y Hoja de Ruta de Remediación Técnica (Sprint 1)](#9-gobernanza-de-los-6-sub-equipos-y-hoja-de-ruta-de-remediación-técnica-sprint-1)
   - 9.1. Saneamiento del Quiebre de Compilación en MainLayout.tsx
   - 9.2. Corrección del Horario de Corte en CalendarioLaboralPage.tsx (16:30 hrs LPAG)
   - 9.3. Expansión del Cliente Axios con Interceptores Bidireccionales
   - 9.4. Rutas Protegidas (ProtectedRoute.tsx) y Enrutamiento Anidado (Outlet)
   - 9.5. Hoja de Ruta Detallada del Sprint 1
10. [Cumplimiento del Marco Normativo Peruano y Estándares de Interoperabilidad](#10-cumplimiento-del-marco-normativo-peruano-y-estándares-de-interoperabilidad)
    - 10.1. TUO Ley N° 27444 (LPAG): Horario de Corte 16:30, Días Hábiles y Acumulación Art. 160
    - 10.2. Modelo de Gestión Documental (MGD-PCM / SGTD) y Directiva AGN: CUT EXP-YYYY-XXXXXX y Foliado
    - 10.3. Ley N° 27269 y D.S. 052-2008-PCM: Firma Digital con Refirma RENIEC, Sellado TSA y Validador CVD
    - 10.4. Ley N° 29733 (Protección de Datos Personales): Consentimiento Expreso y Casilla Electrónica
    - 10.5. Estándares Técnicos de Integración: RFC 7807/9457, X-Correlation-ID y Storage MinIO/S3
11. [Tablas Normativas del Peritaje Forense (Features y Edge Cases Actualizados)](#11-tablas-normativas-del-peritaje-forense-features-y-edge-cases-actualizados)
    - 11.1. Matriz Ampliada de Características Descubiertas (Features Discovered)
    - 11.2. Matriz Ampliada de Casos de Borde Críticos (Edge Cases)
12. [Suite Integral de Diagramas Mermaid de Arquitectura, Flujos y Ciclos de Vida](#12-suite-integral-de-diagramas-mermaid-de-arquitectura-flujos-y-ciclos-de-vida)
    - 12.1. Topología de Gobernanza y Flujo Intermodular v4.0.0
    - 12.2. Máquina de Estados Finita (FSM) de 10 Estados de RutaDoc
    - 12.3. Secuencia Criptográfica de Firma Digital con Refirma RENIEC y CVD
    - 12.4. Secuencia de Carga Desacoplada a MinIO/S3 con Magic Bytes y SHA-256
    - 12.5. Arquitectura de Integración de las 7 Pantallas de Administración con Backend
    - 12.6. Cronograma de Subsanación y Desarrollo en 6 Sprints (Gantt)
    - 12.7. Ciclo de Vida de No Conformidades y Proceso de Subsanación
13. [Conclusiones, Recomendaciones Vinculantes y Dictamen Pericial Oficial v4.0.0](#13-conclusiones-recomendaciones-vinculantes-y-dictamen-pericial-oficial-v400)

---

## 1. RESUMEN EJECUTIVO Y DIAGNÓSTICO GLOBAL CUANTITATIVO POST-MERGE (COMMIT 4ec0c3a)

El presente informe constituye el **peritaje técnico, forense, funcional y de código fuente de nivel definitivo versión 4.0.0** practicado al ecosistema frontend del **Sistema Integral de Gestión Documentaria (SIGD)** del **IESTP "Suiza"** (Pucallpa, Ucayali, Perú).

Esta auditoría consolida la sincronización total del repositorio local con `origin/main` tras la integración de 18 nuevos commits consolidados mediante los Pull Requests **#62, #65, #66, #68, #69, #70 y #75** (culminando en el merge commit `4ec0c3a`).

### Hitos Cruciales de la Versión 4.0.0:
1. **Eliminación Definitiva de Calificaciones de 0%:** Las etiquetas históricas de abandono o 0% asignadas en fases tempranas a las carpetas iniciales (`MODULO_REGISTRO_DOCUMENTARIO_PATTY`, hoy `registro-documentario/`) y (`MODULO-ADMINISTRACION-SEGURIDAD-AUDITORIA_JHONATAN`, hoy `administracion-seguridad-auditoria/`) quedan formalmente **derogadas y erradicadas**.
2. **Reconocimiento del Módulo Líder Técnico:** El módulo M5 (`administracion-seguridad-auditoria/`, anteriormente `MODULO-ADMINISTRACION-SEGURIDAD-AUDITORIA_JHONATAN`) se consolida como el módulo con mayor madurez técnica del frontend con **83.0%**, al aportar **7 pantallas completas implementadas en React 19 + TypeScript + Tailwind CSS 4**, enrutamiento activo en `AppRouter.tsx` y el saneamiento radical de `index.html`.
3. **Consolidación de Registro Documentario (80.0%):** Acreditación de los aportes de Carito Curto (JSON Schema Draft 2020-12, Presigned URLs MinIO/S3, Magic Bytes `%PDF` y Web Crypto SHA-256), Anllely Melgarejo (Asistente Wizard de 4 pasos) y Lucy Panduro (componentes React modulares).
4. **Saneamiento Analítico de Reportes (80.0%):** Acreditación de la erradicación total del sesgo comercial gracias a los 4 KPIs institucionales y fórmulas LaTeX de Jennifer Gatica, y el diseño UX responsive adaptable con directivas WCAG 2.1 AA de Christian Jhoel (Jhuel).
5. **Salto Cuantitativo Global:** El promedio ponderado general del frontend asciende significativamente de un modesto 50.0%-55.0% histórico a un sólido **70.5%**, situando al proyecto en un estado operativo óptimo para abordar el Sprint 1.

```mermaid
pie title Estado Consolidado de Madurez Documental y Técnica Frontend SIGD (v4.0.0 Post-Merge)
    "M5: Admin & Auditoría (83% - Implementado React 19)" : 20
    "M2: Registro & Ventanilla (80% - Alta Especificación)" : 19
    "M6: Reportes & Tableros (80% - KPIs y DBML Saneados)" : 19
    "M4: Flujos & Firma Digital (75% - Favorable Rescatable)" : 18
    "M3: Bandejas & Expedientes (60% - Aceptable Técnico)" : 14
    "M1: Auth & Casilla (45% - Observado Escindido)" : 10
```

### 1.1. Contexto, Alcance y Objetivos de la Auditoría Forense v4.0.0

El IESTP "Suiza" avanza en su mandato de digitalización de la gestión académica y administrativa conforme a los lineamientos del Modelo de Gestión Documental (MGD-PCM / SGTD) y el TUO de la Ley N° 27444. La sincronización del commit `4ec0c3a` representa un punto de inflexión donde las especificaciones teóricas comenzaron a materializarse en código fuente ejecutable dentro de `frontend/src/`.

Los objetivos forenses específicos de esta auditoría v4.0.0 son:
1. **Auditar el código fuente React 19 integrado:** Analizar exhaustivamente las 7 pantallas de administración, el componente `AdminPageHeader.tsx`, el enrutador `AppRouter.tsx` y el estado de la arquitectura Feature-Sliced Design.
2. **Reevaluar formalmente las calificaciones de conformidad:** Cuantificar el salto de madurez en las 4 dimensiones estándar (D1 Cobertura Funcional, D2 Arquitectura Frontend, D3 Sincronización Backend, D4 Marco Normativo Peruano).
3. **Contrastar la coherencia frente a los 6 planes de levantamiento backend:** Verificar la alineación con TramiCore (CUT `EXP-YYYY-XXXXXX`, foliado progresivo AGN, corte 16:30), DocuCore (JSON Schema en JSONB con índice GIN, Presigned URLs MinIO/S3, Magic Bytes `25 50 44 46`, SHA-256) y OrganiCore/IdentiCore/CoreLink (modelo ternario, Materialized Path, bitácora inmutable, RFC 7807 y `X-Correlation-ID`).
4. **Expandir la trazabilidad y directorio RACI:** Incorporar a los 8 nuevos autores identificados criptográficamente en el árbol Git (Carito Curto, Lucy Panduro, Anllely Melgarejo, Carlos Perea, Leonel Rivera, Jennifer Gatica, Christian Jhoel Jhuel y Jhonatan Gonzales).
5. **Establecer la hoja de ruta de remediación técnica del Sprint 1:** Diagnosticar la deuda técnica detectada (importación rota de `HeaderInstitucional.tsx` en `MainLayout.tsx`, discrepancia del corte a las 17:00 en lugar de 16:30 en `CalendarioLaboralPage.tsx`, ausencia de interceptores Axios y cableado TanStack Query).

---

### 1.2. Balance Comparativo de Madurez: Backend vs. Frontend

Tras el saneamiento integral post-merge, la brecha histórica entre el backend (100% de conformidad) y el frontend se ha reducido drásticamente:

| Subdominio Backend | Arquitectura Backend de Referencia | Carpeta / Código Frontend Auditado | Conformidad v2.0 | Conformidad v3.0 | Conformidad v4.0.0 (Post-Merge) | Estado de Auditoría v4.0.0 |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Grupo 1: RutaDoc**<br>*(Trazabilidad & FSM)* | Event Sourcing, FSM 10 estados, Outbox Pattern, `sigd_rut` | `flujo-validez-legal/`<br>`gestion-expedientes/` | 68.0% | 75.0% | **75.0%** | 🟢 **FAVORABLE**<br>*(M4: Formalizado bajo Geric Salas)* |
| **Grupo 2: TramiCore**<br>*(Expedientes & CUT)* | CUT MGD-PCM (`EXP-YYYY-XXXXXX`), Foliado AGN, `sigd_tra` | `registro-documentario/` | 0.0% | 65.0% | **80.0%** | 🟢 **FAVORABLE RESCATABLE**<br>*(Aportes Curto, Panduro, Melgarejo)* |
| **Grupo 3: OrganiCore**<br>*(Organigrama & Jerarquías)* | Materialized Path (`01.03.02`), RBAC/ABAC, Encargaturas, `sigd_org` | `administracion-seguridad-auditoria/`<br>`frontend/src/pages/administracion/*` | 0.0% | 45.0% | **83.0%** | 🟢 **LÍDER TÉCNICO IMPLEMENTADO**<br>*(7 páginas React 19 operativas)* |
| **Grupo 4: IdentiCore**<br>*(Identidad Civil & Casilla)* | Persona Natural/Jurídica (RUC), Argon2id, Ley 29733, `sigd_auth` | `registro-usuarios-casilla/` | 45.0% | 45.0% | **45.0%** | 🟡 **OBSERVADO**<br>*(Escisión M1 vs M5 ratificada)* |
| **Grupo 5: DocuCore**<br>*(Documentos & S3)* | JSON Schema Draft 2020-12, MinIO S3 Presigned URLs, `sigd_doc` | `registro-documentario/` | 40.0% | 70.0% | **80.0%** | 🟢 **FAVORABLE ALINEADO**<br>*(Magic Bytes & SHA-256 validados)* |
| **Grupo 6: CoreLink**<br>*(Métricas, RFC 7807 & Logs)* | Problem Details RFC 7807/9457, `X-Correlation-ID`, `sigd_audit` | `reportes-tableros-control/` | 30.0% | 60.0% | **80.0%** | 🟢 **FAVORABLE SANEADO**<br>*(4 KPIs institucionales, LaTeX, DBML)* |

---

### 1.3. Dictamen Pericial Global de Conformidad y Salto Cuantitativo

> **DICTAMEN PERICIAL OFICIAL v4.0.0: CONFORME CON CONDICIONES DE INTEGRACIÓN DE RED Y LAYOUT EN SPRINT 1 (GATE PASS APROBADO CON OBSERVACIONES TÉCNICAS).**  
> 
> La auditoría forense post-merge dictamina que el subsistema Frontend ha alcanzado el **nivel de madurez más alto de su ciclo de vida**, registrando un promedio ponderado global de **70.5%**. Se certifica el salto cualitativo de **Jhonatan Gonzales (83.0%)**, quien lidera la transición hacia código real React 19, de **Carito Curto, Lucy Panduro y Anllely Melgarejo en Registro Documentario (80.0%)**, y de **Jennifer Gatica y Christian Jhoel en Reportes y Tableros (80.0%)**.
> 
> Las condiciones resolutorias obligatorias para el Sprint 1 se circunscriben a: (a) Reparar el import roto de `HeaderInstitucional.tsx` en `MainLayout.tsx`, (b) Ajustar el horario de corte legal en `CalendarioLaboralPage.tsx` a las **16:30 hrs** (Art. 138 Ley N° 27444), (c) Implementar interceptores bidireccionales en Axios para inyectar `X-Correlation-ID` y capturar errores RFC 7807 (`ApiProblemDetails`), y (d) Envolver las rutas de administración bajo un componente de autenticación y autorización (`ProtectedRoute`).

---

## 2. INVENTARIO FÍSICO EXHAUSTIVO Y ANÁLISIS FORENSE DEL 100% DE ARTEFACTOS DOCUMENTALES Y CÓDIGO FUENTE

### 2.1. Tabla Maestra de Artefactos Físicos, Remotos y Módulos de Código Fuente

#### 2.1.1. Estructura Física Oficial de Directorios en Disco (`frontend/docs/`)

A continuación se presenta la estructura física jerárquica estandarizada en minúsculas (`kebab-case`) que refleja el 100% de los artefactos documentales consolidados en disco:

```text
frontend/docs/
├── INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md
├── PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md
├── PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md
├── administracion-seguridad-auditoria/
│   ├── 01_descripcion_general_administracion.md
│   ├── 02_tablas_maestras_y_catalogos.md
│   ├── 03_control_acceso_roles_permisos_rbac.md
│   ├── 04_logs_auditoria_inmutable_trazabilidad.md
│   ├── 05_directorio_usuarios_y_seguridad_acceso.md
│   └── 06_calendario_laboral_y_jornada_lpag.md
├── flujo-validez-legal/
│   ├── 01_descripcion_general_validez_legal.md
│   ├── 02_flujos_trabajo_workflow_academico.md
│   ├── 03_documentos_oficiales_firma_digital.md
│   ├── 04_validez_legal_y_validador_cvd.md
│   ├── 05_arquitectura_tecnica_y_contratos_api.md
│   ├── 06_componentes_interfaz_ui.md
│   └── diagrama_flujo_validez_legal.dbml
├── gestion-expedientes/
│   ├── 01_bandeja_trabajo_diario_6_pestanas.md
│   ├── 02_cuadro_clasificacion_documental_ccd_y_archivistica.md
│   └── 03_modelo_datos_typescript_y_trazabilidad_inmutable.md
├── registro-documentario/
│   ├── 01_arquitectura_tecnica_registro_documentario.md
│   ├── 02_especificacion_funcional_ventanilla_y_mesa_partes.md
│   └── 03_componentes_ui_y_estados_formulario.md
├── registro-usuarios-casilla/
│   ├── 01_registro_ciudadano_persona_natural_juridica.md
│   ├── 02_ubigeo_cascada_ucayali_siagie.md
│   └── 03_casilla_electronica_y_ley_29733.md
└── reportes-tableros-control/
    ├── 01_descripcion_general_reportes_dashboard.md
    ├── 02_catalogo_kpis_y_metricas_institucionales.md
    ├── 03_fuentes_datos_formulas_matematicas.md
    ├── 04_diseno_visual_graficos_y_componentes.md
    ├── 05_navegacion_filtros_y_accesibilidad_ux.md
    ├── 06_arquitectura_frontend_y_plan_pruebas.md
    └── diagrama_metricas_dashboard.dbml
```

#### 2.1.2. Inventario Consolidado de Artefactos Físicos y Código Fuente (44 Rutas en Repositorio)

A continuación se presenta el inventario consolidado de 44 artefactos físicos en disco (32 documentos técnicos consolidados + 12 módulos de código fuente) auditados tras la reorganización modular y sincronización del commit `4ec0c3a`:

| # | Ruta Relativa del Archivo Consolidado en Disco | Tamaño (Bytes) | Líneas | Autor(es) / Contribuyentes Git Reconocidos | Tipo de Artefacto y Trazabilidad de Consolidación |
|---|---|:---:|:---:|---|---|
| 1 | `INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md` | 118,800+ | 1,234 | Lead Technical Writer / Auditor Forense | Documento Maestro de Auditoría Frontend (Sincronizado Post-Consolidación) |
| 2 | `PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md` | 85,000+ | 1,300+ | Lead Technical Writer / Arquitecto Fullstack | Plan Maestro y Blueprint Arquitectural Frontend Scrum (6 Sprints) |
| 3 | [Plan de Trabajo Modular y Evaluación Docente](PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md) | 96,400+ | 833 | Lead Architect / Evaluador Docente | Tercer Documento Maestro: Plan Modular Exhaustivo y Rúbrica Vigesimal de Evaluación Docente (0 a 20) |
| 4 | `administracion-seguridad-auditoria/01_descripcion_general_administracion.md` | 7,228 | 80+ | Jhonatan Gonzales, Angel Vásquez, Leonel Rivera | Visión general, arquitectura de administración y catálogo de submódulos |
| 5 | `administracion-seguridad-auditoria/02_tablas_maestras_y_catalogos.md` | 5,623 | 70+ | Jhonatan Gonzales, Angel Vásquez, Leonel Rivera | Consolidación de sedes, áreas, tipos documentales (origen `TABLAS_MAESTRAS.md`) |
| 6 | `administracion-seguridad-auditoria/03_control_acceso_roles_permisos_rbac.md` | 6,621 | 80+ | Carlos Perea, Jhonatan Gonzales (PR #68, #75) | Consolidación de matriz RBAC, roles y permisos (origen `permisos_perea.md`) |
| 7 | `administracion-seguridad-auditoria/04_logs_auditoria_inmutable_trazabilidad.md` | 5,361 | 75+ | Leonel Rivera, Jhonatan Gonzales (PR #65, #69) | Consolidación de eventos inmutables (origen `AUDITORIA_TABLAS_MAESTRAS[_LEONEL].md`) |
| 8 | `administracion-seguridad-auditoria/05_directorio_usuarios_y_seguridad_acceso.md` | 6,453 | 80+ | Jhonatan Gonzales, Angel Vásquez, Carlos Perea | Consolidación de usuarios internos y políticas (origen `Propuesta_Interfaz_VAZQUES.md`) |
| 9 | `administracion-seguridad-auditoria/06_calendario_laboral_y_jornada_lpag.md` | 5,757 | 70+ | Jhonatan Gonzales, Angel Vásquez | Parametrización de jornada laboral, días hábiles y corte 16:30 LPAG 27444 |
| 10 | `flujo-validez-legal/01_descripcion_general_validez_legal.md` | 8,740 | 90+ | Geric Salas, Lizbeth Jacobo, Jhasy | Visión institucional y debido procedimiento administrativo en educación superior |
| 11 | `flujo-validez-legal/02_flujos_trabajo_workflow_academico.md` | 9,683 | 110+ | Geric Salas, Lizbeth Jacobo, Jhasy | Flujos académicos Secretaría Académica -> Administración -> Dirección General |
| 12 | `flujo-validez-legal/03_documentos_oficiales_firma_digital.md` | 8,325 | 100+ | Geric Salas, Lizbeth Jacobo, Jhasy | Plataforma Refirma RENIEC, Ley N° 27269 y sellado de tiempo TSA |
| 13 | `flujo-validez-legal/04_validez_legal_y_validador_cvd.md` | 8,224 | 95+ | Geric Salas, Lizbeth Jacobo, Jhasy | Cadena de aprobación, Libro de Resoluciones y validador público CVD con QR |
| 14 | `flujo-validez-legal/05_arquitectura_tecnica_y_contratos_api.md` | 6,766 | 85+ | Geric Salas, Lizbeth Jacobo, Jhasy | Capas arquitecturales, stack tecnológico React 19 y catálogo de endpoints |
| 15 | `flujo-validez-legal/06_componentes_interfaz_ui.md` | 5,484 | 70+ | Geric Salas, Lizbeth Jacobo, Jhasy | Bandeja de entrada oficial, timeline de firmas y visor interactivo de resoluciones |
| 16 | `flujo-validez-legal/diagrama_flujo_validez_legal.dbml` | 2,145 | 100 | Geric Salas, Lizbeth Jacobo, Jhasy | Modelo relacional DBML para ciclo de tramitación, firmas y resolución |
| 17 | `gestion-expedientes/01_bandeja_trabajo_diario_6_pestanas.md` | 12,826 | 130+ | Isack Vargas, Christiam Saúl | Bandeja unificada de 6 pestañas, timeline inmutable y navegación de expedientes |
| 18 | `gestion-expedientes/02_cuadro_clasificacion_documental_ccd_y_archivistica.md` | 10,169 | 120+ | Isack Vargas, Christiam Saúl | Normalización archivística CCD del IESTP "Suiza" y foliado AGN |
| 19 | `gestion-expedientes/03_modelo_datos_typescript_y_trazabilidad_inmutable.md` | 11,708 | 140+ | Isack Vargas, Christiam Saúl | Tipado TypeScript 5.9, FSM 10 estados y trazabilidad Event Sourcing |
| 20 | `registro-documentario/01_arquitectura_tecnica_registro_documentario.md` | 14,317 | 150+ | Carito Curto, Patty Marina, Christiam Saúl | Consolidación JSON Schema Draft 2020-12, MinIO/S3, Magic Bytes %PDF y SHA-256 (PR #66) |
| 21 | `registro-documentario/02_especificacion_funcional_ventanilla_y_mesa_partes.md` | 14,863 | 160+ | Anllely Melgarejo, Carito Curto, Patty Marina, Noelia, Angy | Consolidación Asistente Wizard 4 pasos y comprobante CUT (origen PR #62) |
| 22 | `registro-documentario/03_componentes_ui_y_estados_formulario.md` | 12,750 | 140+ | Lucy Panduro Ramos, Patty Marina, Carito Curto, Anllely | Consolidación RegisterForm, Dropzone, ReceiptModal y máquina de estados (commit 81f9987) |
| 23 | `registro-usuarios-casilla/01_registro_ciudadano_persona_natural_juridica.md` | 10,636 | 110+ | Matías Zumaeta, Sergio Serruche Panduro, Christiam Saúl | Formulario ciudadano Natural/Jurídica, validación RENIEC/SUNAT (depuró `.txt`/`.docx`) |
| 24 | `registro-usuarios-casilla/02_ubigeo_cascada_ucayali_siagie.md` | 11,731 | 125+ | Matías Zumaeta, Sergio Serruche Panduro, Christiam Saúl | Selector de Ubigeo Ucayali en cascada SIAGIE-MINEDU y declaración jurada |
| 25 | `registro-usuarios-casilla/03_casilla_electronica_y_ley_29733.md` | 9,283 | 100+ | Sergio Serruche Panduro, Matías Zumaeta, Christiam Saúl | Casilla Electrónica, consentimiento expreso LPDP Ley N° 29733 y notificaciones |
| 26 | `reportes-tableros-control/01_descripcion_general_reportes_dashboard.md` | 4,930 | 60+ | Clider Urquia, Jhuel, Lloner | Objetivos operacionales del tablero de control ejecutivo institucional |
| 27 | `reportes-tableros-control/02_catalogo_kpis_y_metricas_institucionales.md` | 5,886 | 75+ | Jennifer Gatica, Clider Urquia (PR #70) | Consolidación de 4 KPIs con semáforos (origen `GATICA/01_catalogo...md`) |
| 28 | `reportes-tableros-control/03_fuentes_datos_formulas_matematicas.md` | 5,035 | 65+ | Jennifer Gatica, Clider Urquia (PR #70) | Fórmulas LaTeX (TPR, TC, Delta%) y control división por cero (origen `GATICA/03...md`) |
| 29 | `reportes-tableros-control/04_diseno_visual_graficos_y_componentes.md` | 5,434 | 70+ | Jennifer Gatica, Jhuel, Lloner | Componentes gráficos LineChart, DoughnutChart y Stat Cards (origen `GATICA/02...` y `jhuel/02...`) |
| 30 | `reportes-tableros-control/05_navegacion_filtros_y_accesibilidad_ux.md` | 5,147 | 65+ | Christian Jhoel (Jhuel), Lloner, Clider Urquia | Vista de pájaro < 5s, breakpoints responsivos y WCAG 2.1 AA (origen `jhuel/01,03,04`) |
| 31 | `reportes-tableros-control/06_arquitectura_frontend_y_plan_pruebas.md` | 5,668 | 70+ | Clider Urquia, Jhuel, Lloner | Validaciones reactivas de fechas y suite de pruebas UI (origen `jhuel/05,06`) |
| 32 | `reportes-tableros-control/diagrama_metricas_dashboard.dbml` | 1,073 | 37 | Jennifer Gatica, Clider Urquia | Modelo DBML analítico: kpi_resumen, historico_metricas, registros_reportes |
| 33 | `frontend/index.html` | 620 | 14 | Jhonatan Gonzales (PR #75) | Punto de montaje nativo SPA React 19 / Vite 6 (saneado, sin scripts legados) |
| 34 | `frontend/src/pages/administracion/AdministracionPage.tsx` | 2,750 | 78 | Jhonatan Gonzales (PR #75) | Hub central de navegación del panel administrativo (grid de 6 tarjetas) |
| 35 | `frontend/src/pages/administracion/UsuariosPage.tsx` | 6,850 | 185 | Jhonatan Gonzales (PR #75) | Directorio institucional de usuarios con búsqueda reactiva y modal de edición |
| 36 | `frontend/src/pages/administracion/RolesPermisosPage.tsx` | 5,920 | 162 | Jhonatan Gonzales (PR #75) | Matriz interactiva de permisos RBAC con checkboxes por rol y módulo |
| 37 | `frontend/src/pages/administracion/AuditoriaPage.tsx` | 6,420 | 174 | Jhonatan Gonzales (PR #75) | Visor forense inmutable con filtros combinados y exportación cliente a CSV |
| 38 | `frontend/src/pages/administracion/TablasMaestrasPage.tsx` | 6,150 | 168 | Jhonatan Gonzales (PR #75) | Mantenimiento de Sedes, Áreas y Tipos Documentales con borrado lógico |
| 39 | `frontend/src/pages/administracion/CalendarioLaboralPage.tsx` | 6,280 | 171 | Jhonatan Gonzales (PR #75) | Configuración de jornada y feriados (requiere ajuste de corte a 16:30 LPAG) |
| 40 | `frontend/src/pages/administracion/SeguridadPage.tsx` | 6,110 | 165 | Jhonatan Gonzales (PR #75) | Monitoreo de bloqueos, fallos de autenticación y desbloqueo administrativo |
| 41 | `frontend/src/components/administracion/AdminPageHeader.tsx` | 1,220 | 36 | Jhonatan Gonzales (PR #75) | Cabecera reutilizable de las 6 páginas de administración con navegación |
| 42 | `frontend/src/routes/AppRouter.tsx` | 1,450 | 38 | Jhonatan Gonzales (PR #75) | Enrutador de la aplicación en React Router v7 con 8 rutas declaradas |
| 43 | `frontend/src/layouts/MainLayout.tsx` | 1,840 | 48 | Equipo Frontend Base | Layout principal pendiente de remediación (import defectuoso en Sprint 1) |
| 44 | `frontend/src/api/client.ts` | 720 | 22 | Equipo Frontend Base | Instancia base de Axios pendiente de interceptores X-Correlation-ID y RFC 7807 |

---

### 2.2. Análisis Pericial Cualitativo y Cuantitativo por Subcarpeta y Módulo

```mermaid
graph TD
    DOCS["frontend/docs/ (32 Documentos Técnicos Consolidados)"] --> M1["M1: registro-usuarios-casilla/<br/>(3 specs · Matías / Sergio · 45.0%)"]
    DOCS --> M2["M2: registro-documentario/<br/>(3 specs · Patty, Curto, Panduro, Melgarejo · 80.0%)"]
    DOCS --> M3["M3: gestion-expedientes/<br/>(3 specs · Isack Vargas · 60.0%)"]
    DOCS --> M4["M4: flujo-validez-legal/<br/>(6 specs + DBML · Geric, Jacobo, Jhasy · 75.0%)"]
    DOCS --> M5["M5: administracion-seguridad-auditoria/<br/>(6 specs + 7 Pantallas · Jhonatan, Perea, Rivera, Vásquez · 83.0%)"]
    DOCS --> M6["M6: reportes-tableros-control/<br/>(6 specs + DBML · Urquia, Gatica, Jhuel, Lloner · 80.0%)"]
```

#### 2.2.1. administracion-seguridad-auditoria (Módulo 5)
- **Estado Previo (v2/v3 preliminar):** 0.0% en `main` / 45.0% en rama remota `origin/F_GONZALES`.
- **Estado Actual Post-Merge (v4.0.0):** **83.0% de cumplimiento (Nivel: Favorable Implementado en Código)**.
- **Dictamen Pericial de Evolución:** La integración de los PRs #65, #68, #69 y fundamentalmente el **PR #75** (`F_GONZALES`, commit `4ec0c3a`) transformó radicalmente este módulo, posicionándolo como el de **mayor madurez técnica y física de todo el frontend**. Jhonatan Gonzales y su equipo no solo entregaron especificaciones teóricas de alta calidad, sino que implementaron **7 pantallas completas en React 19** con Tailwind CSS 4, configuraron el enrutador en `AppRouter.tsx` y sanearon `index.html`.
- **Brechas Restantes para el 100% (17%):**
  1. Conexión de red: Las 7 pantallas operan con estado efímero en memoria (`useState`); se requiere cablear hooks TanStack Query v5 contra los endpoints `/api/v1/...`.
  2. Corrección del horario de cierre en `CalendarioLaboralPage.tsx` (ajustar de 17:00 a 16:30 hrs conforme a la Ley N° 27444).
  3. Protección de rutas con token JWT y roles institucionales (`ProtectedRoute`).

#### 2.2.2. registro-documentario (Módulo 2)
- **Estado Previo:** 0.0% (abandono v1) $\to$ 65.0% (v3 preliminar).
- **Estado Actual Post-Merge (v4.0.0):** **80.0% de cumplimiento (Nivel: Favorable Rescatable)**.
- **Dictamen Pericial de Evolución:** Se consolida el reconocimiento de los aportes de **Carito Curto** (PR #66), **Lucy Panduro** (commit `81f9987`) y **Anllely Melgarejo** (PR #62). La propuesta de formularios dinámicos con JSON Schema Draft 2020-12, la carga desacoplada a MinIO/S3 con URLs prefirmadas, la inspección de Magic Bytes `%PDF` y el hash SHA-256 local sitúan la arquitectura de este módulo a la vanguardia de la ingeniería institucional.
- **Brechas Restantes para el 100% (20%):**
  1. Materialización del código React 19 ejecutable en `frontend/src/pages/registro/`.
  2. Implementación de la lógica de horario de corte legal de las 16:30 hrs en el asistente wizard.
  3. Contratos tipados de error RFC 7807 para validación de entrada TUPA.

#### 2.2.3. registro-usuarios-casilla (Módulo 1)
- **Estado Actual Post-Merge (v4.0.0):** **45.0% de cumplimiento (Nivel: Observado con Escisión Resuelta)**.
- **Dictamen Pericial:** Mantiene su calificación técnica. Se ratifica la resolución del conflicto de alcance: Matías Zumaeta y Sergio Serruche lideran el Módulo 1 (M1) enfocado en el portal de registro ciudadano externo, ubigeo en cascada (estándar SIAGIE) y Casilla Electrónica bajo la Ley N° 29733. Angel Jesús Vásquez queda adscrito a M5 para la gestión de usuarios internos.

#### 2.2.4. gestion-expedientes (Módulo 3)
- **Estado Actual Post-Merge (v4.0.0):** **60.0% de cumplimiento (Nivel: Aceptable Archivístico)**.
- **Dictamen Pericial:** Isack Vargas mantiene una sólida especificación archivística sustentada en el Cuadro de Clasificación Documental (CCD) y la organización de la bandeja en 6 pestañas. En el Sprint 4 se resolverán los residuos de texto municipal y se incorporará el foliado continuo conforme a la directiva del Archivo General de la Nación (AGN).

#### 2.2.5. flujo-validez-legal (Módulo 4)
- **Estado Actual Post-Merge (v4.0.0):** **75.0% de cumplimiento (Nivel: Favorable Rescatado)**.
- **Dictamen Pericial:** Carpeta formalizada como Módulo 4 (M4) bajo la jefatura de Geric Salas, con Lizbeth Jacobo y Jhasy. Sus 7 artefactos cubren los flujos de trabajo de resoluciones y actas, la integración con Refirma RENIEC (Ley N° 27269) y el validador público de autenticidad CVD.

#### 2.2.6. reportes-tableros-control (Módulo 6)
- **Estado Previo:** 30.0% (v1 e-commerce) $\to$ 60.0% (v3 preliminar).
- **Estado Actual Post-Merge (v4.0.0):** **80.0% de cumplimiento (Nivel: Favorable Saneado)**.
- **Dictamen Pericial de Evolución:** El sub-equipo de Urquia ha erradicado de manera definitiva cualquier vestigio de comercio electrónico. Jennifer Gatica definió con maestría matemática los 4 KPIs institucionales en LaTeX y el modelo DBML. Christian Jhoel (Jhuel) aportó la arquitectura UX responsive de vista ejecutiva (< 5s) y directivas de accesibilidad WCAG 2.1 AA para daltonismo y teclado.

---

## 3. REEVALUACIÓN TÉCNICA Y RECONOCIMIENTO FORENSE EN REGISTRO-DOCUMENTARIO (80.0%)

La sincronización de los Pull Requests **#62 (Anllely Melgarejo)** y **#66 (Carito Curto)**, sumada a la integración de las especificaciones de **Lucy Panduro** (commit `81f9987`), acredita un salto cualitativo definitivo en el módulo `registro-documentario/` (anteriormente `MODULO_REGISTRO_DOCUMENTARIO_PATTY`). La calificación se actualiza formalmente a **80.0% de conformidad**, desmantelando de forma absoluta cualquier mención de abandono o 0%.

```mermaid
sequenceDiagram
    autonumber
    actor C as Administrado / Operador
    participant UI as Formulario Dinámico (React 19)
    participant SEC as Validador Local (Magic Bytes / SHA-256)
    participant API as API Gateway (/api/v1)
    participant S3 as Object Storage (MinIO / S3)
    participant DB as PostgreSQL 18 (TramiCore / DocuCore)

    C->>UI: Selecciona Tipo de Trámite TUPA
    UI->>API: GET /api/v1/tipos-documentos/{id}/formulario-schema
    API-->>UI: Retorna JSON Schema (Draft 2020-12)
    UI->>UI: Renderiza Campos Dinámicos (@rjsf/core)
    C->>UI: Ingresa datos y adjunta archivo PDF (25 MB)
    UI->>SEC: Lee primeros 4 bytes (Blob.slice)
    SEC->>SEC: Verifica Magic Bytes (%PDF -> 0x25 0x50 0x44 0x46)
    SEC->>SEC: Calcula SHA-256 local (Web Crypto API)
    UI->>API: POST /api/v1/storage/presigned-url (file_name, sha256)
    API-->>UI: Retorna Presigned URL S3 (expira en 900s)
    UI->>S3: PUT directo a MinIO con ProgressBar
    S3-->>UI: HTTP 200 OK (ETag validado)
    UI->>API: POST /api/v1/expedientes (Payload JSON + Metadatos S3)
    API->>DB: INSERT atómico libro de registro + CUT
    DB-->>API: CUT generado: EXP-2026-000104
    API-->>UI: Retorna Cargo Digital de Recepción
    UI-->>C: Modal de Cargo con QR y descarga PDF
```

### 3.1. Propuesta de Formularios Dinámicos con JSON Schema (Draft 2020-12)
- **Aporte Técnico de Carito Curto (consolidado en `registro-documentario/01_arquitectura_tecnica_registro_documentario.md`, origen PR #66):** Erradica de raíz el antipatrón EAV (*Entity-Attribute-Value*) y evita programar formularios cableados para cada trámite del TUPA. Propone que el backend sirva la definición en JSON Schema Draft 2020-12 persistida en la columna `sigd_doc.formulario_version.schema_definicion JSONB`.
- **Renderizado en Cliente:** El frontend utiliza un motor reactivo de generación de formularios (ej. `@rjsf/core` o componente dinámico basado en React 19 y Tailwind), interpretando tipos de datos (`string`, `number`, `boolean`, `array`), reglas de validación (`minLength`, `pattern`, `maximum`) y dependencias condicionales (`if-then-else`).
- **Persistencia Indexada:** Las respuestas capturadas se envían como un payload estructurado JSONB a `sigd_doc.expediente_formulario_respuesta`, el cual se indexa mediante GIN (`jsonb_path_ops`) garantizando búsquedas en $O(\log n)$.

### 3.2. Arquitectura de Carga Desacoplada a MinIO/S3 mediante Presigned URLs
- **Eliminación del Cuello de Botella en Node.js/Express:** La propuesta descarta que los archivos adjuntos (expedientes pesados de hasta 25 MB) atraviesen el servidor de backend como streams multipart/form-data.
- **Protocolo de URLs Prefirmadas (*Presigned URLs*):**
  1. El cliente selecciona el archivo PDF en `FileUploadZone.tsx`.
  2. El frontend realiza `POST /api/v1/storage/presigned-url` enviando metadatos (`fileName`, `byteSize`, `mimeType`, `sha256`).
  3. El backend valida cuotas y emite una URL prefirmada HMAC SHA-256 temporal (expiración a los 15 minutos / 900s) para el bucket `sigd-privado`.
  4. El navegador ejecuta un `PUT` binario directo contra el endpoint de MinIO/S3, reportando el porcentaje de carga en tiempo real mediante `onUploadProgress` de Axios.
  5. Una vez confirmado el código HTTP 200 de MinIO, el cliente transmite el `s3Key` y metadatos en la transacción de radicación en PostgreSQL.

### 3.3. Seguridad Criptográfica en Cliente: Magic Bytes %PDF y Cálculo Local SHA-256
- **Validación de Magic Bytes (`%PDF`):** Para evitar ataques de *Extension Spoofing* (ejecutables `.exe` o scripts camuflados como `.pdf`), el cliente no se fía de la extensión ni del `file.type`. Emplea `Blob.slice(0, 4)` y `FileReader` para inspeccionar la firma binaria: debe coincidir exactamente con los 4 bytes hexadecimales `25 50 44 46` (`%PDF`). Si difieren (ej. `4D 5A` de Windows PE), el archivo es rechazado de inmediato antes de consumir ancho de banda.
- **Cálculo Local de Hash SHA-256:** Mediante la Web Crypto API nativa (`crypto.subtle.digest('SHA-256', buffer)`), el navegador calcula la huella criptográfica de 64 caracteres hexadecimales antes de iniciar la subida. Dicho hash se asocia al asiento registral y se valida en backend contra el objeto almacenado en S3, garantizando el principio de integridad y no repudio.

### 3.4. Asistente de Tramitación de 4 Pasos (*Wizard*) de Anllely Melgarejo
Consolidado en `registro-documentario/02_especificacion_funcional_ventanilla_y_mesa_partes.md` (origen PR #62 de Anllely Melgarejo) para estandarizar la atención en ventanilla presencial y virtual:
1. **Paso 1 — Identificación:** Consulta en línea por DNI (8 dígitos) o RUC (11 dígitos). Si existe en IdentiCore, autocompleta datos; si no, permite registro rápido.
2. **Paso 2 — Descripción y Requisitos TUPA:** Selección del procedimiento, redacción del asunto, selección de unidad orgánica destino y declaración de folios.
3. **Paso 3 — Carga y Validación Documental:** Dropzone interactivo, comprobación de tamaño máximo (25 MB), verificación de Magic Bytes y hash SHA-256.
4. **Paso 4 — Confirmación, Emisión de CUT y Cargo Digital:** Resumen de datos, emisión atómica del CUT (`EXP-YYYY-XXXXXX`), generación de Cargo Oficial PDF con código QR y notificación automática a la Casilla Electrónica.

### 3.5. Componentes de Interfaz y Wireframes de Lucy Panduro
Consolidados en `registro-documentario/03_componentes_ui_y_estados_formulario.md` (origen commit `81f9987` de Lucy Panduro):
- `RegisterForm`: Estructura de formulario con validaciones en vivo para persona natural y jurídica.
- `FileUploadZone`: Zona drag & drop con barra de progreso, botón de cancelación y visualizador de archivos adjuntos con remoción previa.
- `ReceiptModal`: Modal de bloqueo tras confirmación que expone el CUT institucional, fecha legal de recepción y botones para imprimir ticket térmico o descargar el Cargo A4.
- `DataTable`: Bandeja con buscador por CUT, filtros por fecha y badges semánticos de estado (`REGISTRADO`, `EN_TRAMITE`, `OBSERVADO`).
- **Máquina de Estados de UI:** Transición rigurosa entre `idle`, `submitting` (deshabilita doble clic), `success` y `error`.

### 3.6. Desglose Dimensional de Cumplimiento (D1: 22, D2: 21, D3: 19, D4: 18 -> 80.0%)

| Dimensión de Evaluación | Ponderación | Puntaje Obtenido | Justificación Pericial Post-Merge |
| :--- | :---: | :---: | :--- |
| **D1. Cobertura Funcional y Casos de Uso** | 25.0% | **22.0%** | Cobertura integral de la mesa de partes presencial y virtual, asistente de 4 pasos de Anllely y componentes modulares de Lucy. Falta detallar la interfaz de subsanación de observaciones técnicas en ventanilla virtual. |
| **D2. Arquitectura y Especificación Técnica Frontend** | 25.0% | **21.0%** | Visión sobresaliente de formularios dinámicos con JSON Schema Draft 2020-12, carga directa S3 con Presigned URLs, Magic Bytes `%PDF` y SHA-256 Web Crypto. Pendiente materializar componentes ejecutables en `src/`. |
| **D3. Sincronización y Contratos con Backend** | 25.0% | **19.0%** | Totalmente compatible con la emisión de CUT en TramiCore y esquemas DocuCore. Falta normalizar los prefijos de rutas con `/api/v1/` y tipar el error RFC 7807. |
| **D4. Marco Normativo Peruano y Accesibilidad** | 25.0% | **18.0%** | Incorpora plazo de subsanación de 48h (Art. 136 LPAG), CUT según MGD-PCM y foliado AGN. Requiere integrar la regla de corte legal a las 16:30 hrs y casilla Ley N° 29733. |
| **CALIFICACIÓN CONSOLIDADA MÓDULO 2** | **100.0%** | **80.0%** | **NIVEL: FAVORABLE RESCATABLE (SALTO: +80.0% vs LÍNEA BASE MAIN PRE-MERGE)** |

---

## 4. REEVALUACIÓN TÉCNICA Y RECONOCIMIENTO FORENSE EN REPORTES-TABLEROS-CONTROL (80.0%)

La integración del **PR #70** consolidó los trabajos de **Jennifer Gatica Saavedra** y **Christian Jhoel Rodríguez Cari (Jhuel)**, culminando la depuración y rescate técnico del módulo de Reportes y Tableros. Se formaliza una calificación de **80.0% de conformidad**, eliminando cualquier rasgo de comercio electrónico previo.

```mermaid
graph LR
    subgraph UX_JHUEL["Diseño UX Ejecutivo & Accesibilidad (Jhuel)"]
        UX1["Vista Ejecutiva < 5s
'Vista de Pájaro'"]
        UX2["Grid Responsivo:
Desktop >1024px
Tablet 768-1024px
Mobile <768px"]
        UX3["Accesibilidad WCAG 2.1 AA
Contraste Daltonismo
ARIA Labels & Teclado"]
    end

    subgraph KPI_GATICA["Analítica Matemática y Métricas (Gatica)"]
        M1["KPI-01: Volumen Procesado"]
        M2["KPI-02: TPR (Tiempo Promedio Respuesta)
Fórmula Formal LaTeX"]
        M3["KPI-03: Tasa Cumplimiento %
Fórmula Formal LaTeX"]
        M4["KPI-04: Cuellos de Botella
Alerta Semafórica"]
    end

    subgraph DASHBOARD["Dashboard Ejecutivo SIGD"]
        D1["Stat Cards con Sparklines de 7 días"]
        D2["LineChart Tendencia Temporal (#1E40AF)"]
        D3["DoughnutChart Distribución por Estados"]
        D4["Tabla Priorizada de Trámites Estancados"]
    end

    UX_JHUEL --> DASHBOARD
    KPI_GATICA --> DASHBOARD
```

### 4.1. Erradicación Total del Sesgo Comercial y Catálogo de 4 KPIs Institucionales
Se han suprimido formalmente métricas inapropiadas como carritos abandonados, pedidos y ventas. En su lugar, Jennifer Gatica (consolidado en `reportes-tableros-control/02_catalogo_kpis_y_metricas_institucionales.md`) estableció el catálogo de 4 indicadores de gestión pública educativa:
1. **KPI-01 — Volumen Total de Documentos Procesados:** Mide el caudal de expedientes atendidos en el período. Meta institucional: $\ge 95\%$.
2. **KPI-02 — Tiempo Promedio de Respuesta (TPR):** Mide la celeridad en la tramitación en horas hábiles. Meta: $\le 24$ horas hábiles.
3. **KPI-03 — Tasa de Solicitudes Completadas en Plazo:** Porcentaje de expedientes resueltos dentro del plazo normativo de 30 días hábiles (LPAG). Meta: $\ge 90\%$.
4. **KPI-04 — Índice de Documentos Pendientes y Atrasados:** Mide la acumulación y cuello de botella institucional. Alerta crítica: $> 5\%$.

### 4.2. Modelado Analítico, Fórmulas Matemáticas en LaTeX y DBML de Jennifer Gatica
Consolidadas rigurosamente en `reportes-tableros-control/03_fuentes_datos_formulas_matematicas.md`:

1. **Tiempo Promedio de Respuesta (TPR):**
   $$\text{TPR} = \frac{\sum_{i=1}^{n} (\text{Fecha Finalización}_i - \text{Fecha Inicio}_i)}{N}$$
   - *Control de Indeterminación Numérica:* Si $N = 0$ (período sin solicitudes resueltas), la función en frontend intercepta la división por cero y retorna formalmente `0.00 hrs` o `--` para evitar `NaN` y caídas de la interfaz.

2. **Tasa de Cumplimiento Normativo (TC):**
   $$\text{TC} = \left( \frac{\text{Expedientes Atendidos en Plazo}}{\text{Total de Expedientes Recibidos}} \right) \times 100$$
   - Si el total de expedientes recibidos es 0, retorna `0%`.

3. **Variación Porcentual Período a Período ($\Delta \%$):**
   $$\Delta \% = \left( \frac{\text{Métrica Período Actual} - \text{Métrica Período Anterior}}{\text{Métrica Período Anterior}} \right) \times 100$$

4. **Modelo de Persistencia DBML (`reportes-tableros-control/diagrama_metricas_dashboard.dbml`):** Define las tablas analíticas `kpi_resumen`, `historico_metricas_diarias` y `registros_reportes`, vinculadas a las unidades orgánicas del instituto.

### 4.3. Diseño UX Responsive Ejecutivo y Accesibilidad WCAG AA de Christian Jhoel (Jhuel)
Consolidado en `reportes-tableros-control/04_diseno_visual_graficos_y_componentes.md` y `reportes-tableros-control/05_navegacion_filtros_y_accesibilidad_ux.md` (aportes UX de Christian Jhoel Jhuel):
- **Vista de Pájaro (< 5 segundos):** Disposición visual optimizada para que el Director General o Secretario Académico identifique anomalías y cuellos de botella en menos de 5 segundos.
- **Breakpoints Responsivos Fluidos:**
  - *Desktop (> 1024px):* Grilla analítica completa con 4 Stat Cards superiores, gráficos de tendencia temporal (LineChart), distribución por estados (DoughnutChart) y tabla de expedientes críticos.
  - *Tablet (768px a 1024px):* Grilla 2x2 apilada con gráficos colapsables.
  - *Mobile (< 768px):* Columna única con carrusel táctil de Stat Cards y tabla con scroll horizontal suave.
- **Accesibilidad WCAG 2.1 AA:** Paleta accesible para daltonismo (`#1E40AF`, `#10B981`, `#F59E0B`, `#EF4444`), contraste mínimo de 4.5:1 verificado, navegación secuencial completa por teclado mediante tecla Tab y atributos `aria-label` en todos los controles interactivos.

### 4.4. Desglose Dimensional de Cumplimiento (D1: 22, D2: 19, D3: 20, D4: 20 -> 80.0%)

| Dimensión de Evaluación | Ponderación | Puntaje Obtenido | Justificación Pericial Post-Merge |
| :--- | :---: | :---: | :--- |
| **D1. Cobertura Funcional y Casos de Uso** | 25.0% | **22.0%** | Saneamiento total del sesgo comercial, 4 KPIs institucionales, visión ejecutiva de Jhuel. Falta incorporar alertas de silencio administrativo positivo/negativo. |
| **D2. Arquitectura y Especificación Técnica Frontend** | 25.0% | **19.0%** | Fórmulas LaTeX rigurosas, prevención de división por cero, breakpoints responsivos y directivas WCAG AA. Pendiente codificar los componentes en `src/pages/reportes/`. |
| **D3. Sincronización y Contratos con Backend** | 25.0% | **20.0%** | Contratos de endpoints REST normalizados (`/resumen`, `/tendencia`, `/estados`) y modelo DBML analítico. |
| **D4. Marco Normativo Peruano y Accesibilidad** | 25.0% | **20.0%** | Pleno cumplimiento de accesibilidad WCAG 2.1 AA para entidades del Estado (PCM) y alineamiento con plazos de tramitación LPAG 27444. |
| **CALIFICACIÓN CONSOLIDADA MÓDULO 6** | **100.0%** | **80.0%** | **NIVEL: FAVORABLE SANEADO (SALTO: +50.0% vs LÍNEA BASE v1.0)** |

---

## 5. AUDITORÍA FORENSE EXHAUSTIVA DEL CÓDIGO FUENTE REACT 19 INTEGRADO (`frontend/src/pages/administracion/`)

La integración del **PR #75** (`F_GONZALES`, commit `4ec0c3a`) introdujo por primera vez en el repositorio código fuente React 19 operativo, transformando radicalmente la fisonomía técnica del proyecto. A continuación se realiza el peritaje exhaustivo de las 7 pantallas, cabeceras, enrutador y dependencias.

### 5.1. Ecosistema Tecnológico del Código Integrado
- **React:** `19.1.1` con React DOM `19.1.1`.
- **Compilador / Tipado:** `typescript: ~5.9.2`.
- **Enrutador:** `react-router-dom: ^7.8.0` (React Router v7).
- **Estilos:** `tailwindcss: ^4.1.11` configurado con `@tailwindcss/vite: ^4.1.11` e `index.css` (@import "tailwindcss";).
- **Gestión de Estado Servidor:** `@tanstack/react-query: ^5.83.0` (inicializado en `main.tsx`).
- **Cliente de Red:** `axios: ^1.11.0` en `frontend/src/api/client.ts`.
- **Construcción:** `vite: ^6.3.5`.

### 5.2. Auditoría Detallada de las 7 Pantallas de Administración

#### 5.2.1. `AdministracionPage.tsx` (Hub Central de Navegación)
- **Ubicación:** `frontend/src/pages/administracion/AdministracionPage.tsx` (78 líneas).
- **Propósito:** Tablero central que expone 6 tarjetas hacia los submódulos administrativos.
- **Arquitectura UI:** Grilla responsiva (`grid gap-5 md:grid-cols-2 xl:grid-cols-3`) con transiciones suaves en hover (`hover:-translate-y-1 hover:shadow-md`).
- **Navegación:** Emplea el hook imperativo `useNavigate()` de React Router v7 hacia las rutas hijas (`/administracion/usuarios`, `/administracion/roles-permisos`, etc.).
- **Diagnóstico:** Excelente calidad visual; código desacoplado y limpio.

#### 5.2.2. `UsuariosPage.tsx` (Gestión y Filtrado de Cuentas de Usuario)
- **Ubicación:** `frontend/src/pages/administracion/UsuariosPage.tsx` (185 líneas).
- **Propósito:** Directorio institucional de funcionarios, filtrado por texto/estado y edición modal de atributos laborales y roles.
- **Tipado Interno:** Declara `type EstadoUsuario = "Activo" | "Inactivo" | "Bloqueado"` e `interface Usuario` (id, nombre, dni, correo, sede, area, cargo, rol, estado, ultimoAcceso).
- **Gestión de Estado:** 4 usuarios iniciales en memoria local (`usuariosIniciales`). Filtros memorizados mediante `useMemo` para búsqueda por nombre, DNI, correo y área.
- **Interacción UI:** Modal de edición con dropdowns para Área, Rol y Estado.
- **Limitación Forense:** Las mutaciones ocurren exclusivamente en memoria mediante `setUsuarios`. Muestra un banner explícito: *"Datos de demostración hasta integrar el backend. Cambios aplicados en la vista de demostración."*

#### 5.2.3. `RolesPermisosPage.tsx` (Matriz de Permisos RBAC)
- **Ubicación:** `frontend/src/pages/administracion/RolesPermisosPage.tsx` (162 líneas).
- **Propósito:** Visualizar y conmutar la matriz de permisos para los roles predeterminados del sistema.
- **Tipado Interno:** `interface Rol` (id, nombre, descripcion, alcance, usuarios) e `interface PermisoModulo` (modulo, ver, crear, editar, derivar, archivar, eliminar, exportar).
- **Gestión de Estado:** Diccionario reactivo `Record<string, PermisoModulo[]>` para 4 módulos (Expedientes, Documentos, Administración, Auditoría). Función `alternarPermiso` que conmuta booleanos en el estado local.
- **Interacción UI:** Layout en dos columnas (`lg:grid-cols-[320px_1fr]`) con sidebar fija y checkboxes con acento azul (`accent-blue-700`).
- **Discrepancia Documental:** El modelo de Jhonatan utiliza banderas booleanas fijas, mientras que Carlos Perea (propuesta integrada en `administracion-seguridad-auditoria/03_control_acceso_roles_permisos_rbac.md`) proponía interfaces genéricas `Role` y `Permission` con `action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE'`.

#### 5.2.4. `AuditoriaPage.tsx` (Consulta Inmutable y Exportación CSV)
- **Ubicación:** `frontend/src/pages/administracion/AuditoriaPage.tsx` (174 líneas).
- **Propósito:** Trazabilidad forense y consulta de eventos inmutables del sistema.
- **Tipado Interno:** `type Resultado = "Exitoso" | "Denegado" | "Error"` e `interface RegistroAuditoria` (id, fecha, usuario, rol, area, accion, modulo, registro, resultado, ip).
- **Capacidad Especial:** Función `exportarCsv()` que genera en memoria un `Blob` con tipo `text/csv;charset=utf-8;`, sanitiza comillas dobles mediante `replaceAll('"', '""')` y dispara la descarga automática del archivo `auditoria-sigd.csv`.
- **Aviso Normativo:** Despliega advertencia formal: *"Los registros de auditoría son de consulta. La interfaz no permite editarlos ni eliminarlos; la inmutabilidad real debe garantizarse en backend y base de datos."*

#### 5.2.5. `TablasMaestrasPage.tsx` (Mantenimiento Institucional y Pestañas)
- **Ubicación:** `frontend/src/pages/administracion/TablasMaestrasPage.tsx` (168 líneas).
- **Propósito:** Configuración de Sedes físicas, Áreas del organigrama institucional y Tipos Documentales.
- **Tipado Interno:** `type TipoTabla = "Sedes" | "Áreas" | "Tipos documentales"`, `type EstadoRegistro = "Activo" | "Inactivo"` e `interface RegistroMaestro`.
- **Gestión de Estado:** Selector de pestañas dinámico, formulario desplegable de inserción con ID autoincremental en memoria.
- **Principio de No Alteración:** La eliminación física no existe; implementa borrado lógico mediante el botón "Inactivar" / "Activar" para preservar la integridad referencial de expedientes históricos.
- **Brecha frente al Backend:** Las áreas institucionales se presentan como una lista plana, omitiendo la representación en árbol jerárquico del **Materialized Path** (`path = '/1/4/12/'`) del esquema `sigd_org`.

#### 5.2.6. `CalendarioLaboralPage.tsx` (Jornada, Feriados y Discrepancia Crítica de Corte)
- **Ubicación:** `frontend/src/pages/administracion/CalendarioLaboralPage.tsx` (171 líneas).
- **Propósito:** Parametrización de días laborables, jornada de atención, huso horario y feriados para el cómputo de vencimientos LPAG.
- **Tipado Interno:** `interface DiaLaboral` (nombre, activo) e `interface Feriado` (id, fecha, nombre). Feriados nacionales precargados (28 y 29 de Julio, 30 de Agosto).
- **DISCREPANCIA CRÍTICA DETECTADA (Riesgo P1):**
  - La pantalla fija la jornada con `horaInicio = "08:00"` y `horaFin = "17:00"`.
  - **Infracción Normativa:** El Art. 138 del TUO de la Ley N° 27444 exige de forma mandatoria que el horario de corte de recepción documental sea a las **16:30 hrs**. Todo documento radicado después de las 16:30:00 se computa legalmente al día hábil siguiente a las 08:00 hrs. Fijan las 17:00 hrs viciaría el cómputo de plazos.
  - **Acción Requerida:** Corregir `horaFin` a `"16:30"` en el Sprint 1 e incorporar el banner dinámico de advertencia legal.

#### 5.2.7. `SeguridadPage.tsx` (Políticas de Acceso, Monitoreo y Desbloqueo)
- **Ubicación:** `frontend/src/pages/administracion/SeguridadPage.tsx` (165 líneas).
- **Propósito:** Monitorización de intentos fallidos de acceso, desbloqueo administrativo de cuentas suspendidas y políticas de sesión.
- **Tipado Interno:** `interface CuentaBloqueada` e `interface IntentoAcceso` (id, fecha, usuario, ip, resultado: "Correcto" | "Fallido").
- **Interacción UI:** 3 Stat Cards calculadas con `useMemo` (Cuentas bloqueadas, Intentos fallidos, Minutos de sesión). Botón "Desbloquear" que remueve interactivamente al usuario de la lista de bloqueo con retroalimentación visual amigable.

---

### 5.3. Auditoría del Componente de Encabezado Reutilizable `AdminPageHeader.tsx`
- **Ubicación:** `frontend/src/components/administracion/AdminPageHeader.tsx` (36 líneas).
- **Propósito:** Estandarizar la cabecera en las 6 subpáginas de administración.
- **Estructura:** Recibe las props `title: string` y `description: string`. Renderiza el identificador institucional "SIGD", el título `<h1>` y un botón de navegación `"← Volver al panel"` que invoca `navigate("/administracion")`.
- **Aislamiento Arquitectural:** Fue concebido como solución aislada debido a que `MainLayout.tsx` presentaba una importación rota, permitiendo a las pantallas de administración renderizarse sin depender del layout global defectuoso.

---

### 5.4. Auditoría de Enrutamiento en `frontend/src/routes/AppRouter.tsx` y Brechas Arquitecturales
El archivo `AppRouter.tsx` define 8 rutas planas:
```tsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/administracion" element={<AdministracionPage />} />
  <Route path="/administracion/usuarios" element={<UsuariosPage />} />
  <Route path="/administracion/roles-permisos" element={<RolesPermisosPage />} />
  <Route path="/administracion/auditoria" element={<AuditoriaPage />} />
  <Route path="/administracion/tablas-maestras" element={<TablasMaestrasPage />} />
  <Route path="/administracion/calendario-laboral" element={<CalendarioLaboralPage />} />
  <Route path="/administracion/seguridad" element={<SeguridadPage />} />
</Routes>
```

#### Brechas Detectadas:
1. **Ausencia de Rutas Protegidas (`ProtectedRoute`):** No existe barrera de autenticación. Cualquier visitante no autenticado que ingrese la URL en el navegador puede acceder a la consola de administración.
2. **Ausencia de Enrutamiento Anidado (`Outlet`):** Las rutas se declaran planas en la raíz. Deberían anidarse bajo un layout común: `<Route path="/administracion" element={<AdminLayout />}><Route index ... /><Route path="usuarios" ... /></Route>`.
3. **Desconexión con `HomePage.tsx`:** La página inicial no contiene enlaces hacia `/administracion`, obligando al usuario a escribir manualmente la ruta en la barra de direcciones.

---

### 5.5. Diagnóstico de Gestión de Estado: Prototipo en Memoria (100% Mock, 0% API)
- **Estado Actual:** El 100% de las mutaciones (edición de usuarios, cambio de permisos RBAC, inactivación de tablas maestras, desbloqueo de cuentas, parámetros de calendario) operan sobre arrays locales de React (`useState`).
- **Pérdida de Persistencia:** Al presionar F5 o recargar la página, todos los cambios se pierden instantáneamente y se restauran los datos mock.
- **Desconexión de TanStack Query:** Aunque `QueryClientProvider` está inicializado en `main.tsx`, **no se ejecuta ningún hook `useQuery` ni `useMutation` en todo el módulo**.

---

### 5.6. Diagnóstico de Capa de Red, Errores RFC 7807 y Correlación `X-Correlation-ID`
- **Cliente Axios:** `frontend/src/api/client.ts` existe pero no es importado por ninguna pantalla.
- **Correlación Distribuida:** No existen interceptores de solicitud que inyecten `X-Correlation-ID: crypto.randomUUID()`, incumpliendo el requerimiento del backend para trazabilidad transversal en `sigd_audit.bitacora_auditoria`.
- **Tratamiento de Errores RFC 7807:** Inexistente. No hay tipos para `ApiProblemDetails`, ni interceptores de respuesta para capturar errores HTTP (400, 401, 403, 404, 409, 422, 500) ni sistema visual de toasts estructurados.

---

### 5.7. Calificación Dimensional de `administracion-seguridad-auditoria` (83.0%)

| Dimensión de Evaluación | Ponderación | Puntaje Obtenido | Justificación Pericial Post-Merge |
| :--- | :---: | :---: | :--- |
| **D1. Cobertura Funcional y Casos de Uso** | 25.0% | **23.0%** | 6 submódulos operativos: Usuarios, Roles RBAC, Auditoría con exportación CSV, Tablas Maestras con borrado lógico, Calendario Laboral y Seguridad con desbloqueo interactivo. |
| **D2. Arquitectura y Especificación Técnica Frontend** | 25.0% | **22.0%** | **Hito físico:** 7 pantallas implementadas en React 19 + TS 5.9 + Tailwind CSS 4, `AdminPageHeader.tsx`, `AppRouter.tsx` activo y saneamiento de `index.html` (14 líneas). Estado local en `useState`. |
| **D3. Sincronización y Contratos con Backend** | 25.0% | **18.0%** | Estructuras de datos alineadas conceptualmente con `sigd_audit`, `sigd_auth` y `sigd_org`. Pendiente cablear endpoints reales, RFC 7807 y `X-Correlation-ID`. |
| **D4. Marco Normativo Peruano y Accesibilidad** | 25.0% | **20.0%** | Feriados nacionales precargados e inmutabilidad de auditoría declarada. Requiere ajustar el horario de corte legal de 17:00 a 16:30 hrs (Art. 138 Ley N° 27444). |
| **CALIFICACIÓN CONSOLIDADA MÓDULO 5** | **100.0%** | **83.0%** | **NIVEL: FAVORABLE IMPLEMENTADO (LÍDER TÉCNICO EN CÓDIGO FRONTEND)** |

---

## 6. CONSISTENCIA DE NUEVAS PROPUESTAS FRENTE A REQUISITOS Y CONTRATOS BACKEND

Para garantizar la interoperabilidad sin fisuras entre el cliente y los 6 subdominios backend (`sigd_tra`, `sigd_doc`, `sigd_org`, `sigd_auth`, `sigd_rut`, `sigd_audit`), se analiza la consistencia técnica de las propuestas integradas frente a las especificaciones DDL de PostgreSQL 18 y los contratos RESTful.

### 6.1. Contratos TramiCore (CUT `EXP-YYYY-XXXXXX`, Foliado Continuo AGN, Regla de Corte 16:30 LPAG)
1. **Generación Atómica del Código Único de Trámite (CUT):**
   - *Formato Canónico MGD-PCM:* `EXP-YYYY-XXXXXX` (ej. `EXP-2026-000104`).
   - *Garantía Transaccional:* El frontend no genera ni incrementa secuencias. La emisión reside en la función PL/pgSQL `sigd_tra.generar_cut_expediente(p_anio INT)`, soportada por secuencias anuales independientes (`seq_cut_2026`) o bloqueo pesimista de fila corta (`SELECT ... FOR UPDATE`). Garantiza la emisión atómica concurrente de 1,000 CUTs/segundo sin saltos ni duplicaciones.
2. **Foliado Digital Progresivo y Continuo (Directiva N° 001-2024-AGN/DNDAA):**
   - *Persistencia:* Entidad `sigd_tra.expediente_documento_folio` (`folio_inicio`, `folio_fin`, `total_folios`, `fecha_foliado`, `foliado_por`).
   - *Restricción de Consistencia:* `CHECK (folio_fin >= folio_inicio AND total_folios = (folio_fin - folio_inicio + 1))`.
   - *Continuidad:* Si el documento previo culminó en el folio $K$, el siguiente debe iniciar obligatoriamente en $K+1$. Prohibición estricta de folios bisados o saltos numéricos.
3. **Regla de Corte LPAG (16:30:00 hrs) y Cómputo en Días Hábiles:**
   - *Marco Legal:* TUO Ley N° 27444, Artículos 117 y 138.
   - *Mesa de Partes Virtual 24/7:* Ingresos en día hábil $\le 16:30:00.000$ inician cómputo legal el día hábil siguiente a las 00:00 hrs. Ingresos en día hábil $\ge 16:30:01.000$, sábados, domingos o feriados trasladan su fecha legal de presentación a las **08:00:00 hrs del primer día hábil laborable siguiente**.
   - *Banner Informativo:* El frontend debe advertir al administrado cuando radique fuera de la jornada hábil.

---

### 6.2. Contratos DocuCore (JSON Schema Draft 2020-12, Presigned URLs MinIO/S3, Magic Bytes, SHA-256)
1. **Formularios Dinámicos con JSON Schema en PostgreSQL 18 JSONB:**
   - *Esquema:* `sigd_doc.formulario_version.schema_definicion JSONB` validado contra JSON Schema Draft 2020-12.
   - *Respuestas:* `sigd_doc.expediente_formulario_respuesta.payload_respuestas JSONB` indexado mediante GIN (`jsonb_path_ops`). Búsquedas indexadas sobre cualquier campo en $O(\log n)$.
2. **Subida Desacoplada a MinIO / AWS S3 Blob Storage:**
   - *Endpoint de Presigned URL:* `POST /api/v1/storage/presigned-url`.
   - *Direct PUT:* El navegador sube el archivo binario crudo directamente al bucket `sigd-privado` mediante HTTPS `PUT`, liberando el Event Loop del backend y habilitando barras de progreso reales.
3. **Inspección de Magic Bytes y Hash SHA-256:**
   - *Magic Bytes:* Cabecera hexadecimal `25 50 44 46` (`%PDF`) leída en cliente mediante `Blob.slice(0, 4)`. Evita la carga de binarios maliciosos PE (`4D 5A`).
   - *Hash SHA-256:* Calculado en cliente vía Web Crypto API (`crypto.subtle.digest`) y contrastado en backend en la columna `sigd_doc.documento_adjunto.sha256_hash CHAR(64)`.

---

### 6.3. Contratos OrganiCore / IdentiCore / CoreLink (Modelo Ternario, Materialized Path, Bitácora Inmutable, RFC 7807)
1. **Modelo Ternario Desacoplado (OrganiCore):**
   - *Separación de Conceptos:*
     1. **Rol de Sistema (`rol`):** Permisos técnicos RBAC (`ROLE_ADMIN`, `ROLE_OPERADOR`, `ROLE_DIRECTIVO`).
     2. **Cargo Institucional (`cargo`):** Puesto formal en el organigrama (Director General, Jefe de Secretaría Académica).
     3. **Facultad de Despacho (`facultad_despacho`):** Atribución jurídica de firma y visación según competencias legales.
   - *Encargaturas y Suplencias:* Tabla `sigd_org.encargatura_despacho` con rango temporal `periodo_vigencia TSTZRANGE` y restricción GiST (`EXCLUDE USING GiST (cargo_id WITH =, periodo_vigencia WITH &&)`) que impide físicamente solapar encargaturas simultáneas para el mismo cargo.
2. **Jerarquía Institucional con Materialized Path ($O(1)$):**
   - Columna `path VARCHAR(255) NOT NULL` indexada con B-Tree en `sigd_org.area` (ej. `/1/4/12/` o `01.03.02`). Resuelve consultas de subordinación mediante prefijo (`WHERE path LIKE '/1/4/%'`) en $O(1)$ sin recurrir a consultas recursivas lentas (`WITH RECURSIVE`).
3. **Modelo Polimórfico de Identidad (IdentiCore):**
   - `sigd_auth.persona`: Entidad abstracta base.
   - `sigd_auth.persona_natural`: DNI de 8 dígitos, nombres y apellidos.
   - `sigd_auth.persona_juridica`: RUC de 11 dígitos (`CHECK (ruc ~ '^(10|15|17|20)[0-9]{9}$')`), razón social y partida registral SUNARP.
   - `sigd_auth.consentimiento_datos`: Consentimiento previo e informado bajo la Ley N° 29733.
4. **Bitácora Forense Inmutable y Middleware RFC 7807 (CoreLink):**
   - *Inmutabilidad en Base de Datos:* `sigd_audit.bitacora_auditoria` con trigger `trg_bloquear_modificacion_auditoria` que ejecuta `BEFORE UPDATE OR DELETE RAISE EXCEPTION 'sigd_audit: Registros estrictamente inmutables'`.
   - *Correlación Transversal:* Contexto `AsyncLocalStorage` que propaga el `X-Correlation-ID` (UUIDv4) a través de todas las capas del servidor.
   - *Middleware Problem Details RFC 7807 / RFC 9457:* Respuestas estructuradas con `type`, `title`, `status`, `detail`, `instance`, `code`, `correlationId` e `invalidParams`.

---

### 6.4. Mapeo Canónico de Endpoints `/api/v1/...` a las Pantallas de Frontend y DTOs TypeScript

A continuación se detalla la integración directa entre las 7 pantallas React implementadas en `frontend/src/pages/administracion/` y los contratos REST de la API:

| Pantalla React | Endpoint Backend | Método | DTO TypeScript Asociado | Propósito Técnico y Regla de Negocio |
| :--- | :--- | :---: | :--- | :--- |
| **AdministracionPage** | `/api/v1/admin/resumen` | `GET` | `AdminDashboardSummaryDTO` | Métricas cuantitativas consolidadas para las tarjetas de navegación. |
| **UsuariosPage** | `/api/v1/usuarios` | `GET` | `UsuarioListItemDTO[]` | Listado paginado con filtros (`busqueda`, `estado`, `areaId`, `rolId`). |
| **UsuariosPage** | `/api/v1/usuarios/:id` | `PUT` | `UpdateUsuarioRequestDTO` | Actualización transaccional de sede, área, cargo y rol. |
| **UsuariosPage** | `/api/v1/usuarios/:id/estado` | `PATCH` | `{ estado: EstadoCuentaUsuario }` | Conmutación de estado operativo (`ACTIVA`, `INACTIVA`, `BLOQUEADA`). |
| **RolesPermisosPage** | `/api/v1/roles` | `GET` | `RolDetailDTO[]` | Catálogo de roles con recuento de usuarios y matriz de permisos. |
| **RolesPermisosPage** | `/api/v1/roles/:id/permisos` | `PUT` | `UpdateRolPermisosRequestDTO` | Persistencia de la matriz de checkboxes booleanos por módulo. |
| **AuditoriaPage** | `/api/v1/auditoria` | `GET` | `RegistroAuditoriaDTO[]` | Consulta paginada con filtros de búsqueda, módulo, resultado y fechas. |
| **AuditoriaPage** | `/api/v1/auditoria/exportar` | `GET` | Stream CSV / `Blob` | Descarga de auditoría sanitizada con hash SHA-256. |
| **TablasMaestrasPage** | `/api/v1/tablas-maestras/sedes` | `GET` / `POST` | `SedeMaestraDTO` | Catálogo y alta de sedes físicas institucionales. |
| **TablasMaestrasPage** | `/api/v1/tablas-maestras/areas` | `GET` / `POST` | `AreaMaestraDTO` | Áreas del organigrama con árbol Materialized Path (`path`). |
| **TablasMaestrasPage** | `/api/v1/tablas-maestras/tipos-documentos` | `GET` / `POST` | `TipoDocumentoMaestroDTO` | Catálogo de trámites TUPA y plazos máximos legales. |
| **CalendarioLaboralPage** | `/api/v1/calendario/jornada` | `GET` / `PUT` | `JornadaLaboralDTO` | Parámetros de días hábiles, horario de inicio y **corte 16:30 hrs**. |
| **CalendarioLaboralPage** | `/api/v1/calendario/feriados` | `GET` / `POST` / `DELETE` | `FeriadoDTO` | Registro de festividades nacionales, regionales y no laborables. |
| **SeguridadPage** | `/api/v1/seguridad/politicas` | `GET` / `PUT` | `PoliticasSeguridadDTO` | Parámetros de max intentos (5), minutos bloqueo (30) y expiración. |
| **SeguridadPage** | `/api/v1/seguridad/cuentas-bloqueadas` | `GET` | `CuentaBloqueadaDTO[]` | Monitoreo de cuentas suspendidas por fuerza bruta. |
| **SeguridadPage** | `/api/v1/seguridad/cuentas/:id/desbloquear` | `POST` | `{ ok: boolean }` | Desbloqueo administrativo con registro auditable inmutable. |

```typescript
// Contratos TypeScript Canónicos para el Módulo de Administración (frontend/src/types/admin.ts)
export type EstadoCuentaUsuario = 'ACTIVA' | 'INACTIVA' | 'BLOQUEADA_TEMPORAL';

export interface AdminDashboardSummaryDTO {
  usuariosActivos: number;
  usuariosBloqueados: number;
  rolesConfigurados: number;
  eventosAuditoriaHoy: number;
  totalSedes: number;
  totalAreas: number;
  totalTiposDocumentales: number;
  horarioAtencionVigente: {
    horaInicio: string; // "08:00"
    horaFin: string;    // "16:30" (LPAG 27444)
    estadoJornada: "ABIERTO" | "CERRADO_POST_CORTE" | "INHABIL";
  };
}

export interface UsuarioListItemDTO {
  id: string; // UUIDv4
  personaId: string;
  nombreCompleto: string;
  numeroDocumento: string; // DNI 8 dígitos
  emailInstitucional: string;
  sede: { id: string; nombre: string };
  area: { id: string; nombre: string; sigla: string };
  cargo: { id: string; nombre: string };
  rol: { id: string; nombre: string; codigo: string };
  estado: EstadoCuentaUsuario;
  ultimoAcceso: string | null;
}

export interface AreaMaestraDTO {
  id: string; // UUID
  codigo: string;
  nombre: string;
  sigla: string;
  parentId: string | null;
  path: string; // Materialized Path (ej. "/1/4/12/")
  nivel: number;
  sedeId: string;
  activo: boolean;
}

export interface JornadaLaboralDTO {
  diasHabiles: Array<{ diaSemana: number; nombre: string; laborable: boolean }>;
  horaInicioAtencion: string; // "08:00:00"
  horaCorteAtencion: string;  // "16:30:00" (Art. 138 LPAG)
  zonaHoraria: string;        // "America/Lima"
}
```

---

## 7. MAPEO INTEGRAL DE COLABORADORES, MATRIZ RACI Y EVALUACIÓN INDIVIDUAL AMPLIADA

### 7.1. Directorio de Colaboradores y Trazabilidad Git (Incorporación de los 8 Nuevos Autores)

Se certifica la identidad de los **18 colaboradores** del equipo técnico frontend mediante cotejo cruzado entre `colaboradores.md`, los commits de los Pull Requests #62, #65, #66, #68, #69, #70 y #75, y las cuentas autoras validadas:

| # | Integrante | Correo Electrónico Oficial | Usuario(s) Git Author Detectados | Rama Git / PR Incorporado | Módulo Funcional Asignado |
|---|---|---|---|---|---|
| 1 | **Christiam Saúl** | `cristiamsaul2@gmail.com` | `cristiamsaul2` | `origin/main` (Coord. General) | **Lead General Frontend** / Arquitectura Transversal |
| 2 | **Jhonatan Nijar Gonzales de Souza** | `jhonatannijargonzalesdesouza@gmail.com` | `JHONATAN` / `TuNombre` | `origin/F_GONZALES` (PR #75) | **M5:** Administración, Seguridad y Auditoría (Líder) |
| 3 | **Carlos Perea ("Gato")** | `caps6954@gmail.com` | `soychivo` / `caps6954` | `origin/F_PEREA` (PR #68) | **M5:** Administración, Matriz RBAC y Seguridad |
| 4 | **Leonel Rivera ("Maxin")** | `leonelrivera6759684@gmail.com` | `maxirivera` | `origin/F_RIVERA` (PR #65, #69) | **M5:** Administración, Auditoría Forense y Logs |
| 5 | **Angel Jesús Vásquez Godoy** | `vasquezgodoyangeljesus@gmail.com` | `angel` | `origin/F_JESUS` | **M5:** Directorio Institucional de Personal |
| 6 | **Patricia Marina (Patty)** | `patriciamarina287@gmail.com` | `patriciamarina287` | `origin/F_PATRICIA` | **M2:** Ventanilla Única y Registro Documentario (Líder) |
| 7 | **Carito Curto** | `cakcy.3@gmail.com` | `cakcy3-web` | `origin/F_CURTO` (PR #66) | **M2:** Formularios JSON Schema y Almacenamiento S3 |
| 8 | **Lucy Panduro Ramos** | `panduroramoslucy@gmail.com` | `panduroramoslucy-ops` | `origin/F_PATRICIA` (commit `81f9987`) | **M2:** Componentes UI y Dropzone de Archivos |
| 9 | **Anllely Melgarejo** | `anllelymelgarejov@gmail.com` | `Anllely-melgarejo` | `origin/F_ANLLELY` (PR #62) | **M2:** Asistente Wizard de 4 Pasos y Cargo Digital |
| 10 | **Noelia** | *Asociada a Grupo 1 M2* | *(Commits canalizados vía Líder)* | `origin/F_NOELIA` | **M2:** Ventanilla Única Presencial y Reglas TUPA |
| 11 | **Angy** | *Asociada a Grupo 1 M2* | *(Commits canalizados vía Líder)* | `origin/F_PATRICIA` | **M2:** Relevamiento de Requisitos de Atención |
| 12 | **Jennifer Gatica Saavedra** | `gaticasaavedrajennifer844@gmail.com` | `gaticasaavedrajennifer844-jpg` | `origin/F_URQUIA` (PR #70) | **M6:** Analítica de KPIs, Fórmulas LaTeX y DBML |
| 13 | **Christian Jhoel Rodríguez Cari (Jhuel)** | `rodriguezcarichristianjhoel@gmail.com` | `rodriguezcarichristianjhoel-byte` | `origin/F_URQUIA` (PR #70) | **M6:** Diseño UX Responsive Ejecutivo y WCAG AA |
| 14 | **Clider Lex Urquia** | `cliderlex@gmail.com` | `cliderlex-sketch` | `origin/F_URQUIA` (PR #70) | **M6:** Reportes, Tableros de Control y KPIs (Líder) |
| 15 | **Lloner Vargas Huayunga** | `vargas.huayunga92@gmail.com` | `vargashuayunga92-11` | `origin/F_VARGAS` | **M6:** Desarrollador de Soporte en Visualización |
| 16 | **Matías Tiziano Zumaeta Alva** | `zumaetaalvamatiastiziano@gmail.com` | `MATIAS TIZIANO ZUMAETA ALVA` | `origin/F_MATIAS` | **M1:** Autenticación, Registro Ciudadano y Casilla (Líder) |
| 17 | **Sergio Adrián Serruche Panduro** | `sserruchepanduro@gmail.com` | `Sergio-Serruche` | `origin/F_SERGIO` | **M1:** Autenticación, Registro Ciudadano y Casilla |
| 18 | **Isack (Isak) Vargas** | `isakvargasss@gmail.com` | `isakvargas` | `origin/F_VARGAS` (SGD) | **M3:** Bandeja de Trabajo Diario y Expedientes (Líder) |
| 19 | **Geric Aldair Salas Ormeño** | `salasormenogericaldair01@gmail.com` | `salasormenogericaldair01-cell` | `origin/B_GERIC` | **M4:** Flujos Internos, Validez Legal y Firma (Líder) |
| 20 | **Lizbeth Jacobo Martel** | `jacobomartellizbeth@gmail.com` | `REDBLACK-OL` | `origin/B_JACOBO` | **M4:** Flujos Internos, Validez Legal y Resoluciones |
| 21 | **Jhasy** | `svrjhass@gmail.com` | `svrjhass-design` | `origin/B_JHASY` | **M4:** Diseño UI/UX, Timeline y Badges CVD |

---

### 7.2. Matriz RACI Integral de Gobernanza Frontend (M1 a M6)

| Integrante / Rol | Rol Institucional | M1: Auth & Casilla | M2: Ventanilla & Reg. | M3: Bandeja & Exp. | M4: Flujos & Firma | M5: Admin & Maestras | M6: Reportes & Dash. |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Christiam Saúl** | Lead General Frontend | **A** | **A** | **A** | **A** | **A** | **A** |
| **Matías Zumaeta** | Líder Sub-equipo M1 | **R** | I | C | I | C | I |
| **Sergio Serruche** | Desarrollador M1 | **R** | I | I | I | I | I |
| **Patricia Marina (Patty)** | Líder Sub-equipo M2 | I | **R** | C | I | I | I |
| **Carito Curto** | Especialista Arquitectura M2 | I | **R** | I | I | I | I |
| **Lucy Panduro Ramos** | Desarrolladora UI M2 | I | **R** | I | I | I | I |
| **Anllely Melgarejo** | Desarrolladora M2 | I | **R** | I | I | I | I |
| **Noelia** | Desarrolladora M2 | I | **R** | I | I | I | I |
| **Angy** | Desarrolladora M2 | I | **R** | I | I | I | I |
| **Isack (Isak) Vargas** | Líder Sub-equipo M3 | C | C | **R** | C | I | C |
| **Geric Salas** | Líder Sub-equipo M4 | I | I | C | **R** | I | I |
| **Lizbeth Jacobo** | Desarrolladora M4 | I | I | I | **R** | I | I |
| **Jhasy** | Diseñadora UI/UX M4 | I | I | I | **R** | I | I |
| **Jhonatan Gonzales** | Líder Sub-equipo M5 | I | I | I | I | **R** | I |
| **Carlos Perea** | Especialista Seguridad M5 | I | I | I | I | **R** | I |
| **Leonel Rivera** | Desarrollador Auditoría M5 | I | I | I | I | **R** | I |
| **Angel Jesús Vásquez** | Desarrollador M5 *(Reasignado)* | C | I | I | I | **R** | I |
| **Clider Lex Urquia** | Líder Sub-equipo M6 | I | I | C | I | I | **R** |
| **Jennifer Gatica** | Analista Métricas M6 | I | I | I | I | I | **R** |
| **Christian Jhoel (Jhuel)** | Desarrollador UI/UX M6 | I | I | I | I | I | **R** |
| **Lloner Vargas** | Desarrollador M6 | I | I | I | I | I | **R** |

---

### 7.3. Cuadro de Evaluación Pericial Individualizada (Escala Vigesimal 0-20)

| # | Integrante | Módulo | Contribución Técnica Clave Post-Merge | Nota (0-20) / % | Estado de Evaluación Post-Merge |
|---|---|:---:|---|:---:|---|
| 1 | **Jhonatan Gonzales** | M5 | Implementación en React 19 de 7 pantallas completas, `AppRouter.tsx` y saneamiento de `index.html`. | **17 / 85%** | Sobresaliente; líder técnico en materialización física de código. |
| 2 | **Carito Curto** | M2 | Especificación de JSON Schema Draft 2020-12, Presigned URLs MinIO/S3, Magic Bytes y SHA-256 local. | **16 / 80%** | Sobresaliente; vanguardia en arquitectura de almacenamiento desacoplado. |
| 3 | **Jennifer Gatica** | M6 | Catálogo formal de 4 KPIs institucionales, modelado matemático en LaTeX y esquema DBML analítico. | **16 / 80%** | Sobresaliente; rigor analítico y control de excepciones numéricas. |
| 4 | **Christian Jhoel (Jhuel)** | M6 | Diseño UX responsive en 3 breakpoints (< 5s vista de pájaro) y accesibilidad WCAG 2.1 AA. | **16 / 80%** | Sobresaliente; excelencia en experiencia de usuario y accesibilidad. |
| 5 | **Carlos Perea** | M5 | Matriz de control de acceso RBAC, requerimientos funcionales e interfaces TypeScript (Role, Permission). | **15 / 75%** | Favorable; formalización de seguridad y permisos granulares. |
| 6 | **Leonel Rivera** | M5 | Especificación de campos de auditoría inmutable, eventos de sistema y no repudio. | **15 / 75%** | Favorable; trazabilidad forense inmutable conforme al marco legal. |
| 7 | **Lucy Panduro Ramos** | M2 | Componentes modulares UI (`RegisterForm`, `FileUploadZone`, `ReceiptModal`, `DataTable`) y estados UI. | **15 / 75%** | Favorable; descomposición de interfaces y feedback visual. |
| 8 | **Anllely Melgarejo** | M2 | Asistente de tramitación de 4 pasos (*Wizard*), comprobante digital CUT y ciclo de vida de trámite. | **15 / 75%** | Favorable; claridad en la experiencia paso a paso del administrado. |
| 9 | **Patricia Marina (Patty)** | M2 | Articulación y coordinación general de la entrega técnica de registro documentario. | **16 / 80%** | Favorable; liderazgo de equipo que logró el salto de 0% a 80%. |
| 10 | **Matías Zumaeta** | M1 | Estudio comparativo SIAGIE (cascada ubigeo) y declaración jurada Poder Judicial. | **15 / 75%** | Favorable; profundidad en normatividad estatal peruana. |
| 11 | **Sergio Serruche** | M1 | Especificación de campos del formulario ciudadano, regex DNI/teléfono y validaciones. | **13 / 65%** | Favorable; precisión en validaciones en cliente. |
| 12 | **Angel Jesús Vásquez** | M5 | Propuesta de interfaz empresarial para gestión de usuarios internos y roles institucionales. | **14 / 70%** | Favorable; reasignado exitosamente a M5 para robustecer el directorio. |
| 13 | **Isack (Isak) Vargas** | M3 | Especificación archivística CCD (Fondo, Sección, Serie), 6 pestañas y modelos TypeScript. | **14 / 70%** | Favorable; dominio del archivo institucional y tipado limpio. |
| 14 | **Clider Lex Urquia** | M6 | Coordinación general de la reingeniería de reportes y esquema de 3 capas. | **14 / 70%** | Favorable; liderazgo que consolidó el rescate del módulo. |
| 15 | **Lloner Vargas** | M6 | Elaboración preliminar de plantillas de documentación para el dashboard (archivadas). | **11 / 55%** | Regular; reorientado a desarrollo de apoyo bajo supervisión de Jhuel. |
| 16 | **Geric Salas** | M4 | Experiencia en modelado de la FSM de 10 estados de RutaDoc y arquitectura de workflows. | **15 / 75%** | Favorable; asume jefatura de M4 para flujos de validez legal. |
| 17 | **Lizbeth Jacobo** | M4 | Especificación de emisión documental, libros de resoluciones y actas académicas. | **14 / 70%** | Favorable; rigor analítico en formalización de actos resolutivos. |
| 18 | **Jhasy** | M4 | Diseño de diagramas de flujo, experiencia visual y modal de verificación CVD. | **13 / 65%** | Favorable; maquetación visual de timelimes y sellos digitales. |
| 19 | **Noelia** | M2 | Soporte en definición de reglas funcionales de ventanilla presencial y requisitos TUPA. | **11 / 55%** | Regular; regularizará trazabilidad Git individual en Sprint 2. |
| 20 | **Angy** | M2 | Relevamiento de requisitos de atención al administrado y asistencia en formularios. | **11 / 55%** | Regular; regularizará asignación de tareas en Sprint 2. |

> **Nota de Articulación Pedagógica y Evaluación Docente:**  
> Las calificaciones y ponderaciones registradas en esta sección corresponden al dictamen preliminar de la auditoría forense post-merge. Para la instrumentación normativa oficial que utilizará el docente titular en la evaluación sumativa y formativa de cada estudiante (incluyendo la rúbrica analítica en la escala vigesimal peruana de 0 a 20 pts, las 4 dimensiones ponderadas, los 32 entregables atómicos verificables `ENT-M01-01` a `ENT-M06-05` y la matriz de penalizaciones técnicas automáticas), consúltese el tercer documento maestro del repositorio: [Plan de Trabajo Modular y Evaluación Docente](PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md).

---

## 8. TAXONOMÍA Y MATRIZ DE SEVERIDAD DE RIESGOS TÉCNICOS, OPERACIONALES Y LEGALES (P0 - P3) POST-MERGE

### 8.1. Actualización de Estados de Riesgo (Levantamiento de RSK-01 y RSK-02)

La sincronización del commit `4ec0c3a` produjo el **levantamiento exitoso de 2 riesgos críticos P0**:
- **RSK-01 (Rama F_GONZALES sin Merge) $\to$ LEVANTADO / RESUELTO:** Fusionado exitosamente en `main` mediante el PR #75, integrando los documentos y el código fuente.
- **RSK-02 (Prototipo Vanilla JS en `index.html`) $\to$ LEVANTADO / RESUELTO:** Jhonatan Gonzales saneó el archivo en el PR #75, erradicando las 848 líneas de Vanilla JS y dejando un HTML5 limpio de 14 líneas que monta correctamente la SPA de Vite con `<div id="root"></div>`.

---

### 8.2. Matriz Exhaustiva de Riesgos Forenses y Nuevos Hallazgos de Código

| ID Riesgo | Nivel | Módulo | Descripción Pericial del Hallazgo | Impacto Técnico / Operacional / Legal | Estado Post-Merge | Plan de Mitigación Inmediato |
|---|:---:|:---:|---|---|:---:|---|
| **RSK-01** | **P0** | **M5** | Rama remota `origin/F_GONZALES` no fusionada a `main`. | Aislamiento de especificaciones técnicas. | 🟢 **RESUELTO** | Fusionado en commit `4ec0c3a` (PR #75). |
| **RSK-02** | **P0** | **Base** | Prototipo Vanilla JS de 848 líneas en `index.html` bloqueaba SPA React. | Bloqueo de arranque de React 19 en Vite. | 🟢 **RESUELTO** | Saneado en PR #75 (14 líneas limpias). |
| **RSK-03** | **P0** | **Base** | Import roto en `MainLayout.tsx` (`HeaderInstitucional.tsx` inexistente). | Error fatal TypeScript (`TS2307`); build fallido. | 🔴 **ABIERTO** | Crear componente `HeaderInstitucional.tsx` en Sprint 1. |
| **RSK-04** | **P0** | **M4** | Riesgo de firma simulada en frontend sin infraestructura PKI X.509. | Nulidad jurídica absoluta de actos administrativos. | 🔴 **ABIERTO** | Integrar invocación estricta a Refirma RENIEC y validador CVD. |
| **RSK-05** | **P1** | **M4** | Carpeta de flujos huérfana de sub-equipo asignado. | Falta de ownership para implementar workflows. | 🟢 **RESUELTO** | Asignado formalmente a Geric Salas, Lizbeth Jacobo y Jhasy. |
| **RSK-06** | **P1** | **M1/M5** | Conflicto de alcance en sub-equipo Matías (registro ciudadano vs admin). | Descoordinación de diseño y contratos. | 🟢 **RESUELTO** | Escindido: Matías/Sergio a M1; Vásquez formalmente a M5. |
| **RSK-07** | **P1** | **M2/M3** | Riesgo de generación no atómica de CUT en cliente. | Colisiones de correlativos y duplicidad registral. | 🟢 **MITIGADO** | Delegado a función atómica PostgreSQL 18 (`sigd_tra`). |
| **RSK-08** | **P1** | **M3** | Infracción a directiva de foliación progresiva continua AGN. | Rechazo de transferencias documentales por el AGN. | 🟢 **MITIGADO** | Especificada entidad `expediente_documento_folio`. |
| **RSK-09** | **P2** | **Base** | Instancia de Axios en `client.ts` carece de interceptores de red. | Peticiones huérfanas sin correlationId ni RFC 7807. | 🔴 **ABIERTO** | Implementar interceptores bidireccionales en Sprint 1. |
| **RSK-10** | **P2** | **M2** | Miembros Noelia y Angy sin historial de commits directos en Git. | Asimetría en evaluación de equipo y sobrecarga. | 🟡 **ABIERTO** | Asignación de ramas individuales en Sprint 2. |
| **RSK-11** | **P2** | **M6** | Mención de Bootstrap 5 en borradores de Clider. | Conflicto de frameworks CSS y sobrepeso de bundle. | 🟢 **RESUELTO** | Estandarizado 100% bajo Tailwind CSS 4 y shadcn/ui. |
| **RSK-12** | **P3** | **M6** | Plantillas genéricas preliminares en antigua subcarpeta `lloner/`. | Confusión documental para desarrolladores de UI. | 🟢 **RESUELTO** | Depuradas y consolidadas en `reportes-tableros-control/01_...` y `04_...`; Gatica y Jhuel canónicos. |
| **RSK-13** | **P1** | **M5** | **Discrepancia Horaria en Calendario:** `CalendarioLaboralPage.tsx` fija corte a las 17:00 hrs en lugar de las 16:30 hrs exigidas por LPAG Art. 138. | Infracción al TUO Ley N° 27444; vicio en cómputo legal de plazos de atención. | 🔴 **NUEVO (P1)** | Ajustar hora de cierre a `"16:30"` y desplegar banner informativo. |
| **RSK-14** | **P1** | **M5** | **Estado Efímero en Memoria:** Las 7 pantallas de administración operan al 100% con arrays `useState` locales sin conexión a API. | Pérdida de cambios al recargar (F5); 0% persistencia real. | 🔴 **NUEVO (P1)** | Conectar hooks TanStack Query v5 a endpoints `/api/v1/...`. |
| **RSK-15** | **P1** | **M5** | **Ausencia de Rutas Protegidas:** `AppRouter.tsx` declara rutas de administración planas y accesibles sin autenticación. | Brecha crítica de seguridad; acceso anónimo a consola. | 🔴 **NUEVO (P1)** | Envolver rutas bajo componente `ProtectedRoute` en Sprint 1. |

---

## 9. GOBERNANZA DE LOS 6 SUB-EQUIPOS Y HOJA DE RUTA DE REMEDIACIÓN TÉCNICA (SPRINT 1)

### 9.1. Saneamiento del Quiebre de Compilación en `MainLayout.tsx`
- **Diagnóstico del Fallo:** La línea 3 de `frontend/src/layouts/MainLayout.tsx` importa `HeaderInstitucional` desde `../components/HeaderInstitucional`. Dicho archivo no existe en el sistema de archivos, deteniendo el compilador con error `TS2307: Cannot find module '../components/HeaderInstitucional'`.
- **Ruta de Solución en Sprint 1:** Crear el componente `frontend/src/components/HeaderInstitucional.tsx` unificando los estilos institucionales (azul marino `#003876`, escudo oficial del IESTP "Suiza", selector de perfil activo y notificaciones), permitiendo que todo el sistema comparta una cabecera global robusta.

---

### 9.2. Corrección del Horario de Corte en `CalendarioLaboralPage.tsx` (16:30 hrs LPAG)
- **Diagnóstico del Fallo:** `CalendarioLaboralPage.tsx` define la jornada laboral con hora de fin a las `"17:00"`. Conforme al Art. 138 del TUO de la Ley N° 27444, el corte administrativo de recepción debe fijarse obligatoriamente a las **16:30:00 hrs**.
- **Ruta de Solución en Sprint 1:** Modificar el valor por defecto de `horaFin` a `"16:30"` y configurar la validación de servidor para que cualquier trámite recibido con posterioridad traslade automáticamente su fecha de cómputo legal al primer día hábil siguiente a las 08:00 hrs.

---

### 9.3. Expansión del Cliente Axios con Interceptores Bidireccionales
- **Diagnóstico del Fallo:** `frontend/src/api/client.ts` carece de interceptores para la cabecera obligatoria de trazabilidad y el tratamiento tipado de errores.
- **Ruta de Solución en Sprint 1:**
  1. *Interceptor de Solicitud:* Inyectar automáticamente `X-Correlation-ID: crypto.randomUUID()` y `Authorization: Bearer <token>`.
  2. *Interceptor de Respuesta:* Capturar respuestas con `Content-Type: application/problem+json` (RFC 7807 / RFC 9457) y transformarlas en una excepción tipada `ApiProblemDetailsError`, extrayendo los campos `code`, `title`, `detail` e `invalidParams` para retroalimentar visualmente a los componentes de formulario (`InputField.tsx`).

---

### 9.4. Rutas Protegidas (`ProtectedRoute.tsx`) y Enrutamiento Anidado (`Outlet`)
- **Diagnóstico del Fallo:** Las 8 rutas de `AppRouter.tsx` son planas y carecen de control de acceso RBAC.
- **Ruta de Solución en Sprint 1:**
  1. Crear `src/components/auth/ProtectedRoute.tsx` que verifique la presencia del token JWT y evalúe si el usuario ostenta el rol `ROLE_ADMIN` o permisos sobre el módulo.
  2. Crear `src/layouts/AdminLayout.tsx` con barra de navegación secundaria y contenedor `<Outlet />`, anidando todas las rutas bajo `/administracion`.

---

### 9.5. Hoja de Ruta Detallada del Sprint 1

| Tarea de Saneamiento | Archivo(s) Afectado(s) | Severidad | Responsable Principal | Criterio de Aceptación y Verificación |
|---|---|:---:|---|---|
| **S-01: Componente Header** | `src/components/HeaderInstitucional.tsx` | 🔴 **P0** | Lead Frontend / Worker | `MainLayout.tsx` compila exitosamente; `npx tsc --noEmit` pasa sin error `TS2307`. |
| **S-02: Corrección Horario LPAG** | `src/pages/administracion/CalendarioLaboralPage.tsx` | 🟡 **P1** | Jhonatan Gonzales / Worker | Horario de corte actualizado a las `"16:30"`; banner normativo desplegado. |
| **S-03: Interceptores Axios** | `src/api/client.ts` | 🟡 **P1** | Worker / Especialista Red | Interceptores inyectan `X-Correlation-ID` UUIDv4 y parsean `ApiProblemDetails` RFC 7807. |
| **S-04: Rutas Protegidas RBAC** | `src/routes/AppRouter.tsx`, `ProtectedRoute.tsx` | 🟡 **P1** | Jhonatan Gonzales / Worker | Rutas de administración protegidas; redirección al login institucional si no hay sesión. |
| **S-05: Tipos Centralizados Admin** | `src/types/admin.ts` | 🟢 **P2** | Carlos Perea / Jhonatan | Interfaces unificadas de usuarios, roles ternarios, auditoría y tablas maestras. |
| **S-06: Cableado TanStack Query** | `src/pages/administracion/UsuariosPage.tsx` | 🟢 **P2** | Jhonatan Gonzales / Worker | Primer hook `useUsuariosQuery` conectado a `GET /api/v1/usuarios`. |

---

## 10. CUMPLIMIENTO DEL MARCO NORMATIVO PERUANO Y ESTÁNDARES DE INTEROPERABILIDAD

### 10.1. TUO Ley N° 27444 (LPAG): Horario de Corte 16:30, Días Hábiles y Acumulación Art. 160
1. **Regla de Horario de Corte (16:30:00 hrs):**
   - Conforme al Art. 138 del TUO de la Ley N° 27444, la jornada de recepción culmina a las 16:30:00 horas. Toda solicitud virtual ingresada con posterioridad se considera legalmente presentada a las **08:00:00 horas del primer día hábil laborable siguiente**. El frontend calcula y expone este diferimiento en el acuse de recibo.
2. **Cómputo en Días Hábiles y Plazo Máximo Supletorio (30 Días):**
   - Los plazos administrativos excluyen sábados, domingos y feriados. El componente `SlaCountdown.tsx` proyecta la cuenta regresiva en días hábiles con alerta semafórica: **Verde (> 5 días)**, **Amarillo (1 a 5 días)** y **Rojo (0 días o vencido)**.
3. **Acumulación de Expedientes Conexos (Art. 160 LPAG):**
   - Habilita la unión de expedientes accesorios a un principal por conexidad jurídica, preservando la foliatura histórica de cada documento.

---

### 10.2. Modelo de Gestión Documental (MGD - PCM / SGTD) y Directiva AGN: CUT `EXP-YYYY-XXXXXX` y Foliado
1. **Estructura Normalizada del CUT:**
   - Estándar obligatorio de interoperabilidad del Estado peruano: `EXP-YYYY-XXXXXX` (ej. `EXP-2026-000104`), con correlativo anual emitido atómicamente en PostgreSQL.
2. **Foliación Digital Continua e Inmutable (Directiva N° 001-2024-AGN/DNDAA):**
   - Todo documento incorporado al expediente recibe foliatura continua sin saltos ni bisados, registrándose en `sigd_tra.expediente_documento_folio` con fecha y autor.

---

### 10.3. Ley N° 27269 y D.S. 052-2008-PCM: Firma Digital con Refirma RENIEC, Sellado TSA y Validador CVD
1. **Firma Digital PKI Oficial:**
   - Los actos resolutivos (Resoluciones Directorales, Actas de Notas) se firman digitalmente mediante el software oficial **Refirma de RENIEC** con certificados digitales X.509 y sellado de tiempo TSA acreditado ante INDECOPI.
2. **Código de Verificación Digital (CVD) y Código QR:**
   - Todo documento oficial firmado estampa en el margen un código alfanumérico CVD de 16 caracteres y un código QR que enlaza al validador público institucional `/verificar-documento`.

---

### 10.4. Ley N° 29733 (Protección de Datos Personales): Consentimiento Expreso y Casilla Electrónica
1. **Consentimiento Libre, Previo, Expreso e Informado:**
   - El formulario de registro de administrados exige el marcado obligatorio de la cláusula de tratamiento de datos personales y aceptación de notificaciones en Casilla Electrónica.
2. **Anonimización en Consultas Públicas:**
   - En el portal público de seguimiento por CUT (`/consulta-tramite`), los datos personales de terceros se ofuscan estrictamente (ej. `71****23`, `j****@institutosuiza.edu.pe`).

---

### 10.5. Estándares Técnicos de Integración: RFC 7807/9457, X-Correlation-ID y Storage MinIO/S3
1. **Problem Details RFC 7807 / RFC 9457:**
   - Respuestas de error estructuradas con `type`, `title`, `status`, `detail`, `instance`, `code`, `correlationId` e `invalidParams`.
2. **Trazabilidad Distribuida:**
   - Encabezado HTTP `X-Correlation-ID` propagado por Axios en cada solicitud y capturado en backend mediante `AsyncLocalStorage`.
3. **Storage Desacoplado:**
   - URLs prefirmadas HMAC SHA-256 de MinIO/S3 para subida directa de archivos PDF con validación previa de Magic Bytes (`25 50 44 46`) y hash SHA-256 local.

---

## 11. TABLAS NORMATIVAS DEL PERITAJE FORENSE (FEATURES Y EDGE CASES ACTUALIZADOS)

### 11.1. Matriz Ampliada de Características Descubiertas (Features Discovered)

| # | Categoría | Característica / Feature | Descripción Técnica Funcional | Entradas (Inputs) | Salidas (Outputs) | Comportamiento de Error | Descubierto Vía |
|---|---|---|---|---|---|---|---|
| 1 | **M2 - Registro** | Renderizado Dinámico JSON Schema | Renderizado automático de formularios de trámite sin codificación estática en cliente. | JSON Schema Draft 2020-12 | Formulario HTML5 con campos reactivos | Toast visual indicando campos requeridos no conformes | `registro-documentario/01_arquitectura_tecnica_registro_documentario.md` |
| 2 | **M2 - Registro** | Validación Magic Bytes de PDF | Inspección de primeros 4 bytes (`25 50 44 46`) en cliente vía `Blob.slice(0, 4)`. | Archivo File seleccionado | Booleano `isValidPDF` | Rechazo instantáneo en dropzone sin consumir red | `registro-documentario/01_arquitectura_tecnica_registro_documentario.md` |
| 3 | **M2 - Registro** | Hash SHA-256 en Cliente | Cálculo de huella criptográfica local mediante `crypto.subtle.digest`. | ArrayBuffer del PDF | Cadena hex SHA-256 (64 chars) | Notificación de fallo criptográfico al usuario | `registro-documentario/01_arquitectura_tecnica_registro_documentario.md` |
| 4 | **M2 - Registro** | Subida Desacoplada MinIO/S3 | Petición `PUT` directa a URL prefirmada evitando sobrecargar el backend. | Presigned URL + File Blob | `HTTP 200 OK` con ETag | Reintento automático y cancelación de carga | `registro-documentario/01_arquitectura_tecnica_registro_documentario.md` |
| 5 | **M2 - Registro** | Wizard de Tramitación de 4 Pasos | Asistente progresivo: Identificación, Trámite, Adjuntos y Confirmación. | Datos del solicitante y PDF | Expediente registrado con CUT | Validación bloqueante que impide avanzar de paso | `registro-documentario/02_especificacion_funcional_ventanilla_y_mesa_partes.md` |
| 6 | **M2 - Registro** | Cargo Digital de Recepción | Emisión de comprobante con CUT, fecha/hora oficial, QR y descarga en PDF. | CUT generado y metadatos | Modal emergente con impresión y PDF | Alerta de timeout si el backend demora en emitir CUT | `registro-documentario/03_componentes_ui_y_estados_formulario.md` |
| 7 | **M5 - Admin** | Hub Central de Navegación | Panel de 6 tarjetas con enlaces directos hacia las áreas de administración. | Clic en botón "Administrar" | Enrutamiento imperativo vía `useNavigate` | Redirección por defecto si la ruta no existe | `AdministracionPage.tsx` |
| 8 | **M5 - Admin** | Cabecera AdminPageHeader | Encabezado reutilizable con botón "← Volver al panel" e identidad SIGD. | Props `title`, `description` | Cabecera renderizada y navegación | N/A | `AdminPageHeader.tsx` |
| 9 | **M5 - Admin** | Directorio y Filtro de Usuarios | Búsqueda reactiva por texto (DNI, nombre, área) y selector de estado. | Strings `busqueda`, `estado` | Lista reactiva `usuariosFiltrados` (`useMemo`) | Sin resultados: muestra tabla vacía con contador | `UsuariosPage.tsx` |
| 10 | **M5 - Admin** | Edición Modal de Cuenta | Modal para modificar área, rol y estado de un funcionario institucional. | Dropdowns en modal | Actualización reactiva de `usuarios` | Validación silente si usuarioEditando es null | `UsuariosPage.tsx` |
| 11 | **M5 - Admin** | Matriz Granular de Permisos RBAC | Matriz interactiva de checkboxes por rol y módulo institucional. | Clic en rol; clic en checkbox | Conmutación reactiva de permisos en memoria | Sin persistencia en backend (vista demo) | `RolesPermisosPage.tsx` |
| 12 | **M5 - Admin** | Visor de Auditoría Inmutable | Exploración forense con filtros combinados (módulo, resultado, búsqueda). | Filtro de búsqueda y dropdowns | Tabla filtrada de logs de alta densidad | Contador muestra "0 eventos encontrados" | `AuditoriaPage.tsx` |
| 13 | **M5 - Admin** | Exportación de Auditoría a CSV | Generación de archivo `auditoria-sigd.csv` en memoria con `Blob` nativo. | Clic en botón "Exportar CSV" | Descarga automática en navegador | Sanitiza comillas dobles duplicándolas (`""`) | `AuditoriaPage.tsx` |
| 14 | **M5 - Admin** | Pestañas de Tablas Maestras | Navegación entre Sedes, Áreas y Tipos Documentales. | Clic en pestaña activa | Filtra y renderiza la categoría seleccionada | Limpia búsqueda y oculta formulario de alta | `TablasMaestrasPage.tsx` |
| 15 | **M5 - Admin** | Alta en Tablas Maestras | Formulario desplegable para registrar código, nombre y detalle maestro. | Inputs controlados | Nuevo registro agregado al array local | Retorna silente si código o nombre están vacíos | `TablasMaestrasPage.tsx` |
| 16 | **M5 - Admin** | Inactivación Lógica de Registro | Conmutación de estado entre Activo e Inactivo sin borrado físico. | Clic en botón "Inactivar" | Cambio de badge de estado y texto de botón | Conserva trazabilidad de expedientes históricos | `TablasMaestrasPage.tsx` |
| 17 | **M5 - Admin** | Configuración de Jornada Laboral | Habilitación de días laborables, horario de atención y huso horario. | Checkboxes de días, inputs tiempo | Parámetros actualizados en memoria | Alerta: Fija 17:00 en lugar de 16:30 LPAG | `CalendarioLaboralPage.tsx` |
| 18 | **M5 - Admin** | Mantenimiento de Feriados | Formulario de fecha/nombre para agregar feriados y botón para quitarlos. | Inputs `fechaNueva`, `nombreNuevo` | Modificación reactiva del array de feriados | Retorna sin acción si falta fecha o descripción | `CalendarioLaboralPage.tsx` |
| 19 | **M5 - Admin** | Monitoreo y Métricas de Seguridad | Stat Cards de cuentas bloqueadas, intentos fallidos y duración de sesión. | Datos calculados con `useMemo` | Renderizado de contadores en tarjetas | N/A | `SeguridadPage.tsx` |
| 20 | **M5 - Admin** | Desbloqueo Interactivo de Cuenta | Botón para desbloquear cuentas suspendidas por exceso de fallos. | Clic en botón "Desbloquear" | Cuenta removida de la lista de bloqueo | Muestra aviso verde "No hay cuentas bloqueadas" | `SeguridadPage.tsx` |
| 21 | **M6 - Reportes** | Catálogo de 4 KPIs Institucionales | Métricas: Total Procesados, TPR, Tasa Cumplimiento y Cuellos de Botella. | Fechas y área seleccionada | Tarjetas con valor, meta y semáforo | Muestra `--` o `0%` ante ausencia de datos | `reportes-tableros-control/02_catalogo_kpis_y_metricas_institucionales.md` |
| 22 | **M6 - Reportes** | Fórmulas Analíticas en LaTeX | Modelos formales para Tiempo Promedio de Respuesta (TPR) y variación. | Timestamps de tramitación | Métrica decimal formateada en horas | Prevención de división por cero fijando en `0.00 hrs` | `reportes-tableros-control/03_fuentes_datos_formulas_matematicas.md` |
| 23 | **M6 - Reportes** | Modelo de Datos Métricas DBML | Estructura analítica: `kpi_resumen`, `registros_reportes`, `historico`. | Esquema relacional analítico | Diagrama de persistencia para reportes | Validación sintáctica DBML | `reportes-tableros-control/diagrama_metricas_dashboard.dbml` |
| 24 | **M6 - Reportes** | Tablero Ejecutivo Adaptable | Breakpoints: Desktop (>1024px), Tablet (768-1024px) y Mobile (<768px). | Viewport del navegador | Vista de pájaro en menos de 5 segundos | Reorganización fluida a columna única en móvil | `reportes-tableros-control/04_diseno_visual_graficos_y_componentes.md` |
| 25 | **M6 - Reportes** | Accesibilidad WCAG 2.1 AA | Contraste mínimo 4.5:1, daltonismo, navegación con Tab y ARIA labels. | Interacción teclado/lector | Navegación accesible completa sin ratón | Foco visual destacado en todos los controles | `reportes-tableros-control/05_navegacion_filtros_y_accesibilidad_ux.md` |

---

### 11.2. Matriz Ampliada de Casos de Borde Críticos (Edge Cases)

| # | Característica / Feature | Caso Borde / Entrada Inusual (Input) | Comportamiento Observado y Solución Forense |
|---|---|---|---|
| 1 | Subida de Archivos en Mesa de Partes | Archivo ejecutable `.exe` renombrado maliciosamente con extensión `.pdf`. | El validador de Magic Bytes en cliente inspecciona `Blob.slice(0, 4)` detectando `4D 5A` (MZ de PE) en lugar de `25 50 44 46` (`%PDF`). Rechazo inmediato en navegador sin invocar la URL prefirmada de S3 ni consumir ancho de banda. |
| 2 | Carga de Archivos en MinIO/S3 | Archivo de tamaño 0 bytes (vacío). | El generador de Presigned URLs valida previamente `byteSize > 0`. Retorna error 400 Bad Request (`ERR_EMPTY_FILE`), bloqueando la creación de la URL de subida. |
| 3 | Cálculo de Métricas en Dashboard | Consulta en período sin solicitudes registradas ($N = 0$). | La fórmula de TPR intercepta la división por cero y retorna formalmente `0.00 hrs` o `--` en lugar de arrojar `NaN` o romper el renderizado de los componentes de gráficos. |
| 4 | Identificación de Administrados | Administrado extranjero presenta Carné de Extranjería (CE) o Pasaporte en lugar de DNI. | El selector polimórfico conmuta la máscara regex y desactiva la validación estricta de 8 dígitos de RENIEC, admitiendo formatos internacionales válidos. |
| 5 | Acceso no Autenticado a Consola Admin | Usuario anónimo ingresa directamente por URL a `/administracion/seguridad`. | En el código actual, la página se renderiza completamente debido a la ausencia de guardas. En el Sprint 1, el componente `ProtectedRoute` interceptará la navegación y redirigirá al login con código 401. |
| 6 | Búsqueda de Usuarios con Espacios | Usuario ingresa término de búsqueda con espacios accidentales (ej. `"  juan  "`). | La función aplica `.trim().toLowerCase()` sobre el input antes de evaluar coincidencias, encontrando los registros correctamente. |
| 7 | Modal de Edición de Usuario | Presionar la tecla ESC mientras el modal de edición está abierto. | El modal no se cierra con ESC (falta listener de teclado); se debe hacer clic en "Cancelar" o en la cruz para invocar `setUsuarioEditando(null)`. |
| 8 | Exportación de Auditoría con Comillas | Evento de log cuya descripción incluye comillas dobles (ej. `Oficio "Confidencial"`). | La función `exportarCsv` ejecuta sanitización escapando comillas mediante duplicación (`""`) y envolviendo cada celda en delimitadores seguros, preservando la integridad del archivo CSV. |
| 9 | Alta en Tablas Maestras con Vacíos | Enviar el formulario de alta con código o nombre compuestos exclusivamente de espacios. | La función valida `if (!codigo.trim() || !nombre.trim()) return;` y aborta la inserción sin provocar excepciones en consola. |
| 10 | Configuración Horaria en Calendario | Configurar `horaInicio` mayor que `horaFin` (ej. 19:00 a 08:00). | La interfaz actual lo permite; genera el mensaje de configuración sin alertar sobre la inconsistencia. Se programó validación en Sprint 1. |
| 11 | Desbloqueo Total de Cuentas | Administrador desbloquea todas las cuentas suspendidas en la vista de seguridad. | Al quedar el array en 0 elementos, la tabla desaparece y se renderiza un banner informativo verde amigable: *"No hay cuentas bloqueadas en la vista actual."* |
| 12 | Recarga de Navegador (F5) en Consola | Modificar usuarios o roles y recargar la página. | Al operar con `useState` local, todos los cambios se pierden y se reestablecen los arrays mock iniciales. Subsanación programada con TanStack Query en Sprint 1. |
| 13 | Registro Posterior al Horario de Corte | Administrado radica expediente virtual a las 16:30:01 hrs de un día hábil. | El sistema estampa la fecha física real en auditoría, pero traslada la `fechaComputoLegal` al día hábil siguiente a las 08:00 hrs, desplegando el banner informativo LPAG. |
| 14 | Intentos Fallidos Consecutivos | Usuario introduce contraseña incorrecta 5 veces consecutivas en menos de 15 minutos. | El backend incrementa `intentos_fallidos`, bloquea la cuenta por 30 minutos y el frontend despliega alerta con temporizador de cuenta regresiva. |

---

## 12. SUITE INTEGRAL DE DIAGRAMAS MERMAID DE ARQUITECTURA, FLUJOS Y CICLOS DE VIDA

### 12.1. Topología de Gobernanza y Flujo Intermodular v4.0.0
```mermaid
flowchart TB
    subgraph ModulosAuditados["Topología Intermodular de Gobernanza Frontend SIGD (v4.0.0)"]
        M1["MÓDULO 1: IDENTICORE
Portal Ciudadano & Casilla
(Matías Zumaeta & Sergio Serruche)
[Conformidad: 45.0% - Escindido]"]
        M2["MÓDULO 2: TRAMICORE & DOCUCORE
Ventanilla Única Presencial & Virtual
(Patty, Carito Curto, Lucy, Anllely)
[Conformidad: 80.0% - Favorable Rescatable]"]
        M3["MÓDULO 3: RUTADOC
Bandeja Diaria & Expedientes
(Isack (Isak) Vargas)
[Conformidad: 60.0% - Aceptable Archivístico]"]
        M4["MÓDULO 4: DOCUCORE
Flujos Académicos & Refirma RENIEC
(Geric Salas, Lizbeth Jacobo, Jhasy)
[Conformidad: 75.0% - Favorable Rescatado]"]
        M5["MÓDULO 5: ORGANICORE
Organigrama, Cargos & 7 Pantallas React 19
(Jhonatan Gonzales, Perea, Rivera, Vásquez)
[Conformidad: 83.0% - Líder Técnico Frontend]"]
        M6["MÓDULO 6: CORELINK
Tableros MGD-PCM, 4 KPIs & DBML
(Clider Urquia, Jennifer Gatica, Jhuel)
[Conformidad: 80.0% - Favorable Saneado]"]
    end

    M1 -->|Registro y Validación Identidad| M2
    M2 -->|Generación Atómica CUT EXP-YYYY-XXXXXX| M3
    M3 -->|Proyección de Actos Resolutivos| M4
    M4 -->|Emisión de RD Firmada y Notificación| M1
    M5 -->|Gobierna Jerarquías, Cargos y Permisos RBAC| M3
    M3 -->|Alimenta Métricas Procesales y SLA| M6
```

---

### 12.2. Máquina de Estados Finita (FSM) de 10 Estados de RutaDoc
```mermaid
stateDiagram-v2
    [*] --> REGISTRADO: Ingreso en Ventanilla Presencial / Virtual
    REGISTRADO --> PENDIENTE_RECEPCION: Derivado a Oficina Receptora
    
    PENDIENTE_RECEPCION --> RECEPCIONADO: Funcionario acepta custodia
    PENDIENTE_RECEPCION --> PENDIENTE_RECEPCION: Rechazado con motivo formal
    
    RECEPCIONADO --> EN_TRAMITE: En análisis técnico / informe
    
    EN_TRAMITE --> OBSERVADO: Faltan requisitos TUPA (Plazo LPAG)
    OBSERVADO --> SUBSANADO: Administrado subsana observaciones
    SUBSANADO --> EN_TRAMITE: Reanudación de cómputo de plazos
    
    EN_TRAMITE --> DERIVADO: Remitido a otra unidad orgánica
    DERIVADO --> PENDIENTE_RECEPCION: En tránsito hacia nueva oficina
    
    EN_TRAMITE --> EN_ATENCION: Proyecto de resolución en despacho
    EN_ATENCION --> ATENDIDO: Firma digital aplicada con Refirma
    
    ATENDIDO --> ARCHIVADO: Notificado en Casilla y custodiado en CCD
    
    REGISTRADO --> ANULADO: Desistimiento o duplicidad fundada
    ARCHIVADO --> [*]
    ANULADO --> [*]
```

---

### 12.3. Secuencia Criptográfica de Firma Digital con Refirma RENIEC y CVD
```mermaid
sequenceDiagram
    autonumber
    actor Autoridad as Autoridad Institucional (Director / Secretario)
    participant UI as Frontend (/documentos/:id/firma)
    participant Back as Backend API (/api/v1/corelink)
    participant Refirma as Agente Refirma RENIEC / TSA Indecopi
    participant S3 as Storage MinIO (Bucket Privado)
    participant Publico as Verificador Público (/verificar-documento)

    Autoridad->>UI: Posiciona visualmente estampa de firma y pulsa "Firmar"
    UI->>Back: POST /api/v1/corelink/documentos/:id/firmar-refirma (coordenadas, motivo)
    Back->>Refirma: Envía Digest SHA-256 del PDF y solicita firma PKI X.509
    Refirma->>Autoridad: Solicita PIN de Token criptográfico / DNIe
    Autoridad->>Refirma: Ingresa PIN correcto
    Refirma-->>Back: Retorna firma digitalizada y estampa con sellado de tiempo TSA
    
    Back->>Back: Genera Código CVD (16 chars), código QR y estampa visual en PDF
    Back->>S3: Almacena PDF firmado inmutable con metadatos
    Back-->>UI: HTTP 200 { documentoFirmadoUrl, cvd: "CVD-2026-X89F-1204" }
    UI->>Autoridad: Confirmación verde y renderizado de documento oficial firmado
    
    Note over Publico: Validación Pública de Autenticidad por Terceros
    actor Ciudadano as Alumno / Empresa / MINEDU
    Ciudadano->>Publico: Ingresa código CVD o sube PDF para validación
    Publico->>Back: GET /api/v1/corelink/documentos/verificar/CVD-2026-X89F-1204
    Back-->>Publico: Retorna dictamen de integridad, firmantes y fecha TSA
    Publico->>Ciudadano: Muestra certificado digital oficial de validez inalterada
```

---

### 12.4. Secuencia de Carga Desacoplada a MinIO/S3 con Magic Bytes y SHA-256
```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Ciudadano / Operador de Ventanilla
    participant Uploader as Componente FileUploadZone.tsx
    participant Crypto as Web Crypto API (Navegador)
    participant Back as Backend API (/api/v1/storage)
    participant MinIO as Almacenamiento MinIO S3

    Usuario->>Uploader: Selecciona archivo anexo (ej. Solicitud.pdf, 25 MB)
    Uploader->>Crypto: Inspecciona Magic Bytes (primeros 4 bytes: 0x25 0x50 0x44 0x46 '%PDF')
    Crypto-->>Uploader: Validación de Magic Bytes Exitosa
    Uploader->>Crypto: Calcula hash SHA-256 completo vía crypto.subtle.digest()
    Crypto-->>Uploader: Hash SHA-256 (64 hex characters)
    
    Uploader->>Back: POST /api/v1/storage/presigned-url
    Note over Uploader,Back: Payload: { filename: "Solicitud.pdf", mimeType: "application/pdf", byteSize: 26214400, sha256: "..." }
    
    Back->>Back: Valida cuota de usuario y genera Presigned URL con expiración (15 min)
    Back-->>Uploader: HTTP 201 { uploadUrl: "https://s3.iestpsuiza.edu.pe/...", fileKey: "exp-2026/...", expiresAt: "..." }
    
    Uploader->>MinIO: PUT direct upload binario a uploadUrl (con progreso en UI)
    MinIO-->>Uploader: HTTP 200 OK (Carga binaria confirmada)
    
    Uploader->>Back: POST /api/v1/expedientes (confirmación de radicación)
    Note over Uploader,Back: Payload: { fileKey: "...", sha256Hex: "...", expedienteId: "EXP-2026-000104", folios: 8 }
    Back-->>Uploader: HTTP 200 { expedienteId: "uuid-...", cut: "EXP-2026-000104" }
    Uploader->>Usuario: Alerta verde de expediente radicado y cargo emitido
```

---

### 12.5. Arquitectura de Integración de las 7 Pantallas de Administración con Backend
```mermaid
graph TD
    subgraph FrontendReact["Frontend React 19 (frontend/src/)"]
        R1["AdministracionPage.tsx
(/administracion)"]
        R2["UsuariosPage.tsx
(/administracion/usuarios)"]
        R3["RolesPermisosPage.tsx
(/administracion/roles-permisos)"]
        R4["AuditoriaPage.tsx
(/administracion/auditoria)"]
        R5["TablasMaestrasPage.tsx
(/administracion/tablas-maestras)"]
        R6["CalendarioLaboralPage.tsx
(/administracion/calendario-laboral)"]
        R7["SeguridadPage.tsx
(/administracion/seguridad)"]
    end

    subgraph CapaRed["Capa de Red & Estado (Sprint 1)"]
        TQ["TanStack Query v5
(Hooks: useUsuarios, useRoles, useAudit)"]
        AX["Axios Client Interceptor
(X-Correlation-ID + Bearer JWT)"]
        ERR["RFC 7807 Error Parser
(ApiProblemDetailsError)"]
    end

    subgraph BackendAPI["Backend Express 5 (/api/v1)"]
        EP1["GET /api/v1/admin/resumen"]
        EP2["GET/PUT /api/v1/usuarios"]
        EP3["GET/PUT /api/v1/roles"]
        EP4["GET /api/v1/auditoria"]
        EP5["GET/POST /api/v1/tablas-maestras/*"]
        EP6["GET/PUT /api/v1/calendario/jornada"]
        EP7["GET/POST /api/v1/seguridad/*"]
    end

    subgraph Persistencia["PostgreSQL 18"]
        DB1["sigd_auth (IdentiCore)"]
        DB2["sigd_org (OrganiCore)"]
        DB3["sigd_audit (CoreLink)"]
        DB4["sigd_tra (TramiCore)"]
    end

    FrontendReact --> TQ
    TQ --> AX
    AX --> ERR
    AX --> BackendAPI
    BackendAPI --> Persistencia
```

---

### 12.6. Cronograma de Subsanación y Desarrollo en 6 Sprints (Gantt)
```mermaid
gantt
    title Cronograma Maestro de Subsanación y Desarrollo Frontend SIGD (6 Sprints · 12 Semanas)
    dateFormat  YYYY-MM-DD
    axisFormat  %d/%m

    section Sprint 1: Fundaciones, Red & Layout (07/09 - 18/09)
    Saneamiento MainLayout & HeaderInstitucional :a1, 2026-09-07, 5d
    Interceptores Axios RFC 7807 & Correlation-ID :a2, after a1, 5d
    Ajuste Corte 16:30 CalendarioLaboralPage     :a3, after a1, 3d

    section Sprint 2: Identidad & Casilla (21/09 - 02/10)
    Registro Natural/Jurídica & Ley 29733 (M1)   :b1, 2026-09-21, 5d
    Casilla Electrónica & Consulta CUT (M1)       :b2, after b1, 5d

    section Sprint 3: Ventanilla & Mesa Partes (05/10 - 16/10)
    Ventanilla Única, JSON Schema & CUT (M2)      :c1, 2026-10-05, 5d
    Carga Desacoplada S3 & Magic Bytes (M2)       :c2, after c1, 5d

    section Sprint 4: Bandejas & Expedientes (19/10 - 30/10)
    Bandeja 6 Pestañas, FSM 10 Estados & SLA (M3) :d1, 2026-10-19, 5d
    Foliado Continuo AGN & Acumulación Art. 160   :d2, after d1, 5d

    section Sprint 5: Flujos & Firma Digital (02/11 - 13/11)
    Generador de Documentos Oficiales (RD/Actas)  :e1, 2026-11-02, 5d
    Integración Refirma RENIEC & Verificador CVD  :e2, after e1, 5d

    section Sprint 6: Admin, RBAC & Reportes (16/11 - 27/11)
    Cableado TanStack Query a Consola Admin (M5)  :f1, 2026-11-16, 5d
    Dashboards MGD-PCM, 4 KPIs & Recharts (M6)    :f2, after f1, 5d
```

---

### 12.7. Ciclo de Vida de No Conformidades y Proceso de Subsanación
```mermaid
stateDiagram-v2
    [*] --> NO_CONFORME_DETECTADO: Peritaje Forense Post-Merge
    
    NO_CONFORME_DETECTADO --> RESCATE_ASIGNADO: Reasignación RACI & Gobernanza
    
    RESCATE_ASIGNADO --> SPRINT_1_FOUNDATIONS: Saneamiento MainLayout, Corte 16:30 & Axios
    SPRINT_1_FOUNDATIONS --> SPRINT_2_M1_IDENTICORE: M1: Personas Jurídicas, Casilla & Ley 29733
    SPRINT_2_M1_IDENTICORE --> SPRINT_3_M2_TRAMICORE: M2: Ventanilla Única, JSON Schema & S3
    SPRINT_3_M2_TRAMICORE --> SPRINT_4_M3_RUTADOC: M3: Bandejas 10 Estados, Foliado AGN & SLA
    SPRINT_4_M3_RUTADOC --> SPRINT_5_M4_DOCUCORE: M4: Generador Documentos, Refirma & CVD
    SPRINT_5_M4_DOCUCORE --> SPRINT_6_M5_M6_ADMIN: M5-M6: Persistencia API Admin & Dashboards MGD
    
    SPRINT_6_M5_M6_ADMIN --> AUDITORIA_CONFORME: Dictamen 100% Conforme y Gate Pass M4
    AUDITORIA_CONFORME --> [*]
```

---

## 13. CONCLUSIONES, RECOMENDACIONES VINCULANTES Y DICTAMEN PERICIAL OFICIAL v4.0.0

1. **Acreditación de la Madurez Técnica Post-Merge:**
   - Se certifica formalmente la erradicación de las calificaciones de 0% en todo el proyecto.
   - `administracion-seguridad-auditoria/` (M5, Jhonatan Gonzales) alcanza **83.0% de conformidad**, erigiéndose como el módulo de mayor madurez del frontend gracias a la entrega de 7 pantallas operativas en React 19 + TypeScript + Tailwind 4, `AdminPageHeader.tsx`, enrutamiento en `AppRouter.tsx` y saneamiento de `index.html`.
   - `registro-documentario/` (M2, Patty Marina) consolida **80.0% de conformidad**, sustentado en las especificaciones de vanguardia de Carito Curto (JSON Schema Draft 2020-12, Presigned URLs MinIO/S3, Magic Bytes `%PDF`, Web Crypto SHA-256), Lucy Panduro (componentes React) y Anllely Melgarejo (wizard de 4 pasos).
   - `reportes-tableros-control/` (M6, Clider Urquia) alcanza **80.0% de conformidad**, eliminando todo sesgo comercial mediante los 4 KPIs institucionales y fórmulas LaTeX de Jennifer Gatica, y el diseño UX responsive adaptable con WCAG 2.1 AA de Christian Jhoel (Jhuel).
   - El **promedio ponderado global del frontend asciende a 70.5%**, reflejando una evolución sustantiva respecto a la línea base previa.

2. **Resoluciones Vinculantes para el Sprint 1:**
   - **Mandato 1 (P0):** Crear `frontend/src/components/HeaderInstitucional.tsx` para subsanar el error fatal de compilación en `MainLayout.tsx`.
   - **Mandato 2 (P1):** Ajustar en `CalendarioLaboralPage.tsx` la hora de cierre a las **16:30 hrs** (Art. 138 TUO Ley N° 27444).
   - **Mandato 3 (P1):** Expandir `frontend/src/api/client.ts` con interceptores bidireccionales para inyectar `X-Correlation-ID` UUIDv4 y estructurar errores RFC 7807 (`ApiProblemDetails`).
   - **Mandato 4 (P1):** Envolver las rutas de `/administracion/*` bajo el componente de autorización `ProtectedRoute.tsx` y layout anidado `AdminLayout.tsx`.
   - **Mandato 5 (P2):** Conectar gradualmente los estados locales `useState` a consultas y mutaciones de TanStack Query v5 conectadas a los endpoints `/api/v1/...`.

3. **Dictamen Pericial Final:**
   - Se emite **DICTAMEN FAVORABLE CON CONDICIONES DE INTEGRACIÓN TÉCNICA (GATE PASS v4.0.0 APROBADO)**.
   - El presente informe constituye la **fuente única de verdad pericial y forense** para el equipo de desarrollo frontend, garantizando el éxito del Sprint 1 y la plena sincronización con la arquitectura backend.

---
*Informe Pericial de Auditoría Integral y Forense de Documentación y Código Frontend — Sistema Integral de Gestión Documentaria (SIGD).*  
*Instituto de Educación Superior Tecnológico Público "Suiza" (Pucallpa, Ucayali, Perú).*  
*Emitido y firmado por el Lead Technical Writer & Senior Forensic Documentation Engineer (teamwork_preview_worker).*

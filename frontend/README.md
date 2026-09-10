# Frontend del SIGD · IESTP "Suiza"

Este directorio contiene el frontend del **Sistema Integral de Gestión Documentaria (SIGD)** del **Instituto de Educación Superior Tecnológico Público "Suiza"** (Pucallpa, Ucayali, Perú), desarrollado bajo una arquitectura moderna basada en componentes con **React 19**, **TypeScript 5.9**, **Tailwind CSS 4** y **React Router v7**.

El frontend está concebido para interoperar con la API RESTful del backend (PostgreSQL 18, 6 esquemas canónicos) y digitalizar de extremo a extremo la tramitación documentaria y académica del instituto.

---

## Documentación Técnica del Sistema

La documentación integral del frontend ha sido organizada en una arquitectura modular limpia en minúsculas (`kebab-case`), compuesta por tres documentos maestros y seis módulos funcionales con especificaciones técnicas secuenciales:

### Documentos Maestros
- 📘 [Plan de Trabajo General, Blueprint de Arquitectura y Diseño de Plantillas Frontend](docs/PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md)
- 📋 [Informe de Auditoría Técnica y Diagnóstico Forense de Documentación Frontend](docs/INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md)
- 🎓 [Plan de Trabajo Modular y Rúbrica Docente de Evaluación Vigesimal Frontend SIGD](docs/PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md)

### Catálogo de Módulos Funcionales de Documentación
1. **Módulo 1: Identidad, Registro de Usuarios y Casilla Electrónica (`registro-usuarios-casilla/`)**
   - 🎯 [00. Plan de Trabajo Modular y Evaluación Docente (26 SP)](docs/registro-usuarios-casilla/00_plan_de_trabajo_y_evaluacion_docente.md)
   - [01. Registro de Ciudadanos, Persona Natural y Jurídica (Ley N° 29733)](docs/registro-usuarios-casilla/01_registro_ciudadano_persona_natural_juridica.md)
   - [02. Selector de Ubigeo en Cascada para Ucayali y SIAGIE](docs/registro-usuarios-casilla/02_ubigeo_cascada_ucayali_siagie.md)
   - [03. Casilla Electrónica Ciudadana y Acuse Notificatorio](docs/registro-usuarios-casilla/03_casilla_electronica_y_ley_29733.md)

2. **Módulo 2: Registro Documentario, Ventanilla y Mesa de Partes (`registro-documentario/`)**
   - 🎯 [00. Plan de Trabajo Modular y Evaluación Docente (34 SP)](docs/registro-documentario/00_plan_de_trabajo_y_evaluacion_docente.md)
   - [01. Arquitectura Técnica de Registro Documentario y Carga Desacoplada MinIO](docs/registro-documentario/01_arquitectura_tecnica_registro_documentario.md)
   - [02. Especificación Funcional de Ventanilla Presencial y Mesa de Partes Virtual](docs/registro-documentario/02_especificacion_funcional_ventanilla_y_mesa_partes.md)
   - [03. Componentes UI y Estados Reactivos de Formularios](docs/registro-documentario/03_componentes_ui_y_estados_formulario.md)

3. **Módulo 3: Bandejas del Funcionario y Gestión de Expedientes (`gestion-expedientes/`)**
   - 🎯 [00. Plan de Trabajo Modular y Evaluación Docente (28 SP)](docs/gestion-expedientes/00_plan_de_trabajo_y_evaluacion_docente.md)
   - [01. Bandeja de Trabajo Diario del Servidor (6 Pestañas y Semáforo SLA)](docs/gestion-expedientes/01_bandeja_trabajo_diario_6_pestanas.md)
   - [02. Cuadro de Clasificación Documental (CCD) y Archivística AGN](docs/gestion-expedientes/02_cuadro_clasificacion_documental_ccd_y_archivistica.md)
   - [03. Modelo de Datos TypeScript y Trazabilidad Inmutable](docs/gestion-expedientes/03_modelo_datos_typescript_y_trazabilidad_inmutable.md)

4. **Módulo 4: Flujos Académicos, Firma Digital y Validez Legal (`flujo-validez-legal/`)**
   - 🎯 [00. Plan de Trabajo Modular y Evaluación Docente (29 SP)](docs/flujo-validez-legal/00_plan_de_trabajo_y_evaluacion_docente.md)
   - [01. Descripción General del Módulo de Validez Legal](docs/flujo-validez-legal/01_descripcion_general_validez_legal.md)
   - [02. Flujos de Trabajo Workflow Académico y Titulación](docs/flujo-validez-legal/02_flujos_trabajo_workflow_academico.md)
   - [03. Documentos Oficiales y Proyección de Resoluciones](docs/flujo-validez-legal/03_documentos_oficiales_firma_digital.md)
   - [04. Validez Legal, Pasarela Refirma RENIEC y Validador CVD](docs/flujo-validez-legal/04_validez_legal_y_validador_cvd.md)
   - [05. Arquitectura Técnica y Contratos de Integración API](docs/flujo-validez-legal/05_arquitectura_tecnica_y_contratos_api.md)
   - [06. Componentes de Interfaz UI y Visores Documentales](docs/flujo-validez-legal/06_componentes_interfaz_ui.md)
   - [Diagrama de Datos DBML: Flujo y Validez Legal](docs/flujo-validez-legal/diagrama_flujo_validez_legal.dbml)

5. **Módulo 5: Administración Institucional, Seguridad RBAC y Auditoría (`administracion-seguridad-auditoria/`)**
   - 🎯 [00. Plan de Trabajo Modular y Evaluación Docente (28 SP)](docs/administracion-seguridad-auditoria/00_plan_de_trabajo_y_evaluacion_docente.md)
   - [01. Descripción General de Administración y Gobernanza](docs/administracion-seguridad-auditoria/01_descripcion_general_administracion.md)
   - [02. Mantenimiento de Tablas Maestras y Catálogos TUPA](docs/administracion-seguridad-auditoria/02_tablas_maestras_y_catalogos.md)
   - [03. Control de Acceso Basado en Roles (RBAC) y Matriz de Permisos](docs/administracion-seguridad-auditoria/03_control_acceso_roles_permisos_rbac.md)
   - [04. Logs de Auditoría Inmutable y Bitácora Forense](docs/administracion-seguridad-auditoria/04_logs_auditoria_inmutable_trazabilidad.md)
   - [05. Directorio de Usuarios y Políticas de Seguridad de Acceso](docs/administracion-seguridad-auditoria/05_directorio_usuarios_y_seguridad_acceso.md)
   - [06. Calendario Laboral y Cómputo de Plazos LPAG (Corte 16:30 hrs)](docs/administracion-seguridad-auditoria/06_calendario_laboral_y_jornada_lpag.md)

6. **Módulo 6: Indicadores de Gestión, KPIs MGD y Tableros de Control (`reportes-tableros-control/`)**
   - 🎯 [00. Plan de Trabajo Modular y Evaluación Docente (29 SP)](docs/reportes-tableros-control/00_plan_de_trabajo_y_evaluacion_docente.md)
   - [01. Descripción General de Reportes y Tableros Directivos](docs/reportes-tableros-control/01_descripcion_general_reportes_dashboard.md)
   - [02. Catálogo de KPIs y Métricas del Modelo de Gestión Documental](docs/reportes-tableros-control/02_catalogo_kpis_y_metricas_institucionales.md)
   - [03. Fuentes de Datos y Fórmulas Matemáticas de Desempeño](docs/reportes-tableros-control/03_fuentes_datos_formulas_matematicas.md)
   - [04. Diseño Visual, Cuadrículas y Gráficos Estadísticos](docs/reportes-tableros-control/04_diseno_visual_graficos_y_componentes.md)
   - [05. Navegación, Filtros Multicriterio y Accesibilidad UX](docs/reportes-tableros-control/05_navegacion_filtros_y_accesibilidad_ux.md)
   - [06. Arquitectura Frontend y Plan de Pruebas de Métricas](docs/reportes-tableros-control/06_arquitectura_frontend_y_plan_pruebas.md)
   - [Diagrama de Datos DBML: Métricas del Dashboard](docs/reportes-tableros-control/diagrama_metricas_dashboard.dbml)

---

## Arquitectura y Tecnologías Previstas

| N.° | Tecnología | Versión objetivo | Uso dentro del SIGD |
|:---:|------------|:----------------:|----------------------|
| 1 | React | 19.x | Biblioteca principal basada en componentes para la interfaz de usuario. |
| 2 | TypeScript | 5.x | Tipado estático riguroso y contratos de sincronización con backend. |
| 3 | Vite | 6.x | Servidor de desarrollo de ultra-alta velocidad y empaquetador ESM. |
| 4 | Tailwind CSS | 4.x | Framework de estilos por clases de utilidad con variables de diseño institucional. |
| 5 | React Router DOM | 7.x | Gestión de enrutamiento SPA, layouts anidados y guardianes de acceso RBAC. |
| 6 | Axios | 1.x | Cliente HTTP tipado con interceptores bidireccionales (JWT, X-Correlation-ID, RFC 7807). |
| 7 | TanStack Query | 5.x | Gestión de estado asíncrono del servidor, cacheo y mutaciones optimistas. |

---

## Estructura del Directorio Frontend

```text
frontend/
├── docs/                                       # Documentación técnica modular consolidada
│   ├── administracion-seguridad-auditoria/     # Plan modular y especificaciones M5 (00 al 06)
│   ├── flujo-validez-legal/                    # Plan modular y especificaciones M4 (00 al 06 + DBML)
│   ├── gestion-expedientes/                    # Plan modular y especificaciones M3 (00 al 03)
│   ├── registro-documentario/                  # Plan modular y especificaciones M2 (00 al 03)
│   ├── registro-usuarios-casilla/              # Plan modular y especificaciones M1 (00 al 03)
│   ├── reportes-tableros-control/              # Plan modular y especificaciones M6 (00 al 06 + DBML)
│   ├── INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md
│   ├── PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md
│   └── PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md
├── public/                                     # Activos estáticos públicos servidos directamente
├── src/
│   ├── api/                                    # Instancia y configuración del cliente Axios
│   ├── assets/                                 # Recursos estáticos importables (imágenes, SVG)
│   ├── components/                             # Componentes UI compartidos y modulares
│   │   ├── administracion/                     # AdminPageHeader.tsx
│   │   └── Card.tsx
│   ├── config/                                 # Lectura y tipado de variables de entorno
│   ├── hooks/                                  # Hooks personalizados de React
│   ├── layouts/                                # Layouts estructurales (MainLayout.tsx)
│   ├── pages/                                  # Pantallas SPA del sistema
│   │   ├── administracion/                     # 7 pantallas completas React 19 (PR #75)
│   │   │   ├── AdministracionPage.tsx          # Panel Hub principal
│   │   │   ├── UsuariosPage.tsx                # Gestión de usuarios y cuentas
│   │   │   ├── RolesPermisosPage.tsx           # Matriz interactiva RBAC
│   │   │   ├── AuditoriaPage.tsx               # Visor forense de eventos inmutables
│   │   │   ├── TablasMaestrasPage.tsx          # Sedes, Áreas (Materialized Path) y TUPA
│   │   │   ├── CalendarioLaboralPage.tsx       # Jornada hábil y corte LPAG 16:30 hrs
│   │   │   └── SeguridadPage.tsx               # Políticas de contraseña y control de accesos
│   │   └── HomePage.tsx                        # Pantalla de bienvenida / Dashboard
│   ├── routes/                                 # Enrutador centralizado (AppRouter.tsx)
│   ├── types/                                  # Definiciones de tipos e interfaces TypeScript
│   ├── utils/                                  # Funciones utilitarias puras
│   ├── App.tsx                                 # Componente raíz
│   └── main.tsx                                # Punto de entrada React 19
├── index.html                                  # Documento HTML único de montaje SPA
├── package.json                                # Manifiesto de dependencias y scripts de construcción
├── tsconfig.json                               # Configuración de compilador TypeScript
└── vite.config.ts                              # Configuración de Vite con alias '@' hacia 'src'
```

---

## Estado Actual de la Implementación

El proyecto cuenta con una base arquitectural consolidada y un avance físico de código en el módulo de administración:
1. **Punto de Montaje SPA:** Configurado en `index.html`, `src/main.tsx` y `src/App.tsx` con React 19 y React Router v7.
2. **Módulo de Administración (`src/pages/administracion/`):** 7 pantallas funcionales implementadas en React 19 + Tailwind CSS 4 (`AdministracionPage`, `UsuariosPage`, `RolesPermisosPage`, `AuditoriaPage`, `TablasMaestrasPage`, `CalendarioLaboralPage`, `SeguridadPage`), encabezado modular institucional (`AdminPageHeader.tsx`) y rutas sincronizadas en `src/routes/AppRouter.tsx` (PR #75, commit `4ec0c3a`).
3. **Planes de Conexión:** Los módulos de Mesa de Partes Virtual (`registro-documentario`), Casilla Electrónica (`registro-usuarios-casilla`), Bandeja de Expedientes (`gestion-expedientes`), Firma Digital (`flujo-validez-legal`) y Tableros MGD (`reportes-tableros-control`) cuentan con especificaciones completas listas para integración con los endpoints del backend en los Sprints subsiguientes conforme al Plan Maestro.

---

## Configuración y Ejecución Local

1. Clonar el repositorio y situarse en la raíz del frontend:
   ```bash
   cd frontend
   ```
2. Instalar las dependencias de NodeJS:
   ```bash
   npm install
   ```
3. Configurar las variables de entorno copiando `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
   Asegurar que `VITE_API_BASE_URL` apunte a la instancia activa del backend API (`http://localhost:8000/api/v1`).
4. Iniciar el servidor de desarrollo Vite:
   ```bash
   npm run dev
   ```
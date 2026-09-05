# PLAN DE TRABAJO MODULAR Y RÚBRICA DOCENTE DE EVALUACIÓN VIGESIMAL FRONTEND SIGD
## Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali)

---

### METADATOS DEL DOCUMENTO INSTITUCIONAL
- **Código de Documento:** `SIGD-DOC-PLAN-EVAL-2026-M6`
- **Versión:** `1.0.0 (Edición Definitiva de Calificación y Gobernanza)`
- **Fecha de Emisión:** `2026-09-05`
- **Ciclo Académico:** `2026-2`
- **Programa de Estudios:** `Desarrollo de Sistemas de Información (DSI)`
- **Unidad Didáctica:** `Taller de Programación Web / Proyecto Integrador SIGD`
- **Docente Titular / Product Owner:** `Ing. Renato Henyer Tarazona Flores`
- **Scrum Master & Arquitecto Principal:** `Christiam Saúl`
- **Equipo de Desarrollo Frontend:** `21 Colaboradores (Sub-equipos M1 al M6 y Arquitectura Transversal)`
- **Repositorio Oficial:** `https://github.com/rhtf-92/SIGD`
- **Ubicación Canónica en Repositorio:** `frontend/docs/PLAN_DE_TRABAJO_MODULAR_Y_EVALUACION_DOCENTE.md`
- **Estado Normativo:** `Aprobado para Evaluación Docente y Auditoría de Integración`

---

## ÍNDICE GENERAL

1. [PORTADA, METADATOS Y MARCO NORMATIVO INSTITUCIONAL](#1-portada-metadatos-y-marco-normativo-institucional)
   - 1.1. Contexto Institucional del IESTP "Suiza"
   - 1.2. Marco Jurídico y Normativo Peruano Vinculante
   - 1.3. Principios Rectores de Interoperabilidad y Ciberseguridad
2. [R1: PLAN DE TRABAJO MODULAR EXHAUSTIVO NIVEL SENIOR (MÓDULOS 1 AL 6)](#2-r1-plan-de-trabajo-modular-exhaustivo-nivel-senior-módulos-1-al-6)
   - 2.1. Arquitectura Base del Frontend (React 19, TypeScript 5.9, Tailwind CSS 4)
   - 2.2. Módulo 1: Identidad, Registro Ciudadano y Casilla Electrónica (`registro-usuarios-casilla/`)
   - 2.3. Módulo 2: Registro Documentario, Ventanilla y Mesa de Partes (`registro-documentario/`)
   - 2.4. Módulo 3: Bandejas del Servidor y Gestión de Expedientes (`gestion-expedientes/`)
   - 2.5. Módulo 4: Flujos Académicos, Firma Digital y Validez Legal (`flujo-validez-legal/`)
   - 2.6. Módulo 5: Administración, Seguridad y Auditoría (`administracion-seguridad-auditoria/`)
   - 2.7. Módulo 6: Reportes, Tableros de Control y KPIs Institucionales (`reportes-tableros-control/`)
   - 2.8. Catálogo Unificado de Endpoints REST `/api/v1/...` y Tratamiento de Errores RFC 7807
3. [R2: MATRIZ DOCENTE DE ENTREGABLES VERIFICABLES](#3-r2-matriz-docente-de-entregables-verificables)
   - 3.1. Resumen Ejecutivo de Capacidad y Esfuerzo (Story Points)
   - 3.2. Matriz Maestra de 32 Entregables Técnicos Atómicos (`ENT-M01-01` a `ENT-M06-05`)
   - 3.3. Directorio Nominal de los 21 Colaboradores y Matriz RACI Integral
4. [R3: RÚBRICA ANALÍTICA DE CALIFICACIÓN EN SISTEMA VIGESIMAL PERUANO (0 A 20)](#4-r3-rúbrica-analítica-de-calificación-en-sistema-vigesimal-peruano-0-a-20)
   - 4.1. Escala Vigesimal Oficial y Niveles de Logro de Competencia
   - 4.2. Dimensiones de Evaluación Ponderadas (100% / 20 Puntos)
   - 4.3. Matriz Analítica Bidimensional (Dimensiones $\times$ Niveles de Logro)
   - 4.4. Fórmula Matemática de Calificación Vigesimal
   - 4.5. Tabla de Penalizaciones Técnicas Automáticas (`PEN-01` a `PEN-07`)
   - 4.6. Ficha Docente de Evaluación Individual y Registro de Calificaciones
   - 4.7. Protocolo Oficial de Sustentación Oral y Demostración en Vivo
5. [R4: GRAFO DE NAVEGACIÓN Y ENLACES RELATIVOS TRANSVERSALES](#5-r4-grafo-de-navegación-y-enlaces-relativos-transversales)
   - 5.1. Mapeo de Enlaces a Documentos Maestros
   - 5.2. Mapeo de Enlaces a las 27 Especificaciones Técnicas Modulares
   - 5.3. Certificación de Cero Enlaces Rotos (100% Navegabilidad Local)

---

## 1. PORTADA, METADATOS Y MARCO NORMATIVO INSTITUCIONAL

### 1.1. Contexto Institucional del IESTP "Suiza"
El **Instituto de Educación Superior Tecnológico Público "Suiza"**, con sede en la ciudad de Pucallpa, Provincia de Coronel Portillo, Departamento de Ucayali, constituye una institución líder en la formación técnica profesional de la Amazonía peruana. En el marco del proceso de transformación digital y acreditación de la calidad educativa, el programa de estudios de **Desarrollo de Sistemas de Información (DSI)** ejecuta la ingeniería y puesta en producción del **Sistema Integral de Gestión Documentaria (SIGD)**.

El SIGD reemplaza los canales manuales y dispersos de tramitación física por una plataforma web corporativa de alta disponibilidad, estructurada sobre una arquitectura desacoplada de microservicios en backend y una aplicación de cliente enriquecido en **React 19 + TypeScript 5.9 + Tailwind CSS 4**. Su misión es garantizar la celeridad procesal, la trazabilidad estricta y el valor legal pleno de los trámites académicos y administrativos institucionales.

### 1.2. Marco Jurídico y Normativo Peruano Vinculante
La arquitectura funcional y técnica del frontend del SIGD está sujeta de manera estricta y no negociable al ordenamiento legal de la República del Perú:

1. **MINEDU — Resolución Viceministerial N° 178-2018-MINEDU:**
   - *Lineamientos Académicos Generales para los Institutos de Educación Superior Tecnológica:* Rige la estructura de planes de estudio, convalidación de unidades formativas, titulación profesional técnica y emisión de certificados oficiales, determinando los flujos académicos del Módulo 4.
2. **TUO de la Ley N° 27444 — Ley del Procedimiento Administrativo General (Decreto Supremo N° 004-2019-JUS):**
   - **Artículo 138 (Horario de Atención y Recepción):** Establece que la jornada administrativa ordinaria fija un **horario de corte a las 16:30 hrs**. Toda solicitud o expediente ingresado por medios electrónicos después de las 16:30 hrs en día hábil, o durante días sábados, domingos o feriados, se considera formal y jurídicamente recibido a las **08:00 hrs del día hábil inmediato siguiente**.
   - **Artículo 38 y 39 (Plazos Procesales y Silencio Administrativo):** Plazo perentorio general máximo de **30 días hábiles** para resolver procedimientos administrativos sujetos a evaluación previa, lo que fundamenta el semáforo SLA visual en Módulo 3.
   - **Artículo 160 (Acumulación de Expedientes):** Habilita la acumulación de expedientes conexos bajo un único expediente principal conservando su trazabilidad histórica.
3. **Ley N° 27269 — Ley de Firmas y Certificados Digitales (y D.S. N° 052-2008-PCM):**
   - Otorga a la firma digital generada dentro de la Infraestructura Oficial de Firma Electrónica (IOFE) la misma validez y eficacia jurídica que la firma manuscrita.
   - Demanda el uso del estándar **PAdES-BES** y sellado de tiempo criptográfico (**TSA — Time Stamping Authority**) bajo el estándar **RFC 3161**, garantizando autenticidad, integridad y no repudio.
   - Articula con el software oficial **Refirma de RENIEC** mediante el protocolo `refirma://` y exige la inclusión obligatoria del **Código de Verificación Digital (CVD)** y código **QR** para la comprobación de autenticidad de la representación impresa.
4. **Ley N° 29733 — Ley de Protección de Datos Personales (y D.S. N° 003-2013-JUS):**
   - Establece la obligación de recabar el **consentimiento previo, expreso, inequívoco e informado** de administrados, docentes y estudiantes para el tratamiento de sus datos personales.
   - Regula la **Casilla Electrónica Institucional** como domicilio digital vinculante (Art. 20 del TUO Ley N° 27444), exigiendo la generación inmutable del acuse de notificación digital.
5. **Directiva N° 001-2019-AGN/DDPA — Archivo General de la Nación (AGN):**
   - Normas para la organización de documentos de archivo en la administración pública: Exige el **foliado progresivo y continuo** en números arábigos correlativos (1, 2, 3...), prohibiendo tachaduras, enmiendas, letras, sub-foliaciones o adiciones como 'bis' o 'ter'.
6. **Modelo de Gestión Documental (MGD) — Presidencia del Consejo de Ministros (Decreto Legislativo N° 1310):**
   - Dicta los lineamientos para la tramitación electrónica interoperable en el Estado Peruano, definiendo el **Código Único de Trámite (CUT)** estructurado institucionalmente bajo el formato `EXP-YYYY-XXXXXX` y el Cuadro de Clasificación Documental (CCD).

### 1.3. Principios Rectores de Interoperabilidad y Ciberseguridad
- **No Repudio e Integridad:** Los documentos almacenados en MinIO/S3 son verificados antes de su carga mediante cálculo del hash SHA-256 en cliente (`Web Crypto API`) e inspección de *Magic Bytes* (`0x25 0x50 0x44 0x46` / `%PDF`).
- **Trazabilidad Inmutable:** Cada cambio de estado de los expedientes obedece al patrón de diseño *State Pattern* y genera eventos inmutables de auditoría vinculados con un identificador de correlación `X-Correlation-ID` (UUID v4).
- **Accesibilidad Universal:** Conforme a la Directiva de Accesibilidad Web del Estado Peruano, la totalidad de interfaces de usuario deben satisfacer el nivel **WCAG 2.1 AA** (contraste mínimo de color $4.5:1$, navegación completa por teclado y soporte WAI-ARIA).

---

## 2. R1: PLAN DE TRABAJO MODULAR EXHAUSTIVO NIVEL SENIOR (MÓDULOS 1 AL 6)

### 2.1. Arquitectura Base del Frontend (React 19, TypeScript 5.9, Tailwind CSS 4)
La aplicación frontend del SIGD implementa los paradigmas más avanzados de la ingeniería de software moderna:

```
frontend/src/
├── api/                  # Cliente Axios singleton con interceptores bidireccionales RFC 7807 y X-Correlation-ID
├── assets/               # Recursos estáticos institucionales, logotipos y vectores
├── components/           # Componentes atómicos reutilizables del UI Kit (botones, tablas, modales, badges)
├── data/                 # Catálogos maestros locales y estructuras estáticas (ucayali.ts)
├── hooks/                # Custom hooks desacoplados para lógica de negocio y consultas reactivas
├── layouts/              # Plantillas estructurales del sistema (MainLayout, AuthLayout, AdminLayout)
├── pages/                # Vistas de página segmentadas por dominio de negocio (M1 a M6)
│   ├── administracion/   # 7 pantallas completas del Módulo 5 (articuladas con AppRouter)
│   ├── casilla/          # Vistas de Casilla Electrónica Ciudadana (M1)
│   ├── expedientes/      # Bandejas de trabajo operativo, semáforo SLA y timeline (M3)
│   ├── flujos/           # Orquestador de workflows académicos y proyector de RD (M4)
│   ├── registro/         # Registro ciudadano polimórfico (M1)
│   ├── reportes/         # Dashboards ejecutivos, mapas de calor y exportadores (M6)
│   ├── tramite/          # Mesa de Partes Virtual y Ventanilla Presencial (M2)
│   └── validador/        # Portal público de consulta CVD sin autenticación (M4)
├── routes/               # Configuración central de rutas AppRouter con guardianes RBAC
├── schemas/              # Esquemas de validación Zod tipados sincronizados con backend
├── styles/               # Directivas globales Tailwind v4 (@import "tailwindcss") y clases institucionales
├── tests/                # Suites de pruebas unitarias y de integración (Vitest / Testing Library)
├── types/                # Contratos formales TypeScript 5.9 (DTOs, Enums, Interfaces de Red)
└── utils/                # Utilitarios criptográficos (SHA-256, Magic Bytes), fechas LPAG y formato
```

#### Reglas Arquitectónicas No Negociables:
1. **Tipado Estricto:** Prohibición absoluta del tipo comodín `any`. Toda estructura de datos de red debe contar con su correspondiente interfaz o `type` en TypeScript 5.9.
2. **Tratamiento Tipado de Errores (RFC 7807 / RFC 9457):** Todas las respuestas de error del backend utilizan la estructura canónica `ApiProblemDetails`. El cliente Axios intercepta los códigos 400, 401, 403, 404, 409, 422 y 500 transformándolos en excepciones tipadas con feedback visual accesible.
3. **Propagación Contextual:** Cada solicitud HTTP emitida por el cliente frontend genera e inyecta la cabecera `X-Correlation-ID: <uuid-v4>`, permitiendo el rastreo forense bidireccional entre la interfaz web y la bitácora WORM de PostgreSQL 18.

---

### 2.2. Módulo 1: Identidad, Registro Ciudadano y Casilla Electrónica (`registro-usuarios-casilla/`)

> [!TIP]
> **Documento Modular Propio y Evaluación Docente:** Consulte el plan detallado y rúbrica específica en [`registro-usuarios-casilla/00_plan_de_trabajo_y_evaluacion_docente.md`](registro-usuarios-casilla/00_plan_de_trabajo_y_evaluacion_docente.md).

#### 2.2.1. Propósito y Alcance Funcional
Proveer el punto de entrada oficial para la identificación y enrolamiento de administrados (estudiantes, egresados, postulantes, empresas y proveedores). Garantiza la validez legal de las personas naturales y jurídicas, su localización geográfica oficial y la apertura de su domicilio digital legal.

#### 2.2.2. Especificación Técnica de Componentes
1. **Formulario Polimórfico de Registro (`PersonaNaturalForm` / `PersonaJuridicaForm`):**
   - **Persona Natural:** Permite seleccionar el tipo de documento: DNI (Documento Nacional de Identidad), Carné de Extranjería (CE) o PTP.
     - *DNI:* Validación obligatoria de exactamente 8 dígitos numéricos (`^[0-9]{8}$`).
     - *CE / PTP:* Validación de formato alfanumérico de 9 a 12 caracteres (`^[A-Z0-9]{9,12}$`).
     - *Control de Edad:* Restricción mínima de 16 años para solicitantes académicos ordinarios.
   - **Persona Jurídica:**
     - *RUC:* Validación estricta de 11 dígitos numéricos que comiencen indefectiblemente con los dígitos `10` (persona natural con negocio) o `20` (persona jurídica societaria) (`^(10|20)[0-9]{9}$`). Verificación matemática del dígito verificador mediante el algoritmo módulo 11 de SUNAT.
     - *Datos Corporativos:* Razón Social, DNI/CE del Representante Legal debidamente acreditado y número de Partida Registral SUNARP.
2. **Selector Jerárquico en Cascada de Ubigeo Ucayali (`UbigeoSelector`):**
   - Integración nativa con la estructura física `src/data/ucayali.ts`.
   - Encadenamiento reactivo en 3 niveles: Departamento (25 Ucayali) $\rightarrow$ Provincia $\rightarrow$ Distrito.
   - Cobertura total de las 4 provincias del departamento:
     - **Coronel Portillo (2501):** Callería, Campoverde, Iparía, Masisea, Yarinacocha, Nueva Requena, Manantay.
     - **Atalaya (2502):** Raimondi, Sepahua, Tahuanía, Yurúa.
     - **Padre Abad (2503):** Padre Abad, Irazola, Curimaná, Neshuya, Alexander Von Humboldt.
     - **Purús (2504):** Purús.
   - Caché local en memoria para evitar llamadas redundantes a la red y mapeo con códigos modulares de instituciones educativas del SIAGIE-MINEDU.
3. **Casilla Electrónica Oficial y Consentimiento Ley N° 29733:**
   - Creación automática de la dirección institucional de buzón electrónico bajo el formato: `{dni}@casilla.iestpsuiza.edu.pe` o `{ruc}@casilla.iestpsuiza.edu.pe`.
   - **Consentimiento Informado Ley N° 29733:** Componente modal y checkbox bloqueante con la cláusula informativa de la Autoridad Nacional de Protección de Datos Personales (ANPDP). La casilla no puede crearse si el valor no es explícitamente `true`.
   - **Acuse Notificatorio Digital:** Mecanismo de confirmación de recepción con sellado de fecha cierta ISO-8601 y hash SHA-256 del acto administrativo notificado.

#### 2.2.3. Endpoints REST Canónicos de M1
- `POST /api/v1/auth/registro-ciudadano`: Registro atómico de Persona Natural o Jurídica. Retorna HTTP 201 con `usuarioId`, `casillaElectronica` y `mensaje`.
- `GET /api/v1/maestras/ubigeo/departamentos`: Retorna catálogo nacional de departamentos.
- `GET /api/v1/maestras/ubigeo/provincias/:depId`: Retorna provincias filtradas (`depId = 25`).
- `GET /api/v1/maestras/ubigeo/distritos/:provId`: Retorna distritos de la provincia seleccionada.

---

### 2.3. Módulo 2: Registro Documentario, Ventanilla y Mesa de Partes (`registro-documentario/`)

> [!TIP]
> **Documento Modular Propio y Evaluación Docente:** Consulte el plan detallado y rúbrica específica en [`registro-documentario/00_plan_de_trabajo_y_evaluacion_docente.md`](registro-documentario/00_plan_de_trabajo_y_evaluacion_docente.md).

#### 2.3.1. Propósito y Alcance Funcional
Gestionar la radicación de expedientes tanto de manera virtual (Mesa de Partes Virtual - MPV 24x7) como presencial (Ventanilla Única en sede Pucallpa). Implementa la regla legal de horario de corte a las 16:30 hrs, formularios dinámicos JSON Schema Draft 2020-12 y almacenamiento desacoplado en MinIO/S3.

#### 2.3.2. Especificación Técnica de Componentes
1. **Regla de Corte Administrativo LPAG 16:30 hrs (`HorarioCorteNotice` / `useHorarioCorte`):**
   - El sistema evalúa continuamente la hora legal peruana (`America/Lima`).
   - Conforme al Artículo 138 del TUO de la Ley N° 27444, si un administrado radicado un trámite después de las **16:30:00 hrs**, o durante días inhábiles (sábados, domingos o feriados de Ucayali):
     - Se registra la `fechaHoraTransaccion` técnica en tiempo real.
     - Se proyecta la `fechaHoraRecepcionLegal` a las **08:00:00 hrs del día hábil siguiente**.
     - La interfaz despliega un banner ámbar explicativo antes del envío y la constancia de cargo estampa ambas fechas.
2. **Motor Dinámico de Formularios JSON Schema (Draft 2020-12):**
   - Los requisitos específicos de cada trámite TUPA institucional (ej. Rectificación de Matrícula, Certificado de Estudios, Título Profesional) se descargan reactivamente desde el backend mediante `GET /api/v1/tipos-documentos/:id/formulario-schema`.
   - El motor `DynamicSchemaForm` parsea la especificación JSON Schema y genera dinámicamente campos tipados (textos, listas desplegables, selectores de fecha, casillas lógicas y selectores de archivos) con validaciones síncronas. El payload resultante se almacena en el campo `datosFormulario` como objeto `JSONB`.
3. **Carga Desacoplada a MinIO/S3 con Presigned URLs:**
   - Para evitar la saturación del servidor Node.js y proteger la memoria del clúster, los archivos no se envían a través de la API REST convencional.
   - **Protocolo de Carga en 4 Fases:**
     1. *Inspección Local de Magic Bytes:* La función `magicBytesValidator.ts` extrae los primeros 4 bytes del archivo (`file.slice(0, 4)`). Valida estrictamente la firma hexadecimal `[0x25, 0x50, 0x44, 0x46]` (`%PDF`). Cualquier archivo ejecutable o imagen renombrada es rechazado instantáneamente en el cliente.
     2. *Cálculo Criptográfico SHA-256:* Mediante la API nativa del navegador `window.crypto.subtle.digest('SHA-256', buffer)`, se genera la firma hash de 64 caracteres hexadecimales.
     3. *Solicitud de Presigned URL:* El frontend envía metadatos (`nombreArchivo`, `mimeType: "application/pdf"`, `tamanoBytes`, `checksumSha256`) a `POST /api/v1/storage/presigned-url` y recibe una URL HTTP PUT firmada con algoritmo AWS SigV4 con TTL de 900 segundos (15 minutos).
     4. *Subida Binaria Directa:* El cliente ejecuta `axios.put(uploadUrl, file)` directo al bucket MinIO institucional con monitoreo porcentual de carga en tiempo real.
4. **Generación Atómica de CUT y Emisión Dual de Cargo:**
   - El Código Único de Trámite (`EXP-YYYY-XXXXXX`) es asignado atómicamente por la secuencia PostgreSQL del backend.
   - Emisión instantánea de cargo en dos formatos:
     - *Ticket Térmico POS (80mm):* Diseñado para la Ventanilla Presencial asistida con impresión directa ESC/POS.
     - *Comprobante Digital PDF A4:* Generado con código QR para consulta pública y código de verificación.

#### 2.3.3. Endpoints REST Canónicos de M2
- `GET /api/v1/tipos-documentos/:id/formulario-schema`: Retorna JSON Schema del trámite.
- `POST /api/v1/storage/presigned-url`: Genera URL prefirmada de carga directa a MinIO/S3.
- `POST /api/v1/expedientes`: Radicación formal del trámite con CUT, metadatos y referencia S3.
- `PATCH /api/v1/asientos/:id/anular`: Anulación justificada de asiento registral (Jefe de Mesa de Partes).

---

### 2.4. Módulo 3: Bandejas del Servidor y Gestión de Expedientes (`gestion-expedientes/`)

> [!TIP]
> **Documento Modular Propio y Evaluación Docente:** Consulte el plan detallado y rúbrica específica en [`gestion-expedientes/00_plan_de_trabajo_y_evaluacion_docente.md`](gestion-expedientes/00_plan_de_trabajo_y_evaluacion_docente.md).

#### 2.4.1. Propósito y Alcance Funcional
Proporcionar la estación central de trabajo diario para los funcionarios, directores y docentes del IESTP "Suiza". Controla el flujo de los expedientes, la aplicación de plazos legales LPAG, el foliado continuo y la organización taxonómica archivística.

#### 2.4.2. Especificación Técnica de Componentes
1. **Bandeja Operativa Unificada de 6 Pestañas (`BandejaExpedientesPage`):**
   - **Pendientes:** Trámites derivados al área aún no recibidos formalmente por el especialista.
   - **En Proceso:** Trámites en evaluación o elaboración de informe técnico por el funcionario.
   - **Derivados:** Trámites enviados a otras dependencias para opinión o visto bueno.
   - **Por Archivar:** Trámites concluidos con acto resolutivo que esperan pase a archivo central.
   - **Archivados:** Expedientes en custodia definitiva en el Archivo Central del instituto.
   - **Rechazados / Observados:** Trámites con observaciones normativas o no admitidos.
   - Cada pestaña muestra badges numéricos reactivos sincronizados mediante TanStack Query.
2. **Semáforo SLA Visual de Plazos Máximos LPAG (`SlaBadge` / `slaCalculator`):**
   - El cómputo de plazos se basa estrictamente en **días hábiles** (excluyendo sábados, domingos y feriados nacionales/regionales del calendario laboral institucional).
   - Umbrales Visuales conforme a la regla de 30 días hábiles del Art. 38 del TUO Ley N° 27444:
     - **Verde (Normal):** Plazo restante mayor a 15 días hábiles.
     - **Ámbar (Advertencia):** Plazo restante entre 6 y 15 días hábiles (o menor a 48 horas en trámites perentorios).
     - **Rojo (Urgente):** Plazo restante menor o igual a 5 días hábiles.
     - **Rojo Parpadeante (Vencido / En Falta):** Plazo mayor a 30 días hábiles consumido sin resolución; activa alerta de responsabilidad funcional según Ley N° 27444.
3. **Timeline Inmutable de Trazabilidad:**
   - Componente vertical `ExpedienteTimeline` de solo lectura que representa la cadena histórica inalterable de cada movimiento: fecha/hora, área emisora, área receptora, nombre del servidor, proveído y enlaces a documentos y anexos.
4. **Foliado Progresivo Continuo (Directiva N° 001-2019-AGN/DDPA):**
   - El sistema asigna números correlativos continuos de folios (`folio_inicio`, `folio_fin`) a cada documento incorporado al expediente.
   - Se prohíbe taxativamente la numeración con letras (ej. folio 14-A) o sufijos 'bis'. Si se adjunta un documento de 5 páginas al final de un expediente con 20 folios, el sistema asigna automáticamente los folios 21 al 25.
5. **Cuadro de Clasificación Documental (CCD) y Acumulación (Art. 160 LPAG):**
   - Organización bajo el Fondo canónico `IESTP_SUIZA`, con 6 secciones orgánicas (Dirección General, Secretaría Académica, Jefatura de Unidad Administrativa, Área de DSI, etc.) y series documentales normalizadas.
   - Soporte para acumulación formal de expedientes conexos, fusionando hojas de ruta bajo el CUT más antiguo sin perder el historial independiente.

#### 2.4.3. Endpoints REST Canónicos de M3
- `GET /api/v1/expedientes`: Consulta paginada con filtros por estado, área, CUT y fechas.
- `GET /api/v1/expedientes/:id`: Detalle completo del expediente con timeline, folios y anexos.
- `POST /api/v1/expedientes/:id/movimientos/recepcionar`: Admisión de expediente derivado.
- `POST /api/v1/expedientes/:id/movimientos/derivar`: Envío a otra unidad orgánica con proveído.
- `POST /api/v1/expedientes/:id/movimientos/observar`: Emisión de pliego de observaciones con suspensión temporal de SLA.
- `POST /api/v1/expedientes/:id/movimientos/archivar`: Custodia definitiva en Archivo Central.
- `POST /api/v1/expedientes/:id/movimientos/desarchivar`: Reapertura motivada autorizada por Dirección.

---

### 2.5. Módulo 4: Flujos Académicos, Firma Digital y Validez Legal (`flujo-validez-legal/`)

> [!TIP]
> **Documento Modular Propio y Evaluación Docente:** Consulte el plan detallado y rúbrica específica en [`flujo-validez-legal/00_plan_de_trabajo_y_evaluacion_docente.md`](flujo-validez-legal/00_plan_de_trabajo_y_evaluacion_docente.md).

#### 2.5.1. Propósito y Alcance Funcional
Automatizar los flujos académicos neurálgicos del IESTP "Suiza" (Titulación Profesional, Convalidación de Estudios y Registro de Actas de Evaluación), la orquestación del despacho de firma digital con el software **Refirma de RENIEC**, y la emisión y validación pública de documentos con valor probatorio pleno.

#### 2.5.2. Especificación Técnica de Componentes
1. **Orquestador de Workflows Académicos en 5 Etapas (`WorkflowAcademicoViewer`):**
   - Modela y ejecuta procedimientos bajo la Máquina de Estados Finitos (FSM) de 10 estados (`BORRADOR`, `REGISTRADO`, `EN_TRAMITE`, `EN_REVISION`, `OBSERVADO`, `SUBSANADO`, `APROBADO`, `PARA_FIRMA`, `RESUELTO`, `ANULADO`).
   - Flujo de Titulación Profesional Técnica (`PROC-ACA-01`):
     - *Etapa 1 — Solicitud y Requisitos:* Validación de egreso, prácticas pre-profesionales (EFSRT) y constancia de no adeudo.
     - *Etapa 2 — Revisión Curricular:* Dictamen de conformidad por la Coordinación de DSI.
     - *Etapa 3 — Sustentación:* Registro de acta de evaluación de proyecto de titulación.
     - *Etapa 4 — Resolución Directoral:* Generación del proyecto de RD institucional.
     - *Etapa 5 — Firma y Registro Oficial:* Firma digital del Director y emisión de diploma con CVD.
2. **Editor y Proyector de Resoluciones Directorales y Actas:**
   - Interfaz enriquecida para redactar actos resolutivos con campos dinámicos normalizados (`VISTO`, `CONSIDERANDO`, `SE RESUELVE`), numeración correlativa anual controlada y previsualización exacta en hoja membretada institucional A4.
3. **Pasarela Frontend de Firma Digital con Refirma RENIEC / PKI:**
   - Invocación local desacoplada mediante protocolo URI `refirma://` hacia el componente oficial instalado en la estación del titular de firma.
   - Formato de firma estándar **PAdES-BES** con sellado de tiempo **TSA (RFC 3161)** emitido por entidad de certificación acreditada por INDECOPI.
   - Firma individual y firma en lote para secretaría académica (paquetes de certificados y actas).
4. **Visor de Representación Impresa con CVD y QR (`CvdDocumentViewer`):**
   - Inserción en el margen izquierdo o pie de página del documento oficial:
     - Código de Verificación Digital estructurado: `CVD-YYYY-TIP-XXXXXX-HASH`.
     - Código QR (200x200px) con hipervínculo directo hacia el portal validador público institucional.
     - Leyenda legal oficial: *"Esta es una copia auténtica imprimible de un documento electrónico archivado en el IESTP 'Suiza', aplicando lo dispuesto por el Art. 25 de D.S. 070-2013-PCM y la Tercera Disposición Complementaria Final del D.S. 026-2016-PCM"*.
5. **Portal Validador Público Universal de CVD (`ValidadorPublicoCvdPage`):**
   - Portal web abierto de acceso irrestricto (sin necesidad de iniciar sesión ni token JWT).
   - Permite a cualquier ciudadano, empleador o entidad pública ingresar el código CVD o subir el archivo PDF para verificar en tiempo real: firmantes, fecha/hora cierta legal, estado de validez y descarga del original electrónico inalterado.

#### 2.5.3. Endpoints REST Canónicos de M4
- `GET /api/v1/tramites/inbox`: Bandeja de trámites académicos según etapa del workflow.
- `POST /api/v1/documentos/generar`: Generación de borrador de acto resolutivo o acta.
- `POST /api/v1/documentos/:id/firmar/preparar`: Generación de token y parámetros para Refirma.
- `POST /api/v1/documentos/:id/firmar/completar`: Recepción del archivo firmado PAdES y estampa CVD.
- `GET /api/v1/validador/cvd/:codigoCvd`: **Endpoint Público (Sin JWT)** para cotejo de autenticidad.

---

### 2.6. Módulo 5: Administración, Seguridad y Auditoría (`administracion-seguridad-auditoria/`)

> [!TIP]
> **Documento Modular Propio y Evaluación Docente:** Consulte el plan detallado y rúbrica específica en [`administracion-seguridad-auditoria/00_plan_de_trabajo_y_evaluacion_docente.md`](administracion-seguridad-auditoria/00_plan_de_trabajo_y_evaluacion_docente.md).

#### 2.6.1. Propósito y Alcance Funcional
Gobernar la seguridad lógica, el control de accesos por roles (RBAC), el mantenimiento de las tablas maestras, la parametrización de la jornada laboral y la bitácora inmutable de auditoría forense del sistema.

#### 2.6.2. Articulación con las 7 Pantallas Implementadas en `frontend/src/pages/administracion/`
El repositorio cuenta con 7 pantallas completamente implementadas en React 19 que representan la consola administrativa central:

1. **`AdministracionPage.tsx` (Panel Central Hub):**
   - Cuadrícula responsiva de 6 tarjetas de acceso rápido hacia las dependencias administrativas, con diseño basado en el sistema de diseño institucional y breadcrumbs de navegación.
2. **`UsuariosPage.tsx` (Directorio de Usuarios y Plazas):**
   - Directorio de servidores, docentes y administrativos. Búsqueda reactiva, modal de edición de datos, asignación de sede, área orgánica y rol, y conmutador de estado (Activo, Inactivo, Bloqueado).
3. **`RolesPermisosPage.tsx` (Matriz de Control de Acceso RBAC):**
   - Implementa la gobernanza de seguridad para los **5 roles canónicos institucionales**:
     - `SUPER_ADMIN`: Administrador de TI y soporte técnico del SIGD.
     - `DIRECTOR`: Director General del instituto con facultad de suscripción y resolución.
     - `DOCENTE`: Docente ordinario o contratado con acceso a bandejas y actas de notas.
     - `MESA_PARTES`: Operador asistencial de recepción y radicación presencial y virtual.
     - `ESTUDIANTE`: Administrado con acceso a casilla, seguimiento y solicitud TUPA.
   - Matriz interactiva de checkboxes por módulo y acción (`ver`, `crear`, `editar`, `derivar`, `archivar`, `eliminar`, `exportar`).
4. **`AuditoriaPage.tsx` (Visor Forense de Logs Inmutables WORM):**
   - Inspección de la tabla `sigd_audit.bitacora_auditoria`.
   - Filtros avanzados por rango de fechas, usuario responsable, módulo, resultado (Exitoso, Denegado, Error) y trazabilidad por `X-Correlation-ID`.
   - Visualización de diferencias JSON (*diff* de datos antes y datos después de la mutación) y exportación directa de logs a archivo CSV mediante `Blob` en memoria.
5. **`TablasMaestrasPage.tsx` (Mantenimiento de Sedes, Áreas y Tipos Documentales):**
   - Mantenimiento con borrado lógico (inactivación/activación).
   - Gestión de áreas con árbol de organigrama jerárquico bajo el modelo **Materialized Path** (`/1/4/12/` o `01.03.02`) indexado en PostgreSQL 18.
6. **`CalendarioLaboralPage.tsx` (Jornada Laboral y Feriados de Ucayali):**
   - **Corrección Normativa de Horario de Corte:** Corrige el valor inicial de `17:00` a las **16:30 hrs** para cumplir con el Artículo 138 de la Ley N° 27444.
   - Parametrización del calendario institucional 2026, incluyendo feriados locales y amazónicos: Fiesta de San Juan (24 de junio) y Aniversario de Pucallpa (13 de octubre).
7. **`SeguridadPage.tsx` (Políticas de Ciberseguridad y Desbloqueo de Cuentas):**
   - Parametrización de políticas de acceso: umbral de intentos fallidos consecutivos (máximo 5), ventana de bloqueo temporal (30 minutos) y expiración de sesión por inactividad.
   - Monitoreo en tiempo real de cuentas suspendidas y consola para desbloqueo administrativo con justificación forense obligatoria.

#### 2.6.3. Endpoints REST Canónicos de M5
- `GET /api/v1/admin/resumen`: Métricas consolidadas del panel de administración.
- `GET /api/v1/usuarios`: Consulta paginada de usuarios institucionales.
- `PUT /api/v1/usuarios/:id`: Actualización de plaza, área y rol.
- `PATCH /api/v1/usuarios/:id/estado`: Cambio de estado (`ACTIVA`, `INACTIVA`, `BLOQUEADA`).
- `GET /api/v1/roles`: Catálogo de roles institucionales y permisos granulares.
- `PUT /api/v1/roles/:id/permisos`: Actualización de matriz RBAC.
- `GET /api/v1/auditoria`: Consulta de logs forenses inmutables.
- `GET /api/v1/auditoria/exportar`: Exportación de bitácora en CSV/XLSX.
- `GET/POST /api/v1/tablas-maestras/sedes`: CRUD de sedes físicas.
- `GET/POST /api/v1/tablas-maestras/areas`: CRUD de áreas con jerarquía Materialized Path.
- `GET/POST /api/v1/tablas-maestras/tipos-documentos`: Catálogo oficial de tipos documentales.
- `GET/PUT /api/v1/calendario/jornada`: Parametrización de jornada y horario de corte 16:30 hrs.
- `GET/POST/DELETE /api/v1/calendario/feriados`: Mantenimiento de feriados y días inhábiles.
- `GET/PUT /api/v1/seguridad/politicas`: Ajuste de parámetros de ciberseguridad.
- `POST /api/v1/seguridad/cuentas/:id/desbloquear`: Desbloqueo supervisado de usuario.

---

### 2.7. Módulo 6: Reportes, Tableros de Control y KPIs Institucionales (`reportes-tableros-control/`)

> [!TIP]
> **Documento Modular Propio y Evaluación Docente:** Consulte el plan detallado y rúbrica específica en [`reportes-tableros-control/00_plan_de_trabajo_y_evaluacion_docente.md`](reportes-tableros-control/00_plan_de_trabajo_y_evaluacion_docente.md).

#### 2.7.1. Propósito y Alcance Funcional
Proporcionar a la Dirección General, Consejo Directivo y Jefaturas de Área paneles visuales de control en tiempo real para evaluar el rendimiento de la gestión pública, identificar cuellos de botella procesales y exportar padrones oficiales auditables.

#### 2.7.2. Especificación Técnica de Componentes
1. **Tablero Directivo Ejecutivo (< 5 segundos de carga inicial):**
   - Componente `DashboardEjecutivoPage` estructurado en 3 breakpoints (Desktop, Tablet y Móvil).
   - Tarjetas de resumen métrico (*KPI Summary Cards*) con micro-gráficos de tendencia (*sparklines*), variación porcentual respecto al mes anterior ($\Delta\%$) y código semafórico de alerta.
2. **Catálogo Oficial de KPIs con Modelado Matemático Formal:**
   - Las métricas se implementan en `src/services/kpiCalculator.service.ts` con control de excepciones y blindaje ante indeterminación matemática (división por cero devolviendo `0.00%` o `--`):

   - **KPI-01: Volumen Total de Expedientes Procesados ($VTEP$):**
     $$\text{VTEP} = \sum_{i=1}^{n} E_{\text{resueltos}, i} + \sum_{j=1}^{m} E_{\text{archivados}, j}$$
     *Meta Institucional:* $\ge 95\%$ de los trámites ingresados en el año fiscal.

   - **KPI-02: Tiempo Promedio de Respuesta ($TPR$ en horas hábiles):**
     $$\text{TPR} = \frac{\sum_{k=1}^{N} (\text{FechaFinAtencion}_k - \text{FechaInicioAtencion}_k)_{\text{horas\_habiles}}}{N}$$
     *Meta Institucional:* $\le 24.0$ horas hábiles para primera derivación; $\le 15.0$ días para resolución final.

   - **KPI-03: Tasa de Resolución Oportuna o Eficiencia ($TRO$):**
     $$\text{TRO} = \begin{cases} \left( \dfrac{N_{\text{atendidos\_en\_plazo}}}{N_{\text{total\_resueltos}}} \right) \times 100 & \text{si } N_{\text{total\_resueltos}} > 0 \\ 100.0\% & \text{si } N_{\text{total\_resueltos}} = 0 \end{cases}$$
     *Meta Institucional:* $\ge 90.0\%$.

   - **KPI-04: Tasa de Expedientes Observados ($TEO$):**
     $$\text{TEO} = \begin{cases} \left( \dfrac{N_{\text{expedientes\_observados}}}{N_{\text{total\_radicados}}} \right) \times 100 & \text{si } N_{\text{total\_radicados}} > 0 \\ 0.0\% & \text{si } N_{\text{total\_radicados}} = 0 \end{cases}$$
     *Meta Institucional:* $\le 5.0\%$.

3. **Mapa de Calor de Cuellos de Botella por Área (`BottleNeckHeatmap`):**
   - Matriz visual que clasifica a las unidades orgánicas según la cantidad de expedientes retenidos más allá del tiempo estándar de pase ($\ge 5$ días hábiles), facilitando la redistribución de carga procesal.
4. **Accesibilidad Digital Universal (WCAG 2.1 AA):**
   - Cumplimiento riguroso de contraste cromático ($\ge 4.5:1$ en texto estándar y $\ge 3:1$ en componentes gráficos e iconografía).
   - Patrones de diseño duales para accesibilidad daltónica (uso simultáneo de color + íconos distintivos: `✓`, `⚠`, `✕`).
   - Soporte total de navegación por teclado mediante tabulación secuencial (`tabindex`, `focus:ring-2`) y atributos semánticos `aria-label`, `aria-live` y roles de accesibilidad en gráficos.
5. **Exportador Multiformato Oficial (PDF / Excel):**
   - Generación de libros de cálculo Excel (`.xlsx`) tipados sin desconfiguración de caracteres UTF-8 (tildes, eñes) con membrete oficial y fórmulas incluidas.
   - Generación de reportes PDF vectorizados en formato A4 con membrete del IESTP "Suiza", firmas de auditoría y resumen estadístico.

#### 2.7.3. Endpoints REST Canónicos de M6
- `GET /api/v1/reportes/dashboard/resumen`: Tarjetas KPI con deltas temporales.
- `GET /api/v1/reportes/dashboard/tendencia`: Serie temporal mensual/semanal de radicación vs atención.
- `GET /api/v1/reportes/dashboard/estados`: Distribución porcentual por estado del expediente.
- `GET /api/v1/reportes/dashboard/cuellos-botella`: Listado clasificado de áreas con expedientes estancados.
- `POST /api/v1/reportes/exportar`: Generación asíncrona de reportes descargables (PDF/Excel).

---

### 2.8. Catálogo Unificado de Endpoints REST `/api/v1/...` y Tratamiento de Errores RFC 7807

#### 2.8.1. Matriz de Integración RESTful
La siguiente tabla consolida los 24 endpoints canónicos que gobiernan los contratos de comunicación entre el frontend y el ecosistema backend del SIGD:

| Módulo | Verbo HTTP | Endpoint URI | DTO Payload Petición | Respuesta Exitosa | Roles Autorizados |
|:---:|:---:|---|---|---|---|
| **M1** | `POST` | `/api/v1/auth/registro-ciudadano` | `RegistroCiudadanoRequestDTO` | `201 Created` (`usuarioId`, `casilla`) | Público anónimo |
| **M1** | `GET` | `/api/v1/maestras/ubigeo/departamentos` | *Ninguno* | `200 OK` (`DepartamentoDTO[]`) | Público anónimo |
| **M1** | `GET` | `/api/v1/maestras/ubigeo/provincias/:depId` | Param `depId` | `200 OK` (`ProvinciaDTO[]`) | Público anónimo |
| **M1** | `GET` | `/api/v1/maestras/ubigeo/distritos/:provId` | Param `provId` | `200 OK` (`DistritoDTO[]`) | Público anónimo |
| **M2** | `GET` | `/api/v1/tipos-documentos/:id/formulario-schema` | Param `id` | `200 OK` (JSON Schema Draft 2020-12) | Público / Autenticado |
| **M2** | `POST` | `/api/v1/storage/presigned-url` | `PresignedUrlRequestDTO` | `200 OK` (`{ uploadUrl, s3Key, expiresIn }`) | Autenticado / Sesión |
| **M2** | `POST` | `/api/v1/expedientes` | `RegistrarExpedienteRequestDTO` | `201 Created` (`cut`, `asiento`, `cargoUrl`) | `MESA_PARTES`, `ESTUDIANTE` |
| **M2** | `PATCH` | `/api/v1/asientos/:id/anular` | `{ motivoAnulacion: string }` | `200 OK` (`{ idAsiento, anulado: true }`) | `MESA_PARTES` (Jefe) |
| **M3** | `GET` | `/api/v1/expedientes` | Query (`page`, `limit`, `estado`) | `200 OK` (`ExpedienteResumenDTO[]`) | `DIRECTOR`, `DOCENTE`, `SUPER_ADMIN` |
| **M3** | `GET` | `/api/v1/expedientes/:id` | Param `id` | `200 OK` (`ExpedienteDetalleDTO`) | Personal autorizado |
| **M3** | `POST` | `/api/v1/expedientes/:id/movimientos/recepcionar` | `{ observacion?: string }` | `200 OK` (`{ estado: 'EN_PROCESO' }`) | Servidor receptor |
| **M3** | `POST` | `/api/v1/expedientes/:id/movimientos/derivar` | `DerivarExpedienteDTO` | `200 OK` (`{ derivacionId, estado }`) | Servidor a cargo |
| **M3** | `POST` | `/api/v1/expedientes/:id/movimientos/observar` | `ObservarExpedienteDTO` | `200 OK` (`{ estado: 'OBSERVADO' }`) | Servidor a cargo |
| **M3** | `POST` | `/api/v1/expedientes/:id/movimientos/archivar` | `{ serieCcdId, observacion }` | `200 OK` (`{ estado: 'ARCHIVADO' }`) | Archivo Central |
| **M4** | `GET` | `/api/v1/tramites/inbox` | Query (`etapaId`, `estado`) | `200 OK` (`TramiteAcademicoDTO[]`) | Personal académico |
| **M4** | `POST` | `/api/v1/documentos/generar` | `GenerarActoDTO` | `201 Created` (`BorradorActoDTO`) | `DIRECTOR`, Asesor Legal |
| **M4** | `POST` | `/api/v1/documentos/:id/firmar/preparar` | `{ firmanteDni: string }` | `200 OK` (`RefirmaParamDTO`) | `DIRECTOR` |
| **M4** | `POST` | `/api/v1/documentos/:id/firmar/completar` | `FirmadoPadesDTO` | `200 OK` (`{ cvd, urlFirmado }`) | `DIRECTOR`, Agente Refirma |
| **M4** | `GET` | `/api/v1/validador/cvd/:codigoCvd` | Param `codigoCvd` | `200 OK` (`ValidacionCvdDTO`) | **Público Abierto (Sin JWT)** |
| **M5** | `GET` | `/api/v1/admin/resumen` | *Ninguno* | `200 OK` (`AdminDashboardSummaryDTO`) | `SUPER_ADMIN`, `DIRECTOR` |
| **M5** | `GET` | `/api/v1/usuarios` | Query (`busqueda`, `rolId`) | `200 OK` (`UsuarioListItemDTO[]`) | `SUPER_ADMIN` |
| **M5** | `GET` | `/api/v1/roles` | *Ninguno* | `200 OK` (`RolDetailDTO[]`) | `SUPER_ADMIN` |
| **M5** | `GET` | `/api/v1/auditoria` | Query (`modulo`, `usuario`) | `200 OK` (`RegistroAuditoriaDTO[]`) | `SUPER_ADMIN`, OCI |
| **M6** | `GET` | `/api/v1/reportes/dashboard/resumen` | Query (`fechaInicio`, `fechaFin`) | `200 OK` (`DashboardKpiResumenDTO`) | `SUPER_ADMIN`, `DIRECTOR` |

#### 2.8.2. Modelo Canónico de Errores RFC 7807 (`ApiProblemDetails`)
Todo fallo devuelto por el backend adopta la siguiente estructura JSON estandarizada:

```typescript
export interface ApiProblemDetails {
  type: string;             // URI del tipo de problema (ej. "https://sigd.iestpsuiza.edu.pe/errors/out-of-schedule")
  title: string;            // Resumen conciso legible en español
  status: number;           // Código de estado HTTP (400, 401, 403, 404, 409, 422, 500)
  detail: string;           // Explicación detallada de la causa de error
  instance: string;         // URI del recurso consultado
  code: string;             // Código alfanumérico institucional (ej. "ERR-LPAG-002")
  category: "Validation" | "Security" | "Business" | "Conflict" | "System";
  correlationId: string;    // UUID v4 sincronizado con la cabecera X-Correlation-ID
  invalidParams?: Array<{   // Detalle de parámetros con error en validaciones (HTTP 422)
    name: string;
    reason: string;
  }>;
  retryable: boolean;       // Indica al cliente frontend si reintentar la operación
}
```

---

## 3. R2: MATRIZ DOCENTE DE ENTREGABLES VERIFICABLES

### 3.1. Resumen Ejecutivo de Capacidad y Esfuerzo (Story Points)
La carga de trabajo total del frontend del SIGD ha sido descompuesta en **32 entregables técnicos atómicos**, distribuidos entre los **21 colaboradores** del equipo, sumando un volumen global de **174 Story Points (SP)** planificados en 6 Sprints de 2 semanas cada uno:

| Módulo | Épica | Nombre Funcional | N° Entregables | Story Points | Colaboradores Clave |
|:---:|:---:|---|:---:|:---:|---|
| **M1** | `EP-01` | Identidad, Registro y Casilla Electrónica | 5 | 26 SP | Matías Zumaeta, Sergio Serruche, Christiam Saúl |
| **M2** | `EP-02` | Ventanilla y Registro Documentario | 6 | 34 SP | Patricia Marina, Carito Curto, Lucy Panduro, Anllely Melgarejo, Noelia, Angy |
| **M3** | `EP-03` | Bandejas y Gestión de Expedientes | 5 | 28 SP | Isack Vargas, Christiam Saúl |
| **M4** | `EP-04` | Flujos Académicos, Firma y Validez Legal | 5 | 29 SP | Geric Salas, Lizbeth Jacobo, Jhasy Paredes |
| **M5** | `EP-05` | Administración, Seguridad y Auditoría | 6 | 28 SP | Jhonatan Gonzales, Carlos Perea, Leonel Rivera, Angel Vásquez |
| **M6** | `EP-06` | Reportes y Tableros de Control | 5 | 29 SP | Clider Urquia, Jennifer Gatica, Christian Jhuel, Lloner Vargas |
| **TOTAL**| | **6 Módulos del Sistema Integral** | **32** | **174 SP** | **21 Colaboradores Asignados** |

---

### 3.2. Matriz Maestra de 32 Entregables Técnicos Atómicos (`ENT-M01-01` a `ENT-M06-05`)

#### MÓDULO 1: Identidad, Registro Ciudadano y Casilla Electrónica (`registro-usuarios-casilla/` — EP-01)
- *Líder de Sub-equipo:* Matías Tiziano Zumaeta Alva | *Integrantes:* Sergio Adrián Serruche Panduro, Christiam Saúl (Soporte Arq.)

| Código | Nombre del Entregable | Responsables Nominales | Artefactos Técnicos Concretos | Criterios de Aceptación Objetivos | Evidencia Demostrable | Peso % | SP |
|---|---|---|---|---|---|:---:|:---:|
| `ENT-M01-01` | Formulario Polimórfico de Registro Ciudadano / Empresa | Matías Zumaeta & Sergio Serruche | `src/pages/registro/RegistroCiudadanoPage.tsx`<br>`src/components/registro/PersonaNaturalForm.tsx`<br>`src/components/registro/PersonaJuridicaForm.tsx`<br>`src/types/registroCiudadano.ts` | Conmutador interactivo Natural/Jurídica; regex estricto de DNI (8 dígitos) y RUC (11 dígitos iniciando en 10/20); validación de edad mínima $\ge 16$ años; feedback de errores inline sin `any`. | Formulario interactivo en navegador; pruebas de regex aprobadas; tipado TypeScript estricto. | 25% | 8 |
| `ENT-M01-02` | Selector en Cascada de Ubigeo Ucayali con Caché Local | Matías Zumaeta | `src/components/common/UbigeoSelector.tsx`<br>`src/hooks/useUbigeoCascade.ts`<br>`src/data/ucayali.ts` | Carga reactiva de 4 provincias de Ucayali y sus 17 distritos oficiales INEI; reseteo automático de distrito al conmutar provincia; caché en memoria; navegación accesible por teclado (WCAG 2.1 AA). | Componente selector operativo en UI; hook con tiempo de resolución instantáneo (<10ms). | 20% | 5 |
| `ENT-M01-03` | Bandeja de Casilla Electrónica Ciudadana y Notificaciones | Sergio Serruche | `src/pages/casilla/CasillaElectronicaPage.tsx`<br>`src/components/casilla/NotificacionList.tsx`<br>`src/components/casilla/NotificacionDetailModal.tsx`<br>`src/hooks/useCasilla.ts` | Listado paginado de comunicaciones oficiales dirigidas al administrado; badges de estado (Leído/No Leído); apertura modal con confirmación de lectura legal con timestamp ISO-8601. | Bandeja funcional con simulación de notificaciones; acuse de lectura generado con fecha cierta. | 25% | 5 |
| `ENT-M01-04` | Consentimiento Informado Ley N° 29733 y Declaración Jurada | Sergio Serruche & Matías Zumaeta | `src/components/registro/ConsentimientoLey29733Modal.tsx`<br>`src/components/registro/DeclaracionJuradaCheckbox.tsx`<br>`src/schemas/consentimiento.schema.ts` | Checkbox obligatorio con enlace modal a directivas de protección de datos personales (Ley N° 29733) y aceptación de casilla electrónica como domicilio legal. Botón de envío deshabilitado hasta marcación explícita. | Bloqueo estricto del botón "Registrar"; payload JSON incluye `{ consentimientoLey29733: true, versionTerminos: "1.0", fechaAceptacion: "..." }`. | 15% | 3 |
| `ENT-M01-05` | Suite de Pruebas Unitarias de Validación y Componentes M1 | Matías Zumaeta & Sergio Serruche | `src/tests/m1/registroCiudadano.test.tsx`<br>`src/tests/m1/ubigeoCascade.test.ts`<br>`src/tests/m1/casillaElectronica.test.tsx` | Cobertura mínima de 80% en validación de esquema; aserciones para: DNI con letras, RUC inválido, bloqueo sin consentimiento, y transiciones en cascada de Ubigeo. | Suite ejecutable sin errores con reporte de cobertura en Vitest. | 15% | 5 |

---

#### MÓDULO 2: Registro Documentario, Ventanilla y Mesa de Partes (`registro-documentario/` — EP-02)
- *Líder de Sub-equipo:* Patricia Marina (Patty) | *Integrantes:* Carito Curto, Lucy Panduro Ramos, Anllely Melgarejo, Noelia Alva, Angy Mendoza

| Código | Nombre del Entregable | Responsables Nominales | Artefactos Técnicos Concretos | Criterios de Aceptación Objetivos | Evidencia Demostrable | Peso % | SP |
|---|---|---|---|---|---|:---:|:---:|
| `ENT-M02-01` | Asistente Wizard de Tramitación de 4 Pasos | Anllely Melgarejo & Patricia Marina | `src/components/tramite/TramiteWizard.tsx`<br>`src/components/tramite/WizardStepBar.tsx`<br>`src/hooks/useTramiteWizard.ts`<br>`src/types/tramiteWizard.ts` | 4 pasos secuenciales: 1) Datos del administrado, 2) Selección de trámite TUPA, 3) Requisitos y adjuntos, 4) Previsualización y confirmación. Botones Siguiente/Anterior con validación por paso y persistencia de borrador. | Wizard completamente interactivo; barra de progreso accesible; validación bloqueante de paso incompleto. | 20% | 5 |
| `ENT-M02-02` | Motor de Formularios Dinámicos JSON Schema Draft 2020-12 | Carito Curto | `src/components/tramite/DynamicSchemaForm.tsx`<br>`src/utils/schemaFormParser.ts`<br>`src/types/jsonSchema.ts` | Intérprete que renderiza controles UI (texto, número, combo, fecha, archivo) a partir de la definición JSON Schema del trámite seleccionado; soporte de reglas condicionales y campos obligatorios. | Formulario muta automáticamente al cambiar de trámite (ej. de Trámite General a Rectificación de Matrícula). | 20% | 8 |
| `ENT-M02-03` | Carga Desacoplada MinIO/S3 con Magic Bytes y SHA-256 | Lucy Panduro Ramos & Carito Curto | `src/components/common/FileUploadDropzone.tsx`<br>`src/hooks/usePresignedUpload.ts`<br>`src/utils/magicBytesValidator.ts`<br>`src/utils/cryptoSha256.ts` | Drag-and-drop de archivos; verificación de cabecera hexadecimal de archivo PDF (`%PDF` / `25 50 44 46`); cómputo de hash SHA-256 en cliente con Web Crypto API; carga directa PUT a Presigned URL de MinIO con barra de progreso porcentual. | Rechazo inmediato de archivo binario renombrado a `.pdf`; log en consola con hash SHA-256 verificado; barra de progreso de carga activa. | 25% | 8 |
| `ENT-M02-04` | Mesa de Partes Virtual con Control de Horario de Corte 16:30 hrs LPAG | Noelia Alva & Patricia Marina | `src/pages/tramite/MesaPartesVirtualPage.tsx`<br>`src/components/tramite/HorarioCorteNotice.tsx`<br>`src/hooks/useHorarioCorte.ts` | Evaluación automática de hora actual (`America/Lima`). Si hora >= 16:30 hrs o día no hábil, despliega banner oficial indicando ingreso extemporáneo computable a las 08:00 hrs del día hábil siguiente (Art. 138 Ley 27444). | Banner visible al activar simulación de hora > 16:30; flag `ingresoExtemporaneo: true` agregado al comprobante. | 15% | 5 |
| `ENT-M02-05` | Ventanilla Presencial y Generación de Cargo CUT con QR | Angy Mendoza & Patricia Marina | `src/pages/tramite/VentanillaPresencialPage.tsx`<br>`src/components/tramite/CargoDigitalModal.tsx`<br>`src/components/common/QrCodeView.tsx`<br>`src/types/cargoOficial.ts` | Formulario simplificado para operador de ventanilla; emisión instantánea de Cargo Oficial con Código Único de Trámite (`EXP-YYYY-XXXXXX`), timestamp, cantidad de folios, QR de trazabilidad y botón de impresión en formato ticket/A4. | Modal de cargo con vista previa fiel imprimible y código QR legible por smartphone. | 10% | 5 |
| `ENT-M02-06` | Suite de Pruebas de Carga de Archivos y Horario LPAG M2 | Lucy Panduro Ramos & Anllely Melgarejo | `src/tests/m2/magicBytesValidator.test.ts`<br>`src/tests/m2/horarioCorte.test.ts`<br>`src/tests/m2/tramiteWizard.test.tsx` | Pruebas automatizadas de corte legal (16:29 vs 16:31 hrs), validación de buffer con magic bytes `%PDF` legítimos vs inválidos, y pruebas de avance de pasos en el Wizard. | Reporte de Vitest con 100% de aserciones aprobadas sin advertencias. | 10% | 3 |

---

#### MÓDULO 3: Bandejas del Servidor y Gestión de Expedientes (`gestion-expedientes/` — EP-03)
- *Líder de Sub-equipo:* Isack Vargas | *Colaboradores:* Christiam Saúl (Soporte de Arquitectura)

| Código | Nombre del Entregable | Responsables Nominales | Artefactos Técnicos Concretos | Criterios de Aceptación Objetivos | Evidencia Demostrable | Peso % | SP |
|---|---|---|---|---|---|:---:|:---:|
| `ENT-M03-01` | Bandeja Operativa del Servidor con 6 Pestañas | Isack Vargas | `src/pages/expedientes/BandejaExpedientesPage.tsx`<br>`src/components/expedientes/BandejaTabFilter.tsx`<br>`src/components/expedientes/ExpedienteTable.tsx`<br>`src/hooks/useBandejaExpedientes.ts`<br>`src/types/expediente.ts` | 6 pestañas estándar: Pendientes, En Proceso, Derivados, Por Archivar, Archivados, Rechazados. Contadores reactivos por pestaña; búsqueda por CUT y asunto; paginación y ordenamiento por fecha. | Tabla reactiva en React 19 con cambio instantáneo entre pestañas y actualización de badges numéricos. | 25% | 8 |
| `ENT-M03-02` | Semáforo SLA Visual de Plazos Máximos LPAG | Isack Vargas | `src/components/expedientes/SlaBadge.tsx`<br>`src/components/expedientes/SlaIndicatorTooltip.tsx`<br>`src/utils/slaCalculator.ts` | Cálculo de días hábiles consumidos vs plazo máximo legal (30 días hábiles LPAG). Semáforo: Verde (0-15 d), Ámbar (16-25 d), Rojo (26-30 d), Alerta crítica parpadeante (>30 d vencido). Contraste mínimo WCAG 2.1 AA (4.5:1). | Insignias visuales coloreadas con tooltip indicando: "Quedan N días hábiles para vencimiento legal". | 20% | 5 |
| `ENT-M03-03` | Timeline Inmutable de Hoja de Ruta y Trazabilidad | Isack Vargas | `src/components/expedientes/ExpedienteTimeline.tsx`<br>`src/components/expedientes/TimelineItemCard.tsx`<br>`src/types/trazabilidadExpediente.ts` | Cronología vertical de cada pase del expediente: fecha/hora exacta, área de origen, área de destino, funcionario responsable, acción efectuada y proveído. Estructura inmutable de solo lectura. | Vista de hoja de ruta renderizada fielmente en la vista detallada del expediente. | 20% | 5 |
| `ENT-M03-04` | Cuadro de Clasificación Documental (CCD) y Foliado Progresivo AGN | Isack Vargas | `src/components/expedientes/CcdTreeSelector.tsx`<br>`src/components/expedientes/FoliadoDocumentoViewer.tsx`<br>`src/types/ccdArchivistica.ts` | Árbol taxonómico de archivo institucional: Fondo (IESTP "Suiza") -> Sección (Dirección, Sec. Académica, Administración) -> Serie Documental; visualización de foliatura correlativa progresiva (F. 1 a N) según directivas AGN. | Selector jerárquico accesible y visualizador de documentos con número de folio estampado. | 15% | 5 |
| `ENT-M03-05` | Modales de Derivación Formal, Pliego de Observaciones y Acumulación | Isack Vargas | `src/components/expedientes/DerivacionModal.tsx`<br>`src/components/expedientes/ObservacionModal.tsx`<br>`src/components/expedientes/AcumulacionModal.tsx`<br>`src/hooks/useExpedienteActions.ts` | Derivación a una o múltiples áreas con proveído obligatorio; emisión de pliego de observaciones con suspensión temporal de SLA; acumulación de expedientes conexos (Art. 160 Ley 27444). | Modales operativos con validación de inputs y feedback toast al completar la acción. | 20% | 5 |

---

#### MÓDULO 4: Flujos Académicos, Firma Digital y Validez Legal (`flujo-validez-legal/` — EP-04)
- *Líder de Sub-equipo:* Geric Aldair Salas Ormeño | *Integrantes:* Lizbeth Jacobo Martel, Jhasy Paredes

| Código | Nombre del Entregable | Responsables Nominales | Artefactos Técnicos Concretos | Criterios de Aceptación Objetivos | Evidencia Demostrable | Peso % | SP |
|---|---|---|---|---|---|:---:|:---:|
| `ENT-M04-01` | Visualizador de Workflows Académicos de 5 Etapas | Geric Salas | `src/pages/flujos/WorkflowAcademicoPage.tsx`<br>`src/components/flujos/AcademicWorkflowStepper.tsx`<br>`src/components/flujos/StageDetailCard.tsx`<br>`src/hooks/useWorkflowAcademico.ts`<br>`src/types/workflowAcademico.ts` | Stepper visual para trámites académicos (Titulación, Convalidación, Rectificación) en 5 etapas: 1) Solicitud, 2) Revisión Curricular, 3) Dictamen, 4) Resolución Directoral, 5) Registro Final. Indicador de estado por etapa. | Stepper interactivo con visualización clara de etapa actual, tiempos y responsable asignado. | 25% | 8 |
| `ENT-M04-02` | Proyector y Gestor de Resoluciones Directorales y Actas | Lizbeth Jacobo | `src/pages/flujos/ProyectorResolucionesPage.tsx`<br>`src/components/flujos/PlantillaResolucionEditor.tsx`<br>`src/types/resolucionAcademica.ts` | Editor estructurado para actos resolutivos institucionales (Visto, Considerando, Se Resuelve); asignación correlativa anual (`RD-YYYY-XXXX`); soporte para libros de actas de titulación y notas. | Previsualización en pantalla del documento oficial con márgenes y membrete del IESTP "Suiza". | 20% | 5 |
| `ENT-M04-03` | Pasarela Frontend de Despacho de Firma Digital (Refirma / PKI) | Geric Salas & Jhasy Paredes | `src/components/firma/RefirmaConnectorModal.tsx`<br>`src/components/firma/FirmaBatchDrawer.tsx`<br>`src/hooks/useRefirmaGateway.ts`<br>`src/types/firmaDigital.ts` | Integración con pasarela de firma (esquema `refirma://` o WebSocket local); validación de certificado digital X.509; soporte de firma individual y firma en lote de actas; sellado de tiempo criptográfico (TSA). | Modal con indicador de estado de conexión con Refirma y barra de progreso de firma en lote. | 25% | 8 |
| `ENT-M04-04` | Visor de Representación Impresa con Código CVD y QR | Jhasy Paredes | `src/components/firma/DocumentoCvdViewer.tsx`<br>`src/components/firma/CvdStampBadge.tsx`<br>`src/types/cvdVerificacion.ts` | Visor PDF integrado con estampa oficial en margen izquierdo: Código de Verificación Digital (CVD de 16 caracteres alfanuméricos), URL de consulta pública, código QR y datos del titular firmante. | Visualización de documento firmado con estampa digital conforme a la Ley N° 27269. | 15% | 5 |
| `ENT-M04-05` | Portal Validador Público de Validez Legal y No Repudio | Geric Salas & Jhasy Paredes | `src/pages/validador/ValidadorPublicoCvdPage.tsx`<br>`src/components/validador/CvdVerificationResult.tsx`<br>`src/hooks/useCvdPublicVerification.ts` | Página pública externa (sin autenticación) para que cualquier persona ingrese un código CVD o escanee QR y certifique autoría, fecha/hora, integridad del archivo y validez jurídica. | Consulta pública funcional mostrando estado: "Documento Auténtico y Válido" con descarga del PDF original. | 15% | 3 |

---

#### MÓDULO 5: Administración, Seguridad y Auditoría (`administracion-seguridad-auditoria/` — EP-05)
- *Líder de Sub-equipo:* Jhonatan Nijar Gonzales de Souza | *Integrantes:* Carlos Perea, Leonel Rivera, Angel Jesús Vásquez Godoy

| Código | Nombre del Entregable | Responsables Nominales | Artefactos Técnicos Concretos | Criterios de Aceptación Objetivos | Evidencia Demostrable | Peso % | SP |
|---|---|---|---|---|---|:---:|:---:|
| `ENT-M05-01` | Panel Central de Administración y Navegación Institucional | Jhonatan Gonzales | `src/pages/administracion/AdministracionPage.tsx` (existente)<br>`src/components/administracion/AdminBreadcrumbs.tsx`<br>`src/components/administracion/AdminPageHeader.tsx` (existente)<br>`src/routes/AdminRoutes.tsx` | Panel con 6 tarjetas de acceso rápido; breadcrumbs de navegación dinámica; header reutilizable con botón de retorno; diseño responsive adaptado a tokens institucionales. | Código implementado en repositorio (92 líneas); rutas operativas en `AppRouter.tsx`. | 15% | 3 |
| `ENT-M05-02` | Gestión del Directorio de Usuarios y Asignación de Plazas | Angel Jesús Vásquez & Jhonatan Gonzales | `src/pages/administracion/UsuariosPage.tsx` (existente)<br>`src/components/administracion/UserEditModal.tsx`<br>`src/hooks/useUsuariosAdmin.ts`<br>`src/types/usuarioAdmin.ts` | Tabla de usuarios con búsqueda en tiempo real y filtro por estado (Activo, Inactivo, Bloqueado); modal de administración para actualizar área, rol y estado; desacoplamiento de estado en custom hook. | Pantalla de usuarios implementada (363 líneas) con modal de edición operativo. | 20% | 5 |
| `ENT-M05-03` | Matriz de Control de Acceso Granular RBAC para 5 Roles Canónicos | Carlos Perea | `src/pages/administracion/RolesPermisosPage.tsx` (existente)<br>`src/components/administracion/RolePermissionMatrix.tsx`<br>`src/types/rbacRoles.ts`<br>`src/hooks/useRbacConfig.ts` | Alineación obligatoria a los 5 roles canónicos (`SUPER_ADMIN`, `DIRECTOR`, `DOCENTE`, `MESA_PARTES`, `ESTUDIANTE`); matriz de permisos por módulo y acciones (`ver`, `crear`, `editar`, `derivar`, `archivar`, `eliminar`, `exportar`). | Pantalla interactiva en repositorio (244 líneas); matriz de checkboxes mutable en memoria. | 20% | 5 |
| `ENT-M05-04` | Visor Forense de Logs Inmutables y Exportación CSV | Leonel Rivera | `src/pages/administracion/AuditoriaPage.tsx` (existente)<br>`src/components/administracion/AuditDetailDrawer.tsx`<br>`src/hooks/useAuditLogs.ts`<br>`src/types/auditoriaForense.ts` | Interfaz estrictamente de solo lectura; filtros por módulo, resultado (Exitoso, Denegado, Error) y búsqueda de texto; trazabilidad de IP y `X-Correlation-ID`; exportador a archivo CSV (`auditoria-sigd.csv`) vía Blob en memoria. | Pantalla de auditoría implementada (284 líneas) con descarga inmediata de archivo CSV funcional. | 15% | 5 |
| `ENT-M05-05` | Mantenimiento de Tablas Maestras y Organigrama Materialized Path | Jhonatan Gonzales | `src/pages/administracion/TablasMaestrasPage.tsx` (existente)<br>`src/components/administracion/OrganigramaTreeView.tsx`<br>`src/hooks/useTablasMaestras.ts`<br>`src/types/tablasMaestras.ts` | Pestañas dinámicas para Sedes, Áreas y Tipos Documentales; alta de nuevos registros; borrado lógico (inactivación/activación) para salvaguardar trazabilidad; soporte visual de jerarquía de organigrama (`01.03.02`). | Pantalla de tablas maestras implementada (246 líneas) con alternador de estado operativo. | 15% | 5 |
| `ENT-M05-06` | Calendario Laboral LPAG (Ajuste 16:30 hrs) y Políticas de Seguridad | Jhonatan Gonzales & Carlos Perea | `src/pages/administracion/CalendarioLaboralPage.tsx` (existente)<br>`src/pages/administracion/SeguridadPage.tsx` (existente)<br>`src/hooks/useCalendarioLaboral.ts`<br>`src/hooks/useSeguridadPolicies.ts` | Corrección obligatoria del horario de fin de 17:00 a **16:30 hrs** (Ley 27444); configuración de días no laborables y feriados; configuración de bloqueo por intentos fallidos (máx. 5), tiempo de sesión y desbloqueo manual de cuentas. | Ambas pantallas implementadas en repositorio (219 y 228 líneas); formularios reactivos listos para integración de red. | 15% | 5 |

---

#### MÓDULO 6: Reportes y Tableros de Control (`reportes-tableros-control/` — EP-06)
- *Líder de Sub-equipo:* Clider Lex Urquia | *Integrantes:* Jennifer Gatica Saavedra, Christian Jhoel Rodríguez Cari (Jhuel), Lloner Vargas Huayunga

| Código | Nombre del Entregable | Responsables Nominales | Artefactos Técnicos Concretos | Criterios de Aceptación Objetivos | Evidencia Demostrable | Peso % | SP |
|---|---|---|---|---|---|:---:|:---:|
| `ENT-M06-01` | Tablero de Control Directivo Ejecutivo Multi-Breakpoint (<5s) | Christian Jhoel (Jhuel) & Clider Urquia | `src/pages/reportes/DashboardEjecutivoPage.tsx`<br>`src/components/reportes/ExecutiveKpiCard.tsx`<br>`src/components/reportes/KpiMetricGrid.tsx`<br>`src/hooks/useDashboardMetrics.ts`<br>`src/types/dashboardEjecutivo.ts` | Diseño enfocado en directivos con tiempo de comprensión visual menor a 5 segundos ("vista de pájaro"); 3 breakpoints adaptativos (Móvil, Tablet, Desktop); visualización de volumen total, % atención a tiempo y alertas críticas. | Dashboard con layout responsivo, contraste WCAG 2.1 AA y renderizado inicial < 500ms. | 25% | 8 |
| `ENT-M06-02` | Motor de Cálculo de KPIs Institucionales MGD con Modelado Matemático | Jennifer Gatica | `src/services/kpiCalculator.service.ts`<br>`src/components/reportes/KpiFormulaExplanationCard.tsx`<br>`src/types/kpiCalculations.ts` | Implementación exacta de las 4 fórmulas matemáticas del MGD (PCM): VTEP (Volumen Total Procesados), TPR (Tiempo Promedio de Respuesta en horas hábiles), TRO (Tasa de Resolución Oportuna $\ge 90\%$) y TEO (Tasa de Expedientes Observados). Manejo de división por cero devolviendo `0.00%`. | Servicio tipado en TypeScript con cobertura de pruebas unitarias verificando la precisión de cálculo a 2 decimales. | 25% | 8 |
| `ENT-M06-03` | Mapa de Calor y Análisis Visual de Cuellos de Botella por Área | Christian Jhoel (Jhuel) & Lloner Vargas | `src/components/reportes/BottleNeckHeatmap.tsx`<br>`src/components/reportes/AreaRetentionChart.tsx`<br>`src/hooks/useAreaBottlenecks.ts` | Representación gráfica de retención de expedientes por área institucional; resaltado automático en color ámbar/rojo de áreas que superan el límite SLA de 10 días por pase; accesible por teclado con etiquetas `aria-label`. | Mapa de calor interactivo con tooltip detallando: "Área: X, Promedio retención: Y días, Expedientes en riesgo: Z". | 20% | 5 |
| `ENT-M06-04` | Exportador Estructurado de Reportes Oficiales en PDF y Excel | Clider Urquia & Lloner Vargas | `src/components/reportes/ReportExportModal.tsx`<br>`src/utils/excelReportExporter.ts`<br>`src/utils/pdfReportExporter.ts`<br>`src/types/reportExportConfig.ts` | Descarga directa de datos filtrados a Excel (.xlsx/CSV) con cabecera institucional; exportación a PDF formal con membrete del IESTP "Suiza", filtros aplicados, fecha de generación y resumen numérico. | Descarga de archivos probada en navegador sin corrupción de caracteres especiales (acentos y eñes preservados en UTF-8). | 15% | 5 |
| `ENT-M06-05` | Suite de Pruebas de Precisión Numérica y Accesibilidad Dashboard | Jennifer Gatica & Equipo M6 | `src/tests/m6/kpiCalculator.test.ts`<br>`src/tests/m6/dashboardA11y.test.tsx` | Pruebas unitarias de las 4 fórmulas matemáticas con casos de borde (0 trámites, denominadores nulos); auditoría de accesibilidad axe-core con cero violaciones de contraste y navegación completa por Tab. | Reporte de pruebas aprobado al 100% en Vitest/Jest. | 15% | 3 |

---

### 3.3. Directorio Nominal de los 21 Colaboradores y Matriz RACI Integral

#### 3.3.1. Directorio Oficial del Equipo de Ingeniería Frontend
Conforme a la auditoría forense de Git (`colaboradores.md`, PRs #62 al #75, commit `4ec0c3a`):

| # | Colaborador (Nombres y Apellidos) | Correo Institucional / Personal | Git Author / Handle | Asignación Modular | Rol Operativo Principal |
|:---:|---|---|---|:---:|---|
| 1 | **Christiam Saúl** | `christiamsaul@iestpsuiza.edu.pe` / `cristiamsaul2@gmail.com` | `christiam-saul` / `cristiamsaul2` | **Transversal** | Scrum Master & Arquitecto Principal |
| 2 | **Matías Tiziano Zumaeta Alva** | `matias.zumaeta@iestpsuiza.edu.pe` / `zumaetaalvamatiastiziano@gmail.com` | `matias-zumaeta` / `Matias-Spike` | **M1** | Líder Sub-equipo 1 (Registro Dual) |
| 3 | **Sergio Adrián Serruche Panduro** | `sergio.serruche@iestpsuiza.edu.pe` / `sserruchepanduro@gmail.com` | `sergio-serruche` / `Sergio-Serruche` | **M1** | Desarrollador Frontend (Casilla/Ubigeo) |
| 4 | **Angel Jesús Vásquez Godoy** | `angel.vasquez@iestpsuiza.edu.pe` / `vasquezgodoyangeljesus@gmail.com` | `angel-vasquez` / `angel` | **M5 / M1** | Especialista Directorio y Seguridad |
| 5 | **Patricia Marina (Patty)** | `patricia.marina@iestpsuiza.edu.pe` / `patriciamarina287@gmail.com` | `patricia-marina` / `patriciamarina287` | **M2** | Líder Sub-equipo 2 (Ventanilla Única) |
| 6 | **Carito Curto** | `cakcy.3@gmail.com` | `cakcy3-web` (PR #66) | **M2** | Especialista Arquitectura (JSON Schema / S3) |
| 7 | **Lucy Panduro Ramos** | `panduroramoslucy@gmail.com` | `panduroramoslucy-ops` (commit `81f9987`) | **M2** | Desarrolladora UI Kit (Magic Bytes / Crypto) |
| 8 | **Anllely Melgarejo V.** | `anllelymelgarejov@gmail.com` | `Anllely-melgarejo` (PR #62) | **M2** | Desarrolladora Frontend (Wizard MPV) |
| 9 | **Noelia Alva** | `noelia.alva@iestpsuiza.edu.pe` | `noelia-alva` | **M2** | Desarrolladora Frontend (Requisitos TUPA) |
| 10 | **Angy Mendoza** | `angy.mendoza@iestpsuiza.edu.pe` | `angy-mendoza` | **M2** | Desarrolladora Frontend (Padrón y Cargo) |
| 11 | **Isack (Isak) Vargas** | `isack.vargas@iestpsuiza.edu.pe` / `isakvargasss@gmail.com` | `isack-vargas` / `isakvargas` | **M3** | Líder Sub-equipo 3 (Bandejas y SLA) |
| 12 | **Geric Aldair Salas Ormeño** | `geric.castillo@iestpsuiza.edu.pe` / `salasormenogericaldair01@gmail.com` | `geric-castillo` | **M4** | Líder Sub-equipo 4 (Workflows / Refirma) |
| 13 | **Lizbeth Jacobo Martel** | `jacobo.rios@iestpsuiza.edu.pe` / `jacobomartellizbeth@gmail.com` | `jacobo-rios` / `REDBLACK-OL` | **M4** | Desarrolladora Frontend (Proyector RD) |
| 14 | **Jhasy Paredes** | `jhasy.paredes@iestpsuiza.edu.pe` / `svrjhass@gmail.com` | `jhasy-paredes` / `svrjhass-design` | **M4** | Diseñadora UI/UX (Visor CVD / Validador) |
| 15 | **Jhonatan Nijar Gonzales de Souza** | `jhonatannijargonzalesdesouza@gmail.com` | `JHONATAN` / `jhonatan` (PR #75) | **M5** | Líder Sub-equipo 5 (Hub Admin / Maestras) |
| 16 | **Carlos Perea ("Gato")** | `caps6954@gmail.com` | `soychivo` / `caps6954` (PR #68) | **M5** | Especialista Seguridad Frontend (RBAC) |
| 17 | **Leonel Rivera ("Maxin")** | `leonelrivera6759684@gmail.com` | `maxirivera` (PR #65, #69) | **M5** | Desarrollador Auditoría (Logs WORM / CSV) |
| 18 | **Clider Lex Urquia** | `cliderlex@gmail.com` | `cliderlex-sketch` (PR #70) | **M6** | Líder Sub-equipo 6 (Dashboard Ejecutivo) |
| 19 | **Jennifer Gatica Saavedra** | `gaticasaavedrajennifer844@gmail.com` | `gaticasaavedrajennifer844-jpg` (PR #70) | **M6** | Especialista Métricas & Datos (KPIs MGD) |
| 20 | **Christian Jhoel Rodríguez Cari (Jhuel)** | `christianjhoelrodriguezcari@gmail.com` | `christianjhoelrodriguezcari-hue` | **M6** | Diseñador UX / Accesibilidad (WCAG AA) |
| 21 | **Lloner Vargas Huayunga** | `lloner.araujo@iestpsuiza.edu.pe` / `vargas.huayunga92@gmail.com` | `lloner-araujo` / `vargashuayunga92-11` | **M6** | Desarrollador Frontend (Exportador PDF/Excel) |

#### 3.3.2. Matriz RACI Institucional
*Convención:* **R** = Responsible (Ejecuta el entregable), **A** = Accountable (Aprueba técnicamente ante el docente), **C** = Consulted (Provee soporte o validación cruzada), **I** = Informed (Notificado del avance).

| # | Colaborador | Sub-equipo | M1: Identidad | M2: Registro | M3: Bandejas | M4: Validez | M5: Admin | M6: Reportes | Transversal / CI/CD |
|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | **Christiam Saúl** | Transversal | C | C | C | C | C | C | **R / A** |
| 2 | **Matías Zumaeta** | M1 | **R / A** | C | I | I | I | I | I |
| 3 | **Sergio Serruche** | M1 | **R** | I | I | I | I | I | I |
| 4 | **Angel Vásquez** | M5 / M1 | C | I | I | I | **R** | I | I |
| 5 | **Patricia Marina** | M2 | I | **R / A** | C | I | I | I | I |
| 6 | **Carito Curto** | M2 | I | **R** | I | I | I | I | C |
| 7 | **Lucy Panduro** | M2 | I | **R** | I | I | I | I | I |
| 8 | **Anllely Melgarejo** | M2 | I | **R** | I | I | I | I | I |
| 9 | **Noelia Alva** | M2 | I | **R** | I | I | I | I | I |
| 10 | **Angy Mendoza** | M2 | I | **R** | I | I | I | I | I |
| 11 | **Isack Vargas** | M3 | I | C | **R / A** | C | I | I | I |
| 12 | **Geric Salas** | M4 | I | I | C | **R / A** | I | I | I |
| 13 | **Lizbeth Jacobo** | M4 | I | I | I | **R** | I | I | I |
| 14 | **Jhasy Paredes** | M4 | I | I | I | **R** | I | C | I |
| 15 | **Jhonatan Gonzales**| M5 | I | I | I | I | **R / A** | I | I |
| 16 | **Carlos Perea** | M5 | I | I | I | I | **R** | I | I |
| 17 | **Leonel Rivera** | M5 | I | I | I | I | **R** | I | I |
| 18 | **Clider Urquia** | M6 | I | I | I | I | I | **R / A** | I |
| 19 | **Jennifer Gatica** | M6 | I | I | I | I | I | **R** | I |
| 20 | **Christian Jhuel** | M6 | I | I | I | I | I | **R** | I |
| 21 | **Lloner Vargas** | M6 | I | I | I | I | I | **R** | I |

---

## 4. R3: RÚBRICA ANALÍTICA DE CALIFICACIÓN EN SISTEMA VIGESIMAL PERUANO (0 A 20)

### 4.1. Escala Vigesimal Oficial y Niveles de Logro de Competencia
En concordancia con el Reglamento General de Institutos de Educación Superior Tecnológica del Ministerio de Educación (MINEDU) y el estatuto académico del IESTP "Suiza", la evaluación del proyecto formativo SIGD se rige bajo la **Escala Vigesimal (00 a 20 puntos)**, fijando la **nota mínima aprobatoria en 13.0 (trece)**.

Los 4 niveles de logro analíticos se definen a continuación:

```
[00.0 ---------------- 10.9] [11.0 ---------------- 13.9] [14.0 ---------------- 17.9] [18.0 ---------------- 20.0]
        DEFICIENTE                    REGULAR                       BUENO                       EXCELENTE
   (No Logrado / Reprobado)      (Nivel Crítico / Riesgo)         (Competente)           (Dominio Sobresaliente)
   Requiere Recuperación         Acompañamiento Obligatorio       Aprobado Ordinario       Acreditación y Mérito
```

1. **Excelente (18.0 - 20.0 puntos):**
   - Demuestra un dominio profesional y autónomo de la ingeniería frontend.
   - Compilación 100% limpia sin advertencias de TypeScript (`tsc --noEmit`). Cero uso de `any`.
   - Adherencia total a los contratos RESTful `/api/v1/...` y manejo exhaustivo y tipado de errores RFC 7807 (`ApiProblemDetails`).
   - Cumplimiento riguroso del marco legal peruano: regla de corte LPAG a las 16:30 hrs, consentimiento expreso Ley N° 29733, inspección de Magic Bytes (`%PDF`), hash SHA-256 local y foliado correlativo continuo AGN.
   - Accesibilidad digital universal WCAG 2.1 AA certificada y cobertura de pruebas automatizadas $\ge 80\%$.
2. **Bueno (14.0 - 17.9 puntos):**
   - Dominio competente y operativo de las tecnologías requeridas.
   - La funcionalidad principal (*happy path*) opera sin fallas en staging o entorno local.
   - Tipado estricto respetado en la casi totalidad de interfaces, con manejo de errores RFC 7807 presente pero con oportunidades menores de mejora en presentación de mensajes.
   - Cumple con las reglas normativas esenciales (corte 16:30 hrs y consentimiento Ley 29733 operativos).
   - Pruebas unitarias básicas implementadas con cobertura entre 50% y 79%.
3. **Regular (11.0 - 13.9 puntos — Nivel Crítico):**
   - Dominio en proceso de consolidación. El código compila pero presenta advertencias o casos de borde no resueltos (ej. fallo al ingresar caracteres especiales, inconsistencias de Ubigeo o visualización deficiente en dispositivos móviles).
   - Uso esporádico de comodines `any` o conversiones forzadas (`as unknown as T`).
   - Manejo genérico de errores (alertas nativas del navegador `window.alert()` o mensajes no localizados en lugar de modales RFC 7807).
   - Contratos parcialmente simulados en memoria sin conexión a backend. Requiere plan de mejora y tutoría docente para consolidar aprobación.
4. **Deficiente (00.0 - 10.9 puntos — No Logrado / Desaprobado):**
   - Incumplimiento crítico de los estándares de la unidad didáctica.
   - El código fuente no compila debido a errores de sintaxis o dependencias rotas.
   - Desconexión o alteración arbitraria de las rutas canónicas `/api/v1/...`.
   - Omisión deliberada de requisitos legales y de seguridad esenciales (ausencia de Magic Bytes, ausencia de consentimiento Ley 29733 o manipulación de foliación).
   - Plagio evidente o ausencia de commits con autoría trazable en el repositorio Git. El estudiante reprueba el hito y debe ingresar a proceso de recuperación académica.

---

### 4.2. Dimensiones de Evaluación Ponderadas (100% / 20 Puntos)

La calificación vigesimal de cada módulo y estudiante se calcula a partir de cuatro dimensiones pedagógicas y técnicas:

| Dimensión | Ponderación (%) | Puntaje Máximo | Áreas Clave Evaluadas |
|---|:---:|:---:|---|
| **D1: Arquitectura e Implementación Frontend** | **30%** | **6.0 pts** | Modularidad FSD, componentes React 19, hooks personalizados, gestión de server state con TanStack Query v5, enrutamiento seguro. |
| **D2: Cumplimiento de Contratos Backend y RFC 7807 / Seguridad** | **30%** | **6.0 pts** | Fidelidad a endpoints canónicos `/api/v1/...`, consumo de DTOs, propagación de `X-Correlation-ID`, manejo de errores RFC 7807, carga MinIO/S3. |
| **D3: UI/UX, Validaciones y Normativa Peruana** | **20%** | **4.0 pts** | Horario de corte LPAG 16:30 hrs, consentimiento Ley 29733, Magic Bytes `%PDF`, SHA-256 Web Crypto, foliado AGN, contraste WCAG AA. |
| **D4: Calidad de Código, TypeScript 5.9 y Pruebas** | **20%** | **4.0 pts** | Tipado estricto (cero `any`), validadores Zod, pruebas unitarias y de integración (Vitest), commits atómicos en Git. |
| **TOTAL PONDERADO** | **100%** | **20.0 pts** | **Nota Vigesimal Final antes de Penalizaciones Técnicas** |

---

### 4.3. Matriz Analítica Bidimensional (Dimensiones $\times$ Niveles de Logro)

A continuación se detalla la matriz analítica exhaustiva que guía al docente en la asignación de puntajes por dimensión:

| Dimensión | Excelente (18.0 - 20.0) | Bueno (14.0 - 17.9) | Regular (11.0 - 13.9) | Deficiente (00.0 - 10.9) |
|---|---|---|---|---|
| **D1: Arquitectura e Implementación Frontend (30% / 6.0 pts)** | **5.4 – 6.0 pts:** Arquitectura Feature-Sliced modular impecable; uso ejemplar de hooks de React 19 (`useActionState`, custom hooks); gestión óptima de estado de servidor con TanStack Query (caching, invalidación, reintentos); componentes de UI Kit completamente reutilizables y desacoplados. | **4.2 – 5.3 pts:** Estructura modular adecuada; componentes bien delimitados; TanStack Query integrado con opciones básicas; hooks reutilizables funcionales; navegación sin recargas completas. | **3.3 – 4.1 pts:** Estructura monolítica o componentes sobrecargados (>400 líneas); uso excesivo de `useState` para estado servidor; demoras en renderizado; componentes poco reutilizables. | **0.0 – 3.2 pts:** El código no compila o presenta fallas estructurales graves; antipatrones evidentes; bucles infinitos de re-renderizado; arquitectura caótica. |
| **D2: Contratos Backend y RFC 7807 / Seguridad (30% / 6.0 pts)** | **5.4 – 6.0 pts:** Sincronización absoluta con endpoints `/api/v1/...`; cliente Axios con interceptor que inyecta `X-Correlation-ID` y token JWT; tratamiento tipado y amigable de la estructura RFC 7807 (`ApiProblemDetails`); flujo MinIO/S3 desacoplado con Presigned URLs operativo. | **4.2 – 5.3 pts:** Endpoints canónicos respetados; interceptor Axios presente; manejo de códigos de error estándar (400, 401, 403, 404); carga S3 operativa pero con feedback básico de progreso. | **3.3 – 4.1 pts:** Algunos endpoints desincronizados o mockeados sin justificación; errores manejados genéricamente sin interpretar RFC 7807; no propaga `X-Correlation-ID`; subida de archivos pesada. | **0.0 – 3.2 pts:** Endpoints arbitrarios que rompen la integración con el backend; omisión total del estándar RFC 7807; exposición de vulnerabilidades de inyección o tokens inseguros. |
| **D3: UI/UX, Validaciones y Normativa Peruana (20% / 4.0 pts)** | **3.6 – 4.0 pts:** Regla de corte LPAG 16:30 hrs estrictamente evaluada con proyección a día hábil; consentimiento Ley 29733 bloqueante; validación de Magic Bytes (`25 50 44 46`) y SHA-256 local; foliado AGN continuo; contraste WCAG 2.1 AA ($\ge 4.5:1$); diseño responsivo perfecto. | **2.8 – 3.5 pts:** Regla de corte 16:30 hrs y consentimiento Ley 29733 operativos; validación básica de tipos de archivo; foliación respetada; contraste visual adecuado; diseño responsive funcional en resoluciones estándar. | **2.2 – 2.7 pts:** Horario de corte erróneo (ej. 17:00 hrs) o no proyecta al día hábil siguiente; validación de archivos basada únicamente en extensión `.pdf` (sin Magic Bytes); contraste deficiente en algunos textos. | **0.0 – 2.1 pts:** Omisión deliberada de la normativa (sin corte 16:30, sin consentimiento Ley 29733); acepta archivos binarios maliciosos; interfaz no accesible ni responsive. |
| **D4: Calidad de Código, TypeScript 5.9 y Pruebas (20% / 4.0 pts)** | **3.6 – 4.0 pts:** Tipado 100% estricto sin comodines `any`; interfaces y tipos bien modelados; esquemas Zod robustos; suite de pruebas automatizadas con cobertura $\ge 80\%$ en Vitest; historial Git limpio con commits semánticos y autoría trazable. | **2.8 – 3.5 pts:** Tipado TypeScript consistente con uso excepcional y justificado de casting; validadores funcionales; pruebas unitarias cubriendo los flujos principales (50% a 79%); commits trazables en la rama de trabajo. | **2.2 – 2.7 pts:** Presencia recurrente de comodines `any`; directivas `@ts-ignore` sin justificar; validaciones incompletas en formularios; pruebas escasas (<50% cobertura); commits masivos desordenados. | **0.0 – 2.1 pts:** Código plagado de `any`; TypeScript configurado en modo permisivo; ausencia total de pruebas unitarias; ausencia de historial de trabajo en el repositorio Git oficial. |

---

### 4.4. Fórmula Matemática de Calificación Vigesimal

La nota vigesimal final ($N_{\text{final}}$) de cada entregable o módulo se calcula aplicando el promedio ponderado de las 4 dimensiones, descontando de forma directa la sumatoria de penalizaciones técnicas automáticas incurridas:

$$N_{\text{vigesimal}} = \max\left(0.00, \left( D_1 \times 0.30 + D_2 \times 0.30 + D_3 \times 0.20 + D_4 \times 0.20 \right) - \sum_{k=1}^{7} \text{PEN}_k \right)$$

Donde:
- $D_1$: Puntaje obtenido en Dimensión 1 (sobre 20 puntos base).
- $D_2$: Puntaje obtenido en Dimensión 2 (sobre 20 puntos base).
- $D_3$: Puntaje obtenido en Dimensión 3 (sobre 20 puntos base).
- $D_4$: Puntaje obtenido en Dimensión 4 (sobre 20 puntos base).
- $\text{PEN}_k$: Demérito directo asociado a la penalización técnica $k$ cometida.
- La función $\max(0.00, \dots)$ garantiza que la calificación no adquiera valores negativos en ningún escenario.

---

### 4.5. Tabla de Penalizaciones Técnicas Automáticas (`PEN-01` a `PEN-07`)
Las penalizaciones técnicas constituyen deducciones directas e inapelables aplicadas sobre la nota final del estudiante o sub-equipo ante el quebrantamiento de estándares arquitecturales o preceptos de ley:

| Código | Falta Técnica / Incumplimiento Normativo | Fundamentación Técnica y Jurídica | Demérito Directo |
|:---:|---|---|:---:|
| **PEN-01** | **Desconexión o alteración arbitraria de endpoints canónicos `/api/v1/...`** | Fractura el contrato de red estipulado en la arquitectura de microservicios, imposibilitando la integración continua con el backend. | **-3.0 puntos** |
| **PEN-02** | **Incumplimiento de la regla de corte LPAG 16:30 hrs** | Vulneración del Artículo 138 del TUO de la Ley N° 27444 (D.S. N° 004-2019-JUS). La falta de cómputo formal acarrea nulidad procesal administrativa. | **-2.0 puntos** |
| **PEN-03** | **Omisión de validación de Magic Bytes (`%PDF`) o hash SHA-256 en cliente** | Riesgo crítico de seguridad de ingesta binaria maliciosa en MinIO/S3 y pérdida de integridad en la custodia digital de expedientes. | **-2.0 puntos** |
| **PEN-04** | **Inobservancia del consentimiento informado para Casilla Electrónica (Ley 29733)** | Infracción a la Ley de Protección de Datos Personales pasible de sanción administrativa por la Autoridad Nacional (MINJUS). | **-2.0 puntos** |
| **PEN-05** | **Regresiones de compilación (`tsc --noEmit`) o errores fatales en consola** | Entrega de código no operativo que detiene el flujo de construcción en la tubería CI/CD o bloquea la navegación en producción. | **-4.0 puntos** |
| **PEN-06** | **Uso injustificado del tipo comodín `any` en contratos de red o modelos** | Ruptura de la seguridad de tipos estricta en TypeScript 5.9, degradando la robustez y mantenibilidad del software institucional. | **-1.0 pt / caso** *(Máx -3.0 pts)* |
| **PEN-07** | **Deficiencias de contraste cromático WCAG 2.1 AA (< 4.5:1) en interfaces** | Incumplimiento de las directivas de inclusión y accesibilidad digital del Estado Peruano para personas con baja visión o daltonismo. | **-1.5 puntos** |

---

### 4.6. Ficha Docente de Evaluación Individual y Registro de Calificaciones
El docente evaluador dispondrá del siguiente instrumento normalizado por cada estudiante para asentar la calificación objetiva del módulo:

```markdown
====================================================================================================
               INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO "SUIZA"
           PROGRAMA DE ESTUDIOS: DESARROLLO DE SISTEMAS DE INFORMACIÓN (DSI 2026-2)
                   FICHA DOCENTE DE EVALUACIÓN INDIVIDUAL FRONTEND SIGD
====================================================================================================

1. DATOS DEL ESTUDIANTE Y DEL ENTREGABLE
   - Nombres y Apellidos: _________________________________________________________________________
   - Correo Institucional: _________________________________ Git Handle: __________________________
   - Módulo Evaluado: [ ] M1   [ ] M2   [ ] M3   [ ] M4   [ ] M5   [ ] M6   [ ] Transversal
   - Código(s) de Entregable: _________________________________ Story Points Asignados: ___________
   - Fecha de Sustentación: _____ / _____ / 2026   - Sprint Evaluado: [ ] S1  [ ] S2  [ ] S3  [ ] S4  [ ] S5  [ ] S6

2. VALORACIÓN POR DIMENSIONES (Escala Vigesimal 00 a 20)
   +-------------------------------------------------------------+----------+--------+-------------+
   | Dimensión Evaluada                                          | Peso (%) | Nota   | Ponderado   |
   +-------------------------------------------------------------+----------+--------+-------------+
   | D1: Arquitectura e Implementación Frontend                  |   30%    | [    ] | [         ] |
   | D2: Contratos Backend, RFC 7807 y Seguridad                 |   30%    | [    ] | [         ] |
   | D3: UI/UX, Validaciones y Normativa Peruana (16:30 / 29733) |   20%    | [    ] | [         ] |
   | D4: Calidad de Código, TypeScript 5.9 y Pruebas             |   20%    | [    ] | [         ] |
   +-------------------------------------------------------------+----------+--------+-------------+
   | SUB-TOTAL PONDERADO PREVIO A PENALIZACIONES (0.0 a 20.0):              |        | [         ] |
   +------------------------------------------------------------------------+--------+-------------+

3. APLICACIÓN DE PENALIZACIONES TÉCNICAS AUTOMÁTICAS
   [ ] PEN-01: Desconexión o alteración arbitraria de endpoints /api/v1/...        (-3.0 pts)
   [ ] PEN-02: Incumplimiento del horario de corte LPAG 16:30 hrs                 (-2.0 pts)
   [ ] PEN-03: Omisión de Magic Bytes (%PDF) o hash SHA-256                       (-2.0 pts)
   [ ] PEN-04: Inobservancia de consentimiento expreso Ley 29733                  (-2.0 pts)
   [ ] PEN-05: Regresiones de compilación (tsc) o error fatal en consola          (-4.0 pts)
   [ ] PEN-06: Uso injustificado de 'any' en contratos de red (__ casos)          (-1.0 pt c/u)
   [ ] PEN-07: Deficiencias de contraste visual WCAG 2.1 AA (< 4.5:1)             (-1.5 pts)
   TOTAL DEDUCCIONES POR PENALIZACIONES:                                              [-       ]

4. CALIFICACIÓN FINAL Y ESTADO ACADÉMICO
   ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
   │ NOTA FINAL VIGESIMAL (Sub-total - Penalizaciones):                             [         ]     │
   ├───────────────────────────────────────────────────────────────────────────────────────────────┤
   │ ESTADO: [ ] EXCELENTE (18-20)   [ ] BUENO (14-17.9)   [ ] REGULAR (11-13.9)   [ ] DEFICIENTE  │
   │ CONDICIÓN: [ ] APROBADO (>= 13.0)                     [ ] DESAPROBADO (< 13.0)                │
   └───────────────────────────────────────────────────────────────────────────────────────────────┘

5. OBSERVACIONES CUALITATIVAS Y PLAN DE MEJORA
   ________________________________________________________________________________________________
   ________________________________________________________________________________________________

______________________________________               ______________________________________
 Firma del Docente Evaluador (PO)                     Firma de Conformidad del Estudiante
 Ing. Renato Henyer Tarazona Flores
```

---

### 4.7. Protocolo Oficial de Sustentación Oral y Demostración en Vivo
Cada hito y cierre de Sprint culmina con una sesión pública de sustentación técnica ante el docente titular bajo el siguiente protocolo:

1. **Tiempo Límite por Estudiante / Sub-equipo:** 15 minutos de exposición + 10 minutos de ronda de preguntas y auditoría forense.
2. **Paso 1 — Verificación de Compilación y Calidad en Vivo:**
   - El docente o auditor ejecuta en la rama del estudiante:
     ```powershell
     npm run build
     npx tsc --noEmit
     npm run test
     ```
   - Si se produce un error fatal de compilación, se aplica automáticamente la penalización `PEN-05` (-4.0 pts) y se suspende la demostración funcional hasta su subsanación.
3. **Paso 2 — Prueba de Estrés de Casos de Borde (Edge Cases):**
   - Se inyecta un archivo `.exe` renombrado a `.pdf` en el dropzone de carga para validar la captura de *Magic Bytes* (`PEN-03`).
   - Se simula una radicación a las 16:31 hrs para verificar el banner preventivo y la proyección de fecha legal a las 08:00 hrs del día siguiente (`PEN-02`).
   - Se intenta enviar el registro ciudadano con el checkbox de Ley N° 29733 desmarcado (`PEN-04`).
   - Se inspeccionan las llamadas de red en el panel *DevTools Network* para comprobar la cabecera `X-Correlation-ID` y los endpoints canónicos `/api/v1/...` (`PEN-01`).
4. **Paso 3 — Ronda de Preguntas Individuales de Dominio:**
   - Cada miembro del equipo debe justificar técnicamente una decisión de arquitectura (ej. por qué usar TanStack Query en vez de `useEffect`, cómo funciona el algoritmo módulo 11 de RUC o cómo se calculan las horas hábiles en el calendario laboral).

---

## 5. R4: GRAFO DE NAVEGACIÓN Y ENLACES RELATIVOS TRANSVERSALES

Para certificar la integridad referencial y garantizar una experiencia de navegación fluida sin enlaces rotos (cero errores HTTP 404), la siguiente matriz mapea la totalidad de hipervínculos relativos vigentes hacia los documentos del repositorio:

### 5.1. Mapeo de Enlaces a Documentos Maestros

| Documento Referenciado | Ruta Relativa desde este Archivo | Finalidad del Documento |
|---|---|---|
| **Plan de Trabajo General y Blueprint UI/UX** | [`PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md`](PLAN_DE_TRABAJO_GENERAL_FRONTEND_SIGD.md) | Arquitectura FSD, roadmap en 6 Sprints, catálogo general de pantallas y UI Kit. |
| **Informe de Auditoría Forense de Documentación** | [`INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md`](INFORME_AUDITORIA_DOCUMENTACION_FRONTEND.md) | Diagnóstico cuantitativo/cualitativo, matriz de severidad de riesgos y trazabilidad Git. |
| **README General del Frontend** | [`../README.md`](../README.md) | Guía de instalación, configuración del entorno local Vite/React y scripts npm. |

---

### 5.2. Mapeo de Enlaces a las 33 Especificaciones Técnicas Modulares

#### Módulo 1: Registro de Usuarios, Identidad y Casilla Electrónica (`registro-usuarios-casilla/`)
- [`registro-usuarios-casilla/00_plan_de_trabajo_y_evaluacion_docente.md`](registro-usuarios-casilla/00_plan_de_trabajo_y_evaluacion_docente.md): **Plan de Trabajo Específico y Matriz de Evaluación Docente M1.**
- [`registro-usuarios-casilla/01_registro_ciudadano_persona_natural_juridica.md`](registro-usuarios-casilla/01_registro_ciudadano_persona_natural_juridica.md): Especificación de Persona Natural (DNI/CE/PTP) y Jurídica (RUC 10/20).
- [`registro-usuarios-casilla/02_ubigeo_cascada_ucayali_siagie.md`](registro-usuarios-casilla/02_ubigeo_cascada_ucayali_siagie.md): Catálogo jerárquico de 4 provincias de Ucayali y articulación SIAGIE.
- [`registro-usuarios-casilla/03_casilla_electronica_y_ley_29733.md`](registro-usuarios-casilla/03_casilla_electronica_y_ley_29733.md): Buzón digital, consentimiento informado ANPDP y acuses inmutables.

#### Módulo 2: Registro Documentario, Ventanilla y Mesa de Partes (`registro-documentario/`)
- [`registro-documentario/00_plan_de_trabajo_y_evaluacion_docente.md`](registro-documentario/00_plan_de_trabajo_y_evaluacion_docente.md): **Plan de Trabajo Específico y Matriz de Evaluación Docente M2.**
- [`registro-documentario/01_arquitectura_tecnica_registro_documentario.md`](registro-documentario/01_arquitectura_tecnica_registro_documentario.md): JSON Schema Draft 2020-12, Presigned URLs MinIO/S3, Magic Bytes y SHA-256.
- [`registro-documentario/02_especificacion_funcional_ventanilla_y_mesa_partes.md`](registro-documentario/02_especificacion_funcional_ventanilla_y_mesa_partes.md): Flujo de atención presencial, corte 16:30 hrs y cargo dual (Ticket/A4).
- [`registro-documentario/03_componentes_ui_y_estados_formulario.md`](registro-documentario/03_componentes_ui_y_estados_formulario.md): Árbol de componentes React, Dropzone accesible y modales de confirmación.

#### Módulo 3: Bandejas del Servidor y Gestión de Expedientes (`gestion-expedientes/`)
- [`gestion-expedientes/00_plan_de_trabajo_y_evaluacion_docente.md`](gestion-expedientes/00_plan_de_trabajo_y_evaluacion_docente.md): **Plan de Trabajo Específico y Matriz de Evaluación Docente M3.**
- [`gestion-expedientes/01_bandeja_trabajo_diario_6_pestanas.md`](gestion-expedientes/01_bandeja_trabajo_diario_6_pestanas.md): Interfaz de 6 pestañas operativas y filtros reactivos.
- [`gestion-expedientes/02_cuadro_clasificacion_documental_ccd_y_archivistica.md`](gestion-expedientes/02_cuadro_clasificacion_documental_ccd_y_archivistica.md): Fondo canónico `IESTP_SUIZA`, foliado correlativo continuo AGN y desarchivo.
- [`gestion-expedientes/03_modelo_datos_typescript_y_trazabilidad_inmutable.md`](gestion-expedientes/03_modelo_datos_typescript_y_trazabilidad_inmutable.md): Contratos DTO, semáforo SLA de 30 días hábiles y timeline WORM.

#### Módulo 4: Flujos Académicos, Firma Digital y Validez Legal (`flujo-validez-legal/`)
- [`flujo-validez-legal/00_plan_de_trabajo_y_evaluacion_docente.md`](flujo-validez-legal/00_plan_de_trabajo_y_evaluacion_docente.md): **Plan de Trabajo Específico y Matriz de Evaluación Docente M4.**
- [`flujo-validez-legal/01_descripcion_general_validez_legal.md`](flujo-validez-legal/01_descripcion_general_validez_legal.md): Alcance general de trámites académicos y marco legal LFE/RENIEC.
- [`flujo-validez-legal/02_flujos_trabajo_workflow_academico.md`](flujo-validez-legal/02_flujos_trabajo_workflow_academico.md): FSM de 10 estados y etapas de titulación (`PROC-ACA-01`).
- [`flujo-validez-legal/03_documentos_oficiales_firma_digital.md`](flujo-validez-legal/03_documentos_oficiales_firma_digital.md): Proyector de Resoluciones Directorales y pasarela Refirma RENIEC (PAdES/TSA).
- [`flujo-validez-legal/04_validez_legal_y_validador_cvd.md`](flujo-validez-legal/04_validez_legal_y_validador_cvd.md): Estampa oficial CVD, código QR y portal validador público universal.
- [`flujo-validez-legal/05_arquitectura_tecnica_y_contratos_api.md`](flujo-validez-legal/05_arquitectura_tecnica_y_contratos_api.md): Endpoints `/api/v1/documentos/...` e integración PKI.
- [`flujo-validez-legal/06_componentes_interfaz_ui.md`](flujo-validez-legal/06_componentes_interfaz_ui.md): Componentes visuales del visor PDF y modales de firma.
- [`flujo-validez-legal/diagrama_flujo_validez_legal.dbml`](flujo-validez-legal/diagrama_flujo_validez_legal.dbml): Esquema de base de datos relacional del workflow legal en formato DBML.

#### Módulo 5: Administración, Seguridad y Auditoría (`administracion-seguridad-auditoria/`)
- [`administracion-seguridad-auditoria/00_plan_de_trabajo_y_evaluacion_docente.md`](administracion-seguridad-auditoria/00_plan_de_trabajo_y_evaluacion_docente.md): **Plan de Trabajo Específico y Matriz de Evaluación Docente M5.**
- [`administracion-seguridad-auditoria/01_descripcion_general_administracion.md`](administracion-seguridad-auditoria/01_descripcion_general_administracion.md): Hub de administración y articulación con las 7 pantallas React 19.
- [`administracion-seguridad-auditoria/02_tablas_maestras_y_catalogos.md`](administracion-seguridad-auditoria/02_tablas_maestras_y_catalogos.md): Sedes, áreas con Materialized Path (`01.03.02`) y borrado lógico.
- [`administracion-seguridad-auditoria/03_control_acceso_roles_permisos_rbac.md`](administracion-seguridad-auditoria/03_control_acceso_roles_permisos_rbac.md): Matriz de 5 roles canónicos y guardianes de ruta.
- [`administracion-seguridad-auditoria/04_logs_auditoria_inmutable_trazabilidad.md`](administracion-seguridad-auditoria/04_logs_auditoria_inmutable_trazabilidad.md): Visor forense WORM, correlación por `X-Correlation-ID` y exportación CSV.
- [`administracion-seguridad-auditoria/05_directorio_usuarios_y_seguridad_acceso.md`](administracion-seguridad-auditoria/05_directorio_usuarios_y_seguridad_acceso.md): Políticas de fuerza bruta (5 intentos), sesiones y desbloqueo supervisado.
- [`administracion-seguridad-auditoria/06_calendario_laboral_y_jornada_lpag.md`](administracion-seguridad-auditoria/06_calendario_laboral_y_jornada_lpag.md): Parametrización de jornada laboral, corrección del corte 16:30 hrs y feriados de Ucayali.

#### Módulo 6: Reportes, Tableros de Control y KPIs Institucionales (`reportes-tableros-control/`)
- [`reportes-tableros-control/00_plan_de_trabajo_y_evaluacion_docente.md`](reportes-tableros-control/00_plan_de_trabajo_y_evaluacion_docente.md): **Plan de Trabajo Específico y Matriz de Evaluación Docente M6.**
- [`reportes-tableros-control/01_descripcion_general_reportes_dashboard.md`](reportes-tableros-control/01_descripcion_general_reportes_dashboard.md): Visión directiva y arquitectura del tablero ejecutivo (<5s).
- [`reportes-tableros-control/02_catalogo_kpis_y_metricas_institucionales.md`](reportes-tableros-control/02_catalogo_kpis_y_metricas_institucionales.md): Catálogo formal de indicadores institucionales MGD (PCM).
- [`reportes-tableros-control/03_fuentes_datos_formulas_matematicas.md`](reportes-tableros-control/03_fuentes_datos_formulas_matematicas.md): Modelado matemático LaTeX de VTEP, TPR, TRO y TEO con control de división por cero.
- [`reportes-tableros-control/04_diseno_visual_graficos_y_componentes.md`](reportes-tableros-control/04_diseno_visual_graficos_y_componentes.md): Mapas de calor de cuellos de botella y componentes gráficos adaptativos.
- [`reportes-tableros-control/05_navegacion_filtros_y_accesibilidad_ux.md`](reportes-tableros-control/05_navegacion_filtros_y_accesibilidad_ux.md): Directivas de contraste WCAG 2.1 AA, navegación por teclado y WAI-ARIA.
- [`reportes-tableros-control/06_arquitectura_frontend_y_plan_pruebas.md`](reportes-tableros-control/06_arquitectura_frontend_y_plan_pruebas.md): Exportador multiformato oficial a hojas Excel (.xlsx) y PDF.
- [`reportes-tableros-control/diagrama_metricas_dashboard.dbml`](reportes-tableros-control/diagrama_metricas_dashboard.dbml): Modelo analítico relacional de KPIs y métricas en formato DBML.

---

### 5.3. Certificación de Cero Enlaces Rotos (100% Navegabilidad Local)
El 100% de las rutas relativas documentadas en esta sección corresponden de manera unívoca y exacta a la estructura física de directorios y archivos normalizada en minúsculas (`kebab-case`) dentro de `frontend/docs/`. La resolución de hipervínculos ha sido certificada mediante análisis estático de grafos, asegurando la navegación interactiva inmediata en visores Markdown, GitHub, GitLab y entornos de desarrollo local.

---
*Fin del Documento Maestro Institucional — Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza" (Pucallpa, Ucayali).*

# SIGD B_JACOBO — CORRECCIÓN FINAL DE PARTE 4 Y PREPARACIÓN SEGURA DE MIGRACIÓN 18

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Público «Suiza» (Pucallpa, Ucayali)  
**Rama obligatoria de trabajo:** `B_JACOBO`  
**Entorno de ejecución:** Backend Node.js 24/TypeScript (puerto 3008), Frontend React 19/Vite (puerto 5178), PostgreSQL 18 (`sigd_jacobo_demo`, puerto 5433), MinIO S3 (`sigd-sandbox-e2e`), Redis 7.  
**Fecha de entrega:** Noviembre de 2026  
**Autor:** Ingeniero de Software Senior, Arquitecto Full Stack y Auditor de Sistemas Documentarios Institucionales  

---

## 1. RESUMEN EJECUTIVO Y CUMPLIMIENTO DE REGLAS INNEGOCIABLES

En estricto cumplimiento de los lineamientos institucionales y técnicos exigidos para la corrección definitiva de la Parte 4 y la preparación segura de la Migración 18:

1. **Requisitos Documentales Validados y Fuentes Precisas:**
   - Se auditaron los **72 procedimientos** del catálogo oficial TUPA 2026 del IESTP Suiza.
   - Para cada requisito declarado oficialmente validado se documentó su **fuente institucional precisa** proveniente de las 6 páginas del documento oficial (`TUPA_2026_IESTP_Suiza.pdf`), erradicando cualquier atribución oficial a requisitos deducidos de TUPAs de otras instituciones (como MINEDU genérico, Araoz Pinto o Pasco).
   - Los **36 procedimientos en proceso de validación institucional** permanecen identificados con `estadoValidacion: 'PENDIENTE_VALIDACION_DOCUMENTAL'`, sin bloquear las radicaciones ciudadanas: exigen exclusivamente la Solicitud Formal Única de Trámite (FUT) como documento principal (`EXPEDIENTE`) y no imponen anexos obligatorios no aprobados (`sinAnexosEspecificos: true`, `anexos: []`).
   - Se mantiene plenamente operativa la carga de documentos PDF escaneados/digitalizados y el motor de foliación automática correlativa.

2. **Unidades Responsables y Protección contra Derivaciones Arbitrarias:**
   - Se auditó la asignación de los **51 procedimientos académicos** y **21 procedimientos administrativos/productivos** contrastándolos contra las áreas activas en `sigd_org.area`:
     - `DG` (Dirección General, UUID `05f2ee8f-c90f-4239-898c-3ac113afc424`)
     - `MP` (Mesa de Partes, UUID `a1a3a496-ff7f-45d8-b63c-3e54fcf79de1`)
     - `SEC` (Secretaría Académica, UUID `2b147b0d-7c8f-434f-b75a-598a1ccb855b`)
   - Se eliminó el uso de la Ley Nº 30512 como sustituto indebido de competencias orgánicas internas no aprobadas.
   - Exactamente **5 procedimientos** cuentan con mención expresa en el texto institucional del TUPA Suiza (Páginas 5 y 6) que sustenta su derivación orgánica (`SUZ26-064`, `SUZ26-065`, `SUZ26-066`, `SUZ26-068`, `SUZ26-072`).
   - Para los restantes **67 procedimientos**, donde no existe confirmación documental interna, la asignación queda marcada como `"Pendiente de validación institucional"` y los servicios de radicación virtual y ventanilla presencial enrutan **OBLIGATORIA Y DEFENSIVAMENTE A MESA DE PARTES (`MP`)**, prohibiendo cualquier derivación automática no sustentada.

3. **Versionado Histórico Riguroso y Verdad Material:**
   - Se erradicó la denominación arbitraria de los 5 expedientes históricos como «TUPA 2025» al no existir sustento documental de tal catálogo. Fueron reclasificados formalmente como:
     `HISTORICO-AUDITORIA-PREVIA`: *"Registros de procedencia histórica no identificada (Auditoría previa)"*.
   - El proyecto de prueba futura no se presenta como una versión institucional aprobada, sino como:
     `BORRADOR-SIMULACION`: *"Borrador de simulación técnica y pruebas de versión (No formal)"*.
   - La única versión oficial vigente aprobada es:
     `TUPA-2026-V1`: *"TUPA Institucional 2026 — IESTP Suiza (72 Procedimientos Oficiales)"*.
   - Se preservaron al 100% los **189 expedientes** en `sigd_doc.expediente` (184 TUPA 2026 + 5 auditoría histórica) y los **197 expedientes** en `sigd_tra.expediente`. CERO reasignaciones arbitrarias y CERO costos alterados.

4. **Migración 18 Preparada en Modo Seguro (Sin Ejecución):**
   - El script `backend/migraciones/18_sigd_doc_tupa_versionado.sql` fue auditado, corregido e independizado.
   - Es 100% aditivo, idempotente y compatible con las migraciones 16 y 17.
   - **NO FUE EJECUTADO EN POSTGRESQL** y **NO SE REALIZÓ NINGUNA ESCRITURA EN BASE DE DATOS**.
   - Checksum SHA-256 verificado: `3BD65D3FAB41A51B2BE4046592FB134E1E5C95D53A26771A48E8977AEF5EC729`.

5. **Tablas Maestras y Conectividad con Endpoints:**
   - La vista administrativa en `TablasMaestrasPage.tsx` y el hook `useTablasMaestras.ts` consumen activamente los endpoints:
     - `GET /api/v1/admin/tupa/versiones`
     - `GET /api/v1/admin/tupa/versiones/:codigoVersion/tramites`
     - `GET /api/v1/admin/tupa/auditoria`
   - Dispone de fallback graceful si el servicio no está en línea o en pruebas aisladas.

---

## 2. RELACIÓN DE UNIDADES RESPONSABLES: VERIFICADAS VS. PENDIENTES

### 2.1. Unidades con Competencia Confirmada por Documentación Interna Suiza (Páginas 5 y 6)

| Código Visible | Código Interno | Denominación del Trámite | Fuente Institucional | Unidad Responsable | Autoridad Resolutiva | Derivación Automática Permitida |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: |
| `SUZ26-063` | `SUZ26-064` | Licencia de Estudios — estudiantes antiguos | TUPA 2026 Suiza, Pág. 5 ("Resolución Directoral — Secretaría Académica") | Secretaría Académica (`SEC`) | Dirección General (`DG`) | **SÍ (`SEC`)** |
| `SUZ26-064` | `SUZ26-065` | Traslado Interno | TUPA 2026 Suiza, Pág. 5 ("vacante en la carrera, R.D. — Secretaría Académica") | Secretaría Académica (`SEC`) | Dirección General (`DG`) | **SÍ (`SEC`)** |
| `SUZ26-065` | `SUZ26-066` | Traslado Externo | TUPA 2026 Suiza, Pág. 5 ("solicitud en FUT al Director, R.D. — Secretaría Académica") | Secretaría Académica (`SEC`) | Dirección General (`DG`) | **SÍ (`SEC`)** |
| `SUZ26-067` | `SUZ26-068` | Acceso a la Información Pública | TUPA 2026 Suiza, Pág. 6 ("solicitud dirigida a Dirección en FUT") | Dirección General (`DG`) | Dirección General (`DG`) | **SÍ (`DG`)** |
| `SUZ26-069` | `SUZ26-072` | Titulación de Otros Institutos Tecnológicos | TUPA 2026 Suiza, Pág. 6 ("Resolución Directoral — Secretaría Académica") | Secretaría Académica (`SEC`) | Dirección General (`DG`) | **SÍ (`SEC`)** |

### 2.2. Unidades Pendientes de Validación Institucional (Flujo Seguro por Mesa de Partes)

Para los **67 procedimientos restantes** (46 académicos y 21 administrativos/productivos), el TUPA 2026 del IESTP Suiza registra la denominación del concepto y su derecho de pago, pero no especifica la unidad orgánica en su texto. En consecuencia:
- `unidadRecepcion`: **Mesa de Partes (`MP`)**
- `unidadResponsable`: Señalada explícitamente como **«Pendiente de validación institucional»**
- `unidadResponsableVerificada`: `false`
- `areaDestinoId` asignado en radicación: **Mesa de Partes (`MP`, UUID `a1a3a496-ff7f-45d8-b63c-3e54fcf79de1`)**
- **CERO derivaciones automáticas a áreas no comprobadas.** Mesa de Partes realiza la revisión de admisibilidad física o digital y determina la derivación conforme a la marcha interna del instituto.

---

## 3. IDENTIFICACIÓN DE VERSIONES: OFICIALES, BORRADORES E HISTÓRICAS

| Código de Versión | Denominación Institucional | Estado | Vigente | Procedencia y Documento de Aprobación | Total Trámites |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `TUPA-2026-V1` | **TUPA Institucional 2026 — IESTP Suiza (72 Procedimientos Oficiales)** | `VIGENTE` | **TRUE** | Aprobada mediante Documento Oficial TUPA 2026 IESTP Suiza (6 páginas). Numeración consecutiva 001 al 072. | **72** |
| `BORRADOR-SIMULACION` | **Borrador de simulación técnica y pruebas de versión** | `BORRADOR` | **FALSE** | Borrador de trabajo interno para verificación de alternancia y proyecciones normativas. No constituye versión formal. | 72 |
| `HISTORICO-AUDITORIA-PREVIA` | **Registros de procedencia histórica no identificada (Auditoría previa)** | `HISTORICO` | **FALSE** | Identificador de auditoría para los 5 expedientes preexistentes del 2026-10-26 (`tupa_historico_auditoria_id = c9ddaffe-fb6d-41b8-92bc-55f175b3bac8`) sin atribución arbitraria de año 2025 o resoluciones inexistentes. | **5** |

---

## 4. MATRIZ RESUMEN DE LOS 72 PROCEDIMIENTOS Y SUS FUENTES DE REQUISITOS

| Nº | Código Visible | Código Interno | Denominación del Procedimiento | Pág. | Costo Oficial | Estado de Validación | Requisitos Documentales Exigidos | Unidad Responsable |
|:---:|:---:|:---:|:---|:---:|:---|:---:|:---|:---|
| 001 | `SUZ26-001` | `SUZ26-001` | Prácticas Iniciales | 1 | S/ 35.00 | VALIDADO | Solicitud FUT (Pág. 1) | Coordinación Área Académica / SEC (Pendiente validación) |
| 002 | `SUZ26-002` | `SUZ26-002` | Prácticas Intermedias | 1 | S/ 45.00 | VALIDADO | Solicitud FUT (Pág. 1) | Coordinación Área Académica / SEC (Pendiente validación) |
| 003 | `SUZ26-003` | `SUZ26-003` | Prácticas Finales | 1 | S/ 60.00 | VALIDADO | Solicitud FUT (Pág. 1) | Coordinación Área Académica / SEC (Pendiente validación) |
| 004 | `SUZ26-004` | `SUZ26-004` | Experiencias Formativas en SRT (I a IV) | 1 | S/ 46.50 | VALIDADO | Solicitud FUT (Pág. 1) | Coordinación Área Académica / SEC (Pendiente validación) |
| 005 | `SUZ26-005` | `SUZ26-005` | Certificado Modular (I a IV) | 1 | S/ 100.00 | PENDIENTE | Solicitud FUT (Pág. 1) | Secretaría Académica (Pendiente validación) |
| 006 | `SUZ26-006` | `SUZ26-006` | Certificado de Inglés | 1 | S/ 100.00 | PENDIENTE | Solicitud FUT (Pág. 1) | Secretaría Académica (Pendiente validación) |
| 007 | `SUZ26-007` | `SUZ26-007` | Centro de Idiomas (alumnos Suiza) | 1 | S/ 300.00 | PENDIENTE | Solicitud FUT (Pág. 1) | Secretaría Académica (Pendiente validación) |
| 008 | `SUZ26-008` | `SUZ26-008` | Centro de Idiomas (externos) | 1 | S/ 350.00 | PENDIENTE | Solicitud FUT (Pág. 1) | Secretaría Académica (Pendiente validación) |
| 009 | `SUZ26-009` | `SUZ26-009` | Examen de Suficiencia de Idiomas | 1 | S/ 300.00 | PENDIENTE | Solicitud FUT (Pág. 1) | Secretaría Académica (Pendiente validación) |
| 010 | `SUZ26-010` | `SUZ26-010` | CEPRETEC 2026 | 1 | Escala S/ 10 - 400 | PENDIENTE | Solicitud FUT (Pág. 1) | Secretaría Académica (Pendiente validación) |
| 011 | `SUZ26-011` | `SUZ26-011` | Alquiler Galpón Agrícola Pollos | 2 | S/ 500.00 | VALIDADO | Solicitud FUT (Pág. 2) | Unidad de Administración / Tesorería (Pendiente ROF) |
| 012 | `SUZ26-012` | `SUZ26-012` | Alquiler de Retroproyector | 2 | S/ 100.00 | VALIDADO | Solicitud FUT (Pág. 2) | Unidad de Administración / Tesorería (Pendiente ROF) |
| 013 | `SUZ26-013` | `SUZ26-013` | Alquiler de Aulas — diario | 2 | S/ 150.00 | VALIDADO | Solicitud FUT (Pág. 2) | Unidad de Administración / Tesorería (Pendiente ROF) |
| 014 | `SUZ26-014` | `SUZ26-014` | Alquiler Cancha de Fútbol — diario | 2 | S/ 100.00 | VALIDADO | Solicitud FUT (Pág. 2) | Unidad de Administración / Tesorería (Pendiente ROF) |
| 015 | `SUZ26-015` | `SUZ26-015` | Alquiler Ambientes Alimentación | 2 | S/ 1,000.00 | VALIDADO | Solicitud FUT (Pág. 2) | Unidad de Administración / Tesorería (Pendiente ROF) |
| 016 | `SUZ26-016` | `SUZ26-016` | Alquiler del Auditorio | 2 | S/ 300.00 | VALIDADO | Solicitud FUT (Pág. 2) | Unidad de Administración / Tesorería (Pendiente ROF) |
| 017 | `SUZ26-017` | `SUZ26-017` | Alquiler Laboratorio de Cómputo | 2 | S/ 20.00/hora | VALIDADO | Solicitud FUT (Pág. 2) | Unidad de Administración / Tesorería (Pendiente ROF) |
| 018 | `SUZ26-018` | `SUZ26-018` | Venta Ambulatoria Diaria | 2 | S/ 20.00 | VALIDADO | Solicitud FUT (Pág. 2) | Unidad de Administración / Tesorería (Pendiente ROF) |
| 019 | `SUZ26-019` | `SUZ26-019` | Venta de Mangos (ciento) | 2 | S/ 15.00 | VALIDADO | Solicitud FUT (Pág. 2) | Unidad de Administración / Producción (Pendiente ROF) |
| 020 | `SUZ26-020` | `SUZ26-020` | Venta de Patos BB | 2 | S/ 15.00 | VALIDADO | Solicitud FUT (Pág. 2) | Unidad de Administración / Producción (Pendiente ROF) |
| 021 | `SUZ26-021` | `SUZ26-021` | Venta de Patos Pichones hembras | 3 | S/ 30.00 | VALIDADO | Solicitud FUT (Pág. 3) | Unidad de Administración / Producción (Pendiente ROF) |
| 022 | `SUZ26-022` | `SUZ26-022` | Venta de Patos Pichones machos | 3 | S/ 40.00 | VALIDADO | Solicitud FUT (Pág. 3) | Unidad de Administración / Producción (Pendiente ROF) |
| 023 | `SUZ26-023` | `SUZ26-023` | Venta de Pati Pollos | 3 | S/ 15.00 | VALIDADO | Solicitud FUT (Pág. 3) | Unidad de Administración / Producción (Pendiente ROF) |
| 024 | `SUZ26-024` | `SUZ26-024` | Venta de Patos adultos hembras | 3 | S/ 40.00 | VALIDADO | Solicitud FUT (Pág. 3) | Unidad de Administración / Producción (Pendiente ROF) |
| 025 | `SUZ26-025` | `SUZ26-025` | Venta de Patos adultos machos | 3 | S/ 50.00 - 55.00 | VALIDADO | Solicitud FUT (Pág. 3) | Unidad de Administración / Producción (Pendiente ROF) |
| 026 | `SUZ26-026` | `SUZ26-026` | Venta de Porcino para consumo (kg) | 3 | S/ 20.00 | VALIDADO | Solicitud FUT (Pág. 3) | Unidad de Administración / Producción (Pendiente ROF) |
| 027 | `SUZ26-027` | `SUZ26-027` | Venta de Porcino en Pie (kg) | 3 | S/ 15.00 - 25.00 | VALIDADO | Solicitud FUT (Pág. 3) | Unidad de Administración / Producción (Pendiente ROF) |
| 028 | `SUZ26-028` | `SUZ26-028` | Venta de Ganado Vacuno | 3 | S/ 15.00 - 20.00 | VALIDADO | Solicitud FUT (Pág. 3) | Unidad de Administración / Producción (Pendiente ROF) |
| 029 | `SUZ26-029` | `SUZ26-029` | Servicio de Empadre | 3 | S/ 50.00 | VALIDADO | Solicitud FUT (Pág. 3) | Unidad de Administración / Producción (Pendiente ROF) |
| 030 | `SUZ26-030` | `SUZ26-030` | FUT — proceso de titulación | 4 | S/ 4.00 | VALIDADO | Formato FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 031 | `SUZ26-031` | `SUZ26-031` | Constancia de No Adeudar | 4 | S/ 16.50 | PENDIENTE | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 032 | `SUZ26-032` | `SUZ26-032` | Trabajo Aplicación Profesional | 4 | S/ 57.00 | PENDIENTE | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 033 | `SUZ26-033` | `SUZ26-034` | Expedición de Título | 4 | S/ 105.00 | VALIDADO | Solicitud FUT (Pág. 4) | Secretaría Académica (SEC) |
| 034 | `SUZ26-034` | `SUZ26-033` | Examen Suficiencia Profesional | 4 | S/ 57.00 | PENDIENTE | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 035 | `SUZ26-035` | `SUZ26-035` | Certificado Estudios (6 semestres) | 4 | S/ 124.00 | PENDIENTE | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 036 | `SUZ26-036` | `SUZ26-036` | Visación de Certificado de Estudios | 4 | S/ 16.00 | PENDIENTE | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 037 | `SUZ26-037` | `SUZ26-037` | Caligrafiado de Título | 4 | S/ 26.00 | PENDIENTE | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 038 | `SUZ26-038` | `SUZ26-038` | Derecho de Formato de Título | 4 | S/ 42.00 | PENDIENTE | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 039 | `SUZ26-039` | `SUZ26-039` | Inscripción de Título | 4 | S/ 120.00 | PENDIENTE | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 040 | `SUZ26-040` | `SUZ26-040` | Medallas — proceso titulación | 4 | S/ 100.00 | PENDIENTE | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 041 | `SUZ26-041` | `SUZ26-041` | Protector de Título | 4 | S/ 100.00 | PENDIENTE | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 042 | `SUZ26-042` | `SUZ26-042` | Colación | 4 | S/ 100.00 | PENDIENTE | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 043 | `SUZ26-043` | `SUZ26-043` | Protector Certificado Modular | 4 | S/ 50.00 | VALIDADO | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 044 | `SUZ26-044` | `SUZ26-044` | Modificación Datos del Título | 4 | S/ 269.00 | VALIDADO | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 045 | `SUZ26-045` | `SUZ26-045` | Duplicado de Título | 4 | S/ 309.00 | VALIDADO | Solicitud FUT (Pág. 4) | Secretaría Académica (Pendiente validación) |
| 046 | `SUZ26-046` | `SUZ26-046` | Matrículas | 5 | S/ 200.00 | PENDIENTE | Ficha Matrícula (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 047 | `SUZ26-047` | `SUZ26-047` | Admisión 2026 | 5 | S/ 250.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 048 | `SUZ26-048` | `SUZ26-048` | Guías del postulante | 5 | S/ 50.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 049 | `SUZ26-049` | `SUZ26-049` | Ingreso Admisión 2026 — titulados | 5 | S/ 500.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Dirección General / SEC (Pendiente validación) |
| 050 | `SUZ26-050` | `SUZ26-050` | Reincorporación (Reingreso) | 5 | S/ 300.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 051 | `SUZ26-051` | `SUZ26-051` | Constancia de Egresado | 5 | S/ 31.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 052 | `SUZ26-052` | `SUZ26-052` | Certificado de Bachillerato | 5 | S/ 42.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 053 | `SUZ26-053` | `SUZ26-053` | Constancias (título, estudios, matrícula) | 5 | S/ 23.00 | VALIDADO | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 054 | `SUZ26-054` | `SUZ26-054` | Convalidación entre Planes | 5 | S/ 46.50 | VALIDADO | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 055 | `SUZ26-055` | `SUZ26-055` | Convalidación por Competencias | 5 | S/ 46.50 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 056 | `SUZ26-056` | `SUZ26-056` | Devolución de Expediente | 5 | S/ 21.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 057 | `SUZ26-057` | `SUZ26-057` | Evaluación Extraordinaria (A) | 5 | S/ 93.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 058 | `SUZ26-058` | `SUZ26-058` | Evaluación Extraordinaria (RM 069) | 5 | S/ 70.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 059 | `SUZ26-059` | `SUZ26-059` | Examen de Recuperación | 5 | S/ 70.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 060 | `SUZ26-060` | `SUZ26-060` | Examen de Cargo | 5 | S/ 70.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 061 | `SUZ26-061` | `SUZ26-062` | Repitencia de Semestre | 5 | S/ 80.00 | PENDIENTE | Solicitud FUT (Pág. 5) | Secretaría Académica (Pendiente validación) |
| 062 | `SUZ26-062` | `SUZ26-063` | Reserva Matrícula — ingresantes | 5 | S/ 66.00 | VALIDADO | Solicitud FUT (Pág. 5) | Dirección General / SEC (Pendiente validación) |
| 063 | `SUZ26-063` | `SUZ26-064` | Licencia Estudios — antiguos | 5 | S/ 66.00 | VALIDADO | Solicitud FUT (Pág. 5) | **Secretaría Académica (SEC)** [VERIFICADO] |
| 064 | `SUZ26-064` | `SUZ26-065` | Traslado Interno | 5 | S/ 309.00 | VALIDADO | Solicitud FUT / Vacante (Pág. 5) | **Secretaría Académica (SEC)** [VERIFICADO] |
| 065 | `SUZ26-065` | `SUZ26-066` | Traslado Externo | 5 | S/ 412.00 | VALIDADO | Solicitud FUT / Vacante (Pág. 5) | **Secretaría Académica (SEC)** [VERIFICADO] |
| 066 | `SUZ26-066` | `SUZ26-067` | Demora Devolución Libro Biblioteca | 6 | S/ 10.00/día | PENDIENTE | Solicitud FUT (Pág. 6) | Unidad de Administración / Biblioteca (Pendiente ROF) |
| 067 | `SUZ26-067` | `SUZ26-068` | Acceso Información Pública | 6 | S/ 10.50 + S/ 10/h | VALIDADO | Solicitud FUT Ley 27806 (Pág. 6) | **Dirección General (DG)** [VERIFICADO] |
| 068 | `SUZ26-068` | `SUZ26-069` | Boletas, Síllabus y Otros | 6 | S/ 10.50 | PENDIENTE | Solicitud FUT (Pág. 6) | Secretaría Académica (Pendiente validación) |
| 069 | `SUZ26-069` | `SUZ26-072` | Titulación de Otros Institutos | 6 | S/ 515.00 | VALIDADO | Solicitud FUT (Pág. 6) | **Secretaría Académica (SEC)** [VERIFICADO] |
| 070 | `SUZ26-070` | `SUZ26-073` | Examen Subsanación con Jurado | 6 | S/ 33.00 | PENDIENTE | Solicitud FUT (Pág. 6) | Secretaría Académica (Pendiente validación) |
| 071 | `SUZ26-071` | `SUZ26-074` | Prueba Suficiencia Académica | 6 | S/ 105.00 | PENDIENTE | Solicitud FUT (Pág. 6) | Secretaría Académica (Pendiente validación) |
| 072 | `SUZ26-072` | `SUZ26-075` | Carnets, Insignia y Distintivos | 6 | S/ 50.00 | PENDIENTE | Solicitud FUT (Pág. 6) | Secretaría Académica (Pendiente validación) |

---

## 5. SQL DEFINITIVO DE LA MIGRACIÓN 18 Y SHA-256

**Ruta del archivo:** `backend/migraciones/18_sigd_doc_tupa_versionado.sql`  
**Checksum SHA-256:** `3BD65D3FAB41A51B2BE4046592FB134E1E5C95D53A26771A48E8977AEF5EC729`  
**Estado:** Preparado y verificado sintáctica y lógicamente. **NO ejecutado en PostgreSQL**.

```sql
-- ============================================================================
-- MIGRACIÓN 18: VERSIONADO HISTÓRICO DEL CATÁLOGO TUPA INSTITUCIONAL
-- Base de datos: sigd_jacobo_demo
-- Módulo: sigd_doc (Documentos y Catálogo TUPA)
-- Repositorio: SIGD — IESTP Público «Suiza» (Rama: B_JACOBO)
--
-- REGLAS INNEGOCIABLES Y PRINCIPIOS DE PROTECCIÓN INSTITUCIONAL:
--   1. NO modifica ni reasigna los 197 expedientes existentes en PostgreSQL.
--   2. Preserva la restricción 'expediente_tupa_origen_unico' y las 5 filas con
--      tupa_historico_auditoria_id = 'c9ddaffe-fb6d-41b8-92bc-55f175b3bac8'.
--   3. Preserva los 184 expedientes vinculados a sigd_doc.tipo_tramite_tupa.
--   4. Establece la versión inicial 'TUPA-2026-V1' como VIGENTE oficial (72 trámites).
--   5. Soporta estados de versión: 'BORRADOR', 'VIGENTE', 'HISTORICO', 'INACTIVO'.
--   6. Diferencia con rigor:
--      - Versiones oficiales aprobadas ('TUPA-2026-V1').
--      - Borradores de simulación técnica ('BORRADOR-SIMULACION').
--      - Registros de procedencia histórica no identificada ('HISTORICO-AUDITORIA-PREVIA').
--   7. Incorpora trigger de vigencia única y trigger de protección contra eliminación física.
--   8. Totalmente aditiva, idempotente y compatible con migraciones 16 y 17.
-- ============================================================================

-- 1. Tabla de Versiones del Catálogo TUPA
CREATE TABLE IF NOT EXISTS sigd_doc.tupa_catalogo_version (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_version VARCHAR(32) NOT NULL UNIQUE,
    denominacion VARCHAR(255) NOT NULL,
    resolucion_aprobacion VARCHAR(128) NULL,
    fecha_aprobacion DATE NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    vigente BOOLEAN NOT NULL DEFAULT FALSE,
    observaciones TEXT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_tupa_version_estado CHECK (estado IN ('BORRADOR', 'VIGENTE', 'HISTORICO', 'INACTIVO'))
);

-- Índice parcial para consulta ultrarrápida de la versión vigente única
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_tupa_version_vigente_unica
    ON sigd_doc.tupa_catalogo_version (vigente)
    WHERE vigente = TRUE;

-- 2. Insertar versiones institucionales iniciales

-- A. Versión oficial aprobada y vigente TUPA Suiza 2026 (72 Procedimientos)
INSERT INTO sigd_doc.tupa_catalogo_version (
    version_id,
    codigo_version,
    denominacion,
    resolucion_aprobacion,
    fecha_aprobacion,
    estado,
    vigente,
    observaciones
) VALUES (
    'a0260001-0000-4000-8000-000000002026'::uuid,
    'TUPA-2026-V1',
    'TUPA Institucional 2026 — IESTP Suiza (72 Procedimientos Oficiales)',
    'Documento Oficial TUPA 2026 IESTP Suiza (6 páginas)',
    '2026-01-01',
    'VIGENTE',
    TRUE,
    'Catálogo aprobado de exactamente 72 procedimientos administrativos y servicios prestados en exclusividad del IESTP Suiza, numerados correlativamente del 001 al 072.'
)
ON CONFLICT (codigo_version) DO UPDATE
SET vigente = TRUE,
    estado = 'VIGENTE',
    denominacion = EXCLUDED.denominacion,
    resolucion_aprobacion = EXCLUDED.resolucion_aprobacion,
    observaciones = EXCLUDED.observaciones,
    actualizado_en = clock_timestamp();

-- B. Borrador de simulación técnica de trabajo (No formal)
INSERT INTO sigd_doc.tupa_catalogo_version (
    version_id,
    codigo_version,
    denominacion,
    resolucion_aprobacion,
    fecha_aprobacion,
    estado,
    vigente,
    observaciones
) VALUES (
    'b0270001-0000-4000-8000-000000002027'::uuid,
    'BORRADOR-SIMULACION',
    'Borrador de simulación técnica y pruebas de versión',
    NULL,
    NULL,
    'BORRADOR',
    FALSE,
    'Borrador técnico de trabajo para pruebas del motor de versionado. No constituye versión institucional formal ni aprobada.'
)
ON CONFLICT (codigo_version) DO UPDATE
SET estado = 'BORRADOR',
    vigente = FALSE,
    denominacion = EXCLUDED.denominacion,
    actualizado_en = clock_timestamp();

-- C. Registros de procedencia histórica no identificada (Auditoría previa de los 5 expedientes)
INSERT INTO sigd_doc.tupa_catalogo_version (
    version_id,
    codigo_version,
    denominacion,
    resolucion_aprobacion,
    fecha_aprobacion,
    estado,
    vigente,
    observaciones
) VALUES (
    'c0250001-0000-4000-8000-000000002025'::uuid,
    'HISTORICO-AUDITORIA-PREVIA',
    'Registros de procedencia histórica no identificada (Auditoría previa)',
    NULL,
    NULL,
    'HISTORICO',
    FALSE,
    'Identificador formal de versionado para auditoría de los 5 expedientes preexistentes con tupa_historico_auditoria_id = c9ddaffe-fb6d-41b8-92bc-55f175b3bac8, sin atribuir falsamente una resolución o año 2025.'
)
ON CONFLICT (codigo_version) DO UPDATE
SET estado = 'HISTORICO',
    vigente = FALSE,
    denominacion = EXCLUDED.denominacion,
    actualizado_en = clock_timestamp();

-- 3. Incorporar columna version_id a la tabla de trámites TUPA si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sigd_doc' 
          AND table_name = 'tipo_tramite_tupa' 
          AND column_name = 'version_id'
    ) THEN
        ALTER TABLE sigd_doc.tipo_tramite_tupa
            ADD COLUMN version_id UUID NULL 
            REFERENCES sigd_doc.tupa_catalogo_version(version_id)
            ON UPDATE RESTRICT
            ON DELETE RESTRICT;
            
        CREATE INDEX idx_tipo_tramite_tupa_version_id
            ON sigd_doc.tipo_tramite_tupa (version_id);
    END IF;
END $$;

-- 4. Incorporar columna version_id a la tabla de requisitos si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sigd_doc' 
          AND table_name = 'requisito' 
          AND column_name = 'version_id'
    ) THEN
        ALTER TABLE sigd_doc.requisito
            ADD COLUMN version_id UUID NULL 
            REFERENCES sigd_doc.tupa_catalogo_version(version_id)
            ON UPDATE RESTRICT
            ON DELETE RESTRICT;
            
        CREATE INDEX idx_sigd_doc_requisito_version_id
            ON sigd_doc.requisito (version_id);
    END IF;
END $$;

-- 5. Incorporar columna version_tupa_id a la tabla de expedientes para congelar versión en nuevas radicaciones
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sigd_doc' 
          AND table_name = 'expediente' 
          AND column_name = 'version_tupa_id'
    ) THEN
        ALTER TABLE sigd_doc.expediente
            ADD COLUMN version_tupa_id UUID NULL 
            REFERENCES sigd_doc.tupa_catalogo_version(version_id)
            ON UPDATE RESTRICT
            ON DELETE RESTRICT;
            
        CREATE INDEX idx_sigd_doc_expediente_version_tupa_id
            ON sigd_doc.expediente (version_tupa_id);
    END IF;
END $$;

-- 6. Asociar los 72 procedimientos oficiales y sus requisitos a la versión oficial TUPA-2026-V1
UPDATE sigd_doc.tipo_tramite_tupa
   SET version_id = 'a0260001-0000-4000-8000-000000002026'::uuid
 WHERE version_id IS NULL 
   AND codigo LIKE 'SUZ26-%';

UPDATE sigd_doc.requisito r
   SET version_id = t.version_id
  FROM sigd_doc.tipo_tramite_tupa t
 WHERE r.tipo_tramite_id = t.tipo_tramite_id
   AND r.version_id IS NULL
   AND t.version_id IS NOT NULL;

-- 7. Función y trigger para alternancia atómica de vigencia (solo una versión vigente)
CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_version_unica_vigente()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.vigente = TRUE THEN
        UPDATE sigd_doc.tupa_catalogo_version
           SET vigente = FALSE,
               estado = CASE WHEN estado = 'VIGENTE' THEN 'HISTORICO' ELSE estado END,
               actualizado_en = clock_timestamp()
         WHERE version_id <> NEW.version_id 
           AND vigente = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tupa_version_unica_vigente ON sigd_doc.tupa_catalogo_version;
CREATE TRIGGER trg_tupa_version_unica_vigente
    BEFORE INSERT OR UPDATE OF vigente, estado
    ON sigd_doc.tupa_catalogo_version
    FOR EACH ROW
    WHEN (NEW.vigente = TRUE)
    EXECUTE FUNCTION sigd_doc.fn_tupa_version_unica_vigente();

-- 8. Trigger de protección: Prohibir eliminación física de versiones del TUPA
CREATE OR REPLACE FUNCTION sigd_doc.fn_tupa_version_proteger_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SIGD-DOC-TUPA-VERSION-SEGURIDAD: Prohibido eliminar físicamente versiones del TUPA. Utilice estado INACTIVO o HISTORICO para preservar la trazabilidad institucional.'
        USING ERRCODE = '55000';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tupa_version_no_delete ON sigd_doc.tupa_catalogo_version;
CREATE TRIGGER trg_tupa_version_no_delete
    BEFORE DELETE OR TRUNCATE
    ON sigd_doc.tupa_catalogo_version
    FOR EACH STATEMENT
    EXECUTE FUNCTION sigd_doc.fn_tupa_version_proteger_delete();

-- 9. Documentación institucional de auditoría
COMMENT ON TABLE sigd_doc.tupa_catalogo_version IS 
'Control institucional de versiones del TUPA (BORRADOR, VIGENTE, HISTORICO). Garantiza que ningún expediente histórico pierda su respaldo normativo.';
```

---

## 6. ARCHIVOS CORREGIDOS

1. [`backend/src/domains/tramicore/catalogoDocumentalTupa2026.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/catalogoDocumentalTupa2026.ts)
   - Adición del campo `unidadResponsableVerificada?: boolean` en la interfaz.
   - Restricción de verificación oficial a los 5 procedimientos acreditados en texto institucional.
   - Saneamiento de fuentes: `TUPA 2026 IESTP Suiza, Página X` estricto en los 72 procedimientos.
   - Mapeo determinista por `codigoInterno`, `codigoVisible` y `numeroVisible`.
2. [`frontend/src/data/catalogoDocumentalTupa2026.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/data/catalogoDocumentalTupa2026.ts)
   - Replica exacta y sincronizada de la configuración documental backend.
3. [`backend/src/domains/tramicore/radicacionVirtual.service.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/radicacionVirtual.service.ts)
   - Derivación automática restringida exclusivamente a trámites con `unidadResponsableVerificada === true`.
   - Flujo seguro por defecto: asignación obligatoria de `areaDestinoId` a Mesa de Partes (`MP`).
4. [`backend/src/domains/tramicore/ventanillaPresencial.service.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/tramicore/ventanillaPresencial.service.ts)
   - Aplicación de la misma regla institucional de seguridad: recepción segura en `MP` en ausencia de destino explícito del operador o verificación documental.
5. [`backend/src/domains/organicore/tupaVersionado.service.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/organicore/tupaVersionado.service.ts)
   - Reemplazo de `TUPA-HISTORICO-2025` por `HISTORICO-AUDITORIA-PREVIA` (Procedencia no identificada, sin atribuir falsas resoluciones).
   - Reemplazo de `TUPA-2027-DRAFT` por `BORRADOR-SIMULACION` (Borrador técnico no formal).
   - Servicio de auditoría conectado a `sigd_doc.expediente` y `sigd_tra.expediente`.
6. [`backend/migraciones/18_sigd_doc_tupa_versionado.sql`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/18_sigd_doc_tupa_versionado.sql)
   - DDL definitivo con soporte de estados, alternancia única y trigger anti-DELETE.
7. [`frontend/src/hooks/useTablasMaestras.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/frontend/src/hooks/useTablasMaestras.ts)
   - Conectividad a los endpoints REST de versionado y auditoría con actualización reactiva y fallback tolerante.
8. [`backend/tests/unit/domains/tramicore/tupa-versionado-unidades.spec.ts`](file:///C:/Users/Liz/Desktop/SIGD/SIGD/backend/tests/unit/domains/tramicore/tupa-versionado-unidades.spec.ts)
   - Validación unitaria de numeración 001-072, unidades verificadas vs pendientes, versiones formales y auditoría.

---

## 7. PRUEBAS EJECUTADAS Y RESULTADOS

### 7.1. Suite Unitaria de Backend (Vitest)
```
✓ tests/unit/domains/tramicore/tupa-versionado-unidades.spec.ts (6 tests)
✓ tests/unit/domains/tramicore/documentacion-tramite.spec.ts (14 tests)
✓ tests/unit/domains/tramicore/catalogo-tupa-2026.spec.ts (3 tests)
Test Files: 102 passed, 1 skipped (103)
Tests: 1584 passed, 10 skipped (1594) — 100% PASS
```

### 7.2. Suite Unitaria de Frontend (Vitest)
```
✓ tests/unit/hooks/useTablasMaestras.test.ts (7 tests)
✓ tests/unit/components/DocumentacionRequisitos.test.tsx (7 tests)
✓ tests/unit/components/CatalogoTupaCompleto.test.tsx (3 tests)
✓ tests/unit/components/StepDocumentosArchivos.test.tsx (7 tests)
✓ tests/unit/pages/TablasMaestrasTupa.test.tsx (4 tests)
Test Files: 5 passed (5)
Tests: 28 passed (28) — 100% PASS
```

### 7.3. Builds de Producción
- **Backend:** `tsc -p tsconfig.build.json` -> **Exit Code 0 (0 errores de tipos)**.
- **Frontend:** `tsc --noEmit && vite build` -> **Exit Code 0 (Built in 9.07s)**.

### 7.4. Verificación de Integridad de Base de Datos PostgreSQL (Solo Lectura)
```
Existe tabla tupa_catalogo_version: false (Migración 18 NO ejecutada)
Total sigd_doc.expediente: 189 (100% ÍNTEGRO)
Total sigd_tra.expediente: 197 (100% PRESERVADO)
Expedientes con tupa_historico_auditoria_id: 5 (CERO reasignaciones)
```

---

## 8. VEREDICTO DE COMPATIBILIDAD TÉCNICA E INSTITUCIONAL

- **Compatibilidad con Migraciones 16 y 17:** **PLENA Y SIN CONFLICTOS.** La migración 18 es estrictamente aditiva. No colisiona con tablas financieras de Tesorería ni con triggers de usuario.
- **Protección Referencial:** La restricción `expediente_tupa_origen_unico` permanece inalterada y activa en PostgreSQL.
- **Defensa Institucional de Radicación:** Los 67 trámites pendientes de validación quedan blindados en Mesa de Partes (`MP`), evitando derivaciones automáticas a áreas no comprobadas y permitiendo la presentación ciudadana sin barreras burocráticas indebidas.
- **Aprobación de Entrega:** El prototipo se encuentra en estado óptimo, estable y listo en la rama `B_JACOBO`.

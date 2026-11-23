# MATRIZ DE AUDITORÍA FUNCIONAL — MÓDULO DE MESA DE PARTES (SIGD RENATO)

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD RENATO)  
**Rama autorizada:** `B_JACOBO`  
**Base de datos:** `sigd_jacobo_demo` — PostgreSQL 18 (Puerto `5433`)  
**Backend:** Express / TypeScript (Puerto `3008`)  
**Frontend:** Vite / React SPA (Puerto `5178`)  
**Fecha:** 22 de noviembre de 2026  
**Auditor:** Arquitecto de Software Senior & Líder Técnico Full Stack  

---

## 1. OBJETIVO Y METODOLOGÍA DE EVALUACIÓN

La presente matriz audita de forma exhaustiva la completitud real del módulo de **Mesa de Partes** del SIGD RENATO, contrastando las capacidades existentes con los requerimientos administrativos del TUO de la Ley N° 27444 (LPAG), las directivas del Archivo General de la Nación (AGN) y las reglas institucionales del IESTP «Suiza».

### Criterios de Clasificación:
1. **`IMPLEMENTADA Y VERIFICADA`**: Funcionalidad con persistencia atómica en PostgreSQL, modelo TypeScript, endpoints REST con validación Zod, interfaz visual React funcional y pruebas unitarias/E2E aprobadas.
2. **`PARCIALMENTE IMPLEMENTADA`**: Existe estructura en backend o interfaz gráfica, pero carece de integración integral, modales completos, persistencia de metadatos o validaciones de negocio.
3. **`NO IMPLEMENTADA`**: Funcionalidad requerida que no cuenta con contrato REST, lógica de negocio ni componentes en frontend.
4. **`BLOQUEADA POR DEPENDENCIA EXTERNA`**: Funcionalidad que depende de servicios públicos externos (PIDE, RENIEC, INDECOPI, Págalo.pe) aún no suscritos mediante convenio marco.

---

## 2. MATRIZ DETALLADA DE FUNCIONALIDADES DE MESA DE PARTES

| N° | Submódulo / Funcionalidad | Base Legal / Criterio Operativo | Estado Actual | Brecha Identificada | Acción Correctiva de Implementación |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **4.1** | **Recepción de Expedientes** | | | | |
| 4.1.1 | Visualización de pendientes de recepción | Art. 136 LPAG | `IMPLEMENTADA Y VERIFICADA` | Filtrado en bandeja operativa por estado `REGISTRADO`. | Mantener y optimizar contador en tiempo real. |
| 4.1.2 | Bloqueo por período de espera legal (15 días hábiles) | Art. 143 LPAG | `IMPLEMENTADA Y VERIFICADA` | `exigirExpedienteHabilitadoParaRecepcion` rechaza con HTTP 409 `EXPEDIENTE_EN_ESPERA_LEGAL` durante días 1-14. | Mantener intacto el validador sin marcas artificiales. |
| 4.1.3 | Habilitación tras cumplimiento de 15 días | Art. 143 LPAG | `IMPLEMENTADA Y VERIFICADA` | En día 15 se habilita automáticamente con 0 días restantes. | Mantener y certificar con reloj controlado. |
| 4.1.4 | Consulta integral de CUT y administrado | Art. 124 LPAG | `IMPLEMENTADA Y VERIFICADA` | Muestra CUT, DNI, nombres/razón social, correo y teléfono. | Mantener. |
| 4.1.5 | Verificación de pago de tasa TUPA | TUPA 2026 | `IMPLEMENTADA Y VERIFICADA` | `COMPROBANTE_PAGO` enlazado con Tesorería; bloquea si pago está pendiente. | Mantener. |
| 4.1.6 | Registro formal de recepción por operador | Art. 136 LPAG | `PARCIALMENTE IMPLEMENTADA` | Endpoint `POST /api/v1/expedientes/:id/recepcionar` recibe `{}` sin canal ni folios. | Enriquecer DTO para capturar `canalRecepcion` (`PRESENCIAL`/`VIRTUAL`), folios y documentos. |
| 4.1.7 | Generación de cargo de recepción con QR y hash | Art. 136 LPAG | `PARCIALMENTE IMPLEMENTADA` | Solo existía cargo para ventanilla presencial inicial; faltaba cargo de recepción formal MP. | Implementar generación de Cargo de Recepción Formal con hash SHA-256 y URL de verificación QR. |
| 4.1.8 | Modal interactivo de recepción formal | UX Operativa | `PARCIALMENTE IMPLEMENTADA` | El botón ejecutaba acción directa sin modal de confirmación y foliatura. | Implementar `RecepcionFormalModal.tsx` con confirmación de canal, folios y cargo digital. |
| **4.2** | **Calificación Documental** | | | | |
| 4.2.1 | Consulta de requisitos TUPA del expediente | TUPA SUZ26-035 | `IMPLEMENTADA Y VERIFICADA` | `ChecklistTupa.tsx` lista requisitos y estado de cumplimiento. | Mantener. |
| 4.2.2 | Calificación manual (Cumple / No cumple) | Art. 136 LPAG | `IMPLEMENTADA Y VERIFICADA` | Endpoint `PUT /api/v1/expedientes/:id/checklist/:reqId` persiste en `sigd_doc.expediente_requisito`. | Mantener. |
| 4.2.3 | Transición a `EN_CALIFICACION` | FSM Institucional | `PARCIALMENTE IMPLEMENTADA` | Ocurría implícitamente al derivar, pero no con acción explícita del operador de MP. | Implementar endpoint/acción para declarar inicio y conclusión de calificación documental. |
| 4.2.4 | Declaración de Conformidad Documental | Art. 136 LPAG | `PARCIALMENTE IMPLEMENTADA` | No existía botón de cierre formal de calificación con registro de hito `CALIFICACION_DOCUMENTAL_CONFORME`. | Implementar acción y endpoint de declaración de conformidad documental registrando actuación inmutable. |
| **4.3** | **Expedientes Observados y Subsanación** | | | | |
| 4.3.1 | Formulación formal de observaciones | Art. 136 LPAG | `IMPLEMENTADA Y VERIFICADA` | `ObservacionModal.tsx` y `observaciones.service.ts` aplican regla de preclusión y plazo en días hábiles. | Mantener. |
| 4.3.2 | Notificación en Casilla Electrónica | Ley N° 31736 | `IMPLEMENTADA Y VERIFICADA` | Emisión de evento outbox y depósito en casilla del administrado. | Mantener. |
| 4.3.3 | Presentación de documentos subsanatorios | Art. 136 LPAG | `IMPLEMENTADA Y VERIFICADA` | `SubsanarVentanillaModal.tsx` registra subsanación sin sobrescribir documentos anteriores. | Mantener inmutabilidad documental. |
| 4.3.4 | Validación de subsanación por Mesa de Partes | Art. 136 LPAG | `PARCIALMENTE IMPLEMENTADA` | El operador no tenía vista explícita de "Aprobar Subsanación" vs "Reiterar Observación". | Implementar flujo de confirmación de subsanación con reapertura de calificación. |
| **4.4** | **Rechazo e Inadmisibilidad** | | | | |
| 4.4.1 | Registro de rechazo fundamentado | Art. 136 / 142 LPAG | `NO IMPLEMENTADA` | No existía endpoint ni modal para rechazar expedientes con plazo de subsanación vencido o improcedentes. | Implementar endpoint `POST /api/v1/expedientes/:id/rechazar` y modal `RechazoModal.tsx`. |
| 4.4.2 | Sustento normativo y responsable | Art. 142 LPAG | `NO IMPLEMENTADA` | Faltaba captura de base legal y proveído de rechazo formal. | Incorporar en schema y persistencia de movimiento resolutivo de rechazo. |
| **4.5** | **Derivación Documental** | | | | |
| 4.5.1 | Selección de unidad orgánica y proveído | ROF Institucional | `IMPLEMENTADA Y VERIFICADA` | `DerivacionModal.tsx` y `derivarExpediente` procesan la derivación atómica. | Mantener. |
| 4.5.2 | Constancia de derivación | Gestión Documental | `IMPLEMENTADA Y VERIFICADA` | Retorna ID de derivación y actualiza área actual a la unidad receptora. | Mantener. |
| 4.5.3 | Recepción obligatoria en destino | FSM Institucional | `IMPLEMENTADA Y VERIFICADA` | La unidad destino debe recepcionar formalmente (`DERIVADO` + `RECEPCION` $\rightarrow$ `EN_REVISION`). | Mantener el principio de no dar por recibido solo por envío. |
| **4.6** | **Bandejas y Paneles de Mesa de Partes** | | | | |
| 4.6.1 | Bandejas especializadas para Mesa de Partes | Ergonomía Operativa | `PARCIALMENTE IMPLEMENTADA` | Frontend solo presentaba 6 pestañas genéricas (`PENDIENTES`, `EN_TRAMITE`, etc.). | Implementar selector de bandejas especializadas con 12 vistas y contadores reales. |
| 4.6.2 | Contadores sincronizados con PostgreSQL | Invariante de Datos | `IMPLEMENTADA Y VERIFICADA` | `contador_pestana_local` y consultas dinámicas reflejan exactamente la base de datos. | Conectar contadores específicos de Mesa de Partes. |
| **4.7** | **Control de Roles y Responsabilidades (RBAC)** | | | | |
| 4.7.1 | Verificación de rol `MESA_PARTES` | Matriz RBAC | `IMPLEMENTADA Y VERIFICADA` | Permisos `EXPEDIENTE_RECEPCIONAR`, `EXPEDIENTE_CALIFICAR`, `EXPEDIENTE_OBSERVAR`, `EXPEDIENTE_DERIVAR`. | Mantener. |
| 4.7.2 | Bloqueo a operadores de otras unidades | Seguridad de Acceso | `IMPLEMENTADA Y VERIFICADA` | `ForbiddenError` si el operador no cuenta con adscripción y facultad activa. | Mantener. |

---

## 3. PLAN DE ACCIÓN INMEDIATO

1. **Backend:**
   - Enriquecer `RecepcionarExpedienteSchema` y `recepcionarExpediente` en `derivaciones.service.ts` para soportar canal de recepción (`PRESENCIAL`/`VIRTUAL`), foliatura y retorno de datos de cargo con QR/hash.
   - Implementar endpoint `POST /api/v1/expedientes/:id/rechazar` en `derivaciones.controller.ts` y servicio de rechazo fundamentado.
   - Implementar endpoint `POST /api/v1/expedientes/:id/conformidad-calificacion` para formalizar la calificación documental aprobada.
   - Implementar endpoint `GET /api/v1/mesa-partes/contadores` para consultar los 12 conteos de bandeja en una sola llamada optimizada.
2. **Frontend:**
   - Crear componente `RecepcionFormalModal.tsx` con confirmación de canal, folios y visualización de cargo.
   - Crear componente `RechazoModal.tsx` para rechazo o declaración de inadmisibilidad fundada.
   - Incorporar en `ChecklistTupa.tsx` el botón de "Declarar Conformidad Documental".
   - Incorporar en `BandejaExpedientesPage.tsx` el filtro rápido de bandejas de Mesa de Partes.
3. **Pruebas y Certificación:**
   - Ampliar suites unitarias para cubrir recepción enriquecida, rechazo formal y conformidad.
   - Ejecutar certificación E2E con expediente nuevo `EXP-2026-000211`.

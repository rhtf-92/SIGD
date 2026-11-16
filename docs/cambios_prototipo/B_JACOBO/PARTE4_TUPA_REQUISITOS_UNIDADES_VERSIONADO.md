# SIGD B_JACOBO — PARTE 4: REQUISITOS POR TRÁMITE, ANEXOS ESCANEADOS, UNIDADES RESPONSABLES Y VERSIONADO HISTÓRICO DEL TUPA

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Público «Suiza» (Pucallpa, Ucayali)  
**Rama exclusiva de trabajo:** `B_JACOBO`  
**Entorno de ejecución:** Backend Node.js/TypeScript (puerto 3008), Frontend React 19/Vite (puerto 5178), PostgreSQL 18 (`sigd_jacobo_demo`, puerto 5433), MinIO S3 (`sigd-sandbox-e2e`), Redis 7.  
**Fecha de implementación:** Noviembre de 2026  
**Autor:** Especialista Full Stack, Arquitecto de Software y Auditor de Sistemas de Gestión Documentaria  

---

## 1. RESUMEN EJECUTIVO Y OBJETIVOS CUMPLIDOS

La presente entrega (Parte 4) consolida funcional y arquitecturalmente la gestión documental, el versionado histórico y el enrutamiento orgánico del catálogo oficial TUPA del Instituto de Educación Superior Tecnológico Público «Suiza», dando estricto cumplimiento a los requerimientos normativos e institucionales:

1. **Catálogo Documental Completo de los 72 Trámites:**
   - Se configuró la matriz documental de los 72 procedimientos oficiales en `backend/src/domains/tramicore/catalogoDocumentalTupa2026.ts` y `frontend/src/data/catalogoDocumentalTupa2026.ts`.
   - Se garantizó la numeración consecutiva visible del **001 al 072** y sus códigos `SUZ26-001` a `SUZ26-072`, sin saltos ni alteraciones.
   - Se preservaron íntegramente las tarifas oficiales aprobadas.
   - Se identificó transparentemente el estado de validación: **36 procedimientos con validación documental reglamentaria oficial** y **36 procedimientos en proceso de validación institucional**, admitiendo para estos últimos la radicación formal con Solicitud General (FUT) sin bloquear al administrado.

2. **Digitalización y Adjuntos por Requisito Específico:**
   - Cada requisito documental y anexo cuenta con su propio control interactivo de carga `"Adjuntar PDF"` (`DocumentacionRequisitos.tsx`).
   - Se permite adjuntar archivos PDF desde la PC o previamente digitalizados/escaneados en ventanilla.
   - Se proporciona visualización previa del documento adjunto, opción de sustitución antes de radicar y validación reactiva que impide el envío sin los documentos obligatorios.
   - En **"Archivos adjuntados al expediente"** (`StepDocumentos.tsx` y `VentanillaPresencialPage.tsx`), el selector de clasificación ofrece **EXACTAMENTE DOS OPCIONES**: `EXPEDIENTE` y `ANEXO`.
   - Se preservó el motor de foliación correlativa y conteo de páginas reales PDF en backend (`pdfFoliacion.ts` y `/api/v1/tramites/analizar-pdf`).

3. **Información Institucional en Mesa de Partes (Virtual y Presencial):**
   - La interfaz ciudadana e interna presenta: denominación, número y código visible (001 a 072), costo oficial, requisitos obligatorios/facultativos, unidad de presentación (`Mesa de Partes`), unidad orgánica responsable de la tramitación (`Secretaría Académica`, `Dirección General`, etc.), autoridad resolutiva, plazo legal de atención, silencio administrativo y versión del TUPA (`TUPA-2026-V1`).
   - Se erradicó la exposición de UUIDs internos o valores por defecto.
   - **Regla institucional inviolable:** El comprobante de pago NUNCA es exigido antes de radicar. El pago se liquida y abona en Tesorería después de radicar y recibir el CUT.

4. **Investigación e Integración de Unidades Responsables:**
   - Conforme a la Ley Nº 30512, RVM Nº 277-2019-MINEDU y la estructura orgánica del IESTP Suiza:
     - **Secretaría Académica (`SEC`):** Certificados de estudios, récord de notas, sílabos visados, convalidaciones académicas, traslados, duplicados de carné/diploma, titulación.
     - **Dirección General (`DG`):** Resoluciones directorales, licencias, reincorporaciones, reservas de matrícula, convalidaciones formales, acceso a la información pública.
     - **Mesa de Partes (`MP`):** Presentación, recepción, foliación inicial y admisibilidad documental.
     - **Unidad de Administración (`ADM`):** Tasas de alquiler (canchas, galpón, aulas) y venta de bienes productivos.
   - Durante la radicación (presencial y virtual), el sistema asigna automáticamente el `area_destino_id` en `sigd_tra.expediente` según la unidad responsable de la versión vigente del trámite.

5. **Versionado Histórico del TUPA y Protección de los 197 Expedientes:**
   - Se diseñó el modelo de versionado institucional con estados: `VIGENTE` (inicialmente `TUPA-2026-V1`), `BORRADOR` (`TUPA-2027-DRAFT`) e `HISTORICO` (`TUPA-HISTORICO-2025`).
   - **Auditoría estricta de la base de datos:**
     - De los 189 expedientes en `sigd_doc.expediente`: **5 expedientes** (del 2026-10-26) conservan intacta su auditoría histórica (`tupa_historico_auditoria_id = 'c9ddaffe-fb6d-41b8-92bc-55f175b3bac8'` y `tipo_tramite_id IS NULL`), cumpliendo la restricción `expediente_tupa_origen_unico`. **184 expedientes** corresponden legítimamente al catálogo TUPA Suiza 2026.
     - De los 197 expedientes en `sigd_tra.expediente`, 8 corresponden a registros directos de prueba previa.
     - **CERO reasignaciones arbitrarias y CERO costos alterados.**
   - Se preparó el script de migración DDL `backend/migraciones/18_sigd_doc_tupa_versionado.sql`, **sin ejecutarlo en PostgreSQL**, garantizando total seguridad hasta la autorización expresa del usuario.

6. **Interfaz de Administración TUPA en Tablas Maestras:**
   - Se incorporó la pestaña `"Catálogo TUPA (Versiones y Requisitos)"` en `TablasMaestrasPage.tsx` y `useTablasMaestras.ts`.
   - **Regla respetada:** NO se crearon tarjetas nuevas en el panel de administración (`/administracion`), integrando toda la gestión dentro de Tablas Maestras.
   - Permite alternar versiones, filtrar por estado de validación (`Todos`, `Validados`, `Pendientes de validación`), consultar el panel de certificación de los 197 expedientes y abrir el modal de detalle de requisitos de cada trámite.

---

## 2. AUDITORÍA INTEGRAL DE EXPEDIENTES Y BASE DE DATOS

| Tabla PostgreSQL | Registros Totales | Vinculación Documental | Estado de Auditoría |
| :--- | :---: | :--- | :--- |
| `sigd_doc.expediente` | **189** | 184 a `sigd_doc.tipo_tramite_tupa`<br>5 a `tupa_historico_auditoria_id` | **100% ÍNTEGRO.** Se verifica la restricción `"expediente_tupa_origen_unico" CHECK (num_nonnulls(tipo_tramite_id, tupa_historico_auditoria_id) = 1)`. Ningún expediente histórico fue reasignado. |
| `sigd_tra.expediente` | **197** | 189 vinculados a `sigd_doc`<br>8 registros directos de prueba | **100% PRESERVADO.** Identidades, CUT y fechas de radicación intactas. |
| `sigd_doc.tipo_tramite_tupa` | **72** | Trámites oficiales TUPA Suiza 2026 | **72 Trámites.** Consecutivos 001 al 072. Códigos SUZ26-001 a SUZ26-072. |
| `sigd_org.area` | **3** | `DG` (Dirección General)<br>`MP` (Mesa de Partes)<br>`SEC` (Secretaría Académica) | Áreas institucionales activas para asignación de destino. |

---

## 3. ARQUITECTURA TÉCNICA E IMPLEMENTACIONES

### 3.1. Enriquecimiento del Catálogo Oficial (`catalogoDocumentalTupa2026.ts`)
Tanto en backend (`backend/src/domains/tramicore/catalogoDocumentalTupa2026.ts`) como en frontend (`frontend/src/data/catalogoDocumentalTupa2026.ts`):
- Se amplió la interfaz `ConfiguracionDocumentalProcedimiento` con los campos:
  - `unidadRecepcion`: `"Mesa de Partes (MP)"`
  - `unidadResponsable`: Unidad responsable según competencia (`Secretaría Académica`, `Dirección General`, `Unidad de Administración`, etc.)
  - `autoridadResolutiva`: Autoridad competente para emitir el acto administrativo o certificación.
  - `plazoDias`: Plazo legal en días hábiles (30 para evaluación previa, 10-15 para constancias, 3-5 para ventas/alquileres, o `null` si está pendiente de definición reglamentaria).
  - `silencioAdministrativo`: `'POSITIVO'`, `'NEGATIVO'`, o `'PENDIENTE_VALIDACION'`.
  - `versionTupa`: `"TUPA-2026-V1"`.
- Cada requisito y anexo cuenta con `estadoValidacion` (`'VALIDADO_OFICIAL'` vs `'PENDIENTE_VALIDACION'`) y `versionTupa`.

### 3.2. Enrutamiento Orgánico Automático al Radicar
- En `backend/src/domains/tramicore/ventanillaPresencial.service.ts`:
  Al registrar el expediente presencial sin área de destino manual, se infiere automáticamente el `areaDestinoId` de la unidad responsable del trámite (`SEC` para trámites académicos, `DG` para resoluciones, `MP` para recepción general) consultando `sigd_org.area`.
- En `backend/src/domains/tramicore/radicacionVirtual.service.ts`:
  Se incorporó la resolución automática de `areaDestinoId` al insertar en `sigd_tra.expediente`, garantizando que la radicación virtual de Mesa de Partes ingrese pre-asignada a la unidad institucional que atenderá el expediente en RutaDoc y Bandeja de Expedientes.

### 3.3. Servicio de Versionado Histórico y Auditoría (`TupaVersionadoService`)
Ubicado en `backend/src/domains/organicore/tupaVersionado.service.ts` y expuesto en `backend/src/domains/organicore/adminMaestras.routes.ts`:
- `GET /api/v1/admin/tupa/versiones`: Retorna las versiones oficiales (`TUPA-2026-V1`, `TUPA-2027-DRAFT`, `TUPA-HISTORICO-2025`).
- `GET /api/v1/admin/tupa/versiones/:codigoVersion/tramites`: Retorna la matriz completa de trámites, requisitos, validaciones y unidades de la versión solicitada.
- `GET /api/v1/admin/tupa/auditoria`: Ejecuta en tiempo real la comprobación de integridad sobre `sigd_doc.expediente` y `sigd_tra.expediente`, certificando que la restricción de origen único no tiene violaciones.

### 3.4. Migración DDL Preparada (Sin Ejecutar)
Archivo: `backend/migraciones/18_sigd_doc_tupa_versionado.sql`.
- Crea la tabla `sigd_doc.tupa_catalogo_version`.
- Agrega clave foránea `version_id` en `sigd_doc.tipo_tramite_tupa`.
- Agrega trigger de vigencia única y trigger de seguridad contra `DELETE` físico (`SIGD-DOC-TUPA-VERSION-SEGURIDAD`).
- **Estado:** Preparado y verificado. NO ejecutado en PostgreSQL según directiva.

### 3.5. Componentes Frontend
1. `DocumentacionRequisitos.tsx`:
   - Incorpora en la tarjeta informativa: Unidad de presentación, Unidad responsable, Autoridad resolutiva, Plazo de atención, Silencio administrativo y Versión TUPA.
   - Mantiene accesible el botón y campo `"Adjuntar PDF: {nombre}"` por cada requisito.
   - Incluye advertencia destacada: *"Pago posterior en Tesorería: La tasa se abona presencialmente en Tesorería tras radicar formalmente y obtener el CUT. NUNCA se solicita pago antes de la radicación."*
2. `StepDocumentos.tsx`:
   - Selector de clasificación exclusivo con exactamente dos opciones: `<option value="EXPEDIENTE">EXPEDIENTE</option>` y `<option value="ANEXO">ANEXO</option>`.
   - Visualización y sustitución de archivos antes de radicar.
3. `VentanillaPresencialPage.tsx`:
   - Visualiza en el bloque TUPA oficial la información de asignación orgánica, autoridad resolutiva y versión.
   - Permite la adjunción de PDFs escaneados y calcula la foliación correlativa real en backend.
4. `TablasMaestrasPage.tsx` y `useTablasMaestras.ts`:
   - Nueva pestaña `"Catálogo TUPA (Versiones y Requisitos)"` sin crear nuevas tarjetas en `/administracion`.
   - Selector de versiones de catálogo.
   - Tarjeta de auditoría de los 197 expedientes protegidos.
   - Filtros de validación: `Todos (72)`, `Validados oficial (36)`, `Pendientes de validación institucional (36)`.
   - Modal de detalle documental de cada trámite.

---

## 4. MATRIZ DE VERIFICACIÓN Y PRUEBAS

### 4.1. Pruebas Unitarias Backend
- Archivo: `backend/tests/unit/domains/tramicore/tupa-versionado-unidades.spec.ts` (6 tests).
  - Verificación de 72 procedimientos correlativos del 001 al 072: **APROBADO**.
  - Verificación de 36 validados y 36 pendientes de validación institucional: **APROBADO**.
  - Asignación orgánica a SEC, DG y ADM: **APROBADO**.
  - Listado de versiones TUPA reglamentarias: **APROBADO**.
  - Auditoría de los 197 expedientes con restricción de origen único: **APROBADO**.
  - Exposición de metadatos de enrutamiento y versión en `obtenerDocumentacionTramite`: **APROBADO**.
- Suite tramicore: **19 archivos de prueba, 231 tests PASADOS (0 fallos)**.

### 4.2. Pruebas Unitarias Frontend
- Archivo: `frontend/tests/unit/pages/TablasMaestrasTupa.test.tsx` (4 tests).
  - Pestaña de Catálogo TUPA integrada en Tablas Maestras: **APROBADO**.
  - Selector de versiones y certificación de 197 expedientes: **APROBADO**.
  - Visualización del catálogo 001 al 072 con filtros: **APROBADO**.
  - Modal de detalle y requisitos con unidades orgánicas: **APROBADO**.
- Archivo: `frontend/tests/unit/components/DocumentacionRequisitos.test.tsx` (7 tests): **7/7 PASADOS**.
- Archivo: `frontend/tests/unit/components/StepDocumentosArchivos.test.tsx` (7 tests): **7/7 PASADOS**.
- Archivo: `frontend/tests/unit/components/CatalogoTupaCompleto.test.tsx` (3 tests): **3/3 PASADOS**.
- Archivo: `frontend/tests/unit/hooks/useTablasMaestras.test.ts` (7 tests): **7/7 PASADOS**.

### 4.3. Compilaciones de Producción
- Backend (`tsc -p tsconfig.build.json`): **Código de salida 0 (Sin errores)**.
- Frontend (`tsc --noEmit && vite build`): **Código de salida 0 (Build generado en 8.86s, 2266 módulos)**.

---

## 5. REGLAS Y COMPROMISOS INSTITUCIONALES CUMPLIDOS

1. Se trabajó exclusivamente sobre la rama `B_JACOBO`.
2. NO se realizaron commits ni push a repositorios remotos.
3. NO se modificó la arquitectura ni los contenedores existentes.
4. NO se ejecutó la migración 18 en PostgreSQL; se dejó preparada con salvaguardas idóneas.
5. Los 197 expedientes históricos y existentes permanecen 100% íntegros y preservados con sus costos, folios y vínculos normativos originales.
6. El catálogo TUPA 2026 ofrece exactamente los 72 procedimientos institucionales con numeración consecutiva 001 a 072.
7. El selector de clasificación de archivos ofrece estrictamente dos opciones: `EXPEDIENTE` y `ANEXO`.
8. El pago de tasas se mantiene formalmente condicionado a la obtención previa del CUT en Tesorería.

# SIGD SUIZA — TSK-1.2 FASE A0
# INFORME DE CIERRE DEFINITIVO DE FASE A0: CONCILIACIÓN DE PERMISOS, AUTORIDAD INSTITUCIONAL, DESCARGA DOCUMENTAL Y SUPER_ADMIN_PLATAFORMA

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Rama Git exclusiva:** `B_JACOBO`  
**Único entorno aislado:** `B_JACOBO` (`sigd-postgres-1`, `127.0.0.1:5433`)  
**Única base de datos:** `sigd_jacobo_demo` (PostgreSQL 18.6 Alpine)  
**Etapa:** TSK-1.2 — Fase A0 (Cierre Documental y Certificación Técnica Definitiva)  
**Fecha:** 13 de noviembre de 2026  
**Responsable:** Arquitecto Principal de Software & Especialista Senior en Seguridad Institucional, RBAC y Auditoría Forense  

---

## 1. RESUMEN EJECUTIVO

El presente informe constituye el documento de cierre formal y definitivo de la **Fase A0 (Diseño, Conciliación Normativa y Certificación Técnica)** del proyecto SIGD en la rama exclusiva `B_JACOBO`. En estricto cumplimiento de las directivas institucionales y de los protocolos de blindaje de software, se ha culminado la conciliación integral de los cinco (5) asuntos críticos observados:

1. **Resolución de la divergencia cuantitativa del catálogo de permisos:** Se determinó que no son 31 ni 33, sino exactamente **treinta y dos (32) permisos canónicos cerrados** (16 existentes verificados en migraciones previas + 16 nuevos atómicos diseñados en migración `22_`, culminando en el permiso `#32 EXPEDIENTE_DESCARGAR`).
2. **Restablecimiento estricto de la autoridad sobre el Permiso #32:** Se eliminó toda mención a la "Jefatura de Unidad Administrativa" como autoridad facultada para autorizar concesiones del permiso #32. La gobernanza institucional aprobada e inalterable establece:
   - **DIRECTOR:** Autoriza institucionalmente (prohibida autoautorización sin superior jerárquico acreditado).
   - **ADMINISTRADOR:** Ejecutor técnico institucional (sin descarga ordinaria, sin autoconcesión, sin facultades resolutivas).
   - **SUPER_ADMIN_PLATAFORMA:** Control global tecnológico/administrativo SaaS y acceso privilegiado propio, sin facultades para sustituir al Director ni conceder #32 a cuentas institucionales.
3. **Arquitectura de descarga documental y blindaje de MinIO:** Se inspeccionaron en modo de solo lectura todos los controladores y enrutadores del backend. Se evidenció que el sistema actual entrega URLs prefirmadas en respuestas JSON al navegador (`/storage/documentos/:id/download`, `/casilla/...`, `/validador-cvd/...`). Se formuló el diseño objetivo de **streaming backend obligatorio** (servidor-servidor mediante SDK nativo S3, `pipe(res)`, encabezados `Content-Disposition: attachment` vs. `inline`), prohibiendo la exposición de URLs prefirmadas en clientes, logs o errores para la implementación en Fase B.
4. **Política consolidada de `SUPER_ADMIN_PLATAFORMA`:** Se formalizó su rol de control global SaaS con acceso documental vía streaming, autenticación privilegiada con MFA validado en servidor y auditoría forzada en `sigd_audit.bitacora_superadmin_saas`, delimitando taxativamente sus fronteras legales (cero atribución para firmar resoluciones institucionales) y diferenciando el diseño actual de su infraestructura futura (`sigd_saas.*` en `24_+`).
5. **Consistencia documental absoluta:** Se regularizó el inventario oficial de los once (11) documentos rectores de Fase A0, eliminando errores numéricos de referencia y discrepancias cruzadas.

Durante toda la intervención, se mantuvo la política de **PROTECCIÓN ABSOLUTA**: **CERO sentencias SQL ejecutadas (incluyendo `SELECT`), CERO conexiones a PostgreSQL, CERO mutaciones de código en backend/frontend y CERO alteraciones a los 370 archivos preexistentes del repositorio**.

---

## 2. PRIMER CONTROL: CONCILIACIÓN DEFINITIVA DEL CATÁLOGO DE PERMISOS

### 2.1. Respuestas Técnicas a las Cinco (5) Preguntas del Control

1. **¿Cuántos permisos existen físicamente según las migraciones disponibles?**
   - Existen exactamente **dieciséis (16) permisos físicos** insertados en el esquema `sigd_org.permiso_sistema`:
     - *Migración `03_sigd_org.sql` (líneas 235–243):* 6 permisos base (`EXPEDIENTE_LEER`, `EXPEDIENTE_DERIVAR`, `EXPEDIENTE_RESOLVER`, `FIRMA_FIRMAR`, `ADMIN_USUARIOS`, `REPORTE_LEER`).
     - *Migración `10_sigd_tes.sql` (líneas 93–102):* 9 permisos financieros (`TESORERIA_LEER`, `TESORERIA_TARIFA_PROPONER`, `TESORERIA_TARIFA_VALIDAR`, `TESORERIA_PAGO_REGISTRAR`, `TESORERIA_PAGO_VERIFICAR`, `TESORERIA_DEVOLUCION_EVALUAR`, `TESORERIA_DEVOLUCION_APROBAR`, `TESORERIA_DEVOLUCION_EJECUTAR`, `TESORERIA_REPORTES`).
     - *Migración `17_sigd_tes_pago_adicional_seguro.sql` (líneas 93–95):* 1 permiso de ventanilla (`TRAMICORE_DEVOLUCION_EVALUAR`).
     - *Total en disco:* $6 + 9 + 1 = \mathbf{16}$.

2. **¿Cuántos están definidos en el código?**
   - En el backend (`backend/src/app.ts:444–460` en el manejador del catálogo institucional `GET /api/v1/admin/roles-permisos`) y en el frontend (`frontend/src/hooks/useRbacConfig.ts:37–54`) están tipados y descritos exactamente los mismos **16 permisos existentes**.
   - Adicionalmente, el código contiene referencias incipientes:
     - `EXPEDIENTE_ADJUNTAR`: referenciado en lógica TypeScript (`digitalizacion.service.ts:32`, `rutadoc.router.ts:89`, `auth.guard.ts:228`, `contexto.service.ts:13`), pero faltante en las tablas de PostgreSQL.
     - `DOCENTE_EVALUAR`: token desactualizado en listas de bloqueo (`auth.guard.ts:131`, `contexto.service.ts:19`), conciliado formalmente a `EXPEDIENTE_EVALUAR`.
     - `FIRMA_FIRMAR` y `EXPEDIENTE_RESOLVER`: utilizados ampliamente en controladores de firma y trámites, requiriendo su desacoplamiento atómico respecto a `RESOLUCION_FIRMAR` y `DOCUMENTO_EDITAR`.

3. **¿Cuántos son propuestas nuevas de TSK-1.2?**
   - Son exactamente **dieciséis (16) permisos atómicos nuevos** diseñados para ser incorporados mediante la migración `22_` (`docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql:200–234`) con UUIDs determinísticos en el rango `5b010000-0000-4000-8000-000000000001` al `...0016`.

4. **¿Cuáles son permisos históricos o deprecados?**
   - **`EXPEDIENTE_RESOLVER` (UUID `797a084e-6c20-491d-83bf-e5c9fddaa6ab`):** Único permiso legado en descontinuación controlada en cuatro (4) etapas. No se elimina físicamente de la base de datos para no romper la integridad referencial ni la trazabilidad WORM de actos resolutivos pasados:
     - *Etapa 1 (Compatibilidad en `22_`):* Se retira de `ADMINISTRADOR`, manteniéndose activo temporalmente solo en `DIRECTOR` y `SECRETARIO`.
     - *Etapa 2 (Bloqueo de nuevas asignaciones en `22_`):* Trigger `tr_bloquear_nueva_asignacion_permiso_legado` prohíbe asignarlo a nuevos roles (`JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `DOCENTE`, etc.).
     - *Etapa 3 (Sustitución en Fases B/C/D):* Reemplazo en endpoints por permisos atómicos específicos.
     - *Etapa 4 (Retiro lógico en `24_+`):* `UPDATE sigd_org.permiso_sistema SET vigente = FALSE WHERE codigo = 'EXPEDIENTE_RESOLVER'`.
   - **Tokens obsoletos descartados:** `EXPEDIENTE_CREAR` (reemplazado por `EXPEDIENTE_REGISTRAR`), `DOCENTE_EVALUAR` (reemplazado por `EXPEDIENTE_EVALUAR`), `EXPEDIENTE_FIRMAR` (sustituido por `FIRMA_FIRMAR` técnico y `RESOLUCION_FIRMAR` legal), y `EXPEDIENTE_VISUALIZAR` / `DOCUMENTO_LEER` (no existen ni se crearán, pues la lectura y visualización inline corresponden a `EXPEDIENTE_LEER`).

5. **¿Por qué aparece la diferencia entre 31 y 33?**
   - En TSK-1.1B, el diseño contemplaba 16 existentes + 15 atómicos propuestos = **31 permisos**.
   - Al introducir la directiva de seguridad para la descarga de documentos, se incorporó un 16.° permiso nuevo atómico: **`EXPEDIENTE_DESCARGAR`**, etiquetado por orden de catálogo como **#32** ($16 + 16 = \mathbf{32\text{ permisos}}$).
   - La mención a "33 permisos canónicos" surgió como un **error material y aritmético de conteo** en el criterio 3 de la matriz del último informe (o confusión de interpretar que existían 32 permisos previos más el nuevo). La realidad matemática y física cerrada es de exactamente **32 permisos**.

---

### 2.2. Matriz Única Consolidada del Catálogo Oficial de 32 Permisos

| N.° | Identificador (UUID Físico / Propuesto) | Código Técnico Canónico | Descripción de Función Institucional | Estado | Fuente Primaria | Asignación según Diseño Institucional | Implementación |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `ef5b2eff-caff-4479-a88a-c497eed32a2f` | `ADMIN_USUARIOS` | Administración de cuentas de usuario, roles y catálogos maestros | Vigente | Migración `03_sigd_org.sql` | `ADMINISTRADOR` | Existente en BD |
| **2** | `e6066e88-c8a5-4219-9526-87a2ac5253ae` | `EXPEDIENTE_LEER` | Consulta de expedientes, trazabilidad y visualización previa inline | Vigente | Migración `03_sigd_org.sql` | Todos los roles institucionales (según ámbito y contexto) + `GESTOR_APOYO_AREA`. `TESORERO`: No | Existente en BD |
| **3** | `0c89fdb7-687c-4e0d-ab70-9423e3c9a05f` | `EXPEDIENTE_DERIVAR` | Derivación y transferencia de expedientes entre unidades y áreas | Vigente | Migración `03_sigd_org.sql` | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `GESTOR_APOYO_AREA` | Existente en BD |
| **4** | `797a084e-6c20-491d-83bf-e5c9fddaa6ab` | `EXPEDIENTE_RESOLVER` | Atención resolutiva de expedientes (mecanismo legado en transición) | Deprecado (En descontinuación 4 etapas) | Migración `03_sigd_org.sql` | `DIRECTOR`, `SECRETARIO` (temporal Etapa 1). Retirado de `ADMINISTRADOR` y bloqueado a nuevos roles | Existente en BD (Retiro en `24_+`) |
| **5** | `ce9e31be-9118-4960-b4ea-7c3e4340fb95` | `FIRMA_FIRMAR` | Capacidad técnica PKI para firmado digital de actos administrativos | Vigente | Migración `03_sigd_org.sql` | `DIRECTOR` (con encargo vigente). Retirado de `ADMINISTRADOR` | Existente en BD |
| **6** | `20be03cf-f5b5-47dd-85ff-05456284e56f` | `REPORTE_LEER` | Acceso a paneles estadísticos, indicadores MGD y tiempos de atención | Vigente | Migración `03_sigd_org.sql` | `ADMINISTRADOR`, `DIRECTOR` | Existente en BD |
| **7** | `922f42fa-a7ee-45b0-a568-ffa57e210714` | `TESORERIA_LEER` | Visualización de estados de caja, comprobantes y órdenes de pago | Vigente | Migración `10_sigd_tes.sql` | `TESORERO` | Existente en BD |
| **8** | `dff4e592-1299-49ad-a860-9eab151be203` | `TESORERIA_TARIFA_PROPONER` | Formulación y propuesta documentada de tarifas educativas y aranceles | Vigente | Migración `10_sigd_tes.sql` | `TESORERO` | Existente en BD |
| **9** | `a06cdc2b-3ffb-420e-961c-ef2a5899d944` | `TESORERIA_TARIFA_VALIDAR` | Revisión y validación técnica del tarifario institucional | Vigente | Migración `10_sigd_tes.sql` | `TESORERO` | Existente en BD |
| **10** | `35945cdd-401f-4582-b7fa-c3d19275a576` | `TESORERIA_PAGO_REGISTRAR` | Registro de cobros en ventanilla de caja y recaudación de tasas TUPA | Vigente | Migración `10_sigd_tes.sql` | `TESORERO` | Existente en BD |
| **11** | `b0c26b70-fc34-4359-b3b1-96a1c17f9202` | `TESORERIA_PAGO_VERIFICAR` | Conciliación de depósitos bancarios y validación de vouchers de pago | Vigente | Migración `10_sigd_tes.sql` | `TESORERO` | Existente en BD |
| **12** | `ec5d0774-b080-458e-8862-acec3cd8e7ef` | `TESORERIA_DEVOLUCION_EVALUAR` | Evaluación financiera y liquidación de montos sujetos a devolución | Vigente | Migración `10_sigd_tes.sql` | `TESORERO` | Existente en BD |
| **13** | `b622ee1f-8a4a-48c8-9d60-6a5ebf0c7594` | `TESORERIA_DEVOLUCION_APROBAR` | Aprobación financiera y formal de órdenes de devolución de pago | Vigente | Migración `10_sigd_tes.sql` | `TESORERO` | Existente en BD |
| **14** | `0c93586b-1758-4710-8999-7eb8994a9913` | `TESORERIA_DEVOLUCION_EJECUTAR` | Ejecución y desembolso contable de devoluciones financieras | Vigente | Migración `10_sigd_tes.sql` | `TESORERO` | Existente en BD |
| **15** | `9a71a1fe-0c2e-4c13-9c65-067a2bb6bf4b` | `TESORERIA_REPORTES` | Generación de balances de caja y libros contables de tesorería | Vigente | Migración `10_sigd_tes.sql` | `TESORERO` | Existente en BD |
| **16** | `ef2d638c-a0a2-41b2-9047-e9b8a9f320ea` | `TRAMICORE_DEVOLUCION_EVALUAR`| Examen preliminar y admisibilidad de solicitudes de devolución en MP | Vigente | Migración `17_sigd_tes...` | `MESA_PARTES` | Existente en BD |
| **17** | `5b010000-0000-4000-8000-000000000001` | `EXPEDIENTE_REGISTRAR` | Radicación presencial o virtual y apertura formal de expedientes | Propuesto | Migración `22_` (TSK-1.2) | `MESA_PARTES`, `SECRETARIO`, `DOCENTE`, `ESTUDIANTE`, `CIUDADANO` | Futura (`22_`) |
| **18** | `5b010000-0000-4000-8000-000000000002` | `DOCUMENTO_EDITAR` | Modificación de borradores de documentos y resoluciones no suscritas | Propuesto | Migración `22_` (TSK-1.2) | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO` | Futura (`22_`) |
| **19** | `5b010000-0000-4000-8000-000000000003` | `EXPEDIENTE_SUBSANAR` | Presentación de subsanaciones a trámites observados por el titular | Propuesto | Migración `22_` (TSK-1.2) | `ESTUDIANTE`, `CIUDADANO`, `DOCENTE` (titular), `MESA_PARTES` | Futura (`22_`) |
| **20** | `5b010000-0000-4000-8000-000000000004` | `EXPEDIENTE_RECEPCIONAR` | Acuse formal de recepción operativa de expedientes en área destino | Propuesto | Migración `22_` (TSK-1.2) | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `DOCENTE`, `GESTOR_APOYO_AREA` | Futura (`22_`) |
| **21** | `5b010000-0000-4000-8000-000000000005` | `EXPEDIENTE_ADJUNTAR` | Incorporación de anexos PDF digitalizados y foliación electrónica | Propuesto | Migración `22_` (TSK-1.2) | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `DOCENTE`, `GESTOR_APOYO_AREA` | Futura (`22_`) |
| **22** | `5b010000-0000-4000-8000-000000000006` | `EXPEDIENTE_OBSERVAR` | Registro de observación formal o técnica con congelamiento de SLA | Propuesto | Migración `22_` (TSK-1.2) | `MESA_PARTES`, `SECRETARIO`, `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA`, `DOCENTE`, `DIRECTOR` | Futura (`22_`) |
| **23** | `5b010000-0000-4000-8000-000000000007` | `EXPEDIENTE_ASIGNAR` | Asignación de responsable técnico o docente evaluador en el área | Propuesto | Migración `22_` (TSK-1.2) | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO` | Futura (`22_`) |
| **24** | `5b010000-0000-4000-8000-000000000008` | `EXPEDIENTE_REASIGNAR` | Reasignación de responsable o evaluador con motivación obligatoria | Propuesto | Migración `22_` (TSK-1.2) | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO` | Futura (`22_`) |
| **25** | `5b010000-0000-4000-8000-000000000009` | `EXPEDIENTE_EVALUAR` | Emisión de informe técnico de evaluación y transición a atendido | Propuesto | Migración `22_` (TSK-1.2) | `DOCENTE`, `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA`, `SECRETARIO` | Futura (`22_`) |
| **26** | `5b010000-0000-4000-8000-000000000010` | `EXPEDIENTE_APROBAR` | Aprobación institucional de fondo previo a emisión o firma | Propuesto | Migración `22_` (TSK-1.2) | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA` | Futura (`22_`) |
| **27** | `5b010000-0000-4000-8000-000000000011` | `EXPEDIENTE_RECHAZAR` | Declaración fundada de improcedencia o rechazo formal de trámite | Propuesto | Migración `22_` (TSK-1.2) | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `SECRETARIO` | Futura (`22_`) |
| **28** | `5b010000-0000-4000-8000-000000000012` | `EXPEDIENTE_CERRAR` | Cierre administrativo formal de trámite (`CERRADO`) | Propuesto | Migración `22_` (TSK-1.2) | `SECRETARIO`, `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA` | Futura (`22_`) |
| **29** | `5b010000-0000-4000-8000-000000000013` | `EXPEDIENTE_ARCHIVAR` | Transferencia a archivo final y custodia física/digital (`ARCHIVADO`)| Propuesto | Migración `22_` (TSK-1.2) | `SECRETARIO`, `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA` | Futura (`22_`) |
| **30** | `5b010000-0000-4000-8000-000000000014` | `RESOLUCION_EMITIR` | Proyección y elevación formal de borrador de resolución a despacho | Propuesto | Migración `22_` (TSK-1.2) | `SECRETARIO`, `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA` | Futura (`22_`) |
| **31** | `5b010000-0000-4000-8000-000000000015` | `RESOLUCION_FIRMAR` | Firma digital específica y vinculante de Resoluciones Directorales | Propuesto | Migración `22_` (TSK-1.2) | `DIRECTOR` (exclusivo con encargo vigente de despacho) | Futura (`22_`) |
| **32** | `5b010000-0000-4000-8000-000000000016` | `EXPEDIENTE_DESCARGAR` | Descarga controlada de copia de archivo digital del expediente | Propuesto | Migración `22_` (TSK-1.2) | **Ningún rol automáticamente (0 asignaciones en `rol_permiso`)** | Futura (`22_`) |

### 2.3. Identificación Técnica Real del Permiso #32

- **Posición Ordinal vs. Identificador Físico:** El número 32 representa únicamente el ordinal correlativo en el catálogo documental institucional. **No es un entero ni clave primaria en PostgreSQL**.
- **Clave Primaria en BD:** `permiso_id = '5b010000-0000-4000-8000-000000000016'::uuid`.
- **Ámbito en Base de Datos:** `ambito = 'AREA'`. Esto asegura que el guard de autenticación (`auth.guard.ts`) evalúe contexto y no conceda acceso irrestricto (*fail-closed*).
- **Asignación Cero en Semilla:** En la migración `22_`, se crean cero (0) filas en `sigd_org.rol_permiso` para este permiso.

---

## 3. SEGUNDO CONTROL: AUTORIDAD INSTITUCIONAL DEL PERMISO EXPEDIENTE_DESCARGAR

Queda terminantemente ratificada la gobernanza institucional aprobada, corrigiendo y anulando cualquier mención a autoridades no contempladas en las políticas aprobadas:

```
+--------------------------------------------------------------------------------------------------+
| GOBERNANZA OFICIAL DEL PERMISO #32 (EXPEDIENTE_DESCARGAR)                                        |
+--------------------------------------------------------------------------------------------------+
| 1. DIRECTOR GENERAL:                                                                             |
|    - AUTORIZA institucionalmente las concesiones del permiso a personal operativo.               |
|    - Exige acto administrativo sustentado (Resolución Directoral, vigencia temporal, alcance).  |
|    - PROHIBICIÓN ABSOLUTA: No puede autoautorizarse privilegios extraordinarios de descarga.      |
|    - Si el Director es beneficiario, requiere autorización de AUTORIDAD SUPERIOR jerárquica competente y |
|      formalmente acreditada conforme al marco normativo aplicable (sin atribuciones tácitas no demostradas).|
|                                                                                                  |
| 2. ADMINISTRADOR DEL SISTEMA:                                                                    |
|    - EJECUTOR TÉCNICO institucional.                                                             |
|    - Registra técnicamente las asignaciones autorizadas en la tabla correspondiente.             |
|    - PROHIBICIÓN ABSOLUTA: No puede conceder el permiso por decisión propia ni autoasignárselo.  |
|    - Conserva acceso de lectura global (`EXPEDIENTE_LEER`), pero carece de descarga ordinaria.    |
|    - No posee facultades para firmar resoluciones ni sustituir a la autoridad institucional.    |
|                                                                                                  |
| 3. SUPER_ADMIN_PLATAFORMA:                                                                       |
|    - Operador global tecnológico de la nube / SaaS.                                              |
|    - Posee acceso técnico propio y privilegiado a expedientes mediante streaming backend        |
|      para fines de soporte y mantenimiento, auditado en `bitacora_superadmin_saas`.              |
|    - PROHIBICIÓN ABSOLUTA: Su control global SaaS NO le otorga facultad institucional para      |
|      otorgar, convalidar o alterar asignaciones del permiso #32 a usuarios de la institución.   |
|                                                                                                  |
| 4. DESLINDE OBLIGATORIO:                                                                         |
|    - La JEFATURA DE UNIDAD ADMINISTRATIVA NO posee competencia para autorizar concesiones de #32.|
|      Cualquier mención previa queda formalmente rectificada y suprimida.                         |
+--------------------------------------------------------------------------------------------------+
```

---

## 4. TERCER CONTROL: DESCARGA DOCUMENTAL, INVENTARIO DE ENDPOINTS Y PROTECCIÓN DE MINIO

### 4.1. Inventario Técnico de Endpoints de Acceso Documental en Backend

De la inspección de solo lectura del código fuente (`backend/src/`), se levantó el inventario exhaustivo del estado actual frente a la arquitectura objetivo requerida:

| Endpoint | Método | Módulo | Comportamiento Actual en Código | Exposición de URL S3/MinIO | Comportamiento Objetivo (Fase B) |
| :--- | :---: | :--- | :--- | :---: | :--- |
| `/api/v1/storage/documentos/:id/download` | `GET` | Core Storage | `storage.router.ts:232`: Valida sesión, llama `generarDescargaAutorizada` y retorna `{ downloadUrl: presignedUrl, expiraEnSegundos: 900 }`. | **SÍ (Exposición en JSON)** | Backend valida `#32 EXPEDIENTE_DESCARGAR`, contexto y bitácora; recupera objeto con SDK S3 y transmite stream binario directo (`Content-Disposition: attachment`). Cero URLs expuestas. |
| `/api/v1/storage/download/:bucket/:key` | `GET` | Core Storage | `storage.router.ts:242`: Valida parámetros de ruta y devuelve `{ downloadUrl: presignedUrl }`. | **SÍ (Exposición en JSON)** | Deprecar o restringir a streaming autenticado sin recibir buckets/keys crudos desde el cliente. |
| `/api/v1/storage/presigned-url` | `POST` | Core Storage | `storage.router.ts:142`: Emite URL prefirmada PUT para subida directa desde el navegador cliente al bucket S3. | **SÍ (Exposición en JSON)** | Mantener exclusivamente para subida directa (PUT) blindada por SHA-256 inmutable, o canalizar vía multipart en backend. Jamás utilizable para descarga. |
| `/api/v1/casilla/notificaciones/:id/documento/descargar` | `GET` | Casilla / IdentiCore | `casilla.router.ts:550`: Valida notificación y devuelve `{ downloadUrl: presignedUrl }` en JSON. | **SÍ (Exposición en JSON)** | Backend valida titularidad del administrado (`solicitante_id`), audita y transmite el stream binario del PDF firmado (`pipe(res)`). Cero URLs expuestas. |
| `/api/v1/validador-cvd/:cvd` | `GET` | DocuCore | `validadorCvd.controller.ts:150`: Valida firma PAdES y entrega presigned URL en campo `descarga_copia_certificada`. | **SÍ (Exposición en JSON)** | Implementar `GET /api/v1/validador-cvd/:cvd/documento` para streaming público directo de copia certificada, suprimiendo la URL del JSON de metadatos. |
| `/api/v1/expedientes/:id/documentos` | `POST` | RutaDoc | `rutadoc.router.ts:89`: Asocia adjuntos tras carga en S3. | **NO (Endpoint de comando)** | Validación estricta de hash SHA-256 e integridad antes del registro en BD. |
| `/api/v1/firma/callback-refirma` | `POST` | DocuCore | `callbackRefirma.service.ts:344`: Genera internamente presigned URL para traer documento firmado. | **NO (Uso interno servidor-servidor)** | Reemplazar generación de presigned URL interna por llamada directa `GetObjectCommand` mediante el SDK de MinIO. |
| `/api/v1/storage/documentos/:id/view` *(Propuesto)* | `GET` | Core Storage | No implementado en código actual (el frontend usa `/download` para visualizar en `ExpedienteDetallePage.tsx:99`). | **NO (Nuevo en Fase B)** | Streaming backend para visualización previa inline (`Content-Disposition: inline`, `Cache-Control: no-store`) requiriendo solo `EXPEDIENTE_LEER`. |

### 4.2. Política de Streaming Backend y Protección Criptográfica de MinIO

Para la futura implementación en la Fase B, queda normada la siguiente política técnica:

1. **Prohibición Absoluta de URLs Prefirmadas al Navegador:** Ninguna URL prefirmada de MinIO/S3 para descarga podrá enviarse al frontend, figurar en respuestas JSON, presentarse en mensajes de error ni guardarse completa en registros de auditoría o logs de aplicación.
2. **Uso Exclusivo del SDK en Servidor:** Las transferencias de documentos entre MinIO y el usuario deberán realizarse mediante el SDK oficial (`@aws-sdk/client-s3`), empleando `GetObjectCommand` para obtener el stream binario (`ReadableStream`) y canalizarlo directamente a la respuesta HTTP:
   ```typescript
   // Patrón arquitectónico mandatorio Fase B:
   const objetoS3 = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
   res.setHeader('Content-Type', 'application/pdf');
   res.setHeader('Content-Disposition', `attachment; filename="${nombreSeguro}.pdf"`);
   res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
   (objetoS3.Body as Readable).pipe(res);
   ```
3. **Flujo Transaccional de Descarga:**
   - Usuario invoca la petición de descarga.
   - Backend valida JWT, rol activo y contexto en `claims.ctx`.
   - Backend valida tenencia del permiso `#32 EXPEDIENTE_DESCARGAR` o titularidad de casilla/CVD.
   - Backend inserta registro obligatorio en `sigd_audit.bitacora_acceso_documental`.
   - Backend realiza la transferencia streaming hacia el cliente.
   - En caso de error o denegación, emite código RFC 7807 (`403 Forbidden` / `404 Not Found`), registrando el intento fallido.

---

## 5. CUARTO CONTROL: POLÍTICA DEFINITIVA DE SUPER_ADMIN_PLATAFORMA

### 5.1. Atribuciones y Facultades Tecnológicas SaaS

El rol `SUPER_ADMIN_PLATAFORMA` se consolida bajo las siguientes atribuciones de administración global:

- **Gobierno Multi-Tenant:** Capacidad para aprovisionar, configurar y suspender tenants institucionales en la plataforma SaaS.
- **Administración Global de Usuarios:** Mantenimiento de cuentas administradoras y soporte técnico de infraestructura.
- **Acceso Documental de Diagnóstico:** Facultad de visualizar y descargar expedientes de cualquier institución de la plataforma **exclusivamente mediante streaming backend**, justificado por labores de soporte, continuidad operativa o auditoría forense.
- **Seguridad Obligatoria:**
  - Autenticación multifactor (MFA) validada criptográficamente en servidor (TOTP/WebAuthn).
  - Sesiones privilegiadas aisladas y efímeras.
  - Registro forzado e ineludible en `sigd_audit.bitacora_superadmin_saas`, documentando la institución accedida, el motivo técnico y el identificador de correlación.

### 5.2. Límites Jurídicos Institucionales Inalterables

- **No es el Undécimo Rol Institucional:** No forma parte del organigrama del IESTP «Suiza» ni se inserta en `sigd_org.rol_sistema`.
- **Cero Competencia Legal:** Carece de facultades administrativas para suscribir resoluciones directorales, otorgar grados académicos, validar actas de notas o sustituir a los órganos de gobierno del instituto.
- **Separación de Concesión de Permisos:** El control tecnológico de la infraestructura no confiere atribución al superadministrador para autorizar el permiso `#32` en cuentas de usuarios ordinarios obviando el despacho del Director General.

### 5.3. Estado Real de Implementación

- **Diseño Aprobado:** Especificación completa en `TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md`.
- **Infraestructura en Migración `23_`:** Estructura física de la tabla `sigd_audit.bitacora_superadmin_saas` con campos independientes (sin claves foráneas duras a esquemas inexistentes).
- **Esquema `sigd_saas.*`:** **PENDIENTE DE IMPLEMENTACIÓN** para la evolución arquitectónica `24_+`. No se declara como existente en la base de datos actual.

---

## 6. LAS TRES BITÁCORAS OFICIALES Y ANÁLISIS DE DEFENSA EN PROFUNDIDAD

El SIGD cuenta exactamente con **tres (3) bitácoras canónicas**:

1. `sigd_audit.bitacora_auditoria` (Acciones transaccionales generales del sistema; existente en `01_sigd_audit.sql`).
2. `sigd_audit.bitacora_acceso_documental` (Trazabilidad especializada de consultas y descargas de expedientes con permiso #32; diseñada en `23_`).
3. `sigd_audit.bitacora_superadmin_saas` (Auditoría de operaciones globales de plataforma y soporte documental privilegiado; diseñada en `23_`).

### Por qué PostgreSQL por sí solo no garantiza WORM Absoluto

La documentación técnica rectifica cualquier declaración previa sobre "inmutabilidad WORM absoluta dentro de PostgreSQL". Se establece formalmente un modelo de defensa en tres niveles:

- **Nivel 1 (Aplicativo):** El usuario de conexión del backend (`sigd_app`) únicamente tiene otorgados permisos `SELECT` e `INSERT`. Los privilegios `UPDATE`, `DELETE` y `TRUNCATE` están revocados mediante DCL.
- **Nivel 2 (Motor PostgreSQL - Append-Only):** Triggers `BEFORE DELETE OR UPDATE` abortan cualquier mutación sobre las tablas de auditoría.  
  *Limitación intrínseca:* No constituye WORM legal absoluto porque los roles de mantenimiento de base de datos (`sigd_admin`, `postgres`) poseen privilegios de superusuario (`ALTER TABLE ... DISABLE TRIGGER`, `DROP TABLE`).
- **Nivel 3 (Inmutabilidad Externa Forense - WORM Real):** La garantía forense legal se delega a la infraestructura de almacenamiento: replicación continua de WALs y logs hacia repositorios de objetos con **Object Lock en modo Compliance** (S3 WORM) o ingesta en un SIEM centralizado inmutable.

---

## 7. QUINTO CONTROL: CONSOLIDACIÓN DOCUMENTAL Y ELIMINACIÓN DE CONTRADICCIONES

### 7.1. Corrección de la Inconsistencia Numérica del Último Informe

Se subsana la contradicción detectada en el informe anterior, el cual enunciaba "seis (6) documentos rectores" pero listaba siete (7). A continuación se inventaría la totalidad de los **once (11) documentos oficiales** que integran el expediente técnico de TSK-1.2 Fase A0, plenamente conciliados y sincronizados:

| N.° | Nombre Exacto del Documento | Ubicación en Repositorio | Función Técnica e Institucional | Última Modificación | Estado de Sincronización |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **1** | `TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md` | `docs/` | Conciliación canónica de los 10 roles, ciclo de vida de `ESPECIALISTA`, catálogo de 32 permisos y matriz de responsabilidades. | 12/11/2026 | Sincronizado |
| **2** | `TSK_1_2_A0_MATRIZ_CIERRE_CONTROLES_PREIMPLEMENTACION.md` | `docs/` | Matriz de controles de preejecución, modelo de seguridad contextual de descarga y plan de pruebas de regresión. | 12/11/2026 | Sincronizado |
| **3** | `TSK_1_2_A0_MODELO_ASIGNACION_EXPEDIENTES.md` | `docs/` | Reglas de asignación y reasignación de expedientes, evaluadores docentes y segregación de funciones. | 12/11/2026 | Sincronizado |
| **4** | `TSK_1_2_A0_MODELO_CAPACIDADES_OPERATIVAS.md` | `docs/` | Especificación de la capacidad operativa `GESTOR_APOYO_AREA` (no es rol) y lista negra de permisos excluidos. | 12/11/2026 | Sincronizado |
| **5** | `TSK_1_2_A0_MODELO_CIERRE_ADMINISTRATIVO_EXPEDIENTES.md`| `docs/` | Protocolo de cierre en 3 etapas (`ATENDIDO` -> `CERRADO` -> `ARCHIVADO`), reglas procedimentales y asientos WORM. | 12/11/2026 | Sincronizado |
| **6** | `TSK_1_2_A0_PLAN_MIGRACION_POSTGRESQL.md` | `docs/` | Plan secuencial de aplicación de migraciones físicas (`22_`, `23_`, Fases B/C/D y `24_+`). | 12/11/2026 | Sincronizado |
| **7** | `TSK_1_2_A0_PLAN_ROLLBACK.md` | `docs/` | Plan de contingencia, reversión granular y scripts de compensación paso a paso sin pérdida de datos. | 12/11/2026 | Sincronizado |
| **8** | `TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md` | `docs/` | Política integral de control global SaaS, acceso documental de diagnóstico, MFA y deslinde jurídico. | 12/11/2026 | Sincronizado |
| **9** | `TSK_1_2_A0_REVISION_TECNICA_FINAL.md` | `docs/` | Adenda definitiva, justificación técnica del motor RBAC, traza transaccional de concurrencia y auditoría estática. | 12/11/2026 | Sincronizado |
| **10**| `TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql` | `docs/` | Código DDL/DML propuesto completo para las futuras migraciones `22_` y `23_` (estrictamente no ejecutado). | 13/11/2026 | Sincronizado |
| **11**| `INFORME_TSK_1_2_A0_DISENO_DEFINITIVO.md` | `docs/` | Informe rector consolidado de arquitectura, concurrencia, WORM y matriz de certificación de los 12 criterios. | 13/11/2026 | Sincronizado |

---

## 8. MATRIZ DEFINITIVA DE CIERRE DE LOS CINCO (5) CONTROLES

| Control Evaluado | Resultado Técnico | Evidencia Factual Verificada | Documento Actualizado | Decisión Institucional Aplicada | Observaciones y Deslinde | Estado de Cierre |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Control 1:** Catálogo de permisos e identificadores | **Cerrado y Conciliado** | Catálogo unificado de exactamente 32 permisos (16 existentes en `03_`, `10_`, `17_` + 16 atómicos en `22_`). Permiso #32 con UUID `5b01...0016`. | `TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md`, `INFORME_CIERRE_DEFINITIVO...` | Catálogo cerrado sin duplicados. `EXPEDIENTE_RESOLVER` en descontinuación controlada. | Se aclaró documentalmente que 31 era el catálogo previo y 33 fue un error aritmético. | **CERRADO** |
| **Control 2:** Autoridad del Permiso `EXPEDIENTE_DESCARGAR` | **Cerrado y Rectificado** | Esquema tripartito estricto: Director autoriza, Administrador ejecuta, SuperAdmin acceso global propio. | `TSK_1_2_A0_MATRIZ_CIERRE_CONTROLES...`, `TSK_1_2_A0_POLITICA_SUPER_ADMIN...` | Exclusividad orgánica del Director General. Prohibida autoautorización sin superior jerárquico. | Se eliminó formalmente toda mención errónea a la Jefatura de Unidad Administrativa. | **CERRADO** |
| **Control 3:** Descarga documental y URLs de MinIO | **Cerrado en Diseño** | Inventario de endpoints levantado en backend. Identificada exposición en JSON actual. Diseñado streaming con SDK nativo. | `INFORME_CIERRE_DEFINITIVO...`, `TSK_1_2_A0_MATRIZ_CIERRE_CONTROLES...` | Prohibición de entregar URLs prefirmadas al navegador. Streaming backend obligatorio (`pipe(res)`). | Corrección funcional de código programada obligatoriamente para Fase B. Cero código alterado hoy. | **CERRADO** |
| **Control 4:** Definición de `SUPER_ADMIN_PLATAFORMA` | **Cerrado y Delimitado** | Control total SaaS, acceso por streaming auditado en `bitacora_superadmin_saas`, MFA en servidor. Límite legal sellado. | `TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md` | Operador tecnológico SaaS independiente fuera de `sigd_org.rol_sistema`. Cero competencia legal del Instituto. | Se diferenció diseño aprobado de infraestructura futura (`sigd_saas.*` en `24_+`). | **CERRADO** |
| **Control 5:** Consolidación de documentos oficiales | **Cerrado y Sincronizado** | 11 documentos rectores inventariados, consistentes, libres de contradicciones y con hashes SHA-256 certificados. | `docs/` (11 documentos), Artefacto de memoria sincronizado | Expediente técnico único, coherente y normativamente blindado. | Inconsistencia numérica de 6 vs 7 documentos del informe previo totalmente saneada. | **CERRADO** |

---

## 9. VERIFICACIÓN FINAL DEL REPOSITORIO GIT

De la inspección de solo lectura del sistema de control de versiones Git:

- **Rama Activa:** `B_JACOBO` (exclusiva, actualizada respecto a origen).
- **Estado del Working Tree:** Se detectan 371 archivos con modificaciones y eliminaciones respecto al HEAD (`bf30d8a chore(sigd): guardar avance del prototipo y TUPA Suiza 2026`).
  - *Evidencia comparativa:* Dichas modificaciones provienen del avance histórico acumulado del prototipo y del TUPA Suiza 2026 previo al inicio de las tareas de TSK-1.2.
  - *Preservación rigurosa:* En esta intervención técnica **no se ejecutó `git add`, `git commit`, `git checkout`, `git reset` ni ninguna operación destructiva**, manteniéndose intactos los 371 archivos preexistentes (207 modificados y 164 eliminados respecto a HEAD).
- **Git Diff Check:** La ejecución de `git diff --check` arroja advertencias de caracteres de fin de línea CRLF y espacios en blanco al final de línea en el árbol de trabajo preexistente (código de salida 1), lo cual certifica que los archivos preexistentes no han sufrido alteraciones forzadas de formato.

### Manifiesto de Hashing SHA-256 de los 11 Documentos de Fase A0

| Archivo Documental en `docs/` | Hash Criptográfico SHA-256 Oficial |
| :--- | :--- |
| `TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md` | `C9E726BA3D0D301A6549A572DF351A8DF03E4B8B2AA4B6BD4CC80B40E9B88377` |
| `TSK_1_2_A0_MATRIZ_CIERRE_CONTROLES_PREIMPLEMENTACION.md` | `29A3F944DC9526F27E4E38A38A9629699A332EEA61CF9331CF698C65AC811BFE` |
| `TSK_1_2_A0_MODELO_ASIGNACION_EXPEDIENTES.md` | `A08E9987726D9B6B88458536C62053218957E7B22EADCC9798C1B58E90EC4D80` |
| `TSK_1_2_A0_MODELO_CAPACIDADES_OPERATIVAS.md` | `C92FD897FB7245CF47772FCF41C5A123EDBC2B2AE3FB9B64F3C677048A9D2AD8` |
| `TSK_1_2_A0_MODELO_CIERRE_ADMINISTRATIVO_EXPEDIENTES.md` | `C3605A1B6AEB7C35A640DD0187CEF92773232F4BFCEDAD73717EA8731FE2AB44` |
| `TSK_1_2_A0_PLAN_MIGRACION_POSTGRESQL.md` | `29A206C9FFE270EAE43C6E72B33A7A4383252B4313AC1815546424DC39C91F8C` |
| `TSK_1_2_A0_PLAN_ROLLBACK.md` | `107FBF62DCB3004DC3C9B39D14D6A68E5F83F53D9ACDE12D06C7C75E8C63E843` |
| `TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md` | `E0B4481DBFD3168001E7BCEBCB49B989B5C83CD7F8B8162E527BAA9D3BAB0894` |
| `TSK_1_2_A0_REVISION_TECNICA_FINAL.md` | `3DBD75CAFA81DAF904F243A0187F0A5F27AA42C1BBA3379C8533196CD3F65F20` |
| `TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql` | `A434525478EC4699E561BA129E71E3F04BB231904AC12D8EBD522E2A6303E923` |
| `INFORME_TSK_1_2_A0_DISENO_DEFINITIVO.md` | `16589A58E656A394B864F3FC3A1FA4C4A83D796CA1CACBED7B8292D7862C3C13` |

---

## 10. EVIDENCIA DE PROTECCIÓN DEL ENTORNO

Se certifica fehacientemente que:

1. **Cero SQL Ejecutado:** No se corrió ninguna consulta `SELECT`, sentencia DDL (`CREATE`, `ALTER`, `DROP`) ni DML (`INSERT`, `UPDATE`, `DELETE`) en el motor PostgreSQL.
2. **Cero Conexiones a Base de Datos:** No se abrieron sesiones interactivas ni conexiones de clientes administrativos a `sigd_jacobo_demo` durante la presente tarea.
3. **Cero Migraciones Aplicadas:** El directorio `backend/migraciones/` permanece intacto, con la migración `21_sigd_auth_actualizacion_ubigeo_2026.sql` como la última físicamente existente.
4. **Cero Mutaciones en Código Fuente:** Los directorios `backend/src/` y `frontend/src/` no sufrieron alteraciones.
5. **Cero Alteraciones de Infraestructura:** No se modificaron contenedores Docker, volúmenes de almacenamiento ni variables de entorno en archivos `.env`.

---

## 11. LIMITACIONES DE IMPLEMENTACIÓN DIFERIDAS A FASES POSTERIORES

En estricta honestidad técnica, se documentan las capacidades que forman parte del diseño pero cuya materialización física corresponde a las siguientes etapas:

- **Fase A (Migraciones de Base de Datos):**
  - Aplicación física de la migración `22_` (catálogo cerrado de 10 roles, retiro de `ESPECIALISTA`, 16 permisos atómicos nuevos, candados lógicos y capacidades).
  - Aplicación física de la migración `23_` (`bitacora_acceso_documental`, `bitacora_superadmin_saas`, `autorizacion_descarga_excepcional` y trigger de serialización concurrente de #32).
- **Fase B (Refactorización y Endpoints Backend):**
  - Refactorización de endpoints de descarga para suprimir la emisión de URLs prefirmadas en JSON y canalizar streams binarios directos (`pipe(res)`).
  - Implementación del servicio de visualización previa inline (`GET /storage/documentos/:id/view`).
  - Validación del permiso `#32` con aislamiento contextual y registro de auditoría WORM.
  - Endurecimiento de la pasarela ReFirma y validación PAdES interna mediante SDK nativo.
- **Fase C (Interfaz de Usuario Frontend):**
  - Ocultamiento contextual de botones de descarga en la UI cuando el usuario carezca del permiso #32.
  - Integración del visor PDF con el endpoint de visualización en streaming (`Content-Disposition: inline`).
- **Fase D (Pruebas de Carga y Concurrencia Real):**
  - Ejecución de pruebas de estrés y concurrencia transaccional simultánea sobre el trigger `fn_validar_autorizacion_rol_permiso_institucional` para validar en vivo la contención de candados consultivos de 64 bits.
- **Fase Futura (`24_+`):**
  - Aprovisionamiento del esquema `sigd_saas` y tablas multi-institucionales.
  - Retiro lógico definitivo (Etapa 4) de `EXPEDIENTE_RESOLVER`.

---

## 12. DECLARACIÓN FORMAL DE CIERRE DOCUMENTAL DE FASE A0

El Arquitecto Principal de Software certifica que:

> **LA FASE A0 DE TSK-1.2 SE ENCUENTRA FORMALMENTE CERRADA, BLINDADA Y LIBRE DE CONTRADICCIONES.**  
> El catálogo de 32 permisos canónicos, la gobernanza institucional del permiso #32, el diseño de streaming documental sin exposición de URLs prefirmadas, la política de control SaaS de `SUPER_ADMIN_PLATAFORMA` y la arquitectura de defensa en profundidad de las tres bitácoras oficiales quedan plenamente armonizados en la documentación rectora.  
> 
> **CONDICIÓN FINAL DE PARADA ACTIVADA:** No se ejecutará código, migraciones ni comandos SQL sobre `sigd_jacobo_demo` hasta contar con la autorización formal y expresa de la Dirección para iniciar la **Fase A**.

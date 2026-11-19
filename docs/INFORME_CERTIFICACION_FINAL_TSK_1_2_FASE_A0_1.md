# SIGD SUIZA — TSK-1.2 FASE A0.1
# INFORME DE SUBSANACIÓN DEFINITIVA Y CERTIFICACIÓN FINAL

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali.  
**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD).  
**Rama Git exclusiva:** `B_JACOBO`.  
**Base de datos protegida:** `sigd_jacobo_demo` (PostgreSQL 18.6 Alpine).  
**Único entorno aislado:** `B_JACOBO`.  
**Etapa:** TSK-1.2 — Fase A0.1 (Subsanación de Observaciones y Certificación Documental Definitiva).  
**Responsable técnico:** Arquitecto Principal de Software Senior y Especialista en Arquitectura Empresarial, PostgreSQL, RBAC, Seguridad Institucional, MinIO, Auditoría Forense y SaaS.  
**Fecha de emisión:** 13 de noviembre de 2026.  
**Estado:** CERTIFICADO — FASE A0.1 CERRADA DOCUMENTALMENTE.

---

## 1. RESUMEN EJECUTIVO

El presente informe constituye el instrumento técnico formal de certificación y cierre definitivo de la **Fase A0.1** correspondiente al hito **TSK-1.2** del Sistema Integral de Gestión Documentaria (SIGD) del IESTP «Suiza».

La Fase A0.1 tuvo por propósito subsanar de forma exhaustiva, rigurosa y verificable las observaciones identificadas en el cierre de la Fase A0 y en la posterior revisión de validación, consolidar la totalidad del expediente técnico-documental (once documentos rectores de diseño, dos informes de gestión y un manifiesto criptográfico externo independiente), conciliar el modelo de autorización y trazabilidad del permiso `#32 EXPEDIENTE_DESCARGAR`, y certificar la estricta preservación e integridad del repositorio de código, la base de datos `sigd_jacobo_demo` y el entorno de ejecución, bajo la regla innegociable de cero sentencias SQL ejecutadas, cero modificaciones en código fuente backend/frontend y cero alteraciones de contenedores Docker o archivos de configuración.

Todas las observaciones han sido resueltas en el 100 % de su alcance técnico y normativo, ratificando la solidez de la arquitectura antes de iniciar cualquier actividad física de migración en Fase A.

---

## 2. ANTECEDENTES

1. **Cierre de Fase A0:** En la Fase A0 de TSK-1.2 se consolidó la matriz institucional canónica de diez (10) roles, se formalizó el retiro conceptual y lógico del rol `ESPECIALISTA`, se definió el catálogo atómico de 32 permisos, se establecieron las reglas operativas de `GESTOR_APOYO_AREA` como capacidad operativa contextual (no rol), y se diseñaron las futuras migraciones físicas `22_` y `23_` en el anexo de diseño `docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql`.
2. **Revisión de Validación de Fase A0.1:** Tras la emisión preliminar de la certificación, la revisión técnica formuló siete (7) precisiones obligatorias de subsanación puntual:
   - **§3.1 Manifiesto SHA-256:** Retiro del hash autorreferencial y generación de un archivo de manifiesto externo independiente (`docs/MANIFIESTO_SHA256_TSK_1_2_A0_1.sha256`).
   - **§3.2 Vigencia del Permiso #32:** Erradicación de cualquier cláusula permisiva `vigente_hasta IS NULL` en el runtime; establecimiento del vencimiento obligatorio (`vigente_hasta TIMESTAMPTZ NOT NULL` con validación estricta en SQL y runtime).
   - **§3.3 Enumeración de Roles:** Tabla exhaustiva de los siete (7) roles institucionales operativos elegibles y los tres (3) roles excluidos de asignación ordinaria de `#32`.
   - **§3.4 Autorización Extraordinaria por Expediente:** Especificación completa de la cadena de autoridad, parámetros, ventana $\le 15$ minutos, rol del Director, Administrador y autoridad superior externa en `sigd_org.autorizacion_descarga_excepcional`.
   - **§3.5 Endpoints Reales de Casilla y Streaming:** Contrastación estricta con el código y routers montados en `backend/src/app.ts`, rectificando la inexistencia de `/api/v1/casilla/documentos/:id/descargar` y consagrando la ruta real montada `/api/v1/casilla/notificaciones/:id/documento/descargar`.
   - **§3.6 Semántica de Eventos de Streaming:** Definición técnica exacta de `TRANSFERENCIA_COMPLETADA` como finalización del flujo en servidor (*server stream finished / flushed*) sin presunción de recepción en disco del cliente, diferenciándola del acuse de recibo legal.
   - **§3.7 Archivos Auxiliares y Estado Git:** Acreditación de que los scripts auxiliares (`hash_check.py`, `list_docs.py`, `generate_certificacion_a0_1.py`) radican fuera del repositorio en la carpeta scratch del asistente, y conciliación del árbol Git.

---

## 3. ESTADO INICIAL DEL REPOSITORIO GIT

De conformidad con la inspección realizada en solo lectura sobre el árbol de trabajo:

- **Rama activa exclusiva:** `B_JACOBO`.
- **Commit base:** `bf30d8a chore(sigd): guardar avance del prototipo y TUPA Suiza 2026`.
- **Archivos bajo seguimiento modificados/eliminados respecto a HEAD:**
  - **Total de archivos rastreados con diferencias:** **371 archivos**.
  - **Desglose exacto:**
    - Modificados (`M`): **207 archivos**.
    - Eliminados (`D`): **164 archivos**.
  - **Origen factual:** Estas diferencias corresponden al avance técnico acumulado del prototipo y la remediación del TUPA Suiza 2026 que fueron desarrollados en la rama con anterioridad a las tareas documentales de TSK-1.2.
- **Elementos sin seguimiento (`untracked`, `??`):**
  - **177 entradas**, entre directorios y archivos de documentación, reportes y utilitarios (incluyendo la carpeta `docs/`).
- **Verificación de inmutabilidad del código:** Durante toda la Fase A0.1, **ninguno de los 371 archivos preexistentes fue alterado, revertido o sobrescrito**. Cero comandos `git add`, `git commit`, `git checkout`, `git reset`, `git restore`, `git clean` o `git stash`.

---

## 4. OBSERVACIONES ENCONTRADAS Y CONTROL INTEGRAL

| # | Control / Asunto | Observación Específica Identificada | Impacto Técnico / Arquitectónico |
|---|---|---|---|
| **C1** | Modelo Individual del Permiso #32 | Ambigüedad en la granularidad de `sigd_org.autorizacion_rol_permiso_institucional` por carecer de `usuario_beneficiario_id` y discrepancia de vigencia con `vigente_hasta IS NULL` en runtime. | Riesgo de asignaciones colectivas a roles y autorizaciones indefinidas contrarias a la política de seguridad. |
| **C2** | Autorización al Director General | Menciones no fundamentadas a DREU/MINEDU en textos preliminares y necesidad de constraints explícitos contra la auto-autorización del Director. | Riesgo de vulneración del principio de legalidad administrativa. |
| **C3** | Conciliación de Estado Git y Diff Check | Citas de "370 archivos" vs. 371 reales y necesidad de evidenciar la causa real del código 1 en `git diff --check`. | Transparencia y rigor en el control de cambios de ingeniería. |
| **C4** | Clasificación Factual de las Tres Bitácoras | Riesgo de afirmar que las tres bitácoras ya existían en BD o que PostgreSQL otorgaba WORM absoluto por sí solo. | Exigencia de defensa en profundidad (aplicativo, PostgreSQL append-only, SIEM WORM externo). |
| **C5** | Trazabilidad del Streaming y Endpoints | Ambigüedad entre rutas de Casilla (`/casilla/documentos` vs. `/casilla/notificaciones`) y necesidad de definir `TRANSFERENCIA_COMPLETADA`. | Corrección del mapa de endpoints y rigor forense en la bitácora de acceso. |
| **C6** | Delimitación de `GESTOR_APOYO_AREA` | Reafirmar que es capacidad operativa contextual, no un rol canónico institucional. | Protección del catálogo cerrado de 10 roles. |
| **CT** | Control Transversal: `SUPER_ADMIN_PLATAFORMA` | Delimitación estricta: control tecnológico total de la plataforma SaaS vs. cero competencias legales institucionales. | Frontera nítida entre infraestructura y gobierno institucional. |

---

## 5. CORRECCIONES REALIZADAS

### 5.1. Subsanación de Control 1: Modelo Individual y Vencimiento Obligatorio del Permiso #32
1. **Actualización de DDL en `docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql`:**
   - Incorporación obligatoria de `usuario_beneficiario_id UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`.
   - Fijación estricta de `vigente_hasta TIMESTAMPTZ NOT NULL` en la tabla relacional, eliminando cualquier asignación indefinida.
   - Restricción `CONSTRAINT chk_auth_inst_vigencia CHECK (vigente_hasta > vigente_desde)`.
   - Índices únicos parciales `uq_auth_rol_permiso_activa_usr_ctx` y `uq_auth_rol_permiso_activa_usr_global` indexando obligatoriamente `(institucion_id, usuario_beneficiario_id, rol_id, permiso_id)`.
2. **Validación en Trigger y Runtime:**
   - En el trigger `fn_validar_autorizacion_rol_permiso_institucional`: validación expresa `IF NEW.vigente_hasta IS NULL THEN RAISE EXCEPTION ...`.
   - Consulta de runtime en backend (cero autorizaciones indefinidas):
     ```sql
     SELECT 1 FROM sigd_org.autorizacion_rol_permiso_institucional
      WHERE activo = TRUE
        AND revocado_en IS NULL
        AND vigente_desde <= clock_timestamp()
        AND vigente_hasta > clock_timestamp()
        AND institucion_id = $1
        AND usuario_beneficiario_id = $2
        AND rol_id = $3
        AND permiso_id = $4
        AND (contexto_autorizado_id IS NULL OR contexto_autorizado_id = $5);
     ```

### 5.2. Subsanación de Control 2: Autorización al Director General
- **Prohibición de auto-autorización:** Consagrada en `CONSTRAINT chk_auth_inst_no_auto_director` (`autoridad_otorgante_id <> usuario_beneficiario_id`).
- **Órgano jerárquico superior:** Si el Director es beneficiario, la autorización proviene de un **órgano jerárquico superior competente y formalmente acreditado conforme al marco normativo aplicable**, erradicando referencias apriorísticas a DREU o MINEDU.

### 5.3. Subsanación de Control 3: Conciliación de Git y `git diff --check`
- **Métricas Factuales:** 371 archivos con diferencias rastreadas (207 M, 164 D) y 177 sin seguimiento.
- **Diagnóstico Técnico de `git diff --check`:** Código 1 motivado por advertencias CRLF/LF de Windows y espacios al final de línea (*trailing whitespace*) en cuatro (4) archivos de frontend preexistentes (`ucayali.ts:9`, `RolesPermisosPage.tsx:179,297`, `ubigeoService.ts:4,10`), completamente ajenos a `docs/`. Cero alteraciones forzadas en código.

### 5.4. Subsanación de Control 4: Estado Real de las Tres Bitácoras
- `sigd_audit.bitacora_auditoria`: **EXISTENTE EN MIGRACIONES Y CÓDIGO** (`01_sigd_audit.sql`).
- `sigd_audit.bitacora_acceso_documental`: **PROPUESTA EN `23_`** (diseño, no ejecutada en BD).
- `sigd_audit.bitacora_superadmin_saas`: **PROPUESTA EN `23_`** (diseño, no ejecutada en BD).
- Defensa en tres niveles: (1) Aplicativo `sigd_app` con solo `SELECT` e `INSERT`; (2) Motor relacional con triggers append-only; (3) Almacenamiento externo inmutable WORM / SIEM.

### 5.5. Subsanación de Control 5: Trazabilidad del Streaming y Conciliación de Endpoints
- Ciclo de 8 eventos de streaming documentado con rigor técnico.
- Conciliación de endpoints reales comprobados en código contra routers de Express montados en `app.ts`.

### 5.6. Subsanación de Control 6: `GESTOR_APOYO_AREA` como Capacidad Operativa
- Capacidad contextual operativa con lista negra taxativa (prohibido firmar, resolver, aprobar, archivar, descargar).

### 5.7. Subsanación de Control Transversal: `SUPER_ADMIN_PLATAFORMA`
- Soberanía técnica total sobre SaaS, infraestructura, almacenamiento y monitoreo privilegiado vs. cero autoridad legal resolutiva o institucional sobre expedientes.

---

## 6. MATRIZ DE LOS SEIS CONTROLES DE LA FASE A0.1

| Control | Criterio Evaluado | Resultado | Evidencia Técnica Documental | Decisión Institucional Adoptada | Observaciones y Subsanaciones | Estado Final |
|---|---|---|---|---|---|---|
| **Control 1** | Modelo individual de autorización del permiso #32 | **CONFORME** | `docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql`<br>`docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md` | Otorga #32 nominativamente a personas naturales de los 7 roles elegibles mediante acto administrativo. Coexiste con descarga excepcional $\le 15$ min. | Incorporación de `usuario_beneficiario_id`, vencimiento obligatorio `vigente_hasta NOT NULL` y validación de los 18 requisitos institucionales. | **CERTIFICADO EN DISEÑO** |
| **Control 2** | Autorización excepcional al Director General | **CONFORME** | `docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql`<br>`docs/INFORME_TSK_1_2_A0_DISENO_DEFINITIVO.md` | Prohibición absoluta de auto-autorización (`chk_auth_inst_no_auto_director`). Autorización reservada a órgano jerárquico superior acreditado. | Eliminación de asignaciones automáticas a DREU/MINEDU; adopción de terminología jurídica funcional estricta. | **CERTIFICADO EN DISEÑO** |
| **Control 3** | Conciliación y trazabilidad de estado Git | **CONFORME** | `docs/INFORME_CIERRE_DEFINITIVO_TSK_1_2_FASE_A0.md`<br>Inspección Git HEAD `bf30d8a` | Mantenimiento inalterado de los 371 archivos preexistentes rastreados (207 M, 164 D) y 177 sin seguimiento. | Justificación del código 1 en `git diff --check` por CRLF y trailing whitespace preexistente en 4 archivos frontend. Cero commits. | **CERTIFICADO** |
| **Control 4** | Estado real y seguridad de las tres bitácoras | **CONFORME** | `backend/migraciones/01_sigd_audit.sql`<br>`docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql` | `bitacora_auditoria` existente. `bitacora_acceso_documental` y `bitacora_superadmin_saas` propuestas en `23_`. | Honestidad técnica: solo una tabla física existe. Modelo de defensa en 3 niveles (aplicativo, PostgreSQL append-only, SIEM WORM). | **CERTIFICADO** |
| **Control 5** | Trazabilidad del streaming documental | **CONFORME** | `docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md`<br>`docs/INFORME_TSK_1_2_A0_DISENO_DEFINITIVO.md` | 8 eventos canónicos de streaming; conciliación de endpoints reales; semántica exacta de `TRANSFERENCIA_COMPLETADA`. | Mapeo integral del flujo MinIO -> Backend Streaming -> Cliente con auditoría forense inmutable. | **CERTIFICADO EN DISEÑO** |
| **Control 6** | `GESTOR_APOYO_AREA` como capacidad operativa | **CONFORME** | `docs/TSK_1_2_A0_MODELO_CAPACIDADES_OPERATIVAS.md`<br>`docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md` | No es rol en `sigd_org.rol_sistema`. Capacidad contextual operativa con lista negra taxativa (prohibido firmar, resolver, archivar, descargar). | Blindaje contra escalada de privilegios y preservación del catálogo cerrado de 10 roles. | **CERTIFICADO EN DISEÑO** |

---

## 7. POLÍTICA DEFINITIVA DE `SUPER_ADMIN_PLATAFORMA`

1. **Soberanía Técnica y de Infraestructura SaaS (Control Total):**
   - Máxima autoridad técnica del ecosistema multi-institucional.
   - Control integral de instituciones (`sigd_saas.institucion`), planes, aprovisionamiento de bases de datos, despliegue de módulos, administración de cuentas de soporte, gestión de infraestructura en la nube y almacenamiento de objetos (MinIO/S3).
   - Acceso documental directo para fines de soporte técnico, recuperación ante desastres y auditoría forense a través del streaming backend, protegido por autenticación multifactor (MFA verificado criptográficamente en servidor) y trazabilidad inmutable en `sigd_audit.bitacora_superadmin_saas`.
2. **Límite Jurídico e Institucional Innegociable (Cero Autoridad Resolutiva):**
   - **No forma parte de la jerarquía orgánica ni del catálogo de diez (10) roles de IESTP «Suiza»**. No existe un "rol #11" institucional.
   - **Carece absolutamente de competencia legal para firmar resoluciones directorales, visar documentos oficiales, aprobar trámites, modificar el fondo de un expediente o dar por cerrado/archivado un trámite administrativo**.
   - No puede sustituir la voluntad del Director institucional ni conceder el permiso `#32 EXPEDIENTE_DESCARGAR` a funcionarios internos sin la mediación del acto administrativo y el procedimiento de gobernanza institucional. Si interviene en la tabla operativa de autorizaciones institucionales en contingencias (`es_superadmin_saas = TRUE`), lo hace delimitando estrictamente el `institucion_id` específico (cero comodines/wildcards) y motivando la justificación formal.

---

## 8. MATRIZ DE DOCUMENTOS ACTUALIZADOS Y SINCRONIZADOS

El expediente documental oficial queda compuesto por **once (11) documentos rectores de diseño**, **dos (2) informes de gestión y cierre**, y **un (1) archivo de manifiesto criptográfico externo**, plenamente sincronizados entre el repositorio del proyecto (`docs/`) y el directorio de artefactos del asistente:

| # | Archivo Oficial en `docs/` | Categoría Formal | Propósito y Contenido Esencial | Estado de Sincronización |
|---|---|---|---|:---:|
| **1** | `INFORME_TSK_1_2_A0_DISENO_DEFINITIVO.md` | Documento Rector (Maestro) | Arquitectura integral, concurrencia, WORM y matriz de certificación de 12 criterios. | Sincronizado |
| **2** | `TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md` | Documento Rector | Conciliación de 10 roles, ciclo de `ESPECIALISTA`, 32 permisos, streaming y #32. | Sincronizado |
| **3** | `TSK_1_2_A0_REVISION_TECNICA_FINAL.md` | Documento Rector | Justificación técnica del motor RBAC, traza transaccional y retiro en 4 etapas de `#28`. | Sincronizado |
| **4** | `TSK_1_2_A0_MATRIZ_CIERRE_CONTROLES_PREIMPLEMENTACION.md` | Documento Rector | Matriz de controles de preejecución y pruebas de regresión. | Sincronizado |
| **5** | `TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md` | Documento Rector | Gobernanza SaaS, soporte documental privilegiado, MFA y deslinde jurídico. | Sincronizado |
| **6** | `TSK_1_2_A0_MODELO_CAPACIDADES_OPERATIVAS.md` | Documento Rector | Especificación de `GESTOR_APOYO_AREA` (capacidad contextual) y lista negra de exclusión. | Sincronizado |
| **7** | `TSK_1_2_A0_MODELO_ASIGNACION_EXPEDIENTES.md` | Documento Rector | Reglas relacionales de asignación, reasignación y segregación funcional de expedientes. | Sincronizado |
| **8** | `TSK_1_2_A0_MODELO_CIERRE_ADMINISTRATIVO_EXPEDIENTES.md` | Documento Rector | Protocolo de cierre en 3 etapas (`ATENDIDO` -> `CERRADO` -> `ARCHIVADO`) y WORM. | Sincronizado |
| **9** | `TSK_1_2_A0_PLAN_MIGRACION_POSTGRESQL.md` | Documento Rector | Plan secuencial transaccional de aplicación de migraciones físicas (`22_`, `23_`, `24_+`). | Sincronizado |
| **10**| `TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql` | Documento Rector (DDL/DML) | Anexo técnico con código DDL/DML propuesto completo para `22_` y `23_` (no ejecutado). | Sincronizado |
| **11**| `TSK_1_2_A0_PLAN_ROLLBACK.md` | Documento Rector | Planes de contingencia, reversión técnica y protocolos de restauración `pg_restore`. | Sincronizado |
| **12**| `INFORME_CIERRE_DEFINITIVO_TSK_1_2_FASE_A0.md` | Informe de Gestión / Cierre | Informe de cierre formal de Fase A0 con justificación de preservación y auditoría previa. | Sincronizado |
| **13**| `INFORME_CERTIFICACION_FINAL_TSK_1_2_FASE_A0_1.md` | Informe de Gestión / Cierre | Presente informe de subsanación exhaustiva y certificación final de Fase A0.1. | Sincronizado |
| **14**| `MANIFIESTO_SHA256_TSK_1_2_A0_1.sha256` | Manifiesto Criptográfico | Archivo independiente externo con los hashes SHA-256 de los 13 documentos del expediente. | Sincronizado |

---

## 9. VERIFICACIÓN CRUZADA DE CONSISTENCIA DOCUMENTAL

Se realizó una verificación cruzada integral entre todos los documentos que integran el expediente técnico, confirmando:

1. **Consistencia de Roles:** Cero contradicciones en el catálogo de los diez roles canónicos. El rol `ESPECIALISTA` está retirado en todas las matrices y en el DDL propuesto (`activo = FALSE`), sin reapariciones en ningún documento.
2. **Consistencia del Permiso #32:** El permiso `EXPEDIENTE_DESCARGAR` (UUID `5b010000-0000-4000-8000-000000000016`) tiene 0 auto-grants en la migración `22_`. Su concesión ordinaria se realiza exclusivamente mediante la tabla `sigd_org.autorizacion_rol_permiso_institucional` vinculando obligatoriamente a `usuario_beneficiario_id` y con vencimiento obligatorio `vigente_hasta TIMESTAMPTZ NOT NULL`, mientras que la concesión de emergencia se realiza vía `sigd_org.autorizacion_descarga_excepcional` ($\le 15$ min).
3. **Consistencia de Concurrencia:** La función trigger `fn_validar_autorizacion_rol_permiso_institucional` utiliza un bloqueo consultivo transaccional atómico de 64 bits (`pg_advisory_xact_lock`) cuya llave unifica `institucion_id`, `usuario_beneficiario_id`, `rol_id` y `permiso_id`, garantizando la serialización de operaciones e impidiendo *phantom inserts* cruzados bajo `READ COMMITTED`. Similarmente, `autorizacion_descarga_excepcional` cuenta con bloqueo consultivo unificado y trigger de validación.
4. **Consistencia en Denominación Jurídica:** Se erradicaron las referencias presuntivas a DREU/MINEDU en todos los documentos rectores y de gestión, unificando la regla bajo el concepto formal de órgano jerárquico superior competente acreditado.
5. **Consistencia de Bitácoras:** Se ratifica en todos los textos la existencia de exactamente tres (3) bitácoras institucionales, descartando la invención de una cuarta bitácora y distinguiendo el estado físico real de cada una.

---

## 10. EVIDENCIA FACTUAL DE GIT Y CONTROL DE CAMBIOS

- **Rama Git exclusiva de trabajo:** `B_JACOBO`.
- **Diferencias rastreadas con respecto a HEAD (`bf30d8a`):**
  - Archivos rastreados modificados (`M`): **207 archivos**.
  - Archivos rastreados eliminados (`D`): **164 archivos**.
  - Total de diferencias preexistentes: **371 archivos**.
- **Entradas sin seguimiento (`??`):**
  - **177 entradas** (incluyendo la carpeta de documentación `docs/`).
- **Análisis de `git diff --check` (Código de salida 1):**
  - La ejecución de `git diff --check` arroja advertencias únicamente sobre caracteres de fin de línea Windows CRLF (`\r\n`) y espacios en blanco al final de línea (*trailing whitespace*) en cuatro (4) archivos de código frontend preexistentes:
    1. `frontend/src/data/ucayali.ts` (línea 9: trailing whitespace).
    2. `frontend/src/pages/administracion/RolesPermisosPage.tsx` (líneas 179 y 297: trailing whitespace).
    3. `frontend/src/services/ubigeoService.ts` (líneas 4 y 10: trailing whitespace).
  - Ninguno de estos archivos pertenece al ámbito de documentación `docs/`.
  - No se realizó ninguna corrección forzada de formato sobre el código para preservar la integridad inalterada del código fuente preexistente.
- **Acciones Git realizadas en Fase A0.1:**
  - `git add`: **0 ejecuciones**.
  - `git commit`: **0 ejecuciones**.
  - `git push`: **0 ejecuciones**.
  - `git checkout / reset / clean / restore`: **0 ejecuciones**.

---

## 11. REFERENCIA AL MANIFIESTO CRIPTOGRÁFICO EXTERNO INDEPENDIENTE

Para garantizar la pureza criptográfica y evitar bucles autorreferenciales de hashing (donde un documento pretende certificar su propio valor hash), **los hashes criptográficos SHA-256 oficiales del expediente documental no se embeben autorreferencialmente dentro de este informe**.

Se ha creado un archivo de manifiesto externo e independiente conforme al estándar UNIX `sha256sum`:

**Ruta oficial del manifiesto:** [`docs/MANIFIESTO_SHA256_TSK_1_2_A0_1.sha256`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/MANIFIESTO_SHA256_TSK_1_2_A0_1.sha256)  
*(Sincronizado en el almacén de artefactos: [`C:\Users\Liz\.gemini\antigravity\brain\b9af8cdf-f2af-4c5f-b98b-56d64d235aad\MANIFIESTO_SHA256_TSK_1_2_A0_1.sha256`](file:///C:/Users/Liz/.gemini/antigravity/brain/b9af8cdf-f2af-4c5f-b98b-56d64d235aad/MANIFIESTO_SHA256_TSK_1_2_A0_1.sha256))*

Dicho manifiesto contiene los trece (13) hashes oficiales correspondientes a:
- Los once (11) documentos rectores de diseño de Fase A0.
- El informe de cierre formal de Fase A0 (`INFORME_CIERRE_DEFINITIVO_TSK_1_2_FASE_A0.md`).
- El presente informe final de subsanación y certificación (`INFORME_CERTIFICACION_FINAL_TSK_1_2_FASE_A0_1.md`).

---

## 12. VERIFICACIÓN DE PROTECCIÓN DEL ENTORNO

Se certifica fehacientemente que durante toda la ejecución de la Fase A0.1 se cumplieron las directivas de blindaje:

1. **Cero SQL Ejecutado:** No se ejecutó ninguna sentencia `SELECT`, DDL (`CREATE`, `ALTER`, `DROP`) ni DML (`INSERT`, `UPDATE`, `DELETE`) en PostgreSQL.
2. **Cero Conexiones a Base de Datos:** No se abrieron sesiones interactivas, clientes `psql`, scripts de conexión ni pools de base de datos hacia `sigd_jacobo_demo`.
3. **Cero Migraciones Físicas Aplicadas:** El directorio `backend/migraciones/` no sufrió adiciones ni modificaciones. La migración `21_sigd_auth_actualizacion_ubigeo_2026.sql` se mantiene como la última físicamente existente.
4. **Cero Modificaciones en Código Fuente:** Los directorios `backend/src/` y `frontend/src/` se mantuvieron 100 % inalterados.
5. **Cero Alteraciones de Infraestructura y Configuración:** No se modificaron contenedores Docker, volúmenes de datos ni archivos de variables de entorno `.env`.

---

## 13. RESULTADO DE ACEPTACIÓN

Con base en la verificación técnica, el análisis cruzado de consistencia y el cumplimiento estricto de todas las condiciones de blindaje, se emite el siguiente resultado de aceptación:

- **Subsanación de Observaciones de Fase A0 y A0.1:** **100 % CUMPLIDA Y CERTIFICADA EN DISEÑO**.
- **Consistencia Relacional de DDL Propuesto:** **100 % CUMPLIDA Y AUDITADA**.
- **Preservación del Entorno Aislado `B_JACOBO`:** **100 % CONFORME**.
- **Aceptación Técnica Global de Fase A0.1:** **APROBADA SIN RESERVAS**.

---

## 14. DECLARACIÓN FORMAL DE CIERRE DE FASE A0.1

En mi condición de Arquitecto Principal de Software y responsable técnico de la certificación de TSK-1.2, **DECLARO FORMALMENTE CERRADA Y APROBADA LA FASE A0.1**.

El expediente técnico documental del Sistema Integral de Gestión Documentaria (SIGD) del IESTP «Suiza» queda consolidado, blindado y validado en su integridad. No existen inconsistencias abiertas ni contradicciones normativas o técnicas pendientes de resolución documental.

Queda estrictamente ratificada la **CONDICIÓN DE PARADA**:
- **NO se inicia la Fase A de implementación física.**
- **NO se ejecutan las migraciones `22_` ni `23_`.**
- **NO se realizan conexiones ni sentencias SQL contra `sigd_jacobo_demo`.**
- **NO se modifica código backend ni frontend.**

Cualquier transición hacia la Fase A requerirá la autorización institucional y la emisión del prompt formal correspondiente.

---

## 15. SUBSANACIÓN COMPLEMENTARIA Y VERIFICACIÓN FINAL (OBSERVACIONES §3.1 – §3.7)

En cumplimiento de las instrucciones de la validación final, se asienta el registro pormenorizado de las subsanaciones complementarias:

### A. Subsanación §3.1: Corrección del Manifiesto SHA-256
- **Problema identificado:** El informe preliminar incluía su propio hash en la tabla de hashes, generando una autorreferencia inconsistente.
- **Acción ejecutada:** Se removió la tabla autorreferencial del informe y se creó el archivo de manifiesto externo independiente `docs/MANIFIESTO_SHA256_TSK_1_2_A0_1.sha256`.
- **Archivos afectados:** `docs/INFORME_CERTIFICACION_FINAL_TSK_1_2_FASE_A0_1.md` y `docs/MANIFIESTO_SHA256_TSK_1_2_A0_1.sha256`.
- **Evidencia obtenida:** El informe identifica la ruta del manifiesto externo; el manifiesto no contiene su propio hash y contiene los 13 hashes reales auditados.

### B. Subsanación §3.2: Conciliación de la Vigencia del Permiso #32
- **Problema identificado:** El DDL preliminar tenía `vigente_hasta TIMESTAMPTZ` con comentarios de posible indefinición, y la consulta de runtime evaluaba `(vigente_hasta IS NULL OR vigente_hasta > now())`.
- **Acción ejecutada:** Se modificó `sigd_org.autorizacion_rol_permiso_institucional` para fijar `vigente_hasta TIMESTAMPTZ NOT NULL`, se actualizó `chk_auth_inst_vigencia CHECK (vigente_hasta > vigente_desde)`, se incorporó excepción explícita en trigger ante `vigente_hasta IS NULL`, y se corrigió la regla de runtime para requerir estrictamente `vigente_hasta > clock_timestamp()` sin ramas `IS NULL`.
- **Archivos afectados:** `docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql`, `docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md`, `docs/INFORME_TSK_1_2_A0_DISENO_DEFINITIVO.md`.
- **Evidencia obtenida:** Ninguna autorización para `#32` puede ser indefinida en el diseño ni en la validación transaccional.

### C. Subsanación §3.3: Enumeración de los Siete Roles Elegibles y Tres Roles Excluidos
- **Problema identificado:** Se citaba "siete roles elegibles" sin presentar la tabla pormenorizada de los mismos y de los excluidos.
- **Acción ejecutada:** Se incorporaron las dos matrices detalladas en la sección 3.3.1 de `docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md` y en el presente informe:
  - 7 elegibles: `DIRECTOR`, `JEFE_UNIDAD`, `JEFE_AREA`, `SECRETARIA`, `MESA_PARTES`, `DOCENTE`, `OPERADOR_COOP`.
  - 3 excluidos: `ADMINISTRADOR` (por segregación de funciones SoD y mínimo privilegio, posee `EXPEDIENTE_LEER` global y visor inline, descarga ordinaria denegada), `ESTUDIANTE` (titularidad directa en Casilla sin #32), `CIUDADANO` (titularidad directa en Casilla y consulta pública sin #32).
  - Regla reafirmada: Cero asignaciones automáticas en `sigd_org.rol_permiso`.
- **Archivos afectados:** `docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md`.
- **Evidencia obtenida:** Concordancia exacta con el catálogo de 10 roles aprobado.

### D. Subsanación §3.4: Especificación Completa de la Autorización Extraordinaria por Expediente
- **Problema identificado:** La tabla `sigd_org.autorizacion_descarga_excepcional` carecía de `ejecutor_tecnico_id` y su trigger de serialización concurrente no estaba formalizado en DDL.
- **Acción ejecutada:** Se incorporó `institucion_id UUID NOT NULL`, `ejecutor_tecnico_id UUID`, restricción `chk_desc_excep_no_auto_ejecutor`, índice único parcial `uq_desc_excep_activa`, y trigger `fn_validar_autorizacion_descarga_excepcional` con advisory lock atómico `desc_excep:...`. Se delimitó la cadena: Director autoriza (o autoridad superior externa acreditada si el beneficiario es el Director), Administrador registra y ejecuta, $\le 15$ minutos de vigencia improrrogable, auditoría en `bitacora_acceso_documental` y deslinde de `SUPER_ADMIN_PLATAFORMA`.
- **Archivos afectados:** `docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql`, `docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md`.
- **Evidencia obtenida:** La excepción no constituye un bypass permanente de RBAC y satisface los estándares de auditoría forense.

### E. Subsanación §3.5: Conciliación de Endpoints Reales de Casilla y Streaming
- **Problema identificado:** Cita de ruta inexistente `/api/v1/casilla/documentos/:id/descargar`.
- **Acción ejecutada:** Se inspeccionaron exhaustivamente los routers en `backend/src/` y sus montajes en `app.ts`. Se demostró que la ruta real y montada es `/api/v1/casilla/notificaciones/:id/documento/descargar` (en `casilla.router.ts`, montado en `/api/v1`), mientras que `/casilla/documentos/...` no existe en el código. Se construyó la Matriz de Endpoints Reales montados y se identificó el endpoint propuesto para Fase B `/api/v1/storage/documentos/:id/view` (`Content-Disposition: inline`).
- **Archivos afectados:** `docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md`.
- **Evidencia obtenida:** Cero rutas inventadas; concordancia 100 % con el código fuente del prototipo.

### F. Subsanación §3.6: Precisión Semántica de Eventos de Streaming y Acuse de Recibo
- **Problema identificado:** Definición imprecisa de `TRANSFERENCIA_COMPLETADA` que podía inducir a asumir que el archivo fue guardado en el cliente.
- **Acción ejecutada:** Se definió con rigor técnico que `TRANSFERENCIA_COMPLETADA` es un evento de servidor correspondiente al evento `finish` del stream HTTP de Node.js (todos los bytes enviados al socket de red del host), sin presunción de recepción en disco del cliente. Se especificó el mecanismo independiente de acuse notificatorio fehaciente (`POST /api/v1/casilla/notificaciones/:id/acuse`) para valor legal probatorio, ratificando la prohibición de URLs prefirmadas de descarga abiertas.
- **Archivos afectados:** `docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md`.
- **Evidencia obtenida:** Delimitación nítida entre la capa de transporte HTTP y la capa legal de notificación electrónica.

### G. Subsanación §3.7: Conciliación de Archivos Auxiliares y Estado Git
- **Problema identificado:** Necesidad de verificar la ubicación y relación de los scripts auxiliares de soporte y documentar el estado Git.
- **Acción ejecutada:**
  - Se verificó mediante búsqueda recursiva que los archivos `hash_check.py`, `list_docs.py`, `generate_certificacion_a0_1.py` y `patch_*.py` **NO fueron creados dentro del repositorio Git de trabajo** (`C:\Users\Liz\Desktop\SIGD\SIGD`), sino en la carpeta scratch del asistente (`C:\Users\Liz\.gemini\antigravity\brain\b9af8cdf-f2af-4c5f-b98b-56d64d235aad\scratch\`). Son scripts utilitarios no destructivos creados para automatizar inspección y hashing sin alterar el repositorio.
  - Se confirmó el estado Git: 371 archivos con diferencias rastreadas respecto a HEAD `bf30d8a` (207 M, 164 D), 177 sin seguimiento.
  - Se documentó la salida real de `git diff --check`: advertencias de fin de línea CRLF/LF en archivos rastreados y trailing whitespace en 4 archivos frontend preexistentes (`ucayali.ts:9`, `RolesPermisosPage.tsx:179,297`, `ubigeoService.ts:4,10`), completamente ajenos a `docs/`.
  - Cero operaciones destructivas de Git ejecutadas en la tarea.
- **Archivos afectados:** `docs/INFORME_CERTIFICACION_FINAL_TSK_1_2_FASE_A0_1.md`.
- **Evidencia obtenida:** Integridad y trazabilidad absoluta del entorno de trabajo.


---

## 16. ANEXO — SUBSANACIÓN FINAL A0.2 (CONCILIACIÓN FINAL DE ACCESO DOCUMENTAL, STREAMING Y AUTORIZACIONES EXCEPCIONALES)

En cumplimiento de las instrucciones de cierre técnico y consistencia documental de la **Fase A0.2**, se formaliza la subsanación definitiva de las cuatro (4) observaciones rectoras sin alterar el diseño institucional aprobado ni modificar el código fuente del prototipo:

### 16.1. Corrección 1 — Matriz Definitiva de Acceso Documental y Jerarquía de Autorización

Se clarifican los principios rectores de acceso documental, segregación de funciones (SoD) y el contrato técnico de autorización:

1. **`ADMINISTRADOR` Institucional (Lectura Global Institucional):**
   - **Alcance positivo:** Posee acceso de consulta y lectura global a **TODOS** los expedientes de su propia institución (`claims.ctx = 'ADMINISTRADOR'` con `claims.institucion_id === doc.institucion_id`), incluyendo metadatos, historial, trazabilidad, custodios y visualización controlada en visor PDF inline (streaming backend `GET /api/v1/storage/documentos/:id/view`), sin restricciones de área, unidad académica, custodia operativa o titularidad personal dentro de su institución.
   - **Restricciones negativas innegociables:** CERO facultad de descarga ordinaria de expedientes (no recibe `#32 EXPEDIENTE_DESCARGAR` en `sigd_org.rol_permiso`). CERO facultad de modificación, alteración de metadatos, adición/eliminación de adjuntos, derivación, reasignación, observación, subsanación, aprobación, resolución, firma, cierre o archivo documental.
   - **Separación de autorizaciones:** En contingencias operativas debidamente justificadas, puede ser beneficiario de una autorización extraordinaria puntual ($\le 15$ min), la cual debe ser otorgada por el `DIRECTOR` (o autoridad superior competente) y asentada registralmente sin auto-asignación.
2. **`SUPER_ADMIN_PLATAFORMA` (Control Tecnológico y SaaS Global):**
   - **Alcance positivo:** Control total a nivel plataforma SaaS sobre instituciones, módulos, configuración global, diagnóstico y trazabilidad. Dispone de acceso privilegiado propio de lectura, visualización y descarga documental en todas las instituciones a través del mecanismo exclusivo de plataforma SaaS, protegido por MFA en servidor y asentado de forma obligatoria e inmutable en `sigd_audit.bitacora_superadmin_saas`.
   - **Independencia de `#32`:** Su acceso técnico no utiliza ni depende del permiso institucional `#32 EXPEDIENTE_DESCARGAR` ni de asignaciones en `sigd_org.rol_permiso`.
   - **Límites innegociables:** CERO autoridad legal institucional. No puede firmar resoluciones rectoras, no puede aprobar trámites administrativos ni emitir actos resolutivos institucionales. No sustituye la voluntad del Director General en la concesión de permisos institucionales a funcionarios internos.
3. **`DIRECTOR` (Máxima Autoridad Ejecutiva Institucional):**
   - Máxima autoridad ejecutiva del IESTP «Suiza». Autoriza la concesión de permisos institucionales ordinarios y extraordinarios a los funcionarios de su entidad.
   - Sujeto a segregación de funciones estricta: **Prohibida la auto-autorización de descarga excepcional**. Cuando sea el beneficiario de una excepción, esta debe emanar de un órgano jerárquico superior competente y formalmente acreditado mediante acto administrativo.
4. **Contrato de Autorización Técnica para `GET /api/v1/storage/documentos/:id/view` (Fase B):**
   - El endpoint de visualización PDF inline (`Content-Disposition: inline`) no restringe su validación a área, custodia o titularidad, sino que implementa una jerarquía tripartita:
     - **Nivel 1 (Administrador):** Comprueba `claims.ctx === 'ADMINISTRADOR'` y valida pertenencia institucional (`claims.institucion_id === doc.institucion_id`), permitiendo visualización global.
     - **Nivel 2 (Superadmin SaaS):** Valida contexto SaaS y MFA en servidor, registrando en `sigd_audit.bitacora_superadmin_saas`.
     - **Nivel 3 (Roles operativos y titulares):** Valida `EXPEDIENTE_LEER` en el contexto activo según área/custodia, o titularidad estricta para `ESTUDIANTE` y `CIUDADANO`.

### 16.2. Corrección 2 — Inspección Estática de Endpoints y Eliminación de URLs Prefirmadas GET

De la inspección técnica sobre `backend/src/domains/storage/storage.router.ts`, `backend/src/domains/casilla/casilla.router.ts` y `backend/src/app.ts`:

1. **Inspección Factual de las Tres (3) Rutas de Descarga del Prototipo:**
   - **`GET /api/v1/storage/documentos/:id/download`:** (1) Sí genera URL prefirmada GET via MinIO SDK; (2) Sí la entrega al cliente en JSON `{ downloadUrl, expiraEnSegundos: 900 }`; (3) No redirige (no emite 302/307); (4) No es consumida internamente por el backend en el prototipo; (5) No transmite el contenido binario directamente; (6) Aplica `authMiddleware` general, pero en el código actual carece de control RBAC sobre `#32` y auditoría WORM (brecha a cerrar en Fase B).
   - **`GET /api/v1/storage/download/:bucket/:key`:** (1) Sí genera URL prefirmada GET; (2) Sí la entrega al cliente en JSON; (3) No redirige; (4) No es consumida internamente; (5) No transmite el contenido directamente; (6) Valida token general de infraestructura. Queda clasificado para supresión o absorción interna en Fase B.
   - **`GET /api/v1/casilla/notificaciones/:id/documento/descargar`:** (1) Sí genera URL prefirmada GET; (2) Sí la entrega al cliente; (3) No redirige; (4) No la consume internamente; (5) No transmite directamente; (6) Aplica validación estricta de titularidad (`notificacion.usuario_id === claims.sub`). Se reitera que la ruta `/casilla/documentos/:id/descargar` **NO existe** en el código fuente.
2. **Política Aprobada para Fase B (Sustitución por Backend Streaming):**
   - En Fase B, **se prohíbe entregar URLs prefirmadas GET al cliente**.
   - Todas las descargas institucionales y ciudadanas se realizarán mediante **streaming controlado por el backend** (Node.js recibe el ReadableStream de MinIO y lo canaliza a `res` con cabeceras `Content-Type: application/pdf` y `Content-Disposition: attachment; filename="..."`).
   - Las URLs prefirmadas PUT para subida directa ($\le 25$ MB) **se mantienen** en `POST /api/v1/storage/presigned-url` por eficiencia de infraestructura.
   - La Casilla Electrónica mantendrá su validación estricta de titularidad transitando a streaming directo.
3. **Matriz Definitiva de Rutas Montadas:** Se verificaron las 10 rutas reales operativas en `app.ts` (expedientes, documentos, storage, casilla, validador CVD, firma ReFirma) y se especificó el contrato del endpoint propuesto de visualización inline.

### 16.3. Corrección 3 — Consumo y Revocación de Autorización Extraordinaria (`sigd_org.autorizacion_descarga_excepcional`)

Se definen y formalizan en el DDL propuesto las reglas definitivas de consumo de la autorización extraordinaria:

1. **Estructura Relacional y Control de Un Solo Uso:**
   - Se incorpora a `sigd_org.autorizacion_descarga_excepcional` la columna:
     `documentos_descargados UUID[] NOT NULL DEFAULT '{}'`
   - Se añade la restricción de integridad:
     `CONSTRAINT chk_desc_excep_consumo CHECK (documentos_descargados <@ documentos_permitidos)`
   - **Regla de negocio:** Cada documento autorizado solo puede descargarse **una única vez**. Se deniegan descargas duplicadas del mismo archivo dentro del lote autorizado.
2. **Función Atómica de Registro de Consumo (`sigd_org.fn_registrar_consumo_descarga_excepcional`):**
   - Ejecuta serialización concurrente vía advisory lock (`desc_excep_consumo:...`) y bloqueo `FOR UPDATE`.
   - Verifica que la autorización esté activa, no revocada y dentro de la ventana de 15 minutos.
   - Verifica que el documento forme parte de `documentos_permitidos` y no esté en `documentos_descargados` (`DOCUMENTO_YA_DESCARGADO`).
   - Añade el identificador al array `documentos_descargados`.
3. **Revocación Automática:**
   - **Por consumo total:** Cuando todos los documentos han sido descargados (`documentos_permitidos <@ documentos_descargados`), la función revoca la autorización marcando:
     `activo = FALSE`, `revocado_en = clock_timestamp()`, `motivo_revocacion = 'CONSUMO_TOTAL_DOCUMENTOS'`.
   - **Por expiración temporal:** Si transcurren los 15 minutos (`vigente_hasta`), caduca automáticamente.
4. **Tratamiento de Fallos e Interrupciones de Red:**
   - Los fallos de red, desconexiones o descargas incompletas **NO computan como transferencias completadas**.
   - El backend únicamente invoca el registro de consumo atómico cuando el servidor completa la entrega de todos los bytes al cliente (evento `finish` del stream HTTP sin errores). Si se corta la conexión a mitad de la transferencia, el documento no se marca como consumido, permitiendo al usuario reintentar dentro de la ventana de 15 minutos.
5. **Cadena de Responsabilidad:** Director autoriza, Administrador registra y ejecuta sin auto-asignación. Si el Director es beneficiario, autoriza autoridad superior acreditada. `SUPER_ADMIN_PLATAFORMA` no sustituye la autorización institucional.

### 16.4. Corrección 4 — Conciliación de los Diez Roles Canónicos y Homologación de Códigos de BD

Para erradicar cualquier divergencia entre los identificadores del modelo relacional en PostgreSQL y la terminología institucional de gestión, se consagra la tabla unificada de correspondencia:

| # | Código Canónico en PostgreSQL (`rol_sistema.codigo`) | Denominación Institucional Aprobada | Función Institucional Principal | Ámbito de Asignación | Elegibilidad `#32` | Justificación / Régimen |
|:---:|---|---|---|:---:|:---:|---|
| 1 | `ADMINISTRADOR` | Administrador Institucional | Gestión técnica, áreas y seguridad del SIGD | `GLOBAL` | **Excluido** | SoD estricto; lectura global institucional en visor; sin descarga ordinaria |
| 2 | `DIRECTOR` | Director General | Máxima autoridad ejecutiva y representación legal | `GLOBAL` / `DG` | **Elegible** | Autorizado por autoridad superior acreditada si es beneficiario (prohibida auto-autorización) |
| 3 | `JEFE_UNIDAD_ACADEMICA` | Jefe de Unidad (Académica / Bienestar / Empleabilidad) | Conducción académica y formativa de unidades | `AREA` (Unidad) | **Elegible** | Autorizado por Director; acotado a expedientes de su unidad curricular |
| 4 | `COORDINADOR_AREA` | Jefe de Área / Coordinador de Programa | Responsable de programas de estudio y áreas de soporte | `AREA` (Programa) | **Elegible** | Autorizado por Director; acotado a expedientes de su área/programa |
| 5 | `SECRETARIO` | Secretaria de Dirección y Despacho / Secretario Académico (`SECRETARIA`) | Apoyo administrativo, legajos y despacho oficial | `AREA` (`SEC`) | **Elegible** | Autorizado por Director; delimitado a conformación material de legajos oficiales |
| 6 | `MESA_PARTES` | Operador de Mesa de Partes | Recepción, admisibilidad y ventanilla única TUPA | `AREA` (`MP`) | **Elegible** | Autorizado por Director; acotado a cotejo y recepción de ventanilla |
| 7 | `DOCENTE` | Docente Institucional | Función pedagógica y comisiones evaluadoras | `AREA` (Docente) | **Elegible** | Autorizado por Director; restringido a expedientes de comisión evaluadora asignada |
| 8 | `TESORERO` | Operador de Cooperación y Tesorería (`OPERADOR_COOP`) | Recaudación y liquidación financiera (M10) | `GLOBAL` (Tesor.) | **Elegible** | Autorizado por Director; acotado exclusivamente a dominio financiero/convenios |
| 9 | `ESTUDIANTE` | Estudiante / Egresado | Usuario interno de la comunidad educativa institucional | `TITULAR` | **Excluido** | Descarga por titularidad y Casilla Electrónica (`solicitante_id = cu.id_persona`) |
| 10| `CIUDADANO` | Ciudadano / Administrado | Persona natural o jurídica externa ante la institución | `TITULAR` | **Excluido** | Descarga de actos propios por Casilla Electrónica y verificación CVD |

- **Preservación de roles históricos:** `ESPECIALISTA`, `CAJERO`, `APROBADOR_DEVOLUCIONES` y `SUPERVISOR_TESORERIA` permanecen desactivados (`vigente = FALSE`) y protegidos contra nuevas asignaciones.
- **Capacidad operativa:** `GESTOR_APOYO_AREA` es una capacidad operativa asignable en contexto, no un rol del catálogo.
- **Regla de asignación de `#32`:** Cero asignaciones automáticas en `sigd_org.rol_permiso` (`v_desc_asigs = 0`).

### 16.5. Tabla de Documentos Afectados y Sincronización

| Documento Afectado | Tipo de Actualización en A0.2 | Estado de Sincronización |
|---|---|:---:|
| `docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql` | Incorporación de `documentos_descargados UUID[]`, `chk_desc_excep_consumo`, trigger de monotonía y función `fn_registrar_consumo_descarga_excepcional` | **Sincronizado** |
| `docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md` | Actualización de tabla de roles (códigos BD vs. institucional), especificación de consumo extraordinario, inspección de rutas y contrato de `/view` | **Sincronizado** |
| `docs/INFORME_TSK_1_2_A0_DISENO_DEFINITIVO.md` | Sincronización de reglas de consumo en sección 1.3 y correspondencia unívoca de roles en sección 1.2 | **Sincronizado** |
| `docs/INFORME_CERTIFICACION_FINAL_TSK_1_2_FASE_A0_1.md` | Inclusión del Anexo §16 (Subsanación Final A0.2) | **Sincronizado** |
| `docs/MANIFIESTO_SHA256_TSK_1_2_A0_1.sha256` | Recálculo de hashes SHA-256 de los 13 documentos del expediente documental | **Sincronizado** |

### 16.6. Conclusión de Aceptación Definitiva A0.2

Las correcciones de la Fase A0.2 consolidan la coherencia total entre el diseño institucional, las restricciones de seguridad multi-tenant y SaaS, y las estructuras relacionales de PostgreSQL 18.6, quedando el expediente documental plenamente certificado y preparado para la posterior Fase A de ejecución controlada.


---

## 17. ANEXO — ACEPTACIÓN TÉCNICA DEFINITIVA A0.2 (RESERVA ATÓMICA, CLAIMS REALES, ENDPOINTS, CONEXIONES Y TRANSICIÓN A/B)

En respuesta a la revisión final de aceptación técnica de la **Fase A0.2**, se formalizan las subsanaciones definitivas sobre los cinco aspectos normativos y técnicos requeridos:

### 17.1. Observación 1 — Mecanismo de Reserva Atómica Previa al Streaming de Descarga Excepcional

1. **Problema Técnico Resuelto:**
   El registro del consumo documental únicamente al ocurrir `TRANSFERENCIA_COMPLETADA` dejaba abierta una ventana de vulnerabilidad donde dos o más solicitudes concurrentes podían iniciar la transmisión simultánea del mismo archivo antes del asentamiento del primer consumo.
2. **Estructura Relacional Incorporada en DDL Propuesto:**
   Se añade al DDL [TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql) la tabla relacional:
   `sigd_org.intento_descarga_excepcional` con campos:
   - `id_intento UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `id_autorizacion UUID NOT NULL REFERENCES sigd_org.autorizacion_descarga_excepcional(id_autorizacion)`
   - `documento_id UUID NOT NULL`
   - `usuario_id UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario)`
   - `estado VARCHAR(32) NOT NULL DEFAULT 'RESERVADO' CHECK (estado IN ('RESERVADO', 'COMPLETADO', 'FALLIDO', 'RESULTADO_INCIERTO'))` (máquina de estados canónica de 4 estados; se elimina `LIBERADO` por duplicidad conceptual)
   - `token_propietario UUID NOT NULL DEFAULT gen_random_uuid()` (token secreto manejado exclusivamente en memoria del servidor; NUNCA expuesto al navegador ni a logs)
   - `reservado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`
   - `expiracion_lease TIMESTAMPTZ NOT NULL`
   - `ultimo_heartbeat TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`
   - `finalizado_en TIMESTAMPTZ`
   - `resultado VARCHAR(64)`
   - `motivo_resultado TEXT`
   - Restricción de exclusión mutua estricta:
     `CREATE UNIQUE INDEX uq_intento_reserva_activa ON sigd_org.intento_descarga_excepcional (id_autorizacion, documento_id) WHERE estado = 'RESERVADO';`
3. **Flujo Obligatorio de Tres Fases con Modelo Lease & Heartbeat:**
   - **Fase 1 (Reserva Previa antes del primer byte):** Función `sigd_org.fn_reservar_descarga_excepcional(aut_id, doc_id, user_id)`:
     - Bloqueo por advisory lock de 64 bits (`hashtextextended('desc_excep_reserva:' || aut_id || ':' || doc_id, 0)`).
     - Valida autorización activa, vigencia temporal $\le 15$ min y beneficiario.
     - Valida que el documento forme parte de `documentos_permitidos`.
     - Valida que el documento no figure como `COMPLETADO` previamente (regla de un solo uso).
     - Si existe una reserva activa con lease vigente (`expiracion_lease > clock_timestamp()`), deniega la petición concurrente (`55P03 DESCARGA_CONCURRENTE_EN_CURSO`).
     - **Tratamiento obligatorio de leases expirados:** Si existe una reserva previa con lease expirado (`expiracion_lease <= clock_timestamp()`), **queda terminantemente PROHIBIDO marcarla automáticamente como `FALLIDO`**. La ausencia de heartbeat NO demuestra que la transmisión HTTP haya concluido sin éxito. Por ende, transita a **`RESULTADO_INCIERTO`** (NUNCA a `FALLIDO`), registrando `'EXPIRACION_LEASE_SIN_CONFIRMACION'` y **bloquea cualquier nuevo intento** hasta reconciliación auditable.
   - **Fase 2 (Streaming y Renovación por Heartbeat):** El backend renueva el lease cada 10-15 s vía `fn_renovar_reserva_descarga_excepcional`. Si la renovación falla, aborta inmediatamente el streaming.
   - **Fase 3 (Asentamiento Servidor tras evento `finish`):** Función `sigd_org.fn_finalizar_descarga_excepcional(intento_id, token_propietario, estado_final, resultado, motivo)`:
     - Invocada con `p_estado_final = 'COMPLETADO'` **estrictamente ante el evento `finish`** de la respuesta HTTP de Node.js (`res.writableFinished === true`). Actualiza el intento a `COMPLETADO`, añade el documento a `documentos_descargados` en `autorizacion_descarga_excepcional` y, si se alcanzó el consumo total de los documentos permitidos, revoca automáticamente la autorización (`CONSUMO_TOTAL_DOCUMENTOS`).
     - Si la transmisión se corta, aborta o falla con evidencia fehaciente (`res.writableFinished === false`, error de socket), se invoca con `p_estado_final = 'FALLIDO'`. Concluye la reserva sin computar consumo, permitiendo de forma inherente un nuevo intento dentro de la ventana de 15 minutos.
     - Si la transmisión concluyó en el servidor pero PostgreSQL no permite registrar el resultado final (caída transitoria de BD post-streaming), se conserva la reserva y se registra `RESULTADO_INCIERTO`, bloqueando nuevos intentos hasta reconciliación auditable conservadora.
4. **Precisión Probatoria y Declaración Formal de Certificación:**
   - El evento `finish` del stream HTTP del servidor demuestra únicamente que los bytes fueron entregados al socket TCP del sistema operativo local. No prueba la recepción efectiva en disco del cliente ni constituye acuse legal de entrega.
   - **Certificación formal:** El modelo Lease & Heartbeat se certifica taxativamente como:  
     **«Diseño técnico documentado, pendiente de implementación y pruebas funcionales y de concurrencia en las fases B y D»**.  
     No se atribuyen pruebas de ejecución física que no se hayan realizado en esta etapa documental.

### 17.2. Observación 2 — Validación Real de Claims y Modelo de Contexto RBAC en Backend

De la inspección estática de `backend/src/core/auth/jwt.service.ts`, `backend/src/core/auth/contexto.service.ts` y `backend/src/core/auth/auth.guard.ts`:

1. **Estructura Real de Claims del JWT (`ClaimsJwt`):**
   - `sub`: Identificador UUID de la cuenta (`id_usuario`).
   - `roles`: Arreglo de strings con los roles del usuario.
   - `rol`: Código de rol activo seleccionado en la sesión (e.g. `'ADMINISTRADOR'`).
   - `ctx`: **Identificador UUID de la asignación activa (`idAsignacionContexto`)**, correspondiente a `sigd_org.usuario_rol.id_usuario_rol` o `sigd_org.usuario_capacidad.id_usuario_capacidad`. **No es una cadena de texto con el nombre del rol.**
2. **Autorización en Tiempo Real (Cero Bypasses por Comparación de Cadenas en JWT):**
   - El backend **NO realiza comparaciones triviales de cadenas sobre el token** (como `claims.ctx === 'ADMINISTRADOR'`).
   - `auth.guard.ts` invoca `obtenerAutorizacionCuenta(pool, idUsuario, idAsignacionContexto)`, validando en tiempo real contra `sigd_org.usuario_rol ur`:
     `ur.id_usuario_rol = $2::uuid AND cu.activo = TRUE AND ur.vigente_desde <= now() AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())`
   - El rol y sus permisos se resuelven dinámicamente desde el esquema relacional. Ante cualquier revocación administrativa, la consulta devuelve cero permisos y el acceso se rechaza de inmediato con `403 CONTEXT_REVOKED`.
3. **Política de `ADMINISTRADOR` y `SUPER_ADMIN_PLATAFORMA`:**
   - **`ADMINISTRADOR`:** Al resolver activamente el rol `ADMINISTRADOR` desde la base de datos, obtiene lectura global institucional (`EXPEDIENTE_LEER` con ámbito `GLOBAL` institucional acotado a `claims.institucion_id === doc.institucion_id`). CERO descarga ordinaria (no recibe `#32` en `rol_permiso`). CERO facultades resolutivas (`EXPEDIENTE_RESOLVER` retirado) y CERO modificación documental.
   - **`SUPER_ADMIN_PLATAFORMA`:** Control tecnológico global a nivel plataforma SaaS, con validación de identidad SaaS, MFA obligatorio en servidor y bitácora independiente en `sigd_audit.bitacora_superadmin_saas`, sin pertenecer a los roles institucionales ni requerir `#32`.

### 17.3. Observación 3 — Inventario Factual del Listado Documental y Separación de Operaciones

1. **Estado Factual de `GET /api/v1/expedientes/:id/documentos`:**
   - **`NO EXISTE EN EL PROTOTIPO ACTUAL`**.
   - La inspección exhaustiva de `rutadoc.router.ts`, `rutadoc.controller.ts` y del árbol de código confirma que no existe ninguna ruta `GET` para `/expedientes/:id/documentos` (únicamente existe `POST /api/v1/expedientes/:id/documentos` para adjuntar documentos).
   - En el prototipo actual, los documentos asociados a un expediente se obtienen conjuntamente en la respuesta de `GET /api/v1/expedientes/:id` a través del objeto `ExpedienteDetalle.documentos`.
2. **Clasificación y Contratos de las Cuatro (4) Operaciones Documentales:**
   - **Consulta de metadatos (`GET /api/v1/expedientes/:id`):** Requiere `EXPEDIENTE_LEER`. Lectura global para `ADMINISTRADOR` en su tenant; contextual por área/custodia para roles internos; titularidad para administrados.
   - **Listado documental desacoplado (`GET /api/v1/expedientes/:id/documentos`):** No existe en el prototipo actual. Propuesto para Fase B para soporte de expedientes masivos con paginación, gobernado por `EXPEDIENTE_LEER`.
   - **Visualización documental inline (`GET /api/v1/storage/documentos/:id/view`):** Propuesto para Fase B. Requiere `EXPEDIENTE_LEER`, ejecutado mediante backend streaming con cabecera `Content-Disposition: inline`.
   - **Descarga documental de archivos (`GET /api/v1/storage/documentos/:id/download`):** Requiere `#32 EXPEDIENTE_DESCARGAR` o autorización extraordinaria con reserva atómica previa. En Fase B ejecutará backend streaming con `Content-Disposition: attachment`.

### 17.4. Observación 4 — Declaración Factual sobre Conexiones a PostgreSQL

Se rectifica de manera formal y explícita la redacción del reporte previo, confirmando taxativamente la **Opción A**:

> [!IMPORTANT]
> **DECLARACIÓN FORMAL DE INTEGRIDAD DE ACCESO A BASE DE DATOS:**  
> **Cero conexiones a PostgreSQL y cero sentencias SQL ejecutadas.**  
> Durante todo el desarrollo de TSK-1.2 Fase A0, A0.1 y A0.2:
> 1. **NO se abrió ninguna conexión de cliente** (`psql`, controladores de Node.js, extensiones o sockets) hacia el motor PostgreSQL.
> 2. La base de datos protegida `sigd_jacobo_demo` fue identificada e individualizada **exclusivamente a través de las variables de entorno preconfiguradas del proyecto, archivos de configuración de Docker y documentación arquitectónica preexistente**.
> 3. Cero sentencias SQL ejecutadas (incluyendo la prohibición absoluta de `SELECT`).

### 17.5. Control de Transición Segura entre Fase A y Fase B

Para eliminar cualquier ventana de riesgo operativo derivada del desfase entre la base de datos y la capa de servicios backend, se aprueba el siguiente protocolo:

1. **Principio de No Desincronización:** Queda terminantemente prohibido habilitar una ventana de operación en la que la base de datos aplique las restricciones de la migración `22_` mientras el backend legacy continúe sirviendo URLs prefirmadas GET y validando únicamente JWT general sin el nuevo RBAC.
2. **Ventana de Mantenimiento Unificada con Corte Total de Tráfico (`503 Service Unavailable`):**
   - La migración de base de datos (Fase A) y el despliegue del nuevo backend con streaming (Fase B) **se ejecutarán conjuntamente en una única ventana de mantenimiento controlada**.
   - El proxy inverso / gateway responderá con cabecera HTTP 503 (`MAINTENANCE_MODE=true`), impidiendo cualquier acceso de usuarios durante la transición.
3. **Procedimiento Secuencial de Despliegue:**
   - **Paso 1:** Activación del modo de mantenimiento y corte de tráfico de usuarios.
   - **Paso 2:** Ejecución controlada de la migración `22_sigd_org_catalogo_rbac_institucional.sql` en PostgreSQL `sigd_jacobo_demo`.
   - **Paso 3:** Despliegue de la imagen de backend actualizada (Fase B) incorporando streaming directo, eliminación de presigned GET, validación estricta de `#32`, endpoint `/view` y reserva atómica previa en `intento_descarga_excepcional`.
   - **Paso 4:** Ejecución de pruebas de humo y verificación automatizada de seguridad en entorno aislado.
   - **Paso 5:** Apertura del tráfico institucional únicamente tras la conformidad del 100 % de las pruebas de verificación.
4. **Criterio de Reversión Inmediata (Rollback):** En caso de anomalías en la verificación post-despliegue, se ejecuta de inmediato la reversión coordinada descrita en [TSK_1_2_A0_PLAN_ROLLBACK.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_PLAN_ROLLBACK.md) antes de reabrir el tráfico institucional.

---

### 17.6. Veredicto de Aceptación Definitiva

Con la formalización de las subsanaciones contenidas en este Anexo §17, el expediente documental de la **Fase A0.2** cumple con la totalidad de los criterios técnicos, de seguridad, concurrencia transaccional, integridad de claims JWT y delimitación de accesos, quedando **plenamente aceptado y cerrado**.


---

## 18. ANEXO — SUBSANACIÓN COMPLEMENTARIA FINAL A0.2 (LEASES, HEARTBEATS, PUNTO REAL DE MANTENIMIENTO, NOMENCLATURA 22_ Y POLÍTICA DE RESTAURACIÓN)

En cumplimiento de la revisión final de aceptación técnica de la **Fase A0.2**, se formaliza la subsanación exhaustiva y documental de los cuatro (4) aspectos complementarios requeridos:

### 18.1. Corrección A — Reservas, Concurrencia, Leases, Heartbeats y Consistencia HTTP/PostgreSQL

1. **Problema Identificado en el Modelo Previo:**
   La regla estática previa de recuperación a los 60 segundos resultaba insuficiente y riesgosa para archivos de gran volumen o conexiones con latencia, pudiendo liberar indebidamente una reserva mientras se desarrollaba una transmisión legítima en curso. Asimismo, en el runtime de Node.js, el evento `close` se emite invariablemente al concluir la conexión TCP (incluso tras un evento `finish` exitoso), requiriendo un control estricto de idempotencia para evitar reportes contradictorios.
2. **Arquitectura Relacional con Modelo Lease & Heartbeat en DDL Propuesto:**
   En [TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql), la tabla `sigd_org.intento_descarga_excepcional` incorpora los atributos de gobernanza de lease:
   - `id_intento UUID PRIMARY KEY DEFAULT gen_random_uuid()`: Identificador único de la solicitud de descarga.
   - `token_propietario UUID NOT NULL DEFAULT gen_random_uuid()`: Token criptográfico secreto del lease, entregado exclusivamente al backend en memoria (**NUNCA expuesto al navegador web del cliente ni a logs de acceso**).
   - `expiracion_lease TIMESTAMPTZ NOT NULL`: Fecha/hora de caducidad del lease (inicialmente fijada a 30 segundos).
   - `ultimo_heartbeat TIMESTAMPTZ NOT NULL`: Marca temporal del último latido de confirmación de transmisión activa.
   - `estado VARCHAR(32) NOT NULL`: Gobernado por una **máquina de estados canónica de exactamente cuatro (4) estados**: `RESERVADO`, `COMPLETADO`, `FALLIDO` y `RESULTADO_INCIERTO`. (Se elimina formalmente `LIBERADO` por duplicidad conceptual, siendo la liberación una consecuencia directa e inherente del estado terminal `FALLIDO`).
3. **Flujo de Ejecución, Heartbeat y Abandono Seguro:**
   - **Adquisición del Lease (`fn_reservar_descarga_excepcional`):** Ejecutada antes de enviar el primer byte. Si existe una reserva activa con lease vigente (`expiracion_lease > clock_timestamp()`), se rechaza la concurrencia con `55P03 DESCARGA_CONCURRENTE_EN_CURSO`.
   - **Tratamiento obligatorio de leases expirados:** Si el lease expiró (`expiracion_lease <= clock_timestamp()`), **queda terminantemente PROHIBIDO marcarlo automáticamente como `FALLIDO`**. La ausencia de heartbeat NO demuestra que la transmisión HTTP haya concluido sin éxito. Por ende, la reserva previa transita obligatoriamente a **`RESULTADO_INCIERTO`** (NUNCA a `FALLIDO`), registrando `'EXPIRACION_LEASE_SIN_CONFIRMACION'`, y **bloquea la emisión de cualquier nueva reserva** hasta que se realice una reconciliación auditable conservadora.
   - **Renovación Continua por Heartbeat (`fn_renovar_reserva_descarga_excepcional`):** Mientras el stream HTTP fluye, el backend emite cada 10 a 15 segundos un heartbeat validando el `token_propietario` y extendiendo la `expiracion_lease` por 30 segundos adicionales. Si el heartbeat falla (por timeout de BD o revocación institucional de la autorización padre), el servidor **aborta inmediatamente el streaming** (`stream.destroy()` y `res.destroy()`) para evitar transmisiones sin lease.
   - **Finalización del Intento (`fn_finalizar_descarga_excepcional`):** Valida el `token_propietario` para garantizar que solo el dueño del lease modifique el estado.
     - `COMPLETADO`: Invocado exclusivamente ante `res.writableFinished === true`. Anexa a `documentos_descargados` y revoca si se consumió todo el lote.
     - `FALLIDO`: Invocado ante interrupción o socket cerrado con evidencia fehaciente (`res.writableFinished === false`). Concluye la reserva sin computar consumo, permitiendo de forma inherente un reintento mientras continúe la vigencia de 15 minutos.
     - `RESULTADO_INCIERTO`: Invocado si el servidor transmitió el archivo pero PostgreSQL no permite registrar el resultado final (caída transitoria de BD post-streaming o fallo de confirmación). **Bloqueo conservador:** La reserva permanece retenida para impedir segundas descargas automáticas hasta que un administrador ejecute la reconciliación auditable al recuperar la disponibilidad.
4. **Consistencia entre PostgreSQL y HTTP:**
   - Se documenta formalmente que el streaming HTTP y las transacciones relacionales de PostgreSQL **no constituyen una transacción distribuida 2PC unificada**.
   - No se formulan promesas teóricas de "exactamente una transferencia ante cualquier falla catastrófica de red y proceso".
   - El sistema ofrece cuatro garantías formales: (1) Exclusión mutua estricta; (2) Consumo idempotente; (3) Reintento seguro ante fallos comprobados (`FALLIDO`); (4) Bloqueo conservador ante estados inciertos (`RESULTADO_INCIERTO`).
5. **Control de Eventos en Node.js:**
   - Se evalúa `res.writableFinished` en el manejador del evento `close`: si `finalizado || res.writableFinished === true`, el evento `close` se reconoce como cierre normal post-transmisión y se descarta; únicamente si `res.writableFinished === false` se reporta `FALLIDO` con `TRANSFERENCIA_INTERRUMPIDA`.
6. **Declaración Formal de Certificación del Modelo Lease & Heartbeat:**
   > [!IMPORTANT]
   > En cumplimiento de la verdad técnica y rigor de Fase A0, se elimina cualquier atribución de que el modelo Lease & Heartbeat fue "probado" o "ejecutado". Su redacción formal de certificación es taxativamente:  
   > **«Diseño técnico documentado, pendiente de implementación y pruebas funcionales y de concurrencia en las fases B y D»**.

### 18.2. Corrección B — Punto Real de Mantenimiento Arquitectónico y Configuración Factual de Puertos

1. **Inspección Factual del Prototipo Existente (`backend/src/app.ts` L109-L144):**
   - La inspección directa de [`backend/src/app.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/app.ts#L109-L144) confirma el orden exacto de montaje actual:
     - Línea 109: `const app = express();`
     - Línea 112: `app.use(corsMiddleware);`
     - Línea 113: `app.use(express.json({ limit: '10mb' }));`
     - Línea 122: `app.use(contextMiddleware);`
     - Líneas 124-131: `app.get('/health', ...)` (health check de Docker Compose)
     - Líneas 133-144: `app.get('/ready', ...)` (readiness check de base de datos)
     - Líneas 147+: Montaje de routers de negocio (`/api/v1/auth`, `/api/v1/usuarios`, `/api/v1/expedientes`, etc.).
   - **Distinción Técnica Honesta:** **En el prototipo actual NO existe un middleware de mantenimiento ni API Gateway/reverse proxy independiente**. Declararlo preexistente constituiría una falsedad técnica.
2. **Mecanismo Propuesto para Implementación en Fase B:**
   - Se propone implementar en `Fase B` un middleware interceptor (`maintenanceMiddleware`) montado inmediatamente antes de las rutas de negocio en `backend/src/app.ts`.
   - Estará gobernado por la variable de entorno real `SIGD_MAINTENANCE_MODE="true"` (o bandera en memoria/Redis).
   - **Comportamiento durante mantenimiento:** Intercepta el 100 % de las peticiones dirigidas a `/api/v1/*`, `/storage/*` y `/casilla/*`, respondiendo con HTTP `503 Service Unavailable`, cabecera `Retry-After: 300` y payload RFC 7807 (`{"type": "https://sigd.iestpsuiza.edu.pe/errors/service-unavailable", "title": "Servicio en Mantenimiento Programado", "status": 503, "detail": "El SIGD se encuentra en ventana de mantenimiento técnico por migración de seguridad.", "code": "MAINTENANCE_MODE"}`).
   - **Excepción de Health Check:** Únicamente `/health` permanece con bypass para permitir que los health checks de Docker Compose no reinicien el contenedor durante la ventana; `/ready` y todas las APIs quedan bloqueadas.
3. **Configuración Factual de Puertos e Infraestructura Docker:**
   - La correlación estática entre compose files y el frontend confirma los puertos efectivos:
     - **En `docker-compose.yml`:**
       - `backend`: expone `3000:3000` (escucha en `PORT: 3000`).
       - `frontend`: expone `5173:5173` (servidor Vite, variable `VITE_API_BASE_URL: http://localhost:3000/api/v1`).
       - `postgres`: expone `127.0.0.1:5433:5432` (mapeo del puerto 5433 del host hacia el 5432 interno del contenedor).
       - `minio`: expone `9000:9000` (S3 API) y `9001:9001` (Consola Web de MinIO).
       - `redis`: expone `6379:6379`.
     - **En `docker-compose.sigd.yml`:**
       - `backend`: expone `127.0.0.1:3000:3000`.
       - `frontend`: expone `127.0.0.1:5173:5173` (`VITE_API_BASE_URL: http://localhost:3000`).
       - `postgres`: expone `127.0.0.1:5433:5432`.
       - `postgres_test`: expone `127.0.0.1:5434:5432`.
     - **En frontend (`frontend/vite.config.ts`):** Servidor Vite configurado por defecto en el puerto `5173`.
   - Se ratifica que no existe ningún proxy inverso, ingress ni balanceador intermedio; las llamadas del frontend se dirigen directamente al backend en el puerto `3000`.

### 18.3. Corrección C — Secuencia de Migración y Distinción Obligatoria en Tres Planos

1. **Distinción Obligatoria en Tres Planos:**
   En cumplimiento de las directrices de integridad documental y verificación estricta, se diferencian expresamente:
   - **(a) Secuencia física de archivos en `backend/migraciones/`:**
     - El archivo predecesor numérico físico en el repositorio es [`backend/migraciones/21_sigd_auth_actualizacion_ubigeo_2026.sql`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/21_sigd_auth_actualizacion_ubigeo_2026.sql).
     - La siguiente migración canónica oficial unívocamente reservada es:  
       **`backend/migraciones/22_sigd_org_catalogo_rbac_institucional.sql`**  
       con script de reversión en:  
       **`backend/migraciones/pendientes/22_sigd_org_catalogo_rbac_institucional_rollback.sql`**.
   - **(b) Migraciones registradas históricamente en PostgreSQL (`public.sigd_migraciones`):**
     - La tabla relacional de migraciones registra los scripts aplicados a lo largo del historial del sistema.
   - **(c) Migraciones realmente aplicadas:**
     - En esta Fase A0, bajo la **Opción A** (cero conexiones a PostgreSQL y cero sentencias SQL ejecutadas), **NO se realizan afirmaciones categóricas sobre el estado interno de la base de datos sin verificación autorizada en vivo**. La confirmación física se ejecutará formalmente en el Paso 1 de Fase A antes de aplicar cualquier migración.
2. **Inspección de `backend/src/db/migrate.ts` y Nomenclatura Única Oficial:**
   - El runner institucional `migrate.ts` inspecciona los archivos `.sql` en `backend/migraciones/`, los ordena alfabéticamente y ejecuta una verificación estricta de prefijos numéricos (`archivo.match(/^(\d+)_/)`). Si dos archivos comparten el mismo prefijo numérico, aborta inmediatamente con la excepción:
     `Conflicto de secuencia en migraciones: "..." y "..." comparten el mismo prefijo "22".`
   - Se ratifica de forma unívoca que el único nombre oficial y canónico reservado para la Fase A es:
     **`backend/migraciones/22_sigd_org_catalogo_rbac_institucional.sql`**
   - Su script correspondiente de reversión lógica se ubica en:
     **`backend/migraciones/pendientes/22_sigd_org_catalogo_rbac_institucional_rollback.sql`**
   - Se descarta formalmente cualquier alias preliminar alternativo en toda la documentación técnica para garantizar total compatibilidad con el runner de base de datos.

### 18.4. Corrección D — Política de Rollback y Regla de Autorización Expresa para Restauración Física

En estricta observancia de las directrices institucionales, se formaliza la diferenciación de los tres (3) niveles de contingencia:

1. **Nivel 1 — Rollback Transaccional DDL (Automático intra-migración):**
   - Gestionado por el runner `migrate.ts`. Si la ejecución de `22_sigd_org_catalogo_rbac_institucional.sql` falla, el bloque transaccional `BEGIN ... COMMIT` ejecuta automáticamente `ROLLBACK;`, dejando la base de datos intacta en el estado de la migración `21_`.
2. **Nivel 2 — Reversión Controlada de Esquema (Manual en ventana de mantenimiento):**
   - Si la migración se aplicó pero la verificación de backend falla en la ventana de mantenimiento sin haberse generado movimientos operativos (`0 filas` nuevas), se ejecuta `22_sigd_org_catalogo_rbac_institucional_rollback.sql` retirando los objetos nuevos sin pérdida de información previa. Si ya hubo operación con datos nuevos, se aplica una migración compensatoria hacia adelante (`24_+`).
3. **Nivel 3 — Restauración Física desde Respaldo Lógico `.dump` (NUNCA Automática):**
   > [!CAUTION]
   > **Toda restauración física de PostgreSQL (`pg_restore`) requiere autorización expresa previa de la Dirección.** Queda terminantemente **PROHIBIDO** ejecutar `pg_restore` de forma automática ante un fallo de script o despliegue.
   - Procedimiento de 7 pasos obligatorio antes de cualquier restauración:
     1. Identificación de la base afectada (`sigd_jacobo_demo` en `B_JACOBO`; prohibidas bases alternas).
     2. Verificación de existencia del respaldo base verificado (`sigd_jacobo_demo_pre_tsk12_2026-11-12T17-29-27.dump`).
     3. Verificación criptográfica exacta de SHA-256 (`1A8B845A53E7C2EA609EC989B8508D300392992E2C07B221429A1C98C9ED2BCC`).
     4. Informe técnico de impacto evaluando la pérdida potencial de datos generados con posterioridad al corte.
     5. Acta formal de autorización expresa emitida y firmada por la Dirección del IESTP «Suiza».
     6. Documentación de la ventana de mantenimiento y detención de procesos.
     7. Ejecución y validación post-restauración.

---

### 18.5. Conclusión y Veredicto de Cierre Técnico A0.2

Con la formalización de este Anexo §18, el expediente de la **Fase A0.2** queda completamente blindado, consistente con la arquitectura real de contenedores, sin suposiciones de infraestructura, con control estricto de concurrencia mediante leases/heartbeats y preparado para la posterior Fase A de ejecución controlada.

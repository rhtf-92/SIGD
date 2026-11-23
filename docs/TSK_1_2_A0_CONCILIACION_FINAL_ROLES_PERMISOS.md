# SIGD SUIZA — TSK-1.2 FASE A0
# CONCILIACIÓN FINAL DE ROLES INSTITUCIONALES Y CATÁLOGO DE PERMISOS

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Rama Git exclusiva:** `B_JACOBO` | **Base oficial:** `sigd_jacobo_demo` (PostgreSQL 18.6)  
**Estado:** Diseño Técnico Definitivo (FASE A0) — **Cero mutaciones ejecutadas en BD ni en código fuente**

---

## 1. CATÁLOGO DEFINITIVO DE DIEZ (10) ROLES INSTITUCIONALES

La arquitectura RBAC del SIGD Suiza adopta exactamente **diez (10) roles institucionales** (nueve internos y uno externo). Ningún rol histórico o adicional formará parte del catálogo operativo vigente.

### 1.1. Roles Canónicos Vigentes y UUID Oficiales

| # | Código | Tipo | Nombre visible | Ámbito obligatorio de asignación | Estado actual en `sigd_jacobo_demo` | `rol_id` (UUID oficial preservado / asignado) |
|---:|---|---|---|---|---|---|
| 1 | `ADMINISTRADOR` | Interno | Administrador del Sistema | `GLOBAL` (técnico/funcional) | Existente (`vigente = TRUE`, 4 asignaciones) | `d8cfb14a-efbf-4808-b25f-041681e04710` (preservado) |
| 2 | `DIRECTOR` | Interno | Director General | `GLOBAL` institucional / `DG` | Existente (`vigente = TRUE`, 3 asignaciones) | `bdb75c0c-6d3a-4801-8d3a-41084b26f926` (preservado) |
| 3 | `JEFE_UNIDAD_ACADEMICA` | Interno | Jefe de Unidad Académica | `AREA` (Unidad Académica obligatoria) | **Faltante en BD (alta Fase A)** | `3a010000-0000-4000-8000-000000000001` (determinístico) |
| 4 | `COORDINADOR_AREA` | Interno | Coordinador de Área / Programa | `AREA` (Programa/Área obligatoria; unidad solo por designación explícita) | **Faltante en BD (alta Fase A)** | `3a020000-0000-4000-8000-000000000002` (determinístico) |
| 5 | `SECRETARIO` | Interno | Secretario Académico | `AREA` (`SEC` u oficina académica competente) | Existente (`vigente = TRUE`, 1 asignación) | `094f11be-e747-4da4-a3aa-170e721ded8c` (preservado) |
| 6 | `MESA_PARTES` | Interno | Mesa de Partes | `AREA` (`MP`) | Existente (`vigente = TRUE`, 1 asignación) | `7692b3dc-4066-4184-a052-dd715b5eb9e2` (preservado) |
| 7 | `DOCENTE` | Interno | Docente Institucional | `AREA` (área académica de adscripción) | **Faltante en BD (alta Fase A)** | `3a030000-0000-4000-8000-000000000003` (determinístico) |
| 8 | `TESORERO` | Interno | Tesorero | `GLOBAL` acotado exclusivamente al dominio Tesorería | Existente (`vigente = TRUE`, 1 asignación) | `9b5471ec-6901-4d92-893f-ed51a90fe9d4` (preservado) |
| 9 | `ESTUDIANTE` | Interno | Estudiante | `TITULAR` (`area_id IS NULL`) | **Faltante en BD (alta Fase A)** | `3a040000-0000-4000-8000-000000000004` (determinístico) |
| 10 | `CIUDADANO` | Externo | Ciudadano | `TITULAR` (`area_id IS NULL`) | Existente (`vigente = TRUE`, 36 asignaciones) | `97069c21-17c5-4438-b0d0-293aac2c18e9` (preservado) |

**Reglas estructurales confirmadas:**
- **Catálogo cerrado de exactamente diez (10) roles institucionales:** No se crea un rol #11 en la matriz institucional. De los **9 roles distintos de `ADMINISTRADOR`** habilitados en política para obtener copias documentales delimitadas:
  - **Los 7 roles institucionales de personal/operativos** (`DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `DOCENTE` y `TESORERO` dentro de su dominio financiero) se gobiernan potencialmente mediante `#32 EXPEDIENTE_DESCARGAR` (en `rol_permiso`, sujeto a ámbito y autorización explícita).
  - **`ESTUDIANTE`** es un **usuario interno de la comunidad institucional** (no necesariamente trabajador ni personal laboral) y **`CIUDADANO`** es un **usuario externo a la institución**. **No se clasifican ambos como usuarios externos.** Ninguno de los dos necesita ni debe recibir `#32 EXPEDIENTE_DESCARGAR` en `sigd_org.rol_permiso`: su descarga de documentos propios publicados y notificaciones oficiales se resuelve por **titularidad (`solicitante_id`)** y **Casilla Electrónica** (`/casilla/notificaciones/:id/documento/descargar`).
  - `ADMINISTRADOR` queda excluido de descarga ordinaria por defecto. `GESTOR_APOYO_AREA` es una capacidad operativa independiente (no un rol adicional). `SUPER_ADMIN_PLATAFORMA` (*Superadministrador de Plataforma*) pertenece exclusivamente al dominio global de plataforma SaaS (`sigd_saas` como esquema separado dentro de la misma base `sigd_jacobo_demo`, con acceso global multiinstitución, visualización y descarga en toda la plataforma, auditado por separado, nunca insertado en `sigd_org.rol_sistema`); ver [TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md).
- **Diferenciación institucional de `ESTUDIANTE` y `CIUDADANO`:** `ESTUDIANTE` (usuario interno de la comunidad institucional) y `CIUDADANO` (usuario externo a la institución) poseen ámbito `TITULAR` por `solicitante_id`. Esta distinción garantiza que `ESTUDIANTE` no sea catalogado erróneamente como externo general ni bloqueado como usuario administrativo indebido en [`usuariosAdmin.service.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/organicore/usuariosAdmin.service.ts#L103).
- `DOCENTE` y `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA` y `COORDINADOR_AREA`, `SECRETARIO` y `MESA_PARTES` son estrictamente distintos y no intercambiables.
- `TESORERO` concentra todas las facultades del dominio Tesorería sin acceso global a expedientes académicos.
- `ADMINISTRADOR` conserva **acceso de consulta a todos los expedientes de su propia institución** (`EXPEDIENTE_LEER` con `ambito = 'GLOBAL'` en el catálogo relacional institucional, acotado estrictamente a su propia institución / `institucion_id` en runtime y sin acceso cruzado a expedientes de otras instituciones en entornos SaaS/multitenant), lectura y visualización documental mediante vista previa controlada (vía streaming backend), con **cero** facultad de mutación, aprobación, firma, cierre o decisión documental y **sin descarga ordinaria**.

---

### 1.2. Roles Históricos Excluidos y Preservación Referencial

| Código histórico | `rol_id` (UUID preservado) | Estado actual `vigente` en BD (`01..21`) | Asignaciones en `usuario_rol` | Tratamiento definitivo cerrado en Fase A0 (`22_` + `Fase B`) |
|---|---|---|---|---|
| `ESPECIALISTA` | `94ae72fb-0b86-4a6f-ba78-69b19bc888e7` | `TRUE` *(pasa a `FALSE` en `22_`)* | 6 totales (4 vigentes, 2 expiradas) en 4 cuentas | **Descontinuado oficialmente (`rol_sistema.vigente = FALSE` en `22_`).** Preserva su UUID y las 6 filas históricas en `usuario_rol`; bloquea nuevas asignaciones (`tr_bloquear_nueva_asignacion_rol_historico`), excluye en selector/runtime (`Fase B`), **prohíbe reasignación automática y no altera `cuenta_usuario.activo`**. Cuentas sin otro rol canónico quedan operativamente bloqueadas (`403 ACCOUNT_WITHOUT_ROLES` / `CONTEXT_REVOKED`) hasta asignación administrativa explícita y normal de un rol válido. |
| `CAJERO` | `aa1a372e-296c-487f-9f0a-86ef68d45741` | `FALSE` | 0 | Conservado intacto en `rol_sistema` y en `chk_rol_codigo`. Prohibidas nuevas asignaciones. |
| `APROBADOR_DEVOLUCIONES` | `444b6f5d-6c69-4edd-b641-c6b2c357d268` | `FALSE` | 0 | Conservado intacto en `rol_sistema` y en `chk_rol_codigo`. Absorción histórica en `TESORERO`. |
| `SUPERVISOR_TESORERIA` | `c86ad9e6-1391-4a5f-b2b6-d447826914a8` | `FALSE` | 0 | Conservado intacto en `rol_sistema` y en `chk_rol_codigo`. Absorción histórica en `TESORERO`. |

#### Inventario Exacto y Matriz de Disposición Definitiva de las 4 Cuentas Históricas de `ESPECIALISTA` (8 Dimensiones de Conciliación)

| `login` | `id_usuario` | Rol histórico (`rol_id`) | `id_usuario_rol` | `id_asignacion` (Laboral) | Estado cuenta (`activo`) | Estado asignación | Decisión operativa |
|---|---|---|---|---|---|---|---|
| `operador.demo` | `00000000-0000-0000-0000-000000000030` | `ESPECIALISTA` (`94ae72fb-0b86-4a6f-ba78-69b19bc888e7`) | `ecb124c5-577d-4838-a3f0-5e343960b0e4` (`SEC`) *(y rol canónico `SECRETARIO` en `SEC` con `id_usuario_rol = 2957a90a-72fd-4263-a222-3e4d51301157`)* | Sin cargo formal vinculado en `sigd_org.asignacion_personal` según `INFORME_CONCILIACION_RBAC_TSK_1_0B.md:39` (control factual preejecución Fase A) | `ACTIVA` (`TRUE`, sin alteración) | `SECRETARIO`: VIGENTE.<br>`ESPECIALISTA`: descontinuado lógicamente en `22_`. | **CERRADA:** Conserva continuidad operativa ordinaria exclusivamente como `SECRETARIO` en `SEC`, preservando el 100% de autoría e historial. |
| `especialista.demo` | `00000000-0000-0000-0000-000000000060` | `ESPECIALISTA` (`94ae72fb-0b86-4a6f-ba78-69b19bc888e7`) | `cbd75b3a-62b5-43eb-9780-989116c04ec4` (`SEC`) | Sin cargo formal vinculado en `sigd_org.asignacion_personal` según `INFORME_CONCILIACION_RBAC_TSK_1_0B.md:39` (control factual preejecución Fase A) | `ACTIVA` (`TRUE`, no se modifica) | `ESPECIALISTA`: descontinuado lógicamente en `22_`. Otros roles: 0. | **CERRADA:** Sin reasignación automática ni conversión de rol; queda operativamente bloqueada (`403 ACCOUNT_WITHOUT_ROLES`) con 0 permisos efectivos hasta asignación explícita por administración normal. |
| `trabajador.h2.test` | `f6905305-582a-4871-af75-c8b961d70a9e` | `ESPECIALISTA` (`94ae72fb-0b86-4a6f-ba78-69b19bc888e7`) | 1) `bd029454-d24b-4a81-b497-a95c40ff562a` (`DG`, vencida 65 ms)<br>2) `fabad752-6a79-40f4-ad26-f9809b4498e2` (`MP`, en rango) | Cuenta sintética prueba H2; registro en `MP` con prefijo documental `18b17d04-...` (UUID completo a comprobar fácticamente en Paso 1 Fase A) | `ACTIVA` (`TRUE`, cuenta prueba H2) | `ESPECIALISTA`: descontinuado lógicamente en `22_`. Otros roles: 0. | **CERRADA:** Prohibida conversión automática en cuenta institucional y sin reasignación automática; permanece bloqueada (`403 ACCOUNT_WITHOUT_ROLES`) hasta gestión explícita de pruebas. |
| `trabajador.h2.5079` | `32a76ac3-31d4-40e0-9994-95a459ed5b01` | `ESPECIALISTA` (`94ae72fb-0b86-4a6f-ba78-69b19bc888e7`) | 1) `e3b2d13b-1d04-46f1-9e85-3ecd593bb8ff` (`DG`, vencida 39 ms)<br>2) `4bbd6ab4-5b53-4820-8f83-7e014bf62de4` (`MP`, en rango) | Cuenta sintética prueba H2; registro en `MP` con prefijo documental `a1d1b4b7-...` (UUID completo a comprobar fácticamente en Paso 1 Fase A) | `INACTIVA` (`FALSE`, no reactivar) | Cuenta y rol descontinuados; asignación DG expirada y MP bloqueada. | **CERRADA:** Conservar inactiva e intacta en historial; prohibida reactivación sin asignación previa de rol válido (`422 ACTIVACION_SIN_ROLES`). |

> [!IMPORTANT]
> **Control 1 — Decisión Definitiva de Disposición de `ESPECIALISTA` y Conciliación Histórica (`CERRADO EN FASE A0`):**
> - **Conciliación entre informes previos vs. estado verificado:** Informes tempranos (`TSK-1.0`/`1.0A`) atribuyeron equivocadamente "6 cuentas activas" y cargos ficticios (*Operador de Registro Curricular*) y nombraron área `TRAMITE` para `operador.demo`. Dichos extremos quedaron corregidos y unificados entre `INFORME_CONCILIACION_RBAC_TSK_1_0B.md`, `SIGD_B_JACOBO_CONCILIACION_ROLES_HISTORICOS_V1.md`, `INFORME_AUDITORIA_ROLES_PERMISOS_SIGD.md`, `INFORME_TSK_1_2_FASE0_PREIMPLEMENTACION.md` y Fase A0 sobre los **6 UUID exactos / 4 cuentas reales** (con la única variación cronológica posterior a TSK-1.0B de `asignacion_personal` sintética H2 en `MP` verificada al corte Fase 0 `2026-11-12`). El estado vivo de sesiones posteriores al corte Fase 0 es un **control técnico obligatorio de preejecución** mediante `SELECT` de solo lectura al abrir Fase A.
> - **Regla cerrada y definitiva (`CONFIRMADO`):** En `22_` se desactiva lógicamente el rol (`UPDATE sigd_org.rol_sistema SET vigente = FALSE WHERE codigo = 'ESPECIALISTA'`), se instala el trigger `tr_bloquear_nueva_asignacion_rol_historico` y **se conservan intactos**: (a) el UUID `94ae72fb-0b86-4a6f-ba78-69b19bc888e7`, (b) las **6 filas históricas en `sigd_org.usuario_rol`**, (c) los datos de `asignacion_personal` y autoría en `documento_adjunto`/`resolucion`/`bitacora_auditoria`, y (d) el valor actual de `sigd_auth.cuenta_usuario.activo` (sin alterar cuentas ni inventar roles automáticos). En `Fase B`, `auth.guard.ts`, `contexto.service.ts` y `usuariosAdmin.service.ts` excluyen explícitamente los 4 códigos históricos de modo que las cuentas sin otro rol canónico (`especialista.demo`, `trabajador.h2.test`) quedan **sin autorización operativa (`403 ACCOUNT_WITHOUT_ROLES` / `CONTEXT_REVOKED`)** hasta que administración les asigne explícitamente un rol válido del catálogo de 10 o las inactive por vía administrativa normal.
> - **Resolución de contradicción con `20261111_tsk1_0_rbac_contextual.sql`:** Mientras el borrador `TSK-1.0A` desactivaba `ESPECIALISTA` sin resolver asignaciones ni cuentas ni bloquear nuevas inserciones, `TSK-1.2` cierra ambos extremos: desactivación limpia en `22_` + preservación de 6 UUID + trigger anti-reincidencia + cero automatismos en cuentas + bloqueo `403` automático en `Fase B`.

---

## 2. CONCILIACIÓN DEFINITIVA DEL CATÁLOGO DE PERMISOS

### 2.1. Decisiones de Conciliación de Nombres (Sin Códigos Duplicados)

1. **`EXPEDIENTE_REGISTRAR` vs. `EXPEDIENTE_CREAR`:** Se adopta **`EXPEDIENTE_REGISTRAR`** como único código canónico de radicación presencial, virtual y creación de expedientes. No se crea `EXPEDIENTE_CREAR`.
2. **`EXPEDIENTE_ADJUNTAR`:** Verificado en código fuente real — referenciado por [`digitalizacion.service.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/rutadoc/digitalizacion.service.ts), [`rutadoc.router.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/rutadoc/rutadoc.router.ts#L89), [`auth.guard.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/auth.guard.ts#L228) y [`contexto.service.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/contexto.service.ts#L13). **Debe crearse** en `sigd_org.permiso_sistema` como permiso atómico (`AREA`).
3. **`EXPEDIENTE_EVALUAR` vs. `DOCENTE_EVALUAR`:** Se adopta **`EXPEDIENTE_EVALUAR`** como código canónico. Se corrige el identificador obsoleto `DOCENTE_EVALUAR` en `PERMISOS_PROHIBIDOS_GESTOR_APOYO` ([`auth.guard.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/auth.guard.ts#L131) y [`contexto.service.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/contexto.service.ts#L19)).
4. **`EXPEDIENTE_CERRAR`:** Permiso independiente obligatorio (`AREA`). **Nunca** se consolida dentro de `EXPEDIENTE_APROBAR`, `RESOLUCION_FIRMAR` ni `EXPEDIENTE_ARCHIVAR`.
5. **`FIRMA_FIRMAR` y `RESOLUCION_FIRMAR` (diferenciación definitiva):** Se conserva el UUID real de `FIRMA_FIRMAR` (`ce9e31be-9118-4960-b4ea-7c3e4340fb95`) como **capacidad técnica PKI** (pasarela ReFirma, sesiones PKI y documentos oficiales firmables distintos de resolución), y se incorpora **`RESOLUCION_FIRMAR`** como **competencia jurídico-administrativa exclusiva para suscribir Resoluciones Directorales** (`EN_FIRMA` -> `FIRMADA`, con validación de `tipo_resolucion`, PAdES y `CVD`). Ambos exigen permiso persistido en `claims.ctx` **más** registro vigente en `sigd_org.facultad_despacho` o `encargatura_despacho` (cero firma automática incluso para `DIRECTOR`, cero facultad para `SECRETARIO` y **retiro expreso de `FIRMA_FIRMAR` en `ADMINISTRADOR`**); el token obsoleto `EXPEDIENTE_FIRMAR` se erradica reemplazándolo por ambos en las listas de exclusión de apoyo.
6. **`EXPEDIENTE_RESOLVER` (Descontinuación definitiva en 4 etapas — NO eliminar físicamente ni otorgar nuevas asignaciones):**
   - **Roles reales en `sigd_jacobo_demo` actual (`INFORME_TSK_1_2_FASE0_PREIMPLEMENTACION.md:170-173`):** `ADMINISTRADOR`, `DIRECTOR`, `SECRETARIO` y `ESPECIALISTA`.
   - **Etapa 1 — Compatibilidad durante la migración `22_`:** Preservar su código y UUID histórico (`797a084e-6c20-491d-83bf-e5c9fddaa6ab`) activo (`vigente = TRUE`) únicamente en los roles operativos existentes necesarios para compatibilidad transitoria (`DIRECTOR` y `SECRETARIO`, conservando `ESPECIALISTA` en su registro histórico inactivo), **retirándolo en `rol_permiso` exclusivamente de `ADMINISTRADOR`**.
   - **Etapa 2 — Prohibición de nuevas asignaciones del permiso heredado:** Desde `22_`, **no** se asigna `EXPEDIENTE_RESOLVER` a ningún rol nuevo (`JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `DOCENTE`, `ESTUDIANTE`) ni a capacidades (`tr_proteger_capacidad_permiso`), y el trigger **`tr_bloquear_nueva_asignacion_permiso_legado`** en `sigd_org.rol_permiso` (junto con validación administrativa en `Fase B`) prohíbe cualquier nuevo otorgamiento de `EXPEDIENTE_RESOLVER`.
   - **Etapa 3 — Sustitución funcional en backend y frontend (`Fase B` / `Fase C` / `Fase D`):** Reemplazar todas sus dependencias en endpoints, servicios, middleware, UI y pruebas por permisos atómicos específicos (`EXPEDIENTE_EVALUAR`, `EXPEDIENTE_APROBAR`, `EXPEDIENTE_RECHAZAR`, `EXPEDIENTE_CERRAR`, `EXPEDIENTE_ARCHIVAR`, `EXPEDIENTE_RECEPCIONAR`, `EXPEDIENTE_OBSERVAR`, `EXPEDIENTE_SUBSANAR`, `EXPEDIENTE_ADJUNTAR`, `RESOLUCION_EMITIR`, `DOCUMENTO_EDITAR`).
   - **Etapa 4 — Retiro lógico verificable (`Migración compensatoria 24_+`):** Únicamente cuando las pruebas y auditoría estática/dinámica demuestren **cero dependencias activas**, ejecutar `UPDATE sigd_org.permiso_sistema SET vigente = FALSE WHERE codigo = 'EXPEDIENTE_RESOLVER'` y cerrar sus filas residuales en `rol_permiso`, preservando UUID e historial WORM sin borrar registros físicos ([TSK_1_2_A0_REVISION_TECNICA_FINAL.md §7.2](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_REVISION_TECNICA_FINAL.md)).
7. **Ampliación de `chk_permiso_ambito` y columnas aditivas de catálogo:** De `('AREA', 'GLOBAL')` a `('AREA', 'GLOBAL', 'UNIDAD', 'TITULAR')`, incorporando `descripcion TEXT` y `vigente BOOLEAN NOT NULL DEFAULT TRUE` en `sigd_org.permiso_sistema`, manteniendo intacto `EXPEDIENTE_LEER = 'GLOBAL'` para compatibilidad con consultas heredadas mientras el middleware valida contexto y ámbito en runtime.
8. **Permiso independiente #32 `EXPEDIENTE_DESCARGAR`, compatibilidad de `ambito = 'AREA'` y aclaración terminológica:**
   - Se incorpora **`EXPEDIENTE_DESCARGAR`** como permiso **#32** del catálogo oficial (`5b010000-0000-4000-8000-000000000016`, `ambito = 'AREA'`, `vigente = TRUE`), **sin asignación automática en `rol_permiso` para `ADMINISTRADOR` ni para ningún otro rol**.
   - **Compatibilidad técnica de `ambito = 'AREA'` y distinción de `ESTUDIANTE`/`CIUDADANO` (Control 2 de Cierre):** En [`auth.guard.ts:164,302`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/auth.guard.ts#L163-L305), asignar `ambito = 'GLOBAL'` provocaría que `tienePermisoArea` conceda acceso transversal ignorando `ur.area_id`. Mantener `ambito = 'AREA'` en `sigd_org.permiso_sistema` preserva el comportamiento *fail-closed* por defecto para los **7 roles institucionales operativos** si Dirección otorga `#32` posteriormente en `rol_permiso` (`DIRECTOR`: institucional; `JEFE_UNIDAD_ACADEMICA`: subárbol `ltree` de unidad; `COORDINADOR_AREA`/`SECRETARIO`/`MESA_PARTES`: su `area_id`; `DOCENTE`: `expediente_evaluador` o `solicitante_id`; `TESORERO`: acotado a M10/Tesorería). Por el contrario, **`ESTUDIANTE` y `CIUDADANO`** (`area_id IS NULL`) **no necesitan ni deben recibir `#32` en `rol_permiso`**: su descarga de documentos propios publicados y notificaciones legales opera por **titularidad (`solicitante_id`)** y **Casilla Electrónica** ([`casilla.router.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/identicore/casilla.router.ts#L516-L552), [`storage.router.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/storage/storage.router.ts#L102-L120)), bloqueando siempre borradores y anexos internos reservados. Detalle e impacto backend/frontend/rutas en [TSK_1_2_A0_MATRIZ_CIERRE_CONTROLES_PREIMPLEMENTACION.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_MATRIZ_CIERRE_CONTROLES_PREIMPLEMENTACION.md).
   - **No existe confusión ni código redundante:** Los códigos `EXPEDIENTE_VISUALIZAR` y `DOCUMENTO_LEER` **NO existen** ni en `sigd_jacobo_demo` ni en el catálogo de `22_` (no se afirman como implementados). La relación real es: `EXPEDIENTE_LEER` (consulta del expediente + visualización previa inline) ≠ `DOCUMENTO_EDITAR` (edición de borradores) ≠ **`EXPEDIENTE_DESCARGAR`** (copia descargable externa).

---

### 2.2. Inventario Técnico Completo de los 32 Permisos (16 Reales Preservados + 16 Nuevos Atómicos)

#### A. Permisos Reales Existentes en `sigd_jacobo_demo` (16 — UUID Preservados)

| Código | `permiso_id` (UUID preservado) | Dominio | Operación | Ámbito | Roles autorizados | Condiciones y restricciones | Endpoints y servicios que lo validan | Estado |
|---|---|---|---|---|---|---|---|---|
| `ADMIN_USUARIOS` | `ef5b2eff-caff-4479-a88a-c497eed32a2f` | OrganiCore / Plataforma | Gestión de usuarios, asignaciones, catálogos maestros y TUPA | `GLOBAL` | `ADMINISTRADOR` | Solo contexto `ADMINISTRADOR`; no concede firma ni aprobación documental | `usuariosAdmin.routes.ts`, `adminMaestras.routes.ts`, `reportes.controller.ts` (`refrescar`) | Implementado (ajustar `exigirAdministradorTupa` a `claims.ctx`) |
| `EXPEDIENTE_LEER` | `e6066e88-c8a5-4219-9526-87a2ac5253ae` | RutaDoc / TramiCore / DocuCore | Consulta de bandeja, detalle de expedientes, trazabilidad y **visualización previa** de PDF (no concede escritura ni descarga no autorizada) | `GLOBAL` (en BD; acotado en runtime por rol e institución) | Todos los roles (ver matriz §2.3) + `GESTOR_APOYO_AREA` | **`ADMINISTRADOR`** (solo contexto activo `ADMINISTRADOR`): lectura global en su institución sin asignación ni conmutación, **cero mutación documental**. `DIRECTOR`: institucional. `JEFE_UNIDAD_ACADEMICA`: unidad. `COORDINADOR_AREA`/`SECRETARIO`/`MESA_PARTES`/`GESTOR_APOYO_AREA`: su área. `DOCENTE`: solo asignados en `expediente_evaluador` o propios (`solicitante_id`). `ESTUDIANTE`/`CIUDADANO`: solo titularidad (`solicitante_id`). `TESORERO`: **No** | `app.ts` (`puedeVerExpediente`, `obtenerAlcanceBandeja`), `storage.router.ts`, `rutadoc.router.ts`, `resoluciones.controller.ts` | Implementado (corregir `app.ts` y `storage.router.ts` por `claims.ctx`, separación ver/descargar y auditoría de lectura) |
| `EXPEDIENTE_DERIVAR` | `0c89fdb7-687c-4e0d-ab70-9423e3c9a05f` | RutaDoc | Derivación simple o masiva entre áreas | `AREA` | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `GESTOR_APOYO_AREA` | Expediente debe encontrarse en el `area_id` del contexto activo (`estado` derivable según FSM) | `POST /api/v1/expedientes/:id/derivar`, `/derivar-lote`, `/derivar-masivo` (`rutadoc.router.ts`, `derivaciones.service.ts`) | Implementado |
| `EXPEDIENTE_RESOLVER` | `797a084e-6c20-491d-83bf-e5c9fddaa6ab` | RutaDoc (Transición) | Atención resolutiva legado (`atender`, transición controlada; sin nuevas asignaciones desde `22_`) | `AREA` | `DIRECTOR`, `SECRETARIO` (compatibilidad transitoria vigente) e histórico inactivo `ESPECIALISTA`; **retirado de `ADMINISTRADOR`** y **prohibidas nuevas asignaciones** en `JEFE_UNIDAD_ACADEMICA`/`COORDINADOR_AREA` (operan con permisos atómicos) | Prohibido en `/subsanar`, `/archivar`, `/cerrar`, `/evaluar`; bloqueado en `tr_bloquear_nueva_asignacion_permiso_legado` | `POST /api/v1/expedientes/:id/atender`, `revertir-actuacion` (`rutadoc.router.ts`) | Implementado (Etapa 1–2 en `22_`; Etapas 3–4 en B–D y `24_+`) |
| `FIRMA_FIRMAR` | `ce9e31be-9118-4960-b4ea-7c3e4340fb95` | DocuCore / Firma PKI | Capacidad técnica PKI: pasarela ReFirma, estado de firma y documentos oficiales firmables | `GLOBAL` | `DIRECTOR` (y suplente únicamente con `encargatura_despacho` vigente) | Exige `FIRMA_FIRMAR` en `claims.ctx` **+** registro vigente en `sigd_org.facultad_despacho` o `encargatura_despacho`; prohibida firma automática; **retirado de `ADMINISTRADOR`** | `GET /api/v1/firma/pendientes`, `POST /api/v1/firma/invocar-refirma`, `GET /api/v1/firma/documento/:id/estado` (`firma.routes.ts`, `firma.controller.ts`, `auth.guard.ts`) | Implementado (retirar de `ADMINISTRADOR` en `22_` + quitar `ADMINISTRADOR` de `ROLES_FIRMA` y exigir `claims.ctx` en Fase B) |
| `REPORTE_LEER` | `20be03cf-f5b5-47dd-85ff-05456284e56f` | CoreLink Analytics | Lectura de indicadores ejecutivos y cuellos de botella | `GLOBAL` (`DIRECTOR`, `ADMINISTRADOR`) | `DIRECTOR`, `ADMINISTRADOR` (y vista de unidad/área futura si se habilita `UNIDAD`) | Exige `tienePermisoGlobal(permisos, 'REPORTE_LEER')`; `ADMINISTRADOR` no adquiere acceso documental por leer métricas | `GET /api/v1/reportes/dashboard/*`, `/tiempos-atencion` (`reportes.controller.ts`) | Implementado (eliminar refs a `SUPER_ADMIN`) |
| `TRAMICORE_DEVOLUCION_EVALUAR` | `ef2d638c-a0a2-41b2-9047-e9b8a9f320ea` | TramiCore | Evaluación de devoluciones de requisitos/tasas en Mesa de Partes y emisión de observaciones de ventanilla | `GLOBAL` (ventanilla `MP`) | `MESA_PARTES` | Restringido al contexto `MESA_PARTES` en `MP` | `GET /tramites/devoluciones`, `POST /tramites/devoluciones/:id/revision` (`tramites.controller.ts`) | Implementado |
| `TESORERIA_LEER` | `922f42fa-a7ee-45b0-a568-ffa57e210714` | Tesorería | Consulta de órdenes de pago, tarifas, caja y comprobantes | `GLOBAL` (dominio Tesorería) | `TESORERO` | Solo dominio Tesorería; cero acceso a expedientes académicos | `tesoreria.router.ts`, `tesoreria.rules.ts`, `tesoreria.service.ts` | Implementado |
| `TESORERIA_PAGO_REGISTRAR` | `35945cdd-401f-4582-b7fa-c3d19275a576` | Tesorería | Registro de pagos en caja y pagos adicionales | `GLOBAL` (dominio Tesorería) | `TESORERO` | Bloqueo transaccional con verificación Policy B | `tesoreria.router.ts`, `tesoreria.efectivo.ts`, `pagoAdicional.service.ts` | Implementado |
| `TESORERIA_PAGO_VERIFICAR` | `b0c26b70-fc34-4359-b3b1-96a1c17f9202` | Tesorería | Verificación y conciliación de pagos | `GLOBAL` (dominio Tesorería) | `TESORERO` | Validación de contexto vigente en transacción | `tesoreria.rules.ts`, `tesoreria.service.ts` | Implementado |
| `TESORERIA_REPORTES` | `9a71a1fe-0c2e-4c13-9c65-067a2bb6bf4b` | Tesorería | Reportes financieros y arqueo de caja | `GLOBAL` (dominio Tesorería) | `TESORERO` | Acotado al módulo financiero | `tesoreria.router.ts`, `tesoreria.rules.ts` | Implementado |
| `TESORERIA_TARIFA_PROPONER` | `dff4e592-1299-49ad-a860-9eab151be203` | Tesorería | Propuesta de nuevas tarifas TUPA/servicios | `GLOBAL` (dominio Tesorería) | `TESORERO` | Registro en auditoría financiera | `tesoreria.rules.ts`, `tesoreria.service.ts` | Implementado |
| `TESORERIA_TARIFA_VALIDAR` | `a06cdc2b-3ffb-420e-961c-ef2a5899d944` | Tesorería | Validación y activación de tarifas | `GLOBAL` (dominio Tesorería) | `TESORERO` | Control transaccional en Postgres | `tesoreria.rules.ts`, `tesoreria.service.ts` | Implementado |
| `TESORERIA_DEVOLUCION_EVALUAR` | `ec5d0774-b080-458e-8862-acec3cd8e7ef` | Tesorería | Evaluación financiera de devoluciones | `GLOBAL` (dominio Tesorería) | `TESORERO` | Exclusivo del contexto `TESORERO` | `tesoreria.rules.ts`, `tesoreria.service.ts` | Implementado |
| `TESORERIA_DEVOLUCION_APROBAR` | `b622ee1f-8a4a-48c8-9d60-6a5ebf0c7594` | Tesorería | Aprobación contable de devoluciones | `GLOBAL` (dominio Tesorería) | `TESORERO` | Exclusivo del contexto `TESORERO` | `tesoreria.rules.ts`, `tesoreria.service.ts` | Implementado |
| `TESORERIA_DEVOLUCION_EJECUTAR` | `0c93586b-1758-4710-8999-7eb8994a9913` | Tesorería | Desembolso / ejecución de devolución | `GLOBAL` (dominio Tesorería) | `TESORERO` | Concurrencia verificada en TSK-1.0C-R.2 | `tesoreria.efectivo.ts`, `tesoreria.service.ts` | Implementado |

#### B. Permisos Atómicos Nuevos a Incorporar en Fase A (16 Permisos — UUID Determinísticos)

| # | Código | `permiso_id` (UUID propuesto) | Dominio | Operación | Ámbito en BD | Roles autorizados | Condiciones y restricciones | Endpoints y servicios objetivo (Fase B) | Estado |
|---:|---|---|---|---|---|---|---|---|---|
| 17 | `EXPEDIENTE_REGISTRAR` | `5b010000-0000-4000-8000-000000000001` | TramiCore | Radicación de solicitudes y expedientes (conciliado; reemplaza `EXPEDIENTE_CREAR`) | `TITULAR` | `MESA_PARTES`, `DOCENTE`, `ESTUDIANTE`, `CIUDADANO`, `SECRETARIO` (interno) | `ESTUDIANTE`/`CIUDADANO`/`DOCENTE`: solo en nombre propio (`solicitante_id`); `MESA_PARTES`: presencial para terceros en `MP` | `POST /api/v1/tramite/radicacion`, `/tramites/radicacion-virtual`, `/tramites/ventanilla-presencial` (`tramites.controller.ts`) | Nuevo (Brecha detectada en TSK-1.1B) |
| 18 | `DOCUMENTO_EDITAR` | `5b010000-0000-4000-8000-000000000002` | DocuCore | Edición de borradores de resoluciones o documentos no suscritos | `AREA` | `SECRETARIO`, `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA`, `DIRECTOR` | Prohibido si `estado IN ('FIRMADA','NOTIFICADA','ANULADA')`; prohibido a `GESTOR_APOYO_AREA`, `DOCENTE`, `ESTUDIANTE`, `CIUDADANO` | `PUT /api/v1/resoluciones/:id`, `POST /api/v1/resoluciones` (cuando `resolucionId` existe) (`resoluciones.controller.ts`) | Nuevo (Brecha detectada en TSK-1.1B) |
| 19 | `EXPEDIENTE_SUBSANAR` | `5b010000-0000-4000-8000-000000000003` | RutaDoc / Casilla | Presentación de subsanación de observaciones por el titular | `TITULAR` | `ESTUDIANTE`, `CIUDADANO`, `DOCENTE` (cuando actúa como solicitante), `MESA_PARTES` (ingreso presencial de subsanación) | Expediente debe estar en estado `OBSERVADO`; exige `solicitante_id = persona` salvo ventanilla `MESA_PARTES` presencial con cargo | `POST /api/v1/expedientes/:id/subsanar`, `/movimientos/subsanar` (`rutadoc.router.ts`, `derivaciones.controller.ts`) | Nuevo (corrige uso indebido de `EXPEDIENTE_RESOLVER`) |
| 20 | `EXPEDIENTE_RECEPCIONAR` | `5b010000-0000-4000-8000-000000000004` | RutaDoc | Recepción formal del expediente en unidad/área destino | `AREA` | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `DOCENTE` (solo si tiene derivación/asignación a su usuario), `GESTOR_APOYO_AREA` | Expediente debe encontrarse en `REGISTRADO` o `DERIVADO` hacia el `area_id` del contexto activo | `POST /api/v1/expedientes/:id/recepcionar`, `/movimientos/recepcionar` (`rutadoc.router.ts`, `derivaciones.service.ts`) | Nuevo (parcial en BD -> atómico) |
| 21 | `EXPEDIENTE_ADJUNTAR` | `5b010000-0000-4000-8000-000000000005` | RutaDoc / DocuCore | Incorporación de anexos PDF, comprobantes y foliación | `AREA` | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `DOCENTE` (asignado), `GESTOR_APOYO_AREA` | PDF íntegro `%PDF-`, SHA-256 verificado, dentro del área activa (o asignación vigente para docente); prohibido a `CIUDADANO`/`ESTUDIANTE` como foliación interna | `POST /api/v1/expedientes/:id/documentos`, `/foliar-documento`, `/storage/confirmar-carga` (`rutadoc.router.ts`, `docucore.router.ts`) | Nuevo (ya referenciado en TS; faltaba en BD) |
| 22 | `EXPEDIENTE_OBSERVAR` | `5b010000-0000-4000-8000-000000000006` | RutaDoc | Registro de observación formal o técnica con pausa SLA | `AREA` | `MESA_PARTES`, `SECRETARIO`, `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA`, `DOCENTE` (solo evaluador asignado), `DIRECTOR` | Expediente en `EN_CALIFICACION` o `EN_REVISION` dentro del área; `DOCENTE` requiere registro activo en `sigd_rut.expediente_evaluador`; excluye a `GESTOR_APOYO_AREA` | `POST /api/v1/expedientes/:id/observar`, `/movimientos/observar` (`derivaciones.controller.ts`, `rutadoc.router.ts`) | Nuevo (separa observación de resolución) |
| 23 | `EXPEDIENTE_ASIGNAR` | `5b010000-0000-4000-8000-000000000007` | RutaDoc | Asignación de responsable actual o docente evaluador dentro del área/unidad | `AREA` | `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA`, `SECRETARIO`, `DIRECTOR` | El asignado debe tener vínculo vigente en el área/unidad o rol `DOCENTE`; incompatible si evaluador == solicitante | `POST /api/v1/expedientes/:id/asignar` (servicio asignación RutaDoc Fase B) | Nuevo (TSK-1.1B / Sec. 8) |
| 24 | `EXPEDIENTE_REASIGNAR` | `5b010000-0000-4000-8000-000000000008` | RutaDoc | Reasignación de responsable o evaluador | `AREA` | `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA`, `SECRETARIO`, `DIRECTOR` | **Justificación obligatoria** no vacía; prohibida fuera del ámbito (`403`); no altera estado ni custodia automáticamente | `POST /api/v1/expedientes/:id/reasignar` (servicio asignación RutaDoc Fase B) | Nuevo (TSK-1.1B / Sec. 8) |
| 25 | `EXPEDIENTE_EVALUAR` | `5b010000-0000-4000-8000-000000000009` | RutaDoc | Emisión de informe/evaluación técnica y transición a `ATENDIDO` | `AREA` | `DOCENTE`, `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA`, `SECRETARIO` | Para `DOCENTE`: obligatorio registro activo en `sigd_rut.expediente_evaluador`. No concede cierre administrativo ni firma | `POST /api/v1/expedientes/:id/evaluar` / `atencion-tecnica` (Fase B); reemplaza token `DOCENTE_EVALUAR` | Nuevo (TSK-1.1B / Sec. 6 y 8) |
| 26 | `EXPEDIENTE_APROBAR` | `5b010000-0000-4000-8000-000000000010` | RutaDoc / DocuCore | Aprobación institucional de fondo previo a firma o emisión final | `UNIDAD` / `GLOBAL` (`AREA` en DB compatible) | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA` (en su unidad si el procedimiento lo faculta) | No equivale a `EXPEDIENTE_CERRAR` ni a `RESOLUCION_FIRMAR`; prohibido a `ADMINISTRADOR` y `GESTOR_APOYO_AREA` | `POST /api/v1/expedientes/:id/aprobar` / `resoluciones/:id/aprobar` (Fase B) | Nuevo (TSK-1.1B / Sec. 7) |
| 27 | `EXPEDIENTE_RECHAZAR` | `5b010000-0000-4000-8000-000000000011` | RutaDoc | Declaración fundada de improcedencia o rechazo formal de trámite | `AREA` | `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `SECRETARIO` | Motivación obligatoria y notificación en Casilla; prohibido a `GESTOR_APOYO_AREA`, `DOCENTE`, `ESTUDIANTE`, `CIUDADANO` | `POST /api/v1/expedientes/:id/rechazar` (Fase B) | Nuevo (Sec. 10) |
| 28 | `EXPEDIENTE_CERRAR` | `5b010000-0000-4000-8000-000000000012` | RutaDoc | **Cierre administrativo formal del expediente (`CERRADO`)** | `AREA` | `SECRETARIO` (principal en Secretaría Académica), `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA` (según `procedimiento_cierre_regla`) | **Independiente de aprobar, firmar y archivar.** Valida las 11 condiciones del procedimiento en `sigd_doc.procedimiento_cierre_regla` y asiento append-only en `expediente_cierre_historial` | `POST /api/v1/expedientes/:id/cerrar` (servicio de cierre administrativo Fase B) | Nuevo (**Obligatorio Sec. 7**) |
| 29 | `EXPEDIENTE_ARCHIVAR` | `5b010000-0000-4000-8000-000000000013` | RutaDoc / Archivo | Transferencia documental y custodia física/digital final (`ARCHIVADO`) | `AREA` | `SECRETARIO`, `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA` (o custodio asignado habilitado) | Solo desde estado `CERRADO` (o `RESUELTO` legado controlado); requiere ubicación física (`estante`, `balda`, `caja`) o custodia digital y foliación AGN | `POST /api/v1/expedientes/:id/archivar` (`derivaciones.controller.ts`, `derivaciones.service.ts`) | Nuevo (separa archivo de `EXPEDIENTE_RESOLVER` y de `CERRAR`) |
| 30 | `RESOLUCION_EMITIR` | `5b010000-0000-4000-8000-000000000014` | DocuCore | Proyección y elevación formal de borrador de resolución a despacho | `AREA` | `SECRETARIO`, `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA` (proyección técnica del área) | Prohibido a `GESTOR_APOYO_AREA`, `DOCENTE`, `MESA_PARTES`, `TESORERO`, `ESTUDIANTE`, `CIUDADANO`; solo en el área competente | `POST /api/v1/resoluciones/proyectar`, `POST /api/v1/resoluciones` (`resoluciones.controller.ts`) | Nuevo (Sec. 10) |
| 31* | `RESOLUCION_FIRMAR` | `5b010000-0000-4000-8000-000000000015` | DocuCore / Firma PKI | Firma digital específica de resoluciones directorales | `GLOBAL` | `DIRECTOR` (y suplente en `encargatura_despacho` vigente) | Exige `facultad_despacho` / `encargatura_despacho` vigente, estado `EN_FIRMA` y PDF borrador íntegro; prohibido a `SECRETARIO`, `ADMINISTRADOR`, `GESTOR_APOYO_AREA` | `POST /api/v1/firma/invocar-refirma`, `POST /api/v1/firma/callback-refirma` (`firma.controller.ts`, `firma.routes.ts`) | Nuevo (complementario a `FIRMA_FIRMAR`) |
| 32 | `EXPEDIENTE_DESCARGAR` | `5b010000-0000-4000-8000-000000000016` | Storage / DocuCore / RutaDoc | **Descarga controlada** de copia de documento digital del expediente | `AREA` *(evaluado en runtime por contexto, institución, titularidad y confidencialidad)* | **Ninguno automáticamente (0 filas en `rol_permiso`)** | Exige además de `EXPEDIENTE_DESCARGAR`: identidad, `claims.ctx`, `institucion_id`, vigencia, ámbito/titularidad, estado del expediente, confidencialidad y autorización del documento + auditoría WORM. `ADMINISTRADOR` excluido por defecto (solo autorización extraordinaria temporal no auto-otorgable). | `GET /api/v1/storage/documentos/:id/download`, `/storage/download/:bucket/:key` (`storage.router.ts` Fase B) | Nuevo (#32 — **Sin asignación automática a roles**) |

> **Nota aritmética exacta:** En `sigd_jacobo_demo` existen **16** permisos reales preservados. Sumando los **16** permisos atómicos nuevos listados (numerados 17 a 32 arriba, culminando con **`EXPEDIENTE_DESCARGAR`**), el catálogo consolidado oficial alcanza exactamente **32 permisos atómicos sin duplicados**, conservando intactos los 31 UUID previos e incorporando `#32` **sin asignarlo automáticamente a ningún rol**.

---

## 3. MATRIZ CONSOLIDADA DE RESPONSABILIDADES Y PERMISOS POR ROL (10 ROLES + CAPACIDAD)

| Permiso | `ADMINISTRADOR` | `DIRECTOR` | `JEFE_UNIDAD_ACADEMICA` | `COORDINADOR_AREA` | `SECRETARIO` | `MESA_PARTES` | `DOCENTE` | `TESORERO` | `ESTUDIANTE` | `CIUDADANO` | `GESTOR_APOYO_AREA` (Capacidad) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `ADMIN_USUARIOS` | **Sí** (`GLOBAL`) | No | No | No | No | No | No | No | No | No | **Prohibido** |
| `REPORTE_LEER` | **Sí** (`GLOBAL`) | **Sí** (`GLOBAL`) | No *(solo unidad futura)* | No | No | No | No | No *(solo `TESORERIA_REPORTES`)* | No | No | **Prohibido** |
| `EXPEDIENTE_LEER` | **Sí** (`GLOBAL` lectura) | **Sí** (`GLOBAL`) | **Sí** (`UNIDAD`) | **Sí** (`AREA`) | **Sí** (`AREA`) | **Sí** (`AREA` / `MP`) | **Sí** *(solo asignados/propios)* | **No** | **Sí** *(titular)* | **Sí** *(titular)* | **Sí** (`AREA`) |
| `EXPEDIENTE_REGISTRAR` | No | No | No | No | **Sí** (interno) | **Sí** (`MP` ventanilla) | **Sí** *(propio)* | No | **Sí** *(propio)* | **Sí** *(propio)* | No |
| `DOCUMENTO_EDITAR` | No | **Sí** | **Sí** (`UNIDAD`) | **Sí** (`AREA`) | **Sí** (`AREA`) | No | No | No | No | No | No |
| `EXPEDIENTE_RECEPCIONAR` | No | **Sí** | **Sí** (`UNIDAD`) | **Sí** (`AREA`) | **Sí** (`AREA`) | **Sí** (`MP`) | **Sí** *(asignado)* | No | No | No | **Sí** (`AREA`) |
| `EXPEDIENTE_DERIVAR` | No | **Sí** | **Sí** (`UNIDAD`) | **Sí** (`AREA`) | **Sí** (`AREA`) | **Sí** (`MP`) | No | No | No | No | **Sí** (`AREA`) |
| `EXPEDIENTE_ADJUNTAR` | No | **Sí** | **Sí** (`UNIDAD`) | **Sí** (`AREA`) | **Sí** (`AREA`) | **Sí** (`MP`) | **Sí** *(asignado)* | No | No | No | **Sí** (`AREA`) |
| `EXPEDIENTE_OBSERVAR` | No | **Sí** | **Sí** (`UNIDAD`) | **Sí** (`AREA`) | **Sí** (`AREA`) | **Sí** (`MP`) | **Sí** *(evaluador asignado)* | No | No | No | **Prohibido** |
| `EXPEDIENTE_SUBSANAR` | No | No | No | No | No | **Sí** *(ventanilla cargo)* | **Sí** *(titular propio)* | No | **Sí** *(titular)* | **Sí** *(titular)* | **Prohibido** |
| `EXPEDIENTE_ASIGNAR` | No | **Sí** | **Sí** (`UNIDAD`) | **Sí** (`AREA`) | **Sí** (`AREA`) | No | No | No | No | No | **Prohibido** |
| `EXPEDIENTE_REASIGNAR` | No | **Sí** | **Sí** (`UNIDAD`) | **Sí** (`AREA` + justif.) | **Sí** (`AREA` + justif.) | No | No | No | No | No | **Prohibido** |
| `EXPEDIENTE_EVALUAR` | No | No | **Sí** (`UNIDAD`) | **Sí** (`AREA`) | **Sí** (`AREA`) | No | **Sí** *(solo con `expediente_evaluador`)* | No | No | No | **Prohibido** |
| `EXPEDIENTE_APROBAR` | **No** | **Sí** | **Sí** *(según proc. unidad)* | **No** | **No** | No | No | No | No | No | **Prohibido** |
| `EXPEDIENTE_RECHAZAR` | No | **Sí** | **Sí** (`UNIDAD`) | No | **Sí** (`AREA`) | No | No | No | No | No | **Prohibido** |
| `RESOLUCION_EMITIR` | No | **Sí** | **Sí** (`UNIDAD`) | **Sí** (`AREA` proyecto) | **Sí** (`AREA` proyecto) | No | No | No | No | No | **Prohibido** |
| `FIRMA_FIRMAR` | **No** *(retirado)* | **Sí** *(+ `facultad_despacho`)* | No *(salvo encargatura)* | No | No | No | No | No | No | No | **Prohibido** |
| `RESOLUCION_FIRMAR` | **No** | **Sí** *(+ `facultad_despacho`)* | No *(salvo encargatura)* | No | No | No | No | No | No | No | **Prohibido** |
| `EXPEDIENTE_CERRAR` | **No** | **Sí** *(solo proc. DG)* | **Sí** *(solo proc. unidad reglamento)* | **No** | **Sí** (**Principal SEC**, acotado a procedimiento + ámbito) | **No** | **No** | **No** | **No** | **No** | **Prohibido** |
| `EXPEDIENTE_ARCHIVAR` | No | **Sí** | **Sí** (`UNIDAD`) | No | **Sí** (`AREA`) | No | No | No | No | No | **Prohibido** |
| `EXPEDIENTE_RESOLVER` *(legado)* | **No** *(retirado en `22_`)* | **Sí** *(compatibilidad `Etapa 1`)* | **No** *(Etapa 2: 0 nuevas asignaciones; usa permisos atómicos)* | **No** *(Etapa 2: 0 nuevas asignaciones; usa permisos atómicos)* | **Sí** *(compatibilidad `Etapa 1`)* | No | No | No | No | No | **Prohibido** |
| `TRAMICORE_DEVOLUCION_EVALUAR` | No | No | No | No | No | **Sí** (`MP`) | No | No | No | No | **Prohibido** |
| `TESORERIA_*` (9) | No | No | No | No | No | No | No | **Sí** (los 9) | No | No | **Prohibido** |
| `EXPEDIENTE_DESCARGAR` *(7 roles institucionales operativos elegibles vía asignación expresa post-`22_`)* | **No** *(excluido por política)* | **No** en `22_` *(elegible institucional acotado)* | **No** en `22_` *(elegible `UNIDAD`)* | **No** en `22_` *(elegible `AREA`)* | **No** en `22_` *(elegible `AREA`)* | **No** en `22_` *(elegible `MP`)* | **No** en `22_` *(elegible asignado/propio)* | **No** en `22_` *(elegible M10 vía `TESORERIA_*`)* | **No aplica `#32`** *(descarga propios vía titularidad/Casilla)* | **No aplica `#32`** *(descarga propios vía titularidad/Casilla)* | **Prohibido** |

### 3.1. Política Oficial Cerrada de Descarga Institucional y Matriz de los Diez Roles (`EXPEDIENTE_DESCARGAR` #32 y Titularidad)

> [!IMPORTANT]
> **Separación conceptual definitiva (`CERRADA EN A0`):** Nunca deben confundirse ni mezclarse en diseño o implementación: **(1) Elegibilidad potencial del rol institucional (`7` roles operativos en `rol_permiso`, siempre mediante asignación expresa con contexto, ámbito, justificación, auditoría y posibilidad de revocación) vs. titularidad sobre documentos propios (`ESTUDIANTE`, usuario interno de la comunidad institucional, y `CIUDADANO`, usuario externo a la institución, ambos sin `#32`)**, **(2) Asignación explícita de `EXPEDIENTE_DESCARGAR` en `rol_permiso`** (`0` filas automáticas en `22_`), **(3) Alcance efectivo**, **(4) Titularidad (`solicitante_id`)**, **(5) Custodia (`expediente_custodia`)** y **(6) Responsabilidad documental (`expediente_responsable` / `expediente_evaluador`)**. Además, **`EXPEDIENTE_DESCARGAR` no es el mecanismo de autorización de `SUPER_ADMIN_PLATAFORMA`**, quien opera mediante privilegio global SaaS independiente (`sigd_saas` + MFA + streaming backend + bitácora SaaS).

| Rol / Capacidad | Consulta (`EXPEDIENTE_LEER`) | Visualización inline (`EXPEDIENTE_LEER`) | En `22_` (`0` auto) | Política institucional de descarga cerrada en A0 | Tratamiento y condiciones específicas |
|---|---|---|---|---|---|
| `ADMINISTRADOR` | **Sí** (`GLOBAL` en su institución) | **Sí** (streaming `inline`) | **No** (`0`) | **Sin descarga ordinaria.** | **Excluido de descarga ordinaria por política cerrada.** Únicamente autorización extraordinaria temporal otorgada por tercera autoridad (`<= 15 min`), prohibida la auto-autorización. |
| `DIRECTOR` | **Sí** (`GLOBAL` institucional) | **Sí** | **No** (`0`) | **Autorización específica según responsabilidad institucional; elegible post-`22_` bajo asignación expresa.** | **No tiene descarga global e ilimitada** por el simple hecho de ser Director. Autoriza descargas excepcionales a terceros dentro de su competencia. **Cuando `DIRECTOR` sea beneficiario de una excepción, la autorización corresponde a una autoridad superior legalmente competente acreditada mediante acto administrativo (`acto_administrativo_sustento`, sin crear rol #11).** |
| `JEFE_UNIDAD_ACADEMICA` | **Sí** (`UNIDAD`) | **Sí** | **No** (`0`) | **Elegible post-`22_` para documentos de su unidad y unidades dependientes.** | Asignación expresa post-`22_` con contexto, ámbito (`UNIDAD` subárbol `ltree`), justificación, auditoría y revocación inmediata Política B. |
| `COORDINADOR_AREA` | **Sí** (`AREA`) | **Sí** | **No** (`0`) | **Elegible post-`22_` para expedientes de su área y responsabilidades asignadas.** | Limitado al `area_id` activo y expedientes asignados; pertenecer al rol **no** otorga autoridad para autorizar excepciones. |
| `SECRETARIO` | **Sí** (`AREA` / `SEC`) | **Sí** | **No** (`0`) | **Elegible post-`22_` para documentación de procedimientos bajo su ámbito.** | Limitado a procedimientos y ámbito `SEC` activos; pertenecer al rol **no** otorga autoridad para autorizar excepciones. |
| `MESA_PARTES` | **Sí** (`AREA` / `MP`) | **Sí** | **No** (`0`) | **Elegible post-`22_` para documentos recibidos o bajo su custodia autorizada.** | Acotado a ventanilla (`MP`), recepción y devoluciones/custodia activa verificada. |
| `DOCENTE` | **Sí** *(solo asignados o propios)* | **Sí** *(acotado)* | **No** (`0`) | **Elegible post-`22_` para expedientes asignados o documentos propios autorizados.** | Exige `solicitante_id` o registro activo en `sigd_rut.expediente_evaluador`; pertenecer al rol **no** otorga autoridad para autorizar descargas. |
| `TESORERO` | **No** *(académicos)* | **No** *(académicos)* | **No** (`0`) | **Elegible post-`22_` para documentación financiera mediante autorización financiera específica.** | Exclusivamente comprobantes/devoluciones de Tesorería bajo permisos `TESORERIA_*` verificados; cero acceso a expedientes académicos. |
| `ESTUDIANTE` *(Usuario interno de la comunidad institucional, no necesariamente laboral)* | **Sí** *(titular)* | **Sí** *(titular)* | **No aplica `#32`** | **Sin `#32 EXPEDIENTE_DESCARGAR`; descarga documentos propios publicados y notificaciones.** | Resuelto exclusivamente por titularidad (`e.solicitante_id = cu.id_persona`) y Casilla Electrónica, excluyendo siempre borradores e internos reservados. |
| `CIUDADANO` *(Usuario externo a la institución)* | **Sí** *(titular)* | **Sí** *(titular)* | **No aplica `#32`** | **Sin `#32 EXPEDIENTE_DESCARGAR`; descarga documentos propios publicados y notificaciones.** | Resuelto exclusivamente por titularidad (`solicitante_id`) y Casilla Electrónica (`/casilla/notificaciones/:id/documento/descargar`), excluyendo borradores internos. |
| `GESTOR_APOYO_AREA` *(Capacidad)* | **Sí** (`AREA`) | **Sí** (`AREA`) | **Prohibido** | **Sin obtención automática ni elegibilidad ordinaria de `#32`.** | Bloqueado por trigger `tr_proteger_capacidad_permiso` y lista negra TypeScript. |

### 3.2. Modelo Definitivo de Autoridad para Asignar, Modificar y Revocar `EXPEDIENTE_DESCARGAR` (#32)

Se establece una separación estricta de responsabilidades entre tres actores con facultades no equivalentes y conciliación unívoca de identificadores:

1. **`DIRECTOR` — Autoridad Institucional que Autoriza:**
   - Autoriza ordinariamente la concesión institucional de `EXPEDIENTE_DESCARGAR` para roles elegibles de su institución (`JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `DOCENTE`, `TESORERO`).
   - Define los roles beneficiarios, el contexto y ámbito autorizado (`contexto_autorizado_id`), y fija la justificación institucional obligatoria ($\ge 15$ caracteres).
   - Solicita la modificación o revocación de la autorización y supervisa el uso institucional del permiso.
   - **Prohibición estricta de auto-autorización:** El `DIRECTOR` no puede autorizarse el permiso a sí mismo en ninguna circunstancia.
   - **Concesión a `DIRECTOR` como beneficiario:** Exige autorización previa de una **autoridad superior legalmente competente acreditada formalmente**. Para preservar el principio de realidad administrativa:
     - **No se exige cuenta de usuario SIGD** para autoridades superiores externas (órgano jerárquico superior competente acreditado conforme al marco normativo aplicable).
     - La acreditación se registra mediante metadatos explícitos: `autoridad_superior_nombre`, `autoridad_superior_cargo`, `autoridad_superior_entidad`, `acto_administrativo_tipo`, `acto_administrativo_numero`, `acto_administrativo_fecha`, `acto_administrativo_archivo_id` (FK a documento adjunto si se digitaliza) y `acto_administrativo_sustento`.
     - En este caso especial, `tipo_autoridad_otorgante = 'AUTORIDAD_SUPERIOR_ACREDITADA'`, `autoridad_otorgante_id IS NULL` y `ejecutor_tecnico_id` consigna obligatoriamente al Administrador que registra formalmente la resolución administrativa. No se crea ningún rol #11 superior.
2. **`ADMINISTRADOR` — Ejecutor Técnico Institucional:**
   - Ejecuta técnicamente las asignaciones y revocaciones institucionales de `EXPEDIENTE_DESCARGAR` cuando existe una autorización válida previa emitida por el Director o acreditada por autoridad superior.
   - Registra la asignación autorizada en `sigd_org.autorizacion_rol_permiso_institucional`, verificando la identidad del autorizador, la institución (`institucion_id`), el contexto (`contexto_autorizado_id`) y la elegibilidad del rol beneficiario.
   - Consigna obligatoriamente su identificador `ejecutor_tecnico_id` (FK a `sigd_auth.cuenta_usuario`), registra la justificación formal, ejecuta la asignación o revocación, consulta el historial de operaciones y garantiza el registro auditable.
   - **Restricciones obligatorias innegociables:**
     - No puede autorizar sus propias concesiones.
     - No puede concederse el permiso `#32` a sí mismo.
     - No puede habilitar el permiso a `DIRECTOR` sin la acreditación completa de la autoridad superior competente.
     - No puede ampliar el alcance de una autorización ni modificarla para beneficiar a otros roles sin nueva aprobación.
     - No puede ejecutar asignaciones sin evidencia documental de autorización válida.
     - Mantiene su política de lectura institucional (`EXPEDIENTE_LEER` global institucional); no recibe `EXPEDIENTE_DESCARGAR` ordinariamente.
3. **`SUPER_ADMIN_PLATAFORMA` — Control Global Total SaaS con Delimitación Multi-tenant:**
   - Máxima autoridad administrativa y técnica de la plataforma SaaS, con control global del sistema y de todas las instituciones registradas.
   - Posee acceso privilegiado propio de lectura y descarga documental vía streaming backend en todas las instituciones bajo MFA obligatorio y auditoría en `sigd_audit.bitacora_superadmin_saas`, sin requerir autorización del Director para ejercer su acceso propio.
   - **Separación innegociable entre acceso privilegiado propio y concesión institucional:** La facultad de acceso técnico global propio **NO significa autorización institucional automática para conceder el permiso #32 a cuentas institucionales** de cualquier usuario. La concesión de #32 a funcionarios internos es una competencia privativa de gobierno del `DIRECTOR` (o Autoridad Superior acreditada), ejecutada técnicamente por el `ADMINISTRADOR`. Si interviene en la tabla operativa de autorizaciones institucionales por soporte o contingencia (`es_superadmin_saas = TRUE`), lo hace delimitando estrictamente el `institucion_id` específico (cero comodines/wildcards) y motivando la justificación formal, sin eludir los requisitos institucionales ni asumir competencia legal para firmar resoluciones.
   - **Delimitación estricta por institución (Cero wildcards):** Para prevenir fugas de permisos cruzadas entre instituciones, toda asignación efectuada por el Superadministrador se registra obligatoriamente con el `institucion_id` específico de la institución beneficiaria. No se admiten autorizaciones transversales o comodín.
   - **Conciliación unívoca de identificadores:** Se registra su identidad de plataforma en `super_admin_id` (UUID del operador SaaS, sin requerir cuenta en `sigd_auth.cuenta_usuario`), fijando `es_superadmin_saas = TRUE`, `tipo_autoridad_otorgante = 'SUPER_ADMIN_PLATAFORMA'`, `autoridad_otorgante_id IS NULL` y `ejecutor_tecnico_id IS NULL` (salvo que delegue la captura técnica).
   - **Controles obligatorios sobre `#32`:** Justificación obligatoria ($\ge 15$ caracteres), verificación obligatoria de MFA (`mfa_verificado = TRUE`), evidencia inmutable en `sigd_audit.bitacora_superadmin_saas`, registro de estado anterior y posterior, y reconstrucción cronológica completa de cada operación.
   - **Límites innegociables:** Su autoridad tecnológica global no lo convierte en autoridad legal institucional: **no puede aprobar expedientes ni firmar resoluciones institucionales**. No se crea ningún rol #11 superior.

### 3.3. Conciliación de Mecanismos de Autorización de Descarga (#32), Roles Elegibles y Trazabilidad

#### 3.3.1. Matriz de los Siete (7) Roles Elegibles y Tres (3) Roles Excluidos para el Permiso #32 (`EXPEDIENTE_DESCARGAR`)

En cumplimiento de las decisiones institucionales aprobadas y la regla de **CERO ASIGNACIONES AUTOMÁTICAS EN `sigd_org.rol_permiso`**, se establece la clasificación taxativa de los diez (10) roles canónicos:

##### A. Los Siete (7) Roles Institucionales Operativos Elegibles (Asignación Expresa Individual)

Para eliminar cualquier descalce entre la nomenclatura institucional y los esquemas relacionales de base de datos, se establece la correspondencia unívoca entre el **código canónico en BD (`sigd_org.rol_sistema.codigo`)** y la **denominación institucional aprobada**:

| Código Canónico en BD | Denominación Institucional Aprobada | Función Institucional | Justificación de Elegibilidad | Condición de Autorización | Alcance Permitido |
|---|---|---|---|---|---|
| `DIRECTOR` | Director General | Máxima autoridad ejecutiva y representante legal del IESTP «Suiza». | Requiere descargar expedientes integrales para elevar informes a órganos rectores, sustentar litigios o responder auditorías de Estado. | Aprobada por **órgano jerárquico superior competente y formalmente acreditado conforme al marco normativo aplicable** (prohibida auto-autorización). | `GLOBAL_INSTITUCIONAL` |
| `JEFE_UNIDAD_ACADEMICA` | Jefe de Unidad (Académica / Bienestar / Empleabilidad) | Dirección y coordinación de unidades académicas, bienestar o empleabilidad. | Descarga de expedientes curriculares, proyectos de carrera, quejas o procesos disciplinarios de su unidad. | Aprobada por el **Director General** mediante acto administrativo motivado y registrado por el Administrador. | `UNIDAD` |
| `COORDINADOR_AREA` | Jefe de Área / Coordinador de Programa | Responsable funcional de áreas de soporte, calidad, programas de estudio o administración interna. | Descarga de expedientes técnicos, peritajes, proyectos específicos y requerimientos funcionales de su competencia. | Aprobada por el **Director General** mediante acto administrativo motivado y registrado por el Administrador. | `AREA` |
| `SECRETARIO` | Secretaria de Dirección y Despacho / Secretario Académico (`SECRETARIA`) | Apoyo administrativo, compaginación, custodia física y despacho documental. | Descarga de piezas documentales digitalizadas para conformación material de legajos oficiales requeridos por la Dirección. | Aprobada por el **Director General** con delimitación expresa de legajo y custodia registral. | `AREA` o Institucional acotado |
| `MESA_PARTES` | Operador de Mesa de Partes | Recepción, validación de admisibilidad TUPA, foliación y ventanilla única. | Descarga excepcional de cargos o expedientes digitalizados para cotejo material o compaginación ante subsanaciones presenciales. | Aprobada por el **Director General** con justificación operativa de ventanilla. | `AREA` (Mesa de Partes) |
| `DOCENTE` | Docente Institucional | Formación pedagógica y evaluación técnica en comisiones académicas asignadas. | Descarga de expedientes de titulación, convalidación o planes formativos cuando funge como evaluador designado. | Aprobada por el **Director General** condicionada a la vigencia de la resolución de designación en comisión evaluadora. | Acotado a expedientes asignados en su contexto docente/área |
| `TESORERO` | Operador de Cooperación y Tesorería (`OPERADOR_COOP`) | Gestión de convenios interinstitucionales y recaudación financiera (M10). | Descarga de convenios, adendas o expedientes de liquidación económica para auditorías financieras y de contraparte. | Aprobada por el **Director General** mediante acto administrativo formal registral. | Acotado a Cooperación / Tesorería |

##### B. Los Tres (3) Roles Excluidos de Asignación Ordinaria del Permiso #32

| Código Canónico en BD | Denominación Institucional Aprobada | Función Institucional | Justificación de Exclusión Absoluta | Mecanismo de Acceso Alternativo Legítimo |
|---|---|---|---|---|
| `ADMINISTRADOR` | Administrador Institucional | Gestión técnica de cuentas, infraestructura, áreas y seguridad del SIGD. | **Segregación de funciones (SoD) y mínimo privilegio:** Para evitar la concentración de poder y prevenir filtraciones masivas del acervo institucional, el Administrador tiene CERO facultad de descarga institucional ordinaria (#32). | Posee `EXPEDIENTE_LEER` con ámbito `GLOBAL` institucional y visualización controlada en visor PDF inline (streaming backend `GET /api/v1/storage/documentos/:id/view`); en contingencias operativas justificadas puede ser objeto de autorización extraordinaria puntual $\le 15$ min autorizada por el Director. |
| `ESTUDIANTE` | Estudiante / Egresado | Usuario interno de la comunidad educativa, titular de solicitudes y trámites. | **Principio de titularidad:** No forma parte del personal administrativo ni gestiona expedientes ajenos. No requiere ni puede recibir el permiso institucional administrativo `#32`. | Descarga legítima de sus propios documentos presentados, cargos y resoluciones publicadas/notificadas a través de su **Casilla Electrónica** mediante validación estricta de titularidad (`solicitante_id = cu.id_persona`). |
| `CIUDADANO` | Ciudadano / Administrado | Persona natural o jurídica externa que radica trámites ante la institución. | **Principio de titularidad y seguridad:** Usuario externo que no ejerce función pública institucional. Inelegible para permisos administrativos institucionales. | Descarga de documentos propios, cargos de recepción y actos notificados a través de su **Casilla Electrónica** o consulta pública de autenticidad CVD sin requerir el permiso #32. |

#### 3.3.2. Especificación Completa de la Autorización Extraordinaria por Expediente (`sigd_org.autorizacion_descarga_excepcional`)

Para atender contingencias urgentes o diligencias periciales puntuales sin perforar la política de seguridad RBAC, se define con exactitud el mecanismo extraordinario y sus reglas de reserva atómica previa y consumo:

- **Autoridad institucional que autoriza:** El **Director General** de la institución (`autoridad_otorgante_id`).
- **Autorización cuando el beneficiario es el Director:** Debe emanar obligatoriamente de un **órgano jerárquico superior competente y formalmente acreditado conforme al marco normativo aplicable**, consignando el sustento formal (`acto_administrativo_sustento`) y fijando `tipo_autoridad_otorgante = 'AUTORIDAD_SUPERIOR_ACREDITADA'` con `autoridad_otorgante_id IS NULL`. Prohibición absoluta de auto-autorización (`chk_desc_excep_no_auto`).
- **Ejecutor técnico registral:** El **Administrador institucional** (`ejecutor_tecnico_id`), quien asienta la autorización tras verificar el acto aprobatorio. Prohibida su auto-asignación (`chk_desc_excep_no_auto_ejecutor`).
- **Beneficiario individual:** Un funcionario específico formalmente identificado (`usuario_beneficiario_id UUID NOT NULL`).
- **Expediente circunscrito:** Un único expediente concreto (`expediente_id UUID NOT NULL`).
- **Documentos permitidos:** Lista cerrada de identificadores de adjuntos autorizados (`documentos_permitidos UUID[] NOT NULL`, al menos 1 documento).
- **Consumo individual y regla de un solo uso:** Se incorpora la columna `documentos_descargados UUID[] NOT NULL DEFAULT '{}'` y la restricción `CONSTRAINT chk_desc_excep_consumo CHECK (documentos_descargados <@ documentos_permitidos)`. Cada documento autorizado podrá descargarse **exactamente una sola vez**.
- **Vigencia efímera innegociable:** Ventana temporal máxima de **$\le 15$ minutos** (`CONSTRAINT chk_desc_excep_max_15m CHECK (vigente_hasta <= vigente_desde + INTERVAL '15 minutes')`). Si la ventana vence antes del consumo total, caduca automáticamente por expiración temporal.
- **Auditoría inmutable:** Asentada con correlación forense en `sigd_audit.bitacora_acceso_documental`.
- **Frontera de SUPER_ADMIN_PLATAFORMA:** Conserva su acceso de diagnóstico tecnológico global pero **NO puede otorgarse ni otorgar autorizaciones extraordinarias institucionales a funcionarios saltándose al Director**.

##### Flujo de Reserva Atómica Previa, Modelo Lease & Heartbeat y Ciclo de Vida del Intento

Para resolver de manera definitiva la exclusión mutua concurrente (impidiendo que dos peticiones simultáneas transmitan el mismo documento antes de registrar el consumo, y protegiendo al mismo tiempo transmisiones prolongadas legítimas de archivos grandes), se incorpora la estructura relacional `sigd_org.intento_descarga_excepcional` con un ciclo de vida gobernado por una **máquina de estados canónica de exactamente cuatro (4) estados**: `RESERVADO`, `COMPLETADO`, `FALLIDO` y `RESULTADO_INCIERTO`:

> [!NOTE]
> **Depuración de duplicidad conceptual:** Se elimina formalmente `LIBERADO` de la máquina de estados. La liberación de la reserva para permitir reintentos legítimos dentro de la ventana de 15 minutos es una consecuencia directa e inherente del estado terminal `FALLIDO`. Mantener `LIBERADO` como estado independiente introducía redundancia e inconsistencias en las restricciones relacionales.

1. **Fase 1 — Validación Previa, Adquisición de Lease y Exclusión Mutua (`sigd_org.fn_reservar_descarga_excepcional`):**
   - **Momento de ejecución:** Se ejecuta en la base de datos **ANTES de transmitir el primer byte** desde MinIO hacia el socket de red.
   - **Exclusión mutua:** Serialización concurrente mediante advisory lock de 64 bits (`hashtextextended('desc_excep_reserva:' || aut_id || ':' || doc_id, 0)`).
   - **Comprobación de autorización:** Valida que la autorización esté activa, no revocada, dentro de la ventana de 15 minutos, y que el solicitante sea el beneficiario.
   - **Comprobación de elegibilidad del documento:** Verifica que el documento pertenezca a `documentos_permitidos`.
   - **Comprobación de no consumo previo:** Verifica que el documento no figure en `documentos_descargados` ni tenga intentos previos con `estado = 'COMPLETADO'`. Si ya fue consumido, deniega con `DOCUMENTO_YA_DESCARGADO`.
   - **Bloqueo conservador ante resultados inciertos:** Comprueba si existe algún intento previo en `estado = 'RESULTADO_INCIERTO'`. Si existe, deniega la reserva con `RESERVA_BLOQUEADA_RESULTADO_INCIERTO` para prevenir descargas duplicadas hasta que un administrador ejecute la reconciliación auditable correspondiente.
   - **Control de concurrencia y modelo de Lease:**
     - Si existe una reserva previa con `estado = 'RESERVADO'` y su `expiracion_lease > clock_timestamp()`, el lease se encuentra activo y protegido por el heartbeat de una transmisión en curso; se deniega la colisión con `55P03 DESCARGA_CONCURRENTE_EN_CURSO`.
     - **Tratamiento obligatorio de leases expirados:** Si existe una reserva previa con `estado = 'RESERVADO'` pero su `expiracion_lease <= clock_timestamp()`, **queda terminantemente PROHIBIDO marcarla automáticamente como `FALLIDO`**. La ausencia de heartbeat NO demuestra que la transmisión HTTP haya concluido sin éxito (el cliente pudo haber recibido los bytes completos mientras el backend caía antes del asentamiento). Por ende, el sistema transita la reserva previa a **`RESULTADO_INCIERTO`** (NUNCA a `FALLIDO`), registrando `'EXPIRACION_LEASE_SIN_CONFIRMACION'`, y **bloquea la emisión de cualquier nueva reserva** hasta que se realice una reconciliación auditable de bitácoras.
   - **Creación de la reserva y protección estricta del Token de Propietario:** Genera un token secreto único (`token_propietario UUID = gen_random_uuid()`) que se retorna exclusivamente al backend en memoria, e inicializa el lease con una vigencia de 30 segundos (`expiracion_lease = clock_timestamp() + INTERVAL '30 seconds'`).
     - **Regla de seguridad:** El `token_propietario` se maneja exclusivamente en el proceso servidor; **NUNCA debe exponerse al navegador web del cliente (en cabeceras ni payloads HTTP) ni registrarse en logs de acceso**.
2. **Fase 2 — Transmisión Asíncrona y Renovación Periódica por Heartbeat (`sigd_org.fn_renovar_reserva_descarga_excepcional`):**
   - Durante la transmisión del ReadableStream desde MinIO hacia el cliente, el backend ejecuta un heartbeat periódico cada 10 a 15 segundos invocando `fn_renovar_reserva_descarga_excepcional(intento_id, token_propietario, 30)`.
   - La función verifica la correspondencia exacta del `token_propietario` y la vigencia continua de la autorización padre, extendiendo la `expiracion_lease` por 30 segundos adicionales.
   - **Interrupción de seguridad ante fallo de renovación:** Si el backend no logra renovar el lease (por caída de base de datos o expiración de los 15 minutos institucionales), el servidor Node.js **debe abortar de inmediato la transmisión** (`stream.destroy()` y `res.destroy()`) antes de que el lease expire y otra solicitud concurrente pueda tomar el control del documento.
3. **Fase 3 — Finalización y Asentamiento Atómico (`sigd_org.fn_finalizar_descarga_excepcional`):**
   - **Caso Exitoso (`COMPLETADO`):**
     - Se invoca con `p_estado_final = 'COMPLETADO'` únicamente cuando el stream ha concluido satisfactoriamente (`res.writableFinished === true`).
     - Valida `token_propietario`, actualiza el intento a `COMPLETADO`, anexa el documento a `documentos_descargados` en `autorizacion_descarga_excepcional` y, si se consumió la totalidad de documentos del lote, revoca automáticamente la autorización (`CONSUMO_TOTAL_DOCUMENTOS`).
   - **Caso Fallido o Interrumpido (`FALLIDO`):**
     - Si la conexión se cierra prematuramente antes de terminar (`res.writableFinished === false`), se invoca con `p_estado_final = 'FALLIDO'`.
     - Actualiza el intento a `FALLIDO` con evidencia fehaciente de interrupción de red o socket cerrado. La reserva concluye sin computar consumo, permitiendo de forma inherente un nuevo intento dentro de la ventana de 15 minutos.
   - **Caso Incierto (`RESULTADO_INCIERTO`):**
     - Si el servidor finalizó la transmisión HTTP pero PostgreSQL no permite registrar el resultado final (caída transitoria de BD post-streaming o lease expirado sin confirmación), se conserva la reserva y se registra `RESULTADO_INCIERTO`.
     - **Regla innegociable de bloqueo conservador:** **No se libera la reserva**. Permanece bloqueada para evitar que el usuario realice una segunda descarga hasta que la reconciliación auditable determine si el archivo fue transferido efectivamente. Al recuperar la disponibilidad, la reconciliación clasifica el intento de forma conservadora.
4. **Consistencia entre PostgreSQL y HTTP:**
   - La transmisión de bytes por streaming HTTP y las transacciones relacionales de PostgreSQL **no constituyen una transacción distribuida 2PC única y atómica**.
   - No es técnicamente posible garantizar "exactamente una transferencia ante cualquier caída catastrófica simultánea de red y proceso".
   - Las cuatro (4) garantías formales del diseño son:
     1. *Exclusión mutua absoluta:* Cero transferencias concurrentes simultáneas del mismo documento.
     2. *Consumo idempotente:* Un solo registro irreversible de consumo por documento completado.
     3. *Reintento seguro:* Fallos comprobados (`FALLIDO`) concluyen la reserva y permiten nuevo intento sin consumo.
     4. *Bloqueo conservador:* Leases expirados sin confirmación y estados inciertos (`RESULTADO_INCIERTO`) bloquean segundas descargas hasta intervención auditable.
5. **Tratamiento Riguroso de Eventos en Node.js (`finish`, `close`, `error`):**
   - En el runtime de Node.js, el evento `close` se emite **siempre** al finalizar la conexión TCP, incluso después de un evento `finish` exitoso.
   - El manejador de eventos del backend debe aplicar control de idempotencia evaluando `res.writableFinished`:
     - Evento `finish`: Marca bandera `finalizado = true`, cancela el temporizador de heartbeat y llama a `fn_finalizar_descarga_excepcional` con `COMPLETADO`.
     - Evento `close`: Cancela heartbeat. Si `finalizado || res.writableFinished === true`, ignora el evento (cierre normal post-transmisión). Solo si `res.writableFinished === false`, reporta `FALLIDO` con `TRANSFERENCIA_INTERRUMPIDA`.
     - Evento `error`: Cancela heartbeat. Si no estaba finalizado, reporta `FALLIDO`.
   - Esto erradica cualquier reporte contradictorio o carrera entre `finish` y `close`.
6. **Aclaración Probatoria sobre el Evento `finish` y Precisión de Certificación:**
   > [!IMPORTANT]
   > 1. El evento `finish` de `http.ServerResponse` certifica exclusivamente que el proceso servidor ha escrito todos los bytes en el socket TCP del sistema operativo. No acredita que los paquetes hayan llegado a la interfaz de red del cliente ni que el archivo haya sido guardado en el disco del usuario. La acreditación con valor probatorio legal corresponde al acuse administrativo formal de recepción (`POST /api/v1/casilla/notificaciones/:id/acuse`).
   > 2. **Declaración formal de certificación del modelo Lease & Heartbeat:** En Fase A0 se certifica exclusivamente como:  
   >    **«Diseño técnico documentado, pendiente de implementación y pruebas funcionales y de concurrencia en las fases B y D»**.  
   >    Queda terminantemente prohibido atribuir pruebas de ejecución física que no se hayan realizado en esta etapa documental.

#### 3.3.3. Conciliación Factual de Endpoints, Inspección Estática y Matriz de Acceso Documental

##### A. Inspección Estática de las Tres (3) Rutas de Descarga en el Prototipo Actual

En atención a la verificación técnica rigurosa de las rutas de obtención documental en el backend (`backend/src/domains/storage/storage.router.ts`, `backend/src/domains/casilla/casilla.router.ts` y sus respectivos controladores), se consigna el resultado factual de las seis (6) interrogantes técnicas de inspección:

1. **`GET /api/v1/storage/documentos/:id/download` (Descarga de adjunto institucional):**
   - **(1) ¿Genera URL prefirmada GET?:** **SÍ.** Invoca internamente `getSignedUrl(s3Client, new GetObjectCommand({ Bucket, Key }), { expiresIn: 900 })`.
   - **(2) ¿La entrega al cliente?:** **SÍ.** Retorna al cliente un payload JSON estructurado `{ downloadUrl: string, expiraEnSegundos: 900 }`.
   - **(3) ¿Redirige?:** **NO.** No ejecuta redirección HTTP `302/307`; el navegador cliente debe capturar la URL del JSON y abrirla.
   - **(4) ¿El backend la consume internamente?:** **NO.** El servidor Node.js no consume la URL ni actúa como intermediario del flujo de datos en el prototipo actual.
   - **(5) ¿Transmite directamente el contenido binario?:** **NO.** La descarga del binario se realiza directamente desde el cliente hacia el almacenamiento MinIO/S3.
   - **(6) ¿Qué autorización y validación de titularidad aplica?:** Valida exclusivamente la autenticación general mediante JWT (`authMiddleware`). En el código actual carece de control RBAC sobre `#32 EXPEDIENTE_DESCARGAR`, carece de control de expedientes y no registra evento WORM (brecha identificada en TSK-1.1B que se subsanará definitivamente en Fase B).

2. **`GET /api/v1/storage/download/:bucket/:key` (Descarga directa por bucket/key):**
   - **(1) ¿Genera URL prefirmada GET?:** **SÍ.** Invoca la API del SDK S3 para firmar una URL GET temporal.
   - **(2) ¿La entrega al cliente?:** **SÍ.** Devuelve la URL prefirmada en respuesta JSON.
   - **(3) ¿Redirige?:** **NO.** No emite código HTTP 302/307.
   - **(4) ¿El backend la consume internamente?:** **NO.** Delega la transferencia al cliente.
   - **(5) ¿Transmite directamente el contenido binario?:** **NO.**
   - **(6) ¿Qué autorización y validación de titularidad aplica?:** Valida token JWT activo. Constituye un endpoint técnico de infraestructura que expone claves de bucket. En Fase B queda clasificado para supresión o encapsulamiento en streaming directo exclusivo para soporte/mantenimiento.

3. **`GET /api/v1/casilla/notificaciones/:id/documento/descargar` (Descarga ciudadana de notificación):**
   - *Aclaración sobre la ruta:* Se certifica formalmente que la ruta `/api/v1/casilla/documentos/:id/descargar` **NO existe** en el repositorio; la ruta mounted y comprobada en código es `/api/v1/casilla/notificaciones/:id/documento/descargar`.
   - **(1) ¿Genera URL prefirmada GET?:** **SÍ.** Genera una URL prefirmada de lectura contra el bucket de notificaciones.
   - **(2) ¿La entrega al cliente?:** **SÍ.** Retorna un payload JSON con la URL firmada para su descarga por el administrado.
   - **(3) ¿Redirige?:** **NO.** No utiliza redirección HTTP.
   - **(4) ¿El backend la consume internamente?:** **NO.**
   - **(5) ¿Transmite directamente el contenido binario?:** **NO en el prototipo actual.**
   - **(6) ¿Qué autorización y validación de titularidad aplica?:** Aplica **validación estricta de titularidad**. Comprueba mediante consulta relacional en base de datos que `notificacion.usuario_id === claims.sub` (o la persona natural asociada). Si el solicitante no es el titular, deniega el acceso con `403 Prohibido`.

##### B. Política Arquitectónica de Descargas Aprobada para Fase B (Eliminación de URLs Prefirmadas GET)

1. **Sustitución Obligatoria por Backend Streaming:**
   - En Fase B, **se eliminará la entrega de URLs prefirmadas GET al cliente**.
   - Todas las descargas protegidas (institucionales y ciudadanas) se realizarán mediante **streaming controlado por el backend**. El servidor Node.js consumirá internamente el `ReadableStream` devuelto por MinIO (`s3.send(new GetObjectCommand(...))`) y lo canalizará (*pipe*) directamente hacia la respuesta HTTP del cliente (`res`), configurando las cabeceras `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="documento.pdf"` y `Content-Length`.
   - Cero exposición de credenciales temporales o direcciones de red internas de almacenamiento MinIO hacia el navegador cliente.
2. **Preservación de URLs Prefirmadas PUT para Carga de Archivos:**
   - La ruta `POST /api/v1/storage/presigned-url` **se conserva** para la subida de documentos $\le 25$ MB. La subida directa mediante URL prefirmada PUT con autorización previa optimiza los recursos de CPU/RAM de la API Node.js y previene cuellos de botella en transferencias masivas.
3. **Casilla Electrónica en Fase B:**
   - La Casilla Electrónica mantendrá su validación estricta de titularidad (`notificacion.usuario_id === claims.sub`), pero la entrega del archivo transitará de URL prefirmada GET a **streaming directo con acuse de descarga auditado**.

##### C. Contrato de Autorización Técnica para `GET /api/v1/storage/documentos/:id/view` (Propuesto Fase B)

El visor de documentos PDF inline en el navegador (`GET /api/v1/storage/documentos/:id/view`) operará mediante streaming backend con cabecera `Content-Disposition: inline`. Su contrato de autorización **no puede limitarse únicamente a área, custodia o titularidad**, debiendo implementar la siguiente jerarquía de validación de tres niveles:

1. **Nivel 1 — `ADMINISTRADOR` Institucional (Lectura Global Institucional):**
   - Si `claims.ctx === 'ADMINISTRADOR'`, el backend valida que `claims.institucion_id === expediente.institucion_id` (delimitación multi-tenant).
   - Otorga acceso de visualización de **cualquier expediente y documento de su propia institución**, sin verificar área de adscripción, custodia de legajo ni titularidad personal.
   - Restricción: No autoriza descarga ordinaria (`Content-Disposition: attachment` denegado salvo autorización excepcional).
2. **Nivel 2 — `SUPER_ADMIN_PLATAFORMA` (Acceso Privilegiado de Plataforma SaaS):**
   - Si la petición proviene del Superadministrador de Plataforma, se exige verificación previa de MFA en servidor (`mfa_verificado = TRUE`) y contexto SaaS activo.
   - Otorga visualización global multiinstitucional con registro obligatorio e inmutable en `sigd_audit.bitacora_superadmin_saas`.
3. **Nivel 3 — Demás Roles Institucionales y Titulares (Acceso Contextual y RBAC):**
   - Para los roles operativos institucionales (`DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO`, `MESA_PARTES`, `DOCENTE`, `TESORERO`), se verifica la tenencia de `EXPEDIENTE_LEER` en su contexto activo y la correspondencia con el área de adscripción, comisión o custodia del expediente.
   - Para `ESTUDIANTE` y `CIUDADANO`, se valida estrictamente la titularidad sobre el documento (`solicitante_id === claims.sub` / `id_persona`).

##### D. Inventario y Clasificación de Operaciones Documentales (Metadatos, Listado, Vista Previa y Descarga)

De la inspección estática exhaustiva sobre el árbol de routers (`backend/src/domains/rutadoc/rutadoc.router.ts`, `backend/src/core/storage/storage.router.ts`, `backend/src/domains/identicore/casilla.router.ts`, `backend/src/domains/docucore/docucore.router.ts`) y sus puntos de montaje en `backend/src/app.ts`, se establece la separación taxativa de las cuatro (4) operaciones documentales del sistema:

1. **Consulta de Metadatos y Estructura del Expediente (`GET /api/v1/expedientes/:id`):**
   - **Estado en código:** **EXISTE.** Montada en `rutadoc.router.ts` con prefijo `/api/v1`.
   - **Controlador y Servicio:** `controlador.obtener` en `rutadoc.controller.ts` -> `rutadoc.service.ts:obtener` -> `rutadoc.repository.ts:obtener`.
   - **Contrato de Autorización:** Requiere autenticación Bearer y permiso `EXPEDIENTE_LEER`. En el backend, valida lectura global para `ADMINISTRADOR` dentro de su institución (`doc.institucion_id === user.institucion_id`), contexto por área/custodia para roles internos, y titularidad estricta para `CIUDADANO` y `ESTUDIANTE`.
   - **Respuesta:** Objeto JSON `ExpedienteDetalle` conteniendo metadatos, estado actual, trazabilidad básica y el arreglo de documentos adjuntos (`documentos: [...]`).
2. **Listado Específico Desacoplado de Documentos (`GET /api/v1/expedientes/:id/documentos`):**
   - **Estado en código:** **`NO EXISTE EN EL PROTOTIPO ACTUAL`**.
   - **Evidencia factual:** La búsqueda exhaustiva de rutas en `backend/src/domains/rutadoc/rutadoc.router.ts` y en la totalidad del repositorio confirma que **no existe una ruta GET para `/expedientes/:id/documentos`** (únicamente existe `POST /api/v1/expedientes/:id/documentos` para la incorporación de documentos). En el prototipo actual, los documentos del expediente se obtienen conjuntamente en el payload de `GET /api/v1/expedientes/:id`.
   - **Contrato para Fase B:** Si durante la implementación de Fase B se decide desacoplar este endpoint para expedientes de gran volumen con paginación, deberá regirse estrictamente por `EXPEDIENTE_LEER` bajo las mismas reglas de SoD institucional de `GET /api/v1/expedientes/:id`.
3. **Visualización Documental Inline (`GET /api/v1/storage/documentos/:id/view`):**
   - **Estado en código:** **PROPUESTO PARA FASE B.**
   - **Contrato de Autorización:** Requiere autenticación Bearer y permiso `EXPEDIENTE_LEER`. Validación de 3 niveles: (Nivel 1) Lectura global institucional para `ADMINISTRADOR`; (Nivel 2) Acceso de diagnóstico global SaaS para `SUPER_ADMIN_PLATAFORMA` con MFA; (Nivel 3) Acceso contextual por área/custodia/titularidad para los demás roles.
   - **Mecanismo:** Streaming controlado por backend con cabeceras `Content-Type: application/pdf`, `Content-Disposition: inline; filename="..."` y `X-Content-Type-Options: nosniff`. Registro en `sigd_audit.bitacora_acceso_documental`.
4. **Descarga de Archivos Adjuntos Institucionales (`GET /api/v1/storage/documentos/:id/download`):**
   - **Estado en código:** **EXISTE (Prototipo: Presigned GET / Fase B: Backend Streaming).**
   - **Contrato de Autorización:** Requiere `#32 EXPEDIENTE_DESCARGAR` formalmente concedido en `sigd_org.rol_permiso` o autorización extraordinaria vigente en `sigd_org.autorizacion_descarga_excepcional` con reserva atómica previa en `sigd_org.intento_descarga_excepcional`.
   - **Mecanismo en Fase B:** Streaming backend directo (`Content-Disposition: attachment`), eliminando la entrega de URLs prefirmadas GET al cliente. Registro en `sigd_audit.bitacora_acceso_documental`.

##### E. Matriz Definitiva de Conciliación de Rutas Montadas en el Backend

| # | Método | Ruta Efectiva Montada | Router de Origen | Prefijo `app.ts` | Operación | Autorización Requerida | Validación de Contexto / Tenant | Mecanismo de Transferencia | Registro de Auditoría |
|:---:|:---:|---|---|:---:|---|---|---|---|---|
| 1 | `GET` | `/api/v1/expedientes/:id` | `rutadoc.router.ts` | `/api/v1` | Consulta de expediente y metadatos (incluye arreglo `documentos`) | Token Bearer + `EXPEDIENTE_LEER` | Global para ADMINISTRADOR; área/custodia para demás roles; titularidad para administrados | JSON `ExpedienteDetalle` | `sigd_audit.bitacora_auditoria` |
| *--*| *`GET`*| */api/v1/expedientes/:id/documentos* | *Inexistente en código* | *N/A* | *Listado desacoplado de documentos adjuntos* | *N/A* | *`NO EXISTE EN EL PROTOTIPO ACTUAL` (se obtienen en ruta #1)* | *N/A (Diseño desacoplado Fase B)* | *N/A* |
| 2 | `POST`| `/api/v1/expedientes/:id/documentos` | `rutadoc.router.ts` | `/api/v1` | Incorporación de documento adjunto a expediente | Token Bearer + `EXPEDIENTE_ADJUNTAR` | Verificación de área operativa y estado de trámite | Persistencia relacional | `sigd_audit.bitacora_auditoria` |
| 3 | `GET` | `/api/v1/storage/documentos/:id/download` | `storage.router.ts` | `/api/v1` | Descarga de documento institucional | Token Bearer + Permiso #32 activo o autorización excepcional | Expediente de la institución / beneficiario con reserva atómica | Prototipo: Presigned GET. **Fase B: Backend Streaming (`attachment`)** | `sigd_audit.bitacora_acceso_documental` |
| 4 | `GET` | `/api/v1/storage/download/:bucket/:key` | `storage.router.ts` | `/api/v1` | Descarga directa técnica de almacenamiento | Token Bearer | Endpoint técnico interno | Prototipo: Presigned GET. **Fase B: Suprimido / Streaming interno auditado** | `sigd_audit.bitacora_acceso_documental` |
| 5 | `POST`| `/api/v1/storage/presigned-url` | `storage.router.ts` | `/api/v1` | Emisión de URL PUT para subida directa de PDF | Token Bearer activo | Verificación de pertenencia institucional | Presigned PUT $\le 25$ MB (**Se mantiene en Fase B**) | `sigd_audit.bitacora_auditoria` |
| 6 | `POST`| `/api/v1/storage/confirmar-carga` | `storage.router.ts` | `/api/v1` | Confirmación e indexación SHA-256 de PDF | Token Bearer activo | Cotejo de integridad y hash SHA-256 | Persistencia en `documento_adjunto` | `sigd_audit.bitacora_auditoria` |
| 7 | `GET` | `/api/v1/casilla/notificaciones/:id/documento/descargar` | `casilla.router.ts` | `/api/v1` | Descarga ciudadana de PDF de acto notificado | Token Bearer de titular | Estricta: `notificacion.usuario_id === claims.sub` | Prototipo: Presigned GET. **Fase B: Backend Streaming (`attachment`)** | `sigd_audit.bitacora_acceso_documental` |
| 8 | `GET` | `/api/v1/casilla/notificaciones/:id/acuse/descargar` | `casilla.router.ts` | `/api/v1` | Descarga de acuse digital de notificación | Token Bearer de titular | Estricta: `notificacion.usuario_id === claims.sub` | Generación y streaming de certificado digital | `sigd_audit.bitacora_acceso_documental` |
| 9 | `GET` | `/api/v1/validador-cvd/verificar/:cvd` *(y `/validador/cvd/:codigo`)* | `docucore.router.ts` | `/api` *(y `/api/v1`)* | Consulta pública de autenticidad CVD / QR | Acceso público | No aplica (Cotejo de hash firmado y metadatos) | Respuesta JSON de validez jurídica | `sigd_audit.bitacora_auditoria` |
| 10| `POST`| `/api/v1/firma/callback-refirma` | `docucore.router.ts` | `/api` | Recepción de documento firmado por pasarela ReFirma | HMAC de pasarela oficial | Verificación criptográfica de firma | Ingesta binaria y registro | `sigd_audit.bitacora_auditoria` |
| *11*| *`GET`*| */api/v1/storage/documentos/:id/view* *(Propuesto Fase B)* | *Diseño Fase B* | */api/v1* | *Visualización inline en visor PDF controlado* | *Token Bearer + `EXPEDIENTE_LEER`* | *Global para ADMINISTRADOR; SaaS para SUPER_ADMIN; contextual para demás roles* | *Backend Streaming `inline` (`Content-Disposition: inline`)* | *`sigd_audit.bitacora_acceso_documental`* |

> [!NOTE]
> **Rectificación y Descarte de Ruta Fantasma:** Se ratifica de forma taxativa que la ruta `/api/v1/casilla/documentos/:id/descargar` **NO existe** en el árbol de código fuente. Toda referencia a ella queda sustituida por `/api/v1/casilla/notificaciones/:id/documento/descargar`.

#### 3.3.4. Semántica Técnica de Eventos de Streaming y Diferenciación de Acuse de Recibo

Para garantizar la precisión forense de la bitácora de acceso documental, se establece la distinción exacta de los eventos del ciclo de vida de transferencia:
1. **`SOLICITUD_RECIBIDA` (`SOLICITUD_DESCARGAR` / `SOLICITUD_VISUALIZACION`):** Se recibe la petición HTTP entrante en el controlador.
2. **`ACCESO_AUTORIZADO`:** Se validan satisfactoriamente los claims JWT, el contexto activo, la vigencia temporal estricta de `#32` o la titularidad legítima.
3. **`ACCESO_DENEGADO`:** La solicitud falla por contexto revocado, vencimiento temporal alcanzado o carencia del permiso.
4. **`TRANSFERENCIA_INICIADA`:** El servidor abre el stream de lectura hacia el storage MinIO/S3 y emite el primer chunk de datos hacia el cliente (`res.write()`).
5. **`TRANSFERENCIA_COMPLETADA` (*Server Stream Finished / Flushed*):** Se dispara en el evento `finish` del objeto `http.ServerResponse` de Node.js. **Certifica técnica y exclusivamente que el servidor web completó la transmisión de todos los bytes hacia el socket de red del host**. **NO presupone ni certifica que el usuario final haya recibido, decodificado o guardado exitosamente el archivo en su dispositivo local.**
6. **`TRANSFERENCIA_FALLIDA`:** Ocurre una excepción de lectura en el almacenamiento o un error interno 5xx antes de completar el streaming.
7. **`TRANSFERENCIA_INTERRUMPIDA`:** Se dispara el evento `close` del socket de red antes de alcanzar el evento `finish` (desconexión del cliente, cancelación voluntaria por el usuario o pérdida de conectividad de red).

> [!IMPORTANT]
> **Garantía Probatoria de Recepción Ciudadana:** La confirmación legal de que un administrado recibió y tomó conocimiento de un acto notificado **no se infiere del transporte de red ni del evento `TRANSFERENCIA_COMPLETADA`**, sino que exige un mecanismo independiente de **Acuse de Notificación Fehadiente** (`POST /api/v1/casilla/notificaciones/:id/acuse`), con cálculo de hash SHA-256, sellado de tiempo inmutable y generación del código identificador de acuse legal.

Para evitar cualquier ambigüedad técnica o documental, se establece con total claridad la coexistencia armónica y no redundante entre los **dos mecanismos institucionales** para la descarga documental:

1. **Mecanismo Ordinario Individual (`sigd_org.autorizacion_rol_permiso_institucional`):**
   - **Propósito:** Concesión formal e individualizada del permiso `#32 EXPEDIENTE_DESCARGAR` a un usuario institucional específico de uno de los 7 roles operativos elegibles (`DIRECTOR`, `JEFE_UNIDAD`, `JEFE_AREA`, `SECRETARIA`, `MESA_PARTES`, `DOCENTE`, `OPERADOR_COOP`).
   - **Naturaleza jurídica y operativa:** No otorga permisos masivos en bloque a un rol entero ni desprotege el catálogo canónico binario `sigd_org.rol_permiso`. Vincula unívocamente el permiso a una persona natural formalmente identificada (`usuario_beneficiario_id`), delimitada por su ámbito/área, respaldada por un acto administrativo y justificación motivada, con fecha de caducidad cierta y trazabilidad completa.
   - **Requisitos satisfechos:** Cumple íntegramente con los 18 requisitos institucionales obligatorios (detallados más adelante).

2. **Mecanismo Extraordinario Temporal por Expediente (`sigd_org.autorizacion_descarga_excepcional`):**
   - **Propósito:** Autorización ad-hoc de emergencia circunscrita a un único expediente concreto (`expediente_id`) y una lista cerrada de documentos (`documentos_permitidos UUID[]`).
   - **Naturaleza operativa:** Diseñado para contingencias o comisiones urgentes en las cuales un funcionario que **no** ostenta una asignación ordinaria activa de `#32` requiere descargar puntualmente las piezas de un expediente para una diligencia justificada.
   - **Parámetros estrictos:** Vigencia efímera máxima de **$\le 15$ minutos**, no renovable automáticamente, no auto-otorgable por el beneficiario (`chk_desc_excep_no_auto`), aprobada por el Director institucional (o autoridad jerárquica superior competente acreditada si el beneficiario es el Director) y ejecutada técnicamente por el Administrador, con streaming backend y auditoría en `bitacora_acceso_documental`.

- **Brecha identificada en `sigd_org.rol_permiso`:** La tabla binaria `sigd_org.rol_permiso (rol_id, permiso_id)` carece de columnas para `institucion_id`, `usuario_beneficiario_id`, autoridad que autorizó (`autoridad_otorgante_id`), ejecutor técnico (`ejecutor_tecnico_id`), justificación, vigencia, estado y revocación. En un entorno multi-institucional, asignar `#32` directamente en `rol_permiso` produciría una fuga accidental de privilegios hacia todas las instituciones de la plataforma SaaS y hacia todos los usuarios que posean el rol.
- **Solución arquitectónica (Anexo DDL en `23_` — Diseñado / Propuesto):** Creación de `sigd_org.autorizacion_rol_permiso_institucional`, asegurando el cumplimiento de los **18 requisitos obligatorios**:
  1. **Identificador único:** `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
  2. **Institución beneficiaria:** `institucion_id UUID NOT NULL` (delimita estrictamente el tenant; en `sigd_jacobo_demo` almacena el UUID de IESTP «Suiza» sin FK a `sigd_saas.institucion`, cuya creación física corresponde a `24_+`).
  3. **Usuario beneficiario individual:** `usuario_beneficiario_id UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`. Validado como **estrictamente obligatorio (`NOT NULL`)** para `#32 EXPEDIENTE_DESCARGAR` mediante trigger `fn_validar_autorizacion_rol_permiso_institucional`, garantizando la vinculación a personas naturales y prohibiendo asignaciones en bloque a roles.
  4. **Área u órgano delimitado:** `contexto_autorizado_id UUID REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT` (NULL para alcance institucional global según la naturaleza del rol).
  5. **Permiso específico:** `permiso_id UUID NOT NULL REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE RESTRICT` (específicamente `#32 EXPEDIENTE_DESCARGAR`).
  6. **Autoridad institucional autorizante:** `autoridad_otorgante_id UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT` (Director institucional) o metadatos de órgano jerárquico superior competente y formalmente acreditado conforme al marco normativo aplicable cuando el beneficiario sea el Director.
  7. **Administrador técnico ejecutor:** `ejecutor_tecnico_id UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT` (quien registra formalmente la autorización).
  8. **Acto administrativo sustentatorio:** `acto_administrativo_tipo`, `acto_administrativo_numero`, `acto_administrativo_fecha`, `acto_administrativo_archivo_id REFERENCES sigd_doc.documento_adjunto(documento_adjunto_id)` y `acto_administrativo_sustento`.
  9. **Justificación formal motivada:** `justificacion TEXT NOT NULL` con restricción de longitud mínima (`CONSTRAINT chk_auth_inst_justificacion CHECK (char_length(trim(justificacion)) >= 15)`).
  10. **Fecha de formalización de la autorización:** `autorizado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`.
  11. **Fecha y hora de inicio de vigencia:** `vigente_desde TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`.
  12. **Fecha de vencimiento obligatoria:** `vigente_hasta TIMESTAMPTZ NOT NULL` con restricción estricta `CONSTRAINT chk_auth_inst_vigencia CHECK (vigente_hasta > vigente_desde)`. Prohibidas asignaciones indefinidas para `#32`.
  13. **Estado activo:** `activo BOOLEAN NOT NULL DEFAULT TRUE`.
  14. **Revocación motivada:** `revocado_en TIMESTAMPTZ`, `revocado_por_id UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario)`, `motivo_revocacion TEXT` con `CONSTRAINT chk_auth_inst_revocacion CHECK (activo = TRUE OR revocado_en IS NOT NULL)`.
  15. **Auditoría inmutable:** Registro de auditoría con las 13 dimensiones canónicas y persistencia de eventos en `sigd_audit.bitacora_auditoria` (DML) y `sigd_audit.bitacora_superadmin_saas` si interviene la capa SaaS.
  16. **Protección contra duplicados incompatibles:** Dos índices únicos parciales propuestos que integran obligatoriamente a `usuario_beneficiario_id`:
      - `uq_auth_rol_permiso_activa_usr_ctx`: `UNIQUE (institucion_id, usuario_beneficiario_id, rol_id, permiso_id, contexto_autorizado_id) WHERE activo = TRUE AND contexto_autorizado_id IS NOT NULL`.
      - `uq_auth_rol_permiso_activa_usr_global`: `UNIQUE (institucion_id, usuario_beneficiario_id, rol_id, permiso_id) WHERE activo = TRUE AND contexto_autorizado_id IS NULL`.
  17. **Control de concurrencia y serialización atómica:** Bloqueo consultivo de 64 bits a nivel de transacción:
      `PERFORM pg_advisory_xact_lock(hashtextextended('auth_rol_permiso:' || NEW.institucion_id::text || ':' || COALESCE(NEW.usuario_beneficiario_id::text, '00000000-0000-0000-0000-000000000000') || ':' || NEW.rol_id::text || ':' || NEW.permiso_id::text, 0::bigint));`
      Este lock se adquiere **antes** de verificar autorizaciones incompatibles o duplicadas, neutralizando cualquier condición de carrera (*phantom inserts* bajo `READ COMMITTED`).
  18. **Verificación de vigencia estricta en tiempo de ejecución (Cero autorizaciones indefinidas):** En cada solicitud HTTP de descarga procesada por el streaming backend, se valida dinámicamente con estricto vencimiento obligatorio (prohibido `vigente_hasta IS NULL`):
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
      Toda autorización del permiso `#32` caduca inexorablemente al cumplirse `vigente_hasta`.

- **Reglas Innegociables de Autoridad y No-Autoautorización:**
  - **Prohibición absoluta de autoautorización del Director:** `CONSTRAINT chk_auth_inst_no_auto_director CHECK (tipo_autoridad_otorgante <> 'DIRECTOR' OR (usuario_beneficiario_id IS NULL OR autoridad_otorgante_id <> usuario_beneficiario_id))`. Ningún Director puede emitir resoluciones ni actos que lo autoricen a sí mismo para descargar expedientes.
  - **Autorización al Director por Autoridad Superior Competente:** Cuando el beneficiario individual es el Director (`usuario_beneficiario_id = id_del_director`), la autorización debe ser otorgada por un **órgano jerárquico superior competente y formalmente acreditado conforme al marco normativo aplicable**, consignando sus datos en `autoridad_superior_nombre`, `autoridad_superior_cargo`, `autoridad_superior_entidad`, junto con el acto administrativo que sustenta la habilitación.
  - **Prohibición de autoasignación del Administrador:** `CONSTRAINT chk_auth_inst_no_auto_ejecutor CHECK (ejecutor_tecnico_id IS NULL OR usuario_beneficiario_id IS NULL OR ejecutor_tecnico_id <> usuario_beneficiario_id)`. El Administrador actúa como ejecutor técnico registral; no puede concederse a sí mismo autorizaciones de descarga.
- **Tres Niveles de Revocación Inmediata bajo Política B:**
  1. *Revocación de autorización específica de rol/permiso:* Se marca `activo = FALSE`, `revocado_en = clock_timestamp()` en `autorizacion_rol_permiso_institucional`.
  2. *Invalidación de contexto operativo:* Se comprueba `claims.ctx` en PostgreSQL en cada petición protegida contra `sigd_org.usuario_rol` (`vigente_desde <= now()` y `vigente_hasta > now()`), formalizándose en Fase B el rechazo explícito `403 CONTEXT_REVOKED` ante contextos revocados o vencidos.
  3. *Desactivación de cuenta de usuario e invalidación de sesiones:* En el esquema físico existente (`02_sigd_auth.sql`), la tabla `sigd_auth.sesion_usuario` no posee columnas `activa`, `cerrada_en` ni `motivo_cierre`; la vigencia de sesiones se rige por `revocado_en TIMESTAMPTZ NULL` y `expira_en > now()`. Al desactivar una cuenta (`cuenta_usuario.activo = FALSE`), se invalidan las sesiones activas mediante:
     `UPDATE sigd_auth.sesion_usuario SET revocado_en = clock_timestamp() WHERE id_usuario = $1 AND revocado_en IS NULL;`
  - *Honestidad técnica sobre latencia:* La revocación surte **efecto inmediato en la siguiente petición HTTP protegida** procesada por el backend al validar contra PostgreSQL. No se utilizan afirmaciones indemostrables de "0 segundos / 1 milisegundo". No se depende de Redis para conceder o revocar estas autorizaciones. Los bytes de documentos que hayan sido transferidos al cliente antes del instante de la revocación no pueden recuperarse físicamente de la memoria del navegador.
- **Modelo de Auditoría (13 Dimensiones):** Permite reconstruir con fidelidad: (1) solicitante, (2) autoridad autorizante, (3) ejecutor técnico, (4) flag SaaS, (5) institución, (6) rol, (7) permiso, (8) contexto/ámbito, (9) justificación, (10) timestamp, (11) estado anterior, (12) estado posterior, y (13) revocación.
- **Registro Operativo vs. WORM Append-Only:** El registro operativo se mantiene en `sigd_org.autorizacion_rol_permiso_institucional` para consulta transaccional en runtime, mientras que la justificación original y toda la evidencia histórica permanecen inmutables y recuperables para siempre en las tres bitácoras oficiales append-only: `sigd_audit.bitacora_auditoria` (DML), `sigd_audit.bitacora_acceso_documental` (documental) y `sigd_audit.bitacora_superadmin_saas` (SaaS). Cero cuarta bitácora. Se reconoce además que la inmutabilidad absoluta frente a superusuarios de PostgreSQL o administradores de infraestructura requiere reenvío continuo (log shipping append-only) hacia almacenamiento WORM / SIEM externo.

### 3.4. Decisión Confirmada sobre `ADMINISTRADOR`, Validación Real de Claims y Separación SaaS

En `sigd_jacobo_demo`, `ADMINISTRADOR` conservaba heredados `FIRMA_FIRMAR` y `EXPEDIENTE_RESOLVER` en `sigd_org.rol_permiso`, además de múltiples bypasses implícitos por código (`ROLES_FIRMA`, `esAdminODirector`, `exigirOperadorVentanilla`, `politicaReversionPredeterminada`). Conforme a las decisiones confirmadas en [TSK_1_2_A0_REVISION_TECNICA_FINAL.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_REVISION_TECNICA_FINAL.md) y [TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md):

#### 3.4.1. Estructura Real de Claims JWT y Modelo de Contexto en el Backend
De la inspección estática del código en `backend/src/core/auth/jwt.service.ts`, `backend/src/core/auth/contexto.service.ts` y `backend/src/core/auth/auth.guard.ts`:
- **Contrato de Claims en el JWT (`ClaimsJwt`):**
  - `sub`: Identificador UUID de la cuenta de usuario (`cu.id_usuario`).
  - `roles`: Arreglo de cadenas con los códigos de roles (`string[]`).
  - `rol`: Cadena con el código del rol activo seleccionado (e.g. `'ADMINISTRADOR'`).
  - `ctx`: **Identificador UUID de la asignación activa (`idAsignacion`)**, correspondiente a `sigd_org.usuario_rol.id_usuario_rol` (o `sigd_org.usuario_capacidad.id_usuario_capacidad`). **No es una cadena de texto con el nombre del rol.**
  - `iat`, `exp`, `typ: 'access'`.
- **Mecanismo Real de Autorización Contextual (Cero Bypasses por Cadena JWT):**
  - La autorización en el backend **NO se basa en una comparación trivial de cadenas sobre el token** (como `claims.ctx === 'ADMINISTRADOR'`).
  - El middleware `resolverIdentidad(req)` extrae `claims.ctx` como `contextoId` y valida la correspondencia con la cabecera `x-contexto-id`.
  - La función `obtenerAutorizacionCuenta(pool, idUsuario, idAsignacionContexto)` consulta en tiempo real en la base de datos la tabla `sigd_org.usuario_rol ur` con filtro `ur.id_usuario_rol = $2::uuid`, verificando que la cuenta esté activa (`cu.activo = TRUE`), que la asignación esté vigente (`ur.vigente_desde <= now() AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())`) y que el rol asignado sea efectivamente `ADMINISTRADOR`.
  - Si el usuario revoca o cambia su asignación, cualquier token anterior es rechazado con `403 CONTEXT_REVOKED` al consultar la base relacional.

#### 3.4.2. Política Definitiva de Acceso de `ADMINISTRADOR`
- **Lectura Global Institucional:** Cuando el contexto activo resuelto en base de datos es `ADMINISTRADOR`, el sistema le concede consulta y lectura global sobre **todos** los expedientes de su propia institución (`EXPEDIENTE_LEER` con ámbito `GLOBAL` institucional acotado estrictamente a `doc.institucion_id === user.institucion_id`), pudiendo consultar bandeja general, filtros, metadatos, historial, custodios, trazabilidad y visualización previa de documentos PDF mediante streaming backend inline (`GET /api/v1/storage/documentos/:id/view`), **sin necesidad de asignaciones individuales ni conmutación de roles y sin acceso cruzado a expedientes de otras instituciones en entornos SaaS**.
- **CERO Escritura, CERO Resolución y CERO Modificación:** `ADMINISTRADOR` NO crea trámites, NO edita, NO adjunta ni elimina documentos ordinariamente, NO deriva, NO asigna/reasigna, NO observa, NO subsana, NO evalúa, NO aprueba, NO resuelve, NO firma, NO cierra y NO archiva expedientes.
- **CERO Descarga Ordinaria (#32):** La visualización controlada en visor inline se rige por lectura (`EXPEDIENTE_LEER` + streaming backend `inline` + auditoría en `bitacora_acceso_documental`), mientras que la descarga de archivos permanece **denegada por defecto** (no recibe `#32 EXPEDIENTE_DESCARGAR` en `sigd_org.rol_permiso`). En casos de emergencia pericial, solo puede descargar mediante una autorización extraordinaria puntual ($\le 15$ min) otorgada por el `DIRECTOR` (o autoridad superior competente) y asentada sin auto-asignación, sujeta al flujo de reserva atómica previa (`sigd_org.intento_descarga_excepcional`).
- **En Fase A (`22_`):** Se retiran de `sigd_org.rol_permiso` **exclusivamente** `ADMINISTRADOR -> FIRMA_FIRMAR` y `ADMINISTRADOR -> EXPEDIENTE_RESOLVER` (sin alterar `ADMIN_USUARIOS`, `EXPEDIENTE_LEER` `GLOBAL` ni `REPORTE_LEER`).
- **En Fases B y C:** Se eliminan todos los bypasses implícitos por código (`ROLES_FIRMA`, `esAdminODirector`, etc.).

#### 3.4.3. Frontera con `SUPER_ADMIN_PLATAFORMA`
- El **Superadministrador de Plataforma** opera en el dominio SaaS (`PROPUESTO` como esquema `sigd_saas` dentro de `sigd_jacobo_demo`) con acceso global multi-institución (lectura, visualización y descarga integral auditada en `sigd_audit.bitacora_superadmin_saas`), respaldado por verificación de MFA en servidor (`mfa_verificado = TRUE`), sin pertenecer a los 10 roles institucionales ni usar `#32`, y **con CERO autoridad legal para aprobar expedientes, firmar resoluciones institucionales o sustituir la voluntad de las autoridades locales**.

---

### 3.5. Protocolo de Transición Segura, Punto Real de Mantenimiento y Política de Rollback

Para erradicar cualquier riesgo de vulnerabilidad durante la transición hacia el nuevo modelo RBAC, se define la estrategia obligatoria de despliegue coordinado:

1. **Diagnóstico de Riesgo de Desincronización Operativa:**
   - La migración `22_` en PostgreSQL crea los nuevos permisos relacionales, desactiva `ESPECIALISTA` y retira facultades de `ADMINISTRADOR`.
   - Si la migración PostgreSQL se ejecuta en caliente mientras el backend legacy continúa atendiendo tráfico de usuarios, los endpoints actuales de almacenamiento continuarían emitiendo URLs prefirmadas GET de 900 s hacia MinIO y validando únicamente JWT general sin el nuevo modelo RBAC ni la verificación de `#32`.
   - **Regla Innegociable:** **Queda terminantemente prohibido habilitar una ventana de operación desincronizada** en la que PostgreSQL aplique el nuevo catálogo relacional mientras el backend siga autorizando descargas con las reglas antiguas.
2. **Punto Real de Mantenimiento Arquitectónico (Evidencia Factual y Distinción de Fase B):**
   - **Inspección Factual del Prototipo Existente (`backend/src/app.ts` L109-L144):**
     - La inspección directa de [`backend/src/app.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/app.ts#L109-L144) revela el orden exacto de montaje actual:
       - Línea 109: `const app = express();`
       - Línea 112: `app.use(corsMiddleware);`
       - Línea 113: `app.use(express.json({ limit: '10mb' }));`
       - Línea 122: `app.use(contextMiddleware);`
       - Líneas 124-131: `app.get('/health', ...)` (health check de Docker Compose)
       - Líneas 133-144: `app.get('/ready', ...)` (readiness check de base de datos)
       - Líneas 147+: Montaje de routers de negocio (`/api/v1/auth`, `/api/v1/usuarios`, `/api/v1/expedientes`, etc.).
     - **Distinción Técnica Honesta:** **En el prototipo actual NO existe un middleware de mantenimiento ni API Gateway/reverse proxy independiente**. Declararlo preexistente constituiría una falsedad técnica.
   - **Mecanismo Propuesto para Implementación en Fase B:**
     - Se propone implementar en `Fase B` un middleware interceptor (`maintenanceMiddleware`) montado inmediatamente antes de las rutas de negocio en `backend/src/app.ts`.
     - Estará gobernado por la variable de entorno real `SIGD_MAINTENANCE_MODE="true"` (o bandera en memoria/Redis).
     - **Comportamiento durante mantenimiento:** Intercepta el 100 % de las peticiones dirigidas a `/api/v1/*`, `/storage/*` y `/casilla/*`, respondiendo de inmediato con:
       - Código HTTP: `503 Service Unavailable`.
       - Cabecera: `Retry-After: 300`.
       - Payload JSON RFC 7807: `{"type": "https://sigd.iestpsuiza.edu.pe/errors/service-unavailable", "title": "Servicio en Mantenimiento Programado", "status": 503, "detail": "El SIGD se encuentra en ventana de mantenimiento técnico por migración de seguridad.", "code": "MAINTENANCE_MODE"}`.
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
4. **Secuencia de Migración y Distinción Obligatoria en Tres Planos:**
   En cumplimiento de las directrices de integridad documental y verificación estricta, se diferencian expresamente:
   - **(a) Secuencia física de archivos en `backend/migraciones/`:**
     - El archivo predecesor numérico físico en el repositorio es [`backend/migraciones/21_sigd_auth_actualizacion_ubigeo_2026.sql`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/migraciones/21_sigd_auth_actualizacion_ubigeo_2026.sql).
     - La siguiente migración canónica oficial unívocamente reservada es:  
       **`backend/migraciones/22_sigd_org_catalogo_rbac_institucional.sql`**  
       con script de reversión en:  
       **`backend/migraciones/pendientes/22_sigd_org_catalogo_rbac_institucional_rollback.sql`**.
     - Se descarta formalmente cualquier alias preliminar alternativo, preservando la compatibilidad estricta con el runner [`backend/src/db/migrate.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/db/migrate.ts#L170-L185).
   - **(b) Migraciones registradas históricamente en PostgreSQL (`public.sigd_migraciones`):**
     - La tabla relacional de migraciones registra los scripts aplicados a lo largo del historial del sistema.
   - **(c) Migraciones realmente aplicadas:**
     - En esta Fase A0, bajo la **Opción A** (cero conexiones a PostgreSQL y cero sentencias SQL ejecutadas), **NO se realizan afirmaciones categóricas sobre el estado interno de la base de datos sin verificación autorizada en vivo**. La confirmación física se ejecutará formalmente en el Paso 1 de Fase A antes de aplicar cualquier migración.
5. **Secuencia de Despliegue Atómico Coordinado:**
   - **Paso 1 (Aislamiento de Tráfico):** Activación de `SIGD_MAINTENANCE_MODE="true"` en el backend; drenado de conexiones activas.
   - **Paso 2 (Ejecución de Fase A en PostgreSQL):** Aplicación de la migración `22_sigd_org_catalogo_rbac_institucional.sql` sobre `sigd_jacobo_demo` mediante `migrate.ts`.
   - **Paso 3 (Despliegue de Backend Fase B):** Despliegue de la versión actualizada de backend incorporando streaming directo, eliminación de presigned GET, validación estricta de `#32`, endpoint `/view` y reserva atómica con lease/heartbeat en `intento_descarga_excepcional`.
   - **Paso 4 (Suite Automatizada de Verificación Post-Despliegue):** Pruebas de humo en aislamiento (descargas sin #32 denegadas, visualización inline exitosa con ADMINISTRADOR, descarga ciudadana por Casilla con streaming, reserva atómica con lease).
   - **Paso 5 (Reapertura Controlada de Tráfico):** Solo tras la superación del 100 % de las pruebas se desactiva el modo de mantenimiento y se reabre el tráfico institucional.
6. **Diferenciación de Niveles de Reversión y Política de Restauración Física:**
   En cumplimiento estricto de las decisiones institucionales, se distinguen los tres (3) niveles de contingencia:
   - **Nivel 1 — Rollback Transaccional DDL (Automático intra-migración):** Si la ejecución de `22_sigd_org_catalogo_rbac_institucional.sql` falla, el bloque transaccional `BEGIN ... COMMIT` gestionado por `migrate.ts` aborta automáticamente con `ROLLBACK`, dejando la base de datos intacta en el estado de la migración `21_`.
   - **Nivel 2 — Reversión Controlada de Esquema (Manual en ventana de mantenimiento):** Si la migración se aplicó pero la verificación de backend falla en la ventana de mantenimiento sin haberse generado movimientos operativos (`0 filas` nuevas), se ejecuta `22_sigd_org_catalogo_rbac_institucional_rollback.sql` retirando los objetos nuevos sin pérdida de información previa. Si ya hubo operación con datos nuevos, se aplica una migración compensatoria hacia adelante (`24_+`).
   - **Nivel 3 — Restauración Física desde Respaldo Lógico `.dump` (NUNCA Automática):**
     > [!CAUTION]
     > **Toda restauración física de PostgreSQL (`pg_restore`) requiere autorización expresa previa de la Dirección.** Queda terminantemente **PROHIBIDO** ejecutar `pg_restore` de forma automática ante un fallo de script o despliegue.
     - Requisitos previos obligatorios:
       1. Identificación unívoca del respaldo base verificado (`sigd_jacobo_demo_pre_tsk12_2026-11-12T17-29-27.dump`).
       2. Verificación criptográfica exacta de SHA-256 (`1A8B845A53E7C2EA609EC989B8508D300392992E2C07B221429A1C98C9ED2BCC`).
       3. Informe técnico de impacto evaluando la pérdida potencial de datos generados con posterioridad al corte.
       4. Plan de recuperación y cronograma detallado.
       5. Acta formal de autorización expresa emitida y firmada por la Dirección del IESTP «Suiza».

# SIGD SUIZA — TSK-1.2 FASE A0
# INFORME MAESTRO DEFINITIVO DE DISEÑO RBAC, PERMISO `EXPEDIENTE_DESCARGAR` (#32) Y CIERRE ARQUITECTÓNICO PRE-IMPLEMENTACIÓN

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Rama Git exclusiva:** `B_JACOBO`  
**Único entorno aislado:** `B_JACOBO` (`sigd-postgres-1`, `127.0.0.1:5433`)  
**Única base de datos:** `sigd_jacobo_demo` (PostgreSQL 18.6 Alpine)  
**Estado:** **DISEÑO DEFINITIVO CERRADO EN FASE A0 — CERO DECISIONES DE DISEÑO PENDIENTES — CERO MUTACIONES EN POSTGRESQL, DETENIDO ANTES DE FASE A**

---

> [!IMPORTANT]
> **CERTIFICACIÓN DE CUMPLIMIENTO DE PROTECCIONES Y VERACIDAD DE EVIDENCIA SQL:**
> - **PostgreSQL (`sigd_jacobo_demo`):**
>   1. **Auditorías anteriores de Fase 0 / TSK-1.0B:** Únicamente consultas de solo lectura (`SELECT`) de inspección diagnóstica estructural y forense.
>   2. **Etapa de corrección documental actual (TSK-1.2 A0):** Cero consultas SQL ejecutadas (ni siquiera `SELECT`).
>   3. **Fase A0 completa:** Cero mutaciones DDL/DML, cero modificaciones de datos, cero migraciones físicas creadas o ejecutadas en PostgreSQL.
> - **Código fuente (`backend/` y `frontend/`):** Cero modificaciones; ningún archivo creado en `backend/migraciones/` (máxima aplicada conservada: `21_sigd_auth_actualizacion_ubigeo_2026.sql`; ni `22_` ni `23_` promovidas aún). [`TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql) permanece en `docs/` marcado **`NO EJECUTADO — DOCUMENTO DE DISEÑO`**.
> - **Respaldo verificado:** [`sigd_jacobo_demo_pre_tsk12_2026-11-12T17-29-27.dump`](file:///C:/Users/Liz/Backups/SIGD/pre_tsk12/sigd_jacobo_demo_pre_tsk12_2026-11-12T17-29-27.dump) (`662,972 bytes`, SHA-256 `1A8B845A53E7C2EA609EC989B8508D300392992E2C07B221429A1C98C9ED2BCC`, 673 entradas en catálogo, sin sobrescritura ni restauración).
> - **Criterio de cierre:** Todas las decisiones de diseño arquitectónico, funcional, institucional y de seguridad quedan **definitivamente cerradas (`0` decisiones pendientes)**, diferenciando estrictamente entre: (a) **diseño cerrado en Fase A0**, (b) **controles técnicos obligatorios de preejecución** (verificación factual en vivo al abrir Fase A), y (c) **implementación posterior (`Fase A -> Fase B -> Fase C -> Fase D` y `24_+`)**.

---

## 1. DECISIONES DEFINITIVAS CERRADAS EN FASE A0 Y JUSTIFICACIÓN TÉCNICA

### 1.1. Catálogo Oficial de Diez (10) Roles Institucionales y Disposición Definitiva de `ESPECIALISTA`
1. **Catálogo cerrado (`CONFIRMADO`):** Se mantiene un catálogo institucional único de exactamente **10 roles** (sin crear rol #11):
   - **9 roles internos:** `ADMINISTRADOR`, `DIRECTOR`, `JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `SECRETARIO` (*Secretario Académico*), `MESA_PARTES`, `DOCENTE`, `TESORERO` y **`ESTUDIANTE`** (*usuario interno de la comunidad institucional, no necesariamente trabajador ni personal laboral*).
   - **1 rol externo:** **`CIUDADANO`** (*usuario externo a la institución*).
   - **Regla categórica:** **No clasificar a ambos como usuarios externos.** `ESTUDIANTE` pertenece a la comunidad institucional, mientras que `CIUDADANO` es el único perfil externo.
   - **`SUPER_ADMIN_PLATAFORMA`:** Identidad global de plataforma SaaS fuera de `sigd_org.rol_sistema` (no es rol #11).
   - **`GESTOR_APOYO_AREA`:** Capacidad operativa independiente en `sigd_org.capacidad_sistema` / `usuario_capacidad` (no es rol #11).
2. **Descontinuación oficial de `ESPECIALISTA` (`CONFIRMADO` + `PROPUESTO` en `22_` / `Fase B`):**
   - **Decisión cerrada:** En `22_`, **`ESPECIALISTA` se desactiva lógicamente en el catálogo (`UPDATE sigd_org.rol_sistema SET vigente = FALSE WHERE codigo = 'ESPECIALISTA'`)**, conservando intacto su UUID oficial `94ae72fb-0b86-4a6f-ba78-69b19bc888e7`, conservando íntegras las **6 filas históricas en `sigd_org.usuario_rol`** (`4` cuentas) y las trazas referenciales (`documento_adjunto`, `resolucion`, `bitacora_auditoria`), bloqueando nuevas asignaciones mediante trigger `tr_bloquear_nueva_asignacion_rol_historico` y excluyéndolo en runtime (`Fase B`).
   - **Tratamiento de cuentas sin alteración automática ni aproximaciones:** No se modifica automáticamente `sigd_auth.cuenta_usuario.activo` y **se prohíbe cualquier reasignación o conversión automática de roles**. En consecuencia:
     - `operador.demo` (`id_usuario = 00000000-0000-0000-0000-000000000030`) conserva continuidad operativa normal mediante su otro rol canónico vigente (`SECRETARIO` en `SEC`).
     - **`especialista.demo` (`id_usuario = 00000000-0000-0000-0000-000000000060`) y `trabajador.h2.test` (`id_usuario = f6905305-582a-4871-af75-c8b961d70a9e`)** quedan **operativamente bloqueadas sin autorización (`403 ACCOUNT_WITHOUT_ROLES` / `CONTEXT_REVOKED`, cero permisos efectivos)** hasta eventual asignación explícita de rol canónico vía administración normal.
     - `trabajador.h2.5079` (`id_usuario = 32a76ac3-31d4-40e0-9994-95a459ed5b01`) permanece `INACTIVA` (`422 ACTIVACION_SIN_ROLES`).
     - *(Para cualquier registro histórico secundario donde no exista coincidencia documental verificable con UUID completo, como las asignaciones de personal de prueba, se conserva el nombre de usuario como referencia y se comprobará la identidad técnica en el control de preejecución de Fase A, sin convertir esta verificación factual en una decisión de diseño abierta).*
3. **Matriz de Conciliación de las 4 Cuentas Históricas de `ESPECIALISTA` (8 Dimensiones de Verificación):**

| `login` | `id_usuario` | Rol histórico (`rol_id`) | `id_usuario_rol` | `id_asignacion` (Laboral) | Estado cuenta (`activo`) | Estado asignación | Decisión operativa |
|---|---|---|---|---|---|---|---|
| `operador.demo` | `00000000-0000-0000-0000-000000000030` | `ESPECIALISTA` (`94ae72fb-0b86-4a6f-ba78-69b19bc888e7`) | `ecb124c5-577d-4838-a3f0-5e343960b0e4` (`SEC`) *(y rol canónico `SECRETARIO` en `SEC` con `id_usuario_rol = 2957a90a-72fd-4263-a222-3e4d51301157`)* | Sin cargo formal vinculado en `sigd_org.asignacion_personal` según `INFORME_CONCILIACION_RBAC_TSK_1_0B.md:39` (control factual preejecución Fase A) | `ACTIVA` (`TRUE`, sin alteración) | `SECRETARIO`: VIGENTE.<br>`ESPECIALISTA`: descontinuado lógicamente en `22_`. | **CERRADA:** Conserva continuidad operativa ordinaria exclusivamente como `SECRETARIO` en `SEC`, preservando el 100% de autoría e historial. |
| `especialista.demo` | `00000000-0000-0000-0000-000000000060` | `ESPECIALISTA` (`94ae72fb-0b86-4a6f-ba78-69b19bc888e7`) | `cbd75b3a-62b5-43eb-9780-989116c04ec4` (`SEC`) | Sin cargo formal vinculado en `sigd_org.asignacion_personal` según `INFORME_CONCILIACION_RBAC_TSK_1_0B.md:39` (control factual preejecución Fase A) | `ACTIVA` (`TRUE`, no se modifica) | `ESPECIALISTA`: descontinuado lógicamente en `22_`. Otros roles: 0. | **CERRADA:** Sin reasignación automática ni conversión de rol; queda operativamente bloqueada (`403 ACCOUNT_WITHOUT_ROLES`) con 0 permisos efectivos hasta asignación explícita por administración normal. |
| `trabajador.h2.test` | `f6905305-582a-4871-af75-c8b961d70a9e` | `ESPECIALISTA` (`94ae72fb-0b86-4a6f-ba78-69b19bc888e7`) | 1) `bd029454-d24b-4a81-b497-a95c40ff562a` (`DG`, vencida 65 ms)<br>2) `fabad752-6a79-40f4-ad26-f9809b4498e2` (`MP`, en rango) | Cuenta sintética prueba H2; registro en `MP` con prefijo documental `18b17d04-...` (UUID completo a comprobar fácticamente en Paso 1 Fase A) | `ACTIVA` (`TRUE`, cuenta prueba H2) | `ESPECIALISTA`: descontinuado lógicamente en `22_`. Otros roles: 0. | **CERRADA:** Prohibida conversión automática en cuenta institucional y sin reasignación automática; permanece bloqueada (`403 ACCOUNT_WITHOUT_ROLES`) hasta gestión explícita de pruebas. |
| `trabajador.h2.5079` | `32a76ac3-31d4-40e0-9994-95a459ed5b01` | `ESPECIALISTA` (`94ae72fb-0b86-4a6f-ba78-69b19bc888e7`) | 1) `e3b2d13b-1d04-46f1-9e85-3ecd593bb8ff` (`DG`, vencida 39 ms)<br>2) `4bbd6ab4-5b53-4820-8f83-7e014bf62de4` (`MP`, en rango) | Cuenta sintética prueba H2; registro en `MP` con prefijo documental `a1d1b4b7-...` (UUID completo a comprobar fácticamente en Paso 1 Fase A) | `INACTIVA` (`FALSE`, no reactivar) | Cuenta y rol descontinuados; asignación DG expirada y MP bloqueada. | **CERRADA:** Conservar inactiva e intacta en historial; prohibida reactivación sin asignación previa de rol válido (`422 ACTIVACION_SIN_ROLES`). |

- **Aclaración documental indispensable:** El identificador `2957a90a-72fd-4263-a222-3e4d51301157` corresponde estrictamente a la fila `id_usuario_rol` de la asignación canónica vigente del rol `SECRETARIO` en el área `SEC` de la cuenta `operador.demo` (fuente documental: `INFORME_TSK_1_2_FASE0_PREIMPLEMENTACION.md:142`). No corresponde a un puesto laboral en `asignacion_personal` ni a un rol histórico.
   - **Justificación técnica:** Preserva el 100 % de integridad referencial y trazabilidad histórica, elimina ambigüedad en `rol_sistema`, impide reactivaciones silenciosas en el código actual (`auth.guard.ts:172`, `contexto.service.ts:62`) y evita crear privilegios no autorizados mediante automatismos.

### 1.2. Política Definitiva de Autorización y Asignación de `#32 EXPEDIENTE_DESCARGAR` (`CONFIRMADO` + `PROPUESTO`)
- **Ubicación en catálogo cerrado:** **`#32 EXPEDIENTE_DESCARGAR`** (UUID `5b010000-0000-4000-8000-000000000016`, `ambito = 'AREA'` *fail-closed* en `22_` + resolución contextual **C+D** en `Fase B`), creado con **CERO (`0`) asignaciones automáticas en `sigd_org.rol_permiso`** (`v_desc_asigs = 0`).
- **Matriz de Elegibilidad Institucional para `#32 EXPEDIENTE_DESCARGAR`:**

| Rol institucional | Elegibilidad para EXPEDIENTE_DESCARGAR | Condición / Régimen de Autorización |
|---|---|---|
| `ADMINISTRADOR` | **No** | Mantiene consulta y visualización previa institucional (`EXPEDIENTE_LEER`); sin descarga ordinaria (`403`). Ejecutor técnico, no autoridad autorizadora. |
| `DIRECTOR` | **Sí** | Con **autorización superior legalmente competente** mediante acto administrativo formal cuando sea el beneficiario. No puede auto-autorizarse. |
| `JEFE_UNIDAD_ACADEMICA` | **Sí** | Con autorización institucional del `DIRECTOR` y ejecución por `ADMINISTRADOR`. Ámbito subárbol `ltree`. |
| `COORDINADOR_AREA` | **Sí** | Con autorización institucional del `DIRECTOR` y ejecución por `ADMINISTRADOR`. Ámbito área activa / asignados. |
| `SECRETARIO` | **Sí** | Con autorización institucional del `DIRECTOR` y ejecución por `ADMINISTRADOR`. Ámbito procedimientos / `SEC`. |
| `MESA_PARTES` | **Sí** | Con autorización institucional del `DIRECTOR` y ejecución por `ADMINISTRADOR`. Ámbito ventanilla / recepción `MP`. |
| `DOCENTE` | **Sí** | Con autorización institucional del `DIRECTOR` y ejecución por `ADMINISTRADOR`. Solo evaluador formal o solicitante. |
| `TESORERO` | **Sí** | Con autorización institucional del `DIRECTOR` y ejecución por `ADMINISTRADOR`. Acotado estrictamente a dominio financiero (`TESORERIA_*`). |
| `ESTUDIANTE` | **No** | Descarga por **titularidad** (`e.solicitante_id = cu.id_persona`) y Casilla Electrónica. Usuario interno de la comunidad, no recibe `#32`. |
| `CIUDADANO` | **No** | Descarga por **titularidad** y Casilla Electrónica. Usuario externo a la institución, no recibe `#32`. |

- **Reglas complementarias de elegibilidad:**
  - `GESTOR_APOYO_AREA`: **Prohibido** recibir `#32` automáticamente o por capacidad (`tr_proteger_capacidad_permiso`).
  - `SUPER_ADMIN_PLATAFORMA`: No utiliza `#32` en el catálogo relacional; opera mediante control global SaaS independiente.
  - **Elegibilidad $\neq$ Permiso efectivo:** La inclusión en el catálogo de elegibles habilita la posibilidad de ser autorizado; ningún rol u operador adquiere descarga efectiva sin acto de autorización y registro técnico previo.
  - **Aislamiento institucional estricto:** La asignación ordinaria se realiza por rol dentro del ámbito institucional autorizado (`institucion_id`), impidiendo cualquier habilitación accidental en otras instituciones.

- **Modelo Definitivo de Autoridad (Separación Tripartita de Responsabilidades):**
  1. **`DIRECTOR` — Autoridad Institucional que Autoriza:**
     - Autoridad institucional competente que autoriza ordinariamente la habilitación de `#32` para roles elegibles de su propia institución.
     - Define roles beneficiarios, ámbito y contexto autorizado, y fija la justificación institucional obligatoria.
     - Solicita la modificación o revocación de la autorización y supervisa el uso del permiso en la institución.
     - **Prohibición absoluta de auto-autorización:** El `DIRECTOR` no puede autorizarse el permiso a sí mismo bajo ninguna circunstancia (`chk_auth_inst_no_auto_ejecutor` y trigger `tr_validar_autorizacion_rol_permiso_inst`).
     - **Régimen cuando `DIRECTOR` es el beneficiario:** Exige autorización previa de una **autoridad superior legalmente competente acreditada por acto administrativo formal** (`tipo_autoridad_otorgante = 'AUTORIDAD_SUPERIOR_ACREDITADA'`), registrando obligatoriamente los datos del acto (`acto_administrativo_numero`, `acto_administrativo_fecha`, `acto_administrativo_sustento` $\ge 15$ caracteres, cargo y entidad emisora). No se presupone que dicha autoridad superior a una entidad específica sin sustento legal, sino la entidad competente según la estructura y dependencia legal aplicable.
     - **No exigencia de cuenta SIGD para autoridad superior externa:** La autoridad superior que emite el acto administrativo externo **no requiere poseer una cuenta de usuario en el SIGD**; su identidad y competencia se registran en los campos de acreditación documental externa, mientras que el asentamiento técnico lo ejecuta el Administrador institucional (`ejecutor_tecnico_id`).
     - **Regla de delimitación competencial:** No atribuir esta competencia legal al `SUPER_ADMIN_PLATAFORMA` por el solo hecho de poseer privilegios tecnológicos globales.
  2. **`ADMINISTRADOR` — Ejecutor Técnico Institucional:**
     - Ejecuta técnicamente las asignaciones y revocaciones institucionales de `#32` tras verificar la existencia de una autorización válida.
     - Verifica identidad del autorizador, institución, contexto y elegibilidad del rol beneficiario, registrando la justificación.
     - Ejecuta asignación y revocación, consulta el historial de operaciones y garantiza el asentamiento de auditoría.
     - **Restricciones innegociables:**
       - No puede autorizar sus propias concesiones ni concederse el permiso a sí mismo.
       - No puede habilitar el permiso a `DIRECTOR` sin la autorización superior acreditada por acto administrativo.
       - No puede ampliar el alcance de una autorización ni modificarla para beneficiar a otros roles sin nueva aprobación formal.
       - No puede ejecutar asignaciones sin evidencia documental de autorización válida.
       - Mantiene su política de lectura institucional (`EXPEDIENTE_LEER`) y vista previa controlada; no recibe `#32` ordinariamente.
  3. **`SUPER_ADMIN_PLATAFORMA` — Control Global Total SaaS:**
     - Máxima autoridad administrativa y técnica de la plataforma SaaS, con control global del sistema y de todas las instituciones registradas.
     - Puede realizar directamente asignaciones, modificaciones y revocaciones globales de `#32` sin depender de la intervención del `DIRECTOR`.
     - Puede consultar todos los expedientes, visualizar y descargar documentos de cualquier institución vía streaming backend.
     - Administra instituciones, cuentas, usuarios, roles de plataforma, políticas de seguridad, sesiones, respaldos e infraestructura lógica.
     - **Controles obligatorios sobre operaciones de `#32`:** Identificación del actor privilegiado (`super_admin_id`), registro de institución (`institucion_id`), rol, contexto y alcance, motivo obligatorio, autenticación MFA verificada, registro inmutable en `sigd_audit.bitacora_superadmin_saas`, captura de estado anterior y posterior (`datos_antes`, `datos_despues`), y reconstrucción cronológica completa.
     - **Conciliación de identificadores de actor:**
       - `super_admin_id`: UUID del operador de plataforma SaaS (autenticado en capa SaaS, sin cuenta en `sigd_auth.cuenta_usuario`).
       - `autoridad_otorgante_id`: UUID del `DIRECTOR` institucional interno (NULL si es autoridad superior externa o superadmin).
       - `ejecutor_tecnico_id`: UUID del `ADMINISTRADOR` institucional (NULL si la operación fue ejecutada directamente por el superadmin SaaS).
     - **Aislamiento multi-tenant preservado:** Toda intervención del superadministrador sobre `#32` se realiza delimitada por institución en `sigd_org.autorizacion_rol_permiso_institucional (institucion_id, ...)`, prohibiendo la creación de permisos comodín (*wildcards*) que habiliten descargas transversales fuera de la institución objetivo.
     - **Límites innegociables:** Su autoridad tecnológica global **no lo convierte en autoridad legal institucional**: tiene **prohibido aprobar expedientes y firmar resoluciones institucionales**. No se crea ningún rol #11 superior.

- **Comprobación Técnica del Modelo de Asignación y Resolución de la Brecha en `sigd_org.rol_permiso`:**
  - **Identificación formal de la brecha:** La tabla canónica `sigd_org.rol_permiso (rol_id, permiso_id)` es una tabla de cruce binario simple diseñada para el catálogo general RBAC. Carece de: (1) `institucion_id`, (2) `usuario_beneficiario_id`, (3) `autoridad_otorgante_id`, (4) `ejecutor_tecnico_id`, (5) `tipo_autoridad_otorgante`, (6) metadatos de acreditación de autoridad superior externa, (7) `es_superadmin_saas`, (8) `justificacion`, (9) `vigente_desde` / `vigente_hasta`, (10) `activo`, y (11) metadatos de revocación. Si se asignara `#32` en `sigd_org.rol_permiso` a nivel global, se habilitaría el permiso a todas las instituciones de la plataforma SaaS de forma colectiva e indiscriminada, rompiendo el principio de mínimo privilegio y el aislamiento multi-tenant.
  - **Diferenciación y Coexistencia de Mecanismos de Descarga (#32):**
    1. *Mecanismo Ordinario Individual (`sigd_org.autorizacion_rol_permiso_institucional`):* Asignación nominativa e individualizada del permiso `#32 EXPEDIENTE_DESCARGAR` a un usuario institucional específico de uno de los 7 roles elegibles (`usuario_beneficiario_id`), con delimitación institucional, acto administrativo, temporalidad y auditoría. Satisface los 18 requisitos institucionales.
    2. *Mecanismo Extraordinario por Expediente (`sigd_org.autorizacion_descarga_excepcional`):* Habilitación temporal ad-hoc circunscrita a un único expediente (`expediente_id`) y documentos permitidos, con ventana $\le 15$ minutos para funcionarios sin habilitación ordinaria de `#32`.
  - **Estructura complementaria de gobierno institucional (`sigd_org.autorizacion_rol_permiso_institucional` en `23_`):**
    - Se diseña la tabla complementaria [`sigd_org.autorizacion_rol_permiso_institucional`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql#L1066-L1195) que relaciona formalmente: `institucion_id`, `usuario_beneficiario_id` (FK a `cuenta_usuario`), `rol_id`, `permiso_id`, `ambito_autorizado`, `contexto_autorizado_id` (FK a `sigd_org.area`), `tipo_autoridad_otorgante`, `autoridad_otorgante_id` (FK a `cuenta_usuario`), acreditación externa (`autoridad_superior_nombre`, `cargo`, `entidad`, `acto_administrativo_tipo`, `numero`, `fecha`, `archivo_id`, `sustento`), `ejecutor_tecnico_id` (FK a `cuenta_usuario`), `es_superadmin_saas`, `super_admin_id`, `justificacion`, `vigente_desde`, `vigente_hasta`, `activo`, `revocado_en`, `revocado_por`, `super_admin_revocador_id` y `motivo_revocacion`.
    - **Cumplimiento de los 18 Requisitos Institucionales Obligatorios:**
      1. *Identificador único:* `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
      2. *Institución beneficiaria:* `institucion_id UUID NOT NULL` (tenant Suiza).
      3. *Usuario beneficiario individual:* `usuario_beneficiario_id UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT` (obligatorio para `#32`).
      4. *Ámbito/área delimitado:* `contexto_autorizado_id UUID REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT` (NULL para alcance global institucional).
      5. *Permiso específico:* `permiso_id UUID NOT NULL REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE RESTRICT` (`#32 EXPEDIENTE_DESCARGAR`).
      6. *Director institucional autorizante:* `autoridad_otorgante_id UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario)` o datos de órgano jerárquico superior competente acreditado.
      7. *Administrador técnico ejecutor:* `ejecutor_tecnico_id UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario)`.
      8. *Acto administrativo de sustento:* Tipo, número, fecha, archivo adjunto y sustento normativo.
      9. *Justificación motivada:* `justificacion TEXT NOT NULL` ($\ge 15$ caracteres).
      10. *Fecha formal de autorización:* `autorizado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`.
      11. *Fecha inicio de vigencia:* `vigente_desde TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`.
      12. *Fecha de vencimiento obligatoria:* `vigente_hasta TIMESTAMPTZ NOT NULL` (`vigente_hasta > vigente_desde`).
      13. *Estado activo:* `activo BOOLEAN NOT NULL DEFAULT TRUE`.
      14. *Revocación y motivo:* `revocado_en`, `revocado_por_id`, `motivo_revocacion`.
      15. *Auditoría inmutable:* Registro en bitácoras con las 13 dimensiones obligatorias.
      16. *Protección contra duplicados:* Índices únicos parciales por usuario, rol, permiso e institución.
      17. *Control de concurrencia y serialización:* Bloqueo consultivo transaccional de 64 bits (`pg_advisory_xact_lock`).
      18. *Verificación de vigencia en runtime:* Validación en cada streaming request (`activo = TRUE AND revocado_en IS NULL AND vigente_desde <= now() AND vigente_hasta > now()`).
    - **Integridad referencial multiinstitucional y estrategia SaaS:**
      - `institucion_id UUID NOT NULL`: En el entorno actual mono-institución (`sigd_jacobo_demo`), almacena el identificador institucional de IESTP «Suiza» sin clave foránea física hacia `sigd_saas.institucion`, dado que dicha tabla SaaS aún **no existe físicamente** en las migraciones `01` a `21`. La creación de la tabla `sigd_saas.institucion` y la correspondiente FK (`REFERENCES sigd_saas.institucion(id)`) constituyen una **propuesta futura para `24_+`**.
      - `sigd_org.area` actualmente **no posee la columna `institucion_id`** en `03_sigd_org.sql`; en `sigd_jacobo_demo` todas las áreas pertenecen a IESTP «Suiza». La columna `contexto_autorizado_id UUID REFERENCES sigd_org.area(area_id)` referencia la clave primaria física existente de `area`. La incorporación de `institucion_id` a `sigd_org.area` y su validación cruzada multi-tenant forman parte de la evolución posterior `24_+`.
      - Claves foráneas estrictas hacia tablas existentes: `rol_sistema(rol_id)`, `permiso_sistema(permiso_id)`, `sigd_org.area(area_id)`, `cuenta_usuario(id_usuario)` (solo para actores internos que legítimamente poseen cuenta) y `documento_adjunto(documento_adjunto_id)`.
    - **Gobernanza de unicidad, concurrencia y serialización transaccional:**
      - `uq_auth_rol_permiso_activa_usr_ctx` (Índice parcial propuesto): Garantiza que no existan duplicados activos para el mismo usuario y rol dentro de un área/contexto específico (`contexto_autorizado_id IS NOT NULL`).
      - `uq_auth_rol_permiso_activa_usr_global` (Índice parcial propuesto): Garantiza unicidad para autorizaciones del usuario de alcance institucional global (`contexto_autorizado_id IS NULL`).
      - **Mecanismo de serialización concurrente de 64 bits con Llave Atómica (`institucion + usuario + rol + permiso`):** Los índices parciales por sí solos **no impiden** que dos transacciones simultáneas inserten concurrentemente una autorización global y otra específica bajo el nivel de aislamiento estándar `READ COMMITTED`. Para erradicar esta condición de carrera (*phantom inserts* cruzados), la función trigger propuesta `sigd_org.fn_validar_autorizacion_rol_permiso_institucional()` (definida con volatilidad `VOLATILE` para tomar un snapshot fresco por consulta) ejecuta un bloqueo consultivo transaccional atómico de 64 bits con llave unificada:
        `PERFORM pg_advisory_xact_lock(hashtextextended('auth_rol_permiso:' || NEW.institucion_id::text || ':' || COALESCE(NEW.usuario_beneficiario_id::text, '00000000-0000-0000-0000-000000000000') || ':' || NEW.rol_id::text || ':' || NEW.permiso_id::text, 0::bigint));`
        - *Momento de ejecución:* Se adquiere **antes** de cualquier consulta o evaluación de incompatibilidades.
        - *Operaciones cubiertas:* Cubre estrictamente operaciones de inserción (`INSERT`), modificación (`UPDATE`, tanto activaciones como revocaciones) y eliminación física (`DELETE`, bloqueada para preservar trazabilidad WORM con `ELIMINACION_FISICA_PROHIBIDA`).
        - *Protección de identidad inmutable:* En `UPDATE`, el trigger bloquea cualquier intento de mutar `institucion_id`, `usuario_beneficiario_id`, `rol_id` o `permiso_id` sobre una autorización existente (`IDENTIDAD_AUTORIZACION_INMUTABLE`), forzando a revocar y crear un nuevo registro.
        - *No-autoautorización y no-autoasignación:*
          - `CONSTRAINT chk_auth_inst_no_auto_director CHECK (tipo_autoridad_otorgante <> 'DIRECTOR' OR (usuario_beneficiario_id IS NULL OR autoridad_otorgante_id <> usuario_beneficiario_id))`: Ningún Director puede autoautorizarse. Si el Director es beneficiario, la habilitación debe emanar de un órgano jerárquico superior competente acreditado.
          - `CONSTRAINT chk_auth_inst_no_auto_ejecutor CHECK (ejecutor_tecnico_id IS NULL OR usuario_beneficiario_id IS NULL OR ejecutor_tecnico_id <> usuario_beneficiario_id)`: El Administrador técnico no puede asignarse a sí mismo la autorización.
        - *Traza de ejecución concurrente (Tx 1 vs. Tx 2):*
          1. **Tx 1** intenta registrar autorización global (`contexto_autorizado_id IS NULL`) para `(usuario, rol_id, permiso_id)`.
          2. Concurrente en paralelo, **Tx 2** intenta registrar autorización específica (`contexto_autorizado_id = Area_X`) para el mismo `(usuario, rol_id, permiso_id)`.
          3. **Paso 1:** Ambas transacciones invocan el trigger `BEFORE INSERT`. Tx 1 ejecuta primero `pg_advisory_xact_lock(...)` y adquiere el bloqueo consultivo exclusivo.
          4. **Paso 2:** Tx 2 ejecuta `pg_advisory_xact_lock(...)` con la misma llave y es puesta inmediatamente en espera (*WAITING*) por el gestor de bloqueos de PostgreSQL.
          5. **Paso 3:** Tx 1, en posesión del bloqueo, consulta si existen autorizaciones específicas activas para ese usuario. Al no haber ninguna, procede, inserta la fila global y ejecuta `COMMIT`.
          6. **Paso 4:** El `COMMIT` de Tx 1 libera automáticamente el advisory lock transaccional.
          7. **Paso 5:** Tx 2 se despierta y adquiere el bloqueo. Al estar declarada la función como `VOLATILE`, bajo `READ COMMITTED` su siguiente consulta `SELECT EXISTS` se ejecuta sobre un **snapshot fresco** posterior al commit de Tx 1.
          8. **Paso 6:** Tx 2 consulta si existe autorización global activa para ese usuario y detecta la fila recién confirmada por Tx 1.
          9. **Paso 7:** Tx 2 dispara la excepción `AUTORIZACION_INCOMPATIBLE: Ya existe una autorización global activa para este usuario...` (`ERRCODE 23514`) y aborta con rollback automático.
          - *Resultado:* Queda matemáticamente descartada cualquier ventana de inconsistencia o convivencia de autorizaciones incompatibles.
        - *Rigor técnico sobre colisiones de hash y duración de espera:* `hashtextextended` proyecta una cadena de texto a un entero con signo de 64 bits. Al tratarse de un espacio discreto finito ($2^{64} \approx 1.84 \times 10^{19}$ valores), por el principio del palomar (*pigeonhole principle* / paradoja del cumpleaños) **no es posible afirmar que genere identificadores matemáticamente únicos ni que elimine todas las colisiones**. No obstante, una colisión de hash en este contexto únicamente induce **contención transitoria adicional de serialización** (un tiempo de espera determinado exclusivamente por la duración de la transacción concurrente previa, sin que pueda garantizarse una duración fija de espera); **en ningún caso compromete la integridad de los datos por sí misma**, ya que una vez adquirido el lock, las consultas SQL internas del trigger evalúan igualdad estricta sobre las columnas físicas reales (`WHERE usuario_beneficiario_id = NEW.usuario_beneficiario_id AND rol_id = NEW.rol_id AND permiso_id = NEW.permiso_id`).
        - *Dependencia del nivel de aislamiento y volatilidad:* El mecanismo depende estrictamente de que la función trigger sea declarada con volatilidad **`VOLATILE`** y de que la base de datos opere bajo el nivel de aislamiento estándar **`READ COMMITTED`**. Gracias a ello, al despertar de la espera del advisory lock, la sentencia `SELECT EXISTS` toma un **snapshot fresco** del motor relacional que observa las filas confirmadas (*committed*) por la transacción concurrente previa.
        - *Advertencia sobre validación en concurrencia real:* Se deja constancia explícita de que este mecanismo corresponde a un **diseño técnico propuesto en Fase A0 que aún no ha sido probado mediante concurrencia real en vivo** (su validación empírica bajo cargas concurrentes y condiciones de carrera simuladas está programada para la suite de integración de Fase D).
    - **Identidad, MFA y Separación entre Acceso Privilegiado y Concesión Institucional:**
      - **Acceso Privilegiado Propio de `SUPER_ADMIN_PLATAFORMA`:** El operador global de plataforma dispone de acceso directo vía streaming backend desde MinIO/S3 para fines estrictos de soporte técnico, fiscalización de infraestructura, monitoreo de incidentes y auditoría global en todas las instituciones. Este acceso privilegiado propio opera bajo autenticación SaaS independiente con MFA verificado en servidor y auditoría en `sigd_audit.bitacora_superadmin_saas`. **No requiere del permiso institucional #32 ni de autorización del Director institucional.**
      - **Concesión Institucional del Permiso #32 a Cuentas:** La facultad de acceso privilegiado propio de plataforma **NO confiere autorización institucional automática para conceder el permiso #32 a cualquier cuenta institucional**. Asignar `#32 EXPEDIENTE_DESCARGAR` a funcionarios internos es una decisión de gobierno institucional privativa del **`DIRECTOR`** (o Autoridad Superior acreditada), ejecutada técnicamente por el **`ADMINISTRADOR`**. Si `SUPER_ADMIN_PLATAFORMA` interviene en la base de datos sobre la tabla `sigd_org.autorizacion_rol_permiso_institucional`, lo hace en modalidad de contingencia técnica (`es_superadmin_saas = TRUE`), quedando sujeto a delimitar `institucion_id`, justificación y reglas de elegibilidad de roles, sin eludir los requisitos institucionales ni asumir competencias jurídicas directivas.
      - La tabla operativa propuesta `sigd_org.autorizacion_rol_permiso_institucional` **no posee ni inventa una columna `mfa_verificado`**; contiene `super_admin_id UUID` y `super_admin_revocador_id UUID`.
      - La verificación de MFA se produce estrictamente en el **servidor**, mediante una fuente de autenticación confiable (validación criptográfica del desafío TOTP / WebAuthn contra el almacén de credenciales del servidor). **Nunca se confía en un booleano enviado por el frontend**.
      - La tabla `sigd_audit.bitacora_superadmin_saas` es una **estructura propuesta en `23_`, todavía no implementada físicamente en PostgreSQL**.
      - Una restricción `CHECK (mfa_verificado = TRUE)` **no constituye por sí sola una prueba criptográfica de MFA**. Por ello, cuando se implemente la estructura, la evidencia que se persistirá comprende: identidad autenticada (`super_admin_id`, `usuario_plataforma`), método MFA empleado (`metodo_mfa`, p. ej. `'TOTP'`, `'WEBAUTHN'`, sin default estático), momento exacto de verificación (`mfa_verificado_en`), identificador de sesión privilegiada (`sesion_saas_id`) y referencia verificable del evento de autenticación en servidor (`mfa_evento_ref`).
      - Cada operación SaaS sobre `#32` se delimita obligatoriamente a nivel de la institución específica (`institucion_id`, prohibiendo asignaciones comodín).
    - **Acreditación de la Autoridad Superior del `DIRECTOR`:**
      - Procedimiento formal: El Administrador institucional es el **responsable técnico de verificar la autenticidad** del instrumento administrativo externo previo a cualquier registro.
      - El Administrador institucional es el **responsable de asentar el registro**, quedando consignado en `ejecutor_tecnico_id`.
      - Metadatos documentales: `autoridad_superior_nombre`, `autoridad_superior_cargo`, `autoridad_superior_entidad` (órgano jerárquico superior competente acreditado conforme al marco normativo aplicable), `acto_administrativo_tipo`, `acto_administrativo_numero`, `acto_administrativo_fecha`, `acto_administrativo_archivo_id` y `acto_administrativo_sustento` ($\ge 15$ caracteres).
      - **No se exige cuenta de usuario interna** a la autoridad superior externa (`autoridad_otorgante_id IS NULL`).
      - Se mantiene la estricta prohibición de auto-autorización del Director.
    - **Restricciones temporales técnicamente correctas (Vencimiento obligatorio de #32, sin `now()` en CHECK):** Se elimina el uso de funciones no inmutables en CHECK; la consistencia se rige por `chk_auth_inst_vigencia (vigente_hasta > vigente_desde)` con `vigente_hasta TIMESTAMPTZ NOT NULL` (vencimiento obligatorio para `#32 EXPEDIENTE_DESCARGAR`, cero asignaciones indefinidas) y `chk_auth_inst_revocacion (activo = TRUE OR revocado_en IS NOT NULL)`. La vigencia temporal es evaluada dinámicamente en tiempo de ejecución por el backend y las consultas transaccionales de streaming:
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
    - **Resolución en runtime (`Fase B`):** La validación de descarga en backend (`autorizarDescargaDocumento`) verifica la existencia de una autorización institucional activa y vigente en `sigd_org.autorizacion_rol_permiso_institucional` que coincida con `institucion_id` y el `rol_id` activo del usuario (`claims.ctx`), o una excepción individual en `sigd_org.autorizacion_descarga_excepcional`, o titularidad directa, garantizando fail-closed absoluto y cero fugas multi-tenant.

- **Modelo Obligatorio de Auditoría (Reconstrucción de 13 Dimensiones):**
  1. *Quién solicitó la habilitación:* Registrado en justificación / payload estructurado.
  2. *Quién autorizó institucionalmente:* `autoridad_otorgante_id` (Director) o metadatos de autoridad superior externa acreditada.
  3. *Quién ejecutó técnicamente:* `ejecutor_tecnico_id` (Administrador institucional) o `super_admin_id` (SaaS).
  4. *Si fue realizada por SUPER_ADMIN_PLATAFORMA:* `es_superadmin_saas = TRUE` + `super_admin_id` + evento en `bitacora_superadmin_saas`.
  5. *Institución beneficiaria:* `institucion_id`.
  6. *Rol beneficiario:* `rol_id`.
  7. *Permiso afectado:* `permiso_id` (`#32 EXPEDIENTE_DESCARGAR`).
  8. *Contexto y ámbito:* `ambito_autorizado` ('AREA', 'UNIDAD', 'GLOBAL_INSTITUCIONAL') + `contexto_autorizado_id`.
  9. *Justificación obligatoria:* `justificacion` ($\ge 15$ caracteres).
  10. *Fecha y hora:* `creado_en`, `actualizado_en` y timestamps en bitácoras.
  11. *Estado anterior:* `datos_antes` en payload JSONB de auditoría WORM.
  12. *Estado posterior:* `datos_despues` en payload JSONB de auditoría WORM.
  13. *Revocación:* `revocado_en`, `revocado_por`, `super_admin_revocador_id`, `motivo_revocacion`.
  - **Separación entre Registro Operativo y Bitácoras Append-Only:**
    - **Registro Operativo:** `sigd_org.autorizacion_rol_permiso_institucional` (diseñado / propuesto) actualiza su estado operativo (`activo = FALSE`, `revocado_en = now()`) para corte en las siguientes peticiones protegidas.
    - **Historial de las Tres (3) Bitácoras Oficiales (Cero Creación de una Cuarta Bitácora):**
      - `sigd_audit.bitacora_auditoria` (implementada en `01_`): Registra cambios DML forenses (`datos_antes`, `datos_despues`), conservando el historial inmutable de autorizaciones de `#32`.
      - `sigd_audit.bitacora_acceso_documental` (propuesta en `23_`): Registra consultas, visualizaciones, descargas, excepciones y denegaciones documentales.
      - `sigd_audit.bitacora_superadmin_saas` (propuesta en `23_`): Registra exclusivamente operaciones privilegiadas globales de `SUPER_ADMIN_PLATAFORMA`.
    - **Protección Real de las Bitácoras: Distinción entre Bloqueo de DELETE y Garantía WORM:**
      - **Error conceptual a evitar:** No debe confundirse bloquear sentencias `DELETE` con garantizar inmutabilidad WORM (*Write Once, Read Many*) absoluta.
      - **Evaluación de la Protección en Tres (3) Niveles Arquitectónicos:**
        1. *Capa Aplicativa (Backend):* Los controladores y repositorios backend únicamente invocan métodos de registro append-only (`INSERT`). No existen en la API ni en el código endpoints ni métodos para modificar (`UPDATE`), eliminar (`DELETE`) o vaciar (`TRUNCATE`) eventos de bitácora.
        2. *Capa PostgreSQL (Motor Relacional y DCL):*
           - Triggers `BEFORE UPDATE OR DELETE OR TRUNCATE`: Disparan excepciones con `ERRCODE 42501` (`fn_bitacora_*_inmutable`) impidiendo cualquier mutación DML ordinaria.
           - Separación estricta de privilegios de usuario: El usuario de conexión de la aplicación (`sigd_app`) únicamente recibe permisos `GRANT SELECT, INSERT`; se le revocan explícitamente `REVOKE UPDATE, DELETE, TRUNCATE` en las tres bitácoras. Esto asegura que aun si las credenciales de la aplicación fueran vulneradas, un atacante no puede modificar ni borrar registros históricos en PostgreSQL.
           - *Límites técnicos honestos de PostgreSQL (Por qué NO es WORM absoluto en BD):* El propietario de las tablas (`table owner`, p. ej. `sigd_admin`) y el superusuario del motor (`postgres`) conservan privilegios DDL inherentes sobre el catálogo: pueden ejecutar `ALTER TABLE ... DISABLE TRIGGER`, `DROP TABLE` o alterar columnas. Por tanto, las salvaguardas de PostgreSQL son **append-only para la aplicación y roles ordinarios**, pero **NO constituyen WORM absoluto frente a superusuarios del motor o accesos root al sistema operativo**.
        3. *Capa Externa (Inmutabilidad Forense WORM Real):*
           - La inmutabilidad física WORM probatoria frente a cualquier actor interno o administrador de infraestructura exige **replicación asíncrona continua (log shipping / CDC) hacia un almacenamiento físicamente inmutable externo** fuera del host de la base de datos (p. ej. almacenamiento S3/MinIO con *Object Lock* en modo *Compliance*, o repositorio SIEM inmutable independiente), donde ni el superusuario de PostgreSQL ni el administrador de infraestructura del host puedan reescribir ni truncar la evidencia histórica retrospectivamente.
- **Revocación Inmediata y Política B (Diferenciación de Tres Mecanismos):**
  1. *Revocación de autorización del permiso `#32`:* Se conmuta `activo = FALSE` y `revocado_en = clock_timestamp()`. El evaluador contextual en backend verifica el estado en PostgreSQL en cada solicitud `/download`, surtiendo **efecto inmediato en la siguiente petición HTTP protegida** sin depender de cachés obsoletas en memoria ni tokens prefirmados de larga duración. No se depende de Redis para conceder o verificar estas autorizaciones; la fuente de verdad es la base de datos relacional.
  2. *Invalidación de contexto activo:* En el código existente de `auth.guard.ts`, `claims.ctx` se evalúa mediante `obtenerAutorizacionCuenta`, uniendo `sigd_org.usuario_rol ur` con `ur.vigente_desde <= now() AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now()) AND ur.id_usuario_rol = $2::uuid`. Ante revocación de asignación de rol o contexto, la consulta retorna 0 roles y en Fase B se formaliza el rechazo explícito con `403 CONTEXT_REVOKED`, impidiendo que un JWT conserve privilegios obsoletos.
  3. *Desactivación de cuenta de usuario e invalidación de sesiones:* En el esquema físico existente (`02_sigd_auth.sql`), la tabla `sigd_auth.sesion_usuario` gobierna la vigencia de sesiones mediante la columna `revocado_en TIMESTAMPTZ NULL` (no existen columnas `activa`, `cerrada_en` ni `motivo_cierre` en el esquema actual). Al desactivar una cuenta (`cuenta_usuario.activo = FALSE`), la transacción ejecuta:
     `UPDATE sigd_auth.sesion_usuario SET revocado_en = clock_timestamp() WHERE id_usuario = $1 AND revocado_en IS NULL;`
     invalidando al instante todas las sesiones abiertas de dicho usuario. Toda petición posterior con tokens asociados a sesiones revocadas es rechazada con `401 UNAUTHORIZED` / `403 ACCOUNT_DISABLED`.
  *(Nota de rigor técnico: No se formulan promesas de latencias artificiales de "un milisegundo o cero segundos"; la garantía técnica se basa en que el backend actúa como PEP estricto sin entregar URLs prefirmadas expuestas de almacenamiento).*

### 1.3. Autorizaciones Excepcionales de Descarga, Modelo Lease & Heartbeat y Regla para `DIRECTOR` (`CONFIRMADO` + `PROPUESTO` en `23_`)
- **Regla operativa (`sigd_org.autorizacion_descarga_excepcional`):** Vigencia máxima inicial de **15 minutos** (`CHECK (vigente_hasta <= vigente_desde + INTERVAL '15 minutes')`), justificación obligatoria, verificación de identidad, contexto activo resuelto en base de datos (`ur.id_usuario_rol = claims.ctx`), revocabilidad inmediata en PostgreSQL, prohibición de auto-autorización (`CHECK (usuario_beneficiario_id <> autoridad_otorgante_id)`), y registro en bitácora del otorgamiento, reserva, descarga y revocación.
- **Mecanismo de Reserva Atómica con Lease & Heartbeat (`sigd_org.intento_descarga_excepcional`):**
  - Para erradicar colisiones donde dos peticiones concurrentes transmitan simultáneamente el mismo archivo antes de registrar el consumo, y proteger al mismo tiempo descargas prolongadas legítimas de archivos grandes, se formaliza la tabla `sigd_org.intento_descarga_excepcional` gobernada por una **máquina de estados canónica de exactamente cuatro (4) estados**: `RESERVADO`, `COMPLETADO`, `FALLIDO` y `RESULTADO_INCIERTO` (eliminando `LIBERADO` por duplicidad conceptual, siendo la liberación una consecuencia directa e inherente del estado `FALLIDO`).
  - **Fase 1 (Reserva Previa y Adquisición de Lease antes del primer byte):** Función `sigd_org.fn_reservar_descarga_excepcional(aut_id, doc_id, user_id)` con advisory lock de 64 bits y bloqueo pesimista. Valida que el documento no esté ya completado (`DOCUMENTO_YA_DESCARGADO`). Si existe algún intento previo en `RESULTADO_INCIERTO`, bloquea conservadoramente la reserva hasta reconciliación auditable. Si existe una reserva activa con lease vigente (`expiracion_lease > clock_timestamp()`), deniega por colisión concurrente (`55P03`).
    - **Tratamiento obligatorio de leases expirados:** Si el lease expiró sin renovación por heartbeat (`expiracion_lease <= clock_timestamp()`), **queda terminantemente PROHIBIDO marcarlo automáticamente como `FALLIDO`**. La ausencia de heartbeat NO demuestra que la transmisión HTTP haya concluido sin éxito. Por ende, transita obligatoriamente a **`RESULTADO_INCIERTO`** (NUNCA a `FALLIDO`), registrando `'EXPIRACION_LEASE_SIN_CONFIRMACION'` y **bloqueando cualquier nuevo intento** hasta que se ejecute la reconciliación auditable conservadora.
    - **Protección estricta del Token de Propietario:** Concede un token secreto de propietario (`token_propietario UUID`) y lease inicial de 30 segundos, que se maneja exclusivamente en memoria en el servidor; **NUNCA debe exponerse al navegador web del cliente ni registrarse en logs de acceso**.
  - **Fase 2 (Streaming y Renovación Continua por Heartbeat):** Transmisión de bytes MinIO $\rightarrow$ socket HTTP mediante Node.js (`Content-Disposition: attachment`). Durante el streaming, el backend ejecuta un heartbeat periódico cada 10-15 segundos invocando `fn_renovar_reserva_descarga_excepcional(intento_id, token_propietario, 30)`. Si la renovación falla, el backend **aborta de inmediato la transmisión** (`stream.destroy()` y `res.destroy()`) para evitar que el stream continúe sin lease válido.
  - **Fase 3 (Asentamiento Servidor tras evento `finish`):** Función `sigd_org.fn_finalizar_descarga_excepcional(intento_id, token_propietario, estado_final, resultado, motivo)`:
    - **Si `COMPLETADO`:** Solo ante `res.writableFinished === true`, anexa el documento a `documentos_descargados` y, si se completó el lote, revoca automáticamente la autorización (`CONSUMO_TOTAL_DOCUMENTOS`).
    - **Si `FALLIDO`:** Si la conexión se cerró prematuramente con evidencia fehaciente (`res.writableFinished === false`, fallo de socket), marca `FALLIDO`. La reserva concluye de forma inherente, permitiendo un nuevo intento dentro de los 15 minutos sin penalizar al usuario ni computar consumo.
    - **Si `RESULTADO_INCIERTO`:** Si el stream terminó en el servidor pero PostgreSQL no permite registrar el resultado final (caída transitoria de BD post-streaming), se conserva la reserva y se registra `RESULTADO_INCIERTO`. **No se libera la reserva para evitar segundas descargas**, bloqueando nuevos intentos hasta que una reconciliación auditable determine el desenlace.
  - **Consistencia HTTP y PostgreSQL:** La transmisión HTTP y la transacción PostgreSQL no constituyen una transacción distribuida 2PC única. El diseño garantiza: (1) exclusión mutua estricta, (2) consumo idempotente, (3) reintento seguro ante fallos comprobados (`FALLIDO`), y (4) bloqueo conservador ante estados inciertos (`RESULTADO_INCIERTO`).
  - **Tratamiento de eventos Node.js:** Se implementa control de idempotencia con guard `res.writableFinished` para evitar colisiones entre `finish` y `close`.
  - **Aclaración técnica sobre el evento `finish` y Certificación Formal:** El evento `finish` de `http.ServerResponse` certifica estrictamente que el servidor envió todos los bytes al socket TCP; no demuestra que el cliente o navegador haya guardado el archivo en su disco (la constancia fehaciente de recepción legal se rige por acuse formal).
    - **Declaración formal:** El modelo Lease & Heartbeat se certifica como:  
      **«Diseño técnico documentado, pendiente de implementación y pruebas funcionales y de concurrencia en las fases B y D»**.  
      No se atribuyen pruebas de ejecución física que no se realizaron en esta etapa documental.
- **Trazabilidad Completa y Eventos Auditables de Excepción:** Otorgamiento de autorización, reserva previa exclusiva con lease, renovación por heartbeat, descarga autorizada completada (o fallida liberada / resultado incierto) y revocación inmediata, asentados inmutablemente en `sigd_audit.bitacora_acceso_documental`.
- **Autoridad otorgante:**
  - `DIRECTOR` autoriza descargas excepcionales a terceros; prohibida su auto-autorización.
  - **Cuando `DIRECTOR` sea el beneficiario:** Autorización exclusiva de una **autoridad superior legalmente competente acreditada por acto administrativo formal** (`tipo_autoridad_otorgante = 'AUTORIDAD_SUPERIOR_ACREDITADA'`), sin crear un rol #11.
  - `ADMINISTRADOR` conserva únicamente consulta y vista previa inline (`EXPEDIENTE_LEER`); toda descarga excepcional requiere concesión de tercero competente y reserva atómica con lease.

### 1.4. Estrategia Definitiva de `EXPEDIENTE_RESOLVER` en 4 Etapas (`CONFIRMADO` + `PROPUESTO`)
- **Hecho verificado en `sigd_jacobo_demo`:** Hoy `EXPEDIENTE_RESOLVER` (`797a084e-6c20-491d-83bf-e5c9fddaa6ab`) existe en `sigd_org.rol_permiso` únicamente en `ADMINISTRADOR`, `DIRECTOR`, `SECRETARIO` y `ESPECIALISTA` (`INFORME_TSK_1_2_FASE0_PREIMPLEMENTACION.md:170-173`).
- **4 Etapas cerradas:**
  1. **Etapa 1 — Compatibilidad en `22_` (`Fase A`):** Preservar su UUID y mantenerlo vigente en transición únicamente sobre **`DIRECTOR`** y **`SECRETARIO`** (y en la traza histórica inactiva de `ESPECIALISTA`), **retirándolo únicamente de `ADMINISTRADOR`** (junto a `FIRMA_FIRMAR`).
  2. **Etapa 2 — Prohibir nuevas asignaciones (`22_` + `Fase B`):** Cero asignaciones a roles nuevos (`JEFE_UNIDAD_ACADEMICA`, `COORDINADOR_AREA`, `DOCENTE`, `ESTUDIANTE`) ni capacidades; bloqueo permanente mediante trigger **`tr_bloquear_nueva_asignacion_permiso_legado`** en `sigd_org.rol_permiso` (`ERRCODE 23514`).
  3. **Etapa 3 — Sustitución completa (`Fase B` y `Fase C`):** Reemplazar toda dependencia en backend, guards, servicios, frontend y tests por permisos atómicos (`EXPEDIENTE_RECEPCIONAR`, `EXPEDIENTE_OBSERVAR`, `EXPEDIENTE_SUBSANAR`, `EXPEDIENTE_EVALUAR`, `EXPEDIENTE_APROBAR`, `EXPEDIENTE_RECHAZAR`, `EXPEDIENTE_CERRAR`, `EXPEDIENTE_ARCHIVAR`, `EXPEDIENTE_ADJUNTAR`, `RESOLUCION_EMITIR`, `DOCUMENTO_EDITAR`).
  4. **Etapa 4 — Retiro lógico verificable (`Fase D` -> `24_+`):** Ejecutar `UPDATE sigd_org.permiso_sistema SET vigente = FALSE WHERE codigo = 'EXPEDIENTE_RESOLVER'` y cerrar sus filas residuales en `rol_permiso` mediante migración compensatoria `24_+` **únicamente cuando la auditoría estática y pruebas confirmen cero (`0`) dependencias activas** (prohibido borrar el UUID histórico o sus trazas WORM).

### 1.5. Política de `SUPER_ADMIN_PLATAFORMA` y Alcance Técnico de Migración `23_` vs. `24_+` (`CONFIRMADO` + `PROPUESTO`)
- **Identidad y facultades:** Acceso global multi-institución, consulta de expedientes, visualización y descarga de documentos vía streaming backend, administración global de plataforma SaaS, MFA obligatorio, revocación inmediata (Política B) y auditoría separada en `sigd_audit.bitacora_superadmin_saas`; **tiene prohibido aprobar expedientes o firmar resoluciones institucionales**.
- **Arquitectura en BD única:** El dominio SaaS (`sigd_saas`) se proyecta **dentro de `sigd_jacobo_demo`** (prohibida una segunda BD).
- **Desacoplamiento cerrado en `23_`:** La migración `23_` crea `sigd_audit.bitacora_acceso_documental`, `sigd_audit.bitacora_superadmin_saas` y `sigd_org.autorizacion_descarga_excepcional` con **CERO dependencias o FKs obligatorias hacia tablas inexistentes de `sigd_saas.*`**: `bitacora_superadmin_saas` registra `super_admin_id UUID NOT NULL`, `sesion_saas_id UUID`, `institucion_id UUID` y atributos escalares validados por backend, dejando la creación física de `sigd_saas.*` y sus FKs para migraciones controladas posteriores (`24_+`).
- **Conciliación definitiva de las Bitácoras y Responsabilidades:**
  1. **`sigd_audit.bitacora_auditoria` (`01_sigd_audit.sql` existente):** Bitácora forense inmutable WORM de cambios DML a nivel de tablas del sistema (`datos_antes`, `datos_despues`, `correlation_id`).
  2. **`sigd_audit.bitacora_acceso_documental` (`23_` propuesto):** Auditoría documental institucional de eventos de acceso y excepciones (`CONSULTA_BANDEJA`, `CONSULTA_EXPEDIENTE`, `VISUALIZACION_DOCUMENTO`, `DESCARGA_AUTORIZADA`, `DESCARGA_DENEGADA`, `INTENTO_ACCESO_DIRECTO_MINIO`, `ACCESO_EXCEPCIONAL`, `OTORGAMIENTO_EXCEPCION`, `REVOCACION_EXCEPCION`).
  3. **`sigd_audit.bitacora_superadmin_saas` (`23_` propuesto):** Auditoría independiente privilegiada de plataforma para operaciones globales multi-institución de `SUPER_ADMIN_PLATAFORMA`.
  4. **Aclaración terminológica:** Toda mención a `sigd_audit.bitacora_eventos` corresponde a una denominación residual preliminar descartada; el objeto técnico definido en diseño es `sigd_audit.bitacora_acceso_documental`. Prohibido inventar tablas adicionales.

### 1.6. Modelo Único Unificado de Encargaturas y Facultades (`CONFIRMADO` + `PROPUESTO` en `22_` Bloque `7B`)
- **Cero duplicidad de modelos:** Se reutilizan y articulan exactamente tres piezas dentro de `sigd_org`:
  1. **`sigd_org.facultad_despacho` (`03_sigd_org.sql`):** catálogo/registro institucional vigente de facultades de despacho ordinarias (reutilizado sin duplicar).
  2. **`sigd_org.encargatura_despacho` (`03_` + ampliación retroactiva compatible en `22_`):** registro canónico de designación temporal (titular, encargado, autoridad designante, documento sustentatorio, contexto/área e institución, `inicio`, `fin`, `revocado_en`, `tipos_documento_permitidos` obligatorio en DTO `Fase B` sobre `tipo_resolucion` heredada).
  3. **`sigd_org.encargatura_permiso` (`22_` Bloque `7B`):** tabla explícita de facultades atómicas delegadas por encargatura (con trigger whitelist `tr_proteger_encargatura_permiso` que separa `FIRMA_FIRMAR` y `RESOLUCION_FIRMAR`); **nunca hereda automáticamente todos los permisos del titular** y **deja de autorizar al instante** al expirar `fin <= now()` o marcarse revocación/inactivación (`firma.routes.ts` y `auth.guard.ts` en `Fase B`).

---

## 2. MATRICES DE ROLES, PERMISOS, DESCARGAS, SAAS, ENCARGATURAS Y `EXPEDIENTE_RESOLVER`

| Dimensión | Resumen Cerrado en A0 | Documento Fuente Detallado |
|---|---|---|
| **10 Roles y Responsabilidades** | 9 roles internos + 1 externo (`ESTUDIANTE` usuario interno de la comunidad institucional, `CIUDADANO` externo a la institución; no clasificar ambos como externos); `ESPECIALISTA` `vigente = FALSE` en `22_` preservando 6 filas/4 cuentas y UUID oficiales sin aproximaciones; `ADMINISTRADOR` consulta documental acotada a su propia institución (`EXPEDIENTE_LEER` institucional) + vista previa inline, sin acceso cruzado a otras instituciones, cero mutación/descarga ordinaria. | [TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md) |
| **32 Permisos + `#32`** | `16` reales preservados + `16` atómicos incluyendo `#32 EXPEDIENTE_DESCARGAR` (`ambito = 'AREA'`, `0` auto-grants en `22_`); `ADMINISTRADOR` pierde exclusivamente `FIRMA_FIRMAR` y `EXPEDIENTE_RESOLVER`. | [TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql) |
| **Descargas, MinIO y Política B** | Streaming backend obligatorio en `/visualizar` y `/download` (sin URL prefirmada S3 a clientes internos o `SUPER_ADMIN_PLATAFORMA`; TTL 30–60 s descartado; bytes transmitidos no recuperables); excepciones `<= 15 min` con autoridad superior para `DIRECTOR`. | [TSK_1_2_A0_REVISION_TECNICA_FINAL.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_REVISION_TECNICA_FINAL.md) |
| **`SUPER_ADMIN_PLATAFORMA` y SaaS** | Dominio independiente en `sigd_jacobo_demo` (`sigd_saas.*` en `24_+`); acceso/descarga global + MFA + `sigd_audit.bitacora_superadmin_saas` (en `23_` sin FKs a `sigd_saas.*`); prohibido aprobar/firmar expedientes. | [TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md) |
| **Encargaturas, Capacidades, Asignaciones y Cierre** | `facultad_despacho` + `encargatura_despacho` + `encargatura_permiso`; `GESTOR_APOYO_AREA` sin `#32` ni firma/cierre; `expediente_responsable`/`custodia`/`evaluador`; FSM `ATENDIDO -> CERRADO -> ARCHIVADO` y WORM. | [TSK_1_2_A0_MODELO_CAPACIDADES_OPERATIVAS.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_MODELO_CAPACIDADES_OPERATIVAS.md), [TSK_1_2_A0_MODELO_ASIGNACION_EXPEDIENTES.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_MODELO_ASIGNACION_EXPEDIENTES.md), [TSK_1_2_A0_MODELO_CIERRE_ADMINISTRATIVO_EXPEDIENTES.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_MODELO_CIERRE_ADMINISTRATIVO_EXPEDIENTES.md) |
| **`EXPEDIENTE_RESOLVER` (4 Etapas)** | (1) Compatibilidad en `22_` solo `DIRECTOR`/`SECRETARIO` (+ hist. `ESPECIALISTA`), (2) `tr_bloquear_nueva_asignacion_permiso_legado`, (3) Sustitución `Fase B/C`, (4) Retiro `vigente = FALSE` en `24_+` tras `0` deps. | [TSK_1_2_A0_REVISION_TECNICA_FINAL.md §7.2](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_REVISION_TECNICA_FINAL.md#L293-L323) |

---

## 3. RECONCILIACIÓN `22_` VS. `23_`, ROLLBACK Y RESTAURACIÓN CONTROLADA

- **Secuencia transaccional en `sigd_jacobo_demo`:** `01..21` (actual) -> **`22_`** (RBAC 10 roles, desactivación lógica `ESPECIALISTA`, 32 permisos incl. `#32` con 0 auto-grants, triggers anti-rol-histórico y anti-permiso-legado, capacidades, asignaciones, cierre, Bloque `7B` encargaturas) -> **`23_`** (`bitacora_acceso_documental` WORM, `autorizacion_descarga_excepcional <= 15 min` con `chk_desc_excep_sup_acto`, `autorizacion_rol_permiso_institucional` con separación tripartita de autoridad, y `bitacora_superadmin_saas` sin FKs a `sigd_saas.*`) -> **`Fase B/C/D`** -> **`24_+`** (`sigd_saas.*` y Etapa 4 de `EXPEDIENTE_RESOLVER`). Ver [TSK_1_2_A0_PLAN_MIGRACION_POSTGRESQL.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_PLAN_MIGRACION_POSTGRESQL.md).
- **Coherencia de Rollback y Restauración Controlada:** Reversión técnica previa a operación (`0 filas`) en orden estricto **`23_ -> 22_`** (sin borrar historial de `ESPECIALISTA`, sin restaurar `FIRMA_FIRMAR`/`EXPEDIENTE_RESOLVER` en `ADMINISTRADOR`, y limpiando triggers temporales solo en retorno a `21_`); con operación iniciada (`> 0 filas` o eventos WORM) **prohibido `DROP TABLE`/`TRUNCATE`/`DELETE`**, aplicando únicamente inactivación lógica y migración compensatoria `24_+`; toda restauración física `pg_restore` requiere protocolo de 7 pasos y autorización expresa. Ver [TSK_1_2_A0_PLAN_ROLLBACK.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_PLAN_ROLLBACK.md).

---

## 4. CONTROLES TÉCNICOS OBLIGATORIOS DE PREEJECUCIÓN (`NO EJECUTADOS EN A0`)

Estos puntos **NO constituyen decisiones de diseño pendientes**, sino verificaciones factuales obligatorias en solo lectura al iniciar **Paso 1 de `Fase A`** antes de ejecutar `22_`:
1. **`SELECT` vivo en `sigd_jacobo_demo`** sobre `operador.demo`, `especialista.demo`, `trabajador.h2.test`, `trabajador.h2.5079`, sesiones activas en `sigd_auth.sesion_usuario` y asignaciones posteriores al corte `2026-11-12`.
2. **`SELECT` de línea base:** confirmar `21_sigd_auth_actualizacion_ubigeo_2026.sql` como máxima aplicada en `public.sigd_migraciones` y conteos de `rol_sistema`/`permiso_sistema`/`rol_permiso`.
3. **`SELECT` estructural vivo:** inspeccionar jerarquía real `sigd_org.area.path` (`ltree`) y filas actuales de `sigd_org.encargatura_despacho` / `facultad_despacho`.
4. **Verificación del respaldo pre-TSK-1.2:** validar existencia, catálogo `pg_restore --list` y SHA-256 `1A8B845A53E7C2EA609EC989B8508D300392992E2C07B221429A1C98C9ED2BCC` de `sigd_jacobo_demo_pre_tsk12_2026-11-12T17-29-27.dump`.

---

## 5. DOCUMENTACIÓN OFICIAL CONSOLIDADA EN FASE A0 (ONCE [11] DOCUMENTOS DE DISEÑO)

1. [INFORME_TSK_1_2_A0_DISENO_DEFINITIVO.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/INFORME_TSK_1_2_A0_DISENO_DEFINITIVO.md) *(Documento Maestro Único de Cierre A0)*
2. [TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_CONCILIACION_FINAL_ROLES_PERMISOS.md)
3. [TSK_1_2_A0_REVISION_TECNICA_FINAL.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_REVISION_TECNICA_FINAL.md)
4. [TSK_1_2_A0_MATRIZ_CIERRE_CONTROLES_PREIMPLEMENTACION.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_MATRIZ_CIERRE_CONTROLES_PREIMPLEMENTACION.md)
5. [TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_POLITICA_SUPER_ADMIN_PLATAFORMA_SAAS.md)
6. [TSK_1_2_A0_MODELO_CAPACIDADES_OPERATIVAS.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_MODELO_CAPACIDADES_OPERATIVAS.md)
7. [TSK_1_2_A0_MODELO_ASIGNACION_EXPEDIENTES.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_MODELO_ASIGNACION_EXPEDIENTES.md)
8. [TSK_1_2_A0_MODELO_CIERRE_ADMINISTRATIVO_EXPEDIENTES.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_MODELO_CIERRE_ADMINISTRATIVO_EXPEDIENTES.md)
9. [TSK_1_2_A0_PLAN_MIGRACION_POSTGRESQL.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_PLAN_MIGRACION_POSTGRESQL.md)
10. [TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_SQL_PROPUESTO_NO_EJECUTADO.sql) *(`NO EJECUTADO — DOCUMENTO DE DISEÑO`)*
11. [TSK_1_2_A0_PLAN_ROLLBACK.md](file:///c:/Users/Liz/Desktop/SIGD/SIGD/docs/TSK_1_2_A0_PLAN_ROLLBACK.md)

---

## 6. EVALUACIÓN Y CERTIFICACIÓN FORMAL DE LOS DOCE (12) CRITERIOS

Conforme a las reglas de certificación técnica estricta, cada criterio se clasifica utilizando exclusivamente las tres categorías formales autorizadas (**`CUMPLIDO EN DISEÑO`**, **`VERIFICADO EN CÓDIGO O MIGRACIONES EXISTENTES`** o **`PENDIENTE DE IMPLEMENTACIÓN`**), diferenciando la certificación documental de la certificación funcional:

| # | Criterio de Certificación | Clasificación Formal de Estado | Detalle y Sustento Técnico Honesto |
|---|---|---|---|
| **1** | Catálogo Canónico de 10 Roles | **CUMPLIDO EN DISEÑO**<br>*(Físicamente: PENDIENTE DE IMPLEMENTACIÓN)* | Los diez roles institucionales están formalmente definidos y cerrados en diseño. La inserción de los 4 roles faltantes y actualización de `chk_rol_codigo` en `sigd_org.rol_sistema` está **PENDIENTE DE IMPLEMENTACIÓN** en la migración física `22_` (aún no ejecutada). |
| **2** | Identidad de `SUPER_ADMIN_PLATAFORMA` | **CUMPLIDO EN DISEÑO**<br>*(Físicamente: PENDIENTE DE IMPLEMENTACIÓN)* | Delimitado en diseño como operador global SaaS independiente fuera de `sigd_org.rol_sistema` (no es rol #11). La creación del esquema `sigd_saas`, sesiones y cuentas está **PENDIENTE DE IMPLEMENTACIÓN** para la evolución `24_+`. |
| **3** | Tres Bitácoras Oficiales Conciliadas | **VERIFICADO EN CÓDIGO O MIGRACIONES EXISTENTES** *(bitacora_auditoria)*<br>**CUMPLIDO EN DISEÑO** *(bitacora_acceso_documental y bitacora_superadmin_saas)* | `sigd_audit.bitacora_auditoria` está **VERIFICADO EN CÓDIGO O MIGRACIONES EXISTENTES** (`01_sigd_audit.sql`). Las estructuras `bitacora_acceso_documental` y `bitacora_superadmin_saas` están **CUMPLIDO EN DISEÑO** y su creación física está **PENDIENTE DE IMPLEMENTACIÓN** en `23_`. Cero bitácoras adicionales. |
| **4** | Permiso #32 con Separación de Responsabilidades | **CUMPLIDO EN DISEÑO**<br>*(Físicamente: PENDIENTE DE IMPLEMENTACIÓN)* | Modelo tripartito cerrado (Director autoriza institucionalmente, Administrador ejecuta técnicamente, SuperAdmin acceso privilegiado propio y administración global SaaS; separación expresa entre acceso propio y concesión institucional a cuentas). Creación física de #32 y tabla complementaria está **PENDIENTE DE IMPLEMENTACIÓN** en `22_` y `23_`. |
| **5** | `ADMINISTRADOR` con Acceso Global de Lectura y sin Descarga Ordinaria | **CUMPLIDO EN DISEÑO**<br>*(Físicamente: PENDIENTE DE IMPLEMENTACIÓN)* | Mantiene `EXPEDIENTE_LEER` en su institución con visualización inline controlada. Retiro físico de `FIRMA_FIRMAR` y `EXPEDIENTE_RESOLVER` en `sigd_org.rol_permiso` está **PENDIENTE DE IMPLEMENTACIÓN** en `22_`. Retiro de bypasses en backend/frontend está **PENDIENTE DE IMPLEMENTACIÓN** en Fases B y C. |
| **6** | `DIRECTOR` con Competencia Institucional Exclusiva | **CUMPLIDO EN DISEÑO**<br>*(Físicamente: PENDIENTE DE IMPLEMENTACIÓN)* | Firma digital indelegable de resoluciones directivas; prohibida auto-autorización de descarga ordinaria/excepcional. Los triggers y validaciones de runtime en backend están **PENDIENTE DE IMPLEMENTACIÓN** en Fases A y B. |
| **7** | `ESPECIALISTA` Descontinuado sin Pérdida Histórica | **CUMPLIDO EN DISEÑO**<br>*(Físicamente: PENDIENTE DE IMPLEMENTACIÓN)* | Descontinuación lógica en catálogo mediante el campo físico correcto `vigente = FALSE` en `sigd_org.rol_sistema`, preservando intactas las 6 filas en `usuario_rol` (4 cuentas) y bloqueando nuevas altas con trigger. La ejecución del `UPDATE` y la instalación del trigger están **PENDIENTE DE IMPLEMENTACIÓN** en `22_`. |
| **8** | MFA con Evidencia Confiable en Servidor | **CUMPLIDO EN DISEÑO**<br>*(Físicamente: PENDIENTE DE IMPLEMENTACIÓN)* | Validación criptográfica obligatoria en servidor (nunca booleano de cliente); sin default estático en `metodo_mfa`; campos de auditoría definidos en DDL propuesto. La creación física de la tabla `bitacora_superadmin_saas` y el servicio de autenticación MFA están **PENDIENTE DE IMPLEMENTACIÓN** en `23_` y Fase B. |
| **9** | Integridad Referencial y Concurrencia Transaccional | **CUMPLIDO EN DISEÑO**<br>*(Físicamente: PENDIENTE DE IMPLEMENTACIÓN)* | Diseñados dos índices únicos parciales, serialización de 64 bits con llave común unificada `(rol_id + permiso_id)` en trigger `VOLATILE` cubriendo `INSERT`, `UPDATE` (inmutabilidad de identidad) y `DELETE` (prohibición física WORM). La instalación del trigger en base de datos está **PENDIENTE DE IMPLEMENTACIÓN** en `23_`. |
| **10**| Sin Contradicciones Documentales | **CUMPLIDO EN DISEÑO** | Certificación documental completa: los 11 documentos rectores en `docs/` se encuentran 100 % conciliados, consistentes y libres de contradicciones normativas o técnicas. |
| **11**| Evidencia Git Verificada Honestamente | **VERIFICADO EN CÓDIGO O MIGRACIONES EXISTENTES** | Inspección fáctica del repositorio: rama `B_JACOBO`, reporte honesto de los 370 archivos modificados en el área de trabajo observados, advertencias preexistentes de CRLF y espacios al final de línea con código 1 en `git diff --check`, y verificación de integridad (UTF-8, 0 nulos) de los 11 documentos nuevos en `docs/`. Cero `git add` y cero `git commit`. |
| **12**| PostgreSQL, Backend y Frontend Intactos | **VERIFICADO EN CÓDIGO O MIGRACIONES EXISTENTES** *(Código/Archivos)*<br>**CUMPLIDO EN DISEÑO** *(Ausencia de mutaciones SQL)* | **CERO sentencias SQL ejecutadas y CERO conexiones al motor de base de datos durante esta intervención técnica (cero consultas, cero mutaciones)**. La base `sigd_jacobo_demo` permanece inalterada respecto al antecedente de la última verificación física previa realizada en Fase 0 (snapshot dump de `662,972 bytes` con migración física máxima `21_sigd_auth_actualizacion_ubigeo_2026.sql`). Cero líneas de código modificadas en `backend/src/` y `frontend/src/`. |

---

> [!CAUTION]
> **VEREDICTO FINAL:** **`FASE A0 — DISEÑO DEFINITIVO DOCUMENTALMENTE CERTIFICADO Y BLINDADO`**  
> Todas las decisiones de diseño de TSK-1.2 Fase A0 quedan definitivamente cerradas, conciliadas y documentadas sin contradicciones ni duplicidad. Se diferencian expresamente: **(1)** decisiones cerradas de diseño de Fase A0, **(2)** controles técnicos obligatorios de preejecución en Paso 1 de Fase A, y **(3)** implementación futura controlada (`Fase A -> Fase B -> Fase C -> Fase D` y `24_+`).  
> **PARADA OBLIGATORIA ANTES DE FASE A:** Cero cambios ejecutados en PostgreSQL (`sigd_jacobo_demo`), `backend/migraciones/`, `backend/src/`, `frontend/src/`, Docker, `.env` ni historial Git (`B_JACOBO`). Esperando autorización explícita de Dirección para iniciar Fase A.

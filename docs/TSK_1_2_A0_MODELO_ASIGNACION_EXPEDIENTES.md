# SIGD SUIZA — TSK-1.2 FASE A0
# MODELO DE ASIGNACIÓN, CUSTODIA Y EVALUACIÓN SOBRE EXPEDIENTES

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Rama Git exclusiva:** `B_JACOBO` | **Base oficial:** `sigd_jacobo_demo` (PostgreSQL 18.6)  
**Estado:** Diseño Técnico Definitivo (FASE A0) — **No ejecutado en BD**

---

## 1. HALLAZGO PREVIO QUE CORRIGE LA DOCUMENTACIÓN HISTÓRICA

Durante la auditoría física de `sigd_jacobo_demo` se verificó que **no existen** las tablas mencionadas en documentos previos (`TSK-1.0A` / `TSK-1.1`):
- `to_regclass('sigd_rut.expediente_evaluador')` = `null`
- `to_regclass('sigd_doc.expediente_asignacion')` = `null`

Asimismo, se verificó que los `189` registros de `sigd_doc.expediente` son un subconjunto exacto de los `197` registros de `sigd_tra.expediente`, compartiendo el mismo `expediente_id` (`UUID`), y que los `18` registros de `sigd_rut.estado_actual_expediente` apuntan sin huérfanos a `sigd_tra.expediente(expediente_id)`.

Por coherencia relacional con `RutaDoc` (`sigd_rut`) y con [`contexto.service.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/contexto.service.ts#L318), todas las nuevas estructuras de asignación, custodia y evaluación deben crearse bajo el esquema **`sigd_rut`** referenciando `sigd_tra.expediente(expediente_id)`.

---

## 2. SEPARACIÓN CONCEPTUAL DE LOS CINCO ACTORES SOBRE EL EXPEDIENTE

El modelo prohíbe colapsar en un único campo o tabla funciones administrativas jurídicas distintas:

| Concepto | Rol / Tabla en BD | Qué representa | Cómo cambia | Qué NO cambia automáticamente |
|---|---|---|---|---|
| **1. Custodio institucional** | `sigd_rut.expediente_custodia` | Unidad orgánica y servidor responsable de la guarda material y custodia documental del expediente físico/digital. | Mediante entrega de cargo / transferencia archivística formal o derivación con entrega física verificada. | No cambia al asignar un evaluador docente ni al reasignar un trámite interno dentro de la misma área. |
| **2. Responsable actual** | `sigd_rut.expediente_responsable` (`tipo_responsabilidad = 'RESPONSABLE_ACTUAL'`) | Servidor que actualmente tiene a cargo la tramitación ordinaria o gestión del expediente dentro de su área. | Por asignación del Coordinador / Jefe / Secretario o **reasignación con justificación obligatoria**. | La reasignación **no cambia el estado FSM** del expediente ni altera al custodio institucional. |
| **3. Responsable de la unidad** | `sigd_rut.expediente_responsable` (`tipo_responsabilidad = 'RESPONSABLE_UNIDAD'`) / `JEFE_UNIDAD_ACADEMICA` o `COORDINADOR_AREA` del área | Autoridad funcional supervisora de la unidad o área donde radica el expediente. | Por designación orgánica vigente en `sigd_org.usuario_rol` / asignación de supervisión. | No ejecuta evaluaciones docentes si no tiene asignación, ni reemplaza al Secretario Académico en cierres fuera de su competencia. |
| **4. Evaluador asignado** | `sigd_rut.expediente_evaluador` | Docente (o evaluador técnico) designado para emitir informe técnico/pedagógico sobre el expediente. | Por asignación explícita del Coordinador / Jefe / Secretario (`EXPEDIENTE_ASIGNAR` / `EXPEDIENTE_REASIGNAR`). | Un `DOCENTE` **no puede evaluar** sin registro activo en esta tabla, ni consultar expedientes de otros docentes del área. |
| **5. Usuario que ejecutó una actuación** | `sigd_rut.movimiento_tramite.usuario_operador_id` + `datos->>'usuarioActorUuid'` + `sigd_audit.bitacora_auditoria.usuario_id` | Actor histórico inmutable que ejecutó cada transición o actuación en fecha/hora exacta. | Registro append-only por evento (`RECEPCION`, `OBSERVACION`, `DERIVACION`, `CIERRE_ADMINISTRATIVO`, etc.). | No otorga responsabilidad permanente ni titularidad posterior sobre el expediente. |

---

## 3. DISEÑO RELACIONAL DE LAS ESTRUCTURAS NUEVAS

### 3.1. `sigd_rut.expediente_responsable` (Responsable actual y de unidad con historial)

Registra la cadena cronológica no destructiva de responsables de tramitación y unidad sobre cada expediente.

- **Columnas clave:**
  - `id_responsabilidad UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT`
  - `tipo_responsabilidad VARCHAR(32) NOT NULL CHECK (tipo_responsabilidad IN ('RESPONSABLE_ACTUAL', 'RESPONSABLE_UNIDAD'))`
  - `id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
  - `area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT`
  - `asignado_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
  - `es_reasignacion BOOLEAN NOT NULL DEFAULT FALSE`
  - `justificacion TEXT` (obligatorio cuando `es_reasignacion = TRUE`: `CHECK (NOT es_reasignacion OR length(btrim(COALESCE(justificacion, ''))) >= 10)`)
  - `asignacion_reemplazada_id UUID REFERENCES sigd_rut.expediente_responsable(id_responsabilidad) ON DELETE RESTRICT`
  - `activo BOOLEAN NOT NULL DEFAULT TRUE`
  - `asignado_en TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `confirmado_recepcion_en TIMESTAMPTZ` *(confirmación de recepción del responsable)*
  - `confirmado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
  - `desactivado_en TIMESTAMPTZ`
  - `desactivado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
  - `motivo_desactivacion TEXT`
- **Restricciones e índices críticos:**
  - Índice único parcial `uq_exp_responsable_activo` sobre `(expediente_id, tipo_responsabilidad) WHERE activo = TRUE` -> garantiza un único `RESPONSABLE_ACTUAL` activo y un único `RESPONSABLE_UNIDAD` activo por expediente, preservando todo el historial cuando `activo = FALSE`.
  - Check de coherencia temporal: `CHECK (activo = TRUE OR desactivado_en IS NOT NULL)`.

### 3.2. `sigd_rut.expediente_custodia` (Custodio institucional append-only)

Registra quién ostenta la custodia material/documental del expediente y cuándo se transfirió dicha custodia.

- **Columnas clave:**
  - `id_custodia UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT`
  - `area_custodia_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT`
  - `custodio_usuario_id UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
  - `ubicacion_fisica JSONB` *(opcional: `{ estante, balda, caja }` para etapa de archivo)*
  - `transferido_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
  - `motivo_custodia TEXT NOT NULL`
  - `activo BOOLEAN NOT NULL DEFAULT TRUE`
  - `desde TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `hasta TIMESTAMPTZ`
- **Restricción de unicidad:** Índice único parcial `uq_exp_custodia_activa` sobre `(expediente_id) WHERE activo = TRUE`.

### 3.3. `sigd_rut.expediente_evaluador` (Evaluación Docente y Prevención de Conflictos)

Registra formalmente a los evaluadores (`DOCENTE` u otro técnico habilitado) asignados a un expediente.

- **Columnas clave:**
  - `id_asignacion UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT`
  - `id_usuario_docente UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
  - `area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT`
  - `asignado_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
  - `motivo_asignacion TEXT NOT NULL`
  - `es_reasignacion BOOLEAN NOT NULL DEFAULT FALSE`
  - `justificacion_reasignacion TEXT`
  - `asignacion_anterior_id UUID REFERENCES sigd_rut.expediente_evaluador(id_asignacion) ON DELETE RESTRICT`
  - `activo BOOLEAN NOT NULL DEFAULT TRUE`
  - `asignado_en TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `confirmado_recepcion_en TIMESTAMPTZ`
  - `estado_evaluacion VARCHAR(32) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_evaluacion IN ('PENDIENTE', 'EN_EVALUACION', 'CONCLUIDA', 'REASIGNADA', 'REVOCADA'))`
  - `evaluacion_concluida_en TIMESTAMPTZ`
  - `resultado_evaluacion TEXT`
  - `desactivado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
  - `desactivado_en TIMESTAMPTZ`
  - `motivo_desasignacion TEXT`
  - `observaciones TEXT`
  - `evidencias JSONB NOT NULL DEFAULT '[]'::jsonb`

---

## 4. REGLAS TRANSACCIONALES E INCOMPATIBILIDADES (TRIGGERS + BACKEND)

1. **Prevención de conflicto de intereses (auto-evaluación / auto-asignación):**
   - Trigger `tr_expediente_evaluador_integridad` (`BEFORE INSERT OR UPDATE`) en `sigd_rut.expediente_evaluador`:
     - Verifica que la `persona` titular del expediente (`sigd_tra.expediente.solicitante_id`) **no coincida** con `cu.id_persona` de `id_usuario_docente` (un docente que tramita un expediente personal **jamás puede ser evaluador de su propio expediente**).
     - Verifica que la cuenta `id_usuario_docente` esté `activo = TRUE` y posea rol vigente compatible (`DOCENTE`, `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA` o `SECRETARIO`) — **rechaza categóricamente cuentas cuyo único rol sea `ESPECIALISTA`, `ESTUDIANTE` o `CIUDADANO`**.
2. **Justificación obligatoria en reasignación:**
   - Tanto en `expediente_responsable` como en `expediente_evaluador`, cuando `es_reasignacion = TRUE`, la BD exige `length(btrim(COALESCE(justificacion_reasignacion, ''))) >= 10`.
   - El servicio transaccional en backend ejecutará: `SELECT ... FOR UPDATE`, desactivará el registro anterior (`activo = FALSE`, `desactivado_en = now()`, `desactivado_por = actorId`), insertará el nuevo registro enlazado vía `asignacion_anterior_id` / `asignacion_reemplazada_id`, registrará auditoría WORM en `sigd_audit.bitacora_auditoria` y **no alterará** `estado_actual_expediente.estado_nuevo` ni `sigd_rut.expediente_custodia`.
3. **Regla estricta de acceso del `DOCENTE`:**
   - En `puedeVerExpediente`, `obtenerAlcanceBandeja` y el futuro endpoint `/evaluar`: cuando el contexto activo sea `DOCENTE`, la consulta SQL permite acceso únicamente si:
     - `e.solicitante_id = cu.id_persona` (sus propios trámites como administrado interno), **O**
     - `EXISTS (SELECT 1 FROM sigd_rut.expediente_evaluador ee WHERE ee.expediente_id = e.expediente_id AND ee.id_usuario_docente = cu.id_usuario AND ee.activo = TRUE)` (solo para consulta/evaluación del expediente asignado).
   - La evaluación (`POST /api/v1/expedientes/:id/evaluar`) exige además `ee.activo = TRUE` vigente en la transacción y jamás otorga permiso `EXPEDIENTE_CERRAR`.
4. **Regla estricta del `COORDINADOR_AREA`:**
   - Solo puede consultar, asignar o reasignar expedientes cuyo `area_actual_id` (en `estado_actual_expediente` o `area_destino_id` inicial) coincida con `claims.ctx -> usuario_rol.area_id` (o subárbol de unidad únicamente cuando su designación orgánica lo autorice expresamente).
5. **Regla estricta de lectura global del `ADMINISTRADOR` y acceso global `SUPER_ADMIN_PLATAFORMA` (Separación conceptual):**
   - **Separación de conceptos (`CONFIRMADO`):** No deben confundirse **elegibilidad**, **asignación del permiso (`rol_permiso`)**, **alcance efectivo**, **titularidad (`solicitante_id`)**, **custodia (`expediente_custodia`)** y **responsabilidad documental (`expediente_responsable`/`expediente_evaluador`)**. Tener acceso de lectura o descarga **no otorga** custodia material ni autoridad resolutiva/evaluadora sobre el expediente.
   - Cuando el contexto activo (`claims.ctx`) es **`ADMINISTRADOR`**, el usuario tiene **acceso global de lectura sobre todos los expedientes de su institución**, con independencia de unidad, programa de estudio, área, custodio, responsable actual, evaluador asignado o estado del trámite, **sin requerir asignación individual** en `sigd_rut.expediente_responsable`, `sigd_rut.expediente_custodia` ni `sigd_rut.expediente_evaluador`, y **sin descarga ordinaria**.
   - Cuando el actor es **`SUPER_ADMIN_PLATAFORMA`** (*Superadministrador de Plataforma*, dominio global SaaS independiente `sigd_saas` dentro de `sigd_jacobo_demo`, fuera del RBAC institucional), su consulta, visualización y descarga global multi-institución tampoco altera custodia, responsabilidad, estado ni autoridad legal, registrándose exclusivamente en la bitácora privilegiada SaaS (`sigd_audit.bitacora_superadmin_saas`).
   - **Prohibición absoluta de alteración:** La consulta global o visualización previa ejecutada por `ADMINISTRADOR` o por `SUPER_ADMIN_PLATAFORMA`:
     1. **No** modifica ni reasigna al custodio institucional (`expediente_custodia`), al responsable actual/unidad (`expediente_responsable`) ni al evaluador (`expediente_evaluador`).
     2. **No** cambia el `estado_nuevo` en `estado_actual_expediente` ni el `area_actual_id`.
     3. **No** genera filas falsas en `sigd_rut.movimiento_tramite` (todas las lecturas y previsualizaciones institucionales se registran en `bitacora_acceso_documental` y las de plataforma en `bitacora_superadmin_saas`, sin fingir actuaciones documentales).
     4. En cuentas institucionales multirrol (`ADMINISTRADOR` + `DOCENTE`/área), la lectura global **no** se hereda al conmutar de contexto activo (`claims.ctx`).

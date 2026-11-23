# SIGD SUIZA — TSK-1.2 FASE A0
# MODELO DE CIERRE ADMINISTRATIVO DE EXPEDIENTES (`EXPEDIENTE_CERRAR`) Y MATRIZ PROCEDIMENTAL

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Rama Git exclusiva:** `B_JACOBO` | **Base oficial:** `sigd_jacobo_demo` (PostgreSQL 18.6)  
**Estado:** Diseño Técnico Definitivo (FASE A0) — **No ejecutado en BD**

---

## 1. DISTINCIÓN NORMATIVA Y DE MÁQUINA DE ESTADOS (`sigd_rut`)

El examen de `sigd_jacobo_demo` confirmó que actualmente `sigd_rut.transicion_estado_tramite` salta directamente de `RESUELTO` a `ARCHIVADO` mediante el evento legado `CIERRE` ([`derivaciones.service.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/domains/rutadoc/derivaciones.service.ts#L671-L682)). Eso mezclaba aprobación/firma, cierre administrativo y archivo documental.

La Fase A0 separa definitivamente los tres estados y operaciones:

| Estado / Operación | Significado funcional | Permiso obligatorio | Rol principal | ¿Termina la custodia / archiva? |
|---|---|---|---|---|
| **`ATENDIDO`** (`ATENCION_TECNICA`) | La actuación técnica o evaluación funcional solicitada concluyó (ej. docente presentó informe, coordinador validó atención técnica). | `EXPEDIENTE_EVALUAR` (o actuación técnica de área) | `DOCENTE`, `COORDINADOR_AREA`, `JEFE_UNIDAD_ACADEMICA` | **No.** El expediente pasa a etapa administrativa de cierre (o a despacho resolutivo). |
| **`RESUELTO`** (`FIRMA`) | Existe acto resolutivo emitido y firmado digitalmente por la autoridad competente. | `FIRMA_FIRMAR` + `RESOLUCION_FIRMAR` | `DIRECTOR` (con `facultad_despacho`) | **No.** Requiere todavía notificación/actuaciones administrativas finales y cierre formal. |
| **`CERRADO`** (`CIERRE_ADMINISTRATIVO`) | **Cierre administrativo formal:** se completaron todas las etapas exigidas por el procedimiento, sin tareas ni observaciones abiertas. | **`EXPEDIENTE_CERRAR`** *(permiso independiente)* | **`SECRETARIO`** *(en Secretaría Académica)* o responsable según tabla procedimental | **No archiva automáticamente.** Deja el expediente listo para transferencia/archivo posterior. |
| **`ARCHIVADO`** (`ARCHIVO`) | Incorporación formal al archivo físico/digital, foliación continua AGN y transferencia de custodia. | **`EXPEDIENTE_ARCHIVAR`** *(permiso independiente)* | `SECRETARIO` / responsable de custodia autorizado | **Sí (`es_terminal = TRUE`).** Solo procede desde `CERRADO`. |
| **`REABIERTO`** (`REAPERTURA`) | Reapertura excepcional y motivada cuando el procedimiento lo habilita (`CERRADO -> REABIERTO -> EN_REVISION`). | Permiso configurado / `EXPEDIENTE_CERRAR` + motivación | `SECRETARIO` / `DIRECTOR` (según `permite_reapertura`) | Actuación append-only; **nunca borra el registro del cierre anterior**. |

### Flujo de Transiciones FSM Propuesto (Compatibilidad Preservada)

```mermaid
flowchart LR
    EN_REV["EN_REVISION"] -->|ATENCION_TECNICA| ATEN["ATENDIDO"]
    EN_REV -->|ENVIAR_A_FIRMA| EN_FIR["EN_FIRMA"]
    EN_FIR -->|FIRMA| RES["RESUELTO"]
    ATEN -->|CIERRE_ADMINISTRATIVO| CER["CERRADO"]
    RES -->|CIERRE_ADMINISTRATIVO| CER
    EN_REV -->|CIERRE_ADMINISTRATIVO (solo proc. sin etapa previa)| CER
    CER -->|ARCHIVO| ARCH["ARCHIVADO (Terminal)"]
    CER -->|REAPERTURA (si procedimiento permite)| REAB["REABIERTO"]
    REAB -->|INICIAR_REVISION| EN_REV
```

> **Compatibilidad histórica garantizada:** Los 3 movimientos históricos existentes ya en estado `ARCHIVADO` en `sigd_rut.estado_actual_expediente` mantienen su fila en `sigd_rut.transicion_estado_tramite` (`RESUELTO + CIERRE -> ARCHIVADO`) protegida como transición histórica de migración para no violar claves foráneas de `movimiento_tramite`, mientras el backend nuevo (`POST /expedientes/:id/cerrar` y `POST /expedientes/:id/archivar`) exige el nuevo circuito `CERRADO -> ARCHIVADO`.

---

## 2. CONFIGURACIÓN DE CIERRE POR PROCEDIMIENTO Y ÁREA (`sigd_doc.procedimiento_cierre_regla`)

Para dar solución exacta a la Sección 7.4 (*"No todos los expedientes pertenecen a Secretaría Académica... asociar tipo de procedimiento, unidad/área responsable, etapa de cierre, responsable autorizado, permiso necesario y condiciones de cierre"*), se introduce `sigd_doc.procedimiento_cierre_regla`:

- **Columnas:**
  - `id_regla UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tipo_tramite_id UUID REFERENCES sigd_doc.tipo_tramite_tupa(tipo_tramite_id) ON DELETE RESTRICT` *(NULL = regla por defecto del área responsable cuando un trámite TUPA no tenga regla específica)*
  - `area_responsable_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT` *(actualmente `SEC`, `DG` o `MP`; preparado para unidades académicas futuras)*
  - `etapa_habilitante VARCHAR(32) NOT NULL CHECK (etapa_habilitante IN ('ATENDIDO', 'RESUELTO', 'EN_REVISION'))`
  - `rol_cierre_codigo VARCHAR(64) NOT NULL REFERENCES sigd_org.rol_sistema(codigo) ON DELETE RESTRICT` *(para procedimientos académicos en `SEC`: `'SECRETARIO'`; para otros procedimientos de `DG`: `'DIRECTOR'` u otro autorizado)*
  - `permiso_requerido_codigo VARCHAR(64) NOT NULL DEFAULT 'EXPEDIENTE_CERRAR' REFERENCES sigd_org.permiso_sistema(codigo) ON DELETE RESTRICT`
  - **Condiciones configurables por procedimiento (no universales):**
    - `requiere_atencion_tecnica BOOLEAN NOT NULL DEFAULT TRUE`
    - `requiere_resolucion_aprobada BOOLEAN NOT NULL DEFAULT FALSE`
    - `requiere_firma_director BOOLEAN NOT NULL DEFAULT FALSE`
    - `requiere_notificacion_previa BOOLEAN NOT NULL DEFAULT FALSE`
    - `requiere_pago_verificado BOOLEAN NOT NULL DEFAULT FALSE`
    - `requiere_documento_final BOOLEAN NOT NULL DEFAULT TRUE`
    - `permite_reapertura BOOLEAN NOT NULL DEFAULT FALSE`
  - `vigente BOOLEAN NOT NULL DEFAULT TRUE`
  - `creado_en TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Índices únicos parciales:**
  - `uq_cierre_regla_tramite_activo` sobre `(tipo_tramite_id, area_responsable_id) WHERE tipo_tramite_id IS NOT NULL AND vigente = TRUE`
  - `uq_cierre_regla_default_area` sobre `(area_responsable_id) WHERE tipo_tramite_id IS NULL AND vigente = TRUE`

### Cómo evalúa el Backend las 11 Comprobaciones del Cierre (`POST /api/v1/expedientes/:id/cerrar`)

Al ejecutar el cierre transaccional (`BEGIN ... FOR UPDATE` sobre `sigd_tra.expediente`), el servicio verifica **en servidor** (nunca en frontend):
1. **Permiso en contexto activo (`claims.ctx`):** El usuario posee `EXPEDIENTE_CERRAR` vigente en su contexto activo (`contextoRevocado = false`).
2. **Competencia de procedimiento:** Resolución determinista de la regla en `sigd_doc.procedimiento_cierre_regla` (primero regla exacta por `tipo_tramite_id`; si no existe, regla por defecto de `area_responsable_id`).
3. **Ámbito autorizado:** El `area_actual_id` del expediente pertenece al `area_id` del contexto activo (`ur.area_id`), y el `rol` del contexto activo coincide con `regla.rol_cierre_codigo` (impidiendo que un `SECRETARIO` de una unidad cierre expedientes de otra unidad o que `SECRETARIO` adquiera acceso global).
4. **No previamente cerrado ni archivado:** `estado_actual NOT IN ('CERRADO', 'ARCHIVADO', 'ANULADO')`.
5. **Etapa habilitante alcanzada:** `estado_actual` coincide con `regla.etapa_habilitante` (o `ATENDIDO` / `RESUELTO` conforme a regla).
6. **Sin tareas de evaluación pendientes:** `NOT EXISTS (SELECT 1 FROM sigd_rut.expediente_evaluador ee WHERE ee.expediente_id = $1 AND ee.activo = TRUE AND ee.estado_evaluacion IN ('PENDIENTE', 'EN_EVALUACION'))`.
7. **Sin observaciones ni subsanaciones abiertas:** `estado_actual NOT IN ('OBSERVADO', 'SUBSANADO')`.
8. **Aprobaciones / Resolución requerida (condicional a `regla`):** Si `requiere_resolucion_aprobada = TRUE`, verifica borrador/resolución existente no anulada.
9. **Firmas digitales verificadas (condicional a `regla`):** Si `requiere_firma_director = TRUE`, exige `sigd_doc.resolucion.estado IN ('FIRMADA', 'NOTIFICADA')` y registro válido en `sigd_doc.firma_digital_documento`.
10. **Documentos finales incorporados (condicional a `regla`):** Si `requiere_documento_final = TRUE`, verifica adjunto final íntegro en `sigd_doc.documento_adjunto` + verificación de pagos si `requiere_pago_verificado = TRUE`.
11. **Notificaciones obligatorias con evidencia (condicional a `regla`):** Si `requiere_notificacion_previa = TRUE`, verifica registro despachado en `sigd_auth.notificacion_casilla` / `sigd_audit.evento_outbox` para el expediente.

---

## 3. HISTORIAL INMUTABLE Y APPEND-ONLY DE CIERRES Y REAPERTURAS (`sigd_rut.expediente_cierre_historial`)

Para cumplir integralmente la Sección 7.5:
- **Columnas:**
  - `id_cierre UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id) ON DELETE RESTRICT`
  - `tipo_actuacion VARCHAR(20) NOT NULL CHECK (tipo_actuacion IN ('CIERRE', 'REAPERTURA'))`
  - `usuario_id UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
  - `persona_id UUID NOT NULL REFERENCES sigd_auth.persona(id_persona) ON DELETE RESTRICT`
  - `contexto_activo_id UUID NOT NULL` *(referencia el `id_usuario_rol` del `claims.ctx`)*
  - `unidad_area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT`
  - `fecha_hora TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`
  - `permiso_utilizado VARCHAR(64) NOT NULL REFERENCES sigd_org.permiso_sistema(codigo) ON DELETE RESTRICT`
  - `estado_anterior TEXT NOT NULL REFERENCES sigd_rut.estado_tramite(codigo)`
  - `estado_posterior TEXT NOT NULL REFERENCES sigd_rut.estado_tramite(codigo)`
  - `justificacion TEXT` *(obligatoria cuando `tipo_actuacion = 'REAPERTURA'`)*
  - `condiciones_verificadas JSONB NOT NULL`
  - `evidencias JSONB NOT NULL DEFAULT '[]'::jsonb`
  - `regla_cierre_id UUID REFERENCES sigd_doc.procedimiento_cierre_regla(id_regla) ON DELETE RESTRICT`
  - `correlation_id UUID NOT NULL`
- **Inmutabilidad WORM:** Trigger `tr_cierre_historial_inmutable` (`BEFORE UPDATE OR DELETE OR TRUNCATE`) que rechaza cualquier alteración o borrado con error SQL `42501`.

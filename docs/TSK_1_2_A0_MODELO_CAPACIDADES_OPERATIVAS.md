# SIGD SUIZA — TSK-1.2 FASE A0
# MODELO DE CAPACIDADES OPERATIVAS (`GESTOR_APOYO_AREA`)

**Institución:** Instituto de Educación Superior Tecnológico Público «Suiza» — Pucallpa, Ucayali  
**Rama Git exclusiva:** `B_JACOBO` | **Base oficial:** `sigd_jacobo_demo` (PostgreSQL 18.6)  
**Estado:** Diseño Técnico Definitivo (FASE A0) — **No ejecutado en BD**

---

## 1. DEFINICIÓN NORMATIVA DE `GESTOR_APOYO_AREA`

- **Código interno:** `GESTOR_APOYO_AREA`
- **Nombre visible en interfaz:** `Apoyo de Área`
- **Naturaleza jurídica/técnica:** **Capacidad operativa delegada**, circunscrita obligatoriamente a un `area_id` específico de `sigd_org.area`. **No es un undécimo rol institucional** y **no obtiene automáticamente `#32 EXPEDIENTE_DESCARGAR`** (bloqueado en lista negra SQL y backend). Tampoco se relaciona con el dominio SaaS independiente `SUPER_ADMIN_PLATAFORMA` (*Superadministrador de Plataforma*, esquema `PROPUESTO` `sigd_saas` dentro de `sigd_jacobo_demo`).
- **Estado actual en BD (`IMPLEMENTADO` / `PARCIAL` en backend; `PROPUESTO` en BD):** Las tablas `sigd_org.capacidad_sistema`, `sigd_org.capacidad_permiso` y `sigd_org.usuario_capacidad` **no existen aún** (`null` verificado en Fase 0 y Fase A0). El código backend en [`auth.guard.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/auth.guard.ts#L190-L241) y [`contexto.service.ts`](file:///c:/Users/Liz/Desktop/SIGD/SIGD/backend/src/core/auth/contexto.service.ts#L95-L212) opera actualmente con captura defensiva `try/catch`.

---

## 2. ESTRUCTURA RELACIONAL NORMALIZADA

Se reemplaza definitivamente cualquier esquema de permisos embebidos en JSONB por un catálogo normalizado que enlaza con `sigd_org.permiso_sistema`:

### 2.1. `sigd_org.capacidad_sistema`
- `id_capacidad UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `codigo VARCHAR(64) NOT NULL UNIQUE CHECK (codigo = 'GESTOR_APOYO_AREA')` *(catálogo cerrado extensible bajo autorización)*
- `nombre VARCHAR(120) NOT NULL` -> `'Apoyo de Área'`
- `descripcion TEXT`
- `ambito_requerido VARCHAR(16) NOT NULL DEFAULT 'AREA' CHECK (ambito_requerido = 'AREA')`
- `vigente BOOLEAN NOT NULL DEFAULT TRUE`
- `creado_en TIMESTAMPTZ NOT NULL DEFAULT now()`

Seed determinístico: `id_capacidad = '4c010000-0000-4000-8000-000000000001'`, `codigo = 'GESTOR_APOYO_AREA'`, `nombre = 'Apoyo de Área'`.

### 2.2. `sigd_org.capacidad_permiso` + Protección en Nivel Motor
- `id_capacidad UUID NOT NULL REFERENCES sigd_org.capacidad_sistema(id_capacidad) ON DELETE CASCADE`
- `permiso_id UUID NOT NULL REFERENCES sigd_org.permiso_sistema(permiso_id) ON DELETE RESTRICT`
- `PRIMARY KEY (id_capacidad, permiso_id)`

#### Permisos Estrictamente Permitidos (`LISTA BLANCA`):
1. `EXPEDIENTE_LEER` *(delimitado al `area_id` de `usuario_capacidad`, nunca lectura global)*
2. `EXPEDIENTE_RECEPCIONAR` *(en su `area_id`)*
3. `EXPEDIENTE_DERIVAR` *(desde su `area_id`)*
4. `EXPEDIENTE_ADJUNTAR` *(organización documental y anexos en expedientes de su `area_id`)*

#### Permisos Categóricamente Prohibidos (`LISTA NEGRA EN TRIGGER SQL + BACKEND`):
El trigger `tr_proteger_capacidad_permiso` (`BEFORE INSERT OR UPDATE` sobre `sigd_org.capacidad_permiso`) abortará cualquier intento de asociar a `GESTOR_APOYO_AREA`:
- `EXPEDIENTE_APROBAR`, `EXPEDIENTE_RECHAZAR`, `EXPEDIENTE_CERRAR`, `EXPEDIENTE_ARCHIVAR`, **`EXPEDIENTE_DESCARGAR` (#32)**
- `EXPEDIENTE_ASIGNAR`, `EXPEDIENTE_REASIGNAR`, `EXPEDIENTE_EVALUAR`, `EXPEDIENTE_OBSERVAR`, `EXPEDIENTE_RESOLVER`, `DOCUMENTO_EDITAR`
- `RESOLUCION_EMITIR`, `RESOLUCION_FIRMAR`, `FIRMA_FIRMAR`
- `ADMIN_USUARIOS`, `REPORTE_LEER`, `TRAMICORE_DEVOLUCION_EVALUAR`, cualquier `TESORERIA_%`
- Además de tokens obsoletos (`EXPEDIENTE_FIRMAR`, `DOCENTE_EVALUAR`) bloqueados en TypeScript (`PERMISOS_PROHIBIDOS_GESTOR_APOYO`), donde en Fase B debe incorporarse también `EXPEDIENTE_DESCARGAR` y los códigos atómicos vigentes.

### 2.3. `sigd_org.usuario_capacidad` (Vigencia, Ámbito, Historial y Auditoría)
- `id_usuario_capacidad UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `id_usuario UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
- `id_capacidad UUID NOT NULL REFERENCES sigd_org.capacidad_sistema(id_capacidad) ON DELETE RESTRICT`
- `area_id UUID NOT NULL REFERENCES sigd_org.area(area_id) ON DELETE RESTRICT` *(Ámbito obligatorio: nunca `NULL`)*
- `justificacion TEXT NOT NULL CHECK (length(btrim(justificacion)) >= 10)`
- `asignado_por UUID NOT NULL REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
- `activo BOOLEAN NOT NULL DEFAULT TRUE`
- `vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now()`
- `vigente_hasta TIMESTAMPTZ`
- `desactivado_por UUID REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`
- `desactivado_en TIMESTAMPTZ`
- `motivo_desactivacion TEXT`
- `creado_en TIMESTAMPTZ NOT NULL DEFAULT now()`
- `actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()`
- **Restricciones:**
  - `chk_usuario_capacidad_vigencia`: `CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde)`
  - `chk_usuario_capacidad_cierre`: `CHECK (activo = TRUE OR desactivado_en IS NOT NULL)`
  - `ex_usuario_capacidad_vigencia`: `EXCLUDE USING gist (id_usuario WITH =, id_capacidad WITH =, area_id WITH =, tstzrange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::timestamptz), '[)') WITH &&) WHERE (activo = TRUE)` -> impide duplicidad y solapamiento temporal de asignaciones activas en la misma área.
  - Índice parcial `uq_usuario_capacidad_activa` y búsquedas por `(id_usuario)` y `(area_id)`.

---

## 3. REGLAS DE INTEGRACIÓN CON CONTEXTOS, REVOCACIÓN Y AUDITORÍA

1. **Incompatibilidad con cuentas externas:** Trigger `BEFORE INSERT` en `sigd_org.usuario_capacidad` verifica que `id_usuario` pertenezca a una cuenta institucional interna (que no tenga únicamente `CIUDADANO` o roles históricos expirados sin vínculo interno).
2. **Contexto de trabajo independiente (`claims.ctx`):**
   - `listarContextosDisponibles` devuelve la capacidad con `tipo: 'CAPACIDAD'`, `codigo: 'GESTOR_APOYO_AREA'`, `nombre: 'Apoyo de Área'`, `areaId: uc.area_id` y permisos forzados a `ambito: 'AREA'`.
   - **Brecha a corregir en Fase B (`auth.guard.ts` line 256):** Cuando `obtenerAutorizacionCuenta(pool, idUsuario, null)` se invoque sin `claims.ctx`, debe sumar las asignaciones vigentes de `usuario_rol` **más** las de `usuario_capacidad` para que un usuario con `1` rol + `1` capacidad operativa **sí exija** selección explícita de contexto (`requiereSeleccionContexto = true`), sin acumular permisos ni asumir el rol único.
3. **Revocación inmediata (Política B):**
   - Al desactivar (`activo = FALSE`, `desactivado_en = now()`, `desactivado_por`, `motivo_desactivacion`) o vencer `vigente_hasta`:
     - Se registra evento inmutable en `sigd_audit.bitacora_auditoria` y `sigd_auth.auditoria_usuarios`.
     - La siguiente petición protegida con `claims.ctx = id_usuario_capacidad` recibe `403 CONTEXT_REVOKED` sin necesidad de esperar expiración del JWT.
     - Si el usuario conserva un rol vigente en `usuario_rol` (por ejemplo `DOCENTE` o `SECRETARIO`), la sesión permanece operativa para cambiar de contexto mediante `POST /api/v1/auth/seleccionar-contexto`. Si no le queda ningún contexto ni rol, queda bloqueado sin permisos por defecto.

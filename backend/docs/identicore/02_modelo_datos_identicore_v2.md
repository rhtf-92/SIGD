# Modelo de Datos Relacional - Módulo IdentiCore (Polimórfico v2.0)

**Responsable:** Jair (`B_JAIR`)  
**Fecha:** 30 de agosto de 2026  
**Versión:** 2.0 — Modelo Polimórfico, Argon2id, Ley 29733  
**Estado:** BORRADOR — PROPUESTA PENDIENTE DE VALIDACIÓN INSTITUCIONAL  
**Dependencias:** Análisis funcional (`01_analisis_identidad_personas_seguridad.md`, B_TAPULLIMA) e información oficial sobre tipos de documento.  
**Convención de niveles:** CONFIRMADO / PROPUESTO / PENDIENTE / EJEMPLO

---

## 1. Descripción del Modelo

El módulo IdentiCore gestiona la identificación de personas mediante un **modelo polimórfico** que separa conceptualmente:

1. **Identidad civil** (`persona`): base común para todas las personas.
2. **Extensión natural** (`persona_natural`): datos específicos de personas físicas (DNI, nombres, nacimiento).
3. **Extensión jurídica** (`persona_juridica`): datos específicos de personas jurídicas (RUC, razón social, SUNARP).
4. **Credenciales de acceso** (`cuenta_usuario`): autenticación desacoplada de identidad.
5. **Vínculo institucional** (`perfil_usuario`): rol en el SIGD.
6. **Sesiones activas** (`sesion_usuario`): gestión de refresco con Argon2id.
7. **Consentimiento de datos (`consentimiento_datos`): cumplimiento Ley N° 29733.

Esta arquitectura permite:
- Evitar duplicación de datos personales.
- Gestionar representantes legales de forma estructurada.
- Aplicar seguridad avanzada (Argon2id, refresh tokens).
- Cumplir requisitos legales (Ley 29733, ofuscación).

---

## 2. Definición de Entidades

### 2.1 `persona`
Identidad civil única (DNI/CE/Pasaporte, RUC).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK, identificador técnico interno |
| `tipo_documento_id` | BIGINT | FK → `tipos_documento.id` |
| `numero_documento` | VARCHAR(20) | Número de documento (validado por CHECK) |
| `tipo_persona` | VARCHAR(20) | `NATURAL` \| `JURIDICA` |
| `nombres` | VARCHAR(120) | Nombres |
| `apellido_paterno` | VARCHAR(120) | Apellido paterno |
| `apellido_materno` | VARCHAR(120) | Apellido materno |
| `fecha_nacimiento` | DATE | Fecha de nacimiento |
| `genero` | VARCHAR(1) | M/F/O |
| `telefono` | VARCHAR(20) | Teléfono de contacto |
| `email_contacto` | VARCHAR(150) | Email de contacto |
| `estado` | BOOLEAN | Estado lógico (activo/inactivo) |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Fecha de última actualización |

**Restricciones:**
- `uq_persona_documento`: UNIQUE (`tipo_documento_id`, `numero_documento`)
- `fk_persona_tipo_documento`: FK a `tipos_documento`
- `chk_persona_dni_ruc`: 
  - `tipo_persona = 'NATURAL'` → `numero_documento ~ '^[0-9]{8}$'`
  - `tipo_persona = 'JURIDICA'` → `numero_documento ~ '^(10|15|17|20)[0-9]{9}$'`

---

### 2.2 `persona_natural`
Datos específicos de personas físicas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `persona_id` | BIGINT | FK → `persona.id` |
| `nombres` | VARCHAR(120) | Nombres (replica de persona) |
| `apellido_paterno` | VARCHAR(120) | Apellido paterno (replica) |
| `apellido_materno` | VARCHAR(120) | Apellido materno (replica) |
| `fecha_nacimiento` | DATE | Fecha de nacimiento |
| `genero` | VARCHAR(1) | Género |
| `telefono` | VARCHAR(20) | Teléfono |
| `email_contacto` | VARCHAR(150) | Email |
| `estado` | BOOLEAN | Estado lógico |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Fecha de última actualización |

**Restricciones:**
- `fk_persona_natural_persona`: FK a `persona.id`
- Datos replicados para consistencia; actualización mediante trigger o aplicación.

---

### 2.3 `persona_juridica`
Datos específicos de personas jurídicas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `persona_id` | BIGINT | FK → `persona.id` |
| `razon_social` | VARCHAR(200) | Razón social legal |
| `nombre_comercial` | VARCHAR(200) | Nombre comercial |
| `partida_registral_sunarp` | BIGINT | Partida SUNARP |
| `estado` | BOOLEAN | Estado lógico |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Fecha de última actualización |

**Restricciones:**
- `fk_persona_juridica_persona`: FK a `persona.id`
- `uq_persona_juridica_razon`: UNIQUE `razon_social`
- RUC válido verificado en `persona.numero_documento`

---

### 2.4 `representacion_legal`
Vinculación entre persona natural y persona jurídica.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `persona_natural_id` | BIGINT | FK → `persona_natural.id` |
| `persona_juridica_id` | BIGINT | FK → `persona_juridica.id` |
| `vigencia_inicio` | DATE | Inicio de vigencia |
| `vigencia_fin` | DATE | Fin de vigencia (NULL = indefinido) |
| `activo` | BOOLEAN | Estado actual |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

**Restricciones:**
- `fk_rep_legal_natural`: FK a `persona_natural.id`
- `fk_rep_legal_juridica`: FK a `persona_juridica.id`
- `chk_rep_legal_one_to_one`: UNIQUE (`persona_natural_id`, `persona_juridica_id`)
- `chk_vigencia`: `vigencia_fin` NULL o `> vigencia_inicio`

---

### 2.5 `cuenta_usuario`
Credenciales de acceso (autenticación).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `persona_id` | BIGINT | FK → `persona.id` |
| `username` | VARCHAR(50) | Nombre de usuario |
| `email_login` | VARCHAR(150) | Email de login |
| `password_hash` | VARCHAR(255) | Hash con Argon2id |
| `estado` | BOOLEAN | Estado lógico |
| `intentos_fallidos` | SMALLINT | Contador de intentos |
| `bloqueado_hasta` | TIMESTAMPTZ | Hasta cuando está bloqueada |
| `ultimo_acceso` | TIMESTAMPTZ | Último acceso exitoso |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Fecha de última actualización |

**Restricciones:**
- `fk_cuenta_usuario_persona`: FK a `persona.id`
- `uq_cuenta_username`: UNIQUE `username`
- `uq_cuenta_email_login`: UNIQUE `email_login`
- `ck_cuenta_intentos`: `intentos_fallidos >= 0`

---

### 2.6 `sesion_usuario`
Gestión de sesiones con Refresh Tokens (Argon2id).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `usuario_id` | BIGINT | FK → `cuenta_usuario.id` |
| `token_refresh` | VARCHAR(255) | Token de refresco (seguro) |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `expires_at` | TIMESTAMPTZ | Fecha de expiración |
| `ip_address` | INET | IP de inicio de sesión |
| `user_agent` | TEXT | User-Agent de inicio |
| `last_ip` | INET | Última IP usada |
| `last_user_agent` | TEXT | Último User-Agent usado |

**Restricciones:**
- `fk_sesion_usuario_usuario`: FK a `cuenta_usuario.id`
- `chk_sesion_token_length`: LENGTH entre 32-256 caracteres
- `chk_token_no_plaintext`: Validación de formato hash (no texto plano)

**Argon2id Parameters (documentado):**
- Memory: 64 MB (65536 KB)
- Iterations: 3
- Parallelism: 4
- Hash length: 32 bytes
- Salt length: 16 bytes

---

### 2.7 `perfil_usuario`
Vínculo institucional (rol y área).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `persona_id` | BIGINT | FK → `persona.id` |
| `cuenta_usuario_id` | BIGINT | FK → `cuenta_usuario.id` |
| `tipo_usuario` | VARCHAR(20) | `INTERNO` \| `EXTERNO` |
| `condicion_registro` | VARCHAR(20) | `CON_CUENTA` \| `SIN_CUENTA` |
| `area_id` | BIGINT | FK conceptual → OrganiCore (`areas.id`) |
| `cargo_id` | BIGINT | FK conceptual → OrganiCore (`cargos.id`) |
| `rol_id` | BIGINT | FK conceptual → OrganiCore (`roles.id`) |
| `fecha_vigencia_inicio` | DATE | Inicio de vigencia |
| `fecha_vigencia_fin` | DATE | Fin de vigencia |
| `estado` | BOOLEAN | Estado lógico |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

**Restricciones:**
- `fk_perfil_usuario_persona`: FK a `persona.id`
- `fk_perfil_usuario_cuenta`: FK a `cuenta_usuario.id`
- `chk_perfil_tipo_usuario`: `tipo_usuario IN ('INTERNO','EXTERNO')`
- `chk_perfil_condicion`: `condicion_registro IN ('CON_CUENTA','SIN_CUENTA')`

---

### 2.8 `consentimiento_datos`
Registro de consentimiento bajo Ley N° 29733.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `usuario_id` | BIGINT | FK → `cuenta_usuario.id` |
| `fecha_aceptacion` | TIMESTAMPTZ | Fecha de aceptación |
| `ip_address` | INET | IP de aceptación |
| `version_termsoservicio` | VARCHAR(50) | Versión de TOS (`v1.0\|v1.1\|v2.0`) |
| `aceptacion_notificaciones` | BOOLEAN | Acepta notificaciones |
| `consentimiento_obfuscacion` | BOOLEAN | Acepta ofuscación pública |
| `created_at` | TIMESTAMPTZ | Fecha de creación |

**Restricciones:**
- `fk_consent_datos_usuario`: FK a `cuenta_usuario.id`
- `chk_consent_data_types`: `version_termsoservicio IN ('v1.0','v1.1','v2.0')`

---

### 2.9 `persona_documento_historial`
Historial de cambios de documento.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `persona_id` | BIGINT | FK → `persona.id` |
| `tipo_documento_id` | BIGINT | FK → `tipos_documento.id` |
| `numero_documento_anterior` | VARCHAR(20) | Número anterior |
| `fecha_registro` | TIMESTAMPTZ | Fecha de registro |
| `motivo` | TEXT | Motivo del cambio |

**Restricciones:**
- `fk_hist_documento_persona`: FK a `persona.id`
- `fk_hist_documento_tipo`: FK a `tipos_documento.id`

---

### 2.10 `auditoria_usuarios`
Trazabilidad de operaciones.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `usuario_accion_id` | BIGINT | FK → `cuenta_usuario.id` (usuario que actuó) |
| `entidad_afectada` | VARCHAR(40) | `PERSONA` \| `CUENTA` \| `PERFIL` \| `CONSENTIMIENTO` |
| `entidad_id` | BIGINT | ID de la entidad afectada |
| `accion` | VARCHAR(30) | `CREATE` \| `UPDATE` \| `DELETE` \| `ACTIVATE` \| `DEACTIVATE` |
| `detalle` | JSONB | Detalles adicionales |
| `fecha` | TIMESTAMPTZ | Fecha de acción (default: now()) |

**Restricciones:**
- `fk_auditoria_usuario_accion`: FK a `cuenta_usuario.id`
- `ck_auditoria_entidad`: `entidad_afectada IN ('PERSONA','CUENTA','PERFIL','CONSENTIMIENTO')`

---

### 2.11 `tipos_documento`
Catálogo de tipos de documento.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `codigo` | VARCHAR(20) | Código (`DNI`, `CE`, `PAS`) |
| `nombre` | VARCHAR(60) | Nombre descriptivo |
| `estado` | BOOLEAN | Estado activo/inactivo |

**Restricciones:**
- `uq_tipos_documento_codigo`: UNIQUE `codigo`
- Valores iniciales: `DNI`, `CE`, `PAS`

---

## 3. Relaciones del Modelo

### 3.1 Principales
```
tipos_documento ────┐
                    ├─── persona ──── persona_natural
                    │                   persona_juridica
persona ────┬───────┼───┐
            │       │   ├─── cuenta_usuario ─── sesion_usuario
            │       │   └─── perfil_usuario
            │       └─── persona_documento_historial
            └─── representacion_legal ←─┐
                                        └─── persona_natural
                                               └─── persona_juridica
cuenta_usuario ────┐
                   ├─── consentimiento_datos
                   └─── auditoria_usuarios
```

### 3.2 Relaciones Clave
| Relación | Tipo | Descripción |
|---|---|---|
| `tipos_documento → persona` | 1:N | Un tipo de documento puede identificar a muchas personas |
| `persona → persona_natural` | 1:1 (condicional) | Solo si `tipo_persona = NATURAL` |
| `persona → persona_juridica` | 1:1 (condicional) | Solo si `tipo_persona = JURIDICA` |
| `persona_natural → persona_juridica` | N:M (vía `representacion_legal`) | Representación legal |
| `persona → cuenta_usuario` | 1:N | Una persona puede tener múltiples cuentas |
| `cuenta_usuario → sesion_usuario` | 1:N | Múltiples sesiones activas por usuario |
| `cuenta_usuario → consentimiento_datos` | 1:N | Historial de consentimientos |
| `persona → perfil_usuario` | 1:N | Múltiples roles institucionales |
| `cuenta_usuario → auditoria_usuarios` | 1:N | Trazabilidad de acciones |

---

## 4. Restricciones e Índices Propuestos

| Elemento | Entidad | Detalle | Nivel |
|---|---|---|---|
| UNIQUE `(tipo_documento_id, numero_documento)` | `persona` | Evita identidad duplicada | CONFIRMADO |
| UNIQUE `username` / `email_login` | `cuenta_usuario` | Identificadores de acceso únicos | CONFIRMADO |
| UNIQUE `codigo` | `tipos_documento` | Código de catálogo único | CONFIRMADO |
| CHECK tipo_persona IN ('NATURAL','JURIDICA') | `persona` | Valores controlados | CONFIRMADO |
| CHECK formato DNI (8 dígitos) | `persona` | Cuando tipo_persona = NATURAL | CONFIRMADO |
| CHECK formato RUC (11 dígitos, inicia 10/15/17/20) | `persona` | Cuando tipo_persona = JURIDICA | CONFIRMADO |
| CHECK tipo_usuario IN ('INTERNO','EXTERNO') | `perfil_usuario` | Valores controlados | CONFIRMADO |
| CHECK condicion_registro IN ('CON_CUENTA','SIN_CUENTA') | `perfil_usuario` | Valores controlados | CONFIRMADO |
| CHECK version_termsoservicio IN ('v1.0','v1.1','v2.0') | `consentimiento_datos` | Versiones TOS soportadas | CONFIRMADO |
| CHECK LENGTH(token_refresh) BETWEEN 32 AND 256 | `sesion_usuario` | Tokens de refresco seguros | CONFIRMADO |
| Índices por `numero_documento` | `persona` | Búsqueda por documento (no PK) | PROPUESTO |
| Índices por `estado, tipo_usuario` | `perfil_usuario` | Filtros de usuarios activos | PROPUESTO |

---

## 5. Integración con Otros Módulos

| Módulo | Grupo | Uso de IdentiCore |
|---|---|---|
| OrganiCore | G3 | Provee `areas`, `cargos`, `roles` que IdentiCore referencia desde `perfil_usuario`. |
| RutaDoc | G1 | Consume `personas.id` / `perfil_usuario.id` para trazabilidad de movimientos. |
| TramiCore | G2 | Asocia trámites/expedientes con remitentes/solicitantes (ID de IdentiCore). |
| DocuCore | G5 | Vincula documentos con usuario que los registró/firmó (ID de IdentiCore). |
| CoreLink | G6 | Valida referencias a usuarios sin duplicar datos personales. |

**Postura de Integración:** IdentiCore expone identificadores internos estables (`personas.id`, `perfil_usuario.id`) para trazabilidad, nunca el documento visible.

---

## 6. Artefactos del Módulo IdentiCore v2.0

| Artefacto | Ruta |
|---|---|
| Análisis funcional | `backend/docs/identicore/01_analisis_identidad_personas_seguridad.md` |
| Modelo de datos | `backend/docs/identicore/02_modelo_datos_identicore_v2.md` |
| Diccionario de datos | `backend/docs/identicore/02_diccionario_datos_identicore_v2.md` |
| Diagrama E-R (editable) | `backend/docs/identicore/02_modelo_datos_identicore_diagrama.drawio` |
| Diagrama E-R (vista previa) | `backend/docs/identicore/02_modelo_datos_identicore_diagrama.png` |
| Borrador SQL | `backend/docs/identicore/03_esquema_sigd_auth_v2.sql` |
| Validación técnica | `backend/docs/identicore/04_validacion_identicore_v2.md` |
| Decisiones y pendientes | `backend/docs/identicore/05_decisiones_levantamiento_identicore.md` |

---

## 7. Estados y Próximos Pasos

**Estado Actual:** BORRADOR — PROPUESTA PENDIENTE DE VALIDACIÓN INSTITUCIONAL

**Acciones Requeridas:**
1. Validar modelo con Grupo 3 (OrganiCore) para referencias de áreas/cargos/roles
2. Confirmar formato exacto de RUC con SUNARP (si aplica)
3. Validar política de ofuscación con área legal
4. Ejecutar pruebas técnicas en entorno de desarrollo
5. Integrar en rama `B_SEGUNDO` y crear PR hacia `B_GERIC`

---

**Firma:** _________________ Jair (`B_JAIR`)  
**Fecha:** _________________
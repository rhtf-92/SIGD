# Diccionario de Datos - IdentiCore v2.0

> **Implementación actual: BIGSERIAL/BIGINT, según `03_esquema_sigd_auth_v2.sql`.**
> Alineación documental realizada para mantener coherencia con la implementación.
> La decisión queda sujeta a validación de Jair/Grupo 4.

## 1. Visión General
El módulo **IdentiCore** gestiona la identidad centralizada, autenticación, perfiles y representaciones legales para el sistema. Referencia física: `03_esquema_sigd_auth_v2.sql` (esquema `sigd_auth`).

---

## 2. Entidades y Estructuras de Datos

### 2.0. TABLA: `tipos_documento`

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `BIGSERIAL` | NO | PK | Identificador interno del tipo de documento |
| `codigo` | `VARCHAR(20)` | NO | UQ | `DNI`, `CE`, `PAS`, `RUC` |
| `nombre` | `VARCHAR(60)` | NO | | Nombre descriptivo |
| `estado` | `BOOLEAN` | NO | | Baja lógica |

---

### 2.1. TABLA: `persona`
Entidad base de identidad civil.

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `BIGSERIAL` | NO | PK | Identificador interno, nunca el documento |
| `tipo_documento_id` | `BIGINT` | NO | FK → `tipos_documento(id)` | `ON DELETE RESTRICT` |
| `numero_documento` | `VARCHAR(20)` | NO | UQ compuesta | `UNIQUE(tipo_documento_id, numero_documento)` |
| `nombres` | `VARCHAR(120)` | NO | | Nombres |
| `apellido_paterno` | `VARCHAR(120)` | NO | | Apellido paterno |
| `apellido_materno` | `VARCHAR(120)` | SI | | Apellido materno |
| `fecha_nacimiento` | `DATE` | SI | | Fecha de nacimiento |
| `genero` | `VARCHAR(1)` | SI | | Género |
| `telefono` | `VARCHAR(20)` | SI | | Teléfono |
| `email_contacto` | `VARCHAR(150)` | SI | | Correo de contacto, distinto del login |
| `estado` | `BOOLEAN` | NO | | Baja lógica |
| `tipo_persona` | `VARCHAR(20)` | NO | | `NATURAL` o `JURIDICA` (`chk_persona_tipo_persona`) |
| RUC formato | — | — | CHECK | `chk_persona_ruc_format`: si `JURIDICA`, `^(10\|15\|17\|20)[0-9]{9}$`. Solo formato, sin dígito verificador ni SUNAT |

---

### 2.2. TABLA: `persona_natural`

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `BIGSERIAL` | NO | PK | Identificador interno de la extensión |
| `persona_id` | `BIGINT` | NO | FK → `persona(id)` | `ON DELETE RESTRICT`, relación N:1 sin garantía 1:1 |
| `numero_documento` | `VARCHAR(20)` | NO | | DNI 8 dígitos (`chk_persona_natural_dni_format`), solo formato sin RENIEC |
| `nombres` | `VARCHAR(120)` | NO | | Nombres |
| `apellido_paterno` | `VARCHAR(120)` | NO | | Apellido paterno |
| `apellido_materno` | `VARCHAR(120)` | SI | | Apellido materno |
| `fecha_nacimiento` | `DATE` | SI | | Fecha de nacimiento |
| `genero` | `VARCHAR(1)` | SI | | Género |
| `telefono` | `VARCHAR(20)` | SI | | Teléfono |
| `email_contacto` | `VARCHAR(150)` | SI | | Correo de contacto |
| `estado` | `BOOLEAN` | NO | | Baja lógica |

---

### 2.3. TABLA: `persona_juridica`

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `BIGSERIAL` | NO | PK | Identificador interno de la extensión |
| `persona_id` | `BIGINT` | NO | FK → `persona(id)` | `ON DELETE RESTRICT`, relación N:1 |
| `razon_social` | `VARCHAR(200)` | NO | UQ | `uq_persona_juridica_razon` |
| `nombre_comercial` | `VARCHAR(200)` | NO | | Nombre comercial |
| `partida_registral_sunarp` | `BIGINT` | NO | | Partida SUNARP |
| `estado` | `BOOLEAN` | NO | | Baja lógica |

> El RUC vive en `persona.numero_documento`; `persona_juridica` no almacena documento.

---

### 2.4. TABLA: `representacion_legal`

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `BIGSERIAL` | NO | PK | Identificador interno |
| `persona_natural_id` | `BIGINT` | NO | FK → `persona_natural(id)` | `ON DELETE RESTRICT` |
| `persona_juridica_id` | `BIGINT` | NO | FK → `persona_juridica(id)` | `ON DELETE RESTRICT` |
| `vigencia_inicio` | `DATE` | NO | | Inicio de vigencia |
| `vigencia_fin` | `DATE` | SI | | Fin opcional; `NULL` = indefinida |
| `activo` | `BOOLEAN` | NO | | Vigencia lógica |
| Dupla | — | — | UQ | `uq_rep_legal_natural_juridica (persona_natural_id, persona_juridica_id)` |
| Vigencia | — | — | CHECK | `chk_rep_legal_vigencia`: `vigencia_fin IS NULL OR vigencia_fin >= vigencia_inicio`. Sin EXCLUDE anti-solapamiento |

---

### 2.5. TABLA: `persona_documento_historial`

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `BIGSERIAL` | NO | PK | Identificador interno |
| `persona_id` | `BIGINT` | NO | FK → `persona(id)` | `ON DELETE RESTRICT` |
| `tipo_documento_id` | `BIGINT` | NO | FK → `tipos_documento(id)` | `ON DELETE RESTRICT` |
| `numero_documento_anterior` | `VARCHAR(20)` | NO | | Documento anterior |
| `fecha_registro` | `TIMESTAMPTZ` | NO | | `DEFAULT now()` |
| `motivo` | `TEXT` | SI | | Motivo del cambio |

---

### 2.6. TABLA: `cuenta_usuario`

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `BIGSERIAL` | NO | PK | Identificador interno de la cuenta |
| `persona_id` | `BIGINT` | NO | FK → `persona(id)` | `ON DELETE RESTRICT` |
| `username` | `VARCHAR(50)` | NO | UQ | `uq_cuenta_username` |
| `email_login` | `VARCHAR(150)` | NO | UQ | `uq_cuenta_email_login` |
| `password_hash` | `VARCHAR(255)` | NO | | Hash Argon2id m=65536,t=3,p=4; nunca texto plano |
| `estado` | `BOOLEAN` | NO | | Baja lógica |
| `intentos_fallidos` | `SMALLINT` | NO | | `DEFAULT 0`, `chk_cuenta_intentos >= 0`. Sin bloqueo automático en BD |
| `bloqueado_hasta` | `TIMESTAMPTZ` | SI | | Fijado por aplicación, no por trigger |
| `ultimo_acceso` | `TIMESTAMPTZ` | SI | | Último acceso exitoso |
| `created_at` | `TIMESTAMPTZ` | NO | | `DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | NO | | `DEFAULT now()` |

---

### 2.7. TABLA: `sesion_usuario`

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `BIGSERIAL` | NO | PK | Identificador interno |
| `usuario_id` | `BIGINT` | NO | FK → `cuenta_usuario(id)` | `ON DELETE RESTRICT` |
| `token_refresh` | `VARCHAR(255)` | NO | | `chk_sesion_token_length`: 32–255. Distinto de `password_hash` |
| `created_at` | `TIMESTAMPTZ` | NO | | `DEFAULT now()` |
| `expires_at` | `TIMESTAMPTZ` | NO | | Expiración controlada por aplicación |
| `ip_address` | `INET` | SI | | Auditoría |
| `user_agent` | `TEXT` | SI | | Auditoría |
| `last_ip` | `INET` | SI | | Última auditoría |
| `last_user_agent` | `TEXT` | SI | | Última auditoría |

> Rotación, revocación y detección de reuso son lógica de aplicación, no constraints.

---

### 2.8. TABLA: `consentimiento_datos`

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `BIGSERIAL` | NO | PK | Identificador interno |
| `usuario_id` | `BIGINT` | NO | FK → `cuenta_usuario(id)` | `ON DELETE RESTRICT` |
| `fecha_aceptacion` | `TIMESTAMPTZ` | NO | | `DEFAULT now()` |
| `ip_address` | `INET` | SI | | Evidencia |
| `version_termsoservicio` | `VARCHAR(50)` | NO | | `chk_consent_data_types IN ('v1.0','v1.1','v2.0')` |
| `aceptacion_notificaciones` | `BOOLEAN` | NO | | Aceptación notificaciones |
| `consentimiento_obfuscacion` | `BOOLEAN` | NO | | Ofuscación pendiente en API |

> La tabla registra evidencia; no equivale a cumplimiento jurídico integral ni es inmutable.

---

### 2.9. TABLA: `perfil_usuario`

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `BIGSERIAL` | NO | PK | Identificador interno |
| `persona_id` | `BIGINT` | NO | FK → `persona(id)` | `ON DELETE RESTRICT` |
| `cuenta_usuario_id` | `BIGINT` | SI | FK → `cuenta_usuario(id)` | `ON DELETE SET NULL`; coherencia CON/SIN_CUENTA |
| `tipo_usuario` | `VARCHAR(20)` | NO | | `INTERNO` o `EXTERNO` |
| `condicion_registro` | `VARCHAR(20)` | NO | | `CON_CUENTA` o `SIN_CUENTA` |
| `area_id` | `BIGINT` | SI | Conceptual | OrganiCore, sin FK física |
| `cargo_id` | `BIGINT` | SI | Conceptual | OrganiCore, sin FK física |
| `rol_id` | `BIGINT` | SI | Conceptual | OrganiCore, sin FK física |
| `fecha_vigencia_inicio` | `DATE` | SI | | Vigencia |
| `fecha_vigencia_fin` | `DATE` | SI | | Vigencia |
| `estado` | `BOOLEAN` | NO | | Baja lógica |

---

### 2.10. TABLA: `auditoria_usuarios`

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `BIGSERIAL` | NO | PK | Identificador interno |
| `usuario_accion_id` | `BIGINT` | NO | FK → `cuenta_usuario(id)` | `ON DELETE RESTRICT` |
| `entidad_afectada` | `VARCHAR(40)` | NO | | `PERSONA`, `CUENTA`, `PERFIL`, `CONSENTIMIENTO` |
| `entidad_id` | `BIGINT` | NO | | ID afectado |
| `accion` | `VARCHAR(30)` | NO | | `CREATE`, `UPDATE`, `DELETE`, `ACTIVATE`, `DEACTIVATE` |
| `detalle` | `JSONB` | SI | | Detalle |
| `fecha` | `TIMESTAMPTZ` | NO | | `DEFAULT now()` |

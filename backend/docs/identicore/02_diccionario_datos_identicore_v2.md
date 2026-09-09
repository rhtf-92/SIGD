# Diccionario de Datos - IdentiCore v2.0

## 1. Visión General
El módulo **IdentiCore** gestiona la identidad centralizada, autenticación, perfiles y representaciones legales para el sistema.

---

## 2. Entidades y Estructuras de Datos

### 2.1. TABLA: `persona`
Entidad base para la generalización de personas naturales y jurídicas.

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id_persona` | `UUID` | NO | PK | Identificador único universal de la persona |
| `tipo_persona` | `VARCHAR(20)` | NO | | `NATURAL` o `JURIDICA` |
| `estado` | `VARCHAR(20)` | NO | | Estado de la entidad (`ACTIVO`, `INACTIVO`) |
| `creado_en` | `TIMESTAMPTZ` | NO | | Fecha y hora de creación |
| `actualizado_en` | `TIMESTAMPTZ` | NO | | Fecha y hora de última actualización |

---

### 2.2. TABLA: `persona_natural`
Atributos específicos de personas naturales.

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id_persona` | `UUID` | NO | PK, FK | Referencia a `persona(id_persona)` |
| `tipo_documento` | `VARCHAR(20)` | NO | | `DNI`, `CE`, `PASAPORTE` |
| `numero_documento` | `VARCHAR(20)` | NO | UQ | Número de documento de identidad |
| `nombres` | `VARCHAR(100)` | NO | | Nombres de la persona |
| `apellido_paterno` | `VARCHAR(100)` | NO | | Apellido paterno |
| `apellido_materno` | `VARCHAR(100)` | SI | | Apellido materno |
| `fecha_nacimiento` | `DATE` | SI | | Fecha de nacimiento |
| `sexo` | `CHAR(1)` | SI | | `M` / `F` |

---

### 2.3. TABLA: `persona_juridica`
Atributos específicos de personas jurídicas / organizaciones.

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id_persona` | `UUID` | NO | PK, FK | Referencia a `persona(id_persona)` |
| `ruc` | `VARCHAR(11)` | NO | UQ | Registro Único de Contribuyentes (11 dígitos) |
| `razon_social` | `VARCHAR(200)` | NO | | Razón social oficial |
| `nombre_comercial` | `VARCHAR(200)` | SI | | Nombre comercial |
| `estado_sunat` | `VARCHAR(30)` | SI | | Estado registrado en SUNAT |
| `condicion_sunat` | `VARCHAR(30)` | SI | | Condición del contribuyente en SUNAT |

---

### 2.4. TABLA: `representacion_legal`
Acredita la representación de una persona natural sobre una persona jurídica.

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id_representacion` | `UUID` | NO | PK | Identificador de la representación |
| `persona_juridica_id` | `UUID` | NO | FK | Referencia a `persona_juridica(id_persona)` |
| `persona_natural_id` | `UUID` | NO | FK | Referencia a `persona_natural(id_persona)` |
| `cargo` | `VARCHAR(100)` | NO | | Cargo o tipo de poder asignado |
| `partida_registral` | `VARCHAR(50)` | SI | | Número de partida registral (SUNARP) |
| `asiento_registral` | `VARCHAR(50)` | SI | | Asiento registral |
| `fecha_inicio` | `DATE` | NO | | Fecha de inicio de vigencia |
| `fecha_fin` | `DATE` | SI | | Fecha de fin de vigencia |
| `estado` | `VARCHAR(20)` | NO | | `VIGENTE`, `REVOCADO`, `VENCIDO` |

---

### 2.5. TABLA: `cuenta_usuario`
Credenciales y estado de acceso al sistema.

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id_cuenta` | `UUID` | NO | PK | Identificador de la cuenta |
| `persona_id` | `UUID` | NO | FK, UQ | Referencia a `persona(id_persona)` |
| `email` | `VARCHAR(150)` | NO | UQ | Correo electrónico de acceso |
| `password_hash` | `VARCHAR(255)` | NO | | Hash seguro de la contraseña |
| `estado_cuenta` | `VARCHAR(20)` | NO | | `ACTIVA`, `BLOQUEADA`, `PENDIENTE` |
| `mfa_activado` | `BOOLEAN` | NO | | Indicador de autenticación multifactor |
| `ultimo_acceso` | `TIMESTAMPTZ` | SI | | Registro de última sesión exitosa |

---

### 2.6. TABLA: `sesion_usuario`
Control de tokens de sesión e inicio de sesión.

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id_sesion` | `UUID` | NO | PK | Identificador de la sesión |
| `cuenta_id` | `UUID` | NO | FK | Referencia a `cuenta_usuario(id_cuenta)` |
| `refresh_token_hash` | `VARCHAR(255)` | NO | UQ | Hash del refresh token emitido |
| `ip_origen` | `VARCHAR(45)` | SI | | Dirección IP |
| `user_agent` | `TEXT` | SI | | Navegador/dispositivo de origen |
| `expira_en` | `TIMESTAMPTZ` | NO | | Expiración del token |
| `revocado` | `BOOLEAN` | NO | | Indicador de revocación manual/seguridad |

---

### 2.7. TABLA: `consentimiento_datos`
Registro de aceptación de políticas de privacidad y tratamiento de datos personales.

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id_consentimiento` | `UUID` | NO | PK | Identificador del consentimiento |
| `persona_id` | `UUID` | NO | FK | Referencia a `persona(id_persona)` |
| `version_politica` | `VARCHAR(20)` | NO | | Versión de los términos/políticas |
| `aceptado` | `BOOLEAN` | NO | | Visto bueno/aceptación explícita |
| `fecha_aceptacion` | `TIMESTAMPTZ` | NO | | Timestamp de auditoría de aceptación |

---

### 2.8. TABLA: `perfil_usuario`
Perfiles y roles asociados a las cuentas dentro de la plataforma.

| Columna | Tipo de Dato | Nulo | Clave | Descripción / Restricciones |
| :--- | :--- | :---: | :---: | :--- |
| `id_perfil` | `UUID` | NO | PK | Identificador del perfil |
| `cuenta_id` | `UUID` | NO | FK | Referencia a `cuenta_usuario(id_cuenta)` |
| `nombre_perfil` | `VARCHAR(50)` | NO | | Nombre o rol del perfil |
| `es_predeterminado` | `BOOLEAN` | NO | | Perfil activo por defecto |
| `creado_en` | `TIMESTAMPTZ` | NO | | Fecha de creación del perfil |
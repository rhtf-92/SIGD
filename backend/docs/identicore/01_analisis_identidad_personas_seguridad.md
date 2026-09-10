# Análisis de Identidad, Personas y Seguridad — Módulo IdentiCore v2.0

**Responsable:** Tapullima (`B_TAPULLIMA`)  
**Fecha:** 30 de agosto de 2026  
**Versión:** 2.0 — Modelo Polimórfico, Argon2id y Ley N° 29733

---

## 1. Clasificación Tripartita de Usuarios

### 1.1 Internos
- Funcionarios del IESTP "Suiza" con vínculo institucional directo.
- Poseen cuenta permanente (`tipo_usuario = INTERNO`, `condicion_registro = CON_CUENTA`).
- Acceso completo al sistema según roles asignados por OrganiCore (Grupo 3).

### 1.2 Externos Registrados (con Casilla Digital)
- Ciudadanos o empresas registrados que cuentan con Casilla Electrónica.
- Poseen cuenta permanente y consentimiento de notificaciones digitales.
- Pueden realizar trámites en línea y recibir notificaciones en su casilla.
- Se vinculan mediante `consentimiento_datos` (Ley N° 29733).

### 1.3 Externos Ventanilla
- Ciudadanos o empresas que atienden presencialmente sin cuenta permanente.
- No poseen `cuenta_usuario` (`condicion_registro = SIN_CUENTA`).
- Son atendidos por funcionarios internos que registran la intervención.
- Datos personales de consulta pública están ofuscados (`71****23`, `j****@gmail.com`).

---

## 2. Flujo de Validación de Representación Legal

### 2.1 Escenario: Persona Natural tramitando a nombre de Persona Jurídica
1. La persona natural (apoderado) presenta su DNI.
2. Se valida que existe un vínculo activo de representación legal (`representacion_legal.activo = TRUE`).
3. Se verifica la vigencia del poder (`vigencia_inicio ≤ fecha_actual ≤ vigencia_fin`).
4. Se permite la intervención en nombre de la persona jurídica.

### 2.2 Restricciones de Representación Legal
- Una persona natural puede representar a múltiples personas jurídicas (uno a muchos).
- Una persona jurídica puede tener múltiples representantes (muchos a uno).
- La relación es **1:1 por persona natural-jurídica vigente** (no duplicados).
- Representación vencida no permite trámites (verificación de vigencia).

### 2.3 Validaciones en Capas
| Capa | Validación | Nivel |
|---|---|---|
| Base de datos | CHECK en `numero_documento` (DNI 8 dígitos, RUC 11 dígitos) | SQL |
| Aplicación | Lógica de vigencia de representación | Código |
| Interfaz | Mensaje de error amigable al usuario | UI |

---

## 3. Requerimientos Legales de la Ley N° 29733 (Protección de Datos Personales)

### 3.1 Consentimiento de Datos
- Toda persona cuyos datos sean tratados debe dar consentimiento explícito.
- El consentimiento se registra en `sigd_auth.consentimiento_datos`:
  - `fecha_aceptacion`: fecha y hora exacta
  - `ip_address`: dirección IP del consentimiento
  - `version_termsoservicio`: versión de TOS aceptada
  - `aceptacion_notificaciones`: booleano (acepta notificaciones electrónicas)
  - `consentimiento_obfuscacion`: booleano (acepta ofuscación en consultas públicas)

### 3.2 Política de Ofuscación de Datos Personales
- En consultas públicas de trámites (ventanilla/web), los datos sensibles se ofuscan:
  - **DNI:** `71****23` (primeros 2 y últimos 2 dígitos visibles)
  - **Email:** `j****@gmail.com` (primer carácter, dominio completo)
  - **RUC:** `20123****` (primeros 4 y últimos 4 dígitos visibles)
- La ofuscación se aplica automáticamente cuando `consentimiento_obfuscacion = TRUE`.
- Los datos completos solo son accesibles por usuarios internos con autorización.

### 3.3 Control de Datos Personales
| Derecho | Implementación |
|---|---|
| Acceso | Endpoint de consulta con filtro de usuario |
| Rectificación | Edición de datos personales (con auditoría) |
| Cancelación | Baja lógica (`estado = FALSE`) |
| Oposición | Consentimiento revocable (`aceptacion_notificaciones = FALSE`) |

### 3.4 Restricciones
- No se almacenan contraseñas en texto plano (solo `password_hash` con Argon2id).
- Los refresh tokens nunca se registran en logs ni respuestas de API.
- Los datos de autenticación no forman parte de la identidad civil.

---

## 4. Matriz de Privacidad (Ofuscación)

| Campo | Formato Público | Formo Interno | Aplica Ofuscación |
|---|---|---|---|
| DNI | `71****23` | `71123456` | Sí |
| Email | `j****@gmail.com` | `juan.perez@email.com` | Sí |
| RUC | `20123****` | `20123456789` | Sí |
| Teléfono | `01****78` | `012345678` | Sí |
| Nombre | `Juan P*******` | `Juan Pérez García` | No |

**Nota:** La ofuscación se aplica solo en endpoints públicos; endpoints internos acceden a datos completos.

---

## 5. Estados de Cuenta

| Estado | Descripción | Transición |
|---|---|---|
| `ACTIVA` | Cuenta operativa normal | Estado inicial |
| `BLOQUEADA_TEMPORAL` | Bloqueada tras 5 intentos fallidos (lógica de aplicación; en BD solo existen `intentos_fallidos`/`bloqueado_hasta`) | Timeout de 15 min (pendiente de confirmación institucional: 15/30 min) |
| `INACTIVA` | Cuenta desactivada por administración | Reactivación manual |

> **Nota de alcance (coherencia con `03_esquema_sigd_auth_v2.sql`):** los estados funcionales son de aplicación. En PostgreSQL solo existen columnas `estado BOOLEAN` + `intentos_fallidos`/`bloqueado_hasta`; no hay trigger automático 5 intentos/15 min. `Externo Ventanilla` = `SIN_CUENTA` = externo no registrado funcionalmente.

---

## 6. Decisiones Documentadas

| ID | Decisión | Nivel |
|---|---|---|
| D-01 | Clasificación tripartita de usuarios | CONFIRMADO |
| D-02 | Representación legal 1:1 por relación natural-jurídica | CONFIRMADO |
| D-03 | Consentimiento con versiones controladas | CONFIRMADO |
| D-04 | Ofuscación automática en consultas públicas | CONFIRMADO |
| D-05 | Bloqueo temporal tras 5 intentos fallidos (lógica de aplicación; BD solo aporta columnas) | PROPUESTO |

---

## 7. Preguntas Pendientes

1. ¿Cuál es la versión oficial de términos de servicio que aceptan los usuarios?
2. ¿Cuál es el tiempo exacto de bloqueo temporal de cuenta (15 min, 30 min)?
3. ¿Existen formatos adicionales de documento de identidad (pasaporte, CE)?
4. ¿Se requiere verificación de vigencia SUNARP para representación legal?

---

**Firma:** _________________ Tapullima (`B_TAPULLIMA`)  
**Fecha:** _________________
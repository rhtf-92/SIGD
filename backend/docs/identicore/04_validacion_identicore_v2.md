# Validación Técnica IdentiCore v2.0

**Responsable:** Segundo (`B_SEGUNDO`)  
**Fecha:** 30 de agosto de 2026  
**Versión:** 2.0 — Modelo Polimórfico, Argon2id, Ley 29733

---

## 1. Objetivo

Validar la implementación del modelo polimórfico de identidad, la seguridad Argon2id en `sesion_usuario` y el cumplimiento de la Ley N° 29733 mediante `consentimiento_datos`.

---

## 2. Escenarios de Prueba

### 2.1 Registro de Persona Natural (DNI válido 8 dígitos)

```sql
-- Setup: Insert tipo documento DNI
INSERT INTO sigd_auth.tipos_documento (codigo, nombre) VALUES ('DNI', 'Documento Nacional de Identidad');

-- Test: Insert persona natural con DNI válido (8 dígitos)
INSERT INTO sigd_auth.persona (tipo_documento_id, numero_documento, nombres, apellido_paterno, apellido_materno, email_contacto)
VALUES (1, '12345678', 'Juan', 'Pérez', 'García', 'juan.perez@email.com');

-- Verificar: La restricción CHECK debe aceptar 8 dígitos
SELECT * FROM sigd_auth.persona WHERE numero_documento = '12345678';

-- Test: DNI inválido (7 dígitos) - DEBE FALLAR
INSERT INTO sigd_auth.persona (tipo_documento_id, numero_documento, nombres, apellido_paterno, email_contacto)
VALUES (1, '1234567', 'María', 'Gómez', 'maria.gomez@email.com');
-- ERROR: violates check constraint chk_persona_natural_dni_format
```

**Criterio de aceptación:** Solo DNI de exactamente 8 dígitos numéricos.

---

### 2.2 Registro de Persona Jurídica (RUC válido 11 dígitos)

```sql
-- Test: Insert persona jurídica con RUC válido (11 dígitos, empieza 10/15/17/20)
INSERT INTO sigd_auth.persona_juridica (persona_id, razon_social, nombre_comercial, partida_registral_sunarp)
VALUES (3, 'Empresa SAC', 'Empresa Comercial', 12345678);

-- Verificar: RUC válido (ej. 20123456789 - empieza en 20)
SELECT * FROM sigd_auth.persona_juridica WHERE razon_social = 'Empresa SAC';

-- Test: RUC inválido (no empieza en 10/15/17/20) - DEBE FALLAR
INSERT INTO sigd_auth.persona_juridica (persona_id, razon_social, nombre_comercial, partida_registral_sunarp)
VALUES (4, 'Empresa Invalida SAC', 'Empresa Invalida', 11111111);
-- ERROR: violates check constraint chk_persona_juridica_ruc_format
```

**Criterio de aceptación:** RUC de 11 dígitos que inicie con 10, 15, 17 o 20.

---

### 2.3 Representación Legal (Persona Natural → Persona Jurídica)

```sql
-- Setup: Persona natural y persona jurídica creadas
-- Test: Crear representación legal
INSERT INTO sigd_auth.representacion_legal (persona_natural_id, persona_juridica_id, vigencia_inicio, activo)
VALUES (1, 1, CURRENT_DATE, TRUE);

-- Verificar: Relación 1:1 vigente
SELECT * FROM sigd_auth.representacion_legal WHERE activo = TRUE;

-- Test: Intentar duplicar representación - DEBE FALLAR
INSERT INTO sigd_auth.representacion_legal (persona_natural_id, persona_juridica_id, vigencia_inicio, activo)
VALUES (1, 1, CURRENT_DATE, TRUE);
-- ERROR: violates unique constraint chk_rep_legal_one_to_one
```

**Criterio de aceptación:** Un representante natural por cada jurídica vigente.

---

### 2.4 Autenticación y Sesión (Argon2id)

```sql
-- Configuración Argon2id (documentada, no SQL):
-- memory: 64 MB (65536 KB)
-- iterations: 3
-- parallelism: 4
-- hash length: 32 bytes
-- salt length: 16 bytes

-- Test: Insertar sesión con refresh token válido
INSERT INTO sigd_auth.sesion_usuario (usuario_id, token_refresh, expires_at, ip_address, user_agent)
VALUES (1, 'a1b2c3d4e5f6789012345678901234567890abcdef12345678901234567890abcd', 
        NOW() + INTERVAL '7 days', '192.168.1.100', 'Mozilla/5.0...');

-- Verificar: Token de 64 caracteres hex (256 bits)
SELECT * FROM sigd_auth.sesion_usuario WHERE LENGTH(token_refresh) = 64;

-- Test: Token demasiado corto - DEBE FALLAR
INSERT INTO sigd_auth.sesion_usuario (usuario_id, token_refresh, expires_at)
VALUES (1, 'abc123', NOW() + INTERVAL '1 day');
-- ERROR: violates check constraint chk_sesion_token_length
```

**Criterio de aceptación:** Refresh tokens de 32-256 caracteres, expiración controlada, auditoría IP/UA.

---

### 2.5 Consentimiento de Datos (Ley N° 29733)

```sql
-- Test: Insertar consentimiento con versión válida
INSERT INTO sigd_auth.consentimiento_datos (usuario_id, ip_address, version_termsoservicio, aceptacion_notificaciones, consentimiento_obfuscacion)
VALUES (1, '192.168.1.1', 'v2.0', TRUE, TRUE);

-- Verificar: Registro con versión soportada
SELECT * FROM sigd_auth.consentimiento_datos WHERE version_termsoservicio = 'v2.0';

-- Test: Versión no soportada - DEBE FALLAR
INSERT INTO sigd_auth.consentimiento_datos (usuario_id, ip_address, version_termsoservicio, aceptacion_notificaciones, consentimiento_obfuscacion)
VALUES (2, '10.0.0.1', 'v9.9', TRUE, TRUE);
-- ERROR: violates check constraint chk_consent_data_types
```

**Criterio de aceptación:** Versiones controladas (v1.0, v1.1, v2.0), IP, aceptaciones booleanas.

---

### 2.6 Bloqueo de Cuenta (5 intentos fallidos)

```sql
-- Test: Incrementar intentos fallidos
UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos = 1 WHERE id = 1;
UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos = 2 WHERE id = 1;
UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos = 3 WHERE id = 1;
UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos = 4 WHERE id = 1;
UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos = 5 WHERE id = 1;

-- Verificar: Cuenta bloqueada tras 5 intentos
SELECT * FROM sigd_auth.cuenta_usuario WHERE intentos_fallidos >= 5 AND bloqueado_hasta IS NOT NULL;

-- Lógica de negocio (aplicación): bloquear_hasta = now() + interval '15 minutes'
```

**Criterio de aceptación:** Bloqueo temporal automático a 5 intentos.

---

## 3. Checklist de Validación

| ID | Validación | Estado | Evidencia |
|---|---|---|---|
| V-01 | CHECK DNI 8 dígitos en `persona_natural` | ⬜ | SQL test |
| V-02 | CHECK RUC 11 dígitos (10/15/17/20) en `persona_juridica` | ⬜ | SQL test |
| V-03 | UNIQUE representación legal 1:1 | ⬜ | SQL test |
| V-04 | `sesion_usuario` token 32-256 chars + IP/UA | ⬜ | SQL test |
| V-05 | `consentimiento_datos` versiones controladas | ⬜ | SQL test |
| V-06 | Bloqueo 5 intentos fallidos | ⬜ | SQL test |
| V-07 | Argon2id params documentados (memory:64MB, iter:3, parallel:4) | ⬜ | Doc |

---

## 4. Resultado Esperado

Todos los tests pasan → Modelo validado para integración en rama `B_SEGUNDO` y PR hacia `B_GERIC`.

---

**Firma Sublíder IdentiCore:** _________________ Segundo (`B_SEGUNDO`)  
**Fecha:** _________________
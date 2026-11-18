# Validación Técnica IdentiCore v2.0

**Responsable:** Segundo (`B_SEGUNDO`)  
**Fecha:** 30 de agosto de 2026  
**Versión:** 2.0 — Modelo Polimórfico, Argon2id, Ley 29733

---

## 1. Objetivo

Validar la implementación del modelo polimórfico de identidad, el almacenamiento de credenciales con hash Argon2id en `cuenta_usuario`, los tokens en `sesion_usuario` y el cumplimiento de la Ley N° 29733 mediante `consentimiento_datos`.

---

## 2. Escenarios de Prueba

### 2.1 Registro de Persona Natural (DNI válido 8 dígitos)

```sql
-- Setup: Insert tipo documento DNI
INSERT INTO sigd_auth.tipos_documento (codigo, nombre) VALUES ('DNI', 'Documento Nacional de Identidad');

-- Test: Insert persona base NATURAL con DNI válido (8 dígitos).
-- NOTA: `persona` NO valida formato DNI; `chk_persona_ruc_format` solo se activa cuando tipo_persona = 'JURIDICA'.
INSERT INTO sigd_auth.persona (tipo_documento_id, numero_documento, nombres, apellido_paterno, apellido_materno, email_contacto, tipo_persona)
VALUES (1, '12345678', 'Juan', 'Pérez', 'García', 'juan.perez@email.com', 'NATURAL');

-- Test: Extensión polimórfica en persona_natural (aquí sí aplica el formato DNI)
INSERT INTO sigd_auth.persona_natural (persona_id, numero_documento, nombres, apellido_paterno, apellido_materno, email_contacto, estado)
VALUES (1, '12345678', 'Juan', 'Pérez', 'García', 'juan.perez@email.com', TRUE);

-- Verificar: La restricción CHECK de persona_natural debe aceptar 8 dígitos
SELECT * FROM sigd_auth.persona_natural WHERE numero_documento = '12345678';

-- Test: DNI inválido (7 dígitos) en persona_natural - DEBE FALLAR
INSERT INTO sigd_auth.persona_natural (persona_id, numero_documento, nombres, apellido_paterno, email_contacto, estado)
VALUES (1, '1234567', 'María', 'Gómez', 'maria.gomez@email.com', TRUE);
-- ERROR: violates check constraint chk_persona_natural_dni_format
```

**Criterio de aceptación:** Solo DNI de exactamente 8 dígitos numéricos, validado en `persona_natural` (no en `persona`).

**Estado:** NO EJECUTADA.

---

### 2.2 Registro de Persona Jurídica (RUC válido 11 dígitos)

```sql
-- Setup: Insert tipo documento RUC
INSERT INTO sigd_auth.tipos_documento (codigo, nombre) VALUES ('RUC', 'Registro Único de Contribuyentes');

-- Test: Insert persona base JURIDICA con RUC válido (11 dígitos, empieza 10/15/17/20).
-- NOTA: el RUC vive en `persona.numero_documento` (persona_juridica NO tiene columna numero_documento).
-- La validación la aplica `chk_persona_ruc_format` solo cuando tipo_persona = 'JURIDICA'.
INSERT INTO sigd_auth.persona (tipo_documento_id, numero_documento, nombres, apellido_paterno, apellido_materno, email_contacto, tipo_persona)
VALUES (4, '20123456789', 'Empresa de Prueba S.A.C.', 'Prueba', NULL, 'contacto@empresaprueba.com', 'JURIDICA');

-- Test: Extensión polimórfica en persona_juridica (sin numero_documento: solo razón social y datos registrales)
INSERT INTO sigd_auth.persona_juridica (persona_id, razon_social, nombre_comercial, partida_registral_sunarp, estado)
VALUES (3, 'Empresa de Prueba S.A.C.', 'Prueba S.A.C.', 11223344, TRUE);

-- Verificar: RUC válido almacenado en persona (ej. 20123456789 - empieza en 20)
SELECT * FROM sigd_auth.persona WHERE numero_documento = '20123456789' AND tipo_persona = 'JURIDICA';

-- Test: RUC inválido (no empieza en 10/15/17/20) con tipo_persona = 'JURIDICA' - DEBE FALLAR
INSERT INTO sigd_auth.persona (tipo_documento_id, numero_documento, nombres, apellido_paterno, email_contacto, tipo_persona)
VALUES (4, '99123456789', 'Empresa Invalida SAC', 'Prueba', 'contacto@invalida.com', 'JURIDICA');
-- ERROR: violates check constraint chk_persona_ruc_format
```

**Criterio de aceptación:** RUC de 11 dígitos que inicie con 10, 15, 17 o 20, validado en `persona.numero_documento` cuando `tipo_persona = 'JURIDICA'`.

**NOTA DE ALCANCE:** la BD valida formato/prefijo y longitud mediante expresión regular. Esto NO equivale a validación oficial SUNAT ni cálculo/verificación del dígito verificador.

**Estado:** NO EJECUTADA.

---

### 2.3 Representación Legal (Persona Natural → Persona Jurídica)

```sql
-- Setup: Persona natural y persona jurídica creadas
-- Test: Crear representación legal
INSERT INTO sigd_auth.representacion_legal (persona_natural_id, persona_juridica_id, vigencia_inicio, activo)
VALUES (1, 1, CURRENT_DATE, TRUE);

-- Verificar: Relación vigente
SELECT * FROM sigd_auth.representacion_legal WHERE activo = TRUE;

-- Test: Intentar duplicar la misma dupla (natural, jurídica) - DEBE FALLAR
INSERT INTO sigd_auth.representacion_legal (persona_natural_id, persona_juridica_id, vigencia_inicio, activo)
VALUES (1, 1, CURRENT_DATE, TRUE);
-- ERROR: violates unique constraint uq_rep_legal_natural_juridica

-- Test: vigencia_fin anterior a vigencia_inicio - DEBE FALLAR
INSERT INTO sigd_auth.representacion_legal (persona_natural_id, persona_juridica_id, vigencia_inicio, vigencia_fin, activo)
VALUES (1, 1, CURRENT_DATE, CURRENT_DATE - INTERVAL '1 day', TRUE);
-- ERROR: violates check constraint chk_rep_legal_vigencia
```

**Criterio de aceptación:** Unicidad de la dupla (persona_natural_id, persona_juridica_id) y coherencia de vigencias (`vigencia_fin >= vigencia_inicio`).

**Estado:** NO EJECUTADA.

---

### 2.4 Autenticación y Sesión (Argon2id)

```sql
-- Configuración Argon2id (documentada, no SQL; el hash se almacena en cuenta_usuario.password_hash):
-- memory: 64 MB (65536 KB)
-- iterations: 3
-- parallelism: 4
-- hash length: 32 bytes
-- salt length: 16 bytes

-- Setup: cuenta vinculada a persona (FK fk_cuenta_usuario_persona; UNIQUE en username y email_login)
INSERT INTO sigd_auth.cuenta_usuario (persona_id, username, email_login, password_hash, estado)
VALUES (1, 'fprueba_int', 'funcionario.prueba@sigd.gob.pe', '$argon2id$v=19$m=65536,t=3,p=4$...', TRUE);

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

**Criterio de aceptación:** Refresh tokens de 32-255 caracteres (`chk_sesion_token_length`), expiración controlada, auditoría IP/UA.

**NOTA DE ALCANCE:** la rotación de refresh tokens y la detección de reuso se implementan en la capa de aplicación (ver comentario del catálogo en SQL); la BD solo almacena el token y su expiración.

**Estado:** NO EJECUTADA.

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

**NOTA DE ALCANCE:** la BD registra el consentimiento (estructura, versión y evidencia de IP/fecha). El cumplimiento jurídico de la Ley N° 29733 es procedimental y excede lo demostrable con el CHECK.

**Estado:** NO EJECUTADA.

---

### 2.6 Bloqueo de Cuenta (intentos fallidos)

```sql
-- Test: Incrementar intentos fallidos (la BD solo garantiza intentos_fallidos >= 0 vía chk_cuenta_intentos)
UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos = 1 WHERE id = 1;
UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos = 2 WHERE id = 1;
UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos = 3 WHERE id = 1;
UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos = 4 WHERE id = 1;
UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos = 5 WHERE id = 1;

-- Verificar: contador persistido
SELECT id, intentos_fallidos, bloqueado_hasta FROM sigd_auth.cuenta_usuario WHERE id = 1;

-- Test: intentos_fallidos negativo - DEBE FALLAR
UPDATE sigd_auth.cuenta_usuario SET intentos_fallidos = -1 WHERE id = 1;
-- ERROR: violates check constraint chk_cuenta_intentos

-- Lógica de negocio (aplicación, PENDIENTE en BD): tras 5 intentos, fijar bloqueado_hasta = now() + interval '15 minutes'.
```

**Criterio de aceptación:** La BD valida `intentos_fallidos >= 0`. El bloqueo automático (5 intentos / 15 minutos) es lógica de aplicación: PENDIENTE, no implementado en PostgreSQL.

**Estado:** NO EJECUTADA (BD) / PENDIENTE (lógica de aplicación).

---

## 3. Casos de Validación

### V-01 Persona Natural

- **Objetivo:** verificar que `persona` base NATURAL se crea sin validación de formato DNI y que `persona_natural` acepta solo DNI de 8 dígitos.
- **Precondiciones:** existe `tipos_documento` con código `DNI`.
- **Procedimiento:** escenario 2.1 (INSERT en `persona` con `tipo_persona = 'NATURAL'` + extensión en `persona_natural`; caso negativo con 7 dígitos).
- **Resultado esperado:** el INSERT base es aceptado; la extensión con 7 dígitos falla con `chk_persona_natural_dni_format`.
- **Evidencia:** restricción `chk_persona_natural_dni_format` existe en SQL (§3 del esquema). Prueba no ejecutada contra BD real.
- **Estado:** NO EJECUTADA.

### V-02 Persona Jurídica

- **Objetivo:** verificar que el RUC se valida en `persona.numero_documento` cuando `tipo_persona = 'JURIDICA'` y que `persona_juridica` no almacena documento.
- **Precondiciones:** existe `tipos_documento` con código `RUC`.
- **Procedimiento:** escenario 2.2 (INSERT en `persona` con RUC `20123456789` + extensión en `persona_juridica`; caso negativo con prefijo `99`).
- **Resultado esperado:** el RUC válido es aceptado; el prefijo inválido falla con `chk_persona_ruc_format`. La BD valida formato/prefijo/longitud por regex; NO equivale a validación oficial SUNAT ni dígito verificador.
- **Evidencia:** restricción `chk_persona_ruc_format` existe en SQL (§2 del esquema) y es la única validación RUC vigente. Prueba no ejecutada contra BD real.
- **Estado:** NO EJECUTADA.

### V-03 Especialización

- **Objetivo:** verificar que `persona_natural` y `persona_juridica` referencian correctamente a `persona` vía `persona_id`.
- **Precondiciones:** existen filas base en `persona` (NATURAL y JURIDICA).
- **Procedimiento:** escenarios 2.1 y 2.2 (INSERT de extensiones con `persona_id` existente; caso negativo con `persona_id` inexistente debe fallar por FK).
- **Resultado esperado:** extensiones aceptadas con `persona_id` válido; rechazo por `fk_persona_natural_persona` / `fk_persona_juridica_persona` con `persona_id` inexistente.
- **Evidencia:** FK existentes en SQL (§3 y §4 del esquema). Prueba no ejecutada contra BD real.
- **Estado:** NO EJECUTADA.

### V-04 Representación Legal

- **Objetivo:** verificar unicidad de la dupla y coherencia de vigencias.
- **Precondiciones:** existen `persona_natural.id = 1` y `persona_juridica.id = 1`.
- **Procedimiento:** escenario 2.3 (INSERT válido; duplicado de la dupla; `vigencia_fin` anterior a `vigencia_inicio`).
- **Resultado esperado:** duplicado falla con `uq_rep_legal_natural_juridica`; vigencia incoherente falla con `chk_rep_legal_vigencia`.
- **Evidencia:** constraints `uq_rep_legal_natural_juridica` y `chk_rep_legal_vigencia` existen en SQL (§5 del esquema). Prueba no ejecutada contra BD real.
- **Estado:** NO EJECUTADA.

### V-05 Cuenta / Sesión

- **Objetivo:** verificar vínculo cuenta→persona, unicidades de credenciales, `intentos_fallidos >= 0` y longitud del refresh token.
- **Precondiciones:** existe `persona.id = 1`.
- **Procedimiento:** escenario 2.4 (INSERT en `cuenta_usuario`; INSERT en `sesion_usuario` con token de 64 caracteres; caso negativo con token de 6 caracteres).
- **Resultado esperado:** cuenta y sesión aceptadas; token corto falla con `chk_sesion_token_length` (rango real 32–255); `intentos_fallidos` negativo falla con `chk_cuenta_intentos`. Rotación de refresh tokens y detección de reuso: lógica de aplicación, PENDIENTE.
- **Evidencia:** `fk_cuenta_usuario_persona`, `uq_cuenta_username`, `uq_cuenta_email_login`, `chk_cuenta_intentos`, `fk_sesion_usuario_usuario`, `chk_sesion_token_length` existen en SQL (§7–§8 del esquema). Prueba no ejecutada contra BD real.
- **Estado:** NO EJECUTADA (BD) / PENDIENTE (rotación y reuso en aplicación).

### V-06 Consentimiento

- **Objetivo:** verificar que solo se registran versiones de términos soportadas.
- **Precondiciones:** existe `cuenta_usuario.id` válido.
- **Procedimiento:** escenario 2.5 (INSERT con `v2.0`; caso negativo con `v9.9`).
- **Resultado esperado:** `v2.0` aceptada; `v9.9` falla con `chk_consent_data_types`. La BD registra el consentimiento; el cumplimiento jurídico de la Ley N° 29733 es procedimental y excede el CHECK.
- **Evidencia:** `chk_consent_data_types` (`v1.0`, `v1.1`, `v2.0`) existe en SQL (§9 del esquema). Prueba no ejecutada contra BD real.
- **Estado:** NO EJECUTADA (BD) / PENDIENTE (cumplimiento jurídico integral).

### V-07 Seguridad / Bloqueo

- **Objetivo:** distinguir restricciones implementadas en BD de lógica de aplicación.
- **Precondiciones:** existe `cuenta_usuario.id = 1`.
- **Procedimiento:** escenario 2.6 (incremento de `intentos_fallidos`; caso negativo con valor `-1`).
- **Resultado esperado:** la BD solo garantiza `intentos_fallidos >= 0` (`chk_cuenta_intentos`). El bloqueo automático (5 intentos / 15 minutos), Argon2id real en aplicación, JWT RS256 y ofuscación de datos NO están implementados en PostgreSQL.
- **Evidencia:** `chk_cuenta_intentos` existe en SQL (§7 del esquema). No existe ningún constraint de bloqueo temporal ni de conteo máximo.
- **Estado:** NO EJECUTADA (BD) / PENDIENTE (bloqueo, Argon2id/JWT/ofuscación en aplicación).

---

## 4. Resultado Esperado

Tras ejecutar los casos V-01…V-07 y obtener resultado conforme en cada uno, el modelo queda validado para integración en rama `B_SEGUNDO` y PR hacia `B_GERIC`.

**Estado actual:** pruebas NO EJECUTADAS contra BD real; los casos documentan el procedimiento y el resultado esperado a partir de las restricciones existentes en SQL.

---

**Firma Sublíder IdentiCore:** _________________ Segundo (`B_SEGUNDO`)  
**Fecha:** _________________
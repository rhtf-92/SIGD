# Justificación técnica: migración 02 y semilla de notificación

## Alcance

Este documento explica la única corrección conservada en `02_sigd_auth.sql`. El cambio no altera tablas, restricciones, índices ni contratos de autenticación; únicamente corrige una fila semilla destinada a pruebas y desarrollo.

## Problema original

La semilla de `sigd_auth.notificacion_casilla` asignaba `usuario_id = '00000000-0000-0000-0000-000000000001'`. Ninguna sentencia anterior de la secuencia de migraciones crea una fila con ese identificador en `sigd_auth.cuenta_usuario`.

Como `notificacion_casilla.usuario_id` tiene una clave foránea inmediata hacia `cuenta_usuario.id_usuario`, una instalación sobre una base vacía termina con SQLSTATE `23503` al insertar la semilla. La notificación de ejemplo no necesita un propietario para cumplir su propósito y la columna admite `NULL`; por eso la corrección utiliza `usuario_id = NULL`.

## Evaluación de una migración incremental

No es posible trasladar íntegramente esta corrección a una migración incremental sin dejar roto el arranque desde cero. PostgreSQL interrumpe la ejecución en la migración 02 por la violación de clave foránea y nunca alcanza una migración posterior que pudiera reparar el dato.

Crear artificialmente el UUID esperado tampoco es apropiado: introduciría una cuenta técnica sin persona, credenciales ni roles solamente para satisfacer una semilla de demostración.

## Decisión

Se conserva la modificación mínima en la migración 02:

- La semilla mantiene su identificador y contenido deterministas.
- `usuario_id` se establece en `NULL`, valor permitido por el contrato existente.
- No hay cambios de estructura ni se reescriben filas productivas ya migradas.
- Las pruebas de contrato verifican que la semilla sea compatible con una base vacía.

Esta excepción queda explícitamente documentada para revisión. Cualquier política futura que prohíba modificar migraciones históricas deberá acompañarse de una corrección del proceso de bootstrap, porque una migración incremental por sí sola no puede resolver este fallo previo.

## Compatibilidad del checksum histórico

El runner registra el SHA-256 de cada migración. Por ello, una instalación que hubiera conseguido registrar la versión anterior de `02_sigd_auth.sql` —por ejemplo, porque el UUID referenciado fue creado manualmente antes del bootstrap— detectaría el cambio de contenido aunque su esquema sea compatible.

El runner incorpora una reconciliación limitada a esta transición conocida:

- solo acepta los checksums exactos, LF y CRLF, de la versión anterior;
- solo los reconcilia contra los checksums exactos de la versión corregida;
- antes de actualizar el registro verifica que `sigd_auth.notificacion_casilla.usuario_id` sea nullable y conserve su clave foránea hacia `sigd_auth.cuenta_usuario`;
- cualquier otro cambio o contrato incompleto mantiene el error de integridad DDL.

De esta forma se preserva la detección general de migraciones alteradas sin bloquear una instalación que ya hubiera registrado específicamente la semilla defectuosa.

## Límites del PR #166

- `06_sigd_rut.sql` y `07_sigd_reportes.sql` permanecen sin modificaciones respecto de `F_BARTRA`.
- El hallazgo independiente de RutaDoc permanece documentado en `2026-10-12-migracion-06-rutadoc.md`.
- Este PR no modifica lógica de RutaDoc ni Reportes.

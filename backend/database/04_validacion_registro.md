# SIGD · Grupo 2 "TramiCore" — Casos de Prueba y Validaciones de Registro

Este documento detalla los casos reales de prueba y scripts de validación ejecutados sobre PostgreSQL para asegurar la integridad referencial, restricciones y reglas de negocio del módulo de Trámite, Expediente y Asiento de Registro.

---

## 1. Consulta de Verificación General
Valida la vinculación completa entre Trámites, Expedientes y Asientos de Registro en el Libro General.

```sql
SELECT 
    t.id_tramite,
    t.codigo_tramite,
    e.codigo_expediente,
    a.numero_registro AS asiento_global,
    a.canal_ingreso,
    t.asunto,
    t.estado,
    a.anulado AS es_borrado_logico,
    a.motivo_anulacion
FROM tramite t
JOIN expediente e ON e.fk_tramite = t.id_tramite
JOIN asiento_registro a ON a.fk_expediente = e.id_expediente
ORDER BY a.numero_registro ASC;
```

---

## 2. Prueba de Duplicidad de Código de Expediente
**Objetivo:** Verificar que la restricción `UNIQUE` impida la creación de dos expedientes con el mismo código visible de negocio.

```sql
-- Debe fallar por violación de restricción UNIQUE (codigo_expediente)
INSERT INTO expediente (codigo_expediente, fk_tramite) 
VALUES ('EXP-2026-000001', 3);
```
* **Resultado Esperado:** `ERROR: duplicate key value violates unique constraint "expediente_codigo_expediente_key"`

---

## 3. Prueba de Concurrencia y Unicidad de `numero_registro`
**Objetivo:** Validar que la secuencia explícita garantiza asignación atómica y sin bloqueos o duplicaciones en inserciones concurrentes masivas.

```sql
-- Generación concurrente simulada de dos registros en la misma transacción/sesión
INSERT INTO asiento_registro (canal_ingreso, asunto, fk_expediente, fk_remitente, fk_destinatario)
VALUES ('MESA_VIRTUAL', 'Solicitud A', 1, 101, 301),
       ('MESA_PRESENCIAL', 'Solicitud B', 2, 102, 302);

-- Intento de forzar manualmente un número de registro ya asignado por la secuencia (debe fallar)
INSERT INTO asiento_registro (numero_registro, canal_ingreso, asunto, fk_expediente, fk_remitente, fk_destinatario)
VALUES (10001, 'MESA_PRESENCIAL', 'Intento forzado', 3, 101, 301);
```
* **Resultado Esperado:** `ERROR: duplicate key value violates unique constraint "asiento_registro_numero_registro_key"`

---

## 4. Prueba de Clave Inexistente (FK Rota / Integridad Referencial)
**Objetivo:** Comprobar que no se pueda registrar un expediente o asiento enlazado a un trámite o expediente que no exista.

```sql
-- Debe fallar porque no existe el tramite id = 9999
INSERT INTO expediente (codigo_expediente, fk_tramite) 
VALUES ('EXP-2026-999999', 9999);
```
* **Resultado Esperado:** `ERROR: insert or update on table "expediente" violates foreign key constraint "fk_expediente_tramite"`

---

## 5. Prueba de Estados y Transiciones (Corrección y Reapertura)
**Objetivo:** Validar el cambio de estado de un trámite durante la subsanación/corrección de observaciones y su posterior reapertura tras el cierre.

```sql
-- A. Transición a estado OBSERVADO y corrección/subsanación
UPDATE tramite SET estado = 'OBSERVADO', actualizado_en = CURRENT_TIMESTAMP WHERE id_tramite = 2;
UPDATE tramite SET estado = 'EN_TRAMITE', actualizado_en = CURRENT_TIMESTAMP WHERE id_tramite = 2;

-- B. Transición a estado CERRADO y posterior REAPERTURA
UPDATE tramite SET estado = 'CERRADO', actualizado_en = CURRENT_TIMESTAMP WHERE id_tramite = 1;
UPDATE tramite SET estado = 'REABIERTO', actualizado_en = CURRENT_TIMESTAMP WHERE id_tramite = 1;

-- C. Intento de asignar estado no permitido (Debe fallar por restricción CHECK)
INSERT INTO tramite (codigo_tramite, asunto, estado, fk_remitente) 
VALUES ('TRM-2026-9999', 'Prueba estado invalido', 'APROBADO_DIRECTO', 101);
```
* **Resultado Esperado:** Transiciones A y B exitosas; intento C falla con `ERROR: new row for relation "tramite" violates check constraint "chk_tramite_estado"`.

---

## 6. Prueba de Anulación Conservando la Historia (Borrado Lógico)
**Objetivo:** Validar que la anulación conserve intacta la fila con `anulado = true` y su `motivo_anulacion` sin ejecutar comandos `DELETE`.

```sql
-- Ejecución del borrado lógico registrando la causa formal
UPDATE asiento_registro 
SET anulado = TRUE, motivo_anulacion = 'Anulado por duplicidad en la recepción física del documento'
WHERE id_asiento = 1;

-- Verificación de inmutabilidad y auditoría
SELECT id_asiento, numero_registro, asunto, anulado, motivo_anulacion 
FROM asiento_registro 
WHERE id_asiento = 1;
```
* **Resultado Esperado:** El registro no se elimina de la base de datos; permanece auditable con `anulado = true` y su respectivo motivo.
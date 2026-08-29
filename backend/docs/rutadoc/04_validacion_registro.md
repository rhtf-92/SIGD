# Documentos de Trabajo Grupo 2 — Casos de Prueba y Validaciones de Registro

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
    a.anulado AS es_borrado_logico
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

## 3. Prueba de Unicidad de `numero_registro` (Secuencia Autogenerada)
**Objetivo:** Validar que el Libro de Registro genera correlativos atómicos únicos mediante la secuencia `seq_asiento_numero_registro` sin permitir duplicación manual.

```sql
-- Debe fallar al intentar forzar un número de registro ya asignado por la secuencia (ej. 10001)
INSERT INTO asiento_registro (numero_registro, canal_ingreso, asunto, fk_expediente, fk_remitente, fk_destinatario)
VALUES (10001, 'MESA_PRESENCIAL', 'Intento de forzar numero de registro', 3, 101, 301);
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

## 5. Prueba de Estado Inválido (Restricción CHECK)
**Objetivo:** Confirmar que no se puedan ingresar estados no permitidos por la directiva institucional.

```sql
-- Debe fallar porque 'APROBADO_DIRECTO' no existe en el CHECK constraint
INSERT INTO tramite (codigo_tramite, asunto, estado, fk_remitente) 
VALUES ('TRM-2026-9999', 'Prueba estado no valido', 'APROBADO_DIRECTO', 101);
```
* **Resultado Esperado:** `ERROR: new row for relation "tramite" violates check constraint "chk_tramite_estado"`

---

## 6. Prueba de Anulación Conservando el Registro (Borrado Lógico)
**Objetivo:** Validar que un asiento anulado se marque como `anulado = true` y mantenga la inmutabilidad y trazabilidad sin aplicar comandos `DELETE`.

```sql
-- Ejecución de borrado lógico
UPDATE asiento_registro 
SET anulado = TRUE, motivo_anulacion = 'Anulado por duplicidad en recepción física'
WHERE id_asiento = 1;

-- Verificación de conservación de historial en auditoría
SELECT id_asiento, numero_registro, asunto, anulado, motivo_anulacion 
FROM asiento_registro 
WHERE id_asiento = 1;
```
* **Resultado Esperado:** El registro permanece intacto en la base de datos con `anulado = true` y su motivo registrado, demostrando inmutabilidad del Libro de Registros.
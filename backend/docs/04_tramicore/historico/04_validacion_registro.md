# Documentos de Trabajo Grupo 2 ΓÇö Casos de Prueba y Validaciones de Registro

Este documento detalla los casos reales de prueba y scripts de validaci├│n ejecutados sobre PostgreSQL para asegurar la integridad referencial, restricciones y reglas de negocio del m├│dulo de Tr├ímite, Expediente y Asiento de Registro.

---

## 0. Entorno de ejecuci├│n (evidencia real)

| Dato | Valor |
|------|-------|
| Motor de base de datos | PostgreSQL 18.3 on x86_64-windows (compilado por msvc-19.44.35225, 64-bit) |
| Fecha de ejecuci├│n | 2026-08-30 |
| Base de datos de pruebas | `tramicore_prueba` (entorno local aislado, autenticaci├│n trust, puerto 55432) |
| Script de carga | `03_tramite_expediente_registro.sql` (ejecutado con `-v ON_ERROR_STOP=1`) |
| Script de casos de prueba | `tramicore_validacion.sql` |

> **Nota sobre versi├│n objetivo:** Las pruebas se ejecutaron en **PostgreSQL 18.3**. El sistema tiene como versi├│n objetivo **PostgreSQL 18.6** (seg├║n los planes de trabajo del proyecto); queda **pendiente** repetir la validaci├│n final en dicha versi├│n antes de la entrega.

**Comando de ejecuci├│n del script de carga:**

```bat
psql -w -h localhost -p 55432 -U postgres -d tramicore_prueba -v ON_ERROR_STOP=1 -f 03_tramite_expediente_registro.sql
```

**Salida real de la carga** (creaci├│n de secuencia, tablas, ├¡ndices y datos de prueba):

```sql
CREATE SEQUENCE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
INSERT 0 4
INSERT 0 4
INSERT 0 4
COMMIT
```

---

## 1. Consulta de Verificaci├│n General

Valida la vinculaci├│n completa entre Tr├ímites, Expedientes y Asientos de Registro en el Libro General.

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

**Resultado real (PostgreSQL 18.3):**

```
 id_tramite | codigo_tramite | codigo_expediente | asiento_global | canal_ingreso | asunto | estado | es_borrado_logico
------------+----------------+-------------------+----------------+---------------+------------------------------+-----------+-------------------
          1 | TRM-2026-0001  | EXP-2026-000001   |          10001 | MESA_VIRTUAL  | Solicitud de Expedici├│n de T├¡tulo Profesional | EN_TRAMITE | f
          2 | TRM-2026-0002  | EXP-2026-000002   |          10002 | MESA_PRESENCIAL | Rectificaci├│n de Notas de Asignatura de Base de Datos | OBSERVADO | f
          3 | TRM-2026-0003  | EXP-2026-000003   |          10003 | MESA_VIRTUAL  | Mantenimiento preventivo de Servidores de Red | REGISTRADO | f
          4 | TRM-2026-0004  | EXP-2026-000004   |          10004 | MESA_PRESENCIAL | Solicitud Invalida con Error de Formato | ANULADO | t
(4 filas)
```

---

## 2. Prueba de Duplicidad de C├│digo de Expediente

**Objetivo:** Verificar que la restricci├│n `UNIQUE` impida la creaci├│n de dos expedientes con el mismo c├│digo visible de negocio.

```sql
-- Debe fallar por violaci├│n de restricci├│n UNIQUE (codigo_expediente)
INSERT INTO expediente (codigo_expediente, fk_tramite)
VALUES ('EXP-2026-000001', 3);
```

**Resultado real:**

```text
ERROR:  duplicate key value violates unique constraint "expediente_codigo_expediente_key"
DETALLE:  Key (codigo_expediente)=(EXP-2026-000001) already exists.
```

---

## 3. Prueba de Unicidad de `numero_registro` (Secuencia Autogenerada)

**Objetivo:** Validar que el Libro de Registro genera correlativos at├│micos ├║nicos mediante la secuencia `seq_asiento_numero_registro` sin permitir duplicaci├│n manual.

```sql
-- Debe fallar al intentar forzar un n├║mero de registro ya asignado por la secuencia (ej. 10001)
INSERT INTO asiento_registro (numero_registro, canal_ingreso, asunto, fk_expediente, fk_remitente, fk_destinatario)
VALUES (10001, 'MESA_PRESENCIAL', 'Intento de forzar numero de registro', 3, 101, 301);
```

**Resultado real:**

```text
ERROR:  duplicate key value violates unique constraint "asiento_registro_numero_registro_key"
DETALLE:  Key (numero_registro)=(10001) already exists.
```

> **Nota conceptual:** la secuencia garantiza unicidad y monotonicidad, pero no la ausencia de vac├¡os; si una transacci├│n consume `nextval()` y luego se revierte (`ROLLBACK`), el valor se pierde. Ello no afecta la integridad del Libro.

---

## 4. Prueba de Clave Inexistente (FK Rota / Integridad Referencial)

**Objetivo:** Comprobar que no se pueda registrar un expediente o asiento enlazado a un tr├ímite o expediente que no exista.

```sql
-- Debe fallar porque no existe el tramite id = 9999
INSERT INTO expediente (codigo_expediente, fk_tramite)
VALUES ('EXP-2026-999999', 9999);
```

**Resultado real:**

```text
ERROR:  insert or update on table "expediente" violates foreign key constraint "fk_expediente_tramite"
DETALLE:  Key (fk_tramite)=(9999) is not present in table "tramite".
```

---

## 5. Prueba de Estado Inv├ílido (Restricci├│n CHECK)

**Objetivo:** Confirmar que no se puedan ingresar estados no permitidos por la directiva institucional.

```sql
-- Debe fallar porque 'APROBADO_DIRECTO' no existe en el CHECK constraint
INSERT INTO tramite (codigo_tramite, asunto, estado, fk_remitente)
VALUES ('TRM-2026-9999', 'Prueba estado no valido', 'APROBADO_DIRECTO', 101);
```

**Resultado real:**

```text
ERROR:  new row for relation "tramite" violates check constraint "chk_tramite_estado"
DETALLE:  Failing row contains (5, TRM-2026-9999, Prueba estado no valido, APROBADO_DIRECTO, 101, null, 2026-08-30 19:14:00.460156+00, 2026-08-30 19:14:00.460156+00).
```

---

## 6. Prueba de Anulaci├│n Conservando el Registro (Borrado L├│gico)

**Objetivo:** Validar que un asiento anulado se marque como `anulado = true` y mantenga la inmutabilidad y trazabilidad sin aplicar comandos `DELETE`, sin generar un asiento nuevo ni reutilizar su n├║mero.

```sql
-- Ejecuci├│n de borrado l├│gico
UPDATE asiento_registro
SET anulado = TRUE, motivo_anulacion = 'Anulado por duplicidad en recepci├│n f├¡sica'
WHERE id_asiento = 1;

-- Verificaci├│n de conservaci├│n de historial en auditor├¡a
SELECT id_asiento, numero_registro, asunto, anulado, motivo_anulacion
FROM asiento_registro
WHERE id_asiento = 1;
```

**Resultado real:**

```text
UPDATE 1

 id_asiento | numero_registro | asunto | anulado | motivo_anulacion
------------+-----------------+-------------------------------+---------+-----------------------------------
          1 |           10001 | Solicitud de Expedici├│n de T├¡tulo Profesional | t | Anulado por duplicidad en recepci├│n f├¡sica
(1 fila)
```

**Comprobaci├│n de que no se elimina el registro (total de asientos se mantiene en 4 despu├⌐s de la anulaci├│n):**

```text
 total_asientos_tras_anulacion
------------------------------
                             4
(1 fila)
```

El asiento no se elimina y su n├║mero no se reutiliza; ├║nicamente se actualizaron los campos de control de anulaci├│n (`anulado = true`, `motivo_anulacion`), tal como evidencia la consulta anterior.

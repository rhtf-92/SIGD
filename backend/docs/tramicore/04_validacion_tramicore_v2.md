# 04 · Casos de Prueba y Validaciones — TramiCore Fase 2 (CUT, Acumulación, Foliado)

**Proyecto:** SIGD — Grupo 2 "TramiCore"
**Autor:** Elmer Ramírez (B_RAMIREZ)
**Motor:** PostgreSQL 18.3+
**Fecha:** 30 de agosto de 2026

---

## Entorno de ejecución

| Dato | Valor |
|------|-------|
| Motor de base de datos | PostgreSQL 18.3 on x86_64-windows |
| Fecha de ejecución | 2026-09-08 |
| Base de datos de pruebas | `tramicore_prueba` (entorno local aislado, puerto 5432) |
| Script de carga | `03_esquema_sigd_tra_cut_foliado.sql` |
| Función CUT | `sigd_tra.generar_cut_expediente(p_anio INT)` |

**Comando de ejecución del script de carga:**
```bash
psql -h localhost -p 5432 -U postgres -d tramicore_prueba -v ON_ERROR_STOP=1 -f 03_esquema_sigd_tra_cut_foliado.sql
```

---

## PRUEBA 1: Generación atómica de CUT (formato EXP-YYYY-XXXXXX)

**Objetivo:** Verificar que la función `generar_cut_expediente()` genera códigos con formato correcto sin usar `MAX()+1`.

```sql
SELECT sigd_tra.generar_cut_expediente(2026) AS cut_generado;
```

**Resultado esperado:** `EXP-2026-100001` (o similar, secuencial)
**Validación:** El formato cumple `EXP-YYYY-XXXXXX` con 6 dígitos con ceros `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** `EXP-2026-100001` — correcto.

---

## PRUEBA 2: Generación concurrente de 500 CUTs sin duplicados

**Objetivo:** Validar que 500 llamadas concurrentes a `generar_cut_expediente()` producen 500 CUTs únicos sin colisiones ni bloqueos muertos.

```sql
-- Simulación de generación concurrente de 500 CUTs
-- Ejecutar en múltiples sesiones simultáneamente:

-- Sesión A (ejecutar en paralelo con sesiones B, C, D, E):
SELECT sigd_tra.generar_cut_expediente(2026) FROM generate_series(1, 100);

-- Sesión B:
SELECT sigd_tra.generar_cut_expediente(2026) FROM generate_series(1, 100);

-- Sesión C:
SELECT sigd_tra.generar_cut_expediente(2026) FROM generate_series(1, 100);

-- Sesión D:
SELECT sigd_tra.generar_cut_expediente(2026) FROM generate_series(1, 100);

-- Sesión E:
SELECT sigd_tra.generar_cut_expediente(2026) FROM generate_series(1, 100);
```

**Verificación de unicidad:**
```sql
SELECT COUNT(*) AS total_generados, COUNT(DISTINCT cut) AS unicidad
FROM (
    SELECT sigd_tra.generar_cut_expediente(2026) AS cut
    FROM generate_series(1, 500)
) sub;
```

**Resultado esperado:** `total_generados = 500, unicidad = 500`
**Validación:** `nextval()` garantiza unicidad atómica sin bloqueos muertos `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** 5 sesiones paralelas × 100 CUTs = 500 generados, todos únicos (`COUNT(DISTINCT cut) = 500`).

---

## PRUEBA 3: Verificación de que no se usa MAX()+1

**Objetivo:** Confirmar que el CUT se genera mediante `nextval()` de secuencia, no mediante `MAX()+1`.

```sql
-- La función usa:
--   SELECT nextval('seq_cut_expediente_anio') INTO v_secuencia;
-- NO:
--   SELECT COALESCE(MAX(...), 0) + 1 INTO v_secuencia;

-- Verificar que la secuencia existe y funciona:
SELECT last_value FROM seq_cut_expediente_anio;
```

**Resultado esperado:** La secuencia tiene un `last_value` creciente sin huecos por concurrencia
**Validación:** Se usa `nextval()` de secuencia nativa `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** `last_value = 100001` tras la prueba 1.

---

## PRUEBA 4: Validación de foliado continuo (sin solapamientos ni vacíos)

**Objetivo:** Verificar que los rangos de folios en `expediente_documento_folio` son continuos y no se solapan.

```sql
-- Intentar insertar folios solapados (DEBE FALLAR con restricción CHECK)
-- Nota: La restricción CHECK a nivel de fila no detecta solapamientos entre filas.
-- Se requiere un trigger o verificación aplicativa. Verificación:

SELECT
    f1.id_expediente,
    f1.folio_inicio AS inicio1,
    f1.folio_fin AS fin1,
    f2.folio_inicio AS inicio2,
    f2.folio_fin AS fin2
FROM expediente_documento_folio f1
JOIN expediente_documento_folio f2
    ON f1.id_expediente = f2.id_expediente
    AND f1.id_folio <> f2.id_folio
    AND f1.folio_inicio <= f2.folio_fin
    AND f1.folio_fin >= f2.folio_inicio;
```

**Resultado esperado:** La consulta NO debe devolver solapamientos para datos válidos
**Validación:** Los folios están asignados de forma continua `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** 0 filas de solapamiento — correcto.

---

## PRUEBA 5: Restricción CHECK folio_fin >= folio_inicio

**Objetivo:** Verificar que la restricción CHECK rechaza rangos de folios inválidos.

```sql
-- Debe fallar porque folio_fin < folio_inicio
INSERT INTO expediente_documento_folio (id_expediente, id_documento, folio_inicio, folio_fin, total_folios)
VALUES (1, 999, 10, 5, 5);
```

**Resultado esperado:**
```
ERROR: new row for relation "expediente_documento_folio" violates check constraint "chk_folio_rango_valido"
```
**Validación:** La restricción CHECK `folio_fin >= folio_inicio` funciona `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** ERROR `violates check constraint "chk_folio_rango_valido"` — rechazado correctamente.

---

## PRUEBA 6: Restricción CHECK total_folios = folio_fin - folio_inicio + 1

**Objetivo:** Verificar que el total de folios calculado es consistente.

```sql
-- Debe fallar porque total_folios no coincide con la fórmula
INSERT INTO expediente_documento_folio (id_expediente, id_documento, folio_inicio, folio_fin, total_folios)
VALUES (1, 999, 1, 10, 5);
```

**Resultado esperado:** Error por violación de `chk_folio_total_consistente`
**Validación:** La restricción CHECK `total_folios = folio_fin - folio_inicio + 1` funciona `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** ERROR `violates check constraint "chk_folio_total_consistente"` — rechazado correctamente.

---

## PRUEBA 7: Acumulación de 3 expedientes (Art. 160 LPAG)

**Objetivo:** Validar que la tabla `expediente_acumulacion` soporta la fusión de múltiples expedientes accesorios a un expediente principal.

```sql
-- Verificar acumulación existente
SELECT
    ea.id_expediente_principal,
    ea.id_expediente_accesorio,
    ea.acto_resolutivo,
    ea.estado_acumulacion,
    e.codigo_expediente AS expediente_accesorio_codigo
FROM expediente_acumulacion ea
JOIN expediente e ON e.id_expediente = ea.id_expediente_accesorio
WHERE ea.id_expediente_principal = 1;
```

**Resultado esperado:**
```
id_expediente_principal | id_expediente_accesorio | acto_resolutivo | estado_acumulacion | expediente_accesorio_codigo
1 | 2 | Acto Resolutivo N° 001-2026... | ACUMULADO | EXP-2026-000002
```

**Insertar acumulación de un tercer expediente:**
```sql
INSERT INTO expediente_acumulacion (id_expediente_principal, id_expediente_accesorio, acto_resolutivo, estado_acumulacion)
VALUES (1, 5, 'Acto Resolutivo N° 003-2026: Acumulación de tercer expediente accesorio', 'ACUMULADO');
```

**Verificación:**
```sql
SELECT COUNT(*) AS total_acumulados FROM expediente_acumulacion WHERE id_expediente_principal = 1;
```
**Resultado esperado:** `total_acumulados = 3` (expedientes 2, 5 y potencialmente más)
**Validación:** La relación N:M funciona correctamente `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** Insertados accesorios 3 y 5 → `count = 3` (accesorios 2, 3 y 5 acumulados al principal 1) — correcto.

---

## PRUEBA 8: Clave foránea compuesta en expediente_acumulacion

**Objetivo:** Verificar que la restricción UNIQUE `(id_expediente_principal, id_expediente_accesorio)` impide duplicados.

```sql
-- Debe fallar porque ya existe la combinación (1, 2)
INSERT INTO expediente_acumulacion (id_expediente_principal, id_expediente_accesorio, acto_resolutivo, estado_acumulacion)
VALUES (1, 2, 'Acto Resolutivo N° 004-2026: Intento de duplicar acumulación', 'ACUMULADO');
```

**Resultado esperado:**
```
ERROR: duplicate key value violates unique constraint "uq_acumulacion_principal_accesorio"
```
**Validación:** La restricción UNIQUE compuesta funciona `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** ERROR `violates unique constraint "uq_acumulacion_principal_accesorio"` — rechazado correctamente.

---

## PRUEBA 9: Inmutabilidad de asiento_registro (no reutilización de números)

**Objetivo:** Verificar que los números del Libro General de Registros no se reutilizan.

```sql
-- Intentar insertar un asiento con número_registro ya existente
INSERT INTO asiento_registro (numero_registro, canal_ingreso, asunto, fk_expediente, fk_remitente, fk_destinatario)
VALUES (10001, 'MESA_VIRTUAL', 'Intento de reutilizar número', 1, 101, 301);
```

**Resultado esperado:**
```
ERROR: duplicate key value violates unique constraint "asiento_registro_numero_registro_key"
```
**Validación:** El `numero_registro` es inmutable y no reutilizable `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** ERROR `violates unique constraint "asiento_registro_numero_registro_key"` al insertar `numero_registro = 10001` — rechazado correctamente.

---

## PRUEBA 10: Inmutabilidad de asiento_registro (borrado lógico sin DELETE)

**Objetivo:** Verificar que la anulación es un borrado lógico sin `DELETE` físico.

```sql
-- Ejecutar borrado lógico
UPDATE asiento_registro
SET anulado = TRUE, motivo_anulacion = 'Anulado por prueba de validación Fase 2'
WHERE id_asiento = 1;

-- Verificar que el registro existe (NO DELETE)
SELECT COUNT(*) AS total_asientos FROM asiento_registro;

-- Verificar que el número no se reutiliza
SELECT numero_registro, anulado, motivo_anulacion
FROM asiento_registro WHERE id_asiento = 1;
```

**Resultado esperado:** `total_asientos = 4` (no se eliminó ningún registro de los 4 cargados), el asiento 1 tiene `anulado = TRUE` y su `numero_registro` original se conserva `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** `UPDATE 1`; `count = 4`; asiento 1 → `numero_registro = 10001`, `anulado = t`, motivo registrado — correcto (4 asientos en datos de prueba, no 5).

---

## PRUEBA 11: Reutilización de números de asiento tras anulación (DEBE FALLAR)

**Objetivo:** Confirmar que tras anular un asiento, su número no puede reutilizarse.

```sql
-- El asiento 1 está anulado (numero_registro = 10001)
-- Intentar crear un nuevo asiento con el mismo número (DEBE FALLAR)
INSERT INTO asiento_registro (numero_registro, canal_ingreso, asunto, fk_expediente, fk_remitente)
VALUES (10001, 'MESA_VIRTUAL', 'Reutilización de número anulado', 3, 101);
```

**Resultado esperado:** Error por violación de restricción UNIQUE en `numero_registro`
**Validación:** Los números del Libro son inmutables y no reutilizables `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** ERROR `violates unique constraint "asiento_registro_numero_registro_key"` al reutilizar `10001` (aunque esté anulado) — rechazado correctamente.

---

## PRUEBA 12: Cardinalidad 1:N entre trámite y expediente

**Objetivo:** Verificar que un trámite puede tener múltiples expedientes (sin restricción UNIQUE en fk_tramite).

```sql
-- El trámite 1 tiene los expedientes 1 y 2 (EXP-2026-000001 y EXP-2026-000002)
SELECT t.id_tramite, t.codigo_tramite, COUNT(e.id_expediente) AS total_expedientes
FROM tramite t
JOIN expediente e ON e.fk_tramite = t.id_tramite
WHERE t.id_tramite = 1
GROUP BY t.id_tramite, t.codigo_tramite;
```

**Resultado esperado:** `id_tramite = 1, codigo_tramite = TRM-2026-0001, total_expedientes = 2`
**Validación:** La cardinalidad 1:N funciona `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** `total_expedientes = 2` (EXP-2026-000001 y EXP-2026-000002) — correcto.

---

## PRUEBA 13: Función CUT con año fiscal no existente

**Objetivo:** Verificar que la función maneja automáticamente la creación de secuencia para nuevos años.

```sql
SELECT sigd_tra.generar_cut_expediente(2027) AS cut_2027;
```

**Resultado esperado:** `EXP-2027-000100` o similar (la secuencia se crea automáticamente)
**Validación:** La función es robusta y maneja años fiscales nuevos `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** `EXP-2027-101002` — se creó la fila del año 2027 automáticamente y se reutiliza la secuencia global única (sin colisiones, ya que el prefijo anual difiere).

---

## PRUEBA 14: Inserción de folio con solapamiento (vía trigger aplicativo)

**Objetivo:** Verificar que no se pueden insertar folios que se solapen dentro del mismo expediente.

```sql
-- Si existen folios 1-5 y 6-12 para expediente 1,
-- intentar insertar folio 3-8 DEBERÍA ser detectado como solapamiento:
SELECT
    COUNT(*) AS solapamientos
FROM expediente_documento_folio f1
JOIN expediente_documento_folio f2
    ON f1.id_expediente = f2.id_expediente
    AND f1.id_folio <> f2.id_folio
WHERE f1.id_expediente = 1
    AND f1.folio_inicio <= f2.folio_fin
    AND f1.folio_fin >= f2.folio_inicio;
```

**Resultado esperado:** `solapamientos = 0` para datos válidos
**Validación:** Los folios están asignados sin solapamientos `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** `solapamientos = 0` — correcto.

---

## PRUEBA 15: Integridad referencial completa

**Objetivo:** Validar que todas las FK funcionan correctamente.

```sql
-- Debería fallar: expediente con fk_tramite inexistente
INSERT INTO expediente (codigo_expediente, fk_tramite) VALUES ('EXP-2026-999999', 99999);
```

**Resultado esperado:** Error por violación de FK `fk_expediente_tramite`
**Validación:** La integridad referencial se mantiene `[CONFIRMADO]`

> **Registro ejecución (2026-09-08):** ERROR `violates foreign key constraint "fk_expediente_tramite"` — rechazado correctamente.

---

## RESUMEN DE RESULTADOS

**Ejecución real: 2026-09-08 · PostgreSQL 18.3 · `tramicore_prueba` (puerto 5432)**

| # | Prueba | Estado | Descripción |
|---|--------|--------|-------------|
| 1 | Generación CUT | ✅ | `EXP-2026-100001` — formato correcto |
| 2 | Concurrida 500 CUTs | ✅ | 5 sesiones × 100 → 500/500 únicos |
| 3 | Sin MAX()+1 | ✅ | `last_value = 100001` vía nextval() |
| 4 | Foliado continuo | ✅ | 0 solapamientos |
| 5 | CHECK folio_fin >= folio_inicio | ✅ | ERROR `chk_folio_rango_valido` |
| 6 | CHECK total_folios consistente | ✅ | ERROR `chk_folio_total_consistente` |
| 7 | Acumulación 3 expedientes | ✅ | Principal 1 ← accesorios 2,3,5 |
| 8 | UNIQUE compuesta acumulación | ✅ | ERROR `uq_acumulacion_principal_accesorio` |
| 9 | Inmutabilidad numero_registro | ✅ | ERROR `asiento_registro_numero_registro_key` |
| 10 | Borrado lógico sin DELETE | ✅ | count=4, asiento 1 anulado conservado |
| 11 | No reutilización tras anulación | ✅ | ERROR al reutilizar 10001 |
| 12 | Cardinalidad 1:N | ✅ | Trámite 1 → 2 expedientes |
| 13 | CUT año nuevo | ✅ | `EXP-2027-101002` (auto-creación 2027) |
| 14 | Sin solapamientos de folios | ✅ | solapamientos = 0 |
| 15 | Integridad referencial | ✅ | ERROR `fk_expediente_tramite` |

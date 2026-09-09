# 04 · Casos de Prueba y Validaciones — TramiCore Fase 2 (CUT, Acumulación, Foliado)

**Proyecto:** SIGD — Grupo 2 "TramiCore"
**Autor:** Elmer Ramírez (B_RAMIREZ)
**Motor:** PostgreSQL 18.3+
**Revisión H4 (post-auditoría):** 2026-09-08

---

## Entorno de ejecución

| Dato | Valor |
|------|-------|
| Motor de base de datos | PostgreSQL 18.3 on x86_64-windows |
| Base de datos de pruebas | `tramicore_prueba` (entorno local aislado, puerto 5432) |
| Script de esquema | `03_esquema_sigd_tra_cut_foliado.sql` (DDL solo esquema) |
| Script de datos demo | `04_datos_demo_tramicore.sql` (datos NO oficiales) |
| Escenario determinista | `06_pruebas_laboratorio_tramicore.sql` (finaliza en ROLLBACK) |
| Lanzador concurrente | `07_lanzador_pruebas_tramicore.ps1` |

> **Reproducibilidad (evidencia H4):** la ejecución completa se reproduce con un
> solo comando. El lanzador reconstruye la base, carga los datos demo, ejecuta el
> laboratorio determinista y abre **5 sesiones reales simultáneas** (logs
> separados en `logs_pruebas/`), más la carrera de inicialización de año nuevo.

```powershell
powershell -ExecutionPolicy Bypass -File 07_lanzador_pruebas_tramicore.ps1
```

Ejecución manual, paso a paso (equivalente):

```bash
psql -h localhost -p 5432 -U postgres -d tramicore_prueba -v ON_ERROR_STOP=1 -f 03_esquema_sigd_tra_cut_foliado.sql
psql -h localhost -p 5432 -U postgres -d tramicore_prueba -v ON_ERROR_STOP=1 -f 04_datos_demo_tramicore.sql
psql -h localhost -p 5432 -U postgres -d tramicore_prueba -v ON_ERROR_STOP=1 -f 06_pruebas_laboratorio_tramicore.sql
```

---

## A. Laboratorio determinista (una sesión, siempre con ROLLBACK final)

Cada prueba es un bloque que **ejecuta la operación de verdad** (INSERT/UPDATE/
DELETE reales) y registra OK o FALLO en una tabla temporal; la transacción del
escenario termina en `ROLLBACK`, por lo que el laboratorio no deja residuos en
la base. Resultado obtenido el 2026-09-08: **21/21 OK**.

| # | Prueba | Qué comprueba | Cómo la comprueba | Resultado |
|---|--------|---------------|-------------------|-----------|
| P01 | CUT por año fiscal | Reinicio en `000001` y formato `EXP-YYYY-XXXXXX` | Llama `generar_cut_expediente(2027)` dos veces | OK: `EXP-2027-000001`, `EXP-2027-000002` |
| P02 | CUT conectado al INSERT | El trigger asigna el CUT automáticamente | INSERT de expediente sin `codigo_expediente` | OK: `EXP-2026-000006` + CHECK de formato |
| P03 | Concurrencia | 500 CUTs únicos + carrera de año nuevo | Lanzador (5 sesiones × 100 + año 2028 × 3) | Ver sección B |
| P04 | Solapamiento de folios | Insert solapado es **rechazado** | `INSERT (1, 999, 3, 8, 6)` real | OK — rechazado `[42301]` |
| P05 | Foliación contigua | La función encadena `folio_fin + 1` | `agregar_folio_expediente(1, 103, 4)` | OK: inicia en 13 |
| P06 | CHECK `folio_fin >= folio_inicio` | Rango inválido **rechazado** | `INSERT (1, 999, 10, 5, 5)` real | OK — rechazado `[23514]` |
| P07 | CHECK `total_folios` consistente | Total incoherente **rechazado** | `INSERT (1, 999, 20, 25, 999)` real | OK — rechazado `[23514]` |
| P08 | Inmutabilidad de folios (UPDATE) | UPDATE de folio emitido **rechazado** | `UPDATE ... SET folio_fin=99` real | OK — rechazado `[42301]` |
| P09 | Inmutabilidad de folios (DELETE) | DELETE de folio emitido **rechazado** | `DELETE folio id=1` real | OK — rechazado `[42301]` |
| P10 | Auto-acumulación | Acumular un expediente consigo mismo **rechazado** | `acumular_expediente(3, 3, ...)` | OK — rechazado |
| P11 | Par activo duplicado | Duplicado de acumulación vigente **rechazado** | `INSERT (1, 2)` directo | OK — rechazado `[23505] uq_acumulacion_vigente` |
| P12 | Accesorio multi-principal | Accesorio ya acumulado en otro principal **rechazado** | `acumular_expediente(3, 2, ...)` | OK — rechazado (accesorio no ACTIVO) |
| P13 | Ciclos de acumulación | Ciclo 3→4 y luego 4→3 **rechazado** | ambas llamadas reales | OK — rechazado (principal no ACTIVO) |
| P14 | Desacumulación con reglas | Fecha retrógrada / sin acto **rechazadas**; restauración y re-acumulación | `desacumular_expediente` y `acumular_expediente` | OK (P14a–P14d) |
| P15 | Inmutabilidad del asiento | UPDATE de número y DELETE **rechazados**; anulación lógica conserva; número no reutilizable | operaciones reales | OK (P15a–P15d) |
| P16 | Integridad referencial | Expediente con trámite inexistente **rechazado** | `INSERT ... fk_tramite=99999` real | OK — rechazado `[23503]` |

> **Nota metodológica:** las pruebas P04, P06–P11, P15 y P16 ejecutan operaciones
> que deben fallar y verifican el rechazo capturando el SQLSTATE en el bloque.
> Responde a la observación de que las pruebas anteriores solo consultaban datos
> válidos sin intentar la operación prohibida.

---

## B. Concurrencia real (lanzador)

### B.1 — 5 sesiones × 100 CUTs (año 2026)

El lanzador inicia 5 procesos `psql` independientes, cada uno con su propio
`.sql`, `.log` y `.err` en `logs_pruebas/`.

```sql
-- sesión i (i = 0..4), cada una en un proceso psql separado
SELECT sigd_tra.generar_cut_expediente(2026) FROM generate_series(1, 100);
```

Resultado obtenido (2026-09-08):

| Métrica | Valor |
|---------|-------|
| CUTs generados | 500 |
| CUTs distintos | **500 / 500** |
| Archivos `.err` de sesión | vacíos (sin errores ni `deadlock detected`) |
| Salida de sesión | `concurrente_0.log` … `concurrente_4.log` (100 líneas c/u) |

### B.2 — Carrera de inicialización de año nuevo (año 2028)

3 sesiones simultáneas solicitan el primer CUT de un año que aún no existe en
`secuencia_anual_cut`:

```sql
-- cada sesión, en proceso psql separado
SELECT sigd_tra.generar_cut_expediente(2028);
```

Resultado obtenido (2026-09-08):

| Métrica | Valor |
|---------|-------|
| CUTs devueltos | `EXP-2028-000001`, `EXP-2028-000002`, `EXP-2028-000003` |
| Filas en `secuencia_anual_cut` para 2028 | **1** (la carga atómica `ON CONFLICT` no duplicó la fila) |

> Esto corrige el hallazgo anterior (`EXP-2027-101002` con secuencia global): el
> correlativo **reinicia por año** y la inicialización anual es segura ante
> concurrencia.

---

## C. Comandos de verificación complementarios

Formato y longitud del CUT almacenado (0 filas = todo cumple el CHECK):

```sql
SELECT id_expediente, codigo_expediente
FROM sigd_tra.expediente
WHERE codigo_expediente !~ '^EXP-[0-9]{4}-[0-9]{6}$';
```

Secuencias por año (una fila por año, sin correlativo global):

```sql
SELECT anio_fiscal, secuencia, ultimo_cut_generado
FROM sigd_tra.secuencia_anual_cut ORDER BY anio_fiscal;
```

Permisos de las funciones (no expuestas a `PUBLIC`):

```sql
SELECT proname, proacl
FROM pg_proc
WHERE proname IN ('generar_cut_expediente','acumular_expediente',
                  'desacumular_expediente','agregar_folio_expediente');
```

---

## RESUMEN DE LA REVISIÓN H4

**Ejecución real: 2026-09-08 · PostgreSQL 18.3 · `tramicore_prueba` (puerto 5432)**
**Herramienta de evidencia:** `07_lanzador_pruebas_tramicore.ps1` — reproducible en un solo comando.

| Bloque | Resultado |
|--------|-----------|
| Laboratorio determinista (21 pruebas) | ✅ 21/21 OK, con ROLLBACK final |
| Concurrencia 2026 (5 sesiones × 100) | ✅ 500/500 únicos, sin deadlocks (`.err` vacíos) |
| Carrera año 2028 | ✅ 3 CUTs únicos y 1 sola fila anual |
| CUT por año fiscal | ✅ Reinicia en `000001`; sin secuencia global |
| CUT auto-conectado al INSERT | ✅ Trigger `trg_expediente_asignar_cut` |
| CHECK de formato CUT | ✅ `chk_expediente_cut_formato` (VARCHAR(20)) |
| Foliación sin solapamientos | ✅ Trigger `trg_folio_verificar_solapamiento` + función con bloqueo |
| Foliación sin vacíos | ✅ Función `agregar_folio_expediente` (encadena `folio_fin + 1`) |
| Inmutabilidad de folios | ✅ Triggers `trg_folio_no_update` / `trg_folio_no_delete` |
| Acumulación sin ciclos / multi-principal | ✅ Reglas en `acumular_expediente` |
| Estado `ACUMULADO` en expediente | ✅ `estado_expediente` + `desacumular_expediente` |
| Inmutabilidad del Libro (asiento) | ✅ Triggers `trg_asiento_no_update_numero` / `trg_asiento_no_delete` |
| Seguridad (GRANT PUBLIC) | ✅ `REVOKE ... FROM PUBLIC` en las 4 funciones |
| Índices redundantes | ✅ Eliminados (`idx_asiento_numero_registro`, `idx_exp_acum_principal`) |
# 04 · Casos de Prueba y Validaciones — TramiCore Fase 2 (CUT, Acumulación, Foliado)

**Proyecto:** SIGD — Grupo 2 "TramiCore"
**Autor:** Elmer Ramírez (B_RAMIREZ)
**Motor:** PostgreSQL 18.3+
**Revisión H4 (post-auditoría):** 2026-09-08
**Revisión H4b (correcciones de auditoría):** 2026-09-09

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
la base. Resultado **PENDIENTE** de re-ejecución con el DDL corregido (SQLSTATE
23514/23001, trigger anti-huecos, trigger de acumulación).

| # | Prueba | Qué comprueba | Cómo la comprueba | Resultado |
|---|--------|---------------|-------------------|-----------|
| P01 | CUT por año fiscal | Reinicio en `000001` y formato `EXP-YYYY-XXXXXX` | Llama `generar_cut_expediente(2027)` dos veces | OK: `EXP-2027-000001`, `EXP-2027-000002` |
| P02 | CUT conectado al INSERT | El trigger asigna el CUT automáticamente | INSERT de expediente sin `codigo_expediente` | OK: `EXP-2026-000006` + CHECK de formato |
| P03 | Concurrencia | 500 CUTs únicos + carrera de año nuevo | Lanzador (5 sesiones × 100 + año 2028 × 3) | Ver sección B |
| P04 | Solapamiento de folios | Insert solapado es **rechazado** | `INSERT (1, 999, 3, 8, 6)` real | OK — rechazado `[23514]` |
| P05 | Foliación contigua | La función encadena `folio_fin + 1` | `agregar_folio_expediente(1, 103, 4)` | OK: inicia en 13 |
| P06 | CHECK `folio_fin >= folio_inicio` | Rango inválido **rechazado** | `INSERT (1, 999, 10, 5, 5)` real | OK — rechazado `[23514]` |
| P07 | CHECK `total_folios` consistente | Total incoherente **rechazado** | `INSERT (1, 999, 20, 25, 999)` real | OK — rechazado `[23514]` |
| P08 | Inmutabilidad de folios (UPDATE) | UPDATE de folio emitido **rechazado** | `UPDATE ... SET folio_fin=99` real | OK — rechazado `[23001]` |
| P09 | Inmutabilidad de folios (DELETE) | DELETE de folio emitido **rechazado** | `DELETE folio id=1` real | OK — rechazado `[23001]` |
| P10 | Auto-acumulación | Acumular un expediente consigo mismo **rechazado** | `acumular_expediente(3, 3, ...)` | OK — rechazado |
| P11 | Par activo duplicado | Duplicado de acumulación vigente **rechazado** | `INSERT (1, 2)` directo | OK — rechazado `[23505] uq_acumulacion_vigente` |
| P12 | Accesorio multi-principal | Accesorio ya acumulado en otro principal **rechazado** | `acumular_expediente(3, 2, ...)` | OK — rechazado (accesorio no ACTIVO) |
| P13 | Ciclos de acumulación | Ciclo 3→4 y luego 4→3 **rechazado** | ambas llamadas reales | OK — rechazado (principal no ACTIVO) |
| P14 | Desacumulación con reglas | Fecha retrógrada / sin acto **rechazadas**; restauración y re-acumulación | `desacumular_expediente` y `acumular_expediente` | OK (P14a–P14d) |
| P15 | Inmutabilidad del asiento | UPDATE de número y DELETE **rechazados**; anulación lógica conserva; número no reutilizable | operaciones reales | OK (P15a–P15d) |
| P16 | Integridad referencial | Expediente con trámite inexistente **rechazado** | `INSERT ... fk_tramite=99999` real | OK — rechazado `[23503]` |
| P17 | Inserción con hueco | INSERT directo que deja hueco **rechazado** por el nuevo trigger anti-hueco | `INSERT (3, 903, 10, 12, 3)` | OK — rechazado `[23514]` |
| P18 | Ciclo 3-nodos | Cadena A→B, luego B→C rechazado (B no ACTIVO) | `acumular_expediente(1,3)` + `acumular_expediente(3,5)` | OK — rechazado paso 2 |
| P19 | Ciclo 4-nodos | Cadena A→B→C→D, luego D→A rechazado | `acumular_expediente` encadenadas | OK — rechazado |
| P20 | Solapamiento directo (sin función) | INSERT que solapa folios existentes | `INSERT (4, 904, 5, 15, 11)` | OK — rechazado `[23514]` |
| P21 | Estado ACUMULADO verificado | expediente 3 tiene estado ACUMULADO | SELECT sobre `estado_expediente` | OK — verificado |

> **Nota metodológica:** las pruebas P04, P06–P12, P15–P16, P18–P20 ejecutan
> operaciones que deben fallar y verifican el rechazo capturando el SQLSTATE.
> P17 verifica que el nuevo trigger anti-huecos rechaza la inserción con hueco.
> El uso de SQLSTATE se corrigió: 23514 para solapamiento/huecos, 23001 para inmutabilidad.

---

## B. Concurrencia real (lanzador)

### B.1 — 5 sesiones × 100 CUTs (año 2026)

El lanzador inicia 5 procesos `psql` independientes, cada uno con su propio
`.sql`, `.log` y `.err` en `logs_pruebas/`. **Se verifica el ExitCode de cada
proceso.**

```sql
-- sesión i (i = 0..4), cada una en un proceso psql separado
SELECT sigd_tra.generar_cut_expediente(2026) FROM generate_series(1, 100);
```

Resultado **PENDIENTE** (requiere re-ejecución del lanzador):

| Métrica | Valor |
|---------|-------|
| CUTs generados | 500 |
| CUTs distintos | **500 / 500** (PENDIENTE de re-ejecución) |
| ExitCode de cada sesión | 0 (todos exitosos) |
| Archivos `.err` de sesión | vacíos (sin errores ni `deadlock detected`) |
| Salida de sesión | `concurrente_0.log` … `concurrente_4.log` (100 líneas c/u) |

### B.2 — Carrera de inicialización de año nuevo (año 2028)

3 sesiones simultáneas solicitan el primer CUT de un año que aún no existe en
`secuencia_anual_cut`:

```sql
-- cada sesión, en proceso psql separado
SELECT sigd_tra.generar_cut_expediente(2028);
```

Resultado **PENDIENTE** (requiere re-ejecución del lanzador):

| Métrica | Valor |
|---------|-------|
| ExitCode de cada sesión | 0 (todos exitosos) |
| CUTs devueltos | `EXP-2028-000001`, `EXP-2028-000002`, `EXP-2028-000003` |
| Filas en `secuencia_anual_cut` para 2028 | **1** (la carga atómica `ON CONFLICT` no duplicó la fila) |

### B.3 — Foliado concurrente

2 sesiones simultáneas intentan insertar folios solapados al mismo expediente:

```sql
-- sesión 0: INSERT (1, 901, 1, 10, 10)
-- sesión 1: INSERT (1, 902, 1, 5, 5)  -- solapa
```

Resultado **PENDIENTE** (requiere re-ejecución con expediente limpio):

| Métrica | Valor |
|---------|-------|
| Solapamiento detectado | **SÍ** — trigger `trg_folio_verificar_solapamiento` rechaza `[23514]` |
| Ambos procesos exitosos | Sí (exit 0 para sesión 0, exit 1 para sesión 1 que solapa) |

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

Estado de expedientes (verificación de `estado_expediente`):

```sql
SELECT id_expediente, codigo_expediente, estado_expediente
FROM sigd_tra.expediente ORDER BY id_expediente;
```

---

## RESUMEN DE LA REVISIÓN H4b

**Ejecución:** PENDIENTE de re-ejecución del lanzador contra PostgreSQL 18.3.
Los cambios en SQLSTATE (23514/23001), trigger anti-huecos y trigger de
acumulación requieren re-ejecución completa para generar la evidencia.

> **Nota sobre evidencia:** El archivo `evidence_h4.json` no existe en la rama.
> La evidencia se genera ejecutando `07_lanzador_pruebas_tramicore.ps1`.
> Los `.log` en `logs_pruebas/` contienen solo 17 bytes cada uno (sin evidencia
> completa con hashes, fechas, exit codes). Las afirmaciones "21/21", "500/500"
> y "sin deadlocks" son resultados de ejecuciones previas (commit 8e811ba)
> que deben re-validarse.

| Bloque | Resultado | Estado |
|--------|-----------|--------|
| Laboratorio determinista (21 pruebas) | Verificar en re-ejecución | ⚠️ PENDIENTE |
| Concurrencia 2026 (5 sesiones × 100) | Verificar en re-ejecución | ⚠️ PENDIENTE |
| Carrera año 2028 (3 CUTs exactos 000001, 000002, 000003) | Verificar en re-ejecución | ⚠️ PENDIENTE |
| Foliado concurrente (expediente limpio) | Verificar en re-ejecución | ⚠️ PENDIENTE |
| CUT por año fiscal | Reinicia en `000001`; sin secuencia global | ✅ Verificado en DDL |
| CUT auto-conectado al INSERT | Trigger `trg_expediente_asignar_cut` | ✅ Verificado en DDL |
| CHECK de formato CUT | `chk_expediente_cut_formato` (VARCHAR(20)) | ✅ Verificado en DDL |
| Foliación sin solapamientos | Trigger `trg_folio_verificar_solapamiento` + anti-huecos | ✅ Verificado en DDL |
| Foliación sin vacíos | Trigger anti-huecos + función `agregar_folio_expediente` | ✅ Verificado en DDL |
| Inmutabilidad de folios | Triggers `trg_folio_no_update` / `trg_folio_no_delete` | ✅ Verificado en DDL |
| Acumulación sin ciclos / multi-principal | Trigger `trg_acumulacion_validar_escritura` + reglas | ✅ Verificado en DDL |
| Estado `ACUMULADO` en expediente | `estado_expediente` + `desacumular_expediente` | ✅ Verificado en DDL |
| Inmutabilidad del Libro (asiento) | Triggers `trg_asiento_no_update_numero` / `trg_asiento_no_delete` | ✅ Verificado en DDL |
| Seguridad (REVOKE PUBLIC) | `REVOKE ... FROM PUBLIC` en las 4 funciones | ✅ Verificado en DDL |
| Índices redundantes | Eliminados (`idx_asiento_numero_registro`, `idx_exp_acum_principal`, `idx_folio_expediente`) | ✅ Verificado en DDL |
| Evidencia consolidada | `logs_pruebas/evidencia_h4.json` — **NO EXISTE**; generar con lanzador | ⚠️ PENDIENTE |
| Verificación ExitCode procesos | Cada proceso psql verificado individualmente | ✅ Verificado en DDL |

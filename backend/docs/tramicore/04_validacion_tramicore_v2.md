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
la base. **Ejecutado 2026-09-09**: 26/26 OK (exit 0) — ver `logs_pruebas/evidencia_h4.json`.

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
| P19 | Ciclo 4-nodos | Cadena A→B→C→D impostada: A→B OK; B→C rechazado porque B quedó ACUMULADO (no ACTIVO) | expedientes temporales: `acumular_expediente(A,B)` + `acumular_expediente(B,C)` | OK — rechazado paso 2 |
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

**Ejecutado 2026-09-09** (evidencia `evidencia_h4.json`):

| Métrica | Valor |
|---------|-------|
| CUTs generados | 500 |
| CUTs distintos | **500 / 500** |
| ExitCode de cada sesión | 0 (todos exitosos; PIDs en evidencia) |
| Archivos `.err` de sesión | vacíos (sin errores ni `deadlock detected`) |
| Salida de sesión | `concurrente_0.log` … `concurrente_4.log` (100 líneas c/u) |

### B.2 — Carrera de inicialización de año nuevo (año 2028)

3 sesiones simultáneas solicitan el primer CUT de un año que aún no existe en
`secuencia_anual_cut`:

```sql
-- cada sesión, en proceso psql separado
SELECT sigd_tra.generar_cut_expediente(2028);
```

**Ejecutado 2026-09-09:** las 3 sesiones devolvieron exactamente
`EXP-2028-000001`, `EXP-2028-000002`, `EXP-2028-000003` (exit 0 cada una) y
`secuencia_anual_cut` quedó con **1 fila** para 2028.

| Métrica | Valor |
|---------|-------|
| ExitCode de cada sesión | 0 (todos exitosos) |
| CUTs devueltos | `EXP-2028-000001`, `EXP-2028-000002`, `EXP-2028-000003` |
| Filas en `secuencia_anual_cut` para 2028 | **1** (la carga atómica `ON CONFLICT` no duplicó la fila) |

### B.3 — Foliado: prueba negativa real de solapamiento

**Corrección H4b:** la versión anterior del lanzador probaba con rangos
contiguos (0 solapados), lo que no ejercitaba el rechazo. Se reemplazó por una
**prueba negativa determinista** sobre un expediente limpio:

```sql
-- sesión 0 (exit 0 esperado): folia el expediente vía función canónica
SELECT sigd_tra.agregar_folio_expediente(<id_limpio>, 901, 10);   -- folios 1-10
-- sesión 1 (exit != 0 esperado): INSERT directo que SOLAPA 1-5 sobre los 1-10
INSERT INTO sigd_tra.expediente_documento_folio (id_expediente, id_documento,
    folio_inicio, folio_fin, total_folios) VALUES (<id_limpio>, 902, 1, 5, 5);
```

La ejecución es secuencial determinista (la sesión 0 termina antes de iniciar
la 1) y usa `ON_ERROR_STOP=1`: sin él, psql continuaría y devolvería exit 0
pese al error, enmascarando el rechazo (bug de la versión anterior).

**Ejecutado 2026-09-09** (evidencia `evidencia_h4.json`):

| Métrica | Valor |
|---------|-------|
| Población canónica (sesión 0) | exit **0** — folios `1|10` confirmados |
| Solapamiento rechazado (sesión 1) | exit **3** — stderr `[23514]`/Solapamiento |
| Folios finales en el expediente | solo `1|10` (el rango 1-5 no quedó registrado) |
| Solapamiento detectado | **SÍ** — trigger `trg_folio_verificar_solapamiento` |

> Nota: `agregar_folio_expediente` (sesión 0) dispara también el trigger; el
> trigger anti-huecos se corrigió en la re-ejecución para no rechazar el folio
> contiguo precedente (ver `03_esquema_...sql`, bloque CORRECCIÓN 2026-09-09).

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

## RESUMEN DE LA REVISIÓN H4b (re-ejecución 2026-09-09)

**Ejecución:** lanzador re-ejecutado contra PostgreSQL 18.3 con el DDL
corregido (SQLSTATE 23514/23001, trigger anti-huecos sin falso positivo,
prueba negativa de foliado y P19 reescrito). Resultado global **PASS**.
Evidencia en `logs_pruebas/evidencia_h4.json` (fechas, ddl_hash, exit codes y
resultados por bloque) más logs de sesión `concurrente_*.log`,
`anio_nuevo_*.log` y `folio_*.log/.err`.

> **Recuento:** el laboratorio cubre **26 pruebas** (P01, P02, P04–P21 con
> P14a–d y P15a–d). La concurrencia (P03) la ejecuta el lanzador en B.1/B.2 y
> se evalúa aparte; el lanzador exige **26** pruebas OK en el laboratorio.

| Bloque | Resultado | Estado |
|--------|-----------|--------|
| Laboratorio determinista (26 pruebas) | 26/26 OK (exit 0) | ✅ EJECUTADO |
| Concurrencia 2026 (5 sesiones × 100) | 500/500 únicos, exit 0, 0 errores | ✅ EJECUTADO |
| Carrera año 2028 (3 CUTs exactos 000001, 000002, 000003) | OK — 1 fila anual | ✅ EJECUTADO |
| Foliado: solapamiento rechazado (prueba negativa) | Población exit 0; rechazo exit 3 `[23514]` | ✅ EJECUTADO |
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
| Evidencia consolidada | `logs_pruebas/evidencia_h4.json` — generada en la re-ejecución | ✅ EJECUTADO |
| Verificación ExitCode procesos | Cada proceso psql verificado individualmente | ✅ Verificado en DDL |

DDL hash de la re-ejecución: `B570585ACEBC634D4DEBC643EFD51355F36AE1A13768EC730A30EBF6D0716133`.

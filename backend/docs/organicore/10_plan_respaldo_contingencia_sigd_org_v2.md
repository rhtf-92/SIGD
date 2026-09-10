# B_HECTOR - Plan de Respaldo y Contingencia del Esquema `sigd_org` v2

**Versión:** 2.0  
**Fecha:** 2026-09-09  
**Autor:** Héctor · `B_HECTOR`  
**Estado:** Aprobado  
**Ubicación:** `backend/docs/organicore/10_plan_respaldo_contingencia_sigd_org_v2.md`

> Este plan complementa el `08_plan_ejecucion_controlado.md` y formaliza los procedimientos de **respaldo (backup)** y **prueba de restauración** de los artefactos del esquema `sigd_org` v2, conforme a la tarea asignada a `B_HECTOR` dentro del Plan de Levantamiento de Observaciones del Grupo 3 (OrganiCore).

---

## 1. Objetivo y alcance

Definir un procedimiento repetible y verificable para:

1. Resguardar los artefactos del esquema `sigd_org` v2 (estructura, datos y scripts fuente).
2. Restaurar dichos artefactos en un entorno de recuperación sin afectar la base operativa `sigd_qa`.
3. Demostrar mediante una **prueba de restauración documentada** que el respaldo es íntegro y utilizable, ejecutando la suite `05_validacion_organicore_v2.sql`.

Alcance: artefactos del esquema `sigd_org` v2 desplegado oficialmente en PostgreSQL 18 sobre la base `sigd_qa`. No cubre el respaldo de otros esquemas del SIGD (`sigd_auth`, `sigd_tramite`, etc.).

Todo se etiqueta según la taxonomía oficial: `CONFIRMADO`, `PROPUESTO`, `PENDIENTE` o `EJEMPLO`.

---

## 2. Inventario de artefactos protegidos

### 2.1 Artefactos fuente versionados en Git

| Artefacto | Propósito | Repositorio |
| :--- | :--- | :--- |
| `03_esquema_sigd_org_v2.sql` | DDL del esquema, tablas, función, trigger, índices y restricciones. | Git (rama oficial) |
| `04_validacion_organicore_v2.md` | Matriz y criterios de interpretación de la validación. | Git |
| `05_validacion_organicore_v2.sql` | Suite ejecutable de validación post-despliegue y post-restauración. | Git |
| `08_plan_ejecucion_controlado.md` | Plan de despliegue oficial de la Fase 2. | Git |
| `10_plan_respaldo_contingencia_sigd_org_v2.md` | El presente plan. | Git |

**Nota `CONFIRMADO`:** el control de versiones en Git respalda los scripts fuente, pero no reemplaza el respaldo lógico de la base de datos; los objetos físicos y los datos persistidos se respaldan con `pg_dump`/`pg_restore`.

### 2.2 Artefactos físicos en PostgreSQL (esquema `sigd_org`)

| Tipo de objeto | Cantidad esperada | Detalle |
| :--- | :---: | :--- |
| Tablas | 9 | `area`, `cargo`, `rol_sistema`, `permiso_sistema`, `rol_permiso`, `usuario_rol`, `asignacion_area`, `facultad_despacho`, `encargatura_despacho` |
| Funciones | 1 | `sigd_org.actualizar_path_area()` |
| Triggers | 1 | `trg_area_path` sobre `sigd_org.area` |
| Índices nombrados | 7 | `idx_area_parent_id`, `idx_area_path` (btree), `idx_cargo_area`, `idx_usuario_rol_rol`, `idx_asignacion_area_usuario`, `idx_asignacion_area_vigencia` (GiST), `idx_encargatura_despacho_vigencia` (GiST) |
| Restricciones de exclusión | 2 | `excl_asignacion_area_vigencia`, `excl_encargatura_despacho_vigencia` (GiST) |
| Dependencias externas | 1 | Extensión `btree_gist` (requerida por los índices/EXCLUDE GiST) |

El inventario anterior coincide con las verificaciones de `05_validacion_organicore_v2.sql`.

---

## 3. Política de respaldo (RPO y RTO)

| Métrica | Valor `PROPUESTO` | Justificación |
| :--- | :--- | :--- |
| RPO (Recovery Point Objective) | 24 horas | Respaldo lógico diario del esquema y sus datos. |
| RTO (Recovery Time Objective) | <= 2 horas | Restauración en una base nueva + validación con la suite oficial. |
| Cadencia de respaldo | Diaria (automática) | Tarea programada del sistema operativo. |
| Cadencia de prueba de restauración | Mensual y tras cada despliegue | Garantiza que el respaldo se puede usar. |

---

## 4. Procedimiento de respaldo (backup)

### 4.1 Respaldo lógico completo (formato custom `-Fc`)

Respalda el esquema (DDL) y los datos en un solo archivo:

```bash
FECHA=$(date +%Y%m%d)
pg_dump -w -h localhost -p 5432 -U postgres -d sigd_qa -Fc \
  -f "backup/sigd_org_v2_${FECHA}.dump"
```

### 4.2 Respaldo solo del esquema `sigd_org` (artefactos DDL)

```bash
FECHA=$(date +%Y%m%d)
pg_dump -w -h localhost -p 5432 -U postgres -d sigd_qa -Fc \
  --schema=sigd_org --schema-only \
  -f "backup/sigd_org_v2_esquema_${FECHA}.dump"
```

### 4.3 Respaldo solo de los datos de `sigd_org`

```bash
FECHA=$(date +%Y%m%d)
pg_dump -w -h localhost -p 5432 -U postgres -d sigd_qa -Fc \
  --schema=sigd_org --data-only \
  -f "backup/sigd_org_v2_datos_${FECHA}.dump"
```

### 4.4 Verificación del respaldo

1. Listar el contenido del archivo sin restaurar, confirmando que incluye los objetos de `sigd_org`:

   ```bash
   pg_restore -l backup/sigd_org_v2_${FECHA}.dump | grep -i "sigd_org" | head -30
   ```

2. Registrar la suma de verificación (integridad del archivo a lo largo del tiempo):

   ```bash
   sha256sum backup/sigd_org_v2_${FECHA}.dump > backup/sigd_org_v2_${FECHA}.dump.sha256
   ```

3. Criterio de aceptación del respaldo: el listado de `pg_restore -l` contiene `TABLE` para las 9 tablas, `FUNCTION` para `actualizar_path_area` y `TRIGGER` para `trg_area_path`.

### 4.5 Convención de nombres, almacenamiento y retención

| Aspecto | Regla |
| :--- | :--- |
| Directorio | Carpeta `backup/` fuera de la base de datos, en disco/almacenamiento de respaldo. |
| Nomenclatura | `sigd_org_v2_YYYYMMDD.dump` (completo), `sigd_org_v2_esquema_YYYYMMDD.dump` y `sigd_org_v2_datos_YYYYMMDD.dump`. |
| Retención diaria | 14 generaciones. |
| Retención semanal | 8 semanas. |
| Retención mensual | 12 meses. |
| Copia adicional | Un respaldo completo debe copiarse a un almacenamiento distinto del servidor (`CONFIRMADO` como buena práctica). |

---

## 5. Procedimiento de restauración

### 5.1 Restauración completa con `pg_restore`

```bash
dropdb --if-exists sigd_restore_test
createdb sigd_restore_test
pg_restore -w -h localhost -p 5432 -U postgres -d sigd_restore_test \
  -v backup/sigd_org_v2_${FECHA}.dump
```

### 5.2 Restauración selectiva del esquema `sigd_org`

```bash
pg_restore -w -h localhost -p 5432 -U postgres -d sigd_restore_test \
  --schema=sigd_org backup/sigd_org_v2_${FECHA}.dump
```

### 5.3 Restauración desde script plano (alternativa `-Fp`)

Si se conservó un respaldo SQL plano:

```bash
psql -w -h localhost -p 5432 -U postgres -d sigd_restore_test \
  -v ON_ERROR_STOP=1 -f backup/sigd_org_v2_${FECHA}.sql
```

---

## 6. Prueba de restauración documentada y repetible

La prueba debe ejecutarse **después de cada despliegue oficial** y, como mínimo, **una vez al mes** (`PROPUESTO`).

### 6.1 Preparación

1. Verificar que existe el respaldo del día y que `sha256sum -c` del `.sha256` pasa.
2. `CONFIRMADO`: la prueba se ejecuta en una base temporal `sigd_restore_test`; nunca se restaura sobre `sigd_qa`.

### 6.2 Ejecución

```bash
FECHA=$(date +%Y%m%d)
dropdb --if-exists sigd_restore_test
createdb sigd_restore_test
pg_restore -w -h localhost -p 5432 -U postgres -d sigd_restore_test \
  backup/sigd_org_v2_${FECHA}.dump
```

### 6.3 Validación de integridad

```bash
psql -d sigd_restore_test -v ON_ERROR_STOP=1 -f 05_validacion_organicore_v2.sql
```

El script termina con `OK: esquema sigd_org y entidades v2 validados` y sin excepciones.

### 6.4 Verificación de inventario de objetos

```sql
-- Tablas esperadas: 9
SELECT COUNT(*) AS tablas_esperadas FROM information_schema.tables
WHERE table_schema = 'sigd_org';

-- Función y trigger esperados: 1 y 1
SELECT COUNT(*) AS funciones_esperadas FROM pg_proc
WHERE pronamespace = 'sigd_org'::regnamespace AND proname = 'actualizar_path_area';
SELECT COUNT(*) AS triggers_esperados FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relnamespace = 'sigd_org'::regnamespace AND NOT t.tgisinternal;

-- Restricciones de exclusión GiST: 2
SELECT COUNT(*) AS exclusiones_esperadas FROM pg_constraint
WHERE connamespace = 'sigd_org'::regnamespace AND contype = 'x';
```

Valores esperados: `9`, `1`, `1`, `2`.

### 6.5 Criterios de aceptación y cierre

| N.º | Criterio `CONFIRMADO` |
| :---: | :--- |
| 1 | El respaldo restaura sin errores en `sigd_restore_test`. |
| 2 | `05_validacion_organicore_v2.sql` termina con `ON_ERROR_STOP=1` sin excepciones. |
| 3 | Existen las 9 tablas, 1 función, 1 trigger y 2 restricciones de exclusión. |
| 4 | No existe la tabla antigua `sigd_org.responsables`. |
| 5 | No se generaron cambios sobre `sigd_qa`. |
| 6 | Resultado y evidencia registrados en la bitácora (sección 8). |

---

## 7. Plan de contingencia ante escenarios de falla

| Escenario | Detección | Acción | Responsable | Tiempo objetivo |
| :--- | :--- | :--- | :--- | :---: |
| Pérdida total de la base `sigd_qa` | Fallo de conexión / restauración fallida de la VM | Restaurar último respaldo en `sigd_qa` y validar con `05_validacion_organicore_v2.sql`. | Héctor + Pool | <= 2 h |
| DROP accidental de objetos de `sigd_org` | Error de aplicación o revisión de Catálogo | Restauración selectiva (`--schema=sigd_org`) en `sigd_qa`. | Héctor + Panaifo | <= 1 h |
| Despliegue fallido a medias | `ON_ERROR_STOP` detiene el script | Recrear base desde cero con `03_esquema_sigd_org_v2.sql` y restaurar datos. | Panaifo | <= 2 h |
| Corrupción del respaldo | Falla el `sha256sum -c` | Usar respaldo anterior íntegro y re-base con el DDL fuente. | Héctor | <= 2 h |
| Falla de infraestructura/almacenamiento | Pérdida de disco / copia de respaldo | Usar la copia en almacenamiento secundario (sección 4.5). | Héctor | <= 2 h |

---

## 8. Bitácora de ejecuciones (evidencia)

| Fecha | Respaldo usado | Base restaurada | Resultado validación | Responsable |
| :--- | :--- | :--- | :--- | :--- |
| Pendiente | `sigd_org_v2_<YYYYMMDD>.dump` | `sigd_restore_test` | OK / FALLÓ | Héctor · `B_HECTOR` |

Reglas `CONFIRMADO`:

- Cada prueba de restauración se registra en esta bitácora con la salida de `05_validacion_organicore_v2.sql` adjunta.
- La prueba de restauración exitosa es condición para declarar cerrado el despliegue de la Fase 2.

---

## 9. Cierre formal

Con este plan, el esquema `sigd_org` v2 dispone de un procedimiento oficial de respaldo y de una prueba de restauración repetible y documentada, alineada con la suite de validación oficial `05_validacion_organicore_v2.sql`. La ejecución de estas rutinas corresponde a `B_HECTOR` y la supervisión de la integración queda en `B_POOL`.

| Autor (QA / Respaldo) | Sublíder OrganiCore | Fecha de Conformidad |
| :--- | :--- | :--- |
| **Héctor** · `B_HECTOR` | **Pool** · `B_POOL` | Pendiente de Revisión |
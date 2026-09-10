# Notas Técnicas y Prevención de Ciclos
## Módulo OrganiCore v2 — Esquema `sigd_org`

- Responsable: Geiner Panaifo
- Rama: `B_PANAIFO`
- Grupo: Grupo 3 — OrganiCore
- Versión: 2.0 (Alineada a Fase 2 / `sigd_org`)
- Fecha: 2026-09-08

---

## 0. Alineación con Fase 2 / `sigd_org`

Esta documentación sustituye las notas técnicas del borrador de Fase 1
(antes `05_B_PANAIFO_NOTAS_TECNICAS.md`). Toda la parte técnica y SQL de
Panaifo queda alineada con el esquema oficial consolidado **`sigd_org`**.

### Cambios estructurales aplicados

| Fase 1 (BORRADOR / LEGACY) | Fase 2 (Oficial `sigd_org`) |
| :--- | :--- |
| Esquema `public` | Esquema `sigd_org` |
| `id BIGSERIAL` / `BIGINT` | `id_area UUID ... DEFAULT gen_random_uuid()` |
| `areas`, `cargos`, `responsables` | `sigd_org.area`, `sigd_org.cargo`, `sigd_org.asignacion_personal` |
| Sin ruta jerárquica | `path VARCHAR(255)` (Materialized Path) + `nivel_organizacional` |
| Prevención de ciclos pendiente | `sigd_org.fn_area_set_path` (SQLSTATE `23514`) |
| `WITH RECURSIVE` para descendientes | `LIKE path || '%'` con `idx_area_path_pattern` |
| Contrato con identidad por número entero | `cuenta_id UUID` (contrato con `sigd_auth.cuenta_usuario`) |

La clave primaria de `sigd_org.area` usa la **nomenclatura contractual
`id_area`** (tipo UUID), en lugar de `area_id`, para que los consumidores
externos (RutaDoc) validen origen y destino con el mismo nombre de columna.

### Estado de los scripts SQL

- **LEGACY (no usar):** `03_organizacion_roles_permisos.sql`,
  `03_datos_prueba_organizacion.sql`, `03_verificacion_organizacion.sql`.
- **OFICIALES:** `03_esquema_sigd_org_v2.sql` (DDL) y
  `05_validacion_organicore_v2.sql` (suite de QA automatizada).
  La ejecución y criterios de aceptación se documentan en
  `04_validacion_organicore_v2.md`.

---

## 1. Esquema `sigd_org` e identidades UUID

Las claves pasan de `BIGSERIAL`/`BIGINT` (Fase 1) a `UUID` generados con
`pgcrypto` (`gen_random_uuid()`). Todo el módulo vive en el esquema
`public` → `sigd_org`.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS sigd_org;

CREATE TABLE IF NOT EXISTS sigd_org.area (
    id_area UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    sigla VARCHAR(20) NOT NULL UNIQUE,
    parent_id UUID REFERENCES sigd_org.area(id_area) ON DELETE RESTRICT,
    path VARCHAR(255) NOT NULL,
    nivel_organizacional INTEGER NOT NULL DEFAULT 1,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_area_nivel CHECK (nivel_organizacional > 0),
    CONSTRAINT ck_area_path_format CHECK (path LIKE '/%/')
);
```

Notas:

- `parent_id` usa `ON DELETE RESTRICT`: no se elimina físicamente un área que
  tenga hijos, se administra mediante `activo` (soft-delete, ver
  `07_politica_eliminaciones_logicas.md`).
- `cuenta_id` en `asignacion_personal`, `encargatura_despacho` y
  `usuario_rol` es `UUID` y representa el contrato con
  `sigd_auth.cuenta_usuario`. La FK física se añade en la migración de
  integración cuando ambos módulos compartan el mismo tipo de identidad.

---

## 2. Materialized Path (decisión definitiva)

La jerarquía de áreas usa de forma definitiva el patrón **Materialized Path**
en lugar de consultas recursivas. Cada fila almacena la ruta absoluta desde la
raíz y su profundidad:

- `path`: prefijo absoluto de UUID con separador `/` y **incluye el propio
  nodo**, terminando siempre en `/`. Formato: `/raiz/hijo/nieto/`.
- `nivel_organizacional`: profundidad (raíz = 1, hijo = 2, nieto = 3, ...).
- `idx_area_path_pattern` (B-Tree con `varchar_pattern_ops`) permite usar
  `LIKE` con prefijos parametrizados sin degradar a escaneo completo.

```sql
CREATE INDEX IF NOT EXISTS idx_area_path_pattern
    ON sigd_org.area (path varchar_pattern_ops);
```

### Consulta de descendientes sin `WITH RECURSIVE`

**Se elimina la aproximación de la Fase 1 con `WITH RECURSIVE`.** Con el
prefijo materializado, descendientes y subárboles se obtienen en una sola
consulta indexable:

```sql
SELECT id_area, sigla, path, nivel_organizacional
FROM sigd_org.area
WHERE path LIKE (SELECT path FROM sigd_org.area WHERE id_area = :raiz_id) || '%'
ORDER BY path;
```

Ancestros: se recorre el propio `path` dividiéndolo por `/` (conocido por el
cliente sin cruzar la jerarquía). No se necesita ningún CTE recursivo.

---

## 3. Trigger `fn_area_set_path`

El trigger `trg_area_set_path` (antes del `INSERT` o del cambio de
`parent_id`) calcula `path` y `nivel_organizacional` en la base de datos,
centralizando la definición de la jerarquía:

```sql
CREATE OR REPLACE FUNCTION sigd_org.fn_area_set_path()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    parent_path VARCHAR(255);
    parent_level INTEGER;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path := '/' || NEW.id_area::text || '/';
        NEW.nivel_organizacional := 1;
    ELSE
        IF NEW.parent_id = NEW.id_area THEN
            RAISE EXCEPTION 'Un área no puede ser hija de sí misma'
                USING ERRCODE = '23514';
        END IF;

        SELECT a.path, a.nivel_organizacional
          INTO parent_path, parent_level
          FROM sigd_org.area AS a
         WHERE a.id_area = NEW.parent_id
         FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El área padre % no existe', NEW.parent_id
                USING ERRCODE = '23503';
        END IF;

        IF TG_OP = 'UPDATE'
           AND NEW.parent_id IS DISTINCT FROM OLD.parent_id
           AND parent_path LIKE OLD.path || '%' THEN
            RAISE EXCEPTION
                'Movimiento inválido: el área % no puede depender de su descendiente %',
                NEW.id_area, NEW.parent_id
                USING ERRCODE = '23514';
        END IF;

        NEW.path := parent_path || NEW.id_area::text || '/';
        NEW.nivel_organizacional := parent_level + 1;
    END IF;

    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_area_set_path
BEFORE INSERT OR UPDATE OF parent_id ON sigd_org.area
FOR EACH ROW
EXECUTE FUNCTION sigd_org.fn_area_set_path();
```

Qué hace en cada operación:

1. **Raíz** (`parent_id IS NULL`): fija `path = '/<id_area>/'` y nivel 1.
2. **Hijo**: lee la ruta y el nivel del padre (`SELECT ... FOR SHARE`,
   evitando condiciones de carrera con reposicionamientos simultáneos) y
   construye `path = parent_path || '<id_area>/'`, `nivel = parent_level + 1`.
3. **Validaciones íntegras**: ver sección 4.

---

## 4. Prevención de ciclos: directos e indirectos (SQLSTATE `23514`)

La clave foránea de `parent_id` garantiza que un área exista en su momento,
pero **no puede impedir ciclos**. Un `CHECK`/`EXCLUDE` tampoco: dependen solo
de los valores de la propia fila, y un ciclo depende del estado de otras filas.
La prevención se cierra a nivel de base de datos con el trigger
`fn_area_set_path`, independientemente de la aplicación.

### 4.1 Ciclo directo

Un área no puede ser hija de sí misma:

```sql
IF NEW.parent_id = NEW.id_area THEN
    RAISE EXCEPTION 'Un área no puede ser hija de sí misma'
        USING ERRCODE = '23514';
END IF;
```

### 4.2 Ciclo indirecto (reposicionamiento)

Al mover un área (UPDATE de `parent_id`), se comprueba si el nuevo padre es
**ella misma o uno de sus descendientes**. La verificación es explícita: si el
`path` del nuevo padre comienza con el `path` de la fila que se mueve, el nuevo
padre pertenece al subárbol del nodo actual y moverse bajo él formaría el ciclo
`A → ... → A`:

```sql
IF TG_OP = 'UPDATE'
   AND NEW.parent_id IS DISTINCT FROM OLD.parent_id
   AND parent_path LIKE OLD.path || '%' THEN
    RAISE EXCEPTION 'Movimiento inválido: el área % no puede depender de su descendiente %', ...
        USING ERRCODE = '23514';
END IF;
```

Justificación lógica: si `parent_path LIKE OLD.path || '%'`, el nuevo padre
es un descendiente del área movida (nodo actual), luego `área → padre → … → área`
es un ciclo. La suite cubre el caso de una raíz bajo su nieto (QA-004) y el de
un nodo intermedio bajo su propio descendiente (QA-005). En un `INSERT` el área
no tiene descendientes todavía, por lo que solo aplica la comprobación en
`UPDATE`.

### 4.3 Uso del código `23514`

PostgreSQL asigna `23514` (`check_violation`) a las restricciones `CHECK`;
aquí se **reutiliza deliberadamente** como código de error estable para la
aplicación y la suite de QA. El cliente y los casos de prueba pueden distinguir
el rechazo de ciclos sin depender del texto del mensaje:

```sql
EXCEPTION WHEN SQLSTATE '23514' THEN
    NULL; -- esperado: el ciclo fue rechazado
```

La suite oficial `05_validacion_organicore_v2.sql` cubre ambos escenarios
(«Ciclo directo» e «Ciclo indirecto») y verifica que ambas sentencias fallen
con `SQLSTATE '23514'`. Cuando el área madre no existe, el trigger emite
`23503` (`foreign_key_violation`).

---

## 5. Propagación de cambios de ruta (movimiento de subárboles)

Cuando se reposiciona un área, su `path` cambia y los de sus descendientes
quedarían desactualizados. El trigger posterior `fn_area_propagate_path`
**reescribe todo el subárbol en una sola instrucción**: como los descendientes
comparten el prefijo `OLD.path` (Materialized Path), basta sustituir ese prefijo
por `NEW.path` y corregir el nivel con el mismo delta que aplicó al nodo movido:

```sql
CREATE OR REPLACE FUNCTION sigd_org.fn_area_propagate_path()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Reescritura en cascada en una sola instrucción.
    UPDATE sigd_org.area AS d
       SET path = NEW.path || substr(d.path, char_length(OLD.path) + 1),
           nivel_organizacional = d.nivel_organizacional
                                  + (NEW.nivel_organizacional - OLD.nivel_organizacional),
           actualizado_en = now()
     WHERE d.path LIKE OLD.path || '%'
       AND d.id_area <> NEW.id_area;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_area_propagate_path
AFTER UPDATE OF parent_id ON sigd_org.area
FOR EACH ROW
WHEN (OLD.path IS DISTINCT FROM NEW.path)
EXECUTE FUNCTION sigd_org.fn_area_propagate_path();
```

Esta estrategia garantiza que **todos** los descendientes del subárbol se
actualicen en cascada en una sola sentencia (sin depender del re-disparo
recursivo de triggers ni de actualizaciones no-op de `parent_id`). La suite
valida la propagación del prefijo (QA-003), el ajuste del nivel con delta
(QA-006) y que los rechazos de ciclos no corrompan el organigrama (QA-007).

---

## 6. Índices para la jerarquía

| Índice | Propósito |
| :--- | :--- |
| `idx_area_parent_id` | Consultas por padre (hijos directos) y reposicionamientos |
| `idx_area_path_pattern` | Consultas `LIKE` de subárbol sobre `path` (`varchar_pattern_ops`) |

---

## 7. Vigencia de encargaturas (recordatorio técnico)

- `periodo_vigencia TSTZRANGE` con restricción de exclusión GiST
  (`ex_encargatura_cargo_periodo`): impide que el mismo cargo tenga dos
  encargaturas vigentes solapadas. La suite valida solapamiento parcial
  (QA-008), adyacencia válida con bordes medio-abiertos (QA-009) y
  solapamiento por punto en borde inclusivo (QA-010).
- La autorización se evalúa con `usuario_tiene_facultad_despacho()` mediante
  `periodo_vigencia @> p_momento`: fuera del rango se rechaza sin necesidad de
  jobs de desactivación.
- La vigencia de la facultad (`vigente_desde`/`vigente_hasta`) se evalúa con
  **`p_momento::date` y nunca con `CURRENT_DATE`**, garantizando un resultado
  determinista y reproducible (QA-011 y QA-012 cubren los casos donde
  `CURRENT_DATE` habría arrojado un resultado distinto).

---

## 8. Criterios de aceptación y validación

| Caso | Evidencia | Resultado esperado |
| :--- | :--- | :--- |
| Path materializado | `area.path` + `idx_area_path_pattern` + `LIKE` | QA-001 OK |
| Ciclo directo | Trigger `fn_area_set_path` → `23514` | QA-002 OK |
| Ciclo indirecto | Trigger `fn_area_set_path` → `23514` | QA-004/QA-005 OK |
| Propagación de subárbol | `fn_area_propagate_path` (una sola sentencia) | QA-003/QA-006/QA-007 OK |
| Solapamiento de encargaturas | `EXCLUDE ... USING GIST` | QA-008/QA-009/QA-010 OK |
| ABAC estricto con `p_momento` | `usuario_tiene_facultad_despacho()` | QA-011 a QA-014 OK |

Ejecutar:

```bash
psql -v ON_ERROR_STOP=1 -f 03_esquema_sigd_org_v2.sql sigd_qa
psql -v ON_ERROR_STOP=1 -f 05_validacion_organicore_v2.sql sigd_qa
```

La suite muestra `OK: OrganiCore v2 supero la suite automatizada` si todos los
casos pasan y deja el log de ejecución real en la tabla temporal `log_pruebas`.
Detalles en `04_validacion_organicore_v2.md` y log de ejemplo en
`logs/ejecucion_suite_organicore_v2.log`.

---

## Referencias

- **Esquema oficial:** `03_esquema_sigd_org_v2.sql` (DDL `sigd_org`, UUID, path).
- **Validación:** `05_validacion_organicore_v2.sql` · `04_validacion_organicore_v2.md`.
- **Observación de Fase 2:** `docs/levantamiento_de_observaciones/03_plan_levantamiento_observaciones_grupo_3_organicore.md`.
- **Base de datos:** PostgreSQL 18+ · **Estándar:** SQL ISO/IEC 9075.
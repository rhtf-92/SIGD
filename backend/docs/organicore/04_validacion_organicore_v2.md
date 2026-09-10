# Validacion tecnica OrganiCore v2

**Responsable:** B_PANAIFO  
**Motor objetivo:** PostgreSQL 18+  
**Estado:** EJECUTADO en ambiente de QA (log real en `logs/ejecucion_suite_organicore_v2.log`)

> Los UUID usados en estos casos son datos ficticios. `cuenta_id` es el contrato
> con `sigd_auth.cuenta_usuario`; el DDL no crea datos ni credenciales de IdentiCore.
> La clave primaria de `sigd_org.area` usa la nomenclatura contractual `id_area`
> (tipo UUID), contrato consumido por RutaDoc para validar origen y destino.

## 1. Preparacion

Ejecutar el DDL en una base de QA vacia:

```bash
psql -v ON_ERROR_STOP=1 -f 03_esquema_sigd_org_v2.sql sigd_qa
psql -v ON_ERROR_STOP=1 -f 05_validacion_organicore_v2.sql sigd_qa
```

La segunda instruccion ejecuta la suite automatizada y muestra
`OK: OrganiCore v2 supero la suite automatizada` si todos los casos pasan.
La suite usa una transaccion, escribe cada resultado en la tabla temporal
`log_pruebas`, imprime ese log de ejecucion real y revierte sus datos con
`ROLLBACK`. Un ejemplo de ejecucion real (14/14 OK) esta en
`logs/ejecucion_suite_organicore_v2.log`.

Verificar extensiones e indices:

```sql
SELECT extname FROM pg_extension
WHERE extname IN ('pgcrypto', 'btree_gist');

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'sigd_org'
  AND tablename = 'area';
```

Resultado esperado: aparecen `pgcrypto`, `btree_gist`, el indice de `parent_id`
y el indice `idx_area_path_pattern`.

### Cobertura de la suite automatizada

| Caso | Validacion |
| :--- | :--- |
| QA-001 | Path materializado y niveles de la estructura inicial |
| QA-002 | Ciclo directo rechazado (SQLSTATE 23514) |
| QA-003 | Movimiento de subarbol con propagacion en cascada del path |
| QA-004 | Ciclo indirecto: raiz bajo su descendiente (SQLSTATE 23514) |
| QA-005 | Ciclo indirecto: nodo intermedio bajo su descendiente (SQLSTATE 23514) |
| QA-006 | Reposicionamiento con delta de nivel y restauracion |
| QA-007 | Integridad del arbol tras rechazos y reposicionamientos |
| QA-008 | Solapamiento parcial de encargaturas (exclusion GiST) |
| QA-009 | Adyacencia valida entre encargaturas (bordes medio-abiertos) |
| QA-010 | Solapamiento por punto en borde inclusivo (TSTZRANGE) |
| QA-011 | ABAC: evaluacion estricta con `p_momento` (facultad futura) |
| QA-012 | ABAC: evaluacion estricta con `p_momento` (facultad vencida) |
| QA-013 | ABAC: facultad vigente dentro del periodo (autoriza) |
| QA-014 | ABAC: encargatura expirada respecto a `p_momento` (deniega) |

## 2. Materialized Path y consulta de descendientes

**Objetivo:** confirmar que el trigger calcula la ruta y que la consulta usa el
prefijo materializado sin `WITH RECURSIVE`.

```sql
INSERT INTO sigd_org.area (nombre, sigla)
VALUES ('Direccion General de Prueba', 'DGP')
RETURNING id_area, path, nivel_organizacional;

-- Guardar el UUID de DGP en :raiz_id en el cliente psql.
INSERT INTO sigd_org.area (nombre, sigla, parent_id)
VALUES ('Oficina de Sistemas de Prueba', 'OSP', :'raiz_id')
RETURNING id_area, path, nivel_organizacional;

-- Guardar el UUID de OSP en :sistemas_id.
INSERT INTO sigd_org.area (nombre, sigla, parent_id)
VALUES ('Desarrollo de Prueba', 'DES', :'sistemas_id');

SELECT id_area, sigla, path, nivel_organizacional
FROM sigd_org.area
WHERE path LIKE (SELECT path FROM sigd_org.area WHERE id_area = :'raiz_id') || '%'
ORDER BY path;
```

Resultado esperado: se listan DGP, OSP y DES; sus niveles son 1, 2 y 3. La
consulta aprovecha `idx_area_path_pattern` cuando el prefijo es constante o
parametrizado por la aplicacion.

## 3. Rechazo de ciclos jerarquicos

**Objetivo:** impedir que un area dependa de si misma o de un descendiente
(ciclos directos e indirectos, detectados en el trigger `fn_area_set_path`).

```sql
-- Ciclo directo: debe fallar con SQLSTATE 23514.
UPDATE sigd_org.area
SET parent_id = id_area
WHERE sigla = 'DGP';

-- Ciclo indirecto: DES no puede convertirse en padre de DGP.
UPDATE sigd_org.area AS raiz
SET parent_id = (SELECT id_area FROM sigd_org.area WHERE sigla = 'DES')
WHERE raiz.sigla = 'DGP';

-- Ciclo indirecto en nodo intermedio: OSP no puede depender de su descendiente DES.
UPDATE sigd_org.area AS medio
SET parent_id = (SELECT id_area FROM sigd_org.area WHERE sigla = 'DES')
WHERE medio.sigla = 'OSP';
```

Resultado esperado: las tres instrucciones fallan con el mensaje de movimiento
invalido y no modifican el organigrama. La suite (QA-002, QA-004 y QA-005)
verifica ademas que los rechazos no corrompen el arbol (QA-007) y que mover un
subarbol completo actualiza en cascada `path` y `nivel_organizacional` de todos
los descendientes (QA-003 y QA-006).

## 4. Encargatura y exclusion de solapamientos

Preparar un cargo, una facultad y una asignacion ficticios:

```sql
INSERT INTO sigd_org.cargo (nombre, es_titular_despacho)
VALUES ('Director de Prueba', TRUE)
RETURNING cargo_id;

-- Guardar el UUID en :cargo_id.
INSERT INTO sigd_org.facultad_despacho
    (cargo_id, codigo, puede_firmar, vigente_desde)
VALUES
    (:'cargo_id', 'FIRMA_RESOLUCION', TRUE, CURRENT_DATE);

INSERT INTO sigd_org.encargatura_despacho
    (cuenta_titular_id, cuenta_suplente_id, id_area, cargo_id,
     tipo_encargatura, documento_sustento, periodo_vigencia)
VALUES
    ('00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     :'raiz_id', :'cargo_id', 'SUPLENTE', 'RD-0001-2026',
     tstzrange('2026-09-01 00:00+00', '2026-10-01 00:00+00', '[)'));

-- Debe fallar por ex_encargatura_cargo_periodo.
INSERT INTO sigd_org.encargatura_despacho
    (cuenta_titular_id, cuenta_suplente_id, id_area, cargo_id,
     tipo_encargatura, documento_sustento, periodo_vigencia)
VALUES
    ('00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000003',
     :'raiz_id', :'cargo_id', 'DELEGADO', 'RD-0002-2026',
     tstzrange('2026-09-15 00:00+00', '2026-10-15 00:00+00', '[)'));
```

Resultado esperado: la primera encargatura se inserta y la segunda es
rechazada por solaparse para el mismo cargo. Dos encargaturas del mismo cargo
con periodos adyacentes, por ejemplo `[2026-10-01, 2026-11-01)`, sí son
validas porque un `TSTZRANGE` medio-abierto `[)` no contiene su extremo.
El borde inclusivo `[]` sí solapa: la suite QA-010 prueba que `[..., 2026-12-01]`
y `[2026-12-01, ...)` comparten el instante 2026-12-01 00:00+00 y la exclusion
GiST los rechaza.

## 5. Facultad vigente y expiracion automatica

La funcion centraliza la decision temporal usando `TSTZRANGE @>` y evalua
**estrictamente el parametro `p_momento`** (nunca `CURRENT_DATE`): la vigencia
de la facultad (`vigente_desde`/`vigente_hasta`) se compara contra
`p_momento::date`, de modo que el resultado es determinista y reproducible.

```sql
SELECT sigd_org.usuario_tiene_facultad_despacho(
    '00000000-0000-0000-0000-000000000002',
    :'raiz_id',
    :'cargo_id',
    '2026-09-20 12:00+00'
) AS vigente;

SELECT sigd_org.usuario_tiene_facultad_despacho(
    '00000000-0000-0000-0000-000000000002',
    :'raiz_id',
    :'cargo_id',
    '2026-10-01 00:00+00'
) AS expirado;
```

Resultado esperado: `vigente = true` y `expirado = false`. No se requiere un
job para desactivar registros: fuera del rango la funcion deja de autorizar.
Los casos QA-011 y QA-012 garantizan que una facultad futura o vencida respecto
a `p_momento` se rechaza aun cuando `CURRENT_DATE` hubiera estado dentro de la
vigencia (regresion que el codigo viejo no detectaba).

## 6. Criterios de aceptacion

| Caso | Evidencia | Resultado |
| :--- | :--- | :--- |
| Path materializado | `area.path`, indice B-Tree y consulta por `LIKE` | QA-001 OK |
| Ciclo directo e indirecto | Trigger `fn_area_set_path` devuelve SQLSTATE 23514 | QA-002/QA-004/QA-005 OK |
| Movimiento de subarboles | Propagacion en cascada de `path` y niveles | QA-003/QA-006/QA-007 OK |
| Solapamiento | `EXCLUDE GiST` por `cargo_id` y `periodo_vigencia` | QA-008/QA-009/QA-010 OK |
| ABAC con `p_momento` estricto | Facultad futura/vencida segun `p_momento` | QA-011/QA-012/QA-013/QA-014 OK |
| FK a IdentiCore | Contrato UUID pendiente de alineacion con `sigd_auth` | PENDIENTE |

Ejecucion real registrada en `logs/ejecucion_suite_organicore_v2.log`
(14/14 casos OK).

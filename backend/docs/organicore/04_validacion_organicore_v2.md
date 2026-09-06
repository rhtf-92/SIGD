# Validacion tecnica OrganiCore v2

**Responsable:** B_PANAIFO  
**Motor objetivo:** PostgreSQL 18+  
**Estado:** PROPUESTO para ejecucion en ambiente de QA

> Los UUID usados en estos casos son datos ficticios. `cuenta_id` es el contrato
> con `sigd_auth.cuenta_usuario`; el DDL no crea datos ni credenciales de IdentiCore.

## 1. Preparacion

Ejecutar el DDL en una base de QA vacia:

```bash
psql -v ON_ERROR_STOP=1 -f 03_esquema_sigd_org_v2.sql sigd_qa
psql -v ON_ERROR_STOP=1 -f 05_validacion_organicore_v2.sql sigd_qa
```

La segunda instruccion ejecuta la suite automatizada y muestra
`OK: OrganiCore v2 supero la suite automatizada` si todos los casos pasan.
La suite usa una transaccion y revierte sus datos con `ROLLBACK`.

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

## 2. Materialized Path y consulta de descendientes

**Objetivo:** confirmar que el trigger calcula la ruta y que la consulta usa el
prefijo materializado sin `WITH RECURSIVE`.

```sql
INSERT INTO sigd_org.area (nombre, sigla)
VALUES ('Direccion General de Prueba', 'DGP')
RETURNING area_id, path, nivel_organizacional;

-- Guardar el UUID de DGP en :raiz_id en el cliente psql.
INSERT INTO sigd_org.area (nombre, sigla, parent_id)
VALUES ('Oficina de Sistemas de Prueba', 'OSP', :'raiz_id')
RETURNING area_id, path, nivel_organizacional;

-- Guardar el UUID de OSP en :sistemas_id.
INSERT INTO sigd_org.area (nombre, sigla, parent_id)
VALUES ('Desarrollo de Prueba', 'DES', :'sistemas_id');

SELECT area_id, sigla, path, nivel_organizacional
FROM sigd_org.area
WHERE path LIKE (SELECT path FROM sigd_org.area WHERE area_id = :'raiz_id') || '%'
ORDER BY path;
```

Resultado esperado: se listan DGP, OSP y DES; sus niveles son 1, 2 y 3. La
consulta aprovecha `idx_area_path_pattern` cuando el prefijo es constante o
parametrizado por la aplicacion.

## 3. Rechazo de ciclos jerarquicos

**Objetivo:** impedir que un area dependa de si misma o de un descendiente.

```sql
-- Ciclo directo: debe fallar con SQLSTATE 23514.
UPDATE sigd_org.area
SET parent_id = area_id
WHERE sigla = 'DGP';

-- Ciclo indirecto: DES no puede convertirse en padre de DGP.
UPDATE sigd_org.area AS raiz
SET parent_id = (SELECT area_id FROM sigd_org.area WHERE sigla = 'DES')
WHERE raiz.sigla = 'DGP';
```

Resultado esperado: ambas instrucciones fallan con el mensaje de movimiento
invalido y no modifican el organigrama.

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
    (cuenta_titular_id, cuenta_suplente_id, area_id, cargo_id,
     tipo_encargatura, documento_sustento, periodo_vigencia)
VALUES
    ('00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     :'raiz_id', :'cargo_id', 'SUPLENTE', 'RD-0001-2026',
     tstzrange('2026-09-01 00:00+00', '2026-10-01 00:00+00', '[)'));

-- Debe fallar por ex_encargatura_cargo_periodo.
INSERT INTO sigd_org.encargatura_despacho
    (cuenta_titular_id, cuenta_suplente_id, area_id, cargo_id,
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
validas.

## 5. Facultad vigente y expiracion automatica

La funcion centraliza la decision temporal usando `TSTZRANGE @>`:

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

## 6. Criterios de aceptacion

| Caso | Evidencia | Resultado |
| :--- | :--- | :--- |
| Path materializado | `area.path`, indice B-Tree y consulta por `LIKE` | PROPUESTO: ejecutar suite |
| Ciclo directo e indirecto | Trigger `fn_area_set_path` devuelve SQLSTATE 23514 | PROPUESTO: ejecutar suite |
| Solapamiento | `EXCLUDE GiST` por `cargo_id` y `periodo_vigencia` | PROPUESTO: ejecutar suite |
| Expiracion | `usuario_tiene_facultad_despacho` con fecha dentro/fuera | PROPUESTO: ejecutar suite |
| FK a IdentiCore | Contrato UUID pendiente de alineacion con `sigd_auth` | PENDIENTE |

# B_PANAIFO - Política de Eliminaciones Lógicas y Vigencias

**Versión:** 2.0  
**Fecha:** 2026-09-08  
**Estado:** Aprobado para el esquema `sigd_org`

## 1. Alcance

Esta política define la conservación histórica y la desactivación lógica de las entidades maestras del módulo OrganiCore. La versión oficial se aplica exclusivamente dentro del esquema `sigd_org`.

Entidades cubiertas:

- `sigd_org.area`
- `sigd_org.cargo`
- `sigd_org.rol_sistema`
- `sigd_org.permiso_sistema`
- `sigd_org.asignacion_area`
- `sigd_org.encargatura_despacho`

## 2. Entidades maestras: `activo BOOLEAN DEFAULT TRUE`

Las tablas `area`, `cargo`, `rol_sistema` y `permiso_sistema` usan la columna:

```sql
activo BOOLEAN NOT NULL DEFAULT TRUE
```

La desactivación se realiza mediante `UPDATE`; no se permite eliminar físicamente registros que puedan estar referenciados por operaciones, asignaciones, permisos o auditoría.

Ejemplo:

```sql
UPDATE sigd_org.area
SET activo = FALSE
WHERE id = $1;
```

Las consultas operativas deben filtrar `activo = TRUE`. Las consultas históricas pueden incluir registros inactivos expresamente.

## 3. Eliminación física

No se deben ejecutar `DELETE` sobre:

- `sigd_org.area`
- `sigd_org.cargo`
- `sigd_org.rol_sistema`
- `sigd_org.permiso_sistema`

Las relaciones históricas deben conservarse para mantener la integridad referencial y la trazabilidad. La eliminación física solo podrá evaluarse mediante un procedimiento formal de retención documental y aprobación institucional; no forma parte del despliegue ordinario.

## 4. Sustitución de `responsables`

La tabla antigua `responsables` queda eliminada del modelo oficial. No se debe crear, poblar ni referenciar en el esquema v2.

Sus responsabilidades se separan en:

- `sigd_org.asignacion_area`: asignación de una persona usuaria a un área, cargo y periodo de vigencia.
- `sigd_org.encargatura_despacho`: encargatura o suplencia temporal de una facultad de despacho, con sustento y periodo propio.

La finalización de una asignación o encargatura se registra cerrando su rango de vigencia, nunca borrando el registro.

## 5. `sigd_org.asignacion_area`

Esta entidad reemplaza el uso de `responsables` para las asignaciones ordinarias. Debe conservar el historial de usuario, área, cargo, titularidad y vigencia mediante un rango `TSTZRANGE`.

La vigencia se consulta con el operador de inclusión de rangos:

```sql
SELECT *
FROM sigd_org.asignacion_area
WHERE vigencia @> CURRENT_TIMESTAMP;
```

La asignación debe impedir solapamientos incompatibles dentro de la misma área y cargo mediante una restricción de exclusión GiST:

```sql
ALTER TABLE sigd_org.asignacion_area
ADD CONSTRAINT excl_asignacion_area_vigencia
EXCLUDE USING gist (
    area_id WITH =,
    cargo_id WITH =,
    vigencia WITH &&
);
```

El índice GiST requerido para operar con rangos y exclusiones debe existir en la tabla según el entregable oficial v2.

## 6. `sigd_org.encargatura_despacho`

Esta entidad registra una encargatura o suplencia temporal y su facultad de despacho. Debe incluir el área, usuario, facultad o rol aplicable, sustento administrativo y un rango `TSTZRANGE` para determinar su vigencia.

Las encargaturas no se eliminan físicamente. Para finalizar una encargatura se actualiza el límite superior de `periodo_vigencia`, conservando el registro y su evidencia.

La base de datos debe impedir encargaturas solapadas incompatibles mediante una restricción de exclusión GiST, por ejemplo:

```sql
ALTER TABLE sigd_org.encargatura_despacho
ADD CONSTRAINT excl_encargatura_despacho_vigencia
EXCLUDE USING gist (
    area_id WITH =,
    cargo_id WITH =,
    periodo_vigencia WITH &&
);
```

La definición exacta de las columnas y claves corresponde a `03_esquema_sigd_org_v2.sql`.

## 7. Reglas operativas

1. Los registros maestros se desactivan con `activo = FALSE`.
2. Las asignaciones y encargaturas se cierran modificando su `TSTZRANGE`.
3. No se crea ni se utiliza la tabla `responsables`.
4. Los rangos deben ser válidos y no deben solaparse cuando la regla de exclusión aplique.
5. Las consultas operativas solo consideran entidades maestras activas y vigencias que contengan el instante consultado.
6. Las consultas históricas conservan acceso a registros inactivos y rangos finalizados.
7. Los cambios deben ejecutarse mediante el backend y quedar registrados en la auditoría institucional.

## 8. Validación y entregables oficiales

La política se valida con el esquema y las pruebas oficiales de la Fase 2:

- `03_esquema_sigd_org_v2.sql`
- `04_validacion_organicore_v2.md`
- `05_validacion_organicore_v2.sql`

La validación debe confirmar la existencia de `activo`, la ausencia de `responsables`, las entidades de asignación y encargatura, los rangos `TSTZRANGE` y los índices o restricciones de exclusión GiST.

**Resultado:** política de eliminaciones lógicas y vigencias actualizada para `sigd_org`.

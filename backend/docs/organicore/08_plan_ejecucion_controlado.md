# B_PANAIFO - Plan de Ejecución Controlado

**Versión:** 2.0  
**Fecha:** 2026-09-08  
**Estado:** Despliegue oficial de la Fase 2

## 1. Prerrequisitos

- PostgreSQL 18.6 o superior.
- Cliente `psql` disponible en el entorno de ejecución.
- Usuario con permisos para crear bases de datos, esquemas, tablas, índices y restricciones.
- Los tres entregables oficiales de OrganiCore disponibles en el mismo directorio:
  - `03_esquema_sigd_org_v2.sql`
  - `04_validacion_organicore_v2.md`
  - `05_validacion_organicore_v2.sql`

## 2. Despliegue oficial en QA

Ejecutar desde el directorio de los entregables:

```bash
createdb sigd_qa
psql -d sigd_qa -v ON_ERROR_STOP=1 -f 03_esquema_sigd_org_v2.sql
psql -d sigd_qa -v ON_ERROR_STOP=1 -f 05_validacion_organicore_v2.sql
```

El archivo `04_validacion_organicore_v2.md` contiene la matriz y la interpretación de los resultados de validación. No se ejecuta con `psql` porque es documentación.

## 3. Criterios de aceptación

El despliegue se considera correcto cuando:

- Se crea la base `sigd_qa` sin errores.
- El esquema `sigd_org` existe.
- Las tablas oficiales usan la nomenclatura v2.
- Las entidades maestras tienen `activo BOOLEAN NOT NULL DEFAULT TRUE`.
- No existe la tabla `responsables` en el modelo oficial.
- Existen `sigd_org.asignacion_area` y `sigd_org.encargatura_despacho`.
- Las vigencias usan `TSTZRANGE`.
- Las restricciones e índices de exclusión GiST están creados.
- El script `05_validacion_organicore_v2.sql` termina sin errores con `ON_ERROR_STOP=1`.

## 4. Entregables oficiales

1. `03_esquema_sigd_org_v2.sql`: creación del esquema, tablas, restricciones e índices.
2. `04_validacion_organicore_v2.md`: matriz de validación y criterios de aceptación.
3. `05_validacion_organicore_v2.sql`: consultas y pruebas ejecutables de validación.
4. `10_plan_respaldo_contingencia_sigd_org_v2.md`: procedimientos de respaldo (backup) y prueba de restauración de los artefactos del esquema `sigd_org` v2. *(B_HECTOR)*

## 5. Cierre de la Fase 2

Después de ejecutar el despliegue y revisar los resultados:

1. Registrar la fecha, base de datos y versión de PostgreSQL utilizada.
2. Conservar la salida de `05_validacion_organicore_v2.sql` como evidencia.
3. Confirmar que no existen errores de integridad, solapamiento o nomenclatura.
4. Marcar la Fase 2 como cerrada y aprobada.

No se incluyen procedimientos manuales antiguos ni scripts del modelo provisional `b_panaifo_test`.

## 6. Respaldo y contingencia

Documentado para el esquema `sigd_org` v2 conforme a la tarea de `B_HECTOR`. El detalle completo, la política de retención y el plan de contingencia están en [`10_plan_respaldo_contingencia_sigd_org_v2.md`](10_plan_respaldo_contingencia_sigd_org_v2.md).

### 6.1 Respaldo

Ejecutar un respaldo lógico diario de la base `sigd_qa` en formato custom. Debe realizarse después de cada despliegue y de forma automática diaria:

```bash
FECHA=$(date +%Y%m%d)
pg_dump -w -h localhost -p 5432 -U postgres -d sigd_qa -Fc \
  -f "backup/sigd_org_v2_${FECHA}.dump"
```

Verificar el respaldo sin restaurar y registrar su suma de verificación:

```bash
pg_restore -l backup/sigd_org_v2_${FECHA}.dump | grep -i "sigd_org" | head -30
sha256sum backup/sigd_org_v2_${FECHA}.dump > backup/sigd_org_v2_${FECHA}.dump.sha256
```

### 6.2 Prueba de restauración

Tras cada despliegue y como mínimo mensual, restaurar el respaldo en una base temporal y validar con la suite oficial:

```bash
FECHA=$(date +%Y%m%d)
dropdb --if-exists sigd_restore_test
createdb sigd_restore_test
pg_restore -w -h localhost -p 5432 -U postgres -d sigd_restore_test \
  backup/sigd_org_v2_${FECHA}.dump
psql -d sigd_restore_test -v ON_ERROR_STOP=1 -f 05_validacion_organicore_v2.sql
```

### 6.3 Criterios de aceptación

- `pg_restore` restaura sin errores en `sigd_restore_test`.
- `05_validacion_organicore_v2.sql` termina con `OK` y sin excepciones.
- Existen las 9 tablas, 1 función, 1 trigger y 2 restricciones de exclusión GiST.
- No se modifica la base operativa `sigd_qa`.
- El resultado queda registrado en la bitácora de `10_plan_respaldo_contingencia_sigd_org_v2.md`.

# Plan de respaldo y contingencia — OrganiCore v2

## 1. Objetivo

Establecer la política de respaldo, restauración y continuidad operativa del esquema `sigd_org` para la arquitectura OrganiCore v2, garantizando integridad del contrato UUID `id_area`, de los paths `ltree` y de las vigencias de encargaturas y facultades en PostgreSQL 18.

## 2. Alcance

Este plan cubre:

- Base de datos `sigd_org` del módulo OrganiCore.
- DDL oficial `03_esquema_sigd_org_v2.sql`.
- Suite de validación `05_validacion_organicore_v2.sql`.
- Documentación de arquitectura y validación asociada.

No incluye scripts legacy ni artefactos de ramas no oficiales.

## 3. Política de respaldo

1. Ejecutar respaldo lógico completo tras cada despliegue y además de manera diaria en horario de baja actividad.
2. Usar formato custom de PostgreSQL para preservar el esquema y los datos de forma reproducible.
3. Registrar la fecha, hash SHA-256 y propósito del respaldo.
4. Almacenar cada backup con nombre identificable por fecha y versión (`sigd_org_v2_YYYYMMDD.dump`).

### Comando recomendado

```bash
FECHA=$(date +%Y%m%d)
pg_dump -w -h localhost -p 5432 -U postgres -d sigd_qa -Fc \
  -f "backup/sigd_org_v2_${FECHA}.dump"
sha256sum "backup/sigd_org_v2_${FECHA}.dump" > "backup/sigd_org_v2_${FECHA}.dump.sha256"
```

## 4. Prueba de restauración

1. Crear una base temporal de prueba.
2. Restaurar el backup en esa base.
3. Ejecutar la suite oficial `05_validacion_organicore_v2.sql` con `ON_ERROR_STOP=1`.
4. Validar que no se hayan perdido el esquema, los paths `ltree` ni los datos de vigencia.

```bash
FECHA=$(date +%Y%m%d)
dropdb --if-exists sigd_restore_test
createdb sigd_restore_test
pg_restore -w -h localhost -p 5432 -U postgres -d sigd_restore_test \
  "backup/sigd_org_v2_${FECHA}.dump"
psql -d sigd_restore_test -v ON_ERROR_STOP=1 -f 05_validacion_organicore_v2.sql
```

## 5. Criterios de aceptación

- El respaldo restaura sin errores.
- `sigd_org.area` conserva la clave primaria `id_area UUID` y la jerarquía `ltree`.
- No se reintroducen columnas `area_id` ni referencias heredadas.
- La validación de ciclos y vigencias sigue funcionando con `p_momento`.
- La base operativa no se altera en los escenarios de restauración prueba.

## 6. Retención y trazabilidad

- Conservar al menos 30 días de respaldos lógicos.
- Mantener registro del hash, fecha y responsable de restauración.
- En caso de fallo, regenerar la base en versión estable y repetir la suite H4 antes de volver a operar.

## 7. Responsabilidad

- Responsable técnico: B_POOL / integración OrganiCore.
- Aprobación y continuidad: Comité de arquitectura SIGD / integrador Git.

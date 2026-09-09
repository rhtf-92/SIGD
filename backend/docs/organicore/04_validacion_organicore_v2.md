# B_PANAIFO - Validaci├│n OrganiCore v2

**Versi├│n:** 2.0  
**Estado:** Aprobado

## Entregable

La validaci├│n ejecutable est├í en `05_validacion_organicore_v2.sql` y debe ejecutarse despu├®s de `03_esquema_sigd_org_v2.sql`.

```bash
psql -d sigd_qa -v ON_ERROR_STOP=1 -f 03_esquema_sigd_org_v2.sql
psql -d sigd_qa -v ON_ERROR_STOP=1 -f 05_validacion_organicore_v2.sql
```

## Criterios validados

- Existe el esquema `sigd_org`.
- Existen `area`, `cargo`, `rol_sistema`, `permiso_sistema`, `rol_permiso`, `usuario_rol`, `asignacion_area`, `facultad_despacho` y `encargatura_despacho`.
- Las entidades maestras contienen `activo BOOLEAN NOT NULL DEFAULT TRUE`.
- No existe la tabla antigua `responsables`.
- `asignacion_area.vigencia` usa `TSTZRANGE`.
- `encargatura_despacho.periodo_vigencia` usa `TSTZRANGE`.
- Existen las restricciones de exclusi├│n GiST para evitar solapamientos.
- El script termina con el resultado `OK` cuando todos los controles pasan.

## Resultado esperado

```text
OK: esquema sigd_org y entidades v2 validados
```

La salida del script debe conservarse como evidencia del despliegue de la Fase 2.

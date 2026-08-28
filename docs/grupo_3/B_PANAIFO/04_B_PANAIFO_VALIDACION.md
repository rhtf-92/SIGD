| ID  | Rol             | Acción              | Resultado esperado |
|-----|-----------------|---------------------|--------------------|
| V01 | ROLE_ADMIN      | Consultar área      | PERMITIDO          |
| V02 | ROLE_ADMIN      | Crear área          | PERMITIDO          |
| V03 | ROLE_ADMIN      | Editar área         | PERMITIDO          |
| V04 | ROLE_ADMIN      | Eliminar área       | PERMITIDO          |
| V05 | ROLE_ADMIN      | Gestionar permisos  | PERMITIDO          |
| V06 | ROLE_OPERADOR   | Consultar área      | PERMITIDO          |
| V07 | ROLE_OPERADOR   | Editar área         | PERMITIDO          |
| V08 | ROLE_OPERADOR   | Eliminar área       | DENEGADO           |
| V09 | ROLE_OPERADOR   | Gestionar permisos  | DENEGADO           |
| V10 | ROLE_CONSULTA   | Consultar área      | PERMITIDO          |
| V11 | ROLE_CONSULTA   | Crear área          | DENEGADO           |
| V12 | ROLE_CONSULTA   | Editar área         | DENEGADO           |
| V13 | ROLE_CONSULTA   | Eliminar área       | DENEGADO           |
| V14 | ROLE_CONSULTA   | Gestionar permisos  | DENEGADO           |

## Casos de prueba

### Caso PERMITIDO - ROLE_CONSULTA puede consultar áreas

```sql
SELECT
    r.codigo AS rol,
    p.codigo AS permiso
FROM roles_permisos rp
JOIN roles r ON r.id = rp.rol_id
JOIN permisos p ON p.id = rp.permiso_id
WHERE r.codigo = 'ROLE_CONSULTA';
```

**Resultado esperado:**
```
ROLE_CONSULTA | area.consultar
```

### Caso DENEGADO - ROLE_CONSULTA no puede crear áreas

ROLE_CONSULTA solamente tiene permiso `area.consultar`. No tiene permiso `area.crear`.

**Resultado esperado:** DENEGADO

## Pruebas de restricciones

### Prueba UNIQUE - roles.codigo

```sql
INSERT INTO roles (codigo, nombre)
VALUES ('ROLE_ADMIN', 'Otro administrador');
```

**Resultado esperado:** Falla (error UNIQUE violation)

### Prueba CHECK - responsables.fechas

```sql
INSERT INTO responsables
(area_id, usuario_id, cargo_id, fecha_inicio, fecha_fin)
VALUES
(1, 1001, 1, '2026-08-30', '2026-08-01');
```

**Resultado esperado:** Falla (CHECK violation: fecha_fin < fecha_inicio)

### Prueba de Foreign Key

```sql
INSERT INTO roles_permisos
(rol_id, permiso_id)
VALUES
(9999, 9999);
```

**Resultado esperado:** Falla (Foreign key violation)

## Prueba de la relación muchos a muchos

ROLE_ADMIN debe tener múltiples permisos:

```sql
SELECT
    r.codigo AS rol,
    COUNT(p.id) AS total_permisos,
    STRING_AGG(p.codigo, ', ' ORDER BY p.codigo) AS permisos
FROM roles_permisos rp
JOIN roles r ON r.id = rp.rol_id
JOIN permisos p ON p.id = rp.permiso_id
WHERE r.codigo = 'ROLE_ADMIN'
GROUP BY r.id, r.codigo;
```

**Resultado esperado:**
```
ROLE_ADMIN | 6 | area.consultar, area.crear, area.editar, area.eliminar, permiso.gestionar, usuario.consultar
```

Los permisos se relacionan mediante identificadores (rol_id, permiso_id) en roles_permisos, no mediante texto duplicado.

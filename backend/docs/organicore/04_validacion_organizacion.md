# Validación y Pruebas — Módulo de Organización y Permisos

- Responsable: Geiner Panaifo
- Rama: `B_PANAIFO`
- Grupo: Grupo 3 — OrganiCore
- Versión: 2.0 (Estandarizado)
- Fecha: 2026-08-29
- Estado: Ampliado con pruebas avanzadas

---

## 1. Matriz de Autorización por Rol

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

---

## 2. Pruebas Avanzadas de Jerarquía de Áreas

### 2.1 - Verificar Relaciones Padre-Hijo

**Objetivo:** Validar que la estructura jerárquica es correcta.

```sql
-- Estructura esperada:
-- 1. Dirección General (parent_id = NULL)
--    ├── 2. Oficina de Administración (parent_id = 1)
--    ├── 3. Oficina de Sistemas (parent_id = 1)
--    └── 4. Oficina de Archivo (parent_id = 1)
--           └── 5. Área de Desarrollo (parent_id = 3)

SELECT 
    a.id,
    a.nombre,
    a.sigla,
    COALESCE(p.nombre, 'NINGUNA (Raíz)') AS padre,
    a.parent_id
FROM areas a
LEFT JOIN areas p ON a.parent_id = p.id
ORDER BY a.parent_id NULLS FIRST, a.id;
```

**Resultado esperado:**
```
id | nombre                           | sigla | padre                      | parent_id
1  | Dirección General de Prueba      | DGP   | NINGUNA (Raíz)             | 
2  | Oficina de Administración        | OAP   | Dirección General          | 1
3  | Oficina de Sistemas de Prueba    | OSP   | Dirección General          | 1
4  | Oficina de Archivo de Prueba     | OAR   | Dirección General          | 1
5  | Área de Desarrollo de Prueba     | ADP   | Oficina de Sistemas        | 3
```

---

### 2.2 - Árbol Completo Usando CTE Recursiva

**Objetivo:** Obtener la jerarquía completa con indentación.

```sql
WITH RECURSIVE area_tree AS (
    -- Caso base: áreas raíz
    SELECT 
        id, 
        nombre, 
        sigla, 
        parent_id,
        1 AS nivel,
        CAST(id AS TEXT) AS camino,
        nombre AS arbol
    FROM areas
    WHERE parent_id IS NULL
    
    UNION ALL
    
    -- Caso recursivo: hijos
    SELECT 
        a.id,
        a.nombre,
        a.sigla,
        a.parent_id,
        t.nivel + 1 AS nivel,
        t.camino || '->' || CAST(a.id AS TEXT) AS camino,
        t.arbol || ' → ' || a.nombre AS arbol
    FROM areas a
    INNER JOIN area_tree t ON a.parent_id = t.id
)
SELECT 
    REPEAT('  ', nivel - 1) || '└─ ' || nombre AS jerarquia,
    sigla,
    nivel,
    camino
FROM area_tree
ORDER BY camino;
```

**Resultado esperado:**
```
jerarquia                                | sigla | nivel | camino
└─ Dirección General de Prueba          | DGP   | 1     | 1
  └─ Oficina de Administración          | OAP   | 2     | 1->2
  └─ Oficina de Sistemas de Prueba      | OSP   | 2     | 1->3
  └─ Área de Desarrollo de Prueba       | ADP   | 3     | 1->3->5
  └─ Oficina de Archivo de Prueba       | OAR   | 2     | 1->4
```

---

### 2.3 - Validar que No Hay Ciclos

**Objetivo:** Detectar ciclos indirectos (ej: A → B → C → A).

```sql
-- Esta consulta detecta ciclos:
-- Si una área es su propio ancestro (directa o indirectamente)

WITH RECURSIVE ancestor_chain AS (
    SELECT 
        id,
        nombre,
        parent_id,
        ARRAY[id] AS cadena
    FROM areas
    WHERE parent_id IS NOT NULL
    
    UNION ALL
    
    SELECT 
        ac.id,
        ac.nombre,
        a.parent_id,
        ac.cadena || a.id
    FROM ancestor_chain ac
    JOIN areas a ON a.id = ac.parent_id
    WHERE NOT ac.cadena @> ARRAY[a.id]  -- Evitar ciclos en la consulta
)
SELECT 
    id,
    nombre,
    parent_id,
    cadena
FROM ancestor_chain
WHERE cadena @> ARRAY[id]  -- Si el ID está en su propia cadena → CICLO
ORDER BY id;
```

**Resultado esperado:**
```
(No rows)  -- No debe haber ciclos
```

---

## 3. Pruebas de Vigencia de Asignaciones (Responsables)

### 3.1 - Responsables Activos (Vigentes)

**Objetivo:** Obtener responsables cuyas asignaciones están activas HOY.

```sql
SELECT 
    resp.id,
    u.usuario_id,
    ar.sigla AS area,
    c.nombre AS cargo,
    r.codigo AS rol,
    resp.fecha_inicio,
    resp.fecha_fin,
    CASE 
        WHEN resp.fecha_fin IS NULL THEN 'INDEFINIDA'
        WHEN resp.fecha_fin >= CURRENT_DATE THEN 'VIGENTE'
        ELSE 'EXPIRADA'
    END AS estado_vigencia
FROM responsables resp
JOIN areas ar ON resp.area_id = ar.id
JOIN cargos c ON resp.cargo_id = c.id
LEFT JOIN roles r ON c.rol_id = r.id
LEFT JOIN usuarios_roles u ON u.rol_id = r.id
WHERE resp.fecha_fin IS NULL 
   OR resp.fecha_fin >= CURRENT_DATE
ORDER BY resp.fecha_inicio DESC;
```

**Resultado esperado:**
```
Debe mostrar todas las asignaciones vigentes hoy
```

---

### 3.2 - Responsables Históricos (Completados)

**Objetivo:** Obtener responsables cuyas asignaciones ya terminaron.

```sql
SELECT 
    resp.id,
    usuario_id,
    ar.sigla AS area,
    c.nombre AS cargo,
    resp.fecha_inicio,
    resp.fecha_fin,
    CURRENT_DATE - resp.fecha_fin AS dias_desde_expiracion
FROM responsables resp
JOIN areas ar ON resp.area_id = ar.id
JOIN cargos c ON resp.cargo_id = c.id
WHERE resp.fecha_fin < CURRENT_DATE
ORDER BY resp.fecha_fin DESC;
```

**Resultado esperado:**
```
Debe mostrar asignaciones históricas (aunque puede estar vacío inicialmente)
```

---

### 3.3 - Validar Restricción CHECK de Fechas

**Objetivo:** Verificar que fecha_fin >= fecha_inicio.

```sql
-- Intento de insertar un registro con fechas inválidas
INSERT INTO responsables 
(area_id, usuario_id, cargo_id, fecha_inicio, fecha_fin)
VALUES 
(1, 1001, 1, '2026-08-30', '2026-08-01');
```

**Resultado esperado:** 
```
ERROR: new row for relation "responsables" violates check constraint "chk_responsables_fechas"
```

---

### 3.4 - Solapamiento de Responsables

**Objetivo:** Detectar si hay dos personas en el mismo cargo/área en fechas solapadas.

```sql
-- Detectar solapamientos
SELECT 
    r1.id AS asignacion_1,
    r2.id AS asignacion_2,
    ar.sigla AS area,
    c.nombre AS cargo,
    r1.usuario_id AS usuario_1,
    r2.usuario_id AS usuario_2,
    r1.fecha_inicio,
    r1.fecha_fin,
    r2.fecha_inicio,
    r2.fecha_fin
FROM responsables r1
JOIN responsables r2 ON r1.area_id = r2.area_id
                     AND r1.cargo_id = r2.cargo_id
                     AND r1.id < r2.id  -- Evitar duplicados
JOIN areas ar ON r1.area_id = ar.id
JOIN cargos c ON r1.cargo_id = c.id
WHERE 
    -- Verificar si las fechas se solapan
    (r1.fecha_fin IS NULL OR r1.fecha_fin >= r2.fecha_inicio)
    AND (r2.fecha_fin IS NULL OR r2.fecha_fin >= r1.fecha_inicio);
```

**Resultado esperado:**
```
(No rows)  -- No debe haber solapamientos
(O mostrar si hay asignaciones simultáneas esperadas)
```

---

## 4. Pruebas de Historial y Auditoría

### 4.1 - Preservación del Historial

**Objetivo:** Verificar que los registros históricos en responsables NO se borran.

```sql
-- Verificar que RESPONSABLES tiene integridad histórica
-- (Nunca se usan DELETE, solo UPDATE con fecha_fin)

-- Insertar un responsable temporal
INSERT INTO responsables 
(area_id, usuario_id, cargo_id, fecha_inicio, fecha_fin)
VALUES 
(1, 1001, 1, '2026-01-01', '2026-06-30');

-- Consultar para confirmar
SELECT * FROM responsables 
WHERE usuario_id = 1001 AND cargo_id = 1;

-- Marcar como finalizado (soft delete)
UPDATE responsables 
SET fecha_fin = CURRENT_DATE 
WHERE usuario_id = 1001 AND cargo_id = 1 AND fecha_fin IS NULL;

-- Verificar que el registro sigue existiendo
SELECT * FROM responsables 
WHERE usuario_id = 1001 AND cargo_id = 1;
```

**Resultado esperado:**
```
El registro debe mantenerse con fecha_fin actualizada
(No se borra, solo se marca como terminado)
```

---

### 4.2 - Rastrear Responsable en una Fecha Específica

**Objetivo:** Obtener quién era responsable en una fecha histórica.

```sql
-- ¿Quién era responsable el 2026-02-15?
SELECT 
    usuario_id,
    ar.sigla AS area,
    c.nombre AS cargo,
    r.codigo AS rol,
    resp.fecha_inicio,
    resp.fecha_fin
FROM responsables resp
JOIN areas ar ON resp.area_id = ar.id
JOIN cargos c ON resp.cargo_id = c.id
LEFT JOIN roles r ON c.rol_id = r.id
WHERE ar.id = 1  -- Dirección General
  AND resp.fecha_inicio <= '2026-02-15'
  AND (resp.fecha_fin IS NULL OR resp.fecha_fin > '2026-02-15');
```

**Resultado esperado:**
```
Debe mostrar responsables vigentes en esa fecha
```

---

## 5. Pruebas de Autorización por Alcance

### 5.1 - Usuarios Asignados a un Área

**Objetivo:** Listar todos los usuarios que tienen alguna asignación en un área.

```sql
-- Usuarios asignados al área "Oficina de Sistemas"
SELECT DISTINCT
    resp.usuario_id,
    ar.nombre AS area,
    ar.sigla,
    c.nombre AS cargo,
    r.codigo AS rol_cargo,
    ur.fecha_asignacion AS fecha_rol_usuario
FROM responsables resp
JOIN areas ar ON resp.area_id = ar.id
JOIN cargos c ON resp.cargo_id = c.id
LEFT JOIN roles r ON c.rol_id = r.id
LEFT JOIN usuarios_roles ur ON ur.usuario_id = resp.usuario_id 
                             AND ur.rol_id = r.id
WHERE ar.sigla = 'OSP'  -- Oficina de Sistemas
  AND resp.fecha_fin IS NULL  -- Solo activos
ORDER BY resp.usuario_id;
```

**Resultado esperado:**
```
Usuarios asignados a la Oficina de Sistemas
```

---

### 5.2 - Alcance de Permisos por Usuario y Área

**Objetivo:** Determinar qué permisos tiene un usuario en una área específica.

```sql
-- ¿Qué permisos tiene el usuario 1001 en el área "Dirección General"?
SELECT DISTINCT
    u.usuario_id,
    ar.sigla AS area,
    r.codigo AS rol,
    p.codigo AS permiso,
    p.descripcion
FROM responsables u
JOIN areas ar ON u.area_id = ar.id
JOIN cargos c ON u.cargo_id = c.id
JOIN roles r ON c.rol_id = r.id
JOIN roles_permisos rp ON r.id = rp.rol_id
JOIN permisos p ON rp.permiso_id = p.id
WHERE u.usuario_id = 1001
  AND ar.sigla = 'DGP'
  AND u.fecha_fin IS NULL;
```

**Resultado esperado:**
```
Todos los permisos que tiene el usuario 1001 en la Dirección General
```

---

### 5.3 - Verificar Restricción: ROLE_CONSULTA Solo Lee

**Objetivo:** Validar que ROLE_CONSULTA no puede crear, editar ni eliminar.

```sql
-- Permisos del ROLE_CONSULTA
SELECT 
    r.codigo AS rol,
    p.codigo AS permiso,
    p.descripcion,
    CASE 
        WHEN p.codigo LIKE '%.crear' THEN 'CREACIÓN'
        WHEN p.codigo LIKE '%.editar' THEN 'EDICIÓN'
        WHEN p.codigo LIKE '%.eliminar' THEN 'ELIMINACIÓN'
        WHEN p.codigo LIKE '%.consultar' THEN 'LECTURA'
        ELSE 'OTRO'
    END AS tipo_operacion
FROM roles_permisos rp
JOIN roles r ON rp.rol_id = r.id
JOIN permisos p ON rp.permiso_id = p.id
WHERE r.codigo = 'ROLE_CONSULTA'
ORDER BY p.codigo;
```

**Resultado esperado:**
```
ROLE_CONSULTA | area.consultar | Consultar áreas | LECTURA
```

(Solo LECTURA, sin crear, editar, eliminar ni gestionar)

---

## 6. Pruebas de Integridad Referencial

### 6.1 - No Huérfanos en CARGOS

```sql
SELECT * FROM cargos 
WHERE rol_id IS NOT NULL 
  AND rol_id NOT IN (SELECT id FROM roles);
```

**Resultado esperado:** `(No rows)`

---

### 6.2 - No Huérfanos en RESPONSABLES

```sql
SELECT * FROM responsables 
WHERE area_id NOT IN (SELECT id FROM areas)
   OR cargo_id NOT IN (SELECT id FROM cargos);
```

**Resultado esperado:** `(No rows)`

---

### 6.3 - No Huérfanos en ROLES_PERMISOS

```sql
SELECT * FROM roles_permisos 
WHERE rol_id NOT IN (SELECT id FROM roles)
   OR permiso_id NOT IN (SELECT id FROM permisos);
```

**Resultado esperado:** `(No rows)`

---

## 7. Checklist de Validación

- [ ] Matriz de autorización ejecutada correctamente
- [ ] Estructura jerárquica de áreas valida (CTE)
- [ ] No hay ciclos en la jerarquía
- [ ] Responsables activos se listean correctamente
- [ ] Responsables históricos se preservan
- [ ] Restricción CHECK de fechas funciona
- [ ] No hay solapamientos de responsables
- [ ] Historial se mantiene (no se borran)
- [ ] Permisos por rol son correctos
- [ ] No hay huérfanos (integridad referencial)
- [ ] Autorización por alcance funciona
- [ ] ROLE_CONSULTA solo tiene lectura

---

**Próximo paso:** TAREA 6 - Revisar manejo de eliminaciones físicas

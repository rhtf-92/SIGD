/*
=========================================================
B_PANAIFO - VERIFICACIÓN
Módulo de Organización, Roles y Permisos

Consultas para demostrar que las tablas y relaciones funcionan
=========================================================
*/

-- ================================================
-- VERIFICACIÓN DE ÁREAS
-- ================================================

SELECT *
FROM areas
ORDER BY id;


-- ================================================
-- VERIFICACIÓN DE CARGOS
-- ================================================

SELECT *
FROM cargos
ORDER BY id;


-- ================================================
-- VERIFICACIÓN DE ROLES
-- ================================================

SELECT *
FROM roles
ORDER BY id;


-- ================================================
-- VERIFICACIÓN DE PERMISOS
-- ================================================

SELECT *
FROM permisos
ORDER BY id;


-- ================================================
-- VERIFICACIÓN DE ROLES Y PERMISOS
-- ================================================

SELECT
    r.codigo AS rol,
    r.nombre AS nombre_rol,
    p.codigo AS permiso,
    p.descripcion
FROM roles_permisos rp
INNER JOIN roles r
    ON r.id = rp.rol_id
INNER JOIN permisos p
    ON p.id = rp.permiso_id
ORDER BY r.id, p.id;


-- ================================================
-- VERIFICACIÓN DE USUARIOS Y ROLES
-- ================================================

SELECT
    ur.usuario_id,
    r.codigo AS rol,
    r.nombre AS nombre_rol,
    ur.fecha_asignacion,
    ur.fecha_fin
FROM usuarios_roles ur
INNER JOIN roles r
    ON r.id = ur.rol_id
ORDER BY ur.usuario_id, r.id;


-- ================================================
-- VERIFICACIÓN DE CARGOS Y ROLES
-- ================================================

SELECT
    c.id,
    c.nombre AS cargo,
    r.codigo AS rol_predeterminado,
    r.nombre AS nombre_rol,
    c.estado
FROM cargos c
LEFT JOIN roles r
    ON r.id = c.rol_id
ORDER BY c.id;


-- ================================================
-- VERIFICACIÓN ROLE_CONSULTA
-- ================================================

SELECT
    r.codigo AS rol,
    p.codigo AS permiso
FROM roles_permisos rp
JOIN roles r
    ON r.id = rp.rol_id
JOIN permisos p
    ON p.id = rp.permiso_id
WHERE r.codigo = 'ROLE_CONSULTA';


-- ================================================
-- VERIFICACIÓN PERMISOS DEL USUARIO 1001
-- (Mostrar todos los permisos disponibles a través de sus roles)
-- ================================================

SELECT DISTINCT
    ur.usuario_id,
    r.codigo AS rol,
    p.codigo AS permiso,
    p.descripcion
FROM usuarios_roles ur
INNER JOIN roles r ON r.id = ur.rol_id
INNER JOIN roles_permisos rp ON rp.rol_id = r.id
INNER JOIN permisos p ON p.id = rp.permiso_id
WHERE ur.usuario_id = 1001
ORDER BY r.codigo, p.codigo;

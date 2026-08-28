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

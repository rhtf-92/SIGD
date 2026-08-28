/*
=========================================================
B_PANAIFO - DATOS DE PRUEBA
Módulo de Organización, Roles y Permisos

TODOS LOS DATOS SON FICTICIOS Y NO OFICIALES
=========================================================
*/

-- ======================================================
-- ÁREAS
-- ======================================================

INSERT INTO areas (nombre, sigla, parent_id, estado)
VALUES
('Dirección General de Prueba', 'DGP', NULL, TRUE);

INSERT INTO areas (nombre, sigla, parent_id, estado)
VALUES
('Oficina de Administración de Prueba', 'OAP', 1, TRUE),
('Oficina de Sistemas de Prueba', 'OSP', 1, TRUE),
('Oficina de Archivo de Prueba', 'OAR', 1, TRUE);

INSERT INTO areas (nombre, sigla, parent_id, estado)
VALUES
('Área de Desarrollo de Prueba', 'ADP', 3, TRUE);


-- ======================================================
-- CARGOS
-- ======================================================

INSERT INTO cargos (nombre, rol_id, estado)
VALUES
('Director de Prueba', 1, TRUE),
('Jefe de Oficina de Prueba', 2, TRUE),
('Especialista de Prueba', 2, TRUE),
('Analista de Prueba', 3, TRUE);


-- ======================================================
-- ROLES
-- ======================================================

INSERT INTO roles (codigo, nombre)
VALUES
('ROLE_ADMIN', 'Administrador de Prueba'),
('ROLE_OPERADOR', 'Operador de Prueba'),
('ROLE_CONSULTA', 'Consulta de Prueba');


-- ======================================================
-- PERMISOS
-- ======================================================

INSERT INTO permisos (codigo, descripcion)
VALUES
('area.crear', 'Crear un área'),
('area.consultar', 'Consultar áreas'),
('area.editar', 'Editar información de un área'),
('area.eliminar', 'Eliminar un área'),
('usuario.consultar', 'Consultar información de usuarios'),
('permiso.gestionar', 'Gestionar permisos');


-- ======================================================
-- RELACIÓN ROLES - PERMISOS
-- ======================================================

-- Administrador
INSERT INTO roles_permisos (rol_id, permiso_id)
VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5),
(1, 6);

-- Operador
INSERT INTO roles_permisos (rol_id, permiso_id)
VALUES
(2, 2),
(2, 3);

-- Consulta
INSERT INTO roles_permisos (rol_id, permiso_id)
VALUES
(3, 2);


-- ======================================================
-- RELACIÓN USUARIOS - ROLES
-- ======================================================

/*
NOTA: usuario_id representa IDs ficticios.
Estos IDs deben existir en la tabla users cuando se integre.
*/

-- Usuario 1001 asignado a ROLE_ADMIN
INSERT INTO usuarios_roles (usuario_id, rol_id, fecha_asignacion, fecha_fin)
VALUES
(1001, 1, '2026-01-15', NULL);

-- Usuario 1002 asignado a ROLE_OPERADOR
INSERT INTO usuarios_roles (usuario_id, rol_id, fecha_asignacion, fecha_fin)
VALUES
(1002, 2, '2026-03-01', NULL);

-- Usuario 1003 asignado a ROLE_CONSULTA
INSERT INTO usuarios_roles (usuario_id, rol_id, fecha_asignacion, fecha_fin)
VALUES
(1003, 3, '2026-06-01', NULL);

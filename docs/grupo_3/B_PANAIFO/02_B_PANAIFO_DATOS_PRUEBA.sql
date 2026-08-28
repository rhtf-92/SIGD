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

INSERT INTO cargos (nombre, estado)
VALUES
('Director de Prueba', TRUE),
('Jefe de Oficina de Prueba', TRUE),
('Especialista de Prueba', TRUE),
('Analista de Prueba', TRUE);


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
('area:crear', 'Crear un área'),
('area:consultar', 'Consultar áreas'),
('area:editar', 'Editar información de un área'),
('area:eliminar', 'Eliminar un área'),
('usuario:consultar', 'Consultar información de usuarios'),
('permiso:gestionar', 'Gestionar permisos');


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

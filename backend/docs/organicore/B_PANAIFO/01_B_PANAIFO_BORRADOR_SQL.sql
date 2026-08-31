/*
=========================================================
B_PANAIFO - BORRADOR SQL
Módulo de Organización, Roles y Permisos

PostgreSQL 18.6

IMPORTANTE:
Este script es un BORRADOR técnico.
No representa decisiones institucionales definitivas.
Los datos reales NO deben utilizarse en este archivo.
=========================================================
*/

-- ======================================================
-- 1. TABLA: AREAS
-- ======================================================

CREATE TABLE areas (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    sigla VARCHAR(20) NOT NULL UNIQUE,
    parent_id BIGINT,
    estado BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_areas_parent
        FOREIGN KEY (parent_id)
        REFERENCES areas(id)
);

-- Índice para consultas de jerarquía
CREATE INDEX idx_areas_parent_id
    ON areas(parent_id);


-- ======================================================
-- 2. TABLA: ROLES
-- REORDENADO: Ahora se crea ANTES de CARGOS (que depende de ella)
-- ======================================================

CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL
);


-- ======================================================
-- 3. TABLA: CARGOS
-- REORDENADO: Ahora se crea DESPUÉS de ROLES
-- ======================================================

CREATE TABLE cargos (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    rol_id BIGINT,
    estado BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_cargos_rol
        FOREIGN KEY (rol_id)
        REFERENCES roles(id)
);


-- ======================================================
-- 4. TABLA: RESPONSABLES
-- ======================================================

/*
NOTA:
users(id) pertenece a una estructura externa al módulo.
Por eso esta tabla depende de que users exista.
*/

CREATE TABLE responsables (
    id BIGSERIAL PRIMARY KEY,
    area_id BIGINT NOT NULL,
    usuario_id BIGINT NOT NULL,
    cargo_id BIGINT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    es_titular BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_responsables_area
        FOREIGN KEY (area_id)
        REFERENCES areas(id),

    CONSTRAINT fk_responsables_cargo
        FOREIGN KEY (cargo_id)
        REFERENCES cargos(id),

    CONSTRAINT chk_responsables_fechas
        CHECK (
            fecha_fin IS NULL
            OR fecha_fin >= fecha_inicio
        )
);

-- Índices para consultas frecuentes
CREATE INDEX idx_responsables_area
    ON responsables(area_id);

CREATE INDEX idx_responsables_usuario
    ON responsables(usuario_id);

CREATE INDEX idx_responsables_cargo
    ON responsables(cargo_id);

CREATE INDEX idx_responsables_vigencia
    ON responsables(fecha_inicio, fecha_fin);


-- ======================================================
-- 5. TABLA: PERMISOS
-- ======================================================

CREATE TABLE permisos (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);


-- ======================================================
-- 6. TABLA: ROLES_PERMISOS
-- Relación muchos a muchos
-- ======================================================

CREATE TABLE roles_permisos (
    rol_id BIGINT NOT NULL,
    permiso_id BIGINT NOT NULL,

    CONSTRAINT pk_roles_permisos
        PRIMARY KEY (rol_id, permiso_id),

    CONSTRAINT fk_roles_permisos_rol
        FOREIGN KEY (rol_id)
        REFERENCES roles(id),

    CONSTRAINT fk_roles_permisos_permiso
        FOREIGN KEY (permiso_id)
        REFERENCES permisos(id)
);

-- Índice para búsquedas de permisos por permiso
CREATE INDEX idx_roles_permisos_permiso
    ON roles_permisos(permiso_id);


-- ======================================================
-- 7. TABLA: USUARIOS_ROLES
-- Relación muchos a muchos entre usuarios y roles
-- ======================================================

CREATE TABLE usuarios_roles (
    usuario_id BIGINT NOT NULL,
    rol_id BIGINT NOT NULL,
    fecha_asignacion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin DATE,

    CONSTRAINT pk_usuarios_roles
        PRIMARY KEY (usuario_id, rol_id),

    CONSTRAINT fk_usuarios_roles_rol
        FOREIGN KEY (rol_id)
        REFERENCES roles(id),

    CONSTRAINT chk_usuarios_roles_fechas
        CHECK (
            fecha_fin IS NULL
            OR fecha_fin >= fecha_asignacion
        )
);

-- Índice para búsquedas de roles por usuario
CREATE INDEX idx_usuarios_roles_usuario
    ON usuarios_roles(usuario_id);

-- Índice para búsquedas de usuarios por rol
CREATE INDEX idx_usuarios_roles_rol
    ON usuarios_roles(rol_id);


/*
=========================================================
DEPENDENCIAS EXTERNAS Y CONFIGURACIÓN PENDIENTE
=========================================================

La siguiente sentencia debe ejecutarse una vez que
se integre con la tabla users del módulo de usuarios:

ALTER TABLE responsables
ADD CONSTRAINT fk_responsables_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users(id);

ALTER TABLE usuarios_roles
ADD CONSTRAINT fk_usuarios_roles_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users(id);

=========================================================
NOTAS TÉCNICAS
=========================================================

1. areas.parent_id permite representar una jerarquía
   ilimitada mediante una referencia a la misma tabla.

2. Un CHECK puede evitar casos simples, pero no puede
   garantizar por sí solo que no existan ciclos como:

       A -> B -> C -> A

   La prevención completa de ciclos puede requerir
   lógica adicional mediante trigger, función o
   validación de aplicación.

3. roles_permisos representa la relación N:M entre roles
   y permisos mediante identificadores.

4. usuarios_roles es la relación N:M entre usuarios y roles.
   Permite asignar múltiples roles a un usuario y
   múltiples usuarios a un rol.

5. cargos puede opcionalmente vincularse a un rol por defecto
   mediante cargos.rol_id.

6. No se almacenan permisos como listas separadas
   por comas.

7. responsables mantiene historial mediante
   fecha_inicio y fecha_fin.

8. usuario_id y usuarios_roles.usuario_id dependen de
   la tabla externa users(id) que pertenece a otro módulo.

9. Este script es PROVISIONAL y no contiene datos
   personales, credenciales ni contraseñas reales.
=========================================================
*/

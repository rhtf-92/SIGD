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
-- 2. TABLA: CARGOS
-- ======================================================

CREATE TABLE cargos (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    estado BOOLEAN NOT NULL DEFAULT TRUE
);


-- ======================================================
-- 3. TABLA: RESPONSABLES
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
-- 4. TABLA: ROLES
-- ======================================================

CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL
);


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


/*
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

4. No se almacenan permisos como listas separadas
   por comas.

5. responsables mantiene historial mediante
   fecha_inicio y fecha_fin.

6. usuario_id depende de la tabla externa users(id).

7. Este script es PROVISIONAL y no contiene datos
   personales, credenciales ni contraseñas reales.
=========================================================
*/

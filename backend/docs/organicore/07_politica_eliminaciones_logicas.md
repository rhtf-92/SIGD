# Política de Eliminaciones y Auditoría
## Módulo de Organización, Roles y Permisos

- Responsable: Geiner Panaifo
- Rama: `B_PANAIFO`
- Grupo: Grupo 3 — OrganiCore
- Versión: 1.0 (Estandarizado)
- Fecha: 2026-08-29
- Objetivo: Definir estrategia de soft-delete y preservación de historial

---

## 1. Análisis Actual del Modelo

### Estado Actual

| Tabla | Tiene Estado? | Política Actual | Recomendación |
|-------|---|---|---|
| `areas` | ✓ `estado BOOLEAN` | Marcar `estado = FALSE` (soft-delete) | **Implementar soft-delete** |
| `cargos` | ✓ `estado BOOLEAN` | Marcar `estado = FALSE` (soft-delete) | **Implementar soft-delete** |
| `roles` | ✗ NO | DELETE permite borrar | ⚠️ **AGREGAR soft-delete** |
| `permisos` | ✗ NO | DELETE permite borrar | ⚠️ **AGREGAR soft-delete** |
| `responsables` | ✗ NO | DELETE borra historial | 🔴 **CRÍTICO: Usar fecha_fin** |
| `roles_permisos` | ✗ NO | DELETE borra relación | ✓ OK (relación, no datos maestros) |
| `usuarios_roles` | ✗ NO | DELETE borra | ✓ Parcialmente OK (tiene fecha_fin) |

---

## 2. Estrategia de Soft-Delete Propuesta

### Definición

**Soft-Delete**: No eliminar registros físicamente, sino marcarlos como inactivos con una fecha.

**Ventajas:**
- ✓ Preserva historial completo
- ✓ Permite auditoría
- ✓ Facilita recuperación de datos eliminados accidentalmente
- ✓ Mantiene integridad referencial

**Desventajas:**
- ✗ Requiere actualizar todas las consultas con filtro `WHERE estado = TRUE`
- ✗ Aumenta volumen de datos
- ✗ Necesita triggers o validaciones en aplicación

---

## 3. Cambios Propuestos por Tabla

### 3.1 - ROLES (Agregar soft-delete)

**Problema Actual:** No tiene campo para estado/vigencia.

**Solución Propuesta:**

```sql
-- Agregar columnas de auditoría a ROLES
ALTER TABLE roles ADD COLUMN (
    estado BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_desactivacion TIMESTAMP
);

-- Restricción: si está inactivo, debe tener fecha_desactivacion
ALTER TABLE roles ADD CONSTRAINT chk_roles_desactivacion
    CHECK (
        estado = TRUE 
        OR (estado = FALSE AND fecha_desactivacion IS NOT NULL)
    );
```

**Impacto:**
- Todas las consultas deben incluir `WHERE roles.estado = TRUE`
- Evita que se borre un rol que tiene asignaciones activas

---

### 3.2 - PERMISOS (Agregar soft-delete)

**Problema Actual:** No tiene campo para estado.

**Solución Propuesta:**

```sql
ALTER TABLE permisos ADD COLUMN (
    estado BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_desactivacion TIMESTAMP
);

ALTER TABLE permisos ADD CONSTRAINT chk_permisos_desactivacion
    CHECK (
        estado = TRUE 
        OR (estado = FALSE AND fecha_desactivacion IS NOT NULL)
    );
```

**Impacto:**
- Permisos inactivos no aparecen en consultas de autorización
- Auditoría completa de qué permisos existieron

---

### 3.3 - RESPONSABLES (Usar fecha_fin, NO DELETE)

**Problema Actual:** Puede haber DELETE que borra historial.

**Solución Propuesta:**

```sql
-- NUNCA permitir DELETE en responsables
-- Crear trigger que lo rechace

CREATE OR REPLACE FUNCTION prevent_responsables_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'No se puede eliminar registros de responsables. Use UPDATE con fecha_fin = CURRENT_DATE.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_responsables_delete
    BEFORE DELETE ON responsables
    FOR EACH ROW
    EXECUTE FUNCTION prevent_responsables_delete();
```

**Uso (para "eliminar" un responsable):**

```sql
-- ✓ CORRECTO: Marcar como finalizado
UPDATE responsables 
SET fecha_fin = CURRENT_DATE 
WHERE id = 5;

-- ✗ RECHAZADO: DELETE no permitido
DELETE FROM responsables WHERE id = 5;
-- ERROR: No se puede eliminar registros de responsables...
```

---

### 3.4 - ROLES_PERMISOS (Registrar cambios)

**Problema Actual:** No hay auditoría de cambios.

**Solución Propuesta:**

```sql
-- Crear tabla de auditoría para roles_permisos
CREATE TABLE roles_permisos_audit (
    id BIGSERIAL PRIMARY KEY,
    rol_id BIGINT NOT NULL,
    permiso_id BIGINT NOT NULL,
    accion VARCHAR(10) NOT NULL,  -- 'INSERT', 'DELETE', 'UPDATE'
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_cambio VARCHAR(100),  -- Usuario que hizo el cambio
    
    CONSTRAINT fk_audit_rol FOREIGN KEY (rol_id) REFERENCES roles(id),
    CONSTRAINT fk_audit_permiso FOREIGN KEY (permiso_id) REFERENCES permisos(id)
);

-- Trigger para registrar inserciones
CREATE OR REPLACE FUNCTION audit_roles_permisos_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO roles_permisos_audit (rol_id, permiso_id, accion, usuario_cambio)
    VALUES (NEW.rol_id, NEW.permiso_id, 'INSERT', CURRENT_USER);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_roles_permisos_insert
    AFTER INSERT ON roles_permisos
    FOR EACH ROW
    EXECUTE FUNCTION audit_roles_permisos_insert();

-- Trigger para registrar eliminaciones
CREATE OR REPLACE FUNCTION audit_roles_permisos_delete()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO roles_permisos_audit (rol_id, permiso_id, accion, usuario_cambio)
    VALUES (OLD.rol_id, OLD.permiso_id, 'DELETE', CURRENT_USER);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_roles_permisos_delete
    AFTER DELETE ON roles_permisos
    FOR EACH ROW
    EXECUTE FUNCTION audit_roles_permisos_delete();
```

---

## 4. Tabla de Auditoría General (Responsables)

### Crear Tabla de Auditoría Completa

```sql
CREATE TABLE responsables_audit (
    id BIGSERIAL PRIMARY KEY,
    responsable_id BIGINT NOT NULL,  -- ID del registro original
    area_id BIGINT,
    usuario_id BIGINT,
    cargo_id BIGINT,
    fecha_inicio DATE,
    fecha_fin DATE,
    es_titular BOOLEAN,
    
    -- Auditoría
    accion VARCHAR(20) NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_cambio VARCHAR(100) DEFAULT CURRENT_USER,
    razon_cambio TEXT,  -- Opcional: motivo del cambio
    
    CONSTRAINT fk_audit_responsable FOREIGN KEY (responsable_id) 
        REFERENCES responsables(id) ON DELETE CASCADE
);

-- Trigger para auditar cambios en responsables
CREATE OR REPLACE FUNCTION audit_responsables_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.* IS DISTINCT FROM NEW.* THEN
        INSERT INTO responsables_audit 
        (responsable_id, area_id, usuario_id, cargo_id, fecha_inicio, fecha_fin, es_titular, accion)
        VALUES 
        (NEW.id, NEW.area_id, NEW.usuario_id, NEW.cargo_id, NEW.fecha_inicio, NEW.fecha_fin, NEW.es_titular, 'UPDATE');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_responsables_update
    AFTER UPDATE ON responsables
    FOR EACH ROW
    EXECUTE FUNCTION audit_responsables_update();
```

---

## 5. Consultas de Auditoría

### 5.1 - Ver Historial de un Responsable

```sql
-- ¿Qué cambios ha tenido el responsable ID=1?
SELECT 
    a.responsable_id,
    a.accion,
    a.fecha_cambio,
    a.usuario_cambio,
    a.fecha_inicio,
    a.fecha_fin,
    r.codigo AS rol,
    c.nombre AS cargo
FROM responsables_audit a
LEFT JOIN roles r ON a.area_id = r.id
LEFT JOIN cargos c ON a.cargo_id = c.id
WHERE a.responsable_id = 1
ORDER BY a.fecha_cambio DESC;
```

---

### 5.2 - Ver Cambios en Roles (Quién agregó/quitó permisos)

```sql
-- Cambios en permisos de ROLE_ADMIN
SELECT 
    rpa.accion,
    rpa.fecha_cambio,
    rpa.usuario_cambio,
    r.codigo AS rol,
    p.codigo AS permiso,
    p.descripcion
FROM roles_permisos_audit rpa
JOIN roles r ON rpa.rol_id = r.id
JOIN permisos p ON rpa.permiso_id = p.id
WHERE r.codigo = 'ROLE_ADMIN'
ORDER BY rpa.fecha_cambio DESC;
```

---

## 6. Script de Implementación

### Opción A: Implementación Completa (Recomendada)

```sql
-- ============================================
-- PASO 1: Agregar soft-delete a ROLES
-- ============================================
ALTER TABLE roles ADD COLUMN (
    estado BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_desactivacion TIMESTAMP
);

ALTER TABLE roles ADD CONSTRAINT chk_roles_desactivacion
    CHECK (estado = TRUE OR fecha_desactivacion IS NOT NULL);

-- ============================================
-- PASO 2: Agregar soft-delete a PERMISOS
-- ============================================
ALTER TABLE permisos ADD COLUMN (
    estado BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_desactivacion TIMESTAMP
);

ALTER TABLE permisos ADD CONSTRAINT chk_permisos_desactivacion
    CHECK (estado = TRUE OR fecha_desactivacion IS NOT NULL);

-- ============================================
-- PASO 3: Crear tabla de auditoría
-- ============================================
CREATE TABLE responsables_audit (
    id BIGSERIAL PRIMARY KEY,
    responsable_id BIGINT NOT NULL,
    area_id BIGINT,
    usuario_id BIGINT,
    cargo_id BIGINT,
    fecha_inicio DATE,
    fecha_fin DATE,
    es_titular BOOLEAN,
    accion VARCHAR(20) NOT NULL,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_cambio VARCHAR(100) DEFAULT CURRENT_USER
);

-- ============================================
-- PASO 4: Crear triggers de auditoría
-- ============================================
-- (Ver sección 4 anterior)

-- ============================================
-- PASO 5: Actualizar todas las consultas
-- ============================================
-- Agregar WHERE filtros:
-- - WHERE roles.estado = TRUE
-- - WHERE permisos.estado = TRUE
-- - Usar fecha_fin para responsables
```

---

### Opción B: Implementación Mínima

Si no hay recursos, al menos:

1. ✓ Crear trigger que rechace DELETE en `responsables`
2. ✓ Crear tabla de auditoría para `responsables`
3. ✓ Documentar política de soft-delete en `notas_tecnicas.md`

---

## 7. Validaciones de Seguridad

### 7.1 - Función para Desactivar Rol (Segura)

```sql
CREATE OR REPLACE FUNCTION desactivar_rol(p_rol_id BIGINT, p_razon TEXT DEFAULT NULL)
RETURNS TABLE(exito BOOLEAN, mensaje TEXT) AS $$
BEGIN
    -- Verificar que el rol existe
    IF NOT EXISTS (SELECT 1 FROM roles WHERE id = p_rol_id) THEN
        RETURN QUERY SELECT FALSE, 'Rol no existe';
        RETURN;
    END IF;
    
    -- Verificar que no hay asignaciones activas
    IF EXISTS (SELECT 1 FROM usuarios_roles ur 
               WHERE ur.rol_id = p_rol_id AND ur.fecha_fin IS NULL) THEN
        RETURN QUERY SELECT FALSE, 'Hay usuarios asignados activamente a este rol';
        RETURN;
    END IF;
    
    -- Desactivar el rol
    UPDATE roles
    SET estado = FALSE,
        fecha_desactivacion = CURRENT_TIMESTAMP
    WHERE id = p_rol_id;
    
    RETURN QUERY SELECT TRUE, 'Rol desactivado correctamente';
END;
$$ LANGUAGE plpgsql;

-- Uso:
-- SELECT * FROM desactivar_rol(1, 'Rol obsoleto');
```

---

## 8. Checklist de Implementación

- [ ] Agregar columnas soft-delete a ROLES
- [ ] Agregar columnas soft-delete a PERMISOS
- [ ] Crear tabla `responsables_audit`
- [ ] Crear triggers de auditoría
- [ ] Crear función `desactivar_rol()`
- [ ] Crear trigger `prevent_responsables_delete`
- [ ] Actualizar todas las consultas con filtros
- [ ] Documentar en NOTAS_TECNICAS.md
- [ ] Pruebas: intento de DELETE rechazado
- [ ] Pruebas: auditoría registra cambios
- [ ] Revisión de seguridad

---

## 9. Impacto en la Aplicación

### Cambios Necesarios en la Lógica

1. **Consultas:** Agregar `WHERE estado = TRUE`
   ```sql
   -- ANTES
   SELECT * FROM roles WHERE id = 1;
   
   -- DESPUÉS
   SELECT * FROM roles WHERE id = 1 AND estado = TRUE;
   ```

2. **Eliminaciones:** Cambiar de DELETE a UPDATE
   ```sql
   -- ANTES
   DELETE FROM roles WHERE id = 1;
   
   -- DESPUÉS
   UPDATE roles SET estado = FALSE, fecha_desactivacion = CURRENT_TIMESTAMP WHERE id = 1;
   ```

3. **Responsables:** NUNCA usar DELETE
   ```sql
   -- ANTES (INCORRECTO)
   DELETE FROM responsables WHERE id = 5;
   
   -- DESPUÉS (CORRECTO)
   UPDATE responsables SET fecha_fin = CURRENT_DATE WHERE id = 5;
   ```

---

## 10. Consideraciones de Rendimiento

- ✓ Índices en `estado`, `fecha_desactivacion`
- ✓ Particionamiento por `fecha_cambio` en tablas de auditoría
- ✓ Limpiar datos muy antiguos (>5 años) con política de retención

---

## 11. Referencias Regulatorias

- Ley de Transparencia: Requiere auditoría de cambios
- Ley de Protección de Datos: Requiere rastreo de acceso
- Normativa de Archivos: Require preservación de histórico

---

## Próximos Pasos

1. Aprobar estrategia de soft-delete
2. Implementar triggers y tablas de auditoría
3. Actualizar documentación
4. Capacitar al equipo de desarrollo
5. Realizar pruebas exhaustivas
6. Migrar datos históricos (si existen)

---

**Fin del documento**

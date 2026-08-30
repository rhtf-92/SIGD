# B_PANAIFO - Notas Técnicas
## Módulo de Organización, Roles y Permisos

---

## 0. Cambios Críticos Implementados (Mejoras Post-Revisión)

### A. Relación Usuario-Rol (CRÍTICO)

**Problema original:** No existía forma de asignar roles a usuarios.

**Solución implementada:** Tabla `usuarios_roles` (relación N:M)

```sql
CREATE TABLE usuarios_roles (
    usuario_id BIGINT NOT NULL,
    rol_id BIGINT NOT NULL,
    fecha_asignacion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    PRIMARY KEY (usuario_id, rol_id)
);
```

**Ahora el flujo es:**
```
Usuario → (tiene) → Rol(es) → (tiene) → Permiso(s)
```

**Ejemplo:**
- Usuario 1001 asignado a ROLE_ADMIN → accede a todos los permisos de administrador
- Usuario 1002 asignado a ROLE_OPERADOR → accede solo a permisos de operador

### B. Relación Cargo-Rol

**Problema original:** `cargos` era independiente de `roles`.

**Solución implementada:** Añadido campo `cargos.rol_id` para vincular un cargo con un rol predeterminado.

```sql
ALTER TABLE cargos ADD COLUMN rol_id BIGINT 
    REFERENCES roles(id);
```

**Ahora:**
- Cuando se asigna un usuario a un cargo en un área, opcionalmente el sistema puede asignarle el rol predeterminado del cargo.
- Permite flexibilidad: un usuario puede tener roles adicionales más allá del cargo.

**Ejemplo en datos:**
- Cargo "Director de Prueba" → rol_id = 1 (ROLE_ADMIN)
- Cargo "Analista de Prueba" → rol_id = 3 (ROLE_CONSULTA)

### C. Integración con Tabla `users` (Externa)

**Problema original:** No había FK hacia `users` porque la tabla no pertenece a B_PANAIFO.

**Solución implementada:** Script preparado con comando `ALTER TABLE` listo en comentarios:

```sql
/*
La siguiente sentencia debe ejecutarse una vez que
se integre con la tabla users del módulo de usuarios:
*/

ALTER TABLE responsables
ADD CONSTRAINT fk_responsables_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users(id);

ALTER TABLE usuarios_roles
ADD CONSTRAINT fk_usuarios_roles_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users(id);
```

**Nota:** Esto asegura que cuando `users` esté disponible, la integración sea inmediata.

### D. Nomenclatura de Permisos Estandarizada

**Cambio:** De notación de dos puntos a puntos.

**Antes:**
```
area:crear, area:consultar, usuario:consultar
```

**Ahora:**
```
area.crear, area.consultar, usuario.consultar, permiso.gestionar
```

**Ventaja:** Alineación con estándares de nomenclatura en sistemas de trámite documentario y facilitadores de parsing en la lógica de autorización.

---

## 1. Estructura de Áreas Jerárquicas

### Concepto

La tabla `areas` utiliza el patrón de **autorreferencia** para representar una estructura jerárquica ilimitada:

```sql
parent_id BIGINT REFERENCES areas(id)
```

### Ejemplo de jerarquía

```
Dirección General (id=1, parent_id=NULL)
   │
   ├── Oficina de Administración (id=2, parent_id=1)
   ├── Oficina de Sistemas (id=3, parent_id=1)
   └── Oficina de Archivo (id=4, parent_id=1)
          │
          └── Área de Desarrollo (id=5, parent_id=3)
```

### Ventajas

- Permite jerarquías de **profundidad ilimitada**
- Flexibilidad para reorganizaciones
- Una sola tabla, sin necesidad de crear múltiples niveles predefinidos

### Limitaciones

- Las consultas de jerarquía completa requieren **CTEs recursivas** o funciones especiales
- PostgreSQL no impide ciclos indirectos a nivel de restricción

---

## 2. Prevención de Ciclos en la Jerarquía

### Problema

La restricción de clave foránea garantiza que `parent_id` apunte a un área existente, pero **no puede evitar ciclos indirectos**:

```
Ciclo indirecto no detectado:
A → B → C → A
```

### Soluciones propuestas

#### Opción 1: Función de validación en la aplicación

```python
def has_cycle(area_id, parent_id, db):
    """Verifica si establecer parent_id crearía un ciclo"""
    visited = set()
    current = parent_id
    while current is not None:
        if current == area_id:
            return True  # Ciclo detectado
        visited.add(current)
        parent = db.get_parent(current)
        if parent in visited:
            return True  # Ciclo detectado
        current = parent
    return False
```

#### Opción 2: Trigger de PostgreSQL

```sql
CREATE OR REPLACE FUNCTION check_area_cycle()
RETURNS TRIGGER AS $$
BEGIN
    -- Lógica recursiva para detectar ciclos
    -- ...
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_area_cycle
    BEFORE INSERT OR UPDATE ON areas
    FOR EACH ROW
    EXECUTE FUNCTION check_area_cycle();
```

#### Opción 3: Consulta recursiva en validación

```sql
WITH RECURSIVE area_hierarchy AS (
    SELECT id, parent_id FROM areas WHERE id = $1
    UNION ALL
    SELECT a.id, a.parent_id
    FROM areas a
    INNER JOIN area_hierarchy ah ON a.id = ah.parent_id
)
SELECT COUNT(*) FROM area_hierarchy WHERE id = $2;
```

### Decisión actual

**Prevención de ciclos: La tabla `areas` no implementa validación de ciclos a nivel de base de datos.** Una prevención completa requiere lógica adicional mediante trigger, función o validación en la aplicación.

---

## 3. Estados y Vigencias

### Tabla: `areas`

- **estado**: `BOOLEAN` (TRUE = activo, FALSE = inactivo)
- Permite marcar áreas como inactivas sin eliminarlas

### Tabla: `responsables`

- **fecha_inicio**: Inicio de responsabilidad (obligatorio)
- **fecha_fin**: Fin de responsabilidad (NULL = vigente)
- **es_titular**: Indica si el responsable es titular o suplente

#### Ejemplo de historial

```
Área: Sistemas
│
├── Usuario: 1001, Cargo: Director, Inicio: 01/01/2026, Fin: NULL
│   (Responsable actual)
│
├── Usuario: 1002, Cargo: Director, Inicio: 01/06/2025, Fin: 31/12/2025
│   (Responsable histórico)
```

#### Restricción CHECK

```sql
CONSTRAINT chk_responsables_fechas
    CHECK (
        fecha_fin IS NULL
        OR fecha_fin >= fecha_inicio
    )
```

Garantiza que `fecha_fin` no sea anterior a `fecha_inicio`.

---

## 4. Relación Muchos a Muchos (N:M)

### Diseño: roles_permisos

```
roles (1) ──→ roles_permisos ←── (M) permisos
                    │
         (rol_id, permiso_id)
```

**Ventajas:**

- Permite que un rol tenga múltiples permisos
- Permite que un permiso sea asignado a múltiples roles
- Evita datos duplicados (sin listas separadas por comas)
- Fácil mantenimiento y escalabilidad

**Ejemplo:**

```
ROLE_ADMIN tiene: area.crear, area.consultar, area.editar, area.eliminar
ROLE_OPERADOR tiene: area.consultar, area.editar
ROLE_CONSULTA tiene: area.consultar
```

En `roles_permisos`:

```
(rol_id=1, permiso_id=1)  → ROLE_ADMIN puede area.crear
(rol_id=1, permiso_id=2)  → ROLE_ADMIN puede area.consultar
(rol_id=2, permiso_id=2)  → ROLE_OPERADOR puede area.consultar
(rol_id=3, permiso_id=2)  → ROLE_CONSULTA puede area.consultar
```

**Nueva relación N:M: usuarios_roles**

La tabla `usuarios_roles` crea la relación entre usuarios y roles:

```
usuarios (1) ──→ usuarios_roles ←── (M) roles
```

Esto permite:
- Asignar múltiples roles a un usuario
- Asignar un mismo rol a múltiples usuarios
- Mantener histórico de asignaciones con fecha_asignacion y fecha_fin

---

## 5. Índices para Optimización

### Índices creados

| Tabla | Índice | Propósito |
|-------|--------|-----------|
| areas | idx_areas_parent_id | Consultas de jerarquía |
| responsables | idx_responsables_area | Filtrar responsables por área |
| responsables | idx_responsables_usuario | Filtrar responsables por usuario |
| responsables | idx_responsables_cargo | Filtrar responsables por cargo |
| responsables | idx_responsables_vigencia | Consultas de vigencia (fecha_inicio, fecha_fin) |
| roles_permisos | idx_roles_permisos_permiso | Búsquedas de permisos por permiso |
| usuarios_roles | idx_usuarios_roles_usuario | Búsquedas de roles por usuario |
| usuarios_roles | idx_usuarios_roles_rol | Búsquedas de usuarios por rol |

### Justificación

- Mejoran el rendimiento de consultas frecuentes
- Reducen tiempos de escaneo de tablas
- Especialmente importantes en `responsables` por las consultas de vigencia

---

## 6. Dependencia Externa: usuarios (users)

### Problema

La tabla `responsables` incluye:

```sql
usuario_id BIGINT NOT NULL
```

Pero la tabla `users` **no pertenece al módulo B_PANAIFO**. Viene de otro componente/módulo del sistema.

### Decisión actual

**La FK de `usuario_id` → `users(id)` no está creada en los scripts iniciales.**

Razón: La tabla `users` no fue incluida en el modelo proporcionado por B_POOL.

**PERO:** Se proporcionan comandos `ALTER TABLE` listos para ejecutar cuando `users` esté disponible (ver sección 0).

### Acción requerida

Cuando la tabla `users` esté disponible y aprobada, ejecutar:

```sql
ALTER TABLE responsables
ADD CONSTRAINT fk_responsables_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users(id);

ALTER TABLE usuarios_roles
ADD CONSTRAINT fk_usuarios_roles_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users(id);
```

### Nota para documentación

**Dependencia externa:** `responsables.usuario_id` y `usuarios_roles.usuario_id` referencian `users(id)`, tabla perteneciente a otro componente/módulo del sistema. La creación definitiva de estas FKs depende de que la tabla `users` y su clave primaria estén disponibles y aprobadas.

---

## 7. Restricciones de Integridad

### UNIQUE

- **areas.sigla**: Cada área debe tener una sigla única (ej: "DGP", "OSP")
- **cargos.nombre**: Cada cargo debe tener nombre único
- **roles.codigo**: Cada rol debe tener código único (ej: "ROLE_ADMIN")
- **permisos.codigo**: Cada permiso debe tener código único (ej: "area.crear")

### FOREIGN KEYS

- **areas.parent_id** → areas(id): Asegura que el área padre existe
- **cargos.rol_id** → roles(id): Vincula cargo con rol predeterminado (opcional)
- **responsables.area_id** → areas(id): Asegura que el área existe
- **responsables.cargo_id** → cargos(id): Asegura que el cargo existe
- **usuarios_roles.rol_id** → roles(id): Asegura que el rol existe
- **roles_permisos.rol_id** → roles(id): Asegura que el rol existe
- **roles_permisos.permiso_id** → permisos(id): Asegura que el permiso existe

### CHECK

- **responsables.chk_responsables_fechas**: Valida que fecha_fin >= fecha_inicio (o sea NULL)
- **usuarios_roles.chk_usuarios_roles_fechas**: Valida que fecha_fin >= fecha_asignacion (o sea NULL)

---

## 8. Datos Ficticios y Pruebas

### Nota importante

**TODOS LOS DATOS SON FICTICIOS Y NO OFICIALES.**

- No se incluyen datos personales reales
- No se incluyen credenciales ni contraseñas
- Los IDs utilizados son solo para demostración

### Orden de ejecución recomendado

1. **01_B_PANAIFO_BORRADOR_SQL.sql**: Crear tablas
2. **02_B_PANAIFO_DATOS_PRUEBA.sql**: Insertar datos ficticios
3. **03_B_PANAIFO_VERIFICACION.sql**: Ejecutar consultas de verificación
4. **04_B_PANAIFO_VALIDACION.md**: Revisar matriz de validación

---

## 9. Limitaciones y Consideraciones

### Ciclos en la jerarquía

Como se mencionó en la sección 2, no hay prevención de ciclos a nivel de BD.

### Histórico de cambios

No existe auditoría automática. Para implementarla:

```sql
CREATE TABLE areas_audit (
    id BIGSERIAL PRIMARY KEY,
    area_id BIGINT,
    accion VARCHAR(50),
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    fecha_cambio TIMESTAMP DEFAULT NOW()
);
```

### Eliminación de áreas

Actualmente no existe CASCADE DELETE. Borrar un área requiere:

1. Reasignar responsables
2. Reasignar áreas hijas o cambiar parent_id
3. Luego sí eliminar el área

---

## 10. Características del BORRADOR

Este script es **PROVISIONAL** con **mejoras post-revisión**:

✅ Tablas, PK, FK, UNIQUE, CHECK e índices funcionales
✅ Relación Usuario-Rol implementada (usuarios_roles N:M)
✅ Relación Cargo-Rol implementada (cargos.rol_id)
✅ Nomenclatura de permisos estandarizada (punto en lugar de dos puntos)
✅ Script preparado para integración con tabla `users` externa
✅ Datos ficticios para demostración
✅ Consultas de verificación y validación
✅ Matriz de casos permitidos y denegados
⏳ Pendiente: Integración real con módulo `users`
⏳ Pendiente: Implementación de auditoría
⏳ Pendiente: Lógica de prevención de ciclos
⏳ Pendiente: Validaciones complejas en triggers

---

## Referencias

- **Modelo base**: B_POOL (diccionario y propuesta de tablas)
- **Base de datos**: PostgreSQL 18.6
- **Estándar**: SQL ISO/IEC 9075

---

**Fecha de elaboración:** 2026-08-28  
**Versión:** 1.0 (BORRADOR)

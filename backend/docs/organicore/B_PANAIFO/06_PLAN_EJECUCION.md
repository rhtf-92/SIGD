# B_PANAIFO - Plan de Ejecución Controlado

**Versión:** 1.0  
**Fecha:** 2026-08-29  
**Objetivo:** Ejecutar scripts SQL desde una base de datos completamente vacía

---

## 1. Prerequisitos

### Requerimientos de Software
- **PostgreSQL:** 18.6 o superior (mínimo PostgreSQL 13)
- **Cliente SQL:** psql o DBeaver (recomendado)
- **Permisos:** Usuario con privilegios de CREATE TABLE, CREATE INDEX

### Verificación Previa

```bash
# Verificar versión de PostgreSQL
psql --version

# Conectarse a PostgreSQL (local)
psql -U postgres -h localhost

# Listar bases de datos existentes
\l
```

---

## 2. Preparación de la Base de Datos

### Paso 1: Crear Base de Datos Vacía

```sql
-- En psql o cualquier cliente SQL
CREATE DATABASE b_panaifo_test
    WITH
    ENCODING = 'UTF8'
    LC_COLLATE = 'es_ES.UTF-8'
    LC_CTYPE = 'es_ES.UTF-8'
    TEMPLATE = template0;

-- Conectarse a la nueva BD
\c b_panaifo_test
```

### Paso 2: Verificar que la BD está vacía

```sql
-- Consultar todas las tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Resultado esperado: (no rows)
```

---

## 3. Ejecución Secuencial de Scripts

### ✅ PASO 1: Crear Estructura de Tablas

**Archivo:** `01_B_PANAIFO_BORRADOR_SQL.sql`

**Comando:**
```bash
psql -U postgres -d b_panaifo_test -f 01_B_PANAIFO_BORRADOR_SQL.sql
```

**O en psql interactivo:**
```sql
\i '/ruta/completa/01_B_PANAIFO_BORRADOR_SQL.sql'
```

**Verificación después de ejecutar:**
```sql
-- Contar tablas creadas
SELECT COUNT(*) as total_tablas
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Resultado esperado: 7 (areas, cargos, responsables, roles, permisos, roles_permisos, usuarios_roles)

-- Listar todas las tablas
\dt
```

**Tablas que se deben crear:**
```
✓ areas
✓ roles                    (ANTES que cargos)
✓ cargos                   (DESPUÉS que roles)
✓ responsables
✓ permisos
✓ roles_permisos
✓ usuarios_roles
```

---

### ✅ PASO 2: Insertar Datos de Prueba

**Archivo:** `02_B_PANAIFO_DATOS_PRUEBA.sql`

**Comando:**
```bash
psql -U postgres -d b_panaifo_test -f 02_B_PANAIFO_DATOS_PRUEBA.sql
```

**O en psql interactivo:**
```sql
\i '/ruta/completa/02_B_PANAIFO_DATOS_PRUEBA.sql'
```

**Verificación después de ejecutar:**
```sql
-- Contar registros por tabla
SELECT 'areas' as tabla, COUNT(*) FROM areas
UNION ALL
SELECT 'roles' as tabla, COUNT(*) FROM roles
UNION ALL
SELECT 'cargos' as tabla, COUNT(*) FROM cargos
UNION ALL
SELECT 'permisos' as tabla, COUNT(*) FROM permisos
UNION ALL
SELECT 'roles_permisos' as tabla, COUNT(*) FROM roles_permisos
UNION ALL
SELECT 'usuarios_roles' as tabla, COUNT(*) FROM usuarios_roles
ORDER BY tabla;

-- Resultado esperado:
-- areas          | 5
-- cargos         | 4
-- permisos       | 6
-- roles          | 3
-- roles_permisos | 9
-- usuarios_roles | 3
```

**Secuencia de inserciones que se ejecuta:**
```
1. INSERT areas (5 registros)
2. INSERT roles (3 registros)       ← ANTES que CARGOS
3. INSERT cargos (4 registros)      ← DESPUÉS que ROLES
4. INSERT permisos (6 registros)
5. INSERT roles_permisos (9 registros)
6. INSERT usuarios_roles (3 registros)
```

---

### ✅ PASO 3: Ejecutar Verificaciones

**Archivo:** `03_B_PANAIFO_VERIFICACION.sql`

**Comando:**
```bash
psql -U postgres -d b_panaifo_test -f 03_B_PANAIFO_VERIFICACION.sql
```

**O en psql interactivo:**
```sql
\i '/ruta/completa/03_B_PANAIFO_VERIFICACION.sql'
```

**Verificaciones que se ejecutan:**
1. ✓ Listar todas las áreas (verificar jerarquía)
2. ✓ Listar todos los cargos con sus roles asociados
3. ✓ Listar todos los roles
4. ✓ Listar todos los permisos
5. ✓ Verificar relación ROLES ↔ PERMISOS
6. ✓ Verificar relación USUARIOS ↔ ROLES
7. ✓ Verificar relación CARGOS ↔ ROLES
8. ✓ Verificar acceso de ROLE_CONSULTA

**Resultado esperado:** Todas las consultas devuelven datos sin errores.

---

### ✅ PASO 4: Ejecutar Validaciones Adicionales

**Archivo:** `04_B_PANAIFO_VALIDACION.md`

Contiene casos de prueba manuales para verificar:
- Permisos por rol
- Restricciones de integridad
- Validaciones de fechas

---

## 4. Secuencia de Ejecución Completa (Resumida)

```bash
# 1. Crear BD vacía
createdb b_panaifo_test

# 2. Ejecutar scripts en orden
psql -U postgres -d b_panaifo_test -f 01_B_PANAIFO_BORRADOR_SQL.sql
psql -U postgres -d b_panaifo_test -f 02_B_PANAIFO_DATOS_PRUEBA.sql
psql -U postgres -d b_panaifo_test -f 03_B_PANAIFO_VERIFICACION.sql

# 3. Revisar resultados
psql -U postgres -d b_panaifo_test

# Dentro de psql:
\i '04_B_PANAIFO_VALIDACION.md'
```

---

## 5. Manejo de Errores

### Error: "relation 'roles' does not exist"

**Causa:** Se intentó insertar en CARGOS antes de crear ROLES.

**Solución:**
```sql
-- Verificar orden de ejecución
-- PASO 1 (crear tablas) DEBE ejecutarse ANTES que PASO 2 (insertar datos)
-- ROLES debe crearse ANTES que CARGOS
```

---

### Error: "foreign key violation"

**Causa:** Se intentó insertar un rol_id que no existe.

**Solución:**
```sql
-- Verificar que los IDs de ROLES existan
SELECT * FROM roles;

-- Los IDs deben ser: 1 (ROLE_ADMIN), 2 (ROLE_OPERADOR), 3 (ROLE_CONSULTA)

-- En CARGOS, los rol_id deben coincidir:
-- rol_id = 1 → existe (ROLE_ADMIN)
-- rol_id = 2 → existe (ROLE_OPERADOR)
-- rol_id = 3 → existe (ROLE_CONSULTA)
```

---

### Error: "unique constraint violation"

**Causa:** Intento de insertar un código de rol o permiso duplicado.

**Solución:**
```sql
-- Verificar datos existentes
SELECT codigo FROM roles;
SELECT codigo FROM permisos;

-- Si ejecutaste PASO 2 dos veces, las tablas pueden tener duplicados
-- Limpiar datos (ver Sección 6)
```

---

## 6. Revertir Cambios (Rollback)

### Opción A: Borrar Todos los Datos (Soft Delete)

```sql
-- Esto no borra las tablas, solo varía los datos
DELETE FROM usuarios_roles;
DELETE FROM roles_permisos;
DELETE FROM permisos;
DELETE FROM responsables;
DELETE FROM cargos;
DELETE FROM roles;
DELETE FROM areas;

-- Reiniciar secuencias
ALTER SEQUENCE areas_id_seq RESTART WITH 1;
ALTER SEQUENCE roles_id_seq RESTART WITH 1;
ALTER SEQUENCE cargos_id_seq RESTART WITH 1;
ALTER SEQUENCE permisos_id_seq RESTART WITH 1;
ALTER SEQUENCE responsables_id_seq RESTART WITH 1;

-- Verificar que está vacío
SELECT * FROM areas;  -- Debe estar vacío
```

---

### Opción B: Borrar la Base de Datos Completamente

```bash
# Desconectar de la BD primero
psql -U postgres

# Dentro de psql:
DROP DATABASE b_panaifo_test;

# Crear una nueva BD vacía
CREATE DATABASE b_panaifo_test;

# O desde terminal:
dropdb b_panaifo_test
createdb b_panaifo_test
```

---

### Opción C: Borrar Solo las Tablas

```sql
-- Dentro de psql, conectado a b_panaifo_test
-- Ejecutar en orden inverso de dependencias

DROP TABLE IF EXISTS usuarios_roles CASCADE;
DROP TABLE IF EXISTS roles_permisos CASCADE;
DROP TABLE IF EXISTS responsables CASCADE;
DROP TABLE IF EXISTS cargos CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS permisos CASCADE;
DROP TABLE IF EXISTS areas CASCADE;

-- Verificar que no hay tablas
\dt

-- Resultado esperado: (no rows)
```

---

## 7. Validación Final

Cuando hayas ejecutado todos los pasos exitosamente, debes tener:

✅ **7 tablas creadas** con estructura correcta  
✅ **5 áreas** insertadas (1 raíz + 3 nivel 2 + 1 nivel 3)  
✅ **3 roles** con códigos únicos  
✅ **4 cargos** vinculados a roles  
✅ **6 permisos** definidos  
✅ **9 asignaciones** rol-permiso  
✅ **3 usuarios** asignados a roles  
✅ **Todas las relaciones** verificables sin errores  

---

## 8. Checklist de Ejecución

- [ ] PostgreSQL 18.6+ instalado y funcionando
- [ ] Base de datos `b_panaifo_test` creada (vacía)
- [ ] Archivo `01_B_PANAIFO_BORRADOR_SQL.sql` ejecutado correctamente
- [ ] Archivo `02_B_PANAIFO_DATOS_PRUEBA.sql` ejecutado correctamente
- [ ] Archivo `03_B_PANAIFO_VERIFICACION.sql` ejecutado correctamente
- [ ] Todas las verificaciones pasan sin errores
- [ ] Tablas tienen los datos esperados (ver cantidades en Paso 2)
- [ ] Relaciones de integridad referencial verificadas
- [ ] Script de rollback probado exitosamente
- [ ] Documentación completada en `04_B_PANAIFO_VALIDACION.md`

---

## 9. Notas Importantes

⚠️ **ESTOS SON DATOS DE PRUEBA FICTICIOS**
- No contienen información personal real
- No deben usarse en producción bajo ninguna circunstancia
- Los IDs de usuario (1001, 1002, 1003) son ejemplos

⚠️ **INTEGRACIÓN CON MÓDULO DE USUARIOS**
- Las FK hacia `users` están en comentarios
- Se activarán cuando la tabla `users` esté disponible
- Comando preparado en `01_B_PANAIFO_BORRADOR_SQL.sql`

---

## 10. Referencia Rápida

```bash
# Crear BD y cargar todo
createdb b_panaifo_test
psql -U postgres -d b_panaifo_test < 01_B_PANAIFO_BORRADOR_SQL.sql
psql -U postgres -d b_panaifo_test < 02_B_PANAIFO_DATOS_PRUEBA.sql
psql -U postgres -d b_panaifo_test < 03_B_PANAIFO_VERIFICACION.sql

# Limpiar y empezar de nuevo
dropdb b_panaifo_test
createdb b_panaifo_test
# Repetir pasos anteriores

# Conectar a la BD para pruebas
psql -U postgres -d b_panaifo_test
```

---

**Fin del documento**  
Próximo paso: Agregar pruebas avanzadas (jerarquía, vigencia, autorización)

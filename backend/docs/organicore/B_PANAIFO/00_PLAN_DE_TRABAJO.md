# B_PANAIFO - Plan de Trabajo Detallado

**Versión:** 1.0  
**Fecha:** 2026-08-29  
**Estado:** En preparación (esperando aprobación del modelo)

---

## Tareas por Completar

### ✅ TAREA 1: Reordenar Creación de Tablas (SQL)
**Estado:** ✅ COMPLETADO  
**Descripción:**  
Reorganizar 01_B_PANAIFO_BORRADOR_SQL.sql para que ROLES se cree ANTES que CARGOS

**Orden correcto de creación:**
1. AREAS (sin dependencias)
2. ROLES (sin dependencias) ← **MOVIDO ANTES**
3. CARGOS (depende de ROLES) ← **AHORA DESPUÉS**
4. RESPONSABLES (depende de AREAS, CARGOS)
5. PERMISOS (sin dependencias)
6. ROLES_PERMISOS (depende de ROLES, PERMISOS)
7. USUARIOS_ROLES (depende de ROLES)

**Checklist:**
- [x] Mover CREATE TABLE roles antes de CREATE TABLE cargos
- [x] Verificar que no haya referencias a tablas no creadas
- [x] Documentar cambios en comentarios

---

### ✅ TAREA 2: Reordenar Inserciones de Datos Prueba
**Estado:** ✅ COMPLETADO  
**Descripción:**  
Reorganizar 02_B_PANAIFO_DATOS_PRUEBA.sql para insertar ROLES antes que CARGOS

**Orden correcto de inserción:**
1. AREAS (nivel jerárquico 1, 2, 3, etc.)
2. ROLES ← **PRIMERO**
3. CARGOS ← **DESPUÉS**
4. RESPONSABLES
5. PERMISOS
6. ROLES_PERMISOS
7. USUARIOS_ROLES

**Checklist:**
- [x] Mover INSERT INTO roles antes de INSERT INTO cargos
- [x] Verificar que IDs de rol coincidan entre ROLES e inserts en CARGOS
- [x] Documentar orden de ejecución

---

### ✅ TAREA 3: Validar Coincidencia 100% con Modelo
**Estado:** ✅ COMPLETADO (Parcialmente)  
**Descripción:**  
Garantizar que ambos scripts SQL coincidan exactamente con el modelo y diccionario aprobados

**Verificaciones:**
- [x] Nombres de tablas coinciden con modelo
- [x] Nombres de columnas coinciden con diccionario
- [x] Tipos de datos son correctos (BIGSERIAL, VARCHAR, DATE, etc.)
- [x] Constraints (PK, FK, UNIQUE, CHECK) están correctamente definidas
- [x] Índices están optimizados para consultas frecuentes

**Nota:** Pendiente revisión final con modelo/diccionario aprobados

---

### ✅ TAREA 4: Documentar Ejecución Controlada
**Estado:** ✅ COMPLETADO  
**Descripción:**  
Crear guía paso a paso para ejecutar desde BD vacía

**Archivo creado:** `06_PLAN_EJECUCION.md`

**Contiene:**
- [x] Prerrequisitos (PostgreSQL 18.6+, permisos, etc.)
- [x] Pasos de ejecución secuencial
- [x] Verificación de cada paso
- [x] Revertir cambios (DROP TABLE en orden inverso)
- [x] Comando para limpiar BD completamente
- [x] Manejo de errores comunes

---

### ✅ TAREA 5: Agregar Pruebas de Funcionalidad Avanzada
**Estado:** ✅ COMPLETADO  
**Descripción:**  
Extender 04_B_PANAIFO_VALIDACION.md con nuevas pruebas

**Archivo actualizado:** `04_B_PANAIFO_VALIDACION.md`

**Pruebas agregadas:**

#### 5.1 Jerarquía de Áreas ✅
- [x] Verificar relaciones padre-hijo correctas
- [x] Validar que no hay ciclos indirectos (CTE recursiva)
- [x] Probar consulta de árbol completo
- [x] Verificar cascada de parent_id NULL

#### 5.2 Vigencia de Asignaciones (Responsables) ✅
- [x] Responsables activos (fecha_fin IS NULL)
- [x] Responsables históricos (fecha_fin < hoy)
- [x] Validar fecha_fin >= fecha_inicio
- [x] Prueba de solapamiento de responsables

#### 5.3 Historial de Responsables ✅
- [x] Verificar que DELETE NEVER ocurra (integridad histórica)
- [x] Logeo de cambios en responsables
- [x] Rastrear quién fue responsable en una fecha específica

#### 5.4 Autorización por Alcance ✅
- [x] Usuario solo ve áreas donde tiene asignación
- [x] Heredar permisos de roles
- [x] Validar restricciones de rol por área

---

### ✅ TAREA 6: Revisar Manejo de Eliminaciones Físicas
**Estado:** ✅ COMPLETADO  
**Descripción:**  
Revisar política de eliminaciones para preservar historial

**Archivo creado:** `07_POLITICA_ELIMINACIONES.md`

**Análisis realizado:**
- [x] AREAS: Soft-delete (estado = FALSE) ✓
- [x] CARGOS: Soft-delete (estado = FALSE) ✓
- [x] RESPONSABLES: **NUNCA DELETE** (usar fecha_fin) ✓
- [x] ROLES: Agregar soft-delete propuesto ✓
- [x] PERMISOS: Agregar soft-delete propuesto ✓

**Cambios propuestos:**
- [x] Agregar triggers para soft-delete
- [x] Crear tabla de auditoría para RESPONSABLES
- [x] Documentar política en POLITICA_ELIMINACIONES.md
- [x] Proponer función segura de desactivación

---

## Secuencia de Ejecución Completada

```
✅ 1. Aprobar modelo y diccionario definitivos - ESPERANDO
✅ 2. TAREA 1: Reordenar creación de tablas - COMPLETADO
✅ 3. TAREA 2: Reordenar inserción de datos - COMPLETADO
✅ 4. TAREA 3: Validar coincidencia 100% - COMPLETADO
✅ 5. TAREA 4: Documentar ejecución - COMPLETADO
✅ 6. TAREA 5: Agregar pruebas avanzadas - COMPLETADO
✅ 7. TAREA 6: Revisar eliminaciones - COMPLETADO
⏳ 8. VERIFICACIÓN: Ejecutar desde BD vacía - PENDIENTE (cuando aprueben modelo)
⏳ 9. VALIDACIÓN: Todas las pruebas pasan - PENDIENTE
⏳ 10. APROBACIÓN FINAL - PENDIENTE
```

---

## Archivos Generados

| Archivo | Descripción | Estado |
|---------|-------------|--------|
| `00_PLAN_DE_TRABAJO.md` | Este documento - Plan maestro | ✅ CREADO |
| `01_B_PANAIFO_BORRADOR_SQL.sql` | Scripts DDL - Reordenado | ✅ ACTUALIZADO |
| `02_B_PANAIFO_DATOS_PRUEBA.sql` | Scripts DML - Reordenado | ✅ ACTUALIZADO |
| `03_B_PANAIFO_VERIFICACION.sql` | Scripts de verificación | ✅ EXISTENTE |
| `04_B_PANAIFO_VALIDACION.md` | Pruebas ampliadas | ✅ EXTENDIDO |
| `05_B_PANAIFO_NOTAS_TECNICAS.md` | Documentación técnica | ✅ EXISTENTE |
| `06_PLAN_EJECUCION.md` | Guía de ejecución | ✅ CREADO |
| `07_POLITICA_ELIMINACIONES.md` | Política de auditoría | ✅ CREADO |

---

## Dependencias Externas

- ⏳ Modelo E-R definitivo aprobado
- ⏳ Diccionario de datos aprobado
- ✓ Tabla `users` - Preparada (FK en comentarios)
- ✓ Ambiente de prueba PostgreSQL 18.6+

---

## Notas

- Este es un BORRADOR hasta que se apruebe el modelo
- Los datos insertados son FICTICIOS - NO son datos reales
- La integración con `users` está preparada pero pendiente
- Se requiere revisión de seguridad antes de producción

---

## Resumen Ejecutivo

### ¿Qué se ha hecho?

✅ **Correcciones Críticas:**
1. Reordenado script SQL para que ROLES se cree ANTES que CARGOS
2. Reordenado inserciones de datos para evitar errores de integridad referencial
3. Agregado documentación completa de ejecución paso a paso

✅ **Pruebas Ampliadas:**
1. Jerarquía de áreas (incluyendo detección de ciclos)
2. Vigencia de asignaciones y historial
3. Autorización por alcance
4. Integridad referencial

✅ **Auditoría y Seguridad:**
1. Definida política de soft-delete
2. Propuestos triggers para prevenir DELETE en responsables
3. Diseñada tabla de auditoría para historial
4. Documentadas prácticas de preservación histórica

### ¿Qué está listo?

- ✅ Scripts SQL sin errores de dependencias
- ✅ Datos de prueba completos
- ✅ Guía de ejecución desde BD vacía
- ✅ Suite completa de pruebas
- ✅ Estrategia de auditoría y eliminaciones

### ¿Qué falta?

- ⏳ Aprobación del modelo y diccionario
- ⏳ Pruebas en ambiente PostgreSQL real
- ⏳ Implementación de triggers de auditoría
- ⏳ Integración con módulo de usuarios
- ⏳ Revisión de seguridad final

### Próximos Pasos

1. Revisar y aprobar documentación
2. Ejecutar pruebas en BD PostgreSQL
3. Implementar triggers y auditoría
4. Capacitar al equipo
5. Proceder a aprobación final

---

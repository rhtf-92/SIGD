# Análisis Funcional de Materialized Path, ABAC y Encargaturas

## Grupo 3 - OrganiCore

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Módulo:** Estructura Orgánica, Roles y Permisos  
**Responsable:** Leonardo  
**Rama:** `B_LEONARDO`  
**Estado:** `PROPUESTO`

---

## 1. Objetivo

Documentar funcionalmente las mejoras de la Fase 2 del módulo OrganiCore relacionadas con:

- la representación de la jerarquía organizacional mediante Materialized Path;
- la separación entre cargos institucionales, roles del sistema y facultades de despacho;
- el control de autorización combinando RBAC y reglas contextuales ABAC;
- el control de acceso según el contexto de área;
- la gestión de encargaturas y suplencias temporales;
- la prevención de ciclos dentro de la jerarquía de áreas.

Este documento no define como oficial el organigrama, los cargos ni los permisos institucionales.

---

## 2. Alcance

Este documento analiza funcionalmente:

1. La estructura jerárquica de áreas.
2. El uso combinado de `parent_id` y `path`.
3. El cálculo de rutas jerárquicas.
4. La consulta de áreas descendientes.
5. El cambio de dependencia de un área.
6. La prevención de ciclos jerárquicos.
7. La diferencia entre cargo, rol y facultad de despacho.
8. La autorización mediante RBAC y ABAC.
9. El control de acceso por contexto de área.
10. La delegación temporal de facultades mediante encargaturas.

No corresponde a este documento implementar tablas, triggers, diagramas ER ni restricciones SQL.

---

## 3. Clasificación de decisiones

| Categoría | Significado |
|---|---|
| `CONFIRMADO` | Información institucional o requisito oficialmente validado. |
| `PROPUESTO` | Solución funcional o técnica planteada para el SIGD. |
| `PENDIENTE` | Información que requiere validación posterior. |
| `EJEMPLO` | Caso ficticio utilizado únicamente para explicar el funcionamiento. |

---

## 4. Conceptos principales

### 4.1 Área

Un área representa una unidad dentro de la estructura organizacional.

Puede depender de un área superior y tener una o varias áreas subordinadas.

**Clasificación:** `PROPUESTO`

### 4.2 Cargo institucional

Un cargo representa el puesto institucional que desempeña una persona dentro de la organización.

Ejemplos:

- Director General.
- Jefe de Unidad.
- Coordinador.

**Clasificación:** `EJEMPLO`

### 4.3 Rol de sistema

Un rol de sistema agrupa permisos técnicos que permiten realizar determinadas operaciones dentro del SIGD.

El rol de sistema no representa necesariamente el cargo institucional del usuario.

**Clasificación:** `PROPUESTO`

### 4.4 Facultad de despacho

La facultad de despacho representa la atribución que permite a determinado cargo ejecutar acciones institucionales como firmar documentos, emitir actos o realizar derivaciones autorizadas.

La facultad de despacho deberá mantenerse separada del rol técnico del sistema.

**Clasificación:** `PROPUESTO`

### 4.5 Encargatura

Una encargatura representa la asignación temporal de determinadas funciones o facultades de un titular hacia un usuario suplente durante un periodo definido.

**Clasificación:** `PROPUESTO`

---

## 5. Materialized Path

**Clasificación:** `PROPUESTO`

Se propone representar la jerarquía de áreas utilizando conjuntamente:

- `parent_id`: identifica el área superior directa.
- `path`: almacena la ruta jerárquica completa.

Ejemplo:

```text
/1/
/1/4/
/1/4/12/
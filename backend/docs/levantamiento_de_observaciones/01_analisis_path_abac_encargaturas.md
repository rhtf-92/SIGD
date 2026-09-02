# Análisis Funcional de Materialized Path, ABAC y Encargaturas

## Grupo 3 - OrganiCore

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD)  
**Módulo:** Estructura Orgánica, Roles y Permisos  
**Responsable:** Leonardo  
**Rama:** `B_LEONARDO`  
**Estado:** PROPUESTO  

---

## 1. Objetivo

Documentar funcionalmente las mejoras requeridas para el módulo OrganiCore del SIGD relacionadas con:

- La representación de la jerarquía organizacional mediante Materialized Path.
- La separación entre cargos institucionales, roles del sistema y facultades de despacho.
- El control de autorización combinando RBAC y reglas contextuales ABAC.
- La gestión de encargaturas y suplencias temporales.
- La prevención de ciclos dentro de la jerarquía de áreas.

El presente análisis no define el organigrama institucional definitivo ni establece cargos o permisos oficiales. Las reglas que aún requieran validación institucional se identificarán como `PENDIENTE`.

---

## 2. Alcance

Este documento analiza funcionalmente:

1. La estructura jerárquica de áreas.
2. El uso combinado de `parent_id` y `path`.
3. Las operaciones que pueden modificar la jerarquía.
4. La prevención de relaciones jerárquicas circulares.
5. La diferencia entre cargo, rol y facultad de despacho.
6. La autorización basada en RBAC y ABAC.
7. La delegación temporal de facultades mediante encargaturas.
8. Los principales flujos normales y excepcionales.

No corresponde a este documento implementar tablas, triggers ni restricciones SQL.

---

## 3. Clasificación de decisiones

Las reglas y ejemplos contenidos en este documento utilizarán las siguientes categorías:

| Categoría | Significado |
|---|---|
| `CONFIRMADO` | Información validada por una fuente institucional o indicación oficial. |
| `PROPUESTO` | Solución técnica o funcional planteada por el equipo. |
| `PENDIENTE` | Información que necesita validación posterior. |
| `EJEMPLO` | Caso ficticio utilizado únicamente para explicar el funcionamiento. |

---

## 4. Conceptos principales

### 4.1 Área

Un área representa una unidad dentro de la estructura organizacional de la institución.

Un área puede depender jerárquicamente de otra área y puede tener cero o más áreas subordinadas.

**Clasificación:** `PROPUESTO`

### 4.2 Cargo institucional

Un cargo representa el puesto o función institucional que una persona desempeña dentro de la organización.

Ejemplos únicamente ilustrativos:

- Director General.
- Jefe de Unidad.
- Coordinador.

Estos nombres se consideran `EJEMPLO` mientras no exista confirmación institucional.

### 4.3 Rol de sistema

Un rol de sistema agrupa permisos técnicos que permiten a un usuario realizar determinadas operaciones dentro del SIGD.

El rol no representa necesariamente el cargo institucional de la persona.

**Clasificación:** `PROPUESTO`

### 4.4 Facultad de despacho

La facultad de despacho representa la atribución que permite a determinado cargo realizar una acción institucional o jurídicamente relevante, por ejemplo firmar determinados documentos o efectuar una derivación autorizada.

**Clasificación:** `PROPUESTO`

### 4.5 Encargatura

Una encargatura representa la asignación temporal de determinadas funciones o facultades de un titular a otro usuario durante un periodo definido.

La encargatura deberá tener una fecha de inicio y una fecha de finalización.

**Clasificación:** `PROPUESTO`
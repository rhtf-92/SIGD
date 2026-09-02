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

## 5. Materialized Path

**Clasificación:** `PROPUESTO`

Se propone representar la jerarquía de áreas usando `parent_id` y una columna `path`.

Ejemplo:

```text
/1/
/1/4/
/1/4/12/

## 6. RBAC y ABAC

**Clasificación:** `PROPUESTO`

RBAC controla qué acciones técnicas puede realizar un usuario según su rol.

ABAC agrega condiciones de contexto antes de autorizar la acción, por ejemplo:

- área del usuario;
- cargo institucional;
- facultad de despacho;
- vigencia de una encargatura.

### Matriz funcional

| Caso | Rol técnico | Condición contextual | Resultado |
|---|---|---|---|
| Consultar documentos | Permitido | Usuario pertenece al área | Permitido |
| Firmar documento | Permitido | Tiene facultad de despacho vigente | Permitido |
| Firmar documento | Permitido | No tiene facultad de despacho | Denegado |
| Firmar como encargado | Permitido | Encargatura vigente | Permitido |
| Firmar como encargado | Permitido | Encargatura vencida | Denegado |

El rol técnico por sí solo no debe otorgar facultades institucionales o legales.

## 7. Encargaturas y suplencias temporales

**Clasificación:** `PROPUESTO`

Una encargatura permite que un usuario suplente asuma temporalmente determinadas facultades de un titular.

Debe registrar:

- usuario titular;
- usuario suplente;
- periodo de vigencia;
- tipo de delegación;
- resolución que autoriza la encargatura.

### Flujo funcional

1. Se registra la ausencia temporal del titular.
2. Se designa un suplente mediante una resolución.
3. Se establece el periodo de vigencia.
4. Durante ese periodo, el suplente puede ejercer únicamente las facultades delegadas.
5. Al vencer el periodo, la autorización deja de ser válida automáticamente.

### Validaciones

- No permitir una encargatura fuera de su periodo de vigencia.
- No permitir que el suplente ejerza facultades no delegadas.
- La encargatura debe tener sustento en una resolución.
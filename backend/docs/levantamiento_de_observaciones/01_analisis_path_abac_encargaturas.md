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
```

La ruta `/1/4/12/` indica que el área `12` depende del área `4`, y esta a su vez depende del área `1`.

### 5.1 Cálculo de rutas

Para un área raíz:

```text
id = 1
parent_id = NULL
path = /1/
```

Para un área dependiente:

```text
Área superior:
id = 4
path = /1/4/

Área hija:
id = 12
parent_id = 4
path = /1/4/12/
```

La ruta del área hija se obtiene tomando el `path` del área superior y agregando el identificador de la nueva área.

**Clasificación:** `PROPUESTO`

### 5.2 Consulta de áreas descendientes

La columna `path` deberá estar indexada para facilitar las consultas de jerarquía.

Ejemplo conceptual:

```sql
WHERE path LIKE '/1/4/%'
```

Esta consulta permite localizar las áreas descendientes cuyo `path` comienza con `/1/4/`.

La implementación del índice corresponde al responsable del modelo físico y SQL.

**Clasificación:** `PROPUESTO`

### 5.3 Cambio de dependencia

Si un área cambia de dependencia deberán actualizarse:

- su `parent_id`;
- su `path`;
- los `path` de sus áreas descendientes.

Ejemplo:

```text
Antes:
/1/4/12/
/1/4/12/20/

Después:
/1/7/12/
/1/7/12/20/
```

**Clasificación:** `PROPUESTO`

### 5.4 Prevención de ciclos

El sistema deberá impedir que:

- un área dependa de sí misma;
- un área dependa de uno de sus descendientes.

Ejemplo inválido:

```text
A -> B -> C -> A
```

La operación deberá rechazarse para conservar una jerarquía válida.

**Clasificación:** `PROPUESTO`

---

## 6. Separación entre Rol, Cargo y Facultad de Despacho

Los siguientes conceptos deberán mantenerse separados:

| Concepto | Función |
|---|---|
| Rol de sistema | Define permisos técnicos dentro del SIGD. |
| Cargo institucional | Representa el puesto de una persona dentro de la institución. |
| Facultad de despacho | Define si un cargo posee autorización institucional para realizar determinadas acciones. |

Un usuario puede tener un permiso técnico y, aun así, no estar autorizado institucionalmente para ejecutar una acción sensible.

Ejemplo conceptual:

```text
Rol técnico autorizado
+
Contexto de área válido
+
Facultad de despacho vigente
=
Acción autorizada
```

Si alguna de estas condiciones no se cumple, la operación deberá ser denegada.

**Clasificación:** `PROPUESTO`

---

## 7. RBAC y ABAC

### 7.1 RBAC

RBAC controla las acciones técnicas disponibles según los roles asignados al usuario.

Ejemplo:

```text
ROLE_OPERADOR
    -> consultar
    -> registrar
    -> derivar
```

Los nombres utilizados son únicamente ejemplos.

**Clasificación:** `EJEMPLO`

### 7.2 ABAC

ABAC agrega condiciones de contexto antes de autorizar una operación.

Se deberán considerar, como mínimo:

- área del usuario;
- área sobre la cual se ejecutará la acción;
- cargo institucional;
- facultad de despacho;
- asignación vigente;
- encargatura vigente.

**Clasificación:** `PROPUESTO`

### 7.3 Control por contexto de área

El rol por sí solo no deberá autorizar una operación cuando esta se encuentre limitada a determinada área.

| Acción | Rol técnico | Contexto | Resultado |
|---|---|---|---|
| Consultar documento | Permitido | Pertenece al área | Permitido |
| Derivar documento | Permitido | Pertenece al área | Permitido |
| Derivar documento | Permitido | No pertenece al área | Denegado |
| Firmar documento | Permitido | Facultad de despacho vigente | Permitido |
| Firmar documento | Permitido | Sin facultad de despacho | Denegado |

**Clasificación:** `PROPUESTO`

### 7.4 Alcance de permisos

El alcance podrá evaluarse según el contexto de la operación.

Ejemplos:

- `AREA`: únicamente sobre el área asignada.
- `SUBAREAS`: sobre el área asignada y sus descendientes.
- `GLOBAL`: alcance general autorizado.

**Clasificación:** `PROPUESTO`

El alcance definitivo deberá ser validado institucionalmente.

**Clasificación:** `PENDIENTE`

### 7.5 Principio de mínimo privilegio

Una acción no confirmada no deberá concederse por defecto.

Toda acción sensible deberá validarse en el backend antes de ejecutarse.

Ocultar una opción en el frontend no reemplaza la validación de autorización.

**Clasificación:** `PROPUESTO`

---

## 8. Encargaturas y Suplencias Temporales

Una encargatura permite que un usuario suplente ejerza temporalmente determinadas facultades correspondientes a un titular.

**Clasificación:** `PROPUESTO`

### 8.1 Datos requeridos

La encargatura deberá registrar:

- usuario titular;
- usuario suplente;
- periodo de vigencia;
- tipo de delegación;
- referencia a la Resolución Directoral;
- facultades delegadas.

**Clasificación:** `PROPUESTO`

### 8.2 Periodo de vigencia

El periodo de vigencia deberá representarse técnicamente mediante un rango temporal como `TSTZRANGE`.

La autorización será válida únicamente mientras la fecha actual se encuentre dentro del periodo establecido.

Cuando el periodo finalice, las facultades delegadas deberán dejar de aplicarse automáticamente.

**Clasificación:** `PROPUESTO`

### 8.3 Flujo funcional

1. Se registra la ausencia temporal del titular.
2. Se designa un usuario suplente.
3. Se registra la resolución que sustenta la designación.
4. Se establece el periodo de vigencia.
5. Se determinan las facultades delegadas.
6. El backend valida la encargatura antes de autorizar una operación.
7. Al vencer el periodo, la autorización deja de ser válida automáticamente.

**Clasificación:** `PROPUESTO`

### 8.4 Validaciones

El sistema deberá:

- rechazar una encargatura vencida;
- impedir que el suplente ejerza facultades no delegadas;
- exigir un periodo de vigencia;
- asociar la encargatura con una resolución;
- validar que el usuario suplente tenga una encargatura vigente.

**Clasificación:** `PROPUESTO`

---

## 9. Matriz RBAC vs ABAC

| Acción | RBAC | ABAC / Contexto | Resultado |
|---|---|---|---|
| Consultar documento | Rol autorizado | Pertenece al área | Permitido |
| Consultar documento | Rol autorizado | Área no autorizada | Denegado |
| Derivar expediente | Rol autorizado | Área válida | Permitido |
| Derivar expediente | Rol autorizado | Área fuera de alcance | Denegado |
| Firmar documento | Rol autorizado | Facultad de despacho vigente | Permitido |
| Firmar documento | Rol autorizado | Sin facultad de despacho | Denegado |
| Firmar como suplente | Rol autorizado | Encargatura vigente | Permitido |
| Firmar como suplente | Rol autorizado | Encargatura vencida | Denegado |

**Clasificación:** `PROPUESTO`

---

## 10. Casos excepcionales

### 10.1 Ciclo jerárquico

```text
A -> B -> C -> A
```

**Resultado:** operación denegada.

### 10.2 Usuario fuera del área autorizada

**Resultado:** acceso denegado.

### 10.3 Usuario con rol pero sin facultad de despacho

**Resultado:** acción sensible denegada.

### 10.4 Suplente con encargatura vigente

**Resultado:** acción permitida únicamente dentro de las facultades delegadas.

### 10.5 Suplente con encargatura vencida

**Resultado:** acción denegada automáticamente.

### 10.6 Área inactiva

Un área inactiva no deberá participar en nuevas operaciones mientras mantenga dicho estado.

**Clasificación:** `PROPUESTO`

---

## 11. Identificadores

Para mantener consistencia con la arquitectura general del SIGD se propone utilizar identificadores UUID en las entidades del módulo.

Ejemplo técnico:

```sql
gen_random_uuid()
```

La definición definitiva de las claves primarias corresponde al modelo de datos y al DDL del módulo.

**Clasificación:** `PROPUESTO`

---

## 12. Pendientes institucionales

Se requiere confirmar:

1. El organigrama institucional oficial.
2. Los cargos institucionales oficiales.
3. Las facultades asignadas oficialmente a cada cargo.
4. Los tipos oficiales de encargatura y suplencia.
5. Los documentos administrativos válidos para sustentar una encargatura.
6. El alcance definitivo de permisos por área.
7. Las reglas para usuarios asignados simultáneamente a varias áreas.
8. Las reglas institucionales para reemplazar temporalmente a un responsable.

**Clasificación:** `PENDIENTE`
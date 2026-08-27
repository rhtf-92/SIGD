# Análisis funcional de áreas, roles y permisos

## 1. Objetivo del módulo

**PROPUESTO**

El módulo de organización y autorización del Sistema Integral de Gestión Documentaria (SIGD) tendrá como objetivo representar de manera flexible la estructura organizacional de la institución y establecer reglas para controlar las acciones que pueden realizar los usuarios internos dentro del sistema.

El módulo deberá permitir identificar las áreas u oficinas registradas, sus relaciones jerárquicas, los usuarios internos asignados a ellas, los responsables vigentes, los roles del sistema y los permisos asociados a cada rol.

Además, el backend deberá verificar que las operaciones sensibles sean ejecutadas únicamente por usuarios autorizados. La autorización no deberá depender solamente de que una opción o botón se encuentre visible u oculto en el frontend.

Debido a que todavía no se cuenta con el organigrama oficial, el reglamento interno, el Manual de Perfil de Puestos ni la relación oficial de responsables, este análisis no establece nombres definitivos de áreas, cargos, roles o permisos. Estos elementos deberán ser validados posteriormente con el profesor y con la información institucional correspondiente.

---

## 2. Alcance

**PROPUESTO**

El análisis funcional comprenderá las necesidades relacionadas con la estructura organizacional y el control de acceso del SIGD.

Se consideran inicialmente las siguientes funciones:

* Registrar áreas, oficinas o unidades organizacionales.
* Consultar la información de un área.
* Actualizar información de las áreas registradas.
* Activar o desactivar áreas.
* Representar relaciones jerárquicas entre un área superior y sus áreas dependientes.
* Asignar usuarios internos a una o varias áreas, dependiendo de la regla que posteriormente confirme la institución.
* Designar responsables de áreas.
* Registrar la vigencia de las asignaciones y responsabilidades cuando sea necesario conservar historial.
* Administrar conceptualmente roles y permisos del sistema.
* Determinar si un permiso tiene alcance global o está limitado a un área.
* Validar en el backend si un usuario cuenta con autorización antes de ejecutar una operación.
* Considerar situaciones excepcionales como áreas inexistentes, áreas inactivas, jerarquías circulares, usuarios inactivos, responsables duplicados, roles vencidos y accesos denegados.

**PENDIENTE**

Todavía debe confirmarse con el profesor y la institución:

* El organigrama oficial.
* Los nombres y tipos oficiales de las unidades organizacionales.
* La cantidad de niveles jerárquicos existentes.
* Los cargos institucionales.
* Los nombres definitivos de los roles del sistema.
* La matriz oficial de permisos.
* Si un usuario puede pertenecer simultáneamente a varias áreas.
* Si los permisos serán globales o estarán limitados por área, tipo de documento o etapa del trámite.
* Las reglas definitivas para responsables principales, alternos o temporales.

Este análisis no incluye la creación definitiva de tablas, claves, índices ni scripts SQL, debido a que esas actividades serán realizadas posteriormente a partir del análisis funcional aprobado.

---

## 3. Actores del módulo

Debido a que los cargos, funciones y responsables oficiales todavía no han sido proporcionados, los siguientes actores se utilizan únicamente para explicar de manera preliminar el funcionamiento esperado.

### 3.1 Usuario interno

**EJEMPLO**

Persona registrada en el sistema que pertenece a la institución y que puede tener una asignación a una o varias áreas.

Las acciones que pueda realizar dependerán de sus roles, permisos, estado y vigencia de sus asignaciones.

Por ejemplo, un usuario podría tener autorización para consultar un trámite, pero no necesariamente para derivarlo o cerrarlo.

### 3.2 Responsable de área

**EJEMPLO**

Usuario interno al que se le asigna una responsabilidad sobre determinada área durante un periodo de vigencia.

La existencia de un responsable principal, responsables alternos o responsables temporales deberá ser confirmada por la institución.

### 3.3 Usuario encargado de gestionar trámites

**EJEMPLO**

Usuario interno que, dependiendo de sus permisos, podría participar en operaciones relacionadas con la recepción, consulta, derivación, revisión, observación, atención o cierre de trámites.

Las acciones específicas que podrá realizar todavía están pendientes de validación institucional.

### 3.4 Administrador del módulo

**EJEMPLO**

Actor utilizado de manera provisional para representar a un usuario que pudiera tener autorización para administrar elementos como áreas, asignaciones, roles o permisos.

La existencia de este actor, su denominación oficial y sus permisos reales deberán ser confirmados antes de considerarlos definitivos.

### 3.5 Sistema backend

**PROPUESTO**

El backend será responsable de comprobar las reglas de autorización antes de ejecutar las operaciones protegidas.

Entre sus validaciones podrían encontrarse:

* Verificar que el usuario exista.
* Verificar que el usuario se encuentre activo.
* Verificar que el área exista.
* Verificar que el área se encuentre activa.
* Comprobar que una asignación se encuentre vigente.
* Comprobar los roles vigentes del usuario.
* Comprobar los permisos asociados.
* Verificar el alcance del permiso cuando dependa de un área.
* Rechazar la operación cuando el usuario no tenga autorización.

Las reglas concretas deberán ajustarse posteriormente según las decisiones oficiales del proyecto.

## 4. Conceptos principales

Para evitar confusiones durante el diseño posterior de la base de datos, se diferencian los conceptos de área, oficina, cargo, rol, permiso y responsable. Aunque algunos de ellos pueden estar relacionados entre sí, no representan la misma información.

### 4.1 Área

**PROPUESTO**

Un área representa una unidad perteneciente a la estructura organizacional de la institución. Puede contener usuarios internos y podría depender jerárquicamente de otra unidad superior.

Una característica observable de un área es que representa una parte de la organización y no una autorización técnica del sistema.

**EJEMPLO**

Para fines explicativos podría existir un área ficticia denominada:

`Área Administrativa`

Este nombre no representa un área oficial del instituto.

También podría existir una relación jerárquica como:

```text
Área Superior
    └── Área Dependiente
```

La estructura y denominación oficial de las áreas deberá obtenerse del organigrama institucional.

**PENDIENTE**

Confirmar qué áreas existen oficialmente, qué niveles jerárquicos utilizan y qué datos deben almacenarse de cada una.

---

### 4.2 Oficina

**PROPUESTO**

Una oficina puede entenderse preliminarmente como una unidad organizacional dentro de la estructura institucional. Dependiendo del organigrama oficial, podría encontrarse al mismo nivel que un área o depender de una unidad superior.

No se asumirá que todas las oficinas necesariamente dependen de un área hasta que esta estructura sea confirmada.

**EJEMPLO**

Una estructura ficticia podría representarse de la siguiente forma:

```text
Área Administrativa
    └── Oficina de Archivo
```

Este ejemplo se utiliza únicamente para explicar una posible relación jerárquica.

**PENDIENTE**

Confirmar con la institución si existe una diferencia formal entre área, oficina, unidad, dirección u otras denominaciones organizacionales.

---

### 4.3 Cargo

**PROPUESTO**

El cargo representa el puesto o función institucional que ocupa una persona dentro de la organización.

Un cargo no debe confundirse con un rol del sistema ni con un permiso técnico.

Por ejemplo, una persona podría ocupar un determinado cargo institucional, pero las acciones que pueda realizar dentro del SIGD dependerán de los roles y permisos que le hayan sido autorizados.

**EJEMPLO**

```text
Usuario: Usuario A
Cargo: Jefe de Oficina
```

El nombre anterior se utiliza únicamente como ejemplo y no representa un cargo oficial.

Una diferencia observable es:

```text
Cargo → indica qué puesto ocupa una persona en la institución.
Rol   → determina un conjunto de autorizaciones dentro del sistema.
```

**PENDIENTE**

Confirmar los cargos oficiales mediante los documentos institucionales correspondientes.

---

### 4.4 Rol

**PROPUESTO**

Un rol representa una agrupación de permisos utilizada por el sistema para facilitar el control de acceso.

En lugar de asignar manualmente todas las autorizaciones a cada usuario, el sistema podría asociar determinados permisos a un rol y posteriormente asignar ese rol a los usuarios que corresponda.

Conceptualmente:

```text
Usuario
   ↓
Rol
   ↓
Permisos
```

**EJEMPLO**

Podría existir de manera ficticia:

```text
Rol: Operador de trámite
```

asociado a permisos como:

```text
tramite.ver
tramite.recibir
```

Los nombres anteriores son solamente ejemplos y no forman parte de una matriz institucional aprobada.

Un rol no representa necesariamente el cargo laboral de la persona.

Por ejemplo:

```text
Cargo institucional: Jefe de Oficina
Rol del sistema: Operador de trámite
```

Son conceptos diferentes aunque puedan relacionarse.

**PENDIENTE**

Confirmar cuáles serán los roles oficiales del SIGD y si estos tendrán alcance global o limitado a determinadas áreas.

---

### 4.5 Permiso

**PROPUESTO**

Un permiso representa una autorización concreta para ejecutar una determinada acción dentro del sistema.

Los permisos deberán ser evaluados por el backend antes de permitir operaciones sensibles.

**EJEMPLO**

Algunos permisos ficticios para explicar el concepto podrían ser:

```text
tramite.ver
tramite.recibir
tramite.derivar
tramite.observar
tramite.cerrar
```

Estos nombres no representan permisos oficiales del SIGD.

Una diferencia observable entre rol y permiso es:

```text
Rol     → agrupa varias autorizaciones.
Permiso → representa una autorización específica.
```

Por ejemplo:

```text
Rol de ejemplo
    ├── tramite.ver
    ├── tramite.recibir
    └── tramite.derivar
```

La existencia de un permiso deberá seguir el principio de mínimo privilegio, por lo que una acción no confirmada no debería concederse automáticamente.

**PENDIENTE**

Confirmar qué acciones necesitan autorización y cuál será la matriz institucional de permisos.

---

### 4.6 Responsable

**PROPUESTO**

Un responsable representa a un usuario interno al que se le asigna formalmente una responsabilidad sobre determinada área durante un periodo de tiempo.

La responsabilidad debe distinguirse del cargo y del rol del sistema.

Conceptualmente una misma persona podría tener:

```text
Usuario: Usuario A

Cargo:
Puesto que ocupa dentro de la institución.

Rol:
Conjunto de permisos que posee dentro del SIGD.

Responsabilidad:
Área sobre la cual tiene una responsabilidad asignada.
```

**EJEMPLO**

```text
Usuario: Usuario A
Área: Área de ejemplo
Responsable desde: 01/08/2026
Responsable hasta: vigente
```

Si posteriormente cambia el responsable, podría ser necesario conservar el historial:

```text
Usuario A
01/01/2026 - 31/07/2026

Usuario B
01/08/2026 - vigente
```

Las fechas y usuarios anteriores son ficticios.

**PENDIENTE**

Debe confirmarse:

* Si cada área tendrá obligatoriamente un responsable.
* Si puede existir más de un responsable simultáneamente.
* Si existirán responsables principales y alternos.
* Si pueden existir responsables temporales.
* Si los cambios de responsable deben conservar historial.
* Qué debe ocurrir cuando un área queda temporalmente sin responsable.

---

### 4.7 Resumen de diferencias

| Concepto    | ¿Qué representa?                                               | ¿Es una autorización técnica? |
| ----------- | -------------------------------------------------------------- | ----------------------------- |
| Área        | Unidad de la estructura organizacional                         | No                            |
| Oficina     | Unidad organizacional cuya relación exacta debe confirmarse    | No                            |
| Cargo       | Puesto institucional de una persona                            | No                            |
| Rol         | Agrupación de permisos del sistema                             | Indirectamente                |
| Permiso     | Acción específica autorizada dentro del sistema                | Sí                            |
| Responsable | Usuario con responsabilidad sobre un área durante una vigencia | No necesariamente             |

Por lo tanto, estos conceptos deberán mantenerse separados durante el análisis y el posterior diseño del modelo de datos.


## 5. Operaciones del módulo

## 6. Jerarquía de áreas

## 7. Asignación de usuarios a áreas

## 8. Designación de responsables

## 9. Roles y permisos

## 10. Matriz funcional de roles y permisos

## 11. Flujos normales

## 12. Flujos excepcionales

## 13. Control de acceso basado en roles (RBAC)

## 14. Principio de mínimo privilegio

## 15. Decisiones y supuestos

## 16. Preguntas pendientes para el profesor

## 17. Fuentes consultadas
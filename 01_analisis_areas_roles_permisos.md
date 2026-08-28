# Análisis funcional de áreas, roles y permisos

## 1. Objetivo del módulo

**PROPUESTO**

El módulo de organización y autorización del Sistema Integral de Gestión Documentaria (SIGD) tendrá como objetivo representar de manera flexible la estructura organizacional de la institución y establecer reglas para controlar las acciones que pueden realizar los usuarios internos dentro del sistema.

El módulo deberá permitir identificar las áreas, oficinas o unidades organizacionales registradas, sus relaciones jerárquicas, los usuarios internos asignados a ellas, los responsables vigentes, los roles del sistema y los permisos asociados.

Además, el backend deberá verificar que las operaciones sensibles sean ejecutadas únicamente por usuarios autorizados. La autorización no deberá depender solamente de que una opción o botón se encuentre visible u oculto en el frontend.

Debido a que todavía no se cuenta con el organigrama oficial, el reglamento interno, el Manual de Perfil de Puestos ni la relación oficial de responsables, este análisis no establece nombres definitivos de áreas, cargos, roles o permisos. Estos elementos deberán ser validados posteriormente con el profesor y con la información institucional correspondiente.

---

## 2. Alcance

**PROPUESTO**

El análisis funcional comprenderá las necesidades relacionadas con la estructura organizacional y el control de acceso del SIGD.

Se consideran inicialmente las siguientes funciones:

* Registrar áreas, oficinas o unidades organizacionales.
* Consultar información de las unidades registradas.
* Actualizar información organizacional.
* Activar o desactivar áreas.
* Representar relaciones jerárquicas entre una unidad superior y sus unidades dependientes.
* Asignar usuarios internos a una o varias áreas, dependiendo de la regla que posteriormente confirme la institución.
* Designar responsables de áreas.
* Registrar la vigencia de asignaciones y responsabilidades cuando sea necesario conservar historial.
* Administrar conceptualmente roles y permisos.
* Determinar si un permiso tiene alcance global o limitado a un área.
* Validar en el backend si un usuario cuenta con autorización antes de ejecutar una operación.
* Considerar situaciones excepcionales como áreas inexistentes, áreas inactivas, ciclos jerárquicos, usuarios inactivos, asignaciones vencidas, responsables duplicados, roles vencidos y accesos denegados.

**PENDIENTE**

Todavía debe confirmarse con el profesor y la institución:

* El organigrama oficial.
* Los nombres y tipos oficiales de las unidades organizacionales.
* La cantidad de niveles jerárquicos existentes.
* Los cargos institucionales.
* Los nombres definitivos de los roles.
* La matriz oficial de permisos.
* Si un usuario puede pertenecer simultáneamente a varias áreas.
* Si los permisos serán globales o estarán limitados por área, tipo de documento o etapa del trámite.
* Las reglas definitivas para responsables principales, alternos o temporales.

Este análisis no incluye la creación definitiva de tablas, claves, índices, endpoints ni scripts SQL, debido a que dichas actividades serán realizadas posteriormente a partir del análisis funcional aprobado.

### 2.1 Integración funcional con la gestión de trámites

**CONFIRMADO**

El módulo organizacional y de autorización deberá integrarse conceptualmente con las operaciones de recepción, derivación, revisión y atención de trámites.

La participación en estas operaciones deberá considerar el estado del área y la autorización del usuario, de modo que áreas inactivas o usuarios sin autorización no participen en operaciones sensibles cuando las reglas aprobadas así lo determinen.

La forma técnica definitiva de esta integración dependerá de los contratos que posteriormente se acuerden entre los módulos del SIGD.

---

## 3. Actores del módulo

Debido a que los cargos, funciones y responsables oficiales todavía no han sido proporcionados, los siguientes actores se utilizan únicamente para explicar de manera preliminar el funcionamiento esperado.

### 3.1 Usuario interno

**EJEMPLO**

Persona registrada en el sistema que pertenece a la institución y que puede tener una asignación a un área o, si la institución lo autoriza, a varias áreas simultáneamente.

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

Actor utilizado de manera provisional para representar a un usuario que pudiera tener autorización para administrar elementos como áreas, asignaciones, responsables, roles o permisos.

La existencia de este actor, su denominación oficial y sus permisos reales deberán ser confirmados antes de considerarlos definitivos.

### 3.5 Sistema backend

**PROPUESTO**

El backend será responsable de comprobar las reglas de autorización antes de ejecutar operaciones protegidas.

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

---

# 4. Conceptos principales

Para evitar confusiones durante el diseño posterior de la base de datos, se diferencian los conceptos de área, oficina, cargo, rol, permiso y responsable.

Aunque algunos de ellos pueden relacionarse, no representan la misma información.

## 4.1 Área

**PROPUESTO**

Un área representa una unidad perteneciente a la estructura organizacional de la institución.

Puede contener usuarios internos y podría depender jerárquicamente de otra unidad superior.

Una característica observable de un área es que representa una parte de la organización y no una autorización técnica del sistema.

**EJEMPLO**

```text
Área Administrativa
```

Este nombre es ficticio y no representa un área oficial del instituto.

También podría existir una relación jerárquica como:

```text
Área Superior
    └── Área Dependiente
```

**PENDIENTE**

Confirmar qué áreas existen oficialmente, qué niveles jerárquicos utilizan y qué información deberá registrarse de cada una.

---

## 4.2 Oficina

**PROPUESTO**

Una oficina puede entenderse preliminarmente como una unidad organizacional dentro de la estructura institucional.

Dependiendo del organigrama oficial, podría encontrarse al mismo nivel que un área o depender de una unidad superior.

No se asumirá que todas las oficinas necesariamente dependen de un área hasta que esta estructura sea confirmada.

**EJEMPLO**

```text
Área Administrativa
    └── Oficina de Archivo
```

Este ejemplo únicamente representa una posible relación jerárquica.

**PENDIENTE**

Confirmar si existe una diferencia formal entre área, oficina, unidad, dirección u otras denominaciones institucionales.

---

## 4.3 Cargo

**PROPUESTO**

El cargo representa el puesto institucional que ocupa una persona dentro de la organización.

El cargo no debe confundirse con un rol del sistema ni con un permiso técnico.

La relación exacta entre cargo y función institucional se encuentra pendiente de confirmación.

**EJEMPLO**

```text
Usuario: Usuario A
Cargo: Jefe de Oficina
```

El nombre utilizado es ficticio.

Una diferencia conceptual es:

```text
Cargo → indica el puesto institucional de una persona.

Rol → representa una agrupación de autorizaciones dentro del sistema.
```

**PENDIENTE**

Confirmar los cargos oficiales y la diferencia institucional entre cargo y función.

---

## 4.4 Rol

**PROPUESTO**

Un rol representa una agrupación de permisos utilizada por el sistema para facilitar el control de acceso.

En lugar de asignar manualmente todas las autorizaciones a cada usuario, el sistema podría asociar determinados permisos a un rol y posteriormente asignar dicho rol a los usuarios correspondientes.

Conceptualmente:

```text
Usuario
   ↓
Rol
   ↓
Permisos
```

**EJEMPLO**

```text
Rol: Operador de trámite
```

Podría contener permisos ficticios como:

```text
tramite.ver
tramite.recibir
```

Los nombres anteriores no forman parte de una matriz institucional aprobada.

Un rol tampoco representa necesariamente el cargo laboral de una persona.

Por ejemplo:

```text
Cargo institucional: Jefe de Oficina
Rol del sistema: Operador de trámite
```

Son conceptos diferentes aunque puedan relacionarse.

**PENDIENTE**

Confirmar cuáles serán los roles oficiales y si estos tendrán alcance global o limitado a determinadas áreas.

---

## 4.5 Permiso

**PROPUESTO**

Un permiso representa una autorización concreta para ejecutar una determinada acción dentro del sistema.

Los permisos deberán ser evaluados por el backend antes de permitir operaciones sensibles.

**EJEMPLO**

```text
tramite.ver
tramite.recibir
tramite.derivar
tramite.observar
tramite.cerrar
```

Estos nombres son únicamente ejemplos técnicos.

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

Los permisos deberán seguir el principio de mínimo privilegio.

**PENDIENTE**

Confirmar qué acciones necesitan autorización y cuál será la matriz institucional de permisos.

---

## 4.6 Responsable

**PROPUESTO**

Un responsable representa a un usuario interno al que se le asigna formalmente responsabilidad sobre determinada área durante un periodo de tiempo.

La responsabilidad debe distinguirse del cargo, del rol y del permiso.

Conceptualmente una misma persona podría tener:

```text
Usuario: Usuario A

Cargo:
Puesto institucional que ocupa.

Rol:
Conjunto de permisos del sistema.

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

Si posteriormente cambia el responsable, podría conservarse historial:

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
* Si los cambios deben conservar historial.
* Qué debe ocurrir cuando un área queda sin responsable.

---

## 4.7 Resumen de diferencias

| Concepto    | ¿Qué representa?                                               | ¿Es autorización técnica? |
| ----------- | -------------------------------------------------------------- | ------------------------- |
| Área        | Unidad de la estructura organizacional                         | No                        |
| Oficina     | Unidad organizacional cuya relación exacta debe confirmarse    | No                        |
| Cargo       | Puesto institucional de una persona                            | No                        |
| Rol         | Agrupación de permisos                                         | Indirectamente            |
| Permiso     | Autorización para una acción específica                        | Sí                        |
| Responsable | Usuario con responsabilidad sobre un área durante una vigencia | No                        |

Por lo tanto, estos conceptos deberán mantenerse separados durante el análisis y durante el posterior diseño del modelo de datos.

---

# 5. Operaciones del módulo

El módulo deberá contemplar operaciones relacionadas con la administración de la estructura organizacional.

En esta etapa se describen de manera funcional y no como endpoints o implementaciones definitivas.

## 5.1 Crear un área

**PROPUESTO**

El sistema podría permitir registrar una nueva área, oficina o unidad organizacional.

Antes del registro, el backend debería validar:

* Que los datos obligatorios hayan sido proporcionados.
* Que no exista un duplicado según las reglas que posteriormente se definan.
* Que el área superior exista, si se indica una dependencia.
* Que la relación jerárquica propuesta sea válida.
* Que el usuario tenga autorización.

**Entrada conceptual:**

```text
Nombre o denominación
Tipo de unidad, si corresponde
Área superior, si corresponde
Estado inicial
```

**Resultado esperado:**

Si las validaciones son correctas, el área queda registrada.

Si alguna validación falla, la operación debe ser rechazada indicando el motivo.

**PENDIENTE**

Confirmar qué datos serán obligatorios y quién estará autorizado para crear áreas.

---

## 5.2 Consultar un área

**PROPUESTO**

El sistema podría permitir consultar información de un área registrada.

La consulta podría mostrar:

* Información general.
* Estado actual.
* Área superior.
* Áreas dependientes.
* Usuarios asignados.
* Responsable vigente.
* Información de vigencia relacionada.

**PENDIENTE**

Confirmar qué usuarios podrán consultar esta información y si existirán restricciones por área.

---

## 5.3 Actualizar un área

**PROPUESTO**

El sistema podría permitir modificar determinados datos de un área.

Antes de guardar cambios, el backend debería verificar:

* Que el área exista.
* Que el usuario tenga autorización.
* Que los nuevos datos sean válidos.
* Que un cambio de dependencia no genere un ciclo.
* Que la modificación no contradiga reglas institucionales.

**PENDIENTE**

Confirmar qué atributos podrán modificarse y cuáles deberán conservar historial.

---

## 5.4 Activar un área

**PROPUESTO**

Una unidad previamente inactiva podría volver a activarse cuando exista autorización.

El backend debería verificar:

* Que el área exista.
* Que actualmente se encuentre inactiva.
* Que el usuario tenga autorización.
* Que la relación con su unidad superior sea válida.

---

## 5.5 Desactivar un área

**PROPUESTO**

La desactivación permitirá indicar que un área ya no está disponible para determinadas operaciones sin eliminar necesariamente su información histórica.

Una posible regla sería impedir que un área inactiva:

* Reciba nuevas asignaciones.
* Reciba nuevos responsables.
* Participe en nuevas derivaciones.
* Sea utilizada como destino de determinadas operaciones.

**PENDIENTE**

Debe confirmarse qué ocurre con:

* Usuarios asignados.
* Responsable vigente.
* Trámites pendientes.
* Roles cuyo alcance depende del área.
* Áreas dependientes.

---

## 5.6 Validación de autorización

**PROPUESTO**

Antes de ejecutar una operación protegida, el backend deberá comprobar si el usuario está autorizado.

Conceptualmente:

```text
Usuario solicita operación
        ↓
Backend identifica al usuario
        ↓
Verifica estado
        ↓
Verifica asignaciones vigentes
        ↓
Verifica roles vigentes
        ↓
Verifica permisos
        ↓
Verifica alcance
        ↓
Permite o rechaza
```

Ocultar una opción en el frontend no será suficiente como medida de seguridad.

---

# 6. Jerarquía de áreas

## 6.1 Objetivo de la jerarquía

**PROPUESTO**

La estructura organizacional deberá permitir representar relaciones entre unidades superiores y dependientes.

La jerarquía deberá admitir varios niveles sin crear una estructura distinta para cada nivel institucional.

**EJEMPLO**

```text
Unidad Superior
    ├── Unidad A
    │     ├── Unidad A.1
    │     └── Unidad A.2
    └── Unidad B
          └── Unidad B.1
```

Los nombres son ficticios.

**PENDIENTE**

Confirmar:

* Cuántos niveles existen.
* Qué nombres oficiales reciben.
* Si todas las unidades deben depender de otra.
* Si pueden existir varias unidades principales.

---

## 6.2 Área superior y área dependiente

**PROPUESTO**

Una unidad podría relacionarse con otra que actúe como su superior jerárquico.

```text
Área superior
      ↓
Área dependiente
```

Una misma unidad superior podría tener varias unidades dependientes.

---

## 6.3 Cambio de dependencia

**PROPUESTO**

Una unidad podría cambiar de dependencia cuando exista una modificación en la estructura institucional.

**EJEMPLO**

Antes:

```text
Área A
    └── Área C
```

Después:

```text
Área B
    └── Área C
```

Antes de aceptar el cambio, el backend debería verificar:

* Que ambas áreas existan.
* Que la nueva relación no produzca un ciclo.
* Que los estados sean compatibles.
* Que el usuario tenga autorización.

**PENDIENTE**

Confirmar si los cambios de dependencia deben conservar historial y qué efecto tendrán sobre trámites, usuarios y responsabilidades.

---

## 6.4 Prevención de ciclos jerárquicos

**PROPUESTO**

El sistema deberá impedir relaciones circulares.

Un ciclo ocurre cuando una unidad termina dependiendo directa o indirectamente de sí misma.

**EJEMPLO**

Si existe:

```text
Área A
    ↓
Área B
    ↓
Área C
```

no debería permitirse:

```text
Área C
    ↓
Área A
```

porque se produciría:

```text
Área A → Área B → Área C → Área A
```

El backend deberá detectar este caso y rechazar la operación.

---

## 6.5 Área inactiva dentro de la jerarquía

**PROPUESTO**

Cuando una unidad quede inactiva deberá evaluarse qué ocurre con sus áreas dependientes.

**EJEMPLO**

```text
Área A
    └── Área B
          └── Área C
```

Si Área B queda inactiva, deberá definirse qué sucede con Área C.

**PENDIENTE**

Debe confirmarse si:

* Puede permanecer dependiendo de un área inactiva.
* Debe cambiar de dependencia.
* Debe impedirse la desactivación mientras existan áreas dependientes activas.

Los casos excepcionales relacionados con áreas inexistentes, áreas inactivas y ciclos se desarrollan de manera consolidada en la sección 12.

---

# 7. Asignación de usuarios a áreas

## 7.1 Objetivo de la asignación

**PROPUESTO**

El módulo deberá permitir relacionar a los usuarios internos con las áreas en las que desarrollan sus actividades, sin duplicar la información de identidad administrada por otros módulos.

Conceptualmente:

```text
Usuario interno
      ↓
Asignación
      ↓
Área
```

---

## 7.2 Relación con usuarios internos

**CONFIRMADO**

El plan del proyecto establece que la asignación de usuarios internos deberá coordinarse con el Grupo 4 y que el Grupo 3 no deberá duplicar las tablas de identidad.

Por ello, el módulo deberá trabajar conceptualmente con una referencia al usuario existente en el módulo correspondiente.

**EJEMPLO**

```text
Usuario interno: ID 25
Área asignada: Área de ejemplo
Inicio: 01/08/2026
Fin: vigente
```

Los datos son ficticios.

---

## 7.3 Asignación de un usuario

**PROPUESTO**

Antes de registrar una asignación, el backend debería verificar:

* Que el usuario exista.
* Que esté activo.
* Que el área exista.
* Que el área esté activa.
* Que las fechas sean válidas.
* Que no exista una asignación incompatible.
* Que el usuario que realiza la operación tenga autorización.

**Entrada conceptual:**

```text
Usuario
Área
Fecha de inicio
Fecha de fin, si corresponde
```

---

## 7.4 Usuario asignado a varias áreas

**PENDIENTE**

Debe confirmarse si un usuario puede pertenecer simultáneamente a varias áreas.

Posibilidad A:

```text
Usuario A
    ↓
Área 1
```

Posibilidad B:

```text
Usuario A
    ├── Área 1
    ├── Área 2
    └── Área 3
```

Esta decisión afectará el modelo de datos y sus restricciones.

---

## 7.5 Vigencia de la asignación

**PROPUESTO**

Una asignación podría registrar un periodo de vigencia para conservar trazabilidad.

**EJEMPLO**

```text
Usuario A
Área A
01/01/2026 - 31/07/2026

Usuario A
Área B
01/08/2026 - vigente
```

Esto permitiría conocer en qué área se encontraba asignado un usuario en determinada fecha.

**PENDIENTE**

Confirmar si todas las asignaciones requieren fecha de inicio y fin.

---

## 7.6 Cambio de área

**PROPUESTO**

Cuando un usuario cambie de área, la asignación anterior no debería eliminarse necesariamente si se requiere trazabilidad.

Un posible proceso sería:

```text
Finalizar asignación anterior
        ↓
Registrar nueva asignación
        ↓
Conservar historial
```

**PENDIENTE**

Confirmar qué debe ocurrir con sus permisos y trámites cuando cambia de área.

Los casos de usuario inexistente, usuario inactivo y asignación vencida se desarrollan en la sección 12.

---

# 8. Designación de responsables

## 8.1 Objetivo

**PROPUESTO**

El módulo deberá permitir identificar qué usuario interno posee responsabilidad sobre determinada área durante un periodo.

Conceptualmente:

```text
Usuario interno
      ↓
Responsabilidad
      ↓
Área
```

La responsabilidad deberá mantenerse separada del cargo, rol y permiso.

---

## 8.2 Designación de un responsable

**PROPUESTO**

Antes de realizar una designación, el backend podría verificar:

* Que el usuario exista.
* Que esté activo.
* Que el área exista.
* Que el área esté activa.
* Que la vigencia sea válida.
* Que no exista un conflicto con otra responsabilidad.
* Que quien realiza la operación tenga autorización.

**Entrada conceptual:**

```text
Usuario
Área
Fecha de inicio
Fecha de fin, si corresponde
Tipo de responsabilidad, si corresponde
```

---

## 8.3 Relación entre asignación y responsabilidad

**PROPUESTO**

Podría requerirse que un usuario esté asignado a un área antes de ser designado como responsable de ella.

**PENDIENTE**

Esta regla deberá ser confirmada institucionalmente.

---

## 8.4 Vigencia e historial

**PROPUESTO**

La responsabilidad podría registrar fecha de inicio y fecha de fin.

**EJEMPLO**

```text
Área A

Usuario A
01/01/2026 - 31/07/2026

Usuario B
01/08/2026 - vigente
```

Esto permitiría determinar quién era responsable en una fecha específica.

---

## 8.5 Cambio de responsable

**PROPUESTO**

Cuando se designe un nuevo responsable, el registro anterior podría conservarse como historial.

```text
Responsable anterior
        ↓
Finalizar vigencia
        ↓
Registrar nuevo responsable
        ↓
Conservar historial
```

**PENDIENTE**

Confirmar si el cambio requiere aprobación y quién estará autorizado para realizarlo.

---

## 8.6 Responsable principal, alterno o temporal

**PENDIENTE**

Debe confirmarse si una misma área puede tener:

* Un responsable principal.
* Más de un responsable simultáneo.
* Responsables alternos.
* Responsables temporales.
* Responsables por reemplazo.

---

## 8.7 Responsable inactivo

**PROPUESTO**

Si un usuario responsable pasa a estado inactivo, el sistema debería dejar de considerar dicha responsabilidad como vigente para las decisiones funcionales que dependan de la existencia de un responsable.

Las autorizaciones técnicas del usuario deberán continuar evaluándose mediante sus roles, permisos y demás reglas de acceso aplicables.

**PENDIENTE**

Debe confirmarse si la responsabilidad se finaliza automáticamente, si debe designarse un reemplazo o si se requiere una acción administrativa.

---

## 8.8 Área sin responsable

**PENDIENTE**

Debe definirse qué ocurre cuando un área activa no tiene responsable vigente.

Entre las preguntas se encuentran:

* ¿Puede continuar recibiendo trámites?
* ¿Puede realizar derivaciones?
* ¿Debe mostrarse una advertencia?
* ¿Deben bloquearse determinadas operaciones?
* ¿Debe existir obligatoriamente un responsable antes de activar el área?

Los casos de responsable duplicado y vigencias conflictivas se desarrollan en la sección 12.

---

# 9. Roles y permisos

## 9.1 Objetivo del control de acceso

**PROPUESTO**

El módulo deberá controlar qué acciones puede realizar cada usuario mediante roles y permisos.

Conceptualmente:

```text
Usuario
   ↓
Rol
   ↓
Permisos
   ↓
Operación permitida o denegada
```

---

## 9.2 Rol del sistema

**PROPUESTO**

Un rol representa una agrupación de permisos que puede asignarse a uno o varios usuarios.

**EJEMPLO**

```text
Rol: Rol A

Permisos:
- tramite.ver
- tramite.recibir
- tramite.derivar
```

Los nombres son ficticios.

**PENDIENTE**

Confirmar:

* Roles oficiales.
* Quién puede crearlos.
* Quién puede modificarlos.
* Quién puede asignarlos.
* Si tendrán vigencia.
* Si un usuario podrá tener varios roles.

---

## 9.3 Permiso del sistema

**PROPUESTO**

Un permiso representa autorización para ejecutar una acción específica.

**EJEMPLO**

```text
tramite.ver
tramite.recibir
tramite.adjuntar
tramite.derivar
tramite.observar
tramite.atender
tramite.cerrar
```

Estos identificadores son únicamente ejemplos.

---

## 9.4 Relación entre roles y permisos

**PROPUESTO**

Un rol podría contener varios permisos y un mismo permiso podría relacionarse con distintos roles.

```text
Rol A
    ├── Permiso 1
    ├── Permiso 2
    └── Permiso 3

Rol B
    ├── Permiso 1
    └── Permiso 4
```

La implementación técnica de esta relación corresponderá al modelo de datos.

---

## 9.5 Asignación de roles

**PROPUESTO**

Antes de asignar un rol, el backend debería verificar:

* Que el usuario exista y esté activo.
* Que el rol exista.
* Que el rol esté activo, si maneja estado.
* Que la asignación sea válida.
* Que no exista un duplicado incompatible.
* Que quien realiza la asignación tenga autorización.

**PENDIENTE**

Confirmar:

* Si un usuario puede tener varios roles.
* Si los roles tendrán vigencia.
* Si pueden limitarse por área.
* Si existen roles incompatibles.

---

## 9.6 Vigencia

**PROPUESTO**

Una asignación de rol podría incluir un periodo de vigencia.

**EJEMPLO**

```text
Usuario A
Rol A

Desde: 01/08/2026
Hasta: 31/08/2026
```

Al finalizar la vigencia, los permisos procedentes de esa asignación no deberían utilizarse para autorizar nuevas operaciones.

---

## 9.7 Alcance global

**PROPUESTO**

Algunos permisos podrían tener alcance global.

**EJEMPLO**

```text
Permiso:
tramite.ver

Alcance:
GLOBAL
```

La existencia de este tipo de permisos deberá ser validada.

---

## 9.8 Alcance limitado a un área

**PROPUESTO**

Otros permisos podrían estar limitados a determinada área.

**EJEMPLO**

```text
Usuario A

Permiso:
tramite.ver

Alcance:
Área B
```

En ese caso el usuario no necesariamente estaría autorizado para consultar información de otras áreas.

**PENDIENTE**

Confirmar si el alcance podrá depender de:

* Área.
* Tipo de documento.
* Etapa del trámite.
* Unidad organizacional.
* Otros criterios.

---

## 9.9 Verificación de permisos

**PROPUESTO**

El backend deberá evaluar tanto la existencia del permiso como su alcance.

Conceptualmente:

```text
Usuario solicita operación
        ↓
Verificar identidad
        ↓
Verificar estado
        ↓
Obtener roles vigentes
        ↓
Obtener permisos
        ↓
Verificar alcance
        ↓
Permitir o rechazar
```

Los casos de rol duplicado, rol vencido, permiso insuficiente y alcance incorrecto se desarrollan en la sección 12.

---

# 10. Matriz funcional de roles y permisos

## 10.1 Objetivo

**PROPUESTO**

La matriz funcional permite visualizar qué acciones podrían asociarse a determinados roles.

La siguiente matriz es únicamente demostrativa y no representa decisiones oficiales.

## 10.2 Matriz de ejemplo

**EJEMPLO — PENDIENTE DE VALIDACIÓN INSTITUCIONAL**

| Acción                   | Rol de consulta | Rol operativo | Rol de administración |
| ------------------------ | --------------: | ------------: | --------------------: |
| Consultar trámite        |              Sí |            Sí |                    Sí |
| Recibir trámite          |              No |            Sí |                    Sí |
| Adjuntar información     |              No |            Sí |                    Sí |
| Derivar trámite          |              No |            Sí |                    Sí |
| Observar trámite         |              No |            Sí |                    Sí |
| Atender trámite          |              No |            Sí |                    Sí |
| Cerrar trámite           |              No |     Pendiente |                    Sí |
| Crear áreas              |              No |            No |                    Sí |
| Actualizar áreas         |              No |            No |                    Sí |
| Activar/desactivar áreas |              No |            No |                    Sí |
| Asignar usuarios a áreas |              No |            No |                    Sí |
| Designar responsables    |              No |            No |                    Sí |
| Asignar roles            |              No |            No |                    Sí |
| Administrar permisos     |              No |            No |             Pendiente |

Los nombres de los roles y las autorizaciones de la matriz son ficticios.

---

## 10.3 Interpretación

**EJEMPLO**

* El Rol de consulta tendría únicamente operaciones de lectura.
* El Rol operativo podría participar en determinadas etapas del trámite.
* El Rol de administración podría gestionar elementos organizacionales y de autorización.

Esto no implica que dichos roles existan realmente.

---

## 10.4 Denegación por defecto

**PROPUESTO**

Si una acción no se encuentra expresamente autorizada, no deberá asumirse que está permitida.

```text
Permiso confirmado
        ↓
Puede continuar la evaluación
```

Mientras que:

```text
Permiso no confirmado
        ↓
No conceder por defecto
```

---

## 10.5 Alcance por área

**PROPUESTO**

Cuando un permiso dependa de un área, no será suficiente comprobar solamente que el permiso exista.

```text
¿Tiene permiso?
       ↓
      Sí
       ↓
¿Aplica al área?
    ↙      ↘
   Sí       No
   ↓         ↓
Permitir   Denegar
```

**PENDIENTE**

Confirmar si el control por área será requerido.

---

# 11. Flujos normales

Los siguientes flujos describen de manera funcional algunas operaciones del módulo.

No representan endpoints definitivos.

## 11.1 Registrar un área

**Entrada:**

```text
Datos del área
Área superior, si corresponde
Estado inicial
Usuario que realiza la operación
```

**Validaciones:**

1. Usuario autenticado.
2. Usuario autorizado.
3. Datos obligatorios completos.
4. Área superior válida, cuando corresponda.
5. Jerarquía válida.
6. Ausencia de duplicados incompatibles.

**Resultado:**

```text
Área registrada correctamente.
```

**PENDIENTE**

Confirmar qué actor puede registrar áreas.

---

## 11.2 Consultar un área

**Entrada:**

```text
Identificador del área
Usuario
```

**Validaciones:**

1. Usuario autenticado.
2. Área existente.
3. Permiso de consulta.
4. Alcance válido, si corresponde.

**Resultado:**

Mostrar únicamente la información autorizada.

---

## 11.3 Actualizar un área

**Entrada:**

```text
Área
Datos nuevos
Usuario
```

**Validaciones:**

1. Área existente.
2. Usuario autorizado.
3. Datos válidos.
4. Ausencia de ciclos si cambia la dependencia.
5. Cumplimiento de reglas institucionales.

**Resultado:**

```text
Área actualizada.
```

---

## 11.4 Asignar un usuario a un área

**Entrada:**

```text
Usuario
Área
Fecha de inicio
Fecha de fin, si corresponde
```

**Validaciones:**

1. Usuario existente.
2. Usuario activo.
3. Área existente.
4. Área activa.
5. Fechas válidas.
6. Ausencia de conflictos.
7. Operador autorizado.

**Resultado:**

```text
Asignación registrada.
```

---

## 11.5 Designar un responsable

**Entrada:**

```text
Usuario
Área
Fecha de inicio
Fecha de fin, si corresponde
```

**Validaciones:**

1. Área existente y activa.
2. Usuario existente y activo.
3. Vigencia válida.
4. Ausencia de conflicto con otro responsable.
5. Operador autorizado.

**Resultado:**

```text
Responsabilidad registrada.
```

Cuando corresponda:

```text
Finalizar responsabilidad anterior
        ↓
Registrar nueva
        ↓
Conservar historial
```

---

## 11.6 Asignar un rol

**Entrada:**

```text
Usuario
Rol
Área, si corresponde
Vigencia, si corresponde
```

**Validaciones:**

1. Usuario existente y activo.
2. Rol existente.
3. Asignación válida.
4. Ausencia de duplicados incompatibles.
5. Área válida, si existe alcance.
6. Operador autorizado.

**Resultado:**

```text
Rol asignado.
```

---

## 11.7 Verificar autorización

**Entrada:**

```text
Usuario autenticado
Acción solicitada
Recurso
Área, si corresponde
```

**Flujo:**

```text
Usuario solicita operación
        ↓
Identificar usuario
        ↓
Verificar estado
        ↓
Verificar asignaciones vigentes
        ↓
Obtener roles vigentes
        ↓
Obtener permisos
        ↓
Verificar alcance
        ↓
¿Está autorizado?
      ↙        ↘
    Sí          No
    ↓            ↓
Ejecutar       Rechazar
```

---

## 11.8 Desactivar un área

**Entrada:**

```text
Área
Usuario
```

**Validaciones:**

1. Área existente.
2. Área actualmente activa.
3. Usuario autorizado.
4. Revisar áreas dependientes.
5. Revisar trámites pendientes.
6. Revisar responsabilidades y asignaciones vigentes.

**Resultado:**

El área cambia a estado inactivo cuando las reglas institucionales lo permitan.

---

# 12. Flujos excepcionales

Los siguientes casos representan situaciones que el backend deberá detectar para evitar inconsistencias o accesos no autorizados.

## 12.1 Área inexistente

**EJEMPLO**

```text
Solicitud:
Operar sobre Área 999

Validación:
Área 999 no existe

Resultado:
Operación rechazada.
```

---

## 12.2 Área inactiva

**EJEMPLO**

```text
Área A
Estado: INACTIVA

Solicitud:
Asignar Usuario B
```

**Resultado:**

```text
Operación rechazada.
```

**PENDIENTE**

Confirmar qué operaciones estarán prohibidas sobre áreas inactivas.

---

## 12.3 Ciclo jerárquico

**EJEMPLO**

Situación existente:

```text
Área A
   ↓
Área B
   ↓
Área C
```

Solicitud:

```text
Hacer que Área A dependa de Área C.
```

Resultado que se produciría:

```text
Área A → Área B → Área C → Área A
```

El backend deberá rechazar la operación.

---

## 12.4 Usuario inexistente

**EJEMPLO**

```text
Usuario 999
Área A
```

Si el usuario no existe en el módulo correspondiente:

```text
Asignación rechazada.
```

El módulo organizacional no deberá crear un usuario nuevo para resolver esta situación.

---

## 12.5 Usuario inactivo

**EJEMPLO**

```text
Usuario A
Estado: INACTIVO

Solicitud:
Asignar nuevo rol
```

**Resultado:**

```text
Operación rechazada.
```

**PENDIENTE**

Confirmar qué ocurre con roles y asignaciones ya existentes.

---

## 12.6 Asignación vencida

**EJEMPLO**

```text
Usuario A → Área B

Vigencia:
01/01/2026 - 31/07/2026

Fecha de operación:
27/08/2026
```

**Resultado:**

```text
La asignación no se considera vigente.
```

---

## 12.7 Responsable duplicado

**PROPUESTO**

Si la institución establece que solo puede existir un responsable principal vigente por área:

```text
Área A
Responsable vigente: Usuario A
```

y se intenta registrar:

```text
Área A
Responsable vigente: Usuario B
```

el sistema deberá detectar el conflicto.

**Resultado:**

```text
Operación rechazada por conflicto de vigencia.
```

**PENDIENTE**

Confirmar si existe esta restricción.

---

## 12.8 Rol duplicado

**EJEMPLO**

```text
Usuario A
Rol A
Estado: vigente
```

Si se intenta registrar exactamente la misma asignación sin diferencia de vigencia o alcance:

```text
Operación rechazada como duplicada.
```

---

## 12.9 Rol vencido

**EJEMPLO**

```text
Usuario A
Rol A

Vigencia:
01/07/2026 - 31/07/2026

Fecha de operación:
27/08/2026
```

**Resultado:**

```text
El rol no autoriza la operación.
```

---

## 12.10 Permiso insuficiente

**EJEMPLO**

```text
Usuario A

Permiso:
tramite.ver

Operación solicitada:
tramite.cerrar
```

**Resultado:**

```text
ACCESO DENEGADO
```

---

## 12.11 Permiso correcto con alcance incorrecto

**EJEMPLO**

```text
Usuario A

Permiso:
tramite.derivar

Alcance:
Área A
```

El usuario intenta operar sobre Área B.

**Resultado:**

```text
ACCESO DENEGADO
```

Esto demuestra que no siempre es suficiente comprobar solamente el permiso.

---

## 12.12 Área superior inactiva

**EJEMPLO**

```text
Área A
Estado: INACTIVA

Área B
Depende de Área A
Estado: ACTIVA
```

**PENDIENTE**

Debe confirmarse si:

* Esta situación puede mantenerse.
* Área B debe cambiar de dependencia.
* Debe impedirse desactivar Área A mientras tenga dependientes activos.

---

## 12.13 Área sin responsable

**EJEMPLO**

```text
Área A
Estado: ACTIVA
Responsable vigente: ninguno
```

**PENDIENTE**

Confirmar si:

* Puede continuar recibiendo trámites.
* Puede derivar documentos.
* Debe mostrarse una advertencia.
* Deben bloquearse determinadas operaciones.

---

## 12.14 Intento de saltar el frontend

**PROPUESTO**

Ocultar una opción en el frontend no es suficiente para impedir una operación.

**EJEMPLO**

```text
Frontend:
Botón "Cerrar trámite" oculto

Usuario:
Intenta llamar directamente al backend

Backend:
Verifica permisos
        ↓
Usuario no autorizado
        ↓
Operación rechazada
```

---

## 12.15 Criterio general

Una operación sensible deberá evaluar:

```text
Entrada
   ↓
Existencia
   ↓
Estados
   ↓
Vigencias
   ↓
Relaciones
   ↓
Autorización
   ↓
¿Todo es válido?
 ↙           ↘
Sí            No
↓              ↓
Ejecutar     Rechazar
```

---

# 13. Control de acceso basado en roles (RBAC)

## 13.1 Definición

**PROPUESTO — BASADO EN INVESTIGACIÓN**

RBAC, por sus siglas en inglés *Role-Based Access Control*, es un modelo de control de acceso en el que las autorizaciones se organizan mediante roles.

En lugar de asignar directamente cada permiso a cada usuario, los permisos se asocian a roles y posteriormente los usuarios reciben los roles que les correspondan.

```text
Usuario
   ↓
Rol
   ↓
Permisos
   ↓
Acciones autorizadas
```

---

## 13.2 Aplicación conceptual al SIGD

**PROPUESTO**

RBAC podría utilizarse para controlar acciones relacionadas con:

* Consulta.
* Recepción.
* Adjuntos.
* Derivación.
* Observación.
* Atención.
* Cierre.
* Administración de áreas.
* Responsables.
* Roles.
* Permisos.

Todas estas acciones deberán validarse institucionalmente.

---

## 13.3 Beneficio administrativo

**PROPUESTO — BASADO EN INVESTIGACIÓN**

Los roles permiten administrar grupos de permisos en lugar de configurar cada permiso individualmente para cada usuario.

Por ejemplo:

```text
Usuario A
   ↓
Rol operativo
   ↓
Conjunto de permisos
```

Si otro usuario requiere las mismas autorizaciones, podría recibir el mismo rol.

---

## 13.4 RBAC no reemplaza las demás validaciones

**PROPUESTO**

Tener un rol no será necesariamente suficiente para ejecutar una operación.

También podrían evaluarse:

* Estado del usuario.
* Estado del área.
* Vigencia de la asignación.
* Vigencia del rol.
* Alcance del permiso.
* Área relacionada.
* Estado del trámite.
* Otras reglas institucionales.

---

## 13.5 Verificación en backend

**PROPUESTO — BASADO EN INVESTIGACIÓN**

El frontend puede ocultar botones para mejorar la experiencia del usuario, pero la decisión de autorización deberá realizarse en el backend.

```text
Solicitud llega al backend
        ↓
Backend verifica autorización
        ↓
Permite o rechaza
```

---

# 14. Principio de mínimo privilegio

## 14.1 Definición

**PROPUESTO — BASADO EN INVESTIGACIÓN**

El principio de mínimo privilegio establece que un usuario, proceso o componente debe recibir únicamente los permisos y recursos mínimos necesarios para realizar sus funciones.

Aplicado al SIGD, un usuario no debería recibir permisos adicionales simplemente por comodidad.

---

## 14.2 Ejemplo

**EJEMPLO**

Si un usuario únicamente necesita consultar:

```text
Necesario:
tramite.ver
```

no debería recibir automáticamente:

```text
tramite.derivar
tramite.cerrar
administrar_areas
administrar_roles
administrar_permisos
```

---

## 14.3 Denegación por defecto

**PROPUESTO — BASADO EN INVESTIGACIÓN**

Una acción que no se encuentre autorizada deberá considerarse denegada por defecto.

```text
¿Existe autorización válida?
        ↓
       Sí
        ↓
Continuar evaluación
```

Si no existe:

```text
ACCESO DENEGADO
```

No deberá utilizarse el criterio:

```text
"No sabemos si puede hacerlo,
por lo tanto lo permitimos."
```

---

## 14.4 Relación entre RBAC y mínimo privilegio

RBAC y mínimo privilegio son conceptos relacionados, pero diferentes.

```text
RBAC
↓
Organiza permisos mediante roles
```

Mientras que:

```text
Mínimo privilegio
↓
Busca conceder solamente
los permisos necesarios
```

Un sistema podría utilizar roles y aun así otorgar privilegios excesivos si los roles contienen más permisos de los necesarios.

---

# 15. Decisiones y supuestos

## 15.1 Elementos confirmados

**CONFIRMADO**

Según el plan de trabajo del Grupo 3:

* El módulo debe representar áreas o unidades organizacionales.
* Debe contemplarse una jerarquía flexible.
* Área, cargo, rol, permiso y responsabilidad son conceptos distintos.
* El Grupo 3 no deberá duplicar las tablas de identidad.
* La integración con usuarios internos deberá coordinarse con el Grupo 4.
* Deben analizarse responsables y vigencias.
* Debe contemplarse un esquema de roles y permisos.
* La autorización deberá verificarse en el backend.
* Ocultar botones en el frontend no constituye seguridad suficiente.
* Los permisos deberán seguir el principio de mínimo privilegio.
* Los ejemplos no deberán presentarse como información oficial.
* El organigrama y otras reglas institucionales se encuentran pendientes.

---

## 15.2 Propuestas técnicas

**PROPUESTO**

Durante este análisis se plantearon:

* Conservar historial cuando sea necesario.
* Evaluar vigencias.
* Impedir ciclos jerárquicos.
* Evitar duplicados incompatibles.
* Validar entidades antes de relacionarlas.
* Rechazar operaciones sobre registros inexistentes.
* Utilizar roles como agrupaciones de permisos.
* Evaluar alcance por área cuando corresponda.
* Denegar por defecto las acciones no autorizadas.
* Realizar la autorización en el backend.

---

## 15.3 Ejemplos utilizados

**EJEMPLO**

Durante el documento se utilizaron nombres ficticios como:

```text
Área A
Área B
Área Administrativa
Oficina de Archivo
Usuario A
Usuario B
Rol operativo
Rol de consulta
Rol de administración
```

También permisos ficticios como:

```text
tramite.ver
tramite.recibir
tramite.derivar
tramite.cerrar
```

Ninguno representa información oficial.

---

## 15.4 Información pendiente

**PENDIENTE**

Todavía no pueden definirse definitivamente:

* Organigrama.
* Áreas.
* Oficinas.
* Niveles jerárquicos.
* Cargos.
* Funciones.
* Roles.
* Permisos.
* Responsables.
* Reglas de vigencia.
* Alcance de permisos.
* Responsables principales, alternos o temporales.

---

# 16. Preguntas pendientes para el profesor

## 16.1 Estructura organizacional

1. ¿Cuál es el organigrama oficial?
2. ¿Qué áreas, oficinas o unidades deben registrarse?
3. ¿Cuántos niveles jerárquicos existen?
4. ¿Qué denominaciones oficiales se utilizan?
5. ¿Puede existir una unidad sin superior?
6. ¿Qué ocurre cuando un área cambia de dependencia?
7. ¿Debe conservarse historial de esos cambios?

---

## 16.2 Usuarios y áreas

8. ¿Un usuario puede pertenecer a varias áreas simultáneamente?
9. ¿Las asignaciones tendrán fecha de inicio y fin?
10. ¿Debe conservarse historial cuando un usuario cambia de área?
11. ¿Qué ocurre con sus trámites y permisos cuando cambia?
12. ¿Qué ocurre cuando un usuario queda inactivo?

---

## 16.3 Cargos y responsabilidades

13. ¿Qué diferencia institucional existe entre cargo, función, responsable y rol?
14. ¿Cada área debe tener un responsable?
15. ¿Puede existir más de un responsable simultáneo?
16. ¿Existirán responsables principales y alternos?
17. ¿Puede existir un responsable temporal?
18. ¿El responsable debe pertenecer al área?
19. ¿Debe conservarse historial?
20. ¿Qué ocurre cuando el responsable queda inactivo?
21. ¿Qué ocurre cuando un área queda sin responsable?

---

## 16.4 Roles y permisos

22. ¿Cuáles serán los roles oficiales?
23. ¿Un usuario puede poseer varios roles?
24. ¿Los roles tendrán vigencia?
25. ¿Los roles serán globales o estarán asociados a un área?
26. ¿Qué permisos concretos existen para recibir, adjuntar, derivar, observar, firmar, atender y cerrar?
27. ¿Quién puede crear áreas?
28. ¿Quién puede modificarlas?
29. ¿Quién puede activarlas o desactivarlas?
30. ¿Quién puede asignar usuarios?
31. ¿Quién puede designar responsables?
32. ¿Quién puede crear o modificar roles?
33. ¿Quién puede asignar roles?
34. ¿Quién puede aprobar o modificar permisos?

---

## 16.5 Alcance de permisos

35. ¿Los permisos pueden tener alcance global?
36. ¿Pueden limitarse por área?
37. ¿Pueden limitarse por tipo de documento?
38. ¿Pueden limitarse por etapa del trámite?
39. ¿Existe herencia de permisos entre áreas o roles?
40. Si existe herencia, ¿cómo se evitarán privilegios excesivos?

---

## 16.6 Áreas inactivas y trámites

41. ¿Qué ocurre con trámites pendientes cuando un área queda inactiva?
42. ¿Un área inactiva puede tener áreas dependientes activas?
43. ¿Puede recibir nuevas derivaciones?
44. ¿Qué ocurre con sus responsables vigentes?
45. ¿Qué ocurre con sus usuarios asignados?

Las respuestas deberán registrarse posteriormente como **CONFIRMADO** cuando hayan sido aprobadas.

---

# 17. Fuentes consultadas

Las siguientes fuentes se utilizan únicamente para comprender los conceptos técnicos de RBAC, autorización y mínimo privilegio.

No definen la estructura institucional ni los roles oficiales.

## 17.1 National Institute of Standards and Technology (NIST)

**Fuente:** *Role-Based Access Control (RBAC): Features and Motivations*.

**Autores:** David F. Ferraiolo, Janet A. Cugini y David R. Kuhn.

**Uso:**

Referencia para comprender la relación entre usuarios, roles y permisos dentro de un modelo RBAC.

**Consulta:** agosto de 2026.

---

## 17.2 NIST Computer Security Resource Center

**Fuente:** *Role-Based Access Control (RBAC) — CSRC Glossary*.

**Uso:**

Referencia complementaria para la definición de RBAC y la organización de autorizaciones mediante roles.

**Consulta:** agosto de 2026.

---

## 17.3 NIST Computer Security Resource Center

**Fuente:** *Least Privilege — CSRC Glossary*.

**Uso:**

Referencia para comprender el principio de mínimo privilegio, según el cual una entidad debe poseer solamente las autorizaciones mínimas necesarias.

**Consulta:** agosto de 2026.

---

## 17.4 OWASP Foundation

**Fuente:** *Authorization Cheat Sheet — OWASP Cheat Sheet Series*.

**Uso:**

Referencia complementaria para:

* Aplicar mínimo privilegio.
* Denegar accesos por defecto.
* Comprobar permisos durante las solicitudes.
* No depender solamente de controles del frontend.

**Consulta:** agosto de 2026.

---

## 17.5 Documento interno del proyecto

**Fuente:** *SIGD | Plan de trabajo backend Grupo 3 · OrganiCore*.

**Fecha:** 27 de agosto de 2026.

**Uso:**

Fuente principal para:

* Definir el alcance del trabajo de Leonardo.
* Identificar conceptos organizacionales.
* Preparar flujos normales y excepcionales.
* Identificar decisiones pendientes.
* Diferenciar área, cargo, rol, permiso y responsable.
* Preparar preguntas para el profesor.

---

# 18. Conclusión del análisis funcional

El análisis realizado establece una base funcional preliminar para que posteriormente pueda diseñarse el modelo de datos del módulo organizacional y de autorización del SIGD.

Se identificaron los principales conceptos relacionados con áreas, jerarquías, usuarios internos, responsables, roles, permisos y vigencias.

También se documentaron operaciones normales, situaciones excepcionales y reglas preliminares de autorización.

El análisis mantiene separadas las decisiones confirmadas, las propuestas técnicas, los ejemplos ficticios y la información pendiente.

De esta manera, el diseño podrá adaptarse cuando el profesor o la institución proporcionen el organigrama y las reglas oficiales sin presentar supuestos como información definitiva.

El siguiente paso del flujo de trabajo será someter este análisis a revisión del sublíder del grupo.

Si existen observaciones, deberán ser corregidas primero por el autor en la rama `B_LEONARDO`, mediante nuevos commits, antes de que la versión aprobada sea integrada en `B_POOL`.
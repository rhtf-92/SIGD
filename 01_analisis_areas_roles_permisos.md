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

El módulo deberá contemplar operaciones relacionadas con la administración de la estructura organizacional. En esta etapa se describen de manera funcional y no como endpoints o implementaciones definitivas.

### 5.1 Crear un área

**PROPUESTO**

El sistema podría permitir registrar una nueva área, oficina o unidad organizacional.

Antes de realizar el registro, el backend debería validar como mínimo:

* Que los datos obligatorios hayan sido proporcionados.
* Que no exista un registro duplicado según las reglas que posteriormente se definan.
* Que el área superior exista, si se está indicando una dependencia jerárquica.
* Que el área superior se encuentre activa, cuando dicha condición sea necesaria.
* Que la relación jerárquica propuesta sea válida.

**Entrada conceptual:**

```text
Nombre o denominación
Tipo de unidad, si corresponde
Área superior, si corresponde
Estado inicial
```

**Resultado esperado:**

Si las validaciones son correctas, el área queda registrada.

Si alguna validación falla, la operación debe ser rechazada y el sistema debe informar el motivo.

**PENDIENTE**

Confirmar qué datos serán obligatorios y quiénes estarán autorizados para crear áreas.

---

### 5.2 Consultar un área

**PROPUESTO**

El sistema podría permitir consultar información de un área registrada.

La consulta podría mostrar, dependiendo del diseño aprobado:

* Información general del área.
* Estado actual.
* Área superior.
* Áreas dependientes.
* Usuarios asignados.
* Responsable vigente.
* Información de vigencia relacionada.

La información específica dependerá del modelo de datos posteriormente aprobado.

**PENDIENTE**

Confirmar qué usuarios podrán consultar información organizacional y si existirán restricciones según el área.

---

### 5.3 Actualizar un área

**PROPUESTO**

El sistema podría permitir modificar determinados datos de un área existente.

Antes de guardar cambios, el backend deberá comprobar:

* Que el área exista.
* Que el usuario tenga autorización para modificarla.
* Que los nuevos datos sean válidos.
* Que un cambio de dependencia no produzca un ciclo jerárquico.
* Que el cambio no contradiga otras reglas institucionales vigentes.

Los cambios que puedan afectar la estructura organizacional deberán ser tratados con especial cuidado.

**PENDIENTE**

Confirmar qué atributos podrán modificarse y cuáles deberán conservar historial.

---

### 5.4 Activar un área

**PROPUESTO**

Una unidad previamente inactiva podría volver a activarse cuando exista autorización para ello.

El backend debería verificar:

* Que el área exista.
* Que actualmente se encuentre inactiva.
* Que el usuario que realiza la operación tenga autorización.
* Que su área superior, si corresponde, permita una relación organizacional válida.

**Resultado esperado:**

El área vuelve a estar disponible para las operaciones permitidas por las reglas institucionales.

---

### 5.5 Desactivar un área

**PROPUESTO**

La desactivación permitirá indicar que un área ya no se encuentra disponible para determinadas operaciones sin necesariamente eliminar su información histórica.

Una posible regla sería impedir que un área inactiva:

* Reciba nuevas asignaciones de usuarios.
* Reciba nuevos responsables.
* Participe en nuevas derivaciones de trámites.
* Sea utilizada como destino de determinadas operaciones.

Sin embargo, la información histórica debería mantenerse cuando sea necesaria para la trazabilidad.

**PENDIENTE**

Debe confirmarse qué debe ocurrir con:

* Los usuarios que continúan asignados al área.
* El responsable vigente.
* Los trámites pendientes.
* Los roles con alcance limitado a esa área.
* Las áreas dependientes de una unidad que queda inactiva.

---

### 5.6 Validación de autorización

**PROPUESTO**

Antes de ejecutar una operación protegida, el backend deberá verificar si el usuario está autorizado.

El flujo conceptual sería:

```text
Usuario solicita una operación
        ↓
Backend identifica al usuario
        ↓
Verifica estado del usuario
        ↓
Verifica asignaciones vigentes
        ↓
Verifica roles vigentes
        ↓
Verifica permisos
        ↓
Verifica alcance del permiso
        ↓
Permite o rechaza la operación
```

Ocultar una opción en el frontend no será suficiente para garantizar la seguridad. La autorización deberá comprobarse en el backend.

---

### 5.7 Acceso denegado

**PROPUESTO**

Si un usuario intenta realizar una acción sin contar con autorización, el sistema deberá rechazar la operación.

**EJEMPLO**

```text
Usuario A
    ↓
intenta cerrar un trámite
    ↓
no posee permiso para cerrar trámites
    ↓
operación rechazada
```

El sistema no deberá conceder permisos por defecto cuando una acción no haya sido autorizada.

---

## 6. Jerarquía de áreas

### 6.1 Objetivo de la jerarquía

**PROPUESTO**

La estructura organizacional deberá permitir representar relaciones entre unidades superiores y unidades dependientes.

La jerarquía deberá ser flexible para admitir varios niveles sin crear una estructura distinta para cada nivel institucional.

**EJEMPLO**

```text
Unidad Superior
    ├── Unidad A
    │     ├── Unidad A.1
    │     └── Unidad A.2
    │
    └── Unidad B
          └── Unidad B.1
```

Los nombres anteriores son ficticios y únicamente representan una posible estructura jerárquica.

**PENDIENTE**

Confirmar:

* Cuántos niveles organizacionales existen.
* Qué nombres oficiales reciben estos niveles.
* Si todas las unidades deben depender de otra unidad.
* Si pueden existir varias unidades principales sin dependencia superior.

---

### 6.2 Área superior y área dependiente

**PROPUESTO**

Una unidad podría tener una relación con otra unidad que actúe como su superior jerárquico.

Conceptualmente:

```text
Área superior
      ↓
Área dependiente
```

Una misma área superior podría tener varias áreas dependientes.

**EJEMPLO**

```text
Área A
    ├── Área B
    ├── Área C
    └── Área D
```

La relación anterior es solo ilustrativa.

---

### 6.3 Cambio de dependencia

**PROPUESTO**

Una unidad podría cambiar de dependencia jerárquica cuando exista una modificación en la estructura organizacional.

**EJEMPLO**

Situación inicial:

```text
Área A
    └── Área C
```

Después de un cambio:

```text
Área B
    └── Área C
```

En este caso, Área C deja de depender de Área A y pasa a depender de Área B.

Antes de realizar este cambio, el backend debería verificar:

* Que el área exista.
* Que la nueva área superior exista.
* Que la nueva relación no produzca un ciclo.
* Que las áreas involucradas tengan un estado compatible con la operación.
* Que el usuario tenga autorización.

**PENDIENTE**

Confirmar si los cambios de dependencia deben conservar historial y qué efecto tendrán sobre trámites, usuarios y responsabilidades anteriores.

---

### 6.4 Prevención de ciclos jerárquicos

**PROPUESTO**

El sistema deberá impedir relaciones circulares entre áreas.

Un ciclo ocurre cuando una unidad termina dependiendo directa o indirectamente de sí misma.

**EJEMPLO**

Supongamos que existe:

```text
Área A
    ↓
Área B
    ↓
Área C
```

No debería permitirse configurar:

```text
Área C
    ↓
Área A
```

porque el resultado sería:

```text
Área A → Área B → Área C → Área A
```

La estructura quedaría en un ciclo infinito y dejaría de representar correctamente una jerarquía.

Por lo tanto, antes de aceptar un cambio de dependencia deberá comprobarse que la nueva relación no convierta a un descendiente en superior de uno de sus propios antecesores.

---

### 6.5 Área inactiva dentro de la jerarquía

**PROPUESTO**

Cuando un área quede inactiva, el sistema deberá evaluar qué ocurre con sus relaciones jerárquicas.

**EJEMPLO**

```text
Área A
    └── Área B
          └── Área C
```

Si Área B queda inactiva, debe definirse qué sucederá con Área C.

Algunas posibles decisiones que deberán validarse son:

* Mantener Área C dependiendo de Área B aunque esta se encuentre inactiva.
* Cambiar Área C a otra unidad superior.
* Impedir la desactivación de Área B mientras tenga áreas activas dependientes.

Estas alternativas son solamente posibilidades técnicas y no deben considerarse reglas oficiales.

**PENDIENTE**

Confirmar con el profesor y la institución qué comportamiento debe adoptarse cuando una unidad que tiene áreas dependientes queda inactiva.

---

### 6.6 Caso excepcional: área inexistente

**PROPUESTO**

Toda operación que haga referencia a un área deberá verificar previamente que esta exista.

**EJEMPLO**

```text
Solicitud:
Asignar usuario al Área 500

Validación:
Área 500 no existe

Resultado:
Operación rechazada
```

Esto evita registrar relaciones con unidades inexistentes o información inconsistente.

## 7. Asignación de usuarios a áreas

### 7.1 Objetivo de la asignación

**PROPUESTO**

El módulo deberá permitir relacionar a los usuarios internos con las áreas en las que desarrollan actividades, sin duplicar la información de identidad administrada por otros módulos del SIGD.

La asignación deberá indicar qué usuario pertenece a qué área y, cuando sea necesario, durante qué periodo dicha relación se encuentra vigente.

Conceptualmente:

```text
Usuario interno
      ↓
Asignación
      ↓
Área
```

La información personal y de autenticación del usuario no deberá duplicarse dentro del módulo organizacional.

---

### 7.2 Relación con usuarios internos

**CONFIRMADO**

El plan del proyecto establece que la asignación de usuarios internos deberá coordinarse con el Grupo 4 y que el Grupo 3 no deberá duplicar las tablas de identidad.

Por ello, este módulo deberá trabajar conceptualmente con una referencia al usuario existente en el módulo correspondiente.

**EJEMPLO**

```text
Usuario interno: ID 25
Área asignada: Área de ejemplo
Inicio de vigencia: 01/08/2026
Fin de vigencia: vigente
```

Los datos anteriores son ficticios.

---

### 7.3 Asignación de un usuario a un área

**PROPUESTO**

Antes de registrar una asignación, el backend debería verificar:

* Que el usuario exista.
* Que el usuario se encuentre activo.
* Que el área exista.
* Que el área se encuentre activa.
* Que la fecha de inicio sea válida.
* Que no exista una asignación incompatible con las reglas institucionales.
* Que el usuario que realiza la operación tenga autorización.

**Entrada conceptual:**

```text
Usuario
Área
Fecha de inicio
Fecha de fin, si corresponde
```

**Resultado esperado:**

Si las validaciones son correctas, la asignación queda registrada como vigente durante el periodo correspondiente.

---

### 7.4 Usuario asignado a varias áreas

**PENDIENTE**

Todavía debe confirmarse si un usuario interno puede pertenecer simultáneamente a más de un área.

Existen al menos dos posibilidades:

**Alternativa A**

```text
Usuario A
    ↓
Área 1
```

El usuario solo puede tener una asignación activa.

**Alternativa B**

```text
Usuario A
    ├── Área 1
    ├── Área 2
    └── Área 3
```

El usuario puede tener varias asignaciones activas al mismo tiempo.

Esta decisión deberá ser confirmada antes de establecer restricciones definitivas en el modelo de datos.

---

### 7.5 Vigencia de la asignación

**PROPUESTO**

Una asignación podría registrar un periodo de vigencia para conservar información histórica.

**EJEMPLO**

```text
Usuario A
Área: Área de ejemplo
Desde: 01/01/2026
Hasta: 31/07/2026
```

Posteriormente:

```text
Usuario A
Área: Otra área de ejemplo
Desde: 01/08/2026
Hasta: vigente
```

Esto permitiría conocer en qué área se encontraba asignado un usuario en una fecha determinada.

**PENDIENTE**

Confirmar si todas las asignaciones requieren fecha de inicio y fin o solamente aquellas que necesiten conservar historial.

---

### 7.6 Cambio de área de un usuario

**PROPUESTO**

Cuando un usuario deje de pertenecer a un área y pase a otra, no debería eliminarse necesariamente la asignación anterior si esta información es necesaria para trazabilidad.

**EJEMPLO**

Situación inicial:

```text
Usuario A
Área A
01/01/2026 - 31/07/2026
```

Nueva situación:

```text
Usuario A
Área B
01/08/2026 - vigente
```

El cambio podría implicar:

* Finalizar la vigencia de la asignación anterior.
* Registrar la nueva asignación.
* Mantener el historial.
* Revisar los roles o permisos cuyo alcance dependa del área anterior.

**PENDIENTE**

Confirmar qué debe ocurrir con los permisos y trámites del usuario cuando cambia de área.

---

### 7.7 Caso excepcional: usuario inexistente

**PROPUESTO**

No deberá registrarse una asignación para un usuario que no exista en el sistema.

**EJEMPLO**

```text
Solicitud:
Asignar Usuario 999 al Área A

Validación:
Usuario 999 no existe

Resultado:
Operación rechazada
```

---

### 7.8 Caso excepcional: usuario inactivo

**PROPUESTO**

Si un usuario se encuentra inactivo, el sistema debería impedir nuevas asignaciones organizacionales o acciones que dependan de una asignación vigente.

**EJEMPLO**

```text
Usuario A
Estado: INACTIVO

Intento:
Asignarlo al Área B

Resultado:
Operación rechazada
```

**PENDIENTE**

Confirmar qué debe ocurrir con las asignaciones existentes cuando un usuario pasa a estado inactivo.

---

### 7.9 Caso excepcional: asignación vencida

**PROPUESTO**

Cuando una asignación tenga una fecha de fin anterior a la fecha de la operación, dicha asignación no debería considerarse vigente.

**EJEMPLO**

```text
Asignación:
Usuario A → Área B

Vigencia:
01/01/2026 - 31/07/2026

Fecha de operación:
27/08/2026

Resultado:
La asignación ya no se considera vigente.
```

El backend deberá evaluar la vigencia cuando una autorización dependa de la pertenencia del usuario a un área.

---

## 8. Designación de responsables

### 8.1 Objetivo de la responsabilidad

**PROPUESTO**

El módulo deberá permitir identificar qué usuario interno posee la responsabilidad de un área durante determinado periodo.

La responsabilidad deberá mantenerse separada de los conceptos de cargo, rol y permiso.

Conceptualmente:

```text
Usuario interno
      ↓
Responsabilidad
      ↓
Área
```

---

### 8.2 Designación de un responsable

**PROPUESTO**

Para designar un responsable, el backend podría validar:

* Que el usuario exista.
* Que el usuario se encuentre activo.
* Que el área exista.
* Que el área se encuentre activa.
* Que el periodo de vigencia sea válido.
* Que no exista un conflicto con otra responsabilidad vigente.
* Que el usuario que realiza la designación tenga autorización.

**Entrada conceptual:**

```text
Usuario
Área
Fecha de inicio
Fecha de fin, si corresponde
Tipo de responsabilidad, si posteriormente se requiere
```

**Resultado esperado:**

Si las validaciones son correctas, la responsabilidad queda registrada para el periodo correspondiente.

---

### 8.3 Relación entre asignación y responsabilidad

**PROPUESTO**

Podría requerirse que un usuario se encuentre asignado a un área antes de poder ser designado como responsable de dicha área.

**EJEMPLO**

```text
Usuario A
    ↓
Asignado al Área B
    ↓
Puede ser evaluado para responsabilidad del Área B
```

Sin embargo, esta regla todavía no debe considerarse oficial.

**PENDIENTE**

Confirmar si un responsable necesariamente debe pertenecer al área de la cual es responsable.

---

### 8.4 Vigencia de la responsabilidad

**PROPUESTO**

La responsabilidad podría registrar fecha de inicio y fecha de fin para conservar historial.

**EJEMPLO**

```text
Área A

Responsable:
Usuario A
01/01/2026 - 31/07/2026

Responsable:
Usuario B
01/08/2026 - vigente
```

Esto permitiría determinar quién era responsable del área en una fecha específica.

---

### 8.5 Cambio de responsable

**PROPUESTO**

Cuando se designe un nuevo responsable, el registro anterior no debería eliminarse si se requiere conservar historial.

Un posible flujo sería:

```text
Responsable anterior vigente
        ↓
Finalizar su vigencia
        ↓
Registrar nuevo responsable
        ↓
Conservar ambos registros históricos
```

**PENDIENTE**

Confirmar si el cambio de responsable requiere algún proceso de aprobación y quién tiene autorización para realizarlo.

---

### 8.6 Responsable principal, alterno o temporal

**PENDIENTE**

Todavía debe confirmarse si una misma área puede tener:

* Un único responsable principal.
* Más de un responsable simultáneo.
* Responsables alternos.
* Responsables temporales.
* Responsables encargados por reemplazo.

Estas reglas afectan directamente la validación de duplicados y la vigencia de las responsabilidades.

---

### 8.7 Caso excepcional: responsable duplicado

**PROPUESTO**

Si la institución determina que solo puede existir un responsable principal vigente por área, el sistema deberá impedir que se registren dos responsables principales con vigencias superpuestas.

**EJEMPLO**

Situación existente:

```text
Área A
Responsable: Usuario A
01/08/2026 - vigente
```

Nueva solicitud:

```text
Área A
Responsable: Usuario B
01/08/2026 - vigente
```

Si solo se permite un responsable principal:

```text
Resultado:
Operación rechazada por conflicto de vigencia.
```

Esta regla dependerá de la decisión institucional.

---

### 8.8 Responsable temporal

**PROPUESTO**

Si la institución permite responsables temporales, la designación deberá tener una vigencia claramente definida.

**EJEMPLO**

```text
Usuario B
Responsable temporal del Área A

Desde: 10/08/2026
Hasta: 20/08/2026
```

Al finalizar la vigencia, el sistema deberá dejar de considerar esa responsabilidad como activa.

---

### 8.9 Área sin responsable

**PENDIENTE**

Debe definirse qué debe ocurrir cuando un área no tenga ningún responsable vigente.

Entre las situaciones que deben consultarse se encuentran:

* Si el área puede continuar recibiendo trámites.
* Si puede realizar derivaciones.
* Si debe mostrarse una advertencia.
* Si debe impedirse determinadas operaciones.
* Si debe existir obligatoriamente un responsable antes de activar el área.

Estas opciones no representan reglas oficiales.

---

### 8.10 Responsable inactivo

**PROPUESTO**

Si el usuario responsable pasa a estado inactivo, el sistema debería evitar que su responsabilidad continúe siendo utilizada para autorizar nuevas operaciones.

**PENDIENTE**

Debe confirmarse si la responsabilidad se finaliza automáticamente, si debe designarse un reemplazo o si se requiere una acción administrativa previa.

---

### 8.11 Flujo conceptual de cambio de responsable

**PROPUESTO**

```text
Solicitud de cambio
        ↓
Verificar área
        ↓
Verificar nuevo usuario
        ↓
Verificar estado del usuario
        ↓
Verificar reglas de responsabilidad
        ↓
Validar vigencias
        ↓
Finalizar responsabilidad anterior, si corresponde
        ↓
Registrar nueva responsabilidad
        ↓
Conservar historial
```

Este flujo deberá adaptarse posteriormente según las reglas institucionales aprobadas.

## 9. Roles y permisos

## 10. Matriz funcional de roles y permisos

## 11. Flujos normales

## 12. Flujos excepcionales

## 13. Control de acceso basado en roles (RBAC)

## 14. Principio de mínimo privilegio

## 15. Decisiones y supuestos

## 16. Preguntas pendientes para el profesor

## 17. Fuentes consultadas
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

### 9.1 Objetivo del control de acceso

**PROPUESTO**

El módulo deberá permitir controlar qué acciones puede realizar cada usuario dentro del SIGD mediante roles y permisos.

Los permisos no deberán concederse automáticamente a todos los usuarios. Cada operación protegida deberá comprobarse de acuerdo con las autorizaciones que correspondan.

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

El control de autorización deberá realizarse en el backend y no depender únicamente de elementos visibles u ocultos en el frontend.

---

### 9.2 Rol del sistema

**PROPUESTO**

Un rol representa una agrupación de permisos que puede asignarse a uno o varios usuarios.

El uso de roles permite evitar la asignación manual de las mismas autorizaciones repetidamente a cada usuario.

**EJEMPLO**

```text
Rol de ejemplo: Rol A

Permisos:
- tramite.ver
- tramite.recibir
- tramite.derivar
```

El nombre del rol y los permisos anteriores son ficticios y se utilizan solamente para explicar el funcionamiento.

**PENDIENTE**

Debe confirmarse:

* Cuáles serán los roles oficiales del SIGD.
* Quién estará autorizado para crear roles.
* Quién podrá modificar un rol.
* Quién podrá asignar o retirar roles a los usuarios.
* Si los roles tendrán vigencia.
* Si un usuario podrá tener varios roles simultáneamente.

---

### 9.3 Permiso del sistema

**PROPUESTO**

Un permiso representa una autorización específica para realizar una determinada acción dentro del sistema.

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

Los identificadores anteriores son únicamente ejemplos técnicos y no representan los nombres definitivos de los permisos del SIGD.

La lista oficial deberá definirse después de confirmar qué operaciones existen realmente en cada etapa del trámite.

---

### 9.4 Relación entre roles y permisos

**PROPUESTO**

Un rol podría contener varios permisos y un mismo permiso podría pertenecer a diferentes roles.

Conceptualmente:

```text
Rol A
    ├── Permiso 1
    ├── Permiso 2
    └── Permiso 3

Rol B
    ├── Permiso 1
    └── Permiso 4
```

Esto permitiría reutilizar permisos sin duplicar su definición.

La implementación técnica de esta relación corresponderá posteriormente al modelo de datos aprobado.

---

### 9.5 Asignación de roles a usuarios

**PROPUESTO**

Un usuario interno podría recibir uno o varios roles según las reglas que posteriormente se definan.

Antes de realizar una asignación de rol, el backend debería verificar:

* Que el usuario exista.
* Que el usuario se encuentre activo.
* Que el rol exista.
* Que el rol se encuentre activo, si los roles manejan estado.
* Que la asignación sea válida.
* Que el usuario que realiza la operación tenga autorización.
* Que no exista una asignación duplicada incompatible con las reglas aprobadas.

**PENDIENTE**

Debe confirmarse si:

* Un usuario puede tener más de un rol.
* Los roles son permanentes o temporales.
* Un rol puede asignarse únicamente dentro de determinada área.
* Existen roles incompatibles entre sí.

---

### 9.6 Vigencia de un rol

**PROPUESTO**

Cuando sea necesario, una asignación de rol podría incluir un periodo de vigencia.

**EJEMPLO**

```text
Usuario A
Rol: Rol de ejemplo

Desde: 01/08/2026
Hasta: 31/08/2026
```

Después del final de la vigencia, los permisos provenientes de ese rol no deberían utilizarse para autorizar nuevas operaciones.

---

### 9.7 Caso excepcional: rol vencido

**PROPUESTO**

Si la fecha de vigencia de una asignación de rol ya terminó, el backend deberá tratarla como no vigente.

**EJEMPLO**

```text
Rol asignado:
01/07/2026 - 31/07/2026

Fecha de operación:
27/08/2026

Resultado:
El rol no se considera vigente.
```

Por lo tanto, sus permisos no deberían autorizar la operación solicitada.

---

### 9.8 Caso excepcional: rol duplicado

**PROPUESTO**

El sistema deberá evitar asignaciones duplicadas que no tengan sentido funcional.

**EJEMPLO**

Si el Usuario A ya tiene el Rol A vigente:

```text
Usuario A
    ↓
Rol A
```

no debería registrarse nuevamente exactamente la misma asignación sin una justificación válida.

**PENDIENTE**

Las reglas exactas para detectar duplicados dependerán de si los roles tienen vigencia, alcance por área u otras condiciones.

---

### 9.9 Alcance global de un permiso

**PROPUESTO**

Algunos permisos podrían permitir actuar sobre información de todo el sistema.

Este tipo de autorización tendría un alcance global.

**EJEMPLO**

```text
Permiso:
tramite.ver

Alcance:
GLOBAL
```

En este ejemplo, el permiso permitiría consultar trámites independientemente del área.

Esta posibilidad deberá ser validada antes de implementarse.

---

### 9.10 Alcance limitado a un área

**PROPUESTO**

Algunos permisos podrían estar restringidos al área a la que pertenece o para la cual se encuentra autorizado el usuario.

**EJEMPLO**

```text
Usuario A

Permiso:
tramite.ver

Alcance:
Área B
```

En este caso conceptual, el usuario podría consultar información correspondiente al Área B, pero no necesariamente a otras áreas.

**PENDIENTE**

Debe confirmarse si los permisos podrán limitarse por:

* Área.
* Tipo de documento.
* Etapa del trámite.
* Unidad organizacional.
* Algún otro criterio institucional.

---

### 9.11 Verificación de permisos en el backend

**PROPUESTO**

Antes de ejecutar una operación protegida, el backend deberá evaluar la autorización del usuario.

Un flujo preliminar podría ser:

```text
Usuario solicita operación
        ↓
Verificar identidad
        ↓
Verificar estado del usuario
        ↓
Verificar asignación organizacional
        ↓
Obtener roles vigentes
        ↓
Obtener permisos asociados
        ↓
Verificar alcance
        ↓
¿Tiene autorización?
     ↙         ↘
   Sí           No
   ↓             ↓
Permitir       Rechazar
operación      operación
```

Este flujo es conceptual y no representa todavía un endpoint ni una implementación técnica definitiva.

---

### 9.12 Acceso denegado

**PROPUESTO**

Cuando un usuario no posea el permiso necesario o el permiso no tenga el alcance requerido, la operación deberá ser rechazada.

**EJEMPLO**

```text
Usuario A
    ↓
intenta derivar un trámite
    ↓
no posee permiso para derivar
    ↓
ACCESO DENEGADO
```

El hecho de que el usuario pueda conocer o intentar acceder directamente a una ruta del backend no deberá permitirle evitar la validación de autorización.

---

### 9.13 Permisos y principio de mínimo privilegio

**PROPUESTO**

El diseño deberá seguir el principio de conceder únicamente las autorizaciones necesarias para que cada usuario pueda cumplir sus funciones.

Por lo tanto, una acción que no haya sido autorizada no deberá concederse automáticamente.

**EJEMPLO**

Si un usuario solamente necesita consultar información:

```text
Permitido:
tramite.ver

No concedido automáticamente:
tramite.derivar
tramite.cerrar
administrar roles
```

La explicación teórica y las fuentes sobre el principio de mínimo privilegio se desarrollarán posteriormente en la sección correspondiente de este análisis.

---

## 10. Matriz funcional de roles y permisos

### 10.1 Objetivo de la matriz

**PROPUESTO**

La matriz funcional permite visualizar de manera sencilla qué acciones podrían estar asociadas a determinados roles.

La siguiente matriz es únicamente demostrativa. No representa los roles ni permisos oficiales de la institución.

### 10.2 Matriz de ejemplo

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

Los nombres “Rol de consulta”, “Rol operativo” y “Rol de administración” son ficticios y se utilizan solamente para demostrar cómo podría construirse una matriz de autorización.

Las celdas tampoco representan decisiones oficiales.

---

### 10.3 Interpretación de la matriz

**EJEMPLO**

En la matriz anterior:

* El Rol de consulta solamente tendría acceso a operaciones de lectura.
* El Rol operativo podría participar en determinadas actividades del trámite.
* El Rol de administración podría realizar tareas relacionadas con la configuración organizacional y la autorización.

Esto no significa que esos roles deban existir realmente en la institución.

La matriz definitiva deberá construirse después de identificar:

* Los actores oficiales.
* Los roles institucionalmente aprobados.
* Las operaciones reales del SIGD.
* Los responsables autorizados.
* El alcance de cada permiso.

---

### 10.4 Regla de denegación por defecto

**PROPUESTO**

Si una acción no se encuentra expresamente autorizada para un rol, no deberá asumirse automáticamente que está permitida.

Conceptualmente:

```text
Permiso confirmado
       ↓
      Sí
       ↓
Operación potencialmente autorizada
```

Mientras que:

```text
Permiso no confirmado
       ↓
      No
       ↓
No conceder por defecto
```

Esta regla reduce el riesgo de otorgar más privilegios de los necesarios.

---

### 10.5 Matriz con alcance por área

**PROPUESTO**

Cuando un permiso dependa del área, no será suficiente con comprobar únicamente la existencia del permiso.

**EJEMPLO**

```text
Usuario A
Rol: Rol operativo

Permiso:
tramite.derivar

Área autorizada:
Área A
```

Si intenta realizar la misma acción sobre un trámite perteneciente al Área B, el backend deberá evaluar si el alcance del permiso lo permite.

Conceptualmente:

```text
¿Tiene permiso?
       ↓
      Sí
       ↓
¿El permiso aplica al área?
      ↙    ↘
    Sí      No
    ↓        ↓
Permitir   Denegar
```

**PENDIENTE**

Confirmar con el profesor si el control por área será requerido en el SIGD.

---

### 10.6 Preguntas derivadas de la matriz

**PENDIENTE**

Para convertir esta matriz de ejemplo en una propuesta más precisa deberá confirmarse:

* ¿Cuáles son los roles oficiales del sistema?
* ¿Qué acciones puede realizar cada rol?
* ¿Quién puede recibir trámites?
* ¿Quién puede adjuntar documentos?
* ¿Quién puede derivar trámites?
* ¿Quién puede observarlos?
* ¿Quién puede atenderlos?
* ¿Quién puede cerrarlos?
* ¿Quién podrá firmar cuando una operación requiera firma?
* ¿Quién puede crear, actualizar, activar o desactivar áreas?
* ¿Quién puede asignar responsables?
* ¿Quién puede administrar roles?
* ¿Quién puede aprobar cambios de permisos?
* ¿Los permisos serán globales o tendrán alcance por área?
* ¿Un usuario puede tener varios roles simultáneamente?

Estas preguntas deberán resolverse antes de considerar definitiva cualquier matriz de autorización.

## 11. Flujos normales

Los siguientes flujos describen de manera funcional cómo podrían ejecutarse algunas operaciones del módulo. No representan endpoints definitivos ni decisiones institucionales oficiales.

---

### 11.1 Flujo normal: registrar un área

**PROPUESTO**

**Entrada:**

```text
Datos del área
Área superior, si corresponde
Estado inicial
Usuario que realiza la operación
```

**Validaciones:**

1. Verificar que el usuario esté autenticado.
2. Verificar que tenga autorización para registrar áreas.
3. Verificar que los datos obligatorios estén completos.
4. Verificar que no exista un duplicado incompatible con las reglas aprobadas.
5. Si se indica un área superior, comprobar que exista.
6. Verificar que la relación jerárquica sea válida.

**Resultado esperado:**

```text
Área registrada correctamente.
```

**Responsable de la operación:**

**PENDIENTE**

Debe confirmarse qué rol o usuario institucional estará autorizado para registrar áreas.

---

### 11.2 Flujo normal: consultar un área

**PROPUESTO**

**Entrada:**

```text
Identificador del área
Usuario que realiza la consulta
```

**Validaciones:**

1. Verificar que el usuario esté autenticado.
2. Verificar que el área exista.
3. Verificar si la consulta requiere un permiso específico.
4. Si existe alcance por área, comprobar que el usuario tenga autorización sobre dicha unidad.

**Resultado esperado:**

Mostrar la información organizacional permitida para el usuario.

**Responsable:**

Dependerá del rol y de las reglas de acceso aprobadas.

---

### 11.3 Flujo normal: actualizar un área

**PROPUESTO**

**Entrada:**

```text
Área a modificar
Datos nuevos
Usuario que realiza la modificación
```

**Validaciones:**

1. Verificar que el área exista.
2. Verificar que el usuario esté autorizado.
3. Verificar que los nuevos datos sean válidos.
4. Si cambia la dependencia jerárquica, comprobar que no se genere un ciclo.
5. Verificar que la modificación no incumpla reglas institucionales.

**Resultado esperado:**

```text
Información del área actualizada.
```

**PENDIENTE**

Debe confirmarse qué atributos se podrán modificar y cuáles deberán conservar historial.

---

### 11.4 Flujo normal: asignar un usuario a un área

**PROPUESTO**

**Entrada:**

```text
Usuario interno
Área
Fecha de inicio
Fecha de fin, si corresponde
Usuario que realiza la asignación
```

**Validaciones:**

1. Verificar que el usuario interno exista.
2. Verificar que se encuentre activo.
3. Verificar que el área exista.
4. Verificar que el área esté activa.
5. Verificar que las fechas sean válidas.
6. Verificar que no exista una asignación incompatible.
7. Verificar que quien realiza la operación tenga autorización.

**Resultado esperado:**

```text
Asignación registrada con su periodo de vigencia.
```

**Responsable:**

**PENDIENTE**

Debe confirmarse qué actor estará autorizado para realizar asignaciones organizacionales.

---

### 11.5 Flujo normal: designar responsable de un área

**PROPUESTO**

**Entrada:**

```text
Usuario
Área
Fecha de inicio
Fecha de fin, si corresponde
Usuario que realiza la designación
```

**Validaciones:**

1. Verificar que el área exista.
2. Verificar que el área esté activa.
3. Verificar que el usuario exista.
4. Verificar que el usuario esté activo.
5. Verificar las condiciones de vigencia.
6. Verificar si existe conflicto con otro responsable.
7. Verificar que quien realiza la designación tenga autorización.

**Resultado esperado:**

```text
Responsabilidad registrada correctamente.
```

Si existe un responsable anterior y las reglas lo requieren:

```text
Finalizar vigencia anterior
        ↓
Registrar nuevo responsable
        ↓
Conservar historial
```

**PENDIENTE**

Debe confirmarse si un responsable tiene que pertenecer previamente al área.

---

### 11.6 Flujo normal: asignar un rol

**PROPUESTO**

**Entrada:**

```text
Usuario
Rol
Área, si existe alcance organizacional
Vigencia, si corresponde
Usuario que realiza la asignación
```

**Validaciones:**

1. Verificar que el usuario exista.
2. Verificar que el usuario se encuentre activo.
3. Verificar que el rol exista.
4. Verificar que el rol pueda ser asignado.
5. Verificar que no exista una asignación duplicada incompatible.
6. Si existe alcance por área, verificar que el área sea válida.
7. Verificar que el usuario que realiza la operación tenga autorización.

**Resultado esperado:**

```text
Rol asignado correctamente.
```

**PENDIENTE**

Debe confirmarse quién podrá asignar y retirar roles.

---

### 11.7 Flujo normal: verificar autorización antes de ejecutar una acción

**PROPUESTO**

**Entrada:**

```text
Usuario autenticado
Acción solicitada
Recurso involucrado
Área relacionada, si corresponde
```

**Flujo:**

```text
Usuario solicita una operación
        ↓
Backend identifica al usuario
        ↓
Comprueba que esté activo
        ↓
Comprueba asignaciones vigentes
        ↓
Obtiene roles vigentes
        ↓
Obtiene permisos correspondientes
        ↓
Comprueba alcance del permiso
        ↓
¿Está autorizado?
      ↙        ↘
    Sí          No
    ↓            ↓
Ejecutar       Rechazar
operación      operación
```

**Resultado esperado:**

La operación solamente se ejecuta cuando todas las condiciones de autorización necesarias se cumplen.

---

### 11.8 Flujo normal: desactivar un área

**PROPUESTO**

**Entrada:**

```text
Área
Usuario que solicita la desactivación
```

**Validaciones:**

1. Verificar que el área exista.
2. Verificar que actualmente esté activa.
3. Verificar que el usuario tenga autorización.
4. Verificar si existen áreas dependientes activas.
5. Verificar si existen trámites pendientes relacionados.
6. Verificar si existen responsables o asignaciones vigentes.

**Resultado esperado:**

El área cambia a estado inactivo cuando las reglas institucionales permiten la operación.

**PENDIENTE**

Debe confirmarse qué condiciones impiden desactivar un área.

---

## 12. Flujos excepcionales

Los siguientes casos representan situaciones que el backend deberá detectar para evitar inconsistencias o accesos no autorizados.

---

### 12.1 Área inexistente

**PROPUESTO**

**Entrada:**

```text
Operación sobre Área 999
```

**Validación:**

El backend busca el área y determina que no existe.

**Resultado:**

```text
Operación rechazada.
Motivo: área inexistente.
```

Esto evita crear relaciones con registros que no existen.

---

### 12.2 Área inactiva

**PROPUESTO**

**EJEMPLO**

```text
Área A
Estado: INACTIVA

Solicitud:
Asignar Usuario B al Área A
```

**Validación:**

El backend detecta que el área no está activa.

**Resultado:**

```text
Operación rechazada.
```

**PENDIENTE**

Debe confirmarse cuáles operaciones estarán prohibidas sobre áreas inactivas.

---

### 12.3 Ciclo jerárquico

**PROPUESTO**

Situación existente:

```text
Área A
   ↓
Área B
   ↓
Área C
```

Nueva solicitud:

```text
Hacer que Área A dependa de Área C.
```

Esto produciría:

```text
Área A → Área B → Área C → Área A
```

**Validación:**

El sistema detecta que la nueva relación convertiría a un área en dependiente directa o indirecta de sí misma.

**Resultado:**

```text
Operación rechazada.
Motivo: ciclo jerárquico.
```

---

### 12.4 Usuario inexistente

**PROPUESTO**

**Entrada:**

```text
Usuario 999
Área A
```

**Validación:**

El usuario no existe en el módulo de identidad correspondiente.

**Resultado:**

```text
Asignación rechazada.
```

El módulo organizacional no deberá crear usuarios por su cuenta para resolver esta situación.

---

### 12.5 Usuario inactivo

**PROPUESTO**

**EJEMPLO**

```text
Usuario A
Estado: INACTIVO

Solicitud:
Asignar nuevo rol
```

**Validación:**

El backend detecta que el usuario está inactivo.

**Resultado:**

```text
Operación rechazada.
```

**PENDIENTE**

Debe confirmarse qué ocurre con roles y asignaciones ya existentes cuando un usuario pasa a estado inactivo.

---

### 12.6 Asignación vencida

**PROPUESTO**

**EJEMPLO**

```text
Usuario A → Área B

Vigencia:
01/01/2026 - 31/07/2026

Fecha de operación:
27/08/2026
```

**Validación:**

La fecha actual se encuentra fuera del periodo vigente.

**Resultado:**

```text
La asignación no se utiliza para autorizar la operación.
```

---

### 12.7 Responsable duplicado

**PROPUESTO**

Este caso depende de que la institución determine que solo puede existir un responsable principal vigente por área.

**EJEMPLO**

Existe:

```text
Área A
Responsable: Usuario A
Estado: vigente
```

Se intenta registrar:

```text
Área A
Responsable: Usuario B
Estado: vigente
```

**Validación:**

Se detecta superposición entre responsabilidades principales.

**Resultado:**

```text
Operación rechazada por conflicto de vigencia.
```

**PENDIENTE**

Confirmar si efectivamente existe la restricción de un único responsable principal.

---

### 12.8 Rol duplicado

**PROPUESTO**

**EJEMPLO**

```text
Usuario A
Rol A
Estado: vigente
```

Se intenta registrar nuevamente la misma asignación sin ninguna diferencia de vigencia o alcance.

**Resultado:**

```text
Operación rechazada como duplicada.
```

La definición exacta de duplicado dependerá del modelo aprobado.

---

### 12.9 Rol vencido

**PROPUESTO**

**EJEMPLO**

```text
Usuario A
Rol A

Vigencia:
01/07/2026 - 31/07/2026

Fecha de operación:
27/08/2026
```

**Validación:**

El backend detecta que la asignación del rol ya terminó.

**Resultado:**

```text
Los permisos provenientes de ese rol no autorizan la operación.
```

---

### 12.10 Permiso insuficiente

**PROPUESTO**

**EJEMPLO**

```text
Usuario A

Permiso disponible:
tramite.ver

Operación solicitada:
tramite.cerrar
```

**Validación:**

El permiso requerido no está presente.

**Resultado:**

```text
ACCESO DENEGADO
```

El sistema no deberá conceder el permiso faltante por defecto.

---

### 12.11 Permiso correcto pero alcance incorrecto

**PROPUESTO**

**EJEMPLO**

```text
Usuario A

Permiso:
tramite.derivar

Alcance:
Área A
```

El usuario intenta derivar un trámite correspondiente al Área B.

**Validación:**

El permiso existe, pero su alcance no incluye el recurso solicitado.

**Resultado:**

```text
ACCESO DENEGADO
```

Esto demuestra que no siempre es suficiente comprobar solamente el nombre del permiso.

---

### 12.12 Área superior inactiva

**PROPUESTO**

**EJEMPLO**

```text
Área A
Estado: INACTIVA

Área B
Depende de Área A
Estado: ACTIVA
```

**PENDIENTE**

Debe determinarse institucionalmente si esta situación será permitida.

Entre las posibles reglas a validar se encuentran:

* Permitir la relación temporalmente.
* Obligar a cambiar la dependencia del Área B.
* Impedir que Área A sea desactivada mientras tenga áreas activas dependientes.

No se adopta ninguna de estas opciones como definitiva.

---

### 12.13 Área sin responsable

**PENDIENTE**

**EJEMPLO**

```text
Área A
Estado: ACTIVA
Responsable vigente: ninguno
```

Debe confirmarse si:

* El área puede seguir recibiendo trámites.
* Puede derivar documentos.
* El sistema debe mostrar una advertencia.
* Determinadas operaciones deben bloquearse.
* Debe designarse obligatoriamente un responsable.

---

### 12.14 Intento de autorización solo desde el frontend

**PROPUESTO**

Un usuario podría intentar ejecutar directamente una operación protegida aunque el frontend no muestre el botón correspondiente.

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

**Resultado:**

La seguridad se mantiene porque la autorización se comprueba en el backend.

---

### 12.15 Resumen del tratamiento de excepciones

De manera general, una operación sensible deberá seguir este criterio:

```text
Entrada recibida
      ↓
Validar existencia
      ↓
Validar estados
      ↓
Validar vigencias
      ↓
Validar relaciones
      ↓
Validar autorización
      ↓
¿Todo es válido?
   ↙          ↘
 Sí            No
 ↓              ↓
Ejecutar      Rechazar
```

El backend deberá rechazar las operaciones que incumplan las reglas aprobadas y no deberá asumir permisos, relaciones o estados que no hayan sido confirmados.


## 13. Control de acceso basado en roles (RBAC)

## 14. Principio de mínimo privilegio

## 15. Decisiones y supuestos

## 16. Preguntas pendientes para el profesor

## 17. Fuentes consultadas
# Análisis funcional de trazabilidad, recepción, derivación y atención

- Responsable: Liz
- Rama: B_JACOBO
- Grupo: Grupo 1 — RutaDoc
- Estado: PROPUESTA PRELIMINAR
- Validación institucional: PENDIENTE

## 1. Objetivo

### Objetivo general

RutaDoc busca documentar y proponer el seguimiento completo de un trámite, desde su recepción hasta su atención final, para que sea posible conocer quién realizó cada acción, en qué fecha y hora ocurrió, en qué área se encontraba el trámite, desde qué área fue enviado, hacia qué área fue derivado, qué decisión se tomó y cuál fue su resultado final. El historial cronológico de estas actuaciones debe conservarse íntegramente: al actualizar el estado actual, ningún registro previo será eliminado ni sustituido.

### Objetivos específicos

1. Identificar a los actores que participan en el trámite y la información que cada uno necesita consultar para cumplir su intervención.
2. Diferenciar las acciones de recepción, movimiento, derivación, devolución, observación, incorporación de adjuntos, atención, cierre y reapertura.
3. Explicar los flujos sencillo, jerárquico y excepcional que pueden seguir los trámites.
4. Determinar la información mínima que debe conservarse en cada movimiento para mantener la trazabilidad del trámite.
5. Preparar una base funcional que permita a B_GERIC desarrollar posteriormente el modelo de datos.
6. Registrar como PENDIENTES las acciones, estados, permisos, plazos y jerarquías que aún no hayan sido confirmados institucionalmente.
## 2. Alcance

### 2.1 Incluye

El análisis funcional de RutaDoc incluye, como propuesta preliminar, los siguientes alcances:

1. La recepción de un expediente proveniente del módulo de trámites y expedientes, conservando su código y número de registro como referencias, sin duplicar la información administrada por dicho módulo.
2. El seguimiento cronológico de todos los movimientos que se registren durante el trámite.
3. El registro del actor responsable, fecha y hora, área de origen, área de destino, acción realizada, estado anterior, estado resultante y observación de cada movimiento propuesto.
4. La derivación propuesta del trámite hacia otra área cuando requiera revisión, firma, autorización, subsanación o una decisión jerárquica; las condiciones precisas para estos casos permanecen PENDIENTES de confirmación.
5. La confirmación propuesta de recepción por el área destinataria.
6. La atención final propuesta, con respuesta, resultado y referencia al documento emitido cuando corresponda.
7. La consulta del estado actual y la reconstrucción del recorrido completo del trámite.
8. La descripción de los flujos sencillo, jerárquico y excepcional como alternativas funcionales propuestas.
9. El análisis de casos propuestos como destino inválido, usuario no autorizado, derivación duplicada, devolución, observación, falta de requisitos, cierre indebido y reapertura.
10. La relación conceptual con usuarios, áreas, permisos, expedientes, documentos y adjuntos, sin duplicar entidades cuya gestión corresponda a otros módulos.

Las acciones, estados, permisos, plazos, jerarquías y reglas concretas asociados a estos alcances son PENDIENTES de validación institucional.

### 2.2 No incluye

Este análisis no incluye los siguientes elementos, que permanecen fuera de su alcance o PENDIENTES de definición:

1. Nombres oficiales de áreas, cargos o responsables que todavía no hayan sido proporcionados institucionalmente.
2. La definición definitiva de acciones, estados, permisos, plazos o niveles jerárquicos; todos estos elementos son PENDIENTES de confirmación.
3. El diseño del modelo entidad-relación o del diccionario de datos, porque corresponde a B_GERIC.
4. La creación de tablas, SQL, restricciones o pruebas de PostgreSQL, porque corresponde a B_JHASY.
5. El desarrollo de endpoints, controladores, servicios o interfaces.
6. La implementación de los módulos de usuarios, áreas, expedientes, documentos o adjuntos.
7. El uso de datos personales o documentos institucionales reales.
## 3. Actores involucrados

Los siguientes actores representan funciones conceptuales dentro del flujo propuesto de RutaDoc. Sus nombres, alcances y permisos no constituyen cargos ni definiciones institucionales oficiales y permanecen sujetos a validación.

| Actor propuesto | Participación en el flujo | Acciones propuestas | Información que necesita consultar | Validación |
| --- | --- | --- | --- | --- |
| Usuario solicitante | Puede ser interno o externo e inicia o presenta el trámite. | Presentar el trámite y consultar su avance. | Código de trámite, número de registro, estado actual, observaciones y respuesta final. | Su identificación y registro pertenecen al módulo del Grupo 4. |
| Personal encargado de recepción | Recibe inicialmente el trámite. | Comprobar datos y documentos presentados; registrar o confirmar la recepción. | Información del solicitante, tipo de trámite, requisitos, adjuntos y destino propuesto. | El nombre oficial de su cargo o área está PENDIENTE. |
| Usuario interno del área destinataria | Confirma la recepción dentro del área y revisa el expediente y sus documentos. | Confirmar la recepción, registrar observaciones o continuar el tratamiento. | Historial, origen, motivo de derivación, documentos y acciones pendientes. | Funciones y permisos específicos PENDIENTES. |
| Responsable del área | Evalúa el trámite para decidir su tratamiento. | Proponer o registrar la atención, observación, devolución o derivación, según corresponda. | Expediente completo, historial, permisos, requisitos y posibles destinos. | Las decisiones y permisos exactos permanecen PENDIENTES. |
| Usuario encargado de la atención | Ejecuta la actividad necesaria para preparar la respuesta o resultado. | Registrar la atención realizada. | Documentos, observaciones, decisiones previas y datos necesarios para responder. | Puede coincidir con el responsable del área; esto permanece PENDIENTE. |
| Autoridad revisora o firmante | Participa solo cuando el tipo de documento requiera revisión, autorización o firma jerárquica. | Revisar, autorizar o firmar, cuando corresponda. | Contenido, historial, decisiones previas y documento de respuesta. | Su existencia, cargo y nivel jerárquico permanecen PENDIENTES. |
| Administrador funcional | Actor relacionado, no necesariamente participante del recorrido cotidiano. | Gestionar configuraciones autorizadas de acciones o estados cuando la institución los defina. | Configuraciones autorizadas necesarias para su función. | La administración de usuarios, áreas, roles y permisos pertenece a otros módulos; su participación permanece PENDIENTE. |

### 3.1 Aclaraciones sobre los actores

- Los nombres indicados representan funciones conceptuales, no cargos institucionales oficiales.
- Una misma persona podría asumir más de una función si sus permisos lo permiten.
- Una función también podría ser realizada por distintas personas.
- Los permisos definitivos dependerán de roles, áreas y reglas institucionales todavía no proporcionadas.
- RutaDoc utilizará referencias a usuarios y áreas administrados por otros módulos, sin duplicar sus datos.
- El sistema SIGD no debe presentarse como actor humano; es la herramienta donde los actores realizan sus acciones.
## 4. Entradas y resultados

### 4.1 Entradas funcionales

| Entrada funcional | Procedencia | Uso dentro de RutaDoc | Validación |
| --- | --- | --- | --- |
| Referencia del expediente | Módulo de trámites y expedientes del Grupo 2; incluye conceptualmente código de trámite o expediente y número de registro. | Identificar el trámite sin duplicar los datos administrados por ese módulo. | Integración y referencias específicas PENDIENTES. |
| Referencia del usuario solicitante | Módulo de usuarios del Grupo 4. | Relacionar el trámite con quien solicitó la atención. | La clasificación como usuario interno, externo registrado o externo no registrado pertenece al Grupo 4. |
| Tipo de documento o trámite | Módulo del Grupo 5. | Conocer el formulario, requisitos y adjuntos relacionados. | Detalle de tipos y reglas PENDIENTE. |
| Área de origen | Módulo de áreas del Grupo 3. | Identificar desde dónde se genera o deriva un movimiento. | Referencia concreta al área PENDIENTE de integración. |
| Área de destino propuesta | Módulo de áreas del Grupo 3. | Indicar hacia dónde debe enviarse el trámite. | Las reglas para elegir el destino permanecen PENDIENTES. |
| Usuario responsable de la acción | Módulos de usuarios, roles y permisos de los Grupos 3 y 4. | Conocer quién recibe, revisa, deriva, observa o atiende. | Los permisos exactos permanecen PENDIENTES. |
| Acción propuesta | Definición funcional de RutaDoc. Puede ser recepción, derivación, devolución, observación, incorporación de adjuntos, atención, cierre o reapertura. | Identificar la actuación que se propone registrar en el recorrido. | Los nombres oficiales y las acciones disponibles permanecen PENDIENTES. |
| Motivo, comentario u observación | Información proporcionada durante la acción propuesta. | Explicar por qué se realizó una acción. | Debe ser obligatorio cuando la acción necesite justificación; estas condiciones permanecen PENDIENTES. |
| Historial anterior | Recorrido previamente registrado en RutaDoc. | Verificar el recorrido y el estado previo antes de registrar una nueva acción. | No debe eliminarse ni sustituirse. |
| Fecha y hora | Generadas o registradas para cada movimiento. | Ubicar cronológicamente cada actuación. | La forma técnica de generarlas corresponderá a etapas posteriores. |

### 4.2 Resultados funcionales

| Resultado funcional | Descripción | Información conservada | Validación |
| --- | --- | --- | --- |
| Recepción registrada o confirmada | Resultado PROPUESTO de la recepción inicial o de la confirmación por un área. | Responsable, fecha y hora, referencia del trámite y área relacionada. | Condiciones de confirmación PENDIENTES. |
| Observación registrada con su motivo | Resultado PROPUESTO cuando se registra una observación. | Motivo u observación, responsable, fecha y hora, y estado relacionado. | Reglas de observación PENDIENTES. |
| Devolución registrada con destino y justificación | Resultado PROPUESTO cuando el trámite debe volver a un destino definido. | Origen, destino, justificación, responsable, fecha y hora. | Casos y permisos PENDIENTES. |
| Derivación registrada con origen, destino y responsable | Resultado PROPUESTO de enviar el trámite a otra área. | Área de origen, área de destino, responsable, fecha y hora, acción y observación. | Reglas de derivación PENDIENTES. |
| Nueva recepción en el área destinataria | Resultado PROPUESTO de la confirmación de llegada al destino. | Área destinataria, responsable, fecha y hora y referencia de la derivación previa. | Regla de confirmación PENDIENTE. |
| Atención registrada con respuesta o resultado | Resultado PROPUESTO de la actividad que atiende el trámite. | Responsable, fecha y hora, respuesta o resultado y referencia al documento emitido cuando corresponda. | Condiciones de atención PENDIENTES. |
| Cierre propuesto del trámite | Resultado PROPUESTO que indica una posible finalización del trámite. | Responsable, fecha y hora, estado previo, estado resultante y justificación si corresponde. | Reglas de cierre PENDIENTES. |
| Reapertura registrada sin eliminar el cierre anterior | Resultado PROPUESTO para retomar un trámite cerrado. | Referencia al cierre anterior, responsable, fecha y hora, motivo y nuevo estado. | Causales y permisos PENDIENTES. |
| Estado actual consultable | Resultado de la última situación registrada del trámite. | Estado resultante y referencia al último movimiento, sin borrar el historial. | Estados definitivos PENDIENTES. |
| Historial cronológico actualizado | Resultado de incorporar una nueva actuación al recorrido. | Todos los movimientos anteriores y el nuevo movimiento con su secuencia temporal. | Regla funcional PROPUESTA. |
| Recorrido completo reconstruible | Resultado de consultar ordenadamente los movimientos del trámite. | Orígenes, destinos, responsables, acciones, fechas, horas, estados y observaciones registrados. | Forma de consulta PENDIENTE. |
| Respuesta final disponible para el usuario solicitante | Resultado PROPUESTO al poner a disposición la respuesta o resultado final. | Referencia a la respuesta o documento emitido y su relación con el trámite. | Mecanismo de disponibilidad PENDIENTE. |
| Error funcional rechazado o registrado cuando la acción no sea permitida | Resultado PROPUESTO ante una acción no permitida por las reglas aplicables. | Acción intentada, motivo del rechazo o registro, fecha y hora y responsable cuando corresponda. | Reglas de autorización y tratamiento PENDIENTES. |

- Un resultado nuevo no debe borrar movimientos anteriores.
- Una derivación no debe considerarse recibida hasta que el destinatario la confirme, si esta regla es aprobada.
- Una atención no debe considerarse automáticamente cierre o archivo; esa relación está PENDIENTE.
- RutaDoc registra referencias hacia otros módulos, no copias de sus datos.
- Estas entradas y resultados son conceptos funcionales; no se convierten en atributos ni tablas de base de datos en este análisis.
## 5. Acciones del trámite

Todas las acciones descritas en esta sección son PROPUESTAS. Sus nombres oficiales, condiciones, permisos y disponibilidad permanecen PENDIENTES de validación institucional, salvo el ciclo general explicado por el profesor.

### 5.1 Concepto de movimiento

Un movimiento es el registro histórico de algo que ocurrió durante el recorrido del trámite. No debe tratarse necesariamente como una acción independiente realizada por el usuario: las acciones propuestas de recepción, derivación, devolución, observación, incorporación de adjuntos, atención, cierre y reapertura pueden generar movimientos. Cada movimiento debe conservar el actor responsable, la fecha y hora, el área relacionada, la acción, el estado anterior, el estado resultante y la observación cuando corresponda. Una corrección no debe borrar un movimiento anterior; debe registrarse como un nuevo evento relacionado. La definición técnica del movimiento corresponde posteriormente a B_GERIC y B_JHASY.

### 5.2 Acciones propuestas

| Acción propuesta | Propósito funcional | Posible responsable | Condición previa | Resultado esperado | Validación |
| --- | --- | --- | --- | --- | --- |
| Recepción | Confirmar que un trámite fue recibido inicialmente o por un área destinataria; no significa que ya fue atendido. | Personal encargado de recepción o usuario interno del área destinataria, como PROPUESTA. | Existencia de la referencia del trámite y, cuando corresponda, de una derivación previa. | Movimiento de recepción registrado o confirmado. | Responsable y mecanismo de confirmación PENDIENTES. |
| Derivación | Enviar el trámite desde un área de origen hacia otra área de destino. | Usuario interno o responsable del área, como PROPUESTA. | Trámite identificable y destino propuesto. | Movimiento que conserva motivo, origen, destino y responsable. | Permanece pendiente de recepción si la institución aprueba esa regla. |
| Devolución | Devolver el trámite a un origen o destino anterior debido a una causa justificada. | Usuario interno o responsable del área, como PROPUESTA. | Existencia de una causa o justificación. | Nuevo movimiento de devolución sin eliminar la derivación ni los movimientos previos. | Causas y permisos PENDIENTES. |
| Observación | Registrar un problema, requisito faltante o información que debe corregirse. | Personal que revisa o atiende el trámite, como PROPUESTA. | Identificación del motivo de la observación. | Movimiento que conserva el motivo. | No debe confundirse automáticamente con devolución; reglas PENDIENTES. |
| Incorporación de adjuntos | Relacionar documentos adicionales con el trámite. | Usuario autorizado según reglas futuras, como PROPUESTA. | Existencia de un documento o adjunto referenciable. | Registro de la acción y de la referencia del adjunto. | RutaDoc no administra el archivo; esa administración corresponde al módulo del Grupo 5. Tipos permitidos y requisitos PENDIENTES. |
| Atención | Registrar la respuesta, resultado o actividad que resuelve el propósito del trámite. | Usuario encargado de la atención o responsable del área, como PROPUESTA. | Información y documentos necesarios para responder. | Movimiento con responsable, fecha, resultado y referencia al documento emitido cuando corresponda. | No significa automáticamente cierre o archivo; condiciones PENDIENTES. |
| Cierre | Representar la finalización propuesta del flujo activo después de cumplir las condiciones necesarias. | Responsable autorizado según reglas futuras, como PROPUESTA. | Cumplimiento de condiciones aún no definidas. | Movimiento de cierre con responsable, fecha y motivo o resultado. | Condiciones y permisos de cierre PENDIENTES. |
| Reapertura | Retomar un trámite previamente cerrado. | Responsable autorizado según reglas futuras, como PROPUESTA. | Existencia de un cierre anterior y un motivo de reapertura. | Nuevo movimiento que registra quién la autorizó, cuándo y por qué. | No elimina el cierre anterior; causales y permisos PENDIENTES. |
| Rectificación | Registrar una corrección mediante un nuevo movimiento sin alterar el registro original. | Responsable autorizado según reglas futuras, como PROPUESTA. | Identificación del movimiento o información que requiere corrección. | Nuevo evento relacionado que conserva el registro original. | Su existencia como acción institucional permanece PENDIENTE. |
| Consulta de trazabilidad | Permitir consultar el estado actual y el historial completo. | Actor con acceso de consulta según reglas futuras, como PROPUESTA. | Referencia del trámite y autorización aplicable. | Visualización de la trazabilidad sin modificar el estado. | No debe crear un movimiento, salvo que posteriormente se defina una auditoría de consultas; su registro permanece PENDIENTE. |

### 5.3 Diferencias funcionales importantes

- Recibir no es lo mismo que atender.
- Derivar no es lo mismo que confirmar recepción.
- Observar no es necesariamente devolver.
- Atender no es automáticamente cerrar.
- Cerrar no es automáticamente archivar.
- Reabrir no elimina el cierre anterior.
- Rectificar no significa modificar o borrar el historial.
- Incorporar un adjunto no implica que el requisito haya sido aprobado.
- Consultar el historial no cambia el estado del trámite.
## 6. Estados propuestos

Todos los estados de esta sección son PROPUESTOS y permanecen PENDIENTES de validación institucional.

### 6.1 Diferencia entre acción y estado

Una acción representa algo que un actor realiza, por ejemplo recibir, derivar, observar o atender. Un estado representa la situación en la que queda el trámite después de una acción. La derivación y la devolución pueden ser acciones cuyo resultado sea que el trámite quede pendiente de recepción en otra área. Los nombres oficiales de los estados y sus transiciones permanecen PENDIENTES. El estado actual debe poder determinarse sin eliminar el historial de estados y movimientos anteriores. La definición técnica de la máquina de estados corresponde posteriormente a B_GERIC.

### 6.2 Catálogo preliminar de estados

| Estado propuesto | Significado funcional | Acción que podría originarlo | Condición para continuar | Validación |
| --- | --- | --- | --- | --- |
| Registrado | El trámite o expediente ya posee su identificación y número de registro. RutaDoc lo recibe como referencia inicial. | Registro inicial realizado por el módulo correspondiente. | Referencia disponible para iniciar o continuar el seguimiento. | Su creación pertenece al módulo del Grupo 2. |
| Pendiente de recepción | El trámite fue enviado o derivado, pero todavía no existe confirmación del área destinataria. | Derivación o devolución PROPUESTA. | Confirmación de recepción por el área destinataria, si corresponde. | Solo se utilizaría si la institución confirma la recepción manual. |
| Recibido | El área o responsable confirmó que recibió el trámite. No significa que ya fue revisado o atendido. | Recepción PROPUESTA. | Revisión, observación, derivación o atención, según reglas futuras. | Responsables y condiciones PENDIENTES. |
| En revisión | El trámite está siendo evaluado para decidir su siguiente acción. | Recepción o inicio de revisión PROPUESTO. | Decisión sobre atención, observación, devolución o derivación. | Responsables y plazos PENDIENTES. |
| Observado | Se identificó información, requisito o documento que necesita corrección. | Observación PROPUESTA. | Corrección o acción posterior que permita reanudar el trámite. | Debe conservar el motivo; debe definirse quién corrige y cómo se reanuda el trámite. |
| Devuelto | El trámite fue enviado nuevamente a un origen o destino anterior. | Devolución PROPUESTA. | Recepción o acción posterior en el destino correspondiente. | “Devuelto” podría ser una acción en lugar de un estado; su uso definitivo permanece PENDIENTE. |
| En atención | Se está ejecutando la actividad necesaria para preparar la respuesta o resultado. No significa que el trámite haya finalizado. | Inicio de atención PROPUESTO. | Registro de atención, observación, derivación u otra acción validada. | Condiciones y responsables PENDIENTES. |
| Atendido | Se registró una respuesta o resultado para el propósito del trámite. No significa automáticamente cerrado o archivado. | Atención PROPUESTA. | Cierre u otra acción posterior, si las reglas lo permiten. | Relación con cierre o archivo PENDIENTE. |
| Cerrado | El flujo activo terminó después de cumplir las condiciones definidas. | Cierre PROPUESTO. | Reapertura autorizada, si corresponde. | Condiciones y permisos de cierre PENDIENTES. |
| Reabierto | Un trámite cerrado volvió al flujo activo mediante una acción autorizada. | Reapertura PROPUESTA. | Nueva revisión, atención u otra acción validada. | Deben conservarse el cierre anterior y el motivo de reapertura; causales y permisos PENDIENTES. |

### 6.3 Estados que no deben asumirse

- “Derivado” podría considerarse una acción o un estado; debe validarse con el profesor.
- “Devuelto” también podría ser una acción y no un estado independiente.
- “Archivado” no debe incorporarse como estado oficial ni relacionarse con un plazo de 48 horas sin confirmación.
- “Rechazado”, “anulado”, “subsanado”, “firmado” o estados similares no deben agregarse como oficiales sin validación.
- Una observación no debe cerrar automáticamente el trámite.
- Una atención no debe generar cierre automático.
- Una reapertura no debe borrar el estado cerrado anterior.

### 6.4 Principio de conservación histórica

Cada cambio de estado debe quedar asociado a la acción que lo produjo. Debe conservarse quién realizó el cambio, cuándo, en qué área y por qué. El estado actual no sustituye el historial. Una rectificación debe agregarse como un nuevo evento. La forma técnica de almacenar y calcular el estado actual será definida posteriormente por B_GERIC y B_JHASY.
## 7. Flujo sencillo

### 7.1 Descripción del escenario

El flujo sencillo es una PROPUESTA de recorrido normal para un trámite que puede ser revisado y atendido por la primera área, sin derivarlo a otra área. El expediente ya fue registrado por el módulo del Grupo 2; RutaDoc recibe únicamente su referencia y no vuelve a crearlo. Si faltan requisitos, existe una observación o se necesita la intervención de otra área, el proceso abandona este flujo sencillo y continúa mediante un flujo excepcional o jerárquico. Las áreas, cargos, permisos, plazos y estados exactos permanecen PENDIENTES de validación institucional.

### 7.2 Precondiciones propuestas

1. El expediente cuenta con código o identificación y número de registro.
2. Existe una referencia al usuario solicitante.
3. Se conoce el tipo de documento o trámite.
4. Los requisitos y adjuntos presentados pueden consultarse.
5. Existe una primera área o responsable de recepción propuesto.
6. El usuario que realiza una acción debe contar con permisos, aunque estos todavía no estén definidos oficialmente.

### 7.3 Flujo paso a paso

| Paso | Responsable propuesto | Situación inicial | Acción o decisión | Resultado | Información conservada | Validación |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Identificación del trámite | Personal encargado de recepción, como PROPUESTA. | Existe la referencia de un expediente registrado. | Consultar la referencia y verificar que tenga código o identificación y número de registro; no crear nuevamente el expediente. | Trámite identificado para continuar el recorrido. | Referencia del expediente, actor que consulta, fecha y hora cuando corresponda. | Mecanismo de consulta PENDIENTE. |
| 2. Recepción inicial | Personal encargado de recepción, como PROPUESTA. | Trámite identificado. | Confirmar la recepción inicial. | El trámite queda PROPUESTO como **Recibido**. | Responsable, fecha y hora, área relacionada y acción de recepción. | Responsable y mecanismo de confirmación PENDIENTES. |
| 3. Revisión | Usuario interno de la primera área, como PROPUESTA. | Trámite PROPUESTO como Recibido. | Revisar la información, requisitos y adjuntos disponibles. | El trámite queda PROPUESTO como **En revisión**. | Responsable, fecha y hora, área, referencias revisadas y acción realizada. | Criterios y plazos PENDIENTES. |
| 4. Decisión sobre integridad | Usuario interno o responsable de la primera área, como PROPUESTA. | Trámite PROPUESTO como En revisión. | Determinar si existe información suficiente para continuar. | Si falta información, pasa al flujo excepcional de observación; si está completa, continúa. | Decisión, responsable, fecha y hora, motivo u observación cuando corresponda. | Requisitos y condiciones PENDIENTES. |
| 5. Decisión sobre competencia | Responsable de la primera área, como PROPUESTA. | Información suficiente para continuar. | Determinar si la primera área puede atender el trámite. | Si requiere otra área, pasa al flujo jerárquico; si puede atenderlo, continúa en la misma área. | Decisión, responsable, fecha y hora, área y motivo cuando corresponda. | Competencias y destinos PENDIENTES. |
| 6. Inicio de atención | Usuario responsable de la atención, como PROPUESTA. | La primera área puede atender el trámite. | Comenzar a preparar la respuesta o resultado. | El estado PROPUESTO sería **En atención**. | Responsable, fecha y hora, área y actividad iniciada. | Responsables y condiciones PENDIENTES. |
| 7. Registro de la atención | Usuario responsable de la atención, como PROPUESTA. | Trámite PROPUESTO como En atención. | Registrar la respuesta, el resultado o la referencia al documento emitido. | El estado PROPUESTO sería **Atendido**. | Responsable, fecha y hora, resultado y referencia al documento emitido cuando corresponda. | Contenido y criterios de atención PENDIENTES. |
| 8. Disponibilidad de la respuesta | Usuario responsable de la atención o mecanismo definido posteriormente. | Atención registrada. | Relacionar la respuesta con el trámite para que el usuario solicitante pueda consultarla o recibirla. | Respuesta disponible en la forma que se defina. | Referencia de la respuesta, fecha y hora de disponibilidad cuando corresponda. | Mecanismo de notificación PENDIENTE. |
| 9. Cierre propuesto | Responsable autorizado según reglas futuras. | Atención registrada y sin acciones pendientes conocidas. | Registrar el cierre si las reglas institucionales lo permiten. | El estado PROPUESTO sería **Cerrado**. | Movimiento de atención y movimiento de cierre diferenciados, con responsable, fecha y hora. | Acción, condiciones y permisos de cierre PENDIENTES. |

### 7.4 Secuencia resumida

```text
Registrado → recepción → Recibido → revisión → En revisión → atención → En atención → Atendido → cierre propuesto → Cerrado
```

- “Pendiente de recepción” podría existir antes de “Recibido” si se confirma esa regla.
- Las palabras en mayúscula representan estados PROPUESTOS.
- Las palabras recepción, revisión, atención y cierre representan acciones o actividades.
- La secuencia no es una máquina de estados definitiva.

### 7.5 Condición de finalización

El flujo sencillo termina cuando se registró la atención o respuesta, la respuesta quedó relacionada con el expediente y no existen acciones pendientes conocidas. El cierre se registra solamente si esa acción y sus condiciones son aprobadas. Todo el recorrido permanece disponible en el historial.

### 7.6 Ejemplo ficticio

**EJEMPLO.** Un usuario presenta una solicitud ficticia. La primera área la recibe y comprueba que la información está completa. La misma área prepara y registra la respuesta. La atención queda disponible para el solicitante. El cierre se registra únicamente como acción PROPUESTA, si las condiciones futuras lo permiten.
## 8. Flujo jerárquico

### 8.1 Descripción del escenario

El flujo jerárquico es una PROPUESTA para trámites que necesitan varias revisiones, autorizaciones, firmas o decisiones antes de recibir atención final. Un área puede recibir y revisar el trámite, pero determinar que otra área debe continuar. Cada derivación genera un nuevo movimiento y una nueva recepción en el área destinataria; por ello, el ciclo de derivación, recepción y revisión puede repetirse. No se conoce todavía la cantidad oficial de niveles o áreas, y la ruta secuencial se utiliza solamente como PROPUESTA. La posibilidad de enviar un expediente a varias áreas simultáneamente permanece PENDIENTE. Todas las áreas, cargos, permisos, firmas y jerarquías concretas permanecen PENDIENTES.

### 8.2 Precondiciones propuestas

1. El expediente ya está registrado e identificado.
2. Existe una referencia al usuario solicitante.
3. El trámite fue recibido por una primera área.
4. El historial anterior puede consultarse.
5. El usuario responsable puede consultar los destinos disponibles.
6. Existe una justificación para derivar.
7. El destino y los permisos deben validarse antes de registrar la derivación.
8. Los documentos y adjuntos necesarios pueden consultarse mediante sus referencias.

### 8.3 Flujo paso a paso

| Paso | Responsable propuesto | Situación inicial | Acción o decisión | Resultado | Información conservada | Validación |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Recepción y revisión inicial | Usuario autorizado de la primera área, como PROPUESTA. | Expediente registrado y disponible para la primera área. | Confirmar la recepción y revisar el trámite. | Trámite recibido y revisado inicialmente. | Responsable, fecha, hora, área, referencia del expediente y movimiento de recepción. | Responsables y reglas PENDIENTES. |
| 2. Decisión de derivación | Responsable de la primera área, como PROPUESTA. | Revisión inicial realizada. | Determinar que el trámite requiere intervención de otra área y registrar el motivo. | Decisión de derivar documentada. | Responsable, fecha, hora, área, decisión y motivo. | Competencia y permisos PENDIENTES. |
| 3. Selección del destino | Responsable que propone la derivación, como PROPUESTA. | Existe una justificación para derivar. | Proponer un área destinataria válida y evitar seleccionar un área inexistente o no autorizada. | Destino propuesto para la derivación. | Origen, destino propuesto, responsable, fecha, hora y motivo. | Reglas de selección PENDIENTES. |
| 4. Registro de la derivación | Responsable autorizado según reglas futuras. | Destino propuesto y validado conforme a reglas futuras. | Registrar origen, destino, responsable, fecha, hora y motivo. | Nuevo movimiento de derivación; el estado PROPUESTO podría ser **Pendiente de recepción**. | Movimiento completo de derivación y todos los movimientos anteriores sin modificación. | Estado y validaciones PENDIENTES. |
| 5. Envío pendiente de confirmación | Ruta funcional PROPUESTA; actor de confirmación aún PENDIENTE. | Derivación registrada. | Relacionar el trámite con el destino. | Trámite pendiente de confirmación por el destino. | Referencia de la derivación, origen, destino, responsable y fecha/hora. | La derivación no se considera recibida hasta que el área destinataria confirme, si esta regla es aprobada. |
| 6. Recepción en el área destinataria | Usuario autorizado del área destinataria, como PROPUESTA. | Trámite relacionado con el destino y, si aplica, pendiente de confirmación. | Confirmar la recepción. | Nuevo movimiento distinto de la derivación; el estado PROPUESTO sería **Recibido**. | Responsable, fecha, hora, área destinataria y referencia a la derivación previa. | Mecanismo de recepción PENDIENTE. |
| 7. Revisión en el área destinataria | Usuario interno o responsable del área destinataria, como PROPUESTA. | Trámite PROPUESTO como Recibido en el destino. | Consultar historial, motivo de derivación, requisitos, documentos y decisiones anteriores. | El estado PROPUESTO sería **En revisión**. | Responsable, fecha, hora, área, referencias consultadas y decisión posterior. | Criterios y plazos PENDIENTES. |
| 8. Decisión sobre la siguiente acción | Responsable del área destinataria, como PROPUESTA. | Revisión en el destino completada. | Decidir si completa su intervención, si falta información, si requiere otra área o si el destino fue incorrecto. | Continúa la intervención; pasa a observación o devolución; registra una nueva derivación y repite el ciclo; o pasa al flujo excepcional, según corresponda. | Decisión, responsable, fecha, hora, área, motivo y referencias pertinentes. | Reglas de decisión PENDIENTES. |
| 9. Intervención o decisión del área | Responsable del área destinataria, como PROPUESTA. | El área puede realizar su intervención. | Registrar la revisión, autorización, firma o resultado correspondiente solamente como PROPUESTA. | Intervención registrada para continuar o resolver el trámite. | Responsable, fecha, hora, área, acción, resultado y observación cuando corresponda. | Acciones oficiales PENDIENTES. |
| 10. Nueva derivación, cuando corresponda | Responsable que identifica la necesidad de otra intervención, como PROPUESTA. | La intervención actual no completa el proceso. | Volver a los pasos de selección, derivación y recepción. | Nuevo ciclo hacia otra área o responsable. | Cada repetición conserva su propio responsable, origen, destino, fecha, hora y motivo. | Límites y reglas PENDIENTES. |
| 11. Atención final | Área competente y usuario responsable de la atención, como PROPUESTA. | Todas las intervenciones requeridas han sido registradas. | Registrar la respuesta o resultado final. | El estado PROPUESTO sería **Atendido**. | Responsable, fecha, hora, resultado y referencia al documento emitido cuando corresponda. | Criterios de competencia y atención PENDIENTES. |
| 12. Disponibilidad de la respuesta | Usuario responsable o mecanismo definido posteriormente. | Atención final registrada. | Relacionar la respuesta con el trámite para el usuario solicitante. | Respuesta disponible en la forma que se defina. | Referencia de la respuesta y fecha/hora de disponibilidad cuando corresponda. | Mecanismo de notificación PENDIENTE. |
| 13. Cierre propuesto | Responsable autorizado según reglas futuras. | Atención final registrada y sin acciones pendientes conocidas. | Registrar el cierre únicamente si las reglas lo permiten. | Movimiento de cierre separado de la atención. | Responsable, fecha, hora, motivo o resultado y referencia a la atención previa. | Condiciones y permisos PENDIENTES. |

### 8.4 Ciclo de derivación

```text
Recibido → revisión → decisión de derivar → derivación → Pendiente de recepción → recepción en destino → Recibido → nueva revisión
```

- El ciclo puede repetirse tantas veces como el trámite lo requiera, pero los límites institucionales permanecen PENDIENTES.
- Cada vuelta debe crear nuevos movimientos.
- No se sobrescriben origen, destino, responsable ni estado anteriores.
- Deben evitarse ciclos infinitos o derivaciones repetidas, aunque la regla exacta será definida posteriormente.
- No se asumirá una ruta paralela hasta que la institución confirme si un trámite puede estar en varias áreas simultáneamente.

### 8.5 Condición de finalización

El flujo jerárquico termina cuando todas las intervenciones requeridas fueron registradas, el área competente registró la atención o respuesta final y la respuesta quedó relacionada con el expediente. No deben existir derivaciones, observaciones o decisiones conocidas pendientes. El cierre se registra únicamente si sus reglas son aprobadas. El historial debe permitir reconstruir todas las áreas recorridas en orden cronológico.

### 8.6 Ejemplo ficticio

**EJEMPLO.** Área A recibe y revisa un trámite ficticio. Área A registra el motivo y deriva hacia Área B. Área B confirma la recepción, consulta el historial y revisa el trámite. Como Área B necesita una autorización adicional, deriva hacia Área C. Área C recibe, registra su intervención y devuelve o continúa el proceso según la PROPUESTA aplicable. Finalmente, el área competente registra la atención. Todo el recorrido —incluidas las recepciones, derivaciones, intervenciones y decisiones— permanece conservado.
## 9. Flujos alternativos y excepcionales

### 9.1 Principio general

Una excepción ocurre cuando una acción no puede continuar de la forma esperada. No debe eliminar ni sobrescribir el historial anterior: cuando corresponda, debe conservarse qué ocurrió, quién intervino, cuándo, en qué área, qué acción se intentó y cuál fue el resultado. No todo intento fallido debe convertirse automáticamente en un movimiento oficial; la diferencia entre historial funcional y auditoría técnica permanece PENDIENTE. Después de resolver la excepción, el trámite debe continuar desde una situación coherente. Ninguna excepción debe cerrar o archivar automáticamente el trámite sin una regla institucional confirmada.

### 9.2 Casos excepcionales

| Caso excepcional | Detección | Responsable propuesto | Respuesta funcional propuesta | Resultado o estado propuesto | Información que debe conservarse | Validación |
| --- | --- | --- | --- | --- | --- | --- |
| Requisitos o información incompleta | Durante la revisión. | Usuario interno o responsable que revisa. | Registrar una observación con el detalle de lo faltante. | **Observado** PROPUESTO; puede continuar al registrarse la corrección. | Actor, fecha, hora, área, acción, motivo y resultado. | Reglas de corrección PENDIENTES. |
| Adjunto faltante o inválido | Falta un documento o no cumple requisitos. | Usuario que revisa, como PROPUESTA. | Registrar observación y referencia correspondiente. | Observación o resultado PROPUESTO según reglas futuras. | Referencia del adjunto, actor, fecha, hora, área, motivo y resultado. | Validación del archivo corresponde al Grupo 5; formatos y criterios PENDIENTES. |
| Área de destino inexistente o inactiva | Se intenta derivar hacia un destino inválido. | Usuario que propone la derivación. | Rechazar la acción y solicitar un destino válido. | Derivación no completada; se conserva el estado anterior. | Acción intentada, actor, fecha, hora, origen, destino propuesto, motivo y resultado cuando la auditoría lo permita. | Validación de destinos y auditoría PENDIENTES. |
| Usuario sin autorización | Se intenta recibir, derivar, observar, atender, cerrar o reabrir sin permiso. | Usuario que intenta la acción; control de acceso PROPUESTO. | Impedir la acción. | Estado anterior conservado. | Acción intentada, actor, fecha, hora, área, motivo y resultado si se aprueba su registro. | Registro del intento en auditoría PENDIENTE. |
| Responsable ausente | El trámite no puede continuar con el responsable previsto. | Responsable del área o alternativa autorizada, como PROPUESTA. | Reasignar, escalar o derivar hacia otro responsable autorizado. | Continuidad PROPUESTA mediante una alternativa autorizada. | Actor previsto y alternativo, fecha, hora, área, acción, motivo y resultado. | Reglas de reemplazo y plazos PENDIENTES. |
| Derivación duplicada | Ya existe una derivación equivalente hacia el mismo destino. | Usuario que intenta derivar. | Impedir el duplicado o solicitar confirmación según reglas futuras. | No crear un segundo movimiento idéntico sin justificación. | Derivación existente, acción intentada, actor, fecha, hora, áreas, motivo y resultado. | Criterio de equivalencia PENDIENTE. |
| Derivación hacia un área incorrecta | El destino determina que no le corresponde atender. | Responsable del área destinataria, como PROPUESTA. | Registrar devolución, observación o nueva derivación con motivo. | Retorno o redirección PROPUESTA hacia una situación válida. | Movimiento original, actor, fecha, hora, origen, destino, motivo y resultado posterior. | Reglas de competencia y destino PENDIENTES. |
| Derivación rechazada por el destinatario | El destinatario no acepta la recepción por una causa justificada. | Usuario autorizado del destino, como PROPUESTA. | Conservar la derivación y registrar el rechazo. | PENDIENTE definir si vuelve al origen o pasa a otra área. | Derivación, rechazo, actor, fecha, hora, área, motivo y resultado. | Tratamiento posterior PENDIENTE. |
| Devolución del trámite | El trámite vuelve a un área o responsable anterior. | Responsable autorizado según reglas futuras. | Registrar un nuevo movimiento con origen, destino y justificación. | Devolución PROPUESTA; movimientos anteriores conservados. | Actor, fecha, hora, origen, destino, acción, motivo y resultado. | Causas y permisos PENDIENTES. |
| Cierre anticipado o indebido | Se intenta cerrar sin atención, respuesta o con acciones pendientes. | Usuario que intenta cerrar. | Rechazar el cierre. | Estado anterior conservado. | Acción intentada, actor, fecha, hora, área, motivo y resultado cuando corresponda. | Condiciones oficiales de cierre PENDIENTES. |
| Reapertura no autorizada | Se intenta reabrir sin permiso o justificación. | Usuario que intenta reabrir. | Impedir la acción. | El cierre anterior permanece vigente. | Intento, actor, fecha, hora, área, motivo y resultado si se aprueba auditoría. | Registro del intento y permisos PENDIENTES. |
| Trámite sin respuesta | Permanece sin atención o supera un plazo todavía no definido. | Responsable del seguimiento, como PROPUESTA. | Generar alerta, revisión o escalamiento. | Seguimiento PROPUESTO sin cierre ni archivo automático. | Referencia, actor, fecha, hora, área, situación detectada, acción y resultado. | Plazos y responsables PENDIENTES. |
| Movimientos simultáneos incompatibles | Dos usuarios intentan acciones contradictorias sobre el mismo trámite. | Usuarios involucrados; resolución funcional PROPUESTA. | Aceptar solo una secuencia coherente. | Resultado aceptado y resultado rechazado por evaluar para auditoría. | Acciones, actores, fechas, horas, áreas, estado previo, motivo y resultado. | Resolución técnica posterior corresponde a B_GERIC y B_JHASY. |
| Error detectado en un movimiento ya registrado | Se identifica información incorrecta después del registro. | Responsable autorizado según reglas futuras. | Crear una rectificación relacionada sin editar ni eliminar silenciosamente el movimiento original. | Nuevo evento PROPUESTO relacionado con el anterior. | Movimiento anterior, actor, fecha, hora, área, motivo, corrección y resultado. | Acción oficial y permisos PENDIENTES. |
| Falla al poner la respuesta a disposición del solicitante | La atención fue registrada, pero el solicitante no puede consultar o recibir la respuesta. | Responsable de atención o mecanismo definido posteriormente. | Conservar la atención y registrar o reintentar la disponibilidad o notificación. | Atención conservada; disponibilidad pendiente de resolver. | Referencia de atención, actor, fecha, hora, área, falla, acción correctiva y resultado. | Mecanismo de disponibilidad PENDIENTE. |

### 9.3 Secuencia general de recuperación

1. Detectar la excepción.
2. Impedir una transición incoherente cuando corresponda.
3. Conservar el historial anterior.
4. Registrar el motivo permitido.
5. Determinar la corrección necesaria.
6. Autorizar la acción correctiva.
7. Crear un nuevo movimiento cuando corresponda.
8. Reanudar el flujo sencillo o jerárquico desde una situación válida.
## 10. Matriz funcional

Las acciones y estados de esta matriz permanecen sujetos a validación. “Movimiento” es el registro histórico generado y no necesariamente una acción del usuario. La matriz no es una máquina de estados definitiva ni un modelo de base de datos.

| Acción propuesta | Responsable propuesto | Precondición | Resultado funcional | Siguiente estado propuesto | Información histórica conservada | Validación |
| --- | --- | --- | --- | --- | --- | --- |
| Recepción | Personal encargado de recepción o usuario del área destinataria. | Referencia del trámite disponible. | Confirmación de recepción inicial o en destino. | **Recibido** PROPUESTO. | Actor, fecha, hora, área, acción, estado anterior y resultado. | Responsable y mecanismo PENDIENTES. |
| Inicio de revisión | Usuario interno o responsable del área. | Trámite recibido. | Inicio de evaluación de información, requisitos y adjuntos. | **En revisión** PROPUESTO. | Actor, fecha, hora, área, acción y referencias consultadas. | Criterios y plazos PENDIENTES. |
| Observación | Usuario que revisa o atiende. | Problema, requisito faltante o información por corregir identificada. | Observación registrada con motivo. | **Observado** PROPUESTO. | Actor, fecha, hora, área, acción, motivo, estado anterior y resultado. | Reglas de observación PENDIENTES. |
| Incorporación de adjuntos | Usuario autorizado según reglas futuras. | Documento o adjunto referenciable disponible. | Relación del adjunto con el trámite. | Estado sin cambio automático PROPUESTO. | Actor, fecha, hora, área, acción y referencia del adjunto. | Tipos y requisitos PENDIENTES; archivo corresponde al Grupo 5. |
| Derivación | Responsable autorizado según reglas futuras. | Motivo, origen y destino propuesto válidos. | Envío registrado hacia otra área. | **Pendiente de recepción** PROPUESTO, si se aprueba esa regla. | Actor, fecha, hora, origen, destino, acción, motivo, estado anterior y resultado. | Permisos y reglas de destino PENDIENTES. |
| Confirmación de recepción en destino | Usuario autorizado del área destinataria. | Derivación previa registrada. | Confirmación separada de la derivación. | **Recibido** PROPUESTO. | Actor, fecha, hora, área, acción y referencia al movimiento previo. | Regla de confirmación PENDIENTE. |
| Devolución | Responsable autorizado según reglas futuras. | Causa justificada y destino anterior o válido. | Nuevo movimiento de retorno. | **Devuelto** PROPUESTO o resultado pendiente de definir. | Actor, fecha, hora, origen, destino, acción, motivo y resultado. | Causas y permisos PENDIENTES. |
| Inicio de atención | Usuario encargado de atención. | Área competente y elementos necesarios disponibles. | Inicio de preparación de respuesta o resultado. | **En atención** PROPUESTO. | Actor, fecha, hora, área, acción y estado anterior. | Responsables y condiciones PENDIENTES. |
| Registro de atención | Usuario encargado de atención. | Atención preparada. | Respuesta, resultado o referencia al documento emitido registrada. | **Atendido** PROPUESTO. | Actor, fecha, hora, área, acción, resultado y referencia documental cuando corresponda. | Contenido y criterios PENDIENTES. |
| Cierre | Responsable autorizado según reglas futuras. | Atención registrada y sin acciones pendientes conocidas. | Finalización propuesta del flujo activo. | **Cerrado** PROPUESTO. | Actor, fecha, hora, área, acción, motivo, estado anterior y resultado. | Condiciones y permisos PENDIENTES. |
| Reapertura | Responsable autorizado según reglas futuras. | Cierre anterior y motivo de reapertura. | Retorno del trámite al flujo activo sin borrar el cierre anterior. | **Reabierto** PROPUESTO. | Actor, fecha, hora, área, acción, motivo, referencia al cierre y resultado. | Causales y permisos PENDIENTES. |
| Rectificación | Responsable autorizado según reglas futuras. | Error identificado en un movimiento previo. | Nuevo evento relacionado que corrige sin eliminar el original. | Estado definido por la acción correctiva, PENDIENTE. | Actor, fecha, hora, área, acción, motivo, movimiento original y resultado. | Existencia como acción y permisos PENDIENTES. |
| Consulta de trazabilidad | Actor con acceso de consulta según reglas futuras. | Referencia del trámite y autorización aplicable. | Visualización del estado actual y del historial completo. | No modifica el estado. | No crea movimiento funcional; una auditoría de consultas permanece PENDIENTE. | Acceso y auditoría PENDIENTES. |

- Una derivación puede producir **Pendiente de recepción**.
- Una recepción puede producir **Recibido**.
- Una observación puede producir **Observado**.
- El inicio de atención puede producir **En atención**.
- La atención puede producir **Atendido**.
- El cierre puede producir **Cerrado**.
- La reapertura puede producir **Reabierto**.
- La consulta no modifica el estado y la rectificación no elimina el movimiento original.
## 11. Decisiones y supuestos

Ninguno de los supuestos de esta sección debe presentarse como decisión institucional oficial.

### 11.1 Confirmado por la explicación disponible

La siguiente información procede de la explicación de clase y todavía debe contrastarse con la información institucional:

- Existe un ciclo general de recepción, seguimiento, posible derivación y atención.
- Un trámite sencillo podría atenderse en la primera área.
- Un trámite complejo podría recorrer varias áreas.
- El proceso debe terminar con una respuesta o resultado para el solicitante.
- Cada integrante debe publicar su aporte en su rama personal.

### 11.2 Propuesto por el análisis

- Separar derivación y recepción en destino.
- Conservar el historial cronológico sin sobrescribir movimientos.
- Diferenciar atención, cierre y archivo.
- Utilizar una ruta secuencial mientras no se confirmen rutas paralelas.
- Registrar correcciones como nuevos movimientos.
- Mantener referencias hacia usuarios, áreas, expedientes, documentos y adjuntos sin duplicar sus datos.

### 11.3 Pendiente de confirmación

- Significado de las letras y acciones mostradas en clase.
- Nombres oficiales de acciones y estados.
- Áreas y jerarquías reales.
- Roles y permisos.
- Plazos.
- Firmas y autorizaciones.
- Reglas de cierre, archivo y reapertura.
- Derivaciones paralelas.
- Notificación al solicitante.
- Tratamiento de responsables ausentes.
- Registro de intentos fallidos o no autorizados.
## 12. Preguntas pendientes

### Acciones y estados

1. ¿Cuáles son los nombres oficiales y el significado de las acciones o letras mostradas en recepción del trámite?
2. ¿Qué diferencia institucional existe entre recibir, adjuntar, observar, devolver, derivar, atender, cerrar y archivar?
3. ¿Qué estados oficiales existen?
4. ¿Qué transiciones están permitidas desde cada estado?
5. ¿Cómo se registra una devolución, corrección o reapertura?

### Usuarios y permisos

1. ¿Quién puede derivar un expediente?
2. ¿Qué permisos dependen del rol, cargo o área?
3. ¿La recepción del área destinataria debe confirmarse manualmente?

### Áreas y jerarquías

1. ¿Qué ocurre mientras una derivación está pendiente de recepción?
2. ¿Un expediente puede enviarse a varias áreas simultáneamente?
3. ¿Existen plazos, prioridades, firmas o niveles jerárquicos obligatorios?
4. ¿Qué ocurre si un responsable está ausente?

### Atención y cierre

1. ¿Qué documento constituye la atención final?
2. ¿Cómo se comunica la respuesta al solicitante?
3. ¿Cuándo un trámite se considera atendido, cerrado o archivado?

### Excepciones y auditoría

1. ¿Qué acciones deben quedar visibles en el historial y cuáles solo en auditoría técnica?
## 13. Fuentes consultadas

### Fuentes externas verificadas

| Institución o autor | Título | Enlace directo | Concepto utilizado | Explicación con palabras propias | Fecha de consulta |
| --- | --- | --- | --- | --- | --- |
| W3C | PROV-DM: The PROV Data Model | https://www.w3.org/TR/prov-dm/ | Procedencia, actividades, agentes, responsabilidad y tiempo. | Sirve como referencia conceptual para justificar que un recorrido puede describir qué actividad ocurrió, quién intervino y en qué momento, sin imponer un diseño de base de datos para RutaDoc. | 2026-08-27 |
| W3C | Constraints of the PROV Data Model | https://www.w3.org/TR/prov-constraints/ | Consistencia, orden de eventos y restricciones de imposibilidad. | Orienta la idea de mantener una secuencia coherente de movimientos y de impedir transiciones incompatibles, sin definir todavía las reglas institucionales concretas. | 2026-08-27 |
| National Institute of Standards and Technology (NIST) | SP 800-92: Guide to Computer Security Log Management | https://csrc.nist.gov/pubs/sp/800/92/final | Gestión de registros, auditoría y responsabilidad. | Aporta una referencia general para distinguir el historial funcional del trámite de los registros técnicos de auditoría y para valorar la conservación de evidencia de eventos. | 2026-08-27 |

### Fuentes internas

| Institución o autor | Título | Enlace directo | Concepto utilizado | Explicación con palabras propias | Fecha de consulta |
| --- | --- | --- | --- | --- | --- |
| Curso / profesor responsable | Apuntes y explicación del profesor | No aplica: fuente interna de clase. | Ciclo general de recepción, seguimiento, posible derivación y atención. | Sustenta el alcance académico inicial; debe contrastarse con información institucional antes de asumir reglas oficiales. | 2026-08-27 |

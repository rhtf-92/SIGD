# Modelo de datos de trazabilidad, recepción, derivación y atención

- Responsable: Geric
- Rama: B_GERIC
- Grupo: Grupo 1 — RutaDoc
- Estado: PROPUESTA PRELIMINAR
- Validación institucional: PENDIENTE

## 1. Propósito

Este documento convierte el análisis funcional aprobado de RutaDoc en una propuesta lógica preliminar para representar la trazabilidad de un trámite. Su propósito es establecer criterios de modelado antes de definir entidades propias, atributos, claves, tipos de datos o decisiones físicas de PostgreSQL.

El modelo deberá ser capaz de:

1. Conservar el historial cronológico completo mediante registros sucesivos que no destruyan las actuaciones anteriores.
2. Identificar conceptualmente, para cada actuación, el actor responsable, la fecha y hora, el área relacionada, la acción realizada y su resultado.
3. Reconstruir recorridos sencillos, jerárquicos y excepcionales, incluidas las repeticiones de recepción, revisión, derivación y retorno que correspondan.
4. Obtener el estado actual sin eliminar ni sustituir los movimientos que explican cómo se alcanzó dicho estado.
5. Servir posteriormente como base lógica para que B_JHASY prepare el SQL y las decisiones físicas de PostgreSQL, sin anticiparlas en este documento.

**CONFIRMADO:** el análisis funcional aprobado exige conservar el recorrido, diferenciar las actuaciones y permitir que el trámite termine con una atención o respuesta. **PROPUESTO:** traducir esas necesidades a un modelo lógico centrado en la trazabilidad histórica. La forma definitiva de implementación permanece **PENDIENTE** de validación técnica e institucional.

## 2. Alcance y límites

### 2.1 Alcance incluido

El modelo considerará como conceptos funcionales **PROPUESTOS** los movimientos asociados con recepción, derivación, devolución, observación, atención, cierre, reapertura y rectificación. También abarcará el historial cronológico y las transiciones necesarias para explicar el paso entre situaciones del trámite, así como las referencias hacia información administrada por otros grupos.

El alcance lógico deberá permitir representar tanto el recorrido sencillo atendido por una primera área como los recorridos jerárquicos con varias derivaciones y los recorridos excepcionales que retornan a una situación válida. Incluir un concepto en este alcance no confirma su nombre institucional, sus responsables, sus permisos ni sus reglas de ejecución.

### 2.2 Límites y exclusiones

Quedan expresamente fuera de este documento:

1. La duplicación de usuarios, áreas, expedientes, documentos, adjuntos, roles o permisos gestionados por otros grupos. RutaDoc conservará únicamente las referencias necesarias para relacionar sus movimientos con dichos conceptos.
2. La elaboración de SQL, migraciones, endpoints, controladores, servicios u otro código de implementación.
3. La adopción como definitivos de nombres institucionales, estados, cargos, permisos, jerarquías o plazos que todavía no han sido confirmados.
4. Las decisiones físicas exclusivas de PostgreSQL, incluidas las formas concretas de almacenamiento, indexación, concurrencia y restricciones técnicas, que corresponderán posteriormente a B_JHASY.
5. La definición de entidades propias, atributos, claves y tipos de datos en estas primeras secciones; las entidades propias se evaluarán recién en la sección 5.

**CONFIRMADO:** RutaDoc necesita relacionarse conceptualmente con otros módulos sin sustituirlos. **PENDIENTE:** acordar con cada grupo los identificadores y contratos de integración que harán posibles esas referencias.

## 3. Principios de modelado

Los siguientes principios son **PROPUESTOS** a partir del análisis funcional aprobado. Orientan el modelo lógico, pero no constituyen todavía reglas institucionales ni decisiones físicas de base de datos.

1. **Historial acumulativo.** Cada movimiento nuevo deberá agregarse al recorrido. Un movimiento anterior no se sobrescribirá ni eliminará para representar un cambio posterior, porque su conservación permite explicar la secuencia completa.
2. **Separación entre acción y estado.** Una acción representa una actuación, mientras que un estado representa la situación resultante del trámite. Sus catálogos y correspondencias definitivas permanecen **PENDIENTES**.
3. **Estado actual controlado.** El estado actual podrá derivarse del historial o mantenerse mediante una proyección controlada y coherente con este. La elección entre ambas alternativas, o una combinación de ellas, queda **PENDIENTE** de evaluación técnica; ninguna deberá destruir el historial.
4. **Referencias externas.** RutaDoc relacionará los movimientos con conceptos administrados por otros grupos mediante referencias acordadas, en lugar de copiar o administrar nuevamente sus datos.
5. **Rectificación no destructiva.** Una corrección deberá registrarse como un movimiento nuevo relacionado con aquel que rectifica. El registro original continuará disponible para preservar la evidencia histórica.
6. **Trazabilidad contextual.** Cada movimiento deberá permitir conocer conceptualmente el actor, el tiempo, el área de origen, el área de destino cuando corresponda y el resultado de la actuación. La obligatoriedad concreta de cada elemento dependerá del tipo de acción y permanece **PENDIENTE**.
7. **Catálogos configurables.** Las acciones y los estados aún no confirmados se tratarán como catálogos conceptuales configurables, evitando fijarlos como reglas institucionales definitivas antes de su validación.
8. **Preparación para movimientos simultáneos.** El modelo deberá permitir controlar actuaciones simultáneas incompatibles y conservar una secuencia coherente. La estrategia concreta de concurrencia, bloqueo o resolución se definirá posteriormente y no se expresa todavía como SQL.
9. **Datos ficticios y privacidad.** El diseño y sus futuros ejemplos emplearán únicamente datos ficticios. No se incorporará información personal real ni documentación institucional sensible.

**EJEMPLO:** si se detecta un error en una derivación ya registrada, la propuesta no modifica silenciosamente ese movimiento; agrega una rectificación relacionada que explica la corrección. Este ejemplo ilustra el principio y no define todavía entidades, atributos ni permisos.

## 4. Dependencias y entidades externas

RutaDoc depende de conceptos administrados por otros grupos. En este documento se consideran entidades externas solo para describir la necesidad de integración; no se definen sus estructuras internas, atributos, claves ni tipos de datos.

### 4.1 Expediente o trámite — Grupo 2

- **Necesidad de referencia:** RutaDoc requiere asociar cada recorrido y sus movimientos con el expediente o trámite al que pertenecen.
- **Consulta conceptual necesaria:** su identificación y los datos mínimos que permitan reconocer el trámite y comprobar que existe antes de iniciar o continuar el seguimiento.
- **Información que no se duplicará:** el registro completo del expediente, sus datos de creación, su numeración administrada y cualquier otra información propia del módulo del Grupo 2.
- **Coordinación pendiente:** el contrato de consulta y el identificador estable que RutaDoc deberá conservar permanecen **PENDIENTES** de acuerdo con el Grupo 2.

### 4.2 Usuario interno o externo — Grupo 4

- **Necesidad de referencia:** RutaDoc debe distinguir al actor —usuario identificable que ejecuta un movimiento— del solicitante —persona que inició el trámite— para atribuir cada actuación y relacionarla con el origen de la solicitud.
- **Consulta conceptual necesaria:** la identificación vigente del actor y la referencia disponible del solicitante, sin asumir que sean la misma persona. Un solicitante externo puede estar registrado o no.
- **Información que no se duplicará:** datos personales, credenciales, mecanismos de autenticación, clasificación interna o externa y demás información administrada por los módulos propietarios.
- **Coordinación pendiente:** el identificador del actor y las condiciones de disponibilidad permanecen **PENDIENTES** con el Grupo 4. La forma de referenciar a un solicitante externo no registrado queda **PENDIENTE** de coordinación conjunta con los Grupos 2 y 4.

### 4.3 Área, rol y permiso — Grupo 3

- **Necesidad de referencia:** RutaDoc necesita relacionar una actuación con el área correspondiente, distinguir origen y destino cuando exista un traslado y consultar si el actor puede realizar la acción solicitada.
- **Consulta conceptual necesaria:** la identificación y vigencia del área, la relación autorizada del usuario con ella y el resultado aplicable de la evaluación de rol o permiso.
- **Información que no se duplicará:** estructura organizacional, nombres oficiales, jerarquías, membresías, catálogos de roles, asignaciones y reglas de permisos administradas por el Grupo 3.
- **Coordinación pendiente:** los identificadores estables, la forma de validar vigencia y autorización, y el contrato de consulta permanecen **PENDIENTES** de coordinación con el Grupo 3.

### 4.4 Documento, formulario, requisito y adjunto — Grupo 5

- **Necesidad de referencia:** RutaDoc debe vincular las actuaciones con los documentos que sustentan una revisión, una observación, una corrección o la respuesta final, cuando corresponda.
- **Consulta conceptual necesaria:** la identificación y disponibilidad del documento, formulario, requisito o adjunto relacionado, además del resultado mínimo necesario para saber si puede ser consultado dentro del trámite.
- **Información que no se duplicará:** archivos, contenido documental, versiones, formularios, definiciones de requisitos, metadatos propios y reglas de administración correspondientes al Grupo 5.
- **Coordinación pendiente:** los identificadores, las relaciones permitidas y los contratos de consulta o disponibilidad permanecen **PENDIENTES** de coordinación con el Grupo 5.

### 4.5 Regla general de integración

**PROPUESTO:** las referencias externas deberán ser estables, verificables y suficientes para reconstruir el contexto de un movimiento sin convertir a RutaDoc en propietario de la información externa. Si una referencia deja de estar vigente, el tratamiento histórico y la información mínima que podrá seguir consultándose quedan **PENDIENTES** de acuerdo entre los grupos. No se adopta en esta sección ningún nombre definitivo de tabla, clave, atributo o tipo de dato.

## 5. Entidades propias propuestas

La arquitectura lógica **PROPUESTA** utiliza `movimiento_tramite` como registro histórico central. Los catálogos describen acciones, estados y relaciones; los detalles amplían únicamente los movimientos que necesitan información específica; las asociaciones conectan movimientos entre sí o con documentos externos; y una proyección opcional facilitaría la consulta del estado actual. Los nombres son técnicos y preliminares, no nombres institucionales confirmados.

### 5.1 `movimiento_tramite`

- **Clasificación:** entidad principal.
- **Propósito:** representar cada evento histórico del recorrido de un trámite de forma acumulativa e inmutable.
- **Información conceptual mínima:** referencia al expediente externo, secuencia, acción, estado anterior cuando corresponda, estado resultante, actor, fecha y hora, contexto de área y resultado u observación aplicable.
- **Problema que resuelve:** permite ordenar las actuaciones, reconstruir recorridos sencillos, jerárquicos y excepcionales, y conocer cómo se alcanzó una situación determinada sin sobrescribir antecedentes.
- **Pertenencia a RutaDoc:** el seguimiento cronológico y la conservación de movimientos constituyen su responsabilidad funcional central; el expediente, el usuario y las áreas continúan administrados externamente.
- **Pendientes:** obligatoriedad exacta del contexto, reglas de secuencia, tratamiento de intentos fallidos y estrategia técnica de inmutabilidad.

### 5.2 `accion_tramite`

- **Clasificación:** catálogo.
- **Propósito:** describir el tipo conceptual de actuación representada por un movimiento.
- **Información conceptual mínima:** código lógico estable, denominación descriptiva, significado y condición de vigencia.
- **Problema que resuelve:** evita codificar la acción como texto libre y permite diferenciar una actuación del estado que produce.
- **Pertenencia a RutaDoc:** las acciones organizan el historial propio del recorrido documentario.
- **Pendientes:** nombres, disponibilidad, permisos y significados oficiales. Recepción, derivación, devolución, observación, atención, cierre, reapertura y rectificación son únicamente valores **PROPUESTOS**, no denominaciones institucionales definitivas.

### 5.3 `estado_tramite`

- **Clasificación:** catálogo.
- **Propósito:** describir las situaciones conceptuales en las que puede quedar un trámite después de un movimiento.
- **Información conceptual mínima:** código lógico estable, denominación descriptiva, significado y condición de vigencia.
- **Problema que resuelve:** permite expresar y consultar resultados de estado sin confundirlos con las acciones realizadas.
- **Pertenencia a RutaDoc:** RutaDoc necesita interpretar la situación resultante para reconstruir y consultar el recorrido.
- **Pendientes:** todos los valores, nombres y alcances oficiales permanecen **PENDIENTES** de validación institucional.

### 5.4 `transicion_estado_tramite`

- **Clasificación:** relación o regla conceptual configurable.
- **Propósito:** relacionar un estado anterior, una acción y un estado resultante permitidos.
- **Información conceptual mínima:** referencias a la acción y a los estados involucrados, junto con la vigencia conceptual de la regla.
- **Problema que resuelve:** permite impedir conceptualmente transiciones incoherentes y explicar qué cambio de situación aplica a un movimiento.
- **Pertenencia a RutaDoc:** la coherencia del historial y de sus cambios de estado forma parte del seguimiento del trámite.
- **Pendientes:** matriz oficial, excepciones, condiciones y posibilidad de una transición inicial sin estado anterior.

### 5.5 `derivacion_tramite`

- **Clasificación:** detalle opcional.
- **Propósito:** ampliar un movimiento que represente una derivación o devolución con su contexto de traslado.
- **Información conceptual mínima:** movimiento principal, referencias externas de área de origen y destino, y motivo.
- **Problema que resuelve:** conserva el recorrido entre áreas sin cargar a todos los movimientos con información que solo aplica a traslados.
- **Pertenencia a RutaDoc:** RutaDoc debe reconstruir por dónde fue enviado el trámite y por qué, sin administrar la definición completa de las áreas.
- **Pendientes:** acciones que utilizarán el detalle, obligatoriedad del motivo y reglas institucionales para elegir origen y destino.

### 5.6 `recepcion_tramite`

- **Clasificación:** detalle opcional.
- **Propósito:** ampliar un movimiento que confirme la recepción inicial o la llegada a un destino.
- **Información conceptual mínima:** movimiento principal y, cuando corresponda, referencia a la derivación que originó la recepción.
- **Problema que resuelve:** diferencia el envío del trámite de la confirmación efectiva de su recepción.
- **Pertenencia a RutaDoc:** la recepción es un hito del recorrido que debe conservarse separado de la derivación.
- **Pendientes:** confirmación manual, actor autorizado y obligación de vincular una derivación previa permanecen **PENDIENTES** de validación institucional.

### 5.7 `observacion_tramite`

- **Clasificación:** detalle opcional.
- **Propósito:** ampliar un movimiento de observación con la razón funcional que impide o condiciona la continuación normal.
- **Información conceptual mínima:** movimiento principal y motivo de la observación.
- **Problema que resuelve:** conserva por qué el trámite necesitó corrección sin confundir observación, devolución o rectificación.
- **Pertenencia a RutaDoc:** la observación modifica el recorrido y debe quedar explicada en su historial.
- **Pendientes:** reglas de obligatoriedad, responsable autorizado y relación posterior con movimientos de corrección o subsanación.

### 5.8 `atencion_tramite`

- **Clasificación:** detalle opcional.
- **Propósito:** ampliar el movimiento que registra la atención final o el resultado que responde al propósito del trámite.
- **Información conceptual mínima:** movimiento principal, resultado conceptual y referencia opcional a la respuesta documental externa.
- **Problema que resuelve:** distingue la atención de la revisión, el cierre y la mera disponibilidad de un documento.
- **Pertenencia a RutaDoc:** el recorrido debe concluir funcionalmente con una atención o respuesta rastreable.
- **Pendientes:** contenido mínimo del resultado, criterio de atención válida y mecanismo de vinculación con el Grupo 5.

Cada detalle `derivacion_tramite`, `recepcion_tramite`, `observacion_tramite` o `atencion_tramite` pertenecerá obligatoriamente a un único `movimiento_tramite`. A su vez, un movimiento solo podrá poseer el detalle compatible con la acción que representa; esta compatibilidad es **PROPUESTA** y su matriz definitiva permanece **PENDIENTE**.

### 5.9 `relacion_movimiento`

- **Clasificación:** asociación entre movimientos.
- **Propósito:** vincular dos movimientos históricos sin alterar ninguno de ellos.
- **Información conceptual mínima:** movimiento de origen, movimiento relacionado y tipo de relación.
- **Problema que resuelve:** representa rectificación, subsanación, confirmación, reapertura u otra relación **PROPUESTA** manteniendo íntegro el evento original.
- **Pertenencia a RutaDoc:** las conexiones entre actuaciones son necesarias para explicar recuperaciones, correcciones y continuaciones del recorrido.
- **Pendientes:** relaciones permitidas, dirección, multiplicidad específica y prevención de vínculos incoherentes o circulares.

### 5.10 `tipo_relacion_movimiento`

- **Clasificación:** catálogo.
- **Propósito:** explicar el significado funcional de cada asociación entre movimientos.
- **Información conceptual mínima:** código lógico estable, denominación descriptiva, significado y vigencia.
- **Problema que resuelve:** evita que el vínculo entre movimientos sea ambiguo o dependa de texto libre.
- **Pertenencia a RutaDoc:** clasifica relaciones internas del historial gestionado por RutaDoc.
- **Pendientes:** catálogo oficial; rectificación, subsanación, confirmación y reapertura son valores **PROPUESTOS** sujetos a validación.

### 5.11 `movimiento_documento`

- **Clasificación:** asociación con una entidad externa.
- **Propósito:** relacionar un movimiento con un documento o adjunto administrado por el Grupo 5.
- **Información conceptual mínima:** movimiento, referencia documental externa y finalidad conceptual del vínculo.
- **Problema que resuelve:** permite reconocer qué documento sustenta, corrige o responde una actuación sin duplicar el archivo ni sus metadatos.
- **Pertenencia a RutaDoc:** RutaDoc conserva el contexto del vínculo dentro del recorrido; el Grupo 5 mantiene la propiedad documental.
- **Pendientes:** identificador externo, finalidades permitidas y reglas de disponibilidad. Sustento, corrección y respuesta son finalidades **PROPUESTAS**.

### 5.12 `estado_actual_tramite`

- **Clasificación:** proyección lógica opcional — **PROPUESTA PENDIENTE DE DECISIÓN**.
- **Propósito:** facilitar la consulta rápida de la última situación válida conocida de un expediente.
- **Información conceptual mínima:** referencia al expediente, último movimiento válido y estado resultante correspondiente.
- **Problema que resuelve:** evita reconstruir todo el historial en cada consulta cuando el volumen o los requisitos de rendimiento lo justifiquen.
- **Pertenencia a RutaDoc:** resume información derivada exclusivamente del historial que RutaDoc administra.
- **Pendientes:** necesidad real, mecanismo de actualización, consistencia y recuperación. Nunca será la fuente histórica principal ni podrá sustituir `movimiento_tramite`.

### 5.13 Cierre y reapertura

**PROPUESTO:** cierre y reapertura pueden modelarse inicialmente como movimientos clasificados por `accion_tramite` y validados mediante `transicion_estado_tramite`. Una reapertura puede vincularse con el cierre anterior mediante `relacion_movimiento`. No es obligatorio crear una entidad de detalle independiente para cada acción cuando esta no posee información específica suficiente que justifique otra estructura. La necesidad de detalles adicionales permanece **PENDIENTE** de validación institucional y del desarrollo posterior del diccionario.

## 6. Relaciones y cardinalidades

Las siguientes cardinalidades son mínimas y **PROPUESTAS**. Expresan necesidades lógicas, no claves físicas ni restricciones SQL.

| Entidad A | Relación | Entidad B | A respecto de B | B respecto de A | Justificación y pendiente |
| --- | --- | --- | --- | --- | --- |
| Expediente externo | registra | `movimiento_tramite` | Un expediente tiene `0..N` movimientos. | Cada movimiento pertenece a `1` expediente. | El expediente puede no tener seguimiento aún o acumular un recorrido completo. |
| `accion_tramite` | clasifica | `movimiento_tramite` | Una acción clasifica `0..N` movimientos. | Cada movimiento tiene `1` acción. | Separa la actuación del evento concreto. |
| `estado_tramite` anterior | antecede a | `movimiento_tramite` | Un estado puede anteceder a `0..N` movimientos. | Cada movimiento tiene `0..1` estado anterior. | Solo el movimiento inicial podría carecer de estado anterior, como **PROPUESTA**. |
| `estado_tramite` resultante | resulta de | `movimiento_tramite` | Un estado puede resultar de `0..N` movimientos. | Cada movimiento tiene `1` estado resultante. | Todo movimiento deja una situación identificable. |
| `movimiento_tramite` | tiene | `derivacion_tramite` | Un movimiento tiene `0..1` detalle. | Cada detalle pertenece a `1` movimiento. | Solo es compatible con una acción de traslado validada. |
| `movimiento_tramite` | tiene | `recepcion_tramite` | Un movimiento tiene `0..1` detalle. | Cada detalle pertenece a `1` movimiento. | Solo es compatible con una acción de recepción validada. |
| `movimiento_tramite` | tiene | `observacion_tramite` | Un movimiento tiene `0..1` detalle. | Cada detalle pertenece a `1` movimiento. | Solo es compatible con una acción de observación validada. |
| `movimiento_tramite` | tiene | `atencion_tramite` | Un movimiento tiene `0..1` detalle. | Cada detalle pertenece a `1` movimiento. | Solo es compatible con una acción de atención validada. |
| `derivacion_tramite` | origina | `recepcion_tramite` | Una derivación origina `0..1` recepción. | Una recepción confirma `0..1` derivación. | La confirmación única y los casos de recepción inicial permanecen **PENDIENTES**. |
| `movimiento_tramite` | se vincula con | `movimiento_tramite` | Un movimiento se vincula con `0..N` movimientos. | Un movimiento puede ser vinculado por `0..N` movimientos. | La asociación `relacion_movimiento` resuelve el vínculo `N:M`. |
| `movimiento_tramite` | se vincula con | Documento externo | Un movimiento se vincula con `0..N` documentos. | Un documento se vincula con `0..N` movimientos. | `movimiento_documento` resuelve el vínculo `N:M`, como **PROPUESTA**. |
| `tipo_relacion_movimiento` | clasifica | `relacion_movimiento` | Un tipo clasifica `0..N` relaciones. | Cada relación tiene `1` tipo. | El catálogo explica el significado del vínculo. |
| Expediente externo | posee | `estado_actual_tramite` | Un expediente posee `0..1` proyección. | Cada proyección corresponde a `1` expediente. | Solo existirá si se aprueba; nunca reemplazará el historial. |
| `transicion_estado_tramite` | es aplicada por | `movimiento_tramite` | Una transición puede aplicarse en `0..N` movimientos. | Cada movimiento puede aplicar `0..1` transición. La referencia permanece opcional mientras la matriz de transiciones sea preliminar; la acción y el estado resultante continúan siendo obligatorios. | **PROPUESTO**; obligatoriedad definitiva **PENDIENTE**. |

Usuarios, áreas, expedientes y documentos aparecen únicamente como referencias externas. No son entidades administradas por RutaDoc ni se duplican dentro de este modelo. Sus identificadores y contratos permanecen **PENDIENTES** de coordinación con los grupos responsables.

## 7. Claves y restricciones conceptuales

Las siguientes restricciones lógicas son **PROPUESTAS** y preliminares. No representan instrucciones `CHECK`, `FOREIGN KEY`, tipos de datos ni código SQL.

1. Cada entidad propia tendrá un identificador estable que permita referenciarla sin depender de una descripción modificable.
2. Cada catálogo tendrá un código lógico único y estable. Sus valores institucionales permanecen **PENDIENTES**.
3. Cada `movimiento_tramite` pertenecerá a un único expediente externo.
4. La combinación conceptual de expediente y número de secuencia será única, como **PROPUESTA**, para ordenar sin ambigüedad el recorrido.
5. Cada movimiento tendrá una sola acción.
6. El estado resultante será obligatorio. El estado anterior podrá faltar únicamente en el movimiento inicial, como **PROPUESTA**.
7. El actor y la fecha-hora de la actuación serán obligatorios para mantener la responsabilidad y el orden cronológico.
8. El origen y el destino serán obligatorios solamente cuando la acción y sus reglas validadas los requieran.
9. Una recepción no podrá confirmar una derivación inexistente.
10. Una derivación no podrá confirmarse más de una vez mientras se mantenga la cardinalidad **PROPUESTA** de una recepción confirmatoria.
11. Cada `atencion_tramite` deberá relacionarse con su movimiento principal.
12. Un cierre no deberá registrarse antes de una atención válida ni mientras existan actuaciones conocidas pendientes. La definición de atención válida permanece **PENDIENTE**.
13. Una reapertura deberá relacionarse con un cierre anterior y no podrá eliminarlo.
14. Una rectificación conservará una relación con el movimiento original que corrige.
15. Los movimientos históricos no se eliminarán ni sobrescribirán como método de corrección; toda corrección aceptada generará un nuevo movimiento relacionado.
16. Las referencias externas deberán ser válidas al registrar la actuación. Su desactivación futura no borrará el historial ni romperá la identidad histórica conservada por RutaDoc.
17. La proyección `estado_actual_tramite`, si se aprueba, deberá corresponder al último movimiento válido y podrá reconstruirse desde el historial.
18. Una transición aplicada deberá ser coherente con el estado anterior, la acción y el estado resultante definidos conceptualmente en `transicion_estado_tramite`.
19. Un detalle opcional no podrá existir sin su movimiento principal ni asociarse con una acción incompatible con su propósito.
20. El control técnico de concurrencia, índices, bloqueos, tipos de datos y restricciones físicas corresponderá posteriormente a B_JHASY.
21. El actor será el usuario identificable que ejecuta el movimiento; su referencia será distinta conceptualmente de la del solicitante que inició el trámite.
22. El solicitante podrá ser interno o externo, y un solicitante externo podrá estar registrado o no. La referencia de un externo no registrado permanece **PENDIENTE** de coordinación con los Grupos 2 y 4.
23. RutaDoc no duplicará datos personales del actor ni del solicitante.

La forma de aplicar técnicamente estas reglas y el tratamiento de excepciones permanecen **PENDIENTES**. Este documento solo establece condiciones conceptuales para orientar el diccionario y el diseño físico posterior.

## 8. Integridad histórica y rectificaciones

Las siguientes reglas son **PROPUESTAS** para preservar la explicación completa del recorrido:

1. `movimiento_tramite` funcionará como historial acumulativo: cada actuación aceptada incorporará un evento nuevo en la secuencia del expediente.
2. Los movimientos registrados no se sobrescribirán ni eliminarán como mecanismo para corregir el recorrido.
3. Una rectificación generará un movimiento nuevo relacionado con el movimiento original mediante `relacion_movimiento`.
4. El movimiento de rectificación conservará conceptualmente quién rectificó, cuándo lo hizo y por qué; la autorización aplicable permanece **PENDIENTE**.
5. Los valores de catálogo utilizados por movimientos históricos no desaparecerán aunque se desactiven para nuevas operaciones. Su descripción histórica deberá seguir siendo interpretable.
6. La desactivación posterior de usuarios, áreas o documentos externos no borrará sus referencias históricas. El contrato para consultar recursos inactivos permanece **PENDIENTE** de coordinación.
7. Una `observacion_tramite` podrá relacionarse con uno o varios movimientos posteriores de corrección o subsanación, como **PROPUESTA**, sin considerarse resuelta automáticamente.
8. Una `recepcion_tramite` se relacionará con la derivación correspondiente cuando la confirmación separada sea exigida institucionalmente.
9. Una reapertura conservará el cierre anterior y registrará un movimiento nuevo relacionado con él.
10. Toda regla de corrección, anulación lógica, vigencia o acceso histórico que la institución aún no haya definido permanece **PENDIENTE**.

La inmutabilidad descrita es lógica. Su implementación física, controles y excepciones corresponderán a una etapa posterior.

## 9. Obtención del estado actual

El historial de `movimiento_tramite` es la fuente de verdad **PROPUESTA**. El estado actual será una interpretación derivada de los movimientos válidos y nunca sustituirá la evidencia histórica.

El orden lógico se determinará mediante la secuencia única dentro de cada expediente. La fecha y hora aportarán evidencia temporal, pero no resolverán por sí solas empates, solicitudes simultáneas o diferencias de precisión. Desde ese orden podrá calcularse el estado actual tomando el estado resultante del último movimiento válido.

Una rectificación posterior puede cambiar la interpretación efectiva del recorrido al relacionarse con el movimiento rectificado, sin borrarlo. Las reglas exactas para determinar qué movimiento prevalece ante varias correcciones permanecen **PENDIENTES**.

`estado_actual_tramite` podrá utilizarse como proyección opcional —**PROPUESTA PENDIENTE DE DECISIÓN**— para acelerar consultas. De aprobarse:

1. Coincidirá con el último movimiento válido y su estado resultante.
2. Podrá reconstruirse completamente desde el historial.
3. No será una segunda fuente de verdad.
4. Ante una contradicción, prevalecerá el historial y la proyección deberá repararse.
5. Su estrategia física de actualización, consistencia y recuperación corresponderá posteriormente a B_JHASY.

Registrar las consultas como eventos de auditoría permanece **PENDIENTE** de decisión institucional. Una consulta normal de trazabilidad no crea una transición ni modifica el estado.

## 10. Matriz preliminar de estados y transiciones

Todos los nombres de acciones y estados de esta matriz son **PROPUESTOS** y no constituyen denominaciones institucionales confirmadas.

| Estado anterior | Acción propuesta | Estado resultante | Condición conceptual | Clasificación | Observación pendiente |
| --- | --- | --- | --- | --- | --- |
| Sin estado local | Registro externo | `Registrado` | El Grupo 2 registra el expediente y proporciona una referencia válida; RutaDoc no realiza el registro original. | **PROPUESTO** | La forma de integración con el Grupo 2 permanece **PENDIENTE**. |
| `Registrado` | Recepción | `Recibido` | Se confirma la recepción inicial por un actor autorizado. | **PROPUESTO** | Responsable y confirmación manual **PENDIENTES**. |
| `Pendiente de recepción` | Recepción | `Recibido` | Existe una derivación previa pendiente y el destino confirma su llegada. | **PROPUESTO** | La recepción manual puede modificar esta transición. |
| `Recibido` | Iniciar revisión | `En revisión` | El actor puede consultar el expediente y comenzar su evaluación. | **PROPUESTO** | Permisos y plazos **PENDIENTES**. |
| `En revisión` | Observar | `Observado` | Se registra un motivo que requiere corrección o información adicional. | **PROPUESTO** | Reglas y responsables **PENDIENTES**. |
| `Observado` | Corrección o incorporación de adjunto | `En revisión` | Se registra un movimiento relacionado que permite retomar la evaluación. | **PROPUESTO** | No implica aprobación automática del requisito. |
| `En revisión` | Derivar | `Pendiente de recepción` | Se identifica destino válido, motivo y autorización aplicable. | **PROPUESTO** | Selección de destino y confirmación **PENDIENTES**. |
| `En revisión` | Devolver | `Pendiente de recepción` | Existe causa justificada y un destino válido de retorno. | **PROPUESTO** | Compite con la alternativa `Devuelto`; solo una podrá aprobarse institucionalmente. |
| `En revisión` | Devolver | `Devuelto` | Existe causa justificada y un destino válido de retorno. | **PENDIENTE** | `Devuelto` podría ser acción y no estado; solo una alternativa podrá aprobarse institucionalmente. |
| `En revisión` | Iniciar atención | `En atención` | El área competente dispone de lo necesario para preparar la respuesta. | **PROPUESTO** | Competencia y condiciones **PENDIENTES**. |
| `En atención` | Atender y registrar respuesta | `Atendido` | Se registra el resultado y, cuando corresponda, su respuesta documental. | **PROPUESTO** | Criterio de atención válida **PENDIENTE**. |
| `Atendido` | Cerrar | `Cerrado` | Existe atención válida y no se conocen actuaciones pendientes. | **PROPUESTO** | Atención no implica cierre automático; permisos **PENDIENTES**. |
| `Cerrado` | Reabrir | `Reabierto` | Existe motivo y autorización, conservando el cierre anterior. | **PROPUESTO** | Causales y permisos **PENDIENTES**. |
| `Reabierto` | Iniciar revisión | `En revisión` | El nuevo movimiento reactiva el recorrido para una evaluación posterior. | **PROPUESTO** | Punto exacto de reanudación **PENDIENTE**. |
| Estado aplicable | Rectificar | Estado determinado por la corrección | La rectificación se relaciona con el movimiento original sin eliminarlo. | **PENDIENTE** | El cálculo del estado efectivo requiere reglas validadas. |

La recepción manual puede modificar las primeras transiciones. La atención no produce cierre automático, la rectificación no elimina estados anteriores del historial y la consulta no constituye una transición. Todos los permisos, responsables, plazos y excepciones permanecen **PENDIENTES** de validación institucional.

## 11. Consistencia y movimientos simultáneos

Las siguientes garantías lógicas son **PROPUESTAS**; no definen todavía transacciones ni restricciones SQL:

1. Cada expediente mantendrá una secuencia de movimientos única y sin ambigüedad.
2. Antes de registrar una acción se validará que el estado esperado coincida con el último movimiento válido.
3. El movimiento, su detalle compatible y la actualización de la proyección opcional se tratarán como una unidad lógica: todos deberán quedar coherentes o ninguno se considerará aceptado.
4. Las solicitudes repetidas podrán prevenirse mediante una referencia idempotente **PROPUESTA**, cuyo origen y formato permanecen **PENDIENTES**.
5. Una derivación tendrá una sola confirmación válida mientras se mantenga la cardinalidad propuesta.
6. La transición aplicable se validará antes de aceptar el movimiento.
7. El actor, área, permiso, expediente y documento se verificarán con sus módulos propietarios cuando sean requeridos por la actuación.
8. Los intentos rechazados podrán conservarse en registros técnicos únicamente si la institución aprueba su auditoría; no se convertirán automáticamente en movimientos funcionales.
9. La estrategia concreta de transacciones, bloqueos, índices, aislamiento y recuperación corresponderá posteriormente a B_JHASY.

Si dos solicitudes compiten por la misma secuencia o parten de estados incompatibles, solo una secuencia coherente podrá aceptarse. El tratamiento y comunicación del rechazo permanecen **PENDIENTES**.

## 12. Contratos de integración

La siguiente matriz es conceptual y **PROPUESTA**. No define URLs, endpoints, estructuras JSON, tablas físicas ni tipos de identificador.

| Módulo propietario | Recurso externo | Información mínima requerida por RutaDoc | Validación esperada | Información no duplicada | Referencia inválida o no disponible | Tratamiento histórico al desactivarse | Pendientes de coordinación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Grupo 2 | Expediente o trámite y referencia del solicitante | Identificación estable del expediente, existencia, disponibilidad mínima y referencia disponible de la persona que inició el trámite. | Confirmar que el expediente existe y puede utilizarse; coordinar la referencia del solicitante. | Registro completo, numeración, datos de creación y datos personales del solicitante. | Rechazar o posponer la actuación sin crear un movimiento válido; el comportamiento exacto queda **PENDIENTE**. | Conservar la referencia en movimientos previos y permitir interpretar el historial según el contrato acordado. | Identificador, disponibilidad, consulta de inactivos y referencia de solicitantes externos no registrados junto con el Grupo 4. |
| Grupo 3 | Área, rol y permiso | Identificación y vigencia del área, relación aplicable con el actor y resultado de autorización requerido. | Confirmar área válida y autorización para la acción cuando corresponda. | Organización, jerarquías, membresías, catálogos de roles y reglas de permisos. | Impedir la actuación; su registro técnico queda **PENDIENTE** de aprobación institucional. | Mantener referencias históricas de origen y destino aunque el área, rol o permiso deje de estar activo. | Identificadores, vigencia, evaluación de permisos, áreas inactivas y respuesta ante indisponibilidad. |
| Grupo 4 | Actor identificable y solicitante interno o externo | Identificación estable del actor que ejecuta el movimiento y referencia disponible del solicitante que inició el trámite. | Confirmar existencia y vigencia del actor; distinguirlo del solicitante. Un externo puede estar registrado o no. | Datos personales, credenciales, autenticación y clasificación administrada por el grupo propietario. | Impedir o posponer la actuación según una regla **PENDIENTE**; no inventar un usuario local sustituto. | Conservar las referencias históricas sin reactivar ni duplicar datos personales. | Identificador, usuarios inactivos, información visible y referencia del externo no registrado en coordinación con el Grupo 2. |
| Grupo 5 | Documento, formulario, requisito o adjunto | Identificación estable, existencia, disponibilidad y relación conceptual permitida con el trámite o movimiento. | Confirmar que el recurso existe y puede vincularse con la finalidad propuesta. | Archivo, contenido, versiones, formularios, requisitos, metadatos y reglas documentales. | No aceptar el vínculo documental; la continuidad del movimiento sin documento queda **PENDIENTE** según la acción. | Preservar la referencia histórica y el significado del vínculo aunque el recurso deje de estar activo, conforme al contrato acordado. | Identificadores, finalidades, versiones, acceso histórico, indisponibilidad y respuesta documental final. |

En todos los contratos, RutaDoc conservará solo la referencia y el contexto funcional que le corresponden. La disponibilidad, vigencia y forma de consulta serán responsabilidad coordinada con el módulo propietario. Las políticas frente a fallas temporales, recursos eliminados o cambios de identificador permanecen **PENDIENTES**.

También permanece **PENDIENTE** acordar cómo interpretar históricamente usuarios, áreas y documentos cuyos datos hayan sido modificados o que hayan sido desactivados después del movimiento. Esa interpretación no autoriza a RutaDoc a duplicar sus datos actuales ni personales.

## 13. Decisiones, supuestos y pendientes

Esta sección separa las decisiones de diseño **PROPUESTAS**, los supuestos utilizados para avanzar y los elementos que requieren validación. Ninguno constituye por sí mismo una regla institucional definitiva.

### 13.1 Decisiones propuestas

1. Utilizar `movimiento_tramite` como evento histórico central, acumulativo e inmutable.
2. Representar la información exclusiva de derivación, recepción, observación y atención mediante detalles especializados vinculados obligatoriamente a un movimiento compatible.
3. Mantener acciones, estados y tipos de relación en catálogos configurables, conservando los valores usados históricamente aunque sean desactivados.
4. Relacionar movimientos entre sí para expresar rectificación, subsanación, confirmación, reapertura u otros vínculos sin alterar el evento original.
5. Ordenar el historial mediante una secuencia única por expediente; la fecha y hora actúan como evidencia adicional.
6. Mantener `estado_actual_tramite` únicamente como proyección opcional y reconstruible; el historial continúa siendo la fuente de verdad.
7. Referenciar usuarios, áreas, expedientes y documentos administrados por otros grupos sin duplicar su información.

### 13.2 Supuestos de trabajo

1. Un expediente puede recorrer una ruta sencilla, jerárquica o excepcional y acumular tantos movimientos como sean necesarios.
2. Cada actuación aceptada deja un estado resultante y un actor identificable, salvo que una regla futura determine una excepción distinta.
3. El actor que ejecuta el movimiento y el solicitante que inició el trámite pueden ser personas diferentes.
4. Cierre y reapertura pueden representarse inicialmente mediante movimientos, transiciones y relaciones, sin detalles independientes obligatorios.
5. Los módulos propietarios podrán validar referencias externas al registrar una actuación y permitir algún tratamiento histórico posterior.
6. La estrategia inicial considera una secuencia coherente; cualquier ruta paralela requerirá reglas adicionales.

### 13.3 Elementos pendientes

1. Confirmación de los nombres oficiales de acciones, estados y tipos de relación.
2. Decisión institucional sobre la recepción manual en el área destinataria.
3. Confirmación de si se permiten rutas o derivaciones paralelas.
4. Forma de referenciar a un solicitante externo no registrado, coordinada con los Grupos 2 y 4, sin duplicar datos personales.
5. Roles, permisos, responsables y condiciones para cada acción.
6. Condiciones de cierre, reapertura y posible archivo; atender no implica cerrar ni archivar automáticamente.
7. Plazos, prioridades, alertas y escalamiento.
8. Reglas para rectificaciones múltiples y determinación del último movimiento válido.
9. Necesidad y mantenimiento de la proyección opcional del estado actual.
10. Resolución de concurrencia, idempotencia, movimientos simultáneos y comunicación de rechazos.
11. Interpretación histórica de referencias externas modificadas, desactivadas o temporalmente no disponibles.
12. Implementación física posterior de transacciones, índices, bloqueos, aislamiento y restricciones por B_JHASY.

## 14. Criterios de aceptación

El modelo lógico preliminar podrá considerarse aceptable para continuar al diccionario y al diseño físico cuando se verifique que:

1. Identifica claramente las entidades preliminares propias, su clasificación, propósito y límites de responsabilidad.
2. Expresa todas las cardinalidades relevantes en ambos sentidos y cada detalle pertenece a un único movimiento compatible.
3. Mantiene `movimiento_tramite` como fuente histórica acumulativa y no destructiva.
4. Representa una rectificación mediante un movimiento nuevo relacionado con el original, conservando quién, cuándo y por qué.
5. Permite reconstruir el recorrido y el estado actual desde la secuencia de movimientos válidos.
6. Mantiene `estado_actual_tramite`, si se aprueba, como proyección reparable y nunca como sustituto del historial.
7. Usa referencias externas para expedientes, usuarios, áreas y documentos sin duplicar entidades ni datos personales de otros grupos.
8. Distingue al actor identificable que ejecuta el movimiento del solicitante que inició el trámite, incluido el caso **PENDIENTE** de un externo no registrado.
9. Presenta una matriz de transiciones preliminar sin convertir acciones, estados, permisos o plazos en reglas institucionales confirmadas.
10. Separa derivación de recepción, atención de cierre y reapertura de eliminación del cierre anterior.
11. Define garantías lógicas para secuencia, transición, idempotencia y movimientos simultáneos sin anticipar SQL.
12. Documenta contratos conceptuales con los Grupos 2, 3, 4 y 5, incluidos recursos inválidos, no disponibles, modificados o desactivados.
13. Mantiene trazabilidad suficiente para preparar posteriormente claves, restricciones y SQL por B_JHASY.
14. No contiene tipos PostgreSQL, sentencias SQL, endpoints ni nombres físicos presentados como definitivos.

## 15. Fuentes consultadas

| Fuente | Aporte al modelo |
| --- | --- |
| `01_analisis_trazabilidad_recepcion_derivacion_atencion.md` | Fundamento funcional aprobado para distinguir acciones y estados, conservar movimientos, reconstruir recorridos, tratar excepciones y delimitar dependencias con otros grupos. |
| W3C, *PROV-DM: The PROV Data Model* — https://www.w3.org/TR/prov-dm/ | Respalda conceptualmente la representación de actividades, agentes, responsabilidad, tiempo y procedencia sin imponer una estructura física específica. |
| W3C, *Constraints of the PROV Data Model* — https://www.w3.org/TR/prov-constraints/ | Orienta la consistencia, el orden de eventos y la prevención de secuencias incompatibles dentro de un historial. |
| NIST, *SP 800-92: Guide to Computer Security Log Management* — https://csrc.nist.gov/pubs/sp/800/92/final | Apoya la conservación y gestión de evidencia de eventos y la distinción entre historial funcional y registros técnicos de auditoría. |

Estas fuentes sustentan criterios conceptuales. No confirman nombres institucionales, permisos, plazos ni decisiones físicas de PostgreSQL.

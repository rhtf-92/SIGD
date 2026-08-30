# PLAN DE TRABAJO

Grupo 5 “DocuCore” · Módulo de documentos y formularios

Proyecto: Sistema Integral de Gestión Documentaria (SIGD)

Área: Backend

Líder general: Geric · B_GERIC

Sublíder: Cristian · B_CHRISTIAN

Integrantes: Cristian, Piero, Azareño y Valentín

Fecha: 27 de agosto de 2026

Estado: Asignación preliminar pendiente de validación del módulo

> Propósito del documento: definir con claridad qué debe investigar, modelar, proponer y demostrar cada integrante. Este documento organiza el trabajo; no reemplaza el análisis funcional, el modelo de datos ni el borrador SQL que deberá producir el grupo.

1. Objetivo del grupo

Diseñar de manera preliminar el módulo que permitirá definir tipos de documentos, configurar los formularios asociados, establecer requisitos y administrar archivos adjuntos dentro del SIGD. El resultado debe respetar el proceso explicado por el profesor y, a la vez, proponer mejoras justificadas para que el diseño pueda evolucionar hacia un entorno real de producción.

La lista oficial de áreas, documentos, requisitos y responsables todavía está pendiente. Por ello, el grupo trabajará con estructuras genéricas, ejemplos claramente identificados como no oficiales y preguntas que luego deberán validarse con el profesor o con la institución.

2. Alcance preliminar

El grupo debe estudiar y proponer cómo el sistema representará los siguientes elementos:

- Catálogo de tipos de documento o trámite, como solicitud, certificado de estudios o memorándum, usados únicamente como ejemplos preliminares.

- Formulario aplicable a cada tipo de documento y campos que lo componen.

- Requisitos obligatorios, opcionales o condicionados para iniciar un trámite.

- Archivos adjuntos y sus reglas de validación, almacenamiento lógico, descripción y relación con el trámite.

- Versionado o vigencia de formularios y requisitos, si el análisis demuestra que es necesario.

- Integración conceptual con el trámite o expediente, sin diseñar la trazabilidad completa, que corresponde a otro grupo.

3. Límites y criterio de mejora

En esta etapa no se implementarán endpoints, controladores ni migraciones definitivas. Tampoco se cargarán como oficiales nombres de áreas, requisitos o tipos de documentos que todavía no hayan sido proporcionados por la institución.

Cada decisión debe marcarse con una de estas categorías:

| Categoría | Uso |
| --- | --- |
| CONFIRMADO | Indicación expresada por el profesor o información institucional verificada. |
| PROPUESTO | Mejora técnica planteada por el grupo, acompañada de una justificación. |
| PENDIENTE | Información que todavía debe preguntarse o validarse. |
| EJEMPLO | Dato creado solo para demostrar el funcionamiento, sin valor oficial. |

> Relación con la arquitectura MVC: MVC significa Modelo–Vista–Controlador. El diagrama entidad–relación y el modelo lógico de datos son artefactos de diseño de base de datos que sirven de apoyo a la capa Modelo y al acceso a PostgreSQL. Por tanto, complementan la arquitectura MVC y no representan una arquitectura distinta ni una contradicción.

4. Organización del equipo

| Integrante | Rama | Función | Resultado principal |
| --- | --- | --- | --- |
| Cristian | B_CHRISTIAN | Sublíder y modelador | Modelo de datos, coordinación, revisión e integración. |
| Azareño | B_AZAREÑO | Análisis funcional A | Objetivo, actores, catálogo preliminar, flujo normal y fuentes. |
| Valentín | B_VALENTIN | Análisis funcional B | Reglas, requisitos, adjuntos y casos excepcionales. |
| Piero | B_PIERO | Implementador SQL | DDL provisional, restricciones, índices, datos de prueba y validación. |

5. Responsabilidades individuales

Cristian (B_CHRISTIAN)

Responsabilidad asignada: Sublíder del grupo, responsable del modelo de datos y de la integración

Cristian coordinará el avance del equipo y convertirá el análisis funcional aprobado en un modelo coherente. Su función es orientar, revisar e integrar; no sustituir el trabajo individual de los demás integrantes.

### Actividades

- Organizar una reunión breve de inicio y confirmar que cada integrante entiende su responsabilidad.

- Revisar y consolidar los análisis entregados por Azareño y Valentín, detectando contradicciones, duplicaciones y vacíos.

- Proponer las entidades, atributos, claves primarias y foráneas, relaciones, cardinalidades y restricciones del módulo.

- Representar el modelo mediante una herramienta apropiada, como diagrams.net, DrawSQL, dbdiagram.io, Lucidchart o una alternativa equivalente.

- Comprobar que un tipo de documento pueda asociarse con su formulario, campos, requisitos y reglas de adjuntos sin dejar valores rígidos en el código.

- Revisar el borrador SQL de Piero y registrar las correcciones solicitadas antes de enviarlo a Geric.

- Preparar la consolidación final y coordinar la explicación del grupo.

### Productos individuales

- Diagrama entidad–relación y modelo lógico de datos legibles, conservados en formato editable y versionados mediante Git.

- Diccionario preliminar de entidades y relaciones.

- Registro breve de decisiones, supuestos y preguntas pendientes.

- Documento consolidado del grupo listo para revisión del líder general.

### Criterios de aceptación

- Cada entidad tiene propósito, atributos relevantes y relaciones justificadas.

- Las cardinalidades coinciden con las reglas del análisis funcional.

- Las propuestas se distinguen de la información confirmada.

- El trabajo de los demás integrantes permanece identificable en la consolidación.

Azareño (B_AZAREÑO)

Responsabilidad asignada: Responsable del análisis funcional A: propósito, actores y funcionamiento normal

Azareño investigará la parte inicial del módulo. Su entrega debe explicar el problema con palabras propias y proporcionar insumos claros para que Cristian pueda elaborar el modelo de datos.

### Actividades

- Definir el objetivo del módulo y el problema que resolverá dentro del SIGD.

- Identificar los actores que crean, configuran, consultan o utilizan los tipos de documentos y formularios.

- Elaborar un catálogo preliminar de tipos de documentos, indicando expresamente que son ejemplos mientras no exista información oficial.

- Describir el flujo normal: selección del tipo de documento, presentación del formulario, verificación inicial de campos y preparación para crear el trámite.

- Investigar buenas prácticas sobre formularios documentarios y registrar las fuentes consultadas.

- Proponer preguntas pendientes para el profesor relacionadas con tipos de documentos, formularios y responsables.

### Productos individuales

- Sección de objetivo, alcance y actores.

- Catálogo preliminar de documentos con descripción y ejemplo de uso.

- Flujo funcional normal explicado paso a paso.

- Lista de fuentes y preguntas pendientes.

### Criterios de aceptación

- No copia definiciones sin explicarlas ni presenta ejemplos como datos oficiales.

- Cada actor tiene responsabilidades y límites reconocibles.

- El flujo permite comprender qué información recibe el sistema y qué resultado produce.

- La entrega puede ser explicada oralmente por su autor.

Valentín (B_VALENTIN)

Responsabilidad asignada: Responsable del análisis funcional B: reglas, requisitos, adjuntos y excepciones

Valentín completará el análisis funcional estudiando las condiciones que permiten aceptar o rechazar información. Su trabajo debe cubrir situaciones normales y errores previsibles, no limitarse al camino ideal.

### Actividades

- Proponer reglas para requisitos obligatorios, opcionales, condicionales y vigentes por tipo de documento.

- Identificar qué información mínima necesitaría un requisito: nombre, descripción, obligatoriedad, orden, vigencia y observaciones.

- Proponer reglas preliminares para adjuntos: nombre lógico, formato declarado, tamaño, obligatoriedad, descripción y relación con el requisito.

- Documentar casos excepcionales, como campo obligatorio vacío, requisito faltante, archivo duplicado, formato no permitido, tamaño excedido o formulario inactivo.

- Separar las reglas confirmadas de las propuestas de seguridad o mejora técnica.

- Crear ejemplos sencillos para comprobar que las reglas sean entendibles.

### Productos individuales

- Catálogo de reglas de negocio numeradas.

- Matriz de requisitos y adjuntos con ejemplos no oficiales.

- Listado de casos excepcionales y respuesta esperada del sistema.

- Preguntas pendientes sobre formatos, tamaños, obligatoriedad y validaciones.

### Criterios de aceptación

- Cada regla puede verificarse mediante un caso de prueba.

- Se distingue entre validación funcional, propuesta técnica y dato pendiente.

- Los casos excepcionales indican la condición, el resultado esperado y el mensaje comprensible para el usuario.

- La entrega no define formatos o límites oficiales sin respaldo.

Piero (B_PIERO)

Responsabilidad asignada: Responsable del borrador SQL y de su validación técnica

Piero elaborará el SQL únicamente después de que Cristian apruebe el análisis y el modelo. El objetivo es demostrar que el diseño puede representarse en PostgreSQL, no crear todavía el esquema definitivo del proyecto.

### Actividades

- Convertir las entidades aprobadas en tablas provisionales usando PostgreSQL 18.6.

- Definir tipos de datos coherentes, claves primarias, claves foráneas, valores únicos, campos obligatorios, valores predeterminados y restricciones CHECK cuando correspondan.

- Proponer índices para búsquedas justificadas, evitando crear índices por costumbre o duplicar los generados por restricciones únicas.

- Agregar datos de prueba ficticios y claramente identificados como no oficiales.

- Ejecutar el script en una base local de pruebas y corregir todos los errores de sintaxis y dependencias.

- Documentar el orden de creación de tablas, los resultados de la prueba y cualquier decisión que requiera revisión.

### Productos individuales

- Archivo SQL provisional del módulo, separado del esquema definitivo.

- Datos mínimos de prueba sin información personal real.

- Registro de ejecución o evidencia de que el script termina sin errores.

- Notas técnicas sobre restricciones, índices y dependencias con otros módulos.

### Criterios de aceptación

- El script se ejecuta desde una base vacía sin errores.

- Las claves y cardinalidades coinciden con el modelo aprobado.

- No se incluyen contraseñas, credenciales ni datos personales reales.

- El SQL está marcado como borrador y puede modificarse después de recibir la información oficial.

6. Flujo de trabajo obligatorio

> Principio de evidencia individual: una tarea solo se considera entregada cuando el archivo asignado, sus correcciones y sus commits están publicados en la rama personal del responsable. Enviar el archivo por chat o verlo únicamente dentro de B_CHRISTIAN no sustituye esa evidencia. El profesor podrá revisar B_AZAREÑO, B_VALENTIN, B_CHRISTIAN y B_PIERO para identificar el aporte real de cada integrante.

El trabajo seguirá el siguiente orden cronológico. Una fase dependiente no debe comenzar hasta que la evidencia de la fase anterior esté publicada y revisada:

| Fase | Responsable | Acción y evidencia en rama personal | Condición para continuar |
| --- | --- | --- | --- |
| 0 | Todos | Actualizar su propia rama desde main y confirmar que está limpia y sincronizada. Nadie trabaja directamente en la rama de otro integrante. | Las cuatro ramas están preparadas. |
| 1A | Azareño | Desarrollar 01_analisis_objetivo_actores_flujo.md en B_AZAREÑO; realizar commits descriptivos y push. | Su archivo y commits son visibles en B_AZAREÑO. |
| 1B | Valentín | Desarrollar 02_reglas_requisitos_adjuntos.md en B_VALENTIN; realizar commits descriptivos y push. Puede avanzar en paralelo con 1A. | Su archivo y commits son visibles en B_VALENTIN. |
| 2 | Cristian | Revisar las ramas B_AZAREÑO y B_VALENTIN. Si encuentra observaciones, cada autor corrige en su propia rama y vuelve a hacer push. Después, Cristian integra las versiones aprobadas en B_CHRISTIAN. | Ambos análisis están aprobados e integrados. |
| 3 | Cristian | Crear el modelo, diagrama, diccionario y decisiones en B_CHRISTIAN; realizar sus propios commits y push. | El modelo está visible en B_CHRISTIAN. |
| 4 | Todo el grupo | Contrastar el modelo con los casos normales y excepcionales. Cada corrección funcional la realiza su autor en su rama; Cristian actualiza el modelo en B_CHRISTIAN. | Análisis y modelo son coherentes. |
| 5 | Piero | Actualizar B_PIERO con los insumos aprobados; crear y probar 05_documentos_formularios.sql y 06_validacion_y_casos_prueba.md; realizar commits y push en B_PIERO. | SQL y pruebas son visibles en B_PIERO. |
| 6 | Cristian y Piero | Cristian revisa B_PIERO. Si hay observaciones, Piero las corrige en B_PIERO y publica nuevos commits. Luego Cristian integra la versión aprobada en B_CHRISTIAN. | SQL aprobado e integrado. |
| 7 | Cada integrante | Comprobar que su rama personal conserva archivos, correcciones, commits y capturas. Cristian verifica además el paquete consolidado en B_CHRISTIAN. | La autoría individual puede comprobarse sin depender de la rama consolidada. |
| 8 | Cristian y Geric | Cristian abre el Pull Request de B_CHRISTIAN hacia B_GERIC. Geric revisa; cualquier corrección vuelve primero a la rama personal de quien sea responsable. | El módulo queda aprobado en B_GERIC. |
| 9 | Geric y profesor | Geric integra los módulos y abre el Pull Request de B_GERIC hacia main. El profesor revisa las ramas personales y realiza el merge final. | Entrega aceptada por el profesor. |

> Regla para las correcciones: Cristian revisa e integra, pero no reemplaza al autor. Si una tarea de Azareño, Valentín o Piero necesita cambios, el integrante responsable debe corregirla y publicarla primero en su propia rama. Solo después se incorpora la versión aprobada a B_CHRISTIAN.

7. Estructura esperada de la entrega

| Archivo o evidencia | Dónde debe existir primero | Integración posterior |
| --- | --- | --- |
| 01_analisis_objetivo_actores_flujo.md | B_AZAREÑO, con commits y push de Azareño | Cristian integra la versión aprobada en B_CHRISTIAN |
| 02_reglas_requisitos_adjuntos.md | B_VALENTIN, con commits y push de Valentín | Cristian integra la versión aprobada en B_CHRISTIAN |
| 03_modelo_datos.md y archivo del diagrama | B_CHRISTIAN, con commits y push de Cristian | Permanece en la rama consolidada |
| 04_diccionario_datos.md | B_CHRISTIAN, con commits y push de Cristian | Revisión grupal antes del SQL |
| 05_documentos_formularios.sql | B_PIERO, con commits y push de Piero | Cristian integra la versión aprobada en B_CHRISTIAN |
| 06_validacion_y_casos_prueba.md | B_PIERO, con commits y push de Piero | Cristian integra la versión aprobada en B_CHRISTIAN |
| 07_decisiones_y_preguntas_pendientes.md | B_CHRISTIAN, con commits y push de Cristian | Se incluye en el PR hacia B_GERIC |
| Capturas, commits y explicación individual | Rama personal de cada integrante | Se conserva como evidencia independiente |

8. Convenciones mínimas

- Redacción propia, clara y defendible; no se aceptará contenido copiado sin comprensión.

- Las fuentes consultadas deben identificarse. Se priorizarán disposiciones oficiales, documentación institucional y referencias técnicas confiables.

- El modelo debe ser configurable: no debe crear una tabla diferente para cada tipo de documento ni fijar en el código campos que puedan variar.

- El SQL utilizará nombres en snake_case, términos consistentes y PostgreSQL 18.6 como referencia del equipo.

- Los identificadores internos no deben confundirse con códigos visibles de trámite o números de registro.

- Los datos de prueba serán ficticios y no incluirán DNI, nombres, contraseñas ni documentos reales de estudiantes o trabajadores.

- Toda propuesta de optimización debe indicar el problema que resuelve, su efecto esperado y aquello que todavía necesita validación.

9. Evidencia individual y control de versiones

La rama personal es la evidencia principal que revisará el profesor. Una tarea no cuenta como aporte individual si solo fue enviada por otro medio o si aparece únicamente en la rama consolidada. Cada integrante deberá conservar en su propia rama:

- El archivo o la sección que le fue asignada, claramente identificada.

- Uno o más commits propios con mensajes descriptivos y el push correspondiente.

- Las correcciones solicitadas, realizadas por el mismo autor mediante nuevos commits en su rama.

- Una captura donde se vea su rama, el commit y el archivo aportado.

- Explicación breve de qué hizo, por qué lo hizo y cómo verificó su resultado.

- Respuesta a preguntas del sublíder o del líder general sobre su aporte.

La revisión y la integración grupal son una etapa posterior. Cristian consultará las ramas personales, pedirá al autor que resuelva sus propias observaciones y consolidará únicamente las versiones aprobadas en B_CHRISTIAN. No deberá editar directamente la rama de otro estudiante ni presentar como propio el archivo elaborado por ese estudiante.

Cuando el repositorio lo permita, se utilizarán integraciones que conserven los commits originales. Sin embargo, incluso después de integrar, B_AZAREÑO, B_VALENTIN, B_CHRISTIAN y B_PIERO deben permanecer disponibles como evidencia independiente. Después, Cristian abrirá el Pull Request hacia B_GERIC; Geric revisará el módulo y abrirá el Pull Request final hacia main para que el profesor realice el merge.

10. Preguntas que el grupo debe dejar preparadas

- ¿Cuáles son los tipos oficiales de documentos o trámites que manejará inicialmente el SIGD?

- ¿Qué campos son comunes a todos los formularios y cuáles dependen del tipo de documento?

- ¿Quién puede crear, modificar, activar o desactivar un formulario?

- ¿Los requisitos cambian según el solicitante interno o externo?

- ¿Qué formatos, tamaños y cantidades de archivos adjuntos serán aceptados?

- ¿Un requisito puede cumplirse con varios adjuntos o un adjunto puede servir para varios requisitos?

- ¿Los formularios y requisitos necesitan vigencia o control de versiones?

- ¿Qué información debe conservarse cuando un formulario cambia después de haberse iniciado un trámite?

11. Lista de verificación para la entrega

| Estado | Criterio |
| --- | --- |
| ☐ | El objetivo, los actores y el alcance están explicados con palabras propias. |
| ☐ | Las reglas normales y excepcionales están documentadas. |
| ☐ | El modelo deriva del análisis y no de tablas inventadas primero. |
| ☐ | Las entidades, atributos, claves, relaciones y cardinalidades están justificadas. |
| ☐ | El SQL corresponde al modelo aprobado y se ejecuta sin errores en una base de prueba. |
| ☐ | Los ejemplos están marcados como no oficiales. |
| ☐ | Las propuestas y los datos pendientes están claramente separados. |
| ☐ | Cada archivo asignado existe primero en la rama personal del responsable. |
| ☐ | Cada integrante cuenta con commits propios, push, captura y explicación individual. |
| ☐ | Las correcciones fueron realizadas y publicadas por el autor original en su rama. |
| ☐ | El profesor puede identificar el aporte de cada integrante sin revisar solamente B_CHRISTIAN. |
| ☐ | La consolidación grupal no reemplazó ni ocultó la evidencia de las ramas personales. |
| ☐ | Cristian revisó el paquete y registró las observaciones resueltas o pendientes. |
| ☐ | El material está listo para ser explicado y defendido frente al profesor. |

12. Resultado esperado

Al finalizar, DocuCore deberá entregar una propuesta coherente y verificable del módulo, suficientemente flexible para incorporar después la información oficial sin rehacer todo el diseño. La calidad se medirá por la comprensión, la coherencia entre análisis, modelo y SQL, la justificación de decisiones y la evidencia individual; no por la cantidad de páginas.

| Líder generalGeric · B_GERIC | Sublíder responsableCristian · B_CHRISTIAN | Fecha de revisiónPendiente de coordinación |
| --- | --- | --- |

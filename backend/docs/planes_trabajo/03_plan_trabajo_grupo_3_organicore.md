# PLAN DE TRABAJO

Grupo 3 “OrganiCore” · Áreas, roles, responsables y permisos

Proyecto: Sistema Integral de Gestión Documentaria (SIGD)

Área: Backend

Líder general: Geric · B_GERIC

Sublíder: Pool · B_POOL

Integrantes: Pool, Leonardo, Panaifo y Héctor

Fecha: 27 de agosto de 2026

Estado: Asignación preliminar pendiente de información institucional

> Propósito del documento: definir qué debe investigar, modelar, proponer y demostrar cada integrante del Grupo 3. La meta es mantener el proyecto en movimiento sin presentar como oficiales las áreas, jerarquías, cargos o permisos que la institución todavía no ha confirmado.

1. Objetivo del grupo

Diseñar de manera preliminar el módulo organizacional y de autorización del SIGD. El módulo deberá representar áreas institucionales, relaciones jerárquicas, responsables, roles y permisos, y permitir que cada operación sensible sea autorizada en el backend según reglas claras y verificables.

El organigrama, el reglamento interno, el Manual de Perfil de Puestos y la relación oficial de responsables aún están pendientes. Por ello, el grupo trabajará con estructuras genéricas, ejemplos ficticios y decisiones marcadas para validación posterior; no inventará el funcionamiento definitivo del instituto.

2. Alcance preliminar

El grupo debe analizar y proponer cómo el sistema representará los siguientes elementos:

- Áreas, oficinas o unidades organizacionales, incluyendo su estado y una jerarquía flexible entre área superior y área dependiente.

- Diferencia entre área, cargo, rol de sistema, responsabilidad institucional y permiso técnico.

- Asignación de usuarios internos a una o varias áreas, en coordinación con el Grupo 4 y sin duplicar sus tablas de identidad.

- Designación del responsable de un área y conservación del historial cuando ese responsable cambie.

- Catálogo de roles y permisos bajo un esquema de control de acceso basado en roles, sin fijar todavía nombres oficiales.

- Alcance de los permisos: globales o limitados a un área, cuando la regla institucional lo requiera.

- Integración con recepción, derivación, revisión y atención de trámites, de modo que solo áreas activas y usuarios autorizados participen.

- Validaciones y casos excepcionales: jerarquía circular, área inactiva, responsable ausente, asignación vencida, rol duplicado o acceso denegado.

3. Límites y criterio de mejora

En esta etapa no se definirán el organigrama oficial, los nombres definitivos de roles, la matriz institucional de permisos ni los endpoints finales. El borrador SQL demostrará viabilidad técnica, pero no será una migración oficial del proyecto. Las reglas de autorización deberán validarse después con el profesor y la institución.

Cada decisión deberá marcarse con una de estas categorías:

| Categoría | Uso |
| --- | --- |
| CONFIRMADO | Indicación expresada por el profesor o información institucional verificada. |
| PROPUESTO | Mejora técnica planteada por el grupo, acompañada de una justificación. |
| PENDIENTE | Información que todavía debe preguntarse o validarse. |
| EJEMPLO | Dato creado solo para demostrar el funcionamiento, sin valor oficial. |

4. Organización del equipo

| Integrante | Rama | Función | Resultado principal |
| --- | --- | --- | --- |
| Pool | B_POOL | Sublíder y modelador | Modelo de datos, coordinación, revisión e integración. |
| Leonardo | B_LEONARDO | Analista funcional | Áreas, jerarquías, roles, responsables, permisos y preguntas. |
| Panaifo | B_PANAIFO | Implementador SQL | SQL provisional, matriz de permisos, pruebas y evidencia técnica. |
| Héctor | B_HECTOR | Validador y QA | Casos de prueba de permisos, integridad referencial y verificación SQL. |

5. Responsabilidades individuales

Pool (B_POOL)

Responsabilidad asignada: Sublíder del grupo, responsable del modelo de datos y de la integración

Pool coordinará el avance y convertirá el análisis funcional aprobado en un modelo coherente para la estructura organizacional y el control de acceso. Su función es orientar, revisar e integrar; no reemplazar las entregas que Leonardo y Panaifo deben publicar en sus propias ramas.

### Actividades

- Organizar una reunión breve de inicio y confirmar que Leonardo y Panaifo comprenden sus entregables y dependencias.

- Revisar el análisis de Leonardo y pedirle que corrija en B_LEONARDO cualquier contradicción, supuesto sin marcar o regla incompleta.

- Proponer entidades, atributos, claves, relaciones, cardinalidades y restricciones para áreas, jerarquías, responsables, roles, permisos y asignaciones.

- Representar el modelo con una herramienta como diagrams.net, DrawSQL, dbdiagram.io, Lucidchart o una alternativa equivalente, conservando también el archivo editable.

- Distinguir área, cargo, rol, permiso y responsabilidad para evitar que una sola tabla intente representar conceptos diferentes.

- Definir contratos conceptuales con usuarios internos del Grupo 4 y con trazabilidad del Grupo 1, sin duplicar entidades de otros módulos.

- Revisar el SQL de Panaifo y solicitar que las correcciones se publiquen primero en B_PANAIFO antes de integrarlas.

- Preparar el paquete consolidado y coordinar la explicación técnica del grupo.

### Productos individuales

- Diagrama entidad–relación y modelo lógico legibles, editables y versionados mediante Git.

- Diccionario preliminar de entidades, atributos, claves, estados y relaciones.

- Matriz conceptual que relacione roles con permisos y aclare cuándo el alcance depende de un área.

- Contrato de integración con usuarios internos, trazabilidad y trámites.

- Registro de decisiones, supuestos y preguntas pendientes, además del paquete consolidado.

### Criterios de aceptación

- Cada entidad tiene un propósito único y relaciones justificadas.

- La jerarquía admite varios niveles sin crear una tabla distinta por cada nivel institucional.

- Los cambios de responsable o asignación pueden conservar historial cuando el análisis lo requiera.

- El modelo no duplica usuarios ni mezcla cargos con permisos técnicos.

- Los aportes de Leonardo y Panaifo permanecen identificables después de la integración.

Leonardo (B_LEONARDO)

Responsabilidad asignada: Responsable del análisis funcional de áreas, roles, responsables y permisos

Leonardo documentará qué necesita resolver el módulo, quién participa y qué reglas deben investigarse antes de modelar. Su entrega debe permitir que Pool diseñe la base de datos sin comenzar por tablas inventadas.

### Actividades

- Definir el objetivo del módulo, sus actores y las operaciones de creación, consulta, actualización, activación y desactivación.

- Explicar con ejemplos propios las diferencias entre área, oficina, cargo, rol, permiso y responsable.

- Describir cómo podría representarse una jerarquía de áreas y qué debe ocurrir si un área cambia de dependencia o queda inactiva.

- Documentar el proceso de asignar un usuario interno a un área, designar un responsable y registrar cambios de vigencia.

- Proponer una matriz funcional de acciones y permisos, separando lo confirmado de lo que todavía debe aprobarse.

- Describir flujos normales y excepcionales: área inexistente, ciclo jerárquico, usuario inactivo, responsable duplicado, rol vencido y acceso denegado.

- Investigar control de acceso basado en roles y principio de mínimo privilegio, explicándolos con palabras propias y registrando las fuentes.

- Preparar preguntas para el profesor sobre organigrama, responsables, cargos, herencia de permisos y alcance por áreas.

### Productos individuales

- Archivo de análisis funcional con objetivo, alcance, actores, conceptos y reglas preliminares.

- Flujos normales y excepcionales explicados paso a paso.

- Matriz funcional de roles, acciones y permisos marcada como ejemplo o propuesta.

- Lista de fuentes, decisiones y preguntas pendientes.

### Criterios de aceptación

- No presenta áreas, cargos ni permisos ficticios como información oficial.

- Cada concepto se diferencia mediante condiciones observables y ejemplos comprensibles.

- Los flujos identifican entrada, validación, resultado y responsable cuando sea conocido.

- La matriz evita el criterio inseguro de permitir todo por defecto.

- La entrega puede ser explicada y defendida oralmente por su autor.

Panaifo (B_PANAIFO)

Responsabilidad asignada: Responsable del borrador SQL y de la validación técnica de permisos

Panaifo elaborará el SQL después de que Pool apruebe el análisis y el modelo. Su entrega será acotada y comprobable: demostrar que el diseño puede implementarse en PostgreSQL y que los casos de autorización tienen resultados esperados.

### Actividades

- Convertir las entidades aprobadas en tablas provisionales compatibles con PostgreSQL 18.6.

- Definir claves primarias y foráneas, restricciones UNIQUE y CHECK, vigencias, estados e índices justificados.

- Representar la jerarquía mediante una referencia al área superior y documentar que la prevención de ciclos puede requerir lógica adicional, no solo una restricción CHECK.

- Implementar las relaciones muchos a muchos aprobadas para roles, permisos y asignaciones, sin almacenar listas separadas por comas.

- Agregar datos de prueba ficticios para varias áreas, responsables, roles y permisos, marcados como no oficiales.

- Preparar casos permitidos y denegados en una matriz de validación; no confiar únicamente en que el frontend oculte botones.

- Ejecutar el script desde una base vacía y corregir los errores de sintaxis, dependencias y duplicados.

- Documentar el orden de ejecución, consultas de verificación, limitaciones y observaciones para Pool.

### Productos individuales

- Archivo SQL provisional de áreas, responsables, roles, permisos y asignaciones.

- Datos de prueba ficticios y consultas mínimas de verificación.

- Archivo de validación con casos permitidos, denegados y excepcionales.

- Notas técnicas sobre índices, vigencias, prevención de ciclos y dependencias externas.

### Criterios de aceptación

- El script se ejecuta desde una base vacía sin errores.

- Las claves y cardinalidades coinciden con el modelo aprobado.

- Los permisos se relacionan mediante identificadores y no mediante texto duplicado.

- No se incluyen credenciales, contraseñas ni datos personales reales.

- El SQL está marcado como borrador y no fija decisiones institucionales pendientes.

Héctor (B_HECTOR)

Responsabilidad asignada: Validador de esquemas, integridad referencial y casos de prueba QA

Héctor asume la verificación cruzada de restricciones de integridad referencial, pruebas de carga de datos semilla y diseño de casos de prueba negativos para permisos denegados, jerarquías recursivas y prevención de ciclos en el organigrama.

### Actividades
- Diseñar la batería de pruebas automatizadas para comprobar que un usuario sin rol no acceda a recursos restringidos.
- Verificar que las eliminaciones lógicas (`activo = FALSE`) preserven la integridad histórica de auditoría.
- Probar scripts de inserción y consultar planes de ejecución (`EXPLAIN ANALYZE`) para índices de jerarquía.
- Documentar las observaciones y validar los resultados con Pool y Panaifo.

### Productos individuales
- Documento de validación técnica y casos de prueba de autorización (`B_HECTOR`).
- Scripts SQL de pruebas de esfuerzo e integridad referencial.
- Evidencia de ejecución limpia sin violaciones de integridad.

### Criterios de aceptación
- Casos de prueba cubren 100% de los roles y permisos propuestos.
- Cero falsos positivos en denegación de permisos de backend.
- Commits descriptivos publicados en la rama `B_HECTOR`.

6. Flujo de trabajo obligatorio

> Principio de evidencia individual: una tarea solo se considera entregada cuando el archivo asignado, sus correcciones y sus commits están publicados en la rama personal del responsable. Enviar el archivo por chat o mostrarlo únicamente en B_POOL no sustituye esa evidencia. El profesor podrá revisar B_LEONARDO, B_POOL, B_PANAIFO y B_HECTOR para reconocer el aporte real de cada integrante.

El trabajo seguirá este orden cronológico. Ninguna fase dependiente debe comenzar hasta que la evidencia anterior esté publicada y revisada:

| Fase | Responsable | Acción y evidencia en rama personal | Condición para continuar |
| --- | --- | --- | --- |
| 0 | Todos | Actualizar su rama desde main y confirmar que está limpia y sincronizada. Nadie trabaja directamente en la rama de otro integrante. | Las tres ramas están preparadas. |
| 1 | Leonardo | Crear 01_analisis_areas_roles_permisos.md en B_LEONARDO; realizar commits descriptivos y push. | Análisis y commits visibles en B_LEONARDO. |
| 2 | Pool | Revisar B_LEONARDO. Si hay observaciones, Leonardo las corrige y publica nuevos commits. Después, Pool integra la versión aprobada en B_POOL. | Análisis aprobado e integrado. |
| 3 | Pool | Crear 02_modelo_datos_organizacion.md, diagrama, diccionario y decisiones en B_POOL; realizar commits propios y push. | Modelo visible en B_POOL. |
| 4 | Todo el grupo | Comparar análisis, modelo, matriz de permisos e integraciones. Cada autor corrige su propio archivo y registra los pendientes. | Análisis y modelo coherentes. |
| 5 | Panaifo | Actualizar B_PANAIFO con los insumos aprobados; crear y probar 03_areas_roles_permisos.sql y 04_validacion_autorizacion.md; realizar commits y push. | SQL y pruebas visibles en B_PANAIFO. |
| 6 | Pool y Panaifo | Pool revisa B_PANAIFO. Si hay observaciones, Panaifo corrige en su rama y publica nuevos commits. Luego Pool integra la versión aprobada en B_POOL. | SQL aprobado e integrado. |
| 7 | Cada integrante | Comprobar que su rama conserva archivos, correcciones, commits y capturas. Pool verifica además el paquete consolidado. | La autoría puede comprobarse sin depender de B_POOL. |
| 8 | Pool y Geric | Pool abre el Pull Request de B_POOL hacia B_GERIC. Geric revisa; cualquier corrección regresa primero a la rama personal del responsable. | El módulo queda aprobado en B_GERIC. |
| 9 | Geric y profesor | Geric integra los módulos y abre el Pull Request de B_GERIC hacia main. El profesor revisa las ramas personales y realiza el merge final. | Entrega aceptada por el profesor. |

> Regla para las correcciones: Pool revisa e integra, pero no reemplaza al autor. Si una tarea de Leonardo o Panaifo necesita cambios, el responsable debe corregirla y publicarla primero en su propia rama. Solo entonces se incorpora la versión aprobada a B_POOL.

7. Estructura esperada de la entrega

| Archivo o evidencia | Dónde debe existir primero | Integración posterior |
| --- | --- | --- |
| 01_analisis_areas_roles_permisos.md | B_LEONARDO, con commits y push de Leonardo | Pool integra la versión aprobada en B_POOL |
| 02_modelo_datos_organizacion.md y diagrama | B_POOL, con commits y push de Pool | Permanece en la rama consolidada |
| 02_diccionario_datos_organizacion.md | B_POOL, con commits y push de Pool | Revisión grupal antes del SQL |
| 03_areas_roles_permisos.sql | B_PANAIFO, con commits y push de Panaifo | Pool integra la versión aprobada en B_POOL |
| 04_validacion_autorizacion.md | B_PANAIFO, con commits y push de Panaifo | Pool integra la versión aprobada en B_POOL |
| 05_decisiones_y_preguntas_pendientes.md | B_POOL, con commits y push de Pool | Se incluye en el PR hacia B_GERIC |
| Capturas, commits y explicación individual | Rama personal de cada integrante | Se conserva como evidencia independiente |

8. Convenciones mínimas

- Redacción propia, clara y defendible; no se aceptará contenido copiado sin comprensión.

- Las fuentes deben identificarse. Se priorizarán el organigrama, reglamentos y manuales institucionales cuando estén disponibles, además de referencias técnicas confiables.

- Área, cargo, rol, permiso y responsable se tratarán como conceptos diferentes aunque puedan relacionarse.

- Los permisos seguirán el principio de mínimo privilegio: una acción no confirmada no se concede por defecto.

- La autorización real deberá verificarse en el backend; ocultar una opción en el frontend no constituye una medida de seguridad suficiente.

- El SQL usará snake_case, términos consistentes y PostgreSQL 18.6 como referencia del equipo.

- Los datos de prueba serán ficticios y ninguna área, cargo o persona de ejemplo se presentará como oficial.

- Toda optimización deberá indicar el problema que resuelve, su efecto esperado y lo que aún necesita validación.

9. Evidencia individual y control de versiones

La rama personal es la evidencia principal que revisará el profesor. Una tarea no cuenta como aporte individual si solo fue enviada por otro medio o si aparece únicamente en la rama consolidada. Cada integrante deberá conservar en su propia rama:

- El archivo o la sección que le fue asignada, claramente identificada.

- Uno o más commits propios con mensajes descriptivos y el push correspondiente.

- Las correcciones solicitadas, realizadas por el mismo autor mediante nuevos commits.

- Una captura donde se vea su rama, el commit y el archivo aportado.

- Una explicación breve de qué hizo, por qué lo hizo y cómo verificó el resultado.

- Capacidad para responder preguntas del sublíder, del líder general o del profesor.

Pool consultará las ramas personales, pedirá al autor que resuelva sus propias observaciones y consolidará únicamente versiones aprobadas en B_POOL. No deberá editar directamente la rama de otro estudiante ni presentar como propio el archivo elaborado por ese estudiante.

Incluso después de integrar, B_LEONARDO, B_POOL y B_PANAIFO deben permanecer disponibles como evidencia independiente. Después, Pool abrirá el Pull Request hacia B_GERIC; Geric revisará el módulo y abrirá el Pull Request final hacia main para que el profesor realice el merge.

10. Preguntas que el grupo debe dejar preparadas

- ¿Cuál es el organigrama oficial, qué unidades deben registrarse y cuántos niveles jerárquicos existen?

- ¿Qué diferencia institucional existe entre cargo, función, responsable y rol del sistema?

- ¿Un usuario interno puede pertenecer a varias áreas al mismo tiempo?

- ¿Cada área tendrá un responsable principal, alternos o temporales, y qué cambios deberán conservar historial?

- ¿Los roles serán globales o podrán limitarse a un área, tipo de documento o etapa del trámite?

- ¿Qué permisos concretos existen para recibir, adjuntar, derivar, observar, firmar, atender y cerrar un trámite?

- ¿Quién está autorizado para crear áreas, asignar responsables, administrar roles y aprobar permisos?

- ¿Qué debe ocurrir con trámites pendientes cuando un área o usuario interno queda inactivo?

11. Lista de verificación para la entrega

| Estado | Criterio |
| --- | --- |
| ☐ | El objetivo, los actores y los conceptos organizacionales están explicados con palabras propias. |
| ☐ | Los flujos normales, estados y casos excepcionales están documentados. |
| ☐ | El modelo deriva del análisis y no de tablas inventadas primero. |
| ☐ | Las entidades, atributos, claves, relaciones y cardinalidades están justificadas. |
| ☐ | La jerarquía contempla varios niveles y ciclos; roles, cargos, permisos y responsables no se confunden. |
| ☐ | El SQL corresponde al modelo aprobado y se ejecuta sin errores en una base de prueba. |
| ☐ | Los ejemplos, propuestas, fuentes y pendientes están claramente identificados. |
| ☐ | Cada archivo asignado existe primero en la rama personal del responsable. |
| ☐ | Cada integrante tiene commits propios, push, captura y explicación; las correcciones fueron publicadas por el autor original. |
| ☐ | Pool registró las observaciones resueltas o pendientes y conservó la autoría durante la integración. |

12. Resultado esperado

Al finalizar, OrganiCore deberá entregar una propuesta coherente y verificable para representar la organización institucional y controlar permisos en el backend. El diseño deberá ser flexible para incorporar el organigrama y las reglas oficiales sin rehacer todo el módulo. La calidad se medirá por la comprensión, la coherencia entre análisis, modelo y SQL, la seguridad de las propuestas y la evidencia individual; no por la cantidad de páginas.

| Líder generalGeric · B_GERIC | Sublíder responsablePool · B_POOL | Fecha de revisiónPendiente de coordinación |
| --- | --- | --- |

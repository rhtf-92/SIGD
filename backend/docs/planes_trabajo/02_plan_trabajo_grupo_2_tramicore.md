# PLAN DE TRABAJO

Grupo 2 “TramiCore” · Trámite, expediente y libro de registro

Proyecto: Sistema Integral de Gestión Documentaria (SIGD)

Área: Backend

Líder general: Geric · B_GERIC

Sublíder: Ramírez · B_RAMIREZ

Integrantes: Ramírez, Riquelmer y Sandy

Fecha: 27 de agosto de 2026

Estado: Asignación preliminar pendiente de información institucional

> Propósito del documento: definir qué debe investigar, modelar, proponer y demostrar cada integrante del Grupo 2. El trabajo deberá distinguir trámite, expediente y asiento del libro de registro, además de separar sus identificadores internos de los códigos visibles que todavía requieren validación institucional.

1. Objetivo del grupo

Diseñar de manera preliminar el núcleo documental que permitirá registrar lo que una persona desea tramitar, agrupar su documentación en un expediente y dejar constancia de su ingreso en un libro de registro. El diseño deberá generar información identificable, consultable y preparada para conectarse con el seguimiento del Grupo 1.

El profesor mencionó código de trámite o expediente, número de registro, remitente y destinatario; sin embargo, todavía debe confirmarse qué representa exactamente cada identificador, quién lo genera y qué relación existe entre trámite, expediente y registro. El grupo trabajará con propuestas genéricas y ejemplos ficticios hasta recibir la información oficial.

2. Alcance preliminar

El grupo debe analizar y proponer cómo el sistema representará los siguientes elementos:

- Definición funcional de trámite, expediente y asiento de registro, indicando qué datos y responsabilidades corresponden a cada concepto.

- Identificadores técnicos internos y códigos visibles: código de trámite o expediente, número de registro, formato, unicidad y periodo de numeración.

- Creación, consulta, actualización controlada, anulación, cierre y reapertura cuando las reglas institucionales lo permitan.

- Relación con el usuario remitente o solicitante del Grupo 4, sea interno o externo, sin duplicar sus datos personales.

- Relación con el usuario o área destinataria, coordinada con el Grupo 3 y marcada como pendiente cuando la regla no esté confirmada.

- Asientos del libro de registro con fecha, canal de ingreso, asunto, remitente, destinatario y referencias documentales preliminares.

- Integración con tipos de documento, formularios, requisitos y adjuntos del Grupo 5, sin diseñar nuevamente esas entidades.

- Entrega del expediente al módulo de trazabilidad del Grupo 1 y manejo de casos excepcionales: duplicado, numeración concurrente, registro anulado, remitente incompleto o destino inválido.

3. Límites y criterio de mejora

En esta etapa no se fijará como oficial si trámite y expediente tienen una relación uno a uno, si comparten código, cómo se reinicia la numeración ni qué datos exactos contiene el libro institucional. Tampoco se implementarán endpoints ni migraciones definitivas. El SQL demostrará viabilidad técnica y deberá poder modificarse cuando llegue la información oficial.

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
| Ramírez | B_RAMIREZ | Sublíder y modelador | Modelo de datos, coordinación, revisión e integración. |
| Riquelmer | B_RIQUELMER | Analista funcional | Trámite, expediente, registro, identificadores, flujos y preguntas. |
| Sandy | B_SANDY | Implementadora SQL | SQL provisional, numeración, restricciones, pruebas y evidencia técnica. |

5. Responsabilidades individuales

Ramírez (B_RAMIREZ)

Responsabilidad asignada: Sublíder del grupo, responsable del modelo de datos y de la integración

Ramírez coordinará el avance y convertirá el análisis aprobado en un modelo coherente para trámite, expediente y libro de registro. Su función es orientar, revisar e integrar; no reemplazar las entregas que Riquelmer y Sandy deben publicar en sus propias ramas.

### Actividades

- Organizar una reunión breve de inicio y confirmar que Riquelmer y Sandy comprenden sus entregables y dependencias.

- Revisar el análisis de Riquelmer y pedirle que corrija en B_RIQUELMER cualquier contradicción, supuesto sin marcar o regla incompleta.

- Proponer entidades, atributos, claves, relaciones, cardinalidades y restricciones para trámite, expediente, asiento de registro y numeración.

- Representar el modelo con una herramienta como diagrams.net, DrawSQL, dbdiagram.io, Lucidchart o una alternativa equivalente, conservando también el archivo editable.

- Distinguir el identificador técnico, el código de trámite o expediente y el número de registro; documentar cuáles son inmutables y cuáles aún están pendientes.

- Definir contratos conceptuales con usuarios del Grupo 4, áreas del Grupo 3, documentos del Grupo 5 y trazabilidad del Grupo 1, sin duplicar entidades.

- Revisar el SQL de Sandy y solicitar que las correcciones se publiquen primero en B_SANDY antes de integrarlas.

- Preparar el paquete consolidado y coordinar la explicación técnica del grupo.

### Productos individuales

- Diagrama entidad–relación y modelo lógico legibles, editables y versionados mediante Git.

- Diccionario preliminar de entidades, atributos, claves, estados y relaciones.

- Matriz conceptual de identificadores, estados y reglas de numeración.

- Contrato de integración con usuarios, áreas, documentos y trazabilidad.

- Registro de decisiones, supuestos y preguntas pendientes, además del paquete consolidado.

### Criterios de aceptación

- Cada entidad tiene un propósito único y relaciones justificadas.

- Trámite, expediente y asiento de registro tienen propósitos diferenciados y cardinalidades justificadas.

- Los códigos visibles no se utilizan como claves primarias técnicas ni se generan mediante MAX + 1.

- El modelo evita duplicar usuarios, áreas, documentos y eventos de trazabilidad.

- Los aportes de Riquelmer y Sandy permanecen identificables después de la integración.

Riquelmer (B_RIQUELMER)

Responsabilidad asignada: Responsable del análisis funcional de trámite, expediente y libro de registro

Riquelmer documentará qué representa cada concepto, quién participa y qué reglas deben investigarse antes de modelar. Su entrega debe permitir que Ramírez diseñe la base de datos sin asumir que todos los códigos y números significan lo mismo.

### Actividades

- Definir el objetivo del módulo, sus actores y el flujo desde la presentación de una solicitud hasta el registro inicial del expediente.

- Explicar con ejemplos propios las diferencias entre trámite, expediente, documento presentado y asiento del libro de registro.

- Identificar qué datos entran al sistema, quién actúa como remitente y destinatario, y qué resultados genera cada operación.

- Documentar las reglas preliminares del código de trámite o expediente y del número de registro, marcando las dudas sobre formato, año y correlatividad.

- Describir los estados y operaciones normales: registrar, consultar, corregir, anular, cerrar, reabrir y entregar a trazabilidad, sin afirmar reglas no confirmadas.

- Documentar casos excepcionales: solicitud duplicada, datos incompletos, destino inválido, numeración repetida, registro anulado o expediente sin documentos requeridos.

- Investigar buenas prácticas de registro documental, numeración correlativa y conservación de historial, explicándolas con palabras propias y fuentes.

- Preparar preguntas para el profesor sobre relaciones, códigos, numeración, responsables y correcciones del libro de registro.

### Productos individuales

- Archivo de análisis funcional con objetivo, alcance, actores, conceptos y reglas preliminares.

- Flujos normales y excepcionales explicados paso a paso.

- Matriz funcional de conceptos, identificadores, estados y responsables marcada como propuesta.

- Lista de fuentes, decisiones y preguntas pendientes.

### Criterios de aceptación

- No presenta formatos de códigos, estados ni reglas de numeración ficticias como información oficial.

- Trámite, expediente, documento y asiento de registro se diferencian mediante condiciones observables.

- Los flujos identifican entrada, validación, resultado y responsable cuando sea conocido.

- Las reglas distinguen creación, corrección y anulación sin borrar el historial necesario.

- La entrega puede ser explicada y defendida oralmente por su autor.

Sandy (B_SANDY)

Responsabilidad asignada: Responsable del borrador SQL y de la validación técnica del registro documental

Sandy elaborará el SQL después de que Ramírez apruebe el análisis y el modelo. Su entrega será acotada y comprobable: demostrar que el diseño puede implementarse en PostgreSQL, generar identificadores sin colisiones y conservar relaciones coherentes.

### Actividades

- Convertir las entidades aprobadas en tablas provisionales compatibles con PostgreSQL 18.6.

- Definir claves primarias y foráneas, restricciones UNIQUE y CHECK, estados, marcas de tiempo e índices justificados.

- Usar identificadores internos generados por PostgreSQL y una estrategia segura para correlativos; evitar MAX + 1 porque falla con registros simultáneos.

- Representar remitente, destinatario, expediente y trámite mediante referencias aprobadas, sin repetir nombres o DNI dentro de cada registro.

- Agregar datos ficticios para varios trámites, expedientes y asientos, marcados expresamente como no oficiales.

- Preparar pruebas de unicidad, concurrencia conceptual, claves inexistentes, estados inválidos y anulaciones con conservación del asiento.

- Ejecutar el script desde una base vacía y corregir los errores de sintaxis, dependencias, secuencias y duplicados.

- Documentar el orden de ejecución, consultas de verificación, limitaciones y observaciones para Ramírez.

### Productos individuales

- Archivo SQL provisional de trámite, expediente y libro de registro.

- Datos de prueba ficticios y consultas mínimas de verificación.

- Archivo de validación con casos normales, duplicados, anulados y excepcionales.

- Notas técnicas sobre numeración, transacciones, índices y dependencias externas.

### Criterios de aceptación

- El script se ejecuta desde una base vacía sin errores.

- Las claves y cardinalidades coinciden con el modelo aprobado.

- Los códigos y números definidos como únicos no se repiten en las pruebas.

- No se incluyen credenciales ni datos personales o documentos reales.

- El SQL está marcado como borrador y no fija decisiones institucionales pendientes.

6. Flujo de trabajo obligatorio

> Principio de evidencia individual: una tarea solo se considera entregada cuando el archivo asignado, sus correcciones y sus commits están publicados en la rama personal del responsable. Enviar el archivo por chat o mostrarlo únicamente en B_RAMIREZ no sustituye esa evidencia. El profesor podrá revisar B_RIQUELMER, B_RAMIREZ y B_SANDY para reconocer el aporte real de cada integrante.

El trabajo seguirá este orden cronológico. Ninguna fase dependiente debe comenzar hasta que la evidencia anterior esté publicada y revisada:

| Fase | Responsable | Acción y evidencia en rama personal | Condición para continuar |
| --- | --- | --- | --- |
| 0 | Todos | Actualizar su rama desde main y confirmar que está limpia y sincronizada. Nadie trabaja directamente en la rama de otro integrante. | Las tres ramas están preparadas. |
| 1 | Riquelmer | Crear 01_analisis_tramite_expediente_registro.md en B_RIQUELMER; realizar commits descriptivos y push. | Análisis y commits visibles en B_RIQUELMER. |
| 2 | Ramírez | Revisar B_RIQUELMER. Si hay observaciones, Riquelmer las corrige y publica nuevos commits. Después, Ramírez integra la versión aprobada en B_RAMIREZ. | Análisis aprobado e integrado. |
| 3 | Ramírez | Crear 02_modelo_datos_gestion_documental.md, diagrama, diccionario y decisiones en B_RAMIREZ; realizar commits propios y push. | Modelo visible en B_RAMIREZ. |
| 4 | Todo el grupo | Comparar análisis, modelo, identificadores, estados e integraciones. Cada autor corrige su propio archivo y registra los pendientes. | Análisis y modelo coherentes. |
| 5 | Sandy | Actualizar B_SANDY con los insumos aprobados; crear y probar 03_tramite_expediente_registro.sql y 04_validacion_registro.md; realizar commits y push. | SQL y pruebas visibles en B_SANDY. |
| 6 | Ramírez y Sandy | Ramírez revisa B_SANDY. Si hay observaciones, Sandy corrige en su rama y publica nuevos commits. Luego Ramírez integra la versión aprobada en B_RAMIREZ. | SQL aprobado e integrado. |
| 7 | Cada integrante | Comprobar que su rama conserva archivos, correcciones, commits y capturas. Ramírez verifica además el paquete consolidado. | La autoría puede comprobarse sin depender de B_RAMIREZ. |
| 8 | Ramírez y Geric | Ramírez abre el Pull Request de B_RAMIREZ hacia B_GERIC. Geric revisa; cualquier corrección regresa primero a la rama personal del responsable. | El módulo queda aprobado en B_GERIC. |
| 9 | Geric y profesor | Geric integra los módulos y abre el Pull Request de B_GERIC hacia main. El profesor revisa las ramas personales y realiza el merge final. | Entrega aceptada por el profesor. |

> Regla para las correcciones: Ramírez revisa e integra, pero no reemplaza al autor. Si una tarea de Riquelmer o Sandy necesita cambios, el responsable debe corregirla y publicarla primero en su propia rama. Solo entonces se incorpora la versión aprobada a B_RAMIREZ.

7. Estructura esperada de la entrega

| Archivo o evidencia | Dónde debe existir primero | Integración posterior |
| --- | --- | --- |
| 01_analisis_tramite_expediente_registro.md | B_RIQUELMER, con commits y push de Riquelmer | Ramírez integra la versión aprobada en B_RAMIREZ |
| 02_modelo_datos_gestion_documental.md y diagrama | B_RAMIREZ, con commits y push de Ramírez | Permanece en la rama consolidada |
| 02_diccionario_datos_gestion_documental.md | B_RAMIREZ, con commits y push de Ramírez | Revisión grupal antes del SQL |
| 03_tramite_expediente_registro.sql | B_SANDY, con commits y push de Sandy | Ramírez integra la versión aprobada en B_RAMIREZ |
| 04_validacion_registro.md | B_SANDY, con commits y push de Sandy | Ramírez integra la versión aprobada en B_RAMIREZ |
| 05_decisiones_y_preguntas_pendientes.md | B_RAMIREZ, con commits y push de Ramírez | Se incluye en el PR hacia B_GERIC |
| Capturas, commits y explicación individual | Rama personal de cada integrante | Se conserva como evidencia independiente |

8. Convenciones mínimas

- Redacción propia, clara y defendible; no se aceptará contenido copiado sin comprensión.

- Las fuentes deben identificarse. Se priorizarán reglamentos, formatos, libros y procedimientos institucionales cuando estén disponibles.

- Trámite, expediente, documento y asiento de registro se tratarán como conceptos diferentes aunque puedan relacionarse.

- Los identificadores internos no se mostrarán como sustitutos automáticos del código de trámite o del número de registro.

- Los asientos no se eliminarán físicamente como corrección preliminar; la anulación o rectificación deberá conservar evidencia cuando sea exigida.

- El SQL usará snake_case, términos consistentes y PostgreSQL 18.6 como referencia del equipo.

- Los correlativos se generarán con mecanismos seguros de PostgreSQL y no mediante SELECT MAX(...) + 1.

- Los datos de prueba serán ficticios y ningún código, DNI, nombre o documento de ejemplo se presentará como oficial.

- Toda optimización deberá indicar el problema que resuelve, su efecto esperado y lo que aún necesita validación.

9. Evidencia individual y control de versiones

La rama personal es la evidencia principal que revisará el profesor. Una tarea no cuenta como aporte individual si solo fue enviada por otro medio o si aparece únicamente en la rama consolidada. Cada integrante deberá conservar en su propia rama:

- El archivo o la sección que le fue asignada, claramente identificada.

- Uno o más commits propios con mensajes descriptivos y el push correspondiente.

- Las correcciones solicitadas, realizadas por el mismo autor mediante nuevos commits.

- Una captura donde se vea su rama, el commit y el archivo aportado.

- Una explicación breve de qué hizo, por qué lo hizo y cómo verificó el resultado.

- Capacidad para responder preguntas del sublíder, del líder general o del profesor.

Ramírez consultará las ramas personales, pedirá al autor que resuelva sus propias observaciones y consolidará únicamente versiones aprobadas en B_RAMIREZ. No deberá editar directamente la rama de otro estudiante ni presentar como propio el archivo elaborado por ese estudiante.

Incluso después de integrar, B_RIQUELMER, B_RAMIREZ y B_SANDY deben permanecer disponibles como evidencia independiente. Después, Ramírez abrirá el Pull Request hacia B_GERIC; Geric revisará el módulo y abrirá el Pull Request final hacia main para que el profesor realice el merge.

10. Preguntas que el grupo debe dejar preparadas

- ¿Qué diferencia oficial existe entre trámite, expediente, documento presentado y asiento del libro de registro?

- ¿Un trámite crea siempre un expediente y un único número de registro, o pueden existir otras cardinalidades?

- ¿El código de trámite y el código de expediente son el mismo dato? ¿Qué formato y longitud deben tener?

- ¿El número de registro se reinicia por año, libro, sede o área, y quién está autorizado para generarlo?

- ¿El destinatario inicial será un usuario, un área, una oficina o una combinación de ellos?

- ¿Qué estados oficiales existen y qué operaciones se permiten después del cierre, anulación o archivamiento?

- ¿Cómo se corrige un asiento equivocado sin perder el historial ni reutilizar su número?

- ¿Qué información pasa a trazabilidad y qué debe ocurrir si faltan documentos o requisitos del trámite?

11. Lista de verificación para la entrega

| Estado | Criterio |
| --- | --- |
| ☐ | El objetivo, los actores y los conceptos documentales están explicados con palabras propias. |
| ☐ | Los flujos normales, estados y casos excepcionales están documentados. |
| ☐ | El modelo deriva del análisis y no de tablas inventadas primero. |
| ☐ | Las entidades, atributos, claves, relaciones y cardinalidades están justificadas. |
| ☐ | Trámite, expediente, documento y asiento de registro no se confunden entre sí. |
| ☐ | El SQL corresponde al modelo aprobado y se ejecuta sin errores en una base de prueba. |
| ☐ | Los códigos, correlativos, ejemplos, fuentes y pendientes están claramente identificados. |
| ☐ | Cada archivo asignado existe primero en la rama personal del responsable. |
| ☐ | Cada integrante tiene commits propios, push, captura y explicación; las correcciones fueron publicadas por el autor original. |
| ☐ | Ramírez registró las observaciones resueltas o pendientes y conservó la autoría durante la integración. |

12. Resultado esperado

Al finalizar, TramiCore deberá entregar una propuesta coherente y verificable para registrar trámites, organizar expedientes y conservar asientos del libro de registro. El diseño deberá ser flexible para incorporar formatos y reglas oficiales sin rehacer todo el módulo. La calidad se medirá por la comprensión, la coherencia entre análisis, modelo y SQL, la confiabilidad de los identificadores y la evidencia individual; no por la cantidad de páginas.

| Líder generalGeric · B_GERIC | Sublíder responsableRamírez · B_RAMIREZ | Fecha de revisiónPendiente de coordinación |
| --- | --- | --- |

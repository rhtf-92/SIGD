# PLAN DE TRABAJO

Grupo 4 “IdentiCore” · Módulo de usuarios internos y externos

Proyecto: Sistema Integral de Gestión Documentaria (SIGD)

Área: Backend

Líder general: Geric · B_GERIC

Sublíder: Segundo · B_SEGUNDO

Integrantes: Segundo, Tapullima y Jair

Fecha: 27 de agosto de 2026

Estado: Asignación preliminar pendiente de validación del módulo

> Propósito del documento: definir con claridad qué debe investigar, modelar, proponer y demostrar cada integrante. Este documento organiza el trabajo; no reemplaza el análisis funcional, el modelo de datos ni el borrador SQL que deberá producir el grupo.

1. Objetivo del grupo

Diseñar de manera preliminar el módulo que permitirá identificar y administrar a las personas que interactúan con el SIGD, diferenciando correctamente al usuario interno del usuario externo. El diseño debe contemplar que el interno mantiene una relación institucional y que el externo puede estar registrado o intervenir sin una cuenta permanente, según las reglas que finalmente confirme el profesor.

La información oficial sobre áreas, cargos, roles, requisitos de identificación y políticas de registro todavía está pendiente. Por ello, el grupo trabajará con estructuras genéricas, ejemplos ficticios y preguntas claramente marcadas para su posterior validación con el profesor o con la institución.

2. Alcance preliminar

El grupo debe estudiar y proponer cómo el sistema representará los siguientes elementos:

- Diferencias funcionales entre persona, usuario interno, usuario externo registrado y usuario externo no registrado.

- Datos mínimos de identificación y contacto, como tipo y número de documento, nombres y apellidos, sin convertir el DNI en la clave primaria técnica.

- Ciclo de registro, actualización, activación, desactivación y consulta de usuarios.

- Vinculación conceptual del usuario interno con un área institucional y con los roles definidos por el Grupo 3, sin duplicar ese módulo.

- Participación del usuario externo como remitente o solicitante, tenga o no una cuenta permanente.

- Integración conceptual con trámites, expedientes y libro de registro mediante identificadores internos, sin diseñar esos módulos completos.

- Validaciones, duplicados, estados y casos excepcionales relacionados con la identificación de usuarios.

3. Límites y criterio de mejora

En esta etapa no se implementarán endpoints, controladores ni migraciones definitivas. Tampoco se afirmará como oficial que todo usuario externo necesita cuenta, ni se inventarán cargos, áreas, permisos o documentos de identidad que todavía no hayan sido confirmados por la institución.

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
| Segundo | B_SEGUNDO | Sublíder y modelador | Modelo de datos, coordinación, revisión e integración. |
| Tapullima | B_TAPULLIMA | Analista funcional | Tipos de usuario, actores, datos, flujos, reglas y preguntas. |
| Jair | B_JAIR | Implementador SQL | SQL provisional, pruebas y evidencia técnica. |

5. Responsabilidades individuales

Segundo (B_SEGUNDO)

Responsabilidad asignada: Sublíder del grupo, responsable del modelo de datos y de la integración

Segundo coordinará el avance y convertirá el análisis funcional aprobado en un modelo coherente para usuarios internos y externos. Su función es orientar, revisar e integrar; no sustituir las entregas que Tapullima y Jair deben publicar en sus propias ramas.

### Actividades

- Organizar una reunión breve de inicio y confirmar que Tapullima y Jair entienden sus entregables y dependencias.

- Revisar el análisis de Tapullima y solicitar que ella corrija en B_TAPULLIMA cualquier contradicción, duplicación o vacío.

- Proponer entidades, atributos, claves, relaciones, cardinalidades y restricciones sin usar el DNI como clave primaria técnica.

- Representar el modelo mediante una herramienta apropiada, como diagrams.net, DrawSQL, dbdiagram.io, Lucidchart o una alternativa equivalente.

- Definir cómo distinguir persona, cuenta de usuario y perfil interno o externo, justificando si cada concepto necesita una entidad separada.

- Acordar con el Grupo 3 la referencia a áreas, roles y permisos, evitando duplicar sus tablas o asumir su diseño definitivo.

- Revisar el borrador SQL de Jair y pedirle que publique las correcciones en B_JAIR antes de integrarlas.

- Preparar la consolidación final y coordinar la explicación del grupo.

### Productos individuales

- Diagrama entidad–relación y modelo lógico de datos legibles, conservados en formato editable y versionados mediante Git.

- Diccionario preliminar de entidades, atributos, claves, estados y relaciones.

- Contrato conceptual de integración con áreas, roles, trámites y libro de registro.

- Registro breve de decisiones, supuestos y preguntas pendientes.

- Documento consolidado del grupo listo para revisión del líder general.

### Criterios de aceptación

- Cada entidad tiene propósito, atributos relevantes y relaciones justificadas.

- El modelo representa las diferencias entre interno, externo registrado y externo sin cuenta, sin duplicar innecesariamente datos personales.

- Las cardinalidades coinciden con el análisis funcional y permiten integrar los módulos vecinos.

- Las propuestas se distinguen de la información confirmada.

- El trabajo de los demás integrantes permanece identificable en la consolidación.

Tapullima (B_TAPULLIMA)

Responsabilidad asignada: Responsable del análisis funcional de usuarios internos y externos

Tapullima documentará qué representa cada tipo de usuario, cómo se identifica y en qué situaciones participa en el SIGD. Su entrega debe ser clara, verificable y suficiente para que Segundo pueda construir el modelo de datos.

### Actividades

- Definir el objetivo del módulo y los actores que registran, actualizan, consultan o representan a un usuario.

- Explicar las diferencias entre usuario interno, usuario externo registrado y usuario externo no registrado, indicando qué puntos aún deben confirmarse.

- Proponer una matriz de datos preliminares: tipo y número de documento, nombres, apellidos, contacto, condición, estado y relación institucional, sin presentarlos como campos oficiales.

- Describir los flujos normales de registro, identificación, actualización, activación, desactivación y consulta.

- Documentar casos excepcionales: documento duplicado, identidad incompleta, usuario inactivo, cuenta repetida, datos inconsistentes o pérdida de vínculo institucional.

- Investigar buenas prácticas sobre identificación y administración de usuarios y registrar las fuentes consultadas.

- Preparar preguntas para el profesor sobre registro externo, obligatoriedad del DNI, cuentas, estados y responsables de validación.

### Productos individuales

- Archivo de análisis funcional con objetivo, alcance, actores y definiciones.

- Matriz comparativa de usuario interno, externo registrado y externo no registrado.

- Flujos normales y excepcionales explicados paso a paso.

- Matriz preliminar de datos, fuentes y preguntas pendientes.

### Criterios de aceptación

- No copia definiciones sin explicarlas ni presenta propuestas como reglas oficiales.

- Las diferencias entre usuarios están descritas mediante condiciones observables.

- Cada flujo identifica entrada, validación, resultado y responsable cuando sea conocido.

- Los casos excepcionales indican qué debería impedir, advertir o registrar el sistema.

- La entrega puede ser explicada oralmente por su autora.

Jair (B_JAIR)

Responsabilidad asignada: Responsable del borrador SQL y de su validación técnica

Jair elaborará el SQL únicamente después de que Segundo apruebe el análisis y el modelo. Su tarea será concreta y verificable: demostrar que el diseño puede representarse en PostgreSQL sin convertirlo todavía en el esquema definitivo del proyecto.

### Actividades

- Convertir las entidades aprobadas en tablas provisionales usando PostgreSQL 18.6.

- Definir tipos de datos coherentes, claves primarias, claves foráneas, valores únicos, campos obligatorios, valores predeterminados y restricciones CHECK cuando correspondan.

- Aplicar una restricción única al documento de identidad solo cuando el modelo y las reglas aprobadas lo justifiquen; nunca usarlo como contraseña ni como clave primaria técnica.

- Proponer índices para búsquedas justificadas por documento, estado o tipo de usuario, evitando duplicar los generados por restricciones únicas.

- Agregar datos de prueba ficticios y claramente identificados como no oficiales.

- Ejecutar el script en una base local de pruebas y corregir todos los errores de sintaxis y dependencias.

- Documentar el orden de creación, las consultas de verificación y las observaciones que Segundo deba revisar.

### Productos individuales

- Archivo SQL provisional del módulo de usuarios, separado del esquema definitivo.

- Datos mínimos de prueba sin información personal real.

- Archivo de validación con casos de prueba y evidencia de ejecución sin errores.

- Notas técnicas sobre restricciones, índices y dependencias con áreas, roles y trámites.

### Criterios de aceptación

- El script se ejecuta desde una base vacía sin errores.

- Las claves y cardinalidades coinciden con el modelo aprobado.

- No se incluyen contraseñas en texto plano, credenciales ni datos personales reales.

- Los estados y tipos no quedan rígidamente inventados cuando todavía requieren confirmación.

- El SQL está marcado como borrador y puede modificarse después de recibir la información oficial.

6. Flujo de trabajo obligatorio

> Principio de evidencia individual: una tarea solo se considera entregada cuando el archivo asignado, sus correcciones y sus commits están publicados en la rama personal del responsable. Enviar el archivo por chat o verlo únicamente dentro de B_SEGUNDO no sustituye esa evidencia. El profesor podrá revisar B_TAPULLIMA, B_SEGUNDO y B_JAIR para identificar el aporte real de cada integrante.

El trabajo seguirá el siguiente orden cronológico. Una fase dependiente no debe comenzar hasta que la evidencia de la fase anterior esté publicada y revisada:

| Fase | Responsable | Acción y evidencia en rama personal | Condición para continuar |
| --- | --- | --- | --- |
| 0 | Todos | Actualizar su propia rama desde main y confirmar que está limpia y sincronizada. Nadie trabaja directamente en la rama de otro integrante. | Las tres ramas están preparadas. |
| 1 | Tapullima | Crear 01_analisis_usuarios_internos_externos.md en B_TAPULLIMA; realizar commits descriptivos y push. | Análisis y commits visibles en B_TAPULLIMA. |
| 2 | Segundo | Revisar B_TAPULLIMA. Si hay observaciones, Tapullima las corrige y publica nuevos commits. Después, Segundo integra la versión aprobada en B_SEGUNDO. | Análisis aprobado e integrado. |
| 3 | Segundo | Crear 02_modelo_datos_usuarios.md, diagrama, diccionario y decisiones en B_SEGUNDO; realizar commits propios y push. | Modelo visible en B_SEGUNDO. |
| 4 | Todo el grupo | Comparar el modelo con usuarios internos, externos registrados, externos sin cuenta y casos excepcionales. Cada autor corrige su propio archivo. | Análisis y modelo coherentes. |
| 5 | Jair | Actualizar B_JAIR con los insumos aprobados; crear y probar 03_usuarios.sql y 04_validacion_usuarios.md; realizar commits y push. | SQL y pruebas visibles en B_JAIR. |
| 6 | Segundo y Jair | Segundo revisa B_JAIR. Si hay observaciones, Jair las corrige en B_JAIR y publica nuevos commits. Luego Segundo integra la versión aprobada en B_SEGUNDO. | SQL aprobado e integrado. |
| 7 | Cada integrante | Comprobar que su rama conserva archivos, correcciones, commits y capturas. Segundo verifica además el paquete consolidado en B_SEGUNDO. | La autoría puede comprobarse sin depender de la rama consolidada. |
| 8 | Segundo y Geric | Segundo abre el Pull Request de B_SEGUNDO hacia B_GERIC. Geric revisa; cualquier corrección vuelve primero a la rama personal del responsable. | El módulo queda aprobado en B_GERIC. |
| 9 | Geric y profesor | Geric integra los módulos y abre el Pull Request de B_GERIC hacia main. El profesor revisa las ramas personales y realiza el merge final. | Entrega aceptada por el profesor. |

> Regla para las correcciones: Segundo revisa e integra, pero no reemplaza al autor. Si una tarea de Tapullima o Jair necesita cambios, el integrante responsable debe corregirla y publicarla primero en su propia rama. Solo después se incorpora la versión aprobada a B_SEGUNDO.

7. Estructura esperada de la entrega

| Archivo o evidencia | Dónde debe existir primero | Integración posterior |
| --- | --- | --- |
| 01_analisis_usuarios_internos_externos.md | B_TAPULLIMA, con commits y push de Tapullima | Segundo integra la versión aprobada en B_SEGUNDO |
| 02_modelo_datos_usuarios.md y diagrama | B_SEGUNDO, con commits y push de Segundo | Permanece en la rama consolidada |
| 02_diccionario_datos_usuarios.md | B_SEGUNDO, con commits y push de Segundo | Revisión grupal antes del SQL |
| 03_usuarios.sql | B_JAIR, con commits y push de Jair | Segundo integra la versión aprobada en B_SEGUNDO |
| 04_validacion_usuarios.md | B_JAIR, con commits y push de Jair | Segundo integra la versión aprobada en B_SEGUNDO |
| 05_decisiones_y_preguntas_pendientes.md | B_SEGUNDO, con commits y push de Segundo | Se incluye en el PR hacia B_GERIC |
| Capturas, commits y explicación individual | Rama personal de cada integrante | Se conserva como evidencia independiente |

8. Convenciones mínimas

- Redacción propia, clara y defendible; no se aceptará contenido copiado sin comprensión.

- Las fuentes consultadas deben identificarse. Se priorizarán disposiciones oficiales, documentación institucional y referencias técnicas confiables.

- El modelo debe separar la identidad de la cuenta cuando ello evite duplicaciones y permita representar externos sin una cuenta permanente.

- El SQL utilizará nombres en snake_case, términos consistentes y PostgreSQL 18.6 como referencia del equipo.

- El DNI u otro documento visible no debe confundirse con el identificador interno de la base de datos.

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

La revisión y la integración grupal son una etapa posterior. Segundo consultará las ramas personales, pedirá al autor que resuelva sus propias observaciones y consolidará únicamente las versiones aprobadas en B_SEGUNDO. No deberá editar directamente la rama de otro estudiante ni presentar como propio el archivo elaborado por ese estudiante.

Cuando el repositorio lo permita, se utilizarán integraciones que conserven los commits originales. Sin embargo, incluso después de integrar, B_TAPULLIMA, B_SEGUNDO y B_JAIR deben permanecer disponibles como evidencia independiente. Después, Segundo abrirá el Pull Request hacia B_GERIC; Geric revisará el módulo y abrirá el Pull Request final hacia main para que el profesor realice el merge.

10. Preguntas que el grupo debe dejar preparadas

- ¿Todo usuario interno tendrá obligatoriamente una cuenta registrada en el SIGD?

- ¿En qué casos un usuario externo deberá registrarse y en cuáles podrá presentar un trámite sin cuenta?

- ¿El DNI será obligatorio para todos o se admitirán otros documentos de identidad?

- ¿Qué datos personales y de contacto son obligatorios para cada tipo de usuario?

- ¿Quién puede registrar, validar, actualizar, activar o desactivar a un usuario?

- ¿Cómo se demostrará el vínculo de un usuario interno con un área, cargo o dependencia?

- ¿Se debe conservar el historial de cambios de datos, estados y vínculos institucionales?

- ¿Qué ocurre con los trámites anteriores cuando un usuario queda inactivo o pierde su vínculo institucional?

11. Lista de verificación para la entrega

| Estado | Criterio |
| --- | --- |
| ☐ | El objetivo, los actores y las diferencias entre usuarios están explicados con palabras propias. |
| ☐ | Los flujos normales, estados y casos excepcionales están documentados. |
| ☐ | El modelo deriva del análisis y no de tablas inventadas primero. |
| ☐ | Las entidades, atributos, claves, relaciones y cardinalidades están justificadas. |
| ☐ | El SQL corresponde al modelo aprobado y se ejecuta sin errores en una base de prueba. |
| ☐ | Los ejemplos están marcados como no oficiales. |
| ☐ | Las propuestas y los datos pendientes están claramente separados. |
| ☐ | Cada archivo asignado existe primero en la rama personal del responsable. |
| ☐ | Cada integrante cuenta con commits propios, push, captura y explicación; las correcciones fueron publicadas por el autor original. |
| ☐ | El profesor puede identificar cada aporte sin revisar solamente B_SEGUNDO y la consolidación no reemplazó las ramas personales. |
| ☐ | Segundo revisó el paquete y registró las observaciones resueltas o pendientes. |
| ☐ | El material está listo para ser explicado y defendido frente al profesor. |

12. Resultado esperado

Al finalizar, IdentiCore deberá entregar una propuesta coherente y verificable para administrar usuarios internos y externos, suficientemente flexible para incorporar después la información oficial sin rehacer todo el diseño. La calidad se medirá por la comprensión, la coherencia entre análisis, modelo y SQL, la justificación de decisiones y la evidencia individual; no por la cantidad de páginas.

| Líder generalGeric · B_GERIC | Sublíder responsableSegundo · B_SEGUNDO | Fecha de revisiónPendiente de coordinación |
| --- | --- | --- |

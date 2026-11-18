# PLAN DE TRABAJO

Grupo 1 “RutaDoc” · Trazabilidad, recepción, derivación y atención

Proyecto: Sistema Integral de Gestión Documentaria (SIGD)

Área: Backend

Líder general y responsable del grupo: Geric · B_GERIC

Integrantes: Geric, Jacobo y Jhasy

Fecha: 27 de agosto de 2026

Estado: Asignación preliminar pendiente de información institucional

> Propósito del documento: definir qué debe investigar, modelar, proponer y demostrar cada integrante del Grupo 1. El módulo deberá conservar el recorrido completo de cada expediente, desde su recepción hasta la atención final, sin inventar como oficiales las acciones, estados o jerarquías que aún deben confirmarse.

1. Objetivo del grupo

Diseñar de manera preliminar el módulo que permitirá conocer dónde se encuentra un trámite, qué usuario o área lo recibió, qué decisión tomó, hacia dónde fue derivado y cómo terminó su atención. El resultado debe ofrecer seguimiento verificable tanto al personal interno como al usuario solicitante, respetando los permisos que posteriormente defina la institución.

El profesor explicó un ciclo de trazabilidad, recepción, posible derivación y atención. Un trámite sencillo puede cerrar después de una sola revisión; uno jerárquico puede recorrer varias áreas antes de obtener respuesta. Como todavía no están confirmados los nombres de todas las acciones ni el significado de las letras observadas en clase, el grupo las registrará como PENDIENTES y trabajará con propuestas claramente identificadas.

2. Alcance preliminar

El grupo debe analizar y proponer cómo el sistema representará los siguientes elementos:

- Recepción inicial de un expediente proveniente del módulo del Grupo 2, conservando su código y número de registro sin duplicar sus datos.

- Historial cronológico de movimientos con fecha y hora, usuario responsable, área de origen, área de destino, acción realizada, estado anterior, estado resultante y observación.

- Derivación entre áreas cuando el documento requiera revisión, firma, autorización, subsanación o una decisión jerárquica.

- Confirmación de recepción por el destinatario, evitando que una derivación figure como atendida antes de que el área correspondiente la reciba.

- Atención final con respuesta, resultado, fecha de cierre y referencia al documento emitido, sin duplicar los adjuntos que administrará el Grupo 5.

- Consulta del estado actual y reconstrucción del recorrido completo a partir del historial, no solamente desde un campo de estado sobrescrito.

- Integración con usuarios internos y externos del Grupo 4, áreas y permisos del Grupo 3, trámites y expedientes del Grupo 2, y documentos del Grupo 5.

- Manejo de casos excepcionales: destino inválido, usuario no autorizado, derivación duplicada, devolución, observación, falta de requisitos, cierre indebido, reapertura y movimientos simultáneos.

3. Límites y criterio de mejora

En esta etapa no se fijarán como oficiales los nombres exactos de las acciones observadas en clase, la cantidad de niveles jerárquicos, los estados definitivos, los plazos de atención ni qué cargos pueden recibir, derivar, devolver, firmar o cerrar. Tampoco se implementarán endpoints ni migraciones definitivas. El SQL será un borrador comprobable y flexible para recibir la información institucional.

Cada decisión deberá marcarse con una de estas categorías:

| Categoría | Uso |
| --- | --- |
| CONFIRMADO | Indicación expresada por el profesor o información institucional verificada. |
| PROPUESTO | Mejora técnica planteada por el grupo, acompañada de una justificación. |
| PENDIENTE | Acción, estado, permiso, plazo o jerarquía que todavía debe validarse. |
| EJEMPLO | Dato ficticio creado solo para demostrar el funcionamiento. |

4. Organización del equipo

| Integrante | Rama | Función | Resultado principal |
| --- | --- | --- | --- |
| Geric | B_GERIC | Líder, arquitecto y modelador | Modelo de datos, decisiones, revisión e integración general. |
| Jacobo | B_JACOBO | Analista funcional | Actores, acciones, estados, flujos normales y excepcionales. |
| Jhasy | B_JHASY | Implementadora SQL y validación | SQL provisional, historial, restricciones, pruebas y evidencia técnica. |

5. Responsabilidades individuales

Geric (B_GERIC)

Responsabilidad asignada: Líder general, responsable de la arquitectura, el modelo de datos y la integración

Geric coordinará el trabajo del grupo y convertirá el análisis aprobado en un modelo coherente con los demás módulos del SIGD. Aunque B_GERIC también sea la rama de consolidación general, sus archivos y commits propios deberán distinguirse claramente de los aportes que Jacobo y Jhasy publiquen primero en sus ramas.

### Actividades

- Realizar una reunión breve de inicio y confirmar que Jacobo y Jhasy comprendan sus entregables, dependencias y criterios de aceptación.

- Revisar el análisis de Jacobo y pedirle que corrija en B_JACOBO cualquier acción inventada, flujo incompleto, contradicción o supuesto no marcado.

- Proponer entidades, atributos, claves, relaciones, cardinalidades y restricciones para movimientos, recepciones, derivaciones, atenciones, estados y observaciones.

- Diseñar una máquina de estados o matriz de transiciones preliminar que impida cambios incoherentes, marcando como PENDIENTE todo estado institucional no confirmado.

- Asegurar que el estado actual pueda obtenerse sin perder el historial y que las rectificaciones se registren mediante nuevos eventos, no borrando movimientos anteriores.

- Definir contratos conceptuales con expedientes del Grupo 2, áreas y permisos del Grupo 3, usuarios del Grupo 4 y documentos del Grupo 5, sin duplicar entidades.

- Revisar el SQL de Jhasy y solicitar que cualquier corrección sea publicada primero por ella en B_JHASY antes de integrarla.

- Consolidar el módulo en B_GERIC, revisar la evidencia de los tres integrantes y abrir el Pull Request final hacia main para el profesor.

### Productos individuales

- Diagrama entidad-relación y modelo lógico legibles, editables y versionados mediante Git.

- Diccionario preliminar de entidades, atributos, claves, estados y relaciones.

- Matriz de estados, acciones permitidas y transiciones marcadas como confirmadas, propuestas o pendientes.

- Contratos de integración con expedientes, áreas, usuarios, permisos, documentos y adjuntos.

- Registro de decisiones, supuestos, preguntas pendientes y paquete consolidado del módulo.

### Criterios de aceptación

- Cada entidad y transición tiene un propósito claro y una justificación funcional.

- El diseño conserva quién hizo cada acción, cuándo, desde qué área y hacia cuál.

- El estado actual no sustituye ni destruye el historial de movimientos.

- El modelo evita duplicar usuarios, áreas, expedientes, documentos y permisos.

- Los aportes de Jacobo y Jhasy siguen identificables después de integrarse en B_GERIC.

Jacobo (B_JACOBO)

Responsabilidad asignada: Responsable del análisis funcional y del flujo completo del trámite

Jacobo documentará cómo funciona el seguimiento desde la recepción hasta la atención final. Su análisis deberá servir para que Geric modele el sistema sin adivinar qué significan las acciones, letras, estados o responsabilidades explicadas parcialmente en clase.

### Actividades

- Definir el objetivo del módulo, los actores involucrados y qué información necesita consultar cada actor.

- Describir el flujo sencillo: expediente recibido, revisión, decisión y atención final con respuesta al solicitante.

- Describir el flujo jerárquico: múltiples derivaciones y recepciones entre áreas hasta completar todas las revisiones requeridas.

- Separar recepción, derivación, devolución, observación, adjunto, atención, cierre y reapertura como acciones propuestas; confirmar con el profesor cuáles existen realmente.

- Preparar un diagrama de actividad, BPMN o flujo equivalente y conservar también el archivo editable.

- Documentar casos excepcionales: área inexistente, responsable ausente, falta de requisitos, derivación repetida, rechazo, devolución, cierre anticipado y trámite sin respuesta.

- Investigar buenas prácticas de trazabilidad y auditoría documental, explicándolas con palabras propias y citando las fuentes utilizadas.

- Preparar preguntas concretas para validar nombres de acciones, estados, plazos, permisos, firmas, jerarquías y condiciones de cierre.

### Productos individuales

- Archivo de análisis funcional con objetivo, alcance, actores, entradas, acciones y resultados.

- Flujos normal, sencillo, jerárquico y excepcional explicados paso a paso.

- Diagrama funcional editable del recorrido del trámite.

- Matriz funcional de acción, responsable, precondición, resultado y siguiente estado.

- Lista de fuentes, decisiones y preguntas pendientes.

### Criterios de aceptación

- No presenta como oficial el significado de las letras o acciones que el grupo todavía no recuerda con certeza.

- Cada flujo identifica inicio, responsable, decisión, destino, resultado y condición de cierre.

- Los casos excepcionales indican qué debe conservarse en el historial.

- El análisis diferencia claramente recepción, movimiento, derivación y atención.

- La entrega puede ser explicada y defendida oralmente por su autora.

Jhasy (B_JHASY)

Responsabilidad asignada: Responsable del borrador SQL y de la validación técnica de la trazabilidad

Jhasy elaborará el SQL después de que Geric apruebe el análisis y el modelo. Su objetivo será demostrar que PostgreSQL puede conservar el historial, relacionar correctamente responsables y destinos, y rechazar operaciones incoherentes sin depender de datos institucionales todavía inexistentes.

### Actividades

- Convertir las entidades aprobadas en tablas provisionales compatibles con PostgreSQL 18.6.

- Definir claves primarias y foráneas, restricciones UNIQUE y CHECK, marcas de tiempo e índices justificados.

- Representar cada movimiento como un registro histórico; evitar actualizaciones que borren quién realizó una acción o cuál era el estado anterior.

- Usar referencias aprobadas para expediente, usuario, área, documento y responsable, sin copiar nombres o DNI dentro de cada movimiento.

- Preparar datos ficticios para un trámite sencillo, uno con varias derivaciones, una devolución y una atención final.

- Probar destinos inexistentes, acciones no permitidas, derivaciones duplicadas, cierre sin atención, movimientos simultáneos y referencias inválidas.

- Ejecutar el script desde una base vacía y corregir errores de sintaxis, dependencias, restricciones e índices.

- Documentar orden de ejecución, consultas de verificación, limitaciones y observaciones para Geric.

### Productos individuales

- Archivo SQL provisional de movimientos, recepciones, derivaciones y atenciones.

- Datos de prueba ficticios y consultas para reconstruir el recorrido completo.

- Archivo de validación con casos normales, jerárquicos, devueltos, cerrados y excepcionales.

- Notas técnicas sobre integridad histórica, transacciones, índices y dependencias externas.

### Criterios de aceptación

- El script se ejecuta desde una base vacía sin errores.

- Las claves y cardinalidades coinciden con el modelo aprobado.

- Las consultas reconstruyen el orden cronológico y muestran el responsable de cada acción.

- Las pruebas impiden destinos inválidos y transiciones incoherentes cuando el modelo las defina.

- No se incluyen credenciales, datos personales ni documentos reales.

6. Flujo de trabajo obligatorio

> Principio de evidencia individual: una tarea solo se considera entregada cuando el archivo asignado, sus correcciones y sus commits están publicados en la rama personal del responsable. Mostrar el resultado únicamente en B_GERIC no sustituye la evidencia de B_JACOBO o B_JHASY.

El trabajo seguirá este orden cronológico. Ninguna fase dependiente debe comenzar hasta que la evidencia anterior esté publicada y revisada:

| Fase | Responsable | Acción y evidencia en rama personal | Condición para continuar |
| --- | --- | --- | --- |
| 0 | Todos | Actualizar su rama desde main y confirmar que está limpia y sincronizada. | Las tres ramas están preparadas. |
| 1 | Jacobo | Crear 01_analisis_trazabilidad_recepcion_derivacion_atencion.md y el diagrama en B_JACOBO; realizar commits descriptivos y push. | Análisis visible en B_JACOBO. |
| 2 | Geric y Jacobo | Geric revisa B_JACOBO. Jacobo corrige y publica nuevos commits; después Geric integra la versión aprobada en B_GERIC. | Análisis aprobado e integrado. |
| 3 | Geric | Crear modelo, diccionario, matriz de estados y decisiones en B_GERIC; realizar commits propios y push. | Modelo visible en B_GERIC. |
| 4 | Todo el grupo | Comparar análisis, modelo, acciones, estados y contratos de integración. Cada autor corrige su propio archivo. | Análisis y modelo coherentes. |
| 5 | Jhasy | Actualizar B_JHASY con los insumos aprobados; crear y probar SQL y validación; realizar commits y push. | SQL y pruebas visibles en B_JHASY. |
| 6 | Geric y Jhasy | Geric revisa B_JHASY. Jhasy corrige en su rama y publica nuevos commits; luego Geric integra la versión aprobada. | SQL aprobado e integrado. |
| 7 | Cada integrante | Comprobar que su rama conserva archivos, correcciones, commits, push, captura y explicación. | La autoría puede comprobarse. |
| 8 | Geric | Revisar el paquete consolidado en B_GERIC y abrir el Pull Request hacia main. | Módulo listo para revisión. |
| 9 | Profesor | Revisar ramas personales, comentarios y Pull Request; solicitar correcciones o realizar el merge final. | Entrega aceptada. |

> Regla para las correcciones: Geric revisa e integra, pero no reemplaza al autor. Si una tarea de Jacobo o Jhasy necesita cambios, la responsable debe corregirla y publicarla primero en su propia rama.

7. Estructura esperada de la entrega

| Archivo o evidencia | Dónde debe existir primero | Integración posterior |
| --- | --- | --- |
| 01_analisis_trazabilidad_recepcion_derivacion_atencion.md | B_JACOBO, con commits y push de Jacobo | Geric integra la versión aprobada en B_GERIC |
| 01_diagrama_flujo_trazabilidad.drawio o equivalente | B_JACOBO, con archivo editable y exportación | Se integra junto con el análisis |
| 02_modelo_datos_trazabilidad.md y diagrama | B_GERIC, con commits y push de Geric | Permanece en la rama consolidada |
| 02_diccionario_datos_trazabilidad.md | B_GERIC, con commits y push de Geric | Revisión grupal antes del SQL |
| 03_trazabilidad_movimientos.sql | B_JHASY, con commits y push de Jhasy | Geric integra la versión aprobada en B_GERIC |
| 04_validacion_trazabilidad.md | B_JHASY, con commits y push de Jhasy | Geric integra la versión aprobada en B_GERIC |
| 05_decisiones_y_preguntas_pendientes.md | B_GERIC, con commits y push de Geric | Se incluye en el PR hacia main |
| Capturas, commits y explicación individual | Rama personal de cada integrante | Se conserva como evidencia independiente |

8. Convenciones mínimas

- Redacción propia, clara y defendible; no se aceptará contenido copiado sin comprensión.

- Las fuentes deben identificarse y las reglas institucionales tendrán prioridad cuando estén disponibles.

- Recepción, movimiento, derivación, devolución, atención y cierre se tratarán como conceptos distintos aunque puedan compartir información.

- Cada movimiento deberá indicar actor, fecha y hora, área, acción, estado anterior, estado resultante y observación cuando corresponda.

- El historial no se eliminará físicamente como método de corrección; una rectificación deberá conservar evidencia del movimiento original.

- El SQL usará snake_case, términos consistentes y PostgreSQL 18.6 como referencia del equipo.

- Los estados y acciones desconocidos se marcarán como PENDIENTES; los ejemplos nunca se presentarán como información oficial.

- Los datos de prueba serán ficticios y ningún DNI, nombre, código o documento de ejemplo será real.

- Toda optimización deberá explicar el problema que resuelve, su efecto esperado y lo que aún necesita validación.

9. Evidencia individual y control de versiones

La rama personal es la evidencia principal que revisará el profesor. Una tarea no cuenta como aporte individual si fue enviada únicamente por chat o si aparece solo después de que otra persona la integró. Cada integrante deberá conservar en su propia rama:

- El archivo o la sección que le fue asignada, claramente identificada.

- Uno o más commits propios con mensajes descriptivos y el push correspondiente.

- Las correcciones solicitadas, realizadas por el mismo autor mediante nuevos commits.

- Una captura donde se vea su rama, el commit y el archivo aportado.

- Una explicación breve de qué hizo, por qué lo hizo y cómo verificó el resultado.

- Capacidad para responder preguntas del líder general o del profesor.

Geric consultará B_JACOBO y B_JHASY, solicitará que cada autora resuelva sus propias observaciones y consolidará únicamente versiones aprobadas en B_GERIC. Sus propios archivos de arquitectura y modelado deberán tener commits claramente diferenciados.

Incluso después de integrar, B_JACOBO y B_JHASY deben permanecer disponibles como evidencia independiente. B_GERIC conservará tanto los commits propios de Geric como los commits integrados; después Geric abrirá el Pull Request hacia main para que el profesor revise y realice el merge.

10. Preguntas que el grupo debe dejar preparadas

- ¿Cuáles son los nombres oficiales y el significado exacto de las acciones o letras mostradas en recepción del trámite?

- ¿Qué diferencia existe entre recibir, adjuntar, observar, devolver, derivar, atender, cerrar y archivar?

- ¿Quién puede derivar un expediente y qué permisos dependen del rol, cargo o área?

- ¿La recepción por el área destinataria debe confirmarse manualmente y qué ocurre mientras está pendiente?

- ¿Qué estados oficiales existen y qué transiciones están permitidas desde cada estado?

- ¿Un expediente puede enviarse a varias áreas al mismo tiempo o solo seguir una ruta secuencial?

- ¿Cómo se registra una devolución, corrección o reapertura sin perder el historial anterior?

- ¿Qué documento o evidencia constituye la atención final y cómo se notifica al usuario solicitante?

- ¿Existen plazos, prioridades, firmas o niveles jerárquicos obligatorios según el tipo de documento?

11. Lista de verificación para la entrega

| Estado | Criterio |
| --- | --- |
| ☐ | El objetivo, los actores y las etapas del seguimiento están explicados con palabras propias. |
| ☐ | Los flujos sencillo, jerárquico y excepcional están documentados paso a paso. |
| ☐ | Las acciones y estados no confirmados están marcados como PENDIENTES. |
| ☐ | El modelo deriva del análisis y no de tablas inventadas primero. |
| ☐ | Las entidades, atributos, claves, relaciones y cardinalidades están justificadas. |
| ☐ | El historial permite conocer actor, fecha, área, acción, origen, destino y resultado. |
| ☐ | El SQL corresponde al modelo aprobado y se ejecuta sin errores en una base de prueba. |
| ☐ | Las pruebas reconstruyen el recorrido completo y rechazan referencias inválidas. |
| ☐ | Cada archivo asignado existe primero en la rama personal del responsable. |
| ☐ | Cada integrante tiene commits propios, push, captura y explicación; las correcciones fueron publicadas por el autor original. |
| ☐ | Geric conservó la autoría durante la integración y registró decisiones o preguntas pendientes. |

12. Resultado esperado

Al finalizar, RutaDoc deberá entregar una propuesta coherente y verificable para recibir expedientes, registrar cada movimiento, derivarlos entre áreas y documentar su atención final. El diseño deberá reconstruir el recorrido completo, conservar la autoría de cada acción y adaptarse a los estados, permisos y jerarquías oficiales cuando sean entregados. La calidad se medirá por la comprensión, la coherencia entre análisis, modelo y SQL, la integridad del historial y la evidencia individual; no por la cantidad de páginas.

| Líder general y del grupoGeric · B_GERIC | Integrantes responsablesJacobo · Jhasy | Fecha de revisiónPendiente de coordinación |
| --- | --- | --- |

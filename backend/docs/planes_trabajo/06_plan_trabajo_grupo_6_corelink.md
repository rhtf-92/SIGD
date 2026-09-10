# PLAN DE TRABAJO DEL SUBGRUPO

Grupo 6: Integración, calidad y pruebas del backend

Asignación individual, coordinación e integración técnica documental

Proyecto: Sistema Integral de Gestión Documentaria (SIGD)

Sublíder: Ricardo — rama B_AREVALO

Integrantes: B_AREVALO, B_DUQUE, B_REATEGUI y B_ZEVALLOS

Fecha: 28 de agosto de 2026

Estado: Asignación inicial — fase documental

> Decisión de organización: los cuatro integrantes formarán el Grupo 6. Ricardo coordinará el subgrupo desde B_AREVALO y Geric realizará la revisión final antes de integrar el trabajo al conjunto del proyecto.

1. Propósito

El Grupo 6 tendrá la responsabilidad de definir criterios comunes de integración, calidad y pruebas para el backend del SIGD. Su primera etapa será exclusivamente documental: organizará acuerdos que puedan usar todos los módulos sin invadir las responsabilidades funcionales ya asignadas a otros grupos.

El resultado debe permitir que los equipos implementen APIs coherentes, comuniquen errores de manera uniforme, preparen pruebas de integración y registren contratos pendientes entre módulos.

2. Alcance de la primera etapa

- Crear cuatro documentos dentro de backend/docs/integracion/.

- Definir propuestas técnicas generales; los ejemplos deberán marcarse como no oficiales cuando todavía requieran validación.

- Trabajar únicamente en el archivo asignado a cada rama y conservar la autoría individual en Git.

- Revisar la coherencia con la documentación existente del SIGD sin cambiar los archivos de otros grupos.

- Dejar claramente identificadas las decisiones confirmadas, propuestas y pendientes.

3. Equipo y entregables

| Rama | Rol | Entregable principal |
| --- | --- | --- |
| B_AREVALO | Ricardo — sublíder | Contratos, decisiones pendientes, revisión e integración del subgrupo. |
| B_DUQUE | Responsable de convenciones | Convenciones comunes para las APIs del backend. |
| B_REATEGUI | Responsable de errores | Catálogo de errores y criterios de validación. |
| B_ZEVALLOS | Responsable de pruebas | Plan de pruebas de integración entre módulos. |

4. Asignaciones individuales

B_AREVALO — Ricardo, sublíder del Grupo 6

Archivo asignado: backend/docs/integracion/04_contratos_y_decisiones_pendientes.md

Objetivo: coordinar las dependencias entre módulos y consolidar las decisiones que todavía necesitan confirmación.

Contenido mínimo:

- Matriz de contratos entre módulos: productor, consumidor, dato o servicio, validación esperada y estado.

- Decisiones confirmadas, propuestas y pendientes, claramente diferenciadas.

- Riesgos de integración, responsables de resolverlos y evidencia necesaria para cerrarlos.

- Lista de verificación para revisar los otros tres documentos del Grupo 6.

- Registro de observaciones de revisión sin reescribir ni apropiarse del trabajo individual de los demás integrantes.

Evidencia de cumplimiento: archivo completo, revisión documentada de los tres aportes, commit propio y consolidación limpia en B_AREVALO.

> Responsabilidad adicional del sublíder: Ricardo debe coordinar, revisar y solicitar correcciones cuando sean necesarias. No debe aceptar contenido que contradiga otros módulos ni integrar archivos fuera del alcance del Grupo 6.

B_DUQUE — Convenciones comunes de API

Archivo asignado: backend/docs/integracion/01_convenciones_api_backend.md

Objetivo: proponer una forma uniforme de diseñar y documentar las APIs del backend.

Contenido mínimo:

- Reglas de nombres para rutas, recursos, parámetros y campos JSON.

- Estructura general de solicitudes y respuestas, sin inventar endpoints funcionales de otros grupos.

- Uso conceptual de métodos y códigos HTTP.

- Criterios para paginación, filtros, ordenamiento y búsquedas.

- Encabezados comunes, identificador de correlación y temas pendientes como idempotencia.

- Ejemplos ficticios y una lista de decisiones que requieren validación del equipo.

Evidencia de cumplimiento: documento explicable con palabras propias, ejemplos marcados como propuestos y commit realizado únicamente sobre el archivo asignado.

B_REATEGUI — Catálogo de errores y validaciones

Archivo asignado: backend/docs/integracion/02_catalogo_errores_backend.md

Objetivo: definir cómo todos los módulos comunicarán errores de forma coherente, comprensible y segura.

Contenido mínimo:

- Estructura conceptual de una respuesta de error: código, mensaje, detalles, campo afectado y correlación.

- Categorías: validación, autenticación, autorización, recurso inexistente, conflicto, regla de negocio, integración y error interno.

- Convención para códigos internos y relación conceptual con los códigos HTTP.

- Mensajes aptos para el usuario y detalles técnicos reservados para registros internos.

- Ejemplos ficticios de validaciones de campos y errores entre módulos.

- Criterios para no exponer credenciales, datos personales, rutas internas ni trazas sensibles.

Evidencia de cumplimiento: catálogo consistente, ejemplos seguros, pendientes identificados y commit limitado al archivo asignado.

B_ZEVALLOS — Plan de pruebas de integración

Archivo asignado: backend/docs/integracion/03_plan_pruebas_integracion.md

Objetivo: establecer cómo se verificará que los módulos del SIGD funcionen correctamente al comunicarse entre sí.

Contenido mínimo:

- Objetivo, alcance, componentes involucrados y dependencias externas.

- Criterios de entrada y salida para ejecutar y aprobar las pruebas.

- Escenarios positivos, validaciones, permisos, conflictos, reintentos, concurrencia e idempotencia cuando correspondan.

- Uso obligatorio de datos ficticios y ambientes de prueba controlados.

- Formato de caso de prueba: identificador, precondición, pasos, datos, resultado esperado, resultado obtenido y evidencia.

- Criterios para registrar defectos, priorizarlos y repetir una prueba después de la corrección.

Evidencia de cumplimiento: plan aplicable a varios módulos, matriz de escenarios, criterios de aceptación claros y commit limitado al archivo asignado.

5. Estructura común de los documentos

Cada entregable deberá mantener, como mínimo, la siguiente estructura:

- Propósito y problema que resuelve.

- Alcance y elementos fuera de alcance.

- Definiciones necesarias para entender el tema.

- Propuesta principal y reglas aplicables.

- Ejemplos ficticios, marcados como ejemplos cuando no sean oficiales.

- Dependencias con otros grupos o módulos.

- Decisiones confirmadas y pendientes de validación.

- Criterios de aceptación del documento.

6. Flujo de trabajo e integración

- Cada integrante actualiza su rama antes de comenzar y confirma que trabajará únicamente en el archivo asignado.

- El integrante investiga, redacta con sus propias palabras y verifica que no contradiga la documentación vigente.

- El integrante realiza un commit con su autoría y publica su rama para revisión.

- Ricardo revisa contenido, alcance, claridad y evidencia; si encuentra problemas, solicita correcciones en la rama del autor.

- Cuando los tres aportes estén aprobados, Ricardo los integra en B_AREVALO y verifica que el árbol quede limpio.

- Geric revisa el conjunto y decide su integración en B_GERIC. Ningún integrante del Grupo 6 modifica main directamente.

7. Criterios de aceptación

- El documento asignado existe en la ruta acordada y no se modificaron archivos ajenos.

- El contenido se entiende y puede ser explicado por su autor sin leerlo palabra por palabra.

- Las propuestas, ejemplos y pendientes están diferenciados de las decisiones confirmadas.

- No se incluyen secretos, credenciales, datos personales reales ni información sensible innecesaria.

- Las referencias a otros módulos indican quién es responsable y qué contrato falta confirmar.

- El commit conserva la autoría individual, la rama está publicada y el árbol de trabajo queda limpio.

- Ricardo registra el resultado de la revisión y Geric aprueba la integración final del subgrupo.

8. Límites para evitar duplicación

> Fuera de alcance en esta etapa: el Grupo 6 no implementará endpoints de negocio, no modificará modelos ni SQL de RutaDoc, no desarrollará autenticación, usuarios o permisos, y no cambiará archivos pertenecientes a otros grupos.

- No editar los documentos backend/docs/rutadoc/01_*, 02_* o 05_*.

- No reemplazar las reglas funcionales definidas por los grupos propietarios de cada módulo.

- No crear tablas, migraciones, controladores, servicios o middleware productivo durante la fase documental.

- No fusionar directamente en main ni alterar la autoría de los commits de otros integrantes.

- Si aparece una contradicción, registrarla como pendiente y consultarla; no resolverla de manera silenciosa.

9. Segunda etapa prevista

Al finalizar esta entrega, el proyecto tendrá una base común para integrar módulos, revisar la calidad del backend y preparar pruebas, con un producto verificable por integrante y una responsabilidad clara de coordinación para Ricardo. Una segunda etapa técnica podrá incluir pruebas automáticas, validaciones compartidas o manejo común de errores, pero deberá definirse mediante una nueva asignación.

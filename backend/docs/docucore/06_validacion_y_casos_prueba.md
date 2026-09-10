# Validación y casos de prueba: documentos y formularios

**Sistema:** SIGD — DocuCore
**Alcance:** configuración de tipos de documento, formularios versionados y captura de datos para la creación de expedientes en borrador.
**Base:** análisis funcional A, modelo de datos v2.0 y script SQL v3.
**Estado esperado general:** si todas las validaciones son correctas, se crea o actualiza el expediente en `BORRADOR`. La radicación y los adjuntos se validan en el módulo correspondiente.
**Versión de este documento:** 2.0 — corrige VAL-FOR-003, CP-05, VAL-FOR-008/CP-18 y agrega casos de versionado, para reflejar que `FORMULARIO` admite varias versiones y que `EXPEDIENTE` referencia `id_formulario` (versión exacta), no `id_tipo_documento`.

## Reglas de validación

| Código | Regla | Resultado esperado |
|---|---|---|
| VAL-FOR-001 | El código del tipo de documento es obligatorio y único. | No se permite registrar un código vacío ni repetido. |
| VAL-FOR-002 | El tipo de documento debe tener nombre. | Se rechaza el registro sin nombre. |
| VAL-FOR-003 | Un tipo de documento puede tener varias **versiones** de formulario, pero solo una puede estar activa a la vez. | Se permite crear una nueva versión; no se permite tener dos versiones activas simultáneamente para el mismo tipo de documento. |
| VAL-FOR-004 | Todo campo tiene nombre y orden positivo; el orden es único dentro de su versión de formulario. | Se rechazan nombres vacíos, orden 0/negativo y órdenes repetidos dentro de la misma versión. |
| VAL-FOR-005 | Un campo `SELECCION` requiere opciones; los demás tipos no deben almacenarlas. | Se rechaza una configuración incoherente. |
| VAL-FOR-006 | Los campos obligatorios deben tener un valor no vacío antes de guardar/enviar el formulario. | Se muestra el campo pendiente y no se completa la operación. |
| VAL-FOR-007 | El valor ingresado debe corresponder a su tipo: texto, número, fecha o una opción configurada. | Se informa el campo con formato inválido. |
| VAL-FOR-008 | Un expediente solo puede guardar valores de campos de la **versión exacta de formulario** (`id_formulario`) que tiene asociada — no de otra versión del mismo tipo de documento, ni de otro tipo. | Se rechaza la asociación inconsistente. |
| VAL-FOR-009 | Un campo solo puede tener una respuesta por expediente. | Se actualiza la respuesta existente o se rechaza el segundo registro. |
| VAL-FOR-010 | Un expediente en `BORRADOR` no tiene código oficial ni fecha de radicación. | Se rechaza cualquier combinación inconsistente de estado, código y fecha. |
| VAL-FOR-011 *(nuevo)* | Un expediente ya creado sigue funcionando con la versión de formulario que tenía al momento de su creación, aunque después se publique una versión nueva. | El expediente antiguo no se ve afectado por cambios posteriores al formulario. |

## Datos de prueba base

Crear el tipo de documento **SOL-001 — Solicitud general**, con la versión 1 del formulario:

| Orden | Campo | Tipo | Obligatorio | Opciones |
|---:|---|---|---|---|
| 1 | asunto | TEXTO | Sí | — |
| 2 | cantidad_copias | NUMERO | Sí | — |
| 3 | fecha_solicitud | FECHA | Sí | — |
| 4 | tipo_persona | SELECCION | Sí | NATURAL, JURIDICA |
| 5 | observacion | TEXTO | No | — |

Para los casos de versionado (CP-21 a CP-23), se crea además una **versión 2** del mismo tipo de documento, agregando el campo `numero_expediente_anterior` (TEXTO, opcional) a los cinco campos anteriores.

## Casos de prueba

| ID | Escenario y datos de entrada | Resultado esperado |
|---|---|---|
| CP-01 | Registrar `SOL-001`, nombre "Solicitud general". | El tipo se registra correctamente. |
| CP-02 | Registrar otro tipo con código `SOL-001`. | Se rechaza por código duplicado (VAL-FOR-001). |
| CP-03 | Registrar un tipo con código vacío o solo espacios. | Se rechaza (VAL-FOR-001). |
| CP-04 | Crear el formulario versión 1 para `SOL-001`, `activo = true`. | Se crea correctamente. |
| CP-05 | Crear un segundo formulario (versión 2) para `SOL-001`. | **Se crea correctamente** — ya no se rechaza (VAL-FOR-003 corregida). Ver CP-21 a CP-23 para el comportamiento de activación. |
| CP-06 | Agregar campo `asunto` con orden 1 en la versión 1. | El campo se registra. |
| CP-07 | Agregar otro campo con orden 1 en la misma versión de formulario. | Se rechaza por orden duplicado (VAL-FOR-004). |
| CP-08 | Configurar `tipo_persona` como `SELECCION` sin opciones. | Se rechaza (VAL-FOR-005). |
| CP-09 | Configurar `observacion` como `TEXTO` con opciones `A,B`. | Se rechaza (VAL-FOR-005). |
| CP-10 | Crear un expediente de la versión 1 de `SOL-001` en `BORRADOR`, sin código oficial. | Se crea correctamente, referenciando `id_formulario` de la versión 1. |
| CP-11 | Crear un expediente `BORRADOR` con código oficial `EXP-2026-0001`. | Se rechaza (VAL-FOR-010). |
| CP-12 | Guardar: asunto "Solicitud de certificado", cantidad 2, fecha válida, tipo_persona `NATURAL`. | Se guardan los cuatro valores y el expediente continúa en borrador. |
| CP-13 | Intentar enviar dejando `asunto` vacío. | Se bloquea el envío y se indica que `asunto` es obligatorio (VAL-FOR-006). |
| CP-14 | Ingresar `dos` en `cantidad_copias`. | Se rechaza por formato numérico inválido (VAL-FOR-007). |
| CP-15 | Ingresar `29/02/2025` como fecha. | Se rechaza por fecha inexistente (VAL-FOR-007). |
| CP-16 | Elegir `EXTRANJERO` en `tipo_persona`. | Se rechaza: no pertenece a las opciones configuradas (VAL-FOR-007). |
| CP-17 | Guardar dos respuestas para `asunto` en el mismo expediente. | Solo debe existir una; se actualiza o se rechaza el duplicado (VAL-FOR-009). |
| CP-18 | Intentar guardar en un expediente de la versión 1 un valor para el campo `numero_expediente_anterior`, que solo existe en la versión 2. | Se rechaza por pertenencia inválida — el campo no es de la versión exacta que el expediente referencia (VAL-FOR-008 corregida). |
| CP-19 | Dejar `observacion` sin valor. | Se permite porque es opcional. |
| CP-20 | Marcar el formulario o tipo de documento como inactivo e intentar iniciar un nuevo expediente. | Se bloquea la creación y se informa que el trámite no está disponible. |
| CP-21 *(nuevo)* | Activar la versión 2 de `SOL-001` (`activo = true`). | La versión 2 queda activa y la versión 1 pasa automáticamente a `activo = false` (índice único parcial). Nunca hay dos versiones activas a la vez para el mismo tipo de documento. |
| CP-22 *(nuevo)* | Con la versión 2 ya activa, consultar el expediente creado en CP-10 (creado sobre la versión 1). | El expediente sigue referenciando la versión 1 sin cambios; sus valores de campo siguen siendo válidos (VAL-FOR-011). |
| CP-23 *(nuevo)* | Iniciar un expediente nuevo de `SOL-001` estando la versión 2 activa. | El expediente nuevo se crea referenciando `id_formulario` de la versión 2, no la 1. |

## Criterio de aceptación

La funcionalidad se acepta cuando los casos CP-01 a CP-23 producen el resultado esperado, no se pueden guardar configuraciones ni respuestas inconsistentes, nunca hay dos versiones de formulario activas simultáneamente para un mismo tipo de documento, los expedientes antiguos no se ven afectados por nuevas versiones, y los mensajes identifican el campo que debe corregirse.

> Nota: las validaciones de tipo de dato y obligatoriedad deben ejecutarse en la interfaz y en el servicio de backend. El script SQL asegura además la integridad estructural, la unicidad de versión activa y la pertenencia del campo a la versión exacta de formulario del expediente; PostgreSQL no puede interpretar por sí solo el contenido de texto como número o fecha sin una regla adicional de aplicación.
>
> Pendiente: este documento describe el plan de pruebas. Sigue faltando la ejecución real (INSERTs) contra una base de datos vacía, con evidencia de resultado, errores encontrados y correcciones — ver solicitud de corrección previa a Piero.
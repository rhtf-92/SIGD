# Validación y casos de prueba: documentos y formularios

**Sistema:** SIGD — DocuCore  
**Alcance:** configuración de tipos de documento, formularios y captura de datos para la creación de expedientes en borrador.  
**Base:** análisis funcional A y modelo de datos entregados al equipo.  
**Estado esperado general:** si todas las validaciones son correctas, se crea o actualiza el expediente en `BORRADOR`. La radicación y los adjuntos se validan en el módulo correspondiente.

## Reglas de validación

| Código | Regla | Resultado esperado |
|---|---|---|
| VAL-FOR-001 | El código del tipo de documento es obligatorio y único. | No se permite registrar un código vacío ni repetido. |
| VAL-FOR-002 | El tipo de documento debe tener nombre. | Se rechaza el registro sin nombre. |
| VAL-FOR-003 | Cada tipo de documento tiene un único formulario activo en este modelo. | No se permite un segundo formulario para el mismo tipo de documento. |
| VAL-FOR-004 | Todo campo tiene nombre y orden positivo; el orden es único dentro del formulario. | Se rechazan nombres vacíos, orden 0/negativo y órdenes repetidos. |
| VAL-FOR-005 | Un campo `SELECCION` requiere opciones; los demás tipos no deben almacenarlas. | Se rechaza una configuración incoherente. |
| VAL-FOR-006 | Los campos obligatorios deben tener un valor no vacío antes de guardar/enviar el formulario. | Se muestra el campo pendiente y no se completa la operación. |
| VAL-FOR-007 | El valor ingresado debe corresponder a su tipo: texto, número, fecha o una opción configurada. | Se informa el campo con formato inválido. |
| VAL-FOR-008 | Un expediente solo puede guardar valores de campos del formulario de su tipo de documento. | Se rechaza la asociación inconsistente. |
| VAL-FOR-009 | Un campo solo puede tener una respuesta por expediente. | Se actualiza la respuesta existente o se rechaza el segundo registro. |
| VAL-FOR-010 | Un expediente en `BORRADOR` no tiene código oficial ni fecha de radicación. | Se rechaza cualquier combinación inconsistente de estado, código y fecha. |

## Datos de prueba base

Crear el tipo de documento **SOL-001 — Solicitud general**, con el formulario siguiente:

| Orden | Campo | Tipo | Obligatorio | Opciones |
|---:|---|---|---|---|
| 1 | asunto | TEXTO | Sí | — |
| 2 | cantidad_copias | NUMERO | Sí | — |
| 3 | fecha_solicitud | FECHA | Sí | — |
| 4 | tipo_persona | SELECCION | Sí | NATURAL, JURIDICA |
| 5 | observacion | TEXTO | No | — |

## Casos de prueba

| ID | Escenario y datos de entrada | Resultado esperado |
|---|---|---|
| CP-01 | Registrar `SOL-001`, nombre “Solicitud general”. | El tipo se registra correctamente. |
| CP-02 | Registrar otro tipo con código `SOL-001`. | Se rechaza por código duplicado (VAL-FOR-001). |
| CP-03 | Registrar un tipo con código vacío o solo espacios. | Se rechaza (VAL-FOR-001). |
| CP-04 | Crear el formulario v1 para `SOL-001`. | Se crea correctamente. |
| CP-05 | Crear un segundo formulario para `SOL-001`. | Se rechaza por relación 1:1 (VAL-FOR-003). |
| CP-06 | Agregar campo `asunto` con orden 1. | El campo se registra. |
| CP-07 | Agregar otro campo con orden 1 en el mismo formulario. | Se rechaza por orden duplicado (VAL-FOR-004). |
| CP-08 | Configurar `tipo_persona` como `SELECCION` sin opciones. | Se rechaza (VAL-FOR-005). |
| CP-09 | Configurar `observacion` como `TEXTO` con opciones `A,B`. | Se rechaza (VAL-FOR-005). |
| CP-10 | Crear un expediente de `SOL-001` en `BORRADOR`, sin código oficial. | Se crea correctamente. |
| CP-11 | Crear un expediente `BORRADOR` con código oficial `EXP-2026-0001`. | Se rechaza (VAL-FOR-010). |
| CP-12 | Guardar: asunto “Solicitud de certificado”, cantidad 2, fecha válida, tipo_persona `NATURAL`. | Se guardan los cuatro valores y el expediente continúa en borrador. |
| CP-13 | Intentar enviar dejando `asunto` vacío. | Se bloquea el envío y se indica que `asunto` es obligatorio (VAL-FOR-006). |
| CP-14 | Ingresar `dos` en `cantidad_copias`. | Se rechaza por formato numérico inválido (VAL-FOR-007). |
| CP-15 | Ingresar `29/02/2025` como fecha. | Se rechaza por fecha inexistente (VAL-FOR-007). |
| CP-16 | Elegir `EXTRANJERO` en `tipo_persona`. | Se rechaza: no pertenece a las opciones configuradas (VAL-FOR-007). |
| CP-17 | Guardar dos respuestas para `asunto` en el mismo expediente. | Solo debe existir una; se actualiza o se rechaza el duplicado (VAL-FOR-009). |
| CP-18 | Intentar guardar en un expediente de `SOL-001` un campo creado para otro formulario. | Se rechaza por pertenencia inválida (VAL-FOR-008). |
| CP-19 | Dejar `observacion` sin valor. | Se permite porque es opcional. |
| CP-20 | Marcar el formulario o tipo de documento como inactivo e intentar iniciar un nuevo expediente. | Se bloquea la creación y se informa que el trámite no está disponible. |

## Criterio de aceptación

La funcionalidad se acepta cuando los casos CP-01 a CP-20 producen el resultado esperado, no se pueden guardar configuraciones ni respuestas inconsistentes y los mensajes identifican el campo que debe corregirse.

> Nota: las validaciones de tipo de dato y obligatoriedad deben ejecutarse en la interfaz y en el servicio de backend. El script SQL asegura además la integridad estructural y la pertenencia del campo al expediente; PostgreSQL no puede interpretar por sí solo el contenido de texto como número o fecha sin una regla adicional de aplicación.
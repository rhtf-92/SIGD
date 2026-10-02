# Lecturas asignadas a B_JHASY

## T-BE-RD-10: proyección de estado actual

Se reutiliza `sigd_rut.estado_actual_expediente`; no se crea
`v_estado_actual_tramite`. La tabla tiene una fila por expediente con clave
primaria `expediente_id`, secuencia, estado, evento, área, movimiento, fecha y
operador. La migración reconstruye el máximo por secuencia entre movimientos
normales y compensatorios; sus triggers mantienen la proyección al insertar
historial. La consulta operativa la consume por igualdad de clave. Una vista
calculada volvería a recorrer el historial y duplicaría la solución. Las
pruebas de bandeja verifican esa proyección y el benchmark reproducible existente
carga 50 000 expedientes y 45 000 movimientos. No se presenta una medición nueva
sin ejecutar ese benchmark.

## Trazabilidad

`GET /api/v1/expedientes/:id/trazabilidad` combina los movimientos canónicos
`sigd_rut.movimiento_tramite` y `sigd_rut.movimiento_compensatorio`, ordenados
por secuencia, fecha y UUID. No modifica las tablas append-only. Informa la
duración en milisegundos y minutos entre actuaciones; la última estación abierta
tiene duración `null` porque el contrato no establece medir hasta la hora de
consulta.

El DDL actual garantiza `datos.areaId`; las reversiones añaden sus datos
administrativos. La consulta también proyecta las claves JSONB `remitente`,
`destinatario` y `proveido` si un escritor las incluye, y siempre conserva el
objeto completo en `datosAsociados`. El modelo actual no documenta escritores de
esas tres claves ni un contrato para resolver nombres/personas/áreas, por lo que
no se inventan identificadores ni joins externos. La ausencia de esos datos no
impide mostrar el timeline.

## Foliación y checksum

`GET /api/v1/expedientes/:id/foliacion` lee la tabla canónica de TramiCore
`sigd_tra.expediente_documento_folio`, ordenada estrictamente por
`folio_inicio ASC`. El DDL de `backend/docs/04_tramicore/03_esquema_sigd_tra_cut_foliado.sql`
define `id_documento BIGINT` y no almacena hash, nombre ni tipo documental.
DocuCore define `sigd_doc.documento_adjunto.id_documento_adjunto UUID` y
`sha256_hash CHAR(64)` en
`backend/docs/03_docucore/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql`.
No existe una FK ni contrato que relacione el BIGINT foliado con ese UUID; por
tanto no hay un join seguro. Versiones históricas de RutaDoc mencionan
`movimiento_documento.documento_id`, pero lo dejan explícitamente como REF externa
pendiente y tampoco lo conectan con `id_documento` de TramiCore. No se añade una
proyección local redundante: faltan tanto la relación verificable como una fuente
de sincronización de hash. El port de metadata permite una integración futura;
el default devuelve checksum, nombre y tipo `null`, sin recalcular ni fabricar
valores.

## SLA y calendario laboral

No hay tabla física ni contrato utilizable `sigd_org.calendario_laboral` en el
DDL/migraciones de OrganiCore revisados. El plan maestro sí enumera como feriados
regionales de Ucayali el 24 de junio (Fiesta de San Juan) y el 13 de octubre
(Aniversario de Pucallpa), en
`backend/docs/PLAN_DE_TRABAJO_BACKEND_100_CONFORMIDAD.md` (secciones de feriados,
métricas y asignación RutaDoc).

RutaDoc mantiene `CalendarioLaboralPort` y entrega por defecto
`CalendarioLaboralRutaDoc`, sin añadir objetos a `sigd_org`. Este seed incluye
las dos fechas anuales señaladas por el plan y admite días excepcionales y otra
lista de fechas anuales mediante configuración; la inyección del port permite
reemplazarlo cuando exista el calendario institucional. El motor SLA no conoce
feriados: opera con fechas civiles ISO, interpreta el inicio como fecha de Lima,
empieza a contar desde el día siguiente y excluye fines de semana más las fechas
recibidas del port.

El documento del plan maestro asigna los dos feriados al calendario Ucayali;
hasta conectar una fuente institucional, RutaDoc los trata como configuración
predeterminada local reemplazable, no como una inferencia del algoritmo. Ninguna
documentación define el cambio VERDE→AMARILLO. La política local explícita y
configurable es AMARILLO desde 80% (24 de 30 días). ROJO empieza estrictamente
al día hábil 31; al día 30 permanece AMARILLO.

## CCD

La búsqueda de documentación, esquemas, migraciones y código del backend no
encontró catálogo CCD canónico ni tablas/migraciones de series y subseries. Para
que la asignación sea ejecutable de forma independiente, RutaDoc proporciona un
seed mínimo demostrativo local: serie `DEMO-01 Serie de ejemplo (no oficial)` y
subserie `DEMO-01.01 Subserie de ejemplo (no oficial)`. Los códigos/nombres son
marcadores de demostración, no clasificación institucional ni datos archivísticos
reales. El seed se reemplaza mediante `ClasificadorCcdPort`. El servicio ordena
cada nivel por código y el endpoint responde con ese árbol sin necesitar otro
módulo.

## Pruebas y composición

`crearRouterRutaDoc` conecta por defecto calendario y catálogo locales;
`construirApp` permite sustituir ambos ports. La suite cubre configuración de
fechas regionales y excepcionales, fines de semana, respuestas HTTP 200 con
adapters predeterminados, jerarquía CCD determinista, sustitución de ports,
checksum nulo por defecto y passthrough de metadata únicamente cuando un adapter
inyectado aporta un valor.

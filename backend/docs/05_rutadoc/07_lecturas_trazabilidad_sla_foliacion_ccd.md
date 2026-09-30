# Lecturas asignadas a B_JHASY

## T-BE-RD-10: proyección de estado actual

Se reutiliza `sigd_rut.estado_actual_expediente`; no se crea
`v_estado_actual_tramite`. La tabla tiene una fila por expediente con clave
primaria `expediente_id`, secuencia, estado, evento, área, movimiento, fecha y
operador. La migración reconstruye el máximo por secuencia entre movimientos
normales y compensatorios; sus triggers mantienen la proyección al insertar
historial. La consulta operativa ya la consume mediante igualdad por clave. Una
vista calculada volvería a recorrer el historial y duplicaría la solución.
Las pruebas actuales de bandeja verifican esa proyección y el benchmark
reproducible existente carga 50 000 expedientes y 45 000 movimientos. No se
presenta una medición nueva sin ejecutar el benchmark.

## Trazabilidad

`GET /api/v1/expedientes/:id/trazabilidad` combina movimientos normales y
compensatorios, ordenados por secuencia, fecha y UUID. No modifica las tablas
append-only. Informa la duración en milisegundos y minutos entre actuaciones
como tiempo de la estación de origen; la última estación abierta tiene duración
`null` porque el contrato no establece medir hasta la hora de consulta. Sólo `datos.areaId`
está garantizado por el DDL. Remitente, destinatario y proveído se devuelven como
`null` hasta que exista un contrato que permita resolverlos; los datos JSON
existentes se conservan en `datosAsociados`.

## Foliación

`GET /api/v1/expedientes/:id/foliacion` lee la tabla canónica de TramiCore
`sigd_tra.expediente_documento_folio`, ordenada estrictamente por
`folio_inicio ASC`. Su contrato sólo incluye ID del documento y rango. DocuCore
almacena SHA-256 en `sigd_doc.documento_adjunto.sha256_hash`, pero no se encontró
un contrato que relacione ese identificador con `id_documento` de TramiCore. El
port `DocumentoMetadataPort` permite conectar esa integración; sin ella, nombre,
tipo y checksum son `null`. No se recalculan ni inventan checksums.

## SLA y calendario

El motor puro usa fechas civiles ISO, interpreta el inicio como fecha de Lima y
empieza a contar desde el día siguiente. Excluye sábados, domingos y fechas
recibidas del `CalendarioLaboralPort`. El repositorio no contiene una tabla
física `sigd_org.calendario_laboral` ni su contrato de columnas, dado que el
calendario es propiedad de OrganiCore. No se codifican feriados. Mientras no se
inyecte el port institucional, el endpoint falla con 503 para evitar plazos
incorrectos.

Ninguna documentación revisada define el cambio VERDE→AMARILLO. La política
local provisional es configurable y pasa a AMARILLO desde 80% (24 de 30 días).
ROJO empieza estrictamente al día hábil 31; al día 30 permanece AMARILLO.

## CCD

No se encontró tabla, migración ni contrato canónico CCD en el backend. El
endpoint consume un `ClasificadorCcdPort` jerárquico, ordena cada nivel por
código y devuelve 503 mientras no se conecte la fuente institucional. No hay
datos de catálogo de producción incluidos en RutaDoc.

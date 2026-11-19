# Verificación integral de radicación virtual — F_BARTRA

Fecha: 6 de noviembre de 2026. Alcance exclusivo: base académica
`sigd_fbartra_demo_20261030`. No se modificó `sigd_prueba`, no se eliminaron
volúmenes y no se desactivaron triggers, restricciones ni validaciones.

## Respaldo previo

- Archivo: `backups/sigd_fbartra_demo_20261030_pre_radicacion_integral_20261106.dump`
- Formato: custom de PostgreSQL 18.6; TOC validado por `pg_restore --list`.
- Tamaño: 287079 bytes.
- SHA-256: `582AF307D6A62EAC0A560D80B4AEE076DBACA5E0B1C8B2A7B5C241F3ADCD610F`.

Antes del respaldo se verificó mediante `current_database()` que la conexión
real era `sigd_fbartra_demo_20261030`, y que el backend usaba `sigd_app` contra
esa misma base.

## Causa y corrección

El fallo reproducido fue SQLSTATE `42501` en
`sigd_tra.agregar_folio_expediente`: su `SELECT ... FOR UPDATE` necesitaba
privilegio de actualización sobre `sigd_tra.expediente`. No se concedió
`UPDATE` global. La migración
`backend/tests/local/sql/25_sigd_radicacion_academica_privilegios.sql` encapsula CUT, foliación y
funciones trigger como `SECURITY DEFINER`, fija `search_path`, revoca ejecución
pública y deja a `sigd_app` únicamente las operaciones directas del flujo.

Después de la migración, `sigd_app` no tiene escritura directa sobre
`secuencia_anual_cut`, `movimiento_identidad`, `estado_actual_expediente` ni
`contador_pestana_local`. Solo puede ejecutar `fn_generar_cut(integer)` y
`agregar_folio_expediente(uuid,uuid,integer,uuid)`; las funciones trigger no
son ejecutables por el rol ni por `PUBLIC`.

También se corrigieron dos incompatibilidades de código:

1. Dentro del horario, `fecha_radicacion` ahora conserva el instante real de
   recepción; antes se retrotraía incorrectamente a las 08:00.
2. El GET de cargo usaba columnas inexistentes (`cut`, `id_persona`, `asunto`)
   de `sigd_tra.expediente`; ahora usa `codigo_expediente`, `solicitante_id` y
   obtiene el asunto desde `sigd_tra.tramite`.

## Resultado verificable

Flujo real ejecutado con cuenta y PDF ficticios: login, presigned URL, PUT S3,
confirmación del archivo y `POST /api/v1/tramites/radicacion-virtual`.

- Login: HTTP 200.
- URL prefirmada: HTTP 200.
- PUT del PDF: HTTP 200.
- Confirmación del PDF: HTTP 201.
- Radicación: HTTP 201.
- Consulta del cargo: HTTP 200.
- Expediente: `b2b05d3b-6347-49d1-92bc-b370a825b0d2`.
- CUT: `EXP-2026-000002`.
- Cargo: `CARGO-EBB4BA20`.
- Hash del cargo: `be2204084f6992dcaaddacc66662b9858fd107ea0967eef1f02ffb9a3ef44e25`.
- QR: `SIGD://cargo/CARGO-EBB4BA20?h=be2204084f6992dc`.
- Estado TramiCore: `REGISTRADO`.
- Estado DocuCore: `REGISTRADO`.
- Estado RutaDoc: `RECEPCIONADO`, secuencia 1.
- Adjunto: 1, carga `VINCULADO`.
- Foliación: un registro, folios 1–1.
- Asiento: 1.
- Movimiento RutaDoc: 1.
- Evento Outbox: 1.
- Fecha real y legal: `2026-11-06T20:12:56.033Z` en ambos campos.

La prueba de duplicación documental también confirmó la atomicidad: PostgreSQL
rechazó un PDF con hash ya existente mediante `uq_documento_adjunto_sha`, la
transacción se revirtió y no consumió un correlativo CUT.

## Comprobaciones de código

- TypeScript con dependencias declaradas (imagen local): correcto, sin errores.
- Pruebas dirigidas de CUT, horario legal y contrato de migración: 11 aprobadas,
  2 omitidas por diseño.
- Prueba end-to-end académica: correcta, con datos ficticios y sin credenciales
  reales.

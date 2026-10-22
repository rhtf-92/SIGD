# Parches locales de migraciones

Este inventario registra los parches locales conocidos en las migraciones 02,
06 y 07. No implica que deban publicarse en un commit.

| Archivo | Línea | Texto antes | Texto después | Motivo |
|---|---:|---|---|---|
| `backend/migraciones/02_sigd_auth.sql` | Archivo completo | Versión local anterior; no está disponible en el estado de trabajo actual para recuperar sus líneas exactas. | Contenido copiado de `origin/B_GERIC`, según el historial comunicado para este parche. | Incorporar la versión de autenticación de la rama indicada. |
| `backend/migraciones/06_sigd_rut.sql` | Referencias a expedientes (incluidas 435–436, 473 y 576) | `id_expediente` | `expediente_id` | Usar el nombre real del identificador de `sigd_tra.expediente`. |
| `backend/migraciones/06_sigd_rut.sql` | 435–436 y 473 | Comparación directa de identificadores entre tablas | `p.expediente_id::text = e.expediente_id::text` y `expediente_id::text = v_expediente::text` | Las referencias de RutaDoc son `BIGINT` y `sigd_tra.expediente.expediente_id` es `UUID`; la conversión a texto evita el error de operador por tipos distintos. |
| `backend/migraciones/06_sigd_rut.sql` | 576 | Referencia a fecha de creación del expediente | `fecha_radicacion` | Usar el nombre de la columna definida en `sigd_tra.expediente`. |
| `backend/migraciones/07_sigd_reportes.sql` | 34–38, 49 | `m.fecha_movimiento`; `m.estado_destino`; estados terminales `('RESUELTO', 'NOTIFICADO', 'ARCHIVADO')` | `m.fecha_hora`; `m.estado_nuevo`; `('RESUELTO', 'ARCHIVADO')` | `sigd_rut.movimiento_tramite` define `fecha_hora` y `estado_nuevo`; el catálogo de 06 no contiene `NOTIFICADO`. |
| `backend/migraciones/07_sigd_reportes.sql` | 51, 153 | `sigd_rut.estado_actual_tramite` | `sigd_rut.estado_actual_expediente` | La tabla definida en 06 tiene el segundo nombre. |
| `backend/migraciones/07_sigd_reportes.sql` | 46, 64–108, 131–135, 158 | `a.estado_codigo`; `a.fecha_estado` | `a.estado_nuevo`; `a.fecha_hora` | Son las columnas definidas en `estado_actual_expediente`. |
| `backend/migraciones/07_sigd_reportes.sql` | 34, 52, 57, 155 | Igualdad directa entre `BIGINT` y `UUID` | Comparaciones `expediente_id::text` en ambos lados; el ID del CTE `cierre` también se convierte a `text`. | Alinear los tipos de los identificadores de RutaDoc (`BIGINT`) y TramiCore (`UUID`) sintácticamente, siguiendo el patrón local de 06. |
| `backend/migraciones/07_sigd_reportes.sql` | 157 | `ar.area_id = a.area_actual_id` | `ar.area_id::text = a.area_actual_id` | `sigd_org.area.area_id` es `UUID`; `estado_actual_expediente.area_actual_id` es `TEXT`. |
| `backend/migraciones/07_sigd_reportes.sql` | 38, 64–74, 84, 101–108, 158 | Uso de `NOTIFICADO` y `ANULADO` como estados de expediente | Se cuentan `RESUELTO` y `ARCHIVADO` como terminales; se eliminan `NOTIFICADO` y `ANULADO`. | Esos dos valores no están en el catálogo `sigd_rut.estado_tramite` sembrado por 06. |
| `backend/migraciones/07_sigd_reportes.sql` | 140–152 | `a.semaforo_sla = 'ROJO' / 'AMARILLO' / 'VERDE'` | Cálculo con `fecha_limite` y el 80 % del intervalo entre `fecha_radicacion` y `fecha_limite`. | No existe una columna `semaforo_sla` en las tablas de 01–06; la vista calcula los conteos en lugar de referir una columna inexistente. |

## Alcance y limitaciones

- El contenido anterior exacto de 02 no está disponible en el estado de trabajo
  consultado; la descripción del parche procede del historial comunicado.
- Las uniones entre los IDs `BIGINT` de RutaDoc y los IDs `UUID` de TramiCore
  ahora no fallan por tipos, pero la conversión a texto no prueba que ambos
  dominios compartan valores equivalentes. La relación real requiere validar
  cómo se correlacionan esos identificadores en los datos.
- El semáforo de 7.2 usa las fechas persistidas y tiempo calendario. No reproduce
  el cálculo de días hábiles ni los feriados de la capa de aplicación descritos
  en el comentario de la migración. Para ello haría falta acordar una fuente de
  calendario laboral compatible con SQL.
- No se consultaron datos ni se ejecutó SQL. Los conteos y las uniones con los
  datos existentes quedan pendientes de validación por quien ejecute las pruebas.

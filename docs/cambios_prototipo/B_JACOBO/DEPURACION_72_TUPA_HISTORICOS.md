# Depuración del catálogo TUPA: eliminación bloqueada por integridad histórica

> Estado histórico de la primera auditoría. La autorización posterior permitió resolver el bloqueo archivando las referencias sin reclasificar expedientes. La migración 15 ya dejó exactamente 72 filas; véase [CIERRE_DEPURACION_72_TUPA.md](./CIERRE_DEPURACION_72_TUPA.md).

Rama: B_JACOBO. HEAD: bf30d8a0c85e266a86381fb10bf3740a8451c032. Base comprobada: sigd_jacobo_demo, 127.0.0.1:5433; MIGRATE_ON_BOOT=false. Se conservaron las 313 entradas locales existentes. No se ejecutó DELETE, UPDATE, INSERT, DDL ni migraciones contra PostgreSQL en esta intervención. No hubo reinicios, commits ni pushes.

## Resultado real

| Elemento | Cantidad comprobada | Estado |
|---|---:|---|
| Registros TUPA totales | 75 | Objetivo 72 bloqueado por referencias históricas |
| Vigentes | 72 | Conservados |
| Históricos inactivos | 3 | No eliminados |
| Procedimientos devueltos por API | 72 | UUID únicos |
| Opciones TUPA del selector | 72 | Implementación y pruebas de navegador de la fase anterior conservadas |
| Códigos duplicados | 0 | Comprobado en PostgreSQL |

Se aplica la condición de parada indicada por el usuario: hay referencias que impiden eliminar con seguridad los históricos. No se presenta esta tarea como completada ni se afirma que existen solo 72 filas físicas.

## Registros identificados

| Código | UUID | Denominación | Dependencias directas |
|---|---|---|---|
| TUPA-01 | 00000000-0000-0000-0000-000000000001 | Emisión de Certificado de Estudios Oficial | 5 expedientes y 1 requisito |
| TUPA-02 | 00000000-0000-0000-0000-000000000002 | Expedición de Título Profesional Técnico | 1 requisito |
| TUPA-03 | 00000000-0000-0000-0000-000000000003 | Convalidación de Créditos y Prácticas Pre-Profesionales | 1 requisito |

Cada requisito tiene una asociación de tipo documental y ninguno está enlazado a expediente_requisito. No se encontraron formularios_version, tarifas ni órdenes con FK directa a estos tres tipos.

La FK `expediente_tipo_tramite_id_fkey` es ON DELETE RESTRICT. La FK de requisito usa ON DELETE CASCADE: eliminar el tipo también borraría configuración documental. No se ejecutó ninguna eliminación, ni siquiera parcial, para preservar el conjunto mientras se resuelven las dependencias.

## Expedientes que impiden eliminar TUPA-01

| CUT | ID expediente | RutaDoc | Documentos | Órdenes aplicadas |
|---|---|---|---:|---:|
| EXP-2026-000001 | 615e7c34-4e62-46d2-8d91-36cc12608faf | Sí | 1 | 0 |
| EXP-2026-000003 | 7e6ed896-78d1-468d-9ae6-6dbbaa2c033c | Sí | 1 | 0 |
| EXP-2026-000004 | 27332305-a84c-4a0f-a058-83986936e862 | Sí | 1 | 0 |
| EXP-2026-000005 | dbed3e47-106c-4c1f-aa50-8eb8af20a9c6 | Sí | 1 | 0 |
| EXP-2026-000142 | 00000000-0000-0000-0000-000000000142 | Sí | 1 | 0 |

El escaneo UUID también encontró valores iguales en tablas de identidad/organización porque las semillas usan UUID genéricos coincidentes. No son referencias al TUPA: se distinguieron expresamente de las FK reales y no justifican modificar personas, cuentas, sesiones ni roles.

## Prevención de reinserción implementada

- `backend/migraciones/04_sigd_doc.sql` y `backend/migraciones_v2/04_sigd_doc.sql`: el bloque de semillas de ejemplo retorna sin insertar en sigd_jacobo_demo. Se mantiene el comportamiento ajeno a demostración. No se ejecutó ninguna de estas migraciones completas.
- `backend/carga_tupa_suiza_2026.sql`: ya no requiere que existan los tres históricos. Detecta los 72 conceptos Suiza vigentes y omite el bloque inicial de 19 sin reescribirlo. Si los históricos todavía existen, valida sus identificadores antes de la carga inicial.
- Migración 14 y su generador revisados: contienen exclusivamente las 72 referencias del catálogo, no crean TUPA-01/02/03. No se cambiaron ni se reejecutaron.

Las tres ramas de semillas/importación se ejecutaron dentro de BEGIN READ ONLY contra la base demo real; no intentaron escribir y el contenido íntegro de los 75 registros permaneció idéntico antes/después. La llamada real GET /api/v1/tramites/tipos devolvió 72 UUID únicos. Esta comprobación no equivale a aplicar nuevamente las migraciones ni a modificar el catálogo.

## Cómo resolver las referencias sin perder expedientes ni pagos

No es seguro sustituir TUPA-01 por SUZ26-035 basándose solo en que sus títulos mencionen certificados: el concepto vigente especifica seis semestres y los expedientes históricos pueden responder a condiciones distintas. Cada uno de los cinco expedientes necesita una correspondencia documental individual comprobada.

Si se demuestra equivalencia con un concepto vigente, se puede diseñar una migración transaccional específica de reclasificación: conservar en trazabilidad inmutable el UUID/código/nombre original, registrar evidencia y motivo de la correspondencia, cambiar únicamente la referencia del expediente comprobado y verificar CUT, titular, documentos, RutaDoc y finanzas sin alterarlos. Después se auditarían los requisitos retirados y se eliminarían explícitamente sus relaciones no utilizadas antes de los tipos obsoletos. Ninguna de estas acciones se ejecutó ni se presume autorizada por la mera semejanza de nombres.

Si no se acredita esa correspondencia, el esquema actual requiere conservar el tipo histórico para mantener la FK. Alcanzar 72 filas físicas preservando el significado original requeriría un diseño de archivo/versionado de las referencias históricas y una migración previamente revisada; no debe lograrse desvinculando expedientes, desactivando constraints ni usando CASCADE.

## Evidencia reproducible

- `scratch/auditar-tupa-historicos.cjs`: auditoría BEGIN READ ONLY de tipos, FK, todas las columnas UUID de tablas sigd_*, requisitos, expedientes, documentos y referencias económicas; no consulta contenidos ni datos personales.
- `scratch/auditoria-tupa-historicos.json`: resultado de la auditoría y detalle de dependencias.
- `scratch/verificar-semillas-tupa-readonly.cjs`: ejecución de las ramas corregidas en READ ONLY y comparación íntegra de los registros antes/después.
- `scratch/verificacion-semillas-tupa.json`: semillas omitidas, registros idénticos, API=72 y UUID únicos=72.
- `SELECTOR_72_TUPA_RADICACION.md`: evidencia previa de las 72 radicaciones reales de demostración, conservada; no se generaron nuevas radicaciones para esta depuración.

Estado final: **BLOQUEADA la eliminación de los históricos; IMPLEMENTADA Y VERIFICADA la prevención de reinserción en los mecanismos identificados**. Registros eliminados: **0**.

## Pruebas automatizadas adicionales

Se ejecutaron `catalogo-tupa-2026.spec.ts` y `radicacion-tupa-ddl.spec.ts`: **39 aprobadas y 20 fallidas** (59 en total). El catálogo pasó sus tres casos. La suite de radicación presenta fallos en sus simulaciones de archivo: las respuestas sustituidas de `verificarArchivo` no suministran `paginas`, dato que el servicio requiere desde la implementación previa de conteo real PDF. No se modificó el servicio de radicación ni se relajó esa validación para hacer pasar estas pruebas. Estos fallos quedan registrados; no invalidan la comprobación real READ ONLY de los bloques SQL, pero impiden declarar la suite automatizada completa aprobada.

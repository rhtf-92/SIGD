# Cierre de depuración del catálogo TUPA operativo

Fecha local: 31 de octubre de 2026. Rama `B_JACOBO`; HEAD `bf30d8a0c85e266a86381fb10bf3740a8451c032`. Se conservaron los cambios locales preexistentes (314 entradas al inicio). Base exclusiva: `sigd_jacobo_demo`, 127.0.0.1:5433; `MIGRATE_ON_BOOT=false`. Sin reinicio de servicios, Docker, commits ni pushes.

## Resultado aplicado y verificado

| Elemento | Cantidad |
|---|---:|
| Filas en sigd_doc.tipo_tramite_tupa | 72 |
| Vigentes | 72 |
| Inactivos | 0 |
| Códigos distintos | 72 |
| Procedimientos devueltos por API activa | 72 |
| Opciones TUPA en el desplegable, sin contar placeholder | 72 |
| Radicaciones demo previas, una por concepto, conservadas | 72 |
| Clasificaciones históricas conservadas fuera del catálogo | 3 |
| Expedientes históricos preservados | 5 |

Los 72 UUID operativos y sus datos permanecieron idénticos. Se eliminaron exclusivamente de la tabla operativa `TUPA-01`, `TUPA-02` y `TUPA-03`, UUID terminados en 001, 002 y 003. No se sustituyeron por procedimientos SUZ26 ni se modificaron tarifas.

## Respaldo previo completo

- Herramienta: PostgreSQL 18 `pg_dump --format=custom`, mediante la conexión efectiva de demostración y credenciales solo en variables del proceso.
- Ruta externa al repositorio y a Docker: `C:\Users\Liz\Desktop\SIGD\RESPALDOS_HISTORICOS\sigd_jacobo_demo_pre_archivo_tupa_2026-11-01T03-52-31-677Z.dump`.
- Tamaño: 567982 bytes.
- SHA-256: `c2c2276d3429512aac1a90ff7ca09ddc6efce3a6c0ba62472490eb9e03992ef6`.
- Índice leído satisfactoriamente con `pg_restore --list`; hash vuelto a comprobar antes de migrar y en el cierre.
- Es un respaldo lógico completo PostgreSQL custom, no un respaldo físico de MinIO. No se alteró ni eliminó ningún objeto de MinIO. No se ensayó una restauración completa porque implicaría escribir o crear otra base; no se afirma que ese ensayo se haya realizado.

## Mecanismo de conservación

Se reutilizó `sigd_audit.bitacora_auditoria`, sin crear una segunda tabla de catálogo ni otra base. La migración 15 añadió tres evidencias append-only (`esquema=sigd_doc`, `tabla=tupa_historico`, operación DELETE), cada una con:

- Fila original completa del tipo en `datos_antes`.
- Requisitos originales y asociaciones documentales completas en `datos_despues`.
- Copia original de los expedientes que referenciaban ese tipo, motivo, versión y nombre de migración.

`sigd_doc.expediente.tupa_historico_auditoria_id` enlaza los cinco expedientes a su evidencia. Su `tipo_tramite_id` quedó NULL: no se reasignó la clasificación a un procedimiento actual por semejanza de denominación. Los demás campos de todos los expedientes se compararon normalizando únicamente ese traslado de referencia y resultaron idénticos.

La restricción `expediente_tupa_origen_unico` exige exactamente una referencia: catálogo vigente o evidencia histórica. Un trigger comprueba que la evidencia histórica contiene el identificador del expediente y pertenece al archivo de la migración 15; también impide cambiar una referencia histórica ya fijada. La cuenta actual no tiene REFERENCES sobre auditoría; por eso se utiliza esta validación de pertenencia, sin conceder permisos nuevos. La bitácora WORM y los permisos existentes impiden modificar o borrar la evidencia.

Los tres requisitos antiguos y sus tres relaciones `tipo_documento_requisito` fueron archivados antes de retirarlos explícitamente. No tenían asociaciones en `expediente_requisito`. No se utilizó CASCADE. La migración aborta si encuentra formularios, tarifas, órdenes o acreditaciones de requisitos adicionales para esos tipos.

## Expedientes históricos conservados

| CUT | Expediente | Clasificación original conservada |
|---|---|---|
| EXP-2026-000001 | 615e7c34-4e62-46d2-8d91-36cc12608faf | TUPA-01 — Emisión de Certificado de Estudios Oficial |
| EXP-2026-000003 | 7e6ed896-78d1-468d-9ae6-6dbbaa2c033c | TUPA-01 — Emisión de Certificado de Estudios Oficial |
| EXP-2026-000004 | 27332305-a84c-4a0f-a058-83986936e862 | TUPA-01 — Emisión de Certificado de Estudios Oficial |
| EXP-2026-000005 | dbed3e47-106c-4c1f-aa50-8eb8af20a9c6 | TUPA-01 — Emisión de Certificado de Estudios Oficial |
| EXP-2026-000142 | 00000000-0000-0000-0000-000000000142 | TUPA-01 — Emisión de Certificado de Estudios Oficial |

Continúan los 108 expedientes de DocuCore, sus CUT, documentos y los registros RutaDoc. Se compararon cantidad y hash del contenido de 37 tablas protegidas de documentos, TramiCore, RutaDoc y Tesorería: todas idénticas. No se borraron órdenes, pagos ni trazabilidad previa. Las coincidencias accidentales de UUID genéricos en identidades/roles no se trataron como referencias al TUPA ni se modificaron.

## Consultas de lectura y activación

La vista nueva `sigd_doc.expediente_tipo_tramite` recupera código, denominación y descripción desde el catálogo o desde la evidencia histórica. No añade registros a `tipo_tramite_tupa`. Se actualizaron las lecturas de Mis trámites y Consulta Pública para usar esa vista manteniendo los DTO y las comprobaciones de titularidad existentes.

**La migración y la vista están activas en PostgreSQL. La API activa devuelve 72 y /health y /ready responden 200. Las nuevas lecturas históricas se compilaron y probaron con el servicio actualizado contra PostgreSQL real (cinco consultas correctas); el proceso backend existente no se reinició. Su activación por HTTP queda pendiente de la próxima recarga controlada del backend.** No se presenta esa comprobación directa del servicio como prueba HTTP de la versión recién compilada.

Las 72 radicaciones reales de la fase anterior siguen enlazadas al concepto correcto. No se generaron otras 72 solicitudes durante esta depuración. Continúa el alcance demostrativo previamente documentado: no se acredita pago ni se convierten tarifas ambiguas en importes financieros validados.

## Pruebas

1. Migración 15 ensayada con ROLLBACK y comparación de integridad; luego aplicada mediante el mismo verificador, con respaldo previamente verificado. Los primeros intentos de prueba encontraron la ausencia de REFERENCES sobre la bitácora y se revirtieron íntegramente; se adoptó el trigger de pertenencia sin cambiar permisos.
2. Verificación final READ ONLY: 72 totales/vigentes, cero inactivos, 72 códigos únicos, tres archivos inmutables y cinco referencias históricas correctas; las 72 radicaciones demo conservadas.
3. Edge real con POST/PUT/PATCH/DELETE bloqueados: 72 opciones, nombres/códigos/costos/orden exactos y tarjeta de catálogo ausente; cero intentos de escritura.
4. Cinco pruebas negativas en transacción con ROLLBACK: historia inmutable, evidencia inexistente, evidencia de otro expediente, expediente sin clasificación y evidencia no borrable. Todas rechazadas correctamente; no se confirmó ninguna modificación.
5. **91 pruebas backend aprobadas** en `radicacion-tupa-ddl.spec.ts` (56), `catalogo-tupa-2026.spec.ts` (3), `mis-expedientes.spec.ts` (6), `pdf-foliacion.spec.ts` (2) y `radicacion-publica.spec.ts` (24). Los fallos anteriores se corrigieron actualizando los stubs para devolver páginas y usando un PDF válido en los ensayos de lectura S3; no se relajó la validación productiva.
6. TypeScript backend y build backend aprobados.

## SQL de comprobación

```sql
BEGIN READ ONLY;
SELECT count(*) AS total,
       count(*) FILTER (WHERE vigente) AS vigentes,
       count(*) FILTER (WHERE NOT vigente) AS inactivos,
       count(DISTINCT codigo) AS codigos_unicos
FROM sigd_doc.tipo_tramite_tupa;
-- 72 | 72 | 0 | 72

SELECT codigo FROM sigd_doc.tipo_tramite_tupa
WHERE codigo IN ('TUPA-01','TUPA-02','TUPA-03');
-- Cero filas.

SELECT e.codigo_expediente, v.codigo, v.denominacion, v.historico
FROM sigd_doc.expediente e
JOIN sigd_doc.expediente_tipo_tramite v USING (expediente_id)
WHERE v.historico ORDER BY e.codigo_expediente;
-- Cinco expedientes, TUPA-01 y denominación original conservados.

SELECT datos_antes->>'codigo' AS codigo_original,
       jsonb_array_length(datos_despues->'requisitos') AS requisitos,
       jsonb_array_length(datos_despues->'tipos_documento_requisito') AS relaciones,
       jsonb_array_length(datos_despues->'expedientes') AS expedientes
FROM sigd_audit.bitacora_auditoria
WHERE esquema='sigd_doc' AND tabla='tupa_historico'
  AND datos_despues->>'migracion'='15_archivar_tupa_historicos';
-- Tres evidencias, requisitos 1/1/1, relaciones 1/1/1, expedientes 5/0/0.
ROLLBACK;
```

## Archivos y evidencias

- Migración: `backend/migraciones/pendientes/15_archivar_tupa_historicos.sql`.
- Lecturas adaptadas: `backend/src/domains/tramicore/tramites.controller.ts`, `backend/src/domains/tramicore/consultaPublica.service.ts`.
- Pruebas corregidas: `backend/tests/unit/domains/tramicore/radicacion-tupa-ddl.spec.ts`, `backend/tests/unit/domains/tramicore/radicacion-publica.spec.ts`.
- Semillas/importadores protegidos en la intervención anterior: ambas versiones de `04_sigd_doc.sql` omiten las semillas ficticias en demo; `carga_tupa_suiza_2026.sql` no requiere los históricos y no reescribe el catálogo instalado de 72. La migración 14 y su generador solo contienen los conceptos Suiza; no vuelven a crear TUPA-01/02/03.
- Scripts reproducibles: `scratch/respaldar-pre-archivo-tupa.cjs`, `scratch/migrar-archivo-tupa.cjs`, `scratch/verificar-archivo-tupa-final.cjs`, `scratch/probar-integridad-archivo-tupa.cjs`, `scratch/verificar-selector-72-readonly.cjs`.
- Evidencias: `scratch/respaldo-pre-archivo-tupa.json`, `scratch/archivo-tupa-rollback.json`, `scratch/archivo-tupa-aplicada.json`, `scratch/archivo-tupa-final.json`, `scratch/archivo-tupa-integridad.json`, `scratch/selector-72-final.json` y captura `scratch/selector-72-final.png`.

## Recuperación

La migración no contiene una reversión automática que vuelva a insertar ejemplos en el catálogo. Para recuperar una situación anterior se dispone del dump completo y de la evidencia inmutable; cualquier recuperación debe planificarse sin sobrescribir operaciones posteriores. El dump no se restauró sobre ninguna base durante esta intervención.

# Baseline académico y procedencia de migraciones

La copia compartible parte de un respaldo estructural de `sigd_prueba`. Sus 15 filas históricas en `public.sigd_migraciones` se restauran sin alterar identificadores ni huellas. La base original no se modifica.

## Verificación histórica

| Archivo | Resultado |
| --- | --- |
| `10_sigd_virtual.sql` | Coincide con la huella registrada en LF. |
| `13_sigd_documentos_identidad.sql` | Coincide con la huella registrada en LF. |
| `14_sigd_workflow_academico.sql` | Coincide con la huella registrada en LF. |
| `08_sigd_tra_folio_function.sql` | La huella `c1936faf1b2b22e14ad1d7a307f9e8c8ead0d539c1d24f94a6c24ceef6032ea5` no corresponde a ningún blob recuperado de Git. |
| `09_sigd_rut_actor_uuid.sql` | La huella `d67d71041ad6653778f072d31a50b161f9373371f1ca105ac64cb25559373caf` no corresponde a ningún blob recuperado de Git. |
| `12_sigd_autoregistro.sql` | La huella `587b45eb6f27321467bcb1a5665aee85425a17e79e4f2644a1e5f70a97389471` no corresponde a ningún blob recuperado de Git. |

Se compararon 8142 blobs pequeños de Git, incluidos objetos no alcanzables desde ramas visibles, en variantes original, LF, CRLF y BOM UTF-8. No es posible determinar si las diferencias de 08, 09 y 12 son comentarios, formato o SQL funcional: el registro conserva una huella, no el contenido aplicado. **La cadena histórica no se declara íntegra ni reconstruida.**

## Reconciliación reproducible

`academic-snapshot/schema.sql` reproduce el estado estructural real de la base y `data.sql` conserva las 15 filas históricas y las semillas compartibles. El restaurador verifica SHA-256 antes de usar esos archivos. Solo en una base Docker nueva aplica `backend/migraciones/15_sigd_auth_refresh_token_text.sql` (ampliación incremental de `VARCHAR(255)` a `TEXT`) y luego registra su huella. La tabla `public.sigd_academic_baseline` guarda los SHA-256 del esquema, los datos y esa migración, con `legacy_source_status='UNVERIFIED_08_09_12'`.

`MIGRATE_ON_BOOT=false` permanece activo. El runner histórico no se usa para construir esta copia, pues detectaría las tres divergencias no certificadas. Tampoco se ejecutan `09_sigd_auth_perfil_activo.sql`, `15_sigd_org_admin_permission.sql` ni `16_sigd_org_admin_full_permissions.sql`. Para incorporar cambios futuros, el equipo debe revisar y aprobar cada SQL nuevo, aplicarlo como migración incremental versionada sobre el baseline y conservar su huella; no debe reescribir las 15 filas históricas.

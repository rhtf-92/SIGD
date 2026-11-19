# Selector único de 72 conceptos TUPA y radicación real

> Actualización final: el catálogo físico ya tiene exactamente 72 filas, todas vigentes. Los tres tipos históricos se conservaron en auditoría inmutable y se retiraron del catálogo mediante la migración 15. Ver [CIERRE_DEPURACION_72_TUPA.md](./CIERRE_DEPURACION_72_TUPA.md). La nota siguiente describe el bloqueo detectado antes de esa autorización y resolución.

> Auditoría posterior solicitada para reducir las 75 filas físicas a 72: se encontraron cinco expedientes que referencian TUPA-01 y se detuvo la eliminación para preservar su integridad. Véase [DEPURACION_72_TUPA_HISTORICOS.md](./DEPURACION_72_TUPA_HISTORICOS.md). Los 72 conceptos vigentes y sus radicaciones de demostración permanecen intactos.

Rama B_JACOBO. HEAD inicial bf30d8a0c85e266a86381fb10bf3740a8451c032. Entorno exclusivo sigd_jacobo_demo, backend 3008, frontend 5178. Sin reinicios, Docker, commits ni pushes. Se conservaron las 313 entradas Git preexistentes.

## Implementado y verificado

Archivos modificados: `frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx`, `frontend/src/pages/tramite/VentanillaPresencialPage.tsx`, `frontend/tests/unit/components/StepDocumentosArchivos.test.tsx` y el aviso de actualización del informe de fase inicial. Se crearon el generador y la migración 14, los scripts `scratch/validar-migracion-catalogo-72.cjs`, `scratch/e2e-selector-72.cjs`, `scratch/e2e-radicar-72-autenticado.cjs`, `scratch/verificar-cierre-selector-72.cjs`, `scratch/documentar-selector-72.cjs` y las evidencias locales citadas. No se cambiaron contratos, roles ni permisos.

Se retiró del paso 2 la tarjeta Catálogo TUPA 2026 y su buscador, contador, filtro y listado. El selector usa exclusivamente las 72 referencias originales en su orden, presenta código interno, nombre y costo textual, y asigna solo UUID recibidos de PostgreSQL. No genera UUID ficticios. Ventanilla Presencial reutiliza la misma proyección por código y conserva la descripción previa.

La API activa GET /api/v1/tramites/tipos devuelve 72 registros vigentes. Las referencias 021/022 y 069/070/071 continúan agrupadas tal como estaban en el catálogo de 72; no se añaden conceptos para alcanzar el conteo.

## Persistencia y migración 14

Archivo: backend/migraciones/pendientes/14_catalogo_tupa_72.sql. Generador: backend/scripts/generar-migracion-catalogo-72.ts. Validación/ejecución: scratch/validar-migracion-catalogo-72.cjs.

Se validó primero con ROLLBACK y luego se aplicó exclusivamente en sigd_jacobo_demo. Antes: 22 tipos totales, 19 vigentes. Después: 75 tipos totales, 72 vigentes y los tres históricos inactivos conservados. Se insertaron 53 registros y se compararon íntegramente los campos previos de los 22 tipos, excluyendo la nueva columna de metadatos.

La migración añade tupa_fuente JSONB con nombre, referencias, rubro, página, tarifa textual y variantes. Conserva nombres y UUID previos. Permite NULL en plazo_dias y silencio_administrativo para no inventar condiciones legales de los registros nuevos. Los valores históricos permanecen intactos; los nuevos registros usan NULL. La unidad individual no especificada se identifica expresamente como tal. No se crean requisitos administrativos.

En la validación y aplicación permanecieron los 35 expedientes de sigd_doc, 43 de sigd_tra, 5 órdenes y 4 pagos previos. Después se añadieron únicamente las radicaciones DEMOSTRACIÓN descritas en esta matriz mediante las APIs reales desde el navegador. No se insertaron expedientes manualmente.

## Pruebas y evidencia

- TypeScript frontend aprobado. Build frontend aprobado; advertencias de bundle grande, importación mixta de api/client y anotaciones Zod.
- 36 pruebas frontend aprobadas: StepDocumentosArchivos y ventanillaPresencial. El primer pase detectó la pérdida de la descripción previa de Ventanilla; se corrigió y se repitieron satisfactoriamente.
- Edge real contra 5178/3008: selector con 72 opciones más el placeholder; tarjeta ausente; 72 selecciones válidas.
- 72 radicaciones autenticadas reales, una por concepto, HTTP 201, CUT únicos, cargo visible y captura individual. Se reutilizó la cuenta QA ciudadana existente; no se crearon cuentas.
- Para cada expediente se comprobó por SELECT el código TUPA, CUT, identidad referenciada, tarifa textual conservada y registro en sigd_tra; se descargó el PDF desde MinIO y se comparó el contenido completo, tamaño y SHA-256. Una sola fila por asunto de prueba.
- Hubo un timeout de navegador; la reanudación consultó previamente los asuntos persistidos y conservó los resultados existentes sin reenviarlos. No se modificaron controles de seguridad para continuar.
- Prueba pública adicional sin cuenta: EXP-2026-000044, expediente 1c29d2d1-e5fa-46a8-bf21-e422d3106757; cargo y persistencia PostgreSQL/RutaDoc/MinIO verificados.

Evidencias: scratch/evidencias-selector-72/resultado.json, paso2.png, cargo.png; scratch/evidencias-selector-72/autenticado/resultados.json y SUZ26-xxx-cargo.png. Los JSON no contienen credenciales ni tokens. Las capturas muestran datos de demostración.

## Alcance financiero y limitaciones

Comprobación final independiente, en transacción de solo lectura: 72 metadatos fuente idénticos al catálogo original; 72 identidades de expediente coincidentes con la cuenta QA autenticada; 72 CUT distintos; órdenes=5 y pagos=4 sin cambios. `/health`=200, `/ready`=200 y frontend=200. Evidencia: `scratch/evidencias-selector-72/cierre-readonly.json`.

Las 72 radicaciones se verificaron con la excepción de demostración efectiva ya activa; no se registraron pagos, cobros, devoluciones ni órdenes nuevas. Los 18 importes numéricos verificados de M10 permanecen intactos. El texto original y las variantes se conservan para los 72, pero esto no equivale a dar por validada una tarifa financiera nueva. SUZ26-068 conserva su ambigüedad; no se inventó importe ni unidad. La radicación fuera de la excepción demo y la generación de órdenes posteriores al CUT requieren el trabajo financiero pendiente documentado anteriormente.

No se afirma que los 72 tengan requisitos oficiales completos ni responsables individuales confirmados. Se mantuvieron las validaciones configuradas y los controles técnicos PDF/identidad existentes. Las pruebas integrales individuales corresponden a Mesa de Partes Virtual autenticada; Ventanilla física se cubrió mediante pruebas de integración frontend, no mediante 72 recepciones físicas adicionales.

El importador histórico backend/carga_tupa_suiza_2026.sql valida una carga inicial de 19; no debe reejecutarse para reducir el catálogo tras esta migración. La reversión de la migración no puede eliminar los nuevos conceptos porque ahora son referenciados por expedientes; se debe conservar su identidad histórica.

## Matriz de radicaciones reales

| Referencia interna | CUT | Expediente | Costo fuente conservado | HTTP / PostgreSQL / RutaDoc / MinIO / cargo |
|---|---|---|---|---|
| SUZ26-001 | EXP-2026-000045 | d3f3537a-8de1-4d87-8721-61c7e48de359 | S/ 35.00 (0.64 % UIT vigente) | 201 / verificado |
| SUZ26-002 | EXP-2026-000046 | 5ff16b9f-a213-49c9-b04f-5a3fdc652b64 | S/ 45.00 (0.82 % UIT vigente) | 201 / verificado |
| SUZ26-003 | EXP-2026-000047 | d732a9ab-2fb2-45d1-ab10-40fb2c47f673 | S/ 60.00 (1.09 % UIT vigente) | 201 / verificado |
| SUZ26-004 | EXP-2026-000048 | 6c9f710a-9930-4c0f-b845-b467c2ef14fc | S/ 46.50 (0.84 % UIT vigente) | 201 / verificado |
| SUZ26-005 | EXP-2026-000049 | d8d0de94-7981-4361-8bbe-c2217b2faea2 | S/ 100.00 | 201 / verificado |
| SUZ26-006 | EXP-2026-000050 | 553ade04-a03b-4fab-8068-1578ce2e041d | S/ 100.00 | 201 / verificado |
| SUZ26-007 | EXP-2026-000051 | d7853849-709e-47f2-8df2-acf204d21d3d | S/ 300.00 | 201 / verificado |
| SUZ26-008 | EXP-2026-000052 | 23ecebb5-d701-40c1-b21a-ecc8c7dab327 | S/ 350.00 | 201 / verificado |
| SUZ26-009 | EXP-2026-000053 | 0a9d922b-0f70-4c71-81bc-b0f2abb81cc1 | S/ 300.00 | 201 / verificado |
| SUZ26-010 | EXP-2026-000054 | 1e73bfc3-636b-4634-952b-52cbd751ea2d | El cuadro muestra S/ 400.00, S/ 200.00, S/ 60.00, S/ 50.00, S/ 40.00 y S/ 10.00. | 201 / verificado |
| SUZ26-011 | EXP-2026-000055 | a6b5755d-cca5-45d9-b529-a5b6828723e9 | S/ 500.00. | 201 / verificado |
| SUZ26-012 | EXP-2026-000056 | 607937d6-b47f-43a5-a286-ecd9ddb60748 | S/ 100.00 | 201 / verificado |
| SUZ26-013 | EXP-2026-000057 | 1f77fc08-eb38-4b07-90e0-1b0573487f6e | S/ 150.00 | 201 / verificado |
| SUZ26-014 | EXP-2026-000058 | 222cdc48-8a8a-42e9-9384-65b1bc6051ff | S/ 100.00 | 201 / verificado |
| SUZ26-015 | EXP-2026-000059 | 856fb9d1-bc39-4080-8655-adf2a481e13b | S/ 1,000.00. | 201 / verificado |
| SUZ26-016 | EXP-2026-000060 | 29bd32da-416f-45a2-b0df-96cf8736304f | S/ 300.00 | 201 / verificado |
| SUZ26-017 | EXP-2026-000061 | 481031df-e973-431f-a4e4-b34a318533f6 | S/ 20.00 | 201 / verificado |
| SUZ26-018 | EXP-2026-000062 | c4f4b9a1-9b4b-4b8f-8f45-192683c610eb | S/ 20.00 | 201 / verificado |
| SUZ26-019 | EXP-2026-000063 | 03eaba89-7cb7-499a-b4ef-186f3f2e016a | S/ 15.00 | 201 / verificado |
| SUZ26-020 | EXP-2026-000064 | bd0b6706-4e96-4db7-97f9-165dae0d1e37 | S/ 15.00 | 201 / verificado |
| SUZ26-021 | EXP-2026-000065 | cd03ea29-a02b-4448-a309-3532d45ff1fa | S/ 30.00 | 201 / verificado |
| SUZ26-023 | EXP-2026-000066 | 92ec1e75-1600-4a17-a15b-d599393806a7 | S/ 15.00 | 201 / verificado |
| SUZ26-024 | EXP-2026-000067 | c1ae8a98-45a8-4f9c-8983-c6fb4539a043 | S/ 40.00 | 201 / verificado |
| SUZ26-025 | EXP-2026-000068 | a607c01f-ea2d-40f9-aa17-be59193e0c18 | El cuadro muestra S/ 50.00 y S/ 55.00. | 201 / verificado |
| SUZ26-026 | EXP-2026-000069 | 7f32a4b9-6583-4500-ac1d-d2f41e94d383 | S/ 20.00 | 201 / verificado |
| SUZ26-027 | EXP-2026-000070 | 04b3fbe4-63e9-43cf-848f-4b74d124668e | El cuadro muestra S/ 25.00 y S/ 15.00. | 201 / verificado |
| SUZ26-028 | EXP-2026-000071 | 234b87c6-f0c3-4038-af81-fbd482b91db3 | El cuadro muestra S/ 20.00 y S/ 15.00. | 201 / verificado |
| SUZ26-029 | EXP-2026-000072 | 4462a5e4-f846-4b2b-9648-1c0c2898172e | S/ 50.00 | 201 / verificado |
| SUZ26-030 | EXP-2026-000073 | e5c6e0e7-5fef-43f3-b4cb-6932c185c2d3 | S/ 4.00 (0.07 % UIT vigente) | 201 / verificado |
| SUZ26-031 | EXP-2026-000074 | c51ac869-6870-4cc0-874a-570382ab7921 | S/ 16.50 (0.30 % UIT vigente) | 201 / verificado |
| SUZ26-032 | EXP-2026-000075 | 2bd66f85-8bdc-43cb-98f7-1a7a3a54e1e0 | S/ 57.00 (1.03 % UIT vigente) | 201 / verificado |
| SUZ26-033 | EXP-2026-000076 | 2a052d4b-defc-41d4-97a7-b1db403569ec | S/ 57.00 (1.03 % UIT vigente) | 201 / verificado |
| SUZ26-034 | EXP-2026-000077 | 72414bd8-bbbf-49a2-a1c5-ac0a1ba8d7fb | S/ 105.00 (1.90 % UIT vigente) | 201 / verificado |
| SUZ26-035 | EXP-2026-000078 | f84617f8-ee60-4f9e-b94b-554512ec11d2 | S/ 124.00 (2.24 % UIT vigente) | 201 / verificado |
| SUZ26-036 | EXP-2026-000079 | f1816abc-9406-45e4-8dda-0a0fa68f6b96 | S/ 16.00 (0.29 % UIT vigente) | 201 / verificado |
| SUZ26-037 | EXP-2026-000080 | edd13237-8030-425a-904a-8e0d5ae4eb51 | S/ 26.00 (0.47 % UIT vigente) | 201 / verificado |
| SUZ26-038 | EXP-2026-000081 | 54838dae-7537-4a5a-9287-387fe027aa40 | S/ 42.00 (0.75 % UIT vigente) | 201 / verificado |
| SUZ26-039 | EXP-2026-000082 | d61da994-8f71-4831-a4d3-0de62048dd30 | S/ 120.00 | 201 / verificado |
| SUZ26-040 | EXP-2026-000083 | 200c1298-6e7c-462b-af4a-2016cd18ee64 | S/ 100.00 | 201 / verificado |
| SUZ26-041 | EXP-2026-000084 | c92dfdb2-381f-41d7-a42c-fe19389c6f8f | S/ 100.00 | 201 / verificado |
| SUZ26-042 | EXP-2026-000085 | a241394f-1535-4936-b68d-c8f372220aa3 | S/ 100.00 | 201 / verificado |
| SUZ26-043 | EXP-2026-000086 | d4b3ad7e-aedc-4f21-84b1-2b0edd93124f | S/ 50.00 | 201 / verificado |
| SUZ26-044 | EXP-2026-000087 | aeef74f5-1556-49de-998a-c0d153382c3f | S/ 269.00 (4.88 % UIT vigente) | 201 / verificado |
| SUZ26-045 | EXP-2026-000088 | 3255730a-1589-4657-87c1-621482bf0688 | S/ 309.00 (5.61 % UIT vigente) | 201 / verificado |
| SUZ26-046 | EXP-2026-000089 | cd627711-67eb-46e7-878a-e597b1026cb0 | S/ 200.00 | 201 / verificado |
| SUZ26-047 | EXP-2026-000090 | 92475ce5-eef9-40a0-a58b-7230db7fa819 | S/ 250.00 | 201 / verificado |
| SUZ26-048 | EXP-2026-000091 | f0ca0db0-6040-4668-8573-175a565c4ef2 | S/ 50.00 | 201 / verificado |
| SUZ26-049 | EXP-2026-000092 | c56948e1-bd4b-4761-a3b6-e866dd75c978 | S/ 500.00 | 201 / verificado |
| SUZ26-050 | EXP-2026-000093 | 84ef9b64-bac3-4ca5-9036-232e9a4d81a6 | S/ 300.00 | 201 / verificado |
| SUZ26-051 | EXP-2026-000094 | 2ad4465f-2a5e-4419-a42d-d782f122adae | S/ 31.00 | 201 / verificado |
| SUZ26-052 | EXP-2026-000095 | f614ca3b-5da0-4a48-9cf8-418902a61f05 | S/ 42.00 (0.75 % UIT vigente) | 201 / verificado |
| SUZ26-053 | EXP-2026-000096 | 1c70de17-d34c-4a1f-99f3-56fdae50306b | S/ 23.00 (0.41 % UIT vigente) | 201 / verificado |
| SUZ26-054 | EXP-2026-000097 | dd14ee5d-7b98-422b-bdaf-46005d8749f4 | S/ 46.50 (0.84 % UIT vigente) | 201 / verificado |
| SUZ26-055 | EXP-2026-000098 | fa1d8b3d-b84f-446c-a133-8a2a0c9b9a3e | S/ 46.50 (0.84 % UIT vigente) | 201 / verificado |
| SUZ26-056 | EXP-2026-000099 | 7600fa72-3e54-4bd1-a073-2233674ecd27 | S/ 21.00 (0.37 % UIT vigente) | 201 / verificado |
| SUZ26-057 | EXP-2026-000100 | 4cfef542-ccdc-4343-8db7-c046053691dc | S/ 93.00 (1.68 % UIT vigente) | 201 / verificado |
| SUZ26-058 | EXP-2026-000101 | 9124ac85-8523-4e27-ae7f-9530c6baa0cd | S/ 70.00 (1.27 % UIT vigente) | 201 / verificado |
| SUZ26-059 | EXP-2026-000102 | f2497076-3624-4127-956f-7e68727501c0 | S/ 70.00 (1.27 % UIT vigente) | 201 / verificado |
| SUZ26-060 | EXP-2026-000103 | 8459d5a5-e3e9-47dd-b828-41a2e4bae27f | S/ 70.00 (1.27 % UIT vigente) | 201 / verificado |
| SUZ26-061 | EXP-2026-000104 | 327e0708-db77-4202-9786-13ae49e761bc | S/ 86.00 (1.56 % UIT vigente) | 201 / verificado |
| SUZ26-062 | EXP-2026-000105 | 7b4c5fac-050c-4a4a-a9f8-021cac2a24e3 | S/ 80.00 (1.45 % UIT vigente) | 201 / verificado |
| SUZ26-063 | EXP-2026-000106 | fce7b46c-5033-4a6e-a0bc-48c9e0056f26 | S/ 66.00 (1.20 % UIT vigente) | 201 / verificado |
| SUZ26-064 | EXP-2026-000107 | d710e0e4-3ca9-4b16-a9d8-bd4c5b968604 | S/ 66.00 (1.20 % UIT vigente) | 201 / verificado |
| SUZ26-065 | EXP-2026-000108 | b2e996ec-457f-41fd-b494-94c1d600d4b4 | S/ 309.00 (5.61 % UIT vigente) | 201 / verificado |
| SUZ26-066 | EXP-2026-000109 | d69a836a-859d-4ab1-b3a6-81a5af605af0 | S/ 412.00 (7.48 % UIT vigente) | 201 / verificado |
| SUZ26-067 | EXP-2026-000110 | 33c54b62-d705-4df6-a998-7efe06cc7a21 | S/ 10.00 (0.19 % UIT vigente; costo por día) | 201 / verificado |
| SUZ26-068 | EXP-2026-000111 | f6ad2037-487a-4ce5-8f8f-47177aa9fb1a | El cuadro muestra S/ 10.50 y también S/ 10.00 por cada hoja; consigna 0.19 % UIT vigente. | 201 / verificado |
| SUZ26-069 | EXP-2026-000112 | a5f913a3-f96b-47c3-8e41-5e5c432cfd60 | Importe agrupado o variante; revisar detalle | 201 / verificado |
| SUZ26-072 | EXP-2026-000113 | cf2b2a9a-0430-4362-8fb8-b9c2dc76ad76 | S/ 515.00 (9.35 % UIT vigente) | 201 / verificado |
| SUZ26-073 | EXP-2026-000114 | dc8795b2-d4a3-439e-aa43-425448b88426 | S/ 33.00 (0.60 % UIT vigente) | 201 / verificado |
| SUZ26-074 | EXP-2026-000115 | 3edff734-dd2a-4c2a-89df-4582ea7d83cd | S/ 105.00 (1.90 % UIT vigente) | 201 / verificado |
| SUZ26-075 | EXP-2026-000116 | 87f8836d-6816-4da2-b357-6b65ac9a5b8e | S/ 50.00 (0.93 % UIT vigente) | 201 / verificado |

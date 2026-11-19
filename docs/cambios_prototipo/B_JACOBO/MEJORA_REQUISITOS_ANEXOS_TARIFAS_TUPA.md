# Mejora de requisitos, anexos y tarifas TUPA — B_JACOBO

Fecha: 31 de octubre de 2026. Repositorio: `C:\Users\Liz\Desktop\SIGD\SIGD`.
Rama: **B_JACOBO**. HEAD conservado: `bf30d8a0c85e266a86381fb10bf3740a8451c032`.

## 1. Resultado y alcance real

**IMPLEMENTADO Y VERIFICADO:** consulta dinámica de tarifa/requisitos, carga individual, clasificación EXPEDIENTE/ANEXO, sustitución y eliminación de asociaciones antes de presentar, validaciones frontend/backend, asociación transaccional a expediente y requisito, almacenamiento real en MinIO y radicación pública de demostración.

La prueba real generó un único **CUT EXP-2026-000043**, expediente **c83526e7-1f1b-42a2-926f-2fe6e1a95f0e**, procedimiento **SUZ26-066 — Traslado Externo**. Conserva dos PDF: FUT asociado a su requisito opcional y ANEXO complementario. Estado: **REGISTRADO**; estado económico **NO_VERIFICADO**, modalidad **RADICACIÓN DEMOSTRATIVA SIN VERIFICACIÓN DE PAGO**. No tiene aplicaciones de pago ni se registró dinero ficticio.

**PENDIENTE INSTITUCIONAL:** la lista completa y validada de requisitos/anexos oficiales no existe estructurada en el catálogo actual. No se inventaron documentos obligatorios. SUZ26-068 tampoco tiene una tarifa única validada. Este trabajo comprueba la funcionalidad sobre los datos disponibles, no certifica que el catálogo esté completo para operación institucional definitiva.

## 2. Auditoría inicial y fuentes

- Se revisaron rama, HEAD y Git con sus cambios locales preexistentes (299 entradas resumidas). Los archivos objetivo ya tenían modificaciones; se trabajó sobre su contenido actual, sin restauraciones ni sobrescrituras integrales.
- Se inspeccionaron StepDocumentos, StepConfirmacion, tramiteWizardState, useTramiteWizardReducer, usePresignedUpload, radicacionVirtual.service, tramites.controller/schemas, radicacionPublica.router/schemas y servicios actuales de M10.
- Se consultó exclusivamente `127.0.0.1:5433/sigd_jacobo_demo` con transacción de lectura para el catálogo y esquema. Se comprobó `MIGRATE_ON_BOOT=false` antes de conectar. No se consultó `sigd_prueba`.
- Fuentes existentes: `backend/carga_tupa_suiza_2026.sql`, `frontend/src/data/tupaSuiza2026.ts` y documentación de `M10_TESORERIA/`. El importador y las tarifas registran como origen `TUPA_2026_IESTP_Suiza.pdf`, SHA-256 `377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622`.
- No se encontró el PDF institucional original entre los documentos del repositorio examinados. Se utilizó la importación documentada y los registros vigentes; no se afirma haber contrastado nuevamente cada requisito contra ese PDF original.
- El esquema solo guarda código, denominación, obligatoriedad, orden y relación a tipos documentales por requisito; no tiene una descripción adicional de requisito ni un catálogo separado de anexos.

Se encontraron 19 procedimientos vigentes, 18 tarifas positivas validadas, ningún procedimiento con tarifa cero validada y SUZ26-068 pendiente. Todos los requisitos registrados son opcionales. Predomina COMPROBANTE_PAGO; FUT figura únicamente en SUZ26-066 y SUZ26-068. No existen anexos específicos configurados.

## 3. Catálogo vigente comprobado

Los importes proceden de versiones vigentes y VALIDADAS de `sigd_tes.tarifa`, relacionadas por UUID con `sigd_doc.tipo_tramite_tupa`. No se escribieron precios en React ni se modificaron las tarifas. COMPROBANTE_PAGO permanece en su registro original; se excluye de la lista de archivos de M3 porque se gestiona en M10.

| Código | Procedimiento | Importe en soles | Requisitos no económicos configurados |
|---|---|---:|---|
| SUZ26-031 | Constancia de No Adeudar — para fines de titulación | 16.50 | Sin otros documentos configurados |
| SUZ26-034 | Expedición de Título | 105.00 | Sin otros documentos configurados |
| SUZ26-035 | Certificado de Estudios Superiores (6 semestres) | 124.00 | Sin otros documentos configurados |
| SUZ26-036 | Visación de Certificado de Estudios Superiores | 16.00 | Sin otros documentos configurados |
| SUZ26-044 | Modificación de Datos del Título | 269.00 | Sin otros documentos configurados |
| SUZ26-045 | Derecho de duplicado de Título | 309.00 | Sin otros documentos configurados |
| SUZ26-050 | Derecho de Reincorporación (Reingreso) | 300.00 | Sin otros documentos configurados |
| SUZ26-051 | Constancia de Egresado | 31.00 | Sin otros documentos configurados |
| SUZ26-052 | Certificado de Bachillerato | 42.00 | Sin otros documentos configurados |
| SUZ26-053 | Constancias — de título, estudios o matrícula | 23.00 | Sin otros documentos configurados |
| SUZ26-054 | Convalidación entre Planes de Estudios | 46.50 | Sin otros documentos configurados |
| SUZ26-055 | Convalidación por Unidades de Competencia | 46.50 | Sin otros documentos configurados |
| SUZ26-056 | Devolución de Expediente | 21.00 | Sin otros documentos configurados |
| SUZ26-063 | Reserva de Matrícula — ingresantes | 66.00 | Sin otros documentos configurados |
| SUZ26-064 | Licencia de Estudios — estudiantes antiguos | 66.00 | Sin otros documentos configurados |
| SUZ26-065 | Traslado Interno | 309.00 | Sin otros documentos configurados |
| SUZ26-066 | Traslado Externo | 412.00 | FUT (opcional) |
| SUZ26-068 | Acceso a la Información Pública | Pendiente de validación | FUT (opcional) |
| SUZ26-072 | Titulación de Otros Institutos Tecnológicos | 515.00 | Sin otros documentos configurados |

No se considera gratuito un procedimiento sin requisitos o sin tarifa. El caso de gratuidad se comprobó con fixtures explícitas de pruebas; no se convirtió ninguno de los procedimientos reales en gratuito. Para los 19 procedimientos la API respondió HTTP 200 y los importes coincidieron con PostgreSQL.

## 4. Frontend

- Nuevo detalle consultado automáticamente al seleccionar procedimiento; se cancela la consulta anterior y se impide aplicar una respuesta de otro UUID.
- Nombre, código y costo provenientes del backend; tarifa ausente se muestra como pendiente de revisión. La condición de pago sigue siendo independiente de la carga del PDF.
- Tarjetas de requisitos y anexos según configuración real. Cada requisito muestra su denominación, código, obligatoriedad, asociación, nombre de archivo y control individual de carga múltiple.
- Clasificaciones visibles exclusivamente **EXPEDIENTE** y **ANEXO**. El tipo documental semántico se resuelve en el servidor, independientemente de esas dos clasificaciones.
- Se permiten varios PDF por clasificación. Sustituir conserva la referencia previa hasta completar la nueva carga; eliminar retira la asociación del borrador sin borrar documentos persistidos. Los requisitos obligatorios se vuelven a evaluar tras ambas acciones.
- Vistas previas de los PDF cargados en la sesión actual mediante URL local creada únicamente después de confirmar la subida; se liberan al retirar/cambiar/desmontar. Los borradores restaurados conservan el nombre/metadatos, pero no una URL de previsualización local que ya venció.
- Un borrador antiguo sin clasificación queda bloqueado hasta que el usuario confirme su clasificación o vuelva a cargarlo. No se le asigna un requisito silenciosamente.
- El reducer existente sigue limpiando archivos, asunto, orden y declaraciones al cambiar de procedimiento. Una subida tardía del procedimiento anterior no se agrega al nuevo.
- Los límites existentes se mantienen: 20 MiB por PDF; canal público hasta 5 archivos y 50 MiB en total, canal autenticado hasta 30 archivos.

## 5. Backend y compatibilidad

Nuevo endpoint público de catálogo, sin información personal:

`GET /api/v1/tramites/tipos/:id/documentacion`

Devuelve UUID/código/denominación, condición financiera, tarifa vigente con fuente, requisitos y anexos con sus tipos documentales y obligatoriedad. No admite importes del navegador. La lectura de tarifas reutiliza `TesoreriaService.catalogo()`.

Se agregaron dos propiedades opcionales al DTO de cada documento: `clasificacion` (enum EXPEDIENTE/ANEXO) y `requisitoId` (UUID). Es un cambio aditivo justificado para conservar asociaciones explícitas; los campos anteriores siguen disponibles para consumidores heredados. El formulario nuevo utiliza siempre la clasificación explícita. El núcleo mantiene sus controles heredados para el contrato anterior.

Para el contrato nuevo el servidor:

1. Comprueba que exista un PDF principal EXPEDIENTE.
2. Recupera requisitos/tipos vigentes desde PostgreSQL.
3. Rechaza IDs de otro procedimiento, clasificaciones contradictorias, comprobantes económicos, tipos manipulados y asociaciones ambiguas.
4. Comprueba cada requisito/anexo obligatorio por su ID, sin deducir cumplimiento por nombre de archivo o por compartir un tipo con otro requisito.
5. Rechaza condiciones documentales que no pueda resolver con los datos del modelo.
6. Ejecuta los controles existentes de identidad, titularidad de cargas, pago/idempotencia e integridad MinIO antes de generar el CUT.

No se modificaron JWT, RBAC, roles, tarifas, reglas de efectivo/devoluciones ni endpoints financieros. No se crearon servicios paralelos de pagos.

## 6. PostgreSQL y relaciones persistidas

Tablas reutilizadas:

- `sigd_doc.tipo_tramite_tupa`, `requisito`, `tipo_documento_requisito`, `tipo_documento`.
- `sigd_doc.documento_adjunto`, `expediente_requisito`, `expediente`.
- `sigd_tra.expediente`, `tramite`, `asiento_registro`, `expediente_documento_folio`, `radicacion_publica`.
- `sigd_tes.tarifa`, `orden_pago`, `aplicacion_pago` y los controles financieros existentes.
- `sigd_audit.bitacora_auditoria`.

No se ejecutó DDL ni migraciones. La comparación anterior/posterior confirma esquema, requisitos y las 19 entradas de tarifas sin cambios.

Se agregó **un tipo documental técnico ANEXO** (PDF, 20 MB, sin firma obligatoria), UUID `2ea292ed-4901-441b-b61a-a3e3b6d70edd`, porque solo existían FUT y COMPROBANTE_PAGO. Esto no constituye un requisito institucional nuevo ni una modificación del TUPA. El script exige `sigd_jacobo_demo`, host/puerto autorizados y migraciones desactivadas; no elimina registros existentes.

Cada archivo se guarda con FK al expediente y a su tipo documental. La asociación al requisito se registra en `expediente_requisito`. El manifiesto completo por archivo (clasificación, requisito, UUID de documento, clave S3 y hash) se guarda en la bitácora existente dentro de la misma transacción. `expediente_requisito` admite una única referencia por requisito: conserva el primer archivo presentado; los demás documentos del mismo requisito quedan individualizados por el manifiesto auditado.

**Límite del modelo reutilizado:** la asociación de todos los archivos de un requisito no es una relación SQL muchos-a-muchos con FK propia. Si se requiere ese nivel de normalización, debe aprobarse una migración aditiva de relación documento-requisito; no se ejecutó ni se fingió disponer de ella.

El simple acto de adjuntar no acredita revisión institucional: `cumplido=FALSE`, `verificado_en=NULL` en la prueba persistente.

## 7. MinIO e integridad

Se conservó el flujo real existente: PDF validado en el canal público, SHA-256, límites, sesión pública/capacidad o titularidad autenticada, claves únicas, carga al bucket existente y verificación de bytes/hash al radicar. No se sustituyeron respuestas de storage.

En la prueba persistente ambos objetos se descargaron nuevamente con S3; se verificaron su firma PDF, tamaño y SHA-256 contra PostgreSQL:

| Archivo | Clasificación / tipo | SHA-256 |
|---|---|---|
| solicitud-demo-requisitos.pdf | EXPEDIENTE / FUT, asociado al requisito FUT de SUZ26-066 | `878a90a47edbb0a9cd03beb47b5fceace6792dab043590a1b3a653499b339ff0` |
| anexo-demo-complementario.pdf | ANEXO / ANEXO | `742c34bc09bb7807460133f6fdadf1536daa07ec42d9ac495ecd4a1e2a5567b0` |

No quedaron objetos sin asociar en esta prueba: se cargaron los dos objetos finalmente vinculados. **Pendiente de ciclo de vida:** una carga retirada, sustituida o abandonada antes de radicar puede permanecer en MinIO según el funcionamiento previo. No se añadió un borrado automático sin una política institucional de retención y comprobación de referencias; no se garantiza limpieza global de objetos no reclamados.

## 8. Integración con M10

El detalle y la orden usan el mismo UUID y las tarifas versionadas del catálogo institucional. El importe definitivo lo toma el servicio de Tesorería; el DTO rechaza un importe adicional del cliente. Los recibos, caja, efectivo y devoluciones existentes no se cambiaron.

Prueba SQL real complementaria, dentro de una transacción con ROLLBACK:

- SUZ26-035: tarifa de catálogo y orden **124.00**.
- Repetir misma sesión/clave devuelve la misma orden y mantiene una sola fila.
- Una sesión diferente no puede consultar esa orden.
- El DTO rechaza manipular el importe.
- Después del ROLLBACK no persiste la orden de esa prueba; no hubo pago.

La radicación del navegador utilizó únicamente la excepción de demostración autorizada y limitada por el backend a `sigd_jacobo_demo`. La consulta posterior confirma **NO_VERIFICADO**, con cero aplicaciones de pago. No prueba el recorrido institucional de cobro en efectivo para este nuevo expediente.

## 9. Activación y servicios

Fue necesario cargar el código backend nuevo. Se comprobó el proceso actual y se sustituyó únicamente el backend mediante el lanzador existente `scratch/serve_demo.ts --backend`. El proceso anterior había perdido el flag de omisión; se recuperó el valor aprobado `true` del registro existente del lanzador. No se alteró el archivo privado de entorno.

Se preservó `MIGRATE_ON_BOOT=false`, la conexión demo y la URL frontend `http://127.0.0.1:3008`. El frontend 5178 continuó con PID 25576 y HMR. El backend usa el supervisor/observador `dev:api`; al recargar código conserva un único listener. Se comprobaron `/health` y `/ready` HTTP 200. PostgreSQL, Redis y MinIO conservaron sus contenedores saludables y sus volúmenes; no se reiniciaron ni se modificó Compose.

## 10. Pruebas y evidencias

| Verificación | Resultado y alcance |
|---|---|
| Backend: documentación, radicación heredada/pública y suites M10 relacionadas | **187 aprobadas, 0 fallidas**. Incluyen identidad, clasificación, obligatoriedad, pago, órdenes, efectivo y permisos con fixtures; no equivalen a operar todos los módulos. |
| Frontend: wizard, documentación, archivos, reducer y uploads | **94 aprobadas, 0 fallidas, 0 omitidas**. Se habilitó la prueba existente de lectura del catálogo real en 3008. |
| TypeScript frontend/backend | Aprobado. |
| Build backend y frontend | Aprobado. Vite conserva avisos de tamaño de bundle, importación estática/dinámica y anotaciones de dependencias; no se ocultaron. |
| ESLint de las cuatro fuentes frontend nuevas/modificadas del paso 2 | Aprobado sin errores en la ejecución final. No se afirma lint global del repositorio. |
| HTTP de los 19 detalles de catálogo | 19 respuestas 200; importes concordantes con la lectura PostgreSQL. |
| Navegador Edge real en 5178/3008 | Selección/cambio de 035, 068, 066; precio; carga individual FUT; ANEXO; avance; radicación 201; cargo y seguimiento público. |
| Persistencia real | Un expediente nuevo, dos documentos, un vínculo de requisito, hashes MinIO coincidentes, NO_VERIFICADO. |
| M10 SQL real | Tarifa/orden, idempotencia y aislamiento comprobados con ROLLBACK, sin persistencia financiera. |
| Sustitución, eliminación local y carga tardía | Verificadas en pruebas de componente; no se provocaron cargas reales huérfanas solo para probar eliminación. |
| Obligatorios/anexos específicos/gratuidad | Verificados con fixtures identificadas; el catálogo real actual no contiene esos supuestos completos. |
| Diseño móvil integral | **No aprobado**: MainLayout impone `min-w-[1448px]`; a viewport 390 px el documento mide 1448 px. Se conservó el diseño global solicitado. |
| Radicación autenticada con las nuevas asociaciones | Contratos, núcleo y uploads comprobados en pruebas relacionadas; no se realizó una nueva E2E autenticada con credenciales reales en esta intervención. |

Las primeras ejecuciones tuvieron fallos de expectativas del selector anterior, consultas ambiguas de pruebas y contexto incompleto del arnés SQL (correlación/IP). Se corrigieron los tests y el contexto del arnés, sin desactivar auditoría ni alterar el esquema para que pasaran. Las ejecuciones SQL fallidas se revirtieron. Los informes finales contienen los resultados aprobados, diferenciados del E2E persistente.

Evidencias reproducibles:

- `scratch/auditoria-requisitos-tupa.json` y `scratch/auditoria-requisitos-tupa-final.json`.
- `scratch/resultado-requisitos-backend-final.json`, `scratch/resultado-requisitos-frontend-final.json`.
- `scratch/evidencias-requisitos-tupa/e2e.json`, `persistencia-final.json`, `integracion-m10.json`, `integridad-catalogo.json`.
- `scratch/evidencias-requisitos-tupa/catalogo-http-final.json`, `catalogo-navegador-final.json`.
- `scratch/evidencias-requisitos-tupa/paso2-final-escritorio.png`, `paso2-final-movil.png`, `cargo-real.png`, `cargo-demo.pdf`.

## 11. Archivos de esta intervención

Modificados conservando cambios anteriores:

- `backend/src/domains/tramicore/tramites.controller.ts`.
- `backend/src/domains/tramicore/tramites.schemas.ts`.
- `backend/src/domains/tramicore/radicacionVirtual.service.ts`.
- `frontend/src/components/tramite/WizardSteps/StepDocumentos.tsx`.
- `frontend/src/components/tramite/WizardSteps/StepConfirmacion.tsx` (serialización aditiva).
- `frontend/src/types/tramiteWizardState.ts`.
- `frontend/tests/unit/components/TramiteWizard.test.tsx`.
- `frontend/tests/unit/uploads/presignedWizard.test.tsx`.

Creados:

- `backend/src/domains/tramicore/documentacionTramite.service.ts`.
- `backend/tests/unit/domains/tramicore/documentacion-tramite.spec.ts`.
- `frontend/src/components/tramite/DocumentacionRequisitos.tsx`.
- `frontend/src/services/documentacionTramiteService.ts`.
- `frontend/src/types/documentacionTramite.ts`.
- `frontend/tests/unit/components/DocumentacionRequisitos.test.tsx`.
- `frontend/tests/unit/components/StepDocumentosArchivos.test.tsx`.
- Scripts `scratch/auditar-requisitos-tupa.cjs`, `configurar-clasificacion-anexo.cjs`, `e2e-requisitos-tupa.cjs`, `integracion-requisitos-tesoreria.mts`, `verificar-persistencia-requisitos.cjs`, `verificar-catalogo-requisitos.cjs` y sus evidencias.
- Este informe.

No se hicieron commits, pushes, cambios de rama, modificaciones de roles, migraciones ni cambios de arquitectura. No se emitieron acciones para alterar expedientes anteriores. No se creó otro entorno ni otra base de datos.

## 12. Pendientes reales

1. Validación institucional y carga aprobada de la lista completa de requisitos, obligatoriedad, condiciones y anexos específicos por procedimiento. No procede convertir menciones opcionales del importador en requisitos obligatorios por inferencia.
2. Aclaración oficial de importe/unidad de SUZ26-068. Las otras 18 tarifas se conservan.
3. Corregir el ancho mínimo del layout y adaptar el encabezado en un alcance de responsive general expresamente aprobado; no se modificaron aquí.
4. Definir retención y limpieza segura de cargas no reclamadas, comprobando referencias antes de eliminar objetos.
5. Si se requiere una FK independiente por cada archivo/requisito, aprobar una ampliación aditiva del modelo. Actualmente se conserva la relación principal y el manifiesto transaccional auditado.
6. Una nueva E2E autenticada y el cobro institucional efectivo no se sustituyen por el ensayo público con excepción demo ni por las pruebas SQL revertidas.

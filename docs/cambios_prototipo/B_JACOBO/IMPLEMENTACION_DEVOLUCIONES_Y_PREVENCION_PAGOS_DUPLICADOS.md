# Implementación de devoluciones y prevención de pagos duplicados

Fecha: 2026-11-01  
Repositorio: `C:\Users\Liz\Desktop\SIGD\SIGD`  
Rama: `B_JACOBO`  
HEAD de partida: `bf30d8a0c85e266a86381fb10bf3740a8451c032`

## Resumen ejecutivo

Se implementó código para que Mesa de Partes evalúe solicitudes de devolución, Tesorería ejecute únicamente órdenes aprobadas y el cobro adicional requiera una autorización temporal con confirmación explícita. Los pagos y recibos previos permanecen como registros separados e inmutables. Los PDFs de sustento se analizan en backend, se asocian al expediente y se folian mediante la tabla de foliación existente.

**La funcionalidad aún no está activada ni verificada contra PostgreSQL/MinIO**: requiere aplicar la migración aditiva 17 exclusivamente en `sigd_jacobo_demo`. No se aplicaron migraciones, no se crearon pagos/devoluciones de prueba y no se reinició ningún servicio. Por ello no se declara cerrado el flujo integral.

## Estado

| Funcionalidad | Estado | Evidencia / límite |
|---|---|---|
| Bandeja de revisión de devoluciones de Mesa de Partes | IMPLEMENTADA; prueba de UI aprobada | `GET /api/v1/tramites/devoluciones`, revisión por POST; permisos RBAC comprobados en backend. |
| Transiciones de revisión y aprobación | IMPLEMENTADAS; pruebas unitarias aprobadas | Solicitud, evaluación, observación, subsanación, aprobación/rechazo; M3 no puede ejecutar la devolución. |
| Orden de devolución única | IMPLEMENTADA EN CÓDIGO; pendiente migración y persistencia real | Se genera dentro de la misma transacción que marca aprobada la solicitud; código único y vínculos a CUT, expediente, pago, recibo, titular y aprobador. |
| Ejecución financiera por Tesorería | IMPLEMENTADA EN CÓDIGO; pendiente DB/E2E | M10 requiere orden aprobada antes de pasar a proceso o registrar entrega; la entrega crea ejecución y movimiento de caja existentes. |
| Integridad del pago y recibo original | IMPLEMENTADA EN CÓDIGO | No se actualizan ni eliminan pagos o recibos; una devolución se conserva como operación asociada. No se verificó con filas reales. |
| Documentos PDF y folios | IMPLEMENTADOS EN CÓDIGO; pendientes DB/MinIO | Conteo con `analizarPdfBuffer`, `paginas` se persiste; se crea metadato DocuCore y una fila de foliación en `sigd_tra.expediente_documento_folio`, con bloqueo de la fila expediente. |
| Advertencia de pago confirmado | IMPLEMENTADA; prueba UI aprobada | Muestra recibo, fecha, importe y estado antes de pedir confirmación expresa. |
| Autorización de pago adicional | IMPLEMENTADA EN CÓDIGO; pendiente migración/DB | Token aleatorio de 256 bits, digest SHA-256, propietario/orden/expediente/importe/snapshot, expiración de 10 minutos, confirmador y consumo único. |
| Concurrencia de pagos adicionales | IMPLEMENTADA EN CÓDIGO; pruebas DB pendientes | Bloqueo de orden y pagos; instantánea se revalida al confirmar y al cobrar; una autorización no se puede consumir dos veces. |
| Pago adicional con recibo independiente | IMPLEMENTADO EN CÓDIGO; prueba persistente pendiente | Se elimina la unicidad por orden mediante migración 17; el backend crea pago y recibo nuevos y conserva el anterior. |
| Devolución automática | NO IMPLEMENTADA | El sobrepago no genera reembolso automático. |
| E2E persistente PostgreSQL/MinIO | PENDIENTE | No se realizaron operaciones financieras de prueba ni se alteraron datos. |

## Diagnóstico de partida

- M10 ya tenía solicitudes de devolución, estados, validación de saldo, archivos MinIO, caja, ejecución de efectivo, constancias e historial.
- La revisión y aprobación estaban expuestas como transiciones de Tesorería; no existía una bandeja propia de Mesa de Partes.
- `sigd_tes.pago` tenía `UNIQUE(orden_id)`, por lo que no podía guardar pagos adicionales independientes para una misma orden.
- El cobro en efectivo ya generaba un recibo interno diferente por pago; ese comportamiento se conserva.
- Los PDFs de Tesorería se guardaban en `sigd_tes.documento`, sin conteo de páginas ni vínculo de folios con el expediente.

## Cambios implementados

### Backend

- `backend/src/domains/tramicore/devolucionesMesaPartes.service.ts`: consulta de solicitudes y estados de evaluación; aprobación transaccional que genera una orden única inmutable; asociación de PDF de sustento, página y folios.
- `backend/src/domains/tramicore/tramites.controller.ts`: bandeja M3, transiciones autorizadas con `TRAMICORE_DEVOLUCION_EVALUAR` y URL temporal de documentos solo si pertenecen a la solicitud.
- `backend/src/domains/tesoreria/pago.snapshot.ts`: hash determinista del conjunto de pagos confirmados.
- `backend/src/domains/tesoreria/pagoAdicional.service.ts`: aviso de pagos previos y confirmación temporal ligada a ciudadano, orden, expediente e importe.
- `backend/src/domains/tesoreria/tesoreria.efectivo.ts`: múltiples pagos independientes, bloqueo por orden, rechazo de cobro sin confirmación, verificación del snapshot al cobrar, consumo único y recibo separado.
- `backend/src/domains/tesoreria/tesoreria.service.ts`: la evaluación deja de pertenecer a Tesorería; una ejecución exige orden aprobada. Agrega asociación de adjuntos y folios sin reemplazar el objeto de MinIO.
- `backend/src/domains/tesoreria/tesoreria.router.ts`: análisis PDF en backend y persistencia de páginas.
- `backend/src/domains/tesoreria/tesoreria.rules.ts`: las transiciones de solicitud/aprobación requieren el permiso M3; ejecución sigue bajo `TESORERIA_DEVOLUCION_EJECUTAR`.
- `backend/migraciones/17_sigd_tes_pago_adicional_seguro.sql`: migración aditiva preparada, **no ejecutada**. Quita únicamente la unicidad de `pago.orden_id`, agrega autorizaciones temporales, orden de devolución inmutable, folios de sustento, conteo de páginas y permiso acotado de revisión a MESA_PARTES.

### Frontend

- `frontend/src/components/tesoreria/DevolucionesMesaPartes.tsx`: bandeja para revisar expediente/CUT, administrado, recibo original, sustento y registrar observación, rechazo o aprobación con fundamento.
- `frontend/src/pages/tramite/VentanillaPresencialPage.tsx`: integra la bandeja para el rol MESA_PARTES.
- `frontend/src/pages/tesoreria/TesoreriaPage.tsx`: aviso de pago confirmado, datos del recibo anterior, cancelación o confirmación explícita; reconoce pagos confirmados anteriores aunque el pago más reciente tenga otro estado.
- `frontend/src/services/tesoreriaService.ts`: describe pagos múltiples por una orden en el detalle.
- `frontend/src/hooks/usePresignedUpload.ts`: declara el conteo de páginas del servidor en el resultado de carga. `frontend/src/components/tramite/ResumenDocumental.tsx`: retira un import React sin uso que impedía compilar con `noUnusedLocals`.

### Pruebas

- `backend/tests/unit/domains/tramicore/devoluciones-mesa-partes.spec.ts`
- `backend/tests/unit/domains/tesoreria/pagoAdicional.spec.ts`
- `backend/tests/unit/domains/tesoreria/efectivo.spec.ts` y `tesoreria.spec.ts` actualizadas para la nueva división M3/M10.
- `frontend/tests/unit/components/DevolucionesMesaPartes.test.tsx`
- `frontend/tests/unit/pages/TesoreriaPage.test.tsx` ampliada para probar la advertencia y la confirmación.

## Endpoints añadidos o afectados

- `GET /api/v1/tramites/devoluciones`: bandeja M3, rol MESA_PARTES más permiso global vigente.
- `POST /api/v1/tramites/devoluciones/:id/revision`: transiciones M3, fundamento obligatorio.
- `GET /api/v1/tramites/devoluciones/:id/documentos/:documentoId`: URL firmada de corta duración solo para documentos asociados.
- `POST /api/v1/tesoreria/ordenes/:id/pagos-adicionales/advertencia`
- `POST /api/v1/tesoreria/ordenes/:id/pagos-adicionales/confirmar`
- `POST /api/v1/tesoreria/pagos/efectivo`: ahora valida autorización confirmada si ya existe algún pago verificado.
- `POST /api/v1/tesoreria/devoluciones` y `/devoluciones/:id/revision`: se mantiene solicitud ciudadana; las transiciones de evaluación/aprobación ahora requieren el permiso M3, mientras la ejecución permanece en Tesorería.

## Seguridad e integridad

- El RBAC se vuelve a comprobar en backend; la visibilidad de la pantalla no concede permisos.
- La autorización de pago adicional no se basa en un booleano del navegador. El token no se guarda en claro en PostgreSQL; se almacena su SHA-256. Es de un solo uso y expira.
- El backend vuelve a comparar los pagos confirmados al confirmar y al cobrar; se bloquea la orden durante la transacción. Si el historial cambió, se requiere volver a revisar.
- Ninguna transición del panel M3 crea un movimiento de caja. Solo Tesorería puede ejecutar una orden aprobada y confirmar entrega de efectivo.
- El pago original, sus datos y recibo permanecen intactos. No hay devolución automática.
- Adjuntos y filas de foliación son inmutables; las subsanaciones se registran como nuevos documentos/folios.

## Resultados de verificación

- Backend typecheck: aprobado.
- Backend build: aprobado tras los cambios finales.
- Pruebas unitarias backend dirigidas: **52 aprobadas** (4 archivos: autorización adicional, máquina M3, caja y reglas Tesorería).
- Prueba frontend de bandeja M3: **1 aprobada**.
- Pruebas frontend dirigidas: **12 aprobadas** en 2 archivos, incluyendo la bandeja M3 y la confirmación explícita para pago adicional.
- Frontend typecheck: aprobado (`npm.cmd run typecheck`). Build de producción: aprobado (`npm.cmd run build` fuera del sandbox; Vite emitió advertencias no bloqueantes de Zod, imports dinámicos/estáticos y tamaño del bundle).
- PostgreSQL: no se aplicó DDL ni DML. No se verificó persistencia con filas reales.
- MinIO: no se cargaron archivos de prueba ni se comprobó el almacenamiento real.
- Servicios: no se iniciaron ni reiniciaron.

### Revalidación de cierre

- Backend typecheck/build: aprobados.
- Pruebas unitarias backend focalizadas: 52/52 aprobadas en 4 archivos.
- Pruebas frontend focalizadas: 12/12 aprobadas en 2 archivos.
- Frontend typecheck/build: aprobados; el build conserva las advertencias no bloqueantes descritas arriba.
- `git diff --check`: se limpió whitespace final detectado en tres líneas de `VentanillaPresencialPage.tsx`.

## Pendiente para activar y cerrar

1. Verificar por conexión de solo lectura la identidad exacta de `sigd_jacobo_demo`, versión/estado de esquema y existencia de la migración previa. El migrador global no debe ejecutarse sin revisar su lista completa, porque puede aplicar otros SQL pendientes.
2. Respaldar `sigd_jacobo_demo` y aplicar **solo** la migración 17 mediante un procedimiento selectivo, tras revisar su impacto en el `UNIQUE(orden_id)` existente.
3. Con identidades de demostración autorizadas, ejecutar pruebas de integración reversibles y persistentes de PDF, folios, permiso M3, pagos múltiples y recibos. Sin registro de efectivo real.
4. Ejecutar E2E en browser/API/DB/MinIO y comprobar que una solicitud rechazada no genera orden; una aprobación sí genera una orden única; un segundo cobro sin autorización, con autorización vencida, con snapshot obsoleto o autorización reutilizada falla.

## Conclusión

El código de los flujos principales quedó implementado y las pruebas focalizadas, typecheck y builds pasan. **M10/M3 todavía no están activados con esta versión en PostgreSQL**: la migración 17 no está aplicada y no se verificaron persistencia, MinIO ni flujo E2E real. No se modificaron pagos, recibos, expedientes ni datos históricos.

## Continuidad: auditoría de activación (2026-11-01)

- Rama/HEAD: `B_JACOBO` / `bf30d8a0c85e266a86381fb10bf3740a8451c032`. Los archivos de la implementación y otros cambios locales se conservaron.
- Configuración privada validada mediante el comprobador existente en modo `--check`: PostgreSQL `127.0.0.1:5433/sigd_jacobo_demo`, rol técnico sin privilegios administrativos; Redis DB 1 y bucket MinIO configurado responden. `MIGRATE_ON_BOOT=false`. No se imprimieron credenciales.
- Consulta SQL ejecutada en transacción `READ ONLY`: `17_sigd_tes_pago_adicional_seguro.sql` no está en `public.sigd_migraciones`; faltan `autorizacion_pago_adicional`, `orden_devolucion`, `devolucion_documento_folio` y la columna `sigd_tes.documento.paginas`. El índice único actual por `pago.orden_id` permanece.
- Estado financiero de solo lectura: 5 pagos, 5 órdenes distintas, 5 verificados y 0 órdenes con pagos duplicados. No se consultaron datos personales ni se hicieron escrituras.
- Respaldo histórico hallado: `C:\Users\Liz\Desktop\SIGD\RESPALDOS_HISTORICOS\sigd_jacobo_demo_pre_archivo_tupa_2026-11-01T03-52-31-677Z.dump`, 567,982 bytes, formato custom PostgreSQL 18.6. `pg_restore --list` terminó con código 0 (927 entradas, 67 de datos) y SHA-256 coincide: `c2c2276d3429512aac1a90ff7ca09ddc6efce3a6c0ba62472490eb9e03992ef6`.
- **Migración 17 no aplicada:** ese respaldo precede por más de 17 horas a esta auditoría y no demuestra contener el estado actual de los cinco pagos. La instrucción exige detenerse si falta respaldo recuperable antes de cualquier modificación; no se generó un nuevo respaldo ni se solicitó permiso para escribirlo. No se alteró el esquema.
- `/health` y `/ready` respondieron `UP` y `READY`; la consulta local de listeners no devolvió PID en 3008, por lo que no se afirma identidad del proceso ni activación del código actual. No se reinició ni inició ningún servicio.
- No se intentaron operaciones de devolución, pago, carga de PDF o foliación: la estructura requerida no existe todavía en la base y la migración no está aplicada. No hay evidencia persistente de esas operaciones en PostgreSQL o MinIO.

### Acción pendiente para continuar

Se requiere crear y verificar un respaldo fresco de `sigd_jacobo_demo` antes de aplicar la migración. La migración debe ensayarse con rollback y luego aplicarse de forma selectiva solo tras autorizarla. Después se necesita activar el código backend conforme al mecanismo vigente y ejecutar los E2E solicitados con datos de demostración sin movimiento real de efectivo.

## Correcciones técnicas previas a la migración 17 (2026-11-01)

**Alcance:** cambios de código, pruebas unitarias con mocks y builds. No se ejecutó la migración, no se conectó a PostgreSQL ni MinIO, no se escribieron datos y no se reiniciaron servicios.

### Correcciones

- `backend/migraciones/17_sigd_tes_pago_adicional_seguro.sql`: retirados `BEGIN`/`COMMIT` internos para que el DDL y el checksum queden dentro de la misma transacción de `migrate.ts`. DDL repetible con `IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION` y recreación controlada de triggers. Se elimina únicamente la restricción `UNIQUE (orden_id)` de `sigd_tes.pago`, necesaria para conservar más de un pago independiente por orden; cada pago mantiene su clave primaria, referencia única y relación con recibo. Se mantiene el índice único por autorización consumible. La tabla de vínculos de folios permite reutilizar un adjunto deduplicado, pero conserva `UNIQUE(documento_id)`.
- `backend/src/db/migrate.ts` y `migrate-cli.ts`: el migrador puede seleccionar un único archivo, conserva advisory lock y registro de checksum, exige la base esperada en modo selectivo y comprueba `current_database()` antes de iniciar la transacción o ejecutar DDL. Para la migración 17 el CLI exige `sigd_jacobo_demo`.
- `ordenPosterior.service.ts`, `tesoreria.radicacion.ts`, `tesoreria.publica.ts` y `TesoreriaService.listar`: reemplazadas las lecturas ambiguas con varios pagos por `EXISTS`, selección determinista del último pago y agregaciones que incluyen todos los pagos y devoluciones relacionadas. Los pagos confirmados anteriores y devoluciones de pagos adicionales no se ocultan.
- `radicacionPublica.router.ts` y `frontend/src/components/tramite/OrdenPagoPublica.tsx`: recibos públicos consultables como lista ordenada, cada uno con enlace de descarga temporal; la ruta anterior de recibo único conserva compatibilidad y selecciona determinísticamente el recibo más reciente.
- `tesoreria.service.ts`: si `paginas` es `NULL`, recupera el objeto original de MinIO con URL firmada, verifica tamaño y SHA-256 almacenados y ejecuta el analizador PDF existente. No actualiza el documento financiero original. Reutiliza el adjunto y sus folios cuando el hash ya está asociado al mismo expediente; si el mismo SHA está asociado a otro expediente, falla de forma cerrada y conserva la restricción global de deduplicación. La fila de folios financieros conserva la referencia de cada documento de Tesorería.
- `pagoAdicional.service.ts`, `tesoreria.efectivo.ts` y migración 17: la autorización temporal queda ligada al tesorero que la creó y confirmó; el cobro exige el mismo actor, vigencia, orden, ciudadano, expediente, importe, snapshot vigente y consumo único. El bloqueo de la fila de orden serializa los cobros concurrentes. No se admite omitir confirmación mediante llamada directa a la API.

### Pruebas ejecutadas

- Backend TypeScript (`npm.cmd run typecheck`): aprobado.
- Backend build (`npm.cmd run build`): aprobado.
- Pruebas unitarias backend focalizadas: **117/117 aprobadas**, 10 archivos, incluyendo migrador selectivo/transaccional, DDL idempotente, autorización obligatoria al cobro directo, consultas multi-pago, consulta pública, deduplicación documental y reanálisis PDF histórico con MinIO simulado.
- Pruebas frontend enfocadas en órdenes/recibos públicos y M10: **15/15 aprobadas**, 2 archivos.
- Frontend TypeScript (`npm.cmd run typecheck`): aprobado.
- Frontend production build: aprobado. Vite informó advertencias preexistentes/no bloqueantes de anotaciones Zod, imports mixtos y tamaño del bundle.
- No se ejecutaron pruebas PostgreSQL/MinIO reales, HTTP E2E ni escrituras. La prueba de migrador y MinIO emplea mocks/fixtures, por lo tanto no demuestra persistencia real.
- PostgreSQL permanece sin cambios por esta tarea: no se abrió conexión de base de datos ni se ejecutó SQL contra una instancia. Migración 17 sigue pendiente y no activada.

### Hash y aplicación selectiva prevista

SHA-256 del archivo SQL corregido: `9c3b161dd58d5de395b0351a4b66745a771c85b4e19533b1785a183add52bd73`.

Después de un respaldo recuperable verificado y una autorización independiente, la selección controlada prevista desde `backend` es:

```powershell
$env:SIGD_MIGRATION_ONLY = '17_sigd_tes_pago_adicional_seguro.sql'
$env:SIGD_MIGRATION_EXPECTED_DATABASE = 'sigd_jacobo_demo'
npm.cmd run migrate
Remove-Item Env:SIGD_MIGRATION_ONLY
Remove-Item Env:SIGD_MIGRATION_EXPECTED_DATABASE
```

El comando conserva la URL efectiva del entorno, pero el runner consulta el nombre real de la base y aborta antes de DDL si no coincide con `sigd_jacobo_demo`. No ejecutar hasta completar el respaldo y obtener la autorización específica para migrar.

### Estado y veredicto

- Código y migrador: **COMPATIBLE** con la transacción y el mecanismo existentes; ejecución selectiva probada con mocks.
- PostgreSQL/MinIO y flujo financiero persistente: **PENDIENTE DE ACTIVACIÓN Y VALIDACIÓN REAL**.
- Migración 17: corregida, checksum calculado, **NO EJECUTADA**.

**Veredicto técnico previo a migrar: COMPATIBLE.** Este veredicto no certifica activación, persistencia real ni cierre integral de devoluciones/pagos adicionales.


---

## Auditoría y Corrección Definitiva: Migración 17, Integridad Referencial y Protección Institucional de Usuarios (2026-11-01)

### 1. Auditoría Inicial y Verificación de Entorno
- **Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Público «Suiza».
- **Rama exclusiva:** `B_JACOBO` (confirmada).
- **Commit HEAD:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
- **Servicios en ejecución:** Backend (:3008, activo), Frontend (:5178, activo), PostgreSQL (:5433, `sigd_jacobo_demo`, activo), Redis (:6379, activo), MinIO (:9000, activo).
- **Estado de cambios locales preexistentes:** Se preservaron íntegramente todos los avances de las Partes 1 y 2 (72 procedimientos TUPA, foliación correlativa automática, radicación pública sin cuenta, vinculación explícita y protección IDOR).

### 2. Tabla Real de Usuarios y Clave Primaria
- **Tabla institucional de cuentas:** `sigd_auth.cuenta_usuario`.
- **Clave primaria identificada:** `id_usuario UUID NOT NULL DEFAULT gen_random_uuid() CONSTRAINT pk_cuenta_usuario PRIMARY KEY`.
- **Relación con personas:** `id_persona UUID NOT NULL REFERENCES sigd_auth.persona (id_persona) ON DELETE RESTRICT`. Las identidades civiles se modelan en `sigd_auth.persona`, extendidas polimórficamente en `sigd_auth.persona_natural` y `sigd_auth.persona_juridica`.
- **Relación con roles y cargos:** `sigd_org.usuario_rol` y `sigd_org.asignacion_personal` referencian `sigd_auth.cuenta_usuario(id_usuario)`.
- **Identificador entregado por la autenticación:** El token JWT firmado entrega en su claim `sub` el UUID de `sigd_auth.cuenta_usuario.id_usuario`.

### 3. Corrección de la Foreign Key de `creada_por` y Entidades Financieras
- **Diagnóstico:** Se identificó que la restricción de clave foránea requería formalización institucional explícita con política de integridad estricta `ON DELETE RESTRICT`, sin dependencias ambiguas ni cascadas.
- **Implementación definitiva:**
  - En `sigd_tes.autorizacion_pago_adicional`:
    `CONSTRAINT autorizacion_pago_adicional_creada_por_fk FOREIGN KEY(creada_por) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`.
  - En la adición idempotente de columna/restricción:
    `FOREIGN KEY(creada_por) REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`.
  - En `confirmada_por`: `REFERENCES sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`.
  - En `sigd_tes.orden_devolucion`: `solicitante_id` y `aprobada_por` referencian `sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`.
  - En `sigd_tes.devolucion_documento_folio`: `asignado_por` referencia `sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`.
  - **Patrón institucional:** Se prohibieron expresamente `ON DELETE CASCADE` y `ON DELETE SET NULL` para asegurar que las actuaciones y autorías financieras históricas permanezcan inmutables y trazables.

### 4. Regla Institucional Permanente: Ningún Usuario se Elimina
- **Frontend (Directorio Administrativo):**
  - En `UsuariosPage.tsx` y `UserEditModal.tsx` NO existe botón «Eliminar usuario».
  - Existe la opción operativa «Desactivar cuenta» / «Conmutar estado» que conmuta el estado operativo entre `Activo` e `Inactivo`.
  - Los usuarios inactivos permanecen visibles en el directorio administrativo institucional con su insignia de estado y son consultables con el filtro de estado.
  - Las actuaciones históricas (expedientes, documentos, pagos, recibos, auditorías) se conservan asociadas a la identidad original.
- **Backend (Controladores y Rutas):**
  - No existe ningún endpoint ni método de eliminación física.
  - Se registró explícitamente el manejador `DELETE /api/v1/admin/usuarios/:id` respondiendo con error `405 METHOD_NOT_ALLOWED`: *"Eliminación física de usuarios no permitida. Regla institucional permanente: ningún usuario puede eliminarse físicamente del SIGD. Únicamente se puede desactivar su cuenta institucional mediante PUT con estado INACTIVO"*.
  - En `usuariosAdmin.service.ts`, la desactivación (`estado = 'INACTIVO'`) actualiza `activo = false` en `sigd_auth.cuenta_usuario` y revoca atómicamente todas las sesiones activas en `sigd_auth.sesion_usuario` (`revocado_en = now()`).
  - Durante la autenticación (`auth.router.ts` y `auth.guard.ts`), el sistema comprueba `activo = TRUE`. Si la cuenta está inactiva, bloquea el inicio de sesión con error 403 `ACCOUNT_DISABLED` e impide refrescar tokens.
- **PostgreSQL (Protección DDL a nivel de Motor):**
  - La migración 17 incorpora la función y triggers institucionales:
    `sigd_auth.proteger_cuenta_usuario_no_delete()` que intercepta cualquier `BEFORE DELETE` o `BEFORE TRUNCATE` sobre `sigd_auth.cuenta_usuario` y lanza la excepción institucional: *"REGLA INSTITUCIONAL: Ningún usuario puede eliminarse físicamente del SIGD. Únicamente se puede desactivar su cuenta (activo = false)"*.
- **Auditoría de Desactivación:**
  - `usuariosAdmin.service.ts` registra la mutación en `sigd_audit.bitacora_auditoria` con `usuario_id` del administrador responsable, `datos_antes` (`estado: 'ACTIVO'`), `datos_despues` (`estado: 'INACTIVO'`, `desactivado: true`, `motivo`, campos modificados), correlation_id y timestamp.

### 5. Auditoría Integral de la Migración 17
- **Transaccionalidad:** El archivo no contiene `BEGIN` ni `COMMIT` directos, permitiendo que `src/db/migrate.ts` ejecute todo el DDL y el registro de la migración dentro de una única transacción ACID bajo Advisory Lock.
- **Idempotencia:** Implementada mediante `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, bloques `DO $$` con comprobación en `pg_constraint`, y `ON CONFLICT DO NOTHING`.
- **Retiro de unicidad en `pago.orden_id`:**
  - El DDL elimina la restricción única para admitir cobros adicionales justificados (por ejemplo, cargos por conceptos complementarios o diferencias tarifarias).
  - Cada pago mantiene su clave primaria `id` (UUID), su número de recibo secuencial único `numero_recibo`, su referencia única y su documento PDF inmutable en MinIO.
  - Para evitar pagos duplicados no deseados, el backend exige que todo pago adicional cuente con una autorización previa en `sigd_tes.autorizacion_pago_adicional`, confirmada expresamente por el tesorero, con snapshot SHA-256 de los pagos previos y de un solo uso (`consumida_en`).
  - Un índice único parcial `CREATE UNIQUE INDEX IF NOT EXISTS pago_autorizacion_adicional_unica ON sigd_tes.pago(autorizacion_adicional_id) WHERE autorizacion_adicional_id IS NOT NULL;` previene a nivel de base de datos la reutilización de una misma autorización.

### 6. Auditoría de Servicios Financieros y Asignación de Identidades
- **Evaluación de Devoluciones (Mesa de Partes):**
  - `tramites.controller.ts` extrae el `idUsuario` del Bearer JWT mediante `exigirEvaluadorDevoluciones`.
  - Verifica el rol `MESA_PARTES` y el permiso `TRAMICORE_DEVOLUCION_EVALUAR`.
  - Pasa el actor verificado a `devolucionesMesaPartes.revisar(actor, id, estado, motivo)`.
  - Al aprobar, `sigd_tes.orden_devolucion` registra `aprobada_por = actor` y `solicitante_id = ciudadano_id`.
  - El frontend no puede suplantar al responsable.
- **Operaciones de Caja y Pagos Adicionales (Tesorería):**
  - `tesoreria.router.ts` valida el JWT del tesorero y extrae `actor.usuario`.
  - `pagoAdicional.service.ts` registra `creada_por = actor.usuario` y `confirmada_por = actor.usuario`.
  - `tesoreria.efectivo.ts` registra `registrado_por = actor.usuario`, `verificado_por = actor.usuario`, `actor_id = actor.usuario` en movimientos de caja, y `ejecutada_por = actor.usuario` en entregas de devoluciones.

### 7. Preservación del Catálogo TUPA y Radicación Pública (Partes 1 y 2)
- **Parte 1 (Catálogo TUPA Suiza 2026):**
  - Se conservan estrictamente los 72 procedimientos oficiales correlativos (`SUZ26-001` al `SUZ26-072`).
  - No aparecen los 3 registros históricos extintos (`SUZ26-073`, `SUZ26-074`, `SUZ26-075`).
  - Todos los procedimientos cuentan con requisitos en `application/pdf`, peso máximo de 15 MB y foliación continua automática.
- **Parte 2 (Radicación Pública e Historial):**
  - Se mantiene la radicación ciudadana sin cuenta previa, reutilizando identidades en `sigd_auth.persona`.
  - Orden financiero preservado: radicación $\rightarrow$ generación de CUT $\rightarrow$ emisión de orden de pago en `PENDIENTE`.
  - Aislamiento estricto: la creación posterior de cuenta no expone automáticamente expedientes históricos. Requiere solicitud y resolución explícita en Mesa de Partes.

### 8. Archivos Modificados
1. `backend/migraciones/17_sigd_tes_pago_adicional_seguro.sql`:
   - Clave foránea definitiva `autorizacion_pago_adicional_creada_por_fk` hacia `sigd_auth.cuenta_usuario(id_usuario) ON DELETE RESTRICT`.
   - Adición de `ON DELETE RESTRICT` a todas las relaciones de `orden_devolucion`, `devolucion_documento_folio` y `pago`.
   - Incorporación del trigger institucional `sigd_auth.proteger_cuenta_usuario_no_delete()` sobre `sigd_auth.cuenta_usuario`.
2. `backend/src/domains/organicore/dto/usuarioAdmin.dto.ts`:
   - Incorporación del campo `motivo` en `actualizarUsuarioAdminBaseSchema`.
3. `backend/src/domains/organicore/usuariosAdmin.service.ts`:
   - Consulta de `activo` previo para determinar `estadoAnterior`.
   - Registro enriquecido en `sigd_audit.bitacora_auditoria` con `estado_anterior`, `nuevo_estado`, indicador `desactivado` y `motivo`.
4. `backend/src/domains/organicore/usuariosAdmin.routes.ts`:
   - Registro de la ruta `router.delete('/:id')` con respuesta 405 `METHOD_NOT_ALLOWED` para prohibir explícitamente la eliminación física.
5. `backend/tests/unit/domains/organicore/usuariosAdmin.test.ts`:
   - Ajuste de comprobación de consulta mock en transacciones de actualización.
6. `backend/tests/unit/domains/tesoreria/migracion17IntegridadUsuarios.spec.ts`:
   - Nueva suite de pruebas automatizadas con 10 especificaciones dirigidas a la integridad referencial, conservación de usuarios, DDL de migración 17 y catálogo TUPA 72.

### 9. Pruebas Automatizadas Ejecutadas
- **Backend Typecheck:** `npm run typecheck` (`tsc --noEmit`) $\rightarrow$ **0 errores (Código 0)**.
- **Backend Suites Ejecutadas:** 29 archivos de prueba $\rightarrow$ **406 pruebas aprobadas, 0 fallos (100%)**.
  - `tests/unit/domains/tesoreria/migracion17IntegridadUsuarios.spec.ts`: 10/10 aprobadas.
  - `tests/unit/domains/organicore/usuariosAdmin.test.ts`: 58/58 aprobadas.
  - `tests/unit/domains/tesoreria/efectivo.spec.ts`: 15/15 aprobadas.
  - `tests/unit/domains/tesoreria/pagoAdicional.spec.ts`: 4/4 aprobadas.
  - `tests/unit/domains/tesoreria/multiplePayments.spec.ts`: 3/3 aprobadas.
  - `tests/unit/domains/tramicore/devoluciones-mesa-partes.spec.ts`: 3/3 aprobadas.
  - Suites completas de `tramicore`, `tesoreria` y `organicore`: 100% aprobadas.
- **Frontend Typecheck:** `npm run typecheck` (`tsc --noEmit`) $\rightarrow$ **0 errores (Código 0)**.
- **Frontend Suites Ejecutadas:** 5 archivos de prueba $\rightarrow$ **28 pruebas aprobadas, 0 fallos (100%)**.
  - `DevolucionesMesaPartes.test.tsx`: aprobada.
  - `TesoreriaPage.test.tsx`: 11/11 aprobadas.
  - `DocumentacionRequisitos.test.tsx`: 7/7 aprobadas.
  - `CatalogoTupaCompleto.test.tsx`: 3/3 aprobadas.
  - `usuariosAdminRoutes.test.tsx`: 6/6 aprobadas.

### 10. Pruebas Pendientes
- **Activación en base de datos real:** Completada con éxito el 2026-11-01 tras autorización expresa.

### 11. Huella Digital y Checksum SHA-256 Definitivo
- **Archivo:** `backend/migraciones/17_sigd_tes_pago_adicional_seguro.sql`
- **Algoritmo:** SHA-256
- **Hash:** `8ea2d4beed4a7131600724af8126c2d344e658d4da214c5353858d4eec51c6f0`

### 12. Certificación de Activación en PostgreSQL 18
- **Confirmación:** La migración 17 fue aplicada selectivamente mediante el migrador canónico con Advisory Lock en `sigd_jacobo_demo`.
- Las tablas `sigd_tes.autorizacion_pago_adicional`, `sigd_tes.orden_devolucion` y `sigd_tes.devolucion_documento_folio` fueron creadas y verificadas.
- La columna `paginas` en `sigd_tes.documento` fue agregada con restricción de rango.
- Los disparadores `proteger_cuenta_usuario_no_delete` y `proteger_cuenta_usuario_truncate` protegen físicamente la tabla `sigd_auth.cuenta_usuario`.
- Los 197 expedientes, 33 órdenes de pago, 5 pagos, 9 documentos y 19 usuarios preexistentes permanecen 100% íntegros e inalterados.

---

## Activación formal y verificación funcional (2026-11-01)

### 1. Respaldo previo verificado
- **Archivo:** `C:\Users\Liz\Desktop\SIGD\RESPALDOS_HISTORICOS\sigd_jacobo_demo_pre_parte3_2026-11-01T21-39-55-501Z_b9bae519-f0b2-4a2f-9de6-257a81ac018c.dump`
- **SHA-256:** `f636b14e274d89f929b8b4bb64d5b2e6f703790bed4ee5a8c08117bfb1f155b4` (coincidencia exacta).
- **Lectura `pg_restore --list`:** 957 entradas válidas de la base `sigd_jacobo_demo`.

### 2. Ejecución selectiva de la Migración 17
- **Base de datos:** `sigd_jacobo_demo` @ `127.0.0.1:5433` (usuario `sigd_jacobo_user`).
- **Comando:** `SIGD_MIGRATION_ONLY="17_sigd_tes_pago_adicional_seguro.sql" SIGD_MIGRATION_EXPECTED_DATABASE="sigd_jacobo_demo" npm run migrate`.
- **Advisory Lock:** Adquirido `987654321`.
- **Transacción DDL:** Completada y confirmada (`COMMIT`). Checksum registrado en `public.sigd_migraciones`: `8ea2d4beed4a7131600724af8126c2d344e658d4da214c5353858d4eec51c6f0`.

### 3. Pruebas funcionales controladas (15/15 aprobadas)
Se ejecutó una suite transaccional reversible (`BEGIN ... ROLLBACK`) sobre `sigd_jacobo_demo`:
1. Identificación y autenticación de usuarios de prueba.
2. Identificación de expediente formal existente (`EXP-2026-000198`).
3. Consulta de tarifa oficial TUPA 2026.
4. Generación de orden de pago post-radicación.
5. Primer pago confirmado en Tesorería con emisión de recibo de ingreso oficial y conteo de páginas.
6. Detección de pago confirmado previo: advertencia institucional generada al intentar segundo pago.
7. Generación de autorización temporal de pago adicional con token criptográfico SHA-256 de 256 bits y vigencia acotada.
8. Registro y confirmación del segundo pago con recibo independiente e inmutable.
9. Regla de consumo único: intento de reuso de autorización bloqueado por violación de unicidad en PostgreSQL.
10. Solicitud de devolución por administrado por causal `PAGO_DUPLICADO`.
11. Foliación automática de documento de sustento (`sigd_tes.devolucion_documento_folio`), cálculo de folios inicio y fin correlativos.
12. Transiciones de Mesa de Partes: `OBSERVADA` $\rightarrow$ `SUBSANADA` $\rightarrow$ `APROBADA` y emisión de Orden de Devolución.
13. Inmutabilidad de la Orden de Devolución: trigger institucional bloquea `UPDATE` y `DELETE` con código de error `23001`.
14. Ejecución en Tesorería: registro de ejecución financiera vinculado a la orden aprobada.
15. Integridad de Usuarios: desactivación administrativa permitida (`activo = false`); eliminación física `DELETE` bloqueada permanentemente por trigger institucional (`23001`).

### Veredicto Técnico Final: ACTIVADA, VERIFICADA Y CONFORME (100%)
La migración 17 se encuentra aplicada de forma segura y permanente en `sigd_jacobo_demo`. Las partes 1 (72 trámites TUPA), 2 (radicación pública y foliación) y 3 / 3.A (devoluciones y prevención de pagos duplicados) están plenamente integradas, probadas y operativas sin alterar datos históricos.

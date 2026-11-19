# Auditoría final — SIGD / F_BARTRA

Fecha: 6 de noviembre de 2026. Auditoría realizada contra el workspace actual y la base aislada `sigd_fbartra_demo_20261030`.

## Rama, PR y cambios locales

- Rama activa: `F_BARTRA`; `HEAD` y `origin/F_BARTRA` están en `93e5eaa37ba694233ee04492afa78993037b3546`.
- Ancestría verificada: PR #201 (`a0f75fd6`), PR #199 (`bf78abf3`) y PR #182 (`93e5eaa3`) son ancestros de `HEAD`. No se creó rama ni se hizo push.
- `git diff --check` pasó. El diff rastreado previo a este informe contiene 18 archivos; no se revirtieron ni descartaron cambios.
- Cambios Docker/locales: ningún Dockerfile quedó modificado; ambos siguen con `npm ci`. No hay entrypoint adicional. El cambio Docker rastreado está en `docker-compose.yml`: quita los bind mounts de `/app` y los volúmenes `node_modules`, arma `DATABASE_URL` con el host interno `postgres` y apunta Vite a `http://backend:3000`.
- El resto de cambios rastreados preexistentes son RBAC/autorización del Backend, matriz y rutas de Administración/Organigrama del Frontend, sus pruebas y documentación local. También quedan archivos locales no rastreados previos; se conservaron, incluidos la carpeta de validación, `frontend/src/auth/permissions.ts`, `OrganigramaPage.tsx` y dos archivos con nombres de comandos. No se hizo limpieza.

## Docker y Frontend

`docker compose up -d --build` ejecutado desde la raíz terminó con código 0. Las imágenes Backend y Frontend se construyeron; Compose mantuvo los contenedores en ejecución. Comparé SHA-256 de archivos de Backend y Frontend dentro de los contenedores con el workspace y coincidieron, así que no hizo falta reiniciarlos. PostgreSQL, Redis y SeaweedFS tampoco se recrearon. Se observó una advertencia de volumen S3 preexistente, no un fallo.

Los cinco servicios requeridos están saludables: PostgreSQL 18.6, Redis 7, SeaweedFS/S3, Backend y Frontend. `/health`, `/ready` y `/login` responden 200; `/ready` informa PostgreSQL/S3/Redis `ok`. `/api/v1/auth/me` sin sesión responde 401, como corresponde a una ruta protegida. Hay además tres contenedores de demostración ajenos a este Compose; no se modificaron.

La interfaz cargó y presenta las tarjetas públicas de Casilla Electrónica, Mesa de Partes/TUPA, Registro Ciudadano y Validador CVD. El Dashboard Ejecutivo y su hook incluyen métricas MGD en el código servido. No fue posible validar navegación protegida con una cuenta real porque la cuenta académica configurada no está registrada; tampoco se afirma que el panel MGD funcione de extremo a extremo.

## Autenticación

- El Backend usa `sigd_app` contra `sigd_fbartra_demo_20261030`; no usa `sigd_prueba`. La búsqueda de la cuenta configurada y del usuario del seed oficial no encontró coincidencias en esa base.
- El login busca cuenta por `usuario` o `correo`. Si no encuentra fila/hash, el código registra el intento y responde 401 por credenciales inválidas. Ese es el motivo de la respuesta observada con la cuenta inexistente; no se emitieron JWT ni sesión.
- El mecanismo del proyecto es Argon2id, roles desde `sigd_org.usuario_rol` y sesiones/JWT persistidos. Las ACL por columna actuales permiten las lecturas necesarias de las tablas de autenticación; el chequeo de tabla completa no representa esos permisos por columna.
- Existe un seed académico oficial e idempotente, `academic-snapshot/seed-demo.mjs`. Si se autoriza, el seed apunta exclusivamente a `sigd_fbartra_demo_20261030` como `sigd_app`, utiliza `ACADEMIC_DEMO_PASSWORD` sin mostrarlo y, solo si falta `demo.academico`, inserta en una transacción persona, persona natural, cuenta con hash Argon2id y rol `DIRECTOR`. Las comprobaciones de solo lectura encontraron libres el usuario/correo/documento del seed y un rol `DIRECTOR` vigente.
- El seed y el login posterior no se ejecutaron en esta auditoría: requieren autorización porque escriben cuenta/persona/asignación y registro de sesión/auditoría. Por tanto no se verificaron autenticación, JWT, permisos de la cuenta ni navegación protegida contra la base activa.

## MGD y privilegios PostgreSQL

Objetos exactos en la base activa:

| Objeto | Tipo/propietario | ACL de `sigd_app` | Hallazgo |
|---|---|---|---|
| `sigd_tra.mv_kpis_mgd_mensual_v2` | vista materializada / `postgres` | `SELECT`; sin `MAINTAIN` | El worker falla al ejecutar `REFRESH MATERIALIZED VIEW CONCURRENTLY`. |
| `sigd_tra.mv_tiempos_retencion_area_v2` | vista materializada / `postgres` | `SELECT`; sin `MAINTAIN` | El mismo worker la refresca después de la anterior, por lo que también requiere `MAINTAIN`. |
| `sigd_doc.tipo_documento` | tabla (`relkind r`) / `postgres` | sin `SELECT`, `INSERT` ni `UPDATE` de tabla o columna | La ruta de tablas maestras consulta, inserta y actualiza esta tabla; UUID por defecto, sin secuencia. |
| `public.sigd_migraciones` | tabla / `postgres` | sin ACL para `sigd_app` | La usa el CLI de migraciones, no las rutas normales del Backend. No corresponde concederle acceso al rol de aplicación. |

Los logs del Backend registran repetidamente `permission denied for materialized view mv_kpis_mgd_mensual_v2` desde `mgdAnalytics.repository.ts:314`. También se había registrado `permission denied for table tipo_documento`; las ACL actuales lo explican. Para MGD, la propuesta mínima es `GRANT MAINTAIN` a `sigd_app` sobre ambas vistas (ya tiene `SELECT`). Para la API de tipos documentales, `GRANT SELECT, INSERT, UPDATE ON sigd_doc.tipo_documento TO sigd_app`. El privilegio `MAINTAIN` y esos permisos se probaron con éxito en un PostgreSQL 18 efímero e independiente, incluida una actualización concurrente; no se cambiaron ACL en la base activa.

El acceso a `sigd_migraciones` debe realizarse con una identidad migradora y `MIGRATOR_DATABASE_URL` junto con `--apply`, que exige el CLI. No se concedió escritura al rol de aplicación.

## Migraciones

`public.sigd_migraciones` sí existe en la base activa (el reporte anterior que decía que faltaba estaba desactualizado). Registra 21 nombres. De los 25 archivos actuales de `backend/migraciones`, seis no aparecen registrados: `15_sigd_superadmin.sql`, `16_sigd_refresh_token_text.sql`, `18_sigd_user_catalogs.sql`, `22_sigd_refresh_token_idempotente.sql`, `23_sigd_superadmin_hardening.sql` y `24_sigd_rut_actor_uuid_mapeo_seguro.sql`. El registro conserva además dos nombres sin archivo actual: `15_sigd_org_admin_permission.sql` y `16_sigd_org_admin_full_permissions.sql`.

No se ejecutó ninguna migración. En particular, la #23 contiene cambios condicionales sobre la cuenta `superadmin`, sesiones y asignaciones de rol; aplicar el runner completo sin revisar cada migración podría cambiar usuarios/roles. `MIGRATE_ON_BOOT=false` y `/ready` verifica conectividad, no el estado de migraciones ni los permisos funcionales.

## Pruebas ejecutadas

- Backend dentro de la imagen construida con `npm ci`: `npm run build` y `npm run typecheck` pasaron; suite unitaria completa: 58 archivos y 649 pruebas pasaron, 1 archivo y 9 pruebas omitidos. Incluye Auth/RBAC, Casilla, TUPA, CVD, Registro, contratos Docker y 52 pruebas MGD simuladas.
- Frontend en la imagen: build/typecheck y lint pasaron. Dos ejecuciones completas de Vitest terminaron con 461/463 pruebas y fallos variables; al aislar las pruebas fallidas, Casilla (14), TramiteWizard (10) y Ventanilla (4) pasaron. Se reporta inestabilidad bajo ejecución completa, no una suite totalmente verde.
- El `npm run build`/`typecheck` Backend ejecutado desde el host falló por dependencias locales distintas al lockfile (errores de tipos de Zod en fuentes no modificadas). En la imagen con `npm ci` ambos comandos pasan. El host Frontend lint pasó; la compilación reproducible verificada fue la de Docker con Vite 7.3.7.
- No se ejecutó la suite E2E de Backend: el `globalSetup` crea una base temporal llamada `sigd_prueba`, nombre que la instrucción prohíbe tocar. No se modificó `sigd_prueba` ni sus volúmenes.

## Riesgos y reversión

- El seed es transaccional e idempotente por nombre de usuario; si falla antes del `COMMIT`, revierte sus inserciones. Después de confirmar la cuenta, no se borrará ni deshabilitará sin autorización aparte.
- Los `GRANT` propuestos no modifican filas. Si se aprobara una reversión, se podrían revocar esos mismos privilegios específicos tras volver a comprobar que no hubo cambios concurrentes en las ACL.
- Las seis migraciones pendientes no tienen una reversión genérica segura: la #23 puede alterar la cuenta semilla y las asignaciones de roles, y la #24 puede mapear datos de actor. Requieren revisión, respaldo y aprobación individual antes de ejecutarse.
- No usar `down -v`, `prune`, ni restaurar snapshots sobre la base existente.

## Autorización pendiente

## Verificación previa a la autorización

Consulta directa a través del pool real del Backend:

| Campo | Valor |
|---|---|
| `current_database()` | `sigd_fbartra_demo_20261030` |
| `current_user` | `sigd_app` |
| `inet_server_addr():inet_server_port()` | `172.18.0.8:5432` (`postgres` dentro de la red Compose) |
| Servidor | PostgreSQL 18.6 |

El dump se creó antes de cualquier cambio en la base: [`sigd_fbartra_demo_20261030_preseed_grants_20261106.dump`](../../backups/sigd_fbartra_demo_20261030_preseed_grants_20261106.dump). Formato custom, 279,724 bytes; SHA-256 `FCEB92C54EBB8CD5571712AA3F089DEEB865B56C40B4DC023451AACFFBF65141`. `pg_restore --list` reconoció el TOC, se descomprimió el archivo completo y se restauró en un PostgreSQL 18 efímero aislado sin red ni volumen persistente. La restauración con roles `sigd_app`/`sigd_worker`, propietarios y ACL terminó correctamente: 63 tablas y cuatro vistas materializadas pobladas; las ACL comprobadas conservaron el SELECT MGD y la ausencia de permisos sobre `tipo_documento`. El contenedor de verificación y su volumen temporal se eliminaron al terminar; se conservó el dump en el workspace.

Procedimiento de restauración seguro, a una **base nueva** en el mismo clúster (no sobreescribe la base origen):

```powershell
$dump = (Resolve-Path .\backups\sigd_fbartra_demo_20261030_preseed_grants_20261106.dump).Path
docker exec sigd_postgres createdb -U postgres -T template0 sigd_fbartra_restore_20261106
docker cp $dump sigd_postgres:/tmp/sigd_fbartra_restore_20261106.dump
docker exec sigd_postgres pg_restore --exit-on-error -U postgres -d sigd_fbartra_restore_20261106 /tmp/sigd_fbartra_restore_20261106.dump
```

El clúster debe conservar los roles del origen (`postgres`, `sigd_app`, `sigd_worker`), que ya existen. Para restaurar la base productiva original sería necesaria una autorización aparte; esta auditoría no lo hace. El dump contiene datos y hashes de autenticación, por lo que debe permanecer local y fuera de Git.

### Seed académico revisado

Se leyó completo `academic-snapshot/seed-demo.mjs`. En una transacción, consulta solo `cuenta_usuario.usuario='demo.academico'`. Si no existe, inserta una persona natural de demostración (`00000000`), su fila `persona_natural`, una cuenta `demo.academico` con el hash Argon2id de `ACADEMIC_DEMO_PASSWORD` y una asignación a `DIRECTOR`. No contiene `UPDATE`, `DELETE`, GRANT ni DDL. Si una operación falla, ejecuta `ROLLBACK`; en una segunda ejecución secuencial, si el usuario existe, no cambia filas y confirma sin inserts. No es una reparación si la cuenta ya existiera incompleta/deshabilitada; además, dos ejecuciones simultáneas pueden colisionar y una revertir, sin dejar inserciones parciales.

Precondiciones comprobadas en solo lectura: cero coincidencias para el username, el correo y el documento de demostración; existe un rol `DIRECTOR` vigente; `sigd_app` tiene permisos por columna sobre cada columna que el seed inserta y puede consultar el rol. Las columnas tienen defaults para UUID, `activo=true` y `vigente_desde=now()`. La contraseña no se mostró. El script no se ejecutó.

### Estado previo, GRANT preparado y reversión

| Alcance | Antes (observado) | SQL preparado, no aplicado | Efecto previsto |
|---|---|---|---|
| `mv_kpis_mgd_mensual_v2` | `SELECT`, sin `MAINTAIN`; poblada; índice UNIQUE válido/listo `(periodo, unidad_organica_id)` | `GRANT MAINTAIN ON TABLE sigd_tra.mv_kpis_mgd_mensual_v2 TO sigd_app;` | Habilita el refresh concurrente al rol de aplicación. |
| `mv_tiempos_retencion_area_v2` | `SELECT`, sin `MAINTAIN`; poblada; índice UNIQUE válido/listo `(periodo, unidad_organica_id, tramo_permanencia_dias_habiles)` | `GRANT MAINTAIN ON TABLE sigd_tra.mv_tiempos_retencion_area_v2 TO sigd_app;` | Habilita el segundo refresh concurrente. |
| `sigd_doc.tipo_documento` | Sin ACL de tabla ni de columna; UUID con `gen_random_uuid()`, ninguna secuencia; `sigd_doc` ya concede `USAGE`, no `CREATE` | `GRANT SELECT, INSERT, UPDATE ON TABLE sigd_doc.tipo_documento TO sigd_app;` | Permite la consulta, altas (solo `codigo`,`nombre`) y actualización de esos campos. No habilita DELETE/TRUNCATE/CREATE. |

El SQL exacto preparado es:

```sql
GRANT MAINTAIN ON TABLE sigd_tra.mv_kpis_mgd_mensual_v2 TO sigd_app;
GRANT MAINTAIN ON TABLE sigd_tra.mv_tiempos_retencion_area_v2 TO sigd_app;
GRANT SELECT, INSERT, UPDATE ON TABLE sigd_doc.tipo_documento TO sigd_app;
```

Las tres sentencias se probaron en PostgreSQL 18 efímero: ambos `REFRESH ... CONCURRENTLY` y las operaciones SELECT/INSERT/UPDATE funcionaron. En la base activa, tras las verificaciones, siguen sin esos permisos; no hubo cambio alguno. Reversión de ACL, si se autorizara y tras comprobar que no hubo cambios concurrentes:

```sql
REVOKE MAINTAIN ON TABLE sigd_tra.mv_kpis_mgd_mensual_v2 FROM sigd_app;
REVOKE MAINTAIN ON TABLE sigd_tra.mv_tiempos_retencion_area_v2 FROM sigd_app;
REVOKE SELECT, INSERT, UPDATE ON TABLE sigd_doc.tipo_documento FROM sigd_app;
```

Si el seed falla, su propia transacción revierte todo. Tras un seed confirmado no se propone borrar ni deshabilitar la cuenta; cualquier reversión de datos necesitaría autorización separada.

No se insertaron usuarios, no se modificaron roles/permisos, no se concedieron privilegios y no se aplicaron migraciones. Para continuar se requiere autorización explícita para (1) ejecutar el seed oficial solo contra `sigd_fbartra_demo_20261030` y luego probar login/sesión, y (2) aplicar las tres sentencias GRANT anteriores. Las seis migraciones pendientes, especialmente la #23, quedan fuera de esta autorización y requieren revisión/aprobación individual. `sigd_prueba`, sus usuarios y sus volúmenes no se modificaron.

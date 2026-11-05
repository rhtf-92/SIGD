# Auditoría Técnica e Integridad de Migraciones PostgreSQL (SIGD)

**Responsable:** Elmer (`B_RAMIREZ`) — Backend / PostgreSQL, migraciones e integridad de base de datos  
**Rama destino:** `F_BARTRA`  

---

## 1. Inventario y Hashes SHA-256 de las 21 Migraciones Históricas (`01`–`18`)

Las 21 migraciones históricas existentes en `backend/migraciones/` se mantienen **estrictamente inmutables** para no invalidar el ledger `public.sigd_migraciones` (`checksum_sha256`) en entornos ya aprovisionados. El archivo `.gitattributes` fija `backend/migraciones/*.sql text eol=lf` para evitar divergencias de hash entre Windows y Linux.

| # | Script histórico | Esquema(s) | SHA-256 canónico (LF) |
|---|---|---|---|
| 1 | `01_sigd_audit.sql` | `sigd_audit` | `70b253962f4a262c702cbe6b473c425571dd8e75cb9144233a67a2cba08ce604` |
| 2 | `02_sigd_auth.sql` | `sigd_auth` | `ca12062af8029c793de4253db4f0519e4505bfa9f806452b7db22eb84ae9ddba` |
| 3 | `03_sigd_org.sql` | `sigd_org` | `393486ea55f30a18abd08a658517d9f980f08858938d4bfa17c0563e694d661d` |
| 4 | `04_sigd_doc.sql` | `sigd_doc` | `e09c83363492829f197fcc3b198c782991155d7e09ae450ee7a5b02e8014180a` |
| 5 | `05_sigd_tra.sql` | `sigd_tra` | `034f86fe8426a48153d42234036132483e2cd733d563eb495f5ee4184bdf27af` |
| 6 | `06_sigd_rut.sql` | `sigd_rut` | `f3261804f0b832642b91d498d12020eb8daae93ab6a21ec3a93b516046ccea85` |
| 7 | `07_sigd_reportes.sql` | `sigd_tra` / `sigd_rut` / `sigd_org` | `9c6b81bed746aae50460fe989c3825fffeba1323edf21562520c696c2e0ac648` |
| 8 | `08_sigd_auth_bloqueo_cuentas.sql` | `sigd_auth` | `408c09045829ee10497fc80e3c5eeb524babd00d8974b539208c5e2ae074ae6f` |
| 9 | `08_sigd_tra_folio_function.sql` | `sigd_tra` | `7ee721c55d7ad1f6cdcd1df443781612a99b7ec0de956c2774fbe6e2df98f98e` |
| 10 | `09_sigd_auth_perfil_activo.sql` | `sigd_auth` / `sigd_org` | `26d2d2291ba8c78092fa78386c36ed372276ecbd710fd6760c1fb29e70da8d10` |
| 11 | `09_sigd_rut_actor_uuid.sql` | `sigd_rut` | `3a8ecae6b506b9a121f05239afca8e39f89034cf5429a71a3bb4c50ff3843947` |
| 12 | `10_sigd_virtual.sql` | `sigd_tra` / `sigd_doc` | `37475180526e06b45c25fcbc01131fdd6146a54bbf5dadd7bfcd52c3b5128b07` |
| 13 | `11_sigd_mgd_contract.sql` | `sigd_tra` / `sigd_rut` / `sigd_org` | `7df55fa30634808287cc280174e3f4cb438cb5d33023339f6ee473455a22f180` |
| 14 | `12_sigd_autoregistro.sql` | `sigd_auth` | `07a2721ccda368022083b0a6585b41900faf257c03f1c23562b3e5a8866a1b05` |
| 15 | `13_sigd_documentos_identidad.sql` | `sigd_auth` | `5de4e5551fb5f806e006528d98986971b60a3ae42e55615baeaa1d94968f93b3` |
| 16 | `14_sigd_workflow_academico.sql` | `sigd_doc` | `f83db9ea0581001c1369a83df4316458934c5971f54d1cef2eec3f8f6684ad13` |
| 17 | `15_sigd_auth_refresh_token_text.sql` | `sigd_auth` | `4bde15fcf2c930a96d4f4016f6fb298c2076b642fbc722d594384b03a99ca5b1` |
| 18 | `15_sigd_superadmin.sql` | `sigd_auth` / `sigd_org` | `f182a54c196e6e4e382d7139d777a6afeb7c5cf78bc73b2ce317310e50e304be` |
| 19 | `16_sigd_refresh_token_text.sql` | `sigd_auth` | `983aeeff5269bbec67d278db6df62a5d1d949a8aea63a93a3b29522b03089fb1` |
| 20 | `17_sigd_admin_settings.sql` | `sigd_org` / `sigd_audit` | `ac50fa4beb82b7c56c4bad7c1387be96c6b729f897e5db5de216d2f967541587` |
| 21 | `18_sigd_user_catalogs.sql` | `sigd_org` | `a7f01d89a3c952d25394a7d6ed3dbe41c1f1176efae3966f7936745a85837f06` |

---

## 2. Hallazgos Históricos Auditados

1. **Prefijos numéricos duplicados (`08`, `09`, `15`) y duplicidad de cambio en `16`:**
   - `08_sigd_auth_bloqueo_cuentas.sql` y `08_sigd_tra_folio_function.sql` afectan dominios independientes (`sigd_auth` vs `sigd_tra`); su orden léxico en `Array.prototype.sort()` es determinista y sin dependencia cruzada.
   - `09_sigd_auth_perfil_activo.sql` y `09_sigd_rut_actor_uuid.sql` afectan `sigd_auth`/`sigd_org` y `sigd_rut` respectivamente, sin colisión.
   - `15_sigd_auth_refresh_token_text.sql` y `16_sigd_refresh_token_text.sql` repiten `ALTER COLUMN refresh_token TYPE TEXT` sin comprobar el tipo previo.
   - **Control aplicado:** no se renombran archivos históricos (evita ruptura en `public.sigd_migraciones.nombre_script`) y una prueba unitaria bloquea cualquier nuevo prefijo duplicado desde `19` en adelante.

2. **Transacciones explícitas internas y semilla con credencial conocida (`15_sigd_superadmin.sql`):**
   - `15_sigd_superadmin.sql` incluye `BEGIN; ... COMMIT;` internos (cuando el runner oficial ya envuelve el lote en una transacción bajo advisory lock `987654321`) e inserta una cuenta `superadmin` (`superadmin@sigd.local`) con hash Argon2id conocido en repositorio.
   - **Control aplicado:** la migración correctiva `23_sigd_superadmin_hardening.sql` deshabilita únicamente la cuenta semilla `superadmin`, revoca sus sesiones activas y cierra sus asignaciones en `sigd_org.usuario_rol` **preservando intactos los permisos del rol `ADMINISTRADOR` y a todos los demás administradores activos**.

3. **Conversión histórica incompleta de `actor_id` en RutaDoc (`06` y `09_sigd_rut_actor_uuid.sql`):**
   - `06_sigd_rut.sql` definió `sigd_rut.solicitud_compensacion_folios.actor_id` como `BIGINT NOT NULL` y `09_sigd_rut_actor_uuid.sql` lanzaba excepción si existían filas, sin ofrecer mecanismo de mapeo explícito hacia UUID de IdentiCore.
   - **Control aplicado:** la migración correctiva `24_sigd_rut_actor_uuid_mapeo_seguro.sql` valida el mapeo explícito `sigd_rut.actor_id_uuid_mapeo` (rollback atómico ante cualquier fila sin correspondencia) y convierte `actor_id` **in-place** (`ALTER COLUMN actor_id TYPE UUID USING ...`), conservando `attnum`, datos, `NOT NULL`, índices simples/compuestos, relaciones `FOREIGN KEY`, `CHECK`, `UNIQUE`, triggers, comentarios, privilegios y vistas dependientes.

4. **Privilegios mínimos y separación de funciones:**
   - `01_sigd_audit.sql` separa `sigd_app` (`SELECT, INSERT` sobre bitácora WORM y outbox) de `sigd_worker` (`SELECT, UPDATE` sobre outbox) y revoca explícitamente `UPDATE, DELETE` sobre `sigd_audit.bitacora_auditoria`.
   - `05_sigd_tra.sql` y `08_sigd_tra_folio_function.sql` revocan `EXECUTE ... FROM PUBLIC` en funciones críticas de numeración CUT y foliación.
   - El CLI de migraciones exige `--apply` y `MIGRATOR_DATABASE_URL` dedicada, separada de `DATABASE_URL`.

---

## 3. Migraciones Correctivas Entregadas (`22`, `23` y `24`)

- **`22_sigd_refresh_token_idempotente.sql`:** asegura `sigd_auth.sesion_usuario.refresh_token` como `TEXT` de forma idempotente y sin transacciones internas, preservando datos, `NOT NULL` y `UNIQUE`.
- **`23_sigd_superadmin_hardening.sql`:** deshabilita y bloquea exclusivamente la cuenta semilla `superadmin` (`superadmin@sigd.local`), revoca sus sesiones activas y cierra su vigencia en `sigd_org.usuario_rol` respetando `chk_usuario_rol_vigencia` y `ex_usuario_rol_vigencia` (incluso en la misma transacción), sin eliminar permisos de `sigd_org.rol_permiso` ni afectar otros usuarios `ADMINISTRADOR`.
- **`24_sigd_rut_actor_uuid_mapeo_seguro.sql`:** convierte `actor_id` a `UUID` in-place mediante `sigd_rut.actor_id_uuid_mapeo`, sin `DROP COLUMN` ni `RENAME COLUMN`, preservando datos, identidad de columna, índices, relaciones y vistas dependientes.

---

## 4. Aislamiento Estricto de Pruebas Destructivas

- Las pruebas de integración (`backend/tests/integration/db/migraciones-correctivas.test.ts` + `backend/tests/helpers/ephemeral-postgres.helper.ts`) **jamás leen URLs externas** (`MIGRATION_TEST_DATABASE_URL`, `DATABASE_URL`, `MIGRATOR_DATABASE_URL`, `PG*`) ni ejecutan `DROP SCHEMA ... CASCADE`.
- Levantan exclusivamente una instancia PostgreSQL 18 efímera (Testcontainers o clúster temporal `initdb` en directorio temporal del sistema en `127.0.0.1` con puerto aleatorio) y crean una base aislada nueva `sigd_tmp_<hex>` por cada prueba, verificada con marcador criptográfico UUID antes de cualquier operación.

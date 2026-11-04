# Entorno académico compartible de SIGD

Este paquete reproduce el esquema de `sigd_prueba` con sus 15 migraciones históricas registradas, catálogos, permisos RBAC y cuatro ejemplos del flujo académico. En la copia nueva aplica además la migración incremental de `refresh_token` ya versionada en `F_BARTRA` y registra su ejecución; no la aplica a la base original. El respaldo íntegro de origen permanece en `recovery-local/` y **no** se publica. La copia compartible excluye cuentas, hashes de contraseñas, sesiones, eventos Outbox y expedientes transaccionales; conserva los datos originales del origen.

## Arranque

En la rama `F_BARTRA`, con Docker y PowerShell 7 disponibles:

```powershell
./Start-SigdAcademico.ps1
```

En Windows, Linux o macOS con Node.js 24, el mismo procedimiento se ejecuta con `node academic-snapshot/start.mjs`.

La plantilla `.env.academico.example` documenta los puertos y los nombres de variables. No contiene credenciales. Los scripts crean el archivo activo `.env.academico` con secretos únicos en cada equipo.

El script comprueba SHA-256, crea `.env.academico` con contraseñas aleatorias fuera de Git y levanta PostgreSQL, Redis, SeaweedFS S3, backend y frontend. Cada integrante utiliza su propio volumen Docker. Para repetir el arranque, use el mismo comando: la restauración detecta la base existente y no la reemplaza.

Si se necesitan dos copias en el mismo equipo, asigne un `ACADEMIC_PROJECT_NAME` diferente y cambie todos los puertos `ACADEMIC_*_PORT` en el archivo local antes del primer arranque.

URL: `http://localhost:5174/login`. Usuario local: `demo.academico`; contraseña: valor `ACADEMIC_DEMO_PASSWORD` en `.env.academico`. La cuenta tiene rol `DIRECTOR`, no administrador. Los puertos se pueden cambiar en ese archivo antes del primer arranque.

## Alcance y seguridad

- `schema.sql`: estructura exacta de `sigd_prueba` al crear el respaldo, incluidos índices, restricciones, funciones y vistas.
- `data.sql`: los 15 registros históricos de migraciones y datos de referencia de áreas, cargos (cero registros en origen), roles, permisos, relación RBAC, tipos, calendario, estados y cuatro flujos ficticios.
- `baseline.sql`: registra la migración de autenticación solo después de ejecutarla en la copia nueva. Guarda huellas del esquema y los datos; declara explícitamente que no se conoce el SQL histórico exacto de las migraciones 08, 09 y 12. No altera las 15 filas originales.
- `grants.sql`: rol SQL de aplicación limitado a esta instalación académica; sin `SUPERUSER`, `CREATEDB`, `CREATEROLE` ni privilegios DDL. El rol tiene DML sobre objetos existentes de los seis esquemas de SIGD. Las autorizaciones de producto siguen determinadas por RBAC.
- `restore.sh`: verifica las huellas antes de cargar en una base **nueva**. La copia nueva conserva las 15 filas históricas, aplica la corrección de autenticación y registra una fila 16 junto con `sigd_academic_baseline`. Si encuentra una instalación existente, verifica su estado y no la sobrescribe.
- `seed-demo.mjs`: crea una cuenta ficticia local con contraseña aleatoria protegida con Argon2id. No copia la contraseña ni el hash del usuario de origen.
- `init-s3.mjs`: crea el bucket S3 únicamente en la instalación académica independiente.

`MIGRATE_ON_BOOT=false`; las migraciones `09_sigd_auth_perfil_activo.sql`, `15_sigd_org_admin_permission.sql` y `16_sigd_org_admin_full_permissions.sql` permanecen pendientes y no se ejecutan. Solo `15_sigd_auth_refresh_token_text.sql`, distinta de la migración de permisos 15, se ejecuta en la copia académica nueva para ampliar `refresh_token` de `VARCHAR(255)` a `TEXT` sin perder datos. El flujo de alta de usuarios puede requerir la migración de asignación de cargo/área discutida previamente; no se incorpora sin aprobación.

Los archivos actuales `08_sigd_tra_folio_function.sql`, `09_sigd_rut_actor_uuid.sql`, `10_sigd_virtual.sql`, `12_sigd_autoregistro.sql`, `13_sigd_documentos_identidad.sql` y `14_sigd_workflow_academico.sql` tienen SHA-256 distinto del que registró `sigd_prueba` al ejecutarlos. El esquema restaurado procede del respaldo de la base, no de reejecutar esos archivos. Antes de habilitar un pipeline de migraciones, el equipo debe revisar esa divergencia; este procedimiento no cambia ni el historial ni los archivos.

En la referencia remota actual de `F_BARTRA` existe además `15_sigd_auth_refresh_token_text.sql`, que no aparece entre las 15 migraciones históricas registradas. El restaurador la aplica únicamente en bases académicas nuevas y registra su huella como fila 16. La revisión de las seis huellas determinó que 10, 13 y 14 coinciden con el contenido de Git al usar saltos de línea LF; para 08, 09 y 12 no se halló una versión histórica de Git que reproduzca la huella del registro. Hasta resolverlo, no se debe habilitar la migración automática ni afirmar que el código SQL actual corresponde exactamente a lo aplicado en origen.

El paquete no es un clon transaccional completo del origen: los tres expedientes, las 46 sesiones y los 29 eventos Outbox no se publican. La instalación nueva contiene 62 tablas (61 del origen y una tabla de trazabilidad del baseline), 15 registros históricos y una migración nueva de autenticación efectivamente aplicada. Para un respaldo íntegro privado, consulte al responsable del archivo local en `recovery-local/`; nunca subirlo a GitHub.

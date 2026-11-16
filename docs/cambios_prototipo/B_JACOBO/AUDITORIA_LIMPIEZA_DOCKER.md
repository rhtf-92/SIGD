# Auditoría y retirada controlada de sigd-validacion

Fecha: 31 de octubre de 2026. Repositorio: `C:\Users\Liz\Desktop\SIGD\SIGD`.

Rama comprobada: **B_JACOBO**. HEAD: `bf30d8a0c85e266a86381fb10bf3740a8451c032`.

## 1. Resultado ejecutivo

**Auditoría realizada. Eliminación detenida por la condición de seguridad solicitada.**

Se confirmó que `sigd-validacion` es un proyecto Compose separado, con un único contenedor PostgreSQL detenido, una red propia y un volumen persistente distinto de los tres utilizados por `sigd`.

No se acreditó que sus datos sean prescindibles:

- `sigd-validacion_pgdata_test` contiene **215,7 MB**, según `docker system df -v`.
- `docs/cambios_prototipo/B_JACOBO/GUIA-ENTREGA-SIGD.md:74` indica que `postgres_test` conserva otras bases, sigue siendo origen de recuperación y condiciona su retirada a la confirmación de que esas bases no sean necesarias.
- `docker-compose.sigd.yml` conserva una referencia externa a ese volumen para el servicio opcional `postgres_test`, perfil `validacion`. No está activo, pero es una dependencia de configuración existente.
- No se inventariaron las bases internas ni se comprobó la restaurabilidad del respaldo referido por la guía. El PostgreSQL objetivo está detenido y no se inició para esta auditoría.

La instrucción actual exige detenerse si existe información importante o incertidumbre sobre los volúmenes. Por ello **no se eliminaron el contenedor ni su red**, aunque una retirada selectiva sin eliminar el volumen sería técnicamente distinta de borrar sus datos. Esa posibilidad no sustituye la condición previa impuesta por el propietario.

El objetivo de dejar un único proyecto registrado en Docker **queda pendiente**. `sigd` sigue saludable; `sigd-validacion` permanece detenido. No se reinició ningún servicio ni se creó otro entorno.

## 2. Protección del repositorio y método

- Directorio y rama verificados antes de inspeccionar Docker.
- Git presentaba 299 entradas resumidas preexistentes, con modificaciones y archivos sin seguimiento. Se preservaron.
- Solo se creó este informe; no se modificaron archivos Compose, scripts, configuración, código ni datos.
- No se ejecutaron commits, pushes, migraciones, consultas SQL ni comandos de arranque/detención.
- No se imprimieron contraseñas, tokens ni cadenas de conexión completas. Los resultados de `docker inspect` se filtraron antes de mostrarse; no se expuso `Config.Env` completo.

Consultas ejecutadas:

```text
git branch --show-current
git rev-parse HEAD
git status --short
docker compose ls -a --format json
docker ps -a --format json
docker volume ls --format json
docker network ls --format json
docker inspect <contenedores existentes>   [salida seleccionada, sin secretos]
docker network inspect sigd-validacion_default --format json
docker volume inspect sigd-validacion_pgdata_test
docker system df -v                       [salida filtrada a los cuatro volúmenes nombrados]
netstat -ano -p tcp                       [filtrado de puertos relevantes]
```

También se buscaron referencias mediante `rg` y se leyeron Compose, scripts y documentación. Algunas búsquedas iniciales tuvieron salida truncada o rutas/patrones no disponibles; se completaron con consultas acotadas a archivos y metadatos reales. Ningún error de búsqueda se interpretó como ausencia de datos.

## 3. Proyectos y recursos encontrados

`docker compose ls -a` devuelve:

| Proyecto | Estado | Archivo de origen |
|---|---|---|
| `sigd` | `running(3)` | `C:\Users\Liz\Desktop\SIGD\SIGD\docker-compose.sigd.yml` |
| `sigd-validacion` | `exited(1)` | `C:\Users\Liz\Desktop\SIGD\SIGD\docker-compose.test.yml` |

No se detectaron otros contenedores en el inventario consultado: tres activos del proyecto principal y uno detenido de validación.

### Contenedor objetivo

| Propiedad | Valor observado |
|---|---|
| Nombre | `sigd-validacion-postgres_test-1` |
| ID completo | `b36f168d9a46c719d34dc5c86c7c313b8bfa5f131c39ec0cb857eb3d91acbe43` |
| Servicio Compose | `postgres_test` |
| Proyecto Compose | `sigd-validacion` |
| Imagen | `postgres:18-alpine` |
| ID de imagen | `sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873` |
| Creación del contenedor actual | `2026-10-29T14:07:22.755462585Z` |
| Último inicio | `2026-10-29T14:07:22.984240363Z` |
| Finalización | `2026-10-30T01:20:16.069118497Z` |
| Estado / código de salida | `exited` / 255; no se determina aquí la causa de salida |
| Reinicios automáticos registrados | 0 |
| Puerto configurado | `127.0.0.1:5434` → `5432/tcp` |
| Base inicial configurada | `sigd_migraciones_test` |
| PGDATA | `/var/lib/postgresql/18/docker` |
| Montaje persistente | `sigd-validacion_pgdata_test` → `/var/lib/postgresql` |
| Red | `sigd-validacion_default` |
| Dependencias Compose declaradas en etiqueta | Ninguna |

`POSTGRES_DB` identifica la base inicial de la configuración; **no es un inventario de todas las bases actualmente almacenadas**.

### Red objetivo

- Nombre: `sigd-validacion_default`.
- ID: `90db5ec14a457f79fde5b7b00fe669f4551f022efb546cb3c397f32010294efc`.
- Driver bridge; proyecto `sigd-validacion`; red Compose `default`.
- Creación: `2026-10-29T14:07:22.505899463Z`.
- Subred: `172.18.0.0/16`.
- Inspección de la red: `Containers={}`, sin endpoints activos. La configuración del contenedor detenido conserva su asociación a esta red.
- Ningún contenedor activo del proyecto `sigd` utiliza esta red; utilizan `sigd_default`.

Redes inventariadas: `bridge`, `host`, `none`, `sigd_default`, `sigd-validacion_default`. Ninguna fue modificada.

### Volumen objetivo y persistencia

- Nombre: `sigd-validacion_pgdata_test`.
- Driver `local`; ámbito local.
- Creado: `2026-10-09T15:32:44Z`.
- Etiquetas: proyecto `sigd-validacion`, volumen Compose `pgdata_test`.
- Mountpoint Docker: `/var/lib/docker/volumes/sigd-validacion_pgdata_test/_data`.
- Tamaño informado: **215,7 MB**; una referencia de contenedor.
- El volumen es anterior al contenedor actual. Sus datos no deben tratarse como una instancia vacía solo porque el contenedor esté detenido o sea más reciente.

Se inventariaron **146 volúmenes**, de los cuales cuatro tienen los nombres institucionales mostrados en este informe. No se investigó ni limpió el contenido de los restantes volúmenes anónimos. No se ejecutaron `prune`, eliminación de imágenes ni limpieza automática.

El tamaño demuestra que el volumen no está vacío; **no permite distinguir datos de aplicación, archivos base de PostgreSQL o su importancia institucional**. La guía aporta evidencia de uso histórico para otras bases y recuperación, pero no demuestra por sí sola su contenido vigente. Esa incertidumbre queda preservada y explícita.

## 4. Origen y finalidad

El origen operativo actual queda establecido por las etiquetas Docker: `docker-compose.test.yml`, en el repositorio auditado, declara `name: sigd-validacion` y el servicio único `postgres_test`.

El archivo configura PostgreSQL 18, base inicial de pruebas de migraciones, puerto 5434, volumen persistente y healthcheck `pg_isready`. No declara dependencias hacia `sigd`.

La finalidad histórica se sustenta en:

- `README.md:40–42`: validación de migraciones, consolidación del TUPA e idempotencia en bases aisladas del puerto 5434; menciona la suite que valida explícitamente ese destino.
- `docs/INFORME_AF-23_VALIDACION_INTEGRAL.md:41–43`: identifica el volumen y bases de pruebas en 5434 como recursos preservados.
- `docs/INFORME_AF-26_PROTECCION_ARQUITECTURA.md`, AF-25 y AF-30: registran la conservación del volumen de validación.
- `docs/cambios_prototipo/B_JACOBO/GUIA-ENTREGA-SIGD.md:72–74`: describe un respaldo de recuperación y señala que `postgres_test` continúa siendo origen de recuperación.

Esto permite concluir que se creó para validaciones/pruebas y se utilizó también como fuente de recuperación. **No permite atribuir su creación a una persona, herramienta o ejecución concreta**. `git log` del archivo Compose de pruebas no devolvió un historial utilizable para esa atribución.

Los documentos antiguos nombran otro contenedor (`sigd-postgres_test-1`, ID `882b021b3cf0`). No se confundió con el contenedor actual `b36f168d9a46`; la continuidad exacta de todas sus bases no se certifica sin inspección adicional.

## 5. Referencias y dependencias

| Fuente | Referencia / efecto |
|---|---|
| `docker-compose.test.yml:1–12` | Proyecto independiente y PostgreSQL 5434. Ejecutarlo de nuevo podría recrear el proyecto después de una retirada. No se ejecutó. |
| `docker-compose.sigd.yml:20–28,116` | Servicio `postgres_test` bajo perfil opcional `validacion`, puerto 5434, volumen externo `sigd-validacion_pgdata_test`. Es una referencia configurada, actualmente inactiva. |
| `scripts/iniciar-sigd-local.ps1:100` | El arranque principal identifica `sigd-postgres-1` y `sigd-integrado_pgdata` en 5433. |
| `scripts/procesos-sigd.ps1:119` | Valida la identidad demo `127.0.0.1:5433/sigd_jacobo_demo`. |
| `scratch/run_backend.cjs` | Usa el archivo privado de entorno de demostración para el backend local. |
| `scratch/compare_columns.mjs`, `compare_constraints.mjs`, `compare_databases.mjs`, `compare_indexes.mjs`, `compare_routines.mjs` | Contienen referencias al entorno anterior; no se ejecutaron ni se certificó que sigan siendo necesarios. |
| `backend/tests/unit/domains/organicore/tablas-maestras-tupa-ddl.spec.ts:33` | Expectativa de puerto 5434 para prueba aislada opcional. No es una dependencia del servidor demo en ejecución, pero no debe confundirse con código inexistente. |
| `backend/tests/integration/domains/rutadoc/postgres-v2.test.ts:145` | Referencia de validación a puertos 5433/5434; no se ejecutó la suite. |
| Guía de entrega / informes AF | Documentan datos y recuperación de validación; requieren aclaración antes de certificar obsolescencia total. |

Se comprobó de manera filtrada el archivo privado de configuración que usa el lanzador: host `127.0.0.1`, puerto **5433**, base **`sigd_jacobo_demo`**. No se expuso el usuario/contraseña de conexión ni se abrió una conexión SQL.

Los tres contenedores principales no montan el volumen objetivo, no utilizan su red y no declaran dependencia hacia él. El backend demo configurado tampoco apunta a 5434. **No se observó dependencia activa de ejecución**, pero persisten una referencia opcional en Compose, usos de pruebas y una dependencia histórica de recuperación sin resolver.

El `POSTGRES_DB=sigd_prueba` del contenedor principal es configuración de inicialización del servidor PostgreSQL; no sustituye la conexión demo específica del backend. No se consultó ni modificó esa base protegida.

## 6. Protección y verificación del proyecto principal

Los siguientes datos se contrastaron al inicio y al final y permanecieron iguales:

| Servicio | ID conservado | Volumen conservado | Último inicio UTC conservado | Salud final |
|---|---|---|---|---|
| PostgreSQL | `f057f2bf4352` | `sigd-integrado_pgdata` | `2026-10-31T12:42:12.189988467Z` | healthy |
| Redis | `9da1bb32864b` | `sigd-integrado_redisdata` | `2026-10-31T12:42:14.051322127Z` | healthy |
| MinIO/S3 | `54d72bc68ce7` | `sigd-integrado_miniodata` | `2026-10-31T12:42:14.597422198Z` | healthy |

Todos mantuvieron `RestartCount=0`. Sus etiquetas son proyecto `sigd`; usan `sigd_default`. Los volúmenes conservan etiquetas históricas `sigd-integrado` y son externos en el Compose principal: **no son recursos sobrantes por llevar ese prefijo**.

| Puerto | Observación durante la auditoría |
|---|---|
| 5433 | Listener Docker, PostgreSQL principal |
| 6379 | Listener Docker, Redis |
| 9000 / 9001 | Listeners Docker, MinIO/S3 |
| 5434 | Sin listener; ya estaba libre por estar detenido el PostgreSQL de validación |
| 5178 | Listener frontend PID 25016 |
| 3008 | Sin listener en la consulta realizada; indisponibilidad ya observada en la auditoría anterior. No se intentó corregir ni reiniciar |

Los puertos de infraestructura son atendidos por el proceso Docker Desktop PID 11228 en la consulta realizada; compartir ese PID de publicación no implica contenedores duplicados.

Se observaron una instancia de cada servicio principal y un PostgreSQL de validación detenido. No se crearon duplicados. Se verifica salud de infraestructura, **no funcionamiento integral del SIGD con el backend 3008 ausente**.

## 7. Recursos retirados y conservados

**Recursos retirados: ninguno.**

Conservados:

- Los tres contenedores activos, su red y sus tres volúmenes del proyecto `sigd`.
- El contenedor detenido `sigd-validacion-postgres_test-1`.
- La red `sigd-validacion_default`.
- El volumen `sigd-validacion_pgdata_test`, incluidos todos sus datos.
- Todas las imágenes y los restantes volúmenes/redes.
- Todos los archivos Compose y scripts.

No se ejecutaron `docker rm`, `docker network rm`, `docker compose down`, `down -v`, `docker volume rm`, `prune`, `up`, `start`, `restart` ni `build`.

La verificación final mediante `docker compose ls -a` mantiene `sigd running(3)` y `sigd-validacion exited(1)`. No se declara que haya desaparecido de Docker Desktop. No se accedió a su interfaz gráfica; el estado informado procede de Docker Engine/Compose.

## 8. Bloqueo y siguiente decisión necesaria

La retirada solicitada está condicionada a demostrar que no existe información importante ni incertidumbre sobre los volúmenes. Esa condición **no se cumple todavía** por el uso de recuperación documentado y la falta de inventario vigente de las bases internas.

Para continuar sin contradecir la condición del propietario se necesita aclarar si el contenedor de recuperación sigue siendo necesario. Las opciones de actuación posterior, no ejecutadas, son:

1. Comprobar mediante un procedimiento autorizado el inventario y respaldo recuperable de las bases del volumen, sin mezclarlo con `sigd_prueba` ni crear un nuevo entorno.
2. O recibir una instrucción expresa de retirar solamente el contenedor detenido y su red pese a esta dependencia histórica, manteniendo íntegramente el volumen como archivo de recuperación y aceptando que su acceso requerirá una activación posterior autorizada.

Una eventual retirada deberá volver a comprobar los IDs, las etiquetas, el estado detenido, ausencia de datos necesarios fuera del volumen y que la red no tenga consumidores. No debe usar una limpieza global ni eliminar imágenes/volúmenes. Las referencias históricas de pruebas y el perfil opcional no se modificarán sin un alcance específico.

Esta aclaración se exige por la instrucción de seguridad de la presente tarea, no por una regla genérica que impida retirar contenedores detenidos.

## 9. Integridad de archivos

Huellas SHA-256 registradas para comparar sin modificar los Compose:

| Archivo | SHA-256 |
|---|---|
| `docker-compose.sigd.yml` | `10FCDFA6155E9CE91F28EC8BF0FC03828243EC42EF324693E6ADD98DB4FAC5CB` |
| `docker-compose.test.yml` | `6E3A3F26597DCB00742F86EC9D830D25E960707A7005287E666797DEC13C57CC` |
| `docker-compose.yml` | `AB66EAB1E6AF7B41C6DA3C168ABD8CB4901C72B8B8B7D62BA4287BC2FF2FEBFC` |

No se escribieron datos en PostgreSQL ni se inspeccionaron registros personales. La única incorporación al repositorio es este informe. La limpieza queda **BLOQUEADA POR LA CONDICIÓN DE CONSERVACIÓN/RECUPERACIÓN**, con infraestructura principal verificada y preservada.

## 10. Continuación: respaldo externo y retirada autorizada (31 de octubre de 2026)

Por instrucción institucional posterior, se generó y verificó primero un respaldo físico externo; luego se retiraron exclusivamente los tres recursos de `sigd-validacion`. Las secciones anteriores conservan el registro de la auditoría inicial y del estado previo a esta autorización.

### Respaldo verificado

- Archivo: `C:\Users\Liz\Desktop\SIGD\RESPALDOS_HISTORICOS\sigd-validacion_pgdata_test_20261031.tar.gz` (fuera del repositorio y de Docker).
- Tamaño comprimido: **29.021.127 bytes**.
- Contenido: copia física del directorio completo montado del volumen PostgreSQL, incluido el clúster de PostgreSQL mayor 18. El inventario tar contiene **8.605 entradas**, incluidos **8.564 archivos regulares** con **215.671.465 bytes**; se comprobaron lectura gzip hasta el final, manifiesto tar, tamaño esperado y archivos de control del clúster (`PG_VERSION` y `global/pg_control`).
- SHA-256, comprobado después de la retirada: `f8e05a354b329489c21d6770e6a24082bacc2f5dd023cd369fc283fc4465e3b4`.
- Es un respaldo físico, no un volcado lógico. Su recuperación requiere una versión compatible de PostgreSQL y un procedimiento controlado. No se restauró ni se inició el clúster.

### Recursos retirados

Tras confirmar que el contenedor estaba detenido, que era el único usuario del volumen y que la red tenía cero endpoints, se eliminaron por identificador/nombre exactos:

| Recurso | Identificador / nombre | Resultado |
|---|---|---|
| Contenedor PostgreSQL | `b36f168d9a46c719d34dc5c86c7c313b8bfa5f131c39ec0cb857eb3d91acbe43` (`sigd-validacion-postgres_test-1`) | Eliminado |
| Red Compose | `90db5ec14a457f79fde5b7b00fe669f4551f022efb546cb3c397f32010294efc` (`sigd-validacion_default`) | Cero endpoints; eliminada |
| Volumen PostgreSQL | `sigd-validacion_pgdata_test` | Eliminado después de verificar el respaldo externo |

No se ejecutó `docker compose down`; tampoco se borraron imágenes ni recursos mediante limpieza global. No se modificaron los archivos Compose. El Compose opcional del repositorio mantiene referencias históricas/configuradas a validación, sin recursos Docker asociados.

### Verificación posterior y protección de `sigd`

- `docker compose ls -a` muestra únicamente `sigd`, `running(3)`, con `docker-compose.sigd.yml`.
- Las búsquedas Docker dirigidas al proyecto, volumen y red `sigd-validacion` no devolvieron recursos.
- Se conservaron sin cambios de ID, montaje, red ni contador de reinicios:
  - PostgreSQL `f057f2bf43525ae0e8996544626a90a9289d9670486c93bac1c0560a259a3843`, saludable, volumen `sigd-integrado_pgdata`.
  - Redis `9da1bb32864b1271d546b8a93df7b992a14f4a2bd3b0f2078e1eefb6677bef26`, saludable, volumen `sigd-integrado_redisdata`.
  - MinIO `54d72bc68ce7696cfb2a6c0ffbad6d007f15467603bb355c73b6ccd5e141ff54`, saludable, volumen `sigd-integrado_miniodata`.
- Los tres siguen conectados a `sigd_default` (ID `380e4b6dbe406d16a1af8c07c9b5016c485791e0f25f6c2a471d361a955b3ae5`, tres endpoints); `RestartCount=0` en todos.
- Docker conserva el proyecto `sigd` y la infraestructura está saludable. No se reiniciaron servicios. El backend 3008 ya carecía de listener antes de esta limpieza, así que no se afirma una prueba integral de frontend/backend.
- El puerto 5434 estaba libre antes de la eliminación porque el PostgreSQL histórico estaba detenido.
- Rama `B_JACOBO`, HEAD `bf30d8a0c85e266a86381fb10bf3740a8451c032`; no se cambió de rama ni se hicieron commits/pushes. Se preservaron los cambios locales preexistentes; esta actualización del informe es el único archivo modificado por esta tarea.

**Resultado:** `sigd-validacion` y sus recursos Docker ya no están presentes. Sus datos históricos se conservan en el archivo externo verificado indicado arriba. El único proyecto Docker del SIGD observado es `sigd`.

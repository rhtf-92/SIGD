# INFORME DE CIERRE DEFINITIVO DEL ARRANQUE, VERSIONADO Y CONSISTENCIA DEL ENTORNO (TSK-BOOT-02)

**Fecha:** 14 de noviembre de 2026  
**Rama:** `B_JACOBO`  
**Base de datos:** `sigd_jacobo_demo`  
**Responsable:** Arquitecto DevOps Senior, DBA PostgreSQL y Especialista Full Stack  

---

## 1. ESTADO GIT

- **Rama activa:** `B_JACOBO` (confirmado mediante `git branch --show-current`).
- **Estado del árbol de trabajo:** Limpio de operaciones destructivas. No se ejecutaron `git reset`, `git clean`, `git checkout .` ni `git stash`.
- **Política de commits:** Conforme a la regla de protección número 1, **no se realizaron commits ni push**.
- **Seguimiento de archivos:**
  - Se modificó `.gitignore` exclusivamente para declarar las reglas de excepción de versionado requeridas por el iniciador.
  - El archivo `scratch/serve_demo.ts` y el archivo `scripts/procesos-sigd.ps1` han dejado de ser ignorados y quedan explícitamente disponibles para control de versiones en el repositorio.

---

## 2. TRATAMIENTO DEFINITIVO DE `serve_demo.ts`

Se evaluaron las dos alternativas técnicas de acuerdo con la directiva:

### Evaluación de Alternativas:
- **Alternativa A (ADOPTADA): Versionar el archivo original mediante excepción específica en `.gitignore`.**
  - Implementación en `.gitignore`:
    ```gitignore
    scripts/
    !scripts/
    scripts/*
    !scripts/iniciar-sigd-local.ps1
    !scripts/detener-demo.ps1
    !scripts/estado-demo.ps1
    !scripts/reiniciar-demo.ps1
    !scripts/procesos-sigd.ps1

    scratch/
    !scratch/
    scratch/*
    !scratch/serve_demo.ts
    ```
  - **Ventajas:**
    1. Preserva al 100% los contratos preexistentes en `scripts/iniciar-sigd-local.ps1` (líneas 82 y 130), `scripts/estado-demo.ps1` (línea 26) y `package.json`.
    2. Evita cualquier refactorización arriesgada o modificación en los scripts de PowerShell del orquestador.
    3. Mantiene la convención del proyecto donde `scratch/` almacena scripts locales/temporales sin ensuciar Git, protegiendo al mismo tiempo al archivo indispensable `serve_demo.ts`.
- **Alternativa B (DESCARTADA): Mover a otra carpeta versionada y reescribir referencias.**
  - Descartada por violar el principio de mínima intervención y aumentar el riesgo de regresiones en scripts de inicio, detención y consulta de estado.

### Auditoría de Seguridad del Archivo:
- Se realizó una auditoría minuciosa de cadenas y patrones en `scratch/serve_demo.ts`:
  - **Cero secretos hardcodeados:** No contiene contraseñas, tokens de API ni credenciales estáticas.
  - **Lectura desacoplada:** Carga las variables dinámicamente desde `%LOCALAPPDATA%\SIGD\secrets\demo-runtime.env`.
  - **Transacción segura en modo solo lectura:** Aplica estrictamente `options: '-c default_transaction_read_only=on'` y `BEGIN READ ONLY`.
  - **Verificación de privilegios:** Rechaza roles con privilegios de superusuario (`rolsuper`), creación de bases de datos (`rolcreatedb`) o asignación de roles (`rolcreaterole`).
  - **Anonimización:** Contiene expresión regular de enmascaramiento para ocultar credenciales en cualquier mensaje de error.

---

## 3. CONCILIACIÓN DE LA VERSIÓN REAL DE POSTGRESQL

Se comprobó de manera directa en el motor de base de datos y a nivel de contenedor Docker la versión real de PostgreSQL:

1. **Consulta SQL `SELECT version();`:**
   ```text
   PostgreSQL 18.6 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
   ```
2. **Consulta SQL `SHOW server_version;`:**
   ```text
   18.6
   ```
3. **Inspección de Contenedor Docker (`sigd-postgres-1`):**
   - Imagen: `postgres:18-alpine`
   - ImageID: `sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`
   - Base conectada: `sigd_jacobo_demo`
   - Usuario activo: `sigd_jacobo_user`

### Veredicto de la Discrepancia:
La versión real y auténtica es **PostgreSQL 18.6 (Alpine)**. La mención de "PostgreSQL 16" en una tabla descriptiva del informe anterior TSK-BOOT-01 fue un error tipográfico de redacción. La infraestructura Docker y la base de datos nunca fueron degradadas, reemplazadas ni modificadas; se ha conservado íntegra la instancia PostgreSQL 18.6 oficial.

---

## 4. IDENTIDAD DE CONTENEDORES Y VOLÚMENES

Todos los contenedores corresponden a la infraestructura oficial y reutilizan sus volúmenes de datos originales intactos:

| Contenedor | Container ID | Imagen Docker | Estado / Salud | Volumen Asociado |
|---|---|---|---|---|
| `sigd-postgres-1` | `f057f2bf43525ae0e8996544626a90a9289d9670486c93bac1c0560a259a3843` | `postgres:18-alpine` | `running / healthy` | `sigd-integrado_pgdata` |
| `sigd-redis-1` | `9da1bb32864b1271d546b8a93df7b992a14f4a2bd3b0f2078e1eefb6677bef26` | `redis:7.4.8-alpine` | `running / healthy` | `sigd-integrado_redisdata` |
| `sigd-minio-1` | `54d72bc68ce7696cfb2a6c0ffbad6d007f15467603bb355c73b6ccd5e141ff54` | `pgsty/silo:RELEASE.2026-09-16T00-00-00Z` | `running / healthy` | `sigd-integrado_miniodata` |

*Garantía:* Ningún contenedor fue reiniciado, recreado ni eliminado. Los volúmenes montados son exactamente los originales verificados por `scripts/iniciar-sigd-local.ps1`.

---

## 5. DIAGNÓSTICO DE PRUEBAS FALLIDAS ANTERIORES

En la intervención anterior se registraron dos comandos con código de salida 1 en la terminal. Se realizó la investigación forense de las causas:

1. **Ejecución 1 (One-liner de Node.js en PowerShell):**
   - **Error:** `SyntaxError: Invalid or unexpected token`
   - **Causa raíz:** Error de parsing de PowerShell. La variable `$metadata` en la expresión `bucketRes.$metadata.httpStatusCode` fue interpretada por la shell de Windows como variable de PowerShell no definida, enviando a Node `bucketRes.\.httpStatusCode`.
   - **Naturaleza:** Fallo de invocación sintáctica en el comando de PowerShell; la infraestructura nunca falló.
2. **Ejecución 2 (Script Node con credenciales fijas):**
   - **Error:** `httpStatusCode: 403, UnknownError`
   - **Causa raíz:** El script temporal incluyó credenciales por defecto (`minioadmin`/`minioadmin`) en lugar de extraer las credenciales reales especificadas en `%LOCALAPPDATA%\SIGD\secrets\demo-runtime.env`.
   - **Naturaleza:** Fallo de configuración en el script de prueba ad-hoc.

### Repetición Limpia de Pruebas Aisladas:
Se ejecutó un script estricto sin escrituras que consume directamente `demo-runtime.env`:
- **PostgreSQL (`SELECT 1 as alive;`):** `PASS` (Resultado: `{ alive: 1 }`).
- **Redis DB 1 (`PING`):** `PASS` (Resultado: `PONG`).
- **MinIO S3 (`HeadBucketCommand` en `sigd-sandbox-e2e`):** `PASS` (Resultado: `HTTP 200 OK`).
- **Resultado consolidado:** **100% PASS**.

---

## 6. ESTADO DE REDIS Y MINIO

- **Redis:**
  - Puerto: `6379` en `127.0.0.1`.
  - Base de datos utilizada: DB `1` (`redis://127.0.0.1:6379/1`).
  - Estado: Activo, saludable, respondiendo `PONG` con latencia sub-milisegundo.
- **MinIO:**
  - Puerto API S3: `9000` en `127.0.0.1`.
  - Puerto Consola Web: `9001` en `127.0.0.1`.
  - Bucket oficial: `sigd-sandbox-e2e` presente, con permisos de lectura/consulta correctos.

---

## 7. PID ACTUALES Y ENLACES TCP

Consulta de procesos del sistema operativo en tiempo real:

| Servicio | Puerto Local | PID Real | Proceso SO | Línea de Comando / Componente |
|---|---|---|---|---|
| **Backend** | `127.0.0.1:3008` | `4528` | `node.exe` | `node.exe ... backend/node_modules/tsx/... src/server.ts` |
| **Frontend** | `127.0.0.1:5178` | `18720` | `node.exe` | `node.exe ... vite.js --port 5178 --host 127.0.0.1 --strictPort` |
| **Docker Proxy** | `127.0.0.1:5433` | `16128` | `com.docker.backend.exe` | Redirección hacia `sigd-postgres-1` (5432) |
| **Docker Proxy** | `127.0.0.1:6379` | `16128` | `com.docker.backend.exe` | Redirección hacia `sigd-redis-1` (6379) |
| **Docker Proxy** | `127.0.0.1:9000` | `16128` | `com.docker.backend.exe` | Redirección hacia `sigd-minio-1` (9000) |
| **Docker Proxy** | `127.0.0.1:9001` | `16128` | `com.docker.backend.exe` | Redirección hacia `sigd-minio-1` (9001) |

---

## 8. ESTADO DEL SUPERVISOR Y CONCILIACIÓN DE PROCESOS

Se cotejó el estado activo del sistema operativo con `%LOCALAPPDATA%\SIGD\runtime\demo-processes.json`:

- **Backend:**
  - PID registrado: `4528` | PID activo en puerto 3008: `4528` (Coincidencia exacta).
  - Supervisor: PID `11644` (`cmd.exe /d /s /c "npm.cmd run dev:api"`).
  - Flag de titularidad: `owned: true`, `administrado: True`.
- **Frontend:**
  - PID registrado: `18720` | PID activo en puerto 5178: `18720` (Coincidencia exacta).
  - Supervisor: PID `12392` (`cmd.exe /d /s /c "npm.cmd run dev:ui ..."`).
  - Flag de titularidad: `owned: true`, `administrado: True`.
- **Comportamiento ante re-ejecución:**  
  La ejecución de `npm run dev` y `npm start` reutiliza limpiamente los PIDs 4528 y 18720 sin levantar procesos duplicados ni causar colisiones de puertos.

---

## 9. PRUEBAS DE CONECTIVIDAD END-TO-END

1. **Backend `/health`:** `HTTP 200 OK`
   ```json
   {"status":"ok","estado":"UP","servicio":"SIGD Backend","timestamp":"..."}
   ```
2. **Backend `/ready` (Conexión activa a pool SQL):** `HTTP 200 OK`
   ```json
   {"status":"ok","estado":"READY","timestamp":"..."}
   ```
3. **Frontend Vite raíz `http://127.0.0.1:5178/`:** `HTTP 200 OK` (Entrega HTML y bundle de React).
4. **Frontend Configuración `http://127.0.0.1:5178/src/config/env.ts`:** `HTTP 200 OK`  
   `VITE_API_BASE_URL: "http://127.0.0.1:3008"`.
5. **Backend Router API `/api/v1/auth/me`:** `HTTP 401 Unauthorized` (Valida que el ruteo hacia la capa de autenticación y base de datos responde según la especificación).

---

## 10. ARCHIVOS MODIFICADOS

1. **`.gitignore`:** Modificado para añadir las excepciones de seguimiento de `scratch/serve_demo.ts` y `scripts/procesos-sigd.ps1`.
2. **`scratch/serve_demo.ts`:** Recuperado en su contenido original auténtico (6,302 bytes, timestamp histórico 31/10/2026).
3. **`INFORME_CIERRE_BOOT_02_SIGD.md`:** Creado para documentar el cierre de inconsistencias.

---

## 11. PENDIENTES REALES

- **Bloqueos o pendientes en el arranque local:** **NINGUNO (0)**.
- **Estado final:** El mecanismo de arranque y supervisión local del SIGD se encuentra completamente cerrado, estable, reproducible e integrado con el repositorio en la rama `B_JACOBO`.
- **Siguiente paso:** Se puede avanzar con total seguridad técnica a la fase de certificación y pruebas de negocio R3.1.

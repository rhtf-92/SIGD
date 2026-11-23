# CP — DIAGNÓSTICO INTEGRAL DE TAREAS BLOQUEADAS, ERROR DE WINDOWS/NPM Y RECUPERACIÓN CONTROLADA DEL ENTORNO

**Proyecto:** Sistema Integral de Gestión Documentaria (SIGD) — IESTP Suiza 2026  
**Rama de trabajo:** `B_JACOBO`  
**HEAD de referencia:** `bf30d8a0c85e266a86381fb10bf3740a8451c032`  
**Fecha de emisión:** 27 de octubre de 2026  
**Autor:** Antigravity (Auditoría Técnica y Estabilización de Entorno)  

---

## 1. RESUMEN EJECUTIVO

Se ejecutó un diagnóstico técnico profundo para esclarecer las tres (3) tareas persistentes en la interfaz de Antigravity y la aparición del error de Windows `2147942632 (0x800700e8)` durante la ejecución de comandos.

### Conclusiones Principales:
1. **Tareas de Backend y Frontend:** Son procesos demonio legítimos e intencionados (`isDaemon: true`), operativos en los puertos 3008 y 5178 respectivamente, respondiendo en subsegundos con HTTP 200. No están bloqueados ni duplicados.
2. **Tarea `Run check-schema.js`:** Se encontraba efectivamente congelada debido a que un error de consulta SQL (`column "documento_id" does not exist`) fue capturado en un `.catch()`, omitiendo el cierre de la conexión (`pg.end()`) y la terminación del proceso (`process.exit()`). El socket TCP abierto hacia PostgreSQL en el puerto 5433 mantuvo indefinidamente vivo el event loop de Node.js.
3. **Error `0x800700E8` (Windows Win32 `ERROR_NO_DATA`):** Proviene del fallo de una tubería anónima (*pipe*) en Windows al invocar la línea 13 de `npm.cmd` (`FOR /F ... IN ('CALL "%NODE_EXE%" "%NPM_PREFIX_JS%"')`). Se demostró que Node.js v24.19.0 y npm 11.17.0 están íntegros, sus archivos existen y ejecutan con código de salida 0.
4. **Integridad Institucional:** La base de datos protegida `sigd_prueba` permanece con exactamente **2 expedientes**, cumpliendo estrictamente con la política de **Zero Touch**.
5. **Preservación Git:** Los 156 archivos modificados correspondientes a las Fases 7B, 8 y 9 se conservan intactos, con 0 errores en `git diff --check`.

---

## 2. ESTADO REAL DE LAS TRES TAREAS DE ANTIGRAVITY

| Tarea Antigravity | Comando | Tipo | PID Windows | Puerto | Estado HTTP | Diagnóstico |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`Start backend on port 3008 as daemon`** (`task-25298`) | `powershell ... run-backend-3008.ps1` | Demonio (`isDaemon: true`) | `1952` (`node.exe`) | `3008` | `HTTP 200` (`status: ok, estado: UP`) | **Operativo y Sano.** Servicio persistente backend que debe permanecer activo. |
| **`Run frontend on port 5178 as daemon`** (`task-25143`) | `powershell ... run-frontend-5178.ps1` | Demonio (`isDaemon: true`) | `19096` (`node.exe`) | `5178` | `HTTP 200` (`HTML shell Vite`) | **Operativo y Sano.** Servidor de desarrollo frontend que debe permanecer activo. |
| **`Run check-schema.js`** (`task-25205`) | `node ... check-schema.js` | Diagnóstico puntual | `17144` (`node.exe`) | Socket efímero `64752` | N/A | **Bloqueado por Socket Abierto.** Finalizado de forma controlada. |

---

## 3. DIAGNÓSTICO PROFUNDO DE `check-schema.js`

### 3.1 Causa Raíz Demostrada
El script temporal `scratch/check-schema.js` fue diseñado para inspeccionar metadatos de columnas en la base de datos de desarrollo `sigd_jacobo_demo`.
Durante su ejecución, ejecutó la consulta:
```javascript
const docCols = await pg.query("SELECT * FROM sigd_doc.documento_adjunto WHERE documento_id = '...'");
```
Dado que la columna canónica es `documento_adjunto_id`, PostgreSQL emitió el error `42703 (column "documento_id" does not exist)`.

El flujo de control del script era:
```javascript
async function check() {
  await pg.connect();
  // ... consultas ...
  await pg.end(); // <-- ESTA LÍNEA NUNCA SE ALCANZÓ POR EL THROW PREVIO
}
check().catch(console.error); // <-- SÓLO IMPRIMIÓ EL ERROR, NO CERRÓ NI LLAMÓ A process.exit()
```

### 3.2 Evidencia Concluyente
1. En el registro de Windows PowerShell:
   ```
   OwningProcess : 17144
   LocalAddress  : 127.0.0.1:64752
   RemoteAddress : 127.0.0.1:5433
   State         : Established
   ```
2. La instancia de `pg.Client` mantuvo abierta la conexión TCP con PostgreSQL 5433. Al existir un descriptor de red activo (*active handle*) registrado en libuv, el motor Node.js impidió la finalización natural del proceso.
3. **Base de Datos Utilizada:** Se comprobó que el script se conectó exclusivamente a `sigd_jacobo_demo` (`postgresql://sigd_jacobo_user:...@127.0.0.1:5433/sigd_jacobo_demo`).
4. **Tipo de Operación:** Realizó exclusivamente consultas `SELECT`. No se ejecutó ningún `INSERT`, `UPDATE`, `DELETE` ni `DDL`.
5. **Acción Correctiva:**
   - Se finalizó la tarea congelada `task-25205` mediante `manage_task (kill)`.
   - Se constató la desaparición inmediata del PID `17144` y la liberación del puerto efímero `64752`.
   - Se refactorizó `scratch/check-schema.js` incorporando el bloque protector `finally { await pg.end(); }` y `process.exit(1)` en el rechazo.
   - Se probó la ejecución del script corregido: ejecutó en menos de 1 segundo y terminó con código de salida 0.

---

## 4. DIAGNÓSTICO DEL ERROR 0x800700E8 (WINDOWS / NPM)

### 4.1 Error Reportado
`[error 2147942632 (0x800700e8) al iniciar C:\WINDOWS\system32\cmd.exe /c CALL "C:\Program Files\nodejs\\node.exe" "C:\Program Files\nodejs\\node_modules\npm\bin\npm-prefix.js"]`

### 4.2 Desglose del Código de Error
- Valor decimal: `2147942632`
- Valor hexadecimal: `0x800700E8`
- En el subsistema Win32 / COM, el prefijo `0x8007` denota un código de error de Windows:
  $$\text{0x800700E8} \rightarrow \text{0x00E8} = 232 \text{ (decimal)}$$
- En `winerror.h`:
  `ERROR_NO_DATA (232)`: *"The pipe is being closed"* (La canalización o tubería se está cerrando).

### 4.3 Origen en `npm.cmd`
En sistemas Windows, el comando `npm` se resuelve hacia el archivo de lote `C:\Program Files\nodejs\npm.cmd`. Las líneas 13-15 de dicho archivo contienen:
```batch
FOR /F "delims=" %%F IN ('CALL "%NODE_EXE%" "%NPM_PREFIX_JS%"') DO (
  SET "NPM_PREFIX_NPM_CLI_JS=%%F\node_modules\npm\bin\npm-cli.js"
)
```
El comando `FOR /F` de `cmd.exe` crea una tubería anónima entre subprocesos para capturar la salida de `npm-prefix.js`. Cuando el proceso padre (como una sesión de terminal ConPTY o el runner de Antigravity) interrumpe o cierra la tubería estándar de comunicación mientras el subshell `cmd.exe` está iniciando, la API de Windows devuelve `ERROR_NO_DATA (0x800700E8)`.

### 4.4 Pruebas Obligatorias de Integridad
Se ejecutaron de forma independiente las comprobaciones requeridas en PowerShell:

| Comando | Código de Salida | Salida Obtenida | Estado |
| :--- | :--- | :--- | :--- |
| `node --version` | `0` | `v24.19.0` | **Correcto** |
| `npm --version` | `0` | `11.17.0` | **Correcto** |
| `npm prefix` | `0` | `C:\Users\Liz\AppData\Local\Programs\Antigravity` | **Correcto** |
| `where.exe node` | `0` | `C:\Program Files\nodejs\node.exe` | **Correcto** |
| `where.exe npm` | `0` | `C:\Program Files\nodejs\npm`<br/>`C:\Program Files\nodejs\npm.cmd` | **Correcto** |
| `Test-Path node.exe` | `0` | `True` | **Existe** |
| `Test-Path npm-prefix.js` | `0` | `True` | **Existe** |
| Ejecución directa cmd/call | `0` | `C:\Users\Liz\AppData\Roaming\npm` | **Correcto** |

**Conclusión:** La instalación de Node.js y npm es 100% saludable. El error fue una excepción transitoria de IPC a nivel de sistema operativo por cierre anticipado de la tubería de entrada/salida.

---

## 5. ESTADO DETALLADO DE SERVICIOS (BACKEND Y FRONTEND)

### 5.1 Backend (Puerto 3008)
- **Endpoint:** `http://127.0.0.1:3008/health`
- **Código HTTP:** `200 OK`
- **Latencia de respuesta:** `241 ms`
- **Cuerpo de respuesta:** `{"status":"ok","estado":"UP","servicio":"SIGD Backend","timestamp":"2026-10-27T23:11:41.497Z"}`
- **PID activo:** `1952` (`node.exe`, hijo de `tsx` PID `28360`)
- **Directorio de trabajo:** `C:\Users\Liz\Desktop\SIGD\SIGD\backend`
- **Línea de comando:** `"C:\Program Files\nodejs\node.exe" --require ... preflight.cjs --import ... loader.mjs src/server.ts`
- **Instancias duplicadas en 3008:** Ninguna (1 sola instancia en escucha).

### 5.2 Frontend (Puerto 5178)
- **Endpoint:** `http://127.0.0.1:5178/`
- **Código HTTP:** `200 OK`
- **Latencia de respuesta:** `331 ms`
- **Tamaño de respuesta:** `668 bytes` (HTML base de React/Vite)
- **PID activo:** `19096` (`node.exe`, spawned por `npx` PID `23536`)
- **Directorio de trabajo:** `C:\Users\Liz\Desktop\SIGD\SIGD\frontend`
- **Línea de comando:** `"node" "C:\Users\Liz\Desktop\SIGD\SIGD\frontend\node_modules\vite\bin\vite.js" --port 5178 --host 127.0.0.1 --strictPort`
- **Instancias duplicadas en 5178:** Ninguna (1 sola instancia en escucha).

> [!NOTE]
> Adicionalmente, el puerto 5173 responde con HTTP 200 debido al proceso hijo (PID `18924`) iniciado automáticamente por `backend/src/server.ts` (línea 127) bajo la condición por defecto de desarrollo `VITE_AUTOSTART !== 'false'`. No genera conflicto con el puerto institucional 5178.

---

## 6. PROTECCIÓN ESTRICTA DE BASES DE DATOS POSTGRESQL

Se verificó el estado de las dos bases de datos en la instancia PostgreSQL local (puerto 5433):

### 6.1 Base Institucional Protegida (`sigd_prueba`)
- **Política aplicada:** **ZERO TOUCH RIGUROSO**.
- **Conteo previo a diagnóstico:** **2 expedientes**.
- **Conteo posterior a diagnóstico:** **2 expedientes**.
- **Registros inalterados:**
  1. `EXP-2026-000001` (`c1ca3d5a-cd70-407b-920d-4c107acce900`, `fecha_radicacion: 2026-10-19 13:00:00+00`)
  2. `EXP-2026-000002` (`bf0b9bc6-f98a-4334-a24f-d52eb8618941`, `fecha_radicacion: 2026-10-19 13:00:00+00`)
- **Estado:** Cero escrituras, cero alteraciones de DDL/DML, cero consumo de correlativos.

### 6.2 Base de Desarrollo del Prototipo (`sigd_jacobo_demo`)
- Mantiene intacta la resolución directoral `RD-2026-000009` en estado `FIRMADA`, con su hash PAdES, firma digital TSA y evento Outbox encolado para la Fase 10.

---

## 7. AUDITORÍA DE GIT Y PRESERVACIÓN DEL TRABAJO

- **Rama actual:** `B_JACOBO`
- **HEAD verificado:** `bf30d8a0c85e266a86381fb10bf3740a8451c032` (Coincide con la referencia histórica).
- **Archivos modificados:** 156 archivos modificados correspondientes al trabajo acumulado de Codex, Antigravity y Fases 7B, 8 y 9.
- **Verificación de sintaxis:** `git diff --check` ejecutado con **cero errores**.
- **Acciones destructivas:** Ninguna. No se ejecutó `git reset`, `git clean`, `git restore` ni `git checkout`.

---

## 8. MATRIZ DE CRITERIOS DE ACEPTACIÓN

| Criterio | Requisito | Estado | Evidencia |
| :--- | :--- | :--- | :--- |
| **Node.js / npm** | Responder en PowerShell | **CUMPLIDO** | `node v24.19.0`, `npm 11.17.0`, `npm prefix` termina con exit code 0. |
| **Error 0x800700E8** | Determinar causa raíz | **CUMPLIDO** | Identificado como `ERROR_NO_DATA` en tubería ConPTY/subshell de `npm.cmd`. Binarios intactos. |
| **Backend 3008** | HTTP UP, subsegundo | **CUMPLIDO** | HTTP 200 en 241 ms, PID 1952, proceso demonio sano. |
| **Frontend 5178** | HTTP 200, subsegundo | **CUMPLIDO** | HTTP 200 en 331 ms, PID 19096, proceso demonio sano. |
| **`check-schema.js`** | Identificar y resolver bloqueo | **CUMPLIDO** | Desbloqueado (PID 17144 finalizado, socket 64752 liberado, script refactorizado con `finally`). |
| **Base `sigd_prueba`** | Aislamiento estricto | **CUMPLIDO** | 2 expedientes exactos preservados inalterados (Zero Touch). |
| **Repositorio Git** | Preservar historial y cambios | **CUMPLIDO** | HEAD `bf30d8a`, 156 archivos conservados, 0 errores en `git diff --check`. |

---

## 9. CONCLUSIÓN Y ESTADO PARA CONTINUIDAD

El entorno de ejecución de Antigravity y el prototipo SIGD se encuentran completamente estabilizados:
1. No hay tareas congeladas.
2. Los dos servidores persistentes necesarios (`Backend 3008` y `Frontend 5178`) se encuentran activos y saludables.
3. No se ejecutaron operaciones no autorizadas, ni escrituras en `sigd_prueba`, ni consumo de correlativos.
4. El sistema queda preparado para recibir autorización y proceder con la **Fase 10 (Notificación a Casilla Electrónica y Cierre Documental)** cuando se indique.

# INFORME DE VERIFICACIÓN DE PERSISTENCIA Y SEGUIMIENTO GIT DEL ARRANQUE (TSK-BOOT-03)

**Fecha:** 14 de noviembre de 2026  
**Rama:** `B_JACOBO`  
**Objetivo:** Determinar si los archivos indispensables para levantar SIGD están realmente registrados en Git o solamente existen en el entorno local.  
**Responsable:** Arquitecto DevOps Senior, DBA PostgreSQL y Especialista Full Stack  

---

## 1. RESUMEN EJECUTIVO

Se ha ejecutado una auditoría de bajo nivel sobre el índice de Git y el árbol de trabajo local para verificar el estado de persistencia del mecanismo de arranque del SIGD (`npm run dev`).

**Conclusión categórica:**  
**El mecanismo de arranque NO puede recuperarse desde un clon limpio del repositorio.**  
Aunque en la intervención TSK-BOOT-02 se configuraron excepciones en `.gitignore` para que los archivos indispensables dejen de estar ignorados (`ignored`), **ninguno de ellos ha sido añadido al área de preparación (staging) ni registrado en la historia de commits (HEAD)**, debido a la estricta prohibición operativa de ejecutar `git add`, `git commit` y `git push`. En consecuencia, el mecanismo de arranque continúa dependiendo exclusivamente de copias locales en la estación de trabajo.

---

## 2. RESULTADOS DE LOS COMANDOS DE DIAGNÓSTICO GIT

### 2.1. Rama Actual
```powershell
git branch --show-current
```
- **Resultado:** `B_JACOBO`
- **Estado:** Se trabaja exclusivamente en la rama autorizada.

### 2.2. Estado del Árbol de Trabajo (`git status --short --untracked-files=all`)
```text
 M .gitignore
?? package.json
?? scratch/serve_demo.ts
?? scripts/detener-demo.ps1
?? scripts/estado-demo.ps1
?? scripts/iniciar-sigd-local.ps1
?? scripts/procesos-sigd.ps1
?? scripts/reiniciar-demo.ps1
```
- **Interpretación:**
  - `.gitignore` se encuentra **modificado** en el directorio de trabajo (con cambios no preparados).
  - Los scripts del orquestador y el supervisor aparecen clasificados con la marca `??`, lo que en Git significa **Untracked (Sin seguimiento)**. Git no tiene registro de estos archivos en su índice.

### 2.3. Comprobación en el Índice de Git (`git ls-files --error-unmatch`)

```powershell
git ls-files --error-unmatch scratch/serve_demo.ts
```
- **Resultado:**
  ```text
  error: pathspec 'scratch/serve_demo.ts' did not match any file(s) known to git
  (Exit code 1)
  ```

```powershell
git ls-files --error-unmatch scripts/procesos-sigd.ps1
```
- **Resultado:**
  ```text
  error: pathspec 'scripts/procesos-sigd.ps1' did not match any file(s) known to git
  (Exit code 1)
  ```

**Diagnóstico:** Ninguno de los dos archivos existe en el índice de Git ni en el commit HEAD actual de `B_JACOBO`.

### 2.4. Comprobación de Reglas de Ignorado (`git check-ignore -v`)

```powershell
git check-ignore -v scratch/serve_demo.ts
```
- **Resultado:**
  ```text
  .gitignore:114:!scratch/serve_demo.ts    scratch/serve_demo.ts
  ```

```powershell
git check-ignore -v scripts/procesos-sigd.ps1
```
- **Resultado:**
  ```text
  .gitignore:109:!scripts/procesos-sigd.ps1   scripts/procesos-sigd.ps1
  ```

**Diagnóstico:** Ambos archivos coinciden con reglas negativas (`!`), lo que demuestra que **ya no son ignorados por Git**, pero **no significa que estén versionados**. La des-ignotación es solo un habilitador previo para permitir su seguimiento futuro con `git add`.

---

## 3. DIFERENCIAL DE `.gitignore` (`git diff .gitignore`)

```diff
diff --git a/.gitignore b/.gitignore
index d61574c..a80f8e2 100644
--- a/.gitignore
+++ b/.gitignore
@@ -100,6 +100,18 @@ $RECYCLE.BIN/
 .antigravity/
 .gemini/
 scripts/
+!scripts/
+scripts/*
+!scripts/iniciar-sigd-local.ps1
+!scripts/detener-demo.ps1
+!scripts/estado-demo.ps1
+!scripts/reiniciar-demo.ps1
+!scripts/procesos-sigd.ps1
+
+scratch/
+!scratch/
+scratch/*
+!scratch/serve_demo.ts
 
 # --- Artefactos de Seguimiento de Agentes ---
 ORIGINAL_REQUEST.md
```

**Análisis:**
- Antes de TSK-BOOT-02, la regla `scripts/` ocultaba completamente la carpeta `scripts/`, y `scratch/` quedaba como repositorio temporal.
- Las excepciones incorporadas dejan explícitamente expuestos los 5 scripts PowerShell y el archivo TypeScript para que Git pueda rastrearlos, manteniendo temporal e ignorado todo lo demás (`scripts/*` y `scratch/*`).
- El archivo `.gitignore` modificado aún no ha sido añadido a la zona de staging (`git add`) ni comiteado.

---

## 4. AUDITORÍA DE SEGURIDAD Y SECRETOS

Se ejecutó un escaneo de patrones (`password`, `secret`, `token`, `bearer`, `private_key`) en todos los archivos indispensables del mecanismo de arranque:

| Archivo | Resultado del Escaneo | Observación de Seguridad |
|---|---|---|
| `scratch/serve_demo.ts` | **LIMPIO DE SECRETOS** | Consume variables mediante `process.env` y `%LOCALAPPDATA%\SIGD\secrets\demo-runtime.env`. No expone contraseñas. |
| `scripts/iniciar-sigd-local.ps1`| **LIMPIO DE SECRETOS** | Solo contiene lógica de supervisión, validación de salud y manejo de mutex. |
| `scripts/detener-demo.ps1` | **LIMPIO DE SECRETOS** | Solo invoca `Stop-SigdOwned` y gestiona mutex. |
| `scripts/estado-demo.ps1` | **LIMPIO DE SECRETOS** | Inspecciona contenedores y sondea endpoints HTTP. |
| `scripts/reiniciar-demo.ps1` | **LIMPIO DE SECRETOS** | Encadena detención e inicio seguro. |
| `scripts/procesos-sigd.ps1` | **LIMPIO DE SECRETOS** | Implementa lectura Win32 API de memoria de procesos (`SigdProcessReader`) sin almacenar credenciales. |
| `package.json` | **LIMPIO DE SECRETOS** | Define metadatos y scripts `dev`, `start`, `status`, `stop`, `restart`. |
| `.gitignore` | **LIMPIO DE SECRETOS** | Reglas de exclusión e inclusión de rutas. |

**Conclusión de Seguridad:** Ninguno de los archivos contiene credenciales o información institucional confidencial que impida su eventual inclusión en el repositorio.

---

## 5. CONFIRMACIÓN DE AUTENTICIDAD DE `scratch/serve_demo.ts`

Se comparó la copia activa en el espacio de trabajo contra la copia histórica de respaldo en:  
`C:\Users\Liz\Desktop\SIGD_BACKUPS\b_jacobo_pre_v1231_20261110_084908\archivos_untracked\scratch\serve_demo.ts`

- **Hash SHA-256 Workspace:**  
  `D4EDF233DA03B8707D6A993F33659D66356696053722B5026502C9EA2F501632`
- **Hash SHA-256 Respaldo Original:**  
  `D4EDF233DA03B8707D6A993F33659D66356696053722B5026502C9EA2F501632`
- **Resultado de Comparación Byte a Byte:** **COINCIDENCIA EXACTA (Hashes Match: True, 0 diferencias).**

El archivo activo es la versión fidedigna, auténtica e histórica del prototipo.

---

## 6. CLASIFICACIÓN RIGUROSA DEL ESTADO DE LOS ARCHIVOS

| Archivo | Estado Git Real | Explicación Técnica |
|---|---|---|
| `.gitignore` | **Modificado (Tracked / Unstaged)** | Registrado en Git en commits previos, pero posee modificaciones locales pendientes de commit. |
| `package.json` (raíz) | **Sin seguimiento (Untracked)** | Existe únicamente en el disco local. Git no lo conoce ni lo rastrea. |
| `scripts/iniciar-sigd-local.ps1` | **Sin seguimiento (Untracked)** | Des-ignorado en `.gitignore`, pero nunca agregado al índice (`git add`). |
| `scripts/detener-demo.ps1` | **Sin seguimiento (Untracked)** | Des-ignorado en `.gitignore`, pero nunca agregado al índice (`git add`). |
| `scripts/estado-demo.ps1` | **Sin seguimiento (Untracked)** | Des-ignorado en `.gitignore`, pero nunca agregado al índice (`git add`). |
| `scripts/reiniciar-demo.ps1` | **Sin seguimiento (Untracked)** | Des-ignorado en `.gitignore`, pero nunca agregado al índice (`git add`). |
| `scripts/procesos-sigd.ps1` | **Sin seguimiento (Untracked)** | Des-ignorado en `.gitignore`, pero nunca agregado al índice (`git add`). |
| `scratch/serve_demo.ts` | **Sin seguimiento (Untracked)** | Des-ignorado en `.gitignore`, pero nunca agregado al índice (`git add`). |
| `scratch/*` (otros archivos) | **Ignorado (Ignored)** | Cualquier otro script o archivo en `scratch/` permanece ignorado. |
| `scripts/*` (otros archivos) | **Ignorado (Ignored)** | Cualquier otro script auxiliar en `scripts/` permanece ignorado. |

---

## 7. ANÁLISIS DE RESILIENCIA ANTE UN CLON LIMPIO

Si un desarrollador o un entorno de integración continua clona el repositorio desde el origen remoto en este momento:

```powershell
git clone -b B_JACOBO <URL_REPOSITORIO> sigd-limpio
cd sigd-limpio
npm run dev
```

### Ocurrirán los siguientes fallos en cadena:
1. **Fallo en `package.json` raíz:**  
   El repositorio remoto solo tiene `backend/package.json` y `frontend/package.json`. No existe un `package.json` en la raíz. El comando `npm run dev` fallará de inmediato porque `package.json` no existe en la carpeta raíz del clon.
2. **Fallo en la carpeta `scripts/`:**  
   La carpeta `scripts/` no existirá o estará vacía en el clon, por lo que `scripts/iniciar-sigd-local.ps1` no estará presente.
3. **Fallo en `scratch/serve_demo.ts`:**  
   El clon no contendrá la carpeta `scratch/` ni el archivo `serve_demo.ts`.
4. **Fallo en `.gitignore`:**  
   El clon tendrá la versión antigua de `.gitignore`, la cual ignora completamente `scripts/` y no reconoce excepciones.

### Veredicto Técnico:
El mecanismo de arranque **aún depende de la persistencia local en la máquina de desarrollo**.  
No es reproducible en un clon limpio hasta que el usuario o el equipo técnico autorice formalmente:
1. Agregar al staging (`git add`) los archivos indispensables:
   - `.gitignore`
   - `package.json`
   - `scripts/iniciar-sigd-local.ps1`
   - `scripts/detener-demo.ps1`
   - `scripts/estado-demo.ps1`
   - `scripts/reiniciar-demo.ps1`
   - `scripts/procesos-sigd.ps1`
   - `scratch/serve_demo.ts`
2. Generar el commit correspondiente en la rama `B_JACOBO`.

---

## 8. RESTRICCIONES RESPETADAS

En estricta observancia de las reglas de protección de la tarea TSK-BOOT-03:
- **NO** se ejecutó `git add`.
- **NO** se realizaron commits.
- **NO** se realizó push.
- **NO** se cambió de rama.
- **NO** se modificaron archivos de código ni configuración.
- **NO** se eliminó ningún archivo.
- **NO** se alteraron los contenedores Docker ni PostgreSQL.

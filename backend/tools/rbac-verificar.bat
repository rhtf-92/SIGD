@echo off
REM ==========================================================================
REM  Verificacion del entregable RBAC - OrganiCore - B_PANAIFO
REM
REM  Uso:
REM    rbac-verificar.bat            TypeScript + suite unitaria + matriz
REM    rbac-verificar.bat matriz     Solo la visualizacion de la matriz
REM
REM  Notas de implementacion:
REM    · La salida de Vitest NO se redirige a archivo. Al redirigirla bajo
REM      chcp 65001 la suite se ralentiza de ~2 s a ~88 s y una prueba
REM      expira su timeout de 5 s de forma falsa. Se deja correr en vivo.
REM    · --silent oculta el log de 500 que emite a proposito la prueba de
REM      fallo cerrado; no oculta fallos, solo el ruido de consola.
REM    · Los caracteres no ASCII los emite Node, no este archivo.
REM ==========================================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0.."

if /i "%~1"=="matriz" goto :matriz

echo.
echo   ==============================================================
echo     VERIFICACION DEL ENTREGABLE RBAC  -  B_PANAIFO
echo     Matriz de permisos granulares sobre PostgreSQL + Redis
echo   ==============================================================
echo.

set "FALLOS=0"

echo   [1/3] Comprobacion de tipos (tsc --noEmit)
call npm run typecheck
if errorlevel 1 (
  echo         [FALLA] ^<--- hay errores de tipos
  set /a FALLOS+=1
) else (
  echo         [OK] sin errores de tipos
)
echo.

echo   [2/3] Suite unitaria de seguridad (Vitest)
call npx vitest run --config vitest.unit.config.ts --reporter=dot --silent
if errorlevel 1 (
  echo         [FALLA] la suite no paso
  set /a FALLOS+=1
) else (
  echo         [OK] la suite paso completa
)
echo.

echo   [3/3] Matriz RBAC e invariantes de minimo privilegio
node tools/rbac-matriz.mjs
if errorlevel 1 set /a FALLOS+=1
echo.

if "%FALLOS%"=="0" (
  echo   ==============================================================
  echo     RESULTADO: todo correcto
  echo   ==============================================================
) else (
  echo   ==============================================================
  echo     RESULTADO: %FALLOS% comprobacion^(es^) fallaron
  echo   ==============================================================
)
echo.
echo   Entregables:
echo     src\domains\organicore\rbac.service.ts
echo     src\domains\organicore\rbac.controller.ts
echo     src\middlewares\rbac.middleware.ts   (alias de src\middleware\)
echo     tests\unit\domains\organicore\rbac.spec.ts
echo.
pause
exit /b %FALLOS%

:matriz
node tools/rbac-matriz.mjs
echo.
pause
exit /b 0

@echo off
chcp 65001 > nul
title SIGD Suiza - Lanzador Rapido

echo ========================================================
echo    SISTEMA INTEGRAL DE GESTION DOCUMENTARIA (SIGD)
echo             Lanzador Rapido - Rama B_TAPULLIMA
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/4] Verificando archivos de configuracion .env...
if not exist "backend\.env" (
    echo Creando backend\.env desde .env.example...
    copy "backend\.env.example" "backend\.env" > nul
)
if not exist "frontend\.env.local" (
    echo Creando frontend\.env.local desde .env.example...
    copy "frontend\.env.example" "frontend\.env.local" > nul
)

echo [2/4] Verificando dependencias de Node.js...
if not exist "backend\node_modules" (
    echo Instalando dependencias de backend...
    cd backend && call npm install && cd ..
)
if not exist "frontend\node_modules" (
    echo Instalando dependencias de frontend...
    cd frontend && call npm install && cd ..
)

echo [3/4] Verificando servicios Docker (PostgreSQL, Redis, MinIO)...
where docker >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    docker info >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo Iniciando contenedores Docker de base de datos y servicios...
        docker compose up -d postgres redis minio
    ) else (
        echo [AVISO] Docker Desktop no esta activo. Inicielo si usara la base de datos por Docker.
    )
) else (
    echo [AVISO] Docker no encontrado en PATH. Asegurese de tener PostgreSQL en puerto 5433 o 5432.
)

echo.
echo [4/4] Levantando Backend y Frontend en ventanas separadas...
start "SIGD - Backend (Puerto 3008)" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 3 /nobreak > nul

start "SIGD - Frontend (Puerto 5178)" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 3 /nobreak > nul

echo.
echo ========================================================
echo   SIGD iniciado exitosamente:
echo   - Backend:  http://localhost:3008
echo   - Frontend: http://localhost:5178
echo ========================================================
echo Abriendo navegador en el Frontend...
start http://localhost:5178/

pause

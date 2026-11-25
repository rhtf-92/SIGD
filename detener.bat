@echo off
chcp 65001 > nul
echo Deteniendo procesos locales de Node.js en puertos 3008 y 5178...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3008 ^| findstr LISTENING') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5178 ^| findstr LISTENING') do taskkill /f /pid %%a 2>nul
echo Listo. Servicios detenidos.
pause

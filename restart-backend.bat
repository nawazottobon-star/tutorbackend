@echo off
echo Restarting backend server...
echo.

REM Find and kill process on port 4000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000 ^| findstr LISTENING') do (
    echo Killing process %%a...
    taskkill /F /PID %%a >nul 2>&1
)

REM Wait a moment
timeout /t 1 /nobreak >nul

REM Start server
echo Starting backend...
cd /d "%~dp0"
node node_modules\tsx\dist\cli.mjs src\server.ts

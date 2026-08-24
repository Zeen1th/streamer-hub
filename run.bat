@echo off
setlocal
cd /d "%~dp0"

taskkill /IM StreamerHub.exe /F >nul 2>&1

echo [Streamer Hub] Building frontend...
call npm run build
if errorlevel 1 goto :fail

echo [Streamer Hub] Building core...
dotnet build "core\StreamerHub.csproj" -c Debug --nologo -v q
if errorlevel 1 goto :fail

echo [Streamer Hub] Starting...
start "" "core\bin\Debug\net8.0-windows\StreamerHub.exe"
exit /b 0

:fail
echo.
echo [Streamer Hub] Build failed. See the output above.
pause
exit /b 1

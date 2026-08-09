@echo off
REM ============================================================
REM  Consmat AI - one-click launcher for Windows
REM  Double-click this file (or run it in PowerShell/CMD).
REM  Requires Docker Desktop to be installed and RUNNING.
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo   Consmat AI - starting the full platform...
echo.

REM 1) Docker present?
where docker >nul 2>nul
if errorlevel 1 (
  echo   [X] Docker is not installed / not on PATH.
  echo       Install Docker Desktop from https://www.docker.com/products/docker-desktop
  echo       then double-click this file again.
  pause
  exit /b 1
)

REM 2) Docker daemon running?
docker info >nul 2>nul
if errorlevel 1 (
  echo   [X] Docker Desktop is installed but not running.
  echo       Start Docker Desktop, wait for it to say "running", then re-run this file.
  pause
  exit /b 1
)

REM 3) Build + start (frontends are prebuilt, so this is fast)
echo   Building and starting containers (first run ~1-2 min)...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo   [X] Something went wrong during startup. Full logs:
  docker compose logs --tail=60
  pause
  exit /b 1
)

REM 4) Wait for the API health check
echo   Waiting for the backend to be healthy...
set /a tries=0
:waitloop
curl -s -o nul http://localhost:3000/health && goto healthy
set /a tries+=1
if %tries% GEQ 60 (
  echo   [!] Backend didn't respond in time. Logs:
  docker compose logs --tail=40 backend
  pause
  exit /b 1
)
timeout /t 2 >nul
goto waitloop

:healthy
echo.
echo   ================= Consmat AI is LIVE =================
echo     Buyer      http://localhost:8080
echo     Vendor     http://localhost:8081
echo     Admin      http://localhost:8082
echo     Operator   http://localhost:8083
echo     API / docs http://localhost:3000/docs
echo.
echo     Demo logins (password: consmat123)
echo       buyer@consmat.com  vendor@consmat.com
echo       admin@consmat.com  operator@consmat.in
echo   =====================================================
echo.
REM 5) Open all four apps in the default browser
start "" http://localhost:8080
start "" http://localhost:8082
start "" http://localhost:8081
start "" http://localhost:8083
echo   Opened the apps in your browser. To stop: run STOP.bat
pause

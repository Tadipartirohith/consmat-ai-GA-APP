@echo off
cd /d "%~dp0"
echo Stopping Consmat AI...
docker compose down
echo Done.
pause

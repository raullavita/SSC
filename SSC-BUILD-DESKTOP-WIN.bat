@echo off
setlocal
cd /d "%~dp0frontend"
echo == Building React bundle for desktop ==
call yarn build:desktop
if errorlevel 1 exit /b 1
cd desktop
echo == Installing desktop dependencies ==
call yarn install
if errorlevel 1 exit /b 1
echo == Building Windows installer ==
set CSC_IDENTITY_AUTO_DISCOVERY=false
call yarn build:win
if errorlevel 1 exit /b 1
echo.
echo DONE: frontend\desktop\dist\SSC-Setup-1.0.5.exe
endlocal
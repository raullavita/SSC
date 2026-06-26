@echo off
setlocal
set "YARN_CMD=yarn"
where yarn >nul 2>&1
if errorlevel 1 set "YARN_CMD=corepack yarn"
cd /d "%~dp0frontend"
echo == Building React bundle for desktop ==
call %YARN_CMD% build:desktop
if errorlevel 1 exit /b 1
cd desktop
echo == Installing desktop dependencies ==
call %YARN_CMD% install
if errorlevel 1 exit /b 1
echo == Building Windows installer ==
set CSC_IDENTITY_AUTO_DISCOVERY=false
call %YARN_CMD% build:win
if errorlevel 1 exit /b 1
echo.
if not exist "C:\Users\smash\Desktop\SSC" mkdir "C:\Users\smash\Desktop\SSC"
copy /Y dist\SSC-Setup-1.0.8.exe C:\Users\smash\Desktop\SSC\SSC-Setup-1.0.8.exe
echo.
echo DONE: frontend\desktop\dist\SSC-Setup-1.0.8.exe
echo       C:\Users\smash\Desktop\SSC\SSC-Setup-1.0.8.exe
endlocal